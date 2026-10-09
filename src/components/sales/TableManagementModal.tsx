import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { billingService } from '../../services/billingService';
import { Bill } from '../../types/models';

interface TableInfo {
  id: string;
  name: string;
  tableNumber: number;
  isCurrentCart: boolean;
  isOccupied: boolean;
  itemCount: number;
  totalAmount: number;
  elapsedMinutes?: number;
  customerName?: string;
}

interface TableManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TableManagementModal: React.FC<TableManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const { shop } = useShop();
  const {
    selectedTable,
    setSelectedTable,
    totalCount,
    subtotal,
    cart,
    flash,
  } = useCart();

  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const [recentBills, setRecentBills] = useState<Bill[]>([]);

  useEffect(() => {
    if (visible && shop.id) {
      billingService
        .getBills(shop.id)
        .then(bills => {
          // Keep today's pending bills
          const today = new Date().toDateString();
          const todayPending = bills.filter(
            b =>
              !b.isDeleted &&
              b.pendingAmount &&
              b.pendingAmount > 0 &&
              new Date(b.createdAt).toDateString() === today
          );
          setRecentBills(todayPending);
        })
        .catch(() => setRecentBills([]));
    }
  }, [visible, shop.id]);

  const totalTableCount = Math.max(1, shop.tableCount || 4);

  // Build table info list
  const tables: TableInfo[] = Array.from({ length: totalTableCount }, (_, idx) => {
    const num = idx + 1;
    const name = `Table ${num}`;
    const isCurrent = selectedTable === name;

    // Check if table has a pending bill
    const pendingBill = recentBills.find(
      b => b.tableNumber?.toLowerCase() === name.toLowerCase() || b.tableNumber === String(num)
    );

    const hasCartItems = isCurrent && cart.length > 0;
    const isOccupied = hasCartItems || !!pendingBill;

    let itemCount = 0;
    let totalAmount = 0;
    let elapsedMinutes: number | undefined;
    let customerName: string | undefined;

    if (hasCartItems) {
      itemCount = totalCount;
      totalAmount = subtotal;
    } else if (pendingBill) {
      itemCount = pendingBill.items?.length || 1;
      totalAmount = pendingBill.totalAmount || pendingBill.subtotal || 0;
      customerName = pendingBill.customerName || undefined;
      const createdTime = new Date(pendingBill.createdAt).getTime();
      elapsedMinutes = Math.max(1, Math.round((Date.now() - createdTime) / 60000));
    }

    return {
      id: `table_${num}`,
      name,
      tableNumber: num,
      isCurrentCart: isCurrent,
      isOccupied,
      itemCount,
      totalAmount,
      elapsedMinutes,
      customerName,
    };
  });

  const occupiedCount = tables.filter(t => t.isOccupied).length;
  const availableCount = tables.length - occupiedCount;

  const filteredTables = tables.filter(t => {
    if (filter === 'available') return !t.isOccupied;
    if (filter === 'occupied') return t.isOccupied;
    return true;
  });

  const handleSelectTable = (t: TableInfo) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setSelectedTable(t.name);
    flash(`${t.name} selected — add items to bill`);
    onClose();
  };

  const handleClearTable = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setSelectedTable(null);
    flash('Switched to Counter Billing (Takeaway) — Cart items preserved');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheetCard}>
          {/* Top Handle / Drag indicator */}
          <View style={styles.dragBar} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="restaurant" size={20} color="#FF5F00" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Restaurant Floor & Tables</Text>
                <Text style={styles.headerSub}>
                  {selectedTable
                    ? `Currently Billing: ${selectedTable}`
                    : 'Counter Mode (Standard Takeaway)'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* TOP QUICK ACTION BAR: CLEAR TABLE / SWITCH TO COUNTER */}
          <View style={styles.quickActionBar}>
            <TouchableOpacity
              style={[
                styles.switchCounterBtn,
                !selectedTable && styles.switchCounterBtnActive,
              ]}
              onPress={handleClearTable}
              activeOpacity={0.8}
            >
              <Ionicons
                name={!selectedTable ? 'checkmark-circle' : 'storefront-outline'}
                size={18}
                color={!selectedTable ? '#15803D' : '#FF5F00'}
              />
              <View style={styles.switchCounterContent}>
                <Text
                  style={[
                    styles.switchCounterTitle,
                    !selectedTable && styles.switchCounterTitleActive,
                  ]}
                >
                  Clear Table / Switch to Counter
                </Text>
                <Text style={styles.switchCounterSub}>
                  {!selectedTable
                    ? 'Active mode: Counter / Takeaway'
                    : 'Unassign table and bill at counter (items kept)'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={!selectedTable ? '#15803D' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Stats Bar & Filter Tabs */}
          <View style={styles.metaRow}>
            <View style={styles.filterTabs}>
              <TouchableOpacity
                onPress={() => setFilter('all')}
                style={[
                  styles.filterTab,
                  filter === 'all' && styles.filterTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === 'all' && styles.filterTabTextActive,
                  ]}
                >
                  All ({tables.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilter('available')}
                style={[
                  styles.filterTab,
                  filter === 'available' && styles.filterTabActive,
                ]}
              >
                <View style={styles.dotGreen} />
                <Text
                  style={[
                    styles.filterTabText,
                    filter === 'available' && styles.filterTabTextActive,
                  ]}
                >
                  Available ({availableCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilter('occupied')}
                style={[
                  styles.filterTab,
                  filter === 'occupied' && styles.filterTabActive,
                ]}
              >
                <View style={styles.dotOrange} />
                <Text
                  style={[
                    styles.filterTabText,
                    filter === 'occupied' && styles.filterTabTextActive,
                  ]}
                >
                  Occupied ({occupiedCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Table Grid Floor Layout */}
          <ScrollView
            contentContainerStyle={styles.tableScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gridContainer}>
              {filteredTables.map(t => {
                const isCurrent = t.isCurrentCart;
                const isOcc = t.isOccupied;

                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.85}
                    onPress={() => handleSelectTable(t)}
                    style={[
                      styles.tableCard,
                      isCurrent && styles.tableCardCurrent,
                      !isCurrent && isOcc && styles.tableCardOccupied,
                    ]}
                  >
                    {/* Top Row: Table Number and Status */}
                    <View style={styles.cardHeader}>
                      <View style={styles.numberBadge}>
                        <Text style={styles.tableNumberLabel}>
                          {t.tableNumber < 10 ? `T-0${t.tableNumber}` : `T-${t.tableNumber}`}
                        </Text>
                      </View>

                      {isCurrent ? (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentPillText}>CURRENT</Text>
                        </View>
                      ) : isOcc ? (
                        <View style={styles.occupiedPill}>
                          <View style={styles.dotOrangeSmall} />
                          <Text style={styles.occupiedPillText}>Occupied</Text>
                        </View>
                      ) : (
                        <View style={styles.availablePill}>
                          <View style={styles.dotGreenSmall} />
                          <Text style={styles.availablePillText}>Available</Text>
                        </View>
                      )}
                    </View>

                    {/* Middle Info: Table Name & Seating Details */}
                    <Text style={styles.tableNameText}>{t.name}</Text>

                    {isOcc ? (
                      <View style={styles.orderMetrics}>
                        <View style={styles.metricRow}>
                          <Text style={styles.metricAmount}>
                            ₹{t.totalAmount.toLocaleString('en-IN')}
                          </Text>
                          <Text style={styles.metricCount}>
                            {t.itemCount} {t.itemCount === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                        {t.elapsedMinutes ? (
                          <Text style={styles.elapsedText}>
                            Seated {t.elapsedMinutes}m ago
                          </Text>
                        ) : (
                          <Text style={styles.elapsedText}>
                            {isCurrent ? 'Current Cart' : 'Active Order'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.readyContainer}>
                        <Text style={styles.readyText}>Ready for guests</Text>
                        <Text style={styles.readySub}>Tap to assign order</Text>
                      </View>
                    )}

                    {/* Bottom Action Pill */}
                    <View
                      style={[
                        styles.cardActionBtn,
                        isCurrent
                          ? styles.cardActionCurrent
                          : isOcc
                          ? styles.cardActionOccupied
                          : styles.cardActionAvailable,
                      ]}
                    >
                      <Ionicons
                        name={
                          isCurrent
                            ? 'checkmark-circle'
                            : isOcc
                            ? 'restaurant-outline'
                            : 'add-circle-outline'
                        }
                        size={14}
                        color={
                          isCurrent
                            ? '#FFFFFF'
                            : isOcc
                            ? '#C2410C'
                            : '#15803D'
                        }
                      />
                      <Text
                        style={[
                          styles.cardActionText,
                          isCurrent
                            ? styles.cardActionTextCurrent
                            : isOcc
                            ? styles.cardActionTextOccupied
                            : styles.cardActionTextAvailable,
                        ]}
                      >
                        {isCurrent
                          ? 'Active Cart'
                          : isOcc
                          ? 'Open Bill'
                          : 'Select Table'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredTables.length === 0 && (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="restaurant-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>No tables found in this filter</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  dragBar: {
    width: 44,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  switchCounterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  switchCounterBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  switchCounterContent: {
    flex: 1,
  },
  switchCounterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C2410C',
  },
  switchCounterTitleActive: {
    color: '#15803D',
  },
  switchCounterSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  metaRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  dotOrange: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  dotGreenSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  dotOrangeSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EA580C',
  },
  tableScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  tableCard: {
    width: (Dimensions.get('window').width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tableCardCurrent: {
    borderColor: '#FF5F00',
    backgroundColor: '#FFFAF5',
    borderWidth: 2,
    shadowColor: '#FF5F00',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  tableCardOccupied: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFDF9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  numberBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tableNumberLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentPill: {
    backgroundColor: '#FF5F00',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  occupiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  occupiedPillText: {
    color: '#C2410C',
    fontSize: 10,
    fontWeight: '700',
  },
  availablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  availablePillText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '700',
  },
  tableNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  orderMetrics: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  metricAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  elapsedText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  readyContainer: {
    paddingVertical: 8,
    marginBottom: 10,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  readySub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 10,
  },
  cardActionCurrent: {
    backgroundColor: '#FF5F00',
  },
  cardActionOccupied: {
    backgroundColor: '#FFEDD5',
  },
  cardActionAvailable: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionTextCurrent: {
    color: '#FFFFFF',
  },
  cardActionTextOccupied: {
    color: '#C2410C',
  },
  cardActionTextAvailable: {
    color: '#15803D',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
});
