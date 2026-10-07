export type NetworkId = 'sepolia' | 'mainnet';
export type SwapProviderId = 'uniswap' | '0x';

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export type TokenType = 'NATIVE' | 'ERC20';

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  contractAddress?: string;
  network: NetworkId;
  type: TokenType;
  icon: string;
  coingeckoId: string;
}

export interface TokenBalance {
  token: TokenConfig;
  balanceRaw: bigint;
  balanceFormatted: string;
  balanceUsd: number;
  balanceInr: number;
}

export interface MarketPrice {
  usd: number;
  inr: number;
  usd24hChange?: number;
}

export type MarketPricesMap = Record<string, MarketPrice>;

export type CurrencyPreference = 'USD' | 'INR';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export type TransactionType = 'send' | 'receive' | 'swap';

export interface TransactionRecord {
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  tokenSymbol: string;
  amount: string;
  from: string;
  to: string;
  networkId: NetworkId;
  timestamp: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  swapDetails?: {
    toTokenSymbol: string;
    toAmount: string;
    rate: string;
  };
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  totalCostWei: bigint;
  totalCostEth: string;
  totalCostUsd: number;
}

export interface SwapQuote {
  fromToken: TokenConfig;
  toToken: TokenConfig;
  amountInRaw: bigint;
  amountInFormatted: string;
  amountOutRaw: bigint;
  amountOutFormatted: string;
  amountOutMinimumRaw: bigint;
  amountOutMinimumFormatted: string;
  executionPrice: number;
  priceImpactPercent: number;
  slippageTolerance: number;
  poolFee: number;
  estimatedGasUnits: bigint;
  estimatedGasCostEth: string;
  estimatedGasCostUsd: number;
  route: string[];
  liquiditySource: string;
   provider: SwapProviderId;
  quotedAt: number;                  // Date.now() jab quote bana
  marketDeviationPercent?: number;   // market se farak (+ better, − worse)
  warnings?: string[];
  // sirf 0x: ready-made transaction
  zeroEx?: {
    to: string;
    data: string;
    value: string;
    gas?: string;
    allowanceTarget?: string;
  };
}

export type SwapStepId =
  | 'idle'
  | 'quoting'
  | 'checking_balance'
  | 'checking_allowance'
  | 'approving'
  | 'approval_confirmed'
  | 'estimating_gas'
  | 'submitting_swap'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'failed';

export interface SwapStepState {
  step: SwapStepId;
  title: string;
  description: string;
  txHash?: string;
  error?: string;
}

export interface AuthState {
  isReady: boolean;
  hasWallet: boolean;
  unlocked: boolean;
  isBiometricsSupported: boolean;
  isBiometricsEnabled: boolean;
  autoLockMinutes: number;
}

export interface WalletState {
  address: string | null;
  network: NetworkConfig;
  ethBalance: TokenBalance | null;
  tokenBalances: TokenBalance[];
  totalPortfolioValueUsd: number;
  totalPortfolioValueInr: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
}
