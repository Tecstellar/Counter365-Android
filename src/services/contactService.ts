import * as Contacts from 'expo-contacts/legacy';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { CustomerRecord, VendorRecord } from '../types/models';
import { generateUUID, isValidUUID } from '../lib/uuid';
import { shopService } from './shopService';

const LOCAL_CUSTOMERS_KEY = '@counterpro/customers';
const LOCAL_VENDORS_KEY = '@counterpro/vendors';

export interface DeviceContactItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export type ContactPermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

export interface DeviceContactsResponse {
  status: ContactPermissionStatus;
  contacts: DeviceContactItem[];
  canAskAgain: boolean;
  errorMessage?: string;
}

export const contactService = {
  /**
   * Fetch real customers for this shop from local cache and Supabase
   */
  async getCustomers(shopId: string): Promise<CustomerRecord[]> {
    if (!shopId) return [];

    const saved = await storage.getObject<CustomerRecord[]>(LOCAL_CUSTOMERS_KEY, []);
    const localFiltered = saved.filter(c => c.shopId === shopId);
    let allCandidates = [...localFiltered];

    try {
      const { data: dbCustomers } = await (supabase.from('customers') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (dbCustomers && dbCustomers.length > 0) {
        const loaded: CustomerRecord[] = dbCustomers.map((c: any) => {
          let location: string | null = c.location || null;
          if (!location && c.notes && c.notes.startsWith('Location:')) {
            const parts = c.notes.split('|');
            location = parts[0].replace('Location:', '').trim();
          }
          const isVip = c.is_vip ?? (c.notes?.includes('[VIP]') || Number(c.total_bills || 0) >= 15);
          const isActive = c.is_active !== false;
          return {
            id: c.id,
            shopId: c.shop_id,
            name: c.name,
            phone: c.phone || null,
            location: location || null,
            notes: c.notes || null,
            totalBills: Number(c.total_bills || 0),
            pendingBalance: Number(c.pending_balance || 0),
            statusTag: c.status_tag || (Number(c.pending_balance || 0) > 0 ? 'Pending' : (isVip ? 'MVP' : 'Regular')),
            isActive,
            isVip,
          };
        });
        // Local cache contains most recent device mutations (payments/cancellations)
        allCandidates = [...localFiltered, ...loaded];
      }
    } catch (err) {
      console.warn('getCustomers Supabase notice:', err);
    }

    // Strict deduplication by 10-digit phone number and name
    const phoneMap = new Map<string, CustomerRecord>();
    const nameMap = new Map<string, CustomerRecord>();
    const uniqueLoaded: CustomerRecord[] = [];

    for (const c of allCandidates) {
      const clean = c.phone ? c.phone.replace(/[^0-9]/g, '').slice(-10) : '';
      if (clean && clean.length === 10) {
        if (phoneMap.has(clean)) {
          continue;
        }
        phoneMap.set(clean, c);
      } else {
        const lowerName = c.name.trim().toLowerCase();
        if (nameMap.has(lowerName)) {
          continue;
        }
        nameMap.set(lowerName, c);
      }
      uniqueLoaded.push(c);
    }

    await storage.setObject(LOCAL_CUSTOMERS_KEY, uniqueLoaded);
    return uniqueLoaded;
  },

  /**
   * Add a real customer and persist to Supabase customers table
   */
  async addCustomer(
    shopId: string,
    name: string,
    phone?: string,
    location?: string,
    notes?: string
  ): Promise<CustomerRecord> {
    const list = await this.getCustomers(shopId);
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '').slice(-10) : '';

    // If customer with same phone already exists, reuse and never duplicate
    if (cleanPhone && cleanPhone.length === 10) {
      const existing = list.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone);
      if (existing) {
        return existing;
      }
    }

    const notesContent = location ? `Location: ${location}${notes ? ` | ${notes}` : ''}` : (notes || null);

    const newCust: CustomerRecord = {
      id: generateUUID(),
      shopId,
      name: name.trim(),
      phone: cleanPhone ? cleanPhone : (phone?.trim() || null),
      location: location?.trim() || null,
      notes: notesContent,
      totalBills: 0,
      pendingBalance: 0,
      statusTag: 'Regular',
    };

    const updated = [newCust, ...list.filter(c => c.id !== newCust.id)];
    await storage.setObject(LOCAL_CUSTOMERS_KEY, updated);

    try {
      await shopService.ensureShopExists(newCust.shopId);
      await (supabase.from('customers') as any).insert({
        id: newCust.id,
        shop_id: newCust.shopId,
        name: newCust.name,
        phone: newCust.phone,
        location: newCust.location || null,
        notes: notesContent,
        total_bills: 0,
        pending_balance: 0,
        status_tag: newCust.statusTag || 'Regular',
        is_active: true,
        is_vip: false,
      });
    } catch (err) {
      console.warn('addCustomer Supabase notice:', err);
    }

    return newCust;
  },

  /**
   * Ensures that a customer exists in Supabase so foreign key constraints (bills_customer_id_fkey) are satisfied.
   * If customer row does not exist in Supabase, attempts to upsert it.
   * Returns true if customer exists / was verified in Supabase, or false if missing.
   */
  async ensureCustomerExists(
    customerId: string,
    shopId: string,
    name?: string | null,
    phone?: string | null
  ): Promise<boolean> {
    if (!customerId || !isValidUUID(customerId) || !shopId || !isValidUUID(shopId)) {
      return false;
    }

    try {
      // 1. Check if customer already exists in Supabase
      const { data: existing, error: checkError } = await (supabase.from('customers') as any)
        .select('id')
        .eq('id', customerId)
        .maybeSingle();

      if (!checkError && existing?.id) {
        return true;
      }

      // 2. Ensure parent shop exists first so customers_shop_id_fkey is satisfied
      await shopService.ensureShopExists(shopId);

      // 3. Upsert customer into Supabase
      const { error: upsertErr } = await (supabase.from('customers') as any)
        .upsert(
          {
            id: customerId,
            shop_id: shopId,
            name: name ? name.trim() : 'Customer',
            phone: phone ? phone.replace(/[^0-9]/g, '').slice(-10) : '',
            status_tag: 'Regular',
            is_active: true,
            total_bills: 0,
            pending_balance: 0,
          },
          { onConflict: 'id' }
        );

      if (!upsertErr) {
        return true;
      }

      console.warn('ensureCustomerExists upsert notice:', upsertErr.message);
      return false;
    } catch (err) {
      console.warn('ensureCustomerExists check notice:', err);
      return false;
    }
  },

  /**
   * Batch add multiple customers with detailed result metrics
   */
  async importCustomersWithResult(
    shopId: string,
    items: Array<{ name: string; phone?: string; location?: string }>
  ): Promise<{ added: CustomerRecord[]; alreadyExistingCount: number; invalidCount: number }> {
    if (!items || items.length === 0) {
      return { added: [], alreadyExistingCount: 0, invalidCount: 0 };
    }
    const list = await this.getCustomers(shopId);

    const existingPhones = new Set(
      list.map(c => c.phone ? c.phone.replace(/[^0-9]/g, '').slice(-10) : '').filter(Boolean)
    );

    const newRecords: CustomerRecord[] = [];
    let alreadyExistingCount = 0;
    let invalidCount = 0;

    for (const item of items) {
      const trimmedName = item.name ? item.name.trim() : '';
      if (!trimmedName) {
        invalidCount++;
        continue;
      }

      let finalPhone: string | null = null;
      if (item.phone && item.phone.trim()) {
        const clean = item.phone.replace(/[^0-9]/g, '').slice(-10);
        if (clean.length !== 10) {
          invalidCount++;
          continue;
        }
        if (existingPhones.has(clean)) {
          alreadyExistingCount++;
          continue; // Duplicate phone — skip
        }
        existingPhones.add(clean);
        finalPhone = clean;
      }

      newRecords.push({
        id: generateUUID(),
        shopId,
        name: trimmedName,
        phone: finalPhone,
        location: item.location?.trim() || null,
        notes: item.location ? `Location: ${item.location}` : null,
        totalBills: 0,
        pendingBalance: 0,
        statusTag: 'Regular',
        isActive: true,
      });
    }

    if (newRecords.length > 0) {
      const updated = [...newRecords, ...list];
      await storage.setObject(LOCAL_CUSTOMERS_KEY, updated);

      try {
        const inserts = newRecords.map(r => ({
          id: r.id,
          shop_id: r.shopId,
          name: r.name,
          phone: r.phone,
          location: r.location || null,
          notes: r.notes,
          total_bills: 0,
          pending_balance: 0,
          status_tag: r.statusTag || 'Regular',
          is_active: true,
          is_vip: false,
        }));

        for (let i = 0; i < inserts.length; i += 50) {
          const chunk = inserts.slice(i, i + 50);
          await (supabase.from('customers') as any).insert(chunk);
        }
      } catch (err) {
        console.warn('importCustomersWithResult Supabase notice:', err);
      }
    }

    return {
      added: newRecords,
      alreadyExistingCount,
      invalidCount,
    };
  },

  /**
   * Batch add multiple customers
   */
  async addMultipleCustomers(
    shopId: string,
    items: Array<{ name: string; phone?: string; location?: string }>
  ): Promise<CustomerRecord[]> {
    const res = await this.importCustomersWithResult(shopId, items);
    return res.added;
  },

  /**
   * Fetch real vendors for this shop from local cache and Supabase
   */
  async getVendors(shopId: string): Promise<VendorRecord[]> {
    if (!shopId) return [];

    try {
      const { data: dbVendors } = await (supabase.from('vendors') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (dbVendors && dbVendors.length > 0) {
        const loaded: VendorRecord[] = dbVendors.map((v: any) => {
          let location: string | null = v.location || null;
          if (!location && v.notes && v.notes.startsWith('Location:')) {
            const parts = v.notes.split('|');
            location = parts[0].replace('Location:', '').trim();
          }
          return {
            id: v.id,
            shopId: v.shop_id,
            name: v.name,
            phone: v.phone || null,
            supplyType: v.supply_type || 'Supplies',
            location: location || null,
            schedule: v.schedule || 'Regular',
            notes: v.notes || null,
            isActive: v.is_active !== false,
          };
        });
        await storage.setObject(LOCAL_VENDORS_KEY, loaded);
        return loaded;
      }
    } catch (err) {
      console.warn('getVendors Supabase notice:', err);
    }

    const saved = await storage.getObject<VendorRecord[]>(LOCAL_VENDORS_KEY, []);
    return saved.filter(v => v.shopId === shopId);
  },

  /**
   * Add a real vendor and persist to Supabase vendors table
   */
  async addVendor(
    shopId: string,
    name: string,
    supplyType: string,
    phone?: string,
    location?: string,
    notes?: string
  ): Promise<VendorRecord> {
    const list = await this.getVendors(shopId);
    const notesContent = location ? `Location: ${location}${notes ? ` | ${notes}` : ''}` : (notes || null);

    const newVendor: VendorRecord = {
      id: generateUUID(),
      shopId,
      name: name.trim(),
      supplyType: supplyType.trim() || 'Supplies',
      phone: phone?.trim() || null,
      location: location?.trim() || null,
      schedule: 'Regular',
      notes: notesContent,
    };

    const updated = [newVendor, ...list.filter(v => v.id !== newVendor.id)];
    await storage.setObject(LOCAL_VENDORS_KEY, updated);

    try {
      await (supabase.from('vendors') as any).insert({
        id: newVendor.id,
        shop_id: newVendor.shopId,
        name: newVendor.name,
        phone: newVendor.phone,
        category: 'General',
        supply_type: newVendor.supplyType,
        location: newVendor.location || null,
        schedule: newVendor.schedule || 'Regular',
        notes: notesContent,
        pending_balance: 0,
        is_active: true,
      });
    } catch (err) {
      console.warn('addVendor Supabase notice:', err);
    }

    return newVendor;
  },

  /**
   * Batch add multiple vendors with supplyType
   */
  async addMultipleVendors(
    shopId: string,
    items: Array<{ name: string; phone?: string; location?: string }>,
    supplyType: string
  ): Promise<VendorRecord[]> {
    if (!items || items.length === 0) return [];
    const list = await this.getVendors(shopId);

    const newRecords: VendorRecord[] = items.map(item => ({
      id: generateUUID(),
      shopId,
      name: item.name.trim(),
      supplyType: supplyType.trim() || 'Supplies',
      phone: item.phone?.trim() || null,
      location: item.location?.trim() || null,
      schedule: 'Regular',
      notes: item.location ? `Location: ${item.location}` : null,
    }));

    const updated = [...newRecords, ...list];
    await storage.setObject(LOCAL_VENDORS_KEY, updated);

    try {
      const inserts = newRecords.map(r => ({
        id: r.id,
        shop_id: r.shopId,
        name: r.name,
        phone: r.phone,
        supply_type: r.supplyType,
        notes: r.notes,
        pending_balance: 0,
        is_active: true,
      }));

      // Insert in chunks of 50 to prevent network payload or database timeouts
      for (let i = 0; i < inserts.length; i += 50) {
        const chunk = inserts.slice(i, i + 50);
        await (supabase.from('vendors') as any).insert(chunk);
      }
    } catch (err) {
      console.warn('addMultipleVendors Supabase notice:', err);
    }

    return newRecords;
  },

  /**
   * Find existing customer in shop by normalized phone number
   */
  async findExistingCustomerByPhone(shopId: string, phone: string): Promise<CustomerRecord | null> {
    if (!shopId || !phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return null;
    const customers = await this.getCustomers(shopId);
    return customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) || null;
  },

  /**
   * Check contact permission and fetch real device contacts with full state tracking
   */
  async fetchDeviceContactsWithPermission(): Promise<DeviceContactsResponse> {
    try {
      const perm = await Contacts.getPermissionsAsync();
      let status = perm.status;
      let canAskAgain = perm.canAskAgain !== false;

      if (status !== 'granted' && canAskAgain) {
        const req = await Contacts.requestPermissionsAsync();
        status = req?.status || 'denied';
        canAskAgain = req?.canAskAgain !== false;
      }

      if (status !== 'granted') {
        return {
          status: !canAskAgain ? 'blocked' : 'denied',
          canAskAgain,
          contacts: [],
          errorMessage: !canAskAgain
            ? 'Contact permission is blocked in device settings. Please enable contact access to import.'
            : 'Contact permission was not granted by user.',
        };
      }

      const fields = [
        Contacts.Fields?.PhoneNumbers || 'phoneNumbers',
        Contacts.Fields?.Name || 'name',
        Contacts.Fields?.Emails || 'emails',
      ];
      const { data } = await Contacts.getContactsAsync({ fields });

      if (data && data.length > 0) {
        const list: DeviceContactItem[] = [];
        for (const c of data) {
          const name = c.name?.trim() || `${c.firstName || ''} ${c.lastName || ''}`.trim();
          if (!name) continue;
          let phone = '';
          if (c.phoneNumbers && c.phoneNumbers.length > 0) {
            const validMobile = c.phoneNumbers.find((p: any) => {
              const digits = (p?.number || '').replace(/\D/g, '').slice(-10);
              return digits.length === 10 && /^[6-9]/.test(digits);
            });
            const chosen = validMobile || c.phoneNumbers[0];
            if (chosen?.number) {
              phone = chosen.number.replace(/\D/g, '').slice(-10);
            }
          }
          let email: string | undefined = undefined;
          if (c.emails && c.emails.length > 0 && c.emails[0]?.email) {
            email = c.emails[0].email.trim();
          }
          list.push({
            id: c.id || generateUUID(),
            name,
            phone: phone || undefined,
            email: email || undefined,
          });
        }
        return {
          status: 'granted',
          canAskAgain: true,
          contacts: list.sort((a, b) => a.name.localeCompare(b.name)),
        };
      }

      return {
        status: 'granted',
        canAskAgain: true,
        contacts: [],
      };
    } catch (err: any) {
      console.warn('fetchDeviceContactsWithPermission error:', err);
      return {
        status: 'denied',
        canAskAgain: true,
        contacts: [],
        errorMessage: err?.message || 'Could not access device contacts',
      };
    }
  },

  /**
   * Fetch real device contacts via expo-contacts/legacy (backward compatibility wrapper)
   */
  async getDeviceContacts(): Promise<DeviceContactItem[]> {
    const res = await this.fetchDeviceContactsWithPermission();
    return res.contacts;
  },

  /**
   * Update an existing customer record locally and in Supabase
   */
  async updateCustomer(
    shopId: string,
    customerId: string,
    updates: Partial<CustomerRecord>
  ): Promise<CustomerRecord | null> {
    const list = await this.getCustomers(shopId);
    const index = list.findIndex(c => c.id === customerId);
    if (index === -1) return null;

    const current = list[index];
    const updated: CustomerRecord = {
      ...current,
      ...updates,
    };

    const nextList = [...list];
    nextList[index] = updated;
    await storage.setObject(LOCAL_CUSTOMERS_KEY, nextList);

    try {
      const dbPayload: any = {};
      if (updates.name !== undefined) dbPayload.name = updates.name.trim();
      if (updates.phone !== undefined) dbPayload.phone = updates.phone;
      if (updates.notes !== undefined || updates.location !== undefined || updates.isVip !== undefined) {
        const loc = updates.location !== undefined ? updates.location : current.location;
        const extra = updates.notes !== undefined ? updates.notes : current.notes;
        const vipTag = updates.isVip ? '[VIP]' : '';
        dbPayload.notes = loc ? `Location: ${loc}${extra ? ` | ${extra}` : ''} ${vipTag}`.trim() : (extra ? `${extra} ${vipTag}`.trim() : (vipTag || null));
      }
      if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;

      await (supabase.from('customers') as any)
        .update(dbPayload)
        .eq('id', customerId);
    } catch (err) {
      console.warn('updateCustomer Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Toggle customer active / inactive status in database and cache
   */
  async toggleCustomerActive(
    shopId: string,
    customerId: string,
    isActive: boolean
  ): Promise<boolean> {
    const res = await this.updateCustomer(shopId, customerId, { isActive });
    return !!res;
  },

  /**
   * Update an existing vendor record locally and in Supabase
   */
  async updateVendor(
    shopId: string,
    vendorId: string,
    updates: Partial<VendorRecord>
  ): Promise<VendorRecord | null> {
    const list = await this.getVendors(shopId);
    const index = list.findIndex(v => v.id === vendorId);
    if (index === -1) return null;

    const current = list[index];
    const updated: VendorRecord = {
      ...current,
      ...updates,
    };

    const nextList = [...list];
    nextList[index] = updated;
    await storage.setObject(LOCAL_VENDORS_KEY, nextList);

    try {
      const dbPayload: any = {};
      if (updates.name !== undefined) dbPayload.name = updates.name.trim();
      if (updates.phone !== undefined) dbPayload.phone = updates.phone;
      if (updates.supplyType !== undefined) dbPayload.supply_type = updates.supplyType;
      if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;
      if (updates.notes !== undefined || updates.location !== undefined) {
        const loc = updates.location !== undefined ? updates.location : current.location;
        const extra = updates.notes !== undefined ? updates.notes : current.notes;
        dbPayload.notes = loc ? `Location: ${loc}${extra ? ` | ${extra}` : ''}` : extra;
      }

      await (supabase.from('vendors') as any)
        .update(dbPayload)
        .eq('id', vendorId);
    } catch (err) {
      console.warn('updateVendor Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Toggle vendor active / inactive status in database and cache
   */
  async toggleVendorActive(
    shopId: string,
    vendorId: string,
    isActive: boolean
  ): Promise<boolean> {
    const res = await this.updateVendor(shopId, vendorId, { isActive });
    return !!res;
  },

  /**
   * Get purchase history & favorite dishes for a specific customer
   * Answers "What are the bills they like?"
   */
  async getCustomerHistory(
    shopId: string,
    customerName: string,
    customerPhone?: string | null
  ): Promise<{
    totalBills: number;
    totalSpent: number;
    bills: any[];
    favoriteItems: Array<{ name: string; quantity: number; amount: number }>;
  }> {
    const allBills = await storage.getObject<any[]>('@counterpro/bills', []);
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';
    const normName = customerName.trim().toLowerCase();

    const matchingBills = allBills.filter(b => {
      if (b.shopId !== shopId) return false;
      if (b.isDeleted || b.status === 'deleted') return false;

      if (cleanPhone && b.customerPhone) {
        const bPhone = String(b.customerPhone).replace(/\D/g, '').slice(-10);
        if (bPhone === cleanPhone) return true;
      }

      if (b.customerName && b.customerName.trim().toLowerCase() === normName) {
        return true;
      }

      return false;
    });

    matchingBills.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let totalSpent = 0;
    const itemMap = new Map<string, { name: string; quantity: number; amount: number }>();

    for (const b of matchingBills) {
      totalSpent += Number(b.totalAmount || 0);
      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          const itemName = item.name || 'Custom item';
          const qty = Number(item.quantity || 1);
          const amt = Number(item.lineTotal || 0);

          if (itemMap.has(itemName)) {
            const existing = itemMap.get(itemName)!;
            existing.quantity += qty;
            existing.amount += amt;
          } else {
            itemMap.set(itemName, { name: itemName, quantity: qty, amount: amt });
          }
        }
      }
    }

    const favoriteItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalBills: matchingBills.length,
      totalSpent,
      bills: matchingBills,
      favoriteItems,
    };
  },
};
