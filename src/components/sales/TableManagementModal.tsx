import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, Theme, typography } from '../../theme';
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
  const isDark = theme.isDark;
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  // Give at least 6 dining tables by default (Row 1: T1 & T2, Row 2: T3 & T4, Row 3: T5 & T6)
  const totalTableCount = Math.max(6, shop.tableCount || 6);

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

  // Strict 2 tables per row pairing (Row 1: T1 & T2, Row 2: T3 & T4, Row 3: T5 & T6)
  const tablePairs = useMemo(() => {
    const pairs: TableInfo[][] = [];
    for (let i = 0; i < filteredTables.length; i += 2) {
      pairs.push(filteredTables.slice(i, i + 2));
    }
    return pairs;
  }, [filteredTables]);

  const handleSelectTable = (t: TableInfo) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setSelectedTable(t.name);
    flash(`${t.name} selected. Add items to bill`);
    onClose();
  };

  const handleClearTable = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setSelectedTable(null);
    flash('Switched to Counter Billing (Takeaway). Cart items preserved');
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
              accessibilityLabel="Close Floor Modal"
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
                color={!selectedTable ? (isDark ? '#4ADE80' : '#15803D') : '#FF5F00'}
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
                color={!selectedTable ? (isDark ? '#4ADE80' : '#15803D') : colors.textSecondary}
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

          {/* Table Grid Floor Layout: 2 Tables per row strictly */}
          <ScrollView
            contentContainerStyle={styles.tableScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tablesContainer}>
              {tablePairs.map((pair, rowIndex) => (
                <View key={`row_${rowIndex}`} style={styles.tableRow}>
                  {pair.map(t => {
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
                        <Text style={styles.tableNameText} numberOfLines={1}>{t.name}</Text>

                        {isOcc ? (
                          <View style={styles.orderMetrics}>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricAmount} numberOfLines={1}>
                                ₹{t.totalAmount.toLocaleString('en-IN')}
                              </Text>
                              <Text style={styles.metricCount} numberOfLines={1}>
                                {t.itemCount} {t.itemCount === 1 ? 'item' : 'items'}
                              </Text>
                            </View>
                            {t.elapsedMinutes ? (
                              <Text style={styles.elapsedText} numberOfLines={1}>
                                Seated {t.elapsedMinutes}m ago
                              </Text>
                            ) : (
                              <Text style={styles.elapsedText} numberOfLines={1}>
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
                            size={13}
                            color={
                              isCurrent
                                ? '#FFFFFF'
                                : isOcc
                                ? (isDark ? '#FB923C' : '#C2410C')
                                : (isDark ? '#4ADE80' : '#15803D')
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
                            numberOfLines={1}
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
                  {pair.length === 1 && <View style={styles.tableCardPlaceholder} />}
                </View>
              ))}
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

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  const isDark = theme.isDark;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dragBar: {
      width: 44,
      height: 4,
      backgroundColor: isDark ? colors.border : '#E2E8F0',
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
      borderBottomColor: colors.border,
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
      backgroundColor: isDark ? 'rgba(255,95,0,0.15)' : '#FFF7ED',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,95,0,0.35)' : '#FFEDD5',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      marginTop: 1,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    switchCounterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,95,0,0.1)' : '#FFF7ED',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,95,0,0.3)' : '#FDBA74',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
    },
    switchCounterBtnActive: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#F0FDF4',
      borderColor: isDark ? 'rgba(34,197,94,0.35)' : '#86EFAC',
    },
    switchCounterContent: {
      flex: 1,
    },
    switchCounterTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#FB923C' : '#C2410C',
    },
    switchCounterTitleActive: {
      color: isDark ? '#4ADE80' : '#15803D',
    },
    switchCounterSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    metaRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    filterTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    filterTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterTabTextActive: {
      color: colors.text,
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
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    tablesContainer: {
      width: '100%',
    },
    tableRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
      width: '100%',
    },
    tableCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 10,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    tableCardPlaceholder: {
      flex: 1,
    },
    tableCardCurrent: {
      borderColor: '#FF5F00',
      backgroundColor: isDark ? 'rgba(255,95,0,0.12)' : '#FFFAF5',
      borderWidth: 2,
      shadowColor: '#FF5F00',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
    },
    tableCardOccupied: {
      borderColor: isDark ? 'rgba(254,215,170,0.3)' : '#FED7AA',
      backgroundColor: isDark ? 'rgba(255,237,213,0.06)' : '#FFFDF9',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    numberBadge: {
      backgroundColor: isDark ? '#111827' : '#0F172A',
      paddingHorizontal: 6,
      paddingVertical: 2.5,
      borderRadius: 7,
    },
    tableNumberLabel: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    currentPill: {
      backgroundColor: '#FF5F00',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    currentPillText: {
      color: '#FFFFFF',
      fontSize: 8.5,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    occupiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(255,237,213,0.15)' : '#FFEDD5',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    occupiedPillText: {
      color: isDark ? '#FB923C' : '#C2410C',
      fontSize: 9.5,
      fontWeight: '700',
    },
    availablePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    availablePillText: {
      color: isDark ? '#4ADE80' : '#15803D',
      fontSize: 9.5,
      fontWeight: '700',
    },
    tableNameText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    orderMetrics: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      padding: 7,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    metricAmount: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    metricCount: {
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    elapsedText: {
      fontSize: 9.5,
      color: colors.textMuted,
      marginTop: 2,
    },
    readyContainer: {
      paddingVertical: 6,
      marginBottom: 8,
    },
    readyText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: isDark ? '#4ADE80' : '#16A34A',
    },
    readySub: {
      fontSize: 9.5,
      color: colors.textMuted,
      marginTop: 1,
    },
    cardActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 6,
      borderRadius: 9,
    },
    cardActionCurrent: {
      backgroundColor: '#FF5F00',
    },
    cardActionOccupied: {
      backgroundColor: isDark ? 'rgba(255,237,213,0.15)' : '#FFEDD5',
    },
    cardActionAvailable: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
    },
    cardActionText: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    cardActionTextCurrent: {
      color: '#FFFFFF',
    },
    cardActionTextOccupied: {
      color: isDark ? '#FB923C' : '#C2410C',
    },
    cardActionTextAvailable: {
      color: isDark ? '#4ADE80' : '#15803D',
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 10,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
};

