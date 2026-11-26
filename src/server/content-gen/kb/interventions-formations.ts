/**
 * KB sectorielle — Verticale Interventions & Formations IA (P6 2026-05-22).
 *
 * Fiches sourcées (70 à l'origine) sur la formation IA en entreprise France.
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

import { DELAI_RAPPORT_JOURS_OUVRES } from "@/content/journee-ia-commun";
import { DELAI_ACCES_PHRASE } from "@/content/formations/delai-acces";
import type { KbFact } from "./audits";
export type { KbFact };

export const KB_INTERVENTIONS_FORMATIONS: readonly KbFact[] = [
  // ── Formats de formation ────────────────────────────────────────────────
  {
    id: "form-001",
    text: "Axion-IA propose un format demi-journée (4 h) pour initier les équipes aux outils IA — conçu pour s'intégrer dans une demi-journée de travail sans immobiliser l'équipe, en intra-entreprise (2 à 15 participants).",
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
    text: "L'accompagnement Axion-IA dans la durée combine une formation intensive (1 à 3 jours) puis le coaching 1-to-1 régulier — structuré en 3 phases : découverte, expérimentation, intégration opérationnelle.",
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
  // ── Publics cibles ───────────────────────────────────────────────────────
  {
    id: "form-006",
    text: "Formations Axion-IA adaptées à 5 profils : dirigeants de PME (décision stratégique), managers (pilotage équipe IA), marketing (génération de contenu), commerciaux (prospection IA) et RH (recrutement + administration).",
    source: "Axion-IA — Catalogue formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── ROI mesurable ────────────────────────────────────────────────────────
  {
    id: "form-008",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "Les formations Axion-IA ciblent en priorité les tâches où le gain de temps est le plus direct : rédaction, résumé de documents et préparation de réunions. Le gain réel dépend du poste et de la régularité de la pratique — il est mesuré avec le client, pas promis à l'avance.",
    source: "Axion-IA — Retours participants formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.87,
  },
  // ── Tarifs indicatifs ────────────────────────────────────────────────────
  {
    id: "form-010",
    // R7 (08/11/2026) : plus aucun prix public hors Journée IA — sur devis.
    text: "Formation découverte IA en entreprise (demi-journée de 4 h, groupe de 2 à 15 personnes) — sur devis, supports pédagogiques inclus.",
    source: "Axion-IA — Catalogue des offres 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-011",
    text: "Formation journée complète en entreprise (1 journée, groupe de 2 à 15 personnes) — sur devis selon la catégorie (offre générale, par métier ou par secteur d'activité) ; parlons-en lors du rendez-vous gratuit de 45 minutes.",
    source: "Axion-IA — Catalogue des offres 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  // ── Marché de la formation IA en France ─────────────────────────────────
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
  // ── Secteurs cibles ──────────────────────────────────────────────────────
  // ── Interventions ponctuelles ────────────────────────────────────────────
  {
    id: "form-020",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
    text: "Les interventions ponctuelles (conférences, keynotes, tables rondes) constituent un format court adapté à la sensibilisation des COMEX et instances dirigeantes, en amont d'un programme de formation structuré.",
    source: "Axion-IA — Reporting activité 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
  {
    id: "form-021",
    text: "Une conférence Axion-IA sur l'IA appliquée à votre secteur (format plénière sur 1 journée, grands effectifs — séminaires, kick-off annuels) — sur devis selon le périmètre, le format (présentiel, distanciel, hybride) et les déplacements.",
    source: "Axion-IA — Catalogue des offres 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-01",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    // R7 (08/11/2026) : l'offre mise en avant, seul prix public. Texte repris de la
    // page /journee-ia (`src/app/[locale]/journee-ia/contenu.ts`), sans la garantie.
    id: "form-081",
    text: `La Journée IA d'Axion-IA, pour les TPE et PME : une journée dans vos locaux, partout en France. Le matin, nous regardons service par service ce qui prend du temps et nous le chiffrons avec vos heures ; l'après-midi, pendant 4 heures de formation, vos équipes apprennent sur leurs vrais dossiers ce qu'on confie à l'IA et ce qu'on garde. Vos 3 à 5 priorités sont écrites dans le rapport détaillé (vos gains chiffrés et les tâches à automatiser, classées par rentabilité), remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés avec un plan d'action sur 90 jours, et chaque personne formée repart avec une attestation. {{price:journee-ia|flat}} la journée, dans vos locaux. On commence, si vous le souhaitez, par un Diagnostic IA gratuit et facultatif de 45 minutes, en visio ou par téléphone, sans engagement.`,
    source: "Axion-IA — La Journée IA",
    sourceUrl: "https://axion-ia.com/fr/journee-ia",
    verifiedAt: "2026-11-18",
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
  // ── Effets organisationnels ───────────────────────────────────────────────
  {
    id: "form-027",
    // 🔴 Vérification E2E 2026-07-26 (F55, 2e passage). Le premier passage avait
    // laissé cette auto-déclaration chiffrée, de la même classe que les 17
    // réécrites : un résultat annoncé sans mesure ni source tierce. Ces faits
    // alimentent le grounding des articles générés ET le chatbot public —
    // l'allégation y devient auto-publiée. Reformulé sur ce qui est réellement
    // vérifiable : la méthode, pas un résultat inventé.
    text: "L'ancrage d'une formation IA dans les pratiques quotidiennes dépend fortement de la désignation d'un « champion IA » interne : sans relais identifié, les acquis retombent. Axion-IA fait donc de cette désignation un point de la restitution de fin de formation.",
    source: "Axion-IA — Bilan qualité formations 2026",
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
    id: "form-030",
    text: "Axion-IA forme également les dirigeants à la gouvernance IA : définition d'une politique d'utilisation acceptable, gestion des risques de biais et traçabilité des décisions aidées par l'IA.",
    source: "Axion-IA — Programme dirigeants IA v1.3",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-11-08",
    verticales: ["interventions_formations"],
    confidence: 0.92,
  },
  {
    id: "form-031",
    // 🔴 2026-09-30 (audit ind. 2) : « délai MOYEN de 10 à 15 jours ouvrés »
    // présentait comme une moyenne un chiffre que rien ne mesure.
    // 🔴 2026-10-02 : le « au moins 11 jours ouvrés » qui l'avait remplacé
    // n'avait pas plus de fondement. Règle du dirigeant, lue dans la source
    // unique `src/content/formations/delai-acces.ts`.
    // ⚠️ Ce fait vit AUSSI en base (`KbEntry`, upsert par
    // `prisma/seeds/content-gen/seed-kb-facts.ts`) : l'ancienne phrase y reste
    // tant que le seed n'a pas été relancé.
    text: `${DELAI_ACCES_PHRASE} La date est convenue avec l'entreprise lors de l'appel de cadrage des besoins, gratuit et sans engagement.`,
    source: "Axion-IA — Délai d'accès publié sur les fiches formation",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-10-02",
    verticales: ["interventions_formations"],
    confidence: 0.9,
  },
  {
    id: "form-032",
    text: "Axion-IA intervient partout en France, en visio et sur site.",
    source: "Axion-IA — Zones d'intervention 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-10-24",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Durée et modalités de formation IA en France ─────────────────────────
  // ── Secteurs banque, assurance, retail, santé ─────────────────────────────
  // ── Alternance et reconversion ────────────────────────────────────────────
  // ── Certification des compétences IA ─────────────────────────────────────
  // ── Ingénierie pédagogique IA ─────────────────────────────────────────────
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
  // ── Formation IA et secteur public ───────────────────────────────────────
  // ── Tendances 2025-2026 ───────────────────────────────────────────────────
  // ── Industrie et PME manufacturières ─────────────────────────────────────
  // ── Enjeux réglementaires formation ──────────────────────────────────────
  {
    id: "form-059",
    text: "Selon l'AI Act (art. 4), les entreprises qui utilisent des systèmes d'IA prennent des mesures pour la maîtrise de l'IA (« AI literacy ») de leur personnel, tous systèmes confondus et pas seulement ceux à haut risque. L'article s'applique depuis le 2 février 2025. Le règlement (UE) 2026/1744 (omnibus IA, en vigueur le 27 juillet 2026) l'a réécrit dans un sens plus souple : favoriser cette maîtrise, sans devoir garantir un niveau précis à chaque personne. Assoupli, il n'est ni supprimé ni reporté. Libellé exact : à vérifier sur EUR-Lex.",
    source:
      "EUR-Lex — Règlement (UE) 2024/1689 (AI Act), art. 4, modifié par le règlement (UE) 2026/1744 (omnibus IA)",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
    verifiedAt: "2026-11-08",
    verticales: ["interventions_formations"],
    confidence: 0.8,
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
  // ── Formats innovants ─────────────────────────────────────────────────────
  {
    id: "form-067",
    text: "Le format demi-journée (4 h) Axion-IA est idéal pour initier un premier groupe pilote sans mobiliser un budget formation complet — supports pédagogiques remis aux participants à l'issue de la session.",
    source: "Axion-IA — Formats innovants formation IA 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  {
    id: "form-068",
    text: "Le format « Bootcamp IA intensif » de 3 jours consécutifs permet à une équipe de 2 à 15 personnes de maîtriser les fondamentaux de l'IA générative et de produire un premier prototype d'automatisation opérationnel à l'issue du bootcamp.",
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
  // ── Personnalisation et contenu sur mesure ────────────────────────────────
  {
    id: "form-071",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
    text: "Chaque formation Axion-IA est précédée d'un questionnaire de positionnement envoyé aux participants, permettant d'adapter le contenu pédagogique au niveau réel et aux cas d'usage propres à l'équipe.",
    source: "Axion-IA — Méthode pédagogique v2.0",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.94,
  },
  {
    id: "form-072",
    text: "Les supports de formation Axion-IA sont mis à jour tous les 90 jours pour intégrer les modèles de dernière génération des principaux fournisseurs (OpenAI, Anthropic, Google) — garantissant que les participants travaillent avec les outils en production au moment de la formation.",
    source: "Axion-IA — Politique mise à jour contenus pédagogiques 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-08-11",
    verticales: ["interventions_formations"],
    confidence: 0.95,
  },
  // ── Modalité intra-entreprise ─────────────────────────────────────────────
  {
    id: "form-073",
    text: "Les formations Axion-IA sont dispensées en intra-entreprise, sur site partout en France ou à distance — le programme est calibré sur le secteur et les cas réels de l'entreprise, plutôt que sur des sessions inter-entreprises génériques.",
    source: "Axion-IA — Modalités formations 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.93,
  },
  // ── Marché emploi et formation IA ─────────────────────────────────────────
  // ── Accessibilité et inclusion ────────────────────────────────────────────
  {
    id: "form-075",
    // 🔴 Audit certification 2026-07-26 (X5). Ce fait alimente la KB/RAG du
    // content-gen : il ressort en clair dans des pages publiques GÉNÉRÉES, et il
    // porte sur les SUPPORTS DE FORMATION — terrain direct de l'audit Qualiopi,
    // pas le site web. Il revendiquait une conformité des supports et un
    // sous-titrage vidéo qu'aucun élément du dépôt n'étaye. Une revendication de
    // conformité non étayée n'est pas un argument commercial, c'est un écart.
    // La source citée (« Charte … 2026 ») n'existe nulle part dans le dépôt :
    // une seule occurrence, la chaîne elle-même. Elle est remplacée par ce qui
    // est réellement vérifiable — le référent désigné dans le registry (ind. 26).
    // On ne mentionne AUCUN partenariat réseau : la table `partenariats` est vide
    // en production, et l'annoncer serait rejouer la sur-déclaration corrigée ici.
    text: "Axion-IA désigne un référent handicap, joignable avant l'entrée en formation. Chaque situation est étudiée au cas par cas : le référent convient avec le bénéficiaire des adaptations possibles (supports, rythme, modalités, exercices pratiques) et l'oriente vers les acteurs spécialisés lorsque le besoin dépasse ces adaptations.",
    source: "Axion-IA — Référent handicap désigné (RNQ indicateur 26)",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-07-26",
    verticales: ["interventions_formations"],
    confidence: 0.8,
  },
  // ── Résultats terrain Axion-IA ────────────────────────────────────────────
  {
    id: "form-080",
    // 🔴 Audit certification 2026-07-26 (F55). Auto-déclaration de résultat non
    // adossée : ni source vérifiable, ni donnée en base. Ces faits alimentent le
    // grounding des articles générés ET le chatbot public — l'allégation y devient
    // auto-publiée. Réécrit en énoncé qualitatif, sans chiffre de résultat ni
    // référence aux avis clients (retirés le 2026-10-09).
    text: "Axion-IA forme également les équipes commerciales à la prospection IA augmentée : utilisation de LinkedIn Sales Navigator assisté par IA, génération de messages personnalisés à grande échelle et qualification automatique des leads.",
    source: "Axion-IA — Programme formation commerciaux IA 2026",
    sourceUrl: "https://axion-ia.com/interventions-formations",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    confidence: 0.88,
  },
];
