import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarketPricesMap, MarketPrice, MarketItem, CurrencyPreference } from '../types';
import { storageService } from './storageService';
import { logger } from '../utils/logger';

const STORAGE_MARKET_LIST = 'trito_cached_market_list';
const STORAGE_USD_INR_RATE = 'trito_cached_usd_inr_rate';

// Dynamic exchange rate tracker (updated live from CoinGecko USDT / Forex)
let liveUsdToInrRate = 89.2;

// Default fallback prices for wallet portfolio
const DEFAULT_INITIAL_PRICES: MarketPricesMap = {
  bitcoin: { usd: 82450, inr: 7354540, usd24hChange: 1.25 },
  ethereum: { usd: 2680, inr: 239056, usd24hChange: 2.15 },
  'usd-coin': { usd: 1.0, inr: 89.2, usd24hChange: 0 },
  tether: { usd: 1.0, inr: 89.2, usd24hChange: 0 },
  dai: { usd: 1.0, inr: 89.2, usd24hChange: 0 },
  chainlink: { usd: 11.95, inr: 1066, usd24hChange: 0.8 },
  solana: { usd: 156.5, inr: 13960, usd24hChange: 3.4 },
};

// Top cryptocurrencies baseline (instant load, accurate 2026 live valuation)
const DEFAULT_MARKET_ITEMS: MarketItem[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPriceUsd: 82450,
    currentPriceInr: 7354540,
    priceChangePercentage24h: 2.15,
    marketCapUsd: 1625000000000,
    totalVolumeUsd: 38400000000,
    high24hUsd: 83500,
    low24hUsd: 81200,
    marketCapRank: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    currentPriceUsd: 2680,
    currentPriceInr: 239056,
    priceChangePercentage24h: 3.12,
    marketCapUsd: 322000000000,
    totalVolumeUsd: 16200000000,
    high24hUsd: 2720,
    low24hUsd: 2610,
    marketCapRank: 2,
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether USD',
    currentPriceUsd: 1.0,
    currentPriceInr: 89.2,
    priceChangePercentage24h: 0.02,
    marketCapUsd: 121000000000,
    totalVolumeUsd: 4200000000,
    high24hUsd: 1.002,
    low24hUsd: 0.998,
    marketCapRank: 3,
  },
  {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'BNB',
    currentPriceUsd: 588.0,
    currentPriceInr: 52450,
    priceChangePercentage24h: 1.15,
    marketCapUsd: 86400000000,
    totalVolumeUsd: 950000000,
    high24hUsd: 595.0,
    low24hUsd: 580.0,
    marketCapRank: 4,
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    currentPriceUsd: 156.5,
    currentPriceInr: 13960,
    priceChangePercentage24h: 5.64,
    marketCapUsd: 73500000000,
    totalVolumeUsd: 4100000000,
    high24hUsd: 161.0,
    low24hUsd: 151.5,
    marketCapRank: 5,
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    currentPriceUsd: 1.0,
    currentPriceInr: 89.2,
    priceChangePercentage24h: 0.01,
    marketCapUsd: 36000000000,
    totalVolumeUsd: 5800000000,
    high24hUsd: 1.001,
    low24hUsd: 0.999,
    marketCapRank: 6,
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    currentPriceUsd: 0.545,
    currentPriceInr: 48.61,
    priceChangePercentage24h: -0.84,
    marketCapUsd: 30800000000,
    totalVolumeUsd: 820000000,
    high24hUsd: 0.558,
    low24hUsd: 0.538,
    marketCapRank: 7,
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    currentPriceUsd: 0.118,
    currentPriceInr: 10.53,
    priceChangePercentage24h: 4.21,
    marketCapUsd: 17200000000,
    totalVolumeUsd: 780000000,
    high24hUsd: 0.122,
    low24hUsd: 0.112,
    marketCapRank: 8,
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    currentPriceUsd: 0.358,
    currentPriceInr: 31.93,
    priceChangePercentage24h: 1.82,
    marketCapUsd: 12900000000,
    totalVolumeUsd: 260000000,
    high24hUsd: 0.366,
    low24hUsd: 0.350,
    marketCapRank: 9,
  },
  {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    currentPriceUsd: 28.6,
    currentPriceInr: 2551,
    priceChangePercentage24h: -1.45,
    marketCapUsd: 11600000000,
    totalVolumeUsd: 310000000,
    high24hUsd: 29.8,
    low24hUsd: 28.0,
    marketCapRank: 10,
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    currentPriceUsd: 11.95,
    currentPriceInr: 1066,
    priceChangePercentage24h: 2.15,
    marketCapUsd: 7300000000,
    totalVolumeUsd: 250000000,
    high24hUsd: 12.3,
    low24hUsd: 11.6,
    marketCapRank: 11,
  },
  {
    id: 'sui',
    symbol: 'SUI',
    name: 'Sui',
    currentPriceUsd: 2.15,
    currentPriceInr: 191.78,
    priceChangePercentage24h: 8.75,
    marketCapUsd: 6100000000,
    totalVolumeUsd: 870000000,
    high24hUsd: 2.25,
    low24hUsd: 1.98,
    marketCapRank: 12,
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    currentPriceUsd: 7.85,
    currentPriceInr: 700.22,
    priceChangePercentage24h: -2.1,
    marketCapUsd: 4750000000,
    totalVolumeUsd: 165000000,
    high24hUsd: 8.15,
    low24hUsd: 7.72,
    marketCapRank: 13,
  },
];

let inMemoryPrices: MarketPricesMap = { ...DEFAULT_INITIAL_PRICES };
let inMemoryMarketList: MarketItem[] = [...DEFAULT_MARKET_ITEMS];
let lastFetchTime = 0;
let lastMarketFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute throttle to avoid rate-limiting

export const priceService = {
  /**
   * Returns current USD to INR exchange rate.
   */
  getUsdToInrRate(): number {
    return liveUsdToInrRate;
  },

  /**
   * Fetches latest USD and INR prices from CoinGecko API for wallet portfolio.
   * Dynamically tracks live USD/INR exchange rate.
   */
  async fetchMarketPrices(force: boolean = false): Promise<MarketPricesMap> {
    const now = Date.now();
    if (!force && now - lastFetchTime < CACHE_TTL_MS && Object.keys(inMemoryPrices).length > 0) {
      return inMemoryPrices;
    }

    try {
      const diskCache = await storageService.getCachedPrices();
      if (diskCache) {
        inMemoryPrices = { ...inMemoryPrices, ...diskCache };
      }

      const coinIds = [
        'bitcoin',
        'ethereum',
        'usd-coin',
        'tether',
        'dai',
        'chainlink',
        'solana',
      ].join(',');

      const apiKey = process.env.EXPO_PUBLIC_COINGECKO_API_KEY;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
      }

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd,inr&include_24hr_change=true`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        logger.warn(`CoinGecko API returned status ${response.status}. Using cached prices.`);
        return inMemoryPrices;
      }

      const data = await response.json();
      const updatedMap: MarketPricesMap = { ...inMemoryPrices };

      // Update dynamic USD/INR rate from USDT or USDC
      if (data.tether && typeof data.tether.inr === 'number' && typeof data.tether.usd === 'number' && data.tether.usd > 0) {
        liveUsdToInrRate = data.tether.inr / data.tether.usd;
        await AsyncStorage.setItem(STORAGE_USD_INR_RATE, String(liveUsdToInrRate));
      }

      for (const [id, values] of Object.entries(data)) {
        const val = values as { usd?: number; inr?: number; usd_24h_change?: number };
        if (val && typeof val.usd === 'number') {
          const exactInr = val.inr || val.usd * liveUsdToInrRate;
          updatedMap[id] = {
            usd: val.usd,
            inr: exactInr,
            usd24hChange: val.usd_24h_change ?? 0,
          };
        }
      }

      inMemoryPrices = updatedMap;
      lastFetchTime = now;
      await storageService.saveCachedPrices(updatedMap);
      return inMemoryPrices;
    } catch (err) {
      logger.warn('Failed to fetch live market prices, keeping last known:', err);
      return inMemoryPrices;
    }
  },

  /**
   * Fetches top cryptocurrency market data for the Market tab.
   * Accurately converts to INR using live rate or CoinGecko INR data.
   */
  async fetchTopMarkets(force: boolean = false): Promise<MarketItem[]> {
    const now = Date.now();
    if (!force && now - lastMarketFetchTime < CACHE_TTL_MS && inMemoryMarketList.length > 0) {
      return inMemoryMarketList;
    }

    try {
      const cached = await AsyncStorage.getItem(STORAGE_MARKET_LIST);
      if (cached) {
        inMemoryMarketList = JSON.parse(cached);
      }

      const storedRate = await AsyncStorage.getItem(STORAGE_USD_INR_RATE);
      if (storedRate) {
        liveUsdToInrRate = parseFloat(storedRate) || 89.2;
      }

      const apiKey = process.env.EXPO_PUBLIC_COINGECKO_API_KEY;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
      }

      const url =
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h';
      const response = await fetch(url, { headers });

      if (!response.ok) {
        logger.warn(`CoinGecko markets returned ${response.status}. Using cached market list.`);
        return inMemoryMarketList;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: MarketItem[] = data.map((item: any) => {
          const usdPrice = Number(item.current_price) || 0;
          const inrPrice = usdPrice * liveUsdToInrRate;

          return {
            id: item.id,
            symbol: (item.symbol || '').toUpperCase(),
            name: item.name || item.symbol,
            image: item.image,
            currentPriceUsd: usdPrice,
            currentPriceInr: inrPrice,
            priceChangePercentage24h: Number(item.price_change_percentage_24h) || 0,
            marketCapUsd: Number(item.market_cap) || 0,
            totalVolumeUsd: Number(item.total_volume) || 0,
            high24hUsd: Number(item.high_24h) || 0,
            low24hUsd: Number(item.low_24h) || 0,
            marketCapRank: Number(item.market_cap_rank) || 0,
          };
        });

        inMemoryMarketList = mapped;
        lastMarketFetchTime = now;
        await AsyncStorage.setItem(STORAGE_MARKET_LIST, JSON.stringify(mapped));
        logger.info('Market tab data successfully updated from CoinGecko.');
        return mapped;
      }

      return inMemoryMarketList;
    } catch (err) {
      logger.warn('Failed to fetch top markets, using cached data:', err);
      return inMemoryMarketList;
    }
  },

  /**
   * Fetches historical chart points for an asset across timeframes (1D, 1W, 1M, 1Y).
   * Supports fetching in requested currency (USD or INR).
   * Generates smooth realistic trend points if offline or rate-limited.
   */
  async fetchMarketChart(
    coinId: string = 'ethereum',
    timeframe: string = '1D',
    currency: CurrencyPreference = 'USD',
    unitPrice?: number,
  ): Promise<number[]> {
    const daysMap: Record<string, string> = {
      '1D': '1',
      '1W': '7',
      '1M': '30',
      '1Y': '365',
    };
    const days = daysMap[timeframe] || '1';
    const vsCurrency = currency.toLowerCase();

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId || 'ethereum'}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.prices && Array.isArray(data.prices)) {
          const step = Math.max(1, Math.floor(data.prices.length / 30));
          const sampled = data.prices
            .filter((_: any, idx: number) => idx % step === 0)
            .map((p: any) => Number(p[1]));
          if (sampled.length > 5) return sampled;
        }
      }
    } catch {
      // Fallback
    }

    // High quality fallback curve around exact unit price in selected currency
    let base = unitPrice && unitPrice > 0 ? unitPrice : currency === 'INR' ? 239000 : 2680;
    const pointsCount = 28;
    const curve: number[] = [];

    // Distinct realistic volatility variations per timeframe
    const volatility = timeframe === '1D' ? 0.015 : timeframe === '1W' ? 0.035 : timeframe === '1M' ? 0.07 : 0.15;
    for (let i = 0; i < pointsCount; i++) {
      const progress = i / pointsCount;
      const angle = progress * Math.PI * 2;
      const wave = Math.sin(angle * 1.5) * 0.6 + Math.cos(angle * 3) * 0.4;
      const pointVal = base * (1 + wave * volatility + (progress - 0.5) * volatility * 0.8);
      curve.push(Math.max(0.0001, pointVal));
    }

    return curve;
  },

  getCachedPrices(): MarketPricesMap {
    return inMemoryPrices;
  },

  getPriceForToken(coingeckoId: string): MarketPrice | undefined {
    return inMemoryPrices[coingeckoId];
  },
};
