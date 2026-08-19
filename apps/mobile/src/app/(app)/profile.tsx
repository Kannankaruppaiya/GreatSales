import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Avatar } from '@/gs/kit';
import { ME, kpis } from '@/gs/mock';
import { lakhs, pct } from '@/gs/domain';

export default function Profile() {
  const k = kpis();
  const rows = [
    ['Full Name', ME.name],
    ['Designation', ME.role],
    ['Assigned Region', ME.region],
    ['Primary Division', 'LUB (Lubricants)'],
    ['Company Workspace', 'GreatSales Enterprise'],
    ['Official Email', 'sankar@greatsales.test'],
  ] as const;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-1 mb-1">
        <Text className="text-brand font-black text-xs">‹ Back to More</Text>
      </Pressable>

      {/* Profile Header Card */}
      <Card className="items-center gap-2 py-6">
        <Avatar name={ME.name} size={72} />
        <Text className="text-xl font-black text-ink mt-1 tracking-tight">{ME.name}</Text>
        <View className="bg-brand-soft px-3 py-1 rounded-full border border-brand-border/60">
          <Text className="text-xs font-black text-brand-dark">{ME.role} · {ME.region}</Text>
        </View>
      </Card>

      {/* Target Achievement summary */}
      <View className="flex-row gap-2.5">
        <Card className="flex-1 items-center p-3.5">
          <Text className="text-xl font-black text-brand">{lakhs(k.totalAchieved)}</Text>
          <Text className="text-[10px] text-muted mt-1 uppercase font-black tracking-wider">Total Achieved</Text>
        </Card>
        <Card className="flex-1 items-center p-3.5">
          <Text className="text-xl font-black text-brand">{pct(k.achievementPct, 0)}</Text>
          <Text className="text-[10px] text-muted mt-1 uppercase font-black tracking-wider">Of Target</Text>
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
        onPress={() => router.replace('/')}
        className="mt-3 py-3.5 rounded-xl bg-red-soft border border-red-border/60 items-center"
      >
        <Text className="text-danger font-black text-[13px]">Sign Out</Text>
      </Pressable>

      <Text className="text-center text-muted font-medium text-[11px] mt-2">
        GreatSales Mobile Enterprise · v6.0 · © GreatWorks
      </Text>
    </Screen>
  );
}
