import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';

export default function VerifyRecoveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pin: string }>();
  const { pendingCreationData, finalizeCreation } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const mnemonicWords = useMemo(() => {
    return pendingCreationData?.mnemonicPhrase
      ? pendingCreationData.mnemonicPhrase.split(' ')
      : [];
  }, [pendingCreationData]);

  // Choose 3 distinct indices to test (e.g. indices 2, 6, 10 -> Words 3, 7, 11)
  const testIndices = useMemo(() => [2, 6, 10], []);

  // Store selected word for each test index
  const [selectedWords, setSelectedWords] = useState<Record<number, string>>({});

  // Shuffled word options pool
  const candidatePool = useMemo(() => {
    return [...mnemonicWords].sort(() => Math.random() - 0.5);
  }, [mnemonicWords]);

  const handleSelectWord = (targetIndex: number, word: string) => {
    setSelectedWords((prev) => ({
      ...prev,
      [targetIndex]: word,
    }));
    setErrorMessage('');
  };

  const isAllAnswered = testIndices.every((idx) => selectedWords[idx] !== undefined);

  const handleVerify = async () => {
    // Check correctness
    for (const idx of testIndices) {
      if (selectedWords[idx] !== mnemonicWords[idx]) {
        setErrorMessage(`Word #${idx + 1} is incorrect. Please verify your backup.`);
        return;
      }
    }

    if (!params.pin) {
      setErrorMessage('PIN missing. Please restart wallet creation.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await finalizeCreation(params.pin);
      // Navigation to tabs is handled automatically by RootNavigation in _layout.tsx
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to complete wallet setup.');
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title="Verify Recovery Phrase" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topInfo}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Verify Your Backup</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select the correct words from your phrase below to verify you have safely written them down.
          </Text>
        </View>

        {/* Test Questions */}
        {testIndices.map((targetIdx) => {
          const selected = selectedWords[targetIdx];
          return (
            <View
              key={targetIdx}
              style={[
                styles.questionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.questionLabel, { color: colors.textSecondary }]}>
                Select Word #{targetIdx + 1}:
              </Text>
              <Text
                style={[
                  styles.selectedAnswer,
                  { color: selected ? colors.primaryLight : colors.textTertiary },
                ]}
              >
                {selected || '[ Tap a word below ]'}
              </Text>

              {/* Options for this word */}
              <View style={styles.optionsGrid}>
                {candidatePool.map((candidate, cIdx) => (
                  <TouchableOpacity
                    key={`${targetIdx}-${cIdx}`}
                    onPress={() => handleSelectWord(targetIdx, candidate)}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          selected === candidate ? colors.primary : colors.surfaceLight,
                        borderColor:
                          selected === candidate ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: selected === candidate ? '#FFFFFF' : colors.textPrimary,
                        },
                      ]}
                    >
                      {candidate}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        <Button
          title={loading ? 'Finalizing Secure Wallet...' : 'Verify and Create Wallet'}
          size="lg"
          disabled={!isAllAnswered || loading}
          loading={loading}
          onPress={handleVerify}
          style={styles.verifyBtn}
        />
      </ScrollView>
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
  questionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  questionLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
  },
  selectedAnswer: {
    ...TYPOGRAPHY.h3,
    marginVertical: SPACING.xs,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs + 2,
    marginTop: SPACING.sm,
  },
  optionChip: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  optionText: {
    ...TYPOGRAPHY.captionBold,
  },
  errorText: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  verifyBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
});
