// Amiens (80021) — contenu éditorial gold standard.
//
// Doctrine respectée (cf. paris.ts) :
//   - Aucun délai chiffré en dur.
//   - Aucun « frais de déplacement intégrés » — frais de logement, repas et
//     forfait trajet facturés en sus pour toutes les interventions sur site.
//   - Durée minimale = 1 journée. Aucune demi-journée.
//   - Aucun prix hardcodé — libellés contextuels uniquement.
//   - Tailles INSEE : TPE / PME / ETI / GE.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE bouclier anti-doorway HCU 2024.
//   - Pas de heroSchema, pas de unAUn (non demandés pour cette ville pilote).
//
// Sources économiques : economic-data/amiens.ts (V3, sprint 2026-05-18).
// Données clés : 4 149 établissements actifs, P&G (2e site mondial Ariel/Dash),
// Valeo Embrayages (transmissions hybrides Mercedes), Nestlé Purina PetCare
// Center R&D Europe, UPJV, UniLaSalle, ESC Amiens, pôle Bioeconomy For Change,
// Cathédrale Notre-Dame UNESCO 1981, Beffroi UNESCO 2005, ville de Jules Verne.

import type { VilleCopy } from "./types";

export const AMIENS_COPY: VilleCopy = {
  pitchFr:
    "Amiens concentre 4 149 établissements actifs, deux sites UNESCO, le 2e site mondial Procter & Gamble (Ariel/Dash) et Valeo Embrayages, centre mondial des transmissions hybrides. Axion-IA intervient sur site pour accompagner TPE, PME, ETI et grandes entreprises amiénoises dans leurs projets IA opérationnels.",
  pitchEn:
    "Amiens hosts 4,149 active businesses, two UNESCO sites, Procter & Gamble's 2nd global plant (Ariel/Dash) and Valeo Embrayages, the world centre for hybrid transmissions. Axion-IA deploys on site to support micro-businesses, SMEs, mid-caps and large enterprises in Amiens with their operational AI projects.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Amiens : nous identifions ce qui peut être automatisé chez vous et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI selon votre taille — de l'artisan TPE aux grands sites industriels P&G et Valeo.",
      en: "Operational AI audit in Amiens: we identify what can be automated at your company and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic depending on your size — from micro-businesses to large industrial sites like P&G and Valeo.",
    },
    interventions: {
      fr: "Interventions IA à Amiens : formats sur site d'une à plusieurs journées selon vos équipes, adaptés au tissu industriel et tertiaire amiénois. Vos collaborateurs repartent avec des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Amiens: on-site formats from one to several days, tailored to Amiens' industrial and service business fabric. Your staff leave with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Amiens : on déploie l'IA dans vos outils existants (CRM, ERP, mails, GMAO) avec ROI chiffré contractuel. Cas typiques amiénois : automatisation qualité sur lignes de production, gestion fournisseurs industriels, support R&D nutrition animale. Vos équipes gardent la main.",
      en: "AI implementation in Amiens: we deploy AI into your existing tools (CRM, ERP, email, CMMS) with contractually-costed ROI. Typical Amiens use cases: quality automation on production lines, industrial supplier management, pet nutrition R&D support. Your teams stay in control.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Amiens : séances sur mesure pour dirigeants et cadres du tissu industriel, agroalimentaire et tertiaire de la Somme et des Hauts-de-France. Adapté aux PME manufacturières, à la logistique et aux ETI du bassin. Frais de logement, repas et forfait trajet en sus pour le présentiel.",
      en: "1-to-1 AI coaching in Amiens: bespoke sessions for executives and managers in manufacturing, agri-food and services businesses across the Somme and Hauts-de-France. Tailored to manufacturing SMEs, logistics and mid-caps in the basin. Lodging, meals and travel allowance billed separately for on-site sessions.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI du bassin amiénois — site vitrine premium pour industrie manufacturière, agroalimentaire et bioéconomie, portail fournisseurs et qualité, dashboard métier connecté à votre CRM/ERP/GMAO. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for SMEs and mid-caps in the Amiens basin — premium showcase site for manufacturing, agri-food and bioeconomy, suppliers and quality portal, business dashboard connected to your CRM/ERP/CMMS. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'experts IA seniors qui intervient à Amiens (80) sur site. Nous accompagnons les TPE, PME, ETI et grandes entreprises du bassin amiénois — industrie manufacturière (P&G, Valeo), R&D (Nestlé Purina), bioéconomie (B4C), commerce et services — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Amiens (80) on site. We support micro-businesses, SMEs, mid-caps and large enterprises in the Amiens basin — manufacturing (P&G, Valeo), R&D (Nestlé Purina), bioeconomy (B4C), trade and services — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "agro, mécanique & santé",

  topSectorsNaf: [
    "Industrie manufacturière & équipement",
    "Commerce, transport & logistique",
    "R&D & bioéconomie",
    "Administration publique & enseignement",
    "Construction & services aux entreprises",
    "Santé & action sociale",
  ],

  distancesFr:
    "Gare d'Amiens en centre-ville : liaison directe Paris Nord en environ 1h06 (Intercités/TER). Aéroport Paris-Charles-de-Gaulle à 130 km. Réseau urbain Amétis (bus + BHNS) pour rejoindre les zones d'activités et le Pôle Jules Verne.",
  distancesEn:
    "Amiens station in the city centre: direct link to Paris Nord in approx. 1h06 (Intercités/TER). Paris-Charles-de-Gaulle airport 130 km. Amétis urban network (bus + BHNS) to reach business parks and Pôle Jules Verne.",

  ecosystemFr:
    "Tissu économique picard ancré sur l'industrie lourde et la R&D : P&G 2e site mondial (Ariel/Dash/Lenor, 1 000+ emplois), Valeo Embrayages centre mondial transmissions hybrides, Nestlé Purina PetCare Center R&D Europe, pôle Bioeconomy For Change (bioéconomie européenne), UPJV 30 000 étudiants, UniLaSalle, ESC Amiens. 4 149 établissements actifs, préfecture de la Somme.",
  ecosystemEn:
    "Picardy economic fabric anchored in heavy industry and R&D: P&G 2nd global site (Ariel/Dash/Lenor, 1,000+ jobs), Valeo Embrayages world centre for hybrid transmissions, Nestlé Purina PetCare Center EU R&D, Bioeconomy For Change cluster, UPJV 30,000 students, UniLaSalle, ESC Amiens. 4,149 active businesses, Somme prefecture.",

  // === SERVICES LONG-FORM AMIENS ===
  // Structure miroir paris.ts — doctrine stricte appliquée.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé chez vous et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des TPE artisanales du bassin amiénois aux sites industriels de grande envergure comme P&G ou Valeo Embrayages.",
        whyHere: [
          "Amiens est une place industrielle de premier plan : P&G y opère son 2e site mondial (Ariel/Dash/Lenor), Valeo y dirige son centre mondial des transmissions hybrides — des grands comptes où l'IA de production et l'automatisation qualité ont un ROI massif.",
          "Le tissu PME/ETI amiénois est dense et varié : distributeurs, prestataires de services industriels, cabinets conseils, sous-traitants aéronautiques en périphérie — autant de structures qui bénéficient d'un audit ciblé sur leurs processus métier.",
          "La présence du pôle Bioeconomy For Change ouvre des cas IA spécifiques : analyse de données R&D, veille scientifique automatisée, gestion de projets bioéconomie multi-partenaires.",
          "Nestlé Purina PetCare Center Amiens, centre R&D européen, illustre les enjeux IA dans la recherche appliquée : automatisation documentaire, accélération des cycles test produit, gestion des données nutritionnelles.",
          "Nos consultants se déplacent sur site à Amiens dans vos locaux, en centre-ville comme sur les zones d'activités nord ou le Pôle Jules Verne. Restitutions toujours en présentiel.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer. Votre plan d'action reste exécutable avec n'importe quel prestataire après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Identification des workflows prioritaires selon votre secteur amiénois.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux à Amiens pour observer les outils utilisés au quotidien et identifier les processus candidats à l'IA — chaînes de production, gestion fournisseurs, reporting, support client.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (opérations, qualité, achats, finance, RH, direction) pour cartographier les frictions et les attentes terrain. Approche adaptée aux cultures industrielles et tertiaires amiénoises.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports qualité, vos bulletins fournisseurs. Pas de slides théoriques — vos données réelles, vos gains visibles.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux amiénois. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable à 6-18 mois calibrée sur votre taille et votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux artisans, indépendants et petites structures amiénoises jusqu'à une dizaine de collaborateurs — commerce, prestation de services, bureau d'études.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles et tertiaires de quelques dizaines à 250 collaborateurs — sous-traitants, distributeurs, prestataires industriels, cabinets.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI souhaitant cadrer une trajectoire IA pluriannuelle — intégrateurs industriels, sociétés de services régionales, groupes en croissance de la métropole amiénoise.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites industriels majeurs (P&G, Valeo, Nestlé Purina) et leurs directions IA souhaitant cadrer une gouvernance centralisée sur le bassin Somme.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit a mis le doigt sur trois processus que nous n'aurions jamais ciblés seuls. Le livrable est chiffré, actionnable, sans jargon industriel inutile. Nous avons priorisé nos chantiers IA pour le prochain budget.",
            role: "Directeur des opérations",
            companyProfile: "PME équipement industriel, zone nord Amiens",
          },
          {
            quote:
              "Méthode pragmatique, démos directement sur nos données de production. Le ROI identifié à 12 mois a convaincu notre direction générale de lancer l'implémentation dès le trimestre suivant.",
            role: "Responsable amélioration continue",
            companyProfile: "ETI manufacturière, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Amiens ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Votre méthode est-elle adaptée aux entreprises industrielles d'Amiens ?",
            a: "Oui. Notre approche terrain s'adapte aux cultures industrielles : entretiens courts sur poste, démos sur données réelles de production ou de gestion fournisseurs, livrable orienté ROI opérationnel. Nous avons accompagné des PME manufacturières, des sous-traitants logistiques et des ETI de services industriels.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise.",
          },
          {
            q: "Comment se déroule la restitution finale à Amiens ?",
            a: "Toujours en présentiel dans vos locaux. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre, plan d'action priorisé et chiffré.",
          },
          {
            q: "Quelle différence avec un cabinet conseil régional classique ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA généralistes. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée, démos sur vos vraies données plutôt que de longues études. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il avoir déjà lancé des projets IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits amiénois sont commandés par des dirigeants ou directeurs opérationnels qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Amiens micro-businesses and craft firms to large industrial sites such as P&G or Valeo Embrayages.",
        whyHere: [
          "Amiens is a top-tier industrial hub: P&G operates its 2nd global plant here (Ariel/Dash/Lenor), Valeo runs its world centre for hybrid transmissions — large accounts where production AI and quality automation deliver massive ROI.",
          "The Amiens SME/mid-cap fabric is dense and varied: distributors, industrial service providers, consulting firms, aeronautics sub-contractors nearby — all structures that benefit from a targeted process audit.",
          "The Bioeconomy For Change cluster opens specific AI use cases: R&D data analysis, automated scientific monitoring, multi-partner bioeconomy project management.",
          "Nestlé Purina PetCare Center Amiens, the European R&D hub, illustrates AI challenges in applied research: document automation, product test cycle acceleration, nutritional data management.",
          "Our consultants travel on site to Amiens, whether to city-centre offices or northern business parks and Pôle Jules Verne. Read-outs always in person.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing. Your action plan remains executable with any vendor after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). Priority workflow identification based on your Amiens sector.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Amiens offices to observe daily tools and identify AI candidate processes — production lines, supplier management, reporting, customer support.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (operations, quality, procurement, finance, HR, leadership) to map frictions and field expectations. Approach adapted to Amiens' industrial and service cultures.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, quality reports, supplier bulletins. No theoretical slides — your real data, your visible gains.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Amiens offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap calibrated to your size and sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Amiens craft businesses, freelancers and small structures up to about ten staff — trade, services, design bureaux.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial and service SMEs of a few dozen to 250 staff — sub-contractors, distributors, industrial service providers, consulting firms.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For mid-caps framing a multi-year AI trajectory — industrial integrators, regional service companies, growing groups in the Amiens metropolitan area.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For major industrial sites (P&G, Valeo, Nestlé Purina) and their AI leadership framing centralised AI governance across the Somme basin.",
          },
        ],
        testimonials: [
          {
            quote:
              "The audit identified three processes we would never have targeted on our own. The deliverable is costed, actionable, free of unnecessary jargon. We prioritised our AI projects for the next budget cycle.",
            role: "Operations Director",
            companyProfile: "Industrial equipment SME, northern Amiens",
          },
          {
            quote:
              "Pragmatic method, demos directly on our production data. The identified 12-month ROI convinced our general management to launch implementation in the following quarter.",
            role: "Continuous Improvement Manager",
            companyProfile: "Manufacturing mid-cap, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Amiens?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Is your method adapted to Amiens' industrial companies?",
            a: "Yes. Our field approach adapts to industrial cultures: short on-site interviews, demos on real production or supplier management data, ROI-oriented deliverable. We have accompanied manufacturing SMEs, logistics sub-contractors and industrial service mid-caps.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty is required.",
          },
          {
            q: "How does the final read-out work in Amiens?",
            a: "Always in person at your offices. Workshop of a few hours with your executive committee or leadership team. You leave with the PDF deliverable in hand, prioritised and costed action plan.",
          },
          {
            q: "What's the difference from a traditional regional consulting firm?",
            a: "Our consultants are former AI practitioners, not generalist MBAs. Public pricing, no six-figure quote to negotiate. Condensed method, demos on your real data rather than lengthy studies. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need prior AI projects to request an audit?",
            a: "No. A large share of our Amiens audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Amiens se déclinent en formats sur site d'une à plusieurs journées selon vos équipes et votre secteur — industrie, commerce, services, R&D. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Amiens et son bassin concentrent un tissu d'entreprises manufacturières et de services où la montée en compétence IA génère des gains opérationnels immédiats : rédaction de rapports qualité, gestion documentaire fournisseurs, suivi de production.",
          "Nos consultants se déplacent sur site à Amiens — centre-ville, zone industrielle nord, Pôle Jules Verne, zones d'activités périphériques. Pas d'aléa logistique.",
          "Le format Essentielle est calibré pour les équipes de quelques personnes à une centaine de collaborateurs, adapté aux TPE artisanales comme aux PME industrielles.",
          "Le format Conférence convient aux plénières d'entreprise et aux séminaires de rentrée : auditoriums d'entreprise, salles de séminaire des hôtels amiénois, campus UPJV ou UniLaSalle.",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction et les CODIR régionaux.",
          "Contenu ajusté à votre secteur dominant : industrie manufacturière, logistique, R&D, commerce de gros, services. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier, les cas d'usage prioritaires — qualité, achats, commercial, RH, reporting.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de commande, rapports qualité, emails fournisseurs, fiches produits) pour calibrer les démos sur VOS données amiénoises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Opérationnel dès le démarrage, sans aléa technique.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Vocabulaire adapté à la culture industrielle ou tertiaire de vos équipes.",
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
              "Idéal artisans, indépendants, petits commerces et petites structures industrielles amiénoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (production, achats, commercial, RH, finance).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif et la taille de votre CODIR.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands sites industriels amiénois : roadshow multi-sites, séminaires CODIR + cascade équipes terrain.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calibré pour notre équipe logistique. Nos collaborateurs sont repartis avec leurs outils IA opérationnels le jour même. Deux semaines plus tard, la moitié les utilisait au quotidien sur leurs tâches réelles.",
            role: "Responsable logistique",
            companyProfile: "PME transport & logistique, bassin amiénois",
          },
          {
            quote:
              "La session dirigeants a aligné notre CODIR en une journée sur la trajectoire IA. Le format condensé, les démos sur nos propres données — aucun consultant traditionnel n'avait su cadrer aussi vite.",
            role: "Directeur général",
            companyProfile: "ETI industrielle, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Amiens ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur industriel d'Amiens ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples, démos. Une session pour un sous-traitant automobile n'a rien à voir avec une session pour un cabinet de services ou un laboratoire R&D.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur industriel ou tertiaire, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Amiens come in on-site formats from one to several days depending on your teams and sector — manufacturing, trade, services, R&D. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Amiens and its basin concentrate manufacturing and service companies where AI upskilling delivers immediate operational gains: quality report writing, supplier document management, production tracking.",
          "Our consultants travel on site to Amiens — city centre, northern industrial zone, Pôle Jules Verne, surrounding business parks. No logistics uncertainty.",
          "The Essential format is calibrated for teams from a few people to about a hundred staff, suited to craft micro-businesses and industrial SMEs alike.",
          "The Talk format suits corporate plenaries and conference seminars: company auditoriums, Amiens hotel seminar rooms, UPJV or UniLaSalle campus.",
          "The Executives format enables in-camera framing for executive committees and regional CODIRs.",
          "Content adjusted to your dominant sector: manufacturing, logistics, R&D, wholesale trade, services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, priority use cases — quality, procurement, sales, HR, reporting.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (purchase orders, quality reports, supplier emails, product sheets) to calibrate demos on YOUR Amiens data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, Wi-Fi access. Operational from the start, no technical hiccup.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Vocabulary adapted to your team's industrial or service culture.",
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
              "Ideal Amiens craft businesses, freelancers, small shops and small industrial structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (production, procurement, sales, HR, finance).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your objective and CODIR size.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large Amiens industrial sites: multi-site roadshows, exec committee + cascade field team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated for our logistics team. Staff left with operational AI tools the same day. Two weeks later, half were using them daily on real tasks.",
            role: "Logistics Manager",
            companyProfile: "Transport & logistics SME, Amiens basin",
          },
          {
            quote:
              "The executive session aligned our CODIR in one day on the AI trajectory. Condensed format, demos on our own data — no traditional consultant had managed to frame this fast.",
            role: "Chief Executive Officer",
            companyProfile: "Industrial mid-cap, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Amiens take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to Amiens' industrial sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples, demos. A session for an automotive sub-contractor has nothing to do with one for a services firm or an R&D lab.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your industrial or service sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Amiens met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux amiénois.",
        whyHere: [
          "Amiens concentre des grands sites industriels (P&G, Valeo, Nestlé Purina) où l'IA de production — contrôle qualité visuel, optimisation planning, prédiction maintenance — génère des économies chiffrées à grande échelle.",
          "Le tissu PME du bassin amiénois — sous-traitants, prestataires de services industriels, distributeurs — bénéficie d'implémentations ciblées sur les cas à ROI rapide : lecture automatique de documents, qualification de leads, automatisation reporting.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux amiénois : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/email/GMAO.",
          "Itérations à distance ensuite avec un point quotidien court en visio, visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Amiens : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise.",
          "Cas typiques amiénois : sous-traitants industriels (lecture automatique de bons de commande), distributeurs (qualification leads entrants), PME services (génération de comptes-rendus), sites R&D (veille scientifique automatisée, gestion documentaire).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Amiens : revue de l'architecture cible (CRM, ERP, mails, GMAO, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Amiens : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe terrain.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie opérateur.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Amiens : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post-déploiement.",
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
              "Implémentation d'un cas d'usage simple — lecture automatique de documents, comptes-rendus, qualification leads — pour les TPE et artisans amiénois.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME industrielles, prestataires de services et distributeurs amiénois.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP industriel, datalake, GMAO), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands sites industriels amiénois (P&G, Valeo, Nestlé Purina) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture automatique de bons de commande livrée comme promis. ROI mesuré à 6 mois : équivalents temps plein libérés sur la saisie administrative, 0 erreur de transcription. Nos équipes ont repris la main dès le premier mois.",
            role: "Directeur administratif et financier",
            companyProfile: "ETI sous-traitant industriel, bassin amiénois",
          },
          {
            quote:
              "Méthode hybride efficace : kick-off intense sur site, puis itérations distantes bien cadrées. Notre DSI n'a jamais été perdu. Les ambassadeurs internes ont pris le relais de façon autonome après la recette.",
            role: "Responsable SI",
            companyProfile: "PME services industriels, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Amiens ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions amiénoises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour les sites industriels ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données de production si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (contrats fournisseurs, données qualité critiques, RH), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Amiens brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Amiens premises.",
        whyHere: [
          "Amiens hosts large industrial sites (P&G, Valeo, Nestlé Purina) where production AI — visual quality control, planning optimisation, predictive maintenance — generates costed savings at scale.",
          "The Amiens basin SME fabric — sub-contractors, industrial service providers, distributors — benefits from targeted implementations on fast-ROI use cases: automatic document reading, lead qualification, reporting automation.",
          "Kick-off always happens in person at your Amiens premises: team alignment, data access, CRM/ERP/email/CMMS integration validation.",
          "Remote iterations afterwards with a short daily on video, monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Amiens: handover, on-workstation team training, runbook documentation delivered.",
          "Typical Amiens use cases: industrial sub-contractors (automatic purchase order reading), distributors (inbound lead qualification), service SMEs (meeting minutes generation), R&D sites (automated scientific monitoring, document management).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Amiens workshop: target architecture review (CRM, ERP, email, CMMS, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Amiens: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your field team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX and operator ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Amiens: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post-deployment monitoring plan.",
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
              "Implementation of a simple use case — automatic document reading, meeting minutes, lead qualification — for Amiens micro-businesses and craft firms.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For Amiens industrial SMEs, service providers and distributors.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy industrial ERP, datalake, CMMS), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for large Amiens industrial sites (P&G, Valeo, Nestlé Purina): cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automatic purchase order reading implementation delivered as promised. ROI measured at 6 months: FTEs freed on administrative input, zero transcription errors. Our teams took over from the first month.",
            role: "Chief Financial Officer",
            companyProfile: "Industrial sub-contracting mid-cap, Amiens basin",
          },
          {
            quote:
              "Effective hybrid method: intense on-site kick-off, then well-structured remote iterations. Our IT manager was never lost. Internal ambassadors took over autonomously after acceptance testing.",
            role: "IT Manager",
            companyProfile: "Industrial services SME, Amiens Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Amiens take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Amiens missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use for industrial sites?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your production data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (supplier contracts, critical quality data, HR), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Amiens accompagne individuellement les dirigeants et cadres des PME industrielles, des entreprises logistiques et du tissu tertiaire des Hauts-de-France. À partir de {{price:intervention-dirigeants|flat}} pour les TPE, chaque programme cible vos cas d'usage réels — gestion de production, documentation fournisseurs, reporting, R&D agroalimentaire. Vous progressez à votre rythme sans lâcher votre activité.",
        whyHere: [
          "Amiens est un bassin industriel où les dirigeants de PME manufacturières (équipement, sous-traitance, agroalimentaire) ont des agendas très chargés : le coaching 1-to-1 s'adapte à leur rythme, en visio ou en présentiel à Amiens.",
          "Le tissu logistique (Longueau, Camon, Glisy) concentre des responsables d'exploitation confrontés à des cas IA concrets : traçabilité, préparation de commandes, reporting automatisé. Le coaching individuel ancre ces sujets dans leur réalité quotidienne.",
          "Les cadres des sites R&D (Nestlé Purina PetCare Center) et du pôle Bioeconomy For Change ont des besoins IA très précis sur la documentation scientifique — le 1-to-1 cible exactement ces enjeux.",
          "Les dirigeants de TPE et PME de services amiénoises (conseil, juridique, formation) qui n'ont pas de DSI bénéficient d'un accompagnement individuel pour intégrer l'IA sans risque dans leurs outils existants.",
          "Séances 100 % flexibles : visio depuis votre bureau ou présentiel dans vos locaux amiénois, centre-ville, Pôle Jules Verne ou zones d'activités.",
          "Aucun lock-in : vous repartez avec votre plan d'action, vos outils installés et votre autonomie — sans dépendance vis-à-vis d'Axion-IA.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Séance d'ouverture pour évaluer votre maturité IA, identifier vos cas d'usage prioritaires (production, reporting, commercial, RH, achats) et vos outils existants dans le contexte amiénois.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Co-construction d'un programme de séances calé sur votre agenda : fréquence (hebdo, bimensuel ou mensuel), format (visio ou présentiel Amiens), sujets et objectifs précis par séance.",
          },
          {
            step: "Séances pratiques sur vos vraies données",
            detail:
              "Chaque session travaille sur vos documents réels — bons de commande, rapports qualité, emails fournisseurs, fiches produit. L'IA est mise en œuvre sur vos fichiers, pas sur des exemples fictifs.",
          },
          {
            step: "Ancrage et mise en pratique",
            detail:
              "Entre les séances, vous expérimentez les outils sur vos cas réels. La séance suivante débute par un debriefing et un ajustement du plan selon vos retours terrain.",
          },
          {
            step: "Bilan et feuille de route",
            detail:
              "En fin de programme, vous recevez une feuille de route personnalisée : cas d'usage priorisés, outils retenus, prochaines étapes pour votre structure amiénoise. Vous repartez pleinement autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Programme d'entrée pour les gérants de TPE, artisans et indépendants du bassin amiénois souhaitant intégrer l'IA dans leur activité quotidienne.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme personnalisé pour dirigeants et cadres des PME industrielles, logistiques et de services du bassin amiénois.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour DG, directeurs opérationnels ou DSI des ETI du bassin Somme souhaitant piloter leur trajectoire IA en connaissance de cause.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de cadres dirigeants et managers des grands sites amiénois (P&G, Valeo, Nestlé Purina) pour des besoins d'acculturation IA individualisés.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis d'identifier concrètement comment l'IA pouvait m'aider sur la gestion documentaire fournisseurs. On a travaillé sur mes vrais fichiers dès la première séance. Résultat concret en quelques semaines.",
            role: "Directeur des achats",
            companyProfile: "PME sous-traitant industriel, zone nord Amiens",
          },
          {
            quote:
              "Format idéal pour un dirigeant sans DSI : les séances sont courtes, focalisées sur mon contexte, et j'ai pu poser toutes mes questions sans filtre. L'autonomie acquise vaut bien plus que la formation.",
            role: "Gérant",
            companyProfile: "TPE services aux entreprises, Amiens centre",
          },
        ],
        faq: [
          {
            q: "Quel est le format des séances 1-to-1 à Amiens ?",
            a: "Les séances se déroulent en visio ou en présentiel dans vos locaux à Amiens (centre-ville, Pôle Jules Verne, zones industrielles). Frais de logement, repas et forfait trajet en sus pour le présentiel.",
          },
          {
            q: "À quelle fréquence se déroulent les séances ?",
            a: "La fréquence est définie ensemble lors du diagnostic initial selon votre rythme et vos objectifs. Hebdomadaire, bimensuelle ou mensuelle — aucun rythme imposé.",
          },
          {
            q: "Le coaching en présentiel est-il possible sur les zones industrielles d'Amiens ?",
            a: "Oui. Nous intervenons sur l'ensemble du bassin amiénois : centre-ville, zone industrielle nord, Pôle Jules Verne, Longueau, Camon, Glisy, Rivery. Frais de trajet facturés en sus.",
          },
          {
            q: "Quels secteurs sont les plus adaptés au coaching 1-to-1 à Amiens ?",
            a: "Tous les secteurs B2B du bassin : industrie manufacturière, logistique, agroalimentaire, R&D, commerce de gros, services aux entreprises. Le coaching s'adapte à votre secteur et à vos cas d'usage réels.",
          },
          {
            q: "Mes informations et données sont-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos données et documents métier ne sortent jamais de la session. Conformité RGPD.",
          },
          {
            q: "Quelle différence entre le coaching 1-to-1 et une intervention collective à Amiens ?",
            a: "L'intervention collective forme une équipe en une journée sur des outils IA généraux. Le coaching 1-to-1 vous accompagne individuellement sur la durée : vous montez en compétence sur vos cas précis et prenez vos décisions IA en toute autonomie.",
          },
        ],
        guarantees:
          "Aucun engagement de durée minimum : vous pilotez le programme séance par séance. Confidentialité stricte. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel. Aucun lock-in : vous repartez avec vos plans d'action et votre autonomie. Si la première séance ne vous apporte pas de valeur concrète, elle est remboursée intégralement.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Amiens individually supports executives and managers at manufacturing SMEs, logistics companies and service firms across Hauts-de-France. Starting from {{price:intervention-dirigeants|compact}} excl. VAT for micro-businesses, each programme targets your real use cases — production management, supplier documentation, reporting, agri-food R&D. You progress at your own pace without halting your operations.",
        whyHere: [
          "Amiens is an industrial basin where manufacturing SME executives have very busy agendas: 1-to-1 coaching adapts to their rhythm, by video or in person in Amiens.",
          "The logistics cluster (Longueau, Camon, Glisy) concentrates operations managers facing concrete AI use cases: traceability, order preparation, automated reporting. Individual coaching anchors these topics in their daily reality.",
          "R&D managers at sites such as Nestlé Purina PetCare Center and the Bioeconomy For Change cluster have very specific AI needs around scientific documentation — 1-to-1 coaching targets these challenges precisely.",
          "Amiens micro-business and SME service owners with no IT manager benefit from individual coaching to safely integrate AI into their existing tools.",
          "100% flexible sessions: video from your desk or in person at your Amiens offices, city centre, Pôle Jules Verne or business parks.",
          "No lock-in: you leave with your action plan, installed tools and full autonomy — no dependency on Axion-IA.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "Opening session to assess your AI maturity, identify priority use cases (production, reporting, sales, HR, procurement) and existing tools in the Amiens context.",
          },
          {
            step: "Personalised progression plan",
            detail:
              "Co-build a session programme fitted to your agenda: frequency (weekly, fortnightly or monthly), format (video or on-site Amiens), topics and precise objectives per session.",
          },
          {
            step: "Practical sessions on your real data",
            detail:
              "Each session works on your real documents — purchase orders, quality reports, supplier emails, product sheets. AI is applied to your files, not fictional examples.",
          },
          {
            step: "Anchoring and practice",
            detail:
              "Between sessions, you experiment with tools on your real cases. The next session starts with a debrief and plan adjustment based on your field feedback.",
          },
          {
            step: "Review and roadmap",
            detail:
              "At programme end, you receive a personalised roadmap: prioritised use cases, retained tools, next steps for your Amiens organisation. You leave fully autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From {{price:intervention-dirigeants|compact}} excl. VAT",
            detail:
              "Entry programme for micro-business owners, craft firms and freelancers in the Amiens basin wishing to integrate AI into their daily activity.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Bespoke programme for executives and managers at industrial, logistics and service SMEs in the Amiens basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Individual support for CEOs, operations directors and CIOs of Somme mid-caps wishing to steer their AI trajectory with full knowledge.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Executive coaching for senior managers at major Amiens sites (P&G, Valeo, Nestlé Purina) requiring individualised AI acculturation.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching helped me identify concretely how AI could help with supplier document management. We worked on my real files from the first session. Concrete results within a few weeks.",
            role: "Procurement Director",
            companyProfile: "Industrial subcontractor SME, northern Amiens",
          },
          {
            quote:
              "Ideal format for a CEO with no IT manager: short sessions, focused on my context, and I could ask every question without filter. The autonomy gained is worth far more than the training.",
            role: "Managing Director",
            companyProfile: "Micro-business B2B services, Amiens city centre",
          },
        ],
        faq: [
          {
            q: "What is the format of 1-to-1 sessions in Amiens?",
            a: "Sessions take place by video or in person at your offices in Amiens (city centre, Pôle Jules Verne, industrial zones). Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "How often are the sessions?",
            a: "Frequency is defined together at the initial diagnostic according to your rhythm and objectives. Weekly, fortnightly or monthly — no imposed schedule.",
          },
          {
            q: "Is on-site coaching possible at Amiens industrial zones?",
            a: "Yes. We cover the full Amiens basin: city centre, northern industrial zone, Pôle Jules Verne, Longueau, Camon, Glisy, Rivery. Travel costs billed separately.",
          },
          {
            q: "Which sectors are best suited to 1-to-1 coaching in Amiens?",
            a: "All B2B sectors in the basin: manufacturing, logistics, agri-food, R&D, wholesale trade, business services. Coaching adapts to your sector and real use cases.",
          },
          {
            q: "Are my information and data kept confidential?",
            a: "Yes. Strict confidentiality from the first session. Your data and business documents never leave the session. GDPR compliant.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and a group session in Amiens?",
            a: "A group session trains a team in one day on general AI tools. 1-to-1 coaching supports you individually over time: you build competency on your specific cases and make AI decisions with full autonomy.",
          },
        ],
        guarantees:
          "No minimum commitment: you drive the programme session by session. Strict confidentiality. Lodging, meals and travel allowance billed separately for on-site sessions. No lock-in: you leave with your action plans and full autonomy. If the first session delivers no concrete value, it is fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Amiens ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Amiens que partout en France.",
    },
    {
      q: "Intervenez-vous sur les zones industrielles d'Amiens (Pôle Jules Verne, zone nord) ?",
      a: "Oui. Nos consultants se déplacent sur l'ensemble du bassin amiénois : centre-ville, zone industrielle nord, Pôle Jules Verne, zones d'activités périphériques (Longueau, Camon, Glisy, Rivery). Toutes nos interventions et audits sont par défaut sur site, dans vos locaux.",
    },
    {
      q: "Travaillez-vous avec les grands sites industriels comme P&G ou Valeo à Amiens ?",
      a: "Nos offres ETI et Grande entreprise sont calibrées pour les sites industriels majeurs du bassin amiénois — grands groupes manufacturiers, équipementiers, centres R&D. L'Audit Stratégique ETI étendu et le Grand programme multi-déploiement couvrent ces besoins en termes de gouvernance IA et de déploiement multi-sites.",
    },
    {
      q: "Quels secteurs accompagnez-vous en priorité à Amiens ?",
      a: "Nos déploiements amiénois couvrent principalement l'industrie manufacturière (équipement, sous-traitance, agroalimentaire), la logistique, la R&D (nutrition animale, bioéconomie), le commerce de gros et les services aux entreprises. Tout secteur B2B est éligible à un audit ou une intervention.",
    },
    {
      q: "Pouvez-vous intervenir sur site à Amiens rapidement ?",
      a: "La date de démarrage est calée avec vous lors du brief de cadrage initial, en fonction de votre besoin et de votre planning. Nous tenons l'engagement contractuel fixé à la signature, quel que soit le format retenu.",
    },
    {
      q: "Accompagnez-vous les structures liées à l'université ou à la recherche à Amiens ?",
      a: "Oui. Nous accompagnons les structures liées à l'UPJV, UniLaSalle, l'ESC Amiens et au pôle Bioeconomy For Change sur leurs cas IA opérationnels — veille scientifique automatisée, gestion documentaire R&D, valorisation de données de recherche. L'offre PME est adaptée aux tailles de structures académiques et de transfer tech.",
    },
  ],
};
