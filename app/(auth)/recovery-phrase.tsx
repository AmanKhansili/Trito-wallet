import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Toast } from '../../src/components/Toast';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';

export default function RecoveryPhraseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pin: string }>();
  const { pendingCreationData } = useAuth();
  const { colors } = useTheme();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const mnemonicWords = pendingCreationData?.mnemonicPhrase
    ? pendingCreationData.mnemonicPhrase.split(' ')
    : [];

  const handleCopy = async () => {
    Alert.alert(
      'Clipboard Security Warning',
      'Copying your seed phrase to the clipboard can expose it to malicious apps on your device. We strongly recommend writing it down on paper and storing it in a secure location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Anyway',
          style: 'destructive',
          onPress: async () => {
            if (pendingCreationData?.mnemonicPhrase) {
              await Clipboard.setStringAsync(pendingCreationData.mnemonicPhrase);
              setToastMessage('Seed phrase copied to clipboard');
            }
          },
        },
      ],
    );
  };

  const handleContinue = () => {
    router.push({
      pathname: '/(auth)/verify-recovery',
      params: { pin: params.pin },
    });
  };

  return (
    <ScreenWrapper>
      <Header title="Secret Recovery Phrase" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topInfo}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Write Down Your Recovery Phrase
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            These 12 words are the ONLY way to recover your funds if you lose your phone or forget
            your PIN. Never share them with anyone.
          </Text>
        </View>

        {/* 12-Word Grid */}
        <View style={styles.wordsGrid}>
          {mnemonicWords.map((word, index) => (
            <View
              key={index}
              style={[
                styles.wordCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.wordNumber, { color: colors.textTertiary }]}>
                {index + 1}.
              </Text>
              <Text style={[styles.wordText, { color: colors.textPrimary }]}>{word}</Text>
            </View>
          ))}
        </View>

        {/* Warning Banner */}
        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: colors.warningBackground,
              borderColor: colors.warning,
            },
          ]}
        >
          <Ionicons name="warning-outline" size={24} color={colors.warning} style={styles.warningIcon} />
          <Text style={[styles.warningText, { color: colors.textPrimary }]}>
            TRITO cannot recover your wallet if you lose these words. Store them offline in a safe
            place.
          </Text>
        </View>

        {/* Copy Button */}
        <Button
          title="Copy to Clipboard"
          variant="outline"
          onPress={handleCopy}
          icon={<Ionicons name="copy-outline" size={18} color={colors.primary} />}
          style={styles.copyBtn}
        />

        {/* Continue Button */}
        <Button
          title="Continue to Verification"
          size="lg"
          onPress={handleContinue}
          style={styles.continueBtn}
        />
      </ScrollView>

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  topInfo: {
    marginVertical: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    lineHeight: 22,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: SPACING.md,
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  warningIcon: {
    marginRight: SPACING.md,
  },
  warningText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    lineHeight: 18,
  },
  copyBtn: {
    marginVertical: SPACING.sm,
  },
  continueBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
});
