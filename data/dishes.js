/*
  DISH LIBRARY — single, atomic dishes (no combos). Edit freely, or use the in-app "Dishes" tab (saves to the browser).

  Each day is a flat list of these dishes (count varies, ~3–7), scaled so together they use the day's pool exactly.

  Schema:
  {
    id:      'unique-kebab-id',
    name:    'Simple name',            // one dish — "Upma", not "Upma with boiled eggs"
    cuisine: 'North Indian',           // board column on the Dishes page: North Indian | South Indian | Continental | Basics
                                       // (cuisine-neutral items) | any new one you create. Not used by the generator.
    common:  true,                     // optional: everyday staple/side (roti, rice, boiled eggs…) — may repeat often
    items:   { foodId: units, ... },   // foodIds from FOODS in substitutions.js
    extras:  'free aromatics / garnish (no macros counted)',
    method:  'one-line how to cook',
  }

  Units are exchange units for ONE normal serving (1 C = 30g raw rice, 1 L = 40g raw dal, 1 E = 1 egg / 25g paneer /
  1 cheese slice, 1 P = 1 scoop whey / 6 whites, 1 V = 100g veg, 1 O = 10ml oil). Quantities are rescaled to the
  day's pool, so realistic servings mean less rescaling. Dates, electrolyte, nuts, fruit and skyr are separate daily
  items — dishes never contain them.
*/
var DISHES = [
  { id: 'toast', name: 'Toast', cuisine: 'Continental', common: true, items: { bread: 1.25, butter: 0.5 }, method: 'Toast and butter lightly.' },
  { id: 'egg-cheese-sandwich', name: 'Egg cheese sandwich', cuisine: 'Continental',
    items: { bread: 1.25, egg: 1, egg_whites: 0.5, cheese: 1, butter: 1 }, extras: 'onion, tomato, green chilli, pepper',
    method: 'Scramble egg + whites with veg, layer with cheese in bread, grill with butter.' },
  { id: 'oat-pancakes', name: 'Oat protein pancakes', cuisine: 'Continental',
    items: { oats: 1.25, whey: 1, egg: 2, butter: 1 }, extras: 'cinnamon, vanilla, pinch of baking powder',
    method: 'Blend oats, whey, eggs and a splash of water; cook small pancakes in butter.' },
  { id: 'masala-omelette', name: 'Masala omelette', cuisine: 'North Indian',
    items: { egg: 2, egg_whites: 0.5, oil: 1 }, extras: 'onion, tomato, chilli, coriander', method: 'Whisk with chopped veg and cook in a non-stick pan.' },
  { id: 'egg-bhurji', name: 'Egg bhurji', cuisine: 'North Indian',
    items: { egg: 2, egg_whites: 0.5, oil: 1 }, extras: 'onion, tomato, green chilli, pav bhaji masala', method: 'Scramble with the masala.' },
  { id: 'shakshuka', name: 'Shakshuka', cuisine: 'Continental',
    items: { egg: 2, tomato: 0.5, capsicum: 0.5, olive_oil: 1 }, extras: 'onion, garlic, paprika, cumin',
    method: 'Simmer tomato-pepper sauce in olive oil, crack in eggs, cover till set.' },
  { id: 'oat-porridge', name: 'Whey oat porridge', cuisine: 'Continental',
    items: { oats: 1.25, whey: 1, ghee: 0.5 }, extras: 'cinnamon, cardamom', method: 'Roast oats in ghee, cook with water, cool slightly, stir in whey.' },
  { id: 'overnight-oats', name: 'Overnight whey oats', cuisine: 'Continental',
    items: { oats: 1.25, whey: 1 }, extras: 'cinnamon, vanilla', method: 'Soak oats overnight in water; stir in whey in the morning.' },
  { id: 'rajma-burrito-bowl', name: 'Rajma burrito bowl', cuisine: 'Continental',
    items: { rajma: 1, brown_rice: 1.5, capsicum: 0.4, lettuce: 0.3, tomato: 0.3, olive_oil: 1 }, extras: 'cumin, paprika, lime, coriander',
    method: 'Spiced rajma over lime-coriander brown rice with peppers, lettuce and salsa.' },
  { id: 'veg-egg-wrap', name: 'Grilled veg egg wrap', cuisine: 'Continental',
    items: { atta: 1.25, zucchini: 0.4, capsicum: 0.3, onion: 0.3, egg: 1, olive_oil: 1 }, extras: 'garlic, mint, lemon, chilli sauce',
    method: 'Grill veg in olive oil, add a thin omelette, wrap in rotis.' },
  { id: 'egg-fried-rice', name: 'Egg fried rice', cuisine: 'Continental',
    items: { brown_rice: 1.25, cabbage: 0.4, carrot: 0.3, beans: 0.3, egg: 1, egg_whites: 0.5, oil: 1 }, extras: 'garlic, spring onion, soy sauce, vinegar',
    method: 'Scramble eggs, stir-fry veg on high heat, toss with cooked brown rice.' },
  { id: 'broccoli-stir-fry', name: 'Broccoli capsicum stir-fry', cuisine: 'Continental',
    items: { broccoli: 0.6, capsicum: 0.4, olive_oil: 1 }, extras: 'garlic, chilli flakes, lemon', method: 'Stir-fry on high heat with garlic.' },
  { id: 'quinoa', name: 'Quinoa', cuisine: 'Continental', common: true, items: { quinoa: 1.25 }, method: 'Rinse and simmer 15 min.' },
  { id: 'sprouts-quinoa-salad', name: 'Sprouts quinoa salad', cuisine: 'Continental',
    items: { green_moong: 1, quinoa: 1.25, cucumber: 0.4, capsicum: 0.3, tomato: 0.3, olive_oil: 1 }, extras: 'lemon, chaat masala, mint',
    method: 'Toss lightly steamed sprouts with cooked quinoa, chopped veg, olive oil and lemon.' },
  { id: 'green-salad', name: 'Green salad', cuisine: 'Basics', common: true,
    items: { cucumber: 0.5, lettuce: 0.3, tomato: 0.2 }, extras: 'lemon, salt, pepper' },

  { id: 'roti', name: 'Roti', cuisine: 'North Indian', common: true, items: { atta: 1.25 }, method: 'Phulkas from the atta.' },
  { id: 'steamed-rice', name: 'Steamed rice', cuisine: 'Basics', common: true, items: { rice: 1.5 } },
  { id: 'jeera-rice', name: 'Jeera rice', cuisine: 'North Indian', items: { rice: 1.5, oil: 0.5 }, extras: 'cumin, bay leaf', method: 'Temper cumin, add rice and water.' },
  { id: 'brown-rice', name: 'Brown rice', cuisine: 'Basics', common: true, items: { brown_rice: 1.5 } },
  { id: 'paneer-paratha', name: 'Paneer paratha', cuisine: 'North Indian',
    items: { atta: 1.5, paneer: 2, ghee: 1 }, extras: 'green chilli, ajwain, coriander', method: 'Stuff atta dough with spiced paneer, roast with ghee.' },
  { id: 'aloo-paratha', name: 'Aloo paratha', cuisine: 'North Indian',
    items: { atta: 0.75, potato: 0.5, ghee: 1 }, extras: 'green chilli, coriander, amchur', method: 'Stuff atta with spiced mashed potato, roast with ghee.' },
  { id: 'methi-thepla', name: 'Methi thepla', cuisine: 'North Indian',
    items: { atta: 1.25, methi: 1, oil: 1 }, extras: 'ajwain, turmeric, chilli, sesame', method: 'Knead atta with methi & spices, roll thin, roast.' },
  { id: 'paneer-poha', name: 'Paneer poha', cuisine: 'North Indian',
    items: { poha: 1.25, paneer: 2, oil: 1 }, extras: 'onion, curry leaves, mustard seeds, turmeric, lemon',
    method: 'Rinse poha; temper, add onion, crumbled paneer, poha; finish with lemon.' },
  { id: 'paneer-sooji-chilla', name: 'Paneer sooji chilla', cuisine: 'North Indian',
    items: { sooji: 1.25, paneer: 2, oil: 1 }, extras: 'onion, tomato, chilli, coriander', method: 'Rest sooji batter 10 min; cook chillas, fill with spiced paneer.' },
  { id: 'dalia-upma', name: 'Dalia upma', cuisine: 'South Indian',
    items: { dalia: 1.25, mixed_veg: 0.5, oil: 1 }, extras: 'onion, green chilli, ginger, mustard seeds', method: 'Roast dalia, temper, pressure-cook 2 whistles with veg.' },
  { id: 'masala-oats', name: 'Masala oats', cuisine: 'North Indian',
    items: { oats: 1.25, carrot: 0.3, beans: 0.4, capsicum: 0.3, oil: 1 }, extras: 'mustard seeds, curry leaves, chilli', method: 'Temper, sauté veg, add oats and water, cook 3 min.' },
  { id: 'rava-upma', name: 'Rava upma', cuisine: 'South Indian',
    items: { sooji: 1.25, mixed_veg: 1, ghee: 1 }, extras: 'mustard seeds, curry leaves, lemon', method: 'Roast rava, temper, sauté veg, add hot water and rava.' },
  { id: 'moong-khichdi', name: 'Moong dal khichdi', cuisine: 'North Indian',
    items: { moong_dal: 1, rice: 1.5, lauki: 0.5, carrot: 0.5, ghee: 1 }, extras: 'cumin, ginger, turmeric, hing', method: 'Pressure-cook dal, rice and veg; ghee-cumin tadka.' },
  { id: 'dalia-khichdi', name: 'Dalia khichdi', cuisine: 'North Indian',
    items: { dalia: 1.25, mixed_veg: 1, ghee: 1 }, extras: 'cumin, ginger, turmeric', method: 'Pressure-cook dalia with diced veg; ghee-cumin tadka.' },
  { id: 'chole-chaat', name: 'Chole chaat', cuisine: 'North Indian',
    items: { chole: 1, potato: 0.75, cucumber: 0.4, tomato: 0.3, onion: 0.3, olive_oil: 0.5 }, extras: 'chaat masala, tamarind, mint, lemon',
    method: 'Toss boiled chole and potato with chopped veg and chutneys.' },

  { id: 'rajma', name: 'Rajma', cuisine: 'North Indian', items: { rajma: 1, onion: 0.5, ghee: 1 }, extras: 'tomato, ginger-garlic, garam masala', method: 'Soak, pressure-cook, simmer in onion-tomato masala.' },
  { id: 'chole', name: 'Chole', cuisine: 'North Indian', items: { chole: 1, tomato: 0.5, oil: 1 }, extras: 'onion, chole masala', method: 'Pressure-cook soaked chole, simmer in masala.' },
  { id: 'dal-tadka', name: 'Dal tadka', cuisine: 'North Indian', items: { toor_dal: 1, ghee: 1 }, extras: 'garlic, cumin, red chilli', method: 'Cook toor dal; garlic-cumin tadka.' },
  { id: 'masoor-dal', name: 'Masoor dal', cuisine: 'North Indian', items: { masoor_dal: 1, oil: 1 }, extras: 'onion, tomato, cumin', method: 'Cook masoor; tomato tadka.' },
  { id: 'lobia', name: 'Lobia masala', cuisine: 'North Indian', items: { lobia: 1, oil: 1 }, extras: 'onion, tomato, garlic', method: 'Pressure-cook lobia in masala.' },
  { id: 'kala-chana', name: 'Kala chana', cuisine: 'North Indian', items: { kala_chana: 1, oil: 1 }, extras: 'onion, tomato, mustard seeds', method: 'Dry kala chana masala.' },
  { id: 'chana-dal-lauki', name: 'Chana dal lauki', cuisine: 'North Indian', items: { chana_dal: 1, lauki: 1, ghee: 1 }, extras: 'tomato, cumin, garam masala', method: 'Pressure-cook chana dal with lauki; ghee tadka.' },
  { id: 'dal-palak', name: 'Dal palak', cuisine: 'North Indian', items: { moong_dal: 1, spinach: 1, ghee: 1 }, extras: 'garlic, cumin, red chilli', method: 'Cook moong dal with chopped palak; garlic tadka.' },
  { id: 'dal-makhani', name: 'Dal makhani', cuisine: 'North Indian', items: { urad_dal: 0.6, rajma: 0.4, butter: 1 }, extras: 'tomato puree, ginger-garlic, kasuri methi', method: 'Slow-cook urad + rajma with tomato and butter.' },
  { id: 'besan-chilla', name: 'Besan chilla', cuisine: 'North Indian', items: { besan: 1, spinach: 0.5, tomato: 0.5, oil: 1 }, extras: 'onion, ajwain, green chutney', method: 'Besan-spinach batter, thin chillas on a tawa.' },
  { id: 'sprouts-chaat', name: 'Sprouts chaat', cuisine: 'North Indian', items: { green_moong: 1 }, extras: 'onion, tomato, lemon, chaat masala', method: 'Lightly steam sprouts, toss with aromatics.' },
  { id: 'egg-curry', name: 'Egg curry', cuisine: 'North Indian', items: { egg: 2, oil: 1 }, extras: 'onion-tomato masala, curry leaves', method: 'Simmer halved boiled eggs in a light masala.' },
  { id: 'palak-paneer', name: 'Palak paneer', cuisine: 'North Indian', items: { spinach: 0.6, mushroom: 0.4, paneer: 2, oil: 1 }, extras: 'garlic, cumin, kasuri methi', method: 'Sauté garlic, mushroom & paneer, add pureed palak.' },

  { id: 'bhindi-masala', name: 'Bhindi masala', cuisine: 'North Indian', items: { bhindi: 1, oil: 1 }, extras: 'onion, amchur, coriander powder', method: 'Dry-fry with spices.' },
  { id: 'lauki-sabzi', name: 'Lauki sabzi', cuisine: 'North Indian', items: { lauki: 1, oil: 1 }, extras: 'cumin, tomato', method: 'Simple tomato-cumin sabzi.' },
  { id: 'cabbage-sabzi', name: 'Cabbage sabzi', cuisine: 'North Indian', items: { cabbage: 1, oil: 1 }, extras: 'mustard seeds, curry leaves', method: 'Stir-fry with mustard seeds.' },
  { id: 'baingan-bharta', name: 'Baingan bharta', cuisine: 'North Indian', items: { brinjal: 1, oil: 1 }, extras: 'onion, tomato, garlic, chilli', method: 'Flame-roast, mash, cook with onion-tomato.' },
  { id: 'aloo-gobhi', name: 'Aloo gobhi', cuisine: 'North Indian', items: { potato: 0.4, cauliflower: 1, oil: 1 }, extras: 'onion, ginger, turmeric', method: 'Dry aloo gobhi (potato counts as carbs).' },
  { id: 'tori-sabzi', name: 'Tori sabzi', cuisine: 'North Indian', items: { tori: 0.7, tomato: 0.3, ghee: 1 }, extras: 'cumin, green chilli', method: 'Quick ridge-gourd & tomato sabzi.' },
  { id: 'beans-poriyal', name: 'Beans poriyal', cuisine: 'South Indian', items: { beans: 1, oil: 1 }, extras: 'mustard seeds, urad dal, curry leaves', method: 'Stir-fry finely chopped beans with tempering.' },
  { id: 'kachumber', name: 'Kachumber salad', cuisine: 'North Indian', common: true, items: { cucumber: 0.5, onion: 0.3, tomato: 0.2 }, extras: 'lemon, chaat masala' },

  { id: 'idli', name: 'Idli', cuisine: 'South Indian', items: { batter: 1.5 }, method: 'Steam 10–12 min.' },
  { id: 'dosa', name: 'Dosa', cuisine: 'South Indian', items: { batter: 1.5, oil: 0.5 }, extras: 'tomato chutney', method: 'Thin dosas on a hot tawa.' },
  { id: 'paneer-dosa', name: 'Paneer dosa', cuisine: 'South Indian', items: { batter: 1.5, paneer: 2, ghee: 1 }, extras: 'onion, chilli, podi', method: 'Dosa filled with spiced crumbled paneer.' },
  { id: 'veg-uttapam', name: 'Veg uttapam', cuisine: 'South Indian', items: { batter: 1.5, onion: 0.4, tomato: 0.3, capsicum: 0.3, oil: 1 }, extras: 'mint chutney', method: 'Thick uttapams topped with chopped veg.' },
  { id: 'sambar', name: 'Sambar', cuisine: 'South Indian', items: { toor_dal: 1, drumstick: 0.5, pumpkin: 0.5, oil: 1 }, extras: 'tamarind, sambar powder, curry leaves', method: 'Cook dal with veg, tamarind and sambar powder; temper.' },
  { id: 'bisi-bele-bath', name: 'Bisi bele bath', cuisine: 'South Indian', items: { toor_dal: 1, rice: 1.5, beans: 0.4, carrot: 0.3, capsicum: 0.3, ghee: 1 }, extras: 'tamarind, bisi bele powder', method: 'Cook rice, dal and veg soft with tamarind & masala; ghee tadka.' },
  { id: 'pesarattu', name: 'Pesarattu', cuisine: 'South Indian', items: { green_moong: 1, rice: 1, onion: 0.5, capsicum: 0.5, oil: 1 }, extras: 'ginger, green chilli', method: 'Green moong + rice batter dosas topped with onion-capsicum.' },

  { id: 'whey-shake', name: 'Whey shake', cuisine: 'Basics', common: true, items: { whey: 1 }, method: 'Shake with water.' },
  { id: 'whey-pudding', name: 'Whey pudding', cuisine: 'Basics', common: true, items: { whey: 1 }, extras: 'cinnamon, vanilla', method: 'Whisk with a little water; chill 10 min.' },
  { id: 'egg-white-scramble', name: 'Egg-white scramble', cuisine: 'Basics', common: true, items: { egg_whites: 1 }, extras: 'pepper, herbs', method: 'Dry-scramble in a non-stick pan.' },
  { id: 'boiled-eggs', name: 'Boiled eggs', cuisine: 'Basics', common: true, items: { egg: 2 }, method: 'Boil 9 min.' },
];
