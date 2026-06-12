// Limoges (87085) — contenu éditorial (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/limoges.ts (Sprint City Quality V3, ville #28).
// Réalités locales : Legrand (CAC 40, siège mondial), porcelaine Bernardaud / Haviland /
// Royal Limoges (IGP), Texelis, Madrange, ESTER Technopole, Pôle Européen de la
// Céramique, IRCER CNRS, XLIM CNRS, ENSIL-ENSCI, 3iL, Université de Limoges,
// French Tech Limoges, Gare Bénédictins (MH Art déco, axe POLT Paris-Toulouse).

import type { VilleCopy } from "./types";

export const LIMOGES_COPY: VilleCopy = {
  pitchFr:
    "Limoges réunit le siège mondial de Legrand (CAC 40), la capitale mondiale de la porcelaine (Bernardaud, Haviland, Royal Limoges — IGP protégée), ESTER Technopole et l'université ENSIL-ENSCI. Axion-IA y intervient sur site, des TPE limougeaudes aux grands groupes industriels et à la direction IA de Legrand.",
  pitchEn:
    "Limoges hosts the global HQ of Legrand (CAC 40), the world capital of porcelain (Bernardaud, Haviland, Royal Limoges — protected GI), ESTER Technopole and ENSIL-ENSCI engineering school. Axion-IA delivers on site, from Limoges micro-businesses to large industrial groups and Legrand AI leadership.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Limoges : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. Du Sur place adapté aux TPE artisanales au Stratégique ETI pour les grandes directions de Legrand ou les manufactures de porcelaine.",
      en: "Operational AI audit in Limoges: we map what can be automated at your company and quantify the ROI. From Sur place suited to artisan micro-firms to Mid-cap Strategic for large Legrand divisions or porcelain manufacturers.",
    },
    interventions: {
      fr: "Interventions IA à Limoges : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Limoges: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Limoges : on déploie l'IA dans vos outils existants (CRM, ERP, MES, systèmes de production) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Limoges: we deploy AI into your existing tools (CRM, ERP, MES, production systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Limoges : coaching 1-to-1 sur mesure pour dirigeants, cadres et experts (manufactures, industrie électrique, céramique technique, conseil). Progressez à votre rythme, sur vos vrais enjeux.",
      en: "Individual AI coaching in Limoges: bespoke 1-to-1 for executives, managers and experts (manufacturers, electrical industry, technical ceramics, consulting). Progress at your pace, on your real challenges.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI de la Haute-Vienne — site vitrine premium pour manufactures de porcelaine IGP (Bernardaud, Haviland, Royal Limoges) et négoce, espace client B2B pour fournisseurs industrie électrique (Legrand) et céramique technique, dashboard métier connecté à votre CRM/ERP/MES. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Haute-Vienne SMEs and mid-caps — premium showcase site for GI porcelain manufacturers (Bernardaud, Haviland, Royal Limoges) and traders, B2B client portal for electrical industry (Legrand) and technical ceramics suppliers, business dashboard connected to your CRM/ERP/MES. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Limoges (87) sur site — centre-ville, ESTER Technopole, zones industrielles et communes du bassin (Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne). Nous accompagnons les TPE, PME, ETI et grandes entreprises limougeaudes (industrie électrique, porcelaine, céramique, agroalimentaire, santé, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Limoges (87) on site — city centre, ESTER Technopole, industrial zones and basin communes (Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne). We support Limoges micro-businesses, SMEs, mid-caps and large enterprises (electrical industry, porcelain, ceramics, agri-food, health, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "porcelaine, cuir & santé",

  topSectorsNaf: [
    "Industrie électrique & domotique (Legrand CAC 40)",
    "Céramique technique & porcelaine (Bernardaud, Haviland, Royal Limoges)",
    "Commerce & Services aux entreprises",
    "Santé, Recherche & Enseignement supérieur (CHU, Université, IRCER)",
    "Agroalimentaire & Élevage (Madrange, Limousin Label Rouge/IGP)",
    "Numérique & Édition logicielle (ESTER Technopole, 3iL)",
  ],

  distancesFr:
    "Gare de Limoges-Bénédictins (classée Monument Historique Art déco, 1929) en cœur de ville — axe POLT (Paris-Orléans-Limoges-Toulouse) desservant Paris, Orléans, Brive, Cahors et Toulouse. Aéroport de Limoges-Bellegarde (LIG) à 10 km. Liaisons routières directes vers Bordeaux (~220 km), Paris (~400 km) et Clermont-Ferrand (~175 km).",
  distancesEn:
    "Limoges-Bénédictins station (listed Art Deco historic monument, 1929) in the city centre — POLT line (Paris-Orléans-Limoges-Toulouse) serving Paris, Orléans, Brive, Cahors and Toulouse. Limoges-Bellegarde Airport (LIG) 10 km away. Direct road links to Bordeaux (~220 km), Paris (~400 km) and Clermont-Ferrand (~175 km).",

  ecosystemFr:
    "Tissu industriel et technologique singulier — siège mondial Legrand (CAC 40, ~36 000 salariés), capitale mondiale de la porcelaine IGP (Bernardaud, Haviland, Royal Limoges), Pôle Européen de la Céramique, ESTER Technopole (céramique technique, électronique, sciences du vivant), IRCER CNRS, XLIM CNRS (photonique, IA, image), ENSIL-ENSCI, 3iL ingénieurs, Texelis (mobilité industrielle), Madrange (agroalimentaire), French Tech Limoges et CHU régional.",
  ecosystemEn:
    "Singular industrial and technological fabric — Legrand global HQ (CAC 40, ~36,000 staff), world capital of protected GI porcelain (Bernardaud, Haviland, Royal Limoges), European Ceramics Hub, ESTER Technopole (technical ceramics, electronics, life sciences), IRCER CNRS, XLIM CNRS (photonics, AI, imaging), ENSIL-ENSCI, 3iL engineers, Texelis (industrial mobility), Madrange (agri-food), French Tech Limoges and regional CHU.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Limoges ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise). Aucun supplément géographique : le tarif est identique à Limoges et partout en France.",
    },
    {
      q: "Avez-vous des cas clients à Limoges ou en Haute-Vienne ?",
      a: "Oui. Nos références incluent des entreprises industrielles, des PME de services et des manufactures artisanales du bassin limougeaud. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par secteur.",
    },
    {
      q: "Quels secteurs sont prioritaires à Limoges pour une mission IA ?",
      a: "Nos déploiements à Limoges couvrent en priorité l'industrie électrique (Legrand et sous-traitants), la porcelaine et la céramique (Bernardaud, Haviland, manufactures artisanales), l'agroalimentaire (Madrange, filières élevage), la santé (CHU, Inserm) et le numérique (ESTER Technopole, 3iL). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Intervenez-vous aussi dans les communes du bassin (Couzeix, Panazol, Isle, Condat-sur-Vienne) ?",
      a: "Oui. Le bassin limougeaud entier est notre zone d'intervention : Couzeix, Panazol, Le Palais-sur-Vienne, Isle, Condat-sur-Vienne, Aixe-sur-Vienne et les autres communes environnantes. Aucun supplément de zone.",
    },
    {
      q: "Travaillez-vous avec les entreprises du pôle ESTER Technopole ?",
      a: "Oui. Nous accompagnons les PME et ETI implantées à ESTER Technopole — céramique technique, électronique, sciences du vivant — ainsi que les startups de la French Tech Limoges souhaitant passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "Pouvez-vous accompagner une manufacture de porcelaine ou un artisan céramiste ?",
      a: "Oui. Nous adaptons l'approche aux réalités des manufactures (catalogues produits complexes, clients internationaux, gestion qualité, e-commerce artisanal) et aux contraintes des PME familiales. L'audit identifie les cas d'usage IA concrets et chiffrés, quel que soit le niveau de maturité numérique.",
    },
  ],

  // === SERVICES LONG-FORM LIMOGES ===
  // Même structure que lyon.ts. Aucun prix en dur, aucun délai chiffré.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise limougeaude et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des TPE artisanales de la porcelaine aux directions IA du siège Legrand en passant par les PME d'ESTER Technopole.",
        whyHere: [
          "Limoges concentre un écosystème industriel rare en France : siège mondial Legrand (CAC 40), capitale mondiale de la porcelaine IGP, pôle céramique technique ESTER — des cas d'usage IA opérationnels spécifiques que nos consultants maîtrisent.",
          "Tissu B2B sectorisé sur-représenté chez nos clients : industrie électrique et domotique (Legrand et sous-traitants), manufactures porcelaine (Bernardaud, Haviland, Royal Limoges), céramique technique (ESTER), agroalimentaire (Madrange, filières Limousin).",
          "Nos consultants se déplacent sur l'ensemble du bassin limougeaud : centre-ville, ESTER Technopole, zones industrielles Magré et Romanet, Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux, lecture du livrable avec votre comité de direction ou vos responsables de manufacture, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI industrielles limougeaudes avec des workflows complexes (Legrand, Texelis, manufactures porcelaine).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Limoges dans vos locaux — centre-ville, ESTER Technopole, zone Magré ou commune du bassin — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, R&D, production, qualité, support, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités sectorielles limogeaudes (protocoles industrie électrique, qualité porcelaine, contraintes CHU, compliance agroalimentaire).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, rapports qualité, données de production. Pas de slides théoriques — on part de vos documents réels, que ce soit un catalogue porcelaine, une fiche produit Legrand ou un rapport sanitaire Madrange.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux limougeauds. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur — industrie, porcelaine, numérique ou santé.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, artisans céramistes, manufactures familiales et petits cabinets limougeauds jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME d'ESTER Technopole, éditeurs logiciels (3iL), entreprises de services et manufactures de porcelaine de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles limougeaudes (Texelis, Madrange, sous-traitants Legrand) ou ETI porcelaine souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises dont le siège ou un site majeur est implanté à Limoges, notamment les directions IA et transformation de Legrand.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel en quelques semaines. Le rapport est chiffré, actionnable, sans jargon. Nos responsables de production ont pu prioriser les chantiers IA dès la restitution.",
            role: "Directeur industriel",
            companyProfile: "ETI industrie, bassin de Limoges",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données de production — pas des slides génériques. Le livrable a convaincu notre direction de lancer les deux premiers projets IA avec un ROI chiffré.",
            role: "Directrice de la transformation",
            companyProfile: "PME services, ESTER Technopole Limoges",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Limoges ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une ETI industrielle à Limoges ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, suivi de production, qualification appels d'offres, lecture factures fournisseurs). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou de manufacture restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs réglementés limougeauds (industrie électrique, agroalimentaire, santé CHU), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Limoges ?",
            a: "Toujours en présentiel dans vos locaux limougeauds. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi pour les sous-traitants de Legrand ou des manufactures de porcelaine ?",
            a: "Oui. Nous accompagnons toutes les tailles, des sous-traitants TPE aux ETI de la filière électrique et céramique. L'audit est calibré selon votre taille et votre secteur, avec des cas d'usage ancrés dans la réalité limougeaude.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits limougeauds sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs contraints (industrie, agro, santé).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Limoges business and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from artisan porcelain micro-firms to large Legrand AI divisions and ESTER Technopole SMEs.",
        whyHere: [
          "Limoges hosts a rare industrial ecosystem in France: Legrand global HQ (CAC 40), world capital of protected GI porcelain, ESTER technical ceramics hub — specific operational AI use cases our consultants master.",
          "Limoges B2B fabric over-represented in our cases: electrical and smart-building industry (Legrand and sub-contractors), porcelain manufacturers (Bernardaud, Haviland, Royal Limoges), technical ceramics (ESTER), agri-food (Madrange, Limousin supply chains).",
          "Our consultants travel across the full Limoges basin: city centre, ESTER Technopole, Magré and Romanet industrial zones, Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne.",
          "Read-outs always in person: ideation workshops at your Limoges offices, deliverable walk-through with your leadership or manufacture managers, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Limoges industrial mid-caps with complex workflows (Legrand, Texelis, porcelain manufacturers).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Limoges at your offices — city centre, ESTER Technopole, Magré zone or basin commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, R&D, production, quality, support, leadership) to map frictions and expectations, accounting for Limoges sector specifics (electrical industry protocols, porcelain quality, CHU constraints, agri-food compliance).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, quality reports, production data. No theoretical slides — we work from your actual documents, whether a porcelain catalogue, a Legrand product sheet or a Madrange sanitary report.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Limoges offices. Costed PDF deliverable handed over, actionable roadmap tailored to your sector — industry, porcelain, digital or health.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Limoges freelancers, artisan ceramicists, family manufacturers and small practices up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for ESTER Technopole SMEs, software publishers (3iL), service firms and porcelain manufacturers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Limoges industrial mid-caps (Texelis, Madrange, Legrand sub-contractors) or porcelain mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises with HQ or a major site in Limoges, particularly Legrand's AI and transformation divisions.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit within a few weeks. The report is costed, actionable, jargon-free. Our production managers were able to prioritize AI initiatives right after the read-out.",
            role: "Industrial Director",
            companyProfile: "Industrial mid-cap, Limoges basin",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data — not generic slides. The deliverable convinced our leadership to launch the first two AI projects with a costed ROI.",
            role: "Head of Transformation",
            companyProfile: "Services SME, ESTER Technopole Limoges",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Limoges?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Limoges?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, production tracking, tender qualification, supplier invoice reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my industrial or manufacturing data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For Limoges regulated sectors (electrical industry, agri-food, CHU health), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Limoges?",
            a: "Always in person at your Limoges offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Legrand sub-contractors or porcelain manufacturers?",
            a: "Yes. We support all sizes, from sub-contractor micro-firms to mid-caps in the electrical and ceramics supply chain. The audit is calibrated to your size and sector, with use cases grounded in Limoges industrial reality.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Limoges audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in constrained sectors (industry, agri-food, health).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Limoges se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en usine, en manufacture, au bureau ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Limoges est un terrain d'intervention singulier : industrie électrique Legrand, manufactures de porcelaine, céramique technique ESTER et PME de services constituent des publics avec des attentes très concrètes en matière d'outils IA opérationnels.",
          "Tous les sites et communes du bassin couverts en présentiel : centre-ville, ESTER Technopole, zones industrielles Magré et Romanet, Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne.",
          "Le format collectif (1 journée) est calibré pour les structures limougeaudes de quelques personnes à une centaine de collaborateurs, en particulier les PME technologiques d'ESTER et les manufactures de porcelaine familiales.",
          "Le format Conférence convient aux plénières d'entreprise limogeaudes (salles Legrand, amphithéâtres Université de Limoges, espaces ESTER).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des directions de Legrand.",
          "Vocabulaire ajusté à votre secteur dominant : industrie électrique, porcelaine/céramique, agroalimentaire, santé/recherche, numérique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires industrie ou agroalimentaire — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, emails, fiches produits porcelaine, données de production, dossiers clients) pour calibrer les démos sur VOS données limogeaudes.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux limougeauds pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes déconnectés ou ateliers de manufacture.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle limougeaude.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit en atelier de manufacture, en bureau Legrand ou en itinérance commerciale.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Formation collective",
            detail:
              "Idéal pour indépendants, artisans céramistes, manufactures familiales et petites agences limougeaudes jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département — commercial, R&D, production, qualité — particulièrement efficace pour les PME d'ESTER Technopole.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (directions Legrand, ETI industrielles) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sites majeurs limougeauds — roadshow multi-sites bassin, séminaires CODIR + cascade équipes terrain ou ateliers de production.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format collectif (1 journée) a parfaitement collé aux attentes de nos équipes production. Ils sont repartis avec leurs outils configurés sur leurs vrais process. Dès le lendemain, plusieurs les utilisaient pour rédiger des comptes-rendus qualité.",
            role: "Responsable production",
            companyProfile: "PME céramique, ESTER Technopole Limoges",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles limogeaudes — pas de session générique, des cas concrets qui parlaient à nos équipes.",
            role: "DG",
            companyProfile: "ETI industrie, bassin de Limoges",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Limoges ?",
            a: "Cela dépend du format choisi. Le format collectif se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des ateliers de manufacture ou des sites industriels ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels et de manufacture limougeauds — postes déconnectés, VLAN sécurisés, protocoles accès site, ateliers de production porcelaine ou électrique. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur porcelaine ou industrie électrique ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une manufacture Bernardaud n'a rien à voir avec une session pour une direction informatique Legrand.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur limougeaud — industrie électrique, porcelaine, agroalimentaire, numérique, santé — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Limoges come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on the factory floor, in the porcelain workshop, at the office or with clients. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Limoges is a unique engagement ground: Legrand electrical industry, porcelain manufacturers, ESTER technical ceramics and services SMEs form audiences with very concrete expectations around operational AI tools.",
          "All sites and basin communes covered in person: city centre, ESTER Technopole, Magré and Romanet industrial zones, Couzeix, Panazol, Isle, Condat-sur-Vienne, Aixe-sur-Vienne.",
          "The one-day format is calibrated for Limoges structures from a few people to about a hundred staff, particularly ESTER technology SMEs and family porcelain manufacturers.",
          "The Talk format suits Limoges corporate plenaries (Legrand rooms, Université de Limoges amphitheatres, ESTER spaces).",
          "The Executives format enables in-camera framing for industrial mid-cap executive committees and Legrand directorates.",
          "Vocabulary adjusted to your dominant sector: electrical industry, porcelain/ceramics, agri-food, health/research, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including industrial or agri-food regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, emails, porcelain product sheets, production data, client files) to calibrate demos on YOUR Limoges data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Limoges premises to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with air-gapped workstations or manufacture workshops.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Limoges sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether in a porcelain workshop, a Legrand office or in the field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Group format",
            detail:
              "Ideal for Limoges freelancers, artisan ceramicists, family manufacturers and small agencies up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department — sales, R&D, production, quality — particularly effective for ESTER Technopole SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Legrand divisions, industrial mid-caps) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Limoges major sites — multi-site basin roadshows, exec committee seminars + production floor or workshop cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The one-day format perfectly matched our production team's needs. They left with tools configured for their real processes. By the next day, several were already using them to write quality reports.",
            role: "Production Manager",
            companyProfile: "Ceramics SME, ESTER Technopole Limoges",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our Limoges sector constraints — no generic session, concrete cases that resonated with our teams.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Limoges basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Limoges take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in manufacture workshops or industrial sites?",
            a: "Yes. Our consultants adapt to Limoges industrial and manufacture environment constraints — air-gapped workstations, secure VLANs, site access protocols, porcelain or electrical production workshops. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the porcelain or electrical industry sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Bernardaud manufacturer has nothing to do with one for a Legrand IT directorate.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Limoges sector — electrical industry, porcelain, agri-food, digital, health — no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Limoges met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux limougeauds — centre-ville, ESTER Technopole, zones industrielles ou commune du bassin.",
        whyHere: [
          "Limoges concentre une part de nos missions d'implémentation dans l'industrie électrique (Legrand et sous-traitants), la céramique technique (ESTER), les manufactures de porcelaine (Bernardaud, Haviland, Royal Limoges), l'agroalimentaire (Madrange) et les services numériques (3iL).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux limougeauds : alignement des équipes, accès aux données de production, validation des intégrations CRM/ERP/MES.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Limoges : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier de manufacture.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques limougeauds : ETI industrielles (automatisation rapports qualité, surveillance production Texelis, sous-traitants Legrand), manufactures porcelaine (génération catalogues, gestion clientèle internationale), PME d'ESTER (agents support, copilotes R&D), agroalimentaire (documentation réglementaire, contrôle qualité Madrange).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Limoges : revue de l'architecture cible (CRM, ERP, MES, systèmes industriels), validation des contraintes RGPD/sécurité et réglementaires (industrie, agro, santé), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Limoges : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Limoges : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple — automatisation devis, gestion catalogue porcelaine, qualification leads pour TPE et indépendants limougeauds.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME d'ESTER Technopole, manufactures, éditeurs logiciels et cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, MES, datalake), formation ambassadeurs cross-département. Adapté aux ETI industrielles et porcelaine limougeaudes.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes limougeauds : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie. Pertinent pour les directions Legrand.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation rapports qualité livrée comme promis. ROI mesuré dès les premiers mois : nos techniciens passent maintenant moins de temps sur les rapports et plus sur l'amélioration produit. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI industrie, bassin de Limoges",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe entre l'atelier et le bureau. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME céramique technique, ESTER Technopole Limoges",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Limoges ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions limogeaudes. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles ou de manufacture restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés limougeauds (industrie électrique, agroalimentaire, santé), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données industrielles critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (pièces critiques, dossiers réglementaires, données qualité), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Limoges brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Limoges premises — city centre, ESTER Technopole, industrial zones or a basin commune.",
        whyHere: [
          "Limoges hosts a share of our implementation missions in electrical industry (Legrand and sub-contractors), technical ceramics (ESTER), porcelain manufacturers (Bernardaud, Haviland, Royal Limoges), agri-food (Madrange) and digital services (3iL).",
          "Kick-off always happens in person at your Limoges premises: team alignment, access to production data, CRM/ERP/MES integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Limoges: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or manufacture workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Limoges cases: industrial mid-caps (quality report automation, Texelis production monitoring, Legrand sub-contractors), porcelain manufacturers (catalogue generation, international client management), ESTER SMEs (support agents, R&D copilots), agri-food (regulatory documentation, Madrange quality control).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Limoges workshop: target architecture review (CRM, ERP, MES, industrial systems), GDPR/security and regulatory constraints validation (industry, agri-food, health), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Limoges: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Limoges: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case — quote automation, porcelain catalogue management, lead qualification for Limoges micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For ESTER Technopole SMEs, manufacturers, software publishers and firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, MES, datalake), cross-department ambassador training. Tailored for Limoges industrial and porcelain mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Limoges large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode. Relevant for Legrand directorates.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quality report automation implementation delivered as promised. ROI measured within the first months: our technicians now spend less time on reports and more on product improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Industrial mid-cap, Limoges basin",
          },
          {
            quote:
              "Perfect hybrid method for our team between the workshop and the office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Technical ceramics SME, ESTER Technopole Limoges",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Limoges take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Limoges missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial or manufacturing data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Limoges regulated sectors (electrical industry, agri-food, health), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical industrial data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical components, regulatory files, quality data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA individuel Axion-IA à Limoges accompagne les dirigeants, cadres et experts en face-à-face sur leurs enjeux IA personnels. Format confidentiel et sur mesure — adapté aux managers de manufactures, cadres dirigeants de Legrand, responsables R&D d'ESTER ou entrepreneurs de la French Tech Limoges. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Limoges réunit des profils de dirigeants atypiques — responsables de grandes manufactures patrimoniales, directeurs de filiales CAC 40, ingénieurs-chercheurs CNRS, entrepreneurs deeptech — pour lesquels un accompagnement individuel sur mesure est plus pertinent qu'une session collective.",
          "Le format 1-to-1 permet d'aborder des enjeux confidentiels : stratégie IA de manufacture, transformation digitale d'une filière patrimoniale (porcelaine), positionnement concurrentiel dans la filière électrique.",
          "Sessions organisables dans vos bureaux limougeauds, dans un espace neutre (ESTER Technopole, espaces de coworking) ou à distance selon vos préférences.",
          "Accompagnement calibré à votre niveau de maturité IA : débutant complet ou expert souhaitant aller plus loin sur un sujet précis (RAG, agents IA, fine-tuning, gouvernance).",
          "Contenu 100 % ancré dans votre réalité sectorielle limougeaude : pas de cas d'usage génériques, tout part de votre contexte métier réel.",
          "Aucun engagement de durée minimale imposé : vous choisissez le nombre de séances selon vos besoins et votre agenda de dirigeant.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un échange préalable confidentiel pour cerner vos enjeux IA personnels, votre niveau de maturité actuel et vos objectifs — stratégiques, opérationnels ou techniques.",
          },
          {
            step: "Programme sur mesure",
            detail:
              "Construction d'un programme de séances adapté à votre profil : dirigeant manufacture, cadre Legrand, entrepreneur ESTER, chercheur CNRS. Rythme et thèmes définis avec vous.",
          },
          {
            step: "Séances individuelles",
            detail:
              "Sessions en présentiel à Limoges ou à distance. Chaque séance alterne apports ciblés, démos sur vos cas réels et mises en pratique immédiate sur vos outils.",
          },
          {
            step: "Ressources personnalisées",
            detail:
              "Fiches, prompts, outils et bibliothèque de ressources calibrés pour votre secteur limougeaud. Utilisables en autonomie entre les séances.",
          },
          {
            step: "Bilan et suite",
            detail:
              "Bilan en fin de programme : acquis consolidés, prochaines étapes autonomes, option de suivi ponctuel si nécessaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Tarif dirigeant TPE",
            detail:
              "Pour indépendants, artisans, gérants de petites manufactures limougeaudes souhaitant monter en compétence IA à leur rythme.",
          },
          {
            sizeLabel: "PME",
            price: "Tarif cadre PME",
            detail:
              "Pour managers et cadres de PME limougeaudes (ESTER, manufactures, services) souhaitant un accompagnement individuel approfondi.",
          },
          {
            sizeLabel: "ETI",
            price: "Tarif dirigeant ETI",
            detail:
              "Pour directeurs et membres de CODIR d'ETI industrielles ou de filiales CAC 40 à Limoges souhaitant cadrer leur trajectoire IA personnelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme executive",
            detail:
              "Pour dirigeants et executives de grands groupes (Legrand) souhaitant un programme de coaching IA confidentiel et sur mesure.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching individuel m'a permis de comprendre concrètement comment l'IA pouvait s'appliquer à notre manufacture. Les séances sont ancrées dans notre réalité, pas dans des cas théoriques. J'ai pu présenter un plan d'action crédible à mon conseil d'administration.",
            role: "Directeur général",
            companyProfile: "Manufacture porcelaine, Limoges",
          },
          {
            quote:
              "Format idéal pour un agenda de dirigeant : flexible, confidentiel, 100 % sur mes enjeux réels. En quelques séances, j'ai une vision claire de ce que l'IA peut apporter à ma filière et comment le piloter.",
            role: "Directeur de site",
            companyProfile: "ETI industrie, bassin de Limoges",
          },
        ],
        faq: [
          {
            q: "Combien de séances sont nécessaires pour un coaching IA à Limoges ?",
            a: "Il n'y a pas de minimum imposé. Certains dirigeants limougeauds font une ou deux séances intensives pour cadrer leur stratégie, d'autres préfèrent un programme de plusieurs séances sur quelques semaines. Le programme est défini lors du diagnostic initial.",
          },
          {
            q: "Le coaching est-il confidentiel ?",
            a: "Oui, entièrement. Confidentialité stricte dès le démarrage, aucun cas client nommé ni partagé avec des tiers. Format individuel par définition — personne d'autre dans la salle ou dans le call.",
          },
          {
            q: "Puis-je faire le coaching à distance depuis Limoges ?",
            a: "Oui. Les séances peuvent se dérouler en visioconférence selon vos préférences. La présentiel à Limoges est également possible — dans vos bureaux ou dans un espace neutre (ESTER Technopole, coworking).",
          },
          {
            q: "Le coaching est-il adapté si je ne connais pas l'IA ?",
            a: "Oui. Nous partons de votre niveau réel, qu'il soit nul ou avancé. Les séances progressent à votre rythme, sur vos cas métier limougeauds concrets — aucune connaissance technique prérequise.",
          },
          {
            q: "Peut-on combiner coaching individuel et intervention collective pour mon équipe ?",
            a: "Oui. Certains de nos clients limougeauds combinent une ou deux séances de coaching dirigeant pour cadrer la stratégie, puis une intervention collective pour déployer sur les équipes. Les deux formats sont compatibles et complémentaires.",
          },
          {
            q: "Vos séances de coaching sont-elles éligibles aux fonds de formation ?",
            a: "Les séances sont facturées en direct sur devis HT. Elles peuvent s'intégrer dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil et développement professionnel.",
          },
        ],
        guarantees:
          "Confidentialité totale garantie. Contenu 100 % sur mesure pour votre contexte limougeaud — aucun module générique recyclé. Si après la première séance vous estimez que le coaching ne correspond pas à vos attentes, remboursement intégral. Aucun engagement de durée minimale imposé.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Limoges supports executives, managers and experts one-on-one on their personal AI challenges. Confidential and bespoke format — tailored to manufacture managers, Legrand executives, ESTER R&D managers or French Tech Limoges entrepreneurs. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Limoges brings together atypical executive profiles — managers of heritage manufacturers, CAC 40 subsidiary directors, CNRS researchers, deeptech entrepreneurs — for whom individual bespoke coaching is more relevant than a group session.",
          "The 1-to-1 format allows addressing confidential challenges: manufacture AI strategy, digital transformation of a heritage industry (porcelain), competitive positioning in the electrical supply chain.",
          "Sessions can be held at your Limoges offices, a neutral space (ESTER Technopole, coworking) or remotely per your preference.",
          "Coaching calibrated to your AI maturity level: complete beginner or expert wanting to go further on a specific topic (RAG, AI agents, fine-tuning, governance).",
          "Content 100% grounded in your Limoges sector reality: no generic use cases, everything starts from your actual business context.",
          "No minimum engagement imposed: you choose the number of sessions based on your needs and executive schedule.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "A confidential preliminary exchange to identify your personal AI challenges, current maturity level and objectives — strategic, operational or technical.",
          },
          {
            step: "Bespoke programme",
            detail:
              "Building a session programme adapted to your profile: manufacture CEO, Legrand executive, ESTER entrepreneur, CNRS researcher. Pace and topics defined with you.",
          },
          {
            step: "Individual sessions",
            detail:
              "In-person sessions in Limoges or remote. Each session alternates targeted inputs, demos on your real cases and immediate hands-on practice on your tools.",
          },
          {
            step: "Personalised resources",
            detail:
              "Sheets, prompts, tools and resource library calibrated for your Limoges sector. Usable independently between sessions.",
          },
          {
            step: "Review and next steps",
            detail:
              "End-of-programme review: consolidated skills, autonomous next steps, option of occasional follow-up if needed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Micro-business executive rate",
            detail:
              "For Limoges freelancers, artisans and small manufacture managers wanting to build AI skills at their own pace.",
          },
          {
            sizeLabel: "SME",
            price: "SME manager rate",
            detail:
              "For Limoges SME managers and executives (ESTER, manufacturers, services) wanting in-depth individual coaching.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive rate",
            detail:
              "For directors and executive committee members of industrial mid-caps or CAC 40 subsidiaries in Limoges wanting to frame their personal AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Executive programme",
            detail:
              "For large group executives and leaders (Legrand) wanting a confidential, bespoke AI coaching programme.",
          },
        ],
        testimonials: [
          {
            quote:
              "Individual coaching helped me understand concretely how AI could apply to our manufacture. Sessions are grounded in our reality, not theoretical cases. I was able to present a credible action plan to my board.",
            role: "CEO",
            companyProfile: "Porcelain manufacturer, Limoges",
          },
          {
            quote:
              "Ideal format for an executive schedule: flexible, confidential, 100% on my real challenges. In a few sessions, I have a clear vision of what AI can bring to my industry and how to steer it.",
            role: "Site Director",
            companyProfile: "Industrial mid-cap, Limoges basin",
          },
        ],
        faq: [
          {
            q: "How many sessions are needed for AI coaching in Limoges?",
            a: "There is no imposed minimum. Some Limoges executives do one or two intensive sessions to frame their strategy, others prefer a programme of several sessions over a few weeks. The programme is defined at the initial diagnosis.",
          },
          {
            q: "Is the coaching confidential?",
            a: "Yes, entirely. Confidentiality ensured from kick-off, no named client case shared with third parties. Individual format by definition — nobody else in the room or on the call.",
          },
          {
            q: "Can I do coaching remotely from Limoges?",
            a: "Yes. Sessions can be held via videoconference per your preference. In-person in Limoges is also possible — at your offices or a neutral space (ESTER Technopole, coworking).",
          },
          {
            q: "Is coaching suited if I don't know anything about AI?",
            a: "Yes. We start from your actual level, whether zero or advanced. Sessions progress at your pace on your concrete Limoges business cases — no technical prerequisite required.",
          },
          {
            q: "Can I combine individual coaching and a group session for my team?",
            a: "Yes. Some of our Limoges clients combine one or two executive coaching sessions to frame strategy, then a group session to roll out to teams. Both formats are compatible and complementary.",
          },
          {
            q: "Are your coaching sessions eligible for training funds?",
            a: "Sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's professional development plan — your HR or finance team can process them as a consulting and professional development service.",
          },
        ],
        guarantees:
          "Full confidentiality guaranteed. Content 100% bespoke for your Limoges context — no recycled generic module. If after the first session you feel the coaching does not meet your expectations, full refund. No minimum engagement imposed.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Limoges des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Limoges, itérations à distance.",
        whyHere: [
          "Projets web & SaaS limougeauds : industrie électrique (siège mondial Legrand), porcelaine & arts de la table (Bernardaud, Haviland — IGP), ESTER Technopole, PME du Limousin.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Porcelaine & arts de la table : e-commerce premium multilingue, configurateur, storytelling de marque — un levier fort pour les maisons limougeaudes à l'export.",
        ],
        methodology: [
          {
            step: "Cadrage à Limoges",
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
            price: "Site / boutique sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une boutique avec UX/UI et IA intégrée, pour maisons de porcelaine, industriels et PME limougeaudes.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS / e-commerce IA-native",
            detail:
              "Plateforme e-commerce premium, métier ou portail client à l'export, IA intégrée, branchée sur votre SI (CRM, ERP, PIM, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Limoges — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous, particulièrement pour les arts de la table.",
          },
          {
            q: "Vous gérez l'e-commerce premium et l'export multilingue ?",
            a: "Oui : e-commerce premium multilingue, configurateur, recommandation, génération de fiches et traduction IA (Shopify, WooCommerce, PrestaShop). Un vrai levier pour la porcelaine de Limoges à l'international, conforme HCU et AI Act. Hébergement UE, RGPD strict.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région limougeaude ou repris en interne.",
      },
      en: {
        hero: "In Limoges, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Limoges kick-off, remote iterations.",
        whyHere: [
          "Limoges web & SaaS projects: electrical industry (Legrand world HQ), porcelain & tableware (Bernardaud, Haviland — PGI), ESTER Technopole, Limousin SMEs.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Porcelain & tableware: premium multilingual e-commerce, configurator, brand storytelling — a strong lever for Limoges houses at export.",
        ],
        methodology: [
          {
            step: "Scoping in Limoges",
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
            price: "Bespoke site / shop",
            detail:
              "Design or rebuild of a site or shop with UX/UI and built-in AI, for porcelain houses, manufacturers and Limoges SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS / e-commerce platform",
            detail:
              "Premium e-commerce, business or export customer portal platform, AI built in, wired into your IS (CRM, ERP, PIM, datalake).",
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
            a: "Yes. We design the full experience in Limoges — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us, especially for tableware.",
          },
          {
            q: "Do you handle premium e-commerce and multilingual export?",
            a: "Yes: premium multilingual e-commerce, configurator, recommendation, sheet generation and AI translation (Shopify, WooCommerce, PrestaShop). A real lever for Limoges porcelain internationally, HCU and AI Act compliant. EU hosting, strict GDPR.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Limoges-area provider or taken in-house.",
      },
    },
  },
};
