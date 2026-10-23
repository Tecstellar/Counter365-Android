import { billingService } from '../src/services/billingService';
import { menuService } from '../src/services/menuService';
import { storage } from '../src/lib/storage';
import { Bill } from '../src/types/models';
import { generateUUID } from '../src/lib/uuid';

describe('User Request Features (Oct 21)', () => {
  const testShopId = generateUUID();

  beforeEach(async () => {
    await storage.clear();
  });

  describe('1. Pending Payments Grouping & Full Due Amount', () => {
    it('groups multiple pending bills under one customer record with full combined due amount', async () => {
      const now = new Date().toISOString();
      const billId1 = generateUUID();
      const billId2 = generateUUID();
      const billId3 = generateUUID();

      const mockBills: Bill[] = [
        {
          id: billId1,
          shopId: testShopId,
          billNumber: 'BILL-101',
          customerName: 'Karthik',
          customerPhone: '9876543210',
          subtotal: 150,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: 150,
          paidAmount: 0,
          pendingAmount: 150,
          paymentMode: 'Pending',
          items: [],
          status: 'completed',
          createdAt: now,
          completedAt: now,
        },
        {
          id: billId2,
          shopId: testShopId,
          billNumber: 'BILL-102',
          customerName: 'Karthik',
          customerPhone: '9876543210',
          subtotal: 300,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: 300,
          paidAmount: 100,
          pendingAmount: 200,
          paymentMode: 'Pending',
          items: [],
          status: 'completed',
          createdAt: now,
          completedAt: now,
        },
        {
          id: billId3,
          shopId: testShopId,
          billNumber: 'BILL-103',
          customerName: 'Deepak',
          customerPhone: '9123456789',
          subtotal: 80,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: 80,
          paidAmount: 0,
          pendingAmount: 80,
          paymentMode: 'Pending',
          items: [],
          status: 'completed',
          createdAt: now,
          completedAt: now,
        },
      ];

      await storage.setObject('@counterpro/bills', mockBills);

      const pendingList = await billingService.getPendingPayments(testShopId);

      // Karthik has 2 bills, Deepak has 1 bill -> Total 2 grouped records instead of 3 separate cards!
      expect(pendingList.length).toBe(2);

      const karthikRecord = pendingList.find(p => p.customerName === 'Karthik');
      expect(karthikRecord).toBeDefined();
      // Combined amount due: 150 + 200 = 350
      expect(karthikRecord?.amountDue).toBe(350);
      expect(karthikRecord?.bills.length).toBe(2);

      const deepakRecord = pendingList.find(p => p.customerName === 'Deepak');
      expect(deepakRecord).toBeDefined();
      expect(deepakRecord?.amountDue).toBe(80);
      expect(deepakRecord?.bills.length).toBe(1);
    });

    it('clears multiple pending bills sequentially using clearMultiplePendingBills', async () => {
      const now = new Date().toISOString();
      const billIdA = generateUUID();
      const billIdB = generateUUID();

      const mockBills: Bill[] = [
        {
          id: billIdA,
          shopId: testShopId,
          billNumber: 'BILL-201',
          customerName: 'Suresh',
          customerPhone: '9898989898',
          subtotal: 100,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: 100,
          paidAmount: 0,
          pendingAmount: 100,
          paymentMode: 'Pending',
          items: [],
          status: 'completed',
          createdAt: new Date(Date.now() - 100000).toISOString(),
          completedAt: now,
        },
        {
          id: billIdB,
          shopId: testShopId,
          billNumber: 'BILL-202',
          customerName: 'Suresh',
          customerPhone: '9898989898',
          subtotal: 200,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: 200,
          paidAmount: 0,
          pendingAmount: 200,
          paymentMode: 'Pending',
          items: [],
          status: 'completed',
          createdAt: now,
          completedAt: now,
        },
      ];

      await storage.setObject('@counterpro/bills', mockBills);

      // Settle 150 out of 300 total due for Suresh
      await billingService.clearMultiplePendingBills(
        testShopId,
        [billIdA, billIdB],
        150,
        'Cash',
        { name: 'Owner', role: 'Owner' }
      );

      const pendingAfter = await billingService.getPendingPayments(testShopId);
      const sureshAfter = pendingAfter.find(p => p.customerName === 'Suresh');

      // Bill A (100) is fully settled, Bill B (200) has 50 paid and 150 remaining
      expect(sureshAfter?.amountDue).toBe(150);
      expect(sureshAfter?.bills.length).toBe(1);
      expect(sureshAfter?.bills[0].billNumber).toBe('BILL-202');
    }, 15000);
  });

  describe('2. Universal Menu Items & Suggestions', () => {
    it('returns universal suggestions for Tea Shop and Cafe', async () => {
      const teaSuggestions = await menuService.getUniversalMenuSuggestions('Tea Shop');
      expect(teaSuggestions.length).toBeGreaterThan(0);
      expect(teaSuggestions.some(it => it.name === 'Tea')).toBe(true);

      const cafeSuggestions = await menuService.getUniversalMenuSuggestions('Cafe');
      expect(cafeSuggestions.length).toBeGreaterThan(0);
      expect(cafeSuggestions.some(it => it.name === 'Cappuccino' || it.name === 'Espresso')).toBe(true);
    });

    it('syncs new items into the universal menu repository and retrieves them', async () => {
      await menuService.syncToUniversalMenu('Tea Shop', [
        {
          name: 'Special Masala Chai',
          price: 25,
          halfPrice: 15,
          hasHalf: true,
          categoryName: 'Tea & Coffee',
        },
      ]);

      const suggestions = await menuService.getUniversalMenuSuggestions('Tea Shop');
      const specialChai = suggestions.find(s => s.name === 'Special Masala Chai');
      expect(specialChai).toBeDefined();
      expect(specialChai?.price).toBe(25);
    });
  });
});
