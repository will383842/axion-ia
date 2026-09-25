// Le leurre anti-robot n'arrive au serveur que si quelqu'un le lui APPORTE.
//
// ── LE DÉFAUT QUE CE MODULE FERME (mesuré en production le 2026-09-25) ──────
//
// `HoneypotField` rend un `<input name="website">` natif. Un formulaire qui
// soumet par `new FormData(formulaire)` l'emporte avec lui, sans rien faire.
// Mais les formulaires pilotés par react-hook-form construisent leur FormData
// À LA MAIN, champ par champ — et personne n'y avait ajouté `website`.
//
// Conséquence : sur ces formulaires, le piège était INERTE côté navigateur. Un
// robot qui remplit la page passait comme un visiteur ; seul un robot qui poste
// directement à l'action serveur était attrapé. Essai contrôlé du 25/09 sur
// /fr/contact, leurre rempli d'une valeur marqueur : « Demande reçue », une
// VRAIE fiche créée en base, un accusé parti, un événement transmis au CRM — et
// aucune trace dans le registre du piège. Le même essai sur la candidature
// spontanée (qui, elle, soumet le formulaire entier) a produit la trace.
//
// Touchés : `UnifiedContactForm` et `NewsletterForm`. La garde
// `__tests__/le-leurre-arrive-au-serveur.spec.ts` refuse tout nouveau
// formulaire qui affiche le leurre, construit un FormData vide, et oublie
// d'appeler cette fonction.

/** Doit rester identique au `name` rendu par `HoneypotField` (vérifié par test). */
export const NOM_DU_LEURRE = "website";

/**
 * Recopie la valeur du leurre, lue dans le formulaire du DOM, dans le FormData
 * construit à la main. Ne pose rien si le leurre est vide : un humain doit
 * produire EXACTEMENT la même requête qu'avant.
 *
 * @param fd          Le FormData envoyé à l'action serveur.
 * @param formulaire  La cible de l'événement de soumission. Ne PAS passer
 *                    `event.currentTarget` : React le remet à `null` dès la fin
 *                    de la distribution, et react-hook-form n'appelle le
 *                    gestionnaire qu'APRÈS une validation asynchrone.
 */
export function reporterLeurre(fd: FormData, formulaire: EventTarget | null | undefined): void {
  if (!(formulaire instanceof HTMLFormElement)) return;
  const valeur = new FormData(formulaire).get(NOM_DU_LEURRE);
  if (typeof valeur === "string" && valeur !== "") fd.set(NOM_DU_LEURRE, valeur);
}
