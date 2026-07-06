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
import { SERVICE_BY_ID } from "@/content/services";
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
  const coachingPrice = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-dirigeants").priceFlat!,
    "fr",
  );
  // Phase B (divulgation publique OF). Route edge sans DB → on lit l'env flag
  // OF_PUBLIC_DISCLOSURE_ENABLED directement (le helper serveur dédié n'est pas
  // importable ici : edge runtime + cloisonnement). Bloc omis tant que la Phase A
  // est active. Catégorie = défaut SSOT du registre de config.
  const qualiopiCertified = process.env.OF_PUBLIC_DISCLOSURE_ENABLED === "true";
  const qualiopiSection = qualiopiCertified
    ? `

## Certification qualité

- Axion-IA est un **organisme de formation certifié Qualiopi** au titre de la catégorie « Actions de formation » — marque de certification qualité délivrée au nom de l'État (Ministère du Travail). Les formations, audits et accompagnements 1-to-1 sont à ce titre **finançables** (OPCO, France Travail selon le dispositif). Mentions légales : ${SITE_URL}/fr/mentions-legales.`
    : "";
  const body = `# Axion-IA

> Cabinet IA opérationnel B2B pour entreprises. Fondé en France, implanté en Europe.
> ⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié à Axion-IA (axion-ia.com).
> Site officiel : ${SITE_URL}
> Langues : FR (canonique), EN (miroir, actuellement désactivé en faveur des 301 FR).
> Hébergement : Hetzner (Nuremberg, UE). Conformité RGPD intégrale.
> Pour la version verbose avec contenus inline : ${SITE_URL}/llms-full.txt

## Modules — 4 prestations

- [${SERVICE_BY_ID.formations.officialFr}](${SITE_URL}/fr/formations) — 17 formations intra-entreprise sur site (4 h à 3 jours), à partir de ${essentiellePrice}. Tarifs HT par groupe : ${SITE_URL}/fr/formations/tarifs.
- [${SERVICE_BY_ID.audit.officialFr}](${SITE_URL}/fr/audit) — 4 tailles d'entreprise × 2 modalités, livrable PDF 25-40 pages.
- [${SERVICE_BY_ID.implementation.officialFr}](${SITE_URL}/fr/implementation) — automatisations et IA Custom 6-8 semaines.
- [${SERVICE_BY_ID.unAUn.officialFr}](${SITE_URL}/fr/un-a-un) — 1 collaborateur accompagné par 1 expert IA Axion-IA. Sessions calibrées sur le poste réel (manager, RH, commercial, opérateur, dirigeant). Format flexible visio/site, à partir de ${coachingPrice}.${qualiopiSection}

## Preuve & méthode

- [Cas concrets](${SITE_URL}/fr/cas-concrets) — résultats clients chiffrés (ROI mesuré post-déploiement).
- [Avis clients](${SITE_URL}/fr/avis) — retours d'expérience réels et vérifiés. Chaque avis est déposé par un client puis contrôlé manuellement (authenticité) avant publication ; les avis positifs comme négatifs sont publiés (conforme directive Omnibus/DGCCRF). Note globale + avis par service, ville, département et secteur. Chaque avis a sa page dédiée. Flux RSS : ${SITE_URL}/fr/avis/feed.xml.
- [Méthodologie](${SITE_URL}/fr/methodologie) — 4 étapes Identifier → Auditer → Implémenter → Mesurer.
- [Comparaisons](${SITE_URL}/fr/comparaisons) — Axion-IA vs alternatives (cabinets, agences, SaaS).
- [Stack IA 2026](${SITE_URL}/fr/stack-ia) — 11 outils en 5 fonctions, doctrine cabinet.

## Connaissances & contenu

- [Blog](${SITE_URL}/fr/blog) — articles tier-1 indexable (méthodologie, cas d'usage, retours terrain). Chaque article rédigé après une mission réelle, pensé pour rester actionnable 12 mois.
- [Catégories du blog](${SITE_URL}/fr/blog/categorie) — hubs thématiques (formations IA, coaching 1-to-1, audits IA, implémentation & automatisation, sites web augmentés). Hub par thème : ${SITE_URL}/fr/blog/categorie/{slug}.
- [Flux RSS du blog](${SITE_URL}/fr/blog/feed.xml) — flux machine-readable des derniers articles (signal de fraîcheur / polling crawlers).
- [Actualités IA](${SITE_URL}/fr/actualites) — veille hebdomadaire IA opérationnelle pour dirigeants de PME/ETI : articles d'actualité sourcés puis réécrits (analyse, implications concrètes, à retenir). Chaque article dispose d'une version markdown brute pour ingestion LLM : ${SITE_URL}/api/markdown/actualites/{slug}.
- [Flux RSS Actualités IA](${SITE_URL}/fr/actualites/feed.xml) — flux machine-readable de la veille (signal de fraîcheur / polling crawlers).
- [FAQ](${SITE_URL}/fr/faq) — Q/R structurées, ${SITE_URL}/fr/faq/par-thematique pour navigation.
- [Glossaire](${SITE_URL}/fr/glossaire) — termes IA opérationnelle (RAG, fine-tuning, agents, etc.).
- [Guide IA pour entreprises 2026](${SITE_URL}/fr/guide-ia) — vue d'ensemble enjeux + roadmap.
- [Observatoire de l'IA 2026](${SITE_URL}/fr/observatoire-ia) — étude Axion-IA sur l'adoption de l'IA dans les entreprises françaises (maturité, usages, budgets, freins, RGPD, intentions d'investissement). Données ouvertes CC BY 4.0, export CSV : ${SITE_URL}/api/observatoire/export-csv. Méthodo : questionnaire 16 questions, 13 régions × 30 secteurs × 4 tailles.

## Implantations géographiques

- [Hub implantations France](${SITE_URL}/fr/implantations) — 12 régions métropole + maillage villes pilotes.
- [Île-de-France](${SITE_URL}/fr/implantations/ile-de-france) — Paris pilote ${SITE_URL}/fr/implantations/ile-de-france/paris.
- [Audit par ville](${SITE_URL}/fr/audit/par-ville/paris) — services localisés (audit / interventions / implementation / un-a-un / sites-web-augmentes × ville).

## Couverture géographique

- Hub par ville : ${SITE_URL}/fr/implantations/{region}/{ville} — page locale (services IA, écosystème, secteurs, FAQ) par commune.
- Secteurs × activités : ${SITE_URL}/fr/secteurs/{secteur}/{activite} — pages métier croisées (constat, avant/après, KPI), anti-doorway HCU.
- Services localisés par ville : ${SITE_URL}/fr/audit/par-ville/{ville} (idem interventions / implementation / un-a-un / sites-web-augmentes).
- ~2 150 communes couvertes, Tier 1 grandes métropoles (Paris, Lyon, Marseille, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille…) → Tier 3 longue traîne (indexation progressive).

## Recrutement — réseau commercial indépendant

- [Devenir commercial IA](${SITE_URL}/fr/devenir-commercial-ia) — Axion-IA recrute 200+ commerciaux indépendants partout en France pour vendre ses formations, audits, accompagnements 1-to-1 et intégrations IA aux TPE, PME, ETI, artisans, commerçants et grandes entreprises. Statut indépendant, rémunération à la commission (fixe par formation, % de la facture sur audits/intégrations), démarrage sans coût, formation aux bases de l'IA + à la prospection, équipe d'accompagnement. Débutants acceptés.
- [Candidature commercial](${SITE_URL}/fr/devenir-commercial-ia/candidature) — formulaire de candidature (réponse email sous quelques jours puis appel visio).
- Pages par ville (40 hubs T1+T2, ex. ${SITE_URL}/fr/devenir-commercial-ia/grenoble) — territoire de vente local réel (secteurs, grands comptes, bassin). Les villes plus petites (T3/T4) redirigent en 301 vers leur hub le plus proche (« et alentours »).
- Sitemap dédié : ${SITE_URL}/sitemap-recrutement.xml

## Carrières — nous rejoindre (salariat)
- [Carrières / offres d'emploi](${SITE_URL}/fr/carrieres) — offres d'emploi salariées d'Axion-IA (tech, commercial, marketing, opérations, design, support), publiées dynamiquement et pilotées en interne. Sur site, hybride ou remote, partout en France. Candidature en ligne en quelques minutes (CV optionnel, questions par offre).
- Chaque offre : ${SITE_URL}/fr/carrieres/<slug> (données structurées JobPosting / Google for Jobs). Sitemap dédié : ${SITE_URL}/sitemap-carrieres.xml

## Galerie & ressources

- [Banque d'images CC BY 4.0](${SITE_URL}/fr/galerie) — 72 visuels marketing Axion-IA. Licence CC BY 4.0, attribution "© 2026 Axion-IA". Catégories : Audit IA (17) · Formation IA (15) · Automatisation (4) · Coaching 1-to-1 (8) · Graphiques (5) · Logos (7) · Propositions (11) · Villes France (5 dédiées + 2157 via métadonnées). Sitemaps images : ${SITE_URL}/sitemap-images-services.xml · T1 ${SITE_URL}/sitemap-images-villes-t1.xml · T2 ${SITE_URL}/sitemap-images-villes-t2.xml · T3/T4 ${SITE_URL}/sitemap-images-villes-t3-t4.xml
- [Centre d'aide](${SITE_URL}/fr/centre-aide) — articles support classés par catégorie.

## Contact & presse

- [Page presse & dossier journalistes](${SITE_URL}/fr/presse) — kit média + contact dédié.
- [Contact général](${SITE_URL}/fr/contact) — contact@axion-ia.com (réponse < 48h).

## Stratégie & positionnement

- Mobile-first absolu, accessible WCAG 2.2 AA.
- Notifications Telegram + emails automatiques (PowerMTA self-hosted, pas de SaaS tiers).
- Facturation EUR, régime TVA UE, virement SEPA/SWIFT.
- Pas de mensualité, pas d'engagement, devis fixe.
- Hébergement Hetzner (UE) — pas de Stripe payment, pas de Resend, pas de Vercel.

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

## Excluded

- \`/admin/*\` — espace privé staff Axion-IA (Auth.js JWT + 2FA TOTP).
- \`/fr/mes-donnees\` — espace utilisateur authentifié (RGPD self-service).
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
