import { authService } from '../src/services/authService';
import { shopService } from '../src/services/shopService';
import { menuService } from '../src/services/menuService';
import { billingService } from '../src/services/billingService';
import { expenseService } from '../src/services/expenseService';
import { reportService } from '../src/services/reportService';
import { CartItem, MenuCategory, MenuItem } from '../src/types/models';
import { storage } from '../src/lib/storage';
import { supabase } from '../src/lib/supabase';

import { generateUUID } from '../src/lib/uuid';

jest.setTimeout(60000);

describe('End-to-End Human Tester Workout (Demo Account: 9999999999)', () => {
  const DEMO_PHONE = '9999999999';
  const DEMO_OTP = '123456';
  let demoShopId: string;
  let createdCategoryId: string;
  let createdItemId: string;

  // STEP 1: AUTHENTICATION & LOGIN
  test('Step 1: Human tester logs in using official Demo Account', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 1: DEMO ACCOUNT AUTHENTICATION');
    console.log('======================================================');

    const sendRes = await authService.sendOtp(DEMO_PHONE);
    expect(sendRes.success).toBe(true);
    console.log('✓ OTP Request Successful. Message:', sendRes.message);

    const verifyRes = await authService.verifyOtp(DEMO_PHONE, DEMO_OTP);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.profile).toBeDefined();
    console.log('✓ Verified Demo Profile:', verifyRes.profile?.fullName, '(ID:', verifyRes.profile?.id, ')');

    // Retrieve active shop
    const shop = await shopService.getActiveShop();
    expect(shop).toBeDefined();
    demoShopId = shop.id;
    console.log('✓ Active Demo Shop:', shop.name, '(Shop ID:', demoShopId, ')');

    // Reset bill limit counter for repeatable audit
    await storage.removeItem(`@counterpro/total_bills_created_${demoShopId}`);
    await storage.removeItem('@counterpro/bills');
    await storage.removeItem('@counterpro/expenses');
    await storage.removeItem(`@counterpro/pending_payments_${demoShopId}`);
    try {
      await (supabase.from('bills') as any).delete().eq('shop_id', demoShopId);
      await (supabase.from('payments') as any).delete().eq('shop_id', demoShopId);
      await (supabase.from('pending_payments') as any).delete().eq('shop_id', demoShopId);
      await (supabase.from('expenses') as any).delete().eq('shop_id', demoShopId);
    } catch {}
  });

  // STEP 2: CATEGORY WORKOUT (Add, Edit, Responsive Verify, Delete)
  test('Step 2: Category Workout — Add Category, Edit Category (responsive check)', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 2: CATEGORY WORKOUT');
    console.log('======================================================');

    // 1. Add Category
    const newCatName = 'Special Beverages';
    const addedCat = await menuService.addCategory(demoShopId, newCatName);
    expect(addedCat).toBeDefined();
    expect(addedCat.name).toBe(newCatName);
    createdCategoryId = addedCat.id;
    console.log('✓ Added Category:', addedCat.name, '(ID:', createdCategoryId, ')');

    // 2. Edit Category (Testing renaming and responsive update)
    const updatedName = 'Signature Hot Drinks';
    const updatedCats = await menuService.updateCategory(demoShopId, createdCategoryId, updatedName);
    const foundUpdated = updatedCats.find(c => c.id === createdCategoryId);
    expect(foundUpdated).toBeDefined();
    expect(foundUpdated?.name).toBe(updatedName);
    console.log('✓ Renamed Category to:', foundUpdated?.name);

    // Verify all categories
    const allCats = await menuService.getCategories(demoShopId);
    expect(allCats.some(c => c.name === updatedName)).toBe(true);
    console.log('✓ Categories in Shop:', allCats.map(c => c.name).join(', '));
  });

  // STEP 3: DISH / SERVICE WORKOUT (Add, Edit, Batch Import)
  test('Step 3: Dish & Menu Workout — Add Item, Edit Item, Batch Import', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 3: MENU ITEMS WORKOUT');
    console.log('======================================================');

    // 1. Add Dish
    createdItemId = generateUUID();
    const itemToCreate: MenuItem = {
      id: createdItemId,
      shopId: demoShopId,
      categoryId: createdCategoryId,
      name: 'Ginger Cardamom Chai',
      price: 20,
      halfPrice: 12,
      hasHalf: true,
      isFavorite: true,
      isAvailable: true,
      sortOrder: 1,
    };
    createdItemId = itemToCreate.id;
    const itemsAfterAdd = await menuService.saveMenuItem(itemToCreate);
    const newItem = itemsAfterAdd.find(i => i.id === createdItemId);
    expect(newItem).toBeDefined();
    expect(newItem?.name).toBe('Ginger Cardamom Chai');
    expect(newItem?.price).toBe(20);
    expect(newItem?.halfPrice).toBe(12);
    console.log('✓ Created Menu Item:', newItem?.name, 'Full: ₹' + newItem?.price, 'Half: ₹' + newItem?.halfPrice);

    // 2. Edit Dish
    const itemToEdit: MenuItem = {
      ...itemToCreate,
      name: 'Ginger Cardamom Chai — Special',
      price: 25,
      halfPrice: 15,
    };
    const itemsAfterEdit = await menuService.saveMenuItem(itemToEdit);
    const editedItem = itemsAfterEdit.find(i => i.id === createdItemId);
    expect(editedItem?.name).toBe('Ginger Cardamom Chai — Special');
    expect(editedItem?.price).toBe(25);
    console.log('✓ Updated Menu Item:', editedItem?.name, 'New Price: ₹' + editedItem?.price);

    // 3. Import Items (Batch import testing)
    const batchResult = await menuService.batchAddMenuItems(demoShopId, [
      { name: 'Veg Samosa (2 pcs)', category: 'Signature Hot Drinks', price: 30 },
      { name: 'Bun Maska', category: 'Signature Hot Drinks', price: 40 },
    ]);
    expect(batchResult.addedItems.length).toBeGreaterThanOrEqual(1);
    console.log('✓ Batch Imported Items Count:', batchResult.addedItems.length);

    const allItems = await menuService.getMenuItems(demoShopId);
    expect(allItems.some(i => i.name === 'Veg Samosa (2 pcs)')).toBe(true);
    console.log('✓ Total Menu Items in Shop:', allItems.length);
  });

  // STEP 4: ORDER CREATION & BILLING MODES
  test('Step 4: Order Creation & Billing — Cash, GPay, Split, Pending, Partial Pay', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 4: CORE BILLING & ORDER CREATION');
    console.log('======================================================');

    const sampleCart: CartItem[] = [
      {
        key: `${createdItemId}|full`,
        itemId: createdItemId,
        name: 'Ginger Cardamom Chai — Special',
        unitPrice: 25,
        quantity: 2,
        isHalf: false,
        lineTotal: 50,
      },
    ];

    // Order 1: Cash Payment
    const cashOrder = await billingService.createBill({
      shopId: demoShopId,
      cart: sampleCart,
      paymentMode: 'Cash',
      gstEnabled: false,
    });
    expect(cashOrder.bill.totalAmount).toBe(50);
    expect(cashOrder.bill.paidAmount).toBe(50);
    expect(cashOrder.bill.pendingAmount).toBe(0);
    console.log('✓ Cash Order Created:', cashOrder.bill.billNumber, 'Total: ₹50, Paid: ₹50');

    // Order 2: GPay Payment
    const gpayOrder = await billingService.createBill({
      shopId: demoShopId,
      cart: sampleCart,
      paymentMode: 'GPay',
      gstEnabled: false,
    });
    expect(gpayOrder.bill.paidAmount).toBe(50);
    console.log('✓ GPay Order Created:', gpayOrder.bill.billNumber, 'Total: ₹50, Mode: GPay');

    // Order 3: Split Payment (Cash + GPay)
    const splitOrder = await billingService.createBill({
      shopId: demoShopId,
      cart: sampleCart,
      paymentMode: 'Cash + GPay',
      cashAmount: 30,
      gpayAmount: 20,
      gstEnabled: false,
    });
    expect(splitOrder.bill.totalAmount).toBe(50);
    expect(splitOrder.bill.cashAmount).toBe(30);
    expect(splitOrder.bill.gpayAmount).toBe(20);
    console.log('✓ Split Order Created:', splitOrder.bill.billNumber, 'Cash: ₹30, GPay: ₹20');

    // Order 4: 100% Pending Payment for Ramesh
    const pendingOrder = await billingService.createBill({
      shopId: demoShopId,
      cart: [
        {
          key: 'item_pending_1',
          itemId: createdItemId,
          name: 'Ginger Cardamom Chai — Special',
          unitPrice: 25,
          quantity: 20,
          isHalf: false,
          lineTotal: 500,
        },
      ],
      paymentMode: 'Pending',
      customerName: 'Ramesh (Shop 12)',
      customerPhone: '98401 23456',
      gstEnabled: false,
    });
    expect(pendingOrder.bill.totalAmount).toBe(500);
    expect(pendingOrder.bill.pendingAmount).toBe(500);
    expect(pendingOrder.bill.paidAmount).toBe(0);
    console.log('✓ Pending Order Created:', pendingOrder.bill.billNumber, 'Customer: Ramesh, Due: ₹500');

    // Order 5: Partial Pay Order for Suresh (Total 400, paid 150 now, 250 pending)
    const partialOrder = await billingService.createBill({
      shopId: demoShopId,
      cart: [
        {
          key: 'item_part_1',
          itemId: createdItemId,
          name: 'Ginger Cardamom Chai — Special',
          unitPrice: 25,
          quantity: 16,
          isHalf: false,
          lineTotal: 400,
        },
      ],
      paymentMode: 'Partial Pay',
      paidAmount: 150,
      customerName: 'Suresh Kumar',
      customerPhone: '98402 34567',
      gstEnabled: false,
    });
    expect(partialOrder.bill.totalAmount).toBe(400);
    expect(partialOrder.bill.paidAmount).toBe(150);
    expect(partialOrder.bill.pendingAmount).toBe(250);
    console.log('✓ Partial Pay Order Created:', partialOrder.bill.billNumber, 'Paid: ₹150, Pending: ₹250');
  });

  // STEP 5: PENDING PAYMENTS TRACKING & PARTIAL DUE CLEARANCE
  test('Step 5: Pending Tracking & Partial Due Clearance (Ramesh pays 250 of 500)', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 5: PENDING DUE TRACKING & PARTIAL CLEARANCE');
    console.log('======================================================');

    const pendingList = await billingService.getPendingPayments(demoShopId);
    console.log('✓ Total Customers with Open Pending:', pendingList.length);

    const rameshPending = pendingList.find(p => p.customerName.includes('Ramesh') && p.amountDue === 500);
    expect(rameshPending).toBeDefined();
    expect(rameshPending?.amountDue).toBe(500);
    console.log('✓ Located Ramesh in Due Tracking. Total Outstanding Due: ₹' + rameshPending?.amountDue);

    // HUMAN TESTER SCENARIO:
    // Ramesh comes back and pays ONLY ₹250 now out of ₹500.
    console.log('→ Cashier clicks "Paid", prompts amount: Ramesh pays ₹250 now');
    const afterPartial = await billingService.clearPendingPayment(demoShopId, rameshPending!.id, 250, 'Cash');

    const rameshStillPending = afterPartial.find(p => p.id === rameshPending!.id || p.billId === rameshPending!.billId);
    expect(rameshStillPending).toBeDefined();
    expect(rameshStillPending?.amountDue).toBe(250);
    console.log('✓ Ramesh Due Updated: exactly ₹250 remaining due!');

    // Ramesh returns later to pay remaining ₹250
    console.log('→ Ramesh returns later, pays the remaining ₹250 full clearance');
    const afterFull = await billingService.clearPendingPayment(demoShopId, rameshStillPending!.id, 250, 'Cash');
    expect(afterFull.some(p => p.id === rameshPending!.id || p.billId === rameshPending!.billId)).toBe(false);
    console.log('✓ Ramesh balance is now ₹0, fully settled and removed from pending queue!');
  });

  // STEP 6: EXPENSE MANAGEMENT (Add, 3-Dot Edit, 3-Dot Delete)
  test('Step 6: Expense Management — Add, Edit via 3-dot menu, Delete', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 6: EXPENSE MANAGEMENT (3-DOT MENU)');
    console.log('======================================================');

    // 1. Add Expense
    const exp1 = await expenseService.addExpense(demoShopId, 'Cow Milk 5L', 280);
    expect(exp1).toBeDefined();
    expect(exp1.amount).toBe(280);
    console.log('✓ Added Expense:', exp1.description, '₹' + exp1.amount);

    // 2. 3-Dot Edit Expense: Update to Cow Milk 6L ₹330
    const updatedExps = await expenseService.updateExpense(demoShopId, exp1.id, 'Cow Milk 6L (Special)', 330);
    const editedExp = updatedExps.find(e => e.id === exp1.id);
    expect(editedExp?.description).toBe('Cow Milk 6L (Special)');
    expect(editedExp?.amount).toBe(330);
    console.log('✓ Edited Expense via 3-dot menu:', editedExp?.description, '₹' + editedExp?.amount);

    // 3. Add second expense and Delete it via 3-dot menu
    const exp2 = await expenseService.addExpense(demoShopId, 'Disposable Cups', 90);
    const afterDelete = await expenseService.deleteExpense(demoShopId, exp2.id);
    expect(afterDelete.some(e => e.id === exp2.id)).toBe(false);
    console.log('✓ Deleted Expense "Disposable Cups" via 3-dot menu confirmation');
  });

  // STEP 7: HOME SCREEN FINANCIAL REPORTING & DAY CLOSING
  test('Step 7: Home Screen Financial Analytics & Day Closing Report', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 7: FINANCIAL ANALYTICS & CLOSING REPORT');
    console.log('======================================================');

    const bills = await billingService.getBills(demoShopId);
    const expenses = await expenseService.getExpenses(demoShopId);
    const pending = await billingService.getPendingPayments(demoShopId);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayBills = bills.filter(b => b.createdAt.startsWith(todayStr) || (b.settledAt && b.settledAt.startsWith(todayStr)));
    const todayExpenses = expenses.filter(e => e.expenseDate === todayStr);

    const closingReport = reportService.getDayClosingReport(
      'CounterPro Demo Cafe',
      '100 App Review Avenue',
      '9999999999',
      'Tea Shop',
      todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      todayBills
    );

    expect(closingReport).toBeDefined();
    expect(closingReport.totalSales).toBeGreaterThan(0);
    expect(closingReport.netProfit).toBe(closingReport.totalSales - closingReport.totalExpenses);

    console.log('✓ Day Closing Report Summary:');
    console.log('  Total Sales: ₹' + closingReport.totalSales);
    console.log('  Cash Sales: ₹' + closingReport.cashSales);
    console.log('  GPay Sales: ₹' + closingReport.gpaySales);
    console.log('  Pending Sales: ₹' + closingReport.pendingSales);
    console.log('  Expenses: ₹' + closingReport.totalExpenses);
    console.log('  Net Profit: ₹' + closingReport.netProfit);
  });

  // STEP 8: CLEANUP TEST CATEGORY & DISHES
  test('Step 8: Category Deletion Workout', async () => {
    console.log('\n======================================================');
    console.log('TEST STEP 8: CATEGORY CLEANUP & DELETION');
    console.log('======================================================');

    const delRes = await menuService.deleteCategory(demoShopId, createdCategoryId);
    expect(delRes.categories.some(c => c.id === createdCategoryId)).toBe(false);
    console.log('✓ Successfully deleted category and its attached dishes');
  });
});
