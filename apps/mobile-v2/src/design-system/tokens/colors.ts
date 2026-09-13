/**
 * GreatSales Mobile Design System — Color Tokens.
 *
 * Visual language adapted from executive sales CRM reference:
 *   - Light Canvas: Calm warm off-white / light-ivory (#F8F9FB)
 *   - Elevated Surface: Crisp white card (#FFFFFF) with hairline borders (#E5E7EB)
 *   - Executive Hero Container: Rich deep forest green (#0A382C)
 *   - Primary Brand: Forest Emerald (#0D7A5F / #10B981)
 *   - Secondary Brand: Warm Amber / Gold (#D97706 / #F59E0B) for center FAB & warnings
 *   - Dark Canvas: Deep Navy (#070B12) for optional dark mode
 */

export interface ColorPalette {
  // Depth Levels
  canvas: string;
  canvasSubtle: string;
  surface: string;
  surfaceElevated: string;
  surface2: string;
  surface3: string;
  surfaceActive: string;
  surfaceMuted: string;
  surfaceInteractive: string;
  surfacePressed: string;

  // Text Hierarchy
  ink: string;
  ink2: string;
  body: string;
  muted: string;
  faint: string;

  // Lines & Borders
  line: string;
  lineDark: string;
  borderSubtle: string;

  // Semantic Tokens
  background: string;
  backgroundSecondary: string;
  backgroundElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textDisabled: string;
  textInverse: string;

  // Brand Accent (Forest Emerald)
  brand: string;
  brandStrong: string;
  brandLight: string;
  brandHover: string;
  brandDark: string;
  brandSoft: string;
  brandMuted: string;
  brandBorder: string;
  brandInk: string;
  brandHero: string;
  brandHeroBorder: string;

  // Brand Secondary (Warm Amber / Gold for Center FAB & Highlights)
  brandGold: string;
  brandGoldSoft: string;
  brandGoldBorder: string;

  // Amber / Attention
  amber: string;
  amberDark: string;
  amberSoft: string;
  amberBorder: string;

  // Warning
  warning: string;
  warningStrong: string;
  warningDark: string;
  warningSoft: string;
  warningMuted: string;
  warningBorder: string;

  // Danger / Critical / Red Zone
  danger: string;
  dangerStrong: string;
  dangerDark: string;
  dangerSoft: string;
  dangerMuted: string;
  dangerBorder: string;

  // Success / Paid / Won
  success: string;
  successStrong: string;
  successDark: string;
  successSoft: string;
  successMuted: string;
  successBorder: string;

  // Info / System / Processing
  info: string;
  infoStrong: string;
  infoDark: string;
  infoSoft: string;
  infoMuted: string;
  infoBorder: string;

  // Extended Accents
  indigo: string;
  indigoDark: string;
  indigoSoft: string;
  indigoBorder: string;

  violet: string;
  violetDark: string;
  violetSoft: string;
  violetBorder: string;

  // Overlays
  overlay: string;
  scrim: string;
  shadowTint: string;
  white: string;
  black: string;
}

export const PALETTE_LIGHT: ColorPalette = {
  canvas: '#F8F9FB',
  canvasSubtle: '#F1F3F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surface2: '#F8F9FB',
  surface3: '#F1F3F5',
  surfaceActive: '#E5E7EB',
  surfaceMuted: '#F3F4F6',
  surfaceInteractive: '#F3F4F6',
  surfacePressed: '#E5E7EB',

  ink: '#111827',
  ink2: '#1F2937',
  body: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',

  line: '#E5E7EB',
  lineDark: '#D1D5DB',
  borderSubtle: '#F1F3F5',

  background: '#F8F9FB',
  backgroundSecondary: '#F1F3F5',
  backgroundElevated: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textMuted: '#6B7280',
  textDisabled: '#D1D5DB',
  textInverse: '#FFFFFF',

  brand: '#0D7A5F',
  brandStrong: '#065F46',
  brandLight: '#10B981',
  brandHover: '#08634D',
  brandDark: '#044233',
  brandSoft: '#ECFDF5',
  brandMuted: '#A7F3D0',
  brandBorder: '#D1FAE5',
  brandInk: '#065F46',
  brandHero: '#0A382C',
  brandHeroBorder: 'rgba(16, 185, 129, 0.25)',

  brandGold: '#D97706',
  brandGoldSoft: '#FEF3C7',
  brandGoldBorder: '#FDE68A',

  amber: '#D97706',
  amberDark: '#B45309',
  amberSoft: '#FFFBEB',
  amberBorder: '#FDE68A',

  warning: '#D97706',
  warningStrong: '#B45309',
  warningDark: '#92400E',
  warningSoft: '#FFFBEB',
  warningMuted: '#FDE68A',
  warningBorder: '#FDE68A',

  danger: '#EF4444',
  dangerStrong: '#DC2626',
  dangerDark: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerMuted: '#FECACA',
  dangerBorder: '#FECACA',

  success: '#10B981',
  successStrong: '#059669',
  successDark: '#047857',
  successSoft: '#ECFDF5',
  successMuted: '#A7F3D0',
  successBorder: '#A7F3D0',

  info: '#2563EB',
  infoStrong: '#1D4ED8',
  infoDark: '#1E40AF',
  infoSoft: '#EFF6FF',
  infoMuted: '#BFDBFE',
  infoBorder: '#BFDBFE',

  indigo: '#4F46E5',
  indigoDark: '#3730A3',
  indigoSoft: '#EEF2FF',
  indigoBorder: '#C7D2FE',

  violet: '#7C3AED',
  violetDark: '#5B21B6',
  violetSoft: '#F5F3FF',
  violetBorder: '#DDD6FE',

  overlay: 'rgba(17, 24, 39, 0.5)',
  scrim: 'rgba(17, 24, 39, 0.75)',
  shadowTint: '#111827',
  white: '#FFFFFF',
  black: '#000000',
};

export const PALETTE_DARK: ColorPalette = {
  // Deep Navy 4-Level Depth System
  canvas: '#070B12',
  canvasSubtle: '#0B111E',
  surface: '#0E1626',
  surfaceElevated: '#141E34',
  surface2: '#141E34',
  surface3: '#1A2644',
  surfaceActive: '#22325A',
  surfaceMuted: '#10192A',
  surfaceInteractive: '#1B2846',
  surfacePressed: '#1E2C4C',

  ink: '#F8FAFC',
  ink2: '#E2E8F0',
  body: '#CBD5E1',
  muted: '#94A3B8',
  faint: '#64748B',

  line: 'rgba(255, 255, 255, 0.08)',
  lineDark: 'rgba(255, 255, 255, 0.16)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',

  background: '#070B12',
  backgroundSecondary: '#0B111E',
  backgroundElevated: '#0B111E',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textMuted: '#64748B',
  textDisabled: '#475569',
  textInverse: '#070B12',

  brand: '#10B981',
  brandStrong: '#059669',
  brandLight: '#34D399',
  brandHover: '#059669',
  brandDark: '#A7F3D0',
  brandSoft: 'rgba(16, 185, 129, 0.12)',
  brandMuted: 'rgba(16, 185, 129, 0.28)',
  brandBorder: 'rgba(16, 185, 129, 0.28)',
  brandInk: '#D1FAE5',
  brandHero: '#141E34',
  brandHeroBorder: 'rgba(255, 255, 255, 0.08)',

  brandGold: '#F59E0B',
  brandGoldSoft: 'rgba(245, 158, 11, 0.15)',
  brandGoldBorder: 'rgba(245, 158, 11, 0.3)',

  amber: '#F59E0B',
  amberDark: '#FCD34D',
  amberSoft: 'rgba(245, 158, 11, 0.12)',
  amberBorder: 'rgba(245, 158, 11, 0.28)',

  warning: '#F59E0B',
  warningStrong: '#FCD34D',
  warningDark: '#FCD34D',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  warningMuted: 'rgba(245, 158, 11, 0.28)',
  warningBorder: 'rgba(245, 158, 11, 0.28)',

  danger: '#EF4444',
  dangerStrong: '#FCA5A5',
  dangerDark: '#FCA5A5',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  dangerMuted: 'rgba(239, 68, 68, 0.28)',
  dangerBorder: 'rgba(239, 68, 68, 0.28)',

  success: '#10B981',
  successStrong: '#34D399',
  successDark: '#34D399',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  successMuted: 'rgba(16, 185, 129, 0.28)',
  successBorder: 'rgba(16, 185, 129, 0.28)',

  info: '#3B82F6',
  infoStrong: '#93C5FD',
  infoDark: '#93C5FD',
  infoSoft: 'rgba(59, 130, 246, 0.12)',
  infoMuted: 'rgba(59, 130, 246, 0.28)',
  infoBorder: 'rgba(59, 130, 246, 0.28)',

  indigo: '#6366F1',
  indigoDark: '#A5B4FC',
  indigoSoft: 'rgba(99, 102, 241, 0.12)',
  indigoBorder: 'rgba(99, 102, 241, 0.28)',

  violet: '#8B5CF6',
  violetDark: '#C4B5FD',
  violetSoft: 'rgba(139, 92, 246, 0.12)',
  violetBorder: 'rgba(139, 92, 246, 0.28)',

  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.75)',
  shadowTint: '#000000',
  white: '#FFFFFF',
  black: '#000000',
};

export type ColorRole = keyof ColorPalette;
