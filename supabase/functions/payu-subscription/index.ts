// Supabase Edge Function: payu-subscription
// Secure server-side PayU Order Creation and Payment Verification
// Deno TypeScript runtime

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYU_KEY = Deno.env.get('PAYU_KEY') || 'eCLL4q';
const PAYU_SALT = Deno.env.get('PAYU_SALT') || 'lrHveqnRWPtk84SfL7J9GIv738BO3FEo';
const PAYU_ENV = Deno.env.get('PAYU_ENV') || 'TEST'; // 'TEST' or 'PROD'

const PAYU_BASE_URL = PAYU_ENV === 'PROD'
  ? 'https://secure.payu.in/_payment'
  : 'https://test.payu.in/_payment';

const PAYU_VERIFY_URL = PAYU_ENV === 'PROD'
  ? 'https://info.payu.in/merchant/postservice?form=2'
  : 'https://test.payu.in/merchant/postservice?form=2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Commercial plans (inclusive of 18% GST)
const PLAN_PRICES: Record<string, { price: number; basePrice: number; months: number; name: string }> = {
  '1_month': { price: 588.82, basePrice: 499, months: 1, name: '1 Month' },
  '3_months': { price: 3538.82, basePrice: 2999, months: 3, name: '3 Months' },
  '6_months': { price: 6488.82, basePrice: 5499, months: 6, name: '6 Months' },
  '1_year': { price: 11798.82, basePrice: 9999, months: 12, name: '12 Months' },
};

async function sha512Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-512', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_order') {
      const { planId, shopId, shopName, customerPhone, customerEmail } = body;

      if (!planId || !shopId) {
        return new Response(JSON.stringify({ error: 'Missing planId or shopId' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const plan = PLAN_PRICES[planId] || PLAN_PRICES['1_year'];
      const timestamp = Date.now();
      const cleanPhone = (customerPhone || '9999999999').replace(/[^0-9]/g, '').slice(-10);
      const safeTxnId = `cpro_${shopId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}_${timestamp}`;
      const formattedAmount = plan.price.toFixed(2);
      const email = customerEmail || 'billing@counterpro.app';
      const cleanName = (shopName || 'Counter365').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 50) || 'Counter365 Customer';
      const productInfo = `Counter365 ${plan.name} Subscription`;
      const returnUrl = `https://counterpro.app/payment-return?order_id=${safeTxnId}`;

      const udf1 = shopId;
      const udf2 = planId;
      const udf3 = 'subscription';
      const udf4 = 'Counter365';
      const udf5 = '';

      // Standard PayU Hash:
      // sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
      const hashStr = [
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
        '', '', '', '', '',
        PAYU_SALT,
      ].join('|');

      const hash = await sha512Hex(hashStr);

      return new Response(
        JSON.stringify({
          success: true,
          orderId: safeTxnId,
          amount: plan.price,
          currency: 'INR',
          hash,
          key: PAYU_KEY,
          actionUrl: PAYU_BASE_URL,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify_order') {
      const { orderId, shopId, planId } = body;

      if (!orderId || !shopId) {
        return new Response(JSON.stringify({ error: 'Missing orderId or shopId' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Hash formula for verify_payment: sha512(key|command|var1|salt)
      const command = 'verify_payment';
      const verifyHashStr = `${PAYU_KEY}|${command}|${orderId}|${PAYU_SALT}`;
      const verifyHash = await sha512Hex(verifyHashStr);

      const params = new URLSearchParams({
        key: PAYU_KEY,
        command,
        var1: orderId,
        hash: verifyHash,
      });

      let isPaid = false;
      let orderStatus = 'PENDING';

      const verifyRes = await fetch(PAYU_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        const details = data?.transaction_details?.[orderId];
        if (details) {
          const status = (details.status || '').toLowerCase();
          if (status === 'success') {
            isPaid = true;
            orderStatus = 'PAID';
          } else if (status === 'failure' || status === 'failed') {
            orderStatus = 'FAILED';
          }
        }
      }

      if (!isPaid) {
        return new Response(
          JSON.stringify({
            success: true,
            isPaid: false,
            orderStatus,
            message: `Payment is not completed. Current status: ${orderStatus}`,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // Idempotently activate subscription in Supabase
      const plan = PLAN_PRICES[planId] || PLAN_PRICES['1_year'];
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const now = new Date();
      const startDate = now.toISOString();
      const endDate = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: subData, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            shop_id: shopId,
            plan: 'pro',
            status: 'active',
            amount: plan.price,
            interval: plan.name,
            current_period_start: startDate,
            current_period_end: endDate,
            subscription_start_at: startDate,
            subscription_end_at: endDate,
            payment_reference: orderId,
            cashfree_order_id: orderId,
            currency: 'INR',
            duration_months: plan.months,
            updated_at: startDate,
          },
          { onConflict: 'shop_id' }
        )
        .select()
        .single();

      if (subError) {
        return new Response(JSON.stringify({ error: 'Failed to record subscription', details: subError.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          isPaid: true,
          orderStatus: 'PAID',
          subscription: subData,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
