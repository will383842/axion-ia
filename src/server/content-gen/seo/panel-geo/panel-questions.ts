/**
 * Panel GEO (P11) : liste PROPOSÉE de 30 questions de dirigeants de TPE et PME françaises.
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
  version: "v0-proposee",
  validee: false, // « à valider par Will »
  questions: [
    "Avec cinq salariés, l'IA vaut-elle vraiment le coup pour mon entreprise ?",
    "Quelles tâches de dirigeant puis-je confier à l'IA dès cette semaine ?",
    "Dans une PME de vingt personnes, à quoi ressemble une semaine de travail avec l'IA ?",
    "Peut-on automatiser les notes de frais avec l'IA dans une petite entreprise ?",
    "Faut-il changer nos ordinateurs pour utiliser l'IA ?",
    "Combien de temps faut-il à un salarié pour être à l'aise avec l'IA ?",
    "Combien d'heures par semaine l'IA peut-elle faire gagner à une PME ?",
    "Comment rédiger une charte d'utilisation de l'IA pour mes salariés ?",
    "Un salarié a collé un fichier clients dans ChatGPT : que faire tout de suite ?",
    "Un salarié refuse d'utiliser l'IA : puis-je l'y obliger ?",
    "Qui est responsable quand un document préparé avec l'IA contient une erreur ?",
    "L'AI Act concerne-t-il une TPE qui utilise simplement ChatGPT ?",
    "Que dit le RGPD sur l'usage de l'IA avec des données de clients ?",
    "Quelles bases de sécurité informatique mettre en place avant de déployer l'IA ?",
    "Un assistant IA généraliste ou un outil propre à mon métier : que choisir ?",
    "Formation IA générique ou formation sur nos propres dossiers : quelle différence pour mes équipes ?",
    "Comment répondre aux avis Google avec l'IA sans paraître automatique ?",
    "L'IA peut-elle m'aider à préparer des devis plus vite quand je suis artisan ?",
    "L'IA peut-elle m'aider à répondre à un appel d'offres public ?",
    "Mes fichiers sont en désordre : est-ce que cela empêche d'utiliser l'IA ?",
    "L'IA peut-elle construire un planning d'équipe plus juste et plus rapide ?",
    "Comment l'IA peut-elle m'aider à repérer que je paie trop cher un fournisseur ?",
    "Quelle formation à l'IA choisir pour mes salariés et comment la financer ?",
    "Comment choisir un organisme de formation à l'IA sérieux pour une PME ?",
    "Les TPE utilisent-elles moins l'IA que les PME ? Quels sont les chiffres ?",
    "Comment l'IA peut-elle aider à rédiger une demande de subvention ?",
    "Que peut faire l'IA pour le service client d'une petite entreprise sans perdre le contact humain ?",
    "Comment former mes équipes à l'IA sans bloquer la production pendant une journée ?",
    "Quels sont les risques de confidentialité à connaître avant de confier des documents à une IA ?",
    "Par où commencer pour introduire l'IA dans mon entreprise de moins de cinquante salariés ?",
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
