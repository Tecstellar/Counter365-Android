import { expenseService } from '../src/services/expenseService';

jest.setTimeout(20000);

describe('Expense Service — CRUD with Supabase & Cache', () => {
  const testShopId = 'shop_exp_test';

  test('adds, updates, and deletes an expense record', async () => {
    // 1. Add expense
    const added = await expenseService.addExpense(testShopId, 'Milk & Curd', 180);
    expect(added).toBeDefined();
    expect(added.description).toBe('Milk & Curd');
    expect(added.amount).toBe(180);
    expect(added.shopId).toBe(testShopId);

    // Verify it appears in getExpenses
    const initialList = await expenseService.getExpenses(testShopId);
    expect(initialList.some(e => e.id === added.id && e.amount === 180)).toBe(true);

    // 2. Update expense
    const updatedList = await expenseService.updateExpense(testShopId, added.id, 'Milk & Cream', 220);
    const updated = updatedList.find(e => e.id === added.id);
    expect(updated).toBeDefined();
    expect(updated?.description).toBe('Milk & Cream');
    expect(updated?.amount).toBe(220);

    // 3. Delete expense
    const afterDelete = await expenseService.deleteExpense(testShopId, added.id);
    expect(afterDelete.some(e => e.id === added.id)).toBe(false);

    // Verify persistence after delete
    const finalList = await expenseService.getExpenses(testShopId);
    expect(finalList.some(e => e.id === added.id)).toBe(false);
  });
});
