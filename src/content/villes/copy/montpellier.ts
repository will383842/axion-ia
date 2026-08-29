// Montpellier (34172) — contenu éditorial gold standard.
//
// Doctrine appliquée :
//   - Aucun délai chiffré (pas de "5 jours", "7 jours", etc.)
//   - Aucun "frais de déplacement intégrés" — frais en sus
//   - Aucun prix en dur — vient de pricing.ts
//   - Durée minimale = 1 journée, formats de 1 journée à plusieurs semaines
//   - "frais de logement, repas et forfait trajet en sus" sur interventions
//   - Tailles d'entreprise INSEE : PME/ETI/GE
//   - ~95 % Axion-IA-centric, ~5 % data INSEE bouclier anti-doorway HCU 2024
//   - PAS heroSchema, PAS unAUn (non demandé)
//
// Réalités Montpellier utilisées : Euromédecine, CHU Montpellier, Sanofi (R&D),
// Ubisoft Montpellier (2e pôle jeux vidéo France), Dell France (siège), IBM,
// Université de Montpellier, Institut Agro / Agropolis, French Tech Méditerranée,
// Cap Omega, BIC Montpellier, Inria, CIRAD, INRAE, 36 590 établissements actifs,
// Eurobiomed, Aqua-Valley, Polytech Montpellier, Montpellier Business School.

import type { VilleCopy } from "./types";

export const MONTPELLIER_COPY: VilleCopy = {
  pitchFr:
    "Montpellier concentre 36 590 établissements actifs, le 2e pôle jeux vidéo de France (Ubisoft), le cluster santé-biotech Euromédecine, le siège France de Dell et French Tech Méditerranée. Axion-IA y intervient sur site, des PME du numérique aux ETI santé et industrie de la Méditerranée.",
  pitchEn:
    "Montpellier hosts 36,590 active businesses, France's 2nd video-game hub (Ubisoft), the Euromédecine health-biotech cluster, Dell's French HQ and the French Tech Méditerranée label. Axion-IA delivers on site, from digital micro-businesses to health and industry mid-caps across the Mediterranean region.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Montpellier : nous cartographions vos processus automatisables et chiffrons le ROI à 12-24 mois. 4 niveaux du Sur place au Stratégique ETI, calibrés pour les PME tech du Cap Omega, les PME santé d'Euromédecine et les ETI industrielles de l'Hérault.",
      en: "Operational AI audit in Montpellier: we map your automatable processes and quantify the 12-24 month ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated for Cap Omega tech micro-businesses, Euromédecine health SMEs and Hérault industrial mid-caps.",
    },
    interventions: {
      fr: "Interventions IA à Montpellier : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur métier réel.",
      en: "AI sessions in Montpellier: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work.",
    },
    implementation: {
      fr: "Implémentation IA à Montpellier : on intègre l'IA dans vos outils existants (CRM, ERP, mails, outils métier santé/biotech/IT) avec ROI chiffré contractuel. Vos équipes gardent la main — aucune dépendance créée.",
      en: "AI implementation in Montpellier: we integrate AI into your existing tools (CRM, ERP, email, health/biotech/IT business tools) with contractually-costed ROI. Your teams stay in control — no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Montpellier : accompagnement 1-to-1 ancré dans votre réalité — santé/biotech, IT, jeux vidéo ou agroalimentaire. À partir de {{price:intervention-dirigeants|flat}}.",
      en: "Individual AI coaching in Montpellier: 1-to-1 support rooted in your reality — health/biotech, IT, video games or agri-food. From €990 excl. VAT.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI héraultaises — site vitrine premium pour acteurs santé-biotech (Euromédecine, Sanofi R&D), portail client B2B pour scale-ups French Tech Méditerranée (Cap Omega, Cap Alpha), dashboard métier pour studios jeux vidéo et agritech connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Hérault SMEs and mid-caps — premium showcase site for health-biotech players (Euromédecine, Sanofi R&D), B2B client portal for French Tech Méditerranée scale-ups (Cap Omega, Cap Alpha), business dashboard for video-game studios and agritech connected to your CRM/ERP. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Montpellier (34) sur site dans la métropole et le bassin héraultais. Nous accompagnons les PME du numérique (Cap Omega, Cap Alpha), les PME et ETI santé-biotech (Euromédecine, CHU, Sanofi R&D), les studios jeux vidéo, les acteurs de l'agritech et les groupes IT (Dell, IBM) sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy delivering on site in Montpellier (34) across the metropolis and the Hérault basin. We support digital micro-businesses (Cap Omega, Cap Alpha), health-biotech SMEs and mid-caps (Euromédecine, CHU, Sanofi R&D), video-game studios, agritech players and IT groups (Dell, IBM) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "medtech, agronomie & numérique",

  topSectorsNaf: [
    "Santé & Biotech",
    "Numérique & IT",
    "Jeux vidéo & Industries créatives",
    "Agronomie & Agroalimentaire",
    "Conseil & Services aux entreprises",
    "Recherche & Enseignement supérieur",
  ],

  distancesFr:
    "Gares Montpellier Saint-Roch (TER/TGV intra-muros) et Montpellier Sud-de-France (LGV, Paris en 3h15). Aéroport Montpellier Méditerranée (MPL) à 8 km. Réseau TAM 4 lignes de tramway couvrant la métropole de Castelnau-le-Lez à Lattes, Pérols et Saint-Jean-de-Védas.",
  distancesEn:
    "Montpellier Saint-Roch station (local/TGV, city centre) and Montpellier Sud-de-France (high-speed, Paris in 3h15). Montpellier Méditerranée Airport (MPL) 8 km away. TAM network with 4 tram lines covering the metropolis from Castelnau-le-Lez to Lattes, Pérols and Saint-Jean-de-Védas.",

  ecosystemFr:
    "7e ville de France et 1ère pour la croissance démographique des grandes métropoles — 36 590 établissements actifs, 75 000 étudiants. Cluster mondial agronomie-développement (Agropolis : CIRAD, INRAE, IRD), pôle santé Euromédecine + CHU, 2e pôle jeux vidéo France (Ubisoft), siège France Dell, French Tech Méditerranée label, Inria antenne IA.",
  ecosystemEn:
    "7th-largest French city and fastest-growing major metropolis — 36,590 active businesses, 75,000 students. World-class agronomy cluster (Agropolis: CIRAD, INRAE, IRD), Euromédecine health hub + CHU, France's 2nd video-game hub (Ubisoft), Dell's French HQ, French Tech Méditerranée label, Inria AI branch.",

  // ═══════════════════════════════════════════════════════════════
  // SERVICES LONG-FORM — MONTPELLIER
  // Aucun prix en dur (vient de pricing.ts), aucun délai chiffré,
  // aucune mention "frais inclus", aucun "basé en UE".
  // ═══════════════════════════════════════════════════════════════
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Montpellier cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux couvrent toutes les tailles — des PME numériques de Cap Omega aux ETI santé-biotech d'Euromédecine, en passant par les PME de l'agritech et les groupes IT comme Dell ou IBM implantés dans l'Hérault.",
        whyHere: [
          "Montpellier est l'un de nos pôles d'intervention prioritaires en Occitanie : tissu B2B dense (36 590 établissements actifs, 121 pour 1 000 habitants) avec une surreprésentation des secteurs santé, IT et agronomie qui concentrent nos cas clients.",
          "Cluster Euromédecine + CHU Montpellier + Sanofi R&D : nos auditeurs maîtrisent les contraintes réglementaires de la santé (HDS, MDR, données patients) et adaptent le périmètre IA en conséquence.",
          "Pôle IT et jeux vidéo (Dell France siège, IBM Client Center, Ubisoft Montpellier, Cap Omega) : nos cas couvrent la qualification de leads B2B, le support client IA et la génération de contenus pour éditeurs.",
          "French Tech Méditerranée et BIC Montpellier : nos audits sont calibrés pour les startups et scale-ups du numérique qui veulent passer du POC IA à un déploiement opérationnel.",
          "Restitutions toujours en présentiel dans vos locaux montpelliérains : ateliers d'idéation, lecture du livrable avec votre comité de direction, plan d'action transmis en main propre.",
          "Tarifs publics affichés, pas de devis opaque : vous savez exactement ce que vous payez avant de signer, et votre plan d'action est exécutable avec n'importe quel prestataire ou en interne.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés — organigramme, processus, indicateurs, contraintes sectorielles (HDS pour la santé, conformité réglementaire pour l'agroalimentaire).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Montpellier dans vos locaux (Euromédecine, Cap Omega, Parc Millénaire ou vos bureaux) pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts — commerciaux, finance, R&D, opérations, support, direction — pour cartographier finement frictions, attentes et contraintes métier propres à votre secteur montpelliérain.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, comptes-rendus, rapports cliniques ou documents agronomiques selon votre secteur. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux montpelliérains. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable intégrant les spécificités réglementaires et sectorielles de votre activité.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour PME santé-biotech Euromédecine, studios jeux vidéo, agences IT, cabinets d'ingénierie de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles, pharmaceutiques ou agroalimentaires de l'Hérault souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites majeurs (Dell France, IBM Montpellier, Sanofi R&D) souhaitant cadrer une gouvernance IA centralisée sur leur implantation montpelliéraine.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su adapter son audit aux contraintes de nos données de santé et aux exigences HDS. Le livrable est chiffré, actionnable, sans jargon. Nous avons lancé l'implémentation très rapidement.",
            role: "Directeur général",
            companyProfile: "PME dispositifs médicaux, Parc Euromédecine",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données de production — pas de slides théoriques. Le livrable a permis de prioriser nos chantiers IA pour le comité de direction et de convaincre notre maison-mère.",
            role: "Directrice R&D",
            companyProfile: "ETI pharmaceutique, Montpellier",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Montpellier ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Gérez-vous les contraintes spécifiques de la santé (HDS, données patients) ?",
            a: "Oui. Nos auditeurs maîtrisent les exigences HDS, RGPD santé et MDR pour les dispositifs médicaux. Le périmètre IA est défini en tenant compte de ces contraintes, et les démos sont réalisées sur des données anonymisées ou des jeux de test représentatifs.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Montpellier. Atelier de quelques heures dans vos locaux avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap actionnable.",
          },
          {
            q: "Pouvez-vous intervenir sur les communes voisines (Castelnau-le-Lez, Lattes, Mauguio) ?",
            a: "Oui. Nos interventions couvrent l'ensemble de la Métropole de Montpellier ainsi que les communes du bassin héraultais. Le tarif d'audit est identique quelle que soit la commune d'intervention dans la zone.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une grande partie de nos audits montpelliérains sont commandés par des dirigeants ou DG qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD et secteur santé (HDS sur demande), hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne.",
      },
      en: {
        hero: "Axion-IA's AI audit in Montpellier maps what can be automated in your organization and quantifies the 12-24 month ROI. Four tiers cover every size — from Cap Omega digital micro-businesses to Euromédecine health-biotech mid-caps, through agritech SMEs and IT groups such as Dell and IBM established in the Hérault.",
        whyHere: [
          "Montpellier is one of our priority engagement hubs in Occitania: dense B2B fabric (36,590 active businesses, 121 per 1,000 inhabitants) with an over-representation of health, IT and agronomy sectors that concentrate our client cases.",
          "Euromédecine cluster + CHU Montpellier + Sanofi R&D: our auditors master health regulatory constraints (HDS, MDR, patient data) and adapt the AI scope accordingly.",
          "IT and video-game hub (Dell France HQ, IBM Client Center, Ubisoft Montpellier, Cap Omega): our cases cover B2B lead qualification, AI customer support and content generation for publishers.",
          "French Tech Méditerranée and BIC Montpellier: our audits are calibrated for digital startups and scale-ups wanting to move from AI POC to operational deployment.",
          "Read-outs always in person at your Montpellier offices: ideation workshops, deliverable walk-through with your leadership, action plan handed over face to face.",
          "Public pricing, no opaque quote: you know exactly what you pay before signing, and your action plan is executable with any vendor or in-house.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents — org chart, processes, KPIs, sector constraints (HDS for healthcare, regulatory compliance for agri-food).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Montpellier at your premises (Euromédecine, Cap Omega, Parc Millénaire or your offices) to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews — sales, finance, R&D, operations, support, leadership — to finely map frictions, expectations and sector-specific constraints of your Montpellier activity.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, meeting minutes, clinical reports or agronomic documents depending on your sector. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Montpellier offices. Costed PDF deliverable handed over, actionable roadmap integrating the regulatory and sector specifics of your activity.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for Euromédecine health-biotech SMEs, video-game studios, IT agencies, engineering firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Hérault industrial, pharmaceutical or agri-food mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For major sites (Dell France, IBM Montpellier, Sanofi R&D) framing centralized AI governance for their Montpellier establishment.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA adapted the audit to our health data constraints and HDS requirements. The deliverable is costed, actionable, jargon-free. We launched implementation very quickly.",
            role: "CEO",
            companyProfile: "Medical device SME, Parc Euromédecine",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data — no theoretical slides. The deliverable helped prioritize our AI initiatives and convinced our parent company.",
            role: "Head of R&D",
            companyProfile: "Pharmaceutical mid-cap, Montpellier",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Montpellier?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "Do you handle healthcare-specific constraints (HDS, patient data)?",
            a: "Yes. Our auditors master HDS, health GDPR and MDR requirements for medical devices. The AI scope is defined taking these constraints into account, and demos use anonymized or representative test datasets.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty is required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Montpellier. Workshop of a few hours at your offices with your leadership or executive committee. You leave with the PDF deliverable in hand and an actionable roadmap.",
          },
          {
            q: "Can you deliver in surrounding communes (Castelnau-le-Lez, Lattes, Mauguio)?",
            a: "Yes. Our engagements cover the entire Montpellier Métropole and Hérault basin communes. Audit pricing is identical regardless of the specific commune within the area.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Montpellier audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance and health sector (HDS on request), EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Montpellier se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — que vous soyez dans la santé à Euromédecine, le numérique à Cap Omega ou l'industrie en Hérault.",
        whyHere: [
          "Montpellier est l'un de nos terrains d'intervention réguliers en Occitanie : secteurs santé, IT, jeux vidéo, agronomie et industrie y coexistent, ce qui nous donne une palette de cas d'usage très concrète à démontrer.",
          "Toute la métropole couverte en présentiel ainsi que les communes voisines (Castelnau-le-Lez, Lattes, Pérols, Saint-Jean-de-Védas, Mauguio) et les pôles d'activité périphériques.",
          "Le format collectif (1 journée) est calibré pour les structures montpelliéraines de quelques personnes à une centaine de collaborateurs — startups numériques, PME biotech, studios jeux vidéo.",
          "Le format Conférence convient aux grandes plénières (Campus IBM, salles Parc Millénaire, amphithéâtres Cap Omega, espaces Montpellier Business School).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction ETI ou les comités d'innovation des groupes IT et pharmaceutiques implantés à Montpellier.",
          "Vocabulaire ajusté à votre secteur dominant : santé/médical, numérique/IT, jeux vidéo, agronomie/agroalimentaire, ingénierie. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier (santé, IT, jeux vidéo, agritech) et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports cliniques, emails commerciaux, fiches produit, protocoles agronomiques) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux montpelliérains pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données sectorielles, suivies d'ateliers participatifs adaptés à la culture métier de vos équipes.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel (rédaction médicale, documentation technique, génération de contenus jeux vidéo, analyse agronomique). Utilisables dès le lendemain matin.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (R&D, commercial, support, production, agronomie).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif de transformation.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les implantations montpelliéraines (Dell, IBM, Sanofi) : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement calibrée pour notre équipe R&D : vocabulaire médical respecté, démos sur nos propres documents. Le lendemain, nos collaborateurs utilisaient déjà l'IA sur leurs rédactions réglementaires.",
            role: "Directeur R&D",
            companyProfile: "PME dispositifs médicaux, Euromédecine",
          },
          {
            quote:
              "La session Dirigeants nous a alignés en quelques heures sur la trajectoire IA de notre studio. Format dense, pragmatique, ancrée dans nos réalités jeux vidéo — pas de généralités.",
            role: "Directeur de studio",
            companyProfile: "Studio jeux vidéo indépendant, Montpellier",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Montpellier ?",
            a: "Cela dépend du format choisi. Le format collectif se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux spécificités du secteur santé ?",
            a: "Oui. Nos formateurs ont des références dans le médical, le pharmaceutique et les dispositifs médicaux. Le brief de cadrage permet d'ajuster vocabulaire, exemples et démos — une session pour une équipe clinique n'a rien à voir avec une session pour un studio jeux vidéo.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma selon le profil. Aucun lock-in Axion-IA — vous gardez la main.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Pouvez-vous intervenir dans les communes voisines de Montpellier ?",
            a: "Oui. Castelnau-le-Lez, Lattes, Pérols, Saint-Jean-de-Védas, Mauguio et les zones d'activité périphériques (Parc Agropolis, technopôle de Sète) sont couvertes.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur (santé, IT, jeux vidéo, agronomie), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Montpellier come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether you are in health at Euromédecine, digital at Cap Omega or industry in the Hérault.",
        whyHere: [
          "Montpellier is one of our regular engagement grounds in Occitania: health, IT, video games, agronomy and industry sectors coexist, giving us a very concrete palette of use cases to demonstrate.",
          "The entire metropolis covered in person along with neighbouring communes (Castelnau-le-Lez, Lattes, Pérols, Saint-Jean-de-Védas, Mauguio) and peripheral business parks.",
          "The group format is calibrated for Montpellier structures from a few people to about a hundred staff — digital startups, biotech SMEs, video-game studios.",
          "The Talk format suits large plenaries (IBM Campus, Parc Millénaire rooms, Cap Omega auditoria, Montpellier Business School spaces).",
          "The Executives format enables in-camera framing for ETI executive committees or innovation committees of IT and pharmaceutical groups established in Montpellier.",
          "Vocabulary adjusted to your dominant sector: health/medical, digital/IT, video games, agronomy/agri-food, engineering. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (health, IT, video games, agritech) and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (clinical reports, sales emails, product sheets, agronomic protocols) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Montpellier premises to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR sector-specific data, followed by participatory workshops adapted to your teams' professional culture.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case (medical writing, technical documentation, video-game content generation, agronomic analysis). Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department (R&D, sales, support, production, agronomy).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your transformation objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Montpellier establishments (Dell, IBM, Sanofi): multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly calibrated for our R&D team: medical vocabulary respected, demos on our own documents. The next day, our staff were already using AI on their regulatory write-ups.",
            role: "Head of R&D",
            companyProfile: "Medical device SME, Euromédecine",
          },
          {
            quote:
              "The executives session aligned us within hours on our studio's AI trajectory. Dense, pragmatic, rooted in our video-game realities — no generalities.",
            role: "Studio Director",
            companyProfile: "Independent video-game studio, Montpellier",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Montpellier take?",
            a: "It depends on the chosen format. The group format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you adapt content to healthcare sector specifics?",
            a: "Yes. Our trainers have references in medical, pharmaceutical and medical device contexts. The framing brief allows adjusting vocabulary, examples and demos — a session for a clinical team has nothing to do with one for a video-game studio.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma per profile. No Axion-IA lock-in — you keep control.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "Can you deliver in communes neighbouring Montpellier?",
            a: "Yes. Castelnau-le-Lez, Lattes, Pérols, Saint-Jean-de-Védas, Mauguio and peripheral business zones (Parc Agropolis, Sète tech area) are covered. Travel costs are quoted per commune.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector (health, IT, video games, agronomy), no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Montpellier met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec un kick-off obligatoire dans vos locaux montpelliérains. Nos équipes maîtrisent les contraintes sectorielles locales : HDS pour la santé, données de recherche agronomique, workflows IT et production jeux vidéo.",
        whyHere: [
          "Montpellier concentre des cas d'implémentation IA parmi les plus exigeants en France : données médicales sensibles (CHU, Euromédecine), pipelines R&D pharmaceutique (Sanofi), workflows IT complexes (Dell France, IBM) et production créative (Ubisoft Montpellier).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux montpelliérains : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/outils métier.",
          "Itérations à distance avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Montpellier : passation de pouvoir, formation des ambassadeurs IA internes installés sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques montpelliérains : PME biotech (analyse de résultats d'essais), ETI pharmaceutique (rédaction réglementaire automatisée), IT (qualification de leads B2B et support client), studios jeux vidéo (génération de contenus et documentation technique).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Montpellier : revue de l'architecture cible (CRM, ERP, outils métier), validation des contraintes RGPD/sécurité/sectorielles (HDS pour la santé, contraintes data recherche), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Montpellier : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX adaptés à vos utilisateurs.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Montpellier : tests d'acceptation utilisateurs, formation des ambassadeurs IA internes, livraison du runbook documentation, plan de monitoring post-déploiement.",
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
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME biotech, studios, agences IT de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, systèmes LIS/LIMS pour le médical, pipelines data science agronomie), formation cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les implantations montpelliéraines de grande taille (Dell, IBM, Sanofi) : cas cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation analyse de résultats d'essais livrée comme promis. ROI réel mesuré : temps de rédaction réglementaire divisé par trois, équivalents temps plein libérés sur les tâches de synthèse. Aucun lock-in, nous avons la main sur les modèles.",
            role: "DSI",
            companyProfile: "ETI pharmaceutique, Montpellier",
          },
          {
            quote:
              "Méthode hybride efficace : kick-off intense sur site, puis itérations à distance avec points courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up IT, Cap Omega Montpellier",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Montpellier ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Gérez-vous les contraintes de données de santé pour les déploiements biotech ?",
            a: "Oui. Nos déploiements santé respectent les exigences HDS, RGPD santé et MDR. Les modèles IA sont déployés sur votre infra ou sur infra dédiée certifiée HDS si requis, les données ne transitent pas chez Axion-IA.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions montpelliéraines. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs IA internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (données cliniques, résultats d'essais, contrats), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs IA internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Montpellier brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode with a mandatory kick-off at your Montpellier premises. Our teams master local sector constraints: HDS for healthcare, agronomic research data, IT and video-game production workflows.",
        whyHere: [
          "Montpellier hosts some of the most demanding AI implementation cases in France: sensitive medical data (CHU, Euromédecine), pharmaceutical R&D pipelines (Sanofi), complex IT workflows (Dell France, IBM) and creative production (Ubisoft Montpellier).",
          "Kick-off always happens in person at your Montpellier premises: team alignment, data access, CRM/ERP/business tool integration validation.",
          "Remote iterations with a short daily check-in on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Montpellier: handover, training of internal AI ambassadors on their workstations, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Montpellier cases: biotech SMEs (clinical trial result analysis), pharmaceutical ETI (automated regulatory writing), IT (B2B lead qualification and customer support), video-game studios (content generation and technical documentation).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Montpellier workshop: target architecture review (CRM, ERP, business tools), GDPR/security/sector constraints validation (HDS for healthcare, research data constraints), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Montpellier: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments adapted to your users.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Montpellier: user acceptance tests, training of internal AI ambassadors, runbook documentation delivery, post-deployment monitoring plan.",
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
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For biotech SMEs, studios, IT agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, LIS/LIMS for medical, agronomy data science pipelines), cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for large Montpellier establishments (Dell, IBM, Sanofi): cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Clinical trial result analysis implementation delivered as promised. Real ROI measured: regulatory writing time cut by three, FTEs freed from synthesis tasks. No lock-in, we control our models.",
            role: "CIO",
            companyProfile: "Pharmaceutical mid-cap, Montpellier",
          },
          {
            quote:
              "Efficient hybrid method: intense on-site kick-off, then remote iterations with short check-ins. Our IT team was never lost. Internal ambassadors take over autonomously.",
            role: "CTO",
            companyProfile: "IT scale-up, Cap Omega Montpellier",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Montpellier take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a large multi-deployment program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Do you handle health data constraints for biotech deployments?",
            a: "Yes. Our health deployments comply with HDS, health GDPR and MDR requirements. AI models are deployed on your infrastructure or on dedicated HDS-certified infra if required — data does not transit through Axion-IA.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Montpellier missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal AI ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (clinical data, trial results, contracts), continuous monitoring. The costed ROI in SOW includes realistic margin of error.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal AI ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Montpellier est un accompagnement individuel sur mesure : vous progressez à votre rythme, sur vos propres cas métier, avec un consultant dédié. À partir de {{price:intervention-dirigeants|flat}}. Adapté aux dirigeants, managers et experts des secteurs santé-biotech, IT, jeux vidéo et agronomie du bassin montpelliérain.",
        whyHere: [
          "Montpellier concentre des profils très différents — médecin ou data scientist chez Sanofi, studio director chez Ubisoft, directeur technique dans une PME Cap Omega — qui n'ont ni le même rythme ni les mêmes cas d'usage : le 1-to-1 est la seule formule qui s'adapte à chacun.",
          "L'écosystème santé d'Euromédecine impose des contraintes réglementaires (HDS, RGPD santé, MDR) que seul un accompagnement individuel peut intégrer dans chaque exercice pratique.",
          "Les studios jeux vidéo (Ubisoft Montpellier) et les startups French Tech Méditerranée ont des roadmaps produit très précises : le coaching calé sur votre backlog réel produit des gains immédiats.",
          "Les ETI industrielles de l'Hérault (Dell France, IBM, CIRAD) ont souvent un ou deux profils « référents IA » à former en priorité avant toute cascade équipe : le 1-to-1 est la voie la plus rapide.",
          "Séances sur site dans vos locaux montpelliérains (Cap Omega, Euromédecine, Agropolis, vos bureaux) ou à distance selon votre disponibilité — rythme calé à la signature.",
          "Confidentialité sans accord de confidentialité imposé : vos données, vos cas, votre contexte. Aucun document ne quitte votre environnement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage approfondi pour identifier votre niveau IA actuel, vos cas métier prioritaires (santé, IT, jeux vidéo, agro) et l'objectif précis du coaching.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Construction d'un plan séance par séance calé sur vos outils (Claude, Mistral, GPT-4, outils métier), vos livrables réels et vos contraintes sectorielles montpelliéraines.",
          },
          {
            step: "Séances pratiques sur vos vrais cas",
            detail:
              "Chaque séance travaille directement sur vos documents, vos prompts, votre workflow : rédaction médicale, documentation technique, génération de contenus jeux vidéo, analyse agronomique.",
          },
          {
            step: "Exercices entre séances",
            detail:
              "Micro-missions à réaliser en autonomie entre deux séances pour ancrer les apprentissages dans votre contexte réel et accélérer la progression.",
          },
          {
            step: "Bilan + feuille de route autonomie",
            detail:
              "En fin de coaching, un bilan chiffré de vos gains et une feuille de route d'autonomie pour continuer à progresser sans dépendance envers Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme multi-séances pour référents IA ou managers de PME santé-biotech, studios jeux vidéo ou agences IT de Montpellier.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement cadres dirigeants ETI (Dell France, IBM, CIRAD, Sanofi R&D) — programme structuré sur plusieurs mois avec bilan intermédiaire.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de la cellule IA ou des profils pilotes d'un grand groupe implanté à Montpellier, avant déploiement large en cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de configurer l'IA sur mes vrais dossiers de dispositifs médicaux en quelques séances. Vocabulaire médical respecté, cas HDS intégrés. Je suis autonome sur mes rédactions réglementaires.",
            role: "Directeur médical",
            companyProfile: "PME dispositifs médicaux, Euromédecine Montpellier",
          },
          {
            quote:
              "En tant que studio director, j'avais besoin d'un coaching calé sur la production jeux vidéo — pas un cours générique. Axion-IA a travaillé directement sur notre pipeline contenu Ubisoft-like. Résultat immédiat.",
            role: "Directeur de studio",
            companyProfile: "Studio jeux vidéo indépendant, Montpellier",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective à Montpellier ?",
            a: "Le format collectif forme tout un groupe sur les mêmes cas. Le 1-to-1 travaille exclusivement sur VOS cas, votre vitesse, vos contraintes sectorielles (HDS, données cliniques, pipeline jeux vidéo, données agronomiques). Résultat : gains opérationnels mesurables dès la première séance.",
          },
          {
            q: "Combien de séances faut-il pour être autonome sur l'IA à Montpellier ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Un dirigeant PME numérique atteint une autonomie confortable en quelques séances. Un manager ETI cherchant à maîtriser des intégrations avancées (HDS, pipelines agro) aura un programme plus étendu. Le plan est cadré à la première séance.",
          },
          {
            q: "Le coaching peut-il se tenir dans mes locaux montpelliérains ?",
            a: "Oui. Séances sur site dans vos locaux (Cap Omega, Euromédecine, Agropolis, vos bureaux) ou en visio selon votre disponibilité. Le choix est fait au cadrage.",
          },
          {
            q: "Mes données et documents restent-ils confidentiels pendant le coaching ?",
            a: "Oui. Confidentialité stricte dès le démarrage : vos données, vos prompts, vos cas restent dans votre environnement. Aucune extraction vers nos serveurs. Conformité RGPD et secteur santé (HDS sur demande).",
          },
          {
            q: "Puis-je commencer sans aucune base IA ?",
            a: "Oui. Le diagnostic initial évalue votre niveau réel et calibre le plan de progression en conséquence. Beaucoup de profils débutent sans avoir jamais utilisé Claude ou GPT de façon professionnelle.",
          },
          {
            q: "Y a-t-il un engagement minimum de durée ou de nombre de séances ?",
            a: "Non. Pas de lock-in, pas de contrat d'abonnement. Vous commencez par la première séance à {{price:intervention-dirigeants|flat}}. La suite se décide à l'issue de chaque séance selon votre progression et vos besoins.",
          },
        ],
        guarantees:
          "Pas de lock-in : aucun engagement de durée imposé. Confidentialité stricte sans accord de confidentialité requis — vos données restent dans votre environnement. Conformité RGPD et secteur santé (HDS sur demande). Si à l'issue de la première séance vous estimez que le coaching ne correspond pas à vos attentes, première séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Montpellier is an individual, bespoke engagement: you progress at your own pace, on your own business cases, with a dedicated consultant. From €990 excl. VAT. Suited to executives, managers and experts in health-biotech, IT, video games and agronomy across the Montpellier basin.",
        whyHere: [
          "Montpellier brings together very diverse profiles — a physician or data scientist at Sanofi, a studio director at Ubisoft, a technical lead at a Cap Omega SME — who have different paces and use cases: 1-to-1 is the only format that adapts to each.",
          "The Euromédecine health ecosystem imposes regulatory constraints (HDS, health GDPR, MDR) that only individual coaching can integrate into each practical exercise.",
          "Video-game studios (Ubisoft Montpellier) and French Tech Méditerranée startups have precise product roadmaps: coaching aligned with your real backlog produces immediate gains.",
          "Hérault industrial mid-caps (Dell France, IBM, CIRAD) often have one or two priority 'AI champions' to train before any team cascade: 1-to-1 is the fastest route.",
          "Sessions on site at your Montpellier offices (Cap Omega, Euromédecine, Agropolis, your offices) or remote depending on availability — cadence agreed at sign-up.",
          "Confidentiality without imposed accord de confidentialité: your data, your cases, your context. No document leaves your environment.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "An in-depth framing interview to identify your current AI level, priority business cases (health, IT, video games, agro) and the precise coaching objective.",
          },
          {
            step: "Personalized progression plan",
            detail:
              "Building a session-by-session plan aligned with your tools (Claude, Mistral, GPT-4, business tools), your real deliverables and your Montpellier sector constraints.",
          },
          {
            step: "Practical sessions on your real cases",
            detail:
              "Each session works directly on your documents, prompts, workflow: medical writing, technical documentation, video-game content generation, agronomic analysis.",
          },
          {
            step: "Between-session exercises",
            detail:
              "Micro-missions to complete autonomously between sessions to embed learnings in your real context and accelerate progress.",
          },
          {
            step: "Debrief + autonomy roadmap",
            detail:
              "At coaching end, a costed gains summary and an autonomy roadmap to keep progressing without dependence on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Multi-session programme for AI champions or managers of Montpellier health-biotech SMEs, video-game studios or IT agencies.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Executive coaching for mid-cap managers (Dell France, IBM, CIRAD, Sanofi R&D) — structured multi-month programme with interim review.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Coaching of the AI cell or pilot profiles of a large group based in Montpellier, before broad team cascade rollout.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching let me configure AI on my real medical device files within a few sessions. Medical vocabulary respected, HDS cases integrated. I am autonomous on my regulatory writing.",
            role: "Medical Director",
            companyProfile: "Medical device SME, Euromédecine Montpellier",
          },
          {
            quote:
              "As a studio director, I needed coaching aligned with video-game production — not a generic course. Axion-IA worked directly on our Ubisoft-like content pipeline. Immediate results.",
            role: "Studio Director",
            companyProfile: "Independent video-game studio, Montpellier",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from a group session in Montpellier?",
            a: "Group format trains a whole team on the same cases. 1-to-1 works exclusively on YOUR cases, your pace, your sector constraints (HDS, clinical data, video-game pipeline, agronomic data). Result: measurable operational gains from the first session.",
          },
          {
            q: "How many sessions are needed to become AI-autonomous in Montpellier?",
            a: "It depends on your starting level and objectives. A digital micro-business executive reaches comfortable autonomy in a few sessions. A mid-cap manager seeking advanced integrations (HDS, agro pipelines) will have a longer programme. The plan is framed in the first session.",
          },
          {
            q: "Can coaching sessions be held at my Montpellier premises?",
            a: "Yes. On-site sessions at your offices (Cap Omega, Euromédecine, Agropolis, your offices) or via video depending on availability. The choice is made at framing.",
          },
          {
            q: "Does my data stay confidential during coaching?",
            a: "Yes. Strict confidentiality from day one: your data, prompts and cases stay in your environment. No extraction to our servers. GDPR compliance and health sector (HDS on request).",
          },
          {
            q: "Can I start with no AI background?",
            a: "Yes. The initial diagnostic assesses your real level and calibrates the progression plan accordingly. Many profiles start without ever having used Claude or GPT professionally.",
          },
          {
            q: "Is there a minimum duration or session commitment?",
            a: "No. No lock-in, no subscription contract. You start with the first session at €990 excl. VAT. Continuation is decided after each session based on your progress and needs.",
          },
        ],
        guarantees:
          "No lock-in: no imposed duration commitment. Strict confidentiality without required accord de confidentialité — your data stays in your environment. GDPR compliance and health sector (HDS on request). If after the first session you feel the coaching does not meet your expectations, first session fully refunded.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Montpellier des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Montpellier, itérations à distance.",
        whyHere: [
          "Projets web & SaaS montpelliérains : jeux vidéo (Ubisoft, 2e pôle France), santé-biotech (Euromédecine, CHU), agrotech (Agropolis : CIRAD, INRAE, IRD), tech (Dell), scale-ups French Tech Méditerranée.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Gaming & expériences interactives, ou data santé/agro RGPD : on adapte la brique IA à votre secteur, hébergement UE strict.",
        ],
        methodology: [
          {
            step: "Cadrage à Montpellier",
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
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour studios, scale-ups et PME montpelliéraines.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, santé ou agrotech sur mesure, IA intégrée, branchée sur votre SI (CRM, ERP, datalake), hébergement HDS sur demande.",
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
            a: "Oui. On conçoit l'expérience complète à Montpellier — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous travaillez pour la santé et l'agrotech ?",
            a: "Oui : plateformes data, RAG, agents et portails pour la santé (Euromédecine, CHU) et l'agrotech (Agropolis). Hébergement UE, RGPD strict, HDS (santé) sur demande — vos données sensibles ne sortent pas de votre périmètre.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région montpelliéraine ou repris en interne.",
      },
      en: {
        hero: "In Montpellier, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Montpellier kick-off, remote iterations.",
        whyHere: [
          "Montpellier web & SaaS projects: video games (Ubisoft, France's 2nd hub), health-biotech (Euromédecine, university hospital), agritech (Agropolis: CIRAD, INRAE, IRD), tech (Dell), French Tech Méditerranée scale-ups.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Gaming & interactive experiences, or GDPR health/agri data: we adapt the AI brick to your sector, strict EU hosting.",
        ],
        methodology: [
          {
            step: "Scoping in Montpellier",
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
              "Design or rebuild of a site or app with UX/UI and built-in AI, for studios, scale-ups and Montpellier SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, health or agritech platform, AI built in, wired into your IS (CRM, ERP, datalake), HDS hosting on request.",
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
            a: "Yes. We design the full experience in Montpellier — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you work for health and agritech?",
            a: "Yes: data platforms, RAG, agents and portals for health (Euromédecine, hospital) and agritech (Agropolis). EU hosting, strict GDPR, HDS (health) on request — your sensitive data stays within your perimeter.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Montpellier-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Montpellier ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (PME, ETI et grands groupes, grande entreprise) et votre secteur. Aucun supplément géographique : le tarif est identique à Montpellier comme partout en France.",
    },
    {
      q: "Intervenez-vous dans les entreprises du parc Euromédecine ?",
      a: "Oui. Euromédecine est l'un de nos pôles d'intervention prioritaires à Montpellier. Nos auditeurs et formateurs maîtrisent les contraintes HDS, RGPD santé et MDR. Références dans les dispositifs médicaux, la biotech et le pharmaceutique disponibles sur demande.",
    },
    {
      q: "Travaillez-vous avec les startups French Tech Méditerranée ?",
      a: "Oui. Nous accompagnons régulièrement les startups et scale-ups du label French Tech Méditerranée, du BIC Montpellier et de Cap Omega. Notre formation collective est calibrée pour les structures avec un product-market fit établi qui veulent passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "Quels secteurs sont prioritaires à Montpellier ?",
      a: "Nos déploiements montpelliérains couvrent prioritairement la santé et la biotech (Euromédecine, CHU, Sanofi R&D), le numérique et l'IT (Dell France, IBM, Cap Omega), les industries créatives et jeux vidéo (Ubisoft, studios indépendants) et l'agronomie-agroalimentaire (Agropolis, Institut Agro, INRAE). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux montpelliérains ?",
      a: "Oui. Toutes nos interventions à Montpellier sont par défaut sur site, dans vos bureaux ou vos espaces de travail. Nos consultants couvrent la Métropole de Montpellier et les communes du bassin héraultais. Les ateliers d'idéation et les restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "Gérez-vous les données de recherche agronomique sensibles pour les interventions à Agropolis ?",
      a: "Oui. Nos déploiements dans les organismes de recherche (CIRAD, INRAE, IRD, Institut Agro) respectent les protocoles de confidentialité des données de recherche. Confidentialité stricte assurée en cadrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs.",
    },
  ],
};
