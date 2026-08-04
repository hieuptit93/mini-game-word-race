/**
 * Mini-game design tokens — aligned with Pika Design System.
 * Dark theme variant for immersive game experience.
 */

export const color = {
  // Pika brand primary
  cyan: {
    100: '#A5E1EB',
    200: '#78D2E1',
    400: '#46C4D7',
    500: '#3AABBC',
    600: '#2E95A4',
  },
  // Error / destructive / recording state
  red: {
    100: '#FFDFE0',
    400: '#FF4B4B',
    500: '#EA2B2B',
    light: '#FF8A80',
  },
  // Success / good score
  green: {
    400: '#2E7D32',
    500: '#1B5E20',
  },
  // Medium score
  orange: {
    400: '#FF9600',
    500: '#B26A00',
  },
  // Dark theme neutrals
  neutral: {
    900: '#0B0B0B',
    800: '#1A1A1A',
    700: '#2A2A2A',
    600: '#3A3A3A',
    500: 'rgba(255,255,255,0.6)',
    400: 'rgba(255,255,255,0.4)',
    200: 'rgba(255,255,255,0.14)',
    100: 'rgba(255,255,255,0.08)',
  },
  white: '#FFFFFF',
} as const;

export const semantic = {
  primary: color.cyan[400],
  primaryDark: color.cyan[600],
  error: color.red[400],
  errorLight: color.red.light,
  success: color.green[400],
  warning: color.orange[500],
  recording: color.red[400],
  bg: color.neutral[900],
  surface: color.neutral[100],
  surfaceElevated: color.neutral[200],
  text: color.white,
  textSecondary: color.neutral[500],
  textDisabled: color.neutral[400],
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  24: 96,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  pill: 9999,
} as const;

export const typography = {
  display: { size: 64, fontWeight: '900' as const },
  wordDisplay: { size: 52, fontWeight: '800' as const },
  title1: { size: 28, fontWeight: '800' as const },
  title2: { size: 17, fontWeight: '700' as const },
  body: { size: 16, fontWeight: '400' as const },
  bodyBold: { size: 15, fontWeight: '700' as const },
  caption: { size: 14, fontWeight: '600' as const },
  label: { size: 13, lineHeight: 18 },
  tag: { size: 12, fontWeight: '400' as const },
  icon: { lg: 44, md: 28, sm: 24 },
} as const;

export const sizing = {
  micButton: 96,
  gameIcon: 56,
  minTouch: 44,
} as const;

export const scoreColor = (score: number): string =>
  score >= 80 ? color.green[400] : score >= 50 ? color.orange[500] : color.red[400];
