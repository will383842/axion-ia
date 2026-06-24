/**
 * Backfill des images hero Unsplash pour les articles publiés SANS featured image.
 *
 * Doctrine « Unsplash uniquement » (Will 2026-06-21) : on réutilise EXACTEMENT le
 * même pipeline que la génération (`selectHeroImage`) → photo Unsplash réelle (0 IA)
 * + alt + crédit photographe (CGU §6), hotlink `images.unsplash.com` (whitelisté
 * `next.config`). Aucune image-bank (on filtre `source === "unsplash"`).
 *
 * Cible : `Article` status=published AND featuredImage NULL.
 * Idempotent : ne retouche jamais un article déjà illustré. **Re-lançable** → sert
 * aussi de filet de garantie (rattrape les héros que l'assignation inline du worker
 * a ratés, celle-ci étant best-effort/non bloquante).
 *
 *   Local (DB Docker)  :  pnpm tsx src/scripts/backfill-hero-images.ts
 *   Dry-run (preview)  :  BACKFILL_DRY_RUN=1 pnpm tsx src/scripts/backfill-hero-images.ts
 *   Remplacer bank     :  BACKFILL_REPLACE_BANK=1 pnpm tsx src/scripts/backfill-hero-images.ts
 *                         → convertit AUSSI les anciens héros image-bank (chemin
 *                           local) en photo Unsplash ; préserve les URLs Unsplash.
 *   Prod (env injecté) :  DATABASE_URL=<prod> UNSPLASH_ACCESS_KEY=<key> pnpm tsx src/scripts/backfill-hero-images.ts
 *                         (ou dans le container : docker exec <app> pnpm tsx src/scripts/backfill-hero-images.ts)
 *
 * Pré-requis DB cible : ProviderConfig provider="unsplash" enabled=true (seedé).
 * Rate limit Unsplash : provider auto-throttle ~45/h ; throttle additionnel 1,5 s/article.
 * Post-run : l'ISR (revalidate 3600) republie les `/blog/<slug>` sous 1 h.
 */

// Type-only (effacé à la compilation → n'affecte pas l'ordre de chargement env).
import type { Prisma } from "../../prisma/generated/client";

// Charge .env.local UNIQUEMENT en local (DATABASE_URL non exporté). En prod,
// l'env est injecté par Coolify → on n'y touche pas. DOIT précéder l'import du
// singleton Prisma (qui lit DATABASE_URL à l'instanciation) — d'où les imports
// dynamiques dans main().
const loadEnvFile = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
if (!process.env.DATABASE_URL && loadEnvFile) {
  try {
    loadEnvFile(".env.local");
  } catch {
    /* pas de .env.local (container prod) — on utilise l'env exporté tel quel */
  }
}

const KEYWORD_KEYS = ["primaryKeyword", "targetKeyword", "keyword", "resolvedKeyword"] as const;

async function main(): Promise<void> {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error(
      "[backfill-hero] UNSPLASH_ACCESS_KEY manquant — abandon (doctrine Unsplash-only).",
    );
    process.exitCode = 1;
    return;
  }

  const { prisma } = await import("../lib/prisma");
  const { selectHeroImage } = await import("../server/content-gen/images/select-hero-image");

  const dryRun = process.env.BACKFILL_DRY_RUN === "1";
  // Doctrine « Unsplash uniquement » : par défaut on ne touche QUE les articles
  // sans hero. Avec BACKFILL_REPLACE_BANK=1, on remplace AUSSI les anciens héros
  // image-bank (chemin local `/images/...`, donc non `http`) par une vraie photo
  // Unsplash — les URLs Unsplash existantes (`https://images.unsplash.com/...`)
  // sont toujours préservées (Will 2026-06-24 : « tout en Unsplash, pas la bank »).
  const replaceBank = process.env.BACKFILL_REPLACE_BANK === "1";

  const where: Prisma.ArticleWhereInput = replaceBank
    ? {
        status: "published",
        OR: [{ featuredImage: null }, { NOT: { featuredImage: { startsWith: "http" } } }],
      }
    : { status: "published", featuredImage: null };

  const articles = await prisma.article.findMany({
    where,
    select: {
      id: true,
      featuredImage: true,
      generatedByJobId: true,
      mentionedCities: true,
      translations: { where: { locale: "fr" }, select: { slug: true, title: true }, take: 1 },
    },
    orderBy: { publishedAt: "asc" },
  });

  console.log(
    `[backfill-hero] ${articles.length} article(s) publié(s) cible(s)` +
      ` (mode=${replaceBank ? "sans-hero + remplace-bank" : "sans-hero"}). dryRun=${dryRun}`,
  );

  let updated = 0;
  let skipped = 0;

  for (const a of articles) {
    const t = a.translations[0];
    const slug = t?.slug ?? a.id;
    let primaryKeyword = (t?.title ?? "").trim();
    let contentType = "blog_article";

    // Mot-clé : on préfère celui du job générateur (le plus pertinent visuellement) ;
    // fallback = titre FR de l'article.
    if (a.generatedByJobId) {
      const job = await prisma.contentGenJob
        .findUnique({
          where: { id: a.generatedByJobId },
          select: { inputPayload: true, contentType: true },
        })
        .catch(() => null);
      if (job?.contentType) contentType = job.contentType;
      const payload = (job?.inputPayload ?? {}) as Record<string, unknown>;
      const kw = KEYWORD_KEYS.map((k) => payload[k]).find(
        (v): v is string => typeof v === "string" && v.trim().length > 0,
      );
      if (kw) primaryKeyword = kw.trim();
    }

    if (!primaryKeyword) {
      console.log(`[backfill-hero] SKIP ${slug} — aucun mot-clé exploitable.`);
      skipped++;
      continue;
    }

    // exactOptionalPropertyTypes : n'inclure anchorVilleSlug que s'il est défini
    // (passer `undefined` explicitement est interdit par le type optionnel).
    const anchorVilleSlug = a.mentionedCities?.[0];
    const hero = await selectHeroImage({
      jobId: a.generatedByJobId ?? `backfill-${a.id}`,
      contentType,
      primaryKeyword,
      ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
    });

    // Doctrine : on n'accepte QUE de l'Unsplash (jamais image-bank ici).
    if (!hero || hero.source !== "unsplash") {
      console.log(
        `[backfill-hero] SKIP ${slug} — Unsplash sans résultat (kw="${primaryKeyword}").`,
      );
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.article.update({
        where: { id: a.id },
        data: {
          featuredImage: hero.url,
          featuredImageAltFr: hero.alt,
          ...(hero.photographerName
            ? {
                featuredImagePhotographerName: hero.photographerName,
                featuredImagePhotographerUrl: hero.photographerUrl,
              }
            : {}),
        },
      });
    }

    updated++;
    const verb = a.featuredImage ? "REPLACE bank→unsplash" : "NEW";
    console.log(
      `[backfill-hero] ${dryRun ? "DRY " : "OK  "}${verb} ${slug} → ${hero.url}  (📷 ${hero.photographerName ?? "?"})`,
    );
    // Throttle doux (en plus de l'auto-throttle ~45/h du provider).
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(
    `[backfill-hero] Terminé. updated=${updated} skipped=${skipped}${dryRun ? " (dry-run, 0 écriture)" : ""}`,
  );
}

main().catch((e) => {
  console.error("[backfill-hero] Échec :", e);
  process.exitCode = 1;
});
