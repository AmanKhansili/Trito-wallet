# TRITO Wallet — User Guide & Technical Explanation

## 1. Overview for Non-Technical Users (आसान भाषा में)
TRITO ek non-custodial crypto wallet hai. Iska matlab aapke private keys aur recovery phrase aapke phone ke hardware keychain me encrypted rehte hain.

---

## 2. Navigating the New Tab Structure

### Bottom Navigation Bar (4 Tabs)
1. **Wallet (Home)**:
   - Aapka total portfolio balance (USD / INR).
   - Quick action buttons (Send, Receive, Swap, Buy/Sell).
   - Token balances list (ETH, USDC, USDT, DAI, LINK).
2. **Swap**:
   - Primary interface for exchanging tokens (e.g. ETH to USDC).
   - Top Quick Action Bar:
     - `[ Send ]`: Nayi screen kholega token transfer karne ke liye.
     - `[ Receive ]`: Instant QR Code pop-up dikhayega jisse koi bhi aapko crypto bhej sake.
3. **Market (Buy / Sell)**:
   - Real-time price chart (1D, 1W, 1M, 1Y).
   - Instant Buy (UPI / Debit & Credit Card via Transak gateway).
   - Instant Sell (Crypto to Bank account off-ramp).
4. **Settings**:
   - Network switch (Mainnet vs Sepolia testnet).
   - Currency toggle (USD vs INR).
   - Security options (PIN, Biometrics, Backup Recovery Phrase).

---

## 3. How to Run the App (Project Run Kaise Karein)
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Expo**:
   ```bash
   npx expo start -c
   ```
