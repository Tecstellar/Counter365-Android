import React from 'react';
import {
  Coffee,
  Martini,
  OrangeSlice,
  Hamburger,
  Pizza,
  Cookie,
  IceCream,
  Cake,
  Popcorn,
  BowlFood,
  CookingPot,
  ForkKnife,
  Bread,
  Egg,
  Fish,
  PintGlass,
  Drop,
  Flame,
  IconProps,
} from 'phosphor-react-native';

export type PhosphorIconComponent = React.ComponentType<IconProps>;

export interface PhosphorIconThemeConfig {
  key: string;
  name: string;
  IconComponent: PhosphorIconComponent;
  tintColor: string;
  pastelBg: string;
  borderColor: string;
  darkBg: string;
  darkBorder: string;
}

// Visual color themes matching design specifications:
// - Brown on beige
// - Green on mint
// - Orange on peach
// - Azure on ice blue
// - Amber on sunlit yellow
// - Berry on rose pink
// - Crimson on rose coral
const THEMES = {
  brownBeige: {
    tintColor: '#78350F', // Dark roasted brown
    pastelBg: '#F5EBE6',  // Warm beige
    borderColor: '#EAD7CE',
    darkBg: '#2D1B12',
    darkBorder: '#4A2B1D',
  },
  greenMint: {
    tintColor: '#065F46', // Deep forest emerald
    pastelBg: '#ECFDF5',  // Crisp mint
    borderColor: '#A7F3D0',
    darkBg: '#062C21',
    darkBorder: '#0F4C3B',
  },
  orangePeach: {
    tintColor: '#C2410C', // Deep burnt orange
    pastelBg: '#FFEDD5',  // Warm peach
    borderColor: '#FED7AA',
    darkBg: '#2F180B',
    darkBorder: '#4E2713',
  },
  azureIce: {
    tintColor: '#0369A1', // Deep ocean azure
    pastelBg: '#E0F2FE',  // Soft ice blue
    borderColor: '#BAE6FD',
    darkBg: '#082F49',
    darkBorder: '#0C4A6E',
  },
  amberYellow: {
    tintColor: '#B45309', // Deep citrus amber
    pastelBg: '#FEF9C3',  // Sunlit yellow
    borderColor: '#FDE047',
    darkBg: '#2E230B',
    darkBorder: '#4E3A12',
  },
  berryPink: {
    tintColor: '#9D174D', // Deep berry magenta
    pastelBg: '#FCE7F3',  // Soft blush pink
    borderColor: '#FBCFE8',
    darkBg: '#341021',
    darkBorder: '#521935',
  },
  crimsonCoral: {
    tintColor: '#BE123C', // Deep saffron crimson
    pastelBg: '#FFF1F2',  // Soft rose coral
    borderColor: '#FECDD3',
    darkBg: '#340C16',
    darkBorder: '#551424',
  },
  slateChar: {
    tintColor: '#334155', // Deep slate char
    pastelBg: '#F1F5F9',  // Clean soft slate
    borderColor: '#E2E8F0',
    darkBg: '#1E293B',
    darkBorder: '#334155',
  },
};

export const PHOSPHOR_ICONS_CATALOG: Record<string, { name: string; IconComponent: PhosphorIconComponent; theme: typeof THEMES.brownBeige }> = {
  coffee: {
    name: 'Coffee / Tea',
    IconComponent: Coffee,
    theme: THEMES.brownBeige,
  },
  'orange-slice': {
    name: 'Juice / Citrus',
    IconComponent: OrangeSlice,
    theme: THEMES.amberYellow,
  },
  martini: {
    name: 'Drinks / Mojito',
    IconComponent: Martini,
    theme: THEMES.azureIce,
  },
  hamburger: {
    name: 'Burger / Rolls',
    IconComponent: Hamburger,
    theme: THEMES.orangePeach,
  },
  pizza: {
    name: 'Pizza',
    IconComponent: Pizza,
    theme: THEMES.orangePeach,
  },
  cookie: {
    name: 'Cookie / Biscuit',
    IconComponent: Cookie,
    theme: THEMES.brownBeige,
  },
  'ice-cream': {
    name: 'Ice Cream',
    IconComponent: IceCream,
    theme: THEMES.berryPink,
  },
  cake: {
    name: 'Cake / Desserts',
    IconComponent: Cake,
    theme: THEMES.berryPink,
  },
  popcorn: {
    name: 'Snacks / Fries',
    IconComponent: Popcorn,
    theme: THEMES.orangePeach,
  },
  'bowl-food': {
    name: 'Rice / Biryani / Meals',
    IconComponent: BowlFood,
    theme: THEMES.crimsonCoral,
  },
  'cooking-pot': {
    name: 'Soup / Gravy / Stew',
    IconComponent: CookingPot,
    theme: THEMES.greenMint,
  },
  bread: {
    name: 'Bread / Bakery',
    IconComponent: Bread,
    theme: THEMES.brownBeige,
  },
  egg: {
    name: 'Egg / Omelet',
    IconComponent: Egg,
    theme: THEMES.amberYellow,
  },
  fish: {
    name: 'Fish / Seafood',
    IconComponent: Fish,
    theme: THEMES.azureIce,
  },
  'pint-glass': {
    name: 'Cold Drink / Soda',
    IconComponent: PintGlass,
    theme: THEMES.azureIce,
  },
  drop: {
    name: 'Water',
    IconComponent: Drop,
    theme: THEMES.azureIce,
  },
  flame: {
    name: 'Tandoori / Spicy',
    IconComponent: Flame,
    theme: THEMES.orangePeach,
  },
  'fork-knife': {
    name: 'General Food',
    IconComponent: ForkKnife,
    theme: THEMES.slateChar,
  },
};

export const AVAILABLE_PHOSPHOR_ICONS: Array<{ key: string; name: string; IconComponent: PhosphorIconComponent }> = Object.entries(
  PHOSPHOR_ICONS_CATALOG
).map(([key, config]) => ({
  key,
  name: config.name,
  IconComponent: config.IconComponent,
}));

/**
 * Keyword mapping table: keyword -> Phosphor icon key
 */
const KEYWORD_RULES: Array<{ keywords: string[]; iconKey: string }> = [
  // 1. Hot Drinks: tea, chai, coffee -> coffee
  {
    keywords: [
      'tea', 'chai', 'coffee', 'filter coffee', 'milk coffee', 'strong tea',
      'ginger tea', 'adrak chai', 'elaichi', 'cardamom', 'masala tea', 'black tea',
      'green tea', 'sulaimani', 'dum tea', 'espresso', 'cappuccino', 'latte',
      'cold brew', 'boost', 'horlicks', 'badam milk', 'almond milk', 'hot chocolate',
      'milk', 'kaapi',
    ],
    iconKey: 'coffee',
  },
  // 2. Juices & Citrus: juice, orange, lemon, lime -> orange-slice
  {
    keywords: [
      'orange', 'juice', 'citrus', 'lemon', 'lime', 'mosambi', 'sweet lime',
      'fresh juice', 'lemonade', 'mint lemon', 'amla', 'fruit juice', 'apple juice',
      'mango juice', 'pineapple', 'grape juice', 'watermelon juice',
    ],
    iconKey: 'orange-slice',
  },
  // 3. Mocktails & Cocktails: mocktail, cocktail, mojito -> martini
  {
    keywords: [
      'mocktail', 'cocktail', 'mojito', 'cooler', 'syrup', 'punch', 'blue curacao',
      'crush', 'virgin',
    ],
    iconKey: 'martini',
  },
  // 4. Burgers & Rolls: burger -> hamburger
  {
    keywords: [
      'burger', 'hamburger', 'sliders', 'bun', 'roll', 'wrap', 'frankie',
      'shawarma', 'sandwich', 'puff', 'egg puff', 'veg puff', 'chicken puff',
    ],
    iconKey: 'hamburger',
  },
  // 5. Pizza: pizza -> pizza
  {
    keywords: ['pizza', 'calzone', 'slice', 'margherita', 'pepperoni'],
    iconKey: 'pizza',
  },
  // 6. Ice Cream: ice cream -> ice-cream
  {
    keywords: [
      'ice cream', 'icecream', 'sundae', 'gelato', 'kulfi', 'falooda',
      'softy', 'scoop', 'cone', 'chocobar', 'cassata',
    ],
    iconKey: 'ice-cream',
  },
  // 7. Cake & Pastries: cake -> cake
  {
    keywords: [
      'cake', 'pastry', 'brownie', 'lava cake', 'cupcake', 'muffin',
      'dessert', 'sweet', 'gulab jamun', 'rasgulla', 'halwa', 'donut',
      'cheesecake', 'torte',
    ],
    iconKey: 'cake',
  },
  // 8. Cookies & Biscuits: cookie, biscuit -> cookie
  {
    keywords: ['cookie', 'biscuit', 'rusk', 'cookies', 'crackers', 'wafer'],
    iconKey: 'cookie',
  },
  // 9. Snacks & Fries: snacks, popcorn -> popcorn
  {
    keywords: [
      'popcorn', 'snack', 'snacks', 'french fries', 'fries', 'chips', 'crisps',
      'samosa', 'bonda', 'vada', 'vadai', 'pakoda', 'pakora', 'bajji', 'bhajji',
      'finger chips', 'cutlet', 'tikki', 'bhaji', 'kachori', 'murukku',
    ],
    iconKey: 'popcorn',
  },
  // 10. Rice, Biryani, Meals: rice, biryani, meals -> bowl-food
  {
    keywords: [
      'biryani', 'biriyani', 'rice', 'fried rice', 'pulao', 'pulav', 'meals',
      'thali', 'full meals', 'mini meals', 'curd rice', 'sambar rice', 'lemon rice',
      'khichdi', 'noodles', 'noodle', 'pasta', 'maggi', 'schezwan rice',
      'paneer', 'chicken 65', 'gobi 65', 'chilli chicken', 'tikka', 'butter chicken',
    ],
    iconKey: 'bowl-food',
  },
  // 11. Soups, Stews & Curries: soup -> cooking-pot
  {
    keywords: [
      'soup', 'stew', 'gravy', 'sambar', 'rasam', 'curry', 'kurma', 'dal',
      'dhal', 'broth', 'manchow', 'hot and sour', 'tomato soup', 'mushroom soup',
    ],
    iconKey: 'cooking-pot',
  },
  // 12. Breads: roti, naan, paratha -> bread
  {
    keywords: [
      'bread', 'toast', 'roti', 'naan', 'paratha', 'parotta', 'chapati',
      'poori', 'puri', 'croissant', 'kulcha', 'bun butter',
    ],
    iconKey: 'bread',
  },
  // 13. Eggs: egg, omelet -> egg
  {
    keywords: ['egg', 'omelet', 'omelette', 'boiled egg', 'scramble', 'bhurji', 'poached'],
    iconKey: 'egg',
  },
  // 14. Seafood: fish, prawn -> fish
  {
    keywords: ['fish', 'prawn', 'shrimp', 'crab', 'seafood', 'salmon', 'tuna'],
    iconKey: 'fish',
  },
  // 15. Cold drinks, Soda, Shakes: cold drink -> pint-glass
  {
    keywords: [
      'soda', 'cola', 'pepsi', 'coke', 'thums up', 'sprite', 'fanta', 'mirinda',
      'cold drink', 'beverage', 'lassi', 'sweet lassi', 'chaas', 'butter milk',
      'mor', 'shake', 'milkshake', 'cold coffee', 'iced tea',
    ],
    iconKey: 'pint-glass',
  },
  // 16. Water: water -> drop
  {
    keywords: ['water', 'mineral water', 'aqua', 'kinley', 'bisleri', 'aquafina'],
    iconKey: 'drop',
  },
];

/**
 * Category-level fallback keyword mapping
 */
const CATEGORY_RULES: Array<{ keywords: string[]; iconKey: string }> = [
  { keywords: ['tea', 'chai', 'coffee', 'hot'], iconKey: 'coffee' },
  { keywords: ['juice', 'fresh', 'citrus'], iconKey: 'orange-slice' },
  { keywords: ['mocktail', 'cocktail', 'cooler', 'mojito'], iconKey: 'martini' },
  { keywords: ['burger', 'sandwich', 'roll', 'wrap', 'fast food'], iconKey: 'hamburger' },
  { keywords: ['pizza'], iconKey: 'pizza' },
  { keywords: ['bake', 'bakes', 'bakery', 'cake', 'dessert', 'sweet'], iconKey: 'cake' },
  { keywords: ['ice cream', 'icecream', 'gelato'], iconKey: 'ice-cream' },
  { keywords: ['snack', 'snacks', 'starter', 'starters', 'fried', 'chat', 'chaat'], iconKey: 'popcorn' },
  { keywords: ['biryani', 'rice', 'meal', 'meals', 'main', 'mains', 'chinese'], iconKey: 'bowl-food' },
  { keywords: ['soup', 'soups', 'gravy', 'curry'], iconKey: 'cooking-pot' },
  { keywords: ['bread', 'roti', 'tiffin'], iconKey: 'bread' },
  { keywords: ['cold', 'beverage', 'beverages', 'drinks', 'shake', 'shakes'], iconKey: 'pint-glass' },
];

/**
 * Auto-detect Phosphor icon key from item name, category name, or manual override.
 */
export function resolvePhosphorIconKey(
  dishName: string,
  categoryName?: string,
  overrideKey?: string | null
): string {
  // 1. Manual user override has highest priority
  if (overrideKey && PHOSPHOR_ICONS_CATALOG[overrideKey]) {
    return overrideKey;
  }

  // 2. Dish name keywords matching
  const cleanDish = (dishName || '').toLowerCase().trim();
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (cleanDish.includes(kw)) {
        return rule.iconKey;
      }
    }
  }

  // 3. Category name keywords matching
  if (categoryName) {
    const cleanCat = categoryName.toLowerCase().trim();
    for (const rule of CATEGORY_RULES) {
      for (const kw of rule.keywords) {
        if (cleanCat.includes(kw)) {
          return rule.iconKey;
        }
      }
    }
  }

  // 4. Default fallback: fork-knife
  return 'fork-knife';
}

/**
 * Get the full Phosphor Icon configuration with duotone icon component and tinted palette.
 */
export function getPhosphorIconConfig(
  dishName: string,
  categoryName?: string,
  overrideKey?: string | null
): PhosphorIconThemeConfig {
  const iconKey = resolvePhosphorIconKey(dishName, categoryName, overrideKey);
  const entry = PHOSPHOR_ICONS_CATALOG[iconKey] || PHOSPHOR_ICONS_CATALOG['fork-knife'];

  // Smart pastel palette specialization:
  // If the dish is vegetarian/mint/green/fresh, tint with green on mint
  const clean = `${dishName} ${categoryName || ''}`.toLowerCase();
  let theme = entry.theme;
  if (
    clean.includes('veg') ||
    clean.includes('mint') ||
    clean.includes('pudina') ||
    clean.includes('green') ||
    clean.includes('salad') ||
    clean.includes('gobi') ||
    clean.includes('spinach') ||
    clean.includes('palak')
  ) {
    if (iconKey === 'bowl-food' || iconKey === 'fork-knife' || iconKey === 'cooking-pot') {
      theme = THEMES.greenMint;
    }
  }

  return {
    key: iconKey,
    name: entry.name,
    IconComponent: entry.IconComponent,
    tintColor: theme.tintColor,
    pastelBg: theme.pastelBg,
    borderColor: theme.borderColor,
    darkBg: theme.darkBg,
    darkBorder: theme.darkBorder,
  };
}
