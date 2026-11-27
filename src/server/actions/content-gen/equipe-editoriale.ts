/**
 * Console « Équipe éditoriale » (PR 17) — pilotage sans passer par Claude.
 *
 * Toutes les actions exigent un administrateur (`requireAdmin`) ; les écritures sont en plus
 * limitées en débit. Aucune nouvelle voie de publication : « Publier » appelle `approveReview`
 * (chemin existant : file de publication, tier-1), « Renvoyer » appelle `requestEdits` (boucle
 * qualité existante), au plus 1 fois par article depuis la console.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { persistContentGenConfig } from "@/server/content-gen/config-store";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { extractJobTitle } from "@/server/content-gen/shared/admin-labels";
import {
  ACTION_MARCHE,
  ACTION_PUBLIER,
  ACTION_QUOTAS,
  ACTION_RENVOYER,
  CLE_ARTICLES_MAX_JOUR,
  CLE_EQUIPE_MARCHE,
  CLE_MAJ_MAX_JOUR,
  RENVOIS_CONSOLE_MAX,
  etatEquipe,
  lireQuotas,
  marcheConsole,
  validerQuotas,
  type EtatEquipe,
  type QuotasEquipe,
} from "@/server/content-gen/equipe/pilotage";
import {
  estObjet,
  lireJournalEquipe,
  type EntreeJournalRole,
} from "@/server/content-gen/equipe/journal";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";
import { approveReview, requestEdits } from "./review";

const IdSchema = z.string().min(1).max(64);

function pageEquipe(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/equipe-editoriale`;
}

export interface ArticleARelire {
  readonly reviewId: string;
  readonly jobId: string;
  readonly titre: string | null;
  readonly causes: ReadonlyArray<string>;
  readonly coutUsd: number | null;
  readonly journal: ReadonlyArray<EntreeJournalRole>;
  readonly renvoisConsole: number;
  /** « pending » = actions possibles ; « needs_edits » = déjà renvoyé en correction. */
  readonly statut: string;
  readonly creeLe: Date;
}

export interface PilotageEquipe {
  readonly etat: EtatEquipe;
  readonly quotas: QuotasEquipe;
  readonly aRelire: ReadonlyArray<ArticleARelire>;
}

async function renvoisDepuisConsole(reviewId: string): Promise<number> {
  return prisma.activityLog.count({
    where: { action: ACTION_RENVOYER, changes: { path: ["reviewId"], equals: reviewId } },
  });
}

export async function getPilotageEquipe(): Promise<PilotageEquipe> {
  await requireAdmin();
  const [marche, quotas, lignes] = await Promise.all([
    marcheConsole(),
    lireQuotas(),
    prisma.reviewQueue.findMany({
      where: {
        status: { in: ["pending", "needs_edits"] },
        job: { outputJsonRaw: { path: ["equipe", "issue"], equals: "a_relire" } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        status: true,
        jobId: true,
        createdAt: true,
        job: { select: { outputJsonRaw: true } },
      },
    }),
  ]);
  const aRelire = await Promise.all(
    lignes.map(async (l): Promise<ArticleARelire> => {
      const j = lireJournalEquipe(l.job.outputJsonRaw);
      return {
        reviewId: l.id,
        statut: l.status,
        jobId: l.jobId,
        titre: extractJobTitle(l.job.outputJsonRaw),
        causes: j.causes,
        coutUsd: j.coutUsd,
        journal: j.journal,
        renvoisConsole: await renvoisDepuisConsole(l.id),
        creeLe: l.createdAt,
      };
    }),
  );
  return { etat: etatEquipe(marche), quotas, aRelire };
}

export async function definirMarcheEquipe(marche: boolean): Promise<void> {
  const session = await requireAdminWriteRateLimited("equipe-editoriale:marche");
  z.boolean().parse(marche);
  await persistContentGenConfig(
    CLE_EQUIPE_MARCHE,
    { marche, par: session.email, le: new Date().toISOString() },
    session.userId,
    "Marche / arrêt de l'équipe éditoriale (console)",
    { userId: session.userId, email: session.email },
  );
  await logActivity({
    session,
    action: ACTION_MARCHE,
    targetType: "ContentGenConfig",
    changes: { marche },
  });
  revalidatePath(pageEquipe());
}

export async function definirQuotasEquipe(entree: {
  articlesMaxJour: number;
  majMaxJour: number;
}): Promise<QuotasEquipe> {
  const session = await requireAdminWriteRateLimited("equipe-editoriale:quotas");
  const q = validerQuotas(entree);
  const acteur = { userId: session.userId, email: session.email };
  await persistContentGenConfig(
    CLE_ARTICLES_MAX_JOUR,
    q.articlesMaxJour,
    session.userId,
    "Équipe éditoriale : nouveaux articles par jour (0-10)",
    acteur,
  );
  await persistContentGenConfig(
    CLE_MAJ_MAX_JOUR,
    q.majMaxJour,
    session.userId,
    "Équipe éditoriale : mises à jour par jour (0-5)",
    acteur,
  );
  await logActivity({ session, action: ACTION_QUOTAS, targetType: "ContentGenConfig", changes: q });
  revalidatePath(pageEquipe());
  return q;
}

async function verifierARelire(reviewId: string): Promise<string> {
  const r = await prisma.reviewQueue.findUnique({
    where: { id: reviewId },
    select: { status: true, jobId: true, job: { select: { outputJsonRaw: true } } },
  });
  if (!r) throw new Error("review_not_found");
  const equipe = estObjet(r.job.outputJsonRaw) ? r.job.outputJsonRaw["equipe"] : undefined;
  if (r.status !== "pending" || !estObjet(equipe) || equipe["issue"] !== "a_relire") {
    throw new Error("review_not_a_relire");
  }
  return r.jobId;
}

/** « Publier » : réutilise `approveReview` (file de publication existante). Tracé (qui, quand). */
export async function publierArticleEquipe(reviewId: string): Promise<void> {
  const session = await requireAdminWriteRateLimited("equipe-editoriale:publier");
  IdSchema.parse(reviewId);
  const jobId = await verifierARelire(reviewId);
  await approveReview(reviewId, "Relecture humaine (console Équipe éditoriale)");
  await logActivity({
    session,
    action: ACTION_PUBLIER,
    targetType: "ReviewQueue",
    changes: { reviewId, jobId },
  });
  revalidatePath(pageEquipe());
}

/** « Renvoyer en correction » : un renvoi de plus (`requestEdits`), au plus 1 depuis la console. */
export async function renvoyerArticleEquipe(reviewId: string, consigne?: string): Promise<void> {
  const session = await requireAdminWriteRateLimited("equipe-editoriale:renvoyer");
  IdSchema.parse(reviewId);
  const jobId = await verifierARelire(reviewId);
  if ((await renvoisDepuisConsole(reviewId)) >= RENVOIS_CONSOLE_MAX) {
    throw new Error("renvoi_deja_fait : un seul renvoi en correction depuis la console");
  }
  const texte =
    consigne && consigne.trim().length >= 10
      ? consigne.trim()
      : "Renvoi en correction depuis la console Équipe éditoriale (relecture humaine).";
  await requestEdits(reviewId, texte);
  await logActivity({
    session,
    action: ACTION_RENVOYER,
    targetType: "ReviewQueue",
    changes: { reviewId, jobId },
  });
  revalidatePath(pageEquipe());
}
