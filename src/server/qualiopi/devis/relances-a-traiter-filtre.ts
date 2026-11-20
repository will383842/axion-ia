import type { Prisma } from "../../../../prisma/generated/client";
import { pasSigneParLeClient } from "./pas-signe-par-le-client";

/**
 * Filtre PARTAGÉ des relances proposées « à traiter » (page Facturation ET pastille du menu).
 *
 * Une relance proposée qui porte sur un DEVIS n'est gardée que si ce devis attend encore une
 * réponse : statut `envoye`, non signé par le client, validité non dépassée. Sinon la relance est
 * sans objet (devis accepté, refusé, remplacé, périmé ou déjà signé) et elle ne doit plus être
 * montrée ni comptée.
 *
 * Lecture seule : aucune ligne n'est modifiée, la relance reste en base. Les relances de facture
 * et celles du parcours de réservation ne sont pas touchées.
 *
 * Écrit UNE fois, utilisé aux deux endroits : deux définitions donneraient un jour deux chiffres.
 */
export function relancesAtraiterWhere(now: Date): Prisma.RelanceProposeeWhereInput {
  return {
    AND: [
      // À traiter = jamais traitées + reportées dont l'échéance de report est passée.
      { OR: [{ statut: "a_traiter" }, { statut: "reportee", reporteeJusqua: { lte: now } }] },
      {
        OR: [
          { type: { not: "devis_sans_reponse" } },
          {
            type: "devis_sans_reponse",
            devis: {
              is: {
                statut: "envoye",
                dateValidite: { gte: now },
                AND: [pasSigneParLeClient],
              },
            },
          },
        ],
      },
    ],
  };
}
