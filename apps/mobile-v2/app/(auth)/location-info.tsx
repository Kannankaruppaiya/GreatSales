import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { HillsDeep } from '../../src/components/ui/Hills';
import { PrimaryPill, QuietPill } from '../../src/components/ui/PermissionButtons';
import { ICONS } from '../../src/design-system/icons';
import {
  GroupGlyph, SendGlyph, RisingBarsGlyph, ShieldCheckGlyph,
} from '../../src/components/illustrations/glyphs';

/**
 * Screen 01B-INFO Why Location Helps. Spec: design/screens/01b-info.json.
 *
 * The long answer to "why do you want this?", reachable from the ask rather
 * than standing in its way: four cards, the last of which is the privacy one,
 * and then the same two buttons the ask itself carries.
 *
 * Excluded: the mockup's status bar, and `bg`'s 34px radius - the phone
 * frame.
 *
 * Three of the four glyphs are ones other screens already draw at other
 * sizes; only the paper plane is new here. The board frames all four in a 27
 * box where 01B-D uses 22, and they are the same paths at the same fractions
 * of their box, so `size` is the whole difference.
 */
const ChevronLeft = ICONS['chevron-left'];

const DESIGN_TOP = 57;
const PAD_L = 24;
const PAD_R = 23;

const CARDS: { title: string; body: string; Icon: ComponentType<{ size?: number }> }[] = [
  {
    title: 'Find Nearby Customers',
    body: 'See customers around you and never miss a potential visit.',
    Icon: GroupGlyph,
  },
  {
    title: 'Plan Your Field Visits',
    body: 'Get suggested routes, save travel time and cover more customers.',
    Icon: SendGlyph,
  },
  {
    title: 'Smarter Insights',
    body: 'Access location-based opportunities and area-wise performance insights.',
    Icon: RisingBarsGlyph,
  },
  {
    title: 'Your Privacy Matters',
    body: 'Your location is used only with your permission and is never shared without your consent.',
    Icon: ShieldCheckGlyph,
  },
];

export default function LocationInfo() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);

  return (
    <View className="flex-1 bg-surface">
      <LinearGradient
        colors={['#e9f7f0', '#dcf1e7']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 248 }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <HillsDeep />
      </View>

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: topPad, height: 22, justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={12}
              style={{ position: 'absolute', left: PAD_L }}
            >
              <ChevronLeft size={22} color="#0f3244" strokeWidth={2.2} />
            </Pressable>
          </View>

          <Text
            className="text-center text-ink"
            style={{ marginTop: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 23, lineHeight: 30 }}
          >
            Why Location Helps
          </Text>
          <Text
            className="text-center text-muted"
            style={{
              marginTop: 9, marginLeft: 42, marginRight: 41,
              fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21.7,
            }}
          >
            Location turns everyday territory into real opportunities.
          </Text>

          {/* The board's four gaps are 13, 12 and 13 - a pixel of its own
              drift, kept rather than averaged to 12.67. */}
          {CARDS.map(({ title, body, Icon }, i) => (
            <View
              key={title}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`${title}. ${body}`}
              style={{
                marginTop: i === 0 ? 16 : [0, 13, 12, 13][i],
                marginLeft: PAD_L, marginRight: PAD_R,
                height: 81, borderRadius: 13, backgroundColor: '#f2f9f5',
              }}
            >
              <View style={{ position: 'absolute', left: 18, top: 20 }}><Icon size={27} /></View>
              <Text
                className="text-ink"
                style={{
                  position: 'absolute', left: 60, right: 15, top: 14,
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19,
                }}
              >
                {title}
              </Text>
              <Text
                className="text-muted"
                style={{
                  position: 'absolute', left: 60, top: 34, width: 250,
                  fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16,
                }}
              >
                {body}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: 33, marginLeft: PAD_L, marginRight: PAD_R }}>
            <PrimaryPill label="Allow Location Access  →" />
          </View>
          <View style={{ marginTop: 13, marginLeft: PAD_L, marginRight: PAD_R }}>
            <QuietPill label="Not Now" onPress={() => router.replace('/(auth)/location-off')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
