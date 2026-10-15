(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var r0 = function (n) { return Math.round(n); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mp.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del: function (k) { try { localStorage.removeItem('mp.' + k); } catch (e) { /* ignore */ } },
  };

  var TYPES = ['rest', 'gym', 'cardio'];
  var TYPE_LABEL = { rest: 'Rest', cardio: 'Cardio', gym: 'Gym' };
  var today = new Date().toLocaleDateString('en-CA');
  var knownFoods = function (items) { return Object.keys(items || {}).every(function (id) { return FOODS[id]; }); };

  var dishes = store.get('dishes', null) || DISHES;
  var history = store.get('history', {});

  // One draft per day: a base plan (flat dish list + chosen cardio-carb dish) shared by every day type, plus the chosen type.
  // Older drafts (per-type plans) or drafts built on a different pool are dropped and regenerated.
  var poolSig = JSON.stringify(TYPES.map(function (t) { return PLAN.dayTypes[t].pool; }));
  var draft = store.get('draft', {});
  var draftOk = draft && draft.v === 6 && draft.date === today && draft.poolSig === poolSig && draft.base &&
    Array.isArray(draft.base.dishes) && draft.base.dishes.every(function (x) { return knownFoods(x.items); });
  if (!draftOk) draft = { v: 6, date: today, poolSig: poolSig, base: null, seen: {} };
  var dayType = store.get('lastType', 'rest');
  if (!PLAN.dayTypes[dayType]) dayType = 'rest';

  function ctx(extra) {
    return Object.assign({ plan: PLAN, foods: FOODS, dishes: dishes, history: history, date: today }, extra);
  }
  var dishById = function (id) { return dishes.find(function (d) { return d.id === id; }); };

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
  var renderers = { today: renderToday, dishes: renderDishes, plan: renderPlan, history: renderHistory };
  $('#tabs').onclick = function (e) {
    var tab = e.target.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b === e.target); });
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== tab; });
    renderers[tab]();
  };

  // ---------- Today ----------
  function currentBase() {
    if (!draft.base) { draft.base = MealEngine.generateDay(ctx()); draft.seen = {}; saveDraft(); }
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
  var itemText = function (items) {
    return Object.keys(items).filter(function (id) { return FOODS[id]; }).map(function (id) { return qtyName(id, items[id]); }).join(' + ');
  };
  var FIXED_LABEL = { 'fixed-shake': 'Shake', 'fixed-skyr': 'Skyr', 'fixed-pre': 'Pre-workout', 'fixed-intra': 'Intra', 'fixed-nuts': 'Nuts' };

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
    var fruitId = Object.keys(day.fruit.items)[0], isCardio = dayType === 'cardio';
    $('#meals').innerHTML =
      '<div class="chips today-chips">' + day.fixed.map(function (p) {
        return '<span class="chip" title="' + esc(p.method || '') + '"><b>' + esc(FIXED_LABEL[p.dishId] || p.name) + '</b> ' + esc(itemText(p.items)) + '</span>';
      }).join('') +
      '<span class="chip"><b>Fruit</b> ' + esc(MealEngine.fmtQty(FOODS[fruitId], day.fruit.items[fruitId])) +
        ' <select data-fruit-pick="1" aria-label="Fruit">' + PLAN.fruitChoices.map(function (id) {
          return '<option value="' + id + '"' + (id === fruitId ? ' selected' : '') + '>' + esc(FOODS[id].name.toLowerCase()) + '</option>';
        }).join('') + '</select><button class="icon" data-fruit-swap="1" title="Another fruit">↻</button></span></div>' +
      '<div class="dish-grid">' + day.dishes.map(function (p, i) {
        var opts = MealEngine.swapOptions(currentBase(), i, ctx()).map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (d.id === p.dishId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
        }).join('');
        if (opts.indexOf('selected') < 0) opts = '<option selected>' + esc(p.name) + '</option>' + opts;
        var hasCarb = Object.keys(p.items).some(function (id) { return FOODS[id] && FOODS[id].cat === 'C'; });
        // The cardio-carb selector only exists on cardio days; the stored choice is kept for when cardio comes back.
        return '<div class="card meal' + (isCardio && p.cardio ? ' cardio' : '') + '">' +
          '<div class="pick"><select data-pick="' + i + '" aria-label="Dish">' + opts + '</select>' +
          '<button class="icon" data-swap="' + i + '" title="Swap dish">↻</button>' +
          '<button class="icon" data-remove="' + i + '" title="Remove dish">✕</button></div>' +
          '<div class="muted tiny">' + macroLine(MealEngine.macros(p.items, FOODS)) + '</div>' +
          renderPart(p) +
          (isCardio && hasCarb ? '<label class="cardio-pick" title="This dish gets the extra carb unit today"><input type="radio" name="cardio-carb" data-cardio="' +
            esc(p.dishId) + '"' + (p.cardio ? ' checked' : '') + '> cardio carb</label>' : '') +
          '</div>';
      }).join('') +
      '<div class="card meal add-card"><input list="add-list" data-add="1" placeholder="+ Add dish…" aria-label="Add dish">' +
        '<datalist id="add-list">' + MealEngine.addOptions(currentBase(), ctx()).map(function (d) {
          return '<option value="' + esc(d.name) + '">';
        }).join('') + '</datalist><div class="muted tiny">Others in the same categories shrink to make room.</div></div>' +
      '</div>' + gapsHtml(day);
  }

  // Unallocated / over-pool chips (after manual add/remove), with one-click dishes to fill a gap.
  var EQUIV = { C: 'rice', E: 'egg', P: 'whey', L: 'toor_dal', V: 'mixed_veg', O: 'oil' };
  function gapText(c, u) {
    var name = (GROUPS[c] ? GROUPS[c].name.split(' /')[0] : c).toLowerCase(), f = FOODS[EQUIV[c]];
    return r1(u) + ' ' + name + ' unit' + (u === 1 ? '' : 's') + (f ? ' (≈ ' + qtyName(EQUIV[c], u) + ')' : '');
  }
  function gapsHtml(day) {
    var ua = day.unallocated || {}, ov = day.over || {};
    var rows = Object.keys(ua).filter(function (c) { return ua[c] > 1e-6; }).map(function (c) {
      return '<span class="chip warn"><b>Unallocated</b> ' + esc(gapText(c, ua[c])) + ' · add: ' +
        MealEngine.suggestFor(currentBase(), c, ctx(), 3).map(function (d) {
          return '<button class="link" data-add-id="' + esc(d.id) + '">' + esc(d.name) + '</button>';
        }).join(' · ') + '</span>';
    }).concat(Object.keys(ov).filter(function (c) { return ov[c] > 1e-6; }).map(function (c) {
      return '<span class="chip warn"><b>Over by</b> ' + esc(gapText(c, ov[c])) + '</span>';
    }));
    return rows.length ? '<div class="chips gaps">' + rows.join('') + '</div>' : '';
  }

  function renderPart(p) {
    var how = [p.method, p.extras ? 'Free: ' + p.extras : ''].filter(Boolean).join(' · ');
    return '<div class="part"><ul class="items">' + Object.keys(p.items).filter(function (id) { return FOODS[id]; }).map(function (id) {
        var f = FOODS[id];
        return '<li><span>' + esc(short(f)) + '</span><span>' + esc(MealEngine.fmtQty(f, p.items[id])) + '</span></li>';
      }).join('') + '</ul>' +
      (how ? '<details><summary>How</summary><div class="muted tiny">' + esc(how) + '</div></details>' : '') + '</div>';
  }

  $('#daytype').onclick = function (e) {
    if (!e.target.dataset.type) return;
    dayType = e.target.dataset.type; store.set('lastType', dayType); renderToday();
  };
  $('#regen').onclick = function () { draft.base = null; renderToday(); };
  $('#accept').onclick = function () {
    history[today] = currentView(); store.set('history', history); renderToday();
  };
  $('#meals').onclick = function (e) {
    var i = e.target.dataset.swap;
    if (i != null) swap(+i);
    else if (e.target.dataset.remove != null) edit(MealEngine.removeDish(currentBase(), +e.target.dataset.remove, ctx()));
    else if (e.target.dataset.addId) edit(MealEngine.addDish(currentBase(), e.target.dataset.addId, ctx()));
    else if (e.target.dataset.fruitSwap) swapFruit();
    else if (e.target.dataset.cardio != null) {
      draft.base = MealEngine.setCardioDish(currentBase(), e.target.dataset.cardio); saveDraft(); renderToday();
    }
  };
  $('#meals').onchange = function (e) {
    var i = e.target.dataset.pick;
    if (i != null) swap(+i, e.target.value);
    else if (e.target.dataset.add) {
      var d = dishes.find(function (x) { return x.name === e.target.value; });
      if (d) edit(MealEngine.addDish(currentBase(), d.id, ctx()));
    }
    else if (e.target.dataset.fruitPick) swapFruit(e.target.value);
  };
  function edit(base) { draft.base = base; saveDraft(); renderToday(); }
  function swapFruit(forceId) {
    var base = currentBase(), list = draft.seen.fruit = draft.seen.fruit || [];
    if (list.indexOf(base.fruit) < 0) list.push(base.fruit);
    if (list.length >= PLAN.fruitChoices.length - 1) list.length = 0;
    draft.base = MealEngine.swapFruit(base, ctx({ seen: list, forceId: forceId }));
    saveDraft(); renderToday();
  }
  function swap(i, forceId) {
    var base = currentBase(), list = draft.seen[i] = draft.seen[i] || [];
    if (list.indexOf(base.dishes[i].dishId) < 0) list.push(base.dishes[i].dishId);
    // Once nearly every option has been shown here, start the cycle again.
    if (list.length >= MealEngine.swapOptions(base, i, ctx()).length - 1) list.length = 0;
    draft.base = MealEngine.swapDish(base, i, ctx({ seen: list, forceId: forceId }));
    saveDraft(); renderToday();
  }

  // ---------- Dishes ----------
  $('#dish-common').onchange = $('#dish-q').oninput = renderDishes;

  function saveDishes(list) { dishes = list; store.set('dishes', list); draft.base = null; draft.seen = {}; saveDraft(); }

  // Board columns: the default cuisines, any used by a dish, plus empty ones the user created (saved in the browser).
  var BASE_CUISINES = ['North Indian', 'South Indian', 'Continental', 'Basics'];
  function cuisines() {
    var list = BASE_CUISINES.concat(store.get('cuisines', []));
    dishes.forEach(function (d) { if (d.cuisine && list.indexOf(d.cuisine) < 0) list.push(d.cuisine); });
    return list;
  }
  function newCuisine() {
    var name = (prompt('New cuisine name (e.g. Indo-Chinese)') || '').trim();
    if (!name) return null;
    var extra = store.get('cuisines', []);
    if (cuisines().indexOf(name) < 0) { extra.push(name); store.set('cuisines', extra); }
    return name;
  }

  function renderDishes() {
    var common = $('#dish-common').checked, q = $('#dish-q').value.toLowerCase();
    var list = dishes.filter(function (d) {
      return (!common || d.common) &&
        (!q || (d.name + ' ' + d.cuisine + ' ' + Object.keys(d.items).map(function (id) { return FOODS[id] ? FOODS[id].name : id; }).join(' ')).toLowerCase().indexOf(q) >= 0);
    });
    $('#dish-meta').textContent = list.length + ' of ' + dishes.length + ' dishes' +
      (store.get('dishes', null) ? ' · customised (saved in this browser)' : ' · from data/dishes.js');
    $('#dish-list').innerHTML = cuisines().map(function (cu) {
      var col = list.filter(function (d) { return d.cuisine === cu; });
      return '<div class="col"><div class="col-head"><h3>' + esc(cu) + ' <span class="muted tiny">' + col.length + '</span></h3>' +
        '<button class="ghost small" data-new-in="' + esc(cu) + '">+ Add</button></div>' +
        col.map(function (d) {
          return '<div class="card dish-card" data-id="' + esc(d.id) + '"><b>' + esc(d.name) + '</b>' + (d.common ? '<span class="tag">common</span>' : '') +
            '<div class="muted tiny">' + esc(Object.keys(d.items).map(function (id) { return FOODS[id] ? short(FOODS[id]).toLowerCase() : id; }).join(', ')) + '</div></div>';
        }).join('') + '</div>';
    }).join('') + '<div class="col col-new"><button class="ghost" data-new-cuisine="1">+ New cuisine</button></div>';
  }
  $('#dish-list').onclick = function (e) {
    if (e.target.dataset.newIn) return openDish(null, e.target.dataset.newIn);
    if (e.target.dataset.newCuisine) { if (newCuisine()) renderDishes(); return; }
    var c = e.target.closest('[data-id]');
    if (c) openDish(dishById(c.dataset.id));
  };
  $('#dish-add').onclick = function () { openDish(null, BASE_CUISINES[0]); };

  var foodOptions = SUB_GROUPS.filter(function (g) { return !g.fixed; }).map(function (g) {
    return '<optgroup label="' + esc(g.id + ' · ' + g.name) + '">' + g.items.map(function (id) {
      return '<option value="' + id + '">' + esc(FOODS[id].name + ' (' + FOODS[id].qty + ' ' + FOODS[id].unit + '/unit)') + '</option>';
    }).join('') + '</optgroup>';
  }).join('');

  var editing = null;
  function itemRow(id, amt) {
    var row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = '<select>' + foodOptions + '</select><input type="number" min="0.05" step="0.05" value="' + (amt || 1) +
      '"><button type="button" class="ghost" title="Remove">×</button>';
    if (id) row.querySelector('select').value = id;
    row.querySelector('button').onclick = function () { row.remove(); };
    $('#f-items').appendChild(row);
  }
  function cuisineSelect(value) {
    var f = $('#dish-form');
    f.cuisine.innerHTML = cuisines().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '<option value="__new">+ New cuisine…</option>';
    f.cuisine.value = value;
  }
  $('#dish-form').cuisine.onchange = function (e) {
    if (e.target.value !== '__new') return;
    var name = newCuisine();
    cuisineSelect(name || BASE_CUISINES[0]);
  };
  function openDish(d, cuisine) {
    editing = d;
    var f = $('#dish-form');
    cuisineSelect(d ? d.cuisine : cuisine || BASE_CUISINES[0]);
    $('#dish-form-title').textContent = d ? 'Edit dish' : 'New dish';
    f.name.value = d ? d.name : '';
    f.common.checked = !!(d && d.common);
    f.extras.value = d ? d.extras || '' : '';
    f.method.value = d ? d.method || '' : '';
    $('#f-items').innerHTML = '';
    if (d) Object.keys(d.items).forEach(function (id) { itemRow(id, d.items[id]); });
    else itemRow();
    $('#f-errors').textContent = '';
    $('#f-delete').hidden = !d;
    $('#dish-dialog').showModal();
  }
  $('#f-add-item').onclick = function () { itemRow(); };
  $('#f-cancel').onclick = function () { $('#dish-dialog').close(); };
  $('#f-delete').onclick = function () {
    if (!confirm('Delete "' + editing.name + '"?')) return;
    saveDishes(dishes.filter(function (d) { return d !== editing; }));
    $('#dish-dialog').close(); renderDishes();
  };
  $('#dish-form').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, items = {};
    f.querySelectorAll('.item-row').forEach(function (r) {
      var id = r.querySelector('select').value;
      items[id] = (items[id] || 0) + parseFloat(r.querySelector('input').value);
    });
    var slug = f.name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var d = {
      id: editing ? editing.id : slug + (dishById(slug) ? '-' + Date.now().toString(36) : ''),
      name: f.name.value.trim(), items: items, extras: f.extras.value.trim(), method: f.method.value.trim(),
    };
    d.cuisine = f.cuisine.value;
    if (f.common.checked) d.common = true;
    var errs = MealEngine.validate(d, FOODS, GUIDELINES);
    if (errs.length) { $('#f-errors').textContent = errs.join('\n'); return; }
    saveDishes(editing ? dishes.map(function (x) { return x === editing ? d : x; }) : dishes.concat(d));
    $('#dish-dialog').close(); renderDishes();
  };

  $('#dish-export').onclick = function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dishes, null, 2)], { type: 'application/json' }));
    a.download = 'dishes.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
  $('#dish-import').onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (txt) {
      var list = JSON.parse(txt);
      if (!Array.isArray(list)) throw new Error('expected a JSON array of dishes');
      var bad = [];
      list.forEach(function (d) {
        MealEngine.validate(d, FOODS, GUIDELINES).forEach(function (er) { bad.push((d.name || d.id) + ': ' + er); });
      });
      if (bad.length) throw new Error(bad.slice(0, 10).join('\n'));
      saveDishes(list); renderDishes(); alert('Imported ' + list.length + ' dishes.');
    }).catch(function (er) { alert('Import failed:\n' + er.message); });
    e.target.value = '';
  };
  $('#dish-reset').onclick = function () {
    if (!confirm('Discard your edits and reload dishes from data/dishes.js?')) return;
    saveDishes(DISHES); store.del('dishes'); renderDishes();
  };

  // ---------- Plan reference ----------
  function renderPlan() {
    var T = PLAN.dayTypes, row = function (cells, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    };
    var head = function (first) {
      return '<tr><th>' + first + '</th>' + TYPES.map(function (t) { return '<th class="n">' + TYPE_LABEL[t] + '</th>'; }).join('') + '</tr>';
    };
    var base = T[PLAN.baseType], cardioDelta = MealEngine.delta(PLAN, 'cardio');

    // 1. Targets
    var targets = '<div class="card"><h2>Daily targets</h2><table>' +
      '<tr><th></th><th class="n">kcal</th><th class="n">Protein</th><th class="n">Carbs</th><th class="n">Fat</th></tr>' +
      TYPES.map(function (t) { var g = T[t].target; return row([TYPE_LABEL[t], g.kcal, g.p + 'g', g.c + 'g', g.f + 'g']); }).join('') +
      '</table><p class="muted tiny">' + esc(PLAN.source) + '. ' + esc(PLAN.notes.join(' ')) + '</p></div>';

    // 2. Every day: shared meal pool + fixed items common to all day types
    var everyFixed = base.fixed.filter(function (f) { return TYPES.every(function (t) { return T[t].fixed.some(function (x) { return x.id === f.id; }); }); });
    var every = '<div class="card"><h2>Every day</h2><table class="kv">' +
      everyFixed.map(function (f) {
        return row(['<b>' + esc(FIXED_LABEL['fixed-' + f.id] || f.name) + '</b>', esc(itemText(f.items))]);
      }).join('') +
      '<tr><td colspan="2" class="muted tiny">The day\'s dishes share this pool:</td></tr>' +
      Object.keys(base.pool).map(function (c) {
        return row(['<b>' + esc(GROUPS[c].name.split(' /')[0]) + '</b> <span class="muted">' + r1(base.pool[c]) + ' u</span>',
          esc(Object.keys(base.poolFoods).filter(function (id) { return FOODS[id].cat === c; }).map(function (id) { return qtyName(id, base.poolFoods[id]); }).join(' + '))]);
      }).join('') + '</table></div>';

    // 3. Differences by day type (only what changes)
    var varying = {};
    TYPES.forEach(function (t) { T[t].fixed.forEach(function (f) { if (!everyFixed.some(function (x) { return x.id === f.id; })) varying[f.id] = f; }); });
    var diffs = '<div class="card"><h2>Differences by day type</h2><table>' + head('') +
      Object.keys(varying).map(function (id) {
        var f = varying[id];
        return row(['<b>' + esc(FIXED_LABEL['fixed-' + id] || f.name) + '</b> <span class="muted">' + esc(itemText(f.items)) + '</span>']
          .concat(TYPES.map(function (t) { return T[t].fixed.some(function (x) { return x.id === id; }) ? '✓' : '<span class="muted">–</span>'; })));
      }).join('') +
      row(['<b>Fruit</b> <span class="muted">one, eaten separately</span>'].concat(TYPES.map(function (t) { return MealEngine.fmtQty(FOODS.apple, T[t].fruitUnits); }))) +
      Object.keys(cardioDelta).map(function (c) {
        return row(['<b>Cardio carb</b> <span class="muted">one chosen dish, ' + esc(GROUPS[c].name.toLowerCase()) + '</span>'].concat(TYPES.map(function (t) {
          var d = MealEngine.delta(PLAN, t)[c];
          return d ? (d > 0 ? '+' : '') + r1(d) + ' unit' : '<span class="muted">–</span>';
        })));
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
  function renderHistory() {
    var dates = Object.keys(history).sort().reverse();
    $('#history').innerHTML = (dates.length ? '' : '<p class="muted">No accepted plans yet. Accept a plan on the Today tab to start building variety history.</p>') +
      dates.map(function (dt) {
        var d = history[dt], m = MealEngine.dayMacros(d, FOODS);
        return '<div class="card"><div class="meal-head"><h2>' + esc(dt) + ' · ' + esc(TYPE_LABEL[d.dayType] || d.dayType) + '</h2><span class="muted">' + macroLine(m) + '</span></div><ul class="items">' +
          '<li><span>Dishes</span><span>' + esc(d.dishes.map(function (p) { return p.name; }).join(', ')) + '</span></li>' + (d.fruit ? '<li><span>Fruit</span><span>' + esc(Object.keys(d.fruit.items).map(function (id) {
            return FOODS[id] ? FOODS[id].name + ' ' + MealEngine.fmtQty(FOODS[id], d.fruit.items[id]) : id;
          }).join('')) + '</span></li>' : '') + '</ul><button class="ghost small danger" data-del="' + esc(dt) + '">Remove</button></div>';
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
