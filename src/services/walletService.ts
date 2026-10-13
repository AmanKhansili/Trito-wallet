import 'react-native-get-random-values';
import { ethers } from 'ethers';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageService } from './storageService';
import { validateMnemonic, validatePrivateKey } from '../utils/validation';
import { WalletAccount } from '../types';
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
let memoryMnemonic: string | null = null;

export const walletService = {
  /**
   * Generates a brand new cryptographically secure 12-word mnemonic wallet using ethers v6.
   * Derivation path follows standard BIP-44: m/44'/60'/0'/0/0
   */
  generateNewWallet(): GeneratedWalletData {
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
    if (await storageService.getSecurePrivateKey()) {
      throw new Error('A wallet already exists. Remove it first.');
    }
    await storageService.saveSecureWallet(privateKey, mnemonicPhrase);
    await storageService.savePin(pin);
    await storageService.setWalletExists(true, address);
    await storageService.saveActiveAccountIndex(0);
    await storageService.saveAccountsCount(1);

    memoryPrivateKey = privateKey;
    memoryAddress = address;
    memoryMnemonic = mnemonicPhrase;
    await storageService.saveLastActiveTimestamp(Date.now());

    logger.info('Wallet finalized and saved to secure storage.');
  },

  /**
   * Imports an existing wallet using either a 12-word mnemonic phrase or a 32-byte hex private key.
   */
  async importWallet(secretInput: string, pin: string): Promise<ImportedWalletData> {
    if (await storageService.getSecurePrivateKey()) {
      throw new Error('A wallet already exists. Remove it first.');
    }

    const trimmed = secretInput.trim();
    const normalized = trimmed.toLowerCase().split(/\s+/).join(' ');

    if (normalized.includes(' ')) {
      const val = validateMnemonic(normalized);
      if (!val.isValid) {
        throw new Error(val.error || 'Invalid mnemonic phrase.');
      }

      const mnemonic = ethers.Mnemonic.fromPhrase(normalized);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");

      await storageService.saveSecureWallet(hdNode.privateKey, mnemonic.phrase);
      await storageService.savePin(pin);
      await storageService.setWalletExists(true, hdNode.address);
      await storageService.saveActiveAccountIndex(0);
      await storageService.saveAccountsCount(1);

      memoryPrivateKey = hdNode.privateKey;
      memoryAddress = hdNode.address;
      memoryMnemonic = mnemonic.phrase;
      await storageService.saveLastActiveTimestamp(Date.now());

      logger.info('Wallet imported via seed phrase successfully.');
      return {
        address: hdNode.address,
        privateKey: hdNode.privateKey,
        mnemonicPhrase: mnemonic.phrase,
      };
    } else {
      const val = validatePrivateKey(trimmed);
      if (!val.isValid) {
        throw new Error(val.error || 'Invalid private key format.');
      }

      const cleanKey = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
      const wallet = new ethers.Wallet(cleanKey);

      await storageService.saveSecureWallet(cleanKey);
      await storageService.savePin(pin);
      await storageService.setWalletExists(true, wallet.address);
      await storageService.saveActiveAccountIndex(0);
      await storageService.saveAccountsCount(1);

      memoryPrivateKey = cleanKey;
      memoryAddress = wallet.address;
      memoryMnemonic = null;
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

    const mnemonic = await storageService.getSecureMnemonic();
    const privateKey = await storageService.getSecurePrivateKey();

    if (!privateKey && !mnemonic) {
      throw new Error('Wallet credentials missing from secure storage.');
    }

    const activeIndex = await storageService.getActiveAccountIndex();

    if (mnemonic) {
      const mObj = ethers.Mnemonic.fromPhrase(mnemonic);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mObj, `m/44'/60'/0'/0/${activeIndex}`);
      memoryPrivateKey = hdNode.privateKey;
      memoryAddress = hdNode.address;
      memoryMnemonic = mnemonic;
    } else if (privateKey) {
      const wallet = new ethers.Wallet(privateKey);
      memoryPrivateKey = privateKey;
      memoryAddress = wallet.address;
      memoryMnemonic = null;
    }

    await storageService.saveLastActiveTimestamp(Date.now());
    logger.info('Wallet unlocked successfully.');
    return true;
  },

  /**
   * Unlock with biometrics.
   */
  async unlockWithBiometrics(): Promise<boolean> {
    if (!(await storageService.isBiometricsEnabled())) {
      return false;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      return false;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock TRITO Wallet',
      fallbackLabel: 'Enter PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });
    if (!auth.success) {
      return false;
    }

    const mnemonic = await storageService.getSecureMnemonic();
    const privateKey = await storageService.getSecurePrivateKey();
    const activeIndex = await storageService.getActiveAccountIndex();

    if (mnemonic) {
      const mObj = ethers.Mnemonic.fromPhrase(mnemonic);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mObj, `m/44'/60'/0'/0/${activeIndex}`);
      memoryPrivateKey = hdNode.privateKey;
      memoryAddress = hdNode.address;
      memoryMnemonic = mnemonic;
    } else if (privateKey) {
      const wallet = new ethers.Wallet(privateKey);
      memoryPrivateKey = privateKey;
      memoryAddress = wallet.address;
      memoryMnemonic = null;
    } else {
      return false;
    }

    await storageService.saveLastActiveTimestamp(Date.now());
    logger.info('Wallet unlocked via biometrics.');
    return true;
  },

  /**
   * Multi-Account HD Derivation: Lists all derived accounts under this wallet.
   */
  async listAccounts(): Promise<WalletAccount[]> {
    const mnemonic = memoryMnemonic || (await storageService.getSecureMnemonic());
    if (!mnemonic) {
      const addr = await this.getAddress();
      return [{ index: 0, name: 'Account 1', address: addr || '' }];
    }

    const count = await storageService.getAccountsCount();
    const accounts: WalletAccount[] = [];
    const mObj = ethers.Mnemonic.fromPhrase(mnemonic);

    for (let i = 0; i < count; i++) {
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mObj, `m/44'/60'/0'/0/${i}`);
      accounts.push({
        index: i,
        name: `Account ${i + 1}`,
        address: hdNode.address,
      });
    }

    return accounts;
  },

  /**
   * Adds a new HD derived account (e.g. Account 2, Account 3).
   */
  async createNewAccount(): Promise<WalletAccount> {
    const mnemonic = memoryMnemonic || (await storageService.getSecureMnemonic());
    if (!mnemonic) {
      throw new Error('Cannot add new accounts to a wallet imported via private key.');
    }

    const currentCount = await storageService.getAccountsCount();
    const newIndex = currentCount;
    await storageService.saveAccountsCount(currentCount + 1);

    const mObj = ethers.Mnemonic.fromPhrase(mnemonic);
    const hdNode = ethers.HDNodeWallet.fromMnemonic(mObj, `m/44'/60'/0'/0/${newIndex}`);

    const newAccount: WalletAccount = {
      index: newIndex,
      name: `Account ${newIndex + 1}`,
      address: hdNode.address,
    };

    // Switch to new account automatically
    await this.switchAccount(newIndex);
    return newAccount;
  },

  /**
   * Switches the active account.
   */
  async switchAccount(index: number): Promise<void> {
    const mnemonic = memoryMnemonic || (await storageService.getSecureMnemonic());
    if (mnemonic) {
      const mObj = ethers.Mnemonic.fromPhrase(mnemonic);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mObj, `m/44'/60'/0'/0/${index}`);
      memoryPrivateKey = hdNode.privateKey;
      memoryAddress = hdNode.address;
      await storageService.saveActiveAccountIndex(index);
      await storageService.setWalletExists(true, hdNode.address);
      logger.info(`Switched to Account ${index + 1}: ${hdNode.address}`);
    }
  },

  /**
   * Locks the wallet and wipes decrypted keys from memory.
   */
  lockWallet(): void {
    memoryPrivateKey = null;
    memoryAddress = null;
    memoryMnemonic = null;
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
    if (memoryPrivateKey) {
      return memoryPrivateKey;
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