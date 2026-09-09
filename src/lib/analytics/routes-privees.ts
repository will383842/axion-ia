/**
 * Routes dont l'URL elle-même est un SECRET — aucune mesure d'audience.
 *
 * ## Le bug que ce module corrige
 *
 * Le portail stagiaire porte son jeton d'authentification DANS LE CHEMIN :
 * `/fr/portail/emarger/<payload>.<signature>`. Or Plausible transmet
 * `location.pathname` à chaque page vue, Clarity enregistre l'URL et le DOM, et
 * `WebVitals` postait `href` complet vers `/api/vitals` — donc en base et sur
 * disque, sans purge RGPD.
 *
 * Un `layout.tsx` propre au portail ne suffit PAS, et c'était l'erreur : dans
 * l'App Router, un layout imbriqué s'AJOUTE à son parent, il ne le remplace
 * jamais. Le portail continuait donc d'hériter des scripts du layout racine,
 * pendant que son docstring affirmait le contraire — le pire des deux mondes,
 * puisque la prochaine revue lit la promesse et passe.
 *
 * ## Pourquoi une garde côté client, et pas côté serveur
 *
 * Le layout racine ne peut pas appeler `headers()` : cela rendrait TOUTES les
 * pages dynamiques (`no-store`) et ferait tomber le BF-cache et les budgets Web
 * Vitals du dépôt. La garde est donc portée par chaque composant qui transmet
 * l'URL — le patron déjà retenu par `WebVitals` et `SpeculationRules` pour la
 * console admin.
 *
 * ⚠️ Tout nouveau script tiers recevant l'URL doit passer par ici. Ce n'est pas
 * une optimisation : le jeton reste valable jusqu'à la fin de session + 48 h et
 * n'est pas à usage unique, donc quiconque le lit peut signer à la place du
 * stagiaire.
 */

/**
 * Chemins publics dont l'URL porte un secret.
 *
 * Le préfixe de locale est optionnel : la garde doit tenir avant comme après la
 * résolution next-intl.
 */
const ROUTES_A_SECRET = /^\/(?:[a-z]{2}\/)?portail(?:\/|$)/i;

/**
 * Vrai si l'URL de cette page ne doit être transmise à AUCUN tiers.
 *
 * @param pathname Chemin courant (`usePathname()` ou `location.pathname`).
 */
export function urlPorteUnSecret(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  return ROUTES_A_SECRET.test(pathname);
}

/**
 * Chemin d'une page de la CONSOLE ADMIN, dont l'URL porte le préfixe secret.
 *
 * ## Pourquoi la forme, et pas la valeur
 *
 * Le préfixe réel vit dans `ADMIN_URL_PREFIX`, une variable SERVEUR. Le passer
 * en prop à un composant client depuis le layout racine l'inlinerait dans le
 * HTML de TOUTES les pages publiques — c'est-à-dire publierait exactement le
 * secret que le préfixe rotatif existe pour protéger. La garde travaille donc
 * sur la FORME du chemin, jamais sur la valeur.
 *
 * Le motif est celui que `WebVitals` portait en copie privée depuis le
 * 2026-05-17 ; il est déplacé ici pour qu'il n'existe qu'une source. Deux
 * gardes rédigées séparément pour le même périmètre divergent — c'est
 * précisément ce qui est arrivé : `SpeculationRules` en avait écrit une autre,
 * qui ne pouvait jamais être vraie (voir le docstring de ce composant).
 */
const ROUTES_CONSOLE = /^\/(?:fr|en)?\/?[^/]*admin/i;

/**
 * Vrai si ce chemin est celui de la console admin.
 *
 * ⚠️ Volontairement large : un premier segment public contenant « admin »
 * serait traité comme la console. Le coût d'un faux positif est de renoncer à
 * une mesure ou à un préchargement sur cette page ; le coût d'un faux négatif
 * est de transmettre l'URL secrète à un tiers, ou de précharger la console.
 */
export function urlEstConsoleAdmin(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  return ROUTES_CONSOLE.test(pathname);
}

/**
 * Vrai si la page AFFICHÉE est la console admin — chemin OU coquille présente.
 *
 * 🔑 LE DOM EST LE SIGNAL SÛR, LE CHEMIN N'EST QU'UN APPOINT. `urlEstConsoleAdmin`
 * suppose que le préfixe contient « admin » ; rien ne le garantit, puisqu'il est
 * rotatif et qu'un préfixe est justement d'autant meilleur qu'il ne s'annonce
 * pas. La coquille, elle, est posée par le layout admin lui-même
 * (`.admin-layout-v2` pour une session ouverte, `.admin-layout` pour l'écran de
 * connexion) et c'est déjà le sélecteur dont ce layout se sert pour masquer
 * l'en-tête et le pied de page publics.
 *
 * À n'appeler que depuis un effet client — au rendu serveur, `document` n'existe
 * pas et la fonction se rabat sur le seul chemin.
 */
export function pageEstConsoleAdmin(pathname: string | null | undefined): boolean {
  if (urlEstConsoleAdmin(pathname)) return true;
  if (typeof document === "undefined") return false;
  return document.querySelector(".admin-layout-v2, .admin-layout") !== null;
}
