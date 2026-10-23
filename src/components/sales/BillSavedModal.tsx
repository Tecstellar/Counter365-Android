import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, shadows, useTheme } from '../../theme';
import { Bill } from '../../types/models';
import { useLanguage } from '../../context/LanguageContext';

interface BillSavedModalProps {
  bill: Bill | null;
  onSendWhatsApp?: () => void;
  onPrint?: () => void;
  onNewBill: () => void;
  onEdit?: () => void;
  isPrinterConfigured?: boolean;
}

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

export const BillSavedModal: React.FC<BillSavedModalProps> = ({
  bill,
  onNewBill,
  onPrint,
  isPrinterConfigured = false,
}) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  if (!bill) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onNewBill}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: isDark ? '#121E16' : '#FFFFFF', borderColor: isDark ? '#1C3123' : '#E2E8F0' }]}>
          {/* Top Corner Close Icon */}
          <TouchableOpacity
            onPress={onNewBill}
            style={[styles.closeBtn, { backgroundColor: isDark ? '#1A2920' : '#F1F5F9' }]}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close and Start New Bill"
          >
            <Ionicons name="close" size={17} color={isDark ? '#9CA3AF' : '#475569'} />
          </TouchableOpacity>

          {/* Green Checkmark Ring */}
          <View style={[styles.checkRing, { borderColor: isDark ? '#34D399' : '#16A34A', backgroundColor: isDark ? '#0F2318' : '#DCFCE7' }]}>
            <Ionicons name="checkmark" size={30} color={isDark ? '#34D399' : '#16A34A'} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {t('bill_saved_success', 'Bill saved successfully!')}
          </Text>

          {/* Subtitle */}
          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
            Bill #{String(bill.billNumber || '0016').padStart(4, '0')}
          </Text>

          {/* Exactly matching receipt card */}
          <SavedBillTicketCard billNumber={bill.billNumber || 16} isDark={isDark} />

          {/* Optional printer button if printer enabled */}
          {isPrinterConfigured && onPrint && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 44,
                borderRadius: 12,
                backgroundColor: '#16A34A',
                marginTop: 12,
              }}
              onPress={onPrint}
            >
              <Ionicons name="print-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ fontFamily: typography.fonts.heading, fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                {t('print_receipt', 'Print Receipt')} (80mm)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '88%',
    maxWidth: 320,
    backgroundColor: '#121E16',
    borderRadius: 26,
    padding: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C3123',
    position: 'relative',
    ...shadows.card,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A2920',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  checkRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3.5,
    borderColor: '#34D399',
    backgroundColor: '#0F2318',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 3,
    marginBottom: 2,
    textAlign: 'center',
  },
});
