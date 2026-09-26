/**
 * Pin a customer where the salesperson is standing.
 *
 * The person best placed to pin an account is the one on its premises with a
 * phone, so this is a field action, not a console one. It asks for location
 * only when tapped (the permission is "when in use", never background), takes
 * one high-accuracy fix, and hands it back with its accuracy so the record says
 * how much to trust it. A fix worse than 100 m is offered back rather than
 * saved silently — indoors on a factory floor that is common, and a pin a
 * driver cannot find is worse than none.
 */
import React, { useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { LocateFixed } from "lucide-react-native";

import { Button } from "../ui/Button";
import { Text } from "../ui/Text";
import { color, space } from "@/design/tokens";

export interface PinFix {
  latitude: number;
  longitude: number;
  locationAccuracyM: number | null;
}

const WEAK_FIX_M = 100;

export function LocationPinButton({
  label = "Pin Current Location",
  onPin,
}: {
  label?: string;
  /** Persist the fix. A rejection is shown under the button. */
  onPin: (fix: PinFix) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [weak, setWeak] = useState<PinFix | null>(null);
  const [denied, setDenied] = useState(false);

  async function save(fix: PinFix) {
    setBusy(true);
    try {
      await onPin(fix);
      setWeak(null);
      setMessage(null);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "The location could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    setBusy(true);
    setMessage(null);
    setWeak(null);
    setDenied(false);
    try {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDenied(true);
        setMessage(
          "Location access is off for GreatSales. Turn it on to pin where this customer is.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const fix: PinFix = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        locationAccuracyM:
          position.coords.accuracy == null
            ? null
            : Math.round(position.coords.accuracy),
      };
      if (fix.locationAccuracyM != null && fix.locationAccuracyM > WEAK_FIX_M) {
        setWeak(fix);
        setMessage(
          `This fix is only accurate to about ${fix.locationAccuracyM} m. Step outside and try again, or save it if that is close enough.`,
        );
        return;
      }
      setBusy(false);
      await save(fix);
    } catch {
      setMessage(
        "Your phone could not get a location fix. Check that location is on and try again with a clear view of the sky.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Button
        label={label}
        variant="secondary"
        block
        loading={busy}
        icon={<LocateFixed size={16} color={color.primary} strokeWidth={2} />}
        onPress={capture}
      />
      {message ? (
        <Text variant="caption" tone={weak ? "amber" : "red"}>
          {message}
        </Text>
      ) : null}
      {weak ? (
        <Button
          label={`Save anyway (± ${weak.locationAccuracyM} m)`}
          variant="tertiary"
          block
          onPress={() => void save(weak)}
        />
      ) : null}
      {denied && Platform.OS !== "web" ? (
        <Button
          label="Open Settings"
          variant="tertiary"
          block
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
});
