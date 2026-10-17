/**
 * 🔴 CHANTIER QNC, LOT L10 — la règle de veille EXPLOITÉE à appliquer MAINTENANT.
 *
 * Interrupteur `qualiopi.veille.actif` éteint (ou en essai : la veille n'a pas
 * de session, donc pas de banc d'essai) → `undefined` : `whereVeilleExploitee`
 * garde sa règle d'avant, au caractère près. Allumé → la liste des veilles
 * décidées par une personne et non archivées, relue au journal.
 *
 * Les deux lecteurs du prédicat (matrice de conformité, manifeste d'audit)
 * appellent cette fonction : un seul endroit dit quelle règle s'applique.
 */

import { prisma } from "@/lib/prisma";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import type { RegleVeilleTracee } from "@/server/qualiopi/conformite/veille-exploitee";
import {
  ACTIONS_CYCLE_VEILLE,
  TARGET_TYPE_VEILLE,
  idsVeillesDecidees,
  lireTraceVeille,
  type LigneJournalVeille,
  type TraceVeille,
} from "./trace-veille";

export const LOT_VEILLE = "veille" as const;

type ClientRegle = {
  setting: Pick<typeof prisma.setting, "findUnique">;
  activityLog: { findMany(args: unknown): PromiseLike<ReadonlyArray<LigneJournalVeille>> };
};

/** Le lot veille agit-il ? `essai` n'agit pas : aucune veille n'est une session de test. */
export async function veilleTraceeActive(
  client: Pick<ClientRegle, "setting"> = prisma,
): Promise<boolean> {
  return estActifPour(await lireInterrupteurQualiopi(LOT_VEILLE, client), null);
}

/** Le journal du cycle de vie des veilles (décisions, corrections, archivages). */
export async function lireJournalVeilles(
  client: Pick<ClientRegle, "activityLog"> = prisma as never,
  veilleIds?: ReadonlyArray<string>,
): Promise<TraceVeille> {
  const lignes = await client.activityLog.findMany({
    where: {
      action: { in: [...ACTIONS_CYCLE_VEILLE] },
      targetType: TARGET_TYPE_VEILLE,
      ...(veilleIds !== undefined ? { targetId: { in: [...veilleIds] } } : {}),
    },
    select: { action: true, targetId: true, adminUserId: true, changes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return lireTraceVeille(lignes);
}

/**
 * La règle à passer à `whereVeilleExploitee`. Une lecture du journal en échec,
 * interrupteur allumé, rend une règle VIDE (aucune veille ne couvre) : un voyant
 * qui ne sait pas ne verdit pas.
 */
export async function regleVeilleEnVigueur(
  client: ClientRegle = prisma as never,
): Promise<RegleVeilleTracee | undefined> {
  if (!(await veilleTraceeActive(client))) return undefined;
  try {
    return { idsDecidees: idsVeillesDecidees(await lireJournalVeilles(client)) };
  } catch {
    return { idsDecidees: [] };
  }
}
