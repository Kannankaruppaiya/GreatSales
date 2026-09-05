import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Avatar } from '@/gs/kit';
import { useAuthUser, logout } from '@/gs/auth';
import { useDashboard } from '@/gs/queries/dashboard';
import { lakhs, pct } from '@/gs/domain';

const NOW = new Date();

export default function Profile() {
  const user = useAuthUser();
  const [signingOut, setSigningOut] = useState(false);

  const { data: d } = useDashboard(NOW.getFullYear(), NOW.getMonth() + 1);

  const totalAchieved = d?.totalAchieved ?? 0;
  const achievementPct = d?.achievementPct ?? 0;

  const rows = [
    ['Full Name', user?.name || 'User'],
    ['User Role', user?.role || 'Salesperson'],
    ['Official Email', user?.email || '—'],
    ['User ID', user?.userId ? `${user.userId.slice(0, 8)}…` : '—'],
    ['Tenant', user?.tenantId || 'GreatSales'],
    ['Division', 'LUB (Lubricants)'],
  ] as const;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // No navigation here. logout() always clears the session in its own
    // `finally`, and the AuthGuard in (app)/_layout.tsx redirects on that.
    // Replacing the route here too raced that redirect: the guard unmounted
    // this tree, then this call navigated into a torn-down navigator and the
    // spinner state landed on an unmounting component.
    await logout();
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-1 mb-1">
        <Text className="text-brand font-black text-xs">‹ Back</Text>
      </Pressable>

      {/* Profile Header Card */}
      <Card className="items-center gap-2 py-6">
        <Avatar name={user?.name || 'User'} size={72} />
        <Text className="text-xl font-black text-ink mt-1 tracking-tight">{user?.name || 'User'}</Text>
        <View className="bg-brand-soft px-3 py-1 rounded-full border border-brand-border/60">
          <Text className="text-xs font-black text-brand-dark">{user?.role || 'Sales'} · GreatSales</Text>
        </View>
      </Card>

      {/* Target Achievement summary */}
      <View className="flex-row gap-2.5">
        <Card className="flex-1 items-center p-3.5">
          <Text className="text-xl font-black text-brand">{lakhs(totalAchieved)}</Text>
          <Text className="text-[10px] text-muted mt-1 uppercase font-black tracking-wider">Total Achieved</Text>
        </Card>
        <Card className="flex-1 items-center p-3.5">
          <Text className="text-xl font-black text-brand">{pct(achievementPct, 0)}</Text>
          <Text className="text-[10px] text-muted mt-1 uppercase font-black tracking-wider">Achievement</Text>
        </Card>
      </View>

      {/* Info Rows */}
      <Card>
        <Text className="text-[14px] font-black text-ink mb-2">Account & Territory Details</Text>
        {rows.map(([label, value], i) => (
          <View key={label} className={`flex-row justify-between items-center py-3 ${i > 0 ? 'border-t border-line/80' : ''}`}>
            <Text className="text-xs text-muted font-bold">{label}</Text>
            <Text className="text-xs text-ink font-black">{value}</Text>
          </View>
        ))}
      </Card>

      {/* Sign out Action */}
      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        className="mt-3 py-3.5 rounded-xl bg-danger-soft border border-danger-border/60 items-center"
      >
        {signingOut ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <Text className="text-danger font-black text-[13px]">Sign Out</Text>
        )}
      </Pressable>

      <Text className="text-center text-muted font-medium text-[11px] mt-2">
        GreatSales Mobile Enterprise · v1.0 · © GreatSales
      </Text>
    </Screen>
  );
}
