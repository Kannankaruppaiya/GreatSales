/**
 * Ask before something that cannot be undone.
 *
 * `Alert.alert` with buttons is a native dialog; on react-native-web it does
 * nothing at all, so a delete confirmed through it could never be confirmed in
 * the web build. The browser's own `confirm` stands in there.
 */
import { Alert, Platform } from "react-native";

export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === "web") {
    const ok =
      typeof globalThis.confirm === "function"
        ? globalThis.confirm(`${options.title}\n\n${options.message}`)
        : false;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        {
          text: options.cancelLabel ?? "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: options.confirmLabel,
          style: options.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
