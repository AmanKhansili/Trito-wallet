import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';

interface NetworkBadgeProps {
  onPress?: () => void;
  showIcon?: boolean;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ onPress }) => {
  const { network } = useWallet();
  const { colors } = useTheme();

  const isMainnet = network.id === 'mainnet';
  const dotColor = isMainnet ? colors.success : colors.warning;

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>{network.name}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs + 2,
  },
  text: {
    ...TYPOGRAPHY.captionBold,
  },
});
