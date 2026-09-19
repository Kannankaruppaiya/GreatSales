import { View, Text } from 'react-native';
import type { ReactNode } from 'react';
import { ArrowUpRightGlyph } from '../illustrations/glyphs';

/**
 * A metric with its change against the previous period, from 02A.3.
 *
 * The card is a fixed 86 tall and its six pieces are placed at the board's own
 * offsets inside it, absolutely:
 *
 *   glyph  22×22 at (16, 14)     value  16/800 #0f3244 at (44, 12)
 *   arrow  13×13 at (14, 58)     label  10/400 #6b8796 at (44, 32)
 *   delta  10/700 at (30, 57)    since  10/400 #6b8796 at (62, 57)
 *
 * Absolute rather than a flow, because the arrow starts 2pt LEFT of the
 * glyph's own inset and the value's box overlaps the glyph's - a column of
 * margins reproduces neither without a fudge factor per row.
 *
 * The delta's colour is the DIRECTION's, not the metric's: the design paints
 * "+75% vs. last week" on Due This Week in #e5484d while every other +n% is
 * #0e7a4a, because more work falling due is not an improvement. So the caller
 * says which way is good rather than the component assuming a rising number
 * is, and the arrow takes the same colour with no default to forget.
 *
 * Width is the caller's: two of these sit in a row with 15 between them, and
 * on a screen wider than the board's 376 they should share the extra rather
 * than leave it at the margin.
 */
export function KpiCard({
  icon, value, label, delta, since, tone = 'good',
}: {
  icon: ReactNode;
  value: string;
  label: string;
  delta: string;
  /** The comparison the delta is against, e.g. "vs. last month". */
  since: string;
  tone?: 'good' | 'bad';
}) {
  const colour = tone === 'good' ? '#0e7a4a' : '#e5484d';
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}, ${delta} ${since}`}
      style={{ height: 86, borderRadius: 13, backgroundColor: '#eff8f3' }}
    >
      <View style={{ position: 'absolute', left: 16, top: 14 }}>{icon}</View>

      <Text
        className="text-ink"
        numberOfLines={1}
        style={{
          position: 'absolute', left: 44, right: 8, top: 12,
          fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21,
        }}
      >
        {value}
      </Text>
      <Text
        className="text-muted"
        numberOfLines={1}
        style={{
          position: 'absolute', left: 44, right: 8, top: 32,
          fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 13,
        }}
      >
        {label}
      </Text>

      <View style={{ position: 'absolute', left: 14, top: 58 }}>
        <ArrowUpRightGlyph color={colour} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          position: 'absolute', left: 30, top: 57,
          fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, lineHeight: 13, color: colour,
        }}
      >
        {delta}
      </Text>
      <Text
        className="text-muted"
        numberOfLines={1}
        style={{
          position: 'absolute', left: 62, right: 6, top: 57,
          fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 13,
        }}
      >
        {since}
      </Text>
    </View>
  );
}
