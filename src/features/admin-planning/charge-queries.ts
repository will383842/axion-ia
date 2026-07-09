// Planning unifié — vue « charge formateur », couche de lecture (read-only,
// appelée depuis le RSC de la page).
//
// On réutilise `getPlanningMonth` (aucune requête neuve) : elle renvoie déjà les
// prestations du mois, étalées par jour et fenêtrées côté DB. On regroupe ensuite
// ces événements PAR FORMATEUR, puis on délègue tout le calcul à la logique pure
// `construireCharge`.
//
// Point d'attention : `getPlanningMonth` renvoie une Map<jour, events[]> où une
// prestation multi-jours apparaît sous CHACUN de ses jours. Avant de la passer à
// `joursMobilises` (qui ré-étale les jours), on DÉDUPLIQUE les événements par
// `key` au sein de chaque formateur, sinon on ne fausserait rien (le Set de jours
// absorbe les doublons) mais on gaspillerait du travail.
//
// Build-safety (ADR 0026) : `getPlanningMonth` est déjà stub-safe (Map vide au
// build) → `getChargeMois` renvoie simplement des formateurs à 0 %.

import { getPlanningMonth } from "./queries";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { construireCharge, type ChargeFormateur, type FormateurRef } from "./charge";
import type { PlanningEvent } from "./types";

/**
 * Regroupe les événements d'un mois par id de formateur, en dédupliquant les
 * prestations multi-jours (une même `key` n'est conservée qu'une fois par
 * formateur). Les événements sans formateur assigné (`formateurId` null) sont
 * ignorés : ils n'entrent dans la charge d'aucun formateur.
 */
export function regrouperParFormateur(
  byDay: Map<string, PlanningEvent[]>,
): Map<string, PlanningEvent[]> {
  // Map<formateurId, Map<eventKey, event>> pour dédupliquer par key.
  const dedup = new Map<string, Map<string, PlanningEvent>>();

  for (const events of byDay.values()) {
    for (const e of events) {
      const fid = e.formateurId ?? null;
      if (fid === null) continue;
      let parKey = dedup.get(fid);
      if (parKey === undefined) {
        parKey = new Map<string, PlanningEvent>();
        dedup.set(fid, parKey);
      }
      if (!parKey.has(e.key)) parKey.set(e.key, e);
    }
  }

  const result = new Map<string, PlanningEvent[]>();
  for (const [fid, parKey] of dedup) result.set(fid, [...parKey.values()]);
  return result;
}

/**
 * Charge de tous les formateurs actifs pour le mois `year`/`month`.
 *
 * @param capaciteJours Nombre de jours ouvrables cible du mois (capacité de
 *   référence pour le taux d'occupation) — fourni par l'appelant, car il dépend
 *   du calendrier (jours ouvrés, congés…) et non de la logique planning.
 *
 * Renvoie la liste triée par taux décroissant (cf. `construireCharge`), avec un
 * formateur par ligne — y compris ceux à 0 jour (sous-charge visible).
 */
export async function getChargeMois(
  year: number,
  month: number,
  capaciteJours: number,
): Promise<ChargeFormateur[]> {
  // Sans filtre : la charge doit refléter TOUTES les prestations du mois.
  const [byDay, trainers] = await Promise.all([
    getPlanningMonth(year, month),
    listTrainers({ actifOnly: true }),
  ]);

  const parFormateur = regrouperParFormateur(byDay);
  const formateurs: FormateurRef[] = trainers.map((t) => ({
    id: t.id,
    prenom: t.prenom,
    nom: t.nom,
  }));

  // Borne le comptage aux jours DU mois affiche : une prestation a cheval sur
  // deux mois ne doit pas gonfler la charge du mois courant avec ses jours de
  // l'autre mois.
  const prefixMois = `${year}-${String(month).padStart(2, "0")}`;
  return construireCharge(parFormateur, formateurs, capaciteJours, (dayKey) =>
    dayKey.startsWith(prefixMois),
  );
}
