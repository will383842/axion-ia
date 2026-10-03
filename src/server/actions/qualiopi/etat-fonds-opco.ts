/**
 * Qualiopi — Server Action état des fonds OPCO (lot OPCO A5).
 *
 * ajouterReleveEtatFondsAction : AJOUTE un relevé (suspension, réduction, date
 *   limite de dépôt). Source https obligatoire. Aucune action de modification ni
 *   de suppression : un relevé se corrige par un relevé plus récent, qui fait foi.
 */

"use server";

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { releveEtatFondsSchema } from "@/server/qualiopi/financements/etat-fonds-opco";
import { ajouterReleveEtatFonds } from "@/server/qualiopi/financements/etat-fonds-opco-lecture";

type ActionResult<T> = { data: T } | { error: string };

/** « AAAA-MM-JJ » → minuit UTC, la forme d'une colonne `@db.Date`. */
function jour(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function ajouterReleveEtatFondsAction(input: {
  opco: string;
  idcc?: string | null;
  statut: string;
  perimetre?: string | null;
  dateLimiteDepot?: string | null;
  sourceUrl: string;
  releveLe: string;
  note?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = releveEtatFondsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  let created: { id: string };
  try {
    created = await ajouterReleveEtatFonds({
      opco: v.opco,
      idcc: v.idcc ?? null,
      statut: v.statut,
      perimetre: v.perimetre || null,
      dateLimiteDepot: v.dateLimiteDepot ? jour(v.dateLimiteDepot) : null,
      sourceUrl: v.sourceUrl,
      releveLe: jour(v.releveLe),
      note: v.note || null,
      createdById: session.userId,
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du relevé" };
  }

  await logQualiopiActivity({
    action: "qualiopi.etat_fonds_opco.ajout",
    targetType: "EtatFondsOpco",
    targetId: created.id,
    changes: { opco: v.opco, idcc: v.idcc ?? null, statut: v.statut, releveLe: v.releveLe },
    session,
  });

  return { data: { id: created.id } };
}
