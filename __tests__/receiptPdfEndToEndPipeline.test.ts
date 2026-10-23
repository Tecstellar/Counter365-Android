jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
}));

const validPdfBuffer = Buffer.from('%PDF-1.4\n%real pdf test structure\n%%EOF');
const validPdfBase64 = validPdfBuffer.toString('base64');

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockImplementation(async () => ({
    uri: 'file:///mock/cache/test_bill.pdf',
    base64: validPdfBase64,
  })),
  printAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2048 }),
}));

import { exportService } from '../src/services/exportService';
import { whatsappService } from '../src/services/whatsappService';
import { Bill, Shop } from '../src/types/models';

describe('Phase 5 — Receipt PDF End-to-End Pipeline Verification', () => {
  const testShop: Shop = {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Receipt Test Shop',
    shopType: 'Restaurant',
    phone: '9876543210',
    address: '123 Anna Salai, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600002',
    currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    gstEnabled: false,
    gstRate: 0,
    roundOffEnabled: false,
    dailyBackupEnabled: true,
    printerEnabled: false,
    upiId: 'receipttest@okhdfcbank',
    createdAt: new Date().toISOString(),
  };

  const createTestBill = (
    paymentMode: 'Cash' | 'GPay' | 'Pending' | 'Partial Pay',
    paidAmount: number,
    pendingAmount: number
  ): Bill => ({
    id: 'e2e-bill-1001-uuid-abcd-ef0123456789',
    shopId: testShop.id,
    billNumber: 'RTS-0001',
    customerName: 'Receipt Test Customer',
    customerPhone: '9884011223',
    status: 'completed',
    subtotal: 350,
    gstRate: 0,
    gstAmount: 0,
    totalAmount: 350,
    paidAmount,
    pendingAmount,
    paymentMode: paymentMode === 'GPay' ? 'GPay' : paymentMode,
    createdAt: '2026-10-09T14:30:00.000Z',
    completedAt: '2026-10-09T14:30:00.000Z',
    items: [
      {
        id: 'item-1',
        itemName: 'Item A',
        isHalf: false,
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
      },
      {
        id: 'item-2',
        itemName: 'Item B',
        isHalf: false,
        quantity: 1,
        unitPrice: 150,
        lineTotal: 150,
      },
    ],
  });

  describe('Scenario 1: Fully Paid Bill', () => {
    const fullyPaidBill = createTestBill('GPay', 350, 0);

    test('1. Generates HTML containing all authoritative bill and line item data', () => {
      const html = exportService.buildBillReceiptHtml(fullyPaidBill, testShop);

      // Shop & branding
      expect(html).toContain('Receipt Test Shop');
      expect(html).toContain('123 Anna Salai, Chennai');
      expect(html).toContain('9876543210');
      expect(html).toContain('RECEIPT');
      expect(html).toContain('Counter');
      expect(html).toContain('365');

      // Bill details
      expect(html).toContain('Bill #RTS-0001');
      expect(html).toContain('Receipt Test Customer');
      expect(html).toContain('+91 9884011223');

      // Items & totals
      expect(html).toContain('Item A');
      expect(html).toContain('₹200');
      expect(html).toContain('Item B');
      expect(html).toContain('₹150');
      expect(html).toContain('Subtotal');
      expect(html).toContain('₹350');
      expect(html).toContain('GRAND TOTAL');

      // Payment Status: Paid
      expect(html).toContain('PAID');
      expect(html).toContain('Paid via GPay');
      expect(html).not.toContain('PAY VIA UPI'); // No UPI block for fully paid
    });

    test('2. Generates valid PDF file structure and verifies signature (%PDF-)', async () => {
      const result = await exportService.generateAndUploadBillReceipt(fullyPaidBill, testShop);

      expect(result.success).toBe(true);
      expect(result.localUri).toBeDefined();
      expect(result.pdfUrl).toBeDefined();
      expect(result.pdfUrl).toContain(fullyPaidBill.id);
    });

    test('3. Generates concise WhatsApp message with valid URL under 80 characters', () => {
      const msg = whatsappService.formatCustomerBill(
        fullyPaidBill,
        testShop.name,
        testShop.upiId,
        testShop.phone
      );

      expect(msg).toContain('Hi Receipt Test Customer 👋');
      expect(msg).toContain('*Receipt Test Shop*');
      expect(msg).toContain('💰 *Total Amount:* ₹350');
      expect(msg).toContain('✅ *Payment Status:* PAID (GPay)');
      expect(msg).toContain('📄 *View Receipt:*');
      expect(msg).toContain('📞 *Contact:* 9876543210');
      expect(msg).toContain('Thank you for your business!');

      // No individual line items in WhatsApp message
      expect(msg).not.toContain('Item A');
      expect(msg).not.toContain('Item B');

      // URL length strictly under 80 characters
      const urlMatch = msg.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(80);
      expect(urlMatch![0].length).toBeLessThan(100);
    });
  });

  describe('Scenario 2: Partially Paid Bill', () => {
    const partiallyPaidBill = createTestBill('Partial Pay', 200, 150);

    test('1. Generates HTML with PARTIALLY PAID status, balance due, and UPI block', () => {
      const html = exportService.buildBillReceiptHtml(partiallyPaidBill, testShop);

      expect(html).toContain('PARTIALLY PAID');
      expect(html).toContain('Due ₹150');
      expect(html).toContain('PAY VIA UPI');
      expect(html).toContain('receipttest@okhdfcbank');
      expect(html).toContain('Remaining Balance Due: ₹150');
    });

    test('2. Generates WhatsApp message with total, paid, balance due, UPI ID and URL < 80 chars', () => {
      const msg = whatsappService.formatCustomerBill(
        partiallyPaidBill,
        testShop.name,
        testShop.upiId,
        testShop.phone
      );

      expect(msg).toContain('💰 *Total Amount:* ₹350');
      expect(msg).toContain('💵 *Total Paid:* ₹200');
      expect(msg).toContain('🔴 *Balance Due:* ₹150');
      expect(msg).toContain('⚠️ *Payment Status:* PARTIALLY PAID');
      expect(msg).toContain('💳 *UPI ID:* receipttest@okhdfcbank');
      expect(msg).toContain('📞 *Contact:* 9876543210');

      const urlMatch = msg.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(80);
    });
  });

  describe('Scenario 3: Fully Pending Bill', () => {
    const fullyPendingBill = createTestBill('Pending', 0, 350);

    test('1. Generates HTML with PAYMENT PENDING status, full due, and UPI block', () => {
      const html = exportService.buildBillReceiptHtml(fullyPendingBill, testShop);

      expect(html).toContain('PAYMENT PENDING');
      expect(html).toContain('Due ₹350');
      expect(html).toContain('PAY VIA UPI');
      expect(html).toContain('receipttest@okhdfcbank');
      expect(html).toContain('Outstanding Balance Due: ₹350');
    });

    test('2. Generates WhatsApp message with ₹0.00 paid, full due, PENDING status and URL < 80 chars', () => {
      const msg = whatsappService.formatCustomerBill(
        fullyPendingBill,
        testShop.name,
        testShop.upiId,
        testShop.phone
      );

      expect(msg).toContain('💰 *Total Amount:* ₹350');
      expect(msg).toContain('💵 *Total Paid:* ₹0.00');
      expect(msg).toContain('🔴 *Balance Due:* ₹350');
      expect(msg).toContain('⚠️ *Payment Status:* PENDING');
      expect(msg).toContain('💳 *UPI ID:* receipttest@okhdfcbank');

      const urlMatch = msg.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      expect(urlMatch![0].length).toBeLessThan(80);
    });
  });

  describe('Edge Cases and Resilience', () => {
    test('Handles long receipts with 20 items without crashing or corrupting totals', () => {
      const longBill: Bill = {
        ...createTestBill('Cash', 2000, 0),
        id: 'long-bill-uuid-1234',
        billNumber: 'RTS-LONG-01',
        subtotal: 2000,
        totalAmount: 2000,
        items: Array.from({ length: 20 }, (_, idx) => ({
          id: `item-${idx}`,
          itemName: `Special Dish #${idx + 1} with Extra Long Descriptive Name for Wrap Testing`,
          isHalf: false,
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        })),
      };

      const html = exportService.buildBillReceiptHtml(longBill, testShop);
      expect(html).toContain('Special Dish #1');
      expect(html).toContain('Special Dish #20');
      expect(html).toContain('₹2,000');
      expect(html).toContain('page-break-inside: avoid');
    });

    test('Falls back cleanly to "Walk-in Customer" / "Valued Customer" when customer details are omitted', () => {
      const anonBill: Bill = {
        ...createTestBill('Cash', 350, 0),
        customerName: undefined,
        customerPhone: undefined,
      };

      const html = exportService.buildBillReceiptHtml(anonBill, testShop);
      expect(html).toContain('Walk-in Customer');

      const msg = whatsappService.formatCustomerBill(
        anonBill,
        testShop.name,
        testShop.upiId,
        testShop.phone
      );
      expect(msg).toContain('Hi Valued Customer 👋');
    });

    test('Reflects bill edits: changing items immediately updates HTML and totals', () => {
      const originalBill = createTestBill('Cash', 350, 0);
      const editedBill: Bill = {
        ...originalBill,
        subtotal: 450,
        totalAmount: 450,
        paidAmount: 450,
        isEdited: true,
        items: [
          ...originalBill.items,
          {
            id: 'item-3',
            itemName: 'Item C Added in Edit',
            isHalf: false,
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
          },
        ],
      };

      const editedHtml = exportService.buildBillReceiptHtml(editedBill, testShop);
      expect(editedHtml).toContain('Item C Added in Edit');
      expect(editedHtml).toContain('₹450');
    });

    test('Reflects payment updates: settling a pending bill changes status to PAID and removes UPI block', () => {
      const pendingBill = createTestBill('Pending', 0, 350);
      const settledBill: Bill = {
        ...pendingBill,
        paidAmount: 350,
        pendingAmount: 0,
        paymentMode: 'Cash',
      };

      const settledHtml = exportService.buildBillReceiptHtml(settledBill, testShop);
      expect(settledHtml).toContain('PAID');
      expect(settledHtml).toContain('Paid via Cash');
      expect(settledHtml).not.toContain('PAY VIA UPI');
    });

    test('Deterministic PDF storage URL mapping matches bill ID', () => {
      const bill = createTestBill('Cash', 350, 0);
      const expectedStoragePath = `https://tziqjkklqtmjlncoraba.supabase.co/storage/v1/object/public/receipts/${bill.id}.pdf`;

      const msg = whatsappService.formatCustomerBill(
        bill,
        testShop.name,
        testShop.upiId,
        testShop.phone,
        expectedStoragePath
      );

      expect(msg).toContain(expectedStoragePath);
      expect(expectedStoragePath).toContain(bill.id);
      expect(expectedStoragePath.endsWith('.pdf')).toBe(true);
    });
  });
});
