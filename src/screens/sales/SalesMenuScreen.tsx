import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TouchableWithoutFeedback,
  PanResponder,
  Platform,
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
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.2,
    ...shadows.sm,
  },
  text: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '800',
    color: '#FF5F00',
    letterSpacing: 0.2,
  },
});

interface CategoryPillProps {
  cat: { id: string; name: string };
  itemCount?: number;
  isSelected: boolean;
  onSelect: () => void;
  styles: any;
}

const CategoryPill: React.FC<CategoryPillProps> = ({
  cat,
  itemCount,
  isSelected,
  onSelect,
  styles,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
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
        numberOfLines={1}
      >
        {cat.name}
      </Text>

      {itemCount !== undefined && (
        <View
          style={[
            styles.categoryCountBadge,
            isSelected && styles.categoryCountBadgeSelected,
          ]}
        >
          <Text
            style={[
              styles.categoryCountText,
              isSelected && styles.categoryCountTextSelected,
            ]}
            numberOfLines={1}
          >
            {itemCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

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
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isUnidentifiedModalOpen, setIsUnidentifiedModalOpen] = useState(false);
  const [unidentifiedPriceInput, setUnidentifiedPriceInput] = useState('20');

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
          if (itm.itemName && itm.itemName.toLowerCase().includes('unidentified')) continue;
          if (itm.menuItemId === '__UNIDENTIFIED_PRODUCT_TILE__' || itm.menuItemId === 'unidentified') continue;
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

  const displayCategories = React.useMemo(() => {
    const list = [
      { id: 'all', name: t('all_items', 'All Items'), shopId: shop.id, sortOrder: -1, isActive: true },
    ];
    if (mostlyUsedIds.size > 0) {
      list.push({
        id: 'mostly_used',
        name: `🔥 ${t('mostly_used', 'Mostly Used')}`,
        shopId: shop.id,
        sortOrder: -0.5,
        isActive: true,
      } as MenuCategory);
    }
    return [...list, ...categories];
  }, [categories, mostlyUsedIds.size, shop.id, t]);

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
  // 4 items in a row: 16px left + 16px right + 3 gaps of 8px = 56px total spacing
  const tileSize = Math.floor((windowWidth - 56) / 4);
  const tileHeight = Math.floor(tileSize * 1.18);

  const categorySections = React.useMemo(() => {
    const sections: Array<{ id: string; name: string; items: MenuItem[] }> = [];
    const searchFilter = searchQuery.trim().toLowerCase();

    // 1. If 'mostly_used' tab is selected
    if (currentCategory?.id === 'mostly_used') {
      const muItems = items.filter(i => (mostlyUsedCountMap.get(i.id) || 0) > 0);
      const filtered = searchFilter ? muItems.filter(i => i.name.toLowerCase().includes(searchFilter)) : muItems;
      sections.push({
        id: 'mostly_used',
        name: '🔥 Mostly Used',
        items: filtered,
      });
      return sections;
    }

    // 2. If a specific category tab is selected
    if (currentCategory && currentCategory.id !== 'all') {
      const catItems = items.filter(i => i.categoryId === currentCategory.id || (i as any).category === currentCategory.name);
      const filtered = searchFilter ? catItems.filter(i => i.name.toLowerCase().includes(searchFilter)) : catItems;
      sections.push({
        id: currentCategory.id,
        name: currentCategory.name,
        items: filtered,
      });
      return sections;
    }

    // 3. 'all' is selected: List each category
    if (mostlyUsedIds.size > 0) {
      const muItems = items.filter(i => (mostlyUsedCountMap.get(i.id) || 0) > 0);
      const filtered = searchFilter ? muItems.filter(i => i.name.toLowerCase().includes(searchFilter)) : muItems;
      if (filtered.length > 0) {
        sections.push({
          id: 'mostly_used',
          name: '🔥 Mostly Used',
          items: filtered,
        });
      }
    }

    for (const cat of categories) {
      let catItems = items.filter(i => i.categoryId === cat.id || (i as any).category === cat.name);
      if (searchFilter) {
        catItems = catItems.filter(i => i.name.toLowerCase().includes(searchFilter));
      }
      if (catItems.length > 0) {
        sections.push({
          id: cat.id,
          name: cat.name,
          items: catItems,
        });
      }
    }

    // Check for uncategorized items
    const categorizedItemIds = new Set(
      categories.flatMap(c => items.filter(i => i.categoryId === c.id || (i as any).category === c.name).map(i => i.id))
    );
    let uncategorized = items.filter(i => !categorizedItemIds.has(i.id));
    if (searchFilter) {
      uncategorized = uncategorized.filter(i => i.name.toLowerCase().includes(searchFilter));
    }
    if (uncategorized.length > 0) {
      sections.push({
        id: '__uncategorized__',
        name: 'Other Items',
        items: uncategorized,
      });
    }

    return sections;
  }, [items, categories, currentCategory, searchQuery, mostlyUsedCountMap, mostlyUsedIds.size]);

  const handleScroll = () => {
    if (!isScrolling) {
      setIsScrolling(true);
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1200);
  };

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

      {/* Horizontal Categories Scroll (Directly below Search Items) */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {displayCategories.map((cat, idx) => {
            const isSelected = idx === activeCategoryIndex && !q;
            const count = cat.id === 'all'
              ? items.length
              : cat.id === 'mostly_used'
              ? items.filter(i => (mostlyUsedCountMap.get(i.id) || 0) > 0).length
              : items.filter(i => i.categoryId === cat.id || (i as any).category === cat.name).length;

            return (
              <CategoryPill
                key={cat.id}
                cat={cat}
                itemCount={count}
                isSelected={isSelected}
                onSelect={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setActiveCategoryIndex(idx);
                  setSearchQuery('');
                }}
                styles={styles}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Tap / Hold / Minus Helper Text */}
      <Text style={styles.helperText}>TAP = FULL · HOLD = HALF · [−] = MINUS</Text>

      {/* Category Sections & Items List */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {categorySections.length === 0 ? (
          <View style={styles.emptyCatBox}>
            <Text style={styles.emptyCatText}>
              {searchQuery ? `No items found matching "${searchQuery}"` : `Nothing in ${currentCategory?.name || 'this category'} yet.`}
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
          </View>
        ) : (
          categorySections.map(section => (
            <View key={section.id} style={styles.categorySectionBlock}>
              {/* Section Header: positioned neatly in the side corner */}
              <View style={styles.categorySectionHeaderRow}>
                <View style={styles.categorySectionAccentBar} />
                <Text style={styles.categorySectionHeading}>{section.name}</Text>
                <View style={styles.categorySectionCountBadge}>
                  <Text style={styles.categorySectionCountText}>{section.items.length}</Text>
                </View>
              </View>

              {/* Items grid belonging to this category */}
              <View style={styles.categoryItemsGrid}>
                {section.items.map(item => (
                  <ItemTile
                    key={item.id}
                    item={item}
                    tileSize={tileSize}
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
                    onDecrease={() => {
                      decreaseItem(item.id);
                    }}
                    onSoldOutNotice={() => flash(`${item.name} is marked sold out`)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {/* Bottom Quick Actions Section: Unidentified + Add Product */}
        <View style={styles.categorySectionBlock}>
          <View style={styles.categorySectionHeaderRow}>
            <View style={[styles.categorySectionAccentBar, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.categorySectionHeading}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                if (!can('bill')) {
                  flash(t('no_access', "You don't have access for that"));
                  return;
                }
                setIsUnidentifiedModalOpen(true);
              }}
              style={styles.unidentifiedTileContainer}
              accessibilityLabel="Add Unidentified Product"
            >
              <View style={styles.unidentifiedTileIconCircle}>
                <Ionicons name="help" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.quickActionTextCol}>
                <Text style={styles.unidentifiedTileTitle} numberOfLines={1}>Unidentified</Text>
                <Text style={styles.unidentifiedTileSub} numberOfLines={1}>+ Custom Price</Text>
              </View>
            </TouchableOpacity>

            {can('menu') && (
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  if (!can('menu')) {
                    flash(t('no_access', "You don't have access for that"));
                    return;
                  }
                  onOpenMenuEditor(true);
                }}
                style={styles.addTileContainer}
                accessibilityLabel="Add New Product"
              >
                <View style={styles.addTileIconCircle}>
                  <Ionicons name="add" size={19} color="#FFFFFF" />
                </View>
                <View style={styles.quickActionTextCol}>
                  <Text style={styles.addTileTitle} numberOfLines={1}>{t('add_product', 'Add Product')}</Text>
                  <Text style={styles.addTileSub} numberOfLines={1}>+ New Item</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Cart Bar */}
      <CartBar
        totalAmount={subtotal}
        totalCount={totalCount}
        paymentMode="Cash"
        onGoToBill={handleProceedToBill}
      />

      {/* Side Corner Floating Category Pill on Scroll */}
      {isScrolling && (
        <View style={styles.floatingCategoryCornerBadge} pointerEvents="none">
          <Ionicons name="folder-outline" size={12} color="#FF5F00" />
          <Text style={styles.floatingCategoryCornerText} numberOfLines={1}>
            {currentCategory?.name || 'All Items'}
          </Text>
        </View>
      )}



      {/* Unidentified Custom Item Modal */}
      <Modal
        visible={isUnidentifiedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsUnidentifiedModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsUnidentifiedModalOpen(false)}
          style={styles.modalBackdrop}
        >
          <TouchableWithoutFeedback>
            <View style={styles.unidentifiedModalCard}>
              <View style={styles.unidentifiedModalHeader}>
                <View style={styles.unidentifiedModalIconWrap}>
                  <Ionicons name="pricetag" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unidentifiedModalTitle}>Unidentified Item</Text>
                  <Text style={styles.unidentifiedModalSub}>Add custom unlisted item to current bill</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsUnidentifiedModalOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.unidentifiedInputRow}>
                <Text style={styles.unidentifiedCurrencySymbol}>₹</Text>
                <TextInput
                  style={styles.unidentifiedPriceInput}
                  keyboardType="numeric"
                  value={unidentifiedPriceInput}
                  onChangeText={setUnidentifiedPriceInput}
                  autoFocus
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Quick price presets */}
              <View style={styles.unidentifiedQuickChips}>
                {[10, 20, 30, 40, 50, 100].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setUnidentifiedPriceInput(String(amt))}
                    style={[
                      styles.unidentifiedChip,
                      unidentifiedPriceInput === String(amt) && styles.unidentifiedChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unidentifiedChipText,
                        unidentifiedPriceInput === String(amt) && styles.unidentifiedChipTextActive,
                      ]}
                    >
                      ₹{amt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppButton
                title="Add to Bill"
                variant="primary"
                onPress={() => {
                  const price = Number(unidentifiedPriceInput.replace(/[^0-9]/g, '')) || 0;
                  if (price <= 0) {
                    flash('Please enter a valid amount');
                    return;
                  }
                  addCustomItem(price, 'Unidentified');
                  setIsUnidentifiedModalOpen(false);
                  flash(`Added Unidentified (₹${price})`);
                }}
                style={styles.unidentifiedAddBtn}
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

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
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  categoryPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexShrink: 0,
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
    includeFontPadding: false,
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
  mainScrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: Math.max(bottomInset, 20) + 130,
  },
  categorySectionBlock: {
    marginBottom: 16,
  },
  categorySectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categorySectionAccentBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#FF5F00',
  },
  categorySectionHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.1,
  },
  categorySectionCountBadge: {
    backgroundColor: theme.isDark ? '#27272A' : '#F4F4F5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categorySectionCountText: {
    fontFamily: typography.fonts.numbers,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  categoryItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
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
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  quickActionTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  addTileContainer: {
    flex: 1,
    minHeight: 58,
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.08)' : '#FFF7ED',
    borderWidth: 1.5,
    borderColor: theme.isDark ? 'rgba(255, 95, 0, 0.40)' : '#FDBA74',
    borderStyle: 'dashed',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    ...shadows.sm,
  },
  addTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  addTileTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
    color: colors.text,
  },
  addTileSub: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
    color: colors.accent,
    marginTop: 1,
  },
  categoryAlignPill: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5F00',
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.12)' : '#FFF7ED',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...shadows.sm,
  },
  categoryAlignText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    color: '#FF5F00',
    fontWeight: '700',
  },
  categoryPillDropTarget: {
    borderColor: '#FF5F00',
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.28)' : '#FBE9DD',
    borderWidth: 2,
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryTextDropTarget: {
    color: theme.isDark ? '#FFFFFF' : '#C4622D',
    fontWeight: '800',
  },
  categoryCountBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  categoryCountBadgeHovered: {
    backgroundColor: 'rgba(255, 95, 0, 0.25)',
  },
  categoryCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.fonts.numbers,
    includeFontPadding: false,
  },
  categoryCountTextSelected: {
    color: '#FFFFFF',
  },
  categoryCountTextHovered: {
    color: theme.isDark ? '#FFFFFF' : '#C4622D',
  },
  unidentifiedTileContainer: {
    flex: 1,
    minHeight: 58,
    backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.10)' : '#EFF6FF',
    borderWidth: 1.5,
    borderColor: theme.isDark ? 'rgba(59, 130, 246, 0.40)' : '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    ...shadows.sm,
  },
  unidentifiedTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  unidentifiedTileTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
    color: colors.text,
  },
  unidentifiedTileSub: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
    color: '#3B82F6',
    marginTop: 1,
  },
  floatingDragChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: '#FF5F00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 99999,
  },
  floatingDragChipText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '700',
  },
  floatingDragTargetText: {
    color: '#FF8A3D',
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '800',
  },
  floatingCategoryCornerBadge: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: theme.isDark ? '#27272A' : '#18181B',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 99,
  },
  floatingCategoryCornerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unidentifiedModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    ...shadows.lg,
  },
  unidentifiedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unidentifiedModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unidentifiedModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  unidentifiedModalSub: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  unidentifiedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.isDark ? '#27272A' : '#F5F5F4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  unidentifiedCurrencySymbol: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    fontWeight: '800',
    color: '#3B82F6',
    marginRight: 6,
  },
  unidentifiedPriceInput: {
    fontFamily: typography.fonts.heading,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  unidentifiedQuickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  unidentifiedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.isDark ? '#27272A' : '#F5F5F4',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unidentifiedChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  unidentifiedChipText: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  unidentifiedChipTextActive: {
    color: '#FFFFFF',
  },
  unidentifiedAddBtn: {
    marginTop: 4,
  },
  alignModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    ...shadows.lg,
  },
  alignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  alignModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  alignModalSub: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  alignCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.isDark ? '#27272A' : '#F5F5F4',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alignCatIndex: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    width: 20,
  },
  alignCatName: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  alignMoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillWrapper: {
    borderRadius: 14,
  },
  categoryPillInsertTarget: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    paddingLeft: 2,
    transform: [{ scale: 1.05 }],
  },
  organizeToggleBtn: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.isDark ? '#27272A' : '#F5F5F4',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    ...shadows.sm,
  },
  organizeToggleBtnActive: {
    backgroundColor: '#FF5F00',
    borderColor: '#FF5F00',
  },
  organizeToggleText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text,
  },
  organizeToggleTextActive: {
    color: '#FFFFFF',
  },
  organizeModeBanner: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.15)' : '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FF5F00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  organizeModeBannerText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.isDark ? '#FB923C' : '#C2410C',
    flex: 1,
  },
  organizeModeDoneBtn: {
    backgroundColor: '#FF5F00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  organizeModeDoneBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pickedItemFloatingBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FF5F00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
    elevation: 8,
  },
  pickedItemLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pickedItemIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedItemTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickedItemSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pickedItemCancelBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pickedItemCancelText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryPillTarget: {
    backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.22)' : 'rgba(255, 95, 0, 0.12)',
    borderColor: '#FF5F00',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  categoryTextTarget: {
    color: '#FF5F00',
    fontWeight: '800',
  },
  makeFrontBtn: {
    marginLeft: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  makeFrontText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  });
};

