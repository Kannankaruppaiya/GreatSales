import { View, Text, Pressable } from 'react-native';
import { ChevronRightStroke } from '../illustrations/outline-glyphs';

/**
 * One row of a 02B/02C customer list: 339x78, radius 16, white on #e6eff3.
 *
 *   avatar   39 disc on #e8f6ee, initials 12/800 #0e7a4a, at (13, 14)
 *   name     14/700 at (62, 13), with an age pill beside it
 *   amount   14/800, right-aligned to the card's 322
 *   owner    12/500 #6b8796 at (62, 33)
 *   rule     231x1 #eef4f7 at (62, 53)
 *   note     12/500 #8aa3b0 at (62, 59)
 *
 * The age pill FOLLOWS the name rather than sitting at a fixed x. The board
 * hand-places it per card - 190, 168, 219, 168, 176 - which is the name's own
 * width plus a gap, and every one of those numbers is wrong the moment a real
 * customer is called something else. So the row is a flow and the spec marks
 * the pill's x as not-compared.
 *
 * `age` is the number of days overdue and is always red here; this component
 * is used by lists that are, by definition, late. A list of things that are
 * NOT late needs a tone, and can grow one then rather than now.
 */
export function CustomerRowCard({
  initials, name, age, amount, owner, note, onPress,
}: {
  initials: string;
  name: string;
  age: string;
  amount: string;
  owner: string;
  note: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${age} overdue, ${amount}. ${owner}. ${note}`}
      onPress={onPress}
      style={{
        height: 78, borderRadius: 16,
        backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
      }}
    >
      <View
        style={{
          position: 'absolute', left: 13, top: 14,
          width: 39, height: 39, borderRadius: 19.5, backgroundColor: '#e8f6ee',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, lineHeight: 17, color: '#0e7a4a' }}>
          {initials}
        </Text>
      </View>

      <View className="flex-row items-center" style={{ position: 'absolute', left: 62, right: 105, top: 13 }}>
        <Text
          className="text-ink"
          numberOfLines={1}
          style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 20, flexShrink: 1 }}
        >
          {name}
        </Text>
        <View
          className="items-center justify-center"
          style={{ height: 18, borderRadius: 9, backgroundColor: '#fdeded', paddingHorizontal: 10, marginLeft: 8 }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, lineHeight: 14, color: '#e5484d' }}>
            {age}
          </Text>
        </View>
      </View>

      <Text
        className="text-ink"
        style={{
          position: 'absolute', right: 17, width: 83, top: 13, textAlign: 'right',
          fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, lineHeight: 20,
        }}
      >
        {amount}
      </Text>

      <Text
        className="text-muted"
        numberOfLines={1}
        style={{
          position: 'absolute', left: 62, right: 105, top: 33,
          fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17,
        }}
      >
        {owner}
      </Text>

      <View style={{ position: 'absolute', right: 9, top: 24 }}>
        <ChevronRightStroke size={14} />
      </View>

      <View style={{ position: 'absolute', left: 62, top: 53, width: 231, height: 1, backgroundColor: '#eef4f7' }} />

      <Text
        numberOfLines={1}
        style={{
          position: 'absolute', left: 62, right: 24, top: 59,
          fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 17, color: '#8aa3b0',
        }}
      >
        {note}
      </Text>
    </Pressable>
  );
}
