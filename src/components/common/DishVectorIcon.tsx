import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { getPhosphorIconConfig } from '../../constants/phosphorDishIcons';
import { useTheme } from '../../theme';

interface DishVectorIconProps {
  dishName?: string;
  categoryName?: string;
  size?: number;
  color?: string;
  showBadge?: boolean;
  style?: StyleProp<ViewStyle>;
  customImageUrl?: string | null;
  overrideIconKey?: string | null;
}

export const DishVectorIcon: React.FC<DishVectorIconProps> = ({
  dishName = '',
  categoryName,
  size = 24,
  color,
  showBadge = true,
  style,
  overrideIconKey,
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark;

  const iconConfig = getPhosphorIconConfig(dishName, categoryName, overrideIconKey);
  const PhosphorIcon = iconConfig.IconComponent;
  const iconColor = color || iconConfig.tintColor;

  const badgeSize = Math.max(36, Math.round(size * 1.55));
  const badgeRadius = Math.round(badgeSize * 0.36);

  const badgeBg = isDark ? iconConfig.darkBg : iconConfig.pastelBg;
  const badgeBorder = isDark ? iconConfig.darkBorder : iconConfig.borderColor;

  return (
    <View style={[styles.container, style]}>
      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeRadius,
              backgroundColor: badgeBg,
              borderColor: badgeBorder,
              shadowColor: isDark ? '#000000' : iconColor,
            },
          ]}
        >
          <PhosphorIcon
            size={size}
            weight="duotone"
            color={iconColor}
          />
        </View>
      ) : (
        <PhosphorIcon
          size={size}
          weight="duotone"
          color={iconColor}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
});
