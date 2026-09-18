/**
 * Bottom sheet, per the Penpot board "13 — Bottom Sheets & Quick Action
 * Launcher".
 *
 * Radius 22 at the top, a grabber, a title row with a close button, and the
 * Sheet elevation from the design. The scrim is the design's own ink at 40–45%.
 *
 * Content is scrollable and the sheet is capped at 85% of the screen, so a long
 * list of options cannot push its confirm button off the bottom — the one way
 * these sheets reliably break.
 */
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { color, elevation, space } from "@/design/tokens";

import { Text } from "./Text";

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned below the scroll area — the confirm button, typically. */
  footer?: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
      />

      <View style={[styles.sheet, { maxHeight: height * 0.85 }]}>
        <View style={styles.grabber} />

        <View style={styles.titleRow}>
          <Text variant="pageTitle" style={styles.title}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
          >
            <X size={19} color={color.muted} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer ? (
          <View
            style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom + space.md }} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(22,36,43,0.42)" },
  sheet: {
    backgroundColor: color.surfaceWhite,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...elevation.sheet,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD9E0",
    alignSelf: "center",
    marginTop: space.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.xxl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  title: { flex: 1 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: space.gutter, paddingBottom: space.md },
  footer: {
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
});
