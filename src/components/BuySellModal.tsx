import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';
import { shortenAddress, formatFiat } from '../utils/formatters';
import { fiatRampService, RAMP_PROVIDERS } from '../services/fiatRampService';
import { FiatRampProvider, FiatRampType } from '../types';
import { priceService } from '../services/priceService';

interface BuySellModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: FiatRampType;
  initialCrypto?: string;
}

export const BuySellModal: React.FC<BuySellModalProps> = ({
  visible,
  onClose,
  initialType = 'buy',
  initialCrypto = 'ETH',
}) => {
  const { colors } = useTheme();
  const { address, network, setNetwork, currencyPreference } = useWallet();

  const [rampType, setRampType] = useState<FiatRampType>(initialType);
  const [selectedProvider, setSelectedProvider] = useState<FiatRampProvider>('onramp.money');
  const [selectedCrypto, setSelectedCrypto] = useState<string>(initialCrypto);
  const [fiatCurrency, setFiatCurrency] = useState<'INR' | 'USD'>('INR');
  const [fiatAmountStr, setFiatAmountStr] = useState<string>('2500');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Sync initial parameters when modal becomes visible
  useEffect(() => {
    if (visible) {
      setRampType(initialType);
      if (initialCrypto) {
        setSelectedCrypto(initialCrypto.toUpperCase());
      }
      setFiatCurrency(currencyPreference === 'INR' ? 'INR' : 'INR');
      setFiatAmountStr(currencyPreference === 'INR' ? '2500' : '50');
      setErrorMsg('');
    }
  }, [visible, initialType, initialCrypto, currencyPreference]);

  const activeProviderInfo = useMemo(() => {
    return RAMP_PROVIDERS.find((p) => p.id === selectedProvider) || RAMP_PROVIDERS[0];
  }, [selectedProvider]);

  // Live estimated crypto conversion
  const estimatedCrypto = useMemo(() => {
    const amount = parseFloat(fiatAmountStr) || 0;
    if (amount <= 0) return '0.00';

    // Approximate unit price lookup
    const idMap: Record<string, string> = {
      ETH: 'ethereum',
      USDC: 'usd-coin',
      USDT: 'tether',
      DAI: 'dai',
      BTC: 'bitcoin',
    };
    const cached = priceService.getPriceForToken(idMap[selectedCrypto] || 'ethereum');
    const unitPrice = cached
      ? fiatCurrency === 'INR'
        ? cached.inr
        : cached.usd
      : selectedCrypto === 'ETH'
      ? fiatCurrency === 'INR'
        ? 239000
        : 2680
      : selectedCrypto === 'BTC'
      ? fiatCurrency === 'INR'
        ? 7354540
        : 82450
      : fiatCurrency === 'INR'
      ? 89.2
      : 1;

    const cryptoReceived = amount / unitPrice;
    if (cryptoReceived < 0.0001) return '< 0.0001';
    if (cryptoReceived > 10) return cryptoReceived.toFixed(2);
    return cryptoReceived.toFixed(4);
  }, [fiatAmountStr, fiatCurrency, selectedCrypto]);

  const presetAmounts = useMemo(() => {
    return fiatCurrency === 'INR' ? [1000, 2500, 5000, 10000] : [30, 50, 100, 250];
  }, [fiatCurrency]);

  const handleProceed = async () => {
    if (!address) return;
    const amountNum = parseFloat(fiatAmountStr) || 0;
    const minRequired =
      fiatCurrency === 'INR'
        ? activeProviderInfo.minAmountInr
        : activeProviderInfo.minAmountUsd;

    if (amountNum < minRequired) {
      setErrorMsg(
        `Minimum order amount for ${activeProviderInfo.name} is ${
          fiatCurrency === 'INR' ? `₹${minRequired}` : `$${minRequired}`
        }`,
      );
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await fiatRampService.openRamp({
        provider: selectedProvider,
        type: rampType,
        cryptoCurrency: selectedCrypto,
        fiatCurrency,
        walletAddress: address,
        networkId: network.id,
        fiatAmount: amountNum,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to open payment gateway.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFaucet = async () => {
    try {
      await fiatRampService.openSepoliaFaucet(address || undefined);
    } catch {
      setErrorMsg('Failed to open testnet faucet link.');
    }
  };

  const handleSwitchToMainnet = async () => {
    try {
      await setNetwork('mainnet');
      setErrorMsg('');
    } catch {
      setErrorMsg('Failed to switch network.');
    }
  };

  const supportedCryptos = ['ETH', 'USDC', 'USDT', 'DAI'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {rampType === 'buy' ? 'Buy Crypto' : 'Sell Crypto for Cash'}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {rampType === 'buy'
                      ? 'Instant UPI & Card on-ramp into self-custody'
                      : 'Compliant off-ramp payout straight to bank account'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Network Notice if on Sepolia Testnet */}
                {network.isTestnet && (
                  <View
                    style={[
                      styles.testnetNotice,
                      { backgroundColor: colors.warningBackground, borderColor: colors.warning },
                    ]}
                  >
                    <View style={styles.testnetNoticeHeader}>
                      <Ionicons name="warning-outline" size={18} color={colors.warning} />
                      <Text style={[styles.testnetNoticeTitle, { color: colors.warning }]}>
                        Sepolia Testnet Active
                      </Text>
                    </View>
                    <Text style={[styles.testnetNoticeText, { color: colors.textSecondary }]}>
                      Real fiat gateways (UPI, Credit Cards) operate on Ethereum Mainnet. On
                      Sepolia testnet, you can claim free test ETH directly from the faucet.
                    </Text>
                    <View style={styles.testnetActionRow}>
                      <TouchableOpacity
                        onPress={handleOpenFaucet}
                        style={[styles.testnetBtn, { backgroundColor: colors.surfaceHighlight }]}
                      >
                        <Ionicons name="water-outline" size={14} color={colors.primary} />
                        <Text style={[styles.testnetBtnText, { color: colors.primary }]}>
                          Free Sepolia Faucet
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSwitchToMainnet}
                        style={[styles.testnetBtn, { backgroundColor: colors.primary }]}
                      >
                        <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
                        <Text style={[styles.testnetBtnText, { color: '#FFFFFF' }]}>
                          Switch to Mainnet
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Buy vs Sell Switcher Tabs */}
                <View style={[styles.typeTabs, { backgroundColor: colors.surfaceSubtle }]}>
                  <TouchableOpacity
                    onPress={() => setRampType('buy')}
                    style={[
                      styles.typeTab,
                      rampType === 'buy' && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={16}
                      color={rampType === 'buy' ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.typeTabText,
                        { color: rampType === 'buy' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Buy (Fiat → Crypto)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setRampType('sell')}
                    style={[
                      styles.typeTab,
                      rampType === 'sell' && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle"
                      size={16}
                      color={rampType === 'sell' ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.typeTabText,
                        { color: rampType === 'sell' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Sell (Crypto → Bank)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Asset Selection */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {rampType === 'buy' ? 'Asset to Receive' : 'Asset to Sell'}
                </Text>
                <View style={styles.assetRow}>
                  {supportedCryptos.map((crypto) => {
                    const isSelected = selectedCrypto === crypto;
                    return (
                      <TouchableOpacity
                        key={crypto}
                        onPress={() => setSelectedCrypto(crypto)}
                        style={[
                          styles.assetChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.assetChipText,
                            { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                          ]}
                        >
                          {crypto}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Amount Input Section */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {rampType === 'buy' ? 'You Pay' : 'Amount to Off-Ramp'}
                </Text>
                <View
                  style={[
                    styles.amountInputBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.amountInputRow}>
                    <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>
                      {fiatCurrency === 'INR' ? '₹' : '$'}
                    </Text>
                    <TextInput
                      value={fiatAmountStr}
                      onChangeText={setFiatAmountStr}
                      keyboardType="numeric"
                      style={[styles.numericInput, { color: colors.textPrimary }]}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <View style={styles.fiatToggle}>
                      <TouchableOpacity
                        onPress={() => setFiatCurrency('INR')}
                        style={[
                          styles.fiatMiniBtn,
                          fiatCurrency === 'INR' && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.fiatMiniText,
                            { color: fiatCurrency === 'INR' ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          INR
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setFiatCurrency('USD')}
                        style={[
                          styles.fiatMiniBtn,
                          fiatCurrency === 'USD' && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.fiatMiniText,
                            { color: fiatCurrency === 'USD' ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          USD
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Preset Quick Chips */}
                  <View style={styles.presetRow}>
                    {presetAmounts.map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setFiatAmountStr(String(amt))}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor:
                              fiatAmountStr === String(amt)
                                ? colors.surfaceHighlight
                                : colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.presetText, { color: colors.textPrimary }]}>
                          {fiatCurrency === 'INR' ? `+₹${amt.toLocaleString()}` : `+$${amt}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Estimate Preview */}
                <View
                  style={[
                    styles.estimateBanner,
                    { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                  <Text style={[styles.estimateText, { color: colors.textSecondary }]}>
                    {rampType === 'buy' ? 'You will receive ≈ ' : 'Payout equivalent ≈ '}
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {estimatedCrypto} {selectedCrypto}
                    </Text>
                  </Text>
                </View>

                {/* Payment Gateway Options */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Payment Gateway Partner
                </Text>
                {RAMP_PROVIDERS.map((provider) => {
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <TouchableOpacity
                      key={provider.id}
                      onPress={() => {
                        setSelectedProvider(provider.id);
                        if (provider.id === 'onramp.money') {
                          setFiatCurrency('INR');
                        }
                      }}
                      style={[
                        styles.providerCard,
                        {
                          backgroundColor: isSelected ? colors.primaryGlow : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.providerHeader}>
                        <View style={styles.providerTitleRow}>
                          <Ionicons
                            name={provider.id === 'onramp.money' ? 'flash' : 'globe-outline'}
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={[styles.providerName, { color: colors.textPrimary }]}>
                            {provider.name}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.providerBadge,
                            { backgroundColor: colors.surfaceHighlight },
                          ]}
                        >
                          <Text style={[styles.providerBadgeText, { color: colors.primaryLight }]}>
                            {provider.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.providerDesc, { color: colors.textSecondary }]}>
                        {provider.description}
                      </Text>
                      <Text style={[styles.providerMethods, { color: colors.textTertiary }]}>
                        Supported: {provider.supportedPaymentMethods.join(' • ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Non-Custodial & Compliance Disclosure */}
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={colors.success}
                    style={styles.infoIcon}
                  />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    TRITO is non-custodial. All payments and FIU/AML compliance are handled
                    directly by licensed gateways. Crypto is sent directly to your self-custody
                    address ({shortenAddress(address || '', 6, 4)}).
                  </Text>
                </View>

                {errorMsg ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
                ) : null}

                {/* Proceed Button */}
                <Button
                  title={
                    loading
                      ? 'Opening Gateway...'
                      : rampType === 'buy'
                      ? `Buy ${selectedCrypto} via ${
                          selectedProvider === 'onramp.money' ? 'Onramp.money (UPI)' : 'Transak'
                        }`
                      : `Sell ${selectedCrypto} via ${
                          selectedProvider === 'onramp.money' ? 'Onramp.money' : 'Transak'
                        }`
                  }
                  size="lg"
                  loading={loading}
                  onPress={handleProceed}
                  style={styles.proceedBtn}
                />
              </ScrollView>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h2,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  testnetNotice: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  testnetNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  testnetNoticeTitle: {
    ...TYPOGRAPHY.captionBold,
  },
  testnetNoticeText: {
    ...TYPOGRAPHY.caption,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  testnetActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  testnetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  testnetBtnText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  typeTabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  typeTabText: {
    ...TYPOGRAPHY.captionBold,
  },
  sectionLabel: {
    ...TYPOGRAPHY.captionBold,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  assetRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  assetChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  assetChipText: {
    ...TYPOGRAPHY.bodyBold,
  },
  amountInputBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 26,
    fontWeight: '700',
    marginRight: 6,
  },
  numericInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 0,
  },
  fiatToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.sm,
    padding: 2,
  },
  fiatMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  fiatMiniText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  presetRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  presetText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
  },
  estimateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  estimateText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
  providerCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  providerName: {
    ...TYPOGRAPHY.bodyBold,
  },
  providerBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  providerBadgeText: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 10,
  },
  providerDesc: {
    ...TYPOGRAPHY.caption,
    lineHeight: 18,
    marginVertical: 4,
  },
  providerMethods: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  infoIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    lineHeight: 18,
  },
  errorText: {
    ...TYPOGRAPHY.captionBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  proceedBtn: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
});
