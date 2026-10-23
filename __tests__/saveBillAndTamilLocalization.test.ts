jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android || objs.default },
  StyleSheet: { create: (s: any) => s },
}));
jest.mock('expo-print', () => ({ printAsync: jest.fn().mockResolvedValue({}) }));

import { TRANSLATIONS } from '../src/i18n/translations';
import { printerService } from '../src/services/printerService';
import { Bill, Shop } from '../src/types/models';

describe('Save Bill Dialog & Multilingual Localization (Tamil and Indic Languages)', () => {
  describe('1. Tamil Language & Translation Verification', () => {
    const ta = TRANSLATIONS.ta;

    it('translates total_expenses accurately to "மொத்த செலவுகள்"', () => {
      expect(ta.total_expenses).toBe('மொத்த செலவுகள்');
    });

    it('translates expenses accurately to "செலவுகள்"', () => {
      expect(ta.expenses).toBe('செலவுகள்');
    });

    it('translates add_expense to responsive "சேர்க்க"', () => {
      expect(ta.add_expense).toBe('சேர்க்க');
    });

    it('translates paper saved eco quote in Tamil', () => {
      expect(ta.paper_saved_quote).toContain('காகிதத்தை சேமித்தீர்கள்');
      expect(ta.bill_saved_success).toContain('பில்');
    });

    it('translates Account Subscription, Users, Theme, and Hardware settings in Tamil', () => {
      expect(ta.subscription_box).toBe('சந்தா விவரம்');
      expect(ta.pro_active).toBe('ப்ரோ செயலில் உள்ளது');
      expect(ta.starter_quota).toBe('தொடக்க ஒதுக்கீடு');
      expect(ta.users_and_staff).toBe('பணியாளர்கள் & ஊழியர்கள்');
      expect(ta.theme_and_appearance).toBe('தீம் & தோற்றம்');
      expect(ta.dark_mode_theme).toBe('இருண்ட பயன்முறை (Dark Mode)');
      expect(ta.hardware_billing_settings).toBe('ஹார்டுவேர் & பில்லிங் அமைப்புகள்');
      expect(ta.gst_on_bills).toBe('பில்களில் GST');
      expect(ta.round_off_totals).toBe('மொத்தத்தை முழுமையாக்குதல்');
      expect(ta.nearest_rupee).toBe('அருகிலுள்ள முழு ரூபாய்');
    });

    it('translates all core payment modes in Tamil', () => {
      expect(ta.mode_cash).toBe('ரொக்கம்');
      expect(ta.mode_gpay).toBe('GPay / UPI');
      expect(ta.mode_cash_gpay).toBe('ரொக்கம் + GPay');
      expect(ta.mode_full_pending).toBe('முழு நிலுவை');
      expect(ta.mode_partial_pay).toBe('பகுதி கட்டணம்');
    });

    it('translates core navigation and sales terminology in Tamil', () => {
      expect(ta.home).toBe('முகப்பு');
      expect(ta.bills).toBe('பில்கள்');
      expect(ta.new_bill).toBe('புதிய பில்');
      expect(ta.account).toBe('கணக்கு');
      expect(ta.sales).toBe('விற்பனை');
      expect(ta.todays_takings).toBe('இன்றைய வசூல்');
      expect(ta.mostly_used).toBe('அதிகம் பயன்பட்டவை');
      expect(ta.delete_account).toBe('கணக்கை நிரந்தரமாக நீக்கு');
    });
  });

  describe('2. Comprehensive Multilingual Parity', () => {
    const supportedLangs = ['en', 'ta', 'hi', 'ml', 'kn', 'te'] as const;

    it('provides all critical translation keys across all 6 languages', () => {
      const criticalKeys = [
        'total_expenses',
        'expenses',
        'add_expense',
        'net_profit',
        'bill_saved_success',
        'paper_saved_quote',
        'mode_cash',
        'mode_gpay',
        'mode_cash_gpay',
        'mode_full_pending',
        'mode_partial_pay',
        'save_bill',
        'save_and_share',
        'print_receipt',
      ];

      for (const lang of supportedLangs) {
        const dict = TRANSLATIONS[lang];
        for (const key of criticalKeys) {
          expect(dict[key]).toBeDefined();
          expect(dict[key].trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('3. Printer Handling in Save Bill Area', () => {
    const mockBill: Bill = {
      id: 'bill-test-001',
      shopId: 'shop-test-123',
      billNumber: '1001',
      items: [
        {
          menuItemId: 'item-1',
          itemName: 'Masala Dosa',
          isHalf: false,
          unitPrice: 60,
          quantity: 2,
          lineTotal: 120,
        },
      ],
      subtotal: 120,
      discountAmount: 0,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: 120,
      paidAmount: 120,
      pendingAmount: 0,
      paymentMode: 'Cash',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    const mockShopWithPrinter: Shop = {
      id: 'shop-test-123',
      name: 'Saravana Bhavan',
      phone: '9876543210',
      address: '12 Anna Salai, Chennai',
      shopType: 'Restaurant',
      currencyCode: 'INR',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600002',
      timezone: 'Asia/Kolkata',
      gstEnabled: false,
      gstRate: 5,
      roundOffEnabled: false,
      dailyBackupEnabled: false,
      printerEnabled: true,
      printerUrl: 'bt://00:11:22:33:44:55',
    };

    it('generates thermal print receipt safely when printer is enabled', async () => {
      const html = printerService.generateThermalHtml(
        mockBill,
        mockShopWithPrinter.name,
        mockShopWithPrinter.address,
        mockShopWithPrinter.phone,
        '80mm'
      );

      expect(html).toContain('Saravana Bhavan');
      expect(html).toContain('Masala Dosa');
      expect(html).toContain('1001');
      expect(html).toContain('120');
    });

    it('printer service safely defaults values even if shop has printer disabled', async () => {
      const shopWithoutPrinter: Shop = {
        ...mockShopWithPrinter,
        printerEnabled: false,
        printerUrl: undefined,
      };

      const html = printerService.generateThermalHtml(
        mockBill,
        shopWithoutPrinter.name,
        shopWithoutPrinter.address,
        shopWithoutPrinter.phone,
        '58mm'
      );

      expect(html).toContain('58mm');
      expect(html).toContain('Saravana Bhavan');
    });
  });
});
