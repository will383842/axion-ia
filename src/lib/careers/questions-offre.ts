/**
 * L13 (paquet 4a, chantier « candidatures unifiées ») — les questions d'une
 * offre d'emploi SANS JSON : la logique pure du petit éditeur de la console.
 *
 * 🔑 MÊME STOCKAGE, MÊME VALIDATION. L'éditeur ne fait que produire le texte
 * que l'on saisissait à la main dans le champ `screeningQuestions` :
 * `upsertJobOfferAction` le parse comme avant, et le formulaire public le lit
 * par `parseScreeningQuestions`, comme avant.
 *
 * 🔴 LE JSON PRODUIT EST IDENTIQUE À L'ANCIEN pour les mêmes questions. Une
 * question n'est jamais reconstruite champ par champ : l'éditeur modifie
 * l'objet existant clé par clé, si bien que tout ce qu'il ne sait pas montrer
 * (`labelEn`, `court`, `ligne`, `groupe`, `attendus`, ou une clé posée à la
 * main) traverse l'éditeur sans être perdu ni réordonné. La sérialisation est
 * celle de la page d'édition (`JSON.stringify`, compacte).
 *
 * Module pur : testé sans navigateur, et importé seulement par l'éditeur,
 * chargé à la demande (poids de la console).
 */

import type { ScreeningQuestion } from "./screening-answers";

/** Une question telle qu'elle est stockée : les clés connues, et toutes les autres. */
export type QuestionStockee = ScreeningQuestion & Record<string, unknown>;

/**
 * Les types que le formulaire public sait rendre (`ScreeningQuestion.type`).
 * `""` = clé absente = zone de texte libre, comme avant.
 */
export const TYPES_DE_QUESTION = [
  { valeur: "", libelle: "Texte libre (plusieurs lignes)" },
  { valeur: "short", libelle: "Réponse courte (une ligne)" },
  { valeur: "price", libelle: "Prix (un seul montant en euros)" },
] as const;

export type TypeDeQuestion = (typeof TYPES_DE_QUESTION)[number]["valeur"];

export type LectureQuestions =
  { ok: true; questions: QuestionStockee[] } | { ok: false; raison: string };

/**
 * Lit le texte du champ. L'éditeur ne s'ouvre que sur un tableau d'objets qui
 * portent chacun un `id` texte : sur toute autre forme, il REFUSE plutôt que de
 * filtrer (ce que fait `parseScreeningQuestions` côté public) — filtrer ici
 * effacerait en silence ce que l'éditeur n'a pas compris. Le mode avancé reste
 * ouvert pour corriger.
 */
export function lireQuestions(texte: string): LectureQuestions {
  if (texte.trim() === "") return { ok: true, questions: [] };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, raison: "Le JSON n'est pas lisible." };
  }
  if (!Array.isArray(brut)) {
    return { ok: false, raison: "Le JSON doit être une liste de questions ([ … ])." };
  }
  for (const [i, q] of brut.entries()) {
    if (q === null || typeof q !== "object" || Array.isArray(q)) {
      return { ok: false, raison: `L'élément ${i + 1} n'est pas une question.` };
    }
    if (typeof (q as { id?: unknown }).id !== "string") {
      return { ok: false, raison: `La question ${i + 1} n'a pas d'identifiant (« id »).` };
    }
  }
  return { ok: true, questions: brut as QuestionStockee[] };
}

/**
 * Le texte à enregistrer. Liste vide → `[]`, et non `""` (relecture
 * 2026-10-09) : un champ vide n'écrit rien (l'action l'ignore), si bien que
 * supprimer la dernière question laissait les anciennes en base. `[]` dit
 * « aucune question » et s'enregistre. L'éditeur n'écrit qu'à un geste : une
 * offre sans questions qu'on n'y touche pas garde son champ vide.
 */
export function ecrireQuestions(questions: readonly QuestionStockee[]): string {
  return JSON.stringify(questions);
}

/**
 * Un identifiant NEUF, jamais réutilisé (relecture 2026-10-09). Les réponses
 * reçues sont indexées par identifiant : l'ancien `q1`, `q2`… « premier non
 * pris » réattribuait celui d'une question supprimée à la suivante, et ses
 * réponses se seraient rattachées à la mauvaise question. Ici : `q` + instant
 * en base 36 + suffixe aléatoire, en écartant tout identifiant déjà présent.
 * Les identifiants existants ne sont jamais touchés.
 */
export function nouvelIdentifiant(
  questions: readonly QuestionStockee[],
  alea: () => string = suffixeAleatoire,
): string {
  const pris = new Set(questions.map((q) => q.id));
  const instant = Date.now().toString(36);
  let id = `q${instant}${alea()}`;
  while (pris.has(id)) id = `q${instant}${alea()}`;
  return id;
}

function suffixeAleatoire(): string {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const o = c.getRandomValues(new Uint8Array(4));
    return Array.from(o, (b) => b.toString(36).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2, 10);
}

export function ajouterQuestion(questions: readonly QuestionStockee[]): QuestionStockee[] {
  return [...questions, { id: nouvelIdentifiant(questions), labelFr: "", required: false }];
}

export function supprimerQuestion(
  questions: readonly QuestionStockee[],
  index: number,
): QuestionStockee[] {
  return questions.filter((_, i) => i !== index);
}

/** Déplace d'un cran (`-1` monte, `+1` descend). Hors bornes : rien ne bouge. */
export function deplacerQuestion(
  questions: readonly QuestionStockee[],
  index: number,
  sens: -1 | 1,
): QuestionStockee[] {
  const cible = index + sens;
  if (index < 0 || index >= questions.length || cible < 0 || cible >= questions.length) {
    return [...questions];
  }
  const copie = [...questions];
  [copie[index], copie[cible]] = [copie[cible]!, copie[index]!];
  return copie;
}

export type Modification =
  | { champ: "labelFr"; valeur: string }
  | { champ: "type"; valeur: string }
  | { champ: "required"; valeur: boolean };

/**
 * Modifie UNE clé d'UNE question, sans toucher aux autres ni à leur ordre.
 *
 *  - `type` vide → la clé disparaît (zone de texte libre, la forme d'origine) ;
 *  - `required` faux sur une question qui ne portait pas la clé → la clé reste
 *    absente : `false` explicite et clé absente disent la même chose, et
 *    l'ajouter changerait le JSON pour rien.
 */
export function modifierQuestion(
  questions: readonly QuestionStockee[],
  index: number,
  m: Modification,
): QuestionStockee[] {
  return questions.map((q, i) => {
    if (i !== index) return q;
    const copie: QuestionStockee = { ...q };
    if (m.champ === "labelFr") {
      copie.labelFr = m.valeur;
    } else if (m.champ === "type") {
      if (m.valeur === "") delete copie.type;
      else copie.type = m.valeur as NonNullable<ScreeningQuestion["type"]>;
    } else if (m.valeur || "required" in q) {
      copie.required = m.valeur;
    }
    return copie;
  });
}

/** Les clés conservées que l'éditeur ne montre pas — affichées pour mémoire. */
const CLES_EDITEES = new Set(["id", "labelFr", "type", "required"]);
export function clesConservees(q: QuestionStockee): string[] {
  return Object.keys(q).filter((k) => !CLES_EDITEES.has(k));
}

/** Un type posé à la main que l'éditeur ne connaît pas : gardé tel quel, signalé. */
export function typeInconnu(q: QuestionStockee): string | null {
  const t = q.type as unknown;
  if (t === undefined) return null;
  return TYPES_DE_QUESTION.some((x) => x.valeur === t) ? null : String(t);
}
