import { Redirect } from 'expo-router';

/**
 * The entry point sends everyone to the splash for now.
 *
 * Once the session is restored on launch this becomes the branch between the
 * splash and the signed-in home; it stays a redirect rather than a screen so
 * there is nothing to unmount when that lands.
 */
export default function Index() {
  return <Redirect href="/(auth)/splash" />;
}
