import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarketPricesMap, MarketPrice, MarketItem } from '../types';
import { storageService } from './storageService';
import { logger } from '../utils/logger';

const STORAGE_MARKET_LIST = 'trito_cached_market_list';

// Default fallback prices for wallet portfolio
const DEFAULT_INITIAL_PRICES: MarketPricesMap = {
  ethereum: { usd: 3000, inr: 252000, usd24hChange: 0 },
  'usd-coin': { usd: 1.0, inr: 84.0, usd24hChange: 0 },
  tether: { usd: 1.0, inr: 84.0, usd24hChange: 0 },
  dai: { usd: 1.0, inr: 84.0, usd24hChange: 0 },
  chainlink: { usd: 15.0, inr: 1260, usd24hChange: 0 },
};

// Rich baseline top cryptocurrencies for Market tab (instant load, works offline)
const DEFAULT_MARKET_ITEMS: MarketItem[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPriceUsd: 64250,
    currentPriceInr: 5397000,
    priceChangePercentage24h: 2.45,
    marketCapUsd: 1265000000000,
    totalVolumeUsd: 28400000000,
    high24hUsd: 65100,
    low24hUsd: 63200,
    marketCapRank: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    currentPriceUsd: 2650,
    currentPriceInr: 222600,
    priceChangePercentage24h: 3.12,
    marketCapUsd: 318000000000,
    totalVolumeUsd: 15200000000,
    high24hUsd: 2690,
    low24hUsd: 2570,
    marketCapRank: 2,
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    currentPriceUsd: 154.2,
    currentPriceInr: 12952,
    priceChangePercentage24h: 5.64,
    marketCapUsd: 72100000000,
    totalVolumeUsd: 3800000000,
    high24hUsd: 158.0,
    low24hUsd: 146.5,
    marketCapRank: 3,
  },
  {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'BNB',
    currentPriceUsd: 585.4,
    currentPriceInr: 49173,
    priceChangePercentage24h: 1.15,
    marketCapUsd: 85400000000,
    totalVolumeUsd: 950000000,
    high24hUsd: 592.0,
    low24hUsd: 578.0,
    marketCapRank: 4,
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    currentPriceUsd: 0.542,
    currentPriceInr: 45.52,
    priceChangePercentage24h: -0.84,
    marketCapUsd: 30600000000,
    totalVolumeUsd: 820000000,
    high24hUsd: 0.555,
    low24hUsd: 0.536,
    marketCapRank: 5,
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    currentPriceUsd: 0.114,
    currentPriceInr: 9.57,
    priceChangePercentage24h: 4.21,
    marketCapUsd: 16600000000,
    totalVolumeUsd: 740000000,
    high24hUsd: 0.118,
    low24hUsd: 0.108,
    marketCapRank: 6,
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    currentPriceUsd: 0.354,
    currentPriceInr: 29.73,
    priceChangePercentage24h: 1.82,
    marketCapUsd: 12700000000,
    totalVolumeUsd: 260000000,
    high24hUsd: 0.362,
    low24hUsd: 0.346,
    marketCapRank: 7,
  },
  {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    currentPriceUsd: 28.45,
    currentPriceInr: 2389,
    priceChangePercentage24h: -1.45,
    marketCapUsd: 11500000000,
    totalVolumeUsd: 310000000,
    high24hUsd: 29.8,
    low24hUsd: 27.9,
    marketCapRank: 8,
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    currentPriceUsd: 11.85,
    currentPriceInr: 995,
    priceChangePercentage24h: 2.15,
    marketCapUsd: 7200000000,
    totalVolumeUsd: 240000000,
    high24hUsd: 12.2,
    low24hUsd: 11.5,
    marketCapRank: 9,
  },
  {
    id: 'sui',
    symbol: 'SUI',
    name: 'Sui',
    currentPriceUsd: 2.14,
    currentPriceInr: 179.7,
    priceChangePercentage24h: 8.75,
    marketCapUsd: 5900000000,
    totalVolumeUsd: 850000000,
    high24hUsd: 2.22,
    low24hUsd: 1.95,
    marketCapRank: 10,
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    currentPriceUsd: 7.82,
    currentPriceInr: 656.8,
    priceChangePercentage24h: -2.10,
    marketCapUsd: 4700000000,
    totalVolumeUsd: 160000000,
    high24hUsd: 8.15,
    low24hUsd: 7.70,
    marketCapRank: 11,
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    currentPriceUsd: 1.0,
    currentPriceInr: 84.0,
    priceChangePercentage24h: 0.01,
    marketCapUsd: 35000000000,
    totalVolumeUsd: 5800000000,
    high24hUsd: 1.001,
    low24hUsd: 0.999,
    marketCapRank: 12,
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether USD',
    currentPriceUsd: 1.0,
    currentPriceInr: 84.0,
    priceChangePercentage24h: 0.02,
    marketCapUsd: 119000000000,
    totalVolumeUsd: 4200000000,
    high24hUsd: 1.002,
    low24hUsd: 0.998,
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
   * Fetches latest USD and INR prices from CoinGecko API for wallet portfolio.
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

      const coinIds = ['ethereum', 'usd-coin', 'tether', 'dai', 'chainlink'].join(',');
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

      for (const [id, values] of Object.entries(data)) {
        const val = values as { usd?: number; inr?: number; usd_24h_change?: number };
        if (val && typeof val.usd === 'number') {
          updatedMap[id] = {
            usd: val.usd,
            inr: val.inr || val.usd * 84.0,
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
   * Free public endpoint, cached in memory & AsyncStorage.
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
        const mapped: MarketItem[] = data.map((item: any) => ({
          id: item.id,
          symbol: (item.symbol || '').toUpperCase(),
          name: item.name || item.symbol,
          image: item.image,
          currentPriceUsd: Number(item.current_price) || 0,
          currentPriceInr: (Number(item.current_price) || 0) * 84.0,
          priceChangePercentage24h: Number(item.price_change_percentage_24h) || 0,
          marketCapUsd: Number(item.market_cap) || 0,
          totalVolumeUsd: Number(item.total_volume) || 0,
          high24hUsd: Number(item.high_24h) || 0,
          low24hUsd: Number(item.low_24h) || 0,
          marketCapRank: Number(item.market_cap_rank) || 0,
        }));

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
   * Generates smooth realistic trend points if offline or rate-limited.
   */
  async fetchMarketChart(
    coinId: string = 'ethereum',
    timeframe: string = '1D',
    unitPrice?: number,
  ): Promise<number[]> {
    const daysMap: Record<string, string> = {
      '1D': '1',
      '1W': '7',
      '1M': '30',
      '1Y': '365',
    };
    const days = daysMap[timeframe] || '1';

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId || 'ethereum'}/market_chart?vs_currency=usd&days=${days}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.prices && Array.isArray(data.prices)) {
          const step = Math.max(1, Math.floor(data.prices.length / 25));
          const sampled = data.prices
            .filter((_: any, idx: number) => idx % step === 0)
            .map((p: any) => Number(p[1]));
          if (sampled.length > 5) return sampled;
        }
      }
    } catch {
      // Fallback
    }

    // High quality fallback curve so chart always renders smoothly without crashing
    const base = unitPrice && unitPrice > 0 ? unitPrice : 2650;
    const pointsCount = 20;
    const curve: number[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const variation = Math.sin(angle) * 0.025 + Math.cos(angle * 2) * 0.015;
      curve.push(base * (1 + variation));
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
