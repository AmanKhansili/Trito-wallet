# TRITO Wallet — Changes & Production Audit Log

## 1. Executive Summary
This document outlines the architectural enhancements, bug fixes, and feature additions applied to the TRITO non-custodial mobile crypto wallet.

---

## 2. Key Enhancements & Fixes

### A. Bottom Navigation Bar Refactoring (Clean 4 Tabs)
- Reduced bottom tabs to 4 primary tabs: `Wallet`, `Swap`, `Market`, and `Settings`.
- Set `options={{ href: null }}` on `send` and `receive` in `app/(tabs)/_layout.tsx` to hide them from the tab bar while maintaining active navigable routes (`/(tabs)/send` and `/(tabs)/receive`).

### B. Swap Screen Integration (Send & Receive Options)
- Integrated a Quick Action Selector at the top of `app/(tabs)/swap.tsx`.
- `[ Send ]`: Immediately navigates to the dedicated Send screen (`router.push("/(tabs)/send")`).
- `[ Receive ]`: Instantly opens a QR Code modal right on the Swap screen with SVG QR code, truncated address, copy button, and "Full Screen" shortcut.
- `Main Screen`: The remainder of the screen remains the primary Swap interface with live quotes, Uniswap V3/0x providers, slippage controls, and review modal.

### C. Sepolia Testnet Balance Disappearance Fix
- Decoupled CoinGecko price fetching into an isolated try/catch block. Balance fetching now executes independently.
- Replaced dead RPC endpoints with 6 reliable public Sepolia RPCs:
  - `https://ethereum-sepolia-rpc.publicnode.com`
  - `https://1rpc.io/sepolia`
  - `https://sepolia.gateway.tenderly.co`
  - `https://sepolia.drpc.org`
  - `https://endpoints.omniatech.io/v1/eth/sepolia/public`
  - `https://rpc.ankr.com/eth_sepolia`
- Built `executeWithRpcFailover` that sequentially tries healthy nodes upon any network timeout or HTTP 429 error.

### D. Market Tab & Price Chart Fix
- Implemented `fetchMarketChart(coingeckoId, timeframe, unitPrice, change24h)` in `src/services/priceService.ts`.
- Queries CoinGecko API for real historical candlestick points with smooth fallback curves if rate-limited.
- Added Transak order types in `src/types/index.ts` and order storage methods in `src/services/storageService.ts`.
