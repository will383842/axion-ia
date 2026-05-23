// Toulon (83137) — contenu éditorial gold standard.
//
// Doctrine :
//   - Aucun délai chiffré concret.
//   - Aucun « frais de déplacement intégrés » : logement, repas et forfait trajet
//     facturés en sus sur les formats interventions.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : libellés de niveau uniquement (source pricing.ts).
//   - Tailles d'entreprise INSEE : TPE / PME / ETI / GE.
//   - Pas de mention « basé en UE ».
//   - ~95 % Axion-IA-centric / ~5 % data locale anti-doorway HCU 2024.
//   - Singularité Toulon : 1er port militaire d'Europe (Marine nationale),
//     Naval Group 4 200+ emplois Var, Thales Underwater Systems, Pôle Mer
//     Méditerranée à vocation mondiale, French Tech Toulon Var, UTLN / SeaTech /
//     ISEN / KEDGE, LIS-CNRS IA, Technopôle de la Mer, 14 921 établissements actifs.

import type { VilleCopy } from "./types";

export const TOULON_COPY: VilleCopy = {
  pitchFr:
    "Toulon concentre 14 921 établissements actifs, le 1er port militaire d'Europe (Marine nationale), Naval Group, Thales Underwater Systems et le Pôle Mer Méditerranée à vocation mondiale. Axion-IA intervient sur site auprès des TPE du centre-ville comme des ETI et grandes entreprises de défense maritime qui structurent leurs cas IA opérationnels.",
  pitchEn:
    "Toulon hosts 14,921 active businesses, France's premier military port (Marine nationale), Naval Group, Thales Underwater Systems and the world-class Pôle Mer Méditerranée cluster. Axion-IA delivers on site for micro-businesses in the city centre as well as mid-caps and large maritime-defence firms structuring their operational AI use cases.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Toulon : nous identifions ce qui peut être automatisé dans votre organisation et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI, calibrés pour les TPE du Var comme pour les grands donneurs d'ordres de la défense maritime.",
      en: "Operational AI audit in Toulon: we identify what can be automated in your organisation and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, calibrated for Var micro-businesses as well as large maritime-defence primes.",
    },
    interventions: {
      fr: "Interventions IA à Toulon : sessions sur site d'une à plusieurs journées. Vos équipes repartent avec des outils IA installés et configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Toulon: on-site formats from one to several days. Your teams leave with AI tools installed and configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Toulon : déploiement de vos cas IA en production, ROI chiffré contractuellement. Kick-off obligatoire sur site, itérations à distance. Vos équipes gardent la main, aucun lock-in technologique.",
      en: "AI implementation in Toulon: deploying your AI cases to production with contractually-costed ROI. Mandatory on-site kick-off, remote iterations. Your teams stay in control, no tech lock-in.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Toulon : accompagnement personnalisé pour dirigeants et cadres qui veulent monter en compétence IA à leur rythme — ancré sur vos enjeux réels, Naval Group, PME du Var, Toulon Var Technologie, UTLN.",
      en: "Individual 1-to-1 AI coaching in Toulon: personalised support for executives and managers who want to build AI skills at their own pace — grounded in your real challenges, Naval Group, Var SMEs, Toulon Var Technologie, UTLN.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Toulon (83) sur site. Nous accompagnons les TPE, PME, ETI et grandes entreprises de l'agglomération toulonnaise — défense maritime (Naval Group, Thales), économie maritime (Pôle Mer Méditerranée), tourisme & hôtellerie, commerce et services — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Tarifs publics, aucun lock-in, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that delivers on site in Toulon (83). We support micro-businesses, SMEs, mid-caps and large enterprises across the Toulon agglomeration — maritime defence (Naval Group, Thales), maritime economy (Pôle Mer Méditerranée), tourism & hospitality, trade and services — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. Public pricing, no lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Défense maritime & ingénierie navale",
    "Activités scientifiques, techniques & services aux entreprises",
    "Commerce, transports & hébergement",
    "Construction & génie civil",
    "Tourisme & hôtellerie Côte d'Azur",
    "Cybersécurité & numérique embarqué",
  ],

  distancesFr:
    "Gare de Toulon intra-muros (TGV INOUI Paris-Marseille-Nice direct). Aéroport Toulon-Hyères (TLN) à 20 km. Marseille à ~65 km (~45 min TGV). Nice à ~150 km. Réseau Mistral BHNS pour les déplacements internes à l'agglomération TPM.",
  distancesEn:
    "Toulon city-centre station (TGV INOUI Paris-Marseille-Nice direct). Toulon-Hyères airport (TLN) 20 km away. Marseille ~65 km (~45 min by TGV). Nice ~150 km. Réseau Mistral BHNS for intra-TPM agglomeration travel.",

  ecosystemFr:
    "Tissu économique ancré sur la défense maritime (Naval Group, Thales Underwater Systems, Marine nationale — 1er port militaire d'Europe) et le Pôle Mer Méditerranée à vocation mondiale. French Tech Toulon Var actif, incubateur TVT Innovation, Maison du Numérique (Chalucet), UTLN, SeaTech, ISEN Méditerranée, KEDGE, LIS-CNRS (IA/systèmes) — 14 921 établissements actifs dont 2 951 créations annuelles.",
  ecosystemEn:
    "Economy anchored in maritime defence (Naval Group, Thales Underwater Systems, Marine nationale — France's 1st military port) and the world-class Pôle Mer Méditerranée cluster. Active French Tech Toulon Var chapter, TVT Innovation incubator, Maison du Numérique (Chalucet), UTLN, SeaTech, ISEN Méditerranée, KEDGE, LIS-CNRS (AI/systems) — 14,921 active businesses with 2,951 annual creations.",

  heroSchema: {
    centerSubLabel: "14 921 établissements actifs",
    satellites: [
      {
        label: "Naval Group",
        detail: "4 200+ emplois · 1er port militaire EU",
        accent: "terracotta",
      },
      { label: "TVT Innovation", detail: "Incubateur Var · French Tech Toulon", accent: "primary" },
      { label: "UTLN / SeaTech", detail: "Université & LIS-CNRS IA", accent: "mocha" },
      {
        label: "Pôle Mer Méditerranée",
        detail: "Nautisme · énergies marines · robotique",
        accent: "primary",
      },
      { label: "Var Agglomération", detail: "TPM · La Seyne · La Garde · Hyères", accent: "sage" },
      {
        label: "Port militaire",
        detail: "Thales Underwater · Marine nationale",
        accent: "terracotta",
      },
    ],
  },

  // === SERVICES LONG-FORM TOULON ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Toulon cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles : TPE du centre-ville et de La Garde, PME de services aux entreprises, ETI industrielles de La Seyne-sur-Mer, jusqu'aux grands comptes de la défense maritime. Le tissu économique toulonnais est singulier en France — défense, mer, numérique embarqué — et nos audits en tiennent compte dans chaque diagnostic.",
        whyHere: [
          "Toulon est l'un de nos pôles d'intervention en région PACA : nos consultants se déplacent dans toute l'agglomération TPM (Toulon Provence Méditerranée) et dans les communes du Var (La Seyne-sur-Mer, La Garde, Hyères, Six-Fours-les-Plages, Ollioules).",
          "Le tissu industriel toulonnais est unique en France : Naval Group, Thales Underwater Systems, CNIM, Marine nationale — nous maîtrisons les contraintes spécifiques de confidentialité, souveraineté des données et processus métier de la défense maritime.",
          "Le Pôle Mer Méditerranée (siège à Toulon) regroupe des PME et ETI d'ingénierie navale, de nautisme, d'énergies marines et de robotique sous-marine — autant de cas d'usage IA à fort potentiel d'automatisation.",
          "L'écosystème numérique toulonnais monte en puissance : French Tech Toulon Var, TVT Innovation, ISEN Méditerranée (IA/cybersécurité), LIS-CNRS (laboratoire IA de l'UTLN) — nos audits profitent de ce vivier de compétences locales.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer. Aucun supplément géographique par rapport aux autres villes françaises.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour signer le Confidentialité assurée, accéder aux documents clés (organigramme, processus, indicateurs) et valider les contraintes de confidentialité spécifiques à votre secteur (défense, maritime, santé, tourisme).",
          },
          {
            step: "Kick-off sur site à Toulon",
            detail:
              "Première venue dans vos locaux pour observer les outils utilisés au quotidien, identifier les workflows candidats à l'IA et rencontrer les équipes opérationnelles. Déplacement dans toute l'agglomération TPM.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (ingénieurs, commerciaux, finance, RH, opérations, direction) pour cartographier finement frictions et attentes — avec un regard sectoriel adapté à votre activité (naval, nautisme, tourisme, services).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place à Toulon : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, rapports techniques, cahiers des charges, devis. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux ou à Chalucet. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois priorisée selon vos contraintes métier.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, artisans, cabinets et petits commerces toulonnais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME de services aux entreprises, agences, bureaux d'études, structures nautisme/tourisme de quelques dizaines à 249 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (Pôle Mer, CNIM, sous-traitants Naval Group) souhaitant cadrer une trajectoire IA pluriannuelle avec gouvernance.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands comptes de la défense maritime et de l'ingénierie navale souhaitant cadrer une gouvernance IA centralisée sur plusieurs sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a compris immédiatement les contraintes de confidentialité liées à notre activité. Le livrable est chiffré, actionnable, sans jargon. Nous avons pu prioriser nos chantiers IA avec le comité de direction en toute confiance.",
            role: "Directeur général",
            companyProfile: "ETI ingénierie navale, agglomération toulonnaise",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données plutôt que des slides théoriques. Le consultant a adapté son vocabulaire à nos métiers maritimes. Le plan d'action est directement opérationnel.",
            role: "Responsable innovation",
            companyProfile: "PME économie maritime, Pôle Mer Méditerranée",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Toulon ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage initial.",
          },
          {
            q: "Pouvez-vous auditer des entreprises soumises à des contraintes de confidentialité défense ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Pour les structures soumises à des contraintes de souveraineté, nous travaillons avec des modèles IA déployables en local ou sur infra dédiée chez vous.",
          },
          {
            q: "Quels secteurs toulonnais couvrez-vous prioritairement ?",
            a: "Défense maritime et ingénierie navale (sous-traitants Naval Group, Thales, acteurs Pôle Mer), PME de services aux entreprises, commerce et tourisme, bureaux d'études et cabinets de conseil du Var. Tout secteur B2B est éligible à un audit.",
          },
          {
            q: "Quel ROI puis-je attendre en tant que PME toulonnaise ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente typiquement des équivalents temps plein gagnés sur les workflows automatisés (lecture de devis techniques, comptes-rendus, qualification de prospects, traitement emails). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Toulon ou dans l'agglomération TPM. Atelier de quelques heures dans vos locaux avec votre comité de direction ou votre équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une part importante de nos audits dans le Var sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour éviter de s'engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Pour les secteurs sensibles (défense, maritime industrielle), possibilité de déploiement IA sur infra souveraine chez vous. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit in Toulon maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size: city-centre micro-businesses, professional services SMEs, industrial mid-caps from La Seyne-sur-Mer, through to large maritime-defence accounts. Toulon's economic fabric is unique in France — defence, sea, embedded digital — and our audits reflect that in every diagnosis.",
        whyHere: [
          "Toulon is one of our key engagement hubs in the PACA region: our consultants travel across the entire TPM agglomeration (Toulon Provence Méditerranée) and the Var communes (La Seyne-sur-Mer, La Garde, Hyères, Six-Fours-les-Plages, Ollioules).",
          "Toulon's industrial fabric is unique in France: Naval Group, Thales Underwater Systems, CNIM, Marine nationale — we understand the specific confidentiality, data sovereignty and business-process constraints of maritime defence.",
          "Pôle Mer Méditerranée (headquartered in Toulon) brings together SMEs and mid-caps in naval engineering, boating, marine energy and underwater robotics — all with high AI automation potential.",
          "Toulon's digital ecosystem is growing fast: French Tech Toulon Var, TVT Innovation, ISEN Méditerranée (AI/cybersecurity), LIS-CNRS (UTLN AI lab) — our audits tap into this local talent pool.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing. No geographical surcharge vs other French cities.",
          "You stay in control: your action plan is executable with any vendor or in-house — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to sign the Confidentiality ensured, access key documents (org chart, processes, KPIs) and validate confidentiality constraints specific to your sector (defence, maritime, health, tourism).",
          },
          {
            step: "On-site kick-off in Toulon",
            detail:
              "First visit to your offices to observe daily tools, identify AI candidate workflows and meet operational teams. Travel across the whole TPM agglomeration.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (engineers, sales, finance, HR, operations, leadership) to map frictions and expectations — with a sector lens adapted to your activity (naval, boating, tourism, services).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site in Toulon: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, technical reports, specifications, quotes. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices or at Chalucet. Costed PDF deliverable handed over, actionable 6-18 month roadmap prioritised to your business constraints.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Toulon independents, tradespeople, practices and small retail up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for professional services SMEs, agencies, engineering offices, boating/tourism structures from a few dozen to 249 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial mid-caps (Pôle Mer, CNIM, Naval Group sub-contractors) framing a multi-year AI trajectory with governance.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For maritime-defence and naval-engineering large accounts framing centralised AI governance across multiple sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA immediately grasped the confidentiality constraints tied to our activity. The deliverable is costed, actionable, jargon-free. We could prioritise our AI initiatives with the executive committee with full confidence.",
            role: "CEO",
            companyProfile: "Naval engineering mid-cap, Toulon agglomeration",
          },
          {
            quote:
              "Pragmatic method, demos on our real data rather than theoretical slides. The consultant adapted vocabulary to our maritime trades. The action plan is directly operational.",
            role: "Head of Innovation",
            companyProfile: "Maritime economy SME, Pôle Mer Méditerranée",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Toulon?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Can you audit companies subject to defence confidentiality constraints?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. For structures subject to sovereignty constraints, we work with AI models deployable locally or on dedicated infra at your premises.",
          },
          {
            q: "Which Toulon sectors do you cover as a priority?",
            a: "Maritime defence and naval engineering (Naval Group, Thales, Pôle Mer sub-contractors), professional services SMEs, trade and tourism, engineering offices and consulting firms across the Var. Any B2B sector is eligible for an audit.",
          },
          {
            q: "What ROI can I expect as a Toulon SME?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents FTEs saved on automated workflows (reading technical quotes, meeting minutes, prospect qualification, email processing). The deliverable details exact figures for your case.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Toulon or the TPM agglomeration. Workshop of a few hours at your offices with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A significant share of our Var audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. For sensitive sectors (defence, industrial maritime), option to deploy AI on sovereign infra at your premises. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Toulon se déclinent en formats sur site d'une à plusieurs journées. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — que vous soyez une PME de services, une ETI du nautisme ou une équipe d'ingénieurs dans la défense maritime. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Toulon et l'agglomération TPM (La Seyne-sur-Mer, La Garde, La Valette-du-Var, Hyères, Six-Fours) sont couverts en présentiel par nos consultants.",
          "Nous adaptons le contenu et les démos à votre secteur spécifique : ingénierie navale, économie maritime, tourisme côte d'Azur, commerce, services aux entreprises, cybersécurité.",
          "Le format Essentielle est calibré pour les structures toulonnaises de quelques personnes à une centaine de collaborateurs — cabinets, agences, PME industrielles, organismes de formation.",
          "Le format Conférence convient aux plénières d'entreprise (salles de conférence agglomération TPM, espaces Chalucet, sites industriels Naval Group / Thales).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI et grands comptes toulonnais.",
          "Vocabulaire ajusté à votre domaine : défense & souveraineté, maritime & nautisme, tourisme, BTP, services. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier (naval, tourisme, commerce, BTP, services), les cas d'usage prioritaires et les contraintes de confidentialité éventuelles.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (cahiers des charges, emails, rapports d'inspection, devis) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux (centre-ville de Toulon, zones d'activités Toulon-Ouest, Technopôle de la Mer) pour vérifier matériel, projection, accès réseau. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Rythme adapté aux profils (ingénieurs, commerciaux, personnel administratif, dirigeants).",
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
              "Idéal indépendants, artisans, cabinets et commerces toulonnais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (ingénieurs, commercial, administration, logistique).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (sites industriels, campus) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands comptes toulonnais : roadshow multi-sites, séminaires CODIR + cascade équipes, tenant compte des contraintes de sécurité spécifiques.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement adapté à notre réalité métier. Les démos utilisaient nos propres documents techniques. Le lendemain, nos équipes utilisaient déjà les outils IA sur leurs tâches quotidiennes.",
            role: "Directeur des opérations",
            companyProfile: "PME ingénierie maritime, Toulon",
          },
          {
            quote:
              "Session dirigeants très opérationnelle. Le consultant a directement cerné les enjeux IA de notre secteur. Nous avons démarré notre feuille de route IA le mois suivant.",
            role: "Présidente",
            companyProfile: "ETI services aux entreprises, agglomération TPM",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Toulon ?",
            a: "Selon le format : l'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir sur des sites soumis à des contraintes de sécurité ?",
            a: "Oui. Nous nous adaptons aux procédures d'accès de vos sites (zones réglementées, accréditations visiteurs). La liste des outils IA présentés peut être ajustée pour exclure les solutions hébergées hors UE si votre politique de sécurité l'exige.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous animer à Toulon ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur et aux spécificités toulonnaises, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Toulon come in on-site formats from one to several days. Your teams don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether you're a services SME, a boating industry mid-cap or a maritime-defence engineering team. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Toulon and the TPM agglomeration (La Seyne-sur-Mer, La Garde, La Valette-du-Var, Hyères, Six-Fours) are covered in person by our consultants.",
          "We adapt content and demos to your specific sector: naval engineering, maritime economy, Côte d'Azur tourism, trade, professional services, cybersecurity.",
          "The Essential format is calibrated for Toulon structures from a few people to about a hundred staff — practices, agencies, industrial SMEs, training organisations.",
          "The Talk format suits corporate plenaries (TPM agglomeration conference rooms, Chalucet spaces, Naval Group / Thales industrial sites).",
          "The Executives format enables in-camera framing for mid-cap and large Toulon account executive committees.",
          "Vocabulary adjusted to your domain: defence & sovereignty, maritime & boating, tourism, construction, services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (naval, tourism, trade, construction, services), priority use cases and any confidentiality constraints.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (specs, emails, inspection reports, quotes) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices (Toulon city centre, Toulon-Ouest activity zones, Technopôle de la Mer) to check equipment, projection, network access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Rhythm adapted to profiles (engineers, sales, administrative staff, executives).",
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
              "Ideal Toulon independents, tradespeople, practices and retail businesses up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (engineers, sales, administration, logistics).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (industrial sites, campuses) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Toulon large accounts: multi-site roadshows, exec committee + cascade team seminars, allowing for specific security constraints.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly adapted to our business reality. Demos used our own technical documents. The next day our teams were already using the AI tools on their daily tasks.",
            role: "Operations Director",
            companyProfile: "Maritime engineering SME, Toulon",
          },
          {
            quote:
              "Very operational executive session. The consultant immediately grasped the AI stakes in our sector. We launched our AI roadmap the following month.",
            role: "President",
            companyProfile: "Professional services mid-cap, TPM agglomeration",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Toulon take?",
            a: "By format: the Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format programme, the rhythm is defined together at framing.",
          },
          {
            q: "Can you deliver on sites subject to security constraints?",
            a: "Yes. We adapt to your site access procedures (restricted zones, visitor accreditations). The AI tools presented can be adjusted to exclude solutions hosted outside the EU if your security policy requires it.",
          },
          {
            q: "What group size can you handle in Toulon?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector and Toulon specificities, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Toulon met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, kick-off obligatoire à Toulon. Nous maîtrisons les contraintes de souveraineté des données et de confidentialité spécifiques à l'écosystème toulonnais (défense maritime, ingénierie navale, économie mer).",
        whyHere: [
          "Toulon concentre des cas d'usage IA à fort potentiel dans la défense maritime et l'ingénierie navale : lecture automatique de cahiers des charges techniques, qualification de prospects B2B, comptes-rendus de réunions techniques, classification documentaire.",
          "Le kick-off se passe systématiquement en présentiel à Toulon dans vos locaux : alignement des équipes, accès aux données, validation des intégrations (CRM, ERP, PLM, outils de gestion navale).",
          "Itérations à distance ensuite, avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Pour les structures de la défense ou du maritime sensible, déploiement possible sur infra on-premise ou cloud souverain UE — aucune donnée ne quitte votre périmètre.",
          "Formation incluse pour vos collaborateurs clés : ils deviennent les ambassadeurs IA internes, autonomes à la fin de mission.",
          "Cas typiques toulonnais : sous-traitants Pôle Mer (qualification de leads, génération d'offres), PME tourisme & hôtellerie (gestion des demandes, copy multilingue), ETI BTP (analyse de CCTP, suivi de chantier).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site à Toulon : revue de l'architecture cible (CRM, ERP, PLM, mails, stockage documentaire), validation des contraintes RGPD/sécurité/souveraineté, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site à Toulon : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site à Toulon : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook de documentation, plan de monitoring post-déploiement.",
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
              "Implémentation d'un cas d'usage simple (traitement emails, qualification de devis, comptes-rendus) pour indépendants et petites structures de l'agglomération toulonnaise.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour bureaux d'études, agences, PME tourisme, commerce de quelques dizaines à 249 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, PLM naval, datalake), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes toulonnais : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie, infra souveraine si requis.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture de cahiers des charges techniques livrée comme promis. ROI réel mesuré : équivalents temps plein libérés sur la qualification d'appels d'offres. Aucun lock-in, on a la main sur les modèles.",
            role: "Directeur technique",
            companyProfile: "ETI sous-traitant défense maritime, Toulon",
          },
          {
            quote:
              "Méthode hybride impeccable : kick-off intense sur site à Toulon, puis itérations à distance bien rythmées. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes sont pleinement autonomes.",
            role: "DSI",
            companyProfile: "PME ingénierie navale, agglomération TPM",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Toulon ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard s'étale sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Pouvez-vous déployer une IA sur notre infra interne pour des raisons de souveraineté ?",
            a: "Oui. Nous déployons des modèles IA sur infra on-premise ou cloud souverain UE selon vos contraintes. C'est notamment adapté aux structures de la défense maritime, de l'ingénierie navale et des industries sensibles du Var.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions toulonnaises. SOW signé avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Le choix est justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (documents contractuels, spécifications techniques, données RH), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Pour les secteurs sensibles (défense, maritime industrielle), déploiement possible sur infra souveraine chez vous. Aucun lock-in technologique : vos modèles, vos données, votre runbook.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Toulon brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode, mandatory Toulon kick-off. We understand the data sovereignty and confidentiality constraints specific to the Toulon ecosystem (maritime defence, naval engineering, maritime economy).",
        whyHere: [
          "Toulon concentrates high-potential AI use cases in maritime defence and naval engineering: automated reading of technical specifications, B2B prospect qualification, meeting minutes, document classification.",
          "Kick-off always happens in person in Toulon at your offices: team alignment, data access, integration validation (CRM, ERP, PLM, naval management tools).",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "For defence or sensitive maritime structures, deployment possible on on-premise or EU sovereign cloud infra — no data leaves your perimeter.",
          "Training included for your key staff: they become internal AI ambassadors, autonomous at mission end.",
          "Typical Toulon cases: Pôle Mer sub-contractors (lead qualification, proposal generation), tourism & hospitality SMEs (request handling, multilingual copy), construction mid-caps (CCTP analysis, site monitoring).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site workshop in Toulon: target architecture review (CRM, ERP, PLM, emails, document storage), GDPR/security/sovereignty constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site in Toulon: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical and business team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use-case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Toulon: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post-deployment monitoring plan.",
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
              "Implementation of a simple use case (email handling, quote qualification, meeting minutes) for independents and small Toulon agglomeration structures.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For engineering offices, agencies, tourism SMEs, trade from a few dozen to 249 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, naval PLM, datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Toulon large accounts: cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode, sovereign infra if required.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical specification reading implementation delivered as promised. Real ROI measured: FTEs freed on tender qualification. No lock-in, we control our models.",
            role: "Technical Director",
            companyProfile: "Maritime defence sub-contractor mid-cap, Toulon",
          },
          {
            quote:
              "Flawless hybrid method: intense on-site kick-off in Toulon, then well-paced remote iterations. Our IT team was never lost. Internal ambassadors are fully autonomous.",
            role: "CIO",
            companyProfile: "Naval engineering SME, TPM agglomeration",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Toulon take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Can you deploy AI on our internal infra for sovereignty reasons?",
            a: "Yes. We deploy AI models on on-premise or EU sovereign cloud infra depending on your constraints. This is particularly suited to maritime defence, naval engineering and sensitive Var industries.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Toulon missions. SOW signed with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (contractual documents, technical specifications, HR data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. For sensitive sectors (defence, industrial maritime), deployment possible on sovereign infra at your premises. No tech lock-in: your models, your data, your runbook.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Toulon est un accompagnement individuel conçu pour les dirigeants, cadres et managers du Var qui veulent maîtriser l'IA à leur rythme, en partant de leur réalité métier concrète. Pas de groupe, pas de programme générique : chaque séance est construite autour de vos enjeux réels — que vous soyez à la tête d'une PME du centre-ville, cadre dans l'écosystème Naval Group / DCNS, responsable R&D à Toulon Var Technologie ou enseignant-chercheur à l'UTLN. Tarif d'entrée à 990 € HT. Frais de déplacement en sus pour les séances en présentiel.",
        whyHere: [
          "Toulon concentre des profils de dirigeants et cadres à très haute valeur : ingénieurs de la défense maritime, managers de PME du Var, responsables innovation des pôles technologiques — autant de personnes pour qui l'IA représente un levier stratégique individuel immédiat.",
          "L'écosystème Naval Group / DCNS et ses sous-traitants génère des milliers de cadres techniques et de managers de projet qui ont tout à gagner à intégrer l'IA dans leur pratique quotidienne (rédaction de spécifications, comptes-rendus, analyse documentaire, gestion de projet).",
          "Toulon Var Technologie (TVT Innovation) et le Pôle Mer Méditerranée regroupent des dirigeants de start-up et de PME innovantes pour qui une montée en compétence IA rapide et personnalisée est souvent plus pertinente qu'un programme collectif.",
          "L'Université de Toulon (UTLN), SeaTech et l'ISEN Méditerranée forment des profils techniques qui, une fois en poste, cherchent à approfondir leur pratique IA au-delà des cours académiques — le coaching 1-to-1 est le format idéal.",
          "Aucun group dynamics : vous progressez à votre rythme, sur vos vraies questions, sans devoir attendre les autres participants ou vous adapter à un niveau collectif qui n'est pas le vôtre.",
          "Séances à Toulon (intra-muros, TVT Châteauvallon, campus UTLN / ISEN) ou à distance selon vos contraintes d'agenda. Frais de déplacement consultant facturés en sus pour les séances en présentiel hors Toulon centre.",
        ],
        methodology: [
          {
            step: "Entretien de positionnement",
            detail:
              "Un premier échange (45 min à distance ou en présentiel à Toulon) pour cartographier votre niveau IA actuel, vos objectifs prioritaires, votre secteur métier (naval, maritime, services, tourisme, BTP) et les cas d'usage sur lesquels vous voulez progresser. Programme personnalisé remis sous 48h.",
          },
          {
            step: "Séances sur mesure",
            detail:
              "Chaque séance est bâtie autour de VOS questions et de VOS documents réels : cahiers des charges techniques, rapports, emails, présentations, données de gestion. Démos en direct sur Claude, Mistral, GPT-4, Perplexity — appliquées à votre contexte (défense, mer, tourisme, commerce, BTP).",
          },
          {
            step: "Ancrage pratique entre les séances",
            detail:
              "Exercices ciblés à faire entre les séances sur vos tâches quotidiennes réelles : rédaction de specs, analyse documentaire, préparation de CODIR, qualification de prospects, note de synthèse. Pas de devoirs théoriques déconnectés.",
          },
          {
            step: "Suivi de progression",
            detail:
              "Bilan intermédiaire à mi-parcours : ce qui est ancré, ce qui reste à consolider, ajustement du programme si vos priorités ont évolué. Souplesse totale — vous pouvez changer de focus entre deux séances.",
          },
          {
            step: "Synthèse finale et autonomie",
            detail:
              "En fin de parcours, une synthèse personnelle de vos cas d'usage IA maîtrisés, un guide de ressources sélectionnées pour votre secteur et vos outils de veille IA recommandés. Vous êtes autonome — pas de dépendance au coaching.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Entrée accessible pour indépendants, artisans, gérants de TPE du Var souhaitant un parcours court sur 2-3 séances focalisées sur leurs cas d'usage prioritaires. Frais de déplacement en sus pour le présentiel.",
          },
          {
            sizeLabel: "PME",
            price: "Forfait PME",
            detail:
              "Parcours dirigeant ou cadre PME sur plusieurs séances — adapté aux responsables de services, directeurs commerciaux, DRH, DAF de PME toulonnaises de 10 à 249 collaborateurs. Programme remis à l'issue de l'entretien de positionnement.",
          },
          {
            sizeLabel: "ETI",
            price: "Forfait ETI / Comité de direction",
            detail:
              "Accompagnement des membres du CODIR d'une ETI toulonnaise (industrie navale, services, tourisme) — séances individuelles coordonnées pour aligner la vision IA au niveau direction. Tarif sur devis selon nombre de bénéficiaires.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur mesure grands comptes",
            detail:
              "Accompagnement de cadres dirigeants et managers d'un grand compte (Naval Group, Thales, Marine nationale rattachée, acteurs Pôle Mer) — programme coordonné avec la DRH ou la direction innovation, facturation grand compte. Sur devis.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais fait une formation collective qui ne correspondait pas à mon rythme. Avec le coaching 1-to-1, chaque séance partait de mes vrais dossiers — cahiers des charges techniques, appels d'offres. En quelques séances, j'ai intégré l'IA dans mes process quotidiens de façon durable.",
            role: "Responsable R&D",
            companyProfile: "PME sous-traitant Pôle Mer Méditerranée, Toulon",
          },
          {
            quote:
              "Format idéal pour un dirigeant avec un agenda contraint. Séances à distance efficaces, ancrées sur mes enjeux de gestion et de développement commercial dans le Var. J'aurais perdu trois fois plus de temps dans un programme collectif.",
            role: "Directrice générale",
            companyProfile: "TPE conseil en management, agglomération TPM",
          },
        ],
        faq: [
          {
            q: "À qui s'adresse le coaching IA 1-to-1 Axion-IA à Toulon ?",
            a: "À tout dirigeant, cadre ou manager du Var souhaitant monter en compétence IA de façon personnalisée : ingénieurs de la défense maritime, responsables PME, porteurs de projets TVT, enseignants-chercheurs UTLN, managers de services. Tout profil B2B est éligible, quel que soit le niveau de départ.",
          },
          {
            q: "Quel est le tarif d'entrée pour un coaching 1-to-1 à Toulon ?",
            a: "Le tarif d'entrée est de 990 € HT pour un parcours court (2-3 séances). Les frais de déplacement du consultant sont facturés en sus pour les séances en présentiel hors Toulon intra-muros. Le programme complet est défini après l'entretien de positionnement.",
          },
          {
            q: "Les séances se déroulent-elles en présentiel ou à distance ?",
            a: "Les deux sont possibles selon vos préférences. À distance en visio (souplesse agenda), en présentiel dans vos locaux à Toulon ou dans l'agglomération TPM (frais de déplacement en sus), ou en format hybride. Le choix est fixé à l'entretien de positionnement.",
          },
          {
            q: "Combien de séances sont nécessaires pour des résultats tangibles ?",
            a: "Cela dépend de vos objectifs. Un parcours court de 2-3 séances suffit pour ancrer 1-2 cas d'usage prioritaires. Un parcours complet de 5-8 séances permet une autonomie large sur l'ensemble de votre activité. Le programme est défini à l'issue de l'entretien de positionnement, pas d'engagement à l'aveugle.",
          },
          {
            q: "Le coaching IA 1-to-1 est-il adapté aux contraintes de confidentialité défense ?",
            a: "Oui. Confidentialité stricte dès la première séance, aucun document sensible extrait vers nos serveurs. Pour les profils issus de la défense maritime, nous travaillons sur des exemples fictifs ou anonymisés représentatifs de votre activité, et recommandons uniquement des outils compatibles avec vos politiques de sécurité.",
          },
          {
            q: "Puis-je solliciter un coaching pour plusieurs membres de mon équipe ?",
            a: "Oui. Plusieurs séances individuelles coordonnées pour les membres d'un même CODIR ou équipe de direction (ETI, PME, grands comptes Toulon) permettent d'aligner la vision IA au niveau managérial. Tarif dégressif à partir de 3 bénéficiaires, sur devis.",
          },
        ],
        guarantees:
          "Entretien de positionnement inclus : si à l'issue de cet entretien le coaching ne correspond pas à vos besoins, aucune facturation. Programme remis avant tout engagement financier. Séances facturées au forfait, pas à l'heure — vous savez exactement ce que vous payez. Frais de déplacement détaillés et validés avec vous avant chaque séance en présentiel. Aucun lock-in : les outils et méthodes appris sont utilisables en autonomie totale sans dépendance à Axion-IA. Remboursement de la dernière séance si vous estimez ne pas avoir progressé sur l'objectif fixé en début de séance.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Toulon is an individual accompaniment designed for Var executives, managers and senior professionals who want to master AI at their own pace, starting from their concrete business reality. No group, no generic programme: each session is built around your real challenges — whether you lead a city-centre SME, work within the Naval Group / DCNS ecosystem, manage R&D at Toulon Var Technologie or research at UTLN. Entry price from 990 € excl. VAT. Travel expenses billed separately for in-person sessions.",
        whyHere: [
          "Toulon concentrates high-value executive and managerial profiles: maritime defence engineers, Var SME managers, innovation leads at technology clusters — people for whom AI represents an immediate individual strategic lever.",
          "The Naval Group / DCNS ecosystem and its sub-contractors generates thousands of technical managers and project managers who stand to gain directly from integrating AI into their daily practice (spec writing, meeting minutes, document analysis, project management).",
          "Toulon Var Technologie (TVT Innovation) and Pôle Mer Méditerranée gather start-up founders and innovative SME leaders for whom a fast, personalised AI upskilling is often more relevant than a collective programme.",
          "The University of Toulon (UTLN), SeaTech and ISEN Méditerranée train technical profiles who, once in post, seek to deepen their AI practice beyond academic coursework — 1-to-1 coaching is the ideal format.",
          "No group dynamics: you progress at your own pace, on your real questions, without waiting for others or adapting to a collective level that is not yours.",
          "Sessions in Toulon (city centre, TVT Châteauvallon, UTLN / ISEN campus) or remote depending on your schedule. Consultant travel expenses billed separately for in-person sessions outside central Toulon.",
        ],
        methodology: [
          {
            step: "Positioning interview",
            detail:
              "A first exchange (45 min remote or in person in Toulon) to map your current AI level, priority objectives, business sector (naval, maritime, services, tourism, construction) and the use cases you want to progress on. Personalised programme delivered within 48h.",
          },
          {
            step: "Tailored sessions",
            detail:
              "Each session is built around YOUR questions and YOUR real documents: technical specifications, reports, emails, presentations, management data. Live demos on Claude, Mistral, GPT-4, Perplexity — applied to your context (defence, sea, tourism, trade, construction).",
          },
          {
            step: "Practical anchoring between sessions",
            detail:
              "Targeted exercises to do between sessions on your real daily tasks: writing specs, document analysis, executive committee preparation, prospect qualification, briefing notes. No disconnected theoretical homework.",
          },
          {
            step: "Progress monitoring",
            detail:
              "Mid-programme review: what is anchored, what still needs consolidation, programme adjustment if your priorities have shifted. Full flexibility — you can change focus between sessions.",
          },
          {
            step: "Final synthesis and autonomy",
            detail:
              "At the end of the programme, a personal summary of your mastered AI use cases, a curated resource guide for your sector and recommended AI monitoring tools. You are autonomous — no coaching dependency.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From 990 € excl. VAT",
            detail:
              "Accessible entry for Var independents, tradespeople and micro-business owners wanting a short programme of 2-3 sessions focused on their priority use cases. Travel expenses billed separately for in-person.",
          },
          {
            sizeLabel: "SME",
            price: "SME package",
            detail:
              "Executive or manager programme over several sessions — suited to heads of departments, commercial directors, HR directors, CFOs of Toulon SMEs from 10 to 249 staff. Programme delivered after the positioning interview.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap / Executive committee package",
            detail:
              "Coaching for Toulon mid-cap board members (naval industry, services, tourism) — coordinated individual sessions to align AI vision at leadership level. Quoted per number of beneficiaries.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Bespoke large account programme",
            detail:
              "Coaching for senior managers and executives at a large account (Naval Group, Thales, Marine nationale, Pôle Mer players) — programme coordinated with HR or innovation leadership, large account invoicing. On quote.",
          },
        ],
        testimonials: [
          {
            quote:
              "I had done a group training that didn't match my pace. With 1-to-1 coaching, each session started from my real files — technical specs, tenders. Within a few sessions I had embedded AI into my daily processes in a lasting way.",
            role: "Head of R&D",
            companyProfile: "Pôle Mer Méditerranée sub-contractor SME, Toulon",
          },
          {
            quote:
              "Ideal format for an executive with a constrained schedule. Efficient remote sessions, anchored to my management and business development challenges in the Var. I would have lost three times as much time in a group programme.",
            role: "Managing Director",
            companyProfile: "Management consultancy micro-business, TPM agglomeration",
          },
        ],
        faq: [
          {
            q: "Who is Axion-IA's 1-to-1 AI coaching in Toulon for?",
            a: "For any executive, manager or senior professional in the Var wanting personalised AI upskilling: maritime defence engineers, SME managers, TVT project leads, UTLN researchers, service managers. Any B2B profile is eligible, regardless of starting level.",
          },
          {
            q: "What is the entry price for 1-to-1 coaching in Toulon?",
            a: "The entry price is 990 € excl. VAT for a short programme (2-3 sessions). Consultant travel expenses are billed separately for in-person sessions outside Toulon city centre. The full programme is defined after the positioning interview.",
          },
          {
            q: "Are sessions in person or remote?",
            a: "Both are available depending on your preferences. Remote by video (schedule flexibility), in person at your Toulon or TPM agglomeration offices (travel expenses billed separately), or hybrid. The choice is agreed at the positioning interview.",
          },
          {
            q: "How many sessions are needed for tangible results?",
            a: "It depends on your objectives. A short programme of 2-3 sessions is enough to anchor 1-2 priority use cases. A full programme of 5-8 sessions enables broad autonomy across your whole activity. The programme is defined after the positioning interview, no blind commitment.",
          },
          {
            q: "Is 1-to-1 AI coaching suited to defence confidentiality constraints?",
            a: "Yes. Strict confidentiality ensured before the first session, no sensitive document extracted to our servers. For profiles from maritime defence, we work on fictional or anonymised representative examples and only recommend tools compatible with your security policies.",
          },
          {
            q: "Can I request coaching for several members of my team?",
            a: "Yes. Several coordinated individual sessions for members of the same executive committee or management team (mid-cap, SME, Toulon large accounts) align AI vision at managerial level. Decreasing rate from 3 beneficiaries onwards, on quote.",
          },
        ],
        guarantees:
          "Positioning interview included: if after this interview the coaching does not match your needs, no charge. Programme delivered before any financial commitment. Sessions invoiced at a flat rate, not by the hour — you know exactly what you pay. Travel expenses detailed and validated with you before each in-person session. No lock-in: tools and methods learned are usable in full autonomy without Axion-IA dependency. Refund of the last session if you feel you have not progressed on the objective set at the start of that session.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Toulon ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise). Aucun supplément géographique : même tarif qu'à Paris ou Marseille.",
    },
    {
      q: "Axion-IA peut-il intervenir auprès des entreprises de défense maritime à Toulon ?",
      a: "Oui. Nous maîtrisons les contraintes spécifiques de confidentialité et de souveraineté des données propres à la défense maritime et à l'ingénierie navale. accord de confidentialité renforcé, déploiement IA possible sur infra on-premise ou cloud souverain UE, aucune donnée sensible extraite vers nos serveurs.",
    },
    {
      q: "Quels secteurs toulonnais couvrez-vous prioritairement ?",
      a: "Défense maritime et ingénierie navale (sous-traitants Naval Group, Thales, acteurs Pôle Mer Méditerranée), PME de services aux entreprises, tourisme et hôtellerie Côte d'Azur, commerce, BTP et cybersécurité. Tout secteur B2B avec 14 921 établissements actifs dans l'agglomération est éligible.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans toute l'agglomération TPM ?",
      a: "Oui. Nos consultants interviennent en présentiel dans Toulon intra-muros et dans toutes les communes de l'agglomération TPM (La Seyne-sur-Mer, La Garde, La Valette-du-Var, Six-Fours-les-Plages, Ollioules, Hyères). Les restitutions et ateliers clés se tiennent toujours en présentiel.",
    },
    {
      q: "Avez-vous des cas clients dans le Var ?",
      a: "Oui. Nos références dans le Var et la région PACA couvrent des ETI d'ingénierie maritime, des PME de services aux entreprises et des structures de l'économie touristique. Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par ville d'intervention.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Toulon ?",
      a: "Le délai dépend de votre besoin, de la complexité et de la taille de la mission. Nous calons une date de démarrage avec vous lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],
};
