/**
 * Pièces « évaluation finale RÉALISÉE » du dossier d'audit — indicateur 11.
 *
 * 🔴 Constat du dossier ZIP du 2026-09-30 : l'indicateur 11 n'y était prouvé
 * que par la grille d'évaluation du registre, qui reste un formulaire quand
 * elle a été tirée avant l'évaluation. Une pièce par évaluation FINALE
 * enregistrée (`EvaluationAcquis`), d'une inscription sur une session qui a
 * réellement eu lieu, rendue à la volée — sur le modèle des positionnements
 * remplis (`positionnement/pieces-remplies.ts`).
 *
 * Droit à l'effacement : seuls le nom et le prénom de la fiche sont lus, tels
 * qu'en base — une fiche effacée est déjà anonymisée.
 *
 * ⚠️ Les évaluations d'un parcours 1-to-1 (coaching, sans inscription) ne sont
 * pas couvertes ici : elles n'ont ni session ni stagiaire par inscription.
 *
 * ⚠️ Un rendu en échec est RAPPORTÉ (`echecs`), jamais avalé.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { inscriptionSurSessionTenue } from "@/server/qualiopi/conformite/piece-admissible";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import {
  EvaluationRealiseePdf,
  type CompetenceEvaluee,
} from "@/server/qualiopi/documents/templates/evaluation-realisee";
import { formaterInstantParis } from "@/server/qualiopi/positionnement/lecture-positionnement";
import { jourParis, slug } from "@/server/qualiopi/positionnement/pieces-remplies";

export interface PieceEvaluationRealisee {
  readonly chemin: string;
  readonly buffer: Buffer;
}

export interface EchecEvaluationRealisee {
  readonly chemin: string;
  readonly motif: string;
}

/** Évaluation finale d'une inscription dont la session n'est ni annulée ni reportée. */
export function whereEvaluationRealisee() {
  return {
    type: "finale" as const,
    enrollment: inscriptionSurSessionTenue(),
  };
}

/** Compétences lisibles du JSON enregistré — une entrée sans libellé est ignorée. */
function lireCompetences(brut: unknown): CompetenceEvaluee[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((c): CompetenceEvaluee[] => {
    if (c === null || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    const libelle = typeof o["libelle"] === "string" ? o["libelle"].trim() : "";
    if (libelle === "") return [];
    const note = o["note"];
    const observations = o["observations"];
    return [
      {
        libelle,
        ...(note === 1 || note === 2 || note === 3 ? { note } : {}),
        ...(typeof observations === "string" && observations.trim() !== ""
          ? { observations: observations.trim() }
          : {}),
      },
    ];
  });
}

export async function produirePiecesEvaluationRealisee(): Promise<{
  pieces: PieceEvaluationRealisee[];
  echecs: EchecEvaluationRealisee[];
}> {
  const lignes = await prisma.evaluationAcquis.findMany({
    where: whereEvaluationRealisee(),
    select: {
      id: true,
      dateEvaluation: true,
      scoreObtenu: true,
      scoreMax: true,
      scorePct: true,
      niveauGlobal: true,
      reussite: true,
      competences: true,
      recommandations: true,
      enrollment: {
        select: {
          trainee: { select: { nom: true, prenom: true } },
          session: { select: { titreSession: true, dateDebut: true } },
        },
      },
    },
    orderBy: { dateEvaluation: "asc" },
  });

  const pieces: PieceEvaluationRealisee[] = [];
  const echecs: EchecEvaluationRealisee[] = [];
  if (lignes.length === 0) return { pieces, echecs };

  const identite = await getOrganismeIdentite();
  const tireeLe = formaterInstantParis(new Date());

  for (const ligne of lignes) {
    // `enrollment` est non nul par le prédicat ; la garde ne sert que le typage.
    if (ligne.enrollment === null) continue;
    const { trainee, session } = ligne.enrollment;
    const nomStagiaire = `${trainee.prenom ?? ""} ${trainee.nom ?? ""}`.trim();
    const chemin = `evaluations/${jourParis(session.dateDebut)}_${slug(
      `${trainee.nom ?? ""} ${trainee.prenom ?? ""}`,
    )}_${ligne.id.slice(0, 8)}.pdf`;
    const recommandations =
      typeof ligne.recommandations === "string" && ligne.recommandations.trim() !== ""
        ? ligne.recommandations.trim()
        : null;

    try {
      const { buffer } = await renderPdfToBuffer(
        React.createElement(EvaluationRealiseePdf, {
          data: {
            reference: `EVA-${ligne.id.slice(0, 8)}`,
            nomStagiaire: nomStagiaire === "" ? "Stagiaire non nommé" : nomStagiaire,
            intituleFormation: session.titreSession,
            evalueeLe: formaterInstantParis(ligne.dateEvaluation),
            tireeLe,
            scoreObtenu: ligne.scoreObtenu,
            scoreMax: ligne.scoreMax,
            scorePct: ligne.scorePct,
            niveauGlobal: ligne.niveauGlobal,
            reussite: ligne.reussite,
            competences: lireCompetences(ligne.competences),
            recommandations,
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
