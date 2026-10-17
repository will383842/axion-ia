/**
 * 🔴 CHANTIER QNC, LOT L10 — ce qu'off.32 lit, selon l'interrupteur.
 *
 * Interrupteur `qualiopi.amelioration.actif` éteint (ou en essai) : la revue est
 * rendue TELLE QUELLE, sans option — `evaluerCouvertureOff32` juge exactement
 * comme avant. Allumé : le plan d'actions évalué est l'historique de
 * `planActions` (relu par `normaliserActionAmelioration`, jamais réécrit) PLUS
 * les actions AXI-AMC ouvertes dans l'année de la revue (heure de Paris).
 *
 * Les trois lecteurs d'off.32 (matrice, manifeste d'audit, garde de validation)
 * passent par ici : le prédicat reste unique, sa source aussi.
 */

import { prisma } from "@/lib/prisma";
import {
  evaluerCouvertureOff32,
  normaliserPlanActions,
  type CouvertureOff32,
  type OptionsCouvertureOff32,
  type RevueAnnuelleLue,
} from "@/server/qualiopi/revues/plan-actions";
import { derniereEtapeDEtat, versActionPlan, type ActionAmcLue } from "./etapes-amc";
import { listerActionsAmelioration, registreAmeliorationActif } from "./registre-amc";

/** Pure : la revue et les options d'off.32, une fois le registre versé au plan. */
export function revueAvecRegistre(
  revue: RevueAnnuelleLue,
  actions: ReadonlyArray<ActionAmcLue>,
): { revue: RevueAnnuelleLue; registreAmc: NonNullable<OptionsCouvertureOff32["registreAmc"]> } {
  return {
    revue: {
      ...revue,
      planActions: [...normaliserPlanActions(revue.planActions), ...actions.map(versActionPlan)],
    },
    registreAmc: {
      sansAuteurHumain: actions.filter((a) => a.auteurId === null).length,
      realiseesSansEfficacite: actions.filter(
        (a) => derniereEtapeDEtat(a.etapes)?.etape === "realisee",
      ).length,
    },
  };
}

type Client = Parameters<typeof registreAmeliorationActif>[0] &
  Parameters<typeof listerActionsAmelioration>[0];

/** `evaluerCouvertureOff32`, avec le registre AXI-AMC quand il est allumé. */
export async function evaluerOff32EnVigueur(
  revue: RevueAnnuelleLue | null,
  maintenant: Date,
  options: OptionsCouvertureOff32 = {},
  client: Client = prisma as never,
): Promise<CouvertureOff32> {
  if (revue === null || !(await registreAmeliorationActif(client))) {
    return evaluerCouvertureOff32(revue, maintenant, options);
  }
  let actions: ActionAmcLue[];
  try {
    actions = await listerActionsAmelioration(client, { annee: revue.annee });
  } catch {
    // Registre allumé mais illisible : on ne retombe PAS sur l'ancien plan seul,
    // qui verdirait sur une source qui n'est plus la bonne. Un voyant qui ne
    // sait pas ne verdit pas.
    const base = evaluerCouvertureOff32(revue, maintenant, options);
    const manque =
      "Registre des actions d'amélioration (AXI-AMC) illisible — le plan d'actions ne peut pas être établi";
    return {
      ...base,
      couvert: false,
      preuves: [...base.preuves, manque],
      manques: [...base.manques, manque],
    };
  }
  const lu = revueAvecRegistre(revue, actions);
  return evaluerCouvertureOff32(lu.revue, maintenant, { ...options, registreAmc: lu.registreAmc });
}
