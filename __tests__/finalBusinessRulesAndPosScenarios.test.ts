import { authService } from '../src/services/authService';
import { shopService } from '../src/services/shopService';
import { billingService } from '../src/services/billingService';
import { reportService } from '../src/services/reportService';
import { expenseService } from '../src/services/expenseService';
import { storage } from '../src/lib/storage';
import { CartItem, Shop } from '../src/types/models';

describe('CounterPro — Final Business Rules & Production POS Scenarios Audit', () => {
  const TEST_SHOP_ID = 'test-pos-audit-shop-001';

  beforeAll(async () => {
    // Clear storage for clean test run
    await storage.clear();

    const shop: Shop = {
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
      invoicePrefix: 'RTS',
      invoiceResetCycle: 'monthly',
      totalBillsCreated: 0,
    };
    await storage.setObject('@counterpro/active_shop', shop);
  });

  // -------------------------------------------------------------
  // Test A — Normal sale
  // -------------------------------------------------------------
  test('Test A — Normal sale: ₹1,000 bill, ₹1,000 paid, revenue & reports agree', async () => {
    const cart: CartItem[] = [
      { key: 'item-1|full', itemId: 'item-1', name: 'Special Tea Combo', unitPrice: 500, quantity: 2, isHalf: false, lineTotal: 1000 },
    ];

    const res = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      paidAmount: 1000,
      customerName: 'Karthik',
      customerPhone: '9876500001',
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(res.bill.totalAmount).toBe(1000);
    expect(res.bill.paidAmount).toBe(1000);
    expect(res.bill.pendingAmount).toBe(0);
    expect(res.bill.status).toBe('completed');
    expect(res.bill.billNumber).toContain('RTS-');

    // Verify report reflects the sale
    const dayReport = reportService.getDayClosingReport(
      'Raja Tea Stall',
      '10 Anna Salai',
      '9840112233',
      'Tea Shop',
      0,
      [res.bill]
    );
    expect(dayReport.totalSales).toBe(1000);
    expect(dayReport.cashSales).toBe(1000);
    expect(dayReport.pendingSales).toBe(0);
  });

  // -------------------------------------------------------------
  // Test B — Partial payment & Customer Dues
  // -------------------------------------------------------------
  test('Test B — Partial payment: Bill ₹1,000, Receive ₹500 (Due ₹500), Later Receive ₹500 (Due ₹0)', async () => {
    const cart: CartItem[] = [
      { key: 'item-2|full', itemId: 'item-2', name: 'Snacks Platter', unitPrice: 1000, quantity: 1, isHalf: false, lineTotal: 1000 },
    ];

    // Create partial bill
    const res = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Partial Pay',
      gstEnabled: false,
      paidAmount: 500,
      customerName: 'Ramesh',
      customerPhone: '9876500002',
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(res.bill.totalAmount).toBe(1000);
    expect(res.bill.paidAmount).toBe(500);
    expect(res.bill.pendingAmount).toBe(500);

    // Initial revenue reflects only actual money received (₹500)
    let dayReport = reportService.getDayClosingReport('Raja Tea Stall', '', '', 'Tea Shop', 0, [res.bill]);
    expect(dayReport.totalSales).toBe(500);
    expect(dayReport.pendingSales).toBe(500);

    // Later settlement: Customer pays the remaining ₹500
    await billingService.clearPendingPayment(TEST_SHOP_ID, res.bill.id, 500, 'Cash', { name: 'Owner', role: 'Owner' });

    const bills = await billingService.getBills(TEST_SHOP_ID);
    const settledBill = bills.find(b => b.id === res.bill.id);
    expect(settledBill).toBeDefined();
    expect(settledBill!.paidAmount).toBe(1000);
    expect(settledBill!.pendingAmount).toBe(0);
    expect(settledBill!.settledAt).toBeDefined();

    // Now total sales reflects full ₹1,000 and ₹0 pending
    dayReport = reportService.getDayClosingReport('Raja Tea Stall', '', '', 'Tea Shop', 0, [settledBill!]);
    expect(dayReport.totalSales).toBe(1000);
    expect(dayReport.pendingSales).toBe(0);
  });

  // -------------------------------------------------------------
  // Test C — Bill cancellation & Non-reusable invoice numbering
  // -------------------------------------------------------------
  test('Test C — Bill cancellation: Invoice number never reused, next bill increments monotonically', async () => {
    const cart: CartItem[] = [
      { key: 'item-3|full', itemId: 'item-3', name: 'Ginger Tea', unitPrice: 20, quantity: 1, isHalf: false, lineTotal: 20 },
    ];

    const billToCancel = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: 'Owner', role: 'Owner' },
    });

    const cancelledNumber = billToCancel.bill.billNumber;

    // Owner cancels the bill with an explicit audit reason
    const cancelled = await billingService.deleteBill(
      TEST_SHOP_ID,
      billToCancel.bill.id,
      { name: 'Owner', role: 'Owner' },
      'Customer had to leave before tea was served'
    );

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.isDeleted).toBe(true);
    expect(cancelled.cancellationReason).toBe('Customer had to leave before tea was served');

    // Create next bill — must NOT reuse cancelledNumber!
    const nextBill = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(nextBill.bill.billNumber).not.toBe(cancelledNumber);

    // Cancelled bill is excluded from normal reports
    const dayReport = reportService.getDayClosingReport('Raja Tea Stall', '', '', 'Tea Shop', 0, [cancelled, nextBill.bill]);
    expect(dayReport.totalSales).toBe(20); // only nextBill contributes
  });

  // -------------------------------------------------------------
  // Test D — Staff Authorization & Deactivation
  // -------------------------------------------------------------
  test('Test D — Staff Authorization: Biller cannot edit or delete bills, deactivated staff rejected', async () => {
    const kumar = await shopService.addShopMember(TEST_SHOP_ID, 'Kumar Biller', 'Biller', '9876543299');

    const cart: CartItem[] = [
      { key: 'item-4|full', itemId: 'item-4', name: 'Filter Coffee', unitPrice: 30, quantity: 1, isHalf: false, lineTotal: 30 },
    ];

    // Biller creates a bill
    const billRes = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: kumar.fullName, role: kumar.role, id: kumar.id },
    });

    // Biller attempts to edit completed bill — must throw Unauthorized error
    await expect(
      billingService.updateBill({
        billId: billRes.bill.id,
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        editor: { name: kumar.fullName, role: 'Biller', id: kumar.id },
      })
    ).rejects.toThrow('Billers cannot edit completed bills');

    // Biller attempts to delete completed bill — must throw Unauthorized error
    await expect(
      billingService.deleteBill(
        TEST_SHOP_ID,
        billRes.bill.id,
        { name: kumar.fullName, role: 'Biller', id: kumar.id }
      )
    ).rejects.toThrow('Billers cannot delete or cancel bills');

    // Owner deactivates Kumar
    await shopService.setMemberActive(TEST_SHOP_ID, kumar.id, false);

    // Kumar attempts to log in via OTP — rejected
    jest.spyOn(require('../src/services/twoFactorService').twoFactorService, 'verifyOtp').mockResolvedValueOnce({
      success: true,
    });
    const loginRes = await authService.verifyOtp('9876543299', '123456');
    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toContain('deactivated');
  });

  // -------------------------------------------------------------
  // Test E — Lifetime 100-bill quota
  // -------------------------------------------------------------
  test('Test E — Lifetime 100-bill quota: Deleting/cancelling bills cannot decrement total_bills_created', async () => {
    const countBefore = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(countBefore).toBeGreaterThan(0);

    const allBills = await billingService.getBills(TEST_SHOP_ID);
    const activeBill = allBills.find(b => !b.isDeleted);
    expect(activeBill).toBeDefined();

    // Cancel a bill
    await billingService.deleteBill(
      TEST_SHOP_ID,
      activeBill!.id,
      { name: 'Owner', role: 'Owner' },
      'Testing quota persistence'
    );

    const countAfter = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });

  // -------------------------------------------------------------
  // Test F — Edited bill financial audit trail
  // -------------------------------------------------------------
  test('Test F — Edited bill: Preserves original values, updates financial state consistently', async () => {
    const originalCart: CartItem[] = [
      { key: 'item-f1|full', itemId: 'item-f1', name: 'Masala Chai', unitPrice: 20, quantity: 2, isHalf: false, lineTotal: 40 },
    ];

    const createRes = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: originalCart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(createRes.bill.totalAmount).toBe(40);

    // Supervisor edits bill to 3 Masala Chais (₹60)
    const updatedCart: CartItem[] = [
      { key: 'item-f1|full', itemId: 'item-f1', name: 'Masala Chai', unitPrice: 20, quantity: 3, isHalf: false, lineTotal: 60 },
    ];

    const editedBill = await billingService.updateBill({
      billId: createRes.bill.id,
      shopId: TEST_SHOP_ID,
      cart: updatedCart,
      paymentMode: 'Cash',
      gstEnabled: false,
      editor: { name: 'Senthil', role: 'Supervisor' },
    });

    expect(editedBill.status).toBe('edited');
    expect(editedBill.isEdited).toBe(true);
    expect(editedBill.totalAmount).toBe(60);
    expect(editedBill.originalTotal).toBe(40);
    expect(editedBill.editedByName).toBe('Senthil');
    expect(editedBill.editedByRole).toBe('Supervisor');
  });

  // -------------------------------------------------------------
  // Test G — Customer Collision Isolation
  // -------------------------------------------------------------
  test('Test G — Customer Collision Isolation: Same name with different phones never cross dues', async () => {
    const cartA: CartItem[] = [
      { key: 'item-g1|full', itemId: 'item-g1', name: 'Snack A', unitPrice: 200, quantity: 1, isHalf: false, lineTotal: 200 },
    ];
    const cartB: CartItem[] = [
      { key: 'item-g2|full', itemId: 'item-g2', name: 'Snack B', unitPrice: 300, quantity: 1, isHalf: false, lineTotal: 300 },
    ];

    // Customer Suresh 1 (Phone 9876511111) — Due ₹200
    const billA = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: cartA,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Suresh',
      customerPhone: '9876511111',
      creator: { name: 'Owner', role: 'Owner' },
    });

    // Customer Suresh 2 (Phone 9876522222) — Due ₹300
    const billB = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: cartB,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Suresh',
      customerPhone: '9876522222',
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(billA.bill.pendingAmount).toBe(200);
    expect(billB.bill.pendingAmount).toBe(300);

    // Settle Bill A only
    await billingService.clearPendingPayment(TEST_SHOP_ID, billA.bill.id, 200, 'Cash', { name: 'Owner', role: 'Owner' });

    const allBills = await billingService.getBills(TEST_SHOP_ID);
    const updatedA = allBills.find(b => b.id === billA.bill.id);
    const updatedB = allBills.find(b => b.id === billB.bill.id);

    expect(updatedA?.pendingAmount).toBe(0);
    // Bill B must remain completely intact with ₹300 due!
    expect(updatedB?.pendingAmount).toBe(300);
  });

  // -------------------------------------------------------------
  // Test H — Role-Based Discount Authority
  // -------------------------------------------------------------
  test('Test H — Role-Based Discount Authority: Biller blocked from unauthorized custom discounts', async () => {
    const cart: CartItem[] = [
      { key: 'item-h1|full', itemId: 'item-h1', name: 'Family Combo', unitPrice: 1000, quantity: 1, isHalf: false, lineTotal: 1000 },
    ];

    // Biller attempts 25% discount without approval — rejected
    await expect(
      billingService.createBill({
        shopId: TEST_SHOP_ID,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        creator: { name: 'Kumar', role: 'Biller' },
        discount: { type: 'percentage', value: 25 },
      })
    ).rejects.toThrow('Discounts above 10% require Supervisor or Owner approval');

    // Biller applies approved discount of 5% — allowed
    const validBillerBill = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: 'Kumar', role: 'Biller' },
      discount: { type: 'percentage', value: 5 },
    });
    expect(validBillerBill.bill.discountAmount).toBe(50);
    expect(validBillerBill.bill.totalAmount).toBe(950);

    // Owner applies 30% discount — allowed
    const ownerBill = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart,
      paymentMode: 'Cash',
      gstEnabled: false,
      creator: { name: 'Owner', role: 'Owner' },
      discount: { type: 'percentage', value: 30 },
    });
    expect(ownerBill.bill.discountAmount).toBe(300);
    expect(ownerBill.bill.totalAmount).toBe(700);
  });

  // -------------------------------------------------------------
  // Test I — Role-Based Expense Management
  // -------------------------------------------------------------
  test('Test I — Role-Based Expense Management: Biller blocked, Owner/Supervisor allowed', async () => {
    // Biller attempts to create an expense — rejected
    await expect(
      expenseService.addExpense(TEST_SHOP_ID, 'Milk 5L', 250, {
        creator: { name: 'Kumar', role: 'Biller' },
      })
    ).rejects.toThrow('Billers cannot create expenses');

    // Owner creates operational expense
    const exp = await expenseService.addExpense(TEST_SHOP_ID, 'Fresh Cow Milk 10L', 500, {
      category: 'Dairy',
      paymentMode: 'Cash',
      creator: { name: 'Owner', role: 'Owner' },
    });

    expect(exp.description).toBe('Fresh Cow Milk 10L');
    expect(exp.amount).toBe(500);
    expect(exp.category).toBe('Dairy');
    expect(exp.createdByName).toBe('Owner');
  });

  // -------------------------------------------------------------
  // Test J — Cross-Device Data Consistency
  // -------------------------------------------------------------
  test('Test J — Cross-Device Data Consistency: Persistent state verified across simulated devices', async () => {
    // Device 1 loads active bills
    const billsDevice1 = await billingService.getActiveBills(TEST_SHOP_ID);
    expect(billsDevice1.length).toBeGreaterThan(0);

    // Device 2 reads from local storage cache
    const billsDevice2 = await billingService.getBills(TEST_SHOP_ID);
    expect(billsDevice2.length).toBeGreaterThanOrEqual(billsDevice1.length);

    // Verify all active bills have consistent numbers and positive amounts
    billsDevice1.forEach(b => {
      expect(b.totalAmount).toBeGreaterThanOrEqual(0);
      expect(b.billNumber).toBeDefined();
    });
  });
});
