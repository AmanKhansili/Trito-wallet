import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Input } from '../../src/components/Input';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { BuySellModal } from '../../src/components/BuySellModal';
import { PriceChart } from '../../src/components/PriceChart';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { formatFiat, formatPercentage } from '../../src/utils/formatters';
import { priceService } from '../../src/services/priceService';
import { MarketItem, FiatRampType, Timeframe } from '../../src/types';

type MarketFilter = 'all' | 'gainers' | 'losers' | 'large_cap' | 'stable';

export default function MarketScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currencyPreference, setCurrencyPreference } = useWallet();

  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<MarketFilter>('all');

  // Selected Token for detailed chart view
  const [selectedToken, setSelectedToken] = useState<MarketItem | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>('1D');
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // Buy/Sell Modal
  const [showBuyModal, setShowBuyModal] = useState<boolean>(false);
  const [rampModalType, setRampModalType] = useState<FiatRampType>('buy');
  const [rampModalCrypto, setRampModalCrypto] = useState<string>('ETH');

  const loadMarketData = async (force: boolean = false) => {
    try {
      const data = await priceService.fetchTopMarkets(force);
      setMarketItems(data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMarketData(true);
  };

  // Load chart in exact currency preference (USD or INR)
  const loadChartData = useCallback(
    async (token: MarketItem, tf: Timeframe) => {
      setChartLoading(true);
      try {
        const unitPrice =
          currencyPreference === 'INR' ? token.currentPriceInr : token.currentPriceUsd;
        const points = await priceService.fetchMarketChart(
          token.id,
          tf,
          currencyPreference,
          unitPrice,
        );
        setChartData(points);
      } catch {
        setChartData([]);
      } finally {
        setChartLoading(false);
      }
    },
    [currencyPreference],
  );

  const handleSelectToken = (token: MarketItem) => {
    setSelectedToken(token);
    setChartTimeframe('1D');
    loadChartData(token, '1D');
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setChartTimeframe(tf);
    if (selectedToken) {
      loadChartData(selectedToken, tf);
    }
  };

  const handleOpenBuyModal = (type: FiatRampType, symbol: string) => {
    setSelectedToken(null);
    setRampModalType(type);
    setRampModalCrypto(symbol);
    setShowBuyModal(true);
  };

  const toggleCurrency = () => {
    const next = currencyPreference === 'USD' ? 'INR' : 'USD';
    setCurrencyPreference(next);
  };

  // Filtered and searched market list
  const filteredList = useMemo(() => {
    let list = [...marketItems];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) => item.name.toLowerCase().includes(q) || item.symbol.toLowerCase().includes(q),
      );
    }

    switch (activeFilter) {
      case 'gainers':
        return list.filter((item) => item.priceChangePercentage24h > 0).sort((a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h);
      case 'losers':
        return list.filter((item) => item.priceChangePercentage24h < 0).sort((a, b) => a.priceChangePercentage24h - b.priceChangePercentage24h);
      case 'large_cap':
        return list.filter((item) => item.marketCapRank <= 10).sort((a, b) => a.marketCapRank - b.marketCapRank);
      case 'stable':
        return list.filter((item) => ['USDT', 'USDC', 'DAI', 'FDUSD', 'USDD'].includes(item.symbol.toUpperCase()));
      case 'all':
      default:
        return list.sort((a, b) => a.marketCapRank - b.marketCapRank);
    }
  }, [marketItems, searchQuery, activeFilter]);

  const filters: { key: MarketFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'all', label: 'All', icon: 'list-outline' },
    { key: 'gainers', label: 'Top Gainers', icon: 'trending-up-outline' },
    { key: 'losers', label: 'Top Losers', icon: 'trending-down-outline' },
    { key: 'large_cap', label: 'Large Cap', icon: 'diamond-outline' },
    { key: 'stable', label: 'Stablecoins', icon: 'shield-outline' },
  ];

  return (
    <ScreenWrapper>
      <Header
        title="Markets"
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={toggleCurrency} style={[styles.currencyPill, { backgroundColor: colors.surfaceHighlight }]}>
              <Text style={[styles.currencyPillText, { color: colors.primary }]}>{currencyPreference}</Text>
            </TouchableOpacity>
            <NetworkBadge />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Input
            placeholder="Search coin or symbol (e.g. BTC, ETH, SOL)..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            rightElement={
              searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="search" size={18} color={colors.textTertiary} />
              )
            }
          />
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map((f) => {
            const isSelected = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={f.icon}
                  size={14}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                  style={styles.filterIcon}
                />
                <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Market List Table */}
        <View style={styles.listHeader}>
          <Text style={[styles.colHeaderRank, { color: colors.textTertiary }]}>#</Text>
          <Text style={[styles.colHeaderAsset, { color: colors.textTertiary }]}>Asset</Text>
          <Text style={[styles.colHeaderPrice, { color: colors.textTertiary }]}>
            Price ({currencyPreference})
          </Text>
          <Text style={[styles.colHeaderChange, { color: colors.textTertiary }]}>24h Change</Text>
        </View>

        {filteredList.map((item) => {
          const isPositive = item.priceChangePercentage24h >= 0;
          const displayPrice = currencyPreference === 'INR' ? item.currentPriceInr : item.currentPriceUsd;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleSelectToken(item)}
              style={[
                styles.coinRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              {/* Rank */}
              <Text style={[styles.coinRank, { color: colors.textTertiary }]}>{item.marketCapRank}</Text>

              {/* Logo & Symbol / Name */}
              <View style={styles.coinAssetCol}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.coinImage} />
                ) : (
                  <View style={[styles.coinFallbackImage, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[styles.coinFallbackText, { color: colors.primary }]}>
                      {item.symbol.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.coinNameWrap}>
                  <Text style={[styles.coinSymbol, { color: colors.textPrimary }]}>{item.symbol}</Text>
                  <Text style={[styles.coinName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </View>

              {/* Live Price in Selected Currency */}
              <View style={styles.coinPriceCol}>
                <Text style={[styles.coinPrice, { color: colors.textPrimary }]}>
                  {formatFiat(displayPrice, currencyPreference)}
                </Text>
                <Text style={[styles.coinCap, { color: colors.textTertiary }]}>
                  {currencyPreference === 'INR'
                    ? `MCap: ₹${((item.marketCapUsd * 89.2) / 1e7).toFixed(0)}Cr`
                    : `MCap: $${(item.marketCapUsd / 1e9).toFixed(1)}B`}
                </Text>
              </View>

              {/* 24h Change Pill */}
              <View
                style={[
                  styles.changeBadge,
                  {
                    backgroundColor: isPositive ? colors.successBackground : colors.dangerBackground,
                    borderColor: isPositive ? colors.success : colors.danger,
                  },
                ]}
              >
                <Ionicons
                  name={isPositive ? 'caret-up' : 'caret-down'}
                  size={12}
                  color={isPositive ? colors.success : colors.danger}
                  style={styles.arrowIcon}
                />
                <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.danger }]}>
                  {Math.abs(item.priceChangePercentage24h).toFixed(2)}%
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Interactive Coin Chart & Detailed Analysis Modal */}
      {selectedToken && (
        <Modal visible={!!selectedToken} transparent animationType="slide" onRequestClose={() => setSelectedToken(null)}>
          <TouchableWithoutFeedback onPress={() => setSelectedToken(null)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTokenTitle}>
                      {selectedToken.image ? (
                        <Image source={{ uri: selectedToken.image }} style={styles.modalTokenLogo} />
                      ) : null}
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                            {selectedToken.name}
                          </Text>
                          <View style={[styles.symbolBadge, { backgroundColor: colors.surfaceHighlight }]}>
                            <Text style={[styles.symbolBadgeText, { color: colors.primary }]}>
                              {selectedToken.symbol}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.modalRank, { color: colors.textSecondary }]}>
                          Rank #{selectedToken.marketCapRank} • Live Verified
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedToken(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Interactive SVG Trend Chart in Currency Preference */}
                  <PriceChart
                    data={chartData}
                    timeframe={chartTimeframe}
                    onTimeframeChange={handleTimeframeChange}
                    loading={chartLoading}
                    currencyPreference={currencyPreference}
                    currentPrice={
                      currencyPreference === 'INR'
                        ? selectedToken.currentPriceInr
                        : selectedToken.currentPriceUsd
                    }
                    height={180}
                    showTimeframeSelector={true}
                  />

                  {/* High, Low, Market Cap & Volume Grid in Currency Preference */}
                  <View style={[styles.statsGrid, { backgroundColor: colors.surfaceSubtle }]}>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h High</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        {formatFiat(
                          currencyPreference === 'INR'
                            ? selectedToken.high24hUsd * 89.2
                            : selectedToken.high24hUsd,
                          currencyPreference,
                        )}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h Low</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        {formatFiat(
                          currencyPreference === 'INR'
                            ? selectedToken.low24hUsd * 89.2
                            : selectedToken.low24hUsd,
                          currencyPreference,
                        )}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Market Cap</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        {currencyPreference === 'INR'
                          ? `₹${((selectedToken.marketCapUsd * 89.2) / 1e7).toFixed(0)} Cr`
                          : `$${(selectedToken.marketCapUsd / 1e9).toFixed(2)}B`}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h Volume</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        {currencyPreference === 'INR'
                          ? `₹${((selectedToken.totalVolumeUsd * 89.2) / 1e7).toFixed(0)} Cr`
                          : `$${(selectedToken.totalVolumeUsd / 1e6).toFixed(1)}M`}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons: Buy, Sell, Swap */}
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      onPress={() => handleOpenBuyModal('buy', selectedToken.symbol)}
                      style={[styles.modalActionBtn, { backgroundColor: colors.primary }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.actionBtnTextWhite}>Buy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenBuyModal('sell', selectedToken.symbol)}
                      style={[styles.modalActionBtn, { backgroundColor: colors.surfaceHighlight }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cash-outline" size={16} color={colors.textPrimary} />
                      <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Sell</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setSelectedToken(null);
                        router.push('/(tabs)/swap');
                      }}
                      style={[styles.modalActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Swap</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Buy / Sell Gateway Modal */}
      <BuySellModal
        visible={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        initialType={rampModalType}
        initialCrypto={rampModalCrypto}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  currencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  currencyPillText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  searchWrapper: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  searchInput: {
    height: 44,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: SPACING.xs + 2,
    marginBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterChipText: {
    ...TYPOGRAPHY.captionBold,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  colHeaderRank: {
    ...TYPOGRAPHY.captionBold,
    width: 28,
  },
  colHeaderAsset: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
  },
  colHeaderPrice: {
    ...TYPOGRAPHY.captionBold,
    width: 115,
    textAlign: 'right',
  },
  colHeaderChange: {
    ...TYPOGRAPHY.captionBold,
    width: 80,
    textAlign: 'right',
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  coinRank: {
    ...TYPOGRAPHY.captionBold,
    width: 26,
    fontSize: 11,
  },
  coinAssetCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coinImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  coinFallbackImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  coinFallbackText: {
    ...TYPOGRAPHY.bodyBold,
  },
  coinNameWrap: {
    flex: 1,
  },
  coinSymbol: {
    ...TYPOGRAPHY.bodyBold,
  },
  coinName: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginTop: 1,
  },
  coinPriceCol: {
    alignItems: 'flex-end',
    width: 110,
    marginRight: SPACING.sm,
  },
  coinPrice: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  coinCap: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    marginTop: 1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    width: 72,
  },
  arrowIcon: {
    marginRight: 2,
  },
  changeText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTokenTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
  },
  symbolBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  symbolBadgeText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 10,
  },
  modalRank: {
    ...TYPOGRAPHY.caption,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  statCell: {
    width: '50%',
    paddingVertical: 3,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  statVal: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: 1,
    fontSize: 13,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  actionBtnTextWhite: {
    ...TYPOGRAPHY.bodyBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionBtnText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
});
