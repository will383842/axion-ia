/**
 * Sections NOMINATIVES complémentaires du dossier d'audit ZIP — constat du
 * dossier remis le 2026-09-30 :
 *
 *   - `satisfactions/` — questionnaires à chaud / à froid RÉPONDUS (ind. 30).
 *     Le dossier n'avait aucune preuve de recueil des appréciations ;
 *   - `evaluations/`   — évaluations finales RÉALISÉES, résultat par stagiaire
 *     (ind. 11). Le dossier n'avait que la grille, sans résultat.
 *
 * Même contrat que `positionnements/` dans `audit-dossier.ts` : une ligne
 * d'en-tête qui compte, une ligne `[OK]` par pièce jointe, une ligne `[OMIS]`
 * par rendu en échec, et tout trou rend le dossier INCOMPLET (avertissement).
 *
 * Tenu hors de `audit-dossier.ts` pour que l'appel y reste une boucle de trois
 * lignes.
 */

import type JSZip from "jszip";
import { produirePiecesSatisfactionRemplie } from "@/server/qualiopi/satisfaction/pieces-remplies";
import { produirePiecesEvaluationRealisee } from "@/server/qualiopi/evaluations/pieces-realisees";

interface Piece {
  readonly chemin: string;
  readonly buffer: Buffer;
}

interface Echec {
  readonly chemin: string;
  readonly motif: string;
}

interface SectionNominative<P extends Piece, E extends Echec> {
  readonly dossier: string;
  readonly produire: () => Promise<{ pieces: P[]; echecs: E[] }>;
  /** Lignes d'en-tête de la section dans `index.txt`. */
  readonly entete: (pieces: readonly P[], echecs: readonly E[]) => string[];
  readonly avertissementEchecs: (n: number) => string;
  readonly avertissementLecture: string;
}

const s = (n: number): string => (n > 1 ? "s" : "");

const SATISFACTIONS: SectionNominative<
  Awaited<ReturnType<typeof produirePiecesSatisfactionRemplie>>["pieces"][number],
  Awaited<ReturnType<typeof produirePiecesSatisfactionRemplie>>["echecs"][number]
> = {
  dossier: "satisfactions/",
  produire: produirePiecesSatisfactionRemplie,
  entete: (pieces, echecs) => {
    const toutes = [...pieces, ...echecs];
    const chaud = toutes.filter((p) => p.moment === "chaud").length;
    const froid = toutes.length - chaud;
    const organisme = toutes.filter((p) => p.saisieOrganisme).length;
    const lignes = [
      `Satisfactions (ind. 30) : ${chaud} à chaud, ${froid} à froid${
        organisme > 0 ? `, dont ${organisme} saisi${s(organisme)} par l'organisme` : ""
      } → satisfactions/`,
    ];
    if (toutes.length === 0) {
      lignes.push(
        "  Aucun questionnaire de satisfaction répondu. Le gabarit vierge (preuves/satisfaction/) ne tient pas lieu de réponse ; le recueil des autres parties prenantes est au registre des appréciations (registres/).",
      );
    }
    return lignes;
  },
  avertissementEchecs: (n) =>
    `⚠️ ${n} questionnaire${s(n)} de satisfaction répondu${s(n)} absent${s(n)} du dossier (erreur de rendu) — les appréciations recueillies (indicateur 30) ne sont pas toutes jointes.`,
  avertissementLecture:
    "⚠️ Questionnaires de satisfaction répondus absents du dossier (lecture impossible) — les appréciations recueillies (indicateur 30) ne sont pas jointes.",
};

const EVALUATIONS: SectionNominative<
  Awaited<ReturnType<typeof produirePiecesEvaluationRealisee>>["pieces"][number],
  Awaited<ReturnType<typeof produirePiecesEvaluationRealisee>>["echecs"][number]
> = {
  dossier: "evaluations/",
  produire: produirePiecesEvaluationRealisee,
  entete: (pieces, echecs) => {
    const n = pieces.length + echecs.length;
    const lignes = [`Évaluations finales réalisées (ind. 11) : ${n} → evaluations/`];
    if (n === 0) {
      lignes.push(
        "  Aucune évaluation finale enregistrée. La grille (preuves/grille_evaluation/) ne tient pas lieu de résultat.",
      );
    }
    return lignes;
  },
  avertissementEchecs: (n) =>
    `⚠️ ${n} évaluation${s(n)} finale${s(n)} absente${s(n)} du dossier (erreur de rendu) — les résultats des stagiaires (indicateur 11) ne sont pas tous joints.`,
  avertissementLecture:
    "⚠️ Évaluations finales absentes du dossier (lecture impossible) — les résultats des stagiaires (indicateur 11) ne sont pas joints.",
};

async function joindreSection<P extends Piece, E extends Echec>(
  section: SectionNominative<P, E>,
  zip: JSZip,
  indexLines: string[],
  avertissements: string[],
): Promise<{ nbInclus: number; nbOmis: number }> {
  indexLines.push("");
  try {
    const { pieces, echecs } = await section.produire();
    indexLines.push(...section.entete(pieces, echecs));
    for (const piece of pieces) {
      zip.file(piece.chemin, piece.buffer);
      indexLines.push(`[OK]  ${piece.chemin}  (${piece.buffer.byteLength} octets)`);
    }
    for (const echec of echecs) {
      indexLines.push(`[OMIS] ${echec.chemin} — erreur de rendu (${echec.motif})`);
    }
    if (echecs.length > 0) avertissements.push(section.avertissementEchecs(echecs.length));
    return { nbInclus: pieces.length, nbOmis: echecs.length };
  } catch (err) {
    indexLines.push(
      `[OMIS] ${section.dossier} — lecture impossible (${err instanceof Error ? err.message : String(err)})`,
    );
    avertissements.push(section.avertissementLecture);
    return { nbInclus: 0, nbOmis: 1 };
  }
}

/**
 * Joint au ZIP les sections `satisfactions/` puis `evaluations/`, écrit leurs
 * lignes dans l'index et leurs trous dans les avertissements.
 */
export async function joindrePiecesNominativesComplementaires(
  zip: JSZip,
  indexLines: string[],
  avertissements: string[],
): Promise<{ nbInclus: number; nbOmis: number }> {
  const a = await joindreSection(SATISFACTIONS, zip, indexLines, avertissements);
  const b = await joindreSection(EVALUATIONS, zip, indexLines, avertissements);
  return { nbInclus: a.nbInclus + b.nbInclus, nbOmis: a.nbOmis + b.nbOmis };
}
