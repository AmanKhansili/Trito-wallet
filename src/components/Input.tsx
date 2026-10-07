import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  rightElement?: ReactNode;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  rightElement,
  hint,
  style,
  ...props
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary }, style]}
          {...props}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hintText, { color: colors.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.captionBold,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 50,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: SPACING.sm,
  },
  rightElement: {
    marginLeft: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
  hintText: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
});
