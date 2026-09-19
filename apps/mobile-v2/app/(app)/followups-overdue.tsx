import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TabBarTall } from '../../src/components/ui/TabBarTall';
import { ListSearchBar } from '../../src/components/ui/ListSearchBar';
import { CustomerRowCard } from '../../src/components/ui/CustomerRowCard';
import { ChevronLeftStroke } from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02B.2 Overdue Follow-ups. Spec: design/screens/02b-2-overdue.json.
 *
 * The list behind 02B.1's first row, and behind its red banner.
 *
 * Excluded: the mockup's status bar. As on 02B.1 there is no phone-frame
 * rect; the background is the board's own #f8fbfc.
 *
 * Rows are the board's, unwired. They are followups where dueDate is past and
 * the status is still open, ordered by how late they are; the pill is the age
 * in days, the amount is the linked opportunity's value, and the second line
 * is the follow-up's own note. All of that is one list request - the
 * followups repository already scopes to the signed-in salesperson - so the
 * screen does NOT fetch a customer per row.
 *
 * It will need paging. Five rows fit the board and a real territory has
 * hundreds; CursorPage from packages/shared is what the repository returns,
 * so the ScrollView here becomes a FlatList with onEndReached when the data
 * goes in, and that is a change to this file only.
 */
const PAD_L = 19;
const PAD_R = 18;
const DESIGN_TOP = 49;

const ROWS = [
  { initials: 'SR', name: 'Skyline Retail', age: '3d', amount: '₹ 1.2L', owner: 'Ravi Kumar', note: 'Follow-up on product demo' },
  { initials: 'MM', name: 'Modern Mart', age: '5d', amount: '₹ 85K', owner: 'Priya Sharma', note: 'Share updated quotation' },
  { initials: 'GT', name: 'Greenfield Traders', age: '7d', amount: '₹ 2.3L', owner: 'Arjun Nair', note: 'Check stock availability' },
  { initials: 'UN', name: 'Urban Needs', age: '10d', amount: '₹ 1.5L', owner: 'Karthik V', note: 'Follow-up after meeting' },
  { initials: 'VS', name: 'Value Stores', age: '12d', amount: '₹ 90K', owner: 'Sneha R', note: 'Confirm order decision' },
];

/** The board's four gaps between cards: 8, 8, 7, 8. */
const GAPS = [0, 8, 8, 7, 8];

export default function FollowUpsOverdue() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const [query, setQuery] = useState('');

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
              Overdue Follow-ups
            </Text>
          </View>

          <View style={{ marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R }}>
            <ListSearchBar
              placeholder="Search customers or notes..."
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {ROWS.map((r, i) => (
            <View key={r.name} style={{ marginTop: i === 0 ? 18 : GAPS[i], marginLeft: PAD_L, marginRight: PAD_R }}>
              <CustomerRowCard {...r} />
            </View>
          ))}
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
