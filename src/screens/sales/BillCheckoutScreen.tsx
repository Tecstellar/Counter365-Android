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
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography, radii, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { billingService } from '../../services/billingService';
import { contactService } from '../../services/contactService';
import { printerService, ThermalPaperSize } from '../../services/printerService';
import { whatsappService } from '../../services/whatsappService';
import { exportService } from '../../services/exportService';
import { PaymentMethod, Bill, CustomerRecord } from '../../types/models';
import { formatRupee, calculateGST } from '../../lib/money';

interface BillCheckoutScreenProps {
  onBackToMenu: () => void;
  onBillSaved: (bill: Bill, share: boolean, autoPrint?: boolean, paperSize?: ThermalPaperSize, customPdfUrl?: string) => void;
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

const ticketStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 14,
  },
  sproutAnchor: {
    position: 'absolute',
    top: -15,
    left: 14,
    zIndex: 20,
    alignItems: 'center',
  },
  sproutLeaves: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -2,
  },
  soilMound: {
    width: 18,
    height: 7,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#8D6E63',
  },
  paperBody: {
    backgroundColor: '#F3FAF5',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 14,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stampCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
    backgroundColor: '#EBF8F0',
    position: 'relative',
  },
  stampInnerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#16A34A',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampTextTop: {
    position: 'absolute',
    top: 2,
    fontSize: 6,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  stampTextBottom: {
    position: 'absolute',
    bottom: 2,
    fontSize: 6,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  headlineBlock: {
    marginTop: 10,
    marginBottom: 8,
  },
  headlineText: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '900',
    color: '#14532D',
    lineHeight: 22,
  },
  headlineHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  paperPill: {
    backgroundColor: '#BBF7D0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginHorizontal: 1,
  },
  dashedLine: {
    borderTopWidth: 1.5,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
    marginVertical: 8,
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 2,
  },
  savedTodayGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  savedTodayLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  segmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  segmentBlock: {
    width: 6,
    height: 12,
    borderRadius: 2,
  },
  countText: {
    fontFamily: typography.fonts.numbers,
    fontSize: 18,
    fontWeight: '900',
    color: '#15803D',
  },
  sawtoothContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 10,
    overflow: 'hidden',
  },
  sawtoothTooth: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F3FAF5',
  },
});

const SavedBillTicketCard: React.FC<{ billNumber: string | number; isDark?: boolean }> = ({ billNumber, isDark = true }) => {
  // Extract trailing numeric sequence from billNumber (e.g. "#0010" -> 10, "BILL-OCT-0010" -> 10, 10 -> 10)
  const numStr = String(billNumber ?? '');
  const matches = numStr.match(/(\d+)(?!.*\d)/);
  const parsedCount = matches ? parseInt(matches[1], 10) : (Number(billNumber) || 1);
  const countToday = parsedCount > 0 ? parsedCount : 1;
  const progressColors = ['#BBF7D0', '#A7F3D0', '#86EFAC', '#6EE7B7', '#34D399', '#10B981', '#059669'];
  const ticketBg = isDark ? '#F3FAF5' : '#F0FDF4';

  return (
    <View style={ticketStyles.wrapper}>
      {/* Sprout plant on top-left edge */}
      <View style={ticketStyles.sproutAnchor}>
        <View style={ticketStyles.sproutLeaves}>
          <Ionicons name="leaf" size={14} color="#4ADE80" style={{ transform: [{ rotate: '-35deg' }], marginRight: -4 }} />
          <Ionicons name="leaf" size={14} color="#22C55E" style={{ transform: [{ rotate: '35deg' }] }} />
        </View>
        <View style={ticketStyles.soilMound} />
      </View>

      {/* Main Paper Receipt Body */}
      <View style={[ticketStyles.paperBody, { backgroundColor: ticketBg }, !isDark && { borderWidth: 1, borderBottomWidth: 0, borderColor: '#DCFCE7' }]}>
        {/* Top Section */}
        <View style={ticketStyles.topRow}>
          <View>
            <Text style={ticketStyles.metaLabel}>Printed copies: 0</Text>
            <Text style={[ticketStyles.metaLabel, { marginTop: 3 }]}>Saved digitally</Text>
          </View>

          {/* Rubber Stamp */}
          <View style={ticketStyles.stampCircle}>
            <View style={ticketStyles.stampInnerCircle}>
              <Ionicons name="leaf-outline" size={16} color="#15803D" />
            </View>
            <Text style={ticketStyles.stampTextTop}>PAPER SAVED</Text>
            <Text style={ticketStyles.stampTextBottom}>• NO PRINT •</Text>
          </View>
        </View>

        {/* Headline */}
        <View style={ticketStyles.headlineBlock}>
          <Text style={ticketStyles.headlineText}>You saved a piece</Text>
          <View style={ticketStyles.headlineHighlightRow}>
            <Text style={ticketStyles.headlineText}>of </Text>
            <View style={ticketStyles.paperPill}>
              <Text style={ticketStyles.headlineText}>paper</Text>
            </View>
            <Text style={ticketStyles.headlineText}>!</Text>
          </View>
        </View>

        {/* Dashed line */}
        <View style={ticketStyles.dashedLine} />

        {/* Bottom Row */}
        <View style={ticketStyles.bottomRow}>
          <View style={ticketStyles.savedTodayGroup}>
            <Text style={ticketStyles.savedTodayLabel}>Saved today</Text>
            <View style={ticketStyles.segmentsRow}>
              {progressColors.map((c, i) => (
                <View key={i} style={[ticketStyles.segmentBlock, { backgroundColor: c }]} />
              ))}
            </View>
          </View>

          <Text style={ticketStyles.countText}>{countToday}</Text>
        </View>
      </View>

      {/* Sawtooth / Zigzag bottom border */}
      <View style={ticketStyles.sawtoothContainer}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={[ticketStyles.sawtoothTooth, { borderTopColor: ticketBg }]} />
        ))}
      </View>
    </View>
  );
};

export const BillCheckoutScreen: React.FC<BillCheckoutScreenProps> = ({
  onBackToMenu,
  onBillSaved,
  nextBillNo = '#0042',
}) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { shop, updateShop, refreshSubscription, subscriptionStatus } = useShop();
  const { profile, currentRole, currentMember, can } = useAuth();
  const { t } = useLanguage();
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(editingBill?.customerId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrintingNow, setIsPrintingNow] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<CustomerRecord[]>([]);

  // Localized payment modes list
  const paymentModesList = useMemo(() => [
    {
      mode: 'Cash' as PaymentMethod,
      name: t('mode_cash', 'Cash'),
      description: 'Received in hand',
      icon: 'cash-outline' as const,
    },
    {
      mode: 'GPay' as PaymentMethod,
      name: t('mode_gpay', 'GPay / UPI'),
      description: 'Paid via app',
      icon: 'phone-portrait-outline' as const,
    },
    {
      mode: 'Cash + GPay' as PaymentMethod,
      name: t('mode_cash_gpay', 'Cash + GPay'),
      description: 'Split between both',
      icon: 'swap-horizontal-outline' as const,
    },
    {
      mode: 'Pending' as PaymentMethod,
      name: t('mode_full_pending', 'Full Pending'),
      description: 'Add to udhar ledger',
      icon: 'time-outline' as const,
    },
    {
      mode: 'Partial Pay' as PaymentMethod,
      name: t('mode_partial_pay', 'Partial Pay'),
      description: 'Part now, rest later',
      icon: 'pie-chart-outline' as const,
    },
  ], [t]);

  // Thermal paper size, WhatsApp prompt, and save-bill modal states
  const [isPaymentModesOpen, setIsPaymentModesOpen] = useState(false);
  const [isWhatsAppPromptOpen, setIsWhatsAppPromptOpen] = useState(false);
  const [whatsAppPromptPhone, setWhatsAppPromptPhone] = useState('');
  const [whatsAppPromptName, setWhatsAppPromptName] = useState('');
  const [whatsAppContactSearch, setWhatsAppContactSearch] = useState('');
  const [selectedWhatsAppContact, setSelectedWhatsAppContact] = useState<CustomerRecord | null>(null);
  const [whatsAppModalError, setWhatsAppModalError] = useState<string | null>(null);
  const [thermalPaperSize, setThermalPaperSize] = useState<ThermalPaperSize>('80mm');
  const [savedBillSuccess, setSavedBillSuccess] = useState<Bill | null>(null);
  const [billDateOption, setBillDateOption] = useState<'today' | 'yesterday'>('today');
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number>(0);

  // Thermal printer reactive state: dynamically follows printerEnabled toggle in Account Settings
  const isPrinterConfigured = Boolean(shop.printerEnabled);

  // Auto-close timer for bill save success modal:
  // If thermal printer is enabled: 10 seconds.
  // If thermal printer is disabled: 3 seconds.
  useEffect(() => {
    if (!savedBillSuccess) {
      setAutoCloseCountdown(0);
      return;
    }
    const duration = isPrinterConfigured ? 10 : 3;
    setAutoCloseCountdown(duration);

    const interval = setInterval(() => {
      setAutoCloseCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setSavedBillSuccess(null);
          onBackToMenu();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [savedBillSuccess, isPrinterConfigured]);

  const effectiveBillDate = useMemo(() => {
    if (editingBill?.createdAt) return new Date(editingBill.createdAt);
    if (billDateOption === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    }
    return new Date();
  }, [editingBill, billDateOption]);

  const isPendingOrPartial = paymentMode === 'Pending' || paymentMode === 'Partial Pay';
  const selectedModeConfig = paymentModesList.find(m => m.mode === paymentMode) || paymentModesList[0];

  // Split & Partial calculations
  const gstAmount = shop.gstEnabled ? calculateGST(subtotal, shop.gstRate) : 0;
  const totalAmount = subtotal + gstAmount;

  // Partial pay amount input (manual entry)
  // Partial pay amount input (manual entry) - empty by default so user can enter amount directly
  const [partialPaidInput, setPartialPaidInput] = useState<string>(() => {
    if (editingBill?.paymentMode === 'Partial Pay' && editingBill.paidAmount !== undefined) {
      return String(editingBill.paidAmount);
    }
    return '';
  });

  // Cash + GPay split inputs (manual entry) - empty by default so user can enter amount directly
  const [splitCashInput, setSplitCashInput] = useState<string>(() => {
    if (editingBill?.paymentMode === 'Cash + GPay' && editingBill.cashAmount !== undefined) {
      return String(editingBill.cashAmount);
    }
    return '';
  });

  const [splitGpayInput, setSplitGpayInput] = useState<string>(() => {
    if (editingBill?.paymentMode === 'Cash + GPay' && editingBill.gpayAmount !== undefined) {
      return String(editingBill.gpayAmount);
    }
    return '';
  });

  // Reset inputs when totalAmount changes
  useEffect(() => {
    if (!editingBill) {
      setPartialPaidInput('');
      setSplitCashInput('');
      setSplitGpayInput('');
    }
  }, [totalAmount, editingBill]);

  // Immediate override protection: If owner revokes billing permission while checkout is open
  useEffect(() => {
    if (!can('bill')) {
      flash(t('no_access', "You don't have access for that"));
      onBackToMenu();
    }
  }, [can]);

  const partialPaidAmt = Math.min(totalAmount, Math.max(0, Number(partialPaidInput) || 0));
  const partialDueAmt = Math.max(0, totalAmount - partialPaidAmt);

  const splitCashAmt = Math.max(0, Number(splitCashInput) || 0);
  const splitGpayAmt = Math.max(0, Number(splitGpayInput) || 0);

  // Shop UPI ID prompt modal state
  const [isUpiPromptOpen, setIsUpiPromptOpen] = useState(false);
  const [shopUpiInput, setShopUpiInput] = useState(shop.upiId || '');

  const handleSelectPaymentMode = (mode: PaymentMethod) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setPaymentMode(mode);

    // Keep fields empty when selecting Partial Pay or Cash + GPay so user can enter custom values
    if (!editingBill) {
      if (mode === 'Partial Pay') {
        setPartialPaidInput('');
      } else if (mode === 'Cash + GPay') {
        setSplitCashInput('');
        setSplitGpayInput('');
      }
    }

    if ((mode === 'Partial Pay' || mode === 'Pending') && !shop.upiId) {
      setIsUpiPromptOpen(true);
    }
  };

  const handleCashInputChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setSplitCashInput(clean);
    if (!clean) {
      setSplitGpayInput('');
    } else {
      const num = Number(clean) || 0;
      const remainder = Math.max(0, totalAmount - num);
      setSplitGpayInput(String(remainder));
    }
  };

  const handleGpayInputChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setSplitGpayInput(clean);
    if (!clean) {
      setSplitCashInput('');
    } else {
      const num = Number(clean) || 0;
      const remainder = Math.max(0, totalAmount - num);
      setSplitCashInput(String(remainder));
    }
  };

  const handlePartialPaidChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    const num = Number(clean) || 0;
    if (num > totalAmount) {
      setPartialPaidInput(String(totalAmount));
    } else {
      setPartialPaidInput(clean);
    }
  };

  // Handle saving shop UPI ID
  const handleSaveShopUpi = async () => {
    if (shopUpiInput.trim()) {
      await updateShop({ upiId: shopUpiInput.trim() });
      flash('Shop UPI ID saved');
    }
    setIsUpiPromptOpen(false);
  };

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

  // Filtered contacts for WhatsApp share prompt widget (only visible when searching)
  const filteredWhatsAppContacts = useMemo(() => {
    if (!whatsAppContactSearch.trim()) {
      return [];
    }
    const q = whatsAppContactSearch.toLowerCase();
    return savedCustomers.filter(
      c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [savedCustomers, whatsAppContactSearch]);

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


  // Select customer from list
  const handleSelectCustomer = (c: CustomerRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setCustomerName(c.name);
    setCustomerPhone(c.phone ? c.phone.replace(/[^0-9]/g, '').slice(0, 10) : '');
    setSelectedCustomerId(c.id);
    transitionCustomerState('selected');
    flash(`Selected ${c.name}`);
  };

  // Line items details drawer
  const [isLinesExpanded, setIsLinesExpanded] = useState(false);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemNamesSummary = cart.map(i => `${i.name} (${i.quantity})`).join(', ');

  // Save / Validate
  const handleSave = async (
    share: boolean,
    autoPrint: boolean = false,
    paperSize?: ThermalPaperSize,
    overridePhone?: string,
    closeAfter: boolean = false,
    overrideName?: string,
    overrideCustomerId?: string
  ) => {
    // Only permit thermal printing if printer is actually configured and paired in Account settings
    const effectiveAutoPrint = autoPrint && isPrinterConfigured;

    if (!can('bill')) {
      flash('Billing access is disabled for your account. Please contact the owner.');
      return;
    }

    if (!editingBill && subscriptionStatus.billLimitReached && !subscriptionStatus.isPaidActive) {
      flash('Free tier limit of 100 bills reached. Upgrade to Pro to continue.');
      return;
    }

    if (cart.length === 0) {
      flash('Cart is empty. Add at least one item.');
      return;
    }

    const effectivePhone = (overridePhone !== undefined ? overridePhone : customerPhone).trim();
    const effectiveName = (overrideName !== undefined ? overrideName : customerName).trim();

    // Validation for Full Pending or Partial Pay
    if (isPendingOrPartial) {
      const cleanPhone = effectivePhone.replace(/[^0-9]/g, '').slice(-10);
      const hasCustomer = cleanPhone.length === 10;

      if (!hasCustomer) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
        setWhatsAppModalError('Enter a valid 10-digit mobile number for pending dues');
        setWhatsAppPromptPhone(cleanPhone);
        setWhatsAppPromptName(effectiveName);
        setWhatsAppContactSearch('');
        setIsWhatsAppPromptOpen(true);
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
      const cleanPhone = effectivePhone.replace(/[^0-9]/g, '');
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

    if (!can('bill')) {
      flash(t('no_access', "You don't have access for that"));
      onBackToMenu();
      return;
    }

    if (isPendingOrPartial && !can('pend')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }

    setIsSaving(true);
    try {
      const cleanPhone = effectivePhone.replace(/[^0-9]/g, '').slice(-10);
      let finalCustomerName = effectiveName || (cleanPhone.length === 10 ? 'Customer' : '');
      let finalCustomerId = overrideCustomerId || selectedCustomerId;

      // Auto-save customer in background (non-blocking for continuous fast speed)
      if (cleanPhone.length === 10) {
        contactService.addCustomer(
          shop.id,
          finalCustomerName || 'Customer',
          cleanPhone
        ).then(custRecord => {
          if (custRecord) {
            setSavedCustomers(prev => [custRecord, ...prev.filter(c => c.id !== custRecord.id)]);
          }
        }).catch(err => {
          console.warn('Auto-save customer notice:', err);
        });
      }

      const userMeta = {
        name: profile?.fullName || currentMember?.fullName || currentRole,
        role: currentRole,
        id: profile?.id || currentMember?.id,
      };

      if (editingBill) {
        if (currentRole === 'Biller') {
          flash('Only Owner or Supervisor can edit completed bills');
          setIsSaving(false);
          return;
        }

        const updatedBill = await billingService.updateBill({
          shopId: shop.id,
          billId: editingBill.id,
          cart,
          paymentMode,
          gstEnabled: shop.gstEnabled,
          gstRate: shop.gstRate ?? 5,
          paidAmount: paymentMode === 'Partial Pay' ? partialPaidAmt : totalAmount,
          cashAmount: paymentMode === 'Cash + GPay' ? splitCashAmt : undefined,
          gpayAmount: paymentMode === 'Cash + GPay' ? splitGpayAmt : undefined,
          tableNumber: selectedTable,
          customerName: finalCustomerName || (cleanPhone.length === 10 ? 'Customer' : undefined),
          customerPhone: cleanPhone || undefined,
          customerId: finalCustomerId || undefined,
          editor: userMeta,
        });

        cancelEditingBill();
        refreshSubscription().catch(() => {});

        let uploadedPdfUrl: string | undefined;
        if (share) {
          try {
            flash('Preparing receipt...');
            const receiptRes = await exportService.generateAndUploadBillReceipt(updatedBill, shop);
            if (receiptRes?.pdfUrl) {
              uploadedPdfUrl = receiptRes.pdfUrl;
            }
          } catch (e) {
            console.warn('Background receipt PDF generation notice:', e);
          }
        } else {
          exportService.generateAndUploadBillReceipt(updatedBill, shop).catch(err => {
            console.warn('Background receipt PDF generation notice:', err);
          });
        }

        if (!share && !effectiveAutoPrint) {
          if (closeAfter) {
            flash('Bill Saved Successfully');
            onBackToMenu();
          } else {
            setSavedBillSuccess(updatedBill);
            flash('Bill Saved Successfully');
          }
        } else {
          onBillSaved(updatedBill, share, effectiveAutoPrint, paperSize, uploadedPdfUrl);
          flash(share ? `Bill #${updatedBill.billNumber} shared on WhatsApp` : `Printing bill #${updatedBill.billNumber}`);
          if (closeAfter) {
            onBackToMenu();
          }
        }
      } else {
        const res = await billingService.createBill({
          shopId: shop.id,
          cart,
          paymentMode,
          gstEnabled: shop.gstEnabled,
          gstRate: shop.gstRate ?? 5,
          paidAmount: paymentMode === 'Partial Pay' ? partialPaidAmt : totalAmount,
          cashAmount: paymentMode === 'Cash + GPay' ? splitCashAmt : undefined,
          gpayAmount: paymentMode === 'Cash + GPay' ? splitGpayAmt : undefined,
          tableNumber: selectedTable,
          customerName: finalCustomerName || (cleanPhone.length === 10 ? 'Customer' : undefined),
          customerPhone: cleanPhone || undefined,
          customerId: finalCustomerId || undefined,
          creator: userMeta,
          createdAt: effectiveBillDate.toISOString(),
        });

        clearCart();
        refreshSubscription().catch(() => {});

        let uploadedPdfUrl: string | undefined;
        if (share) {
          try {
            flash('Preparing receipt...');
            const receiptRes = await exportService.generateAndUploadBillReceipt(res.bill, shop);
            if (receiptRes?.pdfUrl) {
              uploadedPdfUrl = receiptRes.pdfUrl;
            }
          } catch (e) {
            console.warn('Background receipt PDF generation notice:', e);
          }
        } else {
          exportService.generateAndUploadBillReceipt(res.bill, shop).catch(err => {
            console.warn('Background receipt PDF generation notice:', err);
          });
        }

        if (!share && !effectiveAutoPrint) {
          if (closeAfter) {
            flash('Bill Saved Successfully');
            onBackToMenu();
          } else {
            setSavedBillSuccess(res.bill);
            flash('Bill Saved Successfully');
          }
        } else {
          onBillSaved(res.bill, share, effectiveAutoPrint, paperSize, uploadedPdfUrl);
          flash(share ? `Bill #${res.bill.billNumber} shared on WhatsApp` : `Printing bill #${res.bill.billNumber}`);
          if (closeAfter) {
            onBackToMenu();
          }
        }
      }
    } catch (err: any) {
      console.warn('BillCheckoutScreen save error:', err);
      flash(editingBill ? 'Failed to update bill' : 'Failed to save bill');
    } finally {
      setIsSaving(false);
    }
  };

  // Submits customer prompt modal:
  // shareOnWhatsApp=false for Save Only (records customer, updates due ledger, returns to menu without WhatsApp)
  // shareOnWhatsApp=true for Save & Send (records customer, updates due ledger, and launches WhatsApp share)
  const submitCustomerModal = async (shareOnWhatsApp: boolean) => {
    const clean = whatsAppPromptPhone.replace(/[^0-9]/g, '').slice(-10);
    const isPending = paymentMode === 'Pending' || paymentMode === 'Partial Pay';

    if (isPending && clean.length !== 10) {
      setWhatsAppModalError('Enter a valid 10-digit mobile number for pending dues');
      return;
    }
    if (!isPending && clean.length > 0 && clean.length !== 10) {
      setWhatsAppModalError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!isPending && shareOnWhatsApp && clean.length !== 10) {
      setWhatsAppModalError('Please enter customer 10-digit mobile number');
      return;
    }

    const trimmedName = whatsAppPromptName.trim() || 'Customer';
    let savedCustId: string | undefined = selectedCustomerId || undefined;

    if (clean.length === 10) {
      try {
        const custRecord = await contactService.addCustomer(
          shop.id,
          trimmedName,
          clean
        );
        if (custRecord) {
          savedCustId = custRecord.id;
          setSelectedCustomerId(custRecord.id);
          setSelectedWhatsAppContact(custRecord);
          setSavedCustomers(prev => [custRecord, ...prev.filter(c => c.id !== custRecord.id)]);
        }
      } catch (err) {
        console.warn('Auto-save customer in modal notice:', err);
      }
    }

    if (trimmedName && trimmedName !== 'Customer') {
      setCustomerName(trimmedName);
    }
    setCustomerPhone(clean);
    if (savedCustId) {
      setSelectedCustomerId(savedCustId);
    }

    setWhatsAppModalError(null);
    setIsWhatsAppPromptOpen(false);

    await handleSave(
      shareOnWhatsApp,
      false,
      '80mm',
      clean,
      true, // closeAfter: true
      trimmedName,
      savedCustId
    );
  };

  // Right action: Save & Close (Saves bill and shows share / print / new bill options)
  const handleSaveAndClose = async () => {
    if (!can('bill')) {
      flash('Billing access is disabled for your account. Please contact the owner.');
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '').slice(-10);
    const hasCustomer = cleanPhone.length === 10;
    if (isPendingOrPartial && !hasCustomer) {
      setWhatsAppModalError('Enter a valid 10-digit mobile number for pending dues');
      setWhatsAppPromptPhone(cleanPhone);
      setWhatsAppPromptName(customerName || '');
      setWhatsAppContactSearch('');
      setIsWhatsAppPromptOpen(true);
      return;
    }
    // closeAfter: false so savedBillSuccess dialog appears with options to share via WhatsApp, print receipt, or proceed to new bill
    await handleSave(false, false, '80mm', undefined, false);
  };

  // Left action: Save & Share (Saves bill and shares WhatsApp, then returns to menu)
  const handleSaveAndShare = async () => {
    if (!can('bill')) {
      flash('Billing access is disabled for your account. Please contact the owner.');
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '').slice(-10);
    const hasCustomer = cleanPhone.length === 10;

    if (isPendingOrPartial && !hasCustomer) {
      setWhatsAppModalError('Enter a valid 10-digit mobile number for pending dues');
      setWhatsAppPromptPhone(cleanPhone);
      setWhatsAppPromptName(customerName || '');
      setWhatsAppContactSearch('');
      setIsWhatsAppPromptOpen(true);
      return;
    }

    if (cleanPhone.length === 10) {
      await handleSave(true, false, '80mm', undefined, true);
    } else {
      setWhatsAppModalError(null);
      setWhatsAppPromptPhone(cleanPhone);
      setWhatsAppPromptName(customerName || '');
      setWhatsAppContactSearch('');
      setIsWhatsAppPromptOpen(true);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}
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
        {(selectedTable || shop.tableManagementEnabled) && (
          <View style={styles.tableBadgeRow}>
            <View style={styles.tableBadge}>
              <Ionicons
                name={selectedTable ? "restaurant-outline" : "storefront-outline"}
                size={15}
                color={selectedTable ? "#FF5F00" : theme.colors.textSecondary}
              />
              <Text style={styles.tableBadgeText}>
                {selectedTable ? (selectedTable.toLowerCase().includes('table') ? `Dining: ${selectedTable}` : `Dining: Table ${selectedTable}`) : 'Order Mode: Counter (Takeaway)'}
              </Text>
            </View>
            {selectedTable ? (
              <TouchableOpacity
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setSelectedTable(null);
                  flash('Switched to Counter (Takeaway) • Bill items preserved');
                }}
                style={styles.clearTableBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo-outline" size={13} color="#FF5F00" style={{ marginRight: 2 }} />
                <Text style={styles.clearTableText}>Clear Table / Switch to Counter</Text>
              </TouchableOpacity>
            ) : null}
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

          {/* Amount Row: Big ₹ amount with animated count-up and opposite calendar button */}
          <View style={styles.totalAmountRow}>
            <Text style={styles.totalAmountText}>
              ₹{displayTotal.toLocaleString('en-IN')}
            </Text>
            {!editingBill && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsCustomDatePickerOpen(true)}
                style={[
                  styles.calendarCornerBtn,
                  billDateOption !== 'today' && styles.calendarCornerBtnActive,
                ]}
                accessibilityLabel="Select Bill Date"
              >
                <Ionicons
                  name="calendar"
                  size={18}
                  color={billDateOption !== 'today' ? '#FF5F00' : '#E7E5E4'}
                />
                {billDateOption !== 'today' && (
                  <Text style={styles.calendarCornerDateText}>
                    {effectiveBillDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

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

        {/* 3. Payment Mode Section (Always visible, clean two-line alignment) */}
        <View style={styles.paymentModeSection}>
          <Text style={styles.sectionTitle}>{t('payment_method', 'Payment mode')}</Text>
          
          {/* Row 1: Cash, GPay / UPI, Cash + GPay */}
          <View style={styles.paymentModesGridRow}>
            {paymentModesList.slice(0, 3).map((item) => {
              const isSelected = item.mode === paymentMode;
              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.75}
                  onPress={() => handleSelectPaymentMode(item.mode)}
                  style={[
                    styles.paymentModeBtn,
                    isSelected && styles.paymentModeBtnSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={isSelected ? '#FF5F00' : isDark ? '#A8A29E' : '#57534E'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.paymentModeBtnText, isSelected && styles.paymentModeBtnTextSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Row 2: Full Pending, Partial Pay */}
          <View style={styles.paymentModesGridRow}>
            {paymentModesList.slice(3, 5).map((item) => {
              const isSelected = item.mode === paymentMode;
              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.75}
                  onPress={() => handleSelectPaymentMode(item.mode)}
                  style={[
                    styles.paymentModeBtn,
                    isSelected && styles.paymentModeBtnSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={isSelected ? '#FF5F00' : isDark ? '#A8A29E' : '#57534E'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.paymentModeBtnText, isSelected && styles.paymentModeBtnTextSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Contextual Payment Panel */}
        <Animated.View
          style={[
            styles.contextualPanel,
            {
              opacity: panelAnim,
              transform: [
                {
                  translateY: panelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 0],
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

          {/* Mode: Full Pending */}
          {paymentMode === 'Pending' && (
            <View style={[styles.noteCard, styles.pendingNoteCard]}>
              <Ionicons name="time" size={18} color="#DC2626" style={{ marginRight: 10 }} />
              <Text style={styles.noteText}>
                <Text style={[styles.boldText, { color: '#DC2626' }]}>{formatRupee(totalAmount)}</Text> will be added to udhar ledger · customer needed
              </Text>
            </View>
          )}

          {/* Mode: Cash + GPay (Compact 2 text fields, no extra spaces) */}
          {paymentMode === 'Cash + GPay' && (
            <View style={styles.splitBox}>
              <View style={styles.splitInputsRow}>
                <View style={styles.splitInputCol}>
                  <Text style={styles.splitInputLabel}>Cash (₹)</Text>
                  <View style={styles.splitInputWrapper}>
                    <Text style={styles.rupeeSymbol}>₹</Text>
                    <TextInput
                      style={styles.splitTextInput}
                      keyboardType="number-pad"
                      value={splitCashInput}
                      onChangeText={handleCashInputChange}
                      placeholder="0"
                      placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                      maxLength={7}
                    />
                  </View>
                </View>

                <View style={styles.splitInputCol}>
                  <Text style={[styles.splitInputLabel, { color: '#FF5F00' }]}>GPay (₹)</Text>
                  <View style={[styles.splitInputWrapper, { borderColor: '#FF5F00' }]}>
                    <Text style={[styles.rupeeSymbol, { color: '#FF5F00' }]}>₹</Text>
                    <TextInput
                      style={styles.splitTextInput}
                      keyboardType="number-pad"
                      value={splitGpayInput}
                      onChangeText={handleGpayInputChange}
                      placeholder="0"
                      placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                      maxLength={7}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.splitFooterRow}>
                <Text style={styles.splitHelperText}>
                  Total: {formatRupee(totalAmount)} · Auto-balanced
                </Text>
              </View>
            </View>
          )}

          {/* Mode: Partial Pay (Compact 1 text field, auto-calculate balance due) */}
          {paymentMode === 'Partial Pay' && (
            <View style={styles.splitBox}>
              <View style={styles.partialInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.splitInputLabel}>Paid Now (₹)</Text>
                  <View style={styles.splitInputWrapper}>
                    <Text style={styles.rupeeSymbol}>₹</Text>
                    <TextInput
                      style={styles.splitTextInput}
                      keyboardType="number-pad"
                      value={partialPaidInput}
                      onChangeText={handlePartialPaidChange}
                      placeholder="0"
                      placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                      maxLength={7}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.partialSummaryRow}>
                <View style={styles.partialDueBadge}>
                  <Text style={styles.partialDueLabel}>Balance Due on Ledger:</Text>
                  <Text style={styles.partialDueAmount}>{formatRupee(partialDueAmt)}</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

      </ScrollView>

      {/* 6. Sticky Bottom Action Bar with Save & Share (Left) and Save & Close (Right) */}
      <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 14) }]}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleSaveAndShare}
          disabled={cart.length === 0 || isSaving}
          style={[styles.saveShareActionBtn, (cart.length === 0 || isSaving) && styles.btnDisabled]}
          accessibilityLabel="Save and Share Bill on WhatsApp"
        >
          <Ionicons
            name="logo-whatsapp"
            size={18}
            color="#1FAD55"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.saveShareActionBtnText}>{t('save_and_share', 'Save & Share')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSaveAndClose}
          disabled={cart.length === 0 || isSaving}
          style={[styles.saveCloseActionBtn, (cart.length === 0 || isSaving) && styles.btnDisabled]}
          accessibilityLabel="Save and Close Bill"
        >
          <Ionicons
            name="checkmark-circle"
            size={19}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.saveCloseActionBtnText}>
            {isSaving ? t('loading', 'Saving...') : t('save_bill', 'Save & Close')}
          </Text>
        </TouchableOpacity>
      </View>



      {/* Bill Saved Success Dialog — Exactly matches reference design */}
      <Modal
        visible={savedBillSuccess !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSavedBillSuccess(null);
          onBackToMenu();
        }}
      >
        <View style={styles.upiModalBackdrop}>
          <View style={styles.savedSuccessCard}>
            {/* Top Corner Close Icon — Returns to menu to start fresh bill */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.savedSuccessCloseBtn}
              onPress={() => {
                setSavedBillSuccess(null);
                onBackToMenu();
              }}
              accessibilityLabel="Close and Start New Bill"
            >
              <Ionicons name="close" size={17} color={isDark ? '#9CA3AF' : '#475569'} />
            </TouchableOpacity>

            <View style={styles.savedSuccessCheckRing}>
              <Ionicons name="checkmark" size={30} color={isDark ? '#34D399' : '#16A34A'} />
            </View>

            <Text style={styles.savedSuccessTitle}>
              {t('bill_saved_success', 'Bill saved successfully!')}
            </Text>

            <Text style={styles.savedSuccessSubtitle}>
              Bill #{String(savedBillSuccess?.billNumber || '').replace(/^#/, '')}
            </Text>

            {/* Auto Close Indicator Badge */}
            <View style={styles.autoCloseIndicatorBadge}>
              <Ionicons name="time-outline" size={13} color="#FF5F00" />
              <Text style={styles.autoCloseIndicatorText}>
                Auto-closing in {autoCloseCountdown}s
              </Text>
            </View>

            {/* Exactly matching receipt ticket */}
            <SavedBillTicketCard
              billNumber={savedBillSuccess?.billNumber || 1}
              isDark={isDark}
            />

            {/* If thermal printer is enabled in account section, show 80mm print option like old */}
            {isPrinterConfigured && (
              <View style={{ width: '100%', marginTop: 12 }}>
                <View style={[styles.paperSizeRow, { alignSelf: 'center', marginBottom: 8 }]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.paperSizeChip,
                      thermalPaperSize === '80mm' && styles.paperSizeChipSelected,
                    ]}
                    onPress={() => setThermalPaperSize('80mm')}
                  >
                    <Text
                      style={[
                        styles.paperSizeChipText,
                        thermalPaperSize === '80mm' && styles.paperSizeChipTextSelected,
                      ]}
                    >
                      80mm
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.paperSizeChip,
                      thermalPaperSize === '58mm' && styles.paperSizeChipSelected,
                    ]}
                    onPress={() => setThermalPaperSize('58mm')}
                  >
                    <Text
                      style={[
                        styles.paperSizeChipText,
                        thermalPaperSize === '58mm' && styles.paperSizeChipTextSelected,
                      ]}
                    >
                      58mm / 53mm
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.savedSuccessPrintBtn}
                  disabled={isPrintingNow}
                  onPress={async () => {
                    const bill = savedBillSuccess;
                    if (!bill) return;
                    try {
                      setIsPrintingNow(true);
                      const ok = await printerService.printReceipt(bill, shop, thermalPaperSize);
                      if (ok) {
                        flash('Print sent');
                      } else {
                        flash('Could not connect to printer');
                      }
                    } catch (e) {
                      console.warn('Print receipt error:', e);
                      flash('Print failed');
                    } finally {
                      setIsPrintingNow(false);
                    }
                  }}
                >
                  <Ionicons name="print-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.savedSuccessBtnText}>
                    {isPrintingNow ? t('loading', 'Printing...') : `${t('print_receipt', 'Print Receipt')} (${thermalPaperSize})`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Past Date Selector Modal */}
      <Modal
        visible={isCustomDatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomDatePickerOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsCustomDatePickerOpen(false)}
          style={styles.dateModalBackdrop}
        >
          <TouchableWithoutFeedback>
            <View style={styles.dateModalCard}>
              <View style={styles.dateModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar" size={18} color="#FF5F00" />
                  <Text style={styles.dateModalTitle}>Select Bill Date</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsCustomDatePickerOpen(false)}
                  style={styles.dateModalCloseBtn}
                >
                  <Ionicons name="close" size={18} color={isDark ? '#9CA3AF' : '#475569'} />
                </TouchableOpacity>
              </View>

              <Text style={styles.dateModalSub}>
                Select date to record this bill (Today or Yesterday only):
              </Text>

              {/* Past days quick options: strictly Today and Yesterday */}
              <View style={[styles.pastDaysGrid, { marginTop: 12 }]}>
                {[0, 1].map(daysAgo => {
                  const d = new Date();
                  d.setDate(d.getDate() - daysAgo);
                  const isToday = daysAgo === 0;
                  const isSelected = isToday
                    ? billDateOption === 'today'
                    : billDateOption === 'yesterday';
                  const dayLabel = isToday ? 'Today' : 'Yesterday';
                  const dateLabel = d.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <TouchableOpacity
                      key={daysAgo}
                      activeOpacity={0.75}
                      onPress={() => {
                        if (isToday) {
                          setBillDateOption('today');
                          flash('Bill date set to Today');
                        } else {
                          setBillDateOption('yesterday');
                          flash('Bill date set to Yesterday');
                        }
                        setIsCustomDatePickerOpen(false);
                      }}
                      style={[
                        styles.pastDayBtn,
                        isSelected && styles.pastDayBtnSelected,
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={isSelected ? '#FF5F00' : (isDark ? '#6B7280' : '#9CA3AF')}
                        />
                        <Text style={[styles.pastDayLabel, isSelected && styles.pastDayLabelSelected]}>
                          {dayLabel}
                        </Text>
                      </View>
                      <Text style={[styles.pastDayDate, isSelected && styles.pastDayDateSelected]}>
                        {dateLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* WhatsApp Prompt Modal (When Save & Share clicked or customer details needed) */}
      <Modal
        visible={isWhatsAppPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setWhatsAppModalError(null);
          setIsWhatsAppPromptOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.whatsAppModalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.whatsAppModalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              {/* Compact Header */}
              <View style={styles.whatsAppModalHeaderRow}>
                <View style={[styles.whatsAppModalIconSmall, isPendingOrPartial && { backgroundColor: isDark ? '#451A03' : '#FEF3C7' }]}>
                  <Ionicons
                    name={isPendingOrPartial ? "person" : "logo-whatsapp"}
                    size={17}
                    color={isPendingOrPartial ? "#D97706" : "#1FAD55"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.whatsAppModalTitle}>
                    {isPendingOrPartial ? 'Customer Details & Due' : 'Customer & WhatsApp Share'}
                  </Text>
                  <Text style={styles.whatsAppModalSubtitle}>
                    {isPendingOrPartial
                      ? 'Mobile number required to record balance due'
                      : 'Send invoice receipt directly via WhatsApp'}
                  </Text>
                </View>
              </View>

              {/* In-Modal Alert Banner */}
              {whatsAppModalError && (
                <View style={styles.modalAlertBanner}>
                  <Ionicons name="alert-circle" size={15} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.modalAlertText}>
                    {whatsAppModalError}
                  </Text>
                </View>
              )}

              {/* Compact Search Bar for Existing Contact */}
              <View style={styles.compactSearchWrap}>
                <Ionicons
                  name="search-outline"
                  size={14}
                  color={isDark ? '#9A948D' : '#76716B'}
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.compactSearchInput}
                  placeholder="Search or select existing contact..."
                  placeholderTextColor={isDark ? '#6B6661' : '#A8A29E'}
                  value={whatsAppContactSearch}
                  onChangeText={text => {
                    setWhatsAppContactSearch(text);
                    if (whatsAppModalError) setWhatsAppModalError(null);
                  }}
                />
                {whatsAppContactSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setWhatsAppContactSearch('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={14} color={isDark ? '#9A948D' : '#76716B'} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Matching Contact Chips: only visible when user types a letter or number */}
              {whatsAppContactSearch.trim().length > 0 && (
                <View style={styles.matchingContactsSection}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.contactChipsScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredWhatsAppContacts.map(c => {
                      const isSelected = selectedCustomerId === c.id;
                      const cleanP = (c.phone || '').replace(/[^0-9]/g, '').slice(-10);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                            setSelectedCustomerId(c.id);
                            setSelectedWhatsAppContact(c);
                            setWhatsAppPromptName(c.name);
                            setWhatsAppPromptPhone(cleanP);
                            setCustomerName(c.name);
                            setCustomerPhone(cleanP);
                            setWhatsAppContactSearch('');
                            setWhatsAppModalError(null);
                          }}
                          style={[
                            styles.modalContactChip,
                            isSelected && styles.modalContactChipSelected,
                          ]}
                        >
                          <View style={[styles.modalContactAvatar, isSelected && styles.modalContactAvatarSelected]}>
                            <Text style={[styles.modalContactAvatarInitial, isSelected && styles.modalContactAvatarInitialSelected]}>
                              {c.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.modalContactName, isSelected && styles.modalContactNameSelected]} numberOfLines={1}>
                            {c.name.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {filteredWhatsAppContacts.length === 0 && (
                      <Text style={styles.modalNoContactText}>No matching contact</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Customer Name Input (compact) */}
              <View style={styles.whatsAppNameInputWrap}>
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={isDark ? '#9A948D' : '#76716B'}
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.whatsAppNameTextInput}
                  placeholder="Name"
                  placeholderTextColor={isDark ? '#6B6661' : '#A8A29E'}
                  value={whatsAppPromptName}
                  onChangeText={text => {
                    setWhatsAppPromptName(text);
                    if (whatsAppModalError) setWhatsAppModalError(null);
                    if (selectedWhatsAppContact && selectedWhatsAppContact.name !== text) {
                      setSelectedWhatsAppContact(null);
                      setSelectedCustomerId(null);
                    }
                  }}
                  autoCapitalize="words"
                />
              </View>

              {/* Customer Mobile Number */}
              <View style={styles.whatsAppInputWrap}>
                <Text style={styles.whatsAppPrefix}>+91</Text>
                <TextInput
                  style={styles.whatsAppTextInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={isDark ? '#6B6661' : '#A8A29E'}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={whatsAppPromptPhone}
                  onChangeText={t => {
                    const digits = t.replace(/[^0-9]/g, '');
                    setWhatsAppPromptPhone(digits);
                    if (whatsAppModalError) setWhatsAppModalError(null);
                    if (digits.length === 10 && !whatsAppPromptName.trim()) {
                      const matched = savedCustomers.find(
                        c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === digits
                      );
                      if (matched?.name) {
                        setWhatsAppPromptName(matched.name);
                        setSelectedCustomerId(matched.id);
                        setSelectedWhatsAppContact(matched);
                      }
                    }
                  }}
                />
              </View>

              <View style={styles.modalActionGroup}>
                <View style={styles.modalPrimaryActionsRow}>
                  {/* Left: Save & Send via WhatsApp */}
                  <TouchableOpacity
                    style={styles.whatsAppSendBtn}
                    onPress={() => submitCustomerModal(true)}
                    activeOpacity={0.82}
                    accessibilityLabel="Save bill and send on WhatsApp"
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.whatsAppSendText}>Save & Send</Text>
                  </TouchableOpacity>

                  {/* Right: Save (No WhatsApp share needed) */}
                  <TouchableOpacity
                    style={styles.saveOnlyBtn}
                    onPress={() => submitCustomerModal(false)}
                    activeOpacity={0.82}
                    accessibilityLabel="Save bill without sharing"
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveOnlyBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>

                {/* Option 3: Cancel */}
                <TouchableOpacity
                  style={styles.whatsAppCancelBtnRow}
                  onPress={() => {
                    setWhatsAppModalError(null);
                    setIsWhatsAppPromptOpen(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.whatsAppCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Shop UPI Prompt Modal */}
      <Modal
        visible={isUpiPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsUpiPromptOpen(false)}
      >
        <View style={styles.upiModalBackdrop}>
          <View style={styles.upiModalCard}>
            <View style={styles.upiModalIconWrap}>
              <Ionicons name="qr-code" size={26} color="#FF5F00" />
            </View>
            <Text style={styles.upiModalTitle}>Shop UPI ID</Text>
            <Text style={styles.upiModalDesc}>
              Add your UPI ID so customers can easily pay their balance due via WhatsApp receipts.
            </Text>
            <TextInput
              style={styles.upiTextInput}
              value={shopUpiInput}
              onChangeText={setShopUpiInput}
              placeholder="e.g. yourshop@okhdfcbank"
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.upiModalActions}>
              <TouchableOpacity
                onPress={() => setIsUpiPromptOpen(false)}
                style={styles.upiModalCancelBtn}
              >
                <Text style={styles.upiModalCancelText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveShopUpi}
                style={styles.upiModalSaveBtn}
              >
                <Text style={styles.upiModalSaveText}>Save UPI ID</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    totalAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    calendarCornerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    calendarCornerBtnActive: {
      backgroundColor: 'rgba(255, 95, 0, 0.2)',
      borderColor: 'rgba(255, 95, 0, 0.5)',
    },
    calendarCornerDateText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: '#FF8A3D',
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
    paymentModeSection: {
      marginBottom: 12,
      gap: 8,
    },
    paymentModesGridRow: {
      flexDirection: 'row',
      gap: 8,
    },
    paymentModeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: surface,
      borderWidth: 1.5,
      borderColor: line,
      ...shadows.sm,
    },
    paymentModeBtnSelected: {
      borderColor: orange,
      backgroundColor: orangeSoft,
    },
    paymentModeBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: ink,
    },
    paymentModeBtnTextSelected: {
      color: orangeText,
      fontWeight: '800',
    },
    // ─── Payment Chips Selection ───────────────────────────────────────────
    paymentChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    paymentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
      ...shadows.sm,
    },
    paymentChipSelected: {
      borderColor: orange,
      backgroundColor: orangeSoft,
    },
    paymentChipText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: ink,
    },
    paymentChipTextSelected: {
      color: orangeText,
      fontWeight: '800',
    },

    // ─── Contextual Payment Panel ───────────────────────────────────────────
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
    pendingNoteCard: {
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEE2E2',
      borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FCA5A5',
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
      padding: 14,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: line,
      ...shadows.sm,
    },
    splitInputsRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    splitInputCol: {
      flex: 1,
    },
    splitInputLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      fontWeight: '700',
      color: muted,
      marginBottom: 4,
    },
    splitInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: alt,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: line,
      paddingHorizontal: 10,
      height: 44,
    },
    rupeeSymbol: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '700',
      color: muted,
      marginRight: 4,
    },
    splitTextInput: {
      flex: 1,
      fontFamily: typography.fonts.numbers,
      fontSize: 16,
      fontWeight: '700',
      color: ink,
      padding: 0,
    },
    splitFooterRow: {
      marginTop: 8,
      alignItems: 'center',
    },
    splitHelperText: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: muted,
    },
    partialInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    partialSummaryRow: {
      marginTop: 10,
    },
    partialDueBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEE2E2',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(220, 38, 38, 0.25)' : '#FCA5A5',
    },
    partialDueLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#FCA5A5' : '#B91C1C',
    },
    partialDueAmount: {
      fontFamily: typography.fonts.numbers,
      fontSize: 15,
      fontWeight: '800',
      color: isDark ? '#EF4444' : '#DC2626',
    },

    // ─── WhatsApp & UPI Prompt Modals ───────────────────────────────────────
    whatsAppModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 70, // Elevates the popup higher above the keyboard
    },
    upiModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    upiModalCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: surface,
      borderRadius: 20,
      padding: 22,
      ...shadows.card,
      borderWidth: 1,
      borderColor: line,
    },
    upiModalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: orangeSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    upiModalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: ink,
      marginBottom: 6,
    },
    upiModalDesc: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: muted,
      marginBottom: 16,
      lineHeight: 18,
    },
    upiTextInput: {
      backgroundColor: alt,
      borderWidth: 1.5,
      borderColor: line,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 46,
      fontFamily: typography.fonts.body,
      fontSize: 14.5,
      color: ink,
      marginBottom: 18,
    },
    upiModalActions: {
      flexDirection: 'row',
      gap: 10,
    },
    upiModalCancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: alt,
    },
    upiModalCancelText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: muted,
    },
    upiModalSaveBtn: {
      flex: 1.5,
      height: 44,
      borderRadius: 12,
      backgroundColor: orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upiModalSaveText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
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
    paymentHeaderToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      marginBottom: 10,
    },
    paymentHeaderTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    paymentSelectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: orangeSoft,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.3)' : 'rgba(255, 95, 0, 0.25)',
    },
    paymentSelectedBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      fontWeight: '700',
      color: orangeText,
    },
    paymentDownArrowBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: alt,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveShareActionBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: '#1FAD55',
      backgroundColor: isDark ? '#1C1917' : '#FFFFFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      ...shadows.sm,
    },
    saveShareActionBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '800',
      color: '#1FAD55',
    },
    saveCloseActionBtn: {
      flex: 1.15,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: '#16A34A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      ...shadows.sm,
    },
    saveCloseActionBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    btnDisabled: {
      opacity: 0.5,
    },

    // ─── WhatsApp Prompt Modal (Compact) ────────────────────────────────────
    whatsAppModalCard: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '86%',
      backgroundColor: surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: line,
      ...shadows.card,
    },
    whatsAppModalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    whatsAppModalIconSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(31, 173, 85, 0.2)' : '#E8F5E9',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    whatsAppModalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: ink,
    },
    modalAlertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
      borderWidth: 1,
      borderColor: isDark ? '#DC2626' : '#FCA5A5',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 10,
    },
    modalAlertText: {
      flex: 1,
      fontFamily: typography.fonts.body,
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#FCA5A5' : '#B91C1C',
      lineHeight: 16,
    },
    compactSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: alt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 10,
      height: 36,
      marginBottom: 10,
    },
    compactSearchInput: {
      flex: 1,
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: ink,
      padding: 0,
    },
    matchingContactsSection: {
      marginBottom: 10,
      padding: 6,
      backgroundColor: alt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
    },
    contactChipsScroll: {
      paddingVertical: 2,
      gap: 6,
      alignItems: 'center',
    },
    modalContactChip: {
      alignItems: 'center',
      width: 48,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    modalContactChipSelected: {
      borderColor: '#1FAD55',
      backgroundColor: isDark ? 'rgba(31, 173, 85, 0.15)' : '#E8F5E9',
    },
    modalContactAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? '#3D3833' : '#EAE6E1',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    modalContactAvatarSelected: {
      backgroundColor: '#1FAD55',
    },
    modalContactAvatarInitial: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: ink,
    },
    modalContactAvatarInitialSelected: {
      color: '#FFFFFF',
    },
    modalContactName: {
      fontFamily: typography.fonts.body,
      fontSize: 9.5,
      fontWeight: '600',
      color: ink,
      textAlign: 'center',
      maxWidth: 44,
    },
    modalContactNameSelected: {
      color: '#1FAD55',
      fontWeight: '700',
    },
    modalNoContactText: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: muted,
      fontStyle: 'italic',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    whatsAppNameInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: alt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 10,
      height: 40,
      marginBottom: 8,
    },
    whatsAppNameTextInput: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '600',
      color: ink,
      padding: 0,
    },
    whatsAppInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: alt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 10,
      height: 40,
      marginBottom: 12,
    },
    whatsAppPrefix: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: muted,
      marginRight: 6,
    },
    whatsAppTextInput: {
      flex: 1,
      fontFamily: typography.fonts.numbers,
      fontSize: 14.5,
      fontWeight: '700',
      color: ink,
      letterSpacing: 0.5,
      padding: 0,
    },
    whatsAppModalSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: muted,
      marginTop: 2,
    },
    modalActionGroup: {
      gap: 6,
      marginTop: 6,
      marginBottom: 4,
    },
    modalPrimaryActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    saveOnlyBtn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: isDark ? '#334155' : '#1E293B',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveOnlyBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    whatsAppModalActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    whatsAppCancelBtn: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      backgroundColor: alt,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsAppCancelBtnRow: {
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsAppCancelText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: muted,
    },
    whatsAppSendBtn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#1FAD55',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsAppSendText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    whatsAppOtherAppsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    whatsAppOtherAppsText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      fontWeight: '700',
      color: orangeText,
    },

    // ─── Share & Print Modals ────────────────────────────────────────────────
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    actionModalSheet: {
      backgroundColor: surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 28,
      borderWidth: 1,
      borderColor: line,
    },
    modalHandleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: muted,
      alignSelf: 'center',
      marginBottom: 12,
      opacity: 0.4,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modalSheetTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 17,
      fontWeight: '800',
      color: ink,
    },
    modalSheetSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
      marginTop: 2,
    },
    modalCloseCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: alt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      backgroundColor: alt,
      borderWidth: 1,
      borderColor: line,
      marginBottom: 12,
    },
    actionOptionCardCol: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: alt,
      borderWidth: 1,
      borderColor: line,
      marginBottom: 12,
      gap: 10,
    },
    actionOptionCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionOptionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    actionOptionTextWrap: {
      flex: 1,
    },
    actionOptionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '800',
      color: ink,
    },
    actionOptionDesc: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
      marginTop: 2,
    },
    paperSizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    paperSizeLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: muted,
    },
    paperSizeChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: surface,
    },
    paperSizeChipSelected: {
      backgroundColor: orangeSoft,
      borderColor: orange,
    },
    paperSizeChipText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      fontWeight: '700',
      color: muted,
    },
    paperSizeChipTextSelected: {
      color: orangeText,
      fontWeight: '800',
    },
    actionPrintBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: 10,
      backgroundColor: orange,
      marginTop: 4,
    },
    actionPrintBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    savedSuccessCard: {
      width: '88%',
      maxWidth: 320,
      backgroundColor: isDark ? '#121E16' : '#FFFFFF',
      borderRadius: 26,
      padding: 20,
      paddingTop: 24,
      paddingBottom: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#1C3123' : '#E2E8F0',
      marginBottom: Platform.OS === 'android' ? 24 : 0,
      position: 'relative',
      ...shadows.card,
    },
    savedSuccessCloseBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#1A2920' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    savedSuccessCheckRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 3.5,
      borderColor: isDark ? '#34D399' : '#16A34A',
      backgroundColor: isDark ? '#0F2318' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    savedSuccessIconWrap: {
      marginBottom: 10,
    },
    savedSuccessTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#0F172A',
      textAlign: 'center',
    },
    savedSuccessSubtitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#64748B',
      marginTop: 3,
      marginBottom: 2,
      textAlign: 'center',
    },
    savedSuccessBtnGroup: {
      width: '100%',
      gap: 10,
      marginTop: 10,
    },
    savedSuccessShareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      borderRadius: 12,
      backgroundColor: whatsappGreen,
    },
    savedSuccessPrintBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 12,
      backgroundColor: '#16A34A',
    },
    savedSuccessBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    savedSuccessDoneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: alt,
    },
    savedSuccessDoneBtnPrimary: {
      backgroundColor: orange,
      borderColor: orange,
    },
    savedSuccessDoneBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: ink,
    },
    savedSuccessDoneBtnTextPrimary: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    autoCloseIndicatorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.15)' : '#FFF3EB',
      marginTop: 6,
      marginBottom: 4,
    },
    autoCloseIndicatorText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: orangeText,
    },
    billDateCard: {
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: line,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
      gap: 8,
    },
    billDateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    billDateTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '800',
      color: ink,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    backdatedActivePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
    },
    backdatedActivePillText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#FBBF24' : '#D97706',
    },
    billDatePillsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    billDatePill: {
      flex: 1,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: alt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    billDatePillActive: {
      backgroundColor: orange,
      borderColor: orange,
    },
    billDatePillText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: muted,
    },
    billDatePillTextActive: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    dateModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dateModalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: line,
      gap: 12,
    },
    dateModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateModalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '800',
      color: ink,
    },
    dateModalCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: alt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateModalSub: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
    },
    pastDaysGrid: {
      gap: 6,
    },
    pastDayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: alt,
      borderWidth: 1,
      borderColor: line,
    },
    pastDayBtnSelected: {
      borderColor: orange,
      backgroundColor: orangeSoft,
    },
    pastDayLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: ink,
    },
    pastDayLabelSelected: {
      color: orangeText,
      fontWeight: '800',
    },
    pastDayDate: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: muted,
    },
    pastDayDateSelected: {
      color: orangeText,
      fontWeight: '700',
    },
  });
};
