import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  NetworkConfig,
  NetworkId,
  TokenBalance,
  TransactionRecord,
  CurrencyPreference,
  MarketPricesMap,
} from '../types';
import { NETWORKS, getNetwork } from '../config/networks';
import { cryptoService } from '../services/cryptoService';
import { priceService } from '../services/priceService';
import { storageService } from '../services/storageService';
import { walletService } from '../services/walletService';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

interface WalletContextType {
  address: string | null;
  network: NetworkConfig;
  setNetwork: (networkId: NetworkId) => Promise<void>;
  ethBalance: TokenBalance | null;
  tokenBalances: TokenBalance[];
  totalPortfolioValueUsd: number;
  totalPortfolioValueInr: number;
  marketPrices: MarketPricesMap;
  currencyPreference: CurrencyPreference;
  setCurrencyPreference: (curr: CurrencyPreference) => Promise<void>;
  transactions: TransactionRecord[];
  isLoadingBalances: boolean;
  isRefreshing: boolean;
  networkError: string | null;
  refreshBalances: (silent?: boolean) => Promise<void>;
  refreshTransactions: () => Promise<void>;
  addTransaction: (tx: TransactionRecord) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { hasWallet, unlocked } = useAuth();

  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetworkState] = useState<NetworkConfig>(NETWORKS.sepolia);
  const [ethBalance, setEthBalance] = useState<TokenBalance | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalPortfolioValueUsd, setTotalPortfolioValueUsd] = useState<number>(0);
  const [totalPortfolioValueInr, setTotalPortfolioValueInr] = useState<number>(0);
  const [marketPrices, setMarketPrices] = useState<MarketPricesMap>({});
  const [currencyPreference, setCurrencyPreferenceState] = useState<CurrencyPreference>('USD');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Load preferences from storage on mount
  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        const storedNetworkId = await storageService.getNetworkId();
        const storedCurr = await storageService.getCurrencyPreference();
        const storedTxs = await storageService.getTransactions();
        const storedAddress = await storageService.getStoredPublicAddress();
        const initialPrices = await priceService.fetchMarketPrices(false);

        if (isMounted) {
          setNetworkState(getNetwork(storedNetworkId));
          setCurrencyPreferenceState(storedCurr);
          setTransactions(storedTxs);
          setMarketPrices(initialPrices);
          if (storedAddress) {
            setAddress(storedAddress);
          }
        }
      } catch (err) {
        logger.error('Error loading wallet preferences:', err);
      }
    }
    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update address when auth state changes
  useEffect(() => {
    let isMounted = true;
    async function syncAddress() {
      if (hasWallet) {
        const currentAddr = await walletService.getAddress();
        if (isMounted) {
          setAddress(currentAddr);
        }
      } else {
        if (isMounted) {
          setAddress(null);
          setEthBalance(null);
          setTokenBalances([]);
          setTotalPortfolioValueUsd(0);
          setTotalPortfolioValueInr(0);
        }
      }
    }
    syncAddress();

    return () => {
      isMounted = false;
    };
  }, [hasWallet, unlocked]);

  // Fetch balances from blockchain RPC
  const refreshBalances = useCallback(
    async (silent: boolean = false) => {
      const activeAddr = await walletService.getAddress();
      if (!activeAddr) {
        return;
      }

      if (!silent) {
        setIsLoadingBalances(true);
      }
      setIsRefreshing(true);
      setNetworkError(null);

      try {
        // Fetch market prices first for valuation
        const prices = await priceService.fetchMarketPrices(silent);
        setMarketPrices(prices);

        // Query real blockchain balances
        const { ethBalance: ethBal, tokenBalances: tBalances } =
          await cryptoService.getAllBalances(activeAddr, network.id, prices);

        setEthBalance(ethBal);
        setTokenBalances(tBalances);

        // Calculate portfolio total = sum(token.balanceUsd)
        let totalUsd = 0;
        let totalInr = 0;
        for (const tb of tBalances) {
          totalUsd += tb.balanceUsd;
          totalInr += tb.balanceInr;
        }

        setTotalPortfolioValueUsd(totalUsd);
        setTotalPortfolioValueInr(totalInr);
      } catch (err) {
        logger.error('Failed to refresh blockchain balances:', err);
        setNetworkError('Network temporarily unavailable. Unable to refresh balances.');
      } finally {
        setIsLoadingBalances(false);
        setIsRefreshing(false);
      }
    },
    [network.id],
  );

  // Auto-refresh balances when network or wallet changes
  useEffect(() => {
    if (address) {
      refreshBalances(false);
    }
  }, [address, network.id, refreshBalances]);

  // Refresh transaction history from storage
  const refreshTransactions = useCallback(async () => {
    const txs = await storageService.getTransactions();
    setTransactions(txs);
  }, []);

  const addTransaction = useCallback(
    async (tx: TransactionRecord) => {
      const existing = await storageService.getTransactions();
      const updated = [tx, ...existing.filter((t) => t.hash !== tx.hash)];
      await storageService.saveTransactions(updated);
      setTransactions(updated);
      // Auto refresh balances after new transaction
      refreshBalances(true);
    },
    [refreshBalances],
  );

  const setNetwork = useCallback(
    async (networkId: NetworkId) => {
      await storageService.saveNetworkId(networkId);
      setNetworkState(getNetwork(networkId));
    },
    [],
  );

  const setCurrencyPreference = useCallback(async (curr: CurrencyPreference) => {
    await storageService.saveCurrencyPreference(curr);
    setCurrencyPreferenceState(curr);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        network,
        setNetwork,
        ethBalance,
        tokenBalances,
        totalPortfolioValueUsd,
        totalPortfolioValueInr,
        marketPrices,
        currencyPreference,
        setCurrencyPreference,
        transactions,
        isLoadingBalances,
        isRefreshing,
        networkError,
        refreshBalances,
        refreshTransactions,
        addTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
