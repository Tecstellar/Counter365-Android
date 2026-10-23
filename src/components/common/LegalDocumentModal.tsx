import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { LegalSection } from '../../constants/legalDocuments';

interface LegalDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  sections: LegalSection[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  badge = 'DPDPA 2023 Compliant',
  sections,
}) => {
  const insets = useSafeAreaInsets();
  const androidNavPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 48) : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeIconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close document"
            >
              <Ionicons name="close" size={22} color={colors.ink || '#111827'} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content with embedded Close Button so it scrolls cleanly above 3-button navigation */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(androidNavPadding + 28, 48) },
            ]}
            showsVerticalScrollIndicator={true}
          >
            {sections.map((sec, index) => (
              <View key={`sec-${index}`} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <Text style={styles.sectionBody}>{sec.content}</Text>
              </View>
            ))}

            {/* Scrollable Action Button at bottom of content */}
            <View style={styles.scrollActionContainer}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeActionButton}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="I Understand and Close"
              >
                <Text style={styles.closeActionText}>I Understand & Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 8,
    maxHeight: SCREEN_HEIGHT * 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontFamily: 'Lexend',
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'Lexend',
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  subtitle: {
    fontFamily: 'Lexend',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  closeIconButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    marginTop: 12,
  },
  scrollContent: {
    paddingTop: 4,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Lexend',
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  sectionBody: {
    fontFamily: 'Lexend',
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  scrollActionContainer: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  closeActionButton: {
    backgroundColor: '#FF5F00',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  closeActionText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend',
    fontSize: 14,
    fontWeight: '700',
  },
});
