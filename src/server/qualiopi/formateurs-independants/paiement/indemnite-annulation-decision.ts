/**
 * Formateurs indépendants — l'indemnité d'annulation d'une mission, telle que
 * l'administrateur la DÉCIDE (lot D, M11 ; art. 11, plan 08 §2.7 n° 4). Pur.
 *
 * Ce module ne calcule AUCUN montant : il dit quelles demi-journées PRÉVUES
 * (`demiJourneesPrevues`, découpage du paiement par mission) sont annulées —
 * celles qui n'avaient pas commencé à l'instant de l'annulation — et quand
 * commence la première, puis s'en remet aux seules sources d'argent :
 * `indemniteAnnulation` (50 % hors forfait, sous 72 h, mission acceptée,
 * annulation par Axion) et `totaliser` (TVA au régime figé de la mission).
 *
 * Début d'une demi-journée : le matin à l'heure de début de la journée ;
 * l'après-midi à l'heure de début si la journée ne commence qu'à l'après-midi,
 * sinon à `milieuDeJournee`.
 */

import type { JourneePrevue } from "@/server/qualiopi/remuneration/heures-animees";
import { demiJourneesPrevues } from "@/server/qualiopi/remuneration/heures-animees";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

import {
  indemniteAnnulation,
  totaliser,
  type IndemniteCalculee,
  type TotauxReleve,
} from "../argent/calcul-mission";
import { instantParis } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";

export interface FaitsAnnulationMission {
  /** Instant où Axion a annulé (saisi par l'administrateur). */
  readonly annuleeA: Date;
  readonly journeesPrevues: ReadonlyArray<JourneePrevue>;
  /** Tarif figé de la mission (`MissionFormateur.tarifHtCents`). */
  readonly tarifJourneeHtCents: number;
  readonly accepteeAvant: boolean;
  readonly parAxion: boolean;
  /** Régime figé de la mission (`regimeTvaFige`) : jamais d'exonération inventée. */
  readonly regimeTva: TvaRegimeHonoraires;
}

export interface ApercuIndemnite {
  readonly demiJourneesAnnulees: number;
  readonly debutPremiereAnnulee: Date | null;
  readonly indemnite: IndemniteCalculee;
  readonly totaux: TotauxReleve;
}

export function apercuIndemniteAnnulation(
  f: FaitsAnnulationMission,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): ApercuIndemnite {
  const parJour = new Map(f.journeesPrevues.map((j) => [j.jour, j] as const));
  const debuts = demiJourneesPrevues(f.journeesPrevues, p)
    .map((d) => {
      const j = parJour.get(d.jour)!;
      const heure =
        d.creneau === "matin" || j.heureDebut >= p.milieuDeJournee
          ? j.heureDebut
          : p.milieuDeJournee;
      return instantParis(d.jour, heure.padStart(5, "0"));
    })
    .filter((debut) => debut.getTime() > f.annuleeA.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const premiere = debuts[0] ?? null;
  const indemnite = indemniteAnnulation(
    {
      annuleeA: f.annuleeA,
      // Aucune demi-journée annulée : l'instant d'annulation (rien n'est dû).
      debutPremiereAnnulee: premiere ?? f.annuleeA,
      demiJourneesAnnulees: debuts.length,
      tarifJourneeHtCents: f.tarifJourneeHtCents,
      accepteeAvant: f.accepteeAvant,
      parAxion: f.parAxion,
    },
    p,
  );
  return {
    demiJourneesAnnulees: debuts.length,
    debutPremiereAnnulee: premiere,
    indemnite,
    totaux: totaliser([{ montantHtCents: indemnite.montantHtCents }], f.regimeTva),
  };
}
