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
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';
import { MenuCategory } from '../../types/models';

interface CategoryActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  category: MenuCategory | null;
  itemCount?: number;
  onEdit: (category: MenuCategory) => void;
  onDelete: (category: MenuCategory) => void;
}

export const CategoryActionMenuModal: React.FC<CategoryActionMenuModalProps> = ({
  visible,
  onClose,
  category,
  itemCount = 0,
  onEdit,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!category) return null;

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
            <View style={styles.smallMenuBox}>
              {/* Category Name Header */}
              <View style={styles.header}>
                <Text style={styles.categoryTitle} numberOfLines={1}>
                  {category.name}
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Action: Edit Category */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  onClose();
                  onEdit(category);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.accent900} />
                <Text style={styles.menuText}>Edit Category</Text>
              </TouchableOpacity>

              {/* Action: Delete Category */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  onClose();
                  onDelete(category);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger || '#DC2626'} />
                <Text style={[styles.menuText, { color: colors.danger || '#DC2626' }]}>
                  Delete Category
                </Text>
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
      padding: 16,
    },
    smallMenuBox: {
      width: 230,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    categoryTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.body,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      marginRight: 6,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    menuText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
  });
};
