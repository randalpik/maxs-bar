# Max's Bar

A personal cocktail index. Recipes are written in a compact shorthand
(`Name: 2 rum, 3/4 lime, 3/4 syrup (built)`), parsed into typed ingredients,
and rendered as cards with abstract ingredient icons, base-spirit detection,
and an estimated standard-drinks count. Data lives in `localStorage`; lists can
be imported/exported as `.txt` or `.csv`.

This was ported faithfully from a single-file prototype (preserved at
[docs/prototype.html](docs/prototype.html)) into a Vite + TypeScript app. See
[docs/backlog.md](docs/backlog.md) for Max's roadmap.

## Develop

```bash
npm install
npm run dev        # local dev server with HMR
npm test           # run the parser/CSV unit tests (Vitest)
npm run test:watch # tests in watch mode
npm run build      # type-check (tsc) + production build to dist/
npm run preview    # serve the built dist/ locally
```

## Project layout

```
index.html        # markup + Vite module entry
src/
  main.ts         # event wiring + init
  state.ts        # shared state + localStorage load/save (key: backbar.csv.v2)
  parser.ts       # shorthand parser + ingredient classification rules
  icons.ts        # SVG icon generation + amount formatting
  csv.ts          # CSV serialize/parse (RFC-4180-ish)
  render.ts       # grouping/sorting + DOM rendering + chip layout
  modal.ts        # add / edit / delete modal
  io.ts           # .txt / .csv import & export
  seed.ts         # embedded authoritative base list
  types.ts        # shared types
  util.ts         # nowISO()
  dom.ts          # typed querySelector helper
  styles.css      # styles (verbatim from the prototype)
```

## Deploy (Netlify)

The repo builds to `dist/` via `npm run build` (config in
[netlify.toml](netlify.toml)). Deployment is connected through GitHub:

1. In Netlify: **Add new site → Import from Git → GitHub → `randalpik/maxs-bar`**.
2. Production branch **`production`**, build `npm run build`, publish `dist`.
3. **Site settings → Change site name → `maxs-bar`** → live at
   `https://maxs-bar.netlify.app`.

Every push to `production` then triggers an auto-deploy.
