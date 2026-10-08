import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getDishVectorIconConfig } from '../../constants/dishIcons';

interface DishVectorIconProps {
  dishName?: string;
  categoryName?: string;
  size?: number;
  color?: string;
  showBadge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const DishVectorIcon: React.FC<DishVectorIconProps> = ({
  dishName,
  categoryName,
  size = 24,
  color,
  showBadge = true,
  style,
}) => {
  const config = getDishVectorIconConfig(dishName, categoryName);
  const iconColor = color || config.color;

  const badgeSize = Math.max(34, Math.round(size * 1.55));
  const badgeRadius = Math.round(badgeSize / 2);

  if (!showBadge) {
    return (
      <View style={[styles.container, style]}>
        {config.family === 'Ionicons' ? (
          <Ionicons name={config.name as any} size={size} color={iconColor} />
        ) : (
          <MaterialCommunityIcons name={config.name as any} size={size} color={iconColor} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeRadius,
            backgroundColor: `${iconColor}15`,
            borderColor: `${iconColor}25`,
          },
        ]}
      >
        {config.family === 'Ionicons' ? (
          <Ionicons name={config.name as any} size={size} color={iconColor} />
        ) : (
          <MaterialCommunityIcons name={config.name as any} size={size} color={iconColor} />
        )}
      </View>
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
  },
});
