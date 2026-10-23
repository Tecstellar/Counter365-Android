import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlanById,
  calculateNormalPrice,
  calculateSavings,
  calculateDiscountPercent,
  calculatePlanTax,
  BASE_MONTHLY_RATE,
} from '../src/constants/subscriptionPlans';

describe('Authoritative Subscription Plans Specification with 18% GST', () => {
  test('baseline monthly rate is ₹999', () => {
    expect(BASE_MONTHLY_RATE).toBe(999);
  });

  test('contains approved commercial plans (1-month removed from display, 3 plans active)', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    const planIds = SUBSCRIPTION_PLANS.map(p => p.id);
    expect(planIds).toEqual(['3_months', '6_months', '1_year']);
  });

  test('Plan: 3 Months = ₹2,999 (Excl. GST) -> Final ₹3,538.82 with 18% GST (CGST 9% + SGST 9%)', () => {
    const plan = getSubscriptionPlanById('3_months');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(2999);
    expect(plan.durationMonths).toBe(3);
    expect(plan.normalPrice).toBe(2999);
    expect(plan.savings).toBe(0);

    const tax = calculatePlanTax(plan.price);
    expect(tax.basePrice).toBe(2999);
    expect(tax.cgstAmount).toBe(269.91);
    expect(tax.sgstAmount).toBe(269.91);
    expect(tax.totalGst).toBe(539.82);
    expect(tax.totalAmount).toBe(3538.82);
  });

  test('Plan: 6 Months = ₹5,999 (Excl. GST) | Offer Price: ₹5,499 -> Final ₹6,488.82 with 18% GST', () => {
    const plan = getSubscriptionPlanById('6_months');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(5499);
    expect(plan.normalPrice).toBe(5999);
    expect(plan.offerPrice).toBe(5499);
    expect(plan.durationMonths).toBe(6);
    expect(plan.savings).toBe(500);

    const tax = calculatePlanTax(plan.price);
    expect(tax.basePrice).toBe(5499);
    expect(tax.cgstAmount).toBe(494.91);
    expect(tax.sgstAmount).toBe(494.91);
    expect(tax.totalGst).toBe(989.82);
    expect(tax.totalAmount).toBe(6488.82);
  });

  test('Plan: 12 Months = ₹11,999 (Excl. GST) | Offer Price: ₹9,999 -> Final ₹11,798.82 with 18% GST', () => {
    const plan = getSubscriptionPlanById('1_year');
    expect(plan).toBeDefined();
    if (!plan) return;

    expect(plan.price).toBe(9999);
    expect(plan.normalPrice).toBe(11999);
    expect(plan.offerPrice).toBe(9999);
    expect(plan.durationMonths).toBe(12);
    expect(plan.savings).toBe(2000);
    expect(plan.popular).toBe(true);

    const tax = calculatePlanTax(plan.price);
    expect(tax.basePrice).toBe(9999);
    expect(tax.cgstAmount).toBe(899.91);
    expect(tax.sgstAmount).toBe(899.91);
    expect(tax.totalGst).toBe(1799.82);
    expect(tax.totalAmount).toBe(11798.82);
  });

  test('calculatePlanTax accurately matches example from user specification', () => {
    // User prompt example:
    // Plan – ₹2,999.00
    // CGST (9%) – ₹269.91
    // SGST (9%) – ₹269.91
    // Amount – ₹3,538.82
    const breakdown = calculatePlanTax(2999);
    expect(breakdown.basePrice).toBe(2999);
    expect(breakdown.cgstRate).toBe(9);
    expect(breakdown.sgstRate).toBe(9);
    expect(breakdown.cgstAmount).toBe(269.91);
    expect(breakdown.sgstAmount).toBe(269.91);
    expect(breakdown.totalGst).toBe(539.82);
    expect(breakdown.totalAmount).toBe(3538.82);
  });

  test('Pure calculation helper functions match financial formulas', () => {
    expect(calculateNormalPrice(3, 999)).toBe(2997);
    expect(calculateSavings(5999, 5499)).toBe(500);
    expect(calculateSavings(11999, 9999)).toBe(2000);
    expect(calculateDiscountPercent(500, 5999)).toBeCloseTo(8.33, 1);
  });
});
