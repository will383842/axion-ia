// Mulhouse (68224) — contenu éditorial (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/mulhouse.ts (Sprint City Quality V3, ville #38).
// Réalités locales : Stellantis Mulhouse (Île Napoléon, ex-PSA depuis 1962),
// Pôle Véhicule du Futur (Bourtzwiller), Clemessy (siège, groupe Eiffage),
// Wärtsilä France, DMC (héritage textile), KMØ campus numérique,
// SEMIA incubateur Grand Est, IRIMAS (IA/informatique UHA),
// UHA + ENSISA + ENSCMu, position trinationale France-Suisse-Allemagne,
// EuroAirport Bâle-Mulhouse-Freiburg, Biovalley, Parc des Collines.

import type { VilleCopy } from "./types";

export const MULHOUSE_COPY: VilleCopy = {
  pitchFr:
    "Mulhouse regroupe 3 724 établissements actifs, une position trinationale unique (France-Suisse-Allemagne), le Pôle Véhicule du Futur, l'usine Stellantis historique depuis 1962, le siège Clemessy (Eiffage) et un campus numérique KMØ actif. Axion-IA y intervient sur site, des TPE alsaciennes aux ETI industrielles et aux groupes transfrontaliers du bassin rhénan.",
  pitchEn:
    "Mulhouse hosts 3,724 active businesses, a unique tri-national position (France-Switzerland-Germany), the Pôle Véhicule du Futur, the historic Stellantis plant since 1962, Clemessy's HQ (Eiffage) and an active KMØ digital campus. Axion-IA delivers on site, from Alsatian micro-businesses to industrial mid-caps and cross-border groups across the Rhine basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Mulhouse : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du cabinet mulhousien à l'ETI automobile ou industrielle du bassin Haut-Rhin.",
      en: "Operational AI audit in Mulhouse: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Mulhouse practices to industrial mid-caps in the Haut-Rhin basin.",
    },
    interventions: {
      fr: "Interventions IA à Mulhouse : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Mulhouse: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Mulhouse : on déploie l'IA dans vos outils existants (CRM, ERP, systèmes de production, outils ingénierie) avec ROI chiffré contractuel. Position trinationale prise en compte pour les contraintes RGPD et souveraineté données.",
      en: "AI implementation in Mulhouse: we deploy AI into your existing tools (CRM, ERP, production systems, engineering tools) with contractually-costed ROI. Tri-national position taken into account for GDPR and data sovereignty constraints.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Mulhouse : programme 1-to-1 pour dirigeants et cadres du bassin mulhousien souhaitant structurer leur stratégie IA personnelle, en présentiel ou hybride sur le bassin Haut-Rhin.",
      en: "Individual AI coaching in Mulhouse: 1-to-1 program for Mulhouse basin executives and managers looking to structure their personal AI strategy, in person or hybrid across the Haut-Rhin basin.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI mulhousiennes — site vitrine premium pour automobile, industrie et chimie, espace client trinational FR/DE/EN, dashboard connecté à votre CRM/ERP et systèmes de production. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Mulhouse SMEs and mid-caps — premium showcase site for automotive, industry and chemicals, tri-national FR/DE/EN customer space, dashboard connected to your CRM/ERP and production systems. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Mulhouse (68) sur site — centre-ville, Parc des Collines, Technoparc Bourtzwiller, Zone Industrielle Île Napoléon et communes du bassin (Riedisheim, Kingersheim, Illzach, Pfastatt). Nous accompagnons les TPE, PME, ETI et grandes entreprises mulhousiennes (automobile, industrie, chimie, numérique, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Position trinationale et contraintes RGPD transfrontalières maîtrisées.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Mulhouse (68) on site — city centre, Parc des Collines, Technoparc Bourtzwiller, Zone Industrielle Île Napoléon and basin communes (Riedisheim, Kingersheim, Illzach, Pfastatt). We support Mulhouse micro-businesses, SMEs, mid-caps and large enterprises (automotive, industry, chemicals, digital, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. Tri-national position and cross-border GDPR constraints handled.",

  seoHook: "automotive, textile & transfrontalier",

  topSectorsNaf: [
    "Automobile & Mobilité du futur",
    "Industrie manufacturière & Mécatronique",
    "Chimie, Matériaux & Génie des procédés",
    "Commerce & Services aux entreprises",
    "Santé, Biotech & Sciences de la vie (Biovalley)",
    "Numérique & Industrie 4.0",
  ],

  distancesFr:
    "Gare de Mulhouse-Ville en cœur de ville — TGV Rhin-Rhône (Paris ~2h40), TER 200 vers Strasbourg (~50 min), ICE Allemagne. EuroAirport Bâle-Mulhouse-Freiburg (BSL) à 25 km — aéroport trinational France-Suisse-Allemagne. Réseau Soléa 3 lignes de tramway + bus pour desservir Parc des Collines, Bourtzwiller, Île Napoléon et les communes du bassin.",
  distancesEn:
    "Mulhouse-Ville station in city centre — TGV Rhin-Rhône (Paris ~2h40), TER 200 to Strasbourg (~50 min), ICE Germany. EuroAirport Basel-Mulhouse-Freiburg (BSL) 25 km away — tri-national airport for France, Switzerland and Germany. Soléa network 3 tram lines + buses to reach Parc des Collines, Bourtzwiller, Île Napoléon and all basin communes.",

  ecosystemFr:
    "Tissu B2B industriel et technologique dense — 3 724 établissements actifs. Pôle automobile Stellantis Île Napoléon (ex-PSA, depuis 1962), Pôle Véhicule du Futur Bourtzwiller, ingénierie industrielle Clemessy (siège Eiffage), campus numérique KMØ, technopôle Parc des Collines, incubateur SEMIA Grand Est, UHA + ENSISA + ENSCMu, IRIMAS (IA/informatique CNRS), Alsace BioValley, port rhénan PortAlsace, position trinationale Bâle-Fribourg.",
  ecosystemEn:
    "Dense industrial and tech B2B fabric — 3,724 active businesses. Stellantis automotive hub at Île Napoléon (ex-PSA, since 1962), Pôle Véhicule du Futur at Bourtzwiller, Clemessy industrial engineering (Eiffage HQ), KMØ digital campus, Parc des Collines technopole, SEMIA Grand Est incubator, UHA + ENSISA + ENSCMu universities, IRIMAS (AI/computer science CNRS), Alsace BioValley, Rhine port PortAlsace, tri-national Basel-Freiburg position.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Mulhouse ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Mulhouse et partout en France.",
    },
    {
      q: "Axion-IA intervient-il dans les entreprises industrielles du bassin Haut-Rhin ?",
      a: "Oui. Nos consultants couvrent l'ensemble du bassin mulhousien : Mulhouse intra-muros, Riedisheim, Kingersheim, Illzach, Pfastatt, Lutterbach, Brunstatt-Didenheim, Rixheim et les zones industrielles (Île Napoléon, Parc des Collines, Bourtzwiller). Aucun supplément de zone.",
    },
    {
      q: "Comment Axion-IA prend-il en compte la dimension trinationale de Mulhouse ?",
      a: "La position trinationale France-Suisse-Allemagne est prise en compte dès le cadrage : contraintes RGPD transfrontalières, choix des modèles IA compatibles souveraineté, gestion des données dans un contexte multi-juridictions. Nos missions incluent une revue spécifique pour les entreprises avec flux de données vers Bâle ou Fribourg.",
    },
    {
      q: "Travaillez-vous avec les acteurs de l'automobile et de la mobilité à Mulhouse ?",
      a: "Oui. Le secteur automobile et mobilité du futur est l'un de nos domaines prioritaires à Mulhouse : sous-traitants Stellantis, membres du Pôle Véhicule du Futur, équipementiers et fournisseurs de l'écosystème automobile Haut-Rhin. Cas d'usage typiques : automatisation rapports qualité, optimisation planification production, qualification appels d'offres.",
    },
    {
      q: "Pouvez-vous accompagner les startups et PME numériques de KMØ ou SEMIA ?",
      a: "Oui. Nous accompagnons les startups et scale-ups du campus KMØ, de l'incubateur SEMIA Grand Est et de la Technopole de la Région Mulhousienne. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel, avec ROI chiffré contractuel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Mulhouse ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Vos interventions couvrent-elles aussi la chimie et les matériaux (ENSCMu, IS2M) ?",
      a: "Oui. La chimie, les matériaux et le génie des procédés sont des secteurs que nous maîtrisons dans le bassin mulhousien — ENSCMu, IS2M (CNRS), Bioeconomy For Change, Fibres-Energivie. Cas d'usage : analyse de données de formulation, documentation technique automatisée, recherche bibliographique IA sur corpus scientifiques.",
    },
  ],

  // === SERVICES LONG-FORM MULHOUSE ===
  // Même structure que paris.ts / lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise mulhousienne et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre-ville aux ETI automobiles de l'Île Napoléon, aux ingénieries industrielles de Bourtzwiller et aux acteurs chimie et matériaux du Haut-Rhin.",
        whyHere: [
          "Mulhouse concentre un tissu industriel dense et diversifié — automobile (Stellantis, Pôle Véhicule du Futur), ingénierie électrique et industrielle (Clemessy), chimie et matériaux (ENSCMu, IS2M), numérique (KMØ) — qui génère une forte demande d'audits IA opérationnels ciblés.",
          "Position trinationale maîtrisée : nos audits intègrent les contraintes RGPD transfrontalières France-Suisse-Allemagne, la sélection de modèles IA compatibles souveraineté et la gestion des flux de données vers Bâle ou Fribourg.",
          "Nos consultants se déplacent sur l'ensemble du bassin mulhousien : Mulhouse intra-muros, Riedisheim, Kingersheim, Illzach, Pfastatt, Lutterbach, Brunstatt-Didenheim, Rixheim et les zones industrielles.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux mulhousiens, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI industrielles mulhousiennes avec des workflows complexes multi-sites (production, ingénierie, supply chain transfrontalière).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Mulhouse dans vos locaux — centre-ville, Parc des Collines, Technoparc Bourtzwiller, Île Napoléon ou commune du bassin — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (production, qualité, R&D, commercial, finance, direction) pour cartographier les frictions et les attentes, en tenant compte des spécificités sectorielles mulhousiennes (protocoles automobile, contraintes qualité industrie, compliance RGPD transfrontalière).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos rapports qualité, vos emails, vos cahiers des charges, vos données de production. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux mulhousiens. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur — automobile, industrie, chimie ou numérique.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets mulhousiens jusqu'à une dizaine de collaborateurs — centre-ville, Quartier DMC, Bourtzwiller.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques KMØ, sous-traitants automobile, bureaux d'études, agences et éditeurs logiciels de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (ingénierie Clemessy, équipementiers automobile, chimie Haut-Rhin) ou ETI tertiaires souhaitant cadrer une trajectoire IA pluriannuelle intégrant la dimension transfrontalière.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes implantés dans le bassin mulhousien (Stellantis Île Napoléon, Wärtsilä, Sew-Usocome) ou dont les flux traversent le trinational.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit Axion-IA nous a permis de prioriser trois chantiers IA concrets en quelques semaines. Le livrable chiffré est directement présentable au conseil de groupe, avec une vision claire des cas prioritaires dans notre environnement industriel transfrontalier.",
            role: "Directeur général",
            companyProfile: "ETI industrie, bassin mulhousien",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données de production réelles. Les consultants connaissaient nos contraintes spécifiques automobile — pas de présentation générique. On est repartis avec un plan d'action applicable dès le trimestre suivant.",
            role: "Directeur industriel",
            companyProfile: "PME équipementier automobile, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Mulhouse ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une ETI industrielle mulhousienne ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité automobile, suivi de production, qualification appels d'offres, lecture plans et normes techniques). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou transfrontalières restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les entreprises mulhousiennes avec des flux France-Suisse-Allemagne, nous appliquons dès la sélection des modèles IA les contraintes souveraineté et les exigences RGPD transfrontalières.",
          },
          {
            q: "Comment se déroule la restitution finale à Mulhouse ?",
            a: "Toujours en présentiel dans vos locaux mulhousiens. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes du bassin (Riedisheim, Kingersheim, Illzach) ?",
            a: "Oui. Le bassin mulhousien entier est notre zone d'intervention : Riedisheim (2 km), Kingersheim (3 km), Illzach (4 km), Pfastatt (5 km), Lutterbach (6 km), Brunstatt-Didenheim (7 km), Rixheim (8 km) et les zones industrielles. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits mulhousiens sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs industriels réglementés ou transfrontaliers.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Gestion spécifique des flux transfrontaliers France-Suisse-Allemagne selon votre contexte. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Mulhouse business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Mulhouse micro-businesses to large industrial mid-caps at Île Napoléon, Bourtzwiller engineering firms and Haut-Rhin chemicals and materials players.",
        whyHere: [
          "Mulhouse concentrates a dense, diversified industrial fabric — automotive (Stellantis, Pôle Véhicule du Futur), electrical and industrial engineering (Clemessy), chemicals and materials (ENSCMu, IS2M), digital (KMØ) — driving strong demand for targeted operational AI audits.",
          "Tri-national position mastered: our audits integrate France-Switzerland-Germany cross-border GDPR constraints, AI model sovereignty selection and data flow management towards Basel or Freiburg.",
          "Our consultants travel across the full Mulhouse basin: city centre, Riedisheim, Kingersheim, Illzach, Pfastatt, Lutterbach, Brunstatt-Didenheim, Rixheim and the industrial zones.",
          "Read-outs always in person: ideation workshops at your Mulhouse offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Mulhouse industrial mid-caps with complex multi-site workflows (production, engineering, cross-border supply chain).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Mulhouse at your offices — city centre, Parc des Collines, Technoparc Bourtzwiller, Île Napoléon or a basin commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (production, quality, R&D, sales, finance, leadership) to map frictions and expectations, accounting for Mulhouse sector specifics (automotive protocols, industrial quality constraints, cross-border GDPR compliance).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your quality reports, emails, specifications, production data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Mulhouse offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector — automotive, industry, chemicals or digital.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Mulhouse freelancers, micro-firms and practices up to about ten staff — city centre, Quartier DMC, Bourtzwiller.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs at KMØ, automotive sub-contractors, engineering firms, agencies and software publishers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (Clemessy engineering, automotive equipment suppliers, Haut-Rhin chemicals) or tertiary mid-caps framing a multi-year AI trajectory including the cross-border dimension.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups based in the Mulhouse basin (Stellantis Île Napoléon, Wärtsilä, Sew-Usocome) or whose data flows cross the tri-national zone.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Axion-IA audit let us prioritise three concrete AI initiatives within a few weeks. The costed deliverable is directly presentable to the group board, with a clear view of priority cases in our cross-border industrial environment.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Mulhouse basin",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data. The consultants understood our specific automotive constraints — no generic presentation. We left with an action plan applicable from the very next quarter.",
            role: "Industrial Director",
            companyProfile: "Automotive equipment supplier SME, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Mulhouse?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Mulhouse?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (automotive quality reports, production tracking, tender qualification, technical plan and norm reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my industrial or cross-border data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For Mulhouse businesses with France-Switzerland-Germany flows, we apply sovereignty constraints and cross-border GDPR requirements at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Mulhouse?",
            a: "Always in person at your Mulhouse offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover basin communes (Riedisheim, Kingersheim, Illzach)?",
            a: "Yes. The full Mulhouse basin is our territory: Riedisheim (2 km), Kingersheim (3 km), Illzach (4 km), Pfastatt (5 km), Lutterbach (6 km), Brunstatt-Didenheim (7 km), Rixheim (8 km) and the industrial zones. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Mulhouse audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated industrial or cross-border sectors.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. Specific management of France-Switzerland-Germany cross-border flows per your context. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Mulhouse se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en atelier, en bureau d'études, en laboratoire ou sur le terrain transfrontalier. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Mulhouse est un terrain d'intervention industriel de premier plan pour Axion-IA : ETI et PME automobiles (Stellantis, équipementiers Île Napoléon), ingénieries (Clemessy), acteurs numérique (KMØ) et entreprises transfrontalières représentent une part significative de nos sessions.",
          "Toutes les zones du bassin couvertes en présentiel : centre-ville, Parc des Collines, Technoparc Bourtzwiller, Île Napoléon, Quartier DMC et communes (Riedisheim, Kingersheim, Illzach, Pfastatt).",
          "Le format Essentielle est calibré pour les structures mulhousiennes de quelques personnes à une centaine de collaborateurs, en particulier les PME industrielles et les bureaux d'études.",
          "Le format Conférence convient aux plénières d'entreprise mulhousiennes et aux événements du Parc Expo ou du KMØ.",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des groupes transfrontaliers.",
          "Vocabulaire ajusté à votre secteur dominant : automobile, industrie/mécatronique, chimie/matériaux, numérique, services B2B. Dimension transfrontalière intégrée si pertinente.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur — notamment les contraintes réglementaires automobile ou industrie — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, plans techniques, emails, données de production, cahiers des charges) pour calibrer les démos sur VOS données mulhousiennes.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux mulhousiens pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes déconnectés ou réseaux VLAN sécurisés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle mulhousienne — pas de session générique recyclée.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit en atelier industriel, en bureau d'études ou en itinérance transfrontalière.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites structures mulhousiennes jusqu'à une dizaine de collaborateurs — centre-ville, Quartier DMC, Bourtzwiller.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — production, qualité, R&D, commerce, finance — particulièrement efficace pour les PME industrielles et sous-traitants automobile.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, acteurs automobile) ou huis-clos comité de direction selon votre objectif stratégique et votre contexte transfrontalier.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges mulhousiens — roadshow multi-sites bassin Haut-Rhin, séminaires CODIR + cascade équipes terrain, ateliers usine ou laboratoires.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement répondu aux attentes de nos ingénieurs. Ils sont repartis avec leurs outils configurés sur leurs vrais documents techniques. Dès le lendemain, plusieurs les utilisaient pour rédiger des comptes-rendus et analyser des plans.",
            role: "Directeur technique",
            companyProfile: "PME bureau d'études, bassin mulhousien",
          },
          {
            quote:
              "La session dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes automobiles et transfrontalières — une session concrète, pas de slides génériques.",
            role: "DG",
            companyProfile: "ETI équipementier automobile, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Mulhouse ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels ou ateliers de production ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels mulhousiens — postes déconnectés, VLAN sécurisés, protocoles accès site, contraintes automobile et chimie. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur automobile ou à la dimension transfrontalière ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un sous-traitant Stellantis n'a rien à voir avec une session pour un cabinet conseil ou une PME numérique KMØ.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur mulhousien — automobile, industrie, chimie, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Mulhouse come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on the shop floor, in the engineering office, in the laboratory or in cross-border fieldwork. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Mulhouse is a prime industrial engagement ground for Axion-IA: automotive mid-caps and SMEs (Stellantis, Île Napoléon suppliers), engineering firms (Clemessy), digital players (KMØ) and cross-border companies represent a significant share of our sessions.",
          "All basin zones covered in person: city centre, Parc des Collines, Technoparc Bourtzwiller, Île Napoléon, Quartier DMC and communes (Riedisheim, Kingersheim, Illzach, Pfastatt).",
          "The Essential format is calibrated for Mulhouse structures from a few people to about a hundred staff, particularly industrial SMEs and engineering firms.",
          "The Talk format suits Mulhouse corporate plenaries and events at Parc Expo or KMØ.",
          "The Executives format enables in-camera framing for industrial mid-cap and cross-border group executive committees.",
          "Vocabulary adjusted to your dominant sector: automotive, industry/mechatronics, chemicals/materials, digital, B2B services. Cross-border dimension integrated where relevant.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including automotive or industrial regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, technical plans, emails, production data, specifications) to calibrate demos on YOUR Mulhouse data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Mulhouse offices to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with air-gapped workstations or secure VLANs.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Mulhouse sector reality — no recycled generic session.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether in an industrial workshop, engineering office or cross-border fieldwork.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Mulhouse freelancers, practices and small firms up to about ten staff — city centre, Quartier DMC, Bourtzwiller.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — production, quality, R&D, sales, finance — particularly effective for industrial SMEs and automotive sub-contractors.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, automotive players) or in-camera executive committee depending on your strategic objective and cross-border context.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Mulhouse HQs — multi-site Haut-Rhin basin roadshows, exec committee seminars + shop floor or lab cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly met our engineers' expectations. They left with tools configured for their real technical documents. By the next day, several were already using them to write reports and analyse technical plans.",
            role: "Technical Director",
            companyProfile: "Engineering firm SME, Mulhouse basin",
          },
          {
            quote:
              "The executive session aligned us within a day on our AI trajectory. The consultant understood our automotive and cross-border constraints — a concrete session, no generic slides.",
            role: "CEO",
            companyProfile: "Automotive equipment supplier mid-cap, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Mulhouse take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in industrial environments or production workshops?",
            a: "Yes. Our consultants adapt to Mulhouse industrial environment constraints — air-gapped workstations, secure VLANs, site access protocols, automotive and chemical constraints. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the automotive sector or the cross-border dimension?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Stellantis sub-contractor has nothing to do with one for a KMØ digital SME or a consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Mulhouse sector — automotive, industry, chemicals, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Mulhouse met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux mulhousiens — centre-ville, Parc des Collines, Technoparc Bourtzwiller ou Île Napoléon. Position trinationale et contraintes RGPD transfrontalières intégrées dès la conception.",
        whyHere: [
          "Mulhouse concentre une part croissante de nos missions d'implémentation, principalement dans l'industrie automobile (équipementiers Île Napoléon, sous-traitants Stellantis), l'ingénierie (Clemessy), la chimie et matériaux (ENSCMu) et le numérique (KMØ, SEMIA).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux mulhousiens : alignement des équipes, accès aux données de production ou d'ingénierie, validation des intégrations CRM/ERP/systèmes industriels.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Mulhouse : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en atelier ou en laboratoire.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques mulhousiens : ETI automobile (automatisation rapports qualité, optimisation ordonnancement), PME ingénierie (rédaction automatique de rapports techniques, analyse plans), cabinets et bureaux d'études (qualification prospects, génération documents contractuels), startups KMØ (agents support, copilotes développeurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Mulhouse : revue de l'architecture cible (CRM, ERP, MES, outils ingénierie, systèmes industriels), validation des contraintes RGPD/sécurité et transfrontalières, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Mulhouse : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Mulhouse : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants mulhousiens.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME industrielles, bureaux d'études, sous-traitants automobile, acteurs numérique KMØ de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, MES, PLM), formation ambassadeurs cross-département. Adapté aux ETI automobiles, ingénieries et groupes transfrontaliers mulhousiens.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes du bassin mulhousien : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie, intégration dimension transfrontalière.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation rapports qualité livrée comme promis. ROI mesuré dès les premiers mois : nos ingénieurs passent moins de temps sur les rapports administratifs et plus sur l'amélioration des processus. Aucun lock-in, on contrôle notre déploiement.",
            role: "Directeur qualité",
            companyProfile: "ETI équipementier automobile, bassin mulhousien",
          },
          {
            quote:
              "Mode hybride parfait pour notre équipe entre l'atelier et le bureau. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome depuis la fin de mission.",
            role: "CTO",
            companyProfile: "PME ingénierie industrielle, Mulhouse",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Mulhouse ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions mulhousiennes. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles ou transfrontalières restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les entreprises mulhousiennes avec des flux France-Suisse-Allemagne, nous appliquons les contraintes souveraineté et conformité transfrontalière dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données industrielles critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (pièces critiques, dossiers réglementaires, données de sécurité), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Gestion spécifique des contraintes transfrontalières France-Suisse-Allemagne. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Mulhouse brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Mulhouse offices — city centre, Parc des Collines, Technoparc Bourtzwiller or Île Napoléon. Tri-national position and cross-border GDPR constraints integrated at design stage.",
        whyHere: [
          "Mulhouse hosts a growing share of our implementation missions, primarily in automotive industry (Île Napoléon suppliers, Stellantis sub-contractors), engineering (Clemessy), chemicals and materials (ENSCMu) and digital (KMØ, SEMIA).",
          "Kick-off always happens in person at your Mulhouse offices: team alignment, access to production or engineering data, CRM/ERP/industrial system integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Mulhouse: handover, team training on their workstations, runbook documentation delivered — whether in an office, workshop or laboratory.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Mulhouse cases: automotive mid-caps (quality report automation, production scheduling optimization), engineering SMEs (automatic technical report writing, plan analysis), consulting and engineering offices (prospect qualification, contractual document generation), KMØ startups (support agents, developer copilots).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Mulhouse workshop: target architecture review (CRM, ERP, MES, engineering tools, industrial systems), GDPR/security and cross-border constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Mulhouse: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Mulhouse: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Mulhouse micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For industrial SMEs, engineering firms, automotive sub-contractors, KMØ digital players from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, MES, PLM), cross-department ambassador training. Tailored for Mulhouse automotive mid-caps, engineering firms and cross-border groups.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Mulhouse basin large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode, cross-border dimension integrated.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quality report automation implementation delivered as promised. ROI measured within the first months: our engineers now spend less time on administrative reports and more on process improvement. No lock-in, we control our deployment.",
            role: "Quality Director",
            companyProfile: "Automotive equipment supplier mid-cap, Mulhouse basin",
          },
          {
            quote:
              "Perfect hybrid mode for our team split between the workshop and the office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors have been operating autonomously since the end of the mission.",
            role: "CTO",
            companyProfile: "Industrial engineering SME, Mulhouse",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Mulhouse take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Mulhouse missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial or cross-border data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Mulhouse businesses with France-Switzerland-Germany flows, we apply sovereignty and cross-border compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical industrial data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical components, regulatory files, safety data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Specific management of France-Switzerland-Germany cross-border constraints. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le programme 1-to-1 Axion-IA à Mulhouse accompagne dirigeants et cadres du bassin Haut-Rhin dans la construction de leur stratégie IA personnelle — en présentiel à Mulhouse, à distance ou en format hybride selon votre agenda. Une approche individualisée calibrée pour les décideurs du tissu industriel mulhousien : automobile, ingénierie, chimie, numérique.",
        whyHere: [
          "L'accompagnement individuel est particulièrement adapté aux dirigeants mulhousiens dont les équipes ont des enjeux IA spécifiques à l'industrie automobile, à l'ingénierie de précision ou à la dimension transfrontalière.",
          "Format flexible : séances en présentiel à Mulhouse (vos locaux, Parc des Collines, Bourtzwiller) ou à distance selon votre agenda et vos déplacements transfrontaliers.",
          "Programme structuré autour de VOS cas : pas de curriculum générique, chaque séance part de vos questions, vos projets, vos équipes et vos contraintes spécifiques.",
          "Accès à notre réseau de praticiens IA sectoriels : retours d'expérience automobile, industrie 4.0 et numérique du bassin rhénan directement mobilisables dans votre programme.",
          "Confidentialité totale : Confidentialité stricte, aucune donnée partagée hors périmètre, aucun conflit d'intérêt avec vos concurrents directs.",
          "Aucun lock-in : le programme se clôture quand vos objectifs sont atteints, avec une documentation de synthèse que vous conservez intégralement.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Un échange approfondi pour cartographier votre maturité IA actuelle, vos objectifs de transformation et les contraintes spécifiques de votre secteur mulhousien — automobile, ingénierie, chimie ou numérique.",
          },
          {
            step: "Programme personnalisé",
            detail:
              "Conception d'un parcours sur-mesure : nombre de séances, thématiques, format (présentiel Mulhouse ou distance), livrables intermédiaires. Adapté à votre rythme de dirigeant.",
          },
          {
            step: "Séances opérationnelles",
            detail:
              "Chaque séance combine apport de méthode, travail sur vos cas concrets et démos appliquées à vos enjeux réels. Vous progressez sur ce qui compte pour vous, pas sur un curriculum standardisé.",
          },
          {
            step: "Mise en pratique guidée",
            detail:
              "Entre les séances, des exercices ciblés et des ressources sélectionnées pour votre secteur. Suivi asynchrone par messagerie pour les questions opérationnelles ponctuelles.",
          },
          {
            step: "Clôture et documentation",
            detail:
              "Synthèse documentée de votre trajectoire IA, des décisions prises et de la roadmap actionnable. Vous repartez avec un capital intellectuel structuré, indépendant d'Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Programme Essentiel",
            detail:
              "Pour dirigeants et indépendants mulhousiens souhaitant structurer leur usage IA personnel et identifier les premiers gains concrets dans leur activité.",
          },
          {
            sizeLabel: "PME",
            price: "Programme PME",
            detail:
              "Pour dirigeants et cadres de PME mulhousiennes souhaitant piloter la transformation IA de leur structure, de la stratégie à l'exécution opérationnelle.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme ETI",
            detail:
              "Pour DG, CDO ou directeurs de transformation d'ETI mulhousiennes souhaitant cadrer une trajectoire IA pluriannuelle et embarquer leurs équipes de direction.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Accompagnement de dirigeants de grandes entreprises ou de comités de direction complets — intégration de la dimension transfrontalière et des enjeux de gouvernance IA groupe.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le programme 1-to-1 m'a permis de sortir du bruit ambiant sur l'IA et de définir une stratégie claire pour mon entreprise industrielle. Chaque séance était directement applicable à mes enjeux spécifiques.",
            role: "Président-directeur général",
            companyProfile: "PME industrie, bassin mulhousien",
          },
          {
            quote:
              "Format hybride parfait pour mon agenda chargé entre Mulhouse et Bâle. J'ai structuré ma feuille de route IA en quelques semaines, avec un accompagnement qui connaissait les réalités de l'industrie transfrontalière.",
            role: "Directeur des opérations",
            companyProfile: "ETI groupe franco-suisse, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "Quelle est la durée d'un programme 1-to-1 Axion-IA à Mulhouse ?",
            a: "Le programme est défini selon vos objectifs. Une formule courte pour un cadrage rapide, une formule longue pour une transformation en profondeur sur plusieurs mois. Le nombre et la fréquence des séances sont convenus ensemble au diagnostic initial.",
          },
          {
            q: "Peut-on combiner présentiel Mulhouse et séances à distance ?",
            a: "Oui, c'est même le format le plus courant. Les séances fondatrices et de restitution se tiennent de préférence en présentiel à Mulhouse ou dans le bassin, les séances intermédiaires en visio selon votre agenda.",
          },
          {
            q: "Le programme est-il adapté aux dirigeants sans culture technique IA ?",
            a: "Oui, c'est même la majorité de nos accompagnés. Aucun prérequis technique — le programme part de vos enjeux métier et de vos questions concrètes, pas d'un socle technique supposé.",
          },
          {
            q: "La confidentialité est-elle garantie, notamment pour la dimension transfrontalière ?",
            a: "Absolument. Confidentialité stricte dès le démarrage, aucune information échangée hors du périmètre convenu, aucun conflit d'intérêt avec vos concurrents directs mulhousiens ou transfrontaliers.",
          },
          {
            q: "Puis-je impliquer d'autres membres de mon comité de direction ?",
            a: "Oui. Le programme 1-to-1 peut évoluer vers un format comité restreint (2-5 personnes) si vous souhaitez embarquer votre équipe de direction dans la démarche. Une option spécifique est prévue pour les groupes transfrontaliers avec des équipes sur plusieurs pays.",
          },
          {
            q: "Que se passe-t-il si mes objectifs évoluent en cours de programme ?",
            a: "Le programme est conçu pour être ajusté en cours de route. Si vos priorités changent, on réoriente les séances. Aucun curriculum rigide — l'agilité est au cœur du format 1-to-1.",
          },
        ],
        guarantees:
          "Confidentialité contractuelle totale : Confidentialité stricte, données exclusivement dans le périmètre convenu, aucun conflit d'intérêt avec vos concurrents. Programme ajustable en cours de route sans frais de renégociation. Livrables documentés remis à chaque étape clé — vous repartez avec un capital intellectuel structuré que vous possédez intégralement. Aucun lock-in : le programme se termine quand vos objectifs sont atteints.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 program in Mulhouse supports executives and managers from the Haut-Rhin basin in building their personal AI strategy — in person in Mulhouse, remotely or in hybrid format depending on your schedule. An individualised approach calibrated for decision-makers in the Mulhouse industrial fabric: automotive, engineering, chemicals, digital.",
        whyHere: [
          "Individual coaching is particularly suited to Mulhouse executives whose teams face AI challenges specific to the automotive industry, precision engineering or the cross-border dimension.",
          "Flexible format: in-person sessions in Mulhouse (your offices, Parc des Collines, Bourtzwiller) or remote depending on your schedule and cross-border travel.",
          "Programme structured around YOUR cases: no generic curriculum, each session starts from your questions, your projects, your teams and your specific constraints.",
          "Access to our sectoral AI practitioner network: automotive, Industry 4.0 and digital feedback from the Rhine basin directly mobilisable in your programme.",
          "Total confidentiality: Strict confidentiality, no data shared outside the agreed scope, no conflict of interest with your direct competitors.",
          "No lock-in: the programme closes when your objectives are reached, with a synthesis document you retain in full.",
        ],
        methodology: [
          {
            step: "Initial diagnosis",
            detail:
              "An in-depth exchange to map your current AI maturity, your transformation objectives and the specific constraints of your Mulhouse sector — automotive, engineering, chemicals or digital.",
          },
          {
            step: "Personalised programme",
            detail:
              "Design of a bespoke pathway: number of sessions, topics, format (in-person Mulhouse or remote), intermediate deliverables. Adapted to your executive rhythm.",
          },
          {
            step: "Operational sessions",
            detail:
              "Each session combines method input, work on your concrete cases and demos applied to your real challenges. You progress on what matters to you, not on a standardised curriculum.",
          },
          {
            step: "Guided practice",
            detail:
              "Between sessions, targeted exercises and resources selected for your sector. Asynchronous follow-up by message for occasional operational questions.",
          },
          {
            step: "Closure and documentation",
            detail:
              "Documented synthesis of your AI trajectory, decisions taken and actionable roadmap. You leave with structured intellectual capital, independent of Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential programme",
            detail:
              "For Mulhouse micro-business owners and freelancers looking to structure their personal AI use and identify first concrete gains in their activity.",
          },
          {
            sizeLabel: "SME",
            price: "SME programme",
            detail:
              "For Mulhouse SME executives and managers looking to lead the AI transformation of their structure, from strategy to operational execution.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap programme",
            detail:
              "For CEOs, CDOs or transformation directors of Mulhouse mid-caps looking to frame a multi-year AI trajectory and bring their leadership teams on board.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Programme on quote",
            detail:
              "Coaching for large enterprise executives or full executive committees — integration of the cross-border dimension and group AI governance challenges.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 programme let me cut through the AI noise and define a clear strategy for my industrial company. Each session was directly applicable to my specific challenges.",
            role: "Chairman & CEO",
            companyProfile: "Industrial SME, Mulhouse basin",
          },
          {
            quote:
              "Perfect hybrid format for my busy schedule between Mulhouse and Basel. I structured my AI roadmap in a few weeks, with coaching that understood the realities of cross-border industry.",
            role: "Director of Operations",
            companyProfile: "Franco-Swiss group mid-cap, Haut-Rhin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA 1-to-1 programme in Mulhouse take?",
            a: "The programme is designed according to your objectives. A short formula for quick framing, a long formula for in-depth transformation over several months. The number and frequency of sessions are agreed together at the initial diagnosis.",
          },
          {
            q: "Can we combine in-person Mulhouse and remote sessions?",
            a: "Yes, that's even the most common format. Foundational and read-out sessions are preferably held in person in Mulhouse or the basin; intermediate sessions by video depending on your schedule.",
          },
          {
            q: "Is the programme suited to executives with no technical AI background?",
            a: "Yes, that's actually the majority of our participants. No technical prerequisites — the programme starts from your business challenges and concrete questions, not an assumed technical foundation.",
          },
          {
            q: "Is confidentiality guaranteed, including for the cross-border dimension?",
            a: "Absolutely. Confidentiality ensured from kick-off, no information exchanged outside the agreed scope, no conflict of interest with your direct Mulhouse or cross-border competitors.",
          },
          {
            q: "Can I involve other members of my executive committee?",
            a: "Yes. The 1-to-1 programme can evolve into a small committee format (2-5 people) if you want to bring your leadership team along. A specific option is available for cross-border groups with teams across multiple countries.",
          },
          {
            q: "What happens if my objectives change during the programme?",
            a: "The programme is designed to be adjusted on the go. If your priorities shift, we re-focus the sessions. No rigid curriculum — agility is at the heart of the 1-to-1 format.",
          },
        ],
        guarantees:
          "Total contractual confidentiality: Strict confidentiality, data exclusively within the agreed scope, no conflict of interest with your competitors. Programme adjustable during delivery without renegotiation fees. Documented deliverables handed over at each key milestone — you leave with structured intellectual capital you own in full. No lock-in: the programme ends when your objectives are reached.",
      },
    },
  },
};
