export type AppRoute =
  | 'splash'
  | 'intro'
  | 'onb_phone'
  | 'onb_otp'
  | 'onb_shop'
  | 'onb_kind'
  | 'onb_success'
  | 'home'
  | 'sales'
  | 'bills'
  | 'reports'
  | 'pending'
  | 'contacts'
  | 'account'
  | 'support';

export type SalesSubView = 'menu' | 'bill' | 'editor';

export type ReportsTab = 'Summary' | 'Day-wise';

export type PendingFilter = 'All' | 'Tracked' | 'No number';

export type ContactsTab = 'Customers' | 'Vendors';
