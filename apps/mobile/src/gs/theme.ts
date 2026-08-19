/* GreatSales Enterprise Mobile Design System Tokens
 * Emerald Executive Brand on Crisp Slate & Cloud Canvas. */

export const C = {
  canvas: '#f8fafc',
  canvasSubtle: '#f1f5f9',
  surface: '#ffffff',
  surface2: '#f8fafc',
  surface3: '#eef2f6',
  surfaceActive: '#e2e8f0',
  ink: '#0f172a',
  ink2: '#1e293b',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  lineDark: '#cbd5e1',

  // Emerald Executive Palette
  brand: '#059669',
  brandLight: '#10b981',
  brandHover: '#047857',
  brandDark: '#064e3b',
  brandSoft: '#ecfdf5',
  brandBorder: '#a7f3d0',

  // Semantic Accents
  amber: '#d97706',
  amberDark: '#b45309',
  amberSoft: '#fffbeb',
  amberBorder: '#fde68a',

  red: '#dc2626',
  redDark: '#991b1b',
  redSoft: '#fef2f2',
  redBorder: '#fecaca',

  blue: '#2563eb',
  blueDark: '#1e40af',
  blueSoft: '#eff6ff',
  blueBorder: '#bfdbfe',

  indigo: '#4f46e5',
  indigoSoft: '#eef2ff',

  violet: '#7c3aed',
  violetSoft: '#f5f3ff',

  white: '#ffffff',
  black: '#000000',
} as const;

export type Tone = 'won' | 'hot' | 'open' | 'lost' | 'neutral';

export const TONE: Record<Tone, { fg: string; bg: string; border: string }> = {
  won: { fg: C.brandDark, bg: C.brandSoft, border: C.brandBorder },
  hot: { fg: C.amberDark, bg: C.amberSoft, border: C.amberBorder },
  open: { fg: C.blueDark, bg: C.blueSoft, border: C.blueBorder },
  lost: { fg: C.redDark, bg: C.redSoft, border: C.redBorder },
  neutral: { fg: C.muted, bg: C.surface3, border: C.line },
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;
export const F = {
  h1: 24,
  h2: 19,
  title: 15,
  body: 13,
  sm: 12,
  xs: 11,
  micro: 10,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  float: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};
