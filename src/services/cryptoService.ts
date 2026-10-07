import { ethers } from 'ethers';
import { NetworkId, TokenConfig, TokenBalance, MarketPricesMap } from '../types';
import { getNetwork } from '../config/networks';
import { getTokensForNetwork } from '../config/tokens';
import { ERC20_ABI } from '../config/uniswap';
import { formatTokenBalance } from '../utils/formatters';
import { logger } from '../utils/logger';

// Cached provider instances to avoid unnecessary socket recreations
const providerCache: Partial<Record<NetworkId, ethers.JsonRpcProvider>> = {};

export function getProvider(networkId: NetworkId): ethers.JsonRpcProvider {
  if (!providerCache[networkId]) {
    const config = getNetwork(networkId);
    providerCache[networkId] = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.name,
    });
  }
  return providerCache[networkId]!;
}

export const cryptoService = {
  /**
   * Fetches native ETH balance directly from blockchain RPC.
   */
  async getNativeBalance(address: string, networkId: NetworkId): Promise<bigint> {
    const provider = getProvider(networkId);
    try {
      const balance = await provider.getBalance(address);
      return balance;
    } catch (err) {
      logger.error(`Failed to fetch native ETH balance on ${networkId}:`, err);
      throw err;
    }
  },

  /**
   * Fetches ERC20 balance using contract.balanceOf(address).
   */
  async getTokenBalance(
    address: string,
    token: TokenConfig,
    networkId: NetworkId,
  ): Promise<bigint> {
    if (token.type === 'NATIVE' || !token.contractAddress) {
      return this.getNativeBalance(address, networkId);
    }

    const provider = getProvider(networkId);
    try {
      const contract = new ethers.Contract(token.contractAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      return BigInt(balance.toString());
    } catch (err) {
      logger.error(`Failed to fetch ERC20 balance for ${token.symbol} on ${networkId}:`, err);
      // Return 0n on contract call failure rather than crashing whole balance list, but log error
      return 0n;
    }
  },

  /**
   * Fetches all balances for all configured tokens on the network, calculates USD & INR values.
   */
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

        const balanceUsd = floatAmount * usdRate;
        const balanceInr = floatAmount * inrRate;

        const tokenBalance: TokenBalance = {
          token,
          balanceRaw: rawBalance,
          balanceFormatted: formatted,
          balanceUsd,
          balanceInr,
        };

        return tokenBalance;
      } catch (err) {
        logger.warn(`Could not load balance for ${token.symbol}:`, err);
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
    const tokenBalances = results;

    return { ethBalance, tokenBalances };
  },

  /**
   * Fetches latest block number to verify connectivity.
   */
  async getBlockNumber(networkId: NetworkId): Promise<number> {
    const provider = getProvider(networkId);
    return await provider.getBlockNumber();
  },
};
