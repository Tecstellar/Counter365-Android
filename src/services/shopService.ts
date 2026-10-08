import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { Shop, ShopType, ShopMember, UserRole, PermissionKey } from '../types/models';
import { menuService } from './menuService';
import { generateUUID } from '../lib/uuid';

const LOCAL_SHOP_KEY = '@counterpro/active_shop';
const LOCAL_USERS_KEY = '@counterpro/shop_users';

export const INITIAL_EMPTY_SHOP: Shop = {
  id: '',
  name: '',
  shopType: 'Tea Shop',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  currencyCode: 'INR',
  timezone: 'Asia/Kolkata',
  gstEnabled: false,
  gstRate: 5.0,
  roundOffEnabled: true,
  dailyBackupEnabled: true,
  printerEnabled: false,
};

export const shopService = {
  /**
   * Get the active shop from local cache or Supabase
   */
  async getActiveShop(): Promise<Shop> {
    const saved = await storage.getObject<Shop | null>(LOCAL_SHOP_KEY, null);
    if (saved && saved.id) return saved;

    try {
      const { data: shops } = await (supabase.from('shops') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (shops && shops.length > 0) {
        const s = shops[0];
        const loadedShop: Shop = {
          id: s.id,
          name: s.name,
          shopType: s.shop_type as ShopType,
          phone: s.phone,
          address: s.address,
          city: s.city,
          state: s.state,
          country: s.country || 'India',
          pincode: s.pincode,
          latitude: s.latitude ? Number(s.latitude) : undefined,
          longitude: s.longitude ? Number(s.longitude) : undefined,
          logoUrl: s.logo_url,
          currencyCode: s.currency_code || 'INR',
          timezone: s.timezone || 'Asia/Kolkata',
          gstEnabled: s.gst_enabled ?? false,
          gstRate: s.gst_rate ? Number(s.gst_rate) : 5.0,
          gstNumber: s.gst_number,
          roundOffEnabled: s.round_off_enabled ?? true,
          dailyBackupEnabled: s.daily_backup_enabled ?? true,
          printerEnabled: s.printer_enabled ?? false,
          printerName: s.printer_name,
          tableManagementEnabled: s.table_management_enabled ?? false,
          tableCount: s.table_count ? Number(s.table_count) : 4,
          createdAt: s.created_at,
        };
        await storage.setObject(LOCAL_SHOP_KEY, loadedShop);
        return loadedShop;
      }
    } catch (err) {
      console.warn('getActiveShop Supabase query notice:', err);
    }

    return INITIAL_EMPTY_SHOP;
  },

  /**
   * Save / update shop details in Supabase and local cache
   */
  async saveShop(shop: Shop): Promise<Shop> {
    await storage.setObject(LOCAL_SHOP_KEY, shop);
    try {
      // Remote shops table contains core shop fields; table management settings are preserved in local storage
      await (supabase.from('shops') as any).upsert({
        id: shop.id,
        name: shop.name,
        shop_type: shop.shopType,
        phone: shop.phone,
        address: shop.address,
        city: shop.city,
        state: shop.state,
        country: shop.country,
        pincode: shop.pincode,
        latitude: shop.latitude,
        longitude: shop.longitude,
        logo_url: shop.logoUrl,
        currency_code: shop.currencyCode,
        timezone: shop.timezone,
        gst_enabled: shop.gstEnabled,
        gst_rate: shop.gstRate,
        gst_number: shop.gstNumber,
        round_off_enabled: shop.roundOffEnabled,
        daily_backup_enabled: shop.dailyBackupEnabled,
        printer_enabled: shop.printerEnabled,
        printer_name: shop.printerName,
        table_management_enabled: shop.tableManagementEnabled ?? false,
        table_count: shop.tableCount || 4,
      });
    } catch (err) {
      console.warn('Shop upsert Supabase notice:', err);
    }
    return shop;
  },

  /**
   * Register a brand new shop with real user inputs and persist all fields to Supabase
   */
  async registerShop(data: {
    name: string;
    shopType: ShopType;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    hasLogo?: boolean;
    logoUrl?: string;
    ownerUserId?: string;
  }): Promise<Shop> {
    const shopId = generateUUID();
    const newShop: Shop = {
      id: shopId,
      name: data.name,
      shopType: data.shopType,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: 'India',
      pincode: data.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
      logoUrl: data.logoUrl,
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      gstEnabled: false,
      gstRate: 5.0,
      roundOffEnabled: true,
      dailyBackupEnabled: true,
      printerEnabled: false,
      createdAt: new Date().toISOString(),
    };

    // 1. Save shop locally and in Supabase
    await storage.setObject(LOCAL_SHOP_KEY, newShop);
    try {
      await (supabase.from('shops') as any).insert({
        id: newShop.id,
        name: newShop.name,
        shop_type: newShop.shopType,
        phone: newShop.phone,
        address: newShop.address,
        city: newShop.city,
        state: newShop.state,
        country: newShop.country,
        pincode: newShop.pincode,
        latitude: newShop.latitude,
        longitude: newShop.longitude,
        logo_url: newShop.logoUrl,
        currency_code: newShop.currencyCode,
        timezone: newShop.timezone,
        gst_enabled: newShop.gstEnabled,
        gst_rate: newShop.gstRate,
        round_off_enabled: newShop.roundOffEnabled,
        daily_backup_enabled: newShop.dailyBackupEnabled,
        printer_enabled: newShop.printerEnabled,
        table_management_enabled: newShop.tableManagementEnabled ?? false,
        table_count: newShop.tableCount || 4,
        is_active: true,
      });
    } catch (err) {
      console.warn('Shop register Supabase write notice:', err);
    }

    // 2. Ensure owner profile exists
    let ownerUserId = data.ownerUserId;
    if (!ownerUserId) {
      const { data: existingProf } = await (supabase.from('profiles') as any)
        .select('id')
        .eq('phone', data.phone)
        .maybeSingle();

      if (existingProf) {
        ownerUserId = existingProf.id;
      } else {
        ownerUserId = generateUUID();
        try {
          await (supabase.from('profiles') as any).insert({
            id: ownerUserId,
            full_name: `${newShop.name} Owner`,
            phone: data.phone,
          });
        } catch {}
      }
    }

    // 3. Add registered owner as first shop member in Supabase
    const ownerMember: ShopMember = {
      id: generateUUID(),
      shopId: newShop.id,
      userId: ownerUserId || generateUUID(),
      fullName: `${newShop.name} Owner`,
      phone: data.phone,
      role: 'Owner',
      isActive: true,
    };
    await storage.setObject(LOCAL_USERS_KEY, [ownerMember]);

    try {
      await (supabase.from('shop_members') as any).insert({
        id: ownerMember.id,
        shop_id: ownerMember.shopId,
        user_id: ownerMember.userId,
        role: ownerMember.role,
        is_active: true,
      });
    } catch (err) {
      console.warn('Owner member Supabase write notice:', err);
    }

    // 4. Create Free subscription row in Supabase
    try {
      await (supabase.from('subscriptions') as any).insert({
        id: generateUUID(),
        shop_id: newShop.id,
        plan: 'free',
        status: 'active',
        amount: 0.00,
        interval: 'lifetime',
      });
    } catch (subErr) {
      console.warn('Subscription Supabase write notice:', subErr);
    }

    // 5. Bootstrap starter menu catalog for this real shop in Supabase
    try {
      await menuService.bootstrapShopCatalog(newShop.id, newShop.shopType);
    } catch (catErr) {
      console.warn('Starter catalog bootstrap notice:', catErr);
    }

    return newShop;
  },

  /**
   * Fetch real shop members for this shop
   */
  async getShopMembers(shopId: string): Promise<ShopMember[]> {
    if (!shopId) return [];
    
    // Check local cache
    const saved = await storage.getObject<ShopMember[] | null>(LOCAL_USERS_KEY, null);
    if (saved && saved.length > 0 && saved[0].shopId === shopId) {
      return saved;
    }

    // Fetch from Supabase
    try {
      const { data: dbMembers } = await (supabase.from('shop_members') as any)
        .select('*, profiles(full_name, phone)')
        .eq('shop_id', shopId);

      if (dbMembers && dbMembers.length > 0) {
        const loaded: ShopMember[] = dbMembers.map((m: any) => ({
          id: m.id,
          shopId: m.shop_id,
          userId: m.user_id,
          fullName: m.profiles?.full_name || (m.role === 'Owner' ? 'Owner' : 'Staff Member'),
          phone: m.profiles?.phone || '',
          role: m.role as UserRole,
          isActive: m.is_active ?? true,
          overrides: m.permissions_override || {},
        }));
        await storage.setObject(LOCAL_USERS_KEY, loaded);
        return loaded;
      }
    } catch (err) {
      console.warn('getShopMembers Supabase notice:', err);
    }

    return saved || [];
  },

  /**
   * Add a new member to the shop
   */
  async addShopMember(shopId: string, fullName: string, role: UserRole, phone?: string): Promise<ShopMember> {
    const members = await this.getShopMembers(shopId);
    let finalUserId = generateUUID();
    
    // Look up or insert profile for new member
    if (phone) {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const { data: existingProf } = await (supabase.from('profiles') as any)
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingProf?.id) {
          finalUserId = existingProf.id;
          await (supabase.from('profiles') as any)
            .update({ full_name: fullName })
            .eq('id', finalUserId);
        } else {
          await (supabase.from('profiles') as any).insert({
            id: finalUserId,
            full_name: fullName,
            phone: cleanPhone,
          });
        }
      } catch (profErr) {
        console.warn('Profile write notice for member:', profErr);
      }
    }

    const newMember: ShopMember = {
      id: generateUUID(),
      shopId,
      userId: finalUserId,
      fullName,
      phone: phone || '',
      role,
      isActive: true,
      overrides: {} as any,
    };
    const updated = [...members, newMember];
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      await (supabase.from('shop_members') as any).insert({
        id: newMember.id,
        shop_id: newMember.shopId,
        user_id: newMember.userId,
        role: newMember.role,
        is_active: true,
      });
    } catch (err) {
      console.warn('addShopMember Supabase notice:', err);
    }

    return newMember;
  },

  async updateMemberRole(shopId: string, memberId: string, newRole: UserRole): Promise<ShopMember[]> {
    const members = await this.getShopMembers(shopId);
    const updated = members.map(m => m.id === memberId ? { ...m, role: newRole, overrides: {} as any } : m);
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      await (supabase.from('shop_members') as any)
        .update({ role: newRole })
        .eq('id', memberId);
    } catch (err) {
      console.warn('updateMemberRole Supabase notice:', err);
    }

    return updated;
  },

  async setMemberOverride(shopId: string, memberId: string, permKey: PermissionKey, value: boolean): Promise<ShopMember[]> {
    const members = await this.getShopMembers(shopId);
    const updated = members.map(m => {
      if (m.id === memberId) {
        const overrides = { ...(m.overrides || {}), [permKey]: value };
        return { ...m, overrides };
      }
      return m;
    });
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      const targetMember = updated.find(m => m.id === memberId);
      if (targetMember) {
        await (supabase.from('shop_members') as any)
          .update({ permissions_override: targetMember.overrides })
          .eq('id', memberId);
      }
    } catch (err) {
      console.warn('setMemberOverride Supabase notice:', err);
    }

    return updated;
  },

  async removeMember(shopId: string, memberId: string): Promise<ShopMember[]> {
    const members = await this.getShopMembers(shopId);
    const updated = members.filter(m => m.id !== memberId);
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      await (supabase.from('shop_members') as any).delete().eq('id', memberId);
    } catch (err) {
      console.warn('removeMember Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Permanently delete the shop, its owner profile, and record the deletion survey in account_deletions table
   */
  async deleteShopPermanently(
    params:
      | {
          shopId: string;
          ownerUserId?: string;
          reason: string;
          feedback?: string;
          shopName?: string;
          ownerName?: string;
          phone?: string;
        }
      | string,
    legacyOwnerUserId?: string
  ): Promise<void> {
    const opts =
      typeof params === 'string'
        ? {
            shopId: params,
            ownerUserId: legacyOwnerUserId,
            reason: 'User requested deletion',
          }
        : {
            ...params,
            reason: params.reason || 'User requested deletion',
          };

    try {
      // 1. Record the deletion survey reason & details in public.account_deletions table in Supabase
      try {
        await (supabase.from('account_deletions') as any).insert({
          shop_id: opts.shopId,
          user_id: opts.ownerUserId || null,
          shop_name: opts.shopName || null,
          owner_name: opts.ownerName || null,
          phone: opts.phone || null,
          reason: opts.reason,
          feedback: opts.feedback || null,
          deleted_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('account_deletions logging notice:', logErr);
      }

      // 2. Delete shop from Supabase (foreign keys will CASCADE delete bills, menu items, expenses, customers, vendors, pending payments, shop members)
      await (supabase.from('shops') as any).delete().eq('id', opts.shopId);

      // 3. Delete owner profile if user ID is known
      if (opts.ownerUserId) {
        await (supabase.from('profiles') as any).delete().eq('id', opts.ownerUserId);
      }
    } catch (err) {
      console.warn('deleteShopPermanently Supabase notice:', err);
    }

    // 4. Clear all cached storage data
    await storage.clear();
  }
};
