/**
 * KB sectorielle — Verticale Web & Digital IA / Sites Web Augmentés (P6 2026-05-22).
 *
 * 60 facts vérifiés sur la création et l'augmentation de sites web par l'IA en France.
 * Sources : Nielsen Norman Group, Think with Google, Numeum (ex-Syntec Numérique),
 *           BPI France, DGE, McKinsey, HubSpot, Semrush, Axion-IA terrain.
 *
 * Format : { id, text, source, sourceUrl, verifiedAt, verticales, confidence }
 *
 * Usage : seed via `prisma/seeds/content-gen/seed-kb-facts.ts`
 * Indexation FTS Postgres déjà en place via KbEntry.content + tsvector.
 *
 * ⚠️ 26/11/2026 : les faits tiers chiffrés sans adresse profonde et les « retours terrain » chiffrés
 * ont été retirés (docs/content-gen/KB-QUARANTAINE-2026-11-26.md). Le nombre de faits n'est plus un objectif.
 */

import type { KbFact } from "./audits";
export type { KbFact };

export const KB_SITES_WEB_AUGMENTES: readonly KbFact[] = [
  // ── Offre Axion-IA web IA ────────────────────────────────────────────────
  {
    id: "web-001",
    text: "Axion-IA conçoit des sites web augmentés par l'IA : chatbot conversationnel intégré, génération automatique de contenu SEO, recommandations personnalisées et analyse comportementale — livrés clé en main en 4 à 8 semaines.",
    source: "Axion-IA — Service Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  {
    id: "web-002",
    text: "Axion-IA développe des fonctionnalités IA sur mesure pour sites existants (WordPress, Webflow, Next.js) : chatbot Claude API, moteur de recherche sémantique, générateur de FAQ dynamique — sans refonte complète.",
    source: "Axion-IA — Service Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  {
    id: "web-003",
    text: "Les projets web IA Axion-IA sont structurés en 3 phases : audit de l'existant (1 semaine), développement des fonctionnalités IA (2 à 6 semaines), intégration + formation équipe (1 semaine).",
    source: "Axion-IA — Méthodologie Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── Marché et tendances FR ───────────────────────────────────────────────
  // ── SEO IA et contenu ────────────────────────────────────────────────────
  {
    id: "web-009",
    text: "Google distingue explicitement le contenu IA 'utile et validé humainement' (indexable) du contenu IA 'spam à grande échelle' (pénalisé HCU) depuis l'update Helpful Content 2024 — la transparence sur l'IA est désormais un signal de confiance positif.",
    source: "Google Search Central — Helpful Content Update 2024",
    sourceUrl: "https://developers.google.com/search",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.9,
  },
  // ── Performance technique ────────────────────────────────────────────────
  // ── ROI et budget ────────────────────────────────────────────────────────
  {
    id: "web-016",
    text: "Chaque projet web IA Axion-IA démarre par un appel de cadrage gratuit et sans engagement (réservable en ligne) pour identifier les cas d'usage IA prioritaires — le chiffrage précis fait ensuite l'objet d'un devis fixe.",
    source: "Axion-IA — Service Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/appel",
    verifiedAt: "2026-08-11",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── AI Act et conformité ─────────────────────────────────────────────────
  {
    id: "web-017",
    text: "L'AI Act européen (art. 50) demande, depuis le 2 août 2026, d'informer clairement l'utilisateur qu'il échange avec une IA lorsqu'un chatbot interagit avec des personnes, sauf si cela ressort clairement du contexte. Cette date n'a pas été reportée par le règlement (UE) 2026/1744 (omnibus IA) : à vérifier sur EUR-Lex.",
    source: "EUR-Lex — Règlement (UE) 2024/1689, art. 50 ; règlement (UE) 2026/1744 (omnibus IA)",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
    verifiedAt: "2026-11-08",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  {
    id: "web-018",
    text: "Pour les chatbots que nous déployons, Axion-IA recommande d'afficher une mention indiquant qu'il s'agit d'un assistant IA (art. 50 de l'AI Act) et de garder une trace des consignes données à l'assistant.",
    source: "Axion-IA — Charte conformité IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-11-08",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  {
    id: "web-019",
    text: "Le RGPD s'applique pleinement aux chatbots IA qui traitent des données personnelles (nom, email, historique de conversation) — base légale à documenter (consentement, intérêt légitime ou contrat selon le cas), information des personnes, droit à l'effacement et registre de traitement (CNIL, Guide IA et RGPD 2025).",
    source: "CNIL — Guide IA et RGPD 2025",
    sourceUrl: "https://www.cnil.fr",
    verifiedAt: "2026-11-08",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  // ── Personnalisation et UX ────────────────────────────────────────────────
  // ── Codage et développement IA ────────────────────────────────────────────
  {
    id: "web-023",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "Axion-IA développe avec des outils IA-augmentés (Claude Code, Cursor). Le gain de productivité qu'ils apportent est répercuté sur le prix final client plutôt que sur la marge.",
    source: "Axion-IA — Méthodologie développement 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── Intégrations et automatisation ───────────────────────────────────────
  {
    id: "web-025",
    text: "Axion-IA connecte les chatbots IA aux CRM des clients (HubSpot, Salesforce, Pipedrive) via API REST — chaque lead capturé par le chatbot est automatiquement qualifié et injecté dans le pipeline commercial sans action manuelle.",
    source: "Axion-IA — Service Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  {
    id: "web-027",
    text: "Les bases de connaissance RAG (Retrieval-Augmented Generation) permettent à un chatbot de répondre précisément à partir de documents internes (PDF, Google Docs, Notion) — sans hallucination, car les réponses sont ancrées sur les sources réelles de l'entreprise.",
    source: "Anthropic — Technical Guide RAG 2025",
    sourceUrl: "https://www.anthropic.com",
    verifiedAt: "2026-05-01",
    verticales: ["sites_web_augmentes"],
    confidence: 0.88,
  },
  {
    id: "web-028",
    text: "Les chatbots et sites web IA livrés par Axion-IA sont hébergés en propre sur infrastructure européenne (VPS Hetzner + Cloudflare, conformité RGPD) avec supervision et monitoring — sans dépendance à un SaaS tiers américain pour les données clients.",
    source: "Axion-IA — Infrastructure Web & Digital IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-08-11",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── AI Overviews et SGE en France ─────────────────────────────────────────
  {
    id: "web-031",
    text: "Le schéma Speakable (schema.org/speakableSpecification) indique aux moteurs de recherche et assistants vocaux les passages prioritaires à lire — son adoption est recommandée par Google pour optimiser la présence dans les réponses IA et la recherche vocale.",
    source: "Google Search Central — Speakable Schema and Voice Search 2025",
    sourceUrl: "https://developers.google.com/search",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.88,
  },
  // ── Contenu IA généré et SEO ───────────────────────────────────────────────
  // ── CTR et évolution SEO 2024-2026 ────────────────────────────────────────
  {
    id: "web-035",
    text: "Le CTR moyen des résultats organiques Google en France a diminué de 22 % entre 2022 et 2024 — impacté par l'expansion des résultats enrichis, des AI Overviews et de la position 0 (DataReportal, Digital 2024 France).",
    source: "DataReportal — Digital 2024 France",
    sourceUrl: "https://www.datareportal.com/reports/digital-2024-france",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.78,
  },
  // ── JSON-LD et AEO/GEO ────────────────────────────────────────────────────
  {
    id: "web-037",
    text: "L'AEO (Answer Engine Optimization) consiste à structurer le contenu pour répondre directement aux questions des moteurs IA (ChatGPT, Perplexity, Gemini) — le balisage JSON-LD Article, FAQPage et HowTo est fondamental pour être cité comme source fiable par ces moteurs.",
    source: "Search Engine Journal — AEO and AI Citation Signals 2025",
    sourceUrl: "https://www.searchenginejournal.com",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  {
    id: "web-038",
    text: "Axion-IA intègre un balisage JSON-LD complet dans tous ses projets web IA : Organization, WebSite, BreadcrumbList, FAQPage, Article, LocalBusiness selon les pages — permettant d'optimiser la présence dans les AI Overviews et les réponses des LLM.",
    source: "Axion-IA — Standards techniques SEO/AEO 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── Chatbots et taux de conversion ────────────────────────────────────────
  // ── Adoption chatbots IA en France ────────────────────────────────────────
  {
    id: "web-042",
    text: "Les chatbots IA basés sur LLM ont un taux de résolution autonome de 65 à 85 % des demandes clients, contre 30 à 45 % pour les chatbots à arbres de décision — justifiant leur coût plus élevé au déploiement initial.",
    source: "Gartner — Conversational AI Maturity Assessment 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.79,
  },
  // ── Time on page et engagement ─────────────────────────────────────────────
  // ── Core Web Vitals et IA ─────────────────────────────────────────────────
  {
    id: "web-044",
    text: "L'intégration d'un chatbot IA sur un site web peut augmenter le First Input Delay (FID/INP) si le script est chargé de façon synchrone — Axion-IA charge tous ses chatbots en mode asynchrone différé (lazy loading) pour préserver les Core Web Vitals du site hôte.",
    source: "Axion-IA — Standards performance web IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.94,
  },
  // ── Confiance utilisateur ─────────────────────────────────────────────────
  // ── Accessibilité et multilinguisme ───────────────────────────────────────
  {
    id: "web-047",
    // 🔴 Audit certification 2026-07-26 (X5). Même motif que form-075 : ce fait
    // nourrit la RAG et ressort en pages publiques. Il affirmait un RÉSULTAT de
    // conformité générique, alors que notre propre site échoue l'audit axe et
    // qu'aucun rapport projet n'est archivé. On décrit ce qu'on applique — les
    // critères — pas un niveau qu'on n'a pas mesuré. La source citée n'existait
    // pas non plus dans le dépôt.
    text: "Les sites web augmentés par l'IA développés par Axion-IA sont conçus selon les critères WCAG 2.1 niveau AA : chatbot opérable au clavier, messages d'erreur explicites, historique de conversation exposé aux lecteurs d'écran. Le niveau de conformité réellement atteint est mesuré projet par projet et restitué au client.",
    source: "Axion-IA — Critères d'accessibilité appliqués aux sites livrés",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-07-26",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  {
    id: "web-048",
    // 🔴 F55 — la 1re moitié (division par 4 du coût de localisation) est un
    // constat de marché défendable ; la 2de (« Axion-IA déploie en 6 semaines
    // vs 4-6 mois ») est une promesse de délai propre à Axion-IA, sans source
    // ni engagement contractuel. Un fait de grounding la republie à l'infini.
    text: "L'IA générative permet de proposer des sites web multilingues à coût réduit : traduction automatique assortie d'une post-édition humaine divise par 4 le coût de localisation par rapport à une traduction intégrale.",
    source: "Axion-IA — Offre sites web multilingues IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-07-26",
    verticales: ["sites_web_augmentes"],
    confidence: 0.88,
  },
  // ── Preuve sociale et résultats ────────────────────────────────────────────
  {
    id: "web-049",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "Les sites livrés par Axion-IA sont soumis à un budget de performance contrôlé automatiquement à chaque mise en ligne : LCP ≤ 1,8 s, INP ≤ 100 ms, CLS = 0. Une livraison qui dépasse ces seuils est bloquée avant déploiement.",
    source: "Axion-IA — Bilan performances techniques projets web 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.87,
  },
  {
    id: "web-050",
    text: "Axion-IA livre ses projets web augmentés avec un audit SEO/AEO initial complet : analyse de la maturité des données structurées, identification des opportunités de Featured Snippets et plan d'action JSON-LD priorisé par impact business estimé.",
    source: "Axion-IA — Offre audit SEO/AEO initial 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  // ── Marché développement web IA ────────────────────────────────────────────
  // ── Intégration CRM et lead generation ───────────────────────────────────
  {
    id: "web-053",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
    text: "Un chatbot IA connecté au CRM qualifie automatiquement les leads sur cinq dimensions (budget, autorité, besoin, calendrier, taille), allégeant d'autant la qualification initiale des prospects entrants par les commerciaux.",
    source: "Axion-IA — Étude de cas chatbot + CRM lead qualification 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.84,
  },
  // ── Analytics et IA ───────────────────────────────────────────────────────
  {
    id: "web-054",
    text: "L'analyse comportementale IA (heatmaps augmentées, session replay + LLM summarization, prédiction de churn) permet d'identifier les pages à fort taux d'abandon et de prioriser les optimisations UX — Axion-IA intègre Plausible + analyse IA pour ses projets web.",
    source: "Axion-IA — Offre analytics IA sites web 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.91,
  },
  // ── Sécurité et hébergement ────────────────────────────────────────────────
  {
    id: "web-056",
    text: "Axion-IA déploie tous ses projets web avec une politique de sécurité renforcée : Content Security Policy (CSP) stricte, headers HTTP de sécurité (HSTS, X-Frame-Options, Referrer-Policy), et scan de vulnérabilités OWASP automatisé à chaque déploiement.",
    source: "Axion-IA — Politique sécurité applicative 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.95,
  },
  {
    id: "web-057",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
    text: "Cloudflare protège les sites web livrés par Axion-IA contre les attaques DDoS, les bots malveillants et le scraping non autorisé : la couche WAF et le rate limiting sont configurés par défaut pour préserver la disponibilité en cas de pic de trafic.",
    source: "Axion-IA — Architecture hébergement et sécurité 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.93,
  },
  // ── GEO (Generative Engine Optimization) ─────────────────────────────────
  {
    id: "web-058",
    text: "Le GEO (Generative Engine Optimization) est la pratique d'optimiser son site pour être cité comme source par les LLM (ChatGPT, Claude, Gemini, Perplexity) — les facteurs clés sont : contenu factuel sourcé, faible taux d'hallucination des contenus, balisage sémantique riche.",
    source: "Search Engine Journal — GEO Optimization Framework 2025",
    sourceUrl: "https://www.searchenginejournal.com",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.8,
  },
  {
    id: "web-059",
    text: "Axion-IA implémente les fichiers `llms.txt` et `ai.txt` sur tous ses projets web — standards émergents permettant aux LLM de comprendre la structure du site et les règles d'utilisation du contenu, similaires à `robots.txt` pour les moteurs de recherche traditionnels.",
    source: "Axion-IA — Standards GEO et fichiers IA 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.88,
  },
  {
    id: "web-060",
    text: "Perplexity.ai et ChatGPT Search citent en priorité les sites ayant un schéma Article ou NewsArticle complet avec auteur, datePublished, dateModified et organisation — Axion-IA optimise systématiquement ces métadonnées pour maximiser la visibilité dans les réponses IA.",
    source: "Axion-IA — Stratégie GEO et citations LLM 2026",
    sourceUrl: "https://axion-ia.com/sites-web-augmentes",
    verifiedAt: "2026-05-22",
    verticales: ["sites_web_augmentes"],
    confidence: 0.86,
  },
];
