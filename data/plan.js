// Nutritionist's plan (LevelUp with Lalitha, "Shikhar Paliwal_25th Aug 2026", Kahunas export).
// pdfMeals: the PDF's meals, kept for reference: `original` = rows as printed, updated for two later plan changes (breakfast whey removed, dinner Skyr 150g → 100g): [item, quantity, kcal, protein, carbs, fat].
// slots: the day's fixed meal structure. fixed: items eaten every day of that type exactly as listed, each in its slot.
// pickers: what you choose per slot (breakfast, lunch, dinner) on the Today page.

var PLAN = (function () {
  var S = {
    breakfast: {
      id: 'breakfast', label: 'Breakfast',
      original: [['Egg', '2 medium', 123, 11, 0, 8.8], ['Oil/butter/ghee', '10ml', 90, 0, 0, 10],
        ['Bread', '50g', 126, 6.2, 18, 1.8]],
      total: [339, 17.2, 18, 20.6],
    },
    lunch: {
      id: 'lunch', label: 'Lunch',
      original: [['Oil/butter/ghee', '10ml', 90, 0, 0, 10], ['Daal/Rajma/Channa/Chole (raw quantity)', '40g', 156, 12, 26, 0.4],
        ['Vegetables', '100g', 32, 0, 8, 0], ['White rice or brown rice/quinoa (raw)', '50g', 175, 4, 40, 0.5]],
      total: [453, 16, 74, 10.9],
    },
    pre: {
      id: 'pre', label: 'Pre-workout',
      original: [['Banana', '100g', 89, 1.1, 20, 0.3], ['Dates', '2 dates', 47, 0.4, 11, 0.1]],
      total: [136, 1.5, 31, 0.4],
    },
    intra: {
      id: 'intra', label: 'Intra-workout',
      original: [['Fast&Up Reload electrolyte (replaces Tang drink mix orange 20g)', '1 tablet', 5, 0, 1, 0]],
      total: [5, 0, 1, 0],
    },
    dinner: {
      id: 'dinner', label: 'Dinner',
      original: [['Oil/butter/ghee', '10ml', 90, 0, 0, 10], ['Vegetables', '100g', 32, 0, 8, 0],
        ['Chapati or Roti', '1 qty', 109, 3, 23, 0.5], ['Skyr high protein plain yogurt by Milky Mist', '100g', 96, 11.33, 9.33, 1.53]],
      total: [327, 14.33, 40.33, 12.03],
    },
  };
  var FRUIT = 'apple/orange/melons/berries/papaya/kiwi/pineapple/peaches/mango/guava/grapes';
  function post(fruitG, total) {
    return {
      id: 'post', label: 'Post-workout',
      original: [['The Whole Truth Foods Whey Protein', '30g', 113, 26, 0.9, 0.6],
        [FRUIT, fruitG + 'g', fruitG * 0.64, 0, fruitG * 0.16, 0], ['Mixed nuts', '10g', 59, 1.7, 1.6, 5.1]],
      total: total,
    };
  }
  function copy(slot, patch) { return Object.assign({}, slot, patch); }
  var PRE = { id: 'pre', slot: 'pre', name: 'Pre-workout', items: { banana: 2, dates: 1 }, method: '30–45 min before training.' };
  var INTRA = { id: 'intra', slot: 'pre', name: 'Intra', items: { electrolyte: 1 }, method: '1 tablet in 250–500ml water, sip during the session.' };
  var SHAKE = { id: 'shake', slot: 'post', name: 'Shake', items: { whey: 1 }, method: '1 scoop whey in water.' };
  // Today's pickers for breakfast, lunch and dinner: each row picks one option or none ('').
  // Options are { food: units }; `required` rows have no none; `cardio` multiplies the row's amount on cardio days (the PDF's second roti, now a second unit of the dinner carb).
  var unitSets = function (cat, units, only) {
    var o = {};
    (only || GROUPS[cat].items).forEach(function (id) { o[id] = {}; o[id][id] = units; });
    return o;
  };
  // Protein 1: protein units (1 unit = 4 whites or 100g skyr; 2 whites / 50g skyr are half a unit). Protein 2: 2 whole eggs or 50g paneer.
  var PROTEIN = { whites4: { egg_whites: 1 }, skyr: { skyr: 1 }, whites2: { egg_whites: 0.5 }, skyr50: { skyr: 0.5 } };
  var PROTEIN2 = { eggs2: { egg: 2 }, paneer50: { paneer: 2 } };
  // `noEggs`: leaves out the options with egg or egg whites (dinner).
  var eggFree = function (sets) {
    var o = {};
    Object.keys(sets).forEach(function (k) { if (!sets[k].egg && !sets[k].egg_whites) o[k] = sets[k]; });
    return o;
  };
  function rows(d) {
    var pick = function (sets) { return d.noEggs ? eggFree(sets) : sets; };
    var r = [
      { id: 'protein', label: 'Protein 1', sets: pick(PROTEIN), def: d.protein || '' },
      // `apart`: never in the same meal as that row (Today flags it; the fixed defaults keep the shuffle clear of it).
      { id: 'protein2', label: 'Protein 2', sets: pick(PROTEIN2), def: d.protein2 || '', apart: 'protein' },
      { id: 'carb', label: 'Carb', sets: unitSets('C', d.carbUnits, d.carbs), def: d.carb, cardio: d.cardio },
    ];
    // Veg: only where `veg` is given (not breakfast); `vegRequired` = no none (dinner).
    if ('veg' in d) r.push({ id: 'veg', label: 'Veg', sets: unitSets('V', 1), def: d.veg, required: !!d.vegRequired });
    // Dal: dinner only, always 1 unit (no none).
    if (d.dal) r.push({ id: 'dal', label: 'Dal', sets: unitSets('L', 1), def: d.dal, required: true });
    // Nuts: the PDF's gym/cardio post-workout 10g, wherever you like; `defByType` = that day type's default.
    r.push({ id: 'nuts', label: 'Nuts', sets: unitSets('N', 1), def: '', defByType: d.nuts ? { gym: 'mixed_nuts', cardio: 'mixed_nuts' } : null });
    // `fixed`: rows locked to their default (its only option), so the shuffle never moves them (proteins: see proteinSwap); a fixed carb has no none, fixed proteins keep it.
    // `noProtein2`: no Protein 2 row (dinner: its Skyr is Protein 1).
    if (d.noProtein2) r = r.filter(function (x) { return x.id !== 'protein2'; });
    return r.map(function (x) {
      if ((d.fixed || []).indexOf(x.id) < 0) return x;
      var sets = {};
      sets[x.def] = x.sets[x.def];
      return Object.assign({}, x, { sets: sets, locked: true, required: x.id === 'carb' });
    });
  }

  var plan = {
    // Every day type shows these slots in this order; the PDF's intra-workout drink goes in pre-workout, its rest-day snack in post.
    slots: [{ id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' },
      { id: 'pre', label: 'Pre-workout' }, { id: 'post', label: 'Post-workout / Snack' }, { id: 'dinner', label: 'Dinner' }],
    // Fruit: a fixed 250g every day (2.5 units), split equally across these slots, one different rotating fruit each.
    fruitUnits: 2.5,
    fruitSlots: ['breakfast', 'dinner'],
    // Cooking fat: always 10ml per picker meal, counted in the totals but not shown as a row.
    mealFat: { oil: 1 },
    // Defaults: the PDF meals with my changes (2 eggs moved to lunch; the dal
    // moved to dinner, where it's always 1 unit; the gym/cardio post-workout nuts at breakfast; lunch atta for the rice; dinner rice for the roti).
    // The protein arrangement: the defaults (usual) or this swap; New day picks one at random. Same day totals, no clash.
    proteinSwap: { breakfast: { protein: '', protein2: 'paneer50' }, lunch: { protein: 'whites2', protein2: '' } },
    pickers: {
      breakfast: rows({ protein: 'whites2', fixed: ['protein', 'carb'], carb: 'bread', carbUnits: 1.25, nuts: true }),
      lunch: rows({ protein2: 'eggs2', fixed: ['protein2'], carb: 'atta', carbs: ['dalia', 'potato', 'atta', 'batter', 'quinoa', 'sooji'], carbUnits: 50 / 30, veg: 'beans' }),
      dinner: rows({ noEggs: true, noProtein2: true, protein: 'skyr50', fixed: ['protein'], carb: 'rice', carbs: ['rice', 'dalia', 'potato', 'quinoa', 'sooji'], carbUnits: 1, cardio: 2, veg: 'lauki', vegRequired: true, dal: 'moong_dal' }),
    },
    fruitChoices: ['apple', 'orange', 'watermelon', 'muskmelon', 'berries', 'papaya', 'kiwi', 'pineapple', 'peach', 'mango', 'guava', 'grapes'],
    source: 'LevelUp with Lalitha — "Shikhar Paliwal_25th Aug 2026" (Kahunas export)',
    notes: [
      'No meal timings in the PDF.',
      'Fruit is a fixed 250g every day (125g at breakfast, 125g at dinner), so cardio days get 50g more than the printed 200g.',
      'Default picks change the plan: the 2 whole eggs move from breakfast to lunch, the dal (40g raw) from lunch to dinner, and the gym/cardio post-workout nuts to breakfast; the lunch rice becomes 50g whole-wheat atta (≈1.7 rotis), and at dinner (no eggs) the roti becomes 30g white rice (60g on cardio) and the Skyr 50g (half the 100g in the plan). Protein is fixed: 2 egg whites at breakfast, 2 whole eggs at lunch, 50g Skyr at dinner.',
      'Cardio intra-workout: 20g Tang (73 kcal) replaced by a Fast&Up electrolyte (~5 kcal); with the extra 50g fruit, cardio days land ~51 kcal under the target (rest and gym ~11 under).',
    ],
    dayTypes: {
      rest: {
        target: { kcal: 1392, p: 73.53, c: 173.23, f: 44.13 },
        fixed: [SHAKE],
        pdfMeals: [S.breakfast, S.lunch, {
          id: 'snack', label: 'Snack',
          original: [['The Whole Truth Foods Whey Protein', '30g', 113, 26, 0.9, 0.6], [FRUIT, '250g', 160, 0, 40, 0]],
          total: [273, 26, 40.9, 0.6],
        }, S.dinner],
      },
      cardio: {
        target: { kcal: 1737, p: 79.73, c: 236.83, f: 50.13 },
        fixed: [PRE, INTRA, SHAKE],
        pdfMeals: [S.breakfast, S.lunch, S.pre, S.intra, post(200, [300, 27.7, 34.5, 5.7]),
          copy(S.dinner, {
            original: S.dinner.original.map(function (r) { return r[0] === 'Chapati or Roti' ? [r[0], '2 qty', 218, 6, 46, 1] : r; }),
            total: [436, 17.33, 63.33, 12.53],
          })],
      },
      gym: {
        target: { kcal: 1587, p: 76.73, c: 205.83, f: 49.63 },
        fixed: [PRE, SHAKE],
        pdfMeals: [S.breakfast, S.lunch, S.pre, post(250, [332, 27.7, 42.5, 5.7]), S.dinner],
      },
    },
  };

  return plan;
})();
