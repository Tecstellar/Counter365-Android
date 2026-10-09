import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '../../theme';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { ShopType } from '../../types/models';

interface RegistrationSuccessScreenProps {
  shopName: string;
  shopAddress: string;
  shopPlace: string;
  shopKind: ShopType;
  phone: string;
  isGeoTagged: boolean;
  onStartTour: () => void;
  onRestart: () => void;
  onGoToDashboard: () => void;
}

export const RegistrationSuccessScreen: React.FC<RegistrationSuccessScreenProps> = ({
  shopName,
  shopAddress,
  shopPlace,
  shopKind,
  phone,
  isGeoTagged,
  onStartTour,
  onRestart,
  onGoToDashboard,
}) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 12);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Official Counter365 Brand Logo */}
        <Image
          source={require('../../../assets/counterpro_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        {/* Registration Card */}
        <View style={styles.card}>
          <Text style={styles.cardKicker}>REGISTERED — MASTER ID</Text>
          <Text style={styles.shopName}>{shopName || 'Your shop'}</Text>
          <Text style={styles.addressLine}>{shopAddress || 'Address as entered'}</Text>
          <Text style={styles.addressLine}>{shopPlace}</Text>

          <View style={styles.tagRow}>
            <AppTag label={shopKind} variant="accent" />
            <AppTag label={`+91 ${phone}`} variant="neutral" />
            <AppTag label={isGeoTagged ? 'Location tagged' : 'No location'} variant="neutral" />
          </View>
        </View>

        {/* Welcome Offer Card */}
        <View style={styles.offerCard}>
          <Text style={styles.offerBadge}>🎁 REGISTRATION OFFER ACTIVATED</Text>
          <Text style={styles.offerTitle}>100 Free Bills Plan Active!</Text>
          <Text style={styles.offerDetails}>
            Your shop is unlocked with 100 Free Bills, instant WhatsApp receipts, thermal printing, and udhar ledger with zero monthly fees.
          </Text>
        </View>

        <Text style={styles.description}>
          Your shop is live and this phone number is the owner ID — only this number can create Supervisors and Billers.
        </Text>

        <View style={styles.actions}>
          <AppButton
            title="Start Billing / Go to Dashboard"
            variant="primary"
            onPress={onGoToDashboard}
            style={styles.dashboardBtn}
          />
          <AppButton
            title="Show me around the app"
            variant="secondary"
            onPress={onStartTour}
            style={styles.tourBtn}
          />
          <AppButton
            title="Run the flow again"
            variant="ghost"
            onPress={onRestart}
            style={styles.restartBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 20,
  },
  logoImage: {
    width: 170,
    height: 44,
    alignSelf: 'center',
    marginBottom: 6,
  },
  card: {
    padding: 22,
    backgroundColor: '#111111',
    borderRadius: 24,
    ...shadows.card,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  offerCard: {
    padding: 18,
    backgroundColor: '#FFF7F0',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FF5F00',
    gap: 4,
  },
  offerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5F00',
    fontFamily: typography.fonts.heading,
    letterSpacing: 0.8,
  },
  offerTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
  },
  offerDetails: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
    fontFamily: typography.fonts.body,
  },
  cardKicker: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#FD5E03',
    fontWeight: '800',
    marginBottom: 4,
  },
  shopName: {
    fontFamily: typography.fonts.heading,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: typography.fonts.body,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  description: {
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 20,
    fontFamily: typography.fonts.body,
  },
  actions: {
    gap: 10,
    marginTop: 10,
  },
  dashboardBtn: {
    minHeight: 52,
    borderRadius: 16,
  },
  tourBtn: {
    minHeight: 48,
    borderRadius: 14,
  },
  restartBtn: {
    minHeight: 44,
    borderRadius: 14,
  },
});
