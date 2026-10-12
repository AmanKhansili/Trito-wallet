import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Toast } from '../../src/components/Toast';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { getExplorerTxUrl } from '../../src/config/networks';
import { formatTimestamp, shortenHash } from '../../src/utils/formatters';

export default function TransactionDetailsScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const { transactions, network } = useWallet();
  const { colors } = useTheme();

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const tx = transactions.find((t) => t.hash === hash);

  const handleCopyHash = async () => {
    if (hash) {
      await Clipboard.setStringAsync(hash);
      setToastMsg('Transaction hash copied');
    }
  };

  const getStatusColor = () => {
    if (!tx) return colors.textSecondary;
    switch (tx.status) {
      case 'confirmed':
        return colors.success;
      case 'failed':
        return colors.danger;
      case 'pending':
      default:
        return colors.warning;
    }
  };

  if (!tx) {
    return (
      <ScreenWrapper>
        <Header title="Transaction Details" showBack />
        <View style={styles.notFoundContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Transaction record not found in local history.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  const explorerUrl = getExplorerTxUrl(tx.networkId, tx.hash);

  return (
    <ScreenWrapper>
      <Header title="Transaction Details" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.statusIconWrap, { backgroundColor: colors.surfaceLight }]}>
            <Ionicons
              name={
                tx.status === 'confirmed'
                  ? 'checkmark-circle'
                  : tx.status === 'failed'
                  ? 'close-circle'
                  : 'time'
              }
              size={36}
              color={getStatusColor()}
            />
          </View>

          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            {tx.status.toUpperCase()}
          </Text>
          <Text style={[styles.amountHero, { color: colors.textPrimary }]}>
            {tx.type === 'send' ? '-' : '+'}
            {tx.amount} {tx.tokenSymbol}
          </Text>
        </View>

        {/* Details List */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {tx.type.toUpperCase()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Timestamp</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {formatTimestamp(tx.timestamp)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Network</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {tx.networkId === 'sepolia' ? 'Ethereum Sepolia' : 'Ethereum Mainnet'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>From</Text>
            <Text style={[styles.monoValue, { color: colors.textPrimary }]}>
              {shortenHash(tx.from)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>To</Text>
            <Text style={[styles.monoValue, { color: colors.textPrimary }]}>
              {shortenHash(tx.to)}
            </Text>
          </View>

          {tx.gasUsed ? (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Gas Used</Text>
              <Text style={[styles.value, { color: colors.textPrimary }]}>{tx.gasUsed}</Text>
            </View>
          ) : null}

          {tx.swapDetails ? (
            <>
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Swap Output</Text>
                <Text style={[styles.value, { color: colors.success }]}>
                  {tx.swapDetails.toAmount} {tx.swapDetails.toTokenSymbol}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Execution Rate</Text>
                <Text style={[styles.value, { color: colors.textPrimary }]}>
                  {tx.swapDetails.rate}
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Transaction Hash</Text>
            <Text
              onPress={handleCopyHash}
              style={[styles.monoValue, { color: colors.primaryLight }]}
            >
              {shortenHash(tx.hash, 6)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <Button
          title="View on Etherscan"
          size="lg"
          onPress={() => Linking.openURL(explorerUrl)}
          icon={<Ionicons name="open-outline" size={20} color="#FFFFFF" />}
          style={styles.actionBtn}
        />

        <Button
          title="Copy Transaction Hash"
          variant="outline"
          onPress={handleCopyHash}
          icon={<Ionicons name="copy-outline" size={18} color={colors.primary} />}
          style={styles.copyBtn}
        />
      </ScrollView>

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  notFoundText: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  statusCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  statusIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statusTitle: {
    ...TYPOGRAPHY.captionBold,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  amountHero: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
  },
  detailsCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...TYPOGRAPHY.caption,
  },
  value: {
    ...TYPOGRAPHY.bodyBold,
  },
  monoValue: {
    ...TYPOGRAPHY.mono,
  },
  actionBtn: {
    marginBottom: SPACING.sm,
  },
  copyBtn: {
    marginBottom: SPACING.xxl,
  },
});
