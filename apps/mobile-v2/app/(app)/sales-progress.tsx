import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HillsCool } from '../../src/components/ui/Hills';
import { Gauge } from '../../src/components/ui/Gauge';
import { StatTile } from '../../src/components/ui/StatTile';
import { QuoteSwoosh } from '../../src/components/illustrations/SkyIllustration';
import { ICONS } from '../../src/design-system/icons';
import {
  SolidCalendar, SolidBars, SolidPin, SolidPersonAdd,
} from '../../src/design-system/solid-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/**
 * Screen 02A.1 Sales Progress. Spec: design/screens/02a-1-sales-progress.json.
 *
 * Excluded: the mockup's status bar, and `bg`'s 31px radius - the phone frame
 * again, at a different radius on this board than on the others.
 *
 * It FLOWS. The six tiles are a two-column grid that will grow or shrink with
 * what the period actually holds, and the quotation sits under whatever comes
 * before it.
 *
 * Numbers are the board's, unwired. Every one of them is in the dashboard
 * aggregate - kpis.recurringCommitted, recurringAchieved, totalPct,
 * followUpsDue - so this screen becomes useToday(granularity) with the period
 * pill choosing the granularity.
 */
const ChevronLeft = ICONS['chevron-left'];
const ChevronDown = ICONS['chevron-down'];

const TILES = [
  { value: '₹ 17.5L', label: 'Committed Value', icon: 'account-balance-wallet' },
  { value: '₹ 12.5L', label: 'Achieved Value', icon: 'check-circle' },
  { value: '₹ 28.4L', label: 'Pipeline Value', icon: 'trending-up' },
  { value: '18', label: 'New Sales', icon: 'person-add' },
  { value: '24', label: 'Follow-ups', icon: 'event' },
  { value: '7', label: 'Due This Week', icon: 'schedule' },
] as const;

const DESIGN_TOP = 52;

export default function SalesProgress() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <HillsCool />
      </View>

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Back and title. The title is centred on the board, so it stays
              centred rather than sitting beside the chevron. */}
          <View style={{ marginTop: topPad, height: 24, justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={12}
              style={{ position: 'absolute', left: 24 }}
            >
              <ChevronLeft size={22} color="#0f3244" strokeWidth={2.2} />
            </Pressable>
            <Text
              className="text-center text-ink"
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, lineHeight: 24 }}
            >
              Sales Progress
            </Text>
          </View>

          {/* The period the figures answer for. A granularity and an anchor,
              resolved on read - never a stored range (AGENTS.md). */}
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center bg-surface"
            style={{
              marginTop: 13, marginHorizontal: 24, height: 47, borderRadius: 13,
              borderWidth: 1, borderColor: '#e2ecf0', paddingHorizontal: 18,
            }}
          >
            <SolidCalendar size={20} color="#0e7a4a" />
            <Text
              className="text-ink"
              style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 19, marginLeft: 9, flex: 1 }}
            >
              This Month (Sep 2026)
            </Text>
            <ChevronDown size={14} color="#0f3244" />
          </Pressable>

          <View className="items-center" style={{ marginTop: 10 }}>
            <Gauge pct={0.72} />
          </View>

          {/* The gauge's readout sits INSIDE its arc, which is why it is
              placed over the gauge rather than after it. */}
          <View style={{ marginTop: -94, alignItems: 'center' }}>
            <Text
              className="text-muted"
              style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, lineHeight: 15 }}
            >
              Achievement
            </Text>
            <Text
              className="text-ink"
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 34, lineHeight: 43, marginTop: 1 }}
            >
              72%
            </Text>
            <Text
              className="text-brand"
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19, marginTop: 6 }}
            >
              ₹ 12.5L / ₹ 17.5L
            </Text>
          </View>

          <View
            className="items-center justify-center"
            style={{ marginTop: 25, marginHorizontal: 24, height: 55, borderRadius: 13, backgroundColor: '#eff8f3' }}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="trending-up" size={18} color="#0e7a4a" />
              <Text
                className="text-brand"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 21, marginLeft: 6 }}
              >
                +12%
              </Text>
            </View>
            <Text
              className="text-muted"
              style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 15, marginTop: 1 }}
            >
              vs. last month
            </Text>
          </View>

          {/* Two columns, 157 wide with a 14 gutter between them. */}
          <View style={{ marginTop: 13, paddingHorizontal: 24 }}>
            {[0, 2, 4].map((row) => (
              <View key={row} className="flex-row" style={{ marginTop: row === 0 ? 0 : 11 }}>
                {[TILES[row], TILES[row + 1]].map((t, i) => (
                  <View key={t.label} style={{ flex: 1, marginLeft: i === 0 ? 0 : 14 }}>
                    <StatTile
                      value={t.value}
                      label={t.label}
                      icon={<MaterialIcons name={t.icon} size={23} color="#0e7a4a" />}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            className="overflow-hidden"
            style={{ marginTop: 23, marginHorizontal: 24, height: 52, borderRadius: 13 }}
          >
            <LinearGradient
              colors={['#0e7a4a', '#1ba560']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <SolidBars size={20} color="#ffffff" />
              <Text
                className="text-white"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 21, marginLeft: 9 }}
              >
                View Detailed Breakdown  →
              </Text>
            </LinearGradient>
          </Pressable>

          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'Caveat_400Regular', fontSize: 18, lineHeight: 21, marginTop: 13 }}
          >
            {'“Consistent efforts'}
          </Text>
          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'Caveat_400Regular', fontSize: 18, lineHeight: 21, marginTop: 3 }}
          >
            {'create extraordinary results.”'}
          </Text>
          <View className="items-center" style={{ marginTop: 5 }}>
            <QuoteSwoosh width={125} height={18} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
