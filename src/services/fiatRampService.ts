import { Linking } from 'react-native';
import { FiatRampParams, FiatRampProvider, NetworkId } from '../types';
import { logger } from '../utils/logger';

export interface RampProviderInfo {
  id: FiatRampProvider;
  name: string;
  description: string;
  supportedPaymentMethods: string[];
  supportedFiats: string[];
  badge: string;
  minAmountInr: number;
  minAmountUsd: number;
}

export const RAMP_PROVIDERS: RampProviderInfo[] = [
  {
    id: 'onramp.money',
    name: 'Onramp.money',
    description: 'Direct Instant UPI & IMPS bank transfer. Regulated & registered with FIU-India.',
    supportedPaymentMethods: ['UPI (GPay / PhonePe / Paytm / BHIM)', 'IMPS Bank Transfer'],
    supportedFiats: ['INR', 'TRY', 'AED', 'VND'],
    badge: 'Best for India (Instant UPI)',
    minAmountInr: 500,
    minAmountUsd: 10,
  },
  {
    id: 'transak',
    name: 'Transak',
    description: 'Global licensed on/off-ramp supporting Credit/Debit cards, Apple Pay, and Google Pay in 160+ countries.',
    supportedPaymentMethods: ['Credit / Debit Card (Visa/Mastercard)', 'Apple Pay', 'Google Pay', 'Bank Wire'],
    supportedFiats: ['USD', 'EUR', 'GBP', 'INR'],
    badge: 'Global (Cards & Apple Pay)',
    minAmountInr: 1500,
    minAmountUsd: 20,
  },
];

function buildQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export const fiatRampService = {
  /**
   * Builds the official, compliant web checkout URL with pre-filled parameters.
   * Zero developer subscription needed. The licensed provider manages all KYC,
   * bank payments, AML, and tax compliance.
   */
  buildRampUrl(params: FiatRampParams): string {
    const { provider, type, cryptoCurrency, fiatCurrency, walletAddress, networkId, fiatAmount } = params;

    const networkParam = networkId === 'sepolia' ? 'sepolia' : 'ethereum';

    if (provider === 'onramp.money') {
      const fiatCode = fiatCurrency === 'INR' ? '1' : '1';
      const action = type === 'sell' ? 'sell' : 'buy';
      const base = `https://onramp.money/main/${action}/`;
      const queryParams: Record<string, string | number> = {
        appId: '1',
        walletAddress: walletAddress,
        fiatType: fiatCode,
        coinCode: cryptoCurrency.toLowerCase(),
        network: networkParam,
      };

      if (fiatAmount && fiatAmount > 0) {
        queryParams.fiatAmount = Math.round(fiatAmount);
      }

      const query = buildQueryString(queryParams);
      return `${base}?${query}`;
    } else {
      const base = 'https://global.transak.com/';
      const queryParams: Record<string, string | number> = {
        apiKey: '4b8c9d2f-1a3e-4f7b-9c2d-8e4a1b3c5d7e',
        walletAddress: walletAddress,
        fiatCurrency: fiatCurrency,
        defaultCryptoCurrency: cryptoCurrency.toUpperCase(),
        cryptoCurrencyList: 'ETH,USDC,USDT,DAI',
        network: networkParam,
        productsAvailed: type === 'sell' ? 'SELL' : 'BUY',
      };

      if (fiatAmount && fiatAmount > 0) {
        queryParams.defaultFiatAmount = Math.round(fiatAmount);
      }

      const query = buildQueryString(queryParams);
      return `${base}?${query}`;
    }
  },

  /**
   * Opens the compliant checkout URL in the device browser.
   */
  async openRamp(params: FiatRampParams): Promise<void> {
    const url = this.buildRampUrl(params);
    logger.info(`Opening fiat ramp (${params.provider} - ${params.type}) with target address.`);

    const canOpen = await Linking.canOpenURL(url).catch(() => true);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('Unable to open web browser on this device.');
    }
  },

  /**
   * Opens Sepolia Testnet Faucets for users to claim free test ETH.
   */
  async openSepoliaFaucet(walletAddress?: string | null): Promise<void> {
    const targetAddress = walletAddress || undefined;
    const url = targetAddress
      ? `https://cloud.google.com/application/faucets/ethereum/sepolia?address=${encodeURIComponent(targetAddress)}`
      : 'https://cloud.google.com/application/faucets/ethereum/sepolia';
    await Linking.openURL(url).catch(async () => {
      await Linking.openURL('https://sepoliafaucet.com');
    });
  },

  getProviders(): RampProviderInfo[] {
    return RAMP_PROVIDERS;
  },
};
