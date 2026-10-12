import test from 'node:test';
import assert from 'node:assert/strict';

function calculateAmountOutMinimum(amountOutRaw, slippagePercent) {
  const slippageBps = BigInt(Math.floor((100 - slippagePercent) * 100));
  return (amountOutRaw * slippageBps) / 10000n;
}

function evaluateQuoteSafety(executionRate, fairMarketRate) {
  const priceImpactPercent = ((fairMarketRate - executionRate) / fairMarketRate) * 100;
  if (priceImpactPercent > 30) {
    return {
      safe: false,
      priceImpactPercent,
      error: `Abnormal quote detected: On-chain price impact is ${priceImpactPercent.toFixed(1)}%. Swap blocked for your security.`,
    };
  }
  return {
    safe: true,
    priceImpactPercent: Math.max(0, priceImpactPercent),
  };
}

test('calculateAmountOutMinimum computes correct BigInt thresholds', () => {
  const amountOut = 1000000000n; // 1,000 USDC (6 decimals)
  
  // 0.5% slippage -> minimum 99.5% = 995,000,000
  const min05 = calculateAmountOutMinimum(amountOut, 0.5);
  assert.equal(min05, 995000000n);

  // 1.0% slippage -> minimum 99.0% = 990,000,000
  const min10 = calculateAmountOutMinimum(amountOut, 1.0);
  assert.equal(min10, 990000000n);

  // 0.1% slippage -> minimum 99.9% = 999,000,000
  const min01 = calculateAmountOutMinimum(amountOut, 0.1);
  assert.equal(min01, 999000000n);
});

test('evaluateQuoteSafety permits normal quotes and blocks abnormal quotes (> 30% impact)', () => {
  const fairMarketRate = 3000; // 1 ETH = 3,000 USDC

  // Normal execution rate: 2985 USDC (0.5% impact)
  const normalQuote = evaluateQuoteSafety(2985, fairMarketRate);
  assert.equal(normalQuote.safe, true);
  assert.equal(normalQuote.priceImpactPercent, 0.5);

  // Severe price impact / illiquid pool: 1800 USDC (40% impact)
  const abnormalQuote = evaluateQuoteSafety(1800, fairMarketRate);
  assert.equal(abnormalQuote.safe, false);
  assert.match(abnormalQuote.error, /Abnormal quote detected/);
  assert.match(abnormalQuote.error, /Swap blocked for your security/);
});
