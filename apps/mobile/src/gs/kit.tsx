import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FUTURE_PERIOD_MONTHS,
  currentPeriod,
  monthsBetween,
  periodLabel,
  toPeriod,
} from '@greatsales/shared';
import { C, Tone, shadow } from './theme';
import { initials } from './domain';

/** Month navigation bar — shared period context */
export function MonthBar({
  year,
  month,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const display = periodLabel(toPeriod(year, month));
  // The forward arrow stops at the same horizon the web dropdown offers,
  // rather than letting a stepper walk into 2099 one tap at a time.
  const atCeiling =
    monthsBetween(currentPeriod(), toPeriod(year, month)) >= FUTURE_PERIOD_MONTHS;
  return (
    <View className="flex-row items-center justify-center gap-3 py-1">
      <Pressable onPress={onPrev} hitSlop={12} className="w-7 h-7 rounded-full bg-surface3 border border-line items-center justify-center">
        <Text className="text-muted font-black text-sm">‹</Text>
      </Pressable>
      <Text className="text-[13px] font-extrabold text-ink tracking-tight min-w-[90px] text-center">{display}</Text>
      <Pressable
        onPress={onNext}
        disabled={atCeiling}
        hitSlop={12}
        className={`w-7 h-7 rounded-full bg-surface3 border border-line items-center justify-center ${atCeiling ? 'opacity-30' : ''}`}
      >
        <Text className="text-muted font-black text-sm">›</Text>
      </Pressable>
    </View>
  );
}

/** Inline 2–4 KPI strip for Zone 2 context bar */
export function KpiStrip({ items }: { items: { label: string; value: string; accent?: boolean; alert?: boolean }[] }) {
  return (
    <View className="flex-row bg-surface border border-line rounded-2xl overflow-hidden">
      {items.map((item, i) => (
        <View
          key={item.label}
          className={`flex-1 px-2.5 py-2 items-center ${i > 0 ? 'border-l border-line' : ''} ${
            item.alert ? 'bg-danger-soft/40' : item.accent ? 'bg-brand-soft/30' : ''
          }`}
        >
          <Text className={`text-[15px] font-black tracking-tight ${item.alert ? 'text-danger' : item.accent ? 'text-brand' : 'text-ink'}`} numberOfLines={1}>
            {item.value}
          </Text>
          <Text className="text-[9px] font-extrabold text-muted uppercase tracking-wide mt-0.5" numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Standardised quick-action row for cards */
export function QuickActionRow({ actions }: { actions: { label: string; onPress: () => void; tone?: 'brand' | 'amber' | 'neutral' }[] }) {
  const tClass: Record<string, string> = {
    brand: 'bg-brand-soft border-brand-border/60',
    amber: 'bg-amber-soft border-amber-border/60',
    neutral: 'bg-surface3 border-line/60',
  };
  const tText: Record<string, string> = {
    brand: 'text-brand-dark',
    amber: 'text-amber-dark',
    neutral: 'text-ink2',
  };
  return (
    <View className="flex-row gap-1.5 mt-2">
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} className={`flex-1 py-2.5 rounded-xl border items-center ${tClass[a.tone ?? 'neutral']}`}>
          <Text className={`text-[11px] font-black ${tText[a.tone ?? 'neutral']}`}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * 4-Zone sticky page layout:
 * Zone 1 — Sticky header (title + right action)
 * Zone 2 — Context bar (KpiStrip / MonthBar)
 * Zone 3 — Filter chips row
 * Zone 4 — Scrollable content
 */
export function PageLayout({
  zone1,
  zone2,
  zone3,
  children,
  refreshing = false,
  onRefresh,
}: {
  zone1: ReactNode;
  zone2?: ReactNode;
  zone3?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {zone1}
        {zone2 ? <View className="mb-1.5">{zone2}</View> : null}
        {zone3 ? <View className="pb-2">{zone3}</View> : null}
      </View>
      <ScrollView
        contentContainerClassName="p-4 pb-28 gap-3.5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const BADGE_CLASSES: Record<Tone, { box: string; txt: string; dot: string }> = {
  won: { box: 'bg-brand-soft border-brand-border/60', txt: 'text-brand-dark', dot: 'bg-brand' },
  hot: { box: 'bg-amber-soft border-amber-border/60', txt: 'text-amber-dark', dot: 'bg-amber' },
  open: { box: 'bg-info-soft border-info-border/60', txt: 'text-info-dark', dot: 'bg-info' },
  lost: { box: 'bg-danger-soft border-danger-border/60', txt: 'text-danger-dark', dot: 'bg-danger' },
  neutral: { box: 'bg-surface3 border-line', txt: 'text-muted', dot: 'bg-muted' },
};

const FILL_CLASSES: Record<Tone, string> = {
  won: 'bg-brand',
  hot: 'bg-amber',
  open: 'bg-info',
  lost: 'bg-danger',
  neutral: 'bg-muted',
};

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerClassName="p-4 pb-28 gap-3.5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 p-4 pb-28 gap-3.5">{children}</View>
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 mb-1">
      <View className="flex-1">
        <Text className="text-[22px] font-black text-ink tracking-tight">{title}</Text>
        {subtitle ? <Text className="text-xs text-muted font-medium mt-0.5">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  className = '',
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  className?: string;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={[shadow.card, style]}
      className={`bg-surface rounded-2xl border border-line/80 p-3.5 ${className}`}
    >
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function Badge({
  label,
  tone = 'neutral',
  small,
  showDot = false,
}: {
  label: string;
  tone?: Tone;
  small?: boolean;
  showDot?: boolean;
}) {
  const t = BADGE_CLASSES[tone] || BADGE_CLASSES.neutral;
  return (
    <View className={`self-start flex-row items-center gap-1 rounded-full border ${t.box} ${small ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
      {showDot ? <View className={`w-1.5 h-1.5 rounded-full ${t.dot}`} /> : null}
      <Text numberOfLines={1} className={`font-bold ${t.txt} ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({
  children,
  count,
  action,
}: {
  children: ReactNode;
  count?: string | number;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between mb-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-[15px] font-extrabold text-ink tracking-tight">{children}</Text>
        {count != null ? (
          <View className="bg-surface3 px-2 py-0.5 rounded-full border border-line/50">
            <Text className="text-[11px] text-muted font-bold">{count}</Text>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function Progress({
  value,
  tone = 'won',
  height = 6,
}: {
  value: number;
  tone?: Tone;
  height?: number;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height }} className="rounded-full bg-surface3 overflow-hidden">
      <View
        style={{ width: `${clamped}%`, height: '100%' }}
        className={`rounded-full ${FILL_CLASSES[tone] || FILL_CLASSES.won}`}
      />
    </View>
  );
}

export function Avatar({
  name,
  size = 40,
  color = C.brand,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
      className="items-center justify-center border-2 border-surface shadow-sm"
    >
      <Text className="text-white font-black" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Kpi({
  label,
  value,
  hint,
  accent,
  alert,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  alert?: boolean;
  icon?: ReactNode;
}) {
  return (
    <View
      style={shadow.sm}
      className={`flex-1 min-w-[155px] p-3.5 rounded-xl border bg-surface ${
        alert ? 'border-danger-border/80 bg-danger-soft/30' : accent ? 'border-brand-border/80 bg-brand-soft/30' : 'border-line'
      }`}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-[10px] text-muted font-extrabold uppercase tracking-wider">{label}</Text>
        {icon}
      </View>
      <Text
        numberOfLines={1}
        className={`text-[20px] font-black tracking-tight ${
          alert ? 'text-danger' : accent ? 'text-brand' : 'text-ink'
        }`}
      >
        {value}
      </Text>
      {hint ? (
        <Text numberOfLines={1} className={`text-[11px] font-semibold mt-0.5 ${alert ? 'text-danger/90' : accent ? 'text-brand/90' : 'text-muted'}`}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? C.brand : C.line,
        backgroundColor: active ? C.brand : C.surface,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: active ? '#ffffff' : C.ink2,
        }}
      >
        {label}
      </Text>
      {count != null ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: active ? 'rgba(255,255,255,0.25)' : C.surface3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: active ? '#ffffff' : C.muted,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Btn({
  label,
  onPress,
  variant = 'primary',
  flex,
  small,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost';
  flex?: boolean;
  small?: boolean;
  icon?: ReactNode;
}) {
  let box = 'bg-brand border border-brand shadow-sm';
  let txt = 'text-white';

  if (variant === 'soft') {
    box = 'bg-brand-soft border border-brand-border/60';
    txt = 'text-brand-dark';
  } else if (variant === 'outline') {
    box = 'bg-surface border border-line shadow-sm';
    txt = 'text-ink2';
  } else if (variant === 'danger') {
    box = 'bg-danger-soft border border-danger-border/60';
    txt = 'text-danger';
  } else if (variant === 'ghost') {
    box = 'bg-transparent border border-transparent';
    txt = 'text-muted';
  }

  return (
    <Pressable
      onPress={onPress}
      className={`${flex ? 'flex-1' : ''} flex-row items-center justify-center gap-1 ${small ? 'py-2 px-2' : 'py-3 px-4'} rounded-xl ${box}`}
    >
      {icon}
      <Text className={`${small ? 'text-[11px]' : 'text-xs'} font-black ${txt}`} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}


export function Empty({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="py-8 px-4 items-center justify-center gap-2">
      <View className="w-12 h-12 rounded-2xl bg-surface3 border border-line items-center justify-center mb-1">
        <View className="w-5 h-0.5 bg-faint rounded-full" />
        <View className="w-0.5 h-5 bg-faint rounded-full absolute" />
      </View>
      <Text className="text-xs text-muted font-medium text-center">{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="mt-2 px-3 py-1.5 bg-brand-soft rounded-lg">
          <Text className="text-brand-dark font-bold text-xs">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Footer for a cursor-paginated list.
 *
 * Says how many of the total are on screen. Without it a list that stops at
 * the last fetched page is indistinguishable from a list that has ended —
 * which is exactly how every mobile list behaved when they all requested a
 * hardcoded 100 rows and dropped the cursor.
 */
export function ListFooter({
  shown,
  total,
  loading,
}: {
  shown: number;
  total: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={C.brand} />
      </View>
    );
  }
  if (shown === 0) return null;
  return (
    <View className="py-4 items-center">
      <Text className="text-[11px] font-bold text-muted">
        {shown >= total ? `${total} total` : `Showing ${shown} of ${total}`}
      </Text>
    </View>
  );
}
