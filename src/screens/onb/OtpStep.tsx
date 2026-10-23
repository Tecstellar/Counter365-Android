import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, useTheme } from '../../theme';
import { ProtoIcon } from '../../components/common/ProtoIcon';
import { AuthBackgroundGlows } from '../../components/common/AuthBackgroundGlows';

interface OtpStepProps {
  phone: string;
  otp: string;
  onKeyPress?: (key: string) => void;
  onChangeOtp?: (otp: string) => void;
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
  onChangeOtp,
  onEditPhone,
  onNext,
  onBack,
  onResend,
  loading = false,
  error = null,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSuccessView, setIsSuccessView] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => setIsKeyboardVisible(true);
    const onHide = () => setIsKeyboardVisible(false);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Input refs for 6 boxes
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Animation values
  const lockPopAnim = useRef(new Animated.Value(0.92)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const lockPulseScale = useRef(new Animated.Value(1)).current;
  const lockPulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Error shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Box entrance pop animations (staggered)
  const boxPops = useRef([
    new Animated.Value(0.9),
    new Animated.Value(0.9),
    new Animated.Value(0.9),
    new Animated.Value(0.9),
    new Animated.Value(0.9),
    new Animated.Value(0.9),
  ]).current;
  const boxOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Success verified animations
  const successScale = useRef(new Animated.Value(0.92)).current;
  const successRippleScale = useRef(new Animated.Value(1)).current;
  const successRippleOpacity = useRef(new Animated.Value(0.6)).current;

  // Toast animation
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Check accessibility reduce motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });
  }, []);

  // Format phone display
  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  const formattedPhone =
    cleanPhone.length > 5
      ? cleanPhone.slice(0, 5) + ' ' + cleanPhone.slice(5)
      : cleanPhone;

  // Auto-focus first input after 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // Lock tile entrance pop animation
  useEffect(() => {
    if (reduceMotion) {
      lockPopAnim.setValue(1);
      lockOpacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(lockPopAnim, {
        toValue: 1,
        tension: 180,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(lockOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion]);

  // Lock tile repeating pulse ring (.lkt:after, 2.4s ease-out loop)
  useEffect(() => {
    if (reduceMotion) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(lockPulseScale, {
            toValue: 1.35,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(lockPulseOpacity, {
            toValue: 0,
            duration: 2400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(lockPulseScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(lockPulseOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [reduceMotion]);

  // Staggered box entrance animations (calc(var(--i)*60ms + 200ms))
  useEffect(() => {
    if (reduceMotion) {
      boxPops.forEach(p => p.setValue(1));
      boxOpacities.forEach(o => o.setValue(1));
      return;
    }

    const anims = boxPops.map((pop, i) => {
      return Animated.sequence([
        Animated.delay(200 + i * 60),
        Animated.parallel([
          Animated.spring(pop, {
            toValue: 1,
            tension: 160,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(boxOpacities[i], {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(anims).start();
  }, [reduceMotion]);

  // Resend 30s countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Trigger error shake when error prop changes
  useEffect(() => {
    if (error) {
      triggerErrorShake();
    }
  }, [error]);

  const triggerErrorShake = () => {
    if (reduceMotion) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -7, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const handleResendClick = () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(30);
    showToast('Code sent again');
    if (onChangeOtp) {
      onChangeOtp('');
    }
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    if (onResend) {
      onResend();
    }
  };

  const updateOtpString = (newOtp: string) => {
    const clean = newOtp.replace(/\D/g, '').slice(0, 6);
    if (onChangeOtp) {
      onChangeOtp(clean);
    } else if (onKeyPress) {
      // Compatibility fallback
      if (clean.length < otp.length) {
        onKeyPress('⌫');
      } else {
        const added = clean.slice(-1);
        if (added) onKeyPress(added);
      }
    }
  };

  const handleBoxChange = (text: string, index: number) => {
    const raw = text.replace(/\D/g, '');

    // Handle multi-character paste
    if (raw.length > 1) {
      const full = raw.slice(0, 6);
      updateOtpString(full);
      const nextIdx = Math.min(full.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const currentArr = otp.split('');
    if (raw.length === 1) {
      currentArr[index] = raw;
      const combined = currentArr.join('').slice(0, 6);
      updateOtpString(combined);
      // Auto-advance to next box
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      currentArr[index] = '';
      const combined = currentArr.join('').slice(0, 6);
      updateOtpString(combined);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move back to previous box and clear it
        const currentArr = otp.split('');
        currentArr[index - 1] = '';
        updateOtpString(currentArr.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = () => {
    if (otp.length < 6 || loading) return;
    onNext();
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);

  // If success view triggered
  if (isSuccessView) {
    return (
      <View style={[styles.root, styles.verifiedRoot]}>
        <AuthBackgroundGlows />
        <View style={styles.verifiedContainer}>
          <Animated.View
            style={[
              styles.verifiedCircle,
              {
                transform: [{ scale: successScale }],
              },
            ]}
          >
            {/* Expanding ripple ring */}
            <Animated.View
              style={[
                styles.verifiedRipple,
                {
                  transform: [{ scale: successRippleScale }],
                  opacity: successRippleOpacity,
                },
              ]}
            />
            <ProtoIcon name="ck" size={44} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>

          <Text style={[styles.verifiedTitle, { color: colors.ink }]}>Verified</Text>
          <Text style={[styles.verifiedSubtitle, { color: colors.mu }]}>Signing you in…</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthBackgroundGlows />

      {/* Floating Toast notification */}
      {toastMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + 76,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Top Back Row (.row) */}
        <View style={styles.topBackRow}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.8}
            style={[styles.backButton, { backgroundColor: colors.s }]}
            aria-label="Back"
          >
            <ProtoIcon name="back" size={20} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content Area (padding: 0 24px) */}
        <View style={styles.contentArea}>
          {/* Lock tile (.lkt) with animated pulse ring */}
          <Animated.View
            style={[
              styles.lockTile,
              isKeyboardVisible && styles.lockTileKeyboard,
              {
                backgroundColor: colors.os,
                opacity: lockOpacity,
                transform: [{ scale: lockPopAnim }],
              },
            ]}
          >
            {/* Animated pulse ring */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lockPulseRing,
                {
                  transform: [{ scale: lockPulseScale }],
                  opacity: lockPulseOpacity,
                },
              ]}
            />
            <ProtoIcon name="lock" size={isKeyboardVisible ? 24 : 30} color={colors.ot} strokeWidth={2} />
          </Animated.View>

          {/* Title (.lh) */}
          <Text style={[styles.title, isKeyboardVisible && styles.titleKeyboard, { color: colors.ink }]}>
            Verify your number
          </Text>

          {/* Subtitle with Edit link (.mu, .edt) */}
          <View style={styles.subtitleRow}>
            <Text style={[styles.subtitle, { color: colors.mu }]}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={[styles.subtitlePhone, { color: colors.ink }]}>
                +91 {formattedPhone}
              </Text>
              {'  '}
              <Text onPress={onEditPhone} style={[styles.editButton, { color: colors.ot }]}>
                Edit
              </Text>
            </Text>
          </View>

          {/* Six Code Boxes (.obs, .ob) with shake animation on error */}
          <Animated.View
            style={[
              styles.otpBoxesRow,
              isKeyboardVisible && styles.otpBoxesRowKeyboard,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {[0, 1, 2, 3, 4, 5].map(idx => {
              const val = otp[idx] || '';
              const isFilled = Boolean(val);
              const isFocused = focusedIndex === idx;
              const hasError = Boolean(error);

              return (
                <Animated.View
                  key={idx}
                  style={[
                    styles.otpBoxWrapper,
                    {
                      opacity: boxOpacities[idx],
                      transform: [{ scale: boxPops[idx] }],
                    },
                  ]}
                >
                  <TextInput
                    ref={el => {
                      inputRefs.current[idx] = el;
                    }}
                    style={[
                      styles.otpBox,
                      Platform.OS === 'android' ? styles.otpBoxAndroid : styles.otpBoxIos,
                      {
                        backgroundColor: isFilled ? colors.os : colors.s,
                        borderColor: hasError
                          ? colors.err
                          : isFocused
                          ? '#FF5F00'
                          : isFilled
                          ? 'rgba(255,95,0,0.5)'
                          : colors.ln,
                        color: colors.ink,
                      },
                      isFocused && styles.otpBoxFocused,
                    ]}
                    value={val}
                    onChangeText={text => handleBoxChange(text, idx)}
                    onKeyPress={e => handleKeyPress(e, idx)}
                    onFocus={() => setFocusedIndex(idx)}
                    keyboardType="number-pad"
                    maxLength={idx === 0 ? 6 : 1} // Allows paste into first box
                    selectTextOnFocus
                    selectionColor="#FF5F00"
                    aria-label={`Digit ${idx + 1}`}
                  />
                </Animated.View>
              );
            })}
          </Animated.View>

          {/* Error Message if present */}
          {error ? (
            <View style={styles.errorNotice}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Resend Area (.rsw, .rsd, .rsb, .rs) */}
          <View style={styles.resendArea}>
            {secondsLeft > 0 ? (
              <>
                <Text style={[styles.resendText, { color: colors.mu }]}>
                  Resend code in{' '}
                  <Text style={[styles.resendBold, { color: colors.ink }]}>
                    0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}
                  </Text>
                </Text>

                {/* Progress bar shrinking over 30 seconds */}
                <View style={[styles.progressBarTrack, { backgroundColor: colors.ln }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${(secondsLeft / 30) * 100}%`,
                        backgroundColor: '#FF5F00',
                      },
                    ]}
                  />
                </View>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleResendClick}
                activeOpacity={0.8}
                style={styles.resendButton}
              >
                <Text style={[styles.resendButtonText, { color: colors.ot }]}>
                  Resend code
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Verify & continue Button (.btn) */}
          <TouchableOpacity
            onPress={handleVerify}
            activeOpacity={0.92}
            disabled={otp.length < 6 || loading}
            style={[
              styles.verifyButton,
              (otp.length < 6 || loading) && styles.verifyButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify &amp; continue</Text>
            )}
          </TouchableOpacity>
        </View>
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
  topBackRow: {
    paddingHorizontal: 20,
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  contentArea: {
    paddingHorizontal: 24,
  },
  lockTile: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    position: 'relative',
  },
  lockTileKeyboard: {
    marginTop: 8,
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  lockPulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FF5F00',
  },
  title: {
    fontFamily: 'Jost',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 20,
  },
  titleKeyboard: {
    marginTop: 10,
    fontSize: 22,
  },
  subtitleRow: {
    marginTop: 6,
  },
  subtitle: {
    fontFamily: 'Lexend',
    fontSize: 13.5,
    lineHeight: 20,
  },
  subtitlePhone: {
    fontWeight: '700',
  },
  editButton: {
    fontFamily: 'Lexend',
    fontWeight: '700',
    fontSize: 13,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
    justifyContent: 'space-between',
  },
  otpBoxesRowKeyboard: {
    marginTop: 14,
  },
  otpBoxWrapper: {
    flex: 1,
  },
  otpBox: {
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 24,
    padding: 0,
  },
  otpBoxIos: {
    fontFamily: 'Lexend',
    fontWeight: '700',
  },
  otpBoxAndroid: {
    fontFamily: 'Lexend-Bold',
  },
  otpBoxFocused: {
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  errorNotice: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  errorText: {
    color: '#D93A1F',
    fontSize: 13,
    fontFamily: 'Lexend',
    fontWeight: '600',
    textAlign: 'center',
  },
  resendArea: {
    marginTop: 22,
    alignItems: 'center',
  },
  resendText: {
    fontFamily: 'Lexend',
    fontSize: 13.5,
  },
  resendBold: {
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 3,
    marginTop: 10,
    width: 120,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  resendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendButtonText: {
    fontFamily: 'Lexend',
    fontSize: 14,
    fontWeight: '700',
  },
  verifyButton: {
    marginTop: 26,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  verifyButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend',
    fontSize: 16,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(17,17,17,0.85)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend',
    fontSize: 13.5,
    fontWeight: '600',
  },
  verifiedRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 12,
  },
  verifiedRipple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#FF5F00',
  },
  verifiedTitle: {
    fontFamily: 'Jost',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 26,
  },
  verifiedSubtitle: {
    fontFamily: 'Lexend',
    fontSize: 14.5,
    marginTop: 6,
  },
});
