import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, shadows } from '../../theme';

interface TrialExpiredLockModalProps {
  visible: boolean;
  onSubscribe: () => void;
  shopName?: string;
  trialEndDateFormatted?: string;
  totalBillsCreated?: number;
}

export const TrialExpiredLockModal: React.FC<TrialExpiredLockModalProps> = ({
  visible,
  onSubscribe,
  shopName,
  trialEndDateFormatted,
  totalBillsCreated = 100,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        // Non-dismissible lock: subscription required when 100 bills limit is reached
      }}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          {/* Brand Logo Header */}
          <View style={styles.logoRow}>
            <Image
              source={require('../../../assets/counterpro_logo_white.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Alert Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="receipt-outline" size={48} color={colors.accent900} />
          </View>

          {/* Heading and Copy strictly matching requirements */}
          <Text style={styles.kicker}>100 FREE BILLS LIMIT REACHED</Text>
          <Text style={styles.title}>You have used your 100 free bills.</Text>

          <Text style={styles.description}>
            Subscribe to continue creating bills on Counter365.
          </Text>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Free Plan Limit:</Text>
            <Text style={styles.metaValue}>{totalBillsCreated} / 100 Bills Used</Text>
          </View>

          {shopName && (
            <Text style={styles.shopNotice}>
              Shop: <Text style={styles.shopNoticeBold}>{shopName}</Text>
            </Text>
          )}

          {/* Mandatory SUBSCRIBE Action Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onSubscribe}
            style={styles.subscribeBtn}
          >
            <Text style={styles.subscribeBtnText}>SUBSCRIBE</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.helperText}>
            Select from our 1, 3, 6, or 12 month plans. Instant activation via PayU (UPI, Cards, NetBanking).
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.accent900, // CounterPro Brand Dark background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 28,
    alignItems: 'center',
    ...shadows.lg,
  },
  logoRow: {
    marginBottom: 16,
    backgroundColor: colors.accent900,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  logoImage: {
    width: 140,
    height: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  kicker: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    letterSpacing: 1.2,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: '#991B1B',
  },
  metaValue: {
    fontSize: 12,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#991B1B',
  },
  shopNotice: {
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  shopNoticeBold: {
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
    color: colors.text,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: colors.accent900,
    paddingVertical: 16,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
    letterSpacing: 1,
  },
  helperText: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
});
