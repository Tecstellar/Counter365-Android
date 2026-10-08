import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { PaymentMethod } from '../../types/models';
import { colors } from '../../theme';

interface PaymentModeIconProps {
  mode: PaymentMethod | string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

import {
  PaymentIconConfig,
  getPaymentModeVectorConfig,
} from '../../constants/paymentIcons';

export { PaymentIconConfig, getPaymentModeVectorConfig };

export const PaymentModeIcon: React.FC<PaymentModeIconProps> = ({
  mode,
  size = 22,
  color,
  style,
}) => {
  const config = getPaymentModeVectorConfig(mode);
  const iconColor = color || config.defaultColor;

  return (
    <View style={[styles.container, style]}>
      {config.family === 'Ionicons' ? (
        <Ionicons name={config.name as any} size={size} color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={config.name as any} size={size} color={iconColor} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
