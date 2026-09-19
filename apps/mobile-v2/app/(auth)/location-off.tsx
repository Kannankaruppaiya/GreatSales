import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HillsDeep } from '../../src/components/ui/Hills';
import { PrimaryPill, OutlinePill, QuietPill } from '../../src/components/ui/PermissionButtons';
import { ICONS } from '../../src/design-system/icons';
import { PinGlyph, InfoGlyph, GearGlyph, RefreshGlyph, Cloud } from '../../src/components/illustrations/glyphs';

/**
 * Screen 01B-C Location Access is Off. Spec: design/screens/01b-c-off.json.
 *
 * Where "Not Now" on 01B leads, and where the system dialog leads when it is
 * refused. It is the one screen in the set that has to be reachable WITHOUT
 * the permission, so nothing on it asks the OS for anything: "Open App
 * Settings" hands over to the system, "Retry Permission" goes back to 01B-D,
 * and "Continue Without Location" carries on into the app.
 *
 * Excluded: the mockup's status bar, and `bg`'s 34px radius - the phone
 * frame.
 *
 * The pin is the same glyph as 01B's, painted #e5484d rather than brand and
 * framed in a 43x41 box rather than a square one - which is why PinGlyph
 * takes a width and a height as well as a size.
 */
const ChevronLeft = ICONS['chevron-left'];

const DESIGN_TOP = 57;
const PAD_L = 24;
const PAD_R = 23;

export default function LocationOff() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);
  /** A board x as a percentage, so the scatter holds on any width. */
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
              style={{ position: 'absolute', left: PAD_L }}
            >
              <ChevronLeft size={22} color="#0f3244" strokeWidth={2.2} />
            </Pressable>
          </View>

          {/*
            The disc, the two clouds and the pin, as one 167-tall block from
            the board's y85. They are scattered rather than stacked - the
            clouds sit at 96 and 111, the pin at 124 - so they are placed
            absolutely and the x's are percentages of the board's width.
          */}
          <View style={{ marginTop: 6, height: 130 }} accessible accessibilityRole="image"
            accessibilityLabel="A map pin under a clouded sky, greyed out">
            <View style={{ position: 'absolute', left: pct(122), top: 0 }}>
              {/* A radial wash, white at the rim, so the pin is not floating
                  on the page. It is the board's `disc`. */}
              <Svg width={130} height={130}>
                <Defs>
                  <RadialGradient id="offDisc" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#f9d5da" />
                    <Stop offset="0.55" stopColor="#fbe3e7" />
                    <Stop offset="1" stopColor="#ffffff" />
                  </RadialGradient>
                </Defs>
                <Circle cx={65} cy={65} r={65} fill="url(#offDisc)" />
              </Svg>
            </View>
            <View style={{ position: 'absolute', left: pct(26), top: 11 }}><Cloud side="left" /></View>
            <View style={{ position: 'absolute', left: pct(278), top: 26 }}><Cloud side="right" /></View>
            <View style={{ position: 'absolute', left: pct(166), top: 39 }}>
              <PinGlyph width={43} height={41} color="#e5484d" />
            </View>
          </View>

          <Text
            className="text-center text-ink"
            style={{ marginTop: 37, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, lineHeight: 29 }}
          >
            Location Access is Off
          </Text>
          <Text
            className="text-center text-muted"
            style={{
              marginTop: 10, marginLeft: 34, marginRight: 34,
              fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22.4,
            }}
          >
            We couldn&apos;t access your location. Some features like nearby customers, route planning and
            location-based insights may be limited.
          </Text>

          {/* The reassurance, in the page's blue-grey rather than its mint:
              this card is not telling you something has gone well. */}
          <View
            style={{
              marginTop: 38, marginLeft: PAD_L, marginRight: PAD_R,
              height: 83, borderRadius: 13, backgroundColor: '#f1f7fa',
              borderWidth: 1, borderColor: '#e3edf2',
            }}
          >
            <View style={{ position: 'absolute', left: 18, top: 17 }}><InfoGlyph /></View>
            <Text
              className="text-ink"
              style={{
                position: 'absolute', left: 46, right: 14, top: 15,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19,
              }}
            >
              You can still continue
            </Text>
            <Text
              className="text-muted"
              style={{
                position: 'absolute', left: 46, top: 36, width: 263,
                fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16,
              }}
            >
              You can use the app without location and enable it anytime from settings.
            </Text>
          </View>

          <View style={{ marginTop: 29, marginLeft: PAD_L, marginRight: PAD_R }}>
            <PrimaryPill label="Open App Settings" size={16} icon={<GearGlyph />} />
          </View>
          <View style={{ marginTop: 13, marginLeft: PAD_L, marginRight: PAD_R }}>
            <OutlinePill
              label="Retry Permission"
              icon={<RefreshGlyph />}
              onPress={() => router.replace('/(auth)/location-retry')}
            />
          </View>
          <View style={{ marginTop: 13, marginLeft: PAD_L, marginRight: PAD_R }}>
            <QuietPill
              label="Continue Without Location"
              size={16}
              onPress={() => router.replace('/(auth)/preparing')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
