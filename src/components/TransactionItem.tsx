import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRecord } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { formatTimestamp, shortenHash } from '../utils/formatters';

interface TransactionItemProps {
  transaction: TransactionRecord;
  onPress: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onPress }) => {
  const { colors } = useTheme();

  const getStatusColor = () => {
    switch (transaction.status) {
      case 'confirmed':
        return colors.success;
      case 'failed':
        return colors.danger;
      case 'pending':
      default:
        return colors.warning;
    }
  };

  const getTypeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (transaction.type) {
      case 'send':
        return 'arrow-up-circle-outline';
      case 'receive':
        return 'arrow-down-circle-outline';
      case 'swap':
        return 'swap-horizontal-outline';
      default:
        return 'document-text-outline';
    }
  };

  const getTitle = () => {
    switch (transaction.type) {
      case 'send':
        return `Sent ${transaction.tokenSymbol}`;
      case 'receive':
        return `Received ${transaction.tokenSymbol}`;
      case 'swap':
        return `Swapped ${transaction.tokenSymbol} → ${
          transaction.swapDetails?.toTokenSymbol || 'Token'
        }`;
      default:
        return 'Transaction';
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
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.surfaceLight },
          ]}
        >
          <Ionicons name={getTypeIcon()} size={24} color={getStatusColor()} />
        </View>
        <View style={styles.details}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{getTitle()}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {formatTimestamp(transaction.timestamp)} • {shortenHash(transaction.hash)}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.amount, { color: colors.textPrimary }]}>
          {transaction.type === 'send' ? '-' : '+'}
          {transaction.amount} {transaction.tokenSymbol}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
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
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  details: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.bodyBold,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    ...TYPOGRAPHY.bodyBold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'capitalize',
  },
});
