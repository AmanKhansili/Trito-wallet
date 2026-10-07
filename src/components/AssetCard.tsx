import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TokenBalance, CurrencyPreference, MarketPrice } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { formatFiat, formatPercentage } from '../utils/formatters';

interface AssetCardProps {
  balance: TokenBalance;
  marketPrice?: MarketPrice;
  currencyPreference: CurrencyPreference;
  onPress?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  balance,
  marketPrice,
  currencyPreference,
  onPress,
}) => {
  const { colors } = useTheme();
  const { token, balanceFormatted, balanceUsd, balanceInr } = balance;

  const fiatValue = currencyPreference === 'INR' ? balanceInr : balanceUsd;
  const change = marketPrice?.usd24hChange ?? 0;
  const isPositive = change >= 0;

  const getTokenIconName = (symbol: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    switch (symbol.toUpperCase()) {
      case 'ETH':
        return 'ethereum';
      case 'USDC':
        return 'circle-multiple-outline';
      case 'USDT':
        return 'currency-usd-circle';
      case 'DAI':
        return 'alpha-d-box-outline';
      case 'LINK':
        return 'link-variant';
      default:
        return 'circle-slice-8';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.leftSection}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceLight }]}>
          <MaterialCommunityIcons
            name={getTokenIconName(token.symbol)}
            size={24}
            color={colors.primaryLight}
          />
        </View>
        <View style={styles.tokenInfo}>
          <Text style={[styles.symbol, { color: colors.textPrimary }]}>{token.symbol}</Text>
          <Text style={[styles.name, { color: colors.textSecondary }]}>{token.name}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.balance, { color: colors.textPrimary }]}>
          {balanceFormatted} {token.symbol}
        </Text>
        <View style={styles.fiatRow}>
          <Text style={[styles.fiat, { color: colors.textSecondary }]}>
            {formatFiat(fiatValue, currencyPreference)}
          </Text>
          <Text
            style={[
              styles.change,
              { color: isPositive ? colors.success : colors.danger },
            ]}
          >
            {formatPercentage(change)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  tokenInfo: {
    flex: 1,
  },
  symbol: {
    ...TYPOGRAPHY.bodyBold,
  },
  name: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  balance: {
    ...TYPOGRAPHY.bodyBold,
  },
  fiatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  fiat: {
    ...TYPOGRAPHY.caption,
    marginRight: SPACING.xs,
  },
  change: {
    ...TYPOGRAPHY.captionBold,
  },
});
