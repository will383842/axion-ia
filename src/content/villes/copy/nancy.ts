// Nancy (54395) — contenu éditorial Sprint City Quality V3 2026-05-20.
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
// Sources économiques : economic-data/nancy.ts (Sprint City Quality V3, ville #39).
// Réalités locales : Place Stanislas UNESCO 1983, École de Nancy Art Nouveau (Gallé,
// Daum, Majorelle), Université de Lorraine ~52 000 étudiants, campus Artem
// (Mines Nancy + ICN + ENSAD), Technopôle Henri Poincaré Brabois (santé/IA/
// robotique chirurgicale CHRU), CHRU de Nancy, Inria Nancy Grand Est, Saint-Gobain PAM
// (Pont-à-Mousson), Pôle Materalia, French Tech East, Grand Nancy Innovation.

import type { VilleCopy } from "./types";

export const NANCY_COPY: VilleCopy = {
  pitchFr:
    "Nancy rassemble 4 334 établissements actifs, le premier pôle universitaire du Grand Est (Université de Lorraine, Mines Nancy, ICN, Sciences Po Campus Européen, ~52 000 étudiants), le Technopôle Henri Poincaré Brabois (santé, IA, robotique chirurgicale), le CHRU et des groupes industriels majeurs (Saint-Gobain PAM). Axion-IA y intervient sur site, des TPE nancéiennes aux ETI industrielles du bassin lorrain.",
  pitchEn:
    "Nancy brings together 4,334 active businesses, the Grand Est's leading university cluster (Université de Lorraine, Mines Nancy, ICN, Sciences Po European Campus, ~52,000 students), the Henri Poincaré Brabois Technopole (health, AI, surgical robotics), the CHRU and major industrial groups (Saint-Gobain PAM). Axion-IA delivers on site, from Nancy micro-businesses to industrial mid-caps across the Lorraine basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Nancy : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI, calibrés pour les TPE du centre-ville, les ETI industrielles du bassin lorrain et les organisations de santé du Brabois.",
      en: "Operational AI audit in Nancy: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, calibrated for Nancy city-centre micro-businesses, Lorraine basin industrial mid-caps and Brabois health organisations.",
    },
    interventions: {
      fr: "Interventions IA à Nancy : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste, adaptés à leur contexte — industrie, santé, recherche, tertiaire. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Nancy: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations, adapted to their context — industry, health, research, services. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Nancy : on déploie l'IA dans vos outils existants (CRM, ERP, mails, systèmes de production ou cliniques) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Nancy: we deploy AI into your existing tools (CRM, ERP, email, production or clinical systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Nancy : coaching sur-mesure pour dirigeants, cadres et chercheurs du bassin nancéien. Format 1-to-1 intensif, ancré dans vos cas réels (Technopôle Brabois, campus Artem, industrie). Aucun lock-in, vos acquis restent vôtres.",
      en: "Individual AI coaching in Nancy: bespoke coaching for executives, managers and researchers in the Nancy basin. Intensive 1-to-1 format grounded in your real cases (Brabois Technopole, Artem campus, industry). No lock-in, your learnings stay yours.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME, ETI et organisations nancéiennes — site vitrine premium pour industrie, santé et recherche, portail métier pour Technopôle Brabois et campus Artem, dashboard connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Nancy SMEs, mid-caps and organisations — premium showcase site for industry, health and research, business portal for Brabois Technopole and Artem campus, dashboard connected to your CRM/ERP. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Nancy (54) sur site — centre-ville, Technopôle Henri Poincaré Brabois (Vandœuvre-lès-Nancy), campus Artem et communes du Grand Nancy. Nous accompagnons les TPE, PME, ETI et grandes entreprises nancéiennes (industrie, santé, recherche, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Nancy (54) on site — city centre, Henri Poincaré Brabois Technopole (Vandœuvre-lès-Nancy), Artem campus and Grand Nancy communes. We support Nancy micro-businesses, SMEs, mid-caps and large enterprises (industry, health, research, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Santé, CHRU & Biotech Brabois",
    "Industrie & Matériaux (Saint-Gobain PAM, Materalia)",
    "Enseignement supérieur & Recherche",
    "Commerce & Services aux entreprises",
    "Numérique & Édition logicielle",
    "Énergie (EDF direction régionale)",
  ],

  distancesFr:
    "Gare de Nancy-Ville en cœur de ville — TGV Est (Paris en 1h30). Aéroport Metz-Nancy-Lorraine (Goin) à 32 km. Réseau STAN (bus + trolleybus) pour rejoindre le Technopôle Brabois, campus Artem, Vandœuvre-lès-Nancy, Laxou, Maxéville, Tomblaine. Metz à 45 min, Luxembourg à 1h50 par la route.",
  distancesEn:
    "Nancy-Ville station in the city centre — TGV Est (Paris in 1h30). Metz-Nancy-Lorraine Airport (Goin) 32 km away. STAN network (buses + trolleybuses) to reach Brabois Technopole, Artem campus, Vandœuvre-lès-Nancy, Laxou, Maxéville, Tomblaine. Metz 45 min, Luxembourg 1h50 by road.",

  ecosystemFr:
    "Tissu B2B à dominante publique et industrielle — 4 334 établissements actifs. Pôle universitaire Grand Est majeur (Université de Lorraine, Mines Nancy, ICN, Sciences Po, ~52 000 étudiants, campus Artem), pôle santé-recherche Brabois (CHRU, robotique chirurgicale, Inria, CNRS, INRAE), industrie lorraine (Saint-Gobain PAM, Materalia, EDF Grand Est) et French Tech East (Nancy/Metz/Strasbourg/Reims).",
  ecosystemEn:
    "B2B fabric with a dominant public and industrial character — 4,334 active businesses. Leading Grand Est university cluster (Université de Lorraine, Mines Nancy, ICN, Sciences Po, ~52,000 students, Artem campus), Brabois health-research hub (CHRU, surgical robotics, Inria, CNRS, INRAE), Lorraine industry (Saint-Gobain PAM, Materalia, EDF Grand Est) and French Tech East (Nancy/Metz/Strasbourg/Reims).",

  heroSchema: {
    centerSubLabel: "4 334 établissements actifs",
    satellites: [
      { label: "Brabois", detail: "CHRU + IA + robotique", accent: "primary" },
      { label: "Artem", detail: "Mines Nancy · ICN · ENSAD", accent: "terracotta" },
      { label: "Industrie", detail: "Saint-Gobain PAM · Materalia", accent: "mocha" },
      { label: "Inria", detail: "IA · algo · sécurité", accent: "sage" },
      { label: "Université", detail: "~52 000 étudiants", accent: "primary" },
      { label: "Place Stanislas", detail: "UNESCO 1983", accent: "terracotta" },
    ],
  },

  // === SERVICES LONG-FORM NANCY ===
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation nancéienne et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre-ville aux ETI industrielles du bassin lorrain et aux directions des organisations de santé du Technopôle Brabois.",
        whyHere: [
          "Nancy est un carrefour B2B singulier : tissu académique et de recherche dense (Université de Lorraine, Mines Nancy, Inria, CHRU) coexistant avec une industrie lorraine robuste (Saint-Gobain PAM, Materalia) — chaque type d'organisation a ses cas IA propres que nous maîtrisons.",
          "Pôle santé-recherche Brabois de rang national : CHRU, robotique chirurgicale, Inria Nancy Grand Est, CNRS Centre-Est, INRAE Grand Est-Nancy — secteur R&D intense où l'IA accélère la gestion documentaire, l'analyse de données cliniques et la veille réglementaire.",
          "Tissu industriel dense dans le bassin lorrain : Saint-Gobain PAM (Pont-à-Mousson), Pôle Materalia (matériaux, énergie, aéronautique, médical), EDF direction régionale — avec des besoins IA précis sur la maintenance prédictive, la gestion de production et la relation client.",
          "Nos consultants se déplacent sur l'ensemble du Grand Nancy : centre-ville, Vandœuvre-lès-Nancy (Brabois), Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max et les communes proches.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux nancéiens, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Pour les organisations de santé (CHRU, dispositifs médicaux) et les industriels du bassin lorrain, nous documentons en amont les contraintes de souveraineté et de réglementation sectorielle.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Nancy dans vos locaux — centre-ville, Brabois, campus Artem, commune du Grand Nancy — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, finance, R&D, production, support, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités sectorielles nancéiennes (protocoles cliniques, contraintes industrie matériaux, conformité réglementaire).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports analytiques, vos données de production ou cliniques. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux nancéiens. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur — industrie, santé, recherche ou services tertiaires.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et petites structures nancéiennes — centre-ville, quartier Charles III, Rives de Meurthe.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME de services, les startups issues du Grand Nancy Innovation ou de l'Incubateur Lorrain, les cabinets et agences de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (Materalia, bassin Pont-à-Mousson), les ETI de santé ou les organisations de recherche souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes implantés dans le bassin nancéien — Saint-Gobain PAM, EDF direction régionale, CHRU de Nancy et organismes de recherche public.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a livré un audit opérationnel ciblé sur nos processus de production. Le rapport est chiffré, actionnable, compréhensible par nos équipes terrain. On a pu prioriser nos chantiers IA dès la semaine suivante.",
            role: "Directeur industriel",
            companyProfile: "ETI industrie, bassin lorrain Nancy",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes réelles plutôt que des slides génériques. Le livrable nous a permis de présenter un plan IA crédible à notre direction régionale.",
            role: "Responsable innovation",
            companyProfile: "PME services B2B, centre-ville Nancy",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Nancy ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI industrielle du bassin lorrain ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, suivi production, qualification appels d'offres, lecture factures fournisseurs). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données cliniques ou industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs santé (CHRU, dispositifs médicaux) et industrie (Materalia), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Nancy ?",
            a: "Toujours en présentiel dans vos locaux nancéiens. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes du Grand Nancy ?",
            a: "Oui. Le Grand Nancy est notre terrain d'intervention complet : Vandœuvre-lès-Nancy (Brabois), Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits nancéiens sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés comme la santé ou l'industrie.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Nancy organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Nancy micro-businesses to Lorraine basin industrial mid-caps and Brabois Technopole health organisations.",
        whyHere: [
          "Nancy is a distinctive B2B junction: dense academic and research fabric (Université de Lorraine, Mines Nancy, Inria, CHRU) coexisting with robust Lorraine industry (Saint-Gobain PAM, Materalia) — each type of organisation has its own AI use cases we master.",
          "National-level Brabois health-research hub: CHRU, surgical robotics, Inria Nancy Grand Est, CNRS Centre-Est, INRAE Grand Est-Nancy — R&D-intensive sector where AI accelerates document management, clinical data analysis and regulatory monitoring.",
          "Dense industrial fabric across the Lorraine basin: Saint-Gobain PAM (Pont-à-Mousson), Materalia cluster (materials, energy, aeronautics, medical), EDF regional division — with specific AI needs in predictive maintenance, production management and customer relations.",
          "Our consultants travel across the full Grand Nancy: city centre, Vandœuvre-lès-Nancy (Brabois), Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max and surrounding communes.",
          "Read-outs always in person: ideation workshops at your Nancy offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). For health organisations (CHRU, medical devices) and Lorraine basin industrials, we document sovereignty and sector-specific regulatory constraints upfront.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Nancy at your offices — city centre, Brabois, Artem campus, Grand Nancy commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, R&D, production, support, leadership) to map frictions and expectations, accounting for Nancy sector specifics (clinical protocols, materials industry constraints, regulatory compliance).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production or clinical data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Nancy offices. Costed PDF deliverable handed over, actionable roadmap tailored to your sector — industry, health, research or services.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Nancy freelancers, micro-firms and small structures — city centre, Charles III district, Rives de Meurthe.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for service SMEs, startups from Grand Nancy Innovation or Incubateur Lorrain, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (Materalia, Pont-à-Mousson basin), health mid-caps or research organisations framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups in the Nancy basin — Saint-Gobain PAM, EDF regional division, CHRU de Nancy and public research bodies.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a targeted operational audit on our production processes. The report is costed, actionable, understandable by our field teams. We could prioritise our AI initiatives the following week.",
            role: "Industrial Director",
            companyProfile: "Industrial mid-cap, Lorraine basin Nancy",
          },
          {
            quote:
              "Pragmatic method, demos on our actual internal data rather than generic slides. The deliverable let us present a credible AI plan to our regional leadership.",
            role: "Innovation Manager",
            companyProfile: "B2B services SME, Nancy city centre",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Nancy?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a Lorraine basin industrial mid-cap?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, production tracking, tender qualification, supplier invoice reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my clinical or industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For health (CHRU, medical devices) and industry (Materalia) sectors, we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Nancy?",
            a: "Always in person at your Nancy offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Grand Nancy communes?",
            a: "Yes. The Grand Nancy is our full territory: Vandœuvre-lès-Nancy (Brabois), Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Nancy audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors like health or industry.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Nancy se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en industrie, en laboratoire, en milieu clinique ou en bureau. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Nancy est un terrain d'intervention multi-sectoriel : organisations de santé et de recherche (CHRU, Inria, CNRS), industrie lorraine (Saint-Gobain PAM, Materalia), enseignement supérieur (Mines Nancy, ICN, Polytech Nancy) et services tertiaires centre-ville.",
          "Tous les quartiers et communes du Grand Nancy couverts en présentiel : centre-ville, Brabois (Vandœuvre-lès-Nancy), campus Artem, Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max.",
          "Le format Essentielle est calibré pour les structures nancéiennes de quelques personnes à une centaine de collaborateurs, en particulier les PME de services, les cabinets et les équipes de recherche du campus Artem.",
          "Le format Conférence convient aux plénières d'entreprise ou aux séminaires institutionnels (salles CHRU, espaces de congrès Grand Nancy).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des grandes organisations du bassin nancéien.",
          "Vocabulaire ajusté à votre secteur dominant : industrie des matériaux, santé/médical, recherche académique, services B2B, agroalimentaire. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires santé ou industrie — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, emails, comptes-rendus cliniques, données de production, dossiers R&D) pour calibrer les démos sur VOS données nancéiennes.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux nancéiens pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes déconnectés ou les infrastructures hospitalières sécurisées.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle nancéienne.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau centre-ville, au labo Brabois ou en atelier industriel.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, petits cabinets et structures nancéiennes jusqu'à une dizaine de collaborateurs — centre-ville, quartier Rives de Meurthe, communes proches.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour un département — R&D, commercial, finance, opérations — particulièrement efficace pour les PME issues du Grand Nancy Innovation ou de l'Incubateur Lorrain.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, organisations de santé) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grandes structures nancéiennes — roadshow multi-sites Grand Nancy, séminaires CODIR + cascade équipes terrain, laboratoires ou ateliers industriels.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a collé aux attentes de nos équipes R&D. Ils sont repartis avec leurs outils configurés sur leurs vrais protocoles de recherche. Dès le lendemain, plusieurs rédigeaient des comptes-rendus d'expériences avec l'IA.",
            role: "Directrice R&D",
            companyProfile: "PME recherche appliquée, Brabois Nancy",
          },
          {
            quote:
              "La session dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles — pas de session générique, des cas concrets qui parlaient à nos équipes industrielles.",
            role: "Directeur général",
            companyProfile: "ETI industrie, bassin lorrain Nancy",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Nancy ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements hospitaliers ou industriels ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements hospitaliers (CHRU, protocoles accès services) et industriels — postes déconnectés, VLAN sécurisés, protocoles accès site. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur santé ou industrie matériaux nancéien ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe du CHRU n'a rien à voir avec une session pour une ETI de Saint-Gobain PAM ou une startup du campus Artem.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur nancéien — industrie, santé, recherche, services — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Nancy come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in industry, in the lab, in clinical settings or at the office. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Nancy is a multi-sector engagement ground: health and research organisations (CHRU, Inria, CNRS), Lorraine industry (Saint-Gobain PAM, Materalia), higher education (Mines Nancy, ICN, Polytech Nancy) and city-centre services.",
          "All Grand Nancy districts and communes covered in person: city centre, Brabois (Vandœuvre-lès-Nancy), Artem campus, Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max.",
          "The Essential format is calibrated for Nancy structures from a few people to about a hundred staff, particularly service SMEs, consulting firms and research teams on the Artem campus.",
          "The Talk format suits corporate plenaries or institutional seminars (CHRU conference rooms, Grand Nancy congress spaces).",
          "The Executives format enables in-camera framing for executive committees of Lorraine basin industrial mid-caps and large organisations.",
          "Vocabulary adjusted to your dominant sector: materials industry, health/medical, academic research, B2B services, agri-food. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including health or industrial regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, emails, clinical summaries, production data, R&D files) to calibrate demos on YOUR Nancy data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Nancy offices to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with air-gapped workstations or secured hospital infrastructure.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Nancy sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a city-centre office, Brabois lab or industrial workshop.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Nancy freelancers, small practices and structures up to about ten staff — city centre, Rives de Meurthe district, nearby communes.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on a department — R&D, sales, finance, operations — particularly effective for SMEs from Grand Nancy Innovation or Incubateur Lorrain.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, health organisations) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large Nancy organisations — multi-site Grand Nancy roadshows, exec committee seminars + field team, lab or industrial workshop cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format matched our R&D team's needs. They left with tools configured for their real research protocols. By the next day, several were already writing up experiment summaries with AI.",
            role: "R&D Director",
            companyProfile: "Applied research SME, Brabois Nancy",
          },
          {
            quote:
              "The executive session aligned us within a day on our AI trajectory. The consultant knew our sector constraints — no generic session, concrete cases that resonated with our industrial teams.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Lorraine basin Nancy",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Nancy take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in hospital or industrial environments?",
            a: "Yes. Our consultants adapt to hospital (CHRU, service access protocols) and industrial environment constraints — air-gapped workstations, secure VLANs, site access protocols. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Nancy health or materials industry sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a CHRU team has nothing to do with one for a Saint-Gobain PAM mid-cap or an Artem campus startup.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Nancy sector — industry, health, research, services — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Nancy met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux nancéiens — centre-ville, Brabois, campus Artem ou commune du Grand Nancy.",
        whyHere: [
          "Nancy concentre des profils d'implémentation variés : organisations de santé et de recherche (CHRU, Inria, CNRS, INRAE) à fort besoin documentaire et réglementaire, ETI industrielles (Saint-Gobain PAM, Materalia) à fort besoin de production, PME de services et startups deeptech issues du Grand Nancy Innovation.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux nancéiens : alignement des équipes, accès aux données de production, cliniques ou de recherche, validation des intégrations CRM/ERP/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Nancy : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques nancéiens : CHRU (gestion documentaire médicale, aide à la décision clinique), ETI industrielles (automatisation rapports qualité, maintenance prédictive), organisations de recherche Inria/CNRS (veille scientifique, synthèse documentaire), PME services (qualification prospects, génération documents), startups campus Artem (agents support, accélération R&D).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Nancy : revue de l'architecture cible (CRM, ERP, LIMS, systèmes industriels ou cliniques), validation des contraintes RGPD/sécurité et réglementaires (santé, industrie, recherche publique), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Nancy : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Nancy : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants nancéiens.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME de services, startups Grand Nancy Innovation, cabinets et agences de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, LIMS, datalake), formation ambassadeurs cross-département. Adapté aux ETI industrielles (Materalia) et aux organisations de santé du bassin nancéien.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Nancy : Saint-Gobain PAM, EDF direction régionale, CHRU — cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation rapports documentaires médicaux livrée comme promis. ROI mesuré dès les premiers mois : nos équipes passent moins de temps sur l'administratif et plus sur le soin. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directrice qualité",
            companyProfile: "Organisation de santé, Technopôle Brabois Nancy",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le labo et les bureaux du centre-ville. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME deeptech, campus Artem Nancy",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Nancy ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions nancéiennes. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données cliniques ou industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés nancéiens (santé, médical, industrie), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (données cliniques, pièces critiques, dossiers réglementaires), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Nancy brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Nancy offices — city centre, Brabois, Artem campus or a Grand Nancy commune.",
        whyHere: [
          "Nancy brings together varied implementation profiles: health and research organisations (CHRU, Inria, CNRS, INRAE) with heavy documentary and regulatory needs, industrial mid-caps (Saint-Gobain PAM, Materalia) with production needs, and service SMEs and deeptech startups from Grand Nancy Innovation.",
          "Kick-off always happens in person at your Nancy offices: team alignment, access to production, clinical or research data, CRM/ERP/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Nancy: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Nancy cases: CHRU (medical document management, clinical decision support), industrial mid-caps (quality report automation, predictive maintenance), Inria/CNRS research (scientific monitoring, document synthesis), service SMEs (prospect qualification, document generation), Artem campus startups (support agents, R&D acceleration).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Nancy workshop: target architecture review (CRM, ERP, LIMS, industrial or clinical systems), GDPR/security and regulatory constraints validation (health, industry, public research), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Nancy: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Nancy: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Nancy micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For service SMEs, Grand Nancy Innovation startups, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, LIMS, datalake), cross-department ambassador training. Tailored for Lorraine basin industrial and health mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Nancy large accounts: Saint-Gobain PAM, EDF regional division, CHRU — cascaded multi-site use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Medical document automation implementation delivered as promised. ROI measured within the first months: our teams spend less time on admin and more on care. No lock-in, we control our deployment.",
            role: "Quality Director",
            companyProfile: "Health organisation, Brabois Technopole Nancy",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the lab and the city-centre offices. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Deeptech SME, Artem campus Nancy",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Nancy take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Nancy missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my clinical or industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Nancy regulated sectors (health, medical, industry), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (clinical data, critical components, regulatory files), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel IA Axion-IA à Nancy est un coaching 1-to-1 intensif pour dirigeants, cadres et chercheurs du bassin nancéien qui veulent passer de la découverte de l'IA à une maîtrise opérationnelle réelle. Chaque séance est ancrée dans vos cas concrets — Technopôle Brabois, campus Artem, industrie lorraine, services tertiaires. Aucun lock-in, vos acquis restent vôtres.",
        whyHere: [
          "Nancy est un terrain fertile pour le coaching individuel IA : dirigeants de PME industrielles, médecins-chercheurs du CHRU, ingénieurs Mines Nancy et chercheurs Inria cherchent un accompagnement ancré dans leur réalité sectorielle précise, pas une formation générique.",
          "Format ultra-personnalisé : le programme est construit autour de VOS cas d'usage, VOS outils, VOS contraintes réglementaires (santé, industrie, recherche publique) — aucun module préfabriqué.",
          "Disponibilité Grand Nancy et distance : sessions en présentiel dans vos locaux nancéiens ou en distanciel selon vos préférences. Frais de logement, repas et forfait trajet en sus pour les sessions sur site.",
          "Progression rapide : en quelques sessions, vous maîtrisez les outils IA opérationnels (Claude, GPT, Mistral, Perplexity) appliqués à votre métier réel, pas à des exemples génériques.",
          "Confidentiel et sans jugement : espace d'apprentissage sécurisé pour diriger, questionner, tester. Particulièrement apprécié par les cadres dirigeants qui ne veulent pas exposer leur niveau devant leurs équipes.",
          "Transfert durable : vous repartez avec des prompts, des workflows et des réflexes IA que vous continuez à utiliser après la fin de l'accompagnement — sans dépendance au consultant.",
        ],
        methodology: [
          {
            step: "Bilan d'entrée",
            detail:
              "Un entretien approfondi pour cartographier votre usage actuel de l'IA, vos objectifs prioritaires et vos cas d'usage métier nancéiens — direction d'ETI industrielle, médecine/recherche CHRU, ingénierie Mines Nancy, management PME services.",
          },
          {
            step: "Programme sur-mesure",
            detail:
              "Construction d'un parcours personnalisé en plusieurs séances, avec des livrables concrets à chaque étape : prompts testés sur vos vrais documents, workflows automatisés sur vos outils existants, cas d'usage démontrés en direct.",
          },
          {
            step: "Séances de travail",
            detail:
              "Sessions intensives en présentiel ou distanciel, centrées sur la pratique immédiate. Chaque heure produit un livrable utilisable : prompt calibré, workflow documenté, cas d'usage maîtrisé.",
          },
          {
            step: "Ancrage et autonomisation",
            detail:
              "Exercices entre séances pour ancrer les réflexes IA dans votre quotidien professionnel nancéien. Suivi d'avancement à chaque session pour ajuster le programme si vos priorités évoluent.",
          },
          {
            step: "Bilan de clôture",
            detail:
              "Session finale pour mesurer les acquis, consolider le kit de prompts et workflows personnels, et définir votre feuille de route IA autonome — sans Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pack individuel",
            detail:
              "Pour indépendants, artisans et micro-entrepreneurs nancéiens souhaitant intégrer l'IA dans leur quotidien professionnel — centre-ville, activités tertiaires, artisanat.",
          },
          {
            sizeLabel: "PME",
            price: "Pack dirigeant ou cadre clé",
            detail:
              "Pour les dirigeants et cadres de PME nancéiennes (services, industrie légère, startups campus Artem) souhaitant monter en compétence IA sans exposer leur progression devant leurs équipes.",
          },
          {
            sizeLabel: "ETI",
            price: "Pack dirigeant ETI ou médecin-chercheur",
            detail:
              "Accompagnement intensif pour DG, DRH, DSI ou directeurs de département d'ETI industrielles (Materalia), de structures de santé (CHRU Brabois) ou d'organismes de recherche (Inria, CNRS).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Accompagnement individuels multiples pour équipes dirigeantes de grands comptes nancéiens (Saint-Gobain PAM, EDF, CHRU) — programme cohérent multi-profils sur plusieurs mois.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'accompagnement individuel m'a permis de passer de « je sais que l'IA existe » à « je l'utilise chaque jour sur mes vrais dossiers médicaux ». Pace parfaite, zéro jugement, résultats concrets dès la deuxième séance.",
            role: "Médecin-chercheur",
            companyProfile: "CHRU Nancy, Technopôle Brabois",
          },
          {
            quote:
              "En tant que dirigeant d'ETI industrielle, je n'avais pas envie d'apprendre devant mes équipes. Le format 1-to-1 m'a permis de tester, rater, recommencer en toute confiance. Je suis maintenant celui qui montre l'exemple.",
            role: "Directeur général",
            companyProfile: "ETI industrie, bassin lorrain Nancy",
          },
        ],
        faq: [
          {
            q: "Combien de séances faut-il pour maîtriser l'IA opérationnelle à Nancy ?",
            a: "Cela dépend de votre point de départ et de vos objectifs. Le bilan d'entrée permet de calibrer le nombre de séances nécessaires. La plupart de nos coachés nancéiens constatent des résultats concrets dès les premières séances et atteignent une autonomie réelle au fil du programme.",
          },
          {
            q: "Les séances se déroulent-elles en présentiel à Nancy ?",
            a: "Les deux options sont disponibles : présentiel dans vos locaux nancéiens (Brabois, campus Artem, centre-ville, communes Grand Nancy) ou distanciel selon vos préférences. Frais de logement, repas et forfait trajet en sus pour les sessions sur site.",
          },
          {
            q: "Le contenu est-il vraiment personnalisé à mon métier nancéien ?",
            a: "Oui. Le programme est construit autour de VOS cas d'usage réels — médecine et recherche clinique pour le CHRU, ingénierie matériaux pour Materalia, direction d'ETI industrielle pour le bassin lorrain. Aucun module générique préfabriqué.",
          },
          {
            q: "Mes échanges et données sont-ils confidentiels ?",
            a: "Totalement. Confidentialité stricte dès le démarrage. Vos documents de travail, vos cas d'usage et vos échanges restent strictement confidentiels. Aucune data transmise à des tiers.",
          },
          {
            q: "Puis-je continuer à utiliser les outils après la fin du coaching ?",
            a: "Oui. Vous repartez avec vos propres comptes sur les outils (ChatGPT, Claude, Mistral, etc.), vos prompts calibrés et vos workflows documentés. Aucun abonnement Axion-IA requis après la fin du programme.",
          },
          {
            q: "Ce coaching est-il adapté si je n'ai aucune base en IA ?",
            a: "Oui. La majorité de nos coachés nancéiens débutent sans aucune expérience IA pratique. Le format 1-to-1 est précisément conçu pour avancer à votre rythme, sans pression de groupe, en repartant de vos vrais besoins métier.",
          },
        ],
        guarantees:
          "Programme construit sur mesure dès le bilan d'entrée : aucun module générique. Confidentialité totale. Chaque séance produit un livrable utilisable immédiatement. Si après les deux premières séances vous estimez que le coaching ne correspond pas à vos attentes, remboursement intégral des séances restantes. Aucun lock-in : vos acquis, vos prompts, vos workflows vous appartiennent entièrement.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Nancy is an intensive 1-to-1 for executives, managers and researchers in the Nancy basin who want to move from AI discovery to real operational mastery. Each session is grounded in your concrete cases — Brabois Technopole, Artem campus, Lorraine industry, business services. No lock-in, your learnings stay yours.",
        whyHere: [
          "Nancy is fertile ground for individual AI coaching: industrial SME executives, CHRU clinician-researchers, Mines Nancy engineers and Inria researchers seek coaching rooted in their precise sector reality, not a generic training programme.",
          "Ultra-personalised format: the programme is built around YOUR use cases, YOUR tools, YOUR regulatory constraints (health, industry, public research) — no prefabricated modules.",
          "Grand Nancy availability and remote: sessions in person at your Nancy offices or remotely per your preference. Lodging, meals and travel allowance billed separately for on-site sessions.",
          "Fast progression: within a few sessions, you master operational AI tools (Claude, GPT, Mistral, Perplexity) applied to your real work, not generic examples.",
          "Confidential and non-judgmental: safe learning space to lead, question, test. Particularly valued by senior executives who don't want to expose their learning curve in front of their teams.",
          "Lasting transfer: you leave with prompts, workflows and AI reflexes you continue to use after coaching ends — no consultant dependency.",
        ],
        methodology: [
          {
            step: "Entry assessment",
            detail:
              "An in-depth interview to map your current AI use, priority objectives and Nancy-specific use cases — industrial mid-cap management, CHRU medicine/research, Mines Nancy engineering, service SME management.",
          },
          {
            step: "Bespoke programme",
            detail:
              "Construction of a personalised multi-session pathway, with concrete deliverables at each step: prompts tested on your real documents, automated workflows on your existing tools, use cases demonstrated live.",
          },
          {
            step: "Working sessions",
            detail:
              "Intensive sessions in person or remote, focused on immediate practice. Each hour produces a usable deliverable: calibrated prompt, documented workflow, mastered use case.",
          },
          {
            step: "Anchoring and autonomisation",
            detail:
              "Exercises between sessions to anchor AI reflexes in your daily Nancy professional life. Progress check at each session to adjust the programme if your priorities evolve.",
          },
          {
            step: "Closing review",
            detail:
              "Final session to measure achievements, consolidate your personal prompts and workflows kit, and define your autonomous AI roadmap — without Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual pack",
            detail:
              "For Nancy freelancers, artisans and micro-entrepreneurs wishing to integrate AI into their professional daily life — city centre, services, crafts.",
          },
          {
            sizeLabel: "SME",
            price: "Executive or key manager pack",
            detail:
              "For executives and managers of Nancy SMEs (services, light industry, Artem campus startups) who want to upskill in AI without exposing their progression to their teams.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive or clinician-researcher pack",
            detail:
              "Intensive coaching for CEOs, CHROs, CIOs or department heads of industrial mid-caps (Materalia), health structures (Brabois CHRU) or research bodies (Inria, CNRS).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom programme on quote",
            detail:
              "Multiple individual coaching sessions for executive teams of Nancy large accounts (Saint-Gobain PAM, EDF, CHRU) — coherent multi-profile programme over several months.",
          },
        ],
        testimonials: [
          {
            quote:
              "The individual coaching took me from 'I know AI exists' to 'I use it every day on my real medical files'. Perfect pace, zero judgement, concrete results from the second session.",
            role: "Clinician-researcher",
            companyProfile: "CHRU Nancy, Brabois Technopole",
          },
          {
            quote:
              "As an industrial mid-cap CEO, I didn't want to learn in front of my teams. The 1-to-1 format let me test, fail, try again in full confidence. I'm now the one setting the example.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Lorraine basin Nancy",
          },
        ],
        faq: [
          {
            q: "How many sessions does it take to master operational AI in Nancy?",
            a: "It depends on your starting point and objectives. The entry assessment calibrates the number of sessions needed. Most of our Nancy coachees see concrete results within the first sessions and reach real autonomy through the programme.",
          },
          {
            q: "Do sessions take place in person in Nancy?",
            a: "Both options are available: in person at your Nancy offices (Brabois, Artem campus, city centre, Grand Nancy communes) or remotely per your preference. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "Is the content truly personalised to my Nancy work context?",
            a: "Yes. The programme is built around YOUR real use cases — clinical medicine and research for CHRU, materials engineering for Materalia, industrial mid-cap management for the Lorraine basin. No prefabricated generic modules.",
          },
          {
            q: "Are my exchanges and data confidential?",
            a: "Completely. Strict confidentiality at kick-off. Your working documents, use cases and exchanges remain strictly confidential. No data passed to third parties.",
          },
          {
            q: "Can I keep using the tools after coaching ends?",
            a: "Yes. You leave with your own accounts on the tools (ChatGPT, Claude, Mistral, etc.), your calibrated prompts and your documented workflows. No Axion-IA subscription required after the programme ends.",
          },
          {
            q: "Is this coaching suited if I have no AI background?",
            a: "Yes. The majority of our Nancy coachees start with no practical AI experience. The 1-to-1 format is precisely designed to progress at your pace, without group pressure, starting from your real business needs.",
          },
        ],
        guarantees:
          "Programme built on entry assessment: no generic modules. Full confidentiality. Each session produces an immediately usable deliverable. If after the first two sessions you feel the coaching does not meet your expectations, full refund of remaining sessions. No lock-in: your achievements, prompts and workflows belong entirely to you.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Nancy ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Nancy et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans le Grand Nancy ?",
      a: "Oui. Nos références couvrent des organisations de santé Brabois, des ETI industrielles du bassin lorrain, des startups du campus Artem et des PME de services du centre-ville nancéien. Les cas récents sont consultables dans la rubrique Cas concrets.",
    },
    {
      q: "Quels secteurs sont prioritaires à Nancy pour une mission IA ?",
      a: "Nos déploiements nancéiens couvrent en priorité la santé et la recherche (CHRU, Inria, CNRS, INRAE Brabois), l'industrie et les matériaux (Saint-Gobain PAM, Materalia), l'enseignement supérieur (Université de Lorraine, Mines Nancy, ICN) et les services tertiaires. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir dans les communes du Grand Nancy ?",
      a: "Oui. Le Grand Nancy est notre zone d'intervention complète : Vandœuvre-lès-Nancy (Brabois), Laxou, Villers-lès-Nancy, Maxéville, Tomblaine, Jarville-la-Malgrange, Saint-Max. Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Nancy ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les startups deeptech et les spin-offs du Grand Nancy ?",
      a: "Oui. Nous accompagnons les startups et spin-offs de l'Incubateur Lorrain (Université de Lorraine), du Grand Nancy Innovation et du campus Artem (Mines Nancy, ICN). Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
