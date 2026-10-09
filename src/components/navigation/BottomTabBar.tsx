import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, radii, shadows, useTheme, Theme } from '../../theme';
import { AppRoute } from '../../types/navigation';

interface BottomTabBarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

type TabConfig = {
  route: AppRoute;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconActive: React.ComponentProps<typeof Ionicons>['name'];
  isActive: boolean;
};

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const isHomeActive =
    currentRoute === 'home' ||
    currentRoute === 'reports' ||
    currentRoute === 'pending' ||
    currentRoute === 'contacts';
  const isBillsActive = currentRoute === 'bills';
  const isSalesActive = currentRoute === 'sales';
  const isAccountActive = currentRoute === 'account' || currentRoute === 'support';

  const bottomMargin = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 12);

  const tabs: TabConfig[] = [
    {
      route: 'home',
      label: 'Home',
      icon: 'home-outline',
      iconActive: 'home',
      isActive: isHomeActive,
    },
    {
      route: 'bills',
      label: 'Bills',
      icon: 'receipt-outline',
      iconActive: 'receipt',
      isActive: isBillsActive,
    },
    {
      route: 'sales',
      label: 'New Bill',
      icon: 'add-circle-outline',
      iconActive: 'add-circle',
      isActive: isSalesActive,
    },
    {
      route: 'account',
      label: 'Account',
      icon: 'person-outline',
      iconActive: 'person',
      isActive: isAccountActive,
    },
  ];

  const handleTabPress = (route: AppRoute) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onNavigate(route);
  };

  return (
    <View style={[styles.floatingWrapper, { paddingBottom: bottomMargin }]}>
      <View style={[styles.dockContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {tabs.map((tab) => {
          if (tab.isActive) {
            return (
              <TouchableOpacity
                key={tab.route}
                activeOpacity={0.85}
                onPress={() => handleTabPress(tab.route)}
                style={[styles.activePillTab, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name={tab.iconActive} size={18} color="#FFFFFF" />
                <Text style={styles.activePillLabel}>{tab.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.route}
              activeOpacity={0.7}
              onPress={() => handleTabPress(tab.route)}
              style={styles.inactiveTab}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={tab.icon} size={22} color={theme.colors.iconMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    floatingWrapper: {
      backgroundColor: 'transparent',
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    dockContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: 22,
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.floating,
    },
    activePillTab: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 10,
      gap: 8,
      ...shadows.orangeGlow,
    },
    activePillLabel: {
      fontSize: typography.sizes.chip,
      fontFamily: typography.fonts.bodySemiBold,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: -0.135,
    },
    inactiveTab: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
  });
};
