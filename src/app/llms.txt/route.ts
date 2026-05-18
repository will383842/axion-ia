// llms.txt — high-signal site map for AI crawlers (axionia-seo-aeo).
// Spec: https://llmstxt.org/
// Sprint 14 livré `llms-full.txt` (companion verbose).
//
// Audit indexation 2026-05-18 P1-9 — enrichissement de 4 à 14 entrées
// couvrant tous les modules sitemap (Modules + Connaissances + Implantations
// + Ressources + Aide). Cible AEO : Claude.ai / ChatGPT Search / Perplexity
// / Bing Copilot indexent les URLs listées en priorité — manquer une section
// = perdre la visibilité de cette catégorie de contenu côté LLMs.
//
// Vérification prod 2026-05-18 — bug GHA Docker layer cache : edge runtime
// chunk reused stale despite source file modified. Le commit suivant invalide
// le hash via cette ligne pour forcer rebuild fresh du chunk au prochain
// deploy (sans changement comportement, juste cache-busting).
// Source de vérité = ce fichier, build expected sections = Modules,
// Preuve & méthode, Connaissances & contenu, Implantations géographiques,
// Galerie & ressources, Contact & presse, Stratégie & positionnement.

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
  const body = `# Axion-IA

> Cabinet IA opérationnel B2B pour entreprises. Cabinet européen (Axion-IA OÜ).
> Site officiel : ${SITE_URL}
> Langues : FR (canonique), EN (miroir, actuellement désactivé en faveur des 301 FR).
> Hébergement : Hetzner (Nuremberg, UE). Conformité RGPD intégrale.
> Pour la version verbose avec contenus inline : ${SITE_URL}/llms-full.txt

## Modules — 3 prestations

- [Interventions entreprise](${SITE_URL}/fr/interventions) — formats opérationnels sur site, page phare ${SITE_URL}/fr/interventions/essentielle (${essentiellePrice}).
- [Audit & optimisation IA](${SITE_URL}/fr/audit) — 4 tailles d'entreprise × 2 modalités, livrable PDF 25-40 pages.
- [Implémentation IA](${SITE_URL}/fr/implementation) — automatisations et IA Custom 6-8 semaines.

## Preuve & méthode

- [Cas concrets](${SITE_URL}/fr/cas-concrets) — résultats clients chiffrés (ROI mesuré post-déploiement).
- [Méthodologie](${SITE_URL}/fr/methodologie) — 4 étapes Identifier → Auditer → Implémenter → Mesurer.
- [Comparaisons](${SITE_URL}/fr/comparaisons) — Axion-IA vs alternatives (cabinets, agences, SaaS).
- [Stack IA 2026](${SITE_URL}/fr/stack-ia) — 11 outils en 5 fonctions, doctrine cabinet.

## Connaissances & contenu

- [Blog](${SITE_URL}/fr/blog) — articles tier-1 indexable (méthodologie, cas d'usage, retours terrain).
- [FAQ](${SITE_URL}/fr/faq) — Q/R structurées, ${SITE_URL}/fr/faq/par-thematique pour navigation.
- [Glossaire](${SITE_URL}/fr/glossaire) — termes IA opérationnelle (RAG, fine-tuning, agents, etc.).
- [Guide IA pour entreprises 2026](${SITE_URL}/fr/guide-ia) — vue d'ensemble enjeux + roadmap.

## Implantations géographiques

- [Hub implantations France](${SITE_URL}/fr/implantations) — 12 régions métropole + maillage villes pilotes.
- [Île-de-France](${SITE_URL}/fr/implantations/ile-de-france) — Paris pilote ${SITE_URL}/fr/implantations/ile-de-france/paris.
- [Audit par ville](${SITE_URL}/fr/audit/par-ville/paris) — services localisés (audit / interventions / implementation × ville).

## Galerie & ressources

- [Banque d'images CC BY 4.0](${SITE_URL}/fr/galerie) — visuels SEO/AEO/GEO sous licence Creative Commons Attribution.
- [Centre d'aide](${SITE_URL}/fr/centre-aide) — articles support classés par catégorie.
- [Plan du site](${SITE_URL}/fr/plan-du-site) — sitemap humain navigable.

## Contact & presse

- [Page presse & dossier journalistes](${SITE_URL}/fr/presse) — kit média + contact dédié.
- [Contact général](${SITE_URL}/fr/contact) — contact@axion-ia.com (réponse < 48h).

## Stratégie & positionnement

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted, pas de SaaS tiers).
- Axion-IA OÜ — régime TVA UE, facturation EUR.
- Pas de mensualité, pas d'engagement, devis fixe.
- Hébergement Hetzner Nuremberg (UE) — pas de Stripe payment, pas de Resend, pas de Vercel.
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
