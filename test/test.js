// Run: node test/test.js — checks the Today pickers and their defaults, fixed items per day type, fruit rotation,
// editing picks, the veg count and day-type switching (which resets picks to that type's defaults).
const fs = require('fs'), path = require('path'), vm = require('vm');
['data/substitutions.js', 'data/plan.js', 'engine.js']
  .forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));

let fails = 0;
const fail = msg => { fails++; console.log('FAIL', msg); };
const iso = d => new Date(Date.UTC(2026, 9, 1) + d * 864e5).toISOString().slice(0, 10);
let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const ctx = (history, date) => ({ plan: PLAN, history, date, rng });
const TYPES = ['rest', 'gym', 'cardio'], near = (a, b) => Math.abs(a - b) < 1e-9;
const same = (a, b) => Object.keys({ ...a, ...b }).every(k => near(a[k] || 0, b[k] || 0));

const nonVeg = /chicken|fish|prawn|shrimp|mutton|lamb|beef|pork|meat|tuna|salmon|keema/i; // verification only
const badVeg = /avocado|coconut|\bpeas?\b|corn|beetroot|potato/i;
SUB_GROUPS.forEach(g => g.items.forEach(id => {
  if (!g.fixed && /nut/i.test(FOODS[id].name)) fail(`nuts in swap group ${g.id}`);
  if (nonVeg.test(FOODS[id].name + ' ' + g.name + ' ' + (g.note || '') + ' ' + g.source)) fail(`non-veg in group ${g.id}`);
}));
if (GROUPS.E.items.includes('cheese') || FOODS.cheese) fail('cheese is still a swap');
if (!GROUPS.P.items.includes('skyr')) fail('skyr is not a protein swap');

// Pickers: allowed foods only, practical amounts (whole eggs, whole whites, half scoops), each row's default exists.
const onStep = (x, st) => Math.abs(x / st - Math.round(x / st)) < 1e-6;
Object.entries(PLAN.pickers).forEach(([s, rows]) => rows.forEach(r => {
  if (r.def && !r.sets[r.def]) fail(`${s}.${r.id}: default ${r.def} missing`);
  Object.entries(r.sets).forEach(([opt, items]) => Object.entries(items).forEach(([id, u]) => {
    const f = FOODS[id];
    if (!f) return fail(`${s}.${r.id}.${opt}: unknown food ${id}`);
    if (nonVeg.test(f.name) || (f.cat === 'V' && badVeg.test(f.name)) || (GROUPS[f.cat].fixed && !(r.id === 'nuts' && f.cat === 'N'))) fail(`${s}.${r.id}.${opt}: ${id} not allowed`);
    TYPES.forEach(t => {
      const x = MealEngine.optionItems(r, opt, t)[id];
      if ((id === 'egg' && !onStep(x, 1)) || (id === 'egg_whites' && !onStep(x * 4, 1)) || (id === 'whey' && !onStep(x, 0.5))) fail(`${s}.${r.id}.${opt} ${t}: ${id} ${x}`);
    });
  }));
}));
const P1 = PLAN.pickers.lunch.find(r => r.id === 'protein').sets, P2 = PLAN.pickers.breakfast.find(r => r.id === 'protein2').sets;
const asList = sets => JSON.stringify(Object.values(sets).map(x => JSON.stringify(x)).sort());
if (asList(P1) !== asList({ b: { egg_whites: 1 }, c: { skyr: 1 }, d: { egg_whites: 0.5 }, e: { skyr: 0.5 } })) fail(`protein 1 options ${asList(P1)}`);
if (asList(P2) !== asList({ b: { egg: 2 }, d: { paneer: 2 } })) fail(`protein 2 options ${asList(P2)}`);
['breakfast', 'lunch', 'dinner'].forEach(s => {
  const ids = PLAN.pickers[s].map(r => r.id);
  // Veg at lunch and dinner, dal at dinner only.
  const want = ['protein', 'carb', 'nuts'].concat(s === 'dinner' ? ['dal'] : ['protein2'], s === 'breakfast' ? [] : ['veg']);
  if (JSON.stringify(ids.slice().sort()) !== JSON.stringify(want.sort())) fail(`${s}: pickers ${ids}`);
});

// No eggs at dinner: Protein 1 is fixed at 75g skyr, Protein 2 paneer only; a saved dinner egg pick falls back to the default.
const dinnerOpts = id => JSON.stringify(Object.keys(PLAN.pickers.dinner.find(r => r.id === id).sets));
if (dinnerOpts('protein') !== '["skyr50"]') fail(`dinner protein options ${dinnerOpts('protein')}`);
// Per-meal carbs: breakfast fixed at bread; lunch no rice, atta by default; dinner rice by default.
const BREAKFAST_CARBS = ['bread'], DINNER_CARBS = ['rice', 'dalia', 'potato', 'quinoa', 'sooji'], LUNCH_CARBS = ['dalia', 'potato', 'atta', 'batter', 'quinoa', 'sooji'];
if (dinnerOpts('carb') !== JSON.stringify(DINNER_CARBS)) fail(`dinner carbs ${dinnerOpts('carb')}`);
const carbOpts = s => JSON.stringify(Object.keys(PLAN.pickers[s].find(r => r.id === 'carb').sets));
if (carbOpts('lunch') !== JSON.stringify(LUNCH_CARBS) || carbOpts('breakfast') !== JSON.stringify(BREAKFAST_CARBS)) fail('breakfast / lunch carbs');

// Defaults reproduce the fixed structure (cardio: 2 units of rice at dinner).
const slotItems = (day, s) => {
  const t = {};
  day.dishes.filter(p => p.slot === s).forEach(p => Object.entries(p.items).forEach(([id, u]) => (t[id] = (t[id] || 0) + u)));
  return t;
};
const WANT = {
  breakfast: { egg_whites: 0.5, bread: 1.25, oil: 1 },
  lunch: { egg: 2, atta: 50 / 30, beans: 1, oil: 1 },
  dinner: { skyr: 0.5, rice: 1, lauki: 1, moong_dal: 1, oil: 1 },
};
// Nothing fixed in breakfast/lunch/dinner: protein comes only from the pickers.
// The plan's gym/cardio post-workout nuts are a Nuts pick (default at breakfast), not a fixed item.
// The shake is 1 scoop (the PDF's breakfast whey moved into it).
const FIXED = { rest: { post: [{ whey: 1 }] }, gym: { pre: [{ banana: 2, dates: 1 }], post: [{ whey: 1 }] },
  cardio: { pre: [{ banana: 2, dates: 1 }, { electrolyte: 1 }], post: [{ whey: 1 }] } };

function checkDay(day, type, base) {
  // Fixed items in their slots.
  PLAN.slots.forEach(({ id: s }) => {
    const got = day.fixed.filter(f => f.slot === s).map(f => f.items), want = (FIXED[type][s] || []);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${day.date} ${type} ${s}: fixed ${JSON.stringify(got)}`);
  });
  // Two different fruits, 125g at breakfast and 125g at dinner.
  const fr = day.fruits.map(f => Object.entries(f.items)[0]);
  if (JSON.stringify(day.fruits.map(f => f.slot)) !== '["breakfast","dinner"]' || new Set(fr.map(x => x[0])).size !== 2) fail(`${day.date}: fruits ${JSON.stringify(fr)}`);
  fr.forEach(([fid, fu]) => {
    if (!PLAN.fruitChoices.includes(fid)) fail(`${day.date}: fruit ${fid} not in PDF list`);
    if (Math.abs(fu * FOODS[fid].qty - 125) > 1e-6) fail(`${day.date} ${type}: fruit amount`);
  });
  if (base && Object.keys(base.picks).length === 0) Object.entries(WANT).forEach(([s, w]) => {
    const want = s === 'dinner' && type === 'cardio' ? { ...w, rice: 2 } : s === 'breakfast' && type !== 'rest' ? { ...w, mixed_nuts: 1 } : w;
    if (!same(slotItems(day, s), want)) fail(`${day.date} ${type} ${s}: defaults ${JSON.stringify(slotItems(day, s))}`);
  });
}

// Fresh days: defaults, fruit rotation (never the same fruit in a slot two days running).
const history = {}, report = { defaultMacros: {} };
let prevFruits = null;
for (let i = 0; i < 21; i++) {
  const date = iso(i), base = MealEngine.newDay(ctx(history, date)), before = JSON.stringify(base);
  const v = Object.fromEntries(TYPES.map(t => [t, MealEngine.view(base, t, ctx(history, date))]));
  TYPES.forEach(t => checkDay(v[t], t, base));
  if (JSON.stringify(MealEngine.view(base, 'rest', ctx(history, date))) !== JSON.stringify(v.rest) || JSON.stringify(base) !== before) fail(`${date}: switching is not lossless`);
  // Only the dinner carb (cardio) and the breakfast nuts (gym, cardio) differ from rest.
  TYPES.forEach(t => {
    const byId = Object.fromEntries(v[t].dishes.map(p => [p.dishId, p.items]));
    Object.keys({ ...byId, ...Object.fromEntries(v.rest.dishes.map(p => [p.dishId, 1])) }).forEach(id => {
      const r = v.rest.dishes.find(p => p.dishId === id);
      if (!same((r || {}).items || {}, byId[id] || {}) && id !== 'pick-dinner-carb' && id !== 'pick-breakfast-nuts') fail(`${date} ${t}: ${id} changed`);
    });
  });
  if (prevFruits) PLAN.fruitSlots.forEach(s => { if (prevFruits[s] === base.fruits[s]) fail(`${date}: same ${s} fruit two days running`); });
  prevFruits = base.fruits;
  history[date] = v[TYPES[i % 3]];
  if (!i) TYPES.forEach(t => {
    const m = MealEngine.dayMacros(v[t], FOODS);
    report.defaultMacros[t] = Object.fromEntries(Object.entries(m).map(([k, x]) => [k, Math.round(x)]));
  });
}
report.distinctFruits = new Set(Object.values(history).flatMap(d => d.fruits.map(f => f.dishId))).size;

// Picks: changing one row changes only that row; '' = none; unknown option = default; base is never mutated.
const b0 = MealEngine.newDay(ctx(history, iso(21))), o0 = ctx(history, iso(21)), m0 = MealEngine.dayMacros(MealEngine.view(b0, 'gym', o0), FOODS);
const b0s = JSON.stringify(b0);
// leafy_greens is retired: no picker offers it, a saved pick falls back to the default, old history still counts it.
if (Object.values(PLAN.pickers).some(rs => rs.some(r => Object.values(r.sets).some(x => x.leafy_greens)))) fail('leafy_greens still offered');
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'lunch', 'veg', 'leafy_greens'), 'gym', o0), 'lunch'), WANT.lunch)) fail('saved leafy_greens pick');
if (MealEngine.dayMacros({ dishes: [{ slot: 'lunch', row: 'veg', items: { leafy_greens: 1 } }] }, FOODS).kcal !== 32) fail('old leafy_greens history');
// No dinner Protein 2 row: an old saved dinner protein2 pick is ignored (the view and history still render).
if (MealEngine.view(MealEngine.setPick(b0, 'dinner', 'protein2', 'paneer50'), 'gym', o0).dishes.some(p => p.slot === 'dinner' && p.row === 'protein2')) fail('dinner protein2 pick shown');
if (MealEngine.dayMacros({ dishes: [{ slot: 'dinner', row: 'protein2', items: { paneer: 2 } }] }, FOODS).kcal <= 0) fail('old dinner protein2 history');
const carb = PLAN.pickers.lunch.find(r => r.id === 'carb');
const b1 = MealEngine.setPick(b0, 'lunch', 'carb', 'quinoa'), v1 = MealEngine.view(b1, 'gym', o0);
if (!same(slotItems(v1, 'lunch'), { ...WANT.lunch, atta: 0, quinoa: 50 / 30 })) fail('setPick carb');
const dm = MealEngine.macros(carb.sets.quinoa, FOODS), dr = MealEngine.macros(carb.sets.atta, FOODS), m1 = MealEngine.dayMacros(v1, FOODS);
['kcal', 'p', 'c', 'f'].forEach(k => { if (Math.abs(m1[k] - m0[k] - (dm[k] - dr[k])) > 1e-6) fail(`setPick macros ${k}`); });
const b2 = MealEngine.setPick(MealEngine.setPick(b1, 'lunch', 'protein2', 'eggs2'), 'lunch', 'protein2', ''), v2 = MealEngine.view(b2, 'gym', o0);
if (v2.dishes.some(p => p.slot === 'lunch' && p.row === 'protein2')) fail('none pick still shown');
if (!same(slotItems(v2, 'dinner'), WANT.dinner)) fail('none pick items');
// Row totals (units picked / planned): defaults match for every type; the plan is 2 veg, cardio adds a carb unit.
const rt = (b, t) => MealEngine.rowTotals(b, t, o0);
// Switching type discards manual picks: the view equals that type's defaults and every row total is on plan.
{
  const edited = MealEngine.setPick(MealEngine.setPick(b0, 'breakfast', 'nuts', ''), 'dinner', 'carb', 'potato'), sw = MealEngine.resetPicks(edited);
  TYPES.forEach(t => {
    if (JSON.stringify(MealEngine.view(sw, t, o0)) !== JSON.stringify(MealEngine.view({ ...b0, picks: {} }, t, o0))) fail(`switch to ${t}: picks not reset`);
    Object.entries(rt(sw, t)).forEach(([id, x]) => { if (Math.abs(x.sel - x.exp) > 1e-9) fail(`switch to ${t}: ${id} off plan`); });
  });
  if (JSON.stringify(sw.fruits) !== JSON.stringify(edited.fruits)) fail('switch changed fruits');
}
TYPES.forEach(t => Object.entries(rt(b0, t)).forEach(([k, x]) => { if (!near(x.sel, x.exp)) fail(`${t} ${k}: ${x.sel} / ${x.exp}`); }));
const EXP = { protein: 1, protein2: 2, carb: 1.25 + 50 / 30 + 1, veg: 2, nuts: 0 }; // dal: dinner only, always 1, so no total
Object.entries(EXP).forEach(([k, e]) => { if (!near(rt(b0, 'rest')[k].exp, e)) fail(`plan ${k} ${rt(b0, 'rest')[k].exp} != ${e}`); });
if (!near(rt(b0, 'cardio').carb.exp, EXP.carb + 1)) fail('cardio carb plan');
if (rt(b0, 'gym').nuts.exp !== 1 || rt(b0, 'cardio').nuts.exp !== 1 || rt(b0, 'gym').nuts.sel !== 1) fail('gym/cardio nuts plan');
// An explicit nuts pick holds on every day type: none at breakfast on gym = 0 / 1; nuts at lunch on rest = 1 / 0.
if (rt(MealEngine.setPick(b0, 'breakfast', 'nuts', ''), 'gym').nuts.sel !== 0 || rt(MealEngine.setPick(b0, 'lunch', 'nuts', 'almonds'), 'rest').nuts.sel !== 1) fail('nuts picks');
const NUTS = PLAN.pickers.breakfast.find(r => r.id === 'nuts').sets;
if (JSON.stringify(Object.keys(NUTS)) !== JSON.stringify(['mixed_nuts', 'almonds', 'peanuts', 'walnuts', 'cashews', 'pistachios']) ||
  Object.values(NUTS).some(x => Object.values(x)[0] !== 1 || FOODS[Object.keys(x)[0]].qty !== 10)) fail('nuts options: 10g each');
if (JSON.stringify(Object.keys(rt(b0, 'gym')).sort()) !== JSON.stringify(Object.keys(EXP).sort())) fail('row totals: fruit is fixed, no total');
// No lunch dal row: an old saved lunch dal pick is ignored; old history with one still counts.
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'lunch', 'dal', 'rajma'), 'gym', o0), 'lunch'), WANT.lunch)) fail('old lunch dal pick');
if (MealEngine.dayMacros({ dishes: [{ slot: 'lunch', row: 'dal', items: { rajma: 1 } }] }, FOODS).kcal <= 0) fail('old lunch dal history');
// Dinner dal and veg are always 1 unit, no none ('' falls back to the default); veg keeps every choice.
if (JSON.stringify(Object.keys(PLAN.pickers.dinner.find(r => r.id === 'veg').sets)) !== JSON.stringify(['mushroom', 'broccoli', 'cauliflower', 'carrot', 'onion', 'beans', 'lauki', 'karela', 'bhindi', 'methi', 'tori', 'capsicum', 'pumpkin']) || PLAN.pickers.lunch.find(r => r.id === 'veg').required) fail('dinner veg choices / lunch veg optional');
['dal', 'veg'].forEach(row => {
  if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'dinner', row, ''), 'gym', o0), 'dinner'), WANT.dinner)) fail(`${row} none`);
});
// Fat: no row, a fixed 10ml oil per meal; a saved fat pick (old drafts) is ignored.
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'lunch', 'fat', 'butter'), 'gym', o0), 'lunch'), WANT.lunch)) fail('saved fat pick');
// No veg row at breakfast: a saved breakfast veg pick is ignored.
const b3 = MealEngine.setPick(b0, 'breakfast', 'veg', 'methi'), v3 = MealEngine.view(b3, 'rest', o0);
if (rt(b3, 'gym').veg.sel !== 2 || !same(slotItems(v3, 'breakfast'), WANT.breakfast)) fail('breakfast veg');
if (rt(MealEngine.setPick(b0, 'lunch', 'veg', 'methi'), 'gym').veg.sel !== 2) fail('lunch veg swap');
if (rt(MealEngine.setPick(b0, 'lunch', 'veg', ''), 'gym').veg.sel !== 1) fail('veg none');
if (rt(MealEngine.setPick(b0, 'breakfast', 'protein2', 'paneer50'), 'gym').protein2.sel !== 4) fail('protein 2 in egg units');
if (rt(MealEngine.setPick(b0, 'lunch', 'protein', 'whites2'), 'gym').protein.sel !== 1.5) fail('2 whites = half a protein unit');
// Fixed rows: breakfast Protein 1 = 3 egg whites and carb = 50g bread, dinner Protein 1 = 75g skyr, lunch Protein 2 = 2 eggs; only option, no none.
[['breakfast', 'protein', 'whites2'], ['breakfast', 'carb', 'bread'], ['dinner', 'protein', 'skyr50'], ['lunch', 'protein2', 'eggs2']].forEach(([s, id, opt]) => {
  const r = PLAN.pickers[s].find(x => x.id === id), want = s === 'breakfast' ? { ...WANT.breakfast, mixed_nuts: 1 } : WANT[s];
  const none = id !== 'carb';
  if (r.required === none || !r.locked || JSON.stringify(Object.keys(r.sets)) !== JSON.stringify([opt]) || (!none && !same(slotItems(MealEngine.view(MealEngine.setPick(b0, s, id, ''), 'gym', o0), s), want))) fail(`${s} ${id} not fixed at ${opt}`);
});
// The fixed proteins (breakfast and dinner Protein 1, lunch Protein 2) can be none: no block, the day total just goes under plan.
[['breakfast', 'protein', 0.5, 1], ['dinner', 'protein', 0.5, 1], ['lunch', 'protein2', 0, 2]].forEach(([s, id, sel, exp]) => {
  const b = MealEngine.setPick(b0, s, id, ''), x = rt(b, 'gym')[id];
  if (x.sel !== sel || x.exp !== exp || Object.keys(MealEngine.view(b, 'gym', o0).dishes.find(p => p.dishId === `pick-${s}-${id}`) || {}).length) fail(`${s} ${id} none`);
});
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'lunch', 'carb', 'nope'), 'gym', o0), 'lunch'), WANT.lunch)) fail('unknown pick falls back to default');
if (JSON.stringify(b0) !== b0s) fail('setPick mutated the base');
// Saved picks no longer offered (dinner eggs and atta, lunch and breakfast rice) fall back to the default.
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'dinner', 'protein', 'whites4'), 'gym', o0), 'dinner'), WANT.dinner)) fail('saved dinner egg pick');
// Old keys (before the 100g Skyr unit) fall back to the defaults.
[['breakfast', 'whites3'], ['dinner', 'skyr75']].forEach(([s, k]) => { if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, s, 'protein', k), 'gym', o0), s), s === 'breakfast' ? { ...WANT.breakfast, mixed_nuts: 1 } : WANT.dinner)) fail(`old pick ${k}`); });
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'dinner', 'carb', 'atta'), 'cardio', o0), 'dinner'), { ...WANT.dinner, rice: 2 })) fail('saved dinner atta pick');
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'lunch', 'carb', 'rice'), 'gym', o0), 'lunch'), WANT.lunch)) fail('saved lunch rice pick');
if (!same(slotItems(MealEngine.view(MealEngine.setPick(b0, 'breakfast', 'carb', 'rice'), 'rest', o0), 'breakfast'), WANT.breakfast)) fail('saved breakfast rice pick');
// Protein 1 and 2 must not share a meal: defaults comply, a manual clash is reported for that meal only.
TYPES.forEach(t => { if (Object.keys(MealEngine.clashes(b0, t, o0)).length) fail(`defaults clash on ${t}`); });
if (JSON.stringify(MealEngine.clashes(MealEngine.setPick(b0, 'lunch', 'protein', 'whites2'), 'gym', o0)) !== '{"lunch":["protein2","protein"]}') fail('clash not flagged');

// Shuffled days: every row total on plan for the day type, dal only at dinner, two different fruits; picks vary and
// avoid the previous day's where possible.
const spread = {}, ARR = { 'egg_whites:0.5|egg:2|skyr:0.5': 'usual', 'paneer:2|egg_whites:0.5|skyr:0.5': 'swap' }, arrSeen = {};
TYPES.forEach(t => {
  arrSeen[t] = new Set();
  const kc = [], seen = new Set();
  for (let i = 0; i < 20; i++) {
    const prev = MealEngine.view(b0, t, o0), b = MealEngine.shuffleDay(t, { ...o0, prev }), v = MealEngine.view(b, t, o0);
    Object.entries(rt(b, t)).forEach(([k, x]) => { if (!near(x.sel, x.exp)) fail(`shuffle ${t} ${k}: ${x.sel} / ${x.exp}`); });
    if (v.dishes.some(p => p.row === 'dal' && p.slot !== 'dinner') || !v.dishes.some(p => p.dishId === 'pick-dinner-dal')) fail(`shuffle ${t}: dal`);
    if (!v.dishes.some(p => p.dishId === 'pick-dinner-veg') || !v.dishes.some(p => p.dishId === 'pick-lunch-veg')) fail(`shuffle ${t}: veg not at lunch and dinner`);
    if (v.dishes.some(p => p.slot === 'dinner' && (p.items.egg || p.items.egg_whites))) fail(`shuffle ${t}: eggs at dinner`);
    if (!BREAKFAST_CARBS.includes(Object.keys(v.dishes.find(p => p.dishId === 'pick-breakfast-carb').items)[0])) fail(`shuffle ${t}: breakfast carb`);
    if (!LUNCH_CARBS.includes(Object.keys(v.dishes.find(p => p.dishId === 'pick-lunch-carb').items)[0])) fail(`shuffle ${t}: lunch carb`);
    // Proteins: the usual arrangement or the swap (breakfast paneer, lunch egg whites); dinner always 50g Skyr.
    const pr = sl => ['egg_whites', 'egg', 'paneer', 'skyr'].filter(k => slotItems(v, sl)[k]).map(k => k + ':' + slotItems(v, sl)[k]).join(),
      arr = [pr('breakfast'), pr('lunch'), pr('dinner')].join('|');
    if (!ARR[arr]) fail(`shuffle ${t}: proteins ${arr}`); else arrSeen[t].add(ARR[arr]);
    if (!DINNER_CARBS.includes(Object.keys(v.dishes.find(p => p.dishId === 'pick-dinner-carb').items)[0])) fail(`shuffle ${t}: dinner carb`);
    if (b.fruits.breakfast === b.fruits.dinner) fail(`shuffle ${t}: same fruit twice`);
    if (v.dishes.some(p => ['carb', 'dal'].includes(p.row) && p.dishId !== 'pick-breakfast-carb' && JSON.stringify(p.items) === JSON.stringify((prev.dishes.find(q => q.dishId === p.dishId) || {}).items))) fail(`shuffle ${t}: repeats ${JSON.stringify(b.picks)}`);
    checkDay(v, t);
    if (Object.keys(MealEngine.clashes(b, t, o0)).length) fail(`shuffle ${t}: protein 1 and 2 in one meal ${JSON.stringify(b.picks)}`);
    seen.add(JSON.stringify(b.picks));
    kc.push(Math.round(MealEngine.dayMacros(v, FOODS).kcal));
  }
  if (seen.size < 15) fail(`shuffle ${t}: only ${seen.size} distinct days`);
  if (arrSeen[t].size !== 2) fail(`shuffle ${t}: arrangements ${[...arrSeen[t]]}`);
  // Seeded runs: both arrangements, about 50/50, each on plan with no clash.
  let seed = 7, swaps = 0;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) {
    const b = MealEngine.shuffleDay(t, { ...o0, rng });
    if (b.picks.breakfast && b.picks.breakfast.protein2 === 'paneer50') swaps++;
    if (Object.values(rt(b, t)).some(x => !near(x.sel, x.exp)) || Object.keys(MealEngine.clashes(b, t, o0)).length) fail(`seeded shuffle ${t}: off plan or clash`);
  }
  if (swaps < 70 || swaps > 130) fail(`shuffle ${t}: ${swaps}/200 swaps`);
  spread[t] = [Math.min(...kc), Math.max(...kc)];
});
report.shuffleKcal = spread;

// Setting one slot's fruit leaves the other slot and the picks alone; it's still 125g.
PLAN.fruitSlots.forEach(s => {
  const id = PLAN.fruitChoices.find(f => !Object.values(b0.fruits).includes(f)), fs1 = MealEngine.setFruit(b0, s, id);
  const fv = MealEngine.view(fs1, 'gym', o0).fruits.find(f => f.slot === s);
  if (fs1.fruits[s] !== id || PLAN.fruitSlots.some(x => x !== s && fs1.fruits[x] !== b0.fruits[x]) || JSON.stringify(fs1.picks) !== JSON.stringify(b0.picks) ||
    Math.abs(fv.items[id] * FOODS[id].qty - 125) > 1e-6) fail(`setFruit ${s}`);
});

console.log(JSON.stringify(report, null, 1));
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
