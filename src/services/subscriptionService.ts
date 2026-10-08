import { supabase } from '../lib/supabase';
import {
  SubscriptionRecord,
  SubscriptionStatusInfo,
  SubscriptionPlanId,
} from '../types/models';
import { getSubscriptionPlanById, SUBSCRIPTION_PLANS } from '../constants/subscriptionPlans';

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
    let activePlanName = 'Free Tier (100 Bills)';
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
    paymentRef?: string
  ): Promise<{
    success: boolean;
    subscription?: SubscriptionRecord;
    statusInfo?: SubscriptionStatusInfo;
    error?: string;
  }> {
    const planConfig = getSubscriptionPlanById(planId);
    if (!planConfig) {
      return { success: false, error: 'Invalid subscription plan selected' };
    }

    try {
      const now = new Date();
      const startDate = now.toISOString();
      const durationMs = planConfig.durationMonths * 30 * 24 * 60 * 60 * 1000;
      const endDate = new Date(now.getTime() + durationMs).toISOString();

      // Upsert into Supabase subscriptions table (use 'pro' to satisfy DB check constraint)
      const upsertPayload: any = {
        shop_id: shopId,
        plan: 'pro',
        status: 'active',
        amount: planConfig.price,
        interval: planConfig.name,
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
        upsertPayload.duration_months = planConfig.durationMonths;
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
          amount: planConfig.price,
          interval: planConfig.name,
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
        durationMonths: data.duration_months || planConfig.durationMonths,
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
};
