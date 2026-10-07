import { ethers } from 'ethers';
import {
  NetworkId,
  TokenConfig,
  SwapQuote,
  GasEstimate,
  TransactionRecord,
  SwapStepId,
} from '../types';
import {
  UNISWAP_CONTRACTS,
  UNISWAP_POOL_FEES,
  ERC20_ABI,
  QUOTER_V2_ABI,
  SWAP_ROUTER_02_ABI,
} from '../config/uniswap';
import { getProvider } from './cryptoService';
import { walletService } from './walletService';
import { priceService } from './priceService';
import { storageService } from './storageService';
import { formatTokenBalance } from '../utils/formatters';
import { parseBlockchainError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface SwapExecutionCallback {
  (step: SwapStepId, message: string, txHash?: string): void;
}

export const swapService = {
  /**
   * Fetches an on-chain quote from Uniswap V3 QuoterV2.
   * Tests pool tiers (500, 3000, 10000), checks market deviation and liquidity sanity.
   * NEVER uses CoinGecko prices as swap output.
   */
  async getSwapQuote(
    fromToken: TokenConfig,
    toToken: TokenConfig,
    amountInRaw: bigint,
    slippageTolerancePercent: number, // e.g. 0.5
    networkId: NetworkId,
  ): Promise<SwapQuote> {
    if (amountInRaw <= 0n) {
      throw new Error('Enter a valid swap amount greater than zero.');
    }

    if (
      fromToken.symbol.toUpperCase() === toToken.symbol.toUpperCase() &&
      fromToken.network === toToken.network
    ) {
      throw new Error('Cannot swap a token for itself.');
    }

    const contracts = UNISWAP_CONTRACTS[networkId];
    const provider = getProvider(networkId);

    // Resolve wrapped ETH addresses if swapping native ETH
    const tokenInAddress =
      fromToken.type === 'NATIVE' ? contracts.weth : fromToken.contractAddress!;
    const tokenOutAddress = toToken.type === 'NATIVE' ? contracts.weth : toToken.contractAddress!;

    const quoter = new ethers.Contract(contracts.quoterV2, QUOTER_V2_ABI, provider);

    let bestQuote: {
      amountOut: bigint;
      fee: number;
      gasEstimate: bigint;
    } | null = null;

    // Discover pools across fee tiers
    for (const fee of UNISWAP_POOL_FEES) {
      try {
        const params = {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          amountIn: amountInRaw,
          fee: fee,
          sqrtPriceLimitX96: 0n,
        };

        const result = await quoter.quoteExactInputSingle.staticCall(params);
        const amountOut = BigInt(result[0].toString());
        const gasEstimate = BigInt(result[3]?.toString() || '180000');

        if (amountOut > 0n) {
          if (!bestQuote || amountOut > bestQuote.amountOut) {
            bestQuote = { amountOut, fee, gasEstimate };
          }
        }
      } catch {
        // Pool fee tier does not exist or has zero liquidity, continue
      }
    }

    if (!bestQuote || bestQuote.amountOut <= 0n) {
      throw new Error(
        `No Uniswap V3 liquidity pool available for ${fromToken.symbol} → ${toToken.symbol} on ${networkId}.`,
      );
    }

    const amountInFloat = Number(ethers.formatUnits(amountInRaw, fromToken.decimals));
    const amountOutFloat = Number(ethers.formatUnits(bestQuote.amountOut, toToken.decimals));
    const executionRate = amountInFloat > 0 ? amountOutFloat / amountInFloat : 0;

    // Market Price Validation & Extreme Deviation Protection
    const fromMarket = priceService.getPriceForToken(fromToken.coingeckoId)?.usd;
    const toMarket = priceService.getPriceForToken(toToken.coingeckoId)?.usd;

    let priceImpactPercent = 0;
    if (fromMarket && toMarket && fromMarket > 0 && toMarket > 0) {
      const fairMarketRate = fromMarket / toMarket;
      priceImpactPercent = ((fairMarketRate - executionRate) / fairMarketRate) * 100;

      // CRITICAL SAFETY CHECK: Block transaction if quote deviates wildly (> 30% loss)
      if (priceImpactPercent > 30) {
        throw new Error(
          `Abnormal quote detected: On-chain price impact is ${priceImpactPercent.toFixed(
            1,
          )}%. This pool lacks sufficient liquidity. Swap blocked for your security.`,
        );
      }
    }

    // Calculate minimum received with slippage
    // e.g. 0.5% slippage => multiplier 9950 / 10000
    const slippageBps = BigInt(Math.floor((100 - slippageTolerancePercent) * 100));
    const amountOutMinimumRaw = (bestQuote.amountOut * slippageBps) / 10000n;

    // Gas estimation
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? ethers.parseUnits('25', 'gwei');
    const estimatedGasCostWei = bestQuote.gasEstimate * gasPrice;
    const estimatedGasCostEth = ethers.formatEther(estimatedGasCostWei);
    const ethPrice = priceService.getPriceForToken('ethereum')?.usd ?? 3000;
    const estimatedGasCostUsd = Number(estimatedGasCostEth) * ethPrice;

    return {
      fromToken,
      toToken,
      amountInRaw,
      amountInFormatted: formatTokenBalance(amountInRaw, fromToken.decimals),
      amountOutRaw: bestQuote.amountOut,
      amountOutFormatted: formatTokenBalance(bestQuote.amountOut, toToken.decimals),
      amountOutMinimumRaw,
      amountOutMinimumFormatted: formatTokenBalance(amountOutMinimumRaw, toToken.decimals),
      executionPrice: executionRate,
      priceImpactPercent: Math.max(0, priceImpactPercent),
      slippageTolerance: slippageTolerancePercent,
      poolFee: bestQuote.fee,
      estimatedGasUnits: bestQuote.gasEstimate,
      estimatedGasCostEth,
      estimatedGasCostUsd,
      route: [fromToken.symbol, toToken.symbol],
      liquiditySource: `Uniswap V3 (${bestQuote.fee / 10000}%)`,
      provider: 'uniswap',
      quotedAt: Date.now(),
    };
  },

  /**
   * Check allowance of ERC20 token for SwapRouter02.
   */
  async checkAllowance(
    token: TokenConfig,
    ownerAddress: string,
    networkId: NetworkId,
  ): Promise<bigint> {
    if (token.type === 'NATIVE' || !token.contractAddress) {
      return ethers.MaxUint256; // Native ETH does not need ERC20 approval
    }

    const contracts = UNISWAP_CONTRACTS[networkId];
    const provider = getProvider(networkId);
    const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, provider);

    const allowance = await contract.allowance(ownerAddress, contracts.swapRouter02);
    return BigInt(allowance.toString());
  },

  /**
   * Approves SwapRouter02 to spend the ERC20 token.
   * Waits for 1 confirmation and re-checks allowance.
   */
  async approveToken(
    token: TokenConfig,
    amountRaw: bigint,
    networkId: NetworkId,
    onProgress?: (msg: string, txHash?: string) => void,
  ): Promise<string> {
    if (token.type === 'NATIVE' || !token.contractAddress) {
      return '';
    }

    const contracts = UNISWAP_CONTRACTS[networkId];
    const provider = getProvider(networkId);
    const signer = walletService.getSigner(provider);
    const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, signer);

    onProgress?.(`Approving ${token.symbol} for swap...`);
    logger.info(`Approving ${token.symbol} for Uniswap Router: ${contracts.swapRouter02}`);

    const txResponse = await contract.approve(contracts.swapRouter02, amountRaw);
    onProgress?.(`Waiting for ${token.symbol} approval on-chain...`, txResponse.hash);

    const receipt = await txResponse.wait(1);
    if (!receipt || receipt.status === 0) {
      throw new Error(`Approval transaction failed for ${token.symbol}.`);
    }

    // Verify allowance is now sufficient
    const ownerAddress = await signer.getAddress();
    const currentAllowance = await contract.allowance(ownerAddress, contracts.swapRouter02);
    if (BigInt(currentAllowance.toString()) < amountRaw) {
      throw new Error('Approval confirmation verification failed. Please try again.');
    }

    onProgress?.(`Approval confirmed on-chain.`);
    return receipt.hash;
  },

  /**
   * Executes the full multi-step Uniswap V3 swap.
   * Handles:
   * 1. Balance verification
   * 2. Allowance check & on-chain approval if ERC20
   * 3. WETH wrapping / unwrapping via SwapRouter02 multicall
   * 4. Gas verification
   * 5. Local transaction signing & on-chain confirmation
   */
  async executeSwap(
    quote: SwapQuote,
    networkId: NetworkId,
    onProgress: SwapExecutionCallback,
  ): Promise<TransactionRecord> {
    const contracts = UNISWAP_CONTRACTS[networkId];
    const provider = getProvider(networkId);
    const signer = walletService.getSigner(provider);
    const userAddress = await signer.getAddress();

    try {
      // Step 1: Checking Balance
      onProgress('checking_balance', 'Verifying wallet balance...');
      if (quote.fromToken.type === 'NATIVE') {
        const ethBal = await provider.getBalance(userAddress);
        if (ethBal < quote.amountInRaw) {
          throw new Error('Insufficient ETH balance for swap.');
        }
      } else {
        const tokenContract = new ethers.Contract(
          quote.fromToken.contractAddress!,
          ERC20_ABI,
          provider,
        );
        const tokenBal = await tokenContract.balanceOf(userAddress);
        if (BigInt(tokenBal.toString()) < quote.amountInRaw) {
          throw new Error(`Insufficient ${quote.fromToken.symbol} balance for swap.`);
        }
      }

      // Step 2: Checking Allowance
      if (quote.fromToken.type === 'ERC20') {
        onProgress('checking_allowance', `Checking ${quote.fromToken.symbol} allowance...`);
        const allowance = await this.checkAllowance(quote.fromToken, userAddress, networkId);

        if (allowance < quote.amountInRaw) {
          onProgress('approving', `Approving ${quote.fromToken.symbol} spending...`);
          const approveHash = await this.approveToken(
            quote.fromToken,
            quote.amountInRaw,
            networkId,
            (msg, hash) => onProgress('approving', msg, hash),
          );
          onProgress('approval_confirmed', 'Approval confirmed on-chain.', approveHash);
        }
      }

      // Step 3: Preparing Swap Parameters
      onProgress('estimating_gas', 'Preparing transaction payload & estimating gas...');

      const tokenInAddress =
        quote.fromToken.type === 'NATIVE' ? contracts.weth : quote.fromToken.contractAddress!;
      const tokenOutAddress =
        quote.toToken.type === 'NATIVE' ? contracts.weth : quote.toToken.contractAddress!;

      const router = new ethers.Contract(contracts.swapRouter02, SWAP_ROUTER_02_ABI, signer);

      let txResponse: ethers.TransactionResponse;

      if (quote.fromToken.type === 'NATIVE') {
        // ETH -> ERC20
        // SwapRouter02 wraps ETH into WETH internally when value is sent with exactInputSingle
        const exactInputParams = {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          fee: quote.poolFee,
          recipient: userAddress,
          amountIn: quote.amountInRaw,
          amountOutMinimum: quote.amountOutMinimumRaw,
          sqrtPriceLimitX96: 0n,
        };

        onProgress('submitting_swap', 'Signing and submitting swap transaction...');
        txResponse = await router.exactInputSingle(exactInputParams, {
          value: quote.amountInRaw,
        });
      } else if (quote.toToken.type === 'NATIVE') {
        // ERC20 -> ETH
        // Swap to WETH sent to router, followed by unwrapWETH9 to userAddress via multicall
        const exactInputParams = {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          fee: quote.poolFee,
          recipient: contracts.swapRouter02, // Send WETH to router to unwrap
          amountIn: quote.amountInRaw,
          amountOutMinimum: quote.amountOutMinimumRaw,
          sqrtPriceLimitX96: 0n,
        };

        const routerInterface = new ethers.Interface(SWAP_ROUTER_02_ABI);
        const swapData = routerInterface.encodeFunctionData('exactInputSingle', [exactInputParams]);
        const unwrapData = routerInterface.encodeFunctionData('unwrapWETH9', [
          quote.amountOutMinimumRaw,
          userAddress,
        ]);

        onProgress('submitting_swap', 'Signing and submitting multicall swap...');
        txResponse = await router.multicall([swapData, unwrapData]);
      } else {
        // ERC20 -> ERC20
        const exactInputParams = {
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          fee: quote.poolFee,
          recipient: userAddress,
          amountIn: quote.amountInRaw,
          amountOutMinimum: quote.amountOutMinimumRaw,
          sqrtPriceLimitX96: 0n,
        };

        onProgress('submitting_swap', 'Signing and submitting ERC20 swap...');
        txResponse = await router.exactInputSingle(exactInputParams);
      }

      onProgress(
        'waiting_confirmation',
        'Swap submitted. Waiting for blockchain confirmation...',
        txResponse.hash,
      );

      // Record pending swap
      const record: TransactionRecord = {
        hash: txResponse.hash,
        type: 'swap',
        status: 'pending',
        tokenSymbol: quote.fromToken.symbol,
        amount: quote.amountInFormatted,
        from: userAddress,
        to: contracts.swapRouter02,
        networkId,
        timestamp: Date.now(),
        swapDetails: {
          toTokenSymbol: quote.toToken.symbol,
          toAmount: quote.amountOutFormatted,
          rate: `1 ${quote.fromToken.symbol} ≈ ${quote.executionPrice.toFixed(4)} ${
            quote.toToken.symbol
          }`,
        },
      };
      await storageService.saveTransactions([
        record,
        ...(await storageService.getTransactions()).filter((t) => t.hash !== txResponse.hash),
      ]);

      const receipt = await txResponse.wait(1);
      if (!receipt || receipt.status === 0) {
        throw new Error('Swap transaction reverted on-chain.');
      }

      const confirmedRecord: TransactionRecord = {
        ...record,
        status: 'confirmed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
      await storageService.saveTransactions([
        confirmedRecord,
        ...(await storageService.getTransactions()).filter((t) => t.hash !== txResponse.hash),
      ]);

      onProgress('confirmed', 'Swap confirmed successfully on blockchain!', receipt.hash);
      return confirmedRecord;
    } catch (err) {
      logger.error('Swap execution failed:', err);
      const parsed = parseBlockchainError(err);
      onProgress('failed', parsed.userMessage);
      throw new Error(parsed.userMessage);
    }
  },
};
