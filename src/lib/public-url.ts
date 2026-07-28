/**
 * URL absolue vers une page publique du site.
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 Constat du 2026-07-28, reproduit en production. Les Route Handlers
 * construisaient leurs redirections avec `new URL(chemin, request.url)`. C'est
 * l'idiome que tout le monde écrit — et il est faux ici.
 *
 * Derrière le proxy (Coolify → conteneur), `request.url` porte l'adresse
 * INTERNE d'écoute du serveur, pas l'URL publique. Next ne la réécrit pas à
 * partir des en-têtes `X-Forwarded-*`. Le navigateur recevait donc un
 * `Location: https://0.0.0.0:3000/fr/espace-formateur` — `ERR_ADDRESS_INVALID`.
 *
 * Conséquence : **les espaces formateur ET ressources étaient entièrement
 * inaccessibles**. Le lien magique de l'e-mail était pourtant correct
 * (`buildFormateurMagicLinkUrl` lit `NEXT_PUBLIC_SITE_URL`) : le jeton était
 * consommé, la session posée, le cookie écrit — puis la redirection finale
 * jetait l'utilisateur dans le vide. Le jeton étant à USAGE UNIQUE, chaque
 * tentative brûlait un lien, et la page d'erreur affichait « lien invalide »,
 * ce qui envoyait chercher le défaut exactement là où il n'était pas.
 *
 * Aucune télémétrie ne pouvait le voir : côté serveur, tout réussit.
 *
 * ## Source de vérité
 *
 * `SITE_URL` (`@/lib/seo`), qui lit `NEXT_PUBLIC_SITE_URL` et rattrape déjà le
 * cas d'un `localhost` résiduel en build de production. On NE recrée PAS une
 * lecture d'environnement ici : c'est précisément la multiplication des
 * lectures divergentes d'une même valeur qui a produit les défauts corrigés la
 * veille sur `objectifsPedagogiques` (sept lectures, six fausses).
 */

import { SITE_URL } from "@/lib/seo";

/**
 * Construit une URL absolue sur l'origine PUBLIQUE du site.
 *
 * @param pathAndQuery Chemin absolu, query comprise — ex. `/fr/espace-formateur`
 *                     ou `/fr/espace-formateur/connexion?erreur=lien_invalide`.
 *
 * À utiliser dans tout Route Handler qui redirige. `request.url` ne convient
 * pas : il porte l'adresse d'écoute interne du conteneur.
 */
export function publicUrl(pathAndQuery: string): URL {
  return new URL(pathAndQuery, SITE_URL);
}
