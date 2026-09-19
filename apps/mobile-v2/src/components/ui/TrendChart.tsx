import { View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

/**
 * Six months of achieved value against the target line, from 02A.3.
 *
 * The plot is the board's 298×120. Four gridlines sit at 0.7, 40.2, 79.8 and
 * 119.3, which the screen labels 24L, 16L, 8L and 0, so a value maps to
 *
 *   y = 119.3 - (v / max) × 118.6
 *
 * and the bar is drawn from there down to 120 - half a stroke past the zero
 * line's centre, so a bar sits ON the line rather than floating above it.
 * That is where the board puts them.
 *
 * Bars are 26 wide at radius 4 with 23 of surface between them. Five are
 * #2cb873 and the sixth is #17a45e: that is the current month picked out, not
 * a sixth category, which is why it is `currentIndex` and not a palette.
 *
 * Values are REAL units, not plot units - the caller passes lakhs and a
 * maximum, because an API can produce the first and never the second. The
 * axis labels and the legend are the SCREEN's for the same reason the plot is
 * a component: the design puts them outside this box.
 *
 * react-native-svg renders to one opaque node, so the plot carries an
 * accessibilityLabel reading the series out - without it this chart is
 * silence to a screen reader. Identity is not colour-alone either: the
 * design's legend names both series and the month labels name every bar.
 */
const W = 298;
const H = 120;
const BAR_W = 26;
const BASE = 120;

/** Bar lefts, straight off the board. */
const BAR_X = [5.2, 54.7, 104.1, 153.6, 203, 252.5];
/** Gridline centres: the top one is `max`, the bottom one is zero. */
const GRID_Y = [0.7, 40.2, 79.8, 119.3];
const ZERO = GRID_Y[3];
const SPAN = GRID_Y[3] - GRID_Y[0];

/** The target line, traced from the board and re-pointed into the plot box. */
const TARGET_D =
  'M5.21,99.78C52.05,91.96,80.68,78.91,117.12,68.48C169.17,55.43,223.83,34.56,292.80,8.48';

export function TrendChart({
  values,
  labels,
  max,
  unit = '',
  currentIndex = values.length - 1,
  accessibilityLabel,
}: {
  values: number[];
  /** Month names, for the accessible reading. */
  labels: string[];
  /** What the top gridline means. The screen labels it; this scales by it. */
  max: number;
  /** Appended to each value in the accessible reading, e.g. "lakh". */
  unit?: string;
  currentIndex?: number;
  accessibilityLabel?: string;
}) {
  const described =
    accessibilityLabel ??
    `Achieved value by month. ${labels
      .map((l, i) => `${l}, ${values[i]}${unit ? ` ${unit}` : ''}`)
      .join('. ')}.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={described} style={{ width: '100%' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {GRID_Y.map((y) => (
          <Line key={y} x1={0} y1={y} x2={W} y2={y} stroke="#e8eff2" strokeWidth={1} />
        ))}
        {values.map((v, i) => {
          const y = ZERO - (v / max) * SPAN;
          return (
            <Rect
              key={labels[i]}
              x={BAR_X[i]}
              y={y}
              width={BAR_W}
              height={Math.max(0, BASE - y)}
              rx={4}
              fill={i === currentIndex ? '#17a45e' : '#2cb873'}
            />
          );
        })}
        <Path d={TARGET_D} stroke="#7fd3a8" strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}
