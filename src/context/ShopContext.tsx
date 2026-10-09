import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shop, ShopMember, ShopType, UserRole, PermissionKey, SubscriptionRecord, SubscriptionStatusInfo } from '../types/models';
import { shopService, INITIAL_EMPTY_SHOP } from '../services/shopService';
import { subscriptionService } from '../services/subscriptionService';
import { billingService } from '../services/billingService';
import { storage } from '../lib/storage';

interface ShopContextType {
  shop: Shop;
  members: ShopMember[];
  isLoading: boolean;
  subscription: SubscriptionRecord | null;
  subscriptionStatus: SubscriptionStatusInfo;
  refreshSubscription: () => Promise<void>;
  setActiveShop: (shop: Shop) => Promise<void>;
  updateShop: (updates: Partial<Shop>) => Promise<Shop>;
  registerNewShop: (data: {
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
  }) => Promise<Shop>;
  addMember: (name: string, role: UserRole, phone?: string) => Promise<ShopMember>;
  updateMemberRole: (memberId: string, role: UserRole) => Promise<void>;
  updateMemberOverride: (memberId: string, permKey: PermissionKey, val: boolean) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  setMemberActive: (memberId: string, isActive: boolean) => Promise<void>;
  deleteShopPermanently: (params?: {
    ownerUserId?: string;
    reason: string;
    feedback?: string;
    shopName?: string;
    ownerName?: string;
    phone?: string;
  } | string) => Promise<void>;
  refreshShop: () => Promise<void>;
  clearShop: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType>({} as any);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState<Shop>(INITIAL_EMPTY_SHOP);
  const [members, setMembers] = useState<ShopMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusInfo>(
    subscriptionService.calculateSubscriptionStatus(null, null)
  );

  useEffect(() => {
    loadShop();
  }, []);

  const refreshSubscription = async (targetShop?: Shop) => {
    const s = targetShop || shop;
    if (!s || !s.id) return;
    try {
      const totalBillsCreated = await billingService.getTotalBillsCreated(s.id);
      const res = await subscriptionService.getShopSubscription(s.id, s.createdAt, totalBillsCreated);
      setSubscription(res.subscription);
      setSubscriptionStatus(res.statusInfo);
    } catch (err) {
      console.warn('ShopContext refreshSubscription notice:', err);
    }
  };

  const loadShop = async () => {
    try {
      const activeShop = await shopService.getActiveShop();
      const shopMembers = await shopService.getShopMembers(activeShop.id);
      setShop(activeShop);
      setMembers(shopMembers);
      if (activeShop.id) {
        await shopService.ensureShopExists(activeShop.id);
        await refreshSubscription(activeShop);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveShop = async (selectedShop: Shop): Promise<void> => {
    setShop(selectedShop);
    await shopService.saveShop(selectedShop);
    const shopMembers = await shopService.getShopMembers(selectedShop.id);
    setMembers(shopMembers);
    if (selectedShop.id) {
      await refreshSubscription(selectedShop);
    }
  };

  const updateShop = async (updates: Partial<Shop>): Promise<Shop> => {
    const updated = { ...shop, ...updates };
    setShop(updated);
    await shopService.saveShop(updated);
    return updated;
  };

  const registerNewShop = async (data: any): Promise<Shop> => {
    const newShop = await shopService.registerShop(data);
    const newMembers = await shopService.getShopMembers(newShop.id);
    setShop(newShop);
    setMembers(newMembers);
    await refreshSubscription(newShop);
    return newShop;
  };

  const addMember = async (name: string, role: UserRole, phone?: string): Promise<ShopMember> => {
    const newMem = await shopService.addShopMember(shop.id, name, role, phone);
    setMembers((prev: ShopMember[]) => [...prev, newMem]);
    return newMem;
  };

  const updateMemberRole = async (memberId: string, role: UserRole) => {
    const updated = await shopService.updateMemberRole(shop.id, memberId, role);
    setMembers(updated);
  };

  const updateMemberOverride = async (memberId: string, permKey: PermissionKey, val: boolean) => {
    const updated = await shopService.setMemberOverride(shop.id, memberId, permKey, val);
    setMembers(updated);
  };

  const removeMember = async (memberId: string) => {
    const updated = await shopService.removeMember(shop.id, memberId);
    setMembers(updated);
  };

  const setMemberActive = async (memberId: string, isActive: boolean) => {
    const updated = await shopService.setMemberActive(shop.id, memberId, isActive);
    setMembers(updated);
  };

  const deleteShopPermanently = async (
    paramOrOwnerId?:
      | {
          ownerUserId?: string;
          reason: string;
          feedback?: string;
          shopName?: string;
          ownerName?: string;
          phone?: string;
        }
      | string
  ) => {
    let opts = {
      shopId: shop.id,
      shopName: shop.name,
      phone: shop.phone,
      reason: 'User requested deletion',
    } as any;

    if (typeof paramOrOwnerId === 'string') {
      opts.ownerUserId = paramOrOwnerId;
    } else if (paramOrOwnerId && typeof paramOrOwnerId === 'object') {
      opts = {
        shopId: shop.id,
        shopName: paramOrOwnerId.shopName || shop.name,
        phone: paramOrOwnerId.phone || shop.phone,
        ownerUserId: paramOrOwnerId.ownerUserId,
        ownerName: paramOrOwnerId.ownerName,
        reason: paramOrOwnerId.reason || 'User requested deletion',
        feedback: paramOrOwnerId.feedback,
      };
    }
    await shopService.deleteShopPermanently(opts);
    setShop(INITIAL_EMPTY_SHOP);
    setMembers([]);
  };

  const refreshShop = async () => {
    await loadShop();
  };

  const clearShop = async () => {
    setShop(INITIAL_EMPTY_SHOP);
    setMembers([]);
    setSubscription(null);
    setSubscriptionStatus(subscriptionService.calculateSubscriptionStatus(null, null));
    await storage.removeItem('@counterpro/active_shop');
  };

  return (
    <ShopContext.Provider
      value={{
        shop,
        members,
        isLoading,
        subscription,
        subscriptionStatus,
        refreshSubscription,
        setActiveShop,
        updateShop,
        registerNewShop,
        addMember,
        updateMemberRole,
        updateMemberOverride,
        removeMember,
        setMemberActive,
        deleteShopPermanently,
        refreshShop,
        clearShop,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
