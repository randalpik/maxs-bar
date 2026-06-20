import type { Profile, StockEntry } from '../core/types';
import { LOCATION_LABEL } from '../ingredients/locations';
import { HOME_PROFILE_NAME, HOME_PROFILE_CATS } from '../recipes/seeds/home-profile';

/* ============================================================
   Store profiles — pure data + helpers (no state, DOM or I/O)

   A profile is a named, ordered list of categories ("aisles") plus per-ingredient
   placements: the order you encounter ingredients in a store. Two profiles are
   special. 'categories' is a sentinel for the taxonomy view — it is never stored,
   so it is uneditable by construction. 'home' replaces the old Location mode and
   seeds from recipes/seeds/home-profile.ts.

   Category identity is the bare string (id == label for user-named aisles; Home's
   seeded ids label via LOCATION_LABEL). 'other' is implicit: always present, always
   last, never in `cats` — so it can't be removed or reordered. An ingredient's
   defaultLocation matches a category in ANY profile that has a label-equivalent
   one (sameCat), so e.g. a store profile's "Fridge" aisle picks up everything
   that defaults to the fridge at home.
   ============================================================ */

export const CATEGORIES_ID = 'categories';
export const HOME_ID = 'home';
export const OTHER_CAT = 'other';

/** The renderable category list: the profile's aisles plus the implicit Other last. */
export function profileCats(p: Profile): string[] {
  return [...p.cats, OTHER_CAT];
}

/** Display label for a profile category: known location ids keep their label
 *  (Home's seeded aisles), user-named aisles render verbatim. */
export function catLabel(id: string): string {
  return LOCATION_LABEL[id] ?? id;
}

/** Reserved names a user-added category may not take ('other' is implicit). */
export function isReservedCat(name: string): boolean {
  return name.trim().toLowerCase() === OTHER_CAT;
}

/** Equivalence key for category matching: label-based and case-insensitive, so
 *  Home's seeded id 'fridge' and a custom profile's "Fridge" aisle are the same
 *  place. Used for the default-location fallback and the editor dropdown dedupe. */
export function catKey(cat: string): string {
  return catLabel(cat).trim().toLowerCase();
}

/** True when two category strings name the same place (see catKey). */
export function sameCat(a: string, b: string): boolean {
  return catKey(a) === catKey(b);
}

/** Where an ingredient renders in a profile: its explicit placement, else the
 *  profile's own category that matches the ingredient's default location (any
 *  profile — a store's "Fridge" aisle catches the fridge-defaulted items), else
 *  Other. A resolved category the profile no longer lists demotes to Other —
 *  covering both a removed aisle and a defaultLocation pointing at one. */
export function effectiveCat(p: Profile, key: string, defaultLoc?: string): string {
  const placed = p.placements[key]?.cat;
  if (placed !== undefined) return placed === OTHER_CAT || p.cats.includes(placed) ? placed : OTHER_CAT;
  if (defaultLoc !== undefined) return p.cats.find(c => sameCat(c, defaultLoc)) ?? OTHER_CAT;
  return OTHER_CAT;
}

/** Fresh Home profile from its seed (recipes/seeds/home-profile.ts); Other
 *  implicit, flags off. ts 0 so any synced copy that was actually edited wins
 *  the meta merge. */
export function makeHomeProfile(): Profile {
  return {
    id: HOME_ID,
    name: HOME_PROFILE_NAME,
    ts: 0,
    cats: HOME_PROFILE_CATS.map(c => c.id),
    hideUnstocked: false,
    hideOther: false,
    skipPending: false,
    placements: {},
  };
}

/** Fresh custom profile: empty aisle list (everything in Other) until the user
 *  defines categories. */
export function makeProfile(name: string): Profile {
  return {
    id: newProfileId(),
    name,
    ts: 0,
    cats: [],
    hideUnstocked: false,
    hideOther: false,
    skipPending: false,
    placements: {},
  };
}

function newProfileId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** One-time migration: build Home from the legacy stock shadow, folding each
 *  entry's loc/pos into a placement that keeps the entry's timestamp (so a
 *  genuinely newer placement from sync still wins). */
export function seedHomeFromStock(stockTs: Record<string, StockEntry>): Profile {
  const home = makeHomeProfile();
  for (const [key, e] of Object.entries(stockTs)) {
    if (typeof e.loc === 'string') home.placements[key] = { cat: e.loc, pos: e.pos ?? 0, ts: e.ts };
  }
  return home;
}

/** Fold legacy loc/pos still arriving from an old device's payload into Home,
 *  newer-ts only — a real placement made since the cutover must not be clobbered
 *  by a stale migrated location. Mutates and returns `home`. */
export function foldLegacyPlacements(home: Profile, stockTs: Record<string, StockEntry>): Profile {
  for (const [key, e] of Object.entries(stockTs)) {
    if (typeof e.loc !== 'string') continue;
    const cur = home.placements[key];
    if (!cur || e.ts > cur.ts) home.placements[key] = { cat: e.loc, pos: e.pos ?? 0, ts: e.ts };
  }
  return home;
}
