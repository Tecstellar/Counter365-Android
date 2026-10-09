import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { APP_CONFIG } from '../../constants/appConfig';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { AppButton } from '../../components/common/AppButton';

interface SupportScreenProps {
  onBackToHome: () => void;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const SupportScreen: React.FC<SupportScreenProps> = ({ onBackToHome }) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { shop } = useShop();
  const { currentRole, profile } = useAuth();
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('billing');

  const supportNumber = APP_CONFIG.supportPhone;
  const appVersion = Constants.expoConfig?.version || '1.0.4';

  const handleCall = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Linking.openURL(`tel:${supportNumber}`);
  };

  const handleWhatsApp = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const msg = encodeURIComponent(
      `Hi Counter365 Support,\nI need assistance with my app.\nShop: ${shop.name || 'My Shop'}\nPhone: ${shop.phone || ''}\nRole: ${currentRole}`
    );
    Linking.openURL(`https://wa.me/91${supportNumber}?text=${msg}`);
  };

  const faqs: FaqItem[] = [
    {
      id: 'billing',
      question: 'How do I create and share bills?',
      answer:
        'Go to Sales (New Bill) tab. Tap items from your menu to add them to the bill. Tap the Bill counter button to view checkout, select payment method (Cash, GPay, Cash + GPay, Partial Pay, or Pending credit), and tap "Save & Share" for instant WhatsApp receipt and PDF copy download.',
      icon: 'receipt-outline',
    },
    {
      id: 'pdf_sharing',
      question: 'How do I download and save PDF receipts?',
      answer:
        'After saving any bill, tap the "PDF" button in the Bill Saved screen. You can also open the "Bills" menu, tap on any bill, and choose "Download PDF Copy" to view and save the official PDF receipt directly on your phone.',
      icon: 'document-text-outline',
    },
    {
      id: 'free_limit',
      question: 'How does the 100 free bills limit work?',
      answer:
        'Counter365 includes 100 free bills for testing and trial. Both active and deleted bills count toward this 100-bill limit. Deleted bills are kept securely in Recently Deleted for 30 days for audit and data integrity. Once 100 bills are reached, billing will prompt you to upgrade to unlimited Pro.',
      icon: 'shield-checkmark-outline',
    },
    {
      id: 'menu_edit',
      question: 'How do I manage food items and prices?',
      answer:
        'In the Sales tab, tap "Edit Menu" (or use the three-dot menu on any category). You can add new categories, create food items with custom prices, edit existing items, or import standard food menu presets in 1 tap.',
      icon: 'fast-food-outline',
    },
    {
      id: 'printers',
      question: 'How do I connect a Bluetooth thermal printer?',
      answer:
        'Go to Account & settings -> Bluetooth Thermal Printer. Turn on your printer and Bluetooth on your phone. Pair your 58mm or 80mm ESC/POS printer to print receipts and daily closing statements automatically.',
      icon: 'print-outline',
    },
    {
      id: 'cloud_backup',
      question: 'Is my shop data backed up safely?',
      answer:
        'Yes! Counter365 syncs all sales, bills, customer ledgers, and menu items with the secure Supabase cloud. If you lose internet, the app continues working locally and automatically syncs when connectivity resumes.',
      icon: 'cloud-done-outline',
    },
  ];

  const toggleFaq = (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setExpandedFaqId(prev => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            onBackToHome();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>Official assistance for Counter365</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Support Hotline Hero Card */}
        <View style={styles.hotlineCard}>
          <View style={styles.hotlineTop}>
            <View style={styles.iconCircle}>
              <Ionicons name="headset" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.hotlineMeta}>
              <View style={styles.badgeRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>Active Support Desk</Text>
                </View>
              </View>
              <Text style={styles.hotlineNumberText}>+91 {supportNumber}</Text>
              <Text style={styles.hotlineHours}>
                Operating Hours: {APP_CONFIG.supportHours}
              </Text>
            </View>
          </View>

          <Text style={styles.hotlineDesc}>
            Need immediate help with billing, printers, or your account? Our dedicated support team is available every day.
          </Text>

          {/* Direct Contact Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCall}
              style={styles.callIconBtn}
              accessibilityLabel="Call Support"
            >
              <Ionicons name="call" size={19} color="#FFFFFF" />
              <Text style={styles.callIconBtnText}>Call Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleWhatsApp}
              style={styles.waIconBtn}
              accessibilityLabel="WhatsApp Chat"
            >
              <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
              <Text style={styles.waIconBtnText}>WhatsApp Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Diagnostic / Account Info */}
        <View style={styles.diagnosticCard}>
          <View style={styles.diagnosticRow}>
            <Text style={styles.diagnosticLabel}>Shop Name</Text>
            <Text style={styles.diagnosticValue} numberOfLines={1}>
              {shop.name || 'Not configured'}
            </Text>
          </View>
          <View style={styles.diagnosticDivider} />
          <View style={styles.diagnosticRow}>
            <Text style={styles.diagnosticLabel}>User & Role</Text>
            <Text style={styles.diagnosticValue}>
              {profile?.fullName ? `${profile.fullName} (${currentRole})` : currentRole}
            </Text>
          </View>
          <View style={styles.diagnosticDivider} />
          <View style={styles.diagnosticRow}>
            <Text style={styles.diagnosticLabel}>App Version</Text>
            <Text style={styles.diagnosticValue}>v{appVersion} • Production</Text>
          </View>
        </View>

        {/* Guides & FAQs */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Text style={styles.sectionSubtitle}>
            Tap any topic below to view step-by-step guidance
          </Text>

          <View style={styles.faqList}>
            {faqs.map(faq => {
              const isExpanded = expandedFaqId === faq.id;
              return (
                <View key={faq.id} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqHeader}
                    onPress={() => toggleFaq(faq.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.faqIconBox}>
                      <Ionicons name={faq.icon} size={18} color={colors.accent} />
                    </View>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.faqBody}>
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer Note */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Counter365 • Premium POS & Billing System for Food Shops
          </Text>
          <Text style={styles.footerSubText}>
            Official Support: 8903368006 • 7:00 AM – 11:00 PM
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      ...shadows.sm,
    },
    headerTitleWrap: {
      flex: 1,
    },
    headerTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    headerSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 14,
      paddingBottom: 70,
    },
    hotlineCard: {
      backgroundColor: isDark ? colors.surface : '#111111',
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.border : 'rgba(255, 255, 255, 0.08)',
      ...shadows.card,
    },
    hotlineTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(253, 94, 3, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hotlineMeta: {
      flex: 1,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(74, 222, 128, 0.25)',
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#4ADE80',
    },
    liveBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#4ADE80',
      fontFamily: typography.fonts.heading,
    },
    hotlineNumberText: {
      fontFamily: typography.fonts.heading,
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
      fontVariant: ['tabular-nums'],
    },
    hotlineHours: {
      fontFamily: typography.fonts.body,
      fontSize: 11.5,
      color: 'rgba(255, 255, 255, 0.55)',
      marginTop: 2,
    },
    hotlineDesc: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.8)',
      lineHeight: 19,
      marginTop: 14,
      marginBottom: 16,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    callIconBtn: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    callIconBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
    },
    waIconBtn: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor: '#25D366',
    },
    waIconBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
    },
    diagnosticCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    diagnosticRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
    },
    diagnosticLabel: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    diagnosticValue: {
      fontFamily: typography.fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      maxWidth: '60%',
      textAlign: 'right',
    },
    diagnosticDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    cloudStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cloudStatusText: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      fontWeight: '700',
      color: '#059669',
    },
    faqSection: {
      marginTop: 6,
    },
    sectionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    sectionSubtitle: {
      fontFamily: typography.fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    faqList: {
      gap: 10,
    },
    faqItem: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.card,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    faqIconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFF0E6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    faqQuestion: {
      flex: 1,
      fontFamily: typography.fonts.heading,
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.text,
    },
    faqBody: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FAF7F2',
    },
    faqAnswer: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
    footerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      gap: 4,
    },
    footerText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footerSubText: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
};
