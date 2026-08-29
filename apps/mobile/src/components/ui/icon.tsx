/**
 * Icon — one coherent icon family (Ionicons, bundled with Expo) wrapped so
 * every icon is sized and colored from tokens. Decorative icons are hidden
 * from screen readers; meaningful ones take an `accessibilityLabel` via the
 * parent control.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme/theme-provider';
import type { ColorTokens } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type IconProps = {
  name: IconName;
  size?: number;
  /** Any color token key, or an explicit color string. */
  color?: keyof ColorTokens | (string & {});
  /** Decorative by default (hidden from assistive tech). */
  accessibilityLabel?: string;
};

export function Icon({ name, size = 20, color = 'textSecondary', accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const resolved = (colors as Record<string, string>)[color as string] ?? (color as string);

  return (
    <Ionicons
      name={name}
      size={size}
      color={resolved}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
