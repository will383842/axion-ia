// Microsoft Clarity integration (heatmaps + session replay + frustration signals).
//
// 100% gratuit + GDPR-friendly avec masking par défaut. Complète Plausible :
// Plausible = quoi/combien (events agrégés sans cookies),
// Clarity = comment (heatmaps clic+scroll, replays anonymisés, rage-clicks).
//
// Usage : <Clarity /> dans le root layout. No-op si NEXT_PUBLIC_CLARITY_PROJECT_ID
// pas défini (preserve dev sans appel réseau parasite).

import Script from "next/script";
import { env } from "@/env";

export function Clarity() {
  const projectId = env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!projectId) return null;

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
