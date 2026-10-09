import React, { useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Image } from 'react-native';
import { getDishImageUrl } from '../../constants/dishImages';

const LOCAL_DISH_FALLBACK = require('../../../assets/images/fast_billing.jpg');

interface DishVectorIconProps {
  dishName?: string;
  categoryName?: string;
  size?: number;
  color?: string;
  showBadge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const DishVectorIcon: React.FC<DishVectorIconProps> = ({
  dishName = '',
  categoryName,
  size = 24,
  showBadge = true,
  style,
}) => {
  const [loadError, setLoadError] = useState(false);
  const imageUrl = getDishImageUrl(dishName, categoryName);
  const badgeSize = Math.max(34, Math.round(size * 1.55));
  const badgeRadius = Math.round(badgeSize / 2);

  if (!showBadge) {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={loadError ? LOCAL_DISH_FALLBACK : { uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: 4 }}
          resizeMode="cover"
          onError={() => setLoadError(true)}
        />
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
            overflow: 'hidden',
          },
        ]}
      >
        <Image
          source={loadError ? LOCAL_DISH_FALLBACK : { uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setLoadError(true)}
        />
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
