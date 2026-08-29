/**
 * Full-screen state views: Loading, Empty, and Error. Every data screen should
 * render one of these instead of a blank screen or a bare spinner. Each states
 * what's happening and — where the user can act — offers a clear next step.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.center, { gap: spacing.md }]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
    </View>
  );
}

type MessageStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
};

function MessageState({ icon, title, description, actionLabel, onAction, tone = 'neutral' }: MessageStateProps) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View style={[styles.center, { gap: spacing.md, paddingHorizontal: spacing['2xl'] }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: tone === 'error' ? colors.errorSubtle : colors.surfaceSunken,
            borderRadius: radii.pill,
          },
        ]}
      >
        <Icon name={icon} size={28} color={tone === 'error' ? 'error' : 'textMuted'} />
      </View>
      <Text variant="h3" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="secondary" center>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>
          <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'primary' : 'secondary'} />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState(props: Omit<MessageStateProps, 'tone'>) {
  return <MessageState {...props} tone="neutral" />;
}

/** Error state with a Retry affordance. Use for network/server failures. */
export function ErrorState({
  title = 'Something needs another try',
  description = 'We couldn’t load this. Check your connection and try again.',
  onRetry,
  icon = 'cloud-offline-outline',
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: IconName;
}) {
  return (
    <MessageState
      icon={icon}
      title={title}
      description={description}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
      tone="error"
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});
