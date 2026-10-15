// Run: node test/test.js — simulates 21 days (each viewed as rest, gym and cardio) and checks fixed items,
// exact pool consumption, macros, cardio-carb switching, diet rules, duplicates, serving sizes and variety.
const fs = require('fs'), path = require('path'), vm = require('vm');
['data/substitutions.js', 'data/plan.js', 'data/dishes.js', 'engine.js']
  .forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));

let fails = 0;
const fail = msg => { fails++; console.log('FAIL', msg); };
const iso = d => new Date(Date.UTC(2026, 9, 1) + d * 864e5).toISOString().slice(0, 10);
let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const ctx = (history, date) => ({ plan: PLAN, foods: FOODS, dishes: DISHES, history, date, rng });

DISHES.forEach(d => MealEngine.validate(d, FOODS, GUIDELINES).forEach(e => fail(`dish ${d.id}: ${e}`)));
if (new Set(DISHES.map(d => d.id)).size !== DISHES.length) fail('duplicate dish ids');
if (new Set(DISHES.map(d => d.name.toLowerCase())).size !== DISHES.length) fail('duplicate dish names');
DISHES.forEach(d => { if (MealEngine.isCombo(d.name)) fail(`combo dish name: ${d.name}`); });
const byId = Object.fromEntries(DISHES.map(d => [d.id, d]));
const CUISINES = ['North Indian', 'South Indian', 'Continental', 'Basics'];
DISHES.forEach(d => { if (!CUISINES.includes(d.cuisine)) fail(`${d.id}: cuisine ${d.cuisine}`); });

const nonVeg = /chicken|fish|prawn|shrimp|mutton|lamb|beef|pork|meat|tuna|salmon|keema/i; // verification only
const badVeg = /avocado|coconut|\bpeas?\b|corn|beetroot|potato/i;
const unitsOf = day => {
  const u = {};
  day.dishes.forEach(p => Object.entries(p.items).forEach(([id, x]) => { u[FOODS[id].cat] = (u[FOODS[id].cat] || 0) + x; }));
  return u;
};

function checkDay(day, type) {
  const t = PLAN.dayTypes[type];
  const fx = JSON.stringify(day.fixed.map(f => f.items)), want = JSON.stringify(t.fixed.map(f => f.items));
  if (fx !== want) fail(`${day.date} ${type}: fixed items ${fx} != ${want}`);
  if (day.fixed.filter(f => f.items.skyr === 1).length !== 1) fail(`${day.date} ${type}: skyr not fixed`);
  if (day.fixed.filter(f => f.items.mixed_nuts).length !== (type === 'rest' ? 0 : 1)) fail(`${day.date} ${type}: nuts`);
  // Dishes consume the pool exactly (in units); no duplicates.
  const u = unitsOf(day);
  Object.keys({ ...u, ...t.pool }).forEach(c => {
    if (Math.abs((u[c] || 0) - (t.pool[c] || 0)) > 1e-6) fail(`${day.date} ${type}: ${c} ${u[c]} vs pool ${t.pool[c]}`);
  });
  const ids = day.dishes.map(p => p.dishId);
  if (new Set(ids).size !== ids.length) fail(`${day.date}: duplicate dish in ${ids}`);
  if (ids.length < 2 || ids.length > 8) fail(`${day.date}: ${ids.length} dishes`);
  // Macros vs the PDF's prescribed meals.
  const m = MealEngine.dayMacros(day, FOODS), pr = t.prescribed;
  ['kcal', 'p', 'c', 'f'].forEach(k => {
    const dev = (m[k] - pr[k]) / pr[k];
    if (Math.abs(dev) > (k === 'kcal' ? 0.05 : 0.1)) fail(`${day.date} ${type} ${k} ${m[k].toFixed(1)} vs ${pr[k]} (${(dev * 100).toFixed(1)}%)`);
  });
  // Diet rules: no nuts/fruit/skyr inside dishes, eggs unit only eggs/paneer/cheese, no banned or non-veg items.
  day.dishes.concat(day.fixed).forEach(p => {
    if (nonVeg.test([p.name, p.extras, p.method].join(' '))) fail(`non-veg text in ${p.name}`);
    Object.entries(p.items).forEach(([id]) => {
      const f = FOODS[id];
      if (nonVeg.test(f.name)) fail(`non-veg food ${f.name}`);
      if (f.cat === 'V' && badVeg.test(f.name)) fail(`banned veg ${f.name}`);
      if (!p.fixed && ['N', 'F', 'Y', 'D', 'T'].includes(f.cat)) fail(`${day.date}: ${f.name} inside dish ${p.name}`);
      if (f.cat === 'E' && !['egg', 'paneer', 'cheese'].includes(id)) fail(`${id} fills the egg unit`);
    });
  });
  // Practical amounts: whole eggs, whole egg whites, whey in half scoops (dishes and fixed items).
  const onStep = (x, st) => Math.abs(x / st - Math.round(x / st)) < 1e-6;
  day.dishes.concat(day.fixed).forEach(p => Object.entries(p.items).forEach(([id, x]) => {
    if (id === 'egg' && !onStep(x, 1)) fail(`${day.date} ${type}: ${x} eggs in ${p.name}`);
    if (id === 'egg_whites' && !onStep(x * 6, 1)) fail(`${day.date} ${type}: ${x * 6} egg whites in ${p.name}`);
    if (id === 'whey' && !onStep(x, 0.5)) fail(`${day.date} ${type}: ${x} scoops whey in ${p.name}`);
  }));
  const [fid, fu] = Object.entries(day.fruit.items)[0];
  if (!PLAN.fruitChoices.includes(fid)) fail(`${day.date}: fruit ${fid} not in PDF list`);
  if (Math.abs(fu * FOODS[fid].qty - (type === 'cardio' ? 200 : 250)) > 1e-6) fail(`${day.date} ${type}: fruit amount`);
  return m;
}
SUB_GROUPS.forEach(g => g.items.forEach(id => {
  if (!g.fixed && /nut/i.test(FOODS[id].name)) fail(`nuts in swap group ${g.id}`);
  if (nonVeg.test(FOODS[id].name + ' ' + g.name + ' ' + (g.note || '') + ' ' + g.source)) fail(`non-veg in group ${g.id}`);
}));

const report = {}, TYPES = ['rest', 'gym', 'cardio'];
const views = base => Object.fromEntries(TYPES.map(t => [t, MealEngine.view(base, t, ctx({}, base.date))]));

// Day-type switching: non-cardio views identical; on cardio only the chosen dish's carbs change, whichever dish
// is chosen, and totals stay the same; switching is lossless and never mutates the base.
function checkSwitching(base) {
  const before = JSON.stringify(base), v = views(base);
  if (JSON.stringify(v.rest.dishes) !== JSON.stringify(v.gym.dishes)) fail(`${base.date}: rest/gym dishes differ`);
  if (base.covered === false) fail(`${base.date}: pool not covered`);
  Object.values(base.factors).forEach(f => { if (f < 0.5 - 1e-9 || f > 2 + 1e-9) fail(`${base.date}: serving factor ${f.toFixed(2)}`); });
  const carbIdx = base.dishes.map((p, i) => Object.keys(p.items).some(id => FOODS[id].cat === 'C') ? i : -1).filter(i => i >= 0);
  if (!carbIdx.includes(MealEngine.cardioIdx(base, FOODS))) fail(`${base.date}: default cardio carb dish has no carbs`);
  carbIdx.forEach(ci => {
    const b = MealEngine.setCardioDish(base, base.dishes[ci].dishId);
    const rest = MealEngine.view(b, 'rest', ctx({}, base.date)), car = MealEngine.view(b, 'cardio', ctx({}, base.date));
    checkDay(car, 'cardio');
    if (JSON.stringify(rest.dishes.map(p => p.items)) !== JSON.stringify(v.rest.dishes.map(p => p.items))) fail('cardio choice changed a rest-day dish');
    car.dishes.forEach((p, i) => {
      if (p.cardio !== (i === ci)) fail('cardio flag');
      Object.entries(p.items).forEach(([id, x]) => {
        const changed = Math.abs(x - rest.dishes[i].items[id]) > 1e-9;
        if (changed && (i !== ci || FOODS[id].cat !== 'C')) fail(`cardio carb ${ci}: ${id} in dish ${i} changed`);
      });
    });
    const uc = unitsOf(car), uv = unitsOf(v.cardio);
    Object.keys(uv).forEach(c => { if (Math.abs(uc[c] - uv[c]) > 1e-9) fail(`cardio carb ${ci}: total ${c} differs`); });
  });
  const again = MealEngine.view(base, 'rest', ctx({}, base.date));
  if (JSON.stringify(again) !== JSON.stringify(v.rest) || JSON.stringify(base) !== before) fail(`${base.date}: switching is not lossless`);
  return v;
}

const stats = Object.fromEntries(TYPES.map(t => [t, { kcal: [], p: [], c: [], f: [] }]));
const last = {}, counts = [], fruits = [], history = {};
let minGap = 99, commonUses = 0;
for (let i = 0; i < 21; i++) {
  const date = iso(i), base = MealEngine.generateDay(ctx(history, date)), v = checkSwitching(base);
  TYPES.forEach(t => {
    const m = checkDay(v[t], t), tg = PLAN.dayTypes[t].target;
    Object.keys(stats[t]).forEach(k => stats[t][k].push(((m[k] - tg[k]) / tg[k]) * 100));
  });
  counts.push(base.dishes.length);
  if (fruits.length && fruits[fruits.length - 1] === base.fruit) fail(`${date}: same fruit two days running`);
  fruits.push(base.fruit);
  history[date] = v[TYPES[i % 3]]; // accept with a rotating final day type
  base.dishes.forEach(p => {
    if (byId[p.dishId] && byId[p.dishId].common) { commonUses++; return; }
    if (p.dishId in last) minGap = Math.min(minGap, i - last[p.dishId]);
    last[p.dishId] = i;
  });
}
if (minGap < 4) fail(`a non-common dish repeated after ${minGap} days`);
TYPES.forEach(t => (report[t] = {
  pool: Object.fromEntries(Object.entries(PLAN.dayTypes[t].pool).map(([k, v]) => [k, +v.toFixed(2)])),
  devVsPrintedTargetPct: Object.fromEntries(Object.entries(stats[t]).map(([k, v]) => [k, `${Math.min(...v).toFixed(1)}..${Math.max(...v).toFixed(1)}`])),
}));
const nonCommon = Object.values(history).flatMap(d => d.dishes.map(p => p.dishId)).filter(id => byId[id] && !byId[id].common);
const dist = {};
counts.forEach(n => (dist[n] = (dist[n] || 0) + 1));
if (Object.keys(dist).length < 3) fail(`dish count barely varies: ${JSON.stringify(dist)}`);
report.days21 = { dishCountDistribution: dist, minRepeatGapDaysNonCommon: minGap,
  nonCommonDishUses: nonCommon.length, distinctNonCommon: new Set(nonCommon).size, commonUses, libraryDishes: DISHES.length,
  distinctFruits: new Set(fruits).size };
if (JSON.stringify(PLAN.dayTypes.rest.pool) !== JSON.stringify(PLAN.dayTypes.gym.pool)) fail('rest pool != gym pool');

// Per-dish swap: the dish at idx changes; others are kept unless made redundant; extra dishes may be added
// to cover what the new dish doesn't. All invariants hold either way.
const b0 = MealEngine.generateDay(ctx(history, iso(21))), swapCounts = {};
for (let k = 0; k < 4; k++) b0.dishes.forEach((p0, idx) => {
  const sw = MealEngine.swapDish(b0, idx, ctx(history, iso(21)));
  const v = checkSwitching(sw);
  TYPES.forEach(t => checkDay(v[t], t));
  if (sw.dishes[idx].dishId === p0.dishId) fail(`swapDish ${idx}: same dish`);
  const keptIds = new Set(sw.dishes.map(p => p.dishId));
  const dropped = b0.dishes.filter((p, j) => j !== idx && !keptIds.has(p.dishId)).length;
  if (dropped > 1) fail(`swapDish ${idx}: dropped ${dropped} other dishes`);
  const d = sw.dishes.length - b0.dishes.length;
  swapCounts[d] = (swapCounts[d] || 0) + 1;
});
report.swapCountChange = swapCounts;
const forced = MealEngine.swapOptions(b0, 0, ctx(history, iso(21))).find(d => d.id !== b0.dishes[0].dishId);
if (forced && MealEngine.swapDish(b0, 0, Object.assign(ctx(history, iso(21)), { forceId: forced.id })).dishes[0].dishId !== forced.id) fail('forced swap');

// Manual add/remove: placed + unallocated − over == pool for every category; rounding rules hold; gaps and
// overflows appear exactly when the remaining dishes can't absorb them within 0.5–2x.
const pool0 = PLAN.dayTypes.rest.pool;
const onStep = (x, st) => Math.abs(x / st - Math.round(x / st)) < 1e-6;
function conserve(b, label) {
  const v = MealEngine.view(b, 'rest', ctx({}, b.date)), u = unitsOf(v), ua = b.unallocated || {}, ov = b.over || {};
  Object.keys({ ...pool0, ...u, ...ua, ...ov }).forEach(c => {
    const lhs = (u[c] || 0) + (ua[c] || 0) - (ov[c] || 0);
    if (Math.abs(lhs - (pool0[c] || 0)) > 1e-6 + (b.residual || 0)) fail(`${label}: ${c} placed ${(u[c] || 0).toFixed(3)} + ${ua[c] || 0} − ${ov[c] || 0} ≠ ${pool0[c]}`);
  });
  v.dishes.forEach(p => Object.entries(p.items).forEach(([id, x]) => {
    if ((id === 'egg' && !onStep(x, 1)) || (id === 'egg_whites' && !onStep(x * 6, 1)) || (id === 'whey' && !onStep(x, 0.5))) fail(`${label}: ${id} ${x}`);
  }));
  if (new Set(b.dishes.map(p => p.dishId)).size !== b.dishes.length) fail(`${label}: duplicate dish`);
  return v;
}
const stdTot = list => { const t = {}; list.forEach(d => Object.entries(MealEngine.cats(d.items, FOODS)).forEach(([k, x]) => (t[k] = (t[k] || 0) + x))); return t; };
const editStats = { removes: 0, removesWithGap: 0, adds: 0, addsDropped: 0, addsOver: 0 };
for (let day = 0; day < 6; day++) {
  const b = MealEngine.generateDay(ctx(history, iso(30 + day)));
  b.dishes.forEach((p, idx) => {
    const r = MealEngine.removeDish(b, idx, ctx(history, b.date));
    conserve(r, `remove ${p.name}`);
    editStats.removes++;
    if (Object.keys(r.unallocated).length) editStats.removesWithGap++;
    const t = stdTot(b.dishes.filter((_, j) => j !== idx).map(x => byId[x.dishId]));
    Object.keys(pool0).forEach(c => {
      const shouldGap = !t[c] || pool0[c] / t[c] > 2 + 1e-9;
      if (shouldGap !== !!r.unallocated[c]) fail(`remove ${p.name}: unallocated ${c} ${r.unallocated[c]} but gap expected=${shouldGap}`);
    });
    if (r.dishes.length !== b.dishes.length - 1) fail('remove changed other dishes');
  });
  MealEngine.addOptions(b, ctx(history, b.date)).slice(0, 8).forEach(d => {
    const a = MealEngine.addDish(b, d.id, ctx(history, b.date));
    conserve(a, `add ${d.name}`);
    editStats.adds++;
    const added = a.dishes.find(x => x.dishId === d.id);
    if (!added) { fail(`add ${d.name}: not added`); return; }
    const want = MealEngine.cats(d.items, FOODS), got = MealEngine.cats(added.items, FOODS);
    Object.keys(want).forEach(c => { if (Math.abs(got[c] - want[c]) > 0.5) fail(`add ${d.name}: ${c} ${got[c]} vs normal ${want[c]}`); });
    if (a.dishes.length < b.dishes.length + 1) editStats.addsDropped++;
    if (Object.keys(a.over).length) editStats.addsOver++;
    Object.keys(a.over).forEach(c => { if (!(want[c] > pool0[c] - 1e-9 || a.dishes.some(x => x.dishId !== d.id && MealEngine.cats(x.items, FOODS)[c]))) fail(`add ${d.name}: unexplained over ${c}`); });
  });
}
report.manualEdits = editStats;
// Cardio carb falls back when its dish is removed; with no carb dish left the cardio carb shows as unallocated.
const bc = MealEngine.generateDay(ctx(history, iso(40)));
const ci0 = MealEngine.cardioIdx(bc, FOODS), rc = MealEngine.removeDish(MealEngine.setCardioDish(bc, bc.dishes[ci0].dishId), ci0, ctx(history, bc.date));
const ci1 = MealEngine.cardioIdx(rc, FOODS);
if (ci1 >= 0 && !Object.keys(rc.dishes[ci1].items).some(id => FOODS[id].cat === 'C')) fail('cardio fallback lacks carbs');
let empty = bc;
while (empty.dishes.length) empty = MealEngine.removeDish(empty, 0, ctx(history, bc.date));
const ev = MealEngine.view(empty, 'cardio', ctx({}, bc.date));
if (Math.abs((ev.unallocated.C || 0) - (PLAN.dayTypes.cardio.pool.C)) > 1e-6) fail(`empty cardio day: unallocated C ${ev.unallocated.C}`);


const fs1 = MealEngine.swapFruit(b0, ctx(history, iso(21)));
if (fs1.fruit === b0.fruit || JSON.stringify(fs1.dishes) !== JSON.stringify(b0.dishes)) fail('swapFruit');

console.log(JSON.stringify(report, null, 1));
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
