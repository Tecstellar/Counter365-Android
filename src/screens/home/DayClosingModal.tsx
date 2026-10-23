import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme, typography, radii, shadows } from '../../theme';
import { DayClosingReport } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface DayClosingModalProps {
  visible: boolean;
  report: DayClosingReport;
  onClose: () => void;
  onShareWhatsApp: () => void;
  onPrint: () => void;
}

export const DayClosingModal: React.FC<DayClosingModalProps> = ({
  visible,
  report,
  onClose,
  onShareWhatsApp,
  onPrint,
}) => {
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Top Grab Handle */}
          <View style={styles.topHandleRow}>
            <View style={styles.topHandleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>Today's Summary Report</Text>
              <Text style={styles.headerSubtitle}>Verified Register & Day Audit</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Fully Scrollable & Flex Layout for All Screen Sizes & Navigation Bars */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {/* Hero Image Artwork */}
            <View style={styles.heroBanner}>
              <Image
                source={require('../../../assets/images/business_insights.jpg')}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroBadge}>
                    <Ionicons name="shield-checkmark" size={13} color="#FF5F00" />
                    <Text style={styles.heroBadgeText}>AUDIT REPORT</Text>
                  </View>
                  <Text style={styles.heroDateText}>{report.date}</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={1}>{report.shopTitle}</Text>
                <Text style={styles.heroSubtitle}>Today's Revenue, Settle Register & Profits</Text>
              </View>
            </View>

            {/* Table Breakdown */}
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.rowLabel}>Total sales — {report.billsCount} bills</Text>
                <Text style={styles.rowValue}>{formatRupee(report.totalSales)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.rowSubLabel}>Cash</Text>
                <Text style={styles.rowSubValue}>{formatRupee(report.cashSales)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.rowSubLabel}>GPay / UPI</Text>
                <Text style={styles.rowSubValue}>{formatRupee(report.gpaySales)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.rowSubLabel}>Pending (uncollected)</Text>
                <Text style={styles.rowSubValue}>{formatRupee(report.pendingSales)}</Text>
              </View>
              <View style={[styles.tableRow, styles.expenseRow]}>
                <Text style={styles.rowLabel}>Total expenses</Text>
                <Text style={styles.rowValue}>− {formatRupee(report.totalExpenses)}</Text>
              </View>
            </View>

            {/* Profit Card (Short & Cute) */}
            <View style={styles.profitCard}>
              <View style={styles.profitLeftCol}>
                <View style={styles.profitBadge}>
                  <Ionicons name="trending-up" size={13} color="#FF5F00" style={{ marginRight: 4 }} />
                  <Text style={styles.profitKicker}>NET PROFIT</Text>
                </View>
                <Text style={styles.profitNote}>Sales − Expenses</Text>
              </View>
              <Text style={styles.profitAmount}>{formatRupee(report.netProfit)}</Text>
            </View>

            {/* Action Buttons: Embedded in scrollview with safe flex layout & navigation bar insets */}
            <View style={styles.actionButtonsWrap}>
              <TouchableOpacity
                style={styles.waBtn}
                activeOpacity={0.8}
                onPress={onShareWhatsApp}
              >
                <View style={styles.waIconContainer}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.waBtnText} numberOfLines={1} adjustsFontSizeToFit>Send to my WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.printBtn}
                activeOpacity={0.8}
                onPress={onPrint}
              >
                <Ionicons name="print-outline" size={18} color={theme.colors.text} />
                <Text style={styles.printBtnText}>Print</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme, insets?: EdgeInsets) => {
  const { colors } = theme;
  const bottomInset = insets?.bottom || 0;
  // Guaranteed clearance for Android 3-button navigation bars (e.g. Realme C3, Redmi, Samsung)
  const androidNavPadding = Platform.OS === 'android' ? Math.max(bottomInset, 48) : bottomInset;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHandleRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 10,
      paddingBottom: 4,
      backgroundColor: colors.surface,
    },
    topHandleBar: {
      width: 44,
      height: 4.5,
      borderRadius: 3,
      backgroundColor: theme.isDark ? '#3F3F46' : '#D4D4D8',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitleWrap: {
      flex: 1,
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 14,
      flexGrow: 1,
      paddingBottom: androidNavPadding + 36,
    },
    heroBanner: {
      height: 140,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'space-between',
      padding: 14,
      ...shadows.card,
    },
    heroImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    heroOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(18, 14, 12, 0.72)',
    },
    heroContent: {
      zIndex: 2,
      height: '100%',
      justifyContent: 'space-between',
    },
    heroBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255, 95, 0, 0.28)',
      borderWidth: 1,
      borderColor: 'rgba(255, 95, 0, 0.5)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    heroBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '800',
      color: '#FF8833',
      letterSpacing: 0.5,
    },
    heroDateText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    heroTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    heroSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2,
    },
    table: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      ...shadows.card,
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    expenseRow: {
      borderBottomWidth: 0,
      paddingTop: 12,
    },
    rowLabel: {
      fontSize: 14,
      color: colors.text,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    rowValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    rowSubLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: typography.fonts.body,
      paddingLeft: 8,
    },
    rowSubValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    profitCard: {
      backgroundColor: theme.isDark ? '#141414' : '#111111',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
      ...shadows.card,
    },
    profitLeftCol: {
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 2,
    },
    profitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profitKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      letterSpacing: 0.8,
      color: '#FF5F00',
      fontWeight: '800',
    },
    profitAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      fontVariant: ['tabular-nums'],
    },
    profitNote: {
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.6)',
      fontFamily: typography.fonts.body,
    },
    actionButtonsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      marginTop: 4,
      gap: 10,
      width: '100%',
    },
    waBtn: {
      flex: 1.5,
      minHeight: 48,
      borderRadius: radii.pill,
      backgroundColor: '#16A34A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      gap: 6,
      flexShrink: 1,
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    waIconContainer: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
      flexShrink: 1,
    },
    printBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.pill,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      gap: 6,
    },
    printBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
  });
};
