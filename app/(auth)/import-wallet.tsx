import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { validateMnemonic, validatePrivateKey } from '../../src/utils/validation';

export default function ImportWalletScreen() {
  const router = useRouter();
  const { importWallet } = useAuth();
  const { colors } = useTheme();

  const [importType, setImportType] = useState<'seed' | 'privateKey'>('seed');
  const [secretInput, setSecretInput] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleImport = async () => {
    setError('');

    // Validate Secret
    if (importType === 'seed') {
      const val = validateMnemonic(secretInput);
      if (!val.isValid) {
        setError(val.error || 'Invalid 12-word seed phrase.');
        return;
      }
    } else {
      const val = validatePrivateKey(secretInput);
      if (!val.isValid) {
        setError(val.error || 'Invalid private key format.');
        return;
      }
    }

    // Validate PIN
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('Please create a 6-digit PIN.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      await importWallet(secretInput, pin);
      // Navigation is handled automatically by RootNavigation in _layout.tsx
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to import wallet.');
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title="Import Wallet" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Segmented Selector */}
          <View style={[styles.tabContainer, { backgroundColor: colors.surfaceLight }]}>
            <TouchableOpacity
              onPress={() => {
                setImportType('seed');
                setError('');
              }}
              style={[
                styles.tabBtn,
                importType === 'seed' && { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: importType === 'seed' ? colors.primaryLight : colors.textSecondary,
                  },
                ]}
              >
                12-Word Seed Phrase
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setImportType('privateKey');
                setError('');
              }}
              style={[
                styles.tabBtn,
                importType === 'privateKey' && { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      importType === 'privateKey' ? colors.primaryLight : colors.textSecondary,
                  },
                ]}
              >
                Private Key
              </Text>
            </TouchableOpacity>
          </View>

          {/* Security Notice */}
          <View
            style={[
              styles.warningBox,
              {
                backgroundColor: colors.warningBackground,
                borderColor: colors.warning,
              },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.warning} style={styles.warnIcon} />
            <Text style={[styles.warningText, { color: colors.textPrimary }]}>
              Never enter your credentials on untrusted devices. TRITO stores your keys exclusively
              in your device's hardware SecureStore and never transmits them.
            </Text>
          </View>

          {/* Secret Input */}
          <Input
            label={importType === 'seed' ? '12-Word Seed Phrase' : 'Ethereum Private Key (0x...)'}
            placeholder={
              importType === 'seed'
                ? 'Enter your 12 words separated by spaces...'
                : 'Enter your 64-character hex private key...'
            }
            multiline
            numberOfLines={4}
            value={secretInput}
            onChangeText={(text) => {
              setSecretInput(text);
              setError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={importType === 'privateKey'}
            style={styles.textArea}
          />

          {/* PIN Setup */}
          <Input
            label="Create 6-Digit App PIN"
            placeholder="Enter 6-digit numeric PIN"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={pin}
            onChangeText={(text) => {
              setPin(text);
              setError('');
            }}
          />

          <Input
            label="Confirm 6-Digit PIN"
            placeholder="Re-enter 6-digit PIN"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={confirmPin}
            onChangeText={(text) => {
              setConfirmPin(text);
              setError('');
            }}
          />

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}

          <Button
            title={loading ? 'Validating & Importing...' : 'Import Wallet'}
            size="lg"
            onPress={handleImport}
            loading={loading}
            disabled={!secretInput.trim() || pin.length !== 6 || confirmPin.length !== 6 || loading}
            style={styles.importBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabText: {
    ...TYPOGRAPHY.captionBold,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  warnIcon: {
    marginRight: SPACING.md,
  },
  warningText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  importBtn: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
});
