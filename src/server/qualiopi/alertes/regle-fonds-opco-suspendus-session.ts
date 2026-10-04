/**
 * Alerte `fonds_opco_suspendus_session` (lot OPCO A7c — manque n°8 de la
 * critique de complétude).
 *
 * L'état des fonds n'était qu'un bandeau (fiche client, devis) : aucune règle ne
 * prévenait qu'une session planifiée avait un client dont l'OPCO, la branche ou
 * la tranche d'effectif était SUSPENDU. La règle lit la MÊME résolution que le
 * bandeau (`etatFondsPour` : la branche l'emporte sur l'OPCO entier, une
 * suspension « moins de 50 salariés » ne vaut pas au-delà) et lève, à J-60 :
 *
 *   · `critique` si les fonds sont suspendus pour l'entreprise ;
 *   · `important` si la session commence, dans l'année de la date limite
 *     d'engagement de l'OPCO, APRÈS cette date, sans dépôt saisi à temps. La date
 *     limite est celle du relevé d'état des fonds ; à défaut, celle du
 *     référentiel pour l'exercice 2026 (`dateLimiteDepot2026`).
 *
 * Elle se referme quand un relevé plus récent rouvre les fonds, quand le dépôt
 * est saisi à temps, ou quand la session n'est plus planifiée.
 *
 * Les relevés sont lus en UNE requête pour les seuls OPCO concernés, et la
 * lecture LÈVE sur panne (une lecture vide refermerait les alertes ouvertes).
 */

import { prisma } from "@/lib/prisma";
import type { Opco } from "../../../../prisma/generated/client";
import {
  etatFondsPour,
  formatJourDate,
  type ReleveEtatFonds,
} from "@/server/qualiopi/financements/etat-fonds-opco";
import {
  OPCO_FICHES,
  opcoDuClient,
  opcoLabel,
  type OpcoId,
} from "@/server/qualiopi/financements/opco-referentiel";
import type { AlerteCandidate } from "./evaluateur";
import { sessionsOpcoAVenir, type SessionOpcoAVenir } from "./sessions-opco-a-venir";

export const HORIZON_FONDS_SUSPENDUS_JOURS = 60;

/** Jour civil de Paris, AAAA-MM-JJ, d'un instant. */
function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Jour d'une colonne `@db.Date` (minuit UTC) : sa partie ISO. */
function jourDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function jjmmaaaa(jour: string): string {
  return jour.split("-").reverse().join("/");
}

/** Date limite d'engagement (AAAA-MM-JJ) : relevé d'abord, référentiel 2026 ensuite. */
function dateLimiteEngagement(opco: OpcoId, releve: Date | null): string | null {
  if (releve) return jourDate(releve);
  return OPCO_FICHES[opco].dateLimiteDepot2026.valeur;
}

/** Décision PURE, sur les sessions et les relevés déjà lus. */
export function candidatsFondsOpcoSuspendusSession(
  sessions: SessionOpcoAVenir[],
  releves: readonly ReleveEtatFonds[],
  now: Date,
): AlerteCandidate[] {
  const alertes: AlerteCandidate[] = [];
  for (const s of sessions) {
    const client = s.client;
    if (!client || client.type === "particulier") continue;
    // Règle unique (lot A7a). Sans OPCO reconnu : `donnees_opco_incompletes`.
    const opco = opcoDuClient(client);
    if (opco === null) continue;
    const etat = etatFondsPour({
      opco,
      idcc: client.idcc,
      effectif: client.effectif,
      aLaDate: now,
      releves,
    });
    const debut = jourParis(s.dateDebut);
    // Relecture A7c : une suspension ou une date limite visent les NOUVELLES
    // demandes ; un accord déjà obtenu n'est pas remis en cause.
    if (s.dossiersFinancement.some((d) => d.accordAt != null || d.accordEcritLe != null)) continue;

    if (etat?.statut === "suspendu") {
      alertes.push({
        code: "fonds_opco_suspendus_session",
        niveau: "critique",
        titre: "Session planifiée sur des fonds OPCO suspendus",
        message: `La session ${s.numero} (début le ${jjmmaaaa(debut)}) est financée par ${opcoLabel(opco)}, dont le financement est suspendu pour la branche ou la taille de l'entreprise (relevé du ${formatJourDate(etat.releveLe)}). Prévenez l'entreprise, vérifiez sur le site de l'OPCO, puis reportez la session ou changez son financement.`,
        cibleType: "TrainingSession",
        cibleId: s.id,
      });
      continue;
    }

    const limite = dateLimiteEngagement(opco, etat?.dateLimiteDepot ?? null);
    if (limite === null) continue;
    // Même exercice seulement : un début l'année suivante relève des fonds suivants.
    if (debut.slice(0, 4) !== limite.slice(0, 4) || debut <= limite) continue;
    const deposeATemps = s.dossiersFinancement.some(
      (d) => d.depotFaitLe !== null && jourDate(d.depotFaitLe) <= limite,
    );
    if (deposeATemps) continue;
    alertes.push({
      code: "fonds_opco_suspendus_session",
      niveau: "important",
      titre: "Session après la date limite d'engagement de l'OPCO",
      message: `La session ${s.numero} commence le ${jjmmaaaa(debut)}, après la date limite d'engagement de ${opcoLabel(opco)} pour l'exercice (${jjmmaaaa(limite)}), et aucun dépôt n'est saisi avant cette date : l'OPCO peut refuser la prise en charge. Vérifiez auprès de l'entreprise et de l'OPCO, puis saisissez la date de dépôt sur le dossier de financement.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }
  return alertes;
}

export async function regleFondsOpcoSuspendusSession(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await sessionsOpcoAVenir(now, HORIZON_FONDS_SUSPENDUS_JOURS);
  const opcos = [
    ...new Set(
      sessions
        .filter((s) => s.client && s.client.type !== "particulier")
        .map((s) => opcoDuClient(s.client))
        .filter((o): o is OpcoId => o !== null),
    ),
  ].sort();
  if (opcos.length === 0) return [];
  const releves = await prisma.etatFondsOpco.findMany({
    where: { opco: { in: opcos as Opco[] } },
    orderBy: [{ releveLe: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return candidatsFondsOpcoSuspendusSession(sessions, releves, now);
}
