# TRITO - Production-Ready Mobile Cryptocurrency Wallet

TRITO is a non-custodial Ethereum cryptocurrency wallet built with **React Native**, **Expo**, **TypeScript**, and **ethers.js v6**. 

TRITO gives users sovereign custody of their crypto assets with hardware-grade security, local cryptographic transaction signing, live blockchain state synchronization, and native **Uniswap V3** on-chain swapping.

---

## 🌟 Key Architecture & Capabilities

- **Zero Mock / 100% Real Blockchain**: All account balances, gas estimates, and transactions interact with the Ethereum blockchain via JSON-RPC providers.
- **True Non-Custodial Security**:
  - Private keys and 12-word BIP-39 recovery phrases are generated locally using cryptographic entropy.
  - Sensitive data is stored strictly in device hardware-backed **SecureStore** (iOS Keychain / Android KeyStore).
  - Private keys and seed phrases are **never** logged, never transmitted to any server or cloud API, and never stored in unencrypted storage (`AsyncStorage`).
  - Decrypted keys exist ephemerally in memory only while the wallet is unlocked.
- **Dual Network Support**:
  - **Ethereum Sepolia Testnet** (`Chain ID: 11155111`) for zero-risk test development and verification.
  - **Ethereum Mainnet** (`Chain ID: 1`) production-ready configuration.
- **Strict Token Decimals & BigInt Arithmetic**:
  - Native ETH handled with 18 decimals.
  - ERC20 tokens (e.g. USDC with 6 decimals, USDT with 6 decimals, DAI with 18 decimals, LINK with 18 decimals) use precise integer `bigint` arithmetic to prevent floating-point rounding errors.
- **Uniswap V3 On-Chain Swapping Engine**:
  - Real on-chain quotes via `QuoterV2`.
  - Discovers pools across fee tiers (0.05%, 0.3%, 1.0%).
  - Configurable slippage tolerance (0.1%, 0.5%, 1.0%).
  - Automated ERC20 allowance checking and approval flow.
  - Internal WETH wrapping/unwrapping via `multicall` (`SwapRouter02`).
  - Extreme market deviation guard (> 30% price impact blocks execution).
- **Multi-Factor Device Security**:
  - 6-digit master PIN.
  - Biometric unlock (Face ID / Fingerprint) via `expo-local-authentication`.
  - Automatic timeout lock and app backgrounding lock.
  - Security gates before viewing seed phrases or exporting private keys.
- **Fintech UI / UX**:
  - Dark and Light mode support.
  - Vector QR Code generation for receiving assets.
  - Pull-to-refresh live balance queries.
  - Dual currency valuation (USD & INR).
  - Transaction history with Etherscan block explorer deep links.

---

## 📁 Project Structure

```
trito-wallet/
├── app/                                 # Expo Router Screen Directory
│   ├── _layout.tsx                      # Root layout with Auth & Wallet providers
│   ├── (auth)/                          # Authentication & Onboarding stack
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx                  # Premium landing screen
│   │   ├── create-wallet.tsx            # Master PIN setup
│   │   ├── recovery-phrase.tsx          # 12-word seed phrase backup
│   │   ├── verify-recovery.tsx          # Seed phrase verification test
│   │   ├── import-wallet.tsx            # Import via seed phrase or private key
│   │   └── unlock.tsx                   # PIN and Biometric unlock screen
│   ├── (tabs)/                          # Main application tabs
│   │   ├── _layout.tsx                  # Tab bar configuration & navigation
│   │   ├── index.tsx                    # Portfolio Dashboard & Asset list
│   │   ├── send.tsx                     # Native ETH & ERC20 Send interface
│   │   ├── receive.tsx                  # QR code & address sharing
│   │   ├── swap.tsx                     # Uniswap V3 on-chain swapping
│   │   └── settings.tsx                 # Network, Security, & Danger zone
│   ├── transaction/
│   │   └── details.tsx                  # Transaction confirmation & status view
│   └── wallet/
│       ├── backup.tsx                   # PIN-gated seed phrase backup
│       └── export.tsx                   # PIN-gated private key export
├── src/
│   ├── config/
│   │   ├── networks.ts                  # Sepolia and Mainnet configurations
│   │   ├── tokens.ts                    # Token registry (ETH, USDC, USDT, DAI, LINK)
│   │   └── uniswap.ts                   # Uniswap V3 contracts and ABIs
│   ├── constants/
│   │   └── theme.ts                     # Colors, typography, spacing, radii
│   ├── context/
│   │   ├── AuthContext.tsx              # Auth state, PIN, biometrics, auto-lock
│   │   ├── WalletContext.tsx            # Balances, network state, transactions
│   │   └── ThemeContext.tsx             # Dark / Light theme switcher
│   ├── services/
│   │   ├── storageService.ts            # SecureStore & AsyncStorage wrapper
│   │   ├── walletService.ts             # Cryptographic key derivation & signing
│   │   ├── cryptoService.ts             # RPC provider & balance queries
│   │   ├── priceService.ts              # CoinGecko market rates & caching
│   │   ├── transactionService.ts        # Send ETH and ERC20 transfer execution
│   │   └── swapService.ts               # Uniswap V3 QuoterV2 and SwapRouter02
│   ├── utils/
│   │   ├── formatters.ts                # BigInt token & fiat formatters
│   │   ├── validation.ts                # Address, mnemonic, and slippage checks
│   │   ├── errorHandler.ts              # User-friendly blockchain error mapping
│   │   ├── logger.ts                    # Sanitized secure logger
│   │   └── qrCode.ts                    # Standalone QR Code matrix generator
│   ├── components/
│   │   ├── ScreenWrapper.tsx
│   │   ├── Header.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── AssetCard.tsx
│   │   ├── NetworkBadge.tsx
│   │   ├── TransactionItem.tsx
│   │   ├── PinPad.tsx
│   │   ├── QRCodeDisplay.tsx
│   │   ├── ConfirmModal.tsx
│   │   └── Toast.tsx
│   └── types/
│       └── index.ts                     # Strict TypeScript interfaces
├── tests/                               # Comprehensive Automated Test Suite
│   ├── formatters.test.mjs              # BigInt decimal conversions
│   ├── validation.test.mjs              # Address and key validation
│   ├── errorHandler.test.mjs            # Revert string translations
│   └── swapLogic.test.mjs               # Slippage & abnormal quote rejection
├── app.json                             # Expo application configuration
├── package.json                         # Dependencies and npm scripts
├── tsconfig.json                        # TypeScript strict configuration
└── .env.example                         # Environment variable template
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```bash
# Ethereum Sepolia Testnet RPC URL
EXPO_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Ethereum Mainnet RPC URL
EXPO_PUBLIC_MAINNET_RPC_URL=https://eth.llamarpc.com

# CoinGecko API Key (optional for higher rate limits)
EXPO_PUBLIC_COINGECKO_API_KEY=
```

---

## 🚀 Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Expo development server:
   ```bash
   npx expo start
   ```

3. Run on iOS Simulator:
   ```bash
   npx expo start --ios
   ```

4. Run on Android Emulator:
   ```bash
   npx expo start --android
   ```

---

## 🧪 Automated Testing

Run the automated test suite verifying decimal precision, address validation, error translation, and slippage mathematics:

```bash
npm test
```

All 15 unit tests validate:
- Native ETH 18 decimal parsing and formatting
- USDC 6 decimal integer scaling
- Address format validation
- Mnemonic word-count verification
- Private key structure verification
- Native ETH balance + gas validation
- ERC20 transfer balance + gas validation
- Slippage calculation (`amountOutMinimum`)
- Uniswap STF and slippage error translation
- Abnormal quote protection (> 30% price impact rejection)
#   T r i t o - w a l l e t  
 