// Supabase Edge Function: r
// Direct receipt resolver without HTML landing pages, spinners, or intermediate screens.
// Strictly returns direct HTTP 302 redirect to the authoritative public PDF in Supabase Storage.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://tziqjkklqtmjlncoraba.supabase.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const billId = url.searchParams.get('b') || (lastPart && lastPart !== 'r' ? lastPart : '');

    if (!billId) {
      return new Response('Receipt ID required', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Sanitize identifier: allow UUIDs, alphanumeric, hyphens, and underscores only
    const cleanId = billId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId || cleanId.length < 3) {
      return new Response('Invalid Receipt Identifier', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const publicPdfUrl = `${SUPABASE_URL}/storage/v1/object/public/receipts/${cleanId}.pdf`;

    // Direct HTTP 302 redirect to the PDF file
    // Recipient device immediately opens the PDF directly in their native viewer/browser
    return new Response(null, {
      status: 302,
      headers: {
        'Location': publicPdfUrl,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response('Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});
