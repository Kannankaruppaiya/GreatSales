import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

/**
 * The GreatSales mark: a G whose bowl opens at the top right and carries an
 * arrow away up and to the right — the letter and the growth in one stroke.
 *
 * The geometry is duplicated in `apps/web/src/components/BrandMark.tsx` and in
 * `scripts/make-icons.mjs`, which rasterises the launcher and splash icons.
 * Change the numbers here and change them there, then run `pnpm icons`.
 */

/** The bowl and its crossbar. */
const BOWL = 'M 44.02 19.98 A 17 17 0 1 0 49 32 L 39 32';
/** The arrowhead, sitting on the bowl's upper terminal at 45°. */
const ARROW = 'M 54.5 9.5 L 49.55 24.35 L 39.65 14.45 Z';

export function BrandMark({ size = 48, variant = 'tile' }: { size?: number; variant?: 'tile' | 'glyph' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {variant === 'tile' && (
        <>
          <Defs>
            <LinearGradient id="gsTile" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#10b981" />
              <Stop offset="100%" stopColor="#047857" />
            </LinearGradient>
          </Defs>
          <Rect width="64" height="64" rx="15" fill="url(#gsTile)" />
        </>
      )}
      <Path
        d={BOWL}
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d={ARROW} fill="#ffffff" />
    </Svg>
  );
}
