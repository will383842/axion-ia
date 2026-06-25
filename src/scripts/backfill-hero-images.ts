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

async function main(): Promise<void> {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error(
      "[backfill-hero] UNSPLASH_ACCESS_KEY manquant — abandon (doctrine Unsplash-only).",
    );
    process.exitCode = 1;
    return;
  }

  // Import dynamique APRÈS le chargement de .env.local (le singleton Prisma lit
  // DATABASE_URL à l'instanciation). La logique vit dans la lib partagée, aussi
  // utilisée par le bouton admin (action serveur).
  const { backfillHeroImages } = await import("../server/content-gen/images/backfill-hero");

  const dryRun = process.env.BACKFILL_DRY_RUN === "1";
  // Doctrine « Unsplash uniquement » : par défaut on ne touche QUE les articles
  // sans hero. Avec BACKFILL_REPLACE_BANK=1, on remplace AUSSI les anciens héros
  // image-bank (chemin local `/images/...`, donc non `http`) par une vraie photo
  // Unsplash — les URLs Unsplash existantes sont toujours préservées.
  const replaceBank = process.env.BACKFILL_REPLACE_BANK === "1";

  console.log(
    `[backfill-hero] Démarrage (mode=${replaceBank ? "sans-hero + remplace-bank" : "sans-hero"}, dryRun=${dryRun})…`,
  );

  const result = await backfillHeroImages({
    dryRun,
    replaceBank,
    throttleMs: 1500, // throttle doux en plus de l'auto-throttle ~45/h du provider
    onItem: (line) => console.log(`[backfill-hero] ${line}`),
  });

  console.log(
    `[backfill-hero] Terminé. total=${result.total} updated=${result.updated} skipped=${result.skipped}${dryRun ? " (dry-run, 0 écriture)" : ""}`,
  );
}

main().catch((e) => {
  console.error("[backfill-hero] Échec :", e);
  process.exitCode = 1;
});
