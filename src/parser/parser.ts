import type { Classified, Form, Ingredient, ParseCtx, ParsedLine, Process, Role, UnitDef } from "../core/types";

/* ============================================================
   Cocktail shorthand parser

   The parser turns shorthand into structured ingredients (quantities, units, roles,
   methods). It does NOT classify ingredients itself — classification (category,
   colour, abv, display name, family) comes from ingredients-seed.ts via an injected
   classifier (setClassifier). The app injects the seed-backed classifier at startup;
   anything the seed doesn't know renders as a plain, icon-less, sentence-cased chip.
   ============================================================ */

/** Base-spirit family ids — the umbrella parents (or self-keys) that count as a base
 *  spirit, in display order. An ingredient's family = the first of [key, ...umbrellas]
 *  in this set (see familyOf in catalog.ts). Drives "group by spirit" + the base-spirit
 *  sort/label. "spirit" is the neutral family (labelled "Neutral spirit"). */
export const SPIRIT_FAMILIES = [
  "cane",
  "whiskey",
  "agave",
  "gin",
  "brandy",
  "absinthe",
  "wine",
  "spirit",
];
export const FAMILY_LABEL: Record<string, string> = {
  cane: "Cane",
  whiskey: "Whiskey",
  agave: "Agave",
  gin: "Gin",
  brandy: "Brandy",
  absinthe: "Absinthe",
  wine: "Wine",
  spirit: "Neutral spirit",
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
 *  ingredients from the committed seed rather than any built-in table. The parse
 *  context rides along so context-scoped aliases and forms resolve per recipe kind. */
let activeClassifier: (name: string, ctx: ParseCtx) => Classified = unknownClassify;
export function setClassifier(fn: (name: string, ctx: ParseCtx) => Classified): void {
  activeClassifier = fn;
}

/** The leading-unit registry: the units the parser recognises in the `qty <unit>`
 *  slot. Volumetric units carry their oz-per-unit (feeding the alcohol estimate);
 *  a null volOz marks a discrete/count unit (e.g. "slice"). This is the built-in
 *  base set — the app injects base + user-declared units via setUnits at startup,
 *  so new units resolve without editing this file. ml/cl/tbsp now convert by their
 *  real volume (previously any non-tsp unit was treated as oz). */
export const BASE_UNITS: UnitDef[] = [
  { id: "oz", volOz: 1 },
  { id: "tsp", volOz: 1 / 6 },
  { id: "tbsp", volOz: 1 / 2 },
  { id: "ml", volOz: 1 / 29.5735 },
  { id: "cl", volOz: 1 / 2.95735 },
];

let unitRegistry = new Map<string, UnitDef>(BASE_UNITS.map((u) => [u.id, u]));
/** Replace the recognised unit set (base + user-declared). Mirrors setClassifier:
 *  units are positional/global, so they can't ride the per-name classifier. */
export function setUnits(units: UnitDef[]): void {
  unitRegistry = new Map(units.map((u) => [u.id, u]));
}
export const unitDef = (id: string | null): UnitDef | undefined =>
  id ? unitRegistry.get(id) : undefined;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The trailing form (citrus wedge/peel/…) a name carries, if any. Scans the
 *  ingredient's forms for a keyword/alias appearing as a whole word in the name.
 *  The bare/default form (empty keyword) is skipped here — it shapes display only,
 *  not role — and is consulted directly by parseIngredient. */
function matchForm(lname: string, forms: Form[]): Form | null {
  for (const f of forms) {
    if (!f.keyword) continue;
    for (const tok of [f.keyword, ...(f.aliases ?? [])])
      if (new RegExp(`\\b${escapeRe(tok)}\\b`, "i").test(lname)) return f;
  }
  return null;
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

export function parseIngredient(raw: string, ctx: ParseCtx = "cocktail"): Ingredient {
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
  // Leading unit: the first token, if it's a registered unit (oz/tsp/… + any the user
  // has declared). Token-matched against the injected registry, not a literal regex,
  // so new units resolve without editing the parser.
  const utok = s.match(/^(\S+)\s+/);
  if (utok && unitRegistry.has(utok[1]!.toLowerCase())) {
    unit = utok[1]!.toLowerCase();
    s = s.slice(utok[0].length);
  }
  const name = s.trim();
  const info = activeClassifier(name, ctx);
  const lname = name.toLowerCase();
  // Forms (citrus wedge/peel, egg white/yolk, …) come from the classifier, so the parser
  // stays seed-free and generic. A *keyword* form matches a trailing word; the *default*
  // form (empty keyword) is the ingredient's bare-measure rule (citrus pour+juice, bitters
  // dash, egg count). Either one decides the measure.
  const forms = info.forms ?? [];
  const form = matchForm(lname, forms);       // matched trailing keyword (wedge/peel/white)
  const defForm = forms.find((f) => !f.keyword); // the ingredient's bare-measure default
  const discreteUnit = unit != null && unitDef(unit)?.volOz == null;
  // Amount/measure ladder. `top`/`dash` prefixes set the measure directly; `float`/
  // `muddled` are PROCESS words (handled below), so they fall through to the normal
  // measure. No implicit garnish — garnish is a process declared on a form, not a measure.
  let role: Role;
  if (prefix === "top") role = "top";
  else if (prefix === "dash") role = "dash";
  else if (form) role = form.role;
  else if (qty != null && discreteUnit) role = "count"; // e.g. "1 slice bread"
  else if (qty != null && unit === "tsp") role = "measure";
  else if (defForm) role = defForm.role; // citrus pour, bitters dash, egg/cherry count
  // Universal fallback, by context: cocktail shorthand pours a bare number ("2 rum" =
  // 2 oz); food counts it ("2 naan" = 2 naan). A bare unqualified name stays a blank
  // pour chip in both.
  else if (ctx === "food" && qty != null) role = "count";
  else role = "pour"; // bare number or nothing → pour (blank amount when no quantity)
  // The implicit-oz default is cocktail shorthand only; food pours stay unitless
  // unless the default form names a unit (volOz then resolves them to nothing).
  if (role === "pour" && !unit) unit = defForm?.unit ?? (ctx === "cocktail" ? "oz" : null);
  // A count form (keyword like "wedge", or the bare default like mint→"sprig") carries
  // its own unit word, or stays a bare count; a leading discrete unit (slice) keeps the
  // unit it was parsed with.
  if (role === "count") {
    if (form) unit = form.unit ?? null;
    else if (!discreteUnit && defForm) unit = defForm.unit ?? null;
  }

  // Process/positional word (gray tag), orthogonal to the amount: an explicit float/
  // muddle prefix wins, else the form's default process (garnish/grate). Mutually
  // exclusive — one slot — so "muddled mint" shows muddle, not muddle+garnish.
  const process: Process | null =
    prefix === "float" ? "float"
    : prefix === "muddled" ? "muddle"
    : (form?.process ?? defForm?.process ?? null);

  const liquid = role === "pour" || role === "measure" || role === "dash";
  let disp = info.disp;
  if (form && (form.disp === "asis" || form.disp === "sentence")) {
    disp = sentenceCase(name); // peel/wheel/twist, egg white/yolk render the keyword
  } else if (liquid && qty != null && (form?.disp === "juice" || defForm?.disp === "juice")) {
    // Append " juice" once, only for an actual poured quantity (a bare "lime" garnish-y
    // mention stays "Lime"). Non-citrus juices already carry it in disp, so guard against
    // doubling.
    disp = /\bjuice$/i.test(info.disp) ? info.disp : info.disp + " juice";
  }

  return {
    raw,
    name,
    disp,
    qty,
    unit,
    role,
    process,
    cat: info.cat,
    fam: info.fam || null,
    color: info.color,
    abv: info.abv,
    citrus: info.citrus || null,
    syrup: info.syrup || null,
    shape: info.shape || null,
    key: info.key ?? null,
    formIcon: form?.icon ?? null,
  };
}

export function parseLine(line: string, ctx: ParseCtx = "cocktail"): ParsedLine | null {
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
    ingredients: parts.map((p) => parseIngredient(p, ctx)),
  };
}

export function volOz(i: Ingredient): number {
  // A dash is a fixed splash (bitters resolve to dash too), independent of any unit.
  if (i.role === "dash") return 0.03 * (i.qty || 1);
  // Otherwise the volume comes from the unit (oz=1, tsp=1/6, …); discrete units
  // (volOz null, e.g. wedge/slice) and unitless garnishes contribute nothing.
  const u = unitDef(i.unit);
  if (u && u.volOz != null) return u.volOz * (i.qty || 0);
  // A pour with no explicit unit is in oz (a float resolves to a pour + float process).
  if (i.role === "pour") return i.qty || 0;
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
