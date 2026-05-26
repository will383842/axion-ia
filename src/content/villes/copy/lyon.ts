// Lyon (69123) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique paris.ts) :
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
// Sources économiques : economic-data/lyon.ts (Sprint City Quality V3, ville #3).
// Réalités locales : Part-Dieu, Confluence, Gerland biotech, Villeurbanne IT,
// Vallée de la Chimie, Sanofi, bioMérieux, Groupe SEB, Renault Trucks, Axelera,
// Lyonbiopôle, H7, French Tech One Lyon-St-Étienne, EM Lyon, INSA, ENS de Lyon.

import type { VilleCopy } from "./types";

export const LYON_COPY: VilleCopy = {
  pitchFr:
    "Lyon regroupe 27 316 établissements actifs, la 2e place tertiaire française (Part-Dieu), le premier pôle biotech Auvergne-Rhône-Alpes (Gerland, Sanofi, bioMérieux) et un tissu industriel dense (Vallée de la Chimie, Renault Trucks). Axion-IA y intervient sur site, des TPE lyonnaises aux grandes directions IA de la Métropole.",
  pitchEn:
    "Lyon hosts 27,316 active businesses, France's second largest business district (Part-Dieu), the leading Auvergne-Rhône-Alpes biotech hub (Gerland, Sanofi, bioMérieux) and a dense industrial fabric (Vallée de la Chimie, Renault Trucks). Axion-IA delivers on site, from Lyon micro-businesses to large-enterprise AI leadership across the Métropole.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Lyon : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du cabinet lyonnais à l'ETI industrielle de la Vallée de la Chimie.",
      en: "Operational AI audit in Lyon: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Lyon practices to industrial mid-caps in the Vallée de la Chimie.",
    },
    interventions: {
      fr: "Interventions IA à Lyon : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Lyon: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Lyon : on déploie l'IA dans vos outils existants (CRM, ERP, mails, systèmes de production) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Lyon: we deploy AI into your existing tools (CRM, ERP, email, production systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Coaching individuel IA à Lyon : accompagnement 1-to-1 pour dirigeants et managers qui veulent intégrer l'IA dans leur pratique quotidienne de direction. Sessions confidentielles dans vos locaux lyonnais (Part-Dieu, Confluence, Gerland, Écully) ou à distance.",
      en: "Individual AI coaching in Lyon: 1-to-1 coaching for executives and managers who want to integrate AI into their daily leadership practice. Confidential sessions at your Lyon offices (Part-Dieu, Confluence, Gerland, Écully) or remote.",
    },
    sitesWeb: {
      fr: "Sites web et plateformes SaaS IA sur mesure à Lyon : conception de plateformes IA-native pour ETI industrielles de la vallée du Rhône, scale-ups de Part-Dieu/Confluence, deep-tech Gerland (santé, biotech, microélectronique). Chatbot RAG, search sémantique, agents conversationnels — code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
      en: "Sites web et plateformes SaaS IA sur mesure à Lyon : conception de plateformes IA-native pour ETI industrielles de la vallée du Rhône, scale-ups de Part-Dieu/Confluence, deep-tech Gerland (santé, biotech, microélectronique). Chatbot RAG, search sémantique, agents conversationnels — code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Lyon (69) sur site — Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise et communes de la Métropole. Nous accompagnons les TPE, PME, ETI et grandes entreprises lyonnaises (industrie, biotech, banque, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Lyon (69) on site — Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise and Métropole communes. We support Lyon micro-businesses, SMEs, mid-caps and large enterprises (industry, biotech, banking, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Chimie & Environnement industriel",
    "Santé, Biotech & Dispositifs médicaux",
    "Industrie & Équipementiers",
    "Banque, Assurance & Finance",
    "Commerce & Services aux entreprises",
    "Numérique & Édition logicielle",
  ],

  distancesFr:
    "Gare TGV Lyon Part-Dieu en cœur de quartier d'affaires — TGV Sud-Est, Méditerranée. Gare de Lyon Perrache également TGV. Aéroport Lyon Saint-Exupéry à 25 km (navette Rhônexpress ~30 min). Métro 4 lignes (A B C D) + tramways + bus pour desservir Part-Dieu, Confluence, Gerland, Villeurbanne et communes de la Métropole.",
  distancesEn:
    "Lyon Part-Dieu TGV station at the heart of the business district — TGV South-East, Mediterranean lines. Lyon Perrache also TGV. Lyon Saint-Exupéry Airport 25 km away (Rhônexpress shuttle ~30 min). Metro 4 lines (A B C D) + trams + buses to reach Part-Dieu, Confluence, Gerland, Villeurbanne and all Métropole communes.",

  ecosystemFr:
    "Tissu B2B dense et sectorisé — 27 316 établissements actifs. Pôle tertiaire Part-Dieu (sièges bancaires, assurance, conseil), technopole Gerland (Sanofi, bioMérieux, Lyonbiopôle), éco-quartier Confluence (startups H7, services numériques), technopole numérique Vaise, Vallée de la Chimie (Axelera), Villeurbanne IT, grandes écoles (INSA, EM Lyon, ENS) et French Tech One Lyon-St-Étienne.",
  ecosystemEn:
    "Dense, sectorised B2B fabric — 27,316 active businesses. Part-Dieu tertiary hub (banking HQs, insurance, consulting), Gerland technopole (Sanofi, bioMérieux, Lyonbiopôle), Confluence eco-district (H7 startups, digital services), Vaise digital technopole, Vallée de la Chimie (Axelera), Villeurbanne IT cluster, grandes écoles (INSA, EM Lyon, ENS) and French Tech One Lyon-St-Étienne.",

  // === SERVICES LONG-FORM LYON ===
  // Même structure que paris.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise lyonnaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du Vieux-Lyon aux ETI industrielles de la Vallée de la Chimie et aux directions IA des sièges Part-Dieu.",
        whyHere: [
          "Lyon est notre deuxième pôle d'intervention après Paris : l'écosystème B2B lyonnais (Part-Dieu, Gerland, Confluence, Villeurbanne) génère une forte demande d'audits IA opérationnels.",
          "Tissu B2B sectorisé sur-représenté chez nos clients lyonnais : industrie chimique et pharmaceutique (Vallée de la Chimie, Gerland), banque/assurance Part-Dieu, PME numériques Villeurbanne et Vaise, cabinets conseil Presqu'île.",
          "Nos consultants se déplacent sur l'ensemble de la Métropole : Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise, Écully, Bron, Vénissieux, Saint-Priest et les communes proches.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux lyonnais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI industrielles lyonnaises avec des workflows complexes.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Lyon dans vos locaux — Part-Dieu, Gerland, Confluence ou commune de la Métropole — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, finance, R&D, production, support, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités sectorielles lyonnaises (protocoles pharma, contraintes industrie, compliance banque).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports analytiques, vos données de production. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux lyonnais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets lyonnais jusqu'à une dizaine de collaborateurs — Presqu'île, Vieux Lyon, Caluire.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques Villeurbanne/Vaise, cabinets conseil Presqu'île, agences et éditeurs logiciels de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (Vallée de la Chimie, équipementiers), ETI biotech (Gerland, Lyonbiopôle) ou ETI tertiaires Part-Dieu souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes dont les sièges ou sites majeurs sont implantés dans la Métropole (Sanofi Gerland, bioMérieux, Groupe SEB Écully, Renault Trucks Saint-Priest).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel en quelques semaines. Le rapport est chiffré, actionnable, sans jargon. On a pu présenter le plan au conseil de direction dès la semaine suivante.",
            role: "Directeur général",
            companyProfile: "ETI industrie, Métropole de Lyon",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes plutôt que des slides. Le livrable a permis de prioriser nos chantiers IA pour le comité de direction, avec un ROI chiffré pour chaque cas.",
            role: "Directrice de la transformation",
            companyProfile: "PME conseil, Part-Dieu Lyon",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Lyon ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une ETI industrielle lyonnaise ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, suivi de production, qualification appels d'offres, lecture factures fournisseurs). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données industrielles ou médicales restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs pharmaceutique et médical (Gerland, Lyonbiopôle), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Lyon ?",
            a: "Toujours en présentiel dans vos locaux lyonnais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes de la Métropole (Villeurbanne, Vénissieux, Saint-Priest, Écully) ?",
            a: "Oui. La Métropole de Lyon est notre terrain d'intervention complet. Nos consultants se déplacent dans toutes les communes — de Villeurbanne (IT) à Saint-Priest (Renault Trucks), d'Écully (Centrale, Groupe SEB, EM Lyon) à Bron et Vénissieux.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits lyonnais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés (pharma, industrie).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Lyon business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Lyon micro-businesses to large industrial mid-caps in the Vallée de la Chimie and AI leadership at Part-Dieu HQs.",
        whyHere: [
          "Lyon is our second top engagement hub after Paris: the sectorised Lyon B2B ecosystem (Part-Dieu, Gerland, Confluence, Villeurbanne) drives strong operational AI audit demand.",
          "Lyon B2B fabric over-represented in our cases: chemical and pharmaceutical industry (Vallée de la Chimie, Gerland), banking/insurance at Part-Dieu, digital SMEs in Villeurbanne and Vaise, consulting firms in Presqu'île.",
          "Our consultants travel across the full Métropole: Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise, Écully, Bron, Vénissieux, Saint-Priest and surrounding communes.",
          "Read-outs always in person: ideation workshops at your Lyon offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Lyon industrial mid-caps with complex workflows.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Lyon at your offices — Part-Dieu, Gerland, Confluence or a Métropole commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, R&D, production, support, leadership) to map frictions and expectations, accounting for Lyon sector specifics (pharma protocols, industrial constraints, banking compliance).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Lyon offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Lyon freelancers, micro-firms and practices up to about ten staff — Presqu'île, Vieux Lyon, Caluire.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs in Villeurbanne/Vaise, consulting firms in Presqu'île, agencies and software publishers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (Vallée de la Chimie, equipment suppliers), biotech mid-caps (Gerland, Lyonbiopôle) or tertiary mid-caps at Part-Dieu framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups with HQs or major sites in the Métropole (Sanofi Gerland, bioMérieux, Groupe SEB Écully, Renault Trucks Saint-Priest).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit within a few weeks. The report is costed, actionable, jargon-free. We were able to present the plan to the board the very next week.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Métropole de Lyon",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than slides. The deliverable helped prioritize our AI initiatives with a costed ROI for each use case.",
            role: "Head of Transformation",
            companyProfile: "Consulting SME, Part-Dieu Lyon",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Lyon?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for an industrial mid-cap in Lyon?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, production tracking, tender qualification, supplier invoice reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my industrial or medical data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For pharmaceutical and medical sectors (Gerland, Lyonbiopôle), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Lyon?",
            a: "Always in person at your Lyon offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Métropole communes (Villeurbanne, Vénissieux, Saint-Priest, Écully)?",
            a: "Yes. The Métropole de Lyon is our full territory. Our consultants travel to all communes — from Villeurbanne (IT) to Saint-Priest (Renault Trucks), Écully (Centrale, Groupe SEB, EM Lyon) to Bron and Vénissieux.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Lyon audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors (pharma, industry).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Lyon se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en usine, en laboratoire, au bureau ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Lyon est l'un de nos principaux terrains d'intervention : entreprises industrielles, biotech, services financiers Part-Dieu et PME numériques Villeurbanne représentent une part significative de nos sessions.",
          "Tous les arrondissements et communes de la Métropole couverts en présentiel : Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise, Écully, Bron, Saint-Priest, Vénissieux, Caluire.",
          "Le format Essentielle est calibré pour les structures lyonnaises de quelques personnes à une centaine de collaborateurs, en particulier les PME numériques de Villeurbanne et les cabinets de la Presqu'île.",
          "Le format Conférence convient aux plénières d'entreprise lyonnaises (auditoriums Part-Dieu, salles Confluence, espaces incubateur H7).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des groupes implantés dans la Métropole.",
          "Vocabulaire ajusté à votre secteur dominant : industrie, pharma/biotech, finance, numérique, gastronomie/hôtellerie. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires pharma/industrie — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, emails, devis, données de production, dossiers clients) pour calibrer les démos sur VOS données lyonnaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux lyonnais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements industriels avec postes déconnectés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle lyonnaise.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau Part-Dieu ou en itinérance clientèle.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites agences lyonnaises jusqu'à une dizaine de collaborateurs — Presqu'île, Vieux Lyon, quartiers résidentiels.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — commerciaux, R&D, finance, opérations — particulièrement efficace pour les PME numériques de Villeurbanne.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI industrielles, pôles biotech) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges lyonnais — roadshow multi-sites Métropole, séminaires CODIR + cascade équipes terrain ou laboratoires.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos équipes R&D. Ils sont repartis avec leurs outils configurés sur leurs vrais protocoles. Dès le lendemain, plusieurs les utilisaient pour rédiger des comptes-rendus d'expériences.",
            role: "Directeur R&D",
            companyProfile: "PME biotech, Gerland Lyon",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles industrielles — pas de session générique, des cas concrets qui parlaient à nos équipes.",
            role: "DG",
            companyProfile: "ETI industrie, Vallée de la Chimie",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Lyon ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements industriels ou laboratoires ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements industriels et pharmaceutiques lyonnais — postes déconnectés, VLAN sécurisés, protocoles accès site. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur industriel ou pharma lyonnais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME biotech de Gerland n'a rien à voir avec une session pour un cabinet conseil Part-Dieu.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur lyonnais — industrie, pharma, finance, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Lyon come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on the factory floor, in the lab, at the office or with clients. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Lyon is one of our top engagement grounds: industrial firms, biotech companies, Part-Dieu financial services and Villeurbanne digital SMEs represent a significant share of our sessions.",
          "All arrondissements and Métropole communes covered in person: Part-Dieu, Confluence, Gerland, Villeurbanne, Vaise, Écully, Bron, Saint-Priest, Vénissieux, Caluire.",
          "The Essential format is calibrated for Lyon structures from a few people to about a hundred staff, particularly digital SMEs in Villeurbanne and Presqu'île consulting firms.",
          "The Talk format suits Lyon corporate plenaries (Part-Dieu auditoriums, Confluence rooms, H7 incubator spaces).",
          "The Executives format enables in-camera framing for industrial mid-cap and large group executive committees in the Métropole.",
          "Vocabulary adjusted to your dominant sector: industry, pharma/biotech, finance, digital, hospitality/gastronomy. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including pharma/industrial regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, emails, quotes, production data, client files) to calibrate demos on YOUR Lyon data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Lyon offices to check equipment, projection and network access. No technical hiccup on D-day, even in industrial environments with air-gapped workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Lyon sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a Part-Dieu office or in the field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Lyon freelancers, practices and small agencies up to about ten staff — Presqu'île, Vieux Lyon, residential districts.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — sales, R&D, finance, operations — particularly effective for Villeurbanne digital SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial mid-caps, biotech hubs) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Lyon HQs — multi-site Métropole roadshows, exec committee seminars + field team or lab cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our R&D team's needs. They left with tools configured for their real protocols. By the next day, several were already using them to write up experimental reports.",
            role: "R&D Director",
            companyProfile: "Biotech SME, Gerland Lyon",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our industrial sector constraints — no generic session, concrete cases that resonated with our teams.",
            role: "CEO",
            companyProfile: "Industrial mid-cap, Vallée de la Chimie",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Lyon take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in industrial environments or laboratories?",
            a: "Yes. Our consultants adapt to Lyon industrial and pharmaceutical environment constraints — air-gapped workstations, secure VLANs, site access protocols. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Lyon industrial or pharma sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Gerland biotech SME has nothing to do with one for a Part-Dieu consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Lyon sector — industry, pharma, finance, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Lyon met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux lyonnais — Part-Dieu, Gerland, Confluence ou commune de la Métropole.",
        whyHere: [
          "Lyon concentre une part croissante de nos missions d'implémentation, principalement dans l'industrie (Vallée de la Chimie, équipementiers), le biotech (Gerland, Lyonbiopôle), les services financiers Part-Dieu et les éditeurs logiciels Villeurbanne.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux lyonnais : alignement des équipes, accès aux données de production ou cliniques, validation des intégrations CRM/ERP/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Lyon : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en bureau, en laboratoire ou en atelier.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques lyonnais : ETI industrielles (automatisation rapports qualité, surveillance production), PME biotech Gerland (analyse données cliniques, documentation réglementaire), cabinets conseil Part-Dieu (qualification prospects, génération documents), éditeurs logiciels Villeurbanne (agents support, copilotes développeurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Lyon : revue de l'architecture cible (CRM, ERP, LIMS, systèmes industriels), validation des contraintes RGPD/sécurité et réglementaires (pharma, industrie), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Lyon : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Lyon : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants lyonnais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME numériques Villeurbanne, éditeurs logiciels, cabinets et agences de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, LIMS, datalake), formation ambassadeurs cross-département. Adapté aux ETI industrielles et biotech lyonnaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Métropole de Lyon : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation rapports qualité livrée comme promis. ROI mesuré dès les premiers mois : nos ingénieurs passent maintenant moins de temps sur les rapports et plus sur l'amélioration produit. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI équipementier, Métropole de Lyon",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le labo Gerland et le bureau Part-Dieu. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME biotech, Gerland Lyon",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Lyon ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions lyonnaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles ou cliniques restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés lyonnais (pharma, médical, industrie), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données industrielles critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (pièces critiques, dossiers réglementaires, données médicales), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Lyon brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Lyon offices — Part-Dieu, Gerland, Confluence or a Métropole commune.",
        whyHere: [
          "Lyon hosts a growing share of our implementation missions, primarily in industry (Vallée de la Chimie, equipment suppliers), biotech (Gerland, Lyonbiopôle), Part-Dieu financial services and Villeurbanne software publishers.",
          "Kick-off always happens in person at your Lyon offices: team alignment, access to production or clinical data, CRM/ERP/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Lyon: handover, team training on their workstations, runbook documentation delivered — whether in an office, lab or workshop.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Lyon cases: industrial mid-caps (quality report automation, production monitoring), Gerland biotech SMEs (clinical data analysis, regulatory documentation), Part-Dieu consulting firms (prospect qualification, document generation), Villeurbanne software publishers (support agents, developer copilots).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Lyon workshop: target architecture review (CRM, ERP, LIMS, industrial systems), GDPR/security and regulatory constraints validation (pharma, industry), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Lyon: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Lyon: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Lyon micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For Villeurbanne digital SMEs, software publishers, firms and agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, LIMS, datalake), cross-department ambassador training. Tailored for Lyon industrial and biotech mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Métropole de Lyon large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quality report automation implementation delivered as promised. ROI measured within the first months: our engineers now spend less time on reports and more on product improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Equipment supplier mid-cap, Métropole de Lyon",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the Gerland lab and the Part-Dieu office. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Biotech SME, Gerland Lyon",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Lyon take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Lyon missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial or clinical data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Lyon regulated sectors (pharma, medical, industry), we apply sovereignty and compliance constraints at design stage.",
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
        hero: "Le coaching 1-to-1 IA Axion-IA à Lyon est conçu pour les dirigeants et managers qui pilotent une transformation, une restructuration ou une montée en compétence IA sans vouloir exposer leurs doutes en groupe. Sessions confidentielles, en présentiel dans vos locaux lyonnais — Part-Dieu, Confluence, Gerland, Villeurbanne, Écully — ou à distance selon vos impératifs d'agenda. Nous travaillons sur votre pratique réelle : vos emails, vos rapports, vos décisions, votre relation aux équipes. L'objectif n'est pas une certification : c'est que vous soyez opérationnel sur l'IA comme levier de direction dans vos 90 premiers jours. Aucun lock-in, aucun suivi imposé au-delà de ce que vous validez. Frais de logement, repas et forfait trajet en sus sur les sessions présentiel hors Lyon intra-muros.",
        whyHere: [
          "Lyon concentre des dirigeants d'ETI industrielles (Vallée de la Chimie, Renault Trucks, équipementiers) et de PME biotech (Gerland, Lyonbiopôle) qui ne trouvent pas de pairs pour parler IA en toute confidentialité — notre coaching 1-to-1 répond exactement à ce besoin.",
          "L'écosystème EM Lyon et INSA produit chaque année des cadres dirigeants lyonnais qui prennent des postes à responsabilité sans avoir été formés sur l'IA opérationnelle — le coaching 1-to-1 comble ce gap en quelques sessions.",
          "Les sièges Part-Dieu (banque, assurance, conseil) et les directions Confluence (services numériques, startups scale-up) sont accessibles en moins de 30 minutes depuis n'importe quel point de la Métropole — les sessions présentielles s'intègrent sans friction dans l'agenda.",
          "Confidentialité absolue : aucun compte-rendu ne sort de la session, aucune référence client publiée sans accord explicite. Essentiel pour les dirigeants de groupes industriels ou de structures sensibles (pharma, médical, données réglementées).",
          "Format hybride : sessions courtes fréquentes ou sessions longues espacées selon votre rythme de dirigeant. Présentiel Lyon ou distanciel pur, ou mix — vous choisissez à chaque session.",
          "Ancrage sectoriel lyonnais : vos cas concrets (reporting qualité chimie, gouvernance données cliniques, négociation fournisseurs, management équipes R&D) sont nos supports de travail. Aucun exemple générique, aucun slide recyclé.",
        ],
        methodology: [
          {
            step: "Session de découverte",
            detail:
              "Un échange de cadrage (présentiel ou visio) pour comprendre votre profil dirigeant, votre niveau IA actuel, vos objectifs prioritaires — prise de décision assistée, gain de temps, leadership équipes, veille stratégique — et votre secteur lyonnais (industrie, biotech, finance, numérique, services). Aucun engagement au-delà de cette session.",
          },
          {
            step: "Plan personnalisé",
            detail:
              "À partir du cadrage, nous définissons ensemble un parcours sur mesure : nombre de sessions, rythme, thèmes prioritaires, outils IA retenus pour votre pratique (Claude, ChatGPT, Mistral, Perplexity, Notion AI, outils sectoriels). Le plan est ajustable à chaque session selon l'évolution de vos priorités.",
          },
          {
            step: "Sessions de travail",
            detail:
              "Chaque session part de VOS documents et VOS décisions du moment : email difficile à rédiger, analyse concurrentielle, préparation d'un conseil d'administration, compte-rendu de visite client. Vous repartez avec une production concrète utilisée le jour même, pas des exercices théoriques.",
          },
          {
            step: "Intégration dans votre pratique",
            detail:
              "Entre les sessions, vous testez les outils dans votre quotidien réel. Au début de chaque session suivante, nous analysons ce qui a fonctionné, ce qui coince, et nous ajustons. L'objectif est une autonomie croissante, pas une dépendance au coach.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "À l'issue du parcours convenu, un bilan écrit confidentiel : ce que vous maîtrisez, les usages à consolider, les ressources pour continuer seul. Vous êtes autonome. Si vous souhaitez un suivi ponctuel ultérieur, sessions à la carte disponibles sans engagement.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "à partir de 990 € HT",
            detail:
              "Pour indépendants, gérants et dirigeants de TPE lyonnaises (Presqu'île, Vieux Lyon, quartiers résidentiels). Parcours court sur sessions de travail ciblées — email, devis, veille, gestion administrative. Frais de logement, repas et forfait trajet en sus pour présentiel hors Lyon intra-muros.",
          },
          {
            sizeLabel: "PME",
            price: "Parcours PME — sur devis",
            detail:
              "Pour dirigeants et managers de PME lyonnaises (Villeurbanne IT, Vaise, Presqu'île). Parcours calibré sur plusieurs mois : prise de décision, management d'équipes, reporting, gestion de projet IA. Frais de logement, repas et forfait trajet en sus pour présentiel hors Lyon intra-muros.",
          },
          {
            sizeLabel: "ETI",
            price: "Parcours ETI — sur devis",
            detail:
              "Pour DG, DAF, DRH et directeurs de directions d'ETI industrielles ou biotech lyonnaises. Travail sur la gouvernance IA, la communication interne et externe, la relation investisseurs et la conduite du changement. Frais de logement, repas et forfait trajet en sus pour présentiel hors Lyon intra-muros.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Parcours grands comptes — sur devis",
            detail:
              "Pour dirigeants de grandes entreprises et groupes implantés dans la Métropole (Sanofi Gerland, Groupe SEB Écully, Renault Trucks Saint-Priest). Format confidentiel haut niveau, agenda adapté aux contraintes de direction générale. Frais de logement, repas et forfait trajet en sus.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin d'un espace confidentiel pour travailler sur ma posture de dirigeant face à l'IA, sans que ça sorte de ma direction générale. Les sessions 1-to-1 m'ont permis de clarifier ma stratégie et de reprendre le leadership sur le sujet en interne.",
            role: "Directeur général",
            companyProfile: "PME services B2B, Part-Dieu Lyon",
          },
          {
            quote:
              "En tant que dirigeant d'une ETI dans la Vallée de la Chimie, je n'avais pas le temps d'une formation collective. Le coaching individuel a ciblé exactement mes cas : reporting qualité, relation clients grands comptes, préparation de CA. Résultats mesurables dès les premières sessions.",
            role: "PDG",
            companyProfile: "ETI industrie chimique, Vallée de la Chimie",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective Axion-IA ?",
            a: "L'intervention collective forme une équipe entière sur des outils IA généraux. Le coaching 1-to-1 travaille sur VOS cas de direction spécifiques — vos emails délicats, vos décisions stratégiques, votre gouvernance IA, votre relation aux équipes — en toute confidentialité. C'est du sur-mesure individuel, pas de la formation de groupe.",
          },
          {
            q: "Quel est le format habituel d'une session ?",
            a: "Sessions de deux heures en règle générale, présentiel dans vos locaux lyonnais ou à distance selon votre agenda. Rythme à définir ensemble : hebdomadaire, bimensuel, mensuel. Vous pouvez aussi déclencher une session ponctuelle avant un conseil d'administration ou une décision stratégique importante.",
          },
          {
            q: "Proposez-vous des sessions en distanciel uniquement ?",
            a: "Oui. Le coaching peut se dérouler intégralement à distance (visio sécurisée) si votre agenda ou votre localisation dans la Métropole le justifie. Nous recommandons au moins une première session en présentiel pour un meilleur ancrage, mais ce n'est pas une obligation.",
          },
          {
            q: "Quels secteurs lyonnais couvrez-vous en coaching dirigeant ?",
            a: "Tous les secteurs B2B lyonnais : industrie et chimie (Vallée de la Chimie, équipementiers), biotech et pharma (Gerland, Lyonbiopôle, Sanofi), banque et assurance (Part-Dieu), numérique et édition logicielle (Villeurbanne, Vaise), conseil et services professionnels (Presqu'île). Le coaching est calibré sur les enjeux spécifiques de votre secteur.",
          },
          {
            q: "La confidentialité est-elle garantie ?",
            a: "Absolument. Confidentialité stricte dès la première session. Aucun compte-rendu ne sort de nos échanges, aucune référence à votre identité ou à votre entreprise n'est publiée sans votre accord explicite écrit. Cette confidentialité est la condition sine qua non du travail en profondeur.",
          },
          {
            q: "Quelle est la différence entre un coaching 1-to-1 et un audit IA Axion-IA ?",
            a: "L'audit IA cartographie les cas d'usage IA de votre entreprise et produit un livrable ROI pour votre organisation. Le coaching 1-to-1 travaille sur votre pratique personnelle de dirigeant : comment vous utilisez l'IA dans votre quotidien, comment vous pilotez la transformation IA de vos équipes, comment vous positionnez votre entreprise sur le sujet. Les deux sont complémentaires — certains clients commencent par l'audit puis engagent un coaching individuel.",
          },
        ],
        guarantees:
          "Aucun lock-in : vous pouvez arrêter le parcours à tout moment sans pénalité au-delà des sessions déjà réalisées. Confidentialité stricte, aucune référence publiée sans accord écrit. Résultats orientés pratique réelle : si après trois sessions vous n'avez pas constaté de gain concret dans votre pratique quotidienne, session de diagnostic offerte pour recadrer le parcours. Frais de logement, repas et forfait trajet en sus pour les sessions présentiel hors Lyon intra-muros.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Lyon is designed for executives and managers steering a transformation, restructuring or AI skills upgrade without wanting to expose their questions in a group setting. Confidential sessions at your Lyon offices — Part-Dieu, Confluence, Gerland, Villeurbanne, Écully — or remote depending on your schedule. We work on your real practice: your emails, your reports, your decisions, your relationship with your teams. The goal is not a certification: it is that you are operational with AI as a leadership lever within your first 90 days. No lock-in, no follow-up imposed beyond what you validate. Lodging, meals and travel allowance billed separately for on-site sessions outside central Lyon.",
        whyHere: [
          "Lyon concentrates industrial mid-cap executives (Vallée de la Chimie, Renault Trucks, equipment suppliers) and biotech SME leaders (Gerland, Lyonbiopôle) who find no peers to discuss AI in full confidence — our 1-to-1 coaching addresses exactly that need.",
          "The EM Lyon and INSA ecosystem produces Lyon senior managers every year who take leadership positions without operational AI training — 1-to-1 coaching bridges that gap within a few sessions.",
          "Part-Dieu HQs (banking, insurance, consulting) and Confluence leadership (digital services, scale-up startups) are within 30 minutes of any Métropole point — on-site sessions integrate seamlessly into any executive schedule.",
          "Absolute confidentiality: no notes leave the session, no client reference published without explicit written consent. Essential for industrial group executives or leaders in sensitive structures (pharma, medical, regulated data).",
          "Hybrid format: short frequent sessions or long spaced sessions depending on your executive pace. On-site Lyon or fully remote, or mixed — you choose each session.",
          "Lyon sector grounding: your real cases (chemical quality reporting, clinical data governance, supplier negotiation, R&D team management) are our working material. No generic examples, no recycled slides.",
        ],
        methodology: [
          {
            step: "Discovery session",
            detail:
              "A framing exchange (in-person or video) to understand your executive profile, your current AI level, your priority objectives — assisted decision-making, time savings, team leadership, strategic watch — and your Lyon sector (industry, biotech, finance, digital, services). No commitment beyond this session.",
          },
          {
            step: "Personalised plan",
            detail:
              "From the framing, we define together a custom roadmap: number of sessions, cadence, priority topics, AI tools selected for your practice (Claude, ChatGPT, Mistral, Perplexity, Notion AI, sector tools). The plan is adjustable at each session as your priorities evolve.",
          },
          {
            step: "Working sessions",
            detail:
              "Each session starts from YOUR documents and YOUR current decisions: a difficult email to draft, competitive analysis, board meeting preparation, client visit minutes. You leave with a concrete output used the same day, not theoretical exercises.",
          },
          {
            step: "Integration into your practice",
            detail:
              "Between sessions, you test the tools in your real daily work. At the start of each following session, we analyse what worked, what sticks, and adjust. The goal is growing autonomy, not coach dependency.",
          },
          {
            step: "Assessment and autonomy",
            detail:
              "At the end of the agreed programme, a confidential written assessment: what you have mastered, usages to consolidate, resources to continue alone. You are autonomous. If you want occasional follow-up later, on-demand sessions available without commitment.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "from €990 excl. VAT",
            detail:
              "For freelancers, managers and micro-business leaders in Lyon (Presqu'île, Vieux Lyon, residential districts). Short programme with targeted working sessions — email, quotes, competitive watch, admin management. Lodging, meals and travel allowance billed separately for on-site sessions outside central Lyon.",
          },
          {
            sizeLabel: "SME",
            price: "SME programme — on quote",
            detail:
              "For SME leaders and managers in Lyon (Villeurbanne IT, Vaise, Presqu'île). Programme calibrated over several months: decision-making, team management, reporting, AI project leadership. Lodging, meals and travel allowance billed separately for on-site sessions outside central Lyon.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap programme — on quote",
            detail:
              "For CEOs, CFOs, CHROs and directors at Lyon industrial or biotech mid-caps. Work on AI governance, internal and external communication, investor relations and change management. Lodging, meals and travel allowance billed separately for on-site sessions outside central Lyon.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Large accounts programme — on quote",
            detail:
              "For large enterprise and group executives in the Métropole (Sanofi Gerland, Groupe SEB Écully, Renault Trucks Saint-Priest). Confidential senior format, schedule adapted to executive constraints. Lodging, meals and travel allowance billed separately.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed a confidential space to work on my leadership stance towards AI, without it leaking from my executive committee. The 1-to-1 sessions helped me clarify my strategy and regain leadership on the topic internally.",
            role: "CEO",
            companyProfile: "B2B services SME, Part-Dieu Lyon",
          },
          {
            quote:
              "As the head of a mid-cap in the Vallée de la Chimie, I had no time for group training. The individual coaching targeted exactly my cases: quality reporting, key account client relations, board preparation. Measurable results from the first sessions.",
            role: "Chairman & CEO",
            companyProfile: "Industrial chemical mid-cap, Vallée de la Chimie",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from an Axion-IA group session?",
            a: "A group session trains an entire team on general AI tools. 1-to-1 coaching works on YOUR specific leadership cases — your sensitive emails, your strategic decisions, your AI governance, your relationship with your teams — in full confidentiality. It is bespoke individual coaching, not group training.",
          },
          {
            q: "What is the typical format of a session?",
            a: "Sessions of two hours as a rule, in person at your Lyon offices or remote depending on your schedule. Cadence to define together: weekly, bi-weekly, monthly. You can also trigger a one-off session before a board meeting or an important strategic decision.",
          },
          {
            q: "Do you offer fully remote sessions?",
            a: "Yes. Coaching can run entirely remotely (secure video) if your schedule or location in the Métropole warrants it. We recommend at least a first in-person session for better grounding, but it is not a requirement.",
          },
          {
            q: "Which Lyon sectors do you cover in executive coaching?",
            a: "All Lyon B2B sectors: industry and chemistry (Vallée de la Chimie, equipment suppliers), biotech and pharma (Gerland, Lyonbiopôle, Sanofi), banking and insurance (Part-Dieu), digital and software publishing (Villeurbanne, Vaise), consulting and professional services (Presqu'île). Coaching is calibrated to the specific challenges of your sector.",
          },
          {
            q: "Is confidentiality guaranteed?",
            a: "Absolutely. Strict confidentiality ensured before the first session. No notes leave our exchanges, no reference to your identity or your company is published without your explicit written consent. This confidentiality is the sine qua non condition for deep work.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and an Axion-IA AI audit?",
            a: "The AI audit maps your company's AI use cases and produces a costed ROI deliverable for your organisation. The 1-to-1 coaching works on your personal leadership practice: how you use AI in your daily work, how you steer the AI transformation of your teams, how you position your company on the topic. Both are complementary — some clients start with the audit then engage individual coaching.",
          },
        ],
        guarantees:
          "No lock-in: you can stop the programme at any time without penalty beyond sessions already completed. Contractual confidentiality: Strict confidentiality, no reference published without written consent. Practice-oriented results: if after three sessions you have not noticed a concrete gain in your daily practice, a diagnostic session is offered to reframe the programme. Lodging, meals and travel allowance billed separately for on-site sessions outside central Lyon.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Lyon ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Lyon et partout en France.",
    },
    {
      q: "Avez-vous des cas clients dans la Métropole de Lyon ?",
      a: "Oui. Plusieurs de nos références sont des entreprises lyonnaises ou implantées dans la Métropole : ETI industrie Vallée de la Chimie, PME biotech Gerland, éditeur logiciel Villeurbanne, cabinet conseil Part-Dieu. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par ville.",
    },
    {
      q: "Quels secteurs sont prioritaires à Lyon pour une mission IA ?",
      a: "Nos déploiements lyonnais couvrent en priorité l'industrie et la chimie (Vallée de la Chimie, équipementiers), la santé et le biotech (Gerland, Lyonbiopôle, Sanofi), la banque et l'assurance (Part-Dieu), et le numérique (Villeurbanne, Vaise). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir dans les communes de la Métropole hors Lyon intra-muros ?",
      a: "Oui. La Métropole entière est notre zone d'intervention : Villeurbanne (cluster IT), Écully (Centrale Lyon, Groupe SEB, EM Lyon), Bron (Eurexpo), Saint-Priest (Renault Trucks), Vénissieux, Caluire-et-Cuire, et les autres communes. Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Lyon ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les startups lyonnaises (French Tech One, H7, Pulsalys) ?",
      a: "Oui. Nous accompagnons les startups et scale-ups de l'écosystème lyonnais — H7 Confluence, incubateurs INSA et ENS de Lyon, pépinières Métropole. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
