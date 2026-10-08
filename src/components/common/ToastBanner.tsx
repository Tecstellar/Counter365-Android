import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, shadows } from '../../theme';

interface ToastBannerProps {
  message: string | null;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ message }) => {
  if (!message) return null;

  const isAlert = message.toLowerCase().includes('failed') || 
                  message.toLowerCase().includes('error') || 
                  message.toLowerCase().includes('deleted');

  return (
    <View style={styles.container}>
      <View style={styles.capsule}>
        <View style={[styles.iconBox, isAlert ? styles.alertIconBox : styles.successIconBox]}>
          <Ionicons
            name={isAlert ? 'information-circle' : 'checkmark-circle'}
            size={16}
            color={isAlert ? '#F87171' : '#34D399'}
          />
        </View>
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 84,
    alignItems: 'center',
    zIndex: 9999,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    maxWidth: '100%',
    gap: 10,
    ...shadows.lg,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconBox: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  alertIconBox: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.bodyMedium,
    fontWeight: '500',
    flexShrink: 1,
  },
});
