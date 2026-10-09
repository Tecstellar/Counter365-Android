import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Image,
  ScrollView,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  AccessibilityInfo,
  BackHandler,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { typography, useTheme } from '../../theme';
import { AppRoute } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { billingService } from '../../services/billingService';
import { formatRupee } from '../../lib/money';
import { APP_CONFIG } from '../../constants/appConfig';

export interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onNavigate: (route: AppRoute) => void;
  onNavigateSubView?: (route: AppRoute, subView?: 'menu' | 'bill' | 'editor') => void;
  onStartTour: () => void;
  currentRoute?: AppRoute;
  salesSubView?: 'menu' | 'bill' | 'editor';
  pendingTotalAmount?: number;
  drawerProgress?: Animated.Value;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  visible,
  onClose,
  onOpen,
  onNavigate,
  onNavigateSubView,
  onStartTour,
  currentRoute = 'home',
  salesSubView,
  pendingTotalAmount,
  drawerProgress: externalDrawerProgress,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const { currentRole, can, profile } = useAuth();
  const { shop } = useShop();

  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const drawerWidth = useMemo(
    () => Math.min(324, screenWidth - 24),
    [screenWidth]
  );

  const [livePendingAmount, setLivePendingAmount] = useState<number>(pendingTotalAmount ?? 0);
  const [pendingCustomerCount, setPendingCustomerCount] = useState<number>(0);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Active item tracking
  const activeItemId = useMemo(() => {
    if (currentRoute === 'home') return 'home';
    if (currentRoute === 'sales') {
      return salesSubView === 'editor' ? 'menu' : 'sales';
    }
    if (currentRoute === 'bills') return 'bills';
    if (currentRoute === 'pending') return 'pending';
    if (currentRoute === 'contacts') return 'contacts';
    if (currentRoute === 'reports') return 'reports';
    if (currentRoute === 'account') return 'account';
    if (currentRoute === 'support') return 'support';
    return 'home';
  }, [currentRoute, salesSubView]);

  // Keep screen width updated on orientation changes
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => sub?.remove();
  }, []);

  // Reduce motion accessibility listener
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => setReduceMotion(enabled))
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      setReduceMotion(enabled);
    });
    return () => sub?.remove();
  }, []);

  // Internal animated value if not provided externally
  const internalDrawerAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const drawerAnim = externalDrawerProgress || internalDrawerAnim;

  // Stagger animations
  const staggerAnims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(visible ? 1 : 0))
  ).current;

  // Avatar continuous rotation ring
  const ringRotateAnim = useRef(new Animated.Value(0)).current;
  // Pending badge pulse
  const pendingPulseAnim = useRef(new Animated.Value(0)).current;
  // Support button ripple
  const rippleAnim = useRef(new Animated.Value(0)).current;
  // Close button press
  const closeBtnScale = useRef(new Animated.Value(1)).current;
  const closeBtnRotate = useRef(new Animated.Value(0)).current;

  // Press animation map for cards
  const cardPressAnims = useRef<{ [id: string]: Animated.Value }>({}).current;
  const getCardPressAnim = (id: string) => {
    if (!cardPressAnims[id]) {
      cardPressAnims[id] = new Animated.Value(1);
    }
    return cardPressAnims[id];
  };

  // Android hardware back button handler
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      handleClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible]);

  // Load real pending data on open
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
      const uniqueCustomers = new Set(
        records.map(r => r.customerId || r.customerPhone).filter(Boolean)
      );
      setPendingCustomerCount(uniqueCustomers.size || records.length);
    } catch (err) {
      console.warn('Error loading DrawerMenu pending data:', err);
    }
  };

  // Looping animations
  useEffect(() => {
    if (reduceMotion || !visible) return;

    // 1. Avatar ring rotating continuously (2.6s per turn)
    const ringLoop = Animated.loop(
      Animated.timing(ringRotateAnim, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    ringLoop.start();

    // 2. Pending badge expanding soft pulse (every 2s)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pendingPulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pendingPulseAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Support buttons ripple ring (scale 1 to 1.35, every 2.4s)
    const rippleLoop = Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    rippleLoop.start();

    return () => {
      ringLoop.stop();
      pulseLoop.stop();
      rippleLoop.stop();
    };
  }, [visible, reduceMotion]);

  // Open / Close animation lifecycle
  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        Animated.timing(drawerAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
        staggerAnims.forEach(anim => anim.setValue(1));
      } else {
        Animated.spring(drawerAnim, {
          toValue: 1,
          tension: 42,
          friction: 6.8, // slight overshoot, ~500ms feel
          useNativeDriver: true,
        }).start();

        // Stagger entrance for floating panels
        staggerAnims.forEach((anim, i) => {
          anim.setValue(0);
          Animated.timing(anim, {
            toValue: 1,
            duration: 260,
            delay: 120 + i * 35,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        });
      }
    } else {
      if (reduceMotion) {
        Animated.timing(drawerAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(drawerAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }).start();
      }
    }
  }, [visible, reduceMotion]);

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (reduceMotion) {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => onClose());
    } else {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(() => onClose());
    }
  };

  // Close button press feedback
  const handleClosePressIn = () => {
    Animated.parallel([
      Animated.spring(closeBtnScale, { toValue: 0.9, useNativeDriver: true }),
      Animated.timing(closeBtnRotate, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handleClosePressOut = () => {
    Animated.parallel([
      Animated.spring(closeBtnScale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(closeBtnRotate, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Navigation click handling
  const handleNavigateItem = (
    route: AppRoute,
    subView?: 'menu' | 'bill' | 'editor',
    isTour?: boolean
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    handleClose();

    setTimeout(() => {
      if (isTour) {
        onStartTour();
      } else if (subView && onNavigateSubView) {
        onNavigateSubView(route, subView);
      } else {
        onNavigate(route);
      }
    }, 180);
  };

  // Press animation for cards
  const handleCardPressIn = (id: string) => {
    Animated.spring(getCardPressAnim(id), {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handleCardPressOut = (id: string) => {
    Animated.spring(getCardPressAnim(id), {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Gestures
  const drawerPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dx < -8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const progress = Math.max(0, Math.min(1, 1 + gestureState.dx / drawerWidth));
          drawerAnim.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const dragged = Math.abs(gestureState.dx);
        if (dragged > 55 || dragged > drawerWidth * 0.35 || gestureState.vx < -0.45) {
          handleClose();
        } else {
          Animated.spring(drawerAnim, {
            toValue: 1,
            tension: 45,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const edgePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX;
        return (
          startX <= 22 &&
          gestureState.dx > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const progress = Math.max(0, Math.min(1, gestureState.dx / drawerWidth));
          drawerAnim.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > drawerWidth * 0.35 || gestureState.vx > 0.45) {
          onOpen?.();
          Animated.spring(drawerAnim, {
            toValue: 1,
            tension: 42,
            friction: 6.8,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.timing(drawerAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const appVersion = Constants.expoConfig?.version || '1.0.4';
  const shopInitial = shop.name ? shop.name.charAt(0).toUpperCase() : 'R';
  const topFloatingMargin = Math.max(insets.top + 6, Platform.OS === 'android' ? 24 : 32);
  const bottomFloatingMargin = Math.max(insets.bottom + 8, 16);

  // Interpolations
  const drawerTranslateX = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth - 30, 0],
  });

  const scrimOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const closeRotateInterpolated = closeBtnRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const ringRotateInterpolated = ringRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      {/* Edge Swipe strip to open drawer when closed (left 20px) */}
      {!visible && (
        <View
          {...edgePanResponder.panHandlers}
          style={styles.edgeSwipeStrip}
          pointerEvents="box-only"
        />
      )}

      {/* Drawer Overlay Container */}
      <View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.overlay, { width: screenWidth }]}
        accessibilityViewIsModal={visible}
      >
        {/* Dark Scrim */}
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Floating Side Drawer Panel */}
        <Animated.View
          {...drawerPanResponder.panHandlers}
          style={[
            styles.floatingDrawer,
            {
              width: drawerWidth,
              top: topFloatingMargin,
              bottom: bottomFloatingMargin,
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
          accessibilityRole="menu"
        >
          {/* Top Orange Header Background (covers shop card + 4 workspace boxes, full width, ends before finance) */}
          <View pointerEvents="none" style={styles.topOrangeHeaderBackground}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height={355}>
              <Defs>
                <LinearGradient id="headerOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop
                    offset="0%"
                    stopColor="#FF5F00"
                    stopOpacity={isDark ? 0.35 : 0.24}
                  />
                  <Stop
                    offset="40%"
                    stopColor="#FF5F00"
                    stopOpacity={isDark ? 0.22 : 0.14}
                  />
                  <Stop
                    offset="80%"
                    stopColor="#FF5F00"
                    stopOpacity={isDark ? 0.08 : 0.04}
                  />
                  <Stop
                    offset="100%"
                    stopColor="#FF5F00"
                    stopOpacity={0}
                  />
                </LinearGradient>
                <RadialGradient id="headerCornerGlow" cx="0%" cy="0%" r="90%">
                  <Stop
                    offset="0%"
                    stopColor="#FF5F00"
                    stopOpacity={isDark ? 0.32 : 0.20}
                  />
                  <Stop
                    offset="60%"
                    stopColor="#FF5F00"
                    stopOpacity={isDark ? 0.10 : 0.05}
                  />
                  <Stop
                    offset="100%"
                    stopColor="#FF5F00"
                    stopOpacity={0}
                  />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height={355} fill="url(#headerOrangeGrad)" />
              <Rect x="0" y="0" width="100%" height={355} fill="url(#headerCornerGlow)" />
            </Svg>
          </View>

          {/* 1. Shop Card (Avatar with rotating ring, shop name, OWNER tag, Theme Switch + Close X button) */}
          <Animated.View
            style={[
              styles.shopCard,
              {
                opacity: staggerAnims[0],
                transform: [
                  {
                    translateX: staggerAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Avatar with Rotating Ring & Green Online Dot */}
            <View style={styles.avatarWrap}>
              {!reduceMotion ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.avatarRingWrap,
                    { transform: [{ rotate: ringRotateInterpolated }] },
                  ]}
                >
                  <Svg width="50" height="50" viewBox="0 0 50 50">
                    <Defs>
                      <LinearGradient id="avatarRingGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0%" stopColor="#FF5F00" stopOpacity="1" />
                        <Stop offset="65%" stopColor="#FF5F00" stopOpacity="0.4" />
                        <Stop offset="100%" stopColor="#FF5F00" stopOpacity="0" />
                      </LinearGradient>
                    </Defs>
                    <Circle
                      cx="25"
                      cy="25"
                      r="22.5"
                      stroke="url(#avatarRingGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="110 30"
                      fill="none"
                    />
                  </Svg>
                </Animated.View>
              ) : (
                <View style={styles.staticRing} />
              )}

              {/* Inner Avatar */}
              <View style={styles.avatarInner}>
                {shop.logoUrl ? (
                  <Image
                    key={shop.logoUrl}
                    source={{ uri: shop.logoUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{shopInitial}</Text>
                  </View>
                )}
              </View>

              {/* Green Online Dot */}
              <View style={styles.onlineDot} />
            </View>

            {/* Shop Info */}
            <View style={styles.shopInfoColumn}>
              <Text style={styles.shopNameText} numberOfLines={1}>
                {shop.name || 'Raja tea stall'}
              </Text>
              <View style={styles.roleTagRow}>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>
                    {(currentRole || 'OWNER').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.roleSubtitle} numberOfLines={1}>
                  {profile?.fullName || (currentRole === 'Owner' ? 'Shop Owner' : 'Staff')}
                </Text>
              </View>
            </View>

            {/* Action Buttons: Theme Switch + Close Button X */}
            <View style={styles.shopActionsRow}>
              {/* Theme Toggle Button */}
              <TouchableOpacity
                accessibilityLabel="Toggle Dark / Light Theme"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  toggleTheme();
                }}
                style={styles.themeToggleBtn}
              >
                <Ionicons
                  name={isDark ? 'sunny' : 'moon'}
                  size={16}
                  color={isDark ? '#FF9A4D' : '#FF5F00'}
                />
              </TouchableOpacity>

              {/* Close Button X */}
              <Animated.View
                style={{
                  transform: [
                    { scale: closeBtnScale },
                    { rotate: closeRotateInterpolated },
                  ],
                }}
              >
                <TouchableOpacity
                  accessibilityLabel="Close menu"
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onPressIn={handleClosePressIn}
                  onPressOut={handleClosePressOut}
                  onPress={handleClose}
                  style={styles.closeBtn}
                >
                  <Ionicons
                    name="close"
                    size={17}
                    color={isDark ? '#D9D5CF' : '#666666'}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Scrollable Content (Workspace, Finance, System) */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 2. WORKSPACE SECTION (2x2 Grid of Bento Cards) */}
            <Animated.View
              style={[
                styles.sectionContainer,
                {
                  opacity: staggerAnims[1],
                  transform: [
                    {
                      translateX: staggerAnims[1].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sectionHeader}>WORKSPACE</Text>

              <View style={styles.bentoGrid}>
                {/* 1. Dashboard (Active Solid Orange or Inactive) */}
                <Animated.View
                  style={[
                    styles.bentoGridItem,
                    { transform: [{ scale: getCardPressAnim('home') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('home')}
                    onPressOut={() => handleCardPressOut('home')}
                    onPress={() => handleNavigateItem('home')}
                    style={[
                      styles.bentoCard,
                      activeItemId === 'home'
                        ? styles.bentoCardActive
                        : styles.bentoCardInactive,
                    ]}
                  >
                    <Ionicons
                      name={activeItemId === 'home' ? 'grid' : 'grid-outline'}
                      size={22}
                      color={activeItemId === 'home' ? '#FFFFFF' : '#FF5F00'}
                    />
                    <Text
                      style={[
                        styles.bentoCardLabel,
                        activeItemId === 'home'
                          ? styles.bentoCardLabelActive
                          : styles.bentoCardLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      Dashboard
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* 2. New Bill */}
                <Animated.View
                  style={[
                    styles.bentoGridItem,
                    { transform: [{ scale: getCardPressAnim('sales') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('sales')}
                    onPressOut={() => handleCardPressOut('sales')}
                    onPress={() => handleNavigateItem('sales', 'menu')}
                    style={[
                      styles.bentoCard,
                      activeItemId === 'sales'
                        ? styles.bentoCardActive
                        : styles.bentoCardInactive,
                    ]}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={activeItemId === 'sales' ? '#FFFFFF' : '#FF5F00'}
                    />
                    <Text
                      style={[
                        styles.bentoCardLabel,
                        activeItemId === 'sales'
                          ? styles.bentoCardLabelActive
                          : styles.bentoCardLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      New Bill
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* 3. Bills & Invoices */}
                <Animated.View
                  style={[
                    styles.bentoGridItem,
                    { transform: [{ scale: getCardPressAnim('bills') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('bills')}
                    onPressOut={() => handleCardPressOut('bills')}
                    onPress={() => handleNavigateItem('bills')}
                    style={[
                      styles.bentoCard,
                      activeItemId === 'bills'
                        ? styles.bentoCardActive
                        : styles.bentoCardInactive,
                    ]}
                  >
                    <Ionicons
                      name={
                        activeItemId === 'bills'
                          ? 'document-text'
                          : 'document-text-outline'
                      }
                      size={22}
                      color={activeItemId === 'bills' ? '#FFFFFF' : '#FF5F00'}
                    />
                    <Text
                      style={[
                        styles.bentoCardLabel,
                        activeItemId === 'bills'
                          ? styles.bentoCardLabelActive
                          : styles.bentoCardLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      Bills & Invoices
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* 4. Menu & Dishes */}
                <Animated.View
                  style={[
                    styles.bentoGridItem,
                    { transform: [{ scale: getCardPressAnim('menu') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('menu')}
                    onPressOut={() => handleCardPressOut('menu')}
                    onPress={() => handleNavigateItem('sales', 'editor')}
                    style={[
                      styles.bentoCard,
                      activeItemId === 'menu'
                        ? styles.bentoCardActive
                        : styles.bentoCardInactive,
                    ]}
                  >
                    <Ionicons
                      name={activeItemId === 'menu' ? 'cafe' : 'cafe-outline'}
                      size={22}
                      color={activeItemId === 'menu' ? '#FFFFFF' : '#FF5F00'}
                    />
                    <Text
                      style={[
                        styles.bentoCardLabel,
                        activeItemId === 'menu'
                          ? styles.bentoCardLabelActive
                          : styles.bentoCardLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      Menu & Dishes
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </Animated.View>

            {/* 3. FINANCE SECTION (Pure Dark Background - No Orange Backdrop) */}
            <Animated.View
              style={[
                styles.sectionContainer,
                {
                  opacity: staggerAnims[2],
                  transform: [
                    {
                      translateX: staggerAnims[2].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sectionHeader}>FINANCE</Text>

              {/* Payment Pending Card */}
              {can('pend') && (
                <Animated.View
                  style={{ transform: [{ scale: getCardPressAnim('pending') }] }}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('pending')}
                    onPressOut={() => handleCardPressOut('pending')}
                    onPress={() => handleNavigateItem('pending')}
                    style={[
                      styles.pendingWideCard,
                      activeItemId === 'pending' && styles.pendingCardActiveBorder,
                    ]}
                  >
                    {/* Orange Icon Container */}
                    <View style={styles.pendingIconBox}>
                      <Ionicons name="time" size={20} color="#FFFFFF" />
                    </View>

                    {/* Middle Info */}
                    <View style={styles.pendingTextColumn}>
                      <Text style={styles.pendingTitleText} numberOfLines={1}>
                        Payment Pending
                      </Text>
                      <Text style={styles.pendingSubtitleText} numberOfLines={1}>
                        {pendingCustomerCount > 0
                          ? `${pendingCustomerCount} customer · due today`
                          : '1 customer · due today'}
                      </Text>
                    </View>

                    {/* Prominent Orange Amount Badge */}
                    <View style={styles.pendingBadgeWrap}>
                      {!reduceMotion && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.pendingPulseAura,
                            {
                              transform: [
                                {
                                  scale: pendingPulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.3],
                                  }),
                                },
                              ],
                              opacity: pendingPulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.65, 0],
                              }),
                            },
                          ]}
                        />
                      )}
                      <View style={styles.pendingBadgeRow}>
                        <View style={styles.pendingDot} />
                        <Text style={styles.pendingAmountText}>
                          {livePendingAmount > 0
                            ? formatRupee(livePendingAmount)
                            : '₹10'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Customers & Vendors Card */}
              {(can('exp') || can('pend')) && (
                <Animated.View
                  style={[
                    styles.financeItemRowWrap,
                    { transform: [{ scale: getCardPressAnim('contacts') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('contacts')}
                    onPressOut={() => handleCardPressOut('contacts')}
                    onPress={() => handleNavigateItem('contacts')}
                    style={styles.financeItemCard}
                  >
                    <Ionicons name="people-outline" size={20} color="#FF5F00" />
                    <Text style={styles.financeItemTitle} numberOfLines={1}>
                      Customers & Vendors
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={isDark ? '#8A847D' : '#888888'}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Monthly Reports Card */}
              {can('report') && (
                <Animated.View
                  style={[
                    styles.financeItemRowWrap,
                    { transform: [{ scale: getCardPressAnim('reports') }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => handleCardPressIn('reports')}
                    onPressOut={() => handleCardPressOut('reports')}
                    onPress={() => handleNavigateItem('reports')}
                    style={styles.financeItemCard}
                  >
                    <Ionicons name="bar-chart-outline" size={20} color="#FF5F00" />
                    <Text style={styles.financeItemTitle} numberOfLines={1}>
                      Monthly Reports
                    </Text>
                    <View style={styles.pdfExcelChip}>
                      <Text style={styles.pdfExcelChipText}>PDF · Excel</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>

            {/* 4. SYSTEM SECTION (Horizontal Row of 3 Cards) */}
            <Animated.View
              style={[
                styles.sectionContainer,
                {
                  opacity: staggerAnims[3],
                  transform: [
                    {
                      translateX: staggerAnims[3].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sectionHeader}>SYSTEM</Text>

              <View style={styles.systemCardsRow}>
                {/* Settings */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleNavigateItem('account')}
                  style={styles.systemCardItem}
                >
                  <View style={styles.systemIconBox}>
                    <Ionicons name="settings" size={20} color="#111111" />
                  </View>
                  <Text style={styles.systemCardLabel}>Settings</Text>
                </TouchableOpacity>

                {/* Help */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleNavigateItem('support')}
                  style={styles.systemCardItem}
                >
                  <View style={styles.systemIconBox}>
                    <Ionicons name="help-circle" size={22} color="#111111" />
                  </View>
                  <Text style={styles.systemCardLabel}>Help</Text>
                </TouchableOpacity>

                {/* App Tour */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleNavigateItem('home', undefined, true)}
                  style={styles.systemCardItem}
                >
                  <View style={styles.systemIconBox}>
                    <Ionicons name="sparkles" size={20} color="#111111" />
                  </View>
                  <Text style={styles.systemCardLabel}>App Tour</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>

          {/* 5. Footer (Counter365 text + Call & WhatsApp buttons) */}
          <Animated.View
            style={[
              styles.floatingFooter,
              {
                opacity: staggerAnims[4],
                transform: [
                  {
                    translateX: staggerAnims[4].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Logo text: Counter365 */}
            <View style={styles.footerBrandWrap}>
              <Text style={styles.footerBrandMain}>
                Counter<Text style={styles.footerBrandOrange}>365</Text>
              </Text>
            </View>

            {/* Support Action Buttons: Call (Orange) + WhatsApp (White) */}
            <View style={styles.footerActionButtons}>
              {/* Call Button */}
              <View style={styles.footerBtnWrap}>
                {!reduceMotion && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.supportRippleRing,
                      {
                        borderColor: '#FF5F00',
                        transform: [
                          {
                            scale: rippleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.35],
                            }),
                          },
                        ],
                        opacity: rippleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 0],
                        }),
                      },
                    ]}
                  />
                )}
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityLabel="Call Support"
                  accessibilityRole="button"
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    Linking.openURL(`tel:${APP_CONFIG.supportPhone}`);
                  }}
                  style={styles.callSquareBtn}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* WhatsApp Button */}
              <View style={styles.footerBtnWrap}>
                {!reduceMotion && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.supportRippleRing,
                      {
                        borderColor: '#FFFFFF',
                        transform: [
                          {
                            scale: rippleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.35],
                            }),
                          },
                        ],
                        opacity: rippleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 0],
                        }),
                      },
                    ]}
                  />
                )}
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityLabel="WhatsApp Support"
                  accessibilityRole="button"
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    const msg = encodeURIComponent(
                      `Hi Counter365 Support,\nI need assistance with my app.\nShop: ${shop.name || 'My Shop'}\nPhone: ${shop.phone || ''}\nRole: ${currentRole}`
                    );
                    Linking.openURL(`https://wa.me/91${APP_CONFIG.supportPhone}?text=${msg}`);
                  }}
                  style={styles.whatsAppSquareBtn}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#1FAD55" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
    },
    edgeSwipeStrip: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 22,
      zIndex: 9990,
    },
    scrim: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#000000',
    },
    floatingDrawer: {
      position: 'absolute',
      left: 12,
      backgroundColor: isDark ? '#141414' : '#F9F8F5',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      flexDirection: 'column',
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
    },
    topOrangeHeaderBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 355,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    shopCard: {
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 8,
      padding: 10,
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    avatarWrap: {
      width: 50,
      height: 50,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarRingWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 50,
      height: 50,
    },
    staticRing: {
      position: 'absolute',
      top: 2,
      left: 2,
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 2.5,
      borderColor: '#FF5F00',
    },
    avatarInner: {
      width: 42,
      height: 42,
      borderRadius: 21,
      overflow: 'hidden',
      backgroundColor: '#FF5F00',
    },
    avatarImage: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    avatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#FF5F00',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#2BD576',
      borderWidth: 2,
      borderColor: isDark ? '#1E1E1E' : '#FFFFFF',
    },
    shopInfoColumn: {
      flex: 1,
      minWidth: 0,
    },
    shopNameText: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#F5F3F0' : '#111111',
      letterSpacing: -0.2,
    },
    roleTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    roleTag: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 5,
      backgroundColor: 'rgba(255, 95, 0, 0.2)',
    },
    roleTagText: {
      fontSize: 9,
      fontFamily: typography.fonts.heading,
      color: '#FF5F00',
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    roleSubtitle: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: isDark ? '#8A847D' : '#777777',
      flex: 1,
    },
    shopActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    themeToggleBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.15)' : 'rgba(255, 95, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.3)' : 'rgba(255, 95, 0, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: 6,
    },
    sectionContainer: {
      marginBottom: 12,
    },
    sectionHeader: {
      fontSize: 10.5,
      fontFamily: typography.fonts.heading,
      color: isDark ? '#8A847D' : '#888888',
      fontWeight: '700',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    bentoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 12,
    },
    bentoGridItem: {
      width: '48.5%',
    },
    bentoCard: {
      height: 84,
      borderRadius: 16,
      padding: 12,
      justifyContent: 'space-between',
      borderWidth: 1,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    bentoCardActive: {
      backgroundColor: '#FF5F00',
      borderColor: '#FF5F00',
      shadowColor: '#FF5F00',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    bentoCardInactive: {
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    },
    bentoCardLabel: {
      fontSize: 13.5,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
    },
    bentoCardLabelActive: {
      color: '#FFFFFF',
    },
    bentoCardLabelInactive: {
      color: isDark ? '#D9D5CF' : '#222222',
    },
    pendingWideCard: {
      marginHorizontal: 12,
      padding: 12,
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    pendingCardActiveBorder: {
      borderColor: '#FF5F00',
    },
    pendingIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: '#FF5F00',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingTextColumn: {
      flex: 1,
      minWidth: 0,
    },
    pendingTitleText: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111111',
    },
    pendingSubtitleText: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: isDark ? '#8A847D' : '#777777',
      marginTop: 2,
    },
    pendingBadgeWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingPulseAura: {
      position: 'absolute',
      top: -4,
      bottom: -4,
      left: -4,
      right: -4,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 95, 0, 0.45)',
    },
    pendingBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 95, 0, 0.15)',
    },
    pendingDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#FF5F00',
    },
    pendingAmountText: {
      fontSize: 15,
      fontFamily: typography.fonts.heading,
      color: '#FF5F00',
      fontWeight: '800',
    },
    financeItemRowWrap: {
      marginTop: 8,
    },
    financeItemCard: {
      marginHorizontal: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    financeItemTitle: {
      flex: 1,
      fontSize: 13.5,
      fontFamily: typography.fonts.body,
      fontWeight: '500',
      color: isDark ? '#F5F3F0' : '#111111',
    },
    pdfExcelChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    },
    pdfExcelChipText: {
      fontSize: 10,
      fontFamily: typography.fonts.body,
      color: isDark ? '#8A847D' : '#666666',
      fontWeight: '600',
    },
    systemCardsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
    },
    systemCardItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    systemIconBox: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: isDark ? '#F5F3F0' : '#EDE8DF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    systemCardLabel: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: isDark ? '#8A847D' : '#666666',
      fontWeight: '500',
    },
    floatingFooter: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      backgroundColor: isDark ? '#141414' : '#F9F8F5',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerBrandWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    footerBrandMain: {
      fontSize: 17,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: isDark ? '#F5F3F0' : '#111111',
      letterSpacing: -0.3,
    },
    footerBrandOrange: {
      color: '#FF5F00',
    },
    footerActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    footerBtnWrap: {
      position: 'relative',
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportRippleRing: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    callSquareBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FF5F00',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF5F00',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 3,
    },
    whatsAppSquareBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
  });
