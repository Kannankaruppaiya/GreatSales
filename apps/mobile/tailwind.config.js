/**
 * Colours are not written here. They are CSS variables declared once in
 * src/global.css, with a dark set under `prefers-color-scheme`, and every class
 * below reads them through `rgb(var(--x) / <alpha-value>)` so both `bg-canvas`
 * and `border-line/50` resolve correctly and both follow the OS theme.
 *
 * Keeping the literal hex here as well is what let the two palettes drift apart
 * the first time, and it makes dark mode impossible: a Tailwind class baked to
 * a hex cannot change with the scheme.
 *
 * @type {import('tailwindcss').Config}
 */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        canvas: c('--canvas'),
        surface: c('--surface'),
        surface2: c('--surface2'),
        surface3: c('--surface3'),
        surfaceActive: c('--surface-active'),
        ink: c('--ink'),
        ink2: c('--ink2'),
        body: c('--body'),
        muted: c('--muted'),
        faint: c('--faint'),
        line: c('--line'),
        lineDark: c('--line-dark'),
        brand: {
          DEFAULT: c('--brand'),
          light: c('--brand-light'),
          hover: c('--brand-hover'),
          dark: c('--brand-dark'),
          soft: c('--brand-soft'),
          border: c('--brand-border'),
          ink: c('--brand-ink'),
        },
        amber: {
          DEFAULT: c('--amber'),
          dark: c('--amber-dark'),
          soft: c('--amber-soft'),
          border: c('--amber-border'),
        },
        danger: {
          DEFAULT: c('--danger'),
          dark: c('--danger-dark'),
          soft: c('--danger-soft'),
          border: c('--danger-border'),
        },
        info: {
          DEFAULT: c('--info'),
          dark: c('--info-dark'),
          soft: c('--info-soft'),
          border: c('--info-border'),
        },
        indigo: {
          DEFAULT: c('--indigo'),
          dark: c('--indigo-dark'),
          soft: c('--indigo-soft'),
          border: c('--indigo-border'),
        },
        violet: {
          DEFAULT: c('--violet'),
          dark: c('--violet-dark'),
          soft: c('--violet-soft'),
          border: c('--violet-border'),
        },
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular', 'System'],
        medium: ['PlusJakartaSans_600SemiBold', 'System'],
        bold: ['PlusJakartaSans_700Bold', 'System'],
        black: ['PlusJakartaSans_800ExtraBold', 'System'],
      },
    },
  },
  plugins: [],
};
