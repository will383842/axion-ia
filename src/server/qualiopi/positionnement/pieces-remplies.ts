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
  formaterInstantParis,
  lirePositionnement,
} from "./lecture-positionnement";

export interface PiecePositionnementRempli {
  readonly chemin: string;
  readonly buffer: Buffer;
}

export interface EchecPositionnementRempli {
  readonly chemin: string;
  readonly motif: string;
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

export async function compterPositionnementsRemplis(): Promise<number> {
  return prisma.questionnaire.count({ where: wherePositionnementRempli() });
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
          trainee: { select: { nom: true, prenom: true } },
          session: { select: { titreSession: true, dateDebut: true } },
        },
      },
    },
    orderBy: { reponduAt: "asc" },
  });

  const pieces: PiecePositionnementRempli[] = [];
  const echecs: EchecPositionnementRempli[] = [];
  if (lignes.length === 0) return { pieces, echecs };

  const identite = await getOrganismeIdentite();
  // Instant RÉEL du tirage, le même pour toutes les pièces d'un dossier.
  const tireeLe = formaterInstantParis(new Date());

  for (const ligne of lignes) {
    // `reponduAt` est non nul par le prédicat ; la garde ne sert que le typage.
    if (ligne.reponduAt === null) continue;
    const { trainee, session } = ligne.enrollment;
    const nomStagiaire = `${trainee.prenom ?? ""} ${trainee.nom ?? ""}`.trim();
    const chemin = `positionnements/${jourParis(session.dateDebut)}_${slug(
      `${trainee.nom ?? ""} ${trainee.prenom ?? ""}`,
    )}_${ligne.id.slice(0, 8)}.pdf`;

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
            positionnement: lirePositionnement(ligne.reponses),
          },
          identite,
        }),
      );
      pieces.push({ chemin, buffer });
    } catch (err) {
      echecs.push({ chemin, motif: err instanceof Error ? err.message : String(err) });
    }
  }

  return { pieces, echecs };
}
