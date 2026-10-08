import { subscriptionService, formatDatePretty, FREE_BILLS_LIMIT } from '../src/services/subscriptionService';
import { SubscriptionRecord } from '../src/types/models';

describe('Counter365 100-Bill Limit & Subscription State Machine', () => {
  const REGISTRATION_DATE = '2026-09-01T10:00:00.000Z'; // Sep 1, 2026

  test('formatDatePretty outputs readable day, month, year format', () => {
    const testDate = new Date('2026-10-01T12:00:00.000Z');
    expect(formatDatePretty(testDate)).toBe('01 Oct 2026');
  });

  describe('100-Bill Free Tier Lifecycle (Replaces 30-Day Trial)', () => {
    test('TEST 1: New account (0 bills created) grants full access and shows 100 bills remaining', () => {
      const now = new Date('2026-09-01T12:00:00.000Z');
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, null, now, 0);

      expect(status.isTrialActive).toBe(true);
      expect(status.isTrialExpired).toBe(false);
      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.billsLimit).toBe(100);
      expect(status.totalBillsCreated).toBe(0);
      expect(status.billsRemaining).toBe(100);
      expect(status.billLimitReached).toBe(false);
      expect(status.progressPercent).toBe(0);
    });

    test('TEST 2: 50 bills created reflects 50% progress and 50 bills remaining', () => {
      const now = new Date('2026-09-15T22:00:00.000Z');
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, null, now, 50);

      expect(status.isTrialActive).toBe(true);
      expect(status.isTrialExpired).toBe(false);
      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.totalBillsCreated).toBe(50);
      expect(status.billsRemaining).toBe(50);
      expect(status.billLimitReached).toBe(false);
      expect(status.progressPercent).toBe(50);
    });

    test('TEST 3: 99 bills created (e.g. 80 active + 19 deleted) still grants access for last bill', () => {
      const now = new Date('2026-09-30T20:00:00.000Z');
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, null, now, 99);

      expect(status.isTrialActive).toBe(true);
      expect(status.isTrialExpired).toBe(false);
      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.billsRemaining).toBe(1);
      expect(status.billLimitReached).toBe(false);
    });

    test('TEST 4: 100 bills created (including deleted) — Free limit reached, access locked, subscription required', () => {
      const now = new Date('2026-10-01T22:00:00.000Z');
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, null, now, 100);

      expect(status.isTrialActive).toBe(false);
      expect(status.isTrialExpired).toBe(true);
      expect(status.hasAccess).toBe(false);
      expect(status.requiresSubscription).toBe(true);
      expect(status.billLimitReached).toBe(true);
      expect(status.billsRemaining).toBe(0);
      expect(status.progressPercent).toBe(100);
    });

    test('TEST 4B: Even after months, under 100 bills has access (no 30-day time restriction)', () => {
      // 90 days later, but only 20 bills created
      const now = new Date('2026-12-01T10:00:00.000Z');
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, null, now, 20);

      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.billsRemaining).toBe(80);
    });
  });

  describe('Paid Subscriptions Active State', () => {
    test('TEST 5: Active 1 Month paid subscription (₹499) grants full access even after 100+ bills', () => {
      const now = new Date('2026-10-05T10:00:00.000Z');
      const sub: SubscriptionRecord = {
        id: 'sub-1',
        shopId: 'shop-1',
        plan: '1_month',
        status: 'active',
        amount: 499,
        interval: '1 Month',
        currentPeriodStart: '2026-10-01T10:00:00.000Z',
        currentPeriodEnd: '2026-10-31T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };

      // 150 bills created, paid subscription active
      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, sub, now, 150);

      expect(status.isPaidActive).toBe(true);
      expect(status.isPaidExpired).toBe(false);
      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.activePlanName).toBe('1 Month Plan');
      expect(status.activePlanPrice).toBe(499);
      expect(status.daysRemaining).toBe(26);
    });

    test('TEST 6: Active 6 Months paid subscription (₹2,799) correctly calculates days remaining', () => {
      const now = new Date('2026-10-01T10:00:00.000Z');
      const sub: SubscriptionRecord = {
        id: 'sub-6',
        shopId: 'shop-1',
        plan: '6_months',
        status: 'active',
        amount: 2799,
        interval: '6 Months',
        currentPeriodStart: '2026-10-01T10:00:00.000Z',
        currentPeriodEnd: '2027-04-01T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };

      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, sub, now, 50);

      expect(status.isPaidActive).toBe(true);
      expect(status.hasAccess).toBe(true);
      expect(status.requiresSubscription).toBe(false);
      expect(status.activePlanName).toBe('6 Months Plan');
      expect(status.activePlanPrice).toBe(2799);
      expect(status.daysRemaining).toBeGreaterThan(180);
    });

    test('TEST 7: Expired paid subscription locks app and requires renewal', () => {
      const now = new Date('2027-05-01T10:00:00.000Z'); // Past April 1, 2027
      const sub: SubscriptionRecord = {
        id: 'sub-6',
        shopId: 'shop-1',
        plan: '6_months',
        status: 'active',
        amount: 2799,
        interval: '6 Months',
        currentPeriodStart: '2026-10-01T10:00:00.000Z',
        currentPeriodEnd: '2027-04-01T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };

      const status = subscriptionService.calculateSubscriptionStatus(REGISTRATION_DATE, sub, now, 250);

      expect(status.isPaidActive).toBe(false);
      expect(status.isPaidExpired).toBe(true);
      expect(status.hasAccess).toBe(false);
      expect(status.requiresSubscription).toBe(true);
      expect(status.daysRemaining).toBe(0);
      expect(status.progressPercent).toBe(100);
    });
  });
});
