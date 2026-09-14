/**
 * Pièces « positionnement REMPLI » du dossier d'audit — constat C2-03.
 *
 * Une pièce par questionnaire de positionnement RÉPONDU, sur une session qui a
 * réellement eu lieu, rendue à la volée depuis `Questionnaire.reponses`. Elle
 * remplace, comme preuve des indicateurs 4 et 8, le gabarit vierge que le
 * dossier présentait seul jusque-là.
 *
 * 🔑 Le compte (manifeste) et la liste (ZIP) lisent le MÊME prédicat
 * `wherePositionnementRempli()` : le manifeste ne peut pas annoncer trois
 * pièces quand le ZIP en joint deux.
 *
 * 🔴 Relecture de la PR 1090 :
 *   · une saisie par l'organisme (`saisie_admin: true`) n'est PAS un
 *     positionnement rempli par le stagiaire. Elle est comptée à part, et sa
 *     pièce est nommée et titrée comme telle ;
 *   · la précision d'un besoin d'adaptation (donnée de santé) n'entre JAMAIS
 *     dans une pièce. Sa présence chiffrée se lit par un FILTRE en base : la
 *     colonne `handicapDetailsChiffre` n'est pas chargée.
 *
 * ⚠️ Un rendu en échec est RAPPORTÉ (`echecs`), jamais avalé : l'appelant le
 * porte en avertissement et déclare le dossier incomplet.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { inscriptionSurSessionTenue } from "@/server/qualiopi/conformite/piece-admissible";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { PositionnementRempliPdf } from "@/server/qualiopi/documents/templates/positionnement-rempli";
import {
  chronologieReponse,
  estSaisieOrganisme,
  formaterInstantParis,
  lirePositionnement,
} from "./lecture-positionnement";
import { stagiairesAvecPrecisionChiffree } from "./precision-chiffree";

export interface PiecePositionnementRempli {
  readonly chemin: string;
  readonly buffer: Buffer;
  /** Saisie par l'organisme, et non réponse du stagiaire. */
  readonly saisieOrganisme: boolean;
}

export interface EchecPositionnementRempli {
  readonly chemin: string;
  readonly motif: string;
  readonly saisieOrganisme: boolean;
}

export interface ComptePositionnementsRemplis {
  /** Répondus par les stagiaires eux-mêmes (portail). */
  readonly parStagiaires: number;
  /** Saisis par l'organisme à leur place : ne valent pas réponse du stagiaire. */
  readonly parOrganisme: number;
}

/**
 * Positionnement répondu, sur une inscription dont la session n'est ni annulée
 * ni reportée (même exclusion que toutes les preuves du dossier).
 */
export function wherePositionnementRempli() {
  return {
    type: "positionnement" as const,
    reponduAt: { not: null },
    enrollment: inscriptionSurSessionTenue(),
  };
}

/**
 * Le partage stagiaires / organisme lit `saisie_admin` en JS, avec la même
 * fonction que l'écran et la pièce : un filtre JSON en base (`NOT path equals`)
 * écarterait silencieusement les réponses où la clé est absente.
 */
export async function compterPositionnementsRemplis(): Promise<ComptePositionnementsRemplis> {
  const lignes = await prisma.questionnaire.findMany({
    where: wherePositionnementRempli(),
    select: { reponses: true },
  });
  const parOrganisme = lignes.filter((l) => estSaisieOrganisme(l.reponses)).length;
  return { parStagiaires: lignes.length - parOrganisme, parOrganisme };
}

function slug(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** AAAA-MM-JJ du jour de Paris — le jour de session tel qu'on le lit. */
function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Paris",
  }).format(instant);
}

export async function produirePiecesPositionnementRempli(): Promise<{
  pieces: PiecePositionnementRempli[];
  echecs: EchecPositionnementRempli[];
}> {
  const lignes = await prisma.questionnaire.findMany({
    where: wherePositionnementRempli(),
    select: {
      id: true,
      reponduAt: true,
      reponses: true,
      enrollment: {
        select: {
          trainee: { select: { id: true, nom: true, prenom: true } },
          session: { select: { titreSession: true, dateDebut: true } },
        },
      },
    },
    orderBy: { reponduAt: "asc" },
  });

  const pieces: PiecePositionnementRempli[] = [];
  const echecs: EchecPositionnementRempli[] = [];
  if (lignes.length === 0) return { pieces, echecs };

  // PRÉSENCE d'une précision chiffrée, par filtre : le chiffré n'est pas chargé.
  const avecDetailChiffre = await stagiairesAvecPrecisionChiffree(
    lignes.map((l) => l.enrollment.trainee.id),
  );

  const identite = await getOrganismeIdentite();
  // Instant RÉEL du tirage, le même pour toutes les pièces d'un dossier.
  const tireeLe = formaterInstantParis(new Date());

  for (const ligne of lignes) {
    // `reponduAt` est non nul par le prédicat ; la garde ne sert que le typage.
    if (ligne.reponduAt === null) continue;
    const { trainee, session } = ligne.enrollment;
    const saisieOrganisme = estSaisieOrganisme(ligne.reponses);
    const nomStagiaire = `${trainee.prenom ?? ""} ${trainee.nom ?? ""}`.trim();
    const chemin = `positionnements/${jourParis(session.dateDebut)}_${slug(
      `${trainee.nom ?? ""} ${trainee.prenom ?? ""}`,
    )}_${ligne.id.slice(0, 8)}${saisieOrganisme ? "_saisie-organisme" : ""}.pdf`;

    try {
      const { buffer } = await renderPdfToBuffer(
        React.createElement(PositionnementRempliPdf, {
          data: {
            reference: `POS-${ligne.id.slice(0, 8)}`,
            nomStagiaire: nomStagiaire === "" ? "Stagiaire non nommé" : nomStagiaire,
            intituleFormation: session.titreSession,
            debutSession: formaterInstantParis(session.dateDebut),
            reponduLe: formaterInstantParis(ligne.reponduAt),
            chronologie: chronologieReponse(ligne.reponduAt, session.dateDebut),
            tireeLe,
            positionnement: lirePositionnement(ligne.reponses, {
              detailChiffrePresent: avecDetailChiffre.has(trainee.id),
            }),
          },
          identite,
        }),
      );
      pieces.push({ chemin, buffer, saisieOrganisme });
    } catch (err) {
      echecs.push({
        chemin,
        motif: err instanceof Error ? err.message : String(err),
        saisieOrganisme,
      });
    }
  }

  return { pieces, echecs };
}
