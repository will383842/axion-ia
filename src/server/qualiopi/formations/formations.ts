/**
 * Qualiopi — Lectures stub-safe du référentiel Formation.
 *
 * Stub-aware (build `stub.invalid` → findMany/findUnique renvoient []/null,
 * on dégrade proprement, jamais de `*OrThrow`).
 *
 * Filtre de publication (getPublicFormationBySlug) : renvoie null si la
 * formation n'est pas publiée (statutGeneration !== 'publie') OU pas active
 * (statut !== 'actif'). Double garde pour respecter le workflow AI Act art. 50.
 */

import { prisma } from "@/lib/prisma";
import type {
  Formation,
  FormationStatut,
  FormationStatutGeneration,
} from "@/server/qualiopi/formations/types";
import type { OffreSite } from "@/server/qualiopi/offres/types";

// ─────────────────────────────────────────────────────────────────────────────
// Lectures admin
// ─────────────────────────────────────────────────────────────────────────────

export interface ListFormationsOpts {
  statut?: FormationStatut;
  statutGeneration?: FormationStatutGeneration;
}

/**
 * Toutes les formations (admin), triées par date de création desc.
 * Stub-safe → [] au build.
 */
export async function listFormations(opts?: ListFormationsOpts): Promise<Formation[]> {
  try {
    const rows = await prisma.formation.findMany({
      where: {
        ...(opts?.statut !== undefined ? { statut: opts.statut } : {}),
        ...(opts?.statutGeneration !== undefined
          ? { statutGeneration: opts.statutGeneration }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows;
  } catch {
    return [];
  }
}

/**
 * Formation par id UUID (admin). Stub-safe → null au build.
 */
export async function getFormationById(id: string): Promise<Formation | null> {
  try {
    return await prisma.formation.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture publique (portail stagiaire / galerie)
// ─────────────────────────────────────────────────────────────────────────────

export type FormationWithOffreSite = Formation & { offreSite: OffreSite };

/**
 * Formation publique par slug, incluant l'offre rattachée.
 *
 * Filtre de publication strict :
 *   - statutGeneration doit être 'publie' (validation humaine + ratio pratique OK)
 *   - statut doit être 'actif' (non archivée)
 *
 * Stub-safe → null au build.
 */
export async function getPublicFormationBySlug(
  slug: string,
): Promise<FormationWithOffreSite | null> {
  try {
    const row = await prisma.formation.findUnique({
      where: { slug },
      include: { offreSite: true },
    });
    if (row == null) return null;
    // Double garde publication : publiée ET active
    if (row.statutGeneration !== "publie" || row.statut !== "actif") return null;
    return row as FormationWithOffreSite;
  } catch {
    return null;
  }
}

/**
 * Formation publique RATTACHÉE À UNE OFFRE (par tierId), pour alimenter la fiche
 * marketing /interventions/* correspondante (harmonisation Option A). Retourne la
 * formation publiée+active la plus récente de cette offre, ou null (Phase A, aucune
 * formation publiée, ou build stub). Stub-safe → null au build.
 */
export async function getPublicFormationByOffreTier(
  tierId: string,
): Promise<FormationWithOffreSite | null> {
  try {
    const row = await prisma.formation.findFirst({
      where: {
        statutGeneration: "publie",
        statut: "actif",
        offreSite: { is: { tierId } },
      },
      include: { offreSite: true },
      orderBy: { updatedAt: "desc" },
    });
    return (row as FormationWithOffreSite | null) ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards métier purs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si une formation peut accueillir de nouvelles sessions.
 *
 * Règle : statutGeneration === 'publie' ET statut === 'actif'.
 * Toute autre combinaison bloque la création de session.
 */
export function canCreateSessionFor(f: {
  statutGeneration: FormationStatutGeneration;
  statut: FormationStatut;
}): boolean {
  return f.statutGeneration === "publie" && f.statut === "actif";
}
