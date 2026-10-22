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
  calculatePlanTax,
  PlanTaxBreakdown,
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

  // Navigation steps: 'plans' (listing with Excl. GST prices) -> 'summary' (tax breakdown & payment)
  const [step, setStep] = useState<'plans' | 'summary'>('plans');

  // 12 Months (1_year) is the authoritative default plan requested by user
  const [selectedPlanId, setSelectedPlanId] = useState<string>('1_year');
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
      if (!activeOrderId) {
        setStep('plans');
      }
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
  }, [visible, shop?.id, shop?.createdAt, activeOrderId]);

  const activePlans: any[] = isLaunchEligible ? LAUNCH_OFFER_PLANS : SUBSCRIPTION_PLANS;
  const selectedPlan: any = activePlans.find(p => p.id === selectedPlanId) || activePlans[0];
  const selectedBasePrice: number = isLaunchEligible
    ? (selectedPlan.offerPrice || selectedPlan.launchPrice || selectedPlan.price)
    : (selectedPlan.offerPrice || selectedPlan.price);
  const taxBreakdown: PlanTaxBreakdown = calculatePlanTax(selectedBasePrice);
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
          isLaunchEligible,
          taxBreakdown.totalAmount
        );

        if (actRes.success) {
          await AsyncStorage.removeItem(PENDING_SUB_KEY);
          await refreshSubscription();
          flash(`🎉 ${selectedPlan.name} Subscription Activated Successfully!`);
          setActiveOrderId(null);
          setActivePaymentUrl(null);
          setStatusMessage(null);
          setStep('plans');
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
        price: taxBreakdown.totalAmount, // Charge final payable amount inclusive of 18% GST (e.g. 3538.82)
        basePrice: selectedBasePrice,
        taxBreakdown,
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
            <View style={{ flex: 1 }}>
              {step === 'summary' && !activeOrderId ? (
                <TouchableOpacity
                  onPress={() => setStep('plans')}
                  style={styles.backButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.accent} />
                  <Text style={styles.backButtonText}>Back to Plans</Text>
                </TouchableOpacity>
              ) : isLaunchEligible ? (
                <View style={styles.launchBadgeRow}>
                  <View style={styles.launchBadge}>
                    <Text style={styles.launchBadgeText}>COUNTER365 PRO</Text>
                  </View>
                  <Text style={styles.countdownIndicatorText}>
                    ⏳ {eligibilityData.daysRemaining} {eligibilityData.daysRemaining === 1 ? 'day' : 'days'} left
                  </Text>
                </View>
              ) : (
                <Text style={styles.kicker}>COUNTER365 PLANS</Text>
              )}
              <Text style={styles.title}>
                {activeOrderId
                  ? 'Payment Status'
                  : step === 'summary'
                  ? 'Order Summary & GST'
                  : 'Choose Subscription'}
              </Text>
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
            {/* IN-FLIGHT CASHFREE ORDER STATE */}
            {activeOrderId ? (
              <View style={styles.inFlightBox}>
                <View style={styles.inFlightHeader}>
                  <ActivityIndicator size="small" color={colors.accent900} />
                  <Text style={styles.inFlightTitle}>Payment in Progress</Text>
                </View>
                <Text style={styles.inFlightOrderId}>Order ID: {activeOrderId}</Text>
                <Text style={styles.inFlightAmount}>
                  Amount (Incl. 18% GST): ₹{taxBreakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>

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
            ) : step === 'plans' ? (
              /* =========================================================================
                 STEP 1: PLAN LISTING PAGE (Prices displayed strictly Excl. GST)
                 ========================================================================= */
              <>
                {/* Intro Value Proposition */}
                <View style={styles.introBanner}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.accent900} />
                  <Text style={styles.introText}>
                    All plan prices below exclude GST. Select your preferred billing period to view the 18% GST tax breakdown and payable total.
                  </Text>
                </View>

                {/* Plans List */}
                <View style={styles.plansContainer}>
                  {activePlans.map((plan: any) => {
                    const isSelected = selectedPlanId === plan.id;
                    const basePrice = plan.offerPrice || plan.launchPrice || plan.price;
                    const normalPrice = plan.normalPrice || plan.regularPrice;
                    const hasOffer = normalPrice > basePrice;
                    const savings = plan.savings || (hasOffer ? normalPrice - basePrice : 0);
                    const pricePerDay = plan.pricePerDay || Math.round(basePrice / (plan.durationMonths * 30));
                    const monthlyEq = plan.monthlyEquivalent || Math.round(basePrice / plan.durationMonths);

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
                        <View style={styles.planCardMainRow}>
                          {/* Left Column: Radio + Plan Name + Duration + Daily Rate */}
                          <View style={styles.planLeftCol}>
                            <View style={styles.planTitleRow}>
                              <View
                                style={[
                                  styles.radioCircle,
                                  isSelected && styles.radioCircleSelected,
                                ]}
                              >
                                {isSelected && <View style={styles.radioInner} />}
                              </View>
                              <Text style={[styles.planName, isSelected && styles.planNameSelected]}>{plan.name}</Text>
                            </View>

                            <View style={styles.durationTagRow}>
                              <View style={[styles.durationBadge, isSelected && styles.durationBadgeSelected]}>
                                <Text style={[styles.durationLabel, isSelected && styles.durationLabelSelected]}>{plan.durationLabel}</Text>
                              </View>
                              <Text style={styles.planRateSubText}>
                                ₹{pricePerDay}/day &bull; ₹{monthlyEq.toLocaleString('en-IN')}/mo
                              </Text>
                            </View>
                          </View>

                          {/* Right Column: Badges (if any) + Price Inside */}
                          <View style={styles.planRightCol}>
                            {(hasOffer || plan.popular) && (
                              <View style={styles.badgeRow}>
                                {hasOffer && (
                                  <View style={styles.discountBadge}>
                                    <Text style={styles.discountBadgeText}>
                                      SAVE ₹{savings.toLocaleString('en-IN')}
                                    </Text>
                                  </View>
                                )}
                                {plan.popular && (
                                  <View style={styles.popularBadge}>
                                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {hasOffer && (
                              <Text style={styles.strikethroughNormal}>
                                ₹{normalPrice.toLocaleString('en-IN')}
                              </Text>
                            )}

                            <View style={styles.priceWithSuffixRow}>
                              <Text style={[styles.priceText, isSelected && styles.priceTextSelected]}>
                                ₹{basePrice.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <Text style={styles.exclGstSuffix}>(Excl. GST)</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Notice below plans */}
                <View style={styles.gstNoticeBox}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.gstNoticeText}>
                    Note: Prices displayed above exclude GST. When you proceed, the applicable 18% GST split-up (CGST 9% + SGST 9%) and the final amount will be displayed.
                  </Text>
                </View>
              </>
            ) : (
              /* =========================================================================
                 STEP 2: ORDER SUMMARY & 18% GST SPLIT-UP PAGE
                 ========================================================================= */
              <>
                {/* Plan Overview Card */}
                <View style={styles.summaryPlanCard}>
                  <View style={styles.summaryPlanHeader}>
                    <View style={styles.summaryPlanIconBox}>
                      <Ionicons name="ribbon-outline" size={26} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.summaryPlanTitle}>Counter365 Pro &mdash; {selectedPlan.name}</Text>
                      <Text style={styles.summaryPlanDuration}>
                        {selectedPlan.durationMonths} Months Validity ({selectedPlan.durationMonths * 30} Days)
                      </Text>
                    </View>
                    <View style={styles.instantPill}>
                      <Text style={styles.instantPillText}>Instant Activation</Text>
                    </View>
                  </View>
                </View>

                {/* Tax Invoice Breakdown (Exact 18% GST Split) */}
                <View style={styles.taxInvoiceCard}>
                  <View style={styles.taxInvoiceHeader}>
                    <Text style={styles.taxInvoiceHeading}>TAX INVOICE BREAKDOWN</Text>
                    <View style={styles.sacBadge}>
                      <Text style={styles.sacBadgeText}>SAC 998313</Text>
                    </View>
                  </View>

                  {/* Plan Price (Excl. GST) */}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Plan</Text>
                    <Text style={styles.breakdownValue}>
                      ₹{taxBreakdown.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* Strikethrough catalog price if offer discount exists */}
                  {(selectedPlan.normalPrice || selectedPlan.regularPrice) > selectedBasePrice && (
                    <View style={styles.discountRow}>
                      <Text style={styles.discountRowLabel}>
                        Catalog Price (₹{(selectedPlan.normalPrice || selectedPlan.regularPrice).toLocaleString('en-IN')})
                      </Text>
                      <Text style={styles.discountRowValue}>
                        -₹{((selectedPlan.normalPrice || selectedPlan.regularPrice) - selectedBasePrice).toLocaleString('en-IN')}.00 (Offer)
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* CGST 9% */}
                  <View style={styles.breakdownRow}>
                    <View style={{ gap: 1 }}>
                      <Text style={styles.breakdownLabel}>CGST (9%)</Text>
                      <Text style={styles.breakdownSub}>Central Goods and Services Tax</Text>
                    </View>
                    <Text style={styles.breakdownValue}>
                      ₹{taxBreakdown.cgstAmount.toFixed(2)}
                    </Text>
                  </View>

                  {/* SGST 9% */}
                  <View style={styles.breakdownRow}>
                    <View style={{ gap: 1 }}>
                      <Text style={styles.breakdownLabel}>SGST (9%)</Text>
                      <Text style={styles.breakdownSub}>State Goods and Services Tax</Text>
                    </View>
                    <Text style={styles.breakdownValue}>
                      ₹{taxBreakdown.sgstAmount.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Total GST */}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.gstTotalLabel}>Total GST (18%)</Text>
                    <Text style={styles.gstTotalValue}>
                      ₹{taxBreakdown.totalGst.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.boldDivider} />

                  {/* Final Total Amount */}
                  <View style={styles.finalAmountRow}>
                    <View>
                      <Text style={styles.finalAmountLabel}>Amount</Text>
                      <Text style={styles.finalAmountSubLabel}>(Total Payable Incl. GST)</Text>
                    </View>
                    <Text style={styles.finalAmountValue}>
                      ₹{taxBreakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                {/* Billed To Card */}
                <View style={styles.shopInfoCard}>
                  <View style={styles.shopInfoRow}>
                    <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.shopInfoLabel}>Billed To:</Text>
                    <Text style={styles.shopInfoValue} numberOfLines={1}>
                      {shop.name || 'Counter365 Store'}
                    </Text>
                  </View>
                  {Boolean(shop.phone) && (
                    <View style={styles.shopInfoRow}>
                      <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.shopInfoLabel}>Contact:</Text>
                      <Text style={styles.shopInfoValue}>{shop.phone}</Text>
                    </View>
                  )}
                  <View style={styles.shopInfoRow}>
                    <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.shopInfoLabel}>Tax Category:</Text>
                    <Text style={styles.shopInfoValue}>Software as a Service (HSN/SAC 998313)</Text>
                  </View>
                </View>

                {statusMessage && (
                  <View style={styles.statusMessageBox}>
                    <Text style={styles.statusMessageText}>{statusMessage}</Text>
                  </View>
                )}

                {/* Secure Gateway Note */}
                <View style={styles.securityNote}>
                  <Ionicons name="shield-checkmark" size={15} color="#059669" />
                  <Text style={styles.securityText}>
                    100% Secure via Cashfree Payments &bull; UPI, Cards, NetBanking supported.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* BOTTOM ACTION FOOTER */}
          {!activeOrderId && (
            <View style={styles.footer}>
              {step === 'plans' ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setStep('summary')}
                    style={styles.payBtn}
                  >
                    <Text style={styles.payBtnText}>
                      Proceed to Order Summary &rarr;
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.footerHelpText}>
                    Selected: {selectedPlan.name} (&asymp; ₹{selectedBasePrice.toLocaleString('en-IN')} Excl. GST)
                  </Text>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleInitiatePayment}
                    disabled={isProcessing}
                    style={styles.payBtn}
                  >
                    {isProcessing ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.payBtnText}>Connecting to Cashfree...</Text>
                      </View>
                    ) : (
                      <Text style={styles.payBtnText}>
                        Pay ₹{taxBreakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via Cashfree
                      </Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.footerHelpText}>
                    Includes 18% GST (CGST 9% + SGST 9%) &bull; Instant Activation
                  </Text>
                </>
              )}
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
                <Text style={styles.webViewSubtitle}>
                  Counter365 {selectedPlan.name} &bull; ₹{taxBreakdown.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
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

                  // 1. Intercept payment return / deep link
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

                  // 2. Intercept UPI app direct schemes
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

                  // 3. Intercept Android Intent schemes
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
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    backButtonText: {
      fontSize: 13,
      fontFamily: typography.fonts.heading,
      color: colors.accent,
      fontWeight: '700',
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
      gap: 10,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    planCardSelected: {
      borderColor: colors.accent,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.08)' : '#FFF7ED',
      borderWidth: 2,
    },
    planCardPopular: {
      borderColor: colors.accent,
    },
    planCardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planLeftCol: {
      flex: 1,
      gap: 5,
    },
    planTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    planName: {
      fontSize: 16,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    planNameSelected: {
      color: colors.accent,
    },
    durationTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginLeft: 26,
    },
    durationBadge: {
      backgroundColor: isDark ? '#1F2937' : '#F1F5F9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    durationBadgeSelected: {
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.2)' : '#FFEDD5',
    },
    durationLabel: {
      fontSize: 11,
      fontFamily: typography.fonts.heading,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    durationLabelSelected: {
      color: colors.accent,
    },
    planRateSubText: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: typography.fonts.body,
    },
    planRightCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 1,
      paddingLeft: 8,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 2,
    },
    discountBadge: {
      backgroundColor: '#059669',
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    discountBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
    },
    popularBadge: {
      backgroundColor: colors.accent,
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    popularBadgeText: {
      color: '#FFFFFF',
      fontSize: 9.5,
      fontWeight: '800',
      fontFamily: typography.fonts.heading,
    },
    strikethroughNormal: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    priceWithSuffixRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    priceText: {
      fontSize: 20,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.text,
    },
    priceTextSelected: {
      color: colors.accent,
    },
    exclGstSuffix: {
      fontSize: 10,
      fontFamily: typography.fonts.body,
      color: colors.textMuted,
      fontWeight: '500',
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
    gstNoticeBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gstNoticeText: {
      flex: 1,
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    /* Step 2: Summary & Tax Invoice Styles */
    summaryPlanCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC',
      borderRadius: radii.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryPlanHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryPlanIconBox: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.15)' : '#FFF0E6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryPlanTitle: {
      fontSize: 16,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    summaryPlanDuration: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    instantPill: {
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#A7F3D0',
    },
    instantPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#059669',
      fontFamily: typography.fonts.heading,
    },

    taxInvoiceCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 12,
      ...shadows.sm,
    },
    taxInvoiceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
    },
    taxInvoiceHeading: {
      fontSize: 12,
      fontWeight: '800',
      fontFamily: typography.fonts.heading,
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    sacBadge: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.xs,
    },
    sacBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      fontFamily: typography.fonts.heading,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    breakdownLabel: {
      fontSize: 14,
      fontFamily: typography.fonts.body,
      color: colors.text,
      fontWeight: '600',
    },
    breakdownSub: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    breakdownValue: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      color: colors.text,
      fontWeight: '600',
    },
    discountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.1)' : '#F0FDF4',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.xs,
    },
    discountRowLabel: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: '#059669',
      fontWeight: '600',
    },
    discountRowValue: {
      fontSize: 12,
      fontFamily: typography.fonts.heading,
      color: '#059669',
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    boldDivider: {
      height: 1.5,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    gstTotalLabel: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      color: colors.text,
      fontWeight: '700',
    },
    gstTotalValue: {
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      color: colors.text,
      fontWeight: '700',
    },
    finalAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.12)' : '#FFF7ED',
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 95, 0, 0.3)' : '#FFEDD5',
    },
    finalAmountLabel: {
      fontSize: 15,
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: colors.text,
    },
    finalAmountSubLabel: {
      fontSize: 11,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
    },
    finalAmountValue: {
      fontSize: 22,
      fontFamily: typography.fonts.heading,
      fontWeight: '900',
      color: colors.accent,
    },

    shopInfoCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: radii.md,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    shopInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    shopInfoLabel: {
      fontSize: 12,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      width: 80,
    },
    shopInfoValue: {
      flex: 1,
      fontSize: 12,
      fontFamily: typography.fonts.body,
      fontWeight: '600',
      color: colors.text,
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
      textAlign: 'center',
      flexShrink: 1,
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
      gap: 6,
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
    footerHelpText: {
      fontSize: 11.5,
      fontFamily: typography.fonts.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    /* In-App WebView Modal Styles */
    webViewContainer: {
      flex: 1,
      backgroundColor: '#0F172A',
    },
    webViewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#1E293B',
      borderBottomWidth: 1,
      borderBottomColor: '#334155',
    },
    webViewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    webViewTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
    },
    webViewSubtitle: {
      color: '#94A3B8',
      fontSize: 12,
      fontFamily: typography.fonts.body,
    },
    webViewUpiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(2, 132, 199, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#0284C7',
    },
    webViewUpiBtnText: {
      color: '#0284C7',
      fontSize: 12,
      fontWeight: '700',
      fontFamily: typography.fonts.heading,
    },
    webViewCloseBtn: {
      padding: 6,
      borderRadius: radii.pill,
      backgroundColor: '#334155',
    },
    webViewLoader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0F172A',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 20,
    },
    webViewLoaderText: {
      color: '#94A3B8',
      fontSize: 14,
      fontFamily: typography.fonts.body,
    },
  });
};
