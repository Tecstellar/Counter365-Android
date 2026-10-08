import { billingService } from '../src/services/billingService';
import { CartItem } from '../src/types/models';

jest.setTimeout(20000);

describe('Billing Service & Financial Transactions', () => {
  test('creates completed bill with correct item snapshots and subtotal', async () => {
    const mockCart: CartItem[] = [
      {
        key: 'item_1|full',
        itemId: 'item_1',
        name: 'Tea',
        unitPrice: 12,
        quantity: 2,
        isHalf: false,
        lineTotal: 24,
      },
      {
        key: 'item_2|half',
        itemId: 'item_2',
        name: 'Vada — half',
        unitPrice: 7,
        quantity: 1,
        isHalf: true,
        lineTotal: 7,
      },
    ];

    const result = await billingService.createBill({
      shopId: 'shop_test',
      cart: mockCart,
      paymentMode: 'Cash',
      gstEnabled: false,
    });

    expect(result.bill).toBeDefined();
    expect(result.bill.subtotal).toBe(31);
    expect(result.bill.totalAmount).toBe(31);
    expect(result.bill.paidAmount).toBe(31);
    expect(result.bill.pendingAmount).toBe(0);
    expect(result.bill.items.length).toBe(2);
    expect(result.bill.items[0].itemName).toBe('Tea');
    expect(result.bill.items[1].isHalf).toBe(true);
  });

  test('creates pending bill with correct pending allocation', async () => {
    const mockCart: CartItem[] = [
      {
        key: 'item_1|full',
        itemId: 'item_1',
        name: 'Strong Tea',
        unitPrice: 15,
        quantity: 4,
        isHalf: false,
        lineTotal: 60,
      },
    ];

    const result = await billingService.createBill({
      shopId: 'shop_test',
      cart: mockCart,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Kumar (Shop 4)',
      customerPhone: '90032 88110',
    });

    expect(result.bill.totalAmount).toBe(60);
    expect(result.bill.paidAmount).toBe(0);
    expect(result.bill.pendingAmount).toBe(60);
    expect(result.bill.customerName).toBe('Kumar (Shop 4)');

    const pendingList = await billingService.getPendingPayments('shop_test');
    const kumarPending = pendingList.find(p => p.customerName === 'Kumar (Shop 4)');
    expect(kumarPending).toBeDefined();

    // Clear pending using billId or id (even with pend_ prefix)
    const afterClear = await billingService.clearPendingPayment('shop_test', kumarPending!.id);
    expect(afterClear.some(p => p.billId === result.bill.id)).toBe(false);

    // Verify bill was updated to paid
    const bills = await billingService.getBills('shop_test');
    const updated = bills.find(b => b.id === result.bill.id);
    expect(updated?.paidAmount).toBe(60);
    expect(updated?.pendingAmount).toBe(0);
    expect(updated?.settledAt).toBeDefined();
  });

  test('clears pending payment of 18 rupees and reflects in sales correctly', async () => {
    const mockCart: CartItem[] = [
      {
        key: 'item_3|full',
        itemId: 'item_3',
        name: 'Samosa',
        unitPrice: 18,
        quantity: 1,
        isHalf: false,
        lineTotal: 18,
      },
    ];

    const result = await billingService.createBill({
      shopId: 'shop_test_18',
      cart: mockCart,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Ravi',
      customerPhone: '98765 43210',
    });

    expect(result.bill.totalAmount).toBe(18);
    expect(result.bill.pendingAmount).toBe(18);
    expect(result.bill.paidAmount).toBe(0);

    const pendingBefore = await billingService.getPendingPayments('shop_test_18');
    const raviPending = pendingBefore.find(p => p.customerName === 'Ravi');
    expect(raviPending).toBeDefined();
    expect(raviPending?.amountDue).toBe(18);

    // Clear the pending payment
    const pendingAfter = await billingService.clearPendingPayment('shop_test_18', raviPending!.id);
    expect(pendingAfter.some(p => p.customerName === 'Ravi')).toBe(false);

    const bills = await billingService.getBills('shop_test_18');
    const clearedBill = bills.find(b => b.id === result.bill.id);
    expect(clearedBill?.paidAmount).toBe(18);
    expect(clearedBill?.pendingAmount).toBe(0);
    expect(clearedBill?.settledAt).toBeDefined();
  });

  test('supports partial due clearance where remaining amount stays due and collected amount is recorded', async () => {
    const mockCart: CartItem[] = [
      {
        key: 'item_meal|full',
        itemId: 'item_meal',
        name: 'Lunch Thali',
        unitPrice: 250,
        quantity: 2,
        isHalf: false,
        lineTotal: 500,
      },
    ];

    const result = await billingService.createBill({
      shopId: 'shop_partial_test',
      cart: mockCart,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Suresh',
      customerPhone: '98400 12345',
    });

    expect(result.bill.totalAmount).toBe(500);
    expect(result.bill.pendingAmount).toBe(500);
    expect(result.bill.paidAmount).toBe(0);

    const initialPending = await billingService.getPendingPayments('shop_partial_test');
    const sureshPending = initialPending.find(p => p.customerName === 'Suresh');
    expect(sureshPending).toBeDefined();
    expect(sureshPending?.amountDue).toBe(500);

    // Customer pays 250 now (partial payment)
    const afterPartial = await billingService.clearPendingPayment('shop_partial_test', sureshPending!.id, 250, 'Cash');
    const sureshRemaining = afterPartial.find(p => p.customerName === 'Suresh');
    expect(sureshRemaining).toBeDefined();
    expect(sureshRemaining?.amountDue).toBe(250);

    // Verify bill state in storage
    const billsAfterPartial = await billingService.getBills('shop_partial_test');
    const billPartial = billsAfterPartial.find(b => b.id === result.bill.id);
    expect(billPartial?.paidAmount).toBe(250);
    expect(billPartial?.pendingAmount).toBe(250);
    expect(billPartial?.settledAt).toBeNull();
    expect(billPartial?.collections?.length).toBe(1);
    expect(billPartial?.collections?.[0].amount).toBe(250);

    // Customer returns later and pays the remaining 250
    const afterFinal = await billingService.clearPendingPayment('shop_partial_test', sureshRemaining!.id, 250, 'Cash');
    expect(afterFinal.some(p => p.customerName === 'Suresh')).toBe(false);

    const billsFinal = await billingService.getBills('shop_partial_test');
    const billFinal = billsFinal.find(b => b.id === result.bill.id);
    expect(billFinal?.paidAmount).toBe(500);
    expect(billFinal?.pendingAmount).toBe(0);
    expect(billFinal?.settledAt).toBeDefined();
    expect(billFinal?.collections?.length).toBe(2);
  });
});
