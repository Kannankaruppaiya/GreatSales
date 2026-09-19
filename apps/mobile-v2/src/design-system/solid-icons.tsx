import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  PinGlyph, CalendarGlyph, BarsGlyph,
} from '../components/illustrations/glyphs';

/**
 * The icons the SCREENS use, which are solid, not the outline set on board 07.
 *
 * Board "07 — Icon Library" specifies Lucide at stroke 2. Counting what the
 * screens actually draw: every glyph on 01B and 01D is a FILLED path -
 * `qa-ic-0` is `path fill #17a45e`, `bell` is `path fill #123e52`, and so on.
 * The only stroked one on the home screen is the "View All" chevron. So there
 * are two families in this app, and this is the solid one; src/design-system/
 * icons.tsx remains the outline one, for the chevrons and rules that are
 * genuinely stroked.
 *
 * Passing a Lucide outline through `fill` is not an option, whatever it looks
 * like it should do: those paths describe a stroke's centreline, so filling
 * one renders a blot rather than its solid twin.
 *
 * The glyphs come from Material Icons, which is what the design traced - the
 * pin, the people, the calendar and the shield on 01B each match Material's
 * `place`, `people`, `event` and `verified_user` down to their two-subpath
 * structure. Four of them were already pulled out of the design's own path
 * data for 01B and are reused here rather than swapped for the Material twin,
 * because an exact trace beats a near one where we already have it.
 */

type IconProps = { size?: number; color?: string };

/** Straight from the design's paths, extracted for Screen 01B. */
export const SolidPin = PinGlyph;
export const SolidCalendar = CalendarGlyph;
export const SolidBars = BarsGlyph;

/** Material's, for the glyphs no screen has needed pulled out exactly yet. */
const material = (name: React.ComponentProps<typeof MaterialIcons>['name']) =>
  function Icon({ size = 24, color = '#17a45e' }: IconProps) {
    return <MaterialIcons name={name} size={size} color={color} />;
  };

export const SolidBell = material('notifications');
export const SolidPersonAdd = material('person-add');
export const SolidScan = material('crop-free');
export const SolidCart = material('shopping-cart');
export const SolidPhone = material('phone');
