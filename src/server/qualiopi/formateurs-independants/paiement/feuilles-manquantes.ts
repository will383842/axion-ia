/**
 * Formateurs indépendants — LES FEUILLES DE PRÉSENCE MANQUANTES (lot D2, M8,
 * partie sans pièce juridique nouvelle), pur.
 *
 * Lit les demi-journées PRÉVUES de la mission (pas celles qu'un stagiaire a
 * signées) et dit, mois par mois, lesquelles n'ont pas la contresignature du
 * formateur. Les trois délais existants (`argent/parametres.ts`) sont lus ici :
 *   - `feuillesRelanceJours` (J+3) : la 4e marche, F35, une fois ;
 *   - `feuillesAlerteJours` (J+10) : alerte interne ;
 *   - `feuillesSurConstatJours` (J+20) : alerte interne « décision humaine ».
 *     « Payer sur constat » n'est PAS livré (reporté, à concevoir à part) : ce
 *     délai ne paie rien, il prévient.
 *
 * Aucune signature n'est apposée ni validée ici : la contresignature reste le
 * geste du formateur ; la feuille papier n'est pas validée par ce lot.
 */

import {
  demiJourneesPrevues,
  demiJourneesSansSignature,
  demiJourneesSignees,
  parMoisCivil,
  type DemiJourneeDatee,
} from "@/server/qualiopi/remuneration/heures-animees";

import { joursEntre, type JourCivil } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";
import type { CandidatMission } from "./passage-mission";

export interface FeuillesDuMois {
  readonly trainerId: string;
  readonly sessionId: string;
  /** « AAAA-MM ». */
  readonly mois: string;
  readonly derniereJournee: JourCivil;
  readonly manquantes: ReadonlyArray<DemiJourneeDatee>;
}

export type EtapeFeuilles = "relance" | "alerte" | "sur_constat";

/** Les mois PASSÉS d'une mission dont une demi-journée prévue n'est pas contresignée. */
export function feuillesManquantes(
  candidats: ReadonlyArray<CandidatMission>,
  aujourdhui: JourCivil,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): FeuillesDuMois[] {
  const bornes = {
    matinAvant: p.matinAvant,
    apresMidiApres: p.apresMidiApres,
    milieuDeJournee: p.milieuDeJournee,
  };
  const out: FeuillesDuMois[] = [];
  for (const c of candidats) {
    const signees = demiJourneesSignees(c.contresignatures);
    for (const m of parMoisCivil(demiJourneesPrevues(c.journeesPrevues, bornes))) {
      if (m.derniereJournee >= aujourdhui) continue;
      const manquantes = demiJourneesSansSignature(m.detail, signees);
      if (manquantes.length === 0) continue;
      out.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        mois: m.mois,
        derniereJournee: m.derniereJournee,
        manquantes,
      });
    }
  }
  return out;
}

/**
 * Ce qui est dû AUJOURD'HUI pour un mois incomplet. La relance F35 est due dès
 * J+3 ; les deux alertes internes, dès J+10 et dès J+20. L'appelant garde
 * chacune unique par sa clé (journal des envois, journal d'activité).
 *
 * 🔴 Lot 8B — les deux alertes se déclenchaient par égalité (`j === 10`) : un
 * passage manqué ce jour-là (panne, redémarrage) et l'alerte ne partait jamais.
 */
export function etapesFeuilles(
  derniereJournee: JourCivil,
  aujourdhui: JourCivil,
  p: Pick<
    ParametresArgentFormateurs,
    "feuillesRelanceJours" | "feuillesAlerteJours" | "feuillesSurConstatJours"
  > = PARAMETRES_ARGENT_FORMATEURS,
): EtapeFeuilles[] {
  const j = joursEntre(derniereJournee, aujourdhui);
  const out: EtapeFeuilles[] = [];
  if (j >= p.feuillesRelanceJours) out.push("relance");
  if (j >= p.feuillesAlerteJours) out.push("alerte");
  if (j >= p.feuillesSurConstatJours) out.push("sur_constat");
  return out;
}
