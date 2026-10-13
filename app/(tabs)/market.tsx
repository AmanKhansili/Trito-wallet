import React, { useState, useEffect, useMemo } from 'react';
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
import { Button } from '../../src/components/Button';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { BuySellModal } from '../../src/components/BuySellModal';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { formatFiat, formatPercentage } from '../../src/utils/formatters';
import { priceService } from '../../src/services/priceService';
import { MarketItem } from '../../src/types';

type MarketFilter = 'all' | 'gainers' | 'losers' | 'large_cap' | 'stable';

export default function MarketScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currencyPreference } = useWallet();

  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<MarketFilter>('all');
  const [selectedToken, setSelectedToken] = useState<MarketItem | null>(null);
  const [showBuyModal, setShowBuyModal] = useState<boolean>(false);

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

  // Filtered and searched market list
  const filteredList = useMemo(() => {
    let list = [...marketItems];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) => item.name.toLowerCase().includes(q) || item.symbol.toLowerCase().includes(q),
      );
    }

    // Category filter
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
      <Header title="Markets" rightElement={<NetworkBadge />} />

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

        {/* Market List */}
        <View style={styles.listHeader}>
          <Text style={[styles.colHeaderRank, { color: colors.textTertiary }]}>#</Text>
          <Text style={[styles.colHeaderAsset, { color: colors.textTertiary }]}>Asset</Text>
          <Text style={[styles.colHeaderPrice, { color: colors.textTertiary }]}>Price</Text>
          <Text style={[styles.colHeaderChange, { color: colors.textTertiary }]}>24h Change</Text>
        </View>

        {filteredList.map((item) => {
          const isPositive = item.priceChangePercentage24h >= 0;
          const displayPrice = currencyPreference === 'INR' ? item.currentPriceInr : item.currentPriceUsd;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSelectedToken(item)}
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

              {/* Live Price */}
              <View style={styles.coinPriceCol}>
                <Text style={[styles.coinPrice, { color: colors.textPrimary }]}>
                  {formatFiat(displayPrice, currencyPreference)}
                </Text>
                <Text style={[styles.coinCap, { color: colors.textTertiary }]}>
                  MCap: ${(item.marketCapUsd / 1e9).toFixed(1)}B
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

      {/* Token Detail Quick Modal */}
      {selectedToken && (
        <Modal visible={!!selectedToken} transparent animationType="slide" onRequestClose={() => setSelectedToken(null)}>
          <TouchableWithoutFeedback onPress={() => setSelectedToken(null)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTokenTitle}>
                      {selectedToken.image ? (
                        <Image source={{ uri: selectedToken.image }} style={styles.modalTokenLogo} />
                      ) : null}
                      <View>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                          {selectedToken.name} ({selectedToken.symbol})
                        </Text>
                        <Text style={[styles.modalRank, { color: colors.textSecondary }]}>
                          Rank #{selectedToken.marketCapRank}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedToken(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalPriceSection}>
                    <Text style={[styles.modalBigPrice, { color: colors.textPrimary }]}>
                      {formatFiat(
                        currencyPreference === 'INR' ? selectedToken.currentPriceInr : selectedToken.currentPriceUsd,
                        currencyPreference,
                      )}
                    </Text>
                    <View
                      style={[
                        styles.changeBadge,
                        {
                          backgroundColor:
                            selectedToken.priceChangePercentage24h >= 0
                              ? colors.successBackground
                              : colors.dangerBackground,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.changeText,
                          {
                            color:
                              selectedToken.priceChangePercentage24h >= 0
                                ? colors.success
                                : colors.danger,
                          },
                        ]}
                      >
                        {formatPercentage(selectedToken.priceChangePercentage24h)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statsGrid, { backgroundColor: colors.surfaceSubtle }]}>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h High</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        ${selectedToken.high24hUsd.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h Low</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        ${selectedToken.low24hUsd.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Market Cap</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        ${(selectedToken.marketCapUsd / 1e9).toFixed(2)}B
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>24h Volume</Text>
                      <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                        ${(selectedToken.totalVolumeUsd / 1e6).toFixed(1)}M
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalActionRow}>
                    <Button
                      title="Buy with UPI/Card"
                      variant="primary"
                      onPress={() => {
                        setSelectedToken(null);
                        setShowBuyModal(true);
                      }}
                      style={styles.modalBtn}
                    />
                    <Button
                      title="Trade in Swap"
                      variant="secondary"
                      onPress={() => {
                        setSelectedToken(null);
                        router.push('/(tabs)/swap');
                      }}
                      style={styles.modalBtn}
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Buy / Sell Gateway Modal */}
      <BuySellModal visible={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
    width: 100,
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
    width: 95,
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
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  modalRank: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  modalPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: SPACING.md,
  },
  modalBigPrice: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.md,
  },
  statCell: {
    width: '50%',
    paddingVertical: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
  },
  statVal: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: 2,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  modalBtn: {
    flex: 1,
  },
});
