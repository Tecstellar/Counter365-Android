import { syncEngine } from '../src/services/syncEngine';

describe('Offline Sync Engine & Idempotency', () => {
  test('enqueues operation with unique client_operation_id without duplicates', async () => {
    const opId = 'op_test_12345';
    await syncEngine.enqueue({
      operationId: opId,
      shopId: 'shop_1',
      action: 'create_bill',
      payload: { billNumber: '#0099', totalAmount: 120 },
    });

    // Enqueue duplicate
    await syncEngine.enqueue({
      operationId: opId,
      shopId: 'shop_1',
      action: 'create_bill',
      payload: { billNumber: '#0099', totalAmount: 120 },
    });

    const queue = await syncEngine.getQueue();
    const matches = queue.filter(q => q.operationId === opId);
    expect(matches.length).toBe(1);
  });
});
