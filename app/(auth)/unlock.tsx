import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { PinPad } from '../../src/components/PinPad';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../src/constants/theme';

export default function UnlockScreen() {
  const { unlockWithPin, unlockWithBiometrics, isBiometricsEnabled, isBiometricsSupported } =
    useAuth();
  const { colors } = useTheme();

  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Attempt biometric unlock automatically on mount if enabled
  useEffect(() => {
    let isMounted = true;
    async function tryBiometric() {
      if (isBiometricsSupported && isBiometricsEnabled) {
        const success = await unlockWithBiometrics();
        if (!success && isMounted) {
          // If biometric cancelled or failed, allow PIN entry
        }
      }
    }
    tryBiometric();

    return () => {
      isMounted = false;
    };
  }, [isBiometricsSupported, isBiometricsEnabled, unlockWithBiometrics]);

  const handleDigitPress = async (digit: string) => {
    if (loading || pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 6) {
      setLoading(true);
      try {
        const success = await unlockWithPin(nextPin);
        if (!success) {
          setErrorMessage('Incorrect PIN. Please try again.');
          setPin('');
        }
      } catch (err: unknown) {
        setErrorMessage((err as Error).message || 'Failed to unlock wallet.');
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeletePress = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceLight }]}>
            <MaterialCommunityIcons name="lock-check-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>TRITO</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your 6-digit PIN to unlock your wallet
          </Text>
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <View style={styles.padSection}>
          <PinPad
            pin={pin}
            maxDigits={6}
            onDigitPress={handleDigitPress}
            onDeletePress={handleDeletePress}
            onBiometricPress={unlockWithBiometrics}
            showBiometric={isBiometricsSupported && isBiometricsEnabled}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topSection: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h1,
    letterSpacing: 1,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
  },
  padSection: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
});
