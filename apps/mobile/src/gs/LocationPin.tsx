import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { C } from '@/gs/theme';
import { mapsUrl } from '@greatsales/shared';

export interface Pin {
  latitude: number;
  longitude: number;
  locationAccuracyM: number | null;
}

/**
 * Capture and share where a customer physically is.
 *
 * The salesperson stands at the customer's gate and taps "Pin live location";
 * the fix is taken there and then, because a location typed later from the
 * office is the problem this replaces. Sharing hands the OS share sheet an
 * ordinary maps link, so a driver receives something their own phone opens —
 * they are not users of this app and never will be.
 */
export function LocationPin({
  value,
  accuracyM,
  pinnedAt,
  pinnedByName,
  customerName,
  onChange,
  disabled,
}: {
  value: { latitude: number; longitude: number } | null;
  accuracyM?: number | null;
  pinnedAt?: string | null;
  pinnedByName?: string | null;
  customerName?: string;
  onChange: (pin: Pin | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const url = mapsUrl(value?.latitude, value?.longitude);

  const capture = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Denial is a settings problem, not a retry problem — saying "try
        // again" would send them round the same loop.
        Alert.alert(
          'Location permission needed',
          'GreatSales needs location access to pin where this customer is. Turn it on in Settings > GreatSales > Location.',
          [{ text: 'Not now' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
        );
        return;
      }

      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const accuracy =
        fix.coords.accuracy == null ? null : Math.round(fix.coords.accuracy);

      // A fix good to half a kilometre is the phone guessing from cell towers,
      // which is worse than useless as a delivery address — so say so rather
      // than saving it quietly.
      if (accuracy != null && accuracy > 100) {
        Alert.alert(
          'Weak GPS signal',
          `This fix is only accurate to about ${accuracy}m. Step outside and try again, or save it anyway if that is close enough.`,
          [
            { text: 'Try again' },
            {
              text: 'Save anyway',
              onPress: () =>
                onChange({
                  latitude: fix.coords.latitude,
                  longitude: fix.coords.longitude,
                  locationAccuracyM: accuracy,
                }),
            },
          ],
        );
        return;
      }

      onChange({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        locationAccuracyM: accuracy,
      });
    } catch {
      Alert.alert(
        'Could not get location',
        'Your phone could not get a GPS fix. Check that location is switched on and you have a clear view of the sky.',
      );
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!url) return;
    const label = customerName ? `${customerName} — location` : 'Customer location';
    // `message` carries the link on both platforms; iOS also takes `url` so the
    // sheet offers maps apps directly rather than only text targets.
    await Share.share({ message: `${label}\n${url}`, url });
  };

  return (
    <View style={{ gap: 8 }}>
      {value ? (
        <View
          style={{
            backgroundColor: C.brandSoft,
            borderColor: C.brandBorder,
            borderWidth: 1,
            borderRadius: 10,
            padding: 10,
            gap: 2,
          }}
        >
          <Text style={{ color: C.brandDark, fontWeight: '700', fontSize: 13 }}>
            Location pinned
          </Text>
          <Text style={{ color: C.body, fontSize: 12 }}>
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            {accuracyM != null ? ` · ±${accuracyM}m` : ''}
          </Text>
          {pinnedAt ? (
            <Text style={{ color: C.muted, fontSize: 11 }}>
              {new Date(pinnedAt).toLocaleDateString()}
              {pinnedByName ? ` · ${pinnedByName}` : ''}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: C.muted, fontSize: 12 }}>
          No location pinned yet. Pin it while you are at the customer's place.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <PinBtn
          label={busy ? 'Getting GPS…' : value ? 'Re-pin here' : 'Pin live location'}
          onPress={capture}
          disabled={disabled || busy}
          busy={busy}
          tone="brand"
        />
        {url ? (
          <>
            <PinBtn label="Share" onPress={share} disabled={disabled} tone="neutral" />
            <PinBtn
              label="Open map"
              onPress={() => Linking.openURL(url)}
              disabled={disabled}
              tone="neutral"
            />
            <PinBtn
              label="Clear"
              onPress={() => onChange(null)}
              disabled={disabled}
              tone="danger"
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

function PinBtn({
  label,
  onPress,
  disabled,
  busy,
  tone,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone: 'brand' | 'neutral' | 'danger';
}) {
  const bg = tone === 'brand' ? C.brand : tone === 'danger' ? C.redSoft : C.surface3;
  const fg = tone === 'brand' ? '#fff' : tone === 'danger' ? C.redDark : C.body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
