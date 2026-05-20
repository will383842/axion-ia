// Le Mans — contenu éditorial gold standard (Sprint City Quality V3 2026-05-18).
//
// Doctrine Will 2026-05-08 (respectée intégralement) :
//   - Aucun délai chiffré en dur.
//   - Aucun « frais de déplacement intégrés » — frais logement, repas et
//     forfait trajet toujours mentionnés « en sus » sur les interventions.
//   - Durée minimale = 1 journée. Pas de demi-journée.
//   - Aucun prix hardcodé : libellés uniquement, valeurs viennent de pricing.ts.
//   - Tailles d'entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Pas de heroSchema, pas de unAUn (non demandés pour cette ville).
//
// Réalités Le Mans intégrées :
//   - Capitale mondiale de l'endurance automobile (24 Heures du Mans depuis
//     1923, ACO Automobile Club de l'Ouest) — moteur de l'écosystème mobilité
//     et technologie véhicule du futur (pôle iD4CAR).
//   - Siège historique MMA / groupe Covéa (assurance mutualiste depuis 1828) —
//     pôle tertiaire assurance Novaxis structurant pour la ville.
//   - Site industriel Renault ACI (essieux, trains roulants).
//   - Centre d'excellence acoustique : Le Mans Université + LAUM UMR CNRS 6613
//     + ENSIM (ingénieurs acoustique / IA appliquée).
//   - IGP : Rillettes du Mans, Volailles de Loué. AOP : Maine-Anjou.
//   - 11 301 établissements actifs, 1 944 créations/an (INSEE 2023).
//   - TGV Paris-Montparnasse direct en ~55 min.

import type { VilleCopy } from "./types";

export const LE_MANS_COPY: VilleCopy = {
  pitchFr:
    "Le Mans rassemble 11 301 établissements actifs — de la TPE sarthoise aux sièges MMA/Covéa et Renault ACI — dans un bassin industriel et tertiaire structuré autour de la mobilité, de l'assurance et de la recherche acoustique. Axion-IA y intervient sur site, de la PME locale à l'ETI grand compte.",
  pitchEn:
    "Le Mans brings together 11,301 active businesses — from local micro-firms to MMA/Covéa and Renault ACI HQs — in an industrial and services basin centred on mobility, insurance and acoustic research. Axion-IA delivers on site, from local SMEs to mid-cap key accounts.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel au Mans : nous cartographions vos workflows automatisables et chiffrons le ROI. Quatre niveaux du Flash au Stratégique ETI, calibrés pour la PME sarthoise comme pour les ETI assurance et mobilité du bassin.",
      en: "Operational AI audit in Le Mans: we map your automatable workflows and quantify the ROI. Four tiers from Flash to Mid-cap Strategic, calibrated for local SMEs as well as insurance and mobility mid-caps in the basin.",
    },
    interventions: {
      fr: "Interventions IA au Mans : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent avec des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Le Mans: on-site formats from one to several days depending on your teams. Your staff leave with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA au Mans : déploiement dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Secteurs prioritaires : assurance, automobile, industrie, recherche. Aucun lock-in, vos équipes gardent la main.",
      en: "AI implementation in Le Mans: deployment into your existing tools (CRM, ERP, email) with contractually-costed ROI. Priority sectors: insurance, automotive, manufacturing, research. No lock-in, your teams stay in control.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient au Mans (72) sur site. Nous accompagnons les TPE, PME, ETI et grandes entreprises de la Sarthe — groupes d'assurance (Covéa/MMA), industrie automobile (Renault ACI), PME de services et structures de recherche (LAUM, ENSIM) — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Le Mans (72) on site. We support Sarthe micro-businesses, SMEs, mid-caps and large enterprises — insurance groups (Covéa/MMA), automotive manufacturing (Renault ACI), service SMEs and research organisations (LAUM, ENSIM) — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Assurance & Mutuelles",
    "Automobile & Mobilité",
    "Commerce & Distribution",
    "Activités spécialisées & Conseil",
    "Enseignement & Recherche",
    "Industrie manufacturière",
  ],

  distancesFr:
    "Gare du Mans (TGV Atlantique, Paris-Montparnasse direct en ~55 min). Réseau tramway SETRAM 2 lignes + bus urbains. Aéroport Le Mans-Arnage à 7 km (aviation d'affaires). A11 Paris/Nantes, A81 vers Rennes.",
  distancesEn:
    "Le Mans station (TGV Atlantique, direct Paris-Montparnasse in ~55 min). SETRAM tram network 2 lines + urban buses. Le Mans-Arnage airport 7 km (business aviation). A11 Paris/Nantes motorway, A81 towards Rennes.",

  ecosystemFr:
    "Bassin économique articulé autour de trois piliers : l'assurance mutualiste (siège MMA/Covéa depuis 1828, quartier Novaxis), la mobilité et l'endurance automobile (ACO, pôle iD4CAR, Renault ACI, circuit des 24 Heures), et la recherche acoustique (LAUM CNRS, ENSIM, Le Mans Université ~13 000 étudiants). 11 301 établissements actifs, 1 944 créations par an.",
  ecosystemEn:
    "Economic basin built around three pillars: mutual insurance (MMA/Covéa HQ since 1828, Novaxis business district), automotive mobility and endurance racing (ACO, iD4CAR cluster, Renault ACI, 24 Hours circuit), and acoustic research (LAUM CNRS, ENSIM, Le Mans University ~13,000 students). 11,301 active businesses, 1,944 new incorporations per year.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA au Mans cartographie ce qui peut être automatisé chez vous et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE sartoises aux ETI assurance et mobilité dont le bassin manceau est le siège historique.",
        whyHere: [
          "Le Mans concentre deux écosystèmes B2B à fort potentiel IA : l'assurance (MMA/Covéa, courtiers, mutuelles) et l'industrie automobile/mobilité (Renault ACI, fournisseurs ACO, iD4CAR), deux secteurs dans lesquels la lecture de documents, la qualification de sinistres et la gestion de données industrielles sont des cas d'usage IA immédiats.",
          "Le tissu de PME et ETI de services (transports, logistique, conseil, distribution) représente le gros des 11 301 établissements actifs — périmètre idéal pour l'Audit Ciblé ou Stratégique PME.",
          "La présence de Le Mans Université et du LAUM CNRS crée des passerelles entre la recherche appliquée et les projets IA opérationnels des entreprises du bassin.",
          "Restitutions toujours en présentiel au Mans ou sur site dans vos locaux : ateliers d'idéation, lecture du livrable avec votre comité de direction, plan d'attaque transmis en main propre.",
          "Tarifs publics affichés, aucun devis opaque : vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour signer le NDA et accéder aux quelques documents clés (organigramme, processus, indicateurs). Identification préalable des secteurs métier dominants (assurance, automobile, industrie, services).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue au Mans dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA — de la lecture de sinistres aux bons de commande en passant par les comptes-rendus de réunion.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, finance, RH, opérations, support, direction) pour cartographier finement frictions et attentes dans votre contexte sectoriel sarthois.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos devis, vos pièces de process. Aucune slide théorique — résultats immédiats sur vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur et à votre taille.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets sarthois jusqu'à une dizaine de collaborateurs (artisans, professions libérales, petits commerces).",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour PME de services, sous-traitants automobile, agences, cabinets conseil de quelques dizaines à 250 collaborateurs dans le bassin manceau.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI assurance (courtiers, mutuelles régionales), les ETI industrie automobile et les filiales de groupes souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges Novaxis (MMA/Covéa) et les sites industriels grands-comptes souhaitant cadrer une gouvernance IA centralisée sur plusieurs entités.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré une cartographie précise de nos workflows sinistres automatisables. Le rapport est chiffré, actionnable, sans jargon technique. On a pu présenter le plan à notre comité de direction la semaine suivante.",
            role: "Directeur des opérations",
            companyProfile: "ETI assurance mutualiste, Le Mans",
          },
          {
            quote:
              "Méthode très pragmatique, démos sur nos vraies données de production plutôt que des slides théoriques. Le livrable nous a permis de prioriser trois cas d'usage IA pour l'année et de les budgéter précisément.",
            role: "Responsable transformation digitale",
            companyProfile: "PME industrie automobile, bassin manceau",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA au Mans ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme précis est calé avec vous lors du brief de cadrage initial.",
          },
          {
            q: "Quels secteurs manceaux connaissez-vous le mieux ?",
            a: "Nos équipes sont particulièrement rodées sur l'assurance (lecture de sinistres, qualification de contrats, gestion de docs), l'industrie automobile (bons de commande, suivi qualité, logistique), et les services aux entreprises. Tout secteur B2B avec du volume documentaire ou des workflows répétitifs est éligible.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. NDA signé avant le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée si la souveraineté est requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel au Mans, dans vos locaux. Atelier de quelques heures avec votre comité de direction ou votre équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Différence avec un cabinet de conseil traditionnel ou une ESN locale ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des généralistes conseil. Tarifs publics affichés, pas de devis à négocier pendant des semaines. Méthode condensée, orientée résultat immédiat sur vos vraies données. Aucun lock-in — vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il déjà avoir lancé des projets IA pour solliciter un audit ?",
            a: "Non. Une grande partie de nos audits manceaux sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction et pour identifier le cas d'usage à plus fort ROI pour commencer.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause disponible, jamais activée à ce jour).",
      },
      en: {
        hero: "Axion-IA's AI audit in Le Mans maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from local Sarthe micro-firms to insurance and mobility mid-caps headquartered in the Le Mans basin.",
        whyHere: [
          "Le Mans concentrates two B2B ecosystems with strong AI potential: insurance (MMA/Covéa, brokers, mutual insurers) and automotive/mobility manufacturing (Renault ACI, ACO suppliers, iD4CAR cluster) — both sectors where document reading, claim qualification and industrial data management are immediate AI use cases.",
          "The SME and mid-cap services fabric (transport, logistics, consulting, distribution) accounts for the bulk of the 11,301 active businesses — ideal scope for a Targeted or SME Strategic Audit.",
          "Le Mans University and LAUM CNRS create bridges between applied research and operational AI projects in the basin.",
          "Read-outs always in person in Le Mans at your offices: ideation workshops, deliverable walk-through with your leadership, action plan handed over face to face.",
          "Public pricing, no opaque quotes: you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to sign the NDA and access a few key documents (org chart, processes, KPIs). Prior identification of dominant business sectors (insurance, automotive, manufacturing, services).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit in Le Mans at your offices to observe daily tools and identify AI candidate workflows — from claim reading to purchase orders and meeting minutes.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, HR, operations, support, leadership) to map frictions and expectations in your Sarthe sector context.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, quotes, process documents. No theoretical slides — immediate results on your real documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector and size.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Sarthe freelancers, micro-firms and practices up to about ten staff (artisans, liberal professions, small traders).",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for service SMEs, automotive subcontractors, consulting firms from a few dozen to 250 staff in the Le Mans basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For insurance mid-caps (regional brokers, mutual insurers), automotive manufacturing mid-caps and group subsidiaries framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For Novaxis HQs (MMA/Covéa) and large industrial sites framing centralised AI governance across multiple entities.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a precise map of our automatable claims workflows. The report is costed, actionable, jargon-free. We presented the plan to our executive committee the following week.",
            role: "Head of Operations",
            companyProfile: "Mutual insurance mid-cap, Le Mans",
          },
          {
            quote:
              "Very pragmatic method, demos on our real production data rather than theoretical slides. The deliverable let us prioritise three AI use cases for the year and budget them precisely.",
            role: "Digital Transformation Manager",
            companyProfile: "Automotive manufacturing SME, Le Mans basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Le Mans?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. The precise rhythm is agreed with you at the initial framing brief.",
          },
          {
            q: "Which Le Mans sectors do you know best?",
            a: "Our teams are particularly experienced in insurance (claim reading, contract qualification, document management), automotive manufacturing (purchase orders, quality tracking, logistics), and business services. Any B2B sector with document volume or repetitive workflows is eligible.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. NDA signed before kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra if sovereignty is required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Le Mans at your offices. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a traditional consulting firm or local IT services company?",
            a: "Our consultants are former AI practitioners, not generalist consultants. Public pricing, no weeks of quote negotiation. Condensed method, results-oriented on your real data. No lock-in — you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need existing AI projects to request an audit?",
            a: "No. A large share of our Le Mans audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction and to identify the highest-ROI use case to start with.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA au Mans se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel dans les secteurs assurance, automobile, industrie et services. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Le Mans regroupe des équipes opérationnelles à fort potentiel d'adoption IA : gestionnaires sinistres MMA/Covéa, techniciens et ingénieurs Renault ACI, commerciaux PME de services, équipes administratives des structures universitaires et de recherche.",
          "Le format Essentielle est calibré pour les PME et ETI du bassin (quelques personnes à une centaine de collaborateurs) : sessions ciblées sur les cas métier réels du secteur assurance ou automobile.",
          "Le format Conférence convient aux plénières et séminaires des grandes entités (groupes assurance, sites industriels, campus universitaire).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI sartoises souhaitant aligner leur trajectoire IA avant de déployer.",
          "Vocabulaire ajusté à votre secteur dominant : aucune session générique recyclée — une formation pour une équipe sinistres n'a rien à voir avec une session pour une ligne de production automobile.",
          "Nos consultants se déplacent dans l'ensemble du bassin manceau : Le Mans centre, Novaxis, zone sud/Arnage, communes limitrophes (Coulaines, Allonnes, Champagné, Arnage).",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier dominant (assurance, automobile, industrie, services), les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (sinistres, bons de commande, emails, devis, comptes-rendus) pour calibrer les démos sur VOS données réelles.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès réseau. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs où chaque collaborateur manipule directement les outils.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables dès le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets, petites PME sartoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (gestionnaires sinistres, équipes commerciales, finance, production).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (séminaires ETI assurance ou industrie) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges Novaxis et les sites industriels grands-comptes : roadshows multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement adapté à notre équipe de gestion : nos collaborateurs sont repartis avec leurs outils IA installés et configurés sur leurs propres dossiers sinistres. Taux d'adoption très fort dès la semaine suivante.",
            role: "Responsable formation",
            companyProfile: "ETI assurance, Le Mans",
          },
          {
            quote:
              "Session dirigeants très efficace : en une journée, tout le comité de direction était aligné sur les cas d'usage IA prioritaires pour notre site industriel. Le vocabulaire était parfaitement adapté à notre réalité automobile.",
            role: "Directeur de site",
            companyProfile: "PME équipementier automobile, bassin manceau",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA au Mans ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble lors du cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière et ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui. Ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA — vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur assurance ou automobile ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe sinistres MMA a un contenu totalement différent d'une session pour une ligne de production Renault.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur sarthois, aucune session générique recyclée. Frais de logement, repas et forfait trajet facturés séparément sur devis préalable.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Le Mans come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work in insurance, automotive, manufacturing and services. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Le Mans brings together operational teams with strong AI adoption potential: MMA/Covéa claims managers, Renault ACI engineers and technicians, service SME sales teams, administrative staff in university and research institutions.",
          "The Essential format is calibrated for basin SMEs and mid-caps (a few people to about a hundred staff): sessions focused on real business use cases in insurance or automotive.",
          "The Talk format suits plenaries and seminars at large entities (insurance groups, industrial sites, university campus).",
          "The Executives format enables in-camera framing for Sarthe mid-cap executive committees wishing to align their AI trajectory before deployment.",
          "Vocabulary adjusted to your dominant sector: no recycled generic session — a training for a claims team has nothing to do with a session for an automotive production line.",
          "Our consultants travel across the entire Le Mans basin: Le Mans centre, Novaxis, south zone/Arnage, nearby communes (Coulaines, Allonnes, Champagné, Arnage).",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, dominant business sector (insurance, automotive, manufacturing, services), priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your activity (claims, purchase orders, emails, quotes, meeting minutes) to calibrate demos on YOUR real data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, network access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops where each staff member directly handles the tools.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable from the next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail: "Ideal for Sarthe freelancers, practices and small SMEs up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (claims managers, sales, finance, production).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (insurance or industrial mid-cap seminars) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Novaxis HQs and large industrial sites: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly tailored to our management team: our staff left with their AI tools installed and configured on their own claims files. Very strong adoption rate from the following week.",
            role: "Training Manager",
            companyProfile: "Insurance mid-cap, Le Mans",
          },
          {
            quote:
              "Very effective executive session: in a day, the entire executive committee was aligned on priority AI use cases for our industrial site. The vocabulary was perfectly adapted to our automotive reality.",
            role: "Site Director",
            companyProfile: "Automotive parts SME, Le Mans basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Le Mans take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary and sub-group workshops.",
          },
          {
            q: "Do the installed tools remain usable after the session?",
            a: "Yes. They are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in — you keep control.",
          },
          {
            q: "Can you adapt content to our insurance or automotive sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for an MMA claims team has completely different content from a session for a Renault production line.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Sarthe sector, no recycled generic session. Lodging, meals and travel allowance billed separately on prior quote.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA au Mans met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec kick-off obligatoire au Mans. Secteurs prioritaires : assurance (lecture sinistres, automatisation contrats), automobile et industrie (qualité, logistique, supply chain), services B2B.",
        whyHere: [
          "Le bassin manceau présente des cas d'usage IA à fort volume et ROI immédiat : lecture et qualification de sinistres assurance (MMA/Covéa et courtiers régionaux), gestion documentaire industrielle (bons de commande, contrôle qualité, maintenance prédictive Renault ACI), et workflows administratifs des PME de services.",
          "Le kick-off se passe systématiquement en présentiel au Mans dans vos locaux : alignement des équipes, accès aux données, validation des intégrations avec vos outils existants (CRM, ERP, mails).",
          "Itérations à distance avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel au Mans : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos ambassadeurs internes identifiés — ils deviennent autonomes après la fin de mission, sans dépendance Axion-IA.",
          "Cas typiques manceaux : ETI assurance (qualification automatique sinistres), PME automobile (lecture bons de commande fournisseurs, gestion anomalies qualité), PME services (génération de comptes-rendus, qualification de leads).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Le Mans : revue de l'architecture cible (CRM, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Le Mans : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels (sinistres, bons de commande, emails), ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Le Mans : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring sur plusieurs semaines.",
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
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple (lecture factures, comptes-rendus, qualification leads) pour TPE sartoises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME automobile, services, agroalimentaire de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP assurance, datalake industriel), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pluriannuels pour grands comptes manceaux (sièges Novaxis, sites industriels) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation qualification sinistres livrée comme promis. ROI réel mesuré : nombre d'équivalents temps plein libérés sur le traitement de masse, gain annuel net significatif. Documentation runbook complète, nos équipes sont totalement autonomes.",
            role: "Directeur des systèmes d'information",
            companyProfile: "ETI assurance mutualiste, Le Mans",
          },
          {
            quote:
              "Méthode hybride idéale : kick-off intense sur site, puis itérations à distance avec points courts. Notre équipe industrielle n'a jamais été perdue dans le jargon. Le déploiement est en production sur notre ligne qualité.",
            role: "Responsable technique",
            companyProfile: "PME équipementier automobile, bassin manceau",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA au Mans ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE tient en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme sur une année. Le SOW signé au cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions manceaux. SOW signé au début avec scope précis et livrables définis. Si le scope change, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez également externaliser ailleurs.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). NDA signé en cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des sinistres ou des documents industriels critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (sinistres élevés, contrats critiques, anomalies qualité), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : aucune dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Le Mans brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode, with a mandatory Le Mans kick-off. Priority sectors: insurance (claim reading, contract automation), automotive and manufacturing (quality, logistics, supply chain), B2B services.",
        whyHere: [
          "The Le Mans basin presents high-volume, immediately high-ROI AI use cases: insurance claim reading and qualification (MMA/Covéa and regional brokers), industrial document management (purchase orders, quality control, predictive maintenance at Renault ACI), and administrative workflows for service SMEs.",
          "Kick-off always happens in person in Le Mans at your offices: team alignment, data access, integration validation with your existing tools (CRM, ERP, email).",
          "Remote iterations with a short daily video check-in and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Le Mans: handover, team training on workstations, runbook documentation delivered.",
          "Training included for your identified internal ambassadors — they become autonomous after mission end, with no Axion-IA dependency.",
          "Typical Le Mans cases: insurance mid-caps (automatic claim qualification), automotive SMEs (supplier purchase order reading, quality anomaly management), service SMEs (meeting minute generation, lead qualification).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Le Mans workshop: target architecture review (CRM, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Le Mans: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing (claims, purchase orders, emails), UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Le Mans: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
            price: "POC",
            detail:
              "Implementation of a simple use case (invoice reading, meeting minutes, lead qualification) for Sarthe micro-firms.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For automotive, services, agri-food SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (insurance legacy ERP, industrial datalake), cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Multi-year programs for Le Mans large accounts (Novaxis HQs, industrial sites): cascaded use cases, centralised AI governance, dedicated Axion-IA team.",
          },
        ],
        testimonials: [
          {
            quote:
              "Claim qualification implementation delivered as promised. Real ROI measured: FTEs freed on bulk processing, significant net annual gain. Complete runbook documentation, our teams are fully autonomous.",
            role: "Head of IT",
            companyProfile: "Mutual insurance mid-cap, Le Mans",
          },
          {
            quote:
              "Ideal hybrid method: intense on-site kick-off, then remote iterations with short check-ins. Our industrial team was never lost in jargon. The deployment is live on our quality line.",
            role: "Technical Manager",
            companyProfile: "Automotive parts SME, Le Mans basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Le Mans take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Le Mans missions. SOW signed at the start with precise scope and defined deliverables. If scope changes, explicit amendment and new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). NDA signed at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical claims or industrial documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large claims, critical contracts, quality anomalies), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause and offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel au Mans ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique au Mans qu'ailleurs en France.",
    },
    {
      q: "Avez-vous des références dans le secteur assurance au Mans ?",
      a: "Oui. Nous accompagnons des structures du bassin assurance manceau (ETI mutuelles, courtiers régionaux) sur des cas comme la lecture automatique de sinistres, la qualification de contrats et la génération de comptes-rendus. Les profils clients récents sont consultables dans la rubrique Cas concrets, filtrables par secteur.",
    },
    {
      q: "Pouvez-vous intervenir sur le site industriel Renault ACI ou chez des équipementiers ?",
      a: "Oui. Nos interventions couvrent les sites industriels du bassin manceau : gestion documentaire (bons de commande, fiches qualité), maintenance prédictive, qualification d'anomalies de production. Le format est adapté aux contraintes de sécurité et de confidentialité des sites de production.",
    },
    {
      q: "Travaillez-vous avec Le Mans Université ou le LAUM CNRS ?",
      a: "Nous pouvons accompagner les équipes de Le Mans Université, de l'ENSIM ou du LAUM sur des projets IA appliquée — que ce soit pour automatiser des workflows de recherche, structurer des données acoustiques ou déployer des agents de traitement documentaire. Contactez-nous pour un brief de cadrage.",
    },
    {
      q: "Quels secteurs B2B traitez-vous au Mans ?",
      a: "Nos cas manceaux couvrent principalement l'assurance et les mutuelles, l'industrie automobile et les équipementiers, le transport et la logistique, les services aux entreprises, et les filières agroalimentaires IGP (Rillettes du Mans, Volailles de Loué). Tout secteur B2B avec du volume documentaire ou des processus répétitifs est éligible.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission au Mans ?",
      a: "Le délai de démarrage dépend de votre besoin (urgence, complexité, taille de la mission). Nous convenons d'une date de démarrage avec vous lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],
};
