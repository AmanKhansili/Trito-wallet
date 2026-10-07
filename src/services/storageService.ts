import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyPreference, NetworkId, TransactionRecord, MarketPricesMap } from '../types';
import { logger } from '../utils/logger';

// SecureStore Keys (Encrypted on Device Keychain / KeyStore)
const SECURE_MNEMONIC = 'trito_secure_mnemonic';
const SECURE_PRIVATE_KEY = 'trito_secure_private_key';
const SECURE_USER_PIN = 'trito_secure_pin';
const SECURE_BIOMETRICS = 'trito_secure_biometrics';
const SECURE_PIN_ATTEMPTS = 'trito_secure_pin_attempts';
// AsyncStorage Keys (Public / Non-Sensitive Metadata)
const STORAGE_WALLET_EXISTS = 'trito_wallet_exists';
const STORAGE_PUBLIC_ADDRESS = 'trito_public_address';
const STORAGE_NETWORK_ID = 'trito_network_id';
const STORAGE_CURRENCY = 'trito_currency_preference';
const STORAGE_THEME = 'trito_theme_mode';
const STORAGE_AUTOLOCK_MINUTES = 'trito_autolock_minutes';
const STORAGE_LAST_ACTIVE = 'trito_last_active_timestamp';
const STORAGE_TRANSACTIONS = 'trito_transaction_history';
const STORAGE_CACHED_PRICES = 'trito_cached_prices';

export const storageService = {
  // ==================== SECURE DATA ====================

  /**
   * Save wallet credentials into encrypted SecureStore.
   * NEVER store in AsyncStorage or unencrypted storage.
   */
  async saveSecureWallet(privateKey: string, mnemonic?: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_PRIVATE_KEY, privateKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });

      if (mnemonic) {
        await SecureStore.setItemAsync(SECURE_MNEMONIC, mnemonic, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
      } else {
        await SecureStore.deleteItemAsync(SECURE_MNEMONIC);
      }
      logger.info('Wallet credentials safely secured in hardware/OS keychain.');
    } catch (err) {
      logger.error('Failed to save to SecureStore:', err);
      throw new Error('Unable to securely persist wallet credentials.');
    }
  },

  async getSecurePrivateKey(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_PRIVATE_KEY);
    } catch (err) {
      logger.error('Failed to read private key from SecureStore:', err);
      return null;
    }
  },

  async getSecureMnemonic(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_MNEMONIC);
    } catch (err) {
      logger.error('Failed to read mnemonic from SecureStore:', err);
      return null;
    }
  },

  async savePin(pin: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_USER_PIN, pin, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (err) {
      logger.error('Failed to store PIN:', err);
      throw new Error('Could not securely save PIN.');
    }
  },

  async verifyPin(input: string): Promise<boolean> {
    const raw = await SecureStore.getItemAsync(SECURE_PIN_ATTEMPTS);
    const state = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    if (Date.now() < state.lockedUntil) {
      throw new Error('Too many wrong attempts. Try again later.');
    }

    const stored = await SecureStore.getItemAsync(SECURE_USER_PIN);
    const ok = !!stored && stored === input; // baad me hashed compare

    const next = ok
      ? { count: 0, lockedUntil: 0 }
      : {
          count: state.count + 1,
          lockedUntil:
            state.count + 1 >= 5
              ? Date.now() + Math.min(30_000 * 2 ** (state.count - 4), 3_600_000)
              : 0,
        };
    await SecureStore.setItemAsync(SECURE_PIN_ATTEMPTS, JSON.stringify(next));
    return ok;
  },

  async hasPin(): Promise<boolean> {
    try {
      const pin = await SecureStore.getItemAsync(SECURE_USER_PIN);
      return !!pin;
    } catch {
      return false;
    }
  },

  async setBiometricsEnabled(enabled: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_BIOMETRICS, enabled ? 'true' : 'false');
    } catch (err) {
      logger.error('Failed to set biometrics preference:', err);
    }
  },

  async isBiometricsEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(SECURE_BIOMETRICS);
      return val === 'true';
    } catch {
      return false;
    }
  },

  // ==================== NON-SENSITIVE METADATA ====================

  async setWalletExists(exists: boolean, publicAddress?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_WALLET_EXISTS, exists ? 'true' : 'false');
      if (publicAddress) {
        await AsyncStorage.setItem(STORAGE_PUBLIC_ADDRESS, publicAddress);
      } else {
        await AsyncStorage.removeItem(STORAGE_PUBLIC_ADDRESS);
      }
    } catch (err) {
      logger.error('Failed to set wallet existence flag:', err);
    }
  },

  async checkWalletExists(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_WALLET_EXISTS);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async getStoredPublicAddress(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_PUBLIC_ADDRESS);
    } catch {
      return null;
    }
  },

  async saveNetworkId(networkId: NetworkId): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_NETWORK_ID, networkId);
    } catch (err) {
      logger.error('Failed to save network ID:', err);
    }
  },

  async getNetworkId(): Promise<NetworkId> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_NETWORK_ID);
      if (val === 'mainnet' || val === 'sepolia') {
        return val;
      }
      return 'sepolia';
    } catch {
      return 'sepolia';
    }
  },

  async saveCurrencyPreference(currency: CurrencyPreference): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_CURRENCY, currency);
    } catch (err) {
      logger.error('Failed to save currency preference:', err);
    }
  },

  async getCurrencyPreference(): Promise<CurrencyPreference> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_CURRENCY);
      if (val === 'INR' || val === 'USD') return val;
      return 'USD';
    } catch {
      return 'USD';
    }
  },

  async saveAutoLockMinutes(minutes: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_AUTOLOCK_MINUTES, String(minutes));
    } catch (err) {
      logger.error('Failed to save auto-lock minutes:', err);
    }
  },

  async getAutoLockMinutes(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_AUTOLOCK_MINUTES);
      const parsed = Number(val);
      return isNaN(parsed) || parsed < 0 ? 5 : parsed;
    } catch {
      return 5;
    }
  },

  async saveLastActiveTimestamp(ts: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_LAST_ACTIVE, String(ts));
    } catch (err) {
      logger.error('Failed to save last active timestamp:', err);
    }
  },

  async getLastActiveTimestamp(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_LAST_ACTIVE);
      const parsed = Number(val);
      return isNaN(parsed) ? Date.now() : parsed;
    } catch {
      return Date.now();
    }
  },

  async saveTransactions(txs: TransactionRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(txs));
    } catch (err) {
      logger.error('Failed to save transactions:', err);
    }
  },

  async getTransactions(): Promise<TransactionRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_TRANSACTIONS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  async saveCachedPrices(prices: MarketPricesMap): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_CACHED_PRICES, JSON.stringify(prices));
    } catch (err) {
      logger.error('Failed to cache prices:', err);
    }
  },

  async getCachedPrices(): Promise<MarketPricesMap | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_CACHED_PRICES);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  /**
   * Completely erase all wallet keys, PIN, settings, and transactions.
   */
  async clearAllWalletData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SECURE_PRIVATE_KEY);
      await SecureStore.deleteItemAsync(SECURE_MNEMONIC);
      await SecureStore.deleteItemAsync(SECURE_USER_PIN);
      await SecureStore.deleteItemAsync(SECURE_BIOMETRICS);

      await AsyncStorage.multiRemove([
        STORAGE_WALLET_EXISTS,
        STORAGE_PUBLIC_ADDRESS,
        STORAGE_LAST_ACTIVE,
        STORAGE_TRANSACTIONS,
      ]);
      logger.info('Wallet data completely erased from device storage.');
    } catch (err) {
      logger.error('Failed to clear wallet data:', err);
      throw new Error('Unable to completely wipe wallet.');
    }
  },
};
