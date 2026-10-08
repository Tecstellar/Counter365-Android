/**
 * Deterministic Indian Rupee (₹) Money Representation & Formatting
 */

export const formatRupee = (amount: number): string => {
  const rounded = Math.round(amount);
  return '\u20B9' + rounded.toLocaleString('en-IN');
};

export const formatRupeeWithDecimal = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const calculateGST = (subtotal: number, ratePct: number = 5): number => {
  return Math.round((subtotal * ratePct) / 100);
};

export const calculateLineTotal = (unitPrice: number, quantity: number): number => {
  return Math.round(unitPrice * quantity);
};

export const calculateProfit = (sales: number, expenses: number): number => {
  return Math.round(sales - expenses);
};

export const roundOffAmount = (amount: number, enabled: boolean = true): number => {
  return enabled ? Math.round(amount) : amount;
};
