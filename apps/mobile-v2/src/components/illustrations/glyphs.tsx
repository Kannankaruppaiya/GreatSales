import Svg, { Path, Rect } from 'react-native-svg';

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
