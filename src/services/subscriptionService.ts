import { supabase } from '../lib/supabase';
import {
  SubscriptionRecord,
  SubscriptionStatusInfo,
  SubscriptionPlanId,
} from '../types/models';
import {
  getSubscriptionPlanById,
  SUBSCRIPTION_PLANS,
  getLaunchOfferPlanById,
  LAUNCH_OFFER_PLANS,
  isShopEligibleForLaunchOffer,
  LaunchOfferPlanConfig,
} from '../constants/subscriptionPlans';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDatePretty(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export const FREE_BILLS_LIMIT = 100;

export const subscriptionService = {
  /**
   * Authoritative server time to prevent client clock manipulation
   */
  async getServerTime(): Promise<Date> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_server_time');
      if (!error && data) {
        return new Date(data);
      }
    } catch (_) {}
    return new Date();
  },

  /**
   * Authoritative check for Launch Offer eligibility (30-day window from shop registration)
   */
  async checkLaunchOfferEligibility(
    shopId?: string,
    shopCreatedAt?: string | null
  ): Promise<{
    isEligible: boolean;
    daysRemaining: number;
    hoursRemaining: number;
    secondsRemaining: number;
    eligibleUntil: Date;
    serverTime: Date;
  }> {
    const serverNow = await this.getServerTime();

    if (shopId) {
      try {
        const { data, error } = await (supabase.rpc as any)('check_launch_offer_eligibility', {
          p_shop_id: shopId,
        });
        if (!error && data && data.success) {
          return {
            isEligible: !!data.is_eligible,
            daysRemaining: Number(data.days_remaining) || 0,
            hoursRemaining: Math.max(0, Math.ceil(Number(data.seconds_remaining || 0) / 3600)),
            secondsRemaining: Number(data.seconds_remaining) || 0,
            eligibleUntil: new Date(data.eligible_until),
            serverTime: new Date(data.server_now || serverNow),
          };
        }
      } catch (_) {}
    }

    const res = isShopEligibleForLaunchOffer(shopCreatedAt, serverNow);
    return {
      ...res,
      serverTime: serverNow,
    };
  },

  /**
   * Authoritative calculation of free bills tier (100 bills limit) and subscription status.
   * Total bills created (active + deleted) is the source of truth for the free tier limit.
   */
  calculateSubscriptionStatus(
    shopCreatedAt?: string | null,
    subscription?: SubscriptionRecord | null,
    now: Date = new Date(),
    totalBillsCreated: number = 0
  ): SubscriptionStatusInfo {
    const registrationTime = shopCreatedAt ? new Date(shopCreatedAt).getTime() : now.getTime();
    const trialStartDate = new Date(isNaN(registrationTime) ? now.getTime() : registrationTime);
    const trialEndDate = new Date(trialStartDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const currentTimeMs = now.getTime();

    // 1. Check for active paid subscription
    let isPaidActive = false;
    let isPaidExpired = false;
    let activePlanName = 'Starter Quota (100 Bills)';
    let activePlanPrice = 0;
    let subscriptionStartDate: Date | undefined;
    let subscriptionEndDate: Date | undefined;
    let subscriptionEndDateFormatted: string | undefined;

    if (subscription && subscription.plan !== 'free' && subscription.status === 'active') {
      const endStr = subscription.subscriptionEndAt || subscription.currentPeriodEnd;
      const startStr = subscription.subscriptionStartAt || subscription.currentPeriodStart || subscription.createdAt;

      if (endStr) {
        const subEnd = new Date(endStr);
        const subStart = startStr ? new Date(startStr) : trialStartDate;

        if (!isNaN(subEnd.getTime())) {
          subscriptionEndDate = subEnd;
          subscriptionStartDate = subStart;
          subscriptionEndDateFormatted = formatDatePretty(subEnd);

          if (currentTimeMs < subEnd.getTime()) {
            isPaidActive = true;
            isPaidExpired = false;
            const planConfig = getSubscriptionPlanById(subscription.plan);
            activePlanName = planConfig
              ? `${planConfig.name} Plan`
              : `${subscription.interval || 'Pro'} Plan`;
            activePlanPrice = subscription.amount || (planConfig ? planConfig.price : 0);
          } else {
            isPaidActive = false;
            isPaidExpired = true;
          }
        }
      }
    }

    const billsLimit = FREE_BILLS_LIMIT;
    const billsRemaining = Math.max(0, billsLimit - totalBillsCreated);
    const billLimitReached = totalBillsCreated >= billsLimit;

    // 2. Free tier / trial access check (replaces 30-day trial with 100 bills limit)
    // If a paid subscription has expired, access is blocked and renewal is required.
    const isTrialActive = !isPaidActive && !isPaidExpired && !billLimitReached;
    const isTrialExpired = !isPaidActive && (billLimitReached || isPaidExpired);
    const hasAccess = isPaidActive || (!isPaidExpired && !billLimitReached);
    const requiresSubscription = !hasAccess;

    // 3. Progress and metrics
    let dayOfTrial = Math.min(billsLimit, totalBillsCreated);
    let daysRemaining = billsRemaining;
    let progressPercent = 0;

    if (isPaidActive && subscriptionStartDate && subscriptionEndDate) {
      const totalSubMs = Math.max(1, subscriptionEndDate.getTime() - subscriptionStartDate.getTime());
      const elapsedSubMs = Math.max(0, currentTimeMs - subscriptionStartDate.getTime());
      progressPercent = Math.min(100, Math.max(0, (elapsedSubMs / totalSubMs) * 100));
      daysRemaining = Math.max(0, Math.ceil((subscriptionEndDate.getTime() - currentTimeMs) / (24 * 60 * 60 * 1000)));
      dayOfTrial = 100;
    } else if (isTrialActive) {
      progressPercent = Math.min(100, Math.max(0, (totalBillsCreated / billsLimit) * 100));
      dayOfTrial = totalBillsCreated;
      daysRemaining = billsRemaining;
    } else {
      progressPercent = 100;
      dayOfTrial = billsLimit;
      daysRemaining = 0;
    }

    return {
      isTrialActive,
      isTrialExpired,
      isPaidActive,
      isPaidExpired,
      hasAccess,
      requiresSubscription,
      dayOfTrial,
      daysRemaining,
      progressPercent,
      trialStartDate,
      trialEndDate,
      trialEndDateFormatted: formatDatePretty(trialEndDate),
      activePlanName,
      activePlanPrice,
      subscriptionStartDate,
      subscriptionEndDate,
      subscriptionEndDateFormatted,
      totalBillsCreated,
      billsLimit,
      billsRemaining,
      billLimitReached,
    };
  },

  /**
   * Fetches real subscription from Supabase for a shop.
   * Auto-initializes trial record in Supabase if none exists yet.
   */
  async getShopSubscription(
    shopId: string,
    shopCreatedAt?: string | null,
    totalBillsCreated: number = 0
  ): Promise<{
    subscription: SubscriptionRecord | null;
    statusInfo: SubscriptionStatusInfo;
  }> {
    if (!shopId) {
      const fallbackStatus = this.calculateSubscriptionStatus(shopCreatedAt, null, new Date(), totalBillsCreated);
      return { subscription: null, statusInfo: fallbackStatus };
    }

    try {
      // 1. Fetch subscription from Supabase
      const { data, error } = await (supabase.from('subscriptions') as any)
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getShopSubscription error:', error.message);
      }

      let subRecord: SubscriptionRecord | null = null;

      if (data) {
        subRecord = {
          id: data.id,
          shopId: data.shop_id,
          plan: data.plan as SubscriptionPlanId,
          status: data.status,
          amount: Number(data.amount) || 0,
          interval: data.interval || 'month',
          trialStartAt: data.trial_start_at || data.current_period_start || null,
          trialEndAt: data.trial_end_at || data.current_period_end || null,
          subscriptionStartAt: data.subscription_start_at || null,
          subscriptionEndAt: data.subscription_end_at || null,
          currentPeriodStart: data.current_period_start || null,
          currentPeriodEnd: data.current_period_end || null,
          paymentReference: data.payment_reference || null,
          cashfreeOrderId: data.cashfree_order_id || null,
          currency: data.currency || 'INR',
          durationMonths: data.duration_months || 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      } else {
        // Auto-initialize real subscription record in Supabase
        const regDate = shopCreatedAt ? new Date(shopCreatedAt) : new Date();
        const trialEndDate = new Date(regDate.getTime() + 365 * 24 * 60 * 60 * 1000);

        const initPayload: any = {
          shop_id: shopId,
          plan: 'free',
          status: 'active',
          amount: 0,
          interval: 'lifetime',
          current_period_start: regDate.toISOString(),
          current_period_end: trialEndDate.toISOString(),
        };

        const { data: created, error: createErr } = await (supabase.from('subscriptions') as any)
          .insert(initPayload)
          .select()
          .single();

        if (!createErr && created) {
          subRecord = {
            id: created.id,
            shopId: created.shop_id,
            plan: 'free',
            status: 'active',
            amount: 0,
            interval: 'lifetime',
            currentPeriodStart: created.current_period_start,
            currentPeriodEnd: created.current_period_end,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };
        }
      }

      const statusInfo = this.calculateSubscriptionStatus(shopCreatedAt, subRecord, new Date(), totalBillsCreated);
      return { subscription: subRecord, statusInfo };
    } catch (err: any) {
      console.warn('subscriptionService getShopSubscription exception:', err);
      const fallbackStatus = this.calculateSubscriptionStatus(shopCreatedAt, null, new Date(), totalBillsCreated);
      return { subscription: null, statusInfo: fallbackStatus };
    }
  },

  /**
   * Activates paid subscription in Supabase upon successful Cashfree verification.
   * Safe, idempotent mutation that updates database as source of truth.
   */
  async activatePaidSubscription(
    shopId: string,
    planId: SubscriptionPlanId,
    orderId: string,
    paymentRef?: string,
    isLaunchOffer?: boolean
  ): Promise<{
    success: boolean;
    subscription?: SubscriptionRecord;
    statusInfo?: SubscriptionStatusInfo;
    error?: string;
  }> {
    let price = 0;
    let durationMonths = 3;
    let planName = 'Pro';

    if (isLaunchOffer) {
      const elig = await this.checkLaunchOfferEligibility(shopId);
      if (!elig.isEligible) {
        return {
          success: false,
          error: 'Launch offer eligibility period (30 days from registration) has expired for this shop.',
        };
      }
      const launchPlan = getLaunchOfferPlanById(planId);
      if (!launchPlan) {
        return { success: false, error: 'Invalid launch offer plan selected' };
      }
      price = launchPlan.launchPrice;
      durationMonths = launchPlan.durationMonths;
      planName = `${launchPlan.name} (Launch Offer)`;
    } else {
      const planConfig = getSubscriptionPlanById(planId);
      if (!planConfig) {
        return { success: false, error: 'Invalid subscription plan selected' };
      }
      price = planConfig.price;
      durationMonths = planConfig.durationMonths;
      planName = planConfig.name;
    }

    try {
      const now = await this.getServerTime();
      const startDate = now.toISOString();
      const durationMs = durationMonths * 30 * 24 * 60 * 60 * 1000;
      const endDate = new Date(now.getTime() + durationMs).toISOString();

      // Upsert into Supabase subscriptions table (use 'pro' to satisfy DB check constraint)
      const upsertPayload: any = {
        shop_id: shopId,
        plan: 'pro',
        status: 'active',
        amount: price,
        interval: planName,
        current_period_start: startDate,
        current_period_end: endDate,
        updated_at: startDate,
      };

      // Also set extended fields if column exists in schema
      try {
        upsertPayload.trial_end_at = endDate;
        upsertPayload.subscription_start_at = startDate;
        upsertPayload.subscription_end_at = endDate;
        upsertPayload.payment_reference = paymentRef || orderId;
        upsertPayload.cashfree_order_id = orderId;
        upsertPayload.currency = 'INR';
        upsertPayload.duration_months = durationMonths;
      } catch (_) {}

      const { data, error } = await (supabase.from('subscriptions') as any)
        .upsert(upsertPayload, { onConflict: 'shop_id' })
        .select()
        .single();

      if (error) {
        // If some extended columns do not exist yet on remote, retry with baseline columns
        const baselinePayload = {
          shop_id: shopId,
          plan: 'pro',
          status: 'active',
          amount: price,
          interval: planName,
          current_period_start: startDate,
          current_period_end: endDate,
          updated_at: startDate,
        };

        const { data: retryData, error: retryError } = await (supabase.from('subscriptions') as any)
          .upsert(baselinePayload, { onConflict: 'shop_id' })
          .select()
          .single();

        if (retryError) {
          throw new Error(retryError.message);
        }

        const subRecord: SubscriptionRecord = {
          id: retryData.id,
          shopId: retryData.shop_id,
          plan: retryData.plan as SubscriptionPlanId,
          status: retryData.status,
          amount: retryData.amount,
          interval: retryData.interval,
          currentPeriodStart: retryData.current_period_start,
          currentPeriodEnd: retryData.current_period_end,
          subscriptionStartAt: startDate,
          subscriptionEndAt: endDate,
          paymentReference: paymentRef || orderId,
          cashfreeOrderId: orderId,
          createdAt: retryData.created_at,
          updatedAt: retryData.updated_at,
        };

        const statusInfo = this.calculateSubscriptionStatus(null, subRecord, now);
        return { success: true, subscription: subRecord, statusInfo };
      }

      const subRecord: SubscriptionRecord = {
        id: data.id,
        shopId: data.shop_id,
        plan: data.plan as SubscriptionPlanId,
        status: data.status,
        amount: data.amount,
        interval: data.interval,
        trialStartAt: data.trial_start_at,
        trialEndAt: data.trial_end_at,
        subscriptionStartAt: data.subscription_start_at || startDate,
        subscriptionEndAt: data.subscription_end_at || endDate,
        currentPeriodStart: data.current_period_start || startDate,
        currentPeriodEnd: data.current_period_end || endDate,
        paymentReference: data.payment_reference || orderId,
        cashfreeOrderId: data.cashfree_order_id || orderId,
        currency: data.currency || 'INR',
        durationMonths: data.duration_months || durationMonths,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      const statusInfo = this.calculateSubscriptionStatus(null, subRecord, now);
      return { success: true, subscription: subRecord, statusInfo };
    } catch (err: any) {
      console.error('subscriptionService activatePaidSubscription error:', err);
      return { success: false, error: err.message || 'Failed to activate subscription' };
    }
  },

  /**
   * Manual Admin-side Pro plan activation with extension logic
   * Supports Launch Offer prices (₹2,999 / ₹4,799 / ₹5,999) when eligible,
   * or regular prices (₹2,999 / ₹5,999 / ₹11,999 or ₹1,499 / ₹2,799 / ₹4,999).
   * For active plans, extends from current expiry; for expired/free, starts from now.
   */
  async activateManualProSubscription(params: {
    shopId: string;
    adminId?: string;
    durationMonths: 3 | 6 | 12;
    paymentRef?: string;
    adminNotes?: string;
    isLaunchOffer?: boolean;
  }): Promise<{
    success: boolean;
    subscription?: SubscriptionRecord;
    statusInfo?: SubscriptionStatusInfo;
    error?: string;
  }> {
    const { shopId, adminId, durationMonths, paymentRef, adminNotes, isLaunchOffer } = params;

    const launchPrices: Record<number, number> = {
      3: 2999,
      6: 4799,
      12: 5999,
    };
    const regularPrices: Record<number, number> = {
      3: 1499,
      6: 2799,
      12: 4999,
    };

    if (isLaunchOffer) {
      const elig = await this.checkLaunchOfferEligibility(shopId);
      if (!elig.isEligible) {
        return {
          success: false,
          error: 'Launch offer eligibility period (30 days from registration) has expired for this shop.',
        };
      }
    }

    const amount = isLaunchOffer
      ? (launchPrices[durationMonths] || 2999)
      : (regularPrices[durationMonths] || 2999);
    const planName = isLaunchOffer ? `${durationMonths} Months (Launch Offer)` : `${durationMonths} Months`;

    // 1. Try server RPC first
    try {
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        'activate_manual_pro_subscription',
        {
          p_shop_id: shopId,
          p_admin_id: adminId || null,
          p_duration_months: durationMonths,
          p_payment_ref: paymentRef || `OFFLINE_CASH_${Date.now()}`,
          p_admin_notes: adminNotes || 'Offline cash/UPI verified by admin',
          p_is_launch_offer: !!isLaunchOffer,
        }
      );

      if (!rpcError && rpcData?.success) {
        let { subscription } = await this.getShopSubscription(shopId);
        if (!subscription) {
          const nowIso = (await this.getServerTime()).toISOString();
          const endIso = new Date(Date.now() + durationMonths * 30 * 86400000).toISOString();
          subscription = {
            id: `sub_${Date.now()}`,
            shopId,
            plan: 'pro',
            status: 'active',
            amount,
            interval: planName,
            currentPeriodStart: nowIso,
            currentPeriodEnd: endIso,
            subscriptionStartAt: nowIso,
            subscriptionEndAt: endIso,
            durationMonths,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
        } else {
          subscription.durationMonths = durationMonths;
          subscription.amount = amount;
          subscription.interval = planName;
        }
        const statusInfo = this.calculateSubscriptionStatus(null, subscription);
        return { success: true, subscription, statusInfo };
      }
    } catch (rpcErr) {
      console.warn('activate_manual_pro_subscription RPC fallback notice:', rpcErr);
    }

    // 2. Direct client fallback with extension logic
    try {
      const { subscription: existing } = await this.getShopSubscription(shopId);
      const now = new Date();
      let start = now;
      let end = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

      // If active plan exists and has not expired, extend from existing expiry!
      if (
        existing &&
        existing.status === 'active' &&
        existing.plan !== 'free' &&
        existing.currentPeriodEnd
      ) {
        const existingEnd = new Date(existing.currentPeriodEnd);
        if (existingEnd.getTime() > now.getTime()) {
          start = existing.currentPeriodStart ? new Date(existing.currentPeriodStart) : now;
          end = new Date(existingEnd.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
        }
      }

      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const finalPaymentRef = paymentRef || `OFFLINE_ADMIN_${Date.now()}`;

      const payload: any = {
        shop_id: shopId,
        plan: 'pro',
        status: 'active',
        amount,
        interval: `${durationMonths} Months`,
        payment_method: 'Offline Admin',
        activated_by_admin_id: adminId || null,
        admin_notes: adminNotes || 'Manual offline activation',
        payment_reference: finalPaymentRef,
        current_period_start: startIso,
        current_period_end: endIso,
        subscription_start_at: startIso,
        subscription_end_at: endIso,
        duration_months: durationMonths,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase.from('subscriptions') as any)
        .upsert(payload, { onConflict: 'shop_id' })
        .select()
        .single();

      if (error) {
        // Retry with baseline columns if some columns are missing
        const baseline = {
          shop_id: shopId,
          plan: 'pro',
          status: 'active',
          amount,
          interval: `${durationMonths} Months`,
          current_period_start: startIso,
          current_period_end: endIso,
          updated_at: new Date().toISOString(),
        };
        const { error: rErr } = await (supabase.from('subscriptions') as any)
          .upsert(baseline, { onConflict: 'shop_id' })
          .select()
          .single();
        if (rErr) throw new Error(rErr.message);
      }

      // Record audit log
      try {
        await (supabase.from('audit_logs') as any).insert({
          shop_id: shopId,
          actor_id: adminId || null,
          actor_name: 'Administrator',
          action: 'subscription.manual_activation',
          entity_type: 'subscription',
          details: {
            durationMonths,
            amount,
            startIso,
            endIso,
            paymentRef: finalPaymentRef,
            adminNotes,
          },
        });
      } catch (_) {}

      const subRecord: SubscriptionRecord = {
        id: data?.id || `sub_${Date.now()}`,
        shopId,
        plan: 'pro',
        status: 'active',
        amount,
        interval: `${durationMonths} Months`,
        currentPeriodStart: startIso,
        currentPeriodEnd: endIso,
        subscriptionStartAt: startIso,
        subscriptionEndAt: endIso,
        paymentReference: finalPaymentRef,
        paymentMethod: 'Offline Admin',
        activatedByAdminId: adminId,
        adminNotes,
        durationMonths,
        createdAt: data?.created_at || startIso,
        updatedAt: data?.updated_at || startIso,
      };

      const statusInfo = this.calculateSubscriptionStatus(null, subRecord, now);
      return { success: true, subscription: subRecord, statusInfo };
    } catch (fallbackErr: any) {
      console.error('Manual Pro activation error:', fallbackErr);
      return { success: false, error: fallbackErr.message || 'Manual activation failed' };
    }
  },

  /**
   * Fetch all subscription history records for this shop from Supabase
   */
  async getSubscriptionHistory(shopId: string): Promise<SubscriptionRecord[]> {
    if (!shopId) return [];
    try {
      const { data, error } = await (supabase.from('subscriptions') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          shopId: d.shop_id,
          plan: d.plan as SubscriptionPlanId,
          status: d.status,
          amount: d.amount || 0,
          interval: d.interval || (d.plan === 'free' ? 'Starter 100 Quota' : 'Pro'),
          trialStartAt: d.trial_start_at,
          trialEndAt: d.trial_end_at,
          subscriptionStartAt: d.subscription_start_at || d.current_period_start,
          subscriptionEndAt: d.subscription_end_at || d.current_period_end,
          currentPeriodStart: d.current_period_start,
          currentPeriodEnd: d.current_period_end,
          paymentReference: d.payment_reference || d.cashfree_order_id,
          cashfreeOrderId: d.cashfree_order_id,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err) {
      console.warn('getSubscriptionHistory query notice:', err);
    }
    return [];
  },
};
