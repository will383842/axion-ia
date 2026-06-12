// Villeurbanne (69266) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
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
//   - Villeurbanne est une ville distincte de Lyon (69266 ≠ 69123) — 2e ville
//     du Rhône, ~162 000 hab, commune indépendante de la Métropole de Lyon.
//
// Sources économiques : economic-data/villeurbanne.ts (Sprint City Quality V3, ville #16).
// Réalités locales : campus LyonTech-La Doua (100 ha, 25 000 étudiants),
// INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1, CNRS/INRAE/Inria,
// FORVIA MATERI'ACT (siège monde + centre R&D 7 500 m² 2023),
// TVH Consulting (intégrateur ERP SAP), Bel Air Camp (incubateur industriel),
// Pulsalys (SATT), quartier Gratte-Ciel (modernisme 1927-1934, Môrice Leroux),
// TNP, Carré de Soie, French Tech One Lyon-St-Étienne, métro A (Laurent Bonnevay).

import type { VilleCopy } from "./types";

export const VILLEURBANNE_COPY: VilleCopy = {
  pitchFr:
    "Villeurbanne (69100) concentre 13 426 établissements actifs, le campus LyonTech-La Doua (INSA Lyon, CPE Lyon, UCBL — 25 000 étudiants, CNRS, Inria), le siège mondial FORVIA MATERI'ACT et un tissu de PME tech et d'intégrateurs IT dense. Axion-IA y intervient sur site, des startups du Carré de Soie aux ETI industrielles, distinctement de Lyon.",
  pitchEn:
    "Villeurbanne (69100) hosts 13,426 active businesses, the LyonTech-La Doua campus (INSA Lyon, CPE Lyon, UCBL — 25,000 students, CNRS, Inria), FORVIA MATERI'ACT's world HQ and a dense cluster of tech SMEs and IT integrators. Axion-IA delivers on site, from Carré de Soie startups to industrial mid-caps — as a distinct city from Lyon.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Villeurbanne (69100) : nous cartographions ce qui peut être automatisé dans votre entreprise villeurbannaise et chiffrons le ROI. Du cabinet IT Gratte-Ciel à l'ETI industrielle campus Doua, 4 niveaux du Sur place au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Villeurbanne (69100): we map what can be automated at your company and quantify the ROI. From IT firms around Gratte-Ciel to industrial mid-caps at campus Doua, 4 tiers from Sur place to Mid-cap Strategic.",
    },
    interventions: {
      fr: "Interventions IA à Villeurbanne : formats sur site d'une à plusieurs journées. Vos collaborateurs repartent avec des outils IA installés sur leur poste, configurés pour leur métier réel — IT, R&D, industrie, services.",
      en: "AI sessions in Villeurbanne: on-site formats from one to several days. Your staff leave with AI tools installed on their workstations, configured for their real work — IT, R&D, industry, services.",
    },
    implementation: {
      fr: "Implémentation IA à Villeurbanne : on déploie l'IA dans vos outils existants (CRM, ERP SAP, outils IT, systèmes R&D) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Villeurbanne: we deploy AI into your existing tools (CRM, SAP ERP, IT tools, R&D systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement IA individuel à Villeurbanne : sessions 1-to-1 pour dirigeants, fondateurs tech et chercheurs-entrepreneurs du campus Doua et du Carré de Soie. Programme ajusté à votre rôle, votre secteur et votre rythme.",
      en: "Individual AI coaching in Villeurbanne: 1-to-1 sessions for executives, tech founders and researcher-entrepreneurs from campus Doua and Carré de Soie. Programme tailored to your role, your sector and your pace.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME tech et ETI villeurbannaises — site vitrine premium pour spin-offs INSA Lyon / campus LyonTech-La Doua et intégrateurs IT du Carré de Soie, espace client interactif, dashboard métier connecté à votre CRM/ERP SAP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Villeurbanne tech SMEs and mid-caps — premium showcase site for INSA Lyon / LyonTech-La Doua campus spin-offs and Carré de Soie IT integrators, interactive customer space, business dashboard connected to your SAP CRM/ERP. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Villeurbanne (69100) sur site — quartier Gratte-Ciel, campus LyonTech-La Doua, Carré de Soie et communes de la Métropole. Villeurbanne est une ville distincte de Lyon (69123) : 2e ville du Rhône, 13 426 établissements actifs, INSA Lyon, CNRS, Inria, FORVIA MATERI'ACT. Nous accompagnons les TPE, PME tech, ETI industrielles et grandes entreprises villeurbannaises sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique.",
  directAnswerEn:
    "Axion-IA is an senior AI experts consultancy that intervenes in Villeurbanne (69100) on site — Gratte-Ciel district, LyonTech-La Doua campus, Carré de Soie and Métropole communes. Villeurbanne is a distinct city from Lyon (69123): 2nd city in Rhône, 13,426 active businesses, INSA Lyon, CNRS, Inria, FORVIA MATERI'ACT. We support Villeurbanne micro-businesses, tech SMEs, industrial mid-caps and large enterprises on their operational AI use cases — costed diagnosis, demos on real data, concrete action plan. No tech lock-in.",

  seoHook: "it, logiciel & r&d, sciences",
  topSectorsNaf: [
    "IT, Logiciel & Numérique",
    "R&D, Sciences appliquées & Ingénierie",
    "Chimie, Matériaux & Industrie avancée",
    "Conseil & Services aux entreprises",
    "Équipement automobile & Mobilité durable",
    "Enseignement supérieur & Formation professionnelle",
  ],

  distancesFr:
    "Villeurbanne est desservie par le métro TCL ligne A (stations Laurent Bonnevay terminus et Gratte-Ciel centre-ville) et le tramway T1/T4. Gare TGV Lyon Part-Dieu à environ 3 km (TGV Sud-Est, Méditerranée — gare de rattachement). Aéroport Lyon Saint-Exupéry à environ 25 km. Accès Lyon intra-muros par métro A en quelques minutes.",
  distancesEn:
    "Villeurbanne is served by TCL metro line A (stations Laurent Bonnevay terminus and Gratte-Ciel town centre) and tram T1/T4. Lyon Part-Dieu TGV station approximately 3 km away (TGV South-East, Mediterranean lines — main railhead). Lyon Saint-Exupéry Airport approximately 25 km. Access to central Lyon by metro A in a few minutes.",

  ecosystemFr:
    "Tissu économique villeurbannais : 13 426 établissements actifs, densité 83 pour 1 000 habitants. Campus LyonTech-La Doua (INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1 — 25 000 étudiants + CNRS, INRAE, Inria). FORVIA MATERI'ACT siège mondial (matériaux durables, R&D 7 500 m²). TVH Consulting (ERP SAP). Incubateurs Bel Air Camp et Pulsalys (SATT). French Tech One Lyon-St-Étienne.",
  ecosystemEn:
    "Villeurbanne economic fabric: 13,426 active businesses, density 83 per 1,000 inhabitants. LyonTech-La Doua campus (INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1 — 25,000 students + CNRS, INRAE, Inria). FORVIA MATERI'ACT world HQ (sustainable materials, 7,500 m² R&D centre). TVH Consulting (SAP ERP). Bel Air Camp and Pulsalys (SATT) incubators. French Tech One Lyon-St-Étienne.",

  faqGeolocalisee: [
    {
      q: "Villeurbanne est-elle distincte de Lyon pour une mission IA ?",
      a: "Oui. Villeurbanne (69266, code postal 69100) est une commune indépendante de la Métropole de Lyon, 2e ville du Rhône avec environ 162 000 habitants. Elle possède sa propre mairie, son tissu économique IT/ingénierie distinct et son campus universitaire LyonTech-La Doua. Axion-IA y intervient en propre, sur site à Villeurbanne même, et non via un rabattement Lyon.",
    },
    {
      q: "Combien coûte un audit IA à Villeurbanne ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Villeurbanne et partout en France.",
    },
    {
      q: "Quels secteurs sont prioritaires à Villeurbanne pour une mission IA ?",
      a: "L'IT et le numérique (993 établissements, section J INSEE), la R&D et les sciences appliquées (campus LyonTech-La Doua — INSA, CNRS, Inria), les matériaux durables et l'industrie avancée (FORVIA MATERI'ACT), le conseil et l'intégration ERP (TVH Consulting). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Intervenez-vous sur le campus LyonTech-La Doua et les startups deep tech ?",
      a: "Oui. Nous accompagnons les startups et spin-offs issus de l'écosystème INSA Booster, Pulsalys (SATT), Bel Air Camp et du campus Doua. Notre offre est calibrée pour les structures deep tech et deep-industry qui veulent passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "Comment rejoindre vos locaux villeurbannais depuis Lyon ou la Métropole ?",
      a: "Villeurbanne est accessible en métro TCL ligne A (stations Laurent Bonnevay ou Gratte-Ciel), en tramway T1/T4 et en voiture depuis le périphérique nord ou l'A42. La gare TGV Lyon Part-Dieu est à environ 3 km. Nos consultants se déplacent directement dans vos locaux villeurbannais.",
    },
    {
      q: "Axion-IA travaille-t-il avec FORVIA MATERI'ACT ou les ETI industrielles de Villeurbanne ?",
      a: "Nous accompagnons les ETI industrielles et les grands groupes implantés à Villeurbanne sur leurs cas IA opérationnels : automatisation rapports qualité, analyse données matériaux, documentation réglementaire, gestion fournisseurs. Confidentialité stricte dès le démarrage, données traitées sur votre infrastructure.",
    },
    {
      q: "Vos interventions sont-elles éligibles aux aides French Tech One Lyon-St-Étienne ?",
      a: "Villeurbanne est intégrée au périmètre French Tech One Lyon-St-Étienne. Nos missions peuvent s'inscrire dans des plans de transformation numérique soutenus par la Métropole ou la CCI Lyon Métropole. Votre service RH ou DAF peut traiter nos prestations comme conseil et formation professionnelle dans votre plan de développement des compétences.",
    },
  ],

  // === SERVICES LONG-FORM VILLEURBANNE ===
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Villeurbanne (69100) cartographie ce qui peut être automatisé dans votre entreprise et chiffre le retour sur investissement. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des TPE IT du quartier Gratte-Ciel aux ETI industrielles du campus LyonTech-La Doua et aux grands groupes comme FORVIA MATERI'ACT. Villeurbanne est notre terrain d'intervention à part entière — distinctement de Lyon.",
        whyHere: [
          "Villeurbanne concentre un écosystème IT et ingénierie unique en France : campus LyonTech-La Doua (INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1, CNRS, Inria) — 25 000 étudiants et chercheurs — génère une demande d'audits IA à haute valeur technique.",
          "Tissu B2B villeurbannais sectorisé : IT et numérique (993 établissements section J), activités spécialisées et scientifiques (4 172 établissements sections M+N), industrie matériaux (FORVIA MATERI'ACT), conseil et intégration ERP (TVH Consulting).",
          "Nos consultants se déplacent dans tous les quartiers de Villeurbanne : Gratte-Ciel, campus Doua, Carré de Soie (ZAC Vaulx-en-Velin / Villeurbanne), Bonnevay, Charpennes, Cusset. Aucun rabattement sur Lyon — on vient chez vous.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux villeurbannais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les équipes R&D et ingénierie du campus Doua dont les workflows sont fortement documentés.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux villeurbannais — Gratte-Ciel, campus Doua, Carré de Soie ou tout autre quartier — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (IT, R&D, commercial, finance, production, direction) pour cartographier les frictions et attentes, en tenant compte des spécificités villeurbannaises — contraintes ingénierie, protocoles R&D, exigences ERP industriel.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports R&D, vos données industrielles ou ERP. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux villeurbannais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur IT, ingénierie ou industrie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises IT et cabinets villeurbannais jusqu'à une dizaine de collaborateurs — Gratte-Ciel, Charpennes, Cusset.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques, éditeurs logiciels, intégrateurs ERP et agences villeurbannaises de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (matériaux, équipementiers), ETI IT ou ETI tertiaires de Villeurbanne souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands groupes dont le siège ou un site majeur est implanté à Villeurbanne (FORVIA MATERI'ACT, TVH Consulting, présences campus Doua).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel ancré dans notre réalité R&D et ingénierie. Le rapport chiffré nous a permis de prioriser nos chantiers IA pour le conseil scientifique en quelques semaines.",
            role: "Directeur R&D",
            companyProfile: "PME deep tech, campus LyonTech-La Doua Villeurbanne",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données ERP réelles. Le livrable a permis d'aligner la direction et les équipes IT sur notre feuille de route IA pour les 18 prochains mois.",
            role: "DSI",
            companyProfile: "ETI intégration logicielle, quartier Gratte-Ciel Villeurbanne",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Villeurbanne ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI industrielle à Villeurbanne ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables — rapports qualité matériaux, suivi R&D, qualification appels d'offres ERP, documentation réglementaire. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données R&D ou industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs de l'ingénierie avancée et des matériaux (campus Doua, FORVIA MATERI'ACT), nous appliquons les contraintes de souveraineté et confidentialité dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Villeurbanne ?",
            a: "Toujours en présentiel dans vos locaux villeurbannais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes proches de Villeurbanne (Vaulx-en-Velin, Bron, Caluire) ?",
            a: "Oui. La Métropole de Lyon est notre zone d'intervention complète. Nos consultants se déplacent dans toutes les communes — Vaulx-en-Velin (Carré de Soie), Bron, Caluire-et-Cuire, Saint-Priest, Vénissieux. Villeurbanne est notre base principale dans la zone nord-est lyonnaise.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit à Villeurbanne ?",
            a: "Non. Une grande part de nos audits villeurbannais sont commandés par des dirigeants IT ou ingénierie qui n'ont jamais lancé de chantier IA structuré. L'audit est conçu pour ne pas vous engager dans la mauvaise direction, en tenant compte des contraintes techniques réelles de votre secteur.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit in Villeurbanne (69100) maps what can be automated at your company and quantifies the ROI. Four tiers from Sur place to Mid-cap Strategic cover every size, from IT micro-businesses around Gratte-Ciel to industrial mid-caps at LyonTech-La Doua campus and large groups such as FORVIA MATERI'ACT. Villeurbanne is our standalone engagement territory — not a Lyon satellite.",
        whyHere: [
          "Villeurbanne hosts a unique French IT and engineering ecosystem: LyonTech-La Doua campus (INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1, CNRS, Inria) — 25,000 students and researchers — generating high-value-technical AI audit demand.",
          "Villeurbanne B2B fabric by sector: IT and digital (993 establishments, section J), specialised scientific activities (4,172 establishments, sections M+N), materials industry (FORVIA MATERI'ACT), consulting and ERP integration (TVH Consulting).",
          "Our consultants travel to all Villeurbanne districts: Gratte-Ciel, Doua campus, Carré de Soie, Bonnevay, Charpennes, Cusset. No Lyon redirect — we come to you.",
          "Read-outs always in person: ideation workshops at your Villeurbanne offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for R&D and engineering teams at campus Doua with heavily documented workflows.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Villeurbanne offices — Gratte-Ciel, campus Doua, Carré de Soie or any other district — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (IT, R&D, sales, finance, production, leadership) to map frictions and expectations, accounting for Villeurbanne sector specifics — engineering constraints, R&D protocols, industrial ERP requirements.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, R&D reports, industrial or ERP data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Villeurbanne offices. Costed PDF deliverable handed over, actionable roadmap tailored to your IT, engineering or industry sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Villeurbanne freelancers, IT micro-firms and practices up to about ten staff — Gratte-Ciel, Charpennes, Cusset.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs, software publishers, ERP integrators and agencies in Villeurbanne from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (materials, equipment suppliers), IT mid-caps or tertiary mid-caps in Villeurbanne framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large groups with HQ or a major site in Villeurbanne (FORVIA MATERI'ACT, TVH Consulting, campus Doua presences).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit grounded in our R&D and engineering reality. The costed report let us prioritise AI initiatives for our scientific board within a few weeks.",
            role: "R&D Director",
            companyProfile: "Deep tech SME, LyonTech-La Doua campus Villeurbanne",
          },
          {
            quote:
              "Pragmatic method, demos on our real ERP data. The deliverable aligned leadership and IT teams on our AI roadmap for the next 18 months.",
            role: "CIO",
            companyProfile: "Software integration mid-cap, Gratte-Ciel district Villeurbanne",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Villeurbanne?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Villeurbanne?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows — materials quality reports, R&D tracking, ERP tender qualification, regulatory documentation. The deliverable details exact figures for your case.",
          },
          {
            q: "Does my R&D or industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For advanced engineering and materials sectors (campus Doua, FORVIA MATERI'ACT), we apply sovereignty and confidentiality constraints at AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Villeurbanne?",
            a: "Always in person at your Villeurbanne offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover communes near Villeurbanne (Vaulx-en-Velin, Bron, Caluire)?",
            a: "Yes. The Métropole de Lyon is our full territory. Our consultants travel to all communes — Vaulx-en-Velin (Carré de Soie), Bron, Caluire-et-Cuire, Saint-Priest, Vénissieux. Villeurbanne is our main base in the north-east Lyon area.",
          },
          {
            q: "Do I need AI maturity to engage you in Villeurbanne?",
            a: "No. A large share of our Villeurbanne audits are ordered by IT or engineering executives who have never launched a structured AI initiative. The audit exists precisely to avoid going in the wrong direction, accounting for real technical constraints of your sector.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Villeurbanne (69100) se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — ingénierie, IT, R&D, industrie matériaux, services.",
        whyHere: [
          "Villeurbanne est l'un de nos principaux terrains d'intervention IT et ingénierie en France : les équipes R&D du campus Doua (INSA, UCBL, Inria), les développeurs et intégrateurs IT de Gratte-Ciel et les collaborateurs industriels de FORVIA MATERI'ACT représentent des profils exigeants que nous accompagnons régulièrement.",
          "Tous les quartiers de Villeurbanne couverts en présentiel : Gratte-Ciel, campus LyonTech-La Doua, Carré de Soie, Charpennes, Cusset, Bonnevay. Nous venons dans vos locaux — sans supplément de zone.",
          "Le format collectif (1 journée) est calibré pour les PME IT et les équipes R&D de quelques personnes à une centaine de collaborateurs. Les ingénieurs et développeurs repartent avec des outils configurés sur leurs vrais projets.",
          "Le format Conférence convient aux plénières d'entreprise (auditoriums campus Doua, salles Carré de Soie, espaces Bel Air Camp).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des startups deep tech en phase de scale.",
          "Vocabulaire ajusté à votre secteur dominant : IT/numérique, ingénierie/R&D, matériaux/industrie, conseil ERP. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes techniques ingénierie ou IT — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports R&D, emails, spécifications techniques, tickets IT, données ERP) pour calibrer les démos sur VOS données villeurbannaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux villeurbannais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements campus avec VLANs sécurisés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle villeurbannaise — IT, R&D, matériaux, ERP.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau Gratte-Ciel, en labo campus Doua ou en télétravail.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Formation collective",
            detail:
              "Idéal pour indépendants, petites agences IT et micro-équipes villeurbannaises jusqu'à une dizaine de collaborateurs — Gratte-Ciel, Charpennes.",
          },
          {
            sizeLabel: "PME",
            price: "Format collectif ou Équipes",
            detail:
              "Format collectif pour le groupe entier ou Équipes pour focaliser sur un département — développeurs, R&D, commercial, opérations — particulièrement efficace pour les PME IT et intégrateurs ERP de Villeurbanne.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, campus Doua) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands comptes villeurbannais — roadshow multi-sites Métropole, séminaires CODIR + cascade équipes R&D ou ateliers industriels.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format collectif (1 journée) a collé parfaitement aux profils ingénieurs de notre équipe. Ils sont repartis avec leurs outils configurés sur leurs vrais documents techniques. Dès le lendemain, plusieurs les utilisaient pour rédiger des spécifications.",
            role: "Responsable technique",
            companyProfile: "PME IT, campus LyonTech-La Doua Villeurbanne",
          },
          {
            quote:
              "La session dirigeants nous a alignés rapidement sur notre stratégie IA. Le consultant connaissait nos contraintes sectorielles industrielles et R&D — aucune slide générique, des cas concrets sur nos données.",
            role: "Directrice générale",
            companyProfile: "ETI matériaux, Villeurbanne",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Villeurbanne ?",
            a: "Cela dépend du format choisi. Le format collectif (1 journée) se déroule sur une journée, le format approfondi (2 jours) sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans les locaux du campus LyonTech-La Doua ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des campus universitaires et des environnements R&D — accès badge, VLANs sécurisés, règles de confidentialité recherche. La préparation inclut un audit réseau/sécurité préalable si nécessaire.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur IT ou ingénierie villeurbannais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe R&D campus Doua n'a rien à voir avec une session pour un cabinet de conseil Gratte-Ciel.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur villeurbannais — IT, ingénierie, R&D, matériaux — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Villeurbanne (69100) come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — engineering, IT, R&D, materials industry, services.",
        whyHere: [
          "Villeurbanne is one of our top IT and engineering engagement grounds in France: R&D teams at campus Doua (INSA, UCBL, Inria), IT developers and integrators around Gratte-Ciel, and industrial staff at FORVIA MATERI'ACT are demanding profiles we regularly support.",
          "All Villeurbanne districts covered in person: Gratte-Ciel, LyonTech-La Doua campus, Carré de Soie, Charpennes, Cusset, Bonnevay. We come to your offices — no zone surcharge.",
          "The group format is calibrated for IT SMEs and R&D teams from a few people to about a hundred staff. Engineers and developers leave with tools configured for their real projects.",
          "The Talk format suits corporate plenaries (campus Doua auditoriums, Carré de Soie rooms, Bel Air Camp spaces).",
          "The Executives format enables in-camera framing for industrial mid-cap and deep tech startup executive committees in scale phase.",
          "Vocabulary adjusted to your dominant sector: IT/digital, engineering/R&D, materials/industry, ERP consulting. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including engineering or IT technical constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (R&D reports, emails, technical specs, IT tickets, ERP data) to calibrate demos on YOUR Villeurbanne data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Villeurbanne offices to check equipment, projection and network access. No technical hiccup on D-day, even in campus environments with secure VLANs.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Villeurbanne sector reality — IT, R&D, materials, ERP.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a Gratte-Ciel office, in a campus Doua lab or working remotely.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Group format",
            detail:
              "Ideal for Villeurbanne freelancers, small IT agencies and micro-teams up to about ten staff — Gratte-Ciel, Charpennes.",
          },
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department — developers, R&D, sales, operations — particularly effective for Villeurbanne IT SMEs and ERP integrators.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, campus Doua) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Villeurbanne large accounts — multi-site Métropole roadshows, exec committee seminars + R&D team or industrial workshop cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The group format perfectly matched our engineering team profiles. They left with tools configured for their real technical documents. By the next day, several were already using them to write specifications.",
            role: "Technical Lead",
            companyProfile: "IT SME, LyonTech-La Doua campus Villeurbanne",
          },
          {
            quote:
              "The executive session quickly aligned us on our AI strategy. The consultant knew our industrial and R&D constraints — no generic slides, concrete cases on our real data.",
            role: "CEO",
            companyProfile: "Materials mid-cap, Villeurbanne",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Villeurbanne take?",
            a: "It depends on the chosen format. The group format runs over a day, the two-day format over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions at LyonTech-La Doua campus?",
            a: "Yes. Our consultants adapt to university campus and R&D environment constraints — badge access, secure VLANs, research confidentiality rules. Preparation includes an upfront network/security review if needed.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Villeurbanne IT or engineering sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a campus Doua R&D team has nothing to do with one for a Gratte-Ciel consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Villeurbanne sector — IT, engineering, R&D, materials — no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Villeurbanne (69100) met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux villeurbannais — Gratte-Ciel, campus Doua, Carré de Soie ou tout autre quartier.",
        whyHere: [
          "Villeurbanne concentre une part croissante de nos missions d'implémentation IT et ingénierie : éditeurs logiciels, intégrateurs ERP SAP (TVH Consulting), équipes R&D campus Doua (INSA, UCBL, Inria) et ETI industrielles (FORVIA MATERI'ACT).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux villeurbannais : alignement des équipes, accès aux données techniques ou de production, validation des intégrations CRM/ERP/outils IT.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable technique.",
          "Recette finale toujours en présentiel à Villeurbanne : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire R&D ou en atelier industriel.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques villeurbannais : PME IT (agents support, copilotes développeurs, automatisation documentation), équipes R&D campus Doua (analyse données expérimentales, synthèse bibliographique, reporting), ETI industrielles (automatisation rapports qualité matériaux, gestion fournisseurs), intégrateurs ERP (assistant paramétrage SAP, qualification besoins clients).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Villeurbanne : revue de l'architecture cible (CRM, ERP SAP, outils IT, systèmes R&D, PLM), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Villeurbanne : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Villeurbanne : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE IT et indépendants villeurbannais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME IT, éditeurs logiciels, intégrateurs ERP et agences villeurbannaises de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP SAP, PLM, systèmes R&D), formation ambassadeurs cross-département. Adapté aux ETI industrielles et IT de Villeurbanne.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes villeurbannais ou Métropole de Lyon : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation d'un agent documentation technique livré comme promis. ROI mesuré dès les premières semaines : nos ingénieurs passent maintenant moins de temps sur les comptes-rendus et plus sur l'analyse produit.",
            role: "Directeur technique",
            companyProfile: "PME IT, quartier Gratte-Ciel Villeurbanne",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le campus Doua et le bureau Gratte-Ciel. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "Responsable innovation",
            companyProfile: "ETI R&D, campus LyonTech-La Doua Villeurbanne",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Villeurbanne ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions villeurbannaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données IT ou R&D restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs techniques sensibles (R&D, propriété industrielle, données clients), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données techniques critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (spécifications ingénierie critiques, données R&D propriétaires, dossiers réglementaires), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Villeurbanne (69100) brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Villeurbanne offices — Gratte-Ciel, campus Doua, Carré de Soie or any other district.",
        whyHere: [
          "Villeurbanne hosts a growing share of our IT and engineering implementation missions: software publishers, SAP ERP integrators (TVH Consulting), R&D teams at campus Doua (INSA, UCBL, Inria) and industrial mid-caps (FORVIA MATERI'ACT).",
          "Kick-off always happens in person at your Villeurbanne offices: team alignment, access to technical or production data, CRM/ERP/IT tool integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or technical lead.",
          "Final acceptance always in person in Villeurbanne: handover, team training on their workstations, runbook documentation delivered — whether in an office, R&D lab or industrial workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Villeurbanne cases: IT SMEs (support agents, developer copilots, documentation automation), campus Doua R&D teams (experimental data analysis, bibliographic synthesis, reporting), industrial mid-caps (materials quality report automation, supplier management), ERP integrators (SAP configuration assistant, client needs qualification).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Villeurbanne workshop: target architecture review (CRM, SAP ERP, IT tools, R&D systems, PLM), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Villeurbanne: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Villeurbanne: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Villeurbanne IT micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For IT SMEs, software publishers, ERP integrators and agencies in Villeurbanne from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (SAP ERP, PLM, R&D systems), cross-department ambassador training. Tailored for Villeurbanne industrial and IT mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Villeurbanne or Métropole de Lyon large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical documentation agent implementation delivered as promised. ROI measured within the first weeks: our engineers now spend less time on write-ups and more on product analysis.",
            role: "CTO",
            companyProfile: "IT SME, Gratte-Ciel district Villeurbanne",
          },
          {
            quote:
              "Perfect hybrid method for our team split between campus Doua and the Gratte-Ciel office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "Innovation Manager",
            companyProfile: "R&D mid-cap, LyonTech-La Doua campus Villeurbanne",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Villeurbanne take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Villeurbanne missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my IT or R&D data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For sensitive technical sectors (R&D, industrial IP, client data), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical technical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical engineering specs, proprietary R&D data, regulatory files), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "L'accompagnement individuel Axion-IA à Villeurbanne (69100) s'adresse aux dirigeants, fondateurs tech, chercheurs-entrepreneurs et managers IT qui veulent accélérer leur montée en compétence IA à leur propre rythme. Sessions 1-to-1 sur site ou hybrides, ajustées à votre rôle, votre secteur villeurbannais (IT, ingénierie, R&D, industrie) et vos cas d'usage réels.",
        whyHere: [
          "Villeurbanne concentre un vivier unique de profils tech avancés : fondateurs de startups deep tech (INSA Booster, Pulsalys), chercheurs-entrepreneurs campus Doua (CNRS, Inria, UCBL), directeurs IT de PME IT Gratte-Ciel, responsables R&D ETI industrielles.",
          "Le format 1-to-1 est adapté aux emplois du temps contraints : sessions planifiées selon votre disponibilité, pas de groupe, pas de programme figé — juste votre cas, votre rythme.",
          "Villeurbanne est notre terrain d'accompagnement individuel tech : la densité de profils ingénierie et IT génère des besoins spécifiques — IA appliquée au code, à la recherche, à la gestion de projet technique, à la veille technologique.",
          "Démos sur vos projets réels : on travaille sur vos documents, vos outils, votre stack technique. Pas de mise en scène pédagogique — vous repartez avec des habitudes et des outils installés.",
          "Progression mesurée : un point de départ diagnostiqué, des objectifs concrets, un suivi entre sessions pour ancrer les pratiques.",
          "Aucun lock-in : le programme s'arrête quand vous êtes autonome. Pas d'abonnement perpétuel, pas de renouvellement automatique.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Une session de cadrage pour évaluer votre niveau actuel sur l'IA, identifier vos cas d'usage prioritaires et définir un programme personnalisé adapté à votre rôle villeurbannais (dirigeant tech, chercheur, manager IT).",
          },
          {
            step: "Sessions thématiques 1-to-1",
            detail:
              "Selon votre programme, alternance de sessions pratiques sur vos outils réels et de points stratégiques sur votre trajectoire IA. Chaque session produit un livrable utilisable immédiatement.",
          },
          {
            step: "Travail entre sessions",
            detail:
              "Exercices appliqués à votre travail quotidien, accès à une base de ressources curatées. Points asynchrones courts entre sessions pour suivre vos avancées.",
          },
          {
            step: "Intégration aux outils",
            detail:
              "Installation et configuration des outils IA adaptés à votre profil (Claude, ChatGPT, Mistral, outils spécifiques engineering ou recherche). Vous repartez avec votre stack IA personnelle opérationnelle.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "Une session de clôture pour mesurer la progression, consolider les acquis et définir votre plan d'autonomie post-accompagnement. Pas de renouvellement automatique — vous décidez de la suite.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Programme individuel démarrage",
            detail:
              "Pour les indépendants, consultants et fondateurs villeurbannais en phase de démarrage — quelques sessions pour installer les bases et les outils.",
          },
          {
            sizeLabel: "PME",
            price: "Programme individuel accélération",
            detail:
              "Pour les dirigeants et managers de PME IT ou R&D souhaitant un accompagnement structuré sur plusieurs semaines avec suivi entre sessions.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme dirigeant ETI",
            detail:
              "Pour les directeurs généraux et CODIR de ETI villeurbannaises (industrie, IT, R&D) souhaitant cadrer leur posture et leur prise de décision IA en mode confidentiel.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme C-level sur mesure",
            detail:
              "Pour les C-level de grands groupes villeurbannais ou Métropole — programme entièrement personnalisé, accord de confidentialité renforcé, sessions sur site ou hybrides selon agenda.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'accompagnement 1-to-1 a transformé ma façon de travailler en quelques semaines. Je suis passé de 'je vois l'IA de loin' à 'je l'utilise chaque jour sur mes projets de recherche'. Axion-IA a compris mes contraintes de chercheur dès la première session.",
            role: "Chercheur-entrepreneur",
            companyProfile: "Spin-off deep tech, campus LyonTech-La Doua Villeurbanne",
          },
          {
            quote:
              "Format idéal pour un dirigeant avec un agenda chargé. Sessions planifiées à mon rythme, travail sur mes vrais dossiers. En quelques mois, j'ai une vision claire et des pratiques ancrées.",
            role: "Directeur général",
            companyProfile: "PME IT, Villeurbanne",
          },
        ],
        faq: [
          {
            q: "En quoi consiste l'accompagnement 1-to-1 Axion-IA à Villeurbanne ?",
            a: "C'est un programme individuel personnalisé pour dirigeants, fondateurs tech et managers IT : diagnostic initial, sessions thématiques 1-to-1, travail entre sessions sur vos vrais projets, installation des outils IA adaptés à votre profil. Rythme et contenu ajustés à votre agenda villeurbannais.",
          },
          {
            q: "Ce programme est-il adapté aux chercheurs-entrepreneurs du campus Doua ?",
            a: "Oui, c'est l'un de nos profils les plus fréquents à Villeurbanne. Les chercheurs-entrepreneurs des spin-offs INSA Booster ou Pulsalys ont des besoins spécifiques — IA appliquée à la recherche, valorisation des travaux, transition vers un rôle de dirigeant tech. Nous adaptons le programme à ces réalités.",
          },
          {
            q: "Combien de sessions sont nécessaires pour être autonome ?",
            a: "Cela dépend de votre point de départ et de vos objectifs. Le diagnostic initial permet de cadrer le programme. Nous visons l'autonomie la plus rapide possible — aucun intérêt à prolonger artificiellement.",
          },
          {
            q: "Les sessions se tiennent-elles à Villeurbanne ou à distance ?",
            a: "Les deux sont possibles. Les sessions sur site à Villeurbanne (vos locaux, campus Doua, ou espace partagé) sont privilégiées pour les phases pratiques avec vos outils réels. Les sessions stratégiques et de suivi peuvent être en visio.",
          },
          {
            q: "Ce programme est-il confidentiel ?",
            a: "Oui. Confidentialité stricte dès le démarrage. Vos projets, vos données et le contenu de nos sessions restent strictement confidentiels. Particulièrement important pour les fondateurs tech en phase de développement de produit.",
          },
          {
            q: "Peut-on démarrer rapidement à Villeurbanne ?",
            a: "Oui. Un premier échange de cadrage peut se tenir dans les jours suivant votre demande. Le programme démarre dès que le brief initial est validé et la confidentialité assurée.",
          },
        ],
        guarantees:
          "Programme calibré à votre rythme et vos objectifs — pas de contenu recyclé générique. Confidentialité garantie (Confidentialité stricte). Outils opérationnels après chaque session : vous repartez avec des habitudes et une stack IA installée. Si après le diagnostic initial vous estimez que le programme ne correspond pas à vos besoins, remboursement intégral de la session diagnostique.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Villeurbanne (69100) targets executives, tech founders, researcher-entrepreneurs and IT managers who want to accelerate their AI skills at their own pace. 1-to-1 sessions on site or hybrid, tailored to your role, your Villeurbanne sector (IT, engineering, R&D, industry) and your real use cases.",
        whyHere: [
          "Villeurbanne hosts a unique pool of advanced tech profiles: deep tech startup founders (INSA Booster, Pulsalys), researcher-entrepreneurs at campus Doua (CNRS, Inria, UCBL), IT directors at Gratte-Ciel IT SMEs, R&D managers at industrial mid-caps.",
          "The 1-to-1 format fits constrained schedules: sessions planned to your availability, no group, no fixed curriculum — just your case, your pace.",
          "Villeurbanne is our main individual tech coaching ground: the density of engineering and IT profiles generates specific needs — AI applied to code, research, technical project management, technology watch.",
          "Demos on your real projects: we work on your documents, your tools, your tech stack. No pedagogical staging — you leave with habits and installed tools.",
          "Measured progression: a diagnosed starting point, concrete objectives, follow-up between sessions to anchor practices.",
          "No lock-in: the programme stops when you're autonomous. No perpetual subscription, no automatic renewal.",
        ],
        methodology: [
          {
            step: "Initial diagnostic",
            detail:
              "A framing session to assess your current AI level, identify your priority use cases and define a personalised programme tailored to your Villeurbanne role (tech executive, researcher, IT manager).",
          },
          {
            step: "1-to-1 thematic sessions",
            detail:
              "Depending on your programme, alternation of hands-on sessions on your real tools and strategic discussions on your AI trajectory. Each session produces an immediately usable deliverable.",
          },
          {
            step: "Between-session work",
            detail:
              "Exercises applied to your daily work, access to a curated resource base. Short asynchronous check-ins between sessions to track your progress.",
          },
          {
            step: "Tool integration",
            detail:
              "Installation and configuration of AI tools suited to your profile (Claude, ChatGPT, Mistral, engineering or research-specific tools). You leave with your personal AI stack operational.",
          },
          {
            step: "Review and autonomy",
            detail:
              "A closing session to measure progression, consolidate achievements and define your post-coaching autonomy plan. No automatic renewal — you decide what comes next.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual starter programme",
            detail:
              "For Villeurbanne freelancers, consultants and founders in early stage — a few sessions to install foundations and tools.",
          },
          {
            sizeLabel: "SME",
            price: "Individual acceleration programme",
            detail:
              "For executives and managers of IT or R&D SMEs seeking a structured engagement over several weeks with between-session follow-up.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive programme",
            detail:
              "For CEOs and executive committees of Villeurbanne mid-caps (industry, IT, R&D) seeking to frame their AI posture and decision-making in confidential mode.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Bespoke C-level programme",
            detail:
              "For C-level at Villeurbanne or Métropole large accounts — fully personalised programme, enhanced Strict confidentiality, on-site or hybrid sessions per schedule.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching transformed my way of working within a few weeks. I went from 'I see AI from afar' to 'I use it every day on my research projects'. Axion-IA understood my researcher constraints from the very first session.",
            role: "Researcher-entrepreneur",
            companyProfile: "Deep tech spin-off, LyonTech-La Doua campus Villeurbanne",
          },
          {
            quote:
              "Ideal format for an executive with a packed agenda. Sessions planned at my pace, working on my real files. Within a few months I have clear vision and anchored practices.",
            role: "CEO",
            companyProfile: "IT SME, Villeurbanne",
          },
        ],
        faq: [
          {
            q: "What does Axion-IA's 1-to-1 coaching in Villeurbanne involve?",
            a: "It's a personalised individual programme for executives, tech founders and IT managers: initial diagnostic, 1-to-1 thematic sessions, between-session work on your real projects, installation of AI tools suited to your profile. Pace and content adjusted to your Villeurbanne schedule.",
          },
          {
            q: "Is this programme suited to researcher-entrepreneurs from campus Doua?",
            a: "Yes, it's one of our most common profiles in Villeurbanne. Researcher-entrepreneurs from INSA Booster or Pulsalys spin-offs have specific needs — AI applied to research, work valorisation, transition to a tech executive role. We tailor the programme to these realities.",
          },
          {
            q: "How many sessions are needed to become autonomous?",
            a: "It depends on your starting point and objectives. The initial diagnostic frames the programme. We aim for the fastest possible autonomy — no interest in artificially prolonging the engagement.",
          },
          {
            q: "Do sessions take place in Villeurbanne or remotely?",
            a: "Both are possible. On-site sessions in Villeurbanne (your offices, campus Doua, or shared space) are preferred for practical phases with your real tools. Strategic and follow-up sessions can be on video.",
          },
          {
            q: "Is this programme confidential?",
            a: "Yes. Strict confidentiality ensured from kick-off. Your projects, your data and our session content remain strictly confidential. Particularly important for tech founders in product development phase.",
          },
          {
            q: "Can we start quickly in Villeurbanne?",
            a: "Yes. A first framing exchange can take place within days of your request. The programme starts as soon as the initial brief is validated and the Strict confidentiality ensured.",
          },
        ],
        guarantees:
          "Programme calibrated to your pace and objectives — no recycled generic content. Confidentiality guaranteed (Strict confidentiality). Operational tools after each session: you leave with habits and an installed AI stack. If after the initial diagnostic you feel the programme does not match your needs, full refund of the diagnostic session.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Villeurbanne des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Villeurbanne, itérations à distance.",
        whyHere: [
          "Projets web & SaaS villeurbannais : campus LyonTech-La Doua (INSA, CPE, UCBL, CNRS, Inria), intégrateurs IT & PME tech, industrie (FORVIA MATERI'ACT), startups du Carré de Soie — distinctement de Lyon.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Écosystème tech & recherche : plateformes IA-native, RAG, agents — on parle le langage technique de La Doua. Hébergement UE souverain, RGPD strict.",
        ],
        methodology: [
          {
            step: "Cadrage à Villeurbanne",
            detail:
              "Atelier sur site : objectifs, parcours utilisateurs, audit de la stack et des contenus. Devis ferme à partir de 24-48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; prototype testé avant tout développement.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : chatbot RAG, search, agents, e-commerce. Démos hebdomadaires.",
          },
          {
            step: "Recette + mise en ligne",
            detail:
              "Tests d'acceptation, Web Vitals et SEO/AEO validés, mise en production sans downtime.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code, bases et modèles livrés chez vous (hébergement UE possible). Aucun abonnement imposé : c'est à vous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Brique IA greffée",
            detail:
              "Ajout d'une brique IA (chatbot RAG, recherche sémantique) sur un site existant en quelques semaines, sans refonte.",
          },
          {
            sizeLabel: "PME",
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour startups, intégrateurs IT et PME villeurbannaises.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, deeptech ou portail client sur mesure, IA intégrée, branchée sur votre SI (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels : refonte de plateformes, design system d'entreprise, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Faites-vous vraiment l'UX/UI et le design, pas seulement l'IA ?",
            a: "Oui. On conçoit l'expérience complète à Villeurbanne — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous travaillez avec l'écosystème tech & recherche de La Doua ?",
            a: "Oui : plateformes IA-native, RAG, agents et recherche sémantique pour startups, intégrateurs IT et spin-offs issues d'INSA, CPE, UCBL et Inria. On parle le langage technique de La Doua. Hébergement UE souverain, RGPD strict.",
          },
          {
            q: "Peut-on augmenter un site existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API ou un flux de données. Aucune refonte ni downtime.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage, on remet un devis ferme en forfait fixe. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple, davantage pour une plateforme étendue. Pas de régie, pas de dérive horaire cachée.",
          },
          {
            q: "Avec quelles technologies travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. On choisit la meilleure stack selon vos objectifs et on s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région lyonnaise ou repris en interne.",
      },
      en: {
        hero: "In Villeurbanne, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Villeurbanne kick-off, remote iterations.",
        whyHere: [
          "Villeurbanne web & SaaS projects: LyonTech-La Doua campus (INSA, CPE, UCBL, CNRS, Inria), IT integrators & tech SMEs, industry (FORVIA MATERI'ACT), Carré de Soie startups — distinctly from Lyon.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Tech & research ecosystem: AI-native platforms, RAG, agents — we speak the technical language of La Doua. Sovereign EU hosting, strict GDPR.",
        ],
        methodology: [
          {
            step: "Scoping in Villeurbanne",
            detail:
              "On-site workshop: goals, journeys, audit of the existing stack and content. Firm quote from 24-48 h depending on complexity.",
          },
          {
            step: "UX/UI design",
            detail:
              "Wireframes, design system and Figma mockups in your brand; prototype tested before any development.",
          },
          {
            step: "Development in sprints",
            detail:
              "AI grafted onto the existing site or AI-native build: RAG chatbot, search, agents, e-commerce. Weekly demos.",
          },
          {
            step: "Acceptance + go-live",
            detail:
              "Acceptance tests, Web Vitals and SEO/AEO validated, production release without downtime.",
          },
          {
            step: "Delivery + autonomy",
            detail:
              "Code, databases and models delivered into your infra (EU hosting possible). No imposed subscription: it's yours.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Grafted AI brick",
            detail:
              "Adding an AI brick (RAG chatbot, semantic search) onto an existing site in a few weeks, no rebuild.",
          },
          {
            sizeLabel: "SME",
            price: "Bespoke site / app",
            detail:
              "Design or rebuild of a site or app with UX/UI and built-in AI, for startups, IT integrators and Villeurbanne SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, deeptech or customer portal platform, AI built in, wired into your IS (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Product programme",
            detail:
              "Multi-year programmes: platform rebuilds, enterprise design system, dedicated Axion-IA product team.",
          },
        ],
        faq: [
          {
            q: "Do you really do UX/UI and design, not just AI?",
            a: "Yes. We design the full experience in Villeurbanne — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you work with the La Doua tech & research ecosystem?",
            a: "Yes: AI-native platforms, RAG, agents and semantic search for startups, IT integrators and spin-offs from INSA, CPE, UCBL and Inria. We speak the technical language of La Doua. Sovereign EU hosting, strict GDPR.",
          },
          {
            q: "Can you augment an existing site without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft the AI bricks via an API, a widget or a plugin, without touching the design or structure, as long as your CMS exposes an API or data feed. No rebuild, no downtime.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After scoping, we deliver a firm quote on a fixed package. Turnaround depends on complexity — from 24-48 h for a simple project, more for an extended platform. No time-and-materials, no hidden hourly drift.",
          },
          {
            q: "Which technologies do you work with?",
            a: "Any modern stack exposing an API: WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. We pick the best stack for your goals and adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Lyon-area provider or taken in-house.",
      },
    },
  },
};
