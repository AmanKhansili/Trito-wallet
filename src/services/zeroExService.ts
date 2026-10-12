import { ethers } from 'ethers';
import { NetworkId, TokenConfig, SwapQuote, TransactionRecord } from '../types';
import { ERC20_ABI } from '../config/uniswap';
import { getNetwork } from '../config/networks';
import { getProvider, cryptoService } from './cryptoService';
import { walletService } from './walletService';
import { priceService } from './priceService';
import { storageService } from './storageService';
import { formatTokenBalance } from '../utils/formatters';
import { parseBlockchainError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import type { SwapExecutionCallback } from './swapService';

const ZEROX_BASE_URL = 'https://api.0x.org/swap/allowance-holder';
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// WETH Mainnet Contract Address aur Standard ABI
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const WETH_ABI = [
  'function deposit() public payable',
  'function withdraw(uint256 wad) public',
  'function balanceOf(address owner) view returns (uint256)',
];

// 0x AllowanceHolder contract per chain
const ALLOWANCE_HOLDER: Record<number, string> = {
  1: '0x0000000000001fF3684f28c67538d4D072C22734',
};

/**
 * Checks if the swap is a direct ETH <-> WETH conversion
 */
function getWrapType(fromToken: TokenConfig, toToken: TokenConfig): 'WRAP' | 'UNWRAP' | null {
  const isFromNative = fromToken.type === 'NATIVE';
  const isToNative = toToken.type === 'NATIVE';
  const isFromWeth =
    fromToken.contractAddress?.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
    fromToken.symbol.toUpperCase() === 'WETH';
  const isToWeth =
    toToken.contractAddress?.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
    toToken.symbol.toUpperCase() === 'WETH';

  if (isFromNative && isToWeth) return 'WRAP';
  if (isFromWeth && isToNative) return 'UNWRAP';
  return null;
}

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
  /** Indicative price preview. Handles direct wrap preview locally (1:1 ratio). */
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

    const ethUsd = priceService.getPriceForToken('ethereum')?.usd ?? 0;
    const wrapType = getWrapType(fromToken, toToken);

    // Direct 1:1 ETH <-> WETH preview without making an unnecessary 0x aggregator call
    if (wrapType) {
      const feeData = await cryptoService.getDynamicFeeData(networkId);
      const estimatedGasUnits = wrapType === 'WRAP' ? 45000n : 55000n;
      const estimatedGasCostWei = estimatedGasUnits * feeData.maxFeePerGas;
      const estimatedGasCostEth = ethers.formatEther(estimatedGasCostWei);

      return {
        fromToken,
        toToken,
        amountInRaw,
        amountInFormatted: formatTokenBalance(amountInRaw, fromToken.decimals),
        amountOutRaw: amountInRaw,
        amountOutFormatted: formatTokenBalance(amountInRaw, toToken.decimals),
        amountOutMinimumRaw: amountInRaw,
        amountOutMinimumFormatted: formatTokenBalance(amountInRaw, toToken.decimals),
        executionPrice: 1.0,
        priceImpactPercent: 0,
        slippageTolerance: 0,
        estimatedGasUnits,
        estimatedGasCostEth,
        estimatedGasCostUsd: Number(estimatedGasCostEth) * ethUsd,
        poolFee: 0,
        route: [fromToken.symbol, toToken.symbol],
        liquiditySource: wrapType === 'WRAP' ? 'WETH Deposit Contract' : 'WETH Withdraw Contract',
        provider: '0x',
        quotedAt: Date.now(),
        marketDeviationPercent: 0,
        warnings: [],
      };
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

    const warnings: string[] = [];
    let deviation: number | undefined;
    const fromMarket = priceService.getPriceForToken(fromToken.coingeckoId)?.usd;
    const toMarket = priceService.getPriceForToken(toToken.coingeckoId)?.usd;
    if (fromMarket && toMarket && fromMarket > 0 && toMarket > 0 && executionRate > 0) {
      const fairRate = fromMarket / toMarket;
      deviation = ((executionRate - fairRate) / fairRate) * 100;
      if (deviation < -30) {
        throw new Error(
          `Rate is ${Math.abs(deviation).toFixed(1)}% worse than the market price. Swap blocked for your security.`,
        );
      }
      if (deviation > 30) {
        warnings.push('Rate is very different from the market price. Double-check the tokens.');
      }
    }

    let gasCostWei = 0n;
    try {
      if (data.totalNetworkFee) gasCostWei = BigInt(data.totalNetworkFee);
      else if (data.gas && data.gasPrice) gasCostWei = BigInt(data.gas) * BigInt(data.gasPrice);
    } catch {
      gasCostWei = 0n;
    }
    const estimatedGasCostEth = ethers.formatEther(gasCostWei);

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

  /** Firm quote + wrap/unwrap detection + (approval if needed) + dynamic fees + sign + send. */
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
      // Step 1: Balance check
      onProgress('checking_balance', 'Verifying wallet balance...');
      if (quote.fromToken.type === 'NATIVE') {
        const bal = await provider.getBalance(userAddress);
        if (bal < quote.amountInRaw) throw new Error('Insufficient ETH balance for swap.');
      } else {
        const erc20 = new ethers.Contract(quote.fromToken.contractAddress!, ERC20_ABI, provider);
        const bal = BigInt((await erc20.balanceOf(userAddress)).toString());
        if (bal < quote.amountInRaw) throw new Error(`Insufficient ${quote.fromToken.symbol} balance for swap.`);
      }

      const feeData = await cryptoService.getDynamicFeeData(networkId);
      const wrapType = getWrapType(quote.fromToken, quote.toToken);

      // Step 1.5: Direct Wrap / Unwrap execution bypasses 0x router
      if (wrapType) {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        onProgress(
          'submitting_swap',
          wrapType === 'WRAP' ? 'Depositing ETH to WETH contract...' : 'Withdrawing WETH to ETH...',
        );

        let txResponse: ethers.TransactionResponse;
        if (wrapType === 'WRAP') {
          txResponse = await wethContract.deposit({
            value: quote.amountInRaw,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          });
        } else {
          txResponse = await wethContract.withdraw(quote.amountInRaw, {
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          });
        }

        onProgress('waiting_confirmation', 'Waiting for confirmation...', txResponse.hash);

        const record: TransactionRecord = {
          hash: txResponse.hash,
          type: 'swap',
          status: 'pending',
          tokenSymbol: quote.fromToken.symbol,
          amount: quote.amountInFormatted,
          from: userAddress,
          to: WETH_ADDRESS,
          networkId,
          timestamp: Date.now(),
          swapDetails: {
            toTokenSymbol: quote.toToken.symbol,
            toAmount: quote.amountOutFormatted,
            rate: '1.0',
          },
        };
        await upsertTransaction(record);

        const receipt = await txResponse.wait(1);
        if (!receipt || receipt.status === 0) throw new Error('Wrap/Unwrap transaction reverted.');

        const confirmed: TransactionRecord = {
          ...record,
          status: 'confirmed',
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.gasPrice.toString(),
        };
        await upsertTransaction(confirmed);

        onProgress('confirmed', `${wrapType === 'WRAP' ? 'Wrapped' : 'Unwrapped'} successfully!`, receipt.hash);
        return confirmed;
      }

      // Step 2: Firm quote from 0x API
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

      // Step 3: Allowance check & approve
      if (quote.fromToken.type === 'ERC20' && firm.issues?.allowance) {
        const { spender, actual } = firm.issues.allowance;
        assertTrustedSpender(chainId, spender);
        onProgress('checking_allowance', `Checking ${quote.fromToken.symbol} allowance...`);

        const token = new ethers.Contract(quote.fromToken.contractAddress!, ERC20_ABI, signer);

        // USDT allowance reset logic
        if (quote.fromToken.symbol === 'USDT' && BigInt(actual ?? '0') > 0n) {
          onProgress('approving', 'Resetting USDT allowance...');
          const resetTx = await token.approve(spender, 0n, {
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          });
          await resetTx.wait(1);
        }

        onProgress('approving', `Approving ${quote.fromToken.symbol} for swap...`);
        const approveTx = await token.approve(spender, quote.amountInRaw, {
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        onProgress('approving', 'Waiting for approval on-chain...', approveTx.hash);
        const approveReceipt = await approveTx.wait(1);
        if (!approveReceipt || approveReceipt.status === 0) {
          throw new Error(`Approval failed for ${quote.fromToken.symbol}.`);
        }
        onProgress('approval_confirmed', 'Approval confirmed on-chain.', approveReceipt.hash);

        // Refresh quote post-approval
        onProgress('quoting', 'Refreshing quote...');
        firm = await fetchFirmQuote(params, quote);
      }

      // Step 4: Send the transaction prepared by 0x with dynamic EIP-1559 priority fee
      onProgress('submitting_swap', 'Signing and submitting swap...');
      const tx = firm.transaction;

      // Ensure maxFeePerGas covers base fee and priority fee properly
      const maxPriorityFee = feeData.maxPriorityFeePerGas;
      const calculatedMaxFee = tx.gasPrice
        ? (BigInt(tx.gasPrice) * 125n) / 100n + maxPriorityFee
        : feeData.maxFeePerGas;

      const txResponse = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value ?? '0'),
        gasLimit: tx.gas ? (BigInt(tx.gas) * 120n) / 100n : undefined,
        maxFeePerGas: calculatedMaxFee,
        maxPriorityFeePerGas: maxPriorityFee,
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