/**
 * Lot L08 — le CONTENU versionné des questionnaires (positionnement, à chaud, à froid).
 * Module PUR — et SANS dépendance serveur : le formulaire du portail (composant
 * client) l'importe. L'empreinte vit à part (`questionnaire-empreinte.ts`).
 *
 * Le versionnage est porté par `Questionnaire.versionId` → `questionnaire_versions`
 * (socle L00), et non par les questions du chantier visio. Une version publiée ne
 * se réécrit jamais : une évolution ajoute une version, et un questionnaire envoyé
 * en v1 se lit toujours avec les questions de la v1.
 *
 *  - positionnement v1 : les questions que le portail pose déjà ;
 *  - à chaud / à froid v1 : l'état antérieur au lot (note globale + commentaire) ;
 *  - à chaud / à froid v2 : s'y ajoutent l'avis par aspect et l'ÉVALUATION DES
 *    ACQUIS PAR OBJECTIF, sur la même échelle 1-3 que le positionnement et
 *    l'évaluation finale — entrée, sortie et suivi à J+30 se superposent.
 *
 * Aucune question sur la précision d'un besoin d'adaptation : c'est une donnée de
 * santé, jamais restituée par ce module (cf. `lecture-positionnement.ts`).
 */

export type TypeQuestionnaire = "positionnement" | "satisfaction_chaud" | "satisfaction_froid";

export type QuestionDef =
  | { readonly id: string; readonly libelle: string; readonly type: "note_globale" }
  | { readonly id: string; readonly libelle: string; readonly type: "note5" }
  | { readonly id: string; readonly libelle: string; readonly type: "texte" }
  | { readonly id: string; readonly libelle: string; readonly type: "oui_non" }
  | {
      readonly id: string;
      readonly libelle: string;
      readonly type: "choix";
      readonly choix: ReadonlyArray<string>;
    }
  /** Une valeur 1-3 par objectif pédagogique : `{ "<objectif>": 1..3 }`. */
  | { readonly id: string; readonly libelle: string; readonly type: "acquis_objectifs" };

export interface ContenuQuestionnaire {
  readonly questions: ReadonlyArray<QuestionDef>;
}

export const FREQUENCES_USAGE: ReadonlyArray<string> = [
  "Jamais",
  "Quelques fois par an",
  "Quelques fois par mois",
  "Chaque semaine",
  "Tous les jours",
];

export const MISE_EN_PRATIQUE: ReadonlyArray<string> = [
  "Régulièrement",
  "De temps en temps",
  "Pas encore",
];

const POSITIONNEMENT_V1: ContenuQuestionnaire = {
  questions: [
    { id: "fonction", libelle: "Votre fonction", type: "texte" },
    { id: "secteur", libelle: "Votre secteur d'activité", type: "texte" },
    { id: "outilsUtilises", libelle: "Les outils d'IA que vous utilisez déjà", type: "texte" },
    {
      id: "frequenceUsage",
      libelle: "À quelle fréquence les utilisez-vous ?",
      type: "choix",
      choix: FREQUENCES_USAGE,
    },
    {
      id: "niveauParObjectif",
      libelle: "Votre niveau de départ, objectif par objectif",
      type: "acquis_objectifs",
    },
    { id: "attentes", libelle: "Vos attentes", type: "texte" },
    { id: "tacheVisee", libelle: "La tâche que vous voulez mieux réaliser", type: "texte" },
    {
      id: "besoinAdaptation",
      libelle: "Avez-vous besoin d'un aménagement pour suivre la formation ?",
      type: "oui_non",
    },
  ],
};

const SATISFACTION_V1: ContenuQuestionnaire = {
  questions: [
    { id: "noteGlobale", libelle: "Votre satisfaction globale", type: "note_globale" },
    { id: "commentaire", libelle: "Votre commentaire", type: "texte" },
  ],
};

const CHAUD_V2: ContenuQuestionnaire = {
  questions: [
    { id: "noteGlobale", libelle: "Votre satisfaction globale", type: "note_globale" },
    {
      id: "noteContenu",
      libelle: "Le contenu de la formation répondait à mes besoins",
      type: "note5",
    },
    { id: "noteFormateur", libelle: "La qualité de l'animation", type: "note5" },
    { id: "noteOrganisation", libelle: "L'organisation (lieu, horaires, matériel)", type: "note5" },
    {
      id: "acquisParObjectif",
      libelle: "Votre niveau à l'issue de la formation, objectif par objectif",
      type: "acquis_objectifs",
    },
    { id: "commentaire", libelle: "Votre commentaire", type: "texte" },
  ],
};

const FROID_V2: ContenuQuestionnaire = {
  questions: [
    {
      id: "noteGlobale",
      libelle: "Votre satisfaction globale, avec du recul",
      type: "note_globale",
    },
    {
      id: "miseEnPratique",
      libelle: "Mettez-vous en pratique ce que vous avez appris ?",
      type: "choix",
      choix: MISE_EN_PRATIQUE,
    },
    {
      id: "acquisParObjectif",
      libelle: "Votre niveau aujourd'hui, objectif par objectif",
      type: "acquis_objectifs",
    },
    { id: "frein", libelle: "Ce qui freine votre mise en pratique", type: "texte" },
    { id: "commentaire", libelle: "Votre commentaire", type: "texte" },
  ],
};

/** L'index + 1 est le numéro de version. On AJOUTE à la fin ; on ne modifie jamais. */
export const CONTENUS_QUESTIONNAIRE: Readonly<
  Record<TypeQuestionnaire, ReadonlyArray<ContenuQuestionnaire>>
> = {
  positionnement: [POSITIONNEMENT_V1],
  satisfaction_chaud: [SATISFACTION_V1, CHAUD_V2],
  satisfaction_froid: [SATISFACTION_V1, FROID_V2],
};

export function versionCourante(type: TypeQuestionnaire): number {
  return CONTENUS_QUESTIONNAIRE[type].length;
}

export function contenuDeLaVersion(
  type: TypeQuestionnaire,
  version: number,
): ContenuQuestionnaire | null {
  if (!Number.isInteger(version) || version < 1) return null;
  return CONTENUS_QUESTIONNAIRE[type][version - 1] ?? null;
}

const TYPES_QUESTION = ["note_globale", "note5", "texte", "oui_non", "choix", "acquis_objectifs"];

/**
 * Relit un contenu stocké (`questionnaire_versions.contenu`, jsonb) : `null` s'il
 * n'a pas la forme attendue. La colonne fait foi sur le code — c'est elle qui a
 * été figée à l'envoi — mais elle ne se lit qu'après avoir été vérifiée.
 */
export function lireContenuStocke(json: unknown): ContenuQuestionnaire | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return null;
  const questions = (json as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  const sortie: QuestionDef[] = [];
  for (const q of questions) {
    if (q === null || typeof q !== "object") return null;
    const o = q as Record<string, unknown>;
    if (typeof o["id"] !== "string" || typeof o["libelle"] !== "string") return null;
    if (typeof o["type"] !== "string" || !TYPES_QUESTION.includes(o["type"])) return null;
    if (o["type"] === "choix") {
      const choix = o["choix"];
      if (!Array.isArray(choix) || !choix.every((c) => typeof c === "string")) return null;
      sortie.push({ id: o["id"], libelle: o["libelle"], type: "choix", choix: choix as string[] });
    } else {
      sortie.push({ id: o["id"], libelle: o["libelle"], type: o["type"] } as QuestionDef);
    }
  }
  return { questions: sortie };
}
