import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export const AuthBackgroundGlows: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Top-right strong orange glow: 55% 32% at 95% 2% */}
          <RadialGradient id="glowTopRight" cx="95%" cy="2%" rx="55%" ry="32%" fx="95%" fy="2%">
            <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.20" />
            <Stop offset="70%" stopColor="#FF5F00" stopOpacity="0" />
          </RadialGradient>

          {/* Left-middle peach glow: 50% 30% at 0% 48% */}
          <RadialGradient id="glowLeftMid" cx="0%" cy="48%" rx="50%" ry="30%" fx="0%" fy="48%">
            <Stop offset="0%" stopColor="#FF8C3C" stopOpacity="0.14" />
            <Stop offset="70%" stopColor="#FF8C3C" stopOpacity="0" />
          </RadialGradient>

          {/* Bottom-right orange glow: 60% 30% at 80% 100% */}
          <RadialGradient id="glowBottomRight" cx="80%" cy="100%" rx="60%" ry="30%" fx="80%" fy="100%">
            <Stop offset="0%" stopColor="#FF5F00" stopOpacity="0.12" />
            <Stop offset="70%" stopColor="#FF5F00" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowTopRight)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowLeftMid)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBottomRight)" />
      </Svg>
    </View>
  );
};
