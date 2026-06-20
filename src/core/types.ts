/** How much of an ingredient — the amount/measure axis (the chip's quantity slot). */
export type Role =
  | 'pour'
  | 'measure'
  | 'count'
  | 'dash'
  | 'top';

/** A process/positional word shown in the chip's gray tag slot, orthogonal to the
 *  amount. `float`/`muddle` come from explicit recipe prefixes; `garnish`/`grate` are
 *  per-ingredient defaults declared on a form. One slot, so mutually exclusive. */
export type Process = 'float' | 'muddle' | 'garnish' | 'grate';

/** A leading measure/count unit recognised in the `qty <unit> name` slot
 *  ("2 tsp sugar", "1 slice bread"). `volOz` is the ounces one unit contributes to
 *  the alcohol estimate; `null` marks a discrete unit (a count like "slice") that
 *  adds no volume and renders as "N <unit>(s)". This is the global, extensible set
 *  the parser recognises positionally — see UNIT registry in parser.ts. */
export interface UnitDef {
  id: string;
  /** Amount-tag plural; defaults to `id + "s"`. */
  plural?: string;
  volOz: number | null;
}

/** The parsing context a recipe line is read in. Food recipes drop the cocktail
 *  shorthand defaults (bare number ⇒ oz pour, citrus ⇒ juice) and resolve
 *  context-scoped aliases differently (cocktail "honey" = honey syrup; food
 *  "honey" = honey). Absent everywhere ⇒ 'cocktail', so all existing call sites
 *  and data keep their behavior. */
export type ParseCtx = 'cocktail' | 'food';

/** A trailing form keyword that reshapes how an ingredient resolves — the citrus
 *  juice/wedge/peel mechanism, generalised to data. An empty `keyword` is the
 *  bare/default form, which only carries a display treatment (citrus → "… juice"
 *  when poured). Forms are per-ingredient (synthesised for citrus/fruit by the
 *  classifier, or authored in the edit modal) and reach the parser via Classified. */
export interface Form {
  /** Trailing token after the name ("wedge","peel"); '' = the bare/default form. */
  keyword: string;
  /** Extra trailing tokens that resolve to this same form ("wedges","juice"). */
  aliases?: string[];
  role: Role;
  /** Display/amount unit for count forms ("wedge","sprig","pinch"); else the registry. */
  unit?: string;
  /** Default process word for this form (garnish, grate), shown in the gray tag slot
   *  alongside the amount. Absent ⇒ no process (float/muddle come from recipe prefixes). */
  process?: Process;
  /** Display treatment: 'juice' appends " juice" (once) when poured; 'sentence'/'asis'
   *  render the verbatim recipe name in sentence case. Absent ⇒ the classifier's disp. */
  disp?: 'juice' | 'sentence' | 'asis';
  /** Icon shape hint for this form ("wedge","twist","wheel"). */
  icon?: string;
  /** Context this form applies in; absent ⇒ both. The classifier filters by the
   *  active recipe's context, so e.g. citrus carries a cocktail juice-pour default
   *  AND a food count default under the same empty keyword. */
  ctx?: ParseCtx;
}

/** Result of the classifier — a category/colour/abv resolved against a name. */
export interface Classified {
  cat: string;
  shape: string;
  color: string;
  abv: number;
  disp: string;
  fam?: string;
  syrup?: string;
  citrus?: string;
  /** Canonical stock key the name resolved to (seed/override key); absent for unknowns.
   *  Carried onto the parsed ingredient so ingredientKey folds every form to one key. */
  key?: string;
  /** Trailing forms this ingredient can take (citrus wedge/peel/…, egg white/yolk).
   *  Consumed by the parser for role/unit/display; absent ⇒ no special forms. */
  forms?: Form[];
}

export interface Ingredient {
  raw: string;
  name: string;
  disp: string;
  qty: number | null;
  unit: string | null;
  role: Role;
  /** Process/positional word (float/muddle/garnish/grate); null if none. The gray tag. */
  process: Process | null;
  cat: string;
  fam: string | null;
  color: string;
  abv: number;
  citrus: string | null;
  syrup: string | null;
  /** Icon shape from the classifier (seed/override shape); null for unrecognised names.
   *  The recipe-chip icon, with formIcon and the category default as the other layers. */
  shape: string | null;
  /** Canonical stock key (from the classifier); null for unrecognised names. The basis
   *  for ingredientKey, so every form of an ingredient folds to one stock identity. */
  key: string | null;
  /** Icon shape from the matched trailing form (citrus wedge/peel/…); null otherwise.
   *  Lets iconFor stay form-aware without re-deriving the form. */
  formIcon: string | null;
}

export interface ParsedLine {
  name: string;
  body: string;
  method: string;
  hasMethod: boolean;
  ingredients: Ingredient[];
}

/** Food recipe category — the food analog of a cocktail's base/method, used purely
 *  for cosmetic grouping on the Food tab. */
export type FoodCat = 'meal' | 'snack' | 'dessert';

/** A stored recipe record — the source of truth, persisted as CSV. */
export interface Recipe {
  name: string;
  recipe: string;
  created: string;
  edited: string;
  /** Drink author/creator. Blank for classics; set for originals. */
  author: string;
  /** Recipe kind. Absent ⇒ cocktail (the default); only food recipes set this, so all
   *  existing data, seeds and exports stay byte-stable. Doubles as the parse context. */
  recipeType?: ParseCtx;
  /** Food category (Meal/Snack/Dessert). Set only on food recipes. */
  foodCat?: FoodCat;
}

/** User edits to a derived ingredient, keyed by ingredientKey and persisted in
 *  localStorage. Absent fields fall back to the parser-derived defaults. The key
 *  itself (stock identity) is never overridden. color/shape are reserved for the
 *  icon builder. */
export interface IngredientOverride {
  disp?: string;
  cat?: string;
  color?: string;
  shape?: string | null;
  /** Alcohol by volume as a fraction (0–1); overrides the seed abv, feeding the
   *  per-recipe standard-drinks estimate. */
  abv?: number;
  /** Umbrella parents this is a child of (stock matching + derived family).
   *  Replaces the seed's list when present. */
  umbrellas?: string[];
  /** Extra recipe-text names that resolve to this ingredient. Replaces the seed's
   *  list when present. */
  aliases?: string[];
  /** Trailing forms (citrus wedge/peel/…) this ingredient takes. Replaces the seed/
   *  category-default forms when present. A form's `unit` ("sprig","slice") is what
   *  registers a count-unit globally — there is no separate units field. */
  forms?: Form[];
  /** Physical location this ingredient defaults to when freshly stocked. Stored only
   *  when it differs from the category default (defaultLocationForCat). */
  defaultLocation?: string;
  /** A removed seed ingredient (always renders unstocked in recipes; hidden from the list). */
  removed?: boolean;
  /** Epoch-ms of the last edit, stamped by setIngredientOverride. Sync-internal:
   *  drives per-key last-write-wins and is never emitted by the file export. Absent
   *  on legacy/imported overrides ⇒ treated as 0 (loses to any timestamped edit). */
  ts?: number;
}

/** A user diff against the resolved recipe seed, keyed by lowercased name and
 *  persisted in localStorage. An *addition* (name absent from the seed) or an
 *  *edit* stores the full recipe; a *removal* is a `{ removed: true }` tombstone.
 *  Storing the full recipe (not a field patch) lets edits survive a seed switch
 *  even when the underlying base recipe changes. */
export interface RecipeOverride {
  /** Display name (preserves case; the map key is lowercased). */
  name?: string;
  recipe?: string;
  author?: string;
  created?: string;
  edited?: string;
  /** Recipe kind — carried so food recipes survive sync + JSON round-trips. Absent ⇒ cocktail. */
  recipeType?: ParseCtx;
  /** Food category, carried for the same reason. Set only on food recipes. */
  foodCat?: FoodCat;
  /** A removed seed recipe — dropped from the derived list. */
  removed?: boolean;
}

/** A record paired with its parsed/derived data for rendering. */
export interface Derived {
  rec: Recipe;
  p: ParsedLine;
  base: string | null;
  alc: number;
}

/** A stock toggle in the sync-only shadow map: on/off plus when it was last set.
 *  `state.stocked` (the runtime Set) stays the source of truth for the UI; this map
 *  exists so an *un-stock* can win a merge (a bare key list can't express removal). */
export interface StockEntry {
  on: boolean;
  /** Tagged for purchase — a shopping-list flavour of unstocked (so `on` is false).
   *  Distinct purple tag; an old client sees only `on:false` and treats it as unstocked. */
  pending?: boolean;
  ts: number;
  /** @deprecated Legacy physical location. Placement now lives in the Home profile
   *  (Profile.placements); this is read once by the profiles migration
   *  (seedHomeFromStock / foldLegacyPlacements) and never written anymore. */
  loc?: string;
  /** @deprecated Legacy sort position, co-set with `loc`. See `loc`. */
  pos?: number;
}

/** A per-profile ingredient placement: which of the profile's categories ("aisles")
 *  the ingredient sits in, and where within it. Carries its own timestamp so
 *  placements merge per-ingredient in sync (LWW, like StockEntry). */
export interface Placement {
  cat: string;
  pos: number;
  ts: number;
}

/** A store profile: a named, ordered list of categories plus per-ingredient
 *  placements (e.g. liquor-store aisles). 'other' is implicit — always present,
 *  always last, never stored in `cats`. The 'categories' profile is a sentinel
 *  (the taxonomy view) and is never stored as a Profile. Meta fields (name, cats,
 *  flags, deleted) sync whole-profile LWW on `ts`; placements merge per-key. */
export interface Profile {
  id: string;
  name: string;
  /** Epoch-ms of the last meta edit (name/cats/flags/deleted). */
  ts: number;
  /** Ordered category list, 'other' excluded (implicit last). */
  cats: string[];
  /** Location mode only: hide unstocked items (Pending items stay shown). Enabling
   *  drops the placements of items that are neither stocked nor pending. */
  hideUnstocked: boolean;
  /** Both modes: hide the Other group (blocks dragging in/out of it). */
  hideOther: boolean;
  /** Collapse the stock toggle to two states: any click → stocked, stocked → unstocked.
   *  Never *creates* Pending (store profiles); existing pending items click to stocked. */
  skipPending: boolean;
  placements: Record<string, Placement>;
  /** Deletion tombstone, competing by `ts` like recipe tombstones. Home never deletes. */
  deleted?: true;
}

/** The full cross-device payload — the four user-state slices plus the timestamps
 *  that drive per-key last-write-wins merging. This is the wire format (raw internal
 *  maps, not the human-readable file diffs from transfer.ts), since merging needs the
 *  per-entry timestamps that the file format drops. */
export interface SyncPayload {
  seedId: string;
  /** Epoch-ms the seed was last chosen (LWW for the single seedId scalar). */
  seedTs: number;
  recipeOverrides: Record<string, RecipeOverride>;
  ingredients: Record<string, IngredientOverride>;
  stockTs: Record<string, StockEntry>;
  /** Store profiles. Optional: absent in payloads from pre-profiles clients, which
   *  must keep validating and merging (read as {}). */
  profiles?: Record<string, Profile>;
}
