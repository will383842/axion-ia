/**
 * Qualiopi — Service inventaire des moyens pédagogiques (off.17/18/19 — doc A14).
 *
 * creerMoyen     : crée un moyen pédagogique.
 * updateMoyen    : met à jour un moyen (champs fournis uniquement).
 * setMoyenActif  : active/désactive un moyen (jamais de DELETE — inventaire tracé).
 * getMoyen       : lecture unitaire.
 * listMoyens     : liste filtrée par catégorie / actif optionnels.
 *
 * Stub-aware : early-exit/mutations interdites si DATABASE_URL contient "stub.invalid".
 * exactOptionalPropertyTypes : champs optionnels transmis via spread conditionnel.
 */

import { prisma } from "@/lib/prisma";
import type { MoyenPedagogique, MoyenCategorie } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerMoyenInput {
  categorie: MoyenCategorie;
  libelle: string;
  description?: string;
  localisation?: string;
  dateVerification?: Date | null;
}

export interface UpdateMoyenInput {
  categorie?: MoyenCategorie;
  libelle?: string;
  description?: string;
  localisation?: string;
  /** `null` efface la date de vérification. */
  dateVerification?: Date | null;
}

export interface ListMoyensOptions {
  categorie?: MoyenCategorie;
  actif?: boolean;
  skip?: number;
  take?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerMoyen
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un moyen pédagogique dans l'inventaire. */
export async function creerMoyen(input: CreerMoyenInput): Promise<MoyenPedagogique> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("moyens-service: mutations interdites en mode stub.invalid");
  }
  return prisma.moyenPedagogique.create({
    data: {
      categorie: input.categorie,
      libelle: input.libelle,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.localisation !== undefined ? { localisation: input.localisation } : {}),
      ...(input.dateVerification !== undefined ? { dateVerification: input.dateVerification } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updateMoyen
// ─────────────────────────────────────────────────────────────────────────────

/** Met à jour les champs fournis d'un moyen pédagogique. */
export async function updateMoyen(id: string, input: UpdateMoyenInput): Promise<MoyenPedagogique> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("moyens-service: mutations interdites en mode stub.invalid");
  }
  return prisma.moyenPedagogique.update({
    where: { id },
    data: {
      ...(input.categorie !== undefined ? { categorie: input.categorie } : {}),
      ...(input.libelle !== undefined ? { libelle: input.libelle } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.localisation !== undefined ? { localisation: input.localisation } : {}),
      ...(input.dateVerification !== undefined ? { dateVerification: input.dateVerification } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setMoyenActif
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active/désactive un moyen. Pas de suppression physique : l'inventaire reste
 * traçable pour l'audit (un moyen retiré est désactivé, jamais effacé).
 */
export async function setMoyenActif(id: string, actif: boolean): Promise<MoyenPedagogique> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("moyens-service: mutations interdites en mode stub.invalid");
  }
  return prisma.moyenPedagogique.update({ where: { id }, data: { actif } });
}

// ─────────────────────────────────────────────────────────────────────────────
// getMoyen
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire d'un moyen pédagogique. Retourne null si introuvable. */
export async function getMoyen(id: string): Promise<MoyenPedagogique | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.moyenPedagogique.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listMoyens
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les moyens pédagogiques, filtrés par catégorie / actif optionnels. */
export async function listMoyens(options: ListMoyensOptions = {}): Promise<MoyenPedagogique[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.moyenPedagogique.findMany({
    where: {
      ...(options.categorie !== undefined ? { categorie: options.categorie } : {}),
      ...(options.actif !== undefined ? { actif: options.actif } : {}),
    },
    orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
    skip: options.skip ?? 0,
    take: options.take ?? 200,
  });
}
