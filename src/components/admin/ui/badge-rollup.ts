/**
 * La bulle d'un en-tête de navigation REPLIÉ — et pourquoi ce n'est pas `sum`.
 *
 * ## Le défaut, vécu en production le 2026-09-06
 *
 * Le groupe « Formations & prestations » affichait **71** pendant que ses deux
 * enfants badgés affichaient « À traiter » **36** et « Alertes » **35**. Et 36
 * valait déjà 35 alertes + 1 échéance de session : les alertes étaient comptées
 * DEUX FOIS. La bulle valait donc `2 × alertes + le reste`.
 *
 * Will avait relevé le 05/09 une suite « 4 → 7 → 8 → 68 » qu'il n'arrivait pas
 * à confirmer, et cherchait une montée réelle. Il n'y en avait pas : la formule
 * rend exactement ces valeurs (7 = 2×3 + 1, 68 = 2×34, 71 = 2×35 + 1). Un badge
 * qui double n'est pas seulement faux — il fabrique l'apparence d'une
 * aggravation, c'est-à-dire précisément le signal qu'on regarde pour décider.
 *
 * ## Pourquoi la somme naïve ne pouvait pas marcher
 *
 * Deux items de la barre ne portent pas LEUR compte, mais celui de leurs
 * frères : « À traiter » porte `signatures + emails + alertes + relances +
 * sessions`, et « Tout » (boîte de réception) la somme des quatre catégories.
 * Un agrégat et ses parties dans la même liste ne s'additionnent pas.
 *
 * ## La règle
 *
 * Chaque badge peut porter une étiquette `rollup` : `role: "total"` pour
 * l'agrégat, `role: "part"` pour un frère qu'il englobe, les deux partageant la
 * même `key`. Alors, par `key` :
 *
 *   · un `total` présent ⇒ on ne compte QUE lui (il couvre déjà ses parties,
 *     et il en couvre parfois plus : `signatures` et `sessions` n'ont aucune
 *     ligne de nav à elles) ;
 *   · aucun `total` (item masqué, mode Simple, filtre de recherche) ⇒ on somme
 *     les parties, sinon replier un groupe ferait disparaître du travail réel.
 *
 * ⚠️ Un badge SANS étiquette s'additionne TOUJOURS. C'est la réserve qui rend
 * le correctif sûr : on n'éteint que ce dont la redondance est déclarée à
 * l'endroit où le chiffre est construit. Une heuristique « ça ressemble à un
 * total » éteindrait un jour un badge légitime, et personne ne le verrait — un
 * compteur qui manque du travail est pire que celui qui en double, parce qu'il
 * ne se remarque pas.
 */

export type BadgeTone = "danger" | "warn";

export interface BadgeAComptabiliser {
  readonly count: number;
  readonly tone: BadgeTone;
  readonly rollup?: { readonly key: string; readonly role: "total" | "part" };
}

/**
 * Agrège les badges d'un groupe en une bulle unique.
 *
 * Tonalité : `danger` dès qu'un badge RETENU est `danger`. Elle se lit sur les
 * badges comptés, jamais sur ceux qu'on a écartés — sinon une partie écartée
 * pourrait teinter la bulle en rouge sans contribuer au nombre affiché.
 */
export function agregerBadges(
  badges: ReadonlyArray<BadgeAComptabiliser>,
): { count: number; tone: BadgeTone } | null {
  const clesAvecTotal = new Set<string>();
  for (const b of badges) {
    if (b.rollup?.role === "total") clesAvecTotal.add(b.rollup.key);
  }

  let count = 0;
  let tone: BadgeTone = "warn";
  for (const b of badges) {
    // Une PARTIE dont l'agrégat est présent est déjà comptée par lui.
    if (b.rollup?.role === "part" && clesAvecTotal.has(b.rollup.key)) continue;
    count += b.count;
    if (b.tone === "danger") tone = "danger";
  }

  return count > 0 ? { count, tone } : null;
}
