/**
 * Chantier QNC, L03 — DÉROGATION MOTIVÉE à la garde de la convention.
 *
 * Une dérogation ne s'efface pas et ne se modifie pas : elle s'AJOUTE au
 * journal (qui, quand, motif). L'écran la montre en rouge tant qu'elle est le
 * seul chemin d'une convention ; chaque envoi qui l'utilise est journalisé à
 * son tour (`garderEnvoiConvention`).
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import {
  ACTION_DEROGATION_ACCORDEE,
  LOT_RECUEIL,
  MOTIF_DEROGATION_MAX,
  MOTIF_DEROGATION_MIN,
} from "./constantes";

type Db = Pick<typeof prisma, "setting" | "trainingSession" | "activityLog">;

export type ResultatDerogation =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export async function accorderDerogation(
  db: Db,
  entree: { readonly sessionId: string; readonly motif: string; readonly auteurId: string },
): Promise<ResultatDerogation> {
  const motif = entree.motif.trim().replace(/\s+/g, " ");
  if (motif.length < MOTIF_DEROGATION_MIN) {
    return {
      ok: false,
      message: `Dites pourquoi, en ${MOTIF_DEROGATION_MIN} caractères au moins : un motif qui ne dit rien ne couvre rien.`,
    };
  }
  if (motif.length > MOTIF_DEROGATION_MAX) {
    return { ok: false, message: `Motif trop long (${MOTIF_DEROGATION_MAX} caractères au plus).` };
  }
  const session = await db.trainingSession.findUnique({
    where: { id: entree.sessionId },
    select: { estTestInterne: true },
  });
  if (session === null) return { ok: false, message: "Session introuvable." };
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  if (!estActifPour(etat, { estTestInterne: session.estTestInterne })) {
    return { ok: false, message: "Le recueil du besoin n'est pas allumé pour cette session." };
  }
  await journaliser(
    db,
    {
      action: ACTION_DEROGATION_ACCORDEE,
      targetType: "TrainingSession",
      targetId: entree.sessionId,
      changes: { motif },
      session: { userId: entree.auteurId },
    },
    { exiger: true },
  );
  return { ok: true };
}
