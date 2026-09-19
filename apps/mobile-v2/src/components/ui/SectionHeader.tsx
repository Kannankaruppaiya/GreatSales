import { View, Text, Pressable } from 'react-native';
import { ICONS } from '../../design-system/icons';

const ChevronRight = ICONS['chevron-right'];

/**
 * A section title with an optional "View All", from Screen 01D.
 *
 *   title    16/800 #0f3244, 21 tall
 *   action   12/600 #0e7a4a, ending at 343, with an 8-wide chevron at 349
 *
 * The chevron is the one STROKED glyph on the home screen - 1.7px #0e7a4a -
 * which is why it comes from the Lucide map while everything else on that
 * screen comes from the solid one.
 */
export function SectionHeader({
  title,
  onViewAll,
  actionLabel = 'View All',
}: {
  title: string;
  onViewAll?: () => void;
  actionLabel?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className="text-ink"
        style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21 }}
      >
        {title}
      </Text>
      {onViewAll ? (
        <Pressable onPress={onViewAll} accessibilityRole="button" className="flex-row items-center" hitSlop={8}>
          <Text
            className="text-brand"
            style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, lineHeight: 16 }}
          >
            {actionLabel}
          </Text>
          {/* The design's chevron box is 8 wide though the glyph is 12; the
              box is what sets where the label's right edge lands. */}
          <View style={{ width: 8, alignItems: 'center', marginLeft: 6 }}>
            <ChevronRight size={12} color="#0e7a4a" strokeWidth={1.7} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
