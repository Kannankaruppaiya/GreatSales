import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusPill } from '../../src/components/ui/StatusPill';
import { CalendarSolidGlyph } from '../../src/components/illustrations/glyphs';
import {
  ChevronLeftStroke, ChevronRightStroke, ChevronDownStroke, EllipsisVertical,
  StoreOutline, PhoneOutline, CheckCircleOutline, MonitorOutline, AlertTriangleMini,
} from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02B.5 Opportunity Detail. Spec: design/screens/02b-5-detail.json.
 *
 * One opportunity: what it is worth, where it has got to, what has to happen
 * next, and who it is with.
 *
 * Excluded: the mockup's status bar; the background is the board's #f8fbfc.
 *
 * Three tabs across the middle - Details, Activity, Notes (3) - and only
 * Details is drawn. The other two are boards 03E.2 and 03C.2; they switch
 * what is BELOW the rule, so the tab strip is state here and the three
 * panels arrive as this screen grows rather than as three routes.
 *
 * The stage is a SELECT, not a label. Changing it is the one write this
 * screen makes, and it is the one the API guards hardest - the leads service
 * scopes by owner and stamps stageUpdatedAt, which is what the dashboard's
 * achieved half is measured on (AGENTS.md). So this control posts the change
 * and re-reads; it must never write the new stage into local state and
 * assume.
 *
 * Content is the board's, unwired. The screen takes an opportunity id and
 * reads GET /leads/:id - which is one of the endpoints added for exactly
 * this - rather than being handed a row from the list it was opened from: a
 * list row is a summary, and a detail screen built from one is a detail
 * screen that silently shows stale values after somebody else edits.
 */
const PAD_L = 18;
const PAD_R = 19;
const DESIGN_TOP = 49;

const TABS = [
  { key: 'details', label: 'Details', x: 23, w: 94 },
  { key: 'activity', label: 'Activity', x: 137, w: 94 },
  { key: 'notes', label: 'Notes (3)', x: 254, w: 103 },
] as const;

export default function OpportunityDetail() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('details');
  const pct = (x: number) => `${(x / 376) * 100}%` as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
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
              Opportunity Details
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={10}
              style={{ position: 'absolute', right: PAD_R }}
            >
              <EllipsisVertical />
            </Pressable>
          </View>

          {/* The summary: what it is, then three figures, then the stage. */}
          <View
            style={{
              marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R,
              height: 252, borderRadius: 18,
              backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
            }}
          >
            <View
              style={{
                position: 'absolute', left: 13, top: 21,
                width: 44, height: 44, borderRadius: 12, backgroundColor: '#e8f6ee',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <StoreOutline />
            </View>
            <Text
              className="text-ink"
              numberOfLines={1}
              style={{
                position: 'absolute', left: 73, right: 14, top: 18,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 23,
              }}
            >
              New Outlet Expansion
            </Text>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 73, right: 14, top: 41,
                fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
              }}
            >
              TrendMart
            </Text>
            <View style={{ position: 'absolute', left: 73, top: 61 }}>
              <StatusPill
                label="Action Required"
                color="#c77a0a"
                background="#fcf2e0"
                icon={<AlertTriangleMini />}
              />
            </View>

            <View style={{ position: 'absolute', left: 13, right: 13, top: 104, height: 1, backgroundColor: '#eef4f7' }} />

            {/* Three figures across the card: left, centred, right. The
                board aligns each to its own edge, which is what keeps the
                dates from crowding the middle column. */}
            <Stat x={13} w={107} align="left" value="₹ 5.0L" label="Expected Value" />
            <Stat x={112} w={104} align="center" value="Medium" label="Probability" />
            <Stat x={213} w={113} align="right" value="30 Sep 2025" label="Expected Close" />

            <View style={{ position: 'absolute', left: 13, right: 13, top: 174, height: 1, backgroundColor: '#eef4f7' }} />

            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 13, top: 200,
                fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 19,
              }}
            >
              Stage
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stage: Proposal Sent. Change stage"
              style={{
                position: 'absolute', left: 106, right: 13, top: 190,
                height: 36, borderRadius: 10,
                backgroundColor: '#fbfdfe', borderWidth: 1, borderColor: '#e6eff3',
              }}
            >
              <Text
                className="text-ink"
                style={{
                  position: 'absolute', left: 13, top: 10,
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 19,
                }}
              >
                Proposal Sent
              </Text>
              <View style={{ position: 'absolute', right: 6, top: 9 }}>
                <ChevronDownStroke />
              </View>
            </Pressable>
          </View>

          {/* Three tabs and the rule they sit on. The underline is 88 wide
              under a 94-wide label - the board insets it by 3 either side. */}
          <View style={{ marginTop: 17, height: 31 }}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTab(t.key)}
                  hitSlop={8}
                  style={{ position: 'absolute', left: pct(t.x), width: t.w }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontFamily: on ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                      fontSize: 14, lineHeight: 20,
                      color: on ? '#17a45e' : '#6b8796',
                    }}
                  >
                    {t.label}
                  </Text>
                  {on ? (
                    <View
                      style={{
                        position: 'absolute', left: 3, top: 28,
                        width: t.w - 6, height: 3, borderRadius: 2, backgroundColor: '#17a45e',
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            <View
              style={{
                position: 'absolute', left: PAD_L, right: PAD_R, top: 30,
                height: 1, backgroundColor: '#e6eff3',
              }}
            />
          </View>

          {/* The one thing overdue, in its own red card. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next action: Follow up with client, overdue by 3 days"
            style={{
              marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R,
              height: 81, borderRadius: 16,
              backgroundColor: '#fef4f4', borderWidth: 1, borderColor: '#f8dcdc',
            }}
          >
            <Text
              style={{
                position: 'absolute', left: 15, top: 11,
                fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, lineHeight: 17, color: '#c22b30',
              }}
            >
              Next Action
            </Text>
            <View style={{ position: 'absolute', left: 15, top: 33 }}>
              <CalendarSolidGlyph size={25} color="#e5484d" />
            </View>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: 51, right: 40, top: 30,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
              }}
            >
              Follow up with client
            </Text>
            <Text
              style={{
                position: 'absolute', left: 51, right: 40, top: 50,
                fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 17, color: '#e5484d',
              }}
            >
              Overdue by 3 days
            </Text>
            <View style={{ position: 'absolute', right: 6, top: 34 }}>
              <ChevronRightStroke size={16} />
            </View>
          </Pressable>

          <Text
            className="text-ink"
            style={{
              marginTop: 18, marginLeft: PAD_L,
              fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
            }}
          >
            Description
          </Text>
          {/* Two separate runs on the board, not one wrapped paragraph: the
              gap between them is 20 where a wrapped line would be 18. */}
          <Text
            className="text-muted"
            style={{
              marginTop: 3, marginLeft: PAD_L, marginRight: PAD_R,
              fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 18,
            }}
          >
            Client is interested in opening 2 new outlets.
          </Text>
          <Text
            className="text-muted"
            style={{
              marginTop: 2, marginLeft: PAD_L, marginRight: PAD_R,
              fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 18,
            }}
          >
            Waiting for final confirmation after proposal.
          </Text>

          <Text
            className="text-ink"
            style={{
              marginTop: 25, marginLeft: PAD_L,
              fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
            }}
          >
            Customer
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="TrendMart, Ravi Kumar, +91 98765 43210"
            style={{
              marginTop: 6, marginLeft: PAD_L, marginRight: PAD_R,
              height: 83, borderRadius: 16,
              backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
            }}
          >
            <View
              style={{
                position: 'absolute', left: 13, top: 19,
                width: 44, height: 44, borderRadius: 12, backgroundColor: '#e8f6ee',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <StoreOutline />
            </View>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: 70, right: 40, top: 17,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
              }}
            >
              TrendMart
            </Text>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 70, right: 40, top: 36,
                fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
              }}
            >
              Ravi Kumar
            </Text>
            <View style={{ position: 'absolute', left: 70, top: 55 }}>
              <PhoneOutline size={14} />
            </View>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 90, top: 54,
                fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 17,
              }}
            >
              +91 98765 43210
            </Text>
            <View style={{ position: 'absolute', right: 6, top: 34 }}>
              <ChevronRightStroke size={16} />
            </View>
          </Pressable>

          <View style={{ marginTop: 21, marginLeft: PAD_L, marginRight: PAD_R, height: 1, backgroundColor: '#e6eff3' }} />

          <View className="flex-row" style={{ marginTop: 22, marginLeft: PAD_L, marginRight: PAD_R }}>
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-center"
              style={{ flex: 1, height: 55, borderRadius: 14, backgroundColor: '#17a45e' }}
            >
              <CheckCircleOutline />
              <Text
                className="text-white"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20, marginLeft: 6 }}
              >
                Log Activity
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-center"
              style={{
                flex: 1, height: 55, borderRadius: 14, marginLeft: 11,
                backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#17a45e',
              }}
            >
              <MonitorOutline size={20} color="#17a45e" />
              <Text
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 19, marginLeft: 6, color: '#0e7a4a' }}
              >
                View in Pipeline
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One of the summary card's three figures. */
function Stat({
  x, w, align, value, label,
}: {
  x: number; w: number; align: 'left' | 'center' | 'right'; value: string; label: string;
}) {
  return (
    <View style={{ position: 'absolute', left: x, width: w, top: 122 }}>
      <Text
        className="text-ink"
        numberOfLines={1}
        style={{ textAlign: align, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 23 }}
      >
        {value}
      </Text>
      <Text
        className="text-muted"
        style={{ textAlign: align, marginTop: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 14 }}
      >
        {label}
      </Text>
    </View>
  );
}
