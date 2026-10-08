import { generatePhotorealisticFoodPrompt } from '../src/services/geminiImagePromptGenerator';
import { geminiImageService } from '../src/services/geminiImageService';
import { imageStorageService } from '../src/services/imageStorageService';
import { geminiMenuScanner, ScannedMenuItem } from '../src/services/geminiMenuScanner';

describe('Gemini Photorealistic Food Image Pipeline', () => {
  describe('1. Culinary AI Prompt Generation', () => {
    it('generates photorealistic prompt for Tea with exact container, appearance, and lighting', () => {
      const prompt = generatePhotorealisticFoodPrompt('Tea', 'Tea & Coffee');
      expect(prompt).toContain('Photorealistic commercial restaurant food photography');
      expect(prompt).toContain('Indian transparent tea glass');
      expect(prompt).toContain('caramel-brown milk tea');
      expect(prompt).toContain('steam');
      expect(prompt).toContain('warm cream off-white background');
      expect(prompt).toContain('Square 1:1');
      expect(prompt).toContain('No people');
      expect(prompt).toContain('no text');
      expect(prompt).toContain('no logo');
      expect(prompt).toContain('no illustration');
      expect(prompt).toContain('no 3D render');
    });

    it('generates photorealistic prompt for Filter Coffee in South Indian dabarah and tumbler', () => {
      const prompt = generatePhotorealisticFoodPrompt('Filter Coffee', 'Tea & Coffee');
      expect(prompt).toContain('South Indian stainless steel dabarah and tumbler');
      expect(prompt).toContain('creamy foam');
      expect(prompt).toContain('Square 1:1');
      expect(prompt).toContain('warm cream off-white background');
    });

    it('generates photorealistic prompt for Samosa with flaky pastry and frying bubbles', () => {
      const prompt = generatePhotorealisticFoodPrompt('Samosa', 'Snacks');
      expect(prompt).toContain('golden-brown Indian samosa');
      expect(prompt).toContain('crisp flaky fried pastry');
      expect(prompt).toContain('triangular shape');
      expect(prompt).toContain('Square 1:1');
      expect(prompt).toContain('No people');
      expect(prompt).toContain('no hands');
    });

    it('generates photorealistic prompt for Medu Vada with authentic doughnut shape & crispy texture', () => {
      const prompt = generatePhotorealisticFoodPrompt('Medu Vada', 'Snacks');
      expect(prompt).toContain('South Indian medu vada');
      expect(prompt).toContain('doughnut ring shape with a neat central hole');
      expect(prompt).toContain('crunchy golden textured crust');
      expect(prompt).toContain('Square 1:1');
    });

    it('generates photorealistic prompt for Bun Butter and Jam', () => {
      const prompt = generatePhotorealisticFoodPrompt('Bun Butter Jam', 'Snacks');
      expect(prompt).toContain('soft bakery bun');
      expect(prompt).toContain('butter');
      expect(prompt).toContain('jam');
      expect(prompt).toContain('Square 1:1');
    });

    it('generates photorealistic prompt for Egg Puff with laminated flaky layers', () => {
      const prompt = generatePhotorealisticFoodPrompt('Egg Puff', 'Snacks');
      expect(prompt).toContain('puff pastry');
      expect(prompt).toContain('egg');
      expect(prompt).toContain('Square 1:1');
    });

    it('infers realistic representation for unknown dishes without inventing unrelated food', () => {
      // Inferred beverage
      const shakePrompt = generatePhotorealisticFoodPrompt('Cold Chocolate Shake', 'Beverages');
      expect(shakePrompt).toContain('beverage glass');
      expect(shakePrompt).toContain('Cold Chocolate Shake');
      expect(shakePrompt).toContain('Square 1:1');

      // Inferred bakery
      const puffPrompt = generatePhotorealisticFoodPrompt('Paneer Tikka Puff', 'Snacks');
      expect(puffPrompt).toContain('Paneer Tikka Puff');
      expect(puffPrompt).toContain('baked');
      expect(puffPrompt).toContain('Square 1:1');

      // Inferred meal
      const ricePrompt = generatePhotorealisticFoodPrompt('Ghee Jeera Rice', 'Meals');
      expect(ricePrompt).toContain('Ghee Jeera Rice');
      expect(ricePrompt).toContain('dish');
      expect(ricePrompt).toContain('Square 1:1');
    });

    it('enforces universal visual style across all prompts', () => {
      const dishes = ['Vada', 'Bonda', 'Idli', 'Dosa', 'Pongal', 'Chicken Biryani', 'Badam Milk'];
      for (const d of dishes) {
        const p = generatePhotorealisticFoodPrompt(d);
        expect(p).toContain('Photorealistic');
        expect(p).toContain('Square 1:1');
        expect(p).toContain('warm cream off-white background');
        expect(p).toContain('diffused restaurant studio lighting');
        expect(p).toContain('No people');
        expect(p).toContain('no text');
        expect(p).toContain('no logo');
        expect(p).toContain('no illustration');
        expect(p).toContain('no 3D render');
      }
    });
  });

  describe('2. Gemini Image Generation Service', () => {
    it('returns error when prompt is empty or blank', async () => {
      const res = await geminiImageService.generateFoodImage('');
      expect(res.success).toBe(false);
      expect(res.error).toContain('No prompt provided');
    });
  });

  describe('3. Food Image Storage Service', () => {
    it('accurately identifies valid custom images and rejects empty or unsplash URLs', () => {
      expect(imageStorageService.hasValidFoodImage('https://storage.supabase.co/img.jpg')).toBe(true);
      expect(imageStorageService.hasValidFoodImage('file:///data/user/0/img.jpg')).toBe(true);
      expect(imageStorageService.hasValidFoodImage('data:image/jpeg;base64,12345')).toBe(true);

      expect(imageStorageService.hasValidFoodImage('')).toBe(false);
      expect(imageStorageService.hasValidFoodImage(null)).toBe(false);
      expect(imageStorageService.hasValidFoodImage(undefined)).toBe(false);
      expect(imageStorageService.hasValidFoodImage('https://images.unsplash.com/photo-123')).toBe(false);
    });

    it('persists image and returns a valid URI', async () => {
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const uri = await imageStorageService.persistFoodImage('shop_123', 'tea_01', mockBase64, 'image/png');
      expect(typeof uri).toBe('string');
      expect(uri.length).toBeGreaterThan(10);
    });
  });

  describe('4. Menu Scanner Integration with Image Generation', () => {
    it('returns failure when no base64 data provided', async () => {
      const res = await geminiMenuScanner.scanMenuCard('');
      expect(res.success).toBe(false);
      expect(res.items).toEqual([]);
      expect(res.error).toBe('No image data provided');
    });

    it('supplies every fallback item with an authentic photorealistic image prompt', async () => {
      const res = await geminiMenuScanner.scanMenuCard('invalid_data_triggers_fallback');
      expect(res.success).toBe(true);
      expect(res.items.length).toBeGreaterThan(0);

      for (const item of res.items) {
        expect(item.imagePrompt).toBeDefined();
        expect(item.imagePrompt).toContain('Photorealistic');
        expect(item.imagePrompt).toContain('Square 1:1');
        expect(item.imagePrompt).toContain('warm cream off-white background');
        expect(item.imageStatus).toBe('pending');
      }
    });

    it('duplicate protection: skips re-generation if valid image already exists', async () => {
      const existingItem: ScannedMenuItem = {
        name: 'Special Tea',
        price: 15,
        category: 'Tea & Coffee',
        imageUrl: 'https://my-bucket.supabase.co/tea.jpg',
      };

      const result = await geminiMenuScanner.generateImageForItem('shop_123', existingItem);
      expect(result.imageUrl).toBe(existingItem.imageUrl);
      expect(result.imageStatus).toBe('completed');
    });

    it('failure handling: marks imageStatus as failed without crashing or discarding item', async () => {
      const itemToFail: ScannedMenuItem = {
        name: 'Test Dish',
        price: 50,
        category: 'Snacks',
        imagePrompt: 'Photorealistic dish',
      };

      // Mock geminiImageService to simulate temporary quota/network exhaustion
      const originalMethod = geminiImageService.generateFoodImage;
      geminiImageService.generateFoodImage = jest.fn().mockResolvedValue({
        success: false,
        error: 'Quota exceeded 429',
      });

      const result = await geminiMenuScanner.generateImageForItem('shop_123', itemToFail);

      expect(result.name).toBe('Test Dish');
      expect(result.price).toBe(50);
      expect(result.imageStatus).toBe('failed');
      expect(result.imageUrl).toBeUndefined();

      // Restore original method
      geminiImageService.generateFoodImage = originalMethod;
    });
  });
});
