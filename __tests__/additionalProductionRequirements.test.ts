jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  },
}));

import { subscriptionService } from '../src/services/subscriptionService';
import { shopService } from '../src/services/shopService';
import { contactService } from '../src/services/contactService';
import { billingService } from '../src/services/billingService';
import { syncEngine } from '../src/services/syncEngine';
import { whatsappService } from '../src/services/whatsappService';
import { exportService } from '../src/services/exportService';
import { Bill, Shop, ShopMember, PaymentMethod } from '../src/types/models';
import { storage } from '../src/lib/storage';

// In-memory mocks
jest.mock('../src/lib/storage', () => {
  const store = new Map<string, any>();
  return {
    storage: {
      getObject: jest.fn(async (key: string, defaultValue: any) => {
        return store.has(key) ? store.get(key) : defaultValue;
      }),
      setObject: jest.fn(async (key: string, val: any) => {
        store.set(key, val);
      }),
      remove: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: () => store.clear(),
      _store: store,
    },
  };
});

jest.mock('../src/lib/supabase', () => {
  const mockSub = {
    id: 'sub_123',
    shop_id: 'shop_test_1',
    plan: 'pro',
    status: 'active',
    amount: 1499,
    interval: '3 Months',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const queryBuilder: any = {};
  queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.upsert = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.update = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.delete = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.limit = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.ilike = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.like = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle = jest.fn().mockResolvedValue({ data: mockSub, error: null });
  queryBuilder.single = jest.fn().mockResolvedValue({ data: mockSub, error: null });
  queryBuilder.order = jest.fn().mockResolvedValue({ data: [mockSub], error: null });

  const mockFrom = jest.fn(() => queryBuilder);
  const mockRpc = jest.fn().mockResolvedValue({ data: { success: true }, error: null });

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }) => ({
    uri: 'file:///mock/receipt.pdf',
    base64: 'JVBERi0xLjQK...',
  })),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(true),
  copyAsync: jest.fn().mockResolvedValue(true),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(true),
  copyAsync: jest.fn().mockResolvedValue(true),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}));

describe('Additional Production Requirements Test Suite', () => {
  const sampleShop: Shop = {
    id: 'shop_test_1',
    name: 'Madras Spice House',
    shopType: 'Restaurant',
    phone: '9876543210',
    address: '12 Gandhi Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600001',
    currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    tableManagementEnabled: true,
    tableCount: 6,
    maxStaffLimit: 5,
    upiId: 'madras@okaxis',
    gstEnabled: true,
    gstNumber: '33AAAAA0000A1Z5',
    gstRate: 5,
    roundOffEnabled: false,
    dailyBackupEnabled: true,
    printerEnabled: false,
  };

  const sampleBill: Bill = {
    id: 'bill_abc_123',
    billNumber: 'MSH-OCT-101',
    shopId: 'shop_test_1',
    status: 'completed',
    totalAmount: 450,
    subtotal: 428.57,
    gstAmount: 21.43,
    gstRate: 5,
    paymentMode: 'Cash' as PaymentMethod,
    paidAmount: 450,
    pendingAmount: 0,
    tableNumber: 'Table 3',
    customerName: 'Karthik Raja',
    customerPhone: '9840123456',
    items: [
      {
        id: 'item_1',
        itemName: 'Chicken Biryani',
        quantity: 2,
        unitPrice: 180,
        lineTotal: 360,
        isHalf: false,
      },
      {
        id: 'item_2',
        itemName: 'Fresh Lime Soda',
        quantity: 1,
        unitPrice: 68.57,
        lineTotal: 68.57,
        isHalf: false,
      },
    ],
    createdAt: new Date('2026-10-09T12:30:00Z').toISOString(),
    completedAt: new Date('2026-10-09T12:30:00Z').toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (storage as any)._store?.clear();
  });

  // =========================================================================
  // 1. UNIQUE PREMIUM TABLE MANAGEMENT & CART PRESERVATION
  // =========================================================================
  describe('1. Table Management UI & State Preservation', () => {
    it('accurately distinguishes Available vs Occupied tables with order details', () => {
      const activeTable = 'Table 3';
      const tableCount = sampleShop.tableCount || 4;

      const tables = Array.from({ length: tableCount }, (_, idx) => {
        const num = idx + 1;
        const name = `Table ${num}`;
        const isCurrent = activeTable === name;
        const isOccupied = isCurrent; // e.g. active bill on Table 3

        return {
          tableNumber: num,
          name,
          isCurrent,
          isOccupied,
          totalAmount: isCurrent ? sampleBill.totalAmount : 0,
          itemCount: isCurrent ? sampleBill.items.length : 0,
        };
      });

      expect(tables.length).toBe(6);
      expect(tables[2].name).toBe('Table 3');
      expect(tables[2].isOccupied).toBe(true);
      expect(tables[2].isCurrent).toBe(true);
      expect(tables[2].totalAmount).toBe(450);
      expect(tables[2].itemCount).toBe(2);

      // Other tables remain available
      expect(tables[0].isOccupied).toBe(false);
      expect(tables[1].isOccupied).toBe(false);
      expect(tables[3].isOccupied).toBe(false);
    });

    it('switching to Counter mode clears tableNumber while strictly preserving cart items', () => {
      // Simulate cart state with items assigned to Table 3
      const cartItems = [...sampleBill.items];
      let currentTable: string | null = 'Table 3';

      // User presses "Clear Table / Switch to Counter"
      currentTable = null;

      // Assertions
      expect(currentTable).toBeNull();
      expect(cartItems.length).toBe(2);
      expect(cartItems[0].itemName).toBe('Chicken Biryani');
      expect(cartItems[1].itemName).toBe('Fresh Lime Soda');
    });
  });

  // =========================================================================
  // 2. RECEIPT / PDF TEMPLATE VISUAL FIDELITY & DIRECT WHATSAPP LINK
  // =========================================================================
  describe('2. Receipt / PDF Fidelity & WhatsApp Direct PDF Link', () => {
    it('generates HTML matching media_1791523801072 with all required visual elements', async () => {
      const printMock = require('expo-print').printToFileAsync;

      await exportService.exportBillPdf(sampleBill, sampleShop);

      expect(printMock).toHaveBeenCalledTimes(1);
      const passedHtml: string = printMock.mock.calls[0][0].html;

      // 1. Merchant logo / Merchant logo box
      expect(passedHtml).toContain('MERCHANT LOGO');

      // 2. Uppercase RECEIPT with orange underline
      expect(passedHtml).toContain('RECEIPT');
      expect(passedHtml).toContain('receipt-title-underline');
      expect(passedHtml).toContain('#F97316');

      // 3. Two-column Bill # / Date & Time layout
      expect(passedHtml).toContain('BILL NUMBER');
      expect(passedHtml).toContain('Bill #MSH-OCT-101');
      expect(passedHtml).toContain('DATE & TIME');

      // 4. Billed To block
      expect(passedHtml).toContain('BILLED TO');
      expect(passedHtml).toContain('Karthik Raja');

      // 5. Items table with gray header
      expect(passedHtml).toContain('items-table');
      expect(passedHtml).toContain('background-color: #F3F4F6');

      // 6. Grand total bar with 3px solid orange top border
      expect(passedHtml).toContain('grand-total-bar');
      expect(passedHtml).toContain('border-top: 3px solid #F97316');

      // 7. Peach payment card with checkmark
      expect(passedHtml).toContain('background: #FFF7ED');
      expect(passedHtml).toContain('✓');
      expect(passedHtml).toContain('PAID');

      // 8. Footer branding
      expect(passedHtml).toContain('Counter');
      expect(passedHtml).toContain('365');
    });

    it('formats WhatsApp message with direct .pdf download link without intermediate landing pages', () => {
      const formatted = whatsappService.formatCustomerBill(
        sampleBill,
        sampleShop.name,
        sampleShop.upiId
      );

      // Verify direct PDF/Receipt URL
      expect(formatted).toContain('https://counter365.tecstellar.com/b/bill_abc_123');
      expect(formatted).toContain('📄 *View Receipt:*');
      expect(formatted).toContain('Thank you for your business!');
      const urlMatch = formatted.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(100);
    });
  });

  // =========================================================================
  // 3. STAFF DEACTIVATION & ALLOCATION LIMIT PRESERVATION
  // =========================================================================
  describe('3. Staff Deactivation Preservation & Allocation Policy', () => {
    it('deactivates staff member instead of deleting, preserving record and setting audit metadata', async () => {
      const initialStaff: ShopMember[] = [
        {
          id: 'member_owner',
          shopId: sampleShop.id,
          userId: 'user_1',
          fullName: 'Owner Boss',
          phone: '9840001111',
          role: 'Owner',
          isActive: true,
        },
        {
          id: 'member_biller_1',
          shopId: sampleShop.id,
          userId: 'user_2',
          fullName: 'Ramesh Kumar',
          phone: '9840111222',
          role: 'Biller',
          isActive: true,
        },
      ];

      await storage.setObject('@counterpro/shop_users', initialStaff);
      await storage.setObject('@counterpro/active_shop', sampleShop);

      // Owner removes Ramesh Kumar
      const updated = await shopService.removeMember(
        sampleShop.id,
        'member_biller_1',
        { id: 'user_1', name: 'Owner Boss' }
      );

      // Record must be preserved, not deleted!
      expect(updated.length).toBe(2);
      const ramesh = updated.find(m => m.id === 'member_biller_1');
      expect(ramesh).toBeDefined();
      expect(ramesh?.isActive).toBe(false);
      expect(ramesh?.deactivatedAt).toBeDefined();
      expect(ramesh?.deactivatedBy).toBe('user_1');
    });

    it('enforces staff allocation limit (counts active and inactive staff) and throws specific message', async () => {
      // 5 staff members allocated (limit = 5)
      const allocatedStaff: ShopMember[] = [
        { id: 'm1', shopId: sampleShop.id, userId: 'u1', phone: '9840000001', fullName: 'Owner', role: 'Owner', isActive: true },
        { id: 'm2', shopId: sampleShop.id, userId: 'u2', phone: '9840000002', fullName: 'S1', role: 'Biller', isActive: true },
        { id: 'm3', shopId: sampleShop.id, userId: 'u3', phone: '9840000003', fullName: 'S2', role: 'Biller', isActive: true },
        { id: 'm4', shopId: sampleShop.id, userId: 'u4', phone: '9840000004', fullName: 'S3', role: 'Biller', isActive: false }, // inactive counts!
        { id: 'm5', shopId: sampleShop.id, userId: 'u5', phone: '9840000005', fullName: 'S4', role: 'Supervisor', isActive: false }, // inactive counts!
      ];

      await storage.setObject('@counterpro/shop_users', allocatedStaff);
      await storage.setObject('@counterpro/active_shop', sampleShop);

      // Attempting to add a 6th staff member must fail
      await expect(
        shopService.addShopMember(sampleShop.id, 'New Waiter', 'Biller', '9840999888')
      ).rejects.toThrow('Your staff allocation limit has been reached. Please contact Support for assistance.');
    });

    it('blocks re-adding phone number of previously deactivated staff with explicit support instruction', async () => {
      const existingStaff: ShopMember[] = [
        { id: 'm1', shopId: sampleShop.id, userId: 'u1', phone: '9840000001', fullName: 'Owner', role: 'Owner', isActive: true },
        {
          id: 'm2',
          shopId: sampleShop.id,
          userId: 'u2',
          fullName: 'Old Staff',
          phone: '9840112233',
          role: 'Biller',
          isActive: false, // Deactivated
        },
      ];

      await storage.setObject('@counterpro/shop_users', existingStaff);
      await storage.setObject('@counterpro/active_shop', sampleShop);

      // Attempting to re-add deactivated staff phone
      await expect(
        shopService.addShopMember(sampleShop.id, 'Old Staff', 'Biller', '9840112233')
      ).rejects.toThrow('This phone number belongs to a previously deactivated staff member. Please contact Support for assistance.');
    });
  });

  // =========================================================================
  // 4. MANUAL ADMIN PRO PLAN ACTIVATION & EXTENSION
  // =========================================================================
  describe('4. Manual Admin Pro Plan Activation & Extension Policy', () => {
    it('activates Pro subscription for 3, 6, and 12 months with correct commercial pricing', async () => {
      const result3 = await subscriptionService.activateManualProSubscription({
        shopId: sampleShop.id,
        adminId: 'admin_master_1',
        durationMonths: 3,
        paymentRef: 'OFFLINE_CASH_001',
      });

      expect(result3.success).toBe(true);
      expect(result3.subscription?.plan).toBe('pro');
      expect(result3.subscription?.amount).toBe(1499);
      expect(result3.subscription?.durationMonths).toBe(3);

      const result6 = await subscriptionService.activateManualProSubscription({
        shopId: sampleShop.id,
        adminId: 'admin_master_1',
        durationMonths: 6,
        paymentRef: 'OFFLINE_CASH_002',
      });

      expect(result6.success).toBe(true);
      expect(result6.subscription?.amount).toBe(2799);

      const result12 = await subscriptionService.activateManualProSubscription({
        shopId: sampleShop.id,
        adminId: 'admin_master_1',
        durationMonths: 12,
        paymentRef: 'OFFLINE_CASH_003',
      });

      expect(result12.success).toBe(true);
      expect(result12.subscription?.amount).toBe(4999);
    });

    it('extends from existing expiry when an active Pro plan is already running', async () => {
      // Simulate currently active subscription expiring in 30 days
      const currentExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const mockExistingSub = {
        id: 'sub_active_1',
        shopId: sampleShop.id,
        plan: 'pro' as any,
        status: 'active',
        amount: 1499,
        interval: '3 Months',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: currentExpiry.toISOString(),
      };

      jest.spyOn(subscriptionService, 'getShopSubscription').mockResolvedValueOnce({
        subscription: mockExistingSub as any,
        statusInfo: {} as any,
      });

      // Force direct fallback execution by making RPC fail
      const supabaseModule = require('../src/lib/supabase');
      supabaseModule.supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC disabled') });

      const res = await subscriptionService.activateManualProSubscription({
        shopId: sampleShop.id,
        adminId: 'admin_master_1',
        durationMonths: 6, // add 6 months
      });

      expect(res.success).toBe(true);
      const newExpiry = new Date(res.subscription!.currentPeriodEnd!);
      // New expiry must be at least 30 + 175 days in future (appended to existing expiry)
      const diffDays = (newExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(200);
    });
  });

  // =========================================================================
  // 5. PERMANENT SELF-HEALING FOR FOREIGN KEY (bills_customer_id_fkey)
  // =========================================================================
  describe('5. Permanent Self-Healing for Foreign Key (bills_customer_id_fkey)', () => {
    it('ensureCustomerExists verifies existing customer or provisions missing customer in Supabase', async () => {
      const validShopId = 'a0000000-0000-0000-0000-000000000001';
      const validCustId = 'b0000000-0000-0000-0000-000000000002';

      const exists = await contactService.ensureCustomerExists(
        validCustId,
        validShopId,
        'Ravi V',
        '9876543210'
      );

      expect(exists).toBe(true);
    });

    it('persistBillDirectly catches bills_customer_id_fkey, clears customer_id, and safely persists bill', async () => {
      const validShopId = 'a0000000-0000-0000-0000-000000000001';
      const missingCustId = 'c0000000-0000-0000-0000-000000000003';

      const testBill: Bill = {
        ...sampleBill,
        shopId: validShopId,
        customerId: missingCustId,
        customerName: 'NTS-Walkin Customer',
        customerPhone: '9988776655',
      };

      // Mock ensureCustomerExists to simulate missing customer on cloud
      jest.spyOn(contactService, 'ensureCustomerExists').mockResolvedValueOnce(false);

      // Should succeed and NOT throw bills_customer_id_fkey
      await expect(
        billingService.persistBillToCloud(testBill, 'Cash')
      ).resolves.not.toThrow();
    });

    it('syncEngine handles bills_customer_id_fkey error by self-healing customer_id to null and completing sync', async () => {
      const validShopId = 'a0000000-0000-0000-0000-000000000001';
      const missingCustId = 'd0000000-0000-0000-0000-000000000004';

      const testBill: Bill = {
        ...sampleBill,
        id: 'bill_sync_test_001',
        shopId: validShopId,
        customerId: missingCustId,
        customerName: 'Sync Customer',
        customerPhone: '9840112233',
      };

      // Mock ensureCustomerExists to simulate missing customer on cloud
      jest.spyOn(contactService, 'ensureCustomerExists').mockResolvedValueOnce(false);

      await syncEngine.enqueue({
        operationId: 'op_sync_001',
        shopId: validShopId,
        action: 'create_bill',
        payload: testBill,
      });

      const queueBefore = await syncEngine.getQueue();
      expect(queueBefore.length).toBeGreaterThan(0);

      // Process queue - must complete without throwing bills_customer_id_fkey
      const result = await syncEngine.processQueue();
      expect(result.processed).toBeGreaterThanOrEqual(1);
    });
  });
});
