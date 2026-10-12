import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';

interface PinPadProps {
  pin: string;
  maxDigits?: number;
  onDigitPress: (digit: string) => void;
  onDeletePress: () => void;
  onBiometricPress?: () => void;
  showBiometric?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({
  pin,
  maxDigits = 6,
  onDigitPress,
  onDeletePress,
  onBiometricPress,
  showBiometric = false,
}) => {
  const { colors } = useTheme();

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={styles.container}>
      {/* PIN Dots indicator */}
      <View style={styles.dotsRow}>
        {Array.from({ length: maxDigits }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  borderColor: isFilled ? colors.primary : colors.borderStrong,
                  backgroundColor: isFilled ? colors.primary : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>

      {/* 3x4 Keypad */}
      <View style={styles.keysGrid}>
        {digits.map((digit) => (
          <TouchableOpacity
            key={digit}
            onPress={() => onDigitPress(digit)}
            activeOpacity={0.6}
            style={[styles.keyButton, { backgroundColor: colors.surfaceSubtle }]}
          >
            <Text style={[styles.keyText, { color: colors.textPrimary }]}>{digit}</Text>
          </TouchableOpacity>
        ))}

        {/* Row 4: Biometric / 0 / Backspace */}
        {showBiometric && onBiometricPress ? (
          <TouchableOpacity
            onPress={onBiometricPress}
            activeOpacity={0.6}
            style={[styles.keyButton, { backgroundColor: colors.surfaceSubtle }]}
          >
            <Ionicons name="finger-print" size={28} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.keyButtonEmpty} />
        )}

        <TouchableOpacity
          onPress={() => onDigitPress('0')}
          activeOpacity={0.6}
          style={[styles.keyButton, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Text style={[styles.keyText, { color: colors.textPrimary }]}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDeletePress}
          activeOpacity={0.6}
          style={[styles.keyButton, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginHorizontal: SPACING.sm,
  },
  keysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 320,
    gap: SPACING.md,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyButtonEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
});
