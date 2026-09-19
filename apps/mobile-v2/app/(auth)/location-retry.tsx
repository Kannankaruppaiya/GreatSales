import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HillsDeep } from '../../src/components/ui/Hills';
import { PrimaryPill, QuietPill } from '../../src/components/ui/PermissionButtons';
import { ICONS } from '../../src/design-system/icons';
import {
  PinGlyph, RouteGlyph, RisingBarsGlyph,
} from '../../src/components/illustrations/glyphs';

/**
 * Screen 01B-D Let's Try Again. Spec: design/screens/01b-d-retry.json.
 *
 * The second ask, reached from 01B-C's "Retry Permission". It restates what
 * the permission buys rather than repeating 01B word for word, which is why
 * it carries the three bullets and 01B carries four scattered badges.
 *
 * Excluded: the mockup's status bar, and `bg`'s 34px radius - the phone
 * frame.
 *
 * The rings are 01B's illustration WITHOUT the phone and one ring narrower,
 * with a pin in the middle and four dots scattered around it. Their radii,
 * stroke widths and tints all differ per ring - 1.5/#c7e6d6, 1.4/#d6eee3,
 * 1.3/#e2f4eb - so the ripple reads as fading outward rather than as three
 * copies of one circle.
 */
const ChevronLeft = ICONS['chevron-left'];

const DESIGN_TOP = 57;
const PAD = 23;

/** Board x,y (relative to the illustration block at y67), diameter. */
const DOTS = [
  { x: 83, y: 70, d: 9 },
  { x: 282, y: 68, d: 12 },
  { x: 126, y: 158, d: 9 },
  { x: 242, y: 159, d: 8 },
];

const BULLETS = [
  { label: 'Find nearby customers', Icon: PinGlyph },
  { label: 'Plan better routes', Icon: RouteGlyph },
  { label: 'Get area-wise insights', Icon: RisingBarsGlyph },
];

export default function LocationRetry() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  const pct = (x: number) => `${(x / 376) * 100}%` as const;

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
              style={{ position: 'absolute', left: PAD }}
            >
              <ChevronLeft size={22} color="#0f3244" strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* The board starts the rings at y67, twelve above where the back
              row ends, so this block pulls up rather than the chevron moving
              down. */}
          <View
            style={{ marginTop: -12, height: 226 }}
            accessible
            accessibilityRole="image"
            accessibilityLabel="A map pin at the centre of three widening rings"
          >
            <View style={{ position: 'absolute', left: pct(78), top: 0 }}>
              <Svg width={221} height={221}>
                <Circle cx={110.5} cy={110.5} r={106.6} stroke="#c7e6d6" strokeWidth={1.5} fill="none" />
                <Circle cx={110.5} cy={110.5} r={78} stroke="#d6eee3" strokeWidth={1.4} fill="none" />
                <Circle cx={110.5} cy={110.5} r={49.4} stroke="#e2f4eb" strokeWidth={1.3} fill="none" />
              </Svg>
            </View>
            <View style={{ position: 'absolute', left: pct(171), top: 81 }}>
              <PinGlyph width={34} height={40} />
            </View>
            {DOTS.map((d) => (
              <View
                key={d.x}
                style={{
                  position: 'absolute', left: pct(d.x), top: d.y,
                  width: d.d, height: d.d, borderRadius: d.d / 2,
                  backgroundColor: '#3fc489', opacity: 0.85,
                }}
              />
            ))}
          </View>

          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 29 }}
          >
            Let&apos;s Try Again
          </Text>
          <Text
            className="text-center text-muted"
            style={{
              marginTop: 10, marginLeft: 39, marginRight: 39,
              fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22.4,
            }}
          >
            Tap the button below to enable location access and get the full field sales experience.
          </Text>

          <View
            style={{
              marginTop: 54, marginLeft: PAD, marginRight: PAD,
              height: 143, borderRadius: 13, backgroundColor: '#f2f9f5',
            }}
          >
            {BULLETS.map(({ label, Icon }, i) => (
              <View key={label}>
                <View style={{ position: 'absolute', left: 21, top: 18 + i * 44.5 }}>
                  <Icon size={22} />
                </View>
                <Text
                  style={{
                    position: 'absolute', left: 55, right: 14, top: 20 + i * 44.5,
                    fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 19, color: '#123e52',
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 37, marginLeft: PAD, marginRight: PAD }}>
            <PrimaryPill label="Try Again  →" icon={<PinGlyph size={21} color="#ffffff" />} />
          </View>
          <View style={{ marginTop: 13, marginLeft: PAD, marginRight: PAD }}>
            <QuietPill label="Not Now" onPress={() => router.replace('/(auth)/location-off')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
