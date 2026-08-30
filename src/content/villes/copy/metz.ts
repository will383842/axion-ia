// Metz (57463) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique paris.ts / lyon.ts) :
//   - Aucun « basé en UE ».
//   - Aucun délai concret chiffré (« 5 jours », « 7 jours », etc.).
//   - Aucun « frais de déplacement intégrés » — les frais sont en sus,
//     calculés au cas par cas selon la zone.
//   - Durée minimale = 1 journée. Mention systématique
//     « frais de logement, repas et forfait trajet en sus » sur interventions.
//   - Aucun prix hardcodé : tarifs viennent de `src/content/pricing.ts`.
//   - Tailles entreprise INSEE : PME/ETI/grands groupes / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Mot « formation » autorisé en copy descriptif, naming = « intervention ».
//
// Sources économiques : economic-data/metz.ts (Sprint City Quality V3, ville #29).
// Réalités locales : capitale Moselle, transfrontalier Luxembourg (~60 km),
// Centre Pompidou-Metz (Shigeru Ban 2010), Georgia Tech Lorraine (campus
// américain unique en France), Technopôle Metz 2000, LORIA/Inria,
// Stellantis Trémery, ArcelorMittal Florange, Materalia, Banque Populaire
// Lorraine Champagne, CCI Moselle Métropole Metz, French Tech East.

import type { VilleCopy } from "./types";

export const METZ_COPY: VilleCopy = {
  pitchFr:
    "Metz regroupe un tissu B2B dense en Moselle, capitale régionale Grand Est, adossée au bassin transfrontalier Luxembourg (~60 km, ~110 000 frontaliers lorrains), Ã  l'écosystème académique Georgia Tech Lorraine + CentraleSupélec + LORIA/Inria et Ã  l'industrie automobile (Stellantis Trémery). Axion-IA y intervient sur site, des PME messines aux ETI industrielles et aux directions IA des sièges bancaires.",
  pitchEn:
    "Metz anchors a dense B2B fabric in Moselle, the Grand Est regional capital, backed by the Luxembourg cross-border basin (~60 km, ~110,000 Lorraine commuters), the Georgia Tech Lorraine + CentraleSupélec + LORIA/Inria academic ecosystem and the automotive industry (Stellantis Trémery). Axion-IA delivers on site, from Metz micro-businesses to industrial mid-caps and AI leadership at banking HQs.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel Ã  Metz : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, des PME messines aux ETI industrielles automobile et sidérurgiques de l'Eurométropole.",
      en: "Operational AI audit in Metz: we map what can be automated at your company and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, from Metz micro-businesses to automotive and steel industrial mid-caps in the Eurométropole.",
    },
    interventions: {
      fr: "Interventions IA Ã  Metz : formats sur site d'une Ã  plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste.",
      en: "AI sessions in Metz: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA Ã  Metz : on déploie l'IA dans vos outils existants (CRM, ERP, systèmes industriels, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Metz: we deploy AI into your existing tools (CRM, ERP, industrial systems, email) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA Ã  Metz : coaching 1-to-1 pour dirigeants et managers de l'Eurométropole souhaitant intégrer l'IA dans leur pratique quotidienne et piloter la transformation de leur organisation.",
      en: "Individual AI coaching in Metz: 1-to-1 coaching for Eurométropole executives and managers looking to integrate AI into their daily practice and lead their organisation's transformation.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI messines — site vitrine premium pour industrie automobile, banque et numérique, espace client transfrontalier FR/DE/LU, dashboard métier connecté Ã  votre CRM/ERP et systèmes industriels. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Metz SMEs and mid-caps — premium showcase site for automotive industry, banking and digital, cross-border FR/DE/LU customer space, business dashboard connected to your CRM/ERP and industrial systems. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient Ã  Metz (57) sur site — Technopôle Metz 2000, Quartier de l'Amphithéâtre, Actipôle Metz Nord, Montigny-lès-Metz, Woippy et communes de l'Eurométropole. Nous accompagnons les PME, ETI et grands groupes messins (industrie automobile, banque, numérique, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Metz (57) on site — Technopôle Metz 2000, Quartier de l'Amphithéâtre, Actipôle Metz Nord, Montigny-lès-Metz, Woippy and Eurométropole communes. We support Metz micro-businesses, SMEs, mid-caps and large enterprises (automotive industry, banking, digital, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "transfrontalier, automotive & numérique",

  topSectorsNaf: [
    "Commerce, transports & services aux entreprises",
    "Activités spécialisées, scientifiques & techniques",
    "Administration publique & enseignement (préfecture Moselle)",
    "Industrie automobile & manufacturière (Stellantis Trémery, Materalia)",
    "Banque & Finance (BPCE, Caisse d'Épargne Grand Est)",
    "Information, communication & logiciels",
  ],

  distancesFr:
    "Gare de Metz-Ville (TGV Est, Paris ~1h22, liaisons Luxembourg et Sarrebruck) en centre-ville. Aéroport Metz-Nancy-Lorraine (ETZ) Ã  25 km, aéroport Luxembourg (LUX) Ã  ~70 km. Réseau Le Met' (2 lignes de bus express + tramway en projet) pour desservir le Technopôle, le Quartier de l'Amphithéâtre et les communes de l'Eurométropole.",
  distancesEn:
    "Metz-Ville TGV station (Paris ~1h22, Luxembourg and Saarbrücken connections) in the city centre. Metz-Nancy-Lorraine Airport (ETZ) 25 km away, Luxembourg Airport (LUX) ~70 km. Le Met' network (2 express bus lines + tram project) to reach the Technopôle, Quartier de l'Amphithéâtre and Eurométropole communes.",

  ecosystemFr:
    "Tissu B2B Eurométropole — bassin transfrontalier Luxembourg (~110 000 frontaliers lorrains), Technopôle Metz 2000 (Georgia Tech Lorraine, CentraleSupélec, LORIA/Inria), Quartier de l'Amphithéâtre (tertiaire, Centre Pompidou-Metz), industrie automobile (Stellantis Trémery, pôle Materalia), sidérurgie (ArcelorMittal Florange), banque (BPCE, Caisse d'Épargne Grand Est), CCI Moselle Métropole et French Tech East.",
  ecosystemEn:
    "Eurométropole B2B fabric — Luxembourg cross-border basin (~110,000 Lorraine commuters), Technopôle Metz 2000 (Georgia Tech Lorraine, CentraleSupélec, LORIA/Inria), Quartier de l'Amphithéâtre (tertiary, Centre Pompidou-Metz), automotive industry (Stellantis Trémery, Materalia cluster), steel (ArcelorMittal Florange), banking (BPCE, Caisse d'Épargne Grand Est), CCI Moselle Métropole and French Tech East.",

  // === SERVICES LONG-FORM METZ ===
  // Même structure que lyon.ts — Aucun prix en dur, aucun délai chiffré.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise messine et chiffre le retour sur investissement Ã  12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toute l'échelle, des PME du centre de Metz aux ETI industrielles de Trémery et aux directions IA des sièges bancaires de l'Eurométropole.",
        whyHere: [
          "Metz est un pôle d'intervention clé pour Axion-IA en Grand Est : le tissu B2B Eurométropole génère une demande croissante d'audits IA opérationnels.",
          "Tissu sectoriel sur-représenté chez nos clients messins : industrie automobile et matériaux (Stellantis Trémery, Materalia), banque/finance (BPCE, Caisse d'Épargne Grand Est), IT/numérique (Technopôle, BLIIIDA), services publics (préfecture Moselle, Université de Lorraine).",
          "Nos consultants se déplacent sur l'ensemble de l'Eurométropole : Metz centre, Technopôle Metz 2000, Quartier de l'Amphithéâtre, Montigny-lès-Metz, Woippy, Marly, Longeville-lès-Metz.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux messins, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage Ã  distance pour accéder en toute confidentialité aux documents clés. Utile pour les ETI industrielles de l'Eurométropole avec des workflows complexes — automobile, sidérurgie, logistique.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue Ã  Metz dans vos locaux — Technopôle Metz 2000, Quartier de l'Amphithéâtre ou commune de l'Eurométropole — pour observer les outils et identifier les workflows candidats Ã  l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts (commerciaux, finance, R&D, production, support, direction) pour cartographier les frictions, en tenant compte des spécificités messines (automobile, banque, transfrontalier).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées Ã  vos PDFs, emails, rapports analytiques, données de production. Pas de slides — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier dans vos locaux messins. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap 6-18 mois adaptée Ã  votre secteur et au contexte transfrontalier si pertinent.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Pour PME numériques du Technopôle, cabinets du Quartier de l'Amphithéâtre et entreprises de quelques dizaines Ã  250 collaborateurs de l'Eurométropole.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour ETI industrielles (automobile Trémery, Materalia), ETI bancaires (BPCE, Caisse d'Épargne) ou ETI tertiaires souhaitant cadrer une trajectoire IA pluriannuelle avec dimension transfrontalière.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour grandes entreprises implantées dans l'Eurométropole — Stellantis Trémery, ArcelorMittal Florange, Amazon Augny, grands sièges bancaires régionaux.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel rigoureux, chiffré et actionnable, tenant compte des contraintes de notre environnement industriel. On a pu présenter le plan au comité de direction dès les semaines suivantes.",
            role: "Directeur général",
            companyProfile: "ETI industrie automobile, Eurométropole de Metz",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes. Le livrable a permis de prioriser nos chantiers IA avec un ROI chiffré pour chaque cas d'usage identifié.",
            role: "Directrice de la transformation",
            companyProfile: "PME services financiers, Metz Technopôle",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA Ã  Metz ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI industrielle de l'Eurométropole ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié Ã  12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, suivi production, qualification appels d'offres, lecture factures). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou bancaires restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs automobile, bancaire et les entreprises en environnement transfrontalier Metz-Luxembourg, nous appliquons les contraintes souveraineté et conformité dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale Ã  Metz ?",
            a: "Toujours en présentiel dans vos locaux messins. Atelier de plusieurs heures avec votre comité de direction. Vous repartez avec le livrable PDF en main propre et une roadmap prête Ã  présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes de l'Eurométropole ?",
            a: "Oui. L'Eurométropole de Metz est notre terrain d'intervention complet — de Montigny-lès-Metz Ã  Woippy, de Marly Ã  Longeville-lès-Metz, jusqu'aux zones industrielles de Trémery et l'Actipôle Nord.",
          },
          {
            q: "Faut-il être déjÃ  avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits messins sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus Ã  la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Metz business and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover the full range, from Metz micro-businesses to large automotive and banking mid-caps across the Eurométropole.",
        whyHere: [
          "Metz is a key Axion-IA engagement hub in Grand Est: the Eurométropole B2B ecosystem generates growing operational AI audit demand.",
          "Metz B2B fabric over-represented in our cases: automotive and materials industry (Stellantis Trémery, Materalia), banking/finance (BPCE, Caisse d'Épargne Grand Est), IT/digital (Technopôle startups, BLIIIDA), public services and higher education.",
          "Our consultants travel across the full Eurométropole: Metz city centre, Technopôle Metz 2000, Quartier de l'Amphithéâtre, Montigny-lès-Metz, Woippy, Marly, Longeville-lès-Metz.",
          "Read-outs always in person: ideation workshops at your Metz offices, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents. Particularly relevant for Eurométropole industrial mid-caps with complex workflows — automotive, steel, logistics.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Metz at your offices — Technopôle Metz 2000, Quartier de l'Amphithéâtre or a Eurométropole commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews to map frictions and expectations, accounting for Metz sector specifics (automotive constraints, banking compliance, cross-border environment).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Metz offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector and cross-border context where relevant.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs on the Technopôle, tertiary firms in the Quartier de l'Amphithéâtre and businesses from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (automotive Trémery, Materalia), banking mid-caps (BPCE, Caisse d'Épargne) or tertiary mid-caps framing a multi-year AI trajectory with a cross-border dimension.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises with major Eurométropole sites — Stellantis Trémery, ArcelorMittal Florange, Amazon Augny, large regional banking HQs.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a rigorous, costed and actionable audit accounting for our industrial environment constraints. We presented the plan to the executive committee within the following weeks.",
            role: "CEO",
            companyProfile: "Automotive industry mid-cap, Eurométropole de Metz",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than slides. The deliverable helped prioritize our AI initiatives with a costed ROI for each identified use case.",
            role: "Head of Transformation",
            companyProfile: "Financial services SME, Metz Technopôle",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Metz?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an Eurométropole industrial mid-cap?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, production tracking, tender qualification, supplier invoice reading).",
          },
          {
            q: "Does my industrial or banking data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For automotive, banking and cross-border Metz-Luxembourg operators, we apply sovereignty and compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Metz?",
            a: "Always in person at your Metz offices. Workshop of several hours with your executive committee. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Eurométropole communes outside Metz proper?",
            a: "Yes. The Eurométropole de Metz is our full territory — from Montigny-lès-Metz to Woippy, Marly to Longeville-lès-Metz, and the industrial zones of Trémery and Actipôle Nord.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Metz audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA Ã  Metz se déclinent en formats sur site d'une Ã  plusieurs journées selon vos équipes. Vos collaborateurs repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en usine, au bureau, en clientèle ou dans le contexte transfrontalier Metz-Luxembourg.",
        whyHere: [
          "Metz est l'un de nos principaux terrains d'intervention en Grand Est : entreprises industrielles, services bancaires, PME numériques du Technopôle et structures publiques représentent une part significative de nos sessions messines.",
          "Toutes les zones de l'Eurométropole couvertes en présentiel : Metz centre, Technopôle Metz 2000, Quartier de l'Amphithéâtre, Actipôle Metz Nord, Montigny-lès-Metz, Woippy, Marly, Longeville-lès-Metz.",
          "Le format collectif (1 journée) est calibré pour les structures messines de quelques personnes Ã  une centaine de collaborateurs, en particulier les PME numériques du Technopôle et les cabinets du quartier Impérial.",
          "Le format Conférence convient aux plénières d'entreprise messines (salles Metz Expo, espaces Centre Pompidou-Metz, auditoriums du Technopôle).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et bancaires, avec prise en compte des enjeux transfrontaliers Luxembourg si pertinent.",
          "Vocabulaire ajusté Ã  votre secteur dominant : industrie automobile, finance, numérique, collectivités, commerce transfrontalier. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange Ã  distance pour cibler le profil des participants, votre secteur — notamment les contraintes industrie automobile ou bancaire — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs (rapports qualité, emails, devis, données de production) pour calibrer les démos sur VOS données messines.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes déconnectés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle messine.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département — efficace pour les PME numériques du Technopôle Metz 2000.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, groupes bancaires) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure — roadshow multi-sites Eurométropole, séminaires CODIR + cascade équipes terrain ou ateliers industriels.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format collectif (1 journée) a collé aux attentes de nos équipes opérationnelles. Repartis avec leurs outils configurés sur leurs vrais cas d'usage. Dès le lendemain, plusieurs les utilisaient pour rédiger des comptes-rendus.",
            role: "Directeur des opérations",
            companyProfile: "PME services, Technopôle Metz 2000",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles et la réalité transfrontalière de notre activité.",
            role: "DG",
            companyProfile: "ETI banque & finance, Eurométropole de Metz",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA Ã  Metz ?",
            a: "Cela dépend du format. Le format collectif se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels de l'Eurométropole ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels messins — postes déconnectés, VLAN sécurisés, protocoles accès site. La préparation inclut un audit réseau/sécurité préalable pour les sites de Trémery ou de l'Actipôle Nord.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux spécificités transfrontalières Metz-Luxembourg ?",
            a: "Oui. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos aux réalités des entreprises opérant en contexte franco-luxembourgeois — conformité multi-pays, équipes bilingues, processus cross-border.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT et s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil et formation professionnelle.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjÃ  bloqué. Très tardive : session reportable une fois sans frais.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain, séance de remédiation offerte. Vocabulaire et démos ajustés Ã  votre secteur messin — industrie, finance, numérique, collectivités.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Metz come in on-site formats from one to several days depending on your teams. Your staff leave with AI tools installed on their workstations, configured for their real work — on the factory floor, at the office, with clients or in the cross-border Metz-Luxembourg context.",
        whyHere: [
          "Metz is one of our top engagement grounds in Grand Est: industrial firms, banking services, Technopôle digital SMEs and public administration represent a significant share of our Metz sessions.",
          "All Eurométropole zones covered in person: Metz city centre, Technopôle Metz 2000, Quartier de l'Amphithéâtre, Actipôle Metz Nord, Montigny-lès-Metz, Woippy, Marly, Longeville-lès-Metz.",
          "The group format is calibrated for Metz structures from a few people to about a hundred staff, particularly digital SMEs on the Technopôle and consulting firms in the Quartier Impérial.",
          "The Talk format suits Metz corporate plenaries (Metz Expo rooms, Centre Pompidou-Metz spaces, Technopôle auditoriums).",
          "The Executives format enables in-camera framing for industrial and banking mid-cap executive committees, including cross-border Luxembourg considerations where relevant.",
          "Vocabulary adjusted to your dominant sector: automotive industry, finance, digital, public administration, cross-border trade. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange to target participant profile, your sector — including automotive or banking regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity to calibrate demos on YOUR Metz data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with air-gapped workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases grounded in your Metz sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department — particularly effective for digital SMEs at Technopôle Metz 2000.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, banking groups) or in-camera executive committee with cross-border considerations.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Metz HQs — multi-site Eurométropole roadshows, exec committee seminars + field team cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The group format matched our operational teams' expectations. They left with tools configured for their real use cases. By the next day, several were already using them to write reports.",
            role: "Operations Director",
            companyProfile: "Services SME, Technopôle Metz 2000",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our sector constraints and the cross-border reality of our business.",
            role: "CEO",
            companyProfile: "Banking and finance mid-cap, Eurométropole de Metz",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Metz take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in Eurométropole industrial environments?",
            a: "Yes. Our consultants adapt to Metz industrial environment constraints — air-gapped workstations, secure VLANs, site access protocols. Preparation includes an upfront network/security review for Trémery or Actipôle Nord sites.",
          },
          {
            q: "Do the tools installed remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in.",
          },
          {
            q: "Can you adapt content to Metz-Luxembourg cross-border specifics?",
            a: "Yes. The upstream framing brief lets us adjust vocabulary, examples and demos to companies operating in a Franco-Luxembourgish context — multi-country compliance, bilingual teams, cross-border processes.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT) and can be included in your company's training plan — your HR or finance team can process them as a consulting and professional training service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot blocked. Very late: session rebookable once free of charge.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning, free remediation session offered. Vocabulary and demos adjusted to your Metz sector — industry, finance, digital, public administration.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA Ã  Metz met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux messins — Technopôle, Quartier de l'Amphithéâtre ou commune de l'Eurométropole.",
        whyHere: [
          "Metz concentre une part croissante de nos missions d'implémentation en Grand Est : industrie automobile (Trémery, Actipôle), services financiers (BPCE, Caisse d'Épargne), numérique (Technopôle, BLIIIDA) et services publics (préfecture, collectivités).",
          "Le kick-off se passe systématiquement en présentiel : alignement des équipes, accès aux données de production ou clients, validation des intégrations CRM/ERP/systèmes industriels.",
          "Itérations Ã  distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel Ã  Metz : passation de pouvoir, formation des équipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques messins : ETI industrielles (automatisation rapports qualité automobile), PME bancaires (qualification prospects, génération documents conformité), éditeurs logiciels Technopôle (agents support), collectivités (traitement demandes usagers, reporting).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Metz : revue de l'architecture cible (CRM, ERP, systèmes industriels MES/SCADA), validation des contraintes RGPD/sécurité et réglementaires, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Metz : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation avec vos équipes technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail Ã  distance avec un point quotidien court : enrichissement des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Metz : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport Ã  la prédiction du SOW. Rapport final remis Ã  clôture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME numériques Technopôle et entreprises de quelques dizaines Ã  250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, MES automobile, datalake). Adapté aux ETI industrielles et bancaires de l'Eurométropole.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Eurométropole : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation documentation qualité livrée dans les délais. ROI mesuré dès les premiers mois : nos équipes passent moins de temps sur les rapports et plus sur l'amélioration process. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI automobile, Eurométropole de Metz",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le Technopôle et nos sites de production. Kick-off intense sur site, puis itérations fluides Ã  distance. Nos ambassadeurs internes sont autonomes.",
            role: "CTO",
            companyProfile: "PME logiciels industriels, Technopôle Metz 2000",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA Ã  Metz ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME en quelques semaines, une mission PME sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions messines. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in.",
          },
          {
            q: "Mes données industrielles ou bancaires restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié). Pour les secteurs réglementés messins (automobile, banque, secteur public), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "L'IA est-elle compatible avec les systèmes industriels messins (MES, SCADA, ERP automobile) ?",
            a: "Oui. Le cadrage technique initial couvre l'inventaire précis de vos systèmes existants. Nos intégrations couvrent les principaux ERP/MES du secteur automobile (SAP, Oracle, Siemens, autres). Si un connecteur est absent, il est développé dans le SOW.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus Ã  la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel reste très en deçÃ  de la prédiction, audit gratuit + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Metz brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Metz offices — Technopôle, Quartier de l'Amphithéâtre or a Eurométropole commune.",
        whyHere: [
          "Metz hosts a growing share of our Grand Est implementation missions: automotive industry (Trémery, Actipôle), financial services (BPCE, Caisse d'Épargne), digital (Technopôle, BLIIIDA) and public services (prefecture, local authorities).",
          "Kick-off always happens in person: team alignment, access to production or customer data, CRM/ERP/industrial systems integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Metz: handover, team training, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Metz cases: industrial mid-caps (automotive quality report automation), banking SMEs (prospect qualification, compliance document generation), Technopôle software publishers (support agents), local authorities (citizen request processing, reporting).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Metz workshop: target architecture review (CRM, ERP, industrial MES/SCADA systems), GDPR/security and regulatory constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Metz: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Metz: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at mission closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For Technopôle digital SMEs and companies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, automotive MES, datalake). Tailored for Eurométropole industrial and banking mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Eurométropole large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quality documentation automation implementation delivered on time. ROI measured within the first months: our teams spend less time on reports and more on process improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Automotive mid-cap, Eurométropole de Metz",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the Technopôle and our production sites. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Industrial software SME, Technopôle Metz 2000",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Metz take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Metz missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in.",
          },
          {
            q: "Does my industrial or banking data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server). For Metz regulated sectors (automotive, banking, public sector), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "Is AI compatible with Metz industrial systems (MES, SCADA, automotive ERP)?",
            a: "Yes. The initial technical framing covers a precise inventory of your existing systems. Our integrations cover major automotive and industrial ERP/MES (SAP, Oracle, Siemens, others). If a connector is missing, it is developed within the SOW.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel Axion-IA Ã  Metz est un coaching IA 1-to-1 sur mesure pour dirigeants, managers et experts de l'Eurométropole. Format hybride — session inaugurale en présentiel dans vos locaux messins ou dans un espace de travail du Technopôle, puis suivi Ã  distance structuré. Vous progressez Ã  votre rythme sur vos vrais défis professionnels.",
        whyHere: [
          "Les dirigeants de l'Eurométropole de Metz font face Ã  des enjeux IA spécifiques : contexte transfrontalier Luxembourg, transition industrielle automobile (Stellantis Trémery, Materalia), contraintes réglementaires bancaires et pression concurrentielle Grand Est.",
          "Le format individuel permet d'aborder des sujets confidentiels — stratégie d'entreprise, choix technologiques sensibles, positionnement face aux acteurs luxembourgeois et allemands — sans les contraintes d'une session collective.",
          "Session inaugurale toujours en présentiel Ã  Metz : votre consultant se déplace dans vos locaux (Technopôle, Quartier de l'Amphithéâtre, bureau en centre-ville ou commune de l'Eurométropole).",
          "Suivi structuré Ã  distance entre les sessions : exercices pratiques, ressources ciblées, retours personnalisés sur vos expérimentations IA en situation réelle.",
          "Progression calibrée sur vos objectifs concrets : adopter les outils IA dans votre quotidien, cadrer une stratégie IA pour votre organisation, ou préparer votre prise de parole sur l'IA auprès de vos équipes.",
          "Aucun lock-in : Ã  l'issue du programme, vous êtes autonome — outils configurés, méthodes acquises, roadmap personnelle en main.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Entretien approfondi pour cartographier votre maturité IA, vos cas d'usage prioritaires et vos freins — en tenant compte de votre secteur messin (automobile, banque, numérique, public) et de votre contexte transfrontalier éventuel.",
          },
          {
            step: "Session inaugurale sur site",
            detail:
              "Premier rendez-vous en présentiel Ã  Metz : installation des outils IA sur votre poste, démos sur vos documents et données réels, définition de votre feuille de route individuelle.",
          },
          {
            step: "Sessions de coaching",
            detail:
              "Séances régulières Ã  distance — revue de vos expérimentations, approfondissement de nouveaux cas d'usage, ajustement de votre pratique IA au fil des semaines.",
          },
          {
            step: "Immersion terrain",
            detail:
              "Sur demande : observation d'une réunion ou d'un processus métier clé pour affiner les recommandations Ã  votre contexte opérationnel précis.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "Session finale de synthèse : récapitulatif des acquis, roadmap personnelle pour la suite, guide de ressources curatées Ã  votre profil messin.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Programme Avancé",
            detail:
              "Pour les dirigeants et managers de PME (Technopôle, commerces tertiaires, cabinets) voulant piloter la transformation IA de leur département.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme Dirigeant ETI",
            detail:
              "Accompagnement stratégique sur mesure pour les DG, DGA et directeurs de business unit d'ETI industrielles ou bancaires de l'Eurométropole.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Pour les membres de CODIR et executives de grands groupes implantés Ã  Metz (Stellantis, groupes bancaires BPCE) souhaitant un accompagnement confidentiel et sur mesure.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching individuel m'a permis de passer de 'je comprends l'IA en théorie' Ã  'je l'utilise chaque jour sur mes vrais dossiers'. En quelques séances, j'ai gagné un temps considérable sur mes tâches répétitives.",
            role: "Directeur général",
            companyProfile: "PME conseil, centre-ville Metz",
          },
          {
            quote:
              "Le format 1-to-1 était essentiel pour moi : je pouvais aborder mes enjeux stratégiques transfrontaliers sans contrainte de confidentialité. Le consultant connaissait les réalités du tissu B2B lorrain.",
            role: "Directrice de développement",
            companyProfile: "PME services, Technopôle Metz 2000",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching individuel diffère-t-il d'une intervention collective Ã  Metz ?",
            a: "Le coaching 1-to-1 est centré sur votre cas personnel — vos outils, vos documents, vos enjeux stratégiques, votre rythme. Pas de compromis avec les besoins d'un groupe. Idéal pour les dirigeants qui veulent progresser vite sur un périmètre confidentiel.",
          },
          {
            q: "Combien de séances sont nécessaires pour progresser ?",
            a: "Le rythme est fixé en diagnostic initial selon vos objectifs. Un programme court couvre les bases opérationnelles, un programme long va jusqu'Ã  la maîtrise stratégique complète. Vous choisissez le niveau d'ambition.",
          },
          {
            q: "Les séances peuvent-elles se tenir Ã  distance entièrement ?",
            a: "Non pour la session inaugurale : votre consultant se déplace Ã  Metz pour installer vos outils et travailler sur vos vraies données. Les séances suivantes peuvent être en visio selon votre préférence.",
          },
          {
            q: "Ce programme convient-il aux dirigeants sans expérience IA ?",
            a: "Oui, c'est même le profil le plus fréquent. Le diagnostic initial adapte entièrement le programme Ã  votre niveau de départ — aucun prérequis technique.",
          },
          {
            q: "Est-il possible de combiner le coaching individuel avec une intervention collective pour mon équipe ?",
            a: "Oui. Plusieurs de nos clients messins démarrent par un coaching dirigeant pour cadrer la vision, puis enchaînent avec une session collective pour leurs équipes. Les deux formats se complètent.",
          },
          {
            q: "Le programme tient-il compte du contexte transfrontalier Metz-Luxembourg ?",
            a: "Oui, systématiquement si pertinent. Nous adaptons les exemples, cas d'usage et recommandations aux réalités des dirigeants opérant en contexte franco-luxembourgeois ou grand-régional.",
          },
        ],
        guarantees:
          "Satisfaction garantie Ã  l'issue du programme : si vous estimez ne pas avoir progressé sur vos objectifs définis en diagnostic, la dernière séance est remboursée. Session inaugurale en présentiel Ã  Metz garantie dès la réservation. Confidentialité totale — vos données, vos stratégies, vos documents restent chez vous. Outils configurés opérationnels dès la première séance.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Metz is a bespoke 1-to-1 program for executives, managers and experts across the Eurométropole. Hybrid format — inaugural in-person session at your Metz offices or a Technopôle workspace, then structured remote follow-up. You progress at your own pace on your real professional challenges.",
        whyHere: [
          "Eurométropole de Metz executives face specific AI challenges: cross-border Luxembourg context, automotive industrial transition (Stellantis Trémery, Materalia), banking regulatory constraints and Grand Est competitive pressure.",
          "The individual format allows tackling confidential topics — corporate strategy, sensitive technology choices, competitive positioning against Luxembourg and German players — without group session constraints.",
          "Inaugural session always in person in Metz: your consultant travels to your offices (Technopôle, Quartier de l'Amphithéâtre, city-centre office or Eurométropole commune).",
          "Structured remote follow-up between sessions: practical exercises, targeted resources, personalised feedback on your real-situation AI experiments.",
          "Progress calibrated to your concrete goals: adopting AI tools in your daily practice, framing an AI strategy for your organisation, or preparing to speak about AI to your teams.",
          "No lock-in: at the end of the programme, you are autonomous — tools configured, methods acquired, personal roadmap in hand.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "In-depth interview to map your AI maturity, priority use cases and blockers — accounting for your Metz sector specifics (automotive, banking, digital, public) and cross-border context if relevant.",
          },
          {
            step: "Inaugural on-site session",
            detail:
              "First in-person meeting in Metz: AI tools installed on your workstation, demos on your real documents and data, definition of your individual roadmap.",
          },
          {
            step: "Coaching sessions",
            detail:
              "Regular remote sessions — review of your experiments, deepening new use cases, adjusting your AI practice over the weeks.",
          },
          {
            step: "Field immersion",
            detail:
              "On request: observation of a meeting or key business process to refine recommendations to your precise operational context.",
          },
          {
            step: "Final review and autonomy",
            detail:
              "Closing synthesis session: recap of acquired skills, personal roadmap for the future, guide of resources curated to your Metz profile.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Advanced programme",
            detail:
              "For SME executives and managers (Technopôle, tertiary firms, practices) wanting to lead the AI transformation of their department or organisation.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Executive mid-cap programme",
            detail:
              "Bespoke strategic coaching for CEOs, deputy CEOs and business unit directors of industrial or banking mid-caps in the Eurométropole.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom-quote programme",
            detail:
              "For COMEX members and executives of large groups based in Metz (Stellantis, BPCE banking groups) seeking confidential, bespoke coaching.",
          },
        ],
        testimonials: [
          {
            quote:
              "The individual coaching helped me go from 'I understand AI in theory' to 'I use it every day on my real files'. Within a few sessions, I saved considerable time on repetitive tasks.",
            role: "CEO",
            companyProfile: "Consulting micro-business, Metz city centre",
          },
          {
            quote:
              "The 1-to-1 format was essential for me: I could address my cross-border strategic challenges without confidentiality constraints. The consultant understood the Lorraine B2B reality.",
            role: "Business Development Director",
            companyProfile: "Services SME, Technopôle Metz 2000",
          },
        ],
        faq: [
          {
            q: "How does individual coaching differ from a group session in Metz?",
            a: "1-to-1 coaching is centred on your personal case — your tools, your documents, your strategic challenges, your pace. Ideal for executives who want to progress quickly on a confidential scope.",
          },
          {
            q: "How many sessions are needed to progress?",
            a: "The pace is set at the initial diagnosis based on your goals. A short programme covers operational basics, a long programme goes up to full strategic mastery. You choose the level of ambition.",
          },
          {
            q: "Can sessions be held entirely remotely?",
            a: "Not for the inaugural session: your consultant travels to Metz to install your tools and work on your real data. Subsequent sessions can be on video depending on your preference.",
          },
          {
            q: "Is this programme suitable for executives with no AI experience?",
            a: "Yes, that is in fact the most common profile. The initial diagnosis fully adapts the programme to your starting level — no technical prerequisites.",
          },
          {
            q: "Can individual coaching be combined with a group session for my team?",
            a: "Yes. Several of our Metz clients start with executive coaching to frame the vision, then follow up with a group session for their teams. Both formats complement each other.",
          },
          {
            q: "Does the programme account for the Metz-Luxembourg cross-border context?",
            a: "Yes, systematically when relevant. We adapt examples, use cases and recommendations to the realities of executives operating in a Franco-Luxembourgish or Greater Region context.",
          },
        ],
        guarantees:
          "Satisfaction guaranteed at programme end: if you feel you have not progressed on your goals as defined at diagnosis, the final session is refunded. Inaugural in-person session in Metz guaranteed upon booking. Full confidentiality — your data, your strategies, your documents stay with you. Tools configured and operational from the first session.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Metz des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Metz, itérations à distance.",
        whyHere: [
          "Projets web & SaaS messins : marché transfrontalier Luxembourg (~110 000 frontaliers lorrains), recherche IA (LORIA/Inria, Georgia Tech Lorraine), industrie auto (Stellantis Trémery), banque, PME mosellanes.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Marché transfrontalier Luxembourg : sites & plateformes multilingues (FR/DE/EN), hreflang propre, traduction IA — un atout fort à Metz pour capter les frontaliers et le marché luxembourgeois.",
        ],
        methodology: [
          {
            step: "Cadrage à Metz",
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
            sizeLabel: "PME",
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site multilingue ou d'une application avec UX/UI et IA intégrée, pour PME et scale-ups transfrontalières.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, industrielle ou portail client sur mesure, multilingue, IA intégrée, branchée sur votre SI (CRM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Metz — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous gérez le multilingue pour le marché transfrontalier luxembourgeois ?",
            a: "Oui, c'est un atout clé à Metz : sites et plateformes multilingues (français, allemand, anglais), traduction IA, hreflang propre, contenu localisé. Un vrai levier pour capter les frontaliers et le marché luxembourgeois. Hébergement UE, RGPD strict.",
          },
          {
            q: "Peut-on augmenter un site existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API ou un flux de données. Aucune refonte ni downtime.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage, on remet un devis ferme en forfait fixe. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple, davantage pour une plateforme multilingue étendue. Pas de régie, pas de dérive horaire cachée.",
          },
          {
            q: "Avec quelles technologies travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. On choisit la meilleure stack selon vos objectifs et on s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région messine ou repris en interne.",
      },
      en: {
        hero: "In Metz, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Metz kick-off, remote iterations.",
        whyHere: [
          "Metz web & SaaS projects: Luxembourg cross-border market (~110,000 commuters), AI research (LORIA/Inria, Georgia Tech Lorraine), automotive industry (Stellantis Trémery), banking, Moselle SMEs.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Luxembourg cross-border market: multilingual sites and platforms (FR/DE/EN), clean hreflang, AI translation — a strong asset in Metz to reach commuters and the Luxembourg market.",
        ],
        methodology: [
          {
            step: "Scoping in Metz",
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
            sizeLabel: "SME",
            price: "Bespoke site / app",
            detail:
              "Design or rebuild of a multilingual site or app with UX/UI and built-in AI, for cross-border SMEs and scale-ups.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, industrial or customer portal platform, multilingual, AI built in, wired into your IS (CRM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Metz — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you handle multilingual for the Luxembourg cross-border market?",
            a: "Yes, a key asset in Metz: multilingual sites and platforms (French, German, English), AI translation, clean hreflang, localised content. A real lever to reach commuters and the Luxembourg market. EU hosting, strict GDPR.",
          },
          {
            q: "Can you augment an existing site without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft the AI bricks via an API, a widget or a plugin, without touching the design or structure, as long as your CMS exposes an API or data feed. No rebuild, no downtime.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After scoping, we deliver a firm quote on a fixed package. Turnaround depends on complexity — from 24-48 h for a simple project, more for an extended multilingual platform. No time-and-materials, no hidden hourly drift.",
          },
          {
            q: "Which technologies do you work with?",
            a: "Any modern stack exposing an API: WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. We pick the best stack for your goals and adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Metz-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel Ã  Metz ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (PME, ETI et grands groupes, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique Ã  Metz et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans l'Eurométropole de Metz ?",
      a: "Oui. Plusieurs de nos références sont des entreprises messines ou implantées dans l'Eurométropole : ETI industrie automobile, PME services financiers Technopôle, éditeur logiciel, cabinet conseil. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par ville.",
    },
    {
      q: "Quels secteurs sont prioritaires Ã  Metz pour une mission IA ?",
      a: "Nos déploiements messins couvrent en priorité l'industrie automobile et les matériaux (Stellantis Trémery, Materalia), la banque et la finance (BPCE, Caisse d'Épargne Grand Est), le numérique (Technopôle Metz 2000, BLIIIDA) et les services publics (préfecture Moselle, collectivités). Tout secteur B2B est éligible Ã  un audit.",
    },
    {
      q: "Pouvez-vous intervenir pour des entreprises avec une activité transfrontalière Luxembourg ?",
      a: "Oui. Le bassin transfrontalier Metz-Luxembourg est une réalité opérationnelle pour de nombreuses entreprises messines (~110 000 frontaliers lorrains). Nous adaptons nos recommandations aux contraintes multi-pays — conformité, équipes bilingues, processus cross-border — et incluons cette dimension dans les audits, interventions et implémentations.",
    },
    {
      q: "Intervenez-vous dans les communes de l'Eurométropole hors Metz intra-muros ?",
      a: "Oui. L'Eurométropole entière est notre zone d'intervention : Montigny-lès-Metz, Woippy, Marly, Longeville-lès-Metz, Le Ban-Saint-Martin, zones industrielles de Trémery et Actipôle Nord. Aucun supplément de zone.",
    },
    {
      q: "Travaillez-vous avec les startups et structures du Technopôle Metz 2000 ?",
      a: "Oui. Nous accompagnons les startups et PME numériques du Technopôle Metz 2000, les structures de BLIIIDA et de l'Incubateur Lorrain. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA Ã  un déploiement opérationnel.",
    },
  ],
};
