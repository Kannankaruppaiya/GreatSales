import { View, Text, Pressable } from 'react-native';
import {
  HouseSolid, MonitorOutline, GroupSolid, EllipsisGlyph, PlusStroke,
} from '../illustrations/outline-glyphs';

/**
 * The bottom bar the 02B flow draws. NOT the one on Screen 01D.
 *
 * Every measurement differs, so this is a second component rather than a prop
 * on the first:
 *
 *                      01D / 02A        02B
 *   bar height         52               79, with a 1px #e6eff3 rule on top
 *   idle colour        #93a9b5          #8aa3b0
 *   idle label         10/500           10/600
 *   tab centres        51 119 255 323   42 117 259 334
 *   raised action      53, gradient     52 flat #17a45e in a 57 white ring
 *
 * Two of them being close is the reason to keep them apart: a shared
 * component with an eight-field variant is how one screen's bar quietly
 * becomes the other's.
 *
 * The white ring is what lets the action overlap the bar's top rule without
 * the rule cutting across it, which is what the board draws.
 */
const TABS = [
  { key: 'home', label: 'Home', Icon: HouseSolid, icX: 30, lbX: 3 },
  { key: 'pipeline', label: 'Pipeline', Icon: MonitorOutline, icX: 106, lbX: 78 },
  { key: 'customers', label: 'Customers', Icon: GroupSolid, icX: 247, lbX: 220 },
  { key: 'more', label: 'More', Icon: EllipsisGlyph, icX: 323, lbX: 295 },
] as const;

const BOARD_W = 376;
const ACTIVE = '#17a45e';
const IDLE = '#8aa3b0';

export function TabBarTall({
  active = 'home',
  onPressTab,
  onPressFab,
  bottomInset = 0,
}: {
  active?: (typeof TABS)[number]['key'];
  onPressTab?: (key: string) => void;
  onPressFab?: () => void;
  bottomInset?: number;
}) {
  const pct = (x: number) => `${(x / BOARD_W) * 100}%` as const;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View className="bg-surface" style={{ height: 79 + bottomInset, paddingBottom: bottomInset }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: '#e6eff3' }} />
        {TABS.map(({ key, label, Icon, icX, lbX }) => {
          const on = key === active;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onPressTab?.(key)}
              hitSlop={8}
            >
              <View style={{ position: 'absolute', left: pct(icX), top: 15 }}>
                <Icon size={23} color={on ? ACTIVE : IDLE} />
              </View>
              <Text
                style={{
                  position: 'absolute', left: pct(lbX), top: 41, width: 78, textAlign: 'center',
                  fontFamily: on ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                  fontSize: 10, lineHeight: 14,
                  color: on ? ACTIVE : IDLE,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 52 across in a 57 white ring, its centre 25 above the bar's top. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={onPressFab}
        className="items-center justify-center"
        style={{
          position: 'absolute', left: '50%', marginLeft: -28.5,
          bottom: 79 + bottomInset - 49,
          width: 57, height: 57, borderRadius: 28.5, backgroundColor: '#ffffff',
        }}
      >
        <View
          className="items-center justify-center"
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#17a45e' }}
        >
          <PlusStroke />
        </View>
      </Pressable>
    </View>
  );
}
