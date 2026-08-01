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
 * Toutes les formations (admin), avec l'offre rattachée résolue.
 *
 * Audit UX : la liste affichait `offreSiteId` en UUID brut dans la colonne
 * « Offre ». On inclut `offreSite` (même pattern que `getPublicFormationBySlug`
 * ci-dessous) pour afficher son code (AXI-OFF-NNN) plutôt que l'UUID.
 * Stub-safe → [] au build.
 */
export async function listFormations(opts?: ListFormationsOpts): Promise<FormationWithOffreSite[]> {
  try {
    const rows = await prisma.formation.findMany({
      where: {
        ...(opts?.statut !== undefined ? { statut: opts.statut } : {}),
        ...(opts?.statutGeneration !== undefined
          ? { statutGeneration: opts.statutGeneration }
          : {}),
      },
      include: { offreSite: true },
      orderBy: { createdAt: "desc" },
    });
    return rows as FormationWithOffreSite[];
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
