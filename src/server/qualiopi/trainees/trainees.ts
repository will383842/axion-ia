/**
 * Qualiopi — Lecture stagiaires (Trainee). R10 audit E2E 2026-06-06.
 *
 * Stub-aware (try/catch → [] / null). Exclut par défaut les stagiaires anonymisés
 * (deletedAt non nul, droit à l'effacement RGPD art. 17). Ne JAMAIS exposer
 * `handicapDetailsChiffre` déchiffré dans les listes (référent uniquement).
 */

import { prisma } from "@/lib/prisma";
import type { Trainee } from "../../../../prisma/generated/client";

export interface ListTraineesOpts {
  /** Recherche texte simple (nom / prénom / email / entreprise). */
  search?: string;
  /** Inclure les stagiaires anonymisés (deletedAt non nul). Défaut false. */
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/** Stagiaires (non anonymisés par défaut), triés par nom. Stub-safe → []. */
export async function listTrainees(opts?: ListTraineesOpts): Promise<Trainee[]> {
  try {
    const where: Record<string, unknown> = {};
    if (!opts?.includeDeleted) where.deletedAt = null;
    if (opts?.search && opts.search.trim() !== "") {
      const q = opts.search.trim();
      where.OR = [
        { nom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { entreprise: { contains: q, mode: "insensitive" } },
      ];
    }
    return await prisma.trainee.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      ...(opts?.limit !== undefined ? { take: opts.limit } : {}),
      ...(opts?.offset !== undefined ? { skip: opts.offset } : {}),
    });
  } catch {
    return [];
  }
}

/** Filtres du COMPTE du registre — délibérément plus étroits que ceux de la liste. */
export interface CountTraineesOpts {
  situationHandicap?: boolean;
  consentementFormation?: boolean;
  includeDeleted?: boolean;
}

/**
 * Combien de stagiaires au REGISTRE — pas dans la page affichée.
 *
 * 🔴 2026-09-02 (audit certificateur). Les trois tuiles de l'écran stagiaires
 * (« Total », « Situation de handicap », « Consentement formation ») étaient
 * calculées en filtrant le tableau JavaScript de la page. Tant que la page
 * rendait le registre entier, les chiffres étaient justes ; le jour où on la
 * plafonne, ils deviennent le décompte de ce qu'on regarde — et une tuile
 * « Situation de handicap : 3 » qui dépend du filtre en cours n'est pas un
 * indicateur, c'est un piège. Le compte vient donc d'un compteur.
 *
 * Stub-safe → 0.
 */
export async function countTrainees(opts?: CountTraineesOpts): Promise<number> {
  try {
    return await prisma.trainee.count({
      where: {
        ...(opts?.includeDeleted === true ? {} : { deletedAt: null }),
        ...(opts?.situationHandicap !== undefined
          ? { situationHandicap: opts.situationHandicap }
          : {}),
        ...(opts?.consentementFormation !== undefined
          ? { consentementFormation: opts.consentementFormation }
          : {}),
      },
    });
  } catch {
    return 0;
  }
}

/** Stagiaire par id UUID. Stub-safe → null. */
export async function getTrainee(id: string): Promise<Trainee | null> {
  try {
    return await prisma.trainee.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Stagiaire par email. Stub-safe → null. */
export async function getTraineeByEmail(email: string): Promise<Trainee | null> {
  try {
    return await prisma.trainee.findUnique({ where: { email } });
  } catch {
    return null;
  }
}
