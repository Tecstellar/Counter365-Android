// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA512: 'SHA-512',
  },
  digestStringAsync: jest.fn(async (algorithm: string, data: string) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.createHash('sha512').update(data).digest('hex').toLowerCase();
  }),
}));

import { payuService, calculateSha512, PAYU_KEY, PAYU_SALT, PAYU_ENV, PAYU_BASE_URL, PAYU_VERIFY_URL } from '../src/services/payuService';
import { getSubscriptionPlanById } from '../src/constants/subscriptionPlans';

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: new Error('Edge fn not reachable in test') }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

describe('PayU Payment Gateway Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration & Credentials', () => {
    it('loads correct Merchant Key and Salt', () => {
      expect(PAYU_KEY).toBe('eCLL4q');
      expect(PAYU_SALT).toBe('lrHveqnRWPtk84SfL7J9GIv738BO3FEo');
      expect(PAYU_ENV).toBe('TEST');
    });

    it('points to valid PayU endpoints', () => {
      expect(PAYU_BASE_URL).toContain('payu.in/_payment');
      expect(PAYU_VERIFY_URL).toContain('payu.in/merchant/postservice');
    });
  });

  describe('Cryptographic SHA-512 Hash Generation', () => {
    it('generates consistent lowercase SHA-512 hashes', async () => {
      const input = 'eCLL4q|CP_123|588.82|Pro|John|john@example.com|||||||||||lrHveqnRWPtk84SfL7J9GIv738BO3FEo';
      const hash = await calculateSha512(input);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(128); // 512 bits = 128 hex chars
      expect(hash).toBe(hash.toLowerCase());
    });

    it('computes correct verify_payment command hash: sha512(key|command|var1|salt)', async () => {
      const txnid = 'CP_TEST_ORDER_001';
      const expectedInput = `eCLL4q|verify_payment|${txnid}|lrHveqnRWPtk84SfL7J9GIv738BO3FEo`;
      const hash = await calculateSha512(expectedInput);

      expect(hash.length).toBe(128);
    });
  });

  describe('Order Initiation', () => {
    it('initiates a valid PayU order with auto-submitting HTML form', async () => {
      const plan = getSubscriptionPlanById('1_year') || {
        id: '1_year',
        name: '12 Months Pro',
        price: 11798.82,
        durationMonths: 12,
      };

      const shop = {
        id: 'shop_test_12345',
        name: 'Madras Chai Hub',
        phone: '9876543210',
        email: 'billing@madraschai.com',
      };

      const result = await payuService.initiateOrder(plan as any, shop);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.orderId).toMatch(/^cpro_/);
      expect(result.amount).toBe(plan.price);
      expect(result.currency).toBe('INR');
      expect(result.paymentHtml).toBeDefined();

      // Check auto-submitting HTML contains essential fields
      const html = result.paymentHtml!;
      expect(html).toContain('id="payu_checkout_form"');
      expect(html).toContain(`name="key" value="${PAYU_KEY}"`);
      expect(html).toContain(`name="txnid" value="${result.orderId}"`);
      expect(html).toContain(`name="amount" value="${plan.price.toFixed(2)}"`);
      expect(html).toContain('name="hash"');
      expect(html).toContain('document.getElementById(\'payu_checkout_form\')');
      expect(html).toContain('form.submit()');
    });

    it('sanitizes customer names and phone numbers safely', async () => {
      const plan = {
        id: '1_month',
        name: '1 Month Pro',
        price: 588.82,
        durationMonths: 1,
      };

      const shop = {
        id: 'shop_xyz',
        name: 'Special & Unique Cafe #1 @ Downtown!',
        phone: '+91 91234-56789',
      };

      const result = await payuService.initiateOrder(plan as any, shop);

      expect(result.success).toBe(true);
      expect(result.paymentHtml).toContain('name="firstname" value="Special  Unique Cafe 1  Downtown"');
      expect(result.paymentHtml).toContain('name="phone" value="9123456789"');
    });
  });

  describe('Order Verification', () => {
    it('returns isPaid: true when PayU reports success status', async () => {
      const mockOrderId = 'cpro_test_success_1';

      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          msg: '1 out of 1 Transactions Fetched Successfully',
          transaction_details: {
            [mockOrderId]: {
              mihpayid: '4039937155',
              status: 'success',
              amt: '588.82',
              txnid: mockOrderId,
            },
          },
        }),
      } as any);

      const result = await payuService.verifyOrder(mockOrderId, 'shop_1', '1_month');

      expect(result.success).toBe(true);
      expect(result.isPaid).toBe(true);
      expect(result.orderStatus).toBe('PAID');

      global.fetch = originalFetch;
    });

    it('returns isPaid: false when PayU reports failure status', async () => {
      const mockOrderId = 'cpro_test_fail_1';

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          transaction_details: {
            [mockOrderId]: {
              status: 'failure',
              error_Message: 'User cancelled transaction on bank page',
            },
          },
        }),
      } as any);

      const result = await payuService.verifyOrder(mockOrderId, 'shop_1', '1_month');

      expect(result.success).toBe(true);
      expect(result.isPaid).toBe(false);
      expect(result.orderStatus).toBe('FAILED');
      expect(result.message).toContain('User cancelled');

      global.fetch = originalFetch;
    });
  });
});
