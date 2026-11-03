(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var r0 = function (n) { return Math.round(n); };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mp.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  var TYPES = ['rest', 'gym', 'cardio'];
  var TYPE_LABEL = { rest: 'Rest', cardio: 'Cardio', gym: 'Gym' };
  var today = new Date().toLocaleDateString('en-CA');

  var history = store.get('history', {});

  // One draft per day: a base (picks, fruits) shared by every day type, plus the chosen type.
  var draft = store.get('draft', {});
  var draftOk = draft && draft.v === 9 && draft.date === today && draft.base && draft.base.picks;
  if (!draftOk) draft = { v: 9, date: today, base: null };
  var dayType = store.get('lastType', 'rest');
  if (!PLAN.dayTypes[dayType]) dayType = 'rest';

  function ctx(extra) {
    return Object.assign({ plan: PLAN, history: history, date: today }, extra);
  }

  // ---------- Theme ----------
  var themes = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $('#theme').textContent = t[0].toUpperCase() + t.slice(1);
  }
  applyTheme(store.get('theme', 'auto'));
  $('#theme').onclick = function () {
    var t = themes[(themes.indexOf(store.get('theme', 'auto')) + 1) % 3];
    store.set('theme', t); applyTheme(t);
  };

  // ---------- Tabs ----------
  var renderers = { today: renderToday, plan: renderPlan, history: renderHistory };
  $('#tabs').onclick = function (e) {
    var tab = e.target.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b === e.target); });
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== tab; });
    renderers[tab]();
  };

  // ---------- Today ----------
  function currentBase() {
    if (!draft.base) { draft.base = MealEngine.newDay(ctx()); saveDraft(); }
    return draft.base;
  }
  var currentView = function () { return MealEngine.view(currentBase(), dayType, ctx()); };
  function saveDraft() { store.set('draft', draft); }

  function meter(label, val, target, unit) {
    var pct = val / target * 100, off = Math.abs(pct - 100) > 10;
    return '<div class="meter' + (off ? ' warn' : '') + '" title="' + label + ': ' + r0(val) + unit + ' of ' + r0(target) + unit + '">' +
      '<span><b>' + r0(val) + '</b><span class="muted tgt">/' + r0(target) + unit + '</span> <span class="muted">' + label + '</span></span>' +
      '<div class="track"><div class="fill" style="width:' + Math.min(pct, 100) + '%"></div></div></div>';
  }
  var macroLine = function (m) { return r0(m.kcal) + ' kcal · P ' + r0(m.p) + ' · C ' + r0(m.c) + ' · F ' + r0(m.f); };
  var short = function (f) { return f.name.replace(/\s*\(.*\)/, ''); };
  // "2 dates" / "6 egg whites", not "2 dates dates"; drops the "(≈n slices)" hint for brevity.
  var qtyName = function (id, u) {
    var q = MealEngine.fmtQty(FOODS[id], u).replace(/ \(≈[^)]*\)/, ''), n = short(FOODS[id]).toLowerCase();
    var unitWord = q.replace(/^[\d.]+\s*/, '');
    if (q.indexOf(n) >= 0) return q;
    if (unitWord.length > 2 && n.indexOf(unitWord.replace(/s$/, '')) >= 0) return q.replace(unitWord, parseFloat(q) === 1 || /s$/.test(n) ? n : n + 's');
    return q + ' ' + n;
  };
  // Foods since removed from the data (in old History entries) show as their id.
  var itemText = function (items) {
    return Object.keys(items).map(function (id) { return FOODS[id] ? qtyName(id, items[id]) : id; }).join(' + ');
  };
  var ROWS = [['protein', 'Protein 1'], ['protein2', 'Protein 2'], ['carb', 'Carb'], ['veg', 'Veg'], ['nuts', 'Nuts'], ['dal', 'Dal'], ['fruit', 'Fruit']];

  function renderToday() {
    $('#daytype').innerHTML = TYPES.map(function (t) {
      return '<button data-type="' + t + '" class="' + (t === dayType ? 'on' : '') + '">' + TYPE_LABEL[t] + '</button>';
    }).join('');
    var day = currentView(), type = PLAN.dayTypes[dayType], m = MealEngine.dayMacros(day, FOODS), t = type.target;
    var accepted = history[today] && JSON.stringify(history[today]) === JSON.stringify(day);
    $('#accept').textContent = accepted ? 'Accepted ✓' : 'Accept';
    $('#accept').disabled = accepted;
    $('#today-meta').textContent = history[today] && !accepted ? 'A different version was accepted earlier today.' : '';
    $('#summary').innerHTML = meter('kcal', m.kcal, t.kcal, '') + meter('P', m.p, t.p, 'g') +
      meter('C', m.c, t.c, 'g') + meter('F', m.f, t.f, 'g');
    var fruitIds = day.fruits.map(function (f) { return Object.keys(f.items)[0]; });
    // Same markup as the picker cells; a slot's list leaves out the other slots' fruits.
    var fruitPick = function (f) {
      var fid = Object.keys(f.items)[0], u = f.items[fid];
      return '<label class="pick-row"><span>Fruit</span><select data-fruit-slot="' + f.slot + '" title="Fruit">' +
        PLAN.fruitChoices.filter(function (id) { return id === fid || fruitIds.indexOf(id) < 0; }).map(function (id) {
          return '<option value="' + id + '"' + (id === fid ? ' selected' : '') + '>' + esc(qtyName(id, u)) + '</option>';
        }).join('') + '</select></label>';
    };
    // A grid: one column per slot, one row per component, so the same picker lines up across meals. Cells carry
    // their column/row (--c/--r); on narrow screens the grid becomes one list ordered slot by slot.
    var cell = function (c, r, cls, html) { return '<div class="cell ' + cls + '" style="--c:' + c + ';--r:' + r + '">' + html + '</div>'; };
    var html = cell(1, 1, 'corner', ''), clash = MealEngine.clashes(currentBase(), dayType, ctx());
    // Row day totals (picked / plan): coloured selects + a count badge on each picker row; off-plan rows also in the sticky bar.
    var tot = MealEngine.rowTotals(currentBase(), dayType, ctx()), r2 = function (n) { return String(Math.round(n * 100) / 100); };
    var badge = function (label, x) {
      return '<span class="cnt ' + st(x) + '" title="' + esc(label) + ' day total: picked / plan">' + r2(x.sel) + '/' + r2(x.exp) + '</span>';
    };
    var st = function (x) { return !x ? '' : x.sel > x.exp + 1e-9 ? 'over' : x.sel < x.exp - 1e-9 ? 'under' : 'ok'; };
    $('#offplan').innerHTML = ROWS.filter(function (rw) { var s = st(tot[rw[0]]); return s === 'over' || s === 'under'; }).map(function (rw) {
      var d = tot[rw[0]].sel - tot[rw[0]].exp;
      return '<span class="' + st(tot[rw[0]]) + '">' + esc(rw[1]) + ' ' + (d > 0 ? '+' : '−') + r2(Math.abs(d)) + '</span>';
    }).join(', ');
    // Only the picker meals get a column; pre/post fixed items are hidden but still count in the meters.
    var cols = PLAN.slots.filter(function (sl) { return PLAN.pickers[sl.id]; });
    cols.forEach(function (sl, k) {
      var c = k + 2, mine = function (list) { return list.filter(function (p) { return p.slot === sl.id; }); };
      html += cell(c, 1, 'head', '<h3>' + esc(sl.label) + '</h3>');
      ROWS.forEach(function (rw, r) {
        var inner = rw[0] === 'fruit' ? mine(day.fruits).map(fruitPick).join('')
          : pickerHtml(sl.id, rw[0], clash[sl.id], tot[rw[0]] && { st: st(tot[rw[0]]), badge: badge(rw[1], tot[rw[0]]) });
        html += cell(c, r + 2, inner ? rw[0] : 'empty', inner);
      });
    });
    // Desktop: the row's day-total badge once, under its label.
    ROWS.forEach(function (rw, r) { html += cell(1, r + 2, 'label', esc(rw[1]) + (tot[rw[0]] ? badge(rw[1], tot[rw[0]]) : '')); });
    $('#meals').innerHTML = '<div class="day-grid">' + html + '</div>';
  }

  // One select for a slot's picker row ('' if the slot has no such row); option labels show today's amounts
  // (cardio doubles the dinner carb). The inline label only shows on narrow screens. `clash`: row ids that must not
  // share this meal but do (shown red).
  // `t`: the row's day total { st, badge }; shown (badge, over/under tint) only where this meal has a pick or a non-none default.
  function pickerHtml(s, rowId, clash, t) {
    var r = (PLAN.pickers[s] || []).find(function (x) { return x.id === rowId; });
    if (!r) return '';
    var cur = MealEngine.pickOf(currentBase(), s, r, dayType), bad = clash && clash.indexOf(r.id) >= 0;
    var show = t && (cur !== '' || MealEngine.defOf(r, dayType) !== '');
    var title = bad ? PLAN.pickers[s].filter(function (x) { return clash.indexOf(x.id) >= 0; }).map(function (x) { return x.label; }).join(' and ') + ' in the same meal' : r.label;
    return '<label class="pick-row"><span>' + esc(r.label) + (show ? t.badge : '') + '</span><select data-pick-slot="' + s + '" data-pick-row="' + r.id + '" title="' + esc(title) + '" class="' + (bad ? 'clash' : show ? t.st : '') + '">' +
      (r.required ? '' : '<option value=""' + (cur ? '' : ' selected') + '>none</option>') + Object.keys(r.sets).map(function (opt) {
        return '<option value="' + opt + '"' + (opt === cur ? ' selected' : '') + '>' + esc(itemText(MealEngine.optionItems(r, opt, dayType))) + '</option>';
      }).join('') + '</select></label>';
  }

  $('#daytype').onclick = function (e) {
    var t = e.target.dataset.type;
    if (!t || t === dayType) return;
    dayType = t; store.set('lastType', t); draft.base = MealEngine.resetPicks(currentBase()); saveDraft(); renderToday();
  };
  // New day: random picks on plan for the current day type, avoiding the last accepted day's picks.
  $('#regen').onclick = function () {
    var prev = Object.keys(history).filter(function (d) { return d < today; }).sort().pop();
    draft.base = MealEngine.shuffleDay(dayType, ctx({ prev: history[prev] })); saveDraft(); renderToday();
  };
  $('#accept').onclick = function () {
    history[today] = currentView(); store.set('history', history); renderToday();
  };
  $('#meals').onchange = function (e) {
    var t = e.target.dataset;
    if (t.pickSlot) edit(MealEngine.setPick(currentBase(), t.pickSlot, t.pickRow, e.target.value));
    else if (t.fruitSlot) edit(MealEngine.setFruit(currentBase(), t.fruitSlot, e.target.value));
  };
  function edit(base) { draft.base = base; saveDraft(); renderToday(); }

  // ---------- Plan reference ----------
  function renderPlan() {
    var T = PLAN.dayTypes, row = function (cells, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    };
    var head = function (first) {
      return '<tr><th>' + first + '</th>' + TYPES.map(function (t) { return '<th class="n">' + TYPE_LABEL[t] + '</th>'; }).join('') + '</tr>';
    };
    var base = T.gym;
    var defItems = function (rw, t) { var d = MealEngine.defOf(rw, t); return d ? MealEngine.optionItems(rw, d, t) : {}; };

    // 1. Targets
    var targets = '<div class="card"><h2>Daily targets</h2><table>' +
      '<tr><th></th><th class="n">kcal</th><th class="n">Protein</th><th class="n">Carbs</th><th class="n">Fat</th></tr>' +
      TYPES.map(function (t) { var g = T[t].target; return row([TYPE_LABEL[t], g.kcal, g.p + 'g', g.c + 'g', g.f + 'g']); }).join('') +
      '</table><p class="muted tiny">' + esc(PLAN.source) + '. ' + esc(PLAN.notes.join(' ')) + '</p></div>';

    // 2. Every day: fixed items common to all day types, fruit, and each slot's default picks
    var everyFixed = base.fixed.filter(function (f) { return TYPES.every(function (t) { return T[t].fixed.some(function (x) { return x.id === f.id; }); }); });
    var every = '<div class="card"><h2>Every day</h2><table class="kv">' +
      everyFixed.map(function (f) {
        var sl = PLAN.slots.find(function (x) { return x.id === f.slot; });
        return row(['<b>' + esc(f.name) + '</b> <span class="muted">' + esc(sl.label.toLowerCase()) + '</span>', esc(itemText(f.items))]);
      }).join('') +
      row(['<b>Fruit</b> <span class="muted">two different, eaten separately</span>', esc(MealEngine.fmtQty(FOODS.apple, PLAN.fruitUnits / PLAN.fruitSlots.length)) +
        ' each at ' + esc(PLAN.fruitSlots.join(' and '))]) +
      '<tr><td colspan="2" class="muted tiny">Default picks (change them on Today; each swaps within its group):</td></tr>' +
      PLAN.slots.filter(function (sl) { return PLAN.pickers[sl.id]; }).map(function (sl) {
        return row(['<b>' + esc(sl.label) + '</b>', esc(PLAN.pickers[sl.id].filter(function (rw) { return rw.def; }).map(function (rw) { return itemText(defItems(rw, 'rest')); }).join(' + '))]);
      }).join('') + '</table></div>';

    // 3. Differences by day type (only what changes)
    var varying = {};
    TYPES.forEach(function (t) { T[t].fixed.forEach(function (f) { if (!everyFixed.some(function (x) { return x.id === f.id; })) varying[f.id] = f; }); });
    var diffs = '<div class="card"><h2>Differences by day type</h2><table>' + head('') +
      Object.keys(varying).map(function (id) {
        var f = varying[id];
        return row(['<b>' + esc(f.name) + '</b> <span class="muted">' + esc(itemText(f.items)) + '</span>']
          .concat(TYPES.map(function (t) { return T[t].fixed.some(function (x) { return x.id === id; }) ? '✓' : '<span class="muted">–</span>'; })));
      }).join('') +
      PLAN.slots.map(function (sl) {
        return (PLAN.pickers[sl.id] || []).filter(function (rw) { return rw.cardio || rw.defByType; }).map(function (rw) {
          return row(['<b>' + esc(sl.label + ' ' + rw.label.toLowerCase()) + '</b> <span class="muted">default pick</span>']
            .concat(TYPES.map(function (t) { return esc(itemText(defItems(rw, t))) || '<span class="muted">–</span>'; })));
        }).join('');
      }).join('') + '</table></div>';

    // 4. Swap groups (once); 5. guidelines
    var groups = '<div class="card"><h2>Swap groups <span class="muted tiny">1 unit swaps for 1 unit within a group</span></h2>' +
      SUB_GROUPS.filter(function (g) { return !g.fixed || g.id === 'F'; }).map(function (g) {
        if (g.id === 'F') g = Object.assign({}, g, { items: PLAN.fruitChoices });
        var same = g.items.every(function (id) { return FOODS[id].qty === FOODS[g.items[0]].qty && FOODS[id].unit === FOODS[g.items[0]].unit; });
        return '<div class="group"><b>' + esc(g.name) + '</b>' + (same ? '<span class="muted tiny">' + esc(MealEngine.fmtQty(FOODS[g.items[0]], 1)) + ' each:</span>' : '') +
          g.items.map(function (id) {
            return '<span class="chip">' + esc(same ? short(FOODS[id]).toLowerCase() : qtyName(id, 1)) + '</span>';
          }).join('') + (g.note ? '<span class="muted tiny">' + esc(g.note) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
    var guide = '<div class="card"><h2>Guidelines</h2><ul class="tight">' +
      [GUIDELINES.diet].concat(GUIDELINES.rules).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

    // Original PDF, merged into one table with a column per day type.
    var orderIds = [], byType = {};
    TYPES.forEach(function (t) {
      byType[t] = {};
      T[t].pdfMeals.forEach(function (m) { byType[t][m.id] = m; if (orderIds.indexOf(m.id) < 0) orderIds.push(m.id); });
    });
    var pdf = '<details class="card"><summary><b>Original nutritionist plan</b> <span class="muted tiny">(as printed, per meal)</span></summary>' +
      '<div class="scroll"><table>' + head('Item') + orderIds.map(function (id) {
        var label = TYPES.map(function (t) { return byType[t][id]; }).filter(Boolean)[0].label, names = [];
        TYPES.forEach(function (t) { var m = byType[t][id]; if (m) m.original.forEach(function (r) { if (names.indexOf(r[0]) < 0) names.push(r[0]); }); });
        return '<tr><td colspan="4"><b>' + esc(label) + '</b></td></tr>' + names.map(function (n) {
          return row([esc(n)].concat(TYPES.map(function (t) {
            var m = byType[t][id], r = m && m.original.find(function (x) { return x[0] === n; });
            return r ? esc(r[1]) : '<span class="muted">–</span>';
          })));
        }).join('') + row(['<span class="muted">kcal</span>'].concat(TYPES.map(function (t) { var m = byType[t][id]; return m ? m.total[0] : '<span class="muted">–</span>'; })), 'sub');
      }).join('') + row(['Day total kcal'].concat(TYPES.map(function (t) { return T[t].target.kcal; })), 'total') + '</table></div></details>';

    $('#plan').innerHTML = '<div class="plan-grid"><div>' + targets + diffs + every + '</div><div>' + groups + guide + pdf + '</div></div>';
  }

  // ---------- History ----------
  // "Tue, 3 Nov 2026"
  var fmtDate = function (iso) {
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short' }) + ', ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  function renderHistory() {
    var dates = Object.keys(history).sort().reverse();
    $('#history').innerHTML = (dates.length ? '' : '<p class="muted">No accepted plans yet. Accept a plan on the Today tab to start building variety history.</p>') +
      dates.map(function (dt) {
        var d = history[dt], m = MealEngine.dayMacros(d, FOODS), fr = MealEngine.fruitParts(d);
        // Per meal: picks then fruit, without the 10ml oil; fixed items (shake, pre-workout) are left out. Old entries:
        // a fruit or dish without a slot goes on its own line.
        var parts = d.dishes.concat(fr), lines = PLAN.slots.map(function (sl) { return [sl.label, parts.filter(function (p) { return p.slot === sl.id; })]; })
          .concat([['Other', parts.filter(function (p) { return !PLAN.slots.some(function (sl) { return sl.id === p.slot; }); })]]);
        var text = function (p) {
          var items = Object.assign({}, p.items); delete items.oil;
          return p.row || p.dishId && /^fruit-/.test(p.dishId) ? itemText(items) : p.name;
        };
        return '<div class="card"><div class="meal-head"><h2>' + esc(fmtDate(dt)) + ' · ' + esc(TYPE_LABEL[d.dayType] || d.dayType) + '</h2><span class="muted">' + macroLine(m) + '</span></div><ul class="items">' +
          lines.filter(function (l) { return l[1].length; }).map(function (l) {
            return '<li><span>' + esc(l[0]) + '</span><span>' + esc(l[1].map(text).filter(Boolean).join(' · ')) + '</span></li>';
          }).join('') + '</ul><button class="ghost small danger" data-del="' + esc(dt) + '">Remove</button></div>';
      }).join('') + (dates.length ? '<button id="clear-history" class="ghost danger">Clear all history</button>' : '');
  }
  $('#history').onclick = function (e) {
    if (e.target.dataset.del) delete history[e.target.dataset.del];
    else if (e.target.id === 'clear-history' && confirm('Clear all history?')) history = {};
    else return;
    store.set('history', history); renderHistory();
  };

  renderToday();
})();
