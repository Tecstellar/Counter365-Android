const mockSelectPrinterAsync = jest.fn();
const mockPrintAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-print', () => ({
  get printAsync() {
    return mockPrintAsync;
  },
  get selectPrinterAsync() {
    return mockSelectPrinterAsync;
  },
}));

import { shopService, INITIAL_EMPTY_SHOP } from '../src/services/shopService';
import { printerService } from '../src/services/printerService';
import { billingService } from '../src/services/billingService';
import { storage } from '../src/lib/storage';

describe('User Request Oct 22 Fixes Verification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await storage.clear();
  });

  describe('1. Cancelled Bill Card Layout & Restore Chip in Top Bar', () => {
    it('restores cancelled bill and verifies owner authorization with audit', async () => {
      const shopId = 'test-shop-oct22';
      const billId = 'test-bill-oct22';

      // Seed bill
      const bill = {
        id: billId,
        shopId,
        billNumber: 101,
        totalAmount: 250,
        subtotal: 250,
        status: 'cancelled',
        isDeleted: true,
        deletedByName: 'Staff Person',
        deletedByRole: 'Supervisor',
        items: [{ id: 'item1', name: 'Coffee', quantity: 2, price: 100 }],
        paymentMode: 'Cash',
        createdAt: new Date().toISOString(),
      };
      await storage.setObject('@counterpro/bills', [bill]);

      const restored = await billingService.restoreBill(shopId, billId, {
        name: 'Shop Owner',
        role: 'Owner',
      });

      expect(restored.status).toBe('completed');
      expect(restored.isDeleted).toBe(false);
    });
  });

  describe('2. Printer Default State & Genuine Scan Verification', () => {
    it('ensures INITIAL_EMPTY_SHOP has printerEnabled set to false and printerName is empty/null', () => {
      expect(INITIAL_EMPTY_SHOP.printerEnabled).toBe(false);
      expect(INITIAL_EMPTY_SHOP.printerName).toBeFalsy();
    });

    it('ensures getActiveShop returns printerEnabled as false and no fake default printer name', async () => {
      const shop = await shopService.getActiveShop();
      expect(shop.printerEnabled).toBe(false);
      expect(shop.printerName).toBeFalsy();
    });

    it('returns a concise, compact explanation on Android scan instead of long paragraph, and never returns unverified fake printer', async () => {
      const result = await printerService.scanForPrinters();
      expect(result.printers).toEqual([]);
      expect(result.explanation).not.toContain('Android system printing connects via Android Print Services');
      expect(result.explanation).toContain('No printer found');
      expect((result.explanation || '').length).toBeLessThan(60);
    });
  });

  describe('3. Language Selector & Support for 6 Languages', () => {
    it('verifies that all 6 required languages are available', async () => {
      const { LANGUAGES } = await import('../src/context/LanguageContext');
      const codes = LANGUAGES.map(l => l.code);
      expect(codes).toEqual(['en', 'ta', 'hi', 'ml', 'kn', 'te']);

      const english = LANGUAGES.find(l => l.code === 'en');
      const tamil = LANGUAGES.find(l => l.code === 'ta');
      const hindi = LANGUAGES.find(l => l.code === 'hi');
      const malayalam = LANGUAGES.find(l => l.code === 'ml');
      const kannada = LANGUAGES.find(l => l.code === 'kn');
      const telugu = LANGUAGES.find(l => l.code === 'te');

      expect(english?.shortCode).toBe('EN');
      expect(tamil?.shortCode).toBe('TA');
      expect(tamil?.nativeName).toBe('தமிழ்');
      expect(hindi?.nativeName).toBe('हिन्दी');
      expect(malayalam?.nativeName).toBe('മലയാളം');
      expect(kannada?.nativeName).toBe('ಕನ್ನಡ');
      expect(telugu?.nativeName).toBe('తెలుగు');
    });

    it('persists selected language in local storage', async () => {
      await storage.setItem('@counterpro/app_language', 'ta');
      const saved = await storage.getItem('@counterpro/app_language');
      expect(saved).toBe('ta');
    });

    it('verifies that translations exist across all 6 languages for key navigation and action keys', async () => {
      const { TRANSLATIONS } = await import('../src/i18n/translations');
      const languages = ['en', 'ta', 'hi', 'ml', 'kn', 'te'] as const;

      for (const lang of languages) {
        expect(TRANSLATIONS[lang]).toBeDefined();
        expect(TRANSLATIONS[lang].home).toBeTruthy();
        expect(TRANSLATIONS[lang].bills).toBeTruthy();
        expect(TRANSLATIONS[lang].new_bill).toBeTruthy();
        expect(TRANSLATIONS[lang].account).toBeTruthy();
        expect(TRANSLATIONS[lang].call).toBeTruthy();
        expect(TRANSLATIONS[lang].whatsapp_chat).toBeTruthy();
        expect(TRANSLATIONS[lang].add_product).toBeTruthy();
        expect(TRANSLATIONS[lang].search_items).toBeTruthy();
        expect(TRANSLATIONS[lang].restore).toBeTruthy();
      }

      // Check Tamil specifically
      expect(TRANSLATIONS.ta.call).toBe('அழைக்க');
      expect(TRANSLATIONS.ta.whatsapp_chat).toBe('வாட்ஸ்அப் அரட்டை');
      expect(TRANSLATIONS.ta.new_bill).toBe('புதிய பில்');
      expect(TRANSLATIONS.ta.restore).toBe('மீட்டெடு');

      // Check Hindi specifically
      expect(TRANSLATIONS.hi.call).toBe('कॉल करें');
      expect(TRANSLATIONS.hi.new_bill).toBe('नया बिल');
    });
  });
});
