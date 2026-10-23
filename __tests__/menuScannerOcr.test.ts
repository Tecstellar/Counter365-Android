import { geminiMenuScanner, parseRawOcrTextToMenuItems } from '../src/services/geminiMenuScanner';

describe('Menu Scanner & OCR Pipeline', () => {
  describe('parseRawOcrTextToMenuItems', () => {
    test('extracts single-priced items accurately from OCR text', () => {
      const ocrText = `
        SOUTH INDIAN TIFFIN
        Idli (2 Pcs) 30
        Medu Vada - Rs. 20
        Ghee Roast Dosa 60
        Poori Masala : 50
      `;

      const items = parseRawOcrTextToMenuItems(ocrText);
      expect(items.length).toBe(4);
      expect(items[0]).toMatchObject({
        name: 'Idli (2 Pcs)',
        price: 30,
        halfPrice: null,
        category: 'SOUTH INDIAN TIFFIN',
      });
      expect(items[1]).toMatchObject({
        name: 'Medu Vada',
        price: 20,
        halfPrice: null,
      });
      expect(items[2]).toMatchObject({
        name: 'Ghee Roast Dosa',
        price: 60,
      });
    });

    test('extracts dual-priced items with half portion prices', () => {
      const ocrText = `
        BIRYANI & RICE
        Chicken Biryani 180 / 110
        Veg Fried Rice 100 - 60
        Mutton Biryani Rs 260
      `;

      const items = parseRawOcrTextToMenuItems(ocrText);
      expect(items.length).toBe(3);
      expect(items[0]).toMatchObject({
        name: 'Chicken Biryani',
        price: 180,
        halfPrice: 110,
        category: 'BIRYANI & RICE',
      });
      expect(items[1]).toMatchObject({
        name: 'Veg Fried Rice',
        price: 100,
        halfPrice: 60,
      });
      expect(items[2]).toMatchObject({
        name: 'Mutton Biryani',
        price: 260,
        halfPrice: null,
      });
    });

    test('returns empty array when text has no dishes or prices', () => {
      const noisyText = `
        WELCOME TO OUR SHOP
        WIFI AVAILABLE
        PARKING INSIDE
        THANK YOU VISIT AGAIN
      `;

      const items = parseRawOcrTextToMenuItems(noisyText);
      expect(items).toEqual([]);
    });
  });

  describe('Zero Fake Items Policy', () => {
    test('never returns hardcoded dummy catalog when image has no menu text', async () => {
      // Mock fetch failure to simulate unreadable image or quota block
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const result = await geminiMenuScanner.scanMenuCard('invalid_base64_data', 'image/jpeg');
        expect(result.success).toBe(false);
        expect(result.items).toEqual([]);
        // Strictly verify that old fake dishes are NEVER returned
        const itemNames = result.items.map(i => i.name);
        expect(itemNames).not.toContain('Special Tea');
        expect(itemNames).not.toContain('Filter Coffee');
        expect(itemNames).not.toContain('Medu Vada');
        expect(result.error).toContain('Could not detect menu items');
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('returns error when no image data is provided', async () => {
      const result = await geminiMenuScanner.scanMenuCard('', 'image/jpeg');
      expect(result.success).toBe(false);
      expect(result.items).toEqual([]);
      expect(result.error).toBe('No image data provided');
    });

    test('extracts exact products and prices from Gemini structured response', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    { name: 'Special Dum Tea', price: 15, halfPrice: null, category: 'Tea & Coffee', icon: '☕' },
                    { name: 'Chicken Biryani', price: 180, halfPrice: 110, category: 'Meals', icon: '🍗' },
                    { name: 'Filter Coffee', price: 25, halfPrice: null, category: 'Tea & Coffee', icon: '☕' },
                  ]),
                },
              ],
            },
          },
        ],
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiResponse,
      } as any);

      try {
        const result = await geminiMenuScanner.scanMenuCard('data:image/jpeg;base64,samplebase64', 'image/jpeg');
        expect(result.success).toBe(true);
        expect(result.items.length).toBe(3);
        expect(result.items[0]).toMatchObject({
          name: 'Special Dum Tea',
          price: 15,
          halfPrice: null,
          category: 'Tea & Coffee',
        });
        expect(result.items[1]).toMatchObject({
          name: 'Chicken Biryani',
          price: 180,
          halfPrice: 110,
          category: 'Meals',
        });
        expect(result.items[2]).toMatchObject({
          name: 'Filter Coffee',
          price: 25,
          halfPrice: null,
          category: 'Tea & Coffee',
        });
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('extracts dishes without prices with price: 0 for buffet or unpriced menu cards', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    { name: 'Veg Pulao', price: 0, halfPrice: null, category: 'Buffet Specials', icon: '🍛' },
                    { name: 'Paneer Butter Masala', price: 0, halfPrice: null, category: 'Buffet Specials', icon: '🍲' },
                    { name: 'Gulab Jamun', price: 0, halfPrice: null, category: 'Dessert', icon: '🍩' },
                  ]),
                },
              ],
            },
          },
        ],
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiResponse,
      } as any);

      try {
        const result = await geminiMenuScanner.scanMenuCard('data:image/jpeg;base64,samplebuffet', 'image/jpeg');
        expect(result.success).toBe(true);
        expect(result.items.length).toBe(3);
        expect(result.items[0]).toMatchObject({
          name: 'Veg Pulao',
          price: 0,
          halfPrice: null,
          category: 'Buffet Specials',
        });
        expect(result.items[1]).toMatchObject({
          name: 'Paneer Butter Masala',
          price: 0,
        });
        expect(result.items[2]).toMatchObject({
          name: 'Gulab Jamun',
          price: 0,
        });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});


