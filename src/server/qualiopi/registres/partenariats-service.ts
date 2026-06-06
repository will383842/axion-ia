/**
 * Qualiopi — Service registre des partenariats (off.25, réseau de partenaires
 * dont réseau handicap).
 *
 * creerPartenariat   : crée un partenariat.
 * updatePartenariat  : met à jour un partenariat.
 * supprimerPartenariat : supprime un partenariat.
 * getPartenariat     : lecture unitaire.
 * listPartenariats   : liste filtrée actif/inactif.
 *
 * Stub-aware. exactOptionalPropertyTypes.
 */

import { prisma } from "@/lib/prisma";
import type { Partenariat } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerPartenariatInput {
  nom: string;
  type: string;
  objet: string;
  dateDebut: Date;
  dateFin?: Date;
  actif?: boolean;
}

export interface UpdatePartenariatInput {
  nom?: string;
  type?: string;
  objet?: string;
  dateDebut?: Date;
  dateFin?: Date;
  actif?: boolean;
}

export interface ListPartenariatsOptions {
  actif?: boolean;
  skip?: number;
  take?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerPartenariat
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un partenariat dans le registre. */
export async function creerPartenariat(input: CreerPartenariatInput): Promise<Partenariat> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("partenariats-service: mutations interdites en mode stub.invalid");
  }
  return prisma.partenariat.create({
    data: {
      nom: input.nom,
      type: input.type,
      objet: input.objet,
      dateDebut: input.dateDebut,
      ...(input.dateFin !== undefined ? { dateFin: input.dateFin } : {}),
      actif: input.actif ?? true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updatePartenariat
// ─────────────────────────────────────────────────────────────────────────────

/** Met à jour les champs fournis d'un partenariat. */
export async function updatePartenariat(
  id: string,
  input: UpdatePartenariatInput,
): Promise<Partenariat> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("partenariats-service: mutations interdites en mode stub.invalid");
  }
  return prisma.partenariat.update({
    where: { id },
    data: {
      ...(input.nom !== undefined ? { nom: input.nom } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.objet !== undefined ? { objet: input.objet } : {}),
      ...(input.dateDebut !== undefined ? { dateDebut: input.dateDebut } : {}),
      ...(input.dateFin !== undefined ? { dateFin: input.dateFin } : {}),
      ...(input.actif !== undefined ? { actif: input.actif } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerPartenariat
// ─────────────────────────────────────────────────────────────────────────────

/** Supprime un partenariat. */
export async function supprimerPartenariat(id: string): Promise<Partenariat> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("partenariats-service: mutations interdites en mode stub.invalid");
  }
  return prisma.partenariat.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// getPartenariat
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire d'un partenariat. Retourne null si introuvable. */
export async function getPartenariat(id: string): Promise<Partenariat | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.partenariat.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listPartenariats
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les partenariats avec filtre optionnel sur l'état actif. */
export async function listPartenariats(
  options: ListPartenariatsOptions = {},
): Promise<Partenariat[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.partenariat.findMany({
    where: {
      ...(options.actif !== undefined ? { actif: options.actif } : {}),
    },
    orderBy: { dateDebut: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 50,
  });
}
