// Rouen (76540) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/rouen.ts (Sprint City Quality V3, ville #34).
// Réalités locales : HAROPA Port (1er céréalier européen), Technopôle du Madrillet,
// Plateau de la Vatine, Matmut siège, Renault Cléon, Janssen-Cilag, Safran Nacelles,
// INSA Rouen, ESIGELEC, NEOMA, URN, Mov'eo, Nov@log, French Tech Normandie,
// Seinari, Village by CA, Crédit Agricole Normandie-Seine.

import type { VilleCopy } from "./types";

export const ROUEN_COPY: VilleCopy = {
  pitchFr:
    "Rouen regroupe 12 648 établissements actifs, 1er port céréalier européen (HAROPA Seine), un tissu industriel dense (Renault Cléon, Safran Nacelles, Janssen-Cilag, Lubrizol) et un pôle numérique normand en pleine expansion (INSA, ESIGELEC, NEOMA, French Tech Normandie). Axion-IA y intervient sur site, des TPE rouennaises aux ETI industrielles de la Métropole Seine.",
  pitchEn:
    "Rouen hosts 12,648 active businesses, Europe's leading cereal port (HAROPA Seine), a dense industrial fabric (Renault Cléon, Safran Nacelles, Janssen-Cilag, Lubrizol) and a growing Normandy digital hub (INSA, ESIGELEC, NEOMA, French Tech Normandie). Axion-IA delivers on site, from Rouen micro-businesses to large industrial mid-caps across the Seine Métropole.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Rouen : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du cabinet rouennais à l'ETI industrielle de la Métropole Seine.",
      en: "Operational AI audit in Rouen: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Rouen practices to industrial mid-caps across the Seine Métropole.",
    },
    interventions: {
      fr: "Interventions IA à Rouen : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Rouen: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Rouen : on déploie l'IA dans vos outils existants (CRM, ERP, systèmes logistiques, LIMS) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Rouen: we deploy AI into your existing tools (CRM, ERP, logistics systems, LIMS) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Rouen : coaching dirigeant ou cadre sur vos cas métier personnels — logistique portuaire, industrie, pharma, assurance. Format 1-to-1, rythme calé sur vos contraintes.",
      en: "Individual AI coaching in Rouen: 1-to-1 executive or manager coaching on your personal business cases — port logistics, industry, pharma, insurance. Pace set to your constraints.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI rouennaises — site vitrine premium pour industrie, pharma et assurance (Renault Cléon, Safran Nacelles, Janssen-Cilag, Matmut), espace client interactif logistique HAROPA, dashboard métier connecté à votre CRM/ERP, LIMS ou systèmes industriels. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Rouen SMEs/mid-caps — premium showcase site for industry, pharma and insurance (Renault Cléon, Safran Nacelles, Janssen-Cilag, Matmut), interactive customer space for HAROPA logistics, business dashboard connected to your CRM/ERP, LIMS or industrial systems. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Rouen (76) sur site — Technopôle du Madrillet, Plateau de la Vatine, quais de Seine, communes de la Métropole Rouen Normandie. Nous accompagnons les TPE, PME, ETI et grandes entreprises rouennaises (industrie, chimie, logistique, pharma, assurance, numérique) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Rouen (76) on site — Technopôle du Madrillet, Plateau de la Vatine, Seine quays, Métropole Rouen Normandie communes. We support Rouen micro-businesses, SMEs, mid-caps and large enterprises (industry, chemicals, logistics, pharma, insurance, digital) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "logistique portuaire & chimie",

  topSectorsNaf: [
    "Logistique & Supply chain (port HAROPA, Nov@log)",
    "Chimie, Pétrochimie & Industrie",
    "Aéronautique & Automobile (Safran, Renault)",
    "Pharmaceutique & Santé (Janssen-Cilag, CHU)",
    "Assurance & Banque (Matmut, Crédit Agricole Normandie-Seine)",
    "Numérique & Ingénierie (INSA, ESIGELEC, Madrillet)",
  ],

  distancesFr:
    "Gare de Rouen-Rive-Droite en centre-ville — Intercités Normandie Paris Saint-Lazare. Aéroport Rouen-Vallée de Seine (Boos, 9 km est). Réseau Astuce : 2 lignes tramway + 5 lignes TEOR (BRT) pour desservir Madrillet, Vatine, Petit-Quevilly, Grand-Quevilly, Saint-Étienne-du-Rouvray et les communes de la Métropole.",
  distancesEn:
    "Rouen-Rive-Droite station in city centre — Intercités Normandie to Paris Saint-Lazare. Rouen-Vallée de Seine Airport (Boos, 9 km east). Réseau Astuce: 2 tram lines + 5 TEOR (BRT) routes to reach Madrillet, Vatine, Petit-Quevilly, Grand-Quevilly, Saint-Étienne-du-Rouvray and all Métropole communes.",

  ecosystemFr:
    "Tissu B2B diversifié — 12 648 établissements actifs. Industrie lourde rive gauche (Renault Cléon, Safran Nacelles, Lubrizol, HAROPA Port — 1er port céréalier européen), pôle numérique Technopôle du Madrillet (INSA, ESIGELEC, CNRS, CRIANN calcul HPC), tertiaire Plateau de la Vatine (sièges PME/ETI, Matmut, Crédit Agricole Normandie-Seine), startups French Tech Normandie (Seinari, NWX, Village by CA) et grandes écoles (NEOMA, URN, ESITech).",
  ecosystemEn:
    "Diversified B2B fabric — 12,648 active businesses. Left-bank heavy industry (Renault Cléon, Safran Nacelles, Lubrizol, HAROPA Port — Europe's no.1 cereal port), Technopôle du Madrillet digital hub (INSA, ESIGELEC, CNRS, CRIANN HPC computing), Plateau de la Vatine tertiary hub (SME/mid-cap HQs, Matmut, Crédit Agricole Normandie-Seine), French Tech Normandie startups (Seinari, NWX, Village by CA) and grandes écoles (NEOMA, URN, ESITech).",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Rouen ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Rouen et partout en France.",
    },
    {
      q: "Avez-vous des références clients dans la Métropole Rouen Normandie ?",
      a: "Oui. Nos interventions rouennaises couvrent les secteurs dominants de la Métropole : industrie chimique et automobile, logistique portuaire, pharmaceutique, assurance, numérique. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par ville et secteur.",
    },
    {
      q: "Quels secteurs sont prioritaires à Rouen pour une mission IA ?",
      a: "Nos déploiements rouennais couvrent en priorité la logistique et la supply chain (port HAROPA, Nov@log), l'industrie et la chimie (Renault Cléon, Safran, Lubrizol), le pharmaceutique (Janssen-Cilag, Val-de-Reuil), l'assurance (Matmut) et le numérique (Madrillet, Vatine). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Intervenez-vous dans les communes de la Métropole hors Rouen intra-muros ?",
      a: "Oui. La Métropole Rouen Normandie entière est notre zone d'intervention : Saint-Étienne-du-Rouvray (Madrillet), Mont-Saint-Aignan (Vatine, NEOMA), Petit-Quevilly, Grand-Quevilly, Bois-Guillaume, Sotteville-lès-Rouen, Canteleu, Bihorel et les autres communes. Aucun supplément de zone.",
    },
    {
      q: "Travaillez-vous avec les startups rouennaises (French Tech Normandie, Seinari, NWX) ?",
      a: "Oui. Nous accompagnons les startups et scale-ups de l'écosystème normand — Seinari, Normandie Web Xperts, Village by CA Normandie-Seine. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "Vos consultants se déplacent-ils sur le Technopôle du Madrillet ?",
      a: "Oui. Le Technopôle du Madrillet (Saint-Étienne-du-Rouvray) fait partie de nos terrains habituels à Rouen, avec une forte densité d'entreprises INSA/ESIGELEC-issues, de PME industrielles et de laboratoires CNRS. Nos consultants connaissent les spécificités IT et industrielles de ce site.",
    },
  ],

  // === SERVICES LONG-FORM ROUEN ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise rouennaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre historique aux ETI industrielles du Madrillet et aux sièges du Plateau de la Vatine.",
        whyHere: [
          "Rouen concentre des secteurs fortement demandeurs d'IA opérationnelle : logistique portuaire (HAROPA, Nov@log), industrie chimique et automobile (Renault Cléon, Safran Nacelles, Lubrizol), pharmaceutique (Janssen-Cilag), assurance (Matmut) et numérique (Madrillet, Vatine).",
          "Tissu B2B sectorisé sur-représenté chez nos clients rouennais : PME industrielles Petit-Quevilly, ETI logistiques axe Seine, cabinets conseil Vatine, startups deep-tech Madrillet et éditeurs numériques.",
          "Nos consultants se déplacent sur l'ensemble de la Métropole : Technopôle du Madrillet, Plateau de la Vatine, quais Seine, Petit-Quevilly, Grand-Quevilly, Mont-Saint-Aignan, Saint-Étienne-du-Rouvray et communes proches.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux rouennais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI industrielles rouennaises avec des workflows complexes (logistique portuaire, chimie, automobile).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Rouen dans vos locaux — Madrillet, Vatine, Petit-Quevilly, centre-ville ou commune de la Métropole — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (opérations logistiques, production, R&D, commercial, finance, direction) pour cartographier finement les frictions, en tenant compte des spécificités sectorielles normandes (contraintes maritimes, protocoles pharma, réglementation industrie).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports de production, vos données portuaires ou pharmaceutiques. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux rouennais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur normand.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets rouennais jusqu'à une dizaine de collaborateurs — centre historique, Rive Droite, Bois-Guillaume.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques Madrillet/Vatine, cabinets conseil, agences et éditeurs logiciels de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (chimie, automobile, logistique Seine), ETI pharmaceutiques (Val-de-Reuil, Rouen) ou ETI tertiaires Vatine souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes implantés dans la Métropole (Renault Cléon, Safran Nacelles, Janssen-Cilag, Matmut, HAROPA Port).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel avec un rapport chiffré, actionnable, sans jargon. On a pu présenter le plan au conseil de direction dès la semaine suivante et prioriser nos chantiers IA avec confiance.",
            role: "Directeur général",
            companyProfile: "ETI logistique, Métropole Rouen Normandie",
          },
          {
            quote:
              "Démos sur nos données réelles plutôt que des slides génériques. Le livrable a permis d'identifier trois cas d'usage à ROI immédiat dans notre chaîne de traitement, avec une roadmap réaliste.",
            role: "Directrice transformation digitale",
            companyProfile: "PME industrie, Technopôle du Madrillet",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Rouen ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une ETI industrielle rouennaise ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, suivi logistique, qualification appels d'offres, traitement documentaire pharma). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou portuaires restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs réglementés (pharmaceutique, chimie, maritime), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Rouen ?",
            a: "Toujours en présentiel dans vos locaux rouennais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes de la Métropole (Madrillet, Vatine, Petit-Quevilly, Mont-Saint-Aignan) ?",
            a: "Oui. La Métropole Rouen Normandie est notre terrain d'intervention complet. Nos consultants se déplacent dans toutes les communes — du Madrillet (INSA, ESIGELEC) à Mont-Saint-Aignan (Vatine, NEOMA), de Petit-Quevilly (Lubrizol, Safran) à Saint-Étienne-du-Rouvray et Grand-Quevilly.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits rouennais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés (pharma, chimie, industrie maritime).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Rouen business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Rouen micro-businesses to large industrial mid-caps at the Madrillet and tertiary HQs on the Plateau de la Vatine.",
        whyHere: [
          "Rouen concentrates sectors with strong operational AI demand: port logistics (HAROPA, Nov@log), chemical and automotive industry (Renault Cléon, Safran Nacelles, Lubrizol), pharma (Janssen-Cilag), insurance (Matmut) and digital (Madrillet, Vatine).",
          "Rouen B2B fabric over-represented in our cases: industrial SMEs in Petit-Quevilly, logistics mid-caps on the Seine axis, consulting firms at Vatine, deep-tech startups at Madrillet and digital publishers.",
          "Our consultants travel across the full Métropole: Technopôle du Madrillet, Plateau de la Vatine, Seine quays, Petit-Quevilly, Grand-Quevilly, Mont-Saint-Aignan, Saint-Étienne-du-Rouvray and surrounding communes.",
          "Read-outs always in person: ideation workshops at your Rouen offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Rouen industrial mid-caps with complex workflows (port logistics, chemicals, automotive).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Rouen at your offices — Madrillet, Vatine, Petit-Quevilly, city centre or a Métropole commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (logistics operations, production, R&D, sales, finance, leadership) to map frictions, accounting for Norman sector specifics (maritime constraints, pharma protocols, industrial regulation).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, production reports, port or pharmaceutical data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Rouen offices. Costed PDF deliverable handed over, actionable roadmap tailored to your Norman sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Rouen freelancers, micro-firms and practices up to about ten staff — historic centre, Rive Droite, Bois-Guillaume.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs at Madrillet/Vatine, consulting firms, agencies and software publishers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (chemicals, automotive, Seine logistics), pharma mid-caps (Val-de-Reuil, Rouen) or tertiary mid-caps at Vatine framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups implanted in the Métropole (Renault Cléon, Safran Nacelles, Janssen-Cilag, Matmut, HAROPA Port).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit with a costed, actionable, jargon-free report. We presented the plan to the board the very next week and prioritised our AI initiatives with confidence.",
            role: "CEO",
            companyProfile: "Logistics mid-cap, Métropole Rouen Normandie",
          },
          {
            quote:
              "Demos on our real data rather than generic slides. The deliverable identified three immediate-ROI use cases in our processing chain, with a realistic roadmap.",
            role: "Head of Digital Transformation",
            companyProfile: "Industrial SME, Technopôle du Madrillet",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Rouen?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Rouen?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, logistics tracking, tender qualification, pharma document processing). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my industrial or port data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For regulated sectors (pharma, chemicals, maritime), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Rouen?",
            a: "Always in person at your Rouen offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Métropole communes (Madrillet, Vatine, Petit-Quevilly, Mont-Saint-Aignan)?",
            a: "Yes. The Métropole Rouen Normandie is our full territory. Our consultants travel to all communes — from Madrillet (INSA, ESIGELEC) to Mont-Saint-Aignan (Vatine, NEOMA), from Petit-Quevilly (Lubrizol, Safran) to Saint-Étienne-du-Rouvray and Grand-Quevilly.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Rouen audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors (pharma, chemicals, maritime industry).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Rouen se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en usine, à quai, en laboratoire, au bureau ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Rouen est l'un de nos terrains d'intervention normands : entreprises industrielles et portuaires, PME pharmaceutiques, cabinets tertiaires Vatine et startups numériques Madrillet représentent une part significative de nos sessions.",
          "Tous les arrondissements et communes de la Métropole couverts en présentiel : Madrillet, Vatine, Petit-Quevilly, Grand-Quevilly, Mont-Saint-Aignan, Saint-Étienne-du-Rouvray, Sotteville-lès-Rouen, Bois-Guillaume, Canteleu.",
          "Le format Essentielle est calibré pour les structures rouennaises de quelques personnes à une centaine de collaborateurs, en particulier les PME numériques du Madrillet et les cabinets du Plateau de la Vatine.",
          "Le format Conférence convient aux plénières d'entreprise rouennaises (espaces Madrillet, salles tertiaires Vatine, auditoriums campus INSA ou NEOMA).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des groupes implantés dans la Métropole.",
          "Vocabulaire ajusté à votre secteur dominant : logistique portuaire, chimie/pharma, automobile, assurance, numérique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires maritimes, pharma ou industrielles — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de livraison, rapports qualité, emails, dossiers réglementaires, données portuaires) pour calibrer les démos sur VOS données rouennaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux rouennais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels ou portuaires avec postes déconnectés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle normande.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau Vatine, à l'atelier Madrillet ou en itinérance portuaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites agences rouennaises jusqu'à une dizaine de collaborateurs — centre historique, Rive Droite, Bois-Guillaume.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — opérations logistiques, R&D, commercial, finance — particulièrement efficace pour les PME industrielles du Madrillet.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, sièges portuaires) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges rouennais — roadshow multi-sites Métropole, séminaires CODIR + cascade équipes terrain ou ateliers.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos équipes opérations. Ils sont repartis avec leurs outils configurés sur leurs vrais processus logistiques. Dès le lendemain, plusieurs les utilisaient pour traiter la documentation de transit.",
            role: "Directeur opérations",
            companyProfile: "PME logistique, axe Seine Rouen",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles normandes — pas de session générique, des cas concrets qui parlaient à nos équipes industrielles.",
            role: "DG",
            companyProfile: "ETI industrie, Métropole Rouen Normandie",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Rouen ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels portuaires ou pharmaceutiques ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements portuaires, industriels et pharmaceutiques rouennais — postes déconnectés, VLAN sécurisés, protocoles accès site, zones Seveso. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur logistique ou pharma normand ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME logistique portuaire n'a rien à voir avec une session pour un cabinet conseil tertiaire de la Vatine.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur rouennais — logistique portuaire, chimie/pharma, automobile, assurance, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Rouen come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on the factory floor, at the quay, in the lab, at the office or in the field. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Rouen is one of our Norman engagement grounds: industrial and port companies, pharma SMEs, Vatine tertiary firms and Madrillet digital startups represent a significant share of our sessions.",
          "All arrondissements and Métropole communes covered in person: Madrillet, Vatine, Petit-Quevilly, Grand-Quevilly, Mont-Saint-Aignan, Saint-Étienne-du-Rouvray, Sotteville-lès-Rouen, Bois-Guillaume, Canteleu.",
          "The Essential format is calibrated for Rouen structures from a few people to about a hundred staff, particularly digital SMEs at Madrillet and Plateau de la Vatine consulting firms.",
          "The Talk format suits Rouen corporate plenaries (Madrillet spaces, Vatine tertiary rooms, INSA or NEOMA campus auditoriums).",
          "The Executives format enables in-camera framing for industrial mid-cap and large group executive committees in the Métropole.",
          "Vocabulary adjusted to your dominant sector: port logistics, chemicals/pharma, automotive, insurance, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including maritime, pharma or industrial regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (delivery notes, quality reports, emails, regulatory files, port data) to calibrate demos on YOUR Rouen data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Rouen offices to check equipment, projection and network access. No technical hiccup on D-day, even in industrial or port environments with air-gapped workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Norman sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a Vatine office, Madrillet workshop or out in the port field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Rouen freelancers, practices and small agencies up to about ten staff — historic centre, Rive Droite, Bois-Guillaume.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — logistics operations, R&D, sales, finance — particularly effective for Madrillet industrial SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, port HQs) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Rouen HQs — multi-site Métropole roadshows, exec committee seminars + field team or workshop cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our operations team's needs. They left with tools configured for their real logistics processes. By the next day, several were already using them to handle transit documentation.",
            role: "Operations Director",
            companyProfile: "Logistics SME, Seine axis Rouen",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our Norman sector constraints — no generic session, concrete cases that resonated with our industrial teams.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Métropole Rouen Normandie",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Rouen take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in industrial port or pharmaceutical environments?",
            a: "Yes. Our consultants adapt to Rouen port, industrial and pharmaceutical environment constraints — air-gapped workstations, secure VLANs, site access protocols, Seveso zones. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Norman logistics or pharma sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a port logistics SME has nothing to do with one for a Vatine tertiary consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Rouen sector — port logistics, chemicals/pharma, automotive, insurance, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Rouen met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux rouennais — Madrillet, Vatine, Petit-Quevilly ou commune de la Métropole.",
        whyHere: [
          "Rouen concentre une part croissante de nos missions d'implémentation, principalement dans la logistique portuaire (HAROPA, axe Seine), l'industrie (Renault Cléon, Safran Nacelles, Lubrizol), le pharmaceutique (Janssen-Cilag), l'assurance (Matmut) et les éditeurs numériques Madrillet.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux rouennais : alignement des équipes, accès aux données de production ou documentaires, validation des intégrations CRM/ERP/TMS/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Rouen : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier portuaire.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques rouennais : ETI logistiques (automatisation documentation transit, suivi flux portuaires), PME pharmaceutiques (analyse documentaire réglementaire, rapports qualité), cabinets assurance (qualification sinistres, génération documents), éditeurs Madrillet (agents support, copilotes développeurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Rouen : revue de l'architecture cible (CRM, ERP, TMS, LIMS, systèmes portuaires), validation des contraintes RGPD/sécurité et réglementaires (maritime, pharma, industrie), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Rouen : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Rouen : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants rouennais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP/TMS. Pour PME logistiques et pharmaceutiques, éditeurs Madrillet, cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP portuaire, TMS, LIMS, datalake), formation ambassadeurs cross-département. Adapté aux ETI industrielles et logistiques rouennaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Métropole Rouen : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation documentation transit livrée comme promis. ROI mesuré dès les premiers mois : nos équipes passent maintenant moins de temps sur les documents et plus sur la relation client. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur logistique",
            companyProfile: "ETI transport & logistique, Métropole Rouen",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe entre le labo et le bureau. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME numérique, Technopôle du Madrillet",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Rouen ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions rouennaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données portuaires, industrielles ou pharmaceutiques restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés rouennais (maritime, pharma, chimie), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (documents réglementaires maritimes ou pharma, pièces critiques), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Rouen brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Rouen offices — Madrillet, Vatine, Petit-Quevilly or a Métropole commune.",
        whyHere: [
          "Rouen hosts a growing share of our implementation missions, primarily in port logistics (HAROPA, Seine axis), industry (Renault Cléon, Safran Nacelles, Lubrizol), pharma (Janssen-Cilag), insurance (Matmut) and Madrillet digital publishers.",
          "Kick-off always happens in person at your Rouen offices: team alignment, access to production or documentary data, CRM/ERP/TMS/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Rouen: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or port workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Rouen cases: logistics mid-caps (transit documentation automation, port flow monitoring), pharma SMEs (regulatory document analysis, quality reports), insurance firms (claim qualification, document generation), Madrillet publishers (support agents, developer copilots).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Rouen workshop: target architecture review (CRM, ERP, TMS, LIMS, port systems), GDPR/security and regulatory constraints validation (maritime, pharma, industry), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Rouen: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Rouen: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Rouen micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP/TMS integration. For logistics and pharma SMEs, Madrillet publishers, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (port ERP, TMS, LIMS, datalake), cross-department ambassador training. Tailored for Rouen industrial and logistics mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Métropole Rouen large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Transit documentation automation implementation delivered as promised. ROI measured within the first months: our teams now spend less time on documents and more on client relations. No lock-in, we control our deployment.",
            role: "Logistics Director",
            companyProfile: "Transport & logistics mid-cap, Métropole Rouen",
          },
          {
            quote:
              "Perfect hybrid method for our team between the lab and the office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Digital SME, Technopôle du Madrillet",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Rouen take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Rouen missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my port, industrial or pharmaceutical data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Rouen regulated sectors (maritime, pharma, chemicals), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (maritime or pharma regulatory documents, critical components), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel Axion-IA à Rouen est un coaching 1-to-1 sur vos cas métier personnels — dirigeant ETI logistique, cadre pharmaceutique, responsable assurance ou manager numérique. Format flexible, rythme calé sur vos contraintes rouennaises, démos sur vos propres données. Frais de logement, repas et forfait trajet en sus pour les séances présentielles.",
        whyHere: [
          "Rouen concentre des profils de cadres et dirigeants dans des secteurs à forte spécificité : logistique portuaire (HAROPA, axe Seine), industrie (Renault, Safran), pharmaceutique (Janssen-Cilag), assurance (Matmut) — nos coachings s'ancrent dans ces réalités métier.",
          "Format 1-to-1 : vous progressez à votre rythme, sans vous adapter à un groupe. Les sessions s'organisent selon vos disponibilités, en présentiel à Rouen ou à distance.",
          "Démos 100 % sur vos données réelles : vos emails, vos rapports, vos documents métier — pas d'exemples génériques déconnectés de votre quotidien rouennais.",
          "Applicable dès le lendemain : chaque session se conclut par un plan d'action personnel concret, exécutable sans aide extérieure.",
          "Confidentiel et Confidentialité stricte : vos cas métier, vos données et vos pratiques restent strictement privés.",
          "Aucun engagement de durée : vous décidez du nombre de sessions selon votre progression et vos besoins.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Premier échange pour cartographier vos cas d'usage personnels prioritaires — tâches répétitives, production documentaire, analyse de données, prise de décision — dans le contexte de votre secteur rouennais.",
          },
          {
            step: "Sessions de travail sur vos données",
            detail:
              "Séances de coaching pratiques : on travaille directement sur vos fichiers, vos emails, vos rapports. Vous voyez l'IA appliquée à votre travail réel, pas à des exemples fictifs.",
          },
          {
            step: "Outillage personnalisé",
            detail:
              "Configuration des outils IA (Claude, ChatGPT, Mistral, Notion AI, etc.) pour vos cas d'usage spécifiques. Vous repartez avec des workflows personnalisés opérationnels.",
          },
          {
            step: "Suivi et itération",
            detail:
              "Entre les sessions, vous testez en autonomie. En début de session suivante, on ajuste ce qui ne colle pas et on approfondit ce qui fonctionne — à votre rythme.",
          },
          {
            step: "Plan d'action personnel",
            detail:
              "À chaque session, un mémo récapitulatif des outils installés, prompts calibrés et prochaines étapes — support durable, exploitable après la fin du coaching.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Séance découverte",
            detail:
              "Une session d'initiation pour identifier vos cas d'usage prioritaires et tester les premiers outils sur vos données — idéal pour les indépendants et dirigeants TPE rouennais.",
          },
          {
            sizeLabel: "PME",
            price: "Parcours manager",
            detail:
              "Programme de plusieurs sessions pour un cadre ou manager PME souhaitant intégrer l'IA dans ses pratiques quotidiennes — Madrillet, Vatine, centre-ville.",
          },
          {
            sizeLabel: "ETI",
            price: "Parcours dirigeant ETI",
            detail:
              "Coaching intensif pour dirigeant ou CODIR d'ETI rouennaise souhaitant cadrer sa posture IA et accélérer ses décisions sur les chantiers en cours.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme cadres dirigeants",
            detail:
              "Accompagnement de plusieurs dirigeants ou cadres supérieurs d'un même groupe implanté dans la Métropole — format confidentiel, séances individuelles distinctes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Trois sessions 1-to-1 ont changé ma façon de traiter les rapports d'activité. Je gagne plusieurs heures par semaine sur des tâches que je faisais manuellement depuis des années. Le coach connaissait parfaitement les contraintes de mon secteur.",
            role: "Directeur commercial",
            companyProfile: "ETI assurance, Rouen",
          },
          {
            quote:
              "Format complètement adapté à mon rythme de dirigeant. On a travaillé sur mes vrais dossiers, pas sur des exemples bidons. Résultat opérationnel dès la première session.",
            role: "PDG",
            companyProfile: "PME logistique, Métropole Rouen Normandie",
          },
        ],
        faq: [
          {
            q: "Combien de sessions faut-il pour progresser en IA à Rouen ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Une séance découverte suffit pour identifier vos cas prioritaires et tester les premiers outils. Un parcours complet de plusieurs sessions permet d'intégrer l'IA dans vos pratiques de façon durable et autonome.",
          },
          {
            q: "Les séances peuvent-elles se tenir à distance ou seulement en présentiel à Rouen ?",
            a: "Les deux formats sont disponibles. En présentiel dans vos locaux rouennais ou à distance en visio — les démos sur vos données fonctionnent dans les deux cas. Pour les premiers échanges, nous recommandons au moins une session en présentiel.",
          },
          {
            q: "Mes données et mes pratiques resteront-elles confidentielles ?",
            a: "Oui. Confidentialité stricte avant toute session. Vos documents, vos données et vos pratiques métier restent strictement privés — aucun exemple issu de vos sessions ne sera utilisé dans d'autres contextes.",
          },
          {
            q: "Peut-on adapter le coaching à mon secteur spécifique (logistique, pharma, assurance) ?",
            a: "Oui, c'est précisément l'intérêt du 1-to-1. Le coaching se construit autour de vos cas métier réels — logistique portuaire HAROPA, documentation pharmaceutique, qualification sinistres assurance, rapports industriels. Pas de contenu générique recyclé.",
          },
          {
            q: "Le coaching est-il éligible aux dispositifs de formation professionnelle ?",
            a: "Nos coachings sont facturés en direct sur devis HT. Ils s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil et formation professionnelle.",
          },
          {
            q: "Que se passe-t-il si je ne progresse pas autant qu'espéré ?",
            a: "Après chaque session, vous disposez d'un plan d'action personnel écrit. Si après plusieurs sessions vous n'observez pas de progression tangible sur vos cas d'usage, nous réévaluons ensemble l'approche — et si nécessaire, la dernière session est offerte.",
          },
        ],
        guarantees:
          "Confidentialité garantie par Confidentialité stricte dès la première session. Aucun engagement de durée : vous choisissez le nombre de sessions selon votre rythme et vos besoins. Outils opérationnels dès la première session : si vous ne repartez pas avec au moins un outil configuré sur vos données, session remboursée. Coaching ancré dans votre secteur rouennais — logistique, pharma, assurance, numérique, industrie — aucune session générique.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Rouen is a 1-to-1 engagement on your personal business cases — logistics mid-cap executive, pharma manager, insurance director or digital manager. Flexible format, pace set to your Rouen constraints, demos on your own data. Lodging, meals and travel allowance billed separately for in-person sessions.",
        whyHere: [
          "Rouen concentrates senior profiles in highly specific sectors: port logistics (HAROPA, Seine axis), industry (Renault, Safran), pharma (Janssen-Cilag), insurance (Matmut) — our coaching is grounded in these business realities.",
          "1-to-1 format: you progress at your own pace, without adapting to a group. Sessions are scheduled to your availability, in person in Rouen or remotely.",
          "Demos 100% on your real data: your emails, reports, business documents — no generic examples disconnected from your daily Rouen work.",
          "Applicable from the next day: each session ends with a concrete personal action plan, executable without external help.",
          "Confidential with Strict confidentiality: your business cases, data and practices remain strictly private.",
          "No duration commitment: you decide the number of sessions based on your progress and needs.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "First exchange to map your priority personal use cases — repetitive tasks, document production, data analysis, decision-making — in the context of your Rouen sector.",
          },
          {
            step: "Work sessions on your data",
            detail:
              "Practical coaching sessions: we work directly on your files, emails, reports. You see AI applied to your real work, not fictional examples.",
          },
          {
            step: "Personalised tooling",
            detail:
              "AI tools configuration (Claude, ChatGPT, Mistral, Notion AI, etc.) for your specific use cases. You leave with operational personalised workflows.",
          },
          {
            step: "Follow-up and iteration",
            detail:
              "Between sessions, you test autonomously. At the start of the next session, we adjust what does not fit and deepen what works — at your pace.",
          },
          {
            step: "Personal action plan",
            detail:
              "After each session, a summary memo of installed tools, calibrated prompts and next steps — a durable support, exploitable after the end of coaching.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Discovery session",
            detail:
              "An introductory session to identify your priority use cases and test the first tools on your data — ideal for Rouen freelancers and micro-business owners.",
          },
          {
            sizeLabel: "SME",
            price: "Manager track",
            detail:
              "Multi-session programme for an SME manager or executive wishing to integrate AI into their daily practices — Madrillet, Vatine, city centre.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive track",
            detail:
              "Intensive coaching for a Rouen mid-cap CEO or executive committee member wishing to frame their AI posture and accelerate decisions on ongoing initiatives.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Senior executive programme",
            detail:
              "Coaching of several executives or senior managers from the same group implanted in the Métropole — confidential format, separate individual sessions.",
          },
        ],
        testimonials: [
          {
            quote:
              "Three 1-to-1 sessions changed how I handle activity reports. I save several hours per week on tasks I had been doing manually for years. The coach knew our sector constraints perfectly.",
            role: "Sales Director",
            companyProfile: "Insurance mid-cap, Rouen",
          },
          {
            quote:
              "Format perfectly adapted to my executive pace. We worked on my real files, not dummy examples. Operational result from the very first session.",
            role: "CEO",
            companyProfile: "Logistics SME, Métropole Rouen Normandie",
          },
        ],
        faq: [
          {
            q: "How many sessions does it take to progress in AI in Rouen?",
            a: "It depends on your starting level and objectives. A discovery session is enough to identify your priority cases and test the first tools. A full multi-session track allows you to integrate AI into your practices sustainably and autonomously.",
          },
          {
            q: "Can sessions be held remotely or only in person in Rouen?",
            a: "Both formats are available. In person at your Rouen offices or remotely by video — demos on your data work either way. For the first exchanges, we recommend at least one in-person session.",
          },
          {
            q: "Will my data and practices remain confidential?",
            a: "Yes. Strict confidentiality before any session. Your documents, data and business practices remain strictly private — no example from your sessions will be used in any other context.",
          },
          {
            q: "Can the coaching be adapted to my specific sector (logistics, pharma, insurance)?",
            a: "Yes, that is precisely the advantage of 1-to-1. The coaching is built around your real business cases — HAROPA port logistics, pharmaceutical documentation, insurance claim qualification, industrial reports. No recycled generic content.",
          },
          {
            q: "Is the coaching eligible for professional training schemes?",
            a: "Our coaching is invoiced directly on a fixed quote (excl. VAT). It can be included in your company's training plan — your HR or finance team can process it as a consulting and professional training service.",
          },
          {
            q: "What if I do not progress as much as expected?",
            a: "After each session, you have a written personal action plan. If after several sessions you do not observe tangible progress on your use cases, we reassess the approach together — and if necessary, the last session is offered free.",
          },
        ],
        guarantees:
          "Strict confidentiality guaranteed from the first session. No duration commitment: you choose the number of sessions at your own pace and based on your needs. Operational tools from the first session: if you do not leave with at least one tool configured on your data, session refunded. Coaching grounded in your Rouen sector — logistics, pharma, insurance, digital, industry — no generic session.",
      },
    },
  },
};
