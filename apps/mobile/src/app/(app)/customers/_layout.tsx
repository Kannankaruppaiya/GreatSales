/** Customers stack: list → detail → edit, plus the create screen (modal). */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme-provider';

export default function CustomersLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Customers' }} />
      <Stack.Screen name="new" options={{ title: 'New customer', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Customer' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit customer', presentation: 'modal' }} />
    </Stack>
  );
}
