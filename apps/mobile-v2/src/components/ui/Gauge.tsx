import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The achievement gauge, from Screen 02A Sales Progress.
 *
 * A 180° arc, centre (3162.64, 3580.53) and radius 111.8 in the design's
 * coordinate space, stroked 20 with round caps. The track is #dde7ec; the
 * filled part is SIXTEEN segments carrying a colour ramp from #0c7146 to
 * #34c57d, which is how the design fakes a gradient along a curve.
 *
 * The segments are COMPUTED from that geometry rather than copied. Sixteen
 * hand-pasted paths would be exact at 72% and wrong at every other value, and
 * this reads a real percentage the moment the screen is wired.
 */
const CX = 3162.64;
const CY = 3580.53;
const R = 111.8;
const STROKE = 20;

/** The design's sixteen stops, in order from the start of the arc. */
const RAMP = [
  '#0c7146', '#0f774a', '#117c4d', '#148251', '#178755', '#198d58',
  '#1c935c', '#1f9860', '#219e63', '#24a367', '#27a96b', '#29af6e',
  '#2cb472', '#2fba76', '#31bf79', '#34c57d',
] as const;

/** t of 0 is the left end of the arc, 1 the right. */
function pointAt(t: number) {
  const deg = 180 - t * 180;
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

const arc = (from: number, to: number) => {
  const a = pointAt(from);
  const b = pointAt(to);
  // Always the minor arc, always sweeping clockwise across the top.
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)}A${R},${R} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
};

export function Gauge({
  pct,
  width = 260,
  height = 151,
}: {
  /** 0 to 1. The design shows 0.72. */
  pct: number;
  width?: number;
  height?: number;
}) {
  const filled = Math.max(0, Math.min(1, pct));
  const steps = RAMP.length;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="3032.64 3445.15 260 151">
        <Path d={arc(0, 1)} stroke="#dde7ec" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        {filled > 0 &&
          Array.from({ length: steps }, (_, i) => {
            const from = (filled * i) / steps;
            const to = (filled * (i + 1)) / steps;
            return (
              <Path
                key={i}
                d={arc(from, to)}
                stroke={RAMP[i]}
                strokeWidth={STROKE}
                // Round only at the two ends; butt between segments, or each
                // cap would overhang its neighbour and mottle the ramp.
                strokeLinecap={i === 0 || i === steps - 1 ? 'round' : 'butt'}
                fill="none"
              />
            );
          })}
      </Svg>
    </View>
  );
}
