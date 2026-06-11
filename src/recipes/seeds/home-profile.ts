/* ============================================================
   Home profile seed — the categories a fresh install's "Home" store profile
   starts with (physical places behind the bar). Hand-maintained data, like the
   other seeds. The implicit 'other' category is never seeded: it always exists
   and always sorts last (see profiles.ts OTHER_CAT).

   locations.ts derives LOCATION_ORDER / LOCATION_LABEL from this list, so the
   ids here are also the vocabulary for per-category default locations
   (categories.ts `loc`) and per-ingredient defaultLocation overrides.
   ============================================================ */

export interface HomeSeedCat {
  id: string;
  label: string;
}

export const HOME_PROFILE_NAME = 'Home';

export const HOME_PROFILE_CATS: HomeSeedCat[] = [
  { id: 'bar-top',      label: 'Bar top' },
  { id: 'top-shelf',    label: 'Top shelf' },
  { id: 'bottom-shelf', label: 'Bottom shelf' },
  { id: 'wine-rack',    label: 'Wine rack' },
  { id: 'fridge',       label: 'Fridge' },
  { id: 'pantry',       label: 'Pantry' },
];
