import { ethers } from 'ethers';
import { NetworkId, TokenConfig } from '../types';
import { getProvider } from './cryptoService';
import { storageService } from './storageService';
import { validateAddress } from '../utils/validation';
import { ERC20_ABI } from '../config/uniswap';
import { logger } from '../utils/logger';

export const tokenService = {
  /**
   * Introspects an ERC-20 contract directly from the blockchain to retrieve
   * its official name, symbol, and decimals.
   * Completely free, runs directly on RPC without any external subscription.
   */
  async fetchTokenMetadata(
    contractAddress: string,
    networkId: NetworkId,
  ): Promise<TokenConfig> {
    const val = validateAddress(contractAddress);
    if (!val.isValid) {
      throw new Error(val.error || 'Invalid contract address.');
    }

    const provider = getProvider(networkId);
    const safeAddress = ethers.getAddress(contractAddress.toLowerCase());

    // Verify that code is actually deployed at this address
    const code = await provider.getCode(safeAddress);
    if (!code || code === '0x') {
      throw new Error('No smart contract deployed at this address on this network.');
    }

    const contract = new ethers.Contract(safeAddress, ERC20_ABI, provider);

    try {
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown Token'),
        contract.symbol().catch(() => 'CUSTOM'),
        contract.decimals().catch(() => 18),
      ]);

      const tokenConfig: TokenConfig = {
        symbol: String(symbol).trim().toUpperCase(),
        name: String(name).trim(),
        decimals: Number(decimals),
        contractAddress: safeAddress,
        network: networkId,
        type: 'ERC20',
        icon: 'circle-slice-8',
        coingeckoId: '',
        isCustom: true,
      };

      logger.info(`Detected token: ${tokenConfig.symbol} (${tokenConfig.name}) with ${tokenConfig.decimals} decimals`);
      return tokenConfig;
    } catch (err: unknown) {
      logger.error('Failed to read ERC20 metadata:', err);
      throw new Error(
        'Could not detect standard ERC-20 interface (name, symbol, decimals). Please verify the contract address.',
      );
    }
  },

  /**
   * Saves a custom token to user storage.
   */
  async importToken(token: TokenConfig): Promise<void> {
    await storageService.addCustomToken(token);
    logger.info(`Custom token ${token.symbol} imported successfully.`);
  },

  /**
   * Retrieves all imported custom tokens for the current network.
   */
  async getCustomTokensForNetwork(networkId: NetworkId): Promise<TokenConfig[]> {
    const all = await storageService.getCustomTokens();
    return all.filter((t) => t.network === networkId);
  },

  /**
   * Deletes a custom token from storage.
   */
  async removeCustomToken(contractAddress: string, networkId: NetworkId): Promise<void> {
    await storageService.removeCustomToken(contractAddress, networkId);
  },
};
