/**
 * Alerte `delai_facturation_opco` (chantier OPCO A3).
 *
 * En subrogation, c'est l'organisme qui facture l'OPCO — et chaque OPCO rejette
 * la facture reçue après son délai (Atlas : 3 mois après la fin de la
 * formation, « sous peine de rejet automatique »). Passé ce délai, la créance
 * est perdue. L'alerte se lève à J-15 de `dateLimiteFacturation` tant
 * qu'aucune facture à l'OPCO n'est émise, et devient critique une fois la
 * date passée.
 *
 * Aucune donnée personnelle dans le texte : le numéro de session, l'OPCO et
 * la date limite suffisent.
 */

import { prisma } from "@/lib/prisma";
import {
  dateLimiteFacturation,
  isOpcoId,
  opcoLabel,
} from "@/server/qualiopi/financements/opco-referentiel";
import type { AlerteCandidate } from "./evaluateur";

export const SEUIL_ALERTE_FACTURATION_JOURS = 15;

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Le délai le plus long du référentiel est de 120 jours : 365 couvre large. */
const FENETRE_JOURS = 365;
const PLAFOND_SESSIONS = 500;

type SessionLue = {
  id: string;
  numero: string;
  dateFin: Date;
  client: { opco: string | null } | null;
};

/** Décision PURE : quelles sessions approchent (ou ont dépassé) la limite. */
export function candidatsDelaiFacturationOpco(
  sessions: SessionLue[],
  now: Date,
): AlerteCandidate[] {
  const alertes: AlerteCandidate[] = [];
  for (const s of sessions) {
    const opco = s.client?.opco ?? null;
    if (!isOpcoId(opco)) continue;
    const limite = dateLimiteFacturation(opco, s.dateFin);
    if (!limite) continue;
    if (now.getTime() < limite.getTime() - SEUIL_ALERTE_FACTURATION_JOURS * JOUR_MS) continue;
    const depassee = now.getTime() > limite.getTime();
    const date = limite.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    alertes.push({
      code: "delai_facturation_opco",
      niveau: depassee ? "critique" : "important",
      titre: depassee
        ? "Date limite de facturation OPCO dépassée"
        : "Facture OPCO à émettre avant la date limite",
      message: depassee
        ? `La session ${s.numero} est en subrogation ${opcoLabel(opco)} et aucune facture n'a été émise à l'OPCO avant le ${date} : la facture risque le rejet, vérifiez auprès de l'OPCO.`
        : `La session ${s.numero} est en subrogation ${opcoLabel(opco)} : la facture à l'OPCO doit être émise au plus tard le ${date}.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return alertes;
}

export async function regleDelaiFacturationOpco(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["en_cours", "realisee"] },
      financementType: { in: ["opco", "mixte"] },
      opcoSubrogation: true,
      dateFin: { lte: now, gte: new Date(now.getTime() - FENETRE_JOURS * JOUR_MS) },
      facturesFormation: {
        none: { destinataire: "opco", statut: { notIn: ["brouillon", "annulee"] } },
      },
    },
    orderBy: { dateFin: "asc" },
    take: PLAFOND_SESSIONS,
    select: { id: true, numero: true, dateFin: true, client: { select: { opco: true } } },
  });
  return candidatsDelaiFacturationOpco(sessions, now);
}
