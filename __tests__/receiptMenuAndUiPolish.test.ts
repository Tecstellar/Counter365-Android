jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
}));

import { whatsappService } from '../src/services/whatsappService';
import { CF_ENV, CF_BASE_URL, CF_CHECKOUT_URL } from '../src/services/cashfreeService';
import { Bill } from '../src/types/models';

describe('WhatsApp Receipt & Formatting Polish', () => {
  const sampleBill: Bill = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    shopId: 'shop-uuid-1234',
    billNumber: '#0105',
    customerName: 'Karthik Raja',
    customerPhone: '9876543210',
    tableNumber: 'T4',
    status: 'completed',
    subtotal: 350,
    gstRate: 5,
    gstAmount: 17.5,
    totalAmount: 368,
    paidAmount: 200,
    pendingAmount: 168,
    paymentMode: 'Partial Pay',
    items: [
      { itemName: 'Chicken Biryani', isHalf: false, unitPrice: 260, quantity: 1, lineTotal: 260 },
      { itemName: 'Lime Soda', isHalf: false, unitPrice: 90, quantity: 1, lineTotal: 90 },
    ],
    createdAt: '2026-10-09T12:00:00Z',
    completedAt: '2026-10-09T12:05:00Z',
  };

  it('formats partial pay bill with itemized breakdown, due balance, and valid UPI ID', () => {
    const text = whatsappService.formatCustomerBill(
      sampleBill,
      'Biryani Darbar',
      'biryanidarbar@okhdfcbank'
    );

    expect(text).toContain('Biryani Darbar');
    expect(text).toContain('• Chicken Biryani × 1 = ₹260');
    expect(text).toContain('• Lime Soda × 1 = ₹90');
    expect(text).toContain('TOTAL AMOUNT: ₹368');
    expect(text).toContain('PARTIALLY PAID');
    expect(text).toContain('*Paid Now:* ₹200');
    expect(text).toContain('*Balance Due:* ₹168');
    expect(text).toContain('*Pay Due via UPI ID:* biryanidarbar@okhdfcbank');
    // Receipt URL contains official UUID route and fallback ?d=
    expect(text).toContain('https://counter365.tecstellar.com/b/f47ac10b-58cc-4372-a567-0e02b2c3d479?d=');
    // Should NOT have .pdf appended to URL path
    expect(text).not.toContain('.pdf?d=');
    expect(text).not.toContain('f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf');
  });

  it('omits UPI ID when bill is fully paid', () => {
    const paidBill: Bill = {
      ...sampleBill,
      paymentMode: 'Cash',
      paidAmount: 368,
      pendingAmount: 0,
    };

    const text = whatsappService.formatCustomerBill(
      paidBill,
      'Biryani Darbar',
      'biryanidarbar@okhdfcbank'
    );

    expect(text).toContain('Payment Status:* ✅ PAID (Cash)');
    expect(text).not.toContain('Pay Due via UPI ID');
  });

  it('omits UPI ID if shop UPI ID is invalid or placeholder', () => {
    const text = whatsappService.formatCustomerBill(
      sampleBill,
      'Biryani Darbar',
      'your-upi-placeholder'
    );

    expect(text).not.toContain('Pay Due via UPI ID');
  });

  it('formats full pending payment bills accurately', () => {
    const pendingBill: Bill = {
      ...sampleBill,
      paymentMode: 'Pending',
      paidAmount: 0,
      pendingAmount: 368,
    };

    const text = whatsappService.formatCustomerBill(
      pendingBill,
      'Biryani Darbar',
      'shop@upi'
    );

    expect(text).toContain('PAYMENT PENDING');
    expect(text).toContain('*Balance Due:* ₹368');
    expect(text).toContain('*Pay Due via UPI ID:* shop@upi');
  });
});

describe('Cashfree Environment Configuration', () => {
  it('correctly aligns environment and checkout host URLs', () => {
    expect(['PROD', 'TEST']).toContain(CF_ENV);
    if (CF_ENV === 'PROD') {
      expect(CF_BASE_URL).toBe('https://api.cashfree.com/pg');
      expect(CF_CHECKOUT_URL).toBe('https://payments.cashfree.com/order/#');
    } else {
      expect(CF_BASE_URL).toBe('https://sandbox.cashfree.com/pg');
      expect(CF_CHECKOUT_URL).toBe('https://payments-test.cashfree.com/order/#');
    }
  });
});
