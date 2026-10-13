import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  NetworkConfig,
  NetworkId,
  TokenConfig,
  TokenBalance,
  TransactionRecord,
  CurrencyPreference,
  MarketPricesMap,
  AddressBookContact,
  WalletAccount,
  GasSpeedTier,
} from '../types';
import { NETWORKS, getNetwork } from '../config/networks';
import { cryptoService } from '../services/cryptoService';
import { priceService } from '../services/priceService';
import { storageService } from '../services/storageService';
import { walletService } from '../services/walletService';
import { tokenService } from '../services/tokenService';
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

  // Custom Tokens
  customTokens: TokenConfig[];
  addCustomToken: (token: TokenConfig) => Promise<void>;
  removeCustomToken: (contractAddress: string) => Promise<void>;

  // Address Book
  contacts: AddressBookContact[];
  addContact: (contact: AddressBookContact) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  // Multi-Account
  accounts: WalletAccount[];
  activeAccountIndex: number;
  switchAccount: (index: number) => Promise<void>;
  createNewAccount: () => Promise<WalletAccount>;

  // Gas Controls
  gasSpeed: GasSpeedTier;
  setGasSpeed: (tier: GasSpeedTier) => void;
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

  // Advanced features state
  const [customTokens, setCustomTokens] = useState<TokenConfig[]>([]);
  const [contacts, setContacts] = useState<AddressBookContact[]>([]);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [activeAccountIndex, setActiveAccountIndex] = useState<number>(0);
  const [gasSpeed, setGasSpeed] = useState<GasSpeedTier>('standard');

  const isFetchingRef = useRef<boolean>(false);

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
        const storedTokens = await storageService.getCustomTokens();
        const storedContacts = await storageService.getContacts();
        const activeIdx = await storageService.getActiveAccountIndex();

        if (isMounted) {
          setNetworkState(getNetwork(storedNetworkId));
          setCurrencyPreferenceState(storedCurr);
          setTransactions(storedTxs);
          setMarketPrices(initialPrices);
          setCustomTokens(storedTokens);
          setContacts(storedContacts);
          setActiveAccountIndex(activeIdx);
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

  // Update address and accounts list when auth state changes
  useEffect(() => {
    let isMounted = true;
    async function syncAddress() {
      if (hasWallet) {
        const currentAddr = await walletService.getAddress();
        const accountList = await walletService.listAccounts();
        const activeIdx = await storageService.getActiveAccountIndex();
        if (isMounted) {
          setAddress(currentAddr);
          setAccounts(accountList);
          setActiveAccountIndex(activeIdx);
        }
      } else {
        if (isMounted) {
          setAddress(null);
          setEthBalance(null);
          setTokenBalances([]);
          setAccounts([]);
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
      if (isFetchingRef.current) {
        return;
      }

      const activeAddr = await walletService.getAddress();
      if (!activeAddr) {
        return;
      }

      isFetchingRef.current = true;
      if (!silent) {
        setIsLoadingBalances(true);
      }
      setIsRefreshing(true);
      setNetworkError(null);

      try {
        const prices = await priceService.fetchMarketPrices(silent);
        setMarketPrices(prices);

        const { ethBalance: ethBal, tokenBalances: tBalances } =
          await cryptoService.getAllBalances(activeAddr, network.id, prices);

        setEthBalance(ethBal);
        setTokenBalances(tBalances);

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
        isFetchingRef.current = false;
      }
    },
    [network.id],
  );

  useEffect(() => {
    if (address) {
      refreshBalances(false);
    }
  }, [address, network.id, refreshBalances]);

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
      refreshBalances(true);
    },
    [refreshBalances],
  );

  const setNetwork = useCallback(async (networkId: NetworkId) => {
    await storageService.saveNetworkId(networkId);
    setNetworkState(getNetwork(networkId));
  }, []);

  const setCurrencyPreference = useCallback(async (curr: CurrencyPreference) => {
    await storageService.saveCurrencyPreference(curr);
    setCurrencyPreferenceState(curr);
  }, []);

  // Custom Token Actions
  const addCustomToken = useCallback(
    async (token: TokenConfig) => {
      await tokenService.importToken(token);
      const updated = await storageService.getCustomTokens();
      setCustomTokens(updated);
      refreshBalances(true);
    },
    [refreshBalances],
  );

  const removeCustomToken = useCallback(
    async (contractAddress: string) => {
      await tokenService.removeCustomToken(contractAddress, network.id);
      const updated = await storageService.getCustomTokens();
      setCustomTokens(updated);
      refreshBalances(true);
    },
    [network.id, refreshBalances],
  );

  // Address Book Actions
  const addContact = useCallback(async (contact: AddressBookContact) => {
    await storageService.saveContact(contact);
    const updated = await storageService.getContacts();
    setContacts(updated);
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    await storageService.deleteContact(id);
    const updated = await storageService.getContacts();
    setContacts(updated);
  }, []);

  // Multi-Account Actions
  const switchAccount = useCallback(
    async (index: number) => {
      await walletService.switchAccount(index);
      const newAddr = await walletService.getAddress();
      const updatedAccounts = await walletService.listAccounts();
      setActiveAccountIndex(index);
      setAddress(newAddr);
      setAccounts(updatedAccounts);
      refreshBalances(false);
    },
    [refreshBalances],
  );

  const createNewAccount = useCallback(async (): Promise<WalletAccount> => {
    const newAcc = await walletService.createNewAccount();
    const updatedAccounts = await walletService.listAccounts();
    const newIdx = newAcc.index;
    setActiveAccountIndex(newIdx);
    setAddress(newAcc.address);
    setAccounts(updatedAccounts);
    refreshBalances(false);
    return newAcc;
  }, [refreshBalances]);

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
        customTokens,
        addCustomToken,
        removeCustomToken,
        contacts,
        addContact,
        deleteContact,
        accounts,
        activeAccountIndex,
        switchAccount,
        createNewAccount,
        gasSpeed,
        setGasSpeed,
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