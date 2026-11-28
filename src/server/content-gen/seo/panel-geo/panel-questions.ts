/**
 * Panel GEO (P11) : liste PROPOSÉE (v1) de 30 questions de dirigeants de TPE et PME françaises.
 * Questions 1 à 24 : intention prestataire (dont 8 par secteur) ; 25 à 30 : informatives.
 * Sans marque, sans année, sans promesse. Identifiants Q01 à Q30 : une fois en ligne, ne jamais en réutiliser un.
 *
 * ⛔ À VALIDER PAR WILL. Cette liste n'est PAS utilisée tant qu'elle n'est pas validée : le panel ne
 * lit que la liste posée dans la console (clé `geo_panel_questions` de `la table de réglages du contenu`, avec
 * `validee: true`). Cette constante sert de point de départ à recopier/éditer, jamais de source
 * d'exécution (`LISTE_PROPOSEE.validee` vaut `false`, verrouillé par test).
 *
 * Sources : questions de `docs/contenu/PLAN-EDITORIAL-365.md`, reformulées comme les poserait un
 * dirigeant à un assistant. Aucun nom de personne, aucune ville, aucun prix.
 */

export interface QuestionPanel {
  /** Identifiant stable (`Q01`…) : la clé de comparaison d'une semaine à l'autre. */
  readonly id: string;
  readonly texte: string;
}

export interface ListeQuestionsPanel {
  readonly version: string;
  readonly validee: boolean;
  readonly questions: ReadonlyArray<QuestionPanel>;
}

export const LISTE_PROPOSEE: ListeQuestionsPanel = {
  version: "v1",
  validee: false, // « à valider par Will »
  questions: [
    "Par où commencer pour introduire l'IA dans une entreprise de moins de cinquante salariés ?",
    "Quel prestataire peut réaliser un audit IA dans une PME française ?",
    "Combien coûte un audit IA pour une petite entreprise et que doit-il contenir ?",
    "Quel organisme propose des formations à l'IA en intra-entreprise pour les PME ?",
    "Comment choisir un organisme de formation à l'IA sérieux pour une PME ?",
    "Quelle formation à l'IA choisir pour des salariés qui n'y connaissent rien ?",
    "Une formation à l'IA pour mes salariés peut-elle être prise en charge par mon OPCO ?",
    "Existe-t-il une formation à l'IA d'une journée, sur place, pour un dirigeant et son équipe ?",
    "Qui peut accompagner un dirigeant de PME, en individuel, pour utiliser l'IA dans son propre travail ?",
    "Formation à l'IA d'une journée dans nos locaux ou formation en ligne : que choisir pour une PME ?",
    "Quel prestataire peut mettre en place des outils d'IA dans une PME et former l'équipe à s'en servir ?",
    "Cabinet de conseil, entreprise de services numériques ou organisme de formation : à qui confier le lancement de l'IA dans une PME ?",
    "Où trouver une formation à l'IA adaptée aux artisans du bâtiment ?",
    "Quelle formation à l'IA pour l'équipe d'un cabinet d'expertise comptable ?",
    "Qui peut installer un assistant IA pour le service client d'une petite entreprise sans perdre le contact humain ?",
    "Qui peut aider une PME à apparaître dans les réponses des assistants IA ?",
    "Formation IA générique ou formation sur nos propres dossiers : quelle différence pour mes équipes ?",
    "Comment former mes équipes à l'IA sans désorganiser la production ?",
    "Quelle formation à l'IA pour un cabinet médical, une pharmacie ou une clinique, dans le respect du secret médical ?",
    "Qui peut former un cabinet d'avocats ou une étude de notaire à l'IA en gardant les dossiers confidentiels ?",
    "Comment un restaurant ou un hôtel peut-il utiliser l'IA, et qui peut former l'équipe ?",
    "Quelle formation à l'IA pour une agence immobilière ?",
    "Qui peut accompagner une PME industrielle ou une entreprise de transport pour utiliser l'IA dans son organisation ?",
    "Quelle formation à l'IA pour un commerce de proximité ou une boutique en ligne ?",
    "Avec cinq salariés, l'IA vaut-elle vraiment le coup pour mon entreprise ?",
    "Comment rédiger une charte d'utilisation de l'IA pour mes salariés ?",
    "Un salarié a collé un fichier clients dans un outil d'IA grand public : que faire tout de suite ?",
    "L'AI Act concerne-t-il une TPE qui se sert simplement d'un assistant IA grand public ?",
    "Que dit le RGPD sur l'usage de l'IA avec des données de clients ?",
    "L'IA peut-elle m'aider à préparer des devis plus vite quand je suis artisan ?",
  ].map((texte, i) => ({ id: `Q${String(i + 1).padStart(2, "0")}`, texte })),
};

export const NB_QUESTIONS_ATTENDUES = 30;
export const LONGUEUR_MAX_QUESTION = 300;

/** Mots interdits dans une question (ville de siège exclue de la communication ; jamais de personne). */
const INTERDITS = /grenoble/i;

/** Vrai si la question est exploitable : texte non vide, borné, sans terme interdit. */
export function questionValide(q: unknown): q is QuestionPanel {
  if (typeof q !== "object" || q === null) return false;
  const { id, texte } = q as Record<string, unknown>;
  return (
    typeof id === "string" &&
    /^[A-Za-z0-9_-]{1,20}$/.test(id) &&
    typeof texte === "string" &&
    texte.trim().length >= 10 &&
    texte.length <= LONGUEUR_MAX_QUESTION &&
    !INTERDITS.test(texte)
  );
}

/**
 * Lit la liste VALIDÉE depuis la valeur de `la table de réglages du contenu["geo_panel_questions"]`. Renvoie
 * `null` (le panel saute) si la valeur est absente, non validée (`validee !== true`), vide, avec une
 * question invalide ou un identifiant en double. Jamais de repli sur `LISTE_PROPOSEE`.
 */
export function listeValidee(valeur: unknown): ListeQuestionsPanel | null {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const v = valeur as Record<string, unknown>;
  if (v["validee"] !== true) return null;
  if (typeof v["version"] !== "string" || !/^[A-Za-z0-9._-]{1,20}$/.test(v["version"])) return null;
  const questions = v["questions"];
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 100) return null;
  if (!questions.every(questionValide)) return null;
  const ids = new Set(questions.map((q) => q.id));
  if (ids.size !== questions.length) return null;
  return {
    version: v["version"],
    validee: true,
    questions: questions.map((q) => ({ id: q.id, texte: q.texte.trim() })),
  };
}
