# Backlog sweep — 2026-06-08

Branch: `backlog-sweep-2026-06-08` (off `production`). All commits build clean
(`npm run build`) and keep the 75 unit tests green.

---

## Completed & committed

### Bug — recipe card gradient reddish tint  ✅ `e25f825`
**Root cause found.** The gradient lives in `src/styles.css:125`, not only in
`docs/prototype.html` — both files carry the same rule. The reddish tint is the
gradient's bottom stop `rgba(33,28,22,.6)`: a warm brown-orange literal left over
from the **pre-violet palette**. The `:root` recolour (commit `a33e45c`) moved the
variables to a violet undertone but missed this hardcoded literal, so cards faded
from cool violet (`--surface` `#211D2B`) into warm brown.
**Fix:** replaced it with `rgba(25,22,34,.6)` — the RGB of `--bg2` (`#191622`),
keeping the violet undertone. `prototype.html` left untouched (reference-only,
slated for deletion).

### Bug — flash of unstyled content / forced layout  ✅ `2b29e60`
**Root cause found.** `layoutCards()` measures each chip's widest wrapped line
(`getClientRects`/`offsetHeight`) to size and height-equalize chips. It ran in the
first `requestAnimationFrame` **before the Google fonts loaded**, so chips were
measured against the fallback font, then re-flowed when Fraunces/Hanken arrived —
the visible snap, and exactly what Chrome's "Layout was forced before the page is
fully loaded" warning describes.
**Fix:** the *first* layout is now deferred to `document.fonts.ready` (new
`scheduleLayout()` in `render.ts`); `#main` is held at `opacity:0` until a
`body.fonts-ready` class is added after that first layout. Later renders lay out
synchronously in a rAF as before. `document.fonts.ready` always resolves (even on
font-load failure) with a `Promise.resolve()` fallback for browsers lacking
`FontFaceSet`, so `#main` cannot get stuck hidden.
**⚠ Needs your hands-on check:** confirm visually with a hard reload + network
throttling / disabled cache (fonts cold). It's a perceptual fix I can't verify
headlessly here.

### Feature — favicon  ✅ `e25f825`
Purple hexagon in crème de violette `#7A4FA3` (the seed colour for that
ingredient), reusing the exact hexagon path from `icon()`, inlined as an SVG data
URI in `index.html` — no new file or build config.

### Feature — group/sort headers easier to spot  ✅ `e25f825`
`.grouphead .lbl` 11px → 13px, top margin 30px → 42px (first-child 6 → 8). Larger
label + more breathing room between groups when scrolling.

### Feature — drop recipes that don't match a grouping  ✅ `e25f825`
Group mode now skips the catch-all `—` bin: a recipe with no syrup simply doesn't
appear under "By syrup" (same for spirit/citrus/liqueur). Added a "No recipes match
this grouping" empty state. *Note:* this changes the visible set per grouping —
e.g. "By citrus" now hides citrus-free recipes. Sort-mode "Base spirit" still keeps
its `—` bin (sorting shows everything; only grouping filters).

### Feature — remove orphaned icons from the edit picker  ✅ `e25f825`
**Flagged: the 5 superseded shapes are `fizz`, `ring`, `ellipse`, `diamond`,
`leaf`.** Confirmed unused — none appear in `ingredients-seed.ts` and none are
produced by `iconFor()`'s auto-classification; they only existed in the picker
array and their own `icon()` definitions. Removed from the `SHAPES` picker. Their
`icon()` case branches were **kept** as harmless fallbacks (the `default` arm
renders a circle) so any stale stored override still renders. Recommend deleting
those 5 `icon()` branches too once you confirm no saved ingredient uses them.

### Feature — intercept browser-back to undo tab navigation  ✅ `d0bec33`
Tab switches, the chip **find** button (jump to filtered recipes), and the
**goto-ingredient** jump now `pushState({page, query})`; a `popstate` handler
restores page + filter. `pushNav()` de-dupes against the current entry (clicking
the active tab is a no-op). Filter-box *typing* is intentionally not pushed (would
flood history); back skips transient filters to the last real navigation. Initial
view seeded with `replaceState`.
**⚠ Needs your hands-on check:** history behaviour is best confirmed by clicking
around and hammering back/forward — I couldn't drive a real browser here. Watch
the find/goto round-trips and the first-back-leaves-the-app boundary.

---

## Investigation only — I/O cluster (features: merge script, import ingredients, csv→json)

These three backlog items are entangled and at least one ("how is export/import
working now… let's revisit / investigate") is explicitly an investigation. I did
**not** implement them — they need a format decision from you first, and building
on the current format risks churn the revisit would undo. Findings below.

### How export/import actually works today

**Persistence (localStorage), all seed + override-diff:**
| Store | Key | Shape |
|---|---|---|
| Seed choice | `backbar.seed.v1` | seed id string |
| Recipes | `backbar.recipes.v1` | **JSON** override diff vs seed (adds/edits/removals by lc-name) |
| Ingredients | `backbar.ingredients.v1` | **JSON** per-ingredient override diff |
| Stock | `backbar.stock.v1` | **JSON** array of stocked keys |
| Legacy | `backbar.csv.v2` | flat CSV, read once for migration, never written |

So internally **recipes are already a JSON diff** — the CSV/txt surface is just the
import/export skin, not the storage model.

**Export/import surface (`io.ts` + the `···` menu):**
- **Export CSV** (recipes) — full *resolved* list (name,recipe,created,edited,author), not a diff.
- **Export .txt** (recipes) — `Name: recipe` lines, human-readable.
- **Export ingredients** — seed-format **JSON diff** `{ ingredients: SeedIngredient[], removed: string[] }`. **Does not include stock.**
- **Import .txt / Import CSV** (recipes) — parse → **upsert/merge** by lc-name into the working list, re-diffed against the seed. Additive: recipes absent from the file are *not* removed.
- **Import ingredients — does not exist** (this is the "import ingredients" feature).

**Answers to your questions in the backlog:**
- *Override-application or complete rewrite?* Recipe import is an **additive merge**
  (upsert by name), not a rewrite — it can't delete. It interacts with seeds by
  flowing into the same override layer that `save()` diffs against the chosen seed.
- *Switch recipes csv→json like ingredients?* Coherent and low-risk — the data is
  already a JSON diff internally; only the export/import skin changes.
- *Remove export .txt?* Consistent with "json is canonical, txt is just for
  human-readable *import*." Keeping **import .txt** (intake) while dropping **export
  .txt/.csv** is clean.

### Feature feasibility

**Import ingredients (sync custom ingredients + stock):** implementable and
low-risk *once the format is fixed.* Blocker: the current ingredients export
**omits stock**, but the feature explicitly wants stock too. So step one is adding
`stocked: string[]` to `buildIngredientsExport()`; then `importIngredientsJSON()`
applies each entry via `setIngredientOverride`, tombstones `removed[]`, and restores
`stocked`. Merge-vs-replace semantics on import is a decision (recipes currently
merge).

**Dev merge script (ingredients.json → seed):** feasible as a Node script with
formatted output, but the crux is **re-serialising `INGREDIENTS` back to TS in your
hand-maintained style** (double quotes, field order, omitted empty optionals). Two
designs: (a) full regenerate of the array — simplest, but would **drop the inline
comment at `ingredients-seed.ts:672-673`** (the generic-wine note) and reformat the
whole file; (b) surgical insert/update of only changed entries — preserves comments
but more fragile. The export is already seed-format, so the merge logic itself
(upsert by key + apply `removed`) is trivial; serialisation is the real choice.

---

## Open questions (need your call before I build the I/O items)

1. **Recipe export format:** export the **full resolved list as JSON**
   (portable, seed-independent) or the **override diff** like ingredients
   (seed-relative, smaller, but odd if imported onto a different seed)?
2. **Drop export .txt and export CSV both?** Keep **import .txt** (human intake);
   keep **import CSV** for legacy round-trips, or drop it too?
3. **Ingredients + stock — one file or two?** Add `stocked[]` into the existing
   `ingredients.json`, or export/import stock as a separate file?
4. **Import semantics:** additive **merge** (current recipe behaviour) or full
   **replace** of the override layer? Should import be able to *remove* items not
   present in the file?
5. **Merge script serialisation:** full-regenerate (drops the one inline comment,
   normalises formatting) or surgical per-entry edit (preserves comments)?

The backlog FUTURE IDEAS (sync/sign-in, ingredient location ordering) were out of
scope for this sweep.
