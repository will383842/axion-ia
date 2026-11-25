/**
 * Types de contenu autorisés à passer par Claude (variable `CONTENT_GEN_CLAUDE_TYPES`).
 *
 * Module PUR (aucune base, aucun Redis) : le routeur, le registre de coût et le
 * worker le partagent. La valeur est relue à CHAQUE appel, comme l'interrupteur
 * `CONTENT_GEN_BLOG_CLAUDE` (qui reste l'interrupteur général : éteint, rien ne passe).
 *
 * Valeurs :
 *  - absente / vide / `blog` : les 4 types blog (comportement d'avant) ;
 *  - `tous` : tous les types de l'énumération `ContentType` ;
 *  - liste séparée par des virgules (`blog` y est admis comme raccourci) : seuls les
 *    types connus sont retenus ; un type inconnu est IGNORÉ avec un avertissement.
 *    Une liste dont aucun élément n'est connu rend l'ensemble VIDE (rien ne passe
 *    par Claude : on échoue du côté sûr, jamais vers « tous »).
 */

import { ContentType } from "../../../../prisma/generated/client";

/** Les 4 types blog : valeur par défaut de la variable. */
export const BLOG_TYPES: ReadonlySet<string> = new Set([
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "blog_from_rss",
]);

/** Énumération des types existants (source : schéma Prisma). */
export function tousLesTypes(): ReadonlySet<string> {
  return new Set(Object.values(ContentType) as string[]);
}

export function lireTypesClaude(
  brut: string | undefined,
  avertir: (message: string) => void = (m) => console.warn(m),
): ReadonlySet<string> {
  const valeur = (brut ?? "").trim().toLowerCase();
  if (valeur === "" || valeur === "blog") return BLOG_TYPES;
  if (valeur === "tous") return tousLesTypes();

  const connus = tousLesTypes();
  const retenus = new Set<string>();
  for (const morceau of valeur.split(",")) {
    const nom = morceau.trim();
    if (nom === "") continue;
    if (nom === "blog") {
      for (const t of BLOG_TYPES) retenus.add(t);
    } else if (connus.has(nom)) {
      retenus.add(nom);
    } else {
      avertir(`[content-gen] CONTENT_GEN_CLAUDE_TYPES : type inconnu ignoré (${nom})`);
    }
  }
  return retenus;
}

/** Types autorisés selon la variable d'environnement courante. */
export function typesClaudeAutorises(): ReadonlySet<string> {
  return lireTypesClaude(process.env["CONTENT_GEN_CLAUDE_TYPES"]);
}

/** Vrai si ce type de contenu est autorisé à passer par Claude. */
export function typeClaudeAutorise(contentType: string): boolean {
  return typesClaudeAutorises().has(contentType);
}
