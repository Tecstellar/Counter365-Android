import { getDishFoodIcon, getDishVectorIconConfig, DISH_ICON_MAP } from '../src/constants/dishIcons';
import { getPaymentModeVectorConfig } from '../src/constants/paymentIcons';

describe('Dish & Category Food Icons', () => {
  it('maps hot teas and coffees to tea/coffee cups', () => {
    expect(getDishFoodIcon('Tea')).toBe('☕');
    expect(getDishFoodIcon('Special Ginger Tea')).toBe('☕');
    expect(getDishFoodIcon('Filter Coffee')).toBe('☕');
    expect(getDishFoodIcon('Adrak Chai')).toBe('☕');
    expect(getDishFoodIcon('Sulaimani')).toBe('☕');
  });

  it('maps snacks and savouries to relevant food icons', () => {
    expect(getDishFoodIcon('Samosa')).toBe('🥟');
    expect(getDishFoodIcon('Medu Vada')).toBe('🍩');
    expect(getDishFoodIcon('Bun Butter Jam')).toBe('🍞');
    expect(getDishFoodIcon('Egg Puff')).toBe('🥐');
    expect(getDishFoodIcon('French Fries')).toBe('🍟');
    expect(getDishFoodIcon('Onion Pakoda')).toBe('🧆');
  });

  it('maps cold beverages and juices', () => {
    expect(getDishFoodIcon('Badam Milk')).toBe('🥛');
    expect(getDishFoodIcon('Lime Juice')).toBe('🍋');
    expect(getDishFoodIcon('Sweet Lassi')).toBe('🥛');
    expect(getDishFoodIcon('Cool Drink')).toBe('🥤');
  });

  it('maps main dishes and tiffins', () => {
    expect(getDishFoodIcon('Chicken Biryani')).toBe('🍛');
    expect(getDishFoodIcon('Masala Dosa')).toBe('🥞');
    expect(getDishFoodIcon('Idli')).toBe('⚪');
    expect(getDishFoodIcon('Parotta')).toBe('🫓');
    expect(getDishFoodIcon('Noodles')).toBe('🍜');
    expect(getDishFoodIcon('South Indian Meals')).toBe('🍱');
  });

  it('falls back to category icon or standard icon when dish is unrecognized', () => {
    expect(getDishFoodIcon('Unknown Special Drink', 'Tea & Coffee')).toBe('☕');
    expect(getDishFoodIcon('Chef Special Crunch', 'Snacks')).toBe('🥟');
    expect(getDishFoodIcon('Random Food Item')).toBe('🍽️');
  });
});

describe('Vector Dish Icons System', () => {
  it('maps tea and chai to coffee/tea icon', () => {
    const config = getDishVectorIconConfig('Special Ginger Chai');
    expect(config.family).toBe('MaterialCommunityIcons');
    expect(config.name).toBe('coffee');
  });

  it('maps juices and water to cold beverage icons', () => {
    const waterConfig = getDishVectorIconConfig('Mineral Water');
    expect(waterConfig.name).toBe('water-outline');

    const limeConfig = getDishVectorIconConfig('Fresh Lime Juice');
    expect(limeConfig.name).toBe('fruit-citrus');

    const juiceConfig = getDishVectorIconConfig('Mango Juice');
    expect(juiceConfig.name).toBe('glass-cocktail');
  });

  it('maps bakery items and snacks', () => {
    const puff = getDishVectorIconConfig('Egg Puff');
    expect(puff.name).toBe('food-croissant');

    const burger = getDishVectorIconConfig('Veg Burger');
    expect(burger.name).toBe('hamburger');

    const pizza = getDishVectorIconConfig('Cheese Pizza');
    expect(pizza.name).toBe('pizza');
  });

  it('maps non-veg and rice dishes', () => {
    const chickenStarter = getDishVectorIconConfig('Chicken 65');
    expect(chickenStarter.name).toBe('food-drumstick');

    const biryani = getDishVectorIconConfig('Dum Biryani');
    expect(biryani.name).toBe('rice');

    const friedRice = getDishVectorIconConfig('Veg Fried Rice');
    expect(friedRice.name).toBe('rice');
  });

  it('resolves category fallback when dish name is novel', () => {
    const config = getDishVectorIconConfig('Chef Special Mystery Bowl', 'Rice & Meals');
    expect(config.name).toBe('rice');
  });
});

describe('Vector Payment Mode Icons System', () => {
  it('maps cash payment methods', () => {
    const cash = getPaymentModeVectorConfig('Cash');
    expect(cash.name).toBe('cash-multiple');
  });

  it('maps GPay, UPI, QR codes', () => {
    const upi = getPaymentModeVectorConfig('GPay');
    expect(upi.name).toBe('qrcode-scan');

    const qr = getPaymentModeVectorConfig('UPI');
    expect(qr.name).toBe('qrcode-scan');
  });

  it('maps split cash and gpay methods', () => {
    const split = getPaymentModeVectorConfig('Cash + GPay');
    expect(split.name).toBe('credit-card-sync-outline');
  });

  it('maps full pending and partial pay', () => {
    const pending = getPaymentModeVectorConfig('Pending');
    expect(pending.name).toBe('clock-alert-outline');

    const partial = getPaymentModeVectorConfig('Partial Pay');
    expect(partial.name).toBe('scale-balance');
  });
});

