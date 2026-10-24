/**
 * EXTERNAL LINKS — Pertinence d'une source par rapport au sujet d'un article.
 *
 * Audit blog/RAG du 24/10/2026 : le bloc « Sources » était identique pour tous les
 * articles (le catalogue ignorait le sujet). Ces fonctions PURES (aucun import
 * serveur, aucune base) servent au score de `selectExternalLinks` et de sa copie
 * testable `selectExternalLinksPure`.
 */

import type { ExternalLink } from "./types";

/** Mots trop courants dans ce blog pour prouver une proximité de sujet. */
const MOTS_VIDES = new Set([
  "est",
  "par",
  "pas",
  "ses",
  "son",
  "vos",
  "nos",
  "ces",
  "mes",
  "the",
  "and",
  "pour",
  "avec",
  "dans",
  "sans",
  "sur",
  "des",
  "les",
  "une",
  "aux",
  "que",
  "qui",
  "quoi",
  "comment",
  "pourquoi",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "entreprise",
  "entreprises",
  "france",
  "francais",
  "guide",
  "complet",
  "meilleur",
  "meilleurs",
  "intelligence",
  "artificielle",
  "tpe",
  "pme",
  "formation",
  "audit",
  "cabinet",
  "agence",
]);

/**
 * Mots vides pour les articles liés : seulement la langue courante. Contrairement à
 * `MOTS_VIDES` (pensé pour les sources), on garde ici formation, audit, pme, tpe,
 * intelligence, artificielle : ce sont les mots qui portent le sujet de ce blog.
 */
const MOTS_VIDES_ARTICLES = new Set([
  "est",
  "par",
  "pas",
  "ses",
  "son",
  "vos",
  "nos",
  "ces",
  "mes",
  "the",
  "and",
  "pour",
  "avec",
  "dans",
  "sans",
  "sur",
  "des",
  "les",
  "une",
  "aux",
  "que",
  "qui",
  "quoi",
  "comment",
  "pourquoi",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "vous",
  "votre",
  "faire",
  "tout",
  "tous",
  "toute",
  "toutes",
  "plus",
  "bien",
  "etre",
  "avoir",
  "peut",
  "peuvent",
  "cette",
  "notre",
  "leur",
  "leurs",
  "entre",
  "aussi",
  "dont",
  "mais",
]);

/** Découpe : minuscules, accents retirés, pluriel simple retiré, mots de 3 lettres et plus. */
function jetonsAvec(texte: string | null | undefined, motsVides: ReadonlySet<string>): Set<string> {
  const sortie = new Set<string>();
  if (!texte) return sortie;
  const propre = texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
  for (const brut of propre.split(" ")) {
    if (brut.length < 3 || /^\d+$/.test(brut)) continue;
    const mot = brut.length > 4 && /[sx]$/.test(brut) ? brut.slice(0, -1) : brut;
    if (!motsVides.has(brut) && !motsVides.has(mot)) sortie.add(mot);
  }
  return sortie;
}

/** Mots de sujet pour choisir des sources (liste de mots vides large). */
export function jetonsSujet(texte: string | null | undefined): Set<string> {
  return jetonsAvec(texte, MOTS_VIDES);
}

/** Mots de sujet pour classer des articles liés (mots vides de la langue seulement). */
export function jetonsArticle(texte: string | null | undefined): Set<string> {
  return jetonsAvec(texte, MOTS_VIDES_ARTICLES);
}

/**
 * Nombre de mots du sujet retrouvés dans les thèmes, le titre ou l'organisme de la
 * source (0 si le sujet est vide).
 */
export function recouvrementSujet(link: ExternalLink, sujet: ReadonlySet<string>): number {
  if (sujet.size === 0) return 0;
  const jetonsLien = jetonsSujet(`${link.topics.join(" ")} ${link.title} ${link.organization}`);
  let n = 0;
  for (const j of jetonsLien) if (sujet.has(j)) n++;
  return n;
}

/** Bonus de score : 25 points par mot commun, 3 mots au plus. */
export function bonusSujet(link: ExternalLink, sujet: ReadonlySet<string>): number {
  return Math.min(recouvrementSujet(link, sujet), 3) * 25;
}

/**
 * Malus des sources locales ou régionales qui ne correspondent pas au contexte
 * géographique de l'article (la mairie de Nantes citée dans un article sans ville
 * est de la décoration, pas une source).
 */
export function malusGeo(link: ExternalLink, cityId?: string, regionSlug?: string): number {
  if (link.scope === "local") {
    return cityId && link.cityIds?.includes(cityId) ? 0 : 60;
  }
  if (link.scope === "regional") {
    return regionSlug && link.regionSlug === regionSlug ? 0 : 40;
  }
  return 0;
}

/**
 * Petit écart stable (0 à 14) calculé sur sujet + identifiant : deux sujets
 * différents départagent autrement les sources de score égal, sans hasard ni base
 * (le compteur d'usage en mémoire repart de zéro à chaque redémarrage du worker).
 */
export function departageStable(sujetBrut: string, id: string): number {
  let h = 0;
  const graine = `${sujetBrut}|${id}`;
  for (let i = 0; i < graine.length; i++) h = (h * 31 + graine.charCodeAt(i)) >>> 0;
  return h % 15;
}
