import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../design-system/theme';
import { radius, typography } from '../../design-system/tokens';
import { formatInitials } from '../../domain/formatters';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

export interface GSAvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  status?: 'online' | 'offline' | 'busy' | 'away';
  showBorder?: boolean;
  variant?: 'default' | 'identity';
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

const SIZE_MAP: Record<AvatarSize, { dimension: number; fontSize: number; statusSize: number }> = {
  xs: { dimension: 24, fontSize: 10, statusSize: 6 },
  sm: { dimension: 30, fontSize: 11, statusSize: 8 },
  md: { dimension: 36, fontSize: 13, statusSize: 9 }, // 34-38px enterprise standard
  lg: { dimension: 44, fontSize: 15, statusSize: 11 },
  xl: { dimension: 60, fontSize: 20, statusSize: 13 },
  hero: { dimension: 76, fontSize: 26, statusSize: 15 },
};

const PASTEL_THEMES = [
  { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }, // Warm Amber
  { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' }, // Emerald
  { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' }, // Classic Blue
  { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' }, // Rose Coral
  { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' }, // Indigo
  { bg: '#CCFBF1', text: '#115E59', border: '#99F6E4' }, // Teal
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_THEMES.length;
  return PASTEL_THEMES[index];
}

export function GSAvatar({
  uri,
  name = 'User',
  size = 'md',
  status,
  showBorder = true,
  variant = 'default',
  onPress,
  style,
  accessibilityLabel,
  testID,
}: GSAvatarProps) {
  const { colors, isDark } = useTheme();
  const [imageError, setImageError] = useState(false);

  const { dimension, fontSize, statusSize } = SIZE_MAP[size];
  const initials = formatInitials(name);
  const colorScheme = getAvatarColor(name);

  const hasValidImage = Boolean(uri) && !imageError;
  const isIdentity = variant === 'identity';

  const avatarBg = isIdentity
    ? isDark
      ? colors.surfaceInteractive
      : colors.surfaceElevated
    : isDark
    ? colors.surfaceElevated
    : colorScheme.bg;

  const avatarBorder = isIdentity
    ? isDark
      ? colors.borderStrong
      : colors.border
    : isDark
    ? colors.borderSubtle
    : colorScheme.border;

  const avatarTextColor = isIdentity
    ? colors.textPrimary
    : isDark
    ? colors.textPrimary
    : colorScheme.text;

  const content = (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: radius.full,
          backgroundColor: avatarBg,
          borderColor: showBorder ? avatarBorder : 'transparent',
          borderWidth: showBorder ? 1 : 0,
        },
        style,
      ]}
    >
      {hasValidImage ? (
        <Image
          source={{ uri: uri! }}
          style={[styles.image, { width: dimension, height: dimension, borderRadius: radius.full }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setImageError(true)}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize,
              color: avatarTextColor,
              fontFamily: typography.cardTitle.fontFamily,
              fontWeight: '700',
              letterSpacing: 0.2,
            },
          ]}
        >
          {initials}
        </Text>
      )}

      {status && (
        <View
          style={[
            styles.statusDot,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              borderColor: colors.surface,
              backgroundColor:
                status === 'online'
                  ? colors.brand
                  : status === 'busy'
                  ? colors.danger
                  : status === 'away'
                  ? colors.warning
                  : colors.textTertiary,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `Avatar for ${name}`}
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
  },
});
