import { menuService } from '../src/services/menuService';
import { billingService } from '../src/services/billingService';
import { subscriptionService, FREE_BILLS_LIMIT } from '../src/services/subscriptionService';
import { authService } from '../src/services/authService';
import { shopService } from '../src/services/shopService';
import { storage } from '../src/lib/storage';
import { CartItem, MenuItem, MenuCategory } from '../src/types/models';
import { generateUUID } from '../src/lib/uuid';

jest.setTimeout(60000);

describe('100-Bills Limit, 30-Day Retention & Supabase Data Persistence Audit', () => {
  let TEST_SHOP_ID = generateUUID();

  beforeAll(async () => {
    // Register isolated shop so TEST_SHOP_ID starts with clean 0 bills
    const uniquePhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const newShop = await shopService.registerShop({
      name: 'Supabase Audit Shop',
      shopType: 'Tea Shop',
      phone: uniquePhone,
      address: 'Test Address',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
    });
    TEST_SHOP_ID = newShop.id;

    // Clean test store
    await storage.removeItem('@counterpro/bills');
    await storage.removeItem(`@counterpro/total_bills_created_${TEST_SHOP_ID}`);
    await storage.removeItem('@counterpro/menu_categories');
    await storage.removeItem('@counterpro/menu_items');
  }, 60000);

  // TEST 1: CATEGORY CRUD & SUPABASE PERSISTENCE
  test('1. Category: Create, Update, and Delete persistence in Supabase/Storage', async () => {
    // 1. Create Category
    const cat = await menuService.addCategory(TEST_SHOP_ID, 'South Indian Specials');
    expect(cat).toBeDefined();
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe('South Indian Specials');

    // Verify stored
    const catsAfterAdd = await menuService.getCategories(TEST_SHOP_ID);
    expect(catsAfterAdd.some(c => c.id === cat.id && c.name === 'South Indian Specials')).toBe(true);

    // 2. Update Category
    const updatedCats = await menuService.updateCategory(TEST_SHOP_ID, cat.id, 'Traditional Tiffin');
    const updatedCat = updatedCats.find(c => c.id === cat.id);
    expect(updatedCat).toBeDefined();
    expect(updatedCat?.name).toBe('Traditional Tiffin');

    // 3. Delete Category
    const { categories: catsAfterDelete } = await menuService.deleteCategory(TEST_SHOP_ID, cat.id);
    expect(catsAfterDelete.some(c => c.id === cat.id)).toBe(false);
  });

  // TEST 2: MENU ITEMS CRUD & IMPORT BATCH PERSISTENCE
  test('2. Menu Items: Create, Edit, Batch Import from Menu data, and Delete', async () => {
    // Add category for items
    const cat = await menuService.addCategory(TEST_SHOP_ID, 'Breakfast');

    // 1. Create Item
    const newItem: MenuItem = {
      id: generateUUID(),
      shopId: TEST_SHOP_ID,
      categoryId: cat.id,
      name: 'Ghee Podi Idly',
      price: 60,
      halfPrice: 35,
      hasHalf: true,
      isAvailable: true,
      isFavorite: true,
      sortOrder: 1,
    };
    const savedItems = await menuService.saveMenuItem(newItem);
    expect(savedItems.some(i => i.id === newItem.id && i.name === 'Ghee Podi Idly')).toBe(true);

    // 2. Update Item
    const modifiedItem: MenuItem = {
      ...newItem,
      price: 70,
    };
    const itemsAfterEdit = await menuService.saveMenuItem(modifiedItem);
    const edited = itemsAfterEdit.find(i => i.id === newItem.id);
    expect(edited?.price).toBe(70);

    // 3. Batch Import from Menu Options
    const importData = [
      { name: 'Medu Vada (2 pcs)', price: 40, category: 'Breakfast' },
      { name: 'Masala Dosa', price: 90, halfPrice: 50, category: 'Breakfast' },
      { name: 'Filter Coffee', price: 25, category: 'Beverages' },
    ];
    const { addedItems, updatedCategories } = await menuService.batchAddMenuItems(TEST_SHOP_ID, importData);
    expect(addedItems.length).toBe(3);
    expect(updatedCategories.some(c => c.name.toLowerCase() === 'beverages')).toBe(true);

    // 4. Delete Item
    const itemsAfterDelete = await menuService.deleteMenuItem(TEST_SHOP_ID, newItem.id);
    expect(itemsAfterDelete.some(i => i.id === newItem.id)).toBe(false);
  });

  // TEST 3: BILL CREATION, SOFT-DELETION, AND 30-DAY RETENTION
  test('3. Bills: Creation, Soft-deletion, 30-day retention, and Total Counting', async () => {
    const dummyCart: CartItem[] = [
      { key: 'item_1_full', itemId: 'item_1', name: 'Filter Coffee', unitPrice: 25, quantity: 2, lineTotal: 50, isHalf: false },
    ];

    // Create 3 bills
    const bill1 = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: dummyCart,
      paymentMode: 'Cash',
      gstEnabled: false,
    });
    const bill2 = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: dummyCart,
      paymentMode: 'GPay',
      gstEnabled: false,
    });
    const bill3 = await billingService.createBill({
      shopId: TEST_SHOP_ID,
      cart: dummyCart,
      paymentMode: 'Pending',
      gstEnabled: false,
      customerName: 'Karthik',
      customerPhone: '9840112233',
    });

    const n1 = parseInt(bill1.bill.billNumber.replace(/[^0-9]/g, ''), 10);
    const n2 = parseInt(bill2.bill.billNumber.replace(/[^0-9]/g, ''), 10);
    const n3 = parseInt(bill3.bill.billNumber.replace(/[^0-9]/g, ''), 10);
    expect(n2).toBe(n1 + 1);
    expect(n3).toBe(n2 + 1);

    // Verify active count vs total count
    let activeBills = await billingService.getActiveBills(TEST_SHOP_ID);
    expect(activeBills.length).toBe(3);

    // Soft-delete bill2
    const deleted = await billingService.deleteBill(TEST_SHOP_ID, bill2.bill.id, {
      name: 'Owner',
      role: 'Owner',
    });
    expect(deleted.isDeleted).toBe(true);
    expect(['cancelled', 'deleted']).toContain(deleted.status);
    expect(deleted.deletedAt).toBeDefined();

    // Verify active bills now excludes bill2
    activeBills = await billingService.getActiveBills(TEST_SHOP_ID);
    expect(activeBills.length).toBe(2);
    expect(activeBills.some(b => b.id === bill2.bill.id)).toBe(false);

    // Verify 30-day retention: deleted bill must appear in getRecentlyDeletedBills
    const recentlyDeleted = await billingService.getRecentlyDeletedBills(TEST_SHOP_ID);
    expect(recentlyDeleted.some(b => b.id === bill2.bill.id)).toBe(true);

    // Verify authoritative total bills created still counts deleted bill
    const totalCount = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(totalCount).toBe(3);
  });

  // TEST 4: 100 BILLS LIMIT REACHED — BLOCKING BILLING CREATION
  test('4. Free Tier 100-Bills Limit: Blocks creation when 100 bills are reached', async () => {
    // Set total count to 100 (simulating 100 bills reached including active + deleted)
    const TOTAL_KEY = `@counterpro/total_bills_created_${TEST_SHOP_ID}`;
    await storage.setObject(TOTAL_KEY, 100);

    const checkCount = await billingService.getTotalBillsCreated(TEST_SHOP_ID);
    expect(checkCount).toBe(100);

    // Subscription status should reflect bill limit reached
    const { statusInfo } = await subscriptionService.getShopSubscription(
      TEST_SHOP_ID,
      null,
      checkCount
    );
    expect(statusInfo.billLimitReached).toBe(true);
    expect(statusInfo.billsRemaining).toBe(0);
    expect(statusInfo.hasAccess).toBe(false);

    // Attempting to create a new bill MUST fail with limit error
    const dummyCart: CartItem[] = [
      { key: 'item_1_full', itemId: 'item_1', name: 'Tea', unitPrice: 15, quantity: 1, lineTotal: 15, isHalf: false },
    ];

    await expect(
      billingService.createBill({
        shopId: TEST_SHOP_ID,
        cart: dummyCart,
        paymentMode: 'Cash',
        gstEnabled: false,
      })
    ).rejects.toThrow(/100 bills reached/i);
  });
});
