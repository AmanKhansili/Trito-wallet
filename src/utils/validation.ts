import { ethers } from 'ethers';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates an Ethereum address.
 */
export function validateAddress(address: string): ValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Recipient address is required.' };
  }
  if (!ethers.isAddress(trimmed)) {
    return { isValid: false, error: 'Invalid Ethereum address. Must be a 42-character hex address.' };
  }
  return { isValid: true };
}

/**
 * Validates a 12-word mnemonic phrase.
 */
export function validateMnemonic(phrase: string): ValidationResult {
  const trimmed = phrase.trim().toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length !== 12 && words.length !== 24) {
    return {
      isValid: false,
      error: `Recovery phrase must contain exactly 12 (or 24) words. You provided ${words.length}.`,
    };
  }

  const normalized = words.join(' ');
  if (!ethers.Mnemonic.isValidMnemonic(normalized)) {
    return {
      isValid: false,
      error: 'Invalid recovery phrase. Please check the spelling and order of each word.',
    };
  }

  return { isValid: true };
}

/**
 * Validates a private key (hex string 32 bytes).
 */
export function validatePrivateKey(key: string): ValidationResult {
  let cleanKey = key.trim();
  if (!cleanKey) {
    return { isValid: false, error: 'Private key is required.' };
  }

  if (!cleanKey.startsWith('0x')) {
    cleanKey = `0x${cleanKey}`;
  }

  if (cleanKey.length !== 66 || !ethers.isHexString(cleanKey, 32)) {
    return {
      isValid: false,
      error: 'Invalid private key format. Must be a 64-character hexadecimal string.',
    };
  }

  try {
    new ethers.SigningKey(cleanKey);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Malformed or invalid private key.' };
  }
}

/**
 * Validates send amount against balance and gas fees.
 */
export function validateSendAmount(
  amountRaw: bigint,
  tokenBalanceRaw: bigint,
  isNativeEth: boolean,
  estimatedGasWei: bigint,
  ethBalanceRaw: bigint,
): ValidationResult {
  if (amountRaw <= 0n) {
    return { isValid: false, error: 'Enter a valid amount greater than zero.' };
  }

  if (amountRaw > tokenBalanceRaw) {
    return { isValid: false, error: 'Insufficient token balance.' };
  }

  if (isNativeEth) {
    const totalRequired = amountRaw + estimatedGasWei;
    if (totalRequired > ethBalanceRaw) {
      return {
        isValid: false,
        error: 'Insufficient ETH balance to cover both the transfer amount and network gas fees.',
      };
    }
  } else {
    // For ERC20 transfer, token balance is checked above, but user must also have ETH for gas
    if (estimatedGasWei > ethBalanceRaw) {
      return {
        isValid: false,
        error: 'Insufficient ETH to pay for transaction network gas fees.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates slippage tolerance.
 */
export function validateSlippage(slippage: number): ValidationResult {
  if (isNaN(slippage) || slippage <= 0) {
    return { isValid: false, error: 'Slippage tolerance must be greater than 0%.' };
  }
  if (slippage > 50) {
    return { isValid: false, error: 'Slippage tolerance cannot exceed 50%.' };
  }
  if (slippage > 5) {
    return {
      isValid: true,
      warning: 'High slippage tolerance! Your transaction may be front-run or result in poor execution.',
    };
  }
  return { isValid: true };
}
