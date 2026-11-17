/**
 * Détection des salutations qui insèrent une variable dans un « Bonjour ».
 *
 * Module de TEST (aucun import serveur, aucun effet de bord). Il est utilisé par
 * `salutation-jamais-par-nom-complet-toutes-formes.spec.tsx`, qui le teste
 * d'abord lui-même (« test du test »).
 *
 * Formes reconnues après un mot de salutation (Bonjour, Bonsoir, Hello, Hi,
 * Dear, Cher, Chère), séparé d'au plus 3 caractères :
 *   1. gabarit de chaîne       Bonjour ${p.nom}
 *   2. JSX                     Bonjour {p.nom}
 *   3. JSX conditionnel        Bonjour{p.nom ? ` ${p.nom}` : ""}
 *   4. concaténation           "Bonjour " + nom   (guillemets simples aussi)
 *   5. marque de modèle        Bonjour {prenom}
 *   6. marque à double accolade Bonjour {{nom}}
 *
 * Variable tolérée : le dernier identifiant de l'expression est `prenom`,
 * `firstName`, `givenName`, ou se termine par `Prenom` (sans `PrenomNom`) ; ou
 * l'expression appelle `salutation(`.
 */

export interface SalutationTrouvee {
  /** Le mot de salutation et l'expression insérée, tels qu'écrits. */
  readonly extrait: string;
  /** Le dernier identifiant de l'expression (celui qui désigne la valeur). */
  readonly variable: string;
  /** Vrai si la variable est tolérée (prénom seul, ou appel à `salutation(`). */
  readonly toleree: boolean;
}

const MOT = "(?<![\\p{L}])(?:Bonjour|Bonsoir|Hello|Hi|Dear|Cher|Chère)(?![\\p{L}])";
/** Au plus 3 caractères (hors saut de ligne) entre le mot et la variable. */
const ENTRE = ".{0,3}?";
const DEBUT_VARIABLE = "(\\$\\{|\\{\\{|\\{|[\"']\\s*\\+\\s*)";

const MOTIF = new RegExp(`${MOT}${ENTRE}${DEBUT_VARIABLE}`, "gu");

/** Lit une expression entre accolades (imbriquées) à partir de `debut` (après l'accolade ouvrante). */
function lireEntreAccolades(source: string, debut: number): string {
  let profondeur = 1;
  let i = debut;
  while (i < source.length && profondeur > 0) {
    const c = source[i];
    if (c === "{") profondeur += 1;
    else if (c === "}") profondeur -= 1;
    i += 1;
  }
  return source.slice(debut, profondeur === 0 ? i - 1 : i);
}

/** Lit une expression de concaténation : jusqu'à `;`, `,` hors parenthèses, `)` non ouvrante ou fin de ligne. */
function lireConcatenation(source: string, debut: number): string {
  let profondeur = 0;
  let i = debut;
  for (; i < source.length; i += 1) {
    const c = source[i];
    if (c === "\n" || c === ";") break;
    if (c === "(") profondeur += 1;
    else if (c === ")") {
      if (profondeur === 0) break;
      profondeur -= 1;
    } else if (c === "," && profondeur === 0) break;
  }
  return source.slice(debut, i);
}

/** Ne garde que le code : retire le texte des chaînes, garde les `${…}` des gabarits. */
function codeSeul(expression: string): string {
  return expression
    .replace(/`([^`]*)`/g, (_m, dedans: string) => (dedans.match(/\$\{[^}]*\}/g) ?? []).join(" "))
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/\.\s*[A-Za-z_$][\w$]*\s*\(\s*\)/g, " "); // `.trim()` : méthode sans argument
}

function identifiants(expression: string): string[] {
  return codeSeul(expression).match(/[A-Za-z_$][\w$]*/g) ?? [];
}

function estPrenom(id: string): boolean {
  if (/^(prenom|firstName|givenName)$/i.test(id)) return true;
  return /Prenom$/.test(id) && !/PrenomNom/.test(id);
}

/** Toutes les salutations qui insèrent une variable, tolérées ou non. */
export function trouverSalutations(source: string): SalutationTrouvee[] {
  const trouvees: SalutationTrouvee[] = [];
  for (const m of source.matchAll(MOTIF)) {
    const debut = m.index ?? 0;
    const ouverture = m[1] ?? "";
    const apres = debut + m[0].length;
    const expression =
      ouverture.startsWith("$") || ouverture.startsWith("{")
        ? lireEntreAccolades(source, apres)
        : lireConcatenation(source, apres);
    const ids = identifiants(expression);
    const variable = ids[ids.length - 1] ?? "";
    const toleree =
      /\bsalutation\s*\(/.test(expression) || (variable !== "" && estPrenom(variable));
    trouvees.push({ extrait: source.slice(debut, apres) + expression, variable, toleree });
  }
  return trouvees;
}

/** Les seules salutations fautives (variable non tolérée). */
export function trouverSalutationsFautives(source: string): SalutationTrouvee[] {
  return trouverSalutations(source).filter((s) => !s.toleree);
}

/** Motif du volet B : une salutation suivie du nom de famille sentinelle. */
export const MOTIF_RENDU_FAUTIF =
  /(?:Bonjour|Bonsoir|Hello|Hi|Dear|Cher|Chère)(?![\p{L}])[^.!?\n]{0,30}Sentinelle/u;

export const NOM_COMPLET_SENTINELLE = "Zoé Sentinelle";
export const PRENOM_SENTINELLE = "Zoé";

/** Charge d'essai : toute clé « nom » sans « prénom » vaut le nom complet sentinelle. */
export function surchargerNoms(base: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const sortie: Record<string, unknown> = { ...base };
  for (const [cle, valeur] of Object.entries(base)) {
    if (typeof valeur !== "string") continue;
    if (/prenom|first/i.test(cle)) sortie[cle] = PRENOM_SENTINELLE;
    else if (/nom|name/i.test(cle)) sortie[cle] = NOM_COMPLET_SENTINELLE;
  }
  return sortie;
}
