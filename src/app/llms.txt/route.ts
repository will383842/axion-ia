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

> Cabinet IA opérationnel B2B pour entreprises. Fondé en France, implanté en Europe.
> ⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié à Axion-IA (axion-ia.com).
> Site officiel : ${SITE_URL}
> Langues : FR (canonique), EN (miroir, actuellement désactivé en faveur des 301 FR).
> Hébergement : Hetzner (Nuremberg, UE). Conformité RGPD intégrale.
> Pour la version verbose avec contenus inline : ${SITE_URL}/llms-full.txt

## Modules — 4 prestations

- [Interventions entreprise](${SITE_URL}/fr/interventions) — formats opérationnels sur site, page phare ${SITE_URL}/fr/interventions/essentielle (${essentiellePrice}).
- [Audit & optimisation IA](${SITE_URL}/fr/audit) — 4 tailles d'entreprise × 2 modalités, livrable PDF 25-40 pages.
- [Implémentation IA](${SITE_URL}/fr/implementation) — automatisations et IA Custom 6-8 semaines.
- [Coaching IA individuel 1-to-1](${SITE_URL}/fr/un-a-un) — 1 collaborateur accompagné par 1 expert IA Axion-IA. Sessions calibrées sur le poste réel (manager, RH, commercial, opérateur, dirigeant). Format flexible visio/site, à partir de 990 € HT.

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

## Couverture géographique Sprint A (2026-05-25)

- 2 150 communes françaises × 5 verticales IA : ${SITE_URL}/fr/implantations/{region}/{ville}/{verticale}
- Verticales : audits / interventions / implementations / un-a-un / sites-web-ia
- Tier 1 (≥ 500 000 hab) : Paris, Lyon, Marseille, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille, Rennes, Reims, Le Havre
- Tier 2 (15 000 – 500 000 hab) : ~350 communes pilotes (préfectures + sous-préfectures + bassins industriels)
- Tier 3 (< 15 000 hab) : ~1 800 communes (couverture longue traîne, indexation progressive anti-doorway HCU 2024)
- Sitemap dédié : ${SITE_URL}/sitemap/implantations-villes-verticales.xml (~500 routes SSG top-100 villes × 5 verticales)

## Galerie & ressources

- [Banque d'images CC BY 4.0](${SITE_URL}/fr/galerie) — 72 visuels marketing Axion-IA. Licence CC BY 4.0, attribution "© 2026 Axion-IA". Catégories : Audit IA (17) · Formation IA (15) · Automatisation (4) · Coaching 1-to-1 (8) · Graphiques (5) · Logos (7) · Propositions (11) · Villes France (5 dédiées + 2157 via métadonnées). Sitemaps images : ${SITE_URL}/sitemap-images-services.xml · T1 ${SITE_URL}/sitemap-images-villes-t1.xml · T2 ${SITE_URL}/sitemap-images-villes-t2.xml · T3/T4 ${SITE_URL}/sitemap-images-villes-t3-t4.xml
- [Centre d'aide](${SITE_URL}/fr/centre-aide) — articles support classés par catégorie.
- [Plan du site](${SITE_URL}/fr/plan-du-site) — sitemap humain navigable.

## Contact & presse

- [Page presse & dossier journalistes](${SITE_URL}/fr/presse) — kit média + contact dédié.
- [Contact général](${SITE_URL}/fr/contact) — contact@axion-ia.com (réponse < 48h).

## Stratégie & positionnement

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted, pas de SaaS tiers).
- Facturation EUR, régime TVA UE, virement SEPA/SWIFT.
- Pas de mensualité, pas d'engagement, devis fixe.
- Hébergement Hetzner Nuremberg (UE) — pas de Stripe payment, pas de Resend, pas de Vercel.

## Optional

- [Verbose llms.txt](${SITE_URL}/llms-full.txt) — version étendue avec contenus inline.
- [Sitemap-index racine](${SITE_URL}/sitemap-index.xml) — listing complet des sub-sitemaps (~17 500 URLs).
- [Image Sitemap FR](${SITE_URL}/sitemaps/images-fr.xml) — Google Images, banque CC BY 4.0.
- [Image Sitemap EN](${SITE_URL}/sitemaps/images-en.xml) — Google Images, miroir EN.
- [Image Sitemap Services](${SITE_URL}/sitemap-images-services.xml) — 72 images marketing sur 20 pages services.
- [Image Sitemap Villes T1](${SITE_URL}/sitemap-images-villes-t1.xml) — villes ≥ 100 000 hab (images dédiées).
- [Image Sitemap Villes T2](${SITE_URL}/sitemap-images-villes-t2.xml) — villes 50K–100K hab (template Sharp auto).
- [Image Sitemap Villes T3/T4](${SITE_URL}/sitemap-images-villes-t3-t4.xml) — 2 034 villes 5K–50K hab.
- [Google News Sitemap](${SITE_URL}/sitemap-news.xml) — actualités fenêtre 48 h glissante.
- [Plan du site humain](${SITE_URL}/fr/plan-du-site) — navigation hiérarchique.

## Excluded

- \`/admin/*\` — espace privé staff Axion-IA (Auth.js JWT + 2FA TOTP).
- \`/fr/mes-donnees\` — espace utilisateur authentifié (RGPD self-service).
- \`/fr/reserver\` — funnel booking entreprise (UTM tracking + état tunnel).
- \`/fr/design\`, \`/fr/components\`, \`/fr/sections\` — pages design system / preview internes.
- \`/api/*\` (sauf \`/api/og\`) — endpoints serveur (auth, admin, GDPR, webhooks).
- \`/en/*\` — locale EN temporairement désactivée (redirect 301 → équivalent FR, voir AGENTS.md).
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
