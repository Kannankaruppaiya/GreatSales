import Svg, { Defs, LinearGradient, Stop, Rect, Path, Ellipse, ClipPath, G } from 'react-native-svg';

/**
 * The hills, the road and the destination pin, from Screen 01B-E.
 *
 * Twenty-eight shapes in the design and twenty-eight here, at the board's own
 * coordinates inside the scene's 339×328 box. It is a picture, so its palette
 * lives here rather than in the theme - eight greens, five blue-greys, a
 * road grey and a dashed-line yellow, none of which any screen reaches for.
 *
 * It is clipped by the same 21 radius as the sky it sits on, because the
 * ground runs past the bottom of the box in the design and is cut off by it.
 *
 * `preserveAspectRatio="none"` is deliberate: the scene fills whatever width
 * the card has, and nothing in it is measured against anything outside it.
 */
const W = 339;
const H = 328;

/** A peak: the sunlit face, the shaded face, and the snow cap. */
const PEAKS = [
  { lit: 'M0,197.84L52.83,93.71L105.66,197.84Z', litFill: '#cbdeea',
    shade: 'M52.83,93.71L105.66,197.84L52.83,197.84Z', shadeFill: '#b9cede',
    cap: 'M52.83,93.71L70.44,127.56L61.64,122.35L52.83,130.16L44.03,122.35L35.22,127.56Z', capFill: '#f7fbfd' },
  { lit: 'M72.64,197.84L132.08,67.68L191.51,197.84Z', litFill: '#c3d8e7',
    shade: 'M132.08,67.68L191.51,197.84L132.08,197.84Z', shadeFill: '#afc6d9',
    cap: 'M132.08,67.68L151.89,106.73L141.98,100.22L132.08,109.33L122.17,100.22L112.27,106.73Z', capFill: '#ffffff' },
  { lit: 'M162.9,197.84L220.13,96.32L277.36,197.84Z', litFill: '#cbdeea',
    shade: 'M220.13,96.32L277.36,197.84L220.13,197.84Z', shadeFill: '#b9cede',
    cap: 'M220.13,96.32L237.74,130.16L228.94,123.65L220.13,131.46L211.32,123.65L202.52,130.16Z', capFill: '#f7fbfd' },
  { lit: 'M244.34,197.84L292.77,117.14L339,197.84Z', litFill: '#d5e5ef',
    shade: 'M292.77,117.14L339,197.84L292.77,197.84Z', shadeFill: '#c4d8e6',
    cap: null, capFill: null },
];

/** Conifers: each is one triangle, darker the nearer it is. */
const TREES = [
  { d: 'M24.21,294.16L35.22,255.11L46.23,294.16Z', fill: '#3e8c63' },
  { d: 'M41.82,304.57L50.63,273.33L59.44,304.57Z', fill: '#4e9c6f' },
  { d: 'M11.01,307.18L19.81,278.54L28.62,307.18Z', fill: '#4e9c6f' },
  { d: 'M224.53,268.13L233.34,239.49L242.14,268.13Z', fill: '#478f68' },
  { d: 'M277.36,278.54L288.37,239.49L299.38,278.54Z', fill: '#3e8c63' },
  { d: 'M297.18,288.95L305.98,257.71L314.79,288.95Z', fill: '#4e9c6f' },
  { d: 'M259.75,294.16L268.56,265.52L277.36,294.16Z', fill: '#4e9c6f' },
];

export function VillageScene({ width = W, height = H }: { width?: number | string; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="vsSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.5" stopColor="#ddeef8" />
          <Stop offset="1" stopColor="#eef7fb" />
        </LinearGradient>
        <ClipPath id="vsClip">
          <Rect x={0} y={0} width={W} height={H} rx={21} />
        </ClipPath>
      </Defs>

      <G clipPath="url(#vsClip)">
        <Rect x={0} y={0} width={W} height={H} fill="url(#vsSky)" />
        <Ellipse cx={270.76} cy={54.67} rx={37.42} ry={31.24} fill="#ffffff" opacity={0.55} />

        {PEAKS.map((p) => (
          <G key={p.lit}>
            <Path d={p.lit} fill={p.litFill} />
            <Path d={p.shade} fill={p.shadeFill} />
            {p.cap ? <Path d={p.cap} fill={p.capFill!} /> : null}
          </G>
        ))}

        {/* The haze that separates the peaks from the ground. */}
        <Rect x={0} y={169.21} width={335.7} height={36.44} fill="#ffffff" opacity={0.45} />

        <Path
          d="M0,328L0,205.65C52.83,179.62 101.26,216.06 154.09,197.84C206.92,179.62 264.16,210.86 339,184.82L339,328Z"
          fill="#a8d5b8"
        />
        <Path
          d="M0,328L0,255.11C68.24,226.48 136.48,268.13 202.52,242.09C257.55,221.27 299.38,247.3 339,234.29L339,328Z"
          fill="#79c093"
        />

        {/* The road, and its dashed centre line. */}
        <Path
          d="M41.82,328L79.25,328C110.06,283.75 90.25,255.11 138.68,242.09C182.71,230.38 224.53,244.7 268.56,216.06L264.16,205.65C217.93,231.68 173.9,218.67 129.88,231.68C74.84,247.3 92.45,281.14 41.82,328Z"
          fill="#e9ecee"
        />
        <Path
          d="M60.54,328C92.45,281.14 77.05,260.32 134.28,247.3C178.31,236.89 220.13,249.91 266.36,210.86"
          stroke="#f0c43f"
          strokeWidth={1.6}
          opacity={0.9}
          fill="none"
        />

        <Path
          d="M0,328L0,301.97C74.84,286.35 162.9,312.38 228.94,296.76C283.97,283.75 316.99,296.76 339,288.95L339,328Z"
          fill="#5fae7e"
        />

        {TREES.map((t) => <Path key={t.d} d={t.d} fill={t.fill} />)}

        {/* The destination, at the far end of the road: its shadow, the pin
            and the pin's hole. */}
        <Ellipse cx={286.17} cy={239.5} rx={9.9} ry={3.9} fill="#3e8c63" opacity={0.28} />
        <Path
          d="M286.17,190.03C278.88,190.03 272.96,197.03 272.96,205.65C272.96,217.36 286.17,234.29 286.17,234.29C286.17,234.29 299.38,217.36 299.38,205.65C299.38,197.03 293.46,190.03 286.17,190.03Z"
          fill="#17a45e"
        />
        <Ellipse cx={286.17} cy={205.65} rx={4.85} ry={5.72} fill="#ffffff" />
      </G>
    </Svg>
  );
}

/**
 * The seven pieces of confetti behind 01B-E's tick: three diamonds and four
 * discs, scattered in a 156×135 box. Purely decorative, so the caller marks
 * the group it sits in rather than this describing itself.
 */
const CONFETTI_DIAMONDS = [
  { d: 'M18.2,28.56L24.05,34.4L18.2,40.24L12.35,34.4Z', fill: '#f2c744' },
  { d: 'M137.8,33.75L143.65,39.59L137.8,45.43L131.95,39.59Z', fill: '#4dd4a0' },
  { d: 'M130,106.44L135.85,112.28L130,118.13L124.15,112.28Z', fill: '#2cb873' },
];
const CONFETTI_DOTS = [
  { cx: 23.4, cy: 103.85, r: 4.68, fill: '#4dd4a0' },
  { cx: 78, cy: 7.79, r: 4.16, fill: '#f2c744' },
  { cx: 10.4, cy: 70.1, r: 3.64, fill: '#b8e4cd' },
  { cx: 145.6, cy: 75.29, r: 3.64, fill: '#b8e4cd' },
];

export function Confetti({ width = 156, height = 135 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 156 135">
      {CONFETTI_DIAMONDS.map((c) => <Path key={c.d} d={c.d} fill={c.fill} />)}
      {CONFETTI_DOTS.map((c) => <Ellipse key={`${c.cx}`} cx={c.cx} cy={c.cy} rx={c.r} ry={c.r} fill={c.fill} />)}
    </Svg>
  );
}
