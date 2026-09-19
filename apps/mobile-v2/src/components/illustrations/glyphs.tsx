import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

/**
 * The solid glyphs from Screen 01B, drawn from the design's own path data.
 *
 * These are NOT in the icon map, and deliberately. Board 07 specifies Lucide
 * at stroke 2 with round caps, which is an outline family; these five are
 * SOLID fills. Passing a Lucide outline through `fill` does not produce its
 * solid twin - the paths describe a stroke's centreline, not a filled shape -
 * so it would render as a blot. The design drew solid glyphs, so these are the
 * design's glyphs.
 *
 * Each viewBox is the design's own coordinate space, offset so the group's
 * 26×26 (or 18/21) box frames the path exactly. Re-pointing the coordinates by
 * hand would be arithmetic nobody can check against the file.
 */

const PIN_D =
  'M3427,481.058C3422.453,481.058,3418.767,484.745,3418.767,489.292C3418.767,495.467,3427,502.942,3427,502.942C3427,502.942,3435.233,495.467,3435.233,489.292C3435.233,487.108,3434.366,485.014,3432.822,483.470C3431.278,481.926,3429.184,481.058,3427,481.058ZM3427,492.217C3425.385,492.217,3424.075,490.907,3424.075,489.292C3424.075,487.676,3425.385,486.367,3427,486.367C3428.615,486.367,3429.925,487.676,3429.925,489.292C3429.925,490.907,3428.615,492.217,3427,492.217Z';

const PEOPLE_D =
  'M3687.208,456.917C3689.302,456.917,3691,455.219,3691,453.125C3691,451.031,3689.302,449.333,3687.208,449.333C3685.114,449.333,3683.417,451.031,3683.417,453.125C3683.417,455.219,3685.114,456.917,3687.208,456.917ZM3694.792,456.917C3696.587,456.917,3698.042,455.462,3698.042,453.667C3698.042,451.872,3696.587,450.417,3694.792,450.417C3692.997,450.417,3691.542,451.872,3691.542,453.667C3691.542,455.462,3692.997,456.917,3694.792,456.917ZM3687.208,459.083C3683.958,459.083,3679.083,460.817,3679.083,463.958L3679.083,466.667L3695.333,466.667L3695.333,463.958C3695.333,460.817,3690.458,459.083,3687.208,459.083ZM3695.008,459.083C3694.033,459.083,3693.058,459.192,3692.192,459.408C3693.708,460.600,3694.25,462.008,3694.25,463.958L3694.25,466.667L3701.833,466.667L3701.833,463.958C3701.833,461.033,3697.933,459.083,3695.008,459.083Z';

const CALENDAR_D =
  'M3426.583,616.167L3426.583,618.333L3424.958,618.333C3423.463,618.333,3422.25,619.546,3422.25,621.042L3422.25,635.667C3422.25,636.863,3423.22,637.833,3424.417,637.833L3439.583,637.833C3440.78,637.833,3441.75,636.863,3441.75,635.667L3441.75,621.042C3441.75,619.546,3440.537,618.333,3439.042,618.333L3437.417,618.333L3437.417,616.167L3435.25,616.167L3435.25,618.333L3428.75,618.333L3428.75,616.167L3426.583,616.167ZM3439.583,623.75L3439.583,635.667L3424.417,635.667L3424.417,623.75L3439.583,623.75Z';

const SHIELD_D =
  'M3427,1137.35L3420.7,1139.75L3420.7,1144.55C3420.7,1148.3,3423.4,1151.825,3427,1152.725C3430.6,1151.825,3433.3,1148.3,3433.3,1144.55L3433.3,1139.75L3427,1137.35ZM3426.25,1148.15L3423.325,1145.225L3424.525,1144.025L3426.25,1145.75L3430.225,1141.775L3431.425,1142.975L3426.25,1148.15Z';

const CTA_PIN_D =
  'M3462.5,962.662C3458.827,962.662,3455.85,965.640,3455.85,969.313C3455.85,974.3,3462.5,980.338,3462.5,980.338C3462.5,980.338,3469.15,974.3,3469.15,969.313C3469.15,967.549,3468.449,965.857,3467.202,964.610C3465.955,963.363,3464.264,962.662,3462.5,962.662ZM3462.5,971.675C3461.195,971.675,3460.137,970.617,3460.137,969.313C3460.137,968.008,3461.195,966.95,3462.5,966.95C3463.805,966.95,3464.863,968.008,3464.863,969.313C3464.863,970.617,3463.805,971.675,3462.5,971.675Z';

const BRAND = '#17a45e';

export function PinGlyph({ size = 26, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="3414 479 26 26">
      <Path d={PIN_D} fill={color} />
    </Svg>
  );
}

export function PeopleGlyph({ size = 26, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="3678 445 26 26">
      <Path d={PEOPLE_D} fill={color} />
    </Svg>
  );
}

/** Calendar, with the three day-dots the design places at y12 of the group. */
export function CalendarGlyph({ size = 26, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="3419 614 26 26">
      <Path d={CALENDAR_D} fill={color} />
      {[8, 12.5, 17].map((x) => (
        <Rect key={x} x={3419 + x} y={614 + 12} width={3} height={3} rx={0.7} fill={color} />
      ))}
    </Svg>
  );
}

/** Three bars, 5 wide at 10/15/20 tall. Plain rectangles in the design too. */
export function BarsGlyph({ size = 26, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Rect x={3} y={13} width={5} height={10} rx={1.3} fill={color} />
      <Rect x={11} y={8} width={5} height={15} rx={1.3} fill={color} />
      <Rect x={18} y={3} width={5} height={20} rx={1.3} fill={color} />
    </Svg>
  );
}

export function ShieldGlyph({ size = 18, color = '#4fb98a' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="3418 1136 18 18">
      <Path d={SHIELD_D} fill={color} />
    </Svg>
  );
}

export function CtaPinGlyph({ size = 21, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="3452 961 21 21">
      <Path d={CTA_PIN_D} fill={color} />
    </Svg>
  );
}

/* -------------------------------------------------------------------------
 * Screen 02A.3's glyphs.
 *
 * Unlike the 01B set above, these arrive already in their own 0..22 box - the
 * extractor now subtracts the group origin from the path data - so the
 * viewBox is the group's own size and nothing has to be read against a canvas
 * offset in the five thousands.
 *
 * Six of them are the KPI cards', one is the period pill's, one is the card
 * at the foot of the screen, and one is the delta arrow, which is the only
 * STROKED glyph in the set: the design draws an up-and-right arrow at stroke
 * 1.9, not Material's straight `arrow-upward`.
 * ---------------------------------------------------------------------- */

const TARGET_D =
  'M11,2.2C6.14,2.2 2.2,6.14 2.2,11C2.2,15.86 6.14,19.8 11,19.8C15.86,19.8 19.8,15.86 19.8,11C19.8,6.14 15.86,2.2 11,2.2ZM11,4.22C13.42,4.22 15.66,5.51 16.87,7.61C18.09,9.71 18.09,12.29 16.87,14.39C15.66,16.49 13.42,17.78 11,17.78C7.25,17.78 4.22,14.75 4.22,11C4.22,7.25 7.25,4.22 11,4.22ZM11,6.6C9.43,6.6 7.98,7.44 7.19,8.8C6.4,10.16 6.4,11.84 7.19,13.2C7.98,14.56 9.43,15.4 11,15.4C13.43,15.4 15.4,13.43 15.4,11C15.4,8.57 13.43,6.6 11,6.6ZM11,8.8C11.79,8.8 12.51,9.22 12.91,9.9C13.3,10.58 13.3,11.42 12.91,12.1C12.51,12.78 11.79,13.2 11,13.2C9.79,13.2 8.8,12.21 8.8,11C8.8,9.78 9.79,8.8 11,8.8Z';

const STACK_MID_D =
  'M3.12,8.07L3.12,10.45C3.12,12.1 6.6,13.38 11,13.38C15.4,13.38 18.88,12.1 18.88,10.45L18.88,8.07C18.88,9.72 15.4,11 11,11C6.6,11 3.12,9.72 3.12,8.07Z';
const STACK_LOW_D =
  'M3.12,12.83L3.12,15.22C3.12,16.87 6.6,18.15 11,18.15C15.4,18.15 18.88,16.87 18.88,15.22L18.88,12.83C18.88,14.48 15.4,15.77 11,15.77C6.6,15.77 3.12,14.48 3.12,12.83Z';

const PERSON_D =
  'M9.17,10.45C11.5,10.45 13.38,8.56 13.38,6.23C13.38,3.9 11.5,2.02 9.17,2.02C6.84,2.02 4.95,3.9 4.95,6.23C4.95,8.56 6.84,10.45 9.17,10.45ZM9.17,12.19C5.68,12.19 2.2,13.93 2.2,16.13L2.2,18.52L12.65,18.52L12.65,16.32C12.65,14.67 13.29,13.2 14.3,12.47C12.62,12.07 10.88,11.98 9.17,12.19Z';
const PERSON_PLUS_D =
  'M16.87,11.55L18.61,11.55L18.61,14.3L21.36,14.3L21.36,16.04L18.61,16.04L18.61,18.79L16.87,18.79L16.87,16.04L14.12,16.04L14.12,14.3L16.87,14.3Z';

const CAL22_D =
  'M6.42,1.83L6.42,3.67L5.04,3.67C3.78,3.67 2.75,4.69 2.75,5.96L2.75,18.33C2.75,19.35 3.57,20.17 4.58,20.17L17.42,20.17C18.43,20.17 19.25,19.35 19.25,18.33L19.25,5.96C19.25,4.69 18.22,3.67 16.96,3.67L15.58,3.67L15.58,1.83L13.75,1.83L13.75,3.67L8.25,3.67L8.25,1.83L6.42,1.83ZM17.42,8.25L17.42,18.33L4.58,18.33L4.58,8.25L17.42,8.25Z';

const CAL20_D =
  'M5.83,1.67L5.83,3.33L4.58,3.33C3.43,3.33 2.5,4.27 2.5,5.42L2.5,16.67C2.5,17.59 3.25,18.33 4.17,18.33L15.83,18.33C16.75,18.33 17.5,17.59 17.5,16.67L17.5,5.42C17.5,4.27 16.57,3.33 15.42,3.33L14.17,3.33L14.17,1.67L12.5,1.67L12.5,3.33L7.5,3.33L7.5,1.67L5.83,1.67ZM15.83,7.5L15.83,16.67L4.17,16.67L4.17,7.5L15.83,7.5Z';

const CLOCK_D =
  'M11,2.2C6.14,2.2 2.2,6.14 2.2,11C2.2,15.86 6.14,19.8 11,19.8C15.86,19.8 19.8,15.86 19.8,11C19.8,6.14 15.86,2.2 11,2.2ZM12.01,6.6L12.01,11.46L15.95,13.84L14.94,15.49L9.99,12.56L9.99,6.6L12.01,6.6Z';

const BOLT_D = 'M11.9,1.31L3.5,12.16L9.01,12.16L8.66,19.69L17.33,8.57L11.55,8.57L11.9,1.31Z';

const ARROW_UR_D = 'M3.25,9.75L9.75,3.25L5.2,3.25M9.75,3.25L9.75,7.8';

/**
 * A concentric target. The board draws it at 22 on 02A.3's first card, 23 in
 * 02A.4's banner and 21 on its second action; as with the calendar, all three
 * are one glyph at three sizes.
 */
export function TargetGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d={TARGET_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** Achieved value - three rising bars, each its own rounded rect. */
export function RisingBarsGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      {[
        { x: 2.75, y: 11, h: 8.25 },
        { x: 8.89, y: 6.42, h: 12.83 },
        { x: 15.03, y: 2.75, h: 16.5 },
      ].map((b) => (
        <Rect key={b.x} x={b.x} y={b.y} width={4.22} height={b.h} rx={1.3} fill={color} />
      ))}
    </Svg>
  );
}

/** Pipeline value - a three-disc stack; the top disc is a true ellipse. */
export function StackGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Ellipse cx={11} cy={5.14} rx={7.88} ry={2.93} fill={color} />
      <Path d={STACK_MID_D} fill={color} />
      <Path d={STACK_LOW_D} fill={color} />
    </Svg>
  );
}

/** New sales - a person with a plus. */
export function PersonPlusGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d={PERSON_D} fill={color} fillRule="evenodd" />
      <Path d={PERSON_PLUS_D} fill={color} />
    </Svg>
  );
}

/**
 * The solid calendar the 02A screens use. Not the 26-box one on 01B, which
 * puts its day-dots a shade higher.
 *
 * The board draws it in a 22 box on 02A.3, a 23 on 02A.4's third insight and
 * a 21 on its first action, and all three are the same glyph to three decimal
 * places - every offset is the same fraction of the box - so one viewBox
 * serves all of them and `size` is the only difference.
 */
export function CalendarSolidGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d={CAL22_D} fill={color} fillRule="evenodd" />
      {[6.42, 10.54, 14.67].map((x) => (
        <Rect key={x} x={x} y={10.45} width={2.75} height={2.75} rx={0.7} fill={color} />
      ))}
    </Svg>
  );
}

/** The period pill's calendar: a 20-box, and muted rather than brand. */
export function Calendar20Glyph({ size = 20, color = '#6b8796' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d={CAL20_D} fill={color} fillRule="evenodd" />
      {[5.83, 9.58, 13.33].map((x) => (
        <Rect key={x} x={x} y={9.5} width={2.5} height={2.5} rx={0.7} fill={color} />
      ))}
    </Svg>
  );
}

/** Due this week - a clock. */
export function ClockGlyph({ size = 22, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d={CLOCK_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** Recent Activity Impact - a lightning bolt, in a 21-box. */
export function BoltGlyph({ size = 21, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21">
      <Path d={BOLT_D} fill={color} />
    </Svg>
  );
}

/**
 * The delta arrow: up AND right, stroked 1.9 with round caps and joins.
 *
 * Its colour is the direction's rather than the metric's - see KpiCard - so
 * it takes one, and no default that would let a caller forget.
 */
export function ArrowUpRightGlyph({ size = 13, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 13 13">
      <Path
        d={ARROW_UR_D}
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* --- and Screen 02A.4's, which shares the target and the calendar above. --- */

const TREND_UP_D =
  'M3.45,16.67L9.58,10.54L13.03,13.99L18.02,9.01L18.02,12.46L20.13,12.46L20.13,5.56L13.23,5.56L13.23,7.67L16,7.67L13.03,10.64L9.58,7.19L1.92,14.95Z';

const GROUP_D =
  'M8.15,10.54C10,10.54 11.5,9.04 11.5,7.19C11.5,5.33 10,3.83 8.15,3.83C6.29,3.83 4.79,5.33 4.79,7.19C4.79,9.04 6.29,10.54 8.15,10.54ZM14.85,10.54C16.44,10.54 17.73,9.25 17.73,7.67C17.73,6.08 16.44,4.79 14.85,4.79C13.27,4.79 11.98,6.08 11.98,7.67C11.98,9.25 13.27,10.54 14.85,10.54ZM8.15,12.46C5.27,12.46 0.96,13.99 0.96,16.77L0.96,19.17L15.33,19.17L15.33,16.77C15.33,13.99 11.02,12.46 8.15,12.46ZM15.05,12.46C14.18,12.46 13.32,12.55 12.55,12.75C13.9,13.8 14.38,15.05 14.38,16.77L14.38,19.17L21.08,19.17L21.08,16.77C21.08,14.18 17.63,12.46 15.05,12.46Z';

const DOC_LINES_D =
  'M5.25,2.1L12.25,2.1L16.63,6.47L16.63,18.9L5.25,18.9L5.25,2.1ZM11.73,3.67L11.73,7.35L15.4,7.35L11.73,3.67ZM7.35,10.5L13.65,10.5L13.65,12.16L7.35,12.16ZM7.35,13.82L13.65,13.82L13.65,15.49L7.35,15.49Z';

/** An arrow stepping up over a ridge - 02A.4's banner, and its first insight. */
export function TrendUpGlyph({ size = 23, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={TREND_UP_D} fill={color} />
    </Svg>
  );
}

/** Four people - 02A.4's "More Opportunities". */
export function GroupGlyph({ size = 23, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23 23">
      <Path d={GROUP_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** A folded document with two rules - 02A.4's "Convert proposals to orders". */
export function DocumentGlyph({ size = 21, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21">
      <Path d={DOC_LINES_D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/**
 * The three ridges inside 02A.4's banner.
 *
 * A different picture from the screen's own hills and from 02A.1's: the same
 * three-layer idea in the banner's mint rather than the page's blue-grey, at
 * 329×36 rather than full width. It stretches with the banner, which is why
 * it is preserveAspectRatio="none" - the ridges are texture, not a shape
 * anybody measures.
 */
export function BannerRidges({ width = 329, height = 36 }: { width?: number | string; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 329 36" preserveAspectRatio="none">
      <Path d="M0,17.67L45.54,7.2L79.69,14.4L122.95,3.93L170.76,13.75L216.3,6.55L259.56,15.05L302.82,7.85L329,13.75L329,36L0,36Z" fill="#dceee6" />
      <Path d="M0,22.91L50.09,14.4L95.63,20.94L145.72,11.78L195.81,19.64L243.62,13.09L289.16,20.94L329,15.71L329,36L0,36Z" fill="#d0e8de" />
      <Path d="M0,28.8L54.64,22.25L109.29,27.49L170.76,20.29L227.68,26.84L282.33,21.6L329,26.18L329,36L0,36Z" fill="#c4e2d6" />
    </Svg>
  );
}
