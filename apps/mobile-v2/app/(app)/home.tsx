import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { FollowUpRow } from '../../src/components/ui/FollowUpRow';
import { TabBar } from '../../src/components/ui/TabBar';
import {
  SolidBell, SolidCalendar, SolidPin, SolidPersonAdd, SolidScan, SolidCart,
} from '../../src/design-system/solid-icons';

/**
 * Screen 01D Sales Home. Spec: design/screens/01d-sales-home.json.
 *
 * Excluded: the mockup's status bar and the 34px frame radius. Also the
 * `avatar`, which is the demo user's photograph - UserRow carries no avatar
 * field, so a real user has nothing to render there. The design already uses
 * an initials chip three times on this very screen (SC, AT, KW), so that is
 * what stands in.
 *
 * This one FLOWS, unlike 01B and 01C. Its content is a stack of sections that
 * grows with the data - three follow-ups today, eleven tomorrow - so pinning
 * it to board coordinates would be wrong the first time a list got longer.
 * Only the header band and the tab bar are placed absolutely.
 *
 * Numbers and rows are the board's, unwired. The dashboard repository returns
 * all of them in one request (kpis.followUpsDue, followUps), and this screen
 * moves to useToday() when the sign-in flow in front of it does.
 */
const BOARD_W = 376;

const STATS = [
  { n: '5', label: 'Follow-ups', tint: '#e9f6ef' },
  { n: '3', label: 'Site Visits', tint: '#e9f6ef' },
  // The third tile is blue, not green: proposals are not a visit count.
  { n: '2', label: 'Proposals', tint: '#ebf1f8' },
] as const;

const QUICK = [
  { label: 'Add Lead', Icon: SolidPersonAdd, colour: '#17a45e' },
  { label: 'Log Visit', Icon: SolidPin, colour: '#2e7fc2' },
  { label: 'Scan Bill', Icon: SolidScan, colour: '#17a45e' },
  { label: 'New Order', Icon: SolidCart, colour: '#17a45e' },
] as const;

const ROWS = [
  { tone: 'overdue', time: '04:00 PM', initials: 'SC', title: 'Southern Auto Works', subtitle: 'Call & discuss proposal', action: 'call' },
  { tone: 'due', time: '05:30 PM', initials: 'AT', title: 'Anand Machine Tools', subtitle: 'Site visit confirmation', action: 'visit' },
  { tone: 'upcoming', time: 'Tomorrow', initials: 'KW', title: 'Krishna Metal Works', subtitle: 'Follow up on payment', action: 'call' },
] as const;

/** The hills behind the header, in the design's own coordinate space. */
function HeaderHills() {
  return (
    <Svg width="100%" height={135} viewBox="2976 1064 376 135" preserveAspectRatio="none">
      <Path fill="#e2f3eb" d="M2976,1168.25L3025.44,1144.33L3061.87,1159.71L3111.31,1132.38L3165.95,1158L3217.99,1139.21L3267.43,1161.42L3316.87,1142.63L3352,1158L3352,1199L2976,1199Z" />
      <Path fill="#d2ebdf" d="M2976,1180.21L3033.25,1159.71L3082.69,1175.08L3139.93,1152.88L3197.18,1171.67L3251.82,1156.29L3303.86,1175.08L3352,1163.13L3352,1199L2976,1199Z" />
    </Svg>
  );
}

export default function SalesHome() {
  const insets = useSafeAreaInsets();
  const at = (y: number) => Math.max(0, y - insets.top);

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ position: 'absolute', left: 0, right: 0, top: at(111) }}>
        <HeaderHills />
      </View>

      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand, bell and the initials chip that stands in for the avatar. */}
          <View
            className="flex-row items-start justify-between"
            // Left gutter 22, right 9: the avatar ends at 367 of 376.
            style={{ paddingLeft: 22, paddingRight: 9, marginTop: at(57) }}
          >
            <View>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, lineHeight: 26, color: '#0f3244' }}>
                <Text style={{ color: '#17a45e' }}>G</Text>reatSales
              </Text>
              <Text
                className="text-muted"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, lineHeight: 13, marginTop: 1 }}
              >
                Field Sales CRM
              </Text>
            </View>

            <View className="flex-row items-center">
              <Pressable accessibilityRole="button" accessibilityLabel="Notifications, 3 unread" hitSlop={10}>
                <SolidBell size={23} color="#123e52" />
                <View
                  className="items-center justify-center"
                  style={{
                    position: 'absolute', right: -7, top: -5, width: 16, height: 16, borderRadius: 8,
                    backgroundColor: '#e5484d', borderWidth: 1.5, borderColor: '#ffffff',
                  }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, lineHeight: 12, color: '#ffffff' }}>
                    3
                  </Text>
                </View>
              </Pressable>

              <View
                className="items-center justify-center bg-brand-soft"
                style={{ width: 39, height: 39, borderRadius: 19.5, marginLeft: 16 }}
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, lineHeight: 18, color: '#0e7a4a' }}>
                  M
                </Text>
              </View>
            </View>
          </View>

          {/* Greeting, and the quotation the design sets against it. */}
          <View className="flex-row items-start justify-between" style={{ paddingHorizontal: 22, marginTop: 21 }}>
            <View>
              <Text className="text-muted" style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 17 }}>
                Good Morning,
              </Text>
              <Text className="text-ink" style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 29, marginTop: -1 }}>
                Megala 👋
              </Text>
            </View>
            <View style={{ width: 160 }}>
              <Text className="text-right" style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: '#5e7a88' }}>
                {'“More conversations.'}
              </Text>
              <Text className="text-right" style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: '#5e7a88' }}>
                {'More opportunities.”'}
              </Text>
            </View>
          </View>

          {/* Date and place, as two bordered pills. */}
          <View className="flex-row justify-between" style={{ paddingHorizontal: 22, marginTop: 32 }}>
            <View
              className="flex-row items-center bg-surface"
              style={{ width: 159, height: 33, borderRadius: 10, borderWidth: 1, borderColor: '#e4edf1', paddingHorizontal: 12 }}
            >
              <SolidCalendar size={16} color="#5e7a88" />
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16, color: '#123e52', marginLeft: 6 }}>
                Sun, 14 Sep 2026
              </Text>
            </View>
            <View
              className="flex-row items-center bg-surface"
              style={{ width: 100, height: 33, borderRadius: 10, borderWidth: 1, borderColor: '#e4edf1', paddingHorizontal: 11 }}
            >
              <SolidPin size={16} color="#5e7a88" />
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16, color: '#123e52', marginLeft: 5 }}>
                Chennai
              </Text>
            </View>
          </View>

          {/* Right gutter 19, not 22: the section chevron ends at 357. */}
          <View style={{ paddingLeft: 22, paddingRight: 19, marginTop: 29 }}>
            <SectionHeader title="Today's Focus" onViewAll={() => {}} />
          </View>
          <View className="flex-row justify-between" style={{ paddingHorizontal: 22, marginTop: 10 }}>
            {STATS.map(({ n, label, tint }) => (
              <View
                key={label}
                className="items-center justify-center"
                style={{ width: `${(103 / (BOARD_W - 44)) * 100}%`, height: 73, borderRadius: 13, backgroundColor: tint }}
              >
                <Text className="text-ink" style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, lineHeight: 33 }}>
                  {n}
                </Text>
                <Text className="text-muted" style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 16, marginTop: 2 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: 22, marginTop: 29 }}>
            <SectionHeader title="Quick Actions" />
          </View>
          <View className="flex-row justify-between" style={{ paddingHorizontal: 22, marginTop: 10 }}>
            {QUICK.map(({ label, Icon, colour }) => (
              <View key={label} className="items-center" style={{ width: 81 }}>
                <Pressable
                  accessibilityRole="button"
                  className="items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#edf6f1' }}
                >
                  <Icon size={21} color={colour} />
                </Pressable>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, lineHeight: 15, color: '#123e52', marginTop: 7 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* 59, not 29: the quick-action LABELS end at 487 and the heading is
              at 546. The two sections above measure from a tile's bottom. */}
          <View style={{ paddingLeft: 22, paddingRight: 19, marginTop: 59 }}>
            <SectionHeader title="Upcoming Follow-ups" onViewAll={() => {}} />
          </View>
          <View style={{ paddingHorizontal: 18, marginTop: 10 }}>
            {ROWS.map((r, i) => (
              <View key={r.initials} style={{ marginTop: i === 0 ? 0 : 7 }}>
                <FollowUpRow {...r} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <TabBar active="home" bottomInset={insets.bottom} />
    </View>
  );
}
