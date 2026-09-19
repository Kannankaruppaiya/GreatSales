import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hills } from '../../src/components/ui/Hills';
import {
  SkyIllustration, StepCheck, StepSpinner, QuoteSwoosh,
} from '../../src/components/illustrations/SkyIllustration';

/**
 * Screen 01C Preparing. Spec: design/screens/01c-preparing.json.
 *
 * Excluded: the mockup's status bar and the 34px frame radius.
 *
 * Laid out at the board's coordinates, like 01B: the sky is a composition of
 * overlapping pieces at specific offsets, and putting the steps and the
 * progress bar in a flow beside an absolutely-placed illustration would let
 * the two drift apart on a different screen height.
 *
 * The step list and the 75% are STATIC here, as the design has them. They
 * become real when the launch sequence behind them does - restoring the
 * session, warming the dashboard query, filling the offline cache - and each
 * step is a state this screen reads, not a timer it runs.
 */
const BOARD_W = 376;
const BOARD_H = 859;

const STEPS = [
  { y: 397, ty: 400, label: 'Authenticating your account', done: true },
  { y: 442, ty: 444, label: 'Loading your sales data', done: true },
  { y: 486, ty: 488, label: 'Preparing offline content', done: true },
  { y: 530, ty: 533, label: 'Almost ready...', done: false },
] as const;

export default function Preparing() {
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const at = (y: number) => Math.max(0, y - insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: '#fbfdfc' }}>
      {/* The mint here is 300 tall from 559, not the 248 of 01A and 01B. */}
      <LinearGradient
        colors={['#e9f7f0', '#dcf1e7']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Hills />
      </View>

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            height: Math.max(BOARD_H - insets.top - insets.bottom, screenH - insets.top - insets.bottom),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ position: 'absolute', left: 0, right: 0, top: at(0) }}>
            <SkyIllustration width={screenW} />
          </View>

          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 0, right: 0, top: at(304),
              fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 33,
            }}
          >
            Setting up
          </Text>
          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 0, right: 0, top: at(335),
              fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 33,
            }}
          >
            your workspace...
          </Text>

          {STEPS.map(({ y, ty, label, done }) => (
            <View key={label}>
              <View
                style={{ position: 'absolute', left: 39, top: at(y), width: 23, height: 23 }}
                className={done ? 'bg-brand-light items-center justify-center rounded-full' : ''}
              >
                {done ? <StepCheck /> : <StepSpinner />}
              </View>
              <Text
                style={{
                  position: 'absolute', left: 75, right: 41, top: at(ty),
                  fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, lineHeight: 21,
                  // The running step is muted; the finished ones are ink2.
                  color: done ? '#123e52' : '#6b8796',
                }}
              >
                {label}
              </Text>
            </View>
          ))}

          {/* 280 of track at 28, filled to 209 - the 75% the label states. */}
          <View
            className="bg-progressTrack"
            style={{ position: 'absolute', left: 28, top: at(611), width: 280, height: 9, borderRadius: 5, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#0e7a4a', '#2cb873']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: '74.6%', height: '100%' }}
            />
          </View>
          <Text
            className="text-ink"
            style={{
              position: 'absolute', left: 316, top: at(605),
              fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19,
            }}
          >
            75%
          </Text>

          {/* The quotation, in Caveat as on the splash. */}
          <View
            style={{ position: 'absolute', left: 22, right: 22, top: at(670), height: 91, borderRadius: 16, backgroundColor: '#edf7f1' }}
          />
          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 22, right: 22, top: at(683),
              fontFamily: 'Caveat_400Regular', fontSize: 23, lineHeight: 27,
            }}
          >
            A bigger tomorrow
          </Text>
          <Text
            className="text-center text-ink"
            style={{
              position: 'absolute', left: 22, right: 22, top: at(712),
              fontFamily: 'Caveat_400Regular', fontSize: 23, lineHeight: 27,
            }}
          >
            begins with the next visit.
          </Text>
          <View style={{ position: 'absolute', left: 166, top: at(738) }}>
            <QuoteSwoosh />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
