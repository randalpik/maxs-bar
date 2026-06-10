/* ============================================================
   Physical locations for the ingredients "Location" mode

   A stocked ingredient lives at one of these places behind the bar. The current
   location + order within it are stored per-key in the stock shadow map (StockEntry
   loc/pos); the *default* location an item lands in when freshly stocked is derived
   from its category by defaultLocationForCat, overridable per-ingredient via the edit
   modal (IngredientOverride.defaultLocation / SeedIngredient.defaultLocation).
   ============================================================ */
import { CATEGORY_BY_ID } from './categories';

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

/** A category's default physical location, read from the category table. */
export function defaultLocationForCat(cat: string): string {
  return CATEGORY_BY_ID.get(cat)?.loc ?? DEFAULT_LOCATION;
}
