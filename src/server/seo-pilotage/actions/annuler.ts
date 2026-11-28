/**
 * Retour arrière d'une modification journalisée (P13). Refusé si le corps actuel n'est plus
 * celui que la modification a écrit (retouche entre-temps) : le conflit est rendu, rien n'est écrit.
 * Restaure le corps ET les dates d'origine. Aucun fichier écrit.
 */
import { Prisma } from "../../../../prisma/generated/client";
import { CHAMP_CORPS, hashTexte, type AvantCorps } from "./journal";

export type ResultatAnnulation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly motif:
        "introuvable" | "deja_traitee" | "champ_non_gere" | "conflit" | "avant_absent";
    };

export interface TxAnnulation {
  seoModification: {
    findUnique(a: unknown): Promise<{
      id: string;
      cibleType: string;
      cibleId: string;
      champ: string;
      etat: string;
      avant: unknown;
      hashApres: string | null;
      dateAvant: Date | null;
    } | null>;
    update(a: unknown): Promise<unknown>;
  };
  articleTranslation: {
    findFirst(a: unknown): Promise<{ body: string } | null>;
    updateMany(a: unknown): Promise<{ count: number }>;
  };
  article: { update(a: unknown): Promise<unknown> };
}

function avantValide(v: unknown): v is AvantCorps {
  return typeof v === "object" && v !== null && typeof (v as { body?: unknown }).body === "string";
}

export async function annulerModification(
  tx: TxAnnulation,
  modificationId: string,
  decidePar: string,
): Promise<ResultatAnnulation> {
  const m = await tx.seoModification.findUnique({ where: { id: modificationId } });
  if (!m) return { ok: false, motif: "introuvable" };
  if (m.etat !== "appliquee" && m.etat !== "mesuree") return { ok: false, motif: "deja_traitee" };
  if (m.champ !== CHAMP_CORPS || m.cibleType !== "article") {
    return { ok: false, motif: "champ_non_gere" };
  }
  if (!avantValide(m.avant)) return { ok: false, motif: "avant_absent" };

  const actuel = await tx.articleTranslation.findFirst({
    where: { articleId: m.cibleId, locale: "fr" },
    select: { body: true },
  });
  if (!actuel || !m.hashApres || hashTexte(actuel.body) !== m.hashApres) {
    return { ok: false, motif: "conflit" };
  }

  const avant = m.avant;
  const restaure = await tx.articleTranslation.updateMany({
    // Conditionné au corps vérifié : une écriture concurrente n'est jamais écrasée.
    where: { articleId: m.cibleId, locale: "fr", body: actuel.body },
    data: {
      body: avant.body,
      bodyText: avant.bodyText,
      bodyJson:
        avant.bodyJson === null || avant.bodyJson === undefined
          ? Prisma.DbNull
          : (avant.bodyJson as Prisma.InputJsonValue),
      ...(m.dateAvant ? { updatedAt: m.dateAvant } : {}),
    },
  });
  if (restaure.count !== 1) {
    // Rien n'a été écrit : le corps a changé entre la lecture et l'écriture.
    return { ok: false, motif: "conflit" };
  }
  if (avant.articleUpdatedAt) {
    await tx.article.update({
      where: { id: m.cibleId },
      data: { updatedAt: new Date(avant.articleUpdatedAt) },
    });
  }
  await tx.seoModification.update({
    where: { id: m.id },
    data: { etat: "annulee", decidePar },
  });
  return { ok: true };
}
