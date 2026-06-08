# Max's Bar

A personal cocktail index for running a home bar. Recipes are written in a compact shorthand (`Name: 2 rum, 3/4 lime, 3/4 syrup (built)`), parsed into typed ingredients, and rendered as sortable, groupable, and filterable sets of formatted ingredient cards. Track your personal stock of ingredients to display which recipes you can make. Ingredients can belong to multiple families for generic matching (`rum`, `syrup`) in recipes. Data lives in `localStorage` with optional cross-device sync, and moves in and out as JSON (recipe import also accepts `.txt` and `.csv`). Comes with a default set of ingredients and three selectable recipe seed lists, all fully editable. Vanilla TypeScript on Vite.

## Develop

```bash
npm install
npm run dev                   # Vite dev server with HMR on :5180 (front-end)
npx netlify functions:serve   # sync/auth backend on :9999 — run alongside `npm run dev`
npm test                      # run all unit tests once (Vitest)
npm run test:watch            # tests in watch mode
npm run build                 # type-check (tsc, incl. functions) + production build to dist/
npm run preview               # serve the built dist/ locally
```

`npm run dev` serves only the static app; the sync/account backend lives in `netlify/functions/`. To exercise sign-in and cross-device sync locally, run `npx netlify functions:serve` (:9999) alongside it. Vite proxies the app's `/api/*` calls to it (see [vite.config.ts](vite.config.ts)).

## Project layout

Modules are grouped into concern folders; each tested module sits beside its `.test.ts`. Imports are plain relative paths (no barrels, no alias).

```
index.html        # markup + Vite module entry (-> /src/main.ts)
src/
  main.ts         # event wiring + init (injects the seed-backed classifier)
  test-setup.ts   # vitest: install the seed-backed classifier
  styles.css      # styles (verbatim from the prototype)
  core/
    types.ts      # shared types
    util.ts       # nowISO()
    dom.ts        # typed querySelector helper
    state.ts      # shared state; recipe seed + overrides in localStorage
  parser/
    parser.ts     # shorthand parser (structure only); classification is injected
    csv.ts        # CSV serialize/parse (RFC-4180-ish)
  ingredients/
    ingredients-seed.ts  # canonical, hand-maintained ingredient list (single source of truth)
    ingredients.ts       # ingredient keys, umbrellas, stock availability, buildCatalog
    catalog.ts           # runtime catalog from the seed + overrides + seed-backed classifier
    ingredients-export.ts # seed-format diff of ingredient overrides
    icons.ts             # SVG icon generation + amount formatting
  recipes/
    seeds/        # recipe seeds (classics, maxs-list⊂classics, empty) + resolveSeed()
    syrups.ts     # syrup reference tab data
  sync/
    sync.ts       # sync coordination: session, UI bindings, HTTP transport
    sync-engine.ts # pure sync orchestration (no DOM/state)
    merge.ts      # per-key last-write-wins merge
    acct.ts       # account / sign-in modal
  io/
    io.ts         # JSON import/export (file/DOM wrappers); recipes also import .txt/.csv
    transfer.ts   # format-agnostic import/export transforms
  ui/
    render.ts     # grouping/sorting + DOM rendering + chip layout
    modal.ts      # add / edit / delete recipe modal
    igmodal.ts    # edit-ingredient modal (icon builder + overrides)
    seedmodal.ts  # choose / switch recipe seed modal
```

## Deploy (Netlify)

The repo builds to `dist/` via `npm run build` (config in [netlify.toml](netlify.toml)) and auto-deploys to `https://bar.maxrandalmusic.com` on every push to `production`.
