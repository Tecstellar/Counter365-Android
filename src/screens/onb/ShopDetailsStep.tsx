import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Image, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';

interface ShopDetailsStepProps {
  shopName: string;
  shopAddress: string;
  shopState: string;
  shopCity: string;
  shopPincode: string;
  isGeoTagged: boolean;
  hasLogo: boolean;
  logoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedCoords?: string;
  isExtractingGps?: boolean;
  isUploadingLogo?: boolean;
  onChangeName: (text: string) => void;
  onChangeAddress: (text: string) => void;
  onChangeState: (text: string) => void;
  onChangeCity: (text: string) => void;
  onChangePincode: (text: string) => void;
  onTagLocation: () => void;
  onToggleLogo: () => void;
  onNext: () => void;
  onBack: () => void;
}

export const ShopDetailsStep: React.FC<ShopDetailsStepProps> = ({
  shopName,
  shopAddress,
  shopState,
  shopCity,
  shopPincode,
  isGeoTagged,
  hasLogo,
  logoUrl,
  latitude,
  longitude,
  formattedCoords,
  isExtractingGps,
  isUploadingLogo,
  onChangeName,
  onChangeAddress,
  onChangeState,
  onChangeCity,
  onChangePincode,
  onTagLocation,
  onToggleLogo,
  onNext,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const isFormValid = shopName.trim().length > 0 && shopCity.trim().length > 0 && shopPincode.trim().length === 6;

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 12);

  const displayTagText = isGeoTagged
    ? (formattedCoords || (latitude && longitude ? `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E` : '13.1143° N, 80.1548° E'))
    : 'Tag shop location on map';

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      {/* Step Header */}
      <View style={styles.stepHeader}>
        <Image
          source={require('../../../assets/counterpro_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.stepCount}>STEP 3 OF 4</Text>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={styles.progressSegment} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Shop details</Text>
          <Text style={styles.subtitle}>This is what heads every bill you share.</Text>

          <View style={styles.form}>
            <AppInput
              label="Shop name"
              placeholder="e.g. Anandha Tea Stall"
              value={shopName}
              onChangeText={onChangeName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <AppInput
              label="Address"
              placeholder="Door no, street, area"
              value={shopAddress}
              onChangeText={onChangeAddress}
              multiline
              numberOfLines={2}
            />

            {/* Compact Tag Shop Location Button (Placed Up) */}
            <TouchableOpacity
              onPress={onTagLocation}
              disabled={isExtractingGps}
              style={[
                styles.compactGeoBtn,
                isGeoTagged && styles.compactGeoBtnTagged,
              ]}
              activeOpacity={0.75}
            >
              {isExtractingGps ? (
                <ActivityIndicator size="small" color={colors.accent700} />
              ) : (
                <>
                  <Ionicons
                    name="location-sharp"
                    size={13}
                    color={isGeoTagged ? '#059669' : colors.accent700}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[styles.compactGeoText, isGeoTagged && styles.compactGeoTextTagged]}
                    numberOfLines={1}
                  >
                    {isGeoTagged ? `GPS Tagged: ${displayTagText}` : 'Tag shop location (GPS)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <AppInput
              label="State"
              placeholder="e.g. State"
              value={shopState}
              onChangeText={onChangeState}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <View style={styles.row}>
              <AppInput
                label="City / town"
                placeholder="e.g. Chennai"
                value={shopCity}
                onChangeText={onChangeCity}
                style={styles.cityField}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <AppInput
                label="Pincode"
                placeholder="600053"
                value={shopPincode}
                onChangeText={t => onChangePincode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="numeric"
                maxLength={6}
                style={styles.pincodeField}
                returnKeyType="done"
              />
            </View>

          {/* Optional Logo */}
          <View style={styles.logoRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onToggleLogo}
              style={[styles.logoBox, (hasLogo || !!logoUrl) && styles.logoBoxSelected]}
            >
              {isUploadingLogo ? (
                <ActivityIndicator size="small" color={colors.accent700} />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoThumbnail} resizeMode="cover" />
              ) : hasLogo ? (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.accent700} />
                  <Text style={styles.logoText}>LOGO</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.logoText}>+ LOGO</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.logoHint}>
              Shop logo — optional. Sits on the shared bill if you add one.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

      {/* Actions */}
      <View style={styles.actionRow}>
        <AppButton
          variant="secondary"
          onPress={onBack}
          style={styles.backBtn}
          icon={<Ionicons name="arrow-back" size={20} color={colors.text} />}
        />
        <AppButton
          title="Save shop details"
          variant="primary"
          onPress={onNext}
          disabled={!isFormValid}
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
    paddingBottom: 24,
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
    marginBottom: 16,
  },
  form: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cityField: {
    flex: 1.4,
  },
  pincodeField: {
    flex: 1,
  },
  compactGeoBtn: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: 'rgba(253, 94, 3, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
  compactGeoBtnTagged: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  compactGeoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FD5E03',
    fontFamily: typography.fonts.heading,
  },
  compactGeoTextTagged: {
    color: '#059669',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 6,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D7D2C9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBoxSelected: {
    backgroundColor: '#FFF0E6',
    borderColor: '#FD5E03',
  },
  logoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  logoText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '700',
  },
  logoHint: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
    lineHeight: 17,
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
