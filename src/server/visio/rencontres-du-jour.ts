/**
 * Les rencontres ENREGISTRABLES du moment — la liste que l'extension Meet
 * proposera (chantier visio, PR 4 ; la route `GET /api/enregistreur/rencontres-du-jour`
 * arrive en PR 5 et REJOUE le test de cette fonction).
 *
 * Fenêtre : de 3 h avant à 12 h après maintenant. Deux sources :
 *   · les rendez-vous Calendly de la LISTE BLANCHE — leur rencontre est
 *     assurée À LA DEMANDE (le balayage peut ne pas être encore passé) ;
 *   · les rencontres SAISIES dans la console (`saisie_manuelle`) de type
 *     visio — sans elles, un client qui revient pour un deuxième rendez-vous
 *     ne serait jamais enregistrable. Garde :
 *     `une-rencontre-saisie-est-proposee-a-l-extension.spec.ts`.
 *
 * Ce que la liste rend : de quoi CHOISIR la rencontre (heure, titre, source,
 * fiche rangée ou proposée). Aucune lecture du dossier (faits, comptes rendus).
 *
 * Module neutre.
 */

import type { MotifProposition, RencontreSource } from "../../../prisma/generated/client";
import { assurerRencontrePourCalendly } from "@/features/dossier-client/rencontre-calendly";
import type { BaseBalayage } from "./balayage";
import { estRendezVousDuDossier } from "./liste-blanche-types";

export const FENETRE_AVANT_H = 3;
export const FENETRE_APRES_H = 12;

export interface RencontreDuJour {
  readonly rencontreId: string;
  readonly debutPrevu: Date | null;
  readonly titre: string;
  readonly source: RencontreSource;
  readonly estTestInterne: boolean;
  readonly clientId: string | null;
  readonly clientProposeId: string | null;
  readonly motifProposition: MotifProposition | null;
}

export async function rencontresEnregistrablesDuJour(
  db: BaseBalayage,
  maintenant: Date = new Date(),
): Promise<RencontreDuJour[]> {
  const depuis = new Date(maintenant.getTime() - FENETRE_AVANT_H * 3_600_000);
  const jusqua = new Date(maintenant.getTime() + FENETRE_APRES_H * 3_600_000);

  const evs = await db.calendlyEvent.findMany({
    where: { startTime: { gte: depuis, lte: jusqua }, status: { not: "canceled" } },
    select: { id: true, eventTypeName: true, linkedJobApplicationId: true },
  });
  for (const ev of evs) {
    if (estRendezVousDuDossier(ev)) {
      await assurerRencontrePourCalendly(db, ev.id, { maintenant });
    }
  }

  const lignes = await db.rencontre.findMany({
    where: {
      debutPrevu: { gte: depuis, lte: jusqua },
      OR: [{ source: "calendly" }, { source: "saisie_manuelle", type: "visio" }],
    },
    select: {
      id: true,
      debutPrevu: true,
      titre: true,
      source: true,
      estTestInterne: true,
      clientId: true,
      clientProposeId: true,
      motifProposition: true,
      statut: true,
    },
    orderBy: { debutPrevu: "asc" },
  });
  return lignes
    .filter((l) => l.statut !== "annule")
    .map((l) => ({
      rencontreId: l.id,
      debutPrevu: l.debutPrevu,
      titre: l.titre,
      source: l.source,
      estTestInterne: l.estTestInterne,
      clientId: l.clientId,
      clientProposeId: l.clientProposeId,
      motifProposition: l.motifProposition,
    }));
}
