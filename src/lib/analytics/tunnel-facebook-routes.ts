// Routes du tunnel Facebook apporteurs d'affaires (2026-09-03) — les SEULES
// pages où le pixel Meta a le droit de se charger.
//
// ── Pourquoi une liste fermée, et pas « tout le site » ────────────────────
// Un pixel publicitaire posé partout constituerait une audience de reciblage
// à partir de visiteurs qui n'ont jamais vu une campagne — y compris des
// stagiaires venus signer une feuille d'émargement ou des clients venus lire
// leur convention. Le consentement recueilli par la bannière porte sur la
// mesure d'une CAMPAGNE ; il ne couvre pas ça. Le pixel ne vit donc que là
// où la campagne atterrit, et la bannière ne le nomme que là.
//
// ⚠️ Ces routes ne sont PAS dans `ad-landing-routes.ts` (pages sans scripts
// tiers), et c'est délibéré : on y charge un tiers, donc on y DEMANDE le
// consentement. Les y ajouter ferait disparaître la bannière tout en laissant
// le pixel se charger — un manquement, pas une optimisation.
//
// `MetaPixel`, `CookieConsent` (texte de la bannière) et `MerciLeadMeta`
// lisent tous cette fonction : on ne peut pas en changer un sans voir les autres.

/**
 * Les pages du tunnel, sans préfixe de langue — LISTE FERMÉE (2026-10-07, relecture de a1).
 *
 * Avant, le préfixe `/apporteur-affaires` couvrait tout ce qui commençait par lui. La grille
 * de référence des commissions (`/apporteur-affaires/commissions`), un document pour les
 * apporteurs et non une page de campagne, aurait chargé le pixel — et rendu fausse la
 * politique cookies, qui ne le nomme que sur ces quatre pages. Toute nouvelle page du tunnel
 * s'ajoute ICI, explicitement, avec la phrase de `preferences-cookies`.
 *
 * ⚠️ 2026-09-04 : `/facebook` n'est PLUS servi (301 vers `/apporteur-affaires`, `next.config.ts`
 * + `legacy-redirects.ts`) et n'a donc rien à faire ici.
 */
const TUNNEL_FACEBOOK_PAGES: ReadonlySet<string> = new Set([
  "/apporteur-affaires",
  "/apporteur-affaires/merci",
  "/apporteur-affaires/video",
  "/apporteur-affaires/video/merci",
]);

/** True si le chemin est une page du tunnel Facebook (landing ou page merci). */
export function isRouteTunnelFacebook(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const sansLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "").replace(/\/+$/, "");
  return TUNNEL_FACEBOOK_PAGES.has(sansLocale);
}
