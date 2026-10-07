import 'react-native-get-random-values';
import { ethers } from 'ethers';
import { storageService } from './storageService';
import { validateMnemonic, validatePrivateKey } from '../utils/validation';
import { logger } from '../utils/logger';

export interface GeneratedWalletData {
  address: string;
  mnemonicPhrase: string;
  privateKey: string;
}

export interface ImportedWalletData {
  address: string;
  privateKey: string;
  mnemonicPhrase?: string;
}

// In-memory decrypted key storage (ephemeral, cleared on lock)
let memoryPrivateKey: string | null = null;
let memoryAddress: string | null = null;

export const walletService = {
  /**
   * Generates a brand new cryptographically secure 12-word mnemonic wallet using ethers v6.
   * Derivation path follows standard BIP-44: m/44'/60'/0'/0/0
   */
  generateNewWallet(): GeneratedWalletData {
    // 16 bytes of entropy yields a 12-word BIP-39 mnemonic
    const entropy = ethers.randomBytes(16);
    const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
    const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");

    logger.info('Generated new HD wallet locally with address:', hdNode.address);

    return {
      address: hdNode.address,
      mnemonicPhrase: mnemonic.phrase,
      privateKey: hdNode.privateKey,
    };
  },

  /**
   * Completes the wallet creation after user verifies mnemonic words.
   * Stores keys into hardware-backed SecureStore and updates auth state.
   */
  async finalizeWalletCreation(
    address: string,
    privateKey: string,
    mnemonicPhrase: string,
    pin: string,
  ): Promise<void> {
    await storageService.saveSecureWallet(privateKey, mnemonicPhrase);
    await storageService.savePin(pin);
    await storageService.setWalletExists(true, address);

    memoryPrivateKey = privateKey;
    memoryAddress = address;
    await storageService.saveLastActiveTimestamp(Date.now());

    logger.info('Wallet finalized and saved to secure storage.');
  },

  /**
   * Imports an existing wallet using either a 12-word mnemonic phrase or a 32-byte hex private key.
   */
  async importWallet(
    secretInput: string,
    pin: string,
  ): Promise<ImportedWalletData> {
    const trimmed = secretInput.trim();

    // Check if it's a seed phrase
    if (trimmed.includes(' ')) {
      const val = validateMnemonic(trimmed);
      if (!val.isValid) {
        throw new Error(val.error || 'Invalid mnemonic phrase.');
      }

      const mnemonic = ethers.Mnemonic.fromPhrase(trimmed);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");

      await storageService.saveSecureWallet(hdNode.privateKey, mnemonic.phrase);
      await storageService.savePin(pin);
      await storageService.setWalletExists(true, hdNode.address);

      memoryPrivateKey = hdNode.privateKey;
      memoryAddress = hdNode.address;
      await storageService.saveLastActiveTimestamp(Date.now());

      logger.info('Wallet imported via seed phrase successfully.');
      return {
        address: hdNode.address,
        privateKey: hdNode.privateKey,
        mnemonicPhrase: mnemonic.phrase,
      };
    } else {
      // Must be a raw private key
      const val = validatePrivateKey(trimmed);
      if (!val.isValid) {
        throw new Error(val.error || 'Invalid private key format.');
      }

      const cleanKey = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
      const wallet = new ethers.Wallet(cleanKey);

      await storageService.saveSecureWallet(cleanKey);
      await storageService.savePin(pin);
      await storageService.setWalletExists(true, wallet.address);

      memoryPrivateKey = cleanKey;
      memoryAddress = wallet.address;
      await storageService.saveLastActiveTimestamp(Date.now());

      logger.info('Wallet imported via private key successfully.');
      return {
        address: wallet.address,
        privateKey: cleanKey,
      };
    }
  },

  /**
   * Authenticate and unlock wallet with PIN.
   */
  async unlockWithPin(pin: string): Promise<boolean> {
    const isValid = await storageService.verifyPin(pin);
    if (!isValid) {
      return false;
    }

    const privateKey = await storageService.getSecurePrivateKey();
    if (!privateKey) {
      throw new Error('Wallet private key missing from secure storage.');
    }

    const wallet = new ethers.Wallet(privateKey);
    memoryPrivateKey = privateKey;
    memoryAddress = wallet.address;
    await storageService.saveLastActiveTimestamp(Date.now());

    logger.info('Wallet unlocked successfully.');
    return true;
  },

  /**
   * Unlock with biometrics (after successful LocalAuthentication).
   */
  async unlockWithBiometrics(): Promise<boolean> {
    const isBiometricsOn = await storageService.isBiometricsEnabled();
    if (!isBiometricsOn) {
      return false;
    }

    const privateKey = await storageService.getSecurePrivateKey();
    if (!privateKey) {
      return false;
    }

    const wallet = new ethers.Wallet(privateKey);
    memoryPrivateKey = privateKey;
    memoryAddress = wallet.address;
    await storageService.saveLastActiveTimestamp(Date.now());

    logger.info('Wallet unlocked via biometrics.');
    return true;
  },

  /**
   * Locks the wallet and wipes decrypted keys from memory.
   */
  lockWallet(): void {
    memoryPrivateKey = null;
    memoryAddress = null;
    logger.info('Wallet locked. Memory cleared.');
  },

  /**
   * Returns current active address. If locked, falls back to non-sensitive stored public address.
   */
  async getAddress(): Promise<string | null> {
    if (memoryAddress) {
      return memoryAddress;
    }
    return await storageService.getStoredPublicAddress();
  },

  /**
   * Returns signing wallet instance connected to the specified provider.
   * Throws if wallet is currently locked.
   */
  getSigner(provider: ethers.Provider): ethers.Wallet {
    if (!memoryPrivateKey) {
      throw new Error('Wallet is locked. Please unlock your wallet to authorize transactions.');
    }
    return new ethers.Wallet(memoryPrivateKey, provider);
  },

  /**
   * For secure backup / export after explicit PIN verification.
   */
  async getStoredRecoveryPhrase(verifiedPin: string): Promise<string | null> {
    const isValid = await storageService.verifyPin(verifiedPin);
    if (!isValid) {
      throw new Error('Incorrect PIN. Access denied.');
    }
    return await storageService.getSecureMnemonic();
  },

  /**
   * For secure private key export after explicit PIN verification.
   */
  async getStoredPrivateKey(verifiedPin: string): Promise<string> {
    const isValid = await storageService.verifyPin(verifiedPin);
    if (!isValid) {
      throw new Error('Incorrect PIN. Access denied.');
    }
    const key = await storageService.getSecurePrivateKey();
    if (!key) {
      throw new Error('Private key not found.');
    }
    return key;
  },

  /**
   * Remove wallet from device completely.
   */
  async removeWallet(): Promise<void> {
    this.lockWallet();
    await storageService.clearAllWalletData();
  },

  isUnlocked(): boolean {
    return memoryPrivateKey !== null;
  },
};
