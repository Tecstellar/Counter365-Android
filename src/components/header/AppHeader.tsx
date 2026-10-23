import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, Animated, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { useLanguage } from '../../context/LanguageContext';

interface AppHeaderProps {
  onOpenMenu: () => void;
  onOpenReports: () => void;
  todayLabel?: string;
}

const UniqueAnimatedHeaderMenuButton: React.FC<{
  onPress: () => void;
  theme: any;
}> = ({ onPress, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-8deg'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: spin }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          onPress();
        }}
        style={styles.menuButton}
        accessibilityLabel="Open Navigation Menu"
      >
        {/* Unique Staggered Hamburger Lines */}
        <View style={styles.menuLinesWrapper}>
          <View style={[styles.menuLine, styles.menuLineTop, { backgroundColor: theme.colors.text }]} />
          <View style={[styles.menuLine, styles.menuLineMiddle, { backgroundColor: '#FF5F00' }]} />
          <View style={[styles.menuLine, styles.menuLineBottom, { backgroundColor: theme.colors.text }]} />
        </View>
        {/* Subtle Signature Dot */}
        <View style={styles.menuCornerDot} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMenu,
  onOpenReports,
  todayLabel = 'Thu 3 Sep',
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { currentRole, can, profile } = useAuth();
  const { shop } = useShop();
  const { language, currentLanguage, setLanguage, languages, t } = useLanguage();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const shopInitial = shop.name ? shop.name.charAt(0).toUpperCase() : 'C';
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12
      ? t('good_morning', 'Good Morning')
      : h < 17
      ? t('good_afternoon', 'Good Afternoon')
      : t('good_evening', 'Good Evening');
  })();

  const handleReportsPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onOpenReports();
  };

  return (
    <View style={[styles.header, { paddingTop: topPadding, backgroundColor: theme.colors.bg, borderBottomColor: theme.colors.divider }]}>
      {/* Unique Animated Hamburger Menu Button */}
      <UniqueAnimatedHeaderMenuButton onPress={onOpenMenu} theme={theme} />

      {/* Shop Logo / Avatar */}
      <View style={styles.avatar}>
        {shop.logoUrl ? (
          <Image
            key={shop.logoUrl}
            source={{ uri: shop.logoUrl }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>{shopInitial}</Text>
        )}
      </View>

      {/* Shop Info with Greeting Only */}
      <View style={styles.info}>
        <Text
          style={[styles.shopName, { color: theme.colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {shop.name || 'Counter365'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {greeting}
        </Text>
      </View>

      {/* Language Toggle Icon Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          setIsDropdownVisible(true);
        }}
        style={[
          styles.langIconButton,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
        accessibilityLabel={`Select Language, currently ${currentLanguage.name}`}
      >
        <Ionicons name="language" size={20} color="#FF5F00" />
      </TouchableOpacity>

      {/* Reports Icon Button */}
      {can('report') && (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleReportsPress}
          style={[styles.reportsButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          accessibilityLabel="Download reports"
        >
          <Ionicons name="bar-chart-outline" size={19} color={theme.colors.icon} />
        </TouchableOpacity>
      )}

      {/* Language Selection Dropdown Modal */}
      <Modal
        visible={isDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsDropdownVisible(false)}
          style={[styles.modalBackdrop, { paddingTop: topPadding + 52 }]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.dropdownCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.dropdownHeader}>
              <View style={styles.dropdownHeaderLeft}>
                <Ionicons name="language" size={16} color="#FF5F00" />
                <Text style={[styles.dropdownTitle, { color: theme.colors.text }]}>Choose Language</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDropdownVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close language selector"
              >
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.dropdownList}>
              {languages.map(lang => {
                const isSelected = lang.code === language;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    activeOpacity={0.7}
                    onPress={async () => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      await setLanguage(lang.code);
                      setIsDropdownVisible(false);
                    }}
                    style={[
                      styles.langOptionRow,
                      isSelected && {
                        backgroundColor: theme.isDark ? 'rgba(255, 95, 0, 0.12)' : '#FFF7ED',
                        borderColor: '#FF5F00',
                      },
                    ]}
                  >
                    <View style={[styles.langBadgeWrap, isSelected && { borderColor: '#FF5F00', backgroundColor: '#FF5F00' }]}>
                      <Text style={[styles.langBadgeText, isSelected && { color: '#FFFFFF' }]}>
                        {lang.shortCode}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langOptionName, { color: theme.colors.text }, isSelected && { fontWeight: '700' }]}>
                        {lang.name}
                      </Text>
                      <Text style={[styles.langOptionNative, { color: isSelected ? '#FF5F00' : theme.colors.textSecondary }]}>
                        {lang.nativeName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#FF5F00" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 9,
    },
    menuButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
      ...shadows.card,
    },
    menuLinesWrapper: {
      width: 20,
      height: 16,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    menuLine: {
      height: 2.2,
      borderRadius: 2,
    },
    menuLineTop: {
      width: 15,
    },
    menuLineMiddle: {
      width: 20,
    },
    menuLineBottom: {
      width: 11,
    },
    menuCornerDot: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#FF5F00',
      opacity: 0.8,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#FF5F00',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...shadows.sm,
    },
    avatarImage: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    avatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    info: {
      flex: 1,
      minWidth: 0,
      marginRight: 4,
    },
    shopName: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
      fontFamily: typography.fonts.body,
    },
    langIconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    reportsButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingRight: 16,
    },
    dropdownCard: {
      width: 220,
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: 12,
      ...shadows.lg,
    },
    dropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    dropdownHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dropdownTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
    },
    dropdownList: {
      gap: 4,
    },
    langOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    langBadgeWrap: {
      width: 28,
      height: 24,
      borderRadius: 6,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    langBadgeText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    langOptionName: {
      fontSize: 13,
      fontFamily: typography.fonts.body,
    },
    langOptionNative: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
    },
  });
};
