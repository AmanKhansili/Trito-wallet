import test from 'node:test';
import assert from 'node:assert/strict';

function parseBlockchainError(error) {
  if (!error) return { userMessage: 'An unknown error occurred.', isFatal: false };
  const errStr = typeof error === 'string' ? error : error.message || '';
  const errCode = error.code;

  if (errStr.includes('user rejected') || errStr.includes('ACTION_REJECTED') || errCode === 'ACTION_REJECTED') {
    return { userMessage: 'Transaction signature was cancelled by user.', technicalCode: 'USER_REJECTED', isFatal: false };
  }
  if (errStr.includes('insufficient funds') || errStr.includes('INSUFFICIENT_FUNDS') || errCode === 'INSUFFICIENT_FUNDS') {
    return { userMessage: 'Insufficient ETH balance to cover the transaction value and network gas fee.', technicalCode: 'INSUFFICIENT_FUNDS', isFatal: false };
  }
  if (errStr.includes('STF') || errStr.includes('TRANSFER_FROM_FAILED')) {
    return { userMessage: 'Token approval is required before this swap. Please authorize the token spending and try again.', technicalCode: 'UNISWAP_STF', isFatal: false };
  }
  if (errStr.includes('Too little received') || errStr.includes('PRICE_SLIPPAGE') || errStr.includes('SPL')) {
    return { userMessage: 'Slippage tolerance exceeded. Market prices fluctuated before transaction mined. Try increasing your slippage tolerance slightly.', technicalCode: 'SLIPPAGE_EXCEEDED', isFatal: false };
  }
  if (errStr.includes('network') || errStr.includes('NETWORK_ERROR') || errStr.includes('connection refused') || errStr.includes('timeout')) {
    return { userMessage: 'Network temporarily unavailable. Unable to communicate with the Ethereum RPC node. Please verify your connection.', technicalCode: 'RPC_UNAVAILABLE', isFatal: true };
  }

  return { userMessage: errStr || 'Transaction failed on blockchain.', technicalCode: errCode || 'UNKNOWN_ERROR', isFatal: false };
}

test('parseBlockchainError translates STF into token approval message', () => {
  const err = new Error('execution reverted: STF');
  const parsed = parseBlockchainError(err);
  assert.equal(parsed.technicalCode, 'UNISWAP_STF');
  assert.match(parsed.userMessage, /Token approval is required/);
});

test('parseBlockchainError translates slippage error gracefully', () => {
  const err = new Error('execution reverted: Too little received');
  const parsed = parseBlockchainError(err);
  assert.equal(parsed.technicalCode, 'SLIPPAGE_EXCEEDED');
  assert.match(parsed.userMessage, /Slippage tolerance exceeded/);
});

test('parseBlockchainError translates user rejection', () => {
  const err = { code: 'ACTION_REJECTED', message: 'user rejected transaction' };
  const parsed = parseBlockchainError(err);
  assert.equal(parsed.technicalCode, 'USER_REJECTED');
  assert.match(parsed.userMessage, /cancelled by user/);
});

test('parseBlockchainError handles RPC timeout/disconnection', () => {
  const err = new Error('timeout waiting for network response');
  const parsed = parseBlockchainError(err);
  assert.equal(parsed.technicalCode, 'RPC_UNAVAILABLE');
  assert.equal(parsed.isFatal, true);
});
