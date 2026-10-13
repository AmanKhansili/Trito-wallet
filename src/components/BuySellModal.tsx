import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';
import { shortenAddress } from '../utils/formatters';
import { fiatRampService, RAMP_PROVIDERS } from '../services/fiatRampService';
import { FiatRampProvider, FiatRampType } from '../types';

interface BuySellModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: FiatRampType;
}

export const BuySellModal: React.FC<BuySellModalProps> = ({
  visible,
  onClose,
  initialType = 'buy',
}) => {
  const { colors } = useTheme();
  const { address, network } = useWallet();

  const [rampType, setRampType] = useState<FiatRampType>(initialType);
  const [selectedProvider, setSelectedProvider] = useState<FiatRampProvider>('onramp.money');
  const [selectedCrypto, setSelectedCrypto] = useState<string>('ETH');
  const [fiatCurrency, setFiatCurrency] = useState<'INR' | 'USD'>('INR');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleProceed = async () => {
    if (!address) return;
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
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to open payment gateway.');
    } finally {
      setLoading(false);
    }
  };

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
                    {rampType === 'buy' ? 'Buy Crypto' : 'Sell Crypto to Fiat'}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Regulated on & off-ramp gateway
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Buy vs Sell Tabs */}
                <View style={[styles.typeTabs, { backgroundColor: colors.surfaceSubtle }]}>
                  <TouchableOpacity
                    onPress={() => setRampType('buy')}
                    style={[
                      styles.typeTab,
                      rampType === 'buy' && { backgroundColor: colors.primary },
                    ]}
                  >
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
                    <Text
                      style={[
                        styles.typeTabText,
                        { color: rampType === 'sell' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Sell (Crypto → Fiat)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Crypto Asset Selector */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Select Asset
                </Text>
                <View style={styles.assetRow}>
                  {['ETH', 'USDC', 'USDT', 'DAI'].map((crypto) => (
                    <TouchableOpacity
                      key={crypto}
                      onPress={() => setSelectedCrypto(crypto)}
                      style={[
                        styles.assetChip,
                        {
                          backgroundColor:
                            selectedCrypto === crypto ? colors.primary : colors.surfaceSubtle,
                          borderColor:
                            selectedCrypto === crypto ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.assetChipText,
                          { color: selectedCrypto === crypto ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {crypto}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Licensed Providers */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Choose Payment Gateway
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
                        Methods: {provider.supportedPaymentMethods.join(' • ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Regulatory Callout */}
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="shield-checkmark" size={20} color={colors.success} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    All payments, KYC, and tax compliance are handled directly by the licensed
                    partner. Purchased crypto deposits straight to your self-custody address (
                    {shortenAddress(address || '', 6, 4)}).
                  </Text>
                </View>

                {errorMsg ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
                ) : null}

                {/* Action Button */}
                <Button
                  title={
                    loading
                      ? 'Opening Gateway...'
                      : `Proceed with ${
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
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  typeTabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  typeTab: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
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
    marginBottom: SPACING.lg,
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
    marginVertical: SPACING.md,
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
