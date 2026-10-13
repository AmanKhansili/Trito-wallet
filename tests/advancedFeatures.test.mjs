import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Fiat Ramp URL Builder Logic
function buildOnrampUrl(walletAddress, crypto, fiat, type, networkId) {
  const networkParam = networkId === 'sepolia' ? 'sepolia' : 'ethereum';
  const action = type === 'sell' ? 'sell' : 'buy';
  const base = `https://onramp.money/main/${action}/`;
  const query = new URLSearchParams({
    appId: '1',
    walletAddress,
    fiatType: fiat === 'INR' ? '1' : '1',
    coinCode: crypto.toLowerCase(),
    network: networkParam,
  });
  return `${base}?${query.toString()}`;
}

function buildTransakUrl(walletAddress, crypto, fiat, type, networkId) {
  const networkParam = networkId === 'sepolia' ? 'sepolia' : 'ethereum';
  const base = 'https://global.transak.com/';
  const query = new URLSearchParams({
    apiKey: '4b8c9d2f-1a3e-4f7b-9c2d-8e4a1b3c5d7e',
    walletAddress,
    fiatCurrency: fiat,
    defaultCryptoCurrency: crypto.toUpperCase(),
    network: networkParam,
    productsAvailed: type === 'sell' ? 'SELL' : 'BUY',
  });
  return `${base}?${query.toString()}`;
}

// 2. Gas Tier Multiplier Logic
function calculateTieredGasPrice(basePriceWei, tier) {
  const multipliers = {
    standard: 100n,
    fast: 125n,
    instant: 150n,
  };
  return (basePriceWei * multipliers[tier]) / 100n;
}

test('buildOnrampUrl constructs valid Onramp.money UPI parameters', () => {
  const url = buildOnrampUrl('0x1234567890123456789012345678901234567890', 'eth', 'INR', 'buy', 'mainnet');
  assert.ok(url.startsWith('https://onramp.money/main/buy/'));
  assert.ok(url.includes('walletAddress=0x1234567890123456789012345678901234567890'));
  assert.ok(url.includes('network=ethereum'));
  assert.ok(url.includes('coinCode=eth'));
});

test('buildTransakUrl constructs valid Global Transak card parameters', () => {
  const url = buildTransakUrl('0x1234567890123456789012345678901234567890', 'USDT', 'USD', 'sell', 'mainnet');
  assert.ok(url.startsWith('https://global.transak.com/'));
  assert.ok(url.includes('productsAvailed=SELL'));
  assert.ok(url.includes('fiatCurrency=USD'));
  assert.ok(url.includes('defaultCryptoCurrency=USDT'));
});

test('calculateTieredGasPrice scales base fee accurately per tier', () => {
  const baseGwei = 20000000000n; // 20 Gwei
  const standard = calculateTieredGasPrice(baseGwei, 'standard');
  const fast = calculateTieredGasPrice(baseGwei, 'fast');
  const instant = calculateTieredGasPrice(baseGwei, 'instant');

  assert.equal(standard, 20000000000n); // 1.0x
  assert.equal(fast, 25000000000n);     // 1.25x
  assert.equal(instant, 30000000000n);  // 1.5x
});
