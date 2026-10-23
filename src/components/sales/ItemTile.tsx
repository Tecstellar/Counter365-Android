import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  PanResponder,
  Platform,
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
  isFlying?: boolean;
  onAddFull: () => void;
  onAddHalf: () => void;
  onDecrease?: () => void;
  onSoldOutNotice: () => void;
  tileSize?: number;
  canManageMenu?: boolean;
  isOrganizeMode?: boolean;
  isPicked?: boolean;
  onPickItem?: (item: MenuItem) => void;
  onDragStart?: (item: MenuItem, pageX: number, pageY: number) => void;
  onDragMove?: (pageX: number, pageY: number) => void;
  onDragEnd?: (pageX: number, pageY: number) => void;
}

export const ItemTile: React.FC<ItemTileProps> = ({
  item,
  categoryName,
  quantity,
  isMostlyUsed,
  isFlying = false,
  onAddFull,
  onAddHalf,
  onDecrease,
  onSoldOutNotice,
  tileSize: customTileSize,
  canManageMenu = false,
  isOrganizeMode = false,
  isPicked = false,
  onPickItem,
  onDragStart,
  onDragMove,
  onDragEnd,
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
  const flyYAnim = useRef(new Animated.Value(0)).current;
  const flyScaleAnim = useRef(new Animated.Value(1)).current;
  const flyOpacityAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isFlying) {
      Animated.parallel([
        Animated.timing(flyYAnim, {
          toValue: -70,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(flyScaleAnim, {
          toValue: 0.3,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(flyOpacityAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      flyYAnim.setValue(0);
      flyScaleAnim.setValue(1);
      flyOpacityAnim.setValue(1);
    }
  }, [isFlying]);

  const isDraggingRef = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchStartTime = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Direct pull-to-drag, pick-and-put, and tap responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => !isDraggingRef.current,
      onPanResponderGrant: (evt) => {
        touchStartTime.current = Date.now();
        touchStartPos.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        isDraggingRef.current = false;
        handlePressIn();

        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        // In normal billing mode, long-press (380ms) auto-triggers Organize Pick mode without touching bill
        if (!isOrganizeMode && canManageMenu) {
          longPressTimer.current = setTimeout(() => {
            if (!isDraggingRef.current) {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
              onPickItem?.(item);
            }
          }, 380);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.hypot(gestureState.dx, gestureState.dy);
        if (dist > 8) {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          if (!isDraggingRef.current && canManageMenu) {
            isDraggingRef.current = true;
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
            onDragStart?.(item, evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
          if (isDraggingRef.current) {
            onDragMove?.(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        handlePressOut();
        const duration = Date.now() - touchStartTime.current;
        const dist = Math.hypot(gestureState.dx, gestureState.dy);

        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onDragEnd?.(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        } else if (dist < 10 && duration < 600) {
          if (isOrganizeMode) {
            // Organize Mode: Click picks item as copy, never touches the bill!
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            onPickItem?.(item);
          } else {
            // Billing Mode: Tap adds product to current bill
            handlePress();
          }
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        handlePressOut();
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onDragEnd?.(-1, -1);
        }
      },
    })
  ).current;

  const hasQty = quantity > 0;
  const isSoldOut = !item.isAvailable;

  const priceLabel =
    formatRupee(item.price) +
    (item.hasHalf && item.halfPrice ? ` · ½${formatRupee(item.halfPrice)}` : '');

  const iconConfig = getPhosphorIconConfig(item.name, categoryName, item.icon);
  const PhosphorIcon = iconConfig.IconComponent;
  const isDark = theme.isDark;

  const webDragProps = Platform.OS === 'web' ? {
    draggable: canManageMenu,
    onDragStart: (e: any) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', `item:${item.id}`);
        e.dataTransfer.effectAllowed = 'move';
      }
      onDragStart?.(item, e.clientX || 0, e.clientY || 0);
    },
    onDragEnd: (e: any) => {
      onDragEnd?.(e.clientX || 0, e.clientY || 0);
    },
  } : {};

  return (
    <Animated.View
      {...panResponder.panHandlers}
      {...webDragProps}
      style={[
        styles.tileContainer,
        {
          width: size,
          minHeight: size,
          transform: [
            { scale: Animated.multiply(scaleAnim, flyScaleAnim) },
            { translateY: flyYAnim },
          ],
          opacity: flyOpacityAnim,
        },
        hasQty && styles.tileInCart,
        isSoldOut && styles.tileSoldOut,
        isPicked && styles.tilePicked,
      ]}
    >
      {/* Picked Visual Indicator in Organize Mode */}
      {isPicked && (
        <View style={styles.pickedBadge} pointerEvents="none">
          <Ionicons name="copy" size={10} color="#FFFFFF" />
          <Text style={styles.pickedBadgeText}>PICKED</Text>
        </View>
      )}

      <View style={styles.tilePressable}>
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
              size={16}
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
      </View>

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
  const isDark = theme.isDark;
  return StyleSheet.create({
  tileContainer: {
    backgroundColor: colors.surface,
    borderRadius: 13,
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
  tilePicked: {
    borderColor: '#FF5F00',
    borderWidth: 2.5,
    backgroundColor: isDark ? 'rgba(255, 95, 0, 0.2)' : 'rgba(255, 95, 0, 0.1)',
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  pickedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF5F00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 15,
    elevation: 8,
  },
  pickedBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    zIndex: 8,
    elevation: 3,
    shadowColor: '#FD5E03',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
    elevation: 5,
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
    elevation: 5,
  },
  qtyText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
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
