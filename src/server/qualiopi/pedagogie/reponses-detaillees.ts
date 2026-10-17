/**
 * Lot L08 (O4) — les réponses d'un questionnaire lues QUESTION PAR QUESTION.
 * Module PUR.
 *
 * La console n'affichait que la note globale ; l'auditeur doit pouvoir lire ce
 * que le stagiaire a répondu à chaque question, avec la question telle qu'elle
 * lui a été posée : le contenu est celui de la VERSION envoyée
 * (`Questionnaire.versionId`). Sans version (envoi antérieur au versionnage), on
 * lit avec la version 1 du type, qui décrit l'état d'alors.
 *
 * Ce module ne restitue que ce que le contenu déclare : une clé inconnue du
 * contenu n'est jamais affichée, ce qui exclut par construction la précision de
 * santé (`detailAdaptation*`). Une question sans réponse se lit `null`, jamais 0
 * ni « non ».
 */

import {
  contenuDeLaVersion,
  type ContenuQuestionnaire,
  type TypeQuestionnaire,
} from "./questionnaire-contenu";

export const NIVEAUX_ACQUIS: Readonly<Record<1 | 2 | 3, string>> = {
  1: "Je découvre",
  2: "Quelques notions",
  3: "Je maîtrise",
};

const TEXTE_MAX = 2000;

export interface LigneReponse {
  readonly libelle: string;
  /** `null` : non renseigné. */
  readonly reponse: string | null;
}

export interface ReponseDetaillee {
  readonly id: string;
  readonly libelle: string;
  /** Réponse simple ; `null` si non renseignée ou si la question est « par objectif ». */
  readonly reponse: string | null;
  /** Question « par objectif » : une ligne par objectif de la formation. */
  readonly lignes?: ReadonlyArray<LigneReponse>;
}

function texte(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return null;
  return t.length > TEXTE_MAX ? `${t.slice(0, TEXTE_MAX)}…` : t;
}

function entierEntre(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function objet(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function detaillerReponses(e: {
  type: TypeQuestionnaire;
  contenu: ContenuQuestionnaire | null;
  reponses: unknown;
  noteGlobale: number | null;
  /** Objectifs de la formation, pour les questions « par objectif ». */
  objectifs: ReadonlyArray<string>;
}): ReponseDetaillee[] {
  const contenu = e.contenu ?? contenuDeLaVersion(e.type, 1);
  if (contenu === null) return [];
  const r = objet(e.reponses);

  return contenu.questions.map((q): ReponseDetaillee => {
    const base = { id: q.id, libelle: q.libelle };
    switch (q.type) {
      case "note_globale": {
        const n = entierEntre(e.noteGlobale, 1, 5);
        return { ...base, reponse: n === null ? null : `${n} / 5` };
      }
      case "note5": {
        const n = entierEntre(r[q.id], 1, 5);
        return { ...base, reponse: n === null ? null : `${n} / 5` };
      }
      case "texte":
        return { ...base, reponse: texte(r[q.id]) };
      case "oui_non": {
        const v = r[q.id];
        return { ...base, reponse: typeof v === "boolean" ? (v ? "Oui" : "Non") : null };
      }
      case "choix": {
        const v = texte(r[q.id]);
        return { ...base, reponse: v !== null && q.choix.includes(v) ? v : null };
      }
      case "acquis_objectifs": {
        const valeurs = objet(r[q.id]);
        return {
          ...base,
          reponse: null,
          lignes: e.objectifs.map((libelle) => {
            const n = entierEntre(valeurs[libelle], 1, 3);
            return { libelle, reponse: n === null ? null : NIVEAUX_ACQUIS[n as 1 | 2 | 3] };
          }),
        };
      }
    }
  });
}
