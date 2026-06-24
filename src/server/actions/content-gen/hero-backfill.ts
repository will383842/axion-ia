/**
 * Content Generator — Rattrapage des photos hero Unsplash (action admin).
 *
 * Bouton console « Rattraper les photos Unsplash ». Tourne DANS le conteneur
 * (app Next), donc accès Prisma direct à la base prod sans aucune exposition
 * réseau de la DB. Réutilise la lib partagée `backfill-hero` (même logique que
 * le script CLI local).
 *
 * Deux opérations :
 *   • previewHeroBackfill  → simulation (dry-run), 0 écriture, renvoie le compte
 *     + un échantillon. Sert à montrer « N articles concernés » avant d'agir.
 *   • runHeroBackfill      → traite un BATCH (plafonné) et écrit en base. Le
 *     plafond évite tout timeout HTTP : on reclique jusqu'à « 0 restant ».
 *
 * Doctrine § 4.1bis : tout effet de bord admin passe par une Server Action.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  backfillHeroImages,
  countHeroBackfillTargets,
  type BackfillHeroItem,
} from "@/server/content-gen/images/backfill-hero";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

// Plafond d'articles traités par clic. Chaque article = 1 appel Unsplash
// (~0,5–2 s). 25 garde la requête bien sous les timeouts proxy/Coolify.
const BATCH_LIMIT = 25;

const InputSchema = z.object({ replaceBank: z.boolean().optional() }).strict().optional();

export interface HeroBackfillPreview {
  remaining: number;
  sample: BackfillHeroItem[];
  batchLimit: number;
}

export interface HeroBackfillRunResult {
  processed: number;
  updated: number;
  skipped: number;
  remaining: number;
  items: BackfillHeroItem[];
  batchLimit: number;
}

/**
 * Simulation : combien d'articles restent à illustrer + un aperçu (10 max) des
 * photos qui seraient posées. Aucune écriture.
 */
export async function previewHeroBackfill(
  input?: z.infer<typeof InputSchema>,
): Promise<HeroBackfillPreview | { error: string }> {
  try {
    await requireAdmin();
    const { replaceBank = false } = InputSchema.parse(input) ?? {};

    if (!process.env.UNSPLASH_ACCESS_KEY) {
      return { error: "UNSPLASH_ACCESS_KEY absente côté serveur (doctrine Unsplash-only)." };
    }

    const remaining = await countHeroBackfillTargets(replaceBank);
    // Échantillon : dry-run sur un petit lot pour montrer de vraies photos.
    const preview = await backfillHeroImages({ dryRun: true, replaceBank, limit: 10 });

    return { remaining, sample: preview.items, batchLimit: BATCH_LIMIT };
  } catch (err) {
    Sentry.captureException(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Traite un batch (BATCH_LIMIT max) et écrit en base. Renvoie le reste à traiter
 * pour que l'UI invite à recliquer jusqu'à 0.
 */
export async function runHeroBackfill(
  input?: z.infer<typeof InputSchema>,
): Promise<HeroBackfillRunResult | { error: string }> {
  try {
    await requireAdminWriteRateLimited("hero-backfill", { limit: 30, windowSec: 60 });
    const { replaceBank = false } = InputSchema.parse(input) ?? {};

    if (!process.env.UNSPLASH_ACCESS_KEY) {
      return { error: "UNSPLASH_ACCESS_KEY absente côté serveur (doctrine Unsplash-only)." };
    }

    const result = await backfillHeroImages({ replaceBank, limit: BATCH_LIMIT });
    const remaining = await countHeroBackfillTargets(replaceBank);

    // Les pages blog sont en ISR (revalidate 3600) ; on force un refresh des
    // routes de listing pour voir les miniatures plus vite.
    revalidatePath("/[locale]/blog", "page");

    return {
      processed: result.total,
      updated: result.updated,
      skipped: result.skipped,
      remaining,
      items: result.items,
      batchLimit: BATCH_LIMIT,
    };
  } catch (err) {
    Sentry.captureException(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
