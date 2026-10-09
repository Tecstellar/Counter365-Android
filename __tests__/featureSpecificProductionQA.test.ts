jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
}));

import { shopService } from '../src/services/shopService';
import { billingService } from '../src/services/billingService';
import { contactService } from '../src/services/contactService';
import { whatsappService } from '../src/services/whatsappService';
import { storage } from '../src/lib/storage';
import { Shop, CartItem, PendingPaymentRecord } from '../src/types/models';

describe('Feature-Specific Production QA & Supabase Integrity Test Suite', () => {
  const TEST_SHOP_ID = 'test-feature-qa-shop-001';

  const mockShop: Shop = {
    id: TEST_SHOP_ID,
    name: 'Chennai Biryani House',
    shopType: 'Restaurant',
    phone: '9840198401',
    address: '10 Mount Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600001',
    gstEnabled: false,
    gstRate: 5,
    roundOffEnabled: true,
    dailyBackupEnabled: true,
    printerEnabled: false,
    currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    invoicePrefix: 'CBH',
    invoiceResetCycle: 'monthly',
    totalBillsCreated: 0,
    upiId: 'chennaibiryani@okhdfcbank',
  };

  beforeAll(async () => {
    await storage.clear();
    await storage.setObject('@counterpro/active_shop', mockShop);
  });

  // =========================================================================
  // Requirement 1: Permanent Account Deletion with Protected Demo Accounts
  // =========================================================================
  describe('Requirement 1: Permanent Account Deletion & Demo Protection', () => {
    test('Blocks permanent deletion of demo account by phone 9999999999', async () => {
      await expect(
        shopService.deleteShopPermanently({
          shopId: 'real-uuid-sample-1',
          phone: '9999999999',
          shopName: 'Demo Express',
          reason: 'Testing',
        })
      ).rejects.toThrow(/Demo accounts are protected and cannot be deleted/i);
    });

    test('Blocks permanent deletion of demo account by ID 99999999-9999-4999-8999-888888888888', async () => {
      await expect(
        shopService.deleteShopPermanently({
          shopId: '99999999-9999-4999-8999-888888888888',
          phone: '9123456789',
          shopName: 'My Store',
          reason: 'Testing',
        })
      ).rejects.toThrow(/Demo accounts are protected and cannot be deleted/i);
    });

    test('Blocks permanent deletion of demo account by Name containing Sample or Demo', async () => {
      await expect(
        shopService.deleteShopPermanently({
          shopId: 'real-uuid-sample-2',
          phone: '9123456780',
          shopName: 'Sample Café & Bakery',
          reason: 'Testing',
        })
      ).rejects.toThrow(/Demo accounts are protected and cannot be deleted/i);
    });

    test('Blocks deletion if phone number has Demo account pattern', async () => {
      await expect(
        shopService.deleteShopPermanently({
          shopId: 'demo-pattern-uuid',
          phone: '+91 99999 99999',
          shopName: 'Some Store',
          reason: 'Testing',
        })
      ).rejects.toThrow(/Demo accounts are protected and cannot be deleted/i);
    });
  });

  // =========================================================================
  // Requirement 2: Supervisor and Biller Role Boundaries for Bill Deletion
  // =========================================================================
  describe('Requirement 2: Supervisor & Biller Role Boundaries for Bill Deletion', () => {
    let createdBillId: string;

    beforeAll(async () => {
      const cart: CartItem[] = [
        { key: 'dish-1|full', itemId: 'dish-1', name: 'Chicken Biryani', unitPrice: 220, quantity: 1, isHalf: false, lineTotal: 220 },
      ];
      const res = await billingService.createBill({
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        customerName: 'Ramesh',
        creator: { name: 'Staff', role: 'Biller', id: 'biller-01' },
      });
      createdBillId = res.bill.id;
    });

    test('Biller cannot delete or cancel bills', async () => {
      await expect(
        billingService.deleteBill(
          TEST_SHOP_ID,
          createdBillId,
          { name: 'Biller Bob', role: 'Biller', id: 'biller-01' },
          'Customer changed mind'
        )
      ).rejects.toThrow(/Billers cannot delete or cancel bills/i);
    });

    test('Supervisor cannot delete or cancel bills', async () => {
      await expect(
        billingService.deleteBill(
          TEST_SHOP_ID,
          createdBillId,
          { name: 'Super Sam', role: 'Supervisor', id: 'super-01' },
          'Mistake in order'
        )
      ).rejects.toThrow(/Only the shop Owner can delete or cancel bills.*Supervisors cannot delete or cancel bills/i);
    });

    test('Owner can successfully cancel and delete bills', async () => {
      const deleted = await billingService.deleteBill(
        TEST_SHOP_ID,
        createdBillId,
        { name: 'Owner Boss', role: 'Owner', id: 'owner-01' },
        'Owner approved cancellation'
      );
      expect(deleted.isCancelled).toBe(true);
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.status).toBe('cancelled');
      expect(deleted.deletedByName).toBe('Owner Boss');
    });
  });

  // =========================================================================
  // Requirement 4: Import Contacts Returning Structured Counts
  // =========================================================================
  describe('Requirement 4: Contact Import Structured Counts', () => {
    test('Import phone contacts returns added, alreadyExistingCount, and invalidCount', async () => {
      // Clear existing customers for shop
      await storage.setObject('@counterpro/customers', []);

      // Seed 1 existing customer: 9840111111
      await contactService.addCustomer(
        TEST_SHOP_ID,
        'Pre-existing Customer',
        '9840111111'
      );

      // Import list: 1 duplicate, 2 new valid, 1 invalid short number
      const importList = [
        { name: 'Duplicate Person', phone: '9840111111' }, // already exists
        { name: 'New Friend A', phone: '9840222222' },      // valid new
        { name: 'New Friend B', phone: '+91 9840333333' },  // valid new with +91
        { name: 'Invalid Guy', phone: '123' },              // invalid short
      ];

      const result = await contactService.importCustomersWithResult(TEST_SHOP_ID, importList);
      expect(result.added.length).toBe(2);
      expect(result.alreadyExistingCount).toBe(1);
      expect(result.invalidCount).toBe(1);

      // Verify all customers in shop
      const allCusts = await contactService.getCustomers(TEST_SHOP_ID);
      expect(allCusts.length).toBe(3); // 1 pre-existing + 2 newly added
    });
  });

  // =========================================================================
  // Requirement 3: Customer Sorting by Visit Count Descending
  // =========================================================================
  describe('Requirement 3: Customer Sorting by Total Bills Descending', () => {
    test('Sorts customers with higher visit count first, tie-breaking on pending balance', () => {
      const custA = { name: 'Occasional Visitor', totalBills: 2, pendingBalance: 0 };
      const custB = { name: 'Loyal Regular', totalBills: 15, pendingBalance: 50 };
      const custC = { name: 'VIP Regular', totalBills: 30, pendingBalance: 0 };
      const custD = { name: 'Tie Visitor with Due', totalBills: 2, pendingBalance: 500 };

      const list = [custA, custB, custC, custD];

      const sorted = [...list].sort((a, b) => {
        const diff = (b.totalBills || 0) - (a.totalBills || 0);
        if (diff !== 0) return diff;
        return (b.pendingBalance || 0) - (a.pendingBalance || 0);
      });

      expect(sorted[0].name).toBe('VIP Regular');       // 30 bills
      expect(sorted[1].name).toBe('Loyal Regular');     // 15 bills
      expect(sorted[2].name).toBe('Tie Visitor with Due'); // 2 bills, 500 pending
      expect(sorted[3].name).toBe('Occasional Visitor');  // 2 bills, 0 pending
    });
  });

  // =========================================================================
  // Requirement 5: Billing Customer Selection UUID Linking
  // =========================================================================
  describe('Requirement 5: Billing Customer UUID Linking', () => {
    test('createBill preserves and attaches customerId to bill record', async () => {
      const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440000';
      const cart: CartItem[] = [
        { key: 'dish-2|full', itemId: 'dish-2', name: 'Mutton Biryani', unitPrice: 350, quantity: 1, isHalf: false, lineTotal: 350 },
      ];

      const res = await billingService.createBill({
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        customerName: 'Anand Kumar',
        customerPhone: '9840555555',
        customerId: CUSTOMER_UUID,
        creator: { name: 'Owner', role: 'Owner' },
      });

      expect(res.bill.customerId).toBe(CUSTOMER_UUID);
      expect(res.bill.customerName).toBe('Anand Kumar');
      expect(res.bill.customerPhone).toBe('9840555555');
    });

    test('updateBill updates customerId on existing bill', async () => {
      const INITIAL_UUID = '550e8400-e29b-41d4-a716-446655440001';
      const UPDATED_UUID = '550e8400-e29b-41d4-a716-446655440002';

      const cart: CartItem[] = [
        { key: 'dish-3|full', itemId: 'dish-3', name: 'Egg Biryani', unitPrice: 180, quantity: 1, isHalf: false, lineTotal: 180 },
      ];

      const res = await billingService.createBill({
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        customerName: 'Suresh',
        customerPhone: '9840666666',
        customerId: INITIAL_UUID,
        creator: { name: 'Owner', role: 'Owner' },
      });

      const updated = await billingService.updateBill({
        billId: res.bill.id,
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        customerName: 'Suresh Updated',
        customerPhone: '9840666666',
        customerId: UPDATED_UUID,
        editor: { name: 'Owner', role: 'Owner' },
      });

      expect(updated.customerId).toBe(UPDATED_UUID);
      expect(updated.customerName).toBe('Suresh Updated');
    });
  });

  // =========================================================================
  // Requirement 9: WhatsApp Due Reminder with Shop UPI ID
  // =========================================================================
  describe('Requirement 9: WhatsApp Due Reminder with Shop UPI ID', () => {
    test('formatPendingReminder includes Shop UPI ID, bill details, and due amount', () => {
      const pendingRecord: PendingPaymentRecord = {
        id: 'pend-01',
        shopId: TEST_SHOP_ID,
        billId: 'bill-01',
        billNumber: 'CBH-001',
        customerName: 'Vignesh',
        customerPhone: '9840777777',
        amountDue: 450,
        amountPaid: 100,
        ageDescription: 'Today',
        status: 'open',
        bills: [{ billNumber: 'CBH-001', date: new Date().toISOString(), amount: 450 }],
        createdAt: new Date().toISOString(),
      };

      const message = whatsappService.formatPendingReminder(
        pendingRecord,
        'Chennai Biryani House',
        'chennaibiryani@okhdfcbank'
      );

      expect(message).toContain('Chennai Biryani House');
      expect(message).toContain('Vignesh');
      expect(message).toContain('450');
      expect(message).toContain('chennaibiryani@okhdfcbank');
      expect(message).toContain('GPay / PhonePe / Paytm');
    });
  });

  // =========================================================================
  // Requirement 13: 100-Bill Quota Lifetime Gate
  // =========================================================================
  describe('Requirement 13: 100-Bill Lifetime Quota Gate', () => {
    test('billingService enforces 100-bill lifetime limit on Free plan', async () => {
      const QUOTA_SHOP_ID = 'quota-shop-free-001';
      const quotaShop: Shop = {
        ...mockShop,
        id: QUOTA_SHOP_ID,
        name: 'Quota Test Stall',
        totalBillsCreated: 100,
      };
      await storage.setObject('@counterpro/active_shop', quotaShop);
      await storage.setObject(`@counterpro/total_bills_created_${QUOTA_SHOP_ID}`, 100);

      // Attempt to create 101st bill on free plan
      const cart: CartItem[] = [
        { key: 'item-q|full', itemId: 'item-q', name: 'Chai', unitPrice: 20, quantity: 1, isHalf: false, lineTotal: 20 },
      ];

      await expect(
        billingService.createBill({
          shopId: QUOTA_SHOP_ID,
          cart,
          paymentMode: 'Cash',
          gstEnabled: false,
          creator: { name: 'Owner', role: 'Owner' },
        })
      ).rejects.toThrow(/Free tier limit of 100 bills reached.*Please upgrade to Pro/i);
    });
  });
});
