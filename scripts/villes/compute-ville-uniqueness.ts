#!/usr/bin/env tsx
/**
 * Scorer d'unicité villes — garde-fou anti-doorway mesurable (Phase 2B FAQ/villes
 * 2026-05-31, décision Will « indexation au mérite »).
 *
 * Problème : les ~2117 copies villes auto-générées sont templatées (mêmes 5
 * questions FAQ, phrasé répété) — le nombre de mots ne les distingue pas (toutes
 * ~600-850 mots). On mesure donc l'UNICITÉ RÉELLE par similarité inter-villes :
 *
 *  1. Extraction de la prose FR (pitch, direct answer, écosystème, services, FAQ…).
 *  2. Normalisation + **retrait du nom de ville / région / département** (sinon
 *     chaque ville paraît unique juste par ses noms propres).
 *  3. Découpage en shingles de 5 mots → fréquence documentaire globale (df).
 *  4. Score d'unicité = part de shingles RARES (df ≤ RARE_DF) dans la ville.
 *     Un texte templaté = surtout des shingles communs → score bas.
 *
 * Usage :
 *   pnpm tsx scripts/villes/compute-ville-uniqueness.ts            # stats
 *   pnpm tsx scripts/villes/compute-ville-uniqueness.ts --emit     # + écrit le .ts
 *
 * READ-ONLY par défaut (n'écrit le fichier de slugs que sous --emit).
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { VILLES, type Ville } from "@/content/villes";
import { PREMIUM_REWRITE_SLUGS } from "@/content/villes/premium-rewrite-slugs";

/**
 * Ville premium = curée humainement (pop ≥ 20k OU réécriture premium). Toujours
 * indexable quel que soit le score : les grandes villes gold (copie longue
 * hand-written) emploient un vocabulaire métier commun au corpus → score
 * sous-évalué (faux-négatifs, ex. Paris). On les force-inclut.
 */
function isPremium(v: Ville): boolean {
  return !!v.copy && (v.population >= 20_000 || PREMIUM_REWRITE_SLUGS.has(v.slug));
}

const RARE_DF = 8; // un shingle est "rare/unique" s'il apparaît dans ≤ 8 villes
const SHINGLE = 5; // taille des n-grammes (mots)

/** Concatène toute la prose FR exploitable d'une ville. */
function getProse(v: Ville): string {
  const c = v.copy;
  if (!c) return "";
  const parts: Array<string | undefined> = [
    c.pitchFr,
    c.directAnswerFr,
    c.ecosystemFr,
    c.seoHook,
    c.distancesFr,
    c.topSectorsNaf?.join(" "),
  ];
  const ctx = c.servicesContext;
  if (ctx) {
    parts.push(
      ctx.audit?.fr,
      ctx.interventions?.fr,
      ctx.implementation?.fr,
      ctx.unAUn?.fr,
      ctx.sitesWeb?.fr,
    );
  }
  if (c.faqGeolocalisee) {
    for (const f of c.faqGeolocalisee) parts.push(f.q, f.a);
  }
  // Gold villes : long-form services (très différenciant).
  const svc = c.services;
  if (svc) {
    for (const key of ["audit", "interventions", "implementation", "unAUn"] as const) {
      const s = svc[key]?.fr;
      if (!s) continue;
      parts.push(
        s.hero,
        s.guarantees,
        ...s.whyHere,
        ...s.methodology.map((m) => `${m.step} ${m.detail}`),
      );
      for (const f of s.faq) parts.push(f.q, f.a);
    }
  }
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

function stripAccentsLower(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Tokens propres à la ville à retirer (nom, slug, région, département, communes proches). */
function properNounTokens(v: Ville): Set<string> {
  const raw: Array<string | undefined> = [
    v.nameFr,
    v.nameEn,
    v.slug?.replace(/-/g, " "),
    v.region?.replace(/-/g, " "),
    v.departement,
    v.departementLabel,
  ];
  // communes proches éventuelles
  const near = (v as unknown as { communesProches?: ReadonlyArray<{ name?: string }> })
    .communesProches;
  if (Array.isArray(near)) for (const cp of near) if (cp?.name) raw.push(cp.name);
  const set = new Set<string>();
  for (const r of raw) {
    if (!r) continue;
    for (const tok of stripAccentsLower(r)
      .split(/[^a-z]+/)
      .filter(Boolean))
      set.add(tok);
  }
  return set;
}

/** Normalise + retire chiffres + noms propres → tableau de mots. */
function tokens(prose: string, proper: Set<string>): string[] {
  return stripAccentsLower(prose)
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !proper.has(w));
}

function shingles(words: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= words.length; i++) out.add(words.slice(i, i + SHINGLE).join(" "));
  return out;
}

// ── 1. Empreintes ────────────────────────────────────────────────────────────
const fingerprints = new Map<string, Set<string>>();
for (const v of VILLES) {
  if (!v.copy) continue;
  const words = tokens(getProse(v), properNounTokens(v));
  fingerprints.set(v.slug, shingles(words));
}

// ── 2. Fréquence documentaire globale ────────────────────────────────────────
const df = new Map<string, number>();
for (const sh of fingerprints.values()) for (const s of sh) df.set(s, (df.get(s) ?? 0) + 1);

// ── 3. Score d'unicité par ville ─────────────────────────────────────────────
interface Scored {
  slug: string;
  total: number;
  rare: number;
  score: number;
}
const scored: Scored[] = [];
for (const [slug, sh] of fingerprints) {
  let rare = 0;
  for (const s of sh) if ((df.get(s) ?? 0) <= RARE_DF) rare++;
  const total = sh.size;
  scored.push({ slug, total, rare, score: total > 0 ? rare / total : 0 });
}
scored.sort((a, b) => b.score - a.score);

// ── 4. Rapport ───────────────────────────────────────────────────────────────
const n = scored.length;
const median = scored[Math.floor(n / 2)];
console.log(`Villes avec copy: ${n}`);
console.log(`RARE_DF=${RARE_DF} SHINGLE=${SHINGLE}`);
console.log(`Score médian: ${median ? median.score.toFixed(3) : "n/a"}`);
console.log("");
console.log("Seuil score | villes indexables | % | rare-shingles min observé");
for (const thr of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
  const pass = scored.filter((s) => s.score >= thr);
  const minRare = pass.length ? Math.min(...pass.map((s) => s.rare)) : 0;
  console.log(
    `  ≥ ${thr.toFixed(2)}    | ${String(pass.length).padStart(5)}            | ${((pass.length / n) * 100).toFixed(1)}% | ${minRare}`,
  );
}
console.log("");
console.log("Top 8 (plus uniques) :");
for (const s of scored.slice(0, 8))
  console.log(`  ${s.score.toFixed(3)}  ${s.slug} (rare ${s.rare}/${s.total})`);
console.log("Bottom 5 (plus templatées) :");
for (const s of scored.slice(-5))
  console.log(`  ${s.score.toFixed(3)}  ${s.slug} (rare ${s.rare}/${s.total})`);

// ── 5. Émission optionnelle ──────────────────────────────────────────────────
const emitThr = Number(
  process.argv.find((a) => a.startsWith("--threshold="))?.split("=")[1] ?? "0.4",
);
if (process.argv.includes("--emit")) {
  const premiumSlugs = new Set(VILLES.filter(isPremium).map((v) => v.slug));
  const keepSet = new Set<string>([
    ...scored.filter((s) => s.score >= emitThr).map((s) => s.slug),
    ...premiumSlugs,
  ]);
  const keep = [...keepSet].sort();
  console.log(
    `\nForce-inclus premium/gold: ${premiumSlugs.size} (dont ${[...premiumSlugs].filter((s) => !scored.find((x) => x.slug === s && x.score >= emitThr)).length} sous le seuil)`,
  );
  const file = path.join(process.cwd(), "src/content/villes/unique-ville-slugs.ts");
  const body = `// AUTO-GENERATED par scripts/villes/compute-ville-uniqueness.ts — NE PAS ÉDITER À LA MAIN.
// Villes au contenu RÉELLEMENT unique (score d'unicité ≥ ${emitThr}, RARE_DF=${RARE_DF}).
// Garde-fou anti-doorway mesurable (décision Will « indexation au mérite » 2026-05-31).
// Régénérer après un batch de réécriture de copy : \`pnpm tsx scripts/villes/compute-ville-uniqueness.ts --emit --threshold=${emitThr}\`.

export const UNIQUE_VILLE_SLUGS: ReadonlySet<string> = new Set([
${keep.map((s) => `  ${JSON.stringify(s)},`).join("\n")}
]);
`;
  writeFileSync(file, body, "utf8");
  console.log(
    `\n✅ Émis ${keep.length} slugs (seuil ${emitThr}) → src/content/villes/unique-ville-slugs.ts`,
  );
}
