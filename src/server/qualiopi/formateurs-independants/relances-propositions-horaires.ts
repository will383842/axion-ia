/**
 * Lot C (M16) — la relance et l'expiration des propositions de mission À L'HEURE.
 *
 * Le passage quotidien (08:10 UTC) ne suffit pas quand le délai de réponse se
 * compte en heures (F23 chiffré : de 2 h à 48 h). Le passage horaire du moteur
 * des missions appelle donc le MÊME service (`relancerEtExpirerMissions`,
 * idempotent : une relance, un seul passage à `sans_reponse`), sous trois
 * conditions : interrupteur `formateurs.choix_cartes` allumé (la proposition
 * chiffrée avec son échéance), de 8 h à 19 h (Paris), base réelle.
 * Éteint : rien n'est lu, le seul passage quotidien d'avant tourne.
 *
 * Module neutre (ni `server-only`, ni Next) : le worker le charge à la demande.
 */

import {
  relancerEtExpirerMissions,
  type BilanRelances,
} from "@/server/qualiopi/trainers/mission-formateur";

import { interrupteurAllume } from "./interrupteur-allume";

const VIDE: BilanRelances = { relancees: 0, erreurs: 0, expirees: 0, sansReponse: 0 };

function heureParis(maintenant: Date): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
      .formatToParts(maintenant)
      .find((p) => p.type === "hour")?.value ?? "0",
  );
}

export async function passerRelancesPropositionsHoraires(maintenant: Date): Promise<BilanRelances> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return VIDE;
  const h = heureParis(maintenant);
  if (h < 8 || h >= 19) return VIDE;
  if (!(await interrupteurAllume("choix_cartes"))) return VIDE;
  return relancerEtExpirerMissions(maintenant);
}
