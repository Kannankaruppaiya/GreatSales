/**
 * The dashboard's motion vocabulary.
 *
 * Three things move, and each one reports something rather than decorating:
 * cards arrive in the order you read them, a progress bar grows to the figure
 * it represents instead of appearing already full, and a headline number counts
 * up to its value so a change between two months is something you see rather
 * than something you have to remember.
 *
 * Built directly on react-native-reanimated, which the Expo SDK already ships
 * and pins. `moti` was tried first — it is the usual "motion library" answer
 * for React Native — but it targets Reanimated 2/3 and breaks at runtime
 * against the Reanimated 4 this project is on. Reanimated's own entering
 * animations and shared values cover all of this in less code anyway, and they
 * run on the UI thread, which matters on the low-end phones this app lives on.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export { useReducedMotion };

/**
 * A card that arrives. `index` staggers siblings so a grid resolves in reading
 * order — 60ms apart, enough to read as a sequence without making the last
 * tile feel late.
 *
 * Reanimated's `useReducedMotion` reads the OS switch, and when it is on the
 * entering animation is dropped entirely rather than shortened: for some people
 * this motion is the difference between a usable app and a nauseating one.
 */
export function Arrive({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <View style={style}>{children}</View>;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(380).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * A number that counts up to its value.
 *
 * This one runs on the JS thread, unlike everything else here, because the
 * thing being animated is the *text* and text content cannot be produced from
 * a worklet. That is affordable for one headline figure — about 38 frames, once
 * per value change — and is why it is not offered for list rows.
 */
export function CountUp({
  value,
  format,
  style,
  durationMs = 620,
}: {
  value: number;
  format: (n: number) => string;
  style?: TextStyle;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const settled = useRef(value);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      settled.current = value;
      return;
    }

    const origin = settled.current;
    const delta = value - origin;
    if (delta === 0) return;

    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      // easeOutCubic: fast first, settling at the end, so the final digits are
      // readable rather than still blurring past.
      setShown(origin + delta * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) {
        clearInterval(id);
        settled.current = value;
      }
    }, 16);

    return () => clearInterval(id);
  }, [value, durationMs, reduced]);

  return <Text style={style}>{format(shown)}</Text>;
}

/** A progress bar that grows to its value instead of starting there. */
export function GrowBar({
  value,
  height = 8,
  trackColor,
  fillColor,
}: {
  value: number;
  height?: number;
  trackColor: string;
  fillColor: string;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, value));
  const width = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    width.value = reduced
      ? clamped
      : withDelay(180, withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [clamped, reduced, width]);

  // The percentage string is built inside the worklet, so the interpolation
  // itself stays numeric and runs on the UI thread.
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={{ height, borderRadius: 999, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: fillColor }, fill]} />
    </View>
  );
}
