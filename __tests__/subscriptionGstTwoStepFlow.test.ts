import {
  SUBSCRIPTION_PLANS,
  LAUNCH_OFFER_PLANS,
  getSubscriptionPlanById,
  getLaunchOfferPlanById,
  calculatePlanTax,
  PlanTaxBreakdown,
} from '../src/constants/subscriptionPlans';

describe('Subscription Pricing & 18% GST (CGST 9% + SGST 9%) Two-Step Specification', () => {
  describe('1. Plan Listing Prices (Excl. GST)', () => {
    test('3 Months plan displays ₹2,999 (Excl. GST)', () => {
      const plan = getSubscriptionPlanById('3_months')!;
      expect(plan).toBeDefined();
      expect(plan.price).toBe(2999);
      expect(plan.normalPrice).toBe(2999);
      expect(plan.offerPrice).toBe(2999);
      expect(plan.durationMonths).toBe(3);
    });

    test('6 Months plan displays regular ₹5,999 (Excl. GST) and offer price ₹5,499 (Excl. GST)', () => {
      const plan = getSubscriptionPlanById('6_months')!;
      expect(plan).toBeDefined();
      expect(plan.normalPrice).toBe(5999);
      expect(plan.offerPrice).toBe(5499);
      expect(plan.price).toBe(5499);
      expect(plan.savings).toBe(500);
      expect(plan.durationMonths).toBe(6);
    });

    test('12 Months plan displays regular ₹11,999 (Excl. GST) and offer price ₹9,999 (Excl. GST)', () => {
      const plan = getSubscriptionPlanById('1_year')!;
      expect(plan).toBeDefined();
      expect(plan.normalPrice).toBe(11999);
      expect(plan.offerPrice).toBe(9999);
      expect(plan.price).toBe(9999);
      expect(plan.savings).toBe(2000);
      expect(plan.durationMonths).toBe(12);
      expect(plan.popular).toBe(true);
    });
  });

  describe('2. Order Summary Page Tax Breakdown (18% GST: CGST 9% + SGST 9%)', () => {
    test('3 Months Tax Breakdown: Plan ₹2,999.00 -> CGST ₹269.91 + SGST ₹269.91 -> Total ₹3,538.82', () => {
      const tax: PlanTaxBreakdown = calculatePlanTax(2999);
      expect(tax.basePrice).toBe(2999);
      expect(tax.cgstRate).toBe(9);
      expect(tax.sgstRate).toBe(9);
      expect(tax.cgstAmount).toBe(269.91);
      expect(tax.sgstAmount).toBe(269.91);
      expect(tax.totalGst).toBe(539.82);
      expect(tax.totalAmount).toBe(3538.82);

      // Verifying string formatting matching user example
      expect(`Plan – ₹${tax.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`).toBe('Plan – ₹2,999.00');
      expect(`CGST (${tax.cgstRate}%) – ₹${tax.cgstAmount.toFixed(2)}`).toBe('CGST (9%) – ₹269.91');
      expect(`SGST (${tax.sgstRate}%) – ₹${tax.sgstAmount.toFixed(2)}`).toBe('SGST (9%) – ₹269.91');
      expect(`Amount – ₹${tax.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`).toBe('Amount – ₹3,538.82');
    });

    test('6 Months Tax Breakdown: Offer Plan ₹5,499.00 -> CGST ₹494.91 + SGST ₹494.91 -> Total ₹6,488.82', () => {
      const tax: PlanTaxBreakdown = calculatePlanTax(5499);
      expect(tax.basePrice).toBe(5499);
      expect(tax.cgstAmount).toBe(494.91);
      expect(tax.sgstAmount).toBe(494.91);
      expect(tax.totalGst).toBe(989.82);
      expect(tax.totalAmount).toBe(6488.82);
    });

    test('12 Months Tax Breakdown: Offer Plan ₹9,999.00 -> CGST ₹899.91 + SGST ₹899.91 -> Total ₹11,798.82', () => {
      const tax: PlanTaxBreakdown = calculatePlanTax(9999);
      expect(tax.basePrice).toBe(9999);
      expect(tax.cgstAmount).toBe(899.91);
      expect(tax.sgstAmount).toBe(899.91);
      expect(tax.totalGst).toBe(1799.82);
      expect(tax.totalAmount).toBe(11798.82);
    });
  });

  describe('3. Launch Offer & Universal Plan Alignment', () => {
    test('Launch offer plans have identical base prices and tax breakdown', () => {
      const launch3 = getLaunchOfferPlanById('3_months')!;
      expect(launch3.launchPrice).toBe(2999);
      expect(launch3.taxBreakdown.totalAmount).toBe(3538.82);

      const launch6 = getLaunchOfferPlanById('6_months')!;
      expect(launch6.regularPrice).toBe(5999);
      expect(launch6.launchPrice).toBe(5499);
      expect(launch6.savings).toBe(500);
      expect(launch6.taxBreakdown.totalAmount).toBe(6488.82);

      const launch12 = getLaunchOfferPlanById('1_year')!;
      expect(launch12.regularPrice).toBe(11999);
      expect(launch12.launchPrice).toBe(9999);
      expect(launch12.savings).toBe(2000);
      expect(launch12.taxBreakdown.totalAmount).toBe(11798.82);
    });
  });
});
