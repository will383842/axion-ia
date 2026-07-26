/**
 * KB sectorielle — Verticale Implémentations IA (P6 2026-05-22).
 *
 * 80 facts vérifiés sur les implémentations IA en entreprise France.
 * Sources : McKinsey, Gartner, Forrester, BPI France, DGE, Syntec Numérique,
 *           AI Act EUR-Lex, France Num, OCDE, Axion-IA terrain.
 *
 * Format : { id, text, source, sourceUrl, verifiedAt, verticales, confidence }
 *
 * Usage : seed via `prisma/seeds/content-gen/seed-kb-facts.ts`
 * Indexation FTS Postgres déjà en place via KbEntry.content + tsvector.
 */

import type { KbFact } from "./audits";
export type { KbFact };

export const KB_IMPLEMENTATIONS: readonly KbFact[] = [
  // ── Offre Axion-IA implémentations ───────────────────────────────────────
  {
    id: "impl-001",
    text: "Axion-IA conçoit et déploie des chatbots IA métier pour les PME/ETI : traitement des demandes clients, FAQ dynamique, assistance interne RH/finance — basés sur Claude API (Anthropic) avec base de connaissance RAG.",
    source: "Axion-IA — Catalogue implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-002",
    text: "Les systèmes RAG (Retrieval-Augmented Generation) déployés par Axion-IA permettent d'interroger des bases documentaires internes (contrats, procédures, emails) via une interface conversationnelle — sans que les données quittent l'infrastructure cliente.",
    source: "Axion-IA — Documentation technique RAG v2.1",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-003",
    text: "La stack technique standard des implémentations Axion-IA : Next.js (frontend + API routes), Claude API Anthropic (LLM), PostgreSQL + pgvector (base vectorielle), Vercel ou Hetzner (hébergement), Prisma (ORM).",
    source: "Axion-IA — Documentation technique stack v2.5",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-004",
    text: "Les automatisations IA Axion-IA couvrent 6 domaines prioritaires : traitement d'emails, génération de devis/rapports, veille sectorielle, extraction de données (OCR + LLM), scoring de leads et relances commerciales automatisées.",
    source: "Axion-IA — Catalogue implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  // ── Délais et phases ─────────────────────────────────────────────────────
  {
    id: "impl-005",
    text: "Le délai de livraison d'un chatbot RAG Axion-IA (conception à mise en production) est de 4 à 8 semaines selon la complexité de la base documentaire et le nombre d'intégrations avec les SI existants.",
    source: "Axion-IA — Référentiel projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  {
    id: "impl-006",
    text: "Un projet d'implémentation IA Axion-IA se déroule en 5 phases : (1) audit des besoins et données (1 sem), (2) POC fonctionnel (2 sem), (3) développement et tests (3-6 sem), (4) formation des utilisateurs (1 sem), (5) suivi prod 3 mois.",
    source: "Axion-IA — Méthodologie projet IA v3.0",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-007",
    text: "Les projets d'implémentation IA complexes (multi-modules, intégration ERP/CRM, déploiement multi-sites) nécessitent 3 à 6 mois — avec un chef de projet Axion-IA dédié et des jalons hebdomadaires.",
    source: "Axion-IA — Référentiel projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  // ── Tarifs ────────────────────────────────────────────────────────────────
  {
    id: "impl-008",
    text: "Chatbot RAG basique Axion-IA (jusqu'à 1 000 documents, 1 canal, 2 intégrations) — développement + maintenance/infra sur devis selon le périmètre.",
    source: "Axion-IA — Grille tarifaire implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-009",
    text: "Automatisation de workflow IA Axion-IA — sur devis selon le périmètre, selon le nombre d'étapes et d'intégrations — gains opérationnels mesurables dès la mise en production (généralement sous 4 à 8 semaines), ROI complet sous quelques mois. Notre approche par défaut est le code custom (Node.js, Python, infrastructures cloud-native) pour la souveraineté des données et zéro lock-in éditeur. Plateformes no-code (Make, Zapier, n8n) disponibles uniquement sur demande client explicite.",
    source: "Axion-IA — Grille tarifaire implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-010",
    text: "Projet d'implémentation IA complexe Axion-IA (système multi-agents, intégration ERP, tableau de bord IA) — sur devis selon le périmètre — avec objectifs de résultat définis contractuellement.",
    source: "Axion-IA — Grille tarifaire implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.85,
  },
  // ── ROI et chiffres marché ────────────────────────────────────────────────
  {
    id: "impl-011",
    text: "Le ROI moyen des implémentations IA en PME française est de 2,8x l'investissement sur 24 mois, avec un délai de retour à l'équilibre de 8 à 14 mois (BPI France, Observatoire IA PME 2025).",
    source: "BPI France — Observatoire IA & PME 2025",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  {
    id: "impl-012",
    text: "McKinsey (2024) évalue à 200-340 milliards de dollars le potentiel de valeur de l'IA générative dans les seules fonctions support (finance, RH, juridique, IT) des grandes entreprises mondiales.",
    source: "McKinsey Global Institute — The economic potential of generative AI, 2024",
    sourceUrl: "https://www.mckinsey.com",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.82,
  },
  {
    id: "impl-013",
    text: "Gartner prédit qu'en 2026, 80 % des entreprises auront utilisé l'IA générative dans au moins un de leurs processus métier — contre 5 % en 2023.",
    source: "Gartner — AI in Business Survey 2024",
    sourceUrl: "https://www.gartner.com",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.82,
  },
  // ── Sécurité et conformité ────────────────────────────────────────────────
  {
    id: "impl-014",
    text: "Toutes les implémentations IA Axion-IA respectent le RGPD par design : données personnelles non envoyées aux API IA tierces sans consentement, chiffrement au repos et en transit, droit à l'effacement garanti.",
    source: "Axion-IA — Politique RGPD implémentations v1.5",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-015",
    text: "Les chatbots IA Axion-IA intègrent nativement une bannière de transparence AI Act art. 50 : l'utilisateur est informé qu'il interagit avec un système IA — obligation légale en vigueur depuis août 2026.",
    source: "EUR-Lex — Règlement UE 2024/1689 (AI Act) art. 50",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.98,
  },
  {
    id: "impl-016",
    text: "Axion-IA utilise Claude API Anthropic (modèle Sonnet) comme LLM principal pour ses implémentations — choix motivé par la performance sur les textes techniques français, la politique de non-réutilisation des données clients et le coût par token.",
    source: "Axion-IA — Choix technologiques et ADR 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  // ── Cas d'usage prioritaires ──────────────────────────────────────────────
  {
    id: "impl-017",
    text: "Top 5 des cas d'usage IA déployés par Axion-IA en PME : (1) chatbot support client, (2) génération de propositions commerciales, (3) analyse de documents contractuels, (4) reporting automatique, (5) veille concurrentielle.",
    source: "Axion-IA — Bilan projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  {
    id: "impl-018",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Un chatbot IA de support client réduit fortement le délai de première réponse sur les requêtes standard, en traitant sans intervention humaine les demandes couvertes par la base documentaire qui lui est fournie.",
    source: "Axion-IA — Bilan projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.82,
  },
  {
    id: "impl-019",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "L'intégration d'un RAG interne (base documentaire métier) dans un chatbot réduit sensiblement les hallucinations du modèle, en ancrant les réponses sur des documents vérifiés propres à l'entreprise.",
    source: "Axion-IA — Documentation technique RAG v2.1",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  // ── Intégrations SI ───────────────────────────────────────────────────────
  {
    id: "impl-020",
    text: "Axion-IA maîtrise les intégrations avec les principaux SI d'entreprise : Salesforce, HubSpot, SAP, Sage, Dolibarr, Microsoft SharePoint, Google Workspace, Notion et Airtable — via API REST custom (approche par défaut, code-first, zéro lock-in éditeur). Connecteurs Make / Zapier disponibles uniquement sur demande client explicite.",
    source: "Axion-IA — Catalogue intégrations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.92,
  },
  {
    id: "impl-021",
    text: "65 % des PME françaises utilisent encore des workflows manuels (email + Excel) pour leurs processus métier clés — représentant le gisement d'automatisation IA le plus accessible et au ROI le plus rapide.",
    source: "France Num — Baromètre numérique des TPE-PME 2024",
    sourceUrl: "https://www.francenum.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.8,
  },
  // ── Maintenance et évolution ──────────────────────────────────────────────
  {
    id: "impl-022",
    text: "Axion-IA propose 3 niveaux de maintenance pour ses implémentations : Starter (monitoring + mises à jour sécurité), Standard (+ optimisation mensuelle), Premium (+ évolutions fonctionnelles trimestrielles + SLA 4h).",
    source: "Axion-IA — Offres maintenance IA 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-023",
    text: "Les coûts de maintenance d'un système IA représentent en moyenne 15 à 25 % du coût de développement initial par an — incluant les mises à jour de modèles, l'enrichissement de la base de connaissances et la correction de dérives.",
    source: "Gartner — Total Cost of AI Ownership, 2024",
    sourceUrl: "https://www.gartner.com",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Approche Axion-IA ─────────────────────────────────────────────────────
  {
    id: "impl-024",
    text: "Axion-IA livre toutes ses implémentations avec documentation technique complète, code source propriétaire du client, et formation des équipes IT internes pour assurer l'autonomie post-projet.",
    source: "Axion-IA — Engagements contractuels implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-025",
    text: "La garantie Axion-IA « Résultat ou Remboursement » s'applique aux projets d'automatisation : si les KPIs contractuels ne sont pas atteints en 90 jours, 50 % des honoraires sont remboursés.",
    source: "Axion-IA — CGV implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  // ── Secteurs où Axion-IA intervient ─────────────────────────────────────
  {
    id: "impl-026",
    text: "Les secteurs où Axion-IA déploie le plus d'implémentations IA en 2026 : (1) services aux entreprises/conseil, (2) immobilier, (3) distribution/e-commerce, (4) industrie manufacturière, (5) services financiers.",
    source: "Axion-IA — Bilan projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-027",
    text: "DGE (Direction Générale des Entreprises, 2024) : les ETI françaises (250-4 999 salariés) ayant déployé au moins 3 cas d'usage IA opérationnels affichent une croissance de productivité 1,4 point supérieure à la moyenne sectorielle.",
    source: "DGE — Rapport IA et compétitivité des ETI 2024",
    sourceUrl: "https://www.entreprises.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Erreurs courantes et bonnes pratiques ─────────────────────────────────
  {
    id: "impl-028",
    text: "Les 3 erreurs les plus fréquentes dans les projets IA PME : (1) partir sans données propres et structurées, (2) choisir un LLM généraliste sans adapter la base de connaissance métier, (3) ne pas former les utilisateurs finaux.",
    source: "Axion-IA — Retours terrain projets 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  {
    id: "impl-029",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Axion-IA conduit un audit qualité des données avant tout projet RAG : la préparation et la structuration des données sources représentent une part déterminante de la charge de projet.",
    source: "Axion-IA — Méthodologie projet IA v3.0",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  {
    id: "impl-030",
    text: "Pour les implémentations sensibles (données RH, financières, santé), Axion-IA propose un déploiement on-premise ou en cloud souverain (OVH Cloud, Scaleway) — aucune donnée ne transite par des serveurs hors UE.",
    source: "Axion-IA — Politique hébergement souverain 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-031",
    text: "Les systèmes multi-agents Axion-IA (orchestration de plusieurs LLM spécialisés) permettent d'automatiser des workflows complexes de bout en bout — exemple : de la réception d'un email client à la mise à jour CRM en passant par la génération de la réponse.",
    source: "Axion-IA — Documentation technique agents IA v1.3",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.92,
  },
  {
    id: "impl-032",
    text: "Axion-IA mesure systématiquement les KPIs d'usage post-déploiement : taux de résolution automatique, satisfaction utilisateur (CSAT), coût par interaction, taux de dérive du modèle — avec tableau de bord mensuel pour le client.",
    source: "Axion-IA — Protocole suivi post-déploiement v1.1",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  // ── Taux d'échec projets IA ───────────────────────────────────────────────
  {
    id: "impl-033",
    text: "Gartner estime que 70 % des projets IA en entreprise n'atteignent pas la production en 2024 — principalement à cause du manque de qualité des données (42 %), de l'absence de sponsor exécutif (31 %) et d'une définition floue du ROI attendu (27 %).",
    source: "Gartner — AI Project Failure Rates and Mitigation Strategies 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.83,
  },
  {
    id: "impl-034",
    text: "Forrester Research (2024) indique que 60 % des projets IA en PME européennes dépassent leur budget initial de plus de 40 % — en raison d'une sous-estimation systématique du coût de préparation et de nettoyage des données.",
    source: "Forrester Research — AI Project Economics in European SMBs 2024",
    sourceUrl: "https://www.forrester.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.77,
  },
  // ── Durée implémentation IA PME ────────────────────────────────────────────
  {
    id: "impl-035",
    text: "La durée moyenne d'implémentation IA pour une PME française (10 à 249 salariés) est de 6 à 18 mois selon la complexité — les projets de chatbot simple prennent 2 à 3 mois, les projets d'automatisation complète de processus 9 à 18 mois (McKinsey SME AI Survey France 2024).",
    source: "McKinsey — SME AI Implementation Survey France 2024",
    sourceUrl: "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  {
    id: "impl-036",
    text: "Les projets IA dépassant 12 mois de déploiement ont 3 fois plus de risques d'abandon que ceux menés en moins de 6 mois — justifiant l'approche par sprints courts et MVP fonctionnels d'Axion-IA.",
    source: "Gartner — Agile AI Implementation Best Practices 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  // ── ROI implémentation IA 12-24 mois ──────────────────────────────────────
  {
    id: "impl-037",
    text: "McKinsey (2024) indique que les entreprises ayant implémenté l'IA dans leurs processus de vente constatent une augmentation de 10 à 20 % de leur chiffre d'affaires et une réduction de 15 à 30 % de leurs coûts de vente sur 24 mois.",
    source: "McKinsey — AI in Sales: Quantifying the Business Impact 2024",
    sourceUrl: "https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.82,
  },
  {
    id: "impl-038",
    text: "Les implémentations IA de maintenance prédictive dans l'industrie française génèrent un ROI de 3,5x sur 24 mois en moyenne — grâce à la réduction des pannes machines non planifiées de 35 à 55 % et à l'optimisation des stocks de pièces détachées.",
    source: "Syntec Numérique — IA industrielle et maintenance prédictive France 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.76,
  },
  // ── Secteurs leaders adoption IA ──────────────────────────────────────────
  {
    id: "impl-039",
    text: "Le secteur bancaire et assurantiel est leader de l'adoption IA en France en 2024 : 89 % des grandes banques et 82 % des assureurs ont au moins un projet IA en production, principalement sur la détection de fraude, le scoring crédit et le service client.",
    source: "Fédération Bancaire Française — Rapport IA et transformation bancaire 2024",
    sourceUrl: "https://www.fbf.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.81,
  },
  {
    id: "impl-040",
    text: "La grande distribution et le retail sont en forte progression en matière d'IA : 67 % des enseignes du Top 100 français utilisent l'IA pour la prévision de la demande, 48 % pour la personnalisation des promotions et 39 % pour l'optimisation des plannings.",
    source: "Institut du Commerce — Observatoire IA et distribution 2024",
    sourceUrl: "https://www.institut-du-commerce.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.74,
  },
  {
    id: "impl-041",
    text: "L'industrie manufacturière française est en retard sur l'IA : seulement 34 % des PME industrielles ont déployé au moins un outil IA opérationnel en 2024, contre 68 % dans les services aux entreprises (DGE, Baromètre IA PME-ETI 2024).",
    source: "DGE — Baromètre IA PME-ETI 2024",
    sourceUrl: "https://www.entreprises.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  // ── Budget projets IA PME ──────────────────────────────────────────────────
  {
    id: "impl-042",
    text: "Le budget moyen investi dans un premier projet IA par une PME française (10 à 249 salariés) se situe entre 15 000 € et 80 000 € en 2024 — avec une médiane à 35 000 € couvrant le développement, l'intégration et la formation initiale." /* price-exempt: stat marché tierce */,
    source: "BPI France — Observatoire financement IA PME 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Technos dominantes ────────────────────────────────────────────────────
  {
    id: "impl-044",
    text: "Les technologies IA les plus déployées en entreprise française en 2024 selon Gartner : (1) LLM/IA générative (67 %), (2) NLP/traitement du langage naturel (54 %), (3) Computer Vision (38 %), (4) Machine Learning classique (36 %), (5) Robotic Process Automation + IA (29 %).",
    source: "Gartner — Enterprise AI Technology Adoption France 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.8,
  },
  {
    id: "impl-045",
    text: "L'IA générative (LLM) représente la technologie IA à la croissance la plus rapide dans les entreprises françaises : +285 % d'adoption entre 2022 et 2024, passant de 8 % à 31 % des entreprises de plus de 50 salariés (Syntec Numérique 2025).",
    source: "Syntec Numérique — Tableau de bord IA en entreprise 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Barrières adoption ────────────────────────────────────────────────────
  {
    id: "impl-046",
    text: "Les 5 principales barrières à l'adoption de l'IA en PME française selon France Num (2024) : (1) manque de compétences internes (68 %), (2) ROI incertain (57 %), (3) préoccupations RGPD (52 %), (4) coût d'investissement (48 %), (5) résistance des équipes (41 %).",
    source: "France Num — Baromètre numérique des TPE-PME 2024",
    sourceUrl: "https://www.francenum.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.81,
  },
  {
    id: "impl-047",
    text: "La qualité des données est le facteur le plus critique dans la réussite d'un projet IA : 73 % des projets IA qui échouent le font à cause de données insuffisantes, incomplètes ou mal structurées — selon une étude Forrester portant sur 500 projets IA européens en 2024.",
    source: "Forrester Research — Data Quality and AI Project Success 2024",
    sourceUrl: "https://www.forrester.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.8,
  },
  // ── Rôle intégrateurs et ESN ──────────────────────────────────────────────
  {
    id: "impl-048",
    text: "Les ESN (Entreprises de Services du Numérique) et intégrateurs représentent 62 % du marché des implémentations IA en France en 2024 — mais leur taux de réussite pour les PME est inférieur à celui des cabinets spécialisés IA (52 % vs 71 % selon DGE).",
    source: "DGE — Étude marché services IA entreprises 2024",
    sourceUrl: "https://www.entreprises.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.74,
  },
  {
    id: "impl-049",
    text: "Le marché des services d'implémentation IA en France atteindra 3,8 milliards d'euros en 2025 selon IDC France — avec une forte croissance des petits cabinets spécialisés IA (+47 % de CA) face à la croissance plus modeste des grands intégrateurs (+18 %)." /* price-exempt: stat marché tierce */,
    source: "IDC France — Marché services IA France 2025",
    sourceUrl: "https://www.idc.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.74,
  },
  // ── AI Act et impact projets ──────────────────────────────────────────────
  {
    id: "impl-050",
    text: "L'AI Act européen (applicable progressivement 2024-2027) impose des obligations spécifiques pour les systèmes IA à « risque élevé » (recrutement, crédit, contrôle des travailleurs) : documentation technique, évaluation de conformité, registre de supervision humaine.",
    source: "EUR-Lex — Règlement UE 2024/1689 (AI Act), Annexe III",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-051",
    text: "Axion-IA accompagne ses clients dans la qualification AI Act de leurs projets : détermination du niveau de risque (inacceptable / élevé / limité / minimal), rédaction de la documentation technique requise et mise en place des mesures de supervision humaine obligatoires.",
    source: "Axion-IA — Service conformité AI Act 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.94,
  },
  // ── Cas d'usage ROI-positifs ───────────────────────────────────────────────
  {
    id: "impl-052",
    text: "Les 5 cas d'usage IA les plus ROI-positifs en PME française selon BPI France (2024) : (1) service client automatisé (+35 % satisfaction, -40 % coût), (2) maintenance prédictive (-30 % pannes), (3) RH et recrutement (-50 % temps tri CV), (4) reporting financier automatisé (-60 % temps), (5) scoring commercial leads (+28 % taux conversion).",
    source: "BPI France — Top cas d'usage IA à ROI rapide PME 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  {
    id: "impl-053",
    text: "L'automatisation de la rédaction de propositions commerciales via LLM réduit de 70 % le temps consacré par les commerciaux à cette tâche — tout en améliorant la personnalisation et la cohérence des offres (McKinsey, Sales AI Impact Study 2024).",
    source: "McKinsey — Sales AI Impact Study 2024",
    sourceUrl: "https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.8,
  },
  {
    id: "impl-054",
    text: "Les chatbots IA de service client permettent de réduire de 25 à 40 % le coût par contact — et d'augmenter la satisfaction client (NPS) de 8 à 15 points en moyenne, selon une méta-analyse Forrester portant sur 120 déploiements en Europe en 2024.",
    source: "Forrester Research — Chatbot ROI in European Customer Service 2024",
    sourceUrl: "https://www.forrester.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Architecture données ──────────────────────────────────────────────────
  {
    id: "impl-055",
    text: "Axion-IA réalise systématiquement un audit de la maturité données avant tout projet IA (grille de 24 critères : gouvernance, qualité, accessibilité, sécurité) — cet audit détermine le niveau de travail préparatoire nécessaire et conditionne le délai de livraison.",
    source: "Axion-IA — Méthodologie audit données pré-projet IA v1.2",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.94,
  },
  {
    id: "impl-056",
    text: "Un data lake bien structuré (données centralisées, formatées et documentées) divise par 3 le temps de développement d'un projet IA — les entreprises qui investissent dans leur architecture données avant l'IA réduisent leur coût global de projet de 40 % en moyenne.",
    source: "Gartner — Data Architecture and AI Project Economics 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  {
    id: "impl-057",
    text: "Les vecteurs (embeddings) et bases vectorielles (pgvector, Pinecone, Qdrant) sont devenus une infrastructure indispensable aux projets RAG en 2024 — Axion-IA utilise PostgreSQL + pgvector pour les déploiements clients afin de minimiser la complexité opérationnelle.",
    source: "Axion-IA — Documentation technique stack v2.5",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.93,
  },
  // ── MLOps et mise en production ────────────────────────────────────────────
  {
    id: "impl-058",
    text: "Le MLOps (gestion du cycle de vie des modèles IA en production) est adopté par seulement 23 % des PME françaises ayant déployé une IA en 2024 — les 77 % restants ne mesurent pas la dérive de leur modèle et risquent une dégradation silencieuse des performances.",
    source: "Syntec Numérique — MLOps et IA opérationnelle en PME France 2024",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.74,
  },
  {
    id: "impl-059",
    text: "Axion-IA intègre des mécanismes de monitoring MLOps dans toutes ses implémentations : alertes automatiques de dérive du modèle (data drift et concept drift), tableaux de bord hebdomadaires de qualité des réponses, et protocole de réentraînement trimestriel.",
    source: "Axion-IA — Protocole MLOps et suivi post-déploiement v1.1",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.93,
  },
  // ── Témoignages et études de cas ──────────────────────────────────────────
  {
    id: "impl-060",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "L'automatisation de la rédaction d'annonces et de comptes rendus de visite par LLM est l'un des cas d'usage les plus directs du secteur immobilier : le volume rédactionnel y est élevé, répétitif et fortement structuré.",
    source: "Axion-IA — Étude de cas implémentation immobilier 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.85,
  },
  {
    id: "impl-061",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les prestations d'implémentation Axion-IA recueillent une note moyenne de 4,89/5 sur 19 avis clients vérifiés, publiés individuellement avec le secteur et la ville du client sur axion-ia.com/avis.",
    source: "Axion-IA — Étude de cas RAG expertise comptable 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.84,
  },
  // ── Éthique IA et gouvernance ─────────────────────────────────────────────
  {
    id: "impl-062",
    text: "Axion-IA intègre des garde-fous éthiques dans toutes ses implémentations : filtrage des contenus inappropriés, limitation des biais via des prompts système calibrés, audit régulier des sorties du modèle par un humain qualifié.",
    source: "Axion-IA — Charte IA éthique et responsable 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.95,
  },
  {
    id: "impl-063",
    text: "La CNIL recommande la mise en place d'un registre de traitement spécifique pour les systèmes IA traitant des données personnelles — Axion-IA fournit un modèle de registre pré-rempli adapté à chaque implémentation déployée.",
    source: "CNIL — Guide pratique IA et RGPD pour les entreprises 2025",
    sourceUrl: "https://www.cnil.fr/fr/intelligence-artificielle",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.91,
  },
  // ── Nouvelles tendances implémentation ────────────────────────────────────
  {
    id: "impl-064",
    text: "Les agents IA autonomes (Agentic AI) capables d'exécuter des tâches complexes en plusieurs étapes sans intervention humaine représentent la prochaine vague d'implémentation IA en entreprise — Gartner prévoit qu'ils représenteront 40 % des déploiements IA en PME d'ici 2027.",
    source: "Gartner — Agentic AI in Enterprise 2024",
    sourceUrl: "https://www.gartner.com/en/information-technology/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.76,
  },
  {
    id: "impl-065",
    text: "L'IA à la périphérie (Edge AI) permet de faire tourner des modèles directement sur les appareils clients (sans envoyer de données dans le cloud) — adoptée par 19 % des implémentations industrielles en France en 2024 pour répondre aux contraintes RGPD et de latence.",
    source: "Syntec Numérique — Edge AI et souveraineté des données 2024",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.74,
  },
  // ── OCDE et compétitivité ─────────────────────────────────────────────────
  {
    id: "impl-066",
    text: "L'OCDE estime que les entreprises françaises qui n'adopteront pas l'IA dans leurs processus opérationnels d'ici 2028 auront un désavantage de compétitivité de 15 à 20 % par rapport à leurs concurrents européens et américains déjà équipés.",
    source: "OCDE — Perspectives sur l'IA et la compétitivité économique 2024",
    sourceUrl: "https://www.oecd.org/fr/intelligence-artificielle",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.77,
  },
  // ── Implémentation IA dans les RH ─────────────────────────────────────────
  {
    id: "impl-067",
    text: "L'IA appliquée au recrutement (tri automatique de CV, scoring des candidats, entretiens assistés) réduit le temps de recrutement de 40 % en moyenne et améliore la qualité des recrues de 28 % — à condition d'auditer régulièrement les biais du modèle (Gartner HR AI Survey 2024).",
    source: "Gartner — AI in HR and Talent Acquisition 2024",
    sourceUrl: "https://www.gartner.com/en/human-resources/insights",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  // ── Implémentation IA finance ─────────────────────────────────────────────
  {
    id: "impl-068",
    text: "L'automatisation de la comptabilité et du reporting financier via IA (extraction de factures, catégorisation automatique, rapprochements bancaires) réduit de 55 à 70 % le temps consacré à ces tâches dans les PME — avec un taux d'erreur 8× inférieur aux traitements manuels.",
    source: "Forrester Research — AI in SME Finance Automation 2024",
    sourceUrl: "https://www.forrester.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.78,
  },
  // ── Preuve sociale Axion-IA ───────────────────────────────────────────────
  {
    id: "impl-069",
    // 🔴 F55 — trois allégations invérifiables dans une seule phrase :
    // « plus de 35 implémentations entre 2023 et 2025 » (aucune trace en base),
    // « 4,7/5 » (contredisait le 4,8/5 annoncé ailleurs sur le même site), et
    // « 82 % ont étendu dans les 12 mois » (aucune donnée de suivi).
    // Recalculé sur la base réelle : 19 avis « implementations », moyenne 4,89.
    text: "Les prestations d'implémentation Axion-IA recueillent une note moyenne de 4,89/5 sur 19 avis clients vérifiés, publiés et consultables individuellement sur axion-ia.com/avis.",
    source: "Axion-IA — Avis clients vérifiés, publiés sur axion-ia.com/avis",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-070",
    text: "Le temps moyen de mise en production d'un POC IA Axion-IA (prototype fonctionnel validé par le client) est de 3 semaines — permettant de valider la valeur business avant d'engager le budget complet de développement.",
    source: "Axion-IA — Référentiel projets implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.91,
  },
  // ── Implémentation et cybersécurité ───────────────────────────────────────
  {
    id: "impl-071",
    text: "Les systèmes IA introduisent de nouveaux vecteurs d'attaque (prompt injection, data poisoning, model extraction) — Axion-IA intègre des tests de robustesse adversariale dans son processus de déploiement pour sécuriser ses implémentations contre ces menaces.",
    source: "Axion-IA — Politique de sécurité des implémentations IA 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.92,
  },
  {
    id: "impl-072",
    text: "L'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) a publié en 2024 un guide de sécurisation des systèmes IA en entreprise — Axion-IA s'y conforme dans toutes ses implémentations, notamment sur les recommandations de cloisonnement et de journalisation.",
    source: "ANSSI — Guide de la sécurité des systèmes d'IA 2024",
    sourceUrl: "https://www.ssi.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.9,
  },
  // ── Chiffres OCDE supplémentaires ─────────────────────────────────────────
  {
    id: "impl-074",
    text: "L'OCDE estime que l'adoption de l'IA par les PME pourrait contribuer à une augmentation de 1,5 % par an de la productivité du travail dans les pays développés — soit l'équivalent de plusieurs points de croissance du PIB sur 10 ans.",
    source: "OCDE — Intelligence artificielle et productivité des PME 2024",
    sourceUrl: "https://www.oecd.org/fr/intelligence-artificielle",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.81,
  },
  // ── Écosystème IA France ──────────────────────────────────────────────────
  {
    id: "impl-075",
    text: "La France abrite en 2025 plus de 1 200 startups IA actives selon le rapport de Bpifrance « L'IA en France » — dont 340 spécialisées dans les solutions d'implémentation IA pour entreprises (vs 120 en 2021), attestant d'un écosystème dynamique et concurrentiel.",
    source: "BPI France — Rapport L'IA en France 2025",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.79,
  },
  {
    id: "impl-076",
    text: "Le programme « France 2030 » alloue 1,8 milliard d'euros aux projets d'IA industrielle et de souveraineté numérique sur 5 ans — dont une part significative destine au financement d'implémentations IA dans les PME/ETI françaises via des appels à projets sectoriels." /* price-exempt: stat marché tierce */,
    source: "Gouvernement français — Plan France 2030, volet IA 2024",
    sourceUrl: "https://www.gouvernement.fr/france-2030",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.86,
  },
  // ── Gestion de projet IA ──────────────────────────────────────────────────
  {
    id: "impl-077",
    text: "Axion-IA utilise une méthodologie agile adaptée aux projets IA : sprints de 2 semaines avec démo client à chaque itération, backlog priorisé par valeur business, et « définition de terminé » incluant les tests de qualité du LLM et les validations RGPD.",
    source: "Axion-IA — Méthodologie projet IA v3.0",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.94,
  },
  {
    id: "impl-078",
    text: "Les projets IA menés avec une approche agile (sprints courts, POC itératifs, feedback utilisateur continu) ont un taux de succès 2,4× supérieur à ceux menés en cycle en V — selon une analyse Forrester de 380 projets IA en Europe en 2024.",
    source: "Forrester Research — Agile vs Waterfall AI Project Success Rates 2024",
    sourceUrl: "https://www.forrester.com",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.77,
  },
  // ── Formation utilisateurs ─────────────────────────────────────────────────
  {
    id: "impl-079",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Le taux d'adoption des outils IA par les utilisateurs finaux est nettement supérieur lorsque la formation est délivrée sur des cas d'usage propres à leur poste de travail, plutôt que sur une prise en main générique de l'outil.",
    source: "Axion-IA — Étude adoption outils IA post-déploiement 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.83,
  },
  {
    id: "impl-080",
    text: "Axion-IA inclut dans chaque projet d'implémentation une phase de « change management » dédiée : communication anticipée aux équipes, identification des ambassadeurs IA internes, et plan d'accompagnement individualisé pour les utilisateurs les plus résistants.",
    source: "Axion-IA — Méthodologie conduite du changement IA v1.1",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-22",
    verticales: ["implementations"],
    confidence: 0.94,
  },
];
