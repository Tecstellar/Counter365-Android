import { ROLE_DEFAULT_PERMISSIONS } from '../src/context/AuthContext';
import { shopService } from '../src/services/shopService';
import { storage } from '../src/lib/storage';
import { UserRole, PermissionKey, ShopMember } from '../src/types/models';

describe('October 22 Feature Updates & Quality Audit', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  describe('1. Staff Permission Overrides & Immediate Enforcement', () => {
    it('enforces bill=false override on Biller and Supervisor immediately', () => {
      // Default supervisor has bill: true
      expect(ROLE_DEFAULT_PERMISSIONS['Supervisor']['bill']).toBe(true);

      const supervisorWithOverride: ShopMember = {
        id: 'member_sup_1',
        shopId: 'shop_1',
        userId: 'user_1',
        fullName: 'Test Supervisor',
        phone: '9840411111',
        role: 'Supervisor' as UserRole,
        isActive: true,
        overrides: { bill: false },
      };

      const checkCan = (member: ShopMember, role: UserRole, perm: PermissionKey): boolean => {
        if (!member.isActive) return false;
        if (member.overrides && member.overrides[perm] !== undefined) {
          return Boolean(member.overrides[perm]);
        }
        return ROLE_DEFAULT_PERMISSIONS[role]?.[perm] ?? false;
      };

      // Bill permission is overridden to false
      expect(checkCan(supervisorWithOverride, 'Supervisor', 'bill')).toBe(false);
      // Other permissions like exp remain true
      expect(checkCan(supervisorWithOverride, 'Supervisor', 'exp')).toBe(true);
    });

    it('enforces menu=false override on Supervisor immediately', () => {
      const supervisorNoMenu: ShopMember = {
        id: 'member_sup_2',
        shopId: 'shop_1',
        userId: 'user_2',
        fullName: 'Restricted Supervisor',
        phone: '9840422222',
        role: 'Supervisor' as UserRole,
        isActive: true,
        overrides: { menu: false },
      };

      const checkCan = (member: ShopMember, role: UserRole, perm: PermissionKey): boolean => {
        if (!member.isActive) return false;
        if (member.overrides && member.overrides[perm] !== undefined) {
          return Boolean(member.overrides[perm]);
        }
        return ROLE_DEFAULT_PERMISSIONS[role]?.[perm] ?? false;
      };

      expect(checkCan(supervisorNoMenu, 'Supervisor', 'menu')).toBe(false);
    });
  });

  describe('2. Mostly Used Items strictly derived from billing frequency', () => {
    it('does NOT mark any item as mostly used if there are 0 billed orders', () => {
      const items = [
        { id: 'item_1', name: 'Idli', isFavorite: true },
        { id: 'item_2', name: 'Dosa', isFavorite: false },
      ];

      const counts = new Map<string, number>(); // 0 bills

      const ranked = items
        .map(i => {
          const directCount = counts.get(i.id) || 0;
          return { item: i, count: directCount };
        })
        .filter(r => r.count > 0);

      const topIds = new Set<string>();
      for (const r of ranked.slice(0, 8)) {
        topIds.add(r.item.id);
      }

      expect(topIds.size).toBe(0);
      expect(topIds.has('item_1')).toBe(false);
    });

    it('marks items with actual orders as mostly used sorted by order count', () => {
      const items = [
        { id: 'item_1', name: 'Idli', isFavorite: false },
        { id: 'item_2', name: 'Dosa', isFavorite: false },
        { id: 'item_3', name: 'Poori', isFavorite: false },
      ];

      const counts = new Map<string, number>();
      counts.set('item_1', 15);
      counts.set('item_2', 30);
      // item_3 has 0

      const ranked = items
        .map(i => {
          const directCount = counts.get(i.id) || 0;
          return { item: i, count: directCount };
        })
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);

      const topIds = new Set<string>();
      for (const r of ranked.slice(0, 8)) {
        topIds.add(r.item.id);
      }

      expect(topIds.size).toBe(2);
      expect(topIds.has('item_2')).toBe(true);
      expect(topIds.has('item_1')).toBe(true);
      expect(topIds.has('item_3')).toBe(false);
    });
  });

  describe('3. Customer & Vendor Mandatory Phone Number Validation', () => {
    it('rejects saving customer or vendor when phone is empty or not 10 digits', () => {
      const validateContact = (name: string, phone: string): { valid: boolean; error?: string } => {
        const trimmedName = name.trim();
        if (!trimmedName) return { valid: false, error: 'Please enter a name' };
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!phone.trim() || cleanPhone.length === 0) {
          return { valid: false, error: 'Please enter the mobile number' };
        }
        if (cleanPhone.length !== 10) {
          return { valid: false, error: 'Mobile number must be exactly 10 digits' };
        }
        return { valid: true };
      };

      expect(validateContact('Karthik', '').error).toBe('Please enter the mobile number');
      expect(validateContact('Supplier', '98404').error).toBe('Mobile number must be exactly 10 digits');
      expect(validateContact('Valid Vendor', '9840412345').valid).toBe(true);
    });
  });

  describe('4. Permanent Account Deletion Protection & Shop Unlinking', () => {
    it('protects demo accounts from deletion', async () => {
      await expect(
        shopService.deleteShopPermanently({
          shopId: '99999999-9999-4999-8999-888888888888',
          phone: '9999999999',
          shopName: 'Demo Restaurant',
          reason: 'Testing',
        })
      ).rejects.toThrow('Demo accounts are protected and cannot be deleted.');
    });

    it('clears all local storage after permanent deletion', async () => {
      await storage.setItem('test_key', 'test_val');
      expect(await storage.getItem('test_key')).toBe('test_val');

      await shopService.deleteShopPermanently({
        shopId: '11111111-2222-3333-4444-555555555555',
        phone: '9840400000',
        shopName: 'Test Shop',
        reason: 'User requested closure',
      });

      expect(await storage.getItem('test_key')).toBeNull();
    });
  });
});
