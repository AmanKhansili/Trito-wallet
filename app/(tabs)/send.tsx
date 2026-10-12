import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { NetworkBadge } from '../../src/components/NetworkBadge';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast } from '../../src/components/Toast';
import { useWallet } from '../../src/context/WalletContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { getExplorerTxUrl } from '../../src/config/networks';
import { TokenConfig, GasEstimate } from '../../src/types';
import {
  formatTokenBalance,
  parseTokenAmount,
  formatFiat,
  shortenAddress,
} from '../../src/utils/formatters';
import { validateAddress, validateSendAmount } from '../../src/utils/validation';
import { transactionService } from '../../src/services/transactionService';

export default function SendScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ asset?: string }>();
  const { address, network, tokenBalances, ethBalance, marketPrices, currencyPreference, addTransaction } =
    useWallet();
  const { colors } = useTheme();

  // Selected Token
  const [selectedSymbol, setSelectedSymbol] = useState<string>(searchParams.asset || 'ETH');
  const selectedTokenBalance = useMemo(() => {
    return tokenBalances.find((b) => b.token.symbol === selectedSymbol) || tokenBalances[0];
  }, [tokenBalances, selectedSymbol]);

  const selectedToken: TokenConfig = selectedTokenBalance?.token;

  // Form State
  const [recipient, setRecipient] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Confirmation & Broadcast States
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

  // Paste from clipboard
  const handlePasteRecipient = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setRecipient(text.trim());
      setErrorMsg('');
    }
  };

  // Estimate Gas dynamically whenever recipient, token, or amount updates
  const updateGasEstimate = useCallback(async () => {
    if (!address || !selectedToken) return;

    const trimmedRecipient = recipient.trim();
    const parsedAmount = parseTokenAmount(amountStr, selectedToken.decimals);

    setIsEstimatingGas(true);
    try {
      const targetAddress = validateAddress(trimmedRecipient).isValid
        ? trimmedRecipient
        : address; // Use self as fallback recipient for gas dry run

      const estimate = await transactionService.estimateGas(
        address,
        targetAddress,
        selectedToken,
        parsedAmount,
        network.id,
      );
      setGasEstimate(estimate);
    } catch {
      // Ignored
    } finally {
      setIsEstimatingGas(false);
    }
  }, [address, recipient, amountStr, selectedToken, network.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateGasEstimate();
    }, 400);
    return () => clearTimeout(timer);
  }, [updateGasEstimate]);

  // Set MAX amount
  const handleMax = () => {
    if (!selectedTokenBalance) return;

    if (selectedToken.type === 'NATIVE') {
      const gasFeeWei = gasEstimate ? gasEstimate.totalCostWei : 21000n * 30000000000n;
      const rawBal = selectedTokenBalance.balanceRaw;
      if (rawBal > gasFeeWei) {
        const sendable = rawBal - gasFeeWei;
        setAmountStr(formatTokenBalance(sendable, selectedToken.decimals, 8));
      } else {
        setAmountStr('0');
      }
    } else {
      setAmountStr(selectedTokenBalance.balanceFormatted);
    }
    setErrorMsg('');
  };

  // Pre-flight checks before opening security modal
  const handleReviewSend = () => {
    setErrorMsg('');

    const addrVal = validateAddress(recipient);
    if (!addrVal.isValid) {
      setErrorMsg(addrVal.error || 'Invalid recipient address.');
      return;
    }

    if (!selectedTokenBalance) {
      setErrorMsg('Token balance not loaded.');
      return;
    }

    const amountRaw = parseTokenAmount(amountStr, selectedToken.decimals);
    const gasWei = gasEstimate ? gasEstimate.totalCostWei : 0n;
    const ethBalRaw = ethBalance ? ethBalance.balanceRaw : 0n;

    const amountVal = validateSendAmount(
      amountRaw,
      selectedTokenBalance.balanceRaw,
      selectedToken.type === 'NATIVE',
      gasWei,
      ethBalRaw,
    );

    if (!amountVal.isValid) {
      setErrorMsg(amountVal.error || 'Invalid amount.');
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute on-chain send and wait for receipt confirmation
  const handleConfirmSend = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const amountRaw = parseTokenAmount(amountStr, selectedToken.decimals);
      let result;

      if (selectedToken.type === 'NATIVE') {
        result = await transactionService.sendNativeETH(
          recipient.trim(),
          amountRaw,
          network.id,
          gasEstimate || undefined,
        );
      } else {
        result = await transactionService.sendERC20(
          recipient.trim(),
          selectedToken,
          amountRaw,
          network.id,
          gasEstimate || undefined,
        );
      }

      setTxSuccessHash(result.hash);
      setShowConfirmModal(false);
      setToastMsg('Transaction submitted and confirmed!');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Transaction failed.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tokenPriceUsd = marketPrices[selectedToken?.coingeckoId || '']?.usd || 0;
  const parsedFloat = parseFloat(amountStr) || 0;
  const amountUsd = parsedFloat * tokenPriceUsd;

  return (
    <ScreenWrapper>
      <Header title="Send Crypto" showBack rightElement={<NetworkBadge />} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Asset Selector Chips */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Select Asset</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tokenScroll}
          >
            {tokenBalances.map((tb) => {
              const isSelected = tb.token.symbol === selectedSymbol;
              return (
                <TouchableOpacity
                  key={tb.token.symbol}
                  onPress={() => {
                    setSelectedSymbol(tb.token.symbol);
                    setAmountStr('');
                    setErrorMsg('');
                  }}
                  style={[
                    styles.tokenChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenChipText,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {tb.token.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.tokenChipBal,
                      { color: isSelected ? '#E0EDFF' : colors.textSecondary },
                    ]}
                  >
                    {tb.balanceFormatted}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Recipient Address Input */}
          <Input
            label="Recipient Address"
            placeholder="0x..."
            value={recipient}
            onChangeText={(txt) => {
              setRecipient(txt);
              setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            rightElement={
              <TouchableOpacity onPress={handlePasteRecipient} style={styles.pasteBtn}>
                <Text style={[styles.pasteText, { color: colors.primaryLight }]}>PASTE</Text>
              </TouchableOpacity>
            }
          />

          {/* Amount Input */}
          <Input
            label={`Amount (${selectedToken?.symbol || ''})`}
            placeholder="0.0"
            keyboardType="decimal-pad"
            value={amountStr}
            onChangeText={(txt) => {
              setAmountStr(txt);
              setErrorMsg('');
            }}
            hint={`Balance: ${selectedTokenBalance?.balanceFormatted || '0'} ${
              selectedToken?.symbol || ''
            } (≈ ${formatFiat(amountUsd, currencyPreference)})`}
            rightElement={
              <TouchableOpacity onPress={handleMax} style={styles.maxBtn}>
                <Text style={[styles.maxText, { color: colors.primaryLight }]}>MAX</Text>
              </TouchableOpacity>
            }
          />

          {/* Gas & Fee Overview Card */}
          <View
            style={[
              styles.feeCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Network</Text>
              <Text style={[styles.feeValue, { color: colors.textPrimary }]}>{network.name}</Text>
            </View>

            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                Estimated Network Fee
              </Text>
              {isEstimatingGas ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.feeValue, { color: colors.textPrimary }]}>
                  {gasEstimate ? `${Number(gasEstimate.totalCostEth).toFixed(5)} ETH` : 'Estimating...'}
                  {gasEstimate ? ` (${formatFiat(gasEstimate.totalCostUsd, currencyPreference)})` : ''}
                </Text>
              )}
            </View>

            <View style={[styles.feeRow, styles.totalRow]}>
              <Text style={[styles.feeLabelBold, { color: colors.textPrimary }]}>Total Amount</Text>
              <Text style={[styles.feeValueBold, { color: colors.primaryLight }]}>
                {amountStr || '0'} {selectedToken?.symbol}{' '}
                {selectedToken?.type === 'NATIVE' && gasEstimate
                  ? `+ ${Number(gasEstimate.totalCostEth).toFixed(4)} gas`
                  : ''}
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {errorMsg ? (
            <View
              style={[
                styles.errorCard,
                { backgroundColor: colors.dangerBackground, borderColor: colors.danger },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={[styles.errorCardText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Success Card with Etherscan Explorer Button */}
          {txSuccessHash ? (
            <View
              style={[
                styles.successCard,
                { backgroundColor: colors.successBackground, borderColor: colors.success },
              ]}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={[styles.successTitle, { color: colors.success }]}>
                Transaction Confirmed!
              </Text>
              <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                Broadcasted and mined on {network.name}.
              </Text>

              <Button
                title="View on Block Explorer"
                variant="outline"
                size="sm"
                onPress={() => Linking.openURL(getExplorerTxUrl(network.id, txSuccessHash))}
                icon={<Ionicons name="open-outline" size={16} color={colors.primary} />}
                style={styles.explorerBtn}
              />
            </View>
          ) : null}

          <Button
            title="Review & Send"
            size="lg"
            onPress={handleReviewSend}
            disabled={!recipient.trim() || !amountStr.trim() || isSubmitting}
            style={styles.sendActionBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={showConfirmModal}
        title="Confirm Transfer"
        subtitle={`Sending on ${network.name}`}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSend}
        loading={isSubmitting}
        confirmTitle="Sign & Send"
      >
        <View style={styles.modalBody}>
          <View style={styles.modalRow}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Recipient:</Text>
            <Text style={[styles.modalValue, { color: colors.textPrimary }]}>
              {shortenAddress(recipient, 8, 6)}
            </Text>
          </View>

          <View style={styles.modalRow}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Amount:</Text>
            <Text style={[styles.modalValueBold, { color: colors.textPrimary }]}>
              {amountStr} {selectedToken?.symbol} ({formatFiat(amountUsd, currencyPreference)})
            </Text>
          </View>

          <View style={styles.modalRow}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Gas Fee:</Text>
            <Text style={[styles.modalValue, { color: colors.textPrimary }]}>
              {gasEstimate ? `${Number(gasEstimate.totalCostEth).toFixed(5)} ETH` : 'Calculating'}
            </Text>
          </View>

          <Text style={[styles.modalWarning, { color: colors.warning }]}>
            All transactions are irreversible once submitted to the blockchain.
          </Text>
        </View>
      </ConfirmModal>

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sectionLabel: {
    ...TYPOGRAPHY.captionBold,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  tokenScroll: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tokenChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  tokenChipText: {
    ...TYPOGRAPHY.bodyBold,
  },
  tokenChipBal: {
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
  maxBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  maxText: {
    ...TYPOGRAPHY.captionBold,
  },
  feeCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  feeLabel: {
    ...TYPOGRAPHY.caption,
  },
  feeValue: {
    ...TYPOGRAPHY.captionBold,
  },
  feeLabelBold: {
    ...TYPOGRAPHY.bodyBold,
  },
  feeValueBold: {
    ...TYPOGRAPHY.bodyBold,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  errorCardText: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
  },
  successCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  successTitle: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.xs,
  },
  successSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  explorerBtn: {
    marginTop: SPACING.xs,
  },
  sendActionBtn: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  modalBody: {
    gap: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLabel: {
    ...TYPOGRAPHY.caption,
  },
  modalValue: {
    ...TYPOGRAPHY.captionBold,
  },
  modalValueBold: {
    ...TYPOGRAPHY.bodyBold,
  },
  modalWarning: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
});
