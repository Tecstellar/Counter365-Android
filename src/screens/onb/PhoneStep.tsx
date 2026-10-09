import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, useTheme } from '../../theme';
import { ProtoIcon } from '../../components/common/ProtoIcon';
import { AuthBackgroundGlows } from '../../components/common/AuthBackgroundGlows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhoneStepProps {
  phone: string;
  onKeyPress?: (key: string) => void;
  onChangePhone?: (phone: string) => void;
  onNext: () => void;
  loading?: boolean;
  error?: string | null;
}

export const PhoneStep: React.FC<PhoneStepProps> = ({
  phone,
  onKeyPress,
  onChangePhone,
  onNext,
  loading = false,
  error = null,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [isFocused, setIsFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Check accessibility reduce motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });
  }, []);

  // Animation values
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const dotFloat = useRef(new Animated.Value(0)).current;

  const logoTranslateY = useRef(new Animated.Value(12)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const cardTranslateY = useRef(new Animated.Value(14)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const checkScale = useRef(new Animated.Value(0)).current;

  // Format phone number: "98765 43210"
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length > 5) {
      return digits.slice(0, 5) + ' ' + digits.slice(5);
    }
    return digits;
  };

  const cleanDigits = phone.replace(/\D/g, '').slice(0, 10);
  const isValid = /^[6-9][0-9]{9}$/.test(cleanDigits);

  // Animate green checkmark pop
  useEffect(() => {
    if (reduceMotion) {
      checkScale.setValue(isValid ? 1 : 0);
      return;
    }
    Animated.spring(checkScale, {
      toValue: isValid ? 1 : 0,
      tension: 180,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isValid, reduceMotion]);

  // Entrance animations
  useEffect(() => {
    if (reduceMotion) {
      logoTranslateY.setValue(0);
      logoOpacity.setValue(1);
      cardTranslateY.setValue(0);
      cardOpacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(logoTranslateY, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(cardTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [reduceMotion]);

  // Concentric rings animation (4.5s ease-out loop, staggered by 1.5s)
  useEffect(() => {
    if (reduceMotion) return;

    const createRingLoop = (anim: Animated.Value, delayMs: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(anim, {
            toValue: 1,
            duration: 4500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const l1 = createRingLoop(ring1, 0);
    const l2 = createRingLoop(ring2, 1500);
    const l3 = createRingLoop(ring3, 3000);

    l1.start();
    l2.start();
    l3.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [reduceMotion]);

  // Floating dots animation
  useEffect(() => {
    if (reduceMotion) return;
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotFloat, {
          toValue: -3,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(dotFloat, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [reduceMotion]);

  // Handle phone input change
  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    if (onChangePhone) {
      onChangePhone(digits);
    } else if (onKeyPress) {
      // Backwards compatibility fallback if only onKeyPress passed
      if (digits.length < cleanDigits.length) {
        onKeyPress('⌫');
      } else {
        const added = digits.slice(-1);
        if (added) onKeyPress(added);
      }
    }
  };

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);

  // Concentric ring interpolations
  const getRingScale = (anim: Animated.Value) =>
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 4.2],
    });

  const getRingOpacity = (anim: Animated.Value) =>
    anim.interpolate({
      inputRange: [0, 0.1, 0.8, 1],
      outputRange: [0.8, 0.8, 0.2, 0],
    });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthBackgroundGlows />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Top Hero Panel (.lhero) */}
        <View style={[styles.heroPanel, { paddingTop: topInset }]}>
          {/* Hero background gradients */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="heroTopRight" cx="85%" cy="0%" rx="90%" ry="80%" fx="85%" fy="0%">
                <Stop offset="0%" stopColor="#FF5F00" stopOpacity={isDark ? 0.5 : 0.3} />
                <Stop offset="60%" stopColor="#FF5F00" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="heroBottomLeft" cx="0%" cy="100%" rx="70%" ry="60%" fx="0%" fy="100%">
                <Stop
                  offset="0%"
                  stopColor={isDark ? '#FF5F00' : '#FFAA6E'}
                  stopOpacity={isDark ? 0.22 : 0.26}
                />
                <Stop offset="60%" stopColor="#FF5F00" stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id="heroLinear" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={isDark ? '#1D1D1D' : '#FFFFFF'} />
                <Stop offset="100%" stopColor={isDark ? '#080808' : '#FCEFE2'} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroLinear)" />
            <Rect width="100%" height="100%" fill="url(#heroTopRight)" />
            <Rect width="100%" height="100%" fill="url(#heroBottomLeft)" />
          </Svg>

          {/* 3 Concentric Rings (.ring, .r2, .r3) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                transform: [{ scale: getRingScale(ring1) }],
                opacity: getRingOpacity(ring1),
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                transform: [{ scale: getRingScale(ring2) }],
                opacity: getRingOpacity(ring2),
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                transform: [{ scale: getRingScale(ring3) }],
                opacity: getRingOpacity(ring3),
              },
            ]}
          />

          {/* 3 Floating Dots (.dotx, .d1, .d2, .d3) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              styles.dot1,
              { transform: [{ translateY: dotFloat }] },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              styles.dot2,
              { transform: [{ translateY: dotFloat }] },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              styles.dot3,
              { transform: [{ translateY: dotFloat }] },
            ]}
          />

          {/* Logo (.llogo) with entrance rise */}
          <Animated.Image
            source={
              isDark
                ? require('../../../assets/logo_dark.png')
                : require('../../../assets/logo_light.png')
            }
            style={[
              styles.heroLogo,
              {
                opacity: logoOpacity,
                transform: [{ translateY: logoTranslateY }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Form Card (.lcard) */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.gc : colors.gc,
              borderColor: isDark ? colors.glb : colors.glb,
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.ink }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mu }]}>
            Enter your mobile number to sign in
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mu }]}>MOBILE NUMBER</Text>

          {/* Phone Field (.pf) */}
          <View
            style={[
              styles.phoneInputContainer,
              {
                backgroundColor: colors.s,
                borderColor: error ? colors.err : isFocused ? '#FF5F00' : colors.ln,
              },
              isFocused && styles.phoneInputFocused,
            ]}
          >
            {/* Country code pill (.cc2) */}
            <View style={[styles.countryCodePill, { borderRightColor: colors.ln }]}>
              <Text style={styles.flagIcon}>🇮🇳</Text>
              <Text style={[styles.countryCodeText, { color: colors.ink }]}>+91</Text>
            </View>

            {/* Input field */}
            <TextInput
              style={[styles.phoneTextInput, { color: colors.ink }]}
              value={formatPhone(cleanDigits)}
              onChangeText={handleChangeText}
              placeholder="98765 43210"
              placeholderTextColor={colors.mu}
              keyboardType="number-pad"
              maxLength={11} // 10 digits + 1 space
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoFocus={true}
              selectionColor="#FF5F00"
            />

            {/* Green Checkmark (.vk) */}
            <Animated.View
              style={[
                styles.validationCheck,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              <ProtoIcon name="ck" size={16} color="#FFFFFF" strokeWidth={2.5} />
            </Animated.View>
          </View>

          {/* Error notice if present */}
          {error ? (
            <View style={styles.errorNotice}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.helperText, { color: colors.mu }]}>
            We'll send a verification code to this number
          </Text>

          {/* Send OTP Button (.btn) */}
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.92}
            disabled={!isValid || loading}
            style={[
              styles.submitButton,
              (!isValid || loading) && styles.submitButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Send OTP</Text>
                <ProtoIcon name="ar" size={20} color="#FFFFFF" strokeWidth={2.2} />
              </>
            )}
          </TouchableOpacity>

          {/* Legal / Terms footer */}
          <Text style={[styles.legalText, { color: colors.mu }]}>
            By continuing you agree to our{' '}
            <Text style={[styles.legalLink, { color: colors.ink }]}>Terms of Service</Text> and{' '}
            <Text style={[styles.legalLink, { color: colors.ink }]}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  heroPanel: {
    height: 330,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    // shadow
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 10,
  },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 95, 0, 0.5)',
  },
  dot: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: 'rgba(255, 120, 40, 0.35)',
  },
  dot1: {
    width: 10,
    height: 10,
    left: '14%',
    top: '30%',
  },
  dot2: {
    width: 16,
    height: 16,
    right: '16%',
    top: '22%',
  },
  dot3: {
    width: 8,
    height: 8,
    right: '26%',
    bottom: '26%',
  },
  heroLogo: {
    width: 236,
    height: 58,
    zIndex: 5,
  },
  card: {
    marginTop: -44,
    marginHorizontal: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    // Card shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontFamily: 'Jost',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: 'Lexend',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  fieldLabel: {
    fontFamily: 'Lexend',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  phoneInputContainer: {
    height: 62,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  phoneInputFocused: {
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 12,
    borderRightWidth: 1,
    height: 28,
  },
  flagIcon: {
    fontSize: 18,
  },
  countryCodeText: {
    fontFamily: 'Lexend',
    fontSize: 16,
    fontWeight: '700',
  },
  phoneTextInput: {
    flex: 1,
    fontFamily: 'Lexend',
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: 1.2,
    padding: 0,
    margin: 0,
  },
  validationCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#138A4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorNotice: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  errorText: {
    color: '#D93A1F',
    fontSize: 13,
    fontFamily: 'Lexend',
    fontWeight: '600',
  },
  helperText: {
    fontFamily: 'Lexend',
    fontSize: 12.5,
    marginTop: 10,
    marginBottom: 22,
    marginHorizontal: 2,
  },
  submitButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#FF5F00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend',
    fontSize: 16,
    fontWeight: '700',
  },
  legalText: {
    fontFamily: 'Lexend',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 18,
  },
  legalLink: {
    fontWeight: '700',
  },
});
