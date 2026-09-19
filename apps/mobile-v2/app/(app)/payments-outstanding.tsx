import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TabBar } from '../../src/components/ui/TabBar';
import { ListSearchBar } from '../../src/components/ui/ListSearchBar';
import { PaymentRowCard } from '../../src/components/ui/PaymentRowCard';
import { ChevronLeftStroke } from '../../src/components/illustrations/outline-glyphs';

/**
 * Screen 02B.3 Payment / Outstanding. Spec: design/screens/02b-3-payments.json.
 *
 * The list behind 02B.1's second row: invoices raised and not settled,
 * oldest first.
 *
 * Excluded: the mockup's status bar; the background is the board's #f8fbfc.
 *
 * Rows are the board's, unwired. The amount is the invoice total MINUS what
 * has been received, not the total - an invoice half paid is half
 * outstanding, and showing the raised figure here would overstate the book by
 * whatever has already come in. The payments repository writes a cumulative
 * received total for exactly that reason, so the subtraction is the one the
 * data is shaped for.
 *
 * Paging, as on 02B.2: five rows fit the board and a real ledger has
 * hundreds.
 */
const PAD_L = 19;
const PAD_R = 18;
const DESIGN_TOP = 49;

const ROWS = [
  { initials: 'AD', name: 'ABC Distributors', amount: '₹ 2.4L', invoice: 'INV-1034', age: '7d', status: 'Overdue' },
  { initials: 'MR', name: 'Metro Retail', amount: '₹ 1.8L', invoice: 'INV-9987', age: '12d', status: 'Overdue' },
  { initials: 'FM', name: 'FreshMart', amount: '₹ 95K', invoice: 'INV-9912', age: '15d', status: 'Overdue' },
  { initials: 'RS', name: 'RK Stores', amount: '₹ 3.2L', invoice: 'INV-9843', age: '18d', status: 'Overdue' },
  { initials: 'CS', name: 'City Super Market', amount: '₹ 1.1L', invoice: 'INV-9786', age: '25d', status: 'Overdue' },
];

/** The board's four gaps between cards: 8, 8, 9, 8. */
const GAPS = [0, 8, 8, 9, 8];

export default function PaymentsOutstanding() {
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
              Payment / Outstanding
            </Text>
          </View>

          <View style={{ marginTop: 25, marginLeft: PAD_L, marginRight: PAD_R }}>
            <ListSearchBar
              placeholder="Search customers or invoice..."
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {ROWS.map((r, i) => (
            <View key={r.invoice} style={{ marginTop: i === 0 ? 18 : GAPS[i], marginLeft: PAD_L, marginRight: PAD_R }}>
              <PaymentRowCard {...r} />
            </View>
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
