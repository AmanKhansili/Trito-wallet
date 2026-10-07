import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { QRCodeDisplay } from '../../src/components/QRCodeDisplay';
import { Toast } from '../../src/components/Toast';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';

export default function ReceiveScreen() {
  const { address, network } = useWallet();
  const { colors } = useTheme();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopy = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setToastMessage('Address copied to clipboard');
    }
  };

  const handleShare = async () => {
    if (address) {
      try {
        await Share.share({
          message: address,
          title: `My TRITO Wallet Address (${network.name})`,
        });
      } catch {
        // Ignored
      }
    }
  };

  const networkWarning =
    network.id === 'sepolia'
      ? 'Only send assets using the Ethereum Sepolia network to this address.'
      : 'Only send assets using Ethereum Mainnet to this address.';

  return (
    <ScreenWrapper>
      <Header title="Receive Crypto" showBack rightElement={<NetworkBadge />} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Prominent Network Indicator */}
        <View style={styles.networkHeader}>
          <Text style={[styles.networkTitle, { color: colors.textPrimary }]}>
            {network.name}
          </Text>
          <Text style={[styles.networkSub, { color: colors.textSecondary }]}>
            Compatible with all Ethereum ERC20 & native assets
          </Text>
        </View>

        {/* QR Code Container */}
        <View style={styles.qrWrapper}>
          <QRCodeDisplay value={address || '0x0000000000000000000000000000000000000000'} size={220} />
        </View>

        {/* Full Address Card */}
        <View
          style={[
            styles.addressCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>
            Your Ethereum Address
          </Text>
          <Text
            selectable
            style={[styles.addressText, { color: colors.textPrimary }]}
          >
            {address}
          </Text>
        </View>

        {/* Prominent Network Warning Banner */}
        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: colors.warningBackground,
              borderColor: colors.warning,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.warning} style={styles.warnIcon} />
          <Text style={[styles.warningText, { color: colors.textPrimary }]}>
            {networkWarning}
          </Text>
        </View>

        {/* Copy and Share Buttons */}
        <View style={styles.buttonRow}>
          <Button
            title="Copy Address"
            onPress={handleCopy}
            icon={<Ionicons name="copy-outline" size={18} color="#FFFFFF" />}
            style={styles.actionBtn}
          />

          <Button
            title="Share"
            variant="secondary"
            onPress={handleShare}
            icon={<Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  networkHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  networkTitle: {
    ...TYPOGRAPHY.h2,
  },
  networkSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  qrWrapper: {
    marginVertical: SPACING.md,
  },
  addressCard: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  addressLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  addressText: {
    ...TYPOGRAPHY.mono,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  warnIcon: {
    marginRight: SPACING.sm,
  },
  warningText: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  actionBtn: {
    flex: 1,
  },
});
