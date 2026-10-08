export interface PaymentIconConfig {
  family: 'MaterialCommunityIcons' | 'Ionicons';
  name: string;
  defaultColor: string;
}

export function getPaymentModeVectorConfig(mode?: string): PaymentIconConfig {
  const clean = (mode || '').toLowerCase().trim();

  // Split / Cash + GPay
  if (clean.includes('split') || (clean.includes('cash') && clean.includes('gpay'))) {
    return {
      family: 'MaterialCommunityIcons',
      name: 'credit-card-sync-outline',
      defaultColor: '#D97706',
    };
  }

  // Partial Pay
  if (clean.includes('partial')) {
    return {
      family: 'MaterialCommunityIcons',
      name: 'scale-balance',
      defaultColor: '#EA580C',
    };
  }

  // Pending / Credit / Due
  if (clean.includes('pend') || clean.includes('due') || clean.includes('credit')) {
    return {
      family: 'MaterialCommunityIcons',
      name: 'clock-alert-outline',
      defaultColor: '#DC2626',
    };
  }

  // GPay / UPI / Online / PhonePe
  if (clean.includes('gpay') || clean.includes('upi') || clean.includes('online') || clean.includes('qr')) {
    return {
      family: 'MaterialCommunityIcons',
      name: 'qrcode-scan',
      defaultColor: '#2563EB',
    };
  }

  // Default: Cash
  return {
    family: 'MaterialCommunityIcons',
    name: 'cash-multiple',
    defaultColor: '#059669',
  };
}
