import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { ExpensePreset, getExpensePresetsForShopType } from '../../constants/expensePresets';
import { ShopType } from '../../types/models';

interface ExpenseCategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (preset: ExpensePreset | { label: string; icon: string; category: string }) => void;
  shopType?: ShopType | null;
}

export const ExpenseCategoryPickerModal: React.FC<ExpenseCategoryPickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  shopType,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [search, setSearch] = useState('');
  const presets = getExpensePresetsForShopType(shopType);

  const trimmed = search.trim();

  const filtered = trimmed
    ? presets.filter(p =>
        p.label.toLowerCase().includes(trimmed.toLowerCase()) ||
        p.category.toLowerCase().includes(trimmed.toLowerCase())
      )
    : presets;

  const handleSelect = (preset: ExpensePreset) => {
    onSelect(preset);
    setSearch('');
    onClose();
  };

  const handleSelectCustom = (customText: string) => {
    if (!customText) return;
    onSelect({
      label: customText,
      icon: '📝',
      category: 'Custom',
    });
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerTitleWrap}>
                    <Text style={styles.title}>Expense Categories</Text>
                    <Text style={styles.subtitle}>
                      Select from presets or type any custom reason
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Type or Search Input */}
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search or type custom reason (e.g. Milk, Gas)..."
                    placeholderTextColor={theme.colors.inputPlaceholder}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (trimmed) handleSelectCustom(trimmed);
                    }}
                  />
                  {trimmed.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearch('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Type Custom Reason Instant Selector Banner */}
                {trimmed.length > 0 && (
                  <TouchableOpacity
                    style={styles.customActionCard}
                    activeOpacity={0.75}
                    onPress={() => handleSelectCustom(trimmed)}
                  >
                    <View style={styles.customActionLeft}>
                      <View style={styles.customIconWrap}>
                        <Ionicons name="pencil" size={16} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customActionTitle} numberOfLines={1}>
                          Use custom: "{trimmed}"
                        </Text>
                        <Text style={styles.customActionSub}>
                          Tap to set as your expense reason
                        </Text>
                      </View>
                    </View>
                    <View style={styles.useBadge}>
                      <Text style={styles.useBadgeText}>Select</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <Text style={styles.sectionHeading}>
                  {trimmed ? 'Matching Suggestions' : `${shopType || 'Shop'} Suggestions`}
                </Text>

                {/* Items List */}
                <FlatList
                  data={filtered}
                  keyExtractor={item => item.label}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.itemRow}
                      activeOpacity={0.7}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.iconCircle}>
                        <Text style={styles.emojiIcon}>{item.icon}</Text>
                      </View>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        <Text style={styles.itemCategory}>{item.category}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                      <Text style={styles.emptyTitle}>No standard categories found</Text>
                      <TouchableOpacity
                        style={styles.emptyUseBtn}
                        onPress={() => handleSelectCustom(trimmed)}
                      >
                        <Text style={styles.emptyUseBtnText}>Use "{trimmed}" as custom expense</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
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
      justifyContent: 'flex-end',
    },
    keyboardWrap: {
      width: '100%',
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 28,
      maxHeight: '80%',
      borderTopWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitleWrap: {
      flex: 1,
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.h5,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: typography.fonts.body,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.body,
      color: colors.inputText,
      fontFamily: typography.fonts.body,
    },
    customActionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.isDark ? '#331B05' : '#FFF5EE',
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    customActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    customIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customActionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    customActionSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    useBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
    },
    useBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
    },
    sectionHeading: {
      fontFamily: typography.fonts.heading,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 2,
    },
    listContent: {
      gap: 6,
      paddingBottom: 20,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.isDark ? colors.surfaceElevated : '#FFFFFF',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.isDark ? colors.surface : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    emojiIcon: {
      fontSize: 18,
    },
    itemMeta: {
      flex: 1,
    },
    itemLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.body,
      fontWeight: '600',
      color: colors.text,
    },
    itemCategory: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    emptyWrap: {
      padding: 24,
      alignItems: 'center',
      gap: 10,
    },
    emptyTitle: {
      fontSize: typography.sizes.body,
      color: colors.textMuted,
    },
    emptyUseBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.md,
    },
    emptyUseBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
  });
};
