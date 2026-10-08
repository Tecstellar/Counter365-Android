import {
  formatRupee,
  formatRupeeWithDecimal,
  calculateGST,
  calculateLineTotal,
  calculateProfit,
  roundOffAmount,
} from '../src/lib/money';

describe('Money Utilities & Financial Precision', () => {
  test('formatRupee formats numbers correctly with Indian Rupee symbol and commas', () => {
    expect(formatRupee(8420)).toBe('₹8,420');
    expect(formatRupee(12)).toBe('₹12');
    expect(formatRupee(0)).toBe('₹0');
    expect(formatRupee(100000)).toBe('₹1,00,000');
    expect(formatRupee(42900)).toBe('₹42,900');
  });

  test('calculateGST calculates deterministic integer tax', () => {
    expect(calculateGST(100, 5)).toBe(5);
    expect(calculateGST(200, 5)).toBe(10);
    expect(calculateGST(15, 5)).toBe(1); // 0.75 rounded to 1
    expect(calculateGST(12, 5)).toBe(1); // 0.6 rounded to 1
    expect(calculateGST(0, 5)).toBe(0);
  });

  test('calculateLineTotal computes exact line totals', () => {
    expect(calculateLineTotal(12, 3)).toBe(36);
    expect(calculateLineTotal(150, 2)).toBe(300);
    expect(calculateLineTotal(25, 1)).toBe(25);
  });

  test('calculateProfit computes net profit deterministically', () => {
    expect(calculateProfit(8420, 3150)).toBe(5270);
    expect(calculateProfit(1000, 1000)).toBe(0);
    expect(calculateProfit(500, 700)).toBe(-200);
  });

  test('roundOffAmount rounds to nearest integer when enabled', () => {
    expect(roundOffAmount(149.6, true)).toBe(150);
    expect(roundOffAmount(149.2, true)).toBe(149);
    expect(roundOffAmount(149.6, false)).toBe(149.6);
  });
});
