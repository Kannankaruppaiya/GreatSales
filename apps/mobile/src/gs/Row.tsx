/**
 * The list row. One component, every list.
 *
 * The old rows were web table rows redrawn as cards: the customer card carried
 * nine fields and stood 180px tall, so three of four hundred and seventeen
 * accounts fitted on a screen — and of those nine fields, six read the same on
 * every single row ("Others · General Engineering", "Silver", "Green Zone",
 * "No dues", "30 Days Credit"). A value that never varies is not information,
 * it is furniture, and on a 375pt screen furniture costs you the next row.
 *
 * So this row takes four slots and no more:
 *
 *     ┃ TITLE ─────────────────────────────── VALUE
 *     ┃ subtitle ──────────────────────────── meta
 *
 * Title and value identify the record; subtitle and meta say how it differs
 * from the row above it. Everything constant belongs on the detail screen.
 *
 * Status is a 3px bar down the leading edge rather than a chip, because a chip
 * costs a line of height and, once every row has one, stops being a signal.
 *
 * Actions live behind a swipe. Four little buttons per row (the payments screen
 * had M1–M4) put sixteen targets on a screen where a thumb covers three of
 * them, and you cannot see which one you hit because your own thumb is over it.
 */
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { ChevronRightIcon } from '@/gs/icons';
import { NUM, useC, type Palette } from '@/gs/theme';

export type RowTone = 'brand' | 'amber' | 'danger' | 'info' | 'violet' | 'none';

function edge(p: Palette, tone: RowTone): string | undefined {
  switch (tone) {
    case 'brand':
      return p.brand;
    case 'amber':
      return p.amber;
    case 'danger':
      return p.red;
    case 'info':
      return p.blue;
    case 'violet':
      return p.violet;
    default:
      return undefined;
  }
}

export interface RowAction {
  label: string;
  tone: RowTone;
  onPress: () => void;
  icon?: (color: string, size: number) => ReactNode;
}

export interface RowProps {
  title: string;
  /** Right of the title. A ₹ amount, a count, a date — one thing. */
  value?: string;
  /** What makes this row different from the one above it. */
  subtitle?: string;
  /** Right of the subtitle. The next action or the age. */
  meta?: string;
  /** Paints the leading edge bar. `none` leaves it off. */
  tone?: RowTone;
  /** Two letters, or an icon. Optional — a list of one kind of thing rarely needs it. */
  leading?: ReactNode;
  onPress?: () => void;
  /** Revealed by swiping the row leftwards. */
  actions?: RowAction[];
  /** True when `value` should read as an alert rather than a fact. */
  valueAlert?: boolean;
  /** Hides the chevron on rows that do not open anything. */
  chevron?: boolean;
}

const ROW_MIN_HEIGHT = 72;
const ACTION_WIDTH = 76;

export function Row({
  title,
  value,
  subtitle,
  meta,
  tone = 'none',
  leading,
  onPress,
  actions,
  valueAlert = false,
  chevron = true,
}: RowProps) {
  const p = useC();
  const bar = edge(p, tone);

  const body = (
    <Pressable
      onPress={
        onPress &&
        (() => {
          void Haptics.selectionAsync();
          onPress();
        })
      }
      style={({ pressed }) => ({
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? p.surface2 : p.surface,
        paddingRight: 12,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
      })}
    >
      {/* The status bar. Full-bleed to the row's height so a scan down the
          left edge reads as a column of states, not a column of dots. */}
      <View
        style={{
          width: 3,
          alignSelf: 'stretch',
          backgroundColor: bar ?? 'transparent',
        }}
      />

      {leading ? <View style={{ paddingLeft: 13, paddingRight: 3 }}>{leading}</View> : null}

      <View style={{ flex: 1, paddingLeft: leading ? 8 : 13, paddingVertical: 12, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 15,
              lineHeight: 20,
              color: p.ink,
            }}
          >
            {title}
          </Text>
          {value ? (
            <Text
              numberOfLines={1}
              style={{
                ...NUM,
                fontFamily: 'PlusJakartaSans_700Bold',
                fontSize: 15,
                lineHeight: 20,
                color: valueAlert ? p.red : p.ink,
              }}
            >
              {value}
            </Text>
          ) : null}
        </View>

        {subtitle || meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'PlusJakartaSans_400Regular',
                fontSize: 13,
                lineHeight: 17,
                color: p.muted,
              }}
            >
              {subtitle}
            </Text>
            {meta ? (
              <Text
                numberOfLines={1}
                style={{
                  ...NUM,
                  fontFamily: 'PlusJakartaSans_600SemiBold',
                  fontSize: 12,
                  lineHeight: 17,
                  color: p.faint,
                }}
              >
                {meta}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {chevron && onPress ? <ChevronRightIcon size={16} color={p.faint} /> : null}
    </Pressable>
  );

  if (!actions?.length) return body;

  return (
    <Swipeable
      friction={1.6}
      rightThreshold={32}
      overshootRight={false}
      onSwipeableWillOpen={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      renderRightActions={() => (
        <View style={{ flexDirection: 'row' }}>
          {actions.map((a) => {
            const bg = edge(p, a.tone) ?? p.surface3;
            return (
              <Pressable
                key={a.label}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  a.onPress();
                }}
                style={{
                  width: ACTION_WIDTH,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: bg,
                }}
              >
                {a.icon?.(p.white, 18)}
                <Text
                  style={{
                    fontFamily: 'PlusJakartaSans_700Bold',
                    fontSize: 11,
                    color: p.white,
                  }}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {body}
    </Swipeable>
  );
}

/** Two initials on a tinted disc — the cheapest leading element that still scans. */
export function RowAvatar({ text, tone = 'none' }: { text: string; tone?: RowTone }) {
  const p = useC();
  const fg = edge(p, tone) ?? p.brand;
  const initials = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.surface3,
      }}
    >
      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: fg }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * The loading state. A skeleton rather than a spinner: it holds the shape the
 * content is about to take, so the list does not jump when data lands, and it
 * reads as "nearly there" instead of "something is happening somewhere".
 */
export function RowSkeleton({ count = 8 }: { count?: number }) {
  const p = useC();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            minHeight: ROW_MIN_HEIGHT,
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: p.line,
            opacity: 1 - i * 0.08,
          }}
        >
          <View
            style={{ height: 13, width: '62%', borderRadius: 4, backgroundColor: p.surface3 }}
          />
          <View
            style={{ height: 11, width: '40%', borderRadius: 4, backgroundColor: p.surface3 }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * What a list says when it is genuinely empty. Never an em dash — a dash tells
 * the user a value is missing without telling them what to do about it, and the
 * old screens were full of `Close by —` and `Next: —`.
 */
export function RowEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const p = useC();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 6 }}>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 15,
          color: p.ink2,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: p.muted,
            textAlign: 'center',
          }}
        >
          {hint}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            action.onPress();
          }}
          style={{
            marginTop: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: p.brandSoft,
            borderWidth: 1,
            borderColor: p.brandBorder,
          }}
        >
          <Text
            style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: p.brandDark }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
