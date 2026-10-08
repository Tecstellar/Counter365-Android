import { reportService } from '../src/services/reportService';
import { Bill, ExpenseRecord } from '../src/types/models';

describe('Reports & Business Analytics Calculations (Real Data Only)', () => {
  const testBills: Bill[] = [
    {
      id: 'b1',
      shopId: 'shop_test',
      billNumber: '#0001',
      status: 'completed',
      subtotal: 100,
      gstRate: 5,
      gstAmount: 5,
      totalAmount: 105,
      paidAmount: 105,
      pendingAmount: 0,
      paymentMode: 'Cash',
      items: [
        { menuItemId: 'i1', itemName: 'Tea', isHalf: false, unitPrice: 12, quantity: 5, lineTotal: 60 },
        { menuItemId: 'i2', itemName: 'Samosa', isHalf: false, unitPrice: 15, quantity: 3, lineTotal: 45 },
      ],
      createdAt: '2026-09-03T10:00:00.000Z',
      completedAt: '2026-09-03T10:01:00.000Z',
    },
    {
      id: 'b2',
      shopId: 'shop_test',
      billNumber: '#0002',
      status: 'completed',
      subtotal: 200,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: 200,
      paidAmount: 200,
      pendingAmount: 0,
      paymentMode: 'GPay',
      items: [
        { menuItemId: 'i1', itemName: 'Tea', isHalf: false, unitPrice: 12, quantity: 10, lineTotal: 120 },
        { menuItemId: 'i3', itemName: 'Vada', isHalf: false, unitPrice: 10, quantity: 8, lineTotal: 80 },
      ],
      createdAt: '2026-09-03T14:30:00.000Z',
      completedAt: '2026-09-03T14:31:00.000Z',
    },
  ];

  const testExpenses: ExpenseRecord[] = [
    {
      id: 'e1',
      shopId: 'shop_test',
      description: 'Milk 10L',
      amount: 50,
      expenseDate: '2026-09-03',
      createdAt: '2026-09-03T06:00:00.000Z',
    },
  ];

  test('calculates monthly report strictly from real bills and expenses', () => {
    const report = reportService.getMonthlyReport(2026, 8, testBills, testExpenses);

    expect(report.totalSales).toBe(305);
    expect(report.totalExpenses).toBe(50);
    expect(report.profit).toBe(255);
    expect(report.billsCount).toBe(2);

    // Top item should be Tea (60 + 120 = 180)
    expect(report.topItems[0].name).toBe('Tea');
    expect(report.topItems[0].amount).toBe(180);
    expect(report.topItems[0].quantity).toBe(15);
  });

  test('returns clean zero metrics when database contains no bills', () => {
    const emptyReport = reportService.getMonthlyReport(2026, 8, [], []);

    expect(emptyReport.totalSales).toBe(0);
    expect(emptyReport.totalExpenses).toBe(0);
    expect(emptyReport.profit).toBe(0);
    expect(emptyReport.billsCount).toBe(0);
    expect(emptyReport.topItems.length).toBe(0);
  });

  test('generates real day closing report from today bills and expenses', () => {
    const dayClosing = reportService.getDayClosingReport(
      'Test Tea Stall',
      'Main Road',
      '98404 00000',
      'Tea Shop',
      50,
      testBills
    );

    expect(dayClosing.totalSales).toBe(305);
    expect(dayClosing.cashSales).toBe(105);
    expect(dayClosing.gpaySales).toBe(200);
    expect(dayClosing.totalExpenses).toBe(50);
    expect(dayClosing.netProfit).toBe(255);
    expect(dayClosing.billsCount).toBe(2);
  });

  test('only counts collected paidAmount into sales until pending balance is settled', () => {
    const partialBill: Bill = {
      id: 'b_part',
      shopId: 'shop_test',
      billNumber: '#0003',
      status: 'completed',
      subtotal: 30,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: 30,
      paidAmount: 15,
      pendingAmount: 15,
      paymentMode: 'Partial Pay',
      items: [
        { menuItemId: 'i1', itemName: 'Tea', isHalf: false, unitPrice: 15, quantity: 2, lineTotal: 30 },
      ],
      createdAt: '2026-09-03T11:00:00.000Z',
      completedAt: '2026-09-03T11:01:00.000Z',
    };

    const pendingBill: Bill = {
      id: 'b_pend',
      shopId: 'shop_test',
      billNumber: '#0004',
      status: 'completed',
      subtotal: 30,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: 30,
      paidAmount: 0,
      pendingAmount: 30,
      paymentMode: 'Pending',
      items: [
        { menuItemId: 'i1', itemName: 'Tea', isHalf: false, unitPrice: 15, quantity: 2, lineTotal: 30 },
      ],
      createdAt: '2026-09-03T12:00:00.000Z',
      completedAt: '2026-09-03T12:01:00.000Z',
    };

    // Initially: partialBill has paid 15, pendingBill has paid 0 -> total collected sales = 15
    const initialReport = reportService.getMonthlyReport(2026, 8, [partialBill, pendingBill], []);
    expect(initialReport.totalSales).toBe(15);

    // After customer settles the remaining 15 on partialBill -> paidAmount becomes 30
    const settledBill: Bill = {
      ...partialBill,
      paidAmount: 30,
      pendingAmount: 0,
    };

    const settledReport = reportService.getMonthlyReport(2026, 8, [settledBill, pendingBill], []);
    expect(settledReport.totalSales).toBe(30);
  });
});
