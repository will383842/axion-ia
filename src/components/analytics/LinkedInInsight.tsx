"use client";
// use-client: lit le consent cookie (`useAnalyticsConsent`) — intrinsèquement client.
//
// LinkedIn Insight Tag (2026-08-20).
//
// ── À QUOI IL SERT, ET À QUOI IL NE SERT PAS ──────────────────────────────
// Il ne mesure PAS l'audience : Plausible (auto-hébergé, EU, sans cookie) le
// fait déjà et sans consentement. Il ne mesure PAS non plus l'attribution des
// réservations : `/appel` lit les UTM côté serveur et capte
// `calendly.event_scheduled` (cf. `CalendlyEventCapture`).
//
// Sa SEULE utilité est le **retargeting publicitaire** LinkedIn : constituer
// une audience de visiteurs réactivable en campagne payante. LinkedIn exige
// **300 membres appariés** pour qu'une audience s'active, et il en faut
// réalistement 1 000+ pour une diffusion exploitable. D'où l'installation
// anticipée : l'audience s'accumule pendant les mois d'organique.
//
// ⚠️ Tant que `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` est absent (aucun compte
// LinkedIn Campaign Manager créé), ce composant rend `null` : zéro requête,
// zéro cookie, zéro impact Web Vitals. C'est l'état par défaut.
//
// ── GATES, DANS L'ORDRE ───────────────────────────────────────────────────
//  1. Pas de Partner ID → null.
//  2. Route d'atterrissage publicitaire → null (même raison que Clarity : la
//     bannière de consentement y mangeait la moitié du premier écran mobile,
//     donc aucun tiers consenti n'y est chargé).
//  3. Consentement != "accepted" → null. Le tag dépose `li_sugr`, `bcookie`,
//     `bscookie`, `lidc` et `UserMatchHistory` : consentement explicite
//     obligatoire (RGPD art. 6.1.a + ePrivacy).
//  4. URL portant un secret (jeton d'émargement, portail stagiaire) → null.
//     Même raisonnement que Clarity : le visiteur consent à la mesure, pas à
//     la transmission de son moyen d'authentification à un tiers hors UE.
//
// ── CE QU'ON N'IMPLÉMENTE PAS VOLONTAIREMENT ──────────────────────────────
// Le snippet officiel de LinkedIn contient un `<noscript><img …/></noscript>`
// qui déclenche le pixel SANS JavaScript, donc **sans passer par la porte du
// consentement**. Il est délibérément omis : il rendrait le gate décoratif.
//
// Sous-processeur déclaré dans `src/content/subprocessors.ts` (analytics_obs)
// et origines whitelistées dans `src/lib/csp.ts` (`snap.licdn.com` script-src,
// `px.ads.linkedin.com` connect-src) — les deux sont liés par
// `src/content/__tests__/subprocessors-coherence.spec.ts`.
//
// Usage : `<LinkedInInsight />` dans le root layout, après `<Clarity />`.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { env } from "@/env";
import { urlPorteUnSecret } from "@/lib/analytics/routes-privees";
import { useAnalyticsConsent } from "./CookieConsent";
import { isRouteSansScriptsTiers } from "@/lib/analytics/ad-landing-routes";

export function LinkedInInsight() {
  const partnerId = env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  const consent = useAnalyticsConsent();
  const pathname = usePathname();
  if (!partnerId) return null;
  if (isRouteSansScriptsTiers(pathname)) return null;
  if (consent !== "accepted") return null;
  if (urlPorteUnSecret(pathname)) return null;

  return (
    <Script
      id="linkedin-insight"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,id){
  w._linkedin_partner_id=id;
  w._linkedin_data_partner_ids=w._linkedin_data_partner_ids||[];
  w._linkedin_data_partner_ids.push(id);
  if(!w.lintrk){w.lintrk=function(a,b){w.lintrk.q.push([a,b])};w.lintrk.q=[]}
  var s=d.getElementsByTagName("script")[0];
  var b=d.createElement("script");
  b.type="text/javascript";b.async=true;
  b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
  s.parentNode.insertBefore(b,s);
})(window, document, "${partnerId}");`,
      }}
    />
  );
}
