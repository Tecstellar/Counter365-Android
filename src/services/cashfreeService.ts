import { supabase } from '../lib/supabase';
import { SubscriptionPlanConfig, getSubscriptionPlanById } from '../constants/subscriptionPlans';
import { SubscriptionRecord } from '../types/models';

export interface CashfreeOrderResult {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  paymentUrl?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

export interface CashfreeVerifyResult {
  success: boolean;
  isPaid: boolean;
  orderStatus?: string;
  subscription?: SubscriptionRecord;
  error?: string;
  message?: string;
}

// Cashfree Gateway Configuration
const CF_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID || '';
const CF_SECRET_KEY = process.env.EXPO_PUBLIC_CASHFREE_SECRET_KEY || '';

const rawEnv = (process.env.EXPO_PUBLIC_CASHFREE_ENV || '').toUpperCase();
const isProdKey = CF_SECRET_KEY.toLowerCase().includes('prod');
const isTestKey = CF_SECRET_KEY.toLowerCase().includes('test');

export const CF_ENV = rawEnv === 'PROD' || isProdKey ? 'PROD' : (isTestKey ? 'TEST' : (rawEnv || 'PROD'));

export const CF_BASE_URL = CF_ENV === 'PROD'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

export const CF_CHECKOUT_URL = CF_ENV === 'PROD'
  ? 'https://payments.cashfree.com/order/#'
  : 'https://payments-test.cashfree.com/order/#';

// In-flight payment initiation lock to prevent duplicate orders from double-tapping
let isOrderInitiating = false;

export const cashfreeService = {
  /**
   * Initiates a Cashfree subscription payment order.
   * Runs through Supabase Edge Function where deployed, with secure direct PG API fallback.
   */
  async initiateOrder(
    plan: SubscriptionPlanConfig,
    shop: { id: string; name: string; phone?: string }
  ): Promise<CashfreeOrderResult> {
    if (isOrderInitiating) {
      return { success: false, error: 'A payment request is already in progress. Please wait.' };
    }

    isOrderInitiating = true;
    let lastError = '';

    try {
      const timestamp = Date.now();
      const cleanPhone = (shop.phone || '9999999999').replace(/[^0-9]/g, '').slice(-10);
      const safeOrderId = `cpro_${shop.id.replace(/-/g, '').slice(0, 8)}_${timestamp}`;

      // 1. Create order on Cashfree PG (/pg/orders)
      try {
        const orderPayload = {
          order_id: safeOrderId,
          order_amount: plan.price,
          order_currency: 'INR',
          customer_details: {
            customer_id: shop.id || 'cust_default',
            customer_name: (shop.name || 'Counter365').slice(0, 50),
            customer_phone: cleanPhone.length === 10 ? cleanPhone : '9999999999',
          },
          order_meta: {
            return_url: `counterpro://payment-return?order_id=${safeOrderId}`,
          },
          order_note: `Counter365 ${plan.name} Subscription`,
        };

        const cfRes = await fetch(`${CF_BASE_URL}/orders`, {
          method: 'POST',
          headers: {
            'x-client-id': CF_APP_ID,
            'x-client-secret': CF_SECRET_KEY,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        const cfData = await cfRes.json();

        if (cfRes.ok && cfData.payment_session_id) {
          const directCheckoutUrl = `${CF_CHECKOUT_URL}${cfData.payment_session_id}`;
          console.log('[Cashfree] Generated Direct Checkout URL:', directCheckoutUrl);

          return {
            success: true,
            orderId: safeOrderId,
            paymentSessionId: cfData.payment_session_id,
            paymentUrl: directCheckoutUrl,
            amount: plan.price,
            currency: 'INR',
          };
        } else {
          lastError = cfData?.message || cfData?.error || 'Cashfree payment session creation failed';
          console.warn('[Cashfree] Orders API error response:', cfData);
        }
      } catch (orderErr: any) {
        lastError = orderErr?.message || 'Cashfree connection error';
        console.warn('[Cashfree] Direct Orders API error:', orderErr);
      }

      // 2. Fallback to Supabase Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('cashfree-subscription', {
          body: {
            action: 'create_order',
            planId: plan.id,
            shopId: shop.id,
            shopName: shop.name,
            customerPhone: shop.phone || '9999999999',
          },
        });

        if (!error && data && data.success && data.paymentUrl && !data.paymentUrl.includes('/order/#')) {
          return {
            success: true,
            orderId: data.orderId,
            paymentUrl: data.paymentUrl,
            amount: data.amount,
            currency: data.currency || 'INR',
          };
        }
      } catch (edgeErr) {
        console.warn('Edge function fallback error:', edgeErr);
      }

      return {
        success: false,
        error: lastError || 'Unable to generate payment link. Please check your network and Cashfree credentials.',
      };
    } catch (err: any) {
      console.error('cashfreeService initiateOrder exception:', err);
      return {
        success: false,
        error: err.message || 'Unable to connect to Cashfree payment gateway. Please check your internet connection.',
      };
    } finally {
      isOrderInitiating = false;
    }
  },

  /**
   * Verifies the order payment status with Cashfree.
   * Only activates the subscription if the order is genuinely verified as PAID.
   */
  async verifyOrder(
    orderId: string,
    shopId: string,
    planId: string
  ): Promise<CashfreeVerifyResult> {
    try {
      // 1. Try Supabase Edge Function first
      try {
        const { data, error } = await supabase.functions.invoke('cashfree-subscription', {
          body: {
            action: 'verify_order',
            orderId,
            shopId,
            planId,
          },
        });

        if (!error && data && data.success) {
          return {
            success: true,
            isPaid: !!data.isPaid,
            orderStatus: data.orderStatus || (data.isPaid ? 'PAID' : 'PENDING'),
            subscription: data.subscription,
            message: data.message,
          };
        }
      } catch (edgeErr) {
        console.warn('Edge function verify not reachable, checking directly with Cashfree PG:', edgeErr);
      }

      // 2. Direct Cashfree PG Verification: Check /pg/orders/{orderId}
      const cfHeaders = {
        'x-client-id': CF_APP_ID,
        'x-client-secret': CF_SECRET_KEY,
        'x-api-version': '2023-08-01',
      };

      const orderRes = await fetch(`${CF_BASE_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: cfHeaders,
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const orderStatus = orderData.order_status;
        if (orderStatus === 'PAID') {
          return {
            success: true,
            isPaid: true,
            orderStatus: 'PAID',
            message: 'Payment verified successfully.',
          };
        }
        return {
          success: true,
          isPaid: false,
          orderStatus: orderStatus || 'PENDING',
          message: `Payment status is ${orderStatus || 'PENDING'}. Please complete the transaction in Cashfree and tap Verify.`,
        };
      }

      // Fallback: Check /pg/links/{orderId}
      try {
        const linkRes = await fetch(`${CF_BASE_URL}/links/${orderId}`, {
          method: 'GET',
          headers: cfHeaders,
        });

        if (linkRes.ok) {
          const linkData = await linkRes.json();
          const linkStatus = linkData.link_status;
          if (linkStatus === 'PAID') {
            return {
              success: true,
              isPaid: true,
              orderStatus: 'PAID',
              message: 'Payment verified successfully.',
            };
          }
        }
      } catch (_) {}

      // 3. Fallback: check Supabase subscription directly
      const { data: currentSub } = await (supabase.from('subscriptions') as any)
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (currentSub && currentSub.payment_reference === orderId && currentSub.status === 'active') {
        return {
          success: true,
          isPaid: true,
          orderStatus: 'PAID',
        };
      }

      return {
        success: true,
        isPaid: false,
        orderStatus: 'PENDING',
        message: 'Payment verification in progress. Please check again after completing the transaction.',
      };
    } catch (err: any) {
      console.error('cashfreeService verifyOrder exception:', err);
      return {
        success: false,
        isPaid: false,
        error: err.message || 'Unable to verify payment status with Cashfree.',
      };
    }
  },
};
