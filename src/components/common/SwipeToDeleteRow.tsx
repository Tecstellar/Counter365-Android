import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radii } from '../../theme';

interface SwipeToDeleteRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  deleteLabel?: string;
  deleteThreshold?: number;
}

const ACTION_BUTTON_WIDTH = 76;

export const SwipeToDeleteRow: React.FC<SwipeToDeleteRowProps> = ({
  children,
  onDelete,
  disabled = false,
  deleteLabel = 'Delete',
  deleteThreshold = 65,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled) return false;
        // Only respond to horizontal gestures with enough movement
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled) return;
        // Limit swiping to left only (dx < 0)
        if (gestureState.dx < 0) {
          const clamped = Math.max(-ACTION_BUTTON_WIDTH - 20, gestureState.dx);
          translateX.setValue(clamped);
        } else if (isOpen.current && gestureState.dx > 0) {
          // Allow swiping back right to close
          const val = Math.min(0, -ACTION_BUTTON_WIDTH + gestureState.dx);
          translateX.setValue(val);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (disabled) return;
        if (gestureState.dx < -deleteThreshold) {
          // Open the delete action
          openSwipe();
        } else {
          // Snap back to closed
          closeSwipe();
        }
      },
      onPanResponderTerminate: () => {
        closeSwipe();
      },
    })
  ).current;

  const openSwipe = () => {
    isOpen.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.spring(translateX, {
      toValue: -ACTION_BUTTON_WIDTH,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeSwipe = () => {
    isOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const handleDeletePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    closeSwipe();
    onDelete();
  };

  return (
    <View style={styles.container}>
      {/* Hidden Delete Action in the Background */}
      {!disabled && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePress}
            activeOpacity={0.8}
            accessibilityLabel="Delete item"
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Front Card Content that slides */}
      <Animated.View
        style={[
          styles.contentCard,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.md,
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  contentCard: {
    width: '100%',
  },
});
