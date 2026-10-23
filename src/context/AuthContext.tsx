import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { UserProfile, ShopMember, UserRole, PermissionKey } from '../types/models';
import { authService } from '../services/authService';
import { shopService } from '../services/shopService';
import { SendOtpResult } from '../services/twoFactorService';
import { storage } from '../lib/storage';
import { generateUUID } from '../lib/uuid';
import { supabase } from '../lib/supabase';

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  Owner: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, menu_delete: true, users: true, subscription: true },
  Supervisor: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, menu_delete: false, users: false, subscription: false },
  Biller: { bill: true, total: true, exp: false, pend: false, report: false, menu: false, menu_delete: false, users: false, subscription: false },
};

interface AuthContextType {
  profile: UserProfile | null;
  currentRole: UserRole;
  currentMember: ShopMember | null;
  isLoading: boolean;
  setRole: (role: UserRole) => void;
  can: (perm: PermissionKey) => boolean;
  sendOtp: (phone: string) => Promise<SendOtpResult>;
  login: (phone: string, otp: string) => Promise<{ success: boolean; isExistingShop?: boolean; shop?: any; error?: string }>;
  logout: () => Promise<void>;
  updateMemberOverride: (permKey: PermissionKey, val: boolean) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refreshMemberSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('Owner');
  const [currentMember, setCurrentMember] = useState<ShopMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();

    // 1. Supabase Realtime listener on shop_members table:
    // If owner updates permissions/overrides, biller/supervisor gets updated immediately!
    const channel = supabase
      .channel('member-permissions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_members' },
        () => {
          refreshMemberSession();
        }
      )
      .subscribe();

    // 2. Continuous fast polling fallback so staff devices immediately receive overrides
    const pollInterval = setInterval(() => {
      refreshMemberSession();
    }, 3000);

    // 3. AppState listener: immediately sync when staff returns to or opens the app
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshMemberSession();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, []);

  const loadSession = async () => {
    try {
      let savedProfile = await authService.getCurrentProfile();
      let savedMember = await authService.getCurrentMember();

      // Resilient fallback for Expo Go / restarts: If profile is missing but active_shop exists, restore session
      if (!savedProfile) {
        const savedShop = await storage.getObject<any>('@counterpro/active_shop', null);
        if (savedShop && savedShop.id && savedShop.phone) {
          savedProfile = {
            id: generateUUID(),
            fullName: savedShop.ownerName || `${savedShop.name} Owner`,
            phone: savedShop.phone,
          };
          await authService.saveCurrentProfile(savedProfile);
        }
      }

      if (!savedMember && savedProfile) {
        const savedShop = await storage.getObject<any>('@counterpro/active_shop', null);
        if (savedShop && savedShop.id) {
          savedMember = {
            id: `m_${savedProfile.id}`,
            shopId: savedShop.id,
            userId: savedProfile.id,
            fullName: savedProfile.fullName,
            phone: savedProfile.phone,
            role: 'Owner',
            isActive: true,
          };
          await authService.saveCurrentMember(savedMember);
        }
      }

      if (savedProfile) {
        setProfile(savedProfile);
      }

      if (savedMember) {
        // Authoritatively sync member role, active status, and permission overrides
        try {
          // 1. Check local users cache
          const localUsers = await storage.getObject<ShopMember[]>('@counterpro/shop_users', []);
          const cleanSavedP = savedMember.phone ? savedMember.phone.replace(/\D/g, '').slice(-10) : '';
          const matchedLocal = localUsers?.find(m => {
            const cleanM = m.phone ? m.phone.replace(/\D/g, '').slice(-10) : '';
            return m.id === savedMember!.id || (cleanSavedP && cleanM && cleanM === cleanSavedP);
          });
          if (matchedLocal) {
            savedMember = {
              ...savedMember,
              role: matchedLocal.role,
              isActive: matchedLocal.isActive,
              overrides: matchedLocal.overrides || {},
            };
          }

          // 2. Fetch authoritative member row from Supabase
          if (savedMember.id) {
            const { data: dbMember } = await (supabase.from('shop_members') as any)
              .select('*')
              .eq('id', savedMember.id)
              .maybeSingle();

            if (dbMember) {
              let parsedOverrides = dbMember.permissions_override;
              if (typeof parsedOverrides === 'string') {
                try {
                  parsedOverrides = JSON.parse(parsedOverrides);
                } catch {}
              }
              savedMember = {
                ...savedMember,
                role: (dbMember.role as UserRole) || savedMember.role,
                isActive: dbMember.is_active ?? savedMember.isActive,
                overrides: (typeof parsedOverrides === 'object' && parsedOverrides !== null) ? parsedOverrides : {},
              };
            }
          }
          await authService.saveCurrentMember(savedMember);
        } catch (syncErr) {
          console.warn('AuthContext member sync notice:', syncErr);
        }

        setCurrentMember(savedMember);
        setCurrentRole(savedMember.role);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMemberSession = async () => {
    let savedMember = await authService.getCurrentMember();
    if (!savedMember) return;
    try {
      const localUsers = await storage.getObject<ShopMember[]>('@counterpro/shop_users', []);
      const cleanSavedP = savedMember.phone ? savedMember.phone.replace(/\D/g, '').slice(-10) : '';
      const matchedLocal = localUsers?.find(m => {
        const cleanM = m.phone ? m.phone.replace(/\D/g, '').slice(-10) : '';
        return m.id === savedMember!.id || (cleanSavedP && cleanM && cleanM === cleanSavedP);
      });
      if (matchedLocal) {
        savedMember = {
          ...savedMember,
          role: matchedLocal.role,
          isActive: matchedLocal.isActive,
          overrides: matchedLocal.overrides || {},
        };
      }
      if (savedMember.id) {
        let dbMember: any = null;
        try {
          const { data } = await (supabase.from('shop_members') as any)
            .select('*')
            .eq('id', savedMember.id)
            .maybeSingle();
          dbMember = data;
        } catch {}

        if (!dbMember && savedMember.phone) {
          try {
            const cleanP = savedMember.phone.replace(/[^0-9]/g, '').slice(-10);
            const { data } = await (supabase.from('shop_members') as any)
              .select('*')
              .eq('phone', cleanP)
              .order('created_at', { ascending: false })
              .limit(1);
            if (data && data.length > 0) dbMember = data[0];
          } catch {}
        }

        if (dbMember) {
          let parsedOverrides = dbMember.permissions_override;
          if (typeof parsedOverrides === 'string') {
            try {
              parsedOverrides = JSON.parse(parsedOverrides);
            } catch {}
          }
          savedMember = {
            ...savedMember,
            role: (dbMember.role as UserRole) || savedMember.role,
            isActive: dbMember.is_active ?? savedMember.isActive,
            overrides: (typeof parsedOverrides === 'object' && parsedOverrides !== null) ? parsedOverrides : {},
          };
        }
      }
      await authService.saveCurrentMember(savedMember);
      setCurrentMember(savedMember);
      setCurrentRole(savedMember.role);
    } catch (err) {
      console.warn('refreshMemberSession error:', err);
    }
  };

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const can = (perm: PermissionKey): boolean => {
    // Inactive staff members have ZERO permissions across the application
    if (currentMember && currentMember.isActive === false) {
      return false;
    }

    if (currentRole === 'Owner') return true;
    
    // Check if user has active override
    if (currentMember?.overrides && currentMember.overrides[perm] !== undefined) {
      return Boolean(currentMember.overrides[perm]);
    }

    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[currentRole];
    return defaultPerms ? Boolean(defaultPerms[perm]) : false;
  };

  const sendOtp = async (phone: string): Promise<SendOtpResult> => {
    return await authService.sendOtp(phone);
  };

  const login = async (phone: string, otp: string): Promise<{ success: boolean; isExistingShop?: boolean; shop?: any; error?: string }> => {
    const res = await authService.verifyOtp(phone, otp);
    if (res.success && res.profile) {
      setProfile(res.profile);

      if (res.isExistingShop && res.shop) {
        const member = res.member || {
          id: `m_${res.profile.id}`,
          shopId: res.shop.id,
          userId: res.profile.id,
          fullName: res.profile.fullName,
          phone: res.profile.phone,
          role: 'Owner' as UserRole,
          isActive: true,
        };
        setCurrentMember(member);
        setCurrentRole(member.role);
        await authService.saveCurrentMember(member);
        return { success: true, isExistingShop: true, shop: res.shop };
      } else {
        const member: ShopMember = {
          id: `m_${res.profile.id}`,
          shopId: '',
          userId: res.profile.id,
          fullName: res.profile.fullName,
          phone: res.profile.phone,
          role: 'Owner',
          isActive: true,
        };
        setCurrentMember(member);
        setCurrentRole('Owner');
        await authService.saveCurrentMember(member);
        return { success: true, isExistingShop: false };
      }
    }
    return { success: false, error: res.error || 'Invalid OTP code entered.' };
  };

  const logout = async () => {
    await authService.signOut();
    setProfile(null);
    setCurrentMember(null);
    setCurrentRole('Owner');
  };

  const updateMemberOverride = async (permKey: PermissionKey, val: boolean) => {
    if (!currentMember) return;
    const updatedOverrides = { ...(currentMember.overrides || {}), [permKey]: val } as Record<PermissionKey, boolean>;
    const updatedMember = { ...currentMember, overrides: updatedOverrides };
    setCurrentMember(updatedMember);
    await authService.saveCurrentMember(updatedMember);
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const updated = {
      ...(profile || {
        id: 'usr_me',
        phone: '',
        fullName: 'Owner',
        createdAt: new Date().toISOString(),
      }),
      ...updates,
    } as UserProfile;

    setProfile(updated);
    await authService.saveCurrentProfile(updated);

    if (currentMember) {
      const updatedMember: ShopMember = {
        ...currentMember,
        fullName: updates.fullName || currentMember.fullName,
        phone: updates.phone || currentMember.phone,
      };
      setCurrentMember(updatedMember);
      await authService.saveCurrentMember(updatedMember);
    }

    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        currentRole,
        currentMember,
        isLoading,
        setRole,
        can,
        sendOtp,
        login,
        logout,
        updateMemberOverride,
        updateProfile,
        refreshMemberSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
