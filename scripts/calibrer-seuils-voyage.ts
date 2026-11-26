#!/usr/bin/env tsx
/**
 * Calibrage des seuils Voyage (PR4) — À SEC : LECTURE SEULE, rien n'est écrit.
 *
 * Les seuils de doublon (0,85 / 0,80) et de dérive de voix de marque (0,70 / 0,80) ont
 * été calibrés pour OpenAI (1536 dim). Ils ne sont PAS valables pour Voyage voyage-3
 * (1024 dim) : la distribution des similarités est différente. Ce script mesure, sur les
 * paires d'articles déjà vectorisés dans `articles.embedding_voyage` :
 *
 *   1. la similarité cosinus du plus proche voisin de chaque article (couche 4 dedup) ;
 *   2. la similarité de paires tirées au hasard (bruit de fond « sujets sans rapport ») ;
 *   3. la similarité de chaque article au vecteur de référence de la voix de marque
 *      (clé `brand_voice_reference_embedding_voyage`, si elle existe).
 *
 * et affiche min / p50 / p90 / p95 / p99 / max. Aucun UPDATE / INSERT / DELETE.
 *
 * USAGE : `pnpm tsx scripts/calibrer-seuils-voyage.ts [--echantillon=300]`
 * (DATABASE_URL de la base à mesurer ; lancer APRÈS le rattrapage, cf. R36).
 *
 * Lecture du résultat : poser `CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE` juste au-dessus
 * du p99 du bruit de fond ET en dessous des paires reconnues comme doublons à la main ;
 * `CONTENT_DEDUP_SIMILAR_THRESHOLD_VOYAGE` plus bas ; `BRAND_VOICE_DRIFT_*_THRESHOLD_VOYAGE`
 * sur les percentiles bas de la distribution (3).
 */

import { PrismaClient } from "../prisma/generated/client";

const prisma = new PrismaClient();

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] as number;
}

export function resume(valeurs: readonly number[]): Record<string, number> {
  const s = [...valeurs].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? NaN,
    p50: percentile(s, 50),
    p90: percentile(s, 90),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: s[s.length - 1] ?? NaN,
  };
}

function afficher(titre: string, valeurs: readonly number[]): void {
  console.log(`\n${titre}`);
  if (valeurs.length === 0) {
    console.log("  (aucune donnée)");
    return;
  }
  const r = resume(valeurs);
  for (const [k, v] of Object.entries(r)) {
    console.log(`  ${k.padEnd(4)} ${k === "n" ? v : v.toFixed(4)}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv.find((a) => a.startsWith("--echantillon="));
  const echantillon = Math.max(10, Math.min(2000, Number(arg?.split("=")[1] ?? 300) || 300));

  const comptage = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM articles WHERE status = 'published' AND embedding_voyage IS NOT NULL`,
  )) as Array<{ n: number }>;
  const n = comptage[0]?.n ?? 0;
  console.log(`[calibrage-voyage] articles publiés avec embedding_voyage : ${n} (lecture seule)`);
  if (n < 20) {
    console.log("Trop peu d'articles vectorisés : lancer d'abord le rattrapage (runbook R36).");
    return;
  }

  // 1. Plus proche voisin (hors soi-même) pour un échantillon d'articles.
  const voisins = (await prisma.$queryRawUnsafe(
    `SELECT (1 - (nn.d))::float8 AS sim
       FROM (SELECT id, embedding_voyage AS v FROM articles
              WHERE status = 'published' AND embedding_voyage IS NOT NULL
              ORDER BY random() LIMIT $1) s
       CROSS JOIN LATERAL (
         SELECT (b.embedding_voyage <=> s.v) AS d FROM articles b
          WHERE b.id <> s.id AND b.status = 'published' AND b.embedding_voyage IS NOT NULL
          ORDER BY b.embedding_voyage <=> s.v LIMIT 1) nn`,
    echantillon,
  )) as Array<{ sim: number }>;
  afficher(
    "Plus proche voisin (candidats aux seuils doublon / similaire)",
    voisins.map((r) => Number(r.sim)),
  );

  // 2. Paires aléatoires : le bruit de fond.
  const paires = (await prisma.$queryRawUnsafe(
    `SELECT (1 - (a.v <=> b.v))::float8 AS sim
       FROM (SELECT embedding_voyage AS v, row_number() OVER () AS rn FROM
              (SELECT embedding_voyage FROM articles WHERE status = 'published' AND embedding_voyage IS NOT NULL
               ORDER BY random() LIMIT $1) x) a
       JOIN (SELECT embedding_voyage AS v, row_number() OVER () AS rn FROM
              (SELECT embedding_voyage FROM articles WHERE status = 'published' AND embedding_voyage IS NOT NULL
               ORDER BY random() LIMIT $1) y) b
         ON a.rn = b.rn`,
    echantillon,
  )) as Array<{ sim: number }>;
  afficher(
    "Paires aléatoires (bruit de fond)",
    paires.map((r) => Number(r.sim)),
  );

  // 3. Distance à la référence de voix de marque.
  const ref = await prisma.contentGenConfig.findUnique({
    where: { key: "brand_voice_reference_embedding_voyage" },
  });
  if (Array.isArray(ref?.value) && ref.value.length === 1024) {
    const litteral = `[${(ref.value as number[]).join(",")}]`;
    const voix = (await prisma.$queryRawUnsafe(
      `SELECT (1 - (embedding_voyage <=> $1::vector))::float8 AS sim
         FROM articles WHERE status = 'published' AND embedding_voyage IS NOT NULL`,
      litteral,
    )) as Array<{ sim: number }>;
    afficher(
      "Similarité à la référence de voix de marque Voyage",
      voix.map((r) => Number(r.sim)),
    );
  } else {
    console.log(
      "\nRéférence de voix de marque Voyage absente : recalibrer depuis la console (R36).",
    );
  }
}

main()
  .catch((err) => {
    console.error("[calibrage-voyage] échec :", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
