/* ============================================================
   Physical locations — the Home profile's category vocabulary

   These are the places an ingredient lives behind the bar. The DATA lives in the
   seeds folder (recipes/seeds/home-profile.ts) since it seeds the Home store
   profile; this module derives the order/label lookups from it and maps each
   ingredient category to its default place (defaultLocationForCat), overridable
   per-ingredient via the edit modal (IngredientOverride.defaultLocation /
   SeedIngredient.defaultLocation).
   ============================================================ */
import { CATEGORY_BY_ID } from './categories';
import { HOME_PROFILE_CATS } from '../recipes/seeds/home-profile';

export const LOCATIONS = [...HOME_PROFILE_CATS, { id: 'other', label: 'Other' }];

export const LOCATION_ORDER: string[] = LOCATIONS.map(l => l.id);
export const LOCATION_LABEL: Record<string, string> = Object.fromEntries(LOCATIONS.map(l => [l.id, l.label]));

export const DEFAULT_LOCATION = 'other';

/** A category's default physical location, read from the category table. */
export function defaultLocationForCat(cat: string): string {
  return CATEGORY_BY_ID.get(cat)?.loc ?? DEFAULT_LOCATION;
}
