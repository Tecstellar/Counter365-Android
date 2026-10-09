import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { MenuItem, MenuCategory, ShopType } from '../types/models';
import { generateUUID } from '../lib/uuid';

const LOCAL_MENU_KEY = '@counterpro/menu_items';
const LOCAL_CATS_KEY = '@counterpro/menu_categories';

export const STARTER_CATALOGS: Record<ShopType, { categories: string[]; items: Array<{ name: string; price: number; cat: string }> }> = {
  'Tea Shop': {
    categories: ['Tea & Coffee', 'Snacks', 'Cold'],
    items: [
      { name: 'Tea', price: 12, cat: 'Tea & Coffee' },
      { name: 'Strong Tea', price: 15, cat: 'Tea & Coffee' },
      { name: 'Milk Coffee', price: 20, cat: 'Tea & Coffee' },
      { name: 'Black Tea', price: 10, cat: 'Tea & Coffee' },
      { name: 'Boost', price: 25, cat: 'Tea & Coffee' },
      { name: 'Horlicks', price: 25, cat: 'Tea & Coffee' },
      { name: 'Ginger Tea', price: 15, cat: 'Tea & Coffee' },
      { name: 'Elaichi Tea', price: 18, cat: 'Tea & Coffee' },
      { name: 'Vada', price: 12, cat: 'Snacks' },
      { name: 'Bonda', price: 10, cat: 'Snacks' },
      { name: 'Samosa', price: 15, cat: 'Snacks' },
      { name: 'Bun Butter', price: 30, cat: 'Snacks' },
      { name: 'Egg Puffs', price: 25, cat: 'Snacks' },
      { name: 'Biscuit', price: 10, cat: 'Snacks' },
      { name: 'Lemon Juice', price: 25, cat: 'Cold' },
      { name: 'Butter Milk', price: 20, cat: 'Cold' },
      { name: 'Cool Drink', price: 20, cat: 'Cold' },
      { name: 'Water 1L', price: 20, cat: 'Cold' },
    ]
  },
  'Cafe': {
    categories: ['Coffee', 'Bakes', 'Cold'],
    items: [
      { name: 'Espresso', price: 90, cat: 'Coffee' },
      { name: 'Cappuccino', price: 140, cat: 'Coffee' },
      { name: 'Latte', price: 150, cat: 'Coffee' },
      { name: 'Cold Brew', price: 170, cat: 'Coffee' },
      { name: 'Filter Coffee', price: 60, cat: 'Coffee' },
      { name: 'Hot Chocolate', price: 160, cat: 'Coffee' },
      { name: 'Croissant', price: 120, cat: 'Bakes' },
      { name: 'Brownie', price: 140, cat: 'Bakes' },
      { name: 'Banana Cake', price: 110, cat: 'Bakes' },
      { name: 'Cheese Toast', price: 160, cat: 'Bakes' },
      { name: 'Cookie', price: 60, cat: 'Bakes' },
      { name: 'Muffin', price: 130, cat: 'Bakes' },
      { name: 'Iced Latte', price: 180, cat: 'Cold' },
      { name: 'Lemonade', price: 110, cat: 'Cold' },
      { name: 'Milkshake', price: 190, cat: 'Cold' },
      { name: 'Water', price: 20, cat: 'Cold' },
    ]
  },
  'Fast Food': {
    categories: ['Rolls & Burgers', 'Fried', 'Cold'],
    items: [
      { name: 'Chicken Roll', price: 90, cat: 'Rolls & Burgers' },
      { name: 'Paneer Roll', price: 80, cat: 'Rolls & Burgers' },
      { name: 'Veg Burger', price: 70, cat: 'Rolls & Burgers' },
      { name: 'Chicken Burger', price: 110, cat: 'Rolls & Burgers' },
      { name: 'Shawarma', price: 120, cat: 'Rolls & Burgers' },
      { name: 'Egg Roll', price: 70, cat: 'Rolls & Burgers' },
      { name: 'French Fries', price: 80, cat: 'Fried' },
      { name: 'Chicken 65', price: 140, cat: 'Fried' },
      { name: 'Nuggets', price: 120, cat: 'Fried' },
      { name: 'Onion Rings', price: 70, cat: 'Fried' },
      { name: 'Popcorn Chicken', price: 130, cat: 'Fried' },
      { name: 'Momos', price: 90, cat: 'Fried' },
      { name: 'Cola', price: 40, cat: 'Cold' },
      { name: 'Cold Coffee', price: 90, cat: 'Cold' },
      { name: 'Mojito', price: 80, cat: 'Cold' },
      { name: 'Water', price: 20, cat: 'Cold' },
    ]
  },
  'Tiffin Shop': {
    categories: ['Morning', 'Evening', 'Add-ons'],
    items: [
      { name: 'Idly (2)', price: 20, cat: 'Morning' },
      { name: 'Poori (2)', price: 40, cat: 'Morning' },
      { name: 'Pongal', price: 40, cat: 'Morning' },
      { name: 'Vada', price: 12, cat: 'Morning' },
      { name: 'Upma', price: 30, cat: 'Morning' },
      { name: 'Dosa', price: 40, cat: 'Morning' },
      { name: 'Chapathi (2)', price: 35, cat: 'Evening' },
      { name: 'Parotta (2)', price: 40, cat: 'Evening' },
      { name: 'Kothu Parotta', price: 80, cat: 'Evening' },
      { name: 'Egg Dosa', price: 60, cat: 'Evening' },
      { name: 'Uthappam', price: 45, cat: 'Evening' },
      { name: 'Rice Meals', price: 90, cat: 'Evening' },
      { name: 'Extra Chutney', price: 10, cat: 'Add-ons' },
      { name: 'Sambar', price: 15, cat: 'Add-ons' },
      { name: 'Curd', price: 15, cat: 'Add-ons' },
      { name: 'Egg', price: 12, cat: 'Add-ons' },
    ]
  },
  'Restaurant': {
    categories: ['Starters', 'Main', 'Cold'],
    items: [
      { name: 'Chicken 65', price: 180, cat: 'Starters' },
      { name: 'Gobi 65', price: 150, cat: 'Starters' },
      { name: 'Chicken Soup', price: 110, cat: 'Starters' },
      { name: 'Prawn Fry', price: 260, cat: 'Starters' },
      { name: 'Paneer Tikka', price: 220, cat: 'Starters' },
      { name: 'Mushroom Pepper', price: 200, cat: 'Starters' },
      { name: 'Chicken Biryani', price: 260, cat: 'Main' },
      { name: 'Veg Biryani', price: 180, cat: 'Main' },
      { name: 'Fried Rice', price: 190, cat: 'Main' },
      { name: 'Noodles', price: 180, cat: 'Main' },
      { name: 'Full Meals', price: 160, cat: 'Main' },
      { name: 'Butter Naan', price: 45, cat: 'Main' },
      { name: 'Fresh Juice', price: 90, cat: 'Cold' },
      { name: 'Lassi', price: 80, cat: 'Cold' },
      { name: 'Soda', price: 40, cat: 'Cold' },
      { name: 'Water', price: 20, cat: 'Cold' },
    ]
  }
};

export const menuService = {
  /**
   * Fetch categories from local cache or Supabase
   */
  async getCategories(shopId: string, shopType: ShopType = 'Tea Shop'): Promise<MenuCategory[]> {
    if (!shopId) return [];

    // 1. Fetch live categories from Supabase to sync additions/changes across multi-device POS terminals (iOS, Android, Web)
    try {
      const { data: dbCats, error } = await (supabase.from('menu_categories') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('sort_order', { ascending: true });

      if (!error && dbCats && dbCats.length > 0) {
        const loaded: MenuCategory[] = dbCats.map((c: any) => ({
          id: c.id,
          shopId: c.shop_id,
          name: c.name,
          sortOrder: c.sort_order ?? 0,
          isActive: c.is_active ?? true,
        }));
        await storage.setObject(LOCAL_CATS_KEY, loaded);
        return loaded;
      }
    } catch (err) {
      console.warn('getCategories Supabase notice:', err);
    }

    // 2. Offline fallback: return locally cached categories if network query failed
    const saved = await storage.getObject<MenuCategory[] | null>(LOCAL_CATS_KEY, null);
    if (saved && saved.length > 0 && saved[0].shopId === shopId) return saved;

    return saved || [];
  },

  /**
   * Fetch menu items from local cache or Supabase
   */
  async getMenuItems(shopId: string, shopType: ShopType = 'Tea Shop'): Promise<MenuItem[]> {
    if (!shopId) return [];

    // 1. Fetch live menu items from Supabase to sync additions/changes across multi-device POS terminals (iOS, Android, Web)
    try {
      const { data: dbItems, error } = await (supabase.from('menu_items') as any)
        .select('*')
        .eq('shop_id', shopId)
        .order('sort_order', { ascending: true });

      if (!error && dbItems && dbItems.length > 0) {
        const loaded: MenuItem[] = dbItems.map((it: any) => ({
          id: it.id,
          shopId: it.shop_id,
          categoryId: it.category_id,
          name: it.name,
          price: Number(it.price || 0),
          halfPrice: Number(it.half_price || 0),
          hasHalf: it.has_half ?? false,
          isFavorite: it.is_favorite ?? false,
          isAvailable: it.is_available ?? true,
          imageUrl: it.image_url || null,
          imagePrompt: it.image_prompt || null,
          imageStatus: it.image_status || null,
          sortOrder: it.sort_order ?? 0,
        }));
        await storage.setObject(LOCAL_MENU_KEY, loaded);
        return loaded;
      }
    } catch (err) {
      console.warn('getMenuItems Supabase notice:', err);
    }

    // 2. Offline fallback: return locally cached items if network query failed
    const saved = await storage.getObject<MenuItem[] | null>(LOCAL_MENU_KEY, null);
    if (saved && saved.length > 0 && saved[0].shopId === shopId) {
      return saved.map(i => ({
        ...i,
        imageUrl: i.imageUrl || null,
      }));
    }

    return [];
  },

  /**
   * Add a new menu category and save to Supabase
   */
  async addCategory(shopId: string, name: string): Promise<MenuCategory> {
    const cleanName = name.trim();
    const cats = await this.getCategories(shopId);

    // Check if category with same name already exists
    const existing = cats.find(c => c.name.toLowerCase().trim() === cleanName.toLowerCase());
    if (existing) {
      return existing;
    }

    const newCat: MenuCategory = {
      id: generateUUID(),
      shopId,
      name: cleanName,
      sortOrder: cats.length,
      isActive: true,
    };

    try {
      const { data, error } = await (supabase.from('menu_categories') as any)
        .upsert(
          {
            id: newCat.id,
            shop_id: newCat.shopId,
            name: newCat.name,
            sort_order: newCat.sortOrder,
            is_active: true,
          },
          { onConflict: 'shop_id,name' }
        )
        .select('*')
        .single();

      if (!error && data) {
        newCat.id = data.id;
      }
    } catch (err) {
      console.warn('addCategory Supabase notice:', err);
    }

    const updated = [...cats.filter(c => c.id !== newCat.id), newCat];
    await storage.setObject(LOCAL_CATS_KEY, updated);
    return newCat;
  },

  /**
   * Update category name in Supabase and local cache
   */
  async updateCategory(shopId: string, categoryId: string, name: string): Promise<MenuCategory[]> {
    const cleanName = name.trim();
    const cats = await this.getCategories(shopId);
    const updated = cats.map(c => c.id === categoryId ? { ...c, name: cleanName } : c);
    await storage.setObject(LOCAL_CATS_KEY, updated);

    try {
      await (supabase.from('menu_categories') as any)
        .update({ name: cleanName, updated_at: new Date().toISOString() })
        .eq('id', categoryId)
        .eq('shop_id', shopId);
    } catch (err) {
      console.warn('updateCategory Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Delete a category and its assigned items from Supabase and local cache
   */
  async deleteCategory(shopId: string, categoryId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const cats = await this.getCategories(shopId);
    const items = await this.getMenuItems(shopId);

    const updatedCats = cats.filter(c => c.id !== categoryId);
    const updatedItems = items.filter(i => i.categoryId !== categoryId);

    await storage.setObject(LOCAL_CATS_KEY, updatedCats);
    await storage.setObject(LOCAL_MENU_KEY, updatedItems);

    try {
      // 1. Delete items under this category first (to satisfy ON DELETE RESTRICT foreign key)
      await (supabase.from('menu_items') as any)
        .delete()
        .eq('category_id', categoryId)
        .eq('shop_id', shopId);

      // 2. Delete the category itself
      await (supabase.from('menu_categories') as any)
        .delete()
        .eq('id', categoryId)
        .eq('shop_id', shopId);
    } catch (err) {
      console.warn('deleteCategory Supabase notice:', err);
    }

    return { categories: updatedCats, items: updatedItems };
  },

  /**
   * Save / update a menu item in Supabase and local cache
   */
  async saveMenuItem(item: MenuItem): Promise<MenuItem[]> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validatedId = uuidRegex.test(item.id) ? item.id : generateUUID();

    let validCategoryId = item.categoryId;
    if (!validCategoryId || !uuidRegex.test(validCategoryId)) {
      const cats = await this.getCategories(item.shopId);
      const matched = cats.find(c => uuidRegex.test(c.id));
      if (matched) {
        validCategoryId = matched.id;
      } else {
        const fallbackCat = await this.addCategory(item.shopId, 'General');
        validCategoryId = fallbackCat.id;
      }
    }

    const itemToSave: MenuItem = {
      ...item,
      id: validatedId,
      categoryId: validCategoryId,
      name: item.name.trim(),
      price: Number(item.price || 0),
      halfPrice: item.halfPrice ? Number(item.halfPrice) : undefined,
    };

    const items = await this.getMenuItems(itemToSave.shopId);
    const idx = items.findIndex(i => i.id === itemToSave.id);
    let updated: MenuItem[];
    if (idx > -1) {
      updated = [...items];
      updated[idx] = itemToSave;
    } else {
      updated = [...items, itemToSave];
    }
    await storage.setObject(LOCAL_MENU_KEY, updated);

    try {
      const { error } = await (supabase.from('menu_items') as any).upsert(
        {
          id: itemToSave.id,
          shop_id: itemToSave.shopId,
          category_id: itemToSave.categoryId,
          name: itemToSave.name,
          price: itemToSave.price,
          half_price: itemToSave.halfPrice || 0,
          has_half: itemToSave.hasHalf ?? false,
          is_favorite: itemToSave.isFavorite ?? false,
          is_available: itemToSave.isAvailable ?? true,
          image_url: itemToSave.imageUrl || null,
          image_prompt: itemToSave.imagePrompt || null,
          image_status: itemToSave.imageStatus || 'completed',
          sort_order: itemToSave.sortOrder ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.error('saveMenuItem Supabase error:', error);
      }
    } catch (err) {
      console.warn('saveMenuItem Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Delete a menu item from Supabase and local cache
   */
  async deleteMenuItem(shopId: string, itemId: string): Promise<MenuItem[]> {
    const items = await this.getMenuItems(shopId);
    const updated = items.filter(i => i.id !== itemId);
    await storage.setObject(LOCAL_MENU_KEY, updated);

    try {
      const { error } = await (supabase.from('menu_items') as any)
        .delete()
        .eq('id', itemId)
        .eq('shop_id', shopId);

      if (error) {
        console.error('deleteMenuItem Supabase error:', error);
      }
    } catch (err) {
      console.warn('deleteMenuItem Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Toggle item availability
   */
  async toggleAvailability(itemId: string): Promise<MenuItem[]> {
    const items = await storage.getObject<MenuItem[]>(LOCAL_MENU_KEY, []);
    const target = items.find(i => i.id === itemId);
    const newAvail = target ? !target.isAvailable : true;
    const updated = items.map(i => i.id === itemId ? { ...i, isAvailable: newAvail } : i);
    await storage.setObject(LOCAL_MENU_KEY, updated);

    try {
      await (supabase.from('menu_items') as any)
        .update({ is_available: newAvail })
        .eq('id', itemId);
    } catch (err) {
      console.warn('toggleAvailability Supabase notice:', err);
    }

    return updated;
  },

  /**
   * Toggle item favorite
   */
  async toggleFavorite(itemId: string): Promise<MenuItem[]> {
    const items = await storage.getObject<MenuItem[]>(LOCAL_MENU_KEY, []);
    const target = items.find(i => i.id === itemId);
    const newFav = target ? !target.isFavorite : true;
    const updated = items.map(i => i.id === itemId ? { ...i, isFavorite: newFav } : i);
    await storage.setObject(LOCAL_MENU_KEY, updated);

    try {
      await (supabase.from('menu_items') as any)
        .update({ is_favorite: newFav })
        .eq('id', itemId);
    } catch (err) {
      console.warn('toggleFavorite Supabase notice:', err);
    }

    return updated;
  },

  async reorderItems(items: MenuItem[]): Promise<void> {
    await storage.setObject(LOCAL_MENU_KEY, items);
  },

  /**
   * Bootstraps starter menu catalog for a newly registered shop in Supabase and local cache
   */
  async bootstrapShopCatalog(shopId: string, shopType: ShopType): Promise<void> {
    const catalog = STARTER_CATALOGS[shopType] || STARTER_CATALOGS['Tea Shop'];

    const categories: MenuCategory[] = catalog.categories.map((cName, idx) => ({
      id: generateUUID(),
      shopId,
      name: cName,
      sortOrder: idx,
      isActive: true,
    }));

    const items: MenuItem[] = catalog.items.map((it, idx) => {
      const cat = categories.find(c => c.name === it.cat) || categories[0];
      return {
        id: generateUUID(),
        shopId,
        categoryId: cat.id,
        name: it.name,
        price: it.price,
        halfPrice: it.price <= 60 ? Math.round(it.price * 0.6) : 0,
        hasHalf: it.price <= 60,
        isFavorite: idx < 3,
        isAvailable: true,
        imageUrl: null,
        sortOrder: idx,
      };
    });

    await storage.setObject(LOCAL_CATS_KEY, categories);
    await storage.setObject(LOCAL_MENU_KEY, items);

    // Persist all categories to Supabase
    try {
      await (supabase.from('menu_categories') as any).upsert(
        categories.map(c => ({
          id: c.id,
          shop_id: c.shopId,
          name: c.name,
          sort_order: c.sortOrder,
          is_active: true,
        })),
        { onConflict: 'shop_id,name' }
      );
    } catch (cErr) {
      console.warn('bootstrapShopCatalog categories notice:', cErr);
    }

    // Persist all menu items to Supabase
    try {
      await (supabase.from('menu_items') as any).upsert(
        items.map(it => ({
          id: it.id,
          shop_id: it.shopId,
          category_id: it.categoryId,
          name: it.name,
          price: it.price,
          half_price: it.halfPrice,
          has_half: it.hasHalf,
          is_favorite: it.isFavorite,
          is_available: it.isAvailable,
          image_url: it.imageUrl,
          sort_order: it.sortOrder,
        })),
        { onConflict: 'id' }
      );
    } catch (iErr) {
      console.warn('bootstrapShopCatalog items notice:', iErr);
    }
  },

  /**
   * Batch adds scanned or imported menu items to local cache and Supabase
   */
  async batchAddMenuItems(
    shopId: string,
    newItems: Array<{
      name: string;
      price: number;
      halfPrice?: number | null;
      category: string;
      imageUrl?: string;
      imagePrompt?: string;
      imageStatus?: 'pending' | 'generating' | 'completed' | 'failed';
    }>
  ): Promise<{ addedItems: MenuItem[]; updatedCategories: MenuCategory[] }> {
    if (!shopId || newItems.length === 0) {
      return { addedItems: [], updatedCategories: [] };
    }

    // 1. Fetch live categories from Supabase (authoritative source)
    let currentCats = await this.getCategories(shopId);
    const catMap = new Map<string, string>();
    currentCats.forEach(c => catMap.set(c.name.toLowerCase().trim(), c.id));

    // 2. Identify missing categories
    const requiredCatNames = Array.from(
      new Set(newItems.map(it => (it.category || 'General').trim()).filter(Boolean))
    );

    const catsToUpsert: Array<{ shop_id: string; name: string; sort_order: number; is_active: boolean }> = [];
    for (const cName of requiredCatNames) {
      if (!catMap.has(cName.toLowerCase())) {
        catsToUpsert.push({
          shop_id: shopId,
          name: cName,
          sort_order: currentCats.length + catsToUpsert.length,
          is_active: true,
        });
      }
    }

    if (catsToUpsert.length > 0) {
      // Create local category entries immediately
      catsToUpsert.forEach(c => {
        const catId = generateUUID();
        catMap.set(c.name.toLowerCase().trim(), catId);
        currentCats.push({
          id: catId,
          shopId,
          name: c.name,
          sortOrder: c.sort_order,
          isActive: true,
        });
      });

      try {
        const { data: upsertedCats, error: catErr } = await (supabase.from('menu_categories') as any)
          .upsert(catsToUpsert, { onConflict: 'shop_id,name' })
          .select('id, name, sort_order, is_active');

        if (catErr) {
          console.error('batchAddMenuItems categories upsert error:', catErr);
        } else if (upsertedCats) {
          upsertedCats.forEach((c: any) => {
            catMap.set(c.name.toLowerCase().trim(), c.id);
            const found = currentCats.find(existing => existing.name.toLowerCase() === c.name.toLowerCase());
            if (found) {
              found.id = c.id;
            }
          });
        }
      } catch (catEx) {
        console.warn('batchAddMenuItems categories notice:', catEx);
      }

      await storage.setObject(LOCAL_CATS_KEY, currentCats);
    }

    // 3. Fallback category ID if any category couldn't be resolved
    const defaultCatId = currentCats[0]?.id || generateUUID();

    // 4. Create MenuItem instances with valid category IDs
    const existingItems = await this.getMenuItems(shopId);
    const createdItems: MenuItem[] = newItems.map((it, idx) => {
      const catKey = (it.category || '').toLowerCase().trim();
      const catId = catMap.get(catKey) || defaultCatId;
      const imgUrl = it.imageUrl || null;
      const fullPrice = Math.max(0, Number(it.price) || 0);
      const halfPrice = it.halfPrice ? Number(it.halfPrice) : 0;
      const hasHalf = Boolean(halfPrice > 0 && halfPrice < fullPrice);

      return {
        id: generateUUID(),
        shopId,
        categoryId: catId,
        name: it.name.trim(),
        price: fullPrice,
        halfPrice: hasHalf ? halfPrice : undefined,
        hasHalf,
        isFavorite: false,
        isAvailable: true,
        imageUrl: imgUrl,
        imagePrompt: it.imagePrompt || null,
        imageStatus: it.imageStatus || (imgUrl ? 'completed' : null),
        sortOrder: existingItems.length + idx,
      };
    });

    // 5. Batch persist to Supabase
    try {
      const { error: itemErr } = await (supabase.from('menu_items') as any)
        .upsert(
          createdItems.map(it => ({
            id: it.id,
            shop_id: it.shopId,
            category_id: it.categoryId,
            name: it.name,
            price: it.price,
            half_price: it.halfPrice || 0,
            has_half: it.hasHalf,
            is_favorite: it.isFavorite,
            is_available: it.isAvailable,
            image_url: it.imageUrl,
            sort_order: it.sortOrder,
          })),
          { onConflict: 'id' }
        );

      if (itemErr) {
        console.error('batchAddMenuItems Supabase error:', itemErr);
      }
    } catch (itemEx) {
      console.warn('batchAddMenuItems Supabase notice:', itemEx);
    }

    // 6. Update local storage with complete updated items
    const updatedAllItems = [...existingItems, ...createdItems];
    await storage.setObject(LOCAL_MENU_KEY, updatedAllItems);

    return {
      addedItems: createdItems,
      updatedCategories: currentCats,
    };
  },

  /**
   * Updates an item's food image URL and status in local storage and Supabase
   */
  async updateItemImage(
    shopId: string,
    itemId: string,
    imageUrl: string,
    imageStatus: 'completed' | 'failed' = 'completed'
  ): Promise<MenuItem[]> {
    const items = await this.getMenuItems(shopId);
    const updated = items.map(i =>
      i.id === itemId
        ? { ...i, imageUrl, imageStatus }
        : i
    );
    await storage.setObject(LOCAL_MENU_KEY, updated);

    try {
      await (supabase.from('menu_items') as any)
        .update({
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    } catch (err) {
      console.warn('updateItemImage notice:', err);
    }

    return updated;
  },
};
