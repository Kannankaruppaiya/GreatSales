/**
 * Account — the signed-in user's profile from `/auth/me`, plus sign-out.
 * Sign-out is destructive (ends the session) so it's confirmed first. Because
 * the API has no revocation endpoint yet, this is a local clear — see
 * auth-context for where a `/auth/logout` call will slot in.
 */
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/theme-provider';

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
      {badge ? (
        <Badge label={badge} tone="primary" />
      ) : (
        <Text variant="body" numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

export default function AccountScreen() {
  const { spacing } = useTheme();
  const { user, profileStatus, reloadProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You’ll need your workspace ID, email, and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  }

  if (!user && profileStatus === 'loading') return <Screen center><LoadingState label="Loading your profile…" /></Screen>;
  if (!user) {
    return (
      <Screen center>
        <ErrorState
          title="Couldn’t load your profile"
          description="Check your connection and try again."
          onRetry={reloadProfile}
        />
      </Screen>
    );
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll contentStyle={{ gap: spacing.xl }}>
      <Card>
        <View style={{ gap: spacing.lg }}>
          <InfoRow label="Name" value={user.name} />
          <Divider />
          <InfoRow label="Email" value={user.email} />
          <Divider />
          <InfoRow label="Username" value={user.username} />
          <Divider />
          <InfoRow label="Role" value={user.role ?? '—'} badge={user.role ?? undefined} />
          <Divider />
          <InfoRow label="Workspace ID" value={user.tenantId} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button label="Sign out" variant="destructive" leadingIcon="log-out-outline" onPress={confirmSignOut} loading={signingOut} />
        <Text variant="caption" color="muted" center>
          GreatSales · v{version}
        </Text>
      </View>
    </Screen>
  );
}
