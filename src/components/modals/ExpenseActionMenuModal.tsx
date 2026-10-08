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
import { ExpenseRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface ExpenseActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  expense: ExpenseRecord | null;
  onEdit: (expense: ExpenseRecord) => void;
  onDelete: (expense: ExpenseRecord) => void;
}

export const ExpenseActionMenuModal: React.FC<ExpenseActionMenuModalProps> = ({
  visible,
  onClose,
  expense,
  onEdit,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!expense) return null;

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
              {/* Action: Edit */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onEdit(expense);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#FF5F00" />
                <Text style={styles.menuLabel}>Edit</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Action: Delete */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onDelete(expense);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Delete</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
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
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    menuBox: {
      width: '100%',
      maxWidth: 280,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
      borderRadius: 14,
    },
    menuLabel: {
      fontSize: 15,
      fontFamily: typography.fonts.bodySemiBold,
      color: colors.text,
      fontWeight: '600',
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: 8,
    },
  });
};

