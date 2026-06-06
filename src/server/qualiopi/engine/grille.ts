/**
 * Qualiopi — Formation Engine T4 : Accès DB à la grille qualité active.
 *
 * Stub-aware : `findFirst` retourne null en contexte `stub.invalid` → retour null.
 * Import Prisma via singleton `@/lib/prisma` (jamais de nouveau PrismaClient).
 */

import { prisma } from "@/lib/prisma";
import { GrilleCriteresSchema, type GrilleCriteres } from "@/server/qualiopi/engine/grille-schema";

export interface GrilleActive {
  id: string;
  criteres: GrilleCriteres;
  scorePlancher: number;
  nbPassesMax: number;
  promptVersion: number;
}

/**
 * Retourne la grille qualité active ou `null` si aucune n'est configurée /
 * en contexte de build stub.
 *
 * - Lit `GrilleQualiteConfig` avec `actif = true`.
 * - Parse les critères via Zod safeParse (critères invalides → tableau vide).
 * - Ne lève jamais d'exception (stub-aware).
 */
export async function getActiveGrille(): Promise<GrilleActive | null> {
  try {
    const row = await prisma.grilleQualiteConfig.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;

    const parsed = GrilleCriteresSchema.safeParse(row.criteres);
    // Cast: Zod infer inclut `undefined` pour les optionnels, mais en pratique
    // les valeurs parsées sont soit string soit absent — compatible avec GrilleCriteres.
    const criteres: GrilleCriteres = parsed.success ? (parsed.data as GrilleCriteres) : [];

    return {
      id: row.id,
      criteres,
      scorePlancher: row.scorePlancher,
      nbPassesMax: row.nbPassesMax,
      promptVersion: row.promptVersion,
    };
  } catch {
    // Stub proxy ou DB inaccessible → null
    return null;
  }
}
