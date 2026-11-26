/**
 * KB sectorielle — Verticale Implémentations IA (P6 2026-05-22).
 *
 * Fiches sourcées (78 à l'origine) sur les implémentations IA en entreprise France.
 * Sources : celles déclarées par chaque fiche (`source` et `sourceUrl`).
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

export const KB_IMPLEMENTATIONS: readonly KbFact[] = [
  // ── Offre Axion-IA implémentations ───────────────────────────────────────
  {
    id: "impl-001",
    text: "Axion-IA conçoit et déploie des chatbots IA métier pour les PME : traitement des demandes clients, FAQ dynamique, assistance interne RH/finance — basés sur Claude API (Anthropic) avec base de connaissance RAG.",
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
    source: "Axion-IA — Offre implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-009",
    text: "Automatisation de workflow IA Axion-IA — sur devis selon le périmètre, selon le nombre d'étapes et d'intégrations — gains opérationnels mesurables dès la mise en production (généralement sous 4 à 8 semaines), ROI complet sous quelques mois. Notre approche par défaut est le code custom (Node.js, Python, infrastructures cloud-native) pour la souveraineté des données et zéro lock-in éditeur. Plateformes no-code (Make, Zapier, n8n) disponibles uniquement sur demande client explicite.",
    source: "Axion-IA — Offre implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.88,
  },
  {
    id: "impl-010",
    text: "Projet d'implémentation IA complexe Axion-IA (système multi-agents, intégration ERP, tableau de bord IA) — sur devis selon le périmètre — avec objectifs de résultat définis contractuellement.",
    source: "Axion-IA — Offre implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-05-01",
    verticales: ["implementations"],
    confidence: 0.85,
  },
  // ── ROI et chiffres marché ────────────────────────────────────────────────
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
    text: "Les chatbots IA Axion-IA affichent une information de transparence : l'utilisateur est informé qu'il échange avec un système IA, conformément à l'AI Act (art. 50, dates d'application à vérifier sur EUR-Lex).",
    source: "EUR-Lex — Règlement UE 2024/1689 (AI Act) art. 50",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    verifiedAt: "2026-11-08",
    verticales: ["implementations"],
    confidence: 0.85,
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
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
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
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
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
  // ── Maintenance et évolution ──────────────────────────────────────────────
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
    text: "Les implémentations Axion-IA sont cadrées par un devis fixe, sans mensualité imposée ni engagement de durée : les KPIs sont définis en amont du projet puis mesurés après déploiement (étape « Mesurer » de la méthodologie).",
    source: "Axion-IA — Méthodologie implémentations 2026",
    sourceUrl: "https://axion-ia.com/implementations",
    verifiedAt: "2026-08-11",
    verticales: ["implementations"],
    confidence: 0.95,
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
  // ── Erreurs courantes et bonnes pratiques ─────────────────────────────────
  {
    id: "impl-029",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
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
  // ── Taux d'échec projets IA ───────────────────────────────────────────────
  // ── Durée implémentation IA PME ────────────────────────────────────────────
  // ── ROI implémentation IA 12-24 mois ──────────────────────────────────────
  // ── Secteurs leaders adoption IA ──────────────────────────────────────────
  // ── Budget projets IA PME ──────────────────────────────────────────────────
  // ── Technos dominantes ────────────────────────────────────────────────────
  // ── Barrières adoption ────────────────────────────────────────────────────
  // ── Rôle intégrateurs et ESN ──────────────────────────────────────────────
  // ── AI Act et impact projets ──────────────────────────────────────────────
  {
    id: "impl-050",
    text: "L'AI Act européen prévoit des obligations spécifiques pour les systèmes IA « à haut risque » (recrutement, crédit, contrôle des travailleurs) : documentation technique, évaluation de conformité, supervision humaine. Le règlement (UE) 2026/1744 (omnibus IA) les a reportées au 2 décembre 2027 pour ces usages de l'annexe III : à vérifier sur EUR-Lex.",
    source:
      "EUR-Lex — Règlement (UE) 2024/1689, modifié par le règlement (UE) 2026/1744 (omnibus IA, JO du 24/07/2026)",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
    verifiedAt: "2026-11-08",
    verticales: ["implementations"],
    confidence: 0.8,
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
    id: "impl-059",
    text: "Axion-IA intègre des mécanismes de monitoring MLOps dans toutes ses implémentations : alertes automatiques de dérive du modèle (data drift et concept drift), tableaux de bord hebdomadaires de qualité des réponses.",
    source: "Axion-IA — Protocole MLOps v1.1",
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
  // ── OCDE et compétitivité ─────────────────────────────────────────────────
  // ── Implémentation IA dans les RH ─────────────────────────────────────────
  // ── Implémentation IA finance ─────────────────────────────────────────────
  // ── Preuve sociale Axion-IA ───────────────────────────────────────────────
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
  // ── Écosystème IA France ──────────────────────────────────────────────────
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
  // ── Formation utilisateurs ─────────────────────────────────────────────────
  {
    id: "impl-079",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
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
