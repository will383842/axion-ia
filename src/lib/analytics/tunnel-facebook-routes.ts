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

/** Segments concernés, sans préfixe de langue. `/facebook` couvre `/facebook/merci`. */
const TUNNEL_FACEBOOK_SEGMENTS = ["/facebook"] as const;

/** True si le chemin appartient au tunnel Facebook (landing ou page merci). */
export function isRouteTunnelFacebook(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const sansLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return TUNNEL_FACEBOOK_SEGMENTS.some(
    (segment) => sansLocale === segment || sansLocale.startsWith(`${segment}/`),
  );
}
