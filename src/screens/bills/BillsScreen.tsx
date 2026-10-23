import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { AppButton } from '../../components/common/AppButton';
import { SwipeToDeleteRow } from '../../components/common/SwipeToDeleteRow';
import { BillActionMenuModal } from '../../components/modals/BillActionMenuModal';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { billingService } from '../../services/billingService';
import { exportService } from '../../services/exportService';
import { whatsappService } from '../../services/whatsappService';
import { printerService } from '../../services/printerService';
import { Bill } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface BillsScreenProps {
  onBackToHome: () => void;
  onEditBill: (bill: Bill) => void;
  onViewBillDetails?: (bill: Bill) => void;
}

type BillFilterTab = 'all' | 'active' | 'edited' | 'deleted';

export const BillsScreen: React.FC<BillsScreenProps> = ({
  onBackToHome,
  onEditBill,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { shop, refreshSubscription } = useShop();
  const { currentRole, profile, currentMember } = useAuth();
  const { flash } = useCart();
  const { t } = useLanguage();

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<BillFilterTab>('all');

  // Deletion modal state
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bill action menu modal state (Three dots)
  const [selectedBillForMenu, setSelectedBillForMenu] = useState<Bill | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  // Bill items preview modal state
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  useEffect(() => {
    loadBills();
  }, [shop.id]);

  const loadBills = async () => {
    if (!shop.id) return;
    setIsLoading(true);
    try {
      const allBills = await billingService.getBills(shop.id);
      setBills(allBills);
    } catch (err) {
      console.warn('BillsScreen loadBills error:', err);
      flash('Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async (bill: Bill) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    flash('Generating PDF copy...');
    const res = await exportService.exportBillPdf(bill, shop);
    if (res.success) {
      flash(`PDF copy of Bill ${bill.billNumber} generated`);
    } else {
      flash(res.error || 'Failed to export bill PDF');
    }
  };

  const handleShareWhatsApp = async (bill: Bill) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    flash('Preparing bill receipt...');
    let pdfUrl: string | undefined;
    try {
      const receiptRes = await exportService.generateAndUploadBillReceipt(bill, shop);
      if (receiptRes?.pdfUrl) {
        pdfUrl = receiptRes.pdfUrl;
      }
    } catch (err) {
      console.warn('Receipt upload notice:', err);
    }
    const msg = whatsappService.formatCustomerBill(bill, shop.name, shop.upiId, shop.phone, pdfUrl);
    await whatsappService.shareViaWhatsApp(msg, bill.customerPhone);
    flash(`Bill ${bill.billNumber} sent on WhatsApp`);
  };

  const handlePrintBill = async (bill: Bill) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (!shop.printerEnabled || (!shop.printerName && !shop.printerUrl)) {
      flash('Please configure printer in Account Settings');
      return;
    }
    flash(`Printing Bill #${bill.billNumber}...`);
    try {
      const ok = await printerService.printReceipt(bill, shop, '80mm');
      if (ok) {
        flash(`Bill #${bill.billNumber} sent to printer`);
      } else {
        flash('Printer could not be reached');
      }
    } catch (err) {
      console.warn('handlePrintBill error:', err);
      flash('Failed to print bill');
    }
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // 1. Tab filter
      const isDeleted = bill.isDeleted || bill.status === 'deleted';
      const isEdited = bill.isEdited || bill.status === 'edited';

      if (activeTab === 'active' && isDeleted) return false;
      if (activeTab === 'edited' && (!isEdited || isDeleted)) return false;
      if (activeTab === 'deleted' && !isDeleted) return false;

      // 2. Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const matchNumber = bill.billNumber?.toLowerCase().includes(q);
      const matchCustomer = bill.customerName?.toLowerCase().includes(q);
      const matchPhone = bill.customerPhone?.toLowerCase().includes(q);
      const matchTable = bill.tableNumber?.toLowerCase().includes(q);

      return matchNumber || matchCustomer || matchPhone || matchTable;
    });
  }, [bills, activeTab, searchQuery]);

  const counts = useMemo(() => {
    let active = 0;
    let edited = 0;
    let deleted = 0;
    bills.forEach(b => {
      if (b.isDeleted || b.status === 'deleted') {
        deleted++;
      } else {
        active++;
        if (b.isEdited || b.status === 'edited') {
          edited++;
        }
      }
    });
    return { all: bills.length, active, edited, deleted };
  }, [bills]);

  const handleConfirmDelete = async () => {
    if (!billToDelete || !shop.id) return;
    if (currentRole === 'Biller') {
      flash('Only the shop Owner or Supervisor can delete or cancel bills');
      setBillToDelete(null);
      return;
    }
    setIsDeleting(true);
    try {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      await billingService.deleteBill(
        shop.id,
        billToDelete.id,
        {
          name: profile?.fullName || currentMember?.fullName || currentRole,
          role: currentRole,
          id: profile?.id || currentMember?.id,
        },
        'Cancelled from Bills register'
      );

      setBillToDelete(null);
      await loadBills();
      try { await refreshSubscription(); } catch {}
      flash(`Bill ${billToDelete.billNumber} cancelled & voided`);
    } catch (err: any) {
      console.warn('handleConfirmDelete error:', err);
      flash(err?.message || 'Failed to cancel bill');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreBill = (bill: Bill) => {
    if (currentRole !== 'Owner') {
      flash('Only the shop Owner can restore cancelled bills');
      return;
    }
    Alert.alert(
      'Restore Bill',
      `Restore Bill ${bill.billNumber} (${formatRupee(bill.totalAmount)}) back to the active bill register?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Bill',
          onPress: async () => {
            try {
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
              await billingService.restoreBill(shop.id, bill.id, {
                name: profile?.fullName || currentMember?.fullName || currentRole,
                role: currentRole,
                id: profile?.id || currentMember?.id,
              });
              await loadBills();
              try { await refreshSubscription(); } catch {}
              flash(`Bill ${bill.billNumber} restored successfully`);
            } catch (err: any) {
              flash(err?.message || 'Failed to restore bill');
            }
          },
        },
      ]
    );
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            onBackToHome();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bills & Invoices</Text>
          <Text style={styles.headerSubtitle}>
            {counts.all} total • {counts.active} active • {counts.deleted} deleted
          </Text>
        </View>
        <TouchableOpacity
          onPress={loadBills}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_bills', 'Search bill by # or customer...')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'all' && styles.activeTabChip]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'all' && styles.activeTabChipText]}>
              {t('all', 'All')} ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'active' && styles.activeTabChip]}
            onPress={() => setActiveTab('active')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'active' && styles.activeTabChipText]}>
              {t('paid', 'Active')} ({counts.active})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'edited' && styles.activeTabChip]}
            onPress={() => setActiveTab('edited')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'edited' && styles.activeTabChipText]}>
              {t('edit', 'Edited')} ({counts.edited})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'deleted' && styles.activeTabChip]}
            onPress={() => setActiveTab('deleted')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'deleted' && styles.activeTabChipText]}>
              {t('cancelled', 'Cancelled')} ({counts.deleted})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Bill List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('loading', 'Loading bills...')}</Text>
        </View>
      ) : filteredBills.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('no_bills_found', 'No bills found')}</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try searching with a different bill number or customer name.'
              : activeTab !== 'all'
              ? `No ${activeTab} bills available.`
              : 'Completed transactions will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {filteredBills.map((bill) => {
            const isDeleted = bill.isDeleted || bill.status === 'deleted' || bill.status === 'cancelled';
            const isEdited = bill.isEdited || bill.status === 'edited';

            return (
              <SwipeToDeleteRow
                key={bill.id}
                disabled={isDeleted || currentRole === 'Biller'}
                onDelete={() => {
                  setBillToDelete(bill);
                }}
              >
                <View
                  style={[
                    styles.billCard,
                    isDeleted && styles.deletedBillCard,
                  ]}
                >
                  {/* Top Row: Bill icon symbol, Bill #, Status Badges, Amount, 3-dots */}
                  <View style={styles.cardHeader}>
                    <View style={styles.billNumberRow}>
                      <View style={styles.billIconCircle}>
                        <Ionicons name="receipt-outline" size={14} color={isDeleted ? colors.textMuted : colors.accent} />
                      </View>
                      <Text style={[styles.billNumber, isDeleted && styles.strikethrough]}>
                        #{bill.billNumber}
                      </Text>

                      {isDeleted ? (
                        <>
                          <View style={styles.deletedBadge}>
                            <Text style={styles.deletedBadgeText}>{t('cancelled', 'CANCELLED')}</Text>
                          </View>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                            onPress={() => handleRestoreBill(bill)}
                            style={styles.restoreHeaderChip}
                            accessibilityLabel="Restore bill"
                          >
                            <Ionicons name="refresh" size={11} color="#15803D" />
                            <Text style={styles.restoreHeaderChipText}>{t('restore', 'Restore')}</Text>
                          </TouchableOpacity>
                        </>
                      ) : isEdited ? (
                        <View style={styles.editedBadge}>
                          <Text style={styles.editedBadgeText}>EDITED</Text>
                        </View>
                      ) : null}

                      {bill.tableNumber ? (
                        <View style={styles.tableBadge}>
                          <Ionicons name="restaurant-outline" size={11} color={colors.accent} />
                          <Text style={styles.tableBadgeText}>{bill.tableNumber}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardHeaderRight}>
                      <Text style={[styles.totalAmount, isDeleted && styles.deletedTotalAmount]}>
                        {formatRupee(bill.totalAmount)}
                      </Text>
                      {!isDeleted && (
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                          onPress={(e) => {
                            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                            const { pageX, pageY } = e.nativeEvent;
                            setMenuAnchor({ x: pageX, y: pageY });
                            setSelectedBillForMenu(bill);
                            setIsMenuVisible(true);
                          }}
                          style={styles.menuIconBtn}
                          accessibilityLabel="Bill actions"
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Compact Bottom Row: Customer & Date on left, View Details on right */}
                  <View style={styles.detailsRow}>
                    <View style={styles.customerCol}>
                      <Text style={styles.customerLine} numberOfLines={1}>
                        <Text style={styles.customerName}>
                          {bill.customerName ? bill.customerName : 'Walk-in'}
                        </Text>
                        {bill.customerPhone ? (
                          <Text style={styles.customerPhone}> • +91 {bill.customerPhone}</Text>
                        ) : null}
                        <Text style={styles.timestampText}> • {formatTimestamp(bill.createdAt)}</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setPreviewBill(bill)}
                      style={styles.viewItemsBtn}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.viewItemsLink}>View Details →</Text>
                    </TouchableOpacity>
                  </View>



                  {/* Audit Trail Section */}
                  {(bill.createdByName || isEdited || isDeleted) && (
                    <View style={styles.auditBox}>
                      {isDeleted && bill.deletedByName ? (
                        <Text style={[styles.auditLine, { color: colors.danger || '#DC2626' }]}>
                          Cancelled by <Text style={styles.auditHighlight}>{bill.deletedByName}</Text> ({bill.deletedByRole || 'Staff'}) {bill.deletedAt ? `on ${formatTimestamp(bill.deletedAt)}` : ''}
                          {bill.cancellationReason ? ` • ${bill.cancellationReason}` : ''}
                        </Text>
                      ) : isEdited && bill.editedByName ? (
                        <Text style={[styles.auditLine, { color: '#B45309' }]}>
                          Edited by <Text style={styles.auditHighlight}>{bill.editedByName}</Text> ({bill.editedByRole || 'Staff'}) {bill.editedAt ? `on ${formatTimestamp(bill.editedAt)}` : ''}
                        </Text>
                      ) : bill.createdByName ? (
                        <Text style={styles.auditLine}>
                          Created by <Text style={styles.auditHighlight}>{bill.createdByName}</Text> ({bill.createdByRole || 'Staff'})
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </SwipeToDeleteRow>
            );
          })}
        </ScrollView>
      )}

      {/* Bill Action Menu Modal (Three dots) */}
      <BillActionMenuModal
        visible={isMenuVisible}
        onClose={() => {
          setIsMenuVisible(false);
          setMenuAnchor(null);
        }}
        anchorPosition={menuAnchor}
        bill={selectedBillForMenu}
        onPrint={handlePrintBill}
        onDownloadPdf={handleDownloadPdf}
        onShareWhatsApp={handleShareWhatsApp}
        onEdit={currentRole !== 'Biller' ? onEditBill : undefined}
        onDelete={currentRole !== 'Biller' ? (bill) => setBillToDelete(bill) : undefined}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!billToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setBillToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="trash" size={32} color="#DC2626" />
            </View>

            <Text style={styles.confirmTitle}>Delete Bill {billToDelete?.billNumber}?</Text>
            <Text style={styles.confirmDescription}>
              This bill ({formatRupee(billToDelete?.totalAmount || 0)}) will be marked as deleted. It will be removed from daily sales and revenue reports, but preserved in the audit log.
            </Text>

            <View style={styles.confirmNoticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#B45309" />
              <Text style={styles.confirmNoticeText}>
                Deleted bills still count toward the 100 free bills limit.
              </Text>
            </View>

            <View style={styles.modalButtonsRow}>
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => setBillToDelete(null)}
                style={{ flex: 1 }}
                disabled={isDeleting}
              />
              <AppButton
                title={isDeleting ? 'Deleting...' : 'Delete'}
                variant="danger"
                onPress={handleConfirmDelete}
                style={{ flex: 1 }}
                disabled={isDeleting}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Bill Preview Modal */}
      <Modal
        visible={!!previewBill}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewBill(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>Bill {previewBill?.billNumber}</Text>
                <Text style={styles.previewSubtitle}>{formatTimestamp(previewBill?.createdAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewBill(null)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {previewBill?.items?.map((item, idx) => (
                <View key={idx} style={styles.previewItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewItemName}>{item.itemName}</Text>
                    <Text style={styles.previewItemQty}>
                      {item.quantity} × {formatRupee(item.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.previewItemTotal}>
                    {formatRupee(item.lineTotal || item.unitPrice * item.quantity)}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.previewSummary}>
              <View style={styles.previewSummaryRow}>
                <Text style={styles.previewSummaryLabel}>Subtotal</Text>
                <Text style={styles.previewSummaryVal}>{formatRupee(previewBill?.subtotal || 0)}</Text>
              </View>
              {(previewBill?.gstAmount || 0) > 0 && (
                <View style={styles.previewSummaryRow}>
                  <Text style={styles.previewSummaryLabel}>GST</Text>
                  <Text style={styles.previewSummaryVal}>{formatRupee(previewBill?.gstAmount || 0)}</Text>
                </View>
              )}
              <View style={[styles.previewSummaryRow, styles.previewTotalRow]}>
                <Text style={styles.previewTotalLabel}>Total</Text>
                <Text style={styles.previewTotalVal}>{formatRupee(previewBill?.totalAmount || 0)}</Text>
              </View>
            </View>

            {(previewBill?.isDeleted || previewBill?.status === 'cancelled') && previewBill?.deletedByName && (
              <View style={[styles.auditBox, { marginTop: 12 }]}>
                <Text style={[styles.auditLine, { color: colors.danger || '#DC2626' }]}>
                  Cancelled by <Text style={styles.auditHighlight}>{previewBill.deletedByName}</Text> ({previewBill.deletedByRole || 'Supervisor'}) {previewBill.deletedAt ? `on ${formatTimestamp(previewBill.deletedAt)}` : ''}
                  {previewBill.cancellationReason ? ` • ${previewBill.cancellationReason}` : ''}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {(previewBill?.isDeleted || previewBill?.status === 'cancelled') ? (
                <AppButton
                  title="Restore Bill"
                  variant="primary"
                  icon={<Ionicons name="refresh-outline" size={17} color="#FFFFFF" />}
                  onPress={() => {
                    if (previewBill) {
                      const b = previewBill;
                      setPreviewBill(null);
                      handleRestoreBill(b);
                    }
                  }}
                  style={{ flex: 1.3, backgroundColor: '#16A34A' }}
                />
              ) : (
                <AppButton
                  title="Download PDF"
                  variant="primary"
                  icon={<Ionicons name="document-text-outline" size={17} color="#FFFFFF" />}
                  onPress={() => {
                    if (previewBill) {
                      handleDownloadPdf(previewBill);
                    }
                  }}
                  style={{ flex: 1.3 }}
                />
              )}
              <AppButton
                title="Close"
                variant="secondary"
                onPress={() => setPreviewBill(null)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: Theme, insets?: { top: number; bottom: number; left: number; right: number }) => {
  const colors = theme.colors;
  const bottomInset = insets?.bottom || 0;
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
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.body,
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
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  searchBar: {
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.inputText,
    fontFamily: typography.fonts.body,
    paddingVertical: 0,
  },
  tabsWrapper: {
    backgroundColor: 'transparent',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  tabChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  activeTabChip: {
    backgroundColor: theme.isDark ? colors.accent : '#111111',
    borderColor: theme.isDark ? colors.accent : '#111111',
    ...shadows.sm,
  },
  tabChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.fonts.heading,
  },
  activeTabChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  customerMiniIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: Math.max(bottomInset, 20) + 120,
    gap: 8,
  },
  billCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    ...shadows.card,
  },
  deletedBillCard: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderLeftWidth: 3.5,
    borderLeftColor: '#DC2626',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 95, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    fontFamily: typography.fonts.heading,
    letterSpacing: -0.2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    textDecorationColor: '#DC2626',
    color: colors.textMuted,
    opacity: 0.8,
  },
  deletedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  deletedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  editedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  editedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accent100,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  tableBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.accent,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    fontFamily: typography.fonts.numbers,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  deletedTotalAmount: {
    color: colors.textMuted,
  },
  restoreHeaderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 3,
  },
  restoreHeaderChipText: {
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  restoreBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  restoreIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledActionRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  fullRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  fullRestoreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
    letterSpacing: 0.2,
  },
  menuIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.isDark ? colors.surfaceElevated : colors.neutral100,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  customerCol: {
    flex: 1,
    marginRight: 8,
  },
  customerLine: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
  },
  customerName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  customerPhone: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  timestampText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  viewItemsBtn: {
    paddingVertical: 2,
    paddingLeft: 6,
  },
  viewItemsLink: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  auditBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  auditLine: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  auditHighlight: {
    fontWeight: '600',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay55,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    ...shadows.lg,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  confirmDescription: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  confirmNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: radii.md,
    marginTop: 14,
    width: '100%',
  },
  confirmNoticeText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  previewModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  previewSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 4,
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  previewItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  previewItemQty: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  previewItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    fontFamily: typography.fonts.numbers,
    fontVariant: ['tabular-nums'],
  },
  previewSummary: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  previewSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewSummaryLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  previewSummaryVal: {
    fontSize: 13,
    color: colors.text,
    fontFamily: typography.fonts.numbers,
    fontVariant: ['tabular-nums'],
  },
  previewTotalRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  previewTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: typography.fonts.bodySemiBold,
  },
  previewTotalVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    fontFamily: typography.fonts.numbers,
    fontVariant: ['tabular-nums'],
  },
  });
};
