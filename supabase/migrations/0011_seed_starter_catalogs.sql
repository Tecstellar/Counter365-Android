-- 0011_seed_starter_catalogs.sql

-- Helper function to seed starter categories and items for a newly registered shop based on its shop_type
CREATE OR REPLACE FUNCTION public.seed_starter_catalog(p_shop_id UUID, p_shop_type TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_cat_tea UUID;
  v_cat_snack UUID;
  v_cat_cold UUID;
  v_cat_coffee UUID;
  v_cat_bakes UUID;
  v_cat_rolls UUID;
  v_cat_fried UUID;
  v_cat_morn UUID;
  v_cat_eve UUID;
  v_cat_addons UUID;
  v_cat_starters UUID;
  v_cat_main UUID;
BEGIN
  IF p_shop_type = 'Tea Shop' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Tea & Coffee', 0) RETURNING id INTO v_cat_tea;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Snacks', 1) RETURNING id INTO v_cat_snack;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_tea, 'Tea', 12.00, 7.00, true, true),
      (p_shop_id, v_cat_tea, 'Strong Tea', 15.00, 9.00, true, true),
      (p_shop_id, v_cat_tea, 'Milk Coffee', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_tea, 'Black Tea', 10.00, 6.00, true, false),
      (p_shop_id, v_cat_tea, 'Boost', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_tea, 'Horlicks', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_tea, 'Ginger Tea', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_tea, 'Elaichi Tea', 18.00, 11.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_snack, 'Vada', 12.00, 7.00, true, false),
      (p_shop_id, v_cat_snack, 'Bonda', 10.00, 6.00, true, false),
      (p_shop_id, v_cat_snack, 'Samosa', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_snack, 'Bun Butter', 30.00, 18.00, true, false),
      (p_shop_id, v_cat_snack, 'Egg Puffs', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_snack, 'Biscuit', 10.00, 6.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Lemon Juice', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_cold, 'Butter Milk', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_cold, 'Cool Drink', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Cafe' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Coffee', 0) RETURNING id INTO v_cat_coffee;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Bakes', 1) RETURNING id INTO v_cat_bakes;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_coffee, 'Espresso', 90.00, 0.00, false, true),
      (p_shop_id, v_cat_coffee, 'Cappuccino', 140.00, 0.00, false, true),
      (p_shop_id, v_cat_coffee, 'Latte', 150.00, 0.00, false, false),
      (p_shop_id, v_cat_coffee, 'Cold Brew', 170.00, 0.00, false, false),
      (p_shop_id, v_cat_coffee, 'Filter Coffee', 60.00, 36.00, true, false),
      (p_shop_id, v_cat_coffee, 'Hot Chocolate', 160.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_bakes, 'Croissant', 120.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Brownie', 140.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Banana Cake', 110.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Cheese Toast', 160.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Cookie', 60.00, 36.00, true, false),
      (p_shop_id, v_cat_bakes, 'Muffin', 130.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Iced Latte', 180.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Lemonade', 110.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Milkshake', 190.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Fast Food' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Rolls & Burgers', 0) RETURNING id INTO v_cat_rolls;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Fried', 1) RETURNING id INTO v_cat_fried;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_rolls, 'Chicken Roll', 90.00, 0.00, false, true),
      (p_shop_id, v_cat_rolls, 'Paneer Roll', 80.00, 0.00, false, true),
      (p_shop_id, v_cat_rolls, 'Veg Burger', 70.00, 0.00, false, false),
      (p_shop_id, v_cat_rolls, 'Chicken Burger', 110.00, 0.00, false, false),
      (p_shop_id, v_cat_rolls, 'Shawarma', 120.00, 0.00, false, false),
      (p_shop_id, v_cat_rolls, 'Egg Roll', 70.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_fried, 'French Fries', 80.00, 0.00, false, false),
      (p_shop_id, v_cat_fried, 'Chicken 65', 140.00, 0.00, false, false),
      (p_shop_id, v_cat_fried, 'Nuggets', 120.00, 0.00, false, false),
      (p_shop_id, v_cat_fried, 'Onion Rings', 70.00, 0.00, false, false),
      (p_shop_id, v_cat_fried, 'Popcorn Chicken', 130.00, 0.00, false, false),
      (p_shop_id, v_cat_fried, 'Momos', 90.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Cola', 40.00, 24.00, true, false),
      (p_shop_id, v_cat_cold, 'Cold Coffee', 90.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Mojito', 80.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Tiffin Shop' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Morning', 0) RETURNING id INTO v_cat_morn;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Evening', 1) RETURNING id INTO v_cat_eve;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Add-ons', 2) RETURNING id INTO v_cat_addons;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_morn, 'Idly (2)', 20.00, 12.00, true, true),
      (p_shop_id, v_cat_morn, 'Poori (2)', 40.00, 24.00, true, true),
      (p_shop_id, v_cat_morn, 'Pongal', 40.00, 24.00, true, false),
      (p_shop_id, v_cat_morn, 'Vada', 12.00, 7.00, true, false),
      (p_shop_id, v_cat_morn, 'Upma', 30.00, 18.00, true, false),
      (p_shop_id, v_cat_morn, 'Dosa', 40.00, 24.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_eve, 'Chapathi (2)', 35.00, 21.00, true, false),
      (p_shop_id, v_cat_eve, 'Parotta (2)', 40.00, 24.00, true, false),
      (p_shop_id, v_cat_eve, 'Kothu Parotta', 80.00, 0.00, false, false),
      (p_shop_id, v_cat_eve, 'Egg Dosa', 60.00, 36.00, true, false),
      (p_shop_id, v_cat_eve, 'Uthappam', 45.00, 27.00, true, false),
      (p_shop_id, v_cat_eve, 'Rice Meals', 90.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_addons, 'Extra Chutney', 10.00, 6.00, true, false),
      (p_shop_id, v_cat_addons, 'Sambar', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_addons, 'Curd', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_addons, 'Egg', 12.00, 7.00, true, false);

  ELSE -- 'Restaurant' default
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Starters', 0) RETURNING id INTO v_cat_starters;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Main', 1) RETURNING id INTO v_cat_main;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_starters, 'Chicken 65', 180.00, 0.00, false, true),
      (p_shop_id, v_cat_starters, 'Gobi 65', 150.00, 0.00, false, true),
      (p_shop_id, v_cat_starters, 'Chicken Soup', 110.00, 0.00, false, false),
      (p_shop_id, v_cat_starters, 'Prawn Fry', 260.00, 0.00, false, false),
      (p_shop_id, v_cat_starters, 'Paneer Tikka', 220.00, 0.00, false, false),
      (p_shop_id, v_cat_starters, 'Mushroom Pepper', 200.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_main, 'Chicken Biryani', 260.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Veg Biryani', 180.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Fried Rice', 190.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Noodles', 180.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Full Meals', 160.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Butter Naan', 45.00, 27.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Fresh Juice', 90.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Lassi', 80.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Soda', 40.00, 24.00, true, false),
      (p_shop_id, v_cat_cold, 'Water', 20.00, 0.00, false, false);
  END IF;

  -- Create initial Pro subscription for 30 free days / 1 year
  INSERT INTO public.subscriptions (shop_id, plan, status, amount, interval)
  VALUES (p_shop_id, 'pro', 'active', 199.00, 'year')
  ON CONFLICT (shop_id) DO NOTHING;
END;
$$;
