import { MarketPricesMap, MarketPrice } from '../types';
import { storageService } from './storageService';
import { logger } from '../utils/logger';

// Default fallback prices if network is completely offline on first launch (used only as non-zero initial baseline until first fetch)
const DEFAULT_INITIAL_PRICES: MarketPricesMap = {
  ethereum: { usd: 3000, inr: 250000, usd24hChange: 0 },
  'usd-coin': { usd: 1.0, inr: 83.5, usd24hChange: 0 },
  tether: { usd: 1.0, inr: 83.5, usd24hChange: 0 },
  dai: { usd: 1.0, inr: 83.5, usd24hChange: 0 },
  chainlink: { usd: 15.0, inr: 1250, usd24hChange: 0 },
};

let inMemoryPrices: MarketPricesMap = { ...DEFAULT_INITIAL_PRICES };
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute throttle to avoid rate-limiting

export const priceService = {
  /**
   * Fetches latest USD and INR prices from CoinGecko API.
   * Caches in memory and AsyncStorage.
   * If API fails (e.g. rate limit, offline), gracefully falls back to cached prices.
   */
  async fetchMarketPrices(force: boolean = false): Promise<MarketPricesMap> {
    const now = Date.now();
    if (!force && now - lastFetchTime < CACHE_TTL_MS && Object.keys(inMemoryPrices).length > 0) {
      return inMemoryPrices;
    }

    try {
      // Load cached from disk if available
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
            inr: val.inr || val.usd * 83.5,
            usd24hChange: val.usd_24h_change ?? 0,
          };
        }
      }

      inMemoryPrices = updatedMap;
      lastFetchTime = now;
      await storageService.saveCachedPrices(updatedMap);
      logger.info('Market prices updated from CoinGecko.');
      return inMemoryPrices;
    } catch (err) {
      logger.warn('Failed to fetch live market prices, keeping last known:', err);
      return inMemoryPrices;
    }
  },

  getCachedPrices(): MarketPricesMap {
    return inMemoryPrices;
  },

  getPriceForToken(coingeckoId: string): MarketPrice | undefined {
    return inMemoryPrices[coingeckoId];
  },
};
