import test from 'node:test';
import assert from 'node:assert/strict';

function validateAddress(address) {
  const trimmed = address.trim();
  if (!trimmed) return { isValid: false, error: 'Recipient address is required.' };
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { isValid: false, error: 'Invalid Ethereum address. Must be a 42-character hex address.' };
  }
  return { isValid: true };
}

function validateMnemonic(phrase) {
  const trimmed = phrase.trim().toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) {
    return { isValid: false, error: `Recovery phrase must contain exactly 12 (or 24) words. You provided ${words.length}.` };
  }
  return { isValid: true };
}

function validatePrivateKey(key) {
  let cleanKey = key.trim();
  if (!cleanKey) return { isValid: false, error: 'Private key is required.' };
  if (!cleanKey.startsWith('0x')) cleanKey = `0x${cleanKey}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanKey)) {
    return { isValid: false, error: 'Invalid private key format. Must be a 64-character hexadecimal string.' };
  }
  return { isValid: true };
}

function validateSendAmount(amountRaw, tokenBalanceRaw, isNativeEth, estimatedGasWei, ethBalanceRaw) {
  if (amountRaw <= 0n) return { isValid: false, error: 'Enter a valid amount greater than zero.' };
  if (amountRaw > tokenBalanceRaw) return { isValid: false, error: 'Insufficient token balance.' };
  if (isNativeEth) {
    if (amountRaw + estimatedGasWei > ethBalanceRaw) {
      return { isValid: false, error: 'Insufficient ETH balance to cover both transfer amount and network gas fees.' };
    }
  } else {
    if (estimatedGasWei > ethBalanceRaw) {
      return { isValid: false, error: 'Insufficient ETH to pay for transaction network gas fees.' };
    }
  }
  return { isValid: true };
}

function validateSlippage(slippage) {
  if (isNaN(slippage) || slippage <= 0) return { isValid: false, error: 'Slippage tolerance must be greater than 0%.' };
  if (slippage > 50) return { isValid: false, error: 'Slippage tolerance cannot exceed 50%.' };
  if (slippage > 5) return { isValid: true, warning: 'High slippage tolerance!' };
  return { isValid: true };
}

test('validateAddress accepts valid checksum and lowercase addresses', () => {
  assert.equal(validateAddress('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238').isValid, true);
  assert.equal(validateAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045').isValid, true);
  assert.equal(validateAddress('').isValid, false);
  assert.equal(validateAddress('0xInvalidAddressLength').isValid, false);
});

test('validateMnemonic enforces 12 words', () => {
  const valid12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  assert.equal(validateMnemonic(valid12).isValid, true);

  const shortPhrase = 'abandon abandon abandon';
  assert.equal(validateMnemonic(shortPhrase).isValid, false);
});

test('validatePrivateKey validates 32-byte hex strings', () => {
  const validKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  assert.equal(validatePrivateKey(validKey).isValid, true);

  const keyWithout0x = '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  assert.equal(validatePrivateKey(keyWithout0x).isValid, true);

  const invalidKey = '0x12345';
  assert.equal(validatePrivateKey(invalidKey).isValid, false);
});

test('validateSendAmount enforces balance and gas fee limits', () => {
  // Transfer 1 ETH with 0.001 ETH gas fee, wallet has 2 ETH
  const sendEth = validateSendAmount(
    1000000000000000000n, // 1 ETH
    2000000000000000000n, // 2 ETH bal
    true,
    1000000000000000n, // 0.001 ETH gas
    2000000000000000000n,
  );
  assert.equal(sendEth.isValid, true);

  // Transfer 2 ETH with gas fee when wallet only has 2 ETH
  const failEth = validateSendAmount(
    2000000000000000000n,
    2000000000000000000n,
    true,
    1000000000000000n,
    2000000000000000000n,
  );
  assert.equal(failEth.isValid, false);
  assert.match(failEth.error, /Insufficient ETH balance/);

  // Transfer ERC20: Token balance ok, but 0 ETH for gas
  const failGas = validateSendAmount(
    100000000n, // 100 USDC
    500000000n, // 500 USDC bal
    false,
    1000000000000000n, // gas
    0n, // 0 ETH
  );
  assert.equal(failGas.isValid, false);
  assert.match(failGas.error, /Insufficient ETH to pay/);
});

test('validateSlippage checks valid ranges and warnings', () => {
  assert.equal(validateSlippage(0.5).isValid, true);
  assert.equal(validateSlippage(0.1).isValid, true);
  assert.equal(validateSlippage(1.0).isValid, true);
  assert.equal(validateSlippage(0).isValid, false);
  assert.equal(validateSlippage(55).isValid, false);
  assert.equal(validateSlippage(10).warning !== undefined, true);
});
