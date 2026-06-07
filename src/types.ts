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

/** A classification rule from the RULES table. */
export interface Rule {
  re: RegExp;
  cat: string;
  shape: string;
  color: string;
  abv: number;
  disp?: string;
  fam?: string;
  syrup?: string;
  citrus?: string;
}

/** Result of classify() — a rule resolved against an ingredient name. */
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
}

/** A record paired with its parsed/derived data for rendering. */
export interface Derived {
  rec: Recipe;
  p: ParsedLine;
  base: string | null;
  alc: number;
}
