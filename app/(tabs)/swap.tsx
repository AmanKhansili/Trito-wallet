import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
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
import { TokenConfig, SwapQuote, SwapStepId } from '../../src/types';
import { formatTokenBalance, parseTokenAmount, formatFiat } from '../../src/utils/formatters';
import { swapService } from '../../src/services/swapService';

export default function SwapScreen() {
  const { network, tokenBalances, ethBalance, marketPrices, currencyPreference, refreshBalances } =
    useWallet();
  const { colors } = useTheme();

  // Selected Tokens
  const [fromSymbol, setFromSymbol] = useState<string>('ETH');
  const [toSymbol, setToSymbol] = useState<string>('USDC');

  const fromTokenBalance = useMemo(
    () => tokenBalances.find((b) => b.token.symbol === fromSymbol) || tokenBalances[0],
    [tokenBalances, fromSymbol],
  );
  const toTokenBalance = useMemo(
    () =>
      tokenBalances.find((b) => b.token.symbol === toSymbol) ||
      tokenBalances[1] ||
      tokenBalances[0],
    [tokenBalances, toSymbol],
  );

  const fromToken: TokenConfig = fromTokenBalance?.token;
  const toToken: TokenConfig = toTokenBalance?.token;

  // Slippage Setting (0.1%, 0.5%, 1.0%)
  const [slippage, setSlippage] = useState<number>(0.5);

  // Input & Quote State
  const [payAmountStr, setPayAmountStr] = useState<string>('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Confirmation & Execution Progress
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<SwapStepId>('idle');
  const [stepMessage, setStepMessage] = useState<string>('');
  const [stepTxHash, setStepTxHash] = useState<string | undefined>();
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionSuccessHash, setExecutionSuccessHash] = useState<string | null>(null);

  // Swap Token directions (From <-> To)
  const handleFlipTokens = () => {
    const tempFrom = fromSymbol;
    setFromSymbol(toSymbol);
    setToSymbol(tempFrom);
    setPayAmountStr('');
    setQuote(null);
    setQuoteError('');
  };

  // Fetch real on-chain quote from Uniswap V3 QuoterV2
  const fetchOnChainQuote = useCallback(async () => {
    if (!fromToken || !toToken) return;
    const amountInRaw = parseTokenAmount(payAmountStr, fromToken.decimals);
    if (amountInRaw <= 0n) {
      setQuote(null);
      setQuoteError('');
      return;
    }

    setIsQuoting(true);
    setQuoteError('');
    try {
      const q = await swapService.getSwapQuote(
        fromToken,
        toToken,
        amountInRaw,
        slippage,
        network.id,
      );
      setQuote(q);
    } catch (err: unknown) {
      setQuote(null);
      setQuoteError((err as Error).message || 'Unable to retrieve on-chain quote.');
    } finally {
      setIsQuoting(false);
    }
  }, [fromToken, toToken, payAmountStr, slippage, network.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOnChainQuote();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchOnChainQuote]);

  // Set MAX amount
  const handleMaxPay = () => {
    if (!fromTokenBalance) return;
    if (fromToken.type === 'NATIVE') {
      const reserve = 2500000000000000n; // 0.0025 ETH reserved for gas
      if (fromTokenBalance.balanceRaw > reserve) {
        setPayAmountStr(
          formatTokenBalance(fromTokenBalance.balanceRaw - reserve, fromToken.decimals, 6),
        );
      } else {
        setPayAmountStr('0');
      }
    } else {
      setPayAmountStr(fromTokenBalance.balanceFormatted);
    }
  };

  // Trigger Confirmation Modal
  const handleReviewSwap = () => {
    if (!quote) return;
    setQuoteError('');

    const amountInRaw = parseTokenAmount(payAmountStr, fromToken.decimals);
    if (amountInRaw > fromTokenBalance.balanceRaw) {
      setQuoteError(`Insufficient ${fromToken.symbol} balance.`);
      return;
    }

    if (fromToken.type !== 'NATIVE') {
      const ethBal = ethBalance ? ethBalance.balanceRaw : 0n;
      if (ethBal === 0n) {
        setQuoteError('Insufficient ETH to pay network gas fees for this swap.');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  // Execute Swap through step-by-step pipeline
  const handleConfirmSwap = async () => {
    if (!quote) return;
    setIsExecuting(true);
    setCurrentStep('checking_balance');
    setStepMessage('Starting swap execution...');
    setStepTxHash(undefined);
    setQuoteError('');

    try {
      const confirmedTx = await swapService.executeSwap(quote, network.id, (step, msg, hash) => {
        setCurrentStep(step);
        setStepMessage(msg);
        if (hash) setStepTxHash(hash);
      });

      setExecutionSuccessHash(confirmedTx.hash);
      setShowConfirmModal(false);
      setToastMsg('Swap confirmed on blockchain!');
      refreshBalances(true);
    } catch (err: unknown) {
      setQuoteError((err as Error).message || 'Swap execution failed.');
      setShowConfirmModal(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Fiat calculations
  const fromPriceUsd = marketPrices[fromToken?.coingeckoId || '']?.usd || 0;
  const toPriceUsd = marketPrices[toToken?.coingeckoId || '']?.usd || 0;
  const payFloat = parseFloat(payAmountStr) || 0;
  const payUsd = payFloat * fromPriceUsd;
  const receiveUsd = quote ? parseFloat(quote.amountOutFormatted) * toPriceUsd : 0;

  return (
    <ScreenWrapper>
      <Header title="Uniswap" showBack rightElement={<NetworkBadge />} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Slippage Selector */}
        <View style={styles.slippageHeader}>
          <Text style={[styles.slippageLabel, { color: colors.textSecondary }]}>
            Slippage Tolerance
          </Text>
          <View style={styles.slippagePills}>
            {[0.1, 0.5, 1.0].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSlippage(s)}
                style={[
                  styles.slippageBtn,
                  {
                    backgroundColor: slippage === s ? colors.primary : colors.surfaceLight,
                    borderColor: slippage === s ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.slippageText,
                    { color: slippage === s ? '#FFFFFF' : colors.textPrimary },
                  ]}
                >
                  {s}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ================= YOU PAY BOX ================= */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.boxHeader}>
            <Text style={[styles.boxLabel, { color: colors.textSecondary }]}>YOU PAY</Text>
            <Text style={[styles.balanceHint, { color: colors.textTertiary }]}>
              Balance: {fromTokenBalance?.balanceFormatted || '0'} {fromToken?.symbol}
            </Text>
          </View>

          <View style={styles.inputRow}>
            <Input
              placeholder="0.0"
              keyboardType="decimal-pad"
              value={payAmountStr}
              onChangeText={setPayAmountStr}
              style={styles.amountInput}
              rightElement={
                <TouchableOpacity onPress={handleMaxPay} style={styles.maxPill}>
                  <Text style={[styles.maxPillText, { color: colors.primaryLight }]}>MAX</Text>
                </TouchableOpacity>
              }
            />
          </View>

          <View style={styles.boxFooter}>
            <Text style={[styles.usdHint, { color: colors.textSecondary }]}>
              ≈ {formatFiat(payUsd, currencyPreference)}
            </Text>

            {/* Token Selector Pills */}
            <View style={styles.tokenPillRow}>
              {tokenBalances.map((tb) => (
                <TouchableOpacity
                  key={tb.token.symbol}
                  onPress={() => {
                    if (tb.token.symbol !== toSymbol) {
                      setFromSymbol(tb.token.symbol);
                    }
                  }}
                  style={[
                    styles.tokenMiniPill,
                    {
                      backgroundColor:
                        fromSymbol === tb.token.symbol ? colors.primary : colors.surfaceLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenMiniPillText,
                      { color: fromSymbol === tb.token.symbol ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {tb.token.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Flip Direction Button */}
        <TouchableOpacity
          onPress={handleFlipTokens}
          style={[
            styles.flipButton,
            {
              backgroundColor: colors.surfaceHighlight,
              borderColor: colors.borderStrong,
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-down" size={20} color={colors.primaryLight} />
        </TouchableOpacity>

        {/* ================= YOU RECEIVE BOX ================= */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.boxHeader}>
            <Text style={[styles.boxLabel, { color: colors.textSecondary }]}>
              YOU RECEIVE (ESTIMATED)
            </Text>
            <Text style={[styles.balanceHint, { color: colors.textTertiary }]}>
              Balance: {toTokenBalance?.balanceFormatted || '0'} {toToken?.symbol}
            </Text>
          </View>

          <View style={styles.receiveAmountRow}>
            {isQuoting ? (
              <View style={styles.quotingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.quotingText, { color: colors.textSecondary }]}>
                  Fetching real on-chain quote...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.receiveValueText,
                  { color: quote ? colors.textPrimary : colors.textTertiary },
                ]}
              >
                {quote ? quote.amountOutFormatted : '0.0'}
              </Text>
            )}
          </View>

          <View style={styles.boxFooter}>
            <Text style={[styles.usdHint, { color: colors.textSecondary }]}>
              ≈ {formatFiat(receiveUsd, currencyPreference)}
            </Text>

            {/* Token Selector Pills for Receive */}
            <View style={styles.tokenPillRow}>
              {tokenBalances.map((tb) => (
                <TouchableOpacity
                  key={tb.token.symbol}
                  onPress={() => {
                    if (tb.token.symbol !== fromSymbol) {
                      setToSymbol(tb.token.symbol);
                    }
                  }}
                  style={[
                    styles.tokenMiniPill,
                    {
                      backgroundColor:
                        toSymbol === tb.token.symbol ? colors.primary : colors.surfaceLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenMiniPillText,
                      { color: toSymbol === tb.token.symbol ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {tb.token.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ================= ON-CHAIN QUOTE SPECS ================= */}
        {quote ? (
          <View
            style={[
              styles.quoteSpecsCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Exchange Rate</Text>
              <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                1 {fromToken?.symbol} ≈ {quote.executionPrice.toFixed(4)} {toToken?.symbol}
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>
                Minimum Received
              </Text>
              <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                {quote.amountOutMinimumFormatted} {toToken?.symbol}
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Price Impact</Text>
              <Text
                style={[
                  styles.specValue,
                  { color: quote.priceImpactPercent > 5 ? colors.danger : colors.success },
                ]}
              >
                {quote.priceImpactPercent.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Network Fee</Text>
              <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                {Number(quote.estimatedGasCostEth).toFixed(5)} ETH (≈{' '}
                {formatFiat(quote.estimatedGasCostUsd, currencyPreference)})
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>
                Liquidity Source
              </Text>
              <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                {quote.liquiditySource}
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: colors.textSecondary }]}>Route</Text>
              <Text style={[styles.specValue, { color: colors.textPrimary }]}>
                {quote.route.join(' → ')}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Error Notice */}
        {quoteError ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.dangerBackground, borderColor: colors.danger },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorBoxText, { color: colors.danger }]}>{quoteError}</Text>
          </View>
        ) : null}

        {/* Success Banner */}
        {executionSuccessHash ? (
          <View
            style={[
              styles.successBox,
              { backgroundColor: colors.successBackground, borderColor: colors.success },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
            <Text style={[styles.successBoxTitle, { color: colors.success }]}>
              Swap Successfully Executed!
            </Text>
            <Button
              title="View on Explorer"
              variant="outline"
              size="sm"
              onPress={() => Linking.openURL(getExplorerTxUrl(network.id, executionSuccessHash))}
              icon={<Ionicons name="open-outline" size={16} color={colors.primary} />}
              style={styles.explorerPill}
            />
          </View>
        ) : null}

        {/* Action Button */}
        <Button
          title={isQuoting ? 'Quoting On-Chain...' : 'Review Swap'}
          size="lg"
          disabled={!quote || isQuoting || isExecuting}
          onPress={handleReviewSwap}
          style={styles.swapActionBtn}
        />
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={showConfirmModal}
        title="Confirm Swap"
        subtitle={`Routing via ${network.name}`}
        onCancel={() => !isExecuting && setShowConfirmModal(false)}
        onConfirm={handleConfirmSwap}
        loading={isExecuting}
        confirmTitle="Confirm Swap"
      >
        <View style={styles.modalContent}>
          {isExecuting ? (
            <View style={styles.executionProgress}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                {stepMessage || 'Executing blockchain transaction...'}
              </Text>
              {stepTxHash ? (
                <Text style={[styles.stepHash, { color: colors.textSecondary }]}>
                  Tx: {stepTxHash.slice(0, 10)}...{stepTxHash.slice(-8)}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>You Pay:</Text>
                <Text style={[styles.confirmValueBold, { color: colors.textPrimary }]}>
                  {quote?.amountInFormatted} {fromToken?.symbol}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                  You Receive:
                </Text>
                <Text style={[styles.confirmValueBold, { color: colors.success }]}>
                  {quote?.amountOutFormatted} {toToken?.symbol}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>Rate:</Text>
                <Text style={[styles.confirmValue, { color: colors.textPrimary }]}>
                  1 {fromToken?.symbol} ≈ {quote?.executionPrice.toFixed(4)} {toToken?.symbol}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                  Minimum Received:
                </Text>
                <Text style={[styles.confirmValue, { color: colors.textPrimary }]}>
                  {quote?.amountOutMinimumFormatted} {toToken?.symbol}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                  Network Fee:
                </Text>
                <Text style={[styles.confirmValue, { color: colors.textPrimary }]}>
                  {Number(quote?.estimatedGasCostEth).toFixed(5)} ETH
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                  Slippage:
                </Text>
                <Text style={[styles.confirmValue, { color: colors.textPrimary }]}>
                  {slippage}%
                </Text>
              </View>
            </>
          )}
        </View>
      </ConfirmModal>

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  slippageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  slippageLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
  },
  slippagePills: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  slippageBtn: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  slippageText: {
    ...TYPOGRAPHY.captionBold,
  },
  cardBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginVertical: SPACING.xs,
  },
  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  boxLabel: {
    ...TYPOGRAPHY.captionBold,
    letterSpacing: 0.5,
  },
  balanceHint: {
    ...TYPOGRAPHY.caption,
  },
  inputRow: {
    marginVertical: SPACING.xs,
  },
  amountInput: {
    fontSize: 22,
    fontWeight: '700',
  },
  maxPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  maxPillText: {
    ...TYPOGRAPHY.captionBold,
  },
  boxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  usdHint: {
    ...TYPOGRAPHY.caption,
  },
  tokenPillRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tokenMiniPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  tokenMiniPillText: {
    ...TYPOGRAPHY.captionBold,
  },
  flipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -12,
    zIndex: 10,
  },
  receiveAmountRow: {
    minHeight: 50,
    justifyContent: 'center',
  },
  receiveValueText: {
    fontSize: 24,
    fontWeight: '700',
  },
  quotingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  quotingText: {
    ...TYPOGRAPHY.body,
  },
  quoteSpecsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  specLabel: {
    ...TYPOGRAPHY.caption,
  },
  specValue: {
    ...TYPOGRAPHY.captionBold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  errorBoxText: {
    ...TYPOGRAPHY.captionBold,
    flex: 1,
  },
  successBox: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  successBoxTitle: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  explorerPill: {
    marginTop: SPACING.xs,
  },
  swapActionBtn: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  modalContent: {
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  confirmLabel: {
    ...TYPOGRAPHY.caption,
  },
  confirmValue: {
    ...TYPOGRAPHY.captionBold,
  },
  confirmValueBold: {
    ...TYPOGRAPHY.bodyBold,
  },
  executionProgress: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  stepTitle: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
  },
  stepHash: {
    ...TYPOGRAPHY.caption,
  },
});
