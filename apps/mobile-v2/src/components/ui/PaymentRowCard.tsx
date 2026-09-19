import { View, Text, Pressable } from 'react-native';
import { ChevronRightStroke } from '../illustrations/outline-glyphs';

/**
 * One row of 02B.3's outstanding list: 339x88, radius 16, white on #e6eff3.
 *
 * Ten pixels taller than CustomerRowCard and differently arranged, which is
 * why it is its own component rather than a mode on that one:
 *
 *   CustomerRowCard          PaymentRowCard
 *   78 tall                  88
 *   owner on line two        invoice number, with the age pill beside it
 *   note under the rule      a status pill under the rule
 *   pill beside the NAME     pill beside the INVOICE
 *
 *   avatar   39 disc on #e8f6ee, initials 12/800 #0e7a4a, at (13, 16)
 *   name     14/700 at (62, 13); amount 14/800 right-aligned to 322
 *   invoice  12/600 #6b8796 at (62, 35), age pill following it
 *   rule     231x1 #eef4f7 at (62, 56)
 *   status   66x21 pill at (62, 61), label 11/700
 *
 * The status pill's colours are the caller's. Every row on 02B.3 is overdue
 * and the board paints all five #c22b30 on #fdeded, but a list of payments
 * that are merely DUE is the same card in a different colour, and a component
 * that can only say "overdue" would be rewritten to add it.
 */
export function PaymentRowCard({
  initials, name, amount, invoice, age, status,
  statusColor = '#c22b30', statusBackground = '#fdeded',
  onPress,
}: {
  initials: string;
  name: string;
  amount: string;
  invoice: string;
  age: string;
  status: string;
  statusColor?: string;
  statusBackground?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${amount}. ${invoice}, ${age} ${status}`}
      onPress={onPress}
      style={{
        height: 88, borderRadius: 16,
        backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
      }}
    >
      <View
        style={{
          position: 'absolute', left: 13, top: 16,
          width: 39, height: 39, borderRadius: 19.5, backgroundColor: '#e8f6ee',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, lineHeight: 17, color: '#0e7a4a' }}>
          {initials}
        </Text>
      </View>

      <Text
        className="text-ink"
        numberOfLines={1}
        style={{
          position: 'absolute', left: 62, right: 105, top: 13,
          fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20,
        }}
      >
        {name}
      </Text>
      <Text
        className="text-ink"
        style={{
          position: 'absolute', right: 17, width: 83, top: 13, textAlign: 'right',
          fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, lineHeight: 20,
        }}
      >
        {amount}
      </Text>

      <View className="flex-row items-center" style={{ position: 'absolute', left: 62, right: 40, top: 33 }}>
        <Text
          className="text-muted"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 17, marginTop: 2 }}
        >
          {invoice}
        </Text>
        <View
          className="items-center justify-center"
          style={{ height: 18, borderRadius: 9, backgroundColor: '#fdeded', paddingHorizontal: 10, marginLeft: 6 }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, lineHeight: 14, color: '#e5484d' }}>
            {age}
          </Text>
        </View>
      </View>

      <View style={{ position: 'absolute', right: 8, top: 29 }}>
        <ChevronRightStroke size={14} />
      </View>

      <View style={{ position: 'absolute', left: 62, top: 56, width: 231, height: 1, backgroundColor: '#eef4f7' }} />

      <View
        className="items-center justify-center"
        style={{
          position: 'absolute', left: 62, top: 61,
          width: 66, height: 21, borderRadius: 10, backgroundColor: statusBackground,
        }}
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, lineHeight: 16, color: statusColor }}>
          {status}
        </Text>
      </View>
    </Pressable>
  );
}
