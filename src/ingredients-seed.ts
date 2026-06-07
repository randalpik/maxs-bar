// MAINTAINED by scripts/gen-ingredients.ts — run `npm run gen:ingredients`.
// Canonical ingredient list shipped with the app. SAFE to hand-edit: the generator is
// append-only — it adds ingredients newly seen in recipes and never overwrites or removes
// existing entries. Hand-add a shelf ingredient (e.g. a syrup no recipe uses) here and it
// survives regeneration. To re-sync an entry from the parser, delete it and regenerate.
import type { Classified } from './types';

export interface SeedEntry {
  key: string;
  disp: string;
  cat: string;
  color: string;
  shape: string | null;
  umbrella: string;
}

/** Stockable catalog ingredients (effective generics excluded). */
export const INGREDIENT_SEED: SeedEntry[] = [
  {
    "key": "absinthe",
    "disp": "Absinthe",
    "cat": "spirit",
    "color": "#9FCB3B",
    "shape": "squircle",
    "umbrella": "spirit:absinthe"
  },
  {
    "key": "amaretto",
    "disp": "Amaretto",
    "cat": "liqueur",
    "color": "#9B5A2A",
    "shape": "hexagon",
    "umbrella": "self:amaretto"
  },
  {
    "key": "angostura bitters",
    "disp": "Angostura bitters",
    "cat": "bitters",
    "color": "#A8412E",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "aperol",
    "disp": "Aperol",
    "cat": "liqueur",
    "color": "#F4531E",
    "shape": "hexagon",
    "umbrella": "self:aperol"
  },
  {
    "key": "apple brandy",
    "disp": "Apple brandy",
    "cat": "spirit",
    "color": "#B86A2A",
    "shape": "squircle",
    "umbrella": "spirit:brandy"
  },
  {
    "key": "arugula extract",
    "disp": "Arugula extract",
    "cat": "extract",
    "color": "#6B8F3F",
    "shape": "dropper",
    "umbrella": "self:arugula extract"
  },
  {
    "key": "bailey's",
    "disp": "Bailey's",
    "cat": "liqueur",
    "color": "#CBA980",
    "shape": "hexagon",
    "umbrella": "self:bailey's"
  },
  {
    "key": "bénédictine",
    "disp": "Bénédictine",
    "cat": "liqueur",
    "color": "#C8902E",
    "shape": "hexagon",
    "umbrella": "self:bénédictine"
  },
  {
    "key": "blackberry liqueur",
    "disp": "Blackberry liqueur",
    "cat": "liqueur",
    "color": "#4A2540",
    "shape": "hexagon",
    "umbrella": "self:blackberry liqueur"
  },
  {
    "key": "bourbon",
    "disp": "Bourbon",
    "cat": "spirit",
    "color": "#B5651D",
    "shape": "squircle",
    "umbrella": "spirit:whiskey"
  },
  {
    "key": "brown sugar",
    "disp": "Brown sugar",
    "cat": "sugar",
    "color": "#9B6B3A",
    "shape": "cube",
    "umbrella": "self:brown sugar"
  },
  {
    "key": "cachaça",
    "disp": "Cachaça",
    "cat": "spirit",
    "color": "#E1DBAE",
    "shape": "squircle",
    "umbrella": "spirit:cachaça"
  },
  {
    "key": "campari",
    "disp": "Campari",
    "cat": "liqueur",
    "color": "#C3122E",
    "shape": "hexagon",
    "umbrella": "self:campari"
  },
  {
    "key": "candied ginger",
    "disp": "Candied Ginger",
    "cat": "other",
    "color": "#8C857A",
    "shape": null,
    "umbrella": "self:candied ginger"
  },
  {
    "key": "cardamom bitters",
    "disp": "Cardamom bitters",
    "cat": "bitters",
    "color": "#7E8B4A",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "champagne",
    "disp": "Champagne",
    "cat": "fortified",
    "color": "#E8E2B0",
    "shape": "glass",
    "umbrella": "self:champagne"
  },
  {
    "key": "cherry",
    "disp": "Cherry",
    "cat": "fruit",
    "color": "#B5293A",
    "shape": "cherry",
    "umbrella": "self:cherry"
  },
  {
    "key": "chocolate bitters",
    "disp": "Chocolate bitters",
    "cat": "bitters",
    "color": "#5A3520",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "cinnamon syrup",
    "disp": "Cinnamon syrup",
    "cat": "syrup",
    "color": "#8A4B2A",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "coconut cream",
    "disp": "Coconut cream",
    "cat": "other",
    "color": "#F2EAD8",
    "shape": "droplet",
    "umbrella": "self:coconut cream"
  },
  {
    "key": "cognac",
    "disp": "Cognac",
    "cat": "spirit",
    "color": "#9B4D1E",
    "shape": "squircle",
    "umbrella": "spirit:brandy"
  },
  {
    "key": "cranberry",
    "disp": "Cranberry juice",
    "cat": "mixer",
    "color": "#B5293A",
    "shape": "droplet",
    "umbrella": "self:cranberry"
  },
  {
    "key": "crème de cacao",
    "disp": "Crème de cacao",
    "cat": "liqueur",
    "color": "#5A3A29",
    "shape": "hexagon",
    "umbrella": "self:crème de cacao"
  },
  {
    "key": "crème de violette",
    "disp": "Crème de violette",
    "cat": "liqueur",
    "color": "#7A4FA3",
    "shape": "hexagon",
    "umbrella": "self:crème de violette"
  },
  {
    "key": "dark rum",
    "disp": "Dark rum",
    "cat": "spirit",
    "color": "#6E3F1C",
    "shape": "squircle",
    "umbrella": "spirit:rum"
  },
  {
    "key": "dry vermouth",
    "disp": "Dry vermouth",
    "cat": "fortified",
    "color": "#D7D1A0",
    "shape": "glass",
    "umbrella": "vermouth"
  },
  {
    "key": "egg",
    "disp": "Egg",
    "cat": "dairyegg",
    "color": "#F2EEE0",
    "shape": "egg",
    "umbrella": "self:egg"
  },
  {
    "key": "elderflower liqueur",
    "disp": "Elderflower liqueur",
    "cat": "liqueur",
    "color": "#E6E0AE",
    "shape": "hexagon",
    "umbrella": "self:elderflower liqueur"
  },
  {
    "key": "espresso",
    "disp": "Espresso",
    "cat": "other",
    "color": "#3A2417",
    "shape": "droplet",
    "umbrella": "self:espresso"
  },
  {
    "key": "falernum",
    "disp": "Falernum",
    "cat": "liqueur",
    "color": "#D9C28A",
    "shape": "hexagon",
    "umbrella": "self:falernum"
  },
  {
    "key": "gin",
    "disp": "Gin",
    "cat": "spirit",
    "color": "#DCEAF0",
    "shape": "squircle",
    "umbrella": "spirit:gin"
  },
  {
    "key": "ginger beer",
    "disp": "Ginger beer",
    "cat": "mixer",
    "color": "#C9A24B",
    "shape": "droplet",
    "umbrella": "self:ginger beer"
  },
  {
    "key": "ginger extract",
    "disp": "Ginger extract",
    "cat": "extract",
    "color": "#C99A3B",
    "shape": "dropper",
    "umbrella": "self:ginger extract"
  },
  {
    "key": "grapefruit",
    "disp": "Grapefruit",
    "cat": "citrus",
    "color": "#E8806B",
    "shape": "circle",
    "umbrella": "self:grapefruit"
  },
  {
    "key": "green chartreuse",
    "disp": "Green Chartreuse",
    "cat": "liqueur",
    "color": "#3E7A33",
    "shape": "hexagon",
    "umbrella": "chartreuse"
  },
  {
    "key": "honey syrup",
    "disp": "Honey syrup",
    "cat": "syrup",
    "color": "#D6A93B",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "jamaican rum",
    "disp": "Jamaican rum",
    "cat": "spirit",
    "color": "#8A4B1E",
    "shape": "squircle",
    "umbrella": "spirit:rum"
  },
  {
    "key": "kahlúa",
    "disp": "Kahlúa",
    "cat": "liqueur",
    "color": "#3A2417",
    "shape": "hexagon",
    "umbrella": "self:kahlúa"
  },
  {
    "key": "lapsang syrup",
    "disp": "Lapsang syrup",
    "cat": "syrup",
    "color": "#5C3A24",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "lemon",
    "disp": "Lemon",
    "cat": "citrus",
    "color": "#E6C84B",
    "shape": "circle",
    "umbrella": "self:lemon"
  },
  {
    "key": "light rum",
    "disp": "Light rum",
    "cat": "spirit",
    "color": "#E6D7A6",
    "shape": "squircle",
    "umbrella": "spirit:rum"
  },
  {
    "key": "lillet blanc",
    "disp": "Lillet Blanc",
    "cat": "fortified",
    "color": "#E6D98A",
    "shape": "glass",
    "umbrella": "self:lillet blanc"
  },
  {
    "key": "lime",
    "disp": "Lime",
    "cat": "citrus",
    "color": "#8FBF3F",
    "shape": "circle",
    "umbrella": "self:lime"
  },
  {
    "key": "luxardo",
    "disp": "Luxardo",
    "cat": "liqueur",
    "color": "#E7E1D2",
    "shape": "hexagon",
    "umbrella": "self:luxardo"
  },
  {
    "key": "maple syrup",
    "disp": "Maple syrup",
    "cat": "syrup",
    "color": "#B5651D",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "milk",
    "disp": "Milk",
    "cat": "dairyegg",
    "color": "#F0EDE3",
    "shape": "droplet",
    "umbrella": "self:milk"
  },
  {
    "key": "mint",
    "disp": "Mint",
    "cat": "herbspice",
    "color": "#6FAE4B",
    "shape": "sprig",
    "umbrella": "self:mint"
  },
  {
    "key": "nutmeg",
    "disp": "Nutmeg",
    "cat": "herbspice",
    "color": "#8A5A2A",
    "shape": "seed",
    "umbrella": "self:nutmeg"
  },
  {
    "key": "orange",
    "disp": "Orange",
    "cat": "citrus",
    "color": "#E0892B",
    "shape": "circle",
    "umbrella": "self:orange"
  },
  {
    "key": "orange bitters",
    "disp": "Orange bitters",
    "cat": "bitters",
    "color": "#E0892B",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "orange curaçao",
    "disp": "Orange Curaçao",
    "cat": "liqueur",
    "color": "#E0892B",
    "shape": "hexagon",
    "umbrella": "self:orange curaçao"
  },
  {
    "key": "orgeat",
    "disp": "Orgeat",
    "cat": "syrup",
    "color": "#E6DAB8",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "passion fruit liqueur",
    "disp": "Passion fruit liqueur",
    "cat": "liqueur",
    "color": "#E8852B",
    "shape": "hexagon",
    "umbrella": "self:passion fruit liqueur"
  },
  {
    "key": "peach bitters",
    "disp": "Peach bitters",
    "cat": "bitters",
    "color": "#E6A968",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "peychaud bitters",
    "disp": "Peychaud bitters",
    "cat": "bitters",
    "color": "#D14B3A",
    "shape": "triangle",
    "umbrella": "bitters"
  },
  {
    "key": "pineapple",
    "disp": "Pineapple juice",
    "cat": "mixer",
    "color": "#E8C13A",
    "shape": "droplet",
    "umbrella": "self:pineapple"
  },
  {
    "key": "pomegranate",
    "disp": "Pomegranate juice",
    "cat": "mixer",
    "color": "#9E2A3A",
    "shape": "droplet",
    "umbrella": "self:pomegranate"
  },
  {
    "key": "raspberry",
    "disp": "Raspberry",
    "cat": "fruit",
    "color": "#B02A4A",
    "shape": "berry",
    "umbrella": "self:raspberry"
  },
  {
    "key": "red wine",
    "disp": "Red wine",
    "cat": "fortified",
    "color": "#6E1F2E",
    "shape": "glass",
    "umbrella": "self:red wine"
  },
  {
    "key": "rye",
    "disp": "Rye",
    "cat": "spirit",
    "color": "#C06A22",
    "shape": "squircle",
    "umbrella": "spirit:whiskey"
  },
  {
    "key": "saline solution",
    "disp": "Saline solution",
    "cat": "other",
    "color": "#DDE6EC",
    "shape": "dropper",
    "umbrella": "self:saline solution"
  },
  {
    "key": "scotch",
    "disp": "Scotch",
    "cat": "spirit",
    "color": "#A85A1A",
    "shape": "squircle",
    "umbrella": "spirit:whiskey"
  },
  {
    "key": "simple syrup",
    "disp": "Simple syrup",
    "cat": "syrup",
    "color": "#DDE2E6",
    "shape": "bottle",
    "umbrella": "syrup"
  },
  {
    "key": "soda water",
    "disp": "Soda water",
    "cat": "mixer",
    "color": "#DCE8EE",
    "shape": "droplet",
    "umbrella": "self:soda water"
  },
  {
    "key": "spirit",
    "disp": "Spirit",
    "cat": "spirit",
    "color": "#E0E6EC",
    "shape": "squircle",
    "umbrella": "spirit:neutral"
  },
  {
    "key": "sweet vermouth",
    "disp": "Sweet vermouth",
    "cat": "fortified",
    "color": "#7A2E2E",
    "shape": "glass",
    "umbrella": "vermouth"
  },
  {
    "key": "tequila",
    "disp": "Tequila",
    "cat": "spirit",
    "color": "#E6E0AE",
    "shape": "squircle",
    "umbrella": "spirit:tequila"
  },
  {
    "key": "tonic water",
    "disp": "Tonic water",
    "cat": "mixer",
    "color": "#DCE8EE",
    "shape": "droplet",
    "umbrella": "self:tonic water"
  },
  {
    "key": "yellow chartreuse",
    "disp": "Yellow Chartreuse",
    "cat": "liqueur",
    "color": "#D7C23A",
    "shape": "hexagon",
    "umbrella": "chartreuse"
  }
];

/** Classification per ingredient key (incl. generic umbrellas), used to render
 *  recipe chips at runtime without running the parser regex. */
export const INGREDIENT_CLASS: Record<string, Classified> = {
  "absinthe": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#9FCB3B",
    "abv": 0.62,
    "disp": "Absinthe",
    "fam": "absinthe"
  },
  "amaretto": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#9B5A2A",
    "abv": 0.24,
    "disp": "Amaretto"
  },
  "angostura bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#A8412E",
    "abv": 0.44,
    "disp": "Angostura Bitters"
  },
  "aperol": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#F4531E",
    "abv": 0.11,
    "disp": "Aperol"
  },
  "apple brandy": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#B86A2A",
    "abv": 0.4,
    "disp": "Apple brandy",
    "fam": "brandy"
  },
  "arugula extract": {
    "cat": "herb",
    "shape": "leaf",
    "color": "#6B8F3F",
    "abv": 0,
    "disp": "Arugula extract"
  },
  "bailey's": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#CBA980",
    "abv": 0.17,
    "disp": "Bailey's"
  },
  "bénédictine": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#C8902E",
    "abv": 0.4,
    "disp": "Bénédictine"
  },
  "bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#8A5A33",
    "abv": 0.44,
    "disp": "Bitters"
  },
  "blackberry liqueur": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#4A2540",
    "abv": 0.2,
    "disp": "Blackberry liqueur"
  },
  "bourbon": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#B5651D",
    "abv": 0.4,
    "disp": "Bourbon",
    "fam": "whiskey"
  },
  "brandy": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#A85A2A",
    "abv": 0.4,
    "disp": "Brandy",
    "fam": "brandy"
  },
  "brown sugar": {
    "cat": "sugar",
    "shape": "diamond",
    "color": "#9B6B3A",
    "abv": 0,
    "disp": "Brown sugar"
  },
  "cachaça": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#E1DBAE",
    "abv": 0.4,
    "disp": "Cachaça",
    "fam": "cachaça"
  },
  "campari": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#C3122E",
    "abv": 0.24,
    "disp": "Campari"
  },
  "candied ginger": {
    "cat": "other",
    "shape": "circle",
    "color": "#8C857A",
    "abv": 0,
    "disp": "Candied Ginger"
  },
  "cardamom bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#7E8B4A",
    "abv": 0.44,
    "disp": "Cardamom Bitters"
  },
  "champagne": {
    "cat": "fortified",
    "shape": "glass",
    "color": "#E8E2B0",
    "abv": 0.12,
    "disp": "Champagne",
    "fam": "wine"
  },
  "cherry": {
    "cat": "fruit",
    "shape": "circle",
    "color": "#B5293A",
    "abv": 0,
    "disp": "Cherry"
  },
  "chocolate bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#5A3520",
    "abv": 0.44,
    "disp": "Chocolate Bitters"
  },
  "cinnamon syrup": {
    "cat": "syrup",
    "shape": "droplet",
    "color": "#8A4B2A",
    "abv": 0,
    "disp": "Cinnamon syrup",
    "syrup": "cinnamon"
  },
  "coconut cream": {
    "cat": "other",
    "shape": "droplet",
    "color": "#F2EAD8",
    "abv": 0,
    "disp": "Coconut cream"
  },
  "cognac": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#9B4D1E",
    "abv": 0.4,
    "disp": "Cognac",
    "fam": "brandy"
  },
  "cranberry": {
    "cat": "fruit",
    "shape": "circle",
    "color": "#B5293A",
    "abv": 0,
    "disp": "Cranberry"
  },
  "crème de cacao": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#5A3A29",
    "abv": 0.24,
    "disp": "Crème de cacao"
  },
  "crème de violette": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#7A4FA3",
    "abv": 0.2,
    "disp": "Crème de violette"
  },
  "dark rum": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#6E3F1C",
    "abv": 0.4,
    "disp": "Dark rum",
    "fam": "rum"
  },
  "dry vermouth": {
    "cat": "fortified",
    "shape": "glass",
    "color": "#D7D1A0",
    "abv": 0.17,
    "disp": "Dry vermouth",
    "fam": "wine"
  },
  "egg": {
    "cat": "egg",
    "shape": "ellipse",
    "color": "#F2EEE0",
    "abv": 0,
    "disp": "Egg white"
  },
  "elderflower liqueur": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#E6E0AE",
    "abv": 0.2,
    "disp": "Elderflower liqueur"
  },
  "espresso": {
    "cat": "other",
    "shape": "droplet",
    "color": "#3A2417",
    "abv": 0,
    "disp": "Espresso"
  },
  "falernum": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#D9C28A",
    "abv": 0.11,
    "disp": "Falernum"
  },
  "gin": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#DCEAF0",
    "abv": 0.4,
    "disp": "Gin",
    "fam": "gin"
  },
  "ginger beer": {
    "cat": "soda",
    "shape": "soda",
    "color": "#C9A24B",
    "abv": 0,
    "disp": "Ginger beer"
  },
  "ginger extract": {
    "cat": "other",
    "shape": "droplet",
    "color": "#C99A3B",
    "abv": 0,
    "disp": "Ginger extract"
  },
  "grapefruit": {
    "cat": "citrus",
    "shape": "circle",
    "color": "#E8806B",
    "abv": 0,
    "disp": "Grapefruit",
    "citrus": "grapefruit"
  },
  "green chartreuse": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#3E7A33",
    "abv": 0.55,
    "disp": "Green Chartreuse"
  },
  "honey syrup": {
    "cat": "syrup",
    "shape": "droplet",
    "color": "#D6A93B",
    "abv": 0,
    "disp": "Honey syrup",
    "syrup": "honey"
  },
  "jamaican rum": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#8A4B1E",
    "abv": 0.4,
    "disp": "Jamaican rum",
    "fam": "rum"
  },
  "kahlúa": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#3A2417",
    "abv": 0.2,
    "disp": "Kahlúa"
  },
  "lapsang syrup": {
    "cat": "syrup",
    "shape": "droplet",
    "color": "#5C3A24",
    "abv": 0,
    "disp": "Lapsang syrup",
    "syrup": "lapsang"
  },
  "lemon": {
    "cat": "citrus",
    "shape": "circle",
    "color": "#E6C84B",
    "abv": 0,
    "disp": "Lemon",
    "citrus": "lemon"
  },
  "light rum": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#E6D7A6",
    "abv": 0.4,
    "disp": "Light rum",
    "fam": "rum"
  },
  "lillet blanc": {
    "cat": "fortified",
    "shape": "glass",
    "color": "#E6D98A",
    "abv": 0.17,
    "disp": "Lillet Blanc",
    "fam": "wine"
  },
  "lime": {
    "cat": "citrus",
    "shape": "circle",
    "color": "#8FBF3F",
    "abv": 0,
    "disp": "Lime",
    "citrus": "lime"
  },
  "luxardo": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#E7E1D2",
    "abv": 0.32,
    "disp": "Luxardo"
  },
  "maple syrup": {
    "cat": "syrup",
    "shape": "bottle",
    "color": "#B5651D",
    "abv": 0,
    "disp": "Maple syrup",
    "syrup": "generic"
  },
  "milk": {
    "cat": "dairy",
    "shape": "droplet",
    "color": "#F0EDE3",
    "abv": 0,
    "disp": "Milk"
  },
  "mint": {
    "cat": "herb",
    "shape": "leaf",
    "color": "#6FAE4B",
    "abv": 0,
    "disp": "Mint"
  },
  "nutmeg": {
    "cat": "spice",
    "shape": "diamond",
    "color": "#8A5A2A",
    "abv": 0,
    "disp": "Nutmeg"
  },
  "orange": {
    "cat": "citrus",
    "shape": "circle",
    "color": "#E0892B",
    "abv": 0,
    "disp": "Orange",
    "citrus": "orange"
  },
  "orange bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#E0892B",
    "abv": 0.44,
    "disp": "Orange Bitters"
  },
  "orange curaçao": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#E0892B",
    "abv": 0.4,
    "disp": "Orange Curaçao"
  },
  "orgeat": {
    "cat": "syrup",
    "shape": "bottle",
    "color": "#E6DAB8",
    "abv": 0,
    "disp": "Orgeat",
    "syrup": "orgeat"
  },
  "passion fruit liqueur": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#E8852B",
    "abv": 0.18,
    "disp": "Passion fruit liqueur"
  },
  "peach bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#E6A968",
    "abv": 0.44,
    "disp": "Peach Bitters"
  },
  "peychaud bitters": {
    "cat": "bitters",
    "shape": "triangle",
    "color": "#D14B3A",
    "abv": 0.44,
    "disp": "Peychaud Bitters"
  },
  "pineapple": {
    "cat": "fruit",
    "shape": "circle",
    "color": "#E8C13A",
    "abv": 0,
    "disp": "Pineapple"
  },
  "pomegranate": {
    "cat": "fruit",
    "shape": "circle",
    "color": "#9E2A3A",
    "abv": 0,
    "disp": "Pomegranate"
  },
  "raspberry": {
    "cat": "fruit",
    "shape": "circle",
    "color": "#B02A4A",
    "abv": 0,
    "disp": "Raspberry"
  },
  "red wine": {
    "cat": "fortified",
    "shape": "glass",
    "color": "#6E1F2E",
    "abv": 0.13,
    "disp": "Red wine",
    "fam": "wine"
  },
  "rum": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#C99A5B",
    "abv": 0.4,
    "disp": "Rum",
    "fam": "rum"
  },
  "rye": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#C06A22",
    "abv": 0.4,
    "disp": "Rye",
    "fam": "whiskey"
  },
  "saline solution": {
    "cat": "other",
    "shape": "diamond",
    "color": "#DDE6EC",
    "abv": 0,
    "disp": "Saline solution"
  },
  "scotch": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#A85A1A",
    "abv": 0.4,
    "disp": "Scotch",
    "fam": "whiskey"
  },
  "simple syrup": {
    "cat": "syrup",
    "shape": "droplet",
    "color": "#DDE2E6",
    "abv": 0,
    "disp": "Simple syrup",
    "syrup": "simple"
  },
  "soda water": {
    "cat": "soda",
    "shape": "soda",
    "color": "#DCE8EE",
    "abv": 0,
    "disp": "Soda water"
  },
  "spirit": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#E0E6EC",
    "abv": 0.4,
    "disp": "Spirit",
    "fam": "neutral"
  },
  "sweet vermouth": {
    "cat": "fortified",
    "shape": "glass",
    "color": "#7A2E2E",
    "abv": 0.17,
    "disp": "Sweet vermouth",
    "fam": "wine"
  },
  "syrup": {
    "cat": "syrup",
    "shape": "droplet",
    "color": "#C9B98A",
    "abv": 0,
    "disp": "Syrup",
    "syrup": "generic"
  },
  "tequila": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#E6E0AE",
    "abv": 0.4,
    "disp": "Tequila",
    "fam": "tequila"
  },
  "tonic water": {
    "cat": "soda",
    "shape": "soda",
    "color": "#DCE8EE",
    "abv": 0,
    "disp": "Tonic water"
  },
  "whiskey": {
    "cat": "spirit",
    "shape": "squircle",
    "color": "#B5651D",
    "abv": 0.4,
    "disp": "Whiskey",
    "fam": "whiskey"
  },
  "yellow chartreuse": {
    "cat": "liqueur",
    "shape": "hexagon",
    "color": "#D7C23A",
    "abv": 0.4,
    "disp": "Yellow Chartreuse"
  }
};

/** Structural-name -> key index for matching recipe text to the catalog. */
export const INGREDIENT_ALIASES: Record<string, string> = {
  "absinthe": "absinthe",
  "amaretto": "amaretto",
  "angostura bitters": "angostura bitters",
  "aperol": "aperol",
  "apple brandy": "apple brandy",
  "arugula extract": "arugula extract",
  "bailey's": "bailey's",
  "bénédictine": "bénédictine",
  "bitters": "bitters",
  "blackberry liqueur": "blackberry liqueur",
  "bourbon": "bourbon",
  "brandy": "brandy",
  "brown sugar": "brown sugar",
  "cacao": "crème de cacao",
  "cachaça": "cachaça",
  "campari": "campari",
  "candied ginger": "candied ginger",
  "cardamom bitters": "cardamom bitters",
  "champagne": "champagne",
  "cherry": "cherry",
  "chocolate bitters": "chocolate bitters",
  "cinnamon": "cinnamon syrup",
  "coconut cream": "coconut cream",
  "cognac": "cognac",
  "cranberry": "cranberry",
  "curaçao": "orange curaçao",
  "dark rum": "dark rum",
  "dry vermouth": "dry vermouth",
  "egg white": "egg",
  "elderflower liqueur": "elderflower liqueur",
  "espresso": "espresso",
  "falernum": "falernum",
  "gin": "gin",
  "ginger beer": "ginger beer",
  "ginger extract": "ginger extract",
  "grapefruit": "grapefruit",
  "grapefruit juice": "grapefruit",
  "grapefruit peel": "grapefruit",
  "grapefruit twist": "grapefruit",
  "grapefruit wedge": "grapefruit",
  "grapefruit wedges": "grapefruit",
  "grapefruit wheel": "grapefruit",
  "green chartreuse": "green chartreuse",
  "honey": "honey syrup",
  "jamaican rum": "jamaican rum",
  "kahlua": "kahlúa",
  "lapsang": "lapsang syrup",
  "lemon": "lemon",
  "lemon juice": "lemon",
  "lemon peel": "lemon",
  "lemon twist": "lemon",
  "lemon wedge": "lemon",
  "lemon wedges": "lemon",
  "lemon wheel": "lemon",
  "light rum": "light rum",
  "lillet blanc": "lillet blanc",
  "lime": "lime",
  "lime juice": "lime",
  "lime peel": "lime",
  "lime twist": "lime",
  "lime wedge": "lime",
  "lime wedges": "lime",
  "lime wheel": "lime",
  "luxardo": "luxardo",
  "maple syrup": "maple syrup",
  "milk": "milk",
  "mint": "mint",
  "nutmeg": "nutmeg",
  "orange": "orange",
  "orange bitters": "orange bitters",
  "orange juice": "orange",
  "orange peel": "orange",
  "orange twist": "orange",
  "orange wedge": "orange",
  "orange wedges": "orange",
  "orange wheel": "orange",
  "orgeat": "orgeat",
  "passionfruit liqueur": "passion fruit liqueur",
  "peach bitters": "peach bitters",
  "peychaud bitters": "peychaud bitters",
  "pineapple": "pineapple",
  "pomegranate": "pomegranate",
  "prosecco": "champagne",
  "raspberry": "raspberry",
  "red wine": "red wine",
  "rum": "rum",
  "rye": "rye",
  "saline": "saline solution",
  "scotch": "scotch",
  "simple": "simple syrup",
  "soda": "soda water",
  "spirit": "spirit",
  "sweet vermouth": "sweet vermouth",
  "syrup": "syrup",
  "tequila": "tequila",
  "tonic water": "tonic water",
  "violette": "crème de violette",
  "whiskey": "whiskey",
  "yellow chartreuse": "yellow chartreuse"
};

/** Umbrella keys that have at least one specific member (generic-match targets). */
export const ACTIVE_UMBRELLAS: string[] = [
  "bitters",
  "chartreuse",
  "self:amaretto",
  "self:aperol",
  "self:arugula extract",
  "self:bailey's",
  "self:blackberry liqueur",
  "self:brown sugar",
  "self:bénédictine",
  "self:campari",
  "self:candied ginger",
  "self:champagne",
  "self:cherry",
  "self:coconut cream",
  "self:cranberry",
  "self:crème de cacao",
  "self:crème de violette",
  "self:egg",
  "self:elderflower liqueur",
  "self:espresso",
  "self:falernum",
  "self:ginger beer",
  "self:ginger extract",
  "self:grapefruit",
  "self:kahlúa",
  "self:lemon",
  "self:lillet blanc",
  "self:lime",
  "self:luxardo",
  "self:milk",
  "self:mint",
  "self:nutmeg",
  "self:orange",
  "self:orange curaçao",
  "self:passion fruit liqueur",
  "self:pineapple",
  "self:pomegranate",
  "self:raspberry",
  "self:red wine",
  "self:saline solution",
  "self:soda water",
  "self:tonic water",
  "spirit:absinthe",
  "spirit:brandy",
  "spirit:cachaça",
  "spirit:gin",
  "spirit:rum",
  "spirit:whiskey",
  "syrup",
  "vermouth"
];
