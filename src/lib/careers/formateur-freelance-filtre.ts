/**
 * « Candidature de formateur freelance », écrit en filtre Prisma (lot L0h).
 *
 * La même règle que `estCandidatureFormateurFreelance` (`formateur-freelance.ts`),
 * à partir des MÊMES listes de mots, plus les deux colonnes de nature (celle de
 * la candidature, figée au dépôt ; celle de l'offre, choisie en console). C'est
 * une INCLUSION pour une vue : un indice suffit, aucun n'exclut.
 *
 * Module pur (types Prisma seulement).
 */

import type { Prisma } from "../../../prisma/generated/client";

import {
  EMPLOI_CONTRACTOR,
  MOTS_FORMATEUR,
  MOTS_FREELANCE,
  SLUG_OFFRE_FORMATEUR_FREELANCE,
} from "./formateur-freelance";

const contient = (m: string) => ({ contains: m, mode: "insensitive" as const });
const PAIRES = MOTS_FORMATEUR.flatMap((f) => MOTS_FREELANCE.map((l) => [f, l] as const));
const TITRE_FORMATEUR = { OR: MOTS_FORMATEUR.map((f) => ({ titleFr: contient(f) })) };

export function whereCandidatureFormateurFreelance(): Prisma.JobApplicationWhereInput {
  return {
    OR: [
      // Nature figée « freelance » ET un intitulé de formateur (une offre de
      // monteur peut aussi être freelance).
      {
        AND: [
          { natureCollaboration: "freelance" as const },
          {
            OR: [
              ...MOTS_FORMATEUR.map((f) => ({ offerTitleSnap: contient(f) })),
              { offer: TITRE_FORMATEUR },
              { offer: { OR: MOTS_FORMATEUR.map((f) => ({ slug: contient(f) })) } },
            ],
          },
        ],
      },
      ...PAIRES.map(([f, l]) => ({
        AND: [{ offerTitleSnap: contient(f) }, { offerTitleSnap: contient(l) }],
      })),
      // Intitulé figé de formateur, offre déclarée CONTRACTOR.
      {
        AND: [
          { OR: MOTS_FORMATEUR.map((f) => ({ offerTitleSnap: contient(f) })) },
          {
            offer: {
              OR: [
                { employmentType: EMPLOI_CONTRACTOR },
                { secondaryEmploymentType: EMPLOI_CONTRACTOR },
              ],
            },
          },
        ],
      },
      {
        offer: {
          OR: [
            { slug: SLUG_OFFRE_FORMATEUR_FREELANCE },
            { AND: [{ natureCollaboration: "freelance" as const }, TITRE_FORMATEUR] },
            ...PAIRES.map(([f, l]) => ({
              AND: [{ titleFr: contient(f) }, { titleFr: contient(l) }],
            })),
            ...PAIRES.map(([f, l]) => ({ AND: [{ slug: contient(f) }, { slug: contient(l) }] })),
            {
              AND: [
                {
                  OR: [
                    ...TITRE_FORMATEUR.OR,
                    ...MOTS_FORMATEUR.map((f) => ({ slug: contient(f) })),
                  ],
                },
                {
                  OR: [
                    { employmentType: EMPLOI_CONTRACTOR },
                    { secondaryEmploymentType: EMPLOI_CONTRACTOR },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
