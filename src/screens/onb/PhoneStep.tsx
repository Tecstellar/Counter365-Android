import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '../../theme';
import { AppButton } from '../../components/common/AppButton';

interface PhoneStepProps {
  phone: string;
  onKeyPress: (key: string) => void;
  onNext: () => void;
  loading?: boolean;
  error?: string | null;
}

export const PhoneStep: React.FC<PhoneStepProps> = ({
  phone,
  onKeyPress,
  onNext,
  loading = false,
  error = null,
}) => {
  const insets = useSafeAreaInsets();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  // Format phone display with placeholder underscores: e.g. "98404 12345" or "98404 _____"
  const formatMask = (num: string) => {
    let res = '';
    for (let i = 0; i < 10; i++) {
      if (i === 5) res += ' ';
      res += i < num.length ? num[i] : '_';
    }
    return res;
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
        <Text style={styles.stepCount}>STEP 1 OF 4</Text>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={styles.progressSegment} />
        <View style={styles.progressSegment} />
        <View style={styles.progressSegment} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your phone number</Text>
        <Text style={styles.subtitle}>
          We send a 6-digit code. This number becomes the owner's master ID — no password to forget.
        </Text>

        {/* Phone Input Box */}
        <View style={[styles.phoneBox, !!error && styles.phoneBoxError]}>
          <Text style={styles.countryCode}>+91</Text>
          <Text style={styles.maskedPhone}>{formatMask(phone)}</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.legalNote}>
          By continuing you accept the <Text style={styles.link}>Terms</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>.
        </Text>
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

      {/* Next Button */}
      <View style={styles.actionRow}>
        <AppButton
          title="Send OTP"
          variant="primary"
          onPress={onNext}
          loading={loading}
          disabled={phone.length < 10 || loading}
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
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECE6',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginVertical: 16,
    ...shadows.card,
  },
  phoneBoxError: {
    borderColor: '#DC2626',
  },
  countryCode: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    fontWeight: '800',
    color: '#FD5E03',
    marginRight: 12,
  },
  maskedPhone: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
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
  legalNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    fontFamily: typography.fonts.body,
  },
  link: {
    color: '#FD5E03',
    fontWeight: '600',
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
    backgroundColor: '#FAF7F2',
  },
  nextBtn: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
  },
});
