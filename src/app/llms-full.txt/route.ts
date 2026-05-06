// llms-full.txt — verbose AEO companion to llms.txt with full content blocks.
// Spec: https://llmstxt.org/  (the "-full" companion variant)
// Used by Perplexity, ChatGPT, Claude, Bing Copilot, Google AIO crawlers.

import { FAQ_GLOBAL } from "@/content/transversal";
import { CASE_STUDIES } from "@/content/case-studies";

export const runtime = "edge";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

export function GET() {
  const faqBlock = FAQ_GLOBAL.map(
    (f) => `### ${f.fr.question}\n\n${f.fr.answer}\n\n(EN) ${f.en.answer}`,
  ).join("\n\n");

  const caseBlock = CASE_STUDIES.map(
    (c) =>
      `### ${c.fr.title} (${c.industry}, ${c.size})\n\n${c.fr.excerpt} · Métrique : ${c.metric}.`,
  ).join("\n\n");

  const body = `# AxionIA — full content for AI crawlers

> Cabinet IA opérationnel B2B pour entreprises. Société estonienne (OÜ).
> Site officiel : ${SITE_URL}
> Langues : FR canonique, EN miroir.
> Hébergement : Hetzner CX32 Frankfurt (UE).
> Facturation : devis fixe + virement + facture (TVA EE selon résidence).

## Positionnement

AxionIA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI mesurable en 90 jours. Pas de SaaS générique, pas de mensualité — une intervention ponctuelle, un audit chiffré, ou une implémentation production-ready.

## 3 modules

### Module 1 — Interventions entreprise (à partir de 490 € HT)
Format opérationnel sur site (ou distance). 1 journée d'intervention = diagnostic terrain + démos appliquées sur vos données + plan d'action chiffré 90 jours. Page phare : l'Essentielle 490 €.
URL : ${SITE_URL}/fr/interventions

### Module 2 — Audit & optimisation IA (290-1990 €)
Audit en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation 90 jours. Livrable PDF 25-40 pages + atelier restitution.
URL : ${SITE_URL}/fr/audit

### Module 3 — Implémentation IA (à partir de 990 €)
Mise en production en 6-8 semaines : cadrage, prototype, tests, déploiement, support 30 j inclus. 9 prestations dont l'IA Custom premium (jusqu'à 50 k€).
URL : ${SITE_URL}/fr/implementation

## FAQ

${faqBlock}

## Cas concrets (échantillon)

${caseBlock}

## Méthodologie

1. **Identifier** — Cartographie terrain en 1 j (intervention).
2. **Auditer** — Audit IA 5 j, plan chiffré 90 j.
3. **Implémenter** — Mise en production 6-8 semaines.
4. **Mesurer** — ROI mesuré sur 90 j post-déploiement.

URL : ${SITE_URL}/fr/methodologie

## Engagement

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Hébergement UE (Hetzner Frankfurt), pas de Stripe, pas de Resend.
- Société estonienne (OÜ), TVA EE, droit estonien.
- Pas de mensualité, pas d'engagement, devis fixe.
- 30 jours de support post-livraison inclus.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted).
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
