import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Bill, CartItem, PaymentMethod, PendingPaymentRecord, BillPaymentCollection, Shop } from '../types/models';
import { calculateGST } from '../lib/money';
import { syncEngine } from './syncEngine';
import { generateUUID } from '../lib/uuid';
import { subscriptionService } from './subscriptionService';
import { shopService } from './shopService';
import { contactService } from './contactService';
import { generateDefaultInvoicePrefix, formatInvoiceNumber } from '../lib/invoiceUtils';
import { authService } from './authService';

const LOCAL_BILLS_KEY = '@counterpro/bills';
const LOCAL_BILL_COUNT_KEY = '@counterpro/bill_count';

/**
 * Maps app payment methods to valid Supabase database check constraint values:
 * CHECK (payment_mode IN ('Cash', 'GPay', 'Pending', 'Split'))
 */
function toSupabasePaymentMode(mode: string): 'Cash' | 'GPay' | 'Pending' | 'Split' {
  if (mode === 'Pending') return 'Pending';
  if (mode === 'GPay' || mode === 'UPI') return 'GPay';
  if (mode === 'Split' || mode === 'Partial Pay' || mode === 'Cash + GPay') return 'Split';
  return 'Cash';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export const billingService = {
  /**
   * Get total bills ever created for this shop (active + edited + deleted)
   * Authoritative count that never decreases even when bills are deleted.
   */
  async getTotalBillsCreated(shopId?: string): Promise<number> {
    if (!shopId) return 0;
    const TOTAL_KEY = `@counterpro/total_bills_created_${shopId}`;
    const storedCount = await storage.getObject<number>(TOTAL_KEY, 0);
    let remoteCount = 0;
    try {
      const { data: s } = await (supabase.from('shops') as any)
        .select('total_bills_created')
        .eq('id', shopId)
        .maybeSingle();
      if (s?.total_bills_created) {
        remoteCount = Number(s.total_bills_created);
      }
    } catch {}
    const allBills = await this.getBills(shopId);
    const maxCount = Math.max(storedCount, remoteCount, allBills.length);
    if (maxCount > storedCount) {
      await storage.setObject(TOTAL_KEY, maxCount);
    }
    return maxCount;
  },

  /**
   * Get active/completed bills only (excludes soft-deleted bills)
   */
  async getActiveBills(shopId: string): Promise<Bill[]> {
    const allBills = await this.getBills(shopId);
    return allBills.filter(b => !b.isDeleted && b.status !== 'deleted');
  },

  /**
   * Get total active bill count for this shop
   */
  async getBillCount(shopId?: string): Promise<number> {
    const bills = await this.getBills(shopId || '');
    return bills.length;
  },

  /**
   * Get next deterministic bill/invoice number for this shop based on prefix and reset cycle (monthly or yearly).
   * E.g. "RTS-October-001" or "RTS-001".
   * Never reuses or steps backward over cancelled or deleted bills.
   */
  async getNextBillNumber(shopId?: string, shopParam?: Shop): Promise<string> {
    try {
      const sId = shopId || shopParam?.id;
      const shop = shopParam || (await shopService.getActiveShop());
      const prefix = shop?.invoicePrefix || generateDefaultInvoicePrefix(shop?.name);
      const resetCycle = shop?.invoiceResetCycle || 'monthly';
      const now = new Date();

      if (resetCycle === 'monthly') {
        const existingBills = sId ? await this.getBills(sId) : [];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let maxSeq = 0;
        const monthNameRegex = new RegExp(`^${prefix}[-_]?[A-Za-z]+[-_]?(\\d+)$`, 'i');
        const genericSeqRegex = /[-_#](\d+)$/;

        for (const b of existingBills) {
          if (!b.createdAt || !b.billNumber) continue;
          const d = new Date(b.createdAt);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const m = b.billNumber.match(monthNameRegex) || b.billNumber.match(genericSeqRegex);
            if (m && m[1]) {
              const num = parseInt(m[1], 10);
              if (!isNaN(num) && num > maxSeq) {
                maxSeq = num;
              }
            }
          }
        }

        const monthlyBillsCount = existingBills.filter(b => {
          if (!b.createdAt) return false;
          const d = new Date(b.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        const nextSeq = Math.max(maxSeq, monthlyBillsCount) + 1;
        return formatInvoiceNumber(prefix, 'monthly', nextSeq, now);
      } else {
        const count = await this.getTotalBillsCreated(sId);
        const existingBills = sId ? await this.getBills(sId) : [];
        let maxSeq = count;
        const genericSeqRegex = /[-_#](\d+)$/;
        for (const b of existingBills) {
          if (!b.billNumber) continue;
          const m = b.billNumber.match(genericSeqRegex);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
        return formatInvoiceNumber(prefix, 'yearly', maxSeq + 1, now);
      }
    } catch {
      const count = await this.getTotalBillsCreated(shopId);
      return '#' + String(count + 1).padStart(4, '0');
    }
  },

  /**
   * Persist a bill and its related items and payment records to Supabase.
   * Throws an error on failure so caller can enqueue to sync engine.
   */
  async persistBillToCloud(
    bill: Bill,
    originalPaymentMode: PaymentMethod,
    cashPart?: number,
    gpayPart?: number
  ): Promise<void> {
    if (!isValidUUID(bill.shopId)) {
      return; // Skip writing if shopId is not a valid Postgres UUID (e.g. mock test environment)
    }

    // Ensure parent shop exists in Supabase so bills_shop_id_fkey is satisfied
    await shopService.ensureShopExists(bill.shopId);

    // Ensure customer exists in Supabase so bills_customer_id_fkey is satisfied
    let validCustomerId: string | null = null;
    if (bill.customerId && isValidUUID(bill.customerId)) {
      const customerExists = await contactService.ensureCustomerExists(
        bill.customerId,
        bill.shopId,
        bill.customerName,
        bill.customerPhone
      );
      if (customerExists) {
        validCustomerId = bill.customerId;
      }
    }

    const dbPaymentMode = toSupabasePaymentMode(originalPaymentMode);
    const validOpId = isValidUUID(bill.clientOperationId) ? bill.clientOperationId : null;

    const billPayload = {
      id: bill.id,
      shop_id: bill.shopId,
      bill_number: bill.billNumber,
      customer_id: validCustomerId,
      customer_name: bill.customerName || null,
      customer_phone: bill.customerPhone || null,
      table_number: bill.tableNumber || null,
      status: bill.status || 'completed',
      subtotal: bill.subtotal,
      discount_amount: bill.discountAmount || 0.00,
      discount_type: bill.discountType || null,
      discount_value: bill.discountValue || 0.00,
      discount_applied_by: bill.discountAppliedBy || null,
      discount_approved_by: bill.discountApprovedBy || null,
      original_subtotal: bill.originalSubtotal || null,
      original_total: bill.originalTotal || null,
      gst_rate: bill.gstRate,
      gst_amount: bill.gstAmount,
      tax_amount: bill.gstAmount,
      total_amount: bill.totalAmount,
      paid_amount: bill.paidAmount,
      pending_amount: bill.pendingAmount,
      initial_paid_amount: bill.initialPaidAmount || (bill.paymentMode === 'Pending' ? 0 : bill.paidAmount),
      cash_amount: bill.cashAmount || null,
      gpay_amount: bill.gpayAmount || null,
      payment_mode: dbPaymentMode,
      collections: bill.collections || [],
      client_operation_id: validOpId,
      created_by_name: bill.createdByName || 'Owner',
      created_by_role: bill.createdByRole || 'Owner',
      created_by_id: bill.createdById || null,
      is_edited: bill.isEdited || false,
      edited_at: bill.editedAt || null,
      edited_by_name: bill.editedByName || null,
      edited_by_role: bill.editedByRole || null,
      is_deleted: bill.isDeleted || false,
      is_cancelled: bill.isCancelled || false,
      cancellation_reason: bill.cancellationReason || null,
      deleted_at: bill.deletedAt || null,
      deleted_by_name: bill.deletedByName || null,
      deleted_by_role: bill.deletedByRole || null,
      deleted_by_id: bill.deletedById || null,
      completed_at: bill.completedAt || new Date().toISOString(),
      settled_at: bill.settledAt || null,
    };

    // 1. Insert bill into public.bills
    let { error: billError } = await (supabase.from('bills') as any).upsert(billPayload);

    if (billError) {
      // Self-heal 1: If foreign key violated on shop, force provision the parent shop and retry once
      if (billError.message && billError.message.includes('bills_shop_id_fkey')) {
        await shopService.ensureShopExists(bill.shopId);
        const { error: retryError } = await (supabase.from('bills') as any).upsert(billPayload);
        if (!retryError) {
          billError = null;
        }
      }
      // Self-heal 2: If customer foreign key violated, retry with customer_id = null so bill is NEVER blocked
      else if (
        billPayload.customer_id &&
        (billError.message?.includes('bills_customer_id_fkey') ||
          (billError as any).details?.includes('bills_customer_id_fkey'))
      ) {
        console.warn('bills_customer_id_fkey self-heal: clearing missing customer_id and retrying:', bill.billNumber);
        billPayload.customer_id = null;
        const { error: retryError } = await (supabase.from('bills') as any).upsert(billPayload);
        if (!retryError) {
          billError = null;
        }
      }
    }

    if (billError) {
      throw new Error(`Bills table error: ${billError.message}`);
    }

    // 2. Insert bill items into public.bill_items
    if (bill.items && bill.items.length > 0) {
      const itemRows = bill.items.map(it => ({
        id: generateUUID(),
        shop_id: bill.shopId,
        bill_id: bill.id,
        menu_item_id: it.menuItemId && it.menuItemId.includes('-') && it.menuItemId.length >= 32 ? it.menuItemId : null,
        item_name: it.itemName,
        is_half: !!it.isHalf,
        unit_price: it.unitPrice,
        quantity: it.quantity,
        line_total: it.lineTotal,
      }));

      const { error: itemsError } = await (supabase.from('bill_items') as any).insert(itemRows);
      if (itemsError) {
        console.warn('Bill items insert error:', itemsError.message);
      }
    }

    // 3. Record payment rows in public.payments and/or public.pending_payments
    if (originalPaymentMode === 'Cash + GPay') {
      const cAmt = Number(cashPart) || Number(bill.cashAmount) || 0;
      const gAmt = Number(gpayPart) || Number(bill.gpayAmount) || (bill.totalAmount - cAmt);
      const paymentRows: any[] = [];

      if (cAmt > 0) {
        paymentRows.push({
          id: generateUUID(),
          shop_id: bill.shopId,
          bill_id: bill.id,
          payment_method: 'Cash',
          amount: cAmt,
          status: 'successful',
          paid_at: bill.completedAt || new Date().toISOString(),
        });
      }
      if (gAmt > 0) {
        paymentRows.push({
          id: generateUUID(),
          shop_id: bill.shopId,
          bill_id: bill.id,
          payment_method: 'GPay',
          amount: gAmt,
          status: 'successful',
          paid_at: bill.completedAt || new Date().toISOString(),
        });
      }

      if (paymentRows.length > 0) {
        const { error: pErr } = await (supabase.from('payments') as any).insert(paymentRows);
        if (pErr) console.warn('Payments insert error:', pErr.message);
      }
    } else if (originalPaymentMode === 'Partial Pay') {
      if (bill.paidAmount > 0) {
        const { error: pErr } = await (supabase.from('payments') as any).insert({
          id: generateUUID(),
          shop_id: bill.shopId,
          bill_id: bill.id,
          payment_method: 'Cash',
          amount: bill.paidAmount,
          status: 'successful',
          paid_at: bill.completedAt || new Date().toISOString(),
        });
        if (pErr) console.warn('Partial payment insert error:', pErr.message);
      }

      if (bill.pendingAmount > 0) {
        const { error: pendErr } = await (supabase.from('pending_payments') as any).insert({
          id: generateUUID(),
          shop_id: bill.shopId,
          bill_id: bill.id,
          customer_name: bill.customerName || 'Customer',
          customer_phone: bill.customerPhone || null,
          amount_due: bill.pendingAmount,
          amount_paid: 0,
          status: 'open',
        });
        if (pendErr) console.warn('Pending payment insert error:', pendErr.message);
      }
    } else if (originalPaymentMode === 'Pending') {
      const { error: pendErr } = await (supabase.from('pending_payments') as any).insert({
        id: generateUUID(),
        shop_id: bill.shopId,
        bill_id: bill.id,
        customer_name: bill.customerName || 'Customer',
        customer_phone: bill.customerPhone || null,
        amount_due: bill.totalAmount,
        amount_paid: 0,
        status: 'open',
      });
      if (pendErr) console.warn('Pending payment insert error:', pendErr.message);
    } else {
      // Cash, GPay
      const method = ((originalPaymentMode as string) === 'GPay' || (originalPaymentMode as string) === 'UPI') ? 'GPay' : 'Cash';
      const { error: pErr } = await (supabase.from('payments') as any).insert({
        id: generateUUID(),
        shop_id: bill.shopId,
        bill_id: bill.id,
        payment_method: method,
        amount: bill.totalAmount,
        status: 'successful',
        paid_at: bill.completedAt || new Date().toISOString(),
      });
      if (pErr) console.warn('Payment insert error:', pErr.message);
    }

    // 4. Update or insert customer aggregates in public.customers (strict deduplication by phone)
    if (bill.customerName && bill.customerName !== 'Not tracked') {
      try {
        const cleanPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        let existingCust: any = null;

        if (cleanPhone && cleanPhone.length === 10) {
          const query = (supabase.from('customers') as any)
            .select('id, name, total_bills, pending_balance, phone')
            .eq('shop_id', bill.shopId);
          const { data: byPhone } = typeof query.ilike === 'function'
            ? await query.ilike('phone', `%${cleanPhone}%`).limit(1).maybeSingle()
            : typeof query.like === 'function'
              ? await query.like('phone', `%${cleanPhone}%`).limit(1).maybeSingle()
              : await query.eq('phone', cleanPhone).limit(1).maybeSingle();
          existingCust = byPhone;
        }

        if (!existingCust) {
          const { data: byName } = await (supabase.from('customers') as any)
            .select('id, name, total_bills, pending_balance, phone')
            .eq('shop_id', bill.shopId)
            .eq('name', bill.customerName)
            .limit(1)
            .maybeSingle();
          existingCust = byName;
        }

        if (existingCust) {
          await (supabase.from('customers') as any)
            .update({
              total_bills: (existingCust.total_bills || 0) + 1,
              pending_balance: (existingCust.pending_balance || 0) + bill.pendingAmount,
              phone: existingCust.phone || bill.customerPhone || undefined,
            })
            .eq('id', existingCust.id);
        } else {
          await (supabase.from('customers') as any).insert({
            id: generateUUID(),
            shop_id: bill.shopId,
            name: bill.customerName,
            phone: bill.customerPhone || null,
            total_bills: 1,
            pending_balance: bill.pendingAmount,
            is_active: true,
          });
        }
      } catch (custErr) {
        console.warn('Customer record update notice:', custErr);
      }
    }
  },

  /**
   * Synchronize all local bills to Supabase in the background.
   * Finds any local bills missing from the cloud and writes them cleanly.
   */
  async syncLocalBillsToCloud(shopId: string): Promise<{ synced: number; failed: number }> {
    if (!shopId) return { synced: 0, failed: 0 };

    // Ensure parent shop exists in cloud before attempting bill push
    await shopService.ensureShopExists(shopId);

    const localBills = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);
    const shopBills = localBills.filter(b => b.shopId === shopId);
    if (shopBills.length === 0) return { synced: 0, failed: 0 };

    try {
      const { data: remoteBills, error } = await (supabase.from('bills') as any)
        .select('id')
        .eq('shop_id', shopId);

      if (error) {
        console.warn('Error checking remote bills for sync:', error.message);
        return { synced: 0, failed: 0 };
      }

      const remoteIds = new Set((remoteBills || []).map((r: any) => r.id));
      const unSynced = shopBills.filter(b => !remoteIds.has(b.id));

      let synced = 0;
      let failed = 0;

      for (const bill of unSynced) {
        try {
          await this.persistBillToCloud(
            bill,
            bill.paymentMode,
            bill.cashAmount,
            bill.gpayAmount
          );
          synced++;
        } catch (syncErr) {
          if (process.env.NODE_ENV !== 'test') {
            console.warn(`Failed to push local bill ${bill.billNumber} to cloud:`, syncErr);
          }
          failed++;
        }
      }

      return { synced, failed };
    } catch (err) {
      console.warn('syncLocalBillsToCloud notice:', err);
      return { synced: 0, failed: 0 };
    }
  },

  /**
   * Load real bills for the specified shop from local storage and Supabase.
   * Merges local and remote data and ensures offline records are cloud-synced.
   */
  async getBills(shopId: string): Promise<Bill[]> {
    if (!shopId) return [];

    // 1. Load from local cache for immediate responsiveness
    const saved = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);
    let shopBills = saved.filter(b => b.shopId === shopId);

    // 2. Query Supabase in the background/on demand
    try {
      const { data: dbBills, error } = await (supabase.from('bills') as any)
        .select('*, bill_items(*)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && dbBills) {
        const remoteBills: Bill[] = dbBills.map((b: any) => ({
          id: b.id,
          shopId: b.shop_id,
          billNumber: b.bill_number,
          customerId: b.customer_id || null,
          customerName: b.customer_name,
          customerPhone: b.customer_phone,
          status: b.status,
          isDeleted: b.is_deleted ?? (b.status === 'deleted'),
          isEdited: b.is_edited ?? (b.status === 'edited'),
          createdByName: b.created_by_name || b.created_by || 'Owner',
          createdByRole: b.created_by_role || 'Owner',
          createdById: b.created_by_id || null,
          editedAt: b.edited_at || null,
          editedByName: b.edited_by_name || null,
          editedByRole: b.edited_by_role || null,
          deletedAt: b.deleted_at || null,
          deletedByName: b.deleted_by_name || null,
          deletedByRole: b.deleted_by_role || null,
          subtotal: Number(b.subtotal || 0),
          gstRate: Number(b.gst_rate || 0),
          gstAmount: Number(b.gst_amount || b.tax_amount || 0),
          totalAmount: Number(b.total_amount || 0),
          paidAmount: Number(b.paid_amount || 0),
          pendingAmount: Number(b.pending_amount || 0),
          initialPaidAmount: b.initial_paid_amount ? Number(b.initial_paid_amount) : undefined,
          cashAmount: b.cash_amount ? Number(b.cash_amount) : (b.payment_mode === 'Split' ? Number(b.paid_amount || 0) : undefined),
          gpayAmount: b.gpay_amount ? Number(b.gpay_amount) : undefined,
          tableNumber: b.table_number || null,
          paymentMode: b.payment_mode as PaymentMethod,
          clientOperationId: b.client_operation_id,
          collections: b.collections || [],
          items: (b.bill_items || []).map((item: any) => ({
            id: item.id,
            menuItemId: item.menu_item_id,
            itemName: item.item_name,
            isHalf: item.is_half ?? false,
            unitPrice: Number(item.unit_price || 0),
            quantity: Number(item.quantity || 1),
            lineTotal: Number(item.line_total || 0),
          })),
          createdAt: b.created_at,
          completedAt: b.completed_at,
          settledAt: b.settled_at || null,
        }));

        // Merge: keep local version if available (has richer in-memory fields like tableNumber & audit info), else remote
        const mergedMap = new Map<string, Bill>();
        for (const rb of remoteBills) {
          mergedMap.set(rb.id, rb);
        }
        for (const lb of shopBills) {
          const remote = mergedMap.get(lb.id);
          mergedMap.set(lb.id, {
            ...remote,
            ...lb,
            status: lb.status || remote?.status || 'completed',
            isDeleted: lb.isDeleted || remote?.isDeleted || false,
            isEdited: lb.isEdited || remote?.isEdited || false,
          });
        }

        const mergedBills = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Update local storage with merged list
        const otherShopBills = saved.filter(b => b.shopId !== shopId);
        await storage.setObject(LOCAL_BILLS_KEY, [...mergedBills, ...otherShopBills]);
        shopBills = mergedBills;

        // Trigger background sync for any unsynced local bills
        this.syncLocalBillsToCloud(shopId).catch(() => {});
      }
    } catch (err) {
      console.warn('getBills Supabase query notice:', err);
    }

    return shopBills;
  },

  /**
   * Create a real bill with direct database persistence and local cache
   */
  async createBill(params: {
    shopId: string;
    cart: CartItem[];
    paymentMode: PaymentMethod;
    gstEnabled: boolean;
    customerName?: string;
    customerPhone?: string;
    customerId?: string;
    paidAmount?: number;
    cashAmount?: number;
    gpayAmount?: number;
    tableNumber?: string | null;
    creator?: { name?: string; role?: string; id?: string };
    discount?: { type: 'percentage' | 'fixed'; value: number; appliedBy?: string; approvedBy?: string };
  }): Promise<{ bill: Bill; isDuplicate: boolean }> {
    // 0. Server-side session/active validation for staff
    if (params.creator?.id) {
      const isActive = await authService.isUserActiveInShop(params.shopId, params.creator.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const existingBills = await this.getBills(params.shopId);
    const totalCreatedCount = await this.getTotalBillsCreated(params.shopId);
    const currentCount = Math.max(existingBills.length, totalCreatedCount);

    // Enforce 100-bill free tier limit (includes active + deleted bills)
    const { statusInfo } = await subscriptionService.getShopSubscription(
      params.shopId,
      null,
      currentCount
    );

    if (statusInfo.billLimitReached && !statusInfo.isPaidActive) {
      throw new Error('Free tier limit of 100 bills reached. You cannot create more bills. Please upgrade to Pro.');
    }

    const nextCount = currentCount + 1;
    const billNumber = await this.getNextBillNumber(params.shopId);

    // Persist running total bills created (counts active + deleted bills permanently)
    const TOTAL_KEY = `@counterpro/total_bills_created_${params.shopId}`;
    await storage.setObject(TOTAL_KEY, nextCount);
    try {
      await (supabase.from('shops') as any)
        .update({ total_bills_created: nextCount })
        .eq('id', params.shopId);
    } catch {}

    const originalSubtotal = params.cart.reduce((sum, item) => sum + item.lineTotal, 0);

    // Validate discount authority
    let discountAmount = 0;
    if (params.discount && params.discount.value > 0) {
      if (params.creator?.role === 'Biller') {
        const isExceeded = params.discount.type === 'percentage'
          ? params.discount.value > 10
          : params.discount.value > (originalSubtotal * 0.1);
        if (isExceeded && !params.discount.approvedBy) {
          throw new Error('Unauthorized: Discounts above 10% require Supervisor or Owner approval.');
        }
      }
      discountAmount = params.discount.type === 'percentage'
        ? (originalSubtotal * params.discount.value) / 100
        : params.discount.value;
      // Never allow discount to exceed subtotal
      discountAmount = Math.max(0, Math.min(discountAmount, originalSubtotal));
    }

    const finalSubtotal = originalSubtotal - discountAmount;
    const gstRate = params.gstEnabled ? 5 : 0;
    const gstAmount = params.gstEnabled ? calculateGST(finalSubtotal, 5) : 0;
    const totalAmount = finalSubtotal + gstAmount;
    const originalTotal = originalSubtotal + (params.gstEnabled ? calculateGST(originalSubtotal, 5) : 0);

    let paidAmount = totalAmount;
    let pendingAmount = 0;
    let cashAmount = params.cashAmount || 0;
    let gpayAmount = params.gpayAmount || 0;

    if (params.paymentMode === 'Pending') {
      paidAmount = 0;
      pendingAmount = totalAmount;
    } else if (params.paymentMode === 'Partial Pay') {
      paidAmount = Math.max(0, Math.min(totalAmount, Number(params.paidAmount) || 0));
      pendingAmount = Math.max(0, totalAmount - paidAmount);
    } else if (params.paymentMode === 'Cash + GPay') {
      cashAmount = Number(params.cashAmount) || 0;
      gpayAmount = Number(params.gpayAmount) || (totalAmount - cashAmount);
      paidAmount = totalAmount;
      pendingAmount = 0;
    } else {
      paidAmount = totalAmount;
      pendingAmount = 0;
    }

    const operationId = generateUUID();
    const billId = generateUUID();
    const isPendingOrPartial = pendingAmount > 0;

    const bill: Bill = {
      id: billId,
      shopId: params.shopId,
      billNumber,
      customerName: params.customerName || (isPendingOrPartial ? 'Not tracked' : null),
      customerPhone: params.customerPhone || null,
      customerId: params.customerId || null,
      tableNumber: params.tableNumber || null,
      status: 'completed',
      subtotal: finalSubtotal,
      originalSubtotal,
      originalTotal,
      discountType: params.discount?.type || null,
      discountValue: params.discount?.value || 0,
      discountAmount,
      discountAppliedBy: params.discount?.appliedBy || params.creator?.name || null,
      discountApprovedBy: params.discount?.approvedBy || null,
      gstRate,
      gstAmount,
      totalAmount,
      paidAmount,
      pendingAmount,
      initialPaidAmount: paidAmount,
      cashAmount: params.paymentMode === 'Cash + GPay' ? cashAmount : undefined,
      gpayAmount: params.paymentMode === 'Cash + GPay' ? gpayAmount : undefined,
      paymentMode: params.paymentMode,
      clientOperationId: operationId,
      items: params.cart.map(c => ({
        menuItemId: c.itemId,
        itemName: c.name,
        isHalf: c.isHalf,
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        lineTotal: c.lineTotal,
      })),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      createdByName: params.creator?.name || 'Owner',
      createdByRole: (params.creator?.role as any) || 'Owner',
      createdById: params.creator?.id || null,
      collections: paidAmount > 0 ? [
        {
          id: generateUUID(),
          amount: paidAmount,
          paymentMode: params.paymentMode,
          paidAt: new Date().toISOString(),
          receivedByName: params.creator?.name || 'Owner',
          receivedById: params.creator?.id || null,
        }
      ] : [],
    };

    // 1. Save locally immediately
    const updatedBills = [bill, ...existingBills];
    await storage.setObject(LOCAL_BILLS_KEY, updatedBills);
    await storage.setObject(LOCAL_BILL_COUNT_KEY, nextCount);

    // Update customer in local store immediately for zero-delay visibility & offline ledger
    if (bill.customerName && bill.customerName !== 'Not tracked') {
      try {
        const localCusts = await storage.getObject<any[]>('@counterpro/customers', []);
        const cleanPhone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        const match = localCusts.find(c =>
          c.shopId === bill.shopId && (
            (cleanPhone && c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) ||
            c.name === bill.customerName
          )
        );
        if (match) {
          match.totalBills = (match.totalBills || 0) + 1;
          match.pendingBalance = (match.pendingBalance || 0) + bill.pendingAmount;
          match.statusTag = match.pendingBalance > 0 ? 'Pending' : 'Regular';
        } else {
          localCusts.push({
            id: generateUUID(),
            shopId: bill.shopId,
            name: bill.customerName,
            phone: bill.customerPhone || null,
            totalBills: 1,
            pendingBalance: bill.pendingAmount,
            statusTag: bill.pendingAmount > 0 ? 'Pending' : 'Regular',
            isActive: true,
          });
        }
        await storage.setObject('@counterpro/customers', localCusts);
      } catch (lCustErr) {
        console.warn('Local customer cache update notice:', lCustErr);
      }
    }

    // 2. Direct Supabase write for bills, items, payments, pendings
    try {
      await this.persistBillToCloud(bill, params.paymentMode, cashAmount, gpayAmount);
    } catch (dbErr) {
      console.warn('Direct cloud persist failed, queueing for background sync:', dbErr);
      await syncEngine.enqueue({
        operationId,
        shopId: params.shopId,
        action: 'create_bill',
        payload: bill,
      });
    }

    return { bill, isDuplicate: false };
  },

  /**
   * Update an existing bill with audit trail (records who edited and when)
   */
  async updateBill(params: {
    billId: string;
    shopId: string;
    cart: CartItem[];
    paymentMode: PaymentMethod;
    gstEnabled: boolean;
    customerName?: string;
    customerPhone?: string;
    customerId?: string | null;
    paidAmount?: number;
    cashAmount?: number;
    gpayAmount?: number;
    tableNumber?: string | null;
    editor?: { name: string; role: string; id?: string };
  }): Promise<Bill> {
    if (params.editor?.role === 'Biller') {
      throw new Error('Unauthorized: Billers cannot edit completed bills.');
    }

    if (params.editor?.id) {
      const isActive = await authService.isUserActiveInShop(params.shopId, params.editor.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const allBills = await this.getBills(params.shopId);
    const existingBill = allBills.find(b => b.id === params.billId);
    if (!existingBill) throw new Error('Bill not found');

    const subtotal = params.cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const gstRate = params.gstEnabled ? 5 : 0;
    const gstAmount = params.gstEnabled ? calculateGST(subtotal, 5) : 0;
    const totalAmount = subtotal + gstAmount;

    let paidAmount = totalAmount;
    let pendingAmount = 0;
    let cashAmount = params.cashAmount || 0;
    let gpayAmount = params.gpayAmount || 0;

    if (params.paymentMode === 'Pending') {
      paidAmount = 0;
      pendingAmount = totalAmount;
    } else if (params.paymentMode === 'Partial Pay') {
      paidAmount = Math.max(0, Math.min(totalAmount, Number(params.paidAmount) || 0));
      pendingAmount = Math.max(0, totalAmount - paidAmount);
    } else if (params.paymentMode === 'Cash + GPay') {
      cashAmount = Number(params.cashAmount) || 0;
      gpayAmount = Number(params.gpayAmount) || (totalAmount - cashAmount);
      paidAmount = totalAmount;
      pendingAmount = 0;
    } else {
      paidAmount = totalAmount;
      pendingAmount = 0;
    }

    const nowIso = new Date().toISOString();

    const updatedBill: Bill = {
      ...existingBill,
      customerId: params.customerId !== undefined ? params.customerId : existingBill.customerId,
      customerName: params.customerName || (pendingAmount > 0 ? 'Not tracked' : null),
      customerPhone: params.customerPhone || null,
      tableNumber: params.tableNumber || null,
      subtotal,
      originalSubtotal: existingBill.originalSubtotal || existingBill.subtotal,
      originalTotal: existingBill.originalTotal || existingBill.totalAmount,
      gstRate,
      gstAmount,
      totalAmount,
      paidAmount,
      pendingAmount,
      cashAmount: params.paymentMode === 'Cash + GPay' ? cashAmount : undefined,
      gpayAmount: params.paymentMode === 'Cash + GPay' ? gpayAmount : undefined,
      paymentMode: params.paymentMode,
      items: params.cart.map(c => ({
        menuItemId: c.itemId,
        itemName: c.name,
        isHalf: c.isHalf,
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        lineTotal: c.lineTotal,
      })),
      collections: paidAmount > 0 ? [
        {
          id: existingBill.collections?.[0]?.id || generateUUID(),
          amount: paidAmount,
          paymentMode: params.paymentMode,
          paidAt: existingBill.collections?.[0]?.paidAt || existingBill.createdAt || nowIso,
          receivedByName: params.editor?.name || 'Owner',
          receivedById: params.editor?.id || null,
        }
      ] : [],
      initialPaidAmount: paidAmount,
      status: 'edited',
      isEdited: true,
      editedAt: nowIso,
      editedByName: params.editor?.name || 'Owner',
      editedByRole: (params.editor?.role as any) || 'Owner',
      editedById: params.editor?.id || null,
    };

    // 1. Update local storage
    const updatedList = allBills.map(b => (b.id === params.billId ? updatedBill : b));
    await storage.setObject(LOCAL_BILLS_KEY, updatedList);

    // 2. Update Supabase
    try {
      const dbMode = toSupabasePaymentMode(params.paymentMode);
      let validCustomerId: string | null = null;
      if (updatedBill.customerId && isValidUUID(updatedBill.customerId)) {
        const customerExists = await contactService.ensureCustomerExists(
          updatedBill.customerId,
          updatedBill.shopId,
          updatedBill.customerName,
          updatedBill.customerPhone
        );
        if (customerExists) {
          validCustomerId = updatedBill.customerId;
        }
      }

      const updatePayload: any = {
        customer_id: validCustomerId,
        customer_name: updatedBill.customerName || null,
        customer_phone: updatedBill.customerPhone || null,
        table_number: updatedBill.tableNumber || null,
        subtotal: updatedBill.subtotal,
        original_subtotal: updatedBill.originalSubtotal || null,
        original_total: updatedBill.originalTotal || null,
        gst_rate: updatedBill.gstRate,
        gst_amount: updatedBill.gstAmount,
        tax_amount: updatedBill.gstAmount,
        total_amount: updatedBill.totalAmount,
        paid_amount: updatedBill.paidAmount,
        pending_amount: updatedBill.pendingAmount,
        cash_amount: updatedBill.cashAmount || null,
        gpay_amount: updatedBill.gpayAmount || null,
        payment_mode: dbMode,
        status: 'edited',
        is_edited: true,
        edited_at: updatedBill.editedAt,
        edited_by_name: updatedBill.editedByName,
        edited_by_role: updatedBill.editedByRole,
        edited_by_id: updatedBill.editedById || null,
        collections: updatedBill.collections || [],
      };

      const { error: updateErr } = await (supabase.from('bills') as any).update(updatePayload).eq('id', params.billId);
      if (updateErr) {
        if (
          updatePayload.customer_id &&
          (updateErr.message?.includes('bills_customer_id_fkey') ||
            (updateErr as any).details?.includes('bills_customer_id_fkey'))
        ) {
          console.warn('updateBill bills_customer_id_fkey self-heal: clearing customer_id and retrying:', updatedBill.billNumber);
          updatePayload.customer_id = null;
          await (supabase.from('bills') as any).update(updatePayload).eq('id', params.billId);
        } else {
          console.warn('updateBill Supabase notice:', updateErr);
        }
      }

      // Re-insert bill items
      await (supabase.from('bill_items') as any).delete().eq('bill_id', params.billId);
      if (updatedBill.items && updatedBill.items.length > 0) {
        const itemRows = updatedBill.items.map(it => ({
          id: generateUUID(),
          shop_id: params.shopId,
          bill_id: params.billId,
          menu_item_id: it.menuItemId && it.menuItemId.includes('-') && it.menuItemId.length >= 32 ? it.menuItemId : null,
          item_name: it.itemName,
          is_half: !!it.isHalf,
          unit_price: it.unitPrice,
          quantity: it.quantity,
          line_total: it.lineTotal,
        }));
        await (supabase.from('bill_items') as any).insert(itemRows);
      }

      // Sync updated payment record in Supabase
      if (paidAmount > 0) {
        const method = ((params.paymentMode as string) === 'GPay' || (params.paymentMode as string) === 'UPI') ? 'GPay' : (params.paymentMode === 'Cash + GPay' ? 'Split' : 'Cash');
        const { data: existingPay } = await (supabase.from('payments') as any)
          .select('id')
          .eq('bill_id', params.billId)
          .limit(1)
          .maybeSingle();

        if (existingPay) {
          await (supabase.from('payments') as any)
            .update({ amount: paidAmount, payment_method: method })
            .eq('id', existingPay.id);
        } else {
          await (supabase.from('payments') as any).insert({
            id: generateUUID(),
            shop_id: params.shopId,
            bill_id: params.billId,
            payment_method: method,
            amount: paidAmount,
            status: 'successful',
            paid_at: existingBill.createdAt || nowIso,
          });
        }
      } else {
        await (supabase.from('payments') as any).delete().eq('bill_id', params.billId);
      }

      // Sync pending payment record in Supabase
      if (pendingAmount > 0) {
        const { data: existingPend } = await (supabase.from('pending_payments') as any)
          .select('id')
          .eq('bill_id', params.billId)
          .limit(1)
          .maybeSingle();

        if (existingPend) {
          await (supabase.from('pending_payments') as any)
            .update({
              amount_due: pendingAmount,
              customer_name: updatedBill.customerName || 'Customer',
              customer_phone: updatedBill.customerPhone || null,
              status: 'open',
            })
            .eq('id', existingPend.id);
        } else {
          await (supabase.from('pending_payments') as any).insert({
            id: generateUUID(),
            shop_id: params.shopId,
            bill_id: params.billId,
            customer_name: updatedBill.customerName || 'Customer',
            customer_phone: updatedBill.customerPhone || null,
            amount_due: pendingAmount,
            amount_paid: 0,
            status: 'open',
          });
        }
      } else {
        await (supabase.from('pending_payments') as any)
          .update({ status: 'settled', amount_due: 0 })
          .eq('bill_id', params.billId);
      }

      // Adjust customer aggregate if applicable
      const pendingDiff = updatedBill.pendingAmount - (existingBill.pendingAmount || 0);
      if (pendingDiff !== 0 && updatedBill.customerName && updatedBill.customerName !== 'Not tracked') {
        const cleanPhone = updatedBill.customerPhone ? updatedBill.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        let cust: any = null;
        if (cleanPhone && cleanPhone.length === 10) {
          const { data: byPhone } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', params.shopId)
            .ilike('phone', `%${cleanPhone}%`)
            .maybeSingle();
          cust = byPhone;
        }
        if (!cust) {
          const { data: byName } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', params.shopId)
            .eq('name', updatedBill.customerName)
            .maybeSingle();
          cust = byName;
        }

        if (cust) {
          await (supabase.from('customers') as any)
            .update({
              pending_balance: Math.max(0, (cust.pending_balance || 0) + pendingDiff),
            })
            .eq('id', cust.id);
        }
      }

      // Audit log in Supabase
      await (supabase.from('audit_logs') as any).insert({
        shop_id: params.shopId,
        actor_user_id: params.editor?.id && isValidUUID(params.editor.id) ? params.editor.id : null,
        action: 'bill.edited',
        entity_type: 'bill',
        entity_id: params.billId,
        metadata: {
          bill_number: existingBill.billNumber,
          previous_total: existingBill.totalAmount,
          new_total: updatedBill.totalAmount,
          editor_name: params.editor?.name,
          editor_role: params.editor?.role,
        },
      });
    } catch (err) {
      console.warn('updateBill Supabase notice:', err);
    }

    return updatedBill;
  },

  /**
   * Cancel/soft-delete a bill with complete audit trail (retains record for audit and 100-bill count)
   */
  async deleteBill(
    shopId: string,
    billId: string,
    deleter: { name: string; role: string; id?: string },
    cancellationReason?: string
  ): Promise<Bill> {
    if (deleter.role !== 'Owner') {
      if (deleter.role === 'Biller') {
        throw new Error('Unauthorized: Billers cannot delete or cancel bills. Only the shop Owner can delete or cancel bills.');
      }
      throw new Error(`Unauthorized: Only the shop Owner can delete or cancel bills. ${deleter.role}s cannot delete or cancel bills.`);
    }

    if (deleter.id) {
      const isActive = await authService.isUserActiveInShop(shopId, deleter.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const allBills = await this.getBills(shopId);
    const target = allBills.find(b => b.id === billId);
    if (!target) throw new Error('Bill not found');

    const nowIso = new Date().toISOString();

    const deletedBill: Bill = {
      ...target,
      status: 'cancelled',
      isDeleted: true,
      isCancelled: true,
      deletedAt: nowIso,
      deletedByName: deleter.name,
      deletedByRole: (deleter.role as any) || 'Owner',
      deletedById: deleter.id || null,
      cancellationReason: cancellationReason || 'Cancelled by staff',
    };

    // 1. Update local storage
    const updatedList = allBills.map(b => (b.id === billId ? deletedBill : b));
    await storage.setObject(LOCAL_BILLS_KEY, updatedList);

    // Also adjust local customer cache dues immediately
    if (target.customerName && target.pendingAmount > 0) {
      try {
        const localCusts = await storage.getObject<any[]>('@counterpro/customers', []);
        const cleanPhone = target.customerPhone ? target.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        const match = localCusts.find(c =>
          c.shopId === shopId && (
            (cleanPhone && c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) ||
            c.name === target.customerName
          )
        );
        if (match) {
          match.pendingBalance = Math.max(0, (match.pendingBalance || 0) - target.pendingAmount);
          match.statusTag = match.pendingBalance > 0 ? 'Pending' : 'Regular';
          await storage.setObject('@counterpro/customers', localCusts);
        }
      } catch {}
    }

    // 2. Soft-delete/cancel in Supabase
    try {
      await (supabase.from('bills') as any).update({
        status: 'cancelled',
        is_deleted: true,
        is_cancelled: true,
        cancellation_reason: deletedBill.cancellationReason,
        deleted_at: nowIso,
        deleted_by_name: deleter.name,
        deleted_by_role: deleter.role,
        deleted_by_id: deleter.id || null,
      }).eq('id', billId);

      // Cancel any open pending payment for this bill
      await (supabase.from('pending_payments') as any)
        .update({ status: 'cancelled' })
        .eq('bill_id', billId);

      // Adjust customer pending balance if applicable
      if (target.customerName && target.pendingAmount > 0) {
        const cleanPhone = target.customerPhone ? target.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        let cust: any = null;
        if (cleanPhone && cleanPhone.length === 10) {
          const { data: byPhone } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', shopId)
            .ilike('phone', `%${cleanPhone}%`)
            .maybeSingle();
          cust = byPhone;
        }
        if (!cust) {
          const { data: byName } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', shopId)
            .eq('name', target.customerName)
            .maybeSingle();
          cust = byName;
        }

        if (cust) {
          await (supabase.from('customers') as any)
            .update({
              pending_balance: Math.max(0, (cust.pending_balance || 0) - target.pendingAmount),
            })
            .eq('id', cust.id);
        }
      }

      // Also adjust local customer cache dues
      if (target.customerName && target.pendingAmount > 0) {
        try {
          const localCusts = await storage.getObject<any[]>('@counterpro/customers', []);
          const cleanPhone = target.customerPhone ? target.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
          const match = localCusts.find(c =>
            c.shopId === shopId && (
              (cleanPhone && c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) ||
              c.name === target.customerName
            )
          );
          if (match) {
            match.pendingBalance = Math.max(0, (match.pendingBalance || 0) - target.pendingAmount);
            match.statusTag = match.pendingBalance > 0 ? 'Pending' : 'Regular';
            await storage.setObject('@counterpro/customers', localCusts);
          }
        } catch {}
      }

      // Record in audit_logs
      await (supabase.from('audit_logs') as any).insert({
        shop_id: shopId,
        actor_user_id: deleter.id && isValidUUID(deleter.id) ? deleter.id : null,
        action: 'bill.cancelled',
        entity_type: 'bill',
        entity_id: billId,
        metadata: {
          bill_number: target.billNumber,
          original_total: target.totalAmount,
          reason: deletedBill.cancellationReason,
          cancelled_by: deleter.name,
          cancelled_by_role: deleter.role,
        },
      });
    } catch (err) {
      console.warn('deleteBill Supabase notice:', err);
    }

    return deletedBill;
  },

  /**
   * Derive real pending payments from actual bills and Supabase pending_payments
   */
  async getPendingPayments(shopId: string): Promise<PendingPaymentRecord[]> {
    if (!shopId) return [];

    const bills = await this.getActiveBills(shopId);
    // Only active bills with an actual positive pending balance
    const pendingBills = bills.filter(b => Number(b.pendingAmount || 0) > 0);

    return pendingBills.map(b => ({
      id: b.id,
      shopId: b.shopId,
      billId: b.id,
      billNumber: b.billNumber,
      customerName: b.customerName || 'Not tracked',
      customerPhone: b.customerPhone,
      amountDue: b.pendingAmount,
      amountPaid: b.paidAmount,
      ageDescription: 'Today',
      status: 'open',
      bills: [{ billNumber: b.billNumber, date: b.createdAt, amount: b.pendingAmount }],
      createdAt: b.createdAt,
    }));
  },

  /**
   * Clear or partially clear a pending payment, update local cache and Supabase.
   * If paidNowAmount is provided and less than total due, records partial payment,
   * leaves remaining amount in pending, and adds collected payment to revenue.
   */
  async clearPendingPayment(
    shopId: string,
    targetBillId: string,
    paidNowAmount?: number,
    paymentMode: PaymentMethod = 'Cash',
    collector?: { name?: string; role?: string; id?: string }
  ): Promise<PendingPaymentRecord[]> {
    const cleanId = String(targetBillId || '').replace(/^pend_/, '').trim();
    const bills = await this.getBills(shopId);
    const allSaved = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);

    // Locate target bill by direct id, clean id, bill number, or substring match
    const resolvedBill = bills.find(
      b => b.id === targetBillId ||
           b.id === cleanId ||
           b.billNumber === targetBillId ||
           b.billNumber === cleanId ||
           (targetBillId && (targetBillId.includes(b.id) || b.id.includes(targetBillId)))
    ) || allSaved.find(
      b => b.id === targetBillId ||
           b.id === cleanId ||
           b.billNumber === targetBillId ||
           b.billNumber === cleanId ||
           (targetBillId && (targetBillId.includes(b.id) || b.id.includes(targetBillId)))
    );

    if (!resolvedBill) {
      console.warn('clearPendingPayment: target bill not found for id:', targetBillId);
      return await this.getPendingPayments(shopId);
    }

    const currentDue = resolvedBill.pendingAmount > 0 ? resolvedBill.pendingAmount : resolvedBill.totalAmount;
    const nowIso = new Date().toISOString();

    // Determine how much is being paid now
    const amountToCollect = (paidNowAmount !== undefined && paidNowAmount !== null && paidNowAmount > 0)
      ? Math.min(paidNowAmount, currentDue)
      : currentDue;

    const remainingDue = Math.max(0, currentDue - amountToCollect);
    const isFullSettlement = remainingDue === 0;
    const newPaidAmount = (resolvedBill.paidAmount || 0) + amountToCollect;

    const initialPaid = resolvedBill.initialPaidAmount !== undefined
      ? resolvedBill.initialPaidAmount
      : (resolvedBill.paymentMode === 'Pending' ? 0 : (resolvedBill.paidAmount || 0));

    const newCollection: BillPaymentCollection = {
      id: generateUUID(),
      amount: amountToCollect,
      paymentMode,
      paidAt: nowIso,
      receivedByName: collector?.name || 'Owner',
      receivedById: collector?.id || null,
    };

    // 1. Update bill in local storage
    const updatedBills = allSaved.map(b => {
      const isMatch = b.id === resolvedBill.id ||
                      b.id === cleanId ||
                      (resolvedBill.billNumber && b.billNumber === resolvedBill.billNumber && b.shopId === shopId);
      if (isMatch) {
        const existingCols = b.collections || [];
        return {
          ...b,
          paidAmount: newPaidAmount,
          pendingAmount: remainingDue,
          initialPaidAmount: initialPaid,
          paymentMode: isFullSettlement ? (b.paymentMode === 'Pending' ? paymentMode : b.paymentMode) : b.paymentMode,
          settledAt: isFullSettlement ? nowIso : (b.settledAt || null),
          completedAt: nowIso,
          collections: [...existingCols, newCollection],
        };
      }
      return b;
    });

    await storage.setObject(LOCAL_BILLS_KEY, updatedBills);

    // 2. Update Supabase
    try {
      const dbMode = toSupabasePaymentMode(paymentMode);
      const updateData: any = {
        paid_amount: newPaidAmount,
        pending_amount: remainingDue,
        completed_at: nowIso,
        collections: [...(resolvedBill.collections || []), newCollection],
      };

      if (isFullSettlement) {
        updateData.settled_at = nowIso;
        if (resolvedBill.paymentMode === 'Pending') {
          updateData.payment_mode = dbMode;
        }
      }

      if (isValidUUID(resolvedBill.id)) {
        await (supabase.from('bills') as any).update(updateData).eq('id', resolvedBill.id);

        if (isFullSettlement) {
          await (supabase.from('pending_payments') as any)
            .update({
              status: 'settled',
              settled_at: nowIso,
              amount_paid: newPaidAmount,
              amount_due: 0,
            })
            .eq('bill_id', resolvedBill.id);
        } else {
          await (supabase.from('pending_payments') as any)
            .update({
              amount_due: remainingDue,
              amount_paid: newPaidAmount,
            })
            .eq('bill_id', resolvedBill.id);
        }
      } else {
        await (supabase.from('bills') as any).update(updateData).eq('shop_id', shopId).eq('bill_number', resolvedBill.billNumber);
      }

      // Record payment transaction
      await (supabase.from('payments') as any).insert({
        id: generateUUID(),
        shop_id: shopId,
        bill_id: isValidUUID(resolvedBill.id) ? resolvedBill.id : null,
        payment_method: dbMode,
        amount: amountToCollect,
        status: 'successful',
        paid_at: nowIso,
        created_by: collector?.id && isValidUUID(collector.id) ? collector.id : null,
      });

      if (resolvedBill.customerName && resolvedBill.customerName !== 'Not tracked') {
        const cleanPhone = resolvedBill.customerPhone ? resolvedBill.customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
        let cust: any = null;

        if (cleanPhone && cleanPhone.length === 10) {
          const { data: byPhone } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', shopId)
            .ilike('phone', `%${cleanPhone}%`)
            .limit(1)
            .maybeSingle();
          cust = byPhone;
        }

        if (!cust) {
          const { data: byName } = await (supabase.from('customers') as any)
            .select('id, pending_balance')
            .eq('shop_id', shopId)
            .eq('name', resolvedBill.customerName)
            .limit(1)
            .maybeSingle();
          cust = byName;
        }

        if (cust) {
          await (supabase.from('customers') as any)
            .update({
              pending_balance: Math.max(0, (cust.pending_balance || 0) - amountToCollect),
            })
            .eq('id', cust.id);
        }
      }
    } catch (err) {
      console.warn('clearPendingPayment Supabase notice:', err);
    }

    return await this.getPendingPayments(shopId);
  },

  /**
   * Get recently deleted bills retained within the 30-day retention window
   */
  async getRecentlyDeletedBills(shopId: string): Promise<Bill[]> {
    const allBills = await this.getBills(shopId);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return allBills.filter(b => {
      if (!b.isDeleted && b.status !== 'deleted' && b.status !== 'cancelled') return false;
      const delTime = b.deletedAt ? new Date(b.deletedAt).getTime() : new Date(b.createdAt).getTime();
      return delTime >= thirtyDaysAgo;
    });
  },

  async settlePendingPayment(
    shopId: string,
    targetBillId: string,
    paidNowAmount?: number,
    paymentMode: PaymentMethod = 'Cash',
    collector?: { name?: string; role?: string; id?: string }
  ): Promise<PendingPaymentRecord[]> {
    return this.clearPendingPayment(shopId, targetBillId, paidNowAmount, paymentMode, collector);
  },
};
