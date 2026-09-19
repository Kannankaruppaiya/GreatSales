import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { TabBar } from '../../src/components/ui/TabBar';
import { ListSearchBar } from '../../src/components/ui/ListSearchBar';
import { CalendarSolidGlyph } from '../../src/components/illustrations/glyphs';
import {
  ChevronLeftStroke, ChevronRightStroke, AlarmClockOutline, QuoteRule,
} from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02C.1 Follow-ups Overview. Spec: design/screens/02c-1-followups.json.
 *
 * Every follow-up the salesperson owns, split three ways by WHEN: past due,
 * today, and the next seven days. The chips filter; the three cards open the
 * three lists.
 *
 * Excluded: the mockup's status bar; the background is the board's #f8fbfc.
 *
 * The three windows are a granularity and an anchor resolved on read, never a
 * stored range (AGENTS.md). "Next 7 days" left open overnight has to mean the
 * seven days from whenever it is looked at, or a tab left open on a phone
 * reports Tuesday's week on Wednesday.
 *
 * The counts must come from ONE request. Four chips and three cards show
 * seven numbers over the same set, and seven calls would let them disagree
 * with each other on a slow connection - 24 in the chip and 6 + 8 + 10 in the
 * cards is one answer, computed once.
 *
 * The photograph is 02c-road.webp: 35KB where the PNG the design exported was
 * 388KB, for the same picture at the same 760x330. It is decorative and the
 * quotation above it carries the meaning, so it is marked as such rather than
 * described to a screen reader.
 */
const PAD_L = 18;
const PAD_R = 19;
const DESIGN_TOP = 49;

/**
 * The chips, with the board's own offsets inside each.
 *
 * `lx` is 10 on all four and `nx` is not derivable from it: the board leaves
 * 12 between "All" and its count and 3 to 5 between the others and theirs.
 * Six numbers that can be checked against the file beat a padding that is
 * right three times out of four - the same reason 02B.1 carries its own.
 */
type Chip = { key: string; label: string; count: string; tone: string; w: number; lx: number; nx: number };
const CHIPS: Chip[] = [
  { key: 'all', label: 'All', count: '24', tone: '#ffffff', w: 62, lx: 10, nx: 39 },
  { key: 'overdue', label: 'Overdue', count: '6', tone: '#e5484d', w: 85, lx: 10, nx: 67 },
  { key: 'today', label: 'Today', count: '8', tone: '#d98a15', w: 70, lx: 10, nx: 53 },
  { key: 'upcoming', label: 'Upcoming', count: '10', tone: '#17a45e', w: 99, lx: 10, nx: 75 },
];
/** The board's three gaps between chips: 9, 7, 8. */
const CHIP_GAPS = [0, 9, 7, 8];

type Category = {
  key: string;
  title: string;
  sub: string;
  count: string;
  tone: string;
  icon: ReactNode;
  /** Only the overdue card is tinted; the other two are white. */
  urgent?: boolean;
  /**
   * The list this card opens. Due Today and Upcoming are boards 02C.3 and
   * 02C.4 and are not built yet, so they open nothing and their card stays
   * un-pressable - the same treatment as 02B.1's two rows with no board. A
   * card that quietly opened the OVERDUE list instead would be worse than
   * one that does nothing: it would show the wrong six follow-ups under the
   * heading "Due Today".
   */
  go?: '/(app)/followups-overdue';
};
const CATEGORIES: Category[] = [
  {
    key: 'overdue', title: 'Overdue Follow-ups', sub: 'Past due. Take action now.',
    count: '6', tone: '#e5484d', urgent: true, icon: <AlarmClockOutline />,
    go: '/(app)/followups-overdue',
  },
  {
    key: 'today', title: 'Due Today', sub: 'Scheduled for today.',
    count: '8', tone: '#d98a15', icon: <CalendarSolidGlyph size={26} color="#d98a15" />,
  },
  {
    key: 'upcoming', title: 'Upcoming', sub: 'Next 7 days.',
    count: '10', tone: '#17a45e', icon: <CalendarSolidGlyph size={26} color="#17a45e" />,
  },
];

export default function FollowUps() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState('all');

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: topPad, height: 27, justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={12}
              style={{ position: 'absolute', left: PAD_L }}
            >
              <ChevronLeftStroke />
            </Pressable>
            <Text
              className="text-center text-ink"
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 26 }}
            >
              Follow-ups Due
            </Text>
          </View>

          <View style={{ marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R }}>
            <ListSearchBar
              placeholder="Search customers or follow-ups..."
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View className="flex-row" style={{ marginTop: 15, marginLeft: PAD_L }}>
            {CHIPS.map((c, i) => {
              const on = c.key === chip;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setChip(c.key)}
                  style={{
                    height: 34, borderRadius: 17, width: c.w,
                    marginLeft: CHIP_GAPS[i],
                    backgroundColor: on ? '#17a45e' : '#ffffff',
                    borderWidth: on ? 0 : 1, borderColor: '#e6eff3',
                  }}
                >
                  <Text
                    style={{
                      position: 'absolute', left: c.lx, top: 9,
                      fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, lineHeight: 17,
                      color: on ? '#ffffff' : '#0f3244',
                    }}
                  >
                    {c.label}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute', left: c.nx, top: 9,
                      fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, lineHeight: 17,
                      color: on ? '#ffffff' : c.tone,
                    }}
                  >
                    {c.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Three 73-tall cards, 15 apart. Only the first is tinted - the
              board paints urgency into the surface, not just the figure. */}
          {CATEGORIES.map((c, i) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`${c.title}, ${c.count}. ${c.sub}`}
              disabled={!c.go}
              onPress={() => c.go && router.push(c.go)}
              style={{
                marginTop: i === 0 ? 47 : 15, marginLeft: PAD_L, marginRight: PAD_R,
                height: 73, borderRadius: 17,
                backgroundColor: c.urgent ? '#fdeded' : '#ffffff',
                borderWidth: 1, borderColor: c.urgent ? '#f8dcdc' : '#e6eff3',
              }}
            >
              <View style={{ position: 'absolute', left: 16, top: 23 }}>{c.icon}</View>
              <Text
                style={{
                  position: 'absolute', left: 55, right: 100, top: 15,
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
                  color: c.urgent ? '#c22b30' : '#0f3244',
                }}
              >
                {c.title}
              </Text>
              <Text
                style={{
                  position: 'absolute', left: 55, right: 100, top: 36,
                  fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
                  color: c.urgent ? '#a86063' : '#6b8796',
                }}
              >
                {c.sub}
              </Text>
              <Text
                style={{
                  position: 'absolute', right: 37, width: 55, top: 17, textAlign: 'right',
                  fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 31, color: c.tone,
                }}
              >
                {c.count}
              </Text>
              <View style={{ position: 'absolute', right: 8, top: 28 }}>
                <ChevronRightStroke size={16} color={c.urgent ? '#cb9092' : '#8aa3b0'} />
              </View>
            </Pressable>
          ))}

          <Text
            className="text-center"
            style={{
              marginTop: 54, marginLeft: 31, marginRight: 32,
              fontFamily: 'Caveat_400Regular', fontSize: 20, lineHeight: 23, color: '#3e6374',
            }}
          >
            {'“Consistent follow-ups'}
          </Text>
          <Text
            className="text-center"
            style={{
              marginLeft: 31, marginRight: 32,
              fontFamily: 'Caveat_400Regular', fontSize: 20, lineHeight: 23, color: '#3e6374',
            }}
          >
            {'create stronger relationships.”'}
          </Text>
          <View className="items-center" style={{ marginTop: 6 }}>
            <QuoteRule />
          </View>

          {/* Decorative: the quotation above it says what it is for, so it is
              hidden from a screen reader rather than described twice. */}
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            className="overflow-hidden"
            style={{ marginTop: 17, marginLeft: 5, marginRight: 6, height: 186, borderRadius: 21 }}
          >
            <Image
              source={require('../../assets/images/02c-road.webp')}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
            {/* photo-lift: white at 22%, which is what keeps the picture from
                sitting darker than everything above it. */}
            <View
              style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <TabBar
        active="home"
        bottomInset={insets.bottom}
        onPressTab={(key) => { if (key === 'home') router.replace('/(app)/home'); }}
      />
    </View>
  );
}
