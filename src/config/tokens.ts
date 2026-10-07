import { NetworkId, TokenConfig } from '../types';

export const TOKENS: TokenConfig[] = [
  // ==================== SEPOLIA ====================
  {
    symbol: 'ETH',
    name: 'Sepolia Ether',
    decimals: 18,
    network: 'sepolia',
    type: 'NATIVE',
    icon: 'ethereum',
    coingeckoId: 'ethereum',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    network: 'sepolia',
    type: 'ERC20',
    icon: 'circle-dollar',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xAA8E23FB1079eA71E0A56F48a2Aa51851D8433d0',
    network: 'sepolia',
    type: 'ERC20',
    icon: 'tether',
    coingeckoId: 'tether',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
    network: 'sepolia',
    type: 'ERC20',
    icon: 'alpha-d-box',
    coingeckoId: 'dai',
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    network: 'sepolia',
    type: 'ERC20',
    icon: 'link-variant',
    coingeckoId: 'chainlink',
  },

  // ==================== MAINNET ====================
  {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    network: 'mainnet',
    type: 'NATIVE',
    icon: 'ethereum',
    coingeckoId: 'ethereum',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    network: 'mainnet',
    type: 'ERC20',
    icon: 'circle-dollar',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    network: 'mainnet',
    type: 'ERC20',
    icon: 'tether',
    coingeckoId: 'tether',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    network: 'mainnet',
    type: 'ERC20',
    icon: 'alpha-d-box',
    coingeckoId: 'dai',
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    network: 'mainnet',
    type: 'ERC20',
    icon: 'link-variant',
    coingeckoId: 'chainlink',
  },
];

export function getTokensForNetwork(network: NetworkId): TokenConfig[] {
  return TOKENS.filter((t) => t.network === network);
}

export function getNativeToken(network: NetworkId): TokenConfig {
  const token = TOKENS.find((t) => t.network === network && t.type === 'NATIVE');
  if (!token) {
    throw new Error(`Native token not found for network: ${network}`);
  }
  return token;
}

export function findToken(network: NetworkId, symbol: string): TokenConfig | undefined {
  return TOKENS.find(
    (t) => t.network === network && t.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}
