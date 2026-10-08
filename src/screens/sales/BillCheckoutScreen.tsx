import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography, radii, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { billingService } from '../../services/billingService';
import { contactService } from '../../services/contactService';
import { PaymentMethod, Bill, CustomerRecord } from '../../types/models';
import { formatRupee, calculateGST } from '../../lib/money';

interface BillCheckoutScreenProps {
  onBackToMenu: () => void;
  onBillSaved: (bill: Bill, share: boolean, autoPrint?: boolean) => void;
  nextBillNo?: string;
}

interface PaymentModeConfig {
  mode: PaymentMethod;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PAYMENT_MODES: PaymentModeConfig[] = [
  {
    mode: 'Cash',
    name: 'Cash',
    description: 'Received in hand',
    icon: 'cash-outline',
  },
  {
    mode: 'GPay',
    name: 'GPay / UPI',
    description: 'Paid via app',
    icon: 'phone-portrait-outline',
  },
  {
    mode: 'Cash + GPay',
    name: 'Cash + GPay',
    description: 'Split between both',
    icon: 'swap-horizontal-outline',
  },
  {
    mode: 'Pending',
    name: 'Full Pending',
    description: 'Add to udhar ledger',
    icon: 'time-outline',
  },
  {
    mode: 'Partial Pay',
    name: 'Partial Pay',
    description: 'Part now, rest later',
    icon: 'pie-chart-outline',
  },
];

export const BillCheckoutScreen: React.FC<BillCheckoutScreenProps> = ({
  onBackToMenu,
  onBillSaved,
  nextBillNo = '#0042',
}) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { shop, refreshSubscription, subscriptionStatus } = useShop();
  const { profile, currentRole, currentMember } = useAuth();
  const {
    cart,
    increaseQty,
    decreaseQty,
    clearCart,
    subtotal,
    selectedTable,
    setSelectedTable,
    flash,
    editingBill,
    cancelEditingBill,
  } = useCart();

  // State
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>(editingBill?.paymentMode || 'Cash');
  const [customerName, setCustomerName] = useState(editingBill?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(editingBill?.customerPhone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<CustomerRecord[]>([]);

  // Split & Partial calculations
  const gstAmount = shop.gstEnabled ? calculateGST(subtotal, shop.gstRate) : 0;
  const totalAmount = subtotal + gstAmount;

  // Cash + GPay split percentage (0 - 100, step 5, default 50)
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    if (editingBill?.paymentMode === 'Cash + GPay' && editingBill.cashAmount) {
      return Math.round((editingBill.cashAmount / totalAmount) * 20) * 5;
    }
    return 50;
  });

  // Partial pay amount (step 5, default 80% rounded to 5)
  const [partialPaidAmt, setPartialPaidAmt] = useState<number>(() => {
    if (editingBill?.paymentMode === 'Partial Pay' && editingBill.paidAmount) {
      return editingBill.paidAmount;
    }
    return Math.min(totalAmount, Math.max(0, Math.round((totalAmount * 0.8) / 5) * 5));
  });

  // Update defaults if totalAmount changes
  useEffect(() => {
    if (!editingBill) {
      setPartialPaidAmt(Math.min(totalAmount, Math.max(0, Math.round((totalAmount * 0.8) / 5) * 5)));
    }
  }, [totalAmount, editingBill]);

  // Derived Split Amounts
  const splitCashAmt = Math.round((totalAmount * splitPercent) / 100);
  const splitGpayAmt = totalAmount - splitCashAmt;
  const partialDueAmt = Math.max(0, totalAmount - partialPaidAmt);

  // Dropdown Animation States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const chevronRotate = useRef(new Animated.Value(0)).current;
  const closedIconScale = useRef(new Animated.Value(1)).current;
  const rowFadeAnims = useRef(PAYMENT_MODES.map(() => new Animated.Value(0))).current;
  const rowSlideAnims = useRef(PAYMENT_MODES.map(() => new Animated.Value(10))).current;
  const checkScaleAnims = useRef(PAYMENT_MODES.map(() => new Animated.Value(0))).current;

  // Count-up total animation (0 -> totalAmount over 900ms)
  const [displayTotal, setDisplayTotal] = useState(0);
  useEffect(() => {
    let frameId: number;
    const startVal = 0;
    const endVal = totalAmount;
    const duration = 900;
    const startTime = Date.now();

    const animateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayTotal(current);
      if (progress < 1) {
        frameId = requestAnimationFrame(animateCount);
      }
    };

    frameId = requestAnimationFrame(animateCount);
    return () => cancelAnimationFrame(frameId);
  }, [totalAmount]);

  // Contextual Panel Animation
  const panelAnim = useRef(new Animated.Value(1)).current;
  const prevModeRef = useRef(paymentMode);

  useEffect(() => {
    if (prevModeRef.current !== paymentMode) {
      prevModeRef.current = paymentMode;
      panelAnim.setValue(0);
      Animated.spring(panelAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [paymentMode]);

  // Customer Card State: 'empty' | 'searching' | 'manual' | 'selected'
  type CustomerState = 'empty' | 'searching' | 'manual' | 'selected';
  const [customerState, setCustomerState] = useState<CustomerState>(() => {
    if (editingBill?.customerName || editingBill?.customerPhone) return 'selected';
    return 'empty';
  });
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerCardScale = useRef(new Animated.Value(1)).current;
  const customerCardOpacity = useRef(new Animated.Value(1)).current;
  const customerShakeAnim = useRef(new Animated.Value(0)).current;
  const pulseGlowAnim = useRef(new Animated.Value(0.5)).current;

  // Pulsing glow on empty customer card button
  useEffect(() => {
    if (customerState === 'empty') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseGlowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseGlowAnim, {
            toValue: 0.5,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [customerState]);

  // Check if reduce motion is enabled
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Load Saved Customers
  useEffect(() => {
    if (shop.id) {
      contactService.getCustomers(shop.id).then(setSavedCustomers).catch(() => {});
    }
  }, [shop.id]);

  // Filtered customers for searching
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return savedCustomers;
    const q = customerSearchQuery.toLowerCase();
    return savedCustomers.filter(
      c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [savedCustomers, customerSearchQuery]);

  // Animate State Change in Customer Card
  const transitionCustomerState = (newState: CustomerState) => {
    if (reduceMotion) {
      setCustomerState(newState);
      return;
    }
    Animated.timing(customerCardOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setCustomerState(newState);
      Animated.parallel([
        Animated.timing(customerCardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(customerCardScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Shake animation on validation error
  const triggerCustomerShake = () => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(customerShakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(customerShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Dropdown open/close handler
  const toggleDropdown = () => {
    const willOpen = !isDropdownOpen;
    setIsDropdownOpen(willOpen);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

    Animated.parallel([
      Animated.timing(dropdownAnim, {
        toValue: willOpen ? 1 : 0,
        duration: 380,
        useNativeDriver: false,
      }),
      Animated.timing(chevronRotate, {
        toValue: willOpen ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    if (willOpen) {
      PAYMENT_MODES.forEach((_, idx) => {
        rowFadeAnims[idx].setValue(0);
        rowSlideAnims[idx].setValue(10);
        checkScaleAnims[idx].setValue(PAYMENT_MODES[idx].mode === paymentMode ? 1 : 0);

        Animated.parallel([
          Animated.timing(rowFadeAnims[idx], {
            toValue: 1,
            duration: 200,
            delay: idx * 50,
            useNativeDriver: true,
          }),
          Animated.timing(rowSlideAnims[idx], {
            toValue: 0,
            duration: 220,
            delay: idx * 50,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const closeDropdown = () => {
    if (!isDropdownOpen) return;
    setIsDropdownOpen(false);
    Animated.parallel([
      Animated.timing(dropdownAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.timing(chevronRotate, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const selectPaymentMode = (mode: PaymentMethod, idx: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setPaymentMode(mode);

    // Animate checkmark spring
    PAYMENT_MODES.forEach((_, i) => {
      checkScaleAnims[i].setValue(i === idx ? 0 : 0);
    });
    Animated.spring(checkScaleAnims[idx], {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // Pop icon tile
    closedIconScale.setValue(0.85);
    Animated.spring(closedIconScale, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();

    // Auto close after 180ms
    setTimeout(() => {
      closeDropdown();
    }, 180);
  };

  // Select customer from list
  const handleSelectCustomer = (c: CustomerRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setCustomerName(c.name);
    setCustomerPhone(c.phone ? c.phone.replace(/[^0-9]/g, '').slice(0, 10) : '');
    transitionCustomerState('selected');
    flash(`Selected ${c.name}`);
  };

  // Line items details drawer
  const [isLinesExpanded, setIsLinesExpanded] = useState(false);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemNamesSummary = cart.map(i => `${i.name} (${i.quantity})`).join(', ');

  // Save / Validate
  const handleSave = async (share: boolean, autoPrint: boolean = false) => {
    if (!editingBill && subscriptionStatus.billLimitReached && !subscriptionStatus.isPaidActive) {
      flash('Free tier limit of 100 bills reached. Upgrade to Pro to continue.');
      return;
    }

    if (cart.length === 0) {
      flash('Cart is empty. Add at least one item.');
      return;
    }

    // Validation for Full Pending or Partial Pay
    const isPendingOrPartial = paymentMode === 'Pending' || paymentMode === 'Partial Pay';
    if (isPendingOrPartial) {
      const hasSelectedCustomer = customerState === 'selected' && customerName.trim().length > 0;
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      const hasValidManual =
        customerName.trim().length > 0 && cleanPhone.length === 10;

      if (!hasSelectedCustomer && !hasValidManual) {
        triggerCustomerShake();
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
        flash('Select a customer for pending dues');
        return;
      }

      if (paymentMode === 'Partial Pay') {
        if (partialPaidAmt <= 0) {
          flash('Enter amount paid by customer');
          return;
        }
        if (partialPaidAmt >= totalAmount) {
          flash('Paid amount equals total — please select Cash or GPay');
          return;
        }
      }
    } else {
      // For Cash, GPay, Cash + GPay: if phone entered, must be 10 digits
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
        triggerCustomerShake();
        flash('Mobile number must be 10 digits');
        return;
      }
    }

    // Cash + GPay validation
    if (paymentMode === 'Cash + GPay') {
      if (splitCashAmt + splitGpayAmt !== totalAmount) {
        flash(`Cash + GPay must equal ₹${totalAmount}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      let finalCustomerName = customerName.trim();
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        const matched = savedCustomers.find(
          c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone
        );
        if (matched) {
          finalCustomerName = matched.name;
        }
      }

      const userMeta = {
        name: profile?.fullName || currentMember?.fullName || currentRole,
        role: currentRole,
        id: profile?.id || currentMember?.id,
      };

      if (editingBill) {
        const updatedBill = await billingService.updateBill({
          shopId: shop.id,
          billId: editingBill.id,
          cart,
          paymentMode,
          gstEnabled: shop.gstEnabled,
          paidAmount: paymentMode === 'Partial Pay' ? partialPaidAmt : totalAmount,
          cashAmount: paymentMode === 'Cash + GPay' ? splitCashAmt : undefined,
          gpayAmount: paymentMode === 'Cash + GPay' ? splitGpayAmt : undefined,
          tableNumber: selectedTable,
          customerName: finalCustomerName || undefined,
          customerPhone: customerPhone.trim() || undefined,
          editor: userMeta,
        });

        cancelEditingBill();
        try { await refreshSubscription(); } catch {}
        onBillSaved(updatedBill, share, autoPrint);
        flash(share ? `Bill #${updatedBill.billNumber} shared on WhatsApp` : `Printing bill #${updatedBill.billNumber}`);
      } else {
        const res = await billingService.createBill({
          shopId: shop.id,
          cart,
          paymentMode,
          gstEnabled: shop.gstEnabled,
          paidAmount: paymentMode === 'Partial Pay' ? partialPaidAmt : totalAmount,
          cashAmount: paymentMode === 'Cash + GPay' ? splitCashAmt : undefined,
          gpayAmount: paymentMode === 'Cash + GPay' ? splitGpayAmt : undefined,
          tableNumber: selectedTable,
          customerName: finalCustomerName || undefined,
          customerPhone: customerPhone.trim() || undefined,
          creator: userMeta,
        });

        clearCart();
        try { await refreshSubscription(); } catch {}
        onBillSaved(res.bill, share, autoPrint);
        flash(share ? `Bill #${res.bill.billNumber} shared on WhatsApp` : `Printing bill #${res.bill.billNumber}`);
      }
    } catch (err: any) {
      console.warn('BillCheckoutScreen save error:', err);
      flash(editingBill ? 'Failed to update bill' : 'Failed to save bill');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedConfig = PAYMENT_MODES.find(m => m.mode === paymentMode) || PAYMENT_MODES[0];

  const chevronSpin = chevronRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              if (editingBill) cancelEditingBill();
              onBackToMenu();
            }}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityLabel="Back to Menu"
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? '#F5F3F0' : '#111111'} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Checkout</Text>
            <Text style={styles.headerSubtitle}>Choose payment & customer</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              if (editingBill) {
                cancelEditingBill();
                onBackToMenu();
              } else {
                clearCart();
              }
            }}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={editingBill ? 'close-circle-outline' : 'trash-outline'}
              size={14}
              color={isDark ? '#9A948D' : '#76716B'}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.clearText}>{editingBill ? 'Cancel' : 'Clear'}</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Dining Table Indicator */}
        {selectedTable && (
          <View style={styles.tableBadgeRow}>
            <View style={styles.tableBadge}>
              <Ionicons name="restaurant-outline" size={15} color="#FF5F00" />
              <Text style={styles.tableBadgeText}>Dining: {selectedTable}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedTable(null)} style={styles.clearTableBtn}>
              <Text style={styles.clearTableText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. Total Card (Black gradient, glow top-right, count-up animation over 900ms) */}
        <View style={styles.totalCard}>
          {/* Top-right soft orange glow */}
          <View style={styles.glowOrb} />

          <View style={styles.totalHeaderRow}>
            <Text style={styles.totalKicker}>TOTAL</Text>
            {editingBill && (
              <View style={styles.editingTag}>
                <Text style={styles.editingTagText}>EDITING #{editingBill.billNumber}</Text>
              </View>
            )}
          </View>

          {/* Big ₹ amount with animated count-up */}
          <Text style={styles.totalAmountText}>
            ₹{displayTotal.toLocaleString('en-IN')}
          </Text>

          {/* Item count and item names preview */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsLinesExpanded(!isLinesExpanded)}
            style={styles.itemSummaryRow}
          >
            <Text style={styles.itemSummaryText} numberOfLines={1}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} · {itemNamesSummary || 'No items'}
            </Text>
            <Ionicons
              name={isLinesExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#A8A29E"
            />
          </TouchableOpacity>

          {/* Expandable Line Items breakdown */}
          {isLinesExpanded && (
            <View style={styles.expandedLinesBox}>
              {cart.map(item => (
                <View key={item.key} style={styles.expandedLineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expandedLineName}>{item.name}</Text>
                    <Text style={styles.expandedLinePrice}>{formatRupee(item.unitPrice)} each</Text>
                  </View>
                  <View style={styles.miniStepper}>
                    <TouchableOpacity
                      onPress={() => decreaseQty(item.key)}
                      style={styles.miniStepBtn}
                    >
                      <Ionicons name="remove" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.miniStepQty}>{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => increaseQty(item.key)}
                      style={styles.miniStepBtn}
                    >
                      <Ionicons name="add" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.expandedLineTotal}>{formatRupee(item.lineTotal)}</Text>
                </View>
              ))}
              {shop.gstEnabled && (
                <View style={styles.gstRow}>
                  <Text style={styles.gstText}>GST ({shop.gstRate}%)</Text>
                  <Text style={styles.gstText}>{formatRupee(gstAmount)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 3. Payment Mode Section Header */}
        <Text style={styles.sectionTitle}>Payment mode</Text>

        {/* Payment Mode Dropdown */}
        <View style={styles.dropdownContainer}>
          {/* Closed / Main Header Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={toggleDropdown}
            accessibilityRole="combobox"
            accessibilityState={{ expanded: isDropdownOpen }}
            accessibilityLabel={`Payment mode: ${selectedConfig.name}`}
            style={[
              styles.dropdownHeaderCard,
              isDropdownOpen && styles.dropdownHeaderCardActive,
            ]}
          >
            <Animated.View
              style={[
                styles.modeIconTile,
                { transform: [{ scale: closedIconScale }] },
              ]}
            >
              <Ionicons name={selectedConfig.icon} size={22} color="#FF5F00" />
            </Animated.View>

            <View style={styles.dropdownHeaderInfo}>
              <Text style={styles.selectedCaption}>Selected</Text>
              <Text style={styles.selectedModeName}>{selectedConfig.name}</Text>
            </View>

            <Animated.View style={{ transform: [{ rotate: chevronSpin }] }}>
              <Ionicons
                name="chevron-down"
                size={20}
                color={isDropdownOpen ? '#FF5F00' : isDark ? '#9A948D' : '#76716B'}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Dropdown Options List */}
          {isDropdownOpen && (
            <View style={styles.dropdownOptionsList}>
              {PAYMENT_MODES.map((item, idx) => {
                const isSelected = item.mode === paymentMode;
                return (
                  <Animated.View
                    key={item.mode}
                    style={{
                      opacity: rowFadeAnims[idx],
                      transform: [{ translateY: rowSlideAnims[idx] }],
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => selectPaymentMode(item.mode, idx)}
                      style={[
                        styles.dropdownOptionRow,
                        isSelected && styles.dropdownOptionRowSelected,
                      ]}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.optionIconTile,
                          isSelected && styles.optionIconTileSelected,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={isSelected ? '#FF5F00' : isDark ? '#F5F3F0' : '#111111'}
                        />
                      </View>

                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                          {item.name}
                        </Text>
                        <Text style={styles.optionDesc}>{item.description}</Text>
                      </View>

                      {isSelected && (
                        <Animated.View
                          style={[
                            styles.selectedCheckWrap,
                            { transform: [{ scale: checkScaleAnims[idx] }] },
                          ]}
                        >
                          <Ionicons name="checkmark-circle" size={22} color="#FF5F00" />
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        {/* 4. Contextual Panel (Directly under dropdown, animated fade+slide on mode change) */}
        <Animated.View
          style={[
            styles.contextualPanel,
            {
              opacity: panelAnim,
              transform: [
                {
                  translateY: panelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Mode: Cash */}
          {paymentMode === 'Cash' && (
            <View style={styles.noteCard}>
              <Ionicons name="cash" size={18} color="#FF5F00" style={{ marginRight: 10 }} />
              <Text style={styles.noteText}>
                Collect <Text style={styles.boldText}>{formatRupee(totalAmount)}</Text> in cash
              </Text>
            </View>
          )}

          {/* Mode: GPay / UPI */}
          {paymentMode === 'GPay' && (
            <View style={styles.noteCard}>
              <Ionicons name="qr-code" size={18} color="#FF5F00" style={{ marginRight: 10 }} />
              <Text style={styles.noteText}>
                Customer pays <Text style={styles.boldText}>{formatRupee(totalAmount)}</Text> by GPay / UPI
              </Text>
            </View>
          )}

          {/* Mode: Cash + GPay (Split bar + slider 0..100) */}
          {paymentMode === 'Cash + GPay' && (
            <View style={styles.splitBox}>
              <View style={styles.splitValuesRow}>
                <View style={styles.splitValTag}>
                  <Text style={styles.splitValLabel}>Cash (Black)</Text>
                  <Text style={styles.splitValAmount}>{formatRupee(splitCashAmt)}</Text>
                </View>
                <View style={[styles.splitValTag, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.splitValLabel, { color: '#FF5F00' }]}>GPay (Orange)</Text>
                  <Text style={[styles.splitValAmount, { color: '#FF5F00' }]}>
                    {formatRupee(splitGpayAmt)}
                  </Text>
                </View>
              </View>

              {/* Animated Split Bar */}
              <View style={styles.splitBarTrack}>
                <View style={[styles.splitBarCash, { width: `${splitPercent}%` }]} />
                <View style={[styles.splitBarGpay, { width: `${100 - splitPercent}%` }]} />
              </View>

              {/* Stepper / Slider Controls */}
              <View style={styles.sliderControlRow}>
                <TouchableOpacity
                  onPress={() => setSplitPercent(prev => Math.max(0, prev - 5))}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>− 5%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSplitPercent(50)}
                  style={[styles.stepCtrlBtn, splitPercent === 50 && styles.stepCtrlBtnActive]}
                >
                  <Text style={[styles.stepCtrlBtnText, splitPercent === 50 && styles.stepCtrlBtnTextActive]}>
                    50 / 50
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSplitPercent(prev => Math.min(100, prev + 5))}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>+ 5%</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mode: Full Pending */}
          {paymentMode === 'Pending' && (
            <View style={styles.noteCard}>
              <Ionicons name="time" size={18} color="#DC2626" style={{ marginRight: 10 }} />
              <Text style={styles.noteText}>
                <Text style={styles.boldText}>{formatRupee(totalAmount)}</Text> will be added to the udhar ledger · customer needed
              </Text>
            </View>
          )}

          {/* Mode: Partial Pay (Paid/Due bar + slider 0..totalAmount) */}
          {paymentMode === 'Partial Pay' && (
            <View style={styles.splitBox}>
              <View style={styles.splitValuesRow}>
                <View style={styles.splitValTag}>
                  <Text style={[styles.splitValLabel, { color: '#059669' }]}>Paid Now</Text>
                  <Text style={[styles.splitValAmount, { color: '#059669' }]}>
                    {formatRupee(partialPaidAmt)}
                  </Text>
                </View>
                <View style={[styles.splitValTag, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.splitValLabel, { color: '#DC2626' }]}>Due on Ledger</Text>
                  <Text style={[styles.splitValAmount, { color: '#DC2626' }]}>
                    {formatRupee(partialDueAmt)}
                  </Text>
                </View>
              </View>

              {/* Paid / Due Progress Bar */}
              <View style={styles.partialBarTrack}>
                <View
                  style={[
                    styles.partialBarFill,
                    {
                      width: totalAmount > 0 ? `${Math.min(100, (partialPaidAmt / totalAmount) * 100)}%` : '0%',
                    },
                  ]}
                />
              </View>

              {/* Stepper Controls */}
              <View style={styles.sliderControlRow}>
                <TouchableOpacity
                  onPress={() => setPartialPaidAmt(prev => Math.max(0, prev - 5))}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>− ₹5</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPartialPaidAmt(Math.round((totalAmount * 0.5) / 5) * 5)}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>50%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPartialPaidAmt(Math.round((totalAmount * 0.8) / 5) * 5)}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>80%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPartialPaidAmt(prev => Math.min(totalAmount, prev + 5))}
                  style={styles.stepCtrlBtn}
                >
                  <Text style={styles.stepCtrlBtnText}>+ ₹5</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>

        {/* 5. Customer Card (ADD CUSTOMER (OPTIONAL)) */}
        <View style={styles.customerCardSection}>
          <Text style={styles.customerSectionTitle}>
            {paymentMode === 'Pending' || paymentMode === 'Partial Pay'
              ? 'CUSTOMER DETAILS (REQUIRED)'
              : 'ADD CUSTOMER (OPTIONAL)'}
          </Text>
          <Text style={styles.customerSectionSubtitle}>
            {paymentMode === 'Pending' || paymentMode === 'Partial Pay'
              ? 'Enter customer name & 10-digit mobile number for udhar ledger'
              : 'Enter customer name & phone for direct WhatsApp chat receipt'}
          </Text>

          <Animated.View
            style={[
              {
                transform: [
                  { scale: customerCardScale },
                  { translateX: customerShakeAnim },
                ],
                opacity: customerCardOpacity,
              },
            ]}
          >
            {/* State 1: Empty */}
            {customerState === 'empty' && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => transitionCustomerState('searching')}
                style={styles.emptyCustomerBtn}
              >
                <Animated.View
                  style={[
                    styles.emptyCustomerGlow,
                    { opacity: pulseGlowAnim },
                  ]}
                />
                <Ionicons name="search" size={17} color="#FF5F00" style={{ marginRight: 8 }} />
                <Text style={styles.emptyCustomerText}>Search or Select Customer</Text>
              </TouchableOpacity>
            )}

            {/* State 2: Searching */}
            {customerState === 'searching' && (
              <View style={styles.searchingCard}>
                <View style={styles.searchFieldWrap}>
                  <Ionicons name="search-outline" size={16} color={isDark ? '#9A948D' : '#76716B'} />
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Search name or mobile number..."
                    placeholderTextColor={isDark ? '#9A948D' : '#76716B'}
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                    autoFocus
                  />
                  {customerSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomerSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={isDark ? '#9A948D' : '#76716B'} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Horizontally scrollable row of customer avatar chips (48px rounded squares) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.avatarChipsScroll}
                >
                  {filteredCustomers.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.75}
                      onPress={() => handleSelectCustomer(c)}
                      style={styles.avatarChipBtn}
                    >
                      <View style={styles.avatarSquare}>
                        <Text style={styles.avatarInitial}>
                          {c.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {c.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <Text style={styles.noMatchText}>No matching customer</Text>
                  )}
                </ScrollView>

                {/* Text link to enter manually */}
                <TouchableOpacity
                  onPress={() => transitionCustomerState('manual')}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>+ Enter name & phone manually</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* State 3: Manual */}
            {customerState === 'manual' && (
              <View style={styles.manualCard}>
                <View style={styles.manualInputsWrap}>
                  <TextInput
                    style={styles.manualInput}
                    placeholder="Customer Name (Optional)"
                    placeholderTextColor={isDark ? '#9A948D' : '#76716B'}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    style={styles.manualInput}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={isDark ? '#9A948D' : '#76716B'}
                    keyboardType="numeric"
                    maxLength={10}
                    value={customerPhone}
                    onChangeText={t => {
                      const clean = t.replace(/[^0-9]/g, '').slice(0, 10);
                      setCustomerPhone(clean);
                      if (clean.length === 10) {
                        const matched = savedCustomers.find(
                          c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === clean
                        );
                        if (matched) {
                          setCustomerName(matched.name);
                          flash(`Customer found: ${matched.name}`);
                        }
                      }
                    }}
                  />
                </View>

                {/* Link to go back to search */}
                <TouchableOpacity
                  onPress={() => transitionCustomerState('searching')}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>← Search customers</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* State 4: Selected */}
            {customerState === 'selected' && (
              <View style={styles.selectedCustomerCard}>
                <View style={styles.selectedCustomerLeft}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedCustomerName} numberOfLines={1}>
                      {customerName || 'Customer'}
                    </Text>
                    <Text style={styles.selectedCustomerPhone}>
                      {customerPhone ? `+91 ${customerPhone}` : 'No phone recorded'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => transitionCustomerState('searching')}
                  style={styles.changeChip}
                >
                  <Text style={styles.changeChipText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* 6. Sticky Bottom Action Bar above the bottom nav */}
      <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleSave(false, true)}
          disabled={cart.length === 0 || isSaving}
          style={[styles.printOutlineBtn, (cart.length === 0 || isSaving) && styles.btnDisabled]}
          accessibilityLabel="Print Receipt"
        >
          <Ionicons
            name="print-outline"
            size={19}
            color={isDark ? '#F5F3F0' : '#111111'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.printOutlineBtnText}>Print</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleSave(true, false)}
          disabled={cart.length === 0 || isSaving}
          style={[styles.shareWhatsappBtn, (cart.length === 0 || isSaving) && styles.btnDisabled]}
          accessibilityLabel="Share on WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.shareWhatsappBtnText}>Share WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const bg = isDark ? '#0B0B0B' : '#FAF8F5';
  const surface = isDark ? '#171717' : '#FFFFFF';
  const alt = isDark ? '#1F1F1F' : '#F3F0EB';
  const ink = isDark ? '#F5F3F0' : '#111111';
  const muted = isDark ? '#9A948D' : '#76716B';
  const line = isDark ? '#2A2A2A' : '#EBE7E1';
  const orange = '#FF5F00';
  const orangeSoft = isDark ? '#3A2111' : '#FFF0E6';
  const orangeText = isDark ? '#FF8A3D' : '#D94F00';
  const whatsappGreen = '#1FAD55';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },

    // ─── Header ─────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    headerTitleWrap: {
      flex: 1,
    },
    headerTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      fontWeight: '800',
      color: ink,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: muted,
      marginTop: 1,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: surface,
    },
    clearText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: muted,
    },

    // ─── Dining Table Badge ─────────────────────────────────────────────────
    tableBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: orangeSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.3)' : '#FED7AA',
    },
    tableBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    tableBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      fontWeight: '700',
      color: orangeText,
    },
    clearTableBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDark ? '#27272A' : '#FFE7D6',
    },
    clearTableText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: orangeText,
    },

    // ─── Total Card (Black Gradient with Top-Right Glow) ───────────────────
    totalCard: {
      borderRadius: 22,
      backgroundColor: '#111111',
      padding: 20,
      marginBottom: 16,
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? '#27272A' : '#1C1917',
      ...shadows.card,
    },
    glowOrb: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255, 95, 0, 0.18)',
    },
    totalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    totalKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: '#A8A29E',
    },
    editingTag: {
      backgroundColor: 'rgba(255, 95, 0, 0.25)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 95, 0, 0.4)',
    },
    editingTagText: {
      fontFamily: typography.fonts.heading,
      fontSize: 9.5,
      fontWeight: '800',
      color: '#FF8A3D',
      letterSpacing: 0.5,
    },
    totalAmountText: {
      fontFamily: typography.fonts.numbers,
      fontSize: 40,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      marginVertical: 4,
      fontVariant: ['tabular-nums'],
    },
    itemSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    itemSummaryText: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: '#A8A29E',
      flex: 1,
      marginRight: 6,
    },
    expandedLinesBox: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.08)',
      gap: 10,
    },
    expandedLineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    expandedLineName: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    expandedLinePrice: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: '#A8A29E',
    },
    miniStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 10,
      padding: 2,
    },
    miniStepBtn: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    miniStepQty: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFF',
      width: 22,
      textAlign: 'center',
    },
    expandedLineTotal: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '800',
      color: '#FF8A3D',
      width: 55,
      textAlign: 'right',
    },
    gstRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    gstText: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: '#A8A29E',
    },

    // ─── Payment Mode Section ───────────────────────────────────────────────
    sectionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '800',
      color: ink,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    dropdownContainer: {
      marginBottom: 10,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(23, 23, 23, 0.85)' : 'rgba(255, 255, 255, 0.85)',
      borderWidth: 1,
      borderColor: line,
      overflow: 'hidden',
      ...shadows.card,
    },
    dropdownHeaderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 18,
      backgroundColor: 'transparent',
    },
    dropdownHeaderCardActive: {
      borderWidth: 1,
      borderColor: orange,
      shadowColor: orange,
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 4,
    },
    modeIconTile: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: orangeSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    dropdownHeaderInfo: {
      flex: 1,
    },
    selectedCaption: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      fontWeight: '700',
      color: muted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    selectedModeName: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '800',
      color: ink,
      marginTop: 1,
    },
    dropdownOptionsList: {
      borderTopWidth: 1,
      borderTopColor: line,
      paddingVertical: 4,
    },
    dropdownOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    dropdownOptionRowSelected: {
      backgroundColor: orangeSoft,
    },
    optionIconTile: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: alt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    optionIconTileSelected: {
      backgroundColor: orangeSoft,
    },
    optionTextWrap: {
      flex: 1,
    },
    optionName: {
      fontFamily: typography.fonts.heading,
      fontSize: 14.5,
      fontWeight: '700',
      color: ink,
    },
    optionNameSelected: {
      color: orangeText,
      fontWeight: '800',
    },
    optionDesc: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: muted,
      marginTop: 1,
    },
    selectedCheckWrap: {
      marginLeft: 8,
    },

    // ─── Contextual Panel ───────────────────────────────────────────────────
    contextualPanel: {
      marginBottom: 16,
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.3)' : 'rgba(255, 95, 0, 0.25)',
    },
    noteText: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: ink,
      flex: 1,
    },
    boldText: {
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: orangeText,
    },
    splitBox: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
      gap: 12,
      ...shadows.sm,
    },
    splitValuesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    splitValTag: {
      flex: 1,
    },
    splitValLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: muted,
      letterSpacing: 0.4,
    },
    splitValAmount: {
      fontFamily: typography.fonts.numbers,
      fontSize: 17,
      fontWeight: '800',
      color: ink,
      marginTop: 2,
    },
    splitBarTrack: {
      height: 12,
      borderRadius: 6,
      flexDirection: 'row',
      overflow: 'hidden',
      backgroundColor: '#111111',
    },
    splitBarCash: {
      height: '100%',
      backgroundColor: '#111111',
    },
    splitBarGpay: {
      height: '100%',
      backgroundColor: orange,
    },
    partialBarTrack: {
      height: 12,
      borderRadius: 6,
      backgroundColor: orangeSoft,
      overflow: 'hidden',
    },
    partialBarFill: {
      height: '100%',
      backgroundColor: orange,
      borderRadius: 6,
    },
    sliderControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    stepCtrlBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: alt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: line,
    },
    stepCtrlBtnActive: {
      backgroundColor: orange,
      borderColor: orange,
    },
    stepCtrlBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: ink,
    },
    stepCtrlBtnTextActive: {
      color: '#FFFFFF',
    },

    // ─── Customer Card Section ──────────────────────────────────────────────
    customerCardSection: {
      marginBottom: 20,
    },
    customerSectionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: muted,
      textTransform: 'uppercase',
    },
    customerSectionSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
      marginTop: 2,
      marginBottom: 10,
    },
    emptyCustomerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: orange,
      backgroundColor: surface,
      position: 'relative',
      overflow: 'hidden',
      paddingHorizontal: 16,
    },
    emptyCustomerGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: orangeSoft,
    },
    emptyCustomerText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '800',
      color: orangeText,
      letterSpacing: 0.2,
    },
    searchingCard: {
      borderRadius: 18,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
      padding: 14,
      gap: 12,
      ...shadows.card,
    },
    searchFieldWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: alt,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
      gap: 8,
    },
    searchTextInput: {
      flex: 1,
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: ink,
    },
    avatarChipsScroll: {
      gap: 10,
      paddingVertical: 2,
    },
    avatarChipBtn: {
      alignItems: 'center',
      width: 58,
    },
    avatarSquare: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.4)' : '#FED7AA',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    avatarInitial: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: orangeText,
    },
    avatarName: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      color: ink,
      textAlign: 'center',
    },
    noMatchText: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
      paddingVertical: 10,
    },
    linkBtn: {
      alignSelf: 'center',
      paddingVertical: 4,
    },
    linkBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      fontWeight: '700',
      color: orange,
    },
    manualCard: {
      borderRadius: 18,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
      padding: 14,
      gap: 12,
      ...shadows.card,
    },
    manualInputsWrap: {
      gap: 10,
    },
    manualInput: {
      height: 44,
      backgroundColor: alt,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 13.5,
      fontFamily: typography.fonts.body,
      color: ink,
      borderWidth: 1,
      borderColor: line,
    },
    selectedCustomerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 18,
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.4)' : '#FED7AA',
    },
    selectedCustomerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    checkCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedCustomerName: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: ink,
    },
    selectedCustomerPhone: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
      marginTop: 1,
    },
    changeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
    },
    changeChipText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      fontWeight: '800',
      color: orange,
    },

    // ─── Sticky Bottom Action Bar ───────────────────────────────────────────
    bottomActionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: isDark ? '#171717' : '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: line,
      gap: 12,
      ...shadows.card,
    },
    printOutlineBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: line,
      backgroundColor: surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    printOutlineBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14.5,
      fontWeight: '800',
      color: ink,
    },
    shareWhatsappBtn: {
      flex: 1.8,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: whatsappGreen,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    shareWhatsappBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
};
