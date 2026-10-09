import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, ShopMember, UserRole, PermissionKey } from '../types/models';
import { authService } from '../services/authService';
import { shopService } from '../services/shopService';
import { SendOtpResult } from '../services/twoFactorService';
import { storage } from '../lib/storage';
import { generateUUID } from '../lib/uuid';

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  Owner: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: true, subscription: true },
  Supervisor: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: false, subscription: false },
  Biller: { bill: true, total: true, exp: false, pend: false, report: false, menu: false, users: false, subscription: false },
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
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('Owner');
  const [currentMember, setCurrentMember] = useState<ShopMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
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
        setCurrentMember(savedMember);
        setCurrentRole(savedMember.role);
      }
    } finally {
      setIsLoading(false);
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
      return currentMember.overrides[perm] as boolean;
    }

    return ROLE_DEFAULT_PERMISSIONS[currentRole][perm] ?? false;
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
