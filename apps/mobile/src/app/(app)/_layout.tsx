/**
 * Protected app area. Redirects to sign-in if there's no session, otherwise
 * renders the salesperson tab shell. Tab chrome is themed from tokens and the
 * icons come from the one icon family (Ionicons).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/theme-provider';

export default function AppLayout() {
  const { status } = useAuth();
  const { colors, typography } = useTheme();

  if (status === 'unauthenticated') return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: typography.label.fontWeight },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
