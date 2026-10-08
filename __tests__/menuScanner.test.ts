import { getDishImageUrl, DISH_IMAGE_MAP } from '../src/constants/dishImages';
import { geminiMenuScanner } from '../src/services/geminiMenuScanner';

describe('Dish Images & Menu Scanner', () => {
  describe('getDishImageUrl', () => {
    it('matches exact dish names', () => {
      const teaUrl = getDishImageUrl('tea');
      expect(teaUrl).toContain('unsplash.com');
      expect(teaUrl).toEqual(DISH_IMAGE_MAP['tea']);
    });

    it('matches specific beverages and coffees accurately', () => {
      expect(getDishImageUrl('Special Filter Coffee')).toBe(DISH_IMAGE_MAP['filter coffee']);
      expect(getDishImageUrl('Iced Cold Coffee')).toBe(DISH_IMAGE_MAP['cold coffee']);
      expect(getDishImageUrl('Fresh Masala Chai')).toBe(DISH_IMAGE_MAP['masala chai']);
      expect(getDishImageUrl('Hot Ginger Tea')).toBe(DISH_IMAGE_MAP['ginger tea']);
    });

    it('matches snacks and savouries accurately', () => {
      expect(getDishImageUrl('Crispy Samosa')).toBe(DISH_IMAGE_MAP['samosa']);
      expect(getDishImageUrl('Medu Vada (2 pcs)')).toBe(DISH_IMAGE_MAP['medu vada']);
      expect(getDishImageUrl('Hot Egg Puffs')).toBe(DISH_IMAGE_MAP['egg puffs']);
      expect(getDishImageUrl('Bun Butter Maska')).toBe(DISH_IMAGE_MAP['bun maska']);
      expect(getDishImageUrl('Crispy French Fries')).toBe(DISH_IMAGE_MAP['french fries']);
    });

    it('matches South Indian tiffin & main dishes accurately', () => {
      expect(getDishImageUrl('Steamed Idly (2)')).toBe(DISH_IMAGE_MAP['idly']);
      expect(getDishImageUrl('Ghee Masala Dosa')).toBe(DISH_IMAGE_MAP['masala dosa']);
      expect(getDishImageUrl('Chicken Biryani')).toBe(DISH_IMAGE_MAP['chicken biryani']);
    });

    it('ensures distinct dishes have distinct unique photo URLs with no collisions', () => {
      const vadaImg = getDishImageUrl('vada');
      const bondaImg = getDishImageUrl('bonda');
      const pooriImg = getDishImageUrl('poori');
      const parottaImg = getDishImageUrl('parotta');
      const idlyImg = getDishImageUrl('idly');
      const mealsImg = getDishImageUrl('meals');
      const chapatiImg = getDishImageUrl('chapati');

      expect(vadaImg).not.toBe(bondaImg);
      expect(vadaImg).not.toBe(pooriImg);
      expect(pooriImg).not.toBe(parottaImg);
      expect(idlyImg).not.toBe(mealsImg);
      expect(chapatiImg).not.toBe(parottaImg);
    });

    it('matches exact slug hints provided by AI scanner', () => {
      expect(getDishImageUrl('House Special Drink', 'Beverages', 'lemon_juice')).toBe(DISH_IMAGE_MAP['lemon juice']);
      expect(getDishImageUrl('Chef Secret Snack', 'Snacks', 'samosa')).toBe(DISH_IMAGE_MAP['samosa']);
    });

    it('preserves existing custom URLs', () => {
      const custom = 'https://example.com/my-photo.jpg';
      const url = getDishImageUrl('tea', 'Tea & Coffee', undefined, custom);
      expect(url).toBe(custom);
    });
  });

  describe('geminiMenuScanner', () => {
    it('returns error when no base64 data provided', async () => {
      const res = await geminiMenuScanner.scanMenuCard('');
      expect(res.success).toBe(false);
      expect(res.items).toEqual([]);
      expect(res.error).toBe('No image data provided');
    });
  });
});
