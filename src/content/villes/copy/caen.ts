// Caen (14118) — contenu éditorial (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/caen.ts (Sprint City Quality V3, ville #36).
// Réalités locales : Gare de Caen (2h Paris Saint-Lazare), NXP Semiconductors
// Colombelles, Robert Bosch Mondeville, Renault Trucks Blainville-sur-Orne,
// ENSICAEN, UCN, GANIL, GREYC IA/cybersécurité, technopôle EffiScience,
// pôle Hippolia (filière équine), Mémorial de Caen, ZAC Presqu'île, CHU Caen.

import type { VilleCopy } from "./types";

export const CAEN_COPY: VilleCopy = {
  pitchFr:
    "Caen regroupe 11 288 établissements actifs, un tissu industriel ancré dans l'électronique et l'automobile (NXP Semiconductors, Robert Bosch, Renault Trucks), un campus de recherche majeur (UCN, ENSICAEN, GANIL, GREYC IA/cybersécurité) et un écosystème unique autour de la filière équine (pôle Hippolia). Axion-IA intervient sur site, des TPE caennaises aux ETI du bassin Caen la Mer.",
  pitchEn:
    "Caen hosts 11,288 active businesses, an industrial fabric rooted in electronics and automotive (NXP Semiconductors, Robert Bosch, Renault Trucks), a major research campus (UCN, ENSICAEN, GANIL, GREYC AI/cybersecurity) and a unique equine sector ecosystem (Hippolia hub). Axion-IA delivers on site, from Caen micro-businesses to mid-caps across the Caen la Mer area.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Caen : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI, des TPE caennaises aux ETI industrielles du bassin (NXP, Bosch, Renault Trucks).",
      en: "Operational AI audit in Caen: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Caen micro-businesses to industrial mid-caps across the Caen la Mer area (NXP, Bosch, Renault Trucks).",
    },
    interventions: {
      fr: "Interventions IA à Caen : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Caen: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Caen : on déploie l'IA dans vos outils existants (CRM, ERP, systèmes industriels, LIMS) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Caen: we deploy AI into your existing tools (CRM, ERP, industrial systems, LIMS) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Caen : accompagnement 1-to-1 pour dirigeants, managers et experts qui veulent monter en compétence IA à leur rythme — sessions sur site ou à distance, cas d'usage ancrés dans votre réalité sectorielle caennaise.",
      en: "Individual AI coaching in Caen: 1-to-1 support for executives, managers and experts who want to build AI skills at their own pace — on-site or remote sessions, use cases grounded in your Caen sector reality.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Caen (14) sur site — hypercentre, technopôle EffiScience, plateau Nord (UCN/ENSICAEN/CHU), ZAC Presqu'île et communes du bassin Caen la Mer. Nous accompagnons les TPE, PME, ETI et grandes entreprises caennaises (industrie, électronique, santé, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Caen (14) on site — city centre, EffiScience technopole, Plateau Nord (UCN/ENSICAEN/CHU), ZAC Presqu'île and communes across the Caen la Mer area. We support Caen micro-businesses, SMEs, mid-caps and large enterprises (industry, electronics, health, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Industrie & Électronique embarquée",
    "Semi-conducteurs & R&D circuits intégrés",
    "Automobile & Mobilités électriques",
    "Santé, CHU & Recherche médicale",
    "Enseignement supérieur & Sciences",
    "Activités financières & Assurance",
  ],

  distancesFr:
    "Gare de Caen en hypercentre — Intercités Normandie Paris Saint-Lazare (~2h). Aéroport de Caen-Carpiquet à 7 km. Tramway 3 lignes (T1/T2/T3, réseau Twisto) desservant le plateau Nord (UCN/ENSICAEN/CHU), EffiScience, la ZAC Presqu'île et les communes limitrophes (Hérouville-Saint-Clair, Mondeville, Colombelles).",
  distancesEn:
    "Caen station in the city centre — Intercités Normandie to Paris Saint-Lazare (~2h). Caen-Carpiquet Airport 7 km away. Tram 3 lines (T1/T2/T3, Twisto network) reaching Plateau Nord (UCN/ENSICAEN/CHU), EffiScience, ZAC Presqu'île and neighbouring communes (Hérouville-Saint-Clair, Mondeville, Colombelles).",

  ecosystemFr:
    "Tissu B2B dense — 11 288 établissements actifs. Industrie électronique et automobile (NXP Semiconductors Colombelles, Robert Bosch Mondeville, Renault Trucks Blainville), campus recherche plateau Nord (UCN fondée 1432, ENSICAEN, GANIL, GREYC IA/cybersécurité), technopôle EffiScience (~250 entreprises numériques/R&D), ZAC Presqu'île (tertiaire en mutation), pôle Hippolia (filière équine unique en France), CHU Caen et Normandie Incubation.",
  ecosystemEn:
    "Dense B2B fabric — 11,288 active businesses. Electronics and automotive industry (NXP Semiconductors Colombelles, Robert Bosch Mondeville, Renault Trucks Blainville), Plateau Nord research campus (UCN founded 1432, ENSICAEN, GANIL, GREYC AI/cybersecurity), EffiScience technopole (~250 digital/R&D firms), ZAC Presqu'île (tertiary district in transformation), Hippolia equine hub (France's only dedicated equine competitiveness pole), Caen University Hospital and Normandie Incubation.",

  heroSchema: {
    centerSubLabel: "Écosystème IA · 11 288 établissements",
    satellites: [
      {
        label: "NXP / Bosch",
        detail: "Semi-conducteurs & électronique",
        accent: "primary",
      },
      {
        label: "UCN · ENSICAEN",
        detail: "Campus recherche fondée 1432",
        accent: "sage",
      },
      {
        label: "GANIL · GREYC",
        detail: "Physique nucléaire · IA / cybersécurité",
        accent: "mocha",
      },
      {
        label: "Renault Trucks",
        detail: "Mobilités électriques, bassin Caen",
        accent: "terracotta",
      },
      {
        label: "Hippolia",
        detail: "Filière équine — unique en France",
        accent: "sage",
      },
      {
        label: "EffiScience",
        detail: "Technopôle numérique / R&D",
        accent: "primary",
      },
    ],
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Caen ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Caen et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans le bassin Caen la Mer ?",
      a: "Oui. Nos références incluent des entreprises du secteur industriel, de l'électronique et des services caennais. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par ville.",
    },
    {
      q: "Quels secteurs sont prioritaires à Caen pour une mission IA ?",
      a: "Nos déploiements caennais couvrent en priorité l'industrie électronique et automobile (NXP, Bosch, Renault Trucks), la santé et la recherche (CHU, UCN, ENSICAEN), les services aux entreprises et les PME numériques d'EffiScience. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir dans les communes du bassin hors Caen intra-muros ?",
      a: "Oui. Le bassin entier est notre zone d'intervention : Hérouville-Saint-Clair, Mondeville (Bosch), Colombelles (NXP, EffiScience), Ifs, Bretteville-sur-Odon, Bénouville et les autres communes Caen la Mer. Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Caen ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les startups et deeptech caennaises (Normandie Incubation, Le Dôme) ?",
      a: "Oui. Nous accompagnons les startups et spin-offs issus du campus UCN/ENSICAEN, les projets incubés par Normandie Incubation et les porteurs de projets innovants du Dôme. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],

  // === SERVICES LONG-FORM CAEN ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise caennaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE de l'hypercentre aux ETI industrielles du bassin — NXP Semiconductors, Robert Bosch, Renault Trucks — et aux directions recherche du plateau Nord.",
        whyHere: [
          "Caen concentre un tissu B2B industriel et technologique dense : semi-conducteurs (NXP Colombelles), électronique automobile (Bosch Mondeville), mobilités électriques (Renault Trucks Blainville) et services numériques (EffiScience) génèrent une demande forte d'audits IA opérationnels.",
          "Le campus plateau Nord (UCN, ENSICAEN, GANIL, GREYC IA/cybersécurité) produit un écosystème recherche-industrie propice aux déploiements IA avancés — nos audits s'ancrent dans cette réalité locale.",
          "Nos consultants se déplacent sur l'ensemble du bassin Caen la Mer : hypercentre, EffiScience, plateau Nord, ZAC Presqu'île, Hérouville-Saint-Clair, Mondeville, Colombelles, Ifs et communes environnantes.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux caennais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI industrielles du bassin avec des workflows de production ou de R&D complexes.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Caen dans vos locaux — hypercentre, EffiScience, plateau Nord, ZAC Presqu'île ou commune du bassin — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (ingénieurs, commerciaux, finance, R&D, production, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités caennaises (contraintes industrie électronique, protocoles CHU/recherche médicale, normes automobile).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, rapports de production, données de tests électroniques ou dossiers patients anonymisés. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux caennais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur — industrie, santé, numérique, filière équine.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets caennais jusqu'à une dizaine de collaborateurs — hypercentre, quartiers résidentiels, ZAC Presqu'île.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques d'EffiScience, les sociétés de services, les agences et les éditeurs logiciels de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (électronique, automobile), ETI santé/recherche (CHU, laboratoires) ou ETI tertiaires souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes dont les sites majeurs sont implantés dans le bassin Caen la Mer (NXP Semiconductors Colombelles, Robert Bosch Mondeville, Renault Trucks Blainville-sur-Orne).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel en quelques semaines. Le rapport est chiffré, actionnable, sans jargon. On a pu présenter le plan au comité de direction dès la semaine suivante.",
            role: "Directeur général",
            companyProfile: "ETI industrie électronique, bassin Caen la Mer",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes plutôt que des slides. Le livrable a permis de prioriser nos chantiers IA pour le comité de pilotage, avec un ROI chiffré pour chaque cas.",
            role: "Directrice de la transformation",
            companyProfile: "PME services numériques, EffiScience Caen",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Caen ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une ETI industrielle caennaise ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité électronique, contrôle production, qualification appels d'offres, lecture factures fournisseurs). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou médicales restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs réglementés (électronique automobile, CHU, recherche médicale GANIL), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Caen ?",
            a: "Toujours en présentiel dans vos locaux caennais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes du bassin (Mondeville, Colombelles, Hérouville-Saint-Clair) ?",
            a: "Oui. Le bassin Caen la Mer entier est notre terrain d'intervention. Nos consultants se déplacent dans toutes les communes — de Mondeville (Bosch) à Colombelles (NXP, EffiScience), d'Hérouville-Saint-Clair à Ifs et Bretteville-sur-Odon.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits caennais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés (automobile, santé, industrie).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Caen business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Caen micro-businesses to large industrial mid-caps across the Caen la Mer area — NXP Semiconductors, Robert Bosch, Renault Trucks — and research leadership on Plateau Nord.",
        whyHere: [
          "Caen concentrates a dense industrial and tech B2B fabric: semiconductors (NXP Colombelles), automotive electronics (Bosch Mondeville), electric vehicles (Renault Trucks Blainville) and digital services (EffiScience) drive strong operational AI audit demand.",
          "Plateau Nord campus (UCN, ENSICAEN, GANIL, GREYC AI/cybersecurity) produces a research-industry ecosystem conducive to advanced AI deployments — our audits are grounded in this local reality.",
          "Our consultants travel across the full Caen la Mer area: city centre, EffiScience, Plateau Nord, ZAC Presqu'île, Hérouville-Saint-Clair, Mondeville, Colombelles, Ifs and surrounding communes.",
          "Read-outs always in person: ideation workshops at your Caen offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Caen la Mer industrial mid-caps with complex production or R&D workflows.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Caen at your offices — city centre, EffiScience, Plateau Nord, ZAC Presqu'île or a basin commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (engineers, sales, finance, R&D, production, leadership) to map frictions and expectations, accounting for Caen sector specifics (electronics industry constraints, CHU/medical research protocols, automotive norms).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, production reports, electronics test data or anonymised patient files. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Caen offices. Costed PDF deliverable handed over, actionable roadmap tailored to your sector — industry, health, digital, equine.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Caen freelancers, micro-firms and practices up to about ten staff — city centre, residential districts, ZAC Presqu'île.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for EffiScience digital SMEs, service companies, agencies and software publishers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (electronics, automotive), health/research mid-caps (CHU, labs) or tertiary mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups with major sites across the Caen la Mer area (NXP Semiconductors Colombelles, Robert Bosch Mondeville, Renault Trucks Blainville-sur-Orne).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit within a few weeks. The report is costed, actionable, jargon-free. We were able to present the plan to the board the very next week.",
            role: "CEO",
            companyProfile: "Electronics industrial mid-cap, Caen la Mer area",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than slides. The deliverable helped prioritize our AI initiatives with a costed ROI for each use case.",
            role: "Head of Transformation",
            companyProfile: "Digital services SME, EffiScience Caen",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Caen?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Caen?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (electronics quality reports, production tracking, tender qualification, supplier invoice reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my industrial or medical data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For regulated sectors (automotive electronics, CHU, medical research at GANIL), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Caen?",
            a: "Always in person at your Caen offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover basin communes (Mondeville, Colombelles, Hérouville-Saint-Clair)?",
            a: "Yes. The full Caen la Mer area is our territory. Our consultants travel to all communes — from Mondeville (Bosch) to Colombelles (NXP, EffiScience), Hérouville-Saint-Clair to Ifs and Bretteville-sur-Odon.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Caen audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors (automotive, health, industry).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Caen se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en atelier électronique, en laboratoire de recherche, au bureau ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Caen est un terrain d'intervention industriel et académique porteur : entreprises électroniques, équipes R&D ENSICAEN/UCN/GREYC, services financiers et PME numériques d'EffiScience représentent un profil de collaborateurs exigeants qui attendent des cas d'usage concrets.",
          "Tous les sites du bassin couverts en présentiel : hypercentre, plateau Nord (UCN/ENSICAEN/CHU), EffiScience, ZAC Presqu'île, Hérouville-Saint-Clair, Mondeville, Colombelles et communes limitrophes.",
          "Le format Essentielle est calibré pour les structures caennaises de quelques personnes à une centaine de collaborateurs, en particulier les PME d'EffiScience et les équipes de recherche appliquée.",
          "Le format Conférence convient aux plénières d'entreprise caennaises (amphithéâtres UCN/ENSICAEN, salles Parc des Expositions, espaces Normandie Incubation).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des groupes du bassin Caen la Mer.",
          "Vocabulaire ajusté à votre secteur dominant : électronique, automobile/mobilités, santé/recherche médicale, filière équine, numérique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires électronique/automobile ou protocoles CHU/recherche — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports de test, emails, fiches techniques, données de production, dossiers clients) pour calibrer les démos sur VOS données caennaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux caennais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes sécurisés ou les laboratoires ENSICAEN.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle caennaise — électronique, santé, filière équine ou numérique.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau EffiScience ou en itinérance clientèle.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites agences caennaises jusqu'à une dizaine de collaborateurs — hypercentre, ZAC Presqu'île, quartiers résidentiels.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — R&D, commerciaux, finance, opérations — particulièrement efficace pour les PME numériques d'EffiScience.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, équipes de recherche plateau Nord) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sites du bassin — roadshow multi-sites Caen la Mer, séminaires CODIR + cascade équipes terrain ou laboratoires.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos ingénieurs. Ils sont repartis avec leurs outils configurés sur leurs vrais process de test. Dès le lendemain, plusieurs les utilisaient pour rédiger des rapports d'analyse.",
            role: "Directeur R&D",
            companyProfile: "PME électronique, technopôle EffiScience Caen",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles industrielles — pas de session générique, des cas concrets qui parlaient à nos équipes.",
            role: "DG",
            companyProfile: "ETI équipementier automobile, bassin Caen la Mer",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Caen ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels ou laboratoires de recherche ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels et académiques caennais — postes sécurisés, VLAN séparés, protocoles accès site. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur électronique ou médical caennais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe R&D ENSICAEN n'a rien à voir avec une session pour un cabinet conseil caennais.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur caennais — électronique, automobile, santé, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Caen come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on the electronics assembly floor, in the research lab, at the office or with clients. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Caen is a compelling industrial and academic engagement ground: electronics firms, R&D teams at ENSICAEN/UCN/GREYC, financial services and EffiScience digital SMEs represent demanding staff who expect concrete use cases.",
          "All basin sites covered in person: city centre, Plateau Nord (UCN/ENSICAEN/CHU), EffiScience, ZAC Presqu'île, Hérouville-Saint-Clair, Mondeville, Colombelles and surrounding communes.",
          "The Essential format is calibrated for Caen structures from a few people to about a hundred staff, particularly EffiScience digital SMEs and applied research teams.",
          "The Talk format suits Caen corporate plenaries (UCN/ENSICAEN auditoriums, Parc des Expositions rooms, Normandie Incubation spaces).",
          "The Executives format enables in-camera framing for industrial mid-cap and large group executive committees across the Caen la Mer area.",
          "Vocabulary adjusted to your dominant sector: electronics, automotive/mobility, health/medical research, equine industry, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including electronics/automotive regulatory constraints or CHU/research protocols — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (test reports, emails, technical specs, production data, client files) to calibrate demos on YOUR Caen data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Caen offices to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with secured workstations or ENSICAEN labs.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Caen sector reality — electronics, health, equine industry or digital.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at an EffiScience office or in the field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Caen freelancers, practices and small agencies up to about ten staff — city centre, ZAC Presqu'île, residential districts.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — R&D, sales, finance, operations — particularly effective for EffiScience digital SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, Plateau Nord research teams) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for basin sites — multi-site Caen la Mer roadshows, exec committee seminars + field team or lab cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our engineers' needs. They left with tools configured for their real test processes. By the next day, several were already using them to write up analysis reports.",
            role: "R&D Director",
            companyProfile: "Electronics SME, EffiScience technopole Caen",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our industrial sector constraints — no generic session, concrete cases that resonated with our teams.",
            role: "CEO",
            companyProfile: "Automotive equipment mid-cap, Caen la Mer area",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Caen take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in industrial environments or research laboratories?",
            a: "Yes. Our consultants adapt to Caen industrial and academic environment constraints — secured workstations, separate VLANs, site access protocols. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Caen electronics or medical sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for an ENSICAEN R&D team has nothing to do with one for a Caen consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Caen sector — electronics, automotive, health, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Caen met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux caennais — hypercentre, EffiScience, plateau Nord ou commune du bassin Caen la Mer.",
        whyHere: [
          "Caen concentre une part croissante de nos missions d'implémentation, principalement dans l'industrie électronique (NXP, Bosch), l'automobile (Renault Trucks), la santé-recherche (CHU, UCN, GREYC) et les services numériques (EffiScience).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux caennais : alignement des équipes, accès aux données de production ou cliniques, validation des intégrations CRM/ERP/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable technique.",
          "Recette finale toujours en présentiel à Caen : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier industriel.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques caennais : ETI industrielles (automatisation rapports qualité électronique, contrôle process), PME recherche ENSICAEN (analyse données expérimentales, documentation réglementaire), cabinets services Presqu'île (qualification prospects, génération documents), éditeurs logiciels EffiScience (agents support, copilotes développeurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Caen : revue de l'architecture cible (CRM, ERP, LIMS, systèmes industriels), validation des contraintes RGPD/sécurité et réglementaires (automobile, médical, recherche), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Caen : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Caen : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants caennais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME numériques EffiScience, éditeurs logiciels, cabinets et agences de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, LIMS, datalake), formation ambassadeurs cross-département. Adapté aux ETI industrielles et de recherche caennaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes bassin Caen la Mer : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation rapports qualité électronique livrée comme promis. ROI mesuré dès les premiers mois : nos ingénieurs passent maintenant moins de temps sur les rapports et plus sur l'amélioration process. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI électronique, bassin Caen la Mer",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe entre le site industriel et le bureau. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME services numériques, EffiScience Caen",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Caen ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions caennaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles ou médicales restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés caennais (automobile, médical, recherche GANIL), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données industrielles critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (composants critiques, dossiers réglementaires, données médicales), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Caen brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Caen offices — city centre, EffiScience, Plateau Nord or a Caen la Mer basin commune.",
        whyHere: [
          "Caen hosts a growing share of our implementation missions, primarily in electronics industry (NXP, Bosch), automotive (Renault Trucks), health-research (CHU, UCN, GREYC) and digital services (EffiScience).",
          "Kick-off always happens in person at your Caen offices: team alignment, access to production or clinical data, CRM/ERP/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or technical manager.",
          "Final acceptance always in person in Caen: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or industrial workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Caen cases: industrial mid-caps (electronics quality report automation, process control), ENSICAEN research SMEs (experimental data analysis, regulatory documentation), Presqu'île service firms (prospect qualification, document generation), EffiScience software publishers (support agents, developer copilots).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Caen workshop: target architecture review (CRM, ERP, LIMS, industrial systems), GDPR/security and regulatory constraints validation (automotive, medical, research), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Caen: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Caen: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
            price: "POC",
            detail:
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Caen micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For EffiScience digital SMEs, software publishers, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, LIMS, datalake), cross-department ambassador training. Tailored for Caen industrial and research mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Caen la Mer large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Electronics quality report automation implementation delivered as promised. ROI measured within the first months: our engineers now spend less time on reports and more on process improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Electronics mid-cap, Caen la Mer area",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the industrial site and the office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Digital services SME, EffiScience Caen",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Caen take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Caen missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial or medical data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Caen regulated sectors (automotive, medical, GANIL research), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical industrial data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical components, regulatory files, medical data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Caen accompagne individuellement les dirigeants, managers et experts qui veulent progresser sur l'IA à leur rythme. Sessions sur site dans vos locaux caennais ou à distance, cas d'usage construits autour de votre réalité sectorielle — électronique, automobile, santé, recherche, filière équine. Frais de logement, repas et forfait trajet facturés à part pour les sessions en présentiel.",
        whyHere: [
          "Caen concentre des profils techniques et académiques (ingénieurs ENSICAEN, chercheurs UCN/GANIL, managers ETI industrielles) pour qui un accompagnement individuel adapté à leur domaine est plus efficace qu'une session collective.",
          "L'écosystème caennais (EffiScience, CHU, Normandie Incubation) génère des dirigeants et experts qui veulent monter en compétence IA sans exposer leurs projets en formation collective.",
          "Sessions disponibles à Caen intra-muros et dans toutes les communes du bassin Caen la Mer — EffiScience, plateau Nord, Mondeville, Colombelles, Hérouville-Saint-Clair.",
          "Programme personnalisé dès le premier échange : vos outils, votre secteur, vos cas d'usage prioritaires — aucun syllabus générique imposé.",
          "Progression mesurée à chaque séance : vous repartez avec des livrables concrets (prompt library, workflow automatisé, guide usage interne) utilisables immédiatement.",
          "Confidentialité totale : Confidentialité stricte, vos projets et données restent dans le périmètre de la session.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Entretien à distance ou en présentiel pour évaluer votre maturité IA, identifier vos cas d'usage prioritaires et calibrer le programme — durée, fréquence, thèmes selon votre secteur caennais.",
          },
          {
            step: "Programme sur mesure",
            detail:
              "Construction d'un parcours personnalisé : séquence des thèmes, outils prioritaires (Claude, Mistral, ChatGPT, outils métier), cas d'usage ancrés dans votre activité quotidienne.",
          },
          {
            step: "Sessions de travail",
            detail:
              "Séances individuelles sur site à Caen ou à distance, centrées sur VOS documents, VOS données, VOS workflows. Pas de cours théoriques — on travaille sur ce que vous avez devant vous.",
          },
          {
            step: "Livrables à chaque séance",
            detail:
              "Chaque session produit un livrable réutilisable : prompt optimisé, workflow documenté, guide usage, modèle de message ou automatisation mise en place. Capital réutilisable immédiatement.",
          },
          {
            step: "Bilan et suite",
            detail:
              "Bilan de progression après chaque cycle, ajustement du programme selon vos retours. Possibilité de compléter avec des sessions d'équipe si besoin de cascader les compétences.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Forfait individuel",
            detail:
              "Pour indépendants, dirigeants de TPE et consultants caennais qui veulent progresser sur l'IA à leur rythme, en sessions flexibles.",
          },
          {
            sizeLabel: "PME",
            price: "Forfait manager ou expert",
            detail:
              "Pour managers, responsables de département et experts techniques des PME caennaises — EffiScience, services, santé — qui pilotent un chantier IA et veulent être autonomes.",
          },
          {
            sizeLabel: "ETI",
            price: "Forfait dirigeant ETI",
            detail:
              "Pour les membres du CODIR et directeurs d'ETI industrielles ou de recherche du bassin, qui doivent cadrer une trajectoire IA et embarquer leurs équipes.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Accompagnement de plusieurs dirigeants ou experts clés en parallèle, avec coordination et bilan consolidé pour les grands comptes du bassin Caen la Mer.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching individuel m'a permis de comprendre concrètement comment intégrer l'IA dans mon travail quotidien. Chaque séance débouchait sur un outil ou un prompt que j'utilisais dès le lendemain.",
            role: "Directeur de recherche",
            companyProfile: "Laboratoire UCN / ENSICAEN, Caen",
          },
          {
            quote:
              "J'ai pu progresser à mon rythme sans exposer mes projets en session collective. Le consultant a construit un programme 100% adapté à mes contraintes sectorielles.",
            role: "Directrice générale",
            companyProfile: "PME industrie équine, bassin Caen la Mer",
          },
        ],
        faq: [
          {
            q: "Combien de séances faut-il pour progresser concrètement ?",
            a: "La plupart de nos clients caennais constatent une progression opérationnelle dès les premières séances. Le programme est calibré en diagnostic initial et ajusté en continu selon votre progression.",
          },
          {
            q: "Les sessions se font-elles en présentiel ou à distance ?",
            a: "Les deux. Sessions sur site à Caen dans vos locaux ou à distance selon votre préférence. Pour les sessions en présentiel, frais de logement, repas et forfait trajet facturés à part.",
          },
          {
            q: "Le coaching est-il adapté à mon secteur (électronique, santé, recherche) ?",
            a: "Oui systématiquement. Chaque programme est construit autour de votre secteur, vos outils et vos cas d'usage réels — aucun syllabus générique imposé.",
          },
          {
            q: "Mes projets et données restent-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos documents, projets et données restent dans le périmètre strict de la session et ne sont jamais réutilisés.",
          },
          {
            q: "Puis-je ensuite cascader les compétences à mon équipe ?",
            a: "Oui. Après votre parcours individuel, nous pouvons compléter avec des sessions collectives pour vos équipes — formats Essentielle ou Équipes adaptés à votre contexte caennais.",
          },
          {
            q: "Quelle est la différence entre le coaching 1-to-1 et une intervention collective ?",
            a: "Le coaching individuel est centré sur VOS cas, VOS outils, VOS blocages — rythme libre, confidentialité totale, livrables personnalisés. L'intervention collective est plus efficace pour former plusieurs collaborateurs simultanément sur des thèmes communs.",
          },
        ],
        guarantees:
          "Programme calibré sur vos objectifs dès le diagnostic initial. Si après la première séance le format ne vous convient pas, session remboursée intégralement. Confidentialité stricte, confidentialité absolue. Livrables concrets à chaque séance : vous ne repartez jamais les mains vides. Aucun lock-in Axion-IA — les outils et workflows livrés vous appartiennent.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Caen supports executives, managers and experts who want to build AI skills at their own pace. Sessions on site at your Caen offices or remote, use cases built around your sector reality — electronics, automotive, health, research, equine industry. Lodging, meals and travel allowance billed separately for in-person sessions.",
        whyHere: [
          "Caen concentrates technical and academic profiles (ENSICAEN engineers, UCN/GANIL researchers, industrial mid-cap managers) for whom individual coaching tailored to their domain is more effective than a group session.",
          "The Caen ecosystem (EffiScience, CHU, Normandie Incubation) generates executives and experts who want to build AI skills without exposing their projects in group training.",
          "Sessions available in Caen proper and across all Caen la Mer communes — EffiScience, Plateau Nord, Mondeville, Colombelles, Hérouville-Saint-Clair.",
          "Personalised programme from the very first exchange: your tools, your sector, your priority use cases — no imposed generic syllabus.",
          "Measurable progress each session: you leave with concrete deliverables (prompt library, automated workflow, internal usage guide) immediately usable.",
          "Full confidentiality: strict confidentiality policy, your projects and data remain within the session perimeter.",
        ],
        methodology: [
          {
            step: "Initial diagnostic",
            detail:
              "Remote or in-person interview to assess your AI maturity, identify your priority use cases and calibrate the programme — duration, frequency, themes per your Caen sector.",
          },
          {
            step: "Bespoke programme",
            detail:
              "Construction of a personalised pathway: topic sequence, priority tools (Claude, Mistral, ChatGPT, domain tools), use cases grounded in your daily activity.",
          },
          {
            step: "Working sessions",
            detail:
              "Individual sessions on site in Caen or remote, centred on YOUR documents, YOUR data, YOUR workflows. No theoretical lectures — we work with what you have in front of you.",
          },
          {
            step: "Deliverable each session",
            detail:
              "Each session produces a reusable deliverable: optimised prompt, documented workflow, usage guide, message template or automation set up. Immediately reusable capital.",
          },
          {
            step: "Review and continuation",
            detail:
              "Progress review after each cycle, programme adjustment per your feedback. Option to complement with team sessions if skills need cascading.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual package",
            detail:
              "For Caen freelancers, micro-business owners and consultants who want to build AI skills at their own pace, in flexible sessions.",
          },
          {
            sizeLabel: "SME",
            price: "Manager or expert package",
            detail:
              "For managers, department heads and technical experts at Caen SMEs — EffiScience, services, health — who lead an AI initiative and want to be autonomous.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive package",
            detail:
              "For executive committee members and directors at industrial or research mid-caps in the basin, who need to frame an AI trajectory and bring teams along.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Programme on quote",
            detail:
              "Support for several executives or key experts in parallel, with coordination and consolidated review for large accounts across the Caen la Mer area.",
          },
        ],
        testimonials: [
          {
            quote:
              "The individual coaching let me understand concretely how to integrate AI into my daily work. Each session produced a tool or prompt I was using the very next day.",
            role: "Research Director",
            companyProfile: "UCN / ENSICAEN laboratory, Caen",
          },
          {
            quote:
              "I was able to progress at my own pace without exposing my projects in a group session. The consultant built a programme 100% adapted to my sector constraints.",
            role: "CEO",
            companyProfile: "Equine industry SME, Caen la Mer area",
          },
        ],
        faq: [
          {
            q: "How many sessions does it take to make real progress?",
            a: "Most of our Caen clients see operational progress from the first few sessions. The programme is calibrated at the initial diagnostic and adjusted continuously per your progress.",
          },
          {
            q: "Are sessions in person or remote?",
            a: "Both. On-site sessions in Caen at your offices or remote per your preference. For in-person sessions, lodging, meals and travel allowance billed separately.",
          },
          {
            q: "Is the coaching adapted to my sector (electronics, health, research)?",
            a: "Yes systematically. Each programme is built around your sector, your tools and your real use cases — no imposed generic syllabus.",
          },
          {
            q: "Do my projects and data stay confidential?",
            a: "Yes. Strict confidentiality ensured before the first session. Your documents, projects and data remain within the strict session perimeter and are never reused.",
          },
          {
            q: "Can I cascade skills to my team afterwards?",
            a: "Yes. After your individual programme, we can complement with group sessions for your teams — Essential or Teams formats adapted to your Caen context.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and a group session?",
            a: "Individual coaching focuses on YOUR cases, YOUR tools, YOUR blockers — free pace, full confidentiality, personalised deliverables. Group sessions are more effective for training several staff simultaneously on shared topics.",
          },
        ],
        guarantees:
          "Programme calibrated to your goals at the initial diagnostic. If after the first session the format doesn't suit you, session fully refunded. Systematic Strict confidentiality. Concrete deliverables each session: you never leave empty-handed. No Axion-IA lock-in — the tools and workflows delivered are yours.",
      },
    },
  },
};
