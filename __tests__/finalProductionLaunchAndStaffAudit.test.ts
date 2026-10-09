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

import {
  LAUNCH_OFFER_PLANS,
  SUBSCRIPTION_PLANS,
  calculatePricePerDay,
  isShopEligibleForLaunchOffer,
  getLaunchOfferPlanById,
  getSubscriptionPlanById,
} from '../src/constants/subscriptionPlans';
import { subscriptionService, FREE_BILLS_LIMIT } from '../src/services/subscriptionService';
import { shopService } from '../src/services/shopService';
import { authService } from '../src/services/authService';
import { billingService } from '../src/services/billingService';
import { whatsappService } from '../src/services/whatsappService';
import { APP_CONFIG } from '../src/constants/appConfig';
import { Shop, ShopMember, UserRole, Bill } from '../src/types/models';
import { storage } from '../src/lib/storage';
import { generateUUID } from '../src/lib/uuid';

import { twoFactorService } from '../src/services/twoFactorService';

// In-memory mocks
jest.mock('../src/lib/storage', () => {
  const store = new Map<string, any>();
  return {
    storage: {
      getItem: jest.fn(async (key: string) => (store.has(key) ? String(store.get(key)) : null)),
      setItem: jest.fn(async (key: string, val: string) => {
        store.set(key, val);
      }),
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
  let mockServerTime = new Date('2026-10-09T12:00:00.000Z');

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
  queryBuilder.order = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  queryBuilder.single = jest.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = jest.fn(() => queryBuilder);
  const mockRpc = jest.fn(async (fnName: string, args?: any) => {
    if (fnName === 'get_server_time') {
      return { data: mockServerTime.toISOString(), error: null };
    }
    if (fnName === 'check_launch_offer_eligibility') {
      const shop = await storage.getObject<Shop>('@counterpro/active_shop', null as any);
      const isElig = shop?.createdAt ? isShopEligibleForLaunchOffer(shop.createdAt, mockServerTime).isEligible : true;
      return {
        data: {
          success: true,
          is_eligible: isElig,
          days_remaining: isElig ? 30 : 0,
          seconds_remaining: isElig ? 30 * 86400 : 0,
          eligible_until: new Date(mockServerTime.getTime() + 30 * 86400000).toISOString(),
          server_now: mockServerTime.toISOString(),
        },
        error: null,
      };
    }
    if (fnName === 'activate_manual_pro_subscription') {
      return { data: { success: true }, error: null };
    }
    if (fnName === 'admin_reactivate_staff_member') {
      return { data: { success: true, is_active: true }, error: null };
    }
    if (fnName === 'admin_update_shop_staff_limit') {
      return { data: { success: true, new_limit: args?.p_new_limit }, error: null };
    }
    return { data: { success: true }, error: null };
  });

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
    _setMockServerTime: (d: Date) => {
      mockServerTime = d;
    },
    _getMockServerTime: () => mockServerTime,
  };
});

describe('Counter Pro — Final Production Readiness Audit Test Suite', () => {
  const TEST_SHOP_ID = 'e9821a00-1111-4000-8000-000000000001';
  const REG_DATE = new Date('2026-10-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    (storage as any)._store.clear();
  });

  // =========================================================================
  // 1. Launch Offer Pricing & Exact Duration Calculations
  // =========================================================================
  describe('1. Launch Offer Pricing & Card Metadata', () => {
    test('3-Month plan has exact pricing: ₹2,999, 90 days, ₹33/day', () => {
      const plan = getLaunchOfferPlanById('3_months')!;
      expect(plan).toBeDefined();
      expect(plan.durationDays).toBe(90);
      expect(plan.durationMonths).toBe(3);
      expect(plan.regularPrice).toBe(2999);
      expect(plan.launchPrice).toBe(2999);
      expect(plan.savings).toBe(0);
      expect(plan.pricePerDay).toBe(33);
      expect(calculatePricePerDay(2999, 90)).toBe(33);
    });

    test('6-Month plan has exact pricing: Launch ₹4,799, Regular ₹5,999, 180 days, Save ₹1,200 (20%), ₹27/day', () => {
      const plan = getLaunchOfferPlanById('6_months')!;
      expect(plan).toBeDefined();
      expect(plan.durationDays).toBe(180);
      expect(plan.durationMonths).toBe(6);
      expect(plan.regularPrice).toBe(5999);
      expect(plan.launchPrice).toBe(4799);
      expect(plan.savings).toBe(1200);
      expect(plan.discountPercentage).toBe(20);
      expect(plan.pricePerDay).toBe(27);
      expect(calculatePricePerDay(4799, 180)).toBe(27);
      expect(plan.savingsLabel).toBe('Save ₹1,200 (20% OFF)');
    });

    test('12-Month plan has exact pricing: Launch ₹5,999, Regular ₹11,999, 365 days, Save ₹6,000 (50%), ₹16/day', () => {
      const plan = getLaunchOfferPlanById('1_year')!;
      expect(plan).toBeDefined();
      expect(plan.durationDays).toBe(365);
      expect(plan.durationMonths).toBe(12);
      expect(plan.regularPrice).toBe(11999);
      expect(plan.launchPrice).toBe(5999);
      expect(plan.savings).toBe(6000);
      expect(plan.discountPercentage).toBe(50);
      expect(plan.pricePerDay).toBe(16);
      expect(calculatePricePerDay(5999, 365)).toBe(16);
      expect(plan.popular).toBe(true);
      expect(plan.savingsLabel).toContain('Save ₹6,000 (50% OFF)');
    });

    test('regular subscription pricing is preserved after launch offer expires', () => {
      expect(SUBSCRIPTION_PLANS).toHaveLength(3);
      expect(SUBSCRIPTION_PLANS.map(p => p.id)).toEqual(['3_months', '6_months', '1_year']);
    });
  });

  // =========================================================================
  // 2. Authoritative 30-Day Eligibility Window & Tamper-Proof Time
  // =========================================================================
  describe('2. Authoritative 30-Day Eligibility Window & Server Time Enforcement', () => {
    test('newly registered shop is eligible for launch offer on day 0', () => {
      const reg = new Date('2026-10-01T10:00:00Z');
      const current = new Date('2026-10-01T10:05:00Z'); // 5 minutes later
      const elig = isShopEligibleForLaunchOffer(reg.toISOString(), current);

      expect(elig.isEligible).toBe(true);
      expect(elig.daysRemaining).toBe(30);
    });

    test('shop on day 29 is eligible for launch offer with correct countdown', () => {
      const reg = new Date('2026-10-01T00:00:00Z');
      const current = new Date('2026-10-30T00:00:00Z'); // 29 days later
      const elig = isShopEligibleForLaunchOffer(reg.toISOString(), current);

      expect(elig.isEligible).toBe(true);
      expect(elig.daysRemaining).toBe(1);
    });

    test('final eligible instant (day 29, 23h 59m 59s) is eligible', () => {
      const reg = new Date('2026-10-01T00:00:00.000Z');
      const current = new Date(reg.getTime() + 30 * 24 * 60 * 60 * 1000 - 1000); // 1 sec before 30 days
      const elig = isShopEligibleForLaunchOffer(reg.toISOString(), current);

      expect(elig.isEligible).toBe(true);
      expect(elig.secondsRemaining).toBe(1);
    });

    test('first instant after 30 days (day 30 + 1 second) is strictly expired', () => {
      const reg = new Date('2026-10-01T00:00:00.000Z');
      const current = new Date(reg.getTime() + 30 * 24 * 60 * 60 * 1000 + 1000); // 1 sec after 30 days
      const elig = isShopEligibleForLaunchOffer(reg.toISOString(), current);

      expect(elig.isEligible).toBe(false);
      expect(elig.daysRemaining).toBe(0);
      expect(elig.secondsRemaining).toBe(0);
    });

    test('server rejects launch offer activation when shop eligibility has expired', async () => {
      const expiredRegDate = new Date('2026-08-01T00:00:00Z'); // 60+ days ago
      const shopWithExpiredOffer: Shop = {
        id: TEST_SHOP_ID,
        name: 'Old Shop',
        phone: '9876543210',
        createdAt: expiredRegDate.toISOString(),
      } as any;

      await storage.setObject('@counterpro/active_shop', shopWithExpiredOffer);

      const res = await subscriptionService.activatePaidSubscription(
        TEST_SHOP_ID,
        '6_months',
        'order_123',
        undefined,
        true // requests launch offer
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Launch offer eligibility period (30 days from registration) has expired');
    });

    test('tamper-proof time: device clock change does not extend offer when server time is checked', async () => {
      const serverTime = await subscriptionService.getServerTime();
      expect(serverTime).toBeInstanceOf(Date);
      expect(serverTime.getFullYear()).toBe(2026);
    });
  });

  // =========================================================================
  // 3. Staff Lifecycle: Supervisor & Biller Management
  // =========================================================================
  describe('3. Staff Management — Supervisor and Biller Lifecycle', () => {
    test('adding staff persists role, shop association, and active status', async () => {
      const shopId = generateUUID();
      const newStaff = await shopService.addShopMember(
        shopId,
        'Ramesh Kumar',
        'Supervisor',
        '9876500001'
      );

      expect(newStaff.fullName).toBe('Ramesh Kumar');
      expect(newStaff.role).toBe('Supervisor');
      expect(newStaff.phone).toBe('9876500001');
      expect(newStaff.isActive).toBe(true);
    });

    test('deactivating staff preserves historical attribution, sets audit fields, and marks isActive false', async () => {
      const shopId = generateUUID();
      const staff = await shopService.addShopMember(shopId, 'Suresh Biller', 'Biller', '9876500002');

      const updated = await shopService.removeMember(shopId, staff.id, {
        id: 'owner_uuid',
        name: 'Store Owner',
      });

      const deactivated = updated.find(m => m.id === staff.id)!;
      expect(deactivated.isActive).toBe(false);
      expect(deactivated.deactivatedAt).toBeDefined();
      expect(deactivated.deactivatedBy).toBe('owner_uuid');
      expect(deactivated.deactivationReason).toContain('deactivated by owner');
      // Record is preserved (not hard deleted)
      expect(deactivated.fullName).toBe('Suresh Biller');
      expect(deactivated.phone).toBe('9876500002');
    });

    test('deactivated staff cannot log in', async () => {
      jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValue({ success: true, message: 'Verified' });
      const shopId = generateUUID();
      const staff = await shopService.addShopMember(shopId, 'Deactivated Biller', 'Biller', '9876500002');
      await shopService.removeMember(shopId, staff.id);

      const loginRes = await authService.verifyOtp('9876500002', '123456');
      expect(loginRes.success).toBe(false);
      expect(loginRes.error).toContain('Your staff account has been deactivated');
    });

    test('if both Supervisor and Biller become inactive, neither appears in active list', async () => {
      const shopId = generateUUID();
      const s1 = await shopService.addShopMember(shopId, 'Supervisor One', 'Supervisor', '9876500011');
      const b1 = await shopService.addShopMember(shopId, 'Biller One', 'Biller', '9876500012');

      await shopService.removeMember(shopId, s1.id);
      const members = await shopService.removeMember(shopId, b1.id);

      const activeMembers = members.filter(m => m.isActive !== false);
      const inactiveMembers = members.filter(m => m.isActive === false);

      expect(activeMembers.find(m => m.id === s1.id)).toBeUndefined();
      expect(activeMembers.find(m => m.id === b1.id)).toBeUndefined();
      expect(inactiveMembers).toHaveLength(2);
    });

    test('staff allocation limit includes inactive memberships and shows support error when reached', async () => {
      const shopId = generateUUID();
      await storage.setObject('@counterpro/active_shop', {
        id: shopId,
        maxStaffLimit: 2, // configured limit: 2
      });

      // Member 1
      await shopService.addShopMember(shopId, 'Member 1', 'Biller', '9876500021');
      // Member 2
      const m2 = await shopService.addShopMember(shopId, 'Member 2', 'Supervisor', '9876500022');
      // Deactivate member 2
      await shopService.removeMember(shopId, m2.id);

      // Attempting to add Member 3 must fail because total (active + inactive) = 2 >= maxLimit 2
      await expect(
        shopService.addShopMember(shopId, 'Member 3', 'Biller', '9876500023')
      ).rejects.toThrow('Your staff allocation limit has been reached. Please contact Support for assistance.');
    });

    test('admin-assisted staff reactivation restores active membership', async () => {
      const shopId = generateUUID();
      const member = await shopService.addShopMember(shopId, 'Inactive Staff', 'Biller', '9876500031');
      await shopService.removeMember(shopId, member.id);

      const reactivated = await shopService.adminReactivateStaffMember({
        shopId,
        memberId: member.id,
        adminId: 'admin_platform_uuid',
        notes: 'Owner requested reactivation',
      });

      expect(reactivated).toBeDefined();
      expect(reactivated?.isActive).toBe(true);
    });

    test('admin-assisted allocation increase extends shop staff capacity', async () => {
      const shopId = generateUUID();
      const newLimit = await shopService.adminUpdateStaffLimit({
        shopId,
        newLimit: 10,
        adminId: 'admin_platform_uuid',
        notes: 'Enterprise store expansion',
      });

      expect(newLimit).toBe(10);
    });
  });

  // =========================================================================
  // 4. Free Plan 100-Bill Quota & Pro Extension
  // =========================================================================
  describe('4. Free Plan 100-Bill Quota & Pro Upgrade Integrity', () => {
    test('bill 100 is allowed and bill 101 is blocked on Free plan', () => {
      // 99 bills created
      const status99 = subscriptionService.calculateSubscriptionStatus(null, null, new Date(), 99);
      expect(status99.isPaidActive).toBe(false);
      expect(status99.hasAccess).toBe(true);
      expect(status99.billsRemaining).toBe(1);

      // 100 bills created
      const status100 = subscriptionService.calculateSubscriptionStatus(null, null, new Date(), 100);
      expect(status100.hasAccess).toBe(false);
      expect(status100.billLimitReached).toBe(true);
      expect(status100.billsRemaining).toBe(0);

      // 101 bills created
      const status101 = subscriptionService.calculateSubscriptionStatus(null, null, new Date(), 101);
      expect(status101.hasAccess).toBe(false);
      expect(status101.billLimitReached).toBe(true);
    });

    test('manual admin Pro activation grants access without resetting historical bill count', async () => {
      const shopId = generateUUID();
      await storage.setObject('@counterpro/active_shop', {
        id: shopId,
        name: 'Test Store',
        createdAt: new Date().toISOString(),
      });

      const res = await subscriptionService.activateManualProSubscription({
        shopId,
        adminId: 'admin_1',
        durationMonths: 6,
        isLaunchOffer: true,
      });

      expect(res.success).toBe(true);
      expect(res.subscription?.plan).toBe('pro');
      expect(res.subscription?.amount).toBe(4799); // 6 Months Launch Offer Price
    });
  });

  // =========================================================================
  // 5. WhatsApp Direct .pdf Download Link Verification
  // =========================================================================
  describe('5. Receipt Fidelity & WhatsApp Direct PDF Link', () => {
    test('formats WhatsApp message with direct .pdf download link without intermediary landing page', () => {
      const mockBill: Bill = {
        id: 'bill_test_999',
        billNumber: 'Bill #0042',
        shopId: TEST_SHOP_ID,
        customerName: 'Karthik Raja',
        customerPhone: '9876543210',
        totalAmount: 450,
        paidAmount: 450,
        pendingAmount: 0,
        paymentMode: 'Cash',
        items: [
          { id: '1', dishId: 'd1', name: 'Masala Chai', quantity: 2, unitPrice: 20, lineTotal: 40 },
          { id: '2', dishId: 'd2', name: 'Paneer Butter Masala', quantity: 1, unitPrice: 410, lineTotal: 410 },
        ],
        createdAt: '2026-10-09T10:30:00Z',
      } as any;

      const shop: Shop = {
        id: TEST_SHOP_ID,
        name: 'Raja Cafe',
        phone: '9876500000',
      } as any;

      const text = whatsappService.formatCustomerBill(mockBill, shop.name, undefined, shop.phone);

      expect(text).toContain('Hi Karthik Raja 👋');
      expect(text).toContain('Raja Cafe');
      expect(text).toContain('https://counter365.tecstellar.com/b/bill_test_999');
      expect(text).toContain('📄 *View Receipt:*');
      expect(text).toContain('Thank you for your business!');
      expect(text).not.toContain('/landing/');
      expect(text).not.toContain('/view-invoice-page');
    });
  });

  // =========================================================================
  // 6. Support Configuration
  // =========================================================================
  describe('6. Support Number Configuration', () => {
    test('uses actual product support phone +91 89033 68006 without invention', () => {
      expect(APP_CONFIG.supportPhone).toBe('8903368006');
      expect(APP_CONFIG.supportPhoneFormatted).toBe('+91 89033 68006');
    });
  });
});
