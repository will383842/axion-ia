/**
 * Content Generator — Backfill des citations structurées (action admin).
 *
 * Bouton console « Remplir le bloc Sources sur les anciens articles ». Tourne DANS
 * le conteneur (app Next), donc accès Prisma direct à la base prod sans aucune
 * exposition réseau de la DB. Réutilise la lib partagée `backfill-citations` (même
 * logique que le script CLI local) — l'image prod étant `standalone`, on ne peut
 * pas y lancer le script `tsx` : ce bouton est la voie propre.
 *
 * Deux opérations :
 *   • previewCitationsBackfill → simulation (dry-run), 0 écriture, renvoie le total
 *     d'articles à scanner + un échantillon. Sert à montrer l'ampleur avant d'agir.
 *   • runCitationsBackfill     → traite un BATCH (plafonné) à partir d'un curseur et
 *     écrit en base. Le plafond évite tout timeout HTTP : l'UI reclique avec le
 *     `nextCursor` jusqu'à « 0 restant ».
 *
 * Doctrine § 4.1bis : tout effet de bord admin passe par une Server Action.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  backfillCitations,
  countFrArticleTranslations,
  type BackfillCitationItem,
} from "@/server/content-gen/links/backfill-citations";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

// Plafond d'articles scannés par clic. Chaque article = 1 détection regex (rapide)
// + quelques upserts DB pour ceux qui citent. 50 garde la requête bien sous les
// timeouts proxy/Coolify.
const BATCH_LIMIT = 50;

const InputSchema = z
  .object({ cursor: z.string().uuid().nullable().optional() })
  .strict()
  .optional();

export interface CitationsBackfillPreview {
  /** Total d'articles FR à scanner (toute la passe). */
  totalArticles: number;
  /** Dans l'échantillon, combien d'articles obtiendraient ≥1 citation. */
  sampleWithCitations: number;
  sample: BackfillCitationItem[];
  batchLimit: number;
}

export interface CitationsBackfillRunResult {
  processed: number;
  updated: number;
  skipped: number;
  citations: number;
  hallucinatedCount: number;
  nextCursor: string | null;
  remaining: number;
  items: BackfillCitationItem[];
  batchLimit: number;
}

/**
 * Simulation : total d'articles à scanner + aperçu (10 max) des premiers articles
 * et de leurs citations détectées. Aucune écriture.
 */
export async function previewCitationsBackfill(): Promise<
  CitationsBackfillPreview | { error: string }
> {
  try {
    await requireAdmin();

    const totalArticles = await countFrArticleTranslations(null);
    const preview = await backfillCitations({
      dryRun: true,
      limit: 20,
      cursor: null,
      onlyMissing: true,
    });
    const sampleWithCitations = preview.items.filter((i) => i.action === "persisted").length;

    return {
      totalArticles,
      sampleWithCitations,
      sample: preview.items.slice(0, 10),
      batchLimit: BATCH_LIMIT,
    };
  } catch (err) {
    Sentry.captureException(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Traite un batch (BATCH_LIMIT max) depuis `cursor` et écrit en base. Renvoie le
 * `nextCursor` + le reste à traiter pour que l'UI reclique jusqu'à 0.
 */
export async function runCitationsBackfill(
  input?: z.infer<typeof InputSchema>,
): Promise<CitationsBackfillRunResult | { error: string }> {
  try {
    const session = await requireAdminWriteRateLimited("citations-backfill", {
      limit: 30,
      windowSec: 60,
    });
    const { cursor = null } = InputSchema.parse(input) ?? {};

    const result = await backfillCitations({ limit: BATCH_LIMIT, cursor, onlyMissing: true });
    // nextCursor null = dernière page atteinte ⇒ plus rien après.
    const remaining = result.nextCursor ? await countFrArticleTranslations(result.nextCursor) : 0;

    // Le bloc « Sources » s'affiche sur les pages DÉTAIL : on revalide les routes
    // détail (toutes les instances du segment dynamique [slug]) pour que le bloc
    // apparaisse immédiatement, sans attendre la fenêtre ISR (revalidate 3600).
    // Invalidation paresseuse : les pages se ré-rendent à la prochaine requête.
    // On rafraîchit aussi les listings pour cohérence (miniatures, etc.).
    for (const seg of ["blog", "actualites", "guides"] as const) {
      revalidatePath(`/[locale]/${seg}`, "page");
      revalidatePath(`/[locale]/${seg}/[slug]`, "page");
    }

    await logActivity({
      action: "content-gen.citations.backfill",
      targetType: "Article",
      changes: {
        processed: result.total,
        updated: result.updated,
        citations: result.totalCitations,
        nextCursor: result.nextCursor,
      },
      session,
    });

    return {
      processed: result.total,
      updated: result.updated,
      skipped: result.skipped,
      citations: result.totalCitations,
      hallucinatedCount: result.hallucinatedUrls.length,
      nextCursor: result.nextCursor,
      remaining,
      items: result.items.slice(0, 25),
      batchLimit: BATCH_LIMIT,
    };
  } catch (err) {
    Sentry.captureException(err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
