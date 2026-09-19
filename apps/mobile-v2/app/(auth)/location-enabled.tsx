import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Circle, Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { VillageScene, Confetti } from '../../src/components/illustrations/VillageScene';

/**
 * Screen 01B-E Location Access Enabled. Spec: design/screens/01b-e-enabled.json.
 *
 * Where the permission ask lands when it is granted. It is the only screen in
 * the 01B set with no back chevron and no "Not Now": there is nothing left to
 * decide, so the one button goes forward.
 *
 * Excluded: the mockup's status bar, and `bg`'s 34px radius - the phone
 * frame.
 *
 * Laid out ABSOLUTELY at the board's coordinates, for the same reason as 01B:
 * the tick, the handwriting and the scene sit at four unrelated heights and
 * any flow of margins straightens the composition out. It is wrapped in a
 * ScrollView sized to the board so a 667pt phone still reaches "Continue".
 *
 * Board y values include the status-bar band, so the safe-area inset is
 * SUBTRACTED from them - see the note in login.tsx.
 */
const BOARD_W = 376;
const BOARD_H = 859;

export default function LocationEnabled() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const at = (y: number) => Math.max(0, y - insets.top);
  const pct = (x: number) => `${(x / BOARD_W) * 100}%` as const;

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            height: Math.max(BOARD_H - insets.top - insets.bottom, screenH - insets.top - insets.bottom),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* The tick: a radial wash, confetti, a gradient disc and the mark.
              Four separate shapes on the board and four here - the confetti
              is WIDER than the wash (156 against 135) and centred on it, so
              it cannot be folded into one picture. */}
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="A green tick, celebrated"
            style={{ position: 'absolute', left: 0, right: 0, top: at(72), height: 135 }}
          >
            <View style={{ position: 'absolute', left: pct(120) }}>
              <Svg width={135} height={135}>
                <Defs>
                  <RadialGradient id="okDisc" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#d4efe0" />
                    <Stop offset="0.55" stopColor="#e9f8f0" />
                    <Stop offset="1" stopColor="#ffffff" />
                  </RadialGradient>
                </Defs>
                <Circle cx={67.5} cy={67.5} r={67.5} fill="url(#okDisc)" />
              </Svg>
            </View>
            <View style={{ position: 'absolute', left: pct(109) }}>
              <Confetti />
            </View>
            <View style={{ position: 'absolute', left: pct(151), top: 32 }}>
              <Svg width={73} height={73}>
                <Defs>
                  <SvgLinear id="okRing" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#2cb873" />
                    <Stop offset="1" stopColor="#0e7a4a" />
                  </SvgLinear>
                </Defs>
                <Circle cx={36.5} cy={36.5} r={36.5} fill="url(#okRing)" />
                <Path
                  d="M25.2,36.51L32.91,44.23L46.8,28.29"
                  stroke="#ffffff"
                  strokeWidth={2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
          </View>

          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 0, right: 0, top: at(239),
              fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, lineHeight: 28,
            }}
          >
            Location Access Enabled!
          </Text>
          <Text
            className="text-center text-muted"
            style={{
              position: 'absolute', left: 31, right: 32, top: at(278),
              fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22.4,
            }}
          >
            You&apos;re all set. We&apos;ll use your location to bring you relevant customers, better
            insights and a smoother field sales experience.
          </Text>

          {/* Two runs at different indents, as on the splash: written rather
              than set. The rule under them is the design's own stroke. */}
          <Text
            className="text-ink"
            style={{
              position: 'absolute', left: pct(242), top: at(369),
              fontFamily: 'Caveat_400Regular', fontSize: 20, lineHeight: 22,
            }}
          >
            More
          </Text>
          <Text
            className="text-ink"
            style={{
              position: 'absolute', left: pct(203), top: at(392),
              fontFamily: 'Caveat_400Regular', fontSize: 20, lineHeight: 22,
            }}
          >
            opportunities ahead.
          </Text>
          <View style={{ position: 'absolute', left: pct(205), top: at(418) }}>
            <Svg width={151} height={18} viewBox="0 0 151 18">
              <Path
                d="M3.9,12.86C36.45,18 106.74,10.29 147.1,3.86"
                stroke="#17a45e"
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>

          {/* The sky and the scene are one shape: VillageScene paints the
              gradient the board puts on `sky` and clips itself to the same
              21 radius, which is what the board's own stacking does. */}
          <View style={{ position: 'absolute', left: pct(18), right: 19, top: at(429) }}>
            <VillageScene width="100%" height={328} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/preparing')}
            className="overflow-hidden"
            style={{ position: 'absolute', left: 23, right: 24, top: at(774), height: 55, borderRadius: 13 }}
          >
            <LinearGradient
              colors={['#0e7a4a', '#1ba560']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                className="text-white"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, lineHeight: 25 }}
              >
                Continue  →
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
