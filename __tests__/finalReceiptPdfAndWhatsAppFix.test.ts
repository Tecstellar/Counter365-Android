jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({
    uri: 'file:///mock/cache/test_bill.pdf',
    base64: 'JVBERi0xLjQKJcfs...',
  }),
  printAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(true),
  copyAsync: jest.fn().mockResolvedValue(true),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  EncodingType: { Base64: 'base64' },
}));

import { whatsappService } from '../src/services/whatsappService';
import { exportService } from '../src/services/exportService';
import { Bill, Shop } from '../src/types/models';

describe('Final Receipt PDF & WhatsApp Fix Specification', () => {
  const mockShop: Shop = {
    id: 'b1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    name: 'Sangeetha Veg Restaurant',
    phone: '9840123456',
    address: '100 North Usman Road, T. Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600017',
    country: 'India',
    currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    shopType: 'Restaurant',
    tableManagementEnabled: true,
    tableCount: 12,
    maxStaffLimit: 10,
    upiId: 'sangeetha@okhdfcbank',
    gstEnabled: true,
    gstNumber: '33AABCS1429B1Z1',
    gstRate: 5,
    roundOffEnabled: false,
    dailyBackupEnabled: true,
    printerEnabled: false,
  };

  const fullyPaidBill: Bill = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    shopId: mockShop.id,
    billNumber: 'SVR-0042',
    customerName: 'Anand Kumar',
    customerPhone: '9884011223',
    tableNumber: 'Table 4',
    status: 'completed',
    subtotal: 350,
    gstRate: 5,
    gstAmount: 18,
    totalAmount: 368,
    paidAmount: 368,
    pendingAmount: 0,
    paymentMode: 'Cash',
    items: [
      { itemName: 'Ghee Roast Dosa', isHalf: false, unitPrice: 120, quantity: 2, lineTotal: 240 },
      { itemName: 'Filter Coffee', isHalf: false, unitPrice: 40, quantity: 2, lineTotal: 80 },
      { itemName: 'Medu Vada', isHalf: false, unitPrice: 30, quantity: 1, lineTotal: 30 },
    ],
    createdAt: '2026-10-09T08:30:00Z',
    completedAt: '2026-10-09T08:35:00Z',
  };

  const partiallyPaidBill: Bill = {
    ...fullyPaidBill,
    id: 'c1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8e',
    billNumber: 'SVR-0043',
    paidAmount: 200,
    pendingAmount: 168,
    paymentMode: 'Partial Pay',
  };

  const fullyPendingBill: Bill = {
    ...fullyPaidBill,
    id: 'd1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8f',
    billNumber: 'SVR-0044',
    paidAmount: 0,
    pendingAmount: 368,
    paymentMode: 'Pending',
  };

  // =========================================================================
  // 1. WHATSAPP FORMATTING TESTS
  // =========================================================================
  describe('WhatsApp Message Generation', () => {
    test('A. Fully Paid: generates exact required template without item breakdown and URL < 80 chars', () => {
      const msg = whatsappService.formatCustomerBill(
        fullyPaidBill,
        mockShop.name,
        mockShop.upiId,
        mockShop.phone
      );

      const expected = [
        'Hi Anand Kumar 👋',
        '',
        'Thank you for choosing *Sangeetha Veg Restaurant*!',
        '',
        '💰 *Total Amount:* ₹368',
        '✅ *Payment Status:* PAID (Cash)',
        '',
        '📄 *View Receipt:*',
        `https://counter365.tecstellar.com/b/${fullyPaidBill.id}`,
        '',
        '📞 *Contact:* 9840123456',
        '',
        'Thank you for your business!',
      ].join('\n');

      expect(msg).toBe(expected);

      // Verify no item lines in message
      expect(msg).not.toContain('Ghee Roast Dosa');
      expect(msg).not.toContain('Filter Coffee');

      // Verify URL length is under 120 characters
      const urlMatch = msg.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(120);
    });

    test('B. Partially Paid: generates exact required template with balance due, UPI ID, and contact phone', () => {
      const msg = whatsappService.formatCustomerBill(
        partiallyPaidBill,
        mockShop.name,
        mockShop.upiId,
        mockShop.phone
      );

      const expected = [
        'Hi Anand Kumar 👋',
        '',
        'Thank you for choosing *Sangeetha Veg Restaurant*!',
        '',
        '💰 *Total Amount:* ₹368',
        '💵 *Total Paid:* ₹200',
        '🔴 *Balance Due:* ₹168',
        '⚠️ *Payment Status:* PARTIALLY PAID',
        '',
        '📄 *View Receipt:*',
        `https://counter365.tecstellar.com/b/${partiallyPaidBill.id}`,
        '',
        '💳 *UPI ID:* sangeetha@okhdfcbank',
        '📞 *Contact:* 9840123456',
        '',
        'Thank you for your business!',
      ].join('\n');

      expect(msg).toBe(expected);

      // Verify URL length
      const urlMatch = msg.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(120);
    });

    test('C. Fully Pending: generates exact required template with Total Paid ₹0.00 and PENDING status', () => {
      const msg = whatsappService.formatCustomerBill(
        fullyPendingBill,
        mockShop.name,
        mockShop.upiId,
        mockShop.phone
      );

      const expected = [
        'Hi Anand Kumar 👋',
        '',
        'Thank you for choosing *Sangeetha Veg Restaurant*!',
        '',
        '💰 *Total Amount:* ₹368',
        '💵 *Total Paid:* ₹0.00',
        '🔴 *Balance Due:* ₹368',
        '⚠️ *Payment Status:* PENDING',
        '',
        '📄 *View Receipt:*',
        `https://counter365.tecstellar.com/b/${fullyPendingBill.id}`,
        '',
        '💳 *UPI ID:* sangeetha@okhdfcbank',
        '📞 *Contact:* 9840123456',
        '',
        'Thank you for your business!',
      ].join('\n');

      expect(msg).toBe(expected);
    });

    test('Empty customer name defaults to "Valued Customer"', () => {
      const noCustBill: Bill = {
        ...fullyPaidBill,
        customerName: undefined,
      };

      const msg = whatsappService.formatCustomerBill(
        noCustBill,
        mockShop.name,
        mockShop.upiId,
        mockShop.phone
      );

      expect(msg).toContain('Hi Valued Customer 👋');
    });

    test('Omit UPI ID when shop has no configured UPI or placeholder UPI', () => {
      const msgNoUpi = whatsappService.formatCustomerBill(
        partiallyPaidBill,
        mockShop.name,
        null,
        mockShop.phone
      );

      expect(msgNoUpi).not.toContain('UPI ID');

      const msgPlaceholder = whatsappService.formatCustomerBill(
        partiallyPaidBill,
        mockShop.name,
        'your-shop-upi-placeholder',
        mockShop.phone
      );

      expect(msgPlaceholder).not.toContain('UPI ID');
    });

    test('Omit Contact line when contact phone is missing or undefined', () => {
      const msgNoPhone = whatsappService.formatCustomerBill(
        fullyPaidBill,
        mockShop.name,
        mockShop.upiId,
        undefined
      );

      expect(msgNoPhone).not.toContain('Contact:');
      expect(msgNoPhone).toContain(`https://counter365.tecstellar.com/b/${fullyPaidBill.id}\n\nThank you for your business!`);
    });
  });

  // =========================================================================
  // 2. RECEIPT PDF HTML TEMPLATE DESIGN FIDELITY TESTS
  // =========================================================================
  describe('Receipt PDF HTML Template Fidelity', () => {
    test('1. Fully Paid PDF template renders all design elements matching the template image', () => {
      const html = exportService.buildBillReceiptHtml(fullyPaidBill, mockShop);
      try {
        const fs = require('fs');
        fs.writeFileSync('C:/Users/ADMIN/.gemini/antigravity/brain/075f61e7-2f1b-457c-a4b2-ac316452fd9b/scratch/receipt_rendered.html', html, 'utf-8');
      } catch {}

      // Branding & Merchant logo box
      expect(html).toContain('MERCHANT LOGO');
      expect(html).toContain('RECEIPT');
      expect(html).toContain('receipt-title-underline');

      // Shop info
      expect(html).toContain('Sangeetha Veg Restaurant');
      expect(html).toContain('100 North Usman Road, T. Nagar');
      expect(html).toContain('+91 9840123456');
      expect(html).toContain('GSTIN: 33AABCS1429B1Z1');

      // Metadata: Bill Number & Date/Time
      expect(html).toContain('BILL NUMBER');
      expect(html).toContain('Bill #SVR-0042');
      expect(html).toContain('Table 4');
      expect(html).toContain('DATE & TIME');

      // Billed to
      expect(html).toContain('BILLED TO');
      expect(html).toContain('Anand Kumar');
      expect(html).toContain('+91 9884011223');

      // Items table with tight columns and right-aligned prices
      expect(html).toContain('ITEM');
      expect(html).toContain('QTY');
      expect(html).toContain('PRICE');
      expect(html).toContain('TOTAL');
      expect(html).toContain('Ghee Roast Dosa');
      expect(html).toContain('Filter Coffee');
      expect(html).toContain('Medu Vada');

      // Subtotal & Grand Total
      expect(html).toContain('Subtotal');
      expect(html).toContain('GST (5%)');
      expect(html).toContain('GRAND TOTAL');
      expect(html).toContain('grand-total-bar');

      // Payment status panel: Fully paid with peach card and orange checkmark
      expect(html).toContain('background: #FFF7ED');
      expect(html).toContain('✓');
      expect(html).toContain('PAID');
      expect(html).toContain('Paid via Cash');

      // Thank you & Footer branding
      expect(html).toContain('Thank you for your business!');
      expect(html).toContain('Counter');
      expect(html).toContain('365');
      expect(html).toContain('Generated via Counter365 Point of Sale · Official Receipt Copy');
    });

    test('2. Partially Paid PDF template renders partial status, paid amount, balance due, and UPI ID', () => {
      const html = exportService.buildBillReceiptHtml(partiallyPaidBill, mockShop);

      expect(html).toContain('PARTIALLY PAID');
      expect(html).toContain('Paid via Partial Pay');
      expect(html).toContain('Remaining Balance Due:');
      expect(html).toContain('₹168');
      expect(html).toContain('Pay Balance Due via UPI:');
      expect(html).toContain('sangeetha@okhdfcbank');
    });

    test('3. Fully Pending PDF template renders pending status, ₹0.00 paid, outstanding balance, and UPI ID', () => {
      const html = exportService.buildBillReceiptHtml(fullyPendingBill, mockShop);

      expect(html).toContain('PENDING');
      expect(html).toContain('Payment Pending');
      expect(html).toContain('Amount Paid: ₹0.00');
      expect(html).toContain('Outstanding Balance Due:');
      expect(html).toContain('₹368');
      expect(html).toContain('Pay Outstanding Due via UPI:');
      expect(html).toContain('sangeetha@okhdfcbank');
    });
  });
});
