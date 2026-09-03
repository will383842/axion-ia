/**
 * Déduire le MODE d'un entretien depuis le lieu d'un rendez-vous d'agenda.
 *
 * ## Pourquoi on devine plutôt que de demander
 *
 * Le rendez-vous porte déjà l'information, sous une forme que Calendly ne
 * normalise pas : un lien de visioconférence, une adresse postale, ou rien du
 * tout pour un appel. Ajouter un champ « mode » au formulaire de rattachement
 * ferait remplir à la main ce que la donnée dit déjà — et un champ de plus à
 * remplir se remplit mal.
 *
 * 🔑 On devine, et la personne corrige d'un clic si on se trompe. C'est
 * l'inverse d'un choix obligatoire, qui se remplit au hasard le jour où on est
 * pressé.
 *
 * ## Fonction PURE
 *
 * Aucune base, aucun réseau, aucune horloge. C'est ce qui permet de l'éprouver
 * sur ses cas limites — et il y en a, voir la spec voisine : une adresse peut
 * contenir « http » sans être un lien, et un lieu peut n'être que des espaces.
 */

export type ModeEntretien = "telephone" | "visio" | "sur_site";

/**
 * Le mode déduit du lieu.
 *
 * - un lieu qui COMMENCE par `http://` ou `https://` → visioconférence ;
 * - un lieu non vide → sur site ;
 * - rien → téléphone.
 */
export function modeDepuisLieu(lieu: string | null | undefined): ModeEntretien {
  const valeur = (lieu ?? "").trim();
  if (valeur.length === 0) return "telephone";
  // 🔴 `startsWith` et non `includes` : « 12 rue du Http, Lyon » n'est pas un
  // lien, et « Bureau — voir plan sur https://… » non plus. Un `includes`
  // classerait les deux en visioconférence, et on enverrait quelqu'un attendre
  // devant un écran pendant qu'on l'attend dans une salle.
  if (/^https?:\/\//i.test(valeur)) return "visio";
  return "sur_site";
}
