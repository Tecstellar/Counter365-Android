import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows, useTheme } from '../../theme';
import { APP_CONFIG } from '../../constants/appConfig';
import { AppVersionConfig } from '../../services/versionService';

interface MandatoryUpdateModalProps {
  visible: boolean;
  config: AppVersionConfig | null;
  currentVersion?: string;
}

export const MandatoryUpdateModal: React.FC<MandatoryUpdateModalProps> = ({
  visible,
  config,
  currentVersion = APP_CONFIG.version,
}) => {
  const { theme, isDark } = useTheme();

  const handleUpdatePress = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    const url = config?.downloadUrl || APP_CONFIG.playStoreUrl;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(APP_CONFIG.playStoreUrl);
      }
    } catch (err) {
      console.warn('Could not open update download URL:', err);
    }
  };

  const title = config?.updateTitle || 'Update Required';
  const message =
    config?.updateMessage ||
    'Please update the app to continue using the service.';
  const requiredVersion = config?.minRequiredVersion || 'Latest';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Strict Mandatory Enforcement: Android back button cannot dismiss
      }}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: isDark ? '#27272A' : '#E4E4E7',
            },
          ]}
        >
          {/* Header Icon with Outer Glow */}
          <View style={styles.iconGlowWrapper}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download" size={36} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
          >
            {title}
          </Text>

          {/* Description Message */}
          <Text
            style={[
              styles.message,
              { color: isDark ? '#A1A1AA' : '#64748B' },
            ]}
          >
            {message}
          </Text>

          {/* Version Info Pill */}
          <View
            style={[
              styles.versionPill,
              {
                backgroundColor: isDark ? '#27272A' : '#F1F5F9',
                borderColor: isDark ? '#3F3F46' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Installed</Text>
              <Text
                style={[
                  styles.versionValue,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                v{currentVersion}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#FF5F00" />
            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Required</Text>
              <Text style={[styles.versionValue, { color: '#FF5F00' }]}>
                v{requiredVersion}
              </Text>
            </View>
          </View>

          {/* Mandatory Enforcement Notice */}
          <View style={styles.noticeRow}>
            <Ionicons name="shield-checkmark" size={15} color="#10B981" />
            <Text style={styles.noticeText}>
              Crucial performance & data security update
            </Text>
          </View>

          {/* Primary Action Button — Update Now */}
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdatePress}
            activeOpacity={0.88}
          >
            <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" />
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          {/* Support Assistance Footnote */}
          <Text style={styles.footnote}>
            Need help? Contact support on WhatsApp: {APP_CONFIG.supportPhoneFormatted}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 26,
    alignItems: 'center',
    ...shadows.floating,
  },
  iconGlowWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255, 95, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: typography.fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  versionCol: {
    alignItems: 'center',
  },
  versionLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  versionValue: {
    fontFamily: typography.fonts.numbers,
    fontSize: 15,
    fontWeight: '800',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  noticeText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF5F00',
    width: '100%',
    height: 52,
    borderRadius: radii.xl,
    ...shadows.md,
    marginBottom: 14,
  },
  updateButtonText: {
    fontFamily: typography.fonts.heading,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footnote: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
});
