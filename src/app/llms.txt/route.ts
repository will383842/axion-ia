// llms.txt — high-signal site map for AI crawlers (axionia-seo-aeo).
// Spec: https://llmstxt.org/
// Sprint 14 will enrich this with full content blocks (llms-full.txt).

import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { SITE_URL } from "@/lib/seo";

export const runtime = "edge";
// Edge route handlers cannot be `force-static` in Next 16. We rely on
// HTTP `Cache-Control` (1h fresh + 24h SWR) below for CDN caching.

export function GET() {
  const essentiellePrice = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    "fr",
    { compact: true },
  );
  const body = `# AxionIA

> Cabinet IA opérationnel B2B pour entreprises. Cabinet européen (AxionIA OÜ).
> Site officiel : ${SITE_URL}
> Langues : FR (canonique), EN.

## Modules

- [Interventions entreprise](${SITE_URL}/fr/interventions) — formats opérationnels, page phare ${SITE_URL}/fr/interventions/essentielle (${essentiellePrice}).
- [Audit & optimisation](${SITE_URL}/fr/audit) — 4 tailles d'entreprise × 2 modalités.
- [Implémentation IA](${SITE_URL}/fr/implementation) — automatisations et IA Custom.
- [Cas concrets](${SITE_URL}/fr/cas-concrets) — résultats clients chiffrés.

## Stratégie

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted).
- AxionIA OÜ — régime TVA UE.
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
