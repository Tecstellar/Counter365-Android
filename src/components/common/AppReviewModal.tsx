import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { storage } from '../../lib/storage';
import { AppButton } from './AppButton';

export const STORAGE_KEY_REVIEWED = '@counterpro/has_reviewed_app';
export const STORAGE_KEY_REVIEW_SNOOZE = '@counterpro/review_snooze_until';

interface AppReviewModalProps {
  visible: boolean;
  totalBills: number;
  onClose: () => void;
}

export const AppReviewModal: React.FC<AppReviewModalProps> = ({
  visible,
  totalBills,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const themeColors = theme.colors;
  const [rating, setRating] = useState(5);

  const handleOpenPlayStore = async () => {
    try {
      await storage.setItem(STORAGE_KEY_REVIEWED, 'true');
      const playStoreAppUrl = 'market://details?id=com.counterpro.app';
      const playStoreWebUrl = 'https://play.google.com/store/apps/details?id=com.counterpro.app';

      const supported = await Linking.canOpenURL(playStoreAppUrl).catch(() => false);
      if (supported && Platform.OS === 'android') {
        await Linking.openURL(playStoreAppUrl);
      } else {
        await Linking.openURL(playStoreWebUrl);
      }
    } catch (err) {
      console.warn('Could not open Play Store URL:', err);
    } finally {
      onClose();
    }
  };

  const handleRemindLater = async () => {
    try {
      // Snooze review prompt for 7 days
      const snoozeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await storage.setItem(STORAGE_KEY_REVIEW_SNOOZE, snoozeUntil.toString());
    } catch {}
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#171717' : '#FFFFFF',
              borderColor: isDark ? '#2A2A2A' : '#E5E7EB',
            },
          ]}
        >
          {/* Top Decorative Badge */}
          <View style={styles.badgeWrap}>
            <View style={[styles.badge, { backgroundColor: isDark ? '#3A2111' : '#FFF3EB' }]}>
              <Ionicons name="sparkles" size={24} color="#FF5F00" />
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: isDark ? '#F5F3F0' : '#111111' },
            ]}
          >
            Enjoying Counter365?
          </Text>

          {/* Subtitle */}
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? '#9A948D' : '#64748B' },
            ]}
          >
            You have created {totalBills}+ bills! Please take a moment to review our app in the Play Store. Your feedback helps us keep Counter365 fast and free.
          </Text>

          {/* 5 Interactive Gold Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={styles.starTouch}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= rating ? '#F59E0B' : isDark ? '#525252' : '#CBD5E1'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <AppButton
              title="Review on Play Store"
              variant="primary"
              onPress={handleOpenPlayStore}
              style={styles.reviewBtn}
            />
            <AppButton
              title="Remind Me Later"
              variant="ghost"
              onPress={handleRemindLater}
              style={styles.laterBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  badgeWrap: {
    marginBottom: 16,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Archivo-Bold',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Archivo-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  starTouch: {
    padding: 4,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  reviewBtn: {
    width: '100%',
    borderRadius: 12,
  },
  laterBtn: {
    width: '100%',
    borderRadius: 12,
  },
});
