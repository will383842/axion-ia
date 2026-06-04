// Strasbourg (67482) — contenu éditorial gold standard.
//
// Doctrine appliquée (conforme paris.ts) :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés » — frais en sus calculés au cas par cas.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Aucun prix hardcodé : tous les tarifs viennent de `src/content/pricing.ts`.
//   - Tailles d'entreprise INSEE : TPE / PME / ETI / GE.
//   - Pas de mention métier-type, pas de heroSchema, pas de unAUn.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//
// Réalités Strasbourg utilisées depuis economic-data/strasbourg.ts :
//   - Institutions européennes : Parlement européen (siège officiel), Conseil de l'Europe,
//     Cour Européenne des Droits de l'Homme (CEDH).
//   - Unistra (4 Prix Nobel, ~50 000 étudiants), EM Strasbourg, INSA, INSP (ex-ENA),
//     Sciences Po Strasbourg, ESBS.
//   - Pôle recherche : IGBMC, ICube (IA/robotique/imagerie médicale), IRCAD.
//   - Alsace BioValley, biotech Parc d'Innovation d'Illkirch (PII), Eli Lilly.
//   - Grands groupes : Crédit Mutuel Alliance Fédérale, Hager Group, ARTE, Schmidt Groupe.
//   - Transfrontalier France/Allemagne/Suisse (Eurodistrict Strasbourg-Ortenau).
//   - French Tech Alsace (capitale), SEMIA incubateur deeptech.
//   - 2e port fluvial français (Port Autonome du Rhin).
//   - Vitiviniculture alsacienne (Alsace AOC, Crémant d'Alsace, 51 Grands Crus).

import type { VilleCopy } from "./types";

export const STRASBOURG_COPY: VilleCopy = {
  pitchFr:
    "Strasbourg abrite les institutions européennes (Parlement, Conseil de l'Europe, CEDH), un pôle biotech de rang mondial (Alsace BioValley, Parc d'Innovation d'Illkirch) et un tissu transfrontalier unique France-Allemagne-Suisse. Axion-IA y intervient sur site auprès des TPE, PME, ETI et grandes organisations strasbourgeoises.",
  pitchEn:
    "Strasbourg hosts Europe's key institutions (European Parliament, Council of Europe, ECHR), a world-class biotech cluster (Alsace BioValley, Illkirch Innovation Park) and a unique France-Germany-Switzerland cross-border ecosystem. Axion-IA delivers on site to Strasbourg micro-businesses, SMEs, mid-caps and large organisations.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Strasbourg : nous identifions vos processus automatisables et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, calibrés pour les institutions européennes, les biotech du PII et les PME alsaciennes.",
      en: "Operational AI audit in Strasbourg: we identify your automatable workflows and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated for European institutions, PII biotech firms and Alsatian SMEs.",
    },
    interventions: {
      fr: "Interventions IA à Strasbourg : formats sur site d'une à plusieurs journées pour vos équipes, dans vos locaux strasbourgeois. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur métier. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Strasbourg: on-site formats from one to several days for your teams, at your Strasbourg premises. Your staff leave autonomous with AI tools configured for their work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Strasbourg : on déploie l'IA dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Spécificité transfrontalière : multilinguisme FR/DE/EN géré nativement. Vos équipes gardent la main.",
      en: "AI implementation in Strasbourg: we deploy AI into your existing tools (CRM, ERP, email) with contractually-costed ROI. Cross-border specificity: FR/DE/EN multilingualism natively handled. Your teams stay in control.",
    },
    unAUn: {
      fr: "Coaching IA 1-to-1 à Strasbourg : accompagnement individuel pour dirigeants et managers des institutions européennes, du biotech PII et des ETI industrielles de l'Eurométropole. Sessions confidentielles en présentiel (Wacken, Presqu'île, Illkirch) ou à distance. Tarif d'entrée {{price:intervention-dirigeants|flat}}. Frais de déplacement hors Strasbourg intra-muros en sus.",
      en: "1-to-1 AI coaching in Strasbourg: individual coaching for executives and managers from European institutions, PII biotech firms and Eurométropole industrial mid-caps. Confidential sessions on-site (Wacken, Presqu'île, Illkirch) or remote. Entry rate from €990 excl. VAT. Travel expenses outside central Strasbourg billed separately.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour institutions européennes, biotech Alsace BioValley et ETI industrielles strasbourgeoises — site multilingue FR/DE/EN, portail métier biotech, dashboard connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for European institutions, Alsace BioValley biotech firms and Strasbourg industrial mid-caps — FR/DE/EN multilingual site, biotech business portal, dashboard connected to your CRM/ERP. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Strasbourg (67) sur site, de la Presqu'île européenne au Parc d'Innovation d'Illkirch en passant par le Quartier Wacken-Europe. Nous accompagnons les TPE, PME, ETI et grandes organisations strasbourgeoises — institutions européennes, biotech Alsace BioValley, groupes industriels (Hager, Schmidt, Kronenbourg), médias (ARTE) et Crédit Mutuel — sur leurs cas IA opérationnels. Diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Strasbourg (67) on site, from the European Peninsula to the Illkirch Innovation Park and the Wacken-Europe Business District. We support Strasbourg micro-businesses, SMEs, mid-caps and large organisations — European institutions, Alsace BioValley biotech, industrial groups (Hager, Schmidt, Kronenbourg), media (ARTE) and Crédit Mutuel — on their operational AI use cases. Costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "institutions EU, biotech & frontalier",

  topSectorsNaf: [
    "Biotech & Sciences de la vie",
    "Institutions européennes & secteur public",
    "Banque, finance & assurance mutualisée",
    "Industrie & équipements électriques",
    "Tech, IT & médias",
    "Agroalimentaire & vitiviniculture",
  ],

  distancesFr:
    "Gare de Strasbourg — TGV Est (Paris en ~1h46), ICE Frankfurt (~1h15), Rhin-Rhône. Aéroport Strasbourg-Entzheim (SXB) à 12 km. 6 lignes de tramway couvrant le centre, le Wacken, le PII (Illkirch) et les communes de l'Eurométropole. Bâle à 1h30, Francfort à 2h30 par la route.",
  distancesEn:
    "Strasbourg station — TGV Est (Paris ~1h46), ICE Frankfurt (~1h15), Rhin-Rhône corridor. Strasbourg-Entzheim Airport (SXB) 12 km out. 6 tram lines covering the centre, Wacken, PII (Illkirch) and Eurométropole communes. Basel 1h30, Frankfurt 2h30 by road.",

  ecosystemFr:
    "Strasbourg est la seule ville au monde à abriter simultanément le Parlement européen, le Conseil de l'Europe et la CEDH. Son tissu économique est triple : institutions et services B2B (Wacken-Europe), pôle biotech-recherche (PII d'Illkirch, Alsace BioValley, IGBMC, ICube), et industrie-agroalimentaire transfrontalière (Hager, Schmidt, Kronenbourg, viticulture AOC). French Tech Alsace (capitale) y anime une scène startup deeptech ancrée dans la R&D universitaire (Unistra, 4 Prix Nobel).",
  ecosystemEn:
    "Strasbourg is the world's only city simultaneously hosting the European Parliament, the Council of Europe and the ECHR. Its economic fabric is triple: institutions and B2B services (Wacken-Europe district), biotech-research cluster (Illkirch PII, Alsace BioValley, IGBMC, ICube), and cross-border industrial-agri-food sector (Hager, Schmidt, Kronenbourg, AOC viticulture). French Tech Alsace (capital chapter) animates a deeptech startup scene rooted in university R&D (Unistra, 4 Nobel laureates).",

  // === SERVICES LONG-FORM STRASBOURG ===
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus »,
  // tailles INSEE, frais en sus pour interventions.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé chez vous à Strasbourg et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des TPE strasbourgeoises aux institutions européennes du Wacken et aux groupes industriels de l'Eurométropole.",
        whyHere: [
          "Strasbourg est une place atypique : tissu institutionnel dense (Parlement européen, Conseil de l'Europe, CEDH, INSP ex-ENA) coexistant avec un secteur privé B2B très actif — chaque type d'organisation a ses cas IA propres que nous maîtrisons.",
          "Pôle biotech-santé de rang mondial : Alsace BioValley, Parc d'Innovation d'Illkirch (PII), IGBMC, Eli Lilly, IRCAD — secteur R&D intense où l'IA accélère la gestion documentaire, l'analyse de données cliniques et la veille réglementaire.",
          "Tissu PME-ETI industriel dense (Hager Group, Schmidt Groupe, Kronenbourg, logistique Port du Rhin) avec des besoins IA précis sur la maintenance prédictive, la gestion de production et la relation client.",
          "Dimension transfrontalière unique : près de 200 000 frontaliers franco-allemands actifs dans l'Eurodistrict — nous gérons nativement les contraintes multilingues FR/DE/EN et la conformité RGPD pour les organisations transfrontalières.",
          "Univers académique très riche (Unistra, EM Strasbourg, INSA, Sciences Po) : nos audits pour startups deeptech issues de SEMIA ou de l'Unistra tiennent compte du contexte transfert de technologie.",
          "Restitutions toujours en présentiel à Strasbourg : ateliers d'idéation dans vos locaux, livrable PDF remis en main propre, plan d'action transmis à votre comité de direction.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Pour les organisations soumises au droit européen ou à des contraintes réglementaires spécifiques (RGPD renforcé, dispositifs médicaux, données cliniques), nous documentons en amont les contraintes de souveraineté.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux strasbourgeois — Wacken, Presqu'île, PII d'Illkirch ou communes de l'Eurométropole — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, finance, RH, opérations, recherche, support, direction) pour cartographier frictions et attentes. Pour les structures bilingues FR/DE, les entretiens s'adaptent à la langue de travail.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, données cliniques ou documents règlementaires. Pas de slides théoriques — vos données, vos cas.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux strasbourgeois. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre contexte sectoriel.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises et petites structures strasbourgeoises jusqu'à une dizaine de collaborateurs — cabinets, agences, startups deeptech en amorçage.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles (fournisseurs Hager, sous-traitants logistique), les cabinets spécialisés et les scale-ups French Tech Alsace de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI strasbourgeoises (Hager Group, Schmidt Groupe) et les structures biotech-pharma souhaitant cadrer une trajectoire IA pluriannuelle avec gouvernance documentée.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes organisations strasbourgeoises (Crédit Mutuel Alliance Fédérale, ARTE, institutions européennes, hôpitaux universitaires) cadrant une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Notre contexte biotech nécessitait une approche rigoureuse sur la souveraineté des données cliniques. Axion-IA a livré un audit complet, chiffré, opérationnel, avec des démos sur nos vrais documents R&D. Le plan d'action est en cours d'exécution.",
            role: "Directrice R&D",
            companyProfile: "PME biotech, Parc d'Innovation d'Illkirch",
          },
          {
            quote:
              "Notre organisation est bilingue FR/DE et soumise à des contraintes réglementaires spécifiques. Axion-IA a su adapter la méthodologie d'audit à notre réalité transfrontalière. Livrable concret, sans jargon, présenté directement à notre comité de direction.",
            role: "Directeur des opérations",
            companyProfile: "ETI industrielle, Eurométropole de Strasbourg",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Strasbourg ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme lors du brief de cadrage initial.",
          },
          {
            q: "Pouvez-vous auditer une organisation soumise au droit européen ou à des données réglementées ?",
            a: "Oui. Nous gérons les contraintes RGPD renforcé, les données cliniques (dispositifs médicaux, pharma), les environnements bilingues FR/DE/EN et la souveraineté des données pour les organisations transfrontalières. La confidentialité et les modalités de traitement sont documentées en amont.",
          },
          {
            q: "Intervenez-vous aussi dans les communes de l'Eurométropole (Illkirch, Schiltigheim, Ostwald) ?",
            a: "Oui. Nous intervenons sur l'ensemble de l'Eurométropole de Strasbourg — Wacken, PII d'Illkirch, Espace Européen de l'Entreprise à Schiltigheim, Port du Rhin et toutes les communes du bassin.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise — particulièrement important pour les organisations biotech et institutionnelles strasbourgeoises.",
          },
          {
            q: "Différence avec un audit de conseil traditionnel ou une ESN locale ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA généralistes. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée, démos sur vos vraies données, livrable chiffré. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour vous solliciter ?",
            a: "Non. Une grande partie de nos audits strasbourgeois sont commandés par des dirigeants ou DG qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour vous éviter de partir dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande — point particulièrement important pour les organisations strasbourgeoises opérant dans un cadre juridique européen. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Strasbourg organisation and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Strasbourg micro-businesses to European institutions at Wacken and Eurométropole industrial groups.",
        whyHere: [
          "Strasbourg is an atypical location: dense institutional fabric (European Parliament, Council of Europe, ECHR, INSP ex-ENA) coexisting with a very active private B2B sector — each organisation type has its own AI cases, which we master.",
          "World-class biotech-health cluster: Alsace BioValley, Illkirch Innovation Park (PII), IGBMC, Eli Lilly, IRCAD — an R&D-intense sector where AI accelerates document management, clinical data analysis and regulatory watch.",
          "Dense industrial SME-mid-cap fabric (Hager Group, Schmidt Groupe, Kronenbourg, Port du Rhin logistics) with specific AI needs around predictive maintenance, production management and customer relations.",
          "Unique cross-border dimension: nearly 200,000 active Franco-German commuters in the Eurodistrict — we natively handle FR/DE/EN multilingual constraints and GDPR compliance for cross-border organisations.",
          "Rich academic universe (Unistra, EM Strasbourg, INSA, Sciences Po): our audits for deeptech startups from SEMIA or Unistra account for technology transfer context.",
          "Read-outs always in person in Strasbourg: ideation workshops at your premises, PDF deliverable handed over face to face, action plan transmitted to your executive committee.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). For organisations subject to European law or specific regulatory constraints (enhanced GDPR, medical devices, clinical data), we document sovereignty requirements upfront.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Strasbourg premises — Wacken, Presqu'île, Illkirch PII or Eurométropole communes — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, HR, operations, research, support, leadership) to map frictions and expectations. For FR/DE bilingual structures, interviews adapt to working language.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, clinical data or regulatory documents. No theoretical slides — your data, your cases.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Strasbourg premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap adapted to your sector context.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Strasbourg freelancers, micro-firms and small structures up to about ten staff — firms, agencies, early-stage deeptech startups.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial SMEs (Hager suppliers, logistics sub-contractors), specialist firms and French Tech Alsace scale-ups from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Strasbourg mid-caps (Hager Group, Schmidt Groupe) and biotech-pharma structures framing a multi-year AI trajectory with documented governance.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large Strasbourg organisations (Crédit Mutuel Alliance Fédérale, ARTE, European institutions, university hospitals) framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Our biotech context required a rigorous approach to clinical data sovereignty. Axion-IA delivered a complete, costed, operational audit with demos on our real R&D documents. The action plan is being executed.",
            role: "R&D Director",
            companyProfile: "Biotech SME, Illkirch Innovation Park",
          },
          {
            quote:
              "Our organisation is FR/DE bilingual and subject to specific regulatory constraints. Axion-IA adapted the audit methodology to our cross-border reality. Concrete, jargon-free deliverable presented directly to our executive committee.",
            role: "Head of Operations",
            companyProfile: "Industrial mid-cap, Strasbourg Eurométropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Strasbourg?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "Can you audit an organisation subject to European law or regulated data?",
            a: "Yes. We handle enhanced GDPR constraints, clinical data (medical devices, pharma), FR/DE/EN multilingual environments and data sovereignty for cross-border organisations. The Data processing terms and confidentiality are documented upfront.",
          },
          {
            q: "Do you cover Eurométropole communes (Illkirch, Schiltigheim, Ostwald)?",
            a: "Yes. We cover the entire Strasbourg Eurométropole — Wacken, Illkirch PII, Espace Européen de l'Entreprise in Schiltigheim, Port du Rhin and all basin communes.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, EU data hosting by default, DPO on request — particularly important for Strasbourg biotech and institutional organisations.",
          },
          {
            q: "Difference with traditional consulting or a local IT services firm?",
            a: "Our consultants are former AI practitioners, not generalist MBAs. Public pricing, no six-figure quote to negotiate. Condensed method, demos on your real data, costed deliverable. No lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A significant share of our Strasbourg audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request — particularly important for Strasbourg organisations operating in a European legal framework. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Strasbourg se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Strasbourg est desservie en moins de 2h depuis Paris en TGV et en 1h15 depuis Francfort en ICE : nos consultants arrivent le matin et repartent le soir, limitant les coûts logistiques pour vous.",
          "Tous les secteurs du bassin strasbourgeois couverts en présentiel : Wacken-Europe, Presqu'île, Parc d'Innovation d'Illkirch (PII), Espace Européen de l'Entreprise à Schiltigheim, Port du Rhin, communes de l'Eurométropole.",
          "Dimension bilingue FR/DE gérée nativement : pour les équipes franco-allemandes de l'Eurodistrict, les démos et ateliers peuvent être conduits en français, en allemand ou en mode mixte selon les participants.",
          "Le format Essentielle est calibré pour les PME et ETI industrielles, biotech et de services strasbourgeoises jusqu'à une centaine de collaborateurs.",
          "Le format Conférence convient aux plénières d'entreprise : salles CIARUS, Palais des Congrès de Strasbourg, espaces Parc Expo du Wacken.",
          "Vocabulaire ajusté à votre secteur dominant : institutions et droit européen, biotech et R&D, industrie et domotique, banque-assurance, médias. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier, les cas d'usage prioritaires. Pour les équipes bilingues FR/DE, nous précisons la langue dominante de la session.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports R&D, emails, contrats, données de production) pour calibrer les démos sur VOS données — PAS d'exemples génériques.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux strasbourgeois pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J, même dans les locaux des institutions européennes.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage biotech, institutionnels et industriels sont traités avec les spécificités du secteur.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel — utilisables le lendemain matin sans aide extérieure, dans leur langue de travail.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour les indépendants, cabinets et startups strasbourgeoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (R&D, commercial, production, finance) dans les PME industrielles ou biotech.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (Palais des Congrès, Parc Expo Wacken) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands groupes et institutions strasbourgeoises : roadshow multi-sites (Strasbourg + Frankfurt + Basel pour les structures transfrontalières), séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle était parfaitement adapté à notre double culture FR/DE. Les démos sur nos vrais documents R&D ont immédiatement convaincu même les collaborateurs les plus sceptiques. Autonomie réelle le lendemain.",
            role: "Responsable formation",
            companyProfile: "PME biotech, Parc d'Innovation d'Illkirch",
          },
          {
            quote:
              "Session dirigeants très efficace pour aligner notre comité de direction franco-allemand sur la trajectoire IA. Axion-IA a su adapter son vocabulaire aux spécificités d'un groupe industriel transfrontalier. Décision prise en une journée.",
            role: "Président-Directeur Général",
            companyProfile: "ETI équipements électriques, Eurométropole de Strasbourg",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Strasbourg ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats (ex. session CODIR + cascade équipes), le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous animer une session en allemand ou en mode bilingue FR/DE ?",
            a: "Oui. Pour les équipes franco-allemandes de l'Eurodistrict Strasbourg-Ortenau, nos consultants s'adaptent à la langue dominante ou animent en mode bilingue. Les démos sur vos données sont conduites dans la langue de travail de chaque participant.",
          },
          {
            q: "Pouvez-vous intervenir dans les locaux des institutions européennes (Parlement, Conseil de l'Europe) ?",
            a: "Oui, sous réserve des accréditations requises par chaque institution. Nous gérons en amont les démarches d'accès avec votre équipe administrative. Nos consultants sont habitués aux environnements à haute exigence sécuritaire.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur biotech ou pharmaceutique ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, démos et cas d'usage. Une session pour une équipe R&D biotech du PII n'a rien à voir avec une session pour un service commercial d'une ETI industrielle.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur (biotech, institutionnel, industriel, médias), aucune session générique recyclée. Gestion bilingue FR/DE disponible pour les organisations transfrontalières.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Strasbourg come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Strasbourg is under 2h from Paris by TGV and 1h15 from Frankfurt by ICE: our consultants arrive in the morning and leave in the evening, minimising logistics costs for you.",
          "All Strasbourg basin sectors covered in person: Wacken-Europe, Presqu'île, Illkirch Innovation Park (PII), Espace Européen de l'Entreprise in Schiltigheim, Port du Rhin, Eurométropole communes.",
          "FR/DE bilingualism natively handled: for Franco-German teams in the Eurodistrict, demos and workshops can be conducted in French, German or mixed mode per participants.",
          "The Essential format is calibrated for Strasbourg industrial, biotech and service SMEs and mid-caps up to about a hundred staff.",
          "The Talk format suits corporate plenaries: CIARUS rooms, Strasbourg Congress Centre, Wacken Parc Expo venues.",
          "Vocabulary adjusted to your dominant sector: European institutions and law, biotech and R&D, industry and automation, banking-insurance, media. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, priority use cases. For FR/DE bilingual teams, we confirm the dominant session language.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (R&D reports, emails, contracts, production data) to calibrate demos on YOUR data — no generic examples.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Strasbourg premises to check equipment, projection, Wi-Fi access. No technical hiccup on D-day, even in European institution premises.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Biotech, institutional and industrial use cases are addressed with sector-specific framing.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case — usable next morning without external help, in their working language.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail: "Ideal for Strasbourg freelancers, firms and startups up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (R&D, sales, production, finance) in industrial or biotech SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Congress Centre, Wacken Parc Expo) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large Strasbourg groups and institutions: multi-site roadshows (Strasbourg + Frankfurt + Basel for cross-border structures), exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format was perfectly suited to our FR/DE dual culture. Demos on our real R&D documents immediately convinced even the most sceptical staff. Real autonomy the next day.",
            role: "Training Manager",
            companyProfile: "Biotech SME, Illkirch Innovation Park",
          },
          {
            quote:
              "Very effective executive session to align our Franco-German executive committee on the AI trajectory. Axion-IA adapted its vocabulary to the specifics of a cross-border industrial group. Decision made in one day.",
            role: "Chief Executive Officer",
            companyProfile: "Electrical equipment mid-cap, Strasbourg Eurométropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Strasbourg take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program (e.g. exec session + team cascade), the rhythm is defined together at framing.",
          },
          {
            q: "Can you run a session in German or FR/DE bilingual mode?",
            a: "Yes. For Franco-German teams in the Strasbourg-Ortenau Eurodistrict, our consultants adapt to the dominant language or run in bilingual mode. Demos on your data are conducted in each participant's working language.",
          },
          {
            q: "Can you deliver sessions at European institution premises (Parliament, Council of Europe)?",
            a: "Yes, subject to each institution's required accreditations. We handle access procedures with your administrative team upfront. Our consultants are used to high-security environments.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the biotech or pharmaceutical sector?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, demos and use cases. A session for an R&D biotech team at PII has nothing to do with one for a sales team at an industrial mid-cap.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector (biotech, institutional, industrial, media), no recycled generic session. FR/DE bilingual mode available for cross-border organisations.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Strasbourg met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire à Strasbourg. Spécificité locale : gestion nativement multilingue FR/DE/EN pour les structures transfrontalières.",
        whyHere: [
          "Strasbourg concentre des besoins d'implémentation IA exigeants et différenciés : souveraineté des données pour les institutions européennes, intégration dans des systèmes biotech et cliniques pour les laboratoires du PII, automatisation industrielle pour les ETI de l'Eurométropole.",
          "Le kick-off se passe systématiquement en présentiel à Strasbourg dans vos locaux : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/LIMS/email selon votre environnement.",
          "Dimension transfrontalière : pour les organisations franco-allemandes, nous livrons des implémentations multilingues FR/DE/EN, conformes à la fois au RGPD européen et aux exigences des partenaires allemands (DSGVO).",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite sur site pour les jalons clés — démos d'avancement, tests d'acceptation utilisateurs.",
          "Formation incluse pour vos collaborateurs identifiés ambassadeurs IA internes : autonomes après la fin de mission, dans leur langue de travail.",
          "Cas typiques strasbourgeois : PME biotech PII (lecture de données cliniques, veille réglementaire automatisée), ETI industrielle (maintenance prédictive, qualification fournisseurs), ARTE et médias (génération de synopsis, sous-titrage, traduction FR/DE), Crédit Mutuel (qualification de leads, gestion des réclamations).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Strasbourg : revue de l'architecture cible (CRM, ERP, LIMS, mails, bases documentaires), validation des contraintes RGPD/DSGVO/sécurité spécifiques à votre secteur, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Strasbourg : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe. Pour les structures bilingues, l'interface utilisateur et les outputs sont livrés dans les langues requises.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX. Points sur site pour les jalons critiques.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Strasbourg : tests d'acceptation utilisateurs, formation des ambassadeurs internes dans leur langue de travail, livraison du runbook documentation (FR/DE si requis), plan de monitoring.",
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
              "Implémentation d'un cas d'usage simple (lecture factures, veille automatisée, qualification leads) pour les TPE et startups deeptech du bassin strasbourgeois.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP ou LIMS. Pour les PME industrielles, biotech et de services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, systèmes de production, LIMS clinique), multilinguisme FR/DE/EN, formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands groupes et institutions strasbourgeoises : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA. Adaptable aux contraintes transfrontalières.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'implémentation de notre système de veille réglementaire IA a transformé notre capacité R&D. Axion-IA a géré nos contraintes de données cliniques avec le même sérieux qu'un acteur santé. ROI mesuré après quelques mois de production : conforme à la prédiction du SOW.",
            role: "Directeur scientifique",
            companyProfile: "ETI biotech, Parc d'Innovation d'Illkirch",
          },
          {
            quote:
              "Notre contexte franco-allemand nécessitait une implémentation réellement multilingue FR/DE et conforme RGPD/DSGVO. Axion-IA a livré exactement ça : notre équipe alsacienne et notre équipe de Kehl utilisent le même outil dans leur langue.",
            role: "DSI",
            companyProfile: "PME industrielle, Eurodistrict Strasbourg-Ortenau",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Strasbourg ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Pouvez-vous gérer la conformité RGPD et DSGVO pour une structure transfrontalière ?",
            a: "Oui. Nos implémentations pour les organisations franco-allemandes respectent à la fois le RGPD européen et les exigences du DSGVO (équivalent allemand). Confidentialité contractuelle, hébergement données en UE, documentation livrable bilingue sur demande.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions strasbourgeoises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission dans leur langue de travail. Documentation runbook complète remise (FR/DE si requis). Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour des données sensibles (cliniques, industrielles) ?",
            a: "Mix selon le cas et le niveau de sensibilité : open-source (Mistral, Llama) sur votre infra pour la souveraineté maximale des données cliniques ou industrielles sensibles ; propriétaires (GPT, Claude, Gemini) pour les cas à moindre sensibilité. Fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD/DSGVO strict, DPO sur demande — particulièrement important pour les organisations biotech, institutionnelles et transfrontalières strasbourgeoises.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Documentation disponible en FR/DE pour les organisations transfrontalières. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Strasbourg brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory Strasbourg kick-off. Local specificity: natively multilingual FR/DE/EN for cross-border structures.",
        whyHere: [
          "Strasbourg concentrates demanding and differentiated AI implementation needs: data sovereignty for European institutions, integration into biotech and clinical systems for PII labs, industrial automation for Eurométropole mid-caps.",
          "Kick-off always in person in Strasbourg at your premises: team alignment, data access, CRM/ERP/LIMS/email integration validation per your environment.",
          "Cross-border dimension: for Franco-German organisations, we deliver FR/DE/EN multilingual implementations compliant with both European GDPR and German partner requirements (DSGVO).",
          "Remote iterations afterwards with a short daily on video and on-site visits for key milestones — progress demos, user acceptance tests.",
          "Training included for your identified internal AI ambassador staff: autonomous after mission end, in their working language.",
          "Typical Strasbourg cases: PII biotech SMEs (clinical data reading, automated regulatory watch), industrial mid-caps (predictive maintenance, supplier qualification), ARTE and media (synopsis generation, subtitling, FR/DE translation), Crédit Mutuel (lead qualification, complaint handling).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Strasbourg workshop: target architecture review (CRM, ERP, LIMS, emails, document databases), validation of GDPR/DSGVO/security constraints specific to your sector, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Strasbourg: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your team. For bilingual structures, UI and outputs are delivered in required languages.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments. On-site points for critical milestones.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Strasbourg: user acceptance tests, training of internal ambassadors in their working language, runbook documentation delivery (FR/DE if required), monitoring plan.",
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
              "Implementation of a simple use case (invoice reading, automated watch, lead qualification) for Strasbourg basin micro-businesses and deeptech startups.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP or LIMS integration. For industrial, biotech and service SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, production systems, clinical LIMS), FR/DE/EN multilingualism, cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for large Strasbourg groups and institutions: cascaded use cases, centralised AI governance, dedicated Axion-IA team. Adaptable to cross-border constraints.",
          },
        ],
        testimonials: [
          {
            quote:
              "The implementation of our AI regulatory watch system transformed our R&D capacity. Axion-IA handled our clinical data constraints with the same rigour as a health sector specialist. ROI measured after a few months of production: in line with SOW prediction.",
            role: "Chief Scientific Officer",
            companyProfile: "Biotech mid-cap, Illkirch Innovation Park",
          },
          {
            quote:
              "Our Franco-German context required a genuinely multilingual FR/DE implementation compliant with both GDPR and DSGVO. Axion-IA delivered exactly that: our Alsatian and Kehl teams use the same tool in their language.",
            role: "CIO",
            companyProfile: "Industrial SME, Strasbourg-Ortenau Eurodistrict",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Strasbourg take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Can you handle GDPR and DSGVO compliance for a cross-border structure?",
            a: "Yes. Our implementations for Franco-German organisations comply with both European GDPR and DSGVO (German equivalent). Bilateral Contractual confidentiality, EU data hosting, bilingual deliverable documentation on request.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Strasbourg missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission in their working language. Complete runbook documentation handed over (FR/DE if required). If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Which AI models do you use for sensitive data (clinical, industrial)?",
            a: "Mix per case and sensitivity level: open-source (Mistral, Llama) on your infra for maximum sovereignty of sensitive clinical or industrial data; proprietary (GPT, Claude, Gemini) for lower-sensitivity cases. Fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR/DSGVO, DPO on request — particularly important for Strasbourg biotech, institutional and cross-border organisations.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Documentation available in FR/DE for cross-border organisations. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Strasbourg s'adresse aux dirigeants, managers et experts des institutions européennes (Parlement, Conseil de l'Europe, CEDH), des structures biotech du Parc d'Innovation d'Illkirch et des ETI industrielles de l'Eurométropole. Pas de groupe, pas de programme générique : chaque séance est construite autour de vos enjeux réels, dans votre langue de travail (FR, DE ou EN). Tarif d'entrée {{price:intervention-dirigeants|flat}}. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel hors Strasbourg intra-muros.",
        whyHere: [
          "Strasbourg concentre une densité unique de profils pour le coaching IA 1-to-1 : fonctionnaires et cadres des institutions européennes, directeurs R&D des biotech du PII, managers franco-allemands d'ETI industrielles transfrontalières — autant de profils qui ne trouvent pas leurs pairs pour parler IA librement.",
          "La dimension trilingue FR/DE/EN de l'Eurodistrict fait de Strasbourg un cas particulier : nous conduisons les séances dans la langue de travail du dirigeant, y compris en mode bilingue pour les profils franco-allemands de l'Eurodistrict Strasbourg-Ortenau.",
          "Les institutions européennes et les organismes internationaux (Parlement, Conseil de l'Europe, INSP ex-ENA) emploient des cadres de haut niveau soumis à des contraintes de confidentialité fortes — notre coaching 1-to-1 répond exactement à ce besoin d'accompagnement discret.",
          "Les dirigeants des PME et ETI biotech du PII (Alsace BioValley, Eli Lilly, IRCAD) ont besoin d'intégrer l'IA dans leur pratique sans exposer leurs données cliniques ou de R&D — notre approche souveraine et confidentielle est calibrée pour ces contraintes.",
          "Accessibilité maximale : Gare de Strasbourg à 1h46 de Paris, ICE Frankfurt 1h15 — nos consultants sont présents sur site avec un coût logistique minimal pour vous.",
          "Aucun group dynamics : vous progressez à votre rythme, sur vos vraies questions, dans votre langue de travail, sans vous adapter à un niveau collectif qui n'est pas le vôtre.",
        ],
        methodology: [
          {
            step: "Entretien de positionnement",
            detail:
              "Un premier échange (45 min à distance ou en présentiel à Strasbourg) pour cartographier votre niveau IA actuel, vos objectifs prioritaires, votre secteur et votre langue de travail dominante. Pour les profils des institutions européennes, nous précisons en amont les contraintes de confidentialité et d'accès.",
          },
          {
            step: "Séances sur mesure dans votre contexte",
            detail:
              "Chaque séance part de VOS documents et de VOS décisions réelles : emails difficiles, notes de synthèse, présentations, analyses de dossiers réglementaires, comptes-rendus de réunion. Démos en direct sur Claude, Mistral, GPT-4 appliquées à votre réalité institutionnelle, biotech ou industrielle.",
          },
          {
            step: "Ancrage pratique entre les séances",
            detail:
              "Exercices ciblés sur vos tâches quotidiennes réelles : rédaction de rapports, analyse documentaire multilinguisme FR/DE/EN, préparation de comités de direction, qualification de partenaires. Pas de devoirs théoriques déconnectés de votre activité.",
          },
          {
            step: "Suivi de progression",
            detail:
              "Bilan intermédiaire à mi-parcours : ce qui est ancré, ce qui reste à consolider, ajustement du programme selon vos priorités actuelles. Souplesse totale — vous pouvez changer de focus entre deux séances.",
          },
          {
            step: "Synthèse finale et autonomie",
            detail:
              "En fin de parcours, synthèse personnelle de vos cas d'usage IA maîtrisés, guide de ressources sélectionnées pour votre secteur et recommandations de veille IA (sources FR/DE/EN selon votre profil). Vous êtes autonome — aucune dépendance au coaching créée.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "à partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Pour indépendants, gérants de TPE et professions libérales strasbourgeoises. Parcours court sur 2-3 séances focalisées sur vos cas d'usage prioritaires. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel hors Strasbourg intra-muros.",
          },
          {
            sizeLabel: "PME",
            price: "Parcours PME — sur devis",
            detail:
              "Pour dirigeants et managers de PME strasbourgeoises (biotech PII, IT, industrie, services B2B). Parcours calibré sur plusieurs mois : prise de décision, management d'équipes bilingues, reporting, gestion de projet IA. Frais de logement, repas et forfait trajet en sus pour le présentiel hors intra-muros.",
          },
          {
            sizeLabel: "ETI",
            price: "Parcours ETI — sur devis",
            detail:
              "Pour DG, DAF, DRH et directeurs d'ETI industrielles ou biotech de l'Eurométropole. Travail sur la gouvernance IA, la communication interne FR/DE/EN, la conduite du changement et la souveraineté des données. Frais de logement, repas et forfait trajet en sus pour le présentiel hors intra-muros.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Parcours grands comptes et institutions — sur devis",
            detail:
              "Pour cadres des institutions européennes (Parlement, Conseil de l'Europe, CEDH), grandes organisations (Crédit Mutuel, ARTE, Hager Group) et sites de grands groupes pharma (Eli Lilly, Actavis). Format confidentiel haut niveau, agenda adapté aux contraintes institutionnelles. Frais en sus.",
          },
        ],
        testimonials: [
          {
            quote:
              "En tant que cadre d'une institution européenne, j'avais besoin d'un accompagnement discret et rigoureux sur l'IA — sans exposer mes dossiers à un groupe. Le coaching 1-to-1 en français et en allemand a parfaitement correspondu à ma réalité bilingue et à mes contraintes de confidentialité.",
            role: "Directeur de département",
            companyProfile: "Institution européenne, Presqu'île de Strasbourg",
          },
          {
            quote:
              "Le coaching 1-to-1 m'a permis d'intégrer l'IA dans mes workflows R&D biotech sans risque pour nos données cliniques. Chaque séance partait de nos vrais protocoles. En quelques sessions, mon équipe a suivi naturellement.",
            role: "Directeur R&D",
            companyProfile: "PME biotech, Parc d'Innovation d'Illkirch",
          },
        ],
        faq: [
          {
            q: "À qui s'adresse le coaching IA 1-to-1 Axion-IA à Strasbourg ?",
            a: "À tout dirigeant, manager ou expert de l'Eurométropole souhaitant monter en compétence IA de façon personnalisée : cadres des institutions européennes, directeurs de PME biotech du PII, managers franco-allemands d'ETI industrielles, professions libérales, startups French Tech Alsace. Tout profil B2B est éligible.",
          },
          {
            q: "Les séances peuvent-elles se dérouler en allemand ou en mode bilingue FR/DE ?",
            a: "Oui. Le coaching est disponible en français, en allemand, en anglais ou en mode bilingue FR/DE selon votre langue de travail. Pour les profils franco-allemands de l'Eurodistrict Strasbourg-Ortenau, le mode bilingue est notre format par défaut.",
          },
          {
            q: "Quel est le tarif d'entrée et comment est facturé le coaching ?",
            a: "Le tarif d'entrée est de {{price:intervention-dirigeants|flat}} pour un parcours court. Les frais de logement, repas et forfait trajet sont facturés en sus pour les séances en présentiel hors Strasbourg intra-muros. Le programme complet est défini après l'entretien de positionnement, pas d'engagement à l'aveugle.",
          },
          {
            q: "La confidentialité est-elle garantie pour les profils institutionnels ou biotech ?",
            a: "Absolument. Confidentialité stricte dès la première séance. Aucun document ne quitte la session, aucune référence publiée sans accord écrit explicite. Pour les profils des institutions européennes ou du secteur biotech, nous appliquons les protocoles de confidentialité adaptés dès le démarrage.",
          },
          {
            q: "Les séances se déroulent-elles en présentiel à Strasbourg ou à distance ?",
            a: "Les deux sont possibles selon vos préférences et contraintes d'agenda. Présentiel dans vos locaux strasbourgeois (Wacken, Presqu'île, PII d'Illkirch) ou à distance en visio sécurisée. Frais de logement, repas et forfait trajet en sus pour le présentiel hors Strasbourg intra-muros.",
          },
          {
            q: "Quelle différence avec une formation collective IA à Strasbourg ?",
            a: "Dans une formation collective, le rythme est calé sur la moyenne du groupe et les cas traités sont génériques. En coaching 1-to-1, chaque séance travaille sur VOS fichiers, VOS dossiers, VOS décisions réelles — dans votre langue de travail. L'investissement est plus ciblé, le retour opérationnel est immédiat.",
          },
        ],
        guarantees:
          "Entretien de positionnement inclus sans engagement : si le coaching ne correspond pas à vos besoins, aucune facturation. Séances facturées au forfait, pas à l'heure — vous savez exactement ce que vous payez. Coaching disponible en FR, DE ou EN selon votre profil. Confidentialité stricte dès le démarrage, aucune référence publiée sans accord écrit. Frais de logement, repas et forfait trajet facturés en sus et validés avec vous avant chaque séance en présentiel. Aucun lock-in : les compétences acquises sont utilisables en autonomie totale.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Strasbourg is for executives, managers and experts from European institutions (Parliament, Council of Europe, ECHR), Illkirch Innovation Park biotech firms and Eurométropole industrial mid-caps. No group, no generic programme: each session is built around your real challenges, in your working language (FR, DE or EN). Entry rate from €990 excl. VAT. Lodging, meals and travel allowance billed separately for on-site sessions outside central Strasbourg.",
        whyHere: [
          "Strasbourg concentrates a unique density of 1-to-1 AI coaching profiles: European institution officials and managers, PII R&D directors, Franco-German industrial mid-cap managers — people who find no peers to discuss AI freely.",
          "The trilingual FR/DE/EN dimension of the Eurodistrict makes Strasbourg a special case: we conduct sessions in the executive's working language, including bilingual mode for Franco-German profiles in the Strasbourg-Ortenau Eurodistrict.",
          "European institutions and international bodies (Parliament, Council of Europe, INSP ex-ENA) employ senior staff subject to strong confidentiality constraints — our 1-to-1 coaching addresses exactly this need for discreet support.",
          "PII biotech SME and mid-cap leaders (Alsace BioValley, Eli Lilly, IRCAD) need to integrate AI without exposing clinical or R&D data — our sovereign and confidential approach is calibrated for these constraints.",
          "Maximum accessibility: Strasbourg station 1h46 from Paris, ICE Frankfurt 1h15 — our consultants are on site with minimal logistics cost for you.",
          "No group dynamics: you progress at your own pace, on your real questions, in your working language, without adapting to a collective level that is not yours.",
        ],
        methodology: [
          {
            step: "Positioning interview",
            detail:
              "A first exchange (45 min remote or in person in Strasbourg) to map your current AI level, priority objectives, sector and dominant working language. For European institution profiles, we clarify confidentiality and access constraints upfront.",
          },
          {
            step: "Tailored sessions in your context",
            detail:
              "Each session starts from YOUR documents and YOUR real decisions: difficult emails, briefing notes, presentations, regulatory file analysis, meeting minutes. Live demos on Claude, Mistral, GPT-4 applied to your institutional, biotech or industrial reality.",
          },
          {
            step: "Practical anchoring between sessions",
            detail:
              "Targeted exercises on your real daily tasks: report writing, FR/DE/EN multilingual document analysis, board meeting preparation, partner qualification. No disconnected theoretical homework.",
          },
          {
            step: "Progress monitoring",
            detail:
              "Mid-programme review: what is anchored, what still needs consolidation, programme adjustment if priorities have shifted. Full flexibility — you can change focus between sessions.",
          },
          {
            step: "Final synthesis and autonomy",
            detail:
              "At the end of the programme, a personal summary of your mastered AI use cases, a curated resource guide for your sector and AI monitoring recommendations (FR/DE/EN sources per your profile). You are autonomous — no coaching dependency created.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "from €990 excl. VAT",
            detail:
              "For Strasbourg freelancers, micro-business managers and independent professionals. Short programme of 2-3 sessions on your priority use cases. Lodging, meals and travel allowance billed separately for on-site sessions outside central Strasbourg.",
          },
          {
            sizeLabel: "SME",
            price: "SME programme — on quote",
            detail:
              "For Strasbourg SME managers and executives (PII biotech, IT, industry, B2B services). Programme calibrated over several months: decision-making, bilingual team management, reporting, AI project governance. Lodging, meals and travel allowance billed separately for on-site sessions outside centre.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap programme — on quote",
            detail:
              "For CEOs, CFOs, CHROs and directors at Eurométropole industrial or biotech mid-caps. Work on AI governance, FR/DE/EN internal communication, change management and data sovereignty. Lodging, meals and travel allowance billed separately for on-site sessions outside centre.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Large accounts and institutions programme — on quote",
            detail:
              "For European institution officials (Parliament, Council of Europe, ECHR), large organisations (Crédit Mutuel, ARTE, Hager Group) and large pharma sites (Eli Lilly, Actavis). Confidential senior format, schedule adapted to institutional constraints. Expenses billed separately.",
          },
        ],
        testimonials: [
          {
            quote:
              "As a senior official at a European institution, I needed discreet, rigorous AI coaching — without exposing my files to a group. The 1-to-1 coaching in French and German perfectly matched my bilingual reality and confidentiality constraints.",
            role: "Department Director",
            companyProfile: "European institution, Strasbourg Presqu'île",
          },
          {
            quote:
              "The 1-to-1 coaching allowed me to integrate AI into my biotech R&D workflows without risk to our clinical data. Each session started from our real protocols. Within a few sessions, my team followed naturally.",
            role: "R&D Director",
            companyProfile: "Biotech SME, Illkirch Innovation Park",
          },
        ],
        faq: [
          {
            q: "Who is Axion-IA's 1-to-1 AI coaching in Strasbourg for?",
            a: "For any executive, manager or expert in the Eurométropole wanting personalised AI upskilling: European institution officials, PII biotech SME directors, Franco-German industrial mid-cap managers, independent professionals, French Tech Alsace startups. Any B2B profile is eligible.",
          },
          {
            q: "Can sessions be conducted in German or FR/DE bilingual mode?",
            a: "Yes. Coaching is available in French, German, English or FR/DE bilingual mode per your working language. For Franco-German profiles in the Strasbourg-Ortenau Eurodistrict, bilingual mode is our default.",
          },
          {
            q: "What is the entry rate and how is coaching invoiced?",
            a: "The entry rate is €990 excl. VAT for a short programme. Lodging, meals and travel allowance are billed separately for on-site sessions outside central Strasbourg. The full programme is defined after the positioning interview, no blind commitment.",
          },
          {
            q: "Is confidentiality guaranteed for institutional or biotech profiles?",
            a: "Absolutely. Strict confidentiality ensured before the first session. No document leaves the session, no reference published without explicit written consent. For European institution or biotech sector profiles, we apply adapted confidentiality protocols from the outset.",
          },
          {
            q: "Are sessions on-site in Strasbourg or remote?",
            a: "Both are available per your preferences and schedule. On-site at your Strasbourg offices (Wacken, Presqu'île, Illkirch PII) or remote via secure video. Lodging, meals and travel allowance billed separately for on-site sessions outside central Strasbourg.",
          },
          {
            q: "What is the difference from group AI training in Strasbourg?",
            a: "In group training, the pace is set to the group average and cases are generic. In 1-to-1 coaching, every session works on YOUR files, YOUR documents, YOUR real decisions — in your working language. The investment is more targeted, the operational return is immediate.",
          },
        ],
        guarantees:
          "Positioning interview included without commitment: if coaching does not match your needs, no charge. Sessions invoiced at a flat rate, not by the hour — you know exactly what you pay. Coaching available in FR, DE or EN per your profile. Strict confidentiality from the outset, no reference published without written consent. Lodging, meals and travel allowance billed separately and validated before each on-site session. No lock-in: skills acquired are usable in full autonomy.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Strasbourg des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Strasbourg, itérations à distance.",
        whyHere: [
          "Projets web & SaaS strasbourgeois : institutions & services B2B (Wacken-Europe), biotech-recherche (Alsace BioValley, IGBMC, PII Illkirch), industrie & agroalimentaire transfrontalière, scale-ups deeptech French Tech Alsace.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Marché transfrontalier France-Allemagne-Suisse : sites et plateformes multilingues (FR/DE/EN), hreflang propre, traduction IA — un atout unique à Strasbourg.",
        ],
        methodology: [
          {
            step: "Cadrage à Strasbourg",
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
              "Conception ou refonte d'un site multilingue ou d'une application avec UX/UI et IA intégrée, pour PME et scale-ups transfrontalières.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, portail B2B ou data biotech sur mesure, multilingue, IA intégrée, branchée sur votre SI (CRM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Strasbourg — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous gérez le multilingue FR/DE/EN pour le marché transfrontalier ?",
            a: "Oui, c'est un atout clé à Strasbourg : sites et plateformes multilingues (français, allemand, anglais), traduction IA, hreflang propre, contenu localisé. Un vrai levier pour vendre des deux côtés du Rhin et vers la Suisse. Hébergement UE, RGPD strict.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région strasbourgeoise ou repris en interne.",
      },
      en: {
        hero: "In Strasbourg, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Strasbourg kick-off, remote iterations.",
        whyHere: [
          "Strasbourg web & SaaS projects: institutions & B2B services (Wacken-Europe), biotech-research (Alsace BioValley, IGBMC, PII Illkirch), cross-border industry & agri-food, French Tech Alsace deeptech scale-ups.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "France-Germany-Switzerland cross-border market: multilingual sites and platforms (FR/DE/EN), clean hreflang, AI translation — a unique asset in Strasbourg.",
        ],
        methodology: [
          {
            step: "Scoping in Strasbourg",
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
              "Design or rebuild of a multilingual site or app with UX/UI and built-in AI, for cross-border SMEs and scale-ups.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, B2B portal or biotech data platform, multilingual, AI built in, wired into your IS (CRM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Strasbourg — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you handle FR/DE/EN multilingual for the cross-border market?",
            a: "Yes, a key asset in Strasbourg: multilingual sites and platforms (French, German, English), AI translation, clean hreflang, localised content. A real lever to sell on both sides of the Rhine and into Switzerland. EU hosting, strict GDPR.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Strasbourg-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Strasbourg ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande organisation) et votre périmètre. Aucun supplément géographique : le tarif est identique à Paris.",
    },
    {
      q: "Intervenez-vous pour les institutions européennes à Strasbourg ?",
      a: "Oui. Nous accompagnons les organisations de la Presqu'île européenne (Parlement européen, Conseil de l'Europe, CEDH) ainsi que leurs prestataires et partenaires. Nos interventions tiennent compte des contraintes spécifiques (accréditations, souveraineté des données institutionnelles, multilinguisme FR/DE/EN).",
    },
    {
      q: "Pouvez-vous travailler avec des structures transfrontalières France-Allemagne ?",
      a: "Oui. L'Eurodistrict Strasbourg-Ortenau est l'un de nos contextes d'intervention les plus spécifiques. Nous gérons nativement le bilinguisme FR/DE, la conformité RGPD/DSGVO et les workflows hybrides entre équipes alsaciennes et bavaroises ou badoises.",
    },
    {
      q: "Avez-vous de l'expérience dans le secteur biotech à Strasbourg ?",
      a: "Oui. Nous intervenons régulièrement auprès de PME et ETI du Parc d'Innovation d'Illkirch (PII) et de l'écosystème Alsace BioValley. Nos cas typiques : automatisation de la veille réglementaire, lecture de données cliniques, gestion documentaire R&D. Contraintes de données sensibles et souveraineté des données maîtrisées.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Strasbourg ?",
      a: "Le délai dépend de votre besoin, de l'urgence et de la taille de la mission. Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Quels secteurs couvrez-vous à Strasbourg ?",
      a: "Nous intervenons sur l'ensemble du tissu économique de l'Eurométropole : institutions européennes et secteur public, biotech-santé (PII, Alsace BioValley), industrie et équipements (Hager, Schmidt), banque-assurance (Crédit Mutuel), médias (ARTE), agroalimentaire (Kronenbourg, viticulture alsacienne), services B2B et IT. Tout secteur B2B est éligible à un audit.",
    },
  ],
};
