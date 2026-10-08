// Supabase Edge Function: cashfree-subscription
// Secure server-side Cashfree Order Creation and Payment Verification
// Deno TypeScript runtime

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID') || '';
const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY') || '';
const CASHFREE_ENV = Deno.env.get('CASHFREE_ENV') || 'TEST'; // 'TEST' or 'PROD'

const CASHFREE_BASE_URL = CASHFREE_ENV === 'PROD'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Exact commercial plans
const PLAN_PRICES: Record<string, { price: number; months: number; name: string }> = {
  '1_month': { price: 499, months: 1, name: '1 Month' },
  '3_months': { price: 1497, months: 3, name: '3 Months' },
  '6_months': { price: 2799, months: 6, name: '6 Months' },
  '1_year': { price: 4999, months: 12, name: '1 Year' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Handle Hosted Checkout HTML page on GET
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('payment_session_id');
    const envMode = url.searchParams.get('env') || CASHFREE_ENV;

    if (!sessionId) {
      return new Response('Missing payment_session_id parameter', { status: 400 });
    }

    const mode = envMode === 'PROD' ? 'production' : 'sandbox';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Counter365 Payment</title>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #ffffff;
      text-align: center;
    }
    .card {
      padding: 28px 24px;
      border-radius: 16px;
      background: #1e293b;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      max-width: 360px;
      margin: 16px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #334155;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2 style="margin: 0 0 8px 0; font-size: 20px;">Connecting to Cashfree...</h2>
    <p style="margin: 0; color: #94a3b8; font-size: 14px;">Opening secure checkout. Please wait.</p>
  </div>
  <script>
    try {
      const cashfree = Cashfree({ mode: "${mode}" });
      cashfree.checkout({
        paymentSessionId: "${sessionId}",
        redirectTarget: "_self"
      });
    } catch (e) {
      console.error(e);
      document.querySelector('h2').innerText = 'Checkout Error';
      document.querySelector('p').innerText = e.message || 'Unable to open checkout';
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  try {
    const body = await req.json();

    // Recognize all Cashfree webhooks and test payloads (any request without internal client actions)
    const isAction = body.action === 'create_order' || body.action === 'verify_order';
    const isWebhook = !isAction;

    if (isWebhook) {
      // Cashfree test ping or dummy payload (e.g. Test & Add from Cashfree Dashboard)
      const orderId =
        body.data?.order?.order_id ||
        body.data?.link_id ||
        body.order?.order_id ||
        body.link_id ||
        body.order_id;

      const shopId =
        body.data?.customer_details?.customer_id ||
        body.customer_details?.customer_id;

      const linkStatus = body.data?.link_status || body.link_status;
      const paymentStatus = body.data?.payment?.payment_status || body.payment_status;

      // Always return 200 for webhook tests / ping acknowledgements to avoid Cashfree 400 errors
      if (!orderId || !shopId || orderId === 'payment_ps11') {
        return new Response(JSON.stringify({ received: true, test: true, message: 'Cashfree webhook endpoint verified' }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const isSuccessful =
        linkStatus === 'PAID' ||
        paymentStatus === 'SUCCESS' ||
        body.type === 'PAYMENT_SUCCESS_WEBHOOK' ||
        body.event === 'ORDER.PAID';

      if (!isSuccessful) {
        return new Response(JSON.stringify({ received: true, ignored: `Status ${linkStatus || paymentStatus} not final` }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Determine plan from amount or order ID
      const orderAmount = Number(
        body.data?.order?.order_amount ||
        body.data?.link_amount ||
        body.order_amount ||
        body.link_amount ||
        499
      );

      let planId = '1_month';
      if (orderAmount >= 4999) planId = '1_year';
      else if (orderAmount >= 2799) planId = '6_months';
      else if (orderAmount >= 1497) planId = '3_months';

      const plan = PLAN_PRICES[planId] || PLAN_PRICES['1_month'];
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
        console.error('Webhook subscription upsert error:', subError);
        return new Response(JSON.stringify({ received: true, error: subError.message }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ received: true, success: true, subscription: subData }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_order') {
      const { planId, shopId, shopName, customerPhone } = body;

      const plan = PLAN_PRICES[planId];
      if (!plan) {
        return new Response(JSON.stringify({ error: 'Invalid plan selected' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (!shopId) {
        return new Response(JSON.stringify({ error: 'Missing shopId' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Generate deterministic unique order ID
      const timestamp = Date.now();
      const cleanPhone = (customerPhone || '9999999999').replace(/[^0-9]/g, '').slice(-10);
      const orderId = `cpro_${shopId.replace(/-/g, '').slice(0, 8)}_${timestamp}`;

      const orderPayload = {
        order_id: orderId,
        order_amount: plan.price,
        order_currency: 'INR',
        customer_details: {
          customer_id: shopId,
          customer_name: (shopName || 'Counter365').slice(0, 50),
          customer_phone: cleanPhone.length === 10 ? cleanPhone : '9999999999',
        },
        order_meta: {
          return_url: `counterpro://payment-return?order_id=${orderId}`,
        },
        order_note: `Counter365 ${plan.name} Subscription`,
      };

      const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'x-client-id': CASHFREE_APP_ID,
          'x-client-secret': CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      const cfData = await cfResponse.json();

      if (!cfResponse.ok || !cfData.payment_session_id) {
        return new Response(JSON.stringify({ error: cfData.message || 'Cashfree order creation failed', details: cfData }), {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const checkoutUrl = CASHFREE_ENV === 'PROD'
        ? `https://payments.cashfree.com/order/#${cfData.payment_session_id}`
        : `https://payments-test.cashfree.com/order/#${cfData.payment_session_id}`;

      return new Response(
        JSON.stringify({
          success: true,
          orderId,
          paymentSessionId: cfData.payment_session_id,
          paymentUrl: checkoutUrl,
          amount: plan.price,
          currency: 'INR',
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

      // 1. Fetch link status directly from Cashfree PG
      const cfHeaders = {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      };

      let orderStatus = 'PENDING';
      let isPaid = false;

      // 1. Fetch order status directly from Cashfree PG (/orders)
      const orderResponse = await fetch(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: cfHeaders,
      });

      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        orderStatus = orderData.order_status;
        if (orderStatus === 'PAID') isPaid = true;
      } else {
        // Fallback: check links API
        try {
          const linkResponse = await fetch(`${CASHFREE_BASE_URL}/links/${orderId}`, {
            method: 'GET',
            headers: cfHeaders,
          });
          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            orderStatus = linkData.link_status;
            if (orderStatus === 'PAID') isPaid = true;
          }
        } catch (_) {}
      }

      // PAYMENT SUCCESS VALIDATION: ONLY 'PAID' ACTIVATES SUBSCRIPTION
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
      const plan = PLAN_PRICES[planId] || PLAN_PRICES['1_month'];
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
