/**
 * Échappement CSV — séparateur, guillemets, ET injection de formule.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Un CSV n'est pas seulement un fichier texte : Excel, LibreOffice et Google
 * Sheets ÉVALUENT tout champ commençant par `=`, `+`, `-` ou `@`. Un visiteur
 * qui écrit `=cmd|' /c calc'!A1` dans un formulaire public fait donc exécuter
 * une commande sur le poste de l'administrateur qui ouvre l'export — sans
 * jamais avoir accédé à quoi que ce soit. C'est la classe « CSV Injection »
 * (OWASP), et elle vise l'ADMIN, pas le site.
 *
 * L'export public de l'observatoire (`api/observatoire/export-csv/route.ts`)
 * neutralisait déjà ce préfixe. L'export des soumissions — celui qui porte les
 * PII et sert de réponse RGPD — ne le faisait pas.
 *
 * LE CAS DU TÉLÉPHONE
 * -------------------
 * Le remède habituel (préfixer d'une apostrophe) a un défaut peu documenté :
 * contrairement à une saisie en cellule, une apostrophe présente dans un
 * FICHIER CSV n'est pas masquée à l'import — elle s'affiche. Appliqué
 * aveuglément, il transformerait chaque `+33 6 …` de la colonne Téléphone en
 * `'+33 6 …`, sur toutes les lignes.
 *
 * On exempte donc les valeurs qui commencent par `+` ou `-` et ne contiennent
 * QUE des chiffres, espaces, points, tirets et parenthèses. L'exemption est
 * sûre par construction : toute charge connue (`cmd|`, `HYPERLINK`, `SUM`,
 * `DDE`, `IMPORTXML`) exige des lettres, qu'aucune valeur exemptée ne peut
 * contenir. `=` n'est jamais exempté : il n'a aucun usage légitime en tête de
 * champ.
 */

/** Caractères que le tableur interprète comme le début d'une formule. */
const PREFIXE_FORMULE = /^[=+\-@\t\r]/;

/**
 * Valeur numérique/téléphonique : signe puis chiffres et séparateurs, aucune
 * lettre. Ne peut porter aucune formule exécutable.
 */
const SIGNE_INOFFENSIF = /^[+-][\d\s().-]+$/;

/** Caractères imposant l'entourage par des guillemets (RFC 4180 + `;` FR). */
const DOIT_ETRE_CITE = /[",;\n\r]/;

/**
 * Échappe une valeur pour un CSV séparé par `;`.
 *
 * `null` / `undefined` → chaîne vide (une case vide, pas le texte « null »).
 */
export function csvEscape(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  if (PREFIXE_FORMULE.test(s) && !SIGNE_INOFFENSIF.test(s)) s = `'${s}`;
  return DOIT_ETRE_CITE.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
