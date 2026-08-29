/**
 * Select — a labelled field that opens a bottom-sheet list of options (native
 * pickers vary too much across platforms to theme consistently). Same label /
 * error structure as TextField. Optionally clearable to an unset value.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { hitTarget } from '@/theme/tokens';

export type SelectOption = { value: string; label: string };

type SelectProps = {
  label: string;
  value?: string;
  options: SelectOption[];
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
};

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
  required,
  allowClear = true,
  disabled,
}: SelectProps) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

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

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selected?.label ?? 'not set'}`}
        disabled={disabled}
        style={[
          styles.field,
          {
            backgroundColor: disabled ? colors.disabledBg : colors.inputBg,
            borderColor: error ? colors.error : colors.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            minHeight: Math.max(52, hitTarget),
          },
        ]}
      >
        <Text variant="body" color={selected ? 'primary' : 'muted'} style={styles.flex} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </Pressable>

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert-circle" size={14} color="error" />
          <Text variant="bodySm" color="error" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: colors.divider }]}>
            <Text variant="h3">{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color="textSecondary" />
            </Pressable>
          </View>
          <ScrollView style={styles.optionsScroll}>
            {allowClear ? (
              <Option
                label="None"
                selected={value === undefined}
                onPress={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                muted
              />
            ) : null}
            {options.map((o) => (
              <Option
                key={o.value}
                label={o.label}
                selected={o.value === value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
  muted,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  muted?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        { paddingHorizontal: spacing.lg, minHeight: hitTarget, backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
      ]}
    >
      <Text variant="body" color={muted ? 'muted' : 'primary'} style={styles.flex}>
        {label}
      </Text>
      {selected ? <Icon name="checkmark" size={20} color="primary" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  flex: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionsScroll: { paddingVertical: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});
