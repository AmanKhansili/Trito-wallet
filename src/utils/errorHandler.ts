export interface ParsedError {
  userMessage: string;
  technicalCode?: string;
  isFatal: boolean;
}

/**
 * Translates low-level blockchain and ethers.js errors into human-friendly messages.
 */
export function parseBlockchainError(error: unknown): ParsedError {
  if (!error) {
    return { userMessage: 'An unknown error occurred.', isFatal: false };
  }

  const errStr = typeof error === 'string' ? error : (error as Error).message || '';
  const errCode = (error as { code?: string }).code;

  // 1. User rejection
  if (
    errStr.includes('user rejected') ||
    errStr.includes('ACTION_REJECTED') ||
    errCode === 'ACTION_REJECTED'
  ) {
    return {
      userMessage: 'Transaction signature was cancelled by user.',
      technicalCode: 'USER_REJECTED',
      isFatal: false,
    };
  }

  // 2. Insufficient funds for gas or transfer
  if (
    errStr.includes('insufficient funds') ||
    errStr.includes('INSUFFICIENT_FUNDS') ||
    errCode === 'INSUFFICIENT_FUNDS'
  ) {
    return {
      userMessage:
        'Insufficient ETH balance to cover the transaction value and network gas fee.',
      technicalCode: 'INSUFFICIENT_FUNDS',
      isFatal: false,
    };
  }

  // 3. SafeTransferFrom failure (STF in Uniswap)
  if (errStr.includes('STF') || errStr.includes('TRANSFER_FROM_FAILED')) {
    return {
      userMessage:
        'Token approval is required before this swap. Please authorize the token spending and try again.',
      technicalCode: 'UNISWAP_STF',
      isFatal: false,
    };
  }

  // 4. Slippage / Too little received
  if (
    errStr.includes('Too little received') ||
    errStr.includes('PRICE_SLIPPAGE') ||
    errStr.includes('SPL') ||
    errStr.includes('TF')
  ) {
    return {
      userMessage:
        'Slippage tolerance exceeded. Market prices fluctuated before transaction mined. Try increasing your slippage tolerance slightly.',
      technicalCode: 'SLIPPAGE_EXCEEDED',
      isFatal: false,
    };
  }

  // 5. No liquidity / pool does not exist
  if (
    errStr.includes('execution reverted') &&
    (errStr.includes('NP') || errStr.includes('POOL') || errStr.includes('LOK'))
  ) {
    return {
      userMessage:
        'No liquidity pool found for this token pair on the selected fee tier. Swap cannot proceed.',
      technicalCode: 'NO_LIQUIDITY',
      isFatal: false,
    };
  }

  // 6. Nonce expired / Replacement underpriced
  if (errStr.includes('NONCE_EXPIRED') || errStr.includes('replacement underpriced')) {
    return {
      userMessage:
        'A transaction with this nonce is already pending or has been replaced. Please wait a moment and refresh.',
      technicalCode: 'NONCE_ISSUE',
      isFatal: false,
    };
  }

  // 7. Network / RPC connection failures
  if (
    errStr.includes('network') ||
    errStr.includes('NETWORK_ERROR') ||
    errStr.includes('connection refused') ||
    errStr.includes('fetch failed') ||
    errStr.includes('timeout') ||
    errStr.includes('SERVER_ERROR')
  ) {
    return {
      userMessage:
        'Network temporarily unavailable. Unable to communicate with the Ethereum RPC node. Please verify your connection.',
      technicalCode: 'RPC_UNAVAILABLE',
      isFatal: true,
    };
  }

  // 8. Wallet Locked
  if (errStr.includes('Wallet is locked') || errStr.includes('WALLET_LOCKED')) {
    return {
      userMessage: 'Wallet is locked. Please enter your PIN or authenticate with biometrics.',
      technicalCode: 'WALLET_LOCKED',
      isFatal: false,
    };
  }

  // Generic fallback with clean message
  return {
    userMessage: errStr.length > 140 ? `${errStr.slice(0, 137)}...` : errStr || 'Transaction failed on blockchain.',
    technicalCode: errCode || 'UNKNOWN_ERROR',
    isFatal: false,
  };
}
