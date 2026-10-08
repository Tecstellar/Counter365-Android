import { ShopType } from '../types/models';

export interface ExpensePreset {
  label: string;
  icon: string;
  category: string;
}

export const EXPENSE_PRESETS_BY_SHOP_TYPE: Record<ShopType, ExpensePreset[]> = {
  'Tea Shop': [
    { label: 'Milk (ஆவின் பால் / Dairy)', icon: '🥛', category: 'Dairy' },
    { label: 'Tea Powder & Coffee', icon: '🍃', category: 'Raw Materials' },
    { label: 'Sugar & Groceries', icon: '🧂', category: 'Provisions' },
    { label: 'Paper Cups & Disposables', icon: '🥤', category: 'Packaging' },
    { label: 'LPG Gas Cylinder', icon: '🔥', category: 'Fuel' },
    { label: 'Biscuits, Samosa & Snacks', icon: '🍪', category: 'Bakery' },
    { label: 'Lemons, Ginger & Mint', icon: '🍋', category: 'Vegetables' },
    { label: 'Ice Blocks', icon: '🧊', category: 'Utilities' },
    { label: 'Cleaning & Dishwash', icon: '🧹', category: 'Maintenance' },
    { label: 'Daily Staff Wages', icon: '👨‍🍳', category: 'Salary' },
    { label: 'Electricity / Rent', icon: '💡', category: 'Overheads' },
  ],
  'Cafe': [
    { label: 'Milk & Fresh Cream', icon: '🥛', category: 'Dairy' },
    { label: 'Coffee Beans & Roasts', icon: '☕', category: 'Raw Materials' },
    { label: 'Syrups, Flavor & Cocoa', icon: '🍫', category: 'Ingredients' },
    { label: 'Cups, Straws & Lids', icon: '🥤', category: 'Packaging' },
    { label: 'Bakery & Pastries', icon: '🥐', category: 'Bakery' },
    { label: 'LPG Gas / Power', icon: '🔥', category: 'Fuel' },
    { label: 'Fruits & Blends', icon: '🍓', category: 'Ingredients' },
    { label: 'Cleaning Supplies', icon: '🧹', category: 'Maintenance' },
    { label: 'Daily Staff Wages', icon: '👨‍🍳', category: 'Salary' },
    { label: 'Electricity / Rent', icon: '💡', category: 'Overheads' },
  ],
  'Tiffin Shop': [
    { label: 'Milk, Curd & Butter', icon: '🥛', category: 'Dairy' },
    { label: 'Rice, Flour & Dals', icon: '🍚', category: 'Provisions' },
    { label: 'Vegetables & Onions', icon: '🧅', category: 'Vegetables' },
    { label: 'Cooking Oil & Ghee', icon: '🛢️', category: 'Provisions' },
    { label: 'LPG Gas Cylinder', icon: '🔥', category: 'Fuel' },
    { label: 'Spices & Groceries', icon: '🌶️', category: 'Provisions' },
    { label: 'Parcel Covers & Containers', icon: '📦', category: 'Packaging' },
    { label: 'Daily Staff Wages', icon: '👨‍🍳', category: 'Salary' },
    { label: 'Cleaning & Water Can', icon: '🧹', category: 'Maintenance' },
  ],
  'Fast Food': [
    { label: 'Cooking Oil & Sauces', icon: '🛢️', category: 'Provisions' },
    { label: 'Chicken / Eggs / Meat', icon: '🍗', category: 'Meat & Poultry' },
    { label: 'Vegetables & Onions', icon: '🥬', category: 'Vegetables' },
    { label: 'Noodles, Breads & Buns', icon: '🍔', category: 'Bakery' },
    { label: 'LPG Commercial Gas', icon: '🔥', category: 'Fuel' },
    { label: 'Packaging & Foil', icon: '📦', category: 'Packaging' },
    { label: 'Soft Drinks & Ice', icon: '🥤', category: 'Beverages' },
    { label: 'Daily Staff Wages', icon: '👨‍🍳', category: 'Salary' },
    { label: 'Cleaning Supplies', icon: '🧹', category: 'Maintenance' },
  ],
  'Restaurant': [
    { label: 'Vegetables & Greens', icon: '🥦', category: 'Vegetables' },
    { label: 'Milk, Paneer & Dairy', icon: '🥛', category: 'Dairy' },
    { label: 'Rice, Atta & Provisions', icon: '🍚', category: 'Provisions' },
    { label: 'Chicken, Mutton & Seafood', icon: '🍗', category: 'Meat & Seafood' },
    { label: 'Cooking Oil, Ghee & Spices', icon: '🛢️', category: 'Provisions' },
    { label: 'Commercial Gas Cylinder', icon: '🔥', category: 'Fuel' },
    { label: 'Packaging & Containers', icon: '📦', category: 'Packaging' },
    { label: 'Beverages & Ice', icon: '🧊', category: 'Beverages' },
    { label: 'Staff Salaries / Wages', icon: '👨‍🍳', category: 'Salary' },
    { label: 'Cleaning & Maintenance', icon: '🧹', category: 'Maintenance' },
  ],
};

export const DEFAULT_EXPENSE_PRESETS: ExpensePreset[] = [
  { label: 'Milk / Dairy', icon: '🥛', category: 'Dairy' },
  { label: 'Tea / Coffee Powder', icon: '🍃', category: 'Raw Materials' },
  { label: 'Groceries / Provisions', icon: '🧂', category: 'Provisions' },
  { label: 'Vegetables', icon: '🥬', category: 'Vegetables' },
  { label: 'LPG Gas Cylinder', icon: '🔥', category: 'Fuel' },
  { label: 'Disposables & Packaging', icon: '🥤', category: 'Packaging' },
  { label: 'Daily Staff Wages', icon: '👨‍🍳', category: 'Salary' },
  { label: 'Cleaning / Dishwash', icon: '🧹', category: 'Maintenance' },
  { label: 'Electricity / Rent', icon: '💡', category: 'Overheads' },
];

export function getExpensePresetsForShopType(shopType?: ShopType | null): ExpensePreset[] {
  if (shopType && EXPENSE_PRESETS_BY_SHOP_TYPE[shopType]) {
    return EXPENSE_PRESETS_BY_SHOP_TYPE[shopType];
  }
  return DEFAULT_EXPENSE_PRESETS;
}
