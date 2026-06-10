import type { FoodCat } from '../core/types';

/* ============================================================
   Food recipe constants

   The food analog of parser.ts's METHOD_ORDER / FAMILY_LABEL: the canonical food
   categories in display order, plus their labels. Drives the Food tab's category
   grouping/sorting and the editor's category dropdown. recipeType + foodCat are the
   only structured data food recipes carry beyond the cocktail schema.
   ============================================================ */

/** Food categories in display/group order. */
export const FOOD_CATS: FoodCat[] = ['meal', 'snack', 'dessert'];

/** Human labels for the food categories. */
export const FOOD_CAT_LABEL: Record<FoodCat, string> = {
  meal: 'Meal',
  snack: 'Snack',
  dessert: 'Dessert',
};

/** The default category for a food recipe missing one (shouldn't happen — the editor
 *  always sets it — but keeps grouping/display total). */
export const DEFAULT_FOOD_CAT: FoodCat = 'meal';
