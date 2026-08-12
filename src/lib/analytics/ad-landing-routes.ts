// Routes d'atterrissage publicitaire — exemptées de Microsoft Clarity, donc
// de la bannière de consentement.
//
// ── Le problème observé ───────────────────────────────────────────────────
// Capture mobile du 2026-08-12 sur `/fr/diagnostic` (iPhone 13, 390 px) : la
// bannière de consentement occupe **48 % du premier écran**. Un visiteur venu
// d'une publicité vidéo voit la marque, trois lignes de preuve, la moitié d'un
// titre — puis un pavé blanc sur les cookies. C'est le premier contact avec
// Axion-IA, payé au clic, et il porte sur Microsoft Clarity.
//
// ── Pourquoi la solution est de ne PAS charger Clarity ────────────────────
// La bannière n'existe que pour Clarity. Plausible est auto-hébergé, anonyme et
// SANS COOKIE : la doctrine du site le déclare explicitement toujours actif,
// sans consentement. Sur ces pages, Clarity n'apporte rien qui vaille la moitié
// du premier écran — les événements de tunnel (`Simulator …`, `Landing …`)
// partent tous par Plausible.
//
// ⚠️ La bonne façon de faire disparaître la bannière est de supprimer la CAUSE,
// pas de masquer l'effet. Cacher la bannière en CSS tout en chargeant Clarity
// déposerait des cookies tiers sans consentement : ce serait un manquement
// caractérisé, pas une optimisation. `Clarity` et `CookieConsent` renvoient donc
// tous deux `null` sur ces routes — aucun script tiers n'est chargé, donc aucun
// consentement n'est requis (position constante de la CNIL).
//
// Ces composants étant déjà clients, le test se fait sur `usePathname()` : aucun
// appel à `headers()`, donc aucune bascule du site en rendu dynamique.

/**
 * Segments de route concernés, sans préfixe de langue.
 *
 * Volontairement restreint aux pages de TUNNEL PUBLICITAIRE. `/roi` n'y figure
 * pas : c'est une page publique indexée, où Clarity garde tout son intérêt.
 */
const AD_LANDING_SEGMENTS = ["/diagnostic", "/simulateur"] as const;

/**
 * True si le chemin est une page d'atterrissage publicitaire.
 *
 * Compare le chemin APRÈS retrait du préfixe de langue (`/fr`, `/en`), de façon
 * à couvrir les deux locales sans les énumérer.
 */
export function isAdLandingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return AD_LANDING_SEGMENTS.some(
    (segment) => withoutLocale === segment || withoutLocale.startsWith(`${segment}/`),
  );
}
