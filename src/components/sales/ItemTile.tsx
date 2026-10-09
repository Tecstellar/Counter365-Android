import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';
import { MenuItem } from '../../types/models';
import { formatRupee } from '../../lib/money';
import { getDishImageUrl } from '../../constants/dishImages';

const LOCAL_FALLBACK_DISH_IMAGE = require('../../../assets/images/fast_billing.jpg');

interface ItemTileProps {
  item: MenuItem;
  categoryName?: string;
  quantity: number;
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
  const photoHeight = Math.round(size * 0.52);

  const [imageError, setImageError] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

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

  const catalogPhotoUri = getDishImageUrl(item.name, categoryName);
  const photoUri = !imageError && item.imageUrl ? item.imageUrl : catalogPhotoUri;

  const isGenerating = item.imageStatus === 'generating';

  return (
    <View
      style={[
        styles.tileContainer,
        { width: size, minHeight: size },
        hasQty && styles.tileInCart,
        isSoldOut && styles.tileSoldOut,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.72}
        delayPressIn={60}
        delayLongPress={430}
        pressRetentionOffset={{ top: 4, left: 4, right: 4, bottom: 4 }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={styles.tilePressable}
      >
        {/* Photo Container - Guaranteed Dish Photography Image, Zero Vector Icons */}
        <View style={[styles.photoBox, { height: photoHeight }]}>
          {isGenerating ? (
            <View style={styles.generatingBox}>
              <ActivityIndicator size="small" color="#FD5E03" />
              <Text style={styles.generatingText}>AI Photo...</Text>
            </View>
          ) : catalogError ? (
            <Image
              source={LOCAL_FALLBACK_DISH_IMAGE}
              style={styles.photoImage}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={{ uri: photoUri }}
              style={styles.photoImage}
              resizeMode="cover"
              onError={() => {
                if (!imageError && item.imageUrl) {
                  setImageError(true);
                } else {
                  setCatalogError(true);
                }
              }}
            />
          )}
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
              <Ionicons name="add" size={13} color="#FD5E03" />
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
    </View>
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
  photoBox: {
    width: '100%',
    backgroundColor: colors.accent100,
    overflow: 'hidden',
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent100,
  },
  generatingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent100,
    gap: 4,
  },
  generatingText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FF5F00',
  },
  infoBox: {
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 9,
    gap: 4,
  },
  name: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    flex: 1,
  },
  addMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 6,
  },
  minusText: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qtyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    backgroundColor: '#FF5F00',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
    elevation: 5,
  },
  qtyText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11.5,
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
