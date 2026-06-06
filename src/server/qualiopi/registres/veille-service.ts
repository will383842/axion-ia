/**
 * Qualiopi — Service registre de veille (off.23/24/25, indicateurs 23-25).
 *
 * creerVeille   : crée une entrée de veille.
 * updateVeille  : met à jour une entrée (champs fournis uniquement).
 * supprimerVeille : supprime une entrée.
 * getVeille     : lecture unitaire.
 * listVeille    : liste filtrée par type optionnel.
 *
 * Stub-aware : early-exit/mutations interdites si DATABASE_URL contient "stub.invalid".
 * exactOptionalPropertyTypes : champs optionnels transmis via spread conditionnel.
 */

import { prisma } from "@/lib/prisma";
import type { Veille, VeilleType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerVeilleInput {
  type: VeilleType;
  source: string;
  titre: string;
  contenu: string;
  dateVeille: Date;
  impact?: string;
  actionDecidee?: string;
  creeParId?: string;
}

export interface UpdateVeilleInput {
  type?: VeilleType;
  source?: string;
  titre?: string;
  contenu?: string;
  dateVeille?: Date;
  impact?: string;
  actionDecidee?: string;
}

export interface ListVeilleOptions {
  type?: VeilleType;
  skip?: number;
  take?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerVeille
// ─────────────────────────────────────────────────────────────────────────────

/** Crée une entrée dans le registre de veille. */
export async function creerVeille(input: CreerVeilleInput): Promise<Veille> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("veille-service: mutations interdites en mode stub.invalid");
  }
  return prisma.veille.create({
    data: {
      type: input.type,
      source: input.source,
      titre: input.titre,
      contenu: input.contenu,
      dateVeille: input.dateVeille,
      ...(input.impact !== undefined ? { impact: input.impact } : {}),
      ...(input.actionDecidee !== undefined ? { actionDecidee: input.actionDecidee } : {}),
      ...(input.creeParId !== undefined ? { creeParId: input.creeParId } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updateVeille
// ─────────────────────────────────────────────────────────────────────────────

/** Met à jour les champs fournis d'une entrée de veille. */
export async function updateVeille(id: string, input: UpdateVeilleInput): Promise<Veille> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("veille-service: mutations interdites en mode stub.invalid");
  }
  return prisma.veille.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.titre !== undefined ? { titre: input.titre } : {}),
      ...(input.contenu !== undefined ? { contenu: input.contenu } : {}),
      ...(input.dateVeille !== undefined ? { dateVeille: input.dateVeille } : {}),
      ...(input.impact !== undefined ? { impact: input.impact } : {}),
      ...(input.actionDecidee !== undefined ? { actionDecidee: input.actionDecidee } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerVeille
// ─────────────────────────────────────────────────────────────────────────────

/** Supprime une entrée de veille. */
export async function supprimerVeille(id: string): Promise<Veille> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("veille-service: mutations interdites en mode stub.invalid");
  }
  return prisma.veille.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// getVeille
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire d'une entrée de veille. Retourne null si introuvable. */
export async function getVeille(id: string): Promise<Veille | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.veille.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listVeille
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les entrées de veille, filtrées par type optionnel. */
export async function listVeille(options: ListVeilleOptions = {}): Promise<Veille[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.veille.findMany({
    where: {
      ...(options.type !== undefined ? { type: options.type } : {}),
    },
    orderBy: { dateVeille: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 50,
  });
}
