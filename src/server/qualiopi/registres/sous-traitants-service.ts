/**
 * Qualiopi — Service registre des sous-traitants OF (off.27, indicateur 27).
 *
 * creerSousTraitant      : crée un sous-traitant.
 * updateSousTraitant     : met à jour un sous-traitant.
 * supprimerSousTraitant  : supprime un sous-traitant.
 * getSousTraitant        : lecture unitaire.
 * listSousTraitants      : liste filtrée actif/inactif.
 * verifierDataGouv       : marque la date de vérification data.gouv.fr.
 *
 * Stub-aware. exactOptionalPropertyTypes.
 */

import { prisma } from "@/lib/prisma";
import type { SousTraitant } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerSousTraitantInput {
  nom: string;
  siret?: string;
  nda?: string;
  objetPrestation: string;
  /**
   * 🔴 Contact SIGNATAIRE — ces trois champs manquaient à cette interface.
   *
   * `creerSousTraitantAction` les collectait, les validait et les passait ici
   * **par spread** : TypeScript n'applique pas le contrôle de propriété
   * excédentaire aux propriétés issues d'un spread, donc rien n'a rougi et les
   * trois valeurs tombaient sur le sol entre l'action et Prisma. Résultat
   * mesuré : `sous_traitants_of.contact_email` n'avait AUCUN écrivain, alors que
   * `piece-lien-signature.ts:167` le LIT pour émettre le lien de signature du
   * contrat de sous-traitance — que l'indicateur 27 exige signé.
   */
  contactNom?: string;
  contactEmail?: string;
  contactFonction?: string;
  contratSigneAt?: Date;
  actif?: boolean;
}

/**
 * Champs modifiables d'un sous-traitant déjà créé.
 *
 * `| null` sur les colonnes nullables : vider un champ est un geste distinct de
 * « ne pas y toucher ». `undefined` laisse en l'état, `null` efface — même
 * contrat que `updateSousTraitantPiecesAction` et que le panneau formateur.
 * Sans cette distinction, un NDA saisi par erreur ne pourrait plus être retiré.
 */
export interface UpdateSousTraitantInput {
  nom?: string;
  siret?: string | null;
  nda?: string | null;
  objetPrestation?: string;
  contactNom?: string | null;
  contactEmail?: string | null;
  contactFonction?: string | null;
  contratSigneAt?: Date | null;
  actif?: boolean;
}

export interface ListSousTraitantsOptions {
  actif?: boolean;
  skip?: number;
  take?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un sous-traitant dans le registre. */
export async function creerSousTraitant(input: CreerSousTraitantInput): Promise<SousTraitant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("sous-traitants-service: mutations interdites en mode stub.invalid");
  }
  return prisma.sousTraitant.create({
    data: {
      nom: input.nom,
      objetPrestation: input.objetPrestation,
      actif: input.actif ?? true,
      ...(input.siret !== undefined ? { siret: input.siret } : {}),
      ...(input.nda !== undefined ? { nda: input.nda } : {}),
      ...(input.contactNom !== undefined ? { contactNom: input.contactNom } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactFonction !== undefined ? { contactFonction: input.contactFonction } : {}),
      ...(input.contratSigneAt !== undefined ? { contratSigneAt: input.contratSigneAt } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

/** Met à jour les champs fournis d'un sous-traitant. */
export async function updateSousTraitant(
  id: string,
  input: UpdateSousTraitantInput,
): Promise<SousTraitant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("sous-traitants-service: mutations interdites en mode stub.invalid");
  }
  return prisma.sousTraitant.update({
    where: { id },
    data: {
      ...(input.nom !== undefined ? { nom: input.nom } : {}),
      ...(input.siret !== undefined ? { siret: input.siret } : {}),
      ...(input.nda !== undefined ? { nda: input.nda } : {}),
      ...(input.objetPrestation !== undefined ? { objetPrestation: input.objetPrestation } : {}),
      ...(input.contactNom !== undefined ? { contactNom: input.contactNom } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactFonction !== undefined ? { contactFonction: input.contactFonction } : {}),
      ...(input.contratSigneAt !== undefined ? { contratSigneAt: input.contratSigneAt } : {}),
      ...(input.actif !== undefined ? { actif: input.actif } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

/** Supprime un sous-traitant. */
export async function supprimerSousTraitant(id: string): Promise<SousTraitant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("sous-traitants-service: mutations interdites en mode stub.invalid");
  }
  return prisma.sousTraitant.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// getSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

/** Lecture unitaire d'un sous-traitant. Retourne null si introuvable. */
export async function getSousTraitant(id: string): Promise<SousTraitant | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  return prisma.sousTraitant.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// listSousTraitants
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les sous-traitants avec filtre optionnel sur l'état actif. */
export async function listSousTraitants(
  options: ListSousTraitantsOptions = {},
): Promise<SousTraitant[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.sousTraitant.findMany({
    where: {
      ...(options.actif !== undefined ? { actif: options.actif } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 50,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// verifierDataGouv
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre la date de vérification data.gouv.fr pour un sous-traitant.
 * Met à jour `verifieDataGouvAt` avec la date fournie (ou maintenant).
 */
export async function verifierDataGouv(id: string, dateVerification?: Date): Promise<SousTraitant> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("sous-traitants-service: mutations interdites en mode stub.invalid");
  }
  return prisma.sousTraitant.update({
    where: { id },
    data: { verifieDataGouvAt: dateVerification ?? new Date() },
  });
}
