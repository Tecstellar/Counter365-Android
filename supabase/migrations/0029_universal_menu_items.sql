-- 0029_universal_menu_items.sql
-- Universal crowd-sourced & starter menu items pool grouped by shop category / type (Tea Shop, Cafe, Restaurant, etc.)
-- Enables auto-suggestions and starter catalog seeding for newly registered shops.

CREATE TABLE IF NOT EXISTS public.universal_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_type TEXT NOT NULL,
  category_name TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  half_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  has_half BOOLEAN NOT NULL DEFAULT FALSE,
  icon TEXT,
  image_url TEXT,
  popularity_score INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT universal_menu_items_unique_type_name UNIQUE (shop_type, name)
);

CREATE INDEX IF NOT EXISTS idx_universal_menu_items_shop_type
  ON public.universal_menu_items(shop_type);

CREATE INDEX IF NOT EXISTS idx_universal_menu_items_popularity
  ON public.universal_menu_items(shop_type, popularity_score DESC);

ALTER TABLE public.universal_menu_items ENABLE ROW LEVEL SECURITY;

-- Allow public and authenticated users to read suggestions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'universal_menu_items' AND policyname = 'Universal menu items are readable by all'
  ) THEN
    CREATE POLICY "Universal menu items are readable by all"
      ON public.universal_menu_items FOR SELECT
      USING (true);
  END IF;
END $$;

-- Allow authenticated and service role to insert/update universal menu items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'universal_menu_items' AND policyname = 'Universal menu items can be contributed by authenticated shops'
  ) THEN
    CREATE POLICY "Universal menu items can be contributed by authenticated shops"
      ON public.universal_menu_items FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Seed universal starter items for all standard business types
INSERT INTO public.universal_menu_items (shop_type, category_name, name, price, half_price, has_half, popularity_score)
VALUES
  -- Tea Shop
  ('Tea Shop', 'Tea & Coffee', 'Tea', 12.00, 7.00, true, 100),
  ('Tea Shop', 'Tea & Coffee', 'Strong Tea', 15.00, 9.00, true, 95),
  ('Tea Shop', 'Tea & Coffee', 'Milk Coffee', 20.00, 12.00, true, 90),
  ('Tea Shop', 'Tea & Coffee', 'Black Tea', 10.00, 6.00, true, 80),
  ('Tea Shop', 'Tea & Coffee', 'Ginger Tea', 15.00, 9.00, true, 85),
  ('Tea Shop', 'Tea & Coffee', 'Elaichi Tea', 18.00, 11.00, true, 85),
  ('Tea Shop', 'Tea & Coffee', 'Boost', 25.00, 15.00, true, 75),
  ('Tea Shop', 'Tea & Coffee', 'Horlicks', 25.00, 15.00, true, 75),
  ('Tea Shop', 'Snacks', 'Vada', 12.00, 7.00, true, 90),
  ('Tea Shop', 'Snacks', 'Bonda', 10.00, 6.00, true, 85),
  ('Tea Shop', 'Snacks', 'Samosa', 15.00, 9.00, true, 95),
  ('Tea Shop', 'Snacks', 'Bun Butter', 30.00, 18.00, true, 70),
  ('Tea Shop', 'Snacks', 'Egg Puffs', 25.00, 15.00, true, 80),
  ('Tea Shop', 'Snacks', 'Biscuit', 10.00, 6.00, true, 65),
  ('Tea Shop', 'Cold', 'Lemon Juice', 25.00, 15.00, true, 70),
  ('Tea Shop', 'Cold', 'Butter Milk', 20.00, 12.00, true, 65),
  ('Tea Shop', 'Cold', 'Cool Drink', 20.00, 12.00, true, 60),
  ('Tea Shop', 'Cold', 'Water 1L', 20.00, 0.00, false, 95),

  -- Cafe
  ('Cafe', 'Coffee', 'Espresso', 90.00, 0.00, false, 80),
  ('Cafe', 'Coffee', 'Cappuccino', 140.00, 0.00, false, 95),
  ('Cafe', 'Coffee', 'Latte', 150.00, 0.00, false, 90),
  ('Cafe', 'Coffee', 'Cold Brew', 170.00, 0.00, false, 75),
  ('Cafe', 'Coffee', 'Filter Coffee', 60.00, 0.00, false, 85),
  ('Cafe', 'Coffee', 'Hot Chocolate', 160.00, 0.00, false, 70),
  ('Cafe', 'Bakes', 'Croissant', 120.00, 0.00, false, 85),
  ('Cafe', 'Bakes', 'Brownie', 140.00, 0.00, false, 90),
  ('Cafe', 'Bakes', 'Banana Cake', 110.00, 0.00, false, 75),
  ('Cafe', 'Bakes', 'Cheese Toast', 160.00, 0.00, false, 80),
  ('Cafe', 'Bakes', 'Cookie', 60.00, 0.00, false, 70),
  ('Cafe', 'Bakes', 'Muffin', 130.00, 0.00, false, 70),
  ('Cafe', 'Cold', 'Iced Latte', 180.00, 0.00, false, 80),
  ('Cafe', 'Cold', 'Lemonade', 110.00, 0.00, false, 75),
  ('Cafe', 'Cold', 'Milkshake', 190.00, 0.00, false, 85),
  ('Cafe', 'Cold', 'Water', 20.00, 0.00, false, 90),

  -- Restaurant
  ('Restaurant', 'Starters', 'Paneer Tikka', 180.00, 100.00, true, 85),
  ('Restaurant', 'Starters', 'Chicken 65', 190.00, 110.00, true, 95),
  ('Restaurant', 'Starters', 'Gobi Manchurian', 150.00, 90.00, true, 90),
  ('Restaurant', 'Starters', 'Mushroom Fry', 160.00, 95.00, true, 80),
  ('Restaurant', 'Starters', 'Egg Chilli', 140.00, 80.00, true, 75),
  ('Restaurant', 'Main', 'Chicken Biryani', 220.00, 130.00, true, 100),
  ('Restaurant', 'Main', 'Mutton Biryani', 320.00, 190.00, true, 95),
  ('Restaurant', 'Main', 'Veg Biryani', 150.00, 90.00, true, 85),
  ('Restaurant', 'Main', 'Fried Rice', 140.00, 80.00, true, 85),
  ('Restaurant', 'Main', 'Full Meals', 160.00, 0.00, false, 95),
  ('Restaurant', 'Main', 'Butter Naan', 45.00, 0.00, false, 90),
  ('Restaurant', 'Cold', 'Fresh Juice', 90.00, 0.00, false, 80),
  ('Restaurant', 'Cold', 'Lassi', 80.00, 0.00, false, 75),
  ('Restaurant', 'Cold', 'Soda', 40.00, 0.00, false, 70),
  ('Restaurant', 'Cold', 'Water', 20.00, 0.00, false, 95),

  -- Fast Food
  ('Fast Food', 'Rolls & Burgers', 'Chicken Roll', 90.00, 0.00, false, 95),
  ('Fast Food', 'Rolls & Burgers', 'Paneer Roll', 80.00, 0.00, false, 90),
  ('Fast Food', 'Rolls & Burgers', 'Veg Burger', 70.00, 0.00, false, 85),
  ('Fast Food', 'Rolls & Burgers', 'Chicken Burger', 110.00, 0.00, false, 90),
  ('Fast Food', 'Fried', 'French Fries', 80.00, 0.00, false, 90),
  ('Fast Food', 'Fried', 'Chicken Nuggets', 110.00, 0.00, false, 85),
  ('Fast Food', 'Cold', 'Cold Coffee', 70.00, 0.00, false, 80),
  ('Fast Food', 'Cold', 'Coke', 40.00, 0.00, false, 85),

  -- Tiffin Shop
  ('Tiffin Shop', 'Morning', 'Idli (2 pcs)', 30.00, 0.00, false, 95),
  ('Tiffin Shop', 'Morning', 'Medu Vada', 20.00, 0.00, false, 90),
  ('Tiffin Shop', 'Morning', 'Plain Dosa', 50.00, 0.00, false, 90),
  ('Tiffin Shop', 'Morning', 'Masala Dosa', 70.00, 0.00, false, 95),
  ('Tiffin Shop', 'Morning', 'Ghee Roast', 85.00, 0.00, false, 85),
  ('Tiffin Shop', 'Morning', 'Poori Masala', 55.00, 0.00, false, 90),
  ('Tiffin Shop', 'Morning', 'Pongal', 50.00, 0.00, false, 85),
  ('Tiffin Shop', 'Evening', 'Parotta (2 pcs)', 50.00, 0.00, false, 95),
  ('Tiffin Shop', 'Evening', 'Kothu Parotta', 110.00, 0.00, false, 90),
  ('Tiffin Shop', 'Evening', 'Egg Dosa', 65.00, 0.00, false, 85),
  ('Tiffin Shop', 'Evening', 'Chappati', 45.00, 0.00, false, 80),
  ('Tiffin Shop', 'Cold', 'Filter Coffee', 25.00, 0.00, false, 90),
  ('Tiffin Shop', 'Cold', 'Tea', 15.00, 0.00, false, 90)
ON CONFLICT (shop_type, name) DO UPDATE SET
  price = EXCLUDED.price,
  half_price = EXCLUDED.half_price,
  has_half = EXCLUDED.has_half,
  category_name = EXCLUDED.category_name,
  popularity_score = universal_menu_items.popularity_score + 1,
  updated_at = NOW();
