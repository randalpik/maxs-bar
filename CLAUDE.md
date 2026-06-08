# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                      # dev server with HMR on http://localhost:5180
npm run build                    # type-check (tsc) THEN production build to dist/
npm test                         # run all unit tests once (Vitest)
npm run test:watch               # tests in watch mode
npx vitest run src/parser/parser.test.ts # run a single test file
npx vitest run -t "parses named fractions"   # run tests matching a name
npm run preview                  # serve the built dist/ locally
```

`npm run build` is the real type-check gate (`tsc` runs before Vite) — run it after non-trivial TS changes; a clean `npm test` alone does not catch type errors.

## Architecture

Vanilla TypeScript + direct DOM manipulation — **no framework, no runtime dependencies**. State lives in a single mutable `state` object ([src/core/state.ts](src/core/state.ts)); any change is followed by a call to `render()`, which rebuilds `#main` via `innerHTML`. See [README.md](README.md) for the file-by-file layout.

### The recipe string is the only source of truth
A `Recipe` stores just `{ name, recipe, created, edited, author }` where `recipe` is the shorthand string (`2 rum, 3/4 lime, 3/4 syrup (built)`). **Ingredients, base spirit, and alcohol estimate are never stored** — `derive()` re-parses the string on every render through `parseLine` → `parseIngredient` → the injected classifier. This re-parse is cheap and central: if you need structured data about a recipe, derive it, don't cache it.

### Seeds + overrides, loaded on startup ([src/core/state.ts](src/core/state.ts))
Both recipes and ingredients follow the same shape: a committed seed in the repo + a user override layer in localStorage, merged at runtime.
- **Recipes**: chosen seed (`backbar.seed.v1`) resolved from [src/recipes/seeds/](src/recipes/seeds/) — `classics`, `maxs-list` (inherits classics), `empty` — then user diffs (`backbar.recipes.v1`: adds/edits/removals by name) applied. `deriveRecords()` produces `state.records`; `save()` re-diffs against the seed. `backbar.csv.v2` is a legacy flat store, read once for migration. CSV in [src/parser/csv.ts](src/parser/csv.ts).
- **Ingredients**: the catalog comes from [src/ingredients/ingredients-seed.ts](src/ingredients/ingredients-seed.ts) + per-ingredient overrides (`backbar.ingredients.v1`). Stocked keys are a JSON array in `backbar.stock.v1`.

### Classification comes from the ingredient seed, not the parser
[src/parser/parser.ts](src/parser/parser.ts) only turns shorthand into structure (quantities, units, roles, methods) — it does **not** classify. Classification is injected via `setClassifier`: the app (and tests) install `seedClassify` ([src/ingredients/catalog.ts](src/ingredients/catalog.ts)), which resolves a name against [src/ingredients/ingredients-seed.ts](src/ingredients/ingredients-seed.ts) — **the single source of truth for ingredient data** (category, colour, ABV, family, display name, aliases, umbrellas). A name the seed doesn't know renders as a plain, icon-less, sentence-cased chip. The seed is **hand-maintained** (there is no generator); edit it directly.

### The ingredient / stock model ([src/ingredients/ingredients.ts](src/ingredients/ingredients.ts) + [src/ingredients/catalog.ts](src/ingredients/catalog.ts))
`runtimeCatalog()` builds the stockable list from the seed + overrides and decides whether each recipe chip is "available" given the stocked set.

- **`ingredientKey(i)`** is the stock identity (what `backbar.stock.v1` stores). Citrus folds to the bare fruit (`lemon` covers lemon juice/peel/wheel); otherwise it's the canonical display name lowercased.
- **Umbrellas are explicit, per-ingredient.** Each seed entry's `umbrellas` lists the parent ids it's a CHILD of (e.g. Light rum → `["rum"]`; overlap allowed). A key referenced as a parent is an **effective generic**: hidden from the stock list, and a recipe asking for it is satisfied when any child is stocked. "Active" umbrellas and the hidden set are *derived* from the `umbrellas` lists in [src/ingredients/catalog.ts](src/ingredients/catalog.ts) — no separate table.
- **Citrus** is the other kind: the parent is **shown** and its derivatives **hidden**; stocking `Lemon` covers juice/peel/wheel. Pure `ingredientKey` folding.
- **`displayCat(cat, disp, key)`** regroups categories for the stock list (extracts split out, cranberry/pomegranate/pineapple → Mixers, herb+spice and dairy+egg merged). `CATEGORY_ORDER`/`CATEGORY_LABEL` drive page order and labels.
- `isAvailable(i, ctx)` is consumed by both tabs; `chipHTML` flags missing ingredients with the `unstocked` class.

### Rendering & chip layout ([src/ui/render.ts](src/ui/render.ts))
`render()` dispatches on `state.page` ('recipes' | 'ingredients' | 'syrups' — the last a read-only reference tab). After writing `innerHTML`, it schedules `layoutCards()` in a `requestAnimationFrame` — this measures each chip's widest wrapped line and equalizes heights per container (`.card` and `.ig-grid`). Anything that re-renders chips must let `layoutCards` run, and it also re-runs on resize and `fonts.ready`.

### Optional cross-device sync ([src/sync/](src/sync/) + [netlify/functions/](netlify/functions/))
Sync is layered *on top of* the override model — it syncs the override layer, never derived data (same principle as "the recipe string is the only source of truth"). The synced unit is a `SyncPayload` ([src/core/types.ts](src/core/types.ts)): `seedId`/`seedTs`, `recipeOverrides`, `ingredients`, `stockTs` — every entry carries its own timestamp.
- **Merge is per-key last-write-wins**, and [src/sync/merge.ts](src/sync/merge.ts) is **pure** (no state/DOM/IO) — that's what makes it unit-testable. Don't reach into state or localStorage from it.
- [src/sync/sync-engine.ts](src/sync/sync-engine.ts) is the pure orchestration core: a `Transport` interface plus pull→merge→push, with `httpTransport`/`authCall` for the real backend. [src/sync/sync.ts](src/sync/sync.ts) wires the engine to `state`, localStorage (`backbar.auth.v1`), and the DOM, and debounces pushes; [src/sync/acct.ts](src/sync/acct.ts) is the account modal.
- The backend is Netlify Functions ([netlify/functions/](netlify/functions/): `signup`/`login`/`logout`/`pull`/`push`, blob-backed) — its own tsconfig and `auth.test.ts`, built by the second `tsc` in `npm run build`.

## Conventions & constraints

- [docs/backlog.md](docs/backlog.md) (known as "the backlog") **is Max's document.** It is the source of truth for product intent. Never edit it (not even to check off completed items) without explicitly asking — this rule is stated in the file itself.
- **styles.css is global**, with CSS variables in `:root` for the dark theme; chips share one base `.chip` with `.unstocked` (red) as the only state flag. Reuse existing variables/classes rather than introducing new color literals.
- Ingredient *data* (names, colours, categories, aliases, umbrellas) belongs in [src/ingredients/ingredients-seed.ts](src/ingredients/ingredients-seed.ts), the single source of truth — not in `parser.ts` (parsing only) or the catalog layer (derivation only).
- The dev server runs on port 5180 and may already be running locally; don't assume the port is free. Test on the existing server if you find it. **Never** stop an existing server you did not start.


## Working with Max

**Identity**: You are being prompted by Max Randal, software engineer and seasoned Claude user, familiar with your capabilities across a variety of disciplines from previous projects.

**Style**: Direct, peer-to-peer, technically dense when warranted. Match the register of the conversation. Don't over-explain things he already knows. Don't pad responses with framing. He prefers compact responses unless he asks for depth.

**Trust pattern**: He catches subtle regressions through hands-on testing. Trust him on testable claims; ask before pursuing potential dead-ends; favor compact responses over needlessly comprehensive ones.

**Stop and ask** when hitting circular reasoning, when a problem persists after multiple attempts, or when proceeding would commit to a direction he hasn't approved. Don't pursue unverified hypotheses on your own.

**Think out loud** before embarking on a long silent think or executing an opaque tool call. The sooner Max understands your reasoning, the sooner he can course-correct if needed.

**Design before code on complex features**. Simple tweaks can be implemented directly. For non-trivial changes, propose the design first unless specifically asked to move ahead.

**Verification before claims**. Search the codebase before saying something doesn't exist. If a tool exists for invariant checking or visual verification, run it before AND after the change.
