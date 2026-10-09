import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { typography, radii, shadows, useTheme, Theme } from '../../theme';

interface SegmentedControlProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (option: T) => void;
  style?: ViewStyle;
  theme?: 'light' | 'dark';
}

export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  style,
  theme: propTheme,
}: SegmentedControlProps<T>) {
  const { theme, isDark: ctxIsDark } = useTheme();
  const isDark = propTheme ? propTheme === 'dark' : ctxIsDark;
  const isCompact = options.length >= 5;
  const styles = useMemo(() => createStyles(theme, isDark, isCompact), [theme, isDark, isCompact]);

  const handleSelect = (opt: T) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onSelect(opt);
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer, style]}>
      {options.map((opt) => {
        const isSelected = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => handleSelect(opt)}
            activeOpacity={0.8}
            style={[
              styles.option,
              isSelected && (isDark ? styles.darkSelectedOption : styles.selectedOption),
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              style={[
                styles.optionText,
                isDark && styles.darkOptionText,
                isSelected && styles.selectedOptionText,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean, isCompact = false) => {
  const colors = theme.colors;
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      padding: 3,
      minHeight: 38,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isCompact ? 5 : 6,
      paddingHorizontal: isCompact ? 2 : 6,
      borderRadius: radii.pill,
    },
    selectedOption: {
      backgroundColor: colors.primary,
      ...shadows.sm,
    },
    darkContainer: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      boxShadow: 'none' as any,
    },
    darkSelectedOption: {
      backgroundColor: colors.primary,
      ...shadows.sm,
    },
    darkOptionText: {
      color: colors.textSecondary,
    },
    optionText: {
      fontFamily: typography.fonts.bodySemiBold,
      fontSize: isCompact ? 11.5 : typography.sizes.chip,
      color: colors.textMuted,
      fontWeight: '600',
      letterSpacing: isCompact ? -0.2 : -0.135,
      textAlign: 'center',
    },
    selectedOptionText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.bodySemiBold,
      fontWeight: '700',
      letterSpacing: isCompact ? -0.2 : -0.135,
    },
  });
};
