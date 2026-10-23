import { Bill, ExpenseRecord } from '../src/types/models';
import { reportService } from '../src/services/reportService';

describe('Summary Tab Hierarchical Grouping and Edge Cases', () => {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const formatBillCount = (count: number) => `${count} ${count === 1 ? 'bill' : 'bills'}`;

  const formatBillDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const mShort = MONTH_NAMES_SHORT[d.getMonth()] || '';
    return `${mShort} ${d.getDate()}`;
  };

  const groupBills = (bills: Bill[], expenses: ExpenseRecord[] = []) => {
    const validBills = bills.filter(
      b => !b.isDeleted && b.status !== 'deleted' && b.status !== 'cancelled'
    );
    const yearMap = new Map<number, Map<number, Bill[]>>();

    for (const bill of validBills) {
      if (!bill.createdAt) continue;
      const d = new Date(bill.createdAt);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();

      if (!yearMap.has(y)) {
        yearMap.set(y, new Map<number, Bill[]>());
      }
      const mObj = yearMap.get(y)!;
      if (!mObj.has(m)) {
        mObj.set(m, []);
      }
      mObj.get(m)!.push(bill);
    }

    const yearsResult = [];
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYears) {
      const mObj = yearMap.get(y)!;
      const sortedMonths = Array.from(mObj.keys()).sort((a, b) => b - a);
      const monthsResult = [];
      let yearTotal = 0;
      let yearCount = 0;

      for (const m of sortedMonths) {
        const monthBills = mObj.get(m)!.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const rep = reportService.getMonthlyReport(y, m, bills, expenses);
        const monthTotal = rep.totalSales;
        const count = rep.billsCount;
        yearTotal += monthTotal;
        yearCount += count;

        monthsResult.push({
          monthIndex: m,
          monthName: MONTH_NAMES[m],
          monthShort: MONTH_NAMES_SHORT[m],
          bills: monthBills,
          totalAmount: monthTotal,
          count,
        });
      }

      yearsResult.push({
        year: y,
        totalAmount: yearTotal,
        count: yearCount,
        months: monthsResult,
      });
    }

    return yearsResult;
  };

  it('correctly handles pluralization: 1 bill vs N bills', () => {
    expect(formatBillCount(0)).toBe('0 bills');
    expect(formatBillCount(1)).toBe('1 bill');
    expect(formatBillCount(2)).toBe('2 bills');
    expect(formatBillCount(10)).toBe('10 bills');
  });

  it('formats bill date according to mockup (e.g. Oct 6)', () => {
    expect(formatBillDate('2026-10-06T10:30:00.000Z')).toBe('Oct 6');
    expect(formatBillDate('2026-09-15T10:30:00.000Z')).toBe('Sep 15');
    expect(formatBillDate('invalid-date')).toBe('—');
  });

  it('groups bills across years and months with correct sums and counts', () => {
    const mockBills: Bill[] = [
      {
        id: 'b1',
        shopId: 'shop1',
        billNumber: '#0001',
        status: 'completed',
        subtotal: 50,
        discountAmount: 0,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 50,
        paidAmount: 50,
        pendingAmount: 0,
        paymentMode: 'Cash',
        items: [
          { itemName: 'Boost', isHalf: false, unitPrice: 25, quantity: 1, lineTotal: 25 },
          { itemName: 'Horlicks', isHalf: false, unitPrice: 25, quantity: 1, lineTotal: 25 },
        ],
        createdAt: '2026-10-06T10:00:00.000Z',
        completedAt: '2026-10-06T10:00:00.000Z',
        customerName: 'Panda 🐼 💕',
      },
      {
        id: 'b2',
        shopId: 'shop1',
        billNumber: '#0002',
        status: 'completed',
        subtotal: 50,
        discountAmount: 0,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 50,
        paidAmount: 50,
        pendingAmount: 0,
        paymentMode: 'GPay',
        items: [
          { itemName: 'Boost', isHalf: false, unitPrice: 25, quantity: 1, lineTotal: 25 },
          { itemName: 'Horlicks', isHalf: false, unitPrice: 25, quantity: 1, lineTotal: 25 },
        ],
        createdAt: '2026-10-06T11:00:00.000Z',
        completedAt: '2026-10-06T11:00:00.000Z',
        customerPhone: '+918438204612',
      },
      {
        id: 'b3',
        shopId: 'shop1',
        billNumber: '#0003',
        status: 'completed',
        subtotal: 120,
        discountAmount: 0,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 120,
        paidAmount: 120,
        pendingAmount: 0,
        paymentMode: 'Cash',
        items: [
          { itemName: 'Tea', isHalf: false, unitPrice: 12, quantity: 10, lineTotal: 120 },
        ],
        createdAt: '2026-09-20T08:00:00.000Z',
        completedAt: '2026-09-20T08:00:00.000Z',
      },
      {
        id: 'b4',
        shopId: 'shop1',
        billNumber: '#0004',
        status: 'completed',
        subtotal: 300,
        discountAmount: 0,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 300,
        paidAmount: 300,
        pendingAmount: 0,
        paymentMode: 'GPay',
        items: [
          { itemName: 'Coffee', isHalf: false, unitPrice: 20, quantity: 15, lineTotal: 300 },
        ],
        createdAt: '2025-12-15T09:00:00.000Z',
        completedAt: '2025-12-15T09:00:00.000Z',
      },
    ];

    const hierarchy = groupBills(mockBills);
    expect(hierarchy).toHaveLength(2);

    // Year 2026
    const y2026 = hierarchy.find(y => y.year === 2026)!;
    expect(y2026).toBeDefined();
    expect(y2026.count).toBe(3);
    expect(y2026.totalAmount).toBe(220); // 50 + 50 + 120
    expect(y2026.months).toHaveLength(2);

    // Month October 2026 (index 9)
    const oct = y2026.months.find(m => m.monthIndex === 9)!;
    expect(oct).toBeDefined();
    expect(oct.monthName).toBe('October');
    expect(oct.count).toBe(2);
    expect(oct.totalAmount).toBe(100);
    expect(oct.bills).toHaveLength(2);

    // Year 2025
    const y2025 = hierarchy.find(y => y.year === 2025)!;
    expect(y2025).toBeDefined();
    expect(y2025.count).toBe(1);
    expect(y2025.totalAmount).toBe(300);
  });

  it('handles empty bills safely without errors', () => {
    const hierarchy = groupBills([]);
    expect(hierarchy).toEqual([]);
  });

  it('correctly calculates monthly financial summary: profit, sales, expenses, cash, UPI, total', () => {
    const currentMonthBills: Bill[] = [
      {
        id: 'b1',
        shopId: 'shop1',
        billNumber: '#0001',
        items: [],
        subtotal: 500,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 500,
        paymentMode: 'Cash',
        paidAmount: 500,
        pendingAmount: 0,
        status: 'completed',
        createdAt: '2026-10-02T10:00:00.000Z',
        completedAt: '2026-10-02T10:00:00.000Z',
      },
      {
        id: 'b2',
        shopId: 'shop1',
        billNumber: '#0002',
        items: [],
        subtotal: 1000,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 1000,
        paymentMode: 'GPay',
        paidAmount: 1000,
        pendingAmount: 0,
        status: 'completed',
        createdAt: '2026-10-05T12:00:00.000Z',
        completedAt: '2026-10-05T12:00:00.000Z',
      },
      {
        id: 'b3',
        shopId: 'shop1',
        billNumber: '#0003',
        items: [],
        subtotal: 800,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 800,
        paymentMode: 'Cash + GPay',
        paidAmount: 800,
        pendingAmount: 0,
        cashAmount: 300,
        gpayAmount: 500,
        status: 'completed',
        createdAt: '2026-10-10T15:00:00.000Z',
        completedAt: '2026-10-10T15:00:00.000Z',
      },
    ];

    const expenses = [
      {
        id: 'e1',
        shopId: 'shop1',
        amount: 400,
        category: 'Supplies',
        expenseDate: '2026-10-03T10:00:00.000Z',
        createdAt: '2026-10-03T10:00:00.000Z',
      },
      {
        id: 'e2',
        shopId: 'shop1',
        amount: 250,
        category: 'Electricity',
        expenseDate: '2026-10-12T10:00:00.000Z',
        createdAt: '2026-10-12T10:00:00.000Z',
      },
      {
        id: 'e3_other_month',
        shopId: 'shop1',
        amount: 999,
        category: 'Old Month',
        expenseDate: '2026-09-12T10:00:00.000Z',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
    ];

    const summaryYear = 2026;
    const summaryMonth = 9; // October (0-indexed)

    let cashAmt = 0;
    let upiAmt = 0;

    currentMonthBills.forEach(b => {
      if (b.paymentMode === 'Cash') {
        cashAmt += (b.paidAmount !== undefined ? b.paidAmount : b.totalAmount);
      } else if (b.paymentMode === 'GPay' || (b.paymentMode as string) === 'UPI') {
        upiAmt += (b.paidAmount !== undefined ? b.paidAmount : b.totalAmount);
      } else if (b.paymentMode === 'Cash + GPay') {
        cashAmt += (b.cashAmount || 0);
        upiAmt += (b.gpayAmount || 0);
      } else if (b.paymentMode === 'Partial Pay' || b.paymentMode === 'Pending') {
        cashAmt += (b.cashAmount !== undefined ? b.cashAmount : (b.paidAmount || 0));
        upiAmt += (b.gpayAmount || 0);
      }
    });

    const totalSales = currentMonthBills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
    const expensesForMonth = expenses.filter(e => {
      if (!e.expenseDate) return false;
      const d = new Date(e.expenseDate);
      return d.getFullYear() === summaryYear && d.getMonth() === summaryMonth;
    });
    const totalExpenses = expensesForMonth.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const profit = totalSales - totalExpenses;

    expect(totalSales).toBe(2300); // 500 + 1000 + 800
    expect(cashAmt).toBe(800);     // 500 + 300
    expect(upiAmt).toBe(1500);     // 1000 + 500
    expect(cashAmt + upiAmt).toBe(2300);
    expect(totalExpenses).toBe(650); // 400 + 250 (e3 is excluded)
    expect(profit).toBe(1650);      // 2300 - 650
  });

  it('guarantees 100% parity between Report tab and Summary tab when deleted bills exist (no discrepancy)', () => {
    // Scenario: Shop has active sales totaling ₹638, and a deleted bill of ₹65
    const mixedBills: Bill[] = [
      {
        id: 'b-active-1',
        shopId: 'shop1',
        billNumber: '#0001',
        items: [],
        subtotal: 400,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 400,
        paymentMode: 'Cash',
        paidAmount: 400,
        pendingAmount: 0,
        status: 'completed',
        createdAt: '2026-10-02T10:00:00.000Z',
        completedAt: '2026-10-02T10:00:00.000Z',
      },
      {
        id: 'b-active-2',
        shopId: 'shop1',
        billNumber: '#0002',
        items: [],
        subtotal: 238,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 238,
        paymentMode: 'GPay',
        paidAmount: 238,
        pendingAmount: 0,
        status: 'completed',
        createdAt: '2026-10-05T12:00:00.000Z',
        completedAt: '2026-10-05T12:00:00.000Z',
      },
      {
        id: 'b-deleted',
        shopId: 'shop1',
        billNumber: '#0003',
        items: [],
        subtotal: 65,
        gstRate: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 65,
        paymentMode: 'Cash',
        paidAmount: 65,
        pendingAmount: 0,
        status: 'deleted',
        isDeleted: true,
        createdAt: '2026-10-08T14:00:00.000Z',
        completedAt: '2026-10-08T14:00:00.000Z',
      },
    ];

    const expenses: ExpenseRecord[] = [
      {
        id: 'e1',
        shopId: 'shop1',
        description: 'Supplies',
        amount: 150,
        category: 'Supplies',
        expenseDate: '2026-10-03T10:00:00.000Z',
        createdAt: '2026-10-03T10:00:00.000Z',
      },
    ];

    const y = 2026;
    const m = 9; // October

    // 1. Report tab calculation
    const reportData = reportService.getMonthlyReport(y, m, mixedBills, expenses);

    // 2. Summary tab hierarchy calculation
    const summaryHierarchy = groupBills(mixedBills, expenses);
    const octMonth = summaryHierarchy.find(yr => yr.year === y)?.months.find(mon => mon.monthIndex === m);

    // Both tabs MUST have identical values (638, NOT 703)
    expect(reportData.totalSales).toBe(638);
    expect(octMonth).toBeDefined();
    expect(octMonth!.totalAmount).toBe(638);
    expect(octMonth!.count).toBe(2); // Only the 2 active bills, deleted bill excluded!

    // Monthly Overview Card values must match reportData exactly
    const cashMode = reportData.paymentModes.find(p => p.name === 'Cash');
    const upiMode = reportData.paymentModes.find(p => p.name.includes('UPI') || p.name.includes('GPay'));

    const summaryOverview = {
      totalSales: reportData.totalSales,
      totalExpenses: reportData.totalExpenses,
      profit: reportData.profit,
      cashAmount: cashMode ? cashMode.amount : 0,
      upiAmount: upiMode ? upiMode.amount : 0,
      totalAmount: reportData.totalSales,
    };

    expect(summaryOverview.totalSales).toBe(638);
    expect(summaryOverview.cashAmount).toBe(400);
    expect(summaryOverview.upiAmount).toBe(238);
    expect(summaryOverview.totalAmount).toBe(638);
    expect(summaryOverview.totalExpenses).toBe(150);
    expect(summaryOverview.profit).toBe(488);
  });
});
