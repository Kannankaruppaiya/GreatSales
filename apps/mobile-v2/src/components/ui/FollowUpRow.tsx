import { View, Text, Pressable } from 'react-native';
import { SolidPhone, SolidPin } from '../../design-system/solid-icons';

/**
 * One row of "Upcoming Follow-ups", from Screen 01D.
 *
 *   card     339×52 radius 13, white, 1px #eaf0f3
 *   dot      7 across at x28, in the tone's colour
 *   time     11/600 in the dot's colour, in a 76-wide column -
 *            which is what puts the avatar 97 from the card's left edge
 *   avatar   34×34 radius 9, the tone's soft fill, initials 12/800 in its dark
 *   title    13/700 #0f3244
 *   subtitle 11/400 #6b8796
 *   action   18 glyph at the right
 *
 * The three tones carry meaning, not decoration: the design paints the row due
 * in two hours red, the one due later amber, and tomorrow's green. They are
 * the same three the rest of the app uses for overdue, due and upcoming.
 */
export type RowTone = 'overdue' | 'due' | 'upcoming';

const TONES: Record<RowTone, { dot: string; soft: string; dark: string }> = {
  overdue: { dot: '#e5484d', soft: '#fbe9ea', dark: '#c7343a' },
  due: { dot: '#f0a32b', soft: '#fdf3e4', dark: '#b77a18' },
  upcoming: { dot: '#17a45e', soft: '#e9f6ef', dark: '#0e7a4a' },
};

export function FollowUpRow({
  tone, time, initials, title, subtitle, action = 'call', onPress,
}: {
  tone: RowTone;
  time: string;
  initials: string;
  title: string;
  subtitle: string;
  action?: 'call' | 'visit';
  onPress?: () => void;
}) {
  const t = TONES[tone];
  const Action = action === 'call' ? SolidPhone : SolidPin;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center bg-surface"
      style={{ height: 52, borderRadius: 13, borderWidth: 1, borderColor: '#eaf0f3', paddingHorizontal: 10 }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.dot }} />
      <Text
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, lineHeight: 15, color: t.dot, marginLeft: 4, width: 76 }}
      >
        {time}
      </Text>

      <View
        className="items-center justify-center"
        style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: t.soft }}
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, lineHeight: 16, color: t.dark }}>
          {initials}
        </Text>
      </View>

      <View style={{ flex: 1, marginLeft: 7 }}>
        <Text
          className="text-ink"
          numberOfLines={1}
          style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 17 }}
        >
          {title}
        </Text>
        <Text
          className="text-muted"
          numberOfLines={1}
          style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 15, marginTop: 1 }}
        >
          {subtitle}
        </Text>
      </View>

      <Action size={18} color="#17a45e" />
    </Pressable>
  );
}
