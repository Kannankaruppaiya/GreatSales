import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The GreatSales mark: a G whose bowl opens at the top right and carries an
 * arrow away up and to the right — the letter and the growth in one stroke.
 *
 * The bowl is a 315° arc left open between due east and the up-right diagonal,
 * the crossbar closes the letter at the middle right, and the arrowhead sits on
 * the upper terminal pointing out through the opening.
 *
 * The tile takes its two stops from the brand tokens, so the mark follows the
 * design system rather than pinning its own emerald.
 *
 * The same geometry is duplicated, deliberately and only twice, in
 * `apps/mobile/src/gs/BrandMark.tsx` and in `scripts/make-icons.mjs`, which
 * rasterises every PNG the two apps ship — favicons, the iOS touch icon, the
 * Expo launcher and splash set. Change the numbers here and change them there,
 * then re-run `pnpm icons`.
 */

/** The bowl and its crossbar. */
const BOWL = "M 44.02 19.98 A 17 17 0 1 0 49 32 L 39 32";
/** The arrowhead, sitting on the bowl's upper terminal at 45°. */
const ARROW = "M 54.5 9.5 L 49.55 24.35 L 39.65 14.45 Z";

type BrandMarkProps = {
  className?: string;
  /**
   * `tile` is the product icon — the white G on the emerald tile. `glyph` is
   * the letter alone in `currentColor`, for a surface that already carries the
   * brand colour (a dark hero, a monochrome print).
   */
  variant?: "tile" | "glyph";
};

export function BrandMark({ className, variant = "tile" }: BrandMarkProps) {
  // Two marks on one page must not share gradient ids, and `useId` returns a
  // value containing colons, which `url(#…)` will not resolve.
  const uid = useId().replace(/:/g, "");
  const tileId = `gs-tile-${uid}`;
  const sheenId = `gs-sheen-${uid}`;
  const ink = variant === "tile" ? "white" : "currentColor";

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="GreatSales" className={cn("shrink-0", className)}>
      {variant === "tile" && (
        <>
          <defs>
            <linearGradient id={tileId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-brand-accent)" }} />
              <stop offset="100%" style={{ stopColor: "var(--color-brand-hover)" }} />
            </linearGradient>
            <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.22" />
              <stop offset="55%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill={`url(#${tileId})`} />
          <rect width="64" height="64" rx="15" fill={`url(#${sheenId})`} />
        </>
      )}
      <path
        d={BOWL}
        fill="none"
        stroke={ink}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={ARROW} fill={ink} />
    </svg>
  );
}
