import React, { ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { Button } from './Button';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmTitle?: string;
  cancelTitle?: string;
  isDanger?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  subtitle,
  onCancel,
  onConfirm,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
  isDanger = false,
  loading = false,
  children,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.content,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderStrong,
                },
              ]}
            >
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {children ? <View style={styles.body}>{children}</View> : null}

              <View style={styles.actions}>
                <Button
                  title={cancelTitle}
                  variant="secondary"
                  onPress={onCancel}
                  style={styles.actionBtn}
                  disabled={loading}
                />
                <Button
                  title={confirmTitle}
                  variant={isDanger ? 'danger' : 'primary'}
                  onPress={onConfirm}
                  style={styles.actionBtn}
                  loading={loading}
                />
              </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h3,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  body: {
    marginVertical: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
  },
});
