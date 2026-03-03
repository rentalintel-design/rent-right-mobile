import { Platform } from 'react-native';

/** Rent Right dark-first palette — matches web app */
export const Colors = {
  dark: {
    bgPage: '#0a1628',
    bgSurface: '#0f1f35',
    bgSubtle: '#162240',
    border: '#1e3a5f',
    accent: '#2563eb',
    accentLight: '#3b82f6',
    text1: '#f0f6ff',
    text2: '#b8ccdf',
    text3: '#7896b4',
    text4: '#4a6685',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    // Navigation helpers
    tabBar: '#0f1f35',
    tabActive: '#2563eb',
    tabInactive: '#4a6685',
  },
  light: {
    bgPage: '#f8fafc',
    bgSurface: '#ffffff',
    bgSubtle: '#f1f5f9',
    border: '#e2e8f0',
    accent: '#2563eb',
    accentLight: '#3b82f6',
    text1: '#0f172a',
    text2: '#334155',
    text3: '#64748b',
    text4: '#94a3b8',
    green: '#16a34a',
    red: '#dc2626',
    yellow: '#ca8a04',
    tabBar: '#ffffff',
    tabActive: '#2563eb',
    tabInactive: '#94a3b8',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const Typography = {
  display: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34 },
  title: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  subtitle: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' as const },
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'System', mono: 'Menlo' },
  default: { sans: 'normal', mono: 'monospace' },
});
