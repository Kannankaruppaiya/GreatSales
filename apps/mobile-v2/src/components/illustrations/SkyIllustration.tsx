import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The sky above "Setting up your workspace", from Screen 01C Preparing.
 *
 * Its colours live here rather than in the theme. They are a PICTURE's
 * palette - four cloud tints, two plane greens, a trail, two spark greens -
 * and promoting them to tokens would put `--cloud-mid` next to `--ink` as
 * though a screen might reach for it. Nothing else in the app uses them.
 *
 * Paths are the design's own, framed by a viewBox in the design's coordinate
 * space, for the same reason as everywhere else: translating them by hand is
 * arithmetic nobody can check against the file.
 */
const BOARD_W = 376;

/** Three overlapping ellipses, which is how the design draws every cloud. */
function Cloud({
  x, y, w, h, parts,
}: {
  x: number; y: number; w: number; h: number;
  parts: { x: number; y: number; w: number; h: number; fill: string }[];
}) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: x, top: y }}>
      {parts.map((p, i) => (
        <Ellipse key={i} cx={p.x + p.w / 2} cy={p.y + p.h / 2} rx={p.w / 2} ry={p.h / 2} fill={p.fill} />
      ))}
    </Svg>
  );
}

export function SkyIllustration({ width = BOARD_W }: { width?: number }) {
  const s = width / BOARD_W;
  const at = (v: number) => v * s;

  return (
    <>
      {/* moon: a 172 disc fading from #d4ebde through #e6f5ee into the page. */}
      <Svg width={at(172)} height={at(172)} style={{ position: 'absolute', left: at(104), top: at(80) }} viewBox="0 0 172 172">
        <Defs>
          <RadialGradient id="moon" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#d4ebde" />
            <Stop offset="0.55" stopColor="#e6f5ee" />
            <Stop offset="1" stopColor="#fbfdfc" />
          </RadialGradient>
        </Defs>
        <Circle cx={86} cy={86} r={86} fill="url(#moon)" />
      </Svg>

      <Cloud
        x={at(73)} y={at(122)} w={at(117)} h={at(47)}
        parts={[
          { x: 1.7, y: 17.2, w: 56.8, h: 28.2, fill: '#e9f2f6' },
          { x: 35.9, y: 4.7, w: 48.5, h: 36, fill: '#f5fafc' },
          { x: 61.8, y: 20.4, w: 50.1, h: 25.1, fill: '#e9f2f6' },
        ]}
      />
      <Cloud
        x={at(192)} y={at(192)} w={at(104)} h={at(42)}
        parts={[
          { x: 1.5, y: 15.4, w: 50.5, h: 25.2, fill: '#e9f2f6' },
          { x: 31.9, y: 4.2, w: 43.1, h: 32.2, fill: '#f5fafc' },
          { x: 55, y: 18.2, w: 44.6, h: 22.4, fill: '#e9f2f6' },
        ]}
      />
      <Cloud
        x={at(231)} y={at(91)} w={at(70)} h={at(29)}
        parts={[
          { x: 1, y: 10.6, w: 34, h: 17.4, fill: '#edf4f7' },
          { x: 21.5, y: 2.9, w: 29, h: 22.2, fill: '#f8fbfd' },
          { x: 37, y: 12.6, w: 30, h: 15.5, fill: '#edf4f7' },
        ]}
      />

      {/* the flight path, and the plane at the end of it */}
      <Svg width={at(195)} height={at(125)} viewBox="3827 470 195 125" style={{ position: 'absolute', left: at(52), top: at(130) }}>
        <Path
          d="M3830.9,589.792C3862.1,591.094,3890.7,579.375,3914.1,558.542C3941.4,533.802,3972.6,496.042,4018.1,477.813"
          stroke="#8fc8ae"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Svg width={at(83)} height={at(68)} viewBox="4001 423 83 68" style={{ position: 'absolute', left: at(226), top: at(83) }}>
        <Path d="M4081.233,425.72L4003.767,458.36L4030.05,466.52Z" fill="#33c07b" />
        <Path d="M4081.233,425.72L4030.05,466.52L4035.583,486.92L4048.033,471.96Z" fill="#0e8a54" />
      </Svg>

      <Svg width={at(8)} height={at(8)} style={{ position: 'absolute', left: at(83), top: at(218) }} viewBox="0 0 8 8">
        <Circle cx={4} cy={4} r={4} fill="#b8deca" opacity={0.75} />
      </Svg>
      <Svg width={at(7)} height={at(7)} style={{ position: 'absolute', left: at(296), top: at(143) }} viewBox="0 0 7 7">
        <Circle cx={3.5} cy={3.5} r={3.5} fill="#b8deca" opacity={0.6} />
      </Svg>
    </>
  );
}

/** The filled tick inside a completed step's 23px disc. */
export function StepCheck({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="3818 742 14 14">
      <Path d="M3820.8,749.2L3823.8,752.2L3829.2,746" stroke="#ffffff" strokeWidth={2.1} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** The step still running: a 19.3 ring with a quarter arc over it. */
export function StepSpinner({ size = 23 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="3814 870 23 23">
      <Circle cx={3825.45} cy={881.45} r={9.65} stroke="#cfe2da" strokeWidth={2.2} fill="none" />
      <Path
        d="M3825.5,871.84C3830.835,871.84,3835.16,876.165,3835.16,881.5"
        stroke="#17a45e"
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** The hand-drawn underline beneath the quotation. */
export function QuoteSwoosh({ width = 130, height = 21 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="3941 1078 130 21">
      <Path
        d="M3944.9,1092.438C3974.8,1099,4032,1089.813,4067.1,1081.938"
        stroke="#17a45e"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
