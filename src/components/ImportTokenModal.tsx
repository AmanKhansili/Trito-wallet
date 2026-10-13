import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';
import { Input } from './Input';
import { tokenService } from '../services/tokenService';
import { TokenConfig } from '../types';

interface ImportTokenModalProps {
  visible: boolean;
  onClose: () => void;
  onTokenImported?: (token: TokenConfig) => void;
}

export const ImportTokenModal: React.FC<ImportTokenModalProps> = ({
  visible,
  onClose,
  onTokenImported,
}) => {
  const { colors } = useTheme();
  const { network, addCustomToken } = useWallet();

  const [contractAddress, setContractAddress] = useState<string>('');
  const [detecting, setDetecting] = useState<boolean>(false);
  const [detectedToken, setDetectedToken] = useState<TokenConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setContractAddress(text.trim());
      setErrorMsg('');
      setDetectedToken(null);
    }
  };

  const handleDetect = async () => {
    if (!contractAddress.trim()) {
      setErrorMsg('Please enter or paste a contract address.');
      return;
    }

    setDetecting(true);
    setErrorMsg('');
    setDetectedToken(null);

    try {
      const metadata = await tokenService.fetchTokenMetadata(
        contractAddress.trim(),
        network.id,
      );
      setDetectedToken(metadata);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to detect ERC-20 contract.');
    } finally {
      setDetecting(false);
    }
  };

  const handleImport = async () => {
    if (!detectedToken) return;
    try {
      await addCustomToken(detectedToken);
      onTokenImported?.(detectedToken);
      setContractAddress('');
      setDetectedToken(null);
      setErrorMsg('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to save token.');
    }
  };

  const handleClose = () => {
    setContractAddress('');
    setDetectedToken(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
              ]}
            >
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>Import Custom Token</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Detect token directly from {network.name} RPC
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Input
                label="Contract Address"
                placeholder="0x..."
                value={contractAddress}
                onChangeText={(txt) => {
                  setContractAddress(txt);
                  setErrorMsg('');
                  setDetectedToken(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                rightElement={
                  <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn}>
                    <Text style={[styles.pasteText, { color: colors.primaryLight }]}>PASTE</Text>
                  </TouchableOpacity>
                }
              />

              <Button
                title={detecting ? 'Querying Blockchain RPC...' : 'Detect Token'}
                variant="secondary"
                size="md"
                onPress={handleDetect}
                disabled={detecting || !contractAddress.trim()}
                loading={detecting}
                style={styles.detectBtn}
              />

              {detectedToken ? (
                <View
                  style={[
                    styles.detectedCard,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.primary },
                  ]}
                >
                  <View style={styles.tokenRow}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.surfaceLight }]}>
                      <Ionicons name="cube-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.tokenInfo}>
                      <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>
                        {detectedToken.symbol}
                      </Text>
                      <Text style={[styles.tokenName, { color: colors.textSecondary }]}>
                        {detectedToken.name}
                      </Text>
                    </View>
                    <View style={[styles.decimalBadge, { backgroundColor: colors.surfaceHighlight }]}>
                      <Text style={[styles.decimalText, { color: colors.primaryLight }]}>
                        {detectedToken.decimals} Decimals
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {errorMsg ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
              ) : null}

              <Button
                title="Add to Wallet"
                size="lg"
                onPress={handleImport}
                disabled={!detectedToken}
                style={styles.importBtn}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h2,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  pasteBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pasteText: {
    ...TYPOGRAPHY.captionBold,
  },
  detectBtn: {
    marginBottom: SPACING.md,
  },
  detectedCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    ...TYPOGRAPHY.bodyBold,
  },
  tokenName: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  decimalBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  decimalText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  errorText: {
    ...TYPOGRAPHY.captionBold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  importBtn: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
});
