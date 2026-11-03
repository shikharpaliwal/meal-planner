// Day builder: fixed meal slots, each with its fixed items, the picks you choose (breakfast, lunch, dinner)
// and fruit. Pure functions; works in the browser and in node (see test/test.js).
var MealEngine = (function () {
  var DAY_MS = 864e5;
  var MACROS = ['kcal', 'p', 'c', 'f'];

  // Fruit parts of a day (history saved before fruits were split has a single `fruit`).
  var fruitParts = function (day) { return day.fruits || (day.fruit ? [day.fruit] : []); };
  // Recency penalty: each use d days ago adds 12·0.7^(d-1), so yesterday weighs 12 and a week ago ~1.4.
  function penalty(id, history, date) {
    var p = 0;
    Object.keys(history || {}).forEach(function (k) {
      var h = history[k], d = Math.round((Date.parse(date) - Date.parse(h.date)) / DAY_MS);
      if (d < 1 || d > 30) return;
      fruitParts(h).forEach(function (pt) { if (pt.dishId === id) p += 12 * Math.pow(0.7, d - 1); });
    });
    return p;
  }

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
    (day.fixed || []).concat(fruitParts(day), day.dishes || []).forEach(function (p) {
      var x = macros(p.items, foods);
      MACROS.forEach(function (k) { m[k] += x[k]; });
    });
    return m;
  }

  // A day's base (shared by every day type): picks { slot: { row: option or '' } }, missing rows use the row's default;
  // fruits { slot: fruit id }.
  function newDay(o) {
    var base = { date: o.date, picks: {}, fruits: {} };
    o.plan.fruitSlots.forEach(function (s) { base.fruits[s] = pickFruit(Object.assign({}, o, { taken: base.fruits })); });
    return base;
  }
  // A row's default on `type` (the nuts row defaults differently on gym/cardio days).
  function defOf(r, type) { return (r.defByType || {})[type] || r.def; }
  function pickOf(base, s, r, type) {
    var p = (base.picks[s] || {})[r.id];
    return (p === '' && !r.required) || r.sets[p] ? p : defOf(r, type);
  }
  // An option's items as eaten on `type` (cardio multiplies rows with `cardio`).
  function optionItems(r, opt, type) {
    var items = {}, f = type === 'cardio' && r.cardio ? r.cardio : 1;
    Object.keys(r.sets[opt]).forEach(function (id) { items[id] = r.sets[opt][id] * f; });
    return items;
  }
  var units = function (r, opt, type) {
    var items = opt ? optionItems(r, opt, type) : {};
    return Object.keys(items).reduce(function (n, id) { return n + items[id]; }, 0);
  };
  // Per picker row: units picked today vs the plan's (the defaults') for `type`; rows that are `required` in every
  // slot (always as planned) have no total.
  function rowTotals(base, type, o) {
    var t = {}, free = {};
    Object.keys(o.plan.pickers).forEach(function (s) {
      o.plan.pickers[s].forEach(function (r) {
        if (!r.required) free[r.id] = true;
        var x = t[r.id] = t[r.id] || { sel: 0, exp: 0 };
        x.sel += units(r, pickOf(base, s, r, type), type);
        x.exp += units(r, defOf(r, type), type);
      });
    });
    Object.keys(t).forEach(function (k) { if (!free[k]) delete t[k]; });
    return t;
  }
  // A new day with random picks for `type`: per row, a random choice among every slot combination whose units add up
  // to the plan's day total, preferring combinations that share no pick with o.prev (the previous day).
  function shuffleDay(type, o) {
    var rng = o.rng || Math.random, base = newDay(o), plan = rowTotals(base, type, o), prev = {}, rows = {};
    ((o.prev || {}).dishes || []).forEach(function (p) { prev[p.dishId] = JSON.stringify(p.items); });
    Object.keys(o.plan.pickers).forEach(function (s) {
      o.plan.pickers[s].forEach(function (r) { (rows[r.id] = rows[r.id] || []).push([s, r]); });
    });
    // Protein rows follow an arrangement (usual = defaults, or plan.proteinSwap, ~50/50); the rest are enumerated.
    var swap = o.plan.proteinSwap, arranged = {};
    Object.keys(swap).forEach(function (s) { Object.keys(swap[s]).forEach(function (id) { arranged[id] = true; }); });
    Object.keys(rows).forEach(function (id) {
      if (arranged[id]) return;
      var combos = [{ picks: [], n: 0, rep: false }];
      rows[id].forEach(function (sr) {
        var s = sr[0], r = sr[1], opts = r.locked ? [r.def] : (r.required ? [] : ['']).concat(Object.keys(r.sets)), next = [];
        combos.forEach(function (c) {
          opts.forEach(function (opt) {
            var rep = !!opt && opts.length > 1 && prev['pick-' + s + '-' + id] === JSON.stringify(optionItems(r, opt, type));
            next.push({ picks: c.picks.concat([[s, opt]]), n: c.n + units(r, opt, type), rep: c.rep || rep });
          });
        });
        combos = next;
      });
      combos = combos.filter(function (c) { return !plan[id] || Math.abs(c.n - plan[id].exp) < 1e-9; });
      var fresh = combos.filter(function (c) { return !c.rep; }), list = fresh.length ? fresh : combos;
      list[Math.floor(rng() * list.length)].picks.forEach(function (p) { base = setPick(base, p[0], id, p[1]); });
    });
    if (rng() < 0.5) Object.keys(swap).forEach(function (s) { Object.keys(swap[s]).forEach(function (id) { base = setPick(base, s, id, swap[s][id]); }); });
    return base;
  }
  // Slots where a row and its `apart` row are both picked: { slot: [row id, apart id] }.
  function clashes(base, type, o) {
    var out = {};
    Object.keys(o.plan.pickers).forEach(function (s) {
      var rows = o.plan.pickers[s], on = function (r) { return r && pickOf(base, s, r, type); };
      rows.forEach(function (r) { if (r.apart && on(r) && on(rows.find(function (x) { return x.id === r.apart; }))) out[s] = [r.id, r.apart]; });
    });
    return out;
  }
  // Switching day type: back to that type's defaults (empty picks), fruits kept.
  function resetPicks(base) { return Object.assign({}, base, { picks: {} }); }
  function setPick(base, s, rowId, opt) {
    var picks = Object.assign({}, base.picks);
    picks[s] = Object.assign({}, picks[s]);
    picks[s][rowId] = opt;
    return Object.assign({}, base, { picks: picks });
  }

  // The base as eaten on `type`: picks (in slot/row order), fruits and fixed items. Pure: never mutates `base`.
  function view(base, type, o) {
    var t = o.plan.dayTypes[type], dishes = [];
    o.plan.slots.forEach(function (sl) {
      (o.plan.pickers[sl.id] || []).forEach(function (r) {
        var opt = pickOf(base, sl.id, r, type);
        if (opt) dishes.push({ dishId: 'pick-' + sl.id + '-' + r.id, slot: sl.id, row: r.id, items: optionItems(r, opt, type) });
      });
      if (o.plan.pickers[sl.id]) dishes.push({ dishId: 'fat-' + sl.id, slot: sl.id, row: 'fat', items: o.plan.mealFat });
    });
    var fruits = o.plan.fruitSlots.map(function (s) {
      var fid = base.fruits[s], f = { dishId: 'fruit-' + fid, slot: s, items: {} };
      f.items[fid] = o.plan.fruitUnits / o.plan.fruitSlots.length;
      return f;
    });
    return {
      date: base.date, dayType: type, dishes: dishes, fruits: fruits,
      fixed: t.fixed.map(function (f) { return { dishId: 'fixed-' + f.id, name: f.name, slot: f.slot, method: f.method, items: f.items }; }),
    };
  }

  // Each fruit slot rotates (recency penalty), never the same fruit as another slot (o.taken).
  function pickFruit(o) {
    var rng = o.rng || Math.random, taken = Object.values(o.taken || {});
    var list = o.plan.fruitChoices.filter(function (id) { return taken.indexOf(id) < 0; });
    return best(list, function (id) { return penalty('fruit-' + id, o.history, o.date) + rng() * 4; });
  }
  function setFruit(base, s, id) {
    var fruits = Object.assign({}, base.fruits);
    fruits[s] = id;
    return Object.assign({}, base, { fruits: fruits });
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

  return {
    newDay: newDay, shuffleDay: shuffleDay, view: view, optionItems: optionItems, pickOf: pickOf, defOf: defOf, setPick: setPick, resetPicks: resetPicks, rowTotals: rowTotals, clashes: clashes, setFruit: setFruit,
    macros: macros, dayMacros: dayMacros, fruitParts: fruitParts, fmtQty: fmtQty,
  };
})();

if (typeof module !== 'undefined') module.exports = MealEngine;
