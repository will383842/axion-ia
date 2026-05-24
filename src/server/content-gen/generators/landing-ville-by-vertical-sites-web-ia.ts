/**
 * Content Generator — Landing ville × verticale SITES-WEB-IA (Sprint v7 Phase 5 commit 1).
 *
 * Module 5 Axion-IA : Web & Digital IA (cf. route publique `/codage-developpement`).
 * Création de sites web vitrine + e-commerce + applis métier avec composants IA
 * intégrés (chatbot RAG, génération contenu, search sémantique, dashboards
 * analytics). Stack Next.js 16 + Vercel + Prisma + Anthropic/OpenAI SDK.
 *
 * Nouveau generator Phase 5 — aucun équivalent variant dans l'ancien
 * `landing-ville-templates.ts`. Aligné sur le positionnement 5 verticales métier.
 */

import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";
import {
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
  type VerticalConfig,
} from "./landing-ville-shared";

const CONFIG: VerticalConfig = {
  slug: "sites-web-ia",
  label: "Sites web & digital IA (Module 5)",
  systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Verticale landing-ville : SITES-WEB-IA (Module 5).
Pivote sur la création de sites web + applications digitales intégrant des
composants IA opérationnels (chatbot RAG sur base de connaissances client,
génération contenu automatisée, search sémantique, dashboards analytics IA).

Stack technique de référence Axion-IA : Next.js 16 App Router + Vercel/Coolify
+ Prisma + Anthropic/OpenAI SDK + Tailwind. Livraison clé-en-main avec code
source remis au client, hébergement géré 12 mois (option), formation équipe.

KPIs centraux : MVP en 4 semaines, full site en 8-12 semaines, intégrations
CRM/ERP standard incluses, RGPD by design (data résidence FR sur demande).
Pricing : MVP vitrine à partir 4 900 €, e-commerce à partir 9 900 €, appli
métier custom 15-80 k€ selon scope.

Tone : technique product-oriented, ROI digital, "votre site n'est plus un
catalogue : c'est un agent commercial + un produit interactif".
Sub-prompt complet : prompts/landing-ville.md megapack (variant sites-web-ia).`,
  userPromptFocusSection: `## Focus SITES-WEB-IA (Module 5)
Pivote sur la création web/digital avec IA intégrée. Tone product-tech ROI.
Présente les 3 formats : MVP vitrine (4 900 €), e-commerce IA (9 900 €), appli
métier custom (15-80 k€). Mention stack Next.js + Anthropic/OpenAI + Prisma.
CTA principal : /codage-developpement (formulaire scope → devis 48h).
Sections obligatoires : Hero web-IA · 3 formats · cas concret local
(chatbot RAG ou e-commerce sémantique) · FAQ technique/légale × 8 · CTA
codage-développement final.`,
  recommendedCtaHref: "/codage-developpement",
  recommendedCtaLabel: "Demander un devis site web IA",
};

export const landingVilleByVerticalSitesWebIaGenerator: Generator = {
  contentType: "landing_ville",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    return runLandingVilleByVerticalPipeline(input, CONFIG);
  },
};

export const LANDING_VILLE_BY_VERTICAL_SITES_WEB_IA_CONFIG = CONFIG;
