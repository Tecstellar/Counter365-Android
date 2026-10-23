import { authService } from '../src/services/authService';
import { shopService } from '../src/services/shopService';
import { billingService } from '../src/services/billingService';
import { reportService } from '../src/services/reportService';
import { storage } from '../src/lib/storage';
import { Bill } from '../src/types/models';

describe('Staff Cross-Device Auth & Production Data Integrity Audit', () => {
  const TEST_SHOP_ID = 'test-shop-integrity-001';

  beforeAll(async () => {
    // Setup test shop in local cache
    await storage.setObject('@counterpro/active_shop', {
      id: TEST_SHOP_ID,
      name: 'Raja Tea Stall',
      shopType: 'Tea Shop',
      phone: '9840112233',
      address: '10 Anna Salai',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600002',
      gstEnabled: false,
      gstRate: 5,
      roundOffEnabled: true,
      dailyBackupEnabled: true,
      printerEnabled: false,
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      totalBillsCreated: 0,
    });
  });

  test('1. Staff Creation & Active Member Resolution', async () => {
    // Owner creates Arun (Supervisor) with phone 9876543210
    const arun = await shopService.addShopMember(TEST_SHOP_ID, 'Arun', 'Supervisor', '9876543210');
    expect(arun.role).toBe('Supervisor');
    expect(arun.phone).toBe('9876543210');
    expect(arun.isActive).toBe(true);

    // Owner creates Kumar (Biller) with phone 9876543211
    const kumar = await shopService.addShopMember(TEST_SHOP_ID, 'Kumar', 'Biller', '9876543211');
    expect(kumar.role).toBe('Biller');
    expect(kumar.phone).toBe('9876543211');
    expect(kumar.isActive).toBe(true);

    // Verify members are stored in shop members list
    const members = await shopService.getShopMembers(TEST_SHOP_ID);
    expect(members.some(m => m.phone === '9876543210' && m.role === 'Supervisor')).toBe(true);
    expect(members.some(m => m.phone === '9876543211' && m.role === 'Biller')).toBe(true);
  });

  test('2. Deactivated Staff Member Access Blockage', async () => {
    const members = await shopService.getShopMembers(TEST_SHOP_ID);
    const arun = members.find(m => m.phone === '9876543210');
    expect(arun).toBeDefined();

    // Owner deactivates Arun
    const updated = await shopService.setMemberActive(TEST_SHOP_ID, arun!.id, false);
    const deactivatedArun = updated.find(m => m.id === arun!.id);
    expect(deactivatedArun?.isActive).toBe(false);

    // Arun attempts to login via OTP on another phone
    jest.spyOn(require('../src/services/twoFactorService').twoFactorService, 'verifyOtp').mockResolvedValueOnce({
      success: true,
    });

    const loginRes = await authService.verifyOtp('9876543210', '123456');
    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toContain('deactivated');
  });

  test('3. Active Biller Member Login & Role Resolution', async () => {
    jest.spyOn(require('../src/services/twoFactorService').twoFactorService, 'verifyOtp').mockResolvedValueOnce({
      success: true,
    });

    // Kumar (Biller) logs in on Phone B
    const loginRes = await authService.verifyOtp('9876543211', '123456');
    expect(loginRes.success).toBe(true);
    expect(loginRes.isExistingShop).toBe(true);
    expect(loginRes.member?.role).toBe('Biller');
    expect(loginRes.shop?.name).toBe('Raja Tea Stall');
  });

  test('4. Monthly Reports Include Edited Bills', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const sampleBills: Bill[] = [
      {
        id: 'b1',
        shopId: TEST_SHOP_ID,
        billNumber: 'RTS-October-001',
        subtotal: 100,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 100,
        paidAmount: 100,
        pendingAmount: 0,
        paymentMode: 'Cash',
        status: 'completed',
        items: [{ id: 'it1', itemName: 'Tea', unitPrice: 100, quantity: 1, lineTotal: 100, isHalf: false }],
        createdAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
      {
        id: 'b2',
        shopId: TEST_SHOP_ID,
        billNumber: 'RTS-October-002',
        subtotal: 150,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 150,
        paidAmount: 150,
        pendingAmount: 0,
        paymentMode: 'GPay',
        status: 'edited', // Edited bill!
        isEdited: true,
        items: [{ id: 'it2', itemName: 'Coffee', unitPrice: 150, quantity: 1, lineTotal: 150, isHalf: false }],
        createdAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
      {
        id: 'b3',
        shopId: TEST_SHOP_ID,
        billNumber: 'RTS-October-003',
        subtotal: 50,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 50,
        paidAmount: 50,
        pendingAmount: 0,
        paymentMode: 'Cash',
        status: 'deleted',
        isDeleted: true,
        items: [{ id: 'it3', itemName: 'Snack', unitPrice: 50, quantity: 1, lineTotal: 50, isHalf: false }],
        createdAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
    ];

    const monthlyReport = reportService.getMonthlyReport(year, month, sampleBills, []);

    // Active bills: b1 (100) + b2 edited (150) = 250. Deleted bill b3 (50) is excluded.
    expect(monthlyReport.totalSales).toBe(250);
    expect(monthlyReport.billsCount).toBe(2);
  });

  test('5. Lifetime Bill Counter Does Not Decrease On Bill Deletion', async () => {
    const initialCount = await billingService.getTotalBillsCreated(TEST_SHOP_ID);

    // Create a test bill
    const created = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: [{ key: 'k1', itemId: 'item_1', name: 'Tea', unitPrice: 12, quantity: 2, isHalf: false, lineTotal: 24 }],
      paymentMode: 'Cash',
      gstEnabled: false,
    });

    const newCount = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(newCount).toBe(initialCount + 1);

    // Soft delete the bill
    await billingService.deleteBill(TEST_SHOP_ID, created.bill.id, {
      name: 'Owner',
      role: 'Owner',
    });

    // Verify lifetime counter has NOT decreased
    const countAfterDelete = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(countAfterDelete).toBe(newCount);
  });
});
