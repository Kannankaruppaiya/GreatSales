import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ListSearchBar } from '../../src/components/ui/ListSearchBar';
import { StatusPill } from '../../src/components/ui/StatusPill';
import {
  ChevronLeftStroke, ChevronRightStroke, StoreOutline, BarsSolid23,
  AlertTriangleMini, InfoCircleMini,
} from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02B.4 Opportunities. Spec: design/screens/02b-4-opportunities.json.
 *
 * The list behind 02B.1's third row: open opportunities that need something
 * doing to them, with what that something is on the last line.
 *
 * Excluded: the mockup's status bar; the background is the board's #f8fbfc.
 *
 * Unlike 02B.2 and 02B.3 the rows are NOT separate cards. The board draws one
 * 631-tall card with hairlines between the rows, and it has no tab bar - so
 * this screen is pushed onto the stack rather than being a tab destination,
 * and that is why it keeps its back chevron and they keep the bar.
 *
 * Rows are the board's, unwired. They are leads whose stage is open and whose
 * nextAction is set, ordered by value; the pill is the nextAction's kind and
 * the last line is its text. Amounts are the lead's value, NOT a weighted or
 * probability-adjusted figure - this is a worklist, and discounting the
 * number a salesperson is chasing by a confidence factor makes it unusable
 * for the thing it is for.
 */
const PAD_L = 18;
const PAD_R = 19;
const DESIGN_TOP = 49;

/** The board's three statuses, with the colours it paints them. */
const STATUS = {
  action: { label: 'Action Required', color: '#c77a0a', background: '#fcf2e0', icon: <AlertTriangleMini /> },
  pending: { label: 'Decision Pending', color: '#2e76d6', background: '#eaf2fc', icon: <InfoCircleMini /> },
  follow: { label: 'Follow Up', color: '#0e7a4a', background: '#e8f6ee', icon: undefined },
} as const;

type Row = {
  title: string; amount: string; customer: string; note: string;
  status: keyof typeof STATUS; icon: ReactNode;
};

const ROWS: Row[] = [
  { title: 'New Outlet Expansion', amount: '₹ 5.0L', customer: 'TrendMart', status: 'action', note: 'Share updated proposal', icon: <StoreOutline /> },
  { title: 'Product Upgrade', amount: '₹ 2.8L', customer: 'Value Plus', status: 'pending', note: 'Client reviewing the proposal', icon: <BarsSolid23 color="#0e7a4a" /> },
  { title: 'Annual Supply Contract', amount: '₹ 12.5L', customer: 'Greenfield Traders', status: 'follow', note: 'Need to schedule a meeting', icon: <BarsSolid23 color="#0e7a4a" /> },
  { title: 'New Product Line', amount: '₹ 3.6L', customer: 'Urban Needs', status: 'action', note: 'Share product details', icon: <StoreOutline /> },
  { title: 'Territory Expansion', amount: '₹ 7.2L', customer: 'City Mart', status: 'follow', note: 'Client interested, awaiting confirmation', icon: <BarsSolid23 color="#0e7a4a" /> },
];

/** Row pitch inside the card, and where the rule falls in it. */
const PITCH = 126;
const RULE_AT = 100;

export default function OpportunitiesAttention() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const [query, setQuery] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fbfc' }}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
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
              Opportunities
            </Text>
          </View>

          <View style={{ marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R }}>
            <ListSearchBar
              placeholder="Search opportunities..."
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {/* One card, five rows, hairlines between - not five cards. */}
          <View
            style={{
              marginTop: 18, marginLeft: PAD_L, marginRight: PAD_R,
              borderRadius: 18, backgroundColor: '#ffffff',
              borderWidth: 1, borderColor: '#e6eff3',
              paddingTop: 26, paddingBottom: 20,
            }}
          >
            {ROWS.map((r, i) => {
              const s = STATUS[r.status];
              return (
                <Pressable
                  key={r.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title}, ${r.customer}, ${r.amount}. ${s.label}. ${r.note}`}
                  onPress={() => router.push('/(app)/opportunity-detail')}
                  style={{ height: i === ROWS.length - 1 ? PITCH - 26 : PITCH }}
                >
                  <View
                    style={{
                      position: 'absolute', left: 13, top: 0,
                      width: 44, height: 44, borderRadius: 12, backgroundColor: '#e8f6ee',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {r.icon}
                  </View>

                  <Text
                    className="text-ink"
                    numberOfLines={1}
                    style={{
                      position: 'absolute', left: 70, right: 110, top: -3,
                      fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
                    }}
                  >
                    {r.title}
                  </Text>
                  <Text
                    className="text-ink"
                    style={{
                      position: 'absolute', right: 17, width: 86, top: -3, textAlign: 'right',
                      fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, lineHeight: 20,
                    }}
                  >
                    {r.amount}
                  </Text>
                  <Text
                    className="text-muted"
                    numberOfLines={1}
                    style={{
                      position: 'absolute', left: 70, right: 110, top: 17,
                      fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
                    }}
                  >
                    {r.customer}
                  </Text>

                  <View style={{ position: 'absolute', left: 70, top: 38 }}>
                    <StatusPill label={s.label} color={s.color} background={s.background} icon={s.icon} />
                  </View>

                  <Text
                    numberOfLines={1}
                    style={{
                      position: 'absolute', left: 70, right: 24, top: 64,
                      fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17, color: '#8aa3b0',
                    }}
                  >
                    {r.note}
                  </Text>

                  <View style={{ position: 'absolute', right: 11, top: 30 }}>
                    <ChevronRightStroke size={16} />
                  </View>

                  {i < ROWS.length - 1 ? (
                    <View
                      style={{
                        position: 'absolute', left: 13, right: 13, top: RULE_AT,
                        height: 1, backgroundColor: '#eef4f7',
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
