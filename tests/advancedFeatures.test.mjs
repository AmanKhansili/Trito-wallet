import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Fiat Ramp URL Builder Logic
function buildOnrampUrl(walletAddress, crypto, fiat, type, networkId, fiatAmount) {
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
  if (fiatAmount && fiatAmount > 0) {
    query.set('fiatAmount', String(Math.round(fiatAmount)));
  }
  return `${base}?${query.toString()}`;
}

function buildTransakUrl(walletAddress, crypto, fiat, type, networkId, fiatAmount) {
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
  if (fiatAmount && fiatAmount > 0) {
    query.set('defaultFiatAmount', String(Math.round(fiatAmount)));
  }
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

// 3. Price Chart Path Generator Logic
function buildChartPath(data, width = 300, height = 150, paddingX = 8, paddingY = 16) {
  if (!data || data.length < 2) return { min: 0, max: 0, linePath: '', areaPath: '' };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * graphWidth;
    const y = paddingY + graphHeight - ((val - min) / range) * graphHeight;
    return { x, y, value: val };
  });

  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${height} L ${firstPoint.x.toFixed(1)} ${height} Z`;

  return { min, max, linePath, areaPath };
}

test('buildOnrampUrl constructs valid Onramp.money UPI parameters with fiatAmount', () => {
  const url = buildOnrampUrl('0x1234567890123456789012345678901234567890', 'eth', 'INR', 'buy', 'mainnet', 5000);
  assert.ok(url.startsWith('https://onramp.money/main/buy/'));
  assert.ok(url.includes('walletAddress=0x1234567890123456789012345678901234567890'));
  assert.ok(url.includes('network=ethereum'));
  assert.ok(url.includes('coinCode=eth'));
  assert.ok(url.includes('fiatAmount=5000'));
});

test('buildTransakUrl constructs valid Global Transak card parameters with fiatAmount', () => {
  const url = buildTransakUrl('0x1234567890123456789012345678901234567890', 'USDT', 'USD', 'sell', 'mainnet', 250);
  assert.ok(url.startsWith('https://global.transak.com/'));
  assert.ok(url.includes('productsAvailed=SELL'));
  assert.ok(url.includes('fiatCurrency=USD'));
  assert.ok(url.includes('defaultCryptoCurrency=USDT'));
  assert.ok(url.includes('defaultFiatAmount=250'));
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

test('buildChartPath calculates valid bezier path and closed area', () => {
  const prices = [2500, 2550, 2480, 2620, 2600, 2680];
  const { min, max, linePath, areaPath } = buildChartPath(prices, 320, 160);

  assert.equal(min, 2480);
  assert.equal(max, 2680);
  assert.ok(linePath.startsWith('M '));
  assert.ok(linePath.includes('C '));
  assert.ok(areaPath.endsWith('Z'));
});
