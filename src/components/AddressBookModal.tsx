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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';
import { Input } from './Input';
import { shortenAddress } from '../utils/formatters';
import { validateAddress } from '../utils/validation';
import { AddressBookContact } from '../types';

interface AddressBookModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress?: (address: string) => void;
  isPickerMode?: boolean;
}

export const AddressBookModal: React.FC<AddressBookModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
  isPickerMode = false,
}) => {
  const { colors } = useTheme();
  const { contacts, addContact, deleteContact, network } = useWallet();

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setAddress(text.trim());
      setErrorMsg('');
    }
  };

  const handleSaveContact = async () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Please enter a contact name.');
      return;
    }

    const val = validateAddress(address.trim());
    if (!val.isValid) {
      setErrorMsg(val.error || 'Invalid address.');
      return;
    }

    const newContact: AddressBookContact = {
      id: Date.now().toString(),
      name: name.trim(),
      address: address.trim(),
      networkId: network.id,
      addedAt: Date.now(),
    };

    await addContact(newContact);
    setName('');
    setAddress('');
    setIsAdding(false);
  };

  const handleSelect = (contact: AddressBookContact) => {
    if (onSelectAddress) {
      onSelectAddress(contact.address);
      onClose();
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
                  <Text style={[styles.title, { color: colors.textPrimary }]}>Address Book</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {isPickerMode ? 'Select a recipient from contacts' : 'Manage saved wallet addresses'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {isAdding ? (
                /* Add Contact Form */
                <View style={styles.formContainer}>
                  <Input
                    label="Contact Name"
                    placeholder="e.g. Rahul, Alice, Exchange"
                    value={name}
                    onChangeText={(txt) => {
                      setName(txt);
                      setErrorMsg('');
                    }}
                  />

                  <Input
                    label="Ethereum Address"
                    placeholder="0x..."
                    value={address}
                    onChangeText={(txt) => {
                      setAddress(txt);
                      setErrorMsg('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    rightElement={
                      <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn}>
                        <Text style={[styles.pasteText, { color: colors.primaryLight }]}>PASTE</Text>
                      </TouchableOpacity>
                    }
                  />

                  {errorMsg ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
                  ) : null}

                  <View style={styles.formActions}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={() => {
                        setIsAdding(false);
                        setName('');
                        setAddress('');
                        setErrorMsg('');
                      }}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="Save Contact"
                      onPress={handleSaveContact}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              ) : (
                /* Contact List */
                <>
                  <View style={styles.listHeader}>
                    <Text style={[styles.listCount, { color: colors.textSecondary }]}>
                      {contacts.length} Saved {contacts.length === 1 ? 'Contact' : 'Contacts'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsAdding(true)}
                      style={[styles.addBtn, { backgroundColor: colors.surfaceHighlight }]}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Contact</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.contactList} showsVerticalScrollIndicator={false}>
                    {contacts.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          No contacts saved yet.
                        </Text>
                        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                          Save frequent addresses to avoid typing long 0x hashes.
                        </Text>
                      </View>
                    ) : (
                      contacts.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => handleSelect(c)}
                          style={[
                            styles.contactCard,
                            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                          ]}
                          activeOpacity={0.7}
                        >
                          <View style={styles.contactLeft}>
                            <View
                              style={[
                                styles.avatarWrap,
                                { backgroundColor: colors.primaryGlow },
                              ]}
                            >
                              <Text style={[styles.avatarText, { color: colors.primary }]}>
                                {c.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.contactInfo}>
                              <Text style={[styles.contactName, { color: colors.textPrimary }]}>
                                {c.name}
                              </Text>
                              <Text style={[styles.contactAddress, { color: colors.textSecondary }]}>
                                {shortenAddress(c.address, 8, 6)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.contactRight}>
                            {isPickerMode ? (
                              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                            ) : (
                              <TouchableOpacity
                                onPress={() => deleteContact(c.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </>
              )}
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
    maxHeight: '80%',
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
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  listCount: {
    ...TYPOGRAPHY.captionBold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  addBtnText: {
    ...TYPOGRAPHY.captionBold,
  },
  contactList: {
    maxHeight: 320,
    marginBottom: SPACING.lg,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  contactLeft: {
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
  avatarText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...TYPOGRAPHY.bodyBold,
  },
  contactAddress: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  contactRight: {
    marginLeft: SPACING.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.xs,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.xs,
  },
  emptySub: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
  },
  formContainer: {
    marginVertical: SPACING.xs,
  },
  pasteBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pasteText: {
    ...TYPOGRAPHY.captionBold,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
  },
  errorText: {
    ...TYPOGRAPHY.captionBold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
});
