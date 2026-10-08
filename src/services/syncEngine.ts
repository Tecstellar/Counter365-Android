import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { SyncQueueItem } from '../types/models';
import { generateUUID } from '../lib/uuid';

const LOCAL_SYNC_QUEUE_KEY = '@counterpro/sync_queue';

export const syncEngine = {
  async getQueue(): Promise<SyncQueueItem[]> {
    return await storage.getObject<SyncQueueItem[]>(LOCAL_SYNC_QUEUE_KEY, []);
  },

  async enqueue(item: {
    operationId: string;
    shopId: string;
    action: SyncQueueItem['action'];
    payload: any;
  }): Promise<void> {
    const queue = await this.getQueue();
    // Check if operation already queued
    if (queue.some(q => q.operationId === item.operationId)) return;

    const newItem: SyncQueueItem = {
      id: generateUUID(),
      operationId: item.operationId,
      shopId: item.shopId,
      action: item.action,
      payload: item.payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    await storage.setObject(LOCAL_SYNC_QUEUE_KEY, [...queue, newItem]);
    // Trigger sync process in background
    this.processQueue().catch(err => console.warn('Background sync trigger notice:', err));
  },

  async processQueue(): Promise<{ processed: number; failed: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;
    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      if (item.status === 'synced') continue;

      try {
        if (item.action === 'create_bill') {
          const bill = item.payload;

          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isValidUUID = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

          if (!bill || !bill.id || !isValidUUID(bill.shopId)) {
            throw new Error(`Invalid sync bill payload or non-UUID shop: ${bill?.shopId || item.shopId}`);
          }
          
          let dbPaymentMode: 'Cash' | 'GPay' | 'Pending' | 'Split' = 'Cash';
          if (bill.paymentMode === 'Pending') {
            dbPaymentMode = 'Pending';
          } else if (bill.paymentMode === 'GPay' || bill.paymentMode === 'UPI') {
            dbPaymentMode = 'GPay';
          } else if (bill.paymentMode === 'Split' || bill.paymentMode === 'Partial Pay' || bill.paymentMode === 'Cash + GPay') {
            dbPaymentMode = 'Split';
          }

          const validOpId = isValidUUID(item.operationId) ? item.operationId : null;

          const { error: billErr } = await (supabase.from('bills') as any).upsert({
            id: bill.id,
            shop_id: bill.shopId,
            bill_number: bill.billNumber,
            customer_id: bill.customerId && isValidUUID(bill.customerId) ? bill.customerId : null,
            customer_name: bill.customerName || null,
            customer_phone: bill.customerPhone || null,
            table_number: bill.tableNumber || null,
            status: bill.status || 'completed',
            subtotal: bill.subtotal,
            discount_amount: 0.00,
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
            deleted_at: bill.deletedAt || null,
            deleted_by_name: bill.deletedByName || null,
            deleted_by_role: bill.deletedByRole || null,
            completed_at: bill.completedAt || new Date().toISOString(),
            settled_at: bill.settledAt || null,
          });

          if (billErr) {
            throw new Error(`Bills upsert failed: ${billErr.message}`);
          }

          if (bill.items && bill.items.length > 0) {
            const { error: itemErr } = await (supabase.from('bill_items') as any).insert(
              bill.items.map((it: any) => ({
                id: generateUUID(),
                shop_id: bill.shopId,
                bill_id: bill.id,
                menu_item_id: it.menuItemId && it.menuItemId.includes('-') && it.menuItemId.length >= 32 ? it.menuItemId : null,
                item_name: it.itemName,
                is_half: !!it.isHalf,
                unit_price: it.unitPrice,
                quantity: it.quantity,
                line_total: it.lineTotal,
              }))
            );
            if (itemErr) console.warn('Bill items sync notice:', itemErr.message);
          }
          processed++;
        } else if (item.action === 'add_expense') {
          const exp = item.payload;
          const { error: expErr } = await (supabase.from('expenses') as any).upsert({
            id: exp.id,
            shop_id: exp.shopId,
            description: exp.description,
            amount: exp.amount,
            expense_date: exp.expenseDate,
          });
          if (expErr) throw new Error(`Expense upsert failed: ${expErr.message}`);
          processed++;
        } else if (item.action === 'clear_pending') {
          const { billId, amount } = item.payload;
          await (supabase.from('bills') as any)
            .update({ pending_amount: 0 })
            .eq('id', billId);
          await (supabase.from('pending_payments') as any)
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
              amount_paid: amount || 0,
            })
            .eq('bill_id', billId);
          processed++;
        } else {
          processed++;
        }
      } catch (err: any) {
        console.warn(`Sync queue item ${item.id} retry scheduled:`, err?.message);
        failed++;
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          status: 'failed',
          lastError: err?.message || 'Sync error',
        });
      }
    }

    await storage.setObject(LOCAL_SYNC_QUEUE_KEY, remaining);
    return { processed, failed };
  }
};
