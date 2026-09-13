import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import { Eye, EyeOff, X } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface GSInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  disabled?: boolean;
  clearable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  testID?: string;
}

export function GSInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  disabled = false,
  clearable = false,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  testID,
}: GSInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: disabled
              ? colors.surfaceMuted
              : isFocused
              ? colors.surfaceInteractive
              : colors.surfaceElevated,
            borderColor: error
              ? colors.danger
              : isFocused
              ? colors.brand
              : colors.border,
            borderRadius: radius.md,
            minHeight: multiline ? numberOfLines * 24 + 20 : 48,
          },
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isPassword && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label || placeholder}
          accessibilityState={{ disabled }}
          style={[
            styles.input,
            {
              color: disabled ? colors.textTertiary : colors.textPrimary,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            inputStyle,
          ]}
        />

        {clearable && value.length > 0 && !disabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            onPress={() => onChangeText('')}
            style={styles.actionIcon}
          >
            <X size={16} color={colors.textTertiary} />
          </Pressable>
        )}

        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.actionIcon}
          >
            {isPasswordVisible ? (
              <EyeOff size={18} color={colors.textSecondary} />
            ) : (
              <Eye size={18} color={colors.textSecondary} />
            )}
          </Pressable>
        )}

        {rightIcon && !isPassword ? (
          <View style={styles.actionIcon}>{rightIcon}</View>
        ) : null}
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.helperText, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
    width: '100%',
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    paddingHorizontal: spacing[3],
  },
  leftIcon: {
    marginRight: spacing[2],
  },
  actionIcon: {
    padding: spacing[1],
    marginLeft: spacing[1],
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    paddingVertical: spacing[2] + 2,
  },
  helperText: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: spacing[1],
  },
});
