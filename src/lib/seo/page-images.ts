// ============================================================================
// SSOT — Manifeste d'images par page (SEO / Google Images / AEO)
// ============================================================================
//
// Source unique de vérité pour les images « éditoriales/marketing » réellement
// affichées sur chaque page de service. Consommée par TROIS consommateurs, ce
// qui garantit qu'ils ne divergent JAMAIS (avant ce module, le JSON-LD des pages
// et le sitemap images étaient déclarés à deux endroits distincts qui avaient
// dérivé : le sitemap pointait encore l'ancienne architecture `-ia` + d'anciennes
// images, laissant les vraies photos hors de toute couverture Google Images) :
//
//   1. Le rendu `<Image>` de la page (src + alt + dimensions).
//   2. Le JSON-LD `ImageObject` @graph (via `buildPageImageGraphJsonLd`, seo.ts).
//   3. Le sitemap images (`app/sitemap-images-services.xml/route.ts`).
//
// RÈGLE : une image ajoutée/retirée ici se propage automatiquement et à
// l'identique dans le DOM, le JSON-LD et le sitemap — avec la MÊME URL crawlable.
//
// ⚠️ Contrainte URL : `src` doit être le chemin d'un fichier statique RÉELLEMENT
// servi et crawlable (sous `/public`, donc `Allow: /` dans robots.txt). C'est
// cette URL brute qui devient le `contentUrl` du JSON-LD ET le `<image:loc>` du
// sitemap — cohérence de bout en bout (le rendu passe, lui, par l'optimiseur
// `/_next/image`, ce qui est sans incidence : le sitemap est la voie de
// découverte autoritaire pour Google Images).
//
// ⚠️ Les `alt`/`name` DOIVENT rester identiques au texte déjà rendu par la page
// (aucune régression a11y/SEO). En cas de doute, la page est la référence.

import { CLIENT_SECTORS } from "@/content/sectors";

/** Emplacement de rendu de l'image sur la page (pour que la page filtre son manifeste). */
export type PageImageSlot =
  | "grid" // grille de photos illustratives
  | "banner" // bandeau full-bleed / quadriptyque
  | "portrait" // portrait fondateur / formateur
  | "hero" // visuel principal du héros
  | "inline"; // illustration inline dans le corps

export interface PageImage {
  /** Chemin racine du fichier statique servi (crawlable). Ex. "/illustrations/formations/x.png". */
  src: string;
  nameFr: string;
  nameEn: string;
  altFr: string;
  altEn: string;
  width: number;
  height: number;
  /**
   * `true` = image représentative de la page (héro). Une seule par page idéalement.
   * Émet `representativeOfPage: true` sur l'ImageObject + sert de
   * `primaryImageOfPage` sur le nœud WebPage/CollectionPage.
   */
  representativeOfPage?: boolean;
  /** Emplacement de rendu (permet à la page de filtrer). Optionnel (SEO-only si absent). */
  slot?: PageImageSlot;
  /** Format d'encodage MIME. Défaut déduit de l'extension du fichier. */
  encodingFormat?: string;
}

export interface PageImagesManifest {
  /** Path SANS préfixe de locale. Ex. "/formations". */
  path: string;
  images: readonly PageImage[];
}

// ---------------------------------------------------------------------------
// Secteurs — piliers `/secteurs/[secteur]` (généré depuis le SSOT CLIENT_SECTORS)
// ---------------------------------------------------------------------------
// 2 images par pilier :
//   1. Photo héro sectorielle Unsplash locale (1600×1000, `representativeOfPage`,
//      slot "hero") — rendue à droite du h1 (cf. `SectorHeroMedia`). Crédit
//      photographe rendu sur la page (CGU §9) + tracé dans `sector-photos.ts`.
//   2. Portrait fondateur (slot "portrait") — rendu dans le bandeau « Qui vous
//      accompagne ». Alt contextualisé par secteur, angle équipe.
// Les deux → couvrent le JSON-LD ImageObject @graph + le sitemap images.
const SECTOR_PAGE_IMAGES: readonly PageImagesManifest[] = CLIENT_SECTORS.map((s) => ({
  path: `/secteurs/${s.slug}`,
  images: [
    {
      src: `/illustrations/secteurs/${s.slug}.avif`,
      nameFr: `${s.labelFr} et intelligence artificielle — Axion-IA`,
      nameEn: `${s.labelFr} and artificial intelligence — Axion-IA`,
      altFr: `${s.labelFr} et intelligence artificielle — Axion-IA accompagne ${s.fullFr} (audit, formation, implémentation, 1-to-1, sites web augmentés).`,
      altEn: `${s.labelFr} and artificial intelligence — Axion-IA supports ${s.fullFr} (audit, training, implementation, 1-to-1, AI-augmented websites).`,
      width: 1600,
      height: 1000,
      representativeOfPage: true,
      slot: "hero",
    },
    {
      src: "/illustrations/home-founder-william.avif",
      nameFr: `Williams — Fondateur Axion-IA, référent IA pour ${s.labelFr}`,
      nameEn: `Williams — Axion-IA founder, AI lead for ${s.labelFr}`,
      altFr: `Portrait de Williams, fondateur d'Axion-IA. Avec son équipe, il accompagne ${s.fullFr} sur l'IA — audit, formation, implémentation, 1-to-1 et sites web augmentés, avec des cas d'usage métier chiffrés.`,
      altEn: `Portrait of Williams, Axion-IA founder. With his team, he supports ${s.fullFr} on AI — audit, training, implementation, 1-to-1 and AI-augmented websites, with quantified business use cases.`,
      width: 800,
      height: 1000,
      slot: "portrait",
    },
  ],
}));

// ---------------------------------------------------------------------------
// Manifeste
// ---------------------------------------------------------------------------
// Ordonné par pilier. Chaque entrée = une route RÉELLE de l'App Router.

export const PAGE_IMAGES_MANIFEST: readonly PageImagesManifest[] = [
  // ===== Cas concrets (index / listing) =====
  // Images SEO-only (pas rendues en <Image> sur la page : le héro affiche des
  // mini-cards CaseStudiesHeroSchema). Ce sont les photos « proof social » —
  // équipe + portrait fondateur — réutilisées depuis la home pour exposer les
  // références clients sur Google Images + AI Overviews. Aucun `slot` (aucune
  // grille à filtrer côté page). Centralisées ici (2026-07-01) : avant, elles
  // étaient déclarées inline dans la page ET absentes du sitemap images.
  {
    path: "/cas-concrets",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — proof social cas clients IA",
        nameEn: "Axion-IA team — case studies social proof",
        altFr:
          "Équipe Axion-IA en session de cadrage cas client IA — cabinet IA opérationnel français accompagnant TPE, PME, ETI et grandes entreprises avec preuves chiffrées et témoignages vérifiés.",
        altEn:
          "Axion-IA team in client case scoping session — French operational AI consultancy supporting SMEs, mid-caps and large enterprises with quantified proofs and verified testimonials.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA et garant des cas clients",
        nameEn: "Williams — Axion-IA founder, guarantor of client case studies",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les missions cas clients IA et garantit l'authenticité des résultats chiffrés présentés sur Axion-IA — ROI mesuré, témoignages vérifiés.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives client AI missions and guarantees the authenticity of quantified results presented on Axion-IA — measured ROI, verified testimonials.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Secteurs (hub /secteurs) =====
  // Image représentative rendue en <Image> à droite du h1 (Section `media`).
  // Réutilise le bandeau équipe (déjà servi statiquement sous /public, donc
  // crawlable) → se propage à l'identique au JSON-LD ImageObject + au sitemap
  // images pour Google Images sur « IA par secteur », « IA pour [métier] ».
  {
    path: "/secteurs",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — l'IA appliquée à chaque secteur d'activité",
        nameEn: "Axion-IA team — AI applied to every business sector",
        altFr:
          "Équipe Axion-IA en session de cadrage sectoriel — cabinet IA opérationnel français accompagnant comptabilité, BTP, santé, juridique, commerce, industrie, RH et collectivités avec des cas d'usage métier chiffrés.",
        altEn:
          "Axion-IA team in a sector scoping session — French operational AI consultancy supporting accounting, construction, healthcare, legal, retail, industry, HR and public sector with quantified business use cases.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
        slot: "hero",
      },
    ],
  },
  // ===== Formations équipe =====
  {
    path: "/formations",
    images: [
      {
        src: "/illustrations/formations/formateur-ia-claude-atelier-pme.png",
        nameFr: "Formateur IA présentant Claude en atelier PME",
        nameEn: "AI trainer presenting Claude in SME workshop",
        altFr:
          "Formateur IA expert Axion-IA présentant Claude à des collaborateurs PME française — atelier pratique sur les vrais outils métier en formation IA opérationnelle.",
        altEn:
          "Expert Axion-IA AI trainer presenting Claude to French SME team members — hands-on workshop on real business tools in operational AI training.",
        width: 1024,
        height: 768,
        slot: "grid",
      },
      {
        src: "/illustrations/formations/equipe-pme-formation-ia-atelier-pratique.png",
        nameFr: "Équipe PME engagée en atelier formation IA",
        nameEn: "Engaged SME team in AI training workshop",
        altFr:
          "Équipe PME engagée en formation IA — apprenants en atelier pratique automatisations métier sur leurs vrais outils, montée en compétence opérationnelle Axion-IA.",
        altEn:
          "Engaged SME team in AI training — learners in hands-on business automation workshop on their real tools, operational upskilling by Axion-IA.",
        width: 1024,
        height: 768,
        slot: "grid",
      },
      {
        src: "/illustrations/formations/salle-formation-ia-entreprise-sur-site.png",
        nameFr: "Formation IA sur site entreprise",
        nameEn: "On-site corporate AI training",
        altFr:
          "Salle de formation IA sur site entreprise — Axion-IA forme les équipes TPE, PME, ETI sur ChatGPT, Claude, Mistral et les outils IA quotidien pour gagner du temps.",
        altEn:
          "On-site corporate AI training room — Axion-IA trains SME, mid-cap and large enterprise teams on ChatGPT, Claude, Mistral and daily AI tools for time savings.",
        width: 1024,
        height: 768,
        slot: "grid",
      },
      {
        src: "/illustrations/formations/bilan-formation-ia-equipe-autonome.png",
        nameFr: "Bilan formation IA équipe autonome",
        nameEn: "AI training review with autonomous team",
        altFr:
          "Bilan de formation IA — équipe entreprise française autonome sur ChatGPT, Claude, Mistral et automatisations métier, gains de temps mesurés après l'intervention Axion-IA.",
        altEn:
          "AI training review — autonomous French corporate team on ChatGPT, Claude, Mistral and business automations, measured time savings after Axion-IA intervention.",
        width: 1024,
        height: 768,
        slot: "grid",
      },
      {
        src: "/illustrations/formation-claude-team-quadriptyque.png",
        nameFr: "Séquence formation IA Axion-IA quadriptyque — 4 moments d'intervention",
        nameEn: "Axion-IA AI training sequence quadriptych — 4 intervention moments",
        altFr:
          "Séquence formation IA Axion-IA en entreprise : présentation au tableau, démo écran Claude, équipe collaborative en atelier pratique, salle de formation sur site avec formateur IA expert.",
        altEn:
          "Axion-IA corporate AI training sequence: tableau presentation, Claude screen demo, collaborative team in hands-on workshop, on-site training room with expert AI trainer.",
        width: 2400,
        height: 800,
        representativeOfPage: true,
        slot: "banner",
      },
      {
        src: "/illustrations/william-fondateur-formateur-ia-axion-ia.png",
        nameFr: "Williams — Fondateur Axion-IA et formateur IA",
        nameEn: "Williams — Axion-IA founder and AI trainer",
        altFr:
          "Williams, fondateur Axion-IA et formateur IA — portrait posé devant olivier, ambiance méditerranée. Forme les équipes TPE, PME, ETI et grandes entreprises françaises avec une équipe de formateurs experts dédiés.",
        altEn:
          "Williams, Axion-IA founder and AI trainer — portrait in front of olive tree, Mediterranean atmosphere. Trains French SME, mid-cap and large enterprise teams with a dedicated team of expert trainers.",
        width: 800,
        height: 1000,
        slot: "portrait",
      },
    ],
  },
  // ===== Audit IA (hub) =====
  // Images SEO-only rendues dans des sous-composants Audit* (pas de <Image> direct).
  {
    path: "/audit",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — audit IA stratégique pour entreprises",
        nameEn: "Axion-IA team — strategic AI audit for companies",
        altFr:
          "Équipe Axion-IA en session de cadrage audit IA — cabinet IA opérationnel français pour TPE, PME, ETI et grandes entreprises. Audit sur place, Ciblé, Stratégique PME et ETI.",
        altEn:
          "Axion-IA team in AI audit scoping session — French operational AI consultancy for SMEs, mid-caps and large enterprises. On-site, Targeted, Strategic SME and mid-cap audits.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA et auditeur IA",
        nameEn: "Williams — Axion-IA founder and AI auditor",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Réalise personnellement les audits IA stratégiques pour dirigeants TPE, PME, ETI et grandes entreprises françaises — cartographie IA, ROI chiffré, roadmap 6-12 mois.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally conducts strategic AI audits for French SME, mid-cap and large enterprise executives — AI mapping, quantified ROI, 6-12 month roadmap.",
        width: 800,
        height: 1000,
      },
      {
        src: "/illustrations/methodologie-audit-ia-8-etapes-v5.webp",
        nameFr: "Méthodologie d'audit IA Axion-IA en 8 étapes",
        nameEn: "Axion-IA AI audit methodology in 8 steps",
        altFr:
          "Méthodologie d'audit IA Axion-IA en 8 étapes illustrées : cadrage, entretiens métier, consolidation et analyse, filtrage des options, évaluation et recommandations chiffrées (ROI), restitution et feuille de route, mise en œuvre, adoption et pilotage dans la durée — chaque étape avec son livrable.",
        altEn:
          "Axion-IA AI audit methodology in 8 illustrated steps: scoping, business interviews, consolidation and analysis, option filtering, evaluation and costed recommendations (ROI), read-out and roadmap, implementation, adoption and long-term steering — each step with its deliverable.",
        width: 1983,
        height: 793,
      },
      {
        src: "/illustrations/audit-segments-entreprise-v2.webp",
        nameFr: "Audit IA en entreprise par taille — TPE, PME, ETI & grandes entreprises",
        nameEn:
          "Enterprise AI audit by company size — small business, SME, mid-cap & large enterprise",
        altFr:
          "Audit IA en entreprise Axion-IA par taille : TPE, artisans et commerçants (1 journée sur site), PME (de 2 jours à plusieurs semaines), ETI et grandes entreprises (multi-sites, accompagnement long terme) — durée, prix et périmètre adaptés à chaque profil.",
        altEn:
          "Axion-IA enterprise AI audit by company size: small businesses, artisans and retailers (1 on-site day), SMEs (2 days to several weeks), mid-caps and large enterprises (multi-site, long-term support) — duration, price and scope tailored to each profile.",
        width: 1536,
        height: 1024,
      },
    ],
  },
  // ===== Implémentation — Agents IA =====
  {
    path: "/implementation/agents",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — agents IA autonomes pour entreprises",
        nameEn: "Axion-IA team — autonomous AI agents for companies",
        altFr:
          "Équipe Axion-IA conçoit et déploie des agents IA autonomes pour TPE, PME et ETI — workflows multi-étapes, tool use, mémoire longue, supervision humaine, orchestration LangGraph et CrewAI.",
        altEn:
          "Axion-IA team designs and deploys autonomous AI agents for small businesses, SMEs and mid-caps — multi-step workflows, tool use, long memory, human oversight, LangGraph and CrewAI orchestration.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert agents IA agentiques",
        nameEn: "Williams — Axion-IA founder, agentic AI expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets d'agents IA agentiques pour dirigeants TPE et PME — choix framework, orchestration, garde-fous, production sécurisée.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives agentic AI projects for small business and SME executives — framework choice, orchestration, guardrails, secure production deployment.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation (hub) =====
  {
    path: "/implementation",
    images: [
      {
        src: "/illustrations/implementation-piliers-axion-ia.webp",
        nameFr: "Les 4 piliers de l'implémentation IA Axion-IA",
        nameEn: "The 4 pillars of Axion-IA AI implementation",
        altFr:
          "Les 4 piliers de l'implémentation IA Axion-IA : Implémentation (de la stratégie à la réalité), Agents IA (vos collaborateurs intelligents), Intégration native (dans votre écosystème) et Performance (mesurable, durable, réelle).",
        altEn:
          "The 4 pillars of Axion-IA AI implementation: Implementation (from strategy to reality), AI agents (your intelligent coworkers), Native integration (into your ecosystem) and Performance (measurable, lasting, real).",
        width: 1600,
        height: 484,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/william-fondateur-axion-ia.webp",
        nameFr: "Williams — Fondateur & CEO Axion-IA",
        nameEn: "Williams — Founder & CEO Axion-IA",
        altFr:
          "Portrait de Williams, fondateur et CEO d'Axion-IA — pilote les implémentations IA (agents IA, automatisations, RAG, intégrations CRM/ERP) avec une exigence technique et une relation directe et humaine.",
        altEn:
          "Portrait of Williams, Axion-IA founder and CEO — drives AI implementations (AI agents, automations, RAG, CRM/ERP integrations) with technical rigour and a direct, human relationship.",
        width: 1000,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — IA sur-mesure =====
  {
    path: "/implementation/ia-custom",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — IA sur-mesure intégrée dans le SI entreprise",
        nameEn: "Axion-IA team — custom AI integrated into the enterprise IT system",
        altFr:
          "Équipe Axion-IA conçoit et déploie des solutions IA sur-mesure pour TPE, PME et ETI françaises — architecture, fine-tuning, RAG métier, intégration SI, hébergement souverain, MLOps simplifié.",
        altEn:
          "Axion-IA team designs and deploys custom AI solutions for French small businesses, SMEs and mid-caps — architecture, fine-tuning, business RAG, IT integration, sovereign hosting, simplified MLOps.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert IA sur-mesure",
        nameEn: "Williams — Axion-IA founder, custom AI expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets d'IA sur-mesure pour dirigeants TPE et PME — cadrage métier, choix d'architecture, mise en production sécurisée.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives custom AI projects for small business and SME executives — business scoping, architecture choice, secure production deployment.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — Automatisation de processus =====
  {
    path: "/implementation/processus",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — automatisation des processus métier par IA",
        nameEn: "Axion-IA team — AI-driven business process automation",
        altFr:
          "Équipe Axion-IA conçoit et déploie des automatisations de processus métier par IA pour TPE, PME et ETI — devis, facturation, support, RH, achats, supply chain, avec garde-fous humains et observabilité.",
        altEn:
          "Axion-IA team designs and deploys AI-driven business process automations for small businesses, SMEs and mid-caps — quoting, invoicing, support, HR, procurement, supply chain, with human guardrails and observability.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert automatisation processus IA",
        nameEn: "Williams — Axion-IA founder, AI process automation expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets d'automatisation de processus IA pour dirigeants TPE et PME — cartographie des flux, ROI par étape, conduite du changement.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives AI process automation projects for small business and SME executives — flow mapping, step-by-step ROI, change management.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — Structuration des données =====
  {
    path: "/implementation/structuration",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — structuration des données pour IA",
        nameEn: "Axion-IA team — data structuring for AI",
        altFr:
          "Équipe Axion-IA structure les données des TPE, PME et ETI françaises pour les rendre exploitables par l'IA — collecte, nettoyage, normalisation, taxonomie, gouvernance, qualité documentée.",
        altEn:
          "Axion-IA team structures data for French small businesses, SMEs and mid-caps to make it AI-ready — collection, cleaning, normalization, taxonomy, governance, documented quality.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert structuration données IA",
        nameEn: "Williams — Axion-IA founder, AI data structuring expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets de structuration de données IA pour dirigeants TPE et PME — audit data, modélisation, gouvernance, mise en qualité progressive.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives AI data structuring projects for small business and SME executives — data audit, modeling, governance, progressive quality improvement.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Coaching 1-to-1 (hub) =====
  {
    path: "/un-a-un",
    images: [
      {
        src: "/illustrations/william-fondateur-formateur-ia-axion-ia.png",
        nameFr: "Williams — Fondateur Axion-IA et coach IA 1-to-1",
        nameEn: "Williams — Axion-IA founder and 1-to-1 AI coach",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA et coach IA individuel. Accompagne en tête-à-tête dirigeants et collaborateurs clés (secrétariat, comptabilité, achats…) pour gagner du temps avec l'IA, partout en France métropolitaine.",
        altEn:
          "Portrait of Williams, Axion-IA founder and individual AI coach. Coaches executives and key team members (admin, accounting, purchasing…) one-on-one to save time with AI, across metropolitan France.",
        width: 800,
        height: 1000,
        representativeOfPage: true,
      },
    ],
  },
  // ===== Implémentation — No-code =====
  {
    path: "/implementation/no-code",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — intégration IA dans vos outils no-code existants",
        nameEn: "Axion-IA team — AI integration into your existing no-code tools",
        altFr:
          "Équipe Axion-IA intègre l'IA dans vos outils no-code existants (n8n, Make, Zapier, Bubble, Airtable) pour TPE et PME — sur demande client uniquement, notre approche par défaut reste le code custom souverain.",
        altEn:
          "Axion-IA team integrates AI into your existing no-code tools (n8n, Make, Zapier, Bubble, Airtable) for small businesses and SMEs — on client request only, our default approach is sovereign custom code.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA",
        nameEn: "Williams — Axion-IA founder",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote les projets d'intégration IA dans vos outils no-code existants pour dirigeants TPE et PME — analyse de l'existant, design des flows, transfert d'autonomie aux équipes.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Drives AI integration projects into your existing no-code tools for small business and SME executives — analysis of existing setup, flow design, autonomy transfer to teams.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — Intégrations API =====
  {
    path: "/implementation/integrations",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — intégrations API IA dans le SI entreprise",
        nameEn: "Axion-IA team — API AI integrations in the enterprise IT system",
        altFr:
          "Équipe Axion-IA conçoit et déploie des intégrations API IA pour TPE, PME et ETI françaises — connecteurs vers LLM (OpenAI, Anthropic, Mistral), webhooks, files d'attente, observabilité, sécurité.",
        altEn:
          "Axion-IA team designs and deploys API AI integrations for French small businesses, SMEs and mid-caps — connectors to LLMs (OpenAI, Anthropic, Mistral), webhooks, queues, observability, security.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert intégrations API IA",
        nameEn: "Williams — Axion-IA founder, API AI integrations expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets d'intégration API IA pour dirigeants TPE et PME — architecture, sécurité, monitoring coûts LLM, fallbacks et garde-fous.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives API AI integration projects for small business and SME executives — architecture, security, LLM cost monitoring, fallbacks and guardrails.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — Traitement documentaire =====
  {
    path: "/implementation/documents",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — traitement de documents par IA",
        nameEn: "Axion-IA team — AI document processing",
        altFr:
          "Équipe Axion-IA conçoit et déploie des pipelines IA de traitement documentaire pour TPE, PME et ETI — OCR, extraction structurée, classification, résumé, RAG sur PDF, contrats, factures, courriers.",
        altEn:
          "Axion-IA team designs and deploys AI document processing pipelines for small businesses, SMEs and mid-caps — OCR, structured extraction, classification, summarization, RAG on PDFs, contracts, invoices, mail.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert traitement documents IA",
        nameEn: "Williams — Axion-IA founder, AI document processing expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets de traitement documentaire IA pour dirigeants TPE et PME — architecture, choix LLM multimodal, qualité d'extraction, supervision humaine.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives AI document processing projects for small business and SME executives — architecture, multimodal LLM selection, extraction quality, human oversight.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — CRM / ERP =====
  {
    path: "/implementation/crm-erp",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — intégration IA dans CRM et ERP entreprise",
        nameEn: "Axion-IA team — AI integration in CRM and ERP systems",
        altFr:
          "Équipe Axion-IA intègre l'IA dans les CRM et ERP des TPE, PME et ETI françaises — HubSpot, Salesforce, Pipedrive, Odoo, Sage, Cegid, scoring lead, enrichissement, automatisations métier.",
        altEn:
          "Axion-IA team integrates AI into CRM and ERP systems for French small businesses, SMEs and mid-caps — HubSpot, Salesforce, Pipedrive, Odoo, Sage, Cegid, lead scoring, enrichment, business automation.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert intégration IA CRM/ERP",
        nameEn: "Williams — Axion-IA founder, CRM/ERP AI integration expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets d'intégration IA CRM et ERP pour dirigeants TPE et PME — connecteurs, mapping de données, supervision qualité, ROI commercial.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives CRM and ERP AI integration projects for small business and SME executives — connectors, data mapping, quality oversight, commercial ROI.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Implémentation — Chatbots =====
  {
    path: "/implementation/chatbot",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — chatbots IA conversationnels pour entreprises",
        nameEn: "Axion-IA team — conversational AI chatbots for companies",
        altFr:
          "Équipe Axion-IA conçoit et déploie des chatbots IA conversationnels pour TPE, PME et ETI françaises — assistants RAG, support client automatisé, FAQ intelligente, intégration site web et messageries.",
        altEn:
          "Axion-IA team designs and deploys conversational AI chatbots for French small businesses, SMEs and mid-caps — RAG assistants, automated customer support, smart FAQ, website and messaging integrations.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, expert chatbots IA",
        nameEn: "Williams — Axion-IA founder, AI chatbots expert",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote personnellement les projets de chatbots IA conversationnels pour dirigeants TPE et PME — choix LLM, base de connaissances, garde-fous, mise en production.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally drives conversational AI chatbot projects for small business and SME executives — LLM selection, knowledge base, guardrails, production deployment.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Audit — Ciblé =====
  {
    path: "/audit/cible",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — audit IA ciblé sur 1 département PME",
        nameEn: "Axion-IA team — Targeted AI audit on 1 SME department",
        altFr:
          "Équipe Axion-IA en mission d'audit IA ciblé — cabinet IA opérationnel français spécialisé dans le diagnostic IA d'un département précis (ventes, RH, finance, opérations) pour TPE et PME.",
        altEn:
          "Axion-IA team in Targeted AI audit assignment — French operational AI consultancy specialized in AI diagnosis of a specific department (sales, HR, finance, operations) for small businesses and SMEs.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, auditeur IA ciblé",
        nameEn: "Williams — Axion-IA founder, Targeted AI auditor",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Conduit personnellement les audits IA ciblés pour dirigeants TPE et PME — diagnostic département par département, cas d'usage chiffrés, plan d'action 90 jours.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally conducts Targeted AI audits for small business and SME executives — department-by-department diagnosis, quantified use cases, 90-day action plan.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Audit — Flash TPE 1 jour ===== (alt statique : le prix dynamique de la page est retiré)
  {
    path: "/audit/tpe-1-jour",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — audit Flash IA TPE et PME",
        nameEn: "Axion-IA team — Flash AI audit for small businesses and SMEs",
        altFr:
          "Équipe Axion-IA en session d'audit IA sur place — cabinet IA opérationnel français accompagnant TPE, artisans et commerçants en une journée complète sur site, cartographie IA, ROI rapide.",
        altEn:
          "Axion-IA team in an on-site AI audit session — French operational AI consultancy supporting small businesses, artisans and retailers in one full day on site, AI mapping, quick ROI.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, auditeur Flash IA",
        nameEn: "Williams — Axion-IA founder, Flash AI auditor",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Conduit personnellement les audits Flash IA pour dirigeants TPE et PME — diagnostic accéléré, priorisation des cas d'usage IA, recommandations actionnables.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally conducts Flash AI audits for small business and SME executives — accelerated diagnosis, AI use case prioritization, actionable recommendations.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Audit — Stratégique PME =====
  {
    path: "/audit/strategique-pme",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — audit stratégique IA PME multi-départements",
        nameEn: "Axion-IA team — SME strategic AI audit across departments",
        altFr:
          "Équipe Axion-IA en mission d'audit stratégique IA PME — cabinet IA opérationnel français accompagnant les PME (10-250 salariés) avec cartographie IA exhaustive, ROI chiffré et roadmap 6-12 mois.",
        altEn:
          "Axion-IA team in SME strategic AI audit assignment — French operational AI consultancy supporting SMEs (10-250 employees) with exhaustive AI mapping, quantified ROI and 6-12 month roadmap.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, auditeur stratégique IA PME",
        nameEn: "Williams — Axion-IA founder, SME strategic AI auditor",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Conduit personnellement les audits stratégiques IA pour dirigeants PME — vision IA d'entreprise, gouvernance, priorisation cas d'usage par valeur, plan d'implémentation 6-12 mois.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally conducts strategic AI audits for SME executives — enterprise AI vision, governance, value-driven use case prioritization, 6-12 month implementation plan.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Audit — Stratégique ETI =====
  {
    path: "/audit/strategique-eti",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — audit stratégique IA ETI multi-BU",
        nameEn: "Axion-IA team — mid-cap strategic AI audit, multi-BU",
        altFr:
          "Équipe Axion-IA en mission d'audit stratégique IA ETI — cabinet IA opérationnel français pour entreprises de taille intermédiaire (250+ salariés, multi-BU), avec gouvernance IA, cartographie cross-fonctions et roadmap exécutive.",
        altEn:
          "Axion-IA team in mid-cap strategic AI audit assignment — French operational AI consultancy for mid-cap enterprises (250+ employees, multi-BU), with AI governance, cross-function mapping and executive roadmap.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, auditeur stratégique IA ETI",
        nameEn: "Williams — Axion-IA founder, mid-cap strategic AI auditor",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Conduit personnellement les audits stratégiques IA ETI — interview comité exécutif, gouvernance IA multi-BU, AI Act compliance, plan stratégique IA pluri-annuel.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally conducts mid-cap strategic AI audits — executive committee interviews, multi-BU AI governance, AI Act compliance, multi-year strategic AI plan.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Sites web augmentés IA =====
  {
    path: "/sites-web-augmentes",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — création sites web et SaaS native IA",
        nameEn: "Axion-IA team — AI-native websites and SaaS",
        altFr:
          "Équipe Axion-IA en session conception site web augmenté IA — sites vitrines, SaaS métier, plateformes B2B avec agents conversationnels intégrés pour TPE, PME, ETI et grandes entreprises françaises.",
        altEn:
          "Axion-IA team designing AI-augmented website — showcase sites, business SaaS, B2B platforms with integrated conversational agents for French SMEs, mid-caps and large enterprises.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA et architecte sites web IA",
        nameEn: "Williams — Axion-IA founder and AI website architect",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Pilote la création de sites web augmentés IA et SaaS native IA pour dirigeants TPE, PME, ETI et grandes entreprises françaises — agents conversationnels, recommandations IA, automatisations métier.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Drives AI-augmented website and AI-native SaaS creation for French SME, mid-cap and large enterprise executives — conversational agents, AI recommendations, business automations.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Interventions — Coaching individuel =====
  {
    path: "/interventions/individuel",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — coaching IA individuel sur-mesure",
        nameEn: "Axion-IA team — bespoke individual AI coaching",
        altFr:
          "Équipe Axion-IA accompagne en 1-to-1 indépendants, freelances, managers et collaborateurs opérationnels — coaching IA construit sur leur métier précis, leurs vrais cas d'usage, amorti en quelques jours.",
        altEn:
          "Axion-IA team supports independents, freelancers, managers and operational staff in 1-on-1 — AI coaching built on their exact role, real use cases, pays for itself in days.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, coach IA individuel",
        nameEn: "Williams — Axion-IA founder, individual AI coach",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Accompagne personnellement les coachings IA individuels 1-to-1 — cadrage visio 20 min, parcours sur-mesure par métier, séances facturées à l'unité.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally runs individual 1-on-1 AI coachings — 20-min framing video, bespoke journey by role, sessions invoiced per unit.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Interventions — Dirigeants =====
  {
    path: "/interventions/dirigeants",
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — accompagnement dirigeants TPE et PME",
        nameEn: "Axion-IA team — small business and SME executive support",
        altFr:
          "Équipe Axion-IA spécialisée dans l'accompagnement 1-to-1 des dirigeants TPE et PME françaises — cadrage personnalisé, méthodologie IA confidentielle, rapport sous 7 jours.",
        altEn:
          "Axion-IA team specialized in 1-on-1 support for French small business and SME executives — personalized framing, confidential AI methodology, report within 7 days.",
        width: 1961,
        height: 802,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA, partenaire 1-to-1 des dirigeants TPE et PME",
        nameEn: "Williams — Axion-IA founder, 1-on-1 partner for small business and SME executives",
        altFr:
          "Portrait de Williams, fondateur d'Axion-IA. Accompagne personnellement les dirigeants TPE et PME en 1-to-1 sur les 2 formats (vision IA stratégique, maîtrise Claude). Confidentialité totale.",
        altEn:
          "Portrait of Williams, Axion-IA founder. Personally supports small business and SME executives in 1-on-1 on the 2 formats (strategic AI vision, Claude mastery). Total confidentiality.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Accueil (home) =====
  {
    path: "/",
    images: [
      {
        src: "/illustrations/home-hero-equipe.avif",
        nameFr: "L'équipe Axion-IA — cabinet IA pour entreprises",
        nameEn: "The Axion-IA team — AI consultancy for companies",
        altFr:
          "Photo de l'équipe Axion-IA en pulls terracotta sous le logo Axion-IA.com — L'intelligence artificielle au service de l'humain. Cabinet IA pour TPE, PME, ETI et grandes entreprises françaises.",
        altEn:
          "Photo of the Axion-IA team wearing terracotta sweaters under the Axion-IA.com sign — Artificial intelligence at the service of humans. AI consultancy for French SMEs, mid-caps and large enterprises.",
        width: 1536,
        height: 1024,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Bandeau équipe Axion-IA — 4 scènes coworking IA",
        nameEn: "Axion-IA team banner — 4 AI coworking scenes",
        altFr:
          "Bandeau Axion-IA.com — quatre scènes de coworking de l'équipe : démo écran, échange canapé, session laptop binôme, portrait souriant. Cabinet IA opérationnel français pour TPE, PME, ETI.",
        altEn:
          "Axion-IA.com banner — four team coworking scenes: screen demo, sofa exchange, paired laptop session, smiling portrait. French operational AI consultancy for SMEs, mid-caps.",
        width: 1961,
        height: 802,
      },
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur & CEO Axion-IA",
        nameEn: "Williams — Founder & CEO Axion-IA",
        altFr:
          "Portrait de Williams, fondateur et CEO d'Axion-IA. Top 1% expertise IA opérationnelle France, accompagne dirigeants TPE, PME, ETI et grandes entreprises sur ChatGPT, Claude, Mistral, agents IA et automatisations métier.",
        altEn:
          "Portrait of Williams, founder and CEO of Axion-IA. Top 1% France operational AI expertise, advises executives of SMEs, mid-caps and large enterprises on ChatGPT, Claude, Mistral, AI agents and business automations.",
        width: 800,
        height: 1000,
      },
    ],
  },
  // ===== Presse (press kit) =====
  {
    path: "/presse",
    images: [
      {
        src: "/illustrations/home-founder-william.avif",
        nameFr: "Williams — Fondateur Axion-IA disponible pour interviews",
        nameEn: "Williams — Axion-IA founder available for interviews",
        altFr:
          "Portrait haute résolution de Williams, fondateur d'Axion-IA. Disponible pour interviews presse, podcasts, conférences sur l'IA opérationnelle pour TPE, PME, ETI et grandes entreprises françaises.",
        altEn:
          "High-resolution portrait of Williams, Axion-IA founder. Available for press interviews, podcasts, conferences on operational AI for French SMEs, mid-caps and large enterprises.",
        width: 800,
        height: 1000,
        representativeOfPage: true,
      },
      {
        src: "/illustrations/home-bandeau-team.avif",
        nameFr: "Équipe Axion-IA — press kit visuels cabinet IA",
        nameEn: "Axion-IA team — AI consultancy press kit visuals",
        altFr:
          "Bandeau équipe Axion-IA — visuels press kit cabinet IA opérationnel français. 4 scènes : démo écran IA, échange canapé, session laptop binôme, portrait souriant.",
        altEn:
          "Axion-IA team banner — French operational AI consultancy press kit visuals. 4 scenes: AI screen demo, sofa exchange, paired laptop session, smiling portrait.",
        width: 1961,
        height: 802,
      },
    ],
  },
  ...SECTOR_PAGE_IMAGES,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGES_BY_PATH: ReadonlyMap<string, readonly PageImage[]> = new Map(
  PAGE_IMAGES_MANIFEST.map((entry) => [entry.path, entry.images]),
);

/** Normalise un path (strip trailing slash sauf racine) pour le lookup. */
function normalizePath(path: string): string {
  if (path === "/") return "/";
  return path.replace(/\/+$/, "");
}

/** Images du manifeste pour une route (sans préfixe de locale). `[]` si aucune. */
export function getPageImages(path: string): readonly PageImage[] {
  return IMAGES_BY_PATH.get(normalizePath(path)) ?? [];
}

/** Une image précise du manifeste par (path, src). `undefined` si absente. */
export function getPageImage(path: string, src: string): PageImage | undefined {
  return getPageImages(path).find((img) => img.src === src);
}

/** L'image représentative d'une page (ou la première, ou `undefined`). */
export function getRepresentativePageImage(path: string): PageImage | undefined {
  const images = getPageImages(path);
  return images.find((img) => img.representativeOfPage) ?? images[0];
}
