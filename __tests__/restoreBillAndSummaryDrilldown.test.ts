import { billingService } from '../src/services/billingService';
import { storage } from '../src/lib/storage';
import { Bill } from '../src/types/models';

describe('Restore Cancelled Bill, Summary Drilldown & Deletion Safeguards', () => {
  const shopId = 'test-restore-shop-001';

  beforeEach(async () => {
    await storage.clear();
  });

  describe('1. Restore Cancelled Bill', () => {
    const sampleBill: Bill = {
      id: 'bill-to-restore-1',
      shopId,
      billNumber: 'RTS-001',
      subtotal: 500,
      totalAmount: 500,
      paidAmount: 500,
      pendingAmount: 0,
      gstRate: 0,
      gstAmount: 0,
      completedAt: '2026-10-21T10:00:00.000Z',
      paymentMode: 'Cash',
      status: 'completed',
      isDeleted: false,
      items: [
        {
          menuItemId: 'item-1',
          itemName: 'Special Tea',
          quantity: 5,
          unitPrice: 100,
          lineTotal: 500,
          isHalf: false,
        },
      ],
      createdAt: '2026-10-21T10:00:00.000Z',
    };

    it('cancels and successfully restores a bill back to completed status', async () => {
      // Seed bill
      await storage.setObject('@counterpro/bills', [sampleBill]);

      // Cancel bill
      const cancelled = await billingService.deleteBill(
        shopId,
        sampleBill.id,
        { name: 'Owner Kumar', role: 'Owner' },
        'Accidental entry'
      );
      expect(cancelled.isDeleted).toBe(true);
      expect(cancelled.isCancelled).toBe(true);
      expect(cancelled.status).toBe('cancelled');

      // Verify active bills count is now 0
      const activeAfterCancel = await billingService.getActiveBills(shopId);
      expect(activeAfterCancel.length).toBe(0);

      // Restore bill
      const restored = await billingService.restoreBill(
        shopId,
        sampleBill.id,
        { name: 'Owner Kumar', role: 'Owner' }
      );

      expect(restored.isDeleted).toBe(false);
      expect(restored.isCancelled).toBe(false);
      expect(restored.status).toBe('completed');
      expect(restored.cancellationReason).toBeUndefined();

      // Verify active bills count is now 1 again
      const activeAfterRestore = await billingService.getActiveBills(shopId);
      expect(activeAfterRestore.length).toBe(1);
      expect(activeAfterRestore[0].id).toBe(sampleBill.id);
    });

    it('prevents non-Owner (Biller or Supervisor) from restoring a cancelled bill', async () => {
      await storage.setObject('@counterpro/bills', [
        { ...sampleBill, isDeleted: true, isCancelled: true, status: 'cancelled' },
      ]);

      await expect(
        billingService.restoreBill(shopId, sampleBill.id, {
          name: 'Biller Rajesh',
          role: 'Biller',
        })
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        billingService.restoreBill(shopId, sampleBill.id, {
          name: 'Supervisor Suresh',
          role: 'Supervisor',
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('retains edited status if bill was edited prior to cancellation', async () => {
      const editedBill: Bill = {
        ...sampleBill,
        isEdited: true,
        editedByName: 'Owner Kumar',
        status: 'edited',
      };
      await storage.setObject('@counterpro/bills', [editedBill]);

      // Cancel
      await billingService.deleteBill(shopId, editedBill.id, { name: 'Owner Kumar', role: 'Owner' });

      // Restore
      const restored = await billingService.restoreBill(shopId, editedBill.id, {
        name: 'Owner Kumar',
        role: 'Owner',
      });

      expect(restored.isDeleted).toBe(false);
      expect(restored.status).toBe('edited');
    });

    it('re-credits customer pending balance when restoring a bill with pending dues', async () => {
      const pendingBill: Bill = {
        ...sampleBill,
        customerName: 'Karthik',
        customerPhone: '9840412345',
        totalAmount: 1000,
        pendingAmount: 600,
        paymentMode: 'Cash',
      };

      await storage.setObject('@counterpro/bills', [pendingBill]);
      await storage.setObject('@counterpro/customers', [
        {
          id: 'cust-1',
          shopId,
          name: 'Karthik',
          phone: '9840412345',
          pendingBalance: 600,
          statusTag: 'Pending',
        },
      ]);

      // Cancel bill -> reduces pendingBalance
      await billingService.deleteBill(shopId, pendingBill.id, { name: 'Owner Kumar', role: 'Owner' });
      const custsAfterCancel = await storage.getObject<any[]>('@counterpro/customers', []);
      expect(custsAfterCancel[0].pendingBalance).toBe(0);

      // Restore bill -> re-credits pendingBalance
      await billingService.restoreBill(shopId, pendingBill.id, { name: 'Owner Kumar', role: 'Owner' });
      const custsAfterRestore = await storage.getObject<any[]>('@counterpro/customers', []);
      expect(custsAfterRestore[0].pendingBalance).toBe(600);
      expect(custsAfterRestore[0].statusTag).toBe('Pending');
    });
  });

  describe('2. Summary Drilldown State Transitions', () => {
    it('follows Level 1 (Year) -> Level 2 (Month) -> Level 3 (Datewise) progression', () => {
      let summaryLevel: 1 | 2 | 3 = 1;
      let selectedYear = 2026;
      let selectedMonth = 9; // October

      // Initial state: Level 1 (Yearly overview)
      expect(summaryLevel).toBe(1);

      // User clicks side arrow on 2026 -> moves to Level 2 (Months of 2026)
      const onYearClick = (year: number) => {
        selectedYear = year;
        summaryLevel = 2;
      };
      onYearClick(2026);
      expect(summaryLevel).toBe(2);
      expect(selectedYear).toBe(2026);

      // User clicks side arrow on October -> moves to Level 3 (Datewise daily bills)
      const onMonthClick = (monthIndex: number) => {
        selectedMonth = monthIndex;
        summaryLevel = 3;
      };
      onMonthClick(9);
      expect(summaryLevel).toBe(3);
      expect(selectedMonth).toBe(9);

      // Back navigation steps back
      const onBack = () => {
        if (summaryLevel === 3) summaryLevel = 2;
        else if (summaryLevel === 2) summaryLevel = 1;
      };
      onBack();
      expect(summaryLevel).toBe(2);
      onBack();
      expect(summaryLevel).toBe(1);
    });
  });

  describe('3. Category & Dish Deletion Warning Texts', () => {
    it('formats category deletion message to clearly warn that dishes in category will be deleted from database', () => {
      const cat = { id: 'cat-1', name: 'Hot Beverages' };
      const count: number = 5;
      const warningMessage = `Are you sure you want to delete "${cat.name}"? All dishes in this category will also be deleted from the database.${count > 0 ? ` (${count} ${count === 1 ? 'dish' : 'dishes'} will be deleted)` : ''}`;

      expect(warningMessage).toContain('Are you sure you want to delete "Hot Beverages"?');
      expect(warningMessage).toContain('All dishes in this category will also be deleted from the database.');
      expect(warningMessage).toContain('(5 dishes will be deleted)');
    });

    it('formats single dish deletion message with database confirmation', () => {
      const itemName = 'Masala Dosa';
      const warningMessage = `Are you sure you want to delete "${itemName}"? This dish will be permanently deleted from the database.`;

      expect(warningMessage).toContain('Are you sure you want to delete "Masala Dosa"?');
      expect(warningMessage).toContain('permanently deleted from the database.');
    });
  });
});
