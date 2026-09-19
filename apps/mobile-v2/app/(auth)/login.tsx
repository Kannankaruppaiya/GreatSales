import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Hills } from '../../src/components/ui/Hills';
import { ICONS } from '../../src/design-system/icons';

/**
 * Screen 01A Login. Spec: design/screens/01a-login.json.
 *
 * Excluded, as on the splash: the "9:41" and the signal/wifi/battery group are
 * the mockup's status bar, and the 34px radius on `bg` is the phone frame.
 *
 * This screen scrolls. The board is a fixed 859 and the content fills it, so
 * on a 667pt phone - or any phone once the keyboard is up - a fixed layout
 * would put "Continue with Google" under the keyboard with no way to reach it.
 *
 * Line heights are the design's MEASURED box heights, not a multiplier.
 * Penpot reports a 14px run at 1.3 as 19 tall; the browser computes 18.2 and
 * lays out 18. One pixel per element is invisible on its own and accumulates
 * down a form - it had the footer 5px high by the bottom of this screen. The
 * board's number removes it at the source. *
 * The mint wash and the hills sit behind the content rather than inside the
 * scroll, so they stay pinned to the bottom of the screen as the design has
 * them rather than scrolling away.
 */
const ChevronDown = ICONS['chevron-down'];
const ChevronLeft = ICONS['chevron-left'];
const Check = ICONS['check'];

/**
 * Where the board puts the top row. The status bar band is inside this, which
 * is why the inset is subtracted rather than added.
 */
const DESIGN_TOP = 53;

export default function Login() {
  const [remember, setRemember] = useState(true);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(0, DESIGN_TOP - insets.top);

  return (
    <View className="flex-1 bg-surface">
      {/* mint: a vertical wash over the bottom 248pt, #e9f7f0 -> #dcf1e7. */}
      <LinearGradient
        colors={['#e9f7f0', '#dcf1e7']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 248 }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Hills />
      </View>

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* topPad completes the board's 53pt to the top of the screen; the
            SafeAreaView above has already supplied insets.top of it. */}
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back, and the language pill. */}
          <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 22, marginTop: topPad }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft size={22} color="#0f3244" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-center bg-fieldSubtle border border-fieldLine"
              style={{ width: 69, height: 35, borderRadius: 10 }}
            >
              <Text className="text-ink" style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 }}>
                EN
              </Text>
              <ChevronDown size={14} color="#0f3244" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          {/* Mark and wordmark. Smaller here than on the splash - 39/25/12
              against 42/27/13 - and in ink rather than white, because this
              screen has no photograph under it. */}
          <Text
            className="text-center text-brand-light"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 39, lineHeight: 45, marginTop: 8 }}
          >
            G
          </Text>
          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 30, marginTop: 7 }}
          >
            GreatSales
          </Text>
          <Text
            className="text-center text-muted"
            style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 15, marginTop: 2 }}
          >
            Field Sales CRM
          </Text>

          <Text
            className="text-center text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 27, lineHeight: 34, marginTop: 33 }}
          >
            Welcome Back
          </Text>
          <View style={{ paddingHorizontal: 58, marginTop: 8 }}>
            <Text
              className="text-center text-muted"
              style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 16 * 1.55 }}
            >
              Sign in to continue to your sales workspace.
            </Text>
          </View>

          {/*
            22 left, 35 right. The board's fields are 319 wide at x22, so their
            right edge is 341 and the column sits 6.5px left of centre. That is
            the board's own asymmetry - the splash's 319-wide CTA is centred at
            x29 - and it is kept rather than tidied.
          */}
          <View style={{ paddingLeft: 22, paddingRight: 35, marginTop: 28 }}>
            <Input
              label="Mobile Number or Email"
              icon="phone"
              placeholder="+91 98765 43210"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="username"
            />

            <View style={{ marginTop: 26 }}>
              <Input
                label="Password"
                icon="lock"
                placeholder="Enter your password"
                secure
                autoComplete="current-password"
              />
            </View>

            <Pressable accessibilityRole="button" style={{ marginTop: 13 }} hitSlop={8}>
              <Text
                className="text-right text-brand"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 19 }}
              >
                Forgot Password?
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              onPress={() => setRemember((v) => !v)}
              className="flex-row items-center"
              style={{ marginTop: 17 }}
              hitSlop={8}
            >
              <View
                className={remember ? 'bg-brand-light' : 'bg-surface border border-fieldLine'}
                style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }}
              >
                {remember ? <Check size={14} color="#ffffff" /> : null}
              </View>
              <Text
                className="text-ink"
                style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 19, marginLeft: 8 }}
              >
                Remember me
              </Text>
            </Pressable>

            {/* Same gradient and height as the splash CTA, at a 20/700 label. */}
            <Pressable
              accessibilityRole="button"
              className="overflow-hidden"
              style={{ height: 49, borderRadius: 12, marginTop: 22 }}
            >
              <LinearGradient
                colors={['#0e7a4a', '#1ba560']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text className="text-white" style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 26 }}>
                  Sign In
                </Text>
              </LinearGradient>
            </Pressable>

            <View className="flex-row items-center" style={{ marginTop: 17 }}>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
              <Text
                className="text-muted"
                style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 19, marginHorizontal: 16 }}
              >
                or
              </Text>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
            </View>

            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-center bg-surface border border-fieldLine"
              style={{ height: 49, borderRadius: 12, marginTop: 14 }}
            >
              <GoogleMark />
              <Text
                className="text-ink"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 22, marginLeft: 8 }}
              >
                Continue with Google
              </Text>
            </Pressable>
          </View>

          {/* One Text with a nested run: the design paints "New to GreatSales?"
              muted at 400 and "Contact Support" brand at 700, on one line. */}
          <Text
            className="text-center"
            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 19, marginTop: 37, color: '#6b8796' }}
          >
            New to GreatSales?{'   '}
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0e7a4a' }}>Contact Support</Text>
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Google's mark, drawn rather than imported.
 *
 * It is the one glyph on these screens that is not Lucide and not ours -
 * Google's brand guidelines require their own four-colour G - so it is its own
 * small component instead of an entry in the icon map, which is for the
 * design's Lucide set.
 */
import Svg, { Path } from 'react-native-svg';

function GoogleMark({ size = 21 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </Svg>
  );
}
