import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SolidHome, SolidPipeline, SolidPeople, SolidMore, SolidPlus,
} from '../../design-system/solid-icons';

/**
 * The bottom bar and its raised action, from Screen 01D.
 *
 *   bar    376×52 white, flush to the bottom
 *   icons  21 at y816, labels 10/700 active or 10/500 at #93a9b5
 *   FAB    53 across, centred, its top 17pt ABOVE the bar
 *
 * The two tabs either side of the centre are 109 and 246 apart, not evenly
 * spaced across four: the gap in the middle is the FAB's, and spacing the
 * four tabs evenly would put a label under it.
 *
 * This is a component rather than app/(app)/_layout.tsx because Sales Home is
 * so far the only screen that carries it. It becomes the layout when the
 * second one lands, and the props do not change when it does.
 */
const TABS = [
  { key: 'home', label: 'Home', Icon: SolidHome, x: 11 },
  { key: 'pipeline', label: 'Pipeline', Icon: SolidPipeline, x: 78 },
  { key: 'customers', label: 'Customers', Icon: SolidPeople, x: 215 },
  { key: 'more', label: 'More', Icon: SolidMore, x: 282 },
] as const;

const BOARD_W = 376;
const ACTIVE = '#17a45e';
const IDLE = '#93a9b5';

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
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View className="bg-surface" style={{ height: 52 + bottomInset, paddingBottom: bottomInset }}>
        {TABS.map(({ key, label, Icon, x }) => {
          const on = key === active;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onPressTab?.(key)}
              style={{ position: 'absolute', left: `${(x / BOARD_W) * 100}%`, top: 9, width: 83, alignItems: 'center' }}
            >
              <Icon size={21} color={on ? ACTIVE : IDLE} />
              <Text
                style={{
                  fontFamily: on ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                  fontSize: 10,
                  lineHeight: 13,
                  color: on ? ACTIVE : IDLE,
                  marginTop: 3,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 53 across, its top 17 above the bar - the board puts it at 790 with
          the bar starting at 807. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={onPressFab}
        className="overflow-hidden"
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -26.5,
          bottom: 52 + bottomInset - 36,
          width: 53,
          height: 53,
          borderRadius: 26.5,
        }}
      >
        <LinearGradient
          colors={['#1ba560', '#0e7a4a']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <SolidPlus size={25} color="#ffffff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
