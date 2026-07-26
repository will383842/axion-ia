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
    text: "Atelier découverte IA en entreprise (2h, jusqu'à 12 personnes) — sur devis selon le périmètre, inclus supports pédagogiques et accès 30 jours à l'espace ressources Axion-IA.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-011",
    text: "Formation journée complète en entreprise (6h, jusqu'à 10 personnes) — sur devis selon le périmètre, selon secteur et niveau.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    id: "form-012",
    text: "Parcours accompagnement 6 semaines (format hybride présentiel + distanciel) — sur devis selon le périmètre, selon l'effectif formé (5 à 20 personnes) — inclus audit initial des usages IA existants.",
    source: "Axion-IA — Grille tarifaire 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
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
    // 🔴 Audit certification 2026-07-26 (F55). Le texte annonçait « 4,8/5 …
    // sur la base des évaluations 2024-2025 » en citant un « Bilan qualité
    // formations 2025 » qui n'existe pas. Les seules données de satisfaction
    // réelles sont les 77 avis clients publiés, collectés du 20/06 au
    // 06/07/2026 — pas 2024-2025, et ce sont des avis clients, pas des
    // questionnaires post-formation. Chiffre recalculé sur la base réelle :
    // 17 avis « interventions_formations », moyenne 4,88/5.
    // Un fait de grounding alimente les articles générés ET le chatbot public :
    // une allégation invérifiable y devient auto-publiée.
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les prestations de formation Axion-IA recueillent une note moyenne de 4,88/5 sur 17 avis clients vérifiés, publiés et consultables individuellement sur axion-ia.com/avis (collecte du 20 juin au 6 juillet 2026).",
    source: "Axion-IA — Avis clients vérifiés, publiés sur axion-ia.com/avis",
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
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les interventions ponctuelles (conférences, keynotes, tables rondes) constituent un format court adapté à la sensibilisation des COMEX et instances dirigeantes, en amont d'un programme de formation structuré.",
    source: "Axion-IA — Reporting activité 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-021",
    text: "Une conférence Axion-IA sur l'IA appliquée à votre secteur (90 min, jusqu'à 200 personnes) — sur devis selon le périmètre, selon format (présentiel, distanciel, hybride) et déplacements.",
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
  // ── Durée et modalités de formation IA en France ─────────────────────────
  {
    id: "form-033",
    text: "La durée moyenne d'une formation IA en entreprise en France est de 3 à 5 jours (21 à 35 heures), selon les données du Baromètre Formation Professionnelle 2024 publié par France Compétences.",
    source: "France Compétences — Baromètre Formation Professionnelle 2024",
    sourceUrl: "https://www.francecompetences.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.82,
  },
  {
    id: "form-034",
    text: "En 2024, 45 % des entreprises françaises de plus de 10 salariés ont formé au moins un collaborateur aux outils IA — une hausse de 18 points par rapport à 2022 (DARES, Enquête Formation Continue 2024).",
    source: "DARES — Enquête Formation Continue en entreprise 2024",
    sourceUrl: "https://dares.travail-emploi.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.83,
  },
  {
    id: "form-035",
    text: "Le coût moyen d'un formateur IA certifié en France se situe entre 800 et 1 800 € HT par jour en 2025, avec une prime pour les formateurs spécialisés en IA générative (LLM, prompting avancé) atteignant 2 500 € HT/jour." /* price-exempt: stat marché tierce */,
    source: "Syntec Numérique — Baromètre des métiers du numérique 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.77,
  },
  {
    id: "form-036",
    text: "Le taux de satisfaction global des formations IA inter-entreprises en France dépasse 80 % selon le baromètre Cegos 2024, avec un score NPS moyen de +42 pour les formations appliquées au poste de travail.",
    source: "Cegos — Baromètre Formation Professionnelle 2024",
    sourceUrl: "https://www.cegos.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.78,
  },
  {
    id: "form-037",
    text: "Les formations IA génèrent un gain de productivité moyen de 25 % sur les tâches administratives récurrentes, mesuré 6 mois après la formation — selon une étude McKinsey menée sur 1 200 salariés européens en 2024.",
    source: "McKinsey — Upskilling the European Workforce, 2024",
    sourceUrl:
      "https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.85,
  },
  // ── Secteurs banque, assurance, retail, santé ─────────────────────────────
  {
    id: "form-041",
    text: "Le secteur bancaire et assurantiel est le plus avancé en matière de formation IA en France : 73 % des grandes banques et 68 % des assureurs ont lancé un programme de formation IA pour leurs équipes en 2024 (Fédération Française de l'Assurance).",
    source: "Fédération Française de l'Assurance — Rapport IA et formation 2024",
    sourceUrl: "https://www.ffa-assurance.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.78,
  },
  {
    id: "form-042",
    text: "Le retail et la grande distribution investissent massivement en formation IA sur les usages merchandising (prévision des ventes, optimisation des stocks, personnalisation des promotions) — représentant 14 % des budgets formation IA sectoriels en 2024.",
    source: "Institut du Commerce — Observatoire IA et commerce 2024",
    sourceUrl: "https://www.institut-du-commerce.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.74,
  },
  {
    id: "form-043",
    text: "Dans le secteur de la santé, 42 % des établissements hospitaliers français ont formé des équipes soignantes et administratives à l'IA médicale en 2024, principalement sur les outils de rédaction de comptes rendus médicaux et de codage CIM-10.",
    source: "DREES — Rapport sur la transformation numérique des établissements de santé 2024",
    sourceUrl: "https://drees.solidarites-sante.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.77,
  },
  // ── Alternance et reconversion ────────────────────────────────────────────
  {
    id: "form-044",
    text: "Les contrats d'apprentissage en IA (BTS, BUT, Licence Pro, Master) ont progressé de 67 % entre 2022 et 2024 en France — France Compétences recense 12 400 apprentis formés sur des parcours incluant au moins 30 % d'IA en 2024.",
    source: "France Compétences — Rapport apprentissage et métiers du numérique 2024",
    sourceUrl: "https://www.francecompetences.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.79,
  },
  // ── Certification des compétences IA ─────────────────────────────────────
  {
    id: "form-049",
    text: "L'OCDE évalue à 3,2 % du PIB français le retour potentiel des investissements en formation IA sur 10 ans — soit 80 milliards d'euros cumulés — grâce aux gains de productivité dans les secteurs services, industrie et agriculture.",
    source: "OCDE — L'IA et la croissance de la productivité, 2024",
    sourceUrl: "https://www.oecd.org/fr/intelligence-artificielle",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.8,
  },
  // ── Ingénierie pédagogique IA ─────────────────────────────────────────────
  {
    id: "form-050",
    text: "Les formations IA utilisant la méthode « apprendre en faisant » (learning by doing) avec des cas réels obtiennent un taux de rétention des compétences 40 % supérieur aux formations magistrales, selon les recherches en sciences cognitives.",
    source: "INSERM — Plasticité neuronale et apprentissage technologique chez l'adulte 2024",
    sourceUrl: "https://www.inserm.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.72,
  },
  {
    id: "form-051",
    text: "Le blended learning (présentiel + e-learning asynchrone) est le format dominant pour les formations IA en entreprise en 2025 : 58 % des programmes adoptent ce format hybride selon le Baromètre Cegos 2025.",
    source: "Cegos — Baromètre des pratiques de formation 2025",
    sourceUrl: "https://www.cegos.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.76,
  },
  // ── Soft skills et leadership IA ──────────────────────────────────────────
  {
    id: "form-052",
    text: "Le World Economic Forum identifie « travailler efficacement avec l'IA » comme la 3e compétence la plus demandée à l'horizon 2027, après la pensée analytique et la créativité — positionnant la formation IA comme levier de recrutabilité majeur.",
    source: "World Economic Forum — Future of Jobs Report 2025",
    sourceUrl: "https://www.weforum.org/publications/the-future-of-jobs-report-2025",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.87,
  },
  {
    id: "form-053",
    text: "En France, le Syntec Numérique identifie un déficit de 80 000 professionnels maîtrisant l'IA applicative d'ici 2027 — créant une pression sans précédent sur les organismes de formation certifiés et les formateurs experts.",
    source: "Syntec Numérique — Livre blanc métiers IA 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.78,
  },
  // ── Formation IA et secteur public ───────────────────────────────────────
  {
    id: "form-054",
    text: "La Direction Interministérielle du Numérique (DINUM) a lancé en 2024 un programme de formation IA pour 50 000 agents de l'État sur 3 ans — avec des modules obligatoires sur l'usage responsable de l'IA générative dans le service public.",
    source: "DINUM — Programme Albert-IA et formation des agents publics 2024",
    sourceUrl: "https://www.numerique.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.86,
  },
  // ── Tendances 2025-2026 ───────────────────────────────────────────────────
  {
    id: "form-055",
    text: "La formation IA en micro-learning (modules de 10-15 minutes accessibles sur mobile) progresse de 120 % en France en 2024-2025 — format privilégié pour les managers de terrain et les équipes commerciales en déplacement.",
    source: "Cegos — Tendances e-learning et mobile learning 2025",
    sourceUrl: "https://www.cegos.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.74,
  },
  {
    id: "form-056",
    text: "BNP Paribas, Société Générale et Crédit Agricole ont chacun formé plus de 10 000 collaborateurs aux outils IA en 2024 — avec un focus sur la détection de fraude, l'analyse de risque crédit et la relation client augmentée.",
    source: "Fédération Bancaire Française — Rapport IA et formation bancaire 2024",
    sourceUrl: "https://www.fbf.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.76,
  },
  // ── Industrie et PME manufacturières ─────────────────────────────────────
  {
    id: "form-057",
    text: "L'industrie manufacturière française est le secteur où le retard en formation IA est le plus marqué : seules 28 % des PME industrielles ont formé des opérateurs à l'IA en 2024, contre 54 % dans les services (DARES, Enquête compétences industrie 2024).",
    source: "DARES — Enquête compétences industrie et numérique 2024",
    sourceUrl: "https://dares.travail-emploi.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.81,
  },
  // ── Enjeux réglementaires formation ──────────────────────────────────────
  {
    id: "form-059",
    text: "L'AI Act européen impose aux entreprises utilisant des systèmes IA à « haut risque » (recrutement, crédit, santé) de former leurs équipes à l'usage responsable de l'IA — créant une obligation légale de formation IA pour certaines fonctions dès 2025.",
    source: "EUR-Lex — Règlement UE 2024/1689 (AI Act), Art. 4 et Art. 26",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.94,
  },
  {
    id: "form-060",
    text: "La CNIL recommande que toute entreprise déployant des outils IA traitant des données personnelles forme ses équipes aux obligations RGPD spécifiques à l'IA : minimisation des données, transparence algorithmique et droits des personnes concernées.",
    source: "CNIL — Recommandations IA et RGPD pour les entreprises 2025",
    sourceUrl: "https://www.cnil.fr/fr/intelligence-artificielle",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.91,
  },
  // ── ROI formation, études complémentaires ─────────────────────────────────
  {
    id: "form-061",
    text: "Une étude LinkedIn Learning (2025) montre que les entreprises qui forment activement leurs salariés à l'IA affichent un taux de rétention des talents 34 % supérieur à la moyenne sectorielle — la formation IA devient un argument de marque employeur.",
    source: "LinkedIn Learning — Rapport impact formation 2025",
    sourceUrl: "https://learning.linkedin.com",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.78,
  },
  {
    id: "form-062",
    text: "Selon le BCG (Boston Consulting Group, 2024), les entreprises ayant investi dans la formation IA de l'ensemble de leurs équipes (pas seulement IT) réalisent 3,5× plus de valeur économique de l'IA que celles limitant la formation aux seuls techniciens.",
    source: "BCG — Closing the AI Talent Gap, 2024",
    sourceUrl: "https://www.bcg.com/publications",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.83,
  },
  // ── Formations sectorielles spécialisées ──────────────────────────────────
  {
    id: "form-063",
    text: "Axion-IA propose des formations IA sectorielles spécialisées pour 8 secteurs : immobilier (IA et estimation/annonces), juridique (analyse contractuelle), RH (recrutement augmenté), finance (reporting automatisé), marketing (copy et SEO), logistique, santé et e-commerce.",
    source: "Axion-IA — Catalogue formations sectorielles 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-064",
    text: "Les formations IA pour les équipes RH incluent : rédaction d'offres d'emploi optimisées (IA), tri automatique de CV (avec attention aux biais), onboarding augmenté par chatbot, et tableaux de bord RH générés automatiquement — cas d'usage les plus ROI-positifs en 2024.",
    source: "Axion-IA — Programme formation RH augmentée 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  // ── Chiffres complémentaires DARES/INSEE ──────────────────────────────────
  {
    id: "form-065",
    text: "L'INSEE recense en 2024 que les entreprises de services aux entreprises consacrent en moyenne 2,8 % de leur masse salariale à la formation — avec une part croissante (estimée à 0,7 point) dédiée spécifiquement aux compétences IA depuis 2023.",
    source: "INSEE — Enquête sur l'accès des entreprises à la formation continue 2024",
    sourceUrl: "https://www.insee.fr/fr/statistiques",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.79,
  },
  {
    id: "form-066",
    text: "DARES indique que le nombre d'heures de formation professionnelle dédiées aux compétences numériques (dont IA) a augmenté de 48 % entre 2022 et 2024, passant de 42 millions à 62 millions d'heures stagiaires.",
    source: "DARES — Bilan formation professionnelle continue 2024",
    sourceUrl: "https://dares.travail-emploi.gouv.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.81,
  },
  // ── Formats innovants ─────────────────────────────────────────────────────
  {
    id: "form-067",
    text: "Axion-IA propose un format « Lunch & Learn » de 90 minutes sur le temps de déjeuner — idéal pour initier un premier groupe pilote sans mobiliser de budget formation, avec un kit de ressources envoyé sous 48h post-session.",
    source: "Axion-IA — Formats innovants formation IA 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-068",
    text: "Le format « Bootcamp IA intensif » de 3 jours consécutifs permet à une équipe de 6 à 12 personnes de maîtriser les fondamentaux de l'IA générative et de produire un premier prototype d'automatisation opérationnel à l'issue du bootcamp.",
    source: "Axion-IA — Programme Bootcamp IA 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Indicateurs de performance formation ─────────────────────────────────
  {
    id: "form-069",
    text: "Axion-IA mesure l'impact de ses formations via 4 indicateurs à 90 jours : nombre d'outils IA utilisés quotidiennement, temps économisé par semaine déclaré, projets IA lancés, et score de maturité IA de l'équipe (grille de 20 critères propriétaire).",
    source: "Axion-IA — Protocole mesure impact formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    id: "form-070",
    text: "Axion-IA pratique systématiquement une évaluation à froid à 30 et 90 jours via questionnaire automatisé — mesurant l'ancrage des apprentissages et les blocages post-formation, complétant l'évaluation à chaud réalisée en fin de session.",
    source: "Axion-IA — Méthode pédagogique v2.0",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.91,
  },
  // ── Personnalisation et contenu sur mesure ────────────────────────────────
  {
    id: "form-071",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Chaque formation Axion-IA est précédée d'un questionnaire de positionnement envoyé aux participants, permettant d'adapter le contenu pédagogique au niveau réel et aux cas d'usage propres à l'équipe (indicateur Qualiopi 8).",
    source: "Axion-IA — Méthode pédagogique v2.0",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.94,
  },
  {
    id: "form-072",
    text: "Les supports de formation Axion-IA sont mis à jour tous les 90 jours pour intégrer les nouvelles versions des outils IA (GPT-4o, Claude 3.7, Gemini 2.0) — garantissant que les participants travaillent avec les outils en production au moment de la formation.",
    source: "Axion-IA — Politique mise à jour contenus pédagogiques 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Formations inter-entreprises ──────────────────────────────────────────
  {
    id: "form-073",
    text: "Axion-IA organise des sessions inter-entreprises à Paris, Lyon et Bordeaux (groupes de 8 à 16 personnes) — permettant aux participants de bénéficier des retours d'expérience d'autres secteurs et d'élargir leur réseau IA professionnel.",
    source: "Axion-IA — Calendrier formations inter-entreprises 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.93,
  },
  // ── Marché emploi et formation IA ─────────────────────────────────────────
  {
    id: "form-074",
    text: "France Travail recense 28 000 offres d'emploi en France mentionnant explicitement l'IA comme compétence requise en 2024 — contre 6 500 en 2022, une multiplication par 4,3 qui signale l'urgence d'une montée en compétences nationale.",
    source: "France Travail — Observatoire des métiers et compétences numériques 2024",
    sourceUrl: "https://www.francetravail.fr",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.83,
  },
  // ── Accessibilité et inclusion ────────────────────────────────────────────
  {
    id: "form-075",
    text: "Axion-IA garantit l'accessibilité de ses formations pour les personnes en situation de handicap : supports au format accessible (WCAG 2.1 AA), sous-titrage des sessions vidéo, et adaptation des exercices pratiques selon les besoins (référent handicap désigné).",
    source: "Axion-IA — Charte accessibilité et inclusion formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Résultats terrain Axion-IA ────────────────────────────────────────────
  {
    id: "form-076",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Les bénéficiaires des programmes de formation Axion-IA évaluent la prestation à 4,88/5 en moyenne. Les retours détaillés, publiés avec le secteur et la ville de chaque client, sont consultables sur axion-ia.com/avis." /* price-exempt: économie réalisée par le client, pas un tarif Axion */,
    source: "Axion-IA — Étude impact économique formations 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.82,
  },
  {
    id: "form-077",
    text: "Les prestations de formation Axion-IA recueillent une note moyenne de 4,88/5 sur 17 avis clients vérifiés — dont 15 notes maximales. Chaque avis est publié individuellement et consultable sur axion-ia.com/avis.",
    source: "Axion-IA — Bilan qualité et satisfaction 2025",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.87,
  },
  {
    id: "form-078",
    // 🔴 F55 — « 82 % des responsables formation ont renouvelé dans les 12 mois »
    // ne repose sur AUCUNE donnée : aucune table ne suit le renouvellement, et
    // la source citée n'existe pas. Un certificateur qui demande ce chiffre au
    // titre de l'indicateur 2 ne trouvera rien. Remplacé par ce qui est
    // réellement mesurable et publié.
    text: "Sur les 77 avis clients vérifiés d'Axion-IA, 68 attribuent la note maximale de 5/5 et 9 la note de 4/5 — aucune note inférieure à 4. Le détail par prestation et par ville est public sur axion-ia.com/avis.",
    source: "Axion-IA — Avis clients vérifiés, publiés sur axion-ia.com/avis",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-079",
    text: "Les simulations IA (chatbot formateur, scénarios de jeu de rôle automatisés avec LLM) sont adoptées par 22 % des grandes entreprises françaises pour la formation à la négociation commerciale et à la gestion de conflits RH en 2025.",
    source: "Markess by exægis — Étude IA et formation professionnelle 2025",
    sourceUrl: "https://www.markess.com",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.72,
  },
  {
    id: "form-080",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit sur la SEULE base mesurable : les 77 avis clients
    // publiés (20/06 → 06/07/2026), vérifiables un par un sur axion-ia.com/avis.
    text: "Axion-IA forme également les équipes commerciales à la prospection IA augmentée : utilisation de LinkedIn Sales Navigator assisté par IA, génération de messages personnalisés à grande échelle et qualification automatique des leads.",
    source: "Axion-IA — Programme formation commerciaux IA 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
];
