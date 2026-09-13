import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSAvatar } from '../ui';
import type { Notification } from '../../domain/types';
import { formatRelativeTime } from '../../domain/formatters';

export interface NotificationCardProps {
  notification: Notification;
  onPress: () => void;
}

export function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const { colors } = useTheme();

  const entityName = notification.title.split('•')[0]?.trim() || notification.title;

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: !notification.read ? colors.brandBorder : colors.borderSubtle,
        },
        !notification.read && {
          borderLeftWidth: 3,
          borderLeftColor: colors.brand,
        },
      ]}
      accessibilityLabel={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}
    >
      <View style={styles.row}>
        {/* Left: Avatar circle with initials */}
        <GSAvatar name={entityName} size="md" style={styles.avatar} />

        {/* Middle: Title & Message */}
        <View style={styles.contentCol}>
          <View style={styles.headerRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.title,
                {
                  color: colors.textPrimary,
                  fontWeight: notification.read ? '600' : '700',
                },
              ]}
            >
              {notification.title}
            </Text>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
              {formatRelativeTime(notification.createdAt)}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={[styles.message, { color: colors.textSecondary }]}
          >
            {notification.message}
          </Text>
        </View>
      </View>
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[2] + 2,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  avatar: {
    marginRight: spacing[3],
    marginTop: 2,
  },
  contentCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: spacing[2],
  },
  message: {
    fontSize: 12,
    fontFamily: typography.bodySmall.fontFamily,
    lineHeight: 16,
  },
  timeText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '400',
  },
});
