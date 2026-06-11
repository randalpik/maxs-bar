import type { Profile, StockEntry } from '../core/types';
import { LOCATION_ORDER, LOCATION_LABEL } from '../ingredients/locations';

/* ============================================================
   Store profiles — pure data + helpers (no state, DOM or I/O)

   A profile is a named, ordered list of categories ("aisles") plus per-ingredient
   placements: the order you encounter ingredients in a store. Two profiles are
   special. 'categories' is a sentinel for the taxonomy view — it is never stored,
   so it is uneditable by construction. 'home' replaces the old Location mode: it
   seeds from the physical-locations list and is the profile the per-ingredient
   defaultLocation override keeps feeding (as a placement *fallback*, not a store).

   Category identity is the bare string (id == label for user-named aisles; Home's
   seeded ids label via LOCATION_LABEL). 'other' is implicit: always present, always
   last, never in `cats` — so it can't be removed or reordered.
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

/** Where an ingredient renders in a profile: its explicit placement, else (Home
 *  only) its default location, else Other. A resolved category the profile no
 *  longer lists demotes to Other — covering both a removed aisle and a
 *  defaultLocation that points at one. */
export function effectiveCat(p: Profile, key: string, defaultLoc?: string): string {
  const cat = p.placements[key]?.cat
    ?? (p.id === HOME_ID ? defaultLoc : undefined)
    ?? OTHER_CAT;
  return cat === OTHER_CAT || p.cats.includes(cat) ? cat : OTHER_CAT;
}

/** Fresh Home profile: aisles = the physical locations (Other implicit), flags off.
 *  ts 0 so any synced copy that was actually edited wins the meta merge. */
export function makeHomeProfile(): Profile {
  return {
    id: HOME_ID,
    name: 'Home',
    ts: 0,
    cats: LOCATION_ORDER.filter(id => id !== OTHER_CAT),
    hideUnstocked: false,
    hideOther: false,
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
