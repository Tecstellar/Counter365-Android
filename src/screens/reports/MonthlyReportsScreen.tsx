import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { PaymentModeIcon } from '../../components/common/PaymentModeIcon';
import { ReportPreviewModal } from '../../components/modals/ReportPreviewModal';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { reportService } from '../../services/reportService';
import { billingService } from '../../services/billingService';
import { expenseService } from '../../services/expenseService';
import { exportService } from '../../services/exportService';
import { Bill, ExpenseRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface MonthlyReportsScreenProps {
  onBackToHome: () => void;
  onNavigateToUpgrade?: () => void;
}

export const MonthlyReportsScreen: React.FC<MonthlyReportsScreenProps> = ({
  onBackToHome,
  onNavigateToUpgrade,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { shop, subscriptionStatus } = useShop();
  const { flash } = useCart();

  const isQuotaExceeded = !!(subscriptionStatus?.billLimitReached && !subscriptionStatus?.isPaidActive);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  const now = new Date();
  const [repMonth, setRepMonth] = useState(now.getMonth());
  const [repYear, setRepYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'Summary' | 'Day-wise'>('Summary');
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  useEffect(() => {
    loadData();
  }, [shop.id]);

  const loadData = async () => {
    if (!shop.id) return;
    const loadedBills = await billingService.getBills(shop.id);
    const loadedExpenses = await expenseService.getExpenses(shop.id);
    setBills(loadedBills);
    setExpenses(loadedExpenses);
  };

  const reportData = reportService.getMonthlyReport(repYear, repMonth, bills, expenses);

  const handlePrevMonth = () => {
    if (repMonth === 0) {
      setRepMonth(11);
      setRepYear(prev => prev - 1);
    } else {
      setRepMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (repYear === 2026 && repMonth === 8) {
      flash('September is the latest month');
      return;
    }
    if (repMonth === 11) {
      setRepMonth(0);
      setRepYear(prev => prev + 1);
    } else {
      setRepMonth(prev => prev + 1);
    }
  };

  const isCurrentMonth = repYear === 2026 && repMonth === 8;

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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBackToHome} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Monthly reports</Text>
        </View>

        {/* Month Selector Card */}
        <View style={styles.monthCard}>
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.monthTitleBox}>
              <Text style={styles.monthTitle}>{reportData.monthLabel}</Text>
              <Text style={styles.rangeSubtitle}>{reportData.rangeLabel}</Text>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              disabled={isCurrentMonth}
              style={[styles.navArrowBtn, isCurrentMonth && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? colors.textMuted : colors.text} />
            </TouchableOpacity>
          </View>

          {/* Year Pills */}
          <View style={styles.yearsRow}>
            {[2024, 2025, 2026].map(y => {
              const isSelected = y === repYear;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => setRepYear(y)}
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

        {/* Top 10 Sale Items */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.cardHeading}>Top 10 sale items</Text>
            <Text style={styles.daysCountNote}>{reportData.monthShort}</Text>
          </View>

          <View style={styles.topItemsList}>
            {reportData.topItems.map(item => (
              <View key={item.rank} style={styles.topItemRow}>
                <Text style={styles.rankNum}>{item.rank}</Text>
                <View style={styles.topItemInfo}>
                  <Text style={styles.topItemName}>{item.name}</Text>
                  <View style={styles.topItemProgressTrack}>
                    <View
                      style={[
                        styles.topItemProgressFill,
                        {
                          width: item.pct as any,
                          backgroundColor: item.rank === 1 ? colors.accent900 : colors.accent700,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.topItemQty}>{item.quantity.toLocaleString('en-IN')} pcs</Text>
                <Text style={styles.topItemAmt}>{formatRupee(item.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Export Card */}
        <View style={styles.card}>
          <View style={styles.exportHeaderRow}>
            <Text style={styles.cardHeading}>Download Report ({reportData.monthShort})</Text>
            <View style={styles.realDataBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#059669" />
              <Text style={styles.realDataBadgeText}>Live Data</Text>
            </View>
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

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
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
      borderRadius: 20,
      padding: 18,
      gap: 14,
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
      width: 38,
      height: 38,
      borderRadius: 12,
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
      fontSize: 18,
      color: colors.text,
      fontWeight: '800',
    },
    rangeSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 2,
    },
    yearsRow: {
      flexDirection: 'row',
      gap: 7,
    },
    yearPill: {
      minHeight: 34,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FAF7F2',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    yearPillSelected: {
      backgroundColor: theme.isDark ? colors.accent : '#111111',
      borderColor: theme.isDark ? colors.accent : '#111111',
    },
    yearPillText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12.5,
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
      paddingTop: 12,
    },
    profitKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      letterSpacing: 1.0,
      color: colors.textMuted,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    profitNote: {
      fontSize: 11.5,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    profitTotalValue: {
      marginLeft: 'auto',
      fontFamily: typography.fonts.heading,
      fontSize: 30,
      lineHeight: 34,
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
      width: 16,
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
      width: 52,
      textAlign: 'right',
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    topItemAmt: {
      width: 60,
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
  });
};
