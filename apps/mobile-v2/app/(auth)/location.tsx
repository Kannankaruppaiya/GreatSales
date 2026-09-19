import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Hills } from '../../src/components/ui/Hills';
import { LocationIllustration } from '../../src/components/illustrations/LocationIllustration';
import {
  PinGlyph, PeopleGlyph, CalendarGlyph, BarsGlyph, ShieldGlyph, CtaPinGlyph,
} from '../../src/components/illustrations/glyphs';

/**
 * Screen 01B Location. Spec: design/screens/01b-location.json.
 *
 * Excluded: the mockup's status bar and the 34px frame radius.
 *
 * This screen is laid out ABSOLUTELY at the board's own coordinates, which is
 * the exception rather than the rule here. The four badges are scattered at
 * four different heights - 135, 101, 270, 254 - precisely so they do not read
 * as a grid, and any row-and-column layout straightens that out. Once the
 * badges are absolute the rest may as well be, so the whole composition holds
 * together instead of half of it drifting against the other half.
 *
 * It is wrapped in a ScrollView sized to the board, so a 667pt phone reaches
 * "Not Now" rather than losing it below the fold.
 *
 * Board y values include the status-bar band, so the safe-area inset is
 * SUBTRACTED from them - see the note in login.tsx.
 */
const BOARD_W = 376;
const BOARD_H = 859;

const BADGES = [
  { key: 'visits', x: 29, y: 135, label: 'Track Visits', lx: 21, ly: 195, lw: 101, Glyph: PinGlyph },
  { key: 'nearby', x: 293, y: 101, label: 'Nearby\nCustomers', lx: 268, ly: 161, lw: 104, Glyph: PeopleGlyph },
  { key: 'plan', x: 34, y: 270, label: 'Plan Better', lx: 9, ly: 330, lw: 104, Glyph: CalendarGlyph },
  { key: 'reports', x: 288, y: 254, label: 'Accurate\nReports', lx: 263, ly: 314, lw: 104, Glyph: BarsGlyph },
] as const;

export default function Location() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  /** A board y, in the coordinate space inside the safe area. */
  const at = (y: number) => Math.max(0, y - insets.top);
  /** A board x as a percentage, so the scatter holds on any width. */
  const pct = (x: number) => `${(x / BOARD_W) * 100}%` as const;

  return (
    <View className="flex-1 bg-surface">
      <LinearGradient
        colors={['#e9f7f0', '#dcf1e7']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 248 }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Hills />
      </View>

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            // The board's height, or the screen's if it is taller - never less,
            // or the absolute children below would be clipped.
            height: Math.max(BOARD_H - insets.top - insets.bottom, screenH - insets.top - insets.bottom),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* rings + phone: 229 across, at board (73, 148). */}
          <View style={{ position: 'absolute', left: pct(73), top: at(148) }}>
            <LocationIllustration />
          </View>

          {BADGES.map(({ key, x, y, label, lx, ly, lw, Glyph }) => (
            <View key={key}>
              <View
                className="bg-brand-soft items-center justify-center"
                style={{ position: 'absolute', left: pct(x), top: at(y), width: 55, height: 55, borderRadius: 27.5 }}
              >
                <Glyph />
              </View>
              <Text
                className="text-center text-ink"
                style={{
                  position: 'absolute',
                  left: pct(lx),
                  top: at(ly),
                  width: lw,
                  fontFamily: 'PlusJakartaSans_600SemiBold',
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                {label}
              </Text>
            </View>
          ))}

          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 0, right: 0, top: at(444),
              fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 29,
            }}
          >
            Enable Location Access
          </Text>

          <Text
            className="text-center text-muted"
            style={{
              position: 'absolute', left: 37, right: 36, top: at(486),
              fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 24,
            }}
          >
            We use your location to show nearby customers, track visits and give you better recommendations.
          </Text>

          {/* Primary: the gradient, 52 tall at radius 13 with a leading pin. */}
          <Pressable
            accessibilityRole="button"
            className="overflow-hidden"
            // 319 wide at x22, so right is 35 - see the note in login.tsx.
            style={{ position: 'absolute', left: 22, right: 35, top: at(616), height: 52, borderRadius: 13 }}
          >
            <LinearGradient
              colors={['#0e7a4a', '#1ba560']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <CtaPinGlyph />
              <Text
                className="text-white"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, lineHeight: 25, marginLeft: 7 }}
              >
                Allow Location Access
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/preparing')}
            className="bg-quiet items-center justify-center"
            style={{ position: 'absolute', left: 22, right: 35, top: at(686), height: 49, borderRadius: 13 }}
          >
            <Text
              className="text-quiet-ink"
              style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, lineHeight: 25 }}
            >
              Not Now
            </Text>
          </Pressable>

          <View style={{ position: 'absolute', left: 47, right: 20, top: at(803), flexDirection: 'row' }}>
            <View style={{ marginTop: 3 }}>
              <ShieldGlyph />
            </View>
            <Text
              className="text-muted"
              style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 18, marginLeft: 8, flex: 1 }}
            >
              {'Your location is secure with us.\nWe never share it without your permission.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
