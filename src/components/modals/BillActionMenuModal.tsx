import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, Theme, typography } from '../../theme';
import { Bill } from '../../types/models';

interface BillActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  bill: Bill | null;
  anchorPosition?: { x: number; y: number } | null;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onDownloadPdf?: (bill: Bill) => void;
  onPrint?: (bill: Bill) => void;
  onShareWhatsApp?: (bill: Bill) => void;
}

export const BillActionMenuModal: React.FC<BillActionMenuModalProps> = ({
  visible,
  onClose,
  bill,
  anchorPosition,
  onEdit,
  onDelete,
  onDownloadPdf,
  onPrint,
  onShareWhatsApp,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Compact Small Box Dimensions (~half size)
  const BOX_WIDTH = 146;
  const BOX_HEIGHT = 146;

  // Compute position strictly BELOW the vertical 3-dot icon with pointing arrow
  const { positionStyle, arrowLeft, isBelow } = useMemo(() => {
    if (!anchorPosition) {
      return {
        positionStyle: {
          alignSelf: 'center' as const,
          marginTop: (screenHeight - BOX_HEIGHT) / 2.3,
        },
        arrowLeft: BOX_WIDTH / 2 - 7,
        isBelow: true,
      };
    }

    // Determine if box fits below vertical icon (default) or above if near screen bottom
    const fitsBelow = anchorPosition.y + 12 + BOX_HEIGHT < screenHeight - 50;
    const isBelowCalc = fitsBelow;

    // Anchor box horizontally aligned under vertical dots
    const rawX = anchorPosition.x - BOX_WIDTH + 24;
    const clampedX = Math.max(12, Math.min(screenWidth - BOX_WIDTH - 12, rawX));

    const targetY = isBelowCalc ? anchorPosition.y + 10 : anchorPosition.y - BOX_HEIGHT - 10;
    const clampedY = Math.max(60, Math.min(screenHeight - BOX_HEIGHT - 60, targetY));

    // Align arrow pointer exactly with the vertical 3-dots X coordinate
    const arrowX = Math.max(14, Math.min(BOX_WIDTH - 28, anchorPosition.x - clampedX - 7));

    return {
      positionStyle: {
        position: 'absolute' as const,
        left: clampedX,
        top: clampedY,
      },
      arrowLeft: arrowX,
      isBelow: isBelowCalc,
    };
  }, [anchorPosition, screenWidth, screenHeight]);

  useEffect(() => {
    if (visible) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7.5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible]);

  if (!bill) return null;

  const isDeleted = bill.isDeleted || bill.status === 'deleted';
  const canEdit = !isDeleted && !!onEdit;
  const canDelete = !isDeleted && !!onDelete;

  const handleDismiss = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleAction = (actionType: 'whatsapp' | 'print' | 'download' | 'edit' | 'delete') => {
    if (!bill) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // 1. Immediately dismiss modal so UI responds instantaneously
    onClose();

    // 2. Immediately execute the requested callback without any lag
    requestAnimationFrame(() => {
      if (actionType === 'whatsapp' && onShareWhatsApp) {
        onShareWhatsApp(bill);
      } else if (actionType === 'print') {
        if (onPrint) {
          onPrint(bill);
        } else if (onDownloadPdf) {
          onDownloadPdf(bill);
        }
      } else if (actionType === 'download' && onDownloadPdf) {
        onDownloadPdf(bill);
      } else if (actionType === 'edit' && onEdit) {
        onEdit(bill);
      } else if (actionType === 'delete' && onDelete) {
        onDelete(bill);
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.smallBox,
                positionStyle,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Arrow pointer pointing toward vertical dot icon */}
              <View
                style={[
                  styles.arrowPointer,
                  isBelow ? styles.arrowTop : styles.arrowBottom,
                  { left: arrowLeft },
                ]}
              />

              {/* Row 1: WhatsApp (Top-Left) & Print (Top-Right) */}
              <View style={styles.gridRow}>
                {/* 1. WhatsApp */}
                <TouchableOpacity
                  style={[styles.itemTouchArea, !onShareWhatsApp && styles.disabledTouchArea]}
                  onPress={() => onShareWhatsApp && handleAction('whatsapp')}
                  activeOpacity={0.7}
                  accessibilityLabel="WhatsApp"
                >
                  <View style={[styles.circle, styles.whatsappCircle]}>
                    <Ionicons
                      name="logo-whatsapp"
                      size={20}
                      color={isDark ? '#F8FAFC' : '#111827'}
                    />
                  </View>
                  <Text style={styles.itemLabel}>WhatsApp</Text>
                </TouchableOpacity>

                {/* 2. Print (nearby WhatsApp) */}
                <TouchableOpacity
                  style={[styles.itemTouchArea, !onPrint && !onDownloadPdf && styles.disabledTouchArea]}
                  onPress={() => (onPrint || onDownloadPdf) && handleAction('print')}
                  activeOpacity={0.7}
                  accessibilityLabel="Print"
                >
                  <View style={[styles.circle, styles.printCircle]}>
                    <Ionicons
                      name="print-outline"
                      size={20}
                      color="#0284C7"
                    />
                  </View>
                  <Text style={styles.itemLabel}>Print</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Premium Edit (Bottom-Left) & Delete (Bottom-Right) */}
              <View style={styles.gridRow}>
                {/* 3. Premium Edit Icon (create-outline as used in Account settings for GST, Profile & Tables) */}
                <TouchableOpacity
                  style={[styles.itemTouchArea, !canEdit && styles.disabledTouchArea]}
                  onPress={() => canEdit && handleAction('edit')}
                  activeOpacity={0.7}
                  accessibilityLabel="Edit"
                >
                  <View style={[styles.circle, styles.editCircle]}>
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={isDark ? '#F8FAFC' : '#111827'}
                    />
                  </View>
                  <Text style={styles.itemLabel}>Edit</Text>
                </TouchableOpacity>

                {/* 4. Delete */}
                <TouchableOpacity
                  style={[styles.itemTouchArea, !canDelete && styles.disabledTouchArea]}
                  onPress={() => canDelete && handleAction('delete')}
                  activeOpacity={0.7}
                  accessibilityLabel="Delete"
                >
                  <View style={[styles.circle, styles.deleteCircle]}>
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#DC2626"
                    />
                  </View>
                  <Text style={styles.itemLabel}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.32)',
    },
    smallBox: {
      width: 146,
      height: 146,
      backgroundColor: isDark ? '#000000' : '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 10,
      justifyContent: 'space-between',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.6 : 0.12,
      shadowRadius: 18,
      elevation: 14,
      borderWidth: isDark ? 0 : 1,
      borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.08)',
    },
    arrowPointer: {
      position: 'absolute',
      width: 0,
      height: 0,
      zIndex: 25,
    },
    arrowTop: {
      top: -8,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderBottomWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: isDark ? '#000000' : '#FFFFFF',
    },
    arrowBottom: {
      bottom: -8,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: isDark ? '#000000' : '#FFFFFF',
    },
    gridRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    itemTouchArea: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 58,
      paddingVertical: 2,
    },
    disabledTouchArea: {
      opacity: 0.3,
    },
    circle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
    },
    // 1. WhatsApp: Neutral grey circle with dark icon (or dark slate/black in dark mode)
    whatsappCircle: {
      backgroundColor: isDark ? '#1C1C1E' : '#F1F4F8',
    },
    // 2. Print: Soft blue circle with print icon (nearby WhatsApp)
    printCircle: {
      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.22)' : '#E0F2FE',
    },
    // 3. Edit: Neutral grey circle with premium create-outline icon
    editCircle: {
      backgroundColor: isDark ? '#1C1C1E' : '#F1F4F8',
    },
    // 4. Delete: Soft pastel light red circle with ruby red trash icon
    deleteCircle: {
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.22)' : '#FEE8E8',
    },
    itemLabel: {
      fontSize: 10.5,
      fontWeight: '600',
      fontFamily: typography.fonts.heading,
      color: isDark ? '#FFFFFF' : colors.text,
      textAlign: 'center',
    },
  });
};
