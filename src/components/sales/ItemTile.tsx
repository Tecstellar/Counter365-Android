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
  // 3 columns with 16px side padding and 10px gaps
  const defaultTileSize = Math.floor((windowWidth - 52) / 3);
  const size = customTileSize || defaultTileSize;
  const photoHeight = Math.round(size * 0.46);

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

  const handleLongPress = () => {
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
        { width: size, minHeight: size, transform: [{ scale: scaleAnim }] },
        hasQty && styles.tileInCart,
        isSoldOut && styles.tileSoldOut,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        delayPressIn={0}
        delayLongPress={430}
        pressRetentionOffset={{ top: 6, left: 6, right: 6, bottom: 6 }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={handleLongPress}
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
                shadowColor: isDark ? '#000000' : iconConfig.tintColor,
              },
            ]}
          >
            <PhosphorIcon
              size={20}
              weight="duotone"
              color={iconConfig.tintColor}
            />
          </View>
        </View>

        {/* Name and Price */}
        <View style={styles.infoBox}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {priceLabel}
            </Text>
            {/* Small + action button */}
            <View style={styles.addMiniBtn}>
              <Ionicons name="add" size={12} color="#FD5E03" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Quantity badge: top-right */}
      {hasQty && (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyText}>{quantity}</Text>
        </View>
      )}

      {/* Mostly Used Flame Badge: compact fire icon badge */}
      {isMostlyUsed && !hasQty && (
        <View style={styles.mostlyUsedBadge}>
          <Ionicons name="flame" size={11} color="#FFFFFF" />
        </View>
      )}

      {/* Minus badge: top-left */}
      {hasQty && onDecrease && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onDecrease}
          style={styles.minusBadge}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.minusText}>−</Text>
        </TouchableOpacity>
      )}

      {/* Sold Out Overlay */}
      {isSoldOut && (
        <View style={styles.soldOutOverlay} pointerEvents="none">
          <Text style={styles.soldOutText}>SOLD OUT</Text>
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.card,
  },
  tilePressable: {
    flex: 1,
    flexDirection: 'column',
  },
  tileInCart: {
    backgroundColor: colors.surface,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoBox: {
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 6,
    gap: 2,
  },
  name: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    lineHeight: 16,
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
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    flex: 1,
  },
  addMiniBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mostlyUsedBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FD5E03',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
    elevation: 3,
    shadowColor: '#FD5E03',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  minusBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 5,
  },
  minusText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qtyBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    backgroundColor: '#FF5F00',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
    elevation: 5,
  },
  qtyText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay70,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  soldOutText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.text,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  });
};
