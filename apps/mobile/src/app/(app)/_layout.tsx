import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { C } from '@/gs/theme';
import { HomeIcon, ChartIcon, TargetIcon, CheckCircleIcon, GridIcon } from '@/gs/icons';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.line,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
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
  );
}
