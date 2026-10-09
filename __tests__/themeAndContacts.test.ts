import { contactService } from '../src/services/contactService';
import { lightTheme } from '../src/theme/lightTheme';
import { darkTheme } from '../src/theme/darkTheme';
import { storage } from '../src/lib/storage';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [], error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null }),
};

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
  },
}));

jest.mock('expo-contacts/legacy', () => ({
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
    Emails: 'emails',
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
}));

describe('Theme and Customer Contacts Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await storage.clear();
  });

  describe('1. Perfect Dark Mode / Light Mode Semantic Tokens', () => {
    it('preserves the signature CounterPro brand orange across both light and dark themes', () => {
      expect(lightTheme.colors.accent).toBe('#FF5F00');
      expect(darkTheme.colors.accent).toBe('#FF5F00');
      expect(lightTheme.colors.primary).toBe('#FF5F00');
      expect(darkTheme.colors.primary).toBe('#FF5F00');
    });

    it('adapts surfaces, backgrounds, and borders between light and dark modes', () => {
      // Light mode uses soft warm background and crisp white cards
      expect(lightTheme.mode).toBe('light');
      expect(lightTheme.isDark).toBe(false);
      expect(lightTheme.colors.background).toBe('#FAF8F5');
      expect(lightTheme.colors.surface).toBe('#FFFFFF');
      expect(lightTheme.colors.text).toBe('#111111');

      // Dark mode adapts to high-contrast dark surfaces with readable light text
      expect(darkTheme.mode).toBe('dark');
      expect(darkTheme.isDark).toBe(true);
      expect(darkTheme.colors.background).toBe('#0B0B0B');
      expect(darkTheme.colors.surface).toBe('#171717');
      expect(darkTheme.colors.surfaceSecondary).toBe('#1F1F1F');
      expect(darkTheme.colors.text).toBe('#F5F3F0');
    });

    it('defines distinct semantic status colors in both themes', () => {
      expect(lightTheme.colors.success).toBe('#15803D');
      expect(darkTheme.colors.success).toBe('#3DD68C');

      expect(lightTheme.colors.danger).toBe('#DC2626');
      expect(darkTheme.colors.danger).toBe('#FF6B4D');

      expect(lightTheme.colors.warning).toBe('#D97706');
      expect(darkTheme.colors.warning).toBe('#F59E0B');
    });
  });

  describe('2. Device Contacts Permissions & Import Flow', () => {
    const Contacts = require('expo-contacts/legacy');

    it('reports "granted" and returns extracted name, 10-digit phone, and email when permission is allowed', async () => {
      Contacts.getPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        canAskAgain: true,
      });

      Contacts.getContactsAsync.mockResolvedValueOnce({
        data: [
          {
            id: 'c1',
            name: 'Kavitha Devi',
            phoneNumbers: [{ number: '+91 98404 12345' }],
            emails: [{ email: 'kavitha@example.com' }],
          },
          {
            id: 'c2',
            name: 'Ramesh Sundar',
            phoneNumbers: [{ number: '044-24356789' }, { number: '9884098840' }],
            emails: [],
          },
        ],
      });

      const res = await contactService.fetchDeviceContactsWithPermission();
      expect(res.status).toBe('granted');
      expect(res.canAskAgain).toBe(true);
      expect(res.contacts.length).toBe(2);

      // Contact 1
      expect(res.contacts[0].name).toBe('Kavitha Devi');
      expect(res.contacts[0].phone).toBe('9840412345');
      expect(res.contacts[0].email).toBe('kavitha@example.com');

      // Contact 2: picks valid 10-digit mobile number
      expect(res.contacts[1].name).toBe('Ramesh Sundar');
      expect(res.contacts[1].phone).toBe('9884098840');
    });

    it('prompts requestPermissionsAsync if initial status is not granted', async () => {
      Contacts.getPermissionsAsync.mockResolvedValueOnce({
        status: 'undetermined',
        canAskAgain: true,
      });

      Contacts.requestPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        canAskAgain: true,
      });

      Contacts.getContactsAsync.mockResolvedValueOnce({
        data: [
          {
            id: 'c10',
            name: 'Anand Kumar',
            phoneNumbers: [{ number: '9123456789' }],
          },
        ],
      });

      const res = await contactService.fetchDeviceContactsWithPermission();
      expect(res.status).toBe('granted');
      expect(res.contacts[0].name).toBe('Anand Kumar');
    });

    it('reports "blocked" when permission is denied and canAskAgain is false', async () => {
      Contacts.getPermissionsAsync.mockResolvedValueOnce({
        status: 'denied',
        canAskAgain: false,
      });

      const res = await contactService.fetchDeviceContactsWithPermission();
      expect(res.status).toBe('blocked');
      expect(res.canAskAgain).toBe(false);
      expect(res.contacts).toEqual([]);
    });

    it('reports "denied" when permission is denied but can be requested again', async () => {
      Contacts.getPermissionsAsync.mockResolvedValueOnce({
        status: 'denied',
        canAskAgain: true,
      });
      Contacts.requestPermissionsAsync.mockResolvedValueOnce({
        status: 'denied',
        canAskAgain: true,
      });

      const res = await contactService.fetchDeviceContactsWithPermission();
      expect(res.status).toBe('denied');
      expect(res.canAskAgain).toBe(true);
      expect(res.contacts).toEqual([]);
    });
  });

  describe('3. Customer Duplicate Phone Matching and Safe Updating', () => {
    const shopId = 'shop-test-101';

    it('identifies existing customer by normalized 10-digit phone regardless of formatting', async () => {
      // Add existing customer
      await contactService.addCustomer(shopId, 'Original John', '9840011223', 'Velachery');

      // Search with +91 and spaces
      const foundWithCode = await contactService.findExistingCustomerByPhone(shopId, '+91 98400 11223');
      expect(foundWithCode).not.toBeNull();
      expect(foundWithCode?.name).toBe('Original John');
      expect(foundWithCode?.location).toBe('Velachery');

      // Search with dashes
      const foundWithDash = await contactService.findExistingCustomerByPhone(shopId, '984-001-1223');
      expect(foundWithDash?.id).toBe(foundWithCode?.id);
    });

    it('updates existing customer record instead of creating duplicate when imported/edited', async () => {
      const original = await contactService.addCustomer(shopId, 'Suresh Kumar', '9840198401', 'T Nagar');

      // Attempting to add with same phone number returns the existing record
      const duplicateAttempt = await contactService.addCustomer(shopId, 'Suresh K', '9840198401', 'T Nagar');
      expect(duplicateAttempt.id).toBe(original.id);

      // Now perform update
      const updated = await contactService.updateCustomer(shopId, original.id, {
        name: 'Suresh Kumar (VIP)',
        location: 'T Nagar Main Road',
        notes: 'Email: suresh@gmail.com',
      });

      expect(updated?.id).toBe(original.id);
      expect(updated?.name).toBe('Suresh Kumar (VIP)');
      expect(updated?.location).toBe('T Nagar Main Road');

      // List customers to verify no duplicates were created
      const allCustomers = await contactService.getCustomers(shopId);
      const matchingPhone = allCustomers.filter(c => c.phone?.slice(-10) === '9840198401');
      expect(matchingPhone.length).toBe(1);
    });
  });

  describe('4. VIP and is_active Supabase Database Persistence', () => {
    const shopId = '00000000-0000-0000-0000-000000000001';

    it('persists is_vip: true to Supabase customers table when customer is marked VIP', async () => {
      const cust = await contactService.addCustomer(shopId, 'VIP Test User', '9876543210');
      mockQueryBuilder.update.mockClear();

      const updated = await contactService.updateCustomer(shopId, cust.id, {
        isVip: true,
        statusTag: 'MVP',
      });

      expect(updated?.isVip).toBe(true);
      expect(updated?.statusTag).toBe('MVP');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_vip: true,
          status_tag: 'MVP',
        })
      );
    });

    it('persists is_active: false and is_active: true to Supabase when toggled', async () => {
      const cust = await contactService.addCustomer(shopId, 'Active Test User', '9876543211');
      mockQueryBuilder.update.mockClear();

      const resInactive = await contactService.toggleCustomerActive(shopId, cust.id, false);
      expect(resInactive).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );

      mockQueryBuilder.update.mockClear();
      const resActive = await contactService.toggleCustomerActive(shopId, cust.id, true);
      expect(resActive).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        })
      );
    });

    it('persists is_active for vendors when vendor is toggled inactive/active', async () => {
      const vendor = await contactService.addVendor(shopId, 'Daily Milk Vendor', 'Milk', '9876543212');
      mockQueryBuilder.update.mockClear();

      const res = await contactService.toggleVendorActive(shopId, vendor.id, false);
      expect(res).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });
});
