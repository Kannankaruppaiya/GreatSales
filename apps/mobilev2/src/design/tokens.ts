/**
 * Design tokens extracted from the Penpot file GREATSALESV2 / V4,
 * page "00 — GreatSales Mobile Design System".
 *
 * Every value here is copied from the design, not invented. When the design
 * changes, re-extract rather than hand-editing: each block below names the
 * Penpot board it came from.
 */

/** Board "02 — Colour Tokens" */
export const color = {
  // Text & Ink
  ink: "#0F3244",
  inkDeep: "#123E52",
  muted: "#6B8796",
  muted2: "#8AA3B0",
  faint: "#93A9B5",
  surfaceWhite: "#FFFFFF",

  // Brand
  primary: "#17A45E",
  primaryDark: "#0E7A4A",
  mintSurface: "#E8F6EE",
  mintTint: "#F1F9F5",

  // Surface & Line
  canvas: "#F8FBFC",
  line: "#E6EFF3",
  lineSoft: "#EEF4F7",
  notch: "#0B1B24",

  // Status
  red: "#E5484D",
  redDark: "#C22B30",
  redSoft: "#FDECEC",
  amber: "#D98A15",
  amberSoft: "#FDF0E0",
  steel: "#4B7C93",
  steelSoft: "#EAF2F7",

  // Board values that are not on "02 — Colour Tokens". Kept here so screens
  // still carry no raw hex, and named so the gap stays visible: if the token
  // board ever gains them, these fold into it.
  /** The pull-quote on "02C.1 Follow-ups Overview". */
  quoteInk: "#3E6374",
  /** The promo card's sub-line on "03.2 All Stages". */
  promoSub: "#3D5E6E",
} as const;

export type ColorToken = keyof typeof color;

/**
 * Board "04 — Spacing Scale".
 * Base 4. Screen gutter is 18, card padding 12–16.
 */
export const space = {
  /** Icon to its label */
  xs: 4,
  /** Chip gap, tight stacks */
  sm: 8,
  /** Card inner padding */
  md: 12,
  /** List row inner padding */
  lg: 14,
  /** Between cards */
  xl: 16,
  /** Screen gutter */
  gutter: 18,
  /** Section top spacing */
  section: 20,
  /** Between sections */
  xxl: 24,
} as const;

/** Board "05 — Corner Radius" */
export const radius = {
  /** Icon tile */
  tile: 8,
  /** Input, small card */
  input: 10,
  /** Card */
  card: 12,
  /** List card */
  listCard: 14,
  /** Hero card */
  hero: 16,
  /** Phone frame */
  frame: 26,
  /** Pill / chip */
  pill: 999,
} as const;

/**
 * Board "03 — Typography".
 * Plus Jakarta Sans for all UI, Caveat for the brand script only.
 * Numbers carry weight 800.
 */
export const font = {
  script: "Caveat_400Regular",
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

/** Named type ramp, straight from the Penpot typography board. */
export const type = {
  /** 26 / 800 — e.g. "₹ 48.2L" */
  display: { fontFamily: font.extrabold, fontSize: 26 },
  /** 22 / 800 — e.g. a person's name in the greeting */
  hero: { fontFamily: font.extrabold, fontSize: 22 },
  /** 20 / 700 — screen titles */
  pageTitle: { fontFamily: font.bold, fontSize: 20 },
  /** 16 / 700 — section headings */
  section: { fontFamily: font.bold, fontSize: 16 },
  /** 14 / 700 — card titles */
  cardTitle: { fontFamily: font.bold, fontSize: 14 },
  /** 13 / 500 — body copy */
  body: { fontFamily: font.medium, fontSize: 13 },
  /** 12 / 500 — secondary copy */
  secondary: { fontFamily: font.medium, fontSize: 12 },
  /** 11 / 500 — captions */
  caption: { fontFamily: font.medium, fontSize: 11 },
  /** 10 / 700 — micro labels, e.g. "ACTION REQUIRED" */
  micro: { fontFamily: font.bold, fontSize: 10 },
  /** 9 / 600 — nano labels, e.g. "20 Sep" */
  nano: { fontFamily: font.semibold, fontSize: 9 },
  /** Caveat 15 / 400 — brand script only, never for UI text */
  script: { fontFamily: font.script, fontSize: 15 },
} as const;

export type TypeToken = keyof typeof type;

/**
 * Board "06 — Elevation & Shadows".
 * Soft and low: ink-tinted for surfaces, green-tinted under primary actions.
 * Written as React Native shadow props; `elevation` approximates the same
 * depth on Android, which has no offset/blur control.
 */
function shadow(
  offsetY: number,
  blur: number,
  opacity: number,
  shadowColor: string = color.ink,
  elevation: number = 2,
) {
  return {
    shadowColor,
    shadowOffset: { width: 0, height: offsetY },
    shadowRadius: blur,
    shadowOpacity: opacity,
    elevation,
  } as const;
}

export const elevation = {
  /** Card S · 0 2 8 · 5% */
  cardS: shadow(2, 8, 0.05, color.ink, 1),
  /** Card · 0 3 10 · 5% */
  card: shadow(3, 10, 0.05, color.ink, 2),
  /** Card L · 0 3 12 · 6% */
  cardL: shadow(3, 12, 0.06, color.ink, 3),
  /** Sheet · 0 10 28 · 14% */
  sheet: shadow(10, 28, 0.14, color.ink, 12),
  /** Nav · 0 -3 14 · 8% */
  nav: shadow(-3, 14, 0.08, color.ink, 8),
  /** Primary · 0 5 14 · 30% — green-tinted, under primary actions */
  primary: shadow(5, 14, 0.3, color.primary, 6),
  /** FAB · 0 4 12 · 20% */
  fab: shadow(4, 12, 0.2, color.primary, 8),
} as const;

/** Board "12 — Navigation Architecture" — bar 52, icons 21, labels 10, FAB 53 raised 17. */
export const nav = {
  barHeight: 52,
  iconSize: 21,
  labelSize: 10,
  fabSize: 53,
  fabRaise: 17,
} as const;

/** Board "08 — Buttons" — 44px minimum touch target, label 13/700. */
export const control = {
  minTouchTarget: 44,
  heightLarge: 46,
  heightMedium: 40,
  heightSmall: 32,
  fabSize: 56,
} as const;

/** Board "07 — Icon Library" — Lucide, 24×24, stroke 2, round cap & join, one family only. */
export const icon = {
  size: 24,
  strokeWidth: 2,
} as const;

export const tokens = {
  color,
  space,
  radius,
  font,
  type,
  elevation,
  nav,
  control,
  icon,
} as const;
