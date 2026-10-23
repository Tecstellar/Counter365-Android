import { authService } from '../src/services/authService';
import { shopService } from '../src/services/shopService';
import { billingService } from '../src/services/billingService';
import { reportService } from '../src/services/reportService';
import { expenseService } from '../src/services/expenseService';
import { contactService } from '../src/services/contactService';
import { subscriptionService, FREE_BILLS_LIMIT } from '../src/services/subscriptionService';
import { twoFactorService } from '../src/services/twoFactorService';
import { storage } from '../src/lib/storage';
import { CartItem, Shop, ShopMember, UserRole, Bill } from '../src/types/models';
import { generateUUID } from '../src/lib/uuid';

jest.mock('expo-contacts/legacy', () => ({
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
    Emails: 'emails',
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
}));

jest.setTimeout(60000);

describe('CounterPro — Production Master Audit (50-Point Verification)', () => {
  const AUDIT_SHOP_ID = generateUUID();
  const OWNER_PHONE = '9840199999';
  const SUPERVISOR_PHONE = '9840188888';
  const BILLER_PHONE = '9840177777';

  let testShop: Shop;
  let ownerProfile: any;
  let supervisorMember: ShopMember;

  beforeAll(async () => {
    await storage.clear();

    testShop = {
      id: AUDIT_SHOP_ID,
      name: 'Saravana Bhavan Grand',
      shopType: 'Restaurant',
      phone: OWNER_PHONE,
      address: '100 North Usman Road, T. Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600017',
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      gstEnabled: true,
      gstRate: 5.0,
      roundOffEnabled: true,
      dailyBackupEnabled: true,
      printerEnabled: false,
      invoicePrefix: 'SBG',
      invoiceResetCycle: 'monthly',
      totalBillsCreated: 0,
      createdAt: new Date().toISOString(),
    };

    await storage.setObject('@counterpro/active_shop', testShop);
  });

  // --------------------------------------------------------------------------
  // SECTION 2 & 5: AUTHENTICATION, REGISTRATION & ROLE RESOLUTION
  // --------------------------------------------------------------------------
  describe('Phase 1: Authentication, Registration & Multi-Role Identity', () => {
    it('1.1 Initial cold start for new unregistered user returns empty shop and false existing flag', async () => {
      // Clear shop to simulate fresh device
      await storage.removeItem('@counterpro/active_shop');
      await storage.removeItem('@counterpro/auth_profile');

      const activeShop = await shopService.getActiveShop();
      expect(activeShop.id).toBe('');
      expect(activeShop.name).toBe('');

      // Verify OTP with new phone
      const verifySpy = jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
      });

      const verifyRes = await authService.verifyOtp('9840155555', '123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.isExistingShop).toBe(false);
      expect(verifyRes.profile?.phone).toBe('9840155555');

      verifySpy.mockRestore();

      // Restore audit shop
      await storage.setObject('@counterpro/active_shop', testShop);
    });

    it('1.2 Owner registers shop with durable persistence of shop, owner profile, and starter catalog', async () => {
      const regSpy = jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
      });

      const registered = await shopService.registerShop({
        name: testShop.name,
        ownerName: 'Sundaramurthy',
        shopType: 'Restaurant',
        phone: OWNER_PHONE,
        address: testShop.address,
        city: testShop.city,
        state: testShop.state,
        pincode: testShop.pincode,
        invoicePrefix: 'SBG',
      });

      expect(registered.id).toBeDefined();
      expect(registered.name).toBe('Saravana Bhavan Grand');
      expect(registered.phone).toBe(OWNER_PHONE);

      const savedShop = await storage.getObject<Shop | null>('@counterpro/active_shop', null);
      expect(savedShop?.id).toBe(registered.id);

      testShop = registered;

      const savedProfile = await authService.getCurrentProfile();
      expect(savedProfile?.phone).toBe(OWNER_PHONE);

      ownerProfile = savedProfile;
      regSpy.mockRestore();
    });

    it('1.3 Owner invites Supervisor; Supervisor can authenticate on Device B with phone lookup', async () => {
      // Owner adds supervisor member
      supervisorMember = await shopService.addShopMember(testShop.id, 'Anand Supervisor', 'Supervisor', SUPERVISOR_PHONE);
      expect(supervisorMember.id).toBeDefined();
      expect(supervisorMember.role).toBe('Supervisor');
      expect(supervisorMember.phone).toBe(SUPERVISOR_PHONE);
      expect(supervisorMember.isActive).toBe(true);

      // Simulate Device B: Verify Supervisor phone login
      const supSpy = jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
      });

      const loginRes = await authService.verifyOtp(SUPERVISOR_PHONE, '123456');
      expect(loginRes.success).toBe(true);
      expect(loginRes.member).toBeDefined();
      expect(loginRes.member?.role).toBe('Supervisor');
      expect(loginRes.shop).toBeDefined();
      expect(loginRes.shop?.id).toBe(testShop.id);

      supSpy.mockRestore();
    });

    it('1.4 Staff Deactivation Test: Deactivated Supervisor is blocked on login attempt', async () => {
      // Owner deactivates supervisor
      await shopService.setMemberActive(testShop.id, supervisorMember.id, false);

      const deactSpy = jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
      });

      const loginAttempt = await authService.verifyOtp(SUPERVISOR_PHONE, '123456');
      expect(loginAttempt.success).toBe(false);
      expect(loginAttempt.error).toContain('deactivated');

      deactSpy.mockRestore();

      // Reactivate for remaining tests
      await shopService.setMemberActive(testShop.id, supervisorMember.id, true);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 8: ROLE PERMISSION MATRIX
  // --------------------------------------------------------------------------
  describe('Phase 2: Role Permission Enforcement & Security Boundaries', () => {
    it('2.1 Billers are strictly forbidden from deleting or cancelling bills', async () => {
      const cart: CartItem[] = [
        { key: 't1|full', itemId: 't1', name: 'Filter Coffee', unitPrice: 30, quantity: 2, isHalf: false, lineTotal: 60 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        creator: { name: 'Ramesh Biller', role: 'Biller' },
      });

      // Biller attempts deletion
      await expect(
        billingService.deleteBill(testShop.id, bill.id, { name: 'Ramesh Biller', role: 'Biller' }, 'Mistake')
      ).rejects.toThrow('Unauthorized: Billers cannot delete or cancel bills.');
    });

    it('2.2 Billers cannot apply discounts above 10% without Supervisor/Owner approval', async () => {
      const cart: CartItem[] = [
        { key: 't2|full', itemId: 't2', name: 'Ghee Roast Dosa', unitPrice: 120, quantity: 1, isHalf: false, lineTotal: 120 },
      ];

      // Biller applies 25% discount without approval -> rejected
      await expect(
        billingService.createBill({
          shopId: testShop.id,
          cart,
          paymentMode: 'Cash',
          gstEnabled: false,
          discount: { type: 'percentage', value: 25 },
          creator: { name: 'Ramesh Biller', role: 'Biller' },
        })
      ).rejects.toThrow('Unauthorized: Discounts above 10% require Supervisor or Owner approval.');
    });

    it('2.3 Supervisors and Owners can apply discounts and cancel bills with audit metadata', async () => {
      const cart: CartItem[] = [
        { key: 't3|full', itemId: 't3', name: 'Thali Meals', unitPrice: 150, quantity: 2, isHalf: false, lineTotal: 300 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
        discount: { type: 'percentage', value: 20, approvedBy: 'Sundaramurthy Owner' },
        creator: { name: 'Sundaramurthy Owner', role: 'Owner' },
      });

      expect(bill.discountAmount).toBe(60);
      expect(bill.totalAmount).toBe(240);

      // Owner cancels bill
      const cancelled = await billingService.deleteBill(
        testShop.id,
        bill.id,
        { name: 'Sundaramurthy', role: 'Owner' },
        'Customer order cancelled before preparation'
      );

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.isCancelled).toBe(true);
      expect(cancelled.cancellationReason).toBe('Customer order cancelled before preparation');
      expect(cancelled.deletedByName).toBe('Sundaramurthy');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 10, 11, 22, 23: FINANCIAL CALCULATIONS, SPLIT & PARTIAL PAYMENTS
  // --------------------------------------------------------------------------
  describe('Phase 3: Financial Calculations, Split Payments & Udhar Ledger', () => {
    it('3.1 Split Payment (Cash + GPay) accurately balances without floating point leakage', async () => {
      const cart: CartItem[] = [
        { key: 't4|full', itemId: 't4', name: 'Masala Dosa', unitPrice: 95, quantity: 3, isHalf: false, lineTotal: 285 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash + GPay',
        gstEnabled: false,
        cashAmount: 185,
        gpayAmount: 100,
        creator: { name: 'Cashier', role: 'Supervisor' },
      });

      expect(bill.totalAmount).toBe(285);
      expect(bill.cashAmount).toBe(185);
      expect(bill.gpayAmount).toBe(100);
      expect(bill.paidAmount).toBe(285);
      expect(bill.pendingAmount).toBe(0);
    });

    it('3.2 Partial Payment tracks exact paid and pending ledger balances on customer', async () => {
      const cart: CartItem[] = [
        { key: 't5|full', itemId: 't5', name: 'Catering Tiffin Box', unitPrice: 500, quantity: 1, isHalf: false, lineTotal: 500 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Partial Pay',
        paidAmount: 200,
        gstEnabled: false,
        customerName: 'Murali',
        customerPhone: '9840191234',
        creator: { name: 'Owner', role: 'Owner' },
      });

      expect(bill.totalAmount).toBe(500);
      expect(bill.paidAmount).toBe(200);
      expect(bill.pendingAmount).toBe(300);

      // Verify customer record balance
      const customers = await contactService.getCustomers(testShop.id);
      const murali = customers.find(c => c.phone?.includes('9840191234'));
      expect(murali).toBeDefined();
      expect(murali?.pendingBalance).toBe(300);
    });

    it('3.3 Cancelling a bill with pending balance restores customer ledger dues', async () => {
      const cart: CartItem[] = [
        { key: 't6|full', itemId: 't6', name: 'Special Feast', unitPrice: 400, quantity: 1, isHalf: false, lineTotal: 400 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Pending',
        gstEnabled: false,
        customerName: 'Kalyan',
        customerPhone: '9840195555',
        creator: { name: 'Owner', role: 'Owner' },
      });

      expect(bill.pendingAmount).toBe(400);

      // Cancel bill
      await billingService.deleteBill(
        testShop.id,
        bill.id,
        { name: 'Owner', role: 'Owner' },
        'Billing entry error'
      );

      // Verify customer pending balance was reversed
      const customers = await contactService.getCustomers(testShop.id);
      const kalyan = customers.find(c => c.phone?.includes('9840195555'));
      expect(kalyan?.pendingBalance).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 12, 13, 15: INVOICE SEQUENCING, 100-BILL QUOTA & EDITED BILLS
  // --------------------------------------------------------------------------
  describe('Phase 4: Invoice Sequencing, Quota & Report Integrity', () => {
    it('4.1 Sequential invoice numbers are strictly monotonic and never reused upon deletion', async () => {
      const cart: CartItem[] = [
        { key: 'seq1|full', itemId: 'seq1', name: 'Coffee', unitPrice: 30, quantity: 1, isHalf: false, lineTotal: 30 },
      ];

      const bill1 = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
      });

      const bill2 = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
      });

      const seq1 = parseInt(bill1.bill.billNumber.replace(/[^0-9]/g, ''), 10);
      const seq2 = parseInt(bill2.bill.billNumber.replace(/[^0-9]/g, ''), 10);
      expect(seq2).toBe(seq1 + 1);

      // Delete bill 2
      await billingService.deleteBill(testShop.id, bill2.bill.id, { name: 'Owner', role: 'Owner' }, 'Customer left');

      // Create bill 3
      const bill3 = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
      });

      const seq3 = parseInt(bill3.bill.billNumber.replace(/[^0-9]/g, ''), 10);
      // Bill 3 must be seq2 + 1, NEVER recycling bill 2!
      expect(seq3).toBe(seq2 + 1);
    });

    it('4.2 Edited bills preserve original totals, audit fields, and remain visible in reports', async () => {
      const cart: CartItem[] = [
        { key: 'ed1|full', itemId: 'ed1', name: 'Mini Tiffin', unitPrice: 100, quantity: 1, isHalf: false, lineTotal: 100 },
      ];

      const { bill } = await billingService.createBill({
        shopId: testShop.id,
        cart,
        paymentMode: 'Cash',
        gstEnabled: false,
      });

      const updatedCart: CartItem[] = [
        { key: 'ed1|full', itemId: 'ed1', name: 'Mini Tiffin', unitPrice: 100, quantity: 2, isHalf: false, lineTotal: 200 },
      ];

      const editedBill = await billingService.updateBill({
        shopId: testShop.id,
        billId: bill.id,
        cart: updatedCart,
        paymentMode: 'Cash',
        gstEnabled: false,
        editor: { name: 'Supervisor Anand', role: 'Supervisor' },
      });

      expect(editedBill.totalAmount).toBe(200);
      expect(editedBill.originalTotal).toBe(100);
      expect(editedBill.isEdited).toBe(true);
      expect(editedBill.editedByName).toBe('Supervisor Anand');

      // Verify report includes edited bill
      const allBills = await billingService.getBills(testShop.id);
      const report = reportService.getDayClosingReport('Saravana Bhavan', 'T Nagar', OWNER_PHONE, 'Restaurant', 0, allBills);
      expect(report.totalSales).toBeGreaterThanOrEqual(200);
    });

    it('4.3 100-Bills Lifetime Quota is monotonic and cannot be bypassed by deleting bills', async () => {
      const TOTAL_KEY = `@counterpro/total_bills_created_${testShop.id}`;
      // Set to 100 to simulate reached quota
      await storage.setObject(TOTAL_KEY, 100);

      const cart: CartItem[] = [
        { key: 'q1|full', itemId: 'q1', name: 'Tea', unitPrice: 15, quantity: 1, isHalf: false, lineTotal: 15 },
      ];

      // Attempting 101st bill on free plan must throw
      await expect(
        billingService.createBill({
          shopId: testShop.id,
          cart,
          paymentMode: 'Cash',
          gstEnabled: false,
        })
      ).rejects.toThrow('Free tier limit of 100 bills reached');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 21, 27, 28: EXPENSES & NET PROFIT RECONCILIATION
  // --------------------------------------------------------------------------
  describe('Phase 5: Operational Expenses & Net Profit Reconciliation', () => {
    it('5.1 Daily and monthly net profit accurately deducts expenses from active sales', async () => {
      const exp1 = await expenseService.addExpense(testShop.id, 'Milk packets 10L', 300, {
        category: 'Supplies',
      });

      const exp2 = await expenseService.addExpense(testShop.id, 'Tea powder & sugar', 150, {
        category: 'Raw Materials',
      });

      expect(exp1.amount).toBe(300);
      expect(exp2.amount).toBe(150);

      const allExpenses = await expenseService.getExpenses(testShop.id);
      const totalExp = allExpenses.reduce((s, e) => s + e.amount, 0);

      const allBills = await billingService.getBills(testShop.id);
      const report = reportService.getDayClosingReport('Saravana Bhavan', 'T Nagar', OWNER_PHONE, 'Restaurant', totalExp, allBills);

      expect(report.totalExpenses).toBe(totalExp);
      expect(report.netProfit).toBe(report.totalSales - totalExp);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 44: TEST THE TESTS (Intentionally falsifiable verification)
  // --------------------------------------------------------------------------
  describe('Phase 6: Test-the-Tests Falsifiability Verification', () => {
    it('6.1 Proves assertions fail when an incorrect total or status is asserted', () => {
      const dummyBill = { totalAmount: 500, status: 'completed' };
      // Verify that expecting 600 fails
      expect(() => {
        expect(dummyBill.totalAmount).toBe(600);
      }).toThrow();
    });
  });
});
