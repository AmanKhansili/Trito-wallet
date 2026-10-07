import { ethers } from 'ethers';
import { CurrencyPreference } from '../types';

/**
 * Format raw blockchain balance (bigint) into human-readable string with proper decimals.
 * Never uses floating point division for raw token units.
 */
export function formatTokenBalance(
  rawBalance: bigint,
  decimals: number,
  maxDecimalsToDisplay: number = 6,
): string {
  if (rawBalance === 0n) return '0';

  const fullStr = ethers.formatUnits(rawBalance, decimals);
  const parts = fullStr.split('.');

  if (parts.length === 1) {
    return parts[0];
  }

  const integerPart = parts[0];
  let decimalPart = parts[1];

  if (decimalPart.length > maxDecimalsToDisplay) {
    decimalPart = decimalPart.slice(0, maxDecimalsToDisplay);
  }

  // Remove trailing zeros
  decimalPart = decimalPart.replace(/0+$/, '');

  if (decimalPart.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalPart}`;
}

/**
 * Parse human input string into raw blockchain units (bigint) with token decimals.
 */
export function parseTokenAmount(amountStr: string, decimals: number): bigint {
  const clean = amountStr.trim().replace(/,/g, '');
  if (!clean || isNaN(Number(clean))) {
    return 0n;
  }
  try {
    return ethers.parseUnits(clean, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Format fiat currency (USD or INR).
 */
export function formatFiat(
  amount: number,
  currency: CurrencyPreference = 'USD',
  showSymbol: boolean = true,
): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return currency === 'USD' ? '$0.00' : '₹0.00';
  }

  if (currency === 'INR') {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return formatted;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}

/**
 * Shorten Ethereum address (e.g. 0x1234...5678)
 */
export function shortenAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address || address.length < startChars + endChars + 2) {
    return address || '';
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Shorten transaction hash
 */
export function shortenHash(hash: string, chars: number = 8): string {
  if (!hash || hash.length < chars * 2 + 2) {
    return hash || '';
  }
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

/**
 * Format 24h percentage change (e.g. +2.45%)
 */
export function formatPercentage(change: number | undefined): string {
  if (change === undefined || isNaN(change)) {
    return '0.00%';
  }
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
}

/**
 * Format timestamp to localized readable time
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
