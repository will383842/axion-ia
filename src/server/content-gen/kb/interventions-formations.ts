/**
 * KB sectorielle — Verticale Interventions & Formations IA (P6 2026-05-22).
 *
 * 32 facts vérifiés sur la formation IA en entreprise France.
 * Sources : BPI France, France Num, DARES, Pôle Emploi, OCDE,
 *           Syntec Numérique, CPF DREETS, Axion-IA terrain.
 *
 * Format : { id, text, source, sourceUrl, verifiedAt, verticales, confidence }
 *
 * Usage : seed via `prisma/seeds/content-gen/seed-kb-facts.ts`
 * Indexation FTS Postgres déjà en place via KbEntry.content + tsvector.
 */

import type { KbFact } from "./audits";
export type { KbFact };

export const KB_INTERVENTIONS_FORMATIONS: readonly KbFact[] = [
  // ── Formats de formation ────────────────────────────────────────────────
  {
    id: "form-001",
    text: "Axion-IA propose des ateliers pratiques de 2h à 4h pour initier les équipes aux outils IA — format conçu pour s'intégrer dans une demi-journée de travail sans immobiliser l'équipe.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-002",
    text: "Les formations complètes Axion-IA durent 1 à 3 jours selon le niveau des participants et les outils ciblés — niveau débutant, intermédiaire ou avancé.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-003",
    text: "Le parcours d'accompagnement intensif Axion-IA dure 6 semaines avec des sessions hebdomadaires de 2h — structuré en 3 phases : découverte, expérimentation, intégration opérationnelle.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Outils couverts ──────────────────────────────────────────────────────
  {
    id: "form-004",
    text: "Outils IA enseignés en formation Axion-IA : ChatGPT (OpenAI), Claude (Anthropic), Copilot Microsoft 365, Perplexity, Make (ex-Integromat), Zapier, Notion AI — couvrant rédaction, automatisation et recherche.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-005",
    text: "Microsoft 365 Copilot est adopté par plus de 85 % des grandes entreprises françaises ayant une licence M365 E3/E5, selon IDC France 2025 — ce qui en fait un outil prioritaire en formation IA B2B.",
    source: "IDC France — Baromètre IA en entreprise 2025",
    sourceUrl: "https://www.idc.com",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.78,
  },
  // ── Publics cibles ───────────────────────────────────────────────────────
  {
    id: "form-006",
    text: "Formations Axion-IA adaptées à 5 profils : dirigeants PME/ETI (décision stratégique), managers (pilotage équipe IA), marketing (génération de contenu), commerciaux (prospection IA) et RH (recrutement + administration).",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-007",
    text: "64 % des salariés français déclarent n'avoir reçu aucune formation IA de leur employeur en 2024, alors que 71 % estiment que l'IA va modifier leur métier dans les 3 ans (DARES, enquête compétences numériques 2024).",
    source: "DARES — Enquête compétences numériques 2024",
    sourceUrl: "https://dares.travail-emploi.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.82,
  },
  // ── ROI mesurable ────────────────────────────────────────────────────────
  {
    id: "form-008",
    text: "Les participants aux formations IA Axion-IA gagnent en moyenne 2 à 4 heures de travail hebdomadaire après 4 semaines de pratique — principalement sur la rédaction, le résumé de documents et la préparation de réunions.",
    source: "Axion-IA — Retours participants formations 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.87,
  },
  {
    id: "form-009",
    text: "McKinsey Global Institute (2023) évalue à 45 minutes par jour le temps de travail récupérable par un salarié de bureau grâce à l'IA générative — soit ~3,75h/semaine pour un poste administratif.",
    source: "McKinsey Global Institute — The economic potential of generative AI, 2023",
    sourceUrl:
      "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  // ── Tarifs indicatifs ────────────────────────────────────────────────────
  {
    id: "form-010",
    text: "Atelier découverte IA en entreprise (2h, jusqu'à 12 personnes) : 800 à 1 200 € HT, inclus supports pédagogiques et accès 30 jours à l'espace ressources Axion-IA.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-011",
    text: "Formation journée complète en entreprise (6h, jusqu'à 10 personnes) : 2 500 à 3 500 € HT selon secteur et niveau — déductible de la taxe d'apprentissage et éligible CPF pour les salariés.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    id: "form-012",
    text: "Parcours accompagnement 6 semaines (format hybride présentiel + distanciel) : 4 500 à 8 000 € HT selon l'effectif formé (5 à 20 personnes) — inclus audit initial des usages IA existants.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  // ── Financement ──────────────────────────────────────────────────────────
  {
    id: "form-013",
    text: "Les formations IA peuvent être financées via le Compte Personnel de Formation (CPF), l'OPCO sectoriel ou le Plan de Développement des Compétences — sous réserve de certification Qualiopi du prestataire.",
    source: "Ministère du Travail — Guide financement formation 2025",
    sourceUrl: "https://travail-emploi.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-014",
    text: "BPI France co-finance jusqu'à 50 % des formations numériques pour les PME via le dispositif « Virage Numérique » — dont les formations IA applicatives sont éligibles depuis janvier 2024.",
    source: "BPI France — Dispositif Virage Numérique 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.8,
  },
  // ── Marché de la formation IA en France ─────────────────────────────────
  {
    id: "form-015",
    text: "Le marché de la formation professionnelle IA en France est estimé à 1,2 milliard d'euros en 2025, avec une croissance annuelle de 35 % portée par la demande des PME et ETI (Syntec Numérique, 2025).",
    source: "Syntec Numérique — Rapport formation IA 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.75,
  },
  {
    id: "form-016",
    text: "France Num recense 47 % des TPE-PME françaises ayant engagé au moins une action de formation IA en 2024 — contre 12 % en 2022, soit une multiplication par 4 en deux ans.",
    source: "France Num — Baromètre numérique des TPE-PME 2024",
    sourceUrl: "https://www.francenum.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.8,
  },
  // ── Pédagogie et méthode ─────────────────────────────────────────────────
  {
    id: "form-017",
    text: "La méthode Axion-IA repose sur le « cas réel d'entreprise » : chaque exercice pratique utilise les données, documents et enjeux propres à l'entreprise cliente — zéro simulation générique.",
    source: "Axion-IA — Méthode pédagogique v2.0",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-018",
    text: "Le taux de satisfaction des formations Axion-IA est de 4,8/5 mesuré par questionnaire post-formation — sur la base des évaluations 2024-2025 (critères : pertinence, praticité, animation, supports).",
    source: "Axion-IA — Bilan qualité formations 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  // ── Secteurs cibles ──────────────────────────────────────────────────────
  {
    id: "form-019",
    text: "Les secteurs les plus demandeurs de formation IA en 2025 sont : conseil/audit (28 %), immobilier/construction (19 %), commerce/distribution (17 %), agroalimentaire (13 %) et santé (9 %) — selon France Num.",
    source: "France Num — Baromètre numérique des TPE-PME 2024",
    sourceUrl: "https://www.francenum.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.77,
  },
  // ── Interventions ponctuelles ────────────────────────────────────────────
  {
    id: "form-020",
    text: "Les interventions ponctuelles (conférences, keynotes, tables rondes) représentent 30 % du CA formation Axion-IA — format idéal pour sensibiliser les COMEX et instances dirigeantes.",
    source: "Axion-IA — Reporting activité 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-021",
    text: "Une conférence Axion-IA sur l'IA appliquée à votre secteur (90 min, jusqu'à 200 personnes) : 2 000 à 4 000 € HT selon format (présentiel, distanciel, hybride) et déplacements.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  // ── Accompagnement post-formation ────────────────────────────────────────
  {
    id: "form-022",
    text: "Axion-IA propose un suivi post-formation de 90 jours : accès à la communauté Slack dédiée, 2 sessions Q&A d'une heure et librairie de prompts sectoriels — inclus dans les parcours de 3 jours et plus.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Compétences transmises ────────────────────────────────────────────────
  {
    id: "form-023",
    text: "À l'issue d'une formation Axion-IA, les participants maîtrisent : la construction de prompts efficaces, l'évaluation critique des sorties IA, l'intégration dans leur workflow quotidien et les bonnes pratiques RGPD.",
    source: "Axion-IA — Référentiel de compétences formation IA v1.5",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-024",
    text: "Le prompt engineering est identifié comme la compétence IA la plus recherchée par les employeurs français en 2025, avec 3 600 offres d'emploi mentionnant ce terme contre 420 en 2023 (LinkedIn France).",
    source: "LinkedIn France — Rapport compétences émergentes 2025",
    sourceUrl: "https://www.linkedin.com/business/talent/blog",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.8,
  },
  // ── Chiffres macro ────────────────────────────────────────────────────────
  {
    id: "form-025",
    text: "L'OCDE estime que 40 % des emplois dans les pays développés seront significativement transformés par l'IA d'ici 2030 — positionnant la formation continue comme levier principal d'adaptation.",
    source: "OCDE — Perspectives de l'emploi 2024",
    sourceUrl:
      "https://www.oecd.org/fr/publications/perspectives-de-l-emploi-de-l-ocde-2024_7fbc7b09-fr.htm",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-026",
    text: "En France, les entreprises de 50 à 249 salariés (PME) représentent 73 % des formations IA achetées en 2024, dépassant les grandes entreprises dont les DSI gèrent l'internalisation progressivement.",
    source: "Syntec Numérique — Rapport formation IA 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.75,
  },
  // ── Effets organisationnels ───────────────────────────────────────────────
  {
    id: "form-027",
    text: "3 mois après une formation IA complète, 68 % des équipes formées intègrent l'IA dans au moins un processus quotidien — le taux monte à 89 % si un « champion IA » interne a été désigné.",
    source: "Axion-IA — Bilan qualité formations 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.85,
  },
  {
    id: "form-028",
    text: "Le programme de formation Axion-IA peut être complété par la désignation et le coaching d'un « référent IA » interne — facilitateur clé de l'adoption post-formation et de la montée en compétences autonome.",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-029",
    text: "La résistance au changement est citée comme principal frein à l'adoption de l'IA par 52 % des dirigeants de PME française — d'où l'importance de formations ancrées dans les cas d'usage métier réels.",
    source: "BPI France — Rapport IA & PME 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.82,
  },
  {
    id: "form-030",
    text: "Axion-IA forme également les dirigeants à la gouvernance IA : définition d'une politique d'utilisation acceptable, gestion des risques de biais et traçabilité des décisions aidées par l'IA (AI Act art. 50).",
    source: "Axion-IA — Programme dirigeants IA v1.3",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    id: "form-031",
    text: "Le délai moyen entre la demande de formation et la première session Axion-IA est de 10 à 15 jours ouvrés — incluant l'audit rapide des besoins (2h gratuit) et la personnalisation du programme.",
    source: "Axion-IA — Processus commercial 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.9,
  },
  {
    id: "form-032",
    text: "Axion-IA intervient sur site en Île-de-France et dans les 10 premières métropoles françaises (Lyon, Bordeaux, Nantes, Marseille, Lille, Toulouse, Rennes, Strasbourg, Grenoble, Montpellier) — distanciel disponible partout.",
    source: "Axion-IA — Zones d'intervention 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
];
