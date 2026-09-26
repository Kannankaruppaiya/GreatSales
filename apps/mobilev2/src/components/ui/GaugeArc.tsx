/**
 * The semicircular achievement gauge from the Penpot board "02A Screen 02A.1".
 *
 * Geometry is the board's: a 244.6 × 133 arc of radius 111.8 with a 20px
 * round-capped stroke, a #DDE7EC track, and a progress stroke that deepens
 * from #0C7146 at the start to the brand green. The board draws the progress
 * as sixteen short segments to fake that gradient; one path under a linear
 * gradient gives the same result and can be set to any value.
 *
 * `value` is a fraction (0.72 = 72%), not a percentage. Anything past 1 fills
 * the arc — the figure inside it says by how much.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

const W = 244.6;
const H = 133;
const R = 111.8;
const STROKE = 20;
const CX = W / 2;
const CY = R + STROKE / 2;

/** A point on the arc at `t` (0 = left end, 1 = right end). */
const at = (t: number) => {
  const angle = Math.PI * (1 - t);
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
};

const arc = (t: number) => {
  const start = at(0);
  const end = at(t);
  return `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;
};

export function GaugeArc({
  value,
  width = W,
  children,
}: {
  value: number;
  width?: number;
  /** Centred over the arc's hollow — the percentage and its caption. */
  children?: React.ReactNode;
}) {
  const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const height = (H * width) / W;
  return (
    <View style={{ width, height, alignSelf: "center" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor="#0C7146" />
            <Stop offset={1} stopColor="#3BD284" />
          </LinearGradient>
        </Defs>
        <Path
          d={arc(1)}
          stroke="#DDE7EC"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {t > 0.005 ? (
          <Path
            d={arc(t)}
            stroke="url(#gaugeFill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      {children ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: height * 0.4,
            alignItems: "center",
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
