export type ColorScheme = 'dark' | 'light';

export const COLORS = {
  dark: {
    background: '#0B0F19',
    backgroundSecondary: '#070A11',
    surface: '#131B2E',
    surfaceSubtle: '#101626',
    surfaceLight: '#1C2640',
    surfaceHighlight: '#253354',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryDark: '#1D4ED8',
    primaryGlow: 'rgba(59, 130, 246, 0.25)',
    accent: '#06B6D4',
    success: '#10B981',
    successBackground: 'rgba(16, 185, 129, 0.12)',
    danger: '#EF4444',
    dangerBackground: 'rgba(239, 68, 68, 0.12)',
    warning: '#F59E0B',
    warningBackground: 'rgba(245, 158, 11, 0.12)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#0B0F19',
    cardBackground: '#131B2E',
    tabBarBackground: '#0D1322',
  },
  light: {
    background: '#F8FAFC',
    backgroundSecondary: '#EDF2F7',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceLight: '#E2E8F0',
    surfaceHighlight: '#CBD5E1',
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.16)',
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    primaryDark: '#1D4ED8',
    primaryGlow: 'rgba(37, 99, 235, 0.15)',
    accent: '#0284C7',
    success: '#059669',
    successBackground: 'rgba(5, 150, 105, 0.1)',
    danger: '#DC2626',
    dangerBackground: 'rgba(220, 38, 38, 0.1)',
    warning: '#D97706',
    warningBackground: 'rgba(217, 119, 6, 0.1)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    textInverse: '#F8FAFC',
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
