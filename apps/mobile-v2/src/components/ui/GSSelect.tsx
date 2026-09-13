import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet } from './GSBottomSheet';
import { hapticFeedback } from '../../utils/haptics';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

export interface GSSelectProps {
  label?: string;
  placeholder?: string;
  value?: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  error?: string;
  style?: ViewStyle;
}

export function GSSelect({
  label,
  placeholder = 'Select option...',
  value,
  options,
  onSelect,
  disabled = false,
  error,
  style,
}: GSSelectProps) {
  const { colors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpen = () => {
    if (disabled) return;
    hapticFeedback('light');
    setSheetVisible(true);
  };

  const handleSelectOption = (optVal: string) => {
    hapticFeedback('light');
    onSelect(optVal);
    setSheetVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        disabled={disabled}
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            borderColor: error ? colors.danger : colors.border,
            opacity: disabled ? 0.6 : 1,
          },
          pressed && { backgroundColor: colors.surfaceElevated },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.triggerText,
            {
              color: selectedOption ? colors.textPrimary : colors.textTertiary,
              fontWeight: selectedOption ? '500' : '400',
            },
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>

      {error && (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      )}

      <GSBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={label || placeholder}
        subtitle={`${options.length} options available`}
      >
        <View style={styles.optionList}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                onPress={() => handleSelectOption(opt.value)}
                style={({ pressed }) => [
                  styles.optionItem,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: isSelected
                      ? colors.brandSoft
                      : pressed
                      ? colors.surfaceElevated
                      : 'transparent',
                  },
                ]}
              >
                <View style={styles.optionTextCol}>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: isSelected ? colors.brand : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.subtitle && (
                    <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>
                      {opt.subtitle}
                    </Text>
                  )}
                </View>
                {isSelected && <Check size={18} color={colors.brand} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </GSBottomSheet>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  triggerText: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    flex: 1,
    marginRight: spacing[2],
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: spacing[1],
  },
  optionList: {
    paddingBottom: spacing[4],
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderRadius: radius.sm,
  },
  optionTextCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  optionLabel: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
  },
  optionSubtitle: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
});
