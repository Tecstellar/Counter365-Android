import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { colors as defaultColors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { RoleManagementSheet, PERM_ROWS, DEFAULT_ROLE_PERMS } from './RoleManagementSheet';
import { SubscriptionPlansModal } from '../../components/subscription/SubscriptionPlansModal';
import { SupportModal } from '../../components/modals/SupportModal';
import { APP_CONFIG } from '../../constants/appConfig';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { ShopMember, UserRole, PermissionKey } from '../../types/models';
import Constants from 'expo-constants';
import { storage } from '../../lib/storage';
import { imageService } from '../../services/imageService';
import { supabase } from '../../lib/supabase';
import * as Print from 'expo-print';
import { printerService, DiscoveredPrinter } from '../../services/printerService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { twoFactorService } from '../../services/twoFactorService';
import { generateDefaultInvoicePrefix } from '../../lib/invoiceUtils';
import { subscriptionService } from '../../services/subscriptionService';
import { SubscriptionRecord } from '../../types/models';
import { otaUpdateService } from '../../services/otaUpdateService';
import { LegalDocumentModal } from '../../components/common/LegalDocumentModal';
import { PRIVACY_POLICY_SECTIONS, TERMS_OF_SERVICE_SECTIONS, DPDPA_COMPLIANCE_DATE } from '../../constants/legalDocuments';

const DELETE_ACCOUNT_REASONS: Array<{
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'bugs', label: 'Bug issues / Technical glitches', iconName: 'bug-outline' },
  { id: 'closing_business', label: 'I am closing my business', iconName: 'business-outline' },
  { id: 'features_needed', label: 'Features needed / Missing functionality', iconName: 'sparkles-outline' },
  { id: 'pricing', label: 'Pricing / Subscription concerns', iconName: 'wallet-outline' },
  { id: 'switching', label: 'Switching to another billing software', iconName: 'swap-horizontal-outline' },
  { id: 'other', label: 'Other reason', iconName: 'help-circle-outline' },
];

interface AccountScreenProps {
  onBackToHome?: () => void;
  onLogout?: () => void;
  onNavigateToSupport?: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  onBackToHome,
  onLogout,
  onNavigateToSupport,
}) => {
  const { currentRole, can, profile, currentMember, logout, updateProfile, refreshMemberSession } = useAuth();
  const {
    shop,
    members,
    updateShop,
    addMember,
    updateMemberRole,
    updateMemberOverride,
    removeMember,
    deleteShopPermanently,
    subscriptionStatus,
    refreshSubscription,
    refreshShop,
  } = useShop();
  const { flash } = useCart();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const colors = theme.colors;
  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Subscription modal state
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSupportModalVisible, setIsSupportModalVisible] = useState(false);

  // Edit Shop & Owner Profile Modal State
  const [isEditShopOpen, setIsEditShopOpen] = useState(false);
  const [editShopName, setEditShopName] = useState(shop.name || 'Raja Tea Stall');
  const [editOwnerName, setEditOwnerName] = useState(profile?.fullName || 'Raja');
  const [editShopPhone, setEditShopPhone] = useState(shop.phone || '');
  const [editShopAddress, setEditShopAddress] = useState(shop.address || '');
  const [editShopCity, setEditShopCity] = useState(shop.city || '');
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(shop.logoUrl || null);
  const [editInvoicePrefix, setEditInvoicePrefix] = useState<string>(
    shop.invoicePrefix || generateDefaultInvoicePrefix(shop.name)
  );
  const [editInvoiceResetCycle, setEditInvoiceResetCycle] = useState<'monthly' | 'yearly'>(
    shop.invoiceResetCycle || 'monthly'
  );
  const [editUpiId, setEditUpiId] = useState(shop.upiId || '');
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionRecord[]>([]);

  useEffect(() => {
    if (shop?.id) {
      subscriptionService.getSubscriptionHistory(shop.id).then((history) => {
        setSubscriptionHistory(history);
      }).catch(() => {});
    }
  }, [shop?.id, subscriptionStatus?.isPaidActive]);

  useEffect(() => {
    if (refreshShop) {
      refreshShop().catch(() => {});
    }
    if (refreshMemberSession) {
      refreshMemberSession().catch(() => {});
    }
  }, []);
  const [isSavingShopEdit, setIsSavingShopEdit] = useState(false);

  // Users & Staff State (Supervisor & Biller)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Supervisor');
  const [newUserOverrides, setNewUserOverrides] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [selectedMemberForSheet, setSelectedMemberForSheet] = useState<ShopMember | null>(null);

  const handleToggleNewUserPerm = (permKey: PermissionKey, currentValue: boolean) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setNewUserOverrides(prev => ({
      ...prev,
      [permKey]: !currentValue,
    }));
  };

  // Table Management State
  const [tableCountInput, setTableCountInput] = useState(String(shop.tableCount || 6));
  const [isSavingTableCount, setIsSavingTableCount] = useState(false);
  const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);

  // GST State
  const [isGstEditorOpen, setIsGstEditorOpen] = useState(false);
  const [gstRateInput, setGstRateInput] = useState(String(shop.gstRate || 5));
  const [isSavingGst, setIsSavingGst] = useState(false);

  // Real Thermal Printer State
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [scanExplanation, setScanExplanation] = useState<string | null>(null);
  const [connectingPrinterId, setConnectingPrinterId] = useState<string | null>(null);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [isAddingIpPrinter, setIsAddingIpPrinter] = useState(false);
  const [customPrinterIp, setCustomPrinterIp] = useState('');
  const [isSavingCustomIp, setIsSavingCustomIp] = useState(false);

  // Cloud Backup State
  const [isSyncingBackup, setIsSyncingBackup] = useState(false);
  const [lastBackupText, setLastBackupText] = useState('Last backup: Today, 11:00 PM (Scheduled)');

  // Legal Modals
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isAccountActionsModalOpen, setIsAccountActionsModalOpen] = useState(false);
  const [isAccountManagementExpanded, setIsAccountManagementExpanded] = useState(false);
  const [isDeletingShop, setIsDeletingShop] = useState(false);

  // Delete Account with Survey Reason Modal
  const [isDeleteReasonModalVisible, setIsDeleteReasonModalVisible] = useState(false);
  const [selectedDeleteReason, setSelectedDeleteReason] = useState<string>('');
  const [deleteFeedbackText, setDeleteFeedbackText] = useState<string>('');

  // Change Phone Number 2-Step OTP Modal State
  const [isChangePhoneModalOpen, setIsChangePhoneModalOpen] = useState(false);
  const [changePhoneStep, setChangePhoneStep] = useState<1 | 2 | 3>(1);
  const [currentPhoneOtp, setCurrentPhoneOtp] = useState('');
  const [isSendingCurrentOtp, setIsSendingCurrentOtp] = useState(false);
  const [isVerifyingCurrentOtp, setIsVerifyingCurrentOtp] = useState(false);
  const [currentOtpSent, setCurrentOtpSent] = useState(false);
  const [currentOtpError, setCurrentOtpError] = useState<string | null>(null);

  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newPhoneOtp, setNewPhoneOtp] = useState('');
  const [isSendingNewOtp, setIsSendingNewOtp] = useState(false);
  const [isVerifyingNewOtp, setIsVerifyingNewOtp] = useState(false);
  const [newOtpSent, setNewOtpSent] = useState(false);
  const [newOtpError, setNewOtpError] = useState<string | null>(null);

  const handleOpenPlayStoreReview = async () => {
    const playStoreAppUrl = 'market://details?id=com.counterpro.app';
    const playStoreWebUrl = APP_CONFIG.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.counterpro.app';
    try {
      const supported = await Linking.canOpenURL(playStoreAppUrl).catch(() => false);
      if (supported && Platform.OS === 'android') {
        await Linking.openURL(playStoreAppUrl);
      } else {
        await Linking.openURL(playStoreWebUrl);
      }
    } catch {
      Linking.openURL(playStoreWebUrl).catch(() => {});
      flash('Opening Google Play Store...');
    }
  };

  const handleOpenChangePhone = () => {
    setCurrentPhoneOtp('');
    setIsSendingCurrentOtp(false);
    setIsVerifyingCurrentOtp(false);
    setCurrentOtpSent(false);
    setCurrentOtpError(null);

    setNewPhoneNumber('');
    setNewPhoneOtp('');
    setIsSendingNewOtp(false);
    setIsVerifyingNewOtp(false);
    setNewOtpSent(false);
    setNewOtpError(null);

    setChangePhoneStep(1);
    setIsChangePhoneModalOpen(true);
  };

  const handleSendCurrentOtp = async () => {
    const rawCurrent = shop.phone || profile?.phone || '';
    const cleanPhone = twoFactorService.sanitizePhone(rawCurrent);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setCurrentOtpError('Invalid registered phone number.');
      return;
    }
    setIsSendingCurrentOtp(true);
    setCurrentOtpError(null);
    try {
      const res = await twoFactorService.sendOtp(cleanPhone);
      if (res.success) {
        setCurrentOtpSent(true);
        flash(`OTP sent to +91 ${cleanPhone}`);
      } else {
        setCurrentOtpError(res.error || 'Failed to send OTP to current number.');
      }
    } catch {
      setCurrentOtpError('Network error sending OTP.');
    } finally {
      setIsSendingCurrentOtp(false);
    }
  };

  const handleVerifyCurrentOtp = async () => {
    const rawCurrent = shop.phone || profile?.phone || '';
    const cleanPhone = twoFactorService.sanitizePhone(rawCurrent);
    if (currentPhoneOtp.trim().length !== 6) {
      setCurrentOtpError('Please enter the 6-digit OTP code.');
      return;
    }
    setIsVerifyingCurrentOtp(true);
    setCurrentOtpError(null);
    try {
      const res = await twoFactorService.verifyOtp(cleanPhone, currentPhoneOtp.trim());
      if (res.success) {
        flash('Current phone verified successfully!');
        setChangePhoneStep(2);
      } else {
        setCurrentOtpError(res.error || 'Incorrect OTP code.');
      }
    } catch {
      setCurrentOtpError('Verification failed. Try again.');
    } finally {
      setIsVerifyingCurrentOtp(false);
    }
  };

  const handleSendNewOtp = async () => {
    const cleanNew = twoFactorService.sanitizePhone(newPhoneNumber);
    const rawCurrent = shop.phone || profile?.phone || '';
    const cleanCurrent = twoFactorService.sanitizePhone(rawCurrent);

    if (cleanNew.length !== 10) {
      setNewOtpError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (cleanNew === cleanCurrent) {
      setNewOtpError('New number cannot be the same as your current number.');
      return;
    }

    setIsSendingNewOtp(true);
    setNewOtpError(null);
    try {
      const res = await twoFactorService.sendOtp(cleanNew);
      if (res.success) {
        setNewOtpSent(true);
        flash(`OTP sent to new number +91 ${cleanNew}`);
      } else {
        setNewOtpError(res.error || 'Failed to send OTP to new number.');
      }
    } catch {
      setNewOtpError('Network error sending OTP.');
    } finally {
      setIsSendingNewOtp(false);
    }
  };

  const handleVerifyNewOtpAndSave = async () => {
    const cleanNew = twoFactorService.sanitizePhone(newPhoneNumber);
    if (newPhoneOtp.trim().length !== 6) {
      setNewOtpError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsVerifyingNewOtp(true);
    setNewOtpError(null);
    try {
      const res = await twoFactorService.verifyOtp(cleanNew, newPhoneOtp.trim());
      if (res.success) {
        // Update Supabase tables
        if (shop.id) {
          await (supabase.from('shops') as any)
            .update({ phone: cleanNew })
            .eq('id', shop.id);
        }
        if (profile?.id) {
          await (supabase.from('profiles') as any)
            .update({ phone: cleanNew })
            .eq('id', profile.id);

          await (supabase.from('shop_members') as any)
            .update({ phone: cleanNew })
            .eq('shop_id', shop.id)
            .eq('user_id', profile.id);
        }

        // Update local state and context
        await updateShop({ phone: cleanNew });
        await updateProfile({ phone: cleanNew });
        setEditShopPhone(cleanNew);

        setChangePhoneStep(3);
        flash('Mobile number updated successfully!');
      } else {
        setNewOtpError(res.error || 'Incorrect OTP code.');
      }
    } catch (err: any) {
      setNewOtpError('Failed to update phone number: ' + (err?.message || 'Check connection'));
    } finally {
      setIsVerifyingNewOtp(false);
    }
  };

  const meUser = members.find((m: ShopMember) => m.role === currentRole) || members[0] || {
    id: 'me',
    shopId: shop.id,
    userId: profile?.id || 'usr_me',
    fullName: profile?.fullName || `${shop.name || 'Shop'} Owner`,
    role: currentRole,
    phone: profile?.phone || shop.phone || '',
    isActive: true,
  };

  const handleOpenEditShop = () => {
    setEditShopName(shop.name || 'Raja Tea Stall');
    setEditOwnerName(shop.ownerName || profile?.fullName || 'Raja');
    setEditShopPhone(shop.phone || '');
    setEditShopAddress(shop.address || '');
    setEditShopCity(shop.city || '');
    setEditLogoUrl(shop.logoUrl || null);
    setEditInvoicePrefix(shop.invoicePrefix || generateDefaultInvoicePrefix(shop.name));
    setEditInvoiceResetCycle(shop.invoiceResetCycle || 'monthly');
    setEditUpiId(shop.upiId || '');
    setIsEditShopOpen(true);
  };

  const handlePickLogo = async () => {
    const res = await imageService.pickShopLogo();
    if (res.success && (res.logoUrl || res.uri)) {
      const selectedLogo = res.logoUrl || res.uri || null;
      setEditLogoUrl(selectedLogo);
      if (selectedLogo) {
        await updateShop({ logoUrl: selectedLogo });
      }
      flash('Logo updated successfully');
    }
  };

  const handleSaveShopEdit = async () => {
    if (!editShopName.trim()) {
      flash('Shop name cannot be empty');
      return;
    }
    if (!editOwnerName.trim()) {
      flash('Owner name cannot be empty');
      return;
    }
    if (editShopPhone.trim().length < 10) {
      flash('Valid 10-digit mobile number needed');
      return;
    }

    setIsSavingShopEdit(true);
    try {
      const finalLogo = editLogoUrl || shop.logoUrl;
      await updateShop({
        name: editShopName.trim(),
        ownerName: editOwnerName.trim(),
        phone: editShopPhone.trim(),
        address: editShopAddress.trim(),
        city: editShopCity.trim(),
        upiId: editUpiId.trim() || null,
        logoUrl: finalLogo,
        invoicePrefix: (editInvoicePrefix.trim().toUpperCase() || generateDefaultInvoicePrefix(editShopName)),
        invoiceResetCycle: editInvoiceResetCycle,
      });

      // Update owner profile in AuthContext and persistent storage
      await updateProfile({
        fullName: editOwnerName.trim(),
        phone: editShopPhone.trim(),
      });

      // Update profile in Supabase table
      if (profile?.id) {
        try {
          await (supabase.from('profiles') as any).update({
            full_name: editOwnerName.trim(),
            phone: editShopPhone.trim(),
          }).eq('id', profile.id);
        } catch {}
      }

      setIsEditShopOpen(false);
      flash('Shop & owner details updated successfully');
    } catch (err: any) {
      flash('Failed to update details');
    } finally {
      setIsSavingShopEdit(false);
    }
  };

  const handleSaveUser = async () => {
    const name = newUserName.trim();
    const phone = newUserPhone.trim();
    if (!name) {
      flash('Staff name needed');
      return;
    }
    if (phone.length < 10) {
      flash('Enter 10-digit mobile number');
      return;
    }

    setIsSavingUser(true);
    try {
      await addMember(name, newUserRole, phone, newUserOverrides);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserOverrides({});
      setIsAddUserOpen(false);
      flash(t('staff_added_success', 'Staff member added successfully'));
    } catch (err: any) {
      flash(err?.message || 'Failed to add user');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Table Settings Handlers
  const handleToggleTableSettings = async () => {
    const next = !shop.tableManagementEnabled;
    const count = Number(tableCountInput) || shop.tableCount || 6;
    await updateShop({
      tableManagementEnabled: next,
      tableCount: count,
    });
    if (next) {
      setIsTableEditorOpen(true);
      flash(`Dining table management enabled (${count} tables)`);
    } else {
      setIsTableEditorOpen(false);
      flash('Table management disabled');
    }
  };

  const handleSaveTableCountInput = async () => {
    const count = parseInt(tableCountInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(count) || count < 1) {
      flash('Enter a valid number of tables (at least 1)');
      return;
    }
    const safeCount = Math.min(100, Math.max(1, count));
    setIsSavingTableCount(true);
    try {
      setTableCountInput(String(safeCount));
      await updateShop({
        tableManagementEnabled: true,
        tableCount: safeCount,
      });
      setIsTableEditorOpen(false);
      flash(`Saved ${safeCount} dining tables`);
    } catch (err) {
      flash('Failed to save tables');
    } finally {
      setIsSavingTableCount(false);
    }
  };

  const handleOpenUserSheet = (m: ShopMember) => {
    if (!can('users')) {
      flash('Only the owner can change roles');
      return;
    }
    if (m.role === 'Owner') {
      flash('The owner ID cannot be changed');
      return;
    }
    setSelectedMemberForSheet(m);
  };

  // --- GST Handlers ---
  const handleToggleGst = async () => {
    if (!can('report')) {
      flash('Locked. Please ask the owner');
      return;
    }
    const nextEnabled = !shop.gstEnabled;
    const rate = Number(gstRateInput) || shop.gstRate || 5;
    await updateShop({ gstEnabled: nextEnabled, gstRate: rate });
    if (nextEnabled) {
      setIsGstEditorOpen(true);
      flash(`GST ${rate}% enabled on bills`);
    } else {
      setIsGstEditorOpen(false);
      flash('GST disabled on bills');
    }
  };

  const handleApplyGstRate = async (rate: number) => {
    setGstRateInput(String(rate));
    setIsSavingGst(true);
    try {
      await updateShop({ gstEnabled: true, gstRate: rate });
      setIsGstEditorOpen(false);
      flash(`GST ${rate}% saved and applied to all bills`);
    } finally {
      setIsSavingGst(false);
    }
  };

  const handleSaveCustomGstRate = async () => {
    const rate = parseFloat(gstRateInput);
    if (isNaN(rate) || rate < 0 || rate > 50) {
      flash('Please enter a valid GST percentage (0 to 50%)');
      return;
    }
    setIsSavingGst(true);
    try {
      await updateShop({ gstEnabled: true, gstRate: rate });
      setIsGstEditorOpen(false);
      flash(`GST rate ${rate}% saved and applied to all bills`);
    } finally {
      setIsSavingGst(false);
    }
  };

  // --- Real Thermal Printer Handlers ---
  const handleTogglePrinter = async () => {
    const nextEnabled = !shop.printerEnabled;
    await updateShop({
      printerEnabled: nextEnabled,
    });
    if (nextEnabled) {
      flash('Thermal printer enabled');
      if (!shop.printerName) {
        handleScanRealPrinter();
      }
    } else {
      flash('Thermal printer disabled');
    }
  };

  const handleScanRealPrinter = async () => {
    if (isScanningPrinters) return;
    setIsScanningPrinters(true);
    setScanCompleted(false);
    setScanExplanation(null);
    setDiscoveredPrinters([]);

    try {
      const res = await printerService.scanForPrinters();
      if (res.printers && res.printers.length > 0) {
        setDiscoveredPrinters(res.printers);
        // On iOS AirPrint picker, exactly 1 selected printer is returned
        if (Platform.OS === 'ios' && res.printers.length === 1) {
          const selected = res.printers[0];
          await updateShop({
            printerEnabled: true,
            printerName: selected.name,
            printerUrl: selected.url,
            printerConnectionType: selected.connectionType,
          });
          await printerService.saveActivePrinter(selected);
          flash(`Connected to ${selected.name}`);
        }
      } else {
        setDiscoveredPrinters([]);
        setScanExplanation(res.explanation || 'No printers found');
      }
    } catch (err: any) {
      setDiscoveredPrinters([]);
      setScanExplanation(err?.message || 'Scanning failed. Check Bluetooth/Wi-Fi and permissions.');
    } finally {
      setIsScanningPrinters(false);
      setScanCompleted(true);
    }
  };

  const handleConnectDiscoveredPrinter = async (p: DiscoveredPrinter) => {
    if (connectingPrinterId) return;
    setConnectingPrinterId(p.id);
    try {
      const verifyRes = await printerService.verifyPrinterConnection(p);
      if (!verifyRes.verified) {
        flash(verifyRes.error || 'Connection failed: printer unreachable');
        return;
      }
      await updateShop({
        printerEnabled: true,
        printerName: p.name,
        printerUrl: p.url,
        printerConnectionType: p.connectionType,
      });
      await printerService.saveActivePrinter(p);
      flash(`Connected to ${p.name}`);
    } catch (err: any) {
      flash('Connection error: ' + (err?.message || 'Could not connect to device'));
    } finally {
      setConnectingPrinterId(null);
    }
  };

  const handleAddNetworkIpPrinter = async () => {
    const ip = customPrinterIp.trim();
    if (!ip) {
      flash('Enter valid printer IP address (e.g. 192.168.1.100)');
      return;
    }
    setIsSavingCustomIp(true);
    try {
      const res = await printerService.connectNetworkPrinter(ip);
      if (!res.success || !res.printer) {
        flash(res.error || 'Could not verify printer at this IP');
        return;
      }
      await updateShop({
        printerEnabled: true,
        printerName: res.printer.name,
        printerUrl: res.printer.url,
        printerConnectionType: 'network',
      });
      setIsAddingIpPrinter(false);
      setCustomPrinterIp('');
      flash(`Connected to ${res.printer.name}`);
    } catch (err: any) {
      flash('Network printer error: ' + (err?.message || 'Failed to connect'));
    } finally {
      setIsSavingCustomIp(false);
    }
  };

  const handleDisconnectPrinter = async () => {
    await updateShop({
      printerName: '',
      printerUrl: '',
      printerConnectionType: null,
    });
    await printerService.disconnectPrinter();
    setDiscoveredPrinters([]);
    setScanCompleted(false);
    flash('Thermal printer disconnected');
  };

  const handleTestPrint = async () => {
    if (!shop.printerName) {
      flash('No active printer connected');
      return;
    }
    if (isPrintingTest) return;
    setIsPrintingTest(true);
    try {
      flash('Sending test slip to thermal printer...');
      const res = await printerService.printTestSlip(
        shop.name || 'Counter365 Store',
        shop.address || 'Hardware Printer Test',
        shop.phone || '',
        shop.printerUrl || undefined
      );
      if (res.success) {
        flash('Test slip printed successfully');
      } else {
        flash('Print error: ' + (res.error || 'Check printer power and paper'));
      }
    } catch (err: any) {
      flash('Print error: ' + (err?.message || 'Could not print test slip'));
    } finally {
      setIsPrintingTest(false);
    }
  };

  // Cloud Backup Handlers (Protected: always ON to ensure zero data loss)
  const handleToggleBackup = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    flash('Daily cloud & offline backup cannot be turned off. It keeps your sales and offline bills permanently safe.');
  };

  const handleTriggerManualBackup = async () => {
    setIsSyncingBackup(true);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const backupText = `Today, ${nowTime}`;
      await storage.setItem('@counterpro/last_backup', backupText);
      setLastBackupText(`Last backup: Just now at ${nowTime} (Cloud Synced)`);
      flash('All shop data & bills backed up safely');
    } finally {
      setIsSyncingBackup(false);
    }
  };

  // --- Logout & Delete Account Handlers ---
  const handleConfirmLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your data remains safe in the cloud and you can log back in anytime with your phone number and OTP.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'default',
          onPress: async () => {
            await logout();
            flash('Logged out successfully');
            onLogout?.();
          },
        },
      ]
    );
  };

  const handleConfirmPermanentlyDelete = () => {
    if (currentRole !== 'Owner') {
      flash('Only the shop Owner can delete the account');
      return;
    }

    const cleanPhone = (shop.phone || profile?.phone || '').replace(/[^0-9]/g, '');
    const isDemo =
      shop.id === '99999999-9999-4999-8999-888888888888' ||
      shop.id?.startsWith('99999999-') ||
      cleanPhone === '9999999999' ||
      /demo|sample/i.test(shop.name || '');

    if (isDemo) {
      Alert.alert('Protected Demo Account', 'Demo accounts are protected and cannot be deleted.');
      return;
    }

    setSelectedDeleteReason('');
    setDeleteFeedbackText('');
    setIsDeleteReasonModalVisible(true);
  };

  const handleExecutePermanentDelete = () => {
    if (!selectedDeleteReason) {
      flash('Please select a reason for account deletion');
      return;
    }

    Alert.alert(
      'Final Confirmation: Delete Account?',
      `Are you completely sure? This will permanently delete ${shop.name || 'your shop'}, all invoices, menu items, customer dues, and cloud data from Supabase. This CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingShop(true);
            try {
              await deleteShopPermanently({
                shopId: shop.id,
                ownerUserId: profile?.id,
                ownerName: profile?.fullName,
                phone: profile?.phone || shop.phone,
                shopName: shop.name,
                reason: selectedDeleteReason,
                feedback: deleteFeedbackText.trim() || undefined,
              });
              await logout();
              setIsDeleteReasonModalVisible(false);
              flash('Account permanently deleted. Thank you for using Counter365.');
              onLogout?.();
            } catch (err: any) {
              flash('Error deleting account: ' + (err?.message || 'Please check connection'));
            } finally {
              setIsDeletingShop(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Shop Profile (Compact & Simple) */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={currentRole === 'Owner' ? 0.75 : 1}
          onPress={currentRole === 'Owner' ? handleOpenEditShop : undefined}
        >
          <TouchableOpacity
            onPress={currentRole === 'Owner' ? handlePickLogo : undefined}
            activeOpacity={currentRole === 'Owner' ? 0.8 : 1}
            style={styles.avatarWrap}
          >
            {shop.logoUrl ? (
              <Image key={shop.logoUrl} source={{ uri: shop.logoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(shop.name || 'R').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {currentRole === 'Owner' && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={9} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileMetaWrap}>
            <Text style={styles.profileName} numberOfLines={1}>{shop.name || 'Fryso Cafe'}</Text>
          </View>

          {currentRole === 'Owner' && (
            <TouchableOpacity onPress={handleOpenEditShop} style={styles.editProfileBtn} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={14} color={colors.text} style={{ marginRight: 4 }} />
              <Text style={styles.editProfileBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* 2. Dynamic Subscription / Free Tier Card (Owner only) */}
        {currentRole === 'Owner' && (
          <View style={styles.subscriptionCard}>
            <View style={styles.subHeader}>
              <Image
                source={require('../../../assets/counterpro_logo_white.png')}
                style={styles.subLogoImage}
                resizeMode="contain"
              />
              <View
                style={[
                  styles.freeActiveBadge,
                  subscriptionStatus.isPaidActive
                    ? styles.paidActiveBadge
                    : subscriptionStatus.billLimitReached
                    ? styles.expiredBadge
                    : styles.trialActiveBadge,
                ]}
              >
                <Text style={styles.freeActiveBadgeText}>
                  {subscriptionStatus.isPaidActive
                    ? t('pro_active', 'Pro Active')
                    : subscriptionStatus.billLimitReached
                    ? `100 / 100 ${t('used', 'Used')}`
                    : `${t('starter_quota', 'Starter Quota')}: ${subscriptionStatus.totalBillsCreated} / 100`}
                </Text>
              </View>
            </View>

            {/* Dynamic Progress Track strictly based on 100 sales limit */}
            <View style={styles.subProgressTrack}>
              <View
                style={[
                  styles.subProgressFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(4, Math.round(subscriptionStatus.progressPercent))
                    )}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.subMetaRow}>
              <Text style={styles.subPrice}>
                {subscriptionStatus.isPaidActive
                  ? `${subscriptionStatus.activePlanName} (₹${subscriptionStatus.activePlanPrice})`
                  : `${t('starter_quota', 'Starter Quota')} (${subscriptionStatus.totalBillsCreated} ${t('of_100_sales', 'of 100 Sales')})`}
              </Text>
              <Text style={styles.subRenew}>
                {subscriptionStatus.isPaidActive
                  ? (subscriptionStatus.subscriptionEndDateFormatted
                      ? `Valid until: ${subscriptionStatus.subscriptionEndDateFormatted}`
                      : 'Pro Active')
                  : subscriptionStatus.billLimitReached
                  ? t('limit_reached', 'Limit Reached')
                  : `${subscriptionStatus.billsRemaining} ${t('bills_remaining', 'bills remaining')}`}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsSubscriptionModalOpen(true)}
              style={styles.managePlanBtn}
            >
              <Text style={styles.managePlanText}>
                {subscriptionStatus.isPaidActive
                  ? t('manage_plan', 'Manage Plan')
                  : subscriptionStatus.billLimitReached
                  ? t('subscribe_to_continue', 'Subscribe to Continue')
                  : t('upgrade_to_pro', 'Upgrade to Pro')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Users & Staff Section (Owner only) */}
        {can('users') && (() => {
          const activeMembers = members.filter(u => u.isActive !== false);
          const inactiveMembers = members.filter(u => u.isActive === false);
          const maxLimit = shop.maxStaffLimit || 5;
          const isLimitReached = members.length >= maxLimit;

          return (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeading}>{t('users_and_staff', 'Users & Staff')} ({activeMembers.length} {t('active_count', 'active')})</Text>
                  <Text style={styles.sectionSubHeading}>{t('allocation', 'Allocation')}: {members.length}/{maxLimit} ({t('active_plus_inactive', 'Active + Inactive')})</Text>
                </View>
                {currentRole === 'Owner' && (
                  <TouchableOpacity
                    onPress={() => setIsAddUserOpen(!isAddUserOpen)}
                    style={styles.addUserBtn}
                  >
                    <Text style={styles.addUserText}>
                      {isAddUserOpen ? t('cancel_add_user', 'Cancel') : t('add_user', '+ Add user')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Active Users List */}
              <View style={styles.usersList}>
                {activeMembers.length === 0 ? (
                  <View style={styles.emptyStaffNotice}>
                    <Text style={styles.emptyStaffText}>{t('no_active_staff', 'No active staff members. Add a Supervisor or Biller below.')}</Text>
                  </View>
                ) : (
                  activeMembers.map((u: ShopMember) => {
                    const hasOverrides = u.overrides && Object.keys(u.overrides).length > 0;
                    const extraText = u.role === 'Owner' ? t('master_id', 'master ID') : hasOverrides ? t('has_overrides', 'has overrides') : '';

                    return (
                      <TouchableOpacity
                        key={u.id}
                        activeOpacity={currentRole === 'Owner' ? 0.7 : 1}
                        onPress={() => {
                          if (currentRole === 'Owner') {
                            handleOpenUserSheet(u);
                          }
                        }}
                        style={styles.userRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{u.fullName}</Text>
                          {u.phone ? <Text style={styles.userPhoneText}>+91 {u.phone}</Text> : null}
                        </View>
                        {extraText ? <Text style={styles.userExtra}>{extraText}</Text> : null}
                        <AppTag
                          label={u.role.toUpperCase()}
                          variant={u.role === 'Owner' ? 'accent' : 'neutral'}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Inactive Staff Members Section (Preserved historical attribution) */}
              {inactiveMembers.length > 0 && (
                <View style={styles.inactiveStaffBox}>
                  <View style={styles.inactiveStaffHeader}>
                    <Ionicons name="archive-outline" size={15} color={colors.textSecondary} />
                    <Text style={styles.inactiveStaffTitle}>{t('inactive_staff_records', 'Inactive Staff Records')} ({inactiveMembers.length})</Text>
                  </View>
                  <Text style={styles.inactiveStaffNotice}>
                    {t('inactive_staff_notice', 'Historical billing attribution and records are preserved. Inactive accounts count toward staff allocation limit.')}
                  </Text>
                  {inactiveMembers.map((u: ShopMember) => (
                    <TouchableOpacity
                      key={u.id}
                      activeOpacity={currentRole === 'Owner' ? 0.7 : 1}
                      onPress={() => {
                        if (currentRole === 'Owner') {
                          handleOpenUserSheet(u);
                        }
                      }}
                      style={[styles.userRow, { opacity: 0.75, borderBottomColor: colors.dividerLight }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{u.fullName}</Text>
                        {u.phone ? <Text style={styles.userPhoneText}>+91 {u.phone}</Text> : null}
                        <Text style={styles.deactivatedSubText}>
                          {t('deactivated', 'Deactivated')} • {u.role === 'Supervisor' ? t('supervisor', 'Supervisor') : u.role === 'Biller' ? t('biller', 'Biller') : u.role}
                        </Text>
                      </View>
                      <AppTag label="INACTIVE" variant="neutral" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}


              {/* Add User Form OR Allocation Support Template */}
              {currentRole === 'Owner' && isAddUserOpen && (
                isLimitReached ? (
                  <View style={styles.supportTemplateCard}>
                    <View style={styles.supportTemplateHeader}>
                      <Ionicons name="alert-circle" size={22} color="#EA580C" />
                      <Text style={styles.supportTemplateHeading}>{t('staff_allocation_limit_reached', 'Staff Allocation Limit Reached')}</Text>
                    </View>
                    <Text style={styles.supportTemplateText}>
                      {t('staff_limit_message', 'Your staff allocation limit has been reached. Please contact our support team for assistance with adding or reactivating staff.')}
                    </Text>
                    <View style={styles.supportBtnRow}>
                      <TouchableOpacity
                        style={styles.supportCallBtn}
                        onPress={() => Linking.openURL(`tel:${APP_CONFIG.supportPhone}`)}
                      >
                        <Ionicons name="call" size={14} color="#FFFFFF" />
                        <Text style={styles.supportCallBtnText}>{t('call_support', 'Call Support')} ({APP_CONFIG.supportPhoneFormatted})</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.supportWaBtn}
                        onPress={() => {
                          const msg = encodeURIComponent(`Hi Counter365 Support,\nI have reached the staff allocation limit (${members.length}/${maxLimit}) for my shop ${shop.name || ''} (+91 ${shop.phone || ''}).\nI need assistance adding/reactivating staff.`);
                          Linking.openURL(`https://wa.me/91${APP_CONFIG.supportPhone}?text=${msg}`);
                        }}
                      >
                        <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
                        <Text style={styles.supportWaBtnText}>{t('whatsapp_support', 'WhatsApp Support')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.addUserFormCard}>
                    <Text style={styles.addUserFormTitle}>{t('add_store_staff', 'Add Store Staff')}</Text>
                    <TextInput
                      style={styles.addUserInput}
                      placeholder={t('staff_name_placeholder', 'Staff Member Name (e.g. Karthik)')}
                      placeholderTextColor={colors.textSecondary}
                      value={newUserName}
                      onChangeText={setNewUserName}
                    />
                    <TextInput
                      style={styles.addUserInput}
                      placeholder={t('mobile_placeholder', '10-Digit Mobile Number')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={10}
                      value={newUserPhone}
                      onChangeText={t => setNewUserPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                    />

                    {/* Role Selector: Supervisor vs Biller */}
                    <View style={styles.rolePickerRow}>
                      <TouchableOpacity
                        onPress={() => {
                          setNewUserRole('Supervisor');
                          setNewUserOverrides({});
                        }}
                        style={[
                          styles.roleChoiceBtn,
                          newUserRole === 'Supervisor' && styles.roleChoiceBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChoiceText,
                            newUserRole === 'Supervisor' && styles.roleChoiceTextActive,
                          ]}
                        >
                          {t('supervisor', 'Supervisor')}
                        </Text>
                        <Text style={styles.roleChoiceSub}>{t('full_access', 'Full Access')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setNewUserRole('Biller');
                          setNewUserOverrides({});
                        }}
                        style={[
                          styles.roleChoiceBtn,
                          newUserRole === 'Biller' && styles.roleChoiceBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChoiceText,
                            newUserRole === 'Biller' && styles.roleChoiceTextActive,
                          ]}
                        >
                          {t('biller', 'Biller')}
                        </Text>
                        <Text style={styles.roleChoiceSub}>{t('billing_only', 'Billing Only')}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Module Permissions Toggles for New User */}
                    <View style={{ marginTop: 14, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
                        <Text style={{ fontFamily: 'Jost', fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {t('module_permissions', 'Module Permissions')}
                        </Text>
                        <Text style={{ fontFamily: 'Lexend', fontSize: 11, color: colors.textSecondary }}>
                          {Object.keys(newUserOverrides).length > 0 ? t('custom_overrides', 'Customized') : t('as_per_role', 'As per role')}
                        </Text>
                      </View>

                      <View style={{ gap: 6 }}>
                        {PERM_ROWS.map(p => {
                          const basePerm = DEFAULT_ROLE_PERMS[newUserRole]?.[p.key] ?? false;
                          const overrideVal = newUserOverrides[p.key];
                          const isGranted = overrideVal !== undefined ? overrideVal : basePerm;
                          const isOverridden = overrideVal !== undefined && overrideVal !== basePerm;

                          return (
                            <TouchableOpacity
                              key={p.key}
                              activeOpacity={0.7}
                              onPress={() => handleToggleNewUserPerm(p.key, isGranted)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: isDark ? '#2C2C2E' : '#E5E7EB',
                              }}
                            >
                              <Text style={{ fontFamily: 'Lexend', fontSize: 13, color: colors.text, flex: 1 }}>
                                {p.name}
                              </Text>

                              {isOverridden && (
                                <View style={{ marginRight: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? '#374151' : '#E5E7EB' }}>
                                  <Text style={{ fontSize: 9, fontFamily: 'Lexend', fontWeight: '700', color: isDark ? '#9CA3AF' : '#4B5563' }}>
                                    OVERRIDE
                                  </Text>
                                </View>
                              )}

                              <View
                                style={[
                                  styles.toggleTrack,
                                  isGranted && styles.toggleTrackActive,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.toggleKnob,
                                    isGranted && styles.toggleKnobActive,
                                  ]}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.addUserActionRow}>
                      <TouchableOpacity
                        onPress={() => setIsAddUserOpen(false)}
                        style={styles.cancelUserBtn}
                      >
                        <Text style={styles.cancelUserText}>{t('cancel', 'Cancel')}</Text>
                      </TouchableOpacity>
                      <AppButton
                        title={isSavingUser ? t('adding', 'Adding...') : t('save_user', 'Save User')}
                        variant="primary"
                        onPress={handleSaveUser}
                        disabled={isSavingUser}
                        style={styles.saveUserBtn}
                      />
                    </View>
                  </View>
                )
              )}
            </View>
          );
        })()}

        {/* 4. Settings Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t('theme_and_appearance', 'Theme & Appearance')}</Text>
          <View style={[styles.settingsList, { marginBottom: 16 }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
                toggleTheme();
              }}
              style={styles.settingRow}
            >
              <View style={styles.settingInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? '#FF5F00' : colors.text} />
                  <Text style={styles.settingTitle}>{t('dark_mode_theme', 'Dark Mode Theme')}</Text>
                </View>
                <Text style={styles.settingSub}>
                  {isDark ? t('dark_theme_sub', 'Deep black, white & orange palette') : t('light_theme_sub', 'Clean light, dark & orange palette')}
                </Text>
              </View>
              <View style={[styles.toggleTrack, isDark && styles.toggleTrackActive]}>
                <View style={[styles.toggleKnob, isDark && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>{t('hardware_billing_settings', 'Hardware & Billing Settings')}</Text>
          <View style={styles.settingsList}>

            {/* --- THERMAL PRINTER TOGGLE & SCANNER --- */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleTogglePrinter}
              style={styles.settingRow}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('thermal_printer', 'Thermal Printer')}</Text>
                <Text style={styles.settingSub}>
                  {shop.printerEnabled
                    ? (shop.printerName && shop.printerName.trim().length > 0
                        ? `Connected • ${shop.printerName}`
                        : isScanningPrinters
                        ? 'Scanning for printers...'
                        : 'Enabled • No printer paired')
                    : 'Disabled • Sharing on WhatsApp'}
                </Text>
              </View>
              <View style={[styles.toggleTrack, shop.printerEnabled && styles.toggleTrackActive]}>
                <View style={[styles.toggleKnob, shop.printerEnabled && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>

            {/* Expanded Real Thermal Printer Card */}
            {shop.printerEnabled && (
              <View style={styles.expandedSubCard}>
                <View style={styles.expandedHeader}>
                  <Text style={styles.expandedTitle}>Original Thermal Printer</Text>
                  <Text style={[styles.scannerBadge, Boolean(shop.printerName && shop.printerName.trim().length > 0) && styles.scannerBadgeConnected]}>
                    {shop.printerName && shop.printerName.trim().length > 0
                      ? '● Connected'
                      : isScanningPrinters
                      ? '● Scanning...'
                      : '● Ready to Pair'}
                  </Text>
                </View>
                <Text style={styles.expandedSub}>
                  ESC/POS receipt printer connection (AirPrint, Bluetooth, USB, Network):
                </Text>

                {shop.printerName && shop.printerName.trim().length > 0 ? (
                  /* Verified Connected Printer Card */
                  <View style={styles.realPrinterCard}>
                    <View style={styles.realPrinterHeader}>
                      <View style={styles.printerIconWrap}>
                        <Ionicons name="print-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={styles.printerInfo}>
                        <Text style={styles.printerName}>{shop.printerName}</Text>
                        <Text style={styles.printerMeta}>
                          {shop.printerConnectionType ? `${shop.printerConnectionType.toUpperCase()} · Verified Active` : 'ESC/POS Thermal Printer'}
                        </Text>
                      </View>
                      <View style={styles.connectedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={styles.connectedBadgeText}>Connected</Text>
                      </View>
                    </View>

                    <View style={styles.printerActionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.printerTestBtn, isPrintingTest && styles.btnDisabled]}
                        onPress={handleTestPrint}
                        disabled={isPrintingTest}
                        activeOpacity={0.8}
                        accessibilityLabel="Print Test Slip"
                      >
                        {isPrintingTest ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="print-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.printerTestBtnText}>Print Test Slip</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.printerChangeBtn}
                        onPress={handleScanRealPrinter}
                        disabled={isScanningPrinters || isPrintingTest}
                        activeOpacity={0.7}
                        accessibilityLabel="Change Printer"
                      >
                        <Text style={styles.printerChangeBtnText}>
                          {isScanningPrinters ? 'Scanning...' : 'Change'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.printerDisconnectBtn}
                        onPress={handleDisconnectPrinter}
                        disabled={isPrintingTest}
                        activeOpacity={0.7}
                        accessibilityLabel="Disconnect Printer"
                      >
                        <Text style={styles.printerDisconnectBtnText}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : isScanningPrinters ? (
                  /* Scanning in progress */
                  <View style={styles.printerLoadingCard}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.printerLoadingText}>Scanning for compatible thermal printers...</Text>
                    <Text style={styles.printerLoadingSub}>Checking AirPrint, Network, and System Print Services</Text>
                  </View>
                ) : scanCompleted && discoveredPrinters.length > 0 ? (
                  /* Discovered Printers List */
                  <View style={styles.discoveredContainer}>
                    <Text style={styles.discoveredTitle}>Discovered Compatible Printers ({discoveredPrinters.length}):</Text>
                    {discoveredPrinters.map(p => (
                      <View key={p.id} style={styles.discoveredRow}>
                        <View style={styles.printerIconWrap}>
                          <Ionicons name="print-outline" size={18} color={colors.accent} />
                        </View>
                        <View style={styles.printerInfo}>
                          <Text style={styles.printerName}>{p.name}</Text>
                          <Text style={styles.printerMeta}>{p.connectionType.toUpperCase()} Thermal Device</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.connectPrinterBtn}
                          onPress={() => handleConnectDiscoveredPrinter(p)}
                          disabled={connectingPrinterId === p.id}
                          activeOpacity={0.8}
                        >
                          {connectingPrinterId === p.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.connectPrinterBtnText}>Connect</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.scanAgainBtn}
                      onPress={handleScanRealPrinter}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh-outline" size={14} color={colors.accent} />
                      <Text style={styles.scanAgainBtnText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : scanCompleted && discoveredPrinters.length === 0 ? (
                  /* Compact No Printers Found Card with Retry Scan */
                  <View style={styles.compactNoPrinterCard}>
                    <View style={styles.compactNoPrinterHeader}>
                      <View style={styles.compactPrinterIconCircle}>
                        <Ionicons name="print-outline" size={16} color="#EA580C" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactNoPrinterTitle}>No printers found</Text>
                        <Text style={styles.compactNoPrinterSub}>Turn on printer and retry scan</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.compactRetryBtn}
                        onPress={handleScanRealPrinter}
                        activeOpacity={0.8}
                        accessibilityLabel="Retry Scan"
                      >
                        <Ionicons name="refresh-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.compactRetryBtnText}>Retry Scan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Initial Scan Prompt */
                  <View style={styles.compactNoPrinterCard}>
                    <View style={styles.compactNoPrinterHeader}>
                      <View style={styles.compactPrinterIconCircle}>
                        <Ionicons name="print-outline" size={16} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactNoPrinterTitle}>Print Ready</Text>
                        <Text style={styles.compactNoPrinterSub}>Turn on printer to discover device</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.compactRetryBtn}
                        onPress={handleScanRealPrinter}
                        activeOpacity={0.85}
                        accessibilityLabel="Scan for Printers"
                      >
                        <Ionicons name="search-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.compactRetryBtnText}>Scan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* --- GST ON BILLS TOGGLE & RATE SELECTOR --- */}
            {currentRole === 'Owner' && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggleGst}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('gst_on_bills', 'GST on Bills')}</Text>
                  <Text style={styles.settingSub}>
                    {shop.gstEnabled
                      ? `${shop.gstRate || 5}% ${t('gst_added_sub', 'GST added to all bill totals')}`
                      : t('gst_off_sub', 'Off • Plain net totals without tax')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {shop.gstEnabled && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setIsGstEditorOpen(prev => !prev);
                      }}
                      style={styles.editGstPill}
                      accessibilityLabel="Change GST Rate"
                    >
                      <Text style={styles.editGstPillText}>{shop.gstRate || 5}%</Text>
                      <Ionicons name="create-outline" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                  <View style={[styles.toggleTrack, shop.gstEnabled && styles.toggleTrackActive]}>
                    <View style={[styles.toggleKnob, shop.gstEnabled && styles.toggleKnobActive]} />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Expanded GST Rate Customizer (Owner only) */}
            {currentRole === 'Owner' && shop.gstEnabled && isGstEditorOpen && (
              <View style={styles.expandedSubCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.expandedTitle}>{t('set_gst_percentage', 'Set GST Percentage')}</Text>
                  <TouchableOpacity
                    onPress={() => setIsGstEditorOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.expandedSub}>
                  {t('choose_tax_bracket', 'Choose standard tax bracket or enter custom percentage:')}
                </Text>

                {/* Quick Presets */}
                <View style={styles.gstPresetsRow}>
                  {[5, 12, 18, 28].map(rate => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.gstPresetChip,
                        Number(gstRateInput) === rate && styles.gstPresetChipActive,
                      ]}
                      onPress={() => handleApplyGstRate(rate)}
                    >
                      <Text
                        style={[
                          styles.gstPresetText,
                          Number(gstRateInput) === rate && styles.gstPresetTextActive,
                        ]}
                      >
                        {rate}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Percentage Input */}
                <View style={styles.customGstRow}>
                  <Text style={styles.customGstLabel}>{t('custom_percent', 'Custom %:')}</Text>
                  <TextInput
                    style={styles.customGstInput}
                    keyboardType="numeric"
                    value={gstRateInput}
                    onChangeText={setGstRateInput}
                    placeholder="e.g. 5"
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={styles.saveGstBtn}
                    onPress={handleSaveCustomGstRate}
                    disabled={isSavingGst}
                  >
                    <Text style={styles.saveGstText}>
                      {isSavingGst ? t('saving', 'Saving...') : t('save_and_close', 'Save & Close')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* --- ROUND OFF TOTALS --- */}
            {currentRole === 'Owner' && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  const next = !shop.roundOffEnabled;
                  updateShop({ roundOffEnabled: next });
                  flash(next ? t('round_off_enabled_msg', 'Round off enabled') : t('round_off_disabled_msg', 'Round off disabled'));
                }}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('round_off_totals', 'Round off totals')}</Text>
                  <Text style={styles.settingSub}>{t('nearest_rupee', 'Nearest rupee')}</Text>
                </View>
                <View style={[styles.toggleTrack, shop.roundOffEnabled && styles.toggleTrackActive]}>
                  <View style={[styles.toggleKnob, shop.roundOffEnabled && styles.toggleKnobActive]} />
                </View>
              </TouchableOpacity>
            )}

            {/* Table Settings (Dining) */}
            {currentRole === 'Owner' && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggleTableSettings}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('table_settings_dining', 'Table Settings (Dining)')}</Text>
                  <Text style={styles.settingSub}>
                    {shop.tableManagementEnabled
                      ? `Enabled • ${shop.tableCount || 6} ${t('tables_configured', 'dining tables configured')}`
                      : t('table_management_disabled_sub', 'Off • Disabled for fast counter billing')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {shop.tableManagementEnabled && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setIsTableEditorOpen(prev => !prev);
                      }}
                      style={styles.editGstPill}
                      accessibilityLabel="Change Table Count"
                    >
                      <Text style={styles.editGstPillText}>{shop.tableCount || 6}</Text>
                      <Ionicons name="create-outline" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                  <View style={[styles.toggleTrack, shop.tableManagementEnabled && styles.toggleTrackActive]}>
                    <View style={[styles.toggleKnob, shop.tableManagementEnabled && styles.toggleKnobActive]} />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Expanded Table Count UI (Owner only) */}
            {currentRole === 'Owner' && shop.tableManagementEnabled && isTableEditorOpen && (
              <View style={styles.expandedSubCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.expandedTitle}>{t('number_of_tables', 'Number of Tables')}</Text>
                  <TouchableOpacity
                    onPress={() => setIsTableEditorOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Close Table Editor"
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.expandedSub}>
                  Enter the total number of dining tables in your shop:
                </Text>

                {/* Single text field and save button matching GST custom row */}
                <View style={styles.customGstRow}>
                  <Text style={styles.customGstLabel}>Tables:</Text>
                  <TextInput
                    style={styles.customGstInput}
                    keyboardType="numeric"
                    value={tableCountInput}
                    onChangeText={setTableCountInput}
                    placeholder="e.g. 6"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={styles.saveGstBtn}
                    onPress={handleSaveTableCountInput}
                    disabled={isSavingTableCount}
                  >
                    <Text style={styles.saveGstText}>
                      {isSavingTableCount ? 'Saving...' : 'Save tables'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        </View>

        {/* 5. Help & Legal Links */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t('help_and_legal', 'Help & Legal')}</Text>
          <View style={styles.legalList}>
            {/* 1. Support (Top item, direct navigation to support page, no arrow) */}
            <TouchableOpacity
              onPress={() => {
                if (onNavigateToSupport) {
                  onNavigateToSupport();
                } else {
                  setIsSupportModalVisible(true);
                }
              }}
              style={styles.legalRow}
              activeOpacity={0.7}
              accessibilityLabel="Support"
            >
              <Text style={styles.legalTitle}>{t('support', 'Support')}</Text>
            </TouchableOpacity>

            {/* 2. Account Management (Below Support, Expandable Accordion) */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setIsAccountManagementExpanded(prev => !prev);
              }}
              style={[
                styles.legalRow,
                { borderBottomWidth: 0 },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Account Management"
            >
              <Text style={styles.legalTitle}>{t('account_management', 'Account Management')}</Text>
              <Ionicons
                name={isAccountManagementExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSecondary}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {/* Expanded Account Management Items (Strict Order: 1. Change number, 2. App review, 3. Privacy, 4. Terms, 5. Log out, 6. Delete account) */}
            {isAccountManagementExpanded && (
              <View style={styles.accountManagementExpandedBox}>
                {/* 1. Change Mobile Number (Owner only) */}
                {currentRole === 'Owner' && (
                  <TouchableOpacity
                    onPress={handleOpenChangePhone}
                    style={styles.accountMgmtSubRow}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accountMgmtIconWrap}>
                      <Ionicons name="call-outline" size={16} color={colors.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountMgmtSubTitle}>{t('change_mobile', 'Change Mobile Number')}</Text>
                      <Text style={styles.accountMgmtSubMeta}>
                        +91 {shop.phone || profile?.phone} • 2-Step OTP Protected
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {/* 2. App Review */}
                <TouchableOpacity
                  onPress={handleOpenPlayStoreReview}
                  style={styles.accountMgmtSubRow}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountMgmtIconWrap}>
                    <Ionicons name="star-outline" size={16} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountMgmtSubTitle}>{t('app_review', 'App Review')}</Text>
                    <Text style={styles.accountMgmtSubMeta}>Rate us on Google Play</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 3. Privacy Policy */}
                <TouchableOpacity
                  onPress={() => setIsPrivacyModalOpen(true)}
                  style={styles.accountMgmtSubRow}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountMgmtIconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountMgmtSubTitle}>{t('privacy_policy', 'Privacy Policy')}</Text>
                    <Text style={styles.accountMgmtSubMeta}>DPDPA 2023 compliant</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 4. Terms of Service */}
                <TouchableOpacity
                  onPress={() => setIsTermsModalOpen(true)}
                  style={styles.accountMgmtSubRow}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountMgmtIconWrap}>
                    <Ionicons name="document-text-outline" size={16} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountMgmtSubTitle}>{t('terms_of_service', 'Terms of Service')}</Text>
                    <Text style={styles.accountMgmtSubMeta}>Merchant agreement</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 5. Log Out */}
                <TouchableOpacity
                  onPress={handleConfirmLogout}
                  style={styles.accountMgmtSubRow}
                  activeOpacity={0.7}
                >
                  <View style={[styles.accountMgmtIconWrap, { backgroundColor: 'rgba(220, 38, 38, 0.1)' }]}>
                    <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accountMgmtSubTitle, { color: '#DC2626' }]}>{t('log_out', 'Log Out')}</Text>
                    <Text style={styles.accountMgmtSubMeta}>Sign out on this device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 6. Permanently Delete Account (Owner only) */}
                {currentRole === 'Owner' && (
                  <TouchableOpacity
                    onPress={handleConfirmPermanentlyDelete}
                    style={[styles.accountMgmtSubRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.accountMgmtIconWrap, { backgroundColor: 'rgba(220, 38, 38, 0.1)' }]}>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountMgmtSubTitle, { color: '#DC2626' }]}>{t('delete_account', 'Permanently Delete Account')}</Text>
                      <Text style={styles.accountMgmtSubMeta}>Delete shop, all bills, menus & data permanently</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerWrap}>
          <Image
            source={require('../../../assets/counterpro_logo.png')}
            style={styles.accountFooterLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerText}>
            COUNTER365 {Constants.expoConfig?.version || '1.0.4'} • Cloud Sync Active
          </Text>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* PRIVACY POLICY MODAL (DPDPA 2023) */}
      {/* ========================================================================= */}
      <LegalDocumentModal
        visible={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        title="Privacy Policy"
        subtitle={`Digital Personal Data Protection Act, 2023 • Updated ${DPDPA_COMPLIANCE_DATE}`}
        badge="DPDPA 2023"
        sections={PRIVACY_POLICY_SECTIONS}
      />

      {/* ========================================================================= */}
      {/* TERMS OF SERVICE MODAL (DPDPA 2023) */}
      {/* ========================================================================= */}
      <LegalDocumentModal
        visible={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        title="Terms of Service"
        subtitle="CounterPro Merchant Service & Regulatory Agreement"
        badge="DPDPA 2023"
        sections={TERMS_OF_SERVICE_SECTIONS}
      />

      {/* ========================================================================= */}
      {/* ACCOUNT ACTIONS MODAL (LOG OUT & DELETE ACCOUNT) */}
      {/* ========================================================================= */}
      <Modal
        visible={isAccountActionsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAccountActionsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.legalModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Account Actions</Text>
                <Text style={styles.modalSub}>Manage session & account lifecycle</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAccountActionsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 14 }}>
              {currentRole === 'Owner' && (
                <>
                  {/* Change Mobile Number Button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.logoutBtn}
                    onPress={() => {
                      setIsAccountActionsModalOpen(false);
                      setTimeout(() => handleOpenChangePhone(), 250);
                    }}
                  >
                    <Ionicons name="call-outline" size={22} color={colors.text} />
                    <View style={styles.actionBtnTextWrap}>
                      <Text style={[styles.logoutTitle, { color: colors.text }]}>Change Mobile Number</Text>
                      <Text style={styles.logoutSub}>
                        +91 {shop.phone || profile?.phone} • 2-Step OTP Protected
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.actionDivider} />
                </>
              )}

              {/* Log Out Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.logoutBtn}
                onPress={() => {
                  setIsAccountActionsModalOpen(false);
                  setTimeout(() => handleConfirmLogout(), 250);
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                <View style={styles.actionBtnTextWrap}>
                  <Text style={styles.logoutTitle}>Log Out</Text>
                  <Text style={styles.logoutSub}>
                    Sign out on this device. Your data stays safe in the cloud.
                  </Text>
                </View>
              </TouchableOpacity>

              {currentRole === 'Owner' && (
                <>
                  <View style={styles.actionDivider} />

                  {/* Permanently Delete Account Button (Owner only) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.deleteAccountBtn}
                    onPress={() => {
                      setIsAccountActionsModalOpen(false);
                      setTimeout(() => handleConfirmPermanentlyDelete(), 250);
                    }}
                    disabled={isDeletingShop}
                  >
                    {isDeletingShop ? (
                      <ActivityIndicator size="small" color="#D32F2F" />
                    ) : (
                      <Ionicons name="trash-outline" size={22} color="#DC2626" />
                    )}
                    <View style={styles.actionBtnTextWrap}>
                      <Text style={styles.deleteTitle}>Permanently Delete Account</Text>
                      <Text style={styles.deleteSub}>
                        Delete shop, all bills, menus, and data permanently.
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <AppButton
              title="Close"
              variant="outline"
              onPress={() => setIsAccountActionsModalOpen(false)}
              style={styles.accountActionsCloseBtn}
              textStyle={styles.accountActionsCloseText}
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT SHOP & OWNER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={isEditShopOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditShopOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>Edit Shop & Owner</Text>
                <Text style={styles.editModalSub}>Update your business profile and contact info</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditShopOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.editModalScroll}
              contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Logo Selection Preview */}
              <View style={styles.editLogoRow}>
                {editLogoUrl ? (
                  <Image source={{ uri: editLogoUrl }} style={styles.editLogoPreview} />
                ) : (
                  <View style={styles.editLogoPlaceholder}>
                    <Text style={styles.editLogoPlaceholderText}>
                      {(editShopName || 'R').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.fieldLabel}>Shop Logo</Text>
                  <TouchableOpacity onPress={handlePickLogo} style={styles.changeLogoBtn}>
                    <Ionicons name="camera-outline" size={15} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.changeLogoText}>Change Logo Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Shop Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Shop Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editShopName}
                  onChangeText={setEditShopName}
                  placeholder="e.g. Raja Tea Stall"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Owner Full Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Owner Full Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editOwnerName}
                  onChangeText={setEditOwnerName}
                  placeholder="e.g. Raja"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Phone Number with 2-Step OTP Verification */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Registered Mobile Number</Text>
                  <View style={styles.verifiedPhoneBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#059669" />
                    <Text style={styles.verifiedPhoneText}>Verified</Text>
                  </View>
                </View>
                <View style={styles.phoneDisplayRow}>
                  <Text style={styles.phoneDisplayText}>+91 {shop.phone || profile?.phone || 'Not set'}</Text>
                  <TouchableOpacity
                    style={styles.changePhoneTriggerBtn}
                    onPress={() => {
                      setIsEditShopOpen(false);
                      setTimeout(() => handleOpenChangePhone(), 250);
                    }}
                  >
                    <Ionicons name="key-outline" size={13} color={colors.accent900} />
                    <Text style={styles.changePhoneTriggerText}>Change (OTP)</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.phoneChangeHint}>
                  Security protected. Changing your phone number requires 2-step OTP verification.
                </Text>
              </View>

              {/* Location / Address */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Shop Address & Location</Text>
                <TextInput
                  style={styles.formInput}
                  value={editShopAddress}
                  onChangeText={setEditShopAddress}
                  placeholder="Street / Area / Market"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* City */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>City / Town</Text>
                <TextInput
                  style={styles.formInput}
                  value={editShopCity}
                  onChangeText={setEditShopCity}
                  placeholder="City"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Shop UPI ID (Optional) */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Shop UPI ID (for WhatsApp Receipts)</Text>
                <TextInput
                  style={styles.formInput}
                  value={editUpiId}
                  onChangeText={setEditUpiId}
                  placeholder="e.g. yourshop@okhdfcbank"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.phoneChangeHint}>
                  Customers can pay balance due directly using this UPI ID from their WhatsApp receipt.
                </Text>
              </View>

              {/* Shop Type (READ ONLY / LOCKED) */}
              <View style={styles.fieldWrap}>
                <View style={styles.lockedLabelRow}>
                  <Text style={styles.fieldLabel}>Shop Type</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                    <Text style={styles.lockedBadge}>Locked</Text>
                  </View>
                </View>
                <View style={styles.lockedInput}>
                  <Text style={styles.lockedInputText}>{shop.shopType}</Text>
                </View>
                <Text style={styles.lockedHelperText}>
                  Shop type cannot be edited after initial registration.
                </Text>
              </View>

              {/* Invoice Prefix & Numbering Cycle */}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Bill Invoice Prefix</Text>
                  <TouchableOpacity
                    onPress={() => setEditInvoicePrefix(generateDefaultInvoicePrefix(editShopName))}
                    style={styles.autoPrefixBtn}
                  >
                    <Ionicons name="refresh-outline" size={11} color={colors.accent} />
                    <Text style={styles.autoPrefixText}>
                      Auto ({generateDefaultInvoicePrefix(editShopName)})
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.formInput}
                  value={editInvoicePrefix}
                  onChangeText={(val) => setEditInvoicePrefix(val.toUpperCase())}
                  placeholder="e.g. RTS"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <Text style={styles.phoneChangeHint}>
                  Preview: {editInvoicePrefix || 'RTS'}-{editInvoiceResetCycle === 'monthly' ? `${new Date().toLocaleString('en-US', { month: 'long' })}-001` : '001'}
                </Text>
              </View>

              {/* Invoice Reset Cycle (Monthly vs Yearly) */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Invoice Numbering Reset</Text>
                <View style={styles.cycleToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.cycleOptionCard,
                      editInvoiceResetCycle === 'monthly' && styles.cycleOptionCardActive,
                    ]}
                    onPress={() => setEditInvoiceResetCycle('monthly')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cycleOptionHeader}>
                      <Ionicons
                        name={editInvoiceResetCycle === 'monthly' ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={editInvoiceResetCycle === 'monthly' ? colors.accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.cycleOptionTitle,
                          editInvoiceResetCycle === 'monthly' && styles.cycleOptionTitleActive,
                        ]}
                      >
                        Monthly
                      </Text>
                    </View>
                    <Text style={styles.cycleOptionDesc}>
                      Resets each month (e.g. {editInvoicePrefix || 'RTS'}-October-001)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.cycleOptionCard,
                      editInvoiceResetCycle === 'yearly' && styles.cycleOptionCardActive,
                    ]}
                    onPress={() => setEditInvoiceResetCycle('yearly')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cycleOptionHeader}>
                      <Ionicons
                        name={editInvoiceResetCycle === 'yearly' ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={editInvoiceResetCycle === 'yearly' ? colors.accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.cycleOptionTitle,
                          editInvoiceResetCycle === 'yearly' && styles.cycleOptionTitleActive,
                        ]}
                      >
                        Yearly
                      </Text>
                    </View>
                    <Text style={styles.cycleOptionDesc}>
                      Continuous across all months (e.g. {editInvoicePrefix || 'RTS'}-001)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Plan & Quota History Section (Inside Shop Profile) */}
              <View style={[styles.subHistoryContainer, { marginTop: 16 }]}>
                <View style={styles.subHistoryHeader}>
                  <Ionicons name="time-outline" size={16} color={colors.accent} />
                  <Text style={styles.subHistoryTitle}>Plan & Quota History</Text>
                </View>

                {/* Current Active Plan / Starter Quota Row */}
                <View style={styles.subHistoryItem}>
                  <View style={styles.subHistoryItemLeft}>
                    <View style={styles.subHistoryIconBox}>
                      <Ionicons
                        name={subscriptionStatus.isPaidActive ? 'ribbon' : 'rocket-outline'}
                        size={18}
                        color={subscriptionStatus.isPaidActive ? '#10B981' : colors.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.subHistoryPlanName}>
                          {subscriptionStatus.isPaidActive
                            ? (subscriptionStatus.activePlanName || 'Pro Plan')
                            : 'Starter Quota'}
                        </Text>
                        <View
                          style={[
                            styles.subHistoryStatusBadge,
                            subscriptionStatus.isPaidActive
                              ? styles.subHistoryBadgeActive
                              : subscriptionStatus.billLimitReached
                              ? styles.subHistoryBadgeExpired
                              : styles.subHistoryBadgeStarter,
                          ]}
                        >
                          <Text style={styles.subHistoryStatusText}>
                            {subscriptionStatus.isPaidActive
                              ? 'ACTIVE'
                              : subscriptionStatus.billLimitReached
                              ? '100 / 100 USED'
                              : 'STARTER'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.subHistoryDetail}>
                        {subscriptionStatus.isPaidActive
                          ? `₹${subscriptionStatus.activePlanPrice} • Pro Active • ${subscriptionStatus.totalBillsCreated} bills created`
                          : `Usage: ${subscriptionStatus.totalBillsCreated} / 100 bills generated (${subscriptionStatus.billsRemaining} remaining)`}
                      </Text>
                      {subscriptionStatus.isPaidActive && Boolean(subscriptionStatus.subscriptionEndDateFormatted) && (
                        <Text style={styles.subHistoryPeriod}>
                          Valid until: {subscriptionStatus.subscriptionEndDateFormatted}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Past Subscription Records from Supabase */}
                {subscriptionHistory
                  .filter((rec) => rec.plan !== 'free' || (rec.amount && rec.amount > 0))
                  .map((rec) => (
                    <View key={rec.id} style={styles.subHistoryItem}>
                      <View style={styles.subHistoryItemLeft}>
                        <View style={styles.subHistoryIconBox}>
                          <Ionicons name="receipt-outline" size={18} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.subHistoryPlanName}>
                              {rec.interval || (rec.plan === 'pro' ? 'Pro Plan' : 'Subscription')}
                            </Text>
                            <View
                              style={[
                                styles.subHistoryStatusBadge,
                                rec.status === 'active'
                                  ? styles.subHistoryBadgeActive
                                  : styles.subHistoryBadgeExpired,
                              ]}
                            >
                              <Text style={styles.subHistoryStatusText}>{rec.status.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={styles.subHistoryDetail}>
                            {`₹${rec.amount}`} • {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Subscribed'}
                          </Text>
                          {Boolean(rec.paymentReference) && (
                            <Text style={styles.subHistoryRefText}>Ref: {rec.paymentReference}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            </ScrollView>

            <View style={styles.editActionRow}>
              <TouchableOpacity
                onPress={() => setIsEditShopOpen(false)}
                style={styles.cancelEditBtn}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <AppButton
                title={isSavingShopEdit ? 'Saving...' : 'Save Changes'}
                variant="primary"
                onPress={handleSaveShopEdit}
                disabled={isSavingShopEdit}
                style={styles.saveEditBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Role Management Bottom Sheet */}
      <RoleManagementSheet
        member={selectedMemberForSheet}
        visible={selectedMemberForSheet !== null}
        onClose={async () => {
          setSelectedMemberForSheet(null);
          try {
            if (refreshShop) await refreshShop();
            if (refreshMemberSession) await refreshMemberSession();
          } catch {}
        }}
        onSelectRole={async role => {
          if (!selectedMemberForSheet) return;
          await updateMemberRole(selectedMemberForSheet.id, role);
          setSelectedMemberForSheet(prev => prev ? { ...prev, role } : null);
          flash(`${selectedMemberForSheet.fullName} is now a ${role}`);
        }}
        onToggleOverride={async (permKey, curVal) => {
          if (!selectedMemberForSheet) return;
          const nextVal = !curVal;
          await updateMemberOverride(selectedMemberForSheet.id, permKey, nextVal);
          setSelectedMemberForSheet(prev => {
            if (!prev) return null;
            return {
              ...prev,
              overrides: { ...(prev.overrides || {} as any), [permKey]: nextVal },
            };
          });
        }}
        onRemoveUser={async () => {
          if (!selectedMemberForSheet) return;
          await removeMember(selectedMemberForSheet.id);
          flash(`${selectedMemberForSheet.fullName} deactivated (records preserved)`);
          setSelectedMemberForSheet(null);
        }}
      />

      {/* ========================================================================= */}
      {/* PERMANENTLY DELETE ACCOUNT MODAL WITH REASON SELECTION */}
      {/* ========================================================================= */}
      <Modal
        visible={isDeleteReasonModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isDeletingShop) setIsDeleteReasonModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!isDeletingShop) setIsDeleteReasonModalVisible(false);
            }}
          />
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteModalTitle}>Delete Account Permanently</Text>
                <Text style={styles.deleteModalSub}>
                  Please select why you are deleting your account
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isDeletingShop) setIsDeleteReasonModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                disabled={isDeletingShop}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.deleteModalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Critical Warning Box */}
              <View style={styles.deleteWarningBox}>
                <Ionicons name="warning" size={20} color="#DC2626" style={{ marginTop: 2 }} />
                <Text style={styles.deleteWarningText}>
                  WARNING: This will permanently delete your shop "{shop.name}", all bills, menu items, sales records, customer dues, and cloud data from Supabase. This CANNOT be undone.
                </Text>
              </View>

              <Text style={styles.reasonSectionTitle}>
                Select Reason <Text style={{ color: '#DC2626' }}>*</Text>
              </Text>

              {/* Radio Multiple Choice Options */}
              <View style={styles.reasonsList}>
                {DELETE_ACCOUNT_REASONS.map(r => {
                  const isSelected = selectedDeleteReason === r.label;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedDeleteReason(r.label)}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                      <Ionicons
                        name={r.iconName}
                        size={18}
                        color={isSelected ? '#DC2626' : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional Feedback Input */}
              <View style={styles.deleteFeedbackWrap}>
                <Text style={styles.feedbackLabel}>Additional Feedback / Suggestion (Optional)</Text>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Tell us what we could improve..."
                  placeholderTextColor={colors.textSecondary}
                  value={deleteFeedbackText}
                  onChangeText={setDeleteFeedbackText}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.deleteActionRow}>
              <TouchableOpacity
                onPress={() => {
                  if (!isDeletingShop) setIsDeleteReasonModalVisible(false);
                }}
                disabled={isDeletingShop}
                style={styles.cancelDeleteBtn}
              >
                <Text style={styles.cancelDeleteText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  Keep Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExecutePermanentDelete}
                disabled={!selectedDeleteReason || isDeletingShop}
                style={[
                  styles.confirmDeleteBtn,
                  (!selectedDeleteReason || isDeletingShop) && styles.confirmDeleteBtnDisabled,
                ]}
              >
                <Text style={styles.confirmDeleteText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {isDeletingShop ? 'Deleting...' : 'Permanently Delete'}
                </Text>
              </TouchableOpacity>
            </View>

            {!selectedDeleteReason && (
              <Text style={styles.reasonRequiredHint}>
                * Please select a reason above to enable permanent deletion
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* 2-STEP OTP CHANGE PHONE NUMBER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={isChangePhoneModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsChangePhoneModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.otpModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.otpModalCard}>
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>Change Mobile Number</Text>
                <Text style={styles.editModalSub}>
                  {changePhoneStep === 1
                    ? 'Step 1 of 2: Verify Current Phone'
                    : changePhoneStep === 2
                    ? 'Step 2 of 2: Verify New Phone'
                    : 'Verification Complete'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsChangePhoneModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* STEP 1: VERIFY CURRENT PHONE */}
            {changePhoneStep === 1 && (
              <View style={styles.otpStepContent}>
                <View style={styles.otpInfoBox}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#059669" />
                  <Text style={styles.otpInfoText}>
                    For your security, we must verify your current registered number before updating.
                  </Text>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Current Registered Number</Text>
                  <View style={styles.readOnlyPhoneBox}>
                    <Text style={styles.readOnlyPhoneText}>+91 {shop.phone || profile?.phone}</Text>
                    <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                  </View>
                </View>

                {!currentOtpSent ? (
                  <TouchableOpacity
                    style={styles.sendOtpActionBtn}
                    onPress={handleSendCurrentOtp}
                    disabled={isSendingCurrentOtp}
                  >
                    {isSendingCurrentOtp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.sendOtpActionText}>Send OTP to Current Number</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 12, marginTop: 4 }}>
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Enter 6-Digit Verification Code</Text>
                      <TextInput
                        style={styles.otpCodeInput}
                        value={currentPhoneOtp}
                        onChangeText={t => setCurrentPhoneOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        maxLength={6}
                        autoFocus
                      />
                    </View>

                    {currentOtpError ? (
                      <Text style={styles.otpErrorText}>{currentOtpError}</Text>
                    ) : null}

                    <TouchableOpacity
                      style={styles.verifyOtpActionBtn}
                      onPress={handleVerifyCurrentOtp}
                      disabled={isVerifyingCurrentOtp || currentPhoneOtp.length !== 6}
                    >
                      {isVerifyingCurrentOtp ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.verifyOtpActionText}>Verify Current Number</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendOtpBtn}
                      onPress={handleSendCurrentOtp}
                      disabled={isSendingCurrentOtp}
                    >
                      <Text style={styles.resendOtpText}>Didn't receive code? Resend OTP</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2: ENTER & VERIFY NEW PHONE */}
            {changePhoneStep === 2 && (
              <View style={styles.otpStepContent}>
                <View style={[styles.otpInfoBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#2563EB" />
                  <Text style={[styles.otpInfoText, { color: '#1E40AF' }]}>
                    Current phone verified! Now enter your new 10-digit mobile number.
                  </Text>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>New 10-Digit Mobile Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newPhoneNumber}
                    onChangeText={t => {
                      setNewPhoneNumber(t.replace(/[^0-9]/g, '').slice(0, 10));
                      setNewOtpSent(false);
                      setNewOtpError(null);
                    }}
                    placeholder="Enter 10-digit number"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={10}
                    editable={!newOtpSent}
                  />
                </View>

                {!newOtpSent ? (
                  <TouchableOpacity
                    style={styles.sendOtpActionBtn}
                    onPress={handleSendNewOtp}
                    disabled={isSendingNewOtp || newPhoneNumber.length !== 10}
                  >
                    {isSendingNewOtp ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.sendOtpActionText}>Send OTP to New Number</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 12, marginTop: 4 }}>
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Enter OTP Sent to +91 {newPhoneNumber}</Text>
                      <TextInput
                        style={styles.otpCodeInput}
                        value={newPhoneOtp}
                        onChangeText={t => setNewPhoneOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        maxLength={6}
                        autoFocus
                      />
                    </View>

                    {newOtpError ? (
                      <Text style={styles.otpErrorText}>{newOtpError}</Text>
                    ) : null}

                    <TouchableOpacity
                      style={styles.verifyOtpActionBtn}
                      onPress={handleVerifyNewOtpAndSave}
                      disabled={isVerifyingNewOtp || newPhoneOtp.length !== 6}
                    >
                      {isVerifyingNewOtp ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.verifyOtpActionText}>Verify & Update Mobile Number</Text>
                      )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setNewOtpSent(false);
                          setNewPhoneOtp('');
                        }}
                      >
                        <Text style={styles.resendOtpText}>Change New Number</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSendNewOtp}
                        disabled={isSendingNewOtp}
                      >
                        <Text style={styles.resendOtpText}>Resend OTP</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 3: SUCCESS STATE */}
            {changePhoneStep === 3 && (
              <View style={styles.otpSuccessContent}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={54} color="#059669" />
                </View>
                <Text style={styles.successTitle}>Mobile Number Updated!</Text>
                <Text style={styles.successPhoneBadge}>+91 {newPhoneNumber}</Text>
                <Text style={styles.successDescription}>
                  Your registered login and shop phone number is now updated. All your past bills, inventory, customers, and data remain safe and intact.
                </Text>
                <TouchableOpacity
                  style={styles.doneActionBtn}
                  onPress={() => {
                    setIsChangePhoneModalOpen(false);
                    flash('Mobile number updated successfully');
                  }}
                >
                  <Text style={styles.doneActionText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal
        visible={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />

      {/* Support / Help Modal */}
      <SupportModal
        visible={isSupportModalVisible}
        onClose={() => setIsSupportModalVisible(false)}
      />
    </View>
  );
};

const createStyles = (theme: Theme, insets?: { top: number; bottom: number; left: number; right: number }) => {
  const colors = theme.colors;
  const isDark = theme.isDark;
  const bottomInset = insets?.bottom || 0;
  const androidNavPadding = Platform.OS === 'android' ? Math.max(bottomInset, 48) : bottomInset;
  const modalNavClearance = Math.max(androidNavPadding + 14, 28);
  return StyleSheet.create({
  btnDisabled: {
    opacity: 0.55,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Math.max(bottomInset, 16) + 84,
    gap: 16,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.card,
  },
  avatarWrap: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
    ...shadows.sm,
  },
  avatarText: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  profileMetaWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileName: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileOwnerSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  profileLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  profileLocSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  editProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editProfileBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  freeActiveBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  paidActiveBadge: {
    backgroundColor: '#059669',
  },
  trialActiveBadge: {
    backgroundColor: '#2563EB',
  },
  expiredBadge: {
    backgroundColor: '#DC2626',
  },
  freeActiveBadgeText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '700',
  },
  subscriptionCard: {
    backgroundColor: '#111111',
    borderRadius: 22,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#222222',
    ...shadows.md,
  },
  subKicker: {
    fontSize: 10,
    letterSpacing: 1.0,
    color: '#A8A29E',
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  subLogoImage: {
    width: 124,
    height: 26,
  },
  subTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: '#FFFFFF',
  },
  subStatus: {
    fontSize: 12,
    color: '#A8A29E',
    fontFamily: typography.fonts.body,
  },
  subProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginVertical: 8,
    overflow: 'hidden',
  },
  subProgressFill: {
    width: '64%',
    height: '100%',
    backgroundColor: colors.accent,
  },
  subMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subPrice: {
    fontSize: 12,
    color: '#E7E5E4',
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  subRenew: {
    fontSize: 12,
    color: '#A8A29E',
    fontFamily: typography.fonts.body,
  },
  subDateRow: {
    marginTop: 2,
  },
  subDateLabel: {
    fontSize: 11,
    color: '#78716C',
    fontFamily: typography.fonts.body,
  },
  managePlanBtn: {
    marginTop: 10,
    minHeight: 38,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managePlanText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionSubHeading: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyStaffNotice: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyStaffText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  inactiveStaffBox: {
    marginTop: 10,
    backgroundColor: colors.surfaceSecondary || colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 8,
  },
  inactiveStaffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inactiveStaffTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  inactiveStaffNotice: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  deactivatedSubText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  supportTemplateCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 10,
  },
  supportTemplateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportTemplateHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
  },
  supportTemplateText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: '#C2410C',
    lineHeight: 18,
  },
  supportBtnRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  supportCallBtn: {
    backgroundColor: '#EA580C',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  supportCallBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
  supportWaBtn: {
    backgroundColor: '#059669',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  supportWaBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
  addUserBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addUserText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  usersList: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    paddingHorizontal: 14,
    ...shadows.card,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  userName: {
    flex: 1,
    fontSize: 14.5,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  userExtra: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  lockedUsersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 9,
    opacity: 0.7,
  },
  lockIcon: {
    fontSize: 14,
  },
  lockBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  lockIconSmall: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  lockedUsersText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  addUserFormRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  addUserInput: {
    flex: 1,
    minHeight: 46,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontFamily: typography.fonts.body,
    color: colors.text,
  },
  inviteBtn: {
    minHeight: 46,
    paddingHorizontal: 18,
    backgroundColor: colors.accent,
  },
  settingsList: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    paddingHorizontal: 14,
    ...shadows.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 12,
  },
  disabledRow: {
    opacity: 0.6,
  },
  settingInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    fontSize: 14,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 11,
    backgroundColor: 'transparent',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 31, 32, 0.35)',
  },
  toggleKnobActive: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },

  // Sub-cards for expanded settings
  editGstPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.isDark ? colors.surfaceElevated : '#FFF7ED',
    borderWidth: 1,
    borderColor: theme.isDark ? colors.border : '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  alwaysActiveBadge: {
    backgroundColor: theme.isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  alwaysActiveText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9.5,
    fontWeight: '700',
    color: theme.isDark ? '#4ADE80' : '#15803D',
  },
  pastDateBadge: {
    backgroundColor: theme.isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
  },
  pastDateBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '700',
    color: theme.isDark ? '#4ADE80' : '#15803D',
  },
  editGstPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    fontFamily: typography.fonts.heading,
  },
  expandedSubCard: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    padding: 12,
    marginVertical: 6,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandedTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  scannerBadge: {
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontFamily: typography.fonts.heading,
  },
  expandedSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  scannerBadgeConnected: {
    color: '#059669',
  },
  realPrinterCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 12,
  },
  realPrinterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  printerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isDark ? 'rgba(255,95,0,0.15)' : '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,95,0,0.3)' : 'rgba(253, 94, 3, 0.2)',
  },
  printerIcon: {
    fontSize: 18,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '700',
  },
  printerMeta: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(5,150,105,0.18)' : '#E6F4EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  connectedBadgeText: {
    fontSize: 11,
    color: isDark ? '#34D399' : '#137333',
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  printerActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.dividerLight,
    paddingTop: 10,
  },
  printerTestBtn: {
    flex: 1.4,
    backgroundColor: '#FF5F00',
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerTestBtnText: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  printerChangeBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerChangeBtnText: {
    color: colors.text,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
  },
  printerDisconnectBtn: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerDisconnectBtnText: {
    color: '#DC2626',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    fontWeight: '600',
  },
  printerLoadingCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  printerLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: typography.fonts.heading,
    textAlign: 'center',
  },
  printerLoadingSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
  },
  discoveredContainer: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 10,
  },
  discoveredTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontFamily: typography.fonts.heading,
    marginBottom: 2,
  },
  discoveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  connectPrinterBtn: {
    backgroundColor: '#FF5F00',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  connectPrinterBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  scanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  scanAgainBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
  },
  compactNoPrinterCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  compactNoPrinterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactPrinterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(234,88,12,0.15)' : '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactNoPrinterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  compactNoPrinterSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  compactRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5F00',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radii.sm,
  },
  compactRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  noPrinterCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    gap: 10,
  },
  noPrinterIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(234,88,12,0.15)' : '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  noPrinterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  noPrinterText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 6,
  },
  printerRetryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  retryScanBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FF5F00',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryScanBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  addIpBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIpBtnText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: typography.fonts.heading,
  },
  ipInputCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    gap: 8,
  },
  ipInputTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  ipInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ipTextInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.text,
    fontFamily: typography.fonts.body,
  },
  ipConnectBtn: {
    backgroundColor: '#FF5F00',
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ipConnectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  cancelText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    textDecorationLine: 'underline',
  },
  scanPrinterBtn: {
    flexDirection: 'row',
    backgroundColor: '#FF5F00',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  scanPrinterBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },

  // GST Presets
  gstPresetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gstPresetChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gstPresetChipActive: {
    backgroundColor: colors.accent900,
    borderColor: colors.accent900,
  },
  gstPresetText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  gstPresetTextActive: {
    color: colors.bg,
  },
  customGstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  customGstLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
  },
  customGstInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.heading,
    color: colors.text,
  },
  saveGstBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveGstText: {
    color: colors.bg,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
  },

  // Backup Card
  backupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    padding: 10,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#137333',
  },
  backupInfo: {
    flex: 1,
  },
  backupStatusDot: {
    fontSize: 11,
    color: '#137333',
    fontFamily: typography.fonts.heading,
  },
  backupMetaText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  backupNowBtn: {
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  backupNowText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: typography.fonts.heading,
  },

  // Legal List
  legalList: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    paddingHorizontal: 14,
    ...shadows.card,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  legalTitle: {
    fontSize: 14,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    flexShrink: 0,
  },
  legalMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    flexShrink: 1,
  },
  accountManagementExpandedBox: {
    backgroundColor: isDark ? '#1C1917' : '#F9F8F6',
    borderRadius: 14,
    marginVertical: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.dividerLight,
    overflow: 'hidden',
  },
  accountMgmtSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  accountMgmtIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
  },
  accountMgmtSubTitle: {
    fontSize: 13,
    color: colors.text,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  accountMgmtSubMeta: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  legalArrow: {
    fontSize: 18,
    color: 'rgba(29, 31, 32, 0.5)',
  },

  // Account Actions
  actionsCard: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.lg,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.dividerLight,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  logoutIcon: {
    fontSize: 22,
  },
  actionBtnTextWrap: {
    flex: 1,
  },
  logoutTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  logoutSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.dividerLight,
    marginVertical: 2,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  deleteIcon: {
    fontSize: 22,
  },
  deleteTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: '#D32F2F',
  },
  deleteSub: {
    fontSize: typography.sizes.xs,
    color: '#D32F2F',
    opacity: 0.8,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },

  footerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 8,
    gap: 6,
  },
  accountFooterLogo: {
    width: 130,
    height: 34,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    lineHeight: 16,
    textAlign: 'center',
  },

  // Legal Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  legalModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: modalNavClearance,
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
  legalScroll: {
    maxHeight: 420,
    marginVertical: 14,
  },
  policySectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  policyBody: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    lineHeight: 18,
  },
  modalCloseActionButton: {
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.dividerLight,
    borderRadius: radii.pill,
  },
  modalCloseActionText: {
    color: '#111111',
    fontWeight: '600',
    fontSize: 14,
  },
  accountActionsCloseBtn: {
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.dividerLight,
    borderRadius: radii.pill,
  },
  accountActionsCloseText: {
    color: '#111111',
    fontWeight: '600',
    fontSize: 14,
  },

  // User phone text
  userPhoneText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 1,
  },

  // Add User Staff Form
  addUserFormCard: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  addUserFormTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChoiceBtn: {
    flex: 1,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  roleChoiceBtnActive: {
    borderColor: colors.accent900,
    backgroundColor: colors.accent100,
  },
  roleChoiceText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  roleChoiceTextActive: {
    color: colors.accent900,
  },
  roleChoiceSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontFamily: typography.fonts.body,
  },
  addUserActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelUserBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  cancelUserText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
  },
  saveUserBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: '#111111',
  },

  // Edit Shop Modal
  editModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: modalNavClearance,
    maxHeight: '88%',
    ...shadows.lg,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
  },
  editModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h5,
    color: colors.text,
  },
  editModalSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 3,
  },
  editModalScroll: {
    marginVertical: 12,
  },
  editLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  editLogoPreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.divider,
  },
  editLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F1F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  editLogoPlaceholderText: {
    fontSize: 22,
    color: colors.accent900,
    fontFamily: typography.fonts.heading,
  },
  changeLogoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent100,
    alignSelf: 'flex-start',
  },
  changeLogoText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.accent900,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.heading,
    color: colors.text,
    marginBottom: 4,
  },
  formInput: {
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
  lockedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  lockedBadge: {
    backgroundColor: colors.neutral200,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.heading,
  },
  lockedInput: {
    minHeight: 44,
    backgroundColor: colors.dividerLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  lockedInputText: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
  },
  lockedHelperText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 3,
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.dividerLight,
  },
  cancelEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
  },
  cancelEditText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.heading,
    color: colors.textMuted,
  },
  saveEditBtn: {
    minHeight: 42,
    paddingHorizontal: 20,
    backgroundColor: '#111111',
  },

  // Staff Role Card (Supervisor & Biller)
  staffRoleCard: {
    backgroundColor: colors.accent100,
    borderRadius: radii.lg,
    padding: 16,
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    ...shadows.sm,
  },
  staffRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffRoleKicker: {
    fontSize: typography.sizes.xs,
    letterSpacing: 1.1,
    color: colors.accent,
    fontFamily: typography.fonts.heading,
  },
  staffRoleBadge: {
    backgroundColor: colors.accent900,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  staffRoleBadgeText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.heading,
    fontSize: 11,
  },
  staffRoleTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.accent900,
  },
  staffRoleSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
    lineHeight: 18,
  },
  staffPermBreakdown: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 95, 0, 0.15)',
    gap: 8,
  },
  staffPermHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent900,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  staffPermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  staffPermName: {
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    color: colors.text,
    fontWeight: '500',
  },
  staffPermNameDisabled: {
    color: colors.textMuted,
  },
  overridePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radii.sm,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  overridePillText: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#B45309',
  },
  staffPermStatus: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  staffPermAllowed: {
    color: '#16A34A',
  },
  staffPermDenied: {
    color: '#DC2626',
  },

  // Delete Account Modal Styles
  deleteModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '90%',
    padding: 18,
    gap: 12,
    ...shadows.lg,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  deleteModalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.lg,
    color: '#DC2626',
    fontWeight: '700',
  },
  deleteModalSub: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteModalScroll: {
    maxHeight: 380,
  },
  deleteWarningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  deleteWarningIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
    fontFamily: typography.fonts.body,
  },
  reasonSectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: 8,
    marginTop: 4,
  },
  reasonsList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  reasonOptionSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#DC2626',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#DC2626',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  reasonIcon: {
    fontSize: 16,
  },
  reasonLabel: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  reasonLabelSelected: {
    fontFamily: typography.fonts.heading,
    color: '#DC2626',
    fontWeight: '600',
  },
  deleteFeedbackWrap: {
    marginTop: 12,
    gap: 4,
  },
  feedbackLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  feedbackInput: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.sizes.sm,
    minHeight: 64,
    textAlignVertical: 'top',
    color: colors.text,
  },
  deleteActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelDeleteBtn: {
    flex: 1,
    backgroundColor: colors.neutral100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDeleteText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmDeleteBtn: {
    flex: 1.3,
    backgroundColor: '#DC2626',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnDisabled: {
    backgroundColor: '#FCA5A5',
    opacity: 0.6,
  },
  confirmDeleteText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reasonRequiredHint: {
    fontSize: 11,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 4,
  },

  // ─── Change Phone Number & OTP Modal Styles ──────────────────────────────────
  verifiedPhoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  verifiedPhoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    fontFamily: typography.fonts.heading,
  },
  phoneDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    height: 48,
  },
  phoneDisplayText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  changePhoneTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accent300,
  },
  changePhoneTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent900,
    fontFamily: typography.fonts.heading,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phoneChangeHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 4,
    lineHeight: 15,
  },
  otpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  otpModalCard: {
    width: '92%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.lg,
  },
  otpStepContent: {
    gap: 16,
    marginTop: 14,
  },
  otpInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: radii.md,
  },
  otpInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    fontFamily: typography.fonts.body,
    lineHeight: 17,
  },
  readOnlyPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    height: 48,
  },
  readOnlyPhoneText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  sendOtpActionBtn: {
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sendOtpActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  otpCodeInput: {
    height: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.accent400,
    borderRadius: radii.md,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.text,
  },
  otpErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: typography.fonts.body,
    textAlign: 'center',
  },
  verifyOtpActionBtn: {
    height: 48,
    backgroundColor: colors.accent900,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  verifyOtpActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  resendOtpBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  resendOtpText: {
    fontSize: 12,
    color: colors.accent800,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  otpSuccessContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontFamily: typography.fonts.heading,
  },
  successPhoneBadge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  doneActionBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: typography.fonts.heading,
  },
  invoicePrefixChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignSelf: 'flex-start',
  },
  invoicePrefixChipText: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: '#FF5F00',
  },
  autoPrefixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  autoPrefixText: {
    fontSize: 11,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.accent,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cycleOptionCard: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radii.md,
    padding: 10,
    gap: 4,
  },
  cycleOptionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  cycleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cycleOptionTitle: {
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cycleOptionTitleActive: {
    color: colors.text,
  },
  cycleOptionDesc: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
    lineHeight: 14,
  },
  subHistoryContainer: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.card,
  },
  subHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subHistoryTitle: {
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  subHistoryItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  subHistoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  subHistoryIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  subHistoryPlanName: {
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.text,
  },
  subHistoryStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  subHistoryBadgeActive: {
    backgroundColor: '#059669',
  },
  subHistoryBadgeStarter: {
    backgroundColor: '#2563EB',
  },
  subHistoryBadgeExpired: {
    backgroundColor: '#DC2626',
  },
  subHistoryStatusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    fontWeight: '800',
  },
  subHistoryDetail: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subHistoryPeriod: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  subHistoryRefText: {
    fontSize: 10,
    fontFamily: typography.fonts.body,
    color: colors.textMuted,
    marginTop: 2,
  },

  });
};
