/**
 * Formateurs indépendants — LECTURE du cumul des honoraires HT (lot G1). La règle vit
 * dans `vigilance-seuil.ts` (pure) ; ici, la base seulement.
 *
 * 🔴 Garde FERMÉE : une lecture en échec rend `null`, que la règle lit « seuil atteint »
 * (attestation exigée, comme avant le lot). Aucun montant n'est journalisé.
 *
 * Module neutre (sans `server-only`) : lu aussi par le worker (relances, alertes).
 */

import { prisma } from "@/lib/prisma";

import { STATUTS_RELEVE_CUMUL } from "./vigilance-seuil";

/** Le strict nécessaire d'un client Prisma. */
export interface ClientCumulHonoraires {
  trainerStatement: {
    aggregate(a: unknown): Promise<unknown>;
  };
}

/** Cumul HT des relevés facturés d'UN formateur ; `null` si illisible. */
export async function lireCumulHonorairesHtCents(
  trainerId: string,
  db: ClientCumulHonoraires = prisma as unknown as ClientCumulHonoraires,
): Promise<number | null> {
  try {
    const r = await db.trainerStatement.aggregate({
      where: { trainerId, statut: { in: [...STATUTS_RELEVE_CUMUL] } },
      _sum: { totalHtCents: true },
    });
    const total = (r as { _sum?: { totalHtCents?: number | null } | null } | null)?._sum
      ?.totalHtCents;
    if (total === undefined || total === null) return 0;
    return typeof total === "number" && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

/**
 * Cumuls HT de PLUSIEURS formateurs, en une lecture. Un formateur sans relevé vaut 0.
 * Lecture en échec : `null` pour tous (seuil atteint pour tous, garde fermée).
 */
export async function lireCumulsHonorairesHtCents(
  trainerIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, number | null>> {
  const cumuls = new Map<string, number | null>(trainerIds.map((id) => [id, 0]));
  if (trainerIds.length === 0) return cumuls;
  try {
    const lignes = await prisma.trainerStatement.groupBy({
      by: ["trainerId"],
      where: { trainerId: { in: [...trainerIds] }, statut: { in: [...STATUTS_RELEVE_CUMUL] } },
      _sum: { totalHtCents: true },
    });
    for (const l of lignes) cumuls.set(l.trainerId, l._sum?.totalHtCents ?? 0);
    return cumuls;
  } catch {
    return new Map(trainerIds.map((id) => [id, null]));
  }
}
