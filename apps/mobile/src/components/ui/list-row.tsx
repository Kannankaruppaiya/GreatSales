/**
 * ListRow — a standard tappable/static list item: leading icon, title +
 * optional subtitle, optional trailing content, optional chevron. Enforces the
 * minimum touch height and correct a11y roles/state.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { hitTarget } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  chevron?: boolean;
  style?: ViewStyle;
};

export function ListRow({
  title,
  subtitle,
  leadingIcon,
  trailing,
  onPress,
  disabled = false,
  chevron = false,
  style,
}: ListRowProps) {
  const { colors, spacing, radii } = useTheme();

  const content = (
    <>
      {leadingIcon ? (
        <View
          style={[
            styles.leading,
            { backgroundColor: colors.primarySubtle, borderRadius: radii.sm },
          ]}
        >
          <Icon name={leadingIcon} size={20} color={disabled ? 'disabledText' : 'primary'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyLg" color={disabled ? 'muted' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-forward" size={18} color="textMuted" /> : null}
    </>
  );

  const rowStyle: ViewStyle = {
    minHeight: Math.max(56, hitTarget),
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  };

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        style={({ pressed }) => [
          styles.row,
          rowStyle,
          pressed && { backgroundColor: colors.surfaceSunken },
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityState={{ disabled }}
      style={[styles.row, rowStyle, style]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  leading: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
