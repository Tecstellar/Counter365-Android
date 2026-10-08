import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { typography, radii, shadows, useTheme, Theme } from '../../theme';
import { AppRoute } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { billingService } from '../../services/billingService';
import { storage } from '../../lib/storage';
import { formatRupee } from '../../lib/money';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: AppRoute) => void;
  onNavigateSubView?: (route: AppRoute, subView?: 'menu' | 'bill' | 'editor') => void;
  onStartTour: () => void;
  currentRoute?: AppRoute;
  pendingTotalAmount?: number;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  visible,
  onClose,
  onNavigate,
  onNavigateSubView,
  onStartTour,
  currentRoute = 'home',
  pendingTotalAmount,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { currentRole, can, profile } = useAuth();
  const { shop } = useShop();

  const [livePendingAmount, setLivePendingAmount] = useState<number>(pendingTotalAmount ?? 0);
  const [lastBackupText, setLastBackupText] = useState<string>('Daily cloud backup synced');

  const appVersion = Constants.expoConfig?.version || '1.0.4';
  const shopInitial = shop.name ? shop.name.charAt(0).toUpperCase() : 'C';
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);

  useEffect(() => {
    if (visible && shop.id) {
      loadRealData();
    }
  }, [visible, shop.id]);

  const loadRealData = async () => {
    try {
      const records = await billingService.getPendingPayments(shop.id);
      const total = records.reduce((sum, r) => sum + (r.amountDue || 0), 0);
      setLivePendingAmount(total);

      const savedBackup = await storage.getItem('@counterpro/last_backup');
      if (savedBackup) {
        setLastBackupText(`Last backup ${savedBackup}`);
      } else {
        setLastBackupText('Cloud sync active • 11:00 PM');
      }
    } catch (err) {
      console.warn('Error loading DrawerMenu data:', err);
    }
  };

  const navSections = [
    {
      title: 'CORE WORKSPACE',
      items: [
        {
          id: 'home',
          title: 'Dashboard',
          route: 'home' as AppRoute,
          icon: 'grid-outline',
          iconActive: 'grid',
          meta: '',
          permitted: true,
          subView: undefined,
        },
        {
          id: 'sales',
          title: 'Sales (New Bill)',
          route: 'sales' as AppRoute,
          icon: 'receipt-outline',
          iconActive: 'receipt',
          meta: '',
          permitted: true,
          subView: 'menu' as const,
        },
        {
          id: 'menu',
          title: 'Menu & Dishes',
          route: 'sales' as AppRoute,
          icon: 'restaurant-outline',
          iconActive: 'restaurant',
          meta: '',
          permitted: can('menu'),
          subView: 'editor' as const,
        },
      ],
    },
    {
      title: 'FINANCE & CUSTOMERS',
      items: [
        {
          id: 'pending',
          title: 'Payment Pending',
          route: 'pending' as AppRoute,
          icon: 'hourglass-outline',
          iconActive: 'hourglass',
          meta: livePendingAmount > 0 ? formatRupee(livePendingAmount) : '₹0',
          permitted: can('pend'),
          subView: undefined,
        },
        {
          id: 'contacts',
          title: 'Customers & Vendors',
          route: 'contacts' as AppRoute,
          icon: 'people-outline',
          iconActive: 'people',
          meta: '',
          permitted: can('exp') || can('pend'),
          subView: undefined,
        },
      ],
    },
    {
      title: 'SETTINGS & PREFERENCES',
      items: [
        {
          id: 'account',
          title: currentRole === 'Owner' ? 'Account & Settings' : 'Account',
          route: 'account' as AppRoute,
          icon: 'settings-outline',
          iconActive: 'settings',
          meta: '',
          permitted: true,
          subView: undefined,
        },
        {
          id: 'tour',
          title: 'App Tour Guide',
          route: 'tour' as any,
          icon: 'sparkles-outline',
          iconActive: 'sparkles',
          meta: 'Replay',
          permitted: true,
          subView: undefined,
        },
      ],
    },
  ];

  const handleItemPress = (item: {
    id: string;
    route: AppRoute;
    subView?: 'menu' | 'bill' | 'editor';
  }) => {
    onClose();
    if (item.id === 'tour') {
      onStartTour();
    } else if (item.subView && onNavigateSubView) {
      onNavigateSubView(item.route, item.subView);
    } else {
      onNavigate(item.route);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Drawer Panel */}
        <View style={styles.drawer}>
          {/* Header: Merchant Info + Near Theme Switch */}
          <View style={[styles.header, { paddingTop: topPadding }]}>
            <View style={styles.avatarWrap}>
              {shop.logoUrl ? (
                <Image
                  key={shop.logoUrl}
                  source={{ uri: shop.logoUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{shopInitial}</Text>
                </View>
              )}
              <View style={styles.onlineBadge} />
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.shopTitle} numberOfLines={1}>
                {shop.name || 'Counter365 POS'}
              </Text>
              <View style={styles.roleBadgeRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{currentRole.toUpperCase()}</Text>
                </View>
                {profile?.fullName ? (
                  <Text style={styles.profileNameText} numberOfLines={1}>
                    {profile.fullName}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Theme Toggle Button next to Raja Tea Stall / Owner Ram */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                toggleTheme();
              }}
              style={styles.headerThemeToggle}
              accessibilityLabel="Toggle Dark / Light Theme"
            >
              <Ionicons
                name={isDark ? 'sunny' : 'moon'}
                size={18}
                color={isDark ? '#FF5F00' : '#FF5F00'}
              />
            </TouchableOpacity>
          </View>

          {/* Navigation Links Grouped by Section */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {navSections.map((section, sIdx) => {
              const permittedItems = section.items.filter(i => i.permitted);
              if (permittedItems.length === 0) return null;

              return (
                <View key={sIdx} style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>{section.title}</Text>
                  <View style={styles.sectionItems}>
                    {permittedItems.map(item => {
                      const isActive =
                        currentRoute === item.route &&
                        (item.id !== 'menu' || currentRoute === 'sales');

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.72}
                          onPress={() => handleItemPress(item)}
                          style={[styles.menuItem, isActive && styles.menuItemActive]}
                        >
                          {isActive && <View style={styles.activeIndicator} />}

                          <View
                            style={[
                              styles.menuIconContainer,
                              isActive && styles.menuIconContainerActive,
                            ]}
                          >
                            <Ionicons
                              name={isActive ? (item.iconActive as any) : (item.icon as any)}
                              size={18}
                              color={isActive ? '#FF5F00' : isDark ? '#A8A29E' : '#78716C'}
                            />
                          </View>

                          <Text
                            style={[
                              styles.menuItemText,
                              isActive && styles.menuItemTextActive,
                            ]}
                          >
                            {item.title}
                          </Text>

                          {item.meta ? (
                            <View
                              style={[
                                styles.metaBadge,
                                item.id === 'pending' &&
                                  livePendingAmount > 0 &&
                                  styles.pendingMetaBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.menuItemMeta,
                                  item.id === 'pending' &&
                                    livePendingAmount > 0 &&
                                    styles.pendingActiveMeta,
                                ]}
                              >
                                {item.meta}
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Branding */}
          <View style={styles.footer}>
            <View style={styles.footerBrandRow}>
              <View style={styles.footerDot} />
              <Text style={styles.footerBrandText}>Counter365</Text>
              <Text style={styles.footerVersionText}>v{appVersion}</Text>
            </View>
          </View>
        </View>

        {/* Backdrop Tap to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) => {
  const { colors, isDark } = theme;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: 'row',
    },
    drawer: {
      width: 300,
      backgroundColor: isDark ? '#141414' : '#FFFFFF',
      flexDirection: 'column',
      borderRightWidth: 1,
      borderRightColor: isDark ? '#262626' : '#EFECE6',
      ...shadows.lg,
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#262626' : '#EFECE6',
    },
    avatarWrap: {
      position: 'relative',
    },
    avatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FF5F00',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    onlineBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#16A34A',
      borderWidth: 2,
      borderColor: isDark ? '#141414' : '#FFFFFF',
    },
    headerInfo: {
      flex: 1,
      minWidth: 0,
    },
    shopTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      color: colors.text,
      fontWeight: '700',
    },
    roleBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    roleBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.16)' : 'rgba(255, 95, 0, 0.1)',
    },
    roleBadgeText: {
      fontSize: 10,
      fontFamily: typography.fonts.heading,
      color: '#FF5F00',
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    profileNameText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      fontFamily: typography.fonts.body,
    },
    headerThemeToggle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#262626' : '#F5F2EC',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollList: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: 12,
      gap: 14,
    },
    sectionBlock: {
      gap: 4,
    },
    sectionHeading: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      color: colors.textMuted,
      fontWeight: '700',
      letterSpacing: 1.2,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    sectionItems: {
      gap: 2,
    },
    menuItem: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 10,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      gap: 12,
      position: 'relative',
    },
    menuItemActive: {
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.12)' : 'rgba(255, 95, 0, 0.08)',
    },
    activeIndicator: {
      position: 'absolute',
      left: 0,
      top: 10,
      bottom: 10,
      width: 3,
      borderRadius: 2,
      backgroundColor: '#FF5F00',
    },
    menuIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuIconContainerActive: {
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.2)' : 'rgba(255, 95, 0, 0.14)',
    },
    menuItemText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: typography.fonts.body,
      fontWeight: '500',
    },
    menuItemTextActive: {
      color: '#FF5F00',
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    metaBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? '#262626' : colors.neutral100,
    },
    pendingMetaBadge: {
      backgroundColor: '#FF5F00',
    },
    menuItemMeta: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      fontFamily: typography.fonts.body,
    },
    pendingActiveMeta: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#262626' : '#EFECE6',
    },
    footerBrandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    footerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FF5F00',
    },
    footerBrandText: {
      color: colors.text,
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
    },
    footerVersionText: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: typography.fonts.body,
      marginLeft: 'auto',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
  });
};
