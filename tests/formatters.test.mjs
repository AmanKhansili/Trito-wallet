import test from 'node:test';
import assert from 'node:assert/strict';

// Logic mirror of formatTokenBalance for unit testing BigInt safety
function formatTokenBalance(rawBalance, decimals, maxDecimals = 6) {
  if (rawBalance === 0n) return '0';
  const factor = 10n ** BigInt(decimals);
  const integerPart = (rawBalance / factor).toString();
  const remainder = rawBalance % factor;

  if (remainder === 0n) return integerPart;

  let remainderStr = remainder.toString().padStart(decimals, '0');
  if (remainderStr.length > maxDecimals) {
    remainderStr = remainderStr.slice(0, maxDecimals);
  }
  remainderStr = remainderStr.replace(/0+$/, '');
  return remainderStr.length > 0 ? `${integerPart}.${remainderStr}` : integerPart;
}

function parseTokenAmount(amountStr, decimals) {
  const clean = amountStr.trim().replace(/,/g, '');
  if (!clean || isNaN(Number(clean))) return 0n;
  const parts = clean.split('.');
  const intPart = BigInt(parts[0] || '0') * (10n ** BigInt(decimals));
  let decPart = 0n;
  if (parts[1]) {
    const fraction = parts[1].slice(0, decimals).padEnd(decimals, '0');
    decPart = BigInt(fraction);
  }
  return intPart + decPart;
}

function shortenAddress(addr, start = 6, end = 4) {
  if (!addr || addr.length < start + end + 2) return addr || '';
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

function formatFiat(amount, currency = 'USD', showSymbol = true) {
  if (isNaN(amount) || !isFinite(amount)) return currency === 'USD' ? '$0.00' : '₹0.00';
  const isNeg = amount < 0;
  const absAmount = Math.abs(amount);
  const symbol = showSymbol ? (currency === 'INR' ? '₹' : '$') : '';

  if (currency === 'INR') {
    if (absAmount > 0 && absAmount < 0.01) {
      return `${isNeg ? '-' : ''}${symbol}${absAmount.toFixed(4)}`;
    }
    const parts = absAmount.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];
    let lastThree = intPart.slice(-3);
    const otherNumbers = intPart.slice(0, -3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return `${isNeg ? '-' : ''}${symbol}${formattedInt}.${decPart}`;
  }

  if (absAmount > 0 && absAmount < 0.01) {
    return `${isNeg ? '-' : ''}${symbol}${absAmount.toFixed(4)}`;
  }
  const parts = absAmount.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}${symbol}${intPart}.${parts[1]}`;
}

test('formatTokenBalance formats 18 decimals native ETH correctly', () => {
  const oneEth = 1000000000000000000n; // 1 ETH
  assert.equal(formatTokenBalance(oneEth, 18), '1');

  const halfEth = 500000000000000000n; // 0.5 ETH
  assert.equal(formatTokenBalance(halfEth, 18), '0.5');

  const tinyEth = 1234560000000000n; // 0.00123456 ETH
  assert.equal(formatTokenBalance(tinyEth, 18), '0.001234');
});

test('formatTokenBalance handles USDC with 6 decimals without precision errors', () => {
  const oneHundredUsdc = 100000000n; // 100 USDC (6 decimals)
  assert.equal(formatTokenBalance(oneHundredUsdc, 6), '100');

  const decimalUsdc = 2715420n; // 2.715420 USDC
  assert.equal(formatTokenBalance(decimalUsdc, 6), '2.71542');
});

test('parseTokenAmount converts human strings to accurate BigInt units', () => {
  assert.equal(parseTokenAmount('1.5', 18), 1500000000000000000n);
  assert.equal(parseTokenAmount('250.75', 6), 250750000n);
  assert.equal(parseTokenAmount('0', 18), 0n);
  assert.equal(parseTokenAmount('', 6), 0n);
});

test('shortenAddress shortens Ethereum addresses correctly', () => {
  const addr = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  assert.equal(shortenAddress(addr), '0x1c7D...7238');
  assert.equal(shortenAddress(''), '');
});

test('formatFiat formats INR in Indian Lakhs/Crores numbering and USD correctly', () => {
  assert.equal(formatFiat(7354540, 'INR'), '₹73,54,540.00');
  assert.equal(formatFiat(239056, 'INR'), '₹2,39,056.00');
  assert.equal(formatFiat(89.2, 'INR'), '₹89.20');
  assert.equal(formatFiat(82450, 'USD'), '$82,450.00');
  assert.equal(formatFiat(2680, 'USD'), '$2,680.00');
});
