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
import { BuySellModal } from '../../src/components/BuySellModal';
import { ImportTokenModal } from '../../src/components/ImportTokenModal';
import { AccountSelectorModal } from '../../src/components/AccountSelectorModal';
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
    activeAccountIndex,
  } = useWallet();
  const { colors } = useTheme();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showBuySellModal, setShowBuySellModal] = useState<boolean>(false);
  const [showImportTokenModal, setShowImportTokenModal] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);

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
      {/* Top Header Bar with Account Selector & Network */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => setShowAccountModal(true)}
          style={[styles.accountBadge, { backgroundColor: colors.surfaceLight }]}
          activeOpacity={0.7}
        >
          <View style={[styles.accountDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.accountText, { color: colors.textPrimary }]}>
            Account {activeAccountIndex + 1}
          </Text>
          <Text style={[styles.addressMuted, { color: colors.textSecondary }]}>
            ({shortenAddress(address || '', 4, 3)})
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
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
            <TouchableOpacity onPress={handleCopyAddress} style={styles.copyAddressRow}>
              <Text style={[styles.portfolioLabel, { color: colors.textSecondary }]}>
                Total Portfolio
              </Text>
              <Ionicons name="copy-outline" size={12} color={colors.textTertiary} style={styles.copyMiniIcon} />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleCurrency} style={styles.currencyToggle}>
              <Text style={[styles.currencyText, { color: colors.primaryLight }]}>
                {currencyPreference} ▾
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.portfolioAmount, { color: colors.textPrimary }]}>
            {formatFiat(portfolioValue, currencyPreference)}
          </Text>

          {/* Quick Action Buttons (Send, Receive, Swap, Buy/Sell) */}
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

            {/* Buy / Sell with Onramp.money UPI & Transak */}
            <TouchableOpacity
              onPress={() => setShowBuySellModal(true)}
              style={styles.actionItem}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.surfaceLight }]}>
                <Ionicons name="card-outline" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Buy / Sell</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Assets Section Header with Import Custom Token Button */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Assets</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              onPress={() => setShowImportTokenModal(true)}
              style={[styles.importPill, { backgroundColor: colors.surfaceLight }]}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={[styles.importText, { color: colors.primary }]}>Import Token</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => refreshBalances(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.refreshIconBtn}
            >
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {tokenBalances.map((tb) => (
          <AssetCard
            key={tb.token.contractAddress ? `${tb.token.symbol}-${tb.token.contractAddress}` : tb.token.symbol}
            balance={tb}
            marketPrice={tb.token.coingeckoId ? marketPrices[tb.token.coingeckoId] : undefined}
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

      {/* Buy & Sell Modal */}
      <BuySellModal
        visible={showBuySellModal}
        onClose={() => setShowBuySellModal(false)}
      />

      {/* Import Custom Token Modal */}
      <ImportTokenModal
        visible={showImportTokenModal}
        onClose={() => setShowImportTokenModal(false)}
        onTokenImported={(tok) => setToastMessage(`Token ${tok.symbol} added to assets.`)}
      />

      {/* Account Selector Modal */}
      <AccountSelectorModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />

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
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accountText: {
    ...TYPOGRAPHY.captionBold,
  },
  addressMuted: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
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
  copyAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyMiniIcon: {
    marginLeft: 2,
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
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  importPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  importText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  refreshIconBtn: {
    padding: 2,
  },
});
