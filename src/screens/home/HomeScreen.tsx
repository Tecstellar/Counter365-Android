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
import { expenseService } from '../../services/expenseService';
import { billingService } from '../../services/billingService';
import { reportService } from '../../services/reportService';
import { exportService } from '../../services/exportService';
import { whatsappService } from '../../services/whatsappService';
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
              <Text style={stylesTodayReport.todayTagText}>Today Report</Text>
            </View>
          </View>

          <View style={stylesTodayReport.bannerTextContainer}>
            <Text style={stylesTodayReport.bannerTitle}>Today's Summary Report</Text>
            <Text style={stylesTodayReport.bannerSubtitle}>
              Review today's revenue, settlement & daily register
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
              Swipe down or tap to open
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

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenReminder,
  onEditBill,
}) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { currentRole, can, profile } = useAuth();
  const { shop, refreshSubscription } = useShop();
  const { flash } = useCart();

  const [period, setPeriod] = useState<'Day' | 'Week' | 'Month' | 'Year' | 'Custom'>('Day');
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [pendingList, setPendingList] = useState<PendingPaymentRecord[]>([]);
  const [expenseNameInput, setExpenseNameInput] = useState('');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [isAddExpenseFormOpen, setIsAddExpenseFormOpen] = useState(false);
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
  const [selectedPeakHour, setSelectedPeakHour] = useState<number | null>(null);
  const [selectedDowIndex, setSelectedDowIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData();
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
  const todayStr = now.toISOString().split('T')[0];

  const isDateInPeriod = (dateIsoStr?: string | null): boolean => {
    if (!dateIsoStr) return false;
    const d = new Date(dateIsoStr);
    if (isNaN(d.getTime())) return false;
    if (period === 'Day') {
      return dateIsoStr.startsWith(todayStr);
    }
    if (period === 'Week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= oneWeekAgo;
    }
    if (period === 'Month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'Year') {
      return d.getFullYear() === now.getFullYear();
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
      .filter(b => !b.isDeleted && b.status !== 'deleted')
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
    setIsDeletingBill(true);
    try {
      await billingService.deleteBill(shop.id, billToDelete.id, {
        name: profile?.fullName || currentRole,
        role: currentRole,
        id: profile?.id,
      });
      setBillToDelete(null);
      await loadData();
      try { await refreshSubscription(); } catch {}
      flash(`Bill ${billToDelete.billNumber} deleted`);
    } catch (err) {
      console.warn('handleConfirmDeleteBill error:', err);
      flash('Failed to delete bill');
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

  const filteredExpenses = expenses.filter(e => {
    const eDate = new Date(e.expenseDate);
    if (period === 'Day') {
      return e.expenseDate === todayStr;
    }
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

  // Peak Hours calculation from real bills
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
    const count = filteredBills.filter(b => {
      const h = new Date(b.createdAt).getHours();
      return h >= slot.hour && h < slot.hour + 2;
    }).length;
    return { ...slot, count };
  });

  const maxHourCount = Math.max(1, ...hourCounts.map(h => h.count));
  const peakHoursData = hourCounts.map(h => ({
    label: h.label,
    count: h.count,
    val: Math.round((h.count / maxHourCount) * 100),
    pct: `${h.count > 0 ? Math.max(10, Math.round((h.count / maxHourCount) * 78)) : 6}%`,
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
    pct: `${d.count > 0 ? Math.max(10, Math.round((d.count / maxDowCount) * 100)) : 6}%`,
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

  const productList = Array.from(productMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      qty: `${p.quantity} sold`,
      amt: formatRupee(p.amount),
      delta: 'Active',
      isPositive: true,
    }));

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
      flash('Adding expenses is locked. Ask the owner');
      return;
    }
    const name = expenseNameInput.trim();
    const amt = Number(expenseAmountInput.replace(/[^0-9]/g, ''));
    if (!name || !amt) {
      flash('Name and amount needed');
      return;
    }

    const newExp = await expenseService.addExpense(shop.id, name, amt);
    setExpenses(prev => [newExp, ...prev]);
    setExpenseNameInput('');
    setExpenseAmountInput('');
    flash('Expense added');
  };

  const handleOpenExpenseMenu = (exp: ExpenseRecord) => {
    if (!can('exp')) {
      flash('Managing expenses is locked. Ask the owner');
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
    const updated = await expenseService.updateExpense(shop.id, expenseId, description, amount);
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
            const updated = await expenseService.deleteExpense(shop.id, exp.id);
            setExpenses(updated);
            flash('Expense deleted');
          },
        },
      ]
    );
  };

  const handleOpenCollectDue = (item: PendingPaymentRecord) => {
    if (!can('pend')) {
      flash('Clearing pending is locked. Ask the owner');
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
    const updated = await billingService.clearPendingPayment(
      shop.id,
      record.billId || record.id,
      amountToCollect,
      paymentMode
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

  const todayBills = bills.filter(b => b.createdAt.startsWith(todayStr) || (b.settledAt && b.settledAt.startsWith(todayStr)));
  const todayExpensesList = expenses.filter(e => e.expenseDate === todayStr);
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
        {/* Luxury Hero Sales Card with Unique Curve Accent */}
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
                <Text style={styles.heroKicker}>SALES</Text>
              </View>
              <View style={styles.heroHeaderRight}>
                <View style={styles.heroUniqueBadge}>
                  <View style={styles.heroUniqueDot} />
                  <Text style={styles.heroUniqueText}>LIVE</Text>
                </View>
                <View style={styles.heroBillsBadge}>
                  <Text style={styles.heroBillsText}>
                    {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
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
                options={['Day', 'Week', 'Month', 'Year', 'Custom']}
                selected={period}
                onSelect={opt => setPeriod(opt)}
                theme="dark"
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
                <Text style={styles.heroKicker}>TODAY'S TAKINGS</Text>
              </View>
              <View style={styles.heroBillsBadge}>
                <Text style={styles.heroBillsText}>
                  {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
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

        {/* Custom Calendar Expandable Section */}
        {period === 'Custom' && (
          <View style={styles.customDateSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsCustomCalendarVisible(!isCustomCalendarVisible)}
              style={styles.customDateTrigger}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.accent} />
              <Text style={styles.customDateRangeText}>
                {`${customStartDate.getDate()} ${SHORT_MONTHS_LIST[customStartDate.getMonth()]} to ${customEndDate.getDate()} ${SHORT_MONTHS_LIST[customEndDate.getMonth()]} ${customEndDate.getFullYear()}`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.customDateChangeAction}>
                  {isCustomCalendarVisible ? 'Hide' : 'Change Date'}
                </Text>
                <Ionicons
                  name={isCustomCalendarVisible ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={colors.accent}
                />
              </View>
            </TouchableOpacity>

            {isCustomCalendarVisible && (
              <DateRangeCalendar
                startDate={customStartDate}
                endDate={customEndDate}
                onApplyRange={(start, end) => {
                  setCustomStartDate(start);
                  setCustomEndDate(end);
                  setIsCustomCalendarVisible(false);
                  flash(`Custom range: ${start.getDate()} ${SHORT_MONTHS_LIST[start.getMonth()]} to ${end.getDate()} ${SHORT_MONTHS_LIST[end.getMonth()]}`);
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
                <View style={styles.miniKpiHeaderRow}>
                  <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(255, 95, 0, 0.12)', borderColor: 'rgba(255, 95, 0, 0.25)' }]}>
                    <Ionicons name="receipt-outline" size={15} color="#FF5F00" />
                  </View>
                  <Text style={styles.miniKpiKicker}>EXPENSES</Text>
                </View>
                <Text style={styles.miniKpiValue}>{formatRupee(totalExpenses)}</Text>
                <Text style={styles.miniKpiNote}>{filteredExpenses.length} entries</Text>
              </View>

              <View style={styles.miniKpiCard}>
                <View style={styles.miniKpiHeaderRow}>
                  <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                    <Ionicons name="trending-up-outline" size={15} color="#10B981" />
                  </View>
                  <Text style={styles.miniKpiKicker}>PROFIT</Text>
                </View>
                <Text style={[styles.miniKpiValue, styles.profitText]}>
                  {formatRupee(netProfit)}
                </Text>
                <Text style={styles.miniKpiNote}>Net margin</Text>
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
                <Text style={styles.pendingLinkKicker}>PENDING</Text>
                <Text style={styles.pendingLinkValue}>{formatRupee(totalPending)}</Text>
                <Text style={styles.pendingLinkNote}>
                  {pendingList.length} {pendingList.length === 1 ? 'customer' : 'customers'}
                </Text>
              </View>
              <View style={styles.pendingLinkAction}>
                <Text style={styles.pendingLinkActionText}>View ledger</Text>
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
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => onNavigate('pending')}
              style={styles.miniKpiCard}
            >
              <Text style={styles.miniKpiKicker}>PENDING</Text>
              <Text style={styles.miniKpiValue}>
                {can('pend') ? formatRupee(totalPending) : '••••'}
              </Text>
              <Text style={styles.miniKpiNote}>{can('pend') ? 'view only' : 'locked'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Locked message for biller */}
        {!can('report') && (
          <View style={styles.lockedNotice}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text style={styles.lockedNoticeText}>
              Analytics, expenses and reports are locked. Please ask the owner.
            </Text>
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
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => setSelectedPeakHour(selectedPeakHour === i ? null : i)}
                        style={styles.barCol}
                      >
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.bar,
                              { height: h.pct as any },
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
                            { height: d.pct as any },
                            d.isPeak && styles.weekPeakBarFill,
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

            {/* Product Growth List */}
            <View style={styles.chartSection}>
              <Text style={styles.sectionHeading}>Product growth</Text>
              <View style={styles.productsList}>
                {productList.length > 0 ? (
                  productList.map((p, i) => (
                    <View key={i} style={styles.productRow}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.productQty}>{p.qty}</Text>
                      <Text style={styles.productAmt}>{p.amt}</Text>
                      <AppTag
                        label={p.delta}
                        variant={p.isPositive ? 'accent' : 'neutral'}
                        style={styles.deltaTag}
                      />
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>No items billed yet in this period</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Payment Modes (Image 2 Design) */}
            <View style={styles.chartSection}>
              <Text style={styles.sectionHeading}>Payment modes</Text>
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
                        <Text style={styles.modeStatLabel}>Cash</Text>
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
                        <Text style={styles.modeStatLabel}>GPay / UPI</Text>
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
                        <Text style={styles.modeStatLabel}>Pending</Text>
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

        {/* Pending Section */}
        {can('pend') && (
          <View style={styles.pendingSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Pending dues ({formatRupee(totalPending)})</Text>
              <TouchableOpacity
                onPress={() => onNavigate('pending')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.viewAllLink}>View all ({pendingList.length}) →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pendingCardsList}>
              {pendingList.length > 0 ? (
                pendingList.slice(0, 4).map(item => (
                  <View key={item.id} style={styles.pendingCard}>
                    <View style={styles.pendingAvatarMini}>
                      <Text style={styles.pendingAvatarText}>{item.customerName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName} numberOfLines={1}>{item.customerName}</Text>
                      <Text style={styles.pendingSub} numberOfLines={1}>
                        {item.customerPhone ? `+91 ${item.customerPhone}` : 'No phone'} • {item.ageDescription}
                      </Text>
                    </View>
                    <Text style={styles.pendingAmt}>{formatRupee(item.amountDue)}</Text>
                    <TouchableOpacity
                      style={styles.remindBtnMini}
                      onPress={() => onOpenReminder(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="Remind on WhatsApp"
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.paidBtnMini}
                      onPress={() => handleOpenCollectDue(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="Collect Due"
                    >
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                      <Text style={styles.paidBtnTextMini}>Collect</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No pending customer balances</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Expenses Today Section (Image 1 Design) */}
        {can('exp') && (
          <View style={styles.expenseSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Expenses today</Text>
              {todayTotalExpenses > 0 && (
                <Text style={styles.sectionNote}>{formatRupee(todayTotalExpenses)}</Text>
              )}
            </View>

            {/* Luxury Expense Hero Card from Image 1 */}
            <View style={styles.expenseHeroCard}>
              <View style={styles.expenseDashedIconBox}>
                <Ionicons name="cash-outline" size={24} color="#FF5F00" />
              </View>

              <View style={styles.expenseHeroInfo}>
                <Text style={styles.expenseHeroTitle}>
                  {todayExpensesList.length === 0
                    ? 'No expenses recorded today'
                    : `${formatRupee(todayTotalExpenses)} spent today`}
                </Text>
                <Text style={styles.expenseHeroSubtitle}>
                  {todayExpensesList.length === 0
                    ? 'Tap Add to log a spend'
                    : `${todayExpensesList.length} ${todayExpensesList.length === 1 ? 'expense' : 'expenses'} logged`}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setIsAddExpenseFormOpen(prev => !prev)}
                style={styles.expenseAddBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.expenseAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Add Expense Form (Revealed when Add is tapped) */}
            {isAddExpenseFormOpen && (
              <View style={styles.addExpenseRow}>
                <View style={styles.expenseDescInputWrap}>
                  <TextInput
                    style={styles.expenseDescInput}
                    placeholder="What was it for?"
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
                  placeholder="₹"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={expenseAmountInput}
                  onChangeText={t => setExpenseAmountInput(t.replace(/[^0-9]/g, ''))}
                />
                <AppButton
                  title="Save"
                  variant="primary"
                  icon={<Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                  onPress={async () => {
                    await handleAddExpense();
                    setIsAddExpenseFormOpen(false);
                  }}
                  style={styles.addExpBtn}
                />
              </View>
            )}

            {/* List of today's logged expenses */}
            {todayExpensesList.length > 0 && (
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
        <View style={styles.bottomClosingWrap}>
          <TodaySummaryReportCard
            theme={theme}
            todaySales={dayClosingReport.totalSales}
            todayBillsCount={dayClosingReport.billsCount}
            onPress={() => {
              if (can('total')) {
                setIsDayClosingModalVisible(true);
              } else {
                flash('Reports are locked. Please ask the owner');
              }
            }}
          />
        </View>
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
        onEdit={handleEditBillFromMenu}
        onDelete={handleDeleteBillFromMenu}
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

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    paddingBottom: 70,
  },

  // ─── Luxury Hero Sales Card ──────────────────────────────────────────────────
  heroCard: {
    borderRadius: 24,
    padding: 20,
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

  // ─── 2-Column Mini KPI Grid ──────────────────────────────────────────────────
  miniKpiGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  miniKpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    gap: 4,
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
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
  },
  miniKpiValue: {
    fontSize: 24,
    lineHeight: 28,
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
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  bar: {
    width: 10,
    backgroundColor: colors.neutral200,
    borderRadius: 3,
    minHeight: 4,
  },
  peakBar: {
    backgroundColor: colors.accent700,
  },
  barSelected: {
    backgroundColor: '#C2410C',
    width: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  expenseAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    gap: 6,
  },
  customDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent100,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.accent200,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
  },
  customDateCalendarIcon: {
    fontSize: 16,
  },
  customDateRangeText: {
    flex: 1,
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.accent700,
    fontWeight: '700',
  },
  customDateChangeAction: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.accent600,
    fontWeight: '600',
  },
  });
};

