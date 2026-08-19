import React from 'react';
import { View, Text } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function HomeIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.9, color, lineHeight: size, fontWeight: '700' }}>⌂</Text>
    </View>
  );
}

export function ChartIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 2 }}>
      <View style={{ width: size * 0.22, height: size * 0.45, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ width: size * 0.22, height: size * 0.85, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ width: size * 0.22, height: size * 0.65, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

export function TargetIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.85, height: size * 0.85, borderRadius: size * 0.45, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: size * 0.2, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function CheckCircleIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.55, color, fontWeight: '900', marginTop: -1 }}>✓</Text>
    </View>
  );
}

export function GridIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: 2, backgroundColor: color }} />
      <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: 2, backgroundColor: color }} />
      <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: 2, backgroundColor: color }} />
      <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}

export function WalletIcon({ size = 20, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size * 0.8, borderWidth: 2, borderColor: color, borderRadius: 4, padding: 1, justifyContent: 'center' }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, alignSelf: 'flex-end', marginRight: 2 }} />
    </View>
  );
}

export function PhoneIcon({ size = 16, color = '#0f172a' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.85, color, fontWeight: '700' }}>✆</Text>
    </View>
  );
}

export function WhatsAppIcon({ size = 16, color = '#25D366' }: IconProps) {
  return (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.65, color: '#ffffff', fontWeight: '900' }}>W</Text>
    </View>
  );
}

export function SearchIcon({ size = 16, color = '#64748b' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.85, color, fontWeight: '700' }}>🔍</Text>
    </View>
  );
}

export function PlusIcon({ size = 16, color = '#ffffff' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.95, color, fontWeight: '900', lineHeight: size }}>+</Text>
    </View>
  );
}

export function CalendarIcon({ size = 14, color = '#64748b' }: IconProps) {
  return (
    <View style={{ width: size, height: size * 0.9, borderWidth: 1.5, borderColor: color, borderRadius: 3, padding: 1 }}>
      <View style={{ width: '100%', height: 2, backgroundColor: color, marginBottom: 1 }} />
    </View>
  );
}

export function TrendUpIcon({ size = 16, color = '#059669' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.85, color, fontWeight: '900' }}>↗</Text>
    </View>
  );
}

export function BuildingIcon({ size = 16, color = '#64748b' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.85, color, fontWeight: '700' }}>🏢</Text>
    </View>
  );
}

export function SparklesIcon({ size = 16, color = '#d97706' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.85, color, fontWeight: '700' }}>✨</Text>
    </View>
  );
}

export function ChevronRightIcon({ size = 16, color = '#94a3b8' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.9, color, fontWeight: '700' }}>›</Text>
    </View>
  );
}
