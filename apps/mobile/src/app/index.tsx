import { Redirect } from 'expo-router';

import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Entry route — sends the user to the app or the login screen once the
 * persisted session (if any) has been restored. */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Redirect href={user ? '/(app)' : '/login'} />;
}
