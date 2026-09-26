/**
 * The photographs from the Penpot file, resolved so a missing file cannot
 * break the bundle.
 *
 * `pnpm design:rn` copies them into `assets/penpot/` under the names the
 * board's image fills use, so a photo changed in Penpot reaches the app on the
 * next run. Each is a `require` inside a try/catch: a screen must degrade to its flat
 * brand surface when one is absent rather than fail to build — or, worse, show
 * an invented illustration in its place.
 */

/** 01 Splash — the full-bleed hero behind the brand lockup. */
export function splashPhoto(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/penpot/splash-bg.jpg") as number;
  } catch {
    return null;
  }
}

/** 02C.1 Follow-ups Overview — the band under the pull-quote. */
export function followUpsPhoto(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/penpot/02c-road.jpg") as number;
  } catch {
    return null;
  }
}

/** 03.2 All Stages — the art behind the promo card. */
export function promoArt(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/penpot/var0.jpg") as number;
  } catch {
    return null;
  }
}
