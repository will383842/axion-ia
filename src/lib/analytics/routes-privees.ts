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
