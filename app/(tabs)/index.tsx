import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { AssetCard } from '../../src/components/AssetCard';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { Toast } from '../../src/components/Toast';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { formatFiat, shortenAddress } from '../../src/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    address,
    network,
    tokenBalances,
    totalPortfolioValueUsd,
    totalPortfolioValueInr,
    marketPrices,
    currencyPreference,
    setCurrencyPreference,
    isRefreshing,
    refreshBalances,
    networkError,
  } = useWallet();
  const { colors } = useTheme();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const portfolioValue =
    currencyPreference === 'INR' ? totalPortfolioValueInr : totalPortfolioValueUsd;

  const handleCopyAddress = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setToastMessage('Address copied to clipboard');
    }
  };

  const toggleCurrency = () => {
    setCurrencyPreference(currencyPreference === 'USD' ? 'INR' : 'USD');
  };

  return (
    <ScreenWrapper>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleCopyAddress}
          style={[styles.addressBadge, { backgroundColor: colors.surfaceLight }]}
          activeOpacity={0.7}
        >
          <Ionicons name="wallet-outline" size={16} color={colors.primary} style={styles.addrIcon} />
          <Text style={[styles.addressText, { color: colors.textPrimary }]}>
            {shortenAddress(address || '')}
          </Text>
          <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        <NetworkBadge onPress={() => router.push('/(tabs)/settings')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refreshBalances(false)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Network Error Notification Banner */}
        {networkError ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.dangerBackground, borderColor: colors.danger },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorBannerText, { color: colors.danger }]}>{networkError}</Text>
          </View>
        ) : null}

        {/* Portfolio Value Card */}
        <View
          style={[
            styles.portfolioCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.portfolioHeader}>
            <Text style={[styles.portfolioLabel, { color: colors.textSecondary }]}>
              Total Portfolio Value
            </Text>
            <TouchableOpacity onPress={toggleCurrency} style={styles.currencyToggle}>
              <Text style={[styles.currencyText, { color: colors.primaryLight }]}>
                {currencyPreference} ▾
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.portfolioAmount, { color: colors.textPrimary }]}>
            {formatFiat(portfolioValue, currencyPreference)}
          </Text>

          {/* Quick Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/send')}
              style={styles.actionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Send</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/receive')}
              style={styles.actionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.surfaceLight }]}>
                <Ionicons name="arrow-down" size={22} color={colors.textPrimary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/swap')}
              style={styles.actionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.surfaceLight }]}>
                <Ionicons name="swap-horizontal" size={22} color={colors.textPrimary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setToastMessage('Fiat on-ramp coming in Mainnet release')}
              style={styles.actionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.surfaceLight }]}>
                <Ionicons name="card-outline" size={22} color={colors.textTertiary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textTertiary }]}>Buy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Assets Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Assets</Text>
          <TouchableOpacity
            onPress={() => refreshBalances(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {tokenBalances.map((tb) => (
          <AssetCard
            key={tb.token.symbol}
            balance={tb}
            marketPrice={marketPrices[tb.token.coingeckoId]}
            currencyPreference={currencyPreference}
            onPress={() => {
              router.push({
                pathname: '/(tabs)/send',
                params: { asset: tb.token.symbol },
              });
            }}
          />
        ))}
      </ScrollView>

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  addressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  addrIcon: {
    marginRight: SPACING.xs,
  },
  addressText: {
    ...TYPOGRAPHY.captionBold,
    marginRight: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  errorBannerText: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
  },
  portfolioCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginVertical: SPACING.sm,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currencyToggle: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  currencyText: {
    ...TYPOGRAPHY.captionBold,
  },
  portfolioAmount: {
    ...TYPOGRAPHY.h1,
    fontSize: 34,
    marginVertical: SPACING.md,
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  actionLabel: {
    ...TYPOGRAPHY.captionBold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
  },
});
