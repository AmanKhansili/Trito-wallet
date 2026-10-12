import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { Header } from '../../src/components/Header';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast } from '../../src/components/Toast';
import { useWallet } from '../../src/context/WalletContext';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/constants/theme';
import { shortenAddress } from '../../src/utils/formatters';
import { NetworkId } from '../../src/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { address, network, setNetwork, currencyPreference, setCurrencyPreference } = useWallet();
  const {
    lockWallet,
    removeWallet,
    isBiometricsSupported,
    isBiometricsEnabled,
    toggleBiometrics,
    autoLockMinutes,
    setAutoLockMinutes,
  } = useAuth();
  const { colors, colorScheme, toggleTheme } = useTheme();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState<boolean>(false);
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [isWiping, setIsWiping] = useState<boolean>(false);

  const handleCopy = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setToastMsg('Address copied to clipboard');
    }
  };

  const handleSwitchNetwork = async (netId: NetworkId) => {
    await setNetwork(netId);
    setShowNetworkModal(false);
    setToastMsg(`Switched to ${netId === 'sepolia' ? 'Ethereum Sepolia' : 'Ethereum Mainnet'}`);
  };

  const handleConfirmWipe = async () => {
    setIsWiping(true);
    try {
      await removeWallet();
      setShowWipeModal(false);
    } catch {
      Alert.alert('Error', 'Could not remove wallet.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <ScreenWrapper>
      <Header title="Settings" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wallet Address Header Card */}
        <TouchableOpacity
          onPress={handleCopy}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="wallet-outline" size={24} color={colors.primary} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Active Address
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {shortenAddress(address || '', 8, 6)}
                </Text>
              </View>
            </View>
            <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ================= NETWORK SETTINGS ================= */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NETWORK</Text>
        <TouchableOpacity
          onPress={() => setShowNetworkModal(true)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="globe-outline" size={22} color={colors.primaryLight} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Active Network
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {network.name} (Chain ID: {network.chainId})
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ================= SECURITY SETTINGS ================= */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY</Text>

        {/* Biometrics Toggle */}
        {isBiometricsSupported ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Ionicons name="finger-print" size={22} color={colors.accent} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    Biometric Authentication
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Face ID / Fingerprint unlock
                  </Text>
                </View>
              </View>
              <Switch
                value={isBiometricsEnabled}
                onValueChange={toggleBiometrics}
                trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              />
            </View>
          </View>
        ) : null}

        {/* Auto Lock Timer */}
        <TouchableOpacity
          onPress={() => {
            const nextMinutes = autoLockMinutes === 1 ? 5 : autoLockMinutes === 5 ? 15 : 1;
            setAutoLockMinutes(nextMinutes);
            setToastMsg(`Auto-lock set to ${nextMinutes} minute(s)`);
          }}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="time-outline" size={22} color={colors.warning} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Auto-Lock Timeout
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {autoLockMinutes} minutes
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Backup Recovery Phrase */}
        <TouchableOpacity
          onPress={() => router.push('/wallet/backup')}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="key-outline" size={22} color={colors.success} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Backup Recovery Phrase
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  View your 12-word seed phrase
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Export Private Key */}
        <TouchableOpacity
          onPress={() => router.push('/wallet/export')}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.danger} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Export Private Key
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Reveal 32-byte secret key with PIN check
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ================= PREFERENCES ================= */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>

        {/* Currency Switch */}
        <TouchableOpacity
          onPress={() => {
            const nextCurr = currencyPreference === 'USD' ? 'INR' : 'USD';
            setCurrencyPreference(nextCurr);
            setToastMsg(`Currency set to ${nextCurr}`);
          }}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="cash-outline" size={22} color={colors.primaryLight} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Default Currency
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {currencyPreference} ({currencyPreference === 'USD' ? '$' : '₹'})
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Theme Switch */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons
                name={colorScheme === 'dark' ? 'moon-outline' : 'sunny-outline'}
                size={22}
                color={colors.primaryLight}
              />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Dark Theme
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {colorScheme === 'dark' ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={colorScheme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
            />
          </View>
        </View>

        {/* Lock Wallet Now */}
        <TouchableOpacity
          onPress={() => lockWallet()}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="lock-closed" size={22} color={colors.warning} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Lock Wallet Now
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Require PIN or biometrics on return
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ================= DANGER ZONE ================= */}
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>DANGER ZONE</Text>

        <TouchableOpacity
          onPress={() => setShowWipeModal(true)}
          style={[
            styles.card,
            {
              backgroundColor: colors.dangerBackground,
              borderColor: colors.danger,
            },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: colors.danger }]}>Remove Wallet</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Erase keys and data from this device
                </Text>
              </View>
            </View>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Network Selector Modal */}
      <ConfirmModal
        visible={showNetworkModal}
        title="Select Network"
        subtitle="Switch your active blockchain environment"
        onCancel={() => setShowNetworkModal(false)}
        onConfirm={() => setShowNetworkModal(false)}
        confirmTitle="Done"
        cancelTitle="Cancel"
      >
        <View style={styles.networkList}>
          <TouchableOpacity
            onPress={() => handleSwitchNetwork('sepolia')}
            style={[
              styles.networkChoice,
              {
                backgroundColor:
                  network.id === 'sepolia' ? colors.primaryGlow : colors.surfaceSubtle,
                borderColor: network.id === 'sepolia' ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <View style={styles.netChoiceInfo}>
              <Text style={[styles.netChoiceTitle, { color: colors.textPrimary }]}>
                Ethereum Sepolia Testnet
              </Text>
              <Text style={[styles.netChoiceSub, { color: colors.textSecondary }]}>
                Chain ID 11155111 • Zero-cost test transactions
              </Text>
            </View>
            {network.id === 'sepolia' && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchNetwork('mainnet')}
            style={[
              styles.networkChoice,
              {
                backgroundColor:
                  network.id === 'mainnet' ? colors.primaryGlow : colors.surfaceSubtle,
                borderColor: network.id === 'mainnet' ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <View style={styles.netChoiceInfo}>
              <Text style={[styles.netChoiceTitle, { color: colors.textPrimary }]}>
                Ethereum Mainnet
              </Text>
              <Text style={[styles.netChoiceSub, { color: colors.textSecondary }]}>
                Chain ID 1 • Live production blockchain
              </Text>
            </View>
            {network.id === 'mainnet' && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </ConfirmModal>

      {/* Remove Wallet Confirmation Modal */}
      <ConfirmModal
        visible={showWipeModal}
        title="Remove Wallet from Device?"
        subtitle="This action is permanent and cannot be undone."
        isDanger
        loading={isWiping}
        confirmTitle="Erase Wallet"
        cancelTitle="Keep Wallet"
        onCancel={() => setShowWipeModal(false)}
        onConfirm={handleConfirmWipe}
      >
        <Text style={[styles.wipeWarningText, { color: colors.textPrimary }]}>
          Make sure you have safely recorded your 12-word recovery phrase. If you do not have your
          recovery phrase, you will permanently lose access to all funds.
        </Text>
      </ConfirmModal>

      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.captionBold,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  cardTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  cardSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  networkList: {
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  networkChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.md,
  },
  netChoiceInfo: {
    flex: 1,
  },
  netChoiceTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  netChoiceSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  wipeWarningText: {
    ...TYPOGRAPHY.body,
    lineHeight: 20,
    marginVertical: SPACING.sm,
  },
});
