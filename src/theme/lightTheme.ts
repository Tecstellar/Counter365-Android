import { Theme, ThemeColors } from './types';

export const lightColors: ThemeColors = {
  // Backgrounds & Surfaces
  bg: '#FAF8F5',
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F0EB',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#EBE7E1',
  cardBorderSubtle: 'rgba(17, 17, 17, 0.06)',

  // Typography
  text: '#111111',
  textSecondary: '#76716B',
  textMuted: '#76716B',
  textDisabled: '#A8A29E',
  heading: '#111111',

  // Borders & Dividers
  divider: '#EBE7E1',
  dividerLight: 'rgba(17, 17, 17, 0.05)',
  border: '#EBE7E1',
  borderLight: 'rgba(17, 17, 17, 0.06)',

  // Primary Brand Family (Orange)
  primary: '#FF5F00',
  primaryText: '#FFFFFF',
  accent: '#FF5F00',
  accent100: '#FFF0E6',
  accent200: '#FFE7D6',
  accent300: '#FDBA74',
  accent400: '#FB923C',
  accent600: '#EA580C',
  accent700: '#FF5F00',
  accent800: '#D94F00',
  accent900: '#111111',
  brandOrange: '#FF5F00',
  brandOrangeLight: '#FFF0E6',
  brandOrangeBorder: '#FED7AA',
  brandOrangeSubtle: 'rgba(255, 95, 0, 0.08)',
  brandOrangeMuted: 'rgba(255, 95, 0, 0.15)',
  brandBlack: '#111111',
  brandDarkSurface: '#FFFFFF',
  brandDarkCard: '#FFFFFF',
  brandDarkBorder: '#EBE7E1',

  // Neutrals
  neutral100: '#F3F0EB',
  neutral200: '#EBE7E1',
  neutral300: '#DDD8CE',
  neutral800: '#292524',
  neutral900: '#111111',

  // Form Inputs
  inputBg: '#FFFFFF',
  inputBorder: '#EBE7E1',
  inputText: '#111111',
  inputPlaceholder: '#76716B',

  // Icons
  icon: '#111111',
  iconMuted: '#76716B',
  iconActive: '#FF5F00',

  // Semantic States
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBg: '#FEF2F2',
  dangerText: '#DC2626',
  success: '#15803D',
  successLight: '#DCFCE7',
  successBg: '#DCFCE7',
  successText: '#15803D',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningBg: '#FEF3C7',
  warningText: '#B45309',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.45)',
  overlay55: 'rgba(0, 0, 0, 0.45)',
  overlay62: 'rgba(0, 0, 0, 0.60)',
  overlay70: 'rgba(250, 248, 245, 0.75)',

  // Backwards-compat aliases
  brandGreen: '#FF5F00',
  brandGreenLight: '#FFF0E6',
  brandGreenBorder: '#FED7AA',

  // Design Tokens (Light Mode)
  s: '#FFFFFF',
  alt: '#F3F0EB',
  ink: '#111111',
  mu: '#76716B',
  ln: '#EBE7E1',
  or: '#FF5F00',
  os: '#FFF0E6',
  ot: '#D94F00',
  ok: '#138A4B',
  okSoft: '#E3F5EA',
  err: '#D93A1F',
  gl: 'rgba(255, 255, 255, 0.66)',
  glb: 'rgba(255, 255, 255, 0.75)',
  gc: 'rgba(255, 255, 255, 0.74)',
};

export const lightTheme: Theme = {
  mode: 'light',
  isDark: false,
  colors: lightColors,
};
