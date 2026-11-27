import type { Config } from 'tailwindcss';

/**
 * Swiss GIS design tokens — clean light outdoor cartography.
 * Crimson is reserved for SOS / alerts / critical actions.
 * Amber is reserved for telemetry warnings (weak signal, offline, hypothermia risk).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F3F5F4',
        surface: '#FFFFFF',
        line: { DEFAULT: '#DCE2DE', strong: '#C5CEC9' },
        ink: { DEFAULT: '#0F172A', 2: '#475569', muted: '#64748B' },
        forest: { DEFAULT: '#166534', hover: '#14532D', tint: '#ECFDF5' },
        crimson: { DEFAULT: '#DC2626', hover: '#B91C1C', tint: '#FEF2F2' },
        amber: { DEFAULT: '#D97706', tint: '#FFFBEB', ink: '#92400E' },
        slate2: { DEFAULT: '#64748B', tint: '#F1F5F9' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        panel: '10px',
        ctl: '8px',
        chip: '6px',
      },
      boxShadow: {
        float: '0 1px 2px rgba(15,23,42,.06), 0 10px 24px -10px rgba(15,23,42,.22)',
        hair: '0 1px 0 rgba(15,23,42,.04)',
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '14px' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
