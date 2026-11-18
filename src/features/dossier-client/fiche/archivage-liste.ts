/**
 * Liste des clients et archivage (lot B6) : les fiches archivées sont masquées par défaut. Une
 * lecture en panne ne cache rien : la liste reste complète et la page le dit.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";

type Base = Pick<PrismaClient, "clientProfil">;

export interface PartageArchives<T extends { id: string }> {
  readonly actives: T[];
  readonly archivees: T[];
  readonly lectureImpossible: boolean;
}

export async function separerLesArchivees<T extends { id: string }>(
  db: Base,
  clients: ReadonlyArray<T>,
): Promise<PartageArchives<T>> {
  if (clients.length === 0) return { actives: [], archivees: [], lectureImpossible: false };
  try {
    const lignes = await db.clientProfil.findMany({
      where: { clientId: { in: clients.map((c) => c.id) }, archiveLe: { not: null } },
      select: { clientId: true },
    });
    const archives = new Set(lignes.map((l) => l.clientId));
    return {
      actives: clients.filter((c) => !archives.has(c.id)),
      archivees: clients.filter((c) => archives.has(c.id)),
      lectureImpossible: false,
    };
  } catch {
    return { actives: [...clients], archivees: [], lectureImpossible: true };
  }
}
