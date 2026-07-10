// Nantes (44109) — contenu éditorial gold standard VilleCopy.
//
// Doctrine identique à paris.ts :
//   - Aucun délai chiffré concret.
//   - Aucun « frais de déplacement intégrés » : frais logement, repas et
//     forfait trajet sont TOUJOURS en sus pour les interventions.
//   - Durée minimale = 1 journée. Aucune demi-journée.
//   - Aucun prix hardcodé : libellés seulement, tarifs via pricing.ts.
//   - Tailles entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data locale anti-doorway HCU 2024.
//   - Pas de heroSchema, pas de unAUn (hors scope demande initiale).
//
// Réalités économiques Nantes utilisées (sourcées economic-data/nantes.ts) :
//   - Airbus Bouguenais, Chantiers de l'Atlantique (bassin Saint-Nazaire),
//     IRT Jules Verne, pôle EMC2 manufacturing/composites.
//   - Agroalimentaire : LU, Petit Navire, Lactalis Loire-Atlantique,
//     Muscadet AOC, Mâche Nantaise IGP.
//   - French Tech Nantes capitale, La Cantine numérique, IMT Starter.
//   - Atlanpole Biotherapies, INSERM Grand Ouest, Inria antenne Nantes.
//   - Île de Nantes / quartier de la création (ICC + numérique).
//   - Audencia, Centrale Nantes, IMT Atlantique, Nantes Université.
//   - Capgemini, BNP Paribas siège régional, Bouygues Grand Ouest.
//   - Euronantes Gare (quartier tertiaire), ZAP GPMNSN.
//   - TGV Paris-Montparnasse en 2h, aéroport Nantes Atlantique à 8 km.

import type { VilleCopy } from "./types";

export const NANTES_COPY: VilleCopy = {
  pitchFr:
    "Nantes rassemble un tissu industriel et numérique unique : aéronautique Airbus, chantiers navals, agroalimentaire LU et Petit Navire, Atlanpole Biotherapies, quartier de la création Île de Nantes et French Tech Nantes capitale. Axion-IA y intervient sur site pour les TPE, PME, ETI et grandes entreprises du Grand Ouest.",
  pitchEn:
    "Nantes brings together a unique industrial and digital fabric: Airbus aeronautics, shipyards, LU and Petit Navire agri-food, Atlanpole Biotherapies, Île de Nantes creative district and French Tech Nantes capital. Axion-IA delivers on site for micro-businesses, SMEs, mid-caps and large enterprises across the Greater West.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Nantes : nous cartographions ce qui peut être automatisé dans votre structure et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, calibrés pour l'industrie, le numérique, l'agroalimentaire et les services nantais.",
      en: "Operational AI audit in Nantes: we map what can be automated in your organisation and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated for Nantes industry, digital, agri-food and services.",
    },
    interventions: {
      fr: "Interventions IA à Nantes : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste.",
      en: "AI sessions in Nantes: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA à Nantes : on déploie l'IA dans vos outils existants (CRM, ERP, mails, PLM industriel) avec ROI chiffré contractuel. Vos équipes gardent la main, aucun lock-in technologique.",
      en: "AI implementation in Nantes: we deploy AI into your existing tools (CRM, ERP, email, industrial PLM) with contractually-costed ROI. Your teams stay in control, no tech lock-in.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Nantes : accompagnement 1-to-1 ancré dans votre réalité — aéronautique, agroalimentaire, numérique ou biotech. À partir de {{price:intervention-dirigeants|flat}}.",
      en: "Individual AI coaching in Nantes: 1-to-1 support rooted in your reality — aeronautics, agri-food, digital or biotech. From €990 excl. VAT.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI du Grand Ouest — site vitrine premium pour acteurs aéronautiques et agroalimentaires (Airbus, LU), portail client pour scale-ups French Tech Île de Nantes, dashboard métier connecté à votre CRM/ERP/PLM. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Greater West SMEs and mid-caps — premium showcase site for aeronautics and agri-food players (Airbus, LU), client portal for Île de Nantes French Tech scale-ups, business dashboard connected to your CRM/ERP/PLM. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Nantes (44) sur site dans les entreprises de la métropole et du Grand Ouest. Nous accompagnons les TPE, PME, ETI et grandes entreprises nantaises — industrie (Airbus, aéronautique, naval), agroalimentaire (LU, conserveries), numérique (French Tech, Île de Nantes), biotech (Atlanpole) — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Nantes (44) on site across the metropolitan area and Greater West. We support Nantes micro-businesses, SMEs, mid-caps and large enterprises — industry (Airbus, aeronautics, shipyards), agri-food (LU, canneries), digital (French Tech, Île de Nantes), biotech (Atlanpole) — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "naval, agroalimentaire & numérique",

  topSectorsNaf: [
    "Industrie aéronautique & navale",
    "Agroalimentaire & IAA",
    "Numérique & édition logicielle",
    "Biotech & Santé",
    "Conseil & Services aux entreprises",
    "Énergie & Industries créatives",
  ],

  distancesFr:
    "Gare de Nantes intra-muros — TGV Paris-Montparnasse en 2h. Aéroport Nantes Atlantique à 8 km (Bouguenais). Réseau tramway 3 lignes Semitan + Busway pour rejoindre l'Île de Nantes, Euronantes Gare, la Chantrerie, Saint-Herblain et l'ensemble de la métropole.",
  distancesEn:
    "Nantes station city-centre — TGV to Paris Montparnasse in 2h. Nantes Atlantique Airport 8 km away (Bouguenais). 3-line Semitan tram network + Busway to reach Île de Nantes, Euronantes Gare, La Chantrerie, Saint-Herblain and the whole metropolis.",

  ecosystemFr:
    "Métropole industrielle et numérique de rang européen : Airbus (Bouguenais), IRT Jules Verne (manufacturing avancé/composites), Atlanpole Biotherapies (santé), French Tech Nantes capitale, Île de Nantes cluster ICC+numérique (~500 entreprises créatives), Centrale Nantes, IMT Atlantique, Audencia, Capgemini, BNP Paribas siège régional. Agroalimentaire : LU (fondation), Petit Navire, Mâche Nantaise IGP, Muscadet AOC.",
  ecosystemEn:
    "European-tier industrial and digital metropolis: Airbus (Bouguenais), IRT Jules Verne (advanced manufacturing/composites), Atlanpole Biotherapies (health), French Tech Nantes capital, Île de Nantes ICC+digital cluster (~500 creative firms), Centrale Nantes, IMT Atlantique, Audencia, Capgemini, BNP Paribas regional HQ. Agri-food: LU (founding), Petit Navire, Mâche Nantaise PGI, Muscadet AOC.",

  // ============================================================
  // SERVICES LONG-FORM NANTES
  // ============================================================
  services: {
    // ──────────────────────────────────────────────────────────
    // AUDIT
    // ──────────────────────────────────────────────────────────
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Nantes cartographie ce qui peut être automatisé dans votre structure et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux couvrent toutes les tailles, des TPE indépendantes nantaises aux grandes entreprises industrielles de la métropole. Résultat : un livrable PDF actionnable remis en présentiel, sans jargon, sans lock-in.",
        whyHere: [
          "Nantes est un pôle stratégique pour Axion-IA : industrie aéronautique et navale, agroalimentaire, numérique French Tech et biotech concentrent des cas IA à fort potentiel de ROI.",
          "Tissu B2B nantais sur-représenté dans nos références : ETI industrielles (aéronautique, composites, naval), PME agroalimentaires, scale-ups French Tech, cabinets de conseil Euronantes.",
          "Nos consultants se déplacent sur l'ensemble de la métropole nantaise — Île de Nantes, Euronantes Gare, La Chantrerie, Saint-Herblain, Bouguenais — et dans le bassin élargi (Saint-Nazaire, Rennes, Angers).",
          "Restitutions toujours en présentiel dans vos locaux : atelier d'idéation, lecture du livrable avec votre comité de direction, plan d'attaque transmis en main propre.",
          "Aucun devis opaque : tarifs publics, vous savez exactement ce que vous payez avant de signer.",
          "Votre plan d'action est exécutable avec n'importe quel prestataire ou en interne — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus métier, indicateurs de production ou de gestion).",
          },
          {
            step: "Kick-off sur site Nantes",
            detail:
              "Première venue dans vos locaux pour observer les outils du quotidien, identifier les workflows candidats à l'IA et comprendre les spécificités de votre secteur — industrie, agroalimentaire, numérique ou santé.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (production, qualité, finance, RH, commercial, direction) pour cartographier les frictions, les tâches répétitives et les attentes réelles des équipes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs de production, vos emails, vos bons de commande, vos fiches produit. Pas de slides théoriques recyclées.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux nantais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable sur 6-18 mois adaptée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets nantais jusqu'à une dizaine de collaborateurs — artisans, commerces, agences.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour PME agroalimentaires, agences numériques French Tech, cabinets de conseil Euronantes, de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour ETI industrielles (aéronautique, naval, composites), laboratoires biotech et ETI de services souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites grands-comptes (Airbus Bouguenais, Capgemini, BNP siège régional) souhaitant cadrer une gouvernance IA centralisée sur leur périmètre nantais.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a livré un audit chiffré, actionnable, en quelques semaines là où nos DSI estimaient des mois de cadrage. Le livrable a permis de prioriser trois chantiers IA concrets dès le trimestre suivant.",
            role: "Directeur général",
            companyProfile: "ETI industrielle, métropole nantaise",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données de production. Le plan d'action a convaincu le comité de direction sans jargon — c'est rare dans notre secteur.",
            role: "Directrice de la transformation",
            companyProfile: "PME agroalimentaire, Loire-Atlantique",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Nantes ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une PME nantaise ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente généralement l'équivalent de plusieurs équivalents temps plein gagnés sur les workflows automatisés — lecture de bons de commande, comptes-rendus de réunion, qualification de leads. Le livrable détaille les chiffres précis pour votre situation.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage. Les données sont traitées exclusivement sur vos infrastructures, sans extraction vers nos serveurs. Conformité RGPD stricte, modèles testés en local ou sur infra dédiée chez vous si la souveraineté industrielle est requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Nantes, dans vos locaux. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Quelle différence avec un grand cabinet de conseil ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des profils généralistes. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée et focalisée sur votre secteur. Et surtout : aucun lock-in, votre plan est exécutable avec qui vous voulez.",
          },
          {
            q: "Faut-il déjà avoir une DSI ou une maturité IA pour nous solliciter ?",
            a: "Non. Une grande partie de nos audits nantais sont commandés par des dirigeants ou DG qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause disponible, non activée à ce jour sur nos missions nantaises).",
      },
      en: {
        hero: "Axion-IA's AI audit in Nantes maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers cover every size, from Nantes independent micro-businesses to large industrial enterprises across the metropolis. Output: an actionable costed PDF deliverable handed over in person, jargon-free, no lock-in.",
        whyHere: [
          "Nantes is a strategic hub for Axion-IA: aeronautics, shipbuilding, agri-food, French Tech digital and biotech concentrate AI cases with strong ROI potential.",
          "Nantes B2B fabric well-represented in our references: industrial mid-caps (aeronautics, composites, naval), agri-food SMEs, French Tech scale-ups, Euronantes consulting firms.",
          "Our consultants travel across the whole Nantes metropolis — Île de Nantes, Euronantes Gare, La Chantrerie, Saint-Herblain, Bouguenais — and the wider basin (Saint-Nazaire, Rennes, Angers).",
          "Read-outs always in person at your premises: ideation workshop, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "Your action plan is executable with any vendor or in-house — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, business processes, production or management KPIs).",
          },
          {
            step: "On-site kick-off Nantes",
            detail:
              "First visit to your premises to observe daily tools, identify AI candidate workflows and understand your sector specifics — industry, agri-food, digital or health.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (production, quality, finance, HR, sales, leadership) to map frictions, repetitive tasks and real team expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your production PDFs, emails, purchase orders, product sheets. No recycled theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Nantes premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Nantes freelancers, micro-firms and practices up to about ten staff — craftspeople, retailers, agencies.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for agri-food SMEs, French Tech digital agencies, Euronantes consulting firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (aeronautics, naval, composites), biotech labs and service mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For major-site large accounts (Airbus Bouguenais, Capgemini, BNP regional HQ) framing centralised AI governance across their Nantes footprint.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a costed, actionable audit in a few weeks where our IT leadership estimated months of framing. The deliverable let us prioritise three concrete AI initiatives in the following quarter.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Nantes metropolis",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data. The action plan convinced the executive committee without jargon — rare in our sector.",
            role: "Head of Transformation",
            companyProfile: "Agri-food SME, Loire-Atlantique",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Nantes?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "What ROI can I expect for a Nantes SME?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents several FTEs saved on automated workflows — reading purchase orders, meeting minutes, lead qualification. The deliverable details exact figures for your situation.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off. Data processed exclusively on your infrastructure, no extraction to our servers. Strict GDPR compliance, models tested locally or on dedicated infra at your premises if industrial sovereignty is required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Nantes, at your premises. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a large consulting firm?",
            a: "Our consultants are former AI practitioners, not generalists. Public pricing, no six-figure quote to negotiate. Condensed method focused on your sector. And above all: no lock-in, your plan is executable with whoever you want.",
          },
          {
            q: "Do I need a CIO or AI maturity to engage you?",
            a: "No. A large share of our Nantes audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date on our Nantes missions).",
      },
    },

    // ──────────────────────────────────────────────────────────
    // INTERVENTIONS
    // ──────────────────────────────────────────────────────────
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Nantes se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel.",
        whyHere: [
          "Nantes est un terrain d'intervention clé pour Axion-IA : diversité sectorielle unique — industrie aéronautique, agroalimentaire, numérique French Tech, biotech — qui nécessite des sessions calibrées par métier.",
          "Toute la métropole couverte en présentiel : Île de Nantes, Euronantes Gare, La Chantrerie, Saint-Herblain, Bouguenais, Rezé, Orvault, Saint-Sébastien-sur-Loire.",
          "Le format collectif (1 journée) est conçu pour les structures nantaises de quelques personnes à une centaine de collaborateurs — PME tech, cabinets, agences, ateliers industriels.",
          "Le format Conférence convient aux grandes plénières d'entreprise (Cité des Congrès, Euronantes, auditoriums industriels).",
          "Le format Dirigeants permet un cadrage stratégique en huis-clos pour les comités de direction nantais.",
          "Vocabulaire ajusté à votre secteur dominant : industrie, agroalimentaire, numérique, santé. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier (industrie, IAA, numérique, santé) et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de commande, emails, fiches produit, rapports de production) pour calibrer les démos sur VOS données nantaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés à votre secteur nantais.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Formation collective",
            detail:
              "Idéal indépendants, cabinets, agences numériques et artisans nantais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Le format collectif (1 journée) pour le groupe entier ou Équipes pour focaliser sur un département (commercial, qualité, RH, bureau d'études).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (Cité des Congrès, auditoriums industriels) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour grands sites nantais (Airbus, Capgemini, BNP) : roadshow multi-sites, séminaire CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement calibrée pour notre secteur industriel : nos équipes sont reparties avec leurs outils IA installés et configurés sur leurs postes de travail. Le lendemain, une partie significative les utilisaient déjà sur leurs vrais dossiers.",
            role: "DRH",
            companyProfile: "ETI industrielle, métropole nantaise",
          },
          {
            quote:
              "La session dirigeants nous a alignés en quelques heures sur notre trajectoire IA. Format dense, pragmatique, aucun remplissage. Exactement ce qu'on attendait pour cadrer notre comité de direction.",
            role: "PDG",
            companyProfile: "PME numérique, Île de Nantes",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Nantes ?",
            a: "Cela dépend du format choisi. Le format collectif (1 journée) se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "Le format collectif (1 journée) accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence avec un schéma plénière + ateliers en sous-groupes est plus adapté.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui. Ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur industriel ou agroalimentaire ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME de la filière navale n'a rien à voir avec une session pour une scale-up numérique de l'Île de Nantes.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur nantais, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Nantes come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work.",
        whyHere: [
          "Nantes is a key engagement ground for Axion-IA: unique sector diversity — aeronautics, agri-food, French Tech digital, biotech — requiring sector-calibrated sessions.",
          "Whole metropolis covered in person: Île de Nantes, Euronantes Gare, La Chantrerie, Saint-Herblain, Bouguenais, Rezé, Orvault, Saint-Sébastien-sur-Loire.",
          "The one-day format is designed for Nantes structures from a few people to about a hundred staff — tech SMEs, firms, agencies, industrial workshops.",
          "The Talk format suits large corporate plenaries (Cité des Congrès, Euronantes, industrial auditoriums).",
          "The Executives format enables strategic in-camera framing for Nantes executive committees.",
          "Vocabulary adjusted to your dominant sector: industry, agri-food, digital, health. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (industry, agri-food, digital, health) and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your activity (purchase orders, emails, product sheets, production reports) to calibrate demos on YOUR Nantes data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops adapted to your Nantes sector.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Group format",
            detail:
              "Ideal Nantes freelancers, firms, digital agencies and craftspeople up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department (sales, quality, HR, engineering office).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Cité des Congrès, industrial auditoriums) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for major Nantes sites (Airbus, Capgemini, BNP): multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group training perfectly calibrated for our industrial sector: our teams left with their AI tools installed and configured on their workstations. The next day, a significant share were already using them on real files.",
            role: "Head of HR",
            companyProfile: "Industrial mid-cap, Nantes metropolis",
          },
          {
            quote:
              "The executive session aligned us within hours on our AI trajectory. Dense, pragmatic format, no filler. Exactly what we needed to frame our executive committee.",
            role: "CEO",
            companyProfile: "Digital SME, Île de Nantes",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Nantes take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The group format handles up to about a hundred staff in interaction. Beyond that, the Talk format with a plenary + sub-group workshops is more suitable.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes. They are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our industrial or agri-food sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a naval-industry SME has nothing to do with one for a digital scale-up on Île de Nantes.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Nantes sector, no recycled generic session.",
      },
    },

    // ──────────────────────────────────────────────────────────
    // IMPLEMENTATION
    // ──────────────────────────────────────────────────────────
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Nantes met vos cas d'usage IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux nantais. Pas de dépendance technologique : vos équipes gardent la main après la mission.",
        whyHere: [
          "Nantes concentre des cas d'usage IA à fort potentiel : lecture automatique de bons de commande industriels (aéronautique, naval), analyse de fiches produit (agroalimentaire), agents support (scale-ups French Tech), qualification de leads (services B2B Euronantes).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux nantais : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/outils industriels.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Nantes : passation de pouvoir, formation des ambassadeurs internes installés sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Intégrations maîtrisées dans l'écosystème nantais : outils industriels (PLM, GPAO), ERP agroalimentaires, stacks SaaS des scale-ups French Tech.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Nantes : revue de l'architecture cible (CRM, ERP, PLM, mails, stockage), validation des contraintes RGPD/sécurité industrielle, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Nantes : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels nantais, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Nantes : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (lecture factures, comptes-rendus, qualification leads) — pour TPE nantaises, cabinets et agences.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME agroalimentaires, scale-ups French Tech et agences numériques de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (PLM industriel, ERP legacy, datalake), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour grands sites nantais (Airbus, Capgemini, BNP) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture de bons de commande livrée comme promis. ROI réel mesuré : plusieurs équivalents temps plein libérés sur les tâches admin. Aucun lock-in, nos équipes ont la main sur les modèles.",
            role: "DAF",
            companyProfile: "ETI industrielle, métropole nantaise",
          },
          {
            quote:
              "Méthode hybride parfaite : kick-off dense sur site, puis itérations à distance avec points courts. Notre équipe technique n'a jamais été perdue. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up numérique, Île de Nantes",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Nantes ?",
            a: "Cela dépend de l'ampleur. Un POC TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions nantaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur nos données industrielles ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (pièces critiques, contrats, RH), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Nantes brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Nantes premises. No tech dependency: your teams stay in control after the mission.",
        whyHere: [
          "Nantes concentrates high-potential AI use cases: automated reading of industrial purchase orders (aeronautics, naval), product sheet analysis (agri-food), support agents (French Tech scale-ups), lead qualification (Euronantes B2B services).",
          "Kick-off always happens in person at your Nantes premises: team alignment, data access, CRM/ERP/industrial tools integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Nantes: handover, training of installed ambassadors, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Integrations mastered in the Nantes ecosystem: industrial tools (PLM, MES), agri-food ERP, French Tech scale-up SaaS stacks.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Nantes workshop: target architecture review (CRM, ERP, PLM, emails, storage), GDPR/industrial security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Nantes: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical and business team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real Nantes-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Nantes: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (invoice reading, meeting minutes, lead qualification) — for Nantes micro-firms, practices and agencies.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For agri-food SMEs, French Tech scale-ups, digital agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial PLM, legacy ERP, datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for major Nantes sites (Airbus, Capgemini, BNP): cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Purchase order reading implementation delivered as promised. Real ROI measured: several FTEs freed on admin tasks. No lock-in, our teams control the models.",
            role: "CFO",
            companyProfile: "Industrial mid-cap, Nantes metropolis",
          },
          {
            quote:
              "Perfect hybrid method: intense on-site kick-off, then remote iterations with short check-ins. Our technical team was never lost. Internal ambassadors take over autonomously.",
            role: "CTO",
            companyProfile: "Digital scale-up, Île de Nantes",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Nantes take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Nantes missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if AI produces errors on our industrial data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical parts, contracts, HR), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Nantes est un accompagnement individuel sur mesure : vous progressez à votre rythme, sur vos propres cas métier, avec un consultant dédié. À partir de {{price:intervention-dirigeants|flat}}. Adapté aux dirigeants, managers et experts des secteurs aéronautique, agroalimentaire, numérique et biotech du Grand Ouest.",
        whyHere: [
          "Nantes concentre des profils très hétérogènes — ingénieur aéronautique chez Airbus, directeur qualité dans une PME agroalimentaire, CTO d'une scale-up French Tech — qui n'ont ni le même rythme ni les mêmes cas : le 1-to-1 est la seule formule qui s'adapte à chacun.",
          "L'industrie aéronautique (Airbus Bouguenais, IRT Jules Verne, sous-traitants pôle EMC2) impose des contraintes qualité et réglementaires spécifiques que seul un coaching individuel peut intégrer dans chaque exercice pratique.",
          "Les scale-ups de l'Île de Nantes et de la French Tech Nantes ont des roadmaps produit serrées : le coaching calé sur votre backlog réel produit des gains opérationnels immédiats.",
          "Les ETI agroalimentaires (LU, Petit Navire, Lactalis Loire-Atlantique) ont souvent un ou deux profils 'référents IA' à former avant toute cascade équipe : le 1-to-1 est la voie la plus rapide.",
          "Séances sur site dans vos locaux nantais (Île de Nantes, Euronantes, La Chantrerie, Bouguenais) ou à distance selon votre disponibilité — rythme calé à la signature.",
          "Confidentialité sans accord de confidentialité imposé : vos données, vos cas, votre contexte. Aucun document ne quitte votre environnement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage approfondi pour identifier votre niveau IA actuel, vos cas métier prioritaires (aéronautique, agro, numérique, biotech) et l'objectif précis du coaching.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Construction d'un plan séance par séance calé sur vos outils (Claude, Mistral, GPT-4, outils métier), vos livrables réels et vos contraintes sectorielles nantaises.",
          },
          {
            step: "Séances pratiques sur vos vrais cas",
            detail:
              "Chaque séance travaille directement sur vos documents, vos prompts, votre workflow : lecture de bons de commande industriels, analyse qualité, génération de contenus produit, reporting agroalimentaire.",
          },
          {
            step: "Exercices entre séances",
            detail:
              "Micro-missions à réaliser en autonomie entre deux séances pour ancrer les apprentissages dans votre contexte réel nantais et accélérer la progression.",
          },
          {
            step: "Bilan + feuille de route autonomie",
            detail:
              "En fin de coaching, un bilan chiffré de vos gains et une feuille de route d'autonomie pour continuer à progresser sans dépendance envers Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Entrée coaching 1-to-1 — dirigeant, indépendant ou expert TPE du numérique, de l'agro ou de l'artisanat nantais.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme multi-séances pour référents IA ou managers de PME agroalimentaires, agences numériques ou cabinets de Nantes.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement cadres dirigeants ETI nantaises (aéronautique, naval, biotech) — programme structuré sur plusieurs mois avec bilan intermédiaire.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de la cellule IA ou des profils pilotes d'un grand groupe implanté à Nantes (Airbus, Capgemini), avant déploiement large en cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de maîtriser l'IA sur mes vrais dossiers industriels en quelques séances. Les cas aéronautique et qualité étaient intégrés dès le premier échange. Je suis autonome sur mes analyses et comptes-rendus.",
            role: "Ingénieur qualité",
            companyProfile: "ETI sous-traitant aéronautique, Bouguenais",
          },
          {
            quote:
              "En tant que DG d'une PME agroalimentaire, je n'avais pas le temps pour une formation collective. Le coaching 1-to-1 calé sur mes vrais enjeux (traçabilité, emails clients, reporting) a été immédiatement rentable.",
            role: "Directeur général",
            companyProfile: "PME agroalimentaire, Loire-Atlantique",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective à Nantes ?",
            a: "Le format collectif forme tout un groupe sur les mêmes cas. Le 1-to-1 travaille exclusivement sur VOS cas, votre vitesse, vos contraintes sectorielles (aéronautique, agro, numérique, naval). Résultat : gains opérationnels mesurables dès la première séance.",
          },
          {
            q: "Combien de séances faut-il pour être autonome sur l'IA à Nantes ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Un dirigeant TPE numérique atteint une autonomie confortable en quelques séances. Un manager ETI cherchant à maîtriser des intégrations PLM ou des workflows qualité aura un programme plus étendu. Le plan est cadré à la première séance.",
          },
          {
            q: "Le coaching peut-il se tenir dans mes locaux nantais ?",
            a: "Oui. Séances sur site dans vos locaux (Île de Nantes, Euronantes, La Chantrerie, Bouguenais) ou en visio selon votre disponibilité. Le choix est fait au cadrage.",
          },
          {
            q: "Mes données et documents restent-ils confidentiels pendant le coaching ?",
            a: "Oui. Confidentialité stricte dès le démarrage : vos données, vos prompts, vos cas restent dans votre environnement. Aucune extraction vers nos serveurs. Conformité RGPD stricte.",
          },
          {
            q: "Puis-je commencer sans aucune base IA ?",
            a: "Oui. Le diagnostic initial évalue votre niveau réel et calibre le plan de progression en conséquence. Beaucoup de profils nantais débutent sans avoir jamais utilisé Claude ou GPT de façon professionnelle.",
          },
          {
            q: "Y a-t-il un engagement minimum de durée ou de nombre de séances ?",
            a: "Non. Pas de lock-in, pas de contrat d'abonnement. Vous commencez par la première séance à {{price:intervention-dirigeants|flat}}. La suite se décide à l'issue de chaque séance selon votre progression et vos besoins.",
          },
        ],
        guarantees:
          "Pas de lock-in : aucun engagement de durée imposé. Confidentialité stricte sans accord de confidentialité requis — vos données restent dans votre environnement. Conformité RGPD. Si à l'issue de la première séance vous estimez que le coaching ne correspond pas à vos attentes, première séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Nantes is an individual, bespoke engagement: you progress at your own pace, on your own business cases, with a dedicated consultant. From €990 excl. VAT. Suited to executives, managers and experts in aeronautics, agri-food, digital and biotech across the Greater West.",
        whyHere: [
          "Nantes brings together very diverse profiles — an aeronautics engineer at Airbus, a quality director in an agri-food SME, a CTO at a French Tech scale-up — who have different paces and use cases: 1-to-1 is the only format that adapts to each.",
          "The aeronautics industry (Airbus Bouguenais, IRT Jules Verne, EMC2 subcontractors) imposes specific quality and regulatory constraints that only individual coaching can integrate into each practical exercise.",
          "Île de Nantes and French Tech Nantes scale-ups have tight product roadmaps: coaching aligned with your real backlog produces immediate operational gains.",
          "Agri-food mid-caps (LU, Petit Navire, Lactalis Loire-Atlantique) often have one or two priority 'AI champion' profiles to train before any team cascade: 1-to-1 is the fastest route.",
          "Sessions on site at your Nantes offices (Île de Nantes, Euronantes, La Chantrerie, Bouguenais) or remote depending on availability — cadence agreed at sign-up.",
          "Confidentiality without imposed accord de confidentialité: your data, your cases, your context. No document leaves your environment.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "An in-depth framing interview to identify your current AI level, priority business cases (aeronautics, agri-food, digital, biotech) and the precise coaching objective.",
          },
          {
            step: "Personalized progression plan",
            detail:
              "Building a session-by-session plan aligned with your tools (Claude, Mistral, GPT-4, business tools), your real deliverables and your Nantes sector constraints.",
          },
          {
            step: "Practical sessions on your real cases",
            detail:
              "Each session works directly on your documents, prompts, workflow: industrial purchase order reading, quality analysis, product content generation, agri-food reporting.",
          },
          {
            step: "Between-session exercises",
            detail:
              "Micro-missions to complete autonomously between sessions to embed learnings in your real Nantes context and accelerate progress.",
          },
          {
            step: "Debrief + autonomy roadmap",
            detail:
              "At coaching end, a costed gains summary and an autonomy roadmap to keep progressing without dependence on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From €990 excl. VAT",
            detail:
              "Entry-level 1-to-1 coaching — executive, freelancer or expert in a Nantes digital, agri-food or craft micro-business.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Multi-session programme for AI champions or managers of Nantes agri-food SMEs, digital agencies or consulting firms.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Executive coaching for Nantes mid-cap managers (aeronautics, naval, biotech) — structured multi-month programme with interim review.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Coaching of the AI cell or pilot profiles of a large group based in Nantes (Airbus, Capgemini), before broad team cascade rollout.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching let me master AI on my real industrial files within a few sessions. Aeronautics and quality cases were integrated from the first exchange. I am autonomous on my analyses and meeting minutes.",
            role: "Quality Engineer",
            companyProfile: "Aeronautics subcontractor mid-cap, Bouguenais",
          },
          {
            quote:
              "As CEO of an agri-food SME, I had no time for group training. The 1-to-1 coaching aligned with my real challenges (traceability, client emails, reporting) was immediately profitable.",
            role: "CEO",
            companyProfile: "Agri-food SME, Loire-Atlantique",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from a group session in Nantes?",
            a: "Group format trains a whole team on the same cases. 1-to-1 works exclusively on YOUR cases, your pace, your sector constraints (aeronautics, agri-food, digital, naval). Result: measurable operational gains from the first session.",
          },
          {
            q: "How many sessions are needed to become AI-autonomous in Nantes?",
            a: "It depends on your starting level and objectives. A digital micro-business executive reaches comfortable autonomy in a few sessions. A mid-cap manager seeking to master PLM integrations or quality workflows will have a longer programme. The plan is framed in the first session.",
          },
          {
            q: "Can coaching sessions be held at my Nantes premises?",
            a: "Yes. On-site sessions at your offices (Île de Nantes, Euronantes, La Chantrerie, Bouguenais) or via video depending on availability. The choice is made at framing.",
          },
          {
            q: "Does my data stay confidential during coaching?",
            a: "Yes. Strict confidentiality from day one: your data, prompts and cases stay in your environment. No extraction to our servers. Strict GDPR compliance.",
          },
          {
            q: "Can I start with no AI background?",
            a: "Yes. The initial diagnostic assesses your real level and calibrates the progression plan accordingly. Many Nantes profiles start without ever having used Claude or GPT professionally.",
          },
          {
            q: "Is there a minimum duration or session commitment?",
            a: "No. No lock-in, no subscription contract. You start with the first session at €990 excl. VAT. Continuation is decided after each session based on your progress and needs.",
          },
        ],
        guarantees:
          "No lock-in: no imposed duration commitment. Strict confidentiality without required accord de confidentialité — your data stays in your environment. GDPR compliance. If after the first session you feel the coaching does not meet your expectations, first session fully refunded.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Nantes des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Nantes, itérations à distance.",
        whyHere: [
          "Projets web & SaaS nantais : industrie & manufacturing avancé (Airbus, IRT Jules Verne), industries créatives & numériques (Île de Nantes, ~500 entreprises), agroalimentaire, santé (Atlanpole Biotherapies), scale-ups French Tech.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Industries créatives & culturelles : sites, plateformes éditoriales et e-commerce sur mesure — l'ADN du quartier de la création nantais.",
        ],
        methodology: [
          {
            step: "Cadrage à Nantes",
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
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour scale-ups, studios créatifs et PME nantaises.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, industrielle ou portail client sur mesure, IA intégrée, branchée sur votre SI (PLM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Nantes — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous, particulièrement pertinent pour le quartier de la création.",
          },
          {
            q: "Vous travaillez pour l'industrie et le manufacturing ?",
            a: "Oui : portails techniques, plateformes data, RAG sur documentation, agents et automatisations métier branchés sur votre SI (PLM, ERP) — un terrain naturel à Nantes avec Airbus et l'IRT Jules Verne. Hébergement UE, RGPD strict.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région nantaise ou repris en interne.",
      },
      en: {
        hero: "In Nantes, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Nantes kick-off, remote iterations.",
        whyHere: [
          "Nantes web & SaaS projects: industry & advanced manufacturing (Airbus, IRT Jules Verne), creative & digital industries (Île de Nantes, ~500 companies), agri-food, health (Atlanpole Biotherapies), French Tech scale-ups.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Creative & cultural industries: bespoke sites, editorial platforms and e-commerce — the DNA of the Nantes creative district.",
        ],
        methodology: [
          {
            step: "Scoping in Nantes",
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
              "Design or rebuild of a site or app with UX/UI and built-in AI, for scale-ups, creative studios and Nantes SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, industrial or customer portal platform, AI built in, wired into your IS (PLM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Nantes — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us, especially relevant for the creative district.",
          },
          {
            q: "Do you work for industry and manufacturing?",
            a: "Yes: technical portals, data platforms, RAG on documentation, agents and business automations wired to your IS (PLM, ERP) — a natural fit in Nantes with Airbus and IRT Jules Verne. EU hosting, strict GDPR.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Nantes-area provider or taken in-house.",
      },
    },
  },

  // ============================================================
  // FAQ GÉOLOCALISÉE NANTES
  // ============================================================
  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Nantes ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre nantais. Aucun supplément géographique : le tarif est identique à celui pratiqué partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans la région nantaise ?",
      a: "Oui. Plusieurs références récentes proviennent de la métropole nantaise ou du bassin Grand Ouest : ETI industrielle secteur aéronautique, PME agroalimentaire Loire-Atlantique, scale-up numérique Île de Nantes. Les cas clients sont consultables dans la rubrique Cas concrets, filtrables par secteur et zone géographique.",
    },
    {
      q: "Quels secteurs sont prioritaires à Nantes pour l'IA ?",
      a: "Nos déploiements nantais couvrent en priorité l'industrie (aéronautique, naval, composites, manufacturing avancé), l'agroalimentaire (IAA, filière végétale, conserveries), le numérique (scale-ups French Tech, ESN, éditeurs logiciels), la santé/biotech (Atlanpole Biotherapies) et les services B2B (conseil, ingénierie, cabinets). Tout secteur B2B reste éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos locaux nantais ?",
      a: "Oui. Toutes nos interventions à Nantes sont par défaut sur site, dans vos bureaux ou ateliers. Nos consultants sont mobiles sur l'ensemble de la métropole nantaise, de l'Île de Nantes à La Chantrerie, Saint-Herblain, Bouguenais et les communes limitrophes. Les ateliers d'idéation et les restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "Travaillez-vous avec les startups French Tech Nantes ?",
      a: "Oui. Nous accompagnons régulièrement les scale-ups et startups issues de La Cantine numérique, d'Atlanpole et de l'IMT Starter sur leurs cas d'usage IA opérationnels — du POC au déploiement en production. Notre offre PME est calibrée pour les structures avec un product-market fit établi souhaitant industrialiser leur IA.",
    },
    {
      q: "Intervenez-vous dans le bassin Saint-Nazaire pour l'industrie navale ?",
      a: "Oui. Le bassin économique Nantes–Saint-Nazaire fait partie de notre périmètre d'intervention Grand Ouest. Les sites industriels (construction navale, sous-traitance aéronautique, énergies marines) sont accessibles depuis notre base nantaise.",
    },
  ],
};
