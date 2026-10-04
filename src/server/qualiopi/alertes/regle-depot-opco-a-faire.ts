/**
 * Alerte `depot_opco_a_faire` (chantier OPCO A6).
 *
 * C'est l'ENTREPRISE qui dépose sa demande de prise en charge sur son espace
 * OPCO (Atlas : « obligatoirement par l'entreprise depuis son compte
 * myAtlas ») ; un dépôt tardif est refusé (Constructys : dossier complet
 * 15 jours avant le début). L'organisme ne dépose pas, mais il doit savoir où
 * en est le dépôt : l'alerte se lève à J-7 de `dateLimiteDepotPourSession`
 * tant que le dossier n'a pas de « Dépôt fait le », et devient critique une
 * fois la date passée. Elle se referme dès que la date de dépôt est saisie.
 *
 * Aucune donnée personnelle dans le texte : le numéro de session, l'OPCO et
 * la date limite suffisent.
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import { prisma } from "@/lib/prisma";
import {
  dateLimiteDepotPourSession,
  opcoDuClient,
  opcoLabel,
  type OpcoClient,
} from "@/server/qualiopi/financements/opco-referentiel";
import type { AlerteCandidate } from "./evaluateur";

export const SEUIL_ALERTE_DEPOT_JOURS = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Le plus long délai de dépôt du référentiel est de 30 jours : 60 jours couvrent J-7. */
const HORIZON_JOURS = 60;
/** Une session restée « planifiée » après son début reste lue un an, puis sort. */
const RETARD_MAX_JOURS = 365;
const PLAFOND_SESSIONS = 500;

type SessionLue = {
  id: string;
  numero: string;
  dateDebut: Date;
  client: OpcoClient | null;
  dossiersFinancement: { depotFaitLe: Date | null }[];
};

/** Décision PURE : quelles sessions approchent (ou ont dépassé) la date limite de dépôt. */
export function candidatsDepotOpcoAFaire(sessions: SessionLue[], now: Date): AlerteCandidate[] {
  const alertes: AlerteCandidate[] = [];
  const aujourdhui = dayKeyInParis(now);
  for (const s of sessions) {
    if (s.dossiersFinancement.some((d) => d.depotFaitLe !== null)) continue;
    // Même règle que le dossier prêt à déposer : typé d'abord, texte libre ensuite.
    const opco = opcoDuClient(s.client);
    if (!opco) continue;
    const limite = dateLimiteDepotPourSession(opco, s.dateDebut);
    if (!limite) continue;
    // Comparaison au JOUR CIVIL de Paris : le jour de la date limite compte encore.
    const seuil = dayKeyInParis(new Date(limite.getTime() - SEUIL_ALERTE_DEPOT_JOURS * JOUR_MS));
    if (aujourdhui < seuil) continue;
    const depassee = aujourdhui > dayKeyInParis(limite);
    const date = limite.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
    alertes.push({
      code: "depot_opco_a_faire",
      niveau: depassee ? "critique" : "important",
      titre: depassee
        ? "Date limite de dépôt OPCO dépassée"
        : "Dépôt de la demande OPCO à faire par l'entreprise",
      message: depassee
        ? `La session ${s.numero} est financée par ${opcoLabel(opco)} et aucun dépôt de la demande de prise en charge n'est saisi au ${date} : vérifiez auprès de l'entreprise, puis saisissez la date de dépôt sur le dossier de financement.`
        : `La session ${s.numero} est financée par ${opcoLabel(opco)} : l'entreprise doit déposer sa demande de prise en charge au plus tard le ${date}. Remettez-lui le dossier prêt à déposer, puis saisissez la date de dépôt.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return alertes;
}

export async function regleDepotOpcoAFaire(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      financementType: { in: ["opco", "mixte"] },
      dateDebut: {
        gte: new Date(now.getTime() - RETARD_MAX_JOURS * JOUR_MS),
        lte: new Date(now.getTime() + HORIZON_JOURS * JOUR_MS),
      },
      dossiersFinancement: {
        none: { type: { in: ["opco", "mixte"] }, depotFaitLe: { not: null } },
      },
    },
    orderBy: { dateDebut: "asc" },
    take: PLAFOND_SESSIONS,
    select: {
      id: true,
      numero: true,
      dateDebut: true,
      client: { select: { opco: true, opcoIdentifie: true } },
      dossiersFinancement: {
        where: { type: { in: ["opco", "mixte"] } },
        select: { depotFaitLe: true },
      },
    },
  });
  return candidatsDepotOpcoAFaire(sessions, now);
}
