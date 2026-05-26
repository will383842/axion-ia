// Metz (57463) â€” contenu Ã©ditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique paris.ts / lyon.ts) :
//   - Aucun Â« basÃ© en UE Â».
//   - Aucun dÃ©lai concret chiffrÃ© (Â« 5 jours Â», Â« 7 jours Â», etc.).
//   - Aucun Â« frais de dÃ©placement intÃ©grÃ©s Â» â€” les frais sont en sus,
//     calculÃ©s au cas par cas selon la zone.
//   - DurÃ©e minimale = 1 journÃ©e. Mention systÃ©matique
//     Â« frais de logement, repas et forfait trajet en sus Â» sur interventions.
//   - Aucun prix hardcodÃ© : tarifs viennent de `src/content/pricing.ts`.
//   - Tailles entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Mot Â« formation Â» autorisÃ© en copy descriptif, naming = Â« intervention Â».
//
// Sources Ã©conomiques : economic-data/metz.ts (Sprint City Quality V3, ville #29).
// RÃ©alitÃ©s locales : capitale Moselle, transfrontalier Luxembourg (~60 km),
// Centre Pompidou-Metz (Shigeru Ban 2010), Georgia Tech Lorraine (campus
// amÃ©ricain unique en France), TechnopÃ´le Metz 2000, LORIA/Inria,
// Stellantis TrÃ©mery, ArcelorMittal Florange, Materalia, Banque Populaire
// Lorraine Champagne, CCI Moselle MÃ©tropole Metz, French Tech East.

import type { VilleCopy } from "./types";

export const METZ_COPY: VilleCopy = {
  pitchFr:
    "Metz regroupe un tissu B2B dense en Moselle, capitale rÃ©gionale Grand Est, adossÃ©e au bassin transfrontalier Luxembourg (~60 km, ~110 000 frontaliers lorrains), Ã  l'Ã©cosystÃ¨me acadÃ©mique Georgia Tech Lorraine + CentraleSupÃ©lec + LORIA/Inria et Ã  l'industrie automobile (Stellantis TrÃ©mery). Axion-IA y intervient sur site, des TPE messines aux ETI industrielles et aux directions IA des siÃ¨ges bancaires.",
  pitchEn:
    "Metz anchors a dense B2B fabric in Moselle, the Grand Est regional capital, backed by the Luxembourg cross-border basin (~60 km, ~110,000 Lorraine commuters), the Georgia Tech Lorraine + CentraleSupÃ©lec + LORIA/Inria academic ecosystem and the automotive industry (Stellantis TrÃ©mery). Axion-IA delivers on site, from Metz micro-businesses to industrial mid-caps and AI leadership at banking HQs.",

  servicesContext: {
    audit: {
      fr: "Audit IA opÃ©rationnel Ã  Metz : nous cartographions ce qui peut Ãªtre automatisÃ© dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au StratÃ©gique ETI, des TPE messines aux ETI industrielles automobile et sidÃ©rurgiques de l'EuromÃ©tropole.",
      en: "Operational AI audit in Metz: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Metz micro-businesses to automotive and steel industrial mid-caps in the EuromÃ©tropole.",
    },
    interventions: {
      fr: "Interventions IA Ã  Metz : formats sur site d'une Ã  plusieurs journÃ©es selon vos Ã©quipes. Vos collaborateurs repartent autonomes sur des outils IA installÃ©s sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Metz: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "ImplÃ©mentation IA Ã  Metz : on dÃ©ploie l'IA dans vos outils existants (CRM, ERP, systÃ¨mes industriels, mails) avec ROI chiffrÃ© contractuel. Vos Ã©quipes gardent la main, pas de dÃ©pendance Axion-IA.",
      en: "AI implementation in Metz: we deploy AI into your existing tools (CRM, ERP, industrial systems, email) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA Ã  Metz : coaching 1-to-1 pour dirigeants et managers de l'EuromÃ©tropole souhaitant intÃ©grer l'IA dans leur pratique quotidienne et piloter la transformation de leur organisation.",
      en: "Individual AI coaching in Metz: 1-to-1 coaching for EuromÃ©tropole executives and managers looking to integrate AI into their daily practice and lead their organisation's transformation.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI messines â€” site vitrine premium pour industrie automobile, banque et numÃ©rique, espace client transfrontalier FR/DE/LU, dashboard mÃ©tier connectÃ© Ã  votre CRM/ERP et systÃ¨mes industriels. Architectes seniors, design system Axion-IA, hÃ©bergement europÃ©en.",
      en: "Custom web platforms and SaaS AI for Metz SMEs and mid-caps â€” premium showcase site for automotive industry, banking and digital, cross-border FR/DE/LU customer space, business dashboard connected to your CRM/ERP and industrial systems. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient Ã  Metz (57) sur site â€” TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, ActipÃ´le Metz Nord, Montigny-lÃ¨s-Metz, Woippy et communes de l'EuromÃ©tropole. Nous accompagnons les TPE, PME, ETI et grandes entreprises messines (industrie automobile, banque, numÃ©rique, services) sur leurs cas IA opÃ©rationnels : diagnostic chiffrÃ©, dÃ©mos sur vos vraies donnÃ©es, plan d'action concret. Aucun lock-in technologique, vos Ã©quipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Metz (57) on site â€” TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, ActipÃ´le Metz Nord, Montigny-lÃ¨s-Metz, Woippy and EuromÃ©tropole communes. We support Metz micro-businesses, SMEs, mid-caps and large enterprises (automotive industry, banking, digital, services) on their operational AI use cases â€” costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Commerce, transports & services aux entreprises",
    "ActivitÃ©s spÃ©cialisÃ©es, scientifiques & techniques",
    "Administration publique & enseignement (prÃ©fecture Moselle)",
    "Industrie automobile & manufacturiÃ¨re (Stellantis TrÃ©mery, Materalia)",
    "Banque & Finance (BPCE, Caisse d'Ã‰pargne Grand Est)",
    "Information, communication & logiciels",
  ],

  distancesFr:
    "Gare de Metz-Ville (TGV Est, Paris ~1h22, liaisons Luxembourg et Sarrebruck) en centre-ville. AÃ©roport Metz-Nancy-Lorraine (ETZ) Ã  25 km, aÃ©roport Luxembourg (LUX) Ã  ~70 km. RÃ©seau Le Met' (2 lignes de bus express + tramway en projet) pour desservir le TechnopÃ´le, le Quartier de l'AmphithÃ©Ã¢tre et les communes de l'EuromÃ©tropole.",
  distancesEn:
    "Metz-Ville TGV station (Paris ~1h22, Luxembourg and SaarbrÃ¼cken connections) in the city centre. Metz-Nancy-Lorraine Airport (ETZ) 25 km away, Luxembourg Airport (LUX) ~70 km. Le Met' network (2 express bus lines + tram project) to reach the TechnopÃ´le, Quartier de l'AmphithÃ©Ã¢tre and EuromÃ©tropole communes.",

  ecosystemFr:
    "Tissu B2B EuromÃ©tropole â€” bassin transfrontalier Luxembourg (~110 000 frontaliers lorrains), TechnopÃ´le Metz 2000 (Georgia Tech Lorraine, CentraleSupÃ©lec, LORIA/Inria), Quartier de l'AmphithÃ©Ã¢tre (tertiaire, Centre Pompidou-Metz), industrie automobile (Stellantis TrÃ©mery, pÃ´le Materalia), sidÃ©rurgie (ArcelorMittal Florange), banque (BPCE, Caisse d'Ã‰pargne Grand Est), CCI Moselle MÃ©tropole et French Tech East.",
  ecosystemEn:
    "EuromÃ©tropole B2B fabric â€” Luxembourg cross-border basin (~110,000 Lorraine commuters), TechnopÃ´le Metz 2000 (Georgia Tech Lorraine, CentraleSupÃ©lec, LORIA/Inria), Quartier de l'AmphithÃ©Ã¢tre (tertiary, Centre Pompidou-Metz), automotive industry (Stellantis TrÃ©mery, Materalia cluster), steel (ArcelorMittal Florange), banking (BPCE, Caisse d'Ã‰pargne Grand Est), CCI Moselle MÃ©tropole and French Tech East.",

  // === SERVICES LONG-FORM METZ ===
  // MÃªme structure que lyon.ts â€” Aucun prix en dur, aucun dÃ©lai chiffrÃ©.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut Ãªtre automatisÃ© dans votre entreprise messine et chiffre le retour sur investissement Ã  12-24 mois. Quatre niveaux du Flash au StratÃ©gique ETI couvrent toutes les tailles, des TPE du centre de Metz aux ETI industrielles de TrÃ©mery et aux directions IA des siÃ¨ges bancaires de l'EuromÃ©tropole.",
        whyHere: [
          "Metz est un pÃ´le d'intervention clÃ© pour Axion-IA en Grand Est : le tissu B2B EuromÃ©tropole gÃ©nÃ¨re une demande croissante d'audits IA opÃ©rationnels.",
          "Tissu sectoriel sur-reprÃ©sentÃ© chez nos clients messins : industrie automobile et matÃ©riaux (Stellantis TrÃ©mery, Materalia), banque/finance (BPCE, Caisse d'Ã‰pargne Grand Est), IT/numÃ©rique (TechnopÃ´le, BLIIIDA), services publics (prÃ©fecture Moselle, UniversitÃ© de Lorraine).",
          "Nos consultants se dÃ©placent sur l'ensemble de l'EuromÃ©tropole : Metz centre, TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, Montigny-lÃ¨s-Metz, Woippy, Marly, Longeville-lÃ¨s-Metz.",
          "Restitutions toujours en prÃ©sentiel : ateliers d'idÃ©ation dans vos locaux messins, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichÃ©s, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrÃ´le : votre plan d'action est exÃ©cutable avec n'importe quel prestataire â€” aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "PrÃ©paration",
            detail:
              "Un brief de cadrage Ã  distance pour accÃ©der en toute confidentialitÃ© aux documents clÃ©s. Utile pour les ETI industrielles de l'EuromÃ©tropole avec des workflows complexes â€” automobile, sidÃ©rurgie, logistique.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "PremiÃ¨re venue Ã  Metz dans vos locaux â€” TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre ou commune de l'EuromÃ©tropole â€” pour observer les outils et identifier les workflows candidats Ã  l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts (commerciaux, finance, R&D, production, support, direction) pour cartographier les frictions, en tenant compte des spÃ©cificitÃ©s messines (automobile, banque, transfrontalier).",
          },
          {
            step: "DÃ©mos sur vos vraies donnÃ©es",
            detail:
              "Sur place : dÃ©mos de Claude, Mistral, GPT-4 appliquÃ©es Ã  vos PDFs, emails, rapports analytiques, donnÃ©es de production. Pas de slides â€” on part de vos documents rÃ©els.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier dans vos locaux messins. Livrable PDF chiffrÃ© ROI/complexitÃ© remis en main propre, roadmap 6-18 mois adaptÃ©e Ã  votre secteur et au contexte transfrontalier si pertinent.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "AdaptÃ© aux indÃ©pendants et cabinets messins jusqu'Ã  une dizaine de collaborateurs â€” centre-ville, ÃŽle du Saulcy, Pontiffroy.",
          },
          {
            sizeLabel: "PME",
            price: "Audit CiblÃ© ou StratÃ©gique PME",
            detail:
              "Pour PME numÃ©riques du TechnopÃ´le, cabinets du Quartier de l'AmphithÃ©Ã¢tre et entreprises de quelques dizaines Ã  250 collaborateurs de l'EuromÃ©tropole.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit StratÃ©gique ETI",
            detail:
              "Pour ETI industrielles (automobile TrÃ©mery, Materalia), ETI bancaires (BPCE, Caisse d'Ã‰pargne) ou ETI tertiaires souhaitant cadrer une trajectoire IA pluriannuelle avec dimension transfrontaliÃ¨re.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit StratÃ©gique ETI Ã©tendu",
            detail:
              "Pour grandes entreprises implantÃ©es dans l'EuromÃ©tropole â€” Stellantis TrÃ©mery, ArcelorMittal Florange, Amazon Augny, grands siÃ¨ges bancaires rÃ©gionaux.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livrÃ© un audit opÃ©rationnel rigoureux, chiffrÃ© et actionnable, tenant compte des contraintes de notre environnement industriel. On a pu prÃ©senter le plan au comitÃ© de direction dÃ¨s les semaines suivantes.",
            role: "Directeur gÃ©nÃ©ral",
            companyProfile: "ETI industrie automobile, EuromÃ©tropole de Metz",
          },
          {
            quote:
              "MÃ©thode pragmatique, dÃ©mos sur nos donnÃ©es internes. Le livrable a permis de prioriser nos chantiers IA avec un ROI chiffrÃ© pour chaque cas d'usage identifiÃ©.",
            role: "Directrice de la transformation",
            companyProfile: "PME services financiers, Metz TechnopÃ´le",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA Ã  Metz ?",
            a: "La durÃ©e varie selon le niveau retenu : un Audit Flash se dÃ©roule sur une journÃ©e, un Audit StratÃ©gique ETI s'Ã©tale sur plusieurs semaines. Nous calons le rythme dÃ¨s le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI industrielle de l'EuromÃ©tropole ?",
            a: "Sur les audits StratÃ©gique ETI, le ROI identifiÃ© Ã  12 mois reprÃ©sente typiquement plusieurs Ã©quivalents temps plein gagnÃ©s sur les workflows automatisables (rapports qualitÃ©, suivi production, qualification appels d'offres, lecture factures). Le livrable dÃ©taille les chiffres prÃ©cis pour votre cas.",
          },
          {
            q: "Mes donnÃ©es industrielles ou bancaires restent-elles confidentielles ?",
            a: "Oui. ConfidentialitÃ© stricte dÃ¨s le dÃ©marrage, donnÃ©es traitÃ©es exclusivement sur vos infrastructures. Pour les secteurs automobile, bancaire et les entreprises en environnement transfrontalier Metz-Luxembourg, nous appliquons les contraintes souverainetÃ© et conformitÃ© dÃ¨s la sÃ©lection des modÃ¨les IA.",
          },
          {
            q: "Comment se dÃ©roule la restitution finale Ã  Metz ?",
            a: "Toujours en prÃ©sentiel dans vos locaux messins. Atelier de plusieurs heures avec votre comitÃ© de direction. Vous repartez avec le livrable PDF en main propre et une roadmap prÃªte Ã  prÃ©senter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes de l'EuromÃ©tropole ?",
            a: "Oui. L'EuromÃ©tropole de Metz est notre terrain d'intervention complet â€” de Montigny-lÃ¨s-Metz Ã  Woippy, de Marly Ã  Longeville-lÃ¨s-Metz, jusqu'aux zones industrielles de TrÃ©mery et l'ActipÃ´le Nord.",
          },
          {
            q: "Faut-il Ãªtre dÃ©jÃ  avancÃ© sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits messins sont commandÃ©s par des dirigeants qui n'ont jamais lancÃ© de chantier IA. L'audit est prÃ©cisÃ©ment conÃ§u pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les dÃ©lais convenus Ã  la signature. ConformitÃ© RGPD, hÃ©bergement donnÃ©es en UE par dÃ©faut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exÃ©cutable avec n'importe quel prestataire ou en interne. Si aprÃ¨s la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursÃ© intÃ©gralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Metz business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Metz micro-businesses to large automotive and banking mid-caps across the EuromÃ©tropole.",
        whyHere: [
          "Metz is a key Axion-IA engagement hub in Grand Est: the EuromÃ©tropole B2B ecosystem generates growing operational AI audit demand.",
          "Metz B2B fabric over-represented in our cases: automotive and materials industry (Stellantis TrÃ©mery, Materalia), banking/finance (BPCE, Caisse d'Ã‰pargne Grand Est), IT/digital (TechnopÃ´le startups, BLIIIDA), public services and higher education.",
          "Our consultants travel across the full EuromÃ©tropole: Metz city centre, TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, Montigny-lÃ¨s-Metz, Woippy, Marly, Longeville-lÃ¨s-Metz.",
          "Read-outs always in person: ideation workshops at your Metz offices, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house â€” no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents. Particularly relevant for EuromÃ©tropole industrial mid-caps with complex workflows â€” automotive, steel, logistics.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Metz at your offices â€” TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre or a EuromÃ©tropole commune â€” to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews to map frictions and expectations, accounting for Metz sector specifics (automotive constraints, banking compliance, cross-border environment).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production data. No theoretical slides â€” we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Metz offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector and cross-border context where relevant.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Metz freelancers and practices up to about ten staff â€” city centre, ÃŽle du Saulcy, Pontiffroy.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs on the TechnopÃ´le, tertiary firms in the Quartier de l'AmphithÃ©Ã¢tre and businesses from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (automotive TrÃ©mery, Materalia), banking mid-caps (BPCE, Caisse d'Ã‰pargne) or tertiary mid-caps framing a multi-year AI trajectory with a cross-border dimension.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises with major EuromÃ©tropole sites â€” Stellantis TrÃ©mery, ArcelorMittal Florange, Amazon Augny, large regional banking HQs.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a rigorous, costed and actionable audit accounting for our industrial environment constraints. We presented the plan to the executive committee within the following weeks.",
            role: "CEO",
            companyProfile: "Automotive industry mid-cap, EuromÃ©tropole de Metz",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than slides. The deliverable helped prioritize our AI initiatives with a costed ROI for each identified use case.",
            role: "Head of Transformation",
            companyProfile: "Financial services SME, Metz TechnopÃ´le",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Metz?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an EuromÃ©tropole industrial mid-cap?",
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
            q: "Do you cover EuromÃ©tropole communes outside Metz proper?",
            a: "Yes. The EuromÃ©tropole de Metz is our full territory â€” from Montigny-lÃ¨s-Metz to Woippy, Marly to Longeville-lÃ¨s-Metz, and the industrial zones of TrÃ©mery and ActipÃ´le Nord.",
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
        hero: "Les interventions IA Axion-IA Ã  Metz se dÃ©clinent en formats sur site d'une Ã  plusieurs journÃ©es selon vos Ã©quipes. Vos collaborateurs repartent avec des outils IA installÃ©s sur leur poste, configurÃ©s pour leur travail rÃ©el â€” en usine, au bureau, en clientÃ¨le ou dans le contexte transfrontalier Metz-Luxembourg. Frais de logement, repas et forfait trajet facturÃ©s Ã  part.",
        whyHere: [
          "Metz est l'un de nos principaux terrains d'intervention en Grand Est : entreprises industrielles, services bancaires, PME numÃ©riques du TechnopÃ´le et structures publiques reprÃ©sentent une part significative de nos sessions messines.",
          "Toutes les zones de l'EuromÃ©tropole couvertes en prÃ©sentiel : Metz centre, TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, ActipÃ´le Metz Nord, Montigny-lÃ¨s-Metz, Woippy, Marly, Longeville-lÃ¨s-Metz.",
          "Le format Essentielle est calibrÃ© pour les structures messines de quelques personnes Ã  une centaine de collaborateurs, en particulier les PME numÃ©riques du TechnopÃ´le et les cabinets du quartier ImpÃ©rial.",
          "Le format ConfÃ©rence convient aux plÃ©niÃ¨res d'entreprise messines (salles Metz Expo, espaces Centre Pompidou-Metz, auditoriums du TechnopÃ´le).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comitÃ©s de direction des ETI industrielles et bancaires, avec prise en compte des enjeux transfrontaliers Luxembourg si pertinent.",
          "Vocabulaire ajustÃ© Ã  votre secteur dominant : industrie automobile, finance, numÃ©rique, collectivitÃ©s, commerce transfrontalier. Pas de session gÃ©nÃ©rique recyclÃ©e.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un Ã©change Ã  distance pour cibler le profil des participants, votre secteur â€” notamment les contraintes industrie automobile ou bancaire â€” et les cas d'usage prioritaires.",
          },
          {
            step: "PrÃ©paration des dÃ©mos",
            detail:
              "Nous rÃ©cupÃ©rons quelques documents anonymisÃ©s reprÃ©sentatifs (rapports qualitÃ©, emails, devis, donnÃ©es de production) pour calibrer les dÃ©mos sur VOS donnÃ©es messines.",
          },
          {
            step: "ArrivÃ©e et installation",
            detail:
              "Nos consultants arrivent en avance pour vÃ©rifier matÃ©riel, projection et accÃ¨s rÃ©seau. Pas d'alÃ©a technique le jour J, mÃªme dans les environnements industriels avec postes dÃ©connectÃ©s.",
          },
          {
            step: "Session pÃ©dagogique",
            detail:
              "Alternance de thÃ©orie courte et de dÃ©mos longues sur VOS donnÃ©es, suivies d'ateliers participatifs. Les cas d'usage sont ancrÃ©s dans votre rÃ©alitÃ© sectorielle messine.",
          },
          {
            step: "Outils installÃ©s et debrief",
            detail:
              "Chaque participant repart avec les outils IA installÃ©s et configurÃ©s pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extÃ©rieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "IdÃ©al pour indÃ©pendants, cabinets et petites agences messines jusqu'Ã  une dizaine de collaborateurs â€” centre-ville, quartier ImpÃ©rial, ÃŽle du Saulcy.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Ã‰quipes",
            detail:
              "Essentielle pour le groupe entier ou Ã‰quipes pour focaliser sur un dÃ©partement â€” efficace pour les PME numÃ©riques du TechnopÃ´le Metz 2000.",
          },
          {
            sizeLabel: "ETI",
            price: "Format ConfÃ©rence ou Dirigeants",
            detail:
              "PlÃ©niÃ¨re pour grandes audiences (ETI industrielles, groupes bancaires) ou huis-clos comitÃ© de direction selon votre objectif stratÃ©gique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisÃ© multi-formats",
            detail:
              "Combinaisons sur-mesure â€” roadshow multi-sites EuromÃ©tropole, sÃ©minaires CODIR + cascade Ã©quipes terrain ou ateliers industriels.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a collÃ© aux attentes de nos Ã©quipes opÃ©rationnelles. Repartis avec leurs outils configurÃ©s sur leurs vrais cas d'usage. DÃ¨s le lendemain, plusieurs les utilisaient pour rÃ©diger des comptes-rendus.",
            role: "Directeur des opÃ©rations",
            companyProfile: "PME services, TechnopÃ´le Metz 2000",
          },
          {
            quote:
              "La confÃ©rence dirigeants nous a alignÃ©s en une journÃ©e sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles et la rÃ©alitÃ© transfrontaliÃ¨re de notre activitÃ©.",
            role: "DG",
            companyProfile: "ETI banque & finance, EuromÃ©tropole de Metz",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA Ã  Metz ?",
            a: "Cela dÃ©pend du format. L'Essentielle se dÃ©roule sur une journÃ©e, l'Approfondie sur deux journÃ©es consÃ©cutives. La ConfÃ©rence et le format Dirigeants tiennent sur une journÃ©e. Pour un programme multi-formats, le rythme est dÃ©fini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels de l'EuromÃ©tropole ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels messins â€” postes dÃ©connectÃ©s, VLAN sÃ©curisÃ©s, protocoles accÃ¨s site. La prÃ©paration inclut un audit rÃ©seau/sÃ©curitÃ© prÃ©alable pour les sites de TrÃ©mery ou de l'ActipÃ´le Nord.",
          },
          {
            q: "Les outils installÃ©s restent-ils utilisables aprÃ¨s la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou abonnement employÃ©) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux spÃ©cificitÃ©s transfrontaliÃ¨res Metz-Luxembourg ?",
            a: "Oui. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et dÃ©mos aux rÃ©alitÃ©s des entreprises opÃ©rant en contexte franco-luxembourgeois â€” conformitÃ© multi-pays, Ã©quipes bilingues, processus cross-border.",
          },
          {
            q: "Vos interventions sont-elles Ã©ligibles aux fonds de formation ?",
            a: "Nos interventions sont facturÃ©es en direct sur devis HT et s'intÃ¨grent dans votre plan de dÃ©veloppement des compÃ©tences â€” votre service RH ou comptable peut les traiter comme une prestation de conseil et formation professionnelle.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipÃ©e, plus elle est neutre. TrÃ¨s anticipÃ©e : remboursement intÃ©gral. Quelques jours avant : participation partielle aux frais consultant dÃ©jÃ  bloquÃ©. TrÃ¨s tardive : session reportable une fois sans frais.",
          },
        ],
        guarantees:
          "CrÃ©neau garanti dÃ¨s la confirmation de rÃ©servation. En cas de problÃ¨me technique de notre fait, session reportÃ©e et compensation. Outils opÃ©rationnels le soir mÃªme : si vos collaborateurs ne sont pas autonomes le lendemain, sÃ©ance de remÃ©diation offerte. Vocabulaire et dÃ©mos ajustÃ©s Ã  votre secteur messin â€” industrie, finance, numÃ©rique, collectivitÃ©s.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Metz come in on-site formats from one to several days depending on your teams. Your staff leave with AI tools installed on their workstations, configured for their real work â€” on the factory floor, at the office, with clients or in the cross-border Metz-Luxembourg context. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Metz is one of our top engagement grounds in Grand Est: industrial firms, banking services, TechnopÃ´le digital SMEs and public administration represent a significant share of our Metz sessions.",
          "All EuromÃ©tropole zones covered in person: Metz city centre, TechnopÃ´le Metz 2000, Quartier de l'AmphithÃ©Ã¢tre, ActipÃ´le Metz Nord, Montigny-lÃ¨s-Metz, Woippy, Marly, Longeville-lÃ¨s-Metz.",
          "The Essential format is calibrated for Metz structures from a few people to about a hundred staff, particularly digital SMEs on the TechnopÃ´le and consulting firms in the Quartier ImpÃ©rial.",
          "The Talk format suits Metz corporate plenaries (Metz Expo rooms, Centre Pompidou-Metz spaces, TechnopÃ´le auditoriums).",
          "The Executives format enables in-camera framing for industrial and banking mid-cap executive committees, including cross-border Luxembourg considerations where relevant.",
          "Vocabulary adjusted to your dominant sector: automotive industry, finance, digital, public administration, cross-border trade. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange to target participant profile, your sector â€” including automotive or banking regulatory constraints â€” and priority use cases.",
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
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Metz freelancers, practices and small agencies up to about ten staff â€” city centre, Quartier ImpÃ©rial, ÃŽle du Saulcy.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department â€” particularly effective for digital SMEs at TechnopÃ´le Metz 2000.",
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
              "Custom combinations for Metz HQs â€” multi-site EuromÃ©tropole roadshows, exec committee seminars + field team cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format matched our operational teams' expectations. They left with tools configured for their real use cases. By the next day, several were already using them to write reports.",
            role: "Operations Director",
            companyProfile: "Services SME, TechnopÃ´le Metz 2000",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our sector constraints and the cross-border reality of our business.",
            role: "CEO",
            companyProfile: "Banking and finance mid-cap, EuromÃ©tropole de Metz",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Metz take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in EuromÃ©tropole industrial environments?",
            a: "Yes. Our consultants adapt to Metz industrial environment constraints â€” air-gapped workstations, secure VLANs, site access protocols. Preparation includes an upfront network/security review for TrÃ©mery or ActipÃ´le Nord sites.",
          },
          {
            q: "Do the tools installed remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in.",
          },
          {
            q: "Can you adapt content to Metz-Luxembourg cross-border specifics?",
            a: "Yes. The upstream framing brief lets us adjust vocabulary, examples and demos to companies operating in a Franco-Luxembourgish context â€” multi-country compliance, bilingual teams, cross-border processes.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT) and can be included in your company's training plan â€” your HR or finance team can process them as a consulting and professional training service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot blocked. Very late: session rebookable once free of charge.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning, free remediation session offered. Vocabulary and demos adjusted to your Metz sector â€” industry, finance, digital, public administration.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implÃ©mentation IA Axion-IA Ã  Metz met vos cas IA en production avec un retour sur investissement chiffrÃ© contractuellement, formation de vos Ã©quipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux messins â€” TechnopÃ´le, Quartier de l'AmphithÃ©Ã¢tre ou commune de l'EuromÃ©tropole.",
        whyHere: [
          "Metz concentre une part croissante de nos missions d'implÃ©mentation en Grand Est : industrie automobile (TrÃ©mery, ActipÃ´le), services financiers (BPCE, Caisse d'Ã‰pargne), numÃ©rique (TechnopÃ´le, BLIIIDA) et services publics (prÃ©fecture, collectivitÃ©s).",
          "Le kick-off se passe systÃ©matiquement en prÃ©sentiel : alignement des Ã©quipes, accÃ¨s aux donnÃ©es de production ou clients, validation des intÃ©grations CRM/ERP/systÃ¨mes industriels.",
          "ItÃ©rations Ã  distance ensuite avec un point quotidien court en visio et une visite mensuelle pour dÃ©mos d'avancement avec votre comitÃ© de direction.",
          "Recette finale toujours en prÃ©sentiel Ã  Metz : passation de pouvoir, formation des Ã©quipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiÃ©s clÃ©s : ils deviennent les ambassadeurs IA internes, autonomes aprÃ¨s la fin de mission.",
          "Cas typiques messins : ETI industrielles (automatisation rapports qualitÃ© automobile), PME bancaires (qualification prospects, gÃ©nÃ©ration documents conformitÃ©), Ã©diteurs logiciels TechnopÃ´le (agents support), collectivitÃ©s (traitement demandes usagers, reporting).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Metz : revue de l'architecture cible (CRM, ERP, systÃ¨mes industriels MES/SCADA), validation des contraintes RGPD/sÃ©curitÃ© et rÃ©glementaires, sÃ©lection finale des modÃ¨les IA, signature du SOW chiffrÃ©.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Metz : installation des accÃ¨s, dÃ©ploiement de l'environnement de dÃ©veloppement, premiÃ¨re intÃ©gration end-to-end fonctionnelle (POC), validation avec vos Ã©quipes technique et mÃ©tier.",
          },
          {
            step: "ItÃ©rations",
            detail:
              "Travail Ã  distance avec un point quotidien court : enrichissement des cas d'usage, intÃ©gration aux outils existants, tests sur volumes rÃ©els, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Metz : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "Ã€ distance : surveillance des mÃ©triques de production, ajustements fins, mesure du ROI rÃ©el par rapport Ã  la prÃ©diction du SOW. Rapport final remis Ã  clÃ´ture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "ImplÃ©mentation d'un cas d'usage simple â€” automatisation devis, comptes-rendus rÃ©union, qualification leads pour TPE et indÃ©pendants messins.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "DÃ©ploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intÃ©gration CRM/ERP. Pour PME numÃ©riques TechnopÃ´le et entreprises de quelques dizaines Ã  250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "DÃ©ploiement transverse, gouvernance IA, intÃ©grations avancÃ©es (ERP industriel, MES automobile, datalake). AdaptÃ© aux ETI industrielles et bancaires de l'EuromÃ©tropole.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-dÃ©ploiement",
            detail:
              "Programmes annuels pour grands comptes EuromÃ©tropole : cas d'usage cascadÃ©s multi-sites, gouvernance IA centralisÃ©e, Ã©quipe dÃ©diÃ©e Axion-IA en mode rÃ©gie.",
          },
        ],
        testimonials: [
          {
            quote:
              "ImplÃ©mentation automatisation documentation qualitÃ© livrÃ©e dans les dÃ©lais. ROI mesurÃ© dÃ¨s les premiers mois : nos Ã©quipes passent moins de temps sur les rapports et plus sur l'amÃ©lioration process. Aucun lock-in, on maÃ®trise notre dÃ©ploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI automobile, EuromÃ©tropole de Metz",
          },
          {
            quote:
              "MÃ©thode hybride parfaite pour notre Ã©quipe dispersÃ©e entre le TechnopÃ´le et nos sites de production. Kick-off intense sur site, puis itÃ©rations fluides Ã  distance. Nos ambassadeurs internes sont autonomes.",
            role: "CTO",
            companyProfile: "PME logiciels industriels, TechnopÃ´le Metz 2000",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implÃ©mentation Axion-IA Ã  Metz ?",
            a: "Cela dÃ©pend de l'ampleur. Un POC pour TPE en quelques semaines, une mission PME sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-dÃ©ploiement sur une annÃ©e. Le SOW signÃ© en cadrage fixe le calendrier prÃ©cis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passÃ© ?",
            a: "Forfait fixe pour la grande majoritÃ© de nos missions messines. SOW signÃ© au dÃ©but avec scope prÃ©cis et livrables dÃ©finis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dÃ©rive horaire cachÃ©e.",
          },
          {
            q: "Qui maintient la solution aprÃ¨s la mission ?",
            a: "Vos ambassadeurs internes, formÃ©s pendant la mission. Documentation runbook complÃ¨te remise. Si maintenance externalisÃ©e souhaitÃ©e, contrat de support optionnel. Aucun lock-in.",
          },
          {
            q: "Mes donnÃ©es industrielles ou bancaires restent-elles chez moi ?",
            a: "Toujours chez vous. ModÃ¨les IA dÃ©ployÃ©s sur votre infra (cloud privÃ©, on-premise, serveur dÃ©diÃ©). Pour les secteurs rÃ©glementÃ©s messins (automobile, banque, secteur public), nous appliquons les contraintes souverainetÃ© et conformitÃ© dÃ¨s la conception.",
          },
          {
            q: "Quels modÃ¨les IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souverainetÃ© ou le coÃ»t ; propriÃ©taires (GPT, Claude, Gemini) pour la qualitÃ© ; parfois fine-tuning sur vos donnÃ©es si le volume le justifie. Choix justifiÃ© dans le SOW, jamais imposÃ©.",
          },
          {
            q: "L'IA est-elle compatible avec les systÃ¨mes industriels messins (MES, SCADA, ERP automobile) ?",
            a: "Oui. Le cadrage technique initial couvre l'inventaire prÃ©cis de vos systÃ¨mes existants. Nos intÃ©grations couvrent les principaux ERP/MES du secteur automobile (SAP, Oracle, Siemens, autres). Si un connecteur est absent, il est dÃ©veloppÃ© dans le SOW.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dÃ©rive horaire cachÃ©e. Livraison dans les dÃ©lais convenus Ã  la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffrÃ© contractuel : si aprÃ¨s une annÃ©e de production le ROI rÃ©el reste trÃ¨s en deÃ§Ã  de la prÃ©diction, audit gratuit + ajustement dÃ©ploiement offert. Aucun lock-in technologique : vos modÃ¨les, vos donnÃ©es, votre runbook.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Metz brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Metz offices â€” TechnopÃ´le, Quartier de l'AmphithÃ©Ã¢tre or a EuromÃ©tropole commune.",
        whyHere: [
          "Metz hosts a growing share of our Grand Est implementation missions: automotive industry (TrÃ©mery, ActipÃ´le), financial services (BPCE, Caisse d'Ã‰pargne), digital (TechnopÃ´le, BLIIIDA) and public services (prefecture, local authorities).",
          "Kick-off always happens in person: team alignment, access to production or customer data, CRM/ERP/industrial systems integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Metz: handover, team training, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Metz cases: industrial mid-caps (automotive quality report automation), banking SMEs (prospect qualification, compliance document generation), TechnopÃ´le software publishers (support agents), local authorities (citizen request processing, reporting).",
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
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case â€” quote automation, meeting minutes, lead qualification for Metz micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For TechnopÃ´le digital SMEs and companies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, automotive MES, datalake). Tailored for EuromÃ©tropole industrial and banking mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for EuromÃ©tropole large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quality documentation automation implementation delivered on time. ROI measured within the first months: our teams spend less time on reports and more on process improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Automotive mid-cap, EuromÃ©tropole de Metz",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the TechnopÃ´le and our production sites. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Industrial software SME, TechnopÃ´le Metz 2000",
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
        hero: "L'accompagnement individuel Axion-IA Ã  Metz est un coaching IA 1-to-1 sur mesure pour dirigeants, managers et experts de l'EuromÃ©tropole. Format hybride â€” session inaugurale en prÃ©sentiel dans vos locaux messins ou dans un espace de travail du TechnopÃ´le, puis suivi Ã  distance structurÃ©. Vous progressez Ã  votre rythme sur vos vrais dÃ©fis professionnels.",
        whyHere: [
          "Les dirigeants de l'EuromÃ©tropole de Metz font face Ã  des enjeux IA spÃ©cifiques : contexte transfrontalier Luxembourg, transition industrielle automobile (Stellantis TrÃ©mery, Materalia), contraintes rÃ©glementaires bancaires et pression concurrentielle Grand Est.",
          "Le format individuel permet d'aborder des sujets confidentiels â€” stratÃ©gie d'entreprise, choix technologiques sensibles, positionnement face aux acteurs luxembourgeois et allemands â€” sans les contraintes d'une session collective.",
          "Session inaugurale toujours en prÃ©sentiel Ã  Metz : votre consultant se dÃ©place dans vos locaux (TechnopÃ´le, Quartier de l'AmphithÃ©Ã¢tre, bureau en centre-ville ou commune de l'EuromÃ©tropole).",
          "Suivi structurÃ© Ã  distance entre les sessions : exercices pratiques, ressources ciblÃ©es, retours personnalisÃ©s sur vos expÃ©rimentations IA en situation rÃ©elle.",
          "Progression calibrÃ©e sur vos objectifs concrets : adopter les outils IA dans votre quotidien, cadrer une stratÃ©gie IA pour votre organisation, ou prÃ©parer votre prise de parole sur l'IA auprÃ¨s de vos Ã©quipes.",
          "Aucun lock-in : Ã  l'issue du programme, vous Ãªtes autonome â€” outils configurÃ©s, mÃ©thodes acquises, roadmap personnelle en main.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Entretien approfondi pour cartographier votre maturitÃ© IA, vos cas d'usage prioritaires et vos freins â€” en tenant compte de votre secteur messin (automobile, banque, numÃ©rique, public) et de votre contexte transfrontalier Ã©ventuel.",
          },
          {
            step: "Session inaugurale sur site",
            detail:
              "Premier rendez-vous en prÃ©sentiel Ã  Metz : installation des outils IA sur votre poste, dÃ©mos sur vos documents et donnÃ©es rÃ©els, dÃ©finition de votre feuille de route individuelle.",
          },
          {
            step: "Sessions de coaching",
            detail:
              "SÃ©ances rÃ©guliÃ¨res Ã  distance â€” revue de vos expÃ©rimentations, approfondissement de nouveaux cas d'usage, ajustement de votre pratique IA au fil des semaines.",
          },
          {
            step: "Immersion terrain",
            detail:
              "Sur demande : observation d'une rÃ©union ou d'un processus mÃ©tier clÃ© pour affiner les recommandations Ã  votre contexte opÃ©rationnel prÃ©cis.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "Session finale de synthÃ¨se : rÃ©capitulatif des acquis, roadmap personnelle pour la suite, guide de ressources curatÃ©es Ã  votre profil messin.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Programme Essentiel",
            detail:
              "IdÃ©al pour les indÃ©pendants et dirigeants de TPE messines souhaitant intÃ©grer l'IA dans leur activitÃ© quotidienne sans mobiliser une Ã©quipe entiÃ¨re.",
          },
          {
            sizeLabel: "PME",
            price: "Programme AvancÃ©",
            detail:
              "Pour les dirigeants et managers de PME (TechnopÃ´le, commerces tertiaires, cabinets) voulant piloter la transformation IA de leur dÃ©partement.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme Dirigeant ETI",
            detail:
              "Accompagnement stratÃ©gique sur mesure pour les DG, DGA et directeurs de business unit d'ETI industrielles ou bancaires de l'EuromÃ©tropole.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Pour les membres de CODIR et executives de grands groupes implantÃ©s Ã  Metz (Stellantis, groupes bancaires BPCE) souhaitant un accompagnement confidentiel et sur mesure.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching individuel m'a permis de passer de 'je comprends l'IA en thÃ©orie' Ã  'je l'utilise chaque jour sur mes vrais dossiers'. En quelques sÃ©ances, j'ai gagnÃ© un temps considÃ©rable sur mes tÃ¢ches rÃ©pÃ©titives.",
            role: "Directeur gÃ©nÃ©ral",
            companyProfile: "TPE conseil, centre-ville Metz",
          },
          {
            quote:
              "Le format 1-to-1 Ã©tait essentiel pour moi : je pouvais aborder mes enjeux stratÃ©giques transfrontaliers sans contrainte de confidentialitÃ©. Le consultant connaissait les rÃ©alitÃ©s du tissu B2B lorrain.",
            role: "Directrice de dÃ©veloppement",
            companyProfile: "PME services, TechnopÃ´le Metz 2000",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching individuel diffÃ¨re-t-il d'une intervention collective Ã  Metz ?",
            a: "Le coaching 1-to-1 est centrÃ© sur votre cas personnel â€” vos outils, vos documents, vos enjeux stratÃ©giques, votre rythme. Pas de compromis avec les besoins d'un groupe. IdÃ©al pour les dirigeants qui veulent progresser vite sur un pÃ©rimÃ¨tre confidentiel.",
          },
          {
            q: "Combien de sÃ©ances sont nÃ©cessaires pour progresser ?",
            a: "Le rythme est fixÃ© en diagnostic initial selon vos objectifs. Un programme court couvre les bases opÃ©rationnelles, un programme long va jusqu'Ã  la maÃ®trise stratÃ©gique complÃ¨te. Vous choisissez le niveau d'ambition.",
          },
          {
            q: "Les sÃ©ances peuvent-elles se tenir Ã  distance entiÃ¨rement ?",
            a: "Non pour la session inaugurale : votre consultant se dÃ©place Ã  Metz pour installer vos outils et travailler sur vos vraies donnÃ©es. Les sÃ©ances suivantes peuvent Ãªtre en visio selon votre prÃ©fÃ©rence.",
          },
          {
            q: "Ce programme convient-il aux dirigeants sans expÃ©rience IA ?",
            a: "Oui, c'est mÃªme le profil le plus frÃ©quent. Le diagnostic initial adapte entiÃ¨rement le programme Ã  votre niveau de dÃ©part â€” aucun prÃ©requis technique.",
          },
          {
            q: "Est-il possible de combiner le coaching individuel avec une intervention collective pour mon Ã©quipe ?",
            a: "Oui. Plusieurs de nos clients messins dÃ©marrent par un coaching dirigeant pour cadrer la vision, puis enchaÃ®nent avec une session collective pour leurs Ã©quipes. Les deux formats se complÃ¨tent.",
          },
          {
            q: "Le programme tient-il compte du contexte transfrontalier Metz-Luxembourg ?",
            a: "Oui, systÃ©matiquement si pertinent. Nous adaptons les exemples, cas d'usage et recommandations aux rÃ©alitÃ©s des dirigeants opÃ©rant en contexte franco-luxembourgeois ou grand-rÃ©gional.",
          },
        ],
        guarantees:
          "Satisfaction garantie Ã  l'issue du programme : si vous estimez ne pas avoir progressÃ© sur vos objectifs dÃ©finis en diagnostic, la derniÃ¨re sÃ©ance est remboursÃ©e. Session inaugurale en prÃ©sentiel Ã  Metz garantie dÃ¨s la rÃ©servation. ConfidentialitÃ© totale â€” vos donnÃ©es, vos stratÃ©gies, vos documents restent chez vous. Outils configurÃ©s opÃ©rationnels dÃ¨s la premiÃ¨re sÃ©ance.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Metz is a bespoke 1-to-1 program for executives, managers and experts across the EuromÃ©tropole. Hybrid format â€” inaugural in-person session at your Metz offices or a TechnopÃ´le workspace, then structured remote follow-up. You progress at your own pace on your real professional challenges.",
        whyHere: [
          "EuromÃ©tropole de Metz executives face specific AI challenges: cross-border Luxembourg context, automotive industrial transition (Stellantis TrÃ©mery, Materalia), banking regulatory constraints and Grand Est competitive pressure.",
          "The individual format allows tackling confidential topics â€” corporate strategy, sensitive technology choices, competitive positioning against Luxembourg and German players â€” without group session constraints.",
          "Inaugural session always in person in Metz: your consultant travels to your offices (TechnopÃ´le, Quartier de l'AmphithÃ©Ã¢tre, city-centre office or EuromÃ©tropole commune).",
          "Structured remote follow-up between sessions: practical exercises, targeted resources, personalised feedback on your real-situation AI experiments.",
          "Progress calibrated to your concrete goals: adopting AI tools in your daily practice, framing an AI strategy for your organisation, or preparing to speak about AI to your teams.",
          "No lock-in: at the end of the programme, you are autonomous â€” tools configured, methods acquired, personal roadmap in hand.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "In-depth interview to map your AI maturity, priority use cases and blockers â€” accounting for your Metz sector specifics (automotive, banking, digital, public) and cross-border context if relevant.",
          },
          {
            step: "Inaugural on-site session",
            detail:
              "First in-person meeting in Metz: AI tools installed on your workstation, demos on your real documents and data, definition of your individual roadmap.",
          },
          {
            step: "Coaching sessions",
            detail:
              "Regular remote sessions â€” review of your experiments, deepening new use cases, adjusting your AI practice over the weeks.",
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
            sizeLabel: "Micro-business",
            price: "Essential programme",
            detail:
              "Ideal for Metz freelancers and micro-business owners looking to integrate AI into their daily activity without mobilising a whole team.",
          },
          {
            sizeLabel: "SME",
            price: "Advanced programme",
            detail:
              "For SME executives and managers (TechnopÃ´le, tertiary firms, practices) wanting to lead the AI transformation of their department or organisation.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Executive mid-cap programme",
            detail:
              "Bespoke strategic coaching for CEOs, deputy CEOs and business unit directors of industrial or banking mid-caps in the EuromÃ©tropole.",
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
            companyProfile: "Services SME, TechnopÃ´le Metz 2000",
          },
        ],
        faq: [
          {
            q: "How does individual coaching differ from a group session in Metz?",
            a: "1-to-1 coaching is centred on your personal case â€” your tools, your documents, your strategic challenges, your pace. Ideal for executives who want to progress quickly on a confidential scope.",
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
            a: "Yes, that is in fact the most common profile. The initial diagnosis fully adapts the programme to your starting level â€” no technical prerequisites.",
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
          "Satisfaction guaranteed at programme end: if you feel you have not progressed on your goals as defined at diagnosis, the final session is refunded. Inaugural in-person session in Metz guaranteed upon booking. Full confidentiality â€” your data, your strategies, your documents stay with you. Tools configured and operational from the first session.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coÃ»te un audit IA opÃ©rationnel Ã  Metz ?",
      a: "Le tarif dÃ©pend du niveau retenu â€” Audit Flash, CiblÃ©, StratÃ©gique PME ou StratÃ©gique ETI. Tarifs publics affichÃ©s sur la page Audit, choix calibrÃ© selon votre taille (TPE, PME, ETI, grande entreprise) et votre pÃ©rimÃ¨tre. Aucun supplÃ©ment gÃ©ographique : le tarif est identique Ã  Metz et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans l'EuromÃ©tropole de Metz ?",
      a: "Oui. Plusieurs de nos rÃ©fÃ©rences sont des entreprises messines ou implantÃ©es dans l'EuromÃ©tropole : ETI industrie automobile, PME services financiers TechnopÃ´le, Ã©diteur logiciel, cabinet conseil. Les cas rÃ©cents sont consultables dans la rubrique Cas concrets, filtrables par ville.",
    },
    {
      q: "Quels secteurs sont prioritaires Ã  Metz pour une mission IA ?",
      a: "Nos dÃ©ploiements messins couvrent en prioritÃ© l'industrie automobile et les matÃ©riaux (Stellantis TrÃ©mery, Materalia), la banque et la finance (BPCE, Caisse d'Ã‰pargne Grand Est), le numÃ©rique (TechnopÃ´le Metz 2000, BLIIIDA) et les services publics (prÃ©fecture Moselle, collectivitÃ©s). Tout secteur B2B est Ã©ligible Ã  un audit.",
    },
    {
      q: "Pouvez-vous intervenir pour des entreprises avec une activitÃ© transfrontaliÃ¨re Luxembourg ?",
      a: "Oui. Le bassin transfrontalier Metz-Luxembourg est une rÃ©alitÃ© opÃ©rationnelle pour de nombreuses entreprises messines (~110 000 frontaliers lorrains). Nous adaptons nos recommandations aux contraintes multi-pays â€” conformitÃ©, Ã©quipes bilingues, processus cross-border â€” et incluons cette dimension dans les audits, interventions et implÃ©mentations.",
    },
    {
      q: "Intervenez-vous dans les communes de l'EuromÃ©tropole hors Metz intra-muros ?",
      a: "Oui. L'EuromÃ©tropole entiÃ¨re est notre zone d'intervention : Montigny-lÃ¨s-Metz, Woippy, Marly, Longeville-lÃ¨s-Metz, Le Ban-Saint-Martin, zones industrielles de TrÃ©mery et ActipÃ´le Nord. Aucun supplÃ©ment de zone.",
    },
    {
      q: "Travaillez-vous avec les startups et structures du TechnopÃ´le Metz 2000 ?",
      a: "Oui. Nous accompagnons les startups et PME numÃ©riques du TechnopÃ´le Metz 2000, les structures de BLIIIDA et de l'Incubateur Lorrain. Notre offre est calibrÃ©e pour les structures en phase de scale qui veulent passer du POC IA Ã  un dÃ©ploiement opÃ©rationnel.",
    },
  ],
};
