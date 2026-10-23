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
  Keyboard,
  Linking,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { contactService, DeviceContactItem, ContactPermissionStatus } from '../../services/contactService';
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
  const insets = useSafeAreaInsets();
  const modalNavClearance = Math.max(insets.bottom, 16);
  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);
  const { shop } = useShop();
  const { flash } = useCart();
  const { t } = useLanguage();

  // Keyboard avoidance and height tracking for resilient upscroll in modals
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setIsKeyboardVisible(true);
      const h = e?.endCoordinates?.height || 280;
      setKeyboardHeight(h);
    };
    const onHide = () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
  const [matchedExistingCustomer, setMatchedExistingCustomer] = useState<CustomerRecord | null>(null);
  const [matchedExistingVendor, setMatchedExistingVendor] = useState<VendorRecord | null>(null);
  const [duplicateModalInfo, setDuplicateModalInfo] = useState<{
    existingName: string;
    newName: string;
    cleanPhone: string;
    existingType: 'customer' | 'vendor';
    existingCustomer: CustomerRecord | null;
    existingVendor: VendorRecord | null;
  } | null>(null);
  const [wantsToUpdateName, setWantsToUpdateName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Device Contacts State & Multi-select & Permissions
  const [deviceContacts, setDeviceContacts] = useState<DeviceContactItem[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<ContactPermissionStatus>('undetermined');
  const [canAskAgain, setCanAskAgain] = useState(true);
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
        const custItem = editingContact.item as CustomerRecord;
        await contactService.updateCustomer(shop.id, custItem.id, {
          name: editName.trim(),
          phone: editPhone ? editPhone.replace(/[^0-9]/g, '').slice(-10) : null,
          location: editLocation.trim() || null,
          isVip: editIsVip,
          statusTag: editIsVip ? 'MVP' : (custItem.pendingBalance > 0 ? 'Pending' : 'Regular'),
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
    // Optimistic UI update
    if (type === 'customer') {
      setCustomers(prev => prev.map(c => c.id === item.id ? { ...c, isActive: newActive } : c));
    } else {
      setVendors(prev => prev.map(v => v.id === item.id ? { ...v, isActive: newActive } : v));
    }

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
    // Optimistic UI update
    if (type === 'customer') {
      setCustomers(prev => prev.map(c => c.id === item.id ? { ...c, isActive: false } : c));
    } else {
      setVendors(prev => prev.map(v => v.id === item.id ? { ...v, isActive: false } : v));
    }

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

  const handleToggleVip = async (customer: CustomerRecord) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const currentVip = !!customer.isVip || customer.statusTag === 'MVP';
    const nextVip = !currentVip;
    const nextStatusTag = nextVip ? 'MVP' : (customer.pendingBalance > 0 ? 'Pending' : 'Regular');

    // Optimistic UI update
    setCustomers(prev =>
      prev.map(c =>
        c.id === customer.id
          ? { ...c, isVip: nextVip, statusTag: nextStatusTag }
          : c
      )
    );

    try {
      await contactService.updateCustomer(shop.id, customer.id, {
        isVip: nextVip,
        statusTag: nextStatusTag,
      });
      flash(nextVip ? `⭐ ${customer.name} marked as VIP` : `${customer.name} VIP removed`);
    } catch (err) {
      console.warn('Failed to update VIP status:', err);
      flash('Could not update VIP status');
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
    setMatchedExistingCustomer(null);
    setMatchedExistingVendor(null);
    setIsModalOpen(true);
  };

  const handleSelectImportFromContacts = async () => {
    setAddStep('import');
    setSelectedContactIds([]);
    setDeviceContactLimit(20);
    setIsLoadingContacts(true);
    try {
      const res = await contactService.fetchDeviceContactsWithPermission();
      setPermissionStatus(res.status);
      setCanAskAgain(res.canAskAgain);
      setDeviceContacts(res.contacts || []);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleSelectContactForReview = (contact: DeviceContactItem) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const clean = contact.phone ? contact.phone.replace(/[^0-9]/g, '').slice(-10) : '';
    setFormName(contact.name || '');
    setFormPhone(clean);

    const existingCust = clean.length === 10
      ? (customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === clean) || null)
      : null;

    const existingVend = clean.length === 10
      ? (vendors.find(v => v.phone && v.phone.replace(/[^0-9]/g, '').slice(-10) === clean) || null)
      : null;

    setMatchedExistingCustomer(existingCust || null);
    setMatchedExistingVendor(existingVend || null);
    setDuplicateModalInfo(null);
    setFormLocation(existingCust?.location || existingVend?.location || '');
    if (existingVend?.supplyType) {
      setFormSupplyType(existingVend.supplyType);
    }

    // Name means it also changes the selector:
    // If the selected contact from the device has a new name for an existing number,
    // pre-set wantsToUpdateName to true so it immediately updates the existing contact to this selected name!
    const existingName = existingVend?.name || existingCust?.name || '';
    if (existingName && contact.name && contact.name.trim().toLowerCase() !== existingName.toLowerCase()) {
      setWantsToUpdateName(true);
    } else {
      setWantsToUpdateName(false);
    }

    setAddStep('manual');
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
        const result = await contactService.importCustomersWithResult(shop.id, selectedList);
        const parts = [`Imported ${result.added.length} customer${result.added.length === 1 ? '' : 's'}`];
        if (result.alreadyExistingCount > 0) parts.push(`${result.alreadyExistingCount} already exist in shop`);
        if (result.invalidCount > 0) parts.push(`${result.invalidCount} skipped`);
        flash(parts.join(' • '));
      } else {
        // Vendors: 1 number = 1 name = 1 contact only. If number exists, updates name to selected contact.
        const result = await contactService.addMultipleVendors(shop.id, selectedList, importSupplyType);
        flash(`Saved ${result.length} vendor${result.length === 1 ? '' : 's'} (${importSupplyType})`);
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
    if (!formPhone.trim() || cleanPhone.length === 0) {
      flash('Please enter the mobile number');
      return;
    }
    if (cleanPhone.length !== 10) {
      flash('Mobile number must be exactly 10 digits');
      return;
    }

    // Check across BOTH customers and vendors by 10-digit phone
    const matchedCustomer = cleanPhone.length === 10
      ? (customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) || null)
      : null;
    const matchedVendor = cleanPhone.length === 10
      ? (vendors.find(v => v.phone && v.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) || null)
      : null;

    const matchedContact = matchedCustomer || matchedVendor;

    if (matchedContact) {
      const existingName = matchedContact.name;
      const existingType = matchedCustomer ? 'customer' : 'vendor';

      // If user entered a different name and hasn't explicitly confirmed name update:
      if (trimmedName.toLowerCase() !== existingName.toLowerCase() && !wantsToUpdateName) {
        setDuplicateModalInfo({
          existingName,
          newName: trimmedName,
          cleanPhone,
          existingType,
          existingCustomer: matchedCustomer,
          existingVendor: matchedVendor,
        });
        return;
      }
    }

    const finalName = wantsToUpdateName ? trimmedName : (matchedContact ? matchedContact.name : trimmedName);
    await executeSaveOrUpdateContact(finalName, matchedCustomer, matchedVendor);
  };

  const executeSaveOrUpdateContact = async (
    finalName: string,
    matchedCustomer: CustomerRecord | null,
    matchedVendor: VendorRecord | null
  ) => {
    if (!shop?.id) return;
    const cleanPhone = formPhone.replace(/[^0-9]/g, '').slice(-10);

    setIsSaving(true);
    try {
      if (activeTab === 'Customers') {
        if (matchedCustomer) {
          await contactService.updateCustomer(shop.id, matchedCustomer.id, {
            name: finalName,
            phone: cleanPhone || null,
            location: formLocation.trim() || matchedCustomer.location || null,
            notes: matchedCustomer.notes || null,
          });
          flash(`Customer updated: ${finalName}`);
        } else if (matchedVendor) {
          // Existed as vendor: update vendor name and create/link customer without duplicate
          await contactService.updateVendor(shop.id, matchedVendor.id, {
            name: finalName,
            location: formLocation.trim() || matchedVendor.location || null,
          });
          await contactService.addCustomer(
            shop.id,
            finalName,
            cleanPhone || undefined,
            formLocation.trim() || matchedVendor.location || undefined
          );
          flash(`Updated ${finalName} in contacts`);
        } else {
          await contactService.addCustomer(
            shop.id,
            finalName,
            cleanPhone || undefined,
            formLocation.trim() || undefined
          );
          flash(`Customer ${finalName} saved`);
        }
      } else {
        // activeTab === 'Vendors'
        if (matchedVendor) {
          await contactService.updateVendor(shop.id, matchedVendor.id, {
            name: finalName,
            phone: cleanPhone || null,
            supplyType: formSupplyType.trim() || matchedVendor.supplyType || 'Supplies',
            location: formLocation.trim() || matchedVendor.location || null,
          });
          flash(`Vendor updated: ${finalName}`);
        } else if (matchedCustomer) {
          // Existed as customer: update customer name and add vendor without duplicate
          await contactService.updateCustomer(shop.id, matchedCustomer.id, {
            name: finalName,
            location: formLocation.trim() || matchedCustomer.location || null,
          });
          await contactService.addVendor(
            shop.id,
            finalName,
            formSupplyType.trim() || 'Supplies',
            cleanPhone || undefined,
            formLocation.trim() || matchedCustomer.location || undefined
          );
          flash(`Updated ${finalName} in contacts`);
        } else {
          await contactService.addVendor(
            shop.id,
            finalName,
            formSupplyType.trim() || 'Supplies',
            cleanPhone || undefined,
            formLocation.trim() || undefined
          );
          flash(`Vendor ${finalName} saved`);
        }
      }

      setIsModalOpen(false);
      setDuplicateModalInfo(null);
      setWantsToUpdateName(false);
      setMatchedExistingCustomer(null);
      setMatchedExistingVendor(null);
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

  // Customers filtered by directory search & filter tags and sorted by visit count descending
  const filteredCustomers = customers
    .filter(c => {
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
    })
    .sort((a, b) => {
      const visitDiff = (b.totalBills || 0) - (a.totalBills || 0);
      if (visitDiff !== 0) return visitDiff;
      const pendingDiff = (b.pendingBalance || 0) - (a.pendingBalance || 0);
      if (pendingDiff !== 0) return pendingDiff;
      return a.name.localeCompare(b.name);
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
            <Text style={styles.title}>{t('customers_vendors', 'Customers & Vendors')}</Text>
            <Text style={styles.subtitle}>Directory & Ledgers</Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenAddModal}
            style={styles.topAddBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={14} color="#FFFFFF" />
            <Text style={styles.topAddBtnText}>
              {activeTab === 'Customers' ? `+ ${t('add_customer', 'Add Customer')}` : `+ ${t('add_vendor', 'Add Vendor')}`}
            </Text>
          </TouchableOpacity>
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
          renderLabel={opt => opt === 'Customers' ? t('customers', 'Customers') : t('vendors', 'Vendors')}
        />

        {/* Search Bar for Directory */}
        <View style={styles.directorySearchBar}>
          <Ionicons name="search-outline" size={17} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.directorySearchInput}
            placeholder={t('search_contacts', 'Search contacts...')}
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
              {t('active', 'Active')} ({activeTab === 'Customers' ? activeCustomersCount : activeVendorsCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterTag('all')}
            style={[styles.filterPill, filterTag === 'all' && styles.filterPillSelected]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterPillText, filterTag === 'all' && styles.filterPillTextSelected]}>
              {t('all', 'All')} ({activeTab === 'Customers' ? customers.length : vendors.length})
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

                      {/* Right Quick Actions: VIP Star, Call, WhatsApp, 3-dots menu */}
                      <View style={styles.cardActionsGroup}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            handleToggleVip(c);
                          }}
                          style={[
                            styles.cardActionIconBtn,
                            isVip ? styles.vipStarBtnActive : styles.vipStarBtnInactive,
                          ]}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel={isVip ? "Remove VIP" : "Mark as VIP"}
                        >
                          <Ionicons
                            name={isVip ? "star" : "star-outline"}
                            size={14}
                            color={isVip ? "#F59E0B" : colors.textMuted}
                          />
                        </TouchableOpacity>

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
          style={[
            styles.modalOverlay,
            Platform.OS === 'android' && isKeyboardVisible && {
              paddingBottom: Math.min(keyboardHeight, 140),
            },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View
            style={[
              styles.modalContent,
              isKeyboardVisible && { maxHeight: '94%' },
              { paddingBottom: isKeyboardVisible ? 12 : modalNavClearance + 12 },
            ]}
          >
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

                {/* Contacts Permission Status Banners */}
                {permissionStatus === 'blocked' && (
                  <View style={styles.permissionBlockedCard}>
                    <View style={styles.permissionIconCircle}>
                      <Ionicons name="lock-closed-outline" size={24} color="#D97706" />
                    </View>
                    <Text style={styles.permissionTitle}>Contacts Permission Blocked</Text>
                    <Text style={styles.permissionDesc}>
                      CounterPro needs access to your contacts to import customers. Contacts access is currently disabled in your device settings.
                    </Text>
                    <TouchableOpacity
                      style={styles.openSettingsBtn}
                      onPress={() => Linking.openSettings()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.openSettingsBtnText}>Open Device Settings</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {permissionStatus === 'denied' && (
                  <View style={styles.permissionBlockedCard}>
                    <View style={styles.permissionIconCircle}>
                      <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
                    </View>
                    <Text style={styles.permissionTitle}>Contacts Access Required</Text>
                    <Text style={styles.permissionDesc}>
                      Allow CounterPro to read your contacts to easily import your regular customers and suppliers.
                    </Text>
                    <TouchableOpacity
                      style={styles.openSettingsBtn}
                      onPress={handleSelectImportFromContacts}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.openSettingsBtnText}>Allow Contacts Access</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isLoadingContacts ? (
                  <View style={styles.contactsLoading}>
                    <ActivityIndicator color={colors.accent} size="small" />
                    <Text style={styles.loadingText}>Reading phone contacts...</Text>
                  </View>
                ) : permissionStatus !== 'blocked' && permissionStatus !== 'denied' && (
                  <ScrollView
                    style={styles.contactListScroll}
                    contentContainerStyle={{
                      paddingBottom: isKeyboardVisible ? keyboardHeight + 40 : 40,
                      flexGrow: 1,
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    keyboardDismissMode="on-drag"
                  >
                    {visibleDeviceContacts.length > 0 ? (
                      <>
                        {visibleDeviceContacts.map(c => {
                          const isSelected = selectedContactIds.includes(c.id);
                          return (
                            <View
                              key={c.id}
                              style={[
                                styles.deviceContactRow,
                                isSelected && styles.deviceContactRowSelected,
                              ]}
                            >
                              {/* Checkbox for batch import */}
                              <TouchableOpacity
                                onPress={() => handleToggleContactSelection(c.id)}
                                style={styles.checkboxTouchable}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                  {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                </View>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.deviceContactAvatar}
                                onPress={() => handleSelectContactForReview(c)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.deviceContactInitial}>
                                  {c.name.charAt(0).toUpperCase()}
                                </Text>
                              </TouchableOpacity>

                              {/* Tapping contact body pre-fills form for review & editing */}
                              <TouchableOpacity
                                style={styles.deviceContactInfo}
                                onPress={() => handleSelectContactForReview(c)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.deviceContactName}>{c.name}</Text>
                                {c.phone ? (
                                  <Text style={styles.deviceContactPhone}>+91 {c.phone}</Text>
                                ) : (
                                  <Text style={styles.deviceContactNoPhone}>No number</Text>
                                )}
                                {c.email ? (
                                  <Text style={styles.deviceContactEmail} numberOfLines={1}>{c.email}</Text>
                                ) : null}
                              </TouchableOpacity>

                              {/* Review & Edit direct button */}
                              <TouchableOpacity
                                style={styles.deviceContactReviewBtn}
                                onPress={() => handleSelectContactForReview(c)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.deviceContactReviewText}>Use</Text>
                                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                              </TouchableOpacity>
                            </View>
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

            {/* STEP 3: MANUAL FORM VIEW (Review & Edit or Manual Entry) */}
            {addStep === 'manual' && (() => {
              const cleanPhone = formPhone.replace(/[^0-9]/g, '').slice(-10);
              const liveCustomer = cleanPhone.length === 10
                ? customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone)
                : null;
              const liveVendor = cleanPhone.length === 10
                ? vendors.find(v => v.phone && v.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone)
                : null;
              const liveMatch = liveCustomer || liveVendor;
              const existingName = liveMatch?.name || '';
              const existingType = liveCustomer ? 'Customer' : 'Vendor';
              const isDifferentName = Boolean(
                existingName &&
                formName.trim() &&
                formName.trim().toLowerCase() !== existingName.toLowerCase()
              );

              return (
                <ScrollView
                  style={[styles.manualFormScroll, isKeyboardVisible && { maxHeight: 520 }]}
                  contentContainerStyle={{
                    paddingBottom: isKeyboardVisible ? keyboardHeight + 80 : 120,
                    flexGrow: 1,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  keyboardDismissMode="on-drag"
                >
                  <View style={styles.manualForm}>
                    {/* Live Duplicate Warning & Update Name Options */}
                    {liveMatch && (
                      <View style={styles.duplicateNoticeBanner}>
                        <View style={styles.duplicateNoticeHeader}>
                          <Ionicons name="information-circle" size={18} color="#D97706" />
                          <Text style={styles.duplicateNoticeTitle}>
                            {isDifferentName ? 'Contact Already Exists' : `Existing ${existingType} Found`}
                          </Text>
                        </View>
                        <Text style={styles.duplicateNoticeBody}>
                          This mobile number (+91 {cleanPhone}) is already registered in the name of{' '}
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{existingName}</Text>
                          {liveVendor?.supplyType ? ` (${liveVendor.supplyType})` : ''}
                          {liveCustomer && (liveCustomer.totalBills > 0 || liveCustomer.pendingBalance > 0)
                            ? ` (${liveCustomer.totalBills} bills • ${formatRupee(liveCustomer.pendingBalance)} pending)`
                            : ''}.
                        </Text>

                        {isDifferentName ? (
                          <View style={styles.duplicateUpdateActions}>
                            <Text style={styles.duplicateNoticeFooter}>
                              You typed a new name "{formName.trim()}". Choose how to proceed:
                            </Text>
                            <View style={styles.duplicateBtnRow}>
                              <TouchableOpacity
                                style={[
                                  styles.duplicateUpdateChoiceBtn,
                                  wantsToUpdateName && styles.duplicateUpdateChoiceBtnActive,
                                ]}
                                onPress={() => setWantsToUpdateName(true)}
                              >
                                <Ionicons
                                  name={wantsToUpdateName ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                  size={16}
                                  color={wantsToUpdateName ? '#FFFFFF' : theme.colors.accent}
                                />
                                <Text
                                  style={[
                                    styles.duplicateUpdateChoiceText,
                                    wantsToUpdateName && styles.duplicateUpdateChoiceTextActive,
                                  ]}
                                >
                                  Update Name to "{formName.trim()}"
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.duplicateKeepChoiceBtn,
                                  !wantsToUpdateName && styles.duplicateKeepChoiceBtnActive,
                                ]}
                                onPress={() => {
                                  setFormName(existingName);
                                  setWantsToUpdateName(false);
                                }}
                              >
                                <Ionicons
                                  name="arrow-undo-outline"
                                  size={14}
                                  color={!wantsToUpdateName ? '#FFFFFF' : theme.colors.textMuted}
                                />
                                <Text
                                  style={[
                                    styles.duplicateKeepChoiceText,
                                    !wantsToUpdateName && styles.duplicateKeepChoiceTextActive,
                                  ]}
                                >
                                  Keep "{existingName}"
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.duplicateNoticeFooter}>
                            Saving will update this {existingType.toLowerCase()}'s details instead of creating a duplicate.
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Name Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>
                        {activeTab === 'Customers' ? 'Customer Name *' : 'Vendor / Supplier Name *'}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Ramesh Kumar or Arokya Milk"
                        placeholderTextColor={theme.colors.inputPlaceholder}
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
                        placeholderTextColor={theme.colors.inputPlaceholder}
                        keyboardType="numeric"
                        value={formPhone}
                        onChangeText={t => setFormPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                        maxLength={10}
                      />
                    </View>

                    {/* Location / Area Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>
                        {activeTab === 'Customers' ? 'Location / Area (Optional)' : 'Location / Shop Area'}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Main Road, T. Nagar or Market Gate"
                        placeholderTextColor={theme.colors.inputPlaceholder}
                        value={formLocation}
                        onChangeText={setFormLocation}
                      />
                    </View>

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
                          placeholderTextColor={theme.colors.inputPlaceholder}
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
                        title={
                          isSaving
                            ? 'Saving...'
                            : liveMatch
                            ? isDifferentName
                              ? wantsToUpdateName
                                ? `Update Name to "${formName.trim()}"`
                                : 'Update Existing Contact'
                              : `Update Existing ${existingType}`
                            : 'Save'
                        }
                        variant="primary"
                        onPress={handleSaveManualContact}
                        loading={isSaving}
                        style={styles.manualSubmitBtn}
                      />
                    </View>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* 0. DUPLICATE RESOLUTION MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={!!duplicateModalInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicateModalInfo(null)}
      >
        <View style={styles.duplicateModalOverlay}>
          <View style={styles.duplicateModalCard}>
            <View style={styles.duplicateModalIconWrap}>
              <Ionicons name="alert-circle" size={36} color="#D97706" />
            </View>

            <Text style={styles.duplicateModalTitle}>Contact Already Exists</Text>

            <Text style={styles.duplicateModalMessage}>
              This customer already exists in the name of{' '}
              <Text style={styles.duplicateModalBold}>{duplicateModalInfo?.existingName}</Text>
              {' '}(+91 {duplicateModalInfo?.cleanPhone}).
            </Text>

            <Text style={styles.duplicateModalSubtext}>
              You entered a new name: "{duplicateModalInfo?.newName}". If you want to update the contact's name, choose "Update Name" below.
            </Text>

            <View style={styles.duplicateModalActions}>
              <TouchableOpacity
                style={styles.duplicateModalUpdateBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  if (!duplicateModalInfo) return;
                  const targetName = duplicateModalInfo.newName;
                  const c = duplicateModalInfo.existingCustomer;
                  const v = duplicateModalInfo.existingVendor;
                  setDuplicateModalInfo(null);
                  setWantsToUpdateName(true);
                  await executeSaveOrUpdateContact(targetName, c, v);
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.duplicateModalUpdateText}>
                  Update Name to "{duplicateModalInfo?.newName}"
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.duplicateModalKeepBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  if (!duplicateModalInfo) return;
                  const origName = duplicateModalInfo.existingName;
                  const c = duplicateModalInfo.existingCustomer;
                  const v = duplicateModalInfo.existingVendor;
                  setDuplicateModalInfo(null);
                  setWantsToUpdateName(false);
                  setFormName(origName);
                  await executeSaveOrUpdateContact(origName, c, v);
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.text} style={{ marginRight: 6 }} />
                <Text style={styles.duplicateModalKeepText}>
                  Keep Existing Name ("{duplicateModalInfo?.existingName}")
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.duplicateModalCancelBtn}
                onPress={() => setDuplicateModalInfo(null)}
              >
                <Text style={styles.duplicateModalCancelText}>Cancel & Change Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                style={[styles.actionRowBtn, { borderBottomWidth: 0 }]}
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
          style={[
            styles.modalOverlay,
            Platform.OS === 'android' && isKeyboardVisible && {
              paddingBottom: Math.min(keyboardHeight, 140),
            },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View
            style={[
              styles.modalContent,
              isKeyboardVisible && { maxHeight: '94%' },
              { paddingBottom: isKeyboardVisible ? 12 : modalNavClearance + 12 },
            ]}
          >
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

            <ScrollView
              style={{ paddingVertical: 14 }}
              contentContainerStyle={{
                paddingBottom: isKeyboardVisible ? keyboardHeight + 80 : 30,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              keyboardDismissMode="on-drag"
            >
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

const createStyles = (theme: Theme, isDark: boolean, insets?: { top: number; bottom: number; left: number; right: number }) => {
  const colors = theme.colors;
  const bottomInset = insets?.bottom || 0;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: Math.max(bottomInset, 16) + 84,
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
    topAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.md,
      gap: 4,
      ...shadows.sm,
    },
    topAddBtnText: {
      fontSize: 12,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: '#FFFFFF',
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
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
      ...shadows.card,
    },
    focusedCard: {
      borderColor: colors.accent,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFF0E6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#FED7AA',
    },
    avatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: 16,
      color: colors.accent,
      fontWeight: '800',
    },
    vendorAvatar: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#FEF3C7',
      borderColor: isDark ? colors.border : '#FDE68A',
    },
    vendorAvatarText: {
      color: isDark ? colors.accent : '#B45309',
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
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surface,
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
      borderBottomColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    choiceIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? colors.surface : '#E8F1F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceIconManual: {
      backgroundColor: isDark ? colors.surface : '#F0EFFF',
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
    permissionBlockedCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFBEB',
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#FDE68A',
      padding: 18,
      alignItems: 'center',
      gap: 8,
      marginVertical: 12,
    },
    permissionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? colors.surface : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    permissionTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      fontWeight: '700',
      color: colors.text,
    },
    permissionDesc: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    openSettingsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radii.md,
      marginTop: 6,
    },
    openSettingsBtnText: {
      color: '#FFFFFF',
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      fontWeight: '700',
    },
    searchBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderBottomColor: colors.border,
      gap: 10,
    },
    checkboxTouchable: {
      padding: 4,
    },
    deviceContactAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E8F1F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deviceContactInitial: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.accent,
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
    deviceContactEmail: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: typography.fonts.body,
      marginTop: 1,
    },
    deviceContactNoPhone: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    deviceContactReviewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFF0E6',
    },
    deviceContactReviewText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.heading,
      color: colors.accent,
      fontWeight: '700',
    },
    importSupplySection: {
      backgroundColor: isDark ? colors.surfaceSecondary : colors.accent100,
      borderRadius: radii.md,
      padding: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    importSupplyLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      color: colors.text,
    },
    importSupplyChipsRow: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 2,
    },
    importCustomSupplyInput: {
      height: 36,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectAllText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.heading,
      color: colors.accent,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkboxCheckmark: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: 'bold',
      lineHeight: 14,
    },
    deviceContactRowSelected: {
      backgroundColor: isDark ? colors.surfaceSecondary : colors.accent100,
    },
    importActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    importSubmitBtn: {
      flex: 2,
      minHeight: 46,
      backgroundColor: colors.accent,
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
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radii.md,
      marginTop: 6,
    },
    retryContactsText: {
      color: '#FFFFFF',
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
    duplicateNoticeBanner: {
      backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(217, 119, 6, 0.4)' : '#FDE68A',
      padding: 12,
      gap: 4,
      marginBottom: 8,
    },
    duplicateNoticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    duplicateNoticeTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      fontWeight: '700',
      color: '#D97706',
    },
    duplicateNoticeBody: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.xs,
      color: colors.text,
      lineHeight: 17,
    },
    duplicateNoticeFooter: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    duplicateUpdateActions: {
      marginTop: 8,
      gap: 6,
    },
    duplicateBtnRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    duplicateUpdateChoiceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: radii.sm,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFEDD5',
      borderWidth: 1,
      borderColor: colors.accent,
      gap: 4,
    },
    duplicateUpdateChoiceBtnActive: {
      backgroundColor: colors.accent,
    },
    duplicateUpdateChoiceText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      color: colors.accent,
    },
    duplicateUpdateChoiceTextActive: {
      color: '#FFFFFF',
    },
    duplicateKeepChoiceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: radii.sm,
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    duplicateKeepChoiceBtnActive: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.textMuted,
    },
    duplicateKeepChoiceText: {
      fontFamily: typography.fonts.body,
      fontSize: 11,
      color: colors.text,
    },
    duplicateKeepChoiceTextActive: {
      fontFamily: typography.fonts.heading,
      color: colors.text,
    },
    duplicateModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    duplicateModalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 24,
      alignItems: 'center',
      gap: 12,
      ...shadows.card,
    },
    duplicateModalIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    duplicateModalTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.lg,
      color: colors.text,
      textAlign: 'center',
    },
    duplicateModalMessage: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.base,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 22,
    },
    duplicateModalBold: {
      fontWeight: '700',
      color: colors.accent,
      fontFamily: typography.fonts.heading,
    },
    duplicateModalSubtext: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 17,
    },
    duplicateModalActions: {
      width: '100%',
      gap: 10,
      marginTop: 8,
    },
    duplicateModalUpdateBtn: {
      width: '100%',
      minHeight: 46,
      borderRadius: radii.pill,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    duplicateModalUpdateText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: '#FFFFFF',
    },
    duplicateModalKeepBtn: {
      width: '100%',
      minHeight: 46,
      borderRadius: radii.pill,
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    duplicateModalKeepText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    duplicateModalCancelBtn: {
      width: '100%',
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    duplicateModalCancelText: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.body,
      color: colors.text,
    },
    chipTextSelected: {
      color: '#FFFFFF',
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
      borderColor: colors.border,
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
      backgroundColor: colors.accent,
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
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFF0E6',
      borderColor: isDark ? colors.border : '#FED7AA',
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillSelected: {
      backgroundColor: isDark ? colors.accent : '#111111',
      borderColor: isDark ? colors.accent : '#111111',
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
      backgroundColor: isDark ? colors.surfaceSecondary : '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#FDE68A',
    },
    vipPillText: {
      fontSize: 10,
      fontFamily: typography.fonts.heading,
      color: isDark ? colors.accent : '#B45309',
      fontWeight: '700',
    },
    inactivePillBadge: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inactivePillText: {
      fontSize: 10,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
    },
    inactiveCard: {
      opacity: 0.65,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
    },
    inactiveAvatar: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#E5E7EB',
      borderColor: colors.border,
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
      gap: 5,
      marginLeft: 4,
    },
    cardActionIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#BBF7D0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    vipStarBtnActive: {
      backgroundColor: isDark ? '#451A03' : '#FEF3C7',
      borderColor: isDark ? '#B45309' : '#FDE68A',
    },
    vipStarBtnInactive: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC',
      borderColor: colors.border,
    },
    cardWaBtn: {
      backgroundColor: '#25D366',
      borderColor: 'transparent',
    },
    cardActionMenuBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FAF7F2',
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surface,
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
      borderBottomColor: colors.border,
    },
    actionSheetAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? colors.surfaceSecondary : colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionSheetAvatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.base,
      color: colors.accent,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
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
      borderBottomColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.accent100,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    historyAvatarText: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.lg,
      color: colors.accent,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    favItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    favRankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surface : '#FEE2E2',
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? colors.surfaceSecondary : colors.neutral100,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    billHistoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    billHistoryNo: {
      fontFamily: typography.fonts.heading,
      fontSize: typography.sizes.xs,
      color: colors.text,
    },
    billHistoryModeBadge: {
      backgroundColor: isDark ? colors.surface : '#EFF6FF',
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
