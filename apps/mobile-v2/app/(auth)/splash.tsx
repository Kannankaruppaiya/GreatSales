import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';

/**
 * Screen 01 Splash.
 *
 * Built from the board of the same name on the `mobiles` page; the measured
 * spec is design/screens/01-splash.json.
 *
 * Two things on the board are NOT drawn here. The "9:41" and the
 * signal/wifi/battery group are the mockup's status bar, which the operating
 * system draws on a real device - painting our own would put two clocks on the
 * screen. And the 34px corner radius on the photograph belongs to the phone
 * frame the mockup sits in, not to anything the app renders.
 *
 * Vertical positions come from the board's 859pt height as fractions, because
 * phones are 640-950pt tall and the composition is proportional: the panel
 * holds the bottom quarter, the photograph everything above it, and the type
 * sits at fixed fractions down the photograph. Type sizes and the panel's
 * radius stay absolute - text does not scale with the screen.
 */
const BOARD_HEIGHT = 859;
const f = (y: number) => y / BOARD_HEIGHT;

export default function Splash() {
  const { height } = useWindowDimensions();
  const at = (y: number) => f(y) * height;
  // The board's y values include the status-bar band, so the safe-area inset
  // is subtracted from them rather than added. On web the inset is 0 and this
  // is a no-op; on a phone it is what keeps the mark at the board's 62 instead
  // of at 62 plus the notch.
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface">
      {/*
        expo-image rather than react-native's Image, because the photograph is
        a WebP: 146KB at the source's own 760x1340, against the megabyte or two
        the same picture costs as a PNG. React Native's built-in loader does
        not decode WebP on iOS without extra setup; expo-image does, on every
        platform, and it was already a dependency.
      */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: at(666) }}>
        <Image
          source={require('../../assets/images/splash-bg.webp')}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        {/* scrim-top: #06202c at 55% fading out over the first 260pt, so the
            mark and the wordmark stay legible whatever the photograph does. */}
        <LinearGradient
          colors={['rgba(6,32,44,0.55)', 'rgba(6,32,44,0)']}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: at(260) }}
        />
        {/* scrim-bot: the mirror of it, 379 -> 665, under the handwriting. */}
        <LinearGradient
          colors={['rgba(6,32,44,0)', 'rgba(6,32,44,0.5)']}
          style={{
            position: 'absolute', left: 0, right: 0,
            top: at(379), height: at(286),
          }}
        />
      </View>

      <SafeAreaView edges={['top']} className="flex-1">
        <View style={{ marginTop: Math.max(0, at(62) - insets.top) }}>
          <Text
            className="text-center text-brand-onPhoto"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 42, lineHeight: 42 * 1.15 }}
          >
            G
          </Text>
        </View>

        <View style={{ marginTop: at(135) - at(111) }}>
          <Text
            className="text-center text-white"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 27, lineHeight: 27 * 1.2 }}
          >
            GreatSales
          </Text>
          <Text
            className="text-center text-white"
            style={{
              fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13,
              lineHeight: 13 * 1.2, opacity: 0.88, marginTop: 2,
            }}
          >
            Field Sales CRM
          </Text>
        </View>

        {/* The handwriting is four separate runs in the design, each indented
            differently - 39, 63, 47, 68 - so it reads as written by hand
            rather than set. One <Text> with line breaks would lose that. */}
        <View style={{ marginTop: at(197) - at(186) }}>
          {[
            { word: 'Every', x: 39 },
            { word: 'visit', x: 63 },
            { word: 'builds', x: 47 },
            { word: 'tomorrow', x: 68 },
          ].map(({ word, x }) => (
            <Text
              key={word}
              className="text-white"
              style={{
                fontFamily: 'Caveat_400Regular',
                fontSize: 39,
                lineHeight: 39 * 1.05,
                marginLeft: x,
              }}
            >
              {word}
            </Text>
          ))}
          <View style={{ marginLeft: 63, marginTop: 8 }}>
            <Svg width={148} height={15} viewBox="0 0 148.2 15">
              <Path
                d="M0,12.8 C37.7,19.2 102.7,9 148.2,0"
                stroke="#2fcb7c"
                strokeWidth={3.4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
        </View>
      </SafeAreaView>

      {/* panel: bottom-anchored, 31pt top radius, overlapping the photograph. */}
      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 bg-surface"
        style={{ borderTopLeftRadius: 31, borderTopRightRadius: 31 }}
      >
        <View className="items-center px-7 pt-4 pb-2">
          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 25 * 1.25 }}
          >
            Sell Smarter.
          </Text>
          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 25 * 1.25 }}
          >
            Go Further.
          </Text>
          <Text
            className="text-center text-muted"
            style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, lineHeight: 15 * 1.3, marginTop: 6 }}
          >
            Track · Engage · Grow
          </Text>

          {/*
            The CTA is NOT the standard button. Board 08's primary is a flat
            #17a45e at 46/12 with a 13/700 label; this one is a horizontal
            gradient at 49/13 with an 18/700 label. It is the only button on
            the only screen with no chrome around it, so it stays a one-off
            here rather than becoming a Button variant nothing else uses.
          */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/login')}
            className="w-full overflow-hidden"
            // 17 above and 24 below are the board's own gaps: p3 ends at 744
            // and the CTA starts at 761; the CTA ends at 810 and the footnote
            // sits at 834.
            style={{ marginTop: 17, height: 49, borderRadius: 13 }}
          >
            <LinearGradient
              colors={['#0e7a4a', '#1ba560']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                className="text-white"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, lineHeight: 18 * 1.3 }}
              >
                Get Started   →
              </Text>
            </LinearGradient>
          </Pressable>

          <Text
            className="text-center text-faint2"
            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 13 * 1.3, marginTop: 24 }}
          >
            Trusted by 10,000+ field sales teams
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
