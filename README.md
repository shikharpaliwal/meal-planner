# Meal Planner

A personal daily meal-planning page built on my nutritionist's plan (LevelUp with Lalitha, 25 Aug 2026). Each day you get **one plan**, and you can switch the day type (**Rest / Gym / Cardio**) at any time, even after eating a couple of meals:

- **Dishes**: a flat list of individual dishes, about 3–7 depending on what's picked, e.g. Dal tadka, Roti, Bhindi masala, Masala omelette, Whey shake. Together they use up the day's pool exactly, and you decide how to group and time them. Each card shows the dish, its ingredient quantities, and a swap control (dropdown + ↻). On cardio days, dishes with carbs also show a **cardio carb** selector; the chosen dish (by default the most carb-heavy one) gets the extra carb unit, shown as its final quantities. The choice is kept for the day.
- **Fixed items** follow the day type:
  - 1 protein shake (30g whey): every day
  - 150g Skyr / high-protein Greek yogurt: every day, never inside a dish
  - 100g banana + 2 dates: gym and cardio
  - 10g mixed nuts (any): gym and cardio
  - Fast&Up electrolyte: cardio only
- **Fruit**, eaten separately and never inside a dish: one fruit from the PDF list (apple, orange, melons, berries, papaya, kiwi, pineapple, peach, mango, guava, grapes). It's 250g on rest/gym days and 200g on cardio days. It rotates day to day, and you can change it with Swap or the dropdown. Banana and chikoo would count at half quantity.

All dishes are vegetarian + egg, with exact quantities. The page shows calories and macros against the plan's targets for the chosen day type, and rotates dishes so they don't repeat often.

No install, no build step, no internet needed.

## Open it
Double-click `index.html`. It opens in any modern browser, on desktop or mobile.

- **Today**: the whole day on one laptop screen, with the dishes as a grid of compact cards and the fixed items + fruit as chips. Flip **Rest / Gym / Cardio** at any time. Your last choice is remembered, and the default is Rest. Use ↻ or the dropdown to swap a dish, **New day** to reroll the whole day, and **Accept** to save it to history with the day type you finally picked. Dishes eaten recently get pushed down the list.
- **Dishes**: a board with one column per cuisine (North Indian, South Indian, Continental, Basics, plus any you create with **+ New cuisine**). Search filters across columns, **Common only** narrows to staples, and each column's **+ Add** opens the editor preset to that cuisine. Click a card to edit or delete it. Changes are saved in this browser (localStorage). Use **Export** and **Import** to move them as JSON, and **Reset** to go back to `data/dishes.js`.
- **Plan**: a one-screen reference with the targets per day type, what's the same every day (shake, Skyr and the shared dish pool), only what differs by day type, swap groups and guidelines. The original nutritionist plan is collapsed into one table with a column per day type.
- **History**: the days you accepted.

## How generation works
Everything in the PDF's meals except the fixed items is added up into a **daily pool** of exchange units. Fruit is not in the pool: it's the separate fruit item. Rest and gym pools are identical, and cardio only adds C +1, which goes to the chosen cardio-carb dish:

| Day | Pool (units) |
|---|---|
| Gym | P 1 · E 2 · O 3 · C 3.92 · L 1 · V 2 |
| Cardio | P 1 · E 2 · O 3 · C 4.92 · L 1 · V 2 |
| Rest | P 1 · E 2 · O 3 · C 3.92 · L 1 · V 2 |

**Swap groups** are in `SUB_GROUPS` in `data/substitutions.js`. Every item in a group swaps 1:1 with every other item in it:

| Group | Interchangeable items (1 unit each) |
|---|---|
| P Protein | 30g (1 scoop) whey · 6 egg whites |
| C Carbs | 30g raw rice · 30g oats · 30g poha · 30g dalia · 100g potato · 40g bread · 30g wheat flour (atta) · 80g dosa/idli batter · 30g brown rice · 30g quinoa · 30g sooji |
| E Egg | 1 whole egg · 25g paneer · 1 cheese slice |
| L Dal | 40g raw dal / rajma / chana / chole / besan |
| V Veg | 100g veg (no avocado, coconut, peas, corn, beetroot, potato) |
| O Fat | 10ml oil · ghee · butter · olive oil |
| F Fruit | 100g fruit · 50g banana/chikoo (only for the separate fruit item) |

Nuts, dates, electrolyte, fruit and Skyr are `fixed` groups: they are daily fixed items and never appear in dishes.

```js
{ id: 'E', name: 'Egg / paneer / cheese', source: 'Substitution matrix',
  items: ['egg', 'paneer', 'cheese'] }   // food ids from FOODS; one unit = that food's qty/unit
```

The generator works in four steps:
1. Dishes are generated **once per day** on the gym/rest pool.
2. It picks dishes at random, weighted by recency, until every pool category is covered and no dish would need more than 2× its normal serving. Sometimes it adds one more where servings are still large. A hearty dish covers several categories at once (bisi bele bath: dal + carb + veg + oil), while light items cover one (boiled eggs, toast, a bowl of dal). So the count varies day to day, usually 3–7. There are no duplicates on the same day.
3. It scales each category across the day so the totals match the pool exactly.
4. It tries 80 candidate days and keeps the best one. A candidate scores well when it gives variety (dishes eaten recently are penalised; **common** staples like roti, rice, boiled eggs and whey shake only count a quarter, so they can repeat), realistic servings (no dish below 0.5× or above 2× its usual size) and macros close to the PDF for every day type.

**Adding and removing.** ✕ removes a dish, and the remaining dishes in its categories absorb its share (each within 0.5–2× of a normal serving). Anything they can't absorb is shown as an **Unallocated** chip, e.g. "1 dal unit (≈ 40g toor dal)", with 2–3 one-click dishes to add; nothing is added silently. **+ Add dish** (searchable) adds a dish at one normal serving. Other dishes in the same categories shrink to make room, and any pushed below 0.5× is dropped and its share redistributed. If the new dish alone exceeds a category, it's shown as **Over by…** instead of hiding it. Whole eggs, whole egg whites and half-scoop whey steps apply throughout. If the cardio-carb dish is removed, the most carb-heavy remaining dish takes over.

Swapping a dish replaces it with any other dish. If the new dish covers less, dishes are added for whatever is missing. If it covers more, a dish it made redundant may be dropped. Then the quantities are re-split, so the count can change.

Switching the day type only re-scales the cardio-carb dish and changes the fixed items and the fruit amount. Choosing a different cardio-carb dish just moves the extra carbs. It never regenerates the plan, so switching back gives you the identical plan.

## Editing dishes
Each entry is **one dish**: "Upma", not "Upma with boiled eggs". Names with " + ", " & ", " with " or " and " are rejected; add the parts as separate dishes. Either use the **Dishes** tab or edit `data/dishes.js`:

```js
{
  id: 'dal-tadka',
  name: 'Dal tadka',
  cuisine: 'North Indian',          // Dishes-board column: North Indian | South Indian | Continental | Basics | your own
  common: false,                    // true = everyday staple (roti, rice, eggs): may repeat often
  items: { toor_dal: 1, ghee: 1 },  // foodId: exchange units for one normal serving
  extras: 'garlic, cumin',          // free aromatics, no macros counted
  method: 'One-line how-to.',
}
```

- Food ids come from `FOODS` in `data/substitutions.js`. Add a new food there, with its category and macros per unit, if you need one.
- Use realistic one-serving amounts so the scaling stays small.
- Nuts, fruit, skyr, dates and electrolyte are fixed daily items and can't be used in dishes.
- Ingredients come only from the vegetarian + egg food list. Banned vegetables are rejected when you save.

If you've edited dishes in the app, those browser copies take priority over `data/dishes.js`. Click **Reset** to load the file again. Editing dishes regenerates today's plan, but the history and rotation data are kept.

## Files
- `data/plan.js`: day types, targets, fixed items, the original PDF meals, and the derived pool
- `data/substitutions.js`: substitution matrix, exchange units, foods and guidelines
- `data/dishes.js`: the dish library
- `engine.js`: the generator (pure JS)
- `app.js`, `index.html`, `styles.css`: the user interface
- `test/test.js`: run `node test/test.js` to simulate 21 days, each viewed as rest, gym and cardio. It checks:
  - fixed items are present for each day type
  - only the chosen cardio-carb dish changes across day types, and day totals stay the same whichever dish is chosen
  - switching back and forth gives an identical plan
  - the pool is used up exactly
  - macros (kcal ±5%, P/C/F ±10%)
  - only allowed vegetarian + egg foods, no banned vegetables
  - how often dishes repeat
  - no combo dish names, and no duplicate dishes in a day
  - add/remove keeps placed + unallocated − over equal to the pool, with gaps only when the remaining dishes can't absorb them
