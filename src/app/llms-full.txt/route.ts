// llms-full.txt — verbose AEO companion to llms.txt with full content blocks.
// Spec: https://llmstxt.org/  (the "-full" companion variant)
// Used by Perplexity, ChatGPT, Claude, Bing Copilot, Google AIO crawlers.

import { FAQ_GLOBAL } from "@/content/transversal";
import { CASE_STUDIES } from "@/content/case-studies";
import { SERVICE_BY_ID } from "@/content/services";
import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  formatAmountRange,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";
import { SITE_URL } from "@/lib/seo";

export const runtime = "edge";

export function GET() {
  // Sprint 14.10.5 — prix dérivés du SSOT pricing.ts (zéro hardcode).
  // L'ancienne mention « 290-1990 € » audit était OBSOLÈTE (les vrais tiers
  // commencent à 490 €). Range complet du catalogue audit (Flash → ETI).
  const interventionsEntry = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    "fr",
  );
  const interventionsCompact = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    "fr",
    { compact: true },
  );
  const auditFlashAmount = getTierById(AUDIT_TIERS, "audit-flash").priceFlat!;
  const auditPmeMax = getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMax!;
  const auditRange = formatAmountRange(auditFlashAmount, auditPmeMax, "fr");
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "fr").replace(/^dès\s/, "à partir de ");
  // intervention-dirigeants alimente le 1-to-1 (UN_A_UN_TIERS).
  const coachingEntry = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-dirigeants").priceFlat!,
    "fr",
  );

  const faqBlock = FAQ_GLOBAL.map(
    (f) => `### ${f.fr.question}\n\n${f.fr.answer}\n\n(EN) ${f.en.answer}`,
  ).join("\n\n");

  const caseBlock = CASE_STUDIES.map(
    (c) =>
      `### ${c.fr.title} (${c.industry}, ${c.size})\n\n${c.fr.excerpt} · Métrique : ${c.metric}.`,
  ).join("\n\n");

  const body = `# Axion-IA — full content for AI crawlers

> Cabinet IA opérationnel B2B pour entreprises. Fondé en France, implanté en Europe.
> ⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié à Axion-IA (axion-ia.com).
> Site officiel : ${SITE_URL}
> Langues : FR canonique, EN miroir.
> Hébergement : Hetzner CPX32 Frankfurt (UE).
> Facturation : devis fixe + virement + facture (régime TVA UE selon résidence).

## Positionnement

Axion-IA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI chiffré et mesurable. Pas de SaaS générique, pas de mensualité — une intervention ponctuelle, un audit chiffré, ou une implémentation production-ready.

## 4 modules

### Module 1 — ${SERVICE_BY_ID.formations.officialFr} (à partir de ${interventionsEntry})
Format opérationnel sur site (ou distance). 1 journée d'intervention = diagnostic terrain + démos appliquées sur vos données + plan d'action chiffré priorisé. Page phare : l'Essentielle ${interventionsCompact}.
URL : ${SITE_URL}/fr/interventions

### Module 2 — ${SERVICE_BY_ID.audit.officialFr} (${auditRange})
Audit en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation priorisé. Livrable PDF 25-40 pages + atelier restitution.
URL : ${SITE_URL}/fr/audit

### Module 3 — ${SERVICE_BY_ID.implementation.officialFr} (${implEntry})
Mise en production en 6-8 semaines : cadrage, prototype, tests, déploiement, support 30 j inclus. 9 prestations dont l'IA Custom premium (sur devis).
URL : ${SITE_URL}/fr/implementation

### Module 4 — ${SERVICE_BY_ID.unAUn.officialFr} (à partir de ${coachingEntry})
1 collaborateur accompagné par 1 expert IA Axion-IA. Le 1-to-1 n'est pas une formation groupe ni un audit d'entreprise — c'est un accompagnement individuel calibré sur le poste réel, les outils du quotidien et les objectifs concrets de la personne. Cible : manager, RH, commercial, opérateur, dirigeant. Format sessions flexibles (visio ou sur site). Cadrage 30 min gratuit, progression mesurable à chaque étape.
URL : ${SITE_URL}/fr/un-a-un

## FAQ

${faqBlock}

## Cas concrets (échantillon)

${caseBlock}

## Méthodologie

1. **Identifier** — Cartographie terrain en 1 j (intervention).
2. **Auditer** — Audit IA 5 j, plan chiffré priorisé.
3. **Implémenter** — Mise en production 6-8 semaines.
4. **Mesurer** — ROI mesuré post-déploiement.

URL : ${SITE_URL}/fr/methodologie

## Engagement

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Hébergement UE (Hetzner Frankfurt), pas de Stripe, pas de Resend.
- Facturation EUR, régime TVA UE, virement SEPA/SWIFT.
- Pas de mensualité, pas d'engagement, devis fixe.
- 30 jours de support post-livraison inclus.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted).
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
