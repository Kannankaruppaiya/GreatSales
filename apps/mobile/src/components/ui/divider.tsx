/**
 * Divider — a hairline separator. `inset` aligns it with list-row text
 * (past the leading icon) for grouped lists.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function Divider({ inset = false }: { inset?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.line,
        { backgroundColor: colors.divider, marginLeft: inset ? spacing.lg + 40 + spacing.md : 0 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth * 2, width: '100%' },
});
