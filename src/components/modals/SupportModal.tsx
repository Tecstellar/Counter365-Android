import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { APP_CONFIG } from '../../constants/appConfig';
import { AppButton } from '../common/AppButton';

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  supportNumber?: string;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  visible,
  onClose,
  supportNumber = APP_CONFIG.supportPhone,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const handleCall = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(`tel:${supportNumber}`);
  };

  const handleWhatsApp = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(`https://wa.me/91${supportNumber}?text=${encodeURIComponent('Hi Counter365 Support, I need assistance with my app.')}`);
  };

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
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="headset" size={26} color={colors.accent700} />
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>Need Help?</Text>
              <Text style={styles.subtitle}>
                Contact our support team for assistance.
              </Text>

              {/* Number Card */}
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>Support Number:</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCall}
                  style={styles.phoneTouchRow}
                >
                  <Ionicons name="call" size={20} color={colors.accent700} />
                  <Text style={styles.numberText}>{supportNumber}</Text>
                </TouchableOpacity>
                <Text style={styles.hoursText}>
                  Operating hours: {APP_CONFIG.supportHours}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <AppButton
                  title="Call Support"
                  variant="primary"
                  icon={<Ionicons name="call-outline" size={17} color="#FFFFFF" />}
                  onPress={handleCall}
                  style={styles.actionBtn}
                />
                <AppButton
                  title="WhatsApp"
                  variant="secondary"
                  icon={<Ionicons name="logo-whatsapp" size={17} color="#25D366" />}
                  onPress={handleWhatsApp}
                  style={styles.actionBtn}
                />
              </View>

              {/* Dismiss */}
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Close</Text>
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
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.isDark ? '#331B05' : colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.h4,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    numberBox: {
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
      borderRadius: radii.md,
      padding: 14,
      marginTop: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    numberLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    phoneTouchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    numberText: {
      fontFamily: typography.fonts.heading,
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 1,
    },
    hoursText: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 6,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    actionBtn: {
      flex: 1,
      minHeight: 44,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
};
