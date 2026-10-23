import { ROLE_DEFAULT_PERMISSIONS } from '../src/context/AuthContext';
import { expenseService } from '../src/services/expenseService';
import { storage } from '../src/lib/storage';
import { ExpenseRecord } from '../src/types/models';

describe('Supervisor Expense Access & Total Calculation', () => {
  const shopId = 'shop_supervisor_test_1';

  beforeEach(async () => {
    await storage.setObject('@counterpro/expenses', []);
  });

  test('ROLE_DEFAULT_PERMISSIONS grants Supervisor full access to exp and total', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.exp).toBe(true);
    expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.total).toBe(true);
    expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.bill).toBe(true);
  });

  test('Supervisor successfully creates an expense and persists to storage', async () => {
    const supervisorMeta = {
      id: 'sup_user_1',
      name: 'Ravi Supervisor',
      role: 'Supervisor',
    };

    const newExpense = await expenseService.addExpense(
      shopId,
      'Milk & Sugar daily supply',
      450,
      {
        category: 'Supplies',
        paymentMode: 'Cash',
        creator: supervisorMeta,
      }
    );

    expect(newExpense).toBeDefined();
    expect(newExpense.description).toBe('Milk & Sugar daily supply');
    expect(newExpense.amount).toBe(450);
    expect(newExpense.createdByRole).toBe('Supervisor');
    expect(newExpense.createdByName).toBe('Ravi Supervisor');

    // Verify stored expenses
    const stored = await expenseService.getExpenses(shopId);
    expect(stored.length).toBe(1);
    expect(stored[0].amount).toBe(450);
  });

  test('Multiple expenses logged by Supervisor correctly aggregate into total expense', async () => {
    const supervisorMeta = {
      id: 'sup_user_1',
      name: 'Ravi Supervisor',
      role: 'Supervisor',
    };

    await expenseService.addExpense(shopId, 'Vegetables', 320, { creator: supervisorMeta });
    await expenseService.addExpense(shopId, 'Gas Refill', 1100, { creator: supervisorMeta });
    await expenseService.addExpense(shopId, 'Water Cans', 150, { creator: supervisorMeta });

    const allExpenses = await expenseService.getExpenses(shopId);
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    expect(allExpenses.length).toBe(3);
    expect(totalExpenses).toBe(320 + 1100 + 150); // 1570
  });

  test('Billers are strictly unauthorized to create expenses', async () => {
    const billerMeta = {
      id: 'bil_user_1',
      name: 'Karan Biller',
      role: 'Biller',
    };

    await expect(
      expenseService.addExpense(shopId, 'Disallowed Expense', 100, { creator: billerMeta })
    ).rejects.toThrow('Unauthorized: Billers cannot create expenses.');
  });
});
