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
