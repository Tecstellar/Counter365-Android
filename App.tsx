import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { colors, ThemeProvider, useTheme } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ShopProvider, useShop } from './src/context/ShopContext';
import { CartProvider, useCart } from './src/context/CartContext';

import { AppHeader } from './src/components/header/AppHeader';
import { BottomTabBar } from './src/components/navigation/BottomTabBar';
import { DrawerMenu } from './src/components/navigation/DrawerMenu';
import { AppTourOverlay, TOUR_STEPS } from './src/components/tour/AppTourOverlay';
import { ToastBanner } from './src/components/common/ToastBanner';
import { BillSavedModal } from './src/components/sales/BillSavedModal';
import { ShareModal } from './src/components/sales/ShareModal';
import { TrialExpiredLockModal } from './src/components/subscription/TrialExpiredLockModal';
import { SubscriptionPlansModal } from './src/components/subscription/SubscriptionPlansModal';
import { AppReviewModal, STORAGE_KEY_REVIEWED, STORAGE_KEY_REVIEW_SNOOZE } from './src/components/common/AppReviewModal';
import { storage } from './src/lib/storage';
import { billingService } from './src/services/billingService';

import { SplashScreen } from './src/screens/onb/SplashScreen';
import { IntroScreen } from './src/screens/onb/IntroScreen';
import { PhoneStep } from './src/screens/onb/PhoneStep';
import { OtpStep } from './src/screens/onb/OtpStep';
import { ShopDetailsStep } from './src/screens/onb/ShopDetailsStep';
import { ShopTypeStep } from './src/screens/onb/ShopTypeStep';
import { RegistrationSuccessScreen } from './src/screens/onb/RegistrationSuccessScreen';

import { HomeScreen } from './src/screens/home/HomeScreen';
import { BillsScreen } from './src/screens/bills/BillsScreen';
import { SalesMenuScreen } from './src/screens/sales/SalesMenuScreen';
import { BillCheckoutScreen } from './src/screens/sales/BillCheckoutScreen';
import { MenuEditorScreen } from './src/screens/sales/MenuEditorScreen';
import { MonthlyReportsScreen } from './src/screens/reports/MonthlyReportsScreen';
import { PendingPaymentsScreen } from './src/screens/pending/PendingPaymentsScreen';
import { ContactsScreen } from './src/screens/contacts/ContactsScreen';
import { AccountScreen } from './src/screens/account/AccountScreen';
import { SupportScreen } from './src/screens/support/SupportScreen';

import { AppRoute, SalesSubView } from './src/types/navigation';
import { ShopType, Bill, PendingPaymentRecord } from './src/types/models';
import { whatsappService } from './src/services/whatsappService';
import { printerService } from './src/services/printerService';
import { exportService } from './src/services/exportService';
import { locationService } from './src/services/locationService';
import { imageService } from './src/services/imageService';

const MainApp: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { currentRole, setRole, can, sendOtp, login, profile, isLoading: isAuthLoading } = useAuth();
  const { shop, updateShop, registerNewShop, setActiveShop, clearShop, subscriptionStatus, isLoading: isShopLoading } = useShop();
  const { toastMessage, flash, startEditingBill } = useCart();

  const handleEditBill = (bill: Bill) => {
    startEditingBill(bill);
    setSalesSubView('bill');
    setCurrentRoute('sales');
  };

  // Subscription Plans Modal State
  const [isSubscriptionPlansOpen, setIsSubscriptionPlansOpen] = useState(false);

  // Play Store Review Prompt State (Triggered after 10 bills)
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
  const [reviewBillsCount, setReviewBillsCount] = useState(0);

  const checkAndPromptReview = async () => {
    if (!shop?.id) return;
    try {
      const alreadyReviewed = await storage.getItem(STORAGE_KEY_REVIEWED);
      if (alreadyReviewed === 'true') return;

      const snoozeUntil = await storage.getItem(STORAGE_KEY_REVIEW_SNOOZE);
      if (snoozeUntil && Number(snoozeUntil) > Date.now()) return;

      const count = await billingService.getTotalBillsCreated(shop.id);
      if (count >= 10) {
        setReviewBillsCount(count);
        setIsReviewModalVisible(true);
      }
    } catch (err) {
      console.warn('Review prompt check notice:', err);
    }
  };

  // Route & Navigation State
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('splash');
  const [salesSubView, setSalesSubView] = useState<SalesSubView>('menu');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;

  // Persistent Login Auto-Restore Effect (Only runs during initial launch from splash screen)
  useEffect(() => {
    if (currentRoute === 'splash' && splashFinished && !isAuthLoading && !isShopLoading) {
      const isFullyRegistered = Boolean(
        shop && shop.id &&
        profile && (profile.id || profile.phone)
      );
      if (isFullyRegistered) {
        setCurrentRoute('home');
      } else {
        setCurrentRoute('intro');
      }
    }
  }, [shop?.id, profile?.id, profile?.phone, isAuthLoading, isShopLoading, splashFinished, currentRoute]);

  useEffect(() => {
    if (isDrawerOpen) {
      Animated.spring(drawerProgress, {
        toValue: 1,
        tension: 42,
        friction: 6.8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(drawerProgress, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [isDrawerOpen]);

  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);

  // Onboarding Form States
  const [onbPhone, setOnbPhone] = useState('');
  const [onbOtp, setOnbOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [onbOwnerName, setOnbOwnerName] = useState('');
  const [onbShopName, setOnbShopName] = useState('');
  const [onbShopAddress, setOnbShopAddress] = useState('');
  const [onbShopState, setOnbShopState] = useState('');
  const [onbShopCity, setOnbShopCity] = useState('');
  const [onbShopPincode, setOnbShopPincode] = useState('');
  const [isGeoTagged, setIsGeoTagged] = useState(false);
  const [onbLatitude, setOnbLatitude] = useState<number | null>(null);
  const [onbLongitude, setOnbLongitude] = useState<number | null>(null);
  const [onbFormattedCoords, setOnbFormattedCoords] = useState<string | undefined>(undefined);
  const [isExtractingGps, setIsExtractingGps] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [onbLogoUrl, setOnbLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [onbShopKind, setOnbShopKind] = useState<ShopType>('Tea Shop');

  // Modals
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [contactFocusName, setContactFocusName] = useState<string | undefined>(undefined);

  // Tour step form controllers
  const [tourOpenCategoryForm, setTourOpenCategoryForm] = useState(false);
  const [tourOpenItemForm, setTourOpenItemForm] = useState(false);

  // Keypad Handlers
  const handlePhoneKeyPress = (k: string) => {
    setPhoneError(null);
    if (k === '⌫') {
      setOnbPhone(prev => prev.slice(0, -1));
    } else if (onbPhone.length < 10) {
      setOnbPhone(prev => prev + k);
    }
  };

  const handleOtpKeyPress = (k: string) => {
    setOtpError(null);
    if (k === '⌫') {
      setOnbOtp(prev => prev.slice(0, -1));
    } else if (onbOtp.length < 6) {
      setOnbOtp(prev => prev + k);
    }
  };

  // Splash Completion Handler — Direct Dashboard if already registered on this device
  const handleSplashComplete = () => {
    setSplashFinished(true);
    const isFullyRegistered = Boolean(
      shop && shop.id &&
      profile && (profile.id || profile.phone)
    );
    if (isFullyRegistered) {
      setCurrentRoute('home');
    } else if (!isAuthLoading && !isShopLoading) {
      setCurrentRoute('intro');
    }
  };

  // Onboarding Flow Handlers
  const handleSendOtp = async () => {
    if (onbPhone.length < 10) {
      flash('Enter 10 digits');
      return;
    }
    setIsSendingOtp(true);
    setPhoneError(null);
    try {
      const res = await sendOtp(onbPhone);
      if (res.success) {
        flash('OTP sent to +91 ' + onbPhone);
        setOtpError(null);
        setCurrentRoute('onb_otp');
      } else {
        setPhoneError(res.error || 'Failed to send OTP. Please try again.');
        flash(res.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setPhoneError('Network error. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendOtp(onbPhone);
      if (res.success) {
        flash('New OTP sent to +91 ' + onbPhone);
      } else {
        setOtpError(res.error || 'Failed to resend OTP');
        flash(res.error || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setOtpError('Failed to send OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (onbOtp.length < 6) {
      flash('Enter the 6-digit code');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await login(onbPhone, onbOtp);
      if (res.success) {
        if (res.isExistingShop && res.shop) {
          await setActiveShop(res.shop);
          flash(`Welcome back to ${res.shop.name}!`);
          setCurrentRoute('home');
        } else {
          flash("OTP verified! Let's setup your shop");
          setCurrentRoute('onb_shop');
        }
      } else {
        setOtpError(res.error || 'Incorrect OTP code. Please try again.');
        flash(res.error || 'Incorrect OTP code');
      }
    } catch (err: any) {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleTagLocation = async () => {
    setIsExtractingGps(true);
    try {
      const res = await locationService.getCurrentLocation();
      if (res.success && res.data) {
        setIsGeoTagged(true);
        setOnbLatitude(res.data.latitude);
        setOnbLongitude(res.data.longitude);
        setOnbFormattedCoords(res.data.formattedCoords);
        if (!onbShopCity && res.data.city) setOnbShopCity(res.data.city);
        if (!onbShopState && res.data.state) setOnbShopState(res.data.state);
        if (!onbShopPincode && res.data.pincode) setOnbShopPincode(res.data.pincode);
        if (!onbShopAddress && res.data.address) setOnbShopAddress(res.data.address);
        flash(`Location tagged: ${res.data.formattedCoords}`);
      } else {
        flash(res.error || 'Could not fetch GPS location');
      }
    } catch (err) {
      flash('Failed to get location');
    } finally {
      setIsExtractingGps(false);
    }
  };

  const handlePickLogo = async () => {
    setIsUploadingLogo(true);
    try {
      const res = await imageService.pickShopLogo();
      if (res.success && res.logoUrl) {
        setOnbLogoUrl(res.logoUrl);
        setHasLogo(true);
        flash('Shop logo attached');
      } else if (res.error) {
        flash(res.error);
      }
    } catch (err) {
      flash('Could not load image');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCompleteRegistration = async () => {
    const cleanPhone = onbPhone.replace(/\D/g, '') || onbPhone;
    await registerNewShop({
      name: onbShopName.trim() || 'My Shop',
      ownerName: onbOwnerName.trim() || undefined,
      shopType: onbShopKind,
      phone: cleanPhone,
      address: onbShopAddress.trim(),
      city: onbShopCity.trim(),
      state: onbShopState.trim(),
      pincode: onbShopPincode.trim(),
      latitude: onbLatitude ?? (isGeoTagged ? 13.1143 : undefined),
      longitude: onbLongitude ?? (isGeoTagged ? 80.1548 : undefined),
      hasLogo: !!onbLogoUrl || hasLogo,
      logoUrl: onbLogoUrl || undefined,
      ownerUserId: profile?.id,
    });
    setCurrentRoute('onb_success');
  };

  // Tour Handler
  const startTour = (stepIndex = 0) => {
    setTourStepIndex(stepIndex);
    applyTourStep(stepIndex);
  };

  const applyTourStep = (index: number) => {
    const step = TOUR_STEPS[index];
    if (!step) return;

    if (step.route === 'home') setCurrentRoute('home');
    if (step.route === 'sales') {
      setCurrentRoute('sales');
      if (step.sales === 'editor') setSalesSubView('editor');
      else if (step.sales === 'bill') setSalesSubView('bill');
      else setSalesSubView('menu');
    }
    if (step.route === 'pending') setCurrentRoute('pending');
    if (step.route === 'contacts') setCurrentRoute('contacts');
    if (step.route === 'reports') setCurrentRoute('reports');

    setTourOpenCategoryForm(step.open === 'cat');
    setTourOpenItemForm(step.open === 'item');
  };

  const handleTourNext = () => {
    if (tourStepIndex === null) return;
    const next = tourStepIndex + 1;
    if (next >= TOUR_STEPS.length) {
      setTourStepIndex(null);
      setCurrentRoute('sales');
      setSalesSubView('menu');
      setTourOpenCategoryForm(false);
      setTourOpenItemForm(false);
    } else {
      setTourStepIndex(next);
      applyTourStep(next);
    }
  };

  const handleTourBack = () => {
    if (tourStepIndex === null || tourStepIndex <= 0) return;
    const prev = tourStepIndex - 1;
    setTourStepIndex(prev);
    applyTourStep(prev);
  };

  const handleTourSkip = () => {
    setTourStepIndex(null);
    setCurrentRoute('home');
    setTourOpenCategoryForm(false);
    setTourOpenItemForm(false);
    flash('Guide closed. Reopen it from the menu');
  };

  // Check if main app shell should be rendered
  const isMainShell =
    currentRoute === 'home' ||
    currentRoute === 'sales' ||
    currentRoute === 'bills' ||
    currentRoute === 'reports' ||
    currentRoute === 'pending' ||
    currentRoute === 'contacts' ||
    currentRoute === 'account' ||
    currentRoute === 'support';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.bg}
        translucent={false}
      />

      {/* Main Content with Background Push Animation (scale: 0.965, translateX: 26, borderRadius: 28) */}
      <Animated.View
        style={[
          styles.mainShellContent,
          {
            backgroundColor: theme.colors.bg,
            transform: [
              {
                scale: drawerProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.965],
                }),
              },
              {
                translateX: drawerProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 26],
                }),
              },
            ],
            borderRadius: isDrawerOpen ? 28 : 0,
            overflow: 'hidden',
          },
        ]}
      >
        {/* Main Shell Header */}
        {isMainShell && (
        <AppHeader
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenReports={() => {
            if (can('report')) {
              setCurrentRoute('reports');
            } else {
              flash('Reports are locked. Please ask the owner');
            }
          }}
          todayLabel={(() => {
            const d = new Date();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
          })()}
        />
      )}

      {/* Screens */}
      <View style={styles.screenContainer}>
        {/* Onboarding / Auth Steps */}
        {currentRoute === 'splash' && (
          <SplashScreen onComplete={handleSplashComplete} />
        )}

        {currentRoute === 'intro' && (
          <IntroScreen onComplete={() => setCurrentRoute('onb_phone')} />
        )}

        {currentRoute === 'onb_phone' && (
          <PhoneStep
            phone={onbPhone}
            onChangePhone={setOnbPhone}
            onKeyPress={handlePhoneKeyPress}
            onNext={handleSendOtp}
            loading={isSendingOtp}
            error={phoneError}
          />
        )}

        {currentRoute === 'onb_otp' && (
          <OtpStep
            phone={onbPhone || '98404 12345'}
            otp={onbOtp}
            onKeyPress={handleOtpKeyPress}
            onEditPhone={() => {
              setOnbOtp('');
              setOtpError(null);
              setCurrentRoute('onb_phone');
            }}
            onNext={handleVerifyOtp}
            onBack={() => {
              setOnbOtp('');
              setOtpError(null);
              setCurrentRoute('onb_phone');
            }}
            onResend={handleResendOtp}
            loading={isVerifyingOtp}
            error={otpError}
          />
        )}

        {currentRoute === 'onb_shop' && (
          <ShopDetailsStep
            shopName={onbShopName}
            ownerName={onbOwnerName}
            shopAddress={onbShopAddress}
            shopState={onbShopState}
            shopCity={onbShopCity}
            shopPincode={onbShopPincode}
            isGeoTagged={isGeoTagged}
            hasLogo={hasLogo}
            logoUrl={onbLogoUrl}
            latitude={onbLatitude}
            longitude={onbLongitude}
            formattedCoords={onbFormattedCoords}
            isExtractingGps={isExtractingGps}
            isUploadingLogo={isUploadingLogo}
            onChangeName={setOnbShopName}
            onChangeOwnerName={setOnbOwnerName}
            onChangeAddress={setOnbShopAddress}
            onChangeState={setOnbShopState}
            onChangeCity={setOnbShopCity}
            onChangePincode={setOnbShopPincode}
            onTagLocation={handleTagLocation}
            onToggleLogo={handlePickLogo}
            onNext={() => setCurrentRoute('onb_kind')}
            onBack={() => setCurrentRoute('onb_otp')}
          />
        )}

        {currentRoute === 'onb_kind' && (
          <ShopTypeStep
            selectedKind={onbShopKind}
            onSelectKind={setOnbShopKind}
            onNext={handleCompleteRegistration}
            onBack={() => setCurrentRoute('onb_shop')}
          />
        )}

        {currentRoute === 'onb_success' && (
          <RegistrationSuccessScreen
            shopName={onbShopName || shop.name}
            shopAddress={onbShopAddress || shop.address}
            shopPlace={`${onbShopCity || shop.city}, ${onbShopState || shop.state} • ${onbShopPincode || shop.pincode}`}
            shopKind={onbShopKind || shop.shopType}
            phone={onbPhone || shop.phone}
            isGeoTagged={isGeoTagged}
            onGoToDashboard={() => setCurrentRoute('home')}
            onStartTour={() => startTour(0)}
            onRestart={() => {
              setOnbPhone('');
              setOnbOtp('');
              setOnbOwnerName('');
              setOnbShopName('');
              setOnbShopAddress('');
              setOnbShopCity('');
              setOnbShopPincode('');
              setIsGeoTagged(false);
              setOnbLatitude(null);
              setOnbLongitude(null);
              setOnbFormattedCoords(undefined);
              setHasLogo(false);
              setOnbLogoUrl(null);
              setCurrentRoute('onb_phone');
            }}
          />
        )}

        {/* Main Application Routes */}
        {currentRoute === 'home' && (
          <HomeScreen
            onNavigate={route => setCurrentRoute(route)}
            onOpenReminder={pending => {
              const msg = whatsappService.formatPendingReminder(pending, shop.name);
              whatsappService.shareViaWhatsApp(msg, pending.customerPhone);
              flash(`Reminder sent to ${pending.customerName}`);
            }}
            onEditBill={handleEditBill}
          />
        )}

        {currentRoute === 'bills' && (
          <BillsScreen
            onBackToHome={() => setCurrentRoute('home')}
            onEditBill={handleEditBill}
          />
        )}

        {currentRoute === 'sales' && (
          <>
            {salesSubView === 'menu' && (
              <SalesMenuScreen
                onGoToBill={() => setSalesSubView('bill')}
                onOpenMenuEditor={() => setSalesSubView('editor')}
              />
            )}
            {salesSubView === 'bill' && (
              <BillCheckoutScreen
                onBackToMenu={() => setSalesSubView('menu')}
                onBillSaved={async (bill, share, autoPrint) => {
                  setSavedBill(bill);
                  if (share) {
                    const waText = whatsappService.formatCustomerBill(bill, shop.name, shop.upiId);
                    whatsappService.shareViaWhatsApp(waText, bill.customerPhone);
                  }
                  if (autoPrint) {
                    try {
                      await printerService.printReceipt(bill, shop.name, shop.address, shop.phone);
                    } catch (e) {
                      console.warn('Print error:', e);
                    }
                  }
                  setTimeout(() => {
                    checkAndPromptReview();
                  }, 800);
                }}
              />
            )}
            {salesSubView === 'editor' && (
              <MenuEditorScreen
                onBackToMenu={() => setSalesSubView('menu')}
                openCreateCategoryImmediately={tourOpenCategoryForm}
                openCreateItemImmediately={tourOpenItemForm}
              />
            )}
          </>
        )}

        {currentRoute === 'reports' && (
          <MonthlyReportsScreen
            onBackToHome={() => setCurrentRoute('home')}
            onNavigateToUpgrade={() => setCurrentRoute('account')}
          />
        )}

        {currentRoute === 'pending' && (
          <PendingPaymentsScreen
            onBackToHome={() => setCurrentRoute('home')}
            onNavigateToContacts={name => {
              setContactFocusName(name);
              setCurrentRoute('contacts');
            }}
            onSendReminder={record => {
              const msg = whatsappService.formatPendingReminder(record, shop.name, shop.upiId);
              whatsappService.shareViaWhatsApp(msg, record.customerPhone);
              flash(`Reminder sent to ${record.customerName}`);
            }}
          />
        )}

        {currentRoute === 'contacts' && (
          <ContactsScreen
            onBackToHome={() => setCurrentRoute('home')}
            focusCustomerName={contactFocusName}
          />
        )}

        {currentRoute === 'account' && (
          <AccountScreen
            onBackToHome={() => setCurrentRoute('home')}
            onLogout={async () => {
              await clearShop();
              setOnbPhone('');
              setOnbOtp('');
              setOnbOwnerName('');
              setOnbShopName('');
              setOnbShopAddress('');
              setCurrentRoute('onb_phone');
            }}
            onNavigateToSupport={() => setCurrentRoute('support')}
          />
        )}

        {currentRoute === 'support' && (
          <SupportScreen
            onBackToHome={() => setCurrentRoute('home')}
          />
        )}
      </View>
      </Animated.View>

      {/* Main Shell Bottom Navigation Tab Bar */}
      {isMainShell && (
        <Animated.View
          style={{
            opacity: drawerProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.25],
            }),
          }}
        >
          <BottomTabBar
            currentRoute={currentRoute}
            onNavigate={route => {
              setCurrentRoute(route);
              if (route === 'sales') {
                setSalesSubView('menu');
              }
            }}
          />
        </Animated.View>
      )}

      {/* Drawer Menu */}
      <DrawerMenu
        visible={isDrawerOpen}
        currentRoute={currentRoute}
        salesSubView={salesSubView}
        drawerProgress={drawerProgress}
        onClose={() => setIsDrawerOpen(false)}
        onOpen={() => setIsDrawerOpen(true)}
        onNavigate={route => setCurrentRoute(route)}
        onNavigateSubView={(route, subView) => {
          setCurrentRoute(route);
          if (subView) setSalesSubView(subView);
        }}
        onStartTour={() => startTour(0)}
      />

      {/* App Tour Overlay */}
      <AppTourOverlay
        currentStepIndex={tourStepIndex}
        onNext={handleTourNext}
        onBack={handleTourBack}
        onSkip={handleTourSkip}
      />

      {/* Bill Saved Modal */}
      <BillSavedModal
        bill={savedBill}
        onSendWhatsApp={() => {
          if (!savedBill) return;
          const msg = whatsappService.formatCustomerBill(savedBill, shop.name, shop.upiId);
          whatsappService.shareViaWhatsApp(msg, savedBill.customerPhone);
          setSavedBill(null);
          setSalesSubView('menu');
          flash(`Bill ${savedBill.billNumber} sent on WhatsApp`);
          checkAndPromptReview();
        }}
        onPrint={async () => {
          if (!savedBill) return;
          const ok = await printerService.printReceipt(savedBill, shop.name, shop.address, shop.phone);
          if (ok) {
            flash('Print sent');
          } else {
            flash('Could not open print service');
          }
          checkAndPromptReview();
        }}
        onNewBill={() => {
          setSavedBill(null);
          setSalesSubView('menu');
          checkAndPromptReview();
        }}
        onEdit={() => {
          if (savedBill) {
            const billToEdit = savedBill;
            setSavedBill(null);
            handleEditBill(billToEdit);
          }
        }}
      />

      {/* Share Modal */}
      <ShareModal
        visible={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onSelectOption={opt => {
          setIsShareModalOpen(false);
          flash(`${opt} ready`);
        }}
      />

      {/* Free Plan 100-Bills Limit Expiration Lock Modal */}
      <TrialExpiredLockModal
        visible={
          isMainShell &&
          !!shop.id &&
          subscriptionStatus.requiresSubscription &&
          !isSubscriptionPlansOpen
        }
        shopName={shop.name}
        trialEndDateFormatted={subscriptionStatus.trialEndDateFormatted}
        totalBillsCreated={subscriptionStatus.totalBillsCreated}
        onSubscribe={() => setIsSubscriptionPlansOpen(true)}
      />

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal
        visible={isSubscriptionPlansOpen}
        onClose={() => setIsSubscriptionPlansOpen(false)}
        canDismiss={!subscriptionStatus.requiresSubscription}
      />

      {/* Play Store Review Modal (Triggered after 10 bills) */}
      <AppReviewModal
        visible={isReviewModalVisible}
        totalBills={reviewBillsCount}
        onClose={() => setIsReviewModalVisible(false)}
      />

      {/* Toast Notification Banner */}
      <ToastBanner message={toastMessage} />
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    // Lexend (Body, UI, numbers, buttons, chips, labels, inputs, lists)
    'Lexend': require('./assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Regular': require('./assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Medium': require('./assets/fonts/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('./assets/fonts/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('./assets/fonts/Lexend-Bold.ttf'),
    'Lexend-ExtraBold': require('./assets/fonts/Lexend-ExtraBold.ttf'),

    // Jost (Screen titles, section headings, Counter365 logo / splash)
    'Jost': require('./assets/fonts/Jost-Bold.ttf'),
    'Jost-Medium': require('./assets/fonts/Jost-Medium.ttf'),
    'Jost-SemiBold': require('./assets/fonts/Jost-SemiBold.ttf'),
    'Jost-Bold': require('./assets/fonts/Jost-Bold.ttf'),
    'Jost-ExtraBold': require('./assets/fonts/Jost-ExtraBold.ttf'),

    // Noto Sans Tamil (Fallback for Tamil script)
    'Noto Sans Tamil': require('./assets/fonts/NotoSansTamil-Regular.ttf'),
    'NotoSansTamil-Regular': require('./assets/fonts/NotoSansTamil-Regular.ttf'),
    'NotoSansTamil-SemiBold': require('./assets/fonts/NotoSansTamil-SemiBold.ttf'),
    'NotoSansTamil-Bold': require('./assets/fonts/NotoSansTamil-Bold.ttf'),

    // Backwards-compatible legacy font mappings
    'Archivo-Regular': require('./assets/fonts/Lexend-Regular.ttf'),
    'Archivo-Medium': require('./assets/fonts/Lexend-Medium.ttf'),
    'Archivo-SemiBold': require('./assets/fonts/Lexend-SemiBold.ttf'),
    'Archivo-Bold': require('./assets/fonts/Jost-Bold.ttf'),
    'Archivo-Black': require('./assets/fonts/Jost-ExtraBold.ttf'),
    'CaacupeOne-Regular': require('./assets/fonts/Jost-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent700} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ShopProvider>
            <CartProvider>
              <MainApp />
            </CartProvider>
          </ShopProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mainShellContent: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.accent900,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
