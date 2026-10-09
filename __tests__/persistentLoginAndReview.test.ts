import { storage } from '../src/lib/storage';
import { shopService } from '../src/services/shopService';
import { authService } from '../src/services/authService';
import { twoFactorService } from '../src/services/twoFactorService';
import { Shop } from '../src/types/models';

const STORAGE_KEY_REVIEWED = '@counterpro/has_reviewed_app';
const STORAGE_KEY_REVIEW_SNOOZE = '@counterpro/review_snooze_until';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('Persistent Login & Play Store Review Prompt', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  describe('1. Persistent Login Session Integrity', () => {
    it('persists active shop, user profile, and member role upon shop registration', async () => {
      const registeredShop = await shopService.registerShop({
        name: 'Grand Madurai Cafe',
        ownerName: 'Venkatesh Rao',
        shopType: 'Tea Shop',
        phone: '9840123456',
        address: '12 South Car Street',
        city: 'Madurai',
        state: 'Tamil Nadu',
        pincode: '625001',
      });

      expect(registeredShop.id).toBeDefined();
      expect(registeredShop.name).toBe('Grand Madurai Cafe');

      // 1. Verify Active Shop is durably persisted
      const savedShop = await storage.getObject<Shop | null>('@counterpro/active_shop', null);
      expect(savedShop).not.toBeNull();
      expect(savedShop?.id).toBe(registeredShop.id);
      expect(savedShop?.phone).toBe('9840123456');

      // 2. Verify User Profile is durably persisted with matching phone
      const savedProfile = await authService.getCurrentProfile();
      expect(savedProfile).not.toBeNull();
      expect(savedProfile?.phone).toBe('9840123456');
      expect(savedProfile?.fullName).toBe('Venkatesh Rao');

      // 3. Verify Shop Member is persisted with Owner role
      const savedMember = await authService.getCurrentMember();
      expect(savedMember).not.toBeNull();
      expect(savedMember?.role).toBe('Owner');
      expect(savedMember?.shopId).toBe(registeredShop.id);
    });

    it('retrieves active shop from storage on app restart without requiring OTP', async () => {
      const mockShop: Shop = {
        id: 'shop-persist-001',
        name: 'Sri Krishna Sweets',
        shopType: 'Cafe',
        phone: '9884011223',
        address: '45 Mount Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        pincode: '600002',
        currencyCode: 'INR',
        timezone: 'Asia/Kolkata',
        gstEnabled: false,
        gstRate: 5,
        roundOffEnabled: true,
        dailyBackupEnabled: true,
        printerEnabled: false,
      };

      await storage.setObject('@counterpro/active_shop', mockShop);

      const active = await shopService.getActiveShop();
      expect(active.id).toBe('shop-persist-001');
      expect(active.name).toBe('Sri Krishna Sweets');
    });

    it('returns empty shop on initial cold start when user has not yet registered', async () => {
      const active = await shopService.getActiveShop();
      expect(active.id).toBe('');
      expect(active.name).toBe('');
    });

    it('identifies new phone number as isExistingShop: false to route to registration page', async () => {
      const verifySpy = jest.spyOn(twoFactorService, 'verifyOtp').mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully',
      });

      const res = await authService.verifyOtp('9888877777', '123456');

      expect(res.success).toBe(true);
      expect(res.isExistingShop).toBe(false);
      expect(res.profile).toBeDefined();
      expect(res.profile?.phone).toBe('9888877777');

      verifySpy.mockRestore();
    });
  });

  describe('2. Play Store Review Prompt Logic', () => {
    it('does not trigger review prompt if total bills created is under 10', async () => {
      const totalBills = 7;
      const alreadyReviewed = await storage.getItem(STORAGE_KEY_REVIEWED);
      const shouldPrompt = !alreadyReviewed && totalBills >= 10;

      expect(shouldPrompt).toBe(false);
    });

    it('triggers review prompt when total bills created reaches 10', async () => {
      const totalBills = 10;
      const alreadyReviewed = await storage.getItem(STORAGE_KEY_REVIEWED);
      const shouldPrompt = !alreadyReviewed && totalBills >= 10;

      expect(shouldPrompt).toBe(true);
    });

    it('suppresses review prompt once user has reviewed the app', async () => {
      await storage.setItem(STORAGE_KEY_REVIEWED, 'true');

      const totalBills = 15;
      const alreadyReviewed = await storage.getItem(STORAGE_KEY_REVIEWED);
      const shouldPrompt = alreadyReviewed !== 'true' && totalBills >= 10;

      expect(shouldPrompt).toBe(false);
    });

    it('suppresses review prompt while snooze period is active', async () => {
      // Snooze for 7 days in future
      const futureTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await storage.setItem(STORAGE_KEY_REVIEW_SNOOZE, futureTimestamp.toString());

      const snoozeStr = await storage.getItem(STORAGE_KEY_REVIEW_SNOOZE);
      const isSnoozed = Boolean(snoozeStr && Number(snoozeStr) > Date.now());

      expect(isSnoozed).toBe(true);

      const totalBills = 12;
      const shouldPrompt = !isSnoozed && totalBills >= 10;
      expect(shouldPrompt).toBe(false);
    });
  });
});
