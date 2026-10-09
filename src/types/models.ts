export type ShopType = 'Tea Shop' | 'Cafe' | 'Fast Food' | 'Tiffin Shop' | 'Restaurant';

export type UserRole = 'Owner' | 'Supervisor' | 'Biller';

export type PermissionKey = 'bill' | 'total' | 'exp' | 'pend' | 'report' | 'menu' | 'users' | 'subscription';

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl?: string | null;
}

export interface Shop {
  id: string;
  name: string;
  shopType: ShopType;
  phone: string;
  email?: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  logoUrl?: string | null;
  currencyCode: string;
  timezone: string;
  gstEnabled: boolean;
  gstRate: number;
  gstNumber?: string | null;
  roundOffEnabled: boolean;
  dailyBackupEnabled: boolean;
  printerEnabled: boolean;
  printerName?: string | null;
  tableManagementEnabled?: boolean;
  tableCount?: number;
  maxStaffLimit?: number;
  ownerName?: string;
  invoicePrefix?: string;
  invoiceResetCycle?: 'monthly' | 'yearly';
  totalBillsCreated?: number;
  upiId?: string | null;
  createdAt?: string;
}

export interface ShopMember {
  id: string;
  shopId: string;
  userId: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  overrides?: Partial<Record<PermissionKey, boolean>>;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  deactivationReason?: string | null;
}

export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number;
  halfPrice?: number;
  hasHalf: boolean;
  isFavorite: boolean;
  isAvailable: boolean;
  imageUrl?: string | null;
  imagePrompt?: string | null;
  imageStatus?: 'pending' | 'generating' | 'completed' | 'failed' | null;
  costPrice?: number | null;
  sortOrder: number;
}

export interface MenuCategory {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CartItem {
  key: string; // e.g. `${itemId}|full` or `${itemId}|half`
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isHalf: boolean;
  lineTotal: number;
}

export type PaymentMethod = 'Cash' | 'GPay' | 'Pending' | 'Partial Pay' | 'Cash + GPay' | 'Split';

export interface Bill {
  id: string;
  shopId: string;
  billNumber: string; // '#0042'
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  status: 'draft' | 'completed' | 'cancelled' | 'refunded' | 'edited' | 'deleted';
  subtotal: number;
  originalSubtotal?: number;
  originalTotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  discountAppliedBy?: string | null;
  discountApprovedBy?: string | null;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  cashAmount?: number;
  gpayAmount?: number;
  paymentMode: PaymentMethod;
  clientOperationId?: string | null;
  items: BillItemRecord[];
  createdAt: string;
  completedAt: string;
  settledAt?: string | null;
  initialPaidAmount?: number;
  collections?: BillPaymentCollection[];
  createdByName?: string | null;
  createdByRole?: UserRole | string | null;
  createdById?: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
  editedByName?: string | null;
  editedByRole?: UserRole | string | null;
  editedById?: string | null;
  isDeleted?: boolean;
  isCancelled?: boolean;
  deletedAt?: string | null;
  deletedByName?: string | null;
  deletedByRole?: UserRole | string | null;
  deletedById?: string | null;
  cancellationReason?: string | null;
}

export interface BillPaymentCollection {
  id: string;
  amount: number;
  paymentMode: PaymentMethod;
  paidAt: string;
  receivedByName?: string | null;
  receivedById?: string | null;
}

export interface BillItemRecord {
  id?: string;
  menuItemId?: string | null;
  itemName: string;
  isHalf: boolean;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PendingPaymentRecord {
  id: string;
  shopId: string;
  billId: string;
  billNumber: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  amountDue: number;
  amountPaid: number;
  ageDescription: string;
  status: 'open' | 'settled' | 'cancelled';
  bills: Array<{ billNumber: string; date: string; amount: number }>;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  shopId: string;
  description: string;
  amount: number;
  category?: string;
  paymentMode?: 'Cash' | 'GPay' | string;
  expenseDate: string;
  vendorId?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CustomerRecord {
  id: string;
  shopId: string;
  name: string;
  phone?: string | null;
  location?: string | null;
  notes?: string | null;
  totalBills: number;
  pendingBalance: number;
  statusTag?: 'MVP' | 'Regular' | 'Pending';
  isActive?: boolean;
  isVip?: boolean;
}

export interface VendorRecord {
  id: string;
  shopId: string;
  name: string;
  phone?: string | null;
  supplyType: string;
  location?: string | null;
  schedule?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface DayClosingReport {
  date: string;
  shopTitle: string;
  shopAddress: string;
  phone: string;
  totalSales: number;
  cashSales: number;
  gpaySales: number;
  pendingSales: number;
  totalExpenses: number;
  netProfit: number;
  billsCount: number;
  hoursNote: string;
}

export interface MonthlyReportData {
  month: number; // 0..11
  year: number;
  monthLabel: string;
  monthShort: string;
  rangeLabel: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  profitMarginPct: number;
  billsCount: number;
  bestDay: { day: number; dow: string; profit: number };
  weeks: Array<{
    name: string;
    detail: string;
    sales: number;
    expenses: number;
    profit: number;
    salePct: string;
    expPct: string;
  }>;
  paymentModes: Array<{
    name: string;
    pct: string;
    amount: number;
    color: string;
  }>;
  days: Array<{
    dayNumber: number;
    dateFormatted: string;
    dayOfWeek: string;
    isWeekend: boolean;
    isToday: boolean;
    sales: number;
    expenses: number;
    profit: number;
  }>;
  topItems: Array<{
    rank: number;
    name: string;
    quantity: number;
    amount: number;
    pct: string;
  }>;
}

export interface SyncQueueItem {
  id: string;
  operationId: string; // UUID
  shopId: string;
  action: 'create_bill' | 'add_expense' | 'clear_pending' | 'update_menu' | 'add_customer' | 'add_vendor';
  payload: any;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  attempts: number;
  lastError?: string | null;
  createdAt: string;
}

export interface AccountDeletionRecord {
  id?: string;
  userId?: string | null;
  shopId: string;
  shopName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  reason: string;
  feedback?: string | null;
  deletedAt?: string;
}

export type SubscriptionPlanId = '1_month' | '3_months' | '6_months' | '1_year' | 'free' | 'pro';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';

export interface SubscriptionRecord {
  id: string;
  shopId: string;
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  amount: number;
  interval: string;
  trialStartAt?: string | null;
  trialEndAt?: string | null;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  activatedByAdminId?: string | null;
  adminNotes?: string | null;
  cashfreeOrderId?: string | null;
  currency?: string | null;
  durationMonths?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatusInfo {
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isPaidActive: boolean;
  isPaidExpired: boolean;
  hasAccess: boolean;
  requiresSubscription: boolean;
  dayOfTrial: number; // 1..30 (or bill progress)
  daysRemaining: number;
  progressPercent: number; // 0..100
  trialStartDate: Date;
  trialEndDate: Date;
  trialEndDateFormatted: string;
  activePlanName: string;
  activePlanPrice: number;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  subscriptionEndDateFormatted?: string;
  totalBillsCreated: number;
  billsLimit: number;
  billsRemaining: number;
  billLimitReached: boolean;
}
