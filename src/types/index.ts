import { BigNumberish } from 'ethers';

export type NetworkId = 'mainnet' | 'sepolia';

export type CurrencyPreference = 'USD' | 'INR';

export type Timeframe = '1D' | '1W' | '1M' | '1Y';

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  fallbackRpcUrls: string[];
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export interface Token {
  address?: string; // Contract address (undefined for native ETH)
  contractAddress?: string; // Alias for consistency across codebase
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  isCustom?: boolean;
}

export interface TokenBalance {
  token: Token;
  balanceRaw: BigNumberish;
  balanceFormatted: string;
  balanceUsd?: number;
  balanceInr?: number;
}

export interface MarketPrice {
  usd: number;
  inr: number;
  usd24hChange: number;
}

export type MarketPricesMap = Record<string, MarketPrice>;

export interface MarketItem {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  currentPriceUsd: number;
  currentPriceInr: number;
  priceChangePercentage24h: number;
  marketCapUsd: number;
  totalVolumeUsd: number;
  high24hUsd: number;
  low24hUsd: number;
  marketCapRank: number;
}

export type TransactionType = 'send' | 'receive' | 'swap' | 'approve';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface TransactionRecord {
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  symbol: string;
  networkId: NetworkId;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
}

export interface StoredWalletMetadata {
  address: string;
  accountsCount: number;
  activeAccountIndex: number;
  createdAt: number;
  isBackedUp: boolean;
}

export interface DerivedAccount {
  index: number;
  address: string;
  name: string;
}

export interface GasOption {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
}

export type GasSpeedTier = 'standard' | 'fast' | 'instant';

export interface GasTierEstimate {
  tier: GasSpeedTier;
  label: string;
  estimatedTime: string;
  maxFeeGwei: string;
  priorityFeeGwei: string;
  estimatedFeeUsd: number;
}

export interface FeeDataResult {
  gasPrice: bigint | null;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
}

export interface SwapRoute {
  routerAddress: string;
  path: string[];
  fees: number[];
  version: 'v3';
}

export interface SwapQuote {
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  expectedOutputAmount: string;
  minimumOutputAmount: string;
  priceImpact: number;
  executionPrice: string;
  gasEstimate: bigint;
  route: SwapRoute;
  needsApproval: boolean;
}

export interface Contact {
  id: string;
  name: string;
  address: string;
  note?: string;
  createdAt: number;
}

export type FiatRampProvider = 'onramp.money' | 'transak';
export type FiatRampType = 'buy' | 'sell';

export interface FiatRampParams {
  provider: FiatRampProvider;
  type: FiatRampType;
  cryptoCurrency: string;
  fiatCurrency: 'INR' | 'USD';
  walletAddress: string;
  networkId: NetworkId;
  fiatAmount?: number;
}
