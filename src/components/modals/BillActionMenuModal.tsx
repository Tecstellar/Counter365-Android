import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Bill } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface BillActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  bill: Bill | null;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
  onDownloadPdf?: (bill: Bill) => void;
  onShareWhatsApp?: (bill: Bill) => void;
}

export const BillActionMenuModal: React.FC<BillActionMenuModalProps> = ({
  visible,
  onClose,
  bill,
  onEdit,
  onDelete,
  onDownloadPdf,
  onShareWhatsApp,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!bill) return null;

  const isDeleted = bill.isDeleted || bill.status === 'deleted';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.menuBox}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                  <View style={styles.billNumberRow}>
                    <Text style={styles.billTitle} numberOfLines={1}>
                      Bill {bill.billNumber}
                    </Text>
                    {bill.tableNumber ? (
                      <View style={styles.tableBadge}>
                        <Ionicons name="restaurant-outline" size={11} color={colors.accent} />
                        <Text style={styles.tableBadgeText}>{bill.tableNumber}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.billSub}>
                    {bill.customerName ? bill.customerName : 'Walk-in'} • {formatRupee(bill.totalAmount)}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Action: Download PDF Copy */}
              {onDownloadPdf && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onDownloadPdf(bill);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="document-text-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionTitle, { color: '#1E40AF' }]}>Download PDF Copy</Text>
                    <Text style={styles.actionSub}>View & save receipt PDF on phone</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Action: Share WhatsApp */}
              {onShareWhatsApp && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onShareWhatsApp(bill);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionTitle, { color: '#15803D' }]}>Share via WhatsApp</Text>
                    <Text style={styles.actionSub}>Send receipt directly to customer</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Action: Edit (only if not deleted) */}
              {!isDeleted && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onEdit(bill);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent100 }]}>
                    <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>Edit Bill</Text>
                    <Text style={styles.actionSub}>Modify items, discounts, or notes</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Action: Delete (only if not already deleted) */}
              {!isDeleted && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onDelete(bill);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(220, 38, 38, 0.1)' }]}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger || '#DC2626'} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionTitle, { color: colors.danger || '#DC2626' }]}>Delete Bill</Text>
                    <Text style={styles.actionSub}>Soft delete and keep in audit log</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Cancel Button */}
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    menuBox: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTextWrap: {
      flex: 1,
      marginRight: 8,
    },
    billNumberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    billTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.body,
      fontWeight: '700',
      color: colors.text,
    },
    tableBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FFF7ED',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.sm,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: colors.border,
    },
    tableBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
    },
    billSub: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      gap: 12,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionTextWrap: {
      flex: 1,
    },
    actionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.body,
      fontWeight: '700',
      color: colors.text,
    },
    actionSub: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      marginTop: 1,
    },
    cancelBtn: {
      marginTop: 4,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: colors.border,
    },
    cancelBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sub,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
};
