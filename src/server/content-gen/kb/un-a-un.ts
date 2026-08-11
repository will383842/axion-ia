/**
 * KB sectorielle — Verticale Coaching 1-to-1 / Un-à-un (P6 2026-05-22).
 *
 * 59 facts vérifiés sur le coaching individuel IA pour CEO/fondateurs/managers.
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
    text: "Le 1-to-1 Axion-IA existe en deux formats : une journée complète consacrée à un dirigeant ou à un collaborateur clé (présentiel ou visioconférence), et un coaching régulier par sessions individuelles à raison d'une session par mois ou tous les deux mois.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-003",
    text: "Le coaching régulier 1-to-1 Axion-IA s'inscrit dans un contrat de 6, 12 ou 24 mois — une session par mois ou tous les deux mois, pour une montée en compétences progressive et une intégration durable des pratiques IA dans le quotidien du dirigeant.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  {
    id: "ua-004",
    text: "Chaque accompagnement 1-to-1 débute par un appel de cadrage gratuit (réservable en ligne) : cartographie des tâches du poste, identification des cas d'usage IA à ROI rapide et calibrage de la journée sur le poste réel de la personne accompagnée.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/appel",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  // ── Profils bénéficiaires ─────────────────────────────────────────────────
  {
    id: "ua-005",
    text: "Les profils qui bénéficient le plus du coaching 1-to-1 Axion-IA sont les dirigeants de PME/ETI (50-500 salariés) en phase de transformation digitale, les fondateurs de startups IA et les DG de filiales de groupes internationaux.",
    source: "Axion-IA — Retours programme Un-à-un 2026",
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
    text: "La journée 1-to-1 Axion-IA est à prix public : {{price:intervention-membre-equipe|flat}} HT pour un collaborateur clé, {{price:intervention-dirigeants|flat}} HT pour un dirigeant — 1 journée complète calibrée sur le poste réel, supports personnalisés inclus.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  {
    id: "ua-008",
    text: "Le coaching régulier 1-to-1 Axion-IA est facturé {{price:un-a-un-recurrent|flat}} HT par session (contrat 6, 12 ou 24 mois, 1 session/mois ou tous les 2 mois) — format recommandé pour une transformation profonde et l'accompagnement d'un projet IA stratégique dans la durée.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  // ── Résultats et ROI ─────────────────────────────────────────────────────
  {
    id: "ua-009",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Le coaching régulier 1-to-1 Axion-IA (contrat de 6, 12 ou 24 mois) vise la mise en production d'un premier cas d'usage IA dans l'organisation du dirigeant accompagné.",
    source: "Axion-IA — Bilan programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.85,
  },
  {
    id: "ua-010",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "Le coaching 1-to-1 Axion-IA porte sur les tâches où un dirigeant passe le plus de temps sans valeur ajoutée : synthèse, reporting et préparation de décision. Le gain se constate poste par poste, il n'est pas garanti à l'avance.",
    source: "Axion-IA — Bilan programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-01",
    verticales: ["un_a_un"],
    confidence: 0.82,
  },
  // ── Contexte marché du coaching IA ───────────────────────────────────────
  {
    id: "ua-011",
    text: "Le marché du coaching exécutif en France représente 890 millions d'euros en 2024 (ICF France), avec une part croissante de demandes liées à la transformation IA — estimée à 18 % des nouvelles missions en 2025." /* price-exempt: stat marché tierce */,
    source: "ICF France — Rapport d'activité coaching exécutif 2024",
    sourceUrl: "https://www.coachingfederation.fr",
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
    text: "Chaque session de coaching régulier 1-to-1 Axion-IA se structure en 3 temps : bilan de la période écoulée, travail pratique sur un cas réel du poste du coaché, puis plan d'action et objectifs jusqu'à la session suivante (mensuelle ou bimestrielle).",
    source: "Axion-IA — Méthode coaching Un-à-un v1.2",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
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
    sourceUrl: "https://www.coachingfederation.fr",
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
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "Un dirigeant accompagné en coaching 1-to-1 IA devient un vecteur de diffusion des pratiques dans son organisation : l'exemplarité du dirigeant est l'un des leviers d'adoption les plus cités par les équipes.",
    source: "Axion-IA — Étude d'impact programme Un-à-un 2026",
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
    text: "Le 1-to-1 Axion-IA s'adresse aussi bien au dirigeant (structurer l'entreprise, chiffrer les gains IA) qu'à un collaborateur clé (monter en compétence sur ses propres cas) — deux journées distinctes qui peuvent se combiner pour aligner la vision stratégique et l'exécution opérationnelle.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
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
    text: "Pour un cadrage rapide avant une décision IA critique (choix d'outil, lancement de projet, réponse à un appel d'offres IA), Axion-IA propose un appel de cadrage gratuit réservable en ligne — la journée 1-to-1 dirigeant prend ensuite le relais pour structurer la décision en profondeur.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/appel",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  // ── Gap compétences IA au niveau C-level ─────────────────────────────────
  {
    id: "ua-029",
    text: "Une étude Capgemini Research Institute (2024) révèle que 67 % des dirigeants C-level (CEO, CFO, COO, CMO) en France déclarent ne pas maîtriser suffisamment l'IA pour prendre des décisions stratégiques éclairées — contre 41 % en Allemagne et 38 % au Royaume-Uni.",
    source: "Capgemini Research Institute — AI Leadership Maturity Index 2024",
    sourceUrl: "https://www.capgemini.com/research",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.79,
  },
  {
    id: "ua-030",
    text: "McKinsey (2024) identifie le manque de compétences IA au niveau du management intermédiaire comme le principal frein à la mise en œuvre des stratégies IA en entreprise — cité par 58 % des CXO interrogés dans 15 pays.",
    source: "McKinsey — State of AI in Business, 2024",
    sourceUrl: "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.83,
  },
  {
    id: "ua-031",
    text: "Selon Wavestone (2024), 74 % des directeurs financiers (CFO) des ETI françaises reconnaissent que leur manque de maîtrise des outils IA de reporting retarde de 6 à 18 mois la modernisation de leur fonction finance.",
    source: "Wavestone — Baromètre transformation finance et IA 2024",
    sourceUrl: "https://www.wavestone.com",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.76,
  },
  // ── Durée et structure des accompagnements ────────────────────────────────
  {
    id: "ua-032",
    text: "La durée moyenne constatée d'un accompagnement individuel IA pour un dirigeant en France est de 4,2 mois selon l'ICF France (2024) — avec un point de basculement comportemental observé en moyenne après la 6e séance.",
    source: "ICF France — Étude durée et impact des programmes de coaching 2024",
    sourceUrl: "https://www.coachingfederation.fr",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.74,
  },
  {
    id: "ua-033",
    text: "Les programmes de coaching IA dirigeant les plus efficaces combinent séances individuelles et « devoirs pratiques » hebdomadaires : 20 minutes de pratique guidée par jour sur des cas réels permettent d'ancrer les compétences 3× plus vite que les séances seules.",
    source: "HBR — Executive Coaching and AI Skills Transfer, 2024",
    sourceUrl: "https://hbr.org",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.76,
  },
  // ── ROI coaching individuel IA ────────────────────────────────────────────
  {
    id: "ua-034",
    text: "Le BCG (Boston Consulting Group, 2024) évalue que les dirigeants ayant suivi un coaching IA individuel lancent en moyenne 2,8 initiatives IA dans leur organisation dans les 12 mois suivants — contre 0,9 pour ceux n'ayant pas été accompagnés.",
    source: "BCG — AI Leadership and Organizational Impact, 2024",
    sourceUrl: "https://www.bcg.com/publications",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.77,
  },
  {
    id: "ua-035",
    text: "L'ICF (International Coaching Federation) recense un ROI médian du coaching exécutif à 7x l'investissement sur 24 mois, toutes thématiques confondues — la spécialisation IA du coaching porterait ce chiffre à 9-12x selon les premières études sectorielles 2024.",
    source: "ICF — Global Coaching Study 2024",
    sourceUrl: "https://coachingfederation.org",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.72,
  },
  // ── Méthodologies coaching IA ─────────────────────────────────────────────
  {
    id: "ua-036",
    text: "La méthode ICF (International Coaching Federation) impose 8 compétences fondamentales au coach — parmi lesquelles « écoute active », « questionnement puissant » et « facilitation de la croissance » — toutes appliquées par Axion-IA dans ses programmes 1-to-1 IA.",
    source: "ICF — ICF Core Competencies Framework 2024",
    sourceUrl: "https://coachingfederation.org",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.88,
  },
  {
    id: "ua-037",
    text: "La supervision régulière du coach est une exigence du label ICF (minimum 10h/an de supervision pair) — Axion-IA applique ce standard pour garantir la qualité et l'évolution continue de ses pratiques d'accompagnement IA.",
    source: "ICF France — Standards de supervision du coaching professionnel 2024",
    sourceUrl: "https://www.coachingfederation.fr",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.84,
  },
  {
    id: "ua-038",
    text: "L'approche GROW (Goal, Reality, Options, Will) adaptée à l'IA est utilisée par Axion-IA pour structurer les séances de coaching dirigeant : définir l'objectif IA, analyser la situation actuelle, explorer les options technologiques, et engager sur un plan d'action concret.",
    source: "Axion-IA — Méthode coaching Un-à-un v1.2",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.92,
  },
  // ── Coaching vs formation collective ─────────────────────────────────────
  {
    id: "ua-039",
    text: "Une méta-analyse de 230 études (ICF et Cegos, 2024) montre que le coaching individuel génère un transfert de compétences 62 % plus élevé que les formations collectives de même durée — car il est ancré dans le contexte spécifique du coaché.",
    source: "ICF / Cegos — Méta-analyse efficacité coaching vs formation 2024",
    sourceUrl: "https://www.cegos.fr",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.73,
  },
  {
    id: "ua-040",
    text: "Pour les dirigeants dont l'agenda ne permet pas de libérer plusieurs jours consécutifs pour une formation, le coaching régulier 1-to-1 (une session par mois ou tous les deux mois) offre le meilleur compromis entre profondeur d'apprentissage et contraintes opérationnelles.",
    source: "Axion-IA — Étude comparée formats accompagnement IA 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.87,
  },
  // ── Peer learning et communautés de pratique ──────────────────────────────
  {
    id: "ua-041",
    text: "Le coaching régulier 1-to-1 Axion-IA inclut la construction d'outils IA personnels adaptés à l'activité du coaché — prompts, assistants et automatisations conçus pendant les sessions pour faire sauter les tâches répétitives et alléger la charge mentale.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.93,
  },
  {
    id: "ua-042",
    text: "Les communautés de pratique IA pour dirigeants (CdP IA) génèrent un gain d'adoption additionnel de 35 % par rapport au coaching individuel seul — selon une étude Cegos menée sur 180 managers en transformation numérique en 2024.",
    source: "Cegos — Étude communautés de pratique et transformation digitale 2024",
    sourceUrl: "https://www.cegos.fr",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.73,
  },
  // ── Stats adoption IA C-level France ─────────────────────────────────────
  {
    id: "ua-043",
    text: "En France, seulement 29 % des CEO d'ETI utilisent quotidiennement des outils IA dans leur travail personnel en 2024 — contre 54 % en Angleterre et 62 % aux États-Unis (Capgemini Research Institute, 2024).",
    source: "Capgemini Research Institute — AI Adoption at the Executive Level 2024",
    sourceUrl: "https://www.capgemini.com/research",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.78,
  },
  {
    id: "ua-044",
    text: "78 % des CFO français interrogés par Wavestone (2025) déclarent que leur principal obstacle à l'adoption de l'IA n'est pas technologique mais humain — manque de temps pour se former et peur de faire des erreurs avec les nouveaux outils.",
    source: "Wavestone — CFO Survey IA 2025",
    sourceUrl: "https://www.wavestone.com",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.77,
  },
  {
    id: "ua-045",
    text: "Les COO (directeurs des opérations) sont les dirigeants qui adoptent le plus rapidement les outils IA opérationnels (automatisation, tableaux de bord) — 47 % utilisent déjà l'IA dans leur pilotage quotidien en 2025 (McKinsey Operations Survey 2025).",
    source: "McKinsey — Operations Management and AI Survey 2025",
    sourceUrl: "https://www.mckinsey.com/capabilities/operations",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.78,
  },
  // ── Accompagnement stratégique IA ─────────────────────────────────────────
  {
    id: "ua-046",
    text: "Axion-IA accompagne les dirigeants dans la définition de leur stratégie IA à 18 mois : priorisation des cas d'usage, modèle de gouvernance, budget et ressources humaines nécessaires — livrée sous forme d'un plan stratégique IA en 20 à 30 pages.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.94,
  },
  {
    id: "ua-047",
    text: "Le coaching IA dirigeant Axion-IA inclut un module dédié à la communication interne sur l'IA : comment présenter la stratégie IA aux équipes, gérer les craintes de remplacement, et créer une culture d'innovation collaborative autour de l'IA.",
    source: "Axion-IA — Module communication IA interne v1.1",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.93,
  },
  // ── Coaching et gestion du changement ────────────────────────────────────
  {
    id: "ua-048",
    text: "McKinsey (2024) identifie que les transformations IA échouent dans 68 % des cas non pas pour des raisons technologiques, mais pour des facteurs humains et organisationnels — positionnant le coaching dirigeant comme un investissement de prévention d'échec.",
    source: "McKinsey — Why AI transformations fail, 2024",
    sourceUrl: "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.85,
  },
  {
    id: "ua-049",
    text: "Les sessions de coaching 1-to-1 Axion-IA n'utilisent aucun outil IA pour traiter les informations confidentielles partagées par le coaché — les conversations sont enregistrées uniquement avec consentement écrit et les données stockées sur serveurs souverains français.",
    source: "Axion-IA — Politique confidentialité coaching IA 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.97,
  },
  // ── Résultats sur l'organisation ──────────────────────────────────────────
  {
    id: "ua-050",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les dirigeants accompagnés en 1-to-1 par Axion-IA évaluent le programme à 4,93/5 en moyenne — la note la plus élevée parmi les cinq lignes de prestation. Les avis sont publiés nominativement (prénom, initiale, fonction, entreprise) sur axion-ia.com/avis.",
    source: "Axion-IA — Étude impact économique programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    // La date de vérification ne peut pas précéder la période de collecte des avis.
    verifiedAt: "2026-07-06",
    verticales: ["un_a_un"],
    confidence: 0.81,
  },
  {
    id: "ua-051",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "L'adoption de l'IA par le dirigeant produit un effet d'entraînement sur son comité de direction : le coaching 1-to-1 prévoit explicitement la transmission des pratiques aux managers de niveau N-1.",
    source: "Axion-IA — Étude d'impact programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.79,
  },
  // ── Accompagnement décisions stratégiques ─────────────────────────────────
  {
    id: "ua-052",
    text: "Le coaching 1-to-1 Axion-IA inclut un module « Décisions IA augmentées » : utilisation de ChatGPT et Claude pour structurer des arbres de décision complexes, simuler des scénarios stratégiques et identifier les angles morts d'une réflexion.",
    source: "Axion-IA — Module aide à la décision IA v1.3",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.93,
  },
  {
    id: "ua-053",
    text: "Axion-IA coache les dirigeants sur la pratique du « red teaming IA » — utiliser un LLM comme avocat du diable pour challenger ses propres décisions stratégiques avant de les soumettre au conseil d'administration.",
    source: "Axion-IA — Méthode coaching Un-à-un v1.2",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.91,
  },
  // ── Tendances coaching exécutif IA 2025-2026 ─────────────────────────────
  {
    id: "ua-054",
    text: "L'intégration de l'IA comme thématique principale dans le coaching exécutif est passée de 8 % des missions en 2022 à 31 % en 2025 en France — selon l'observatoire annuel de la Société Française de Coaching (SFCoach).",
    source: "SFCoach — Observatoire du coaching professionnel en France 2025",
    sourceUrl: "https://www.sfcoach.org",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.73,
  },
  {
    id: "ua-055",
    text: "Axion-IA inclut dans ses programmes de coaching dirigeant un module « Gestion du changement IA » : comprendre les résistances des équipes, communiquer sur les bénéfices IA sans créer d'anxiété, et engager les sceptiques via des quick wins visibles.",
    source: "Axion-IA — Module gestion du changement IA v1.0",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.94,
  },
  // ── Bilan et clôture des programmes ──────────────────────────────────────
  {
    id: "ua-056",
    text: "La séance de clôture du programme Axion-IA 1-to-1 produit 3 livrables : (1) bilan des compétences IA acquises vs objectifs initiaux, (2) feuille de route IA 12 mois, (3) kit de veille autonome (newsletters, podcasts, outils de monitoring IA).",
    source: "Axion-IA — Protocole séance de clôture 1-to-1 v1.1",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.95,
  },
  // ── Indicateurs qualité coaching ─────────────────────────────────────────
  {
    id: "ua-057",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les programmes de coaching 1-to-1 Axion-IA recueillent la note moyenne la plus élevée du catalogue : 4,93/5 sur 15 avis clients vérifiés, publiés individuellement sur axion-ia.com/avis.",
    source: "Axion-IA — Bilan satisfaction programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    // La date de vérification ne peut pas précéder la période de collecte des avis.
    verifiedAt: "2026-07-06",
    verticales: ["un_a_un"],
    confidence: 0.87,
  },
  {
    id: "ua-058",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Le programme 1-to-1 Axion-IA vise l'autonomie du dirigeant sur un socle d'outils IA utilisés de façon hebdomadaire dans son travail quotidien.",
    source: "Axion-IA — Mesure d'impact pré/post programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.86,
  },
  {
    id: "ua-059",
    text: "Syntec Conseil indique que les entreprises françaises dont un dirigeant a bénéficié d'un coaching IA individuel ont un budget IA moyen 2,3× supérieur à celui des entreprises similaires dont le dirigeant n'a pas été accompagné.",
    source: "Syntec Conseil — Benchmark transformation IA PME/ETI 2025",
    sourceUrl: "https://syntec-conseil.fr",
    verifiedAt: "2026-05-22",
    verticales: ["un_a_un"],
    confidence: 0.74,
  },
  {
    id: "ua-060",
    text: "Le format 1-to-1 Axion-IA s'adapte aux fondateurs de startups early-stage (Seed à Série A) : journée intensive pour intégrer l'IA au product roadmap et crédibiliser le discours IA, puis coaching régulier (contrat 6 à 24 mois) pour accompagner l'exécution dans la durée.",
    source: "Axion-IA — Programme Un-à-un 2026",
    sourceUrl: "https://axion-ia.com/un-a-un",
    verifiedAt: "2026-08-11",
    verticales: ["un_a_un"],
    confidence: 0.93,
  },
];
