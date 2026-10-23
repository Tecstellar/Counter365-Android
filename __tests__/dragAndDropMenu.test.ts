import { menuService } from '../src/services/menuService';
import { storage } from '../src/lib/storage';
import { MenuItem, MenuCategory } from '../src/types/models';

describe('Drag-and-Drop Menu Functionality', () => {
  const mockShopId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    // Clear storage keys
    await storage.removeItem('@counterpro/menu_categories');
    await storage.removeItem('@counterpro/menu_items');
  });

  it('1. Reorders categories and updates sort_order', async () => {
    const cats: MenuCategory[] = [
      { id: 'cat-1', shopId: mockShopId, name: 'Cold Drinks', sortOrder: 0, isActive: true },
      { id: 'cat-2', shopId: mockShopId, name: 'Tea', sortOrder: 1, isActive: true },
      { id: 'cat-3', shopId: mockShopId, name: 'Coffee', sortOrder: 2, isActive: true },
      { id: 'cat-4', shopId: mockShopId, name: 'Snacks', sortOrder: 3, isActive: true },
    ];
    await storage.setObject('@counterpro/menu_categories', cats);

    // Drag 'Coffee' to the front (first position)
    const newOrder = ['cat-3', 'cat-1', 'cat-2', 'cat-4'];
    const reordered = await menuService.updateCategoryOrder(mockShopId, newOrder);

    expect(reordered).toBeDefined();
    expect(reordered[0].id).toBe('cat-3');
    expect(reordered[0].sortOrder).toBe(0);
    expect(reordered[1].id).toBe('cat-1');
    expect(reordered[1].sortOrder).toBe(1);

    // Verify persisted in storage
    const stored = await storage.getObject<MenuCategory[]>('@counterpro/menu_categories', []);
    expect(stored[0].id).toBe('cat-3');
    expect(stored[0].sortOrder).toBe(0);
  });

  it('2. Moves an item to a new category and updates categoryId', async () => {
    const cat1Id = '00000000-0000-0000-0000-000000000011';
    const cat2Id = '00000000-0000-0000-0000-000000000022';
    const itemId = '00000000-0000-0000-0000-000000000101';

    const item: MenuItem = {
      id: itemId,
      shopId: mockShopId,
      categoryId: cat1Id,
      name: 'Lemon Soda',
      price: 25,
      hasHalf: false,
      isFavorite: false,
      isAvailable: true,
      sortOrder: 0,
    };
    await storage.setObject('@counterpro/menu_items', [item]);

    // Dropping 'Lemon Soda' into cat2
    const updatedItem = { ...item, categoryId: cat2Id };
    const items = (await menuService.saveMenuItem(updatedItem)).items;

    const saved = items.find(i => i.id === itemId);
    expect(saved).toBeDefined();
    expect(saved?.categoryId).toBe(cat2Id);

    // Verify storage persistence
    const storedItems = await storage.getObject<MenuItem[]>('@counterpro/menu_items', []);
    const storedItem = storedItems.find(i => i.id === itemId);
    expect(storedItem?.categoryId).toBe(cat2Id);
  });

  it('3. Optimistic count calculation matches item movements', () => {
    let items: MenuItem[] = [
      { id: 'i1', shopId: mockShopId, categoryId: 'cat-tea', name: 'Masala Tea', price: 15, hasHalf: false, isFavorite: false, isAvailable: true, sortOrder: 0 },
      { id: 'i2', shopId: mockShopId, categoryId: 'cat-tea', name: 'Green Tea', price: 20, hasHalf: false, isFavorite: false, isAvailable: true, sortOrder: 1 },
      { id: 'i3', shopId: mockShopId, categoryId: 'cat-snacks', name: 'Samosa', price: 15, hasHalf: false, isFavorite: false, isAvailable: true, sortOrder: 2 },
    ];

    const getCount = (catId: string, currentItems: MenuItem[]) => currentItems.filter(i => i.categoryId === catId).length;

    expect(getCount('cat-tea', items)).toBe(2);
    expect(getCount('cat-snacks', items)).toBe(1);

    // Move 'Green Tea' to 'cat-snacks'
    items = items.map(i => i.id === 'i2' ? { ...i, categoryId: 'cat-snacks' } : i);

    expect(getCount('cat-tea', items)).toBe(1);
    expect(getCount('cat-snacks', items)).toBe(2);
  });
});
