// Nutritionist's plan (LevelUp with Lalitha, "Shikhar Paliwal_25th Aug 2026", Kahunas export).
// pdfMeals: the PDF's meals, kept for reference and to derive the daily pool.
//   `units` = the meal in exchange units (see substitutions.js); `defaults` = the PDF's own food per unit;
//   `original` = rows exactly as printed: [item, quantity, kcal, protein, carbs, fat].
// fixed: items eaten every day of that type exactly as listed (never rotated).
// pool (derived below): all PDF meal units minus the fixed items; the generator splits it across the day's dishes.

var PLAN = (function () {
  var S = {
    breakfast: {
      id: 'breakfast', label: 'Breakfast',
      units: { E: 2, O: 1, C: 1.25, P: 1 }, defaults: { E: 'egg', O: 'ghee', C: 'bread', P: 'whey' },
      original: [['Egg', '2 medium', 123, 11, 0, 8.8], ['Oil/butter/ghee', '10ml', 90, 0, 0, 10],
        ['Bread', '50g', 126, 6.2, 18, 1.8], ['The Whole Truth Foods Whey Protein', '30g', 113, 26, 0.9, 0.6]],
      total: [452, 43.2, 18.9, 21.2],
    },
    lunch: {
      id: 'lunch', label: 'Lunch',
      units: { O: 1, L: 1, V: 1, C: 50 / 30 }, defaults: { O: 'oil', L: 'toor_dal', V: 'mixed_veg', C: 'rice' },
      original: [['Oil/butter/ghee', '10ml', 90, 0, 0, 10], ['Daal/Rajma/Channa/Chole (raw quantity)', '40g', 156, 12, 26, 0.4],
        ['Vegetables', '100g', 32, 0, 8, 0], ['White rice or brown rice/quinoa (raw)', '50g', 175, 4, 40, 0.5]],
      total: [453, 16, 74, 10.9],
    },
    pre: {
      id: 'pre', label: 'Pre-workout',
      units: { F: 2, D: 1 }, defaults: { F: 'banana', D: 'dates' },
      original: [['Banana', '100g', 89, 1.1, 20, 0.3], ['Dates', '2 dates', 47, 0.4, 11, 0.1]],
      total: [136, 1.5, 31, 0.4],
    },
    intra: {
      id: 'intra', label: 'Intra-workout',
      units: { T: 1 }, defaults: { T: 'electrolyte' },
      original: [['Fast&Up Reload electrolyte (replaces Tang drink mix orange 20g)', '1 tablet', 5, 0, 1, 0]],
      total: [5, 0, 1, 0],
    },
    dinner: {
      id: 'dinner', label: 'Dinner',
      units: { O: 1, V: 1, C: 1, Y: 1 }, defaults: { O: 'oil', V: 'mixed_veg', C: 'atta', Y: 'skyr' },
      original: [['Oil/butter/ghee', '10ml', 90, 0, 0, 10], ['Vegetables', '100g', 32, 0, 8, 0],
        ['Chapati or Roti', '1 qty', 109, 3, 23, 0.5], ['Skyr high protein plain yogurt by Milky Mist', '150g', 144, 17, 14, 2.3]],
      total: [375, 20, 45, 12.8],
    },
  };
  var FRUIT = 'apple/orange/melons/berries/papaya/kiwi/pineapple/peaches/mango/guava/grapes';
  function post(fruitG, total) {
    return {
      id: 'post', label: 'Post-workout',
      units: { P: 1, F: fruitG / 100, N: 1 }, defaults: { P: 'whey', F: 'mixed_fruit', N: 'mixed_nuts' },
      original: [['The Whole Truth Foods Whey Protein', '30g', 113, 26, 0.9, 0.6],
        [FRUIT, fruitG + 'g', fruitG * 0.64, 0, fruitG * 0.16, 0], ['Mixed nuts', '10g', 59, 1.7, 1.6, 5.1]],
      total: total,
    };
  }
  function copy(slot, patch) { return Object.assign({}, slot, patch); }
  var PRE = { id: 'pre', name: 'Pre-workout: banana + dates', items: { banana: 2, dates: 1 }, method: '30–45 min before training.' };
  var INTRA = { id: 'intra', name: 'Intra-workout: Fast&Up electrolyte', items: { electrolyte: 1 }, method: '1 tablet in 250–500ml water, sip during the session.' };
  var NUTS = { id: 'nuts', name: '10g mixed nuts (any)', items: { mixed_nuts: 1 }, method: 'Any nuts, your choice — e.g. with the post-workout shake.' };
  var SKYR = { id: 'skyr', name: 'Skyr', items: { skyr: 1 }, method: '150g Skyr or plain high-protein Greek yogurt, any time of day.' };
  var SHAKE = { id: 'shake', name: 'Protein shake', items: { whey: 1 }, method: '1 scoop whey in water — any time of day.' };

  var plan = {
    // Dishes are generated once per day on this type's pool; other day types adjust only the chosen cardio-carb dish.
    baseType: 'gym',
    // The daily fruit item rotates through these (the PDF's list); quantity = that day type's fruit units.
    fruitChoices: ['apple', 'orange', 'watermelon', 'muskmelon', 'berries', 'papaya', 'kiwi', 'pineapple', 'peach', 'mango', 'guava', 'grapes'],
    source: 'LevelUp with Lalitha — "Shikhar Paliwal_25th Aug 2026" (Kahunas export)',
    notes: [
      'No meal timings in the PDF.',
      'Cardio intra-workout: 20g Tang (73 kcal) replaced by a Fast&Up electrolyte (~5 kcal), so cardio days land ~68 kcal under the printed target.',
    ],
    dayTypes: {
      rest: {
        target: { kcal: 1553, p: 105.2, c: 178.8, f: 45.5 },
        fixed: [SHAKE, SKYR],
        pdfMeals: [S.breakfast, S.lunch, {
          id: 'snack', label: 'Snack',
          units: { P: 1, F: 2.5 }, defaults: { P: 'whey', F: 'mixed_fruit' },
          original: [['The Whole Truth Foods Whey Protein', '30g', 113, 26, 0.9, 0.6], [FRUIT, '250g', 160, 0, 40, 0]],
          total: [273, 26, 40.9, 0.6],
        }, S.dinner],
      },
      cardio: {
        target: { kcal: 1898, p: 111.4, c: 242.4, f: 51.5 },
        fixed: [PRE, INTRA, SHAKE, SKYR, NUTS],
        pdfMeals: [S.breakfast, S.lunch, S.pre, S.intra, post(200, [300, 27.7, 34.5, 5.7]),
          copy(S.dinner, {
            units: { O: 1, V: 1, C: 2, Y: 1 },
            original: S.dinner.original.map(function (r) { return r[0] === 'Chapati or Roti' ? [r[0], '2 qty', 218, 6, 46, 1] : r; }),
            total: [484, 23, 68, 13.3],
          })],
      },
      gym: {
        target: { kcal: 1748, p: 108.4, c: 211.4, f: 51 },
        fixed: [PRE, SHAKE, SKYR, NUTS],
        pdfMeals: [S.breakfast, S.lunch, S.pre, post(250, [332, 27.7, 42.5, 5.7]), S.dinner],
      },
    },
  };

  // Derive per day type: pool units, the PDF foods behind them (poolFoods), and prescribed macros (sum of PDF meal totals).
  Object.keys(plan.dayTypes).forEach(function (k) {
    var d = plan.dayTypes[k], pool = {}, foods = {}, m = [0, 0, 0, 0];
    d.pdfMeals.forEach(function (meal) {
      Object.keys(meal.units).forEach(function (c) {
        pool[c] = (pool[c] || 0) + meal.units[c];
        foods[meal.defaults[c]] = (foods[meal.defaults[c]] || 0) + meal.units[c];
      });
      meal.total.forEach(function (v, i) { m[i] += v; });
    });
    d.fixed.forEach(function (f) {
      Object.keys(f.items).forEach(function (id) {
        pool[FOODS[id].cat] -= f.items[id];
        foods[id] -= f.items[id];
      });
    });
    Object.keys(pool).forEach(function (c) { if (pool[c] < 1e-9) delete pool[c]; });
    Object.keys(foods).forEach(function (id) { if (foods[id] < 1e-9) delete foods[id]; });
    // Fruit is eaten separately (one rotating fruit), so it leaves the meal pool.
    d.fruitUnits = pool.F || 0;
    delete pool.F;
    Object.keys(foods).forEach(function (id) { if (FOODS[id].cat === 'F') delete foods[id]; });
    d.pool = pool;
    d.poolFoods = foods;
    d.prescribed = { kcal: m[0], p: m[1], c: m[2], f: m[3] };
  });
  return plan;
})();
