/**
 * Chantier QNC, L03 — rattacher une session à un projet du MÊME client
 * (`training_sessions.projet_id`). Le lien ne se change pas une fois posé :
 * « rien ne s'efface » — un lien posé à tort se corrige à la main, en base,
 * avec la trace de pourquoi.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import { LOT_RECUEIL } from "./constantes";

type Db = Pick<typeof prisma, "setting" | "trainingSession" | "projet" | "activityLog">;

export type ResultatRattachement =
  | { readonly ok: true; readonly dejaRattachee: boolean }
  | { readonly ok: false; readonly message: string };

export async function rattacherSessionAuProjet(
  db: Db,
  entree: { readonly sessionId: string; readonly projetId: string; readonly auteurId: string },
): Promise<ResultatRattachement> {
  const session = await db.trainingSession.findUnique({
    where: { id: entree.sessionId },
    select: { id: true, clientId: true, projetId: true, estTestInterne: true },
  });
  if (session === null) return { ok: false, message: "Session introuvable." };
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  if (!estActifPour(etat, { estTestInterne: session.estTestInterne })) {
    return { ok: false, message: "Le recueil du besoin n'est pas allumé pour cette session." };
  }
  if (session.projetId === entree.projetId) return { ok: true, dejaRattachee: true };
  if (session.projetId !== null) {
    return {
      ok: false,
      message: "Cette session est déjà rattachée à un autre projet : le lien ne se change pas ici.",
    };
  }
  const projet = await db.projet.findUnique({
    where: { id: entree.projetId },
    select: { clientId: true, fusionneDansId: true },
  });
  if (
    projet === null ||
    projet.fusionneDansId !== null ||
    session.clientId === null ||
    projet.clientId !== session.clientId
  ) {
    return { ok: false, message: "Ce projet n'existe pas (ou plus) chez le client de la session." };
  }
  const lie = await db.trainingSession.updateMany({
    where: { id: session.id, projetId: null },
    data: { projetId: entree.projetId },
  });
  if (lie.count !== 1) {
    return { ok: false, message: "La session vient d'être rattachée : rechargez la page." };
  }
  await journaliser(
    db,
    {
      action: "qualiopi.recueil.session_rattachee",
      targetType: "TrainingSession",
      targetId: session.id,
      changes: { projetId: entree.projetId },
      session: { userId: entree.auteurId },
    },
    { exiger: true },
  );
  return { ok: true, dejaRattachee: false };
}
