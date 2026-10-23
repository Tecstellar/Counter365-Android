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
import { useLanguage } from '../../context/LanguageContext';

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
  const { t } = useLanguage();
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
                  <Ionicons name="headset" size={24} color="#FF5F00" />
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{t('help', 'Need Help?')}</Text>
              <Text style={styles.subtitle}>
                +91 {supportNumber} • {APP_CONFIG.supportHours}
              </Text>

              {/* Small Action Buttons (Replacing Old Card) */}
              <View style={styles.smallActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCall}
                  style={styles.smallCallBtn}
                  accessibilityLabel="Call Support"
                >
                  <Ionicons name="call" size={15} color="#FFFFFF" />
                  <Text style={styles.smallBtnText}>{t('call', 'Call')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleWhatsApp}
                  style={styles.smallWaBtn}
                  accessibilityLabel="WhatsApp Chat"
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                  <Text style={styles.smallBtnText}>{t('whatsapp_chat', 'WhatsApp Chat')}</Text>
                </TouchableOpacity>
              </View>

              {/* Dismiss */}
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>{t('close', 'Close')}</Text>
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
      maxWidth: 340,
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
      marginBottom: 10,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.isDark ? '#331B05' : 'rgba(255, 95, 0, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
    },
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 3,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    smallActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    smallCallBtn: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FF5F00',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 12,
    },
    smallWaBtn: {
      flex: 1.2,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#25D366',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 12,
    },
    smallBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    cancelBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    cancelText: {
      fontFamily: typography.fonts.body,
      fontSize: 13.5,
      color: colors.textSecondary,
    },
  });
};
