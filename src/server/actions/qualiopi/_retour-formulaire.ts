/**
 * Le chemin de retour d'un formulaire d'audit, validé.
 *
 * ## Pourquoi ce fragment vit à part
 *
 * 🔴 Une action de formulaire redirige vers un chemin qui vient du FORMULAIRE,
 * donc du client. Rediriger vers une valeur non validée est une redirection
 * ouverte : `retour=https://ailleurs` suffirait à faire quitter la console à
 * qui vient de révoquer une signature, avec le code de retour en prime.
 *
 * La validation tient en trois conditions — chaîne, commence par `/`, bornée —
 * et c'est exactement pour cela qu'elle se recopie sans qu'on y pense. Elle
 * existait déjà dans `signature-revocation.ts` ; la révocation d'émargement en
 * avait besoin à l'identique. Deux copies d'une garde de sécurité, c'est une
 * copie de trop : celle qu'on oublie de durcir est celle qui sert.
 *
 * ⚠️ Repli sur `/` et JAMAIS sur la valeur reçue. Un repli qui recopie l'entrée
 * ne valide rien, il déplace le problème d'une ligne.
 */

const LONGUEUR_MAX = 300;

/** Le chemin de retour du formulaire, ou `/` s'il n'est pas un chemin interne. */
export function retourValide(donneesFormulaire: FormData): string {
  const brut = donneesFormulaire.get("retour");
  return typeof brut === "string" &&
    brut.startsWith("/") &&
    // ⚠️ `//ailleurs.example` COMMENCE par `/` et est pourtant une URL absolue
    // en protocole relatif : le navigateur y va. La condition « commence par
    // `/` » seule ne suffit donc pas, et c'est le genre d'écart qu'une seconde
    // copie n'aurait jamais reçu.
    !brut.startsWith("//") &&
    // ⚠️ `//ailleurs.example` COMMENCE par `/` et est pourtant une URL absolue
    // en protocole relatif : le navigateur y va. La condition « commence par
    // `/` » seule ne suffit donc pas, et c'est le genre d'écart qu'une seconde
    // copie n'aurait jamais reçu.

    brut.length <= LONGUEUR_MAX
    ? brut
    : "/";
}
