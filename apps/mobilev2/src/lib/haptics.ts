/**
 * Haptic ticks, the way iOS uses them: a light tap for selection, a medium one
 * for the create launcher, success/error for the outcome of a submit.
 *
 * Every call is fire-and-forget and swallows failure — a phone without a
 * vibration motor, or the web build, must behave exactly as if nothing was
 * asked.
 */
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const enabled = Platform.OS === "ios" || Platform.OS === "android";

export const haptic = {
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => undefined);
  },
  light() {
    if (enabled)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
  },
  medium() {
    if (enabled)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => undefined,
      );
  },
  success() {
    if (enabled)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
  },
  error() {
    if (enabled)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
  },
};
