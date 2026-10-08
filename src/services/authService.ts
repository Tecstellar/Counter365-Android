import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { UserProfile, ShopMember, Shop, ShopType, UserRole } from '../types/models';
import { twoFactorService, SendOtpResult, DEMO_REVIEW_PHONE } from './twoFactorService';
import { generateUUID } from '../lib/uuid';

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
        const { data: shopList } = await (supabase.from('shops') as any)
          .select('*')
          .eq('phone', cleanPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        let shopData = shopList && shopList.length > 0 ? shopList[0] : null;
        let memberRole: UserRole = 'Owner';
        let memberId = generateUUID();
        let memberOverrides: any = undefined;

        if (!shopData) {
          // Check if this phone/user is a member (Supervisor or Biller) of any shop in Supabase
          try {
            const { data: memberList } = await (supabase.from('shop_members') as any)
              .select('*, shops(*)')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (memberList && memberList.length > 0 && memberList[0].shops) {
              shopData = memberList[0].shops;
              memberRole = (memberList[0].role as UserRole) || 'Biller';
              memberId = memberList[0].id;
              memberOverrides = memberList[0].permissions_override;
            }
          } catch (mErr) {
            console.warn('Supabase member check notice:', mErr);
          }
        }

        // Also check local storage members cache to match phone
        const localMembers = await storage.getObject<ShopMember[]>('@counterpro/shop_members', []);
        const matchedMember = localMembers?.find(m => m.phone?.replace(/\D/g, '') === cleanPhone);
        if (matchedMember) {
          memberRole = matchedMember.role;
          memberId = matchedMember.id;
          memberOverrides = matchedMember.overrides;
          if (!shopData) {
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
            shopType: (shopData.shop_type as ShopType) || 'Tea Shop',
            phone: shopData.phone,
            email: shopData.email,
            address: shopData.address || '',
            city: shopData.city || '',
            state: shopData.state || '',
            country: shopData.country || 'India',
            pincode: shopData.pincode || '',
            latitude: shopData.latitude ? Number(shopData.latitude) : undefined,
            longitude: shopData.longitude ? Number(shopData.longitude) : undefined,
            logoUrl: shopData.logo_url,
            currencyCode: shopData.currency_code || 'INR',
            timezone: shopData.timezone || 'Asia/Kolkata',
            gstEnabled: shopData.gst_enabled ?? false,
            gstRate: shopData.gst_rate ? Number(shopData.gst_rate) : 5.0,
            gstNumber: shopData.gst_number,
            roundOffEnabled: shopData.round_off_enabled ?? true,
            dailyBackupEnabled: shopData.daily_backup_enabled ?? true,
            printerEnabled: shopData.printer_enabled ?? false,
            printerName: shopData.printer_name,
            tableManagementEnabled: shopData.table_management_enabled ?? false,
            tableCount: shopData.table_count ? Number(shopData.table_count) : 4,
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
          tableCount: 4,
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

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {}
    await storage.removeItem(LOCAL_PROFILE_KEY);
    await storage.removeItem(LOCAL_MEMBER_KEY);
    await storage.removeItem(LOCAL_SHOP_KEY);
  }
};
