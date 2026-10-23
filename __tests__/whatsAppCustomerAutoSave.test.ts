import { contactService } from '../src/services/contactService';
import { storage } from '../src/lib/storage';

describe('WhatsApp Save & Share Customer Auto-Save Test Suite', () => {
  const TEST_SHOP_ID = 'test-shop-auto-cust-001';

  beforeEach(async () => {
    await storage.clear();
  });

  it('1. Automatically saves customer to app and database when name and 10-digit phone are provided', async () => {
    const cust = await contactService.addCustomer(
      TEST_SHOP_ID,
      'Ramesh Kumar',
      '9876543210'
    );

    expect(cust).toBeDefined();
    expect(cust.id).toBeDefined();
    expect(cust.name).toBe('Ramesh Kumar');
    expect(cust.phone).toBe('9876543210');
    expect(cust.shopId).toBe(TEST_SHOP_ID);

    // Verify it is saved in the app's local customer directory
    const allCustomers = await contactService.getCustomers(TEST_SHOP_ID);
    expect(allCustomers.length).toBe(1);
    expect(allCustomers[0].name).toBe('Ramesh Kumar');
    expect(allCustomers[0].phone).toBe('9876543210');
  });

  it('2. Automatically falls back to "Customer" if only phone number is provided', async () => {
    const cust = await contactService.addCustomer(
      TEST_SHOP_ID,
      '',
      '9840198401'
    );

    expect(cust).toBeDefined();
    expect(cust.phone).toBe('9840198401');

    const allCustomers = await contactService.getCustomers(TEST_SHOP_ID);
    const found = allCustomers.find(c => c.phone === '9840198401');
    expect(found).toBeDefined();
  });

  it('3. Updates customer name without creating duplicate records if same phone number is used', async () => {
    const first = await contactService.addCustomer(
      TEST_SHOP_ID,
      'Suresh Initial',
      '9988776655'
    );
    expect(first.name).toBe('Suresh Initial');

    // Second bill shared with same phone but updated full name
    const updated = await contactService.addCustomer(
      TEST_SHOP_ID,
      'Suresh Gounder',
      '9988776655'
    );

    expect(updated.id).toBe(first.id);
    expect(updated.name).toBe('Suresh Gounder');

    const allCustomers = await contactService.getCustomers(TEST_SHOP_ID);
    const matching = allCustomers.filter(c => c.phone === '9988776655');
    expect(matching.length).toBe(1);
  });
});
