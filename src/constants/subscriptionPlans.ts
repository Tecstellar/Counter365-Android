import { SubscriptionPlanId } from '../types/models';

export interface SubscriptionPlanConfig {
  id: SubscriptionPlanId;
  name: string;
  durationMonths: number;
  durationLabel: string;
  price: number;
  normalPrice: number;
  monthlyEquivalent: number;
  savings: number;
  discountPercentage: number;
  discountBadge: string | null;
  popular?: boolean;
  features: string[];
}

export const BASE_MONTHLY_RATE = 499;

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
 * 1-month plan removed per commercial specification.
 * 3-month plan priced at ₹1,499 (Preferred).
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: '3_months',
    name: '3 Months',
    durationMonths: 3,
    durationLabel: '3 Months',
    price: 1499,
    normalPrice: 1499,
    monthlyEquivalent: 499.67,
    savings: 0,
    discountPercentage: 0,
    discountBadge: 'PREFERRED',
    popular: true,
    features: [
      'Full Point of Sale & Billing',
      'Daily Closing & Cloud Sync',
      'Unlimited Menu Items',
      'Customer Directory & Due Tracking',
      'Expense Tracking & Reports',
    ],
  },
  {
    id: '6_months',
    name: '6 Months',
    durationMonths: 6,
    durationLabel: '6 Months',
    price: 2799,
    normalPrice: 2994,
    monthlyEquivalent: 466.5,
    savings: 195,
    discountPercentage: 3.9,
    discountBadge: 'SAVE 3.9%',
    popular: false,
    features: [
      'Everything in 3 Months',
      'Save ₹195 on half-year billing',
      'Multi-User Staff Roles (Biller/Supervisor)',
      'WhatsApp Receipt Sharing',
      'Priority Support',
    ],
  },
  {
    id: '1_year',
    name: '1 Year',
    durationMonths: 12,
    durationLabel: '12 Months',
    price: 4999,
    normalPrice: 5988,
    monthlyEquivalent: 416.58,
    savings: 989,
    discountPercentage: 16.52,
    discountBadge: 'SAVE 16.5%',
    popular: false,
    features: [
      'Best Value — Save ₹989 / year',
      'Only ₹416.58 per month',
      'All Pro Features Included',
      'Automatic Cloud Backups',
      'Multi-Terminal Sync & Staff Management',
    ],
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
  pricePerDay: number;
  savings: number;
  discountPercentage: number;
  savingsLabel: string | null;
  popular?: boolean;
  features: string[];
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
  },
  {
    id: '6_months',
    name: '6 Months',
    durationDays: 180,
    durationMonths: 6,
    durationLabel: '180 Days Access',
    regularPrice: 5999,
    launchPrice: 4799,
    pricePerDay: calculatePricePerDay(4799, 180),
    savings: 1200,
    discountPercentage: 20,
    savingsLabel: 'Save ₹1,200 (20% OFF)',
    popular: false,
    features: [
      'Everything in 3 Months',
      'Save ₹1,200 on half-year billing',
      'Multi-User Staff Roles (Biller/Supervisor)',
      'WhatsApp Receipt Sharing',
      'Priority Phone Support',
    ],
  },
  {
    id: '1_year',
    name: '12 Months',
    durationDays: 365,
    durationMonths: 12,
    durationLabel: '365 Days Access',
    regularPrice: 11999,
    launchPrice: 5999,
    pricePerDay: calculatePricePerDay(5999, 365),
    savings: 6000,
    discountPercentage: 50,
    savingsLabel: 'Save ₹6,000 (50% OFF) • BEST VALUE',
    popular: true,
    features: [
      'Best Value — 50% Savings for full year',
      'Only ₹16 per day',
      'All Pro Features Included',
      'Automatic Cloud Backups',
      'Multi-Terminal Sync & Staff Management',
    ],
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
      monthlyEquivalent: 499,
      savings: 0,
      discountPercentage: 0,
      discountBadge: null,
      popular: false,
      features: ['Full Point of Sale & Billing'],
    };
  }
  return SUBSCRIPTION_PLANS.find(p => p.id === planId);
}
