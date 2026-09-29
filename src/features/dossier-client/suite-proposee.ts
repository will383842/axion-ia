/**
 * La SUITE proposée sur l'écran « Après l'appel » (chantier visio, PR 4 ;
 * décision B11 prise sur recommandation : relance par défaut).
 *
 * Quand rien n'est convenu, l'écran propose « Relance » dans
 * `RELANCE_PAR_DEFAUT_JOURS_OUVRES` jours ouvrés (samedi et dimanche sautés) :
 * une suite sans date ne se fait jamais. Will la change d'un clic.
 *
 * Le jour se compte à l'heure de PARIS : un appel fini à 23 h 30 le vendredi
 * (21 h 30 UTC) est un appel du vendredi. Module PUR.
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import { RELANCE_PAR_DEFAUT_JOURS_OUVRES } from "./seuils";

/** « AAAA-MM-JJ » : `n` jours ouvrés après le jour de Paris de `depuis`. */
export function jourOuvreApres(depuis: Date, n: number): string {
  const [a, m, j] = dayKeyInParis(depuis).split("-").map(Number);
  const d = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, j ?? 1));
  let restants = n;
  while (restants > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const jour = d.getUTCDay();
    if (jour !== 0 && jour !== 6) restants -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** La suite proposée par défaut. */
export function suiteParDefaut(maintenant: Date): { suite: "relance"; suiteLe: string } {
  return { suite: "relance", suiteLe: jourOuvreApres(maintenant, RELANCE_PAR_DEFAUT_JOURS_OUVRES) };
}
