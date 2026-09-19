/**
 * Type, radius and colour come from the Penpot design (file V4, page
 * "mobiles"), measured across all 42 boards — see design/extracted-tokens.json
 * and the role evidence in src/global.css.
 *
 * The scales below are the design's own values, drift included: 22 distinct
 * font sizes and 27 distinct radii, down to 14.1px and 0.7px. That is a
 * deliberate choice to match the design exactly rather than normalise it, and
 * it is worth being honest about the cost — there is no rung to reach for when
 * building a new screen, because every size is a rung. The counterweight is
 * that they are all NAMED here: a screen writes text-11.5, never
 * text-[11.5px], so the set stays closed and countable, and normalising later
 * is a search over this file rather than over every component.
 *
 * (scripts/check-design.mjs, which ratchets arbitrary sizes down, scans
 * apps/web/src only — it does not police this app either way.)
 *
 * Layout is NOT on a fixed scale. The boards are 376x859, which is not a real
 * device: phones run 360-430 points wide. Hardcoding 376 geometry would leave
 * a gap on an iPhone 15 and overflow a Galaxy A-series, so containers use flex
 * and percentages and only type, radius, border and icon sizes are absolute.
 *
 * @type {import('tailwindcss').Config}
 */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: c('--canvas'),
        surface: c('--surface'),
        surfaceElevated: c('--surface-elevated'),
        surface2: c('--surface2'),
        surface3: c('--surface3'),
        surfaceActive: c('--surface-active'),
        ink: c('--ink'),
        ink2: c('--ink2'),
        body: c('--body'),
        muted: c('--muted'),
        faint: c('--faint'),
        faint2: c('--faint2'),
        line: c('--line'),
        lineDark: c('--line-dark'),
        brand: {
          DEFAULT: c('--brand'),
          light: c('--brand-light'),
          soft: c('--brand-soft'),
          soft2: c('--brand-soft2'),
          border: c('--brand-border'),
          ink: c('--brand-ink'),
          onPhoto: c('--brand-on-photo'),
          gradEnd: c('--brand-grad-end'),
        },
        scrim: c('--scrim'),
        fieldLine: c('--field-line'),
        fieldSubtle: c('--field-subtle'),
        placeholder: c('--placeholder'),
        divider: c('--divider'),
        hill: { back: c('--hill-back'), front: c('--hill-front') },
        quiet: { DEFAULT: c('--btn-quiet'), ink: c('--btn-quiet-ink') },
        pageTint: c('--page-tint'),
        progressTrack: c('--progress-track'),
        quoteCard: c('--quote-card'),
        danger: {
          DEFAULT: c('--danger'),
          dark: c('--danger-dark'),
          strong: c('--danger-strong'),
          soft: c('--danger-soft'),
          border: c('--danger-border'),
          line: c('--danger-line'),
        },
        disabled: {
          DEFAULT: c('--disabled'),
          ink: c('--disabled-ink'),
        },
        mintLine: c('--mint-line'),
        amber: {
          DEFAULT: c('--amber'),
          dark: c('--amber-dark'),
          strong: c('--amber-strong'),
          soft: c('--amber-soft'),
        },
        info: {
          DEFAULT: c('--info'),
          dark: c('--info-dark'),
          soft: c('--info-soft'),
        },
      },

      /* Every font size the design uses, by frequency:
       * 12 (285), 11 (212), 10 (200), 14 (198), 13 (184), 9.5 (115), 11.5 (97),
       * 10.5 (74), 12.5 (50), 16 (47), 20 (23), 7.5 (22), 15 (14), 22 (12),
       * 26 (12), 8.5 (11), 17 (10), 18 (7), 9 (4), 14.5 (1), 13.5 (1), 14.1 (1).
       * The last three appear once each and are almost certainly slips; they
       * are here so that "the design's sizes" is a set this file can be diffed
       * against, not a judgement call made per component. */
      fontSize: {
        7.5: '7.5px', 8.5: '8.5px', 9: '9px', 9.5: '9.5px',
        10: '10px', 10.5: '10.5px', 11: '11px', 11.5: '11.5px',
        12: '12px', 12.5: '12.5px', 13: '13px', 13.5: '13.5px',
        14: '14px', 14.1: '14.1px', 14.5: '14.5px', 15: '15px',
        16: '16px', 17: '17px', 18: '18px', 20: '20px',
        22: '22px', 26: '26px',
      },

      /* Every radius the design uses. The sub-3px values sit on icon internals
       * and hairline marks; 13 is the card radius on the home screen.
       * 34 is NOT here on purpose: it belongs to the 376x859 rect that draws
       * the phone bezel in the mockup, so it is a frame around the screen
       * rather than anything the app renders. */
      borderRadius: {
        0.7: '0.7px', 1: '1px', 1.1: '1.1px', 1.2: '1.2px', 1.3: '1.3px',
        2: '2px', 2.2: '2.2px', 2.5: '2.5px', 3: '3px', 3.5: '3.5px',
        4: '4px', 5: '5px', 6: '6px', 9: '9px', 9.5: '9.5px',
        10: '10px', 11: '11px', 12: '12px', 13: '13px', 14: '14px',
        16: '16px', 17: '17px', 18: '18px', 21: '21px', 22: '22px',
        26: '26px', full: '9999px',
      },

      /* React Native picks a face by file, not by numeric weight, so each
       * weight the design uses needs its own family. 500 is in the design 387
       * times and had no entry before. */
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular', 'System'],
        medium: ['PlusJakartaSans_500Medium', 'System'],
        semibold: ['PlusJakartaSans_600SemiBold', 'System'],
        bold: ['PlusJakartaSans_700Bold', 'System'],
        black: ['PlusJakartaSans_800ExtraBold', 'System'],
      },

      spacing: {
        /* The gutter every board keeps: cards are 339 wide on a 376 board. */
        gutter: '18.5px',
      },
    },
  },
  plugins: [],
};
