import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Calendar, Check } from 'lucide-react-native';
import { addDays, format, parseISO } from 'date-fns';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet } from './GSBottomSheet';
import { formatShortDate } from '../../domain/formatters';
import { hapticFeedback } from '../../utils/haptics';

export interface GSDatePickerProps {
  label?: string;
  value: string; // ISO date string YYYY-MM-DD
  onChange: (date: string) => void;
  disabled?: boolean;
  error?: string;
  style?: ViewStyle;
}

export function GSDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  error,
  style,
}: GSDatePickerProps) {
  const { colors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  const today = new Date();
  const presets = [
    { label: 'Today', date: format(today, 'yyyy-MM-dd') },
    { label: 'Tomorrow', date: format(addDays(today, 1), 'yyyy-MM-dd') },
    { label: 'In 3 Days', date: format(addDays(today, 3), 'yyyy-MM-dd') },
    { label: 'Next Week', date: format(addDays(today, 7), 'yyyy-MM-dd') },
    { label: 'In 2 Weeks', date: format(addDays(today, 14), 'yyyy-MM-dd') },
    { label: 'Next Month', date: format(addDays(today, 30), 'yyyy-MM-dd') },
  ];

  const handleOpen = () => {
    if (disabled) return;
    hapticFeedback('light');
    setSheetVisible(true);
  };

  const handleSelectDate = (date: string) => {
    hapticFeedback('light');
    onChange(date);
    setSheetVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || 'Select date'}
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
          style={[
            styles.triggerText,
            { color: value ? colors.textPrimary : colors.textTertiary },
          ]}
        >
          {value ? formatShortDate(value) : 'Pick date'}
        </Text>
        <Calendar size={18} color={colors.textSecondary} />
      </Pressable>

      {error && (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      )}

      <GSBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={label || 'Select Date'}
        subtitle={`Current: ${formatShortDate(value)}`}
      >
        <View style={styles.presetList}>
          {presets.map((preset) => {
            const isSelected = preset.date === value;
            return (
              <Pressable
                key={preset.label}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                onPress={() => handleSelectDate(preset.date)}
                style={({ pressed }) => [
                  styles.presetItem,
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
                <View>
                  <Text
                    style={[
                      styles.presetLabel,
                      {
                        color: isSelected ? colors.brand : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text style={[styles.presetDate, { color: colors.textSecondary }]}>
                    {formatShortDate(preset.date)}
                  </Text>
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
    fontWeight: '500',
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    marginTop: spacing[1],
  },
  presetList: {
    paddingBottom: spacing[4],
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderRadius: radius.sm,
  },
  presetLabel: {
    fontSize: typography.body.fontSize,
  },
  presetDate: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
});
