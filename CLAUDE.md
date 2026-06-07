# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                      # dev server with HMR on http://localhost:5180
npm run build                    # type-check (tsc) THEN production build to dist/
npm test                         # run all unit tests once (Vitest)
npm run test:watch               # tests in watch mode
npx vitest run src/parser.test.ts        # run a single test file
npx vitest run -t "parses named fractions"   # run tests matching a name
npm run preview                  # serve the built dist/ locally
```

`npm run build` is the real type-check gate (`tsc` runs before Vite) — run it after non-trivial TS changes; a clean `npm test` alone does not catch type errors.

## Architecture

Vanilla TypeScript + direct DOM manipulation — **no framework, no runtime dependencies**. State lives in a single mutable `state` object ([src/state.ts](src/state.ts)); any change is followed by a call to `render()`, which rebuilds `#main` via `innerHTML`. See [README.md](README.md) for the file-by-file layout.

### The recipe string is the only source of truth
A `Recipe` stores just `{ name, recipe, created, edited }` where `recipe` is the shorthand string (`2 rum, 3/4 lime, 3/4 syrup (built)`). **Ingredients, base spirit, and alcohol estimate are never stored** — `derive()` re-parses the string on every render through `parseLine` → `parseIngredient` → `classify`. This re-parse is cheap and central: if you need structured data about a recipe, derive it, don't cache it.

### Two localStorage keys, loaded on startup
- `backbar.csv.v2` — recipes, serialized as RFC-4180-ish CSV ([src/csv.ts](src/csv.ts)). Empty/corrupt → falls back to the embedded seed ([src/seed.ts](src/seed.ts)).
- `backbar.stock.v1` — a JSON array of stocked ingredient *keys* (see below). Default empty = nothing stocked.

### Classification is an ordered rule table
[src/parser.ts](src/parser.ts) holds `RULES`, a regex table scanned **top-to-bottom; first match wins**. Order is load-bearing — specific patterns (`light rum`, `green chartreuse`) must precede generic ones (`rum`, `chartreuse`). `classify()` returns category, icon color, family (`fam`), ABV, and a canonical display name. This file is covered by [src/parser.test.ts](src/parser.test.ts); changing rule order or output can break tests and the whole UI — edit deliberately.

### The ingredient / stock model ([src/ingredients.ts](src/ingredients.ts))
This is the most subtle subsystem. It derives a deduped, canonical ingredient catalog from the recipes and decides whether each recipe chip is "available" given the stocked set.

- **`ingredientKey(i)`** is the stock identity (what `backbar.stock.v1` stores). Citrus folds to the bare fruit (`lemon` covers lemon juice/peel/wheel); otherwise it's the canonical display name lowercased.
- **Two kinds of umbrella:**
  - *Generic umbrellas* (`UMBRELLA_NAMES`: rum, whiskey, brandy, tequila, vermouth, chartreuse, syrup, spirit, bitters) — the generic term is **hidden** from the stock list, its specific members shown; a recipe asking for the generic matches if any member is stocked. **Data-driven:** a name only behaves as an umbrella when a specific sibling actually appears in the recipes (`buildCatalog`'s `active` set), so e.g. `Tequila` with no sub-types stays a normal stockable item.
  - *Ingredient-side umbrella* (citrus) — the parent is **shown** and its derivatives **hidden**; stocking `Lemon` guarantees juice + peel. Implemented purely via `ingredientKey` folding.
- **`displayCat(i)`** regroups parser categories for the stock list *without touching the parser* (extracts split out, cranberry/pomegranate → Mixers, herb+spice and dairy+egg merged). `CATEGORY_ORDER`/`CATEGORY_LABEL` drive page order and labels.
- `isAvailable(i, ctx)` is consumed by both tabs; `chipHTML` flags missing ingredients with the `unstocked` class.

### Rendering & chip layout ([src/render.ts](src/render.ts))
`render()` dispatches on `state.page` ('recipes' | 'ingredients'). After writing `innerHTML`, it schedules `layoutCards()` in a `requestAnimationFrame` — this measures each chip's widest wrapped line and equalizes heights per container (`.card` and `.ig-grid`). Anything that re-renders chips must let `layoutCards` run, and it also re-runs on resize and `fonts.ready`.

## Conventions & constraints

- [docs/backlog.md](docs/backlog.md) (known as "the backlog") **is Max's document.** It is the source of truth for product intent. Never edit it (not even to check off completed items) without explicitly asking — this rule is stated in the file itself.
- **styles.css is global**, with CSS variables in `:root` for the dark theme; chips share one base `.chip` with `.unstocked` (red) as the only state flag. Reuse existing variables/classes rather than introducing new color literals.
- Keep new logic out of the test-covered `parser.ts` when it belongs in the `ingredients.ts` catalog layer.
- The dev server runs on port 5180 and may already be running locally; don't assume the port is free. Test on the existing server if you find it. **Never** stop an existing server you did not start.


## Working with Max

**Identity**: You are being prompted by Max Randal, software engineer and seasoned Claude user, familiar with your capabilities across a variety of disciplines from previous projects.

**Style**: Direct, peer-to-peer, technically dense when warranted. Match the register of the conversation. Don't over-explain things he already knows. Don't pad responses with framing. He prefers compact responses unless he asks for depth.

**Trust pattern**: He catches subtle regressions through hands-on testing. Trust him on testable claims; ask before pursuing potential dead-ends; favor compact responses over needlessly comprehensive ones.

**Stop and ask** when hitting circular reasoning, when a problem persists after multiple attempts, or when proceeding would commit to a direction he hasn't approved. Don't pursue unverified hypotheses on your own.

**Think out loud** before embarking on a long silent think or executing an opaque tool call. The sooner Max understands your reasoning, the sooner he can course-correct if needed.

**Design before code on complex features**. Simple tweaks can be implemented directly. For non-trivial changes, propose the design first unless specifically asked to move ahead.

**Verification before claims**. Search the codebase before saying something doesn't exist. If a tool exists for invariant checking or visual verification, run it before AND after the change.
