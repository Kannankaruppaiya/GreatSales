import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { C } from '@/gs/theme';
import { HomeIcon, ChartIcon, TargetIcon, CheckCircleIcon, GridIcon } from '@/gs/icons';
import { queryClient } from '@/gs/queryClient';
import { useSessionStatus } from '@/gs/auth';

export default function AppTabs() {
  // Mounted before the session is known (see the guard in the root layout), so
  // hold here rather than letting every tab query fire without a token.
  const status = useSessionStatus();
  // Read before the early return: hooks cannot be conditional.
  const insets = useSafeAreaInsets();
  if (status === 'unknown') return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: C.brand,
          tabBarInactiveTintColor: C.muted,
          tabBarStyle: {
            backgroundColor: C.surface,
            borderTopColor: C.line,
            borderTopWidth: 1,
            // React Navigation sizes the bar from the bottom safe-area inset
            // on its own, but ONLY while height is unset — an explicit height
            // replaces that calculation instead of adding to it. Hardcoding 64
            // therefore looked right on a phone with three-button navigation
            // and pushed the labels under the gesture bar on every phone that
            // has one, which is most of them. The inset is 0 where there is no
            // gesture bar, so this is the same 64 on those devices.
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,
            elevation: 8,
            shadowColor: '#0f172a',
            shadowOpacity: 0.06,
            shadowRadius: 10,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.2,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <HomeIcon size={20} color={color} />
                {focused ? <View className="w-1 h-1 rounded-full bg-brand mt-1" /> : null}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="projections"
          options={{
            title: 'Projections',
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <ChartIcon size={20} color={color} />
                {focused ? <View className="w-1 h-1 rounded-full bg-brand mt-1" /> : null}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'New Sales',
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <TargetIcon size={20} color={color} />
                {focused ? <View className="w-1 h-1 rounded-full bg-brand mt-1" /> : null}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="followups"
          options={{
            title: 'Follow-ups',
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <CheckCircleIcon size={20} color={color} />
                {focused ? <View className="w-1 h-1 rounded-full bg-brand mt-1" /> : null}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <GridIcon size={20} color={color} />
                {focused ? <View className="w-1 h-1 rounded-full bg-brand mt-1" /> : null}
              </View>
            ),
          }}
        />
        <Tabs.Screen name="orders" options={{ href: null }} />
        <Tabs.Screen name="payments" options={{ href: null }} />
        <Tabs.Screen name="customers" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </QueryClientProvider>
  );
}
