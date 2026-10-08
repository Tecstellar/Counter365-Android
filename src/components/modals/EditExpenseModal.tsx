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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { AppButton } from '../common/AppButton';
import { ExpenseRecord, ShopType } from '../../types/models';
import { ExpenseCategoryPickerModal } from './ExpenseCategoryPickerModal';

interface EditExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  expense: ExpenseRecord | null;
  onSave: (expenseId: string, description: string, amount: number) => Promise<void>;
  shopType?: ShopType | null;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  visible,
  onClose,
  expense,
  onSave,
  shopType,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmountStr(String(expense.amount));
      setIsSubmitting(false);
    }
  }, [expense, visible]);

  if (!expense) return null;

  const amount = Number(amountStr.replace(/[^0-9]/g, '')) || 0;
  const isInvalid = !description.trim() || amount <= 0;

  const handleSave = async () => {
    if (isInvalid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave(expense.id, description.trim(), amount);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
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
                  <Text style={styles.modalTitle}>Edit Expense</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Description Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>What was it for?</Text>
                    <TouchableOpacity
                      onPress={() => setIsPickerVisible(true)}
                      style={styles.categoryPickerTrigger}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="list" size={13} color={colors.accent} />
                      <Text style={styles.categoryPickerTriggerText}>Categories ▾</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Milk, Cleaning supplies"
                    placeholderTextColor={theme.colors.inputPlaceholder}
                    autoFocus
                  />
                </View>

                {/* Amount Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.rupeePrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={amountStr}
                      onChangeText={t => setAmountStr(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={theme.colors.inputPlaceholder}
                    />
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <AppButton
                    title="Cancel"
                    variant="ghost"
                    onPress={onClose}
                    style={styles.cancelBtn}
                  />
                  <AppButton
                    title={isSubmitting ? 'Saving...' : 'Save Changes'}
                    variant="primary"
                    onPress={handleSave}
                    disabled={isInvalid || isSubmitting}
                    style={styles.saveBtn}
                  />
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Expense Category Picker Modal */}
      <ExpenseCategoryPickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        shopType={shopType}
        onSelect={(preset) => {
          const short = typeof preset === 'string' ? preset : preset.label.split('(')[0].trim();
          setDescription(short);
        }}
      />
    </>
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
      maxWidth: 400,
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 20,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.h5,
      color: colors.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: 'bold',
    },
    inputGroup: {
      gap: 6,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inputLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    categoryPickerTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.isDark ? '#331B05' : colors.brandOrangeSubtle,
      borderWidth: 1,
      borderColor: theme.isDark ? '#663300' : colors.brandOrangeBorder,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    categoryPickerTriggerText: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.accent,
    },
    textInput: {
      height: 46,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      fontSize: typography.sizes.body,
      fontFamily: typography.fonts.body,
      color: colors.inputText,
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 46,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
    },
    rupeePrefix: {
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      color: colors.accent,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: 20,
      color: colors.inputText,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 44,
    },
    saveBtn: {
      flex: 1.5,
      minHeight: 44,
    },
  });
};
