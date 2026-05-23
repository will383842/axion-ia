// Bordeaux (33063) — contenu éditorial gold standard 2026-05-20.
//
// Réalités Bordeaux sourcées depuis economic-data/bordeaux.ts :
//   - Pôle aéronautique-défense : Dassault Aviation (Rafale/Falcon Mérignac),
//     Thales, Safran, ArianeGroup, Aerospace Valley, ~30 000 emplois filière
//   - Viticulture premium : 8 AOC (Médoc, Saint-Émilion, Pomerol, Sauternes,
//     Pessac-Léognan, Graves, Margaux, Pauillac), Cité du Vin, INSEEC Wine MBA
//   - Numérique : French Tech Bordeaux, H7 (Bassins à Flot), Cité Numérique
//     (Bègles), Inria Centre Université Bordeaux, Cdiscount siège
//   - Euratlantique (OIN 738 ha, ZAC tertiaire majeure), Bordeaux Aéroparc
//   - Campus PTPG (plus grand hors IDF), ENSEIRB-MATMECA, KEDGE triple-accrédité
//   - UNESCO « Port de la Lune » 2007 — 1810 ha ensemble urbain XVIII°
//
// Doctrine copies :
//   - Aucun délai chiffré (durée relative uniquement).
//   - Aucune mention « frais de déplacement intégrés ».
//   - Durée minimale = 1 journée (pas de demi-journée).
//   - « frais de logement, repas et forfait trajet en sus » sur interventions.
//   - Aucun prix en dur (vient de pricing.ts via le rendu page).
//   - Tailles INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE bouclier anti-doorway HCU 2024.
//   - PAS de heroSchema. PAS de unAUn.

import type { VilleCopy } from "./types";

export const BORDEAUX_COPY: VilleCopy = {
  pitchFr:
    "Bordeaux concentre le 2e pôle aéronautique-défense de France (Dassault, Thales, Safran, ArianeGroup), la capitale mondiale du vin (8 AOC, Cité du Vin, INSEEC Wine MBA), un hub numérique actif (French Tech Bordeaux, Inria, Cdiscount) et le campus universitaire PTPG, le plus étendu hors Île-de-France. Axion-IA y intervient sur site, des TPE viticoles aux ETI de défense.",
  pitchEn:
    "Bordeaux hosts France's second aeronautics-defence hub (Dassault, Thales, Safran, ArianeGroup), the world wine capital (8 AOCs, Cité du Vin, INSEEC Wine MBA), an active digital cluster (French Tech Bordeaux, Inria, Cdiscount HQ) and the PTPG university campus, the largest outside Île-de-France. Axion-IA delivers on site, from wine-sector micro-businesses to mid-cap defence firms.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Bordeaux : nous cartographions ce qui peut être automatisé chez vous — de la chaîne logistique aéronautique aux processus de négoce viticole — et chiffrons le ROI à 12-24 mois. 4 niveaux du Flash au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Bordeaux: we map what can be automated at your company — from aerospace supply-chain to wine-trade processes — and quantify the 12-24 month ROI. 4 tiers from Flash to Mid-cap Strategic depending on your size.",
    },
    interventions: {
      fr: "Interventions IA à Bordeaux : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes avec des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Bordeaux: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Bordeaux : on déploie l'IA dans vos outils existants (ERP, CRM, mails, outil de gestion viticole, logiciels métier aéronautique) avec un ROI chiffré contractuellement. Aucune dépendance créée, vos équipes gardent la main.",
      en: "AI implementation in Bordeaux: we deploy AI into your existing tools (ERP, CRM, email, viticulture management software, aerospace-specific systems) with contractually-costed ROI. No dependency created, your teams stay in control.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Bordeaux : séances sur mesure pour dirigeants et cadres de l'aéronautique/spatial, du viti-vinicole, de la French Tech Bordeaux et des ETI de Gironde. Ancré sur les réalités des filières aéronautique (Aerospace Valley), viticole et numérique. Frais de logement, repas et forfait trajet en sus pour le présentiel.",
      en: "1-to-1 AI coaching in Bordeaux: bespoke sessions for executives and managers in aerospace/space, wine, French Tech Bordeaux and Gironde mid-caps. Grounded in the realities of Bordeaux's aerospace (Aerospace Valley), viticulture and digital sectors. Lodging, meals and travel allowance billed separately for on-site sessions.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Bordeaux (33063) et dans l'ensemble de la Métropole bordelaise (Mérignac, Pessac, Talence, Le Bouscat, Bègles, Lormont). Nous accompagnons les TPE, PME, ETI et grandes entreprises sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Secteurs prioritaires : aéronautique-défense (Aerospace Valley), viticulture premium, numérique (French Tech Bordeaux), santé-recherche (campus Carreire), conseil et services B2B. Aucun lock-in technologique, tarifs publics affichés.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Bordeaux (33063) and across the Bordeaux Métropole (Mérignac, Pessac, Talence, Le Bouscat, Bègles, Lormont). We support micro-businesses, SMEs, mid-caps and large enterprises on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. Priority sectors: aerospace-defence (Aerospace Valley), premium viticulture, digital (French Tech Bordeaux), health-research (Carreire campus), consulting and B2B services. No tech lock-in, public pricing displayed.",

  topSectorsNaf: [
    "Aéronautique & Défense",
    "Viticulture & Négoce de vin",
    "Numérique & Éditeurs logiciels",
    "Conseil & Services aux entreprises",
    "Commerce & Distribution B2B",
    "Santé & Sciences du vivant",
  ],

  distancesFr:
    "Gare de Bordeaux Saint-Jean (LGV, intra-muros). Aéroport Bordeaux-Mérignac à 12 km. 4 lignes de tramway desservant la Métropole (Bordeaux, Mérignac, Pessac, Talence, Bègles, Le Bouscat, Lormont, Cenon, Floirac).",
  distancesEn:
    "Bordeaux Saint-Jean station (LGV high-speed, intra-city). Bordeaux-Mérignac airport 12 km away. 4 tramway lines serving the Métropole (Bordeaux, Mérignac, Pessac, Talence, Bègles, Le Bouscat, Lormont, Cenon, Floirac).",

  ecosystemFr:
    "2e pôle aéronautique-défense national (Dassault Rafale, Thales, Safran, ArianeGroup — Aerospace Valley), capitale mondiale du vin (8 AOC, Cité du Vin, KEDGE & INSEEC Wine MBA), hub numérique actif (French Tech Bordeaux, Inria, Cdiscount siège, H7 Bassins à Flot), campus PTPG (ENSEIRB-MATMECA, Université de Bordeaux, KEDGE triple-accrédité), OIN Euratlantique (738 ha tertiaire en développement). UNESCO Port de la Lune 2007.",
  ecosystemEn:
    "France's second aerospace-defence hub (Dassault Rafale, Thales, Safran, ArianeGroup — Aerospace Valley), world wine capital (8 AOCs, Cité du Vin, KEDGE & INSEEC Wine MBA), active digital cluster (French Tech Bordeaux, Inria, Cdiscount HQ, H7 Bassins à Flot), PTPG campus (ENSEIRB-MATMECA, Université de Bordeaux, triple-accredited KEDGE), Euratlantique OIN (738 ha tertiary development). UNESCO Port de la Lune 2007.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Bordeaux cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. De la TPE viticole au groupe aéronautique de la Métropole, quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles. Restitution toujours en présentiel dans vos locaux bordelais, livrable PDF chiffré remis en main propre.",
        whyHere: [
          "Bordeaux est un pôle d'intervention Axion-IA en croissance rapide : aéronautique-défense, négoce viticole et numérique représentent trois verticalités majeures de nos missions dans la Métropole.",
          "Le tissu B2B bordelais est dense et diversifié : sous-traitants Aerospace Valley (Dassault, Thales, Safran), négociants en vins, cabinets d'expertise et de conseil, éditeurs logiciels (Cité Numérique Bègles, H7), groupes de santé (campus Carreire).",
          "Nos consultants se déplacent dans toute la Métropole bordelaise : Bordeaux intra-muros, Mérignac (Aéroparc), Pessac, Talence, Le Bouscat, Bègles, Lormont, Cenon, Floirac, Villenave-d'Ornon.",
          "Restitutions toujours en présentiel : ateliers d'idéation, lecture du livrable avec votre comité de direction, plan d'attaque transmis en main propre dans vos locaux.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus métier, indicateurs opérationnels). Pour les sites de défense ou les entreprises à données sensibles, accord de confidentialité renforcé disponible.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux bordelais pour observer les outils utilisés au quotidien, comprendre les workflows clés (chaîne de production, gestion de commandes, documentation technique, processus commerciaux) et identifier les candidats à l'automatisation IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, finance, RH, opérations, bureau d'études, support, direction) pour cartographier précisément frictions, volumes de tâches et attentes terrain.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos factures, vos gammes de produits ou vos dossiers techniques. Pas de slides théoriques — on travaille sur votre réalité.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux bordelais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois, priorisée selon vos contraintes sectorielles (RGPD, souveraineté, certification qualité aéronautique si pertinente).",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux vignobles familiaux, petits négociants, cabinets bordelais ou PME du numérique jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les sous-traitants Aerospace Valley, les sociétés de services B2B, les agences numériques et les négociants en vins de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (aéronautique, matériaux, bois), les groupes de distribution B2B ou les holdings viticoles souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands sites industriels (Dassault Mérignac, Thales Le Haillan, Cdiscount Bassins à Flot) souhaitant cadrer une gouvernance IA centralisée multi-sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a cartographié nos processus de documentation technique en quelques journées et chiffré un ROI très concret sur nos cycles de révision de dossiers. Le livrable est opérationnel, pas théorique.",
            role: "Directeur des opérations",
            companyProfile: "PME sous-traitante aéronautique, Mérignac",
          },
          {
            quote:
              "On avait une intuition que l'IA pouvait simplifier notre gestion des commandes export. L'audit a confirmé trois cas à forte valeur et écarté deux fausses pistes. On a gagné du temps et de la clarté.",
            role: "Directeur général",
            companyProfile: "Négociant en vins, Bordeaux intra-muros",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Bordeaux ?",
            a: "La durée varie selon le niveau : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage, en tenant compte de vos contraintes opérationnelles (périodes de vendanges, cycles de production aéronautique, etc.).",
          },
          {
            q: "Pouvez-vous auditer des sites industriels soumis à des contraintes de confidentialité élevées ?",
            a: "Oui. Nous signons un accord de confidentialité renforcé avant démarrage. Les données sont traitées exclusivement sur vos infrastructures, sans extraction vers nos serveurs. Pour les sites de défense ou certifiés EN 9100, nous adaptons le protocole d'accès aux exigences de sécurité du site.",
          },
          {
            q: "Votre audit couvre-t-il les outils métier spécifiques à la filière viti-vinicole ou aéronautique ?",
            a: "Oui. Nous prenons le temps de comprendre les logiciels métier en place (WinSoft, Visi'Viti, Infor LN, SAP ERP, outils de gestion cave...) avant la session sur site. Les démos sont calibrées sur vos vrais fichiers, pas sur des données génériques.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Bordeaux dans vos locaux. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF chiffré en main propre — aucun envoi de fichier sensible par email.",
          },
          {
            q: "Quelle différence avec un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des généralistes MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée avec démos sur vos données réelles. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande partie de nos audits bordelais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction et prioriser les cas à fort ROI selon votre secteur réel.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour sur nos missions bordelaises).",
      },
      en: {
        hero: "Axion-IA's AI audit in Bordeaux maps what can be automated at your organisation and quantifies the 12-24 month return on investment. From a wine-estate micro-business to a metropolitan aerospace group, four tiers from Flash to Mid-cap Strategic cover every size. Read-out always in person at your Bordeaux offices, costed PDF deliverable handed over face to face.",
        whyHere: [
          "Bordeaux is a fast-growing Axion-IA engagement hub: aerospace-defence, wine trade and digital represent three major verticals of our Métropole missions.",
          "Bordeaux's B2B fabric is dense and diversified: Aerospace Valley sub-contractors (Dassault, Thales, Safran), wine merchants, accounting and consulting firms, software publishers (Cité Numérique Bègles, H7), health groups (Carreire campus).",
          "Our consultants travel across the full Bordeaux Métropole: central Bordeaux, Mérignac (Aéroparc), Pessac, Talence, Le Bouscat, Bègles, Lormont, Cenon, Floirac, Villenave-d'Ornon.",
          "Read-outs always in person: ideation workshops, deliverable walk-through with your leadership, action plan handed over face to face at your offices.",
          "No opaque quote game: public pricing displayed, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, business processes, operational KPIs). For defence sites or companies with sensitive data, enhanced confidentiality agreement available.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Bordeaux offices to observe daily tools, understand key workflows (production chain, order management, technical documentation, commercial processes) and identify AI automation candidates.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, HR, operations, engineering office, support, leadership) to map frictions, task volumes and on-the-ground expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, invoices, product ranges or technical files. No theoretical slides — we work on your actual reality.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Bordeaux offices. Costed PDF deliverable (ROI/complexity) handed over in person, actionable 6-18 month roadmap prioritised per your sectoral constraints (GDPR, sovereignty, aerospace quality certification if relevant).",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to family wine estates, small merchants, Bordeaux practices or digital micro-firms up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for Aerospace Valley sub-contractors, B2B service companies, digital agencies and wine merchants from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (aerospace, materials, timber), B2B distribution groups or wine holding companies framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For major industrial sites (Dassault Mérignac, Thales Le Haillan, Cdiscount Bassins à Flot) framing centralised multi-site AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA mapped our technical documentation processes within a few days and quantified very concrete ROI on our dossier revision cycles. The deliverable is operational, not theoretical.",
            role: "Head of Operations",
            companyProfile: "Aerospace sub-contractor SME, Mérignac",
          },
          {
            quote:
              "We had an intuition that AI could simplify our export order management. The audit confirmed three high-value cases and ruled out two dead ends. We saved time and gained clarity.",
            role: "Managing Director",
            companyProfile: "Wine merchant, central Bordeaux",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Bordeaux?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief, factoring in your operational constraints (harvest periods, aerospace production cycles, etc.).",
          },
          {
            q: "Can you audit industrial sites subject to high confidentiality constraints?",
            a: "Yes. We sign an enhanced confidentiality agreement before kick-off. Data is processed exclusively on your infrastructure, with no extraction to our servers. For defence sites or EN 9100-certified facilities, we adapt the access protocol to the site's security requirements.",
          },
          {
            q: "Does your audit cover sector-specific tools in wine or aerospace?",
            a: "Yes. We take time to understand the business software in place (WinSoft, Visi'Viti, Infor LN, SAP ERP, cellar management tools...) before the on-site session. Demos are calibrated on your real files, not generic data.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Bordeaux at your offices. Workshop of a few hours with your leadership or executive committee. You leave with the costed PDF deliverable in hand — no sensitive files sent by email.",
          },
          {
            q: "What's the difference from a traditional consulting firm?",
            a: "Our consultants are former AI practitioners, not generalist MBAs. Public pricing displayed, no six-figure quote to negotiate. Condensed method with demos on your real data. No lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need to be advanced on AI to request an audit?",
            a: "No. A large share of our Bordeaux audits are ordered by executives who have never launched an AI initiative. The audit is precisely designed to avoid going in the wrong direction and to prioritise high-ROI cases for your actual sector.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date on our Bordeaux missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Bordeaux se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — qu'ils soient ingénieur chez un sous-traitant Aerospace Valley, chargé de clientèle dans un négoce viticole ou développeur dans une startup H7. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Bordeaux et sa Métropole sont un terrain d'intervention Axion-IA en croissance : filière aéronautique, négoce de vin, services B2B, numérique et santé représentent des profils de collaborateurs très différents que nous savons adresser.",
          "Tous les territoires de la Métropole couverts en présentiel : Bordeaux intra-muros, Mérignac (Aéroparc, Bordeaux Technowest), Pessac, Talence (campus), Le Bouscat, Bègles (Cité Numérique), Lormont, Cenon.",
          "Le format Essentielle est calibré pour les structures bordelaises de quelques personnes à une centaine de collaborateurs — indépendants, TPE, PME B2B.",
          "Le format Conférence convient aux grandes plénières d'entreprise (Palais des Congrès de Bordeaux, auditoriums Euratlantique, salles de séminaire Aéroparc).",
          "Le format Dirigeants permet un cadrage stratégique en huis-clos pour les comités de direction.",
          "Vocabulaire ajusté à votre secteur dominant : aéronautique (documentation technique, gestion de non-conformités), viticole (gestion de millésimes, export, négociant), numérique (développement, support, marketing). Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires. Pour Bordeaux, nous différencions dès le cadrage les profils industrie-défense, viti-vinicole et numérique.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (dossiers techniques, fiches produits millésimées, emails export, factures) pour calibrer les démos sur VOS données, pas sur des exemples génériques.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux bordelais pour vérifier matériel, projection et accès Wi-Fi. Pas d'aléa technique le jour J, y compris sur les sites à accès contrôlé.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les démos sont calibrées sur des cas concrets de votre secteur (rédaction de rapports techniques, qualification d'emails export, synthèse de dossiers réglementaires).",
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
            price: "Format Essentielle",
            detail:
              "Idéal pour vignerons indépendants, petits négociants, cabinets bordelais ou studios numériques jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département clé (bureau d'études, commerce export, RH, support client).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands sites bordelais : roadshow multi-sites Métropole, séminaires CODIR + cascade équipes sur plusieurs journées.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calibré : nos ingénieurs méthodes et nos acheteurs sont repartis avec leurs outils IA configurés. Le lendemain, plusieurs l'utilisaient déjà pour rédiger des fiches de non-conformité.",
            role: "Responsable excellence opérationnelle",
            companyProfile: "PME sous-traitante aéronautique, Mérignac",
          },
          {
            quote:
              "La session a été adaptée à notre réalité viti-vinicole : emails export, fiches de dégustation, dossiers douaniers. Nos commerciaux ont tout de suite compris la valeur. Très loin d'une formation générique.",
            role: "Directeur commercial",
            companyProfile: "Négociant en vins, Bordeaux",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Bordeaux ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage, en tenant compte de vos contraintes opérationnelles.",
          },
          {
            q: "Pouvez-vous intervenir sur des sites à accès contrôlé (zones industrielles, sites classés défense) ?",
            a: "Oui, sous réserve du processus d'accréditation propre au site. Nous prenons contact avec votre service sécurité en amont et adaptons nos outils aux politiques IT en vigueur (pas de cloud public, travail sur poste dédié si requis).",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur Claude, ChatGPT, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur spécifique (vin, aéronautique, numérique) ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un sous-traitant Aerospace Valley n'a rien à voir avec une session pour un négociant en vins ou une startup H7.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur bordelais, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Bordeaux come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether they are an engineer at an Aerospace Valley sub-contractor, an account manager at a wine merchant, or a developer at an H7 startup. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Bordeaux and its Métropole are a growing Axion-IA engagement ground: the aerospace supply chain, wine trade, B2B services, digital and health represent very different staff profiles that we know how to address.",
          "All Métropole territories covered in person: central Bordeaux, Mérignac (Aéroparc, Bordeaux Technowest), Pessac, Talence (campus), Le Bouscat, Bègles (Cité Numérique), Lormont, Cenon.",
          "The Essential format is calibrated for Bordeaux structures from a few people to about a hundred staff — freelancers, micro-businesses, B2B SMEs.",
          "The Talk format suits large corporate plenaries (Palais des Congrès de Bordeaux, Euratlantique auditoriums, Aéroparc seminar rooms).",
          "The Executives format enables strategic in-camera framing for executive committees.",
          "Vocabulary adjusted to your dominant sector: aerospace (technical documentation, non-conformity management), wine (vintage management, export, trading), digital (development, support, marketing). No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector and priority use cases. For Bordeaux we differentiate from the framing brief between industry-defence, wine and digital profiles.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your activity (technical files, vintage product sheets, export emails, invoices) to calibrate demos on YOUR data, not generic examples.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Bordeaux offices to check equipment, projection and Wi-Fi access. No technical hiccup on D-day, including on controlled-access sites.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Demos are calibrated on concrete cases from your sector (technical report writing, export email qualification, regulatory dossier summary).",
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
            price: "Essential format",
            detail:
              "Ideal for independent winemakers, small merchants, Bordeaux practices or digital studios up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on a key department (engineering office, export sales, HR, customer support).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for major Bordeaux sites: multi-site Métropole roadshows, exec committee seminars + cascade team sessions over several days.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated: our methods engineers and buyers left with their AI tools configured. The next day, several were already using them to write non-conformity reports.",
            role: "Operational Excellence Manager",
            companyProfile: "Aerospace sub-contractor SME, Mérignac",
          },
          {
            quote:
              "The session was adapted to our wine-trade reality: export emails, tasting notes, customs dossiers. Our sales team immediately understood the value. Very far from a generic training.",
            role: "Sales Director",
            companyProfile: "Wine merchant, Bordeaux",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Bordeaux take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing, factoring in your operational constraints.",
          },
          {
            q: "Can you intervene on controlled-access sites (industrial zones, defence-classified sites)?",
            a: "Yes, subject to the site's own accreditation process. We liaise with your security team in advance and adapt our tools to the IT policies in force (no public cloud, work on dedicated workstation if required).",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on Claude, ChatGPT, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our specific sector (wine, aerospace, digital)?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples and demos. A session for an Aerospace Valley sub-contractor has nothing to do with one for a wine merchant or an H7 startup.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's skills development plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Bordeaux sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Bordeaux met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site et à distance, avec un kick-off obligatoire dans vos locaux bordelais. Cas typiques : automatisation de documentation technique aéronautique, traitement de commandes export viticoles, agents de support numérique, analyse de données de production industrielle.",
        whyHere: [
          "Bordeaux concentre une part importante de nos missions d'implémentation sur les secteurs aéronautique-défense, viti-vinicole export et numérique — trois verticalités où l'IA génère du ROI mesurable et rapide.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux bordelais : alignement des équipes, accès aux données, validation des intégrations (ERP industriel, outil de gestion cave, CRM commercial, messagerie).",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Bordeaux : passation de pouvoir, formation des ambassadeurs internes sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas concrets bordelais : sous-traitants Aerospace Valley (génération automatique de rapports de non-conformité, lecture de plans techniques), négociants en vins (traitement de commandes export, rédaction de fiches techniques multilingues), startups numériques H7 (agents de support, scoring de leads), groupes de santé campus Carreire (synthèse de dossiers médicaux, automatisation de comptes-rendus).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Bordeaux : revue de l'architecture cible (ERP, outil de gestion, mails, stockage documentaire), validation des contraintes RGPD et sécurité (y compris ISO 27001 ou EN 9100 si pertinent), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Bordeaux : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe. Calibration sur vos données réelles dès le premier sprint.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels (données de production, commandes réelles), ajustements UX et performance.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Bordeaux : tests d'acceptation utilisateurs, formation des ambassadeurs internes installés sur leur poste, livraison du runbook de documentation, plan de monitoring post-go-live.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close, vos ambassadeurs pilotent en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (traitement de commandes, lecture de factures, génération de fiches produits) pour un vignoble, un petit négociant ou une TPE de services bordelaise.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/CRM/messagerie. Pour sous-traitants Aerospace Valley, négociants, cabinets et agences de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP industriel, datalake, PLM), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands sites bordelais : cas d'usage cascadés multi-sites Métropole, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation génération automatique de rapports techniques livrée comme prévu. ROI réel mesuré : nos ingénieurs méthodes consacrent désormais ce temps à des tâches à plus forte valeur. Aucun lock-in, on maîtrise nos modèles.",
            role: "Directeur technique",
            companyProfile: "ETI sous-traitante aéronautique, Mérignac",
          },
          {
            quote:
              "Nos fiches techniques export en 5 langues étaient produites manuellement. Axion-IA a mis en place un agent de génération multilingue en quelques semaines. Cadence doublée, erreurs de traduction quasi nulles.",
            role: "Directrice export",
            companyProfile: "Négociant en vins, Bordeaux",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Bordeaux ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions bordelaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Pouvez-vous intégrer l'IA à nos outils métier spécifiques (ERP industriel, outil de gestion cave, PLM) ?",
            a: "Oui. Nos intégrations couvrent les ERP industriels courants (Infor LN, SAP, Sage X3), les outils de gestion viticole (WinSoft, Visi'Viti, TraceOne), les CRM (Salesforce, HubSpot, Pipedrive), la messagerie (Outlook, Gmail) et les espaces documentaires (SharePoint, Notion, Google Drive). Si votre outil est propriétaire, nous passons par l'API ou la couche export disponible.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande. Pour les sites de défense, hébergement on-premise exclusif disponible.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (Claude, GPT, Gemini) pour la qualité maximale ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (plans techniques, contrats export, données de production critiques), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Bordeaux brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site and remote mode, with a mandatory kick-off at your Bordeaux offices. Typical cases: aerospace technical documentation automation, wine export order processing, digital support agents, industrial production data analysis.",
        whyHere: [
          "Bordeaux concentrates a significant share of our implementation missions across aerospace-defence, wine export and digital — three verticals where AI generates measurable and rapid ROI.",
          "Kick-off always happens in person at your Bordeaux offices: team alignment, data access, integration validation (industrial ERP, cellar management tool, commercial CRM, email).",
          "Remote iterations afterwards with a short daily video check-in and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Bordeaux: handover, training of internal ambassadors on their workstations, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Concrete Bordeaux cases: Aerospace Valley sub-contractors (automatic non-conformity report generation, technical drawing reading), wine merchants (export order processing, multilingual technical sheet writing), H7 digital startups (support agents, lead scoring), Carreire campus health groups (medical dossier summary, meeting-minutes automation).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Bordeaux workshop: target architecture review (ERP, management tool, emails, document storage), GDPR and security constraints validation (including ISO 27001 or EN 9100 if relevant), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Bordeaux: access installation, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team. Calibrated on your real data from the first sprint.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily check-in: progressive use-case enrichment, integration with existing tools, real-volume testing (production data, actual orders), UX and performance adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Bordeaux: user acceptance tests, training of internal ambassadors on their workstations, runbook documentation delivery, post-go-live monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed, your ambassadors run autonomously.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (order processing, invoice reading, product sheet generation) for a wine estate, small merchant or Bordeaux services micro-firm.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/CRM/email integration. For Aerospace Valley sub-contractors, merchants, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy industrial ERP, datalake, PLM), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for major Bordeaux sites: cascaded use cases across Métropole sites, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automatic technical report generation implemented as planned. Real ROI measured: our methods engineers now dedicate that time to higher-value tasks. No lock-in, we control our models.",
            role: "Technical Director",
            companyProfile: "Aerospace sub-contractor mid-cap, Mérignac",
          },
          {
            quote:
              "Our export technical sheets in 5 languages were produced manually. Axion-IA deployed a multilingual generation agent within a few weeks. Output doubled, translation errors near zero.",
            role: "Export Director",
            companyProfile: "Wine merchant, Bordeaux",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Bordeaux take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Bordeaux missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment and new estimate. No hidden hourly drift.",
          },
          {
            q: "Can you integrate AI into our sector-specific tools (industrial ERP, cellar management, PLM)?",
            a: "Yes. Our integrations cover common industrial ERPs (Infor LN, SAP, Sage X3), viticulture management tools (WinSoft, Visi'Viti, TraceOne), CRMs (Salesforce, HubSpot, Pipedrive), email (Outlook, Gmail) and document spaces (SharePoint, Notion, Google Drive). If your tool is proprietary, we go through the available API or export layer.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR, DPO on request. For defence sites, exclusive on-premise hosting available.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (Claude, GPT, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (technical drawings, export contracts, critical production data), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause and offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Bordeaux accompagne individuellement les dirigeants et cadres de l'aéronautique/spatial (Aerospace Valley), du négoce viticole, de la French Tech Bordeaux et des ETI de Gironde. À partir de 990 € HT pour les TPE, chaque programme est bâti autour de vos cas d'usage réels — qualification d'appels d'offres aéronautiques, documentation viti-vinicole, développement produit numérique, pilotage commercial ETI. Vous progressez à votre rythme, sans théorie superflue.",
        whyHere: [
          "Bordeaux concentre des ingénieurs et cadres de l'aéronautique (Dassault, Thales, Safran, ArianeGroup) avec des agendas très contraints et des besoins IA précis (documentation technique, qualification AO, reporting). Le coaching 1-to-1 s'adapte à leur réalité sans passer par des formations collectives.",
          "Le tissu viti-vinicole bordelais (négociants, châteaux, coopératives, courtiers) a des besoins IA spécifiques — génération de fiches techniques, gestion des clients export, marketing digital. Le coaching individuel cible ces enjeux précisément.",
          "La French Tech Bordeaux et le hub H7 concentrent des fondateurs et managers qui veulent intégrer l'IA dans leur produit ou service numérique — le coaching 1-to-1 est plus efficace que toute formation collective à ce stade.",
          "Les cadres des ETI de Gironde (Euratlantique, Bordeaux Aéroparc, Cité Numérique Bègles) souhaitant piloter leur montée en compétence IA individuellement trouvent dans ce format un accompagnement adapté à leurs contraintes d'agenda.",
          "Séances flexibles : 100 % visio ou présentiel dans vos locaux bordelais (Mérignac, Pessac, Bègles, Euratlantique, Cité Numérique). Aucun déplacement imposé.",
          "Aucun lock-in : vous repartez avec votre plan d'action et votre autonomie — sans dépendance vis-à-vis d'Axion-IA.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Séance d'ouverture pour cartographier votre maturité IA, vos cas d'usage prioritaires (aéronautique, viticole, numérique, services) et vos outils existants dans le contexte bordelais.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Co-construction d'un programme calé sur votre agenda et votre secteur (aéronautique/défense, viticole, numérique, services B2B). Chaque séance a un objectif actionnable précis.",
          },
          {
            step: "Séances pratiques sur vos vraies données",
            detail:
              "Chaque session travaille directement sur vos documents réels — dossiers techniques, fiches de dégustation, propositions commerciales, rapports de production. L'IA est appliquée à votre réalité, pas à des exemples fictifs.",
          },
          {
            step: "Ancrage et mise en pratique",
            detail:
              "Entre les séances, vous expérimentez les outils sur vos cas réels. La séance suivante débute par un debriefing et un ajustement du plan selon vos retours terrain.",
          },
          {
            step: "Bilan et feuille de route",
            detail:
              "En fin de programme, restitution d'une feuille de route personnalisée : cas d'usage priorisés, outils retenus, prochaines étapes pour votre structure bordelaise. Vous repartez pleinement autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Programme d'entrée pour les gérants de TPE, artisans viticoles, indépendants et startups de la French Tech Bordeaux souhaitant intégrer l'IA dans leur activité quotidienne.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme sur mesure pour dirigeants et cadres des PME aéronautiques, viticoles, numériques et de services de Gironde.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour DG, directeurs industriels, DSI ou directeurs commerciaux des ETI bordelaises (aéronautique, agri-agro, services, numérique).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de cadres dirigeants et managers des grands groupes bordelais (Dassault, Thales, Safran, ArianeGroup) pour des besoins d'acculturation IA individualisés.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de comprendre concrètement comment utiliser l'IA pour qualifier nos appels d'offres aéronautiques. On a travaillé sur nos vrais dossiers techniques dès la première séance. Gain de temps immédiat sur mes process.",
            role: "Directeur des ventes",
            companyProfile: "PME sous-traitant aéronautique, Mérignac – Gironde",
          },
          {
            quote:
              "Format idéal pour un négociant en vins avec un agenda serré : séances courtes, focalisées sur mes enjeux export et ma communication digitale. L'IA est maintenant intégrée dans ma prospection internationale.",
            role: "Directeur général",
            companyProfile: "PME négoce viticole, Bordeaux Métropole",
          },
        ],
        faq: [
          {
            q: "Quel est le format des séances de coaching 1-to-1 à Bordeaux ?",
            a: "Les séances se déroulent en visio ou en présentiel dans vos locaux à Bordeaux, Mérignac, Pessac, Bègles, Euratlantique ou ailleurs dans la Métropole bordelaise. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel.",
          },
          {
            q: "Quelle est la fréquence des séances ?",
            a: "La fréquence est définie ensemble lors du diagnostic initial selon votre rythme et vos objectifs — hebdomadaire, bimensuelle ou mensuelle. Aucun rythme imposé.",
          },
          {
            q: "Le coaching est-il adapté aux acteurs de l'aéronautique bordelaise ?",
            a: "Oui. Le coaching 1-to-1 est particulièrement adapté aux cadres de l'aéronautique/spatial : qualification d'appels d'offres, génération de documentation technique, suivi de projet, reporting. Le vocabulaire et les cas d'usage sont calés sur vos réalités sectorielles.",
          },
          {
            q: "Quels secteurs sont concernés à Bordeaux ?",
            a: "Tous les secteurs B2B de la métropole : aéronautique/spatial/défense, viti-vinicole, numérique (French Tech, Inria), santé, commerce de gros, services aux entreprises. Le coaching s'adapte à votre contexte précis.",
          },
          {
            q: "Mes données et échanges sont-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos données, documents et informations métier ne sortent jamais de la session. Conformité RGPD.",
          },
          {
            q: "Quelle différence entre le coaching 1-to-1 et une intervention collective à Bordeaux ?",
            a: "L'intervention collective forme votre équipe en une journée sur des outils IA généraux. Le coaching 1-to-1 vous accompagne individuellement sur la durée, sur vos cas précis, à votre rythme — vous gagnez en autonomie décisionnelle.",
          },
        ],
        guarantees:
          "Aucun engagement de durée minimum : vous pilotez le programme séance par séance. Confidentialité stricte. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel. Aucun lock-in : vous repartez avec votre feuille de route personnalisée et votre pleine autonomie. Si la première séance ne vous apporte pas de valeur concrète, elle est remboursée intégralement.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Bordeaux individually supports executives and managers in aerospace/space (Aerospace Valley), wine trade, French Tech Bordeaux and Gironde mid-caps. Starting from 990 € excl. VAT for micro-businesses, each programme is built around your real use cases — aerospace RFP qualification, wine-sector documentation, digital product development, mid-cap commercial management. You progress at your own pace, without superfluous theory.",
        whyHere: [
          "Bordeaux concentrates aerospace engineers and managers (Dassault, Thales, Safran, ArianeGroup) with very constrained agendas and precise AI needs (technical documentation, RFP qualification, reporting). 1-to-1 coaching adapts to their reality without group training.",
          "The Bordeaux wine trade (négociants, châteaux, cooperatives, brokers) has specific AI needs — technical sheet generation, export client management, digital marketing. Individual coaching targets these challenges precisely.",
          "French Tech Bordeaux and the H7 hub concentrate founders and managers wanting to integrate AI into their digital product or service — 1-to-1 coaching is more effective than any group training at this stage.",
          "Gironde mid-cap managers (Euratlantique, Bordeaux Aéroparc, Cité Numérique Bègles) wishing to individually steer their AI upskilling find in this format an accompaniment suited to their agenda constraints.",
          "Flexible sessions: 100% video or in person at your Bordeaux offices (Mérignac, Pessac, Bègles, Euratlantique, Cité Numérique). No imposed travel.",
          "No lock-in: you leave with your action plan and full autonomy — no dependency on Axion-IA.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "Opening session to map your AI maturity, priority use cases (aerospace, viticulture, digital, services) and existing tools in the Bordeaux context.",
          },
          {
            step: "Personalised progression plan",
            detail:
              "Co-build a programme fitted to your agenda and sector (aerospace/defence, wine trade, digital, B2B services). Each session has a precise actionable objective.",
          },
          {
            step: "Practical sessions on your real data",
            detail:
              "Each session works directly on your real documents — technical dossiers, tasting sheets, commercial proposals, production reports. AI is applied to your reality, not fictional examples.",
          },
          {
            step: "Anchoring and practice",
            detail:
              "Between sessions, you experiment with tools on your real cases. The next session starts with a debrief and plan adjustment based on your field feedback.",
          },
          {
            step: "Review and roadmap",
            detail:
              "At programme end, a personalised roadmap is delivered: prioritised use cases, retained tools, next steps for your Bordeaux organisation. You leave fully autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From 990 € excl. VAT",
            detail:
              "Entry programme for micro-business owners, wine-sector craftspeople, freelancers and French Tech Bordeaux startups wishing to integrate AI into their daily activity.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Bespoke programme for executives and managers at aerospace, viticulture, digital and service SMEs in Gironde.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Individual support for CEOs, industrial directors, CIOs or commercial directors of Bordeaux mid-caps (aerospace, agri-food, services, digital).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Executive coaching for senior managers at major Bordeaux groups (Dassault, Thales, Safran, ArianeGroup) requiring individualised AI acculturation.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching helped me understand concretely how to use AI for qualifying our aerospace RFPs. We worked on our real technical dossiers from the first session. Immediate time saving on my processes.",
            role: "Sales Director",
            companyProfile: "Aerospace subcontractor SME, Mérignac – Gironde",
          },
          {
            quote:
              "Ideal format for a wine merchant with a tight schedule: short sessions focused on my export challenges and digital communication. AI is now integrated into my international prospecting.",
            role: "Managing Director",
            companyProfile: "Wine trade SME, Bordeaux Métropole",
          },
        ],
        faq: [
          {
            q: "What is the format of 1-to-1 coaching sessions in Bordeaux?",
            a: "Sessions take place by video or in person at your offices in Bordeaux, Mérignac, Pessac, Bègles, Euratlantique or elsewhere in the Bordeaux Métropole. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "How often are the sessions?",
            a: "Frequency is defined together at the initial diagnostic according to your rhythm and objectives — weekly, fortnightly or monthly. No imposed schedule.",
          },
          {
            q: "Is coaching adapted to Bordeaux aerospace players?",
            a: "Yes. 1-to-1 coaching is particularly suited to aerospace/space managers: RFP qualification, technical documentation generation, project tracking, reporting. Vocabulary and use cases are calibrated to your sector reality.",
          },
          {
            q: "Which sectors are covered in Bordeaux?",
            a: "All B2B sectors in the metropolitan area: aerospace/space/defence, wine trade, digital (French Tech, Inria), health, wholesale trade, business services. Coaching adapts to your specific context.",
          },
          {
            q: "Are my data and exchanges kept confidential?",
            a: "Yes. Strict confidentiality from the first session. Your data, documents and business information never leave the session. GDPR compliant.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and a group session in Bordeaux?",
            a: "A group session trains your team in one day on general AI tools. 1-to-1 coaching supports you individually over time, on your specific cases, at your own pace — you gain decision-making autonomy.",
          },
        ],
        guarantees:
          "No minimum commitment: you drive the programme session by session. Strict confidentiality. Lodging, meals and travel allowance billed separately for on-site sessions. No lock-in: you leave with your personalised roadmap and full autonomy. If the first session delivers no concrete value, it is fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Bordeaux ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre bordelais. Aucun supplément géographique : le tarif est le même à Bordeaux que partout en France.",
    },
    {
      q: "Axion-IA intervient-il dans toute la Métropole bordelaise ?",
      a: "Oui. Nous couvrons Bordeaux intra-muros et toute la Métropole en présentiel : Mérignac (Aéroparc, Bordeaux Technowest), Pessac, Talence, Le Bouscat, Bègles (Cité Numérique), Lormont, Cenon, Floirac, Villenave-d'Ornon. Tous les ateliers d'idéation et restitutions clés se tiennent dans vos locaux.",
    },
    {
      q: "Quels secteurs sont prioritaires à Bordeaux ?",
      a: "Nos missions bordelaises couvrent en priorité l'aéronautique-défense (sous-traitants Aerospace Valley, Dassault, Thales, Safran), le négoce et la production viticoles (propriétés, négociants, caves coopératives), le numérique (startups H7, éditeurs logiciels, e-commerce), les services B2B (conseil, expertise comptable, formation) et la santé-recherche (campus Carreire, Neurocampus). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous adapter votre approche aux spécificités du secteur viti-vinicole bordelais ?",
      a: "Oui. Nos consultants maîtrisent les enjeux spécifiques de la filière : gestion de millésimes, traçabilité réglementaire, export en 20+ langues, relation négoce/châteaux. Les démos sont calibrées sur vos documents réels (fiches techniques, bons de commande export, mails courtiers). Une session pour un grand cru classé n'a rien à voir avec une session générique.",
    },
    {
      q: "Travaillez-vous avec les startups bordelaises (French Tech, H7, Cité Numérique) ?",
      a: "Oui. Nous accompagnons les scale-ups et startups de l'écosystème French Tech Bordeaux, de H7 (Bassins à Flot) et de la Cité Numérique (Bègles). Notre offre POC est calibrée pour les structures avec un product-market fit établi qui veulent passer de l'expérimentation IA à un déploiement opérationnel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Bordeaux ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille de la mission). Nous calons une date de démarrage avec vous lors du brief de cadrage initial, et tenons l'engagement contractuel à la signature.",
    },
  ],
};
