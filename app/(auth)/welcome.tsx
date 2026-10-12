import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ScreenWrapper style={styles.container}>
      {/* Top Branding Section */}
      <View style={styles.topSection}>
        <View style={[styles.logoContainer, { backgroundColor: colors.surfaceLight }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={54} color={colors.primary} />
        </View>

        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>TRITO</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Your wallet. Your keys. Your crypto.
        </Text>
      </View>

      {/* Middle Security Feature Card */}
      <View
        style={[
          styles.securityCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.featureRow}>
          <Ionicons name="key-outline" size={20} color={colors.accent} style={styles.featureIcon} />
          <Text style={[styles.featureText, { color: colors.textPrimary }]}>
            TRITO is a non-custodial wallet. You control your private keys.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.featureRow}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={colors.success}
            style={styles.featureIcon}
          />
          <Text style={[styles.featureText, { color: colors.textPrimary }]}>
            Hardware-backed SecureStore encryption & local transaction signing.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.featureRow}>
          <Ionicons
            name="globe-outline"
            size={20}
            color={colors.primaryLight}
            style={styles.featureIcon}
          />
          <Text style={[styles.featureText, { color: colors.textPrimary }]}>
            Ethereum Sepolia testnet ready with native Ethereum Mainnet support.
          </Text>
        </View>
      </View>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomSection}>
        <Button
          title="Create New Wallet"
          onPress={() => router.push('/(auth)/create-wallet')}
          size="lg"
          style={styles.mainButton}
        />

        <Button
          title="Import Existing Wallet"
          variant="outline"
          onPress={() => router.push('/(auth)/import-wallet')}
          size="lg"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  topSection: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  brandTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 36,
    letterSpacing: 1.5,
  },
  tagline: {
    ...TYPOGRAPHY.subtitle,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  securityCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginVertical: SPACING.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  featureIcon: {
    marginRight: SPACING.md,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    flex: 1,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: SPACING.xs,
  },
  bottomSection: {
    marginBottom: SPACING.lg,
  },
  mainButton: {
    marginBottom: SPACING.md,
  },
});
