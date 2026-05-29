/**
 * Garde-fou CI anti-prix-en-dur — Sprint Pricing SSOT (Will 2026-05-29).
 *
 * Doctrine Will : `src/content/pricing.ts` est la SEULE source de vérité des
 * tarifs Axion-IA. Tout prix affiché doit en dériver — soit via un helper
 * (`formatPrice`/`formatAmount`/`getEntryLabel`…) dans le code, soit via un
 * token `{{price:<tierId>}}` dans la prose. Ce test échoue si un montant en
 * euros écrit en dur réapparaît dans une surface « prix Axion-IA ».
 *
 * C'est l'enforcement permanent « plus jamais de prix obsolète ».
 *
 * ── Trois échappatoires légitimes ──────────────────────────────────────────
 *   (a) le fichier `pricing.ts` lui-même (la SSOT) ;
 *   (b) un token `{{price:…}}` présent sur la ligne ;
 *   (c) un marqueur de ligne `price-exempt` (commentaire) → prix marché /
 *       concurrent / coût API / seuil légal qui n'est PAS un tarif Axion-IA.
 *   + une allowlist de FICHIERS entiers dont le contenu prix est par nature
 *     non-Axion (comparatifs marché, glossaire, stack tech, mentions légales,
 *     études de cas citant des budgets clients).
 *
 * ── Surfaces scannées (phase-gated) ────────────────────────────────────────
 * Phase 1 (cette livraison) — code/config nettoyés :
 *   - src/content/*.ts            (top-level uniquement, hors pricing*.ts)
 *   - src/app/(**)/page.tsx        (pages, tous segments)
 *   - src/components/(**)/*.{ts,tsx}
 *   - src/app/llms.txt|llms-full.txt/route.ts
 *
 * Surfaces DÉFÉRÉES (à activer quand leur phase tokenise la prose) :
 *   - src/content/villes/copy/**          → Phase 2 (codemod tokenize)
 *   - src/server/content-gen/**           → Phase 3 (brand-voice + price-gate)
 *   - src/content/keywords/**             → phase ultérieure (per-line exempt
 *                                            des ranges marché à poser)
 * Les activer = déplacer leur racine dans ENABLED_ROOTS ci-dessous.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

// ── Racines scannées en Phase 1 ─────────────────────────────────────────────
interface SurfaceRoot {
  /** Dossier de départ (absolu). */
  dir: string;
  /** Récursif ? */
  recursive: boolean;
  /** Prédicat de sélection d'un fichier (chemin absolu). */
  match: (absPath: string) => boolean;
  /**
   * Si `true`, n'enforce QUE le format prix FR (« 490 € »/« 490 EUR »/« 490 euros »,
   * nombre AVANT la devise) et ignore le format EN (« €490 », devise avant). Utilisé
   * pour la prose villes : la copy FR est tokenisée et enforce, mais les champs
   * long-form `services.*.en` (EN, locale 301→FR, « ne pas investir sur l'EN »)
   * gardent des « €990 excl. VAT » qu'on isole volontairement.
   */
  frOnly?: boolean;
}

const ENABLED_ROOTS: ReadonlyArray<SurfaceRoot> = [
  {
    // Top-level de src/content (pas les sous-dossiers villes/keywords/blog/…).
    dir: path.join(SRC, "content"),
    recursive: false,
    match: (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".spec.ts"),
  },
  {
    dir: path.join(SRC, "app"),
    recursive: true,
    // Pages publiques uniquement. Le route-group (admin) est noindex et
    // affiche des coûts d'infra (Hetzner, free tiers) — pas des tarifs Axion.
    match: (p) => p.endsWith("page.tsx") && !p.includes(`${path.sep}(admin)${path.sep}`),
  },
  {
    dir: path.join(SRC, "components"),
    recursive: true,
    match: (p) =>
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".test.ts") &&
      !p.endsWith(".test.tsx") &&
      !p.endsWith(".spec.ts") &&
      !p.endsWith(".spec.tsx"),
  },
  {
    // Prose villes — FR tokenisée en Phase 2 (codemod). `frOnly` : on enforce le
    // FR (tokenisé) et on isole l'EN mort des villes pilotes (« €990 excl. VAT »
    // dans `services.*.en`). L'index `_auto-generated-index.ts` ne fait
    // qu'importer (zéro € literal).
    dir: path.join(SRC, "content", "villes", "copy"),
    recursive: true,
    frOnly: true,
    match: (p) =>
      p.endsWith(".ts") &&
      !p.endsWith(".test.ts") &&
      !p.endsWith(".spec.ts") &&
      !p.endsWith("_auto-generated-index.ts") &&
      !p.endsWith(`${path.sep}types.ts`),
  },
  {
    // Génération de contenu (Phase 3) — prompts, generators, KB facts, quality.
    // Les prix Axion doivent être des tokens {{price:…}} ou des montants SSOT ;
    // le price-gate (quality/price-gate.ts) enforce le même contrat au runtime.
    dir: path.join(SRC, "server", "content-gen"),
    recursive: true,
    match: (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".spec.ts"),
  },
];

// Routes prix explicites (hors page.tsx).
const EXTRA_FILES: ReadonlyArray<string> = [
  path.join(SRC, "app", "llms.txt", "route.ts"),
  path.join(SRC, "app", "llms-full.txt", "route.ts"),
];

// ── Fichiers exemptés (prix non-Axion par nature) ───────────────────────────
// Chemins relatifs à src/, séparateur `/`. Le contenu prix y est du marché,
// du concurrentiel, du légal ou un budget client cité — pas un tarif Axion-IA.
const EXEMPT_FILES: ReadonlySet<string> = new Set([
  "content/pricing.ts", // la SSOT
  "content/pricing-tokens.ts", // le résolveur (peut citer des exemples en commentaire)
  "content/comparaisons.ts", // comparatif marché / concurrents
  "content/glossary-extension.ts", // définitions génériques
  "content/stack-ia-details.ts", // coûts API / outils tiers
  "content/legal.ts", // seuils légaux (TVA, plafonds)
  "content/case-studies.ts", // budgets clients cités
  "content/regions.ts", // PIB régionaux (« €838 B GDP ») — données économiques
  // Matrice build-vs-buy : colonnes SaaS marché / dev custom marché, pas Axion.
  "components/services/implementation/ImplementationComparisonMatrix.tsx",
  // 5 villes dont le SEUL € est une donnée INSEE (revenu médian / immobilier) en
  // prose écosystème — pas un tarif Axion. Leurs prix Axion sont tokenisés.
  "content/villes/copy/la-celle-saint-cloud.ts", // revenu médian 29 510 €
  "content/villes/copy/maisons-laffitte.ts", // valeur foncière 48 001 €
  "content/villes/copy/montigny-les-cormeilles.ts", // revenu médian 21 970 €
  "content/villes/copy/saint-michel-sur-orge.ts", // revenu médian 34 972 €
  "content/villes/copy/sannois.ts", // revenu médian 24 250 €
]);

// ── Détection des montants € en dur ─────────────────────────────────────────
// Couvre « 490 € », « 1 900 € HT », « 12 000 € », « 120 k€ » (FR) et « €490 »,
// « €1,900 » (EN). `\s` matche les espaces insécables FR ( ,  ).
const EURO_AFTER = /\d[\d.,\s]*(?:€|k€|M€|EUR\b|euros?\b)/i;
const EURO_BEFORE = /(?:€|k€|M€)\s*\d/i;

function lineHasEuroLiteral(line: string, frOnly = false): boolean {
  // frOnly : seulement le format FR (nombre AVANT devise) ; ignore « €990 » (EN).
  return frOnly ? EURO_AFTER.test(line) : EURO_AFTER.test(line) || EURO_BEFORE.test(line);
}

/**
 * Ligne de commentaire pur (`//`, JSDoc `*`, ouverture/fermeture de bloc).
 * Les commentaires citant un prix historique (changelog, TODO, doc) ne sont
 * PAS des prix affichés — on ne les flague pas. Ce qui compte = la prose et
 * les strings rendues. (Évite aussi le piège du stripping `//` dans les URLs.)
 */
function lineIsComment(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("*/");
}

function lineIsAllowed(line: string): boolean {
  // (b) token prix résolu au rendu — légitime.
  if (line.includes("{{price:")) return true;
  // (c) marqueur d'exemption per-ligne.
  if (line.includes("price-exempt")) return true;
  return false;
}

// ── Walker fichiers ─────────────────────────────────────────────────────────
function walk(dir: string, recursive: boolean, match: (p: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (recursive && entry !== "node_modules" && entry !== "__tests__") {
        out.push(...walk(abs, recursive, match));
      }
    } else if (match(abs)) {
      out.push(abs);
    }
  }
  return out;
}

function relFromSrc(absPath: string): string {
  return path.relative(SRC, absPath).split(path.sep).join("/");
}

interface Violation {
  file: string; // relatif à src/
  line: number; // 1-based
  text: string;
}

function scanForHardcodedPrices(): Violation[] {
  const files = new Map<string, boolean>(); // chemin absolu → frOnly
  for (const root of ENABLED_ROOTS) {
    for (const f of walk(root.dir, root.recursive, root.match)) {
      files.set(f, files.get(f) || root.frOnly === true);
    }
  }
  for (const f of EXTRA_FILES) {
    if (existsSync(f)) files.set(f, files.get(f) ?? false);
  }

  const violations: Violation[] = [];
  for (const [abs, frOnly] of files) {
    const rel = relFromSrc(abs);
    if (EXEMPT_FILES.has(rel)) continue;
    const content = readFileSync(abs, "utf8");
    const lines = content.split(/\r?\n/);
    let inBlockComment = false; // bloc /* … */ ou JSX {/* … */} multi-lignes
    lines.forEach((line, i) => {
      if (inBlockComment) {
        if (line.includes("*/")) inBlockComment = false;
        return; // ligne entièrement en commentaire
      }
      // Ouverture d'un bloc commentaire (/* ou {/*) non refermé sur la ligne.
      const openIdx = line.indexOf("/*");
      if (openIdx !== -1 && !line.slice(openIdx).includes("*/")) {
        inBlockComment = true;
        return; // le reste de la ligne est du commentaire
      }
      if (lineIsComment(line)) return;
      if (!lineHasEuroLiteral(line, frOnly)) return;
      if (lineIsAllowed(line)) return;
      violations.push({ file: rel, line: i + 1, text: line.trim() });
    });
  }
  return violations;
}

describe("Garde-fou SSOT — aucun prix € en dur dans les surfaces Axion-IA", () => {
  it("ne contient aucun montant euro hors pricing.ts / token / price-exempt", () => {
    const violations = scanForHardcodedPrices();
    const report = violations.map((v) => `  ${v.file}:${v.line}  →  ${v.text}`).join("\n");
    expect(
      violations,
      violations.length === 0
        ? ""
        : `\n${violations.length} prix € en dur détecté(s) — dérive de pricing.ts (helper) ou tokenise ({{price:<tierId>}}), ou marque la ligne « price-exempt » si c'est un prix marché/légal :\n${report}\n`,
    ).toHaveLength(0);
  });

  it("le scanner détecte bien un littéral euro injecté (auto-test du garde-fou)", () => {
    expect(lineHasEuroLiteral('const x = "offre à 999 € HT";')).toBe(true);
    expect(lineHasEuroLiteral('title: "Audit · €1,900 · Axion-IA"')).toBe(true);
    expect(lineHasEuroLiteral('budget: "120 k€"')).toBe(true);
    // Faux positifs à éviter :
    expect(lineHasEuroLiteral('currency: "EUR",')).toBe(false);
    expect(lineHasEuroLiteral("const priceFlatEur = tier.priceFlat;")).toBe(false);
    // Échappatoires :
    expect(lineIsAllowed("prix : {{price:audit-flash}} pour démarrer")).toBe(true);
    expect(lineIsAllowed("budget marché 8 000 € /* price-exempt: étude DGE */")).toBe(true);
    // Commentaires (changelog / doc) ignorés :
    expect(lineIsComment("  // 2026-05-24 : passage 390 € → 590 €.")).toBe(true);
    expect(lineIsComment("   * (~490 €) / Implémentation standard.")).toBe(true);
    expect(lineIsComment('  priceFr: "890 € HT",')).toBe(false);
  });
});
