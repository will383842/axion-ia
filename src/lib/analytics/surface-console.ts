/**
 * La CONSOLE ADMIN est une surface privée : aucun script tiers, aucune bannière.
 *
 * ## Le défaut que ce module ferme (2026-09-02, audit certificateur)
 *
 * `[locale]/layout.tsx` enveloppe TOUT, console comprise : dans l'App Router un
 * layout imbriqué s'ajoute à son parent, il ne le remplace jamais. Le layout
 * admin le sait — il injecte un `<style>` qui masque l'en-tête, le pied de page
 * et l'aside publics. Il en avait masqué TROIS ; il en restait deux, et ce sont
 * les deux qui comptent :
 *
 *   - **la bannière de consentement**, affichée par-dessus la console — mesurée
 *     le 2026-09-02 sur l'écran « Conformité & mode auditeur », c'est-à-dire
 *     celui que l'auditrice lit le jour de sa venue ;
 *   - **Microsoft Clarity**, qui enregistre l'URL ET LE DOM, avec transfert hors
 *     UE. Un « Accepter » cliqué depuis la console arme donc le rejeu de session
 *     sur des écrans qui portent des noms de stagiaires, leurs adresses, le
 *     drapeau « situation de handicap » (donnée de santé, art. 9), les
 *     factures et le registre entier. Le consentement recueilli porte sur la
 *     mesure d'audience d'un site vitrine ; il ne couvre rien de tout cela.
 *
 * ## Pourquoi la détection se fait par le DOM, et pas par le chemin
 *
 * Le préfixe de la console est un SECRET tourné au runtime (`ADMIN_URL_PREFIX`).
 * Le descendre jusqu'à un composant client le publierait dans la charge RSC de
 * chaque page publique — on remplacerait une fuite par une autre, pire.
 *
 * Les deux prédicats existants montrent le prix de ne pas avoir de source :
 *   - `WebVitals.isAdminRoute` teste `/^\/(fr|en)?\/?[^/]*admin/i` — une
 *     heuristique sur le MOT « admin », qui rate le premier préfixe tourné qui
 *     ne le contient pas, c'est-à-dire exactement le but d'un préfixe secret ;
 *   - `SpeculationRules` accepte un `adminPrefix` en propriété… que le layout
 *     racine ne lui passe jamais, si bien que son garde se réduit à
 *     `startsWith("/admin/")` et ne reconnaît pas la console non plus.
 *
 * On lit donc le MARQUEUR que le layout admin pose déjà sur sa racine, et dont
 * le masquage CSS du shell public dépend depuis toujours : ce n'est pas un
 * contrat nouveau, c'est un contrat existant, porteur, et vérifié par
 * `surface-console.spec.ts` contre le source du layout.
 */

/**
 * Sélecteur du marqueur de la console — les deux coquilles, l'historique et la
 * V2, comme le fait déjà le CSS de masquage du shell public.
 */
export const SELECTEUR_SHELL_CONSOLE = ".admin-layout-v2, .admin-layout";

/**
 * Vrai si la page rendue est la console d'administration.
 *
 * Rend `false` au rendu serveur (pas de `document`) : c'est le comportement
 * voulu, les deux appelants ne produisent de toute façon rien avant hydratation.
 */
export function estSurfaceConsole(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(SELECTEUR_SHELL_CONSOLE) !== null;
}

/**
 * L'identifiant du bandeau de consentement — SOURCE UNIQUE.
 *
 * 🔴 2026-09-02 — pourquoi il vit ici, et pas dans `CookieConsent.tsx`.
 *
 * Le bandeau est rendu CÔTÉ SERVEUR depuis le correctif de CLS du 2026-09-02
 * (il était peint après les polices, il décalait la page). Or React 19 ne
 * répare PAS une divergence de branche serveur/client : le message est explicite
 * — « A tree hydrated but some attributes of the server rendered HTML didn't
 * match the client properties. **This won't be patched up.** » Mesuré : un garde
 * purement client (`if (estSurfaceConsole()) return null`) laissait le bandeau
 * en place sur la console, parce que le serveur l'avait déjà écrit.
 *
 * 🔑 La leçon est générale et vaut d'être retenue : **un garde qui ne s'exécute
 * qu'au client ne peut pas dé-rendre ce que le serveur a déjà rendu.** Il faut
 * soit ne pas le rendre au serveur — impossible ici, le layout racine ignore la
 * route sans `headers()`, ce qui basculerait 17 000 pages en dynamique — soit le
 * masquer par une règle CSS, ce que le layout admin fait DÉJÀ pour l'en-tête, le
 * pied de page et l'aside publics, et pour la même raison exactement.
 *
 * L'identifiant est donc importable par le layout admin (Server Component) sans
 * passer par un module « use client ».
 */
export const ID_BANNIERE_CONSENTEMENT = "cookie-consent-banner";
