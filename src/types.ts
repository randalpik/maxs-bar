export type Role =
  | 'pour'
  | 'float'
  | 'measure'
  | 'count'
  | 'egg'
  | 'muddled'
  | 'dash'
  | 'bitters'
  | 'top'
  | 'garnish';

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
}

export interface Ingredient {
  raw: string;
  name: string;
  disp: string;
  qty: number | null;
  unit: string | null;
  role: Role;
  prefix: string | null;
  cat: string;
  fam: string | null;
  color: string;
  abv: number;
  citrus: string | null;
  syrup: string | null;
  eggMod: string | null;
}

export interface ParsedLine {
  name: string;
  body: string;
  method: string;
  hasMethod: boolean;
  ingredients: Ingredient[];
}

/** A stored recipe record — the source of truth, persisted as CSV. */
export interface Recipe {
  name: string;
  recipe: string;
  created: string;
  edited: string;
  /** Drink author/creator. Blank for classics; set for originals. */
  author: string;
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
  /** A removed seed ingredient (always renders unstocked in recipes; hidden from the list). */
  removed?: boolean;
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
