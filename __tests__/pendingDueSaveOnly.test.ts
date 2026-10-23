import { billingService } from '../src/services/billingService';
import { contactService } from '../src/services/contactService';
import { storage } from '../src/lib/storage';
import { CartItem } from '../src/types/models';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          ilike: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
          like: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
          limit: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

jest.mock('../src/services/subscriptionService', () => ({
  subscriptionService: {
    getShopSubscription: jest.fn(() =>
      Promise.resolve({
        statusInfo: {
          isPaidActive: true,
          billLimitReached: false,
        },
      })
    ),
  },
}));

jest.mock('../src/services/authService', () => ({
  authService: {
    isUserActiveInShop: jest.fn(() => Promise.resolve(true)),
    canUserPerform: jest.fn(() => Promise.resolve(true)),
  },
}));

describe('Pending / Due Bills & Save Only flow', () => {
  const shopId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();
    await storage.clear();
  });

  it('correctly creates a Full Pending bill with customer phone and records in due ledger', async () => {
    const custPhone = '9876543210';
    const custName = 'Ramesh';

    // 1. Add customer
    const cust = await contactService.addCustomer(shopId, custName, custPhone);
    expect(cust.id).toBeDefined();

    // 2. Cart item
    const cart: CartItem[] = [
      {
        key: '00000000-0000-0000-0000-000000000002|full',
        itemId: '00000000-0000-0000-0000-000000000002',
        name: 'Special Tea',
        unitPrice: 25,
        isHalf: false,
        quantity: 2,
        lineTotal: 50,
      },
    ];

    // 3. Create Pending bill
    const res = await billingService.createBill({
      shopId,
      cart,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: custName,
      customerPhone: custPhone,
      customerId: cust.id,
      paidAmount: 0,
    });

    expect(res.bill.totalAmount).toBe(50);
    expect(res.bill.paidAmount).toBe(0);
    expect(res.bill.pendingAmount).toBe(50);
    expect(res.bill.customerPhone).toBe('9876543210');
    expect(res.bill.customerName).toBe('Ramesh');

    // 4. Verify bill shows up in pending payments ledger
    const pendingRecords = await billingService.getPendingPayments(shopId);
    expect(pendingRecords.length).toBe(1);
    expect(pendingRecords[0].customerName).toBe('Ramesh');
    expect(pendingRecords[0].customerPhone).toBe('9876543210');
    expect(pendingRecords[0].amountDue).toBe(50);

    // 5. Verify customer record in local customers cache has updated pendingBalance
    const customers = await storage.getObject<any[]>('@counterpro/customers', []);
    const matchedCustomer = customers.find((c: any) => c.phone === custPhone);
    expect(matchedCustomer).toBeDefined();
    expect(matchedCustomer?.pendingBalance).toBe(50);
    expect(matchedCustomer?.statusTag).toBe('Pending');
  });

  it('correctly creates a Partial Pay bill with customer phone and records remaining due', async () => {
    const custPhone = '9123456789';

    const cart: CartItem[] = [
      {
        key: '00000000-0000-0000-0000-000000000003|full',
        itemId: '00000000-0000-0000-0000-000000000003',
        name: 'Veg Sandwich',
        unitPrice: 80,
        isHalf: false,
        quantity: 1,
        lineTotal: 80,
      },
    ];

    const res = await billingService.createBill({
      shopId,
      cart,
      paymentMode: 'Partial Pay',
      gstEnabled: false,
      paidAmount: 30, // Paid 30 now, 50 remains pending
      customerPhone: custPhone,
    });

    expect(res.bill.totalAmount).toBe(80);
    expect(res.bill.paidAmount).toBe(30);
    expect(res.bill.pendingAmount).toBe(50);
    expect(res.bill.customerName).toBe('Customer'); // Defaults to 'Customer' when name is empty

    // Verify pending records
    const pendingRecords = await billingService.getPendingPayments(shopId);
    const matched = pendingRecords.find(p => p.customerPhone === custPhone);
    expect(matched).toBeDefined();
    expect(matched?.amountDue).toBe(50);
    expect(matched?.amountPaid).toBe(30);
  });
});
