// Composition d'un objet d'e-mail qui tient dans la fenêtre d'affichage mobile.
//
// ── LE PROBLÈME QU'IL RÉSOUT ────────────────────────────────────────────────
//
// Le référentiel §3.4 fixe l'objet à 30-45 caractères : au-delà, il est tronqué
// sur mobile, et le destinataire décide d'ouvrir sur ce qu'il reste. Or plus de
// la moitié des objets d'Axion-IA sont COMPOSÉS — un préfixe fixe plus un
// intitulé variable :
//
//     `Rappel J-7 — ${titreFormation}`
//     `Convocation — ${titreFormation}`
//     `Votre avis sur la formation ${titreFormation}`
//
// Leur longueur ne dépend donc pas du gabarit, mais du CATALOGUE. Mesuré le
// 2026-08-31 avec un intitulé réel de 28 caractères (« IA appliquée aux
// entreprises »), sept objets dépassaient encore 45 après nettoyage, dont un à
// 78. Raccourcir ces sept phrases à la main n'aurait rien réglé : la prochaine
// formation au titre plus long aurait refait le défaut, en silence, sans que
// rien ne rougisse.
//
// ── LA RÈGLE ────────────────────────────────────────────────────────────────
//
// On borne à la COMPOSITION, pas à la rédaction. Le préfixe est réputé
// essentiel et n'est jamais rogné ; c'est l'intitulé qu'on abrège, sur une
// frontière de mot, avec une ellipse. Un « Rappel J-7 — IA appliquée… » reste
// reconnaissable ; un objet coupé par le client de messagerie au milieu
// d'un mot, non — et surtout, il est coupé à une longueur qu'on ne choisit pas.
//
// ⚠️ Ce module est PUR (aucun import). Il est appelé pendant le rendu d'e-mail
// dans le worker BullMQ, hors requête.

/**
 * Longueur maximale d'un objet, en caractères.
 *
 * 45 est la borne haute du §3.4. On ne vise pas 30 (la borne basse) : un objet
 * transactionnel cherche la RECONNAISSANCE instantanée, pas la concision — le
 * §3.4 précise qu'il doit « rester compréhensible seul, sorti de tout contexte,
 * six mois plus tard, quand la personne cherche dans sa boîte ». Amputer un
 * numéro de facture ou un intitulé de formation pour gagner dix caractères
 * travaillerait contre ce critère-là.
 */
export const OBJET_MAX = 45;

/** Ellipse en un seul caractère : elle en coûte un, « ... » en coûte trois. */
const ELLIPSE = "…";

/**
 * Compose `prefixe` + `variable` en tenant dans `OBJET_MAX`, en n'abrégeant que
 * la partie variable.
 *
 * @param prefixe   Partie fixe, jamais rognée (ex. « Rappel J-7 — »).
 * @param variable  Partie variable, abrégée si besoin (ex. l'intitulé).
 * @param max       Borne, pour les rares objets qui en justifient une autre.
 *
 * Repli : si le préfixe consomme déjà tout le budget, on rend le préfixe seul
 * plutôt qu'un objet à l'ellipse orpheline (« Rappel J-7 — … » n'apprend rien
 * de plus que « Rappel J-7 »). Un objet court et vrai vaut mieux qu'un objet
 * long et coupé.
 */
export function objetCompose(prefixe: string, variable: string, max: number = OBJET_MAX): string {
  const p = prefixe.trim();
  const v = variable.trim();
  if (v === "") return p;
  const complet = `${p} ${v}`;
  if (complet.length <= max) return complet;

  // Place restante pour la partie variable, ellipse comprise.
  const dispo = max - p.length - 1 - ELLIPSE.length;
  /*
   * Sous 12 caractères utiles, l'abrégé ne distingue plus rien : on préfère le
   * préfixe seul, qui reste exact.
   *
   * 🔴 Le seuil valait 8, et `convention-envoi.spec.tsx` a montré ce que ça
   * donnait : préfixe « Convention de formation à signer — » (35 caractères),
   * donc 8 de place, donc l'objet « Convention de formation à signer — IA… ».
   * Techniquement dans la borne, et parfaitement inutile — un destinataire qui
   * suit deux formations ne peut pas les distinguer. Un abrégé qui ne
   * discrimine plus n'est pas un abrégé, c'est du bruit qui coûte des
   * caractères.
   *
   * Le bon geste, quand ce repli se déclenche, n'est PAS de baisser le seuil :
   * c'est de raccourcir le PRÉFIXE pour rendre de la place à la variable — ce
   * qui a été fait pour la convention (« Convention à signer — », 21).
   * Le repli sur le préfixe seul reste le filet, pas la solution.
   */
  if (dispo < 12) return p.replace(/[\s—·:,-]+$/, "");

  const coupe = v.slice(0, dispo);
  // Frontière de MOT : on recule jusqu'à la dernière espace, pour ne pas rendre
  // « IA appliquée aux entrep… ». Si le premier mot dépasse déjà la place, on
  // garde la coupe brute — mieux vaut un mot tronqué que rien.
  const espace = coupe.lastIndexOf(" ");
  const abrege = espace > dispo * 0.5 ? coupe.slice(0, espace) : coupe;
  return `${p} ${abrege.replace(/[\s,;:.—-]+$/, "")}${ELLIPSE}`;
}
