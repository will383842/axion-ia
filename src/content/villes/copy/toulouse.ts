// Toulouse (31555) — contenu éditorial gold standard.
//
// Doctrine appliquée (identique paris.ts) :
//   - Aucun délai chiffré en jours.
//   - Aucun « frais de déplacement intégrés » : frais en sus, calculés au cas par cas.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Aucun prix hardcodé : tarifs viennent de `src/content/pricing.ts`.
//   - Pas de mention de métier-type : tailles INSEE (PME/ETI/GE).
//   - ~95 % Axion-IA-centric, ~5 % data INSEE bouclier anti-doorway HCU 2024.
//   - Spécificité Toulouse : aérospatiale (Airbus, CNES, Thales Alenia Space,
//     ATR, ONERA), IT (French Tech Toulouse, IoT Valley, Labège-Innopole),
//     grandes écoles (ISAE-SUPAERO, TBS Education, ENAC, Toulouse INP, INSA),
//     agroalimentaire IGP (Saucisse de Toulouse, Ail violet de Cadours).
//   - Pas de heroSchema, pas de unAUn.

import type { VilleCopy } from "./types";

export const TOULOUSE_COPY: VilleCopy = {
  pitchFr:
    "Toulouse regroupe 19 600 entreprises actives, capitale européenne de l'aérospatiale (Airbus, CNES, Thales Alenia Space, ONERA) et quatrième ville de France en termes d'emploi high-tech. Axion-IA y intervient sur site, des PME locales aux ETI et grandes entreprises des pôles Aerospace Valley et Labège-Innopole.",
  pitchEn:
    "Toulouse hosts 19,600 active businesses, Europe's aerospace capital (Airbus, CNES, Thales Alenia Space, ONERA) and France's fourth city for high-tech employment. Axion-IA delivers on site, from local micro-businesses to mid-caps and large enterprises in the Aerospace Valley and Labège-Innopole hubs.",

  seoHook: "aérospatial, deeptech & agro",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Toulouse : nous identifions ce qui peut être automatisé dans votre organisation et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, calibrés pour les structures aérospatiales, IT et agroalimentaires toulousaines.",
      en: "Operational AI audit in Toulouse: we identify what can be automated in your organisation and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated for Toulouse aerospace, IT and agri-food companies.",
    },
    interventions: {
      fr: "Interventions IA à Toulouse : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste, configurés pour leur métier — aéronautique sous-traitance Blagnac, IoT Labège, agro-industriel ou tech Toulouse centre.",
      en: "AI sessions in Toulouse: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA à Toulouse : on déploie l'IA dans vos outils existants (PLM, ERP, mails, documentation technique) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Toulouse: we deploy AI into your existing tools (PLM, ERP, email, technical documentation) with contractually-costed ROI. Your teams stay in control, no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA 1-to-1 à Toulouse : accompagnement individuel pour dirigeants et ingénieurs de l'Aerospace Valley, cadres French Tech Toulouse et responsables des ETI toulousaines. Sessions sur site (Blagnac, Labège, Toulouse centre) ou à distance. Tarif d'entrée {{price:intervention-dirigeants|flat}}.",
      en: "1-to-1 AI coaching in Toulouse: individual coaching for Aerospace Valley executives and engineers, French Tech Toulouse managers and Toulouse mid-cap leaders. On-site sessions (Blagnac, Labège, Toulouse centre) or remote. Entry rate from €990 excl. VAT.",
    },
    sitesWeb: {
      fr: "Sites web et plateformes SaaS IA sur mesure à Toulouse : conception de plateformes IA-native pour ETI aéronautiques sous-traitantes d'Aerospace Valley (Blagnac, Colomiers, Labège), scale-ups French Tech Toulouse, PME agro-industrielles. Chatbot RAG, search sémantique, agents conversationnels — code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
      en: "Sites web et plateformes SaaS IA sur mesure à Toulouse : conception de plateformes IA-native pour ETI aéronautiques sous-traitantes d'Aerospace Valley (Blagnac, Colomiers, Labège), scale-ups French Tech Toulouse, PME agro-industrielles. Chatbot RAG, search sémantique, agents conversationnels — code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Toulouse (31) sur site dans la ville rose et le bassin toulousain (Blagnac, Colomiers, Labège, Tournefeuille). Nous accompagnons les PME, ETI et grands groupes toulousains — acteurs de l'aérospatiale, du numérique, de l'agroalimentaire — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Vos équipes restent maîtres de la stack (modèles, PLM aéronautique, intégrations IoT Valley) après notre mission — sans verrou éditeur ni dépendance contractuelle continue.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Toulouse (31) on site across the city and the greater Toulouse basin (Blagnac, Colomiers, Labège, Tournefeuille). We support Toulouse micro-businesses, SMEs, mid-caps and large enterprises — aerospace, digital, agri-food players — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Aérospatiale & Défense",
    "IT & Numérique (French Tech Toulouse)",
    "Recherche & Développement (CNES, ONERA, CNRS)",
    "Agroalimentaire & IGP",
    "Conseil & Services aux entreprises",
    "Construction & Ingénierie",
  ],

  distancesFr:
    "Gare Toulouse Matabiau en centre-ville (TGV Paris, Bordeaux, Montpellier). Aéroport Toulouse Blagnac à 8 km (hub Airbus, vols directs Europe). Métro lignes A et B + Tisséo tram pour rejoindre vos bureaux dans tous les quartiers, Blagnac, Labège-Innopole et Colomiers.",
  distancesEn:
    "Toulouse Matabiau station in the city centre (TGV Paris, Bordeaux, Montpellier). Toulouse Blagnac Airport 8 km away (Airbus hub, direct European flights). Metro lines A and B + Tisséo tram to reach your offices across all districts, Blagnac, Labège-Innopole and Colomiers.",

  ecosystemFr:
    "Capitale européenne de l'aérospatiale (Airbus siège mondial, CNES, Thales Alenia Space, ATR, ONERA — 40 000+ emplois aéronautiques). French Tech Toulouse active, pôle compétitivité Aerospace Valley, campus IoT Valley, technopole Labège-Innopole. Grandes écoles : ISAE-SUPAERO, ENAC, TBS Education, Toulouse INP, INSA. 19 600 entreprises actives, 13 800 créations/an.",
  ecosystemEn:
    "European aerospace capital (Airbus world HQ, CNES, Thales Alenia Space, ATR, ONERA — 40,000+ aerospace jobs). Active French Tech Toulouse, Aerospace Valley competitiveness cluster, IoT Valley campus, Labège-Innopole tech park. Leading schools: ISAE-SUPAERO, ENAC, TBS Education, Toulouse INP, INSA. 19,600 active businesses, 13,800 new companies created per year.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des PME toulousaines aux divisions des grands groupes aérospatiaux du bassin.",
        whyHere: [
          "Toulouse est la capitale européenne de l'aérospatiale : nos consultants connaissent les processus PLM, documentation technique et cycles de conformité qui caractérisent les acteurs de l'Aerospace Valley.",
          "Tissu numérique dense — French Tech Toulouse, IoT Valley à Labège, startups ESA BIC Sud France : nous auditons aussi bien les scale-ups IA émergentes que les sous-traitants Tier 1 et Tier 2 de la chaîne aéronautique.",
          "Restitutions toujours en présentiel à Toulouse ou dans le bassin (Blagnac, Colomiers, Labège, Tournefeuille) : ateliers d'idéation, lecture du livrable avec votre comité de direction.",
          "Tarifs publics affichés, pas de devis opaque : vous savez exactement ce que vous payez avant de signer.",
          "Démos sur vos vraies données — pas de slides théoriques : documentation technique, comptes-rendus de réunion programme, emails fournisseurs, données capteurs IoT.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs, spécifications techniques si pertinent).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Toulouse dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA — documentation technique, rapports d'anomalie, gestion de données capteurs.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (ingénieurs, chefs de projet, achats, RH, direction, support qualité) pour cartographier finement frictions et attentes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs techniques, vos emails fournisseurs, vos rapports de test, vos données terrain. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME du numérique (French Tech Toulouse), sous-traitants aéronautiques Tier 2/3, sociétés de services informatiques de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI Aerospace Valley, divisions IT ou services R&D souhaitant cadrer une trajectoire IA pluriannuelle dans un contexte de certification et de conformité.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les divisions et filiales des grands groupes toulousains (Airbus, Thales Alenia Space, Continental) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su adapter sa méthode à notre contexte aéronautique — contraintes de documentation, cycles de certification. Le livrable est chiffré et actionnable, sans jargon superflu. On a pu prioriser trois chantiers IA concrets.",
            role: "Directeur des opérations",
            companyProfile: "ETI sous-traitante aéronautique Tier 2, bassin toulousain",
          },
          {
            quote:
              "Démos sur nos vraies données de capteurs et nos rapports d'anomalie. Pas de théorie, du concret dès la première journée. Le plan d'action a été présenté à notre comité de direction sans modification.",
            role: "CTO",
            companyProfile: "Scale-up IoT industriel, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Toulouse ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage.",
          },
          {
            q: "Gérez-vous les contraintes de confidentialité de l'industrie aérospatiale ?",
            a: "Oui. Confidentialité stricte assurée dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Pour les données sensibles ITAR/EAR ou classification DPSD, nous opérons en local pur sur votre infra dédiée. Conformité RGPD stricte.",
          },
          {
            q: "Quel ROI puis-je attendre pour une PME aéronautique toulousaine ?",
            a: "Sur les audits Stratégique PME aéronautiques, le ROI identifié à 12 mois porte principalement sur la documentation technique (génération de rapports, traçabilité), la gestion des non-conformités et la veille fournisseurs. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Toulouse ou dans le bassin. Atelier de quelques heures dans vos locaux avec votre comité de direction. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Différence avec un audit réalisé par un grand cabinet de conseil ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à négocier. Méthode condensée, démos sur vos données réelles dès le premier jour. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une part importante de nos audits toulousains sont commandés par des directions qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, option infra locale pour données sensibles aérospatiales. Le plan d'action remis est portable — exécutable par tout intégrateur de l'Aerospace Valley ou par vos équipes en interne, sans contrat de prestation continue obligatoire.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Toulouse micro-businesses to large aerospace group divisions in the greater basin.",
        whyHere: [
          "Toulouse is the European aerospace capital: our consultants understand PLM processes, technical documentation and compliance cycles specific to Aerospace Valley players.",
          "Dense digital fabric — French Tech Toulouse, IoT Valley at Labège, ESA BIC Sud France startups: we audit emerging AI scale-ups as well as Tier 1 and Tier 2 aerospace sub-contractors.",
          "Read-outs always in person in Toulouse or the basin (Blagnac, Colomiers, Labège, Tournefeuille): ideation workshops, deliverable walk-through with your leadership.",
          "Public pricing, no opaque quote game: you know exactly what you pay before signing.",
          "Demos on your real data — no theoretical slides: technical documentation, programme meeting minutes, supplier emails, IoT sensor data.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs, technical specifications if relevant).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Toulouse at your offices to observe daily tools and identify AI candidate workflows — technical documentation, anomaly reports, sensor data management.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (engineers, project managers, procurement, HR, leadership, quality support) to map frictions and expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your technical PDFs, supplier emails, test reports, field data. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for French Tech Toulouse digital SMEs, Tier 2/3 aerospace sub-contractors, IT services companies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Aerospace Valley mid-caps, IT or R&D divisions framing a multi-year AI trajectory in a certification and compliance context.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For divisions and subsidiaries of Toulouse large groups (Airbus, Thales Alenia Space, Continental) framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA adapted its method to our aeronautical context — documentation constraints, certification cycles. The deliverable is costed and actionable, jargon-free. We were able to prioritise three concrete AI initiatives.",
            role: "Head of Operations",
            companyProfile: "Tier 2 aerospace sub-contractor, greater Toulouse basin",
          },
          {
            quote:
              "Demos on our real sensor data and anomaly reports. No theory, concrete output from day one. The action plan was presented to our executive committee without modification.",
            role: "CTO",
            companyProfile: "Industrial IoT scale-up, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Toulouse?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Do you handle aerospace industry confidentiality constraints?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. For ITAR/EAR-sensitive or DPSD-classified data, we operate in pure local mode on your dedicated infra. Strict GDPR compliance.",
          },
          {
            q: "What ROI can I expect for a Toulouse aerospace SME?",
            a: "On aerospace SME Strategic audits, identified 12-month ROI mainly targets technical documentation (report generation, traceability), non-conformance management and supplier monitoring. The deliverable details exact figures for your case.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Toulouse or the basin. Workshop of a few hours at your offices with your leadership. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a large consulting firm audit?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no quote to negotiate. Condensed method, demos on your real data from day one. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A significant share of our Toulouse audits are ordered by leadership teams that have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, local infra option for sensitive aerospace data. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Toulouse se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en bureau d'études aéronautique Blagnac, sur ligne d'assemblage, en laboratoire agro ou en bureau IoT Labège.",
        whyHere: [
          "Toulouse est un pôle d'intervention prioritaire pour Axion-IA : industrie aérospatiale, numérique et agroalimentaire génèrent des besoins spécifiques que nos sessions adressent directement.",
          "Toute la métropole couverte en présentiel — Toulouse intra-muros, Blagnac (Airbus), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille, Muret — ainsi que les sites industriels de banlieue.",
          "Le format collectif (1 journée) est calibré pour les PME et ETI de quelques personnes à une centaine de collaborateurs.",
          "Le format Conférence convient aux grandes plénières (amphithéâtres ISAE-SUPAERO, TBS Education, auditoriums d'entreprise Aerospace Valley).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction ou les équipes managériales de l'industrie.",
          "Vocabulaire ajusté à votre secteur : documentation aérospatiale, gestion de projet agilité/cascade, analyse de données capteurs IoT, processus qualité, agro-logistique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires (ingénieurs, chefs de projet, équipes qualité, commerciaux).",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports techniques, emails fournisseurs, données capteurs, comptes-rendus de réunion programme) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés à vos métiers.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (ingénieurs, achats, qualité, commerciaux, RH).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif et votre site (Labège, Blagnac, centre toulousain).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands groupes toulousains : roadshow multi-sites (Toulouse + Blagnac + Colomiers), séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement adaptée à nos ingénieurs : démos sur nos vraies données de documentation technique, outils installés en fin de session. Le lendemain, plusieurs collaborateurs utilisaient déjà Claude sur leurs rapports d'anomalie.",
            role: "Responsable R&D",
            companyProfile: "PME sous-traitante aéronautique Tier 2, Toulouse",
          },
          {
            quote:
              "La session dirigeants nous a alignés en quelques heures sur la feuille de route IA de notre division. Un cadrage opérationnel qu'aucun grand cabinet n'avait su livrer aussi rapidement.",
            role: "Directeur général",
            companyProfile: "ETI IT & numérique, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Toulouse ?",
            a: "Cela dépend du format choisi. Le format d'une journée se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir sur les sites industriels de Blagnac et Labège ?",
            a: "Oui. Nous intervenons sur l'ensemble du bassin toulousain : Toulouse intra-muros, Blagnac (Airbus, ATR), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille et Muret.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Les accès restent à votre nom et révocables à tout moment — particulièrement adapté aux profils ingénieurs Aerospace Valley habitués à gérer leurs propres licences logicielles.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur aérospatial ou IoT ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour des ingénieurs aéronautiques n'a rien à voir avec une session pour des équipes commerciales agro.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur — aérospatial, numérique, agroalimentaire, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Toulouse come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work.",
        whyHere: [
          "Toulouse is a priority engagement hub for Axion-IA: aerospace, digital and agri-food industries generate specific needs our sessions address directly.",
          "The entire metro covered in person — Toulouse proper, Blagnac (Airbus), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille, Muret — as well as suburban industrial sites.",
          "The one-day format is calibrated for structures from a few people to about a hundred staff.",
          "The Talk format suits large plenaries (ISAE-SUPAERO, TBS Education amphitheatres, Aerospace Valley company auditoriums).",
          "The Executives format enables in-camera framing for executive committees or industrial management teams.",
          "Vocabulary adjusted to your sector: aerospace documentation, project management, IoT sensor data analysis, quality processes, agri-logistics. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, priority use cases (engineers, project managers, quality teams, sales).",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (technical reports, supplier emails, sensor data, programme meeting minutes) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops tailored to your roles.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department (engineers, procurement, quality, sales, HR).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your objective and site (Labège, Blagnac, city centre).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Toulouse large groups: multi-site roadshows (Toulouse + Blagnac + Colomiers), exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly adapted to our engineers: demos on our real technical documentation data, tools installed by end of session. The next day, several team members were already using Claude on their anomaly reports.",
            role: "Head of R&D",
            companyProfile: "Tier 2 aerospace sub-contractor, Toulouse",
          },
          {
            quote:
              "The executive session aligned us within hours on our division's AI roadmap. Operational framing no large firm had been able to deliver that quickly.",
            role: "CEO",
            companyProfile: "IT & digital mid-cap, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Toulouse take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions at Blagnac and Labège industrial sites?",
            a: "Yes. We operate across the greater Toulouse basin: Toulouse proper, Blagnac (Airbus, ATR), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille and Muret.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our aerospace or IoT sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples, demos. A session for aeronautical engineers has nothing to do with one for agri sales teams.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector — aerospace, digital, agri-food — no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Toulouse met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire à Toulouse ou dans le bassin.",
        whyHere: [
          "Toulouse concentre certaines de nos missions d'implémentation les plus techniques, notamment dans les domaines de la documentation aérospatiale, de l'analyse de données capteurs et de la gestion de conformité.",
          "Le kick-off se passe systématiquement en présentiel à Toulouse ou dans le bassin (Blagnac, Labège) dans vos locaux : alignement des équipes, accès aux données, validation des intégrations PLM/ERP/email.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou chef de programme.",
          "Recette finale toujours en présentiel à Toulouse : passation de pouvoir, formation des équipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques toulousains : sous-traitants aéronautiques (génération de rapports de conformité, traçabilité), startups IoT (pipelines données capteurs), PME IT (agents support, génération de documentation).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Toulouse : revue de l'architecture cible (PLM, ERP, mails, stockage documentaire), validation des contraintes RGPD/sécurité/certification, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Toulouse ou bassin : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Toulouse : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration PLM/ERP/email. Pour PME aéronautiques, IT, agro de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, PLM, datalake), formation d'ambassadeurs cross-département avec contraintes de certification.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour grands groupes toulousains : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA sur plusieurs sites du bassin.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation génération de rapports de conformité livrée comme promis. ROI réel mesuré : plusieurs équivalents temps plein libérés sur les tâches de documentation. Aucun lock-in, nos ingénieurs ont la main sur les modèles.",
            role: "Directeur qualité",
            companyProfile: "ETI sous-traitante aéronautique, bassin toulousain",
          },
          {
            quote:
              "Kick-off intense sur site à Labège, puis itérations à distance très efficaces. Notre équipe a intégré le pipeline IA sans friction dans nos outils existants. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up IoT industriel, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Toulouse ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions toulousaines. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel chez nous ou chez tout intégrateur de l'écosystème Aerospace Valley / IoT Valley — vous restez libre du choix.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, option local pur pour données sensibles aérospatiales.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (documents de certification, données qualité, contrats fournisseurs), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Modèles, données et runbook restent intégralement chez vous, transférables à tout intégrateur Aerospace Valley / IoT Valley ou repris en interne. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Toulouse brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off in Toulouse or the greater basin.",
        whyHere: [
          "Toulouse hosts some of our most technically demanding implementation missions, particularly in aerospace documentation, sensor data analysis and compliance management.",
          "Kick-off always happens in person in Toulouse or the basin (Blagnac, Labège) at your offices: team alignment, data access, PLM/ERP/email integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or programme lead.",
          "Final acceptance always in person in Toulouse: handover, training of installed teams, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Toulouse cases: aerospace sub-contractors (compliance report generation, traceability), IoT startups (sensor data pipelines), IT SMEs (support agents, documentation generation).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Toulouse workshop: target architecture review (PLM, ERP, emails, document storage), GDPR/security/certification constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Toulouse or basin: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Toulouse: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, PLM/ERP/email integration. For aerospace, IT, agri SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, PLM, datalake), cross-department ambassador training with certification constraints.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for Toulouse large groups: cascaded use cases, centralised AI governance, dedicated Axion-IA team across multiple basin sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "Compliance report generation implementation delivered as promised. Real ROI measured: several FTEs freed on documentation tasks. No lock-in, our engineers control the models.",
            role: "Quality Director",
            companyProfile: "Aerospace sub-contractor mid-cap, greater Toulouse basin",
          },
          {
            quote:
              "Intense on-site kick-off at Labège, then highly efficient remote iterations. Our team integrated the AI pipeline into existing tools without friction. Internal ambassadors take over autonomously.",
            role: "CTO",
            companyProfile: "Industrial IoT scale-up, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Toulouse take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Toulouse missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, pure local option for sensitive aerospace data.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (certification documents, quality data, supplier contracts), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Toulouse s'adresse aux dirigeants, ingénieurs et managers de l'aérospatiale (Airbus, CNES, Thales Alenia Space, ONERA), aux cadres des PME et ETI de l'Aerospace Valley, aux responsables des scale-ups French Tech Toulouse et aux dirigeants du tissu industriel toulousain. Pas de programme collectif : chaque séance part de vos vrais dossiers, vos vraies décisions, votre réalité métier. Tarif d'entrée {{price:intervention-dirigeants|flat}}.",
        whyHere: [
          "Toulouse concentre une densité exceptionnelle d'ingénieurs et de managers techniques dans l'aérospatiale (Airbus, CNES, Thales Alenia Space, ATR, ONERA) qui ont besoin d'intégrer l'IA dans leur pratique sans passer par une formation collective inadaptée à leur niveau.",
          "L'écosystème French Tech Toulouse et IoT Valley à Labège-Innopole génère des dirigeants de scale-ups et des fondateurs techniques pour qui une montée en compétence IA rapide et personnalisée est souvent plus pertinente qu'un programme de groupe.",
          "ISAE-SUPAERO, ENAC, TBS Education, Toulouse INP forment chaque année des profils d'excellence qui, une fois en poste, cherchent à approfondir leur pratique IA de façon autonome — le coaching 1-to-1 est le format idéal.",
          "Les cadres de la chaîne aéronautique Tier 1 et Tier 2 (sous-traitants Airbus, ATR) ont des contraintes de confidentialité ITAR/EAR et DPSD spécifiques que nous maîtrisons — séances adaptées à ces profils sensibles.",
          "Format accessible depuis tout le bassin toulousain : Toulouse centre, Blagnac (Airbus, ATR), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille, Muret — présentiels ou distanciels selon votre agenda.",
          "Aucun group dynamics : vous progressez sur vos vraies questions techniques et managériales, sans vous adapter à un niveau collectif qui n'est pas le vôtre.",
        ],
        methodology: [
          {
            step: "Entretien de positionnement",
            detail:
              "Un premier échange (45 min à distance ou sur site à Toulouse) pour cartographier votre niveau IA actuel, vos objectifs prioritaires, votre secteur (aérospatiale, IoT, agroalimentaire, services) et vos cas d'usage cibles. Pour les profils aérospatiaux, nous précisons en amont les contraintes de confidentialité applicables.",
          },
          {
            step: "Séances sur mesure dans votre contexte",
            detail:
              "Chaque séance part de VOS documents et de VOS décisions du moment : documentation technique, rapports d'anomalie, comptes-rendus de réunion programme, emails fournisseurs. Démos en direct sur Claude, Mistral, GPT-4 appliquées à votre réalité aérospatiale, IoT ou industrielle.",
          },
          {
            step: "Ancrage pratique entre les séances",
            detail:
              "Exercices ciblés sur vos tâches quotidiennes réelles : rédaction de spécifications techniques, gestion de non-conformités, qualification de fournisseurs, préparation de revues de programme. Pas de devoirs théoriques déconnectés de votre activité.",
          },
          {
            step: "Suivi de progression",
            detail:
              "Bilan intermédiaire à mi-parcours : ce qui est ancré, ce qui reste à consolider, ajustement du programme selon l'évolution de vos priorités. Souplesse totale — vous pouvez changer de focus entre deux séances.",
          },
          {
            step: "Synthèse finale et autonomie",
            detail:
              "En fin de parcours, synthèse personnelle de vos cas d'usage IA maîtrisés, guide de ressources sélectionnées pour votre secteur et recommandations de veille IA. Vous êtes autonome — aucune dépendance au coaching créée.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Parcours PME — sur devis",
            detail:
              "Pour dirigeants et managers de PME aéronautiques, IT et agro toulousaines (quelques dizaines à 250 collaborateurs). Parcours calibré : prise de décision, management d'ingénieurs, reporting technique, gestion de projet IA sous contraintes de certification.",
          },
          {
            sizeLabel: "ETI",
            price: "Parcours ETI — sur devis",
            detail:
              "Pour DG, DAF, DRH et directeurs techniques d'ETI Aerospace Valley ou IT Labège. Travail sur la gouvernance IA, la communication programme, la relation donneurs d'ordres et la conduite du changement dans les équipes d'ingénieurs.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Parcours grands comptes — sur devis",
            detail:
              "Pour directeurs de divisions et cadres de direction des grands groupes toulousains (Airbus, Thales Alenia Space, Continental, CNES). Format confidentiel haut niveau, agenda adapté aux contraintes de direction opérationnelle. Frais en sus.",
          },
        ],
        testimonials: [
          {
            quote:
              "En tant qu'ingénieur en chef dans l'aérospatiale, j'avais besoin d'un accompagnement discret et technique sur l'IA — pas une formation généraliste. Le coaching 1-to-1 a travaillé directement sur mes vrais documents de programme. En quelques séances, j'intègre l'IA dans mes revues de conception et mes rapports d'anomalie.",
            role: "Ingénieur en chef",
            companyProfile: "ETI sous-traitante aéronautique Tier 1, bassin toulousain",
          },
          {
            quote:
              "Format idéal pour un fondateur technique toujours entre deux réunions programme. Les séances à distance calées sur mon agenda ont transformé ma façon de rédiger des specs et de qualifier nos fournisseurs. ROI immédiat dès la première séance.",
            role: "CTO fondateur",
            companyProfile: "Scale-up IoT industriel, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "À qui s'adresse le coaching IA 1-to-1 Axion-IA à Toulouse ?",
            a: "À tout dirigeant, ingénieur ou manager du bassin toulousain souhaitant monter en compétence IA de façon personnalisée : cadres aérospatiaux (Airbus, CNES, Thales, ATR), fondateurs French Tech Toulouse, responsables de PME sous-traitantes, directeurs d'ETI IT ou agro. Tout profil B2B est éligible, quel que soit le niveau de départ.",
          },
          {
            q: "Le coaching 1-to-1 est-il adapté aux contraintes de confidentialité aérospatiale (ITAR/EAR) ?",
            a: "Oui. Confidentialité stricte dès la première séance. Pour les profils soumis à des contraintes ITAR/EAR ou DPSD, nous travaillons sur des exemples anonymisés représentatifs de votre activité et recommandons uniquement des outils compatibles avec vos politiques de sécurité. Aucun document sensible ne quitte la session.",
          },
          {
            q: "Quel est le tarif d'entrée et comment est facturé le coaching ?",
            a: "Le tarif d'entrée est de {{price:intervention-dirigeants|flat}} pour un parcours court (2-3 séances). Le programme complet est défini après l'entretien de positionnement, pas d'engagement à l'aveugle.",
          },
          {
            q: "Les séances se déroulent-elles en présentiel à Toulouse ou à distance ?",
            a: "Les deux sont possibles selon vos préférences. Présentiel dans vos locaux (Toulouse centre, Blagnac, Labège, Colomiers) ou à distance en visio.",
          },
          {
            q: "Quelle différence avec une formation collective IA à Toulouse ?",
            a: "Dans une formation collective, le rythme est calé sur la moyenne du groupe et les cas traités sont génériques. En coaching 1-to-1, chaque séance travaille sur VOS fichiers techniques, VOS rapports, VOS dossiers réels. L'investissement est plus ciblé, le retour opérationnel est immédiat.",
          },
          {
            q: "Puis-je solliciter un coaching pour plusieurs membres de mon équipe dirigeante ?",
            a: "Oui. Plusieurs séances individuelles coordonnées pour les membres d'un même CODIR ou équipe de direction (ETI Aerospace Valley, division Airbus) permettent d'aligner la vision IA au niveau managérial. Tarif dégressif à partir de 3 bénéficiaires, sur devis.",
          },
        ],
        guarantees:
          "Entretien de positionnement inclus sans engagement : si le coaching ne correspond pas à vos besoins, aucune facturation. Séances facturées au forfait, pas à l'heure — vous savez exactement ce que vous payez. Confidentialité stricte dès le démarrage, aucune référence publiée sans accord écrit — particulièrement strict pour les dirigeants Airbus, CNES et ONERA exposés à des contraintes ITAR ou défense. Les compétences acquises sont utilisables en autonomie totale, sans contrat récurrent ni licence à renouveler.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Toulouse is for executives, engineers and managers in aerospace (Airbus, CNES, Thales Alenia Space, ONERA), Aerospace Valley SMEs and mid-caps, French Tech Toulouse scale-up leaders and Toulouse industrial firms. No group programme: each session starts from your real files, your real decisions, your actual business reality. Entry rate from €990 excl. VAT.",
        whyHere: [
          "Toulouse concentrates an exceptional density of aerospace engineers and technical managers (Airbus, CNES, Thales Alenia Space, ATR, ONERA) who need to integrate AI into their practice without going through group training unsuited to their level.",
          "The French Tech Toulouse and IoT Valley at Labège-Innopole ecosystem generates scale-up founders and technical leaders for whom fast, personalised AI upskilling is often more relevant than a group programme.",
          "ISAE-SUPAERO, ENAC, TBS Education, Toulouse INP train high-calibre profiles who, once in post, seek to deepen their AI practice autonomously — 1-to-1 coaching is the ideal format.",
          "Tier 1 and Tier 2 aerospace chain managers (Airbus, ATR sub-contractors) have specific ITAR/EAR and DPSD confidentiality constraints that we understand — sessions adapted for sensitive profiles.",
          "Accessible across the Toulouse basin: Toulouse centre, Blagnac (Airbus, ATR), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille, Muret — on-site or remote per your agenda.",
          "No group dynamics: you progress on your real technical and managerial questions, without adapting to a collective level that is not yours.",
        ],
        methodology: [
          {
            step: "Positioning interview",
            detail:
              "A first exchange (45 min remote or on site in Toulouse) to map your current AI level, priority objectives, sector (aerospace, IoT, agri-food, services) and target use cases. For aerospace profiles, we clarify applicable confidentiality constraints upfront.",
          },
          {
            step: "Tailored sessions in your context",
            detail:
              "Each session starts from YOUR documents and YOUR current decisions: technical documentation, anomaly reports, programme meeting minutes, supplier emails. Live demos on Claude, Mistral, GPT-4 applied to your aerospace, IoT or industrial reality.",
          },
          {
            step: "Practical anchoring between sessions",
            detail:
              "Targeted exercises on your real daily tasks: technical specification writing, non-conformance management, supplier qualification, programme review preparation. No disconnected theoretical homework.",
          },
          {
            step: "Progress monitoring",
            detail:
              "Mid-programme review: what is anchored, what still needs consolidation, programme adjustment if priorities have shifted. Full flexibility — you can change focus between sessions.",
          },
          {
            step: "Final synthesis and autonomy",
            detail:
              "At the end of the programme, a personal summary of your mastered AI use cases, a curated resource guide for your sector and AI monitoring recommendations. You are autonomous — no coaching dependency created.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME programme — on quote",
            detail:
              "For Toulouse aerospace, IT and agri SME managers and directors (a few dozen to 250 staff). Programme calibrated for: decision-making, engineer management, technical reporting, AI project management under certification constraints.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap programme — on quote",
            detail:
              "For CEOs, CFOs, CHROs and technical directors of Aerospace Valley or Labège IT mid-caps. Work on AI governance, programme communication, prime contractor relationship and change management in engineering teams.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Large accounts programme — on quote",
            detail:
              "For division directors and senior executives at Toulouse large groups (Airbus, Thales Alenia Space, Continental, CNES). Confidential senior format, schedule adapted to operational leadership constraints. Expenses billed separately.",
          },
        ],
        testimonials: [
          {
            quote:
              "As a chief engineer in aerospace, I needed discreet, technical AI coaching — not generic training. The 1-to-1 coaching worked directly on my real programme documents. Within a few sessions, I integrate AI into my design reviews and anomaly reports.",
            role: "Chief Engineer",
            companyProfile: "Tier 1 aerospace sub-contractor mid-cap, greater Toulouse basin",
          },
          {
            quote:
              "Ideal format for a technical founder always between two programme meetings. Remote sessions fitted around my agenda transformed how I write specs and qualify suppliers. Immediate ROI from the first session.",
            role: "CTO Founder",
            companyProfile: "Industrial IoT scale-up, Labège-Innopole",
          },
        ],
        faq: [
          {
            q: "Who is Axion-IA's 1-to-1 AI coaching in Toulouse for?",
            a: "For any executive, engineer or manager in the Toulouse basin wanting personalised AI upskilling: aerospace managers (Airbus, CNES, Thales, ATR), French Tech Toulouse founders, sub-contractor SME leaders, IT or agri mid-cap directors. Any B2B profile is eligible, regardless of starting level.",
          },
          {
            q: "Is 1-to-1 coaching suited to aerospace confidentiality constraints (ITAR/EAR)?",
            a: "Yes. Strict confidentiality ensured before the first session. For profiles subject to ITAR/EAR or DPSD constraints, we work on anonymised representative examples and only recommend tools compatible with your security policies. No sensitive document leaves the session.",
          },
          {
            q: "What is the entry rate and how is coaching invoiced?",
            a: "The entry rate is €990 excl. VAT for a short programme (2-3 sessions). The full programme is defined after the positioning interview, no blind commitment.",
          },
          {
            q: "Are sessions on-site in Toulouse or remote?",
            a: "Both are available per your preferences. On-site at your offices (Toulouse centre, Blagnac, Labège, Colomiers) or remote by video.",
          },
          {
            q: "What is the difference from group AI training in Toulouse?",
            a: "In group training, the pace is set to the group average and cases are generic. In 1-to-1 coaching, every session works on YOUR technical files, YOUR reports, YOUR real documents. The investment is more targeted, the operational return is immediate.",
          },
          {
            q: "Can I request coaching for several members of my leadership team?",
            a: "Yes. Several coordinated individual sessions for members of the same executive committee (Aerospace Valley mid-cap, Airbus division) align AI vision at managerial level. Decreasing rate from 3 beneficiaries onwards, on quote.",
          },
        ],
        guarantees:
          "Positioning interview included without commitment: if coaching does not match your needs, no charge. Sessions invoiced at a flat rate, not by the hour — you know exactly what you pay. Strict confidentiality from the outset, no reference published without written consent. No lock-in: skills acquired are usable in full autonomy.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Toulouse des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Toulouse, itérations à distance.",
        whyHere: [
          "Projets web & SaaS toulousains : aérospatial & défense (Aerospace Valley, Airbus, Thales), IoT (IoT Valley), deeptech, scale-ups French Tech, services Labège-Innopole.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Documentation technique massive (aéro/défense) : RAG, recherche sémantique et agents sur vos référentiels — hébergement UE, RGPD strict, confidentialité.",
        ],
        methodology: [
          {
            step: "Cadrage à Toulouse",
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
            sizeLabel: "PME",
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour scale-ups et PME toulousaines.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, IoT ou portail technique sur mesure pour l'aérospatial et la deeptech, IA intégrée, branchée sur votre SI (PLM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Toulouse — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous gérez la documentation technique aéro/défense ?",
            a: "Oui : RAG et recherche sémantique sur vos référentiels et docs techniques, agents sur vos procédures, indexation documentaire. Un terrain naturel à Toulouse avec l'Aerospace Valley. Hébergement UE, RGPD strict, confidentialité contractuelle — vos données ne sortent pas de votre périmètre.",
          },
          {
            q: "Peut-on augmenter un site existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API ou un flux de données. Aucune refonte ni downtime.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage, on remet un devis ferme en forfait fixe. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple, davantage pour une plateforme technique étendue. Pas de régie, pas de dérive horaire cachée.",
          },
          {
            q: "Avec quelles technologies travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. On choisit la meilleure stack selon vos objectifs et on s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région toulousaine ou repris en interne.",
      },
      en: {
        hero: "In Toulouse, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Toulouse kick-off, remote iterations.",
        whyHere: [
          "Toulouse web & SaaS projects: aerospace & defence (Aerospace Valley, Airbus, Thales), IoT (IoT Valley), deeptech, French Tech scale-ups, Labège-Innopole services.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Massive technical documentation (aero/defence): RAG, semantic search and agents on your repositories — EU hosting, strict GDPR, confidentiality.",
        ],
        methodology: [
          {
            step: "Scoping in Toulouse",
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
            sizeLabel: "SME",
            price: "Bespoke site / app",
            detail:
              "Design or rebuild of a site or app with UX/UI and built-in AI, for Toulouse scale-ups and SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, IoT or technical portal platform for aerospace and deeptech, AI built in, wired into your IS (PLM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Toulouse — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you handle aero/defence technical documentation?",
            a: "Yes: RAG and semantic search on your repositories and technical docs, agents on your procedures, document indexing. A natural fit in Toulouse with the Aerospace Valley. EU hosting, strict GDPR, contractual confidentiality — your data stays within your perimeter.",
          },
          {
            q: "Can you augment an existing site without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft the AI bricks via an API, a widget or a plugin, without touching the design or structure, as long as your CMS exposes an API or data feed. No rebuild, no downtime.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After scoping, we deliver a firm quote on a fixed package. Turnaround depends on complexity — from 24-48 h for a simple project, more for an extended technical platform. No time-and-materials, no hidden hourly drift.",
          },
          {
            q: "Which technologies do you work with?",
            a: "Any modern stack exposing an API: WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. We pick the best stack for your goals and adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Toulouse-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Toulouse ?",
      a: "Quatre paliers tarifaires publics couvrent toutes les configurations toulousaines — Sur place pour les PME de la ville rose ou bureaux d'études indépendants, Ciblé pour les PME sous-traitantes Aerospace Valley et services Toulouse centre, Stratégique PME pour les scale-ups French Tech Toulouse et acteurs agro-industriels, Stratégique ETI pour les opérateurs Aerospace Valley (Airbus, ATR, Thales) et grandes filiales Blagnac/Colomiers. La grille appliquée à Toulouse est strictement identique à celle de Paris ou Lyon — aucune pondération Occitanie.",
    },
    {
      q: "Avez-vous des références dans l'industrie aérospatiale toulousaine ?",
      a: "Oui. Plusieurs de nos missions toulousaines concernent des acteurs de la chaîne aéronautique et du spatial — sous-traitants Tier 2, PME équipementières, startups IoT industriel. Les cas concrets sont consultables dans la rubrique dédiée, filtrables par secteur.",
    },
    {
      q: "Quels secteurs sont prioritaires à Toulouse ?",
      a: "Nos déploiements toulousains couvrent en priorité l'aérospatiale et la défense (Aerospace Valley), le numérique et l'IoT (French Tech Toulouse, Labège-Innopole), et l'agroalimentaire (IGP, coopératives Sud-Ouest). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site à Blagnac ou Labège ?",
      a: "Oui. Nous intervenons sur l'ensemble du bassin toulousain — Toulouse intra-muros, Blagnac (Airbus, ATR), Colomiers, Labège-Innopole (IoT Valley), Tournefeuille et Muret.",
    },
    {
      q: "Travaillez-vous avec les startups de la French Tech Toulouse ?",
      a: "Oui. Nous accompagnons les scale-ups françaises issues de la French Tech Toulouse, de l'IoT Valley et de l'ESA BIC Sud France. Notre offre est calibrée pour les structures qui veulent passer du POC IA à un déploiement opérationnel, avec un ROI chiffré et sans lock-in.",
    },
    {
      q: "Comment démarrer une mission IA à Toulouse ?",
      a: "Le point d'entrée est le brief de cadrage initial, à distance et sans engagement. Nous calons ensemble le niveau, le périmètre et la date de démarrage. Le SOW est signé avant tout démarrage, avec tarif fixe et livrables définis.",
    },
  ],
};
