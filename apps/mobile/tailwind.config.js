/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#f8fafc',
        surface: '#ffffff',
        surface2: '#f8fafc',
        surface3: '#f1f5f9',
        ink: '#0f172a',
        ink2: '#1e293b',
        body: '#334155',
        muted: '#64748b',
        faint: '#94a3b8',
        line: '#e2e8f0',
        brand: {
          DEFAULT: '#059669',
          light: '#10b981',
          hover: '#047857',
          dark: '#064e3b',
          soft: '#ecfdf5',
          border: '#a7f3d0',
        },
        amber: {
          DEFAULT: '#d97706',
          dark: '#b45309',
          soft: '#fffbeb',
          border: '#fde68a',
        },
        danger: {
          DEFAULT: '#dc2626',
          dark: '#991b1b',
          soft: '#fef2f2',
          border: '#fecaca',
        },
        info: {
          DEFAULT: '#2563eb',
          dark: '#1e40af',
          soft: '#eff6ff',
          border: '#bfdbfe',
        },
        indigo: {
          DEFAULT: '#4f46e5',
          dark: '#3730a3',
          soft: '#eef2ff',
          border: '#c7d2fe',
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
