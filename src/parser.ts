import type { Classified, Ingredient, ParsedLine, Role } from "./types";

/* ============================================================
   Cocktail shorthand parser

   The parser turns shorthand into structured ingredients (quantities, units, roles,
   methods). It does NOT classify ingredients itself — classification (category,
   colour, abv, display name, family) comes from ingredients-seed.ts via an injected
   classifier (setClassifier). The app injects the seed-backed classifier at startup;
   anything the seed doesn't know renders as a plain, icon-less, sentence-cased chip.
   ============================================================ */

export const SPIRIT_FAMILIES = [
  "rum",
  "whiskey",
  "tequila",
  "gin",
  "brandy",
  "absinthe",
  "aquavit",
  "wine",
  "neutral",
];
export const FAMILY_LABEL: Record<string, string> = {
  rum: "Rum",
  whiskey: "Whiskey",
  tequila: "Tequila",
  gin: "Gin",
  brandy: "Brandy",
  cachaça: "Cachaça",
  absinthe: "Absinthe",
  aquavit: "Aquavit",
  wine: "Wine",
  neutral: "Neutral spirit",
};
export const METHOD_ORDER = ["shaken", "stirred", "built"];

export const titleCase = (s: string): string =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());
export const sentenceCase = (s: string): string => {
  s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Default classifier: everything is unknown (icon-less, sentence-cased). The app
 *  swaps in the seed-backed classifier at startup via setClassifier; tests do the
 *  same (see src/test-setup.ts). ingredients-seed.ts is the source of truth. */
function unknownClassify(name: string): Classified {
  return {
    cat: "unknown",
    shape: "",
    color: "#8C857A",
    abv: 0,
    disp: sentenceCase(name),
  };
}

/** The classifier parseIngredient uses. Swappable so the app (and tests) resolve
 *  ingredients from the committed seed rather than any built-in table. */
let activeClassifier: (name: string) => Classified = unknownClassify;
export function setClassifier(fn: (name: string) => Classified): void {
  activeClassifier = fn;
}

const FRAC: Record<string, number> = {
  "1/2": 0.5,
  "1/4": 0.25,
  "3/4": 0.75,
  "1/3": 1 / 3,
  "2/3": 2 / 3,
  "1/6": 1 / 6,
  "1/8": 0.125,
  "3/2": 1.5,
  "5/2": 2.5,
};

export function parseNum(t: string): number | null {
  const f = FRAC[t];
  if (f !== undefined) return f;
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return a! / b!;
  }
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return null;
}

export function parseIngredient(raw: string): Ingredient {
  let s = raw.trim();
  let prefix: string | null = null;
  const pm = s.match(/^(top|float|dash|muddled)\s+/i);
  if (pm) {
    prefix = pm[1]!.toLowerCase();
    s = s.slice(pm[0].length);
  }
  const tm = s.match(/\s+muddled$/i);
  if (tm) {
    prefix = "muddled";
    s = s.slice(0, -tm[0].length);
  }
  let qty: number | null = null;
  let unit: string | null = null;
  const qm = s.match(/^(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*/);
  if (qm) {
    qty = parseNum(qm[1]!.replace(/\s/g, ""));
    s = s.slice(qm[0].length);
  }
  const um = s.match(/^(oz|tsp|tbsp|ml|cl)\s+/i);
  if (um) {
    unit = um[1]!.toLowerCase();
    s = s.slice(um[0].length);
  }
  const name = s.trim();
  const info = activeClassifier(name);
  const lname = name.toLowerCase();
  const isCount = /\bwedges?\b/.test(lname);
  const isPeel = /\b(peel|wheel|twist)\b/.test(lname);
  let role: Role;
  if (prefix === "top") role = "top";
  else if (prefix === "float") role = "float";
  else if (prefix === "dash") role = "dash";
  else if (prefix === "muddled") role = "muddled";
  else if (info.cat === "egg") role = "egg";
  else if (info.cat === "bitters") role = "bitters";
  else if (isCount) role = "count";
  else if (qty != null && unit === "tsp") role = "measure";
  else if (qty != null) role = "pour";
  else role = "garnish";
  if (role === "pour" && !unit) unit = "oz";
  if (role === "count") unit = "wedge";

  const liquid =
    role === "pour" ||
    role === "float" ||
    role === "measure" ||
    role === "dash";
  let disp = info.disp;
  let eggMod: string | null = null;
  if (info.cat === "egg") {
    const w = lname.split(/\s+/).filter((x) => x && x !== "egg");
    eggMod = w[0] || "whole";
    disp = "Egg";
  } else if (isPeel) {
    disp = sentenceCase(name);
  } else if (info.cat === "bitters") {
    disp = sentenceCase(name);
  } else if ((info.cat === "citrus" || info.cat === "fruit") && liquid) {
    // Only append " juice" when the display name doesn't already carry it —
    // non-citrus juices (pineapple, cranberry, pomegranate) seed disp as
    // "Pineapple juice" etc., so blind concatenation produced "juice juice".
    disp = /\bjuice$/i.test(info.disp) ? info.disp : info.disp + " juice";
  }

  return {
    raw,
    name,
    disp,
    qty,
    unit,
    role,
    prefix,
    cat: info.cat,
    fam: info.fam || null,
    color: info.color,
    abv: info.abv,
    citrus: info.citrus || null,
    syrup: info.syrup || null,
    eggMod,
  };
}

export function parseLine(line: string): ParsedLine | null {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const name = line.slice(0, idx).trim();
  let body = line.slice(idx + 1).trim();
  let method = "shaken";
  let hasMethod = false;
  const mm = body.match(/\(([^)]+)\)\s*$/);
  if (mm) {
    method = mm[1]!.trim().toLowerCase();
    body = body.slice(0, mm.index).trim();
    hasMethod = true;
  }
  const parts = body
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    name,
    body,
    method,
    hasMethod,
    ingredients: parts.map(parseIngredient),
  };
}

export function volOz(i: Ingredient): number {
  if (i.role === "pour" || i.role === "float") return i.qty || 0;
  if (i.role === "measure") return (i.qty || 0) / 6;
  if (i.role === "dash" || i.role === "bitters") return 0.03 * (i.qty || 1);
  return 0;
}

export const estAlcoholOz = (r: ParsedLine): number =>
  r.ingredients.reduce((t, i) => t + volOz(i) * i.abv, 0);

export function baseSpirit(r: ParsedLine): string | null {
  const sp = r.ingredients.filter((i) => i.cat === "spirit");
  if (sp.length) {
    sp.sort((a, b) => volOz(b) - volOz(a));
    return sp[0]!.fam;
  }
  // No true spirit — fall back to the largest-pour fortified wine (e.g. an Aperol Spritz).
  const fz = r.ingredients.filter((i) => i.cat === "fortified" && i.fam);
  if (fz.length) {
    fz.sort((a, b) => volOz(b) - volOz(a));
    return fz[0]!.fam;
  }
  return null;
}
