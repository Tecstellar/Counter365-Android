import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, radii } from '../../theme';

interface AppTagProps {
  label: string;
  variant?: 'accent' | 'neutral' | 'outline' | 'danger' | 'success' | 'warning';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const AppTag: React.FC<AppTagProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'accent':  return styles.accent;
      case 'outline': return styles.outline;
      case 'danger':  return styles.danger;
      case 'success': return styles.success;
      case 'warning': return styles.warning;
      case 'neutral':
      default:        return styles.neutral;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'accent':  return styles.accentText;
      case 'outline': return styles.outlineText;
      case 'danger':  return styles.dangerText;
      case 'success': return styles.successText;
      case 'warning': return styles.warningText;
      case 'neutral':
      default:        return styles.neutralText;
    }
  };

  return (
    <View style={[styles.base, getVariantStyle(), style]}>
      <Text style={[styles.baseText, getTextStyle(), textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  baseText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: typography.sizes.sm,
    letterSpacing: 0.2,
    fontWeight: '700',
  },

  // Variants
  accent: {
    backgroundColor: colors.accent100,
  },
  accentText: {
    color: colors.accent700,
  },

  neutral: {
    backgroundColor: colors.neutral200,
  },
  neutralText: {
    color: colors.textMuted,
  },

  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  outlineText: {
    color: colors.textMuted,
  },

  danger: {
    backgroundColor: '#FDEAEA',
  },
  dangerText: {
    color: colors.danger,
  },

  success: {
    backgroundColor: '#E8F5EF',
  },
  successText: {
    color: '#0D6E40',
  },

  warning: {
    backgroundColor: '#FEF3E2',
  },
  warningText: {
    color: '#9A5C00',
  },
});
