import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radii, shadows, spacing, typography, useTheme } from '../../theme';

interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  showHandle?: boolean;
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  visible,
  onClose,
  children,
  style,
  title,
  showHandle = true,
}) => {
  const { theme } = useTheme();
  const themeColors = theme.colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kbWrap}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: themeColors.surface }, style]}>
                {/* Drag Handle */}
                {showHandle && (
                  <View style={styles.handleWrap}>
                    <View style={[styles.handle, { backgroundColor: themeColors.neutral300 }]} />
                  </View>
                )}

                {/* Optional header title */}
                {title && (
                  <View style={[styles.titleRow, { borderBottomColor: themeColors.divider }]}>
                    <Text style={[styles.titleText, { color: themeColors.text }]}>{title}</Text>
                    <TouchableOpacity
                      onPress={onClose}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={[styles.closeBtn, { backgroundColor: themeColors.neutral100 }]}
                    >
                      <Text style={[styles.closeText, { color: themeColors.textMuted }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {children}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  kbWrap: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay62,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xlSection,
    maxHeight: '90%',
    ...shadows.lg,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral300,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: 16,
  },
  titleText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h5,
    color: colors.text,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
