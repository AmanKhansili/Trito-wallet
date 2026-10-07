import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageService } from '../services/storageService';
import { walletService, GeneratedWalletData, ImportedWalletData } from '../services/walletService';
import { logger } from '../utils/logger';

interface AuthContextType {
  isReady: boolean;
  hasWallet: boolean;
  unlocked: boolean;
  isBiometricsSupported: boolean;
  isBiometricsEnabled: boolean;
  autoLockMinutes: number;
  pendingCreationData: GeneratedWalletData | null;
  setPendingCreationData: (data: GeneratedWalletData | null) => void;
  createWallet: () => GeneratedWalletData;
  finalizeCreation: (pin: string) => Promise<void>;
  importWallet: (secret: string, pin: string) => Promise<ImportedWalletData>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  lockWallet: () => void;
  removeWallet: () => Promise<void>;
  toggleBiometrics: (enabled: boolean) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [hasWallet, setHasWallet] = useState<boolean>(false);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState<boolean>(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState<boolean>(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(5);
  const [pendingCreationData, setPendingCreationData] = useState<GeneratedWalletData | null>(null);

  // Initialize auth & security state
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const walletExists = await storageService.checkWalletExists();
        const bioSupported = await LocalAuthentication.hasHardwareAsync();
        const bioEnrolled = await LocalAuthentication.isEnrolledAsync();
        const bioEnabled = await storageService.isBiometricsEnabled();
        const autoLock = await storageService.getAutoLockMinutes();

        if (isMounted) {
          setHasWallet(walletExists);
          setIsBiometricsSupported(bioSupported && bioEnrolled);
          setIsBiometricsEnabled(bioEnabled);
          setAutoLockMinutesState(autoLock);
          // Always start locked if wallet exists
          setUnlocked(false);
          walletService.lockWallet();
          setIsReady(true);
        }
      } catch (err) {
        logger.error('Error initializing AuthContext:', err);
        if (isMounted) setIsReady(true);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle AppState changes: Auto-lock when backgrounded or timeout reached
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        logger.info('App went to background. Locking wallet for security.');
        walletService.lockWallet();
        setUnlocked(false);
        await storageService.saveLastActiveTimestamp(Date.now());
      } else if (nextState === 'active') {
        const lastActive = await storageService.getLastActiveTimestamp();
        const lockMs = autoLockMinutes * 60 * 1000;
        if (Date.now() - lastActive > lockMs) {
          walletService.lockWallet();
          setUnlocked(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [autoLockMinutes]);

  const createWallet = useCallback((): GeneratedWalletData => {
    const generated = walletService.generateNewWallet();
    setPendingCreationData(generated);
    return generated;
  }, []);

  const finalizeCreation = useCallback(
    async (pin: string): Promise<void> => {
      if (!pendingCreationData) {
        throw new Error('No pending wallet data to finalize.');
      }
      await walletService.finalizeWalletCreation(
        pendingCreationData.address,
        pendingCreationData.privateKey,
        pendingCreationData.mnemonicPhrase,
        pin,
      );
      setPendingCreationData(null);
      setHasWallet(true);
      setUnlocked(true);
    },
    [pendingCreationData],
  );

  const importWallet = useCallback(
    async (secret: string, pin: string): Promise<ImportedWalletData> => {
      if (await storageService.getSecurePrivateKey()) {
        throw new Error('A wallet already exists. Remove it first.');
      }
      const imported = await walletService.importWallet(secret, pin);
      setHasWallet(true);
      setUnlocked(true);
      return imported;
    },
    [],
  );

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const success = await walletService.unlockWithPin(pin);
    if (success) {
      setUnlocked(true);
      return true;
    }
    return false;
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!isBiometricsSupported || !isBiometricsEnabled) {
      return false;
    }

    try {
      const unlocked = await walletService.unlockWithBiometrics();
      if (unlocked) {
        setUnlocked(true);
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Biometric authentication failed:', err);
      return false;
    }
  }, [isBiometricsSupported, isBiometricsEnabled]);

  const lockWallet = useCallback((): void => {
    walletService.lockWallet();
    setUnlocked(false);
  }, []);

  const removeWallet = useCallback(async (): Promise<void> => {
    await walletService.removeWallet();
    setHasWallet(false);
    setUnlocked(false);
    setPendingCreationData(null);
  }, []);

  const toggleBiometrics = useCallback(async (enabled: boolean): Promise<void> => {
    await storageService.setBiometricsEnabled(enabled);
    setIsBiometricsEnabled(enabled);
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const verified = await storageService.verifyPin(oldPin);
    if (!verified) return false;
    await storageService.savePin(newPin);
    return true;
  }, []);

  const setAutoLockMinutes = useCallback(async (minutes: number): Promise<void> => {
    await storageService.saveAutoLockMinutes(minutes);
    setAutoLockMinutesState(minutes);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isReady,
        hasWallet,
        unlocked,
        isBiometricsSupported,
        isBiometricsEnabled,
        autoLockMinutes,
        pendingCreationData,
        setPendingCreationData,
        createWallet,
        finalizeCreation,
        importWallet,
        unlockWithPin,
        unlockWithBiometrics,
        lockWallet,
        removeWallet,
        toggleBiometrics,
        changePin,
        setAutoLockMinutes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
