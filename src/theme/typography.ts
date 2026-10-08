import { Platform } from 'react-native';

/**
 * COUNTER365 GLOBAL TYPOGRAPHY SYSTEM
 *
 * FONTS:
 * - Body, UI, numbers, buttons, chips, labels, inputs, list text: "Lexend"
 * - Screen titles, section headings, and the Counter365 logo text/splash: "Jost" (weight 700)
 * - Fallback for Tamil script: "Noto Sans Tamil"
 * - System fallback: system-ui, sans-serif
 *
 * GLOBAL TOKENS:
 * --font-body: 'Lexend', 'Noto Sans Tamil', system-ui, sans-serif
 * --font-heading: 'Jost', 'Noto Sans Tamil', system-ui, sans-serif
 */

export const typography = {
  // Global CSS/Web Token Equivalents
  fontBody: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
  fontHeading: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",

  fonts: {
    // Screen titles, section headings, Counter365 logo: Jost (weight 700)
    heading: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-Bold',
      android: 'Jost-Bold',
      default: 'Jost-Bold',
    }),
    headingMedium: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-Medium',
      android: 'Jost-Medium',
      default: 'Jost-Medium',
    }),
    headingSemiBold: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-SemiBold',
      android: 'Jost-SemiBold',
      default: 'Jost-SemiBold',
    }),
    headingBold: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-Bold',
      android: 'Jost-Bold',
      default: 'Jost-Bold',
    }),
    headingBlack: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-ExtraBold',
      android: 'Jost-ExtraBold',
      default: 'Jost-ExtraBold',
    }),

    // Body, UI, inputs, lists: Lexend
    body: Platform.select({
      web: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Lexend-Regular',
      android: 'Lexend-Regular',
      default: 'Lexend-Regular',
    }),
    bodyMedium: Platform.select({
      web: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Lexend-Medium',
      android: 'Lexend-Medium',
      default: 'Lexend-Medium',
    }),
    bodySemiBold: Platform.select({
      web: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Lexend-SemiBold',
      android: 'Lexend-SemiBold',
      default: 'Lexend-SemiBold',
    }),
    bodyBold: Platform.select({
      web: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Lexend-Bold',
      android: 'Lexend-Bold',
      default: 'Lexend-Bold',
    }),

    // Numbers & Amounts: Lexend with tabular nums support
    numbers: Platform.select({
      web: "'Lexend', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Lexend-Bold',
      android: 'Lexend-Bold',
      default: 'Lexend-Bold',
    }),

    // Logo & Display text: Jost 700
    display: Platform.select({
      web: "'Jost', 'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'Jost-Bold',
      android: 'Jost-Bold',
      default: 'Jost-Bold',
    }),

    // Tamil Script Fallback
    tamil: Platform.select({
      web: "'Noto Sans Tamil', system-ui, sans-serif",
      ios: 'NotoSansTamil-Regular',
      android: 'NotoSansTamil-Regular',
      default: 'NotoSansTamil-Regular',
    }),
  },

  /**
   * TYPE SCALE
   * - Big amounts (totals, ₹ figures): Lexend 52px, weight 700 to 800
   * - Screen titles: Jost 26px, weight 700, letter-spacing -0.02em
   * - Section titles: Jost 17px, weight 700
   * - Body: Lexend 15px, weight 400 to 500
   * - Captions / hints / timestamps: Lexend 12.5px, weight 400 to 500
   * - Small uppercase labels: Lexend 11px, weight 600 to 700, letter-spacing 0.1em
   * - Buttons and chips: Lexend 13.5 to 15px, weight 600 to 700, letter-spacing -0.01em
   */
  sizes: {
    xs: 10,
    sm: 11,             // Small uppercase labels: 11px
    caption: 12.5,      // Captions / hints / timestamps: 12.5px
    sub: 12.5,          // Captions fallback
    chip: 13.5,         // Chips: 13.5px
    body: 15,           // Body: 15px
    base: 15,           // Base text: 15px
    button: 14.5,       // Buttons: 13.5 to 15px
    md: 15,
    lg: 16,
    xl: 17,
    section: 17,        // Section titles: 17px
    h6: 14,
    h5: 15,
    h4: 17,             // Section headings: 17px
    h3: 19,
    h2: 22,
    screenTitle: 26,    // Screen titles: 26px
    h1: 26,             // Screen titles: 26px
    display: 32,
    hero: 40,
    amount: 52,         // Big amounts: 52px
  },
};

/**
 * Standard Typography Presets for Consistent React Native Styling
 */
export const typographyPresets = {
  bigAmount: {
    fontFamily: typography.fonts.numbers,
    fontSize: typography.sizes.amount,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums' as const],
  },
  screenTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.screenTitle,
    fontWeight: '700' as const,
    letterSpacing: -0.52,
  },
  sectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.section,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: typography.sizes.body,
    fontWeight: '500' as const,
  },
  caption: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    fontWeight: '400' as const,
  },
  uppercaseLabel: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: typography.sizes.sm,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: typography.sizes.button,
    fontWeight: '700' as const,
    letterSpacing: -0.15,
  },
  chip: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: typography.sizes.chip,
    fontWeight: '600' as const,
    letterSpacing: -0.135,
  },
  tabularNumber: {
    fontFamily: typography.fonts.numbers,
    fontVariant: ['tabular-nums' as const],
  },
};
