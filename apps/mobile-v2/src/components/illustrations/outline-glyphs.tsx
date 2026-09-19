import Svg, { Path, Rect, Ellipse } from 'react-native-svg';

/**
 * The OUTLINE glyphs, which the 02B flow draws and the 01B/01D/02A screens do
 * not.
 *
 * Both families are real. Board "07 — Icon Library" specifies Lucide at
 * stroke 2 with round caps, and the earlier screens ignore it and draw solid
 * fills - which is why src/components/illustrations/glyphs.tsx exists. From
 * 02B on, the screens draw the board's outline family instead, at stroke 2 in
 * #17a45e. So "screens win" still holds; which family wins depends on the
 * flow, and this file is the outline one traced from the screens rather than
 * pulled from lucide-react-native, so a Lucide upgrade cannot move it.
 *
 * Every path arrives in its group's own box - the extractor subtracts the
 * group origin - so the viewBox is the box and nothing is offset by five
 * thousand.
 *
 * Two of the 02B row glyphs are NOT outlines and are in here anyway, beside
 * the rows they belong to: the bar chart is three filled rects and the
 * ellipsis is three filled discs. The design mixes them on one list; pulling
 * them into the solid file would scatter one screen's icons across two.
 */
type P = { size?: number; color?: string };
const BRAND = '#17a45e';
const MUTED = '#8aa3b0';

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

const PHONE_D =
  'M6.23,3.35L9.1,3.35L10.54,7.19L8.63,8.63C9.7,11.23 11.77,13.3 14.38,14.38L15.81,12.46L19.65,13.9L19.65,16.77C19.65,17.31 19.42,17.83 19.02,18.2C18.62,18.56 18.08,18.74 17.54,18.69C10.72,17.64 5.36,12.28 4.31,5.46C4.26,4.92 4.44,4.38 4.8,3.98C5.17,3.58 5.69,3.35 6.23,3.35L6.23,3.35';

const FILE_BODY_D =
  'M13.42,3.35L7.19,3.35C6.39,3.35 5.75,4 5.75,4.79L5.75,18.21C5.75,19 6.39,19.65 7.19,19.65L15.81,19.65C16.61,19.65 17.25,19 17.25,18.21L17.25,7.19L13.42,3.35';
const FILE_FOLD_D = 'M13.42,3.35L13.42,7.19L17.25,7.19';
const FILE_RULES_D = 'M8.63,11.5L14.38,11.5M8.63,15.33L12.46,15.33';

const FUNNEL_D = 'M4.5,5.63L22.5,5.63L15.53,13.95L15.53,21.38L11.47,18.9L11.47,13.95L4.5,5.63';

const ALERT_TRI_D = 'M10.5,3.67L18.38,16.98L2.63,16.98L10.5,3.67';
const ALERT_BAR_D = 'M10.5,8.75L10.5,12.25';
const ALERT_DOT_D = 'M10.5,14.52L10.51,14.52';

const HOUSE_SOLID_D =
  'M11.5,2.49L1.73,10.73L4.6,10.73L4.6,20.51L10.35,20.51L10.35,14.38L12.65,14.38L12.65,20.51L18.4,20.51L18.4,10.73L21.27,10.73L11.5,2.49Z';

const MONITOR_STAND_D = 'M8.63,19.17L14.38,19.17M11.5,15.81L11.5,19.17';

const GROUP_SOLID_D =
  'M8.15,10.54C10,10.54 11.5,9.04 11.5,7.19C11.5,5.33 10,3.83 8.15,3.83C6.29,3.83 4.79,5.33 4.79,7.19C4.79,9.04 6.29,10.54 8.15,10.54ZM14.85,10.54C16.44,10.54 17.73,9.25 17.73,7.67C17.73,6.08 16.44,4.79 14.85,4.79C13.27,4.79 11.98,6.08 11.98,7.67C11.98,9.25 13.27,10.54 14.85,10.54ZM8.15,12.46C5.27,12.46 0.96,13.99 0.96,16.77L0.96,19.17L15.33,19.17L15.33,16.77C15.33,13.99 11.02,12.46 8.15,12.46ZM15.05,12.46C14.18,12.46 13.32,12.55 12.55,12.75C13.9,13.8 14.38,15.05 14.38,16.77L14.38,19.17L21.08,19.17L21.08,16.77C21.08,14.18 17.63,12.46 15.05,12.46Z';

/** A handset - 02B's "Overdue Follow-up". */
export function PhoneOutline({ size = 23, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={PHONE_D} {...stroke(color)} />
    </Svg>
  );
}

/** A card with a magnetic stripe - 02B's "Payment / Outstanding". */
export function CardOutline({ size = 23, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Rect x={2.4} y={5.27} width={18.21} height={12.46} rx={2.5} {...stroke(color)} />
      <Path d="M2.4,9.58L20.6,9.58" {...stroke(color)} />
      <Path d="M5.75,13.9L9.58,13.9" {...stroke(color)} />
    </Svg>
  );
}

/** A folded document with two rules - 02B's "Proposals / Commitments". */
export function FileOutline({ size = 23, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={FILE_BODY_D} {...stroke(color)} />
      <Path d={FILE_FOLD_D} {...stroke(color)} />
      <Path d={FILE_RULES_D} {...stroke(color)} />
    </Svg>
  );
}

/** Three rising bars, FILLED - 02B's "Opportunities" and 02A's cards. */
export function BarsSolid23({ size = 23, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      {[
        { x: 2.88, y: 11.5, h: 8.63 },
        { x: 9.3, y: 6.71, h: 13.42 },
        { x: 15.72, y: 2.88, h: 17.25 },
      ].map((b) => (
        <Rect key={b.x} x={b.x} y={b.y} width={4.41} height={b.h} rx={1.3} fill={color} />
      ))}
    </Svg>
  );
}

/** Three discs in a row, FILLED - 02B's "Others" and its More tab. */
export function EllipsisGlyph({ size = 23, color = MUTED }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      {[2.78, 9.49, 16.2].map((x) => (
        <Ellipse key={x} cx={x + 2.01} cy={11.5} rx={2.01} ry={2.01} fill={color} />
      ))}
    </Svg>
  );
}

/** The filter, top right of every 02B list. */
export function FunnelOutline({ size = 27, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 27 27">
      <Path d={FUNNEL_D} {...stroke(color)} />
    </Svg>
  );
}

/** The warning triangle on 02B's red banner. */
export function AlertTriangleOutline({ size = 21, color = '#e5484d' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21">
      <Path d={ALERT_TRI_D} {...stroke(color)} />
      <Path d={ALERT_BAR_D} {...stroke(color)} />
      <Path d={ALERT_DOT_D} {...stroke(color)} />
    </Svg>
  );
}

/**
 * A chevron pointing right, as a 3-point polyline.
 *
 * The design draws it at three sizes and two colours - 17 in #cb9092 on the
 * red banner, 16 in #8aa3b0 on every list row - and at stroke 1.7 rather than
 * the 2 the rest of this file uses, so it takes both.
 */
export function ChevronRightStroke({ size = 16, color = MUTED }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M4,2L13,8L4,14"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* --- the 02B tab bar's four, which are not one family either --- */

/** Home: a filled house. */
export function HouseSolid({ size = 23, color = BRAND }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={HOUSE_SOLID_D} fill={color} />
    </Svg>
  );
}

/** Pipeline: an outlined monitor on a stand. */
export function MonitorOutline({ size = 23, color = MUTED }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Rect x={2.88} y={4.31} width={17.25} height={11.5} rx={2} {...stroke(color)} />
      <Path d={MONITOR_STAND_D} {...stroke(color)} />
    </Svg>
  );
}

/** Customers: the filled pair. The same path 01B-INFO and 02A.4 draw. */
export function GroupSolid({ size = 23, color = MUTED }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={GROUP_SOLID_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** The plus inside the raised action. */
export function PlusStroke({ size = 29, color = '#ffffff' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 29 29">
      <Path d="M14.5,6.04L14.5,22.96M6.04,14.5L22.96,14.5" {...stroke(color)} />
    </Svg>
  );
}

/* --- the 02B list header's three, and the list row's chevron ------------- */

/** The back chevron: a 3-point polyline at stroke 2.2, as on 02A. */
export function ChevronLeftStroke({ size = 27, color = '#0f3244' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 27 27">
      <Path
        d="M16.88,4.5L7.88,13.5L16.88,22.5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** The magnifier inside the search field. */
export function SearchOutline({ size = 20, color = MUTED }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Ellipse cx={8.75} cy={8.75} rx={5.42} ry={5.42} {...stroke(color)} />
      <Path d="M12.83,12.83L16.67,16.67" {...stroke(color)} />
    </Svg>
  );
}

/**
 * Three rules of decreasing length - the sort control.
 *
 * It is drawn in a 21x18 box rather than a square one, so it takes a width
 * and a height.
 */
export function SortOutline({ width = 21, height = 18, color = '#6b8796' }: {
  width?: number; height?: number; color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21 18">
      <Path d="M3.5,5.25L17.5,5.25M5.25,9L15.75,9M7.88,12.75L13.13,12.75" {...stroke(color)} />
    </Svg>
  );
}
