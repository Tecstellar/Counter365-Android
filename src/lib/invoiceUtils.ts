/**
 * Utility functions for generating shop invoice prefixes and formatting invoice numbers.
 */

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Generate default invoice prefix from shop name:
 * - Single word (e.g. "Raj"): first 3 chars or word uppercase (e.g. "RAJ")
 * - Two words (e.g. "Raj Stall"): first letter of each word ("RS")
 * - Three words (e.g. "Raj Tea Stall"): first letter of each word ("RTS")
 */
export function generateDefaultInvoicePrefix(shopName?: string): string {
  if (!shopName || !shopName.trim()) {
    return 'CP';
  }

  const clean = shopName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return 'CP';
  }

  if (words.length === 1) {
    const single = words[0].toUpperCase();
    return single.length <= 3 ? single : single.slice(0, 3);
  }

  // 2 or more words: take the first letter of each word (e.g. "Raj Tea Stall" -> "RTS", "Raj Stall" -> "RS")
  return words.map(w => w.charAt(0).toUpperCase()).join('');
}

/**
 * Formats invoice number according to reset cycle:
 * - monthly: e.g. "RTS-October-001"
 * - yearly:  e.g. "RTS-001"
 */
export function formatInvoiceNumber(
  prefix: string,
  cycle: 'monthly' | 'yearly',
  seqNumber: number,
  date: Date = new Date()
): string {
  const cleanPrefix = (prefix || 'CP').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CP';
  const paddedSeq = String(Math.max(1, seqNumber)).padStart(3, '0');

  if (cycle === 'monthly') {
    const monthName = FULL_MONTH_NAMES[date.getMonth()];
    return `${cleanPrefix}-${monthName}-${paddedSeq}`;
  }

  return `${cleanPrefix}-${paddedSeq}`;
}
