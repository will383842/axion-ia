/**
 * Gabarit « Comparatif » : fonctions pures, côté serveur, sur le titre et le HTML déjà
 * assaini de l'article. Aucune donnée n'est inventée : le face-à-face vient du titre, le
 * tableau est celui de l'article, les coches sont le texte « Oui » / « Non » / « Partiel »
 * déjà présent dans les cellules.
 */

const LONGUEUR_MAX_CAMP = 60;
const SEPARATEUR = /\s+(?:ou|vs\.?|contre|versus)\s+/i;

/** Les deux camps d'un titre « A ou B » (jusqu'au premier « : » ou « ? »), sinon `null`. */
export function extraireDuel(titre: string): { a: string; b: string } | null {
  const debut = titre.split(/[:?]/)[0] ?? "";
  const camps = debut.trim().split(SEPARATEUR);
  if (camps.length !== 2) return null;
  const [a, b] = camps.map((c) => c.trim());
  if (!a || !b || a.length > LONGUEUR_MAX_CAMP || b.length > LONGUEUR_MAX_CAMP) return null;
  return { a, b };
}

const BALISE_TABLE = /<(\/?)table(?=[\s>/])[^>]*>/gi;
const ENVELOPPE_OUVRANTE =
  /<div\b[^>]*\bclass\s*=\s*["'][^"']*\btable-scroll\b[^"']*["'][^>]*>\s*$/i;
const ENVELOPPE_FERMANTE = /^\s*<\/div>/i;

/**
 * Sépare le premier `<table>` (avec ses éventuels tableaux imbriqués) du reste du HTML.
 * L'enveloppe défilante `.table-scroll` qui l'entoure exactement est retirée avec lui : le
 * gabarit pose la sienne.
 */
export function remonterPremierTableau(html: string): { tableau: string; reste: string } | null {
  if (!html) return null;
  let profondeur = 0;
  let debut = -1;
  let fin = -1;
  for (const m of html.matchAll(BALISE_TABLE)) {
    if (m[1] === "") {
      if (profondeur === 0) debut = m.index ?? 0;
      profondeur += 1;
    } else if (profondeur > 0) {
      profondeur -= 1;
      if (profondeur === 0) {
        fin = (m.index ?? 0) + m[0].length;
        break;
      }
    }
  }
  if (debut < 0 || fin < 0) return null;
  const tableau = html.slice(debut, fin);
  let avant = html.slice(0, debut);
  let apres = html.slice(fin);
  const ouv = ENVELOPPE_OUVRANTE.exec(avant);
  const fer = ENVELOPPE_FERMANTE.exec(apres);
  if (ouv && fer) {
    avant = avant.slice(0, ouv.index);
    apres = apres.slice(fer[0].length);
  }
  return { tableau, reste: avant + apres };
}

const VALEURS = { oui: "oui", non: "non", partiel: "partiel" } as const;
const CELLULE = /<td((?:\s[^>]*)?)>([^<]*)<\/td>/gi;

/**
 * Pose `cellule cellule--oui|non|partiel` sur les `<td>` dont le texte est exactement l'un de
 * ces mots (casse et ponctuation finale ignorées). Le texte reste dans le DOM : la coche
 * visuelle est de la CSS, jamais la seule information.
 */
export function marquerCellules(tableau: string): string {
  return tableau.replace(CELLULE, (tout, attrs: string, texte: string) => {
    const mot = texte
      .trim()
      .replace(/[.!\s]+$/u, "")
      .toLowerCase();
    const valeur = (VALEURS as Record<string, string>)[mot];
    if (!valeur) return tout;
    const classe = `cellule cellule--${valeur}`;
    const avecClasse = /\sclass\s*=\s*"([^"]*)"/i.exec(attrs);
    const nouveaux = avecClasse
      ? attrs.replace(avecClasse[0], ` class="${avecClasse[1]} ${classe}"`)
      : ` class="${classe}"${attrs}`;
    return `<td${nouveaux}>${texte}</td>`;
  });
}
