import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

/**
 * The 22-tall status pill on 02B.4's rows.
 *
 * The board draws three: "Action Required" amber on #fcf2e0, "Decision
 * Pending" blue on #eaf2fc, "Follow Up" green on #e8f6ee - and only the first
 * two carry a glyph. So the glyph is optional and its presence changes the
 * left inset, which is the board's: 7 before a glyph, 10 before a bare label.
 *
 * Widths are NOT the board's 135 / 142 / 81. Those are what those three
 * labels happen to measure; a fourth status, or the same three in another
 * language, would need three more numbers. The pill sizes to its content at
 * the board's insets instead, which puts the label where the board puts it -
 * and the label is what parity measures.
 */
export function StatusPill({
  label, color, background, icon,
}: {
  label: string;
  color: string;
  background: string;
  icon?: ReactNode;
}) {
  return (
    <View
      className="flex-row items-center self-start"
      style={{
        height: 22, borderRadius: 11, backgroundColor: background,
        paddingLeft: icon ? 7 : 10, paddingRight: 12,
      }}
    >
      {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, lineHeight: 16, color }}>
        {label}
      </Text>
    </View>
  );
}
