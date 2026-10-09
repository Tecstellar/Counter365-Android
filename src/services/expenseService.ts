import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { ExpenseRecord } from '../types/models';
import { generateUUID } from '../lib/uuid';
import { authService } from './authService';
import { shopService } from './shopService';

const LOCAL_EXPENSES_KEY = '@counterpro/expenses';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export const expenseService = {
  /**
   * Fetch real expenses for this shop from local cache and Supabase, merging both.
   */
  async getExpenses(shopId: string): Promise<ExpenseRecord[]> {
    if (!shopId) return [];

    const saved = await storage.getObject<ExpenseRecord[]>(LOCAL_EXPENSES_KEY, []);
    let shopExpenses = saved.filter(e => e.shopId === shopId);

    if (!isValidUUID(shopId)) {
      return shopExpenses;
    }

    try {
      const { data: dbExpenses, error } = await (supabase.from('expenses') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('expense_date', { ascending: false });

      if (!error && dbExpenses) {
        const loaded: ExpenseRecord[] = dbExpenses.map((e: any) => ({
          id: e.id,
          shopId: e.shop_id,
          description: e.description || e.item_name || 'Expense',
          amount: Number(e.amount || 0),
          category: e.category || 'General',
          paymentMode: e.payment_mode || 'Cash',
          expenseDate: e.expense_date,
          createdByName: e.created_by_name || null,
          createdByRole: e.created_by_role || null,
          createdById: e.created_by || null,
          createdAt: e.created_at,
          updatedAt: e.updated_at || null,
        }));

        const mergedMap = new Map<string, ExpenseRecord>();
        for (const rem of loaded) {
          mergedMap.set(rem.id, rem);
        }
        for (const loc of shopExpenses) {
          mergedMap.set(loc.id, loc);
        }

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
        );

        const otherShopExpenses = saved.filter(e => e.shopId !== shopId);
        await storage.setObject(LOCAL_EXPENSES_KEY, [...merged, ...otherShopExpenses]);
        shopExpenses = merged;

        // Sync any local expenses missing from Supabase
        const remoteIds = new Set(loaded.map(e => e.id));
        const unsynced = shopExpenses.filter(e => !remoteIds.has(e.id));
        for (const exp of unsynced) {
          try {
            await (supabase.from('expenses') as any).upsert({
              id: exp.id,
              shop_id: exp.shopId,
              title: exp.description || 'Expense',
              description: exp.description || 'Expense',
              item_name: exp.description || 'Expense',
              amount: exp.amount,
              expense_date: exp.expenseDate,
            });
          } catch {}
        }
      }
    } catch (err) {
      console.warn('getExpenses Supabase notice:', err);
    }

    return shopExpenses;
  },

  /**
   * Add a real expense and persist directly to Supabase and local cache
   */
  async addExpense(
    shopId: string,
    description: string,
    amount: number,
    options?: {
      category?: string;
      paymentMode?: string;
      creator?: { id?: string; name?: string; role?: string };
    }
  ): Promise<ExpenseRecord> {
    if (options?.creator?.role === 'Biller') {
      throw new Error('Unauthorized: Billers cannot create expenses.');
    }

    if (options?.creator?.id) {
      const isActive = await authService.isUserActiveInShop(shopId, options.creator.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const list = await this.getExpenses(shopId);
    const newExp: ExpenseRecord = {
      id: generateUUID(),
      shopId,
      description,
      amount,
      category: options?.category || 'General',
      paymentMode: options?.paymentMode || 'Cash',
      createdByName: options?.creator?.name || 'Owner',
      createdByRole: options?.creator?.role || 'Owner',
      createdById: options?.creator?.id || null,
      expenseDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    const updated = [newExp, ...list];
    await storage.setObject(LOCAL_EXPENSES_KEY, updated);

    if (!isValidUUID(shopId)) {
      return newExp;
    }

    try {
      await shopService.ensureShopExists(shopId);
      const { error } = await (supabase.from('expenses') as any).insert({
        id: newExp.id,
        shop_id: newExp.shopId,
        title: newExp.description || 'Expense',
        description: newExp.description || 'Expense',
        item_name: newExp.description || 'Expense',
        amount: newExp.amount,
        category: newExp.category,
        payment_mode: newExp.paymentMode,
        expense_date: newExp.expenseDate,
        created_by_name: newExp.createdByName,
        created_by_role: newExp.createdByRole,
      });
      if (error) {
        console.warn('addExpense Supabase error:', error.message);
      }
    } catch (err) {
      console.warn('addExpense Supabase notice:', err);
    }

    return newExp;
  },

  /**
   * Update an existing expense and persist to Supabase and local cache
   */
  async updateExpense(
    shopId: string,
    expenseId: string,
    description: string,
    amount: number,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<ExpenseRecord[]> {
    if (actor?.role === 'Biller') {
      throw new Error('Unauthorized: Billers cannot edit expenses.');
    }

    if (actor?.id) {
      const isActive = await authService.isUserActiveInShop(shopId, actor.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const saved = await storage.getObject<ExpenseRecord[]>(LOCAL_EXPENSES_KEY, []);
    const updated = saved.map(e => {
      if (e.id === expenseId && e.shopId === shopId) {
        return {
          ...e,
          description,
          amount,
          updatedAt: new Date().toISOString(),
        };
      }
      return e;
    });

    await storage.setObject(LOCAL_EXPENSES_KEY, updated);

    if (!isValidUUID(shopId)) {
      return updated.filter(e => e.shopId === shopId);
    }

    try {
      const { error } = await (supabase.from('expenses') as any)
        .update({
          title: description,
          description,
          item_name: description,
          amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .eq('shop_id', shopId);

      if (error) {
        console.warn('updateExpense Supabase error:', error.message);
      }
    } catch (err) {
      console.warn('updateExpense Supabase notice:', err);
    }

    return updated.filter(e => e.shopId === shopId);
  },

  /**
   * Delete an expense and remove from Supabase and local cache
   */
  async deleteExpense(
    shopId: string,
    expenseId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<ExpenseRecord[]> {
    if (actor?.role === 'Biller') {
      throw new Error('Unauthorized: Billers cannot delete expenses.');
    }

    if (actor?.id) {
      const isActive = await authService.isUserActiveInShop(shopId, actor.id);
      if (!isActive) {
        throw new Error('Your staff account has been deactivated. Please contact the shop owner.');
      }
    }

    const saved = await storage.getObject<ExpenseRecord[]>(LOCAL_EXPENSES_KEY, []);
    const updated = saved.filter(e => !(e.id === expenseId && e.shopId === shopId));

    await storage.setObject(LOCAL_EXPENSES_KEY, updated);

    if (!isValidUUID(shopId)) {
      return updated.filter(e => e.shopId === shopId);
    }

    try {
      const { error } = await (supabase.from('expenses') as any)
        .delete()
        .eq('id', expenseId)
        .eq('shop_id', shopId);

      if (error) {
        console.warn('deleteExpense Supabase error:', error.message);
      }
    } catch (err) {
      console.warn('deleteExpense Supabase notice:', err);
    }

    return updated.filter(e => e.shopId === shopId);
  }
};
