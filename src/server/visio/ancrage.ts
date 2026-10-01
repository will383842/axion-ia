/**
 * La rencontre d'ANCRAGE d'un projet : la plus récente rangée dans ce projet.
 * C'est à elle que s'attachent les étapes à la demande du questionnaire
 * (`questionnaire`, `lire_reponses`).
 *
 * Module à part (2026-10-01) : la route PUBLIQUE du questionnaire en ligne en a
 * besoin sans tirer `gestes-suivi.ts` et son graphe (passes IA, e-mail de
 * suivi). `gestes-suivi.ts` la réexporte : un seul endroit pour la règle.
 */

import type { PrismaClient } from "../../../prisma/generated/client";

export async function rencontreDAncrage(
  db: Pick<PrismaClient, "rencontre">,
  clientId: string,
  projetId: string,
): Promise<string | null> {
  const r = await db.rencontre.findFirst({
    where: { clientId, projetId, fusionneeDansId: null },
    orderBy: [{ debutReel: "desc" }, { debutPrevu: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return r?.id ?? null;
}
