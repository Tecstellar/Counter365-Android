import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface SplashScreenProps {
  onComplete: () => void;
}

const introVideo = require('../../../assets/intro.mp4');

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
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
});
