import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { HillsPale } from '../../src/components/ui/Hills';
import { TabBarTall } from '../../src/components/ui/TabBarTall';
import {
  PhoneOutline, CardOutline, FileOutline, BarsSolid23, EllipsisGlyph,
  FunnelOutline, AlertTriangleOutline, ChevronRightStroke,
} from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02B.1 Actions Overview. Spec: design/screens/02b-1-actions.json.
 *
 * Everything asking for the salesperson's attention, grouped by what kind of
 * thing it is, with a count against each. The three chips above filter the
 * same list; the five rows below open it.
 *
 * Excluded: the mockup's status bar. This board has no phone-frame rect - it
 * carries its background on the board itself, at #f8fbfc.
 *
 * This is the first screen of the app's SECOND visual generation and it does
 * not share the first's chrome. The margins are 18/19 rather than 22/24, the
 * rows are 16-radius rather than 13, the tab bar is 79 tall rather than 52,
 * and the icons are the board's OUTLINE family at stroke 2 where every screen
 * up to 02A drew solid fills. None of that is folded into the earlier
 * components; see TabBarTall and outline-glyphs.tsx for why.
 *
 * Counts are the board's, unwired. All five come from one aggregate - the
 * followups, payments, leads and orders repositories each already answer a
 * count for the signed-in salesperson - so this screen is one request, not
 * five: five separate calls would let the chips disagree with the rows.
 *
 * `h-left` is an EMPTY 27 box on the board. It is left empty here rather than
 * given a back chevron: this screen is a tab destination, so there is nothing
 * behind it to go back to, and inventing a control the design did not draw is
 * how a screen stops matching its board.
 */
const PAD_L = 18;
const PAD_R = 19;
const DESIGN_TOP = 49;

type Chip = { key: string; label: string; count: string; tone: string; w: number; lx: number; nx: number };
const CHIPS: Chip[] = [
  { key: 'all', label: 'All', count: '12', tone: '#ffffff', w: 99, lx: 28, nx: 56 },
  { key: 'overdue', label: 'Overdue', count: '5', tone: '#e5484d', w: 114, lx: 24, nx: 82 },
  { key: 'payments', label: 'Payments', count: '3', tone: '#17a45e', w: 111, lx: 19, nx: 84 },
];

/**
 * `go` is the list each row opens. Two of the five have no board on the page
 * - Proposals / Commitments and Others - so they open nothing rather than
 * being pointed at a near-enough screen, and the row stays un-pressable so
 * the absence is visible rather than a tap that does nothing.
 */
type Row = {
  title: string; sub: string; count: string; tone: string; icon: ReactNode;
  go?: '/(app)/followups-overdue' | '/(app)/payments-outstanding' | '/(app)/opportunities-attention';
};
const ROWS: Row[] = [
  { title: 'Overdue Follow-up', sub: 'Customer follow-ups pending', count: '5', tone: '#17a45e', icon: <PhoneOutline />, go: '/(app)/followups-overdue' },
  { title: 'Payment / Outstanding', sub: 'Payments overdue', count: '3', tone: '#17a45e', icon: <CardOutline />, go: '/(app)/payments-outstanding' },
  { title: 'Opportunities', sub: 'Require your attention', count: '2', tone: '#17a45e', icon: <BarsSolid23 />, go: '/(app)/opportunities-attention' },
  { title: 'Proposals / Commitments', sub: 'Awaiting response', count: '2', tone: '#17a45e', icon: <FileOutline /> },
  // Zero is painted muted rather than green: nothing here is an achievement.
  { title: 'Others', sub: 'Miscellaneous items', count: '0', tone: '#8aa3b0', icon: <EllipsisGlyph /> },
];

export default function Actions() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const [chip, setChip] = useState('all');

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 79 + insets.bottom - 11 }}>
        <HillsPale />
      </View>

      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: topPad, height: 27, justifyContent: 'center' }}>
            <Text
              className="text-center text-ink"
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 26 }}
            >
              Actions Need Attention
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter actions"
              hitSlop={10}
              style={{ position: 'absolute', right: PAD_R }}
            >
              <FunnelOutline />
            </Pressable>
          </View>

          {/*
            The chips are 99, 114 and 111 wide with 8 between them, and their
            label and count sit at (28, 56), (24, 82) and (19, 84) inside
            that. All six numbers are the board's.

            Centring the pair inside each width gets two of the three right
            and puts "All" six pixels out, because the board leaves a wider
            gap between "All" and "12" than between "Overdue" and "5". That
            is the design's, so it is carried as data rather than smoothed
            away - and a table of six offsets is easier to check against the
            file than a padding that is right twice.
          */}
          <View className="flex-row" style={{ marginTop: 33, marginLeft: PAD_L }}>
            {CHIPS.map((c, i) => {
              const on = c.key === chip;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setChip(c.key)}
                  style={{
                    height: 36, borderRadius: 18, width: c.w,
                    marginLeft: i === 0 ? 0 : 8,
                    backgroundColor: on ? '#17a45e' : '#ffffff',
                    borderWidth: on ? 0 : 1, borderColor: '#e6eff3',
                  }}
                >
                  <Text
                    style={{
                      position: 'absolute', left: c.lx, top: 10,
                      fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 19,
                      color: on ? '#ffffff' : '#0f3244',
                    }}
                  >
                    {c.label}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute', left: c.nx, top: 10,
                      fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, lineHeight: 19,
                      color: on ? '#ffffff' : c.tone,
                    }}
                  >
                    {c.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* The one banner. Its own red palette - #fdeded on #f7d6d6, a
              #c22b30 headline over #a86063 - none of which is the app's
              danger token, because this is a surface and that is a colour for
              text and rules. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/followups-overdue')}
            style={{
              marginTop: 19, marginLeft: PAD_L, marginRight: PAD_R,
              height: 60, borderRadius: 16,
              backgroundColor: '#fdeded', borderWidth: 1, borderColor: '#f7d6d6',
            }}
          >
            <View style={{ position: 'absolute', left: 16, top: 19 }}><AlertTriangleOutline /></View>
            <Text
              style={{
                position: 'absolute', left: 45, right: 40, top: 10,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20, color: '#c22b30',
              }}
            >
              5 items are overdue
            </Text>
            <Text
              style={{
                position: 'absolute', left: 45, right: 40, top: 30,
                fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17, color: '#a86063',
              }}
            >
              Take action to keep your pipeline healthy.
            </Text>
            <View style={{ position: 'absolute', right: 4, top: 20 }}>
              <ChevronRightStroke size={17} color="#cb9092" />
            </View>
          </Pressable>

          {/* Five rows, 65 tall, 10 apart. */}
          {ROWS.map((r, i) => (
            <Pressable
              key={r.title}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${r.count}. ${r.sub}`}
              disabled={!r.go}
              onPress={() => r.go && router.push(r.go)}
              style={{
                marginTop: i === 0 ? 18 : 10, marginLeft: PAD_L, marginRight: PAD_R,
                height: 65, borderRadius: 16,
                backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
              }}
            >
              <View style={{ position: 'absolute', left: 16, top: 21 }}>{r.icon}</View>
              <Text
                className="text-ink"
                style={{
                  position: 'absolute', left: 52, right: 90, top: 14,
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
                }}
              >
                {r.title}
              </Text>
              <Text
                className="text-muted"
                style={{
                  position: 'absolute', left: 52, right: 90, top: 34,
                  fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
                }}
              >
                {r.sub}
              </Text>
              <Text
                style={{
                  position: 'absolute', right: 35, width: 49, top: 17, textAlign: 'right',
                  fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 31, color: r.tone,
                }}
              >
                {r.count}
              </Text>
              <View style={{ position: 'absolute', right: 8, top: 25 }}>
                <ChevronRightStroke />
              </View>
            </Pressable>
          ))}

          <Text
            className="text-center"
            style={{
              marginTop: 37, marginLeft: 31, marginRight: 32,
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
            {'create bigger opportunities.”'}
          </Text>
          <View className="items-center" style={{ marginTop: 6 }}>
            <Svg width={81} height={9} viewBox="0 0 81 9">
              <Path
                d="M3.92,2.57C22.68,9 56.7,4.95 77.08,3.86"
                stroke="#17a45e"
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
        </ScrollView>
      </SafeAreaView>

      <TabBarTall
        active="home"
        bottomInset={insets.bottom}
        onPressTab={(key) => { if (key === 'home') router.replace('/(app)/home'); }}
      />
    </View>
  );
}
