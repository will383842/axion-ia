/**
 * Alerte `etat_fonds_perime` — veille mensuelle de l'état des fonds OPCO.
 *
 * Lot OPCO A5 : levée quand le relevé le plus récent (tous OPCO confondus) a
 * plus de 31 jours, ciblée sur ce relevé.
 *
 * 🔴 Lot A7c (manque n°8 de la critique de complétude) : « sans aucun relevé,
 * rien » laissait la veille muette pour toujours si personne n'avait jamais
 * saisi de relevé. Elle se lève désormais AUSSI quand un OPCO qui a au moins une
 * session à venir n'a AUCUN relevé. Cette seconde alerte n'a pas de cible (un
 * OPCO n'a pas d'identifiant en base) : UNE alerte, qui nomme les OPCO
 * concernés, et se referme dès que chacun a son premier relevé.
 *
 * La recherche des OPCO sans relevé LÈVE sur panne : une lecture vide
 * refermerait l'alerte ouverte. Aucune donnée personnelle dans le texte.
 */

import { prisma } from "@/lib/prisma";
import type { AlerteNiveau, Opco } from "../../../../prisma/generated/client";
import {
  estEtatFondsPerime,
  formatJourDate,
  VEILLE_ETAT_FONDS_JOURS,
} from "@/server/qualiopi/financements/etat-fonds-opco";
import { dernierReleveEtatFonds } from "@/server/qualiopi/financements/etat-fonds-opco-lecture";
import {
  opcoDuClient,
  opcoLabel,
  type OpcoId,
} from "@/server/qualiopi/financements/opco-referentiel";
import type { AlerteCandidate } from "./evaluateur";
import { sessionsOpcoAVenir } from "./sessions-opco-a-venir";

/** Une session à venir dans l'année suffit à exiger un relevé pour son OPCO. */
export const HORIZON_VEILLE_JOURS = 365;

const TITRE = "État des fonds OPCO à relever (veille mensuelle)";

/** Décision PURE. */
export function candidatsEtatFondsPerime(
  lu: { dernier: { id: string; releveLe: Date } | null; opcosSansReleve: readonly string[] },
  now: Date,
): AlerteCandidate[] {
  const alertes: AlerteCandidate[] = [];
  const { dernier } = lu;
  if (dernier && estEtatFondsPerime(dernier.releveLe, now)) {
    alertes.push({
      code: "etat_fonds_perime",
      niveau: "important" as AlerteNiveau,
      titre: TITRE,
      message: `Le dernier relevé de l'état des fonds OPCO date du ${formatJourDate(dernier.releveLe)} (plus de ${VEILLE_ETAT_FONDS_JOURS} jours). Consultez les sites des OPCO (suspensions, dates limites de dépôt) et ajoutez un relevé, même inchangé.`,
      cibleType: "EtatFondsOpco",
      cibleId: dernier.id,
    });
  }
  if (lu.opcosSansReleve.length > 0) {
    const noms = lu.opcosSansReleve
      .map((o) => opcoLabel(o))
      .sort((a, b) => a.localeCompare(b, "fr"))
      .join(", ");
    const pluriel = lu.opcosSansReleve.length > 1;
    alertes.push({
      code: "etat_fonds_perime",
      niveau: "important" as AlerteNiveau,
      titre: TITRE,
      message: `Aucun relevé de l'état des fonds n'existe pour ${pluriel ? "les OPCO" : "l'OPCO"} ${noms}, alors qu'au moins une session à venir en dépend. Consultez ${pluriel ? "leurs sites" : "son site"} (suspensions, dates limites de dépôt) et ajoutez un premier relevé sur la page État des fonds OPCO, même « ouvert ».`,
    });
  }
  return alertes;
}

export async function regleEtatFondsPerime(now: Date): Promise<AlerteCandidate[]> {
  const dernier = await dernierReleveEtatFonds();
  const sessions = await sessionsOpcoAVenir(now, HORIZON_VEILLE_JOURS);
  const opcos = [
    ...new Set(
      sessions
        .filter((s) => s.client && s.client.type !== "particulier")
        .map((s) => opcoDuClient(s.client))
        .filter((o): o is OpcoId => o !== null),
    ),
  ].sort();
  let opcosSansReleve: string[] = [];
  if (opcos.length > 0) {
    const avecReleve = await prisma.etatFondsOpco.findMany({
      where: { opco: { in: opcos as Opco[] } },
      distinct: ["opco"],
      select: { opco: true },
    });
    const presents = new Set(avecReleve.map((r) => String(r.opco)));
    opcosSansReleve = opcos.filter((o) => !presents.has(o));
  }
  return candidatsEtatFondsPerime({ dernier, opcosSansReleve }, now);
}
