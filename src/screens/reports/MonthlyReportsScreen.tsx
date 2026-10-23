import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/common/AppButton';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { PaymentModeIcon } from '../../components/common/PaymentModeIcon';
import { ReportPreviewModal } from '../../components/modals/ReportPreviewModal';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { AppTag } from '../../components/common/AppTag';
import { reportService } from '../../services/reportService';
import { billingService } from '../../services/billingService';
import { expenseService } from '../../services/expenseService';
import { exportService } from '../../services/exportService';
import { whatsappService } from '../../services/whatsappService';
import { Bill, ExpenseRecord, PendingPaymentRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthSummary {
  monthIndex: number;
  monthName: string;
  monthShort: string;
  bills: Bill[];
  totalAmount: number;
  count: number;
}

interface YearSummary {
  year: number;
  totalAmount: number;
  count: number;
  months: MonthSummary[];
}

interface MonthlyReportsScreenProps {
  onBackToHome: () => void;
  onNavigateToUpgrade?: () => void;
}

export const MonthlyReportsScreen: React.FC<MonthlyReportsScreenProps> = ({
  onBackToHome,
  onNavigateToUpgrade,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { shop, subscriptionStatus } = useShop();
  const { flash } = useCart();
  const { t } = useLanguage();

  const isQuotaExceeded = !!(subscriptionStatus?.billLimitReached && !subscriptionStatus?.isPaidActive);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  const now = new Date();
  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth();

  const [mainTab, setMainTab] = useState<'Report' | 'Summary'>('Report');
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [pendingList, setPendingList] = useState<PendingPaymentRecord[]>([]);

  // Registration date extraction: reports strictly start from the shop's registration month
  const regDate = useMemo(() => {
    if (shop?.createdAt) {
      const d = new Date(shop.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (bills.length > 0) {
      const validTimestamps = bills
        .map(b => (b.createdAt ? new Date(b.createdAt).getTime() : NaN))
        .filter(t => !isNaN(t));
      if (validTimestamps.length > 0) {
        return new Date(Math.min(...validTimestamps));
      }
    }
    return new Date();
  }, [shop?.createdAt, bills]);

  const rawRegYear = regDate.getFullYear();
  const rawRegMonth = regDate.getMonth();

  const startYear = Math.min(rawRegYear, maxYear);
  const startMonth = (rawRegYear > maxYear || (rawRegYear === maxYear && rawRegMonth > maxMonth)) ? maxMonth : rawRegMonth;

  const allowedYears = useMemo(() => {
    const list: number[] = [];
    for (let y = startYear; y <= maxYear; y++) {
      list.push(y);
    }
    return list;
  }, [startYear, maxYear]);

  const [repMonth, setRepMonth] = useState(maxMonth);
  const [repYear, setRepYear] = useState(maxYear);
  const [activeTab, setActiveTab] = useState<'Summary' | 'Day-wise'>('Summary');

  // Expandable sections in Report tab
  const [isTopItemsExpanded, setIsTopItemsExpanded] = useState(true);
  const [isProductGrowthExpanded, setIsProductGrowthExpanded] = useState(true);
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(true);
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);

  // Summary hierarchical drill-down state (Level 1: Year -> Level 2: Month -> Level 3: Datewise)
  const [summaryLevel, setSummaryLevel] = useState<1 | 2 | 3>(1);
  const [summaryYear, setSummaryYear] = useState<number>(maxYear);
  const [summaryMonth, setSummaryMonth] = useState<number>(maxMonth);

  useEffect(() => {
    loadData();
  }, [shop.id]);

  const loadData = async () => {
    if (!shop.id) return;
    const loadedBills = await billingService.getBills(shop.id);
    const loadedExpenses = await expenseService.getExpenses(shop.id);
    const loadedPending = await billingService.getPendingPayments(shop.id);
    setBills(loadedBills);
    setExpenses(loadedExpenses);
    setPendingList(loadedPending);
  };

  const reportData = reportService.getMonthlyReport(repYear, repMonth, bills, expenses);

  // Monthly Product Growth calculation
  const monthlyProductGrowth = useMemo(() => {
    const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
    bills.forEach(b => {
      if (!b.createdAt) return;
      if (b.isDeleted || b.status === 'deleted' || b.status === 'cancelled') return;
      const d = new Date(b.createdAt);
      if (d.getFullYear() === repYear && d.getMonth() === repMonth) {
        (b.items || []).forEach(item => {
          const key = item.menuItemId || item.itemName;
          const existing = productMap.get(key) || {
            name: item.itemName,
            quantity: 0,
            amount: 0,
          };
          existing.quantity += item.quantity;
          existing.amount += item.lineTotal || (item.unitPrice * item.quantity);
          productMap.set(key, existing);
        });
      }
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .map(p => ({
        name: p.name,
        qty: `${p.quantity} sold`,
        amt: formatRupee(p.amount),
        delta: `+${p.quantity}`,
      }));
  }, [bills, repYear, repMonth]);

  // Filtered expenses for selected month
  const monthlyExpensesList = useMemo(() => {
    return expenses.filter(e => {
      if (!e.expenseDate) return false;
      const d = new Date(e.expenseDate);
      return d.getFullYear() === repYear && d.getMonth() === repMonth;
    }).sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [expenses, repYear, repMonth]);

  const monthlyExpensesTotal = useMemo(() => {
    return monthlyExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [monthlyExpensesList]);

  // Total pending customer dues
  const totalPendingAmount = useMemo(() => {
    return pendingList.reduce((sum, p) => sum + (Number(p.amountDue) || 0), 0);
  }, [pendingList]);

  const handleSendReminder = (item: PendingPaymentRecord) => {
    const msg = whatsappService.formatPendingReminder(item, shop.name);
    whatsappService.shareViaWhatsApp(msg, item.customerPhone);
    flash(`Reminder sent to ${item.customerName}`);
  };

  const isOldestMonth = repYear === startYear && repMonth <= startMonth;
  const isLatestMonth = repYear === maxYear && repMonth >= maxMonth;

  const handlePrevMonth = () => {
    if (isOldestMonth) {
      flash(`Reports start from registration month (${MONTH_NAMES_SHORT[startMonth]} ${startYear})`);
      return;
    }
    if (repMonth === 0) {
      setRepMonth(11);
      setRepYear(prev => prev - 1);
    } else {
      setRepMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (isLatestMonth) {
      flash(`${MONTH_NAMES_SHORT[maxMonth]} ${maxYear} is the latest month`);
      return;
    }
    if (repMonth === 11) {
      setRepMonth(0);
      setRepYear(prev => prev + 1);
    } else {
      setRepMonth(prev => prev + 1);
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportPdf = async () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free tier limit of 100 bills. Upgrade to Pro to export PDF and Excel reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onNavigateToUpgrade },
        ]
      );
      return;
    }
    setIsExportingPdf(true);
    try {
      const res = await exportService.exportMonthlyReportPdf(reportData, shop);
      if (res.success) {
        flash(`${reportData.monthShort} PDF generated`);
      } else {
        flash(res.error || 'Failed to generate PDF');
      }
    } catch {
      flash('Error generating PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free tier limit of 100 bills. Upgrade to Pro to export PDF and Excel reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onNavigateToUpgrade },
        ]
      );
      return;
    }
    setIsExportingExcel(true);
    try {
      const res = await exportService.exportMonthlyReportExcel(reportData, shop);
      if (res.success) {
        flash(`${reportData.monthShort} Excel report saved`);
      } else {
        flash(res.error || 'Failed to generate Excel report');
      }
    } catch {
      flash('Error exporting Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free tier limit of 100 bills. Upgrade to Pro to share export reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onNavigateToUpgrade },
        ]
      );
      return;
    }
    const success = await exportService.shareMonthlyReportWhatsApp(reportData, shop, shop.phone);
    if (success) {
      flash(`${reportData.monthShort} report sent on WhatsApp`);
    } else {
      flash('Could not open WhatsApp');
    }
  };

  // Group bills by year and month
  const summaryHierarchy = useMemo<YearSummary[]>(() => {
    const validBills = bills.filter(
      b => !b.isDeleted && b.status !== 'deleted' && b.status !== 'cancelled'
    );
    const yearMap = new Map<number, Map<number, Bill[]>>();

    for (const bill of validBills) {
      if (!bill.createdAt) continue;
      const d = new Date(bill.createdAt);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();

      // Only include records from the shop's registration month onwards
      if (y < startYear || (y === startYear && m < startMonth)) continue;
      if (y > maxYear || (y === maxYear && m > maxMonth)) continue;

      if (!yearMap.has(y)) {
        yearMap.set(y, new Map<number, Bill[]>());
      }
      const mObj = yearMap.get(y)!;
      if (!mObj.has(m)) {
        mObj.set(m, []);
      }
      mObj.get(m)!.push(bill);
    }

    const yearsResult: YearSummary[] = [];
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYears) {
      const mObj = yearMap.get(y)!;
      const sortedMonths = Array.from(mObj.keys()).sort((a, b) => b - a);
      const monthsResult: MonthSummary[] = [];
      let yearTotal = 0;
      let yearCount = 0;

      for (const m of sortedMonths) {
        const monthBills = mObj.get(m)!.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const rep = reportService.getMonthlyReport(y, m, bills, expenses);
        const monthTotal = rep.totalSales;
        const count = rep.billsCount;
        yearTotal += monthTotal;
        yearCount += count;

        monthsResult.push({
          monthIndex: m,
          monthName: MONTH_NAMES[m],
          monthShort: MONTH_NAMES_SHORT[m],
          bills: monthBills,
          totalAmount: monthTotal,
          count,
        });
      }

      yearsResult.push({
        year: y,
        totalAmount: yearTotal,
        count: yearCount,
        months: monthsResult,
      });
    }

    return yearsResult;
  }, [bills, expenses]);

  // Keep selected year/month in sync with available hierarchy
  useEffect(() => {
    if (summaryHierarchy.length > 0) {
      const currentYearObj = summaryHierarchy.find(y => y.year === summaryYear);
      if (!currentYearObj) {
        setSummaryYear(summaryHierarchy[0].year);
        if (summaryHierarchy[0].months.length > 0) {
          setSummaryMonth(summaryHierarchy[0].months[0].monthIndex);
        }
      } else {
        const hasMonth = currentYearObj.months.some(m => m.monthIndex === summaryMonth);
        if (!hasMonth && currentYearObj.months.length > 0) {
          setSummaryMonth(currentYearObj.months[0].monthIndex);
        }
      }
    }
  }, [summaryHierarchy]);

  // Back button behavior: system back goes up one level in Summary (3 -> 2 -> 1) and only then leaves
  useEffect(() => {
    const onBackPress = () => {
      if (mainTab === 'Summary' && summaryLevel > 1) {
        setSummaryLevel(prev => (prev === 3 ? 2 : 1));
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [mainTab, summaryLevel]);

  const handleHeaderBack = () => {
    if (mainTab === 'Summary' && summaryLevel > 1) {
      setSummaryLevel(prev => (prev === 3 ? 2 : 1));
    } else {
      onBackToHome();
    }
  };

  const currentYearData = summaryHierarchy.find(y => y.year === summaryYear);
  const currentMonthData = currentYearData?.months.find(m => m.monthIndex === summaryMonth);
  const currentMonthBills = currentMonthData?.bills || [];
  const currentMonthTotal = currentMonthData?.totalAmount || 0;

  const selectedMonthReport = useMemo(() => {
    return reportService.getMonthlyReport(summaryYear, summaryMonth, bills, expenses);
  }, [summaryYear, summaryMonth, bills, expenses]);

  const selectedMonthSummary = useMemo(() => {
    const cashMode = selectedMonthReport.paymentModes.find(p => p.name === 'Cash');
    const upiMode = selectedMonthReport.paymentModes.find(
      p => p.name.includes('UPI') || p.name.includes('GPay')
    );

    return {
      totalSales: selectedMonthReport.totalSales,
      totalExpenses: selectedMonthReport.totalExpenses,
      profit: selectedMonthReport.profit,
      cashAmount: cashMode ? cashMode.amount : 0,
      upiAmount: upiMode ? upiMode.amount : 0,
      totalAmount: selectedMonthReport.totalSales,
      billsCount: selectedMonthReport.billsCount,
    };
  }, [selectedMonthReport]);

  const formatBillCount = (count: number) => `${count} ${count === 1 ? 'bill' : 'bills'}`;

  const formatBillDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const mShort = MONTH_NAMES_SHORT[d.getMonth()] || '';
    return `${mShort} ${d.getDate()}`;
  };

  // Date-wise grouping of bills for Level 3 drill-down
  const monthDateGroups = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      dateFormatted: string;
      dayNumber: number;
      bills: Bill[];
      totalAmount: number;
      items: { name: string; quantity: number; amount: number }[];
    }>();

    const itemsMapByDate = new Map<string, Map<string, { name: string; quantity: number; amount: number }>>();

    currentMonthBills.forEach(bill => {
      const d = bill.createdAt ? new Date(bill.createdAt) : new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayNumber = d.getDate();
      const monthShort = MONTH_NAMES_SHORT[d.getMonth()] || '';
      const dateFormatted = `${dayNumber} ${monthShort} ${d.getFullYear()}`;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          dateFormatted,
          dayNumber,
          bills: [],
          totalAmount: 0,
          items: [],
        });
        itemsMapByDate.set(dateKey, new Map());
      }

      const entry = map.get(dateKey)!;
      entry.bills.push(bill);
      entry.totalAmount += (bill.totalAmount || 0);

      // Aggregate all items sold on this date
      if (bill.items && Array.isArray(bill.items)) {
        const dateItems = itemsMapByDate.get(dateKey)!;
        bill.items.forEach(it => {
          const name = it.itemName || 'Item';
          const qty = it.quantity || 1;
          const amt = it.lineTotal || ((it.unitPrice || 0) * qty);
          const exist = dateItems.get(name);
          if (exist) {
            exist.quantity += qty;
            exist.amount += amt;
          } else {
            dateItems.set(name, { name, quantity: qty, amount: amt });
          }
        });
      }
    });

    map.forEach((entry, dateKey) => {
      const dateItems = itemsMapByDate.get(dateKey);
      if (dateItems) {
        entry.items = Array.from(dateItems.values()).sort((a, b) => b.quantity - a.quantity);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [currentMonthBills]);

  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);

  // Auto-expand the first/latest date when opening Level 3
  useEffect(() => {
    if (summaryLevel === 3 && monthDateGroups.length > 0) {
      setExpandedDateKey(prev => {
        if (prev && monthDateGroups.some(g => g.dateKey === prev)) return prev;
        return monthDateGroups[0]?.dateKey || null;
      });
    }
  }, [summaryLevel, monthDateGroups]);

  const handleExportPdfForMonth = async (year: number, month: number) => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free tier limit of 100 bills. Upgrade to Pro to export PDF and Excel reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onNavigateToUpgrade },
        ]
      );
      return;
    }
    setIsExportingPdf(true);
    try {
      const mReport = reportService.getMonthlyReport(year, month, bills, expenses);
      const res = await exportService.exportMonthlyReportPdf(mReport, shop);
      if (res.success) {
        flash(`${mReport.monthShort} PDF generated`);
      } else {
        flash(res.error || 'Failed to generate PDF');
      }
    } catch {
      flash('Error generating PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcelForMonth = async (year: number, month: number) => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free tier limit of 100 bills. Upgrade to Pro to export PDF and Excel reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onNavigateToUpgrade },
        ]
      );
      return;
    }
    setIsExportingExcel(true);
    try {
      const mReport = reportService.getMonthlyReport(year, month, bills, expenses);
      const res = await exportService.exportMonthlyReportExcel(mReport, shop);
      if (res.success) {
        flash(`${mReport.monthShort} Excel report saved`);
      } else {
        flash(res.error || 'Failed to generate Excel report');
      }
    } catch {
      flash('Error exporting Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleHeaderBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('monthly_reports', 'Monthly reports')}</Text>
        </View>

        {/* Top Segmented Tabs: Report vs Summary */}
        <SegmentedControl
          options={['Report', 'Summary']}
          selected={mainTab}
          onSelect={(tab) => {
            setMainTab(tab as any);
            if (tab === 'Summary') {
              setSummaryLevel(1);
            }
          }}
          renderLabel={opt => opt === 'Report' ? t('monthly_reports', 'Report') : t('summary', 'Summary')}
        />

        {mainTab === 'Summary' ? (
          /* SUMMARY TAB: Hierarchical Drill-down (Level 1 -> 2 -> 3) */
          <View style={styles.summaryTabContainer}>
            <Text style={styles.summarySubtitle}>Sales by year and month</Text>

            {/* Breadcrumb Navigation */}
            <View style={styles.breadcrumbRow}>
              {summaryLevel === 1 && (
                <Text style={styles.breadcrumbActive}>All years</Text>
              )}
              {summaryLevel === 2 && (
                <>
                  <TouchableOpacity onPress={() => setSummaryLevel(1)} activeOpacity={0.7}>
                    <Text style={styles.breadcrumbLink}>All years</Text>
                  </TouchableOpacity>
                  <Text style={styles.breadcrumbSep}>  ›  </Text>
                  <Text style={styles.breadcrumbActive}>{summaryYear}</Text>
                </>
              )}
              {summaryLevel === 3 && (
                <>
                  <TouchableOpacity onPress={() => setSummaryLevel(1)} activeOpacity={0.7}>
                    <Text style={styles.breadcrumbLink}>All years</Text>
                  </TouchableOpacity>
                  <Text style={styles.breadcrumbSep}>  ›  </Text>
                  <TouchableOpacity onPress={() => setSummaryLevel(2)} activeOpacity={0.7}>
                    <Text style={styles.breadcrumbLink}>{summaryYear}</Text>
                  </TouchableOpacity>
                  <Text style={styles.breadcrumbSep}>  ›  </Text>
                  <Text style={styles.breadcrumbActive}>{MONTH_NAMES[summaryMonth]}</Text>
                </>
              )}
            </View>

            {/* Heading Title */}
            <Text style={styles.summaryTitle}>
              {summaryLevel === 1 && 'All years'}
              {summaryLevel === 2 && `${summaryYear}`}
              {summaryLevel === 3 && `${MONTH_NAMES[summaryMonth]} ${summaryYear}`}
            </Text>

            {/* LEVEL 1: All years list */}
            {summaryLevel === 1 && (
              summaryHierarchy.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={44} color={colors.textMuted} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No sales yet</Text>
                  <Text style={styles.emptySubtitle}>Create a bill and it will appear here.</Text>
                </View>
              ) : (
                <View style={styles.summaryList}>
                  {summaryHierarchy.map(y => (
                    <TouchableOpacity
                      key={y.year}
                      style={styles.summaryRowCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSummaryYear(y.year);
                        if (y.months.length > 0) {
                          setSummaryMonth(y.months[0].monthIndex);
                        }
                        setSummaryLevel(2);
                      }}
                    >
                      <View style={styles.summaryRowLeft}>
                        <Text style={styles.summaryRowTitle}>{y.year}</Text>
                        <Text style={styles.summaryRowCount}>{formatBillCount(y.count)}</Text>
                      </View>
                      <View style={styles.summaryRowRight}>
                        <Text style={styles.summaryRowAmount}>{formatRupee(y.totalAmount)}</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {/* LEVEL 2: Months of selected year */}
            {summaryLevel === 2 && (
              (!currentYearData || currentYearData.months.length === 0) ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={44} color={colors.textMuted} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No sales yet</Text>
                  <Text style={styles.emptySubtitle}>Create a bill and it will appear here.</Text>
                </View>
              ) : (
                <View style={styles.summaryList}>
                  {currentYearData.months.map(m => (
                    <TouchableOpacity
                      key={m.monthIndex}
                      style={styles.summaryRowCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSummaryMonth(m.monthIndex);
                        setSummaryLevel(3);
                      }}
                    >
                      <View style={styles.summaryRowLeft}>
                        <Text style={styles.summaryRowTitle}>{m.monthName}</Text>
                        <Text style={styles.summaryRowCount}>{formatBillCount(m.count)}</Text>
                      </View>
                      <View style={styles.summaryRowRight}>
                        <Text style={styles.summaryRowAmount}>{formatRupee(m.totalAmount)}</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {/* LEVEL 3: Bills Table for selected month */}
            {summaryLevel === 3 && (
              currentMonthBills.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={44} color={colors.textMuted} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No sales yet</Text>
                  <Text style={styles.emptySubtitle}>Create a bill and it will appear here.</Text>
                </View>
              ) : (
                <>
                  {/* Monthly Summary Overview Card */}
                  <View style={styles.summaryOverviewCard}>
                    <View style={styles.summaryOverviewHeader}>
                      <View>
                        <Text style={styles.summaryOverviewKicker}>MONTHLY OVERVIEW</Text>
                        <Text style={styles.summaryOverviewTitle}>
                          {currentMonthData?.monthName} {summaryYear}
                        </Text>
                      </View>
                      <View style={[
                        styles.summaryProfitBadge,
                        selectedMonthSummary.profit >= 0 ? styles.profitBadgePositive : styles.profitBadgeNegative
                      ]}>
                        <Ionicons
                          name={selectedMonthSummary.profit >= 0 ? 'trending-up' : 'trending-down'}
                          size={14}
                          color={selectedMonthSummary.profit >= 0 ? '#16A34A' : '#DC2626'}
                        />
                        <Text style={[
                          styles.summaryProfitBadgeText,
                          selectedMonthSummary.profit >= 0 ? styles.profitTextPositive : styles.profitTextNegative
                        ]}>
                          {selectedMonthSummary.profit >= 0 ? 'Profit' : 'Loss'}
                        </Text>
                      </View>
                    </View>

                    {/* 3 Key Metrics: Total Sales, Expenses, Profit */}
                    <View style={styles.summaryKpiRow}>
                      <View style={styles.summaryKpiBox}>
                        <Text style={styles.summaryKpiLabel}>Total Sales</Text>
                        <Text style={styles.summaryKpiValue}>{formatRupee(selectedMonthSummary.totalSales)}</Text>
                        <Text style={styles.summaryKpiNote}>{formatBillCount(selectedMonthSummary.billsCount)}</Text>
                      </View>
                      <View style={styles.summaryKpiDivider} />
                      <View style={styles.summaryKpiBox}>
                        <Text style={styles.summaryKpiLabel}>Expenses</Text>
                        <Text style={[styles.summaryKpiValue, { color: '#DC2626' }]}>
                          {formatRupee(selectedMonthSummary.totalExpenses)}
                        </Text>
                        <Text style={styles.summaryKpiNote}>Total spent</Text>
                      </View>
                      <View style={styles.summaryKpiDivider} />
                      <View style={styles.summaryKpiBox}>
                        <Text style={styles.summaryKpiLabel}>Profit</Text>
                        <Text style={[
                          styles.summaryKpiValue,
                          { color: selectedMonthSummary.profit >= 0 ? '#16A34A' : '#DC2626' }
                        ]}>
                          {formatRupee(selectedMonthSummary.profit)}
                        </Text>
                        <Text style={styles.summaryKpiNote}>
                          {selectedMonthSummary.totalSales > 0
                            ? `${Math.round((selectedMonthSummary.profit / selectedMonthSummary.totalSales) * 100)}% margin`
                            : '0% margin'}
                        </Text>
                      </View>
                    </View>

                    {/* Payment Breakdown: UPI, Cash, Total */}
                    <View style={styles.summaryPaymentSection}>
                      <Text style={styles.summaryPaymentHeading}>{t('payment_modes', 'COLLECTIONS BY PAYMENT MODE')}</Text>
                      <View style={styles.summaryPaymentGrid}>
                        <View style={styles.summaryPaymentCard}>
                          <View style={styles.paymentCardHeader}>
                            <View style={[styles.paymentDot, { backgroundColor: '#10B981' }]} />
                            <Text style={styles.paymentCardLabel}>{t('cash', 'Cash')}</Text>
                          </View>
                          <Text style={styles.paymentCardValue}>{formatRupee(selectedMonthSummary.cashAmount)}</Text>
                        </View>

                        <View style={styles.summaryPaymentCard}>
                          <View style={styles.paymentCardHeader}>
                            <View style={[styles.paymentDot, { backgroundColor: '#0284C7' }]} />
                            <Text style={styles.paymentCardLabel}>{t('online_upi', 'UPI / GPay')}</Text>
                          </View>
                          <Text style={styles.paymentCardValue}>{formatRupee(selectedMonthSummary.upiAmount)}</Text>
                        </View>

                        <View style={[styles.summaryPaymentCard, styles.paymentCardTotal]}>
                          <View style={styles.paymentCardHeader}>
                            <View style={[styles.paymentDot, { backgroundColor: '#FF5F00' }]} />
                            <Text style={[styles.paymentCardLabel, { color: '#FF5F00', fontWeight: '700' }]}>{t('grand_total_label', 'Total')}</Text>
                          </View>
                          <Text style={[styles.paymentCardValue, { color: '#FF5F00', fontWeight: '800' }]}>
                            {formatRupee(selectedMonthSummary.totalAmount)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Date-Grouped Breakdown for selected month: Click a date to display all bill items on that date */}
                  <View style={styles.dateGroupsContainer}>
                    <View style={styles.dateGroupsHeaderRow}>
                      <Text style={styles.dateGroupsSectionTitle}>Dates & Items Sold</Text>
                      <Text style={styles.daysCountNote}>({monthDateGroups.length} {monthDateGroups.length === 1 ? 'date' : 'dates'})</Text>
                    </View>

                    {monthDateGroups.map(grp => {
                      const isExpanded = expandedDateKey === grp.dateKey;
                      return (
                        <View key={grp.dateKey} style={styles.dateGroupCard}>
                          {/* Clickable Date Row */}
                          <TouchableOpacity
                            style={[styles.dateGroupRow, isExpanded && styles.dateGroupRowActive]}
                            onPress={() => setExpandedDateKey(prev => (prev === grp.dateKey ? null : grp.dateKey))}
                            activeOpacity={0.75}
                          >
                            <View style={styles.dateGroupLeft}>
                              <View style={styles.dateIconCircle}>
                                <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                              </View>
                              <View>
                                <Text style={styles.dateGroupTitle}>{grp.dateFormatted}</Text>
                                <Text style={styles.dateGroupSub}>{formatBillCount(grp.bills.length)}</Text>
                              </View>
                            </View>

                            <View style={styles.dateGroupRight}>
                              <Text style={styles.dateGroupAmount}>{formatRupee(grp.totalAmount)}</Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={isExpanded ? colors.accent : colors.textMuted}
                              />
                            </View>
                          </TouchableOpacity>

                          {/* Expanded: Display all bill items present on that date */}
                          {isExpanded && (
                            <View style={styles.dateExpandedContent}>
                              {/* Items Table Header */}
                              <Text style={styles.dateItemsKicker}>
                                ALL BILL ITEMS ON {grp.dateFormatted.toUpperCase()}
                              </Text>

                              {grp.items.length > 0 ? (
                                <View style={styles.dateItemsTable}>
                                  <View style={styles.dateItemsTableHeader}>
                                    <Text style={[styles.dateItemTh, { flex: 1.6 }]}>Item</Text>
                                    <Text style={[styles.dateItemTh, { width: 55, textAlign: 'center' }]}>Qty</Text>
                                    <Text style={[styles.dateItemTh, { width: 75, textAlign: 'right' }]}>Amount</Text>
                                  </View>
                                  {grp.items.map((item, idx) => (
                                    <View key={item.name + idx} style={styles.dateItemTableRow}>
                                      <Text style={[styles.dateItemTdName, { flex: 1.6 }]} numberOfLines={1}>
                                        {item.name}
                                      </Text>
                                      <Text style={[styles.dateItemTdQty, { width: 55, textAlign: 'center' }]}>
                                        {item.quantity}
                                      </Text>
                                      <Text style={[styles.dateItemTdAmt, { width: 75, textAlign: 'right' }]}>
                                        {formatRupee(item.amount)}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.dateNoItemsText}>No item details found for this date.</Text>
                              )}

                              {/* Bills breakdown for this date */}
                              {grp.bills.length > 0 && (
                                <View style={styles.dateBillsSection}>
                                  <Text style={styles.dateBillsSectionHeading}>
                                    BILLS ({grp.bills.length})
                                  </Text>
                                  {grp.bills.map(b => {
                                    const itemsText = b.items && b.items.length > 0
                                      ? b.items.map(i => `${i.itemName} x${i.quantity}`).join(', ')
                                      : 'No items';
                                    return (
                                      <View key={b.id} style={styles.dateBillCard}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                          <Text style={styles.dateBillNumber}>
                                            Bill #{b.billNumber}
                                            {b.customerName ? ` • ${b.customerName}` : ''}
                                          </Text>
                                          <Text style={styles.dateBillItemsSummary} numberOfLines={2}>
                                            {itemsText}
                                          </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                                          <Text style={styles.dateBillPrice}>{formatRupee(b.totalAmount)}</Text>
                                          <Text style={styles.dateBillPayMode}>{b.paymentMode || 'Cash'}</Text>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Month Total Footer */}
                    <View style={styles.monthTotalFooterBox}>
                      <Text style={styles.monthTotalText}>Month total</Text>
                      <Text style={styles.monthTotalAmt}>{formatRupee(currentMonthTotal)}</Text>
                    </View>
                  </View>

                  {/* Side-by-Side Export Action Buttons */}
                  <View style={styles.summaryExportRow}>
                    <TouchableOpacity
                      style={styles.summaryExportBtn}
                      activeOpacity={0.8}
                      onPress={() => handleExportExcelForMonth(summaryYear, summaryMonth)}
                      disabled={isExportingExcel}
                    >
                      <View style={styles.excelIconBadge}>
                        <Ionicons name="stats-chart" size={16} color="#16A34A" />
                      </View>
                      <Text style={styles.summaryExportBtnText}>Excel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.summaryExportBtn}
                      activeOpacity={0.8}
                      onPress={() => handleExportPdfForMonth(summaryYear, summaryMonth)}
                      disabled={isExportingPdf}
                    >
                      <View style={styles.pdfIconBadge}>
                        <Ionicons name="document-text" size={16} color="#DC2626" />
                      </View>
                      <Text style={styles.summaryExportBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )
            )}
          </View>
        ) : (
          /* REPORT TAB: Overview & Analytics */
          <>
        {/* Month Selector Card */}
        <View style={styles.monthCard}>
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              disabled={isOldestMonth}
              style={[styles.navArrowBtn, isOldestMonth && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={isOldestMonth ? colors.textMuted : colors.text} />
            </TouchableOpacity>

            <View style={styles.monthTitleBox}>
              <Text style={styles.monthTitle}>{reportData.monthLabel}</Text>
              <Text style={styles.rangeSubtitle}>{reportData.rangeLabel}</Text>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              disabled={isLatestMonth}
              style={[styles.navArrowBtn, isLatestMonth && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={isLatestMonth ? colors.textMuted : colors.text} />
            </TouchableOpacity>
          </View>

          {/* Year Pills (Strictly limited to the shop's registration timeline) */}
          <View style={styles.yearsRow}>
            {allowedYears.map(y => {
              const isSelected = y === repYear;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setRepYear(y);
                    if (y === startYear && repMonth < startMonth) {
                      setRepMonth(startMonth);
                    } else if (y === maxYear && repMonth > maxMonth) {
                      setRepMonth(maxMonth);
                    }
                  }}
                  style={[
                    styles.yearPill,
                    isSelected && styles.yearPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.yearPillText,
                      isSelected && styles.yearPillTextSelected,
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Profit Header */}
          <View style={styles.profitRow}>
            <View>
              <Text style={styles.profitKicker}>PROFIT</Text>
              <Text style={styles.profitNote}>total sale − total expense</Text>
            </View>
            <Text style={styles.profitTotalValue}>{formatRupee(reportData.profit)}</Text>
          </View>
        </View>

        {/* Segmented Tabs */}
        <SegmentedControl
          options={['Summary', 'Day-wise']}
          selected={activeTab}
          onSelect={setActiveTab}
        />

        {/* TAB 1: Summary View */}
        {activeTab === 'Summary' && (
          <View style={styles.tabContent}>
            {/* 4 KPIs */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiKicker}>TOTAL SALE</Text>
                <Text style={styles.kpiValue}>{formatRupee(reportData.totalSales)}</Text>
                <Text style={styles.kpiNote}>{reportData.billsCount} bills</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiKicker}>TOTAL EXPENSE</Text>
                <Text style={styles.kpiValue}>{formatRupee(reportData.totalExpenses)}</Text>
                <Text style={styles.kpiNote}>
                  {Math.round((reportData.totalExpenses / (reportData.totalSales || 1)) * 100)}% of sale
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiKicker}>PROFIT</Text>
                <Text style={[styles.kpiValue, styles.profitAccentText]}>
                  {formatRupee(reportData.profit)}
                </Text>
                <Text style={styles.kpiNote}>{reportData.profitMarginPct}% margin</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiKicker}>BEST DAY</Text>
                <Text style={styles.kpiValue}>
                  {reportData.monthShort} {reportData.bestDay.day}
                </Text>
                <Text style={styles.kpiNote}>{formatRupee(reportData.bestDay.profit)} profit</Text>
              </View>
            </View>

            {/* Sale vs Expense by Week */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Sale vs expense — by week</Text>
              <View style={styles.weeksList}>
                {reportData.weeks.map((w, idx) => (
                  <View key={idx} style={styles.weekItem}>
                    <View style={styles.weekInfoRow}>
                      <Text style={styles.weekName}>{w.name}</Text>
                      <Text style={styles.weekDetail}>{w.detail}</Text>
                      <Text style={styles.weekProfit}>{formatRupee(w.profit)}</Text>
                    </View>
                    <View style={styles.weekBarTrack}>
                      <View style={[styles.weekSaleFill, { width: w.salePct as any }]} />
                      <View style={[styles.weekExpFill, { width: w.expPct as any }]} />
                    </View>
                  </View>
                ))}
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent900 }]} />
                  <Text style={styles.legendText}>Sale</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent300 }]} />
                  <Text style={styles.legendText}>Expense</Text>
                </View>
              </View>
            </View>

            {/* Payment Modes */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Payment modes</Text>
              <View style={styles.modesList}>
                {reportData.paymentModes.map((m, idx) => (
                  <View key={idx} style={styles.modeRow}>
                    <View style={styles.modeLabelWrap}>
                      <PaymentModeIcon mode={m.name} size={15} color={m.color} />
                      <Text style={styles.modeName}>{m.name}</Text>
                    </View>
                    <View style={styles.modeTrack}>
                      <View style={[styles.modeFill, { width: m.pct as any, backgroundColor: m.color }]} />
                    </View>
                    <Text style={styles.modeAmt}>{formatRupee(m.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: Day-Wise View */}
        {activeTab === 'Day-wise' && (
          <View style={styles.card}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.cardHeading}>Day-wise — {reportData.monthShort}</Text>
              <Text style={styles.daysCountNote}>
                {reportData.days.length} {reportData.days.length === 1 ? 'day' : 'days'}
              </Text>
            </View>

            <View style={styles.dayTable}>
              <View style={styles.dayTableHead}>
                <Text style={[styles.thCell, { flex: 1.2 }]}>Day</Text>
                <Text style={[styles.thCell, styles.alignRight]}>Sale</Text>
                <Text style={[styles.thCell, styles.alignRight]}>Expense</Text>
                <Text style={[styles.thCell, styles.alignRight]}>Profit</Text>
              </View>

              {reportData.days.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.dayTableRow,
                    d.isWeekend && styles.weekendRow,
                  ]}
                >
                  <Text style={[styles.tdCell, { flex: 1.2 }]}>
                    {d.dateFormatted}{' '}
                    <Text style={styles.dowText}>{d.dayOfWeek}</Text>
                  </Text>
                  <Text style={[styles.tdCellBold, styles.alignRight]}>{formatRupee(d.sales)}</Text>
                  <Text style={[styles.tdCellMuted, styles.alignRight]}>{formatRupee(d.expenses)}</Text>
                  <Text style={[styles.tdCellProfit, styles.alignRight]}>{formatRupee(d.profit)}</Text>
                </View>
              ))}

              {/* Total Footer Row */}
              <View style={styles.dayTableFoot}>
                <Text style={[styles.thCell, { flex: 1.2, letterSpacing: 0.6 }]}>TOTAL</Text>
                <Text style={[styles.tdCellBold, styles.alignRight]}>{formatRupee(reportData.totalSales)}</Text>
                <Text style={[styles.tdCellBold, styles.alignRight]}>{formatRupee(reportData.totalExpenses)}</Text>
                <Text style={[styles.tdCellProfit, styles.alignRight, { fontSize: typography.sizes.md }]}>
                  {formatRupee(reportData.profit)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Top selling products */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardHeading}>Top selling products</Text>
              {reportData.topItems.length > 0 && (
                <Text style={styles.daysCountNote}>({reportData.topItems.length} items)</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setIsTopItemsExpanded(prev => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isTopItemsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          {isTopItemsExpanded && (
            <View style={styles.topItemsList}>
              {reportData.topItems.length > 0 ? (
                reportData.topItems.map((item, idx) => (
                  <View key={item.name + idx} style={styles.topItemRow}>
                    <Text style={[styles.rankNum, idx < 3 && { color: colors.accent, fontWeight: '700' }]}>
                      {item.rank}
                    </Text>
                    <View style={styles.topItemInfo}>
                      <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.topItemProgressTrack}>
                        <View
                          style={[
                            styles.topItemProgressFill,
                            {
                              width: (item.pct as `${number}%`) || '0%',
                              backgroundColor: idx === 0 ? '#10B981' : colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.topItemQty}>{item.quantity} sold</Text>
                    <Text style={styles.topItemAmt}>{formatRupee(item.amount)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainerSmall}>
                  <Text style={styles.emptySmallText}>No items billed yet in {reportData.monthShort}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Product Growth List */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardHeading}>Product growth</Text>
              {monthlyProductGrowth.length > 0 && (
                <Text style={styles.daysCountNote}>({monthlyProductGrowth.length} items)</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setIsProductGrowthExpanded(prev => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isProductGrowthExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          {isProductGrowthExpanded && (
            <View style={styles.reportProductList}>
              {monthlyProductGrowth.length > 0 ? (
                monthlyProductGrowth.map((p, i) => (
                  <View key={i} style={styles.reportProductRow}>
                    <Text style={styles.reportProductName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.reportProductQty}>{p.qty}</Text>
                    <Text style={styles.reportProductAmt}>{p.amt}</Text>
                    <AppTag
                      label={p.delta}
                      variant="accent"
                      style={styles.reportDeltaTag}
                    />
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainerSmall}>
                  <Text style={styles.emptySmallText}>No items billed yet in {reportData.monthShort}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Expenses for Month */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardHeading}>Monthly expenses</Text>
              {monthlyExpensesTotal > 0 && (
                <Text style={styles.daysCountNote}>({formatRupee(monthlyExpensesTotal)})</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setIsExpensesExpanded(prev => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isExpensesExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          {isExpensesExpanded && (
            <View style={styles.reportExpensesList}>
              {monthlyExpensesList.length > 0 ? (
                monthlyExpensesList.map((e, idx) => (
                  <View key={e.id || idx} style={styles.reportExpenseRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.reportExpenseDesc} numberOfLines={1}>
                        {e.description || 'Expense'}
                      </Text>
                      <Text style={styles.reportExpenseDate}>
                        {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                      </Text>
                    </View>
                    <Text style={styles.reportExpenseAmt}>{formatRupee(e.amount)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainerSmall}>
                  <Text style={styles.emptySmallText}>No expenses recorded in {reportData.monthShort}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Pending Customer Dues */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardHeading}>Pending dues</Text>
              {totalPendingAmount > 0 && (
                <Text style={styles.daysCountNote}>({formatRupee(totalPendingAmount)})</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setIsPendingExpanded(prev => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isPendingExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          {isPendingExpanded && (
            <View style={styles.reportPendingList}>
              {pendingList.length > 0 ? (
                pendingList.map(item => (
                  <View key={item.id} style={styles.reportPendingRow}>
                    <View style={styles.reportPendingAvatar}>
                      <Text style={styles.reportPendingAvatarText}>
                        {item.customerName ? item.customerName.charAt(0).toUpperCase() : '?'}
                      </Text>
                    </View>
                    <View style={styles.reportPendingInfo}>
                      <Text style={styles.reportPendingName} numberOfLines={1}>
                        {item.customerName}
                      </Text>
                      <Text style={styles.reportPendingSub} numberOfLines={1}>
                        {item.customerPhone ? `+91 ${item.customerPhone}` : 'No phone'} • {item.ageDescription}
                      </Text>
                    </View>
                    <Text style={styles.reportPendingAmt}>{formatRupee(item.amountDue)}</Text>
                    <TouchableOpacity
                      style={styles.reportRemindBtn}
                      onPress={() => handleSendReminder(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="Remind on WhatsApp"
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainerSmall}>
                  <Text style={styles.emptySmallText}>No pending customer dues</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Export Card */}
        <View style={styles.card}>
          <View style={styles.exportHeaderRow}>
            <Text style={styles.cardHeading}>Download Report ({reportData.monthShort})</Text>
          </View>
          <Text style={styles.exportNote}>
            Summary, day-wise table and top items — {reportData.days.length} days of verified financial records
          </Text>

          {isQuotaExceeded && (
            <View style={styles.quotaWarningBox}>
              <Ionicons name="lock-closed" size={16} color="#EA580C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.quotaWarningTitle}>Free Plan 100-Bill Quota Reached</Text>
                <Text style={styles.quotaWarningText}>
                  Reports viewing is free, but PDF/Excel exports require an active Pro subscription.
                </Text>
              </View>
              {onNavigateToUpgrade && (
                <TouchableOpacity onPress={onNavigateToUpgrade} style={styles.upgradeInlineBtn} activeOpacity={0.8}>
                  <Text style={styles.upgradeInlineBtnText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={() => setIsPreviewModalVisible(true)}
            style={styles.previewReportBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.previewReportBtnText}>Preview Report Before Export</Text>
          </TouchableOpacity>

          <View style={styles.exportBtnRow}>
            <TouchableOpacity
              onPress={handleExportPdf}
              disabled={isExportingPdf}
              style={[styles.exportActionBtn, styles.pdfBtn, isQuotaExceeded && styles.disabledActionBtn]}
              activeOpacity={0.8}
            >
              {isExportingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.pdfBtnText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExportExcel}
              disabled={isExportingExcel}
              style={[styles.exportActionBtn, styles.xlsBtn, isQuotaExceeded && styles.disabledActionBtn]}
              activeOpacity={0.8}
            >
              {isExportingExcel ? (
                <ActivityIndicator size="small" color={colors.accent900} />
              ) : (
                <>
                  <Ionicons name="stats-chart-outline" size={16} color={colors.accent900} style={{ marginRight: 6 }} />
                  <Text style={styles.xlsBtnText}>Download Excel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <AppButton
            title="Send on WhatsApp instead"
            variant="ghost"
            onPress={handleShareWhatsApp}
            style={styles.waExportBtn}
          />
        </View>
          </>
        )}
      </ScrollView>

      {/* Report Preview Modal */}
      <ReportPreviewModal
        visible={isPreviewModalVisible}
        onClose={() => setIsPreviewModalVisible(false)}
        reportData={reportData}
        shop={shop}
        isExportingPdf={isExportingPdf}
        isExportingExcel={isExportingExcel}
        onConfirmPdf={() => {
          setIsPreviewModalVisible(false);
          handleExportPdf();
        }}
        onConfirmExcel={() => {
          setIsPreviewModalVisible(false);
          handleExportExcel();
        }}
        onShareWhatsApp={() => {
          setIsPreviewModalVisible(false);
          handleShareWhatsApp();
        }}
        isQuotaExceeded={isQuotaExceeded}
        onUpgradePress={onNavigateToUpgrade}
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
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: Math.max(bottomInset, 20) + 120,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.card,
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      color: colors.text,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    monthCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    monthNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navArrowBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FAF7F2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledBtn: {
      opacity: 0.4,
    },
    monthTitleBox: {
      alignItems: 'center',
    },
    monthTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      color: colors.text,
      fontWeight: '800',
    },
    rangeSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    yearsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    yearPill: {
      minHeight: 28,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FAF7F2',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    yearPillSelected: {
      backgroundColor: theme.isDark ? colors.accent : '#111111',
      borderColor: theme.isDark ? colors.accent : '#111111',
    },
    yearPillText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    yearPillTextSelected: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    profitRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    profitKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 9.5,
      letterSpacing: 0.8,
      color: colors.textMuted,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    profitNote: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    profitTotalValue: {
      marginLeft: 'auto',
      fontFamily: typography.fonts.heading,
      fontSize: 22,
      lineHeight: 26,
      color: colors.accent,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    tabContent: {
      gap: 14,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    kpiCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      gap: 3,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    kpiKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 9.5,
      letterSpacing: 0.8,
      color: colors.textMuted,
      fontWeight: '700',
    },
    kpiValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      lineHeight: 24,
      color: colors.text,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    profitAccentText: {
      color: colors.accent,
    },
    kpiNote: {
      fontSize: 11.5,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    cardHeading: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      color: colors.text,
      fontWeight: '800',
    },
    weeksList: {
      gap: 11,
      marginTop: 6,
    },
    weekItem: {
      gap: 5,
    },
    weekInfoRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    weekName: {
      fontSize: typography.sizes.body,
      color: colors.text,
      fontFamily: typography.fonts.body,
    },
    weekDetail: {
      marginLeft: 'auto',
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    weekProfit: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.accent,
      marginLeft: 8,
    },
    weekBarTrack: {
      flexDirection: 'row',
      gap: 3,
      height: 9,
      backgroundColor: theme.isDark ? colors.surfaceElevated : 'rgba(29, 31, 32, 0.07)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    weekSaleFill: {
      backgroundColor: theme.isDark ? '#E55300' : colors.accent900,
      borderRadius: 2,
      height: '100%',
    },
    weekExpFill: {
      backgroundColor: theme.isDark ? '#8A3600' : colors.accent300,
      borderRadius: 2,
      height: '100%',
    },
    legendRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    legendText: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    modesList: {
      gap: 9,
      marginTop: 6,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modeLabelWrap: {
      width: 95,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    modeName: {
      flex: 1,
      fontSize: typography.sizes.body,
      color: colors.text,
      fontFamily: typography.fonts.body,
    },
    modeTrack: {
      flex: 1,
      height: 14,
      backgroundColor: theme.isDark ? colors.surfaceElevated : 'rgba(29, 31, 32, 0.07)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    modeFill: {
      height: '100%',
      borderRadius: 2,
    },
    modeAmt: {
      width: 70,
      textAlign: 'right',
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    daysCountNote: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    dayTable: {
      marginTop: 8,
    },
    dayTableHead: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
    },
    thCell: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
    },
    alignRight: {
      textAlign: 'right',
    },
    dayTableRow: {
      flexDirection: 'row',
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekendRow: {
      backgroundColor: theme.isDark ? 'rgba(22, 163, 74, 0.12)' : 'rgba(22, 163, 74, 0.06)',
    },
    tdCell: {
      flex: 1,
      fontSize: typography.sizes.body,
      color: colors.text,
      fontFamily: typography.fonts.body,
    },
    dowText: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
    },
    tdCellBold: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    tdCellMuted: {
      flex: 1,
      fontSize: typography.sizes.body,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    tdCellProfit: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.accent,
    },
    dayTableFoot: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    topItemsList: {
      marginTop: 6,
    },
    topItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rankNum: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sub,
      color: colors.textMuted,
      width: 22,
    },
    topItemInfo: {
      flex: 1,
      minWidth: 0,
    },
    topItemName: {
      fontSize: typography.sizes.base,
      color: colors.text,
      fontFamily: typography.fonts.body,
    },
    topItemProgressTrack: {
      height: 5,
      backgroundColor: theme.isDark ? colors.surfaceElevated : 'rgba(29, 31, 32, 0.07)',
      borderRadius: 2,
      marginTop: 4,
      overflow: 'hidden',
    },
    topItemProgressFill: {
      height: '100%',
      borderRadius: 2,
    },
    topItemQty: {
      minWidth: 58,
      textAlign: 'right',
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    topItemAmt: {
      minWidth: 68,
      textAlign: 'right',
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    exportNote: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    exportHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    realDataBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.isDark ? '#06281E' : '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: theme.isDark ? '#0E5C44' : '#A7F3D0',
    },
    realDataBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.isDark ? '#34D399' : '#059669',
      fontFamily: typography.fonts.heading,
    },
    exportBtnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
      width: '100%',
    },
    exportActionBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    pdfBtn: {
      backgroundColor: colors.accent,
      ...shadows.sm,
    },
    pdfBtnText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '800',
    },
    xlsBtn: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    xlsBtnText: {
      color: colors.text,
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
    },
    waExportBtn: {
      minHeight: 48,
      borderRadius: 16,
    },
    quotaWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? '#431407' : '#FFF7ED',
      borderWidth: 1,
      borderColor: theme.isDark ? '#7C2D12' : '#FED7AA',
      borderRadius: 14,
      padding: 12,
      gap: 10,
      marginTop: 4,
    },
    quotaWarningTitle: {
      fontSize: 12,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: theme.isDark ? '#FDBA74' : '#C2410C',
    },
    quotaWarningText: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: theme.isDark ? '#FED7AA' : '#9A3412',
      lineHeight: 15,
      marginTop: 2,
    },
    upgradeInlineBtn: {
      backgroundColor: '#EA580C',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    upgradeInlineBtnText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
    },
    previewReportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      marginTop: 6,
    },
    previewReportBtnText: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.accent,
    },
    disabledActionBtn: {
      opacity: 0.65,
    },
    summaryTabContainer: {
      gap: 12,
      marginTop: 4,
    },
    summarySubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginBottom: 2,
    },
    breadcrumbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 4,
    },
    breadcrumbLink: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: '#FF5F00',
    },
    breadcrumbSep: {
      fontSize: 14,
      color: colors.textMuted,
      marginHorizontal: 2,
    },
    breadcrumbActive: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    summaryTitle: {
      fontSize: 22,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    summaryList: {
      gap: 10,
    },
    summaryRowCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    summaryRowLeft: {
      gap: 2,
    },
    summaryRowTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    summaryRowCount: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: colors.textMuted,
    },
    summaryRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    summaryRowAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    summaryOverviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
      marginBottom: 12,
    },
    summaryOverviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    summaryOverviewKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    summaryOverviewTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    summaryProfitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    profitBadgePositive: {
      backgroundColor: theme.isDark ? '#064E3B' : '#DCFCE7',
    },
    profitBadgeNegative: {
      backgroundColor: theme.isDark ? '#7F1D1D' : '#FEE2E2',
    },
    summaryProfitBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
    },
    profitTextPositive: {
      color: '#16A34A',
    },
    profitTextNegative: {
      color: '#DC2626',
    },
    summaryKpiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    summaryKpiBox: {
      flex: 1,
      alignItems: 'center',
    },
    summaryKpiDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.borderLight,
    },
    summaryKpiLabel: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: colors.textMuted,
      marginBottom: 3,
    },
    summaryKpiValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    summaryKpiNote: {
      fontFamily: typography.fonts.body,
      fontSize: 10.5,
      color: colors.textMuted,
      marginTop: 2,
    },
    summaryPaymentSection: {
      paddingTop: 12,
    },
    summaryPaymentHeading: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    summaryPaymentGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryPaymentCard: {
      flex: 1,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#F9FAFB',
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    paymentCardTotal: {
      backgroundColor: theme.isDark ? '#2A170A' : '#FFF7ED',
      borderColor: theme.isDark ? '#4A2810' : '#FFEDD5',
    },
    paymentCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 4,
    },
    paymentDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    paymentCardLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    paymentCardValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    /* Date-Grouped Drill-down Styles for Level 3 */
    dateGroupsContainer: {
      gap: 10,
    },
    dateGroupsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    dateGroupsSectionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateGroupCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.card,
    },
    dateGroupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dateGroupRowActive: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FFF9F5',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateGroupLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dateIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateGroupTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    dateGroupSub: {
      fontSize: 11.5,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    dateGroupRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateGroupAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    dateExpandedContent: {
      padding: 12,
      backgroundColor: theme.isDark ? colors.surface : '#FAFAFA',
      gap: 10,
    },
    dateItemsKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '800',
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    dateItemsTable: {
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    dateItemsTableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#F5F3F0',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateItemTh: {
      fontFamily: typography.fonts.heading,
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    dateItemTableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateItemTdName: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: colors.text,
      fontWeight: '500',
    },
    dateItemTdQty: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      color: colors.text,
      fontWeight: '700',
    },
    dateItemTdAmt: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
      color: colors.text,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    dateNoItemsText: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      fontStyle: 'italic',
      paddingVertical: 6,
    },
    dateBillsSection: {
      marginTop: 4,
      gap: 6,
    },
    dateBillsSectionHeading: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    dateBillCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 9,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateBillNumber: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    dateBillItemsSummary: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 2,
    },
    dateBillPrice: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    dateBillPayMode: {
      fontSize: 9.5,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.accent,
      textTransform: 'uppercase',
      marginTop: 1,
    },
    monthTotalFooterBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
      ...shadows.card,
    },
    monthTotalText: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    monthTotalAmt: {
      fontFamily: typography.fonts.heading,
      fontSize: 17,
      fontWeight: '800',
      color: '#FF5F00',
    },
    monthTableCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    monthTableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mThCell: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    mColDate: {
      width: 48,
    },
    mColName: {
      flex: 1.2,
      minWidth: 50,
      paddingRight: 6,
    },
    mColItems: {
      flex: 1.4,
      minWidth: 60,
      paddingRight: 6,
    },
    mColAmount: {
      minWidth: 60,
      flexShrink: 0,
    },
    monthTableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mTdCell: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: colors.text,
    },
    mTdCellBold: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    mTdCellMuted: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: colors.textMuted,
    },
    mTdCellAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
    },
    monthTableFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 14,
      marginTop: 2,
    },
    summaryExportRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    summaryExportBtn: {
      flex: 1,
      height: 50,
      backgroundColor: colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    excelIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.isDark ? '#064E3B' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pdfIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.isDark ? '#7F1D1D' : '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryExportBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    emptyContainer: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
      marginTop: 8,
    },
    emptyIcon: {
      marginBottom: 10,
      opacity: 0.6,
    },
    emptyTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // ─── Report Tab Additions ────────────────────────────────────────────────
    reportProductList: {
      marginTop: 6,
      gap: 2,
    },
    reportProductRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: 10,
    },
    reportProductName: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.text,
    },
    reportProductQty: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textMuted,
    },
    reportProductAmt: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    reportDeltaTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
    },

    reportExpensesList: {
      marginTop: 6,
    },
    reportExpenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    reportExpenseDesc: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.text,
    },
    reportExpenseDate: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: colors.textMuted,
      marginTop: 2,
    },
    reportExpenseAmt: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: '#DC2626',
      fontVariant: ['tabular-nums'],
    },

    reportPendingList: {
      marginTop: 6,
      gap: 8,
    },
    reportPendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: 10,
    },
    reportPendingAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? '#3A2111' : '#FFF0E6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportPendingAvatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '800',
      color: '#FF5F00',
    },
    reportPendingInfo: {
      flex: 1,
    },
    reportPendingName: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
    },
    reportPendingSub: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: colors.textMuted,
      marginTop: 1,
    },
    reportPendingAmt: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '800',
      color: '#EA580C',
      fontVariant: ['tabular-nums'],
    },
    reportRemindBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.isDark ? '#064E3B' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyContainerSmall: {
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptySmallText: {
      fontFamily: typography.fonts.body,
      fontSize: 12.5,
      color: colors.textMuted,
    },
  });
};
