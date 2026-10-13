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
}

export const RAMP_PROVIDERS: RampProviderInfo[] = [
  {
    id: 'onramp.money',
    name: 'Onramp.money',
    description: 'Direct Instant UPI & IMPS bank transfer. Regulated & registered with FIU-India.',
    supportedPaymentMethods: ['UPI (GPay / PhonePe / Paytm)', 'IMPS', 'Bank Transfer'],
    supportedFiats: ['INR', 'TRY', 'AED', 'VND'],
    badge: 'Best for India (UPI)',
  },
  {
    id: 'transak',
    name: 'Transak',
    description: 'Global licensed on/off-ramp supporting Credit/Debit cards, Apple Pay, and Google Pay in 160+ countries.',
    supportedPaymentMethods: ['Credit / Debit Card', 'Apple Pay', 'Google Pay', 'Bank Wire'],
    supportedFiats: ['USD', 'EUR', 'GBP', 'INR'],
    badge: 'Global (Cards & Apple Pay)',
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
    const { provider, type, cryptoCurrency, fiatCurrency, walletAddress, networkId } = params;

    const networkParam = networkId === 'sepolia' ? 'sepolia' : 'ethereum';

    if (provider === 'onramp.money') {
      const fiatCode = fiatCurrency === 'INR' ? '1' : '1';
      const action = type === 'sell' ? 'sell' : 'buy';
      const base = `https://onramp.money/main/${action}/`;
      const query = buildQueryString({
        appId: '1',
        walletAddress: walletAddress,
        fiatType: fiatCode,
        coinCode: cryptoCurrency.toLowerCase(),
        network: networkParam,
      });

      return `${base}?${query}`;
    } else {
      const base = 'https://global.transak.com/';
      const query = buildQueryString({
        apiKey: '4b8c9d2f-1a3e-4f7b-9c2d-8e4a1b3c5d7e',
        walletAddress: walletAddress,
        fiatCurrency: fiatCurrency,
        defaultCryptoCurrency: cryptoCurrency.toUpperCase(),
        cryptoCurrencyList: 'ETH,USDC,USDT,DAI',
        network: networkParam,
        productsAvailed: type === 'sell' ? 'SELL' : 'BUY',
      });

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

  getProviders(): RampProviderInfo[] {
    return RAMP_PROVIDERS;
  },
};
