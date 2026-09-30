/**
 * Pièces « satisfaction RÉPONDUE » du dossier d'audit — indicateur 30.
 *
 * 🔴 Constat du dossier ZIP du 2026-09-30 : l'indicateur 30 n'y avait AUCUNE
 * preuve de recueil des appréciations. Le seul document « satisfaction » était
 * le gabarit vierge du registre. Une pièce par questionnaire à chaud / à froid
 * RÉPONDU, sur une session qui a réellement eu lieu, rendue à la volée depuis
 * `Questionnaire.reponses` — sur le modèle exact des positionnements remplis
 * (`positionnement/pieces-remplies.ts`) :
 *   · une saisie par l'organisme (`saisie_admin: true`) n'est PAS une réponse
 *     du stagiaire : sa pièce est nommée et titrée comme telle ;
 *   · droit à l'effacement : seuls le nom et le prénom de la fiche sont lus,
 *     tels qu'en base — une fiche effacée est déjà anonymisée ;
 *   · une valeur chiffrée (`enc:v1:`) n'entre jamais dans une pièce.
 *
 * ⚠️ Un rendu en échec est RAPPORTÉ (`echecs`), jamais avalé : l'appelant le
 * porte en avertissement et déclare le dossier incomplet.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { inscriptionSurSessionTenue } from "@/server/qualiopi/conformite/piece-admissible";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { SatisfactionRempliePdf } from "@/server/qualiopi/documents/templates/satisfaction-remplie";
import {
  estSaisieOrganisme,
  formaterInstantParis,
} from "@/server/qualiopi/positionnement/lecture-positionnement";
import { jourParis, slug } from "@/server/qualiopi/positionnement/pieces-remplies";

export interface PieceSatisfactionRemplie {
  readonly chemin: string;
  readonly buffer: Buffer;
  /** Saisie par l'organisme, et non réponse du stagiaire. */
  readonly saisieOrganisme: boolean;
  readonly moment: "chaud" | "froid";
}

export interface EchecSatisfactionRemplie {
  readonly chemin: string;
  readonly motif: string;
  readonly saisieOrganisme: boolean;
  readonly moment: "chaud" | "froid";
}

/** Questionnaire à chaud ou à froid répondu, sur une session ni annulée ni reportée. */
export function whereSatisfactionRemplie() {
  return {
    type: { in: ["satisfaction_chaud" as const, "satisfaction_froid" as const] },
    reponduAt: { not: null },
    enrollment: inscriptionSurSessionTenue(),
  };
}

/** Texte saisi, ou `null` — jamais une valeur chiffrée. */
function texte(reponses: unknown, cle: string): string | null {
  if (typeof reponses !== "object" || reponses === null || Array.isArray(reponses)) return null;
  const v = (reponses as Record<string, unknown>)[cle];
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "" || t.startsWith("enc:v1:")) return null;
  return t;
}

export async function produirePiecesSatisfactionRemplie(): Promise<{
  pieces: PieceSatisfactionRemplie[];
  echecs: EchecSatisfactionRemplie[];
}> {
  const lignes = await prisma.questionnaire.findMany({
    where: whereSatisfactionRemplie(),
    select: {
      id: true,
      type: true,
      reponduAt: true,
      noteGlobale: true,
      reponses: true,
      enrollment: {
        select: {
          trainee: { select: { nom: true, prenom: true } },
          session: { select: { titreSession: true, dateDebut: true, dateFin: true } },
        },
      },
    },
    orderBy: { reponduAt: "asc" },
  });

  const pieces: PieceSatisfactionRemplie[] = [];
  const echecs: EchecSatisfactionRemplie[] = [];
  if (lignes.length === 0) return { pieces, echecs };

  const identite = await getOrganismeIdentite();
  // Instant RÉEL du tirage, le même pour toutes les pièces d'un dossier.
  const tireeLe = formaterInstantParis(new Date());

  for (const ligne of lignes) {
    if (ligne.reponduAt === null) continue;
    const { trainee, session } = ligne.enrollment;
    const moment: "chaud" | "froid" = ligne.type === "satisfaction_froid" ? "froid" : "chaud";
    const saisieOrganisme = estSaisieOrganisme(ligne.reponses);
    const nomStagiaire = `${trainee.prenom ?? ""} ${trainee.nom ?? ""}`.trim();
    const chemin = `satisfactions/${jourParis(session.dateDebut)}_${slug(
      `${trainee.nom ?? ""} ${trainee.prenom ?? ""}`,
    )}_${ligne.id.slice(0, 8)}_a-${moment}${saisieOrganisme ? "_saisie-organisme" : ""}.pdf`;

    try {
      const { buffer } = await renderPdfToBuffer(
        React.createElement(SatisfactionRempliePdf, {
          data: {
            reference: `SAT-${ligne.id.slice(0, 8)}`,
            moment,
            nomStagiaire: nomStagiaire === "" ? "Stagiaire non nommé" : nomStagiaire,
            intituleFormation: session.titreSession,
            debutSession: formaterInstantParis(session.dateDebut),
            finSession: formaterInstantParis(session.dateFin),
            reponduLe: formaterInstantParis(ligne.reponduAt),
            tireeLe,
            saisieOrganisme,
            noteGlobale: ligne.noteGlobale,
            commentaire: texte(ligne.reponses, "commentaire"),
            objectifsAtteints: texte(ligne.reponses, "objectifs_atteints"),
            pointsForts: texte(ligne.reponses, "points_forts"),
            axesAmelioration: texte(ligne.reponses, "axes_amelioration"),
          },
          identite,
        }),
      );
      pieces.push({ chemin, buffer, saisieOrganisme, moment });
    } catch (err) {
      echecs.push({
        chemin,
        motif: err instanceof Error ? err.message : String(err),
        saisieOrganisme,
        moment,
      });
    }
  }

  return { pieces, echecs };
}
