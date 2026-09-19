import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { TabBar } from '../../src/components/ui/TabBar';
import { ICONS } from '../../src/design-system/icons';
import {
  TargetGlyph, TrendUpGlyph, GroupGlyph, CalendarSolidGlyph, DocumentGlyph,
  Calendar20Glyph, BannerRidges,
} from '../../src/components/illustrations/glyphs';

/**
 * Screen 02A.4 Insights. Spec: design/screens/02a-4-insights.json.
 *
 * What the period's numbers MEAN, and what to do next about them: a verdict
 * banner, three readings, and three actions each of which is one tap from
 * the work it names.
 *
 * Excluded: the mockup's status bar, and `bg`'s 31px radius - the phone
 * frame.
 *
 * No board on page `mobiles` carries a prototype interaction, so nothing in
 * the file says where this screen is reached from. It is put behind 02A.3's
 * "View Details" because it is the only 02A board left unreached and it
 * repeats 02A.3's title and period pill exactly, which is what a continuation
 * of that screen would do. If the design later says otherwise, that one
 * onPress is the whole change.
 *
 * Content is the board's, unwired. The banner is kpis.totalPct against its
 * own target; the three insights are achieved-vs-previous, pipelineValue and
 * followUpsDue, which is to say the same aggregate 02A.3 reads - this screen
 * states it in sentences rather than in figures, so it must not be allowed to
 * drift from it by being fed separately.
 */
const ChevronLeft = ICONS['chevron-left'];
const ChevronDown = ICONS['chevron-down'];
const ChevronRight = ICONS['chevron-right'];

const DESIGN_TOP = 52;
const PAD_L = 23;
const PAD_R = 24;

const INSIGHTS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Strong Growth',
    body: 'Your achieved value is 12% higher than last month.',
    icon: <TrendUpGlyph size={23} />,
  },
  {
    title: 'More Opportunities',
    body: 'You have 28.4L in pipeline. Focus on high probability deals.',
    icon: <GroupGlyph size={23} />,
  },
  {
    title: 'Stay on Schedule',
    body: 'You have 7 follow-ups due this week. Keep the momentum.',
    icon: <CalendarSolidGlyph size={23} />,
  },
];

const ACTIONS: { label: string; icon: ReactNode }[] = [
  { label: 'Follow up on 7 pending opportunities', icon: <CalendarSolidGlyph size={21} color="#0e7a4a" /> },
  { label: 'Focus on 5 high-value pipeline deals', icon: <TargetGlyph size={21} color="#0e7a4a" /> },
  { label: 'Convert 3 proposals to orders', icon: <DocumentGlyph size={21} color="#0e7a4a" /> },
];

/** "Insights" / "Next Best Actions" and their trailing "View All". */
function SectionHead({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <View style={{ height: 21, justifyContent: 'center' }}>
      <Text
        className="text-ink"
        style={{
          position: 'absolute', left: PAD_L,
          fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21,
        }}
      >
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View all ${title.toLowerCase()}`}
        onPress={onViewAll}
        hitSlop={10}
        className="flex-row items-center"
        style={{ position: 'absolute', right: 25 }}
      >
        <Text
          className="text-brand"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16 }}
        >
          View All
        </Text>
        <ChevronRight size={13} color="#0e7a4a" strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}

export default function SalesInsights() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <SafeAreaView edges={['top']} className="flex-1">
        {/* The bar is 53 tall and the action stands 17 above it, so the last
            card has to clear 90 rather than 53 or it sits under the plus. */}
        <ScrollView contentContainerStyle={{ paddingBottom: 90 + insets.bottom }} showsVerticalScrollIndicator={false}>
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

          {/* The verdict. Its ridges are clipped by the card's own 16 radius,
              which is why overflow is hidden rather than the ridges drawn to
              fit - they stretch with the card. */}
          <View
            className="overflow-hidden"
            style={{
              marginTop: 15, marginLeft: PAD_L, marginRight: PAD_R,
              height: 91, borderRadius: 16, backgroundColor: '#eaf6f0',
            }}
          >
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <BannerRidges width="100%" height={36} />
            </View>

            <View
              style={{
                position: 'absolute', left: 18, top: 21,
                width: 39, height: 39, borderRadius: 19.5, backgroundColor: '#ffffff',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <TargetGlyph size={23} />
            </View>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: 68, top: 16,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20,
              }}
            >
              You are on track!
            </Text>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 68, top: 37, width: 218,
                fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16,
              }}
            >
              Keep going! You&apos;re 72% towards your monthly target.
            </Text>
            <View style={{ position: 'absolute', left: 289, top: 18 }}>
              <TrendUpGlyph size={23} />
            </View>
          </View>

          <View style={{ marginTop: 21 }}>
            <SectionHead title="Insights" />
          </View>

          {INSIGHTS.map((it, i) => (
            <View
              key={it.title}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`${it.title}. ${it.body}`}
              style={{
                marginTop: i === 0 ? 5 : 10, marginLeft: PAD_L, marginRight: PAD_R,
                height: 68, borderRadius: 13, backgroundColor: '#f2f9f5',
              }}
            >
              <View style={{ position: 'absolute', left: 18, top: 21 }}>{it.icon}</View>
              <Text
                className="text-ink"
                style={{
                  position: 'absolute', left: 52, right: 16, top: 12,
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 17,
                }}
              >
                {it.title}
              </Text>
              <Text
                className="text-muted"
                style={{
                  position: 'absolute', left: 52, top: 30, width: 263,
                  fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 14.5,
                }}
              >
                {it.body}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: 20 }}>
            <SectionHead title="Next Best Actions" />
          </View>

          {ACTIONS.map((a, i) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              style={{
                marginTop: i === 0 ? 5 : 11, marginLeft: PAD_L, marginRight: PAD_R,
                height: 49, borderRadius: 13, backgroundColor: '#ffffff',
                borderWidth: 1, borderColor: '#e6eef2',
              }}
            >
              <View style={{ position: 'absolute', left: 18, top: 14 }}>{a.icon}</View>
              <Text
                style={{
                  position: 'absolute', left: 50, right: 34, top: 16,
                  fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 16, color: '#123e52',
                }}
              >
                {a.label}
              </Text>
              <View style={{ position: 'absolute', right: 19, top: 18 }}>
                <ChevronRight size={13} color="#9fb4bf" strokeWidth={1.7} />
              </View>
            </Pressable>
          ))}
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
