# Meal Planner

A personal daily meal-planning page built on my nutritionist's plan (LevelUp with Lalitha, 25 Aug 2026). Each day you get **one plan**, and you can switch the day type (**Rest / Gym / Cardio**) at any time, even after eating a couple of meals:

- **Fixed meal slots**, the same every day: **Breakfast, Lunch, Pre-workout, Post-workout / Snack, Dinner**.
- **Breakfast, lunch and dinner are pickers** laid out as a grid (one row per component, lined up across meals; on phones and narrow screens it becomes one list per meal, with the day type and meters stuck to the top, New day / Accept in a bar at the bottom, and thumb-sized 44px controls): one dropdown per cell (with a **none** option, except dinner Dal and dinner Veg, which are always 1 unit, and the fixed rows: breakfast carb and the proteins), so you can match the targets yourself. The calorie/macro meters (and each slot's own total) update as you pick. Cooking fat is not a row: every breakfast, lunch and dinner counts a fixed 10ml oil (ghee/butter/olive oil are the same macros) in its totals and the day meters (`mealFat` in `data/plan.js`):

  | Row | Options | Breakfast | Lunch | Dinner |
  |---|---|---|---|---|
  | Protein 1 | 4 egg whites · 100g Skyr / Greek yogurt · 2 egg whites · 50g Skyr / Greek yogurt (these two = half a unit); fixed at breakfast (2 egg whites) and dinner (50g Skyr), no other option but none; lunch optional | 2 egg whites | none | 50g Skyr |
  | Protein 2 | 2 whole eggs · 50g paneer (one meal a day; fixed at lunch: 2 whole eggs, no other option but none; no row at dinner) | none | 2 whole eggs | — |
  | Carb | 1 unit = 30g rice/oats/atta…, 40g bread, 100g potato…; breakfast: fixed at 50g whole-wheat bread (no other option); lunch: dalia, potato, atta, dosa/idli batter, quinoa or sooji (no rice); dinner: white rice, dalia, potato, quinoa or sooji only | 50g bread | 50g atta (≈1.7 rotis) | 30g white rice (60g on cardio) |
  | Veg | 100g of: mushroom, broccoli, cauliflower, carrots, onions, beans, bottle gourd (lauki), bitter gourd (karela), ladies finger (bhindi), methi leaves, tori, capsicum, pumpkin; lunch and dinner only (no veg at breakfast); dinner always 1 (no none) | – | beans | bottle gourd (lauki) |
  | Dal | any dal / legume, 40g raw (dinner only, always 1) | – | – | moong dal |
  | Nuts | 10g each: mixed nuts · almonds · peanuts · walnuts · cashews · pistachios | gym/cardio: 10g mixed nuts; rest: none | none | none |

  A small badge shows the day total for Protein 1, Protein 2, Carb, Veg and Nuts in exchange units, picked / plan (e.g. Protein 1 1 / 1, Veg 2 / 2, Carb 3.92 / 3.92; Protein 2 counts 1 egg or 25g paneer as 1 unit, so 2 eggs or 50g paneer = 2 / 2). Fruit is a fixed amount, so it has none; Dal is dinner only (always 1 unit, no none), so it has no total either. Nuts are planned on gym and cardio days only (the PDF's post-workout 10g): Nuts 1 / 1 there, 0 / 0 on rest. The badge sits under the row label on desktop (once per row) and under the label in each meal on phones, only where that meal has a pick or a non-none default. It turns red when over and amber when under, and so does the select (again only where that meal has a pick or a non-none default); it never blocks. On phones the sticky top bar lists the off-plan rows (e.g. "Off plan: Nuts +1"), hidden when everything is on plan. A meal shouldn't have both Protein 1 and Protein 2: if you pick both, the two dropdowns turn red (tooltip "Protein 1 and Protein 2 in the same meal"), again without blocking; the defaults never do it, and neither protein arrangement the shuffle uses does either. Lunch and dinner have veg (plan: Veg 2; breakfast has no veg row); dinner's is required, lunch's stays optional on Today but the shuffle always sets it. The carb amount is the slot's PDF amount (dinner doubles on cardio days, the PDF's second roti). Defaults follow the plan with my changes: the 2 whole eggs move from breakfast to lunch, the dal moves from lunch to dinner, the gym/cardio post-workout nuts move to breakfast, the lunch rice becomes 50g atta, the dinner roti becomes 30g white rice (no eggs or atta at dinner), and the dinner Skyr becomes 50g (half the plan's 100g); Protein 1 (2 egg whites at breakfast, 50g Skyr at dinner) and Protein 2 (2 eggs at lunch) are the usual arrangement. **New day** picks it or the swap about 50/50: breakfast 50g paneer (Protein 2, with the bread) and lunch 2 egg whites (Protein 1), dinner unchanged; both keep Protein 1 1 / 1 and Protein 2 2 / 2 with no clash. Each can still be set to none, which just leaves that day total under plan (amber).
- **Fixed items** by day type: protein shake, 1 scoop (30g whey; post-workout / snack) every day; 100g banana + 2 dates (pre-workout) on gym and cardio days; Fast&Up electrolyte (pre-workout, sip during) on cardio days. They are not shown on Today (no Pre-workout or Post-workout / Snack column) but still count in the day's meters; the Plan tab lists them.
- **Fruit**, eaten separately: a fixed **250g every day** as two different fruits from the PDF list (apple, orange, melons, berries, papaya, kiwi, pineapple, peach, mango, guava, grapes): 125g at breakfast and 125g at dinner. Each rotates day to day on its own, and you can change either with its dropdown, styled like the other pickers (e.g. "125g apple"; the other slot's fruit is left out, no none). Banana would count at half quantity.

The plan was later updated from the PDF: breakfast whey removed and dinner Skyr 150g → 100g (targets lowered by the same amounts). With the default picks rest (1381 kcal, target 1392) and gym (1576 kcal, target 1587) days are 11 kcal under their targets (2 egg whites + 50g Skyr instead of 2 eggs + 100g Skyr; lunch atta and dinner rice instead of the PDF's rice and roti). Cardio days come to about 1686 kcal (target 1737): the electrolyte replaces the PDF's 73-kcal Tang, and fruit is 250g instead of 200g.

No install, no build step, no internet needed.

## Open it
Double-click `index.html`. It opens in any modern browser, on desktop or mobile.

- **Today**: the whole day on one laptop screen, one column per picker meal (breakfast, lunch, dinner) and one row per component (Protein 1, Protein 2, Carb, Veg, Nuts, Dal, Fruit). Flip **Rest / Gym / Cardio** at any time; switching resets the picks to that type's defaults (manual picks are discarded, fruit stays), so every row total is on plan. Your last choice is remembered, and the default is Rest. A new day opens with the default picks; **New day** shuffles them: a random food in every picker and a random spread across meals (where gym-cardio nuts go; the proteins follow the usual or swap arrangement; the breakfast carb and veg meals are fixed), always keeping every row's day total on plan for the current day type (dinner dal stays 1, carb amounts stay per meal, only the food changes), avoiding the last accepted day's picks where possible, plus two new fruits. Protein 1 and Protein 2 never land in the same meal. Calories vary a little with the foods (about 1300–1390 rest, 1490–1580 gym, 1620–1705 cardio). **Accept** saves the day (with your picks) to history with the day type you finally picked.
- **Plan**: a one-screen reference with the targets per day type, what's the same every day (shake, fruit and each slot's default picks), only what differs by day type, swap groups and guidelines. The original nutritionist plan is collapsed into one table with a column per day type.
- **History**: the days you accepted, newest first: the date ("Tue, 3 Nov 2026") and day type, the day's kcal and macros, then one line per meal (Breakfast, Lunch, Dinner) listing its picks and fruit; the 10ml oil, shake and pre-workout items are left out. Older saved entries still render (anything without a meal goes on an "Other" line).

## Swap groups
**Swap groups** are in `SUB_GROUPS` in `data/substitutions.js`. Every item in a group swaps 1:1 with every other item in it; the pickers list a row's group as its options:

| Group | Interchangeable items (1 unit each) |
|---|---|
| P Protein | 30g (1 scoop) whey · 4 egg whites · 100g Skyr / high-protein Greek yogurt |
| C Carbs | 30g raw rice · 30g oats · 30g poha · 30g dalia · 100g potato · 40g bread · 30g wheat flour (atta) · 80g dosa/idli batter · 30g brown rice · 30g quinoa · 30g sooji |
| E Egg | 1 whole egg · 25g paneer |
| L Dal | 40g raw dal / rajma / chana / chole / besan |
| V Veg | 100g veg (no avocado, coconut, peas, corn, beetroot, potato, spinach, zucchini, cucumber, drumstick) |
| O Fat | 10ml oil · ghee · butter · olive oil |
| F Fruit | 100g fruit · 50g banana (only for the separate fruit item) |

Fruit and nuts are `fixed` groups, not meal exchanges: fruit is its own daily item and nuts their own picker row (not listed under swap groups on the Plan page).

The pickers are `pickers` in `data/plan.js`: per slot, a list of rows `{ id, label, sets: { option: { food: units } }, def }` (`def: ''` = none; `cardio: 2` doubles the row on cardio days).

## Files
- `data/plan.js`: day types, targets, meal slots, fixed items (each in a slot), the pickers and their defaults, fruit, and the original PDF meals
- `data/substitutions.js`: substitution matrix, exchange units, foods and guidelines
- `engine.js`: the day builder (pure JS)
- `app.js`, `index.html`, `styles.css`: the user interface
- `test/test.js`: run `node test/test.js`. It checks:
  - swap groups: no nuts or non-veg foods, no cheese, Skyr is a protein swap
  - every picker option uses allowed foods in practical amounts (whole eggs, whole egg whites), the protein options are exactly as listed above, and the fixed protein rows have only their default (plus none)
  - default picks give the structure above for rest, gym and cardio (only the dinner carb changes on cardio), fixed items are in their slots
  - fruit: two different 125g fruits, each rotating (never the same slot fruit two days running) and swappable on its own
  - row totals: the defaults match the plan for every day type (veg 2, cardio carb +1), and totals follow the picks; dinner Dal and Veg have no none, a fixed 10ml oil per meal (saved fat picks ignored); nuts default at breakfast on gym/cardio only, and an explicit nuts pick holds on every day type
  - changing a pick changes only that row and the macros by exactly the difference; none removes it
  - switching day types back and forth gives an identical plan and never changes the base
  - shuffled days (New day): every row total on plan for each day type, dal only at dinner, veg always at lunch and dinner, two different fruits, never Protein 1 and 2 in one meal (defaults neither; a manual clash is flagged), no eggs at dinner, only each meal's allowed carbs, varied picks that avoid the previous day's
