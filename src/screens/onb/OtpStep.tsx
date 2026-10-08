import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';

interface OtpStepProps {
  phone: string;
  otp: string;
  onKeyPress: (key: string) => void;
  onEditPhone: () => void;
  onNext: () => void;
  onBack: () => void;
  onResend?: () => void;
  loading?: boolean;
  error?: string | null;
}

export const OtpStep: React.FC<OtpStepProps> = ({
  phone,
  otp,
  onKeyPress,
  onEditPhone,
  onNext,
  onBack,
  onResend,
  loading = false,
  error = null,
}) => {
  const insets = useSafeAreaInsets();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  const otpBoxes = [0, 1, 2, 3, 4, 5];

  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleTriggerResend = () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(30);
    if (onResend) {
      onResend();
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 12);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      {/* Step Header */}
      <View style={styles.stepHeader}>
        <Image
          source={require('../../../assets/counterpro_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.stepCount}>STEP 2 OF 4</Text>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={styles.progressSegment} />
        <View style={styles.progressSegment} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>
          Sent to +91 {phone} —{' '}
          <Text onPress={onEditPhone} style={styles.changeLink}>
            change
          </Text>
        </Text>

        {/* 6 OTP Boxes */}
        <View style={styles.otpBoxesRow}>
          {otpBoxes.map(idx => {
            const val = otp[idx] || '';
            const isActive = otp.length === idx;
            const hasError = !!error;
            return (
              <View
                key={idx}
                style={[
                  styles.otpBox,
                  isActive && styles.activeOtpBox,
                  hasError && styles.errorOtpBox,
                ]}
              >
                <Text style={styles.otpBoxText}>{val}</Text>
              </View>
            );
          })}
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Resend Timer / Action */}
        <View style={styles.resendContainer}>
          {secondsLeft > 0 ? (
            <Text style={styles.resendText}>
              Resend code in 0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleTriggerResend} activeOpacity={0.7}>
              <Text style={styles.resendLinkText}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Keypad */}
      <View style={styles.keypad}>
        <View style={styles.keyGrid}>
          {keys.map((k, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              disabled={!k || loading}
              onPress={() => onKeyPress(k)}
              style={[styles.keyButton, !k && styles.emptyKey]}
            >
              <Text style={styles.keyText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <AppButton
          variant="secondary"
          onPress={onBack}
          disabled={loading}
          style={styles.backBtn}
          icon={<Ionicons name="arrow-back" size={20} color={colors.text} />}
        />
        <AppButton
          title="Verify & continue"
          variant="primary"
          onPress={onNext}
          loading={loading}
          disabled={otp.length < 6 || loading}
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  logoImage: {
    width: 120,
    height: 30,
  },
  stepCount: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E0D8',
  },
  activeSegment: {
    backgroundColor: '#FD5E03',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
  },
  changeLink: {
    color: '#FD5E03',
    fontWeight: '700',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 18,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EFECE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  activeOtpBox: {
    backgroundColor: '#FFF0E6',
    borderColor: '#FD5E03',
  },
  errorOtpBox: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  otpBoxText: {
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
  },
  resendContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
  },
  resendLinkText: {
    fontSize: 12.5,
    color: '#FD5E03',
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  keypad: {
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  keyButton: {
    width: '31%',
    height: 50,
    borderWidth: 1,
    borderColor: '#EFECE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    ...shadows.sm,
  },
  emptyKey: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keyText: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
    backgroundColor: '#FAF7F2',
    gap: 10,
  },
  backBtn: {
    width: 54,
    minHeight: 50,
    borderRadius: 16,
  },
  backArrow: {
    fontSize: 20,
    color: colors.text,
  },
  nextBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
  },
});
