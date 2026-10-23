import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { SubscriptionPlanConfig } from '../constants/subscriptionPlans';
import { SubscriptionRecord } from '../types/models';

export interface PayUOrderResult {
  success: boolean;
  orderId?: string;
  paymentHtml?: string;
  paymentUrl?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

export interface PayUVerifyResult {
  success: boolean;
  isPaid: boolean;
  orderStatus?: string;
  subscription?: SubscriptionRecord;
  error?: string;
  message?: string;
}

// PayU Gateway Configuration
export const PAYU_KEY = process.env.EXPO_PUBLIC_PAYU_KEY || 'eCLL4q';
export const PAYU_SALT = process.env.EXPO_PUBLIC_PAYU_SALT || 'lrHveqnRWPtk84SfL7J9GIv738BO3FEo';
export const PAYU_MERCHANT_ID = process.env.EXPO_PUBLIC_PAYU_MERCHANT_ID || '87958193';

const rawEnv = (process.env.EXPO_PUBLIC_PAYU_ENV || 'TEST').toUpperCase();
export const PAYU_ENV = rawEnv === 'PROD' || rawEnv === 'PRODUCTION' ? 'PROD' : 'TEST';

export const PAYU_BASE_URL = PAYU_ENV === 'PROD'
  ? 'https://secure.payu.in/_payment'
  : 'https://test.payu.in/_payment';

export const PAYU_VERIFY_URL = PAYU_ENV === 'PROD'
  ? 'https://info.payu.in/merchant/postservice?form=2'
  : 'https://test.payu.in/merchant/postservice?form=2';

// In-flight payment initiation lock to prevent duplicate orders from double-tapping
let isOrderInitiating = false;

/**
 * Calculates cryptographic SHA-512 digest in lowercase hex format.
 * Native Expo support via expo-crypto with Node.js crypto fallback for Jest tests.
 */
export async function calculateSha512(text: string): Promise<string> {
  try {
    if (Crypto && typeof Crypto.digestStringAsync === 'function') {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA512,
        text
      );
      return digest.toLowerCase();
    }
  } catch (_) {
    // Fallback if expo-crypto is running under Node/Jest
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return nodeCrypto.createHash('sha512').update(text).digest('hex').toLowerCase();
    }
  } catch (_) {}

  throw new Error('SHA-512 cryptographic provider is not available.');
}

/**
 * Generates an auto-submitting HTML form string that posts to PayU hosted checkout.
 */
function buildPayUHtmlForm(params: {
  actionUrl: string;
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
}): string {
  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>PayU Checkout</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background-color: #0F172A;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
    }
    .spinner {
      width: 52px;
      height: 52px;
      border: 4px solid rgba(255, 255, 255, 0.15);
      border-top-color: #F97316;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 13px;
      color: #94A3B8;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    .badge {
      display: inline-block;
      background: rgba(249, 115, 22, 0.15);
      color: #FB923C;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(249, 115, 22, 0.3);
    }
    .btn {
      margin-top: 24px;
      background: #F97316;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="title">Connecting to PayU...</div>
  <div class="subtitle">Please do not refresh or press back.<br>Preparing secure checkout for ₹${escapeHtml(params.amount)}</div>
  <div class="badge">UPI • Google Pay • PhonePe • Cards • NetBanking</div>

  <form id="payu_checkout_form" method="POST" action="${escapeHtml(params.actionUrl)}">
    <input type="hidden" name="key" value="${escapeHtml(params.key)}" />
    <input type="hidden" name="txnid" value="${escapeHtml(params.txnid)}" />
    <input type="hidden" name="amount" value="${escapeHtml(params.amount)}" />
    <input type="hidden" name="productinfo" value="${escapeHtml(params.productinfo)}" />
    <input type="hidden" name="firstname" value="${escapeHtml(params.firstname)}" />
    <input type="hidden" name="email" value="${escapeHtml(params.email)}" />
    <input type="hidden" name="phone" value="${escapeHtml(params.phone)}" />
    <input type="hidden" name="surl" value="${escapeHtml(params.surl)}" />
    <input type="hidden" name="furl" value="${escapeHtml(params.furl)}" />
    <input type="hidden" name="hash" value="${escapeHtml(params.hash)}" />
    <input type="hidden" name="udf1" value="${escapeHtml(params.udf1)}" />
    <input type="hidden" name="udf2" value="${escapeHtml(params.udf2)}" />
    <input type="hidden" name="udf3" value="${escapeHtml(params.udf3)}" />
    <input type="hidden" name="udf4" value="${escapeHtml(params.udf4)}" />
    <input type="hidden" name="udf5" value="${escapeHtml(params.udf5)}" />
    <noscript>
      <button type="submit" class="btn">Proceed to Pay</button>
    </noscript>
  </form>

  <script>
    (function() {
      try {
        var form = document.getElementById('payu_checkout_form');
        if (form) {
          form.submit();
        }
      } catch (err) {
        console.error('Auto-submit error:', err);
      }
    })();
  </script>
</body>
</html>`;
}

export const payuService = {
  PAYU_KEY,
  PAYU_SALT,
  PAYU_ENV,
  PAYU_BASE_URL,
  PAYU_VERIFY_URL,

  /**
   * Initiates a PayU subscription payment order.
   * Generates a deterministic, unique transaction ID and SHA-512 payment hash.
   */
  async initiateOrder(
    plan: SubscriptionPlanConfig,
    shop: { id: string; name: string; phone?: string; email?: string }
  ): Promise<PayUOrderResult> {
    if (isOrderInitiating) {
      return { success: false, error: 'A payment request is already in progress. Please wait.' };
    }

    isOrderInitiating = true;

    try {
      const timestamp = Date.now();
      const shopPrefix = (shop.id || 'shop').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
      const safeTxnId = `cpro_${shopPrefix}_${timestamp}`;

      const formattedAmount = Number(plan.price || 0).toFixed(2);
      const cleanPhone = (shop.phone || '9999999999').replace(/[^0-9]/g, '').slice(-10);
      const validPhone = cleanPhone.length === 10 ? cleanPhone : '9999999999';

      const cleanName = (shop.name || 'Counter365')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .slice(0, 50) || 'Counter365 Customer';

      const email = shop.email && shop.email.includes('@')
        ? shop.email
        : 'billing@counterpro.app';

      const productInfo = `Counter365 ${plan.name} Subscription`;
      const returnUrl = `https://counterpro.app/payment-return?order_id=${safeTxnId}`;

      const udf1 = shop.id || '';
      const udf2 = plan.id || '';
      const udf3 = 'subscription';
      const udf4 = 'Counter365';
      const udf5 = '';

      // Standard PayU Hash sequence:
      // sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
      const hashString = [
        PAYU_KEY,
        safeTxnId,
        formattedAmount,
        productInfo,
        cleanName,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
        '', // udf6
        '', // udf7
        '', // udf8
        '', // udf9
        '', // udf10
        PAYU_SALT,
      ].join('|');

      const paymentHash = await calculateSha512(hashString);

      const paymentHtml = buildPayUHtmlForm({
        actionUrl: PAYU_BASE_URL,
        key: PAYU_KEY,
        txnid: safeTxnId,
        amount: formattedAmount,
        productinfo: productInfo,
        firstname: cleanName,
        email,
        phone: validPhone,
        surl: returnUrl,
        furl: returnUrl,
        hash: paymentHash,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
      });

      return {
        success: true,
        orderId: safeTxnId,
        paymentHtml,
        paymentUrl: PAYU_BASE_URL,
        amount: Number(formattedAmount),
        currency: 'INR',
      };
    } catch (err: any) {
      console.error('payuService initiateOrder exception:', err);
      return {
        success: false,
        error: err.message || 'Unable to connect to PayU payment gateway. Please check your internet connection.',
      };
    } finally {
      isOrderInitiating = false;
    }
  },

  /**
   * Verifies the order payment status with PayU.
   * Uses PayU verify_payment Server-to-Server command API and checks Supabase persistence.
   */
  async verifyOrder(
    orderId: string,
    shopId: string,
    planId: string
  ): Promise<PayUVerifyResult> {
    try {
      // 1. Try Supabase Edge Function first if deployed
      try {
        const { data, error } = await supabase.functions.invoke('payu-subscription', {
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
        console.warn('PayU Edge function verify not reachable, checking directly with PayU S2S:', edgeErr);
      }

      // 2. Direct PayU Server-to-Server Verification (verify_payment command)
      // Hash formula: sha512(key|command|var1|salt)
      const command = 'verify_payment';
      const verifyHashStr = `${PAYU_KEY}|${command}|${orderId}|${PAYU_SALT}`;
      const verifyHash = await calculateSha512(verifyHashStr);

      const postBody = new URLSearchParams({
        key: PAYU_KEY,
        command,
        var1: orderId,
        hash: verifyHash,
      });

      const res = await fetch(PAYU_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postBody.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        const details = data?.transaction_details?.[orderId];

        if (details) {
          const status = (details.status || '').toLowerCase();
          if (status === 'success') {
            return {
              success: true,
              isPaid: true,
              orderStatus: 'PAID',
              message: 'Payment verified successfully.',
            };
          }
          if (status === 'failure' || status === 'failed') {
            return {
              success: true,
              isPaid: false,
              orderStatus: 'FAILED',
              message: details.error_Message || 'Payment failed or was cancelled.',
            };
          }
        }
      }

      // 3. Check Supabase subscription directly (in case webhook already marked it active)
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
        message: 'Payment verification in progress. Please check again after completing the transaction in PayU.',
      };
    } catch (err: any) {
      console.error('payuService verifyOrder exception:', err);
      return {
        success: false,
        isPaid: false,
        error: err.message || 'Unable to verify payment status with PayU.',
      };
    }
  },
};
