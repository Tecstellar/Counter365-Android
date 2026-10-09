import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MonthlyReportData, Shop } from '../../types/models';
import { formatRupee } from '../../lib/money';
import { useTheme, Theme, typography } from '../../theme';

interface ReportPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  reportData: MonthlyReportData;
  shop: Shop;
  isExportingPdf: boolean;
  isExportingExcel: boolean;
  onConfirmPdf: () => void;
  onConfirmExcel: () => void;
  onShareWhatsApp: () => void;
  isQuotaExceeded: boolean;
  onUpgradePress?: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  visible,
  onClose,
  reportData,
  shop,
  isExportingPdf,
  isExportingExcel,
  onConfirmPdf,
  onConfirmExcel,
  onShareWhatsApp,
  isQuotaExceeded,
  onUpgradePress,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handlePdfClick = () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free limit of 100 lifetime bills. Please upgrade to Pro to download and export reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onUpgradePress },
        ]
      );
      return;
    }
    onConfirmPdf();
  };

  const handleExcelClick = () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free limit of 100 lifetime bills. Please upgrade to Pro to download and export reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onUpgradePress },
        ]
      );
      return;
    }
    onConfirmExcel();
  };

  const handleWhatsAppClick = () => {
    if (isQuotaExceeded) {
      Alert.alert(
        'Quota Reached (100 Bills)',
        'You have reached the free limit of 100 lifetime bills. Please upgrade to Pro to share export reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: onUpgradePress },
        ]
      );
      return;
    }
    onShareWhatsApp();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <View style={styles.tagBadge}>
                <Ionicons name="document-text" size={12} color={theme.colors.accent} />
                <Text style={styles.tagBadgeText}>REPORT PREVIEW</Text>
              </View>
              <Text style={styles.title}>{reportData.monthLabel}</Text>
              <Text style={styles.subtitle}>{shop.name || 'CounterPro Store'} • {reportData.rangeLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quota Exceeded Non-Intrusive Banner */}
          {isQuotaExceeded && (
            <View style={styles.quotaBanner}>
              <Ionicons name="lock-closed" size={18} color="#EA580C" />
              <View style={styles.quotaTextWrap}>
                <Text style={styles.quotaTitle}>Free Plan 100-Bill Quota Reached</Text>
                <Text style={styles.quotaSubtitle}>
                  Report viewing is free, but PDF/Excel exports require an active Pro subscription.
                </Text>
              </View>
              {onUpgradePress && (
                <TouchableOpacity onPress={onUpgradePress} style={styles.upgradeMiniBtn} activeOpacity={0.8}>
                  <Text style={styles.upgradeMiniBtnText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content Preview */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Key Financial Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TOTAL SALES</Text>
                <Text style={[styles.metricValue, { color: '#16A34A' }]}>
                  {formatRupee(reportData.totalSales)}
                </Text>
                <Text style={styles.metricSub}>{reportData.billsCount} bills</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TOTAL EXPENSES</Text>
                <Text style={[styles.metricValue, { color: '#DC2626' }]}>
                  {formatRupee(reportData.totalExpenses)}
                </Text>
                <Text style={styles.metricSub}>All categories</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>NET PROFIT</Text>
                <Text style={[styles.metricValue, { color: reportData.profit >= 0 ? '#2563EB' : '#DC2626' }]}>
                  {formatRupee(reportData.profit)}
                </Text>
                <Text style={styles.metricSub}>{reportData.profitMarginPct.toFixed(1)}% margin</Text>
              </View>
            </View>

            {/* Payment Method Breakdown */}
            {reportData.paymentModes && reportData.paymentModes.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>PAYMENT METHODS</Text>
                <View style={styles.paymentList}>
                  {reportData.paymentModes.map((pm, idx) => (
                    <View key={idx} style={styles.paymentRow}>
                      <View style={styles.paymentNameWrap}>
                        <View style={[styles.paymentDot, { backgroundColor: pm.color || theme.colors.accent }]} />
                        <Text style={styles.paymentName}>{pm.name}</Text>
                      </View>
                      <Text style={styles.paymentAmount}>{formatRupee(pm.amount)}</Text>
                      <Text style={styles.paymentPct}>({pm.pct})</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Top Selling Items Preview */}
            {reportData.topItems && reportData.topItems.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>TOP DISHES / PRODUCTS</Text>
                {reportData.topItems.slice(0, 5).map((item, idx) => (
                  <View key={idx} style={styles.topItemRow}>
                    <Text style={styles.itemRank}>#{item.rank}</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemQty}>{item.quantity} sold</Text>
                    <Text style={styles.itemAmt}>{formatRupee(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Export Summary Details */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.infoBoxText}>
                The exported file will include full day-by-day breakdowns ({reportData.days.length} days), week summaries, and verified shop tax headers.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <View style={styles.exportBtnRow}>
              <TouchableOpacity
                onPress={handlePdfClick}
                disabled={isExportingPdf}
                style={[styles.actionBtn, styles.pdfBtn, isQuotaExceeded && styles.disabledBtn]}
                activeOpacity={0.8}
              >
                {isExportingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.pdfBtnText}>Export PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExcelClick}
                disabled={isExportingExcel}
                style={[styles.actionBtn, styles.excelBtn, isQuotaExceeded && styles.disabledBtn]}
                activeOpacity={0.8}
              >
                {isExportingExcel ? (
                  <ActivityIndicator size="small" color="#166534" />
                ) : (
                  <>
                    <Ionicons name="stats-chart" size={16} color="#166534" style={{ marginRight: 6 }} />
                    <Text style={styles.excelBtnText}>Export Excel</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleWhatsAppClick}
              style={[styles.waBtn, isQuotaExceeded && styles.disabledWaBtn]}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#15803D" style={{ marginRight: 6 }} />
              <Text style={styles.waBtnText}>Share Report on WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      minHeight: '60%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitles: {
      flex: 1,
      gap: 3,
    },
    tagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tagBadgeText: {
      fontSize: 10,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.accent,
      letterSpacing: 0.6,
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textMuted,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quotaBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF7ED',
      borderBottomWidth: 1,
      borderBottomColor: '#FED7AA',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    quotaTextWrap: {
      flex: 1,
    },
    quotaTitle: {
      fontSize: 12,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: '#C2410C',
    },
    quotaSubtitle: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: '#9A3412',
      lineHeight: 15,
    },
    upgradeMiniBtn: {
      backgroundColor: '#EA580C',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    upgradeMiniBtnText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    scrollBody: {
      padding: 18,
      gap: 14,
    },
    metricsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    metricCard: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
    },
    metricLabel: {
      fontSize: 9,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    metricValue: {
      fontSize: 16,
      fontFamily: typography.fonts.numbers,
      fontWeight: '800',
    },
    metricSub: {
      fontSize: 10,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
    },
    sectionCard: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    sectionHeader: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
    },
    paymentList: {
      gap: 8,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    paymentNameWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    paymentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    paymentName: {
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: colors.text,
      fontWeight: '600',
    },
    paymentAmount: {
      fontSize: 13,
      fontFamily: typography.fonts.numbers,
      color: colors.text,
      fontWeight: '700',
      marginRight: 6,
    },
    paymentPct: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
    },
    topItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 3,
    },
    itemRank: {
      fontSize: 11,
      fontFamily: typography.fonts.numbers,
      fontWeight: '800',
      color: colors.textMuted,
      width: 22,
    },
    itemName: {
      flex: 1,
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: colors.text,
      fontWeight: '600',
    },
    itemQty: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      marginRight: 8,
    },
    itemAmt: {
      fontSize: 13,
      fontFamily: typography.fonts.numbers,
      fontWeight: '700',
      color: colors.text,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoBoxText: {
      flex: 1,
      fontSize: 11.5,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      lineHeight: 16,
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    exportBtnRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pdfBtn: {
      backgroundColor: colors.accent,
    },
    pdfBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    excelBtn: {
      backgroundColor: '#DCFCE7',
      borderWidth: 1,
      borderColor: '#86EFAC',
    },
    excelBtnText: {
      color: '#166534',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    disabledBtn: {
      opacity: 0.6,
    },
    waBtn: {
      height: 42,
      borderRadius: 12,
      backgroundColor: '#F0FDF4',
      borderWidth: 1,
      borderColor: '#BBF7D0',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledWaBtn: {
      opacity: 0.6,
    },
    waBtnText: {
      color: '#15803D',
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
  });
};
