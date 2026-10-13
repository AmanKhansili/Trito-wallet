import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';
import { shortenAddress } from '../utils/formatters';

interface AccountSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AccountSelectorModal: React.FC<AccountSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const { accounts, activeAccountIndex, switchAccount, createNewAccount } = useWallet();

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSelectAccount = async (index: number) => {
    if (index === activeAccountIndex) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await switchAccount(index);
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to switch account.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await createNewAccount();
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to derive new account.');
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
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>Select Account</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    BIP-44 HD derived addresses
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {errorMsg ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
              ) : null}

              <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
                {accounts.map((acc) => {
                  const isActive = acc.index === activeAccountIndex;
                  return (
                    <TouchableOpacity
                      key={acc.index}
                      onPress={() => handleSelectAccount(acc.index)}
                      style={[
                        styles.accountCard,
                        {
                          backgroundColor: isActive ? colors.primaryGlow : colors.surfaceSubtle,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cardLeft}>
                        <View
                          style={[
                            styles.avatarWrap,
                            { backgroundColor: isActive ? colors.primary : colors.surfaceHighlight },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={18}
                            color={isActive ? '#FFFFFF' : colors.textPrimary}
                          />
                        </View>
                        <View style={styles.accInfo}>
                          <Text style={[styles.accName, { color: colors.textPrimary }]}>
                            {acc.name}
                          </Text>
                          <Text style={[styles.accAddress, { color: colors.textSecondary }]}>
                            {shortenAddress(acc.address, 8, 6)}
                          </Text>
                        </View>
                      </View>

                      {isActive && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Button
                title={loading ? 'Deriving...' : '+ Create New Account'}
                variant="secondary"
                size="md"
                onPress={handleCreateAccount}
                disabled={loading}
                loading={loading}
                style={styles.createBtn}
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
    maxHeight: '75%',
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
  accountList: {
    maxHeight: 280,
    marginBottom: SPACING.md,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  accInfo: {
    flex: 1,
  },
  accName: {
    ...TYPOGRAPHY.bodyBold,
  },
  accAddress: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  createBtn: {
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.captionBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
});
