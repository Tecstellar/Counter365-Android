import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';
import { useTheme, Theme, radii, shadows, typography } from '../../theme';

interface CustomerHistoryData {
  totalBills: number;
  totalSpent: number;
  bills: any[];
  favoriteItems: Array<{ name: string; quantity: number; amount: number }>;
}

interface CustomerHistoryModalProps {
  visible: boolean;
  customer: CustomerRecord | null;
  historyData: CustomerHistoryData | null;
  isLoading: boolean;
  onClose: () => void;
  shopName?: string;
}

export const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  visible,
  customer,
  historyData,
  isLoading,
  onClose,
  shopName,
}) => {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const styles = createStyles(theme, isDark);

  if (!customer) return null;

  const handleCall = () => {
    if (!customer.phone) return;
    const clean = customer.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    if (!customer.phone) return;
    const clean = customer.phone.replace(/[^0-9]/g, '').slice(-10);
    const msg = encodeURIComponent(`Hi ${customer.name},\nGreetings from ${shopName || 'our shop'}!`);
    Linking.openURL(`https://wa.me/91${clean}?text=${msg}`).catch(() => {});
  };

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
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={styles.historyAvatar}>
                <Text style={styles.historyAvatarText}>
                  {customer.name.charAt(0).toUpperCase()}
                </Text>
                {(customer.isVip || customer.statusTag === 'MVP') && (
                  <View style={styles.vipCrownBadge}>
                    <Ionicons name="star" size={9} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{customer.name}</Text>
                  {(customer.isVip || customer.statusTag === 'MVP') && (
                    <View style={styles.vipPillBadge}>
                      <Text style={styles.vipPillText}>VIP</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalSub}>
                  {customer.phone ? `+91 ${customer.phone}` : 'No phone saved'}
                  {customer.location ? ` • ${customer.location}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions (Call & WhatsApp) */}
          {customer.phone ? (
            <View style={styles.historyActionsRow}>
              <TouchableOpacity
                style={styles.historyCallBtn}
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={15} color="#FFFFFF" />
                <Text style={styles.historyCallBtnText}>Call Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyWaBtn}
                onPress={handleWhatsApp}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                <Text style={styles.historyWaBtnText}>WhatsApp Chat</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Content Scroll */}
          <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
            {/* Stats KPI Cards */}
            <View style={styles.historyKpiRow}>
              <View style={styles.historyKpiCard}>
                <Text style={styles.historyKpiLabel}>TOTAL SPENT</Text>
                <Text style={styles.historyKpiVal}>
                  {formatRupee(historyData?.totalSpent || 0)}
                </Text>
              </View>
              <View style={styles.historyKpiCard}>
                <Text style={styles.historyKpiLabel}>TOTAL VISITS</Text>
                <Text style={styles.historyKpiVal}>
                  {historyData?.totalBills || customer.totalBills || 0}
                </Text>
              </View>
              <View style={styles.historyKpiCard}>
                <Text style={styles.historyKpiLabel}>PENDING DUE</Text>
                <Text style={[styles.historyKpiVal, { color: Number(customer.pendingBalance || 0) > 0 ? '#DC2626' : colors.text }]}>
                  {formatRupee(customer.pendingBalance || 0)}
                </Text>
              </View>
            </View>

            {/* FAVORITE ITEMS SECTION: "What are the bills they like?" */}
            <View style={styles.historySection}>
              <View style={styles.historySectionHeader}>
                <Ionicons name="heart" size={16} color="#DC2626" />
                <Text style={styles.historySectionTitle}>Favorite Dishes / Frequently Ordered</Text>
              </View>

              {isLoading ? (
                <View style={{ padding: 14, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : (historyData?.favoriteItems && historyData.favoriteItems.length > 0) ? (
                <View style={styles.favoriteItemsList}>
                  {historyData.favoriteItems.map((fav, fIdx) => (
                    <View key={fIdx} style={styles.favItemRow}>
                      <View style={styles.favRankBadge}>
                        <Text style={styles.favRankText}>#{fIdx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.favItemName}>{fav.name}</Text>
                        <Text style={styles.favItemQty}>Ordered {fav.quantity} times</Text>
                      </View>
                      <Text style={styles.favItemAmt}>{formatRupee(fav.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyHistoryBox}>
                  <Text style={styles.emptyHistoryText}>
                    No item preferences recorded yet for this customer. Items appear automatically after billing.
                  </Text>
                </View>
              )}
            </View>

            {/* RECENT BILLS SECTION */}
            <View style={styles.historySection}>
              <View style={styles.historySectionHeader}>
                <Ionicons name="receipt-outline" size={16} color={colors.accent} />
                <Text style={styles.historySectionTitle}>Recent Bills History</Text>
              </View>

              {isLoading ? (
                <View style={{ padding: 14, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : (historyData?.bills && historyData.bills.length > 0) ? (
                <View style={styles.billsListWrap}>
                  {historyData.bills.map(b => (
                    <View key={b.id} style={styles.billHistoryRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.billHistoryNo}>{b.billNumber}</Text>
                          <View style={styles.billHistoryModeBadge}>
                            <Text style={styles.billHistoryModeText}>{b.paymentMode}</Text>
                          </View>
                        </View>
                        <Text style={styles.billHistoryDate}>
                          {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {b.items?.length ? ` • ${b.items.length} items` : ''}
                        </Text>
                      </View>
                      <Text style={styles.billHistoryAmt}>{formatRupee(b.totalAmount)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyHistoryBox}>
                  <Text style={styles.emptyHistoryText}>
                    No past bills linked to this customer yet.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: 20,
      paddingBottom: 34,
      maxHeight: '90%',
      ...shadows.card,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyAvatar: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    historyAvatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    vipCrownBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      backgroundColor: '#F59E0B',
      width: 15,
      height: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    modalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    vipPillBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    vipPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#B45309',
    },
    modalSub: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 2,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyCallBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      paddingVertical: 9,
      borderRadius: radii.md,
    },
    historyCallBtnText: {
      fontSize: 12.5,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    historyWaBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#059669',
      paddingVertical: 9,
      borderRadius: radii.md,
    },
    historyWaBtnText: {
      fontSize: 12.5,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    historyKpiRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    historyKpiCard: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: radii.md,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyKpiLabel: {
      fontSize: 9.5,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    historyKpiVal: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.text,
    },
    historySection: {
      marginBottom: 16,
    },
    historySectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    historySectionTitle: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    favoriteItemsList: {
      gap: 6,
    },
    favItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bg,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    favRankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    favRankText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#B45309',
    },
    favItemName: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    favItemQty: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    favItemAmt: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    emptyHistoryBox: {
      padding: 14,
      backgroundColor: colors.bg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    emptyHistoryText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
    billsListWrap: {
      gap: 6,
    },
    billHistoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bg,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    billHistoryNo: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    billHistoryModeBadge: {
      backgroundColor: colors.surface,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    billHistoryModeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    billHistoryDate: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    billHistoryAmt: {
      fontSize: 13.5,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.text,
    },
  });
};
