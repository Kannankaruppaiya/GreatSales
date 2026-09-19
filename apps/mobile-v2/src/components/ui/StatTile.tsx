import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

/**
 * A value-over-label tile with a leading glyph, from Screen 02A.
 *
 *   tile   157×78 radius 13 on #eff8f3
 *   glyph  23, 15pt in and 17 down
 *   value  16/800 #0f3244, 47pt in and 14 down
 *   label  10/400 #6b8796, 3pt under the value
 *
 * The content is NOT vertically centred: it sits 14 from the top with 27
 * below. Centring it puts the value 7px low, which is what it did.
 *
 * Width is not fixed at 157: two of these plus the board's gutters make 376,
 * so the pair fills its row. The WIDTH comes from the wrapper the screen puts
 * it in; this sets only the height.
 *
 * There is deliberately no `flex: 1` here. A wrapper is a column by default,
 * and `flex: 1` inside a column claims the main axis - the height - which
 * silently beat the explicit 78 and rendered the tile at its content height of
 * 37. Three rows of that put everything below the grid 122px high.
 */
export function StatTile({
  icon, value, label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View
      className="flex-row items-start"
      style={{ height: 78, borderRadius: 13, backgroundColor: '#eff8f3', paddingHorizontal: 15, paddingTop: 14 }}
    >
      <View style={{ marginTop: 3 }}>{icon}</View>
      <View style={{ marginLeft: 9, flex: 1 }}>
        <Text
          className="text-ink"
          numberOfLines={1}
          style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21 }}
        >
          {value}
        </Text>
        <Text
          className="text-muted"
          numberOfLines={1}
          style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 13, marginTop: 3 }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
