import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { UserProfile, ShopMember, Shop, ShopType, UserRole, PermissionKey } from '../types/models';
import { twoFactorService, SendOtpResult, DEMO_REVIEW_PHONE } from './twoFactorService';
import { generateUUID } from '../lib/uuid';

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  Owner: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, menu_delete: true, users: true, subscription: true },
  Supervisor: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, menu_delete: true, users: false, subscription: false },
  Biller: { bill: true, total: true, exp: false, pend: false, report: false, menu: false, menu_delete: false, users: false, subscription: false },
};

const LOCAL_PROFILE_KEY = '@counterpro/user_profile';
const LOCAL_MEMBER_KEY = '@counterpro/shop_member';
const LOCAL_SHOP_KEY = '@counterpro/active_shop';

export interface VerifyAuthResult {
  success: boolean;
  profile?: UserProfile;
  isExistingShop?: boolean;
  shop?: Shop;
  member?: ShopMember;
  error?: string;
}

export const authService = {
  /**
   * Send 6-digit OTP using 2Factor.in SMS Gateway with Template
   */
  async sendOtp(phone: string): Promise<SendOtpResult> {
    return await twoFactorService.sendOtp(phone);
  },

  /**
   * Verify 6-digit OTP and check if user/shop is already registered in Supabase
   */
  async verifyOtp(phone: string, token: string): Promise<VerifyAuthResult> {
    const cleanPhone = twoFactorService.sanitizePhone(phone);
    const verifyResult = await twoFactorService.verifyOtp(cleanPhone, token);

    if (!verifyResult.success) {
      return {
        success: false,
        error: verifyResult.error || 'Invalid OTP code entered.',
      };
    }

    try {
      // 1. Check if user profile exists in Supabase
      const { data: existingProfile } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      let profile: UserProfile;

      if (existingProfile) {
        profile = {
          id: existingProfile.id,
          fullName: existingProfile.full_name,
          phone: existingProfile.phone,
          avatarUrl: existingProfile.avatar_url,
        };
      } else {
        // Create standard profile for new shop owner
        const newProfileId = generateUUID();
        const defaultName = cleanPhone === DEMO_REVIEW_PHONE ? 'Demo Reviewer' : 'Shop Owner';
        profile = {
          id: newProfileId,
          fullName: defaultName,
          phone: cleanPhone,
        };

        try {
          const { data: inserted, error: insertErr } = await (supabase.from('profiles') as any).insert({
            id: profile.id,
            full_name: profile.fullName,
            phone: profile.phone,
          }).select().single();

          if (inserted) {
            profile.id = inserted.id;
          } else if (insertErr) {
            console.warn('Profile Supabase insert notice:', insertErr.message);
          }
        } catch (dbErr) {
          console.warn('Profile Supabase sync notice:', dbErr);
        }
      }

      await storage.setObject(LOCAL_PROFILE_KEY, profile);

      // 2. Check if this phone belongs to a registered shop owner or shop member (Supervisor / Biller)
      try {
        let shopData: any = null;
        let memberRole: UserRole = 'Owner';
        let memberId = generateUUID();
        let memberOverrides: any = undefined;

        // Staff membership wins: someone who works in another shop opens that shop, even if their own phone matches a shop.
        try {
          const { data: staffList } = await (supabase.from('shop_members') as any)
            .select('*, shops(*)')
            .eq('user_id', profile.id)
            .eq('is_active', true)
            .neq('role', 'Owner')
            .order('created_at', { ascending: false })
            .limit(1);

          if (staffList && staffList.length > 0 && staffList[0].shops && !staffList[0].shops.name?.startsWith('[Deleted]')) {
            shopData = staffList[0].shops;
            memberRole = (staffList[0].role as UserRole) || 'Biller';
            memberId = staffList[0].id;
            memberOverrides = staffList[0].permissions_override;
          }
        } catch (sErr) {
          console.warn('Supabase staff membership check notice:', sErr);
        }

        if (!shopData) {
          const { data: shopList } = await (supabase.from('shops') as any)
            .select('*')
            .eq('phone', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1);
          shopData = (shopList && shopList.length > 0 && !shopList[0].phone?.includes('_del_') && !shopList[0].name?.startsWith('[Deleted]')) ? shopList[0] : null;
        }

        if (!shopData) {
          // Check if this phone belongs to a member by direct phone match OR user_id
          try {
            // First check by direct phone column on shop_members
            const { data: memberByPhone } = await (supabase.from('shop_members') as any)
              .select('*, shops(*)')
              .eq('phone', cleanPhone)
              .order('created_at', { ascending: false })
              .limit(1);

            let activeMemberRow = memberByPhone && memberByPhone.length > 0 ? memberByPhone[0] : null;

            // If not found by phone, check by user_id
            if (!activeMemberRow) {
              const { data: memberByUserId } = await (supabase.from('shop_members') as any)
                .select('*, shops(*)')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(1);

              if (memberByUserId && memberByUserId.length > 0) {
                activeMemberRow = memberByUserId[0];
              }
            }

            if (activeMemberRow) {
              // CRITICAL: Block deactivated staff from logging in
              if (activeMemberRow.is_active === false) {
                return {
                  success: false,
                  error: 'Your staff account has been deactivated. Please contact the shop owner.',
                };
              }

              if (activeMemberRow.shops) {
                shopData = activeMemberRow.shops;
                memberRole = (activeMemberRow.role as UserRole) || 'Biller';
                memberId = activeMemberRow.id;
                
                let parsedOverrides = activeMemberRow.permissions_override;
                if (typeof parsedOverrides === 'string') {
                  try {
                    parsedOverrides = JSON.parse(parsedOverrides);
                  } catch {}
                }
                memberOverrides = (typeof parsedOverrides === 'object' && parsedOverrides !== null) ? parsedOverrides : {};

                // Sync authenticated profile id and clean phone on shop_members
                try {
                  await (supabase.from('shop_members') as any)
                    .update({ user_id: profile.id, phone: cleanPhone })
                    .eq('id', activeMemberRow.id);
                } catch {}
              }
            }
          } catch (mErr) {
            console.warn('Supabase member check notice:', mErr);
          }
        }

        // Also check local storage members cache to match phone
        if (!shopData) {
          const cachedUsers = await storage.getObject<ShopMember[]>('@counterpro/shop_users', []);
          const cachedMembers = await storage.getObject<ShopMember[]>('@counterpro/shop_members', []);
          const allLocalMembers = [...(cachedUsers || []), ...(cachedMembers || [])];
          const matchedMember = allLocalMembers.find(m => {
            const cleanMPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
            return cleanMPhone === cleanPhone.slice(-10);
          });
          if (matchedMember) {
            if (matchedMember.isActive === false) {
              return {
                success: false,
                error: 'Your staff account has been deactivated. Please contact the shop owner.',
              };
            }
            memberRole = matchedMember.role;
            memberId = matchedMember.id;
            memberOverrides = matchedMember.overrides || {};
            const localShop = await storage.getObject<Shop | null>('@counterpro/active_shop', null);
            if (localShop) {
              shopData = localShop as any;
            }
          }
        }

        if (!shopData && cleanPhone === DEMO_REVIEW_PHONE) {
          shopData = {
            id: '99999999-9999-4999-8999-888888888888',
            name: 'Counter365 Demo Cafe',
            shop_type: 'Tea Shop',
            phone: DEMO_REVIEW_PHONE,
            address: '100 App Review Avenue',
            city: 'Chennai',
            state: 'Tamil Nadu',
            country: 'India',
            pincode: '600001',
            gst_enabled: false,
            round_off_enabled: true,
            daily_backup_enabled: true,
            currency_code: 'INR',
            timezone: 'Asia/Kolkata',
          };
        }

        if (shopData) {
          const loadedShop: Shop = {
            id: shopData.id,
            name: shopData.name,
            shopType: (shopData.shop_type || shopData.shopType) as ShopType || 'Tea Shop',
            phone: shopData.phone,
            email: shopData.email,
            address: shopData.address || '',
            city: shopData.city || '',
            state: shopData.state || '',
            country: shopData.country || 'India',
            pincode: shopData.pincode || '',
            latitude: shopData.latitude ? Number(shopData.latitude) : undefined,
            longitude: shopData.longitude ? Number(shopData.longitude) : undefined,
            logoUrl: shopData.logo_url || shopData.logoUrl,
            currencyCode: shopData.currency_code || shopData.currencyCode || 'INR',
            timezone: shopData.timezone || 'Asia/Kolkata',
            gstEnabled: shopData.gst_enabled ?? shopData.gstEnabled ?? false,
            gstRate: shopData.gst_rate !== undefined ? Number(shopData.gst_rate) : (shopData.gstRate ?? 5.0),
            gstNumber: shopData.gst_number || shopData.gstNumber,
            roundOffEnabled: shopData.round_off_enabled ?? shopData.roundOffEnabled ?? true,
            dailyBackupEnabled: shopData.daily_backup_enabled ?? shopData.dailyBackupEnabled ?? true,
            printerEnabled: shopData.printer_enabled ?? shopData.printerEnabled ?? false,
            printerName: shopData.printer_name || shopData.printerName,
            tableManagementEnabled: shopData.table_management_enabled ?? shopData.tableManagementEnabled ?? false,
            tableCount: shopData.table_count !== undefined ? Number(shopData.table_count) : (shopData.tableCount ?? 6),
          };

          const loadedMember: ShopMember = {
            id: memberId,
            shopId: loadedShop.id,
            userId: profile.id,
            fullName: profile.fullName,
            phone: profile.phone,
            role: memberRole,
            isActive: true,
            overrides: memberOverrides,
          };

          await storage.setObject(LOCAL_SHOP_KEY, loadedShop);
          await storage.setObject(LOCAL_MEMBER_KEY, loadedMember);

          return {
            success: true,
            profile,
            isExistingShop: true,
            shop: loadedShop,
            member: loadedMember,
          };
        }
      } catch (shopCheckErr) {
        console.warn('Existing shop check notice:', shopCheckErr);
      }

      return { success: true, profile, isExistingShop: false };
    } catch (err: any) {
      const profile: UserProfile = {
        id: generateUUID(),
        fullName: cleanPhone === DEMO_REVIEW_PHONE ? 'Demo Reviewer' : 'Shop Owner',
        phone: cleanPhone,
      };
      await storage.setObject(LOCAL_PROFILE_KEY, profile);

      if (cleanPhone === DEMO_REVIEW_PHONE) {
        const demoShop: Shop = {
          id: '99999999-9999-4999-8999-888888888888',
          name: 'Counter365 Demo Cafe',
          shopType: 'Tea Shop',
          phone: DEMO_REVIEW_PHONE,
          address: '100 App Review Avenue',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pincode: '600001',
          currencyCode: 'INR',
          timezone: 'Asia/Kolkata',
          gstEnabled: false,
          gstRate: 5.0,
          roundOffEnabled: true,
          dailyBackupEnabled: true,
          printerEnabled: false,
          tableManagementEnabled: false,
          tableCount: 6,
        };
        const demoMember: ShopMember = {
          id: `m_${profile.id}`,
          shopId: demoShop.id,
          userId: profile.id,
          fullName: 'Demo Reviewer',
          phone: DEMO_REVIEW_PHONE,
          role: 'Owner',
          isActive: true,
        };
        await storage.setObject(LOCAL_SHOP_KEY, demoShop);
        await storage.setObject(LOCAL_MEMBER_KEY, demoMember);
        return { success: true, profile, isExistingShop: true, shop: demoShop, member: demoMember };
      }

      return { success: true, profile, isExistingShop: false };
    }
  },

  async getCurrentProfile(): Promise<UserProfile | null> {
    return await storage.getObject<UserProfile | null>(LOCAL_PROFILE_KEY, null);
  },

  async saveCurrentProfile(profile: UserProfile): Promise<void> {
    await storage.setObject(LOCAL_PROFILE_KEY, profile);
  },

  async saveCurrentMember(member: ShopMember): Promise<void> {
    await storage.setObject(LOCAL_MEMBER_KEY, member);
  },

  async getCurrentMember(): Promise<ShopMember | null> {
    return await storage.getObject<ShopMember | null>(LOCAL_MEMBER_KEY, null);
  },

  async isUserActiveInShop(shopId: string, memberIdOrUserId?: string | null): Promise<boolean> {
    if (!shopId || !memberIdOrUserId) return true;
    try {
      const { data: member } = await (supabase.from('shop_members') as any)
        .select('is_active, role')
        .eq('shop_id', shopId)
        .or(`id.eq.${memberIdOrUserId},user_id.eq.${memberIdOrUserId}`)
        .maybeSingle();

      if (member && member.is_active === false) {
        // Immediate session invalidation on client
        await storage.removeItem(LOCAL_MEMBER_KEY);
        return false;
      }
    } catch {}
    return true;
  },

  async canUserPerform(shopId: string, memberIdOrUserId?: string | null, perm?: PermissionKey): Promise<boolean> {
    if (!shopId || !perm) return true;
    if (!memberIdOrUserId) {
      const activeMember = await storage.getObject<ShopMember | null>(LOCAL_MEMBER_KEY, null);
      if (!activeMember || activeMember.role === 'Owner') return true;
      if (activeMember.isActive === false) return false;
      if (activeMember.overrides && activeMember.overrides[perm] !== undefined) {
        return Boolean(activeMember.overrides[perm]);
      }
      return Boolean(ROLE_DEFAULT_PERMISSIONS[activeMember.role]?.[perm]);
    }

    try {
      const { data: member } = await (supabase.from('shop_members') as any)
        .select('is_active, role, permissions_override')
        .eq('shop_id', shopId)
        .or(`id.eq.${memberIdOrUserId},user_id.eq.${memberIdOrUserId}`)
        .maybeSingle();

      if (member) {
        if (member.is_active === false) {
          await storage.removeItem(LOCAL_MEMBER_KEY);
          return false;
        }
        if (member.role === 'Owner') return true;

        let parsedOverrides = member.permissions_override;
        if (typeof parsedOverrides === 'string') {
          try {
            parsedOverrides = JSON.parse(parsedOverrides);
          } catch {}
        }
        if (parsedOverrides && typeof parsedOverrides === 'object' && parsedOverrides[perm] !== undefined) {
          return Boolean(parsedOverrides[perm]);
        }
        const defaultPerm = ROLE_DEFAULT_PERMISSIONS[member.role as UserRole]?.[perm];
        return defaultPerm !== undefined ? Boolean(defaultPerm) : false;
      }
    } catch (e) {
      console.warn('canUserPerform DB check error:', e);
    }

    // Fallback to local member check
    const activeMember = await storage.getObject<ShopMember | null>(LOCAL_MEMBER_KEY, null);
    if (!activeMember || activeMember.role === 'Owner') return true;
    if (activeMember.isActive === false) return false;
    if (activeMember.overrides && activeMember.overrides[perm] !== undefined) {
      return Boolean(activeMember.overrides[perm]);
    }
    return Boolean(ROLE_DEFAULT_PERMISSIONS[activeMember.role]?.[perm]);
  },

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {}
    await storage.removeItem(LOCAL_PROFILE_KEY);
    await storage.removeItem(LOCAL_MEMBER_KEY);
    await storage.removeItem(LOCAL_SHOP_KEY);
  }
};
