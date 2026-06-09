/* ============================================================
   Physical locations for the ingredients "Location" mode

   A stocked ingredient lives at one of these places behind the bar. The current
   location + order within it are stored per-key in the stock shadow map (StockEntry
   loc/pos); the *default* location an item lands in when freshly stocked is derived
   from its category by defaultLocationForCat, overridable per-ingredient via the edit
   modal (IngredientOverride.defaultLocation / SeedIngredient.defaultLocation).
   ============================================================ */

export const LOCATIONS = [
  { id: 'bar-top',      label: 'Bar top' },
  { id: 'top-shelf',    label: 'Top shelf' },
  { id: 'bottom-shelf', label: 'Bottom shelf' },
  { id: 'wine-rack',    label: 'Wine rack' },
  { id: 'fridge',       label: 'Fridge' },
  { id: 'pantry',       label: 'Pantry' },
  { id: 'other',        label: 'Other' },
] as const;

export const LOCATION_ORDER: string[] = LOCATIONS.map(l => l.id);
export const LOCATION_LABEL: Record<string, string> = Object.fromEntries(LOCATIONS.map(l => [l.id, l.label]));

export const DEFAULT_LOCATION = 'other';

/** Category → sensible default location. `cat` is a raw category from CATEGORY_ORDER.
 *  "extract" is a display section (not a raw cat), detected from the display name the
 *  same way sectionFor does, so extracts land on the bottom shelf with the spirits. */
export function defaultLocationForCat(cat: string, disp = ''): string {
  if (/extract/i.test(disp)) return 'bottom-shelf';
  switch (cat) {
    case 'spirit': case 'liqueur': case 'bitters': return 'bottom-shelf';
    case 'fortified': return 'wine-rack';
    case 'citrus': case 'fruit': case 'dairy': case 'egg': case 'brew': return 'fridge';
    case 'herb': case 'spice': case 'sugar': return 'pantry';
    default: return DEFAULT_LOCATION;
  }
}
