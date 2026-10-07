export type ColorScheme = 'dark' | 'light';

export const COLORS = {
  dark: {
    background: '#0A0A0B',
    backgroundSecondary: '#050506',
    surface: '#151517',
    surfaceSubtle: '#111113',
    surfaceLight: '#1F1F22',
    surfaceHighlight: '#2B2B30',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    primary: '#F5B544',
    primaryLight: '#FBCB6B',
    primaryDark: '#D9951A',
    primaryGlow: 'rgba(245, 181, 68, 0.22)',
    accent: '#2DD4BF',
    success: '#34D399',
    successBackground: 'rgba(52, 211, 153, 0.12)',
    danger: '#F87171',
    dangerBackground: 'rgba(248, 113, 113, 0.12)',
    warning: '#FB923C',
    warningBackground: 'rgba(251, 146, 60, 0.12)',
    textPrimary: '#FAFAF9',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textInverse: '#0A0A0B',
    cardBackground: '#151517',
    tabBarBackground: '#0D0D0F',
  },
  light: {
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#FAFAFA',
    surfaceLight: '#EDEDED',
    surfaceHighlight: '#DCDCDC',
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.16)',
    primary: '#0A0A0A',
    primaryLight: '#262626',
    primaryDark: '#000000',
    primaryGlow: 'rgba(0, 0, 0, 0.10)',
    accent: '#404040',
    success: '#059669',
    successBackground: 'rgba(5, 150, 105, 0.1)',
    danger: '#DC2626',
    dangerBackground: 'rgba(220, 38, 38, 0.1)',
    warning: '#D97706',
    warningBackground: 'rgba(217, 119, 6, 0.1)',
    textPrimary: '#0A0A0A',
    textSecondary: '#52525B',
    textTertiary: '#A1A1AA',
    textInverse: '#FFFFFF',
    cardBackground: '#FFFFFF',
    tabBarBackground: '#FFFFFF',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  mono: {
    fontSize: 13,
    fontFamily: 'Courier',
    fontWeight: '500' as const,
  },
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};
