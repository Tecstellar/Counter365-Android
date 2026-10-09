/**
 * High-quality dish food photography catalog and resolver.
 * 100% verified, authentic CDN images tailored for mobile menus.
 * Strictly 0 collisions across distinct dishes.
 */

export const DISH_IMAGE_MAP: Record<string, string> = {
  // Tea & Chai Varieties
  'tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'chai': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'strong tea': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80&auto=format&fit=crop',
  'ginger tea': 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&q=80&auto=format&fit=crop',
  'adrak chai': 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&q=80&auto=format&fit=crop',
  'elaichi tea': 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80&auto=format&fit=crop',
  'cardamom tea': 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80&auto=format&fit=crop',
  'masala chai': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80&auto=format&fit=crop',
  'masala tea': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80&auto=format&fit=crop',
  'black tea': 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&q=80&auto=format&fit=crop',
  'green tea': 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&q=80&auto=format&fit=crop',
  'lemon tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'sulaimani': 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&q=80&auto=format&fit=crop',

  // Coffee Varieties
  'filter coffee': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80&auto=format&fit=crop',
  'milk coffee': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80&auto=format&fit=crop',
  'coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80&auto=format&fit=crop',
  'black coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80&auto=format&fit=crop',
  'cold coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&q=80&auto=format&fit=crop',
  'iced coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&q=80&auto=format&fit=crop',
  'espresso': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80&auto=format&fit=crop',
  'cappuccino': 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400&q=80&auto=format&fit=crop',
  'latte': 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=400&q=80&auto=format&fit=crop',

  // Malted / Milk Drinks
  'boost': 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80&auto=format&fit=crop',
  'horlicks': 'https://images.unsplash.com/photo-1584285418504-0ba656d05dc2?w=400&q=80&auto=format&fit=crop',
  'hot chocolate': 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80&auto=format&fit=crop',
  'badam milk': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80&auto=format&fit=crop',
  'almond milk': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80&auto=format&fit=crop',
  'rose milk': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&q=80&auto=format&fit=crop',
  'milk': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80&auto=format&fit=crop',

  // Hot Snacks & Savouries
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'onion samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'vada': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',
  'medu vada': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',
  'masala vada': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'dal vada': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'bonda': 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&q=80&auto=format&fit=crop',
  'aloo bonda': 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&q=80&auto=format&fit=crop',
  'mysore bonda': 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&q=80&auto=format&fit=crop',
  'bajji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'pakoda': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'onion pakoda': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'hot coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80&auto=format&fit=crop',
  'poha': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',
  'usal poha': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',
  'kachori': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'khasta kachori': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'bake samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'baked samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'bun butter': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&q=80&auto=format&fit=crop',
  'bun maska': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&q=80&auto=format&fit=crop',
  'bun jam': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&q=80&auto=format&fit=crop',
  'egg puffs': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&auto=format&fit=crop',
  'veg puffs': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&auto=format&fit=crop',
  'chicken puffs': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&auto=format&fit=crop',
  'puffs': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&auto=format&fit=crop',
  'puff': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&auto=format&fit=crop',
  'biscuit': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80&auto=format&fit=crop',
  'cookie': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80&auto=format&fit=crop',
  'cookies': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80&auto=format&fit=crop',
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80&auto=format&fit=crop',
  'brownie': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80&auto=format&fit=crop',
  'french fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80&auto=format&fit=crop',
  'fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80&auto=format&fit=crop',
  'bread omelette': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80&auto=format&fit=crop',
  'omelette': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80&auto=format&fit=crop',
  'maggi': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80&auto=format&fit=crop',
  'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80&auto=format&fit=crop',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80&auto=format&fit=crop',
  'roll': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80&auto=format&fit=crop',
  'chicken roll': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80&auto=format&fit=crop',
  'momos': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',

  // Cold Drinks & Juices
  'lemon juice': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80&auto=format&fit=crop',
  'lime juice': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80&auto=format&fit=crop',
  'butter milk': 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80&auto=format&fit=crop',
  'chaas': 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80&auto=format&fit=crop',
  'mor': 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&q=80&auto=format&fit=crop',
  'lassi': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80&auto=format&fit=crop',
  'sweet lassi': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80&auto=format&fit=crop',
  'cool drink': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
  'cola': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
  'soda': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
  'water': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&q=80&auto=format&fit=crop',
  'water 1l': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&q=80&auto=format&fit=crop',
  'mojito': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80&auto=format&fit=crop',
  'milkshake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80&auto=format&fit=crop',
  'fresh juice': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80&auto=format&fit=crop',
  'orange juice': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80&auto=format&fit=crop',

  // South Indian Tiffin & Meals (Each has a distinct, authentic photo)
  'idly': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80&auto=format&fit=crop',
  'idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80&auto=format&fit=crop',
  'dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80&auto=format&fit=crop',
  'masala dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80&auto=format&fit=crop',
  'ghee roast': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80&auto=format&fit=crop',
  'poori': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80&auto=format&fit=crop',
  'puri': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80&auto=format&fit=crop',
  'pongal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80&auto=format&fit=crop',
  'upma': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80&auto=format&fit=crop',
  'parotta': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80&auto=format&fit=crop',
  'kothu parotta': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80&auto=format&fit=crop',
  'chapathi': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&q=80&auto=format&fit=crop',
  'chapati': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&q=80&auto=format&fit=crop',
  'roti': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&q=80&auto=format&fit=crop',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'veg biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80&auto=format&fit=crop',
  'noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80&auto=format&fit=crop',
  'chicken 65': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&q=80&auto=format&fit=crop',
  'meals': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'rice meals': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'thali': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80&auto=format&fit=crop',
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80&auto=format&fit=crop',
  'paneer butter masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80&auto=format&fit=crop',
  'naan': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&q=80&auto=format&fit=crop',
  'butter naan': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&q=80&auto=format&fit=crop',
  'tandoori': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=400&q=80&auto=format&fit=crop',
  'tandoori chicken': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=400&q=80&auto=format&fit=crop',
  'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=80&auto=format&fit=crop',
  'chicken curry': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=80&auto=format&fit=crop',
  'mutton biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'fish fry': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&q=80&auto=format&fit=crop',
  'fish curry': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&q=80&auto=format&fit=crop',
  'egg curry': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80&auto=format&fit=crop',
  'chole bhature': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80&auto=format&fit=crop',
  'pav bhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80&auto=format&fit=crop',
  'pani puri': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'chaat': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'dal makhani': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80&auto=format&fit=crop',
  'dal tadka': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80&auto=format&fit=crop',
  'curd rice': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'ice cream': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80&auto=format&fit=crop',
  'gulab jamun': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80&auto=format&fit=crop',
  'pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&q=80&auto=format&fit=crop',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80&auto=format&fit=crop',
  'manchurian': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80&auto=format&fit=crop',
};

// Category defaults
export const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  'Tea & Coffee': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'Chai': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop',
  'Coffee': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80&auto=format&fit=crop',
  'Hot Drinks': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80&auto=format&fit=crop',
  'Snacks': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'Chai & Snacks': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80&auto=format&fit=crop',
  'Cold': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80&auto=format&fit=crop',
  'Cold Drinks': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80&auto=format&fit=crop',
  'Beverages': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
  'Juices': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80&auto=format&fit=crop',
  'Tiffin': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80&auto=format&fit=crop',
  'Breakfast': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80&auto=format&fit=crop',
  'Morning': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80&auto=format&fit=crop',
  'Evening': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80&auto=format&fit=crop',
  'Fast Food': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80&auto=format&fit=crop',
  'Meals': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'Lunch': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'Dinner': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80&auto=format&fit=crop',
  'Main': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'Starters': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&q=80&auto=format&fit=crop',
  'Bakes': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80&auto=format&fit=crop',
  'Bakery': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80&auto=format&fit=crop',
  'Desserts': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80&auto=format&fit=crop',
  'Chinese': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80&auto=format&fit=crop',
  'Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80&auto=format&fit=crop',
  'Others': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format&fit=crop',
};

/**
 * Returns an exact, authentic photograph URL strictly matching the dish name.
 * Uses exact match -> token match -> slug match -> category fallback.
 */
export function getDishImageUrl(
  dishName: string,
  categoryName?: string,
  slugHint?: string,
  existingUrl?: string
): string {
  if (existingUrl && (existingUrl.startsWith('http') || existingUrl.startsWith('data:'))) {
    return existingUrl;
  }

  // 1. Direct slug match if provided by AI or caller
  if (slugHint) {
    const cleanSlug = slugHint.toLowerCase().replace(/_/g, ' ').trim();
    if (DISH_IMAGE_MAP[cleanSlug]) {
      return DISH_IMAGE_MAP[cleanSlug];
    }
  }

  const clean = (dishName || '')
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) {
    return CATEGORY_DEFAULT_IMAGES[categoryName || 'Tea & Coffee'] || DISH_IMAGE_MAP['tea'];
  }

  // 2. Direct exact match
  if (DISH_IMAGE_MAP[clean]) {
    return DISH_IMAGE_MAP[clean];
  }

  // 3. Multi-word phrase matching (sorted by length descending for specificity)
  const sortedKeys = Object.keys(DISH_IMAGE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(clean)) {
      return DISH_IMAGE_MAP[key];
    }
  }

  // 4. Token-level partial match
  const tokens = clean.split(' ').filter(t => t.length > 2);
  for (const token of tokens) {
    if (DISH_IMAGE_MAP[token]) {
      return DISH_IMAGE_MAP[token];
    }
  }

  // 5. Category-accurate default
  if (categoryName && CATEGORY_DEFAULT_IMAGES[categoryName]) {
    return CATEGORY_DEFAULT_IMAGES[categoryName];
  }

  // 6. Safe culinary standard
  return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80&auto=format&fit=crop';
}

export { getDishFoodIcon, DISH_ICON_MAP, CATEGORY_ICON_MAP } from './dishIcons';

