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

export default function BackupWalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [pin, setPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [mnemonicPhrase, setMnemonicPhrase] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleDigitPress = async (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === 6) {
      try {
        const phrase = await walletService.getStoredRecoveryPhrase(nextPin);
        setMnemonicPhrase(phrase);
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

  const handleCopyPhrase = () => {
    Alert.alert(
      'Clipboard Security Warning',
      'Copying your seed phrase to the clipboard is risky. Never paste it into websites or send it to anyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          style: 'destructive',
          onPress: async () => {
            if (mnemonicPhrase) {
              await Clipboard.setStringAsync(mnemonicPhrase);
              setToastMsg('Seed phrase copied');
            }
          },
        },
      ],
    );
  };

  const words = mnemonicPhrase ? mnemonicPhrase.split(' ') : [];

  return (
    <ScreenWrapper>
      <Header title="Backup Seed Phrase" showBack />

      {!isUnlocked ? (
        <View style={styles.pinContainer}>
          <View style={styles.pinHeader}>
            <Ionicons name="shield-half-outline" size={48} color={colors.warning} />
            <Text style={[styles.pinTitle, { color: colors.textPrimary }]}>
              Enter PIN to View Phrase
            </Text>
            <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
              For your protection, enter your 6-digit PIN before revealing your secret recovery phrase.
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
          {mnemonicPhrase ? (
            <>
              <View style={styles.topInfo}>
                <Text style={[styles.revealedTitle, { color: colors.textPrimary }]}>
                  Your Secret 12-Word Phrase
                </Text>
                <Text style={[styles.revealedSubtitle, { color: colors.textSecondary }]}>
                  Make sure no one is looking at your screen. Store these words in a secure offline
                  location.
                </Text>
              </View>

              <View style={styles.wordsGrid}>
                {words.map((word, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.wordCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.wordNumber, { color: colors.textTertiary }]}>
                      {idx + 1}.
                    </Text>
                    <Text style={[styles.wordText, { color: colors.textPrimary }]}>{word}</Text>
                  </View>
                ))}
              </View>

              <Button
                title="Copy to Clipboard"
                variant="outline"
                onPress={handleCopyPhrase}
                icon={<Ionicons name="copy-outline" size={18} color={colors.primary} />}
                style={styles.actionBtn}
              />

              <Button
                title="Done"
                size="lg"
                onPress={() => router.back()}
                style={styles.doneBtn}
              />
            </>
          ) : (
            <View style={styles.noMnemonicBox}>
              <Ionicons name="key-outline" size={48} color={colors.primary} />
              <Text style={[styles.noMnemonicTitle, { color: colors.textPrimary }]}>
                Imported via Private Key
              </Text>
              <Text style={[styles.noMnemonicSub, { color: colors.textSecondary }]}>
                This wallet was imported using a raw private key and does not have a 12-word seed
                phrase. You can backup your private key instead.
              </Text>
              <Button
                title="Export Private Key"
                size="lg"
                onPress={() => router.replace('/wallet/export')}
                style={styles.exportNavBtn}
              />
            </View>
          )}
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
  topInfo: {
    marginBottom: SPACING.lg,
  },
  revealedTitle: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  revealedSubtitle: {
    ...TYPOGRAPHY.body,
    lineHeight: 20,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  wordCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  wordNumber: {
    ...TYPOGRAPHY.captionBold,
    width: 28,
  },
  wordText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
  },
  actionBtn: {
    marginVertical: SPACING.sm,
  },
  doneBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  noMnemonicBox: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xxl,
  },
  noMnemonicTitle: {
    ...TYPOGRAPHY.h2,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  noMnemonicSub: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  exportNavBtn: {
    width: '100%',
  },
});
