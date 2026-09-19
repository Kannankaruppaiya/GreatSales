import { Redirect } from 'expo-router';

/**
 * The entry point sends everyone to the splash for now.
 *
 * Once the session is restored on launch this becomes the branch between the
 * splash and /home; it stays a redirect rather than a screen so there is
 * nothing to unmount when that lands.
 *
 * Home is /home rather than the (app) group's index. Route groups do not
 * appear in the URL, so app/(app)/index.tsx would resolve to "/" as well and
 * collide with this redirect - which it did, and "/" rendered the splash
 * while the home screen was unreachable.
 */
export default function Index() {
  return <Redirect href="/(auth)/splash" />;
}
