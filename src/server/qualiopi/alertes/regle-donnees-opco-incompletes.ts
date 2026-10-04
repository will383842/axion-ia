/**
 * Alerte `donnees_opco_incompletes` (lot OPCO A7c — manques n°3 et n°8 de la
 * critique de complétude).
 *
 * Le régime de paiement, le barème, l'état des fonds et la date limite de dépôt
 * se lisent tous sur trois données de la fiche client : l'OPCO, l'IDCC et
 * l'effectif. Qu'une seule manque, et chacune de ces briques répond « inconnu »
 * en silence. La règle lève UNE alerte par client entreprise qui a au moins une
 * session à venir financée par un OPCO, et dit ce qui manque.
 *
 *   · OPCO reconnu : lu par la règle unique `opcoDuClient` — l'ancien texte
 *     libre reconnu suffit ; un texte libre non reconnu est cité tel quel ;
 *   · IDCC : absent ou illisible (`normaliserIdcc`) ;
 *   · effectif : non renseigné.
 *
 * Un client particulier n'est jamais concerné. L'alerte mène à la fiche client
 * et se referme dès que la fiche est complète.
 */

import { normaliserIdcc } from "@/server/qualiopi/financements/etat-fonds-opco";
import {
  opcoDuClient,
  referenceOpcoDuClient,
} from "@/server/qualiopi/financements/opco-referentiel";
import type { AlerteCandidate } from "./evaluateur";
import { sessionsOpcoAVenir, type SessionOpcoAVenir } from "./sessions-opco-a-venir";

export const HORIZON_DONNEES_OPCO_JOURS = 365;
/** Au-delà, le message cite les premières et compte les autres. */
const SESSIONS_CITEES = 3;

function listeFr(morceaux: string[]): string {
  if (morceaux.length <= 1) return morceaux.join("");
  return `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}`;
}

/** Décision PURE : une candidate par client incomplet. */
export function candidatsDonneesOpcoIncompletes(sessions: SessionOpcoAVenir[]): AlerteCandidate[] {
  const parClient = new Map<string, { manques: string[]; numeros: string[] }>();
  for (const s of sessions) {
    const client = s.client;
    if (!client || client.type === "particulier") continue;
    const deja = parClient.get(client.id);
    if (deja) {
      deja.numeros.push(s.numero);
      continue;
    }
    const manques: string[] = [];
    if (opcoDuClient(client) === null) {
      const libre = referenceOpcoDuClient(client);
      manques.push(
        libre ? `OPCO reconnu (« ${libre} » n'est pas l'un des 11 OPCO)` : "OPCO reconnu",
      );
    }
    if (normaliserIdcc(client.idcc) === null) manques.push("IDCC");
    if (client.effectif === null) manques.push("effectif");
    if (manques.length === 0) continue;
    parClient.set(client.id, { manques, numeros: [s.numero] });
  }

  return [...parClient.entries()].map(([clientId, { manques, numeros }]) => {
    const cites = numeros.slice(0, SESSIONS_CITEES).join(", ");
    const autres = numeros.length - SESSIONS_CITEES;
    const sessionsTexte =
      numeros.length === 1
        ? `la session ${cites}`
        : `${numeros.length} sessions (${cites}${autres > 0 ? ` et ${autres} autre${autres > 1 ? "s" : ""}` : ""})`;
    return {
      code: "donnees_opco_incompletes",
      niveau: "important",
      titre: "Données OPCO du client incomplètes",
      message: `La fiche de ce client, financé par un OPCO pour ${sessionsTexte} à venir, n'indique pas : ${listeFr(manques)}. Sans ces données, le régime de paiement, le barème, l'état des fonds et la date limite de dépôt restent inconnus. Complétez la fiche client.`,
      cibleType: "Client",
      cibleId: clientId,
    };
  });
}

export async function regleDonneesOpcoIncompletes(now: Date): Promise<AlerteCandidate[]> {
  return candidatsDonneesOpcoIncompletes(await sessionsOpcoAVenir(now, HORIZON_DONNEES_OPCO_JOURS));
}
