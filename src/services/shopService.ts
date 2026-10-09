import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { Shop, ShopType, ShopMember, UserRole, PermissionKey, UserProfile } from '../types/models';
import { menuService } from './menuService';
import { generateUUID, isValidUUID } from '../lib/uuid';
import { generateDefaultInvoicePrefix } from '../lib/invoiceUtils';

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
   * Get the active shop from local cache or Supabase (scoped strictly to current user)
   */
  async getActiveShop(): Promise<Shop> {
    const saved = await storage.getObject<Shop | null>(LOCAL_SHOP_KEY, null);
    if (saved && saved.id) return saved;

    // Only query remote shop if an authenticated user profile exists on this device
    try {
      const profile = await storage.getObject<UserProfile | null>('@counterpro/auth_profile', null);
      if (profile?.phone) {
        const cleanPhone = profile.phone.replace(/\D/g, '');
        if (cleanPhone) {
          // 1. Check if user is shop owner
          const { data: shops } = await (supabase.from('shops') as any)
            .select('*')
            .eq('phone', cleanPhone)
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
              ownerName: s.owner_name || undefined,
              invoicePrefix: s.invoice_prefix || generateDefaultInvoicePrefix(s.name),
              invoiceResetCycle: (s.invoice_reset_cycle as any) || 'monthly',
              totalBillsCreated: s.total_bills_created !== undefined && s.total_bills_created !== null ? Number(s.total_bills_created) : undefined,
              upiId: s.upi_id || undefined,
              createdAt: s.created_at,
            };
            await storage.setObject(LOCAL_SHOP_KEY, loadedShop);
            return loadedShop;
          }

          // 2. Check if user is staff member of a shop
          const { data: members } = await (supabase.from('shop_members') as any)
            .select('*, shops(*)')
            .eq('phone', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1);

          if (members && members.length > 0 && members[0].shops) {
            const s = members[0].shops;
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
              ownerName: s.owner_name || undefined,
              invoicePrefix: s.invoice_prefix || generateDefaultInvoicePrefix(s.name),
              invoiceResetCycle: (s.invoice_reset_cycle as any) || 'monthly',
              totalBillsCreated: s.total_bills_created !== undefined && s.total_bills_created !== null ? Number(s.total_bills_created) : undefined,
              upiId: s.upi_id || undefined,
              createdAt: s.created_at,
            };
            await storage.setObject(LOCAL_SHOP_KEY, loadedShop);
            return loadedShop;
          }
        }
      }
    } catch (err) {
      console.warn('getActiveShop profile query notice:', err);
    }

    // New/unregistered user has no active shop yet
    return INITIAL_EMPTY_SHOP;
  },

  /**
   * Save / update shop details in Supabase and local cache with resilient schema fallback
   */
  async saveShop(shop: Shop): Promise<Shop> {
    await storage.setObject(LOCAL_SHOP_KEY, shop);
    if (!shop.id || !isValidUUID(shop.id)) return shop;

    try {
      // 1. Attempt full upsert with all extended fields
      const fullPayload: any = {
        id: shop.id,
        name: shop.name || 'CounterPro Shop',
        shop_type: shop.shopType || 'Tea Shop',
        phone: shop.phone || '9999999999',
        address: shop.address || 'Address',
        city: shop.city || 'City',
        state: shop.state || 'Tamil Nadu',
        country: shop.country || 'India',
        pincode: shop.pincode || '600001',
        latitude: shop.latitude,
        longitude: shop.longitude,
        logo_url: shop.logoUrl,
        currency_code: shop.currencyCode || 'INR',
        timezone: shop.timezone || 'Asia/Kolkata',
        gst_enabled: shop.gstEnabled ?? false,
        gst_rate: shop.gstRate ?? 5.0,
        gst_number: shop.gstNumber,
        round_off_enabled: shop.roundOffEnabled ?? true,
        daily_backup_enabled: shop.dailyBackupEnabled ?? true,
        printer_enabled: shop.printerEnabled ?? false,
        printer_name: shop.printerName,
        table_management_enabled: shop.tableManagementEnabled ?? false,
        table_count: shop.tableCount || 4,
        owner_name: shop.ownerName || null,
        invoice_prefix: shop.invoicePrefix || generateDefaultInvoicePrefix(shop.name),
        invoice_reset_cycle: shop.invoiceResetCycle || 'monthly',
        upi_id: shop.upiId || null,
        is_active: true,
      };

      const { error: fullErr } = await (supabase.from('shops') as any).upsert(fullPayload);
      if (fullErr) {
        // Fallback: If newer columns fail schema cache validation, upsert guaranteed base columns
        console.warn('Full shop upsert error, attempting baseline columns fallback:', fullErr.message);
        const basePayload = {
          id: shop.id,
          name: shop.name || 'CounterPro Shop',
          shop_type: shop.shopType || 'Tea Shop',
          phone: shop.phone || '9999999999',
          address: shop.address || 'Address',
          city: shop.city || 'City',
          state: shop.state || 'Tamil Nadu',
          country: shop.country || 'India',
          pincode: shop.pincode || '600001',
          gst_enabled: shop.gstEnabled ?? false,
          round_off_enabled: shop.roundOffEnabled ?? true,
          daily_backup_enabled: shop.dailyBackupEnabled ?? true,
          printer_enabled: shop.printerEnabled ?? false,
          is_active: true,
        };
        const { error: baseErr } = await (supabase.from('shops') as any).upsert(basePayload);
        if (baseErr) {
          console.warn('Base shop upsert notice:', baseErr.message);
        }
      }
    } catch (err) {
      console.warn('Shop upsert Supabase notice:', err);
    }
    return shop;
  },

  /**
   * Verify and ensure the parent shop record exists in Supabase.
   * If missing (e.g. registered offline or created before network connected),
   * immediately provisions the shop so child foreign keys (bills_shop_id_fkey) never fail.
   */
  async ensureShopExists(shopId: string): Promise<boolean> {
    if (!shopId || !isValidUUID(shopId)) return false;

    try {
      // 1. Check if shop exists in Supabase
      const { data: existing, error: checkErr } = await (supabase.from('shops') as any)
        .select('id')
        .eq('id', shopId)
        .maybeSingle();

      if (existing && existing.id) {
        return true;
      }

      // 2. Not in Supabase! Look up local cached shop
      const activeShop = await storage.getObject<Shop | null>(LOCAL_SHOP_KEY, null);
      if (activeShop && activeShop.id === shopId) {
        await this.saveShop(activeShop);
        return true;
      }

      // 3. Fallback: provision base placeholder row so bills_shop_id_fkey is satisfied
      const { error: stubErr } = await (supabase.from('shops') as any).upsert({
        id: shopId,
        name: activeShop?.name || 'CounterPro Shop',
        shop_type: activeShop?.shopType || 'Tea Shop',
        phone: activeShop?.phone || '9999999999',
        address: activeShop?.address || 'Shop Address',
        city: activeShop?.city || 'City',
        state: activeShop?.state || 'Tamil Nadu',
        country: 'India',
        pincode: activeShop?.pincode || '600001',
        is_active: true,
      });

      if (stubErr) {
        console.warn('ensureShopExists stub insert notice:', stubErr.message);
      }
      return true;
    } catch (err) {
      console.warn('ensureShopExists notice:', err);
      return false;
    }
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
    ownerName?: string;
    invoicePrefix?: string;
    invoiceResetCycle?: 'monthly' | 'yearly';
  }): Promise<Shop> {
    const shopId = generateUUID();
    const prefix = data.invoicePrefix?.trim() || generateDefaultInvoicePrefix(data.name);
    const resetCycle = data.invoiceResetCycle || 'monthly';
    const ownerNameClean = data.ownerName?.trim();

    const newShop: Shop = {
      id: shopId,
      name: data.name,
      ownerName: ownerNameClean || undefined,
      invoicePrefix: prefix,
      invoiceResetCycle: resetCycle,
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
      const fullInsertPayload: any = {
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
        owner_name: newShop.ownerName || null,
        invoice_prefix: newShop.invoicePrefix,
        invoice_reset_cycle: newShop.invoiceResetCycle,
        upi_id: newShop.upiId || null,
        is_active: true,
      };

      const { error: regErr } = await (supabase.from('shops') as any).insert(fullInsertPayload);
      if (regErr) {
        console.warn('Full shop insert failed, falling back to base schema:', regErr.message);
        const baseInsertPayload = {
          id: newShop.id,
          name: newShop.name || 'CounterPro Shop',
          shop_type: newShop.shopType || 'Tea Shop',
          phone: newShop.phone || '9999999999',
          address: newShop.address || 'Address',
          city: newShop.city || 'City',
          state: newShop.state || 'Tamil Nadu',
          country: newShop.country || 'India',
          pincode: newShop.pincode || '600001',
          gst_enabled: newShop.gstEnabled ?? false,
          round_off_enabled: newShop.roundOffEnabled ?? true,
          daily_backup_enabled: newShop.dailyBackupEnabled ?? true,
          printer_enabled: newShop.printerEnabled ?? false,
          is_active: true,
        };
        const { error: baseErr } = await (supabase.from('shops') as any).insert(baseInsertPayload);
        if (baseErr) {
          console.warn('Base shop insert notice:', baseErr.message);
        }
      }
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
        if (ownerNameClean) {
          try {
            await (supabase.from('profiles') as any).update({
              full_name: ownerNameClean,
            }).eq('id', ownerUserId);
          } catch {}
        }
      } else {
        ownerUserId = generateUUID();
        try {
          await (supabase.from('profiles') as any).insert({
            id: ownerUserId,
            full_name: ownerNameClean || `${newShop.name} Owner`,
            phone: data.phone,
          });
        } catch {}
      }
    } else if (ownerNameClean) {
      try {
        await (supabase.from('profiles') as any).update({
          full_name: ownerNameClean,
        }).eq('id', ownerUserId);
      } catch {}
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
    const ownerProfile: UserProfile = {
      id: ownerMember.userId,
      fullName: ownerNameClean || `${newShop.name} Owner`,
      phone: data.phone,
    };
    await storage.setObject('@counterpro/user_profile', ownerProfile);
    await storage.setObject('@counterpro/shop_member', ownerMember);
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
          phone: m.phone || m.profiles?.phone || '',
          role: m.role as UserRole,
          isActive: m.is_active ?? true,
          overrides: m.permissions_override || {},
          deactivatedAt: m.deactivated_at || null,
          deactivatedBy: m.deactivated_by || null,
          deactivationReason: m.deactivation_reason || null,
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
   * Add a new member to the shop with staff allocation limit check & phone deduplication
   */
  async addShopMember(
    shopId: string,
    fullName: string,
    role: UserRole,
    phone?: string,
    creator?: { id?: string; name?: string }
  ): Promise<ShopMember> {
    const members = await this.getShopMembers(shopId);

    // 1. Staff capacity enforcement (including inactive members per allocation policy)
    const activeShop = await this.getActiveShop();
    const maxLimit = activeShop?.maxStaffLimit || 5;
    if (members.length >= maxLimit) {
      throw new Error('Your staff allocation limit has been reached. Please contact Support for assistance.');
    }

    // 2. Phone number deduplication & inactive staff protection
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        const existingMember = members.find(m => m.phone && m.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone);
        if (existingMember) {
          if (existingMember.isActive) {
            throw new Error('A staff member with this phone number already exists.');
          } else {
            throw new Error('This phone number belongs to a previously deactivated staff member. Please contact Support for assistance.');
          }
        }
      }
    }

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
        phone: newMember.phone || null,
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

  async removeMember(shopId: string, memberId: string, deactivatedBy?: { id?: string; name?: string }): Promise<ShopMember[]> {
    const members = await this.getShopMembers(shopId);
    const nowIso = new Date().toISOString();
    const updated = members.map(m => {
      if (m.id === memberId) {
        return {
          ...m,
          isActive: false,
          deactivatedAt: nowIso,
          deactivatedBy: deactivatedBy?.id || 'owner',
          deactivationReason: 'Staff member deactivated by owner',
        };
      }
      return m;
    });
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      await (supabase.from('shop_members') as any)
        .update({
          is_active: false,
          deactivated_at: nowIso,
          deactivated_by: deactivatedBy?.id || null,
          deactivation_reason: 'Staff member deactivated by owner',
        })
        .eq('id', memberId);

      const targetMember = members.find(m => m.id === memberId);
      await (supabase.from('audit_logs') as any).insert({
        shop_id: shopId,
        actor_id: deactivatedBy?.id || null,
        actor_name: deactivatedBy?.name || 'Owner',
        action: 'staff.deactivated',
        entity_type: 'shop_member',
        entity_id: memberId,
        details: {
          memberName: targetMember?.fullName,
          phone: targetMember?.phone,
          role: targetMember?.role,
          deactivatedAt: nowIso,
        },
      });
    } catch (err) {
      console.warn('removeMember Supabase notice:', err);
    }

    return updated;
  },

  async setMemberActive(shopId: string, memberId: string, isActive: boolean): Promise<ShopMember[]> {
    const members = await this.getShopMembers(shopId);
    const updated = members.map(m => (m.id === memberId ? { ...m, isActive } : m));
    await storage.setObject(LOCAL_USERS_KEY, updated);

    try {
      await (supabase.from('shop_members') as any)
        .update({ is_active: isActive })
        .eq('id', memberId);
    } catch (err) {
      console.warn('setMemberActive Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Admin-assisted reactivation of a previously deactivated staff member
   */
  async adminReactivateStaffMember(params: {
    shopId: string;
    memberId: string;
    adminId?: string;
    notes?: string;
  }): Promise<ShopMember | null> {
    const { shopId, memberId, adminId, notes } = params;

    // 1. Try server RPC
    try {
      const { data, error } = await (supabase.rpc as any)('admin_reactivate_staff_member', {
        p_shop_id: shopId,
        p_member_id: memberId,
        p_admin_id: adminId || null,
        p_notes: notes || 'Reactivated by authorized platform admin',
      });
      if (!error && data?.success) {
        await this.setMemberActive(shopId, memberId, true);
        const members = await this.getShopMembers(shopId);
        return members.find(m => m.id === memberId) || null;
      }
    } catch (_) {}

    // 2. Direct fallback
    await this.setMemberActive(shopId, memberId, true);
    const members = await this.getShopMembers(shopId);
    return members.find(m => m.id === memberId) || null;
  },

  /**
   * Admin-assisted increase of shop staff allocation limit
   */
  async adminUpdateStaffLimit(params: {
    shopId: string;
    newLimit: number;
    adminId?: string;
    notes?: string;
  }): Promise<number> {
    const { shopId, newLimit, adminId, notes } = params;

    // 1. Try server RPC
    try {
      const { data, error } = await (supabase.rpc as any)('admin_update_shop_staff_limit', {
        p_shop_id: shopId,
        p_new_limit: newLimit,
        p_admin_id: adminId || null,
        p_notes: notes || 'Staff limit updated by platform admin',
      });
      if (!error && data?.success) {
        const activeShop = await this.getActiveShop();
        if (activeShop && activeShop.id === shopId) {
          await this.saveShop({ ...activeShop, maxStaffLimit: newLimit });
        }
        return newLimit;
      }
    } catch (_) {}

    // 2. Direct fallback
    try {
      await (supabase.from('shops') as any)
        .update({ max_staff_limit: newLimit })
        .eq('id', shopId);
    } catch (_) {}
    const activeShop = await this.getActiveShop();
    if (activeShop && activeShop.id === shopId) {
      await this.saveShop({ ...activeShop, maxStaffLimit: newLimit });
    }
    return newLimit;
  },

  /**
   * Permanently delete the shop, its owner profile, and record the deletion survey in account_deletions table.
   * Protects demo stores (9999999999, demo UUID, or Demo in shop name) from deletion.
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

    // HARD DEMO DATA PROTECTION
    const cleanPhone = opts.phone?.replace(/[^0-9]/g, '') || '';
    const isDemoShopId = opts.shopId === '99999999-9999-4999-8999-888888888888' || opts.shopId?.startsWith('99999999-');
    const isDemoPhone = cleanPhone === '9999999999' || cleanPhone.slice(-10) === '9999999999';
    const isDemoName = Boolean(opts.shopName && /demo|sample/i.test(opts.shopName));

    if (isDemoShopId || isDemoPhone || isDemoName) {
      throw new Error('Demo accounts are protected and cannot be deleted.');
    }

    try {
      // 1. Try atomic RPC if available
      let rpcSucceeded = false;
      if (isValidUUID(opts.shopId)) {
        try {
          const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
            'permanently_delete_owner_account',
            {
              p_shop_id: opts.shopId,
              p_user_id: opts.ownerUserId && isValidUUID(opts.ownerUserId) ? opts.ownerUserId : null,
              p_reason: opts.reason,
              p_feedback: opts.feedback || null,
            }
          );
          if (!rpcErr && rpcData?.success) {
            rpcSucceeded = true;
          }
        } catch (rpcCallErr) {
          // Fall back to direct table deletes
        }
      }

      if (!rpcSucceeded) {
        // 2. Record the deletion survey reason & details in public.account_deletions table
        try {
          await (supabase.from('account_deletions') as any).insert({
            shop_id: isValidUUID(opts.shopId) ? opts.shopId : null,
            user_id: opts.ownerUserId && isValidUUID(opts.ownerUserId) ? opts.ownerUserId : null,
            shop_name: opts.shopName || null,
            owner_name: opts.ownerName || null,
            phone: cleanPhone || null,
            reason: opts.reason,
            feedback: opts.feedback || null,
            deleted_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.warn('account_deletions logging notice:', logErr);
        }

        // 3. Delete dependent rows explicitly
        try {
          await (supabase.from('shop_members') as any).delete().eq('shop_id', opts.shopId);
          await (supabase.from('bills') as any).delete().eq('shop_id', opts.shopId);
          await (supabase.from('menu_items') as any).delete().eq('shop_id', opts.shopId);
          await (supabase.from('expenses') as any).delete().eq('shop_id', opts.shopId);
          await (supabase.from('customers') as any).delete().eq('shop_id', opts.shopId);
          await (supabase.from('vendors') as any).delete().eq('shop_id', opts.shopId);
        } catch (depErr) {
          console.warn('Child records cleanup notice:', depErr);
        }

        // 4. Delete shop from Supabase
        await (supabase.from('shops') as any).delete().eq('id', opts.shopId);

        // 5. Delete owner profile so owner can re-register freshly with the same phone
        if (opts.ownerUserId && isValidUUID(opts.ownerUserId)) {
          await (supabase.from('profiles') as any).delete().eq('id', opts.ownerUserId);
        }
      }
    } catch (err: any) {
      console.warn('deleteShopPermanently Supabase notice:', err);
      if (err?.message?.includes('Demo accounts are protected')) {
        throw err;
      }
    }

    // 6. Clear all cached local storage data
    await storage.clear();
  }
};
