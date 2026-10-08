import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows, useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';

interface AppHeaderProps {
  onOpenMenu: () => void;
  onOpenReports: () => void;
  todayLabel?: string;
}

const UniqueAnimatedHeaderMenuButton: React.FC<{
  onPress: () => void;
  theme: any;
}> = ({ onPress, theme }) => {
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
        style={[
          styles.menuButton,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
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
  const { currentRole, can, profile } = useAuth();
  const { shop } = useShop();

  const shopInitial = shop.name ? shop.name.charAt(0).toUpperCase() : 'C';
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);

  const roleLabel =
    currentRole === 'Owner' && profile?.fullName
      ? profile.fullName
      : currentRole;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
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

      {/* Shop Info with Good Afternoon Greeting */}
      <View style={styles.info}>
        <Text style={[styles.shopName, { color: theme.colors.text }]} numberOfLines={1}>
          {shop.name || 'Counter365'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {greeting}{roleLabel ? `, ${roleLabel}` : ''}
        </Text>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.divider,
    position: 'relative',
    ...shadows.card,
  },
  menuLinesWrapper: {
    width: 22,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2.5,
    borderRadius: 2,
  },
  menuLineTop: {
    width: 16,
  },
  menuLineMiddle: {
    width: 22,
  },
  menuLineBottom: {
    width: 12,
  },
  menuCornerDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF5F00',
    opacity: 0.8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.body,
  },
  reportsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...shadows.card,
  },
});
