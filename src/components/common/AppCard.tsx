import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';

interface AppCardProps {
  kicker?: string;
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'neutral' | 'accent' | 'blueprint' | 'brand';
}

export const AppCard: React.FC<AppCardProps> = ({
  kicker,
  title,
  children,
  style,
  variant = 'neutral',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':  return styles.elevated;
      case 'accent':    return styles.accent;
      case 'blueprint': return styles.blueprint;
      case 'brand':     return styles.brand;
      case 'neutral':
      default:          return styles.neutral;
    }
  };

  const isOnDark = variant === 'accent' || variant === 'brand';

  return (
    <View style={[styles.card, getVariantStyle(), style]}>
      {kicker && (
        <Text style={[styles.kicker, isOnDark && styles.kickerOnDark]}>
          {kicker}
        </Text>
      )}
      {title && (
        <Text style={[styles.title, isOnDark && styles.titleOnDark]}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: radii.lg,
    gap: spacing.xs,
  },

  neutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  accent: {
    backgroundColor: colors.accent,
    ...shadows.orangeGlow,
  },
  blueprint: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  brand: {
    backgroundColor: theme.isDark ? colors.surfaceElevated : '#111111',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },

  kicker: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  kickerOnDark: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '700',
  },
  titleOnDark: {
    color: '#FFFFFF',
  },
  });
};
