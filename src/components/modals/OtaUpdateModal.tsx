import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { shadows, useTheme, typography } from '../../theme';

interface OtaUpdateModalProps {
  visible: boolean;
  onUpdate: () => void;
  onLater?: () => void;
  isUpdating?: boolean;
  isMandatory?: boolean;
}

export const OtaUpdateModal: React.FC<OtaUpdateModalProps> = ({
  visible,
  onUpdate,
  onLater,
  isUpdating = false,
  isMandatory = false,
}) => {
  const { isDark } = useTheme();

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);
      setDisplayPercent(0);
    }
  }, [visible]);

  // Handle progress bar loading when updating begins
  useEffect(() => {
    if (isUpdating) {
      progressAnim.setValue(0);
      setDisplayPercent(5);

      // Animate progress smoothly from 5% to 92%
      Animated.timing(progressAnim, {
        toValue: 0.92,
        duration: 3200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();

      const listenerId = progressAnim.addListener(({ value }) => {
        setDisplayPercent(Math.round(value * 100));
      });

      return () => {
        progressAnim.removeListener(listenerId);
      };
    } else {
      progressAnim.setValue(0);
      setDisplayPercent(0);
    }
  }, [isUpdating]);

  const handleUpdatePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onUpdate();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isMandatory && !isUpdating && onLater) {
          onLater();
        }
      }}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#121620' : '#FFFFFF',
              borderColor: isDark ? '#232938' : 'rgba(0, 0, 0, 0.08)',
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Professional Header Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDark ? 'rgba(255, 95, 0, 0.15)' : '#FFF0E6' },
            ]}
          >
            <Ionicons
              name="cloud-download-outline"
              size={28}
              color={isDark ? '#FF8833' : '#FF5F00'}
            />
          </View>

          {/* Clean Executive Title */}
          <Text
            style={[
              styles.title,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
          >
            Please update to continue
          </Text>

          {/* Professional Message */}
          <Text
            style={[
              styles.description,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            A new version is available with new features, performance enhancements, and stability improvements.
          </Text>

          {/* Interactive Progress Bar (when updating) */}
          {isUpdating ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={[styles.progressStatusText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                  Downloading update...
                </Text>
                <Text style={[styles.progressPercentText, { color: isDark ? '#FF8833' : '#FF5F00' }]}>
                  {displayPercent}%
                </Text>
              </View>

              <View
                style={[
                  styles.progressBarTrack,
                  { backgroundColor: isDark ? '#1E293B' : '#FFE7D6' },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: '#FF5F00',
                    },
                  ]}
                />
              </View>

              <Text style={[styles.progressSubText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                Installing the latest version. This will take just a few seconds.
              </Text>
            </View>
          ) : (
            /* Action Buttons (when ready to update) */
            <View style={styles.actionsWrap}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleUpdatePress}
                activeOpacity={0.88}
                accessibilityLabel="Update App"
              >
                <Ionicons name="arrow-down-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.buttonText}>Update</Text>
              </TouchableOpacity>

              {/* Optional Later Button (if not mandatory) */}
              {!isMandatory && onLater && (
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={onLater}
                  activeOpacity={0.7}
                  accessibilityLabel="Update Later"
                >
                  <Text
                    style={[
                      styles.laterText,
                      { color: isDark ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Later
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...shadows.floating,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actionsWrap: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FF5F00',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  laterButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  laterText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: typography.fonts.body,
  },
  progressContainer: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 6,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStatusText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fonts.numbers,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSubText: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    marginTop: 2,
  },
});
