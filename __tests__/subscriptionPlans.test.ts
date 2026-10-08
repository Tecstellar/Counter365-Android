import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlanById,
  calculateNormalPrice,
  calculateSavings,
  calculateDiscountPercent,
  BASE_MONTHLY_RATE,
} from '../src/constants/subscriptionPlans';

describe('Authoritative Subscription Plans Specification', () => {
  test('baseline monthly rate is exactly ₹499', () => {
    expect(BASE_MONTHLY_RATE).toBe(499);
  });

  test('contains approved commercial plans (1-month removed, 3 plans active)', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    const planIds = SUBSCRIPTION_PLANS.map(p => p.id);
    expect(planIds).toEqual(['3_months', '6_months', '1_year']);
  });

  test('Legacy 1 Month plan safely supported for existing subscribers', () => {
    const plan = getSubscriptionPlanById('1_month');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(499);
    expect(plan.durationMonths).toBe(1);
    expect(plan.normalPrice).toBe(499);
    expect(plan.savings).toBe(0);
    expect(plan.discountPercentage).toBe(0);
    expect(plan.discountBadge).toBeNull();
    expect(plan.monthlyEquivalent).toBe(499);
  });

  test('Plan: 3 Months = ₹1,499, Preferred / Popular, 3 months duration', () => {
    const plan = getSubscriptionPlanById('3_months');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(1499);
    expect(plan.durationMonths).toBe(3);
    expect(plan.normalPrice).toBe(1499);
    expect(plan.savings).toBe(0);
    expect(plan.popular).toBe(true);
    expect(plan.discountBadge).toBe('PREFERRED');
    expect(plan.monthlyEquivalent).toBeCloseTo(499.67, 1);
  });

  test('Plan 3: 6 Months = ₹2,799, 3.90% discount, Save ₹195, ₹466.50/month', () => {
    const plan = getSubscriptionPlanById('6_months');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(2799);
    expect(plan.durationMonths).toBe(6);
    expect(plan.normalPrice).toBe(2994); // 6 * 499
    expect(plan.savings).toBe(195); // 2994 - 2799
    expect(plan.discountPercentage).toBe(3.9);
    expect(plan.discountBadge).toBe('SAVE 3.9%');
    expect(plan.monthlyEquivalent).toBe(466.5);
  });

  test('Plan 4: 1 Year = ₹4,999, 16.52% discount, Save ₹989, ≈ ₹416.58/month', () => {
    const plan = getSubscriptionPlanById('1_year');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(4999);
    expect(plan.durationMonths).toBe(12);
    expect(plan.normalPrice).toBe(5988); // 12 * 499
    expect(plan.savings).toBe(989); // 5988 - 4999
    expect(plan.discountPercentage).toBe(16.52);
    expect(plan.discountBadge).toBe('SAVE 16.5%');
    expect(plan.monthlyEquivalent).toBeCloseTo(416.58, 2);
  });

  test('Pure calculation helper functions match financial formulas', () => {
    // Normal price: months * baseRate
    expect(calculateNormalPrice(1, 499)).toBe(499);
    expect(calculateNormalPrice(6, 499)).toBe(2994);
    expect(calculateNormalPrice(12, 499)).toBe(5988);

    // Savings: normal - actual
    expect(calculateSavings(2994, 2799)).toBe(195);
    expect(calculateSavings(5988, 4999)).toBe(989);
    expect(calculateSavings(499, 499)).toBe(0);

    // Discount %: (savings / normal) * 100
    expect(calculateDiscountPercent(0, 499)).toBe(0);
    expect(calculateDiscountPercent(989, 5988)).toBeCloseTo(16.52, 2);
  });
});
