/**
 * Journal des modifications du pilotage SEO (P13) : écrit l'« avant » et l'« après » dans la MÊME
 * transaction que la modification. Aucune lecture réseau, aucun fichier écrit.
 *
 * Verrou : une seule modification par cible tous les 28 jours (`verrou28Jours`), doublé par
 * l'index unique partiel `seo_modifications_une_en_cours_key` (proposée ou appliquée).
 */
import { createHash } from "node:crypto";
import { Prisma } from "../../../../prisma/generated/client";

export const JOURS_VERROU = 28;
export const MS_JOUR = 24 * 3600 * 1000;
export const CHAMP_CORPS = "body";
export const TYPE_CIBLE_ARTICLE = "article";

export class VerrouModificationError extends Error {
  constructor(readonly cibleId: string) {
    super(`Cible ${cibleId} déjà modifiée depuis moins de ${JOURS_VERROU} jours`);
    this.name = "VerrouModificationError";
  }
}

export const hashTexte = (t: string): string => createHash("sha256").update(t).digest("hex");

/** Vrai tant que la dernière application date de moins de 28 jours. */
export function verrou28Jours(appliqueeLe: Date | null | undefined, maintenant: Date): boolean {
  if (!appliqueeLe) return false;
  return maintenant.getTime() - appliqueeLe.getTime() < JOURS_VERROU * MS_JOUR;
}

/** Contenu du champ `avant` d'une modification du corps. */
export interface AvantCorps {
  readonly body: string;
  readonly bodyText: string | null;
  readonly bodyJson: unknown;
  /** `Article.updatedAt` d'origine. */
  readonly articleUpdatedAt: string | null;
}

/** Sous-ensemble du client transactionnel utilisé (permet un faux léger en test). */
export interface TxJournal {
  articleTranslation: {
    findFirst(a: unknown): Promise<{
      body: string;
      bodyText: string | null;
      bodyJson: unknown;
      updatedAt: Date;
    } | null>;
    updateMany(a: unknown): Promise<{ count: number }>;
  };
  article: {
    findUnique(a: unknown): Promise<{ updatedAt: Date } | null>;
    update(a: unknown): Promise<unknown>;
  };
  seoModification: {
    findFirst(a: unknown): Promise<{ appliqueeLe: Date | null } | null>;
    updateMany(a: unknown): Promise<{ count: number }>;
    create(a: unknown): Promise<{ id: string }>;
  };
}

export interface EntreeCorps {
  readonly articleId: string;
  readonly html: string;
  readonly texteBrut: string;
  /** Date réellement publiée après écriture. */
  readonly dateModifiee: Date;
  readonly origine: string;
  readonly raison?: string;
  readonly url?: string;
  readonly coutUsd?: number;
  readonly decidePar?: string;
}

/**
 * Écrit le corps FR d'un article et son journal, dans la transaction `tx` de l'appelant.
 * Pose la date sur `ArticleTranslation.updatedAt` (celle que le blog lit) ET sur `Article.updatedAt`.
 */
export async function ecrireCorpsJournalise(
  tx: TxJournal,
  e: EntreeCorps,
): Promise<{ id: string }> {
  const traduction = await tx.articleTranslation.findFirst({
    where: { articleId: e.articleId, locale: "fr" },
    select: { body: true, bodyText: true, bodyJson: true, updatedAt: true },
  });
  if (!traduction) throw new Error(`Traduction FR introuvable pour ${e.articleId}`);
  const article = await tx.article.findUnique({
    where: { id: e.articleId },
    select: { updatedAt: true },
  });

  // Les applications de plus de 28 jours sortent du verrou (en attendant la mesure d'effet).
  await tx.seoModification.updateMany({
    where: {
      cibleType: TYPE_CIBLE_ARTICLE,
      cibleId: e.articleId,
      etat: "appliquee",
      appliqueeLe: { lte: new Date(e.dateModifiee.getTime() - JOURS_VERROU * MS_JOUR) },
    },
    data: { etat: "mesuree" },
  });
  const derniere = await tx.seoModification.findFirst({
    where: { cibleType: TYPE_CIBLE_ARTICLE, cibleId: e.articleId, etat: "appliquee" },
    orderBy: { appliqueeLe: "desc" },
    select: { appliqueeLe: true },
  });
  if (verrou28Jours(derniere?.appliqueeLe, e.dateModifiee)) {
    throw new VerrouModificationError(e.articleId);
  }

  const avant: AvantCorps = {
    body: traduction.body,
    bodyText: traduction.bodyText,
    bodyJson: traduction.bodyJson ?? null,
    articleUpdatedAt: article?.updatedAt.toISOString() ?? null,
  };
  await tx.articleTranslation.updateMany({
    where: { articleId: e.articleId, locale: "fr" },
    data: {
      body: e.html,
      bodyText: e.texteBrut,
      bodyJson: Prisma.DbNull,
      updatedAt: e.dateModifiee,
    },
  });
  await tx.article.update({ where: { id: e.articleId }, data: { updatedAt: e.dateModifiee } });
  return tx.seoModification.create({
    data: {
      cibleType: TYPE_CIBLE_ARTICLE,
      cibleId: e.articleId,
      url: e.url ?? null,
      champ: CHAMP_CORPS,
      avant: avant as unknown as Prisma.InputJsonValue,
      apres: { body: e.html } as Prisma.InputJsonValue,
      hashAvant: hashTexte(traduction.body),
      hashApres: hashTexte(e.html),
      etat: "appliquee",
      origine: e.origine,
      raison: e.raison ?? null,
      coutUsd: e.coutUsd ?? 0,
      appliqueeLe: e.dateModifiee,
      dateAvant: traduction.updatedAt,
      decidePar: e.decidePar ?? null,
    },
  });
}
