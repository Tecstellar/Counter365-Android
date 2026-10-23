import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';
import { MenuItem } from '../../types/models';
import { formatRupee } from '../../lib/money';
import { getPhosphorIconConfig } from '../../constants/phosphorDishIcons';

interface ItemTileProps {
  item: MenuItem;
  categoryName?: string;
  quantity: number;
  isMostlyUsed?: boolean;
  onAddFull: () => void;
  onAddHalf: () => void;
  onDecrease?: () => void;
  onSoldOutNotice: () => void;
  tileSize?: number;
}

export const ItemTile: React.FC<ItemTileProps> = ({
  item,
  categoryName,
  quantity,
  isMostlyUsed,
  onAddFull,
  onAddHalf,
  onDecrease,
  onSoldOutNotice,
  tileSize: customTileSize,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  // 4 columns with responsive spacing
  const defaultTileSize = Math.floor((windowWidth - 36) / 4);
  const size = customTileSize || defaultTileSize;
  const photoHeight = Math.round(size * 0.40);

  // Subtle tap scale animation (scale to 0.96)
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    if (!item.isAvailable) {
      onSoldOutNotice();
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onAddFull();
  };

  const handleLongPressHalf = () => {
    if (!item.isAvailable) {
      onSoldOutNotice();
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onAddHalf();
  };

  const hasQty = quantity > 0;
  const isSoldOut = !item.isAvailable;

  const priceLabel =
    formatRupee(item.price) +
    (item.hasHalf && item.halfPrice ? ` · ½${formatRupee(item.halfPrice)}` : '');

  const iconConfig = getPhosphorIconConfig(item.name, categoryName, item.icon);
  const PhosphorIcon = iconConfig.IconComponent;
  const isDark = theme.isDark;

  return (
    <Animated.View
      style={[
        styles.tileContainer,
        {
          width: size,
          minHeight: size,
          transform: [{ scale: scaleAnim }],
        },
        hasQty && styles.tileInCart,
        isSoldOut && styles.tileSoldOut,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        onLongPress={handleLongPressHalf}
        delayLongPress={350}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tilePressable}
      >
        {/* Phosphor Duotone Vector Icon Stage */}
        <View
          style={[
            styles.iconBanner,
            {
              height: photoHeight,
              backgroundColor: isDark ? iconConfig.darkBg : iconConfig.pastelBg,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                borderColor: isDark ? iconConfig.darkBorder : iconConfig.borderColor,
              },
            ]}
          >
            <PhosphorIcon
              size={16}
              weight="duotone"
              color={iconConfig.tintColor}
            />
          </View>
        </View>

        {/* Text information banner */}
        <View style={styles.infoBox}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {priceLabel}
            </Text>
            <View style={styles.addMiniBtn}>
              <Ionicons name="add" size={13} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Quantity badge: top-right */}
      {hasQty && (
        <View style={styles.qtyBadge} pointerEvents="none">
          <Text style={styles.qtyText}>{quantity}</Text>
        </View>
      )}

      {/* Minus Badge: top-left (when item in cart) */}
      {hasQty && onDecrease && (
        <TouchableOpacity
          style={styles.minusBadge}
          onPress={(e) => {
            e.stopPropagation();
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onDecrease();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.minusText}>−</Text>
        </TouchableOpacity>
      )}

      {/* Mostly Used Popular Badge: top-left (only when not in cart) */}
      {!hasQty && isMostlyUsed && (
        <View style={styles.mostlyUsedBadge} pointerEvents="none">
          <Ionicons name="flame" size={12} color="#FFFFFF" />
        </View>
      )}
    </Animated.View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    tileContainer: {
      backgroundColor: colors.surface,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      position: 'relative',
      ...shadows.sm,
    },
    tilePressable: {
      flex: 1,
      flexDirection: 'column',
    },
    tileInCart: {
      borderColor: '#FF5F00',
      borderWidth: 2,
    },
    tileSoldOut: {
      opacity: 0.55,
    },
    iconBanner: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
      elevation: 2,
    },
    infoBox: {
      paddingHorizontal: 4,
      paddingTop: 3,
      paddingBottom: 4,
      gap: 1,
    },
    name: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      lineHeight: 13,
      fontWeight: '700',
      color: colors.text,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 1,
    },
    price: {
      fontSize: 10.5,
      lineHeight: 13,
      color: colors.text,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      flex: 1,
    },
    addMiniBtn: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mostlyUsedBadge: {
      position: 'absolute',
      top: 4,
      left: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#FD5E03',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      elevation: 4,
    },
    minusBadge: {
      position: 'absolute',
      top: 4,
      left: 4,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 3,
      backgroundColor: colors.danger,
      borderRadius: 8.5,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      elevation: 4,
    },
    minusText: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      lineHeight: 12,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    qtyBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 3,
      backgroundColor: '#FF5F00',
      borderRadius: 8.5,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9,
      elevation: 4,
    },
    qtyText: {
      fontFamily: typography.fonts.heading,
      fontSize: 9,
      color: '#FFFFFF',
      fontWeight: '800',
    },
  });
};
