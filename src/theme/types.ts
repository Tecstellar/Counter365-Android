export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Backgrounds & Surfaces
  bg: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  card: string;
  cardBorder: string;
  cardBorderSubtle: string;

  // Typography
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  heading: string;

  // Borders & Dividers
  divider: string;
  dividerLight: string;
  border: string;
  borderLight: string;

  // Primary Brand Family (Orange)
  primary: string;
  primaryText: string;
  accent: string;
  accent100: string;
  accent200: string;
  accent300: string;
  accent400: string;
  accent600: string;
  accent700: string;
  accent800: string;
  accent900: string;
  brandOrange: string;
  brandOrangeLight: string;
  brandOrangeBorder: string;
  brandOrangeSubtle: string;
  brandOrangeMuted: string;
  brandBlack: string;
  brandDarkSurface: string;
  brandDarkCard: string;
  brandDarkBorder: string;

  // Neutrals (Black / White / Greys)
  neutral100: string;
  neutral200: string;
  neutral300: string;
  neutral800: string;
  neutral900: string;

  // Form Inputs
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;

  // Icons
  icon: string;
  iconMuted: string;
  iconActive: string;

  // Semantic States (Controlled & High-Contrast)
  danger: string;
  dangerLight: string;
  dangerBg: string;
  dangerText: string;
  success: string;
  successLight: string;
  successBg: string;
  successText: string;
  warning: string;
  warningLight: string;
  warningBg: string;
  warningText: string;

  // Overlays
  overlay: string;
  overlay55: string;
  overlay62: string;
  overlay70: string;

  // Backwards-compat aliases
  brandGreen: string;
  brandGreenLight: string;
  brandGreenBorder: string;

  // Design Tokens
  s: string;       // Cards, inputs, nav, sheets
  alt: string;     // Inset rows, note strips, section contrast
  ink: string;     // Primary text, active chip, dark buttons
  mu: string;      // Secondary text, captions, inactive icons
  ln: string;      // Borders and dividers
  or: string;      // Primary buttons, active tab, badges (#FF5F00)
  os: string;      // Soft orange backgrounds for badges, icon tiles, hints
  ot: string;      // Small orange text on --os or --s
  ok: string;      // Paid or settled only
  okSoft: string;  // Background behind success icons
  err: string;     // Delete and overdue only
  gl: string;      // Glass base surface
  glb: string;     // Glass border (1px white 75% light, 9% dark)
  gc: string;      // Glass card surface (74% light, 62% dark)
}

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
}
