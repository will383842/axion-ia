/**
 * `lire_reponses` — les réponses d'un client à un questionnaire de cadrage,
 * rangées en FAITS PROPOSÉS (chantier visio, PR 7 ; `compte-rendu-et-extraction.md` §5.7).
 *
 * Will colle la réponse du client SOUS chaque question (page du projet, vue
 * « Questionnaire »). L'IA ne fait que dire quel passage répond, et le CODE
 * vérifie :
 *
 *   · la citation est retrouvée MOT POUR MOT dans la réponse de CETTE question
 *     (même normalisation que G1) — une citation prise sous une autre question
 *     est rejetée : chaque fait est rangé sous SA question ;
 *   · une valeur (nombre, date) n'est gardée que si elle se lit dans la
 *     citation — G4 lui-même (`verifierValeurs`), pas une copie ;
 *   · le type visé est celui de la question, jamais un type interdit.
 *
 * Chaque fait produit porte `questionnaireQuestionId` (CHECK
 * `faits_reponse_a_sa_question`) et part PROPOSÉ : Will le valide, et c'est à
 * la validation que la question ouverte d'origine passe « répondue ».
 *
 * Module PUR.
 */

import type { FaitType } from "../../../../prisma/generated/client";
import type { LectureReponsesV1 } from "../schemas/autres";
import { compterMots, normaliserPourCitation } from "../verification/g01-citation";
import { verifierValeurs, type ValeurAVerifier } from "../verification/g04-valeurs";
import { neutraliserDonnees, normaliserCle } from "../verification/regles";
import { TYPES_INTERDITS_QUESTIONNAIRE } from "./p6-questionnaire";

export const MOTS_MAX_REPONSE_CITEE = 60;

export interface QuestionAvecReponse {
  readonly id: string;
  readonly ordre: number;
  /** Texte DÉCHIFFRÉ. */
  readonly texte: string;
  /** Réponse collée par Will, DÉCHIFFRÉE, ou `null`. */
  readonly reponse: string | null;
  readonly typeVise: FaitType;
  readonly cleVisee: string | null;
}

export interface FaitDeReponse {
  readonly questionId: string;
  readonly type: FaitType;
  readonly cle: string;
  readonly enonce: string;
  readonly citation: string;
  readonly quantite: number | null;
  readonly dateCible: string | null;
  readonly texteCourt: string | null;
  readonly confiance: "haute" | "moyenne" | "faible";
}

export interface BilanLecture {
  readonly faits: ReadonlyArray<FaitDeReponse>;
  readonly rejetees: number;
}

const refDe = (q: { readonly ordre: number }): string => `Q${q.ordre}`;

/** G17 (règle commune `neutraliserDonnees`). */
const neutraliser = neutraliserDonnees;

/** L'entrée de la passe : chaque question et la réponse collée sous elle. */
export function construireEntreeLecture(questions: ReadonlyArray<QuestionAvecReponse>): string {
  return questions
    .map((q) =>
      [
        `<question id="${refDe(q)}">${neutraliser(q.texte)}</question>`,
        `<reponse id="${refDe(q)}">${q.reponse === null ? "(pas de réponse)" : neutraliser(q.reponse)}</reponse>`,
      ].join("\n"),
    )
    .join("\n\n");
}

/** La citation se lit-elle, mot pour mot, dans la réponse ? */
export function citationDansLaReponse(citation: string, reponse: string): boolean {
  const c = normaliserPourCitation(citation);
  if (c === "") return false;
  return ` ${normaliserPourCitation(reponse)} `.includes(` ${c} `);
}

/**
 * G4, le MÊME contrôle que pour les faits d'un compte rendu (`verifierValeurs`),
 * appliqué séparément à la quantité et à la date : l'une peut être prouvée sans
 * l'autre. La date se RECALCULE depuis la citation, à partir du jour où la
 * réponse a été reçue ; celle de l'IA n'est gardée que si elle coïncide.
 */
function quantiteLue(valeur: number | null, citation: string, recueLe: Date): number | null {
  if (valeur === null || !Number.isInteger(valeur)) return null;
  const v = verifierValeurs({ ...SANS_VALEUR, quantite: valeur }, [citation], recueLe);
  return v.ok ? valeur : null;
}

function dateLue(valeur: string | null, citation: string, recueLe: Date): string | null {
  if (valeur === null) return null;
  const v = verifierValeurs(
    { ...SANS_VALEUR, date_cible: valeur, expression_temporelle: citation },
    [citation],
    recueLe,
  );
  return v.ok && v.date !== null ? v.date.date : null;
}

const SANS_VALEUR: ValeurAVerifier = {
  montant_min_cents: null,
  montant_max_cents: null,
  quantite: null,
  date_cible: null,
  expression_temporelle: null,
};

/** Vérifie la lecture : rend les faits proposés (un par réponse prouvée). */
export function verifierLecture(
  sortie: LectureReponsesV1,
  questions: ReadonlyArray<QuestionAvecReponse>,
  /** Le jour où la réponse a été reçue : le repère des dates relatives (G4). */
  recueLe: Date,
): BilanLecture {
  const parRef = new Map(questions.map((q) => [refDe(q), q]));
  const faits: FaitDeReponse[] = [];
  const dejaVues = new Set<string>();
  let rejetees = 0;
  for (const r of sortie.reponses) {
    const q = parRef.get(r.question_id.trim());
    const mots = compterMots(r.reponse_citee);
    if (
      q === undefined ||
      q.reponse === null ||
      dejaVues.has(q.id) ||
      TYPES_INTERDITS_QUESTIONNAIRE.has(q.typeVise) ||
      mots < 1 ||
      mots > MOTS_MAX_REPONSE_CITEE ||
      !citationDansLaReponse(r.reponse_citee, q.reponse)
    ) {
      rejetees += 1;
      continue;
    }
    dejaVues.add(q.id);
    const quantite = quantiteLue(r.valeur_nombre, r.reponse_citee, recueLe);
    const dateCible = dateLue(r.valeur_date, r.reponse_citee, recueLe);
    const texteCourt = r.valeur_texte?.trim() ? r.valeur_texte.trim().slice(0, 200) : null;
    faits.push({
      questionId: q.id,
      type: q.typeVise,
      cle: normaliserCle(q.typeVise, q.cleVisee ?? "global", null),
      enonce: `Réponse au questionnaire : ${texteCourt ?? r.reponse_citee.trim()}`.slice(0, 500),
      citation: r.reponse_citee.trim(),
      quantite,
      dateCible,
      texteCourt,
      confiance: r.confiance,
    });
  }
  return { faits, rejetees };
}
