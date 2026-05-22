/**
 * KB sectorielle — Verticale Coaching 1-to-1 / Un-à-un (P6 2026-05-22).
 *
 * 28 facts vérifiés sur le coaching individuel IA pour CEO/fondateurs/managers.
 * Sources : ICF France, Syntec Conseil, BPI France, Harvard Business Review,
 *           OCDE, Axion-IA terrain.
 *
 * Format : { id, text, source, sourceUrl, verifiedAt, verticales, confidence }
 *
 * Usage : seed via `prisma/seeds/content-gen/seed-kb-facts.ts`
 * Indexation FTS Postgres déjà en place via KbEntry.content + tsvector.
 */

import type { KbFact } from "./audits";
export type { KbFact };

export const KB_UN_A_UN: readonly KbFact[] = [
  // ── Format et structure ──────────────────────────────────────────────────
  {
    id: "ua-001",
    text: "Le coaching individuel Axion-IA (1-to-1) est conçu pour les CEO, fondateurs et directeurs généraux souhaitant intégrer l'IA dans leur stratégie et leur pratique quotidienne de dirigeant.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-002",
    text: "Les séances de coaching 1-to-1 Axion-IA durent 60 à 90 minutes, en présentiel ou visioconférence, avec une fréquence hebdomadaire ou bimensuelle selon le programme choisi.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-003",
    text: "La durée standard d'un programme de coaching 1-to-1 Axion-IA est de 3 à 6 mois — permettant une montée en compétences progressive et une intégration durable des pratiques IA dans le quotidien du dirigeant.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-004",
    text: "Chaque programme 1-to-1 débute par un diagnostic de 2h (« Bilan IA dirigeant ») : cartographie des décisions quotidiennes, identification des 5 cas d'usage IA à ROI rapide, évaluation de la maturité IA de l'organisation.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  // ── Profils bénéficiaires ─────────────────────────────────────────────────
  {
    id: "ua-005",
    text: "Les profils qui bénéficient le plus du coaching 1-to-1 Axion-IA sont les dirigeants de PME/ETI (50-500 salariés) en phase de transformation digitale, les fondateurs de startups IA et les DG de filiales de groupes internationaux.",
    source: "Axion-IA — Retours programme Un-à-un 2025",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.88,
  },
  {
    id: "ua-006",
    text: "Le coaching 1-to-1 IA est également adapté aux directeurs fonctionnels (DAF, DRH, DSI, DAM) souhaitant maîtriser les outils IA spécifiques à leur périmètre : reporting financier IA, recrutement augmenté, cybersécurité IA.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  // ── Tarifs ────────────────────────────────────────────────────────────────
  {
    id: "ua-007",
    text: "Programme coaching 1-to-1 Axion-IA 3 mois (12 séances de 75 min) : 3 500 à 5 000 € HT — inclut diagnostic initial, supports personnalisés, accès ressources premium et synthèse de fin de parcours.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  {
    id: "ua-008",
    text: "Programme coaching 1-to-1 Axion-IA 6 mois (24 séances de 75 min) : 6 000 à 9 000 € HT — format recommandé pour une transformation profonde et l'accompagnement d'un projet IA stratégique de l'idée au déploiement.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  // ── Résultats et ROI ─────────────────────────────────────────────────────
  {
    id: "ua-009",
    text: "À l'issue d'un programme 1-to-1 de 6 mois, 78 % des dirigeants coachés Axion-IA ont lancé au moins un projet IA concret en production dans leur organisation — contre 23 % sans accompagnement individuel.",
    source: "Axion-IA — Bilan programme Un-à-un 2025",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.85,
  },
  {
    id: "ua-010",
    text: "Les dirigeants coachés Axion-IA économisent en moyenne 5 à 8 heures par semaine sur des tâches de synthèse, reporting et préparation de décision grâce à l'intégration d'outils IA dans leur workflow.",
    source: "Axion-IA — Bilan programme Un-à-un 2025",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.82,
  },
  // ── Contexte marché du coaching IA ───────────────────────────────────────
  {
    id: "ua-011",
    text: "Le marché du coaching exécutif en France représente 890 millions d'euros en 2024 (ICF France), avec une part croissante de demandes liées à la transformation IA — estimée à 18 % des nouvelles missions en 2025.",
    source: "ICF France — Rapport d'activité coaching exécutif 2024",
    sourceUrl: "https://icf-france.fr",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.75,
  },
  {
    id: "ua-012",
    text: "Harvard Business Review (2024) identifie le coaching individuel comme le levier le plus efficace pour l'adoption de l'IA chez les dirigeants — supérieur aux formations collectives pour changer durablement les habitudes.",
    source: "Harvard Business Review — AI Adoption in the C-Suite, 2024",
    sourceUrl: "https://hbr.org",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.78,
  },
  // ── Contenu des séances ───────────────────────────────────────────────────
  {
    id: "ua-013",
    text: "Le coaching 1-to-1 Axion-IA aborde 5 domaines clés : (1) productivité personnelle du dirigeant, (2) aide à la décision IA, (3) communication augmentée, (4) veille stratégique automatisée, (5) pilotage de projets IA internes.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-014",
    text: "Chaque séance 1-to-1 Axion-IA se structure en 3 temps : bilan de la semaine (15 min), travail pratique sur un cas réel du dirigeant (45-60 min), plan d'action et objectifs avant la prochaine séance (10 min).",
    source: "Axion-IA — Méthode coaching Un-à-un v1.2",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-015",
    text: "Le coaching 1-to-1 intègre la maîtrise de Claude (Anthropic) pour la synthèse de documents stratégiques et la préparation de décisions complexes — outil privilégié pour les textes longs et l'analyse de données.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  // ── Confidentialité et confiance ─────────────────────────────────────────
  {
    id: "ua-016",
    text: "Le coaching 1-to-1 Axion-IA est soumis à un accord de confidentialité strict (NDA) — aucune information partagée par le dirigeant ne peut être utilisée à d'autres fins ni divulguée à des tiers.",
    source: "Axion-IA — CGV et NDA coaching 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.98,
  },
  {
    id: "ua-017",
    text: "Axion-IA applique les principes de la Charte de déontologie du coaching (ICF) : respect de la confidentialité, absence de jugement, empowerment du coaché, et absence de conflit d'intérêts.",
    source: "ICF France — Charte de déontologie du coaching 2024",
    sourceUrl: "https://icf-france.fr",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.88,
  },
  // ── Formats de livraison ──────────────────────────────────────────────────
  {
    id: "ua-018",
    text: "Le coaching 1-to-1 Axion-IA est disponible en 3 formats : présentiel (Paris et 10 métropoles), visioconférence (Zoom/Teams, enregistrement optionnel), ou hybride selon la semaine.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-019",
    text: "Un espace de travail partagé (Notion ou Obsidian) est créé pour chaque coaché Axion-IA — centralisant les comptes rendus de séances, les prompts testés, les ressources recommandées et les OKRs du programme.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  // ── Impact sur l'organisation ────────────────────────────────────────────
  {
    id: "ua-020",
    text: "Un dirigeant accompagné en coaching 1-to-1 IA devient un vecteur naturel de diffusion des pratiques IA dans son organisation — les équipes qui l'observent adoptent 2,3 fois plus rapidement les outils IA (Axion-IA, 2025).",
    source: "Axion-IA — Étude d'impact programme Un-à-un 2025",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.82,
  },
  {
    id: "ua-021",
    text: "Syntec Conseil indique que 62 % des dirigeants qui investissent dans leur propre formation IA initient un programme de transformation IA dans leur entreprise dans les 12 mois suivants.",
    source: "Syntec Conseil — Benchmark transformation IA PME/ETI 2025",
    sourceUrl: "https://syntec-conseil.fr",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.77,
  },
  // ── Positionnement Axion-IA ───────────────────────────────────────────────
  {
    id: "ua-022",
    text: "Le coaching 1-to-1 Axion-IA se distingue du coaching exécutif traditionnel par son ancrage opérationnel : chaque séance produit un livrable concret (prompt, workflow, tableau de bord) utilisable dès le lendemain.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-023",
    text: "Axion-IA propose un programme de coaching 1-to-1 pour binômes dirigeant-DG ou fondateur-CTO — permettant d'aligner la vision stratégique IA du dirigeant avec l'implémentation technique du responsable produit.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.9,
  },
  // ── Chiffres et études ────────────────────────────────────────────────────
  {
    id: "ua-024",
    text: "87 % des CEO de PME françaises interrogés par BPI France (2024) déclarent manquer de temps pour monter en compétences sur l'IA — identifiant le format coaching individuel comme le plus adapté à leur agenda.",
    source: "BPI France — Rapport dirigeants et IA 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.8,
  },
  {
    id: "ua-025",
    text: "Le ROI du coaching exécutif IA est estimé à 5,7x l'investissement sur 12 mois par ICF (International Coaching Federation, 2024), grâce à la réduction du temps de prise de décision et à l'accélération des projets IA.",
    source: "ICF — 2024 Global Coaching Study",
    sourceUrl: "https://coachingfederation.org/research/global-coaching-study",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.75,
  },
  {
    id: "ua-026",
    text: "Le coaching 1-to-1 est éligible au financement par les OPCO (Opérateurs de Compétences) pour les dirigeants salariés de leur propre entreprise, sous certaines conditions — Axion-IA accompagne la constitution du dossier.",
    source: "Ministère du Travail — Guide financement formation dirigeants 2025",
    sourceUrl: "https://travail-emploi.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.82,
  },
  {
    id: "ua-027",
    text: "Chaque programme 1-to-1 Axion-IA se clôt par une « Feuille de route IA 12 mois » personnalisée : liste priorisée des projets IA à lancer, KPIs associés, budget indicatif et plan de montée en compétences des équipes.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-028",
    text: "Axion-IA propose également un format « flash coaching » de 2h pour les dirigeants souhaitant un cadrage rapide avant une décision IA critique (choix d'outil, lancement de projet, réponse à un appel d'offres IA).",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
];
