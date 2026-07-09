/**
 * Qualiopi — Lecture des pièces justificatives d'un formateur + évaluation de
 * sa conformité.
 *
 * Le montant sur lequel s'apprécie le seuil de vigilance URSSAF est approché par
 * le CUMUL ANNUEL des affectations du formateur, valorisé au tarif figé sur
 * chaque ligne `SessionFormateur` (`tarifHtCents`, snapshot pris à l'affectation).
 *
 * ⚠️ C'est une APPROXIMATION assumée tant que le pilier « commissionnement »
 * (lignes d'honoraires réelles) n'existe pas : on somme des tarifs journaliers,
 * pas des honoraires facturés. Elle est volontairement PRUDENTE (elle surestime
 * plutôt qu'elle ne sous-estime), pour ne jamais taire une obligation de
 * vigilance qui s'appliquerait.
 *
 * Stub-aware (try/catch → valeurs vides). Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import {
  evaluerConformiteFormateur,
  type ConformiteConfig,
  type ConformiteResultat,
  type DocumentConformite,
  type DocumentValidationStatutValue,
  type TrainerDocumentTypeValue,
  type TrainerStatutValue,
} from "./conformite";

/** Pièces d'un formateur, les plus récemment émises d'abord. Stub-safe → []. */
export async function listTrainerDocuments(trainerId: string): Promise<DocumentConformite[]> {
  try {
    return await prisma.trainerDocument.findMany({
      where: { trainerId },
      select: {
        type: true,
        statutValidation: true,
        dateEmission: true,
        dateExpiration: true,
      },
      orderBy: [{ dateEmission: "desc" }, { createdAt: "desc" }],
    });
  } catch {
    return [];
  }
}

/** Une pièce telle que l'écran d'administration a besoin de l'afficher. */
export interface TrainerDocumentRow {
  id: string;
  type: TrainerDocumentTypeValue;
  numeroPiece: string | null;
  fichierUrl: string | null;
  dateEmission: Date | null;
  dateExpiration: Date | null;
  statutValidation: DocumentValidationStatutValue;
  rejetMotif: string | null;
  createdAt: Date;
}

/**
 * Pièces d'un formateur avec TOUS les champs d'affichage (n° de pièce, URL,
 * motif de rejet, date de création…), pour le panneau de saisie de la console.
 *
 * `listTrainerDocuments` ne renvoie que ce dont le moteur de conformité a besoin ;
 * on ne l'élargit pas pour ne pas alourdir ce chemin critique. Stub-safe → [].
 */
export async function listTrainerDocumentsFull(trainerId: string): Promise<TrainerDocumentRow[]> {
  try {
    return await prisma.trainerDocument.findMany({
      where: { trainerId },
      select: {
        id: true,
        type: true,
        numeroPiece: true,
        fichierUrl: true,
        dateEmission: true,
        dateExpiration: true,
        statutValidation: true,
        rejetMotif: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  } catch {
    return [];
  }
}

/**
 * Cumul annuel (centimes) des affectations d'un formateur, valorisé au tarif
 * figé sur chaque ligne. Les prestations annulées ou reportées sont exclues :
 * elles ne donnent lieu à aucun honoraire.
 *
 * Stub-safe → 0.
 */
export async function cumulAnnuelFormateurCents(trainerId: string, annee: number): Promise<number> {
  const debut = new Date(Date.UTC(annee, 0, 1));
  const fin = new Date(Date.UTC(annee + 1, 0, 1));
  try {
    const lignes = await prisma.sessionFormateur.findMany({
      where: {
        trainerId,
        tarifHtCents: { not: null },
        session: {
          dateDebut: { gte: debut, lt: fin },
          statut: { notIn: ["annulee", "reportee"] },
        },
      },
      select: { tarifHtCents: true },
    });
    return lignes.reduce((total, l) => total + (l.tarifHtCents ?? 0), 0);
  } catch {
    return 0;
  }
}

export interface TrainerConformite extends ConformiteResultat {
  /** Montant retenu pour apprécier le seuil URSSAF (cumul annuel approché). */
  montantRetenuCents: number;
  annee: number;
}

/**
 * Conformité documentaire d'un formateur pour une année donnée.
 * `null` si le formateur est introuvable (ou au build, stub Prisma).
 */
export async function getTrainerConformite(
  trainerId: string,
  annee: number,
  now: Date,
  config?: ConformiteConfig,
): Promise<TrainerConformite | null> {
  let statut: TrainerStatutValue;
  try {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true },
    });
    if (trainer === null) return null;
    statut = trainer.statut;
  } catch {
    return null;
  }

  const [documents, montantRetenuCents] = await Promise.all([
    listTrainerDocuments(trainerId),
    cumulAnnuelFormateurCents(trainerId, annee),
  ]);

  const resultat = evaluerConformiteFormateur(
    {
      statut,
      documents,
      montantRetenuCents,
      ...(config !== undefined ? { config } : {}),
    },
    now,
  );

  return { ...resultat, montantRetenuCents, annee };
}
