import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { PinPad } from '../../src/components/PinPad';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../src/constants/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const { createWallet } = useAuth();
  const { colors } = useTheme();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState<string>('');
  const [firstPin, setFirstPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleDigitPress = (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 6) {
      if (step === 'create') {
        setFirstPin(nextPin);
        setPin('');
        setStep('confirm');
      } else {
        if (nextPin === firstPin) {
          // PIN verified, generate wallet and navigate to recovery phrase
          createWallet();
          router.push({
            pathname: '/(auth)/recovery-phrase',
            params: { pin: nextPin },
          });
        } else {
          setErrorMessage('PINs do not match. Please try again.');
          setPin('');
          setFirstPin('');
          setStep('create');
        }
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
      <Header
        title="Secure Your Wallet"
        showBack
        onBack={() => {
          if (step === 'confirm') {
            setStep('create');
            setPin('');
            setFirstPin('');
          } else {
            router.back();
          }
        }}
      />

      <View style={styles.content}>
        <View style={styles.instructionsContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {step === 'create' ? 'Create a 6-Digit PIN' : 'Confirm Your PIN'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 'create'
              ? 'This PIN will be used to unlock TRITO and authorize all transactions on this device.'
              : 'Re-enter your 6-digit PIN to ensure it is memorized.'}
          </Text>
        </View>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <View style={styles.padContainer}>
          <PinPad
            pin={pin}
            maxDigits={6}
            onDigitPress={handleDigitPress}
            onDeletePress={handleDeletePress}
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
    paddingVertical: SPACING.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    maxWidth: 320,
  },
  title: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  padContainer: {
    width: '100%',
    marginBottom: SPACING.xxl,
  },
});
