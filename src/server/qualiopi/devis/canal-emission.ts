/**
 * Canal d'émission d'un devis (lot I1) : par e-mail (un jeton de signature a été émis), en main
 * propre (trace `qualiopi.devis.remis_main_propre` écrite dans la transaction de la remise), ou
 * inconnu (devis antérieur à la trace). Module pur : aucune action serveur.
 */

import type { DocumentPartieSignataire } from "../../../../prisma/generated/client";

export const ACTION_REMIS_MAIN_PROPRE = "qualiopi.devis.remis_main_propre";

export type CanalEmission = "email" | "main_propre" | "inconnu";

/** Lecteur minimal : accepte `prisma` comme une transaction. */
export interface LecteurCanalEmission {
  activityLog: {
    findFirst: (args: {
      where: { action: string; targetType: string; targetId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  documentSignatureToken: {
    findFirst: (args: {
      where: { documentGenereId: string; partie: DocumentPartieSignataire };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/** La trace PRIME sur le jeton. */
export function deduireCanalEmission(entree: {
  traceMainPropre: boolean;
  jetonClientEmis: boolean;
}): CanalEmission {
  if (entree.traceMainPropre) return "main_propre";
  if (entree.jetonClientEmis) return "email";
  return "inconnu";
}

/** Égalité EXACTE sur l'action : `…_refuse` ne compte pas. */
export async function devisRemisEnMainPropre(
  db: Pick<LecteurCanalEmission, "activityLog">,
  devisId: string,
): Promise<boolean> {
  const ligne = await db.activityLog.findFirst({
    where: { action: ACTION_REMIS_MAIN_PROPRE, targetType: "Devis", targetId: devisId },
    select: { id: true },
  });
  return ligne !== null;
}

/** `null` pour un brouillon (aucune requête). Les jetons révoqués comptent : un e-mail est parti. */
export async function lireCanalEmission(
  db: LecteurCanalEmission,
  devis: { id: string; statut: string; documentGenereId: string | null },
): Promise<CanalEmission | null> {
  if (devis.statut === "brouillon") return null;
  const traceMainPropre = await devisRemisEnMainPropre(db, devis.id);
  let jetonClientEmis = false;
  if (devis.documentGenereId !== null) {
    const jeton = await db.documentSignatureToken.findFirst({
      where: { documentGenereId: devis.documentGenereId, partie: "client" },
      select: { id: true },
    });
    jetonClientEmis = jeton !== null;
  }
  return deduireCanalEmission({ traceMainPropre, jetonClientEmis });
}
