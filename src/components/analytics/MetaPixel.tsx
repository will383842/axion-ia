"use client";
// use-client: lit le consentement (`useAnalyticsConsent`) et le chemin courant — intrinsèquement client.
//
// Pixel Meta (Facebook / Instagram) — tunnel apporteurs d'affaires (2026-09-03).
//
// ── À QUOI IL SERT ────────────────────────────────────────────────────────
// Sans lui, Meta optimise une campagne sur les CLICS : elle cherche des gens
// qui cliquent, pas des gens qui remplissent le formulaire. Avec l'événement
// `Lead`, elle cherche des gens qui ressemblent à ceux qui ont candidaté —
// c'est ce qui divise le coût par candidature. Il permet aussi le reciblage
// des visiteurs de `/apporteur-affaires` qui n'ont pas rempli le formulaire.
//
// Il ne mesure PAS l'audience (Plausible) et n'est PAS la source de vérité des
// candidatures (la table `submissions`, écrite par l'action serveur).
//
// ── GATES, DANS L'ORDRE ───────────────────────────────────────────────────
//  1. Pas de `NEXT_PUBLIC_META_PIXEL_ID` → null. Zéro requête, zéro cookie.
//  2. Hors du tunnel Facebook (`/apporteur-affaires`, `/apporteur-affaires/merci`) → null. Le
//     consentement recueilli porte sur la mesure d'une campagne, pas sur le
//     reste du site (cf. `lib/analytics/tunnel-facebook-routes.ts`).
//  3. Consentement != "accepted" → null. Le pixel dépose `_fbp` (90 jours) et
//     lit `fbclid` pour `_fbc` : consentement explicite obligatoire (RGPD
//     art. 6.1.a + ePrivacy). La bannière NOMME Meta sur ces routes.
//  4. URL portant un secret → null (même règle que Clarity et LinkedIn).
//
// ── CE QU'ON N'IMPLÉMENTE PAS VOLONTAIREMENT ──────────────────────────────
// Le snippet officiel contient un `<noscript><img …/></noscript>` qui tire le
// pixel SANS JavaScript, donc sans passer par la porte du consentement. Il est
// omis, comme pour LinkedIn : il rendrait le gate décoratif.
//
// L'événement `Lead` n'est PAS tiré ici : il l'est sur `/apporteur-affaires/merci` par
// `MerciLeadMeta`, avec l'identifiant de la Submission en `eventID`, pour être
// dédoublonné avec l'envoi serveur (`server/meta/conversions-api.ts`).
//
// Sous-traitant déclaré dans `src/content/subprocessors.ts` (Meta Platforms
// Ireland) ; origines `connect.facebook.net` (script-src) et `www.facebook.com`
// (connect-src) dans `src/lib/csp.ts`, liées par `subprocessors-coherence.spec.ts`.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { env } from "@/env";
import { urlPorteUnSecret } from "@/lib/analytics/routes-privees";
import { isRouteTunnelFacebook } from "@/lib/analytics/tunnel-facebook-routes";
import { useAnalyticsConsent } from "./CookieConsent";

export function MetaPixel() {
  const pixelId = env.NEXT_PUBLIC_META_PIXEL_ID;
  const consent = useAnalyticsConsent();
  const pathname = usePathname();
  if (!pixelId) return null;
  if (!isRouteTunnelFacebook(pathname)) return null;
  if (consent !== "accepted") return null;
  if (urlPorteUnSecret(pathname)) return null;

  // L'identifiant est numérique côté Meta ; on ne laisse passer que des
  // chiffres pour qu'aucune valeur d'environnement ne puisse écrire du script.
  const id = pixelId.replace(/\D/g, "");
  if (!id) return null;

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');fbq('track','PageView');`,
      }}
    />
  );
}
