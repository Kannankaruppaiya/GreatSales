/**
 * TextField — labelled text input. The label is a real, always-visible label
 * (never placeholder-as-label), required fields are marked in text, and errors
 * are announced to screen readers and reinforced with an icon (not color alone).
 */
import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { hitTarget } from '@/theme/tokens';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Error message; presence switches the field to its error state. */
  error?: string;
  /** Helper text shown when there's no error. */
  helper?: string;
  required?: boolean;
  /** Password field: renders a show/hide toggle and secures entry. */
  secure?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, helper, required, secure, editable = true, ...rest },
  ref,
) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.focus
      : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.labelRow}>
        <Text variant="label" color="secondary">
          {label}
        </Text>
        {required ? (
          <Text variant="label" color="error" accessibilityLabel="required">
            {' *'}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: editable ? colors.inputBg : colors.disabledBg,
            borderColor,
            borderRadius: radii.md,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth * 2,
            paddingHorizontal: spacing.md,
            minHeight: Math.max(52, hitTarget),
          },
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, typography.body, { color: colors.textPrimary }]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && !reveal}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={label}
          accessibilityState={{ disabled: !editable }}
          maxFontSizeMultiplier={1.4}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
            style={styles.trailing}
          >
            <Icon name={reveal ? 'eye-off-outline' : 'eye-outline'} size={20} color="textMuted" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.helperRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert-circle" size={14} color="error" />
          <Text variant="bodySm" color="error" style={styles.helperText}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="bodySm" color="muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 14 },
  trailing: { paddingLeft: 8, alignItems: 'center', justifyContent: 'center' },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helperText: { flex: 1 },
});
