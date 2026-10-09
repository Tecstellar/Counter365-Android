import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, useTheme, Theme } from '../../theme';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'bill' | 'remind' | 'day' | 'week') => void;
}

const SHARE_OPTIONS = [
  {
    id: 'bill' as const,
    name: "Customer's bill",
    sub: 'Send digital receipt to customer WhatsApp',
    icon: 'receipt-outline' as const,
  },
  {
    id: 'remind' as const,
    name: 'Pending reminder',
    sub: 'Send statement listing unpaid balance',
    icon: 'notifications-outline' as const,
  },
  {
    id: 'day' as const,
    name: 'Day report',
    sub: 'Send daily closing summary to owner',
    icon: 'today-outline' as const,
  },
  {
    id: 'week' as const,
    name: 'Weekly summary PDF',
    sub: 'Full revenue, expenses, and top items breakdown',
    icon: 'document-text-outline' as const,
  },
];

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const colors = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>SHARE STATEMENT</Text>
              <Text style={styles.title}>Send via WhatsApp</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsList}>
            {SHARE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.7}
                onPress={() => onSelectOption(opt.id)}
                style={styles.optionRow}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={opt.icon} size={18} color={colors.accent} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>{opt.name}</Text>
                  <Text style={styles.optionSub}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footerNoteRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.footerNote}>
              Generated reports are formatted directly for WhatsApp and PDF sharing.
            </Text>
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
      backgroundColor: colors.overlay55,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 26,
      gap: 12,
      ...shadows.lg,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.divider,
      alignSelf: 'center',
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 4,
    },
    kicker: {
      fontSize: 10,
      fontFamily: typography.fonts.heading,
      letterSpacing: 1.1,
      color: colors.accent,
      textTransform: 'uppercase',
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.h4,
      color: colors.text,
      fontWeight: '700',
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionsList: {
      gap: 8,
      marginTop: 4,
    },
    optionRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: radii.md,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionInfo: {
      flex: 1,
    },
    optionName: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    optionSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    footerNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      paddingTop: 8,
    },
    footerNote: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: typography.fonts.body,
      flex: 1,
    },
  });
};
