# TRITO Wallet — System Architecture & Workflow

## High-Level Architecture
- **Presentation Layer**: `app/(tabs)/index.tsx`, `swap.tsx`, `market.tsx`, `send.tsx`, `receive.tsx`, `settings.tsx`
- **Context & State**: `WalletContext.tsx`, `AuthContext.tsx`, `ThemeContext.tsx`
- **Services**: `cryptoService.ts`, `transakService.ts`, `priceService.ts`, `swapService.ts`, `zeroExService.ts`, `walletService.ts`, `storageService.ts`
- **Security**: Hardware keychain storage via `expo-secure-store`, JIT decryption, 5-minute memory zeroization.
