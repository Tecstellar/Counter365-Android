import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { AppButton } from '../common/AppButton';
import { PaymentModeIcon } from '../common/PaymentModeIcon';
import { Bill } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface BillSavedModalProps {
  bill: Bill | null;
  onSendWhatsApp: () => void;
  onPrint: () => void;
  onNewBill: () => void;
  onEdit?: () => void;
}

export const BillSavedModal: React.FC<BillSavedModalProps> = ({
  bill,
  onSendWhatsApp,
  onPrint,
  onNewBill,
  onEdit,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!bill) return null;

  const itemCount = bill.items.reduce((s, i) => s + i.quantity, 0);
  let statusDetail = bill.customerName ? `settled (${bill.customerName})` : 'settled';
  if (bill.paymentMode === 'Pending') {
    statusDetail = `pending: ${bill.customerName || 'not tracked'}`;
  } else if (bill.paymentMode === 'Partial Pay') {
    statusDetail = `Paid ${formatRupee(bill.paidAmount)} • Due ${formatRupee(bill.pendingAmount)} (${bill.customerName || 'customer'})`;
  } else if (bill.paymentMode === 'Cash + GPay') {
    statusDetail = `Cash ${formatRupee(bill.cashAmount || 0)} + GPay ${formatRupee(bill.gpayAmount || 0)}${bill.customerName ? ` (${bill.customerName})` : ''}`;
  }

  const tableTag = bill.tableNumber ? ` • ${bill.tableNumber}` : '';
  const itemsText = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}${tableTag} • ${statusDetail}`;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <View style={styles.headerRow}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.successBadgeText}>BILL SAVED</Text>
            </View>
            <View style={styles.billNumberCapsule}>
              <Text style={styles.billNumberText}>{bill.billNumber}</Text>
            </View>
          </View>

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalAmount}>{formatRupee(bill.totalAmount)}</Text>
            </View>
            <View style={styles.paymentModeTag}>
              <PaymentModeIcon mode={bill.paymentMode} size={14} color={colors.text} />
              <Text style={styles.paymentModeText}>{bill.paymentMode}</Text>
              {bill.tableNumber && (
                <View style={styles.tableChip}>
                  <Ionicons name="restaurant-outline" size={11} color={colors.accent} />
                  <Text style={styles.tableChipText}>{bill.tableNumber}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.itemsSummaryBox}>
            <Text style={styles.itemsSummary}>{itemsText}</Text>
          </View>

          <View style={styles.actionRow}>
            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                style={styles.editBtn}
                activeOpacity={0.7}
                accessibilityLabel="Edit Bill"
              >
                <Ionicons name="create-outline" size={19} color={colors.accent900} />
              </TouchableOpacity>
            )}
            <AppButton
              title="WhatsApp"
              variant="primary"
              icon={<Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />}
              onPress={onSendWhatsApp}
              style={styles.waBtn}
            />
            <AppButton
              title="Print"
              variant="secondary"
              icon={<Ionicons name="print-outline" size={16} color={colors.text} />}
              onPress={onPrint}
              style={styles.printBtn}
            />
          </View>

          <AppButton
            title="Create New Bill"
            variant="ghost"
            icon={<Ionicons name="add-circle-outline" size={16} color={colors.accent} />}
            onPress={onNewBill}
            style={styles.newBillBtn}
          />
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
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 22,
      gap: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    successBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.isDark ? '#06281E' : '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: theme.isDark ? '#0E5C44' : '#A7F3D0',
    },
    successBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.1,
      color: theme.isDark ? '#34D399' : '#059669',
    },
    billNumberCapsule: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    billNumberText: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    totalLabel: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      letterSpacing: 1.1,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    totalAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 28,
      lineHeight: 32,
      color: colors.text,
      fontWeight: '800',
      marginTop: 2,
    },
    paymentModeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#F8FAFC',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentModeText: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    tableChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.isDark ? '#331B05' : colors.accent100,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 4,
    },
    tableChipText: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '700',
    },
    itemsSummaryBox: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#F8FAFC',
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemsSummary: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      lineHeight: 16,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    editBtn: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.isDark ? '#5C3809' : '#FED7AA',
      backgroundColor: theme.isDark ? '#2A1A05' : '#FFF7ED',
      justifyContent: 'center',
      alignItems: 'center',
    },
    waBtn: {
      flex: 1.15,
      minHeight: 42,
    },
    printBtn: {
      flex: 1,
      minHeight: 42,
    },
    newBillBtn: {
      minHeight: 38,
    },
  });
};
