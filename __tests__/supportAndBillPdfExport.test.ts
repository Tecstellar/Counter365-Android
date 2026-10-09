jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: { OS: 'android' },
}));

import { APP_CONFIG } from '../src/constants/appConfig';
import { exportService } from '../src/services/exportService';
import { whatsappService } from '../src/services/whatsappService';
import { Bill, Shop } from '../src/types/models';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

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
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2048 }),
}));

describe('Support Screen & Bill PDF Export Requirements', () => {
  const mockShop: Shop = {
    id: 'shop-test-101',
    name: 'Madras Chai Cafe',
    shopType: 'Tea Shop',
    phone: '9840412345',
    address: '10 Anna Salai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600002',
    currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    gstEnabled: true,
    gstRate: 5,
    gstNumber: '33AAAAA0000A1Z5',
    tableManagementEnabled: true,
    tableCount: 8,
    roundOffEnabled: false,
    dailyBackupEnabled: true,
    printerEnabled: false,
  };

  const mockBill: Bill = {
    id: 'bill-test-001',
    shopId: 'shop-test-101',
    billNumber: '1042',
    items: [
      { id: '1', itemName: 'Masala Chai', quantity: 2, unitPrice: 20, lineTotal: 40, isHalf: false },
      { id: '2', itemName: 'Bun Butter Jam', quantity: 1, unitPrice: 45, lineTotal: 45, isHalf: false },
    ],
    subtotal: 85,
    gstAmount: 4.25,
    gstRate: 5,
    totalAmount: 89.25,
    paymentMode: 'Cash + GPay',
    cashAmount: 50,
    gpayAmount: 39.25,
    paidAmount: 89.25,
    pendingAmount: 0,
    tableNumber: '3',
    customerName: 'Karthik',
    customerPhone: '9876543210',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'completed',
  };

  test('Support contact info conforms strictly to APP_CONFIG requirements', () => {
    expect(APP_CONFIG.supportPhone).toBe('8903368006');
    expect(APP_CONFIG.supportHours).toContain('7:00 AM');
    expect(APP_CONFIG.supportHours).toContain('11:00 PM');
  });

  test('exportBillPdf generates high-fidelity receipt and safe file URI with file://', async () => {
    const res = await exportService.exportBillPdf(mockBill, mockShop);

    expect(res.success).toBe(true);
    expect(res.uri).toBeDefined();
    expect(res.uri?.startsWith('file://')).toBe(true);
    expect(Print.printToFileAsync).toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\//),
      expect.objectContaining({
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      })
    );
  });

  test('exportBillPdf gracefully falls back to native print preview if sharing is unavailable or throws', async () => {
    (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('Export sharing as incorrect'));

    const res = await exportService.exportBillPdf(mockBill, mockShop);

    expect(res.success).toBe(true);
    expect(Print.printAsync).toHaveBeenCalled();
  });

  test('whatsappService formats bill text with customer greeting, paid status, and short PDF receipt link', () => {
    const waText = whatsappService.formatCustomerBill(mockBill, mockShop.name, mockShop.upiId, mockShop.phone);

    expect(waText).toContain('Hi Karthik 👋');
    expect(waText).toContain('Thank you for choosing *Madras Chai Cafe*!');
    expect(waText).toContain('💰 *Total Amount:* ₹89');
    expect(waText).toContain('✅ *Payment Status:* PAID (Cash + GPay)');
    expect(waText).toContain('📄 *View Receipt:*');
    expect(waText).toContain('https://counter365.tecstellar.com/b/bill-test-001');
    expect(waText).toContain('📞 *Contact:* 9840412345');
    expect(waText).toContain('Thank you for your business!');
    // Verify no line items in WhatsApp message text
    expect(waText).not.toContain('Masala Chai × 2');
    // Verify short URL < 100 characters
    const urlMatch = waText.match(/https:\/\/[^\s]+/);
    expect(urlMatch).toBeTruthy();
    expect(urlMatch![0].length).toBeLessThan(100);
  });
});
