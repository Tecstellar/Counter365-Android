import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CollectDueModal } from '../../components/modals/CollectDueModal';
import { CustomerHistoryModal } from '../../components/modals/CustomerHistoryModal';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { billingService } from '../../services/billingService';
import { contactService } from '../../services/contactService';
import { PendingPaymentRecord, PaymentMethod, CustomerRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface PendingPaymentsScreenProps {
  onBackToHome: () => void;
  onNavigateToContacts: (focusCustomerName?: string) => void;
  onSendReminder: (record: PendingPaymentRecord) => void;
}

export const PendingPaymentsScreen: React.FC<PendingPaymentsScreenProps> = ({
  onBackToHome,
  onNavigateToContacts,
  onSendReminder,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { shop } = useShop();
  const { can, profile, currentMember, currentRole } = useAuth();
  const { flash } = useCart();

  const [pendingList, setPendingList] = useState<PendingPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Tracked' | 'No number'>('All');
  const [sortBy, setSortBy] = useState<'amount' | 'recent'>('amount');
  const [selectedPendingRecord, setSelectedPendingRecord] = useState<PendingPaymentRecord | null>(null);
  const [isCollectDueModalVisible, setIsCollectDueModalVisible] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerRecord | null>(null);
  const [customerHistoryData, setCustomerHistoryData] = useState<{
    totalBills: number;
    totalSpent: number;
    bills: any[];
    favoriteItems: Array<{ name: string; quantity: number; amount: number }>;
  } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleOpenCustomerProfile = async (item: PendingPaymentRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const dummyRecord: CustomerRecord = {
      id: item.billId || item.id,
      shopId: shop.id,
      name: item.customerName,
      phone: item.customerPhone ? item.customerPhone.replace(/[^0-9]/g, '') : null,
      totalBills: item.bills?.length || 1,
      pendingBalance: item.amountDue,
      statusTag: 'Pending',
    };
    setHistoryCustomer(dummyRecord);
    setIsLoadingHistory(true);
    try {
      const hist = await contactService.getCustomerHistory(shop.id, item.customerName, item.customerPhone);
      setCustomerHistoryData(hist);
    } catch (err) {
      console.warn('Failed to load customer history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, [shop.id]);

  const loadPending = async () => {
    setIsLoading(true);
    try {
      const list = await billingService.getPendingPayments(shop.id);
      setPendingList(list);
    } catch (err) {
      console.warn('loadPending error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCollectDue = (item: PendingPaymentRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (!can('pend')) {
      flash('Clearing pending is locked — ask the owner');
      return;
    }
    setSelectedPendingRecord(item);
    setIsCollectDueModalVisible(true);
  };

  const handleConfirmCollectDue = async (
    record: PendingPaymentRecord,
    amountToCollect: number,
    paymentMode: PaymentMethod
  ) => {
    const userMeta = {
      name: profile?.fullName || currentMember?.fullName || currentRole,
      role: currentRole,
      id: profile?.id || currentMember?.id,
    };
    const updated = await billingService.clearPendingPayment(
      shop.id,
      record.billId || record.id,
      amountToCollect,
      paymentMode,
      userMeta
    );
    setPendingList(updated);

    const remaining = Math.max(0, (record.amountDue || 0) - amountToCollect);
    if (remaining === 0) {
      flash(`${record.customerName} fully settled (${formatRupee(amountToCollect)})`);
    } else {
      flash(`Collected ${formatRupee(amountToCollect)} from ${record.customerName} (${formatRupee(remaining)} due)`);
    }
  };

  const handleCall = (item: PendingPaymentRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (!item.customerPhone || item.customerPhone.includes('no number')) {
      flash(`No number saved for ${item.customerName}`);
      return;
    }
    const phoneUrl = `tel:${item.customerPhone.replace(/[^0-9]/g, '')}`;
    Linking.openURL(phoneUrl).catch(() => {
      flash(`Calling ${item.customerName} — +91 ${item.customerPhone}`);
    });
  };

  const handleWhatsApp = (item: PendingPaymentRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (!item.customerPhone || item.customerPhone.includes('no number')) {
      flash('No phone number saved — cannot send WhatsApp reminder');
      return;
    }
    onSendReminder(item);
  };

  const totalOutstanding = pendingList.reduce((sum, p) => sum + p.amountDue, 0);
  const oldestTracked = pendingList.find(p => !p.ageDescription.startsWith('today'))?.ageDescription.split(' — ')[0] || 'Today';
  const totalBillsCount = pendingList.reduce((sum, p) => sum + (p.bills?.length || 1), 0);

  const trackedCount = pendingList.filter(p => p.customerPhone && !p.customerPhone.includes('no number')).length;
  const noNumberCount = pendingList.length - trackedCount;

  const filteredList = useMemo(() => {
    let result = pendingList.filter(p => {
      const hasNoNumber = !p.customerPhone || p.customerPhone.includes('no number');
      if (filter === 'Tracked' && hasNoNumber) return false;
      if (filter === 'No number' && !hasNoNumber) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.customerName?.toLowerCase().includes(q);
        const matchPhone = p.customerPhone?.toLowerCase().includes(q);
        const matchBill = p.bills?.some(b => b.billNumber?.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchBill) return false;
      }
      return true;
    });

    if (sortBy === 'amount') {
      result.sort((a, b) => b.amountDue - a.amountDue);
    } else {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    return result;
  }, [pendingList, filter, searchQuery, sortBy]);

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            onBackToHome();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Payment Pending</Text>
            {pendingList.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{pendingList.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>Udhar ledger & due balance collection</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            loadPending();
          }}
          style={styles.refreshBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Refresh list"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="reload" size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Executive Outstanding Hero Card (Obsidian Dark) */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <View style={styles.heroPulseDot} />
              <Text style={styles.heroBadgeText}>ACTIVE UDHAR LEDGER</Text>
            </View>
            <View style={styles.heroPillRight}>
              <Text style={styles.heroPillRightText}>{pendingList.length} Customer{pendingList.length === 1 ? '' : 's'}</Text>
            </View>
          </View>

          <Text style={styles.heroAmount}>{formatRupee(totalOutstanding)}</Text>
          <Text style={styles.heroAmountSub}>Total Pending Across All Bills</Text>

          {/* 3 Metric Pills */}
          <View style={styles.heroMetricsGrid}>
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>OPEN DUES</Text>
              <Text style={styles.heroMetricValue}>{pendingList.length}</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>UNPAID BILLS</Text>
              <Text style={styles.heroMetricValue}>{totalBillsCount}</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>OLDEST DUE</Text>
              <Text style={styles.heroMetricValue}>{oldestTracked}</Text>
            </View>
          </View>
        </View>

        {/* Live Search Bar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name, phone or bill #"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Row */}
        <View style={styles.filterBarRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            <TouchableOpacity
              style={[styles.filterPill, filter === 'All' && styles.filterPillActive]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setFilter('All');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, filter === 'All' && styles.filterPillTextActive]}>
                All ({pendingList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'Tracked' && styles.filterPillActive]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setFilter('Tracked');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="call-outline"
                size={12}
                color={filter === 'Tracked' ? '#FFFFFF' : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterPillText, filter === 'Tracked' && styles.filterPillTextActive]}>
                With Phone ({trackedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'No number' && styles.filterPillActive]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setFilter('No number');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, filter === 'No number' && styles.filterPillTextActive]}>
                No Number ({noNumberCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Quick Sort Toggle */}
          <TouchableOpacity
            style={styles.sortToggleBtn}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setSortBy(prev => (prev === 'amount' ? 'recent' : 'amount'));
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.accent} />
            <Text style={styles.sortToggleText}>
              {sortBy === 'amount' ? 'Highest' : 'Recent'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Customer Pending Cards List */}
        <View style={styles.cardsList}>
          {filteredList.map(item => {
            const hasNoNumber = !item.customerPhone || item.customerPhone.includes('no number');
            const initial = item.customerName.charAt(0).toUpperCase();

            return (
              <View key={item.id} style={styles.card}>
                {/* Top Section: Avatar, Customer Name & Big Amount */}
                <View style={styles.cardHeader}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View style={styles.dueClockDot}>
                      <Ionicons name="time" size={10} color="#FFFFFF" />
                    </View>
                  </View>

                  <View style={styles.customerInfoCol}>
                    <View style={styles.nameRow}>
                      <Text style={styles.customerName} numberOfLines={1}>
                        {item.customerName}
                      </Text>
                    </View>
                    <View style={styles.ageBadgeRow}>
                      <View style={styles.ageBadge}>
                        <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} />
                        <Text style={styles.ageBadgeText}>
                          {item.ageDescription}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.amountCol}>
                    <Text style={styles.amountDueText}>{formatRupee(item.amountDue)}</Text>
                    <Text style={styles.amountDueSub}>Pending Due</Text>
                  </View>
                </View>

                {/* Phone & Contact Quick-Action Toolbar */}
                <View style={styles.contactBar}>
                  <View style={styles.phoneLabelWrap}>
                    {hasNoNumber ? (
                      <View style={styles.noNumberPill}>
                        <Ionicons name="warning-outline" size={12} color="#D97706" />
                        <Text style={styles.noNumberPillText}>No number saved</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleCall(item)}
                        style={styles.phonePill}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="call-outline" size={12} color={colors.accent} />
                        <Text style={styles.phonePillText}>+91 {item.customerPhone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Circular Quick Actions */}
                  <View style={styles.quickActionsGroup}>
                    <TouchableOpacity
                      onPress={() => handleCall(item)}
                      disabled={hasNoNumber}
                      style={[styles.quickIconBtn, styles.callQuickBtn, hasNoNumber && styles.disabledQuickBtn]}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="Call Customer"
                    >
                      <Ionicons name="call" size={14} color={hasNoNumber ? colors.textMuted : '#FFFFFF'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleWhatsApp(item)}
                      disabled={hasNoNumber}
                      style={[styles.quickIconBtn, styles.waQuickBtn, hasNoNumber && styles.disabledQuickBtn]}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="WhatsApp Customer"
                    >
                      <Ionicons name="logo-whatsapp" size={15} color={hasNoNumber ? colors.textMuted : '#FFFFFF'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenCustomerProfile(item)}
                      style={[styles.quickIconBtn, styles.profileQuickBtn]}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="View Customer History"
                    >
                      <Ionicons name="person" size={14} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Unpaid Bills Chips / Summary */}
                {item.bills && item.bills.length > 0 && (
                  <View style={styles.billsListSection}>
                    <Text style={styles.billsListHeading}>ATTACHED BILLS ({item.bills.length}):</Text>
                    <View style={styles.billChipsWrap}>
                      {item.bills.map((b, idx) => (
                        <View key={idx} style={styles.billChip}>
                          <Ionicons name="receipt-outline" size={11} color={colors.textSecondary} />
                          <Text style={styles.billChipNo}>{b.billNumber}</Text>
                          <Text style={styles.billChipAmt}>{formatRupee(b.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Primary Action Buttons (Remind & Collect Due) */}
                <View style={styles.cardActionRow}>
                  {/* WhatsApp Reminder Button */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.remindActionBtn,
                      hasNoNumber && styles.disabledActionBtn,
                    ]}
                    onPress={() => handleWhatsApp(item)}
                    disabled={hasNoNumber}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="logo-whatsapp"
                      size={16}
                      color={hasNoNumber ? colors.textMuted : '#16A34A'}
                    />
                    <Text
                      style={[
                        styles.remindActionBtnText,
                        hasNoNumber && styles.disabledActionBtnText,
                      ]}
                    >
                      Remind WhatsApp
                    </Text>
                  </TouchableOpacity>

                  {/* Collect Due Button */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.collectActionBtn,
                      !can('pend') && styles.disabledActionBtn,
                    ]}
                    onPress={() => handleOpenCollectDue(item)}
                    disabled={!can('pend')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                    <Text style={styles.collectActionBtnText}>Collect Due</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredList.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={pendingList.length === 0 ? "checkmark-done-circle" : "search-outline"}
                  size={36}
                  color={pendingList.length === 0 ? "#10B981" : colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {pendingList.length === 0 ? 'All Accounts Settled!' : 'No Matching Dues Found'}
              </Text>
              <Text style={styles.emptyNote}>
                {pendingList.length === 0
                  ? 'There are no outstanding balances or pending accounts. All bills are fully paid.'
                  : 'Try clearing your search query or switching the filter tab above.'}
              </Text>
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearSearchBtnText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Collect Due Modal */}
      <CollectDueModal
        visible={isCollectDueModalVisible}
        onClose={() => setIsCollectDueModalVisible(false)}
        record={selectedPendingRecord}
        onConfirm={handleConfirmCollectDue}
      />

      {/* Customer History In-Place Modal */}
      <CustomerHistoryModal
        visible={!!historyCustomer}
        customer={historyCustomer}
        historyData={customerHistoryData}
        isLoading={isLoadingHistory}
        onClose={() => {
          setHistoryCustomer(null);
          setCustomerHistoryData(null);
        }}
        shopName={shop.name}
      />
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerTitleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 17,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  headerBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  // Hero Card (Obsidian Dark Luxury)
  heroCard: {
    backgroundColor: theme.isDark ? colors.surfaceElevated : '#111111',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(253, 94, 3, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(253, 94, 3, 0.3)',
  },
  heroPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FD5E03',
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: '#FF7A29',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  heroPillRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  heroPillRightText: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    color: '#A8A29E',
    fontWeight: '600',
  },
  heroAmount: {
    fontFamily: typography.fonts.numbers,
    fontSize: 40,
    lineHeight: 46,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  heroAmountSub: {
    fontSize: 12,
    color: '#A8A29E',
    fontFamily: typography.fonts.body,
    marginTop: 2,
    marginBottom: 16,
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetricLabel: {
    fontSize: 9.5,
    fontFamily: typography.fonts.bodyBold,
    color: '#78716C',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: '700',
  },
  heroMetricValue: {
    fontSize: 15,
    fontFamily: typography.fonts.numbers,
    color: '#F5F5F4',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  heroMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Search Bar
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    height: 48,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: typography.fonts.body,
    color: colors.inputText,
    paddingVertical: 0,
  },

  // Filter Bar
  filterBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: theme.isDark ? colors.accent : '#111111',
    borderColor: theme.isDark ? colors.accent : '#111111',
  },
  filterPillText: {
    fontSize: 12.5,
    fontFamily: typography.fonts.heading,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent200,
  },
  sortToggleText: {
    fontSize: 12,
    fontFamily: typography.fonts.heading,
    color: colors.accent,
    fontWeight: '700',
  },

  // Cards List
  cardsList: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent200,
  },
  avatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: '#FD5E03',
    fontWeight: '800',
  },
  dueClockDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  customerInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  ageBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ageBadgeText: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountDueText: {
    fontFamily: typography.fonts.numbers,
    fontSize: 20,
    color: '#DC2626',
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  amountDueSub: {
    fontSize: 10,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
    marginTop: 1,
    fontWeight: '600',
  },

  // Contact Bar
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    gap: 8,
  },
  phoneLabelWrap: {
    flex: 1,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  phonePillText: {
    fontSize: 12,
    fontFamily: typography.fonts.heading,
    color: colors.text,
    fontWeight: '600',
  },
  noNumberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    alignSelf: 'flex-start',
  },
  noNumberPillText: {
    fontSize: 11.5,
    fontFamily: typography.fonts.body,
    color: '#D97706',
    fontWeight: '500',
  },
  quickActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callQuickBtn: {
    backgroundColor: '#16A34A',
  },
  waQuickBtn: {
    backgroundColor: '#25D366',
  },
  profileQuickBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabledQuickBtn: {
    backgroundColor: colors.neutral200,
    borderColor: 'transparent',
    opacity: 0.5,
  },

  // Attached Bills
  billsListSection: {
    gap: 6,
  },
  billsListHeading: {
    fontSize: 9.5,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  billChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  billChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billChipNo: {
    fontSize: 11,
    fontFamily: typography.fonts.numbers,
    color: colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  billChipAmt: {
    fontSize: 11,
    fontFamily: typography.fonts.numbers,
    color: '#DC2626',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Primary Action Buttons
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 14,
  },
  remindActionBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  remindActionBtnText: {
    fontSize: 12.5,
    fontFamily: typography.fonts.bodySemiBold,
    color: '#16A34A',
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  collectActionBtn: {
    backgroundColor: colors.accent,
    ...shadows.sm,
  },
  collectActionBtnText: {
    fontSize: 12.5,
    fontFamily: typography.fonts.bodySemiBold,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  disabledActionBtn: {
    backgroundColor: colors.neutral200,
    borderColor: colors.divider,
    opacity: 0.6,
  },
  disabledActionBtnText: {
    color: colors.textMuted,
  },

  // Empty Card
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    ...shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
  },
  emptyNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  clearSearchBtn: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  clearSearchBtnText: {
    fontSize: 12,
    fontFamily: typography.fonts.heading,
    color: colors.accent,
    fontWeight: '700',
  },
  });
};
