/**
 * Liste de démarrage de flux RSS pour la génération de news (content-gen).
 *
 * URLs **vérifiées accessibles** (HTTP 200 + flux RSS/Atom valide) le 2026-06-14
 * via requêtes réelles. Les URLs hallucinées/cassées d'une proposition initiale
 * ont été corrigées :
 *   - MIT Tech Review : tag 404 → topic AI feed
 *   - NVIDIA          : /category/ai 404 → blog global
 *   - OpenAI          : /blog/rss 403 → /news/rss.xml
 *   - Google Cloud    : /topics/.../rss HTML → cloudblog global
 *   - Challenges      : /economie/rss.xml 404 → /rss.xml
 *
 * Sert de valeur par défaut pré-remplie dans la page admin « Import en masse »
 * (/content-gen/rss/import). L'admin peut éditer avant d'importer.
 *
 * verticale ∈ { interventions, audit, implementations, un_a_un } ou null (transverse).
 * autoPublish=false partout : revue conseillée (NB : sous policy full-auto, la
 * publication auto s'applique quand même — ce flag ne re-gate qu'en mode review).
 */
import type { RssSourceInput } from "@/server/actions/content-gen/rss-sources";

export const RSS_STARTER_FEEDS: ReadonlyArray<RssSourceInput> = [
  // ── FR — business / transformation numérique / data ──────────────────────
  {
    url: "https://www.lemondeinformatique.fr/flux-rss/business/rss.xml",
    name: "Le Monde Informatique – Business",
    verticale: "interventions",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["business", "transformation numérique", "SI", "dirigeants", "France"],
    language: "fr",
  },
  {
    url: "https://www.decideo.fr/xml/syndication.rss",
    name: "Decideo – BI & Data",
    verticale: "interventions",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["data", "BI", "analytics", "IA", "entreprise"],
    language: "fr",
  },
  {
    url: "https://www.informatiquenews.fr/feed",
    name: "InformatiqueNews – Transformation numérique",
    verticale: "interventions",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["cloud", "cybersécurité", "IA", "transformation numérique", "IT"],
    language: "fr",
  },
  {
    url: "https://dcloudnews.eu/search/IA/feed/rss2/",
    name: "DCloud News – IA & Cloud",
    verticale: "implementations",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["cloud", "IA", "infrastructure", "SaaS", "intégration"],
    language: "fr",
  },
  {
    url: "https://intelligence-artificielle.developpez.com/index/rss",
    name: "Developpez.com – Intelligence artificielle",
    verticale: "implementations",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["IA", "dev", "ML", "frameworks", "intégration"],
    language: "fr",
  },
  {
    url: "https://www.lefilia.fr/feed",
    name: "Le Fil IA – Actu IA",
    verticale: "un_a_un",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["IA", "veille", "innovation", "cas d'usage", "France"],
    language: "fr",
  },
  {
    url: "https://www.centre-inffo.fr/feed",
    name: "Centre Inffo – Actualités formation",
    verticale: "un_a_un",
    pollIntervalMin: 120,
    autoPublish: false,
    enabled: true,
    tags: ["formation", "dispositifs", "réglementation", "innovation pédagogique"],
    language: "fr",
  },
  // ── FR — économie / dirigeants (transverse) ──────────────────────────────
  {
    url: "https://www.challenges.fr/rss.xml",
    name: "Challenges – Économie",
    verticale: null,
    pollIntervalMin: 180,
    autoPublish: false,
    enabled: true,
    tags: ["économie", "entreprises", "dirigeants", "macro"],
    language: "fr",
  },
  {
    url: "https://feed.prismamediadigital.com/v1/cap/rss?sources=capital&categories=entreprises-marches",
    name: "Capital – Entreprises & marchés",
    verticale: null,
    pollIntervalMin: 180,
    autoPublish: false,
    enabled: true,
    tags: ["entreprises", "marchés", "économie", "dirigeants"],
    language: "fr",
  },
  // ── US — précurseurs IA entreprise / cloud / SaaS ────────────────────────
  {
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    name: "AWS Machine Learning Blog",
    verticale: "implementations",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["ML", "cloud", "déploiement", "cas d'usage entreprise", "AWS"],
    language: "en",
  },
  {
    url: "https://cloudblog.withgoogle.com/rss/",
    name: "Google Cloud Blog",
    verticale: "implementations",
    pollIntervalMin: 120,
    autoPublish: false,
    enabled: true,
    tags: ["AI", "ML", "cloud", "intégration", "SaaS", "Google Cloud"],
    language: "en",
  },
  {
    url: "https://blogs.nvidia.com/feed/",
    name: "NVIDIA Blog",
    verticale: "implementations",
    pollIntervalMin: 120,
    autoPublish: false,
    enabled: true,
    tags: ["AI", "GPU", "industrie", "optimisation", "déploiement"],
    language: "en",
  },
  {
    url: "https://venturebeat.com/category/ai/feed/",
    name: "VentureBeat – AI",
    verticale: "implementations",
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["AI", "enterprise", "produits", "SaaS", "tendances"],
    language: "en",
  },
  {
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    name: "MIT Technology Review – AI",
    verticale: "interventions",
    pollIntervalMin: 120,
    autoPublish: false,
    enabled: true,
    tags: ["AI", "stratégie", "impacts business", "innovation"],
    language: "en",
  },
  {
    url: "https://openai.com/news/rss.xml",
    name: "OpenAI – News",
    verticale: null,
    pollIntervalMin: 60,
    autoPublish: false,
    enabled: true,
    tags: ["LLM", "API", "produits", "agents", "roadmap"],
    language: "en",
  },
  {
    url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
    name: "ScienceDaily – Artificial Intelligence",
    verticale: null,
    pollIntervalMin: 180,
    autoPublish: false,
    enabled: true,
    tags: ["research", "AI", "tendances", "cas d'usage"],
    language: "en",
  },
];
