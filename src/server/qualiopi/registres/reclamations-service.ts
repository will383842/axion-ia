/**
 * Qualiopi — Service registre des réclamations (off.31, indicateur 31).
 *
 * creerReclamation     : crée une réclamation avec numéro AXI-REC-YYYY-NNN
 *                        (allocation atomique via count + retry sur collision).
 * repondreReclamation  : enregistre la réponse + date de réponse.
 * setStatutReclamation : change le statut (workflow off.31).
 * listReclamations     : liste paginée/filtrée.
 * reclamationsEnRetard : sans réponse > J+15 (seuil via getQualiopiConfig ou 15).
 *
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 * exactOptionalPropertyTypes : les champs optionnels n'acceptent pas `undefined`
 * affecté — les `input` utilisent `undefined` explicitement via `??`.
 */

import { prisma } from "@/lib/prisma";
import type {
  Reclamation,
  ReclamationSource,
  ReclamationStatut,
} from "../../../../prisma/generated/client";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerReclamationInput {
  source: ReclamationSource;
  reclamantNom: string;
  reclamantEmail?: string;
  objet: string;
  description: string;
  gravite?: string;
  dateReception: Date;
  enrollmentId?: string;
  /** Réclamation rattachée à un parcours coaching 1-to-1 (off.31). */
  coachingSessionId?: string;
  traiteeParId?: string;
}

export interface RepondreReclamationInput {
  reponse: string;
  actionsCorrectives?: string;
}

export interface ListReclamationsOptions {
  statut?: ReclamationStatut;
  source?: ReclamationSource;
  skip?: number;
  take?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRY = 5;

/**
 * Alloue le prochain numéro AXI-REC-YYYY-NNN de façon pseudo-atomique :
 * compte les réclamations de l'année + retry sur collision d'unicité.
 */
async function allocuerNumeroReclamation(annee: number, tentative = 1): Promise<string> {
  if (tentative > MAX_RETRY) {
    throw new Error(
      "reclamations-service: impossible d'allouer un numéro unique après " +
        MAX_RETRY +
        " tentatives",
    );
  }
  // 🔴 V20 — deux défauts corrigés d'un seul geste.
  //
  // (1) Le dénominateur était une FENÊTRE DE DATES sur `dateReception`, pas la
  //     série : toute ligne tombant dans la fenêtre décalait le compteur, qu'elle
  //     appartienne ou non à la série `AXI-REC-<annee>-`.
  // (2) `count + tentative` CREUSAIT délibérément la série à chaque collision —
  //     la reprise sautait des numéros au lieu de relire l'état réel. Un registre
  //     de réclamations à trous inexpliqués est un constat d'audit à lui seul.
  //
  // La borne haute rend les deux inutiles : elle progresse d'elle-même dès
  // qu'une insertion concurrente a abouti. `tentative` ne sert plus qu'à borner
  // la boucle de reprise, plus à décaler le numéro.
  return nextNumero("reclamation", annee, (prefixe) =>
    prisma.reclamation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// creerReclamation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une réclamation avec numéro AXI-REC-YYYY-NNN.
 * Stub-aware : lève si stub.invalid (mutation interdite au build).
 */
export async function creerReclamation(input: CreerReclamationInput): Promise<Reclamation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("reclamations-service: mutations interdites en mode stub.invalid");
  }

  const annee = input.dateReception.getFullYear();

  async function tentative(n: number): Promise<Reclamation> {
    const numero = await allocuerNumeroReclamation(annee, n);
    try {
      return await prisma.reclamation.create({
        data: {
          numero,
          source: input.source,
          reclamantNom: input.reclamantNom,
          ...(input.reclamantEmail !== undefined ? { reclamantEmail: input.reclamantEmail } : {}),
          objet: input.objet,
          description: input.description,
          ...(input.gravite !== undefined ? { gravite: input.gravite } : {}),
          statut: "nouvelle",
          dateReception: input.dateReception,
          ...(input.enrollmentId !== undefined ? { enrollmentId: input.enrollmentId } : {}),
          ...(input.coachingSessionId !== undefined
            ? { coachingSessionId: input.coachingSessionId }
            : {}),
          ...(input.traiteeParId !== undefined ? { traiteeParId: input.traiteeParId } : {}),
        },
      });
    } catch (err: unknown) {
      // Collision sur le numéro unique → retry
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002" &&
        n < MAX_RETRY
      ) {
        return tentative(n + 1);
      }
      throw err;
    }
  }

  return tentative(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// repondreReclamation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre la réponse à une réclamation existante et la passe en `resolue`.
 */
export async function repondreReclamation(
  id: string,
  input: RepondreReclamationInput,
): Promise<Reclamation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("reclamations-service: mutations interdites en mode stub.invalid");
  }
  return prisma.reclamation.update({
    where: { id },
    data: {
      reponse: input.reponse,
      ...(input.actionsCorrectives !== undefined
        ? { actionsCorrectives: input.actionsCorrectives }
        : {}),
      dateReponse: new Date(),
      statut: "resolue",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setStatutReclamation
// ─────────────────────────────────────────────────────────────────────────────

/** Change le statut d'une réclamation (workflow off.31). */
export async function setStatutReclamation(
  id: string,
  statut: ReclamationStatut,
): Promise<Reclamation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("reclamations-service: mutations interdites en mode stub.invalid");
  }
  return prisma.reclamation.update({
    where: { id },
    data: { statut },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// listReclamations
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les réclamations avec filtre optionnel sur statut/source + pagination. */
export async function listReclamations(
  options: ListReclamationsOptions = {},
): Promise<Reclamation[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.reclamation.findMany({
    where: {
      ...(options.statut !== undefined ? { statut: options.statut } : {}),
      ...(options.source !== undefined ? { source: options.source } : {}),
    },
    orderBy: { dateReception: "desc" },
    skip: options.skip ?? 0,
    take: options.take ?? 50,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// reclamationsEnRetard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne les réclamations sans réponse depuis plus de J+N jours.
 * N = config Qualiopi `seuil_reclamation_jours` si elle existe dans le registre
 * (fail-soft), sinon défaut 15.
 */
export async function reclamationsEnRetard(): Promise<Reclamation[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  let seuilJours = 15;
  try {
    // La clé `seuil_reclamation_jours` est définie dans le registre (J+15 par défaut).
    // getQualiopiConfig retourne toujours un number ; fail-soft si erreur DB.
    const val = await getQualiopiConfig("seuil_reclamation_jours");
    if (val > 0) {
      seuilJours = val;
    }
  } catch {
    // fail-soft : erreur DB → défaut 15
  }

  const seuilDate = new Date();
  seuilDate.setDate(seuilDate.getDate() - seuilJours);

  return prisma.reclamation.findMany({
    where: {
      statut: { in: ["nouvelle", "en_cours"] },
      dateReponse: null,
      dateReception: { lte: seuilDate },
    },
    orderBy: { dateReception: "asc" },
  });
}
