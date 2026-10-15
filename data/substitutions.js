// Exchange system derived from the nutritionist's PDF + substitution matrix.
// Foods carry macros per ONE unit (kcal, protein p, carbs c, fat f); SUB_GROUPS (below) decides what swaps with what.
// `step` (optional) = smallest practical amount in units: whole eggs, whole egg whites, half scoops of whey.

var LEGUMES = {
  toor_dal: 'Toor / arhar dal (raw)', moong_dal: 'Yellow moong dal (raw)', masoor_dal: 'Masoor dal (raw)',
  chana_dal: 'Chana dal (raw)', urad_dal: 'Whole urad (raw)', rajma: 'Rajma (raw)', chole: 'Kabuli chana / chole (raw)',
  kala_chana: 'Kala chana (raw)', lobia: 'Lobia (raw)', green_moong: 'Whole green moong (raw; ≈100g sprouted)',
  besan: 'Besan (gram flour)',
};
var VEGETABLES = {
  spinach: 'Spinach / palak', methi: 'Methi leaves', bhindi: 'Bhindi (okra)', lauki: 'Lauki (bottle gourd)',
  tori: 'Tori (ridge gourd)', cauliflower: 'Cauliflower', cabbage: 'Cabbage', broccoli: 'Broccoli',
  capsicum: 'Capsicum', mushroom: 'Mushroom', beans: 'French beans', carrot: 'Carrot', brinjal: 'Brinjal',
  cucumber: 'Cucumber', zucchini: 'Zucchini', pumpkin: 'Red pumpkin', drumstick: 'Drumstick',
  tomato: 'Tomato', onion: 'Onion', lettuce: 'Lettuce / salad greens', mixed_veg: 'Mixed vegetables',
};
var FRUITS = {
  apple: 'Apple', orange: 'Orange', watermelon: 'Watermelon', muskmelon: 'Muskmelon', berries: 'Berries',
  papaya: 'Papaya', kiwi: 'Kiwi', pineapple: 'Pineapple', peach: 'Peach', mango: 'Mango', guava: 'Guava',
  grapes: 'Grapes', pomegranate: 'Pomegranate', pear: 'Pear', mixed_fruit: 'Mixed seasonal fruit',
};

var FOODS = (function () {
  var foods = {
    whey: { name: 'Whey protein (The Whole Truth)', qty: 30, unit: 'g', step: 0.5, kcal: 113, p: 26, c: 0.9, f: 0.6 },
    egg_whites: { name: 'Egg whites', qty: 6, unit: 'egg whites', step: 1 / 6, kcal: 102, p: 21.6, c: 1.4, f: 0.3 },

    egg: { name: 'Whole egg', qty: 1, unit: 'eggs', step: 1, kcal: 61.5, p: 5.5, c: 0, f: 4.4 },
    paneer: { name: 'Paneer', qty: 25, unit: 'g', kcal: 66, p: 4.6, c: 0.9, f: 5 },
    cheese: { name: 'Cheese slice', qty: 1, unit: 'slices', kcal: 62, p: 3.6, c: 1.2, f: 4.8 },
    mixed_nuts: { name: 'Mixed nuts (any)', qty: 10, unit: 'g', kcal: 59, p: 1.7, c: 1.6, f: 5.1 },

    rice: { name: 'White rice (raw)', qty: 30, unit: 'g', kcal: 105, p: 2.4, c: 24, f: 0.3 },
    brown_rice: { name: 'Brown rice (raw)', qty: 30, unit: 'g', kcal: 108, p: 2.3, c: 23, f: 0.8 },
    quinoa: { name: 'Quinoa (raw)', qty: 30, unit: 'g', kcal: 111, p: 4.2, c: 19.5, f: 1.8 },
    oats: { name: 'Rolled oats', qty: 30, unit: 'g', kcal: 117, p: 4, c: 20, f: 2 },
    poha: { name: 'Poha', qty: 30, unit: 'g', kcal: 105, p: 2, c: 23, f: 0.4 },
    dalia: { name: 'Dalia (broken wheat)', qty: 30, unit: 'g', kcal: 103, p: 3.7, c: 22.5, f: 0.4 },
    atta: { name: 'Whole-wheat atta', qty: 30, unit: 'g', kcal: 109, p: 3, c: 23, f: 0.5 },
    sooji: { name: 'Sooji / rava (wheat)', qty: 30, unit: 'g', kcal: 104, p: 3.1, c: 22, f: 0.3 },
    bread: { name: 'Whole-wheat bread', qty: 40, unit: 'g', piece: [25, 'slices'], kcal: 100.8, p: 5, c: 14.4, f: 1.4 },
    potato: { name: 'Potato', qty: 100, unit: 'g', kcal: 77, p: 2, c: 17, f: 0.1 },
    batter: { name: 'Dosa / idli batter', qty: 80, unit: 'g', kcal: 105, p: 3, c: 22, f: 0.4 },

    oil: { name: 'Oil', qty: 10, unit: 'ml', kcal: 90, p: 0, c: 0, f: 10 },
    ghee: { name: 'Ghee', qty: 10, unit: 'ml', kcal: 90, p: 0, c: 0, f: 10 },
    butter: { name: 'Butter', qty: 10, unit: 'g', kcal: 90, p: 0, c: 0, f: 10 },
    olive_oil: { name: 'Olive oil', qty: 10, unit: 'ml', kcal: 90, p: 0, c: 0, f: 10 },

    skyr: { name: 'Skyr high-protein yogurt (Milky Mist)', qty: 150, unit: 'g', kcal: 144, p: 17, c: 14, f: 2.3 },
    greek_yogurt: { name: 'High-protein Greek yogurt (plain)', qty: 150, unit: 'g', kcal: 144, p: 17, c: 14, f: 2.3 },

    dates: { name: 'Dates', qty: 2, unit: 'dates', kcal: 47, p: 0.4, c: 11, f: 0.1 },
    // Approximate label values; replaces the PDF's 20g Tang (73 kcal, 16g carbs).
    electrolyte: { name: 'Fast&Up Reload electrolyte', qty: 1, unit: 'tablets', kcal: 5, p: 0, c: 1, f: 0 },

    banana: { name: 'Banana (half-quantity fruit)', qty: 50, unit: 'g', kcal: 44.5, p: 0.55, c: 10, f: 0.15 },
    chikoo: { name: 'Chikoo (half-quantity fruit)', qty: 50, unit: 'g', kcal: 47, p: 0.2, c: 10, f: 0.5 },
  };
  // Groups that share the PDF's generic macros for the whole group.
  function group(qty, unit, m, names) {
    Object.keys(names).forEach(function (id) {
      foods[id] = { name: names[id], qty: qty, unit: unit, kcal: m[0], p: m[1], c: m[2], f: m[3] };
    });
  }
  group(40, 'g', [156, 12, 26, 0.4], LEGUMES);
  group(100, 'g', [32, 0, 8, 0], VEGETABLES);
  group(100, 'g', [64, 0, 16, 0], FRUITS);
  return foods;
})();

// Swap groups: every food in a group replaces any other in the same group, one unit for one unit.
// `id` is the exchange-unit letter used in plan.js and dishes.js. `fixed` groups are fixed daily items, never in dishes.
var SUB_GROUPS = [
  { id: 'P', name: 'Protein', source: 'Substitution matrix', items: ['whey', 'egg_whites'] },
  { id: 'C', name: 'Carbs', source: 'Substitution matrix (+ brown rice/quinoa from the PDF, sooji as wheat)',
    note: 'Bread: 40g (matrix: "1 slice").',
    items: ['rice', 'oats', 'poha', 'dalia', 'potato', 'bread', 'atta', 'batter', 'brown_rice', 'quinoa', 'sooji'] },
  { id: 'E', name: 'Egg / paneer / cheese', source: 'Substitution matrix', items: ['egg', 'paneer', 'cheese'] },
  { id: 'L', name: 'Dal / legumes', source: 'PDF (40g raw)', items: Object.keys(LEGUMES) },
  { id: 'V', name: 'Vegetables', source: 'PDF + guidelines', items: Object.keys(VEGETABLES) },
  { id: 'O', name: 'Fat', source: 'PDF', items: ['oil', 'ghee', 'butter', 'olive_oil'] },
  { id: 'Y', name: 'High-protein yogurt', fixed: true, source: 'PDF', items: ['skyr', 'greek_yogurt'] },
  { id: 'F', name: 'Fruit', fixed: true, source: 'PDF + guidelines', items: ['banana', 'chikoo'].concat(Object.keys(FRUITS)) },
  { id: 'N', name: 'Nuts', fixed: true, source: 'PDF', items: ['mixed_nuts'] },
  { id: 'D', name: 'Dates', fixed: true, source: 'PDF', items: ['dates'] },
  { id: 'T', name: 'Intra-workout drink', fixed: true, source: 'replaces the PDF\'s 20g Tang', items: ['electrolyte'] },
];
var GROUPS = {};
SUB_GROUPS.forEach(function (g) {
  GROUPS[g.id] = g;
  g.items.forEach(function (id) { FOODS[id].cat = g.id; });
});

var GUIDELINES = {
  diet: 'Vegetarian + eggs.',
  bannedVeg: ['avocado', 'coconut', 'peas', 'corn', 'beetroot', 'potato'],
  rules: [
    'Vegetables: avoid avocado, coconut, peas, corn, beetroot, potatoes (they count like rice/carbs, not veg).',
    'Fruits: all allowed; banana and chikoo only at half quantity (50g = 1 fruit unit).',
    'Aromatics (onion, tomato, garlic, ginger, chilli, herbs, lemon, spices) in small amounts are treated as free.',
  ],
};
