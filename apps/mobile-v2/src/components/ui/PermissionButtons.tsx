import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';

/**
 * The three buttons the location-permission screens are built from.
 *
 * 01B-C, 01B-D and 01B-INFO each end in a stack of these and draw them
 * identically: 329 wide at radius 13, the primary 52 tall in the brand
 * gradient, the outlined one 52 with a 1.4 brand rule, and the quiet one 49
 * on #eff3f5 with a 17/600 label in #53707e.
 *
 * They are NOT the Button on design-system board 08, which is 46/12 with a
 * 13/700 label and appears on none of these screens. The screens win.
 *
 * Each centres its row, so a leading glyph and a label of any length stay
 * together in the middle. The board places those two at fixed x instead, but
 * only because the design's own text has one length; centring is what keeps
 * it right when a translation does not.
 */
function Row({ icon, label, color, size }: { icon?: ReactNode; label: string; color: string; size: number }) {
  return (
    <View className="flex-row items-center justify-center" style={{ flex: 1 }}>
      {icon ? <View style={{ marginRight: 9 }}>{icon}</View> : null}
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: size, lineHeight: size * 1.35, color }}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryPill({
  label, icon, onPress, size = 17,
}: { label: string; icon?: ReactNode; onPress?: () => void; size?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="overflow-hidden" style={{ height: 52, borderRadius: 13 }}>
      <LinearGradient
        colors={['#0e7a4a', '#1ba560']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      >
        <Row icon={icon} label={label} color="#ffffff" size={size} />
      </LinearGradient>
    </Pressable>
  );
}

export function OutlinePill({
  label, icon, onPress, size = 16,
}: { label: string; icon?: ReactNode; onPress?: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ height: 52, borderRadius: 13, backgroundColor: '#ffffff', borderWidth: 1.4, borderColor: '#17a45e' }}
    >
      <Row icon={icon} label={label} color="#0e7a4a" size={size} />
    </Pressable>
  );
}

export function QuietPill({
  label, onPress, size = 17,
}: { label: string; onPress?: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="items-center justify-center"
      style={{ height: 49, borderRadius: 13, backgroundColor: '#eff3f5' }}
    >
      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: size, lineHeight: size * 1.35, color: '#53707e' }}>
        {label}
      </Text>
    </Pressable>
  );
}
