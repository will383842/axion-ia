// Perpignan (66136) — contenu éditorial (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique paris.ts / lyon.ts) :
//   - Aucun « basé en UE ».
//   - Aucun délai concret chiffré (« 5 jours », « 7 jours », etc.).
//   - Aucun « frais de déplacement intégrés » — les frais sont en sus,
//     calculés au cas par cas selon la zone.
//   - Durée minimale = 1 journée. Mention systématique
//     « frais de logement, repas et forfait trajet en sus » sur interventions.
//   - Aucun prix hardcodé : tarifs viennent de `src/content/pricing.ts`.
//   - Tailles entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Mot « formation » autorisé en copy descriptif, naming = « intervention ».
//
// Sources économiques : economic-data/perpignan.ts (Sprint City Quality V3, ville #30).
// Réalités locales : Saint-Charles International (1er centre européen fruits-légumes),
// Cémoi (n°1 chocolat France, siège Perpignan), Tecnosud (technopôle DERBI),
// UPVD, Sup'EnR, Foir'Expo, Zone Franche Urbaine, transfrontalier Catalogne/Espagne,
// 9 AOP/AOC viticoles (Côtes du Roussillon, Banyuls, Rivesaltes, Maury…),
// French Tech Perpignan, CCI Pyrénées-Orientales.

import type { VilleCopy } from "./types";

export const PERPIGNAN_COPY: VilleCopy = {
  pitchFr:
    "Perpignan regroupe 13 498 établissements actifs, le 1er centre européen de fruits et légumes (Saint-Charles International, 2,3 Md€ CA), le siège de Cémoi (n°1 chocolat France), le pôle EnR Tecnosud-DERBI et 9 AOP/AOC viticoles en moins de 30 km. Axion-IA y intervient sur site, des TPE catalanes aux ETI agroalimentaires et énergétiques de la Perpignan Méditerranée Métropole.",
  pitchEn:
    "Perpignan hosts 13,498 active businesses, Europe's leading fruit and vegetable hub (Saint-Charles International, €2.3 Bn revenue), the HQ of Cémoi (France's no.1 chocolate maker), the Tecnosud-DERBI renewables cluster and 9 AOP/AOC wine appellations within 30 km. Axion-IA delivers on site, from Catalan micro-businesses to agri-food and energy mid-caps across Perpignan Méditerranée Métropole.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Perpignan : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, de la TPE négoce Saint-Charles à l'ETI agroalimentaire ou énergétique de Tecnosud.",
      en: "Operational AI audit in Perpignan: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Saint-Charles trading micro-businesses to agri-food or energy mid-caps at Tecnosud.",
    },
    interventions: {
      fr: "Interventions IA à Perpignan : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Perpignan: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Perpignan : on déploie l'IA dans vos outils existants (CRM, ERP, TMS, systèmes logistiques) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Perpignan: we deploy AI into your existing tools (CRM, ERP, TMS, logistics systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Perpignan : programme 1-to-1 pour dirigeants et indépendants — de la TPE viticole à l'entrepreneur transfrontalier France-Espagne. Séances sur site ou à distance, à votre rythme.",
      en: "Individual AI coaching in Perpignan: 1-to-1 programme for executives and independents — from Roussillon wine estate owners to France-Spain cross-border entrepreneurs. On-site or remote sessions, at your pace.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Perpignan (66) sur site — Saint-Charles, Tecnosud, Polygone Nord, centre-ville et communes de la Perpignan Méditerranée Métropole. Nous accompagnons les TPE, PME, ETI et grandes entreprises perpignanaises (agroalimentaire, logistique, négoce, énergies renouvelables, viticulture, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Perpignan (66) on site — Saint-Charles, Tecnosud, Polygone Nord, city centre and communes across Perpignan Méditerranée Métropole. We support Perpignan micro-businesses, SMEs, mid-caps and large enterprises (agri-food, logistics, trading, renewables, viticulture, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Commerce, Logistique & Transport (Saint-Charles International)",
    "Agroalimentaire & Négoce fruits-légumes",
    "Activités spécialisées, scientifiques & Conseil",
    "Santé, Enseignement & Services publics (CH Perpignan, UPVD)",
    "Énergies renouvelables & Cleantech (Tecnosud, DERBI)",
    "Viticulture & Vins doux naturels (Roussillon, Banyuls, Rivesaltes)",
  ],

  distancesFr:
    "Gare de Perpignan en cœur de ville — terminus LGV côté espagnol, liaison directe Barcelone (~80 min TGV) et Paris (~5 h). Aéroport de Perpignan-Rivesaltes (PGF) à ~10 km, dessertes domestiques et saisonnières européennes. Réseau bus Sankéo (Perpignan Méditerranée Métropole) pour rejoindre Saint-Charles, Tecnosud et les communes alentour.",
  distancesEn:
    "Perpignan station in the city centre — LGV terminus on the Spanish side, direct links to Barcelona (~80 min TGV) and Paris (~5 h). Perpignan-Rivesaltes Airport (PGF) ~10 km away, domestic and seasonal European routes. Sankéo bus network (Perpignan Méditerranée Métropole) to reach Saint-Charles, Tecnosud and surrounding communes.",

  ecosystemFr:
    "Tissu B2B de 13 498 établissements actifs, structuré autour de 4 pôles : la plateforme logistique Saint-Charles International (80 ha, 150 entreprises, négoce fruits-légumes), le technopôle Tecnosud (DERBI-CEMATER énergies renouvelables), la zone agroalimentaire Agrosud (Cémoi, Conserves France) et le tertiaire Polygone Nord. Université Via Domitia (8 945 étudiants), Sup'EnR, IFCt transfrontalier et French Tech Perpignan complètent l'écosystème.",
  ecosystemEn:
    "B2B fabric of 13,498 active businesses, structured around 4 clusters: Saint-Charles International logistics platform (80 ha, 150 companies, fruit-vegetable trading), Tecnosud technopole (DERBI-CEMATER renewables), Agrosud agri-food zone (Cémoi, Conserves France) and Polygone Nord tertiary hub. University Via Domitia (8,945 students), Sup'EnR, cross-border IFCT and French Tech Perpignan complete the ecosystem.",

  heroSchema: {
    centerSubLabel: "Écosystème IA · 13 498 entreprises",
    satellites: [
      {
        label: "Saint-Charles",
        detail: "1er centre européen fruits-légumes · 2,3 Md€",
        accent: "terracotta",
      },
      {
        label: "Cémoi",
        detail: "N°1 chocolat France · siège Perpignan",
        accent: "mocha",
      },
      {
        label: "DERBI-Tecnosud",
        detail: "Pôle EnR · 300 entreprises · R&D",
        accent: "sage",
      },
      {
        label: "UPVD",
        detail: "Université Via Domitia · 8 945 étudiants",
        accent: "primary",
      },
      {
        label: "9 AOP/AOC",
        detail: "Roussillon · Banyuls · Rivesaltes · Maury",
        accent: "terracotta",
      },
      {
        label: "Barcelone ~80 min",
        detail: "Transfrontalier France-Catalogne",
        accent: "sage",
      },
    ],
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Perpignan ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Perpignan et partout en France.",
    },
    {
      q: "Axion-IA peut-il accompagner des entreprises transfrontalières France-Espagne ?",
      a: "Oui. Perpignan est à 30 km de la frontière espagnole et à ~80 min TGV de Barcelone. Nous accompagnons les entreprises à dimension transfrontalière (négoce Roussillon-Catalogne, coopérations Eurorégion Pyrénées-Méditerranée) sur leurs usages IA : traduction automatique, gestion documentaire bilingue, analyse données logistiques cross-border.",
    },
    {
      q: "Quels secteurs sont prioritaires à Perpignan pour une mission IA ?",
      a: "Nos déploiements perpignanais ciblent en priorité le négoce et la logistique fruits-légumes (Saint-Charles International), l'agroalimentaire (Cémoi, Conserves France, Agrosud), les énergies renouvelables (Tecnosud, DERBI), la viticulture Roussillon et les services aux entreprises. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Intervenez-vous aussi dans les communes de la Métropole (Canet, Rivesaltes, Saint-Estève) ?",
      a: "Oui. La Perpignan Méditerranée Métropole est notre zone d'intervention complète : Saint-Estève, Cabestany, Bompas, Le Soler, Canet-en-Roussillon, Saleilles, Rivesaltes et les autres communes. Aucun supplément de zone.",
    },
    {
      q: "Pouvez-vous démarrer une mission rapidement depuis Perpignan ?",
      a: "Le délai de démarrage dépend de votre besoin (urgence, complexité, taille). Nous calons une date lors du brief de cadrage initial et tenons l'engagement contractuel à la signature. La gare TGV intra-muros facilite nos déplacements sur site.",
    },
    {
      q: "Travaillez-vous avec les startups et acteurs de la French Tech Perpignan ?",
      a: "Oui. Nous accompagnons les startups et PME innovantes de l'écosystème perpignanais — French Tech Perpignan, incubateurs UPVD, projets Tecnosud et porteurs de projets EnR. Notre offre est calibrée pour les structures qui veulent passer d'un POC IA à un déploiement opérationnel.",
    },
  ],

  // === SERVICES LONG-FORM PERPIGNAN ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise perpignanaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du négoce Saint-Charles aux ETI agroalimentaires d'Agrosud et aux directions transformation des groupes implantés dans la Métropole.",
        whyHere: [
          "Perpignan concentre un tissu B2B sectorisé unique en France : logistique et négoce fruits-légumes (Saint-Charles International, 1er centre européen), agroalimentaire (Cémoi, Conserves France), énergies renouvelables (Tecnosud, DERBI-CEMATER) et viticulture Roussillon — autant de verticales à fort potentiel d'automatisation IA.",
          "Nos consultants se déplacent sur l'ensemble de la Perpignan Méditerranée Métropole : Saint-Charles, Tecnosud, Polygone Nord, centre-ville, Agrosud, Saint-Estève, Cabestany, Rivesaltes et communes proches.",
          "Dimension transfrontalière France-Espagne prise en compte : Barcelone à ~80 min TGV, Eurorégion Pyrénées-Méditerranée active. Nous intégrons les usages IA bilingues FR/ES pour les entreprises opérant de part et d'autre de la frontière.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux perpignanais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI logistiques et agroalimentaires avec des workflows de traçabilité ou de gestion des flux complexes.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Perpignan dans vos locaux — Saint-Charles, Tecnosud, Agrosud, Polygone Nord ou commune de la Métropole — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, logistique, production, qualité, finance, direction) pour cartographier finement les frictions, en tenant compte des spécificités sectorielles locales (traçabilité alimentaire, gestion des flux transfrontaliers, contraintes INAO/AOP, protocoles EnR).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, bons de commande, contrats logistiques, fiches produits AOP, rapports de production énergie. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux perpignanais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et petits négoces perpignanais jusqu'à une dizaine de collaborateurs — Saint-Charles, Roussillon viticole, centre-ville.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME logistiques et agroalimentaires de quelques dizaines à 250 collaborateurs — transporteurs Saint-Charles, transformateurs Agrosud, cabinets de conseil Polygone Nord.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI des secteurs agroalimentaire (Cémoi, Conserves France), énergies renouvelables (Tecnosud, DERBI) ou commerce (Saint-Charles International) souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands groupes implantés à Perpignan — direction transformation Cémoi, Saint-Charles International, Centre Hospitalier de Perpignan et organismes publics de la Métropole.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel chiffré et actionnable. Le rapport intégrait la complexité de nos flux transfrontaliers France-Espagne — on a pu présenter le plan au board dès la semaine suivante.",
            role: "Directeur général",
            companyProfile: "ETI négoce agroalimentaire, Saint-Charles Perpignan",
          },
          {
            quote:
              "Méthode rigoureuse, démos sur nos données de gestion d'énergie plutôt que des slides théoriques. Le livrable a permis de prioriser nos chantiers IA avec un ROI chiffré pour le comité de direction.",
            role: "Directrice de la transformation",
            companyProfile: "PME énergies renouvelables, Tecnosud Perpignan",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Perpignan ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI logistique ou agroalimentaire à Perpignan ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables — saisie commandes, traçabilité produits, gestion documentaire réglementaire, suivi flux logistiques. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données logistiques ou agroalimentaires restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs sous certification INAO/AOP ou sous contraintes douanières transfrontalières, nous appliquons les exigences souveraineté et conformité dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Perpignan ?",
            a: "Toujours en présentiel dans vos locaux perpignanais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous sur Saint-Charles International et ses entreprises membres ?",
            a: "Oui. La plateforme Saint-Charles est l'un de nos terrains d'audit prioritaires à Perpignan. Négociants, commissionnaires, transporteurs et prestataires logistiques du MISC sont éligibles à l'ensemble de nos offres d'audit, quelle que soit leur taille.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits perpignanais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs à contraintes fortes (agroalimentaire certifié, logistique transfrontalière, énergies renouvelables réglementées).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Perpignan business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Saint-Charles trading micro-businesses to Agrosud agri-food mid-caps and large enterprise transformation leadership across the Métropole.",
        whyHere: [
          "Perpignan hosts a uniquely sectorised B2B fabric: fruit-vegetable logistics and trading (Saint-Charles International, Europe's no.1), agri-food (Cémoi, Conserves France), renewables (Tecnosud, DERBI-CEMATER) and Roussillon viticulture — all high-potential AI automation verticals.",
          "Our consultants travel across Perpignan Méditerranée Métropole: Saint-Charles, Tecnosud, Polygone Nord, city centre, Agrosud, Saint-Estève, Cabestany, Rivesaltes and surrounding communes.",
          "France-Spain cross-border dimension taken into account: Barcelona ~80 min TGV, active Eurorégion Pyrénées-Méditerranée. We integrate bilingual FR/ES AI use cases for companies operating on both sides of the border.",
          "Read-outs always in person: ideation workshops at your Perpignan offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for logistics and agri-food mid-caps with complex traceability or flow management workflows.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Perpignan at your offices — Saint-Charles, Tecnosud, Agrosud, Polygone Nord or a Métropole commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, logistics, production, quality, finance, leadership) to map frictions, accounting for local sector specifics (food traceability, cross-border flow management, INAO/AOP constraints, renewables protocols).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, purchase orders, logistics contracts, AOP product sheets, energy production reports. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Perpignan offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Perpignan freelancers, small traders and micro-firms up to about ten staff — Saint-Charles, Roussillon wine estates, city centre.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for logistics and agri-food SMEs from a few dozen to 250 staff — Saint-Charles carriers, Agrosud processors, Polygone Nord consulting firms.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For mid-caps in agri-food (Cémoi, Conserves France), renewables (Tecnosud, DERBI) or trading (Saint-Charles International) framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large groups based in Perpignan — Cémoi transformation leadership, Saint-Charles International, Centre Hospitalier de Perpignan and Métropole public bodies.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a costed, actionable operational audit. The report accounted for the complexity of our France-Spain cross-border flows — we presented the plan to the board the very next week.",
            role: "CEO",
            companyProfile: "Agri-food trading mid-cap, Saint-Charles Perpignan",
          },
          {
            quote:
              "Rigorous method, demos on our energy management data rather than theoretical slides. The deliverable helped prioritize our AI initiatives with a costed ROI for the executive committee.",
            role: "Head of Transformation",
            companyProfile: "Renewables SME, Tecnosud Perpignan",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Perpignan?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a logistics or agri-food mid-cap in Perpignan?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows — order entry, product traceability, regulatory document management, logistics flow tracking. The deliverable details exact figures for your case.",
          },
          {
            q: "Does my logistics or agri-food data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For sectors under INAO/AOP certification or cross-border customs constraints, we apply sovereignty and compliance requirements at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Perpignan?",
            a: "Always in person at your Perpignan offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Saint-Charles International and its member companies?",
            a: "Yes. Saint-Charles platform is one of our priority audit grounds in Perpignan. Traders, commission agents, carriers and logistics service providers at MISC are eligible for our full audit portfolio, regardless of size.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Perpignan audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in high-constraint sectors (certified agri-food, cross-border logistics, regulated renewables).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Perpignan se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en entrepôt logistique, sur la plateforme Saint-Charles, en bureau ou sur le terrain. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Perpignan cumule des profils d'entreprises très variés, tous à fort besoin de montée en compétence IA : négociants fruits-légumes Saint-Charles, producteurs viticoles Roussillon, PME BTP Pyrénées-Orientales, TPE services Polygone Nord et équipes Tecnosud.",
          "Toutes les communes de la Perpignan Méditerranée Métropole couvertes en présentiel : centre-ville, Saint-Charles, Tecnosud, Agrosud, Polygone Nord, Saint-Estève, Cabestany, Bompas, Rivesaltes.",
          "Le format Essentielle est calibré pour les structures perpignanaises de quelques personnes à une centaine de collaborateurs — PME négoce, cabinets de conseil, agences, coopératives viticoles.",
          "Le format Conférence convient aux plénières d'entreprise perpignanaises — salles Parc des Expositions, espaces French Tech, plateaux Saint-Charles.",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI agroalimentaires, logistiques ou énergétiques implantées dans la Métropole.",
          "Vocabulaire ajusté à votre secteur : logistique et supply chain, agroalimentaire certifié, viticulture AOP, énergies renouvelables, transfrontalier France-Espagne. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes logistiques ou réglementaires agroalimentaires — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de livraison, fiches produits, contrats logistiques, données de production énergie, fiches techniques viticoles) pour calibrer les démos sur VOS données perpignanaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements Saint-Charles ou Tecnosud avec contraintes de sécurité réseau.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle perpignanaise.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit sur la plateforme Saint-Charles, en bureau Polygone Nord ou sur un site de production.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, petits négoces et micro-entreprises perpignanaises jusqu'à une dizaine de collaborateurs — Saint-Charles, viticulteurs Roussillon, prestataires de services.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — commerciaux, logistique, qualité, production — particulièrement efficace pour les PME négoce et agroalimentaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI logistiques, pôles agroalimentaires, Tecnosud) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grandes structures perpignanaises — roadshow multi-sites Métropole, séminaires CODIR + cascade équipes terrain ou entrepôts.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos équipes commerciales. Ils repartent avec des outils configurés sur leurs vrais flux de commandes. Dès le lendemain, plusieurs les utilisaient pour rédiger des offres clients.",
            role: "Directeur commercial",
            companyProfile: "PME négoce fruits-légumes, Saint-Charles Perpignan",
          },
          {
            quote:
              "La session dirigeants nous a alignés en une journée sur notre stratégie IA dans le contexte transfrontalier France-Espagne. Cas concrets adaptés à nos enjeux — pas un générique copié-collé.",
            role: "DG",
            companyProfile: "ETI logistique, Perpignan Méditerranée Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Perpignan ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir sur la plateforme Saint-Charles International ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes d'un environnement logistique actif comme Saint-Charles — espaces d'accueil, salles de réunion des entreprises membres, contraintes d'accès. La préparation inclut un brief logistique préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur agroalimentaire ou EnR perpignanais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME viticole AOP Roussillon n'a rien à voir avec une session pour une équipe Tecnosud ou un négoce Saint-Charles.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil et formation professionnelle.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur perpignanais — logistique, agroalimentaire, viticulture, énergies renouvelables — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Perpignan come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in logistics warehouses, on the Saint-Charles platform, in the office or in the field. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Perpignan combines very varied business profiles, all with strong AI upskilling needs: Saint-Charles fruit-vegetable traders, Roussillon wine producers, Pyrénées-Orientales construction SMEs, Polygone Nord service micro-businesses and Tecnosud teams.",
          "All Perpignan Méditerranée Métropole communes covered in person: city centre, Saint-Charles, Tecnosud, Agrosud, Polygone Nord, Saint-Estève, Cabestany, Bompas, Rivesaltes.",
          "The Essential format is calibrated for Perpignan structures from a few people to about a hundred staff — trading SMEs, consulting firms, agencies, wine cooperatives.",
          "The Talk format suits Perpignan corporate plenaries — Parc des Expositions rooms, French Tech spaces, Saint-Charles meeting areas.",
          "The Executives format enables in-camera framing for agri-food, logistics or energy mid-cap executive committees based in the Métropole.",
          "Vocabulary adjusted to your sector: logistics and supply chain, certified agri-food, AOP viticulture, renewables, France-Spain cross-border. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including logistics or agri-food regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (delivery notes, product sheets, logistics contracts, energy production data, viticultural technical sheets) to calibrate demos on YOUR Perpignan data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection and network access. No technical hiccup on D-day, even in Saint-Charles or Tecnosud environments with network security constraints.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Perpignan sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether on the Saint-Charles platform, at a Polygone Nord office or at a production site.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Perpignan freelancers, small traders and micro-firms up to about ten staff — Saint-Charles, Roussillon wine estates, service providers.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — sales, logistics, quality, production — particularly effective for trading and agri-food SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (logistics mid-caps, agri-food clusters, Tecnosud) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Perpignan large structures — multi-site Métropole roadshows, exec committee seminars + field team or warehouse cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our sales team's needs. They left with tools configured for their real order flows. By the next day, several were already using them to draft client proposals.",
            role: "Sales Director",
            companyProfile: "Fruit-vegetable trading SME, Saint-Charles Perpignan",
          },
          {
            quote:
              "The executive session aligned us within a day on our AI strategy in the France-Spain cross-border context. Concrete cases adapted to our challenges — not a copy-paste generic.",
            role: "CEO",
            companyProfile: "Logistics mid-cap, Perpignan Méditerranée Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Perpignan take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions at Saint-Charles International?",
            a: "Yes. Our consultants adapt to the constraints of an active logistics environment like Saint-Charles — meeting rooms, member company facilities, access procedures. Preparation includes an upfront logistics brief.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Perpignan agri-food or renewables sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for an AOP Roussillon wine SME has nothing to do with one for a Tecnosud team or a Saint-Charles trading company.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting and professional training service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Perpignan sector — logistics, agri-food, viticulture, renewables — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Perpignan met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux perpignanais — Saint-Charles, Tecnosud, Agrosud, Polygone Nord ou commune de la Métropole.",
        whyHere: [
          "Perpignan concentre des verticales à fort potentiel d'automatisation — traçabilité fruits-légumes Saint-Charles, gestion flux logistiques transfrontaliers, documentation agroalimentaire certifiée (INAO/AOP), monitoring production EnR Tecnosud, gestion caves et coopératives viticoles.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux perpignanais : alignement des équipes, accès aux données de production ou commerciales, validation des intégrations TMS/CRM/ERP.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable d'exploitation.",
          "Recette finale toujours en présentiel à Perpignan : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en entrepôt ou sur la plateforme Saint-Charles.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques perpignanais : ETI logistiques (automatisation bons de commande, traçabilité multi-origines, gestion litiges fournisseurs), PME agroalimentaires (documentation réglementaire, étiquetage AOP, rapports qualité), cabinets de conseil (qualification prospects, génération documents), acteurs EnR Tecnosud (rapports production, maintenance prédictive données capteurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Perpignan : revue de l'architecture cible (TMS, CRM, ERP, outils logistiques), validation des contraintes RGPD/sécurité et réglementaires (traçabilité alimentaire, conformité douanière transfrontalière), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Perpignan : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Perpignan : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple — automatisation devis ou bons de livraison, comptes-rendus réunion, qualification prospects pour TPE et indépendants perpignanais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration TMS/CRM/ERP. Pour PME logistiques Saint-Charles, agroalimentaires Agrosud, acteurs EnR Tecnosud et cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, TMS logistique, datalake), formation ambassadeurs cross-département. Adapté aux ETI négoce, agroalimentaires et EnR perpignanaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Métropole : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation traçabilité livrée comme promis. ROI mesuré dès les premiers mois : nos équipes qualité passent moins de temps sur la saisie et plus sur le contrôle. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur des opérations",
            companyProfile: "ETI négoce fruits-légumes, Saint-Charles Perpignan",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe terrain Tecnosud et nos administratifs. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME énergies renouvelables, Tecnosud Perpignan",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Perpignan ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions perpignanaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données logistiques ou alimentaires restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés perpignanais (certification alimentaire, traçabilité INAO, conformité douanière transfrontalière), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques de traçabilité ou de certification ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (traçabilité réglementaire, certification AOP, conformité douanière), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Perpignan brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Perpignan offices — Saint-Charles, Tecnosud, Agrosud, Polygone Nord or a Métropole commune.",
        whyHere: [
          "Perpignan hosts high-automation-potential verticals: Saint-Charles fruit-vegetable traceability, cross-border logistics flow management, certified agri-food documentation (INAO/AOP), Tecnosud renewables production monitoring, wine cooperative and estate management.",
          "Kick-off always happens in person at your Perpignan offices: team alignment, access to production or commercial data, TMS/CRM/ERP integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or operations manager.",
          "Final acceptance always in person in Perpignan: handover, team training on their workstations, runbook documentation delivered — whether in an office, warehouse or on the Saint-Charles platform.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Perpignan cases: logistics mid-caps (purchase order automation, multi-origin traceability, supplier dispute management), agri-food SMEs (regulatory documentation, AOP labelling, quality reports), consulting firms (prospect qualification, document generation), Tecnosud renewables players (production reports, sensor-data predictive maintenance).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Perpignan workshop: target architecture review (TMS, CRM, ERP, logistics tools), GDPR/security and regulatory constraints validation (food traceability, cross-border customs compliance), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Perpignan: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Perpignan: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at mission closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "POC",
            detail:
              "Implementation of a simple use case — quote or delivery note automation, meeting minutes, prospect qualification for Perpignan micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, TMS/CRM/ERP integration. For Saint-Charles logistics SMEs, Agrosud agri-food processors, Tecnosud renewables players and firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, logistics TMS, datalake), cross-department ambassador training. Tailored for Perpignan trading, agri-food and renewables mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Métropole large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Traceability automation implementation delivered as promised. ROI measured within the first months: our quality teams now spend less time on data entry and more on controls. No lock-in, we control our deployment.",
            role: "Operations Director",
            companyProfile: "Fruit-vegetable trading mid-cap, Saint-Charles Perpignan",
          },
          {
            quote:
              "Perfect hybrid method for our Tecnosud field team and admin staff. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Renewables SME, Tecnosud Perpignan",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Perpignan take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Perpignan missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my logistics or food data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Perpignan regulated sectors (food certification, INAO traceability, cross-border customs compliance), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical traceability or certification data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (regulatory traceability, AOP certification, customs compliance), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le programme 1-to-1 Axion-IA à Perpignan est un accompagnement individuel pour dirigeants et indépendants qui veulent monter en compétence sur l'IA à leur propre rythme. Séances sur site à Perpignan ou à distance, calibrées sur votre réalité métier — négociant Saint-Charles, vigneron Roussillon, entrepreneur transfrontalier France-Espagne, professionnel de santé ou consultant indépendant.",
        whyHere: [
          "Perpignan abrite un tissu dense de dirigeants de TPE et d'indépendants — négoce, viticulture, BTP, services — qui ont besoin d'une montée en compétence IA personnalisée, pas d'une session collective générique.",
          "La dimension transfrontalière France-Espagne est prise en compte : nous travaillons les cas d'usage bilingues FR/ES et les contextes de business development Eurorégion Pyrénées-Méditerranée.",
          "Programme entièrement adapté à votre emploi du temps de dirigeant perpignanais : séances courtes, à votre bureau ou à distance, sans contrainte de groupe.",
          "Aucun prérequis technique : que vous partiez de zéro ou ayez déjà testé des outils IA, nous adaptons le niveau et les cas à votre point de départ réel.",
          "Confidentialité totale, vos données et stratégies restent strictement entre vous et votre consultant dédié.",
          "Résultats tangibles dès la première séance : vous repartez avec des outils configurés sur vos propres cas métier perpignanais, pas des exemples génériques.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Une séance de découverte pour cartographier vos activités, vos outils actuels, vos cas d'usage prioritaires et votre niveau de confort avec l'IA — y compris les spécificités de votre secteur perpignanais.",
          },
          {
            step: "Plan personnalisé",
            detail:
              "Construction d'un parcours sur mesure : séquence de séances, thèmes, outils ciblés, rythme adapté à votre agenda de dirigeant ou d'indépendant à Perpignan.",
          },
          {
            step: "Séances pratiques",
            detail:
              "Chaque séance alterne explication courte et mise en pratique immédiate sur VOS données réelles — bons de commande, emails clients, documents contractuels, fiches produits, données viticulture.",
          },
          {
            step: "Outils configurés",
            detail:
              "À chaque séance, un ou plusieurs outils IA configurés pour votre cas d'usage spécifique. Vous êtes autonome dès la fin de séance — pas d'attente d'une prochaine formation.",
          },
          {
            step: "Suivi et ajustements",
            detail:
              "Entre les séances, possibilité d'échanges courts par message pour lever les blocages. Le plan est ajusté en continu selon vos avancées et vos nouvelles priorités.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pack Démarrage",
            detail:
              "Pour indépendants et dirigeants de TPE perpignanaises souhaitant une première immersion pratique IA — négoce, artisans, prestataires de services.",
          },
          {
            sizeLabel: "PME",
            price: "Pack Montée en puissance",
            detail:
              "Pour dirigeants et managers de PME souhaitant développer une vision et une pratique IA solides sur plusieurs semaines.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme Dirigeant ETI",
            detail:
              "Pour les dirigeants d'ETI perpignanaises (agroalimentaire, logistique, EnR) souhaitant cadrer leur stratégie IA personnelle et leur posture de leadership face à la transformation.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Accompagnement individuel pour membres de CODIR ou directeurs de grandes structures implantées dans la Métropole de Perpignan.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le programme 1-to-1 m'a permis de passer de zéro à opérationnel sur l'IA en quelques séances. Les exemples étaient calés sur ma réalité de négoce transfrontalier — rien de générique.",
            role: "Dirigeant indépendant",
            companyProfile: "TPE négoce fruits-légumes, Saint-Charles Perpignan",
          },
          {
            quote:
              "Accompagnement discret, efficace, totalement adapté à mon rythme et à mon secteur viticole. Je repars avec des outils configurés sur mes propres données domaine.",
            role: "Gérant",
            companyProfile: "Domaine viticole AOP Roussillon, Perpignan Méditerranée Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de séances sont nécessaires pour être opérationnel sur l'IA à Perpignan ?",
            a: "Le nombre de séances dépend de votre point de départ, de vos objectifs et de votre rythme. Dès la première séance, vous repartez avec des outils configurés. Un programme complet s'étale sur quelques semaines selon votre disponibilité.",
          },
          {
            q: "Les séances se déroulent-elles en présentiel ou à distance ?",
            a: "Les deux sont possibles : présentiel dans vos locaux perpignanais ou à distance en visio selon votre préférence. Pour le kick-off initial et certaines séances pratiques sur vos données, le présentiel est recommandé.",
          },
          {
            q: "Faut-il avoir des compétences techniques pour suivre le programme ?",
            a: "Aucune compétence technique préalable requise. Le programme s'adapte à votre niveau : débutant complet ou dirigeant ayant déjà manipulé des outils IA. L'important est votre motivation à intégrer l'IA dans votre pratique professionnelle quotidienne.",
          },
          {
            q: "Mes informations stratégiques sont-elles confidentielles ?",
            a: "Absolument. Confidentialité stricte dès la première séance. Toutes les informations partagées restent strictement confidentielles — votre consultant dédié ne divulgue ni vos données ni votre stratégie.",
          },
          {
            q: "Pouvez-vous travailler avec des cas d'usage transfrontaliers France-Espagne ?",
            a: "Oui, c'est une spécificité de nos programmes perpignanais. Nous traitons les cas bilingues FR/ES, la gestion documentaire cross-border, les communications avec partenaires catalans et les workflows de business development Eurorégion.",
          },
          {
            q: "Que se passe-t-il si mes besoins évoluent en cours de programme ?",
            a: "Le programme est conçu pour être flexible. Si vos priorités changent ou si de nouveaux cas d'usage émergent, le plan est ajusté à la séance suivante sans coût supplémentaire ni formalité.",
          },
        ],
        guarantees:
          "Programme entièrement sur mesure : aucun contenu standard recyclé. Confidentialité totale de vos données et de votre stratégie. Outils configurés sur vos cas réels dès la première séance. Si après la première séance le programme ne correspond pas à vos attentes, remboursement intégral. Aucun engagement de durée : vous maîtrisez le rythme et la fin du programme.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 programme in Perpignan is an individual coaching for executives and independents who want to build AI skills at their own pace. On-site sessions in Perpignan or remote, calibrated to your business reality — Saint-Charles trader, Roussillon wine grower, France-Spain cross-border entrepreneur, healthcare professional or independent consultant.",
        whyHere: [
          "Perpignan hosts a dense fabric of SME executives and independents — trading, viticulture, construction, services — who need personalised AI upskilling, not a generic group session.",
          "France-Spain cross-border dimension taken into account: we work on bilingual FR/ES use cases and Eurorégion Pyrénées-Méditerranée business development contexts.",
          "Programme entirely adapted to your schedule as a Perpignan executive: short sessions, at your office or remote, no group constraints.",
          "No technical prerequisites: whether you start from zero or have already tested AI tools, we adapt the level and cases to your real starting point.",
          "Total confidentiality: Strict confidentiality ensured, your data and strategies stay strictly between you and your dedicated consultant.",
          "Tangible results from the first session: you leave with tools configured for your own Perpignan business use cases, not generic examples.",
        ],
        methodology: [
          {
            step: "Initial diagnosis",
            detail:
              "A discovery session to map your activities, current tools, priority use cases and AI comfort level — including the specifics of your Perpignan sector.",
          },
          {
            step: "Personalised plan",
            detail:
              "Building a tailored programme: session sequence, themes, targeted tools, rhythm adapted to your schedule as a Perpignan executive or independent.",
          },
          {
            step: "Practical sessions",
            detail:
              "Each session alternates short explanation and immediate hands-on practice on YOUR real data — purchase orders, client emails, contractual documents, product sheets, viticulture data.",
          },
          {
            step: "Tools configured",
            detail:
              "At each session, one or more AI tools configured for your specific use case. You are autonomous by session end — no waiting for a next training event.",
          },
          {
            step: "Follow-up and adjustments",
            detail:
              "Between sessions, possibility of short message exchanges to unblock issues. The plan is continuously adjusted based on your progress and new priorities.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Starter pack",
            detail:
              "For Perpignan independents and micro-business executives wanting a first practical AI immersion — trading, artisans, service providers.",
          },
          {
            sizeLabel: "SME",
            price: "Scale-up pack",
            detail:
              "For SME executives and managers wanting to build a solid AI vision and practice over several weeks.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive programme",
            detail:
              "For Perpignan mid-cap executives (agri-food, logistics, renewables) wanting to frame their personal AI strategy and leadership posture in transformation.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom programme",
            detail:
              "Individual coaching for executive committee members or directors at large structures based in Perpignan Métropole.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 programme took me from zero to operational on AI in a few sessions. The examples were calibrated to my cross-border trading reality — nothing generic.",
            role: "Independent executive",
            companyProfile: "Fruit-vegetable trading micro-business, Saint-Charles Perpignan",
          },
          {
            quote:
              "Discreet, effective coaching, entirely adapted to my pace and my wine sector. I leave each session with tools configured on my own estate data.",
            role: "Manager",
            companyProfile: "AOP Roussillon wine estate, Perpignan Méditerranée Métropole",
          },
        ],
        faq: [
          {
            q: "How many sessions are needed to become operational on AI in Perpignan?",
            a: "The number of sessions depends on your starting point, objectives and pace. From the first session, you leave with configured tools. A complete programme spans a few weeks depending on your availability.",
          },
          {
            q: "Do sessions take place in person or remotely?",
            a: "Both are possible: in person at your Perpignan offices or remote via video call, per your preference. For the initial kick-off and certain hands-on sessions with your data, in-person is recommended.",
          },
          {
            q: "Do I need technical skills to follow the programme?",
            a: "No prior technical skills required. The programme adapts to your level: complete beginner or executive who has already tested AI tools. The key is your motivation to integrate AI into your daily professional practice.",
          },
          {
            q: "Is my strategic information confidential?",
            a: "Absolutely. Strict confidentiality ensured before the first session. All shared information remains strictly confidential — your dedicated consultant does not disclose your data or strategy.",
          },
          {
            q: "Can you work on France-Spain cross-border use cases?",
            a: "Yes, this is a specificity of our Perpignan programmes. We address bilingual FR/ES cases, cross-border document management, communication with Catalan partners and Eurorégion business development workflows.",
          },
          {
            q: "What if my needs evolve during the programme?",
            a: "The programme is designed to be flexible. If your priorities change or new use cases emerge, the plan is adjusted at the next session with no extra cost or formality.",
          },
        ],
        guarantees:
          "Entirely tailored programme: no recycled standard content. Strict confidentiality ensured, total confidentiality of your data and strategy. Tools configured on your real use cases from the first session. If after the first session the programme does not match your expectations, full refund. No duration commitment: you control the pace and end of the programme.",
      },
    },
  },
};
