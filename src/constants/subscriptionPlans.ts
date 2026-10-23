import { SubscriptionPlanId } from '../types/models';

export interface PlanTaxBreakdown {
  basePrice: number;
  cgstRate: number; // 9%
  sgstRate: number; // 9%
  cgstAmount: number; // basePrice * 0.09
  sgstAmount: number; // basePrice * 0.09
  totalGst: number; // cgstAmount + sgstAmount (18%)
  totalAmount: number; // basePrice + totalGst
}

/**
 * Authoritative Indian GST calculation for subscription plans (HSN/SAC 998313).
 * Exactly calculates CGST (9%) + SGST (9%) = 18% total GST.
 * Example for ₹2,999:
 * Plan Base = ₹2,999.00
 * CGST (9%) = ₹269.91
 * SGST (9%) = ₹269.91
 * Total Amount = ₹3,538.82
 */
export function calculatePlanTax(basePrice: number): PlanTaxBreakdown {
  const cgstAmount = Number((basePrice * 0.09).toFixed(2));
  const sgstAmount = Number((basePrice * 0.09).toFixed(2));
  const totalGst = Number((cgstAmount + sgstAmount).toFixed(2));
  const totalAmount = Number((basePrice + totalGst).toFixed(2));
  return {
    basePrice,
    cgstRate: 9,
    sgstRate: 9,
    cgstAmount,
    sgstAmount,
    totalGst,
    totalAmount,
  };
}

export interface SubscriptionPlanConfig {
  id: SubscriptionPlanId;
  name: string;
  durationMonths: number;
  durationLabel: string;
  price: number; // Excl. GST base/offer price
  normalPrice: number; // Excl. GST regular catalog price
  offerPrice: number; // Excl. GST offer price
  monthlyEquivalent: number;
  savings: number;
  discountPercentage: number;
  discountBadge: string | null;
  popular?: boolean;
  features: string[];
  taxBreakdown: PlanTaxBreakdown;
}

export const BASE_MONTHLY_RATE = 999;

/**
 * Pure calculation functions for authoritative subscription pricing.
 */
export function calculateNormalPrice(durationMonths: number, baseRate: number = BASE_MONTHLY_RATE): number {
  return durationMonths * baseRate;
}

export function calculateSavings(normalPrice: number, actualPrice: number): number {
  return Math.max(0, normalPrice - actualPrice);
}

export function calculateDiscountPercent(savings: number, normalPrice: number): number {
  if (normalPrice <= 0 || savings <= 0) return 0;
  return Number(((savings / normalPrice) * 100).toFixed(2));
}

/**
 * Approved commercial Counter365 subscription plans.
 * 3 Months: ₹2,999 (Excl. GST) -> Final: ₹3,538.82
 * 6 Months: ₹5,999 (Excl. GST) | Offer Price: ₹5,499 -> Final: ₹6,488.82
 * 12 Months: ₹11,999 (Excl. GST) | Offer Price: ₹9,999 -> Final: ₹11,798.82
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: '3_months',
    name: '3 Months',
    durationMonths: 3,
    durationLabel: '3 Months Access',
    price: 2999,
    normalPrice: 2999,
    offerPrice: 2999,
    monthlyEquivalent: 999.67,
    savings: 0,
    discountPercentage: 0,
    discountBadge: null,
    popular: false,
    features: [
      'Full Point of Sale & Billing',
      'Daily Closing & Cloud Sync',
      'Unlimited Menu Items',
      'Customer Directory & Due Tracking',
      'Expense Tracking & Reports',
    ],
    taxBreakdown: calculatePlanTax(2999),
  },
  {
    id: '6_months',
    name: '6 Months',
    durationMonths: 6,
    durationLabel: '6 Months Access',
    price: 5499,
    normalPrice: 5999,
    offerPrice: 5499,
    monthlyEquivalent: 916.5,
    savings: 500,
    discountPercentage: 8.33,
    discountBadge: 'SAVE ₹500',
    popular: false,
    features: [
      'Everything in 3 Months',
      'Save ₹500 on half-year billing',
      'Multi-User Staff Roles (Biller/Supervisor)',
      'WhatsApp Receipt Sharing',
      'Priority Phone Support',
    ],
    taxBreakdown: calculatePlanTax(5499),
  },
  {
    id: '1_year',
    name: '12 Months',
    durationMonths: 12,
    durationLabel: '12 Months Access',
    price: 9999,
    normalPrice: 11999,
    offerPrice: 9999,
    monthlyEquivalent: 833.25,
    savings: 2000,
    discountPercentage: 16.67,
    discountBadge: 'SAVE ₹2,000',
    popular: true,
    features: [
      'Best Value — Save ₹2,000 / year',
      'Only ₹833.25 per month',
      'All Pro Features Included',
      'Automatic Cloud Backups',
      'Multi-Terminal Sync & Staff Management',
    ],
    taxBreakdown: calculatePlanTax(9999),
  },
];

export interface LaunchOfferPlanConfig {
  id: SubscriptionPlanId;
  name: string;
  durationDays: number;
  durationMonths: number;
  durationLabel: string;
  regularPrice: number;
  launchPrice: number;
  offerPrice: number;
  pricePerDay: number;
  savings: number;
  discountPercentage: number;
  savingsLabel: string | null;
  popular?: boolean;
  features: string[];
  taxBreakdown: PlanTaxBreakdown;
}

export const LAUNCH_OFFER_DURATION_DAYS = 30;

export function calculatePricePerDay(price: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round(price / days);
}

export const LAUNCH_OFFER_PLANS: LaunchOfferPlanConfig[] = [
  {
    id: '3_months',
    name: '3 Months',
    durationDays: 90,
    durationMonths: 3,
    durationLabel: '90 Days Access',
    regularPrice: 2999,
    launchPrice: 2999,
    offerPrice: 2999,
    pricePerDay: calculatePricePerDay(2999, 90),
    savings: 0,
    discountPercentage: 0,
    savingsLabel: null,
    popular: false,
    features: [
      'Full Point of Sale & Billing',
      'Daily Closing & Cloud Sync',
      'Unlimited Menu Items',
      'Customer Directory & Due Tracking',
      'Expense Tracking & Reports',
    ],
    taxBreakdown: calculatePlanTax(2999),
  },
  {
    id: '6_months',
    name: '6 Months',
    durationDays: 180,
    durationMonths: 6,
    durationLabel: '180 Days Access',
    regularPrice: 5999,
    launchPrice: 5499,
    offerPrice: 5499,
    pricePerDay: calculatePricePerDay(5499, 180),
    savings: 500,
    discountPercentage: 8.33,
    savingsLabel: 'Save ₹500 (Offer Price)',
    popular: false,
    features: [
      'Everything in 3 Months',
      'Save ₹500 on half-year billing',
      'Multi-User Staff Roles (Biller/Supervisor)',
      'WhatsApp Receipt Sharing',
      'Priority Phone Support',
    ],
    taxBreakdown: calculatePlanTax(5499),
  },
  {
    id: '1_year',
    name: '12 Months',
    durationDays: 365,
    durationMonths: 12,
    durationLabel: '365 Days Access',
    regularPrice: 11999,
    launchPrice: 9999,
    offerPrice: 9999,
    pricePerDay: calculatePricePerDay(9999, 365),
    savings: 2000,
    discountPercentage: 16.67,
    savingsLabel: 'Save ₹2,000 (Offer Price) • BEST VALUE',
    popular: true,
    features: [
      'Best Value — Save ₹2,000 for full year',
      'Only ₹27 per day',
      'All Pro Features Included',
      'Automatic Cloud Backups',
      'Multi-Terminal Sync & Staff Management',
    ],
    taxBreakdown: calculatePlanTax(9999),
  },
];

export function isShopEligibleForLaunchOffer(
  shopCreatedAt?: string | null,
  now: Date = new Date()
): {
  isEligible: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  secondsRemaining: number;
  eligibleUntil: Date;
} {
  const regTimestamp = shopCreatedAt ? new Date(shopCreatedAt).getTime() : now.getTime();
  const validRegTime = isNaN(regTimestamp) ? now.getTime() : regTimestamp;
  const eligibleUntil = new Date(validRegTime + LAUNCH_OFFER_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const remainingMs = eligibleUntil.getTime() - now.getTime();
  const isEligible = remainingMs > 0;
  const secondsRemaining = Math.max(0, Math.floor(remainingMs / 1000));
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  return {
    isEligible,
    daysRemaining,
    hoursRemaining,
    secondsRemaining,
    eligibleUntil,
  };
}

export function getLaunchOfferPlanById(planId: string): LaunchOfferPlanConfig | undefined {
  return LAUNCH_OFFER_PLANS.find(p => p.id === planId);
}

export function getSubscriptionPlanById(planId: string): SubscriptionPlanConfig | undefined {
  if (planId === '1_month') {
    return {
      id: '1_month',
      name: '1 Month',
      durationMonths: 1,
      durationLabel: '1 Month',
      price: 499,
      normalPrice: 499,
      offerPrice: 499,
      monthlyEquivalent: 499,
      savings: 0,
      discountPercentage: 0,
      discountBadge: null,
      popular: false,
      features: ['Full Point of Sale & Billing'],
      taxBreakdown: calculatePlanTax(499),
    };
  }
  return SUBSCRIPTION_PLANS.find(p => p.id === planId);
}
