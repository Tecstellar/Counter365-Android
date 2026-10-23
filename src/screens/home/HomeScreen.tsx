import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  Image,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { PaymentModeIcon } from '../../components/common/PaymentModeIcon';
import { DayClosingModal } from './DayClosingModal';
import { DateRangeCalendar } from './DateRangeCalendar';
import { CollectDueModal } from '../../components/modals/CollectDueModal';
import { EditExpenseModal } from '../../components/modals/EditExpenseModal';
import { ExpenseActionMenuModal } from '../../components/modals/ExpenseActionMenuModal';
import { ExpenseCategoryPickerModal } from '../../components/modals/ExpenseCategoryPickerModal';
import { BillActionMenuModal } from '../../components/modals/BillActionMenuModal';
import { getExpensePresetsForShopType, ExpensePreset } from '../../constants/expensePresets';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { expenseService } from '../../services/expenseService';
import { billingService } from '../../services/billingService';
import { reportService } from '../../services/reportService';
import { exportService } from '../../services/exportService';
import { whatsappService } from '../../services/whatsappService';
import { printerService } from '../../services/printerService';
import { Bill, ExpenseRecord, PendingPaymentRecord, PaymentMethod } from '../../types/models';
import { formatRupee, calculateProfit } from '../../lib/money';
import { AppRoute } from '../../types/navigation';

interface HomeScreenProps {
  onNavigate: (route: AppRoute) => void;
  onOpenReminder: (pending: PendingPaymentRecord) => void;
  onEditBill?: (bill: Bill) => void;
}

interface TodaySummaryReportCardProps {
  theme: Theme;
  onPress: () => void;
  todaySales?: number;
  todayBillsCount?: number;
}

const TodaySummaryReportCard: React.FC<TodaySummaryReportCardProps> = ({
  theme,
  onPress,
  todaySales = 0,
  todayBillsCount = 0,
}) => {
  const { language, t } = useLanguage();
  const panY = React.useRef(new Animated.Value(0)).current;
  const arrowBounce = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, {
          toValue: 6,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(arrowBounce, {
          toValue: 0,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoop.start();
    return () => bounceLoop.stop();
  }, [arrowBounce]);

  React.useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
        },
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            panY.setValue(Math.min(gesture.dy * 0.65, 55));
          }
        },
        onPanResponderRelease: (_, gesture) => {
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
          if (gesture.dy > 30 || gesture.vy > 0.3) {
            Animated.timing(panY, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              onPress();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              friction: 5,
              tension: 40,
              useNativeDriver: true,
            }).start();
            if (Math.abs(gesture.dy) < 6 && Math.abs(gesture.dx) < 6) {
              onPress();
            }
          }
        },
      }),
    [onPress]
  );

  return (
    <Animated.View
      style={[
        stylesTodayReport.cardWrap,
        {
          transform: [{ scale: scaleAnim }, { translateY: panY }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          stylesTodayReport.card,
          {
            backgroundColor: theme.isDark ? '#18181B' : '#FFFFFF',
            borderColor: theme.isDark ? 'rgba(255, 95, 0, 0.45)' : 'rgba(255, 95, 0, 0.35)',
          },
        ]}
      >
        {/* Top Image & Badge Header */}
        <View style={stylesTodayReport.imageBannerContainer}>
          <Image
            source={require('../../../assets/images/business_insights.jpg')}
            style={stylesTodayReport.bannerImage}
            resizeMode="cover"
          />
          <View style={stylesTodayReport.imageOverlay} />

          <View style={stylesTodayReport.topBadgesRow}>
            <View style={stylesTodayReport.reportBadge}>
              <Animated.View
                style={[
                  stylesTodayReport.pulseDot,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={stylesTodayReport.reportBadgeText}>AUDIT READY</Text>
            </View>
            <View style={stylesTodayReport.todayTag}>
              <Ionicons name="bar-chart" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={stylesTodayReport.todayTagText}>{t('today', 'Today')}</Text>
            </View>
          </View>

          <View style={stylesTodayReport.bannerTextContainer}>
            <Text style={stylesTodayReport.bannerTitle}>{t('todays_summary', "Today's Summary Report")}</Text>
            <Text style={stylesTodayReport.bannerSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t('sales_minus_expenses', 'Sales − Expenses')}
            </Text>
          </View>
        </View>

        {/* Swipe Down Interactive Handle & Quick Cue */}
        <View style={stylesTodayReport.swipeBar}>
          <View style={stylesTodayReport.swipeInner}>
            <Animated.View style={{ transform: [{ translateY: arrowBounce }] }}>
              <Ionicons name="chevron-down" size={16} color="#FF5F00" />
            </Animated.View>
            <Text style={[stylesTodayReport.swipeText, { color: theme.colors.textSecondary }]}>
              {t('tap_to_view', 'Tap to open')}
            </Text>
            <Animated.View style={{ transform: [{ translateY: arrowBounce }] }}>
              <Ionicons name="chevron-down" size={16} color="#FF5F00" />
            </Animated.View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const stylesTodayReport = StyleSheet.create({
  cardWrap: {
    width: '100%',
    maxWidth: 390,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageBannerContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 14,
  },
  bannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 12, 10, 0.68)',
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 95, 0, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 0, 0.5)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5F00',
  },
  reportBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    fontWeight: '800',
    color: '#FF8833',
    letterSpacing: 0.6,
  },
  todayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayTagText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  bannerTextContainer: {
    zIndex: 2,
    marginTop: 'auto',
  },
  bannerTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
  },
  swipeBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 95, 0, 0.12)',
  },
  swipeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

const StraddlingNewBillButton: React.FC<{
  onPress: () => void;
}> = ({ onPress }) => {
  const { language, t } = useLanguage();
  const pulseAnim = React.useRef(new Animated.Value(0)).current;
  const sweepAnim = React.useRef(new Animated.Value(-120)).current;
  const touchScaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // 1. Gentle glow pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 2. Light sweep animation on mount, then recurring every 6.5 seconds
    const runSweep = () => {
      sweepAnim.setValue(-120);
      Animated.timing(sweepAnim, {
        toValue: 420,
        duration: 1100,
        useNativeDriver: true,
      }).start();
    };

    const initialTimer = setTimeout(runSweep, 450);
    const recurringInterval = setInterval(runSweep, 6500);

    return () => {
      pulseLoop.stop();
      clearTimeout(initialTimer);
      clearInterval(recurringInterval);
    };
  }, [pulseAnim, sweepAnim]);

  const scalePulse = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.75],
  });

  const handlePressIn = () => {
    Animated.spring(touchScaleAnim, {
      toValue: 0.965,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(touchScaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        stylesNewBill.wrapper,
        {
          transform: [
            { scale: Animated.multiply(scalePulse, touchScaleAnim) },
          ],
        },
      ]}
    >
      {/* Outer Glow Halo */}
      <Animated.View
        style={[
          stylesNewBill.glowHalo,
          {
            opacity: glowOpacity,
          },
        ]}
      />

      <TouchableOpacity
        activeOpacity={0.92}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
          onPress();
        }}
        style={stylesNewBill.button}
        accessibilityLabel="New Bill, Start a new sale"
      >
        {/* Animated Light Sweep Beam */}
        <Animated.View
          pointerEvents="none"
          style={[
            stylesNewBill.sweepBeam,
            {
              transform: [{ translateX: sweepAnim }, { rotate: '20deg' }],
            },
          ]}
        >
          <View style={stylesNewBill.sweepBeamInner} />
        </Animated.View>

        {/* Left White Plus Tile */}
        <View style={stylesNewBill.leftTile}>
          <Ionicons name="add" size={26} color="#FF5F00" />
        </View>

        {/* Center Labels */}
        <View style={stylesNewBill.textWrap}>
          <Text style={stylesNewBill.title}>{t('new_bill', 'New Bill')}</Text>
          <Text style={stylesNewBill.subtitle}>Start a new sale</Text>
        </View>

        {/* Right White Arrow Circle */}
        <View style={stylesNewBill.arrowCircle}>
          <Ionicons name="arrow-forward" size={19} color="#FF5F00" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const stylesNewBill = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
    marginTop: -26,
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 8,
  },
  glowHalo: {
    position: 'absolute',
    top: -3,
    left: 5,
    right: 5,
    bottom: -3,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 95, 0, 0.45)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5F00',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  sweepBeam: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 60,
    left: 0,
  },
  sweepBeamInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  leftTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  textWrap: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 1,
  },
  arrowCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
});

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenReminder,
  onEditBill,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { currentRole, can, profile, currentMember } = useAuth();
  const { shop, refreshSubscription } = useShop();
  const { flash } = useCart();
  const { language, t } = useLanguage();

  const [period, setPeriod] = useState<'Today' | 'Week' | 'Month' | 'Year' | 'Custom'>('Today');
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [pendingList, setPendingList] = useState<PendingPaymentRecord[]>([]);
  const [expenseNameInput, setExpenseNameInput] = useState('');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [isAddExpenseFormOpen, setIsAddExpenseFormOpen] = useState(false);
  const [isExpenseListExpanded, setIsExpenseListExpanded] = useState(false);
  const [isDayClosingModalVisible, setIsDayClosingModalVisible] = useState(false);

  // Bill Deletion & Action Menu Modal State
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [isDeletingBill, setIsDeletingBill] = useState(false);
  const [selectedBillForMenu, setSelectedBillForMenu] = useState<Bill | null>(null);
  const [isBillMenuVisible, setIsBillMenuVisible] = useState(false);

  // Due Collection Modal State
  const [selectedPendingRecord, setSelectedPendingRecord] = useState<PendingPaymentRecord | null>(null);
  const [isCollectDueModalVisible, setIsCollectDueModalVisible] = useState(false);

  // Expense Action & Edit Modal State
  const [selectedExpenseForMenu, setSelectedExpenseForMenu] = useState<ExpenseRecord | null>(null);
  const [isExpenseMenuVisible, setIsExpenseMenuVisible] = useState(false);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<ExpenseRecord | null>(null);
  const [isEditExpenseModalVisible, setIsEditExpenseModalVisible] = useState(false);
  const [isExpensePickerVisible, setIsExpensePickerVisible] = useState(false);

  // Custom Calendar Range States
  const initialSevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  initialSevenDaysAgo.setHours(0, 0, 0, 0);
  const initialTodayEnd = new Date();
  initialTodayEnd.setHours(23, 59, 59, 999);

  const [customStartDate, setCustomStartDate] = useState<Date>(initialSevenDaysAgo);
  const [customEndDate, setCustomEndDate] = useState<Date>(initialTodayEnd);
  const [isCustomCalendarVisible, setIsCustomCalendarVisible] = useState(false);
  const [calendarPickerMode, setCalendarPickerMode] = useState<'range' | 'single'>('range');
  const [selectedPeakHour, setSelectedPeakHour] = useState<number | null>(null);
  const [selectedDowIndex, setSelectedDowIndex] = useState<number | null>(null);

  // Dropdown expansion states to view complete lists
  const [isProductGrowthExpanded, setIsProductGrowthExpanded] = useState(false);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);

  useEffect(() => {
    loadData();
    // Keep data fresh when returning from billing or edits
    const timer = setInterval(() => {
      loadData();
    }, 4000);
    return () => clearInterval(timer);
  }, [shop.id]);

  const loadData = async () => {
    if (!shop.id) return;
    const loadedBills = await billingService.getBills(shop.id);
    const exps = await expenseService.getExpenses(shop.id);
    const pends = await billingService.getPendingPayments(shop.id);
    setBills(loadedBills);
    setExpenses(exps);
    setPendingList(pends);
  };

  // Filter bills and expenses by selected period
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

  const isDateInPeriod = (dateIsoStr?: string | null): boolean => {
    if (!dateIsoStr) return false;
    const d = new Date(dateIsoStr);
    if (isNaN(d.getTime())) return false;
    if (period === 'Today' || (period as string) === 'Day') {
      return (
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      );
    }
    if (period === 'Week') {
      const oneWeekAgo = new Date(todayYear, todayMonth, todayDate - 7, 0, 0, 0);
      return d >= oneWeekAgo;
    }
    if (period === 'Month') {
      return d.getFullYear() === todayYear && d.getMonth() === todayMonth;
    }
    if (period === 'Year') {
      return d.getFullYear() === todayYear;
    }
    if (period === 'Custom') {
      const start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate(), 0, 0, 0).getTime();
      const end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59).getTime();
      const t = d.getTime();
      return t >= start && t <= end;
    }
    return true;
  };

  const getBillPeriodRevenue = (b: Bill): number => {
    // For edited bills, always authoritatively reflect the updated paid amount
    if (b.isEdited || b.status === 'edited') {
      if (b.collections && b.collections.length > 0) {
        return b.collections.reduce((sum, c) => {
          return sum + (isDateInPeriod(c.paidAt) ? c.amount : 0);
        }, 0);
      }
      return isDateInPeriod(b.createdAt) ? (b.paidAmount || 0) : 0;
    }

    if (b.collections && b.collections.length > 0) {
      return b.collections.reduce((sum, c) => {
        return sum + (isDateInPeriod(c.paidAt) ? c.amount : 0);
      }, 0);
    }

    const createdInPeriod = isDateInPeriod(b.createdAt);
    const settledInPeriod = isDateInPeriod(b.settledAt);

    // Initial amount paid at creation time
    const initialPaid = b.initialPaidAmount !== undefined
      ? b.initialPaidAmount
      : (b.paymentMode === 'Pending' && !b.settledAt ? 0 : (b.settledAt && b.paymentMode === 'Cash' && b.cashAmount === undefined ? 0 : (b.paidAmount || 0)));

    // Settlement amount collected when cleared
    const settledPaid = b.settledAt ? Math.max(0, b.totalAmount - initialPaid) : 0;

    let collected = 0;
    if (createdInPeriod) {
      collected += initialPaid;
    }
    if (settledInPeriod) {
      collected += settledPaid;
    }
    return collected;
  };

  const filteredBills = bills.filter(b => {
    if (b.isDeleted || b.status === 'deleted') return false;
    if (b.collections && b.collections.some(c => isDateInPeriod(c.paidAt))) {
      return true;
    }
    return isDateInPeriod(b.createdAt) || isDateInPeriod(b.settledAt);
  });

  const recentBills = React.useMemo(() => {
    return bills
      .filter(b => !b.isDeleted && b.status !== 'deleted' && b.status !== 'cancelled')
      .slice(0, 5);
  }, [bills]);

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month}, ${hours}:${minutes} ${ampm}`;
  };

  const handleConfirmDeleteBill = async () => {
    if (!billToDelete || !shop.id) return;
    if (currentRole === 'Biller') {
      flash('Only Owner or Supervisor can delete bills');
      setBillToDelete(null);
      return;
    }
    setIsDeletingBill(true);
    try {
      const deleterName = currentRole === 'Owner'
        ? (profile?.fullName || 'Owner')
        : (currentMember?.fullName || profile?.fullName || 'Supervisor');

      await billingService.deleteBill(
        shop.id,
        billToDelete.id,
        {
          name: deleterName,
          role: currentRole,
          id: (currentRole === 'Owner' ? profile?.id : currentMember?.id) || profile?.id,
        },
        'Cancelled from Home screen'
      );
      setBillToDelete(null);
      await loadData();
      try { await refreshSubscription(); } catch {}
      flash(`Bill ${billToDelete.billNumber} deleted`);
    } catch (err: any) {
      console.warn('handleConfirmDeleteBill error:', err);
      flash(err?.message || 'Failed to delete bill');
    } finally {
      setIsDeletingBill(false);
    }
  };

  const handleOpenBillMenu = (bill: Bill) => {
    setSelectedBillForMenu(bill);
    setIsBillMenuVisible(true);
  };

  const handleEditBillFromMenu = (bill: Bill) => {
    setIsBillMenuVisible(false);
    if (onEditBill) {
      onEditBill(bill);
    } else {
      onNavigate('sales');
    }
  };

  const handleDeleteBillFromMenu = (bill: Bill) => {
    setIsBillMenuVisible(false);
    setBillToDelete(bill);
  };

  const isExpenseToday = (e: ExpenseRecord): boolean => {
    if (e.expenseDate === todayStr) return true;
    if (e.createdAt) {
      const d = new Date(e.createdAt);
      if (!isNaN(d.getTime())) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dStr === todayStr) return true;
      }
    }
    const ed = new Date(e.expenseDate);
    if (!isNaN(ed.getTime())) {
      const edStr = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
      if (edStr === todayStr) return true;
    }
    return false;
  };

  const filteredExpenses = expenses.filter(e => {
    if (period === 'Today' || (period as string) === 'Day') {
      return isExpenseToday(e);
    }
    const eDate = new Date(e.createdAt || e.expenseDate);
    if (period === 'Week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return eDate >= oneWeekAgo;
    }
    if (period === 'Month') {
      return eDate.getFullYear() === now.getFullYear() && eDate.getMonth() === now.getMonth();
    }
    if (period === 'Year') {
      return eDate.getFullYear() === now.getFullYear();
    }
    if (period === 'Custom') {
      const start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate(), 0, 0, 0).getTime();
      const end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59).getTime();
      const t = eDate.getTime();
      return t >= start && t <= end;
    }
    return true;
  });

  const salesTotal = filteredBills.reduce((sum, b) => sum + getBillPeriodRevenue(b), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPending = pendingList.reduce((sum, p) => sum + p.amountDue, 0);
  const netProfit = calculateProfit(salesTotal, totalExpenses);

  // Peak Hours calculation from real bills (matches design reference: 6a, 8a, 10a, 12p, 2p, 4p, 6p, 8p, 10p)
  const hourSlots = [
    { hour: 6, label: '6a' },
    { hour: 8, label: '8a' },
    { hour: 10, label: '10a' },
    { hour: 12, label: '12p' },
    { hour: 14, label: '2p' },
    { hour: 16, label: '4p' },
    { hour: 18, label: '6p' },
    { hour: 20, label: '8p' },
    { hour: 22, label: '10p' },
  ];

  const hourCounts = hourSlots.map(slot => {
    const end = slot.hour + 2;
    const count = filteredBills.filter(b => {
      if (!b.createdAt || !isDateInPeriod(b.createdAt)) return false;
      const d = new Date(b.createdAt);
      if (isNaN(d.getTime())) return false;
      const h = d.getHours();
      return h >= slot.hour && h < end;
    }).length;
    return { ...slot, count };
  });

  const maxHourCount = Math.max(1, ...hourCounts.map(h => h.count));
  const peakHoursData = hourCounts.map(h => ({
    label: h.label,
    count: h.count,
    val: Math.round((h.count / maxHourCount) * 100),
    pct: `${h.count > 0 ? Math.max(12, Math.round((h.count / maxHourCount) * 78)) : 6}%`,
    heightPx: h.count > 0 ? Math.max(16, Math.round((h.count / maxHourCount) * 58)) : 6,
    isPeak: h.count === maxHourCount && h.count > 0,
  }));

  // Day of Week calculation from real bills
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0 = Sun
  const dowCounts = [1, 2, 3, 4, 5, 6, 0].map(dowIdx => {
    const count = filteredBills.filter(b => new Date(b.createdAt).getDay() === dowIdx).length;
    return {
      label: dayNames[dowIdx],
      count,
    };
  });

  const maxDowCount = Math.max(1, ...dowCounts.map(d => d.count));
  const weekDaysData = dowCounts.map(d => ({
    label: d.label,
    count: d.count,
    val: Math.round((d.count / maxDowCount) * 100),
    pct: `${d.count > 0 ? Math.max(12, Math.round((d.count / maxDowCount) * 100)) : 6}%`,
    heightPx: d.count > 0 ? Math.max(16, Math.round((d.count / maxDowCount) * 64)) : 0,
    isPeak: d.count === maxDowCount && d.count > 0,
  }));

  // Real Product Growth from actual bill items
  const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
  filteredBills.forEach(b => {
    (b.items || []).forEach(it => {
      const existing = productMap.get(it.itemName) || { name: it.itemName, quantity: 0, amount: 0 };
      existing.quantity += it.quantity;
      existing.amount += it.lineTotal;
      productMap.set(it.itemName, existing);
    });
  });

  const allProductList = Array.from(productMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map(p => ({
      name: p.name,
      qty: `${p.quantity} sold`,
      amt: formatRupee(p.amount),
      delta: 'Active',
      isPositive: true,
    }));

  const visibleProductList = isProductGrowthExpanded
    ? allProductList
    : allProductList.slice(0, 5);

  // Payment Modes breakdown from real bills
  let cashSales = 0;
  let upiSales = 0;
  let pendingSales = 0;

  filteredBills.forEach(b => {
    if (b.collections && b.collections.length > 0) {
      b.collections.forEach(c => {
        if (isDateInPeriod(c.paidAt)) {
          if (c.paymentMode === 'GPay') {
            upiSales += c.amount;
          } else {
            cashSales += c.amount;
          }
        }
      });
      if (isDateInPeriod(b.createdAt) && Number(b.pendingAmount || 0) > 0) {
        pendingSales += b.pendingAmount;
      }
    } else {
      const rev = getBillPeriodRevenue(b);
      if (b.paymentMode === 'GPay') {
        upiSales += rev;
      } else if (b.paymentMode === 'Cash + GPay') {
        if (isDateInPeriod(b.createdAt)) {
          cashSales += (b.cashAmount || 0);
          upiSales += (b.gpayAmount || 0);
        }
        if (isDateInPeriod(b.settledAt)) {
          cashSales += Math.max(0, rev - ((b.cashAmount || 0) + (b.gpayAmount || 0)));
        }
      } else {
        // Cash, Partial Pay, Pending settled to Cash
        cashSales += rev;
      }

      if (isDateInPeriod(b.createdAt) && Number(b.pendingAmount || 0) > 0) {
        pendingSales += b.pendingAmount;
      }
    }
  });

  const cashPct = salesTotal > 0 ? `${Math.round((cashSales / salesTotal) * 100)}%` : '0%';
  const upiPct = salesTotal > 0 ? `${Math.round((upiSales / salesTotal) * 100)}%` : '0%';
  const pendingPct = salesTotal > 0 ? `${Math.round((pendingSales / salesTotal) * 100)}%` : '0%';

  const handleAddExpense = async () => {
    if (!can('exp')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    const name = expenseNameInput.trim();
    const amt = Number(expenseAmountInput.replace(/[^0-9]/g, ''));
    if (!name || !amt) {
      flash('Name and amount needed');
      return;
    }

    const userMeta = {
      name: profile?.fullName || currentMember?.fullName || currentRole,
      role: currentRole,
      id: profile?.id || currentMember?.id,
    };

    const newExp = await expenseService.addExpense(shop.id, name, amt, { creator: userMeta });
    setExpenses(prev => [newExp, ...prev]);
    setExpenseNameInput('');
    setExpenseAmountInput('');
    flash('Expense added');
  };

  const handleOpenExpenseMenu = (exp: ExpenseRecord) => {
    if (!can('exp')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    setSelectedExpenseForMenu(exp);
    setIsExpenseMenuVisible(true);
  };

  const handleStartEditExpense = (exp: ExpenseRecord) => {
    setSelectedExpenseForEdit(exp);
    setIsEditExpenseModalVisible(true);
  };

  const handleSaveEditExpense = async (expenseId: string, description: string, amount: number) => {
    const userMeta = {
      name: profile?.fullName || currentMember?.fullName || currentRole,
      role: currentRole,
      id: profile?.id || currentMember?.id,
    };
    const updated = await expenseService.updateExpense(shop.id, expenseId, description, amount, userMeta);
    setExpenses(updated);
    flash('Expense updated');
  };

  const handleDeleteExpense = (exp: ExpenseRecord) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${exp.description}" (${formatRupee(exp.amount)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const userMeta = {
              name: profile?.fullName || currentMember?.fullName || currentRole,
              role: currentRole,
              id: profile?.id || currentMember?.id,
            };
            const updated = await expenseService.deleteExpense(shop.id, exp.id, userMeta);
            setExpenses(updated);
            flash('Expense deleted');
          },
        },
      ]
    );
  };

  const handleOpenCollectDue = (item: PendingPaymentRecord) => {
    if (!can('pend')) {
      flash(t('no_access', "You don't have access for that"));
      return;
    }
    setSelectedPendingRecord(item);
    setIsCollectDueModalVisible(true);
  };

  const handleConfirmCollectDue = async (
    record: PendingPaymentRecord,
    amountToCollect: number,
    paymentMode: PaymentMethod
  ) => {
    const userMeta = {
      name: profile?.fullName || currentMember?.fullName || currentRole,
      role: currentRole,
      id: profile?.id || currentMember?.id,
    };
    const updated = await billingService.clearPendingPayment(
      shop.id,
      record.billId || record.id,
      amountToCollect,
      paymentMode,
      userMeta
    );
    setPendingList(updated);
    const refreshedBills = await billingService.getBills(shop.id);
    setBills(refreshedBills);

    const remaining = Math.max(0, (record.amountDue || 0) - amountToCollect);
    if (remaining === 0) {
      flash(`${record.customerName} fully settled (${formatRupee(amountToCollect)})`);
    } else {
      flash(`Collected ${formatRupee(amountToCollect)} from ${record.customerName} (${formatRupee(remaining)} due)`);
    }
  };

  const todayBills = bills.filter(b => {
    if (b.isDeleted || b.status === 'deleted') return false;
    return isDateInPeriod(b.createdAt) || (b.settledAt && isDateInPeriod(b.settledAt));
  });
  const todayExpensesList = expenses.filter(e => isExpenseToday(e));
  const todayTotalExpenses = todayExpensesList.reduce((sum, e) => sum + e.amount, 0);

  const dayClosingReport = reportService.getDayClosingReport(
    shop.name,
    shop.address,
    shop.phone,
    shop.shopType,
    todayTotalExpenses,
    todayBills
  );

  const handleShareClosingWhatsApp = async () => {
    await exportService.saveDayClosingToSupabase(dayClosingReport, shop.id);
    const msg = whatsappService.formatDayReport(dayClosingReport);
    const targetPhone = profile?.phone || shop.phone;
    const ok = await whatsappService.shareViaWhatsApp(msg, targetPhone);
    if (ok) {
      flash('Day report sent to owner WhatsApp');
    } else {
      flash('Could not open WhatsApp');
    }
  };

  const handlePrintClosing = async () => {
    await exportService.saveDayClosingToSupabase(dayClosingReport, shop.id);
    const ok = await exportService.printDayClosingReceipt(dayClosingReport);
    if (ok) {
      flash('Day closing receipt sent to printer');
    } else {
      flash('Could not print receipt');
    }
  };

  const handlePrintBillFromMenu = async (bill: Bill) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (!shop.printerEnabled || (!shop.printerName && !shop.printerUrl)) {
      flash('Please configure printer in Account Settings');
      return;
    }
    flash(`Printing Bill #${bill.billNumber}...`);
    try {
      const ok = await printerService.printReceipt(bill, shop, '80mm');
      if (ok) {
        flash(`Bill #${bill.billNumber} sent to printer`);
      } else {
        flash('Printer could not be reached');
      }
    } catch (err) {
      console.warn('handlePrintBillFromMenu error:', err);
      flash('Failed to print bill');
    }
  };

  const handleShareBillFromMenu = async (bill: Bill) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    flash('Preparing bill receipt...');
    let pdfUrl: string | undefined;
    try {
      const receiptRes = await exportService.generateAndUploadBillReceipt(bill, shop);
      if (receiptRes?.pdfUrl) {
        pdfUrl = receiptRes.pdfUrl;
      }
    } catch (err) {
      console.warn('Receipt upload notice:', err);
    }
    const msg = whatsappService.formatCustomerBill(bill, shop.name, shop.upiId, shop.phone, pdfUrl);
    await whatsappService.shareViaWhatsApp(msg, bill.customerPhone);
    flash(`Bill #${bill.billNumber} sent on WhatsApp`);
  };

  const SHORT_MONTHS_LIST = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Luxury Hero Sales Card with Straddling New Bill Button */}
        <View style={styles.heroCardContainer}>
          {can('report') ? (
            <View style={styles.heroCard}>
              {/* Unique SVG Curve Accent in background */}
              <View style={styles.heroCurveWrap} pointerEvents="none">
                <Svg width="100%" height="90" viewBox="0 0 360 90" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="heroCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.03" />
                      <Stop offset="50%" stopColor="#FF5F00" stopOpacity="0.22" />
                      <Stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.05" />
                    </LinearGradient>
                    <LinearGradient id="curveStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.08" />
                      <Stop offset="45%" stopColor="#FF5F00" stopOpacity="0.85" />
                      <Stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.2" />
                    </LinearGradient>
                  </Defs>
                  <Path
                    d="M0,55 C90,20 170,72 260,30 C300,12 335,26 360,22 L360,90 L0,90 Z"
                    fill="url(#heroCurveGrad)"
                  />
                  <Path
                    d="M0,55 C90,20 170,72 260,30 C300,12 335,26 360,22"
                    stroke="url(#curveStrokeGrad)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                </Svg>
              </View>

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroKickerWrap}>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroKicker}>{t('sales', 'SALES')}</Text>
                </View>
                <View style={styles.heroHeaderRight}>
                  <View style={styles.heroUniqueBadge}>
                    <View style={styles.heroUniqueDot} />
                    <Text style={styles.heroUniqueText}>{t('live', 'LIVE')}</Text>
                  </View>
                  <View style={styles.heroBillsBadge}>
                    <Text style={styles.heroBillsText}>
                      {filteredBills.length} {filteredBills.length === 1 ? t('bill', 'bill') : t('bills', 'bills')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroAmountRow}>
                <Text style={styles.heroCurrency}>₹</Text>
                <Text style={styles.heroAmount}>
                  {can('total') ? formatRupee(salesTotal).replace('₹', '') : '••••'}
                </Text>
              </View>

              <View style={styles.heroPeriodWrap}>
                <SegmentedControl
                  options={['Today', 'Week', 'Month', 'Year', 'Custom']}
                  selected={period}
                  onSelect={opt => setPeriod(opt)}
                  theme="dark"
                  renderLabel={opt => {
                    if (opt === 'Today') return t('period_today', 'Today');
                    if (opt === 'Week') return t('period_week', 'Week');
                    if (opt === 'Month') return t('period_month', 'Month');
                    if (opt === 'Year') return t('period_year', 'Year');
                    if (opt === 'Custom') return t('period_custom', 'Custom');
                    return opt;
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.heroCard}>
              <View style={styles.heroCurveWrap} pointerEvents="none">
                <Svg width="100%" height="90" viewBox="0 0 360 90" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="billerCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.03" />
                      <Stop offset="50%" stopColor="#FF5F00" stopOpacity="0.18" />
                      <Stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.04" />
                    </LinearGradient>
                    <LinearGradient id="billerCurveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.08" />
                      <Stop offset="45%" stopColor="#FF5F00" stopOpacity="0.85" />
                      <Stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.2" />
                    </LinearGradient>
                  </Defs>
                  <Path
                    d="M0,55 C90,20 170,72 260,30 C300,12 335,26 360,22 L360,90 L0,90 Z"
                    fill="url(#billerCurveGrad)"
                  />
                  <Path
                    d="M0,55 C90,20 170,72 260,30 C300,12 335,26 360,22"
                    stroke="url(#billerCurveStroke)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                </Svg>
              </View>
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroKickerWrap}>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroKicker}>{t('todays_takings', "TODAY'S TAKINGS")}</Text>
                </View>
                <View style={styles.heroBillsBadge}>
                  <Text style={styles.heroBillsText}>
                    {filteredBills.length} {filteredBills.length === 1 ? t('bill', 'bill') : t('bills', 'bills')}
                  </Text>
                </View>
              </View>

              <View style={styles.heroAmountRow}>
                <Text style={styles.heroCurrency}>₹</Text>
                <Text style={styles.heroAmount}>
                  {can('total') ? formatRupee(salesTotal).replace('₹', '') : '••••'}
                </Text>
              </View>
            </View>
          )}

          {/* Animated Orange Pill Button Straddling Bottom Edge of Black Card */}
          <StraddlingNewBillButton
            onPress={() => {
              if (!can('bill')) {
                flash(t('no_access', "You don't have access for that"));
                return;
              }
              onNavigate('sales');
            }}
          />
        </View>

        {/* Custom Calendar Expandable Section */}
        {period === 'Custom' && (
          <View style={styles.customDateSection}>
            <View style={styles.customDateModulesRow}>
              {/* FROM Date Module (Small Rectangle) */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setCalendarPickerMode('range');
                  setIsCustomCalendarVisible(true);
                }}
                style={[
                  styles.customDateBox,
                  isCustomCalendarVisible && styles.customDateBoxHighlighted,
                ]}
              >
                <View style={styles.customDateBoxHeader}>
                  <Ionicons name="calendar" size={13} color={colors.accent} />
                  <Text style={styles.customDateBoxLabel}>{t('from', 'FROM')}</Text>
                </View>
                <Text style={styles.customDateBoxValue} numberOfLines={1}>
                  {`${customStartDate.getDate()} ${SHORT_MONTHS_LIST[customStartDate.getMonth()]} ${customStartDate.getFullYear()}`}
                </Text>
              </TouchableOpacity>

              {/* Nearby Arrow / Connector */}
              <View style={styles.customDateArrowWrap}>
                <Ionicons name="arrow-forward" size={14} color={colors.accent} />
              </View>

              {/* TO Date Module (Small Rectangle) */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setCalendarPickerMode('range');
                  setIsCustomCalendarVisible(true);
                }}
                style={[
                  styles.customDateBox,
                  isCustomCalendarVisible && styles.customDateBoxHighlighted,
                ]}
              >
                <View style={styles.customDateBoxHeader}>
                  <Ionicons name="calendar-outline" size={13} color={colors.accent} />
                  <Text style={styles.customDateBoxLabel}>{t('to', 'TO')}</Text>
                </View>
                <Text style={styles.customDateBoxValue} numberOfLines={1}>
                  {`${customEndDate.getDate()} ${SHORT_MONTHS_LIST[customEndDate.getMonth()]} ${customEndDate.getFullYear()}`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Status / Indicator Row */}
            <View style={styles.customDateStatusRow}>
              {customStartDate.getFullYear() === customEndDate.getFullYear() &&
              customStartDate.getMonth() === customEndDate.getMonth() &&
              customStartDate.getDate() === customEndDate.getDate() ? (
                <View style={styles.singleDateBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                  <Text style={styles.singleDateBadgeText}>{t('single_date_active', 'Single Date Active')}</Text>
                </View>
              ) : (
                <Text style={styles.customDateDurationText}>
                  {Math.round((customEndDate.getTime() - customStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} {t('days_selected', 'Days Selected')}
                </Text>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsCustomCalendarVisible(!isCustomCalendarVisible)}
                style={styles.customDateToggleBtn}
              >
                <Text style={styles.customDateChangeAction}>
                  {isCustomCalendarVisible ? t('close', 'Close') : t('select_date', 'Select Date')}
                </Text>
                <Ionicons
                  name={isCustomCalendarVisible ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={colors.accent}
                />
              </TouchableOpacity>
            </View>

            {isCustomCalendarVisible && (
              <DateRangeCalendar
                startDate={customStartDate}
                endDate={customEndDate}
                initialMode={calendarPickerMode}
                onApplyRange={(start, end) => {
                  setCustomStartDate(start);
                  setCustomEndDate(end);
                  setIsCustomCalendarVisible(false);
                  const isSingle =
                    start.getFullYear() === end.getFullYear() &&
                    start.getMonth() === end.getMonth() &&
                    start.getDate() === end.getDate();
                  if (isSingle) {
                    flash(`Custom date: ${start.getDate()} ${SHORT_MONTHS_LIST[start.getMonth()]} ${start.getFullYear()}`);
                  } else {
                    flash(`Custom range: ${start.getDate()} ${SHORT_MONTHS_LIST[start.getMonth()]} to ${end.getDate()} ${SHORT_MONTHS_LIST[end.getMonth()]}`);
                  }
                }}
                onClose={() => setIsCustomCalendarVisible(false)}
              />
            )}
          </View>
        )}

        {/* 2-Column KPI Cards & Pending Ledger */}
        {can('report') ? (
          <>
            <View style={styles.miniKpiGrid}>
              <View style={styles.miniKpiCard}>
                <View style={[styles.miniKpiHeaderRow, { alignItems: 'center' }]}>
                  <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(255, 95, 0, 0.12)', borderColor: 'rgba(255, 95, 0, 0.25)' }]}>
                    <Ionicons name="receipt-outline" size={15} color="#FF5F00" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    <Text
                      style={[
                        styles.miniKpiKicker,
                        language !== 'en' && { textTransform: 'none', letterSpacing: 0.2, fontSize: 11.5, lineHeight: 15 },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {t('total_expenses', 'EXPENSES')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.miniKpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {formatRupee(totalExpenses)}
                </Text>
                <Text style={styles.miniKpiNote}>{filteredExpenses.length} {t('entries', 'entries')}</Text>
              </View>

              <View style={styles.miniKpiCard}>
                <View style={[styles.miniKpiHeaderRow, { alignItems: 'center' }]}>
                  <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                    <Ionicons name="trending-up-outline" size={15} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    <Text
                      style={[
                        styles.miniKpiKicker,
                        language !== 'en' && { textTransform: 'none', letterSpacing: 0.2, fontSize: 11.5, lineHeight: 15 },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {t('net_profit', 'PROFIT')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.miniKpiValue, styles.profitText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {formatRupee(netProfit)}
                </Text>
                <Text style={styles.miniKpiNote}>{t('net_margin', 'Net margin')}</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => onNavigate('pending')}
              style={styles.pendingLinkCard}
            >
              <View style={[styles.pendingLinkIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', borderWidth: 1 }]}>
                <Ionicons name="hourglass-outline" size={22} color="#F59E0B" />
              </View>
              <View style={styles.pendingLinkInfo}>
                <Text style={styles.pendingLinkKicker}>{t('pending', 'PENDING')}</Text>
                <Text style={styles.pendingLinkValue}>{formatRupee(totalPending)}</Text>
                <Text style={styles.pendingLinkNote}>
                  {pendingList.length} {pendingList.length === 1 ? t('customer', 'customer') : t('customers', 'customers')}
                </Text>
              </View>
              <View style={styles.pendingLinkAction}>
                <Text style={styles.pendingLinkActionText}>{t('view_ledger', 'View ledger')}</Text>
                <Ionicons name="arrow-forward" size={15} color={colors.accent700} />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.miniKpiGrid}>
            <View style={styles.miniKpiCard}>
              <Text style={styles.miniKpiKicker}>MY BILLS</Text>
              <Text style={styles.miniKpiValue}>{filteredBills.length}</Text>
              <Text style={styles.miniKpiNote}>today</Text>
            </View>
            {can('pend') && (
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => onNavigate('pending')}
                style={styles.miniKpiCard}
              >
                <Text style={styles.miniKpiKicker}>PENDING</Text>
                <Text style={styles.miniKpiValue}>
                  {formatRupee(totalPending)}
                </Text>
                <Text style={styles.miniKpiNote}>view only</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Analytics Section */}
        {can('report') && (
          <View style={styles.analyticsContainer}>
            {/* Peak Hours Chart */}
            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.sectionHeading}>Peak hours</Text>
                  <Text style={styles.sectionNote}>
                    {filteredBills.length > 0 ? `${filteredBills.length} bills tracked` : 'No bills in this period'}
                  </Text>
                </View>
                {selectedPeakHour !== null && (
                  <View style={styles.chartTooltipPill}>
                    <Text style={styles.chartTooltipText}>
                      {peakHoursData[selectedPeakHour].label}: {peakHoursData[selectedPeakHour].count} bills ({peakHoursData[selectedPeakHour].val}%)
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.chartCard}>
                <View style={styles.barContainer}>
                  {peakHoursData.map((h, i) => {
                    const isSelected = selectedPeakHour === i;
                    const hasBills = h.count > 0;
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => setSelectedPeakHour(selectedPeakHour === i ? null : i)}
                        style={styles.barCol}
                      >
                        <View style={styles.barTrack}>
                          {hasBills && (
                            <Text style={styles.barCountLabel}>
                              {h.count}
                            </Text>
                          )}
                          <View
                            style={[
                              styles.bar,
                              { height: h.heightPx },
                              hasBills && styles.barActive,
                              h.isPeak && styles.peakBar,
                              isSelected && styles.barSelected,
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, (h.isPeak || isSelected) && styles.barLabelActive]}>
                          {h.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Day of Week Chart */}
            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <Text style={styles.sectionHeading}>Day of week</Text>
                {selectedDowIndex !== null && (
                  <View style={styles.chartTooltipPill}>
                    <Text style={styles.chartTooltipText}>
                      {weekDaysData[selectedDowIndex].label}: {weekDaysData[selectedDowIndex].count} bills
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.weekBarsRow}>
                {weekDaysData.map((d, i) => {
                  const isSelected = selectedDowIndex === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.7}
                      onPress={() => setSelectedDowIndex(selectedDowIndex === i ? null : i)}
                      style={[
                        styles.weekBarCol,
                        isSelected && styles.weekBarSelectedPill,
                      ]}
                    >
                      {d.count > 0 && (
                        <View
                          style={[
                            styles.weekBarFill,
                            { height: d.heightPx },
                            d.isPeak ? styles.weekPeakBarFill : styles.weekActiveBarFill,
                          ]}
                        />
                      )}
                      <Text
                        style={[
                          styles.weekBarLabel,
                          (d.isPeak || isSelected) && styles.barLabelActive,
                          d.isPeak && d.count > 0 && { color: '#FFFFFF' },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>


            {/* Payment Modes (Image 2 Design) */}
            <View style={styles.chartSection}>
              <Text style={styles.sectionHeading}>{t('payment_split', 'Payment modes')}</Text>
              <View style={styles.paymentModesCard}>
                {/* Horizontal segmented multi-colored progress bar */}
                <View style={styles.modeProgressBar}>
                  {salesTotal > 0 ? (
                    <>
                      {cashSales > 0 && (
                        <View style={[styles.modeProgressCash, { flex: cashSales / salesTotal }]} />
                      )}
                      {upiSales > 0 && (
                        <View style={[styles.modeProgressUpi, { flex: upiSales / salesTotal }]} />
                      )}
                      {pendingSales > 0 && (
                        <View style={[styles.modeProgressPending, { flex: pendingSales / salesTotal }]} />
                      )}
                    </>
                  ) : (
                    <View style={{ flex: 1, backgroundColor: isDark ? '#262626' : '#EFECE6' }} />
                  )}
                </View>

                {/* 3-Column stats row */}
                {salesTotal > 0 && (
                  <View style={styles.modeStatsRow}>
                    {/* Cash */}
                    <View style={styles.modeStatCol}>
                      <View style={styles.modeStatHeader}>
                        <View style={[styles.modeStatDot, { backgroundColor: isDark ? '#FFFFFF' : '#111111' }]} />
                        <Text style={styles.modeStatLabel}>{t('cash', 'Cash')}</Text>
                      </View>
                      <View style={styles.modeStatValues}>
                        <Text style={styles.modeStatAmt}>{formatRupee(cashSales)}</Text>
                        <Text style={styles.modeStatPct}>{cashPct}</Text>
                      </View>
                    </View>

                    {/* GPay / UPI */}
                    <View style={styles.modeStatCol}>
                      <View style={styles.modeStatHeader}>
                        <View style={[styles.modeStatDot, { backgroundColor: '#FF5F00' }]} />
                        <Text style={styles.modeStatLabel}>{t('online_upi', 'GPay / UPI')}</Text>
                      </View>
                      <View style={styles.modeStatValues}>
                        <Text style={styles.modeStatAmt}>{formatRupee(upiSales)}</Text>
                        <Text style={styles.modeStatPct}>{upiPct}</Text>
                      </View>
                    </View>

                    {/* Pending */}
                    <View style={styles.modeStatCol}>
                      <View style={styles.modeStatHeader}>
                        <View style={[styles.modeStatDot, { backgroundColor: '#FFC59E' }]} />
                        <Text style={styles.modeStatLabel}>{t('pending', 'Pending')}</Text>
                      </View>
                      <View style={styles.modeStatValues}>
                        <Text style={styles.modeStatAmt}>{formatRupee(pendingSales)}</Text>
                        <Text style={styles.modeStatPct}>{pendingPct}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Expenses Option (Above Today's Summary Report) */}
        {can('exp') && (
          <View style={styles.expenseSection}>
            <View style={styles.expenseHeroCard}>
              <View style={styles.expenseDashedIconBox}>
                <Ionicons name="wallet-outline" size={24} color="#FF5F00" />
              </View>
              <TouchableOpacity
                style={styles.expenseHeroInfo}
                activeOpacity={0.7}
                onPress={() => {
                  if (todayExpensesList.length > 0) {
                    setIsExpenseListExpanded(prev => !prev);
                  } else {
                    setIsAddExpenseFormOpen(prev => !prev);
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                  <Text
                    style={styles.expenseHeroTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {t('expenses', 'Expenses')}
                  </Text>
                  {todayExpensesList.length > 0 && (
                    <Ionicons
                      name={isExpenseListExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  )}
                </View>
                <Text style={styles.expenseHeroSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {todayExpensesList.length === 0
                    ? t('no_expenses_today', 'No expenses logged today')
                    : isExpenseListExpanded
                    ? `${todayExpensesList.length} ${t('expenses_logged', 'expenses')} (${formatRupee(todayTotalExpenses)}) · ${t('tap_to_hide', 'Tap to hide')}`
                    : `${todayExpensesList.length} ${t('expenses_logged', 'expenses')} (${formatRupee(todayTotalExpenses)}) · ${t('tap_to_view', 'Tap to view')}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (can('exp')) {
                    setIsAddExpenseFormOpen(prev => !prev);
                  } else {
                    flash(t('no_access', "You don't have access for that"));
                  }
                }}
                style={styles.expenseAddBtn}
                activeOpacity={0.8}
                accessibilityLabel="Add new expense"
              >
                <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
                <Text
                  style={styles.expenseAddBtnText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t('add_expense', 'Add')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Add Expense Form (Revealed when Add is tapped) */}
            {isAddExpenseFormOpen && (
              <View style={styles.addExpenseRow}>
                <View style={styles.expenseDescInputWrap}>
                  <TextInput
                    style={styles.expenseDescInput}
                    placeholder={t('what_was_it_for', 'What was it for?')}
                    placeholderTextColor={colors.textSecondary}
                    value={expenseNameInput}
                    onChangeText={setExpenseNameInput}
                  />
                  <TouchableOpacity
                    onPress={() => setIsExpensePickerVisible(true)}
                    style={styles.expenseDropdownTrigger}
                    activeOpacity={0.7}
                    accessibilityLabel="Pick or type expense category"
                  >
                    <Ionicons name="chevron-down" size={16} color={colors.accent} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.expenseAmtInput}
                  placeholder={t('amount_rupees', 'Amount (₹)')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={expenseAmountInput}
                  onChangeText={t => setExpenseAmountInput(t.replace(/[^0-9]/g, ''))}
                />
                <AppButton
                  title={t('save', 'Save')}
                  variant="primary"
                  icon={<Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                  onPress={async () => {
                    await handleAddExpense();
                    setIsAddExpenseFormOpen(false);
                    setIsExpenseListExpanded(true);
                  }}
                  style={styles.addExpBtn}
                />
              </View>
            )}

            {/* Added expenses will ONLY be visible if expanded! */}
            {isExpenseListExpanded && todayExpensesList.length > 0 && (
              <View style={styles.expenseList}>
                {todayExpensesList.map(e => (
                  <View key={e.id} style={styles.expenseRow}>
                    <Text style={styles.expenseDesc} numberOfLines={1}>{e.description}</Text>
                    <View style={styles.expenseRightGroup}>
                      <Text style={styles.expenseAmt}>{formatRupee(e.amount)}</Text>
                      <TouchableOpacity
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleOpenExpenseMenu(e)}
                        style={styles.expenseMenuBtn}
                        accessibilityLabel="Expense options"
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Centered Animated Today's Summary Report Action */}
        {(can('total') || can('report')) && (
          <View style={styles.bottomClosingWrap}>
            <TodaySummaryReportCard
              theme={theme}
              todaySales={dayClosingReport.totalSales}
              todayBillsCount={dayClosingReport.billsCount}
              onPress={() => {
                setIsDayClosingModalVisible(true);
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Day Closing Modal */}
      <DayClosingModal
        visible={isDayClosingModalVisible}
        onClose={() => setIsDayClosingModalVisible(false)}
        report={dayClosingReport}
        onShareWhatsApp={handleShareClosingWhatsApp}
        onPrint={handlePrintClosing}
      />

      {/* Collect Due Modal */}
      <CollectDueModal
        visible={isCollectDueModalVisible}
        onClose={() => setIsCollectDueModalVisible(false)}
        record={selectedPendingRecord}
        onConfirm={handleConfirmCollectDue}
      />

      {/* Bill Action Menu Modal (Three dots) */}
      <BillActionMenuModal
        visible={isBillMenuVisible}
        onClose={() => setIsBillMenuVisible(false)}
        bill={selectedBillForMenu}
        onPrint={handlePrintBillFromMenu}
        onShareWhatsApp={handleShareBillFromMenu}
        onEdit={currentRole !== 'Biller' ? handleEditBillFromMenu : undefined}
        onDelete={currentRole !== 'Biller' ? handleDeleteBillFromMenu : undefined}
      />

      {/* Expense Action Menu Modal */}
      <ExpenseActionMenuModal
        visible={isExpenseMenuVisible}
        onClose={() => setIsExpenseMenuVisible(false)}
        expense={selectedExpenseForMenu}
        onEdit={handleStartEditExpense}
        onDelete={handleDeleteExpense}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        visible={isEditExpenseModalVisible}
        onClose={() => setIsEditExpenseModalVisible(false)}
        expense={selectedExpenseForEdit}
        onSave={handleSaveEditExpense}
        shopType={shop.shopType}
      />

      {/* Expense Category Picker Modal */}
      <ExpenseCategoryPickerModal
        visible={isExpensePickerVisible}
        onClose={() => setIsExpensePickerVisible(false)}
        shopType={shop.shopType}
        onSelect={(preset) => {
          const shortName = preset.label.split('(')[0].trim();
          setExpenseNameInput(shortName);
        }}
      />

      {/* Bill Delete Confirmation Modal */}
      <Modal
        visible={!!billToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeletingBill && setBillToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="trash" size={32} color="#DC2626" />
            </View>

            <Text style={styles.confirmTitle}>Delete Bill {billToDelete?.billNumber}?</Text>
            <Text style={styles.confirmDescription}>
              This bill ({formatRupee(billToDelete?.totalAmount || 0)}) will be marked as deleted. It will be removed from daily sales and revenue reports, but preserved in the audit log.
            </Text>

            <View style={styles.confirmNoticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#B45309" />
              <Text style={styles.confirmNoticeText}>
                Deleted bills still count toward the 100 free bills limit.
              </Text>
            </View>

            <View style={styles.modalButtonsRow}>
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => setBillToDelete(null)}
                style={{ flex: 1 }}
                disabled={isDeletingBill}
              />
              <AppButton
                title={isDeletingBill ? 'Deleting...' : 'Delete'}
                variant="danger"
                onPress={handleConfirmDeleteBill}
                style={{ flex: 1 }}
                disabled={isDeletingBill}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme, insets?: { top: number; bottom: number; left: number; right: number }) => {
  const colors = theme.colors;
  const bottomInset = insets?.bottom || 0;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    paddingBottom: Platform.OS === 'android' ? Math.max(bottomInset, 48) + 140 : Math.max(bottomInset, 24) + 140,
  },

  // ─── Luxury Hero Sales Card ──────────────────────────────────────────────────
  heroCardContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 4,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...shadows.floating,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCurveWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    overflow: 'hidden',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroKickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent700,
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heroHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroUniqueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 95, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 0, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  heroUniqueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5F00',
  },
  heroUniqueText: {
    color: '#FF8A3D',
    fontSize: 10,
    fontFamily: typography.fonts.bodyBold,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroBillsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  heroBillsText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  heroCurrency: {
    fontSize: 28,
    lineHeight: 36,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: typography.fonts.numbers,
    fontWeight: '700',
    marginRight: 4,
  },
  heroAmount: {
    fontSize: typography.sizes.amount,
    lineHeight: 56,
    color: '#FFFFFF',
    fontFamily: typography.fonts.numbers,
    fontWeight: '800',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  heroPeriodWrap: {
    marginTop: 2,
  },

  // ─── Beautiful New Bill Action Button ───────────────────────────────────────
  newBillHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5F00',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 4,
    ...shadows.card,
  },
  newBillIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBillTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  newBillTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  newBillSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  newBillArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  // ─── 2-Column Mini KPI Grid ──────────────────────────────────────────────────
  miniKpiGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  miniKpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    gap: 4,
    overflow: 'hidden',
  },
  miniKpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  miniKpiKicker: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
  },
  miniKpiKickerIndic: {
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
    lineHeight: 14,
  },
  miniKpiValue: {
    fontSize: 21,
    lineHeight: 26,
    color: colors.text,
    fontFamily: typography.fonts.numbers,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  miniKpiNote: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },

  // ─── Pending Ledger Link Card ────────────────────────────────────────────────
  pendingLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    ...shadows.card,
  },
  pendingLinkIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingLinkInfo: {
    flex: 1,
    gap: 2,
  },
  pendingLinkKicker: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
  },
  pendingLinkValue: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    fontFamily: typography.fonts.numbers,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  pendingLinkNote: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  pendingLinkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingLinkActionText: {
    fontSize: 13,
    color: colors.accent700,
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
  },

  // ─── KPI Grid ────────────────────────────────────────────────────────────────
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    gap: 3,
  },
  kpiKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  kpiIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiKicker: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  kpiValue: {
    fontFamily: typography.fonts.numbers,
    fontSize: 21,
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 25,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  profitText: {
    color: '#059669',
  },
  lockedText: {
    color: colors.neutral300,
  },
  kpiNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.body,
  },

  // ─── Locked Notice ───────────────────────────────────────────────────────────
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  lockIcon: {
    fontSize: 16,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: typography.sizes.sub,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    lineHeight: 18,
  },

  // ─── Analytics ───────────────────────────────────────────────────────────────
  analyticsContainer: {
    gap: 12,
  },
  chartSection: {
    gap: 6,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTooltipPill: {
    backgroundColor: '#1C1917',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  chartTooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    height: 124,
    justifyContent: 'flex-end',
    ...shadows.card,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 84,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    height: 70,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  barCountLabel: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#FF5F00',
    marginBottom: 2,
  },
  bar: {
    width: 13,
    backgroundColor: theme.isDark ? '#2D3139' : '#E2E8F0',
    borderRadius: 4,
    minHeight: 6,
  },
  barActive: {
    backgroundColor: '#FB923C',
  },
  peakBar: {
    backgroundColor: '#FF5F00',
  },
  barSelected: {
    backgroundColor: '#C2410C',
    width: 15,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: typography.fonts.body,
  },
  barLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  weekBarsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  weekBarCol: {
    flex: 1,
    height: 84,
    borderRadius: 99,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.card,
  },
  weekBarSelectedPill: {
    borderColor: '#FF5F00',
    borderWidth: 2,
  },
  weekBarFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.accent100,
  },
  weekActiveBarFill: {
    backgroundColor: '#FDBA74',
  },
  weekPeakBarFill: {
    backgroundColor: '#FF5F00',
  },
  weekBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: typography.fonts.heading,
    zIndex: 1,
  },

  // ─── Dropdown Header & Trigger Badges ─────────────────────────────────────────
  collapsibleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 6,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionItemCountBadge: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: 'rgba(255, 95, 0, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  sectionHeaderWithDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dropdownTriggerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 95, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 0, 0.28)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
  },
  dropdownTriggerText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FF5F00',
  },

  // ─── Product Growth ───────────────────────────────────────────────────────────
  productsList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: {
    flex: 2,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  productQty: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    fontVariant: ['tabular-nums'],
  },
  productAmt: {
    flex: 1,
    fontFamily: typography.fonts.numbers,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  deltaTag: {
    marginLeft: 8,
  },

  // ─── Payment Modes (Image 2 Design) ──────────────────────────────────────────
  paymentModesCard: {
    backgroundColor: theme.isDark ? '#141414' : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
    borderRadius: 22,
    padding: 16,
    ...shadows.card,
  },
  modeProgressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.isDark ? '#262626' : '#EFECE6',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  modeProgressCash: {
    backgroundColor: theme.isDark ? '#FFFFFF' : '#111111',
    height: '100%',
  },
  modeProgressUpi: {
    backgroundColor: '#FF5F00',
    height: '100%',
  },
  modeProgressPending: {
    backgroundColor: '#FFC59E',
    height: '100%',
  },
  modeStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modeStatCol: {
    flex: 1,
  },
  modeStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modeStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeStatLabel: {
    fontSize: 12,
    color: theme.isDark ? '#A8A29E' : colors.textSecondary,
    fontFamily: typography.fonts.body,
    fontWeight: '400',
  },
  modeStatValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  modeStatAmt: {
    fontSize: 15,
    color: theme.isDark ? '#FFFFFF' : colors.text,
    fontFamily: typography.fonts.numbers,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  modeStatPct: {
    fontSize: 11.5,
    color: theme.isDark ? '#A8A29E' : colors.textSecondary,
    fontFamily: typography.fonts.body,
  },

  // ─── Pending Section ──────────────────────────────────────────────────────────
  pendingSection: {
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    fontFamily: typography.fonts.bodySemiBold,
  },
  pendingCardsList: {
    gap: 6,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    ...shadows.card,
  },
  pendingAvatarMini: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent200,
  },
  pendingAvatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontWeight: '700',
  },
  pendingInfo: {
    flex: 1,
    minWidth: 0,
  },
  pendingName: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  pendingSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  pendingAmt: {
    fontFamily: typography.fonts.numbers,
    fontSize: 13.5,
    color: '#DC2626',
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  remindBtnMini: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  paidBtnTextMini: {
    fontSize: 11,
    fontFamily: typography.fonts.bodySemiBold,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ─── Expenses (Image 1 Design) ────────────────────────────────────────────────
  expenseSection: {
    gap: 8,
  },
  expenseHeroCard: {
    backgroundColor: theme.isDark ? '#141414' : colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    ...shadows.card,
  },
  expenseDashedIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 95, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseHeroInfo: {
    flex: 1,
    minWidth: 0,
  },
  expenseHeroTitle: {
    fontSize: 16,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  expenseHeroSubtitle: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expenseAddBtn: {
    backgroundColor: '#FF5F00',
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  expenseAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fonts.bodyBold,
    fontWeight: '800',
  },
  expenseList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  expenseDesc: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: typography.fonts.body,
    marginRight: 10,
    fontWeight: '500',
  },
  expenseRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseAmt: {
    fontFamily: typography.fonts.numbers,
    fontSize: 13.5,
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  expenseMenuBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.neutral100,
  },

  // ─── Add Expense Form ─────────────────────────────────────────────────────────
  addExpenseRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  expenseDescInputWrap: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.pill,
    minHeight: 44,
    paddingRight: 6,
    paddingLeft: 4,
  },
  expenseDescInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  expenseDropdownTrigger: {
    padding: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral100,
  },
  expenseAmtInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.body,
    color: colors.text,
    minHeight: 44,
  },
  addExpBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },

  // ─── Bottom Actions ───────────────────────────────────────────────────────────
  bottomClosingWrap: {
    marginTop: 12,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Modal Styles ───────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay55,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    ...shadows.lg,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  confirmDescription: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  confirmNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: radii.md,
    marginTop: 14,
    width: '100%',
  },
  confirmNoticeText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },

  // ─── Empty State ──────────────────────────────────────────────────────────────
  emptyCard: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyCardText: {
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── Custom Date Range ────────────────────────────────────────────────────────
  customDateSection: {
    gap: 8,
    marginVertical: 4,
  },
  customDateModulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customDateBox: {
    flex: 1,
    backgroundColor: colors.accent100,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.accent200,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  customDateBoxHighlighted: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  customDateBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  customDateBoxLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  customDateBoxValue: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  customDateArrowWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent100,
    borderWidth: 1,
    borderColor: colors.accent200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDateStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  singleDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  singleDateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    fontFamily: typography.fonts.heading,
  },
  customDateDurationText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.fonts.heading,
  },
  customDateToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customDateChangeAction: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontWeight: '700',
  },
  });
};

