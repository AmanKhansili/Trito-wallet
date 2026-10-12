import { ethers } from 'ethers';
import { NetworkId, TokenConfig, TokenBalance, MarketPricesMap } from '../types';
import { getNetwork } from '../config/networks';
import { getTokensForNetwork } from '../config/tokens';
import { ERC20_ABI } from '../config/uniswap';
import { formatTokenBalance } from '../utils/formatters';
import { logger } from '../utils/logger';

const RPC_ENDPOINTS: Record<NetworkId, string[]> = {
  mainnet: [
    process.env.EXPO_PUBLIC_MAINNET_RPC_URL || 'https://cloudflare-eth.com',
    'https://1rpc.io/eth',
    'https://ethereum-rpc.publicnode.com',
    'https://eth.merkle.io',
    'https://rpc.ankr.com/eth',
  ],
  sepolia: [
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    'https://1rpc.io/sepolia',
    'https://sepolia.gateway.tenderly.co',
    'https://sepolia.drpc.org',
    'https://endpoints.omniatech.io/v1/eth/sepolia/public',
    'https://rpc.ankr.com/eth_sepolia',
  ],
};

const activeProviderCache: Partial<Record<NetworkId, ethers.JsonRpcProvider>> = {};

export function getProvider(networkId: NetworkId): ethers.JsonRpcProvider {
  if (activeProviderCache[networkId]) {
    return activeProviderCache[networkId]!;
  }
  const config = getNetwork(networkId);
  const urls = RPC_ENDPOINTS[networkId] || [config.rpcUrl];
  const url = urls[0];
  const staticNet = ethers.Network.from({
    chainId: config.chainId,
    name: config.name,
  });
  const provider = new ethers.JsonRpcProvider(url, staticNet, {
    staticNetwork: staticNet,
    batchMaxCount: 1,
  });
  activeProviderCache[networkId] = provider;
  return provider;
}

export async function executeWithRpcFailover<T>(
  networkId: NetworkId,
  operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
): Promise<T> {
  const config = getNetwork(networkId);
  const urls = [...(RPC_ENDPOINTS[networkId] || [config.rpcUrl])];
  let lastError: unknown = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const staticNet = ethers.Network.from({
        chainId: config.chainId,
        name: config.name,
      });
      const provider = new ethers.JsonRpcProvider(url, staticNet, {
        staticNetwork: staticNet,
        batchMaxCount: 1,
      });
      const result = await operation(provider);
      activeProviderCache[networkId] = provider;
      return result;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`RPC endpoint ${url} failed for ${networkId}: ${msg}`);
      delete activeProviderCache[networkId];
    }
  }

  logger.error(`All RPC endpoints failed for ${networkId}:`, lastError);
  throw lastError || new Error(`All RPC endpoints failed for ${networkId}`);
}

export const cryptoService = {
  async getDynamicFeeData(networkId: NetworkId) {
    try {
      return await executeWithRpcFailover(networkId, async (provider) => {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          const priorityFee = (feeData.maxPriorityFeePerGas * 115n) / 100n;
          const maxFee = (feeData.maxFeePerGas * 125n) / 100n + priorityFee;
          return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priorityFee };
        }
        const legacyPrice = ((feeData.gasPrice ?? ethers.parseUnits('25', 'gwei')) * 115n) / 100n;
        return {
          maxFeePerGas: legacyPrice,
          maxPriorityFeePerGas: legacyPrice,
          gasPrice: legacyPrice,
        };
      });
    } catch {
      const fallbackPrice = ethers.parseUnits('25', 'gwei');
      return {
        maxFeePerGas: fallbackPrice,
        maxPriorityFeePerGas: fallbackPrice,
        gasPrice: fallbackPrice,
      };
    }
  },

  async getNativeBalance(address: string, networkId: NetworkId): Promise<bigint> {
    if (!address || typeof address !== 'string' || !ethers.isAddress(address)) {
      return 0n;
    }
    const safeAddress = ethers.getAddress(address);
    try {
      return await executeWithRpcFailover(networkId, async (provider) => {
        return await provider.getBalance(safeAddress);
      });
    } catch (err) {
      logger.error(`Failed to fetch native balance on ${networkId}:`, err);
      return 0n;
    }
  },

  async getTokenBalance(
    address: string,
    token: TokenConfig,
    networkId: NetworkId,
  ): Promise<bigint> {
    if (token.type === 'NATIVE' || !token.contractAddress) {
      return this.getNativeBalance(address, networkId);
    }
    if (!address || !ethers.isAddress(address)) return 0n;

    try {
      const safeContractAddress = ethers.getAddress(token.contractAddress.toLowerCase());
      const safeUserAddress = ethers.getAddress(address.toLowerCase());
      return await executeWithRpcFailover(networkId, async (provider) => {
        const contract = new ethers.Contract(safeContractAddress, ERC20_ABI, provider);
        const balance = await contract.balanceOf(safeUserAddress);
        return BigInt(balance.toString());
      });
    } catch {
      return 0n;
    }
  },

  async getAllBalances(
    address: string,
    networkId: NetworkId,
    marketPrices: MarketPricesMap,
  ): Promise<{ ethBalance: TokenBalance | null; tokenBalances: TokenBalance[] }> {
    const tokens = getTokensForNetwork(networkId);
    const balancePromises = tokens.map(async (token) => {
      try {
        const rawBalance = await this.getTokenBalance(address, token, networkId);
        const formatted = formatTokenBalance(rawBalance, token.decimals);
        const floatAmount = Number(ethers.formatUnits(rawBalance, token.decimals));
        const price = marketPrices[token.coingeckoId];
        const usdRate = price ? price.usd : 0;
        const inrRate = price ? price.inr : 0;
        return {
          token,
          balanceRaw: rawBalance,
          balanceFormatted: formatted,
          balanceUsd: floatAmount * usdRate,
          balanceInr: floatAmount * inrRate,
        };
      } catch {
        return {
          token,
          balanceRaw: 0n,
          balanceFormatted: '0',
          balanceUsd: 0,
          balanceInr: 0,
        };
      }
    });

    const results = await Promise.all(balancePromises);
    const ethBalance = results.find((b) => b.token.type === 'NATIVE') || null;
    return { ethBalance, tokenBalances: results };
  },

  async getBlockNumber(networkId: NetworkId): Promise<number> {
    return await executeWithRpcFailover(networkId, async (provider) => {
      return await provider.getBlockNumber();
    });
  },
};
