/**
 * Qualiopi — Écriture du référentiel OPCO versionné (Lot 5).
 *
 * `creerVersionBaremeOpco` : crée une NOUVELLE version d'un barème (append-only,
 * l'historique n'est JAMAIS écrasé) et MAINTIENT l'invariant « au plus une version
 * ouverte par OPCO / pas de chevauchement », y compris pour une saisie ANTÉRIEURE
 * (correction rétroactive) :
 *   - la nouvelle version est bornée par son successeur éventuel (la plus petite
 *     date d'effet strictement supérieure) → `effectiveTo` = date du successeur,
 *     sinon `null` (version courante) ;
 *   - les versions ouvertes de date d'effet ≤ la nouvelle sont fermées à la
 *     nouvelle date d'effet.
 * `supprimerBaremeOpco` : retire une ligne saisie par erreur.
 *
 * Les lectures/résolutions vivent dans `bareme-opco.ts`.
 */

import { prisma } from "@/lib/prisma";
import type { Opco } from "../../../../prisma/generated/client";

export interface CreerVersionBaremeInput {
  opco: Opco;
  dateEffet: Date;
  perimetre?: string | null;
  intraHoraireCents?: number | null;
  interPresentielCents?: number | null;
  interDistancielCents?: number | null;
  plafondFormationCents?: number | null;
  plafondAnnuelCents?: number | null;
  sourceUrl?: string | null;
  releveLe?: Date | null;
  note?: string | null;
  createdById?: string | null;
}

/**
 * Crée une version de barème pour un OPCO et clôt les versions ouvertes
 * antérieures (transaction atomique). Renvoie l'id créé.
 */
export async function creerVersionBaremeOpco(
  input: CreerVersionBaremeInput,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    // Successeur éventuel : la plus petite date d'effet STRICTEMENT supérieure.
    // Il borne la nouvelle version (cas d'une saisie rétroactive intercalée) pour
    // éviter tout chevauchement / deuxième ligne « en vigueur ».
    const successeur = await tx.baremeOpco.findFirst({
      where: { opco: input.opco, dateEffet: { gt: input.dateEffet } },
      orderBy: { dateEffet: "asc" },
      select: { dateEffet: true },
    });
    const effectiveTo = successeur ? successeur.dateEffet : null;

    // Fermer les barèmes encore ouverts de cet OPCO dont l'effet précède (ou
    // égale) la nouvelle date d'effet : la nouvelle version prend le relais.
    await tx.baremeOpco.updateMany({
      where: {
        opco: input.opco,
        effectiveTo: null,
        dateEffet: { lte: input.dateEffet },
      },
      data: { effectiveTo: input.dateEffet },
    });

    const created = await tx.baremeOpco.create({
      data: {
        opco: input.opco,
        dateEffet: input.dateEffet,
        effectiveTo,
        perimetre: input.perimetre ?? null,
        intraHoraireCents: input.intraHoraireCents ?? null,
        interPresentielCents: input.interPresentielCents ?? null,
        interDistancielCents: input.interDistancielCents ?? null,
        plafondFormationCents: input.plafondFormationCents ?? null,
        plafondAnnuelCents: input.plafondAnnuelCents ?? null,
        sourceUrl: input.sourceUrl ?? null,
        releveLe: input.releveLe ?? null,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
      select: { id: true },
    });

    return { id: created.id };
  });
}

/** Supprime une ligne de barème (saisie erronée). L'historique légitime est conservé. */
export async function supprimerBaremeOpco(id: string): Promise<void> {
  await prisma.baremeOpco.delete({ where: { id } });
}
