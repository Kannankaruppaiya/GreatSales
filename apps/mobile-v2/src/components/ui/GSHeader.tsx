import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design-system/theme';
import { spacing, typography } from '../../design-system/tokens';
import { GSIconButton } from './GSIconButton';

export interface GSHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightActions?: React.ReactNode;
  style?: ViewStyle;
}

export function GSHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightActions,
  style,
}: GSHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: spacing[3] + insets.top,
        },
        style,
      ]}
    >
      <View style={styles.leftContainer}>
        {showBack && (
          <GSIconButton
            icon={<ArrowLeft size={20} color={colors.textPrimary} />}
            variant="ghost"
            size="sm"
            accessibilityLabel="Go back"
            onPress={handleBack}
            style={styles.backBtn}
          />
        )}
        <View style={styles.textContainer}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightActions && <View style={styles.rightContainer}>{rightActions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    // paddingVertical removed — paddingTop is set dynamically via insets
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    minHeight: 56,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: spacing[2],
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.sectionTitle.fontSize,
    fontFamily: typography.sectionTitle.fontFamily,
    fontWeight: '700',
    lineHeight: typography.sectionTitle.lineHeight,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    lineHeight: typography.caption.lineHeight,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
});
