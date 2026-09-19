import { View, Text, Pressable } from 'react-native';
import {
  HouseSolid, MonitorOutline, GroupSolid, EllipsisGlyph, PlusStroke,
} from '../illustrations/outline-glyphs';

/**
 * The app's ONE bottom bar.
 *
 * The design has two. Screens 01D and 02A draw a 52-tall bar with an idle
 * grey of #93a9b5, 10/500 labels, tab centres at 51/119/255/323 and a
 * gradient action; 02B onward draws a 79-tall bar with a top rule, #8aa3b0,
 * 10/600 labels, centres at 42/117/259/334 and a flat action inside a white
 * ring. Same four tabs, same order, same meaning.
 *
 * That is drift between two generations of the design, not two controls. A
 * tab bar is the one piece of chrome a person sees on every screen, and one
 * that changes height and colour as they move between them reads as a bug
 * whatever the boards say - so this app has one bar, and it is the LATER
 * one, because every screen from 02B on draws it and the two that do not are
 * the older pair.
 *
 * The consequence is recorded rather than hidden: design/screens/
 * 01d-sales-home.json and 02a-4-insights.json no longer pin their nav
 * labels, and each says why. That is the only place in this app where a
 * screen deliberately does not match its board.
 *
 *   bar     79 tall, white, with a 1px #e6eff3 rule across the top
 *   tabs    icon 23 at y15, label 10/600 at y41 in a 78-wide centred box
 *   colours #17a45e when selected, #8aa3b0 otherwise
 *   action  52 across, flat #17a45e, inside a 57 white ring so the bar's
 *           rule does not cut across it
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

export function TabBar({
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
