/**
 * The photographs exported from Penpot, resolved so a missing file cannot
 * break the bundle.
 *
 * Each is a `require` inside a try/catch: the files are exported by hand from
 * the design (see `assets/README.md`), and a screen must degrade to its flat
 * brand surface when one is absent rather than fail to build — or, worse, show
 * an invented illustration in its place.
 */

/** 01 Splash — the full-bleed hero behind the brand lockup. */
export function splashPhoto(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/images/splash-bg.jpg") as number;
  } catch {
    return null;
  }
}

/** 02C.1 Follow-ups Overview — the band under the pull-quote. */
export function followUpsPhoto(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/images/followups-hero.jpg") as number;
  } catch {
    return null;
  }
}

/** 03.2 All Stages — the art behind the promo card. */
export function promoArt(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/images/promo-art.jpg") as number;
  } catch {
    return null;
  }
}
