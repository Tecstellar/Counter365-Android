import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, shadows, radii } from '../../theme';
import { AppButton } from '../common/AppButton';
import { formatRupee } from '../../lib/money';

interface CartBarProps {
  totalAmount: number;
  totalCount: number;
  paymentMode: string;
  onGoToBill: () => void;
}

export const CartBar: React.FC<CartBarProps> = ({
  totalAmount,
  totalCount,
  paymentMode,
  onGoToBill,
}) => {
  if (totalCount <= 0) return null;

  const countLabel = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.count}>{countLabel}</Text>
        <Text style={styles.total}>{formatRupee(totalAmount)}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onGoToBill}
        style={styles.billButton}
      >
        <Text style={styles.billButtonText}>Proceed to Bill</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#111111',
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    ...shadows.floating,
  },
  info: {
    flex: 1,
  },
  count: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  total: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  billButton: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF5F00',
    paddingHorizontal: 18,
    borderRadius: 13,
  },
  billButtonText: {
    fontFamily: typography.fonts.heading,
    fontSize: 13.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
