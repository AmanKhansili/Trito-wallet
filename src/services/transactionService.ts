import { ethers } from 'ethers';
import { NetworkId, TokenConfig, GasEstimate, TransactionRecord } from '../types';
import { getProvider } from './cryptoService';
import { walletService } from './walletService';
import { storageService } from './storageService';
import { priceService } from './priceService';
import { ERC20_ABI } from '../config/uniswap';
import { parseBlockchainError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface SendResult {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
}

export const transactionService = {
  /**
   * Estimates network gas dynamically from blockchain RPC for native or ERC20 transfers.
   */
  async estimateGas(
    fromAddress: string,
    toAddress: string,
    token: TokenConfig,
    amountRaw: bigint,
    networkId: NetworkId,
  ): Promise<GasEstimate> {
    const provider = getProvider(networkId);

    try {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? ethers.parseUnits('20', 'gwei');

      let gasLimit = 21000n;

      if (token.type === 'NATIVE') {
        try {
          const estimated = await provider.estimateGas({
            from: fromAddress,
            to: toAddress,
            value: amountRaw > 0n ? amountRaw : ethers.parseEther('0.001'),
          });
          // Add 10% safety buffer to estimated gas limit
          gasLimit = (estimated * 110n) / 100n;
        } catch {
          gasLimit = 21000n;
        }
      } else if (token.contractAddress) {
        try {
          const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, provider);
          const safeAmount = amountRaw > 0n ? amountRaw : 1n;
          const estimated = await contract.transfer.estimateGas(toAddress, safeAmount, {
            from: fromAddress,
          });
          gasLimit = (estimated * 120n) / 100n;
        } catch {
          gasLimit = 65000n; // Standard ERC20 transfer fallback
        }
      }

      const totalCostWei = gasLimit * gasPrice;
      const totalCostEth = ethers.formatEther(totalCostWei);

      // Convert to USD via priceService
      const ethPrice = priceService.getPriceForToken('ethereum')?.usd ?? 3000;
      const totalCostUsd = Number(totalCostEth) * ethPrice;

      return {
        gasLimit,
        gasPrice,
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
        totalCostWei,
        totalCostEth,
        totalCostUsd,
      };
    } catch (err) {
      logger.error('Gas estimation failed:', err);
      // Fallback safe estimate
      const fallbackGasPrice = ethers.parseUnits('25', 'gwei');
      const fallbackLimit = token.type === 'NATIVE' ? 21000n : 65000n;
      const totalCostWei = fallbackLimit * fallbackGasPrice;
      const totalCostEth = ethers.formatEther(totalCostWei);
      const totalCostUsd = Number(totalCostEth) * 3000;

      return {
        gasLimit: fallbackLimit,
        gasPrice: fallbackGasPrice,
        totalCostWei,
        totalCostEth,
        totalCostUsd,
      };
    }
  },

  /**
   * Broadcasts and monitors native ETH transaction until 1 block confirmation.
   * Signs strictly locally using the user's private key via walletService.
   */
  async sendNativeETH(
    toAddress: string,
    amountRaw: bigint,
    networkId: NetworkId,
    gasEstimate?: GasEstimate,
  ): Promise<SendResult> {
    const provider = getProvider(networkId);
    const signer = walletService.getSigner(provider);

    logger.info(`Sending ${ethers.formatEther(amountRaw)} ETH on ${networkId} to ${toAddress}`);

    try {
      const txParams: ethers.TransactionRequest = {
        to: toAddress,
        value: amountRaw,
      };

      if (gasEstimate) {
        txParams.gasLimit = gasEstimate.gasLimit;
        if (gasEstimate.maxFeePerGas) {
          txParams.maxFeePerGas = gasEstimate.maxFeePerGas;
          txParams.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;
        } else {
          txParams.gasPrice = gasEstimate.gasPrice;
        }
      }

      // Locally sign and broadcast
      const txResponse = await signer.sendTransaction(txParams);
      logger.info('Transaction broadcasted with hash:', txResponse.hash);

      // Record pending transaction
      const senderAddress = await signer.getAddress();
      const record: TransactionRecord = {
        hash: txResponse.hash,
        type: 'send',
        status: 'pending',
        tokenSymbol: 'ETH',
        amount: ethers.formatEther(amountRaw),
        from: senderAddress,
        to: toAddress,
        networkId,
        timestamp: Date.now(),
      };
      await this.saveTransactionRecord(record);

      // Wait for at least 1 confirmation block
      const receipt = await txResponse.wait(1);
      if (!receipt || receipt.status === 0) {
        throw new Error('Transaction reverted on-chain during execution.');
      }

      const confirmedRecord: TransactionRecord = {
        ...record,
        status: 'confirmed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
      await this.updateTransactionRecord(confirmedRecord);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
    } catch (err) {
      logger.error('sendNativeETH failed:', err);
      const parsed = parseBlockchainError(err);
      throw new Error(parsed.userMessage);
    }
  },

  /**
   * Broadcasts and monitors ERC20 transfer transaction.
   * Signs strictly locally.
   */
  async sendERC20(
    toAddress: string,
    token: TokenConfig,
    amountRaw: bigint,
    networkId: NetworkId,
    gasEstimate?: GasEstimate,
  ): Promise<SendResult> {
    if (!token.contractAddress) {
      throw new Error(`Contract address missing for token ${token.symbol}`);
    }

    const provider = getProvider(networkId);
    const signer = walletService.getSigner(provider);

    try {
      const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, signer);

      const overrides: ethers.Overrides = {};
      if (gasEstimate) {
        overrides.gasLimit = gasEstimate.gasLimit;
        if (gasEstimate.maxFeePerGas) {
          overrides.maxFeePerGas = gasEstimate.maxFeePerGas;
          overrides.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;
        } else {
          overrides.gasPrice = gasEstimate.gasPrice;
        }
      }

      logger.info(
        `Sending ${ethers.formatUnits(amountRaw, token.decimals)} ${token.symbol} to ${toAddress}`,
      );

      const txResponse = await contract.transfer(toAddress, amountRaw, overrides);
      logger.info('ERC20 transfer broadcasted with hash:', txResponse.hash);

      const senderAddress = await signer.getAddress();
      const record: TransactionRecord = {
        hash: txResponse.hash,
        type: 'send',
        status: 'pending',
        tokenSymbol: token.symbol,
        amount: ethers.formatUnits(amountRaw, token.decimals),
        from: senderAddress,
        to: toAddress,
        networkId,
        timestamp: Date.now(),
      };
      await this.saveTransactionRecord(record);

      const receipt = await txResponse.wait(1);
      if (!receipt || receipt.status === 0) {
        throw new Error(`ERC20 transfer reverted on-chain for ${token.symbol}.`);
      }

      const confirmedRecord: TransactionRecord = {
        ...record,
        status: 'confirmed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
      await this.updateTransactionRecord(confirmedRecord);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
      };
    } catch (err) {
      logger.error('sendERC20 failed:', err);
      const parsed = parseBlockchainError(err);
      throw new Error(parsed.userMessage);
    }
  },

  async saveTransactionRecord(tx: TransactionRecord): Promise<void> {
    const existing = await storageService.getTransactions();
    // Prepend new tx
    const updated = [tx, ...existing.filter((t) => t.hash !== tx.hash)];
    await storageService.saveTransactions(updated);
  },

  async updateTransactionRecord(tx: TransactionRecord): Promise<void> {
    const existing = await storageService.getTransactions();
    const updated = existing.map((t) => (t.hash === tx.hash ? tx : t));
    await storageService.saveTransactions(updated);
  },
};
