import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { PaymentModeIcon } from '../common/PaymentModeIcon';
import { PendingPaymentRecord, PaymentMethod } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface CollectDueModalProps {
  visible: boolean;
  onClose: () => void;
  record: PendingPaymentRecord | null;
  onConfirm: (record: PendingPaymentRecord, amountToCollect: number, paymentMode: PaymentMethod) => Promise<void>;
}

export const CollectDueModal: React.FC<CollectDueModalProps> = ({
  visible,
  onClose,
  record,
  onConfirm,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [payAmountStr, setPayAmountStr] = useState('');
  const [selectedMode, setSelectedMode] = useState<PaymentMethod>('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setPayAmountStr(String(record.amountDue));
      setSelectedMode('Cash');
      setIsSubmitting(false);
    }
  }, [record, visible]);

  if (!record) return null;

  const totalDue = record.amountDue || 0;
  const enteredAmount = Number(payAmountStr.replace(/[^0-9]/g, '')) || 0;
  const remainingDue = Math.max(0, totalDue - enteredAmount);
  const isFull = enteredAmount === totalDue;
  const isPartial = enteredAmount > 0 && enteredAmount < totalDue;
  const isInvalid = enteredAmount <= 0 || enteredAmount > totalDue;

  const handleQuickAmount = (amt: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setPayAmountStr(String(Math.min(amt, totalDue)));
  };

  const handleConfirm = async () => {
    if (isInvalid || isSubmitting) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setIsSubmitting(true);
    try {
      await onConfirm(record, enteredAmount, selectedMode);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <View style={styles.modalBox}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.customerAvatarText}>
                      {record.customerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>Collect Due Payment</Text>
                    <Text style={styles.customerSub} numberOfLines={1}>
                      {record.customerName} {record.customerPhone ? `• +91 ${record.customerPhone}` : '• No phone'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  disabled={isSubmitting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Outstanding Due Card */}
              <View style={styles.dueCard}>
                <View style={styles.dueKickerRow}>
                  <Ionicons name="alert-circle" size={13} color="#DC2626" />
                  <Text style={styles.dueLabel}>TOTAL OUTSTANDING BALANCE</Text>
                </View>
                <Text style={styles.dueAmount}>{formatRupee(totalDue)}</Text>
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount paying now (₹)</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.rupeePrefix}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={payAmountStr}
                    onChangeText={t => setPayAmountStr(t.replace(/[^0-9]/g, ''))}
                    placeholder="Enter amount"
                    placeholderTextColor={theme.colors.inputPlaceholder}
                    autoFocus
                  />
                  {enteredAmount > 0 && (
                    <TouchableOpacity
                      onPress={() => setPayAmountStr('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Presets */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    style={[styles.presetChip, enteredAmount === totalDue && styles.presetChipActive]}
                    onPress={() => handleQuickAmount(totalDue)}
                  >
                    <Text style={[styles.presetChipText, enteredAmount === totalDue && styles.presetChipTextActive]}>
                      Full: {formatRupee(totalDue)}
                    </Text>
                  </TouchableOpacity>

                  {totalDue >= 50 && (
                    <TouchableOpacity
                      style={[styles.presetChip, enteredAmount === Math.round(totalDue / 2) && styles.presetChipActive]}
                      onPress={() => handleQuickAmount(Math.round(totalDue / 2))}
                    >
                      <Text style={[styles.presetChipText, enteredAmount === Math.round(totalDue / 2) && styles.presetChipTextActive]}>
                        50%: {formatRupee(Math.round(totalDue / 2))}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {totalDue > 100 && (
                    <TouchableOpacity
                      style={[styles.presetChip, enteredAmount === 100 && styles.presetChipActive]}
                      onPress={() => handleQuickAmount(100)}
                    >
                      <Text style={[styles.presetChipText, enteredAmount === 100 && styles.presetChipTextActive]}>
                        ₹100
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Live Remaining Balance Preview Box */}
              <View style={[
                styles.feedbackBox,
                isFull && styles.feedbackBoxSuccess,
                isPartial && styles.feedbackBoxPartial,
                isInvalid && styles.feedbackBoxError,
              ]}>
                {isFull && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.feedbackSuccessText}>
                      Full Settlement: Account will be marked 100% settled (₹0 remaining).
                    </Text>
                  </View>
                )}
                {isPartial && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="information-circle" size={16} color="#2563EB" />
                    <Text style={styles.feedbackPartialText}>
                      Partial Payment: ₹{enteredAmount} collected now • <Text style={styles.remainingBold}>₹{remainingDue} remains in due</Text>
                    </Text>
                  </View>
                )}
                {enteredAmount > totalDue && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.feedbackErrorText}>
                      Entered amount exceeds total due of {formatRupee(totalDue)}
                    </Text>
                  </View>
                )}
                {enteredAmount <= 0 && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.feedbackErrorText}>
                      Please enter an amount greater than ₹0
                    </Text>
                  </View>
                )}
              </View>

              {/* Payment Mode Selector */}
              <View style={styles.modeSection}>
                <Text style={styles.modeSectionTitle}>PAYMENT MODE RECEIVED IN</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeCard, selectedMode === 'Cash' && styles.modeCardSelected]}
                    onPress={() => setSelectedMode('Cash')}
                    activeOpacity={0.7}
                  >
                    <PaymentModeIcon mode="Cash" size={18} color={selectedMode === 'Cash' ? '#059669' : colors.textMuted} />
                    <Text style={[styles.modeCardText, selectedMode === 'Cash' && styles.modeCardTextSelected]}>Cash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeCard, selectedMode === 'GPay' && styles.modeCardSelected]}
                    onPress={() => setSelectedMode('GPay')}
                    activeOpacity={0.7}
                  >
                    <PaymentModeIcon mode="GPay" size={18} color={selectedMode === 'GPay' ? '#2563EB' : colors.textMuted} />
                    <Text style={[styles.modeCardText, selectedMode === 'GPay' && styles.modeCardTextSelected]}>GPay / UPI</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Responsive Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (isInvalid || isSubmitting) && styles.disabledConfirmBtn,
                  ]}
                  onPress={handleConfirm}
                  disabled={isInvalid || isSubmitting}
                  activeOpacity={0.7}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                      <Text style={styles.confirmBtnText}>
                        Collect {enteredAmount > 0 ? formatRupee(enteredAmount) : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
    keyboardWrap: {
      width: '100%',
      maxWidth: 420,
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    customerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.isDark ? '#3D2005' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.isDark ? '#6B3809' : '#FDE68A',
    },
    customerAvatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.md,
      color: theme.isDark ? '#F59E0B' : '#B45309',
      fontWeight: '700',
    },
    modalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.text,
      fontWeight: '700',
    },
    customerSub: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },

    dueCard: {
      backgroundColor: theme.isDark ? '#2D1515' : '#FEF2F2',
      borderRadius: radii.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.isDark ? '#5C2222' : '#FECACA',
      alignItems: 'center',
    },
    dueKickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    dueLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 10,
      letterSpacing: 0.8,
      color: '#B91C1C',
      fontWeight: '700',
    },
    dueAmount: {
      fontFamily: typography.fonts.heading,
      fontSize: 28,
      color: '#DC2626',
      marginTop: 2,
      fontWeight: '800',
      letterSpacing: -0.5,
    },

    inputGroup: {
      gap: 6,
    },
    inputLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      color: colors.text,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: radii.md,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
    },
    rupeePrefix: {
      fontFamily: typography.fonts.heading,
      fontSize: 22,
      color: colors.accent,
      marginRight: 6,
      fontWeight: '700',
    },
    amountInput: {
      flex: 1,
      height: 48,
      fontFamily: typography.fonts.heading,
      fontSize: 22,
      color: colors.inputText,
      fontWeight: '700',
    },
    presetsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    presetChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
    },
    presetChipActive: {
      backgroundColor: theme.isDark ? '#331B05' : colors.accent100,
      borderColor: colors.accent,
    },
    presetChipText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.body,
      color: colors.text,
    },
    presetChipTextActive: {
      color: colors.accent,
      fontWeight: 'bold',
    },

    feedbackBox: {
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
    },
    feedbackBoxSuccess: {
      backgroundColor: theme.isDark ? '#06281E' : '#ECFDF5',
      borderColor: theme.isDark ? '#0E5C44' : '#A7F3D0',
    },
    feedbackBoxPartial: {
      backgroundColor: theme.isDark ? '#0C2040' : '#EFF6FF',
      borderColor: theme.isDark ? '#1D457A' : '#BFDBFE',
    },
    feedbackBoxError: {
      backgroundColor: theme.isDark ? '#2D1515' : '#FEF2F2',
      borderColor: theme.isDark ? '#5C2222' : '#FECACA',
    },
    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    feedbackSuccessText: {
      fontSize: typography.sizes.xs,
      color: theme.isDark ? '#34D399' : '#065F46',
      fontFamily: typography.fonts.body,
      flex: 1,
      lineHeight: 16,
    },
    feedbackPartialText: {
      fontSize: typography.sizes.xs,
      color: theme.isDark ? '#60A5FA' : '#1E40AF',
      fontFamily: typography.fonts.body,
      flex: 1,
      lineHeight: 16,
    },
    remainingBold: {
      fontWeight: 'bold',
      color: '#DC2626',
    },
    feedbackErrorText: {
      fontSize: typography.sizes.xs,
      color: '#DC2626',
      fontFamily: typography.fonts.body,
      flex: 1,
      lineHeight: 16,
    },

    modeSection: {
      gap: 6,
    },
    modeSectionTitle: {
      fontSize: 10,
      fontFamily: typography.fonts.heading,
      color: colors.textMuted,
      letterSpacing: 0.8,
      fontWeight: '700',
    },
    modeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modeCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
    },
    modeCardSelected: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
      ...shadows.sm,
    },
    modeCardText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
    },
    modeCardTextSelected: {
      color: colors.text,
      fontWeight: '700',
    },

    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.surface,
    },
    cancelBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontWeight: '600',
    },
    confirmBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      ...shadows.sm,
    },
    disabledConfirmBtn: {
      backgroundColor: colors.surfaceElevated,
      opacity: 0.6,
    },
    confirmBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
};
