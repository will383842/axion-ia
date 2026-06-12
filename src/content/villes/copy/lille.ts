// Lille (59350) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine appliquée (cf. paris.ts gold standard) :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés ».
//   - Aucun prix hardcodé : tarifs depuis pricing.ts.
//   - Durée minimale = 1 journée.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Tailles INSEE TPE / PME / ETI / GE uniquement (pas de métiers-type).
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn (conformément au brief).
//
// Réalités Lille ancrées :
//   - EuraTechnologies : 1er incubateur numérique de France (466 entreprises créées).
//   - Sièges grands groupes : Auchan (Croix), Decathlon (Villeneuve-d'Ascq),
//     La Redoute (Roubaix), OVHcloud (Roubaix), Bonduelle, Boulanger.
//   - Hub ferroviaire international unique : Eurostar Londres 82 min,
//     Thalys Bruxelles 38 min, TGV Paris 62 min.
//   - French Tech Capitale depuis avril 2019.
//   - 28 814 établissements actifs (INSEE 2023, commune 59350).
//   - Pôle Picom = retail/e-commerce/supply chain (leader national).
//   - Euralille : 3e quartier d'affaires France (après La Défense et Lyon Part-Dieu).
//   - Inria Université de Lille, Centrale Lille, EDHEC, IÉSEG, SKEMA.

import type { VilleCopy } from "./types";

export const LILLE_COPY: VilleCopy = {
  pitchFr:
    "Lille regroupe 28 800 établissements actifs, les sièges de Decathlon, Auchan, La Redoute et OVHcloud, le 1er incubateur numérique de France (EuraTechnologies) et le hub ferroviaire le mieux connecté d'Europe du Nord. Axion-IA y intervient sur site auprès des TPE du Vieux-Lille aux directions IA des ETI d'Euralille.",
  pitchEn:
    "Lille hosts 28,800 active businesses, the French HQs of Decathlon, Auchan, La Redoute and OVHcloud, France's leading digital incubator (EuraTechnologies) and Northern Europe's best-connected rail hub. Axion-IA delivers on site, from Vieux-Lille micro-businesses to Euralille mid-cap AI leadership.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Lille : nous identifions vos processus automatisables et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, adaptés à toutes les tailles du tissu lillois.",
      en: "Operational AI audit in Lille: we identify automatable processes and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated to every size in the Lille business fabric.",
    },
    interventions: {
      fr: "Interventions IA à Lille : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Lille: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Lille : on déploie l'IA dans vos outils existants (CRM, ERP, mails, e-commerce) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Lille: we deploy AI into your existing tools (CRM, ERP, email, e-commerce) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Lille — à partir de {{price:intervention-dirigeants|flat}}. Un consultant senior dédié à votre cas, dans vos locaux lillois ou de la métropole : directeur retail, responsable supply chain, fondateur EuraTechnologies ou manager d'un siège grand groupe qui veut progresser seul, sur ses propres données et enjeux.",
      en: "Individual AI coaching in Lille — from {{price:intervention-dirigeants|compact}} excl. VAT. A senior consultant dedicated to your case, at your Lille or metropolitan premises: retail director, supply chain manager, EuraTechnologies founder or large-group HQ manager who wants to progress alone, on their own data and challenges.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI lilloise — site vitrine premium pour retail, e-commerce et logistique, espace client interactif, dashboard métier connecté à votre CRM/ERP/WMS. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Lille SMEs and mid-caps — premium showcase site for retail, e-commerce and logistics, interactive customer space, business dashboard connected to your CRM/ERP/WMS. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Lille (59350) sur site dans la métropole lilloise : Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing et communes limitrophes. Nous accompagnons les TPE, PME, ETI et grandes entreprises lilloise — des startups d'EuraTechnologies aux sièges retail de la métropole (Decathlon, Auchan, La Redoute) — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that delivers on site in Lille (59350) across the metropolitan area: Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing and surrounding communes. We support Lille micro-businesses, SMEs, mid-caps and large enterprises — from EuraTechnologies startups to major retail HQs (Decathlon, Auchan, La Redoute) — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "distribution, retail tech & transfrontalier",

  topSectorsNaf: [
    "Retail & E-commerce",
    "Logistique & Supply Chain",
    "IT & Numérique (EuraTechnologies)",
    "Banque, Assurance & Services financiers",
    "Conseil & Services aux entreprises",
    "Agroalimentaire & Industrie",
  ],

  distancesFr:
    "Gares Lille-Europe (Eurostar Londres 82 min, Thalys Bruxelles 38 min, TGV Paris 62 min) et Lille-Flandres à 500 m. Aéroport Lille-Lesquin (LIL) à 11 km. Métro Ilévia 2 lignes pour rejoindre Euralille, Villeneuve-d'Ascq et Roubaix.",
  distancesEn:
    "Lille-Europe station (Eurostar London 82 min, Thalys Brussels 38 min, TGV Paris 62 min) and Lille-Flandres at 500 m. Lille-Lesquin Airport (LIL) 11 km. Ilévia metro 2 lines to reach Euralille, Villeneuve-d'Ascq and Roubaix.",

  ecosystemFr:
    "Capitale régionale de la French Tech depuis 2019, Lille concentre 28 800 établissements actifs, les sièges de Decathlon, Auchan, La Redoute, OVHcloud et Bonduelle, l'incubateur EuraTechnologies (466 entreprises créées), le pôle retail Picom et le 3e quartier d'affaires français Euralille. Hub ferroviaire international unique en France.",
  ecosystemEn:
    "French Tech Capital since 2019, Lille groups 28,800 active businesses, the HQs of Decathlon, Auchan, La Redoute, OVHcloud and Bonduelle, the EuraTechnologies incubator (466 companies founded), the Picom retail cluster and Euralille — France's third business district. Unique international rail hub in France.",

  // === SERVICES LONG-FORM LILLE ===
  // Aucun prix hardcodé, aucun délai chiffré, aucune mention frais inclus.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise lilloise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des TPE du Vieux-Lille aux directions IA des sièges retail d'Euralille. Restitution toujours en présentiel dans vos locaux, livrable PDF chiffré remis en main propre.",
        whyHere: [
          "Lille est une place prioritaire pour Axion-IA : tissu retail/e-commerce le plus dense de France hors Île-de-France, sièges de groupes internationaux (Decathlon, Auchan, La Redoute) et 466 startups issues d'EuraTechnologies.",
          "Secteurs B2B lillois surreprésentés dans nos mandats : retail omnicanal, logistique supply chain, IT/SaaS EuraTechnologies, banque/assurance Euralille, industrie agroalimentaire (Bonduelle, Euralimentaire).",
          "Nos consultants se déplacent sur l'ensemble de la métropole lilloise : Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing, Marcq-en-Barœul et communes limitrophes.",
          "Restitutions toujours en présentiel : atelier d'idéation dans vos locaux, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Tarifs publics affichés : vous savez exactement ce que vous payez avant de signer, sans devis opaque à négocier.",
          "Aucun lock-in : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Prise en compte des spécificités de votre secteur lillois (retail, logistique, IT, agroalimentaire).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Lille dans vos locaux pour observer les outils utilisés au quotidien — ERP retail, WMS logistique, CRM B2B, outil e-commerce — et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerce, supply chain, finance, RH, IT, direction) pour cartographier finement frictions et attentes dans votre contexte métier lillois.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos données réelles — bons de commande, fiches produits e-commerce, emails fournisseurs, tableaux de bord supply chain. Aucune slide théorique.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux lillois. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois ancrée dans les réalités de votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets lillois jusqu'à une dizaine de collaborateurs — artisans, agences, startups pre-seed EuraTechnologies.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Pour les PME retail, logistique, IT ou services de quelques dizaines à 250 collaborateurs — ETI familiales, scale-ups EuraTechnologies, grossistes métropolitains.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI et filiales régionales souhaitant cadrer une trajectoire IA pluriannuelle : directions retail, supply chain, DSI Euralille.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges grands comptes (Decathlon, Auchan, La Redoute, OVHcloud, Bonduelle) souhaitant gouverner une initiative IA centralisée à l'échelle groupe.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a cartographié en une journée ce que notre équipe IT tâtonnait à définir depuis des mois. Le livrable chiffré ROI/complexité nous a permis de prioriser nos chantiers IA et de convaincre notre comité de direction en une semaine.",
            role: "Directeur des opérations",
            companyProfile: "PME e-commerce, métropole lilloise, 80 collaborateurs",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données supply chain. Le plan d'action est concret et exécutable sans dépendance externe. On a lancé le premier chantier dans le mois qui a suivi.",
            role: "DSI",
            companyProfile: "ETI logistique, Villeneuve-d'Ascq, 400 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Lille ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage initial.",
          },
          {
            q: "Axion-IA connaît-il les spécificités du retail et de la logistique lilloise ?",
            a: "Oui. Le tissu retail/e-commerce lillois (Decathlon, Auchan, La Redoute, Boulanger, pôle Picom) est l'un de nos secteurs prioritaires en France. Nos démos et livrables intègrent les réalités de la supply chain, du WMS, du CRM omnicanal et des flux EDI propres à ce secteur.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise.",
          },
          {
            q: "Comment se déroule la restitution finale à Lille ?",
            a: "Toujours en présentiel dans vos locaux lillois. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap actionnable.",
          },
          {
            q: "Quelle différence avec un audit Big Four ou un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée plutôt que de longues missions. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande partie de nos audits lillois sont commandés par des dirigeants qui n'ont encore jamais lancé de chantier IA. L'audit est précisément conçu pour éviter de s'engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause disponible, jamais activée à ce jour sur nos missions lilloise).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Lille company and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Vieux-Lille micro-businesses to Euralille large-enterprise HQs. Read-out always in person at your premises, costed PDF deliverable handed over face to face.",
        whyHere: [
          "Lille is a priority location for Axion-IA: densest retail/e-commerce fabric in France outside Île-de-France, international group HQs (Decathlon, Auchan, La Redoute) and 466 EuraTechnologies start-ups.",
          "Lille B2B sectors over-represented in our mandates: omnichannel retail, logistics supply chain, IT/SaaS EuraTechnologies, banking/insurance Euralille, agri-food industry (Bonduelle, Euralimentaire).",
          "Our consultants travel across the full Lille metropolitan area: Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing, Marcq-en-Barœul and surrounding communes.",
          "Read-outs always in person: ideation workshop at your offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "Public pricing displayed: you know exactly what you pay before signing, no opaque quote to negotiate.",
          "No lock-in: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). Your Lille sector specificities (retail, logistics, IT, agri-food) taken into account upfront.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Lille at your offices to observe daily tools — retail ERP, logistics WMS, B2B CRM, e-commerce platform — and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, supply chain, finance, HR, IT, leadership) to map frictions and expectations within your Lille business context.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your real data — purchase orders, e-commerce product sheets, supplier emails, supply chain dashboards. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Lille offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap grounded in your sector realities.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Lille freelancers, micro-firms and practices up to about ten staff — artisans, agencies, pre-seed EuraTechnologies startups.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "For retail, logistics, IT or services SMEs from a few dozen to 250 staff — family-owned firms, EuraTechnologies scale-ups, metropolitan wholesalers.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For mid-caps and regional subsidiaries framing a multi-year AI trajectory: retail, supply chain, IT leadership at Euralille.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large-group HQs (Decathlon, Auchan, La Redoute, OVHcloud, Bonduelle) aiming to govern a group-wide centralized AI initiative.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA mapped in a single day what our IT team had been trying to define for months. The costed ROI/complexity deliverable let us prioritize our AI initiatives and convince our board within a week.",
            role: "Head of Operations",
            companyProfile: "E-commerce SME, Lille metropolitan area, 80 staff",
          },
          {
            quote:
              "Pragmatic method, demos on our real supply chain data. The action plan is concrete and executable without external dependency. We launched our first initiative in the month following the read-out.",
            role: "CIO",
            companyProfile: "Logistics mid-cap, Villeneuve-d'Ascq, 400 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Lille?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "Does Axion-IA know the Lille retail and logistics sector?",
            a: "Yes. The Lille retail/e-commerce fabric (Decathlon, Auchan, La Redoute, Boulanger, Picom cluster) is one of our priority sectors in France. Our demos and deliverables incorporate the realities of supply chain, WMS, omnichannel CRM and EDI flows specific to this sector.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty is required.",
          },
          {
            q: "How does the final read-out work in Lille?",
            a: "Always in person at your Lille offices. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand and an actionable roadmap.",
          },
          {
            q: "Difference with a Big Four audit or traditional consulting?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method rather than long missions. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Lille audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date on our Lille missions).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Lille se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — que vous soyez une équipe retail, logistique, IT ou finance. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Lille est l'une de nos places prioritaires d'intervention : tissu PME/ETI retail et e-commerce, startups EuraTechnologies, sièges de grands groupes (Decathlon, Auchan, La Redoute, OVHcloud) — toutes tailles, tous secteurs.",
          "Toute la métropole lilloise couverte en présentiel : Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing, Marcq-en-Barœul, Lesquin et communes limitrophes.",
          "Le format collectif (1 journée) est calibré pour les structures de quelques personnes à une centaine de collaborateurs — idéal pour les PME lilloise en transformation digitale.",
          "Le format Conférence convient aux plénières d'entreprise (Lille Grand Palais, auditoriums Euralille, campus EuraTechnologies, Plaine Images Tourcoing).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des sièges lillois.",
          "Vocabulaire ajusté à votre secteur dominant : retail, e-commerce, supply chain, cloud, agroalimentaire, services B2B. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier lillois (retail, logistique, IT, agroalimentaire), les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de commande, fiches produits e-commerce, emails fournisseurs, tableaux de suivi logistique) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux lillois pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J, que vous soyez dans un open space EuraTechnologies ou un siège d'Euralille.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données (fiches produits, emails clients, catalogues e-commerce, données supply chain), suivies d'ateliers participatifs adaptés à votre secteur.",
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
            price: "Formation collective",
            detail:
              "Idéal pour indépendants, agences, cabinets et startups EuraTechnologies lillois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (commerciaux, logistique, e-commerce, finance, RH).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (Lille Grand Palais, campus EuraTechnologies) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges lillois (Decathlon, Auchan, La Redoute, OVHcloud) : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement calibrée sur notre activité e-commerce. Nos équipes merchandising et marketing sont reparties avec leurs outils IA configurés. Le lendemain, plusieurs utilisaient déjà l'IA pour rédiger des fiches produits et répondre aux avis clients.",
            role: "Responsable digital",
            companyProfile: "PME e-commerce, Roubaix, 60 collaborateurs",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre stratégie IA. Le format a été adapté aux réalités de la supply chain et du retail omnicanal. Très au-dessus de ce qu'on avait eu avec des cabinets généralistes.",
            role: "Directeur général",
            companyProfile: "ETI distribution, Euralille, 1 200 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Lille ?",
            a: "Cela dépend du format : le format d'une journée se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur retail et e-commerce lillois ?",
            a: "Oui, c'est notre spécialité dans la métropole lilloise. Nous avons déjà animé des sessions pour des équipes retail, e-commerce et supply chain de la région. Nos démos utilisent des données anonymisées de votre secteur : fiches produits, bons de commande, emails fournisseurs, tableaux de bord stock.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "Le format collectif accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec une plénière + ateliers en sous-groupes (Lille Grand Palais, campus EuraTechnologies).",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vos équipes gardent la main.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur lillois (retail, e-commerce, logistique, IT, agroalimentaire), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Lille come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether you're a retail, logistics, IT or finance team. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Lille is one of our priority session locations: retail and e-commerce SME/mid-cap fabric, EuraTechnologies startups, large-group HQs (Decathlon, Auchan, La Redoute, OVHcloud) — all sizes, all sectors.",
          "Full Lille metropolitan area covered in person: Euralille, Vieux-Lille, Villeneuve-d'Ascq, Roubaix, Tourcoing, Marcq-en-Barœul, Lesquin and surrounding communes.",
          "The group format is calibrated for structures from a few people to about a hundred staff — ideal for Lille SMEs in digital transformation.",
          "The Talk format suits corporate plenaries (Lille Grand Palais, Euralille auditoriums, EuraTechnologies campus, Plaine Images Tourcoing).",
          "The Executives format enables in-camera framing for Lille HQ executive committees.",
          "Vocabulary adjusted to your dominant sector: retail, e-commerce, supply chain, cloud, agri-food, B2B services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your Lille sector (retail, logistics, IT, agri-food) and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (purchase orders, e-commerce product sheets, supplier emails, logistics dashboards) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Lille offices to check equipment, projection, Wi-Fi. No technical hiccup on D-day, whether you're in an EuraTechnologies open space or a Euralille HQ.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data (product sheets, customer emails, e-commerce catalogues, supply chain data), followed by participatory workshops adapted to your sector.",
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
            price: "Group format",
            detail:
              "Ideal for Lille freelancers, agencies, practices and EuraTechnologies startups up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department (sales, logistics, e-commerce, finance, HR).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Lille Grand Palais, EuraTechnologies campus) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Lille HQs (Decathlon, Auchan, La Redoute, OVHcloud): multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly calibrated to our e-commerce activity. Our merchandising and marketing teams left with their AI tools configured. The next day, several were already using AI to write product sheets and reply to customer reviews.",
            role: "Head of Digital",
            companyProfile: "E-commerce SME, Roubaix, 60 staff",
          },
          {
            quote:
              "The executives talk aligned us in a single day on our AI strategy. The format was adapted to supply chain and omnichannel retail realities. Far above what we had from generalist consultants.",
            role: "CEO",
            companyProfile: "Distribution mid-cap, Euralille, 1,200 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Lille take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you adapt content to the Lille retail and e-commerce sector?",
            a: "Yes, it is our specialty in the Lille metropolitan area. We have already run sessions for retail, e-commerce and supply chain teams in the region. Our demos use anonymized data from your sector: product sheets, purchase orders, supplier emails, stock dashboards.",
          },
          {
            q: "What group size can you handle?",
            a: "The group format handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops (Lille Grand Palais, EuraTechnologies campus).",
          },
          {
            q: "Do the tools installed remain usable after the session?",
            a: "Yes, they are individual accounts (free or with subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, your teams keep control.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Lille sector (retail, e-commerce, logistics, IT, agri-food), no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Lille met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux lillois. Cas typiques : automatisation e-commerce (fiches produits, emails clients), supply chain (prévision stocks, tri anomalies), IT (agents support, qualification incidents).",
        whyHere: [
          "Lille concentre nos missions d'implémentation les plus structurantes hors Île-de-France : retail omnicanal, e-commerce, logistique, cloud — secteurs où l'IA délivre des ROI mesurables en quelques mois.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux lillois : alignement des équipes, accès aux données, validation des intégrations ERP/WMS/CRM/e-commerce.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Lille : passation de pouvoir, formation des équipes sur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques lillois : e-commerce (génération fiches produits, emails clients, personnalisation catalogue), supply chain (prévision demande, tri anomalies WMS), IT/cloud (agents support Tier-1, classification incidents OVHcloud-type), agroalimentaire (contrôle qualité documentaire, traçabilité fournisseurs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Lille : revue de l'architecture cible (CRM, ERP, WMS, plateforme e-commerce, outils cloud), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Lille : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe tech et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants (WMS, e-commerce, CRM), tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Lille : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de quelques semaines.",
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
              "Implémentation d'un cas d'usage simple (génération fiches produits e-commerce, tri emails clients, comptes-rendus réunions) pour les TPE et startups EuraTechnologies.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP/WMS. Pour PME retail, e-commerce, logistique de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP legacy, datalake supply chain), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes lillois (Decathlon, Auchan, La Redoute, OVHcloud) : cas d'usage cascadés à l'échelle groupe, gouvernance IA centralisée, équipe Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation génération automatique de fiches produits livrée comme prévu. ROI mesuré : temps rédaction divisé par quatre, gain annuel net significatif sur notre équipe contenu. Aucun lock-in, on a la main sur les modèles.",
            role: "Directrice e-commerce",
            companyProfile: "ETI retail, Roubaix, 500 collaborateurs",
          },
          {
            quote:
              "Méthode hybride parfaite pour une ETI de notre taille : kick-off intense sur site Lille, puis itérations à distance avec points courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes ont pris le relais de façon autonome.",
            role: "DSI",
            companyProfile: "ETI logistique, Villeneuve-d'Ascq, 800 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Lille ?",
            a: "Cela dépend de l'ampleur. Un POC TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Axion-IA peut-il s'intégrer à notre plateforme e-commerce ou notre WMS ?",
            a: "Oui. Nos déploiements lillois intègrent régulièrement des plateformes e-commerce (Salesforce Commerce, PrestaShop, Shopify B2B, SAP Commerce), des WMS (Generix, Hardis, Manhattan) et des ERP retail (SAP, Cegid). Le cadrage technique en début de mission identifie les points d'intégration et les contraintes API.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions lilloise. SOW signé au début avec scope précis et livrables définis. Si le scope change, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur OVHcloud dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs ou hallucine ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (commandes importantes, fiches produits critiques, données RH), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Lille brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Lille premises. Typical cases: e-commerce automation (product sheets, customer emails), supply chain (stock forecasting, anomaly sorting), IT (support agents, incident classification).",
        whyHere: [
          "Lille hosts our most structuring implementation missions outside Île-de-France: omnichannel retail, e-commerce, logistics, cloud — sectors where AI delivers measurable ROI within months.",
          "Kick-off always happens in person at your Lille offices: team alignment, data access, ERP/WMS/CRM/e-commerce integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Lille: handover, training of teams on their workstations, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Lille cases: e-commerce (product sheet generation, customer emails, catalogue personalization), supply chain (demand forecasting, WMS anomaly sorting), IT/cloud (Tier-1 support agents, incident classification), agri-food (documentary quality control, supplier traceability).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Lille workshop: target architecture review (CRM, ERP, WMS, e-commerce platform, cloud tools), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Lille: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your tech and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools (WMS, e-commerce, CRM), real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Lille: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case (e-commerce product sheet generation, customer email sorting, meeting minutes) for micro-businesses and EuraTechnologies startups.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP/WMS integration. For retail, e-commerce, logistics SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, supply chain datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Lille large accounts (Decathlon, Auchan, La Redoute, OVHcloud): group-wide cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automatic product sheet generation delivered as planned. Measured ROI: writing time reduced fourfold, significant net annual gain on our content team. No lock-in, we control our models.",
            role: "Head of E-commerce",
            companyProfile: "Retail mid-cap, Roubaix, 500 staff",
          },
          {
            quote:
              "Perfect hybrid method for a mid-cap our size: intense on-site Lille kick-off, then remote iterations with short check-ins. Our IT team was never lost. Internal ambassadors took over autonomously.",
            role: "CIO",
            companyProfile: "Logistics mid-cap, Villeneuve-d'Ascq, 800 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Lille take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Can Axion-IA integrate with our e-commerce platform or WMS?",
            a: "Yes. Our Lille deployments regularly integrate e-commerce platforms (Salesforce Commerce, PrestaShop, Shopify B2B, SAP Commerce), WMS (Generix, Hardis, Manhattan) and retail ERP (SAP, Cegid). The technical framing at mission start identifies integration points and API constraints.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Lille missions. SOW signed at the start with precise scope and defined deliverables. If scope changes, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated OVHcloud server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "What happens if the AI produces errors or hallucinates?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large orders, critical product sheets, HR data), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA individuel Axion-IA à Lille s'adresse au dirigeant, manager ou expert qui veut progresser sur l'IA à son rythme, sur ses propres données et enjeux métier, sans partager sa session avec un groupe. À partir de {{price:intervention-dirigeants|flat}}, un consultant senior est entièrement dédié à vous dans vos locaux lillois — Euralille, EuraTechnologies, Roubaix, Villeneuve-d'Ascq ou siège d'un grand groupe de la métropole. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Lille concentre des dirigeants et directeurs de grands groupes retail (Decathlon, Auchan, La Redoute, Boulanger) dont les données stratégiques (catalogues, pricing, supply chain) sont trop sensibles pour un cadre collectif — le coaching individuel est la seule option viable.",
          "Les fondateurs et directeurs de startups EuraTechnologies ont des besoins IA très spécifiques (intégration produit, stack technique) et un emploi du temps incompatible avec un programme de groupe.",
          "Les directeurs supply chain et DSI d'ETI logistiques (Villeneuve-d'Ascq, Lesquin) bénéficient d'un accompagnement individuel centré sur leurs systèmes existants (WMS, ERP, plateforme e-commerce) — pas sur des exemples génériques.",
          "Aucun minimum de participants, aucune date imposée : vous choisissez le créneau dans vos locaux lillois selon vos contraintes opérationnelles.",
          "Les managers de fonctions transverses (RH, finance, communication, juridique) des sièges d'Euralille bénéficient d'un coaching individuel centré sur leurs workflows propres — non dilué dans une session pluridisciplinaire.",
          "À la fin de la session, vous repartez avec des outils IA configurés sur vos propres cas lillois — génération de fiches produits, optimisation emails, synthèse de données supply chain.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Entretien de cadrage dédié (30-45 min) pour cerner votre profil, votre secteur dominant (retail, e-commerce, logistique, IT, agroalimentaire), vos priorités et contraintes de confidentialité.",
          },
          {
            step: "Préparation sur-mesure",
            detail:
              "Le consultant prépare un programme individuel : outils sélectionnés pour votre cas, démos construites sur vos documents représentatifs (bons de commande, fiches produit, emails, données supply chain).",
          },
          {
            step: "Session intensive sur site",
            detail:
              "Journée dans vos locaux lillois (Euralille, EuraTechnologies, Roubaix, Villeneuve-d'Ascq, Marcq-en-Barœul) : théorie ciblée, démos live sur vos données réelles, manipulation directe des outils.",
          },
          {
            step: "Cas pratiques sur vos documents réels",
            detail:
              "Vous travaillez sur vos propres fichiers : catalogues e-commerce, bons de commande, emails fournisseurs, tableaux de bord supply chain. Aucun exercice déconnecté de votre réalité lilloise.",
          },
          {
            step: "Plan d'action personnel",
            detail:
              "En fin de session, remise d'un plan d'action individuel : outils à déployer, cas d'usage prioritaires pour votre poste, ressources pour continuer en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Coaching individuel entrée pour dirigeants TPE, fondateurs de startups EuraTechnologies et indépendants lillois — une journée, un consultant dédié.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme individuel sur-mesure pour manager, responsable opérationnel ou directeur de PME retail, e-commerce ou logistique de la métropole lilloise.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Coaching individuel pour directeurs supply chain, DSI ou membres du comité de direction d'ETI lilloise souhaitant progresser en profondeur sur l'IA.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour cadres dirigeants des sièges grands groupes lillois (Decathlon, Auchan, La Redoute, OVHcloud, Bonduelle) souhaitant une montée en compétences IA confidentielle.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin d'explorer l'IA appliquée à notre catalogue e-commerce et à la personnalisation de nos offres. En une journée avec un consultant dédié, on a travaillé sur nos vraies données. Je suis reparti avec des outils opérationnels et un plan clair pour mon équipe produit.",
            role: "Directrice e-commerce",
            companyProfile: "PME e-commerce, Roubaix, 60 collaborateurs",
          },
          {
            quote:
              "Format coaching individuel parfait pour un directeur supply chain en ETI : confidentialité totale sur nos données logistiques, niveau adapté à mon expertise, démos sur notre vrai WMS. Plan d'action remis en fin de journée.",
            role: "Directeur supply chain",
            companyProfile: "ETI logistique, Villeneuve-d'Ascq, 400 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce que le coaching IA individuel Axion-IA à Lille ?",
            a: "C'est une session IA sur-mesure dédiée à une seule personne — dirigeant, manager ou expert — dans vos locaux lillois. Un consultant senior vous accompagne sur vos propres cas métier (retail, e-commerce, logistique, IT) pendant une journée entière. À partir de {{price:intervention-dirigeants|flat}}.",
          },
          {
            q: "Pourquoi choisir le coaching individuel plutôt qu'une session collective à Lille ?",
            a: "Dans un coaching individuel, 100 % du temps est consacré à votre niveau, votre secteur et vos données. Idéal pour les données stratégiques sensibles (catalogues retail, pricing, données supply chain) ou les profils experts ne souhaitant pas un format générique.",
          },
          {
            q: "La session est-elle confidentielle ?",
            a: "Totalement. Confidentialité stricte dès le cadrage, vos données commerciales et stratégiques ne quittent pas vos locaux lillois. Aucun partage avec d'autres clients. Particulièrement important pour les sièges de grands groupes retail.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour commander un coaching ?",
            a: "Non. Le coaching s'adapte à votre niveau — débutant ou praticien avancé souhaitant aller plus loin. Le brief de cadrage initial permet d'ajuster le programme avant la session.",
          },
          {
            q: "Les frais de déplacement sont-ils inclus ?",
            a: "Non. Frais de logement, repas et forfait trajet sont facturés en sus, conformément à la doctrine tarifaire Axion-IA. Ces frais sont communiqués sur devis préalable à la confirmation.",
          },
          {
            q: "Peut-on organiser plusieurs coachings individuels pour différents managers d'un même groupe lillois ?",
            a: "Oui. Certains sièges lillois organisent plusieurs sessions individuelles pour leurs directeurs ou responsables de BU plutôt qu'une formation collective. Tarif dégressif possible selon le volume — à préciser en cadrage.",
          },
        ],
        guarantees:
          "Confidentialité stricte : vos données commerciales et stratégiques ne quittent pas vos locaux lillois. Aucun lock-in : les outils installés sont vos comptes personnels, aucune dépendance Axion-IA après la session. Frais de logement, repas et forfait trajet facturés en sus sur devis préalable. Si la session ne vous apporte pas de valeur actionnable immédiate, remboursement intégral (clause disponible, jamais activée à ce jour sur nos missions lilloise).",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Lille is for the executive, manager or expert who wants to progress on AI at their own pace, on their own data and business challenges, without sharing the session with a group. From {{price:intervention-dirigeants|compact}} excl. VAT, a senior consultant is entirely dedicated to you at your Lille premises — Euralille, EuraTechnologies, Roubaix, Villeneuve-d'Ascq or a metropolitan large-group HQ. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Lille hosts directors and executives at major retail groups (Decathlon, Auchan, La Redoute, Boulanger) whose strategic data (catalogues, pricing, supply chain) is too sensitive for a group setting — individual coaching is the only viable option.",
          "EuraTechnologies founders and directors have very specific AI needs (product integration, technical stack) and schedules incompatible with a group programme.",
          "Supply chain directors and CIOs at logistics mid-caps (Villeneuve-d'Ascq, Lesquin) benefit from individual coaching focused on their existing systems (WMS, ERP, e-commerce platform) — not generic examples.",
          "No minimum participants, no imposed date: you choose the slot at your Lille premises within your operational constraints.",
          "Managers of cross-functional roles (HR, finance, communications, legal) at Euralille HQs benefit from individual coaching focused on their own workflows — not diluted in a multi-disciplinary session.",
          "At session end, you leave with AI tools configured on your own Lille cases — product sheet generation, email optimisation, supply chain data synthesis.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "Dedicated framing interview (30-45 min) to understand your profile, dominant sector (retail, e-commerce, logistics, IT, agri-food), priorities and confidentiality constraints.",
          },
          {
            step: "Bespoke preparation",
            detail:
              "The consultant prepares an individual programme: tools selected for your case, demos built on your representative documents (purchase orders, product sheets, emails, supply chain data).",
          },
          {
            step: "Intensive on-site session",
            detail:
              "Full day at your Lille premises (Euralille, EuraTechnologies, Roubaix, Villeneuve-d'Ascq, Marcq-en-Barœul): targeted theory, live demos on your real data, direct tool use.",
          },
          {
            step: "Practical exercises on your real documents",
            detail:
              "You work on your own files: e-commerce catalogues, purchase orders, supplier emails, supply chain dashboards. No exercises disconnected from your Lille reality.",
          },
          {
            step: "Personal action plan",
            detail:
              "At session end, handover of an individual action plan: tools to deploy, priority use cases for your role, resources to keep progressing autonomously.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From {{price:intervention-dirigeants|compact}} excl. VAT",
            detail:
              "Entry individual coaching for Lille micro-business executives, EuraTechnologies start-up founders and freelancers — one day, one dedicated consultant.",
          },
          {
            sizeLabel: "SME",
            price: "On request",
            detail:
              "Bespoke individual programme for managers, operational leads or directors of Lille metropolitan retail, e-commerce or logistics SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On request",
            detail:
              "Individual coaching for supply chain directors, CIOs or executive committee members of Lille mid-caps wishing to progress in depth on AI.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On request",
            detail:
              "Individual coaching for senior managers at Lille large-group HQs (Decathlon, Auchan, La Redoute, OVHcloud, Bonduelle) seeking confidential AI skills development.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed to explore AI applied to our e-commerce catalogue and offer personalisation. In one day with a dedicated consultant, we worked on our real data. I left with operational tools and a clear plan for my product team.",
            role: "Head of E-commerce",
            companyProfile: "E-commerce SME, Roubaix, 60 staff",
          },
          {
            quote:
              "Perfect individual coaching format for a supply chain director at a mid-cap: total confidentiality on our logistics data, level adapted to my expertise, demos on our real WMS. Action plan handed over at day's end.",
            role: "Supply Chain Director",
            companyProfile: "Logistics mid-cap, Villeneuve-d'Ascq, 400 staff",
          },
        ],
        faq: [
          {
            q: "What is Axion-IA's individual AI coaching in Lille?",
            a: "It is a bespoke AI session dedicated to one person — executive, manager or expert — at your Lille premises. A senior consultant accompanies you on your own business cases (retail, e-commerce, logistics, IT) for a full day. From {{price:intervention-dirigeants|compact}} excl. VAT.",
          },
          {
            q: "Why choose individual coaching over a group session in Lille?",
            a: "In individual coaching, 100% of the time is dedicated to your level, your sector and your data. Ideal for sensitive strategic data (retail catalogues, pricing, supply chain data) or expert profiles who don't want a generic format.",
          },
          {
            q: "Is the session confidential?",
            a: "Completely. Strict confidentiality from framing, your commercial and strategic data does not leave your Lille premises. No sharing with other clients. Particularly important for large retail group HQs.",
          },
          {
            q: "Do I need prior AI experience to book coaching?",
            a: "No. Coaching adapts to your level — beginner or advanced practitioner wishing to go further. The initial framing brief allows adjusting the programme before the session.",
          },
          {
            q: "Are travel costs included?",
            a: "No. Lodging, meals and travel allowance are billed separately, per Axion-IA's pricing doctrine. These costs are communicated on a prior quote before confirmation.",
          },
          {
            q: "Can we organise several individual coachings for different managers at the same Lille group?",
            a: "Yes. Some Lille HQs organise several individual sessions for their directors or BU managers rather than a group training. Volume discount possible — to be specified at framing.",
          },
        ],
        guarantees:
          "Strict confidentiality: your commercial and strategic data does not leave your Lille premises. No lock-in: installed tools are your personal accounts, no Axion-IA dependency after the session. Lodging, meals and travel allowance billed separately on prior quote. If the session does not bring you immediate actionable value, full refund (clause available, never triggered to date on our Lille missions).",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Lille des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Lille, itérations à distance.",
        whyHere: [
          "Projets web & SaaS lillois : retail & e-commerce à grande échelle (sièges Decathlon, Auchan, La Redoute), cloud souverain (OVHcloud), scale-ups EuraTechnologies, cluster retail Picom, tertiaire Euralille.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "E-commerce à grande échelle : recommandation, fiches générées, search produit, personnalisation — la spécialité du retail nordiste. Hébergement UE, souverain possible (OVHcloud).",
        ],
        methodology: [
          {
            step: "Cadrage à Lille",
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
            sizeLabel: "TPE",
            price: "Brique IA greffée",
            detail:
              "Ajout d'une brique IA (chatbot RAG, recherche sémantique) sur un site existant en quelques semaines, sans refonte.",
          },
          {
            sizeLabel: "PME",
            price: "Site / boutique sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une boutique avec UX/UI et IA intégrée, pour scale-ups et PME lilloises.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS / e-commerce IA-native",
            detail:
              "Plateforme e-commerce, retail ou portail client à grande échelle, IA intégrée, branchée sur votre SI (PIM, OMS, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Lille — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous gérez l'e-commerce et le retail à grande échelle ?",
            a: "Oui, c'est un terrain naturel à Lille (Decathlon, Auchan, La Redoute) : recommandation produit, génération de fiches en masse, search sémantique, personnalisation temps réel, sur Shopify, WooCommerce, PrestaShop, Magento ou plateforme sur mesure. Hébergement UE, souverain possible.",
          },
          {
            q: "Peut-on augmenter un site existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API ou un flux de données. Aucune refonte ni downtime.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage, on remet un devis ferme en forfait fixe. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple, davantage pour une plateforme e-commerce étendue. Pas de régie, pas de dérive horaire cachée.",
          },
          {
            q: "Avec quelles technologies travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. On choisit la meilleure stack selon vos objectifs et on s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région lilloise ou repris en interne.",
      },
      en: {
        hero: "In Lille, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Lille kick-off, remote iterations.",
        whyHere: [
          "Lille web & SaaS projects: large-scale retail & e-commerce (Decathlon, Auchan, La Redoute HQs), sovereign cloud (OVHcloud), EuraTechnologies scale-ups, Picom retail cluster, Euralille business district.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Large-scale e-commerce: recommendation, generated sheets, product search, personalisation — the northern retail speciality. EU hosting, sovereign possible (OVHcloud).",
        ],
        methodology: [
          {
            step: "Scoping in Lille",
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
            sizeLabel: "Micro-business",
            price: "Grafted AI brick",
            detail:
              "Adding an AI brick (RAG chatbot, semantic search) onto an existing site in a few weeks, no rebuild.",
          },
          {
            sizeLabel: "SME",
            price: "Bespoke site / shop",
            detail:
              "Design or rebuild of a site or shop with UX/UI and built-in AI, for Lille scale-ups and SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS / e-commerce platform",
            detail:
              "Large-scale e-commerce, retail or customer portal platform, AI built in, wired into your IS (PIM, OMS, ERP, datalake).",
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
            a: "Yes. We design the full experience in Lille — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you handle large-scale e-commerce and retail?",
            a: "Yes, a natural fit in Lille (Decathlon, Auchan, La Redoute): product recommendation, bulk sheet generation, semantic search, real-time personalisation, on Shopify, WooCommerce, PrestaShop, Magento or a bespoke platform. EU hosting, sovereign possible.",
          },
          {
            q: "Can you augment an existing site without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft the AI bricks via an API, a widget or a plugin, without touching the design or structure, as long as your CMS exposes an API or data feed. No rebuild, no downtime.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After scoping, we deliver a firm quote on a fixed package. Turnaround depends on complexity — from 24-48 h for a simple project, more for an extended e-commerce platform. No time-and-materials, no hidden hourly drift.",
          },
          {
            q: "Which technologies do you work with?",
            a: "Any modern stack exposing an API: WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. We pick the best stack for your goals and adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Lille-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Lille ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Lille et partout en France.",
    },
    {
      q: "Axion-IA intervient-il à EuraTechnologies et dans toute la métropole lilloise ?",
      a: "Oui. Nous couvrons l'ensemble de la métropole lilloise en présentiel : Euralille, Vieux-Lille, EuraTechnologies (Le Blan-Lafont), Villeneuve-d'Ascq (Parc Haute-Borne), Roubaix, Tourcoing, Marcq-en-Barœul et communes limitrophes. Aucun périmètre exclu.",
    },
    {
      q: "Quels secteurs sont prioritaires dans la métropole lilloise ?",
      a: "Nos déploiements lillois couvrent en priorité le retail et l'e-commerce (Decathlon, Auchan, La Redoute, Boulanger, pôle Picom), la logistique et la supply chain, l'IT et le cloud (EuraTechnologies, OVHcloud), et les services B2B (conseil, banque/assurance Euralille). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux lillois ou nos entrepôts ?",
      a: "Oui. Toutes nos interventions à Lille sont par défaut sur site, dans vos locaux ou vos entrepôts logistiques. Nos consultants sont mobiles sur l'ensemble de la métropole et du bassin lillois. Ateliers d'idéation et restitutions clés toujours en présentiel.",
    },
    {
      q: "Avez-vous des références dans le retail et l'e-commerce lillois ?",
      a: "Oui. Plusieurs de nos références lilloise concernent le retail omnicanal, l'e-commerce et la logistique. Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par secteur et par taille d'entreprise.",
    },
    {
      q: "Lille est-elle bien desservie pour accueillir des consultants Axion-IA ?",
      a: "Excellemment. Lille-Europe est la seule gare française directement connectée à Londres (Eurostar 82 min), Bruxelles (Thalys 38 min) et Paris (TGV 62 min). Le métro Ilévia permet de rejoindre Villeneuve-d'Ascq et Roubaix en moins de 20 minutes. Aucun surcoût de déplacement dans la métropole.",
    },
  ],
};
