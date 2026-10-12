import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast } from '../../src/components/Toast';
import { PriceChart, TimeframeOption } from '../../src/components/PriceChart';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { formatFiat, shortenAddress } from '../../src/utils/formatters';
import { transakService } from '../../src/services/transakService';
import { priceService } from '../../src/services/priceService';
import { storageService } from '../../src/services/storageService';
import { TransakOrderType, TransakOrderRecord, TransakQuote } from '../../src/types';

interface CryptoAssetMeta {
  symbol: string;
  name: string;
  coingeckoId: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const SUPPORTED_ASSETS: CryptoAssetMeta[] = [
  { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum', iconName: 'diamond-outline' },
  { symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin', iconName: 'cash-outline' },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    coingeckoId: 'tether',
    iconName: 'shield-checkmark-outline',
  },
  { symbol: 'DAI', name: 'Dai Stablecoin', coingeckoId: 'dai', iconName: 'layers-outline' },
  { symbol: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink', iconName: 'link-outline' },
];

const QUICK_AMOUNTS_INR = [1000, 2500, 5000, 10000];
const QUICK_AMOUNTS_USD = [30, 50, 100, 250];

export default function MarketScreen() {
  const { address, network, tokenBalances, ethBalance, marketPrices, currencyPreference } =
    useWallet();
  const { colors } = useTheme();

  const [selectedAsset, setSelectedAsset] = useState<CryptoAssetMeta>(SUPPORTED_ASSETS[0]);
  const [timeframe, setTimeframe] = useState<TimeframeOption>('1W');
  const [chartData, setChartData] = useState<number[]>([]);

  const [productType, setProductType] = useState<TransakOrderType>('BUY');
  const [fiatAmountStr, setFiatAmountStr] = useState<string>('5000');
  const [cryptoSellAmountStr, setCryptoSellAmountStr] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');

  const [liveQuote, setLiveQuote] = useState<TransakQuote | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSellConfirmModal, setShowSellConfirmModal] = useState<boolean>(false);
  const [recentOrders, setRecentOrders] = useState<TransakOrderRecord[]>([]);

  const currentTokenBalance = useMemo(() => {
    return (
      tokenBalances.find(
        (b) => b.token.symbol.toUpperCase() === selectedAsset.symbol.toUpperCase(),
      ) || null
    );
  }, [tokenBalances, selectedAsset]);

  const availableBalanceFloat = useMemo(() => {
    if (!currentTokenBalance) return 0;
    return parseFloat(currentTokenBalance.balanceFormatted) || 0;
  }, [currentTokenBalance]);

  const ethBalanceFloat = useMemo(() => {
    if (!ethBalance) return 0;
    return parseFloat(ethBalance.balanceFormatted) || 0;
  }, [ethBalance]);

  const unitPrice = useMemo(() => {
    const fromContext = marketPrices[selectedAsset.coingeckoId];
    if (fromContext && (fromContext.usd > 0 || fromContext.inr > 0)) {
      return currencyPreference === 'INR' ? fromContext.inr : fromContext.usd;
    }
    return currencyPreference === 'INR' ? 288000 : 3450;
  }, [marketPrices, selectedAsset.coingeckoId, currencyPreference]);

  const change24h = useMemo(() => {
    return marketPrices[selectedAsset.coingeckoId]?.usd24hChange ?? 2.45;
  }, [marketPrices, selectedAsset.coingeckoId]);

  const isPriceUp = change24h >= 0;

  useEffect(() => {
    let isMounted = true;
    async function loadChart() {
      const points = await priceService.fetchMarketChart(
        selectedAsset.coingeckoId,
        timeframe,
        unitPrice,
        change24h,
      );
      if (isMounted) setChartData(points);
    }
    loadChart();
    return () => {
      isMounted = false;
    };
  }, [selectedAsset.coingeckoId, timeframe, unitPrice, change24h]);

  const loadOrders = useCallback(async () => {
    const orders = await storageService.getTransakOrders();
    setRecentOrders(orders.slice(0, 5));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let isMounted = true;
    async function fetchQuote() {
      const numFiat = parseFloat(fiatAmountStr) || (currencyPreference === 'INR' ? 5000 : 60);
      try {
        const quote = await transakService.getLiveQuote(
          selectedAsset.symbol,
          currencyPreference,
          numFiat,
          productType,
          network.id,
          paymentMethod,
        );
        if (isMounted) setLiveQuote(quote);
      } catch {
        // Fallback handled
      }
    }
    const timer = setTimeout(fetchQuote, 400);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    selectedAsset.symbol,
    currencyPreference,
    fiatAmountStr,
    productType,
    network.id,
    paymentMethod,
  ]);

  const quickAmounts = currencyPreference === 'INR' ? QUICK_AMOUNTS_INR : QUICK_AMOUNTS_USD;

  const sellValidation = useMemo(() => {
    const numSell = parseFloat(cryptoSellAmountStr);
    if (!cryptoSellAmountStr || isNaN(numSell) || numSell <= 0) {
      return { isValid: false, error: 'Enter amount to sell' };
    }
    if (numSell > availableBalanceFloat) {
      return { isValid: false, error: `Insufficient ${selectedAsset.symbol} balance` };
    }
    if (ethBalanceFloat < 0.001) {
      return { isValid: false, error: 'Minimum 0.001 ETH required for on-chain gas' };
    }
    return { isValid: true, error: null };
  }, [cryptoSellAmountStr, availableBalanceFloat, ethBalanceFloat, selectedAsset.symbol]);

  const handleInitiateBuy = async () => {
    if (!address) {
      Alert.alert('Wallet Not Ready', 'Please unlock your wallet first.');
      return;
    }

    const fiatAmount = parseFloat(fiatAmountStr);
    if (isNaN(fiatAmount) || fiatAmount <= 0) {
      setToastMessage('Enter a valid fiat amount.');
      return;
    }

    const minLimit = currencyPreference === 'INR' ? 500 : 25;
    if (fiatAmount < minLimit) {
      setToastMessage(`Minimum order is ${currencyPreference === 'INR' ? '₹' : '$'}${minLimit}`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await transakService.openTransakCheckout({
        walletAddress: address,
        networkId: network.id,
        cryptoCurrency: selectedAsset.symbol,
        fiatCurrency: currencyPreference,
        fiatAmount,
        productType: 'BUY',
        paymentMethod,
      });

      await loadOrders();
      setToastMessage(
        res.isDemo ? 'Opening Transak Sandbox Demo...' : 'Opening Transak Live Gateway...',
      );
    } catch {
      Alert.alert('Gateway Error', 'Unable to launch Transak gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateSell = () => {
    if (!sellValidation.isValid) {
      Alert.alert('Validation Error', sellValidation.error || 'Cannot proceed with sell order.');
      return;
    }
    setShowSellConfirmModal(true);
  };

  const handleConfirmSell = async () => {
    setShowSellConfirmModal(false);
    setIsLoading(true);
    try {
      const amountToSell = parseFloat(cryptoSellAmountStr);
      const estFiat = amountToSell * unitPrice;

      const res = await transakService.openTransakCheckout({
        walletAddress: address || '',
        networkId: network.id,
        cryptoCurrency: selectedAsset.symbol,
        fiatCurrency: currencyPreference,
        cryptoAmount: amountToSell,
        fiatAmount: estFiat,
        productType: 'SELL',
      });

      await loadOrders();
      setToastMessage(
        res.isDemo ? 'Opening Sell Flow (Sandbox)...' : 'Opening Sell Flow (Live Payout)...',
      );
    } catch {
      Alert.alert('Error', 'Could not initiate off-ramp sell order.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header
        title="Market & Trade"
        rightElement={<NetworkBadge />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!transakService.isConfigured() ? (
          <View
            style={[
              styles.demoBanner,
              { backgroundColor: colors.surfaceLight, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.demoBannerText, { color: colors.textSecondary }]}>
              Sandbox Environment Active. Orders use Transak staging testnet.
            </Text>
          </View>
        ) : null}

        {/* Crypto Asset Selector Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assetChipsRow}
        >
          {SUPPORTED_ASSETS.map((asset) => {
            const isSelected = selectedAsset.symbol === asset.symbol;
            return (
              <TouchableOpacity
                key={asset.symbol}
                style={[
                  styles.assetChip,
                  {
                    backgroundColor: isSelected ? colors.primaryGlow : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedAsset(asset)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={asset.iconName}
                  size={15}
                  color={isSelected ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.assetChipText,
                    {
                      color: isSelected ? colors.primary : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {asset.symbol}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Live Ticker Header */}
        <View style={styles.tickerHeader}>
          <View>
            <Text style={[styles.assetNameLabel, { color: colors.textSecondary }]}>
              {selectedAsset.name} ({selectedAsset.symbol})
            </Text>
            <Text style={[styles.bigPriceText, { color: colors.textPrimary }]}>
              {formatFiat(unitPrice, currencyPreference)}
            </Text>
          </View>

          <View
            style={[
              styles.changeBadge,
              { backgroundColor: isPriceUp ? colors.successBackground : colors.dangerBackground },
            ]}
          >
            <Ionicons
              name={isPriceUp ? 'trending-up' : 'trending-down'}
              size={14}
              color={isPriceUp ? colors.success : colors.danger}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.changeBadgeText,
                { color: isPriceUp ? colors.success : colors.danger },
              ]}
            >
              {isPriceUp ? '+' : ''}
              {change24h.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Interactive SVG Price Chart */}
        <PriceChart
          data={chartData}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          currencyPreference={currencyPreference}
        />

        {/* Buy / Sell Tab Switcher */}
        <View
          style={[
            styles.modeTabsRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.modeTab, productType === 'BUY' && { backgroundColor: colors.primary }]}
            onPress={() => setProductType('BUY')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cart-outline"
              size={16}
              color={productType === 'BUY' ? '#FFFFFF' : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeTabText,
                { color: productType === 'BUY' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Buy Crypto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, productType === 'SELL' && { backgroundColor: '#EF4444' }]}
            onPress={() => setProductType('SELL')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cash-outline"
              size={16}
              color={productType === 'SELL' ? '#FFFFFF' : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeTabText,
                { color: productType === 'SELL' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Sell Crypto
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================= BUY TERMINAL ================= */}
        {productType === 'BUY' ? (
          <View
            style={[
              styles.terminalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.terminalTitle, { color: colors.textPrimary }]}>
              Instant On-Ramp ({currencyPreference} ➔ {selectedAsset.symbol})
            </Text>

            {/* Payment Method Selector */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Payment Method</Text>
            <View style={styles.methodRow}>
              {currencyPreference === 'INR' ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.methodChip,
                      paymentMethod === 'upi' && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryGlow,
                      },
                    ]}
                    onPress={() => setPaymentMethod('upi')}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={14}
                      color={paymentMethod === 'upi' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.methodChipText,
                        { color: paymentMethod === 'upi' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      UPI (Instant 0%)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodChip,
                      paymentMethod === 'card' && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryGlow,
                      },
                    ]}
                    onPress={() => setPaymentMethod('card')}
                  >
                    <Ionicons
                      name="card-outline"
                      size={14}
                      color={paymentMethod === 'card' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.methodChipText,
                        { color: paymentMethod === 'card' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      Card
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.methodChip,
                      paymentMethod === 'card' && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryGlow,
                      },
                    ]}
                    onPress={() => setPaymentMethod('card')}
                  >
                    <Ionicons
                      name="card-outline"
                      size={14}
                      color={paymentMethod === 'card' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.methodChipText,
                        { color: paymentMethod === 'card' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      Card
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodChip,
                      paymentMethod === 'apple_pay' && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryGlow,
                      },
                    ]}
                    onPress={() => setPaymentMethod('apple_pay')}
                  >
                    <Ionicons
                      name="logo-apple"
                      size={14}
                      color={paymentMethod === 'apple_pay' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.methodChipText,
                        {
                          color:
                            paymentMethod === 'apple_pay' ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      Apple Pay
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Fiat Amount Input */}
            <Text
              style={[styles.inputLabel, { color: colors.textSecondary, marginTop: SPACING.sm }]}
            >
              You Pay (Fiat)
            </Text>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={fiatAmountStr}
                onChangeText={setFiatAmountStr}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={[styles.numericInput, { color: colors.textPrimary }]}
              />
              <View style={[styles.currencyBadge, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.currencyBadgeText, { color: colors.textPrimary }]}>
                  {currencyPreference}
                </Text>
              </View>
            </View>

            {/* Quick Pills */}
            <View style={styles.quickRow}>
              {quickAmounts.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.quickBtn,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
                  ]}
                  onPress={() => setFiatAmountStr(amt.toString())}
                >
                  <Text style={[styles.quickBtnText, { color: colors.textSecondary }]}>
                    {currencyPreference === 'INR' ? `₹${amt}` : `$${amt}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live Fee Breakdown */}
            <View
              style={[
                styles.breakdownBox,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                  Base Price:
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                  1 {selectedAsset.symbol} ≈ {formatFiat(unitPrice, currencyPreference)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                  Gateway Fee (Transak):
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                  {liveQuote
                    ? formatFiat(liveQuote.transakFee, currencyPreference)
                    : 'Calculating...'}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                  Estimated Delivery:
                </Text>
                <Text style={[styles.breakdownValueBold, { color: colors.success }]}>
                  {liveQuote
                    ? `≈ ${liveQuote.cryptoAmount.toFixed(5)} ${selectedAsset.symbol}`
                    : 'Calculating...'}
                </Text>
              </View>
            </View>

            <Button
              title={`Buy ${selectedAsset.symbol}`}
              onPress={handleInitiateBuy}
              loading={isLoading}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        ) : (
          /* ================= SELL TERMINAL ================= */
          <View
            style={[
              styles.terminalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.terminalTitle, { color: colors.textPrimary }]}>
              Instant Off-Ramp ({selectedAsset.symbol} ➔ Bank Payout)
            </Text>

            <View style={styles.balanceInfoRow}>
              <Text style={[styles.balanceInfoLabel, { color: colors.textSecondary }]}>
                Available {selectedAsset.symbol}:
              </Text>
              <Text style={[styles.balanceInfoValue, { color: colors.primary }]}>
                {availableBalanceFloat.toFixed(4)} {selectedAsset.symbol}
              </Text>
            </View>

            <Text
              style={[styles.inputLabel, { color: colors.textSecondary, marginTop: SPACING.sm }]}
            >
              Amount to Sell
            </Text>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={cryptoSellAmountStr}
                onChangeText={setCryptoSellAmountStr}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={[styles.numericInput, { color: colors.textPrimary }]}
              />
              <TouchableOpacity
                style={[styles.currencyBadge, { backgroundColor: colors.primaryGlow }]}
                onPress={() => setCryptoSellAmountStr(availableBalanceFloat.toString())}
              >
                <Text
                  style={[styles.currencyBadgeText, { color: colors.primary, fontWeight: '700' }]}
                >
                  MAX
                </Text>
              </TouchableOpacity>
            </View>

            {sellValidation.error ? (
              <Text style={[styles.warningText, { color: colors.danger }]}>
                {sellValidation.error}
              </Text>
            ) : null}

            {/* Estimated Fiat Payout */}
            <View
              style={[
                styles.breakdownBox,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Rate:</Text>
                <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                  1 {selectedAsset.symbol} = {formatFiat(unitPrice, currencyPreference)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                  Estimated Payout:
                </Text>
                <Text style={[styles.breakdownValueBold, { color: '#EF4444' }]}>
                  {formatFiat(
                    (parseFloat(cryptoSellAmountStr) || 0) * unitPrice,
                    currencyPreference,
                  )}
                </Text>
              </View>
            </View>

            <Button
              title={`Sell ${selectedAsset.symbol} for ${currencyPreference}`}
              variant="danger"
              onPress={handleInitiateSell}
              loading={isLoading}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        )}

        {/* Recent Orders History */}
        {recentOrders.length > 0 ? (
          <View
            style={[
              styles.ordersCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.ordersTitle, { color: colors.textPrimary }]}>Recent Orders</Text>
            {recentOrders.map((order) => (
              <View
                key={order.orderId}
                style={[styles.orderItem, { borderBottomColor: colors.border }]}
              >
                <View>
                  <Text
                    style={[
                      styles.orderType,
                      { color: order.orderType === 'BUY' ? colors.success : '#EF4444' },
                    ]}
                  >
                    {order.orderType} {order.cryptoCurrency}
                  </Text>
                  <Text style={[styles.orderSub, { color: colors.textTertiary }]}>
                    {new Date(order.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {order.fiatCurrency} {order.fiatAmount}
                  </Text>
                </View>
                <View style={[styles.orderStatusPill, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={[styles.orderStatusText, { color: colors.textSecondary }]}>
                    {order.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Sell Authorization Confirm Modal */}
      <ConfirmModal
        visible={showSellConfirmModal}
        title="Authorize Off-Ramp Sell"
        subtitle="You will transfer crypto to Transak custody for bank payout"
        confirmTitle="Authorize & Sell"
        isDanger
        onCancel={() => setShowSellConfirmModal(false)}
        onConfirm={handleConfirmSell}
      >
        <View style={styles.modalBody}>
          <Text style={[styles.modalText, { color: colors.textSecondary }]}>
            Amount:{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
              {cryptoSellAmountStr} {selectedAsset.symbol}
            </Text>
          </Text>
          <Text style={[styles.modalText, { color: colors.textSecondary }]}>
            Destination: <Text style={{ color: colors.textPrimary }}>Transak Payout Service</Text>
          </Text>
        </View>
      </ConfirmModal>

      {toastMessage ? (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  demoBannerText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
  },
  assetChipsRow: {
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  assetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  assetChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  tickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  assetNameLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  bigPriceText: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  changeBadgeText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 12,
  },
  modeTabsRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  modeTabText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 13,
  },
  terminalCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  terminalTitle: {
    ...TYPOGRAPHY.bodyBold,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  methodChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  numericInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  currencyBadgeText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickBtnText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  breakdownBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  breakdownValue: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  breakdownValueBold: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 12,
  },
  balanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  balanceInfoLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  balanceInfoValue: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 12,
  },
  warningText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginTop: 4,
  },
  ordersCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  ordersTitle: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  orderType: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 12,
  },
  orderSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  orderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  orderStatusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
  },
  modalBody: {
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  modalText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
  },
});
