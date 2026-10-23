import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, StatusBar, Image, View, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography } from '../../theme/typography';

interface SplashScreenProps {
  onComplete: () => void;
}

const introVideo = require('../../../assets/intro.mp4');
const tecstellarLogo = require('../../../assets/tecstellar_logo.png');

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const hasFinishedRef = useRef(false);

  const handleFinish = () => {
    if (!hasFinishedRef.current) {
      hasFinishedRef.current = true;
      onComplete();
    }
  };

  const player = useVideoPlayer(introVideo, p => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      handleFinish();
    });

    // Fallback timer ensures user never gets stuck if event doesn't fire
    const fallbackTimer = setTimeout(() => {
      handleFinish();
    }, 5000);

    return () => {
      subscription.remove();
      clearTimeout(fallbackTimer);
    };
  }, [player]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleFinish}
      style={styles.container}
    >
      <StatusBar hidden />
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsPictureInPicture={false}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Tecstellar logo small in bottom center */}
      <View
        pointerEvents="none"
        style={[
          styles.bottomLogoContainer,
          { bottom: Math.max(insets.bottom, 20) + 14 },
        ]}
      >
        <Text style={styles.fromText}>from</Text>
        <Image
          source={tecstellarLogo}
          style={styles.bottomLogo}
          resizeMode="contain"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLogoContainer: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 6,
  },
  fromText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  bottomLogo: {
    width: 108,
    height: 23,
  },
});
