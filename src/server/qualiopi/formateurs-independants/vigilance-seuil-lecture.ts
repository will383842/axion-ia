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

import { STATUTS_RELEVE_CUMUL, cumulDesReleves, type ReleveCumul } from "./vigilance-seuil";

/** Le strict nécessaire d'un client Prisma. */
export interface ClientCumulHonoraires {
  trainerStatement: {
    findMany(a: unknown): Promise<unknown>;
  };
}

/**
 * Ce que la règle pure (`cumulDesReleves`) doit voir de chaque relevé : la pièce que
 * corrige un avoir, et les lignes d'imputation de trop-perçu (relecture G1 : sans elles,
 * un avoir total et un trop-perçu imputé étaient déduits deux fois).
 */
const SELECT_CUMUL = {
  trainerId: true,
  statut: true,
  totalHtCents: true,
  avoirDe: { select: { statut: true } },
  feeLines: {
    where: { imputeDeStatementId: { not: null }, statut: { not: "annule" } },
    select: { montantHtCents: true },
  },
} as const;

type LuCumul = ReleveCumul & {
  readonly trainerId: string;
  readonly feeLines?: ReadonlyArray<{ readonly montantHtCents: number }>;
};

function enReleve(l: LuCumul): ReleveCumul {
  return {
    statut: l.statut,
    totalHtCents: l.totalHtCents,
    avoirDe: l.avoirDe ?? null,
    imputations: l.feeLines ?? [],
  };
}

const clientParDefaut = () => prisma as unknown as ClientCumulHonoraires;

/** Cumul HT des relevés facturés d'UN formateur ; `null` si illisible. */
export async function lireCumulHonorairesHtCents(
  trainerId: string,
  db: ClientCumulHonoraires = clientParDefaut(),
): Promise<number | null> {
  const cumuls = await lireCumulsHonorairesHtCents([trainerId], db);
  return cumuls.get(trainerId) ?? null;
}

/**
 * Cumuls HT de PLUSIEURS formateurs, en une lecture — la MÊME règle que pour un seul
 * (alertes du matin, demande à l'approche, renouvellement). Un formateur sans relevé
 * vaut 0. Lecture en échec : `null` pour tous (seuil atteint pour tous, garde fermée).
 */
export async function lireCumulsHonorairesHtCents(
  trainerIds: ReadonlyArray<string>,
  db: ClientCumulHonoraires = clientParDefaut(),
): Promise<ReadonlyMap<string, number | null>> {
  const ids = [...new Set(trainerIds)];
  if (ids.length === 0) return new Map();
  try {
    const lus = (await db.trainerStatement.findMany({
      where: {
        trainerId: ids.length === 1 ? ids[0] : { in: ids },
        statut: { in: [...STATUTS_RELEVE_CUMUL] },
      },
      select: SELECT_CUMUL,
    })) as ReadonlyArray<LuCumul>;
    if (!Array.isArray(lus)) return new Map(ids.map((id) => [id, null]));
    const parFormateur = new Map<string, ReleveCumul[]>(ids.map((id) => [id, []]));
    for (const l of lus) parFormateur.get(l.trainerId)?.push(enReleve(l));
    return new Map(ids.map((id) => [id, cumulDesReleves(parFormateur.get(id) ?? [])]));
  } catch {
    return new Map(ids.map((id) => [id, null]));
  }
}
