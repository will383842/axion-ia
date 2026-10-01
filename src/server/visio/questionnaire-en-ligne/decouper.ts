/**
 * La « règle des puces » du questionnaire en ligne (2026-10-01, UX §1.3).
 *
 * Will écrit UNE question par ligne, sans formulaire de plus ; la page publique
 * en tire, sans changer le modèle de données :
 *
 *   1. l'AIDE : le texte après le DERNIER « ? » de la ligne
 *      (« …tableaux de bord ? Pour prévoir ce que chacun verra. ») ;
 *   2. les PUCES (choix à toucher) : une parenthèse d'au moins deux éléments
 *      séparés par des virgules (ou par « / », la forme des questions
 *      préparées par P6), OU « : » suivi d'une liste à virgules jusqu'au « ? ».
 *      Les éléments quittent le titre et prennent une majuscule initiale.
 *
 * Sans aide ni liste, la question s'affiche telle quelle. Module PUR : appelé
 * par la page (serveur) — le navigateur reçoit le résultat, pas la règle.
 */

export interface QuestionDecoupee {
  readonly titre: string;
  readonly aide: string | null;
  readonly puces: ReadonlyArray<string>;
}

const majuscule = (s: string): string => s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);

/** Les éléments d'une liste « a, b, c » ou « a / b / c » — `null` s'il y en a moins de deux. */
function elements(liste: string): string[] | null {
  const separateur = liste.includes(",") ? "," : liste.includes(" / ") ? " / " : null;
  if (separateur === null) return null;
  const items = liste
    .split(separateur)
    .map((x) => x.trim())
    .filter((x) => x !== "");
  return items.length >= 2 ? items.map(majuscule) : null;
}

const espaces = (s: string): string =>
  s
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

export function decouperQuestion(ligne: string): QuestionDecoupee {
  const t = ligne.replace(/\s+/g, " ").trim();
  let corps = t;
  let aide: string | null = null;
  const dernier = t.lastIndexOf("?");
  if (dernier >= 0 && dernier < t.length - 1) {
    corps = t.slice(0, dernier + 1).trim();
    aide = t.slice(dernier + 1).trim() || null;
  }

  // Forme P6 : « Question ? (choix / choix) » — la parenthèse finale est la liste.
  if (aide !== null) {
    const p = /^\((.*)\)$/.exec(aide);
    const items = p?.[1] !== undefined ? elements(p[1]) : null;
    if (items) return { titre: corps, aide: null, puces: items };
  }

  // « … (a, b, c) … ? »
  const paren = /\s*\(([^()]*)\)/.exec(corps);
  if (paren?.[1] !== undefined) {
    const items = elements(paren[1]);
    if (items) {
      const titre = espaces(
        corps.slice(0, paren.index) + corps.slice(paren.index + paren[0].length),
      );
      return { titre, aide, puces: items };
    }
  }

  // « … : a, b, c ? »
  const liste = /\s*:\s*([^:?]+)\?$/.exec(corps);
  if (liste?.[1] !== undefined && liste[1].includes(",")) {
    const items = elements(liste[1]);
    if (items) return { titre: `${corps.slice(0, liste.index).trim()} ?`, aide, puces: items };
  }

  return { titre: corps, aide, puces: [] };
}

/**
 * La réponse ENREGISTRÉE pour une question à puces : les puces cochées jointes
 * par « , », puis un retour à la ligne, puis le texte libre (UX §1.3, règle 3).
 */
export function composerReponse(puces: ReadonlyArray<string>, texte: string): string {
  return [puces.join(", "), texte.trim()].filter((x) => x !== "").join("\n");
}
