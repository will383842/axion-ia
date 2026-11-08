"use server";

/**
 * Devis CLASSIQUE (lignes libres) — modification d'un BROUILLON (chantier assistant, fiche S09).
 *
 * Mêmes calculs que `createDevisAction` (module `champs-classiques`) : à entrée égale, mêmes
 * champs en création et en modification, estimation OPCO et mention TVA comprises.
 *
 * Garde-fous :
 *   - `requireAdminWrite` d'abord ;
 *   - total à 0 € refusé ;
 *   - refus si le devis porte une offre à formules (`offreSha256` non nul), s'il n'est plus
 *     `brouillon`, si le client change, ou si `updatedAt` n'est plus celui que l'onglet a lu ;
 *   - l'écriture est un `updateMany` CONDITIONNEL sur ces trois critères (course entre onglets) ;
 *   - n'écrit JAMAIS `statut` (cliquet des écrivains) ; aucun delete ; aucun e-mail ;
 *   - le lien au projet (`projetId`) n'est posé qu'à la création : il est ignoré ici.
 *
 * Montants en centimes. Le champ retiré de la saisie (OPCO, activité, référence) est remis à null.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  entreeDevisClassiqueSchema,
  estimationOpcoDevis,
  mentionTvaDevisClassique,
  totalHtClassiqueCents,
} from "@/server/qualiopi/devis/champs-classiques";

type ActionResult<T> = { data: T } | { error: string };

const MSG_PERIME = "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.";

const modifierSchema = z.object({
  id: z.string().uuid(),
  /** Valeur `updatedAt` (ISO) lue au chargement : la version que l'on croit modifier. */
  attenduMajLe: z.string().datetime(),
  input: entreeDevisClassiqueSchema,
});

export async function modifierDevisClassiqueBrouillonAction(
  i: z.input<typeof modifierSchema>,
): Promise<ActionResult<{ id: string; majLe: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const p = modifierSchema.safeParse(i);
  if (!p.success) return { error: "Données invalides" };
  const { id, input: v } = p.data;
  const attendu = new Date(p.data.attenduMajLe);

  const montantTotalHtCents = totalHtClassiqueCents(v.lignes);
  if (montantTotalHtCents <= 0) {
    return { error: "Le total du devis ne peut pas être de 0 €." };
  }

  const actuel = await prisma.devis.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      statut: true,
      offreSha256: true,
      updatedAt: true,
      dateValidite: true,
    },
  });
  if (!actuel) return { error: "Devis introuvable" };
  if (actuel.offreSha256 !== null) {
    return { error: "Ce devis est à formules : il se modifie depuis l'éditeur de formules." };
  }
  if (actuel.statut !== "brouillon") {
    return { error: "Un devis envoyé ne se modifie pas : créez une révision (nouvelle version)." };
  }
  if (actuel.clientId !== v.clientId) {
    return { error: "Le client d'un devis ne se change pas : créez un nouveau devis." };
  }
  if (actuel.updatedAt.getTime() !== attendu.getTime()) return { error: MSG_PERIME };

  const opco = await estimationOpcoDevis(v, montantTotalHtCents, actuel.dateValidite);
  const mentionTva = await mentionTvaDevisClassique();

  const { count } = await prisma.devis.updateMany({
    where: { id, statut: "brouillon", offreSha256: null, updatedAt: attendu },
    data: {
      lignes: v.lignes as never,
      montantTotalHtCents,
      mentionTva,
      activite: v.activite ?? null,
      refClient: v.refClient ?? null,
      financementSuggere: v.financementSuggere ?? null,
      montantOpcoEstimeCents: opco.montantOpcoEstimeCents ?? null,
      opcoEstimationOrigine: opco.opcoEstimationOrigine ?? null,
      opcoEstimationAvertissement: opco.opcoEstimationAvertissement ?? null,
      resteAChargeCents: opco.resteAChargeCents ?? null,
    },
  });
  if (count === 0) return { error: MSG_PERIME };

  const apres = await prisma.devis.findUnique({ where: { id }, select: { updatedAt: true } });

  await logQualiopiActivity({
    action: "qualiopi.devis.modifier_brouillon_classique",
    targetType: "Devis",
    targetId: id,
    changes: { montantTotalHtCents, financementSuggere: v.financementSuggere },
    session,
  });

  return { data: { id, majLe: (apres?.updatedAt ?? new Date()).toISOString() } };
}
