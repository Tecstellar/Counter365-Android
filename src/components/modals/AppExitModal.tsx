import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';

interface AppExitModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const AppExitModal: React.FC<AppExitModalProps> = ({
  visible,
  onCancel,
  onConfirmExit,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: isDark ? '#27272A' : '#E4E4E7',
            },
          ]}
          onPress={e => e.stopPropagation()}
        >
          {/* Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={26} color="#DC2626" />
          </View>

          {/* Text Content */}
          <Text
            style={[
              styles.title,
              { color: isDark ? '#FAFAFA' : '#18181B' },
            ]}
          >
            {t('exit_app_title', 'Exit Counter 365?')}
          </Text>
          <Text
            style={[
              styles.description,
              { color: isDark ? '#A1A1AA' : '#71717A' },
            ]}
          >
            {t('exit_app_confirm', 'Are you sure you want to exit the application?')}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.btn,
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? '#27272A' : '#F4F4F5',
                  borderColor: isDark ? '#3F3F46' : '#E4E4E7',
                },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.cancelBtnText,
                  { color: isDark ? '#E4E4E7' : '#27272A' },
                ]}
              >
                {t('cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btn, styles.exitBtn]}
              onPress={onConfirmExit}
            >
              <Ionicons name="exit-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.exitBtnText}>
                {t('exit_app_btn', 'Exit App')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Jost',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontFamily: 'Lexend',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: 'Lexend',
    fontSize: 14,
    fontWeight: '600',
  },
  exitBtn: {
    backgroundColor: '#DC2626',
  },
  exitBtnText: {
    fontFamily: 'Lexend',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
