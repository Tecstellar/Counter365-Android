import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';

interface AppButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'outline' | 'neutral' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  haptic?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  disabled = false,
  loading = false,
  children,
  icon,
  haptic = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

  const getContainerStyle = () => {
    switch (variant) {
      case 'primary':   return styles.primary;
      case 'dark':      return styles.dark;
      case 'secondary': return styles.secondary;
      case 'ghost':     return styles.ghost;
      case 'outline':   return styles.outline;
      case 'icon':      return styles.iconBtn;
      case 'neutral':   return styles.neutral;
      case 'danger':    return styles.danger;
      default:          return styles.primary;
    }
  };

  const getSizeStyle = () => {
    if (variant === 'icon') return null;
    switch (size) {
      case 'sm': return styles.sizeSm;
      case 'lg': return styles.sizeLg;
      case 'md':
      default:   return styles.sizeMd;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':   return styles.primaryText;
      case 'dark':      return styles.darkText;
      case 'secondary': return styles.secondaryText;
      case 'ghost':     return styles.ghostText;
      case 'outline':   return styles.outlineText;
      case 'neutral':   return styles.neutralText;
      case 'danger':    return styles.dangerText;
      default:          return styles.primaryText;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'sm': return styles.textSizeSm;
      case 'lg': return styles.textSizeLg;
      case 'md':
      default:   return styles.textSizeMd;
    }
  };

  const loaderColor =
    variant === 'primary' || variant === 'dark' || variant === 'danger'
      ? '#FFFFFF'
      : colors.text;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        getSizeStyle(),
        getContainerStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={loaderColor} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          {title ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              style={[getTextStyle(), getTextSizeStyle(), textStyle]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    base: {
      borderRadius: radii.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    sizeSm: {
      minHeight: 36,
      paddingHorizontal: 14,
    },
    sizeMd: {
      minHeight: 46,
      paddingHorizontal: 20,
    },
    sizeLg: {
      minHeight: 52,
      paddingHorizontal: 24,
    },
    textSizeSm: {
      fontSize: 13,
    },
    textSizeMd: {
      fontSize: 14.5,
    },
    textSizeLg: {
      fontSize: 15,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Primary — Refined Counter365 Brand Orange Accent CTA
    primary: {
      backgroundColor: colors.accent,
      ...shadows.orangeGlow,
    },
    primaryText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '700',
      letterSpacing: -0.15,
    },

    // Dark — Obsidian Black / Elevated Dark Surface Button
    dark: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#111111',
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: colors.border,
      ...shadows.sm,
    },
    darkText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '700',
      letterSpacing: -0.15,
    },

    // Secondary — Crisp Surface with subtle border
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    secondaryText: {
      color: colors.text,
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '600',
      letterSpacing: -0.15,
    },

    // Ghost — Transparent, no border
    ghost: {
      backgroundColor: 'transparent',
      paddingHorizontal: 8,
    },
    ghostText: {
      color: colors.accent,
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '600',
      letterSpacing: -0.15,
    },

    // Outline — Transparent with subtle border
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlineText: {
      color: colors.text,
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '600',
      letterSpacing: -0.15,
    },

    // Neutral — Soft neutral button with border
    neutral: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    neutralText: {
      color: colors.text,
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '600',
      letterSpacing: -0.15,
    },

    // Danger — Destructive action
    danger: {
      backgroundColor: colors.danger,
      ...shadows.sm,
    },
    dangerText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '700',
      letterSpacing: -0.15,
    },

    // Icon-only button with tactile POS framing
    iconBtn: {
      width: 38,
      height: 38,
      minHeight: 38,
      paddingHorizontal: 0,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    disabled: {
      opacity: 0.40,
      shadowOpacity: 0,
      elevation: 0,
    },
  });
};
