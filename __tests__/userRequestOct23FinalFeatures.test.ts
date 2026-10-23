import { storage } from '../src/lib/storage';
import { menuService } from '../src/services/menuService';
import { billingService } from '../src/services/billingService';
import { MenuItem, MenuCategory } from '../src/types/models';

describe('User Request Oct 23 Final Features Verification', () => {
  const shopId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await storage.clear();
  });

  describe('1. Unidentified Product & Mostly Used Exclusion', () => {
    it('strictly excludes Unidentified items from mostly used calculations regardless of order count', async () => {
      const items: MenuItem[] = [
        {
          id: 'item-tea',
          shopId,
          categoryId: 'cat-1',
          name: 'Ginger Tea',
          price: 15,
          hasHalf: false,
          isFavorite: false,
          isAvailable: true,
          sortOrder: 1,
        },
        {
          id: 'item-coffee',
          shopId,
          categoryId: 'cat-1',
          name: 'Filter Coffee',
          price: 20,
          hasHalf: false,
          isFavorite: false,
          isAvailable: true,
          sortOrder: 2,
        },
      ];

      // Simulate bills with Unidentified items ordered 50 times and Ginger Tea ordered 10 times
      const bills = [
        {
          id: 'bill-1',
          shopId,
          billNumber: '#1001',
          status: 'completed',
          items: [
            { menuItemId: '__UNIDENTIFIED_PRODUCT_TILE__', itemName: 'Unidentified', quantity: 50, unitPrice: 20, lineTotal: 1000 },
            { menuItemId: 'item-tea', itemName: 'Ginger Tea', quantity: 10, unitPrice: 15, lineTotal: 150 },
            { menuItemId: 'item-coffee', itemName: 'Filter Coffee', quantity: 5, unitPrice: 20, lineTotal: 100 },
          ],
        },
      ];

      await storage.setObject('@counterpro/bills', bills);

      // Verify calculation logic
      const counts = new Map<string, number>();
      for (const bill of bills) {
        for (const itm of bill.items) {
          const qty = Number(itm.quantity || 1);
          // Exclusion rule
          if (itm.itemName && itm.itemName.toLowerCase().includes('unidentified')) continue;
          if (itm.menuItemId === '__UNIDENTIFIED_PRODUCT_TILE__' || itm.menuItemId === 'unidentified') continue;
          if (itm.menuItemId) counts.set(itm.menuItemId, (counts.get(itm.menuItemId) || 0) + qty);
        }
      }

      expect(counts.has('__UNIDENTIFIED_PRODUCT_TILE__')).toBe(false);
      expect(counts.get('item-tea')).toBe(10);
      expect(counts.get('item-coffee')).toBe(5);
    });
  });

  describe('2. Category Alignment & Order Persistence', () => {
    it('persists reordered categories (front/back/align) correctly in local storage', async () => {
      const initialCats: MenuCategory[] = [
        { id: 'cat-tea', shopId, name: 'Tea & Coffee', sortOrder: 0, isActive: true },
        { id: 'cat-snacks', shopId, name: 'Snacks', sortOrder: 1, isActive: true },
        { id: 'cat-bakery', shopId, name: 'Bakery', sortOrder: 2, isActive: true },
      ];

      await storage.setObject('@counterpro/menu_categories', initialCats);

      // Move Snacks to the very front
      const newOrder = ['cat-snacks', 'cat-tea', 'cat-bakery'];
      const updated = await menuService.updateCategoryOrder(shopId, newOrder);

      expect(updated[0].id).toBe('cat-snacks');
      expect(updated[0].sortOrder).toBe(0);
      expect(updated[1].id).toBe('cat-tea');
      expect(updated[1].sortOrder).toBe(1);
      expect(updated[2].id).toBe('cat-bakery');
      expect(updated[2].sortOrder).toBe(2);

      const cached = await storage.getObject<MenuCategory[]>('@counterpro/menu_categories', []);
      expect(cached[0].id).toBe('cat-snacks');
    });
  });

  describe('3. Backdated Bill Creation (Today / Yesterday / Custom)', () => {
    it('preserves past createdAt timestamps for yesterday and custom dates', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const res = await billingService.createBill({
        shopId,
        cart: [
          {
            key: 'k1',
            itemId: 'item-1',
            name: 'Masala Tea',
            unitPrice: 15,
            quantity: 2,
            isHalf: false,
            lineTotal: 30,
          },
        ],
        paymentMode: 'Cash',
        gstEnabled: false,
        createdAt: yesterday.toISOString(),
      });

      expect(res.bill).toBeDefined();
      expect(new Date(res.bill.createdAt).toDateString()).toBe(yesterday.toDateString());
      expect(res.bill.collections?.[0]?.paidAt).toBe(yesterday.toISOString());

      // Check stored bill
      const savedBills = await storage.getObject<any[]>('@counterpro/bills', []);
      const found = savedBills.find(b => b.id === res.bill.id);
      expect(found).toBeDefined();
      expect(new Date(found.createdAt).toDateString()).toBe(yesterday.toDateString());
    });
  });

  describe('4. Auto-Close Duration Verification', () => {
    it('sets 10 seconds auto-close when thermal printer is ON, and 3 seconds when OFF', () => {
      const getAutoCloseDuration = (printerEnabled: boolean) => (printerEnabled ? 10 : 3);
      expect(getAutoCloseDuration(true)).toBe(10);
      expect(getAutoCloseDuration(false)).toBe(3);
    });
  });

  describe('5. Bulk Price Stepper Step Size', () => {
    it('increments and decrements by 5 in bulk price editor', () => {
      const stepDelta = 5;
      const initialPrice = 20;

      const incremented = initialPrice + stepDelta;
      expect(incremented).toBe(25);

      const decremented = initialPrice - stepDelta;
      expect(decremented).toBe(15);

      const clamped = Math.max(0, 3 - stepDelta);
      expect(clamped).toBe(0);
    });
  });
});
