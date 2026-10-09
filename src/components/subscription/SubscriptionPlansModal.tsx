import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlanConfig,
  LAUNCH_OFFER_PLANS,
  LaunchOfferPlanConfig,
  getLaunchOfferPlanById,
  getSubscriptionPlanById,
} from '../../constants/subscriptionPlans';
import { cashfreeService, CF_CHECKOUT_URL } from '../../services/cashfreeService';
import { subscriptionService } from '../../services/subscriptionService';
import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';

const PENDING_SUB_KEY = '@counterpro_pending_subscription_order';

interface SubscriptionPlansModalProps {
  visible: boolean;
  onClose: () => void;
  canDismiss?: boolean;
}

export const SubscriptionPlansModal: React.FC<SubscriptionPlansModalProps> = ({
  visible,
  onClose,
  canDismiss = true,
}) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { shop, refreshSubscription } = useShop();
  const { flash } = useCart();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('3_months');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activePaymentUrl, setActivePaymentUrl] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Authoritative 30-day Launch Offer eligibility state
  const [isLaunchEligible, setIsLaunchEligible] = useState<boolean>(true);
  const [eligibilityData, setEligibilityData] = useState<{
    daysRemaining: number;
    hoursRemaining: number;
    secondsRemaining: number;
  }>({ daysRemaining: 30, hoursRemaining: 720, secondsRemaining: 2592000 });

  useEffect(() => {
    if (visible && shop?.id) {
      subscriptionService.checkLaunchOfferEligibility(shop.id, shop.createdAt).then(res => {
        setIsLaunchEligible(res.isEligible);
        setEligibilityData({
          daysRemaining: res.daysRemaining,
          hoursRemaining: res.hoursRemaining,
          secondsRemaining: res.secondsRemaining,
        });
      }).catch(() => {
        setIsLaunchEligible(true);
      });
    }
  }, [visible, shop?.id, shop?.createdAt]);

  const activePlans: any[] = isLaunchEligible ? LAUNCH_OFFER_PLANS : SUBSCRIPTION_PLANS;
  const selectedPlan: any = activePlans.find(p => p.id === selectedPlanId) || activePlans[0];
  const selectedPrice: number = isLaunchEligible ? (selectedPlan.launchPrice || selectedPlan.price) : selectedPlan.price;
  const isVerifyingRef = useRef(false);

  // Core verification function
  const verifyAndActivate = async (orderIdToVerify: string, planIdToVerify: string) => {
    if (!orderIdToVerify || !shop.id || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setStatusMessage('Verifying payment with Cashfree...');

    try {
      const verifyRes = await cashfreeService.verifyOrder(
        orderIdToVerify,
        shop.id,
        planIdToVerify
      );

      if (verifyRes.success && verifyRes.isPaid) {
        // Payment genuinely verified — activate in Supabase with authoritative eligibility check
        const actRes = await subscriptionService.activatePaidSubscription(
          shop.id,
          planIdToVerify as any,
          orderIdToVerify,
          undefined,
          isLaunchEligible
        );

        if (actRes.success) {
          await AsyncStorage.removeItem(PENDING_SUB_KEY);
          await refreshSubscription();
          flash(`🎉 ${selectedPlan.name} Subscription Activated Successfully!`);
          setActiveOrderId(null);
          setActivePaymentUrl(null);
          setStatusMessage(null);
          onClose();
          return;
        } else {
          setStatusMessage(actRes.error || 'Failed to record subscription. Contact support.');
        }
      } else {
        setStatusMessage(
          verifyRes.message ||
            'Payment in progress. Complete payment and return to app.'
        );
      }
    } catch (err: any) {
      console.error('Auto-verification error:', err);
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  // 1. Auto-verify on AppState change (when user returns to app from browser/UPI)
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (activeOrderId) {
          await verifyAndActivate(activeOrderId, selectedPlan.id);
        } else {
          try {
            const raw = await AsyncStorage.getItem(PENDING_SUB_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.orderId && parsed?.planId) {
                setActiveOrderId(parsed.orderId);
                setSelectedPlanId(parsed.planId);
                await verifyAndActivate(parsed.orderId, parsed.planId);
              }
            }
          } catch (_) {}
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [activeOrderId, selectedPlan.id, shop.id]);

  // 2. Auto-verify on Deep Link return (counterpro://payment-return?order_id=...)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (!event.url) return;
      console.log('[DeepLink] Received return url:', event.url);
      if (event.url.includes('payment-return') || event.url.includes('counterpro://') || event.url.includes('counter365://')) {
        setShowCheckoutModal(false);
        let orderId = activeOrderId;
        const match = event.url.match(/order_id=([^&]+)/);
        if (match && match[1]) {
          orderId = match[1];
        }
        if (orderId) {
          await verifyAndActivate(orderId, selectedPlan.id);
        }
      }
    };

    const linkSub = Linking.addEventListener('url', handleDeepLink);

    // Initial URL check if app was opened cold from deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => linkSub.remove();
  }, [activeOrderId, selectedPlan.id, shop.id]);

  // 3. Periodic Background Poller while payment is pending (every 4 seconds for up to 90 seconds)
  useEffect(() => {
    if (!visible || !activeOrderId) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 25) {
        clearInterval(interval);
        return;
      }
      if (!isVerifyingRef.current) {
        await verifyAndActivate(activeOrderId, selectedPlan.id);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [visible, activeOrderId, selectedPlan.id, shop.id]);

  const handleSelectPlan = (plan: any) => {
    if (activeOrderId) return; // Locked during in-flight order
    setSelectedPlanId(plan.id);
  };

  const handleInitiatePayment = async () => {
    if (isProcessing || !shop.id) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const orderPlanPayload = {
        ...selectedPlan,
        price: selectedPrice,
      };

      const orderRes = await cashfreeService.initiateOrder(orderPlanPayload as any, {
        id: shop.id,
        name: shop.name || 'Counter365',
        phone: shop.phone,
      });

      if (!orderRes.success || !orderRes.orderId) {
        setStatusMessage(orderRes.error || 'Failed to initiate payment. Please try again.');
        setIsProcessing(false);
        return;
      }

      setActiveOrderId(orderRes.orderId);
      setActivePaymentUrl(orderRes.paymentUrl || null);

      // Persist in AsyncStorage so it survives app switches or restarts
      await AsyncStorage.setItem(
        PENDING_SUB_KEY,
        JSON.stringify({
          orderId: orderRes.orderId,
          planId: selectedPlan.id,
          timestamp: Date.now(),
        })
      );

      // Open in-app Cashfree WebView directly if session ID exists
      if (orderRes.paymentSessionId) {
        setCheckoutSessionId(orderRes.paymentSessionId);
        setShowCheckoutModal(true);
      } else if (orderRes.paymentUrl) {
        try {
          const supported = await Linking.canOpenURL(orderRes.paymentUrl);
          if (supported) {
            await Linking.openURL(orderRes.paymentUrl);
          }
        } catch (linkErr) {
          console.warn('Linking error:', linkErr);
        }
      }

      setStatusMessage('Complete payment in Cashfree. Your plan will activate automatically.');
    } catch (err: any) {
      console.error('Payment initiation error:', err);
      setStatusMessage('Network error while connecting to Cashfree. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!activeOrderId) return;
    await verifyAndActivate(activeOrderId, selectedPlan.id);
  };

  const handleCancelPayment = async () => {
    await AsyncStorage.removeItem(PENDING_SUB_KEY);
    setActiveOrderId(null);
    setActivePaymentUrl(null);
    setStatusMessage(null);
    setIsProcessing(false);
    setIsVerifying(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (canDismiss && !activeOrderId) onClose();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              {isLaunchEligible ? (
                <View style={styles.launchBadgeRow}>
                  <View style={styles.launchBadge}>
                    <Text style={styles.launchBadgeText}>LAUNCH OFFER</Text>
                  </View>
                  <Text style={styles.countdownIndicatorText}>
                    ⏳ {eligibilityData.daysRemaining} {eligibilityData.daysRemaining === 1 ? 'day' : 'days'} left
                  </Text>
                </View>
              ) : (
                <Text style={styles.kicker}>COUNTER365 PLANS</Text>
              )}
              <Text style={styles.title}>{isLaunchEligible ? 'Choose Your Plan' : 'Choose Subscription'}</Text>
            </View>
            {canDismiss && !activeOrderId && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Value Proposition */}
            <View style={styles.introBanner}>
              <Ionicons name="shield-checkmark" size={20} color={colors.accent900} />
              <Text style={styles.introText}>
                {isLaunchEligible
                  ? 'Regular price ₹999/month. Lock in exclusive launch pricing before your 30-day offer expires.'
                  : '30-day trial included. Transparent pricing, no hidden fees, instant activation.'}
              </Text>
            </View>

            {/* Plans List */}
            <View style={styles.plansContainer}>
              {activePlans.map((plan: any) => {
                const isSelected = selectedPlanId === plan.id;
                const price = isLaunchEligible ? plan.launchPrice : plan.price;
                const strikethroughPrice = isLaunchEligible && plan.savings > 0 ? plan.regularPrice : (plan.savings > 0 ? plan.normalPrice : null);
                const savingsLabel = isLaunchEligible ? plan.savingsLabel : (plan.savings > 0 ? `Save ₹${plan.savings}` : null);
                const pricePerDay = isLaunchEligible ? plan.pricePerDay : Math.round(plan.price / (plan.durationMonths * 30));

                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.85}
                    onPress={() => handleSelectPlan(plan)}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      plan.popular && styles.planCardPopular,
                    ]}
                  >
                    {/* Top Badges */}
                    <View style={styles.cardHeader}>
                      <View style={styles.planTitleCol}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.durationLabel}>{plan.durationLabel}</Text>
                      </View>

                      <View style={styles.badgeRow}>
                        {savingsLabel && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                              {savingsLabel}
                            </Text>
                          </View>
                        )}
                        {!isLaunchEligible && plan.discountBadge && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                              {plan.discountBadge}
                            </Text>
                          </View>
                        )}
                        {plan.popular && !savingsLabel && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularBadgeText}>POPULAR</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Price Row */}
                    <View style={styles.priceRow}>
                      <View style={styles.priceCol}>
                        <Text style={styles.priceText}>₹{price.toLocaleString('en-IN')}</Text>
                        <Text style={styles.pricePerDayText}>₹{pricePerDay}/day</Text>
                      </View>
                      <View style={styles.monthlyCol}>
                        {strikethroughPrice && (
                          <Text style={styles.strikethroughNormal}>
                            ₹{strikethroughPrice.toLocaleString('en-IN')}
                          </Text>
                        )}
                        {!isLaunchEligible && plan.monthlyEquivalent && (
                          <Text style={styles.monthlyText}>
                            ₹{plan.monthlyEquivalent % 1 === 0 ? plan.monthlyEquivalent : plan.monthlyEquivalent.toFixed(2)}
                            <Text style={styles.monthlySuffix}>/mo</Text>
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Radio Indicator */}
                    <View style={styles.radioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.selectLabel, isSelected && styles.selectLabelSelected]}>
                        {isSelected ? 'Selected Plan' : 'Tap to Select'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* In-Flight Cashfree Order State */}
            {activeOrderId ? (
              <View style={styles.inFlightBox}>
                <View style={styles.inFlightHeader}>
                  <ActivityIndicator size="small" color={colors.accent900} />
                  <Text style={styles.inFlightTitle}>Payment in Progress</Text>
                </View>
                <Text style={styles.inFlightOrderId}>Order ID: {activeOrderId}</Text>
                <Text style={styles.inFlightAmount}>Amount: ₹{selectedPrice}</Text>

                {statusMessage && (
                  <View style={styles.statusMessageBox}>
                    <Text style={styles.statusMessageText}>{statusMessage}</Text>
                  </View>
                )}

                <View style={styles.inFlightActionCol}>
                  {activePaymentUrl && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => Linking.openURL(activePaymentUrl)}
                      style={styles.reopenLinkBtn}
                    >
                      <Ionicons name="open-outline" size={16} color={colors.accent900} />
                      <Text style={styles.reopenLinkText}>Reopen Cashfree Payment Page</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleVerifyPayment}
                    disabled={isVerifying}
                    style={styles.verifyBtn}
                  >
                    {isVerifying ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.verifyBtnText}>I have Completed Payment — Verify</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCancelPayment}
                    style={styles.cancelPaymentBtn}
                  >
                    <Text style={styles.cancelPaymentText}>Cancel / Choose Another Plan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {statusMessage && (
                  <View style={styles.statusMessageBox}>
                    <Text style={styles.statusMessageText}>{statusMessage}</Text>
                  </View>
                )}

                {/* Secure Gateway Note */}
                <View style={styles.securityNote}>
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                  <Text style={styles.securityText}>
                    Secured by Cashfree Payments. UPI, Cards, NetBanking supported.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Bottom Action Footer (Only when not in in-flight order mode) */}
          {!activeOrderId && (
            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleInitiatePayment}
                disabled={isProcessing}
                style={styles.payBtn}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.payBtnText}>
                    Pay ₹{selectedPrice.toLocaleString('en-IN')} via Cashfree
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* In-App Cashfree Payment WebView Modal */}
      <Modal
        visible={showCheckoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <View style={styles.webViewTitleRow}>
              <Ionicons name="shield-checkmark" size={20} color="#059669" />
              <View>
                <Text style={styles.webViewTitle}>Cashfree Secure Payment</Text>
                <Text style={styles.webViewSubtitle}>Counter365 Subscription &bull; ₹{selectedPlan.price}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {activePaymentUrl && (
                <TouchableOpacity
                  onPress={() => {
                    Linking.openURL(activePaymentUrl).catch(() => {});
                  }}
                  style={styles.webViewUpiBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="open-outline" size={15} color="#0284C7" />
                  <Text style={styles.webViewUpiBtnText}>UPI App</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowCheckoutModal(false)}
                style={styles.webViewCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {checkoutSessionId ? (
            <View style={{ flex: 1, position: 'relative' }}>
              <WebView
                originWhitelist={['*', 'upi:*', 'tez:*', 'gpay:*', 'phonepe:*', 'paytmmp:*', 'intent:*', 'counterpro:*', 'counter365:*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
                renderLoading={() => (
                  <View style={styles.webViewLoader}>
                    <ActivityIndicator size="large" color={colors.accent900} />
                    <Text style={styles.webViewLoaderText}>Connecting to Cashfree Payment Gateway...</Text>
                  </View>
                )}
                onShouldStartLoadWithRequest={(request) => {
                  const url = request.url;

                  // 1. Intercept payment return / deep link — Return false so WebView never attempts to load it as HTTP
                  if (
                    url.startsWith('counterpro://') ||
                    url.startsWith('counter365://') ||
                    url.includes('payment-return') ||
                    url.includes('counterpro.app/payment-return') ||
                    url.includes('counter365.app/payment-return')
                  ) {
                    setShowCheckoutModal(false);
                    let orderIdToVerify = activeOrderId;
                    const match = url.match(/order_id=([^&]+)/);
                    if (match && match[1]) {
                      orderIdToVerify = match[1];
                    }
                    if (orderIdToVerify) {
                      verifyAndActivate(orderIdToVerify, selectedPlan.id);
                    }
                    return false;
                  }

                  // 2. Intercept UPI app direct schemes (GPay, PhonePe, Paytm, BHIM, etc.)
                  if (
                    url.startsWith('upi://') ||
                    url.startsWith('tez://') ||
                    url.startsWith('gpay://') ||
                    url.startsWith('phonepe://') ||
                    url.startsWith('paytmmp://') ||
                    url.startsWith('bhim://')
                  ) {
                    Linking.openURL(url).catch(err => {
                      console.warn('Could not launch UPI application directly:', err);
                    });
                    return false;
                  }

                  // 3. Intercept Android Intent schemes (intent://... or intent:#Intent...)
                  if (url.startsWith('intent://') || url.startsWith('intent:#Intent')) {
                    try {
                      let cleanUrl = url;
                      if (url.includes('data=')) {
                        const dataMatch = url.match(/data=([^;]+)/);
                        if (dataMatch) cleanUrl = decodeURIComponent(dataMatch[1]);
                      } else {
                        const parts = url.replace(/^intent:\/\//, '').split('#Intent');
                        const schemeMatch = url.match(/scheme=([^;]+)/);
                        const scheme = schemeMatch ? schemeMatch[1] : 'upi';
                        cleanUrl = `${scheme}://${parts[0]}`;
                      }

                      Linking.openURL(cleanUrl).catch(err => {
                        console.warn('Could not launch intent URL:', err);
                      });
                    } catch (parseErr) {
                      console.warn('Error parsing intent URL:', parseErr);
                    }
                    return false;
                  }

                  return true;
                }}
                source={{
                  uri: activePaymentUrl || (
                    checkoutSessionId ? `${CF_CHECKOUT_URL}${checkoutSessionId}` : 'https://payments.cashfree.com'
                  ),
                }}
                renderError={() => (
                  <View style={styles.webViewLoader}>
                    <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
                    <Text style={[styles.webViewLoaderText, { color: '#DC2626', fontWeight: 'bold' }]}>
                      Unable to load Cashfree checkout
                    </Text>
                    <Text style={[styles.webViewLoaderText, { fontSize: 12, marginTop: 4 }]}>
                      Payment session may have expired or network disconnected.
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowCheckoutModal(false);
                        handleInitiatePayment();
                      }}
                      style={{ marginTop: 16, backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Retry New Session</Text>
                    </TouchableOpacity>
                  </View>
                )}
                onNavigationStateChange={(navState) => {
                  if (
                    navState.url.includes('payment-return') ||
                    navState.url.includes('counterpro://') ||
                    navState.url.includes('counter365://')
                  ) {
                    setShowCheckoutModal(false);
                    let orderIdToVerify = activeOrderId;
                    const match = navState.url.match(/order_id=([^&]+)/);
                    if (match && match[1]) {
                      orderIdToVerify = match[1];
                    }
                    if (orderIdToVerify) {
                      verifyAndActivate(orderIdToVerify, selectedPlan.id);
                    }
                  }
                }}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </Modal>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      maxHeight: '92%',
      paddingBottom: Platform.OS === 'ios' ? 24 : 16,
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    kicker: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      letterSpacing: 1.1,
      color: colors.accent,
      textTransform: 'uppercase',
    },
    launchBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    launchBadge: {
      backgroundColor: '#FF5F00',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
    },
    launchBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      fontFamily: typography.fonts.heading,
      letterSpacing: 0.5,
    },
    countdownIndicatorText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
      fontFamily: typography.fonts.heading,
    },
    pricePerDayText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: typography.fonts.body,
      fontWeight: '600',
    },
    title: {
      fontSize: 20,
      fontFamily: typography.fonts.heading,
      color: colors.text,
      fontWeight: '700',
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: radii.pill,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    scrollContent: {
      padding: 20,
      gap: 16,
    },
    introBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F0F9FF',
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#BAE6FD',
    },
    introText: {
      flex: 1,
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: isDark ? colors.text : '#0369A1',
      lineHeight: 18,
    },
    plansContainer: {
      gap: 12,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 16,
      gap: 10,
    },
    planCardSelected: {
      borderColor: colors.accent,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC',
      borderWidth: 2,
    },
    planCardPopular: {
      borderColor: colors.accent,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    planTitleCol: {
      flexShrink: 1,
      gap: 2,
    },
    planName: {
      fontSize: 18,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    durationLabel: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      maxWidth: '62%',
      gap: 6,
    },
    discountBadge: {
      backgroundColor: '#059669',
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    discountBadgeText: {
      color: '#FFFFFF',
      fontSize: 10.5,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
      textAlign: 'center',
    },
    popularBadge: {
      backgroundColor: colors.accent,
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    popularBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      fontFamily: typography.fonts.heading,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    priceCol: {
      gap: 2,
    },
    priceText: {
      fontSize: 22,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.accent,
    },
    savingsText: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: '#059669',
      fontWeight: '600',
    },
    monthlyCol: {
      alignItems: 'flex-end',
      gap: 2,
    },
    monthlyText: {
      fontSize: 15,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    monthlySuffix: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: 'normal',
    },
    strikethroughNormal: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    radioCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleSelected: {
      borderColor: colors.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
    selectLabel: {
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    selectLabelSelected: {
      color: colors.accent,
      fontWeight: '600',
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    securityText: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    inFlightBox: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC',
      borderRadius: radii.lg,
      padding: 18,
      borderWidth: 1.5,
      borderColor: colors.accent,
      gap: 10,
    },
    inFlightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    inFlightTitle: {
      fontSize: 16,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.accent,
    },
    inFlightOrderId: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    inFlightAmount: {
      fontSize: 15,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    statusMessageBox: {
      backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
      padding: 10,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(217, 119, 6, 0.4)' : '#FDE68A',
    },
    statusMessageText: {
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: isDark ? '#F59E0B' : '#92400E',
      lineHeight: 18,
    },
    inFlightActionCol: {
      gap: 10,
      marginTop: 6,
    },
    reopenLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#EFF6FF',
      borderRadius: radii.md,
    },
    reopenLinkText: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      fontWeight: '600',
      color: colors.accent,
    },
    verifyBtn: {
      backgroundColor: '#059669',
      paddingVertical: 14,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifyBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    cancelPaymentBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelPaymentText: {
      fontSize: 13,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    payBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    payBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    webViewContainer: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    webViewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    webViewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    webViewTitle: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
      color: colors.text,
    },
    webViewSubtitle: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      marginTop: 1,
    },
    webViewCloseBtn: {
      padding: 6,
      borderRadius: radii.pill,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    webViewUpiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E0F2FE',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.pill,
    },
    webViewUpiBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      fontFamily: typography.fonts.heading,
    },
    webViewLoader: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    webViewLoaderText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: typography.fonts.body,
    },
  });
};
