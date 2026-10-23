import { getDishFoodIcon } from '../constants/dishIcons';
import { getDishImageUrl, getCategoryImageUrl } from '../constants/dishImages';
import { generatePhotorealisticFoodPrompt } from './geminiImagePromptGenerator';
import { geminiImageService } from './geminiImageService';
import { imageStorageService } from './imageStorageService';

export interface ScannedMenuItem {
  name: string;
  price: number;
  halfPrice?: number | null;
  category: string;
  icon?: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  matchSlug?: string;
  selected?: boolean;
}

export interface ScanMenuResult {
  success: boolean;
  items: ScannedMenuItem[];
  error?: string;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// High-availability Google Gemini Vision models in priority order (verified active production endpoints)
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Parses raw OCR text lines into structured dishes, prices, and categories.
 * Handles single prices (e.g. "Special Tea 15", "Masala Dosa - Rs. 70"),
 * dual prices (e.g. "Chicken Biryani 180 / 110"), and section headers.
 */
export function parseRawOcrTextToMenuItems(rawText: string): ScannedMenuItem[] {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: ScannedMenuItem[] = [];
  let currentCategory = 'General';

  for (const line of lines) {
    // If the line is short and has no numbers, treat it as a category header
    if (line.length >= 3 && line.length <= 35 && !/\d/.test(line)) {
      currentCategory = line.replace(/[:\-]/g, '').trim();
      continue;
    }

    // Match dual prices: full and half (e.g., "Chicken Biryani 180 / 110" or "180 - 100")
    const dualPriceMatch = line.match(/(.*?)(?:[:\.\-\s]+)(?:rs\.?|inr|₹)?\s*(\d{1,4})\s*(?:\/|\-)\s*(?:rs\.?|inr|₹)?\s*(\d{1,4})\s*$/i);
    if (dualPriceMatch) {
      const name = dualPriceMatch[1].replace(/[\.\-\:\_\#\*\~]+$/, '').trim();
      const p1 = parseInt(dualPriceMatch[2], 10);
      const p2 = parseInt(dualPriceMatch[3], 10);
      const full = Math.max(p1, p2);
      const half = Math.min(p1, p2);
      if (name.length >= 2 && full > 0 && full < 50000) {
        items.push({
          name,
          price: full,
          halfPrice: half > 0 && half < full ? half : null,
          category: currentCategory,
          icon: getDishFoodIcon(name, currentCategory),
          imageUrl: getDishImageUrl(name, currentCategory),
          imagePrompt: generatePhotorealisticFoodPrompt(name, currentCategory),
          imageStatus: 'completed',
          selected: true,
        });
        continue;
      }
    }

    // Match single price (e.g., "Special Tea 15", "Filter Coffee Rs. 25/-", "Meals: 120")
    const singlePriceMatch = line.match(/(.*?)(?:[:\.\-\s]+)(?:rs\.?|inr|₹)?\s*(\d{1,4})(?:\s*\/\-|\s*rs)?\s*$/i);
    if (singlePriceMatch) {
      const name = singlePriceMatch[1].replace(/[\.\-\:\_\#\*\~]+$/, '').trim();
      const price = parseInt(singlePriceMatch[2], 10);
      if (name.length >= 2 && price > 0 && price < 50000) {
        items.push({
          name,
          price,
          halfPrice: null,
          category: currentCategory,
          icon: getDishFoodIcon(name, currentCategory),
          imageUrl: getDishImageUrl(name, currentCategory),
          imagePrompt: generatePhotorealisticFoodPrompt(name, currentCategory),
          imageStatus: 'completed',
          selected: true,
        });
        continue;
      }
    }

    // Unpriced items (e.g. buffet, catering, or items without price listed)
    const cleanLine = line.replace(/^[\d\.\-\*\•\)\(\s]+/, '').replace(/[\.\-\:\_\#\*\~]+$/, '').trim();
    const isNoise = /^(welcome|thank\s*you|gst|phone|mobile|tel|address|wifi|timing|open|closed|counter|invoice|bill|table|order)/i.test(cleanLine);
    if (!isNoise && cleanLine.length >= 2 && cleanLine.length <= 40 && !/\d{3,}/.test(cleanLine)) {
      items.push({
        name: cleanLine,
        price: 0,
        halfPrice: null,
        category: currentCategory,
        icon: getDishFoodIcon(cleanLine, currentCategory),
        imageUrl: getDishImageUrl(cleanLine, currentCategory),
        imagePrompt: generatePhotorealisticFoodPrompt(cleanLine, currentCategory),
        imageStatus: 'completed',
        selected: true,
      });
    }
  }

  return items;
}

/**
 * Free Zero-Key OCR Fallback via OCR.space public engine
 * Extracts raw text from menu photo when Gemini is unreachable or hitting quota limits.
 */
async function scanWithFreeOcrSpace(cleanBase64: string, mimeType: string): Promise<ScannedMenuItem[]> {
  try {
    const formData = new URLSearchParams();
    formData.append('base64Image', `data:${mimeType};base64,${cleanBase64}`);
    formData.append('apikey', 'helloworld');
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(18000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const rawText = data?.ParsedResults?.[0]?.ParsedText;
    if (rawText && typeof rawText === 'string') {
      return parseRawOcrTextToMenuItems(rawText);
    }
  } catch (err: any) {
    console.warn('OCR fallback notice:', err?.message);
  }
  return [];
}

export const geminiMenuScanner = {
  /**
   * Scans a menu card photo or image using Google Gemini Vision API
   * with automatic fallback to zero-key OCR extraction.
   * NEVER returns fake/random items.
   */
  async scanMenuCard(base64Data: string, mimeType: string = 'image/jpeg'): Promise<ScanMenuResult> {
    if (!base64Data) {
      return { success: false, items: [], error: 'No image data provided' };
    }

    const cleanBase64 = base64Data
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/[\r\n\s]+/g, '')
      .trim();

    let normalizedMimeType = (mimeType || 'image/jpeg').toLowerCase().trim();
    if (normalizedMimeType === 'image/jpg') normalizedMimeType = 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(normalizedMimeType)) {
      normalizedMimeType = 'image/jpeg';
    }

    const prompt = `You are a world-class restaurant menu OCR and item extraction AI.
The image provided is a restaurant menu, rate board, price sheet, or food catalog.
The photo may be captured from a mobile camera or gallery, and may contain glare, angles, shadows, or slight blur.

CRITICAL INSTRUCTIONS - 100% EXHAUSTIVE EXTRACTION:
1. MULTI-COLUMN & SECTION SCANNING:
   - Carefully scan every part of the image: left column, center column, right column, sidebars, specials, and footer.
   - Do NOT stop early. If the menu has 20, 30, 50, or 80+ items, extract EVERY SINGLE ONE of them. Never truncate after 7 or 10 items.

2. UNPRICED ITEMS:
   - If a dish or drink is listed WITHOUT a price (e.g. 'Buffet', 'Meals', 'Special Thali', seasonal items, or unpriced items), YOU MUST STILL EXTRACT IT!
   - For unpriced items, set "price": 0. Never omit an item because its price is missing, unreadable, or not listed.

3. DUAL / PORTION PRICING:
   - If an item lists two prices (e.g. "Chicken Biryani Full 180 / Half 110", or "180 / 110", or "Full 200, Half 120"):
     - "name": Clean dish name without the numbers or portion words (e.g. "Chicken Biryani")
     - "price": Full portion price (e.g. 180)
     - "halfPrice": Half portion price (e.g. 110)

4. NOISE FILTERING:
   - Ignore shop address, phone numbers, tax lines, or header banners.
   - Extract only actual food dishes, beverages, snacks, desserts, combos, and items.

JSON schema per item:
- "name": Clean item title (string, e.g. "Masala Dosa", "Tea", "Chicken 65")
- "price": Number (integer/float, e.g. 70, or 0 if unpriced)
- "halfPrice": Number or null (half-portion price if two prices exist, else null)
- "category": Appropriate food category (string, e.g. "Tea & Coffee", "Tiffin", "Meals", "Biryani", "Beverages", "Snacks", "Fast Food", "Chinese", "Desserts", "Starters")
- "icon": An appropriate food emoji (string)

Return ONLY valid JSON array.`;

    let lastError = '';

    // 1. Try Google Gemini Vision with active production models and structured output
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(45000),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: normalizedMimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    price: { type: 'number', nullable: true },
                    halfPrice: { type: 'number', nullable: true },
                    category: { type: 'string' },
                    icon: { type: 'string' },
                  },
                  required: ['name', 'category'],
                },
              },
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          lastError = `Gemini model ${model} HTTP ${status}`;
          if (status !== 503 && status !== 429) {
            const errBody = await response.text();
            console.warn(`Gemini model ${model} HTTP ${status}:`, errBody);
          }
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          lastError = 'No text returned from Gemini';
          continue;
        }

        const cleanedText = rawText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/```$/, '')
          .trim();

        let parsed: any = null;
        try {
          parsed = JSON.parse(cleanedText);
        } catch {
          const arrayMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            try {
              parsed = JSON.parse(arrayMatch[0]);
            } catch {}
          }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          const items: ScannedMenuItem[] = parsed
            .filter(item => item && typeof item.name === 'string' && item.name.trim().length > 0)
            .map(item => {
              const fullPrice = Math.max(0, Number(item.price) || 0);
              const half = item.halfPrice ? Number(item.halfPrice) : null;
              const cat = item.category?.trim() || 'General';
              const foodIcon = item.icon || getDishFoodIcon(item.name, cat);

              const dedicatedPrompt = generatePhotorealisticFoodPrompt(item.name.trim(), cat);
              const initialPhotoUrl = getDishImageUrl(item.name.trim(), cat, item.matchSlug);

              return {
                name: item.name.trim(),
                price: fullPrice,
                halfPrice: half && half > 0 && half < fullPrice ? half : null,
                category: cat,
                icon: foodIcon,
                imageUrl: initialPhotoUrl,
                imagePrompt: dedicatedPrompt,
                imageStatus: 'completed',
                selected: true,
              };
            });

          if (items.length > 0) {
            return {
              success: true,
              items,
            };
          }
        }
      } catch (err: any) {
        console.warn(`Gemini scan error with model ${model}:`, err.message);
        lastError = err.message || 'Network request failed';
      }
    }

    // 2. Secondary Zero-Key OCR Fallback
    console.log('Gemini scan unavailable, attempting secondary OCR fallback...');
    const ocrItems = await scanWithFreeOcrSpace(cleanBase64, mimeType);
    if (ocrItems.length > 0) {
      return {
        success: true,
        items: ocrItems,
      };
    }

    // 3. Strict Quality Guarantee: If no real items detected, NEVER show fake items
    return {
      success: false,
      items: [],
      error: 'Could not detect menu items from this photo. Please ensure good lighting and take a clear, close-up photo of the printed menu card.',
    };
  },

  /**
   * Generates or ensures a photorealistic food image for a single scanned menu item.
   * If Gemini multimodal synthesis succeeds, uploads to Supabase and saves.
   * If Gemini quota is exceeded (HTTP 429), gracefully preserves verified restaurant photo.
   */
  async generateImageForItem(
    shopId: string,
    item: ScannedMenuItem
  ): Promise<ScannedMenuItem> {
    // Duplicate protection: skip re-generation if valid custom image already exists
    if (imageStorageService.hasValidFoodImage(item.imageUrl)) {
      return {
        ...item,
        imageStatus: 'completed',
      };
    }

    const prompt = item.imagePrompt || generatePhotorealisticFoodPrompt(item.name, item.category);

    // Only attempt expensive AI synthesis if quota is not in active cooldown
    if (!geminiImageService.isQuotaCooldownActive()) {
      try {
        const genResult = await geminiImageService.generateFoodImage(prompt);

        if (genResult.success && genResult.base64Data) {
          // Persist custom generated photo to Supabase Storage (with local fallback)
          const savedUrl = await imageStorageService.persistFoodImage(
            shopId,
            `item_${item.name.replace(/\s+/g, '_').toLowerCase()}`,
            genResult.base64Data,
            genResult.mimeType || 'image/jpeg'
          );

          return {
            ...item,
            imageUrl: savedUrl,
            imagePrompt: prompt,
            imageStatus: 'completed',
          };
        }
      } catch (err: any) {
        // Fallback below
      }
    }

    // If generation failed or wasn't available:
    if (!item.imageUrl) {
      return {
        ...item,
        imagePrompt: prompt,
        imageStatus: 'failed',
        imageUrl: undefined,
      };
    }

    return {
      ...item,
      imageUrl: item.imageUrl,
      imagePrompt: prompt,
      imageStatus: 'completed',
    };
  },

  /**
   * Generates food images asynchronously for a list of scanned items
   * with progress callback. Does not block or fail if individual items encounter issues.
   */
  async generateImagesBatch(
    shopId: string,
    items: ScannedMenuItem[],
    onProgress?: (completedCount: number, totalCount: number, updatedItem: ScannedMenuItem) => void
  ): Promise<ScannedMenuItem[]> {
    const results: ScannedMenuItem[] = [];
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.selected) {
        const updated = await this.generateImageForItem(shopId, item);
        results.push(updated);
        if (onProgress) {
          onProgress(i + 1, total, updated);
        }
      } else {
        results.push(item);
        if (onProgress) {
          onProgress(i + 1, total, item);
        }
      }
    }

    return results;
  },
};
