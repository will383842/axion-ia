/**
 * Script d'audit qualité des seeds keywords — Phase 1 Sprint Perfection 2026-05-22
 *
 * Usage : pnpm tsx src/scripts/audit-keywords-quality.ts
 *
 * Produit un rapport markdown dans :
 *   _AUDIT/KEYWORDS-PERFECTION-2026-05-22/01-AUDIT-QUALITE-EXISTANT.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ALL_KEYWORD_SEEDS } from "../content/keywords/master";
import { validateAllSeeds } from "../content/keywords/validate";
import type { KeywordSeed } from "../content/keywords/types";

// ── Module → Vertical mapping ─────────────────────────────────────────────────
const MODULE_TO_VERTICAL: Record<string, string> = {
  audit: "audits",
  "interventions-formations": "interventions_formations",
  implementation: "implementations",
  "coaching-1-to-1": "un_a_un",
  "codage-developpement": "sites_web_augmentes",
  "maintenance-ia": "transversal",
  transversal: "transversal",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Heuristic: détecte les doublons sémantiques par tokens communs */
function detectSemanticDuplicates(
  seeds: readonly KeywordSeed[],
): Array<{ kw1: string; kw2: string; similarity: number }> {
  const pairs: Array<{ kw1: string; kw2: string; similarity: number }> = [];
  const SAMPLE = seeds.slice(0, 800); // limite pour performances

  for (let i = 0; i < SAMPLE.length; i++) {
    for (let j = i + 1; j < SAMPLE.length; j++) {
      const a = normalize(SAMPLE[i]!.keyword).split(/\s+/);
      const b = normalize(SAMPLE[j]!.keyword).split(/\s+/);
      if (a.length < 2 || b.length < 2) continue;
      const setA = new Set(a.filter((w) => w.length > 3));
      const setB = new Set(b.filter((w) => w.length > 3));
      if (setA.size === 0 || setB.size === 0) continue;
      const intersection = [...setA].filter((w) => setB.has(w)).length;
      const union = new Set([...setA, ...setB]).size;
      const jaccard = intersection / union;
      if (jaccard >= 0.75 && SAMPLE[i]!.keyword !== SAMPLE[j]!.keyword) {
        pairs.push({ kw1: SAMPLE[i]!.keyword, kw2: SAMPLE[j]!.keyword, similarity: jaccard });
      }
    }
    if (pairs.length >= 50) break; // cap à 50 pour le rapport
  }
  return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 50);
}

/** Détecte les keywords exacts dupliqués */
function detectExactDuplicates(seeds: readonly KeywordSeed[]): string[] {
  const seen = new Map<string, number>();
  for (const s of seeds) {
    const k = s.keyword.toLowerCase().trim();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([kw]) => kw)
    .slice(0, 50);
}

/** Identifie les keywords faibles */
function detectWeakKeywords(
  seeds: readonly KeywordSeed[],
): Array<{ keyword: string; reason: string }> {
  const weak: Array<{ keyword: string; reason: string }> = [];
  for (const s of seeds) {
    const words = s.keyword.split(/\s+/);
    if (words.length === 1)
      weak.push({ keyword: s.keyword, reason: "1 seul mot — trop générique" });
    else if (s.keyword.length < 12)
      weak.push({ keyword: s.keyword, reason: "trop court (<12 chars)" });
    else if (words.length > 12) weak.push({ keyword: s.keyword, reason: "trop long (>12 mots)" });
  }
  return weak.slice(0, 50);
}

/** Clusters thématiques par verticale (heuristique token) */
function detectClusters(seeds: readonly KeywordSeed[]): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  const THEME_TOKENS = [
    "audit",
    "sécurité",
    "rgpd",
    "ai act",
    "conformité",
    "biais",
    "éthique",
    "performance",
    "coût",
    "roi",
    "stratégie",
    "formation",
    "prompt",
    "coaching",
    "dirigeant",
    "ceo",
    "implémentation",
    "chatbot",
    "rag",
    "agent",
    "automatisation",
    "crm",
    "erp",
    "seo",
    "aeo",
    "geo",
    "contenu",
    "schéma",
    "vitals",
    "création",
    "refonte",
  ];
  for (const token of THEME_TOKENS) {
    const matching = seeds
      .filter((s) => normalize(s.keyword).includes(token))
      .map((s) => s.keyword);
    if (matching.length > 0) clusters[token] = matching.slice(0, 10);
  }
  return clusters;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

const seeds = ALL_KEYWORD_SEEDS;

// Distribution par verticale
const byVertical: Record<string, number> = {};
for (const s of seeds) {
  const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
  byVertical[v] = (byVertical[v] ?? 0) + 1;
}

// Distribution par intent
const byIntent: Record<string, number> = {};
for (const s of seeds) {
  byIntent[s.intent] = (byIntent[s.intent] ?? 0) + 1;
}

// Long tail vs short
const longTail = seeds.filter((s) => s.keyword.split(/\s+/).length >= 4).length;
const shortTail = seeds.length - longTail;

// Local vs national
const local = seeds.filter((s) => s.intent === "local" || s.intent === "aeo").length;

// Voice search
const voiceSearch = seeds.filter((s) => s.intent === "voice_search").length;
const aiOverview = seeds.filter((s) => s.intent === "ai_overview").length;
const featuredSnippet = seeds.filter((s) => s.intent === "featured_snippet").length;

// Validation
const validation = validateAllSeeds(seeds);

// Duplicates
const exactDups = detectExactDuplicates(seeds);
const semanticDups = detectSemanticDuplicates(seeds);

// Weak keywords
const weakKws = detectWeakKeywords(seeds);

// Clusters
const clusters = detectClusters(seeds);

// Gaps
const EXPECTED_VERTICALS = [
  "audits",
  "interventions_formations",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
];
const coverageGaps = EXPECTED_VERTICALS.filter((v) => (byVertical[v] ?? 0) < 250).map((v) => ({
  verticale: v,
  count: byVertical[v] ?? 0,
  gap: 250 - (byVertical[v] ?? 0),
}));

// Score qualité
let score = 1000;
score -= exactDups.length * 10;
score -= Math.max(0, semanticDups.length - 10) * 3;
score -= weakKws.length * 5;
score -= coverageGaps.length * 30;
score += Math.min(100, voiceSearch) * 0.3;
score += Math.min(100, aiOverview) * 0.2;
score = Math.min(1000, Math.max(0, Math.round(score)));

// ── Génération rapport ────────────────────────────────────────────────────────

const TABLE_VERTICAL = EXPECTED_VERTICALS.map((v) => {
  const count = byVertical[v] ?? 0;
  const status = count >= 250 ? "✅" : count >= 150 ? "⚠️" : "🔴";
  return `| ${v} | ${count} | ${Math.round((count / seeds.length) * 100)}% | ${status} |`;
}).join("\n");

const TABLE_INTENT = Object.entries(byIntent)
  .sort(([, a], [, b]) => b - a)
  .map(
    ([intent, count]) => `| ${intent} | ${count} | ${Math.round((count / seeds.length) * 100)}% |`,
  )
  .join("\n");

const TOP_SEMANTIC = semanticDups
  .slice(0, 20)
  .map((d, i) => `${i + 1}. \`${d.kw1}\` ↔ \`${d.kw2}\` (sim: ${(d.similarity * 100).toFixed(0)}%)`)
  .join("\n");

const TOP_WEAK = weakKws
  .slice(0, 20)
  .map((w, i) => `${i + 1}. \`${w.keyword}\` — ${w.reason}`)
  .join("\n");

const CLUSTER_SUMMARY = Object.entries(clusters)
  .slice(0, 20)
  .map(
    ([token, kws]) =>
      `### Cluster \`${token}\` (${kws.length} seeds)\n${kws
        .slice(0, 5)
        .map((k) => `- ${k}`)
        .join("\n")}`,
  )
  .join("\n\n");

const GAPS_SECTION =
  coverageGaps.length === 0
    ? "✅ Toutes les verticales ont ≥ 250 keywords."
    : coverageGaps
        .map(
          (g) =>
            `- **${g.verticale}** : ${g.count} seeds actuels — manque ${g.gap} pour atteindre 250`,
        )
        .join("\n");

const report = `# AUDIT QUALITÉ KEYWORDS — ${seeds.length} seeds totaux
## Date : 2026-05-22
## Score global qualité : ${score}/1000

---

## Distribution par verticale
| Verticale | Count | % du total | Verdict |
|-----------|-------|------------|---------|
${TABLE_VERTICAL}

**Total toutes verticales confondues** : ${seeds.length} seeds

**Doublons exacts** : ${exactDups.length}
**Doublons sémantiques (Jaccard ≥75%)** : ${semanticDups.length}
**Keywords faibles** : ${weakKws.length}

---

## Distribution par intent
| Intent | Count | % |
|--------|-------|---|
${TABLE_INTENT}

### Intents 2026 spéciaux
- voice_search : ${voiceSearch} (${Math.round((voiceSearch / seeds.length) * 100)}%)
- ai_overview : ${aiOverview} (${Math.round((aiOverview / seeds.length) * 100)}%)
- featured_snippet : ${featuredSnippet} (${Math.round((featuredSnippet / seeds.length) * 100)}%)

---

## Distribution longue traîne vs courte traîne
- Longue traîne (≥4 mots) : ${longTail} (${Math.round((longTail / seeds.length) * 100)}%) — cible 70%
- Courte traîne (1-3 mots) : ${shortTail} (${Math.round((shortTail / seeds.length) * 100)}%) — cible 30%
- Keywords locaux/géo : ${local} (${Math.round((local / seeds.length) * 100)}%)

---

## Validation formelle
- Total validés : ${validation.valid}/${validation.total}
- Invalides : ${validation.invalid}
${validation.errors
  .slice(0, 5)
  .map((e) => `  - \`${e.keyword}\` : ${e.errors.join(", ")}`)
  .join("\n")}

---

## Top 20 doublons sémantiques détectés
${TOP_SEMANTIC || "Aucun doublon sémantique détecté."}

---

## Top 20 keywords faibles
${TOP_WEAK || "Aucun keyword faible détecté."}

---

## Clusters thématiques détectés
${CLUSTER_SUMMARY}

---

## Gaps couverture
${GAPS_SECTION}

---

## Recommandations Top 10 actions
1. **Éliminer les doublons exacts** (${exactDups.length} identifiés) — gain qualité +${exactDups.length * 10} pts score
2. **Atteindre 250 seeds par verticale** — verticales déficitaires : ${coverageGaps.map((g) => g.verticale).join(", ") || "aucune"}
3. **Augmenter voice_search** — actuellement ${voiceSearch} seeds (${Math.round((voiceSearch / seeds.length) * 100)}%) → cible 10%
4. **Augmenter ai_overview** — actuellement ${aiOverview} seeds → cible 8%
5. **Augmenter featured_snippet** — actuellement ${featuredSnippet} seeds → cible 7%
6. **Équilibrer longue traîne** — ${Math.round((longTail / seeds.length) * 100)}% actuellement → cible 70%
7. **Compléter géolocalisation** — 100 villes top × 5 verticales = 3500 seeds géo
8. **Mapping concurrentiel** — analyser 20+ concurrents vs nos keywords stratégiques
9. **Supprimer keywords 1 mot** — ${weakKws.filter((w) => w.reason.includes("1 seul")).length} identifiés
10. **Ajouter secteurs manquants** — agriculture, tourisme, enseignement supérieur sous-représentés

---

*Généré le 2026-05-22 par audit-keywords-quality.ts — Sprint Keywords Perfection*
`;

// Écriture du rapport
const outDir = path.join(process.cwd(), "_AUDIT", "KEYWORDS-PERFECTION-2026-05-22");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "01-AUDIT-QUALITE-EXISTANT.md");
fs.writeFileSync(outPath, report, "utf8");

console.log(`✅ Rapport audit écrit : ${outPath}`);
console.log(`📊 Total seeds : ${seeds.length}`);
console.log(`📊 Score qualité : ${score}/1000`);
console.log(
  `📊 Verticales ≥250 : ${EXPECTED_VERTICALS.filter((v) => (byVertical[v] ?? 0) >= 250).length}/5`,
);
console.log(
  `📊 Voice search : ${voiceSearch} | AI overview : ${aiOverview} | Featured snippet : ${featuredSnippet}`,
);
