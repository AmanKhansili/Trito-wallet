import { NetworkId } from '../types';

export interface UniswapContracts {
  weth: string;
  factory: string;
  quoterV2: string;
  swapRouter02: string;
}

export const UNISWAP_CONTRACTS: Record<NetworkId, UniswapContracts> = {
  sepolia: {
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    quoterV2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
    swapRouter02: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  },
  mainnet: {
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    quoterV2: '0x61fFE014bA17989E743c5F6cB21bF96975404335',
    swapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  },
};

export const UNISWAP_POOL_FEES = [3000, 500, 10000]; // 0.3%, 0.05%, 1%

// Minimal ERC20 ABI
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// WETH9 ABI
export const WETH9_ABI = [
  ...ERC20_ABI,
  'function deposit() public payable',
  'function withdraw(uint256 wad) public',
];

// Uniswap V3 QuoterV2 ABI
export const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

// Uniswap V3 SwapRouter02 ABI
export const SWAP_ROUTER_02_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
  'function multicall(bytes[] data) external payable returns (bytes[] results)',
  'function refundETH() external payable',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
];
