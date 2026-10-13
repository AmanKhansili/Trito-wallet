import { ethers } from 'ethers';
import { NetworkId, TokenConfig, TokenBalance, MarketPricesMap, GasSpeedTier } from '../types';
import { getNetwork } from '../config/networks';
import { getTokensForNetwork } from '../config/tokens';
import { ERC20_ABI } from '../config/uniswap';
import { storageService } from './storageService';
import { formatTokenBalance } from '../utils/formatters';
import { logger } from '../utils/logger';

// Multiple public fallback RPC endpoints taaki agar ek endpoint down ho to dusra automatically handle kar le
const RPC_ENDPOINTS: Record<NetworkId, string[]> = {
  mainnet: [
    'https://ethereum-rpc.publicnode.com',
    'https://cloudflare-eth.com',
    'https://1rpc.io/eth',
    'https://rpc.ankr.com/eth',
  ],
  sepolia: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
    'https://1rpc.io/sepolia',
    'https://rpc2.sepolia.org',
  ],
};

const providerCache: Partial<Record<NetworkId, { url: string; provider: ethers.JsonRpcProvider }>> = {};

export function getProvider(networkId: NetworkId): ethers.JsonRpcProvider {
  const config = getNetwork(networkId);
  const primaryUrl = RPC_ENDPOINTS[networkId]?.[0] || config.rpcUrl;
  const cached = providerCache[networkId];

  if (!cached || cached.url !== primaryUrl) {
    const staticNet = ethers.Network.from({
      chainId: config.chainId,
      name: config.name,
    });

    const newProvider = new ethers.JsonRpcProvider(primaryUrl, staticNet, {
      staticNetwork: staticNet,
      batchMaxCount: 1,
    });

    providerCache[networkId] = {
      url: primaryUrl,
      provider: newProvider,
    };
  }

  return providerCache[networkId]!.provider;
}

export const cryptoService = {
  /**
   * Calculates gas fees with tier multipliers (Standard, Fast, Instant).
   */
  async getTieredGasFees(
    networkId: NetworkId,
    tier: GasSpeedTier = 'standard',
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; gasPrice: bigint }> {
    const provider = getProvider(networkId);

    try {
      const feeData = await provider.getFeeData();

      const multipliers = {
        standard: 100n,
        fast: 125n,
        instant: 150n,
      };
      const mult = multipliers[tier];

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        const priority = (feeData.maxPriorityFeePerGas * mult) / 100n;
        const maxFee = (feeData.maxFeePerGas * mult) / 100n;
        return {
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: priority,
          gasPrice: maxFee,
        };
      }

      const legacyBase = feeData.gasPrice ?? ethers.parseUnits('25', 'gwei');
      const adjusted = (legacyBase * mult) / 100n;
      return {
        maxFeePerGas: adjusted,
        maxPriorityFeePerGas: adjusted,
        gasPrice: adjusted,
      };
    } catch {
      const fallbackPrice = ethers.parseUnits('25', 'gwei');
      return {
        maxFeePerGas: fallbackPrice,
        maxPriorityFeePerGas: fallbackPrice,
        gasPrice: fallbackPrice,
      };
    }
  },

  /**
   * Helper alias for dynamic EIP-1559 fee data expected by transaction and zeroEx services.
   */
  async getDynamicFeeData(
    networkId: NetworkId,
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; gasPrice: bigint }> {
    return this.getTieredGasFees(networkId, 'standard');
  },

  async getNativeBalance(address: string, networkId: NetworkId): Promise<bigint> {
    if (!address || typeof address !== 'string' || !ethers.isAddress(address)) {
      return 0n;
    }

    const safeAddress = ethers.getAddress(address);
    const config = getNetwork(networkId);
    const urls = RPC_ENDPOINTS[networkId] || [config.rpcUrl];

    const staticNet = ethers.Network.from({
      chainId: config.chainId,
      name: config.name,
    });

    for (const url of urls) {
      try {
        const tempProvider = new ethers.JsonRpcProvider(url, staticNet, {
          staticNetwork: staticNet,
          batchMaxCount: 1,
        });

        const balance = await tempProvider.getBalance(safeAddress);
        return balance;
      } catch {
        continue;
      }
    }

    logger.error(`All RPC endpoints failed to fetch native balance on ${networkId}`);
    return 0n;
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

    const provider = getProvider(networkId);
    try {
      const safeContractAddress = ethers.getAddress(token.contractAddress.toLowerCase());
      const safeUserAddress = ethers.getAddress(address.toLowerCase());

      const contract = new ethers.Contract(safeContractAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(safeUserAddress);
      return BigInt(balance.toString());
    } catch {
      return 0n;
    }
  },

  async getAllBalances(
    address: string,
    networkId: NetworkId,
    marketPrices: MarketPricesMap,
  ): Promise<{ ethBalance: TokenBalance | null; tokenBalances: TokenBalance[] }> {
    const defaultTokens = getTokensForNetwork(networkId);
    let customTokens: TokenConfig[] = [];
    try {
      const allCustom = await storageService.getCustomTokens();
      customTokens = allCustom.filter((t) => t.network === networkId);
    } catch {
      // Ignored
    }

    // Merge default and custom tokens, removing duplicates
    const tokenMap = new Map<string, TokenConfig>();
    defaultTokens.forEach((t) => tokenMap.set(t.symbol.toUpperCase(), t));
    customTokens.forEach((t) => tokenMap.set(t.symbol.toUpperCase(), t));
    const tokens = Array.from(tokenMap.values());

    const balancePromises = tokens.map(async (token) => {
      try {
        const rawBalance = await this.getTokenBalance(address, token, networkId);
        const formatted = formatTokenBalance(rawBalance, token.decimals);
        const floatAmount = Number(ethers.formatUnits(rawBalance, token.decimals));

        const price = token.coingeckoId ? marketPrices[token.coingeckoId] : undefined;
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
    const provider = getProvider(networkId);
    return await provider.getBlockNumber();
  },
};