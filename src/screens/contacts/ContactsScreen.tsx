import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { contactService, DeviceContactItem } from '../../services/contactService';
import { CustomerRecord, VendorRecord } from '../../types/models';
import { formatRupee } from '../../lib/money';

interface ContactsScreenProps {
  onBackToHome: () => void;
  focusCustomerName?: string;
}

type AddStep = 'choice' | 'import' | 'manual';

export const ContactsScreen: React.FC<ContactsScreenProps> = ({
  onBackToHome,
  focusCustomerName,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { shop } = useShop();
  const { flash } = useCart();

  const [activeTab, setActiveTab] = useState<'Customers' | 'Vendors'>('Customers');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add Contact Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>('choice');

  // Manual Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSupplyType, setFormSupplyType] = useState('Milk');
  const [isSaving, setIsSaving] = useState(false);

  // Device Contacts State & Multi-select
  const [deviceContacts, setDeviceContacts] = useState<DeviceContactItem[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [importSupplyType, setImportSupplyType] = useState('Milk');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const supplyTypes = ['Milk', 'Bakery', 'Tea Powder', 'Gas Cylinder', 'Snacks', 'Groceries'];

  // Pagination & progressive loading (load 20 initially to prevent freezing with 1000+ items)
  const [customerLimit, setCustomerLimit] = useState(20);
  const [vendorLimit, setVendorLimit] = useState(20);
  const [deviceContactLimit, setDeviceContactLimit] = useState(20);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');

  // Filter Tabs: 'active' | 'all' | 'vip' | 'inactive'
  const [filterTag, setFilterTag] = useState<'active' | 'all' | 'vip' | 'inactive'>('active');

  // Action Menu State (3-dot)
  const [selectedActionItem, setSelectedActionItem] = useState<{
    type: 'customer' | 'vendor';
    item: CustomerRecord | VendorRecord;
  } | null>(null);

  // Edit Contact Modal State
  const [editingContact, setEditingContact] = useState<{
    type: 'customer' | 'vendor';
    item: CustomerRecord | VendorRecord;
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSupplyType, setEditSupplyType] = useState('Milk');
  const [editIsVip, setEditIsVip] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  // Customer History Modal State
  const [historyCustomer, setHistoryCustomer] = useState<CustomerRecord | null>(null);
  const [customerHistoryData, setCustomerHistoryData] = useState<{
    totalBills: number;
    totalSpent: number;
    bills: any[];
    favoriteItems: Array<{ name: string; quantity: number; amount: number }>;
  } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [shop.id]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const custs = await contactService.getCustomers(shop.id);
      const vends = await contactService.getVendors(shop.id);
      setCustomers(custs);
      setVendors(vends);
      setCustomerLimit(20);
      setVendorLimit(20);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCustomerHistory = async (c: CustomerRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setHistoryCustomer(c);
    setIsLoadingHistory(true);
    try {
      const hist = await contactService.getCustomerHistory(shop.id, c.name, c.phone);
      setCustomerHistoryData(hist);
    } catch (err) {
      console.warn('Failed to load customer history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCallContact = (phone?: string | null) => {
    if (!phone) {
      flash('No phone number saved for this contact');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '');
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Linking.openURL(`tel:${clean}`);
  };

  const handleWhatsAppContact = (name: string, phone?: string | null) => {
    if (!phone) {
      flash('No phone number saved for this contact');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const msg = encodeURIComponent(`Hi ${name},\nGreetings from ${shop.name || 'our shop'}!`);
    Linking.openURL(`https://wa.me/91${clean}?text=${msg}`);
  };

  const handleOpenEditContact = (type: 'customer' | 'vendor', item: any) => {
    setEditingContact({ type, item });
    setEditName(item.name || '');
    setEditPhone(item.phone ? item.phone.replace(/[^0-9]/g, '').slice(-10) : '');
    setEditLocation(item.location || '');
    setEditSupplyType(item.supplyType || 'Milk');
    setEditIsVip(!!item.isVip || item.statusTag === 'MVP');
    setEditIsActive(item.isActive !== false);
    setSelectedActionItem(null);
  };

  const handleSaveEditContact = async () => {
    if (!editingContact || !editName.trim()) {
      flash('Contact name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingContact.type === 'customer') {
        await contactService.updateCustomer(shop.id, editingContact.item.id, {
          name: editName.trim(),
          phone: editPhone ? editPhone.replace(/[^0-9]/g, '').slice(-10) : null,
          location: editLocation.trim() || null,
          isVip: editIsVip,
          isActive: editIsActive,
        });
        flash(`Updated ${editName.trim()}`);
      } else {
        await contactService.updateVendor(shop.id, editingContact.item.id, {
          name: editName.trim(),
          phone: editPhone ? editPhone.replace(/[^0-9]/g, '').slice(-10) : null,
          location: editLocation.trim() || null,
          supplyType: editSupplyType.trim() || 'Supplies',
          isActive: editIsActive,
        });
        flash(`Updated ${editName.trim()}`);
      }
      await loadContacts();
      setEditingContact(null);
    } catch (err) {
      flash('Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleInactive = async (type: 'customer' | 'vendor', item: any) => {
    const newActive = item.isActive === false ? true : false;
    try {
      if (type === 'customer') {
        await contactService.toggleCustomerActive(shop.id, item.id, newActive);
        flash(newActive ? `${item.name} marked Active` : `${item.name} marked Inactive in database`);
      } else {
        await contactService.toggleVendorActive(shop.id, item.id, newActive);
        flash(newActive ? `${item.name} marked Active` : `${item.name} marked Inactive in database`);
      }
      await loadContacts();
    } catch (err) {
      flash('Failed to update status');
    } finally {
      setSelectedActionItem(null);
    }
  };

  const handleDeleteContact = async (type: 'customer' | 'vendor', item: any) => {
    try {
      if (type === 'customer') {
        await contactService.toggleCustomerActive(shop.id, item.id, false);
        flash(`${item.name} marked Inactive and preserved in database`);
      } else {
        await contactService.toggleVendorActive(shop.id, item.id, false);
        flash(`${item.name} marked Inactive and preserved in database`);
      }
      await loadContacts();
    } catch (err) {
      flash('Failed to archive contact');
    } finally {
      setSelectedActionItem(null);
    }
  };

  const handleOpenAddModal = () => {
    setAddStep('choice');
    setFormName('');
    setFormPhone('');
    setFormLocation('');
    setFormSupplyType('Milk');
    setImportSupplyType('Milk');
    setSelectedContactIds([]);
    setContactSearchQuery('');
    setDeviceContactLimit(20);
    setIsModalOpen(true);
  };

  const handleSelectImportFromContacts = async () => {
    setAddStep('import');
    setSelectedContactIds([]);
    setDeviceContactLimit(20);
    setIsLoadingContacts(true);
    try {
      const contacts = await contactService.getDeviceContacts();
      setDeviceContacts(contacts);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleToggleContactSelection = (id: string) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (visibleIds: string[]) => {
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedContactIds.includes(id));
    if (allSelected) {
      setSelectedContactIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedContactIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleImportSelectedContacts = async () => {
    if (selectedContactIds.length === 0) {
      flash('Please select at least one contact');
      return;
    }

    const selectedList = deviceContacts.filter(c => selectedContactIds.includes(c.id));
    if (selectedList.length === 0) return;

    setIsSaving(true);
    try {
      if (activeTab === 'Customers') {
        await contactService.addMultipleCustomers(shop.id, selectedList);
        flash(`Added ${selectedList.length} customer${selectedList.length > 1 ? 's' : ''}`);
      } else {
        await contactService.addMultipleVendors(shop.id, selectedList, importSupplyType);
        flash(`Added ${selectedList.length} vendor${selectedList.length > 1 ? 's' : ''} (${importSupplyType})`);
      }
      setIsModalOpen(false);
      setSelectedContactIds([]);
      await loadContacts();
    } catch (err) {
      flash('Failed to import contacts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManualContact = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      flash('Please enter a name');
      return;
    }

    const cleanPhone = formPhone.replace(/[^0-9]/g, '');
    if (formPhone.trim() && cleanPhone.length !== 10) {
      flash('Mobile number must be exactly 10 digits');
      return;
    }

    if (activeTab === 'Customers' && cleanPhone.length === 10) {
      const alreadyExists = customers.find(
        c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone
      );
      if (alreadyExists) {
        flash(`Customer with this number already exists (${alreadyExists.name})`);
        setIsModalOpen(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (activeTab === 'Customers') {
        await contactService.addCustomer(
          shop.id,
          trimmedName,
          formPhone.trim() || undefined,
          formLocation.trim() || undefined
        );
        flash(`Customer ${trimmedName} saved`);
      } else {
        await contactService.addVendor(
          shop.id,
          trimmedName,
          formSupplyType.trim() || 'Supplies',
          formPhone.trim() || undefined,
          formLocation.trim() || undefined
        );
        flash(`Vendor ${trimmedName} saved`);
      }

      setIsModalOpen(false);
      await loadContacts();
    } catch (err) {
      flash('Error saving contact');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCustomersCount = customers.filter(c => c.isActive !== false).length;
  const inactiveCustomersCount = customers.filter(c => c.isActive === false).length;
  const vipCustomersCount = customers.filter(c => c.isVip || c.statusTag === 'MVP').length;

  const activeVendorsCount = vendors.filter(v => v.isActive !== false).length;
  const inactiveVendorsCount = vendors.filter(v => v.isActive === false).length;

  // Customers filtered by directory search & filter tags
  const filteredCustomers = customers.filter(c => {
    if (filterTag === 'active' && c.isActive === false) return false;
    if (filterTag === 'inactive' && c.isActive !== false) return false;
    if (filterTag === 'vip' && !c.isVip && c.statusTag !== 'MVP') return false;

    if (!directorySearchQuery.trim()) return true;
    const q = directorySearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
    );
  });
  const visibleCustomers = filteredCustomers.slice(0, customerLimit);

  // Vendors filtered by directory search & filter tags
  const filteredVendors = vendors.filter(v => {
    if (filterTag === 'active' && v.isActive === false) return false;
    if (filterTag === 'inactive' && v.isActive !== false) return false;

    if (!directorySearchQuery.trim()) return true;
    const q = directorySearchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.phone && v.phone.includes(q)) ||
      (v.supplyType && v.supplyType.toLowerCase().includes(q)) ||
      (v.location && v.location.toLowerCase().includes(q))
    );
  });
  const visibleVendors = filteredVendors.slice(0, vendorLimit);

  const filteredDeviceContacts = deviceContacts.filter(c =>
    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(contactSearchQuery))
  );
  const visibleDeviceContacts = filteredDeviceContacts.slice(0, deviceContactLimit);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Customers & Vendors</Text>
            <Text style={styles.subtitle}>Directory & Ledgers</Text>
          </View>
        </View>

        {/* Segmented Tab */}
        <SegmentedControl
          options={['Customers', 'Vendors']}
          selected={activeTab}
          onSelect={tab => {
            setActiveTab(tab);
            setCustomerLimit(20);
            setVendorLimit(20);
          }}
        />

        {/* Search Bar for Directory */}
        <View style={styles.directorySearchBar}>
          <Ionicons name="search-outline" size={17} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.directorySearchInput}
            placeholder={
              activeTab === 'Customers'
                ? `Search ${customers.length} customer${customers.length === 1 ? '' : 's'}...`
                : `Search ${vendors.length} vendor${vendors.length === 1 ? '' : 's'}...`
            }
            placeholderTextColor={colors.textSecondary}
            value={directorySearchQuery}
            onChangeText={setDirectorySearchQuery}
          />
          {directorySearchQuery ? (
            <TouchableOpacity onPress={() => setDirectorySearchQuery('')}>
              <Ionicons name="close" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills Row */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            onPress={() => setFilterTag('active')}
            style={[styles.filterPill, filterTag === 'active' && styles.filterPillSelected]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, filterTag === 'active' && styles.filterPillTextSelected]}>
              Active ({activeTab === 'Customers' ? activeCustomersCount : activeVendorsCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterTag('all')}
            style={[styles.filterPill, filterTag === 'all' && styles.filterPillSelected]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, filterTag === 'all' && styles.filterPillTextSelected]}>
              All ({activeTab === 'Customers' ? customers.length : vendors.length})
            </Text>
          </TouchableOpacity>

          {activeTab === 'Customers' && (
            <TouchableOpacity
              onPress={() => setFilterTag('vip')}
              style={[styles.filterPill, filterTag === 'vip' && styles.filterPillSelected, { flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.75}
            >
              <Ionicons name="star" size={11} color={filterTag === 'vip' ? '#FFFFFF' : '#F59E0B'} style={{ marginRight: 4 }} />
              <Text style={[styles.filterPillText, filterTag === 'vip' && styles.filterPillTextSelected]}>
                VIP ({vipCustomersCount})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setFilterTag('inactive')}
            style={[styles.filterPill, filterTag === 'inactive' && styles.filterPillSelected]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, filterTag === 'inactive' && styles.filterPillTextSelected]}>
              Inactive ({activeTab === 'Customers' ? inactiveCustomersCount : inactiveVendorsCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contact Cards List */}
        <View style={styles.list}>
          {isLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.loaderText}>Loading contacts...</Text>
            </View>
          ) : activeTab === 'Customers' ? (
            customers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No customers saved yet</Text>
                <Text style={styles.emptySub}>
                  Import customers from your phone contacts or add them manually with phone & location.
                </Text>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching customers</Text>
                <Text style={styles.emptySub}>
                  Try searching with a different name or phone number.
                </Text>
              </View>
            ) : (
              <>
                {visibleCustomers.map(c => {
                  const isFocused = focusCustomerName && c.name.toLowerCase() === focusCustomerName.toLowerCase();
                  const initial = c.name.charAt(0).toUpperCase();
                  const isVip = c.isVip || c.statusTag === 'MVP';
                  const isInactive = c.isActive === false;
                  const subtext = c.pendingBalance > 0
                    ? `${c.phone ? `+91 ${c.phone} • ` : ''}${formatRupee(c.pendingBalance)} pending`
                    : `${c.phone ? `+91 ${c.phone} • ` : ''}${c.totalBills} bills`;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.82}
                      onPress={() => handleOpenCustomerHistory(c)}
                      style={[
                        styles.card,
                        isFocused && styles.focusedCard,
                        isInactive && styles.inactiveCard,
                      ]}
                    >
                      <View style={[styles.avatar, isInactive && styles.inactiveAvatar]}>
                        <Text style={[styles.avatarText, isInactive && styles.inactiveText]}>{initial}</Text>
                        {isVip && (
                          <View style={styles.vipCrownBadge}>
                            <Ionicons name="star" size={9} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <View style={styles.info}>
                        <View style={styles.cardTitleRow}>
                          <Text style={[styles.name, isInactive && styles.inactiveText]} numberOfLines={1}>
                            {c.name}
                          </Text>
                          {isVip && (
                            <View style={styles.vipPillBadge}>
                              <Text style={styles.vipPillText}>VIP</Text>
                            </View>
                          )}
                          {isInactive && (
                            <View style={styles.inactivePillBadge}>
                              <Text style={styles.inactivePillText}>INACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.sub, isInactive && styles.inactiveSub]}>{subtext}</Text>
                        {c.location ? (
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={12} color={colors.textSecondary} style={{ marginRight: 3 }} />
                            <Text style={[styles.locationText, isInactive && styles.inactiveSub]}>{c.location}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Right Quick Actions: Call, WhatsApp, 3-dots menu */}
                      <View style={styles.cardActionsGroup}>
                        {c.phone ? (
                          <>
                            <TouchableOpacity
                              onPress={() => handleCallContact(c.phone)}
                              style={styles.cardActionIconBtn}
                              activeOpacity={0.7}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="Call Customer"
                            >
                              <Ionicons name="call" size={14} color="#16A34A" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleWhatsAppContact(c.name, c.phone)}
                              style={[styles.cardActionIconBtn, styles.cardWaBtn]}
                              activeOpacity={0.7}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="WhatsApp Customer"
                            >
                              <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                            </TouchableOpacity>
                          </>
                        ) : null}

                        <TouchableOpacity
                          onPress={() => setSelectedActionItem({ type: 'customer', item: c })}
                          style={styles.cardActionMenuBtn}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Customer Options"
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {filteredCustomers.length > customerLimit && (
                  <View style={styles.loadMoreWrap}>
                    <Text style={styles.loadMoreText}>
                      Showing {customerLimit} of {filteredCustomers.length} customers
                    </Text>
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={() => setCustomerLimit(filteredCustomers.length)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.loadMoreBtnText}>Load more</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )
          ) : (
            vendors.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No vendors saved yet</Text>
                <Text style={styles.emptySub}>
                  Save daily milk, bakery, tea leaves, or cylinder suppliers with phone & location.
                </Text>
              </View>
            ) : filteredVendors.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching vendors</Text>
                <Text style={styles.emptySub}>
                  Try searching with a different name or phone number.
                </Text>
              </View>
            ) : (
              <>
                {visibleVendors.map(v => {
                  const initial = v.name.charAt(0).toUpperCase();
                  const isInactive = v.isActive === false;
                  const subtext = `${v.supplyType}${v.phone ? ` • +91 ${v.phone}` : ''}`;

                  return (
                    <View
                      key={v.id}
                      style={[
                        styles.card,
                        isInactive && styles.inactiveCard,
                      ]}
                    >
                      <View style={[styles.avatar, styles.vendorAvatar, isInactive && styles.inactiveAvatar]}>
                        <Text style={[styles.avatarText, styles.vendorAvatarText, isInactive && styles.inactiveText]}>{initial}</Text>
                      </View>
                      <View style={styles.info}>
                        <View style={styles.cardTitleRow}>
                          <Text style={[styles.name, isInactive && styles.inactiveText]} numberOfLines={1}>
                            {v.name}
                          </Text>
                          <AppTag label={v.supplyType} variant="neutral" />
                          {isInactive && (
                            <View style={styles.inactivePillBadge}>
                              <Text style={styles.inactivePillText}>INACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.sub, isInactive && styles.inactiveSub]}>{subtext}</Text>
                        {v.location ? (
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={12} color={colors.textSecondary} style={{ marginRight: 3 }} />
                            <Text style={[styles.locationText, isInactive && styles.inactiveSub]}>{v.location}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Right Quick Actions: Call, WhatsApp, 3-dots menu */}
                      <View style={styles.cardActionsGroup}>
                        {v.phone ? (
                          <>
                            <TouchableOpacity
                              onPress={() => handleCallContact(v.phone)}
                              style={styles.cardActionIconBtn}
                              activeOpacity={0.7}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="Call Vendor"
                            >
                              <Ionicons name="call" size={14} color="#16A34A" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleWhatsAppContact(v.name, v.phone)}
                              style={[styles.cardActionIconBtn, styles.cardWaBtn]}
                              activeOpacity={0.7}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="WhatsApp Vendor"
                            >
                              <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                            </TouchableOpacity>
                          </>
                        ) : null}

                        <TouchableOpacity
                          onPress={() => setSelectedActionItem({ type: 'vendor', item: v })}
                          style={styles.cardActionMenuBtn}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Vendor Options"
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {filteredVendors.length > vendorLimit && (
                  <View style={styles.loadMoreWrap}>
                    <Text style={styles.loadMoreText}>
                      Showing {vendorLimit} of {filteredVendors.length} vendors
                    </Text>
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={() => setVendorLimit(filteredVendors.length)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.loadMoreBtnText}>Load more</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )
          )}
        </View>

        {/* Add Contact Button */}
        <AppButton
          title={activeTab === 'Customers' ? 'Add customer' : 'Add vendor'}
          variant="primary"
          icon={<Ionicons name="person-add" size={17} color="#FFFFFF" />}
          onPress={handleOpenAddModal}
          style={styles.addBtn}
        />
      </ScrollView>

      {/* ========================================================================= */}
      {/* ADD CONTACT MODAL (Choice -> Import from Contacts OR Add Manually) */}
      {/* ========================================================================= */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {addStep === 'choice' && (activeTab === 'Customers' ? 'Add New Customer' : 'Add New Vendor')}
                  {addStep === 'import' && 'Import From Phone Contacts'}
                  {addStep === 'manual' && (activeTab === 'Customers' ? 'Add Customer Details' : 'Add Vendor Details')}
                </Text>
                <Text style={styles.modalSub}>
                  {addStep === 'choice' && 'Choose how you want to add this contact'}
                  {addStep === 'import' && 'Tap any contact to add to your list'}
                  {addStep === 'manual' && 'All entries are safely saved and tracked'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* STEP 1: CHOICE VIEW */}
            {addStep === 'choice' && (
              <View style={styles.choiceContainer}>
                {/* Option 1: Import From Contacts */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.choiceCard}
                  onPress={handleSelectImportFromContacts}
                >
                  <View style={styles.choiceIconWrap}>
                    <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
                  </View>
                  <View style={styles.choiceTextWrap}>
                    <Text style={styles.choiceTitle}>Import from contacts</Text>
                    <Text style={styles.choiceDesc}>
                      Pick directly from your mobile address book with one tap
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Option 2: Add Manually Form */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.choiceCard}
                  onPress={() => setAddStep('manual')}
                >
                  <View style={[styles.choiceIconWrap, styles.choiceIconManual]}>
                    <Ionicons name="create-outline" size={22} color={colors.accent} />
                  </View>
                  <View style={styles.choiceTextWrap}>
                    <Text style={styles.choiceTitle}>Add details manually</Text>
                    <Text style={styles.choiceDesc}>
                      Fill in name, phone number, and location address
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: IMPORT FROM DEVICE CONTACTS VIEW */}
            {addStep === 'import' && (
              <View style={styles.importContainer}>
                {/* For Vendors: Ask for Supply Item */}
                {activeTab === 'Vendors' && (
                  <View style={styles.importSupplySection}>
                    <Text style={styles.importSupplyLabel}>
                      Supply Item for Selected Vendors *
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.importSupplyChipsRow}
                    >
                      {supplyTypes.map(st => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setImportSupplyType(st)}
                          style={[
                            styles.chip,
                            importSupplyType === st && styles.chipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              importSupplyType === st && styles.chipTextSelected,
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TextInput
                      style={styles.importCustomSupplyInput}
                      placeholder="Or enter custom supply item..."
                      placeholderTextColor={colors.textSecondary}
                      value={importSupplyType}
                      onChangeText={setImportSupplyType}
                    />
                  </View>
                )}

                {/* Search & Select All Toolbar */}
                <View style={styles.importToolbarRow}>
                  <View style={[styles.searchBarWrap, { flex: 1 }]}>
                    <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search name or phone..."
                      placeholderTextColor={colors.textSecondary}
                      value={contactSearchQuery}
                      onChangeText={setContactSearchQuery}
                    />
                    {contactSearchQuery ? (
                      <TouchableOpacity onPress={() => setContactSearchQuery('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {filteredDeviceContacts.length > 0 && (
                    <TouchableOpacity
                      style={styles.selectAllBtn}
                      onPress={() => handleToggleSelectAll(filteredDeviceContacts.map(c => c.id))}
                    >
                      <Text style={styles.selectAllText}>
                        {filteredDeviceContacts.length > 0 &&
                        filteredDeviceContacts.every(c => selectedContactIds.includes(c.id))
                          ? 'Deselect All'
                          : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isLoadingContacts ? (
                  <View style={styles.contactsLoading}>
                    <ActivityIndicator color={colors.accent} size="small" />
                    <Text style={styles.loadingText}>Reading phone contacts...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.contactListScroll}>
                    {visibleDeviceContacts.length > 0 ? (
                      <>
                        {visibleDeviceContacts.map(c => {
                          const isSelected = selectedContactIds.includes(c.id);
                          return (
                            <TouchableOpacity
                              key={c.id}
                              activeOpacity={0.7}
                              style={[
                                styles.deviceContactRow,
                                isSelected && styles.deviceContactRowSelected,
                              ]}
                              onPress={() => handleToggleContactSelection(c.id)}
                              disabled={isSaving}
                            >
                              {/* Checkbox */}
                              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                              </View>

                              <View style={styles.deviceContactAvatar}>
                                <Text style={styles.deviceContactInitial}>
                                  {c.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>

                              <View style={styles.deviceContactInfo}>
                                <Text style={styles.deviceContactName}>{c.name}</Text>
                                {c.phone ? (
                                  <Text style={styles.deviceContactPhone}>+91 {c.phone}</Text>
                                ) : (
                                  <Text style={styles.deviceContactNoPhone}>No number</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}

                        {filteredDeviceContacts.length > deviceContactLimit && (
                          <View style={styles.loadMoreWrap}>
                            <Text style={styles.loadMoreText}>
                              Showing {deviceContactLimit} of {filteredDeviceContacts.length} contacts
                            </Text>
                            <TouchableOpacity
                              style={styles.loadMoreBtn}
                              onPress={() => setDeviceContactLimit(filteredDeviceContacts.length)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.loadMoreBtnText}>Load more</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.noContactsFound}>
                        <Text style={styles.noContactsText}>
                          {contactSearchQuery
                            ? 'No matching contacts found.'
                            : 'No contacts found on this phone. Please check that Contacts permission is allowed in device settings.'}
                        </Text>
                        {!contactSearchQuery && (
                          <TouchableOpacity
                            style={styles.retryContactsBtn}
                            onPress={handleSelectImportFromContacts}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="refresh-outline" size={14} color={colors.bg} />
                              <Text style={styles.retryContactsText}>Retry Loading Contacts</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* Import Action Bar */}
                <View style={styles.importActionBar}>
                  <TouchableOpacity
                    style={styles.backToChoiceBtn}
                    onPress={() => setAddStep('choice')}
                    disabled={isSaving}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="arrow-back" size={15} color={colors.accent} />
                      <Text style={styles.backToChoiceText}>Back</Text>
                    </View>
                  </TouchableOpacity>

                  <AppButton
                    title={
                      isSaving
                        ? 'Importing...'
                        : selectedContactIds.length === 0
                        ? 'Select contacts'
                        : selectedContactIds.length === 1
                        ? `Import 1 ${activeTab === 'Customers' ? 'Customer' : 'Vendor'}`
                        : `Import ${selectedContactIds.length} ${activeTab === 'Customers' ? 'Customers' : 'Vendors'}`
                    }
                    variant="primary"
                    onPress={handleImportSelectedContacts}
                    loading={isSaving}
                    disabled={selectedContactIds.length === 0 || isSaving}
                    style={styles.importSubmitBtn}
                  />
                </View>
              </View>
            )}

            {/* STEP 3: MANUAL FORM VIEW */}
            {addStep === 'manual' && (
              <ScrollView style={styles.manualFormScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.manualForm}>
                  {/* Name Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>
                      {activeTab === 'Customers' ? 'Customer Name *' : 'Vendor / Supplier Name *'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Ramesh Kumar or Arokya Milk"
                      placeholderTextColor={colors.textSecondary}
                      value={formName}
                      onChangeText={setFormName}
                    />
                  </View>

                  {/* Phone Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Phone Number (10 digits)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 98404 12345"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={formPhone}
                      onChangeText={t => setFormPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                      maxLength={10}
                    />
                  </View>

                  {/* Location Input (Vendors only - customers do not have place/location field) */}
                  {activeTab === 'Vendors' && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Location / Shop Area</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Main Road, T. Nagar or Market Gate"
                        placeholderTextColor={colors.textSecondary}
                        value={formLocation}
                        onChangeText={setFormLocation}
                      />
                    </View>
                  )}

                  {/* Supply Type (For Vendors only) */}
                  {activeTab === 'Vendors' && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Supply Item / Category</Text>
                      <View style={styles.chipsRow}>
                        {supplyTypes.map(st => (
                          <TouchableOpacity
                            key={st}
                            onPress={() => setFormSupplyType(st)}
                            style={[
                              styles.chip,
                              formSupplyType === st && styles.chipSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                formSupplyType === st && styles.chipTextSelected,
                              ]}
                            >
                              {st}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        placeholder="Or custom supply type..."
                        placeholderTextColor={colors.textSecondary}
                        value={formSupplyType}
                        onChangeText={setFormSupplyType}
                      />
                    </View>
                  )}

                  {/* Buttons */}
                  <View style={styles.manualActionRow}>
                    <TouchableOpacity
                      style={styles.manualCancelBtn}
                      onPress={() => setAddStep('choice')}
                      disabled={isSaving}
                    >
                      <Text style={styles.manualCancelText}>Back</Text>
                    </TouchableOpacity>

                    <AppButton
                      title={isSaving ? 'Saving...' : 'Save'}
                      variant="primary"
                      onPress={handleSaveManualContact}
                      loading={isSaving}
                      style={styles.manualSubmitBtn}
                    />
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* 1. CONTACT ACTION SHEET MODAL (3-Dot Menu) */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedActionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedActionItem(null)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedActionItem(null)}
        >
          <View style={styles.actionSheetCard}>
            <View style={styles.actionSheetHeader}>
              <View style={styles.actionSheetAvatar}>
                <Text style={styles.actionSheetAvatarText}>
                  {selectedActionItem?.item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionSheetTitle} numberOfLines={1}>
                  {selectedActionItem?.item.name}
                </Text>
                <Text style={styles.actionSheetSub}>
                  {selectedActionItem?.item.phone ? `+91 ${selectedActionItem.item.phone}` : 'No phone saved'}
                  {selectedActionItem?.item.isActive === false ? ' • Inactive' : ' • Active'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedActionItem(null)}
                style={styles.actionSheetCloseBtn}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionSheetBody}>
              <TouchableOpacity
                style={styles.actionRowBtn}
                onPress={() => {
                  if (selectedActionItem) {
                    handleOpenEditContact(selectedActionItem.type, selectedActionItem.item);
                  }
                }}
              >
                <View style={[styles.actionRowIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="pencil" size={16} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionRowLabel}>Edit Details</Text>
                  <Text style={styles.actionRowDesc}>Update name, phone number, location or VIP status</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRowBtn}
                onPress={() => {
                  if (selectedActionItem) {
                    handleToggleInactive(selectedActionItem.type, selectedActionItem.item);
                  }
                }}
              >
                <View style={[styles.actionRowIcon, { backgroundColor: selectedActionItem?.item.isActive === false ? '#ECFDF5' : '#FFFBEB' }]}>
                  <Ionicons
                    name={selectedActionItem?.item.isActive === false ? "checkmark-circle" : "pause-circle"}
                    size={16}
                    color={selectedActionItem?.item.isActive === false ? "#059669" : "#D97706"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionRowLabel}>
                    {selectedActionItem?.item.isActive === false ? "Mark as Active" : "Mark as Inactive"}
                  </Text>
                  <Text style={styles.actionRowDesc}>
                    {selectedActionItem?.item.isActive === false ? "Reactivate and restore to active list" : "Hide from active list but preserve all past bill records"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionRowBtn, { borderBottomWidth: 0 }]}
                onPress={() => {
                  if (selectedActionItem) {
                    handleDeleteContact(selectedActionItem.type, selectedActionItem.item);
                  }
                }}
              >
                <View style={[styles.actionRowIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="archive-outline" size={16} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionRowLabel, { color: '#DC2626' }]}>Archive Contact (Inactive)</Text>
                  <Text style={styles.actionRowDesc}>Set inactive and store safely in database</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. EDIT CONTACT MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={!!editingContact}
        transparent
        animationType="slide"
        onRequestClose={() => !isSaving && setEditingContact(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Edit {editingContact?.type === 'customer' ? 'Customer' : 'Vendor'}
                </Text>
                <Text style={styles.modalSub}>All changes will be updated in the cloud database</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingContact(null)}
                style={styles.modalCloseBtn}
                disabled={isSaving}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingVertical: 14 }} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contact Name"
                  placeholderTextColor={colors.textSecondary}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Mobile Number (10 digits)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 98404 12345"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={editPhone}
                  onChangeText={t => setEditPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Location / Notes</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Table area or local address"
                  placeholderTextColor={colors.textSecondary}
                  value={editLocation}
                  onChangeText={setEditLocation}
                />
              </View>

              {editingContact?.type === 'customer' && (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setEditIsVip(prev => !prev)}
                >
                  <Ionicons
                    name={editIsVip ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={editIsVip ? colors.accent : colors.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>⭐ Mark as VIP Customer</Text>
                </TouchableOpacity>
              )}

              {editingContact?.type === 'vendor' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Supply Item / Category</Text>
                  <View style={styles.chipsRow}>
                    {supplyTypes.map(st => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setEditSupplyType(st)}
                        style={[
                          styles.chip,
                          editSupplyType === st && styles.chipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            editSupplyType === st && styles.chipTextSelected,
                          ]}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setEditIsActive(prev => !prev)}
              >
                <Ionicons
                  name={editIsActive ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={editIsActive ? '#059669' : colors.textSecondary}
                />
                <Text style={styles.checkboxLabel}>Active Contact (visible in billing & directory)</Text>
              </TouchableOpacity>

              <View style={styles.manualActionsRow}>
                <TouchableOpacity
                  style={styles.manualCancelBtn}
                  onPress={() => setEditingContact(null)}
                  disabled={isSaving}
                >
                  <Text style={styles.manualCancelText}>Cancel</Text>
                </TouchableOpacity>
                <AppButton
                  title={isSaving ? 'Saving...' : 'Save Changes'}
                  variant="primary"
                  onPress={handleSaveEditContact}
                  loading={isSaving}
                  style={styles.manualSubmitBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. CUSTOMER HISTORY & FAVORITE ITEMS MODAL ("What are the bills they like?") */}
      {/* ========================================================================= */}
      <Modal
        visible={!!historyCustomer}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryCustomer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={styles.historyAvatar}>
                  <Text style={styles.historyAvatarText}>
                    {historyCustomer?.name.charAt(0).toUpperCase()}
                  </Text>
                  {(historyCustomer?.isVip || historyCustomer?.statusTag === 'MVP') && (
                    <View style={styles.vipCrownBadge}>
                      <Ionicons name="star" size={9} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{historyCustomer?.name}</Text>
                    {(historyCustomer?.isVip || historyCustomer?.statusTag === 'MVP') && (
                      <View style={styles.vipPillBadge}>
                        <Text style={styles.vipPillText}>VIP</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modalSub}>
                    {historyCustomer?.phone ? `+91 ${historyCustomer.phone}` : 'No phone saved'}
                    {historyCustomer?.location ? ` • ${historyCustomer.location}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setHistoryCustomer(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions (Call & WhatsApp) */}
            {historyCustomer?.phone ? (
              <View style={styles.historyActionsRow}>
                <TouchableOpacity
                  style={styles.historyCallBtn}
                  onPress={() => handleCallContact(historyCustomer.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={15} color="#FFFFFF" />
                  <Text style={styles.historyCallBtnText}>Call Customer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.historyWaBtn}
                  onPress={() => handleWhatsAppContact(historyCustomer.name, historyCustomer.phone)}
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
                    {formatRupee(customerHistoryData?.totalSpent || 0)}
                  </Text>
                </View>
                <View style={styles.historyKpiCard}>
                  <Text style={styles.historyKpiLabel}>TOTAL VISITS</Text>
                  <Text style={styles.historyKpiVal}>
                    {customerHistoryData?.totalBills || historyCustomer?.totalBills || 0}
                  </Text>
                </View>
                <View style={styles.historyKpiCard}>
                  <Text style={styles.historyKpiLabel}>PENDING DUE</Text>
                  <Text style={[styles.historyKpiVal, { color: Number(historyCustomer?.pendingBalance || 0) > 0 ? '#DC2626' : colors.text }]}>
                    {formatRupee(historyCustomer?.pendingBalance || 0)}
                  </Text>
                </View>
              </View>

              {/* FAVORITE ITEMS SECTION: "What are the bills they like?" */}
              <View style={styles.historySection}>
                <View style={styles.historySectionHeader}>
                  <Ionicons name="heart" size={16} color="#DC2626" />
                  <Text style={styles.historySectionTitle}>Favorite Dishes / Frequently Ordered</Text>
                </View>

                {isLoadingHistory ? (
                  <View style={{ padding: 14, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : (customerHistoryData?.favoriteItems && customerHistoryData.favoriteItems.length > 0) ? (
                  <View style={styles.favoriteItemsList}>
                    {customerHistoryData.favoriteItems.map((fav, fIdx) => (
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
                      No item preferences recorded yet for this customer. Items will appear automatically after billing.
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

                {isLoadingHistory ? (
                  <View style={{ padding: 14, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : (customerHistoryData?.bills && customerHistoryData.bills.length > 0) ? (
                  <View style={styles.billsListWrap}>
                    {customerHistoryData.bills.map(b => (
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
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitleWrap: {
      flex: 1,
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
    title: {
      fontFamily: typography.fonts.heading,
      fontSize: 18,
      color: colors.text,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
      marginTop: 2,
    },
    list: {
      gap: 10,
    },
    loaderWrap: {
      padding: 24,
      alignItems: 'center',
      gap: 8,
    },
    loaderText: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      ...shadows.card,
    },
  focusedCard: {
    borderColor: colors.accent,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  avatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: '#FD5E03',
    fontWeight: '800',
  },
  vendorAvatar: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  vendorAvatarText: {
    color: '#B45309',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.fonts.heading,
    fontSize: 15.5,
    color: colors.text,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationIcon: {
    fontSize: 11,
  },
  locationText: {
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontFamily: typography.fonts.body,
  },
  addBtn: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EFECE6',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 6,
    ...shadows.card,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h5,
    color: colors.text,
  },
  emptySub: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 18,
    maxHeight: '85%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
  },
  modalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h5,
    color: colors.text,
  },
  modalSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.fonts.heading,
  },

  // Step 1: Choice styles
  choiceContainer: {
    paddingVertical: 16,
    gap: 12,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral100,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    gap: 12,
  },
  choiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconManual: {
    backgroundColor: '#F0EFFF',
  },
  choiceIcon: {
    fontSize: 22,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  choiceDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  choiceArrow: {
    fontSize: 20,
    color: colors.textMuted,
  },

  // Step 2: Import styles
  importContainer: {
    paddingVertical: 12,
    gap: 10,
    maxHeight: 460,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  clearSearchText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  contactsLoading: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  contactListScroll: {
    maxHeight: 320,
  },
  deviceContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  deviceContactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContactInitial: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.accent900,
  },
  deviceContactInfo: {
    flex: 1,
  },
  deviceContactName: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  deviceContactPhone: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  deviceContactNoPhone: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  importSupplySection: {
    backgroundColor: colors.accent100,
    borderRadius: radii.md,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D0E3F0',
  },
  importSupplyLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.accent900,
  },
  importSupplyChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  importCustomSupplyInput: {
    height: 36,
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  importToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.neutral100,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  selectAllText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.accent900,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent900,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent900,
    borderColor: colors.accent900,
  },
  checkboxCheckmark: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  deviceContactRowSelected: {
    backgroundColor: colors.accent100,
  },
  importActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.dividerLight,
  },
  importSubmitBtn: {
    flex: 2,
    minHeight: 46,
    backgroundColor: colors.accent900,
  },
  noContactsFound: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  noContactsText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryContactsBtn: {
    backgroundColor: colors.accent900,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginTop: 6,
  },
  retryContactsText: {
    color: colors.bg,
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
  },
  backToChoiceBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  backToChoiceText: {
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontFamily: typography.fonts.heading,
  },

  // Step 3: Manual Form styles
  manualFormScroll: {
    maxHeight: 460,
  },
  manualForm: {
    paddingVertical: 14,
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  input: {
    minHeight: 44,
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipSelected: {
    backgroundColor: colors.accent900,
    borderColor: colors.accent900,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.bg,
    fontFamily: typography.fonts.heading,
  },
  manualActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  manualCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualCancelText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },
  manualSubmitBtn: {
    flex: 2,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.accent700,
  },
  directorySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...shadows.card,
  },
  directorySearchIcon: {
    fontSize: 14,
  },
  directorySearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
    fontFamily: typography.fonts.body,
    paddingVertical: 0,
  },
  loadMoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  loadMoreText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  loadMoreBtn: {
    backgroundColor: '#FFF0E6',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontWeight: '700',
  },

  // Filter pills
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  filterPillSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterPillText: {
    fontSize: 12.5,
    fontFamily: typography.fonts.heading,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Card details & VIP
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  vipCrownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipCrownText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  vipPillBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  vipPillText: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: '#B45309',
    fontWeight: '700',
  },
  inactivePillBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inactivePillText: {
    fontSize: 10,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
  },
  inactiveCard: {
    opacity: 0.65,
    backgroundColor: '#F9FAFB',
  },
  inactiveAvatar: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
  },
  inactiveText: {
    color: colors.textSecondary,
  },
  inactiveSub: {
    color: colors.textMuted,
  },

  // Card Quick Actions
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  cardActionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWaBtn: {
    backgroundColor: '#25D366',
    borderColor: 'transparent',
  },
  cardActionMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EFECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Sheet (3-dot menu modal)
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 18,
    paddingBottom: 28,
    gap: 14,
    ...shadows.lg,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
  },
  actionSheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetAvatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.accent900,
  },
  actionSheetTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  actionSheetSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionSheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetBody: {
    gap: 6,
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 12,
  },
  actionRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  actionRowDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Edit modal helpers
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  checkboxLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  manualActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },

  // Customer History & Favorite items Modal
  historyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  historyAvatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.lg,
    color: colors.accent900,
  },
  historyActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  historyCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  historyCallBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
  },
  historyWaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  historyWaBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
  },
  historyKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  historyKpiCard: {
    flex: 1,
    backgroundColor: colors.neutral100,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    alignItems: 'center',
  },
  historyKpiLabel: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  historyKpiVal: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.heading,
    color: colors.text,
  },
  historySection: {
    marginBottom: 18,
    gap: 8,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historySectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  favoriteItemsList: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    overflow: 'hidden',
  },
  favItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  favRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favRankText: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: '#DC2626',
  },
  favItemName: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  favItemQty: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  favItemAmt: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  emptyHistoryBox: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    padding: 16,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  billsListWrap: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    overflow: 'hidden',
  },
  billHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  billHistoryNo: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  billHistoryModeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  billHistoryModeText: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  billHistoryDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  billHistoryAmt: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  });
};
