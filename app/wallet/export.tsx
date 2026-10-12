import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { PinPad } from '../../src/components/PinPad';
import { Toast } from '../../src/components/Toast';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { walletService } from '../../src/services/walletService';

export default function ExportPrivateKeyScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [pin, setPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleDigitPress = async (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === 6) {
      try {
        const key = await walletService.getStoredPrivateKey(nextPin);
        setPrivateKey(key);
        setIsUnlocked(true);
      } catch (err: unknown) {
        setErrorMsg((err as Error).message || 'Incorrect PIN.');
        setPin('');
      }
    }
  };

  const handleDeletePress = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  const handleCopyKey = () => {
    Alert.alert(
      'EXTREME SECURITY WARNING',
      'Anyone who gets your private key can steal ALL your assets instantly. TRITO support will NEVER ask for this key. Proceed with extreme caution.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Key',
          style: 'destructive',
          onPress: async () => {
            if (privateKey) {
              await Clipboard.setStringAsync(privateKey);
              setToastMsg('Private key copied to clipboard');
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <Header title="Export Private Key" showBack />

      {!isUnlocked ? (
        <View style={styles.pinContainer}>
          <View style={styles.pinHeader}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={[styles.pinTitle, { color: colors.textPrimary }]}>Security Gate</Text>
            <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
              Enter your 6-digit PIN to authorize exporting your Ethereum private key.
            </Text>
          </View>

          {errorMsg ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
          ) : null}

          <View style={styles.pinPadWrap}>
            <PinPad
              pin={pin}
              maxDigits={6}
              onDigitPress={handleDigitPress}
              onDeletePress={handleDeletePress}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.revealedContent}>
          {/* Critical Warning Box */}
          <View
            style={[
              styles.dangerBox,
              { backgroundColor: colors.dangerBackground, borderColor: colors.danger },
            ]}
          >
            <Ionicons name="warning" size={24} color={colors.danger} />
            <Text style={[styles.dangerText, { color: colors.danger }]}>
              DO NOT SHARE THIS KEY. Anyone with access to your private key has full, irreversible
              control of your funds.
            </Text>
          </View>

          <Text style={[styles.keyLabel, { color: colors.textSecondary }]}>
            Ethereum Private Key (Raw Hex)
          </Text>

          <View
            style={[
              styles.keyBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              selectable
              style={[styles.keyText, { color: colors.textPrimary }]}
            >
              {revealed
                ? privateKey
                : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
            </Text>

            <Button
              title={revealed ? 'Hide Private Key' : 'Reveal Private Key'}
              variant="secondary"
              size="sm"
              onPress={() => setRevealed(!revealed)}
              icon={
                <Ionicons
                  name={revealed ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color={colors.textPrimary}
                />
              }
              style={styles.revealBtn}
            />
          </View>

          <Button
            title="Copy Private Key"
            variant="danger"
            onPress={handleCopyKey}
            icon={<Ionicons name="copy-outline" size={18} color="#FFFFFF" />}
            style={styles.copyBtn}
          />

          <Button
            title="Done"
            size="lg"
            variant="outline"
            onPress={() => router.back()}
            style={styles.doneBtn}
          />
        </ScrollView>
      )}

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinHeader: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    maxWidth: 320,
  },
  pinTitle: {
    ...TYPOGRAPHY.h2,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  pinSubtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
  },
  pinPadWrap: {
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  revealedContent: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  dangerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  dangerText: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
    lineHeight: 18,
  },
  keyLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  keyBox: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  keyText: {
    ...TYPOGRAPHY.mono,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  revealBtn: {
    minWidth: 160,
  },
  copyBtn: {
    marginBottom: SPACING.md,
  },
  doneBtn: {
    marginBottom: SPACING.xxl,
  },
});
