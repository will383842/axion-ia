/**
 * Avant la purge des 36 mois de `calendly_events` : FIGER ce que la rencontre
 * du dossier client doit garder (chantier visio, PR 4 ; principe PA-3).
 *
 * La rencontre ne dépend pas de `calendly_events` (lien `SetNull`) : elle
 * garde sa copie du titre et des dates, et son suivi vit dans
 * `rencontre_suivis`. Mais son STATUT, tant que Calendly vit, est celui de
 * Calendly (colonne nulle, CHECK `rencontres_statut_fige_calendly`) : la
 * purge l'effacerait avec la ligne. On le recopie donc, avec l'issue du point
 * fait après l'appel, et on coupe le lien — dans la MÊME transaction que la
 * suppression (le CHECK exige les deux ensemble). Garde :
 * `src/server/queue/workers/__tests__/la-purge-des-36-mois-fige-le-statut-avant-de-supprimer.spec.ts`.
 *
 * Module neutre (le worker de conservation l'appelle).
 */

import type {
  CalendlyEventStatus,
  Prisma,
  RencontreStatut,
  RendezVousIssue,
} from "../../../prisma/generated/client";
import type { Tx } from "@/features/dossier-client/base";

const PAR_ISSUE: Readonly<Record<RendezVousIssue, RencontreStatut>> = {
  eu_lieu: "tenu",
  absent: "absent",
  reporte: "reporte",
};

const PAR_STATUT_CALENDLY: Readonly<Record<CalendlyEventStatus, RencontreStatut | null>> = {
  scheduled: null,
  canceled: "annule",
  completed: "tenu",
  no_show: "absent",
};

/** Le statut figé d'une rencontre : l'issue du point d'abord, sinon Calendly. PUR. */
export function statutFige(
  issue: RendezVousIssue | null,
  statutCalendly: CalendlyEventStatus,
): RencontreStatut | null {
  if (issue !== null) return PAR_ISSUE[issue];
  return PAR_STATUT_CALENDLY[statutCalendly];
}

/**
 * Fige les rencontres des rendez-vous Calendly que `where` va supprimer. À
 * appeler DANS la transaction de la suppression, JUSTE AVANT.
 */
export async function figerRencontresAvantPurge(
  tx: Tx,
  where: Prisma.CalendlyEventWhereInput,
): Promise<number> {
  const evs = await tx.calendlyEvent.findMany({ where, select: { id: true, status: true } });
  if (evs.length === 0) return 0;
  const ids = evs.map((e) => e.id);
  const rencontres = await tx.rencontre.findMany({
    where: { calendlyEventId: { in: ids } },
    select: { id: true, calendlyEventId: true },
  });
  if (rencontres.length === 0) return 0;
  const suivis = await tx.rendezVousSuivi.findMany({
    where: { calendlyEventId: { in: ids } },
    select: { calendlyEventId: true, issue: true },
  });
  const issue = new Map(suivis.map((s) => [s.calendlyEventId, s.issue]));
  const statut = new Map(evs.map((e) => [e.id, e.status]));
  for (const r of rencontres) {
    const evId = r.calendlyEventId as string;
    const i = issue.get(evId) ?? null;
    await tx.rencontre.update({
      where: { id: r.id },
      data: {
        calendlyEventId: null,
        statut: statutFige(i, statut.get(evId) ?? "scheduled"),
        issueFigee: i,
      },
    });
  }
  return rencontres.length;
}
