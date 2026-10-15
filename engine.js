// Rule-based day generator: fixed items + a flat list of atomic dishes that consume the day's pool exactly.
// Pure functions; works in the browser and in node (see test/test.js).
var MealEngine = (function () {
  var DAY_MS = 864e5;
  var MACROS = ['kcal', 'p', 'c', 'f'];
  var MAX_DISHES = 8; // safety cap; the count itself emerges from what gets picked

  function cats(items, foods) {
    var t = {};
    Object.keys(items).forEach(function (id) {
      if (foods[id]) t[foods[id].cat] = (t[foods[id].cat] || 0) + items[id];
    });
    return t;
  }
  function catTotals(list, foods) {
    var t = {};
    list.forEach(function (d) { var c = cats(d.items, foods); Object.keys(c).forEach(function (k) { t[k] = (t[k] || 0) + c[k]; }); });
    return t;
  }
  function basePool(o) { return o.plan.dayTypes[o.plan.baseType].pool; }

  // Categories come from SUB_GROUPS (data/substitutions.js); `fixed` groups (nuts, fruit, skyr…) never go in dishes.
  function fixedCat(c) { return typeof GROUPS !== 'undefined' && GROUPS[c] && GROUPS[c].fixed; }
  function usable(d, foods, pool) {
    var ids = Object.keys(d.items || {});
    return ids.length > 0 && ids.every(function (id) {
      return foods[id] && !fixedCat(foods[id].cat) && (!pool || pool[foods[id].cat]);
    });
  }

  // Recency penalty: each use d days ago adds 12·0.7^(d-1), so yesterday weighs 12 and a week ago ~1.4.
  function penalty(id, history, date) {
    var p = 0;
    Object.keys(history || {}).forEach(function (k) {
      var h = history[k], d = Math.round((Date.parse(date) - Date.parse(h.date)) / DAY_MS);
      if (d < 1 || d > 30) return;
      (h.dishes || []).concat(h.fruit ? [h.fruit] : []).forEach(function (pt) { if (pt.dishId === id) p += 12 * Math.pow(0.7, d - 1); });
    });
    return p;
  }
  // Common staples (roti, rice, boiled eggs…) may repeat often: their recency penalty counts a quarter.
  function dishPenalty(d, o) { return penalty(d.id, o.history, o.date) * (d.common ? 0.25 : 1); }

  function best(list, score) {
    var top = null, min = Infinity;
    list.forEach(function (d) { var s = score(d); if (s < min) { min = s; top = d; } });
    return top;
  }

  function macros(items, foods) {
    var m = { kcal: 0, p: 0, c: 0, f: 0 };
    Object.keys(items).forEach(function (id) {
      if (!foods[id]) return; // food removed from the data since this plan was saved
      MACROS.forEach(function (k) { m[k] += items[id] * foods[id][k]; });
    });
    return m;
  }
  function dayMacros(day, foods) {
    var m = { kcal: 0, p: 0, c: 0, f: 0 };
    (day.fixed || []).concat(day.fruit ? [day.fruit] : [], day.dishes || []).forEach(function (p) {
      var x = macros(p.items, foods);
      MACROS.forEach(function (k) { m[k] += x[k]; });
    });
    return m;
  }

  function part(d, items) {
    return { dishId: d.id, name: d.name, common: !!d.common, extras: d.extras || '', method: d.method || '', items: items || d.items };
  }

  // Day types differ only in fixed items, fruit amount and pool deltas (cardio: +1 carb unit), which go to the
  // user-chosen "cardio carb" dish at view time.
  function delta(plan, type) {
    var b = plan.dayTypes[plan.baseType].pool, p = plan.dayTypes[type].pool, d = {};
    Object.keys(Object.assign({}, b, p)).forEach(function (c) {
      var x = (p[c] || 0) - (b[c] || 0);
      if (Math.abs(x) > 1e-9) d[c] = x;
    });
    return d;
  }

  // Scale every category across the day so its total equals the pool exactly.
  function scaleDay(list, o) {
    var foods = o.foods, pool = basePool(o), tot = catTotals(list, foods), factors = {};
    Object.keys(tot).forEach(function (c) { factors[c] = (pool[c] || 0) / tot[c]; });
    var dishes = list.map(function (d) {
      var items = {};
      Object.keys(d.items).forEach(function (id) { items[id] = d.items[id] * factors[foods[id].cat]; });
      return part(d, items);
    });
    return { date: o.date, factors: factors, covered: Object.keys(pool).every(function (c) { return tot[c]; }),
      dishes: dishes, residual: snap(dishes, foods), unallocated: {}, over: {} };
  }

  // Manual edits (add/remove): `locked` dishes keep one normal serving; the others share what's left of each
  // category within 0.5–2x. What can't be placed is reported, never hidden: `unallocated` (below the pool) or
  // `over` (above it), in exchange units per category.
  function allocate(list, o, locked) {
    var foods = o.foods, pool = basePool(o), factors = {}, unallocated = {}, over = {};
    var lockTot = catTotals(list.filter(function (d) { return locked.has(d.id); }), foods);
    var freeTot = catTotals(list.filter(function (d) { return !locked.has(d.id); }), foods);
    Object.keys(Object.assign({}, pool, lockTot, freeTot)).forEach(function (c) {
      var rem = (pool[c] || 0) - (lockTot[c] || 0), T = freeTot[c] || 0;
      var f = T ? Math.min(2, Math.max(0.5, rem / T)) : 0, diff = rem - T * f;
      factors[c] = f;
      if (diff > 1e-9) unallocated[c] = diff; else if (diff < -1e-9) over[c] = -diff;
    });
    var dishes = list.map(function (d) {
      var items = {};
      Object.keys(d.items).forEach(function (id) { items[id] = d.items[id] * (locked.has(d.id) ? 1 : factors[foods[id].cat]); });
      return part(d, items);
    });
    return { date: o.date, factors: factors, covered: true, dishes: dishes, residual: snap(dishes, foods), unallocated: unallocated, over: over };
  }

  var dishObjects = function (base, o) {
    var byId = {};
    o.dishes.forEach(function (d) { byId[d.id] = d; });
    return base.dishes.map(function (p) { return byId[p.dishId] || { id: p.dishId, name: p.name, common: p.common, items: p.items }; });
  };
  var carry = function (from, to) { to.fruit = from.fruit; to.cardioDish = from.cardioDish; return to; };

  // Remove dish `idx`; the remaining dishes in its categories absorb its share (within 0.5–2x).
  function removeDish(base, idx, o) {
    return carry(base, allocate(dishObjects(base, o).filter(function (_, j) { return j !== idx; }), o, new Set()));
  }

  // Add a dish at one normal serving; same-category dishes shrink to make room, and any pushed below 0.5x is
  // dropped (preferring one whose other categories stay covered) and the rest re-split.
  function addDish(base, dishId, o) {
    var foods = o.foods, d = o.dishes.find(function (x) { return x.id === dishId; });
    if (!d) return base;
    var list = dishObjects(base, o).concat(d), locked = new Set([d.id]), pool = basePool(o), lockTot = cats(d.items, foods);
    for (;;) {
      var freeTot = catTotals(list.filter(function (x) { return x !== d; }), foods);
      var tight = Object.keys(freeTot).filter(function (c) { return ((pool[c] || 0) - (lockTot[c] || 0)) / freeTot[c] < 0.5; });
      if (!tight.length) break;
      var cands = list.filter(function (x) { return x !== d && tight.some(function (c) { return cats(x.items, foods)[c]; }); });
      var drop = best(cands, function (x) {
        var cv = catTotals(list.filter(function (y) { return y !== x; }), foods);
        var orphaned = Object.keys(cats(x.items, foods)).filter(function (k) { return !cv[k]; }).length;
        return orphaned * 10 - Object.keys(cats(x.items, foods)).filter(function (k) { return tight.indexOf(k) >= 0; }).length;
      });
      if (!drop) break;
      list = list.filter(function (x) { return x !== drop; });
    }
    return carry(base, allocate(list, o, locked));
  }

  // Library dishes that can be added today (fit the pool's categories, not already on the list).
  function addOptions(base, o) { return swapOptions(base, -1, o); }
  // Up to n quick fixes for an unallocated category: dishes touching as few other categories as possible.
  function suggestFor(base, c, o, n) {
    var foods = o.foods, gaps = base.unallocated || {};
    return swapOptions(base, -1, o).filter(function (d) { return cats(d.items, foods)[c]; }).map(function (d) {
      var extra = Object.keys(cats(d.items, foods)).filter(function (k) { return k !== c && !gaps[k] && k !== 'O'; }).length;
      return { d: d, s: extra * 10 + dishPenalty(d, o) };
    }).sort(function (a, b) { return a.s - b.s; }).slice(0, n || 3).map(function (x) { return x.d; });
  }

  // Snap foods with a `step` (whole eggs, whole whites, half scoops) to that step, then move the leftover to other
  // foods of the same category: continuous ones first (paneer, cheese…), else the finest-step one. Returns the
  // amount (in units) that couldn't be placed, which the cost function penalises.
  function snap(dishes, foods) {
    var byCat = {}, residual = 0;
    dishes.forEach(function (p) {
      Object.keys(p.items).forEach(function (id) {
        var c = foods[id].cat;
        (byCat[c] = byCat[c] || []).push({ p: p, id: id, step: foods[id].step || 0 });
      });
    });
    Object.keys(byCat).forEach(function (c) {
      var list = byCat[c], stepped = list.filter(function (x) { return x.step; });
      if (!stepped.length) return;
      var r = 0;
      stepped.forEach(function (x) {
        var v = x.p.items[x.id], s = Math.max(x.step, Math.round(v / x.step) * x.step);
        r += v - s;
        x.p.items[x.id] = s;
      });
      var cont = list.filter(function (x) { return !x.step; });
      var room = cont.reduce(function (a, x) { return a + x.p.items[x.id]; }, 0);
      if (cont.length && room + r > room * 0.3) { // continuous foods absorb it (but never shrink below 30%)
        cont.forEach(function (x) { x.p.items[x.id] += r * x.p.items[x.id] / room; });
        r = 0;
      } else {
        stepped.sort(function (a, b) { return a.step - b.step; });
        var f = stepped[0], k = Math.round(r / f.step) * f.step;
        if (f.p.items[f.id] + k >= f.step) { f.p.items[f.id] += k; r -= k; }
      }
      residual += Math.abs(r);
    });
    return residual;
  }

  // Randomised greedy pick: add dishes until every pool category is covered and no category needs its servings
  // stretched past 2x; sometimes add one more where servings are still large. Hearty multi-category dishes
  // (bisi bele bath) cover more at once than light ones (boiled eggs), so the day's dish count varies (~3–7).
  function pickDishes(o, keep) {
    var foods = o.foods, rng = o.rng || Math.random, pool = basePool(o);
    var all = o.dishes.filter(function (d) { return usable(d, foods, pool); });
    var list = (keep || []).slice(), used = new Set(list.map(function (d) { return d.id; }));
    var hearty = rng(); // per-day taste for multi-category dishes vs single items
    while (list.length < MAX_DISHES) {
      var t = catTotals(list, foods);
      var want = Object.keys(pool).filter(function (c) { return !t[c]; });
      if (!want.length) want = Object.keys(pool).filter(function (c) { return pool[c] / t[c] > 2; });
      if (!want.length && rng() < 0.25) want = Object.keys(pool).filter(function (c) { return pool[c] / t[c] > 1.4; });
      if (!want.length) break;
      var pick = best(all.filter(function (d) {
        var c = cats(d.items, foods);
        return !used.has(d.id) && !(o.exclude && o.exclude.has(d.id)) && want.some(function (k) { return c[k]; });
      }), function (d) {
        var c = cats(d.items, foods), hits = want.filter(function (k) { return c[k]; }).length;
        // Categories already at/over the pool would shrink every dish that has them.
        var squeeze = Object.keys(c).filter(function (k) { return t[k] && pool[k] / t[k] < 1; }).length;
        return dishPenalty(d, o) + rng() * 4 - hits * (0.5 + 3 * hearty) + squeeze * 2.5;
      });
      if (!pick) break;
      list.push(pick);
      used.add(pick.id);
    }
    var t2 = catTotals(list, foods);
    Object.keys(pool).forEach(function (c) { // nothing could cover it: the PDF's own food
      if (t2[c]) return;
      var items = {}, base = o.plan.dayTypes[o.plan.baseType];
      items[Object.keys(base.poolFoods).filter(function (id) { return foods[id].cat === c; })[0]] = 1;
      list.push({ id: 'plan-default-' + c, name: 'As per plan', common: true, items: items });
    });
    return list;
  }

  // Index of the dish that takes the cardio carb: the chosen one if it still has carbs, else the most carb-heavy.
  function cardioIdx(base, foods) {
    var carbs = base.dishes.map(function (d) { return cats(d.items, foods).C || 0; });
    var i = base.dishes.findIndex(function (d) { return d.dishId === base.cardioDish; });
    if (i >= 0 && carbs[i]) return i;
    var max = Math.max.apply(null, carbs.concat(0));
    return max > 0 ? carbs.indexOf(max) : -1;
  }
  function setCardioDish(base, dishId) { return Object.assign({}, base, { cardioDish: dishId }); }

  // The base plan as eaten on `type`: fixed items, fruit amount, and the cardio-carb dish adjusted by the delta.
  // Pure: never mutates `base`, so switching types back and forth is lossless.
  function view(base, type, o) {
    var foods = o.foods, t = o.plan.dayTypes[type], d = delta(o.plan, type), ci = cardioIdx(base, foods);
    var unallocated = Object.assign({}, base.unallocated || {});
    if (ci < 0 || !base.dishes.length) Object.keys(d).forEach(function (c) { unallocated[c] = (unallocated[c] || 0) + d[c]; });
    var dishes = base.dishes.map(function (p, i) {
      var q = Object.assign({}, p, { items: Object.assign({}, p.items), cardio: i === ci });
      Object.keys(d).forEach(function (c) {
        if (i !== ci) return;
        var tot = cats(q.items, foods)[c];
        if (!tot) { unallocated[c] = (unallocated[c] || 0) + d[c]; return; } // no dish left to take it
        var f = (tot + d[c]) / tot;
        Object.keys(q.items).forEach(function (id) { if (foods[id] && foods[id].cat === c) q.items[id] *= f; });
      });
      return q;
    });
    var fid = base.fruit && foods[base.fruit] ? base.fruit : o.plan.fruitChoices[0];
    var fruit = { dishId: 'fruit-' + fid, name: 'Fruit (eat separately)', fruit: true, items: {} };
    fruit.items[fid] = t.fruitUnits;
    return {
      date: base.date, dayType: type, dishes: dishes, fruit: fruit, unallocated: unallocated, over: Object.assign({}, base.over || {}),
      fixed: t.fixed.map(function (f) { return { dishId: 'fixed-' + f.id, name: f.name, method: f.method, items: f.items, fixed: true }; }),
    };
  }

  // Lower is better: recency + serving distortion + dish count + macro drift vs the PDF (averaged over day types).
  function cost(base, o) {
    var foods = o.foods, c = (base.covered ? 0 : 1000) + (base.residual || 0) * 40; // off-pool after rounding
    base.dishes.forEach(function (p) { c += dishPenalty({ id: p.dishId, common: p.common }, o); });
    Object.keys(base.factors).forEach(function (k) {
      var f = base.factors[k]; // a dish at <0.5x or >2x its usual serving is unrealistic
      c += f ? Math.abs(Math.log(f)) * 6 + (f > 2 || f < 0.5 ? 30 : 0) : 100;
    });
    var types = Object.keys(o.plan.dayTypes);
    types.forEach(function (type) {
      var t = o.plan.dayTypes[type].prescribed, d = dayMacros(view(base, type, o), foods);
      MACROS.forEach(function (k) {
        var dev = Math.abs(d[k] - t[k]) / t[k] * 100;
        c += (Math.max(0, dev - 4) * 3 + Math.max(0, dev - 8) * 20) / types.length;
      });
    });
    return c;
  }

  function generateDay(o) {
    var top = null, min = Infinity;
    for (var i = 0; i < (o.tries || 80); i++) {
      var d = scaleDay(pickDishes(o), o), c = cost(d, o);
      if (c < min) { min = c; top = d; }
    }
    top.fruit = pickFruit(o);
    return top;
  }

  // Dishes that could replace dish `idx` (anything usable that isn't already on the day).
  function swapOptions(base, idx, o) {
    var pool = basePool(o);
    var taken = new Set(base.dishes.filter(function (_, j) { return j !== idx; }).map(function (p) { return p.dishId; }));
    return o.dishes.filter(function (d) { return usable(d, o.foods, pool) && !taken.has(d.id); });
  }

  // Replace dish `idx`, then fix up the rest: add dishes for categories the new one no longer covers, and drop
  // dishes it made redundant if that gives more realistic servings — so the count may change.
  // o.seen = dishes already shown there; o.forceId = a specific dish.
  function swapDish(base, idx, o) {
    var foods = o.foods, rng = o.rng || Math.random, keep = dishObjects(base, o);
    var seen = new Set((o.seen || []).concat(base.dishes[idx].dishId));
    var opts = swapOptions(base, idx, o);
    var forced = o.forceId && opts.find(function (d) { return d.id === o.forceId; });
    var fresh = opts.filter(function (d) { return !seen.has(d.id); });
    var top = null, min = Infinity;
    (forced ? [forced] : fresh.length ? fresh : opts).forEach(function (d) {
      var list = keep.slice();
      list[idx] = d;
      list = pickDishes(Object.assign({}, o, { exclude: seen }), list); // covers anything now missing
      var variants = [list];
      list.forEach(function (x, j) { // drop another dish whose categories stay covered without it
        if (j === idx) return;
        var rest = list.filter(function (_, k) { return k !== j; }), cv = catTotals(rest, foods);
        if (Object.keys(cats(x.items, foods)).every(function (k) { return cv[k]; })) variants.push(rest);
      });
      variants.forEach(function (v) {
        var b = scaleDay(v, o), c = cost(b, o) + rng() * 2;
        if (c < min) { min = c; top = b; }
      });
    });
    return top ? carry(base, top) : base;
  }

  // Fruit rotates like dishes (recency penalty); o.seen / o.forceId work as in swapDish.
  function pickFruit(o) {
    var rng = o.rng || Math.random, seen = new Set(o.seen || []);
    var list = o.plan.fruitChoices.filter(function (id) { return o.foods[id]; });
    if (o.forceId && list.indexOf(o.forceId) >= 0) return o.forceId;
    var fresh = list.filter(function (id) { return !seen.has(id); });
    return best(fresh.length ? fresh : list, function (id) { return penalty('fruit-' + id, o.history, o.date) + rng() * 4; });
  }
  function swapFruit(base, o) {
    var seen = (o.seen || []).concat(base.fruit);
    return Object.assign({}, base, { fruit: pickFruit(Object.assign({}, o, { seen: seen })) });
  }

  function fmtQty(food, units) {
    var n = units * food.qty;
    if (food.unit === 'g' || food.unit === 'ml') {
      var r = n < 10 ? Math.round(n) : Math.round(n / 5) * 5; // practical: nearest 5g/ml above 10
      var pc = food.piece ? ' (≈' + Math.round(n / food.piece[0] * 10) / 10 + ' ' + food.piece[1] + ')' : '';
      return r + food.unit + pc;
    }
    var c = Math.round(n * 2) / 2;
    return c + ' ' + (c === 1 ? food.unit.replace(/s$/, '') : food.unit);
  }

  var COMBO = /\s(\+|&|with|and)\s/i; // "Upma with boiled eggs", "Dal + rice"
  // Returns a list of problems with a dish (empty = valid).
  function validate(d, foods, guide) {
    var errs = [];
    if (!d.id || !d.name) errs.push('needs an id and a name');
    if (!d.items || !Object.keys(d.items).length) errs.push('add at least one ingredient');
    Object.keys(d.items || {}).forEach(function (id) {
      if (!foods[id]) errs.push('unknown food "' + id + '"');
      else if (!(d.items[id] > 0)) errs.push(foods[id].name + ': amount must be > 0');
      else if (fixedCat(foods[id].cat)) errs.push(foods[id].name + ' is a fixed item, not a dish ingredient');
    });
    if (COMBO.test(d.name || '')) errs.push('one dish per entry — add each part as its own dish');
    if (!d.cuisine || typeof d.cuisine !== 'string') errs.push('pick a cuisine');
    var text = (d.name + ' ' + (d.extras || '') + ' ' + (d.method || '')).toLowerCase();
    guide.bannedVeg.forEach(function (w) {
      if (w !== 'potato' && new RegExp('\\b' + w).test(text)) errs.push('avoid "' + w + '"');
    });
    return errs;
  }

  return {
    cats: cats, isCombo: function (n) { return COMBO.test(n); },
    view: view, delta: delta, cardioIdx: cardioIdx, setCardioDish: setCardioDish,
    generateDay: generateDay, swapDish: swapDish, swapOptions: swapOptions, swapFruit: swapFruit,
    removeDish: removeDish, addDish: addDish, addOptions: addOptions, suggestFor: suggestFor,
    macros: macros, dayMacros: dayMacros, fmtQty: fmtQty, validate: validate,
  };
})();

if (typeof module !== 'undefined') module.exports = MealEngine;
