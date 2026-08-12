"use client";
// use-client: lit le consent cookie (`useAnalyticsConsent`) — intrinsèquement client.
//
// Microsoft Clarity integration (heatmaps + session replay + frustration signals).
//
// Méta-cert 2026-05-15 AGENT 5 + 21 P0-C — gate Clarity sur consent CMP
// explicite. Cookies `_clck` (1 an) + `_clsk` (1 jour) déposés UNIQUEMENT
// après clic visiteur "Accepter" dans `CookieConsent` banner.
//
// Architecture :
//  - `useAnalyticsConsent()` lit `localStorage.axion-cookie-consent-v1` + écoute
//    l'event custom `axion-consent-changed` → re-render automatique au clic accept.
//  - Si pas de consent OU declined OU projectId absent → render `null` (zéro
//    requête réseau Clarity, zéro cookie).
//  - Si accepted → injecte le `<Script>` Clarity Microsoft (strategy
//    `afterInteractive` → ne bloque pas LCP).
//
// Sous-processeur déclaré dans `src/content/subprocessors.ts` (analytics_obs)
// + `legal.ts` §Cookies + §Sous-processeurs + ADR 0010 PII redaction
// (Telegram) cohérent.
//
// Usage : `<Clarity />` dans le root layout. No-op si
// `NEXT_PUBLIC_CLARITY_PROJECT_ID` absent (preserve dev sans appel réseau).

import Script from "next/script";
import { usePathname } from "next/navigation";
import { env } from "@/env";
import { urlPorteUnSecret } from "@/lib/analytics/routes-privees";
import { useAnalyticsConsent } from "./CookieConsent";
import { isAdLandingRoute } from "@/lib/analytics/ad-landing-routes";

export function Clarity() {
  const projectId = env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const consent = useAnalyticsConsent();
  const pathname = usePathname();
  if (!projectId) return null;
  // Pages d'atterrissage publicitaire : Clarity n'est PAS chargé, ce qui rend la
  // bannière de consentement inutile — elle mangeait la moitié du premier écran
  // au mobile. Cf. `lib/analytics/ad-landing-routes.ts`.
  if (isAdLandingRoute(pathname)) return null;
  if (consent !== "accepted") return null;
  // 🔴 Clarity enregistre l'URL ET le DOM, avec transfert hors UE. Sur le
  // portail, cela signifie le jeton d'émargement en clair plus la feuille
  // nominative. Le consentement ne couvre pas ça : le stagiaire consent à la
  // mesure d'audience, pas à la diffusion de son moyen d'authentification.
  if (urlPorteUnSecret(pathname)) return null;

  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${projectId}");`,
      }}
    />
  );
}
