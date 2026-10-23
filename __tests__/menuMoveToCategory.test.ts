import { menuService } from '../src/services/menuService';
import { storage } from '../src/lib/storage';
import { MenuItem, MenuCategory } from '../src/types/models';

describe('Menu Management - Move To Category Feature', () => {
  const mockShopId = '00000000-0000-0000-0000-000000000001';
  const catDrinksId = '00000000-0000-0000-0000-000000000010';
  const catSnacksId = '00000000-0000-0000-0000-000000000020';
  const itemId = '00000000-0000-0000-0000-000000000100';

  beforeEach(async () => {
    await storage.removeItem('@counterpro/menu_categories');
    await storage.removeItem('@counterpro/menu_items');
  });

  it('moves an item to a different category via menuService.saveMenuItem', async () => {
    const categories: MenuCategory[] = [
      { id: catDrinksId, shopId: mockShopId, name: 'Cold Drinks', sortOrder: 0, isActive: true },
      { id: catSnacksId, shopId: mockShopId, name: 'Snacks', sortOrder: 1, isActive: true },
    ];
    await storage.setObject('@counterpro/menu_categories', categories);

    const initialItem: MenuItem = {
      id: itemId,
      shopId: mockShopId,
      categoryId: catDrinksId,
      name: 'Cold Coffee',
      price: 60,
      hasHalf: false,
      isFavorite: false,
      isAvailable: true,
      sortOrder: 0,
    };
    await storage.setObject('@counterpro/menu_items', [initialItem]);

    // Simulate "Move To" Snacks
    const movedItem: MenuItem = { ...initialItem, categoryId: catSnacksId };
    const result = await menuService.saveMenuItem(movedItem);

    const saved = result.find(i => i.id === itemId);
    expect(saved).toBeDefined();
    expect(saved?.categoryId).toBe(catSnacksId);

    // Verify persisted in local storage
    const stored = await storage.getObject<MenuItem[]>('@counterpro/menu_items', []);
    const storedItem = stored.find(i => i.id === itemId);
    expect(storedItem?.categoryId).toBe(catSnacksId);
  });
});
