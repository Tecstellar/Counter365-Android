import { Theme, ThemeColors } from './types';

export const darkColors: ThemeColors = {
  // Backgrounds & Surfaces
  bg: '#0B0B0B',
  background: '#0B0B0B',
  surface: '#171717',
  surfaceSecondary: '#1F1F1F',
  surfaceElevated: '#1F1F1F',
  card: '#171717',
  cardBorder: '#2A2A2A',
  cardBorderSubtle: 'rgba(255, 255, 255, 0.08)',

  // Typography
  text: '#F5F3F0',
  textSecondary: '#9A948D',
  textMuted: '#9A948D',
  textDisabled: '#525252',
  heading: '#F5F3F0',

  // Borders & Dividers
  divider: '#2A2A2A',
  dividerLight: 'rgba(255, 255, 255, 0.08)',
  border: '#2A2A2A',
  borderLight: 'rgba(255, 255, 255, 0.10)',

  // Primary Brand Family (Orange)
  primary: '#FF5F00',
  primaryText: '#FFFFFF',
  accent: '#FF5F00',
  accent100: '#3A2111',
  accent200: '#381E0E',
  accent300: '#4A2712',
  accent400: '#FF7A29',
  accent600: '#FF5F00',
  accent700: '#FF5F00',
  accent800: '#FF8A3D',
  accent900: '#F5F3F0',
  brandOrange: '#FF5F00',
  brandOrangeLight: '#3A2111',
  brandOrangeBorder: '#592708',
  brandOrangeSubtle: 'rgba(255, 95, 0, 0.15)',
  brandOrangeMuted: 'rgba(255, 95, 0, 0.25)',
  brandBlack: '#0B0B0B',
  brandDarkSurface: '#171717',
  brandDarkCard: '#171717',
  brandDarkBorder: '#2A2A2A',

  // Neutrals
  neutral100: '#1F1F1F',
  neutral200: '#2A2A2A',
  neutral300: '#333333',
  neutral800: '#E5E5E5',
  neutral900: '#FFFFFF',

  // Form Inputs
  inputBg: '#171717',
  inputBorder: '#2A2A2A',
  inputText: '#F5F3F0',
  inputPlaceholder: '#6E6A64',

  // Icons
  icon: '#F5F3F0',
  iconMuted: '#9A948D',
  iconActive: '#FF5F00',

  // Semantic States
  danger: '#FF6B4D',
  dangerLight: '#260E0E',
  dangerBg: '#260E0E',
  dangerText: '#FF6B4D',
  success: '#3DD68C',
  successLight: '#12301F',
  successBg: '#12301F',
  successText: '#3DD68C',
  warning: '#F59E0B',
  warningLight: '#2A1B05',
  warningBg: '#2A1B05',
  warningText: '#FBBF24',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlay55: 'rgba(0, 0, 0, 0.70)',
  overlay62: 'rgba(0, 0, 0, 0.85)',
  overlay70: 'rgba(11, 11, 11, 0.90)',

  // Backwards-compat aliases
  brandGreen: '#FF5F00',
  brandGreenLight: '#3A2111',
  brandGreenBorder: '#592708',

  // Design Tokens (Dark Mode)
  s: '#171717',
  alt: '#1F1F1F',
  ink: '#F5F3F0',
  mu: '#9A948D',
  ln: '#2A2A2A',
  or: '#FF5F00',
  os: '#3A2111',
  ot: '#FF8A3D',
  ok: '#3DD68C',
  okSoft: '#12301F',
  err: '#FF6B4D',
  gl: 'rgba(24, 24, 24, 0.6)',
  glb: 'rgba(255, 255, 255, 0.09)',
  gc: 'rgba(28, 28, 28, 0.62)',
};

export const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: darkColors,
};
