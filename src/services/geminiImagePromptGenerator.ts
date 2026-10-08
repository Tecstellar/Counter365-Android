/**
 * CounterPro Culinary AI Prompt Generator
 * 
 * Generates detailed, photorealistic prompts for commercial restaurant food photography
 * following the universal CounterPro studio aesthetic:
 * - Square 1:1 composition
 * - Clean warm cream/off-white background (#FAF7F2 / #F5F2EB)
 * - Centered subject, single food item or authentic portion
 * - Natural realistic lighting, soft diffused studio shadows
 * - Authentic Indian restaurant presentation and containers
 * - Strictly NO people, hands, text, typography, logos, watermarks, or illustrations
 */

interface DishVisualSpec {
  container?: string;
  appearance: string;
  texture: string;
  colors: string;
}

const CULINARY_KNOWLEDGE_BASE: Record<string, DishVisualSpec> = {
  // Hot Beverages
  'tea': {
    container: 'served in a classic Indian transparent tea glass',
    appearance: 'warm caramel-brown milk tea with subtle natural steam gently rising from the hot surface',
    texture: 'smooth liquid surface with delicate light foam bubbles around the rim and authentic glass reflections',
    colors: 'rich caramel-brown tea with creamy warm highlights',
  },
  'chai': {
    container: 'served in an authentic Indian roadside cutting chai glass',
    appearance: 'aromatic spiced milk tea with faint gentle steam rising',
    texture: 'silky smooth liquid with tiny froth bubbles around the edge',
    colors: 'warm tan and caramel hues with soft highlights',
  },
  'ginger tea': {
    container: 'served in a transparent heat-resistant glass cup',
    appearance: 'fresh ginger-infused Indian milk tea with subtle gentle steam',
    texture: 'creamy surface with natural tea reflections and soft liquid gloss',
    colors: 'golden-caramel brown with rich milk tones',
  },
  'elaichi tea': {
    container: 'served in a clear glass tea tumbler',
    appearance: 'cardamom-infused steaming Indian milk tea',
    texture: 'velvety liquid surface with delicate milk sheen',
    colors: 'light caramel-cream brown',
  },
  'filter coffee': {
    container: 'served in an authentic South Indian stainless steel dabarah and tumbler set',
    appearance: 'freshly poured frothy South Indian milk coffee with dense creamy foam head',
    texture: 'luxurious velvety micro-foam on top with realistic liquid texture and natural metallic reflections',
    colors: 'rich warm mocha-brown with ivory-colored froth',
  },
  'coffee': {
    container: 'served in a clean ceramic cup or transparent glass',
    appearance: 'steaming hot milk coffee with a delicate froth layer',
    texture: 'creamy surface with subtle reflections and realistic liquid depth',
    colors: 'deep warm brown with creamy foam accents',
  },
  'black tea': {
    container: 'served in a transparent glass cup',
    appearance: 'clear amber-red brewed black tea with subtle steam rising',
    texture: 'crystal clear liquid with brilliant light refraction',
    colors: 'warm translucent amber and deep ruby tones',
  },
  'lemon tea': {
    container: 'served in a clear glass mug with a thin floating lemon slice',
    appearance: 'bright golden-amber infused tea with gentle steam',
    texture: 'sparkling clear liquid with delicate citrus reflections',
    colors: 'golden honey and light citrus amber',
  },
  'green tea': {
    container: 'served in a minimalist glass cup',
    appearance: 'delicate pale-green infused tea with soft natural steam',
    texture: 'translucent liquid with peaceful calm reflections',
    colors: 'soft olive-green and pale jade',
  },
  'boost': {
    container: 'served in a transparent glass cup',
    appearance: 'rich chocolate-malt beverage topped with light malt froth and chocolate dust',
    texture: 'thick velvety milk drink with soft highlights',
    colors: 'deep chocolate-brown with creamy warm tones',
  },
  'horlicks': {
    container: 'served in a transparent glass cup',
    appearance: 'warm comforting malted milk drink with gentle foam',
    texture: 'creamy smooth liquid with soft milk surface reflections',
    colors: 'pale golden-cream and warm beige',
  },

  // Cold Drinks & Juices
  'cold coffee': {
    container: 'served in a tall clear highball glass',
    appearance: 'chilled blended iced coffee with rich creamy chocolate-dusted froth on top and subtle condensation droplets on the exterior glass',
    texture: 'thick frosty beverage with creamy highlights and subtle glass moisture',
    colors: 'creamy hazelnut brown with deep chocolate notes',
  },
  'badam milk': {
    container: 'served in an authentic transparent glass tumbler',
    appearance: 'chilled saffron-infused almond milk garnished with fine slivers of crushed almonds and saffron strands',
    texture: 'creamy chilled liquid with delicate nut texture floating gracefully',
    colors: 'soft golden-yellow and warm cream',
  },
  'rose milk': {
    container: 'served in a clean tall glass with gentle exterior condensation',
    appearance: 'refreshing chilled pink milk beverage',
    texture: 'smooth creamy liquid with velvety surface sheen',
    colors: 'pastel rose-pink with milky highlights',
  },
  'lemon juice': {
    container: 'served in a clear glass with ice cubes and a fresh mint sprig',
    appearance: 'freshly squeezed chilled lemonade with tiny citrus pulp droplets and sparkling condensation on the glass',
    texture: 'translucent liquid with crisp ice cube facets and water droplets',
    colors: 'bright pale yellow and sparkling clear citrus',
  },
  'butter milk': {
    container: 'served in an authentic Indian clay matka or transparent glass',
    appearance: 'traditional churned spiced buttermilk garnished with fine coriander bits and crushed cumin',
    texture: 'thin refreshing spiced yogurt drink with tiny natural spice specks',
    colors: 'creamy off-white with fine green specks',
  },
  'lassi': {
    container: 'served in a traditional terracotta clay kulhad cup',
    appearance: 'thick creamy churned sweet yogurt drink topped with a dollop of fresh clotted malai and crushed pistachios',
    texture: 'luxuriously dense and rich texture with soft peaks',
    colors: 'pure ivory-white with emerald pistachio garnishes',
  },
  'mango lassi': {
    container: 'served in a clean clear glass',
    appearance: 'thick luscious Alfonso mango yogurt smoothie',
    texture: 'silky dense smoothie with natural swirl highlights',
    colors: 'vibrant sun-drenched mango orange and creamy gold',
  },

  // Snacks & Street Food
  'samosa': {
    appearance: 'golden-brown Indian samosa with crisp flaky fried pastry crust, recognizable neat triangular shape with crimped corners and subtle natural surface frying bubbles',
    texture: 'crispy shattered flaky exterior with warm spiced potato and green pea filling visible inside through a subtle natural pastry seam',
    colors: 'warm golden-brown, amber, and deep fried gold',
  },
  'medu vada': {
    appearance: 'traditional South Indian medu vada, golden crispy fried exterior, authentic round doughnut ring shape with a neat central hole',
    texture: 'crunchy golden textured crust with subtle frying blisters, revealing an airy, soft, fluffy white interior inside',
    colors: 'deep warm golden-amber and crisp toasted brown',
  },
  'vada': {
    appearance: 'South Indian lentil fritter with golden crispy exterior, round ring shape with distinct central hole',
    texture: 'crisp bubbly crust with airy, fluffy porous crumb inside',
    colors: 'golden-brown with warm amber highlights',
  },
  'masala vada': {
    appearance: 'crunchy South Indian chana dal patty fritter with coarse rustic texture and visible cracked lentils, onions, and curry leaves',
    texture: 'extra-crispy irregular crunchy exterior with coarse rustic lentil bite',
    colors: 'deep golden-brown and toasted amber with dark green curry leaf specks',
  },
  'bonda': {
    appearance: 'golden spherical fried fritter with smooth round shape and delicate natural surface bubbles',
    texture: 'crisp outer chickpea-batter shell encasing a seasoned spiced potato mash',
    colors: 'glowing turmeric-gold and warm toasted yellow',
  },
  'aloo bonda': {
    appearance: 'crispy round potato bonda fritter with smooth golden besan coating',
    texture: 'delicate crunchy batter shell with steaming savory potato filling inside',
    colors: 'bright golden-yellow with crisp fried edges',
  },
  'egg puff': {
    appearance: 'golden-brown bakery puff pastry with countless crisp flaky laminated pastry layers, enclosing a halved hard-boiled egg with caramelized spiced onion masala',
    texture: 'shatteringly crisp, delicate buttery layers with visible tender egg white and golden yolk inside',
    colors: 'golden-honey brown, toasted amber, and buttery ivory',
  },
  'chicken puff': {
    appearance: 'rectangular Indian bakery puff pastry with rich layered flaky crust and tender spiced chicken filling peeking through pastry vents',
    texture: 'crispy flaky laminated puff pastry with tender juicy spiced filling',
    colors: 'deep golden-brown with rich buttery sheen',
  },
  'veg puff': {
    appearance: 'golden triangular or rectangular flaky pastry with delicate puff layers and savory mixed vegetable filling',
    texture: 'crispy brittle pastry crust with warm vegetable potato filling',
    colors: 'warm golden-tan and buttery pastry tones',
  },
  'bun butter': {
    appearance: 'soft fluffy golden-brown bakery bun neatly sliced horizontally with thick swirls of smooth rich salted butter melting gently between the halves',
    texture: 'pillow-soft bread crumb with glossy toasted bun crown and creamy velvety butter sheen',
    colors: 'warm golden-brown crust, snowy white crumb, and rich yellow butter',
  },
  'bun butter jam': {
    appearance: 'freshly sliced soft bakery bun layered with rich creamy salted butter and glistening ruby-red mixed fruit jam',
    texture: 'pillowy soft bread with luscious glistening jam and silky butter layers',
    colors: 'golden toasted bun, ruby-red strawberry jam, and creamy yellow butter',
  },
  'bun maska': {
    appearance: 'warm toasted Iranian-style bakery bun generously spread with homemade clotted butter and maska cream',
    texture: 'soft warm bread with melting butter soaking into the crumb',
    colors: 'warm toasted crust with creamy butter accents',
  },
  'french fries': {
    appearance: 'portion of crisp straight-cut golden-yellow potato fries neatly stacked',
    texture: 'crispy exterior with light sea salt crystals and fluffy tender potato interior',
    colors: 'sunny golden-yellow with toasted edges',
  },

  // South Indian Tiffin
  'idli': {
    appearance: 'pair of authentic South Indian idlies, round pillow-soft steamed fermented rice cakes with neat domed tops and delicate porous steam dimples',
    texture: 'ultra-soft, spongy, fluffy white texture with subtle natural steam',
    colors: 'pure snowy white with soft pearlescent steam sheen',
  },
  'idly': {
    appearance: 'pair of traditional steamed South Indian idlies, perfectly round and puffed with delicate fluffy porous texture',
    texture: 'cloud-soft, airy, moist steamed rice cake crumb',
    colors: 'pristine white with subtle soft lighting highlights',
  },
  'dosa': {
    appearance: 'classic South Indian crepe folded neatly into an authentic crisp golden-brown roll or triangle',
    texture: 'paper-thin, lace-like crispy fermented batter with roasted ghee sheen and delicate lattice pores',
    colors: 'rich roasted golden-brown, amber, and honey-gold',
  },
  'masala dosa': {
    appearance: 'crispy South Indian golden dosa crepe rolled neatly, with savory turmeric-spiced potato masala filling visible at the open edge',
    texture: 'ultra-crisp exterior with red chutney glaze and tender seasoned potato mash',
    colors: 'deep roasted golden-brown with vibrant yellow potato masala',
  },
  'ghee roast': {
    appearance: 'extra-crispy South Indian ghee roast dosa rolled into a neat golden cylinder with rich roasted aroma',
    texture: 'glass-like crisp fermented crepe with glossy clarified butter sheen',
    colors: 'deep amber-gold with rich roasted brown gradient',
  },
  'poori': {
    appearance: 'pair of puffed golden-brown Indian pooris, perfectly inflated hollow spherical fried breads',
    texture: 'delicate crisp ballooned outer crust with soft tender interior steam pocket',
    colors: 'warm golden-amber with delicate blistered surface bubbles',
  },
  'pongal': {
    container: 'served neatly centered on a clean plate',
    appearance: 'comforting South Indian ven pongal, creamy steamed rice and yellow moong dal cooked with ghee, whole black peppercorns, curry leaves, and roasted cashews',
    texture: 'soft, creamy, melt-in-the-mouth comforting grain texture with glossy ghee finish',
    colors: 'pale golden-cream with glossy clarified butter and whole black spices',
  },
  'upma': {
    appearance: 'fluffy South Indian semolina rava upma neatly shaped, with visible mustard seeds, green chilies, and roasted cashews',
    texture: 'soft, moist, tender semolina grains cooked to delicate fluffiness',
    colors: 'light warm beige with green chili and golden cashew accents',
  },
  'parotta': {
    appearance: 'authentic flaky South Indian Malabar parotta, circular spiral layered flatbread with crisp golden toasted circles',
    texture: 'flaky, multi-layered, shredded, buttery texture with soft chewy pull',
    colors: 'toasted golden-brown with buttery ivory swirls',
  },
  'chapati': {
    appearance: 'soft circular whole wheat Indian chapati flatbread with gentle golden-brown roasted blister spots',
    texture: 'thin, pliable, tender layered whole wheat bread with light ghee glaze',
    colors: 'warm toasted wheat tan with gentle brown roasted marks',
  },

  // Meals & Rice
  'biryani': {
    container: 'served in an authentic ceramic bowl or single-serving plate',
    appearance: 'fragrant Hyderabadi Dum Biryani with separate long-grain basmati rice grains in alternating saffron-yellow and white hues, topped with fried brown onions and fresh mint',
    texture: 'fluffy distinct non-sticky basmati rice grains with succulent spiced meat pieces',
    colors: 'vibrant saffron-orange, golden yellow, white rice, and caramelized onion brown',
  },
  'chicken biryani': {
    container: 'served in a classic Indian restaurant bowl',
    appearance: 'authentic Dum Chicken Biryani with succulent spiced chicken piece nestled amongst fragrant long-grain basmati rice, garnished with golden crispy onions and fresh herbs',
    texture: 'steaming hot distinct rice grains with tender juicy spiced chicken and aromatic steam',
    colors: 'rich saffron, turmeric gold, white basmati, and deep roasted brown',
  },
  'veg biryani': {
    container: 'served in a clean restaurant dish',
    appearance: 'aromatic long-grain basmati rice layered with seasoned vegetables including carrots, green beans, and golden paneer cubes',
    texture: 'delicate separate rice grains with tender vegetable bites',
    colors: 'bright saffron-gold, emerald green beans, and roasted orange carrots',
  },
  'fried rice': {
    appearance: 'restaurant-style Indo-Chinese wok-tossed fried rice with finely diced vegetables and subtle natural steam',
    texture: 'distinct dry grains of rice with crisp vegetable bits and light soy glaze',
    colors: 'golden-tan rice with vibrant orange carrot and green scallion flecks',
  },
  'noodles': {
    appearance: 'savory wok-tossed hakka noodles swirled neatly with thin julienned bell peppers, cabbage, and spring onions',
    texture: 'springy tender noodles with glossy savory glaze',
    colors: 'warm golden-brown noodles with vibrant bell pepper ribbons',
  },
  'chicken 65': {
    appearance: 'bite-sized boneless chicken 65 pieces fried to vibrant deep-red perfection, tossed with fried green chilies and crisp curry leaves',
    texture: 'crunchy spicy exterior coating with juicy tender chicken inside',
    colors: 'deep crimson-red and spiced rust-orange with dark green curry leaves',
  },
  'paneer roll': {
    appearance: 'Indian street food kathi roll, warm golden paratha wrap tightly rolled around marinated grilled paneer cubes and sliced onions',
    texture: 'flaky toasted flatbread with tender smoky cottage cheese filling visible at the top',
    colors: 'golden toasted wrap with spiced orange-red paneer cubes',
  },
  'chicken roll': {
    appearance: 'savory Kolkata-style chicken kathi roll with flaky paratha wrapped neatly around succulent grilled spiced chicken pieces',
    texture: 'crispy flatbread with juicy tender meat and sliced onions peeking out',
    colors: 'golden-tan flatbread with grilled spiced chicken',
  },
  'burger': {
    appearance: 'gourmet restaurant burger with glossy toasted sesame-seed bun, thick savory patty, crisp green lettuce leaf, and melted cheese',
    texture: 'soft toasted bun crown, juicy textured patty, and crisp leafy green',
    colors: 'golden-brown bun, rich savory brown patty, vibrant cheddar gold, and fresh lettuce green',
  },
};

/**
 * Normalizes dish names for fuzzy lookup against the knowledge base
 */
function normalizeDishKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\(\d+[^)]*\)/g, '') // remove "(2 pcs)", "(1L)" etc.
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Intelligently generates a photographic prompt for any given dish name and category,
 * strictly abiding by the CounterPro restaurant studio photography standard.
 */
export function generatePhotorealisticFoodPrompt(
  dishName: string,
  categoryName: string = 'General'
): string {
  const cleanName = dishName.trim();
  const normalizedKey = normalizeDishKey(cleanName);
  const cat = (categoryName || '').toLowerCase();

  // 1. Direct match in culinary knowledge base
  let spec: DishVisualSpec | undefined = CULINARY_KNOWLEDGE_BASE[normalizedKey];

  // 2. Partial word match in culinary knowledge base
  if (!spec) {
    const matchedKey = Object.keys(CULINARY_KNOWLEDGE_BASE).find(k => {
      // e.g. "special masala chai" matches "chai", "crispy onion samosa" matches "samosa"
      return normalizedKey.includes(k) || k.includes(normalizedKey);
    });
    if (matchedKey) {
      spec = CULINARY_KNOWLEDGE_BASE[matchedKey];
    }
  }

  // 3. Fallback for unknown items: infer appearance based on category and dish name
  if (!spec) {
    const isDrink =
      cat.includes('tea') ||
      cat.includes('coffee') ||
      cat.includes('cold') ||
      cat.includes('beverage') ||
      cat.includes('juice') ||
      normalizedKey.includes('juice') ||
      normalizedKey.includes('shake') ||
      normalizedKey.includes('drink');

    const isBakery =
      cat.includes('snack') ||
      cat.includes('bake') ||
      normalizedKey.includes('puff') ||
      normalizedKey.includes('cake') ||
      normalizedKey.includes('cookie') ||
      normalizedKey.includes('biscuit') ||
      normalizedKey.includes('bun') ||
      normalizedKey.includes('toast');

    const isRiceOrMeal =
      cat.includes('meal') ||
      cat.includes('main') ||
      normalizedKey.includes('rice') ||
      normalizedKey.includes('biryani') ||
      normalizedKey.includes('curry') ||
      normalizedKey.includes('roti');

    if (isDrink) {
      spec = {
        container: 'served in an authentic clean transparent beverage glass',
        appearance: `authentic fresh ${cleanName} beverage with delicate natural liquid reflections and soft condensation highlights`,
        texture: 'smooth liquid texture with natural beverage depth and glossy surface reflections',
        colors: 'natural rich beverage tones with subtle soft lighting highlights',
      };
    } else if (isBakery) {
      spec = {
        appearance: `authentic freshly baked ${cleanName} with appetizing golden-brown exterior and delicate crumb texture`,
        texture: 'crisp flaky outer surface with soft tender interior and subtle natural baking blisters',
        colors: 'warm golden-brown, toasted amber, and buttery ivory tones',
      };
    } else if (isRiceOrMeal) {
      spec = {
        container: 'served on a clean minimalist restaurant dish',
        appearance: `authentic Indian restaurant preparation of ${cleanName} freshly prepared with subtle natural steam`,
        texture: 'tender textured food surface with glossy savory seasoning and natural culinary highlights',
        colors: 'warm appetizing spiced hues with vibrant garnish accents',
      };
    } else {
      spec = {
        appearance: `authentic delicious single-serving portion of ${cleanName} prepared in traditional Indian culinary style`,
        texture: 'freshly made savory texture with natural crisp and tender surfaces',
        colors: 'warm golden and appetizing natural food tones',
      };
    }
  }

  // 4. Construct complete universal prompt adhering to the strict standard
  const containerPart = spec.container ? `${spec.container}, ` : '';
  const appearancePart = spec.appearance;
  const texturePart = spec.texture;
  const colorsPart = spec.colors;

  return [
    `Photorealistic commercial restaurant food photography of authentic ${cleanName}.`,
    containerPart ? `${containerPart.trim()}` : '',
    `${appearancePart}.`,
    `Features ${texturePart}, with ${colorsPart}.`,
    'Centered composition, single serving, front slightly elevated three-quarter angle.',
    'Clean warm cream off-white background (#FAF7F2), soft diffused restaurant studio lighting, subtle realistic natural shadow underneath.',
    'Square 1:1 aspect ratio composition, high-detail food texture, authentic Indian restaurant presentation.',
    'No people, no hands, no restaurant staff, no text, no typography, no price, no menu labels, no logos, no watermarks, no brand names, no UI elements, no random props, no illustration, no vector, no 3D render.',
  ]
    .filter(Boolean)
    .join(' ');
}
