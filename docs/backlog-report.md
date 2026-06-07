# Backlog auto-pass — report

Worked on branch **`backlog-auto`** (off `production`). Nothing pushed; `production`
is untouched and still the deploy source. Each landed item is its own commit.
Baseline before starting: `npm test` green (20 tests), `npm run build` clean.
After: **27 tests green, build clean.** Dev server (port 5180, already running) used
for headless-Chromium visual checks; I never stopped it.

I did **not** touch `docs/backlog.md` (your document).

## Scope call

8 of 14 items were straightforward enough to land directly. The other 6 are either
genuinely large, change default behavior, or are ambiguous enough that guessing risks
a dead-end — investigated and written up below, not implemented.

---

## Landed (committed individually)

| Backlog item | Commit | Notes |
|---|---|---|
| Sentence-case non-proper ingredient names (ex. peel) | `eae79cf` | Scoped to peel/wheel/twist garnishes — see caveat below |
| Sort by number of missing ingredients | `68c23d9` | + Last modified, same commit |
| Sort by last modified | `68c23d9` | Used existing `Recipe.edited`; no schema change needed |
| Toolbar: fixed-width dropdown + left-justified tabs | `ed5a06c` | Verified via screenshot |
| Import from CSV | `d434b2c` | Lossless round-trip with the existing CSV export |
| Drink author field next to titles | `3475c7e` | New 5th CSV column, backward-compatible |
| Export ingredient list to CSV | `9d6a0f3` | Reasonable schema; will firm up with item 8 |
| Read-only Syrups tab | `fa759dd` | Embedded syrups, comma-split into steps |

### Details & decisions

**Sentence-case garnishes.** The visible offender was `Orange Peel` / `Lemon Wheel`;
now `Orange peel`, `Lemon wheel`. I deliberately did **not** change the global
`classify()` fallback to sentence case, because proper-noun ingredients not in the
rule table (e.g. a hypothetical `Fernet Branca`) would get wrongly lowercased to
`Fernet branca`. The parser can't tell proper from common for unknown names. **Open
question:** do you want sentence-casing pushed further than the peel/wheel/twist
garnishes? If so we likely need a small "proper noun" allow-list or to lean entirely
on the rule table's `disp`.

**Sort by missing.** Ascending (closest-to-makeable first), tie-broken by name. New
`missingCount()` in the catalog layer dedupes by stock identity, so lime juice + lime
wedge in one recipe count as a single missing item. With nothing stocked it
degenerates to "fewest total ingredients first," which is still a sane order.

**Sort by last modified.** `Recipe.edited` already existed and is already in the CSV,
so this was purely a new sort key (newest first). Note: every seed recipe shares one
timestamp, so among seed drinks the order is just the name tie-break until you edit them.

**Toolbar.** Moved the Recipes/Ingredients(/Syrups) tab group out of `.controls` so it
sits beside the title; the auto right-margin now lives on `#tabs` and pushes the rest
right. `#keySel` got a fixed `190px` width (fits the longest option, "Missing
ingredients") so swapping the group/sort option sets no longer reflows the bar.

**CSV import.** `parseCSV` already existed; `importCSV()` merges by name
(case-insensitive) and preserves the file's `created`/`edited`, so export→import is
lossless. The hidden file input now accepts `.csv` and branches on extension; new
"Import CSV" menu entry.

**Author field.** Added `Recipe.author` as a 5th CSV column. `parseCSV` defaults it to
`''`, so legacy 4-column CSVs and the seed load cleanly (covered by a new test).
Rendered as an italic byline beside the card title; optional input in the modal.
**Caveat:** the `.txt` format is just `Name: recipe`, so author survives
CSV/localStorage round-trips but **not** `.txt` export/import. Flagging in case you
want author encoded in `.txt` too (would need a format extension).

**Export ingredients CSV.** One row per stockable catalog item
(`key,name,category,color,shape,stocked,uses`), ordered by category then name. The
*purpose* ("for import / baking into the seed") ties to item 8's not-yet-existing
ingredient store, so I picked a sensible schema rather than guessing item 8's exact
shape — expect this to firm up alongside that work.

**Syrups tab.** Decision worth knowing: `docs/syrups.txt` is **untracked**, so a Vite
`?raw` import of it would break the Netlify production build (which builds from git).
I instead embedded the content in `src/syrups.ts` — the exact pattern `seed.ts`
already uses for recipes — keeping `src/` self-contained. "Consistent formatting" =
split each prose recipe on commas into capitalized numbered steps. I did **not**
rewrite your recipe wording (it's your source of truth); I only normalized
presentation. **Open question:** the comma-split is a heuristic — a couple of recipes
(Orgeat especially) produce long step lists. If you want a tighter editorial pass
(true ingredient/step separation), that's content work I'd want you to drive.

### Testing added
- `parser.test.ts`: sentence-case garnishes; author CSV round-trip + legacy-CSV default.
- `ingredients.test.ts` (new): `missingCount` incl. the dedup case.
- `syrups.test.ts` (new): parse coverage + step capitalization.

UI-only changes (toolbar, byline, syrups layout, menu entries) aren't unit-testable
here (no DOM in the Vitest env, no Playwright installed), so I verified those with
headless-Chromium screenshots against the running dev server. **Recommend a hands-on
pass** on: the author byline + modal field, and the Syrups tab layout, since I could
only screenshot the default-load states.

### Git hygiene note
My commits used `git add -A`, which swept the previously-untracked `docs/syrups.txt`
into the **first** commit (`eae79cf`), not the Syrups commit where it belongs. It's
harmless (legitimate content the Syrups tab mirrors, now tracked) but landed in an
unrelated commit. Easy to reorganize on review; flagging for transparency.

---

## Not implemented — investigation & thinking

### Item 3 — "Button on each ingredient to switch back to ingredients tab + populate filter with that ingredient"
**Status: blocked on ambiguity — needs your call before I build.**

The sentence has two coherent readings and they imply different work:

- **Reading A (recipe chip → ingredients tab):** each ingredient chip on a recipe card
  gets an affordance that jumps to the **Ingredients** tab and filters it to that
  ingredient (to quickly toggle its stock). Problem: the Ingredients tab has **no
  filter** today (the search box is hidden there). So this implies *also adding a
  search/filter to the Ingredients tab* + making recipe chips actionable + the
  cross-tab jump. Matches the literal "ingredients tab" + "populate filter."
- **Reading B (ingredient chip → recipes tab):** on the **Ingredients** tab, clicking
  an ingredient switches to **Recipes** and populates the existing recipe filter with
  it, showing every drink that uses it. This reuses the existing recipe search verbatim
  (no new filter) and maps cleanly to "switch tab + populate filter" — but contradicts
  the word "ingredients tab."

Both need a tab-switch + filter-population; A needs a brand-new filter UI, B reuses
what exists. I lean **B** as the more useful and lower-cost feature (find-uses-of-an-
ingredient), but the wording points at A. Rather than guess and risk building the wrong
one, I left it. **Which did you mean?** Either is a quick, contained change once decided.

### Item 4 — Icons for ingredients currently missing them (dropper bottle for extracts/solutions, one-off minimalist icons for the rest)
**Status: scoped, not built — it's a design/aesthetic task you'll want to steer.**

Findings while scoping:
- Icons are driven entirely by `iconFor(i)` in `icons.ts`, which keys off `i.cat`. The
  `shape` field in the parser's `RULES` table is **vestigial at runtime** (the
  `Ingredient` type doesn't even carry `shape`) — so adding icons = editing `iconFor`
  + adding SVG `case`s in `icon()`, not touching the rules.
- Currently icon-less categories: `egg`, `sugar`, `herb`, `spice`, `dairy`, non-liquid
  `citrus`/`fruit` garnishes, and `other` (which includes saline + espresso — note
  espresso's `droplet` shape in RULES is currently ignored because `other`→null).
- "Dropper bottle for extracts and solutions" is well-specified and I can build a
  `dropper` SVG confidently (arugula extract, saline solution). The bulk —
  "one-off minimalist icons for everything else" — is bespoke per-ingredient art
  (egg, sugar cube, mint, nutmeg, milk, cherry…) and is exactly the kind of visual
  judgment you'll want to approve rather than have me invent.

**Proposal:** I implement the `dropper` shape for extracts/solutions + wire up the
clearly-shaped categories, then show you a screenshot sheet of candidate minimalist
icons for the rest to react to. Say the word and I'll do the dropper + a first icon
pass on a branch.

### Item 7 — Split seed into a CSV file; opt into Max's recipes OR a lighter starter list; default to blank
**Status: not built — changes default behavior + needs content + UX decisions.**

Mechanically straightforward: move the embedded `SEED_TXT` into a repo data file and a
second "starter" file, load via Vite `?raw`, and add a chooser. The reasons I held:
1. **"Default to blank"** changes first-run behavior. Your existing data lives in
   localStorage so you're unaffected, but it's a real product decision (new visitors
   land on an empty app) — worth confirming.
2. **The "less opinionated starter list"** is *content I'd be inventing.* What's in it
   (the canonical ~12 classics? which ones?) is your editorial call.
3. **The opt-in UX** is unspecified: a first-run empty-state with two buttons
   ("Load Max's recipes" / "Load a starter set")? A menu submenu? 

I'd want a quick alignment on (2) and (3), then this is a tidy afternoon. (Note: if/when
seeds move to CSV files, they should carry the new `author` column.)

### Item 8 — Migrate ingredients + categories to localStorage, editable from the UI
**Status: large refactor — design only.**

This is the big one and the README/CLAUDE.md architecture is explicitly built around
the opposite invariant ("ingredients are never stored — they fall out of parsing").
Sketch of the direction:
- Introduce a third storage key (e.g. `backbar.ingredients.v1`) holding the canonical
  ingredient records (name, category, color, icon/shape, umbrella membership).
- `classify()` becomes seeded *from* that store instead of the hardcoded `RULES`
  block — keep `RULES` as the seed, as the backlog says.
- The catalog layer (`ingredients.ts`) shifts from "derive everything from recipes" to
  "reconcile recipe-derived usage against the stored ingredient list." `ingredientKey`
  / umbrella logic mostly survives.
- New editing UI on the Ingredients tab (rename, recolor, recategorize, set umbrella).
- Migration: first run with no ingredient store → seed it from current `RULES` +
  recipe-derived items.

This unlocks items **9** (icon builder) and **4** (editable icons) and gives item 12's
export a stable target schema. It deserves its own design doc + your review before code.

### Item 9 — Icon builder (outline picker + color adjuster)
**Status: depends on items 8 + 4 — design only.**

Needs (a) an editable ingredient store to persist the chosen icon/color (item 8) and
(b) a defined library of outline shapes to pick from (item 4). Once those exist, this is
a focused modal: a grid of outline shapes + a color control, writing `shape`/`color`
onto the ingredient record. Sequence after 8 and 4.

### Item 14 — Sign in with Google to sync state across devices
**Status: investigated options — no code (needs auth + backend/secrets + your infra choice).**

The app is a static, client-only Netlify site with all state in two localStorage keys
(recipes CSV, stock JSON). Sync = persist those two blobs per authenticated user.
Options, lightest-infra first:

1. **Google Drive `appDataFolder`** — Sign in with Google (Google Identity Services),
   store one JSON file in the user's hidden app-data Drive folder. **No database, no
   backend, user owns their data.** Best fit for "sign in with Google" + "lightweight."
   Cost: OAuth consent-screen setup/verification, Drive API quotas, client-side token
   handling.
2. **Firebase (Auth + Firestore)** — Google sign-in built in, per-user doc holds the two
   blobs. Client SDK only, no server to run, generous free tier, simplest cross-device
   DX. Cost: a Firebase project + security rules; another vendor.
3. **Supabase (Auth + Postgres)** — Google OAuth + a row/JSON column per user. Similar
   to Firebase, open-source, slightly more setup.
4. **Netlify-native** — Netlify Identity (has Google login) + a Netlify Function +
   Netlify Blobs/KV. Keeps everything on Netlify; less polished DX.

**Recommendation:** Drive `appDataFolder` if you want zero backend and user-owned data;
**Firebase** if you want the least code and best cross-device story. Either way:
- Sync model: whole-document last-write-wins keyed off a timestamp is simplest;
  per-recipe merge using the existing `edited` field is possible but more work.
- This is the only item that introduces external services/secrets and an auth flow —
  it warrants its own spike + your vendor decision before any code.

---

## Suggested next decisions for you
1. **Item 3:** Reading A or B? (then it's quick)
2. **Item 4:** want me to do the dropper + a candidate icon sheet to react to?
3. **Item 7:** what goes in the "starter" list, and where does the chooser live?
4. **Item 14:** which backend direction (Drive appData vs Firebase vs …)?
5. Reorganize/squash `backlog-auto` as you like, then merge to `production` when happy.
