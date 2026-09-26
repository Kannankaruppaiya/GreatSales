/**
 * The motion and backdrop every bottom sheet shares.
 *
 * Built to feel like iOS rather than like a stock Android modal:
 * - the screen behind blurs and dims as the sheet rises, so the sheet reads as
 *   a layer above the page instead of a grey box pasted over it;
 * - the sheet arrives on a critically-damped spring, not a linear slide;
 * - it follows the finger when dragged down, and lets go past a distance or a
 *   flick — anything less springs it back.
 *
 * Closing runs the exit animation first and only then tells the parent, so
 * the sheet never vanishes mid-frame. The Modal stays mounted until the exit
 * has finished for the same reason.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/** iOS sheet spring: fast, settles without a visible bounce. */
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const OFFSCREEN = 900;

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** The sheet body — the panel itself, styled by the caller. */
  children: React.ReactNode;
}

export function SheetModal({ visible, onClose, children }: SheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  const finishClose = useCallback(() => setMounted(false), []);

  const animateOut = useCallback(
    (then?: () => void) => {
      backdrop.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(
        OFFSCREEN,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (done) => {
          if (!done) return;
          runOnJS(finishClose)();
          if (then) runOnJS(then)();
        },
      );
    },
    [backdrop, translateY, finishClose],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = OFFSCREEN;
      backdrop.value = 0;
      // Next frame, so the first layout is off-screen and the spring runs.
      requestAnimationFrame(() => {
        backdrop.value = withTiming(1, { duration: 260 });
        translateY.value = withSpring(0, SPRING);
      });
    } else if (mounted) {
      animateOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** The user asked to close: animate out, then tell the parent. */
  const requestClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      // Downward only; upward gets a little resistance, like a rubber band.
      translateY.value =
        e.translationY > 0 ? e.translationY : e.translationY / 6;
      backdrop.value = Math.max(0, 1 - Math.max(0, e.translationY) / 400);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, SPRING);
        backdrop.value = withTiming(1, { duration: 180 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <AnimatedBlur
            intensity={Platform.OS === "ios" ? 30 : 45}
            tint="dark"
            // Android blurs only with this method; without it the view is a
            // plain translucent tint.
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.tint} />
        </Animated.View>

        <Pressable
          style={styles.fill}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={requestClose}
        />

        <GestureDetector gesture={pan}>
          <Animated.View style={sheetStyle}>{children}</Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  // A light ink wash over the blur keeps white sheet edges crisp against
  // bright pages.
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,50,68,0.18)",
  },
});
