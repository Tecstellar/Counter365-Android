import { Bill } from '../src/types/models';

describe('BillActionMenuModal Specification', () => {
  const sampleBill: Bill = {
    id: 'bill_test_action_001',
    billNumber: 'Bill #001',
    shopId: 'shop_test_123',
    items: [
      {
        id: 'item_1',
        menuItemId: 'm1',
        itemName: 'Cold Coffee',
        isHalf: false,
        unitPrice: 120,
        quantity: 1,
        lineTotal: 120,
      },
    ],
    subtotal: 120,
    gstRate: 0,
    gstAmount: 0,
    discountAmount: 0,
    totalAmount: 120,
    paidAmount: 120,
    pendingAmount: 0,
    paymentMode: 'Cash',
    status: 'completed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  test('All 4 action callbacks are defined and can be invoked with target bill', () => {
    const onWhatsApp = jest.fn();
    const onDownload = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    onWhatsApp(sampleBill);
    expect(onWhatsApp).toHaveBeenCalledWith(sampleBill);

    onDownload(sampleBill);
    expect(onDownload).toHaveBeenCalledWith(sampleBill);

    onEdit(sampleBill);
    expect(onEdit).toHaveBeenCalledWith(sampleBill);

    onDelete(sampleBill);
    expect(onDelete).toHaveBeenCalledWith(sampleBill);
  });
});
