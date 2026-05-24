// Orléans (45234) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/orleans.ts (Sprint City Quality V3, ville #33).
// Réalités locales : Cosmetic Valley (Shiseido R&D Ormes), pharmaceutique (Famar
// Saint-Jean-de-Braye, Servier Gidy), John Deere France (siège Ormes), BRGM siège
// national (La Source), INRAE Centre Val de Loire, CNRS Orléans, Université d'Orléans
// (fondée 1306), Polytech Orléans, Le LAB'O (incubateur numérique), Pôle 45 logistique,
// Val de Loire UNESCO, French Tech Loire Valley.

import type { VilleCopy } from "./types";

export const ORLEANS_COPY: VilleCopy = {
  pitchFr:
    "Orléans regroupe un tissu B2B dense autour de la Cosmetic Valley (Shiseido R&D Ormes, 1er pôle mondial cosmétique), du pharmaceutique (Famar, Servier), du siège France de John Deere, du BRGM national et de l'Université d'Orléans fondée en 1306. Axion-IA intervient sur site, des TPE du Loiret aux grandes directions IA de l'agglomération.",
  pitchEn:
    "Orléans hosts a dense B2B fabric around the Cosmetic Valley (Shiseido R&D Ormes, world's leading cosmetics cluster), pharma (Famar, Servier), John Deere France's HQ, the BRGM national headquarters and the University of Orléans founded in 1306. Axion-IA delivers on site, from Loiret micro-businesses to large-enterprise AI leadership across the agglomération.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Orléans : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du laboratoire pharmaceutique de Saint-Jean-de-Braye au centre de R&D cosmétique d'Ormes.",
      en: "Operational AI audit in Orléans: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Saint-Jean-de-Braye pharma labs to Ormes cosmetics R&D centres.",
    },
    interventions: {
      fr: "Interventions IA à Orléans : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Orléans: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Orléans : on déploie l'IA dans vos outils existants (CRM, ERP, LIMS, systèmes industriels) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Orléans: we deploy AI into your existing tools (CRM, ERP, LIMS, industrial systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Orléans (45) sur site — centre-ville, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet et communes de l'agglomération. Nous accompagnons les TPE, PME, ETI et grandes entreprises orléanaises (cosmétique, pharmaceutique, industrie agro-machinisme, géosciences, numérique) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Orléans (45) on site — city centre, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet and agglomération communes. We support Orléans micro-businesses, SMEs, mid-caps and large enterprises (cosmetics, pharma, agri-machinery, geosciences, digital) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Cosmétique, Parfumerie & R&D",
    "Pharmaceutique & Sous-traitance CDMO",
    "Industrie & Agro-machinisme",
    "Géosciences, Eau & Milieux",
    "Commerce & Services aux entreprises",
    "Numérique & Incubation (Le LAB'O)",
  ],

  distancesFr:
    "Gare d'Orléans-Les Aubrais (Fleury-les-Aubrais, axe POLT Paris-Orléans-Limoges-Toulouse) — Paris à 1h en train. Gare d'Orléans-Centre dessert le cœur de ville. Réseau TAO : 2 lignes de tramway + bus pour rejoindre La Source, Saint-Jean-de-Braye, Ormes, Saran et toute l'agglomération.",
  distancesEn:
    "Orléans-Les Aubrais station (Fleury-les-Aubrais, POLT axis Paris-Orléans-Limoges-Toulouse) — Paris 1 hour by train. Orléans-Centre station serves the city centre. TAO network: 2 tram lines + buses to reach La Source, Saint-Jean-de-Braye, Ormes, Saran and the full agglomération.",

  ecosystemFr:
    "Tissu B2B structuré autour de la Cosmetic Valley (Shiseido R&D Ormes, ~800 entreprises cosmétique-parfumerie), du pharmaceutique (Famar Saint-Jean-de-Braye, Servier Gidy), du siège France de John Deere (Ormes), du BRGM national (La Source), de l'INRAE Centre Val de Loire, du CNRS Orléans, de l'Université d'Orléans (fondée 1306), du Pôle 45 logistique (800+ entreprises) et de Le LAB'O incubateur numérique. French Tech Loire Valley labellisée.",
  ecosystemEn:
    "Structured B2B fabric around the Cosmetic Valley (Shiseido R&D Ormes, ~800 cosmetics-perfume businesses), pharma (Famar Saint-Jean-de-Braye, Servier Gidy), John Deere France HQ (Ormes), BRGM national HQ (La Source), INRAE Centre Val de Loire, CNRS Orléans, University of Orléans (founded 1306), Pôle 45 logistics hub (800+ businesses) and Le LAB'O digital incubator. French Tech Loire Valley labelled.",

  // === SERVICES LONG-FORM ORLÉANS ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise orléanaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre-ville aux ETI cosmétiques et pharmaceutiques de l'agglomération, en passant par les directions IA des groupes implantés à Ormes et Saint-Jean-de-Braye.",
        whyHere: [
          "Orléans concentre un tissu B2B rare en région : cosmétique-parfumerie Cosmetic Valley (Shiseido R&D Ormes), pharmaceutique CDMO (Famar Saint-Jean-de-Braye, Servier Gidy), industrie agro-machinisme (John Deere France siège Ormes) — autant de secteurs à fort potentiel d'automatisation IA.",
          "Le BRGM national (La Source), l'INRAE Centre Val de Loire et le CNRS Orléans forment un pôle scientifique de premier plan : nos audits s'adaptent aux processus de documentation et analyse de données propres à la recherche publique.",
          "Nos consultants se déplacent sur l'ensemble de l'agglomération : centre-ville, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet, La Chapelle-Saint-Mesmin et Fleury-les-Aubrais.",
          "Restitutions toujours en présentiel dans vos locaux orléanais — atelier avec votre comité de direction, plan d'action remis en main propre, roadmap adaptée aux contraintes réglementaires de votre secteur.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI cosmétiques et pharmaceutiques avec des workflows réglementés (BPF, dossiers AMM, cahiers de laboratoire).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Orléans dans vos locaux — centre-ville, La Source, Saint-Jean-de-Braye, Ormes ou commune de l'agglomération — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (R&D, qualité, réglementaire, commerciaux, finance, production, direction) pour cartographier les frictions et les attentes, en tenant compte des spécificités sectorielles orléanaises (protocoles BPF pharma, compliance cosmétique, contraintes géosciences BRGM).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports analytiques, vos données de production ou de laboratoire. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux orléanais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur et aux contraintes réglementaires locales.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets orléanais jusqu'à une dizaine de collaborateurs — centre-ville, Olivet, La Source.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques du LAB'O, les fournisseurs Cosmetic Valley, les sous-traitants pharmaceutiques et les cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI cosmétiques (Cosmetic Valley), pharmaceutiques (Famar, sous-traitants Servier) ou industrielles (agro-machinisme, logistique Pôle 45) souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes implantés dans l'agglomération (John Deere France Ormes, Servier Gidy, Shiseido Europe Ormes) ou les opérateurs publics (BRGM, INRAE).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel sur nos processus qualité. Le rapport est chiffré, actionnable, et intègre nos contraintes BPF dès la première page. On a pu le présenter au comité de direction sans retraitement.",
            role: "Directeur qualité & réglementaire",
            companyProfile: "ETI pharmaceutique CDMO, Saint-Jean-de-Braye",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données de formulation réelles plutôt que des slides génériques. Le livrable nous a aidés à prioriser nos chantiers IA avec un ROI chiffré par cas d'usage.",
            role: "Responsable innovation",
            companyProfile: "PME cosmétique, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Orléans ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI pharmaceutique ou cosmétique orléanaise ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (dossiers réglementaires, rapports qualité, qualification fournisseurs, documentation R&D). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données de formulation ou données cliniques restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs cosmétique, pharmaceutique et géosciences (BRGM, INRAE), nous appliquons les contraintes de souveraineté et de conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Orléans ?",
            a: "Toujours en présentiel dans vos locaux orléanais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous dans les communes de l'agglomération (Ormes, Saint-Jean-de-Braye, Saran) ?",
            a: "Oui. L'ensemble de l'agglomération orléanaise est notre terrain d'intervention : Ormes (John Deere, Shiseido), Saint-Jean-de-Braye (pharma), Saran (Pôle 45), Olivet, La Chapelle-Saint-Mesmin, Fleury-les-Aubrais et La Source. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits orléanais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés (pharma, cosmétique, géosciences).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Orléans business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Orléans micro-businesses to large cosmetics and pharmaceutical mid-caps in the agglomération and AI leadership at major group HQs in Ormes.",
        whyHere: [
          "Orléans concentrates a rare regional B2B fabric: Cosmetic Valley cosmetics-perfume (Shiseido R&D Ormes), pharmaceutical CDMO (Famar Saint-Jean-de-Braye, Servier Gidy), agri-machinery (John Deere France HQ Ormes) — all sectors with high AI automation potential.",
          "The national BRGM (La Source), INRAE Centre Val de Loire and CNRS Orléans form a leading scientific hub: our audits adapt to documentation and data analysis processes specific to public research.",
          "Our consultants travel across the full agglomération: city centre, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet, La Chapelle-Saint-Mesmin and Fleury-les-Aubrais.",
          "Read-outs always in person at your Orléans offices — workshop with your leadership committee, action plan handed over face to face, roadmap adapted to your sector's regulatory constraints.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for cosmetics and pharma mid-caps with regulated workflows (GMP, marketing authorisation files, lab notebooks).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Orléans at your offices — city centre, La Source, Saint-Jean-de-Braye, Ormes or an agglomération commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (R&D, quality, regulatory, sales, finance, production, leadership) to map frictions and expectations, accounting for Orléans sector specifics (GMP pharma protocols, cosmetics compliance, BRGM geoscience constraints).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production or laboratory data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Orléans offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector and local regulatory constraints.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Orléans freelancers, micro-firms and practices up to about ten staff — city centre, Olivet, La Source.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for LAB'O digital SMEs, Cosmetic Valley suppliers, pharmaceutical sub-contractors and firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For cosmetics mid-caps (Cosmetic Valley), pharma mid-caps (Famar, Servier sub-contractors) or industrial mid-caps (agri-machinery, Pôle 45 logistics) framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups with HQs or major sites in the agglomération (John Deere France Ormes, Servier Gidy, Shiseido Europe Ormes) or public operators (BRGM, INRAE).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit on our quality processes. The report is costed, actionable, and integrates our GMP constraints from page one. We presented it to the board with no rework needed.",
            role: "Quality & Regulatory Director",
            companyProfile: "Pharmaceutical CDMO mid-cap, Saint-Jean-de-Braye",
          },
          {
            quote:
              "Pragmatic method, demos on our real formulation data rather than generic slides. The deliverable helped us prioritise our AI initiatives with a costed ROI per use case.",
            role: "Head of Innovation",
            companyProfile: "Cosmetics SME, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Orléans?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a pharma or cosmetics mid-cap in Orléans?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (regulatory dossiers, quality reports, supplier qualification, R&D documentation). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my formulation or clinical data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For cosmetics, pharma and geoscience sectors (BRGM, INRAE), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Orléans?",
            a: "Always in person at your Orléans offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover agglomération communes (Ormes, Saint-Jean-de-Braye, Saran)?",
            a: "Yes. The full Orléans agglomération is our territory: Ormes (John Deere, Shiseido), Saint-Jean-de-Braye (pharma), Saran (Pôle 45), Olivet, La Chapelle-Saint-Mesmin, Fleury-les-Aubrais and La Source. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Orléans audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors (pharma, cosmetics, geosciences).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Orléans se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en laboratoire, en bureau, en production ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Orléans est un terrain d'intervention B2B diversifié : laboratoires cosmétiques et pharmaceutiques, direction industrielle John Deere, équipes R&D BRGM et INRAE, PME numériques du LAB'O et startups French Tech Loire Valley.",
          "Toutes les communes de l'agglomération couvertes en présentiel : centre-ville, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet, Fleury-les-Aubrais et La Chapelle-Saint-Mesmin.",
          "Le format Essentielle est calibré pour les structures orléanaises de quelques personnes à une centaine de collaborateurs — laboratoires, PME numérique, cabinets conseil, agences.",
          "Le format Conférence convient aux plénières d'entreprise (CO'Met Orléans, auditoriums Le LAB'O, salles de séminaire agglomération).",
          "Le format Dirigeants permet un cadrage stratégique en huis-clos pour les comités de direction des ETI cosmétiques, pharmaceutiques ou industrielles.",
          "Vocabulaire ajusté à votre secteur dominant : cosmétique, pharma/BPF, géosciences, agro-machinisme, numérique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires pharma/cosmétique — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, protocoles laboratoire, emails, données de production) pour calibrer les démos sur VOS données orléanaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux orléanais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements de laboratoire avec postes sécurisés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle orléanaise.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au laboratoire de Saint-Jean-de-Braye ou dans les bureaux d'Ormes.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites agences orléanaises jusqu'à une dizaine de collaborateurs — centre-ville, La Source, Olivet.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — R&D, qualité, réglementaire, commercial, finance — particulièrement efficace pour les PME cosmétiques et numériques du LAB'O.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI pharmaceutiques, pôles cosmétiques) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges orléanais — roadshow multi-sites agglomération, séminaires CODIR + cascade équipes laboratoires ou production.",
          },
        ],
        testimonials: [
          {
            quote:
              "La session Essentielle a parfaitement collé aux attentes de nos équipes réglementaires. Ils sont repartis avec leurs outils configurés sur leurs vrais dossiers. Dès le lendemain, plusieurs rédigeaient leurs rapports deux fois plus vite.",
            role: "Responsable affaires réglementaires",
            companyProfile: "PME pharmaceutique, Saint-Jean-de-Braye",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos spécificités cosmétiques — pas de session générique, des cas concrets qui parlaient à nos équipes de formulation.",
            role: "Directeur général",
            companyProfile: "ETI cosmétique, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Orléans ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements de laboratoire pharmaceutique ou cosmétique ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements de laboratoire — postes sécurisés, VLAN dédiés, protocoles BPF, accès site réglementé. La préparation inclut une vérification des contraintes réseau et sécurité en amont.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur cosmétique ou pharmaceutique orléanais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME de formulation cosmétique n'a rien à voir avec une session pour un service logistique du Pôle 45.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur orléanais — cosmétique, pharma, géosciences, industrie, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Orléans come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in the lab, at the office, on the production floor or with clients. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Orléans is a diverse B2B engagement ground: cosmetics and pharma labs, John Deere industrial management, BRGM and INRAE R&D teams, LAB'O digital SMEs and French Tech Loire Valley startups.",
          "All agglomération communes covered in person: city centre, La Source, Saint-Jean-de-Braye, Ormes, Saran, Olivet, Fleury-les-Aubrais and La Chapelle-Saint-Mesmin.",
          "The Essential format is calibrated for Orléans structures from a few people to about a hundred staff — labs, digital SMEs, consulting firms, agencies.",
          "The Talk format suits corporate plenaries (CO'Met Orléans, LAB'O auditoriums, agglomération seminar rooms).",
          "The Executives format enables in-camera strategic framing for cosmetics, pharma or industrial mid-cap executive committees.",
          "Vocabulary adjusted to your dominant sector: cosmetics, pharma/GMP, geosciences, agri-machinery, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including pharma/cosmetics regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, lab protocols, emails, production data) to calibrate demos on YOUR Orléans data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Orléans offices to check equipment, projection and network access. No technical hiccup on D-day, even in lab environments with secured workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Orléans sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a Saint-Jean-de-Braye lab or Ormes offices.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Orléans freelancers, practices and small agencies up to about ten staff — city centre, La Source, Olivet.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — R&D, quality, regulatory, sales, finance — particularly effective for LAB'O cosmetics and digital SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (pharma mid-caps, cosmetics hubs) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Orléans HQs — multi-site agglomération roadshows, exec committee seminars + lab or production team cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our regulatory team's needs. They left with tools configured for their real dossiers. By the next day, several were drafting reports twice as fast.",
            role: "Head of Regulatory Affairs",
            companyProfile: "Pharmaceutical SME, Saint-Jean-de-Braye",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our cosmetics specificities — no generic session, concrete cases that resonated with our formulation teams.",
            role: "CEO",
            companyProfile: "Cosmetics mid-cap, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Orléans take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in pharma or cosmetics laboratory environments?",
            a: "Yes. Our consultants adapt to lab environment constraints — secured workstations, dedicated VLANs, GMP protocols, regulated site access. Preparation includes an upfront network and security check.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Orléans cosmetics or pharma sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a cosmetics formulation SME has nothing to do with one for a Pôle 45 logistics team.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Orléans sector — cosmetics, pharma, geosciences, industry, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Orléans met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux orléanais — centre-ville, La Source, Saint-Jean-de-Braye, Ormes ou commune de l'agglomération.",
        whyHere: [
          "Orléans concentre une demande croissante de missions d'implémentation dans le cosmétique (Cosmetic Valley, Shiseido R&D), le pharmaceutique CDMO (Famar, sous-traitants Servier), l'industrie agro-machinisme (John Deere) et les opérateurs publics de R&D (BRGM, INRAE).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux orléanais : alignement des équipes, accès aux données de production ou de laboratoire, validation des intégrations CRM/ERP/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Orléans : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier de production.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques orléanais : ETI cosmétiques (automatisation rapports formulation, documentation réglementaire), CDMO pharmaceutiques (qualification lots, rédaction dossiers AMM), équipes R&D BRGM/INRAE (synthèse publications, requêtes bases de données géosciences), PME numériques LAB'O (agents support, copilotes développeurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Orléans : revue de l'architecture cible (CRM, ERP, LIMS, systèmes industriels), validation des contraintes RGPD/sécurité et réglementaires (BPF pharma, cosmétique, géosciences), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Orléans : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Orléans : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants orléanais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP/LIMS. Pour PME cosmétiques Cosmetic Valley, sous-traitants pharma, cabinets et agences numériques du LAB'O.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, LIMS pharmaceutique, bases données géosciences), formation ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes de l'agglomération orléanaise : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation documentation réglementaire livrée comme promis. ROI mesuré dès les premiers mois : nos équipes qualité passent moins de temps sur la rédaction et plus sur l'analyse. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur opérations",
            companyProfile: "ETI CDMO pharmaceutique, Orléans Métropole",
          },
          {
            quote:
              "Mode hybride parfait pour notre équipe R&D dispersée entre le labo et les bureaux. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "Directeur R&D",
            companyProfile: "PME cosmétique, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Orléans ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions orléanaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données de formulation, cliniques ou géoscientifiques restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés orléanais (pharma, cosmétique, géosciences BRGM/INRAE), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données pharmaceutiques ou de formulation critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (lots pharmaceutiques, dossiers réglementaires, données géoscientifiques), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Orléans brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Orléans offices — city centre, La Source, Saint-Jean-de-Braye, Ormes or an agglomération commune.",
        whyHere: [
          "Orléans hosts growing demand for implementation missions in cosmetics (Cosmetic Valley, Shiseido R&D), pharmaceutical CDMO (Famar, Servier sub-contractors), agri-machinery (John Deere) and public R&D operators (BRGM, INRAE).",
          "Kick-off always happens in person at your Orléans offices: team alignment, access to production or lab data, CRM/ERP/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Orléans: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or production workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Orléans cases: cosmetics mid-caps (formulation report automation, regulatory documentation), pharma CDMOs (batch qualification, marketing authorisation dossiers), BRGM/INRAE R&D teams (publication synthesis, geoscience database queries), LAB'O digital SMEs (support agents, developer copilots).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Orléans workshop: target architecture review (CRM, ERP, LIMS, industrial systems), GDPR/security and regulatory constraints validation (GMP pharma, cosmetics, geosciences), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Orléans: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Orléans: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case — quote automation, meeting minutes, lead qualification for Orléans micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP/LIMS integration. For Cosmetic Valley cosmetics SMEs, pharma sub-contractors, LAB'O digital agencies.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, pharma LIMS, geoscience databases), cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for large Orléans agglomération accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Regulatory documentation automation implementation delivered as promised. ROI measured within the first months: our quality teams spend less time on drafting and more on analysis. No lock-in, we control our deployment.",
            role: "Operations Director",
            companyProfile: "Pharmaceutical CDMO mid-cap, Orléans Métropole",
          },
          {
            quote:
              "Perfect hybrid method for our R&D team split between the lab and the offices. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "R&D Director",
            companyProfile: "Cosmetics SME, Orléans Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Orléans take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Orléans missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my formulation, clinical or geoscientific data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Orléans regulated sectors (pharma, cosmetics, BRGM/INRAE geosciences), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical pharma or formulation data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (pharmaceutical batches, regulatory dossiers, geoscientific data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel 1-to-1 Axion-IA à Orléans s'adresse aux dirigeants, managers et experts qui veulent s'approprier l'IA dans leur propre activité — à leur rythme, sur leurs vrais sujets. Format sur site ou hybride selon votre agenda. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Les dirigeants d'ETI cosmétiques et pharmaceutiques orléanaises ont des besoins IA spécifiques (souveraineté data, compliance réglementaire, documentation R&D) que les formats collectifs ne couvrent pas assez finement.",
          "Les experts BRGM, INRAE et université d'Orléans cherchent à industrialiser l'IA dans leurs workflows de recherche — synthèse documentaire, requêtes bases de données, rédaction scientifique.",
          "Format flexible : séances sur site à Orléans, en visio ou hybride selon votre agenda et vos contraintes.",
          "Progression personnalisée : on part de vos cas réels, pas d'un programme générique. Chaque séance est préparée sur vos documents et vos outils.",
          "Réseau Axion-IA : accès aux retours d'expérience d'autres dirigeants et experts de secteurs comparables (cosmétique, pharma, industrie).",
          "Aucun engagement long terme : vous choisissez le nombre de séances selon vos besoins et l'avancement de votre autonomisation.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Séance de cadrage pour identifier vos cas d'usage prioritaires, vos contraintes (sécurité, réglementaire, confidentialité) et votre niveau de maturité IA actuel.",
          },
          {
            step: "Programme personnalisé",
            detail:
              "On construit ensemble un plan de séances adapté à votre rôle (dirigeant, expert R&D, manager) et à votre secteur orléanais (cosmétique, pharma, géosciences, numérique).",
          },
          {
            step: "Séances de travail",
            detail:
              "Chaque séance alterne prise en main d'outils, application sur vos vrais documents et retour critique. Vous progressez sur des cas qui comptent pour vous.",
          },
          {
            step: "Outils installés et configurés",
            detail:
              "Après chaque séance, vous repartez avec des outils opérationnels sur votre poste, paramétrés pour votre usage réel — pas des outils génériques.",
          },
          {
            step: "Bilan et autonomisation",
            detail:
              "En fin de parcours, bilan des acquis, identification des prochains paliers d'autonomie et remise d'une feuille de route personnelle IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Séance individuelle",
            detail:
              "Pour indépendants, consultants et dirigeants de petites structures orléanaises souhaitant progresser sur l'IA à leur propre rythme.",
          },
          {
            sizeLabel: "PME",
            price: "Parcours dirigeant ou manager clé",
            detail:
              "Plusieurs séances pour un dirigeant ou manager PME souhaitant piloter la transformation IA de son équipe avec une vision claire et des outils maîtrisés.",
          },
          {
            sizeLabel: "ETI",
            price: "Parcours CODIR ou expert senior",
            detail:
              "Programme sur mesure pour un membre de CODIR ou expert senior ETI — cadrage stratégique IA, maîtrise des outils, argumentation auprès du conseil.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Accompagnement individuel de cadres dirigeants ou experts clés de grandes entreprises orléanaises (John Deere, Shiseido, BRGM, opérateurs publics).",
          },
        ],
        testimonials: [
          {
            quote:
              "L'accompagnement 1-to-1 m'a permis de comprendre concrètement ce que l'IA peut faire pour notre activité cosmétique — pas de discours générique, des cas de formulation et de documentation réglementaire directement applicables.",
            role: "PDG",
            companyProfile: "PME cosmétique Cosmetic Valley, Orléans",
          },
          {
            quote:
              "Je gère maintenant mes rapports de recherche et mes revues bibliographiques avec des outils IA configurés sur mes propres bases de données. L'accompagnement individuel a été déterminant pour franchir ce palier.",
            role: "Ingénieur de recherche senior",
            companyProfile: "Organisme public de recherche, Orléans-La Source",
          },
        ],
        faq: [
          {
            q: "À qui s'adresse l'accompagnement individuel 1-to-1 Axion-IA à Orléans ?",
            a: "Aux dirigeants, managers et experts qui veulent maîtriser l'IA dans leur propre pratique — PDG de PME cosmétique, directeur R&D pharmaceutique, chercheur BRGM ou INRAE, manager commercial, avocat, consultant. Aucun profil technique requis.",
          },
          {
            q: "Quelle est la durée minimale d'un parcours ?",
            a: "Une séance unique est possible pour un objectif précis. Un parcours d'autonomisation complet se déroule généralement sur plusieurs séances étalées dans le temps, à votre rythme.",
          },
          {
            q: "Les séances se déroulent-elles à Orléans ou à distance ?",
            a: "Les deux sont possibles. Séances sur site dans vos locaux orléanais pour les besoins d'installation d'outils sur poste, ou en visio pour les séances de suivi. Le format hybride est le plus fréquent.",
          },
          {
            q: "Mes échanges et données restent-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès la première séance, aucune donnée partagée avec des tiers, aucune réutilisation de vos cas d'usage dans des formations collectives.",
          },
          {
            q: "Puis-je associer un accompagnement 1-to-1 à un audit ou une implémentation ?",
            a: "Oui, c'est même recommandé. L'accompagnement individuel prépare votre direction à piloter en interne la suite d'un audit ou d'une implémentation IA — vous gagnez en autonomie décisionnelle.",
          },
          {
            q: "Quel est le tarif d'entrée pour un accompagnement 1-to-1 à Orléans ?",
            a: "Le tarif d'entrée est de 990 € HT pour une première séance ou un forfait découverte. Les parcours complets sont sur devis selon le nombre de séances et le profil. Tarifs publics affichés sur la page dédiée.",
          },
        ],
        guarantees:
          "Confidentialité absolue : Confidentialité stricte dès la première séance, données et échanges jamais partagés. Si après la première séance vous estimez que l'accompagnement n'est pas adapté à votre situation, remboursement intégral. Outils opérationnels sur votre poste à l'issue de chaque séance d'installation. Aucun engagement de durée : vous pilotez votre rythme.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 individual coaching in Orléans is aimed at executives, managers and experts who want to master AI in their own practice — at their own pace, on their real subjects. On-site or hybrid format depending on your schedule. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Orléans cosmetics and pharma mid-cap executives have specific AI needs (data sovereignty, regulatory compliance, R&D documentation) that group formats don't cover finely enough.",
          "BRGM, INRAE and University of Orléans experts seek to industrialise AI in their research workflows — document synthesis, database queries, scientific writing.",
          "Flexible format: on-site sessions in Orléans, video call or hybrid depending on your schedule and constraints.",
          "Personalised progression: we start from your real cases, not a generic programme. Each session is prepared on your documents and tools.",
          "Axion-IA network: access to peer experiences from other executives and experts in comparable sectors (cosmetics, pharma, industry).",
          "No long-term commitment: you choose the number of sessions based on your needs and autonomy progress.",
        ],
        methodology: [
          {
            step: "Initial diagnosis",
            detail:
              "Framing session to identify your priority use cases, your constraints (security, regulatory, confidentiality) and your current AI maturity level.",
          },
          {
            step: "Personalised programme",
            detail:
              "We build together a session plan adapted to your role (executive, R&D expert, manager) and your Orléans sector (cosmetics, pharma, geosciences, digital).",
          },
          {
            step: "Working sessions",
            detail:
              "Each session alternates tool handling, application on your real documents and critical feedback. You progress on cases that matter to you.",
          },
          {
            step: "Tools installed and configured",
            detail:
              "After each session, you leave with operational tools on your workstation, set up for your real use — not generic tools.",
          },
          {
            step: "Review and autonomy",
            detail:
              "At the end of the programme, review of acquired skills, identification of next autonomy milestones and a personal AI roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual session",
            detail:
              "For Orléans freelancers, consultants and small-firm executives who want to progress on AI at their own pace.",
          },
          {
            sizeLabel: "SME",
            price: "Executive or key manager programme",
            detail:
              "Several sessions for an SME executive or manager wanting to steer their team's AI transformation with a clear vision and mastered tools.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "ExCo or senior expert programme",
            detail:
              "Custom programme for an ExCo member or senior expert — AI strategic framing, tool mastery, board-level argumentation.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On request",
            detail:
              "Individual coaching for senior executives or key experts at large Orléans companies (John Deere, Shiseido, BRGM, public operators).",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching helped me understand concretely what AI can do for our cosmetics activity — no generic talk, formulation and regulatory documentation cases directly applicable.",
            role: "CEO",
            companyProfile: "Cosmetic Valley SME, Orléans",
          },
          {
            quote:
              "I now manage my research reports and literature reviews with AI tools configured on my own databases. The individual coaching was decisive in crossing that threshold.",
            role: "Senior Research Engineer",
            companyProfile: "Public research organisation, Orléans-La Source",
          },
        ],
        faq: [
          {
            q: "Who is Axion-IA's 1-to-1 individual coaching aimed at in Orléans?",
            a: "Executives, managers and experts who want to master AI in their own practice — cosmetics SME CEO, pharmaceutical R&D director, BRGM or INRAE researcher, sales manager, lawyer, consultant. No technical background required.",
          },
          {
            q: "What is the minimum duration of a programme?",
            a: "A single session is possible for a precise objective. A full autonomy programme generally runs over several sessions spread over time, at your own pace.",
          },
          {
            q: "Do sessions take place in Orléans or remotely?",
            a: "Both are possible. On-site sessions at your Orléans offices for tool installation needs, or video call for follow-up sessions. The hybrid format is most common.",
          },
          {
            q: "Does my information and data remain confidential?",
            a: "Yes. Strict confidentiality from the first session, no data shared with third parties, no reuse of your use cases in group training.",
          },
          {
            q: "Can I combine 1-to-1 coaching with an audit or implementation?",
            a: "Yes, it's even recommended. Individual coaching prepares your leadership to internally steer the follow-up of an AI audit or implementation — you gain decision-making autonomy.",
          },
          {
            q: "What is the entry price for 1-to-1 coaching in Orléans?",
            a: "The entry price is 990 € excl. VAT for a first session or discovery package. Full programmes are quoted based on the number of sessions and profile. Public pricing displayed on the dedicated page.",
          },
        ],
        guarantees:
          "Absolute confidentiality: Strict confidentiality from the first session, data and exchanges never shared. If after the first session you feel the coaching doesn't fit your situation, full refund. Operational tools on your workstation at the end of each installation session. No duration commitment: you set your own pace.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Orléans ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Orléans et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans l'agglomération orléanaise ?",
      a: "Oui. Nous accompagnons des entreprises de l'agglomération orléanaise dans les secteurs cosmétique (Cosmetic Valley), pharmaceutique (Saint-Jean-de-Braye), industrie et numérique (Le LAB'O). Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par secteur.",
    },
    {
      q: "Quels secteurs sont prioritaires à Orléans pour une mission IA ?",
      a: "Nos déploiements orléanais couvrent en priorité le cosmétique-parfumerie (Cosmetic Valley, Shiseido R&D), le pharmaceutique CDMO (Famar, Servier), l'industrie agro-machinisme (John Deere), les géosciences (BRGM, INRAE) et le numérique (LAB'O). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir dans les communes de l'agglomération hors Orléans intra-muros ?",
      a: "Oui. L'agglomération entière est notre zone d'intervention : Ormes (John Deere, Shiseido), Saint-Jean-de-Braye (pharma Famar), Saran (Pôle 45 logistique), Olivet, La Chapelle-Saint-Mesmin, Fleury-les-Aubrais et La Source (BRGM). Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Orléans ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les startups orléanaises (Le LAB'O, French Tech Loire Valley, Village by CA) ?",
      a: "Oui. Nous accompagnons les startups et PME en croissance de l'écosystème orléanais — Le LAB'O incubateur numérique, Village by CA Centre-Loire, French Tech Loire Valley. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],

  heroSchema: {
    centerSubLabel: "Écosystème IA · Loiret · Centre-Val de Loire",
    satellites: [
      {
        label: "Cosmetic Valley",
        detail: "Shiseido R&D Ormes · 1er pôle mondial cosmétique",
        accent: "terracotta",
      },
      {
        label: "Pharmaceutique",
        detail: "Famar CDMO · Servier · Saint-Jean-de-Braye",
        accent: "primary",
      },
      {
        label: "John Deere France",
        detail: "Siège Ormes · agro-machinisme",
        accent: "sage",
      },
      {
        label: "BRGM national",
        detail: "Siège La Source · géosciences",
        accent: "mocha",
      },
      {
        label: "Université d'Orléans",
        detail: "Fondée 1306 · Polytech · ESCEM",
        accent: "primary",
      },
      {
        label: "Le LAB'O",
        detail: "Incubateur numérique · French Tech Loire Valley",
        accent: "sage",
      },
    ],
  },
};
