import type { Form } from '../core/types';

/* ============================================================
   Categories — the single ingredient taxonomy

   One ordered list serves as BOTH the stored category and the ingredients-page
   section (they are the same thing — there is no separate "section" namespace and no
   remapping). Each row carries the category's display label, order, and its DEFAULTS:
   physical location, fallback icon, default measurement forms, whether it can carry
   alcohol, and umbrella parents for user-added ingredients.

   Per-ingredient seed fields (shape, forms, units, defaultLocation) override the row.
   Behaviour keyed on category is a lookup here, never a hardcoded switch elsewhere.
   NOTE: garnish is deliberately never a category default — real garnishes declare it
   explicitly in the seed (so future non-cocktail fruits/herbs/spices don't inherit it).
   ============================================================ */

/** Citrus's trailing forms: juice (the poured default), a counted wedge, and the
 *  verbatim peel/wheel/twist garnishes. The one place this set is defined. The bare
 *  default splits by parse context: cocktail "1 lime" pours an oz of juice, food
 *  "1 lime" counts a lime. Wedge/peel/wheel/twist apply in both. */
const CITRUS_FORMS: Form[] = [
  { keyword: '', aliases: ['juice'], role: 'pour', disp: 'juice', ctx: 'cocktail' },
  { keyword: '', role: 'count', ctx: 'food' },
  { keyword: 'wedge', aliases: ['wedges'], role: 'count', unit: 'wedge', icon: 'wedge' },
  { keyword: 'peel', role: 'count', process: 'garnish', disp: 'asis', icon: 'twist' },
  { keyword: 'wheel', role: 'count', process: 'garnish', disp: 'asis', icon: 'wheel' },
  { keyword: 'twist', role: 'count', process: 'garnish', disp: 'asis', icon: 'twist' },
];

export interface CategoryDef {
  id: string;
  label: string;
  /** Default physical location when freshly stocked. */
  loc: string;
  /** Fallback icon shape for an ingredient that declares no shape of its own. */
  icon: string | null;
  /** Default measurement forms (citrus juice/wedge/peel, bitters dash). Omitted ⇒ the
   *  ingredient pours by the bare quantity unless its seed declares forms. */
  forms?: Form[];
  /** Can carry alcohol → the edit modal shows the ABV field. */
  abv?: boolean;
  /** Umbrella parents auto-assigned to a *user-added* ingredient of this category. */
  umbrellas?: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'spirit',    label: 'Spirits',        loc: 'bottom-shelf', icon: 'squircle', abv: true },
  { id: 'liqueur',   label: 'Liqueurs',       loc: 'bottom-shelf', icon: 'hexagon',  abv: true },
  { id: 'fortified', label: 'Wines',          loc: 'wine-rack',    icon: 'glass',    abv: true },
  { id: 'syrup',     label: 'Syrups',         loc: 'fridge',       icon: 'bottle',   umbrellas: ['syrup'] },
  { id: 'citrus',    label: 'Citrus',         loc: 'fridge',       icon: 'circle',   forms: CITRUS_FORMS },
  { id: 'fruit',     label: 'Fruit',          loc: 'fridge',       icon: null },
  { id: 'mixer',     label: 'Mixers',         loc: 'fridge',       icon: 'droplet' },
  { id: 'brew',      label: 'Brews',          loc: 'fridge',       icon: 'can',      abv: true },
  { id: 'bitters',   label: 'Bitters',        loc: 'bottom-shelf', icon: 'triangle', forms: [{ keyword: '', role: 'dash' }], abv: true, umbrellas: ['bitters'] },
  { id: 'extract',   label: 'Extracts',       loc: 'bottom-shelf', icon: 'dropper' },
  { id: 'herbspice', label: 'Herbs & spices', loc: 'pantry',       icon: null },
  { id: 'sugar',     label: 'Sugar',          loc: 'pantry',       icon: 'cube' },
  { id: 'dairyegg',  label: 'Dairy & egg',    loc: 'fridge',       icon: null },
  { id: 'other',     label: 'Other',          loc: 'other',        icon: null },
];

export const CATEGORY_BY_ID = new Map<string, CategoryDef>(CATEGORIES.map(c => [c.id, c]));

export const CATEGORY_ORDER: string[] = CATEGORIES.map(c => c.id);
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));
/** Category == section now; these aliases keep the ingredients-page call sites reading
 *  naturally without a separate namespace. */
export const SECTION_ORDER = CATEGORY_ORDER;
export const SECTION_LABEL = CATEGORY_LABEL;
