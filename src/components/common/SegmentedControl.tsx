import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows } from '../../theme';

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
  theme = 'light',
}: SegmentedControlProps<T>) {
  const isDark = theme === 'dark';
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    padding: 3,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#EFECE6',
    ...shadows.card,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
  },
  selectedOption: {
    backgroundColor: colors.accent700,
    ...shadows.sm,
  },
  darkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'transparent',
    boxShadow: 'none' as any,
  },
  darkSelectedOption: {
    backgroundColor: colors.accent700,
    ...shadows.sm,
  },
  darkOptionText: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  optionText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: typography.sizes.chip,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: -0.135,
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
    letterSpacing: -0.135,
  },
});
