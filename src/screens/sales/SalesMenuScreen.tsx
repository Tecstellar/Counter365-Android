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
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ItemTile } from '../../components/sales/ItemTile';
import { CartBar } from '../../components/sales/CartBar';
import { TableManagementModal } from '../../components/sales/TableManagementModal';
import { AppButton } from '../../components/common/AppButton';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { menuService } from '../../services/menuService';
import { MenuItem, MenuCategory } from '../../types/models';
import { supabase } from '../../lib/supabase';
import { storage } from '../../lib/storage';

interface SalesMenuScreenProps {
  onGoToBill: () => void;
  onOpenMenuEditor: () => void;
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
        <View style={stylesUniqueMenuBtn.editBadge}>
          <Ionicons name="pencil" size={9} color="#FFFFFF" />
        </View>
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
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { shop, subscriptionStatus } = useShop();
  const { can } = useAuth();
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
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMenu();
    setIsRefreshing(false);
  };

  const displayCategories = [
    { id: 'all', name: 'All', shopId: shop.id, sortOrder: -1, isActive: true },
    ...categories,
  ];

  const safeCatIndex = (activeCategoryIndex >= 0 && activeCategoryIndex < displayCategories.length)
    ? activeCategoryIndex
    : 0;

  const currentCategory = safeCatIndex === 0 ? null : displayCategories[safeCatIndex];
  const q = searchQuery.trim().toLowerCase();

  const filteredItems = q
    ? items.filter(i => i.name.toLowerCase().includes(q))
    : currentCategory
    ? items.filter(i => i.categoryId === currentCategory.id || (i as any).category === currentCategory.name)
    : items;

  const handleProceedToBill = () => {
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
            placeholder="Search items..."
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
              color={selectedTable ? '#FFFFFF' : colors.accent700}
            />
            <Text
              style={[
                styles.tableBtnText,
                selectedTable ? styles.tableBtnTextActive : null,
              ]}
              numberOfLines={1}
            >
              {selectedTable ? selectedTable.replace('Table ', 'T-') : 'Table'}
            </Text>
          </TouchableOpacity>
        )}

        {can('menu') && (
          <UniqueAnimatedMenuEditorButton
            onPress={onOpenMenuEditor}
            theme={theme}
          />
        )}
      </View>

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
            onPress={onOpenMenuEditor}
            style={styles.addFirstBtn}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredItems}
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
          renderItem={({ item }) => (
            <ItemTile
              item={item}
              categoryName={categories.find(c => c.id === item.categoryId)?.name || currentCategory?.name}
              quantity={getItemQty(item.id)}
              onAddFull={() => addItem(item, false)}
              onAddHalf={() => addItem(item, true)}
              onDecrease={() => decreaseItem(item.id)}
              onSoldOutNotice={() => flash(`${item.name} is marked sold out`)}
            />
          )}
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

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
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
    paddingBottom: 10,
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
  });
};

