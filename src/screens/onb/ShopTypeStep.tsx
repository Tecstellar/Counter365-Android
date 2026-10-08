import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../../theme';
import { AppButton } from '../../components/common/AppButton';
import { ShopType } from '../../types/models';

const KIND_OPTIONS: Array<{
  name: ShopType;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { name: 'Tea Shop', note: 'Tea, snacks, cold', icon: 'cafe-outline' },
  { name: 'Cafe', note: 'Coffee, bakes', icon: 'color-filter-outline' },
  { name: 'Fast Food', note: 'Rolls, fried, cold', icon: 'fast-food-outline' },
  { name: 'Tiffin Shop', note: 'Morning, evening', icon: 'restaurant-outline' },
  { name: 'Restaurant', note: 'Starters, main', icon: 'storefront-outline' },
];

interface ShopTypeStepProps {
  selectedKind: ShopType;
  onSelectKind: (kind: ShopType) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ShopTypeStep: React.FC<ShopTypeStepProps> = ({
  selectedKind,
  onSelectKind,
  onNext,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
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
        <Text style={styles.stepCount}>STEP 4 OF 4</Text>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
        <View style={[styles.progressSegment, styles.activeSegment]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>What kind of shop?</Text>
        <Text style={styles.subtitle}>
          We load a starter menu and the right report for your trade. Everything is editable later.
        </Text>

        <View style={styles.optionsList}>
          {KIND_OPTIONS.map((item, idx) => {
            const isSelected = selectedKind === item.name;
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => onSelectKind(item.name)}
                style={[
                  styles.optionCard,
                  isSelected && styles.selectedOptionCard,
                ]}
              >
                <View style={[styles.iconWrap, isSelected && styles.selectedIconWrap]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={isSelected ? colors.accent : colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionName, isSelected && styles.selectedOptionName]}>
                    {item.name}
                  </Text>
                  <Text style={styles.optionNote}>{item.note}</Text>
                </View>
                <View
                  style={[
                    styles.radioDot,
                    isSelected && styles.selectedRadioDot,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actionRow}>
        <AppButton
          variant="secondary"
          onPress={onBack}
          style={styles.backBtn}
          icon={<Ionicons name="arrow-back" size={20} color={colors.text} />}
        />
        <AppButton
          title="Start billing"
          variant="primary"
          onPress={onNext}
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
  optionsList: {
    gap: 10,
  },
  optionCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#EFECE6',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    ...shadows.card,
  },
  selectedOptionCard: {
    borderColor: '#FD5E03',
    backgroundColor: '#FFF0E6',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconWrap: {
    backgroundColor: '#FFFFFF',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D7D2C9',
    backgroundColor: 'transparent',
  },
  selectedRadioDot: {
    borderColor: '#FD5E03',
    backgroundColor: '#FD5E03',
  },
  optionName: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  selectedOptionName: {
    fontWeight: '800',
    color: colors.text,
  },
  optionNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
    marginTop: 2,
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
