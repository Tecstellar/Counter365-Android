import { menuService } from '../src/services/menuService';
import { storage } from '../src/lib/storage';
import { MenuItem } from '../src/types/models';

describe('Menu Bulk Edit and Actions Menu', () => {
  const testShopId = 'test-shop-bulk-edit';

  beforeEach(async () => {
    await storage.clear();
  });

  it('batch updates multiple menu item prices correctly and persists locally', async () => {
    const initialItems: MenuItem[] = [
      {
        id: 'item-1',
        shopId: testShopId,
        categoryId: 'cat-1',
        name: 'Tea',
        price: 15,
        halfPrice: 0,
        hasHalf: false,
        isFavorite: false,
        isAvailable: true,
        sortOrder: 0,
      },
      {
        id: 'item-2',
        shopId: testShopId,
        categoryId: 'cat-1',
        name: 'Coffee',
        price: 20,
        halfPrice: 12,
        hasHalf: true,
        isFavorite: true,
        isAvailable: true,
        sortOrder: 1,
      },
    ];

    await storage.setObject('@counterpro/menu_items', initialItems);

    const updates: MenuItem[] = [
      {
        ...initialItems[0],
        price: 20, // +5
      },
      {
        ...initialItems[1],
        price: 25, // +5
        halfPrice: 15, // +3
      },
    ];

    const result = await menuService.batchUpdateMenuItems(testShopId, updates);

    expect(result).toBeDefined();
    const tea = result.find(i => i.id === 'item-1');
    const coffee = result.find(i => i.id === 'item-2');

    expect(tea?.price).toBe(20);
    expect(coffee?.price).toBe(25);
    expect(coffee?.halfPrice).toBe(15);

    // Verify persisted in local storage
    const cached = await storage.getObject<MenuItem[]>('@counterpro/menu_items', []);
    expect(cached.find(i => i.id === 'item-1')?.price).toBe(20);
    expect(cached.find(i => i.id === 'item-2')?.price).toBe(25);
    expect(cached.find(i => i.id === 'item-2')?.halfPrice).toBe(15);
  });

  it('deletes menu items batch and persists locally', async () => {
    const initialItems: MenuItem[] = [
      {
        id: 'del-1',
        shopId: testShopId,
        categoryId: 'cat-1',
        name: 'Dish A',
        price: 50,
        halfPrice: 0,
        hasHalf: false,
        isFavorite: false,
        isAvailable: true,
        sortOrder: 0,
      },
      {
        id: 'del-2',
        shopId: testShopId,
        categoryId: 'cat-1',
        name: 'Dish B',
        price: 60,
        halfPrice: 0,
        hasHalf: false,
        isFavorite: false,
        isAvailable: true,
        sortOrder: 1,
      },
      {
        id: 'keep-1',
        shopId: testShopId,
        categoryId: 'cat-1',
        name: 'Dish C',
        price: 70,
        halfPrice: 0,
        hasHalf: false,
        isFavorite: false,
        isAvailable: true,
        sortOrder: 2,
      },
    ];

    await storage.setObject('@counterpro/menu_items', initialItems);

    const remaining = await menuService.deleteMenuItemsBatch(testShopId, ['del-1', 'del-2']);

    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('Dish C');

    const cached = await storage.getObject<MenuItem[]>('@counterpro/menu_items', []);
    expect(cached.length).toBe(1);
    expect(cached[0].id).toBe('keep-1');
  });
});
