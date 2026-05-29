/**
 * Codemod — tokenise les prix en dur de la prose villes (Sprint Pricing SSOT 2026-05-29).
 *
 * Remplace les montants € écrits en dur dans `src/content/villes/copy/*.ts`
 * par des tokens `{{price:<tierId>}}` résolus au rendu depuis `pricing.ts`
 * (cf. `src/content/pricing-tokens.ts`, branché dans `villes/index.ts`).
 *
 * SÛRETÉ :
 *  - DRY-RUN par défaut (n'écrit RIEN). `--apply` pour écrire.
 *  - Ne remplace QUE les montants Axion-IA reconnus. Forme « X € HT » → token
 *    `flat`/subtier (rend « X € HT ») ; forme compacte « X € » → token `compact`
 *    (rend « X € »). Rendu strictement identique à l'existant.
 *  - Montants hors-SSOT (données économiques : revenu médian, immobilier…),
 *    ranges non-SSOT et valeurs ambiguës non résolues par le contexte/bloc-service
 *    sont LAISSÉES en l'état et listées dans le rapport.
 *  - Idempotent (les tokens ne contiennent pas de « € »).
 *  - Map valeur→tier DÉRIVÉE de pricing.ts + assertions anti-drift.
 *
 * Usage :
 *   pnpm tsx scripts/pricing/tokenize-ville-prices.ts            # dry-run + rapport
 *   pnpm tsx scripts/pricing/tokenize-ville-prices.ts --apply    # écrit les fichiers
 *   pnpm tsx scripts/pricing/tokenize-ville-prices.ts --limit 20 # dry-run sur 20 fichiers
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  MAINTENANCE_TIERS,
  ESSENTIELLE_SUB_TIERS,
  APPROFONDIE_SUB_TIERS,
  AUDIT_CIBLE_SUB_TIERS,
  AUDIT_STRATEGIQUE_PME_SUB_TIERS,
  AUDIT_STRATEGIQUE_ETI_SUB_TIERS,
  getTierById,
} from "@/content/pricing";

const COPY_DIR = path.resolve(process.cwd(), "src/content/villes/copy");
const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1] ?? "0", 10) : 0;

type Kind = "tierFlat" | "subtier" | "tierEntry";
interface Target {
  id: string;
  kind: Kind;
}

/** Construit le token string selon la présence de « HT » (sinon compact). */
function buildToken(t: Target, hasHT: boolean): string {
  if (!hasHT) return `${t.id}|compact`;
  if (t.kind === "tierFlat") return `${t.id}|flat`;
  if (t.kind === "tierEntry") return `${t.id}|entry`;
  return t.id; // subtier — mode défaut rend formatAmount(priceFlat) = « X € HT »
}

const subPrice = (arr: ReadonlyArray<{ id: string; priceFlat: number }>, id: string): number => {
  const t = arr.find((s) => s.id === id);
  if (!t) throw new Error(`[codemod] sous-tier introuvable: ${id}`);
  return t.priceFlat;
};

// ── Valeurs NON ambiguës → (value, target, ssot pour assertion anti-drift) ──
const UNAMBIGUOUS: Array<{ value: number; target: Target; ssot: number }> = [
  {
    value: 490,
    target: { id: "audit-flash", kind: "tierFlat" },
    ssot: getTierById(AUDIT_TIERS, "audit-flash").priceFlat!,
  },
  {
    value: 590,
    target: { id: "intervention-4h", kind: "tierFlat" },
    ssot: getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!,
  },
  {
    value: 690,
    target: { id: "intervention-essentielle", kind: "tierFlat" },
    ssot: getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
  },
  {
    value: 1190,
    target: { id: "intervention-approfondie", kind: "tierFlat" },
    ssot: getTierById(INTERVENTION_TIERS, "intervention-approfondie").priceFlat!,
  },
  {
    value: 1490,
    target: { id: "essentielle-complete", kind: "subtier" },
    ssot: subPrice(ESSENTIELLE_SUB_TIERS, "essentielle-complete"),
  },
  {
    value: 1590,
    target: { id: "approfondie-standard", kind: "subtier" },
    ssot: subPrice(APPROFONDIE_SUB_TIERS, "approfondie-standard"),
  },
  {
    value: 2490,
    target: { id: "approfondie-complete", kind: "subtier" },
    ssot: subPrice(APPROFONDIE_SUB_TIERS, "approfondie-complete"),
  },
  {
    value: 1900,
    target: { id: "audit-cible-solo", kind: "subtier" },
    ssot: subPrice(AUDIT_CIBLE_SUB_TIERS, "audit-cible-solo"),
  },
  {
    value: 2900,
    target: { id: "audit-cible-standard", kind: "subtier" },
    ssot: subPrice(AUDIT_CIBLE_SUB_TIERS, "audit-cible-standard"),
  },
  {
    value: 3900,
    target: { id: "audit-cible-avance", kind: "subtier" },
    ssot: subPrice(AUDIT_CIBLE_SUB_TIERS, "audit-cible-avance"),
  },
  {
    value: 4900,
    target: { id: "audit-strategique-pme-20-50", kind: "subtier" },
    ssot: subPrice(AUDIT_STRATEGIQUE_PME_SUB_TIERS, "audit-strategique-pme-20-50"),
  },
  {
    value: 9900,
    target: { id: "audit-strategique-pme-50-250", kind: "subtier" },
    ssot: subPrice(AUDIT_STRATEGIQUE_PME_SUB_TIERS, "audit-strategique-pme-50-250"),
  },
  {
    value: 12000,
    target: { id: "audit-strategique-eti-base", kind: "subtier" },
    ssot: subPrice(AUDIT_STRATEGIQUE_ETI_SUB_TIERS, "audit-strategique-eti-base"),
  },
  {
    value: 290,
    target: { id: "maintenance-standard", kind: "tierFlat" },
    ssot: getTierById(MAINTENANCE_TIERS, "maintenance-standard").priceFlat!,
  },
];
for (const e of UNAMBIGUOUS) {
  if (e.value !== e.ssot) {
    throw new Error(
      `[codemod] DRIFT SSOT : map attend ${e.value} pour ${e.target.id} mais pricing.ts dit ${e.ssot}.`,
    );
  }
}
const UNAMBIGUOUS_BY_VALUE = new Map(UNAMBIGUOUS.map((e) => [e.value, e.target]));

// Valeurs ambiguës (plusieurs tiers) → résolues par contexte ligne + bloc-service.
const AMBIGUOUS_VALUES = new Set([890, 990]);

// Ranges connus (min,max) → token range parent (mode `full` = formatPrice).
const RANGES: Array<{ min: number; max: number; token: string }> = [
  {
    min: getTierById(AUDIT_TIERS, "audit-cible").priceMin!,
    max: getTierById(AUDIT_TIERS, "audit-cible").priceMax!,
    token: "audit-cible",
  },
  {
    min: getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!,
    max: getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMax!,
    token: "impl-poc",
  },
  {
    min: getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin!,
    max: getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMax!,
    token: "audit-strategique-pme",
  },
];

// ── Résolution contextuelle des valeurs ambiguës ────────────────────────────
function resolveAmbiguous(
  value: number,
  line: string,
  currentService: string | null,
): Target | null {
  const c = line.toLowerCase();
  if (value === 990) {
    if (
      /\b1-?to-?1\b|1[\s-]?[àa][\s-]?1|un[- ]à[- ]un|un-a-un|dirigeant|coaching|individuel|accompagne/.test(
        c,
      )
    ) {
      return { id: "intervention-dirigeants", kind: "tierFlat" };
    }
    if (
      /pilote|implément|implement|code source|sur mesure|sur-mesure|\bpoc\b|déploiement/.test(c)
    ) {
      return { id: "impl-poc", kind: "tierEntry" };
    }
    if (/gagner du temps|automatis/.test(c)) return { id: "intervention-temps", kind: "tierFlat" };
    if (/claude/.test(c)) return { id: "intervention-claude", kind: "tierFlat" };
    // Bloc-service (grilles `pricing[].price`, labels sans mot-clé sur la ligne).
    if (currentService === "unAUn") return { id: "intervention-dirigeants", kind: "tierFlat" };
    if (currentService === "implementation") return { id: "impl-poc", kind: "tierEntry" };
    return null;
  }
  if (value === 890) {
    if (/audit|flash|terrain|sur site|sur-site|diagnostic/.test(c) || currentService === "audit") {
      return { id: "audit-flash-onsite", kind: "subtier" };
    }
    return null;
  }
  return null;
}

// ── Regex ───────────────────────────────────────────────────────────────────
const NUM = "\\d{1,3}(?:[\\u00a0\\u202f ]\\d{3})*";
// Devise : « € » mais aussi « EUR » / « euros » (un batch de villes a écrit les
// prix en toutes lettres). Le token les normalise tous en « € ». `\b` évite de
// matcher « eur » dans « heures »/« meilleur ».
const CUR = "(?:€|[Ee]uros?\\b|EUR\\b)";
// Negative lookbehind `(?<![\d-])` : empêche de coller un nombre à un « - » ou
// un chiffre précédent. CRITIQUE : sans ça, « 1-à-1 990 € » est lu « 1 990 »
// (le « 1 » de « 1-à-1 » + « 990 ») et « 1-à-1 590 € » serait corrompu en 1590.
const RANGE_RE = new RegExp(
  `(?<![\\d-])(${NUM})\\s?(?:${CUR}\\s?(?:HT)?\\s?)?[-–—→]\\s?(${NUM})\\s?${CUR}(\\s?HT)?`,
  "g",
);
const SINGLE_RE = new RegExp(`(?<![\\d-])(${NUM})\\s?${CUR}(\\s?HT)?`, "g");
const toInt = (s: string): number => parseInt(s.replace(/[^\d]/g, ""), 10);

// Détection bloc-service (heuristique : dernière clé service vue avant la ligne).
const SERVICE_OPEN_RE = /^\s*(audit|interventions|implementation|unAUn|sitesWeb)\s*:\s*\{/;
const TOPLEVEL_PROSE_RE =
  /^\s{2,6}(pitchFr|pitchEn|directAnswerFr|directAnswerEn|faqGeolocalisee|ecosystemFr|ecosystemEn|distancesFr|distancesEn|topSectorsNaf|seoHook)\s*:/;

// ── Rapport ──────────────────────────────────────────────────────────────────
interface Skipped {
  file: string;
  line: number;
  reason: string;
  text: string;
}
const skipped: Skipped[] = [];
const replacementsByToken = new Map<string, number>();
let totalReplacements = 0;
let filesChanged = 0;

function bump(token: string): void {
  replacementsByToken.set(token, (replacementsByToken.get(token) ?? 0) + 1);
  totalReplacements++;
}

function processLine(
  line: string,
  file: string,
  lineNo: number,
  currentService: string | null,
): string {
  if (line.includes("{{price:")) return line; // idempotent

  let out = line.replace(RANGE_RE, (match, minStr: string, maxStr: string) => {
    const min = toInt(minStr);
    const max = toInt(maxStr);
    const range = RANGES.find((r) => r.min === min && r.max === max);
    if (range) {
      bump(range.token);
      return `{{price:${range.token}}}`;
    }
    skipped.push({
      file,
      line: lineNo,
      reason: `range ${min}-${max} hors-SSOT`,
      text: match.trim(),
    });
    return match;
  });

  out = out.replace(SINGLE_RE, (match, numStr: string, htGroup?: string) => {
    const value = toInt(numStr);
    const hasHT = !!htGroup;
    let target = UNAMBIGUOUS_BY_VALUE.get(value) ?? null;
    if (!target && AMBIGUOUS_VALUES.has(value)) {
      target = resolveAmbiguous(value, line, currentService);
    }
    if (!target) {
      const reason = AMBIGUOUS_VALUES.has(value)
        ? `ambigu ${value} € (contexte insuffisant)`
        : `montant hors-SSOT ${value} €`;
      skipped.push({ file, line: lineNo, reason, text: match.trim() });
      return match;
    }
    const token = buildToken(target, hasHT);
    bump(token);
    return `{{price:${token}}}`;
  });

  return out;
}

// Nombre de TÊTE d'un range écrit « entre 1 900 et … » / « de 1 900 à … » :
// le 2e membre porte le « € » (déjà tokenisé), mais le 1er nombre reste en dur
// (pas de « € » juste après → raté par SINGLE_RE). Sans ça, changer le prix dans
// pricing.ts ne mettrait PAS à jour ce 1er nombre → propagation incomplète.
// On le tokenise en mode `num` (rend le nombre seul, sans « € », rendu identique).
// Tourne MÊME sur les lignes déjà tokenisées (le 1er nombre y est encore en dur).
const LEADING_RANGE_RE = new RegExp(
  `(?<![\\d-])(${NUM})(\\s*(?:et|à|-|–|—|→)\\s*)(\\{\\{price:)`,
  "g",
);
function tokenizeLeadingRangeNumber(line: string): string {
  return line.replace(LEADING_RANGE_RE, (match, numStr: string, conn: string, tokStart: string) => {
    const value = toInt(numStr);
    const target = UNAMBIGUOUS_BY_VALUE.get(value); // unambiguous seulement
    if (!target) return match; // valeur non-SSOT ou ambiguë → laisser
    bump(`${target.id}|num`);
    return `{{price:${target.id}|num}}${conn}${tokStart}`;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const files = readdirSync(COPY_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "_auto-generated-index.ts")
  .sort();
const targetFiles = LIMIT > 0 ? files.slice(0, LIMIT) : files;

let filesWithEuro = 0;
for (const f of targetFiles) {
  const abs = path.join(COPY_DIR, f);
  const content = readFileSync(abs, "utf8");
  if (content.includes("€")) filesWithEuro++;
  const eol = content.includes("\r\n") ? "\r\n" : "\n"; // préserve l'EOL d'origine
  const lines = content.split(/\r?\n/);
  let changed = false;
  let currentService: string | null = null;
  const newLines = lines.map((line, i) => {
    const open = SERVICE_OPEN_RE.exec(line);
    if (open) currentService = open[1]!;
    else if (TOPLEVEL_PROSE_RE.test(line)) currentService = null;
    let out = processLine(line, f, i + 1, currentService);
    out = tokenizeLeadingRangeNumber(out); // tourne aussi sur lignes déjà tokenisées
    if (out !== line) changed = true;
    return out;
  });
  if (changed) {
    filesChanged++;
    if (APPLY) writeFileSync(abs, newLines.join(eol), "utf8");
  }
}

// ── Sortie ──────────────────────────────────────────────────────────────────
console.log("\n=== Codemod tokenize-ville-prices ===");
console.log(`Mode          : ${APPLY ? "APPLY (écriture)" : "DRY-RUN (aucune écriture)"}`);
console.log(`Fichiers scannés    : ${targetFiles.length}${LIMIT ? ` (limit ${LIMIT})` : ""}`);
console.log(`Fichiers avec €     : ${filesWithEuro}`);
console.log(`Fichiers modifiés   : ${filesChanged}`);
console.log(`Remplacements total : ${totalReplacements}`);
console.log("\n--- Remplacements par token ---");
for (const [token, n] of [...replacementsByToken.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(5)}  {{price:${token}}}`);
}
console.log(`\n--- Laissés en l'état (revue manuelle) : ${skipped.length} ---`);
const byReason = new Map<string, Skipped[]>();
for (const s of skipped) {
  const key = s.reason.replace(/\d[\d   ]*/g, "N");
  if (!byReason.has(key)) byReason.set(key, []);
  byReason.get(key)!.push(s);
}
for (const [reason, items] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  [${items.length}] ${reason}`);
  for (const s of items.slice(0, 10)) {
    console.log(`      ${s.file}:${s.line}  ${s.text.slice(0, 110)}`);
  }
  if (items.length > 10) console.log(`      … +${items.length - 10} autres`);
}
console.log("");
