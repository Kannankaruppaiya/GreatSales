import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { router } from 'expo-router';
import { HillsCool } from '../../src/components/ui/Hills';
import { KpiCard } from '../../src/components/ui/KpiCard';
import { TrendChart } from '../../src/components/ui/TrendChart';
import { ICONS } from '../../src/design-system/icons';
import {
  TargetGlyph, RisingBarsGlyph, StackGlyph, PersonPlusGlyph,
  CalendarSolidGlyph, ClockGlyph, Calendar20Glyph, BoltGlyph,
} from '../../src/components/illustrations/glyphs';

/**
 * Screen 02A.3 Detailed Breakdown. Spec: design/screens/02a-3-breakdown.json.
 *
 * Reached from 02A.1's "View Detailed Breakdown". It is the same period over
 * the same figures, with each one given its change against the previous
 * period and six months of history behind it.
 *
 * Excluded: the mockup's status bar, and `bg`'s 31px radius - the phone
 * frame.
 *
 * It FLOWS down to the chart and then stops flowing. The chart, its two axes
 * and its month labels are four separately-placed things that have to line up
 * with each other to the pixel - the "8L" label has to sit on the gridline it
 * names - so that block is one fixed-height box with absolute children, and
 * the numbers in it are the board's own offsets from the block's top.
 *
 * Everything is the board's content, unwired, and every figure on it exists
 * in the dashboard aggregate: the six cards are kpis.recurringCommitted /
 * recurringAchieved / pipelineValue / newSalesCount / followUpsTotal /
 * followUpsDue, their deltas are the same fields resolved over the previous
 * period, and the trend is monthsInRange over the last six.
 */
const ChevronLeft = ICONS['chevron-left'];
const ChevronDown = ICONS['chevron-down'];
const ChevronRight = ICONS['chevron-right'];

const DESIGN_TOP = 52;

/** Left and right page margins. The board's content runs 23 → 352 of 376. */
const PAD_L = 23;
const PAD_R = 24;

const GLYPH = { size: 22, color: '#17a45e' } as const;

/**
 * The six cards, in the board's reading order: two columns, three rows.
 *
 * `tone` is the DIRECTION the metric wants to move, not the sign of its
 * delta. Due This Week rises 75% and the design paints it red, because more
 * work falling due this week is not an achievement.
 */
const KPIS = [
  { value: '₹ 17.5L', label: 'Committed Value', delta: '+8%', since: 'vs. last month', icon: <TargetGlyph {...GLYPH} /> },
  { value: '₹ 12.5L', label: 'Achieved Value', delta: '+12%', since: 'vs. last month', icon: <RisingBarsGlyph {...GLYPH} /> },
  { value: '₹ 28.4L', label: 'Pipeline Value', delta: '+18%', since: 'vs. last month', icon: <StackGlyph {...GLYPH} /> },
  { value: '18', label: 'New Sales', delta: '+50%', since: 'vs. last month', icon: <PersonPlusGlyph {...GLYPH} /> },
  { value: '24', label: 'Follow-ups', delta: '+14%', since: 'vs. last month', icon: <CalendarSolidGlyph {...GLYPH} /> },
  { value: '7', label: 'Due This Week', delta: '+75%', since: 'vs. last week', tone: 'bad' as const, icon: <ClockGlyph {...GLYPH} /> },
];

/**
 * The trend, in lakhs against a 24L axis - the units the board's own labels
 * name. Heights are not passed; TrendChart derives them from these.
 */
const TREND = {
  labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  values: [5.3, 8.4, 11.6, 15.3, 19, 23.8],
  max: 24,
};

/** Board y of the chart block's top, and every offset inside it. */
const CHART_TOP = 532;
const AXIS = [
  { label: '24L', y: 532 },
  { label: '16L', y: 572 },
  { label: '8L', y: 612 },
  { label: '0', y: 651 },
];
/** Month label boxes: 39 wide, centred on their bar. */
const XL_X = [53, 102, 152, 201, 251, 300];

export default function SalesBreakdown() {
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
              style={{ position: 'absolute', left: PAD_L }}
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
              resolved on read - never a stored range (AGENTS.md). The pill is
              muted here where 02A.1 paints it brand; that is the board's. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            className="flex-row items-center bg-surface"
            style={{
              marginTop: 13, marginLeft: PAD_L, marginRight: PAD_R,
              height: 47, borderRadius: 13, borderWidth: 1, borderColor: '#e2ecf0',
              paddingLeft: 18, paddingRight: 22,
            }}
          >
            <Calendar20Glyph />
            <Text
              className="text-ink"
              style={{
                fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 19,
                marginLeft: 9, flex: 1,
              }}
            >
              This Month (Sep 2026)
            </Text>
            <ChevronDown size={14} color="#6b8796" strokeWidth={1.7} />
          </Pressable>

          <Text
            className="text-ink"
            style={{
              marginTop: 15, marginLeft: PAD_L,
              fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21,
            }}
          >
            Key Metrics
          </Text>

          {/* Two columns of 157 with a 15 gutter, three rows 10 apart. */}
          <View style={{ marginTop: 8, marginLeft: PAD_L, marginRight: PAD_R }}>
            {[0, 2, 4].map((row) => (
              <View key={row} className="flex-row" style={{ marginTop: row === 0 ? 0 : 10 }}>
                {[KPIS[row], KPIS[row + 1]].map((k, i) => (
                  <View key={k.label} style={{ flex: 1, marginLeft: i === 0 ? 0 : 15 }}>
                    <KpiCard
                      icon={k.icon}
                      value={k.value}
                      label={k.label}
                      delta={k.delta}
                      since={k.since}
                      tone={k.tone}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Section head, with "View Details" trailing it on the same line. */}
          <View style={{ marginTop: 23, height: 21, justifyContent: 'center' }}>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: PAD_L,
                fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21,
              }}
            >
              Progress Trend
            </Text>
            {/* 02A.4, the insights over these same figures. No board on the
                page carries a prototype interaction, so this link is
                inferred - see the note at the top of sales-insights.tsx. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/sales-insights')}
              hitSlop={10}
              className="flex-row items-center"
              style={{ position: 'absolute', right: 25 }}
            >
              <Text
                className="text-brand"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16 }}
              >
                View Details
              </Text>
              <ChevronRight size={13} color="#0e7a4a" strokeWidth={1.7} />
            </Pressable>
          </View>

          {/* Legend. Two series, so it is always present - the swatch is a
              disc for the bars and a 2.4 rule for the target, which is how
              each is actually drawn. */}
          <View style={{ marginTop: 5, height: 13 }}>
            <View
              style={{
                position: 'absolute', left: PAD_L, top: 4,
                width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#17a45e',
              }}
            />
            <Text
              style={{
                position: 'absolute', left: 37,
                fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 13, color: '#123e52',
              }}
            >
              Achieved
            </Text>
            <View style={{ position: 'absolute', left: 104, top: 7 }}>
              <Svg width={21} height={3}>
                <Line x1={1.3} y1={1.5} x2={19.7} y2={1.5} stroke="#7fd3a8" strokeWidth={2.4} strokeLinecap="round" />
              </Svg>
            </View>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 130,
                fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 13,
              }}
            >
              Target
            </Text>
          </View>

          {/*
            The plot and its two axes, as one block 143 tall. Offsets are the
            board's y minus CHART_TOP, so each "8L" lands on the gridline it
            names however the block moves.
          */}
          <View style={{ marginTop: 12, height: 143 }}>
            {AXIS.map((a) => (
              <Text
                key={a.label}
                className="text-ink"
                style={{
                  position: 'absolute', left: 20, width: 29, top: a.y - CHART_TOP,
                  textAlign: 'right',
                  fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, lineHeight: 12,
                }}
              >
                {a.label}
              </Text>
            ))}

            <View style={{ position: 'absolute', left: 54, right: PAD_R, top: 539 - CHART_TOP }}>
              <TrendChart
                labels={TREND.labels}
                values={TREND.values}
                max={TREND.max}
                unit="lakh"
              />
            </View>

            {/* Month labels: the board centres each 39-wide box on its bar,
                and the bars are a percentage of the plot, so these are too. */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: 663 - CHART_TOP }}>
              {XL_X.map((x, i) => (
                <Text
                  key={TREND.labels[i]}
                  className="text-ink"
                  style={{
                    position: 'absolute', left: `${(x / 376) * 100}%`, width: 39,
                    textAlign: 'center',
                    fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, lineHeight: 12,
                  }}
                >
                  {TREND.labels[i]}
                </Text>
              ))}
            </View>
          </View>

          {/* What the numbers above add up to, in a sentence. */}
          <View
            style={{
              marginTop: 20, marginLeft: PAD_L, marginRight: PAD_R,
              height: 83, borderRadius: 13, backgroundColor: '#eff8f3',
            }}
          >
            <View style={{ position: 'absolute', left: 18, top: 17 }}>
              <BoltGlyph />
            </View>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: 47, right: 16, top: 14,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, lineHeight: 16,
              }}
            >
              Recent Activity Impact
            </Text>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 47, top: 31, width: 263,
                fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 14.5,
              }}
            >
              Your follow-ups have increased by 14%, resulting in a 12% higher achievement this month.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
