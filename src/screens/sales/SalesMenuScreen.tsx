import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
  RefreshControl,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItemTile } from '../../components/sales/ItemTile';
import { CartBar } from '../../components/sales/CartBar';
import { TableManagementModal } from '../../components/sales/TableManagementModal';
import { AppButton } from '../../components/common/AppButton';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { menuService } from '../../services/menuService';
import { billingService } from '../../services/billingService';
import { MenuItem, MenuCategory } from '../../types/models';
import { supabase } from '../../lib/supabase';
import { storage } from '../../lib/storage';

interface SalesMenuScreenProps {
  onGoToBill: () => void;
  onOpenMenuEditor: (openAddItemDirectly?: boolean) => void;
  selectedCategoryName?: string;
}

const UniqueAnimatedMenuEditorButton: React.FC<{
  onPress: () => void;
  theme: Theme;
}> = ({ onPress, theme }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
          onPress();
        }}
        style={[
          stylesUniqueMenuBtn.btn,
          {
            backgroundColor: theme.isDark ? '#27272A' : '#FFF3EB',
            borderColor: theme.isDark ? 'rgba(255, 95, 0, 0.45)' : 'rgba(255, 95, 0, 0.35)',
          },
        ]}
        accessibilityLabel="Edit Menu"
      >
        <Animated.View style={[stylesUniqueMenuBtn.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="sparkles" size={11} color="#FF5F00" />
        </Animated.View>
        <Text style={stylesUniqueMenuBtn.text}>Menu</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const stylesUniqueMenuBtn = StyleSheet.create({
  btn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    ...shadows.sm,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 95, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '800',
    color: '#FF5F00',
    letterSpacing: 0.2,
  },
  editBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const SalesMenuScreen: React.FC<SalesMenuScreenProps> = ({
  onGoToBill,
  onOpenMenuEditor,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { shop, subscriptionStatus } = useShop();
  const { can } = useAuth();
  const { t } = useLanguage();
  const {
    cart,
    addItem,
    addCustomItem,
    getItemQty,
    decreaseItem,
    subtotal,
    totalCount,
    selectedTable,
    setSelectedTable,
    flash,
  } = useCart();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [mostlyUsedIds, setMostlyUsedIds] = useState<Set<string>>(new Set());
  const [mostlyUsedCountMap, setMostlyUsedCountMap] = useState<Map<string, number>>(new Map());
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0); // 0 = 'All'
  const [searchQuery, setSearchQuery] = useState('');
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // 1. Instant local cache load for zero-latency screen rendering
    const loadCachedFirst = async () => {
      if (!shop.id) return;
      const cachedCats = await storage.getObject<MenuCategory[] | null>('@counterpro/menu_categories', null);
      const cachedItems = await storage.getObject<MenuItem[] | null>('@counterpro/menu_items', null);
      if (cachedCats && cachedCats.length > 0 && cachedCats[0].shopId === shop.id) {
        setCategories(cachedCats);
      }
      if (cachedItems && cachedItems.length > 0 && cachedItems[0].shopId === shop.id) {
        setItems(cachedItems);
      }
    };
    loadCachedFirst();

    // 2. Fetch fresh authoritative state from Supabase
    loadMenu();

    if (!shop.id) return;

    // 3. Supabase Realtime listener — instant sync whenever any device (iOS / Android / Web) adds/edits a category or item
    const channel = supabase
      .channel(`menu-sync-${shop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadMenu();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop.id, shop.shopType]);

  const loadMenu = async () => {
    const cats = await menuService.getCategories(shop.id, shop.shopType);
    const menuItems = await menuService.getMenuItems(shop.id, shop.shopType);
    setCategories(cats);
    setItems(menuItems);

    try {
      const bills = await billingService.getBills(shop.id);
      const counts = new Map<string, number>();
      for (const bill of bills) {
        if (bill.status === 'cancelled' || bill.isDeleted || bill.status === 'deleted') continue;
        for (const itm of bill.items || []) {
          const qty = Number(itm.quantity || 1);
          if (itm.menuItemId) {
            counts.set(itm.menuItemId, (counts.get(itm.menuItemId) || 0) + qty);
          }
          if (itm.itemName) {
            const cleanName = itm.itemName.toLowerCase().trim();
            counts.set(cleanName, (counts.get(cleanName) || 0) + qty);
          }
        }
      }

      const countMap = new Map<string, number>();
      // Rank items strictly by actual ordered quantity frequency
      const ranked = menuItems
        .map(i => {
          const directCount = counts.get(i.id) || 0;
          const nameCount = counts.get(i.name.toLowerCase().trim()) || 0;
          const totalQty = Math.max(directCount, nameCount);
          countMap.set(i.id, totalQty);
          return { item: i, count: totalQty };
        })
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);

      const topIds = new Set<string>();
      for (const r of ranked.slice(0, 12)) {
        topIds.add(r.item.id);
      }

      setMostlyUsedIds(topIds);
      setMostlyUsedCountMap(countMap);
    } catch {
      setMostlyUsedIds(new Set());
      setMostlyUsedCountMap(new Map());
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMenu();
    setIsRefreshing(false);
  };

  const displayCategories = [
    { id: 'all', name: t('all_items', 'All Items'), shopId: shop.id, sortOrder: -1, isActive: true },
    ...(mostlyUsedIds.size > 0
      ? [{ id: 'mostly_used', name: `🔥 ${t('mostly_used', 'Mostly Used')}`, shopId: shop.id, sortOrder: -0.5, isActive: true }]
      : []),
    ...categories,
  ];

  const safeCatIndex = (activeCategoryIndex >= 0 && activeCategoryIndex < displayCategories.length)
    ? activeCategoryIndex
    : 0;

  const currentCategory = safeCatIndex === 0 ? null : displayCategories[safeCatIndex];
  const q = searchQuery.trim().toLowerCase();

  const baseItems = q
    ? items.filter(i => i.name.toLowerCase().includes(q))
    : currentCategory?.id === 'mostly_used'
    ? items.filter(i => (mostlyUsedCountMap.get(i.id) || 0) > 0)
    : currentCategory
    ? items.filter(i => i.categoryId === currentCategory.id || (i as any).category === currentCategory.name)
    : items;

  const filteredItems = baseItems.slice().sort((a, b) => {
    const aCount = mostlyUsedCountMap.get(a.id) || 0;
    const bCount = mostlyUsedCountMap.get(b.id) || 0;

    // 1. Mostly used items strictly ordered by higher sales quantity first
    if (aCount > 0 || bCount > 0) {
      if (aCount !== bCount) {
        return bCount - aCount;
      }
    }

    // 2. Favorites prioritized next
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    // 3. Sort order
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
    // 4. Alphabetical fallback
    return a.name.localeCompare(b.name);
  });

  const { width: windowWidth } = useWindowDimensions();
  // 3 items in a row: 16px left + 16px right + 2 gaps of 10px = 52px total spacing
  const tileSize = Math.floor((windowWidth - 52) / 3);
  const tileHeight = Math.floor(tileSize * 1.15);

  const menuGridData = React.useMemo(() => {
    if (!can('menu')) return filteredItems;
    return [
      ...filteredItems,
      {
        id: '__ADD_NEW_PRODUCT_TILE__',
        isAddTile: true,
        name: 'Add Product',
        price: 0,
        categoryId: currentCategory?.id || '',
      } as any,
    ];
  }, [filteredItems, can, currentCategory]);

  const handleProceedToBill = () => {
    if (!can('bill')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    if (subscriptionStatus.billLimitReached && !subscriptionStatus.isPaidActive) {
      flash('Free limit of 100 bills reached. Upgrade to Pro to continue.');
      return;
    }
    onGoToBill();
  };

  return (
    <View style={styles.container}>
      {/* Top Search, Table Selector (if enabled), & Menu Editor Button */}
      <View style={styles.topSearchRow}>
        <View style={styles.searchBoxWrapper}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_items', 'Search items...')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {shop.tableManagementEnabled && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setIsTableModalOpen(true);
            }}
            style={[
              styles.tableSelectBtn,
              selectedTable ? styles.tableSelectBtnActive : null,
            ]}
          >
            <Ionicons
              name="restaurant-outline"
              size={15}
              color={selectedTable ? '#FFFFFF' : (theme.isDark ? colors.accent : colors.accent700)}
            />
            <Text
              style={[
                styles.tableBtnText,
                selectedTable ? styles.tableBtnTextActive : null,
              ]}
              numberOfLines={1}
            >
              {selectedTable ? selectedTable.replace('Table ', 'T-') : t('table', 'Table')}
            </Text>
          </TouchableOpacity>
        )}

        {can('menu') && (
          <UniqueAnimatedMenuEditorButton
            onPress={() => {
              if (!can('menu')) {
                flash(t('no_access', "You don't have access for that"));
                return;
              }
              onOpenMenuEditor();
            }}
            theme={theme}
          />
        )}
      </View>

      {/* Staff Permission Override: Billing Locked Banner */}
      {!can('bill') && (
        <View style={styles.billingLockedBanner}>
          <Ionicons name="lock-closed" size={15} color="#DC2626" />
          <Text style={styles.billingLockedText}>
            Billing access is disabled for your account. Please contact the owner.
          </Text>
        </View>
      )}

      {/* 100-Bills Free Tier Limit Reached Banner */}
      {subscriptionStatus.billLimitReached && !subscriptionStatus.isPaidActive && (
        <View style={styles.limitBanner}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.limitBannerText}>
            Free limit of 100 bills reached. Upgrade to Pro to continue creating bills.
          </Text>
        </View>
      )}

      {/* Horizontal Categories Scroll */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {displayCategories.map((cat, idx) => {
            const isSelected = idx === activeCategoryIndex && !q;
            return (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.8}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setActiveCategoryIndex(idx);
                  setSearchQuery('');
                }}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tap / Hold / Minus Helper Text */}
      <Text style={styles.helperText}>TAP = FULL · HOLD = HALF · [−] = MINUS</Text>

      {/* Grid of Item Tiles */}
      {filteredItems.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyCatBox}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <Text style={styles.emptyCatText}>
            Nothing in {currentCategory?.name || 'this category'} yet.
          </Text>
          <AppButton
            title="Add the first item"
            variant="secondary"
            onPress={() => {
              if (!can('menu')) {
                flash(t('no_access', "You don't have access for that"));
                return;
              }
              onOpenMenuEditor();
            }}
            style={styles.addFirstBtn}
          />
        </ScrollView>
      ) : (
        <FlatList
          key="grid-cols-3"
          data={menuGridData}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) => {
            if (item.isAddTile) {
              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    if (!can('menu')) {
                      flash(t('no_access', "You don't have access for that"));
                      return;
                    }
                    onOpenMenuEditor(true);
                  }}
                  style={[styles.addTileContainer, { width: tileSize, height: tileHeight }]}
                  accessibilityLabel="Add New Product"
                >
                  <View style={styles.addTileIconCircle}>
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.addTileTitle} numberOfLines={1}>{t('add_product', 'Add Product')}</Text>
                  <Text style={styles.addTileSub} numberOfLines={1}>+ New</Text>
                </TouchableOpacity>
              );
            }
            return (
              <ItemTile
                item={item}
                categoryName={categories.find(c => c.id === item.categoryId)?.name || currentCategory?.name}
                quantity={getItemQty(item.id)}
                isMostlyUsed={mostlyUsedIds.has(item.id)}
                onAddFull={() => {
                  if (!can('bill')) {
                    flash(t('no_access', "You don't have access for that"));
                    return;
                  }
                  addItem(item, false);
                }}
                onAddHalf={() => {
                  if (!can('bill')) {
                    flash(t('no_access', "You don't have access for that"));
                    return;
                  }
                  addItem(item, true);
                }}
                onDecrease={() => decreaseItem(item.id)}
                onSoldOutNotice={() => flash(`${item.name} is marked sold out`)}
              />
            );
          }}
        />
      )}

      {/* Bottom Cart Bar */}
      <CartBar
        totalAmount={subtotal}
        totalCount={totalCount}
        paymentMode="Cash"
        onGoToBill={handleProceedToBill}
      />

      {/* Premium Dining Table Management Modal */}
      <TableManagementModal
        visible={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
      />
    </View>
  );
};

const createStyles = (theme: Theme, insets?: { top: number; bottom: number; left: number; right: number }) => {
  const colors = theme.colors;
  const bottomInset = insets?.bottom || 0;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 10,
  },
  topSearchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    alignItems: 'center',
    gap: 8,
  },
  searchBoxWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 11,
    zIndex: 2,
  },
  searchInput: {
    width: '100%',
    height: 38,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingLeft: 34,
    paddingRight: 30,
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: colors.inputText,
    ...shadows.card,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  categoryScrollContainer: {
    paddingBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  categoryPillSelected: {
    backgroundColor: theme.isDark ? colors.accent : '#111111',
    borderColor: theme.isDark ? colors.accent : '#111111',
  },
  categoryText: {
    fontFamily: typography.fonts.heading,
    fontSize: 13.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  helperText: {
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.textMuted,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: Math.max(bottomInset, 16) + 84,
    gap: 10,
  },
  gridRow: {
    gap: 10,
    justifyContent: 'flex-start',
  },
  emptyCatBox: {
    margin: 16,
    padding: 28,
    backgroundColor: colors.surface,
    borderRadius: 22,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  emptyCatText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstBtn: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: 14,
  },
  tableSelectBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.card,
  },
  tableSelectBtnActive: {
    backgroundColor: theme.isDark ? colors.accent : '#111111',
    borderColor: theme.isDark ? colors.accent : '#111111',
  },
  tableBtnIcon: {
    fontSize: 14,
  },
  tableBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    color: colors.text,
    fontWeight: '700',
  },
  tableBtnTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay55,
    justifyContent: 'flex-end',
  },
  tableModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 20,
    maxHeight: '82%',
    gap: 16,
    ...shadows.lg,
  },
  tableModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tableModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
    fontWeight: '700',
  },
  tableModalSub: {
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700',
  },
  tableGrid: {
    gap: 10,
    paddingBottom: 10,
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    ...shadows.card,
  },
  tableCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent100,
    borderWidth: 2,
  },
  tableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableCardIcon: {
    fontSize: 24,
  },
  tableCardNumber: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: '700',
  },
  tableCardSeat: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  activeTableBadge: {
    backgroundColor: colors.brandOrangeSubtle,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandOrangeBorder,
  },
  activeTableBadgeText: {
    color: colors.accent,
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '700',
  },
  tableCardPlusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 9,
    gap: 6,
  },
  tableCardPlusBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tablePlusIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  tablePlusText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontWeight: '700',
  },
  clearTableModalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  clearTableModalText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  billingLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
  },
  billingLockedText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: '#DC2626',
    fontWeight: '700',
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
  },
  limitBannerText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: '#DC2626',
    fontWeight: '600',
  },
  addTileContainer: {
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.06)' : '#FFF7ED',
    borderWidth: 1.5,
    borderColor: theme.isDark ? 'rgba(255, 95, 0, 0.35)' : '#FDBA74',
    borderStyle: 'dashed',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
    ...shadows.sm,
  },
  addTileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
    color: colors.text,
    textAlign: 'center',
  },
  addTileSub: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
    color: colors.accent,
    textAlign: 'center',
  },
  });
};

