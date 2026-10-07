import { ethers } from 'ethers';
import { NetworkId, TokenConfig, SwapQuote, TransactionRecord } from '../types';
import { ERC20_ABI } from '../config/uniswap';
import { getNetwork } from '../config/networks';
import { getProvider } from './cryptoService';
import { walletService } from './walletService';
import { priceService } from './priceService';
import { storageService } from './storageService';
import { formatTokenBalance } from '../utils/formatters';
import { parseBlockchainError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import type { SwapExecutionCallback } from './swapService';

const ZEROX_BASE_URL = 'https://api.0x.org/swap/allowance-holder';
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// 0x AllowanceHolder contract per chain. We only approve this address, so a tampered
// API response cannot trick the wallet into approving some other contract.
const ALLOWANCE_HOLDER: Record<number, string> = {
  1: '0x0000000000001fF3684f28c67538d4D072C22734',
};

/**
 * TEMPORARY: calls 0x directly with the key from .env (key ends up inside the app bundle).
 * Later, replace ONLY this function with a call to the Supabase Edge Function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callZeroX(endpoint: 'price' | 'quote', params: Record<string, string>): Promise<any> {
  const apiKey = process.env.EXPO_PUBLIC_ZEROX_API_KEY;
  if (!apiKey) {
    throw new Error('0x API key missing. Add EXPO_PUBLIC_ZEROX_API_KEY to .env and restart Expo with -c.');
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${ZEROX_BASE_URL}/${endpoint}?${qs}`, {
    headers: { '0x-api-key': apiKey, '0x-version': 'v2', Accept: 'application/json' },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || body?.reason || `0x API error (${res.status})`);
  }
  return body;
}

function tokenAddress(token: TokenConfig): string {
  return token.type === 'NATIVE' ? NATIVE_TOKEN_ADDRESS : token.contractAddress!;
}

function buildParams(
  fromToken: TokenConfig,
  toToken: TokenConfig,
  amountInRaw: bigint,
  slippagePercent: number,
  networkId: NetworkId,
  taker: string,
): Record<string, string> {
  return {
    chainId: String(getNetwork(networkId).chainId),
    sellToken: tokenAddress(fromToken),
    buyToken: tokenAddress(toToken),
    sellAmount: amountInRaw.toString(),
    taker,
    slippageBps: String(Math.round(slippagePercent * 100)),
  };
}

function assertTrustedSpender(chainId: number, spender: string) {
  const expected = ALLOWANCE_HOLDER[chainId];
  if (expected && expected.toLowerCase() !== spender.toLowerCase()) {
    throw new Error('Unexpected approval address in quote. Swap blocked for your security.');
  }
}

async function fetchFirmQuote(params: Record<string, string>, agreed: SwapQuote) {
  const firm = await callZeroX('quote', params);
  if (firm.liquidityAvailable === false || !firm.transaction) {
    throw new Error('0x could not find a route for this swap right now.');
  }
  if (firm.issues?.balance) {
    throw new Error(`Insufficient ${agreed.fromToken.symbol} balance for this swap.`);
  }
  // Never accept less than the minimum the user saw on screen
  if (BigInt(firm.buyAmount) < agreed.amountOutMinimumRaw) {
    throw new Error('Price moved below your minimum received. Please review the swap again.');
  }
  return firm;
}

async function upsertTransaction(record: TransactionRecord) {
  const existing = await storageService.getTransactions();
  await storageService.saveTransactions([record, ...existing.filter((t) => t.hash !== record.hash)]);
}

export const zeroExService = {
  /** Indicative price from 0x (free, no gas). Used for the preview on the swap screen. */
  async getSwapQuote(
    fromToken: TokenConfig,
    toToken: TokenConfig,
    amountInRaw: bigint,
    slippageTolerancePercent: number,
    networkId: NetworkId,
  ): Promise<SwapQuote> {
    if (amountInRaw <= 0n) throw new Error('Enter a valid swap amount greater than zero.');
    if (fromToken.symbol === toToken.symbol && fromToken.network === toToken.network) {
      throw new Error('Cannot swap a token for itself.');
    }

    const network = getNetwork(networkId);
    if (network.isTestnet) {
      throw new Error('0x does not support test networks. Switch to Ethereum Mainnet.');
    }

    const taker = await walletService.getAddress();
    if (!taker) throw new Error('Wallet address not found.');

    const params = buildParams(fromToken, toToken, amountInRaw, slippageTolerancePercent, networkId, taker);
    const data = await callZeroX('price', params);

    if (data.liquidityAvailable === false) {
      throw new Error(`No liquidity found for ${fromToken.symbol} → ${toToken.symbol}.`);
    }

    const amountOutRaw = BigInt(data.buyAmount);
    const amountOutMinimumRaw = data.minBuyAmount
      ? BigInt(data.minBuyAmount)
      : (amountOutRaw * BigInt(10000 - Math.round(slippageTolerancePercent * 100))) / 10000n;

    const amountInFloat = Number(ethers.formatUnits(amountInRaw, fromToken.decimals));
    const amountOutFloat = Number(ethers.formatUnits(amountOutRaw, toToken.decimals));
    const executionRate = amountInFloat > 0 ? amountOutFloat / amountInFloat : 0;

    // Compare with market price (CoinGecko). Worse than -30% => block, better than +30% => warn.
    const warnings: string[] = [];
    let deviation: number | undefined;
    const fromMarket = priceService.getPriceForToken(fromToken.coingeckoId)?.usd;
    const toMarket = priceService.getPriceForToken(toToken.coingeckoId)?.usd;
    if (fromMarket && toMarket && fromMarket > 0 && toMarket > 0 && executionRate > 0) {
      const fairRate = fromMarket / toMarket;
      deviation = ((executionRate - fairRate) / fairRate) * 100; // + better, - worse than market
      if (deviation < -30) {
        throw new Error(
          `Rate is ${Math.abs(deviation).toFixed(1)}% worse than the market price. Swap blocked for your security.`,
        );
      }
      if (deviation > 30) {
        warnings.push('Rate is very different from the market price. Double-check the tokens.');
      }
    }

    // Network fee (field names can differ slightly, so stay defensive)
    let gasCostWei = 0n;
    try {
      if (data.totalNetworkFee) gasCostWei = BigInt(data.totalNetworkFee);
      else if (data.gas && data.gasPrice) gasCostWei = BigInt(data.gas) * BigInt(data.gasPrice);
    } catch {
      gasCostWei = 0n;
    }
    const estimatedGasCostEth = ethers.formatEther(gasCostWei);
    const ethUsd = priceService.getPriceForToken('ethereum')?.usd ?? 0;

    const fills: { source: string; proportionBps: string | number }[] = data.route?.fills ?? [];
    const liquiditySource = fills.length
      ? '0x: ' + fills.map((f) => `${f.source} ${Number(f.proportionBps) / 100}%`).join(', ')
      : '0x';
    const routeSymbols: string[] =
      data.route?.tokens?.map((t: { symbol?: string }) => t.symbol).filter(Boolean) ?? [];

    return {
      fromToken,
      toToken,
      amountInRaw,
      amountInFormatted: formatTokenBalance(amountInRaw, fromToken.decimals),
      amountOutRaw,
      amountOutFormatted: formatTokenBalance(amountOutRaw, toToken.decimals),
      amountOutMinimumRaw,
      amountOutMinimumFormatted: formatTokenBalance(amountOutMinimumRaw, toToken.decimals),
      executionPrice: executionRate,
      priceImpactPercent: deviation !== undefined ? Math.max(0, -deviation) : 0,
      slippageTolerance: slippageTolerancePercent,
      estimatedGasUnits: data.gas ? BigInt(data.gas) : 0n,
      estimatedGasCostEth,
      estimatedGasCostUsd: Number(estimatedGasCostEth) * ethUsd,
      poolFee: Number((data.route?.fills?.[0] as { poolFee?: number | string } | undefined)?.poolFee ?? 0),
      route: routeSymbols.length ? routeSymbols : [fromToken.symbol, toToken.symbol],
      liquiditySource,
      provider: '0x',
      quotedAt: Date.now(),
      marketDeviationPercent: deviation,
      warnings,
    };
  },

  /** Firm quote + (approval if needed) + sign + send + wait. */
  async executeSwap(
    quote: SwapQuote,
    networkId: NetworkId,
    onProgress: SwapExecutionCallback,
  ): Promise<TransactionRecord> {
    const provider = getProvider(networkId);
    const signer = walletService.getSigner(provider);
    const userAddress = await signer.getAddress();
    const chainId = getNetwork(networkId).chainId;

    try {
      // Step 1: balance
      onProgress('checking_balance', 'Verifying wallet balance...');
      if (quote.fromToken.type === 'NATIVE') {
        const bal = await provider.getBalance(userAddress);
        if (bal < quote.amountInRaw) throw new Error('Insufficient ETH balance for swap.');
      } else {
        const erc20 = new ethers.Contract(quote.fromToken.contractAddress!, ERC20_ABI, provider);
        const bal = BigInt((await erc20.balanceOf(userAddress)).toString());
        if (bal < quote.amountInRaw) throw new Error(`Insufficient ${quote.fromToken.symbol} balance for swap.`);
      }

      // Step 2: firm quote
      const params = buildParams(
        quote.fromToken,
        quote.toToken,
        quote.amountInRaw,
        quote.slippageTolerance,
        networkId,
        userAddress,
      );
      onProgress('quoting', 'Getting final quote from 0x...');
      let firm = await fetchFirmQuote(params, quote);

      // Step 3: allowance (ERC20 only)
      if (quote.fromToken.type === 'ERC20' && firm.issues?.allowance) {
        const { spender, actual } = firm.issues.allowance;
        assertTrustedSpender(chainId, spender);
        onProgress('checking_allowance', `Checking ${quote.fromToken.symbol} allowance...`);

        const token = new ethers.Contract(quote.fromToken.contractAddress!, ERC20_ABI, signer);

        // USDT needs the allowance reset to 0 before setting a new non-zero value
        if (quote.fromToken.symbol === 'USDT' && BigInt(actual ?? '0') > 0n) {
          onProgress('approving', 'Resetting USDT allowance...');
          const resetTx = await token.approve(spender, 0n);
          await resetTx.wait(1);
        }

        onProgress('approving', `Approving ${quote.fromToken.symbol} for swap...`);
        const approveTx = await token.approve(spender, quote.amountInRaw);
        onProgress('approving', 'Waiting for approval on-chain...', approveTx.hash);
        const approveReceipt = await approveTx.wait(1);
        if (!approveReceipt || approveReceipt.status === 0) {
          throw new Error(`Approval failed for ${quote.fromToken.symbol}.`);
        }
        onProgress('approval_confirmed', 'Approval confirmed on-chain.', approveReceipt.hash);

        // Approval took time, so get a fresh firm quote
        onProgress('quoting', 'Refreshing quote...');
        firm = await fetchFirmQuote(params, quote);
      }

      // Step 4: send the transaction prepared by 0x
      onProgress('submitting_swap', 'Signing and submitting swap...');
      const tx = firm.transaction;
      const txResponse = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value ?? '0'),
        gasLimit: tx.gas ? (BigInt(tx.gas) * 120n) / 100n : undefined, // +20% buffer
      });

      onProgress('waiting_confirmation', 'Swap submitted. Waiting for confirmation...', txResponse.hash);

      const record: TransactionRecord = {
        hash: txResponse.hash,
        type: 'swap',
        status: 'pending',
        tokenSymbol: quote.fromToken.symbol,
        amount: quote.amountInFormatted,
        from: userAddress,
        to: tx.to,
        networkId,
        timestamp: Date.now(),
        swapDetails: {
          toTokenSymbol: quote.toToken.symbol,
          toAmount: quote.amountOutFormatted,
          rate: `1 ${quote.fromToken.symbol} ≈ ${quote.executionPrice.toFixed(4)} ${quote.toToken.symbol}`,
        },
      };
      await upsertTransaction(record);

      const receipt = await txResponse.wait(1);
      if (!receipt || receipt.status === 0) throw new Error('Swap transaction reverted on-chain.');

      const confirmed: TransactionRecord = {
        ...record,
        status: 'confirmed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
      await upsertTransaction(confirmed);

      onProgress('confirmed', 'Swap confirmed successfully on blockchain!', receipt.hash);
      return confirmed;
    } catch (err) {
      logger.error('0x swap execution failed:', err);
      const parsed = parseBlockchainError(err);
      onProgress('failed', parsed.userMessage);
      throw new Error(parsed.userMessage);
    }
  },
};