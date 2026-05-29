// Clermont-Ferrand (63113) — contenu éditorial gold standard.
//
// Créé : 2026-05-20. Conforme aux corrections Will (doctrine paris.ts) :
//   - Aucun délai chiffré concret.
//   - Aucun « frais de déplacement intégrés » : frais logement, repas et forfait
//     trajet facturés en sus pour toutes les interventions sur site.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix en dur : libellés calibrés à la taille INSEE sans montants.
//   - Tailles d'entreprise : TPE / PME / ETI / GE (pas de métier-type).
//   - ~95 % Axion-IA-centric, ~5 % data locale anti-doorway HCU 2024.
//   - Pas de heroSchema, pas de unAUn.
//
// Réalités Clermont-Ferrand exploitées :
//   - Michelin (siège mondial CAC 40, 1er employeur, fondé 1889).
//   - Limagrain (siège Saint-Beauzire bassin Clermont, 4e semencier mondial).
//   - CIMES (pôle mécanique avancée Auvergne-Rhône-Alpes).
//   - Chaîne des Puys-Faille de Limagne (UNESCO 2018).
//   - UCA (Université Clermont Auvergne, ~37 000 étudiants) + ISIMA + Sigma Clermont.
//   - Biopôle Clermont-Limagne (biotech/agro, Saint-Beauzire).
//   - Céréales Vallée / agroalimentaire Auvergne (AOP Saint-Nectaire, Cantal, Bleu d'Auvergne…).
//   - Aéroport CFE (Aulnat, 6 km) + Intercités Paris-Bercy ~3 h (pas de TGV direct).
//   - Technopôle La Pardieu + campus des Cézeaux (cluster sciences-ingénierie).
//   - 13 722 établissements actifs (INSEE 2023), 2 597 créations/an.

import type { VilleCopy } from "./types";

export const CLERMONT_FERRAND_COPY: VilleCopy = {
  pitchFr:
    "Clermont-Ferrand héberge le siège mondial de Michelin (CAC 40) et celui de Limagrain (4e semencier mondial), un tissu industriel héritage pneumatique-agroalimentaire-aéronautique unique en France. Axion-IA y intervient sur site auprès des TPE, PME, ETI et grands groupes auvergnats — du sous-traitant automobile clermontois au cabinet libéral du plateau de Gergovie.",
  pitchEn:
    "Clermont-Ferrand hosts Michelin's world headquarters (CAC 40) and Limagrain's (4th-largest seed company globally), an industrial fabric shaped by tyres, agri-food and aerospace unique in France. Axion-IA delivers on site to micro-businesses, SMEs, mid-caps and large groups in the Auvergne — from Clermont automotive sub-contractors to professional practices across the plateau.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Clermont-Ferrand : nous identifions les workflows automatisables dans votre structure clermontoise et chiffrons le ROI — industrie, agroalimentaire, services ou recherche. 4 niveaux du Flash au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Clermont-Ferrand: we map automatable workflows in your Auvergne organisation and quantify the ROI — manufacturing, agri-food, services or research. 4 tiers from Flash to Mid-cap Strategic.",
    },
    interventions: {
      fr: "Interventions IA à Clermont-Ferrand : formats sur site d'une à plusieurs journées, de vos locaux du Technopôle La Pardieu aux sites industriels du bassin. Vos équipes repartent autonomes sur des outils IA installés. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Clermont-Ferrand: on-site formats from one to several days, from your Technopôle La Pardieu offices to industrial sites across the basin. Your staff leave autonomous with AI tools installed. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Clermont-Ferrand : on déploie l'IA dans vos outils existants (ERP industrie, CRM, emails, GPAO) avec ROI chiffré contractuel. Vos équipes gardent la main, aucun lock-in.",
      en: "AI implementation in Clermont-Ferrand: we deploy AI into your existing tools (industrial ERP, CRM, emails, GPAO) with contractually-costed ROI. Your teams stay in control, no lock-in.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Clermont-Ferrand — à partir de {{price:intervention-dirigeants|flat}}. Un consultant senior dédié à votre cas, dans vos locaux du Technopôle La Pardieu ou d'un site industriel du bassin : dirigeant, manager ou expert technique qui veut progresser seul, à son rythme, sur sa réalité métier.",
      en: "Individual AI coaching in Clermont-Ferrand — from {{price:intervention-dirigeants|compact}} excl. VAT. A senior consultant dedicated to your case, at your Technopôle La Pardieu or industrial basin premises: executive, manager or technical expert who wants to progress alone, at their pace, on their real business context.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI clermontoises et auvergnates — site vitrine premium pour sous-traitants Michelin et acteurs aéronautique (Auvergne Aéronautique), espace client pour coopératives Limagrain et filière agro AOP, dashboard métier connecté à votre ERP industriel, GPAO ou CRM. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Clermont-Ferrand and Auvergne SMEs/mid-caps — premium showcase site for Michelin sub-contractors and aerospace players (Auvergne Aéronautique), customer space for Limagrain cooperatives and AOP agri-food chain, business dashboard connected to your industrial ERP, GPAO or CRM. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Clermont-Ferrand (63) sur site — Technopôle La Pardieu, campus des Cézeaux, sites industriels du bassin clermontois. Nous accompagnons les TPE, PME, ETI et grandes entreprises de l'agglomération (industrie pneumatique-héritage, sous-traitance Michelin, agroalimentaire AOP, aéronautique, biotechnologies) sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy delivering on site in Clermont-Ferrand (63) — Technopôle La Pardieu, campus des Cézeaux, industrial sites across the Clermont basin. We support micro-businesses, SMEs, mid-caps and large groups (tyre-heritage manufacturing, Michelin supply chain, AOP agri-food, aerospace, biotech) on their operational AI cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "pneumatique, agro & santé",

  topSectorsNaf: [
    "Industrie & Équipementiers automobile / pneumatique",
    "Agroalimentaire & Coopératives agricoles",
    "Conseil, services aux entreprises & R&D",
    "Santé & Biotechnologies",
    "Aéronautique & Sous-traitance industrielle",
    "Commerce & Distribution grand bassin",
  ],

  distancesFr:
    "Gare de Clermont-Ferrand (Intercités Paris-Bercy ~3 h, pas de TGV direct). Aéroport Clermont-Ferrand Auvergne (CFE) à Aulnat, 6 km à l'est du centre-ville — vols directs Paris-Orly, Lyon, Amsterdam. Tramway T1 et T2 vers le Technopôle La Pardieu et le campus des Cézeaux.",
  distancesEn:
    "Clermont-Ferrand train station (Intercités Paris-Bercy ~3 h, no direct high-speed TGV). Clermont-Ferrand Auvergne Airport (CFE) at Aulnat, 6 km east of city centre — direct flights to Paris-Orly, Lyon, Amsterdam. Trams T1 and T2 to Technopôle La Pardieu and campus des Cézeaux.",

  ecosystemFr:
    "Capitale d'Auvergne et siège mondial de Michelin (CAC 40, 1889) — l'une des deux seules villes françaises hors Île-de-France à héberger un siège CAC 40. Limagrain (4e semencier mondial, siège bassin Clermont), CIMES (mécanique avancée), Auvergne Aéronautique (Airbus-Safran), Biopôle Clermont-Limagne, ISIMA-UCA-Sigma (37 000 étudiants), French Tech Clermont Auvergne (Communauté labellisée). 13 722 établissements actifs INSEE 2023.",
  ecosystemEn:
    "Capital of Auvergne and home to Michelin's world HQ (CAC 40, 1889) — one of only two French cities outside Île-de-France hosting a CAC 40 head office. Limagrain (4th global seed company, basin HQ), CIMES (advanced mechanics), Auvergne Aéronautique (Airbus-Safran), Biopôle Clermont-Limagne, ISIMA-UCA-Sigma (37,000 students), French Tech Clermont Auvergne (labelled Community). 13,722 active establishments INSEE 2023.",

  // === SERVICES LONG-FORM CLERMONT-FERRAND ===
  // Aucun prix en dur, aucun délai chiffré, aucune mention « frais inclus »,
  // aucune demi-journée.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation clermontoise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles — du sous-traitant TPE du bassin Michelin aux ETI agroalimentaires du Puy-de-Dôme, en passant par les structures de services, de santé et de recherche présentes sur le Technopôle La Pardieu et le campus des Cézeaux.",
        whyHere: [
          "Clermont-Ferrand concentre une industrie manufacturière structurante sans équivalent hors Île-de-France : siège Michelin (CAC 40), Limagrain, Auvergne Aéronautique, filière agro AOP — autant de donneurs d'ordres et sous-traitants pour lesquels l'IA représente un levier de compétitivité concret.",
          "L'écosystème universitaire (UCA, ISIMA, Sigma Clermont) produit chaque année des jeunes ingénieurs IA — les PME et ETI locales ont besoin d'un audit structuré pour canaliser ces ressources vers des cas d'usage à ROI démontré.",
          "Le Technopôle La Pardieu et le Biopôle Clermont-Limagne accueillent des PME et ETI dans le conseil, les services, la biotech et l'agro — exactement les secteurs où l'IA de traitement documentaire et d'automatisation de workflows génère les gains les plus rapides.",
          "Restitutions toujours en présentiel à Clermont-Ferrand, dans vos locaux : ateliers d'idéation avec votre comité de direction, livrable PDF remis en main propre, plan d'action exécutable immédiatement.",
          "Tarifs publics affichés, pas de devis opaque. Vous savez exactement ce que vous payez avant de signer — différenciateur décisif face aux cabinets traditionnels présents à Lyon ou Paris qui facturent des frais de déplacement en sus.",
          "Votre plan d'action post-audit est exécutable avec n'importe quel prestataire ou en interne — aucun lock-in, aucune dépendance créée envers Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour signer le Confidentialité assurée, accéder aux documents clés (organigramme, processus, indicateurs) et qualifier votre secteur dominant — industrie, agro, services, biotech ou santé.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Clermont-Ferrand dans vos locaux (Technopôle La Pardieu, campus des Cézeaux, site industriel bassin) pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (production, qualité, finance, RH, commercial, bureau d'études, direction) pour cartographier finement frictions et attentes métier-réel.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos gammes techniques, vos rapports de contrôle qualité, vos cahiers des charges Michelin/Airbus-Safran ou vos devis agroalimentaires. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux à Clermont-Ferrand. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre calendrier industriel.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux sous-traitants TPE, cabinets libéraux, artisans et indépendants du bassin clermontois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles, agroalimentaires, de services ou de biotechnologie de quelques dizaines à 250 collaborateurs du Puy-de-Dôme.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI du bassin clermontois (sous-traitance Michelin-Airbus, coopératives agricoles, groupes services) souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les directions IA des grands groupes implantés à Clermont-Ferrand souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su adapter son audit à la réalité de notre secteur : cahiers des charges donneurs d'ordres, gammes techniques, contrôle qualité. Le livrable est chiffré, actionnable, et nos chefs de projet l'ont pris en main immédiatement.",
            role: "Directeur général",
            companyProfile: "PME sous-traitante industrielle, bassin clermontois",
          },
          {
            quote:
              "La méthode démo-sur-vos-données nous a convaincus là où des slides théoriques auraient échoué. Le ROI identifié en traitement documentaire agroalimentaire a justifié la mission en quelques heures.",
            role: "Directrice administratives et financière",
            companyProfile: "ETI agroalimentaire, Puy-de-Dôme",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Clermont-Ferrand ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs journées ou semaines. Nous calons avec vous le rythme dès le brief de cadrage.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local si la souveraineté est requise — enjeu particulièrement sensible pour les sous-traitants Michelin ou Airbus-Safran.",
          },
          {
            q: "Quel ROI peut-on attendre pour une PME industrielle du bassin ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente généralement plusieurs équivalents temps plein gagnés sur les workflows automatisables : saisie et contrôle de qualité, lecture de cahiers des charges, comptes-rendus de réunion, qualification de devis. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Clermont-Ferrand. Atelier de quelques heures dans vos locaux avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Différence avec un cabinet de conseil traditionnel basé à Lyon ou Paris ?",
            a: "Nos consultants se déplacent à Clermont-Ferrand et facturent uniquement leur prestation — pas de surprime géographique. Tarifs publics, pas de devis à négocier. Méthode condensée, démos sur vos vraies données industrielles ou agro. Et surtout : aucun lock-in, vous repartez avec votre plan.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour commander un audit ?",
            a: "Non. Une grande partie de nos audits clermontois sont commandés par des dirigeants de PME industrielles ou agroalimentaires qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable mais jamais activée à ce jour).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated in your Clermont-Ferrand organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size — from TPE sub-contractors in the Michelin basin to Puy-de-Dôme agri-food mid-caps and research-intensive structures on Technopôle La Pardieu.",
        whyHere: [
          "Clermont-Ferrand hosts a manufacturing fabric unmatched outside Île-de-France: Michelin HQ (CAC 40), Limagrain, Auvergne Aéronautique, AOP agri-food chains — prime clients and sub-contractors for whom AI is a concrete competitiveness lever.",
          "The university ecosystem (UCA, ISIMA, Sigma Clermont) trains AI engineers every year; local SMEs and mid-caps need a structured audit to channel those skills toward ROI-proven use cases.",
          "Technopôle La Pardieu and Biopôle Clermont-Limagne host consulting, services, biotech and agri-food SMEs — exactly the sectors where document-processing and workflow-automation AI delivers the fastest gains.",
          "Read-outs always in person in Clermont-Ferrand, at your offices: ideation workshops with your leadership, deliverable handed over face to face, immediately actionable plan.",
          "Public pricing, no opaque quote: you know exactly what you pay before signing — a decisive differentiator vs Lyon- or Paris-based traditional consulting firms billing travel on top.",
          "Your post-audit action plan is executable with any vendor or in-house — no lock-in, no dependency created on Axion-IA.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to sign the Confidentiality ensured, access key documents and qualify your dominant sector — manufacturing, agri-food, services, biotech or healthcare.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Clermont-Ferrand at your premises (Technopôle La Pardieu, campus des Cézeaux, industrial basin site) to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (production, quality, finance, HR, sales, engineering, leadership) to map frictions and real-job expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your technical specs, quality control reports, Michelin/Airbus-Safran tender documents or agri-food quotes. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Clermont-Ferrand offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap aligned with your industrial calendar.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to TPE sub-contractors, professional practices, craftspeople and freelancers in the Clermont basin up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial, agri-food, services or biotech SMEs from a few dozen to 250 staff in Puy-de-Dôme.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Clermont basin mid-caps (Michelin-Airbus supply chain, agricultural co-ops, service groups) framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For AI leadership at large groups headquartered in Clermont-Ferrand framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA adapted its audit to our sector reality: customer tender documents, technical specs, quality control. The deliverable is costed, actionable, and our project managers picked it up immediately.",
            role: "CEO",
            companyProfile: "Industrial sub-contracting SME, Clermont basin",
          },
          {
            quote:
              "The demo-on-your-data approach convinced us where theoretical slides would have failed. The ROI identified for agri-food document processing justified the mission within hours.",
            role: "CFO",
            companyProfile: "Agri-food mid-cap, Puy-de-Dôme",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Clermont-Ferrand?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several days or weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally if sovereignty is required — a particularly sensitive point for Michelin or Airbus-Safran sub-contractors.",
          },
          {
            q: "What ROI can a Clermont basin industrial SME expect?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows: quality control input, spec-sheet reading, meeting minutes, quote qualification. The deliverable details exact figures for your case.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Clermont-Ferrand. Workshop of a few hours at your offices with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference vs a Lyon- or Paris-based traditional consulting firm?",
            a: "Our consultants travel to Clermont-Ferrand and bill only their service — no geographic premium. Public pricing, no quote to negotiate. Condensed method, demos on your real industrial or agri-food data. And above all: no lock-in, you leave with your plan.",
          },
          {
            q: "Do I need AI maturity to order an audit?",
            a: "No. A large share of our Clermont audits are ordered by SME executives in manufacturing or agri-food who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Clermont-Ferrand se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — qu'ils soient ingénieurs bureau d'études chez un équipementier, techniciens qualité d'une PME agro ou chargés de clientèle d'un cabinet de services. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Clermont-Ferrand concentre des profils de collaborateurs particulièrement adaptés aux interventions IA pratiques : ingénieurs industriels, techniciens agro, chercheurs UCA-ISIMA, commerciaux PME services — tous producteurs de documents structurés que l'IA traite avec un gain immédiat.",
          "Déplacement sur site dans l'ensemble du bassin clermontois : Technopôle La Pardieu, campus des Cézeaux, sites industriels de Cournon-d'Auvergne, zones d'activité de Chamalières, Aubière, Riom.",
          "Le format Essentielle est calibré pour les structures de quelques personnes à une centaine de collaborateurs — idéal pour les PME du Puy-de-Dôme.",
          "Le format Conférence est adapté aux grandes plénières d'entreprise (salles Grande Halle d'Auvergne, Polydome, auditoriums campus des Cézeaux).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI et grandes entreprises clermontoise.",
          "Vocabulaire ajusté à votre secteur dominant : industrie, agro, biotechnologie, services, santé, R&D. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre direction ou RH pour cibler le profil des participants (ingénieurs, techniciens, commerciaux, fonctions support), votre secteur métier et les cas d'usage prioritaires à Clermont-Ferrand.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (gammes techniques, rapports qualité, devis, PV de réunion, fiches produit agro) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection et accès Wi-Fi. Pas d'aléa technique le jour J, que vous soyez en zone industrielle ou sur campus.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données clermontoise, suivies d'ateliers participatifs — manipulation réelle des outils, pas de simulation.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure — objectif autonomie immédiate.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour les sous-traitants TPE, cabinets libéraux, startups French Tech et indépendants du bassin clermontois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (bureau d'études, qualité, commercial, logistique, finance).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (Grande Halle d'Auvergne, Polydome) ou huis-clos CODIR selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands groupes clermontois : roadshow multi-sites industriels, séminaire CODIR + cascade équipes terrain.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calibré pour nos ingénieurs : les démos sur nos gammes techniques et nos rapports qualité ont transformé des sceptiques en utilisateurs quotidiens. Le lendemain, l'adoption était concrète.",
            role: "Directeur des opérations",
            companyProfile: "PME équipementière automobile, bassin clermontois",
          },
          {
            quote:
              "La session dirigeants nous a alignés en une journée sur notre trajectoire IA. Données agro réelles utilisées pendant les démos — pertinence immédiate pour notre métier.",
            role: "Directrice générale",
            companyProfile: "ETI agroalimentaire Auvergne, Puy-de-Dôme",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Clermont-Ferrand ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes — compatible avec les grandes salles de Clermont-Ferrand (Grande Halle d'Auvergne, Polydome).",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur industriel ou agroalimentaire ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un sous-traitant de Michelin n'a rien à voir avec une session pour une coopérative agricole du Puy-de-Dôme.",
          },
          {
            q: "Intervenez-vous sur les sites industriels hors du centre-ville de Clermont ?",
            a: "Oui. Nous couvrons l'ensemble du bassin clermontois : Technopôle La Pardieu, zones industrielles des Gravanches, campus des Cézeaux, Cournon-d'Auvergne, Riom, Chamalières, Aubière, Issoire.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur clermontois (industrie, agro, biotech, services), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Clermont-Ferrand come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether they are R&D engineers at a tier-1 supplier, quality technicians at an agri-food SME or account managers at a services firm. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Clermont-Ferrand hosts staff profiles particularly well-suited to hands-on AI sessions: industrial engineers, agri-food technicians, UCA-ISIMA researchers, service-sector account managers — all heavy producers of structured documents that AI processes with immediate gains.",
          "On-site delivery across the entire Clermont basin: Technopôle La Pardieu, campus des Cézeaux, Cournon-d'Auvergne industrial sites, Chamalières, Aubière, Riom business parks.",
          "The Essential format is calibrated for structures from a few people to about a hundred staff — ideal for Puy-de-Dôme SMEs.",
          "The Talk format suits large corporate plenaries (Grande Halle d'Auvergne, Polydome, campus des Cézeaux auditoriums).",
          "The Executives format enables in-camera framing for Clermont mid-cap and large-group executive committees.",
          "Vocabulary adjusted to your dominant sector: manufacturing, agri-food, biotech, services, healthcare, R&D. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your leadership or HR to target participant profile (engineers, technicians, sales, support), sector and priority use cases in Clermont-Ferrand.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (tech specs, quality reports, quotes, meeting minutes, agri-food product sheets) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection and Wi-Fi. No technical hiccup on D-day, whether you're on an industrial site or a campus.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR Clermont data, followed by participatory workshops — real tool usage, not simulation.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help — immediate autonomy is the goal.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for TPE sub-contractors, professional practices, French Tech startups and freelancers in the Clermont basin up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (R&D, quality, sales, logistics, finance).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Grande Halle d'Auvergne, Polydome) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Clermont large groups: multi-site industrial roadshows, exec committee + field-team cascade seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated for our engineers: demos on our technical specs and quality reports turned sceptics into daily users. The next day, adoption was real.",
            role: "Operations Director",
            companyProfile: "Automotive parts SME, Clermont basin",
          },
          {
            quote:
              "The executives session aligned us in a day on our AI trajectory. Real agri-food data used during demos — immediately relevant to our business.",
            role: "CEO",
            companyProfile: "Auvergne agri-food mid-cap, Puy-de-Dôme",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Clermont-Ferrand take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format programme, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops — compatible with Clermont-Ferrand's large venues (Grande Halle d'Auvergne, Polydome).",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our industrial or agri-food sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Michelin sub-contractor has nothing to do with one for a Puy-de-Dôme agricultural co-op.",
          },
          {
            q: "Do you deliver on industrial sites outside Clermont city centre?",
            a: "Yes. We cover the entire Clermont basin: Technopôle La Pardieu, Les Gravanches industrial zones, campus des Cézeaux, Cournon-d'Auvergne, Riom, Chamalières, Aubière, Issoire.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Clermont sector (manufacturing, agri-food, biotech, services), no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Clermont-Ferrand met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux clermontois — Technopôle La Pardieu, site industriel ou campus selon votre implantation.",
        whyHere: [
          "Clermont-Ferrand concentre des cas d'implémentation IA à fort ROI industriel : lecture automatisée de cahiers des charges donneurs d'ordres (filière Michelin-Airbus), contrôle qualité assisté IA, génération de rapports techniques, classification documentaire agroalimentaire — des périmètres que nous maîtrisons.",
          "Le kick-off se passe en présentiel dans vos locaux clermontois : alignement des équipes techniques et opérationnelles, accès aux données, validation des intégrations ERP industriel / GPAO / CRM / messagerie.",
          "Itérations à distance ensuite avec un point quotidien court en visio et des visites périodiques pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Clermont-Ferrand : passation de pouvoir, formation des ambassadeurs internes installés sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés (bureau d'études, qualité, finance, direction) : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques clermontois : PME sous-traitantes (lecture automatisée de PPAP / cahiers des charges), ETI agro (classification et traçabilité documentaire AOP), cabinets de services (qualification de leads, comptes-rendus), structures de R&D (synthèse bibliographique, reporting scientifique).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Clermont-Ferrand : revue de l'architecture cible (ERP industrie, GPAO, mails, GED, stockage données), validation des contraintes RGPD/sécurité/souveraineté, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Clermont-Ferrand : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants (ERP, GPAO, messagerie), tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Clermont-Ferrand : tests d'acceptation utilisateurs, formation des ambassadeurs internes (ingénieurs, techniciens, responsables qualité), livraison du runbook documentation, plan de monitoring.",
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
              "Implémentation d'un cas d'usage simple (lecture automatisée de documents, comptes-rendus, qualification leads) pour les TPE et sous-traitants TPE du bassin.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/GPAO/CRM. Pour les PME industrielles, agroalimentaires ou de services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, datalake, GED), formation d'ambassadeurs cross-département — ETI sous-traitantes, coopératives, groupes services.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes clermontois : cas d'usage cascadés sur plusieurs sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture automatisée de cahiers des charges livrée comme promis. ROI réel mesuré : nos ingénieurs bureau d'études gagnent plusieurs heures par semaine sur la lecture de PPAP clients. Aucun lock-in, les modèles sont sur notre infra.",
            role: "Directeur technique",
            companyProfile: "PME équipementière sous-traitante, bassin clermontois",
          },
          {
            quote:
              "Méthode hybride idéale pour une ETI multi-sites : kick-off intense à Clermont-Ferrand, puis itérations à distance courtes et efficaces. Nos ambassadeurs internes sont autonomes. Mission terminée dans les délais du SOW.",
            role: "DSI",
            companyProfile: "ETI agroalimentaire Auvergne, siège Puy-de-Dôme",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Clermont-Ferrand ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions clermontoise. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles sur mon infra ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande — enjeu critique pour les sous-traitants Michelin/Airbus.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données industrielles ou agro si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA fait des erreurs sur des documents critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (cahiers des charges exigeants, documents réglementaires AOP, PPAP), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Clermont-Ferrand brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Clermont premises — Technopôle La Pardieu, industrial site or campus depending on your location.",
        whyHere: [
          "Clermont-Ferrand hosts high-ROI industrial AI implementation cases: automated reading of customer tender documents (Michelin-Airbus supply chain), AI-assisted quality control, technical report generation, agri-food document classification — scopes we master.",
          "Kick-off always in person at your Clermont premises: alignment of technical and operational teams, data access, industrial ERP / GPAO / CRM / email integration validation.",
          "Remote iterations afterwards with a short daily video call and periodic on-site visits for progress demos with your executive committee.",
          "Final acceptance always in person in Clermont-Ferrand: handover, training of internal ambassadors at their workstations, runbook documentation delivered.",
          "Training included for your identified key staff (R&D, quality, finance, leadership): they become internal AI ambassadors, autonomous after mission end.",
          "Typical Clermont cases: sub-contracting SMEs (automated PPAP / tender reading), agri-food mid-caps (AOP document classification and traceability), services firms (lead qualification, meeting minutes), R&D structures (bibliographic synthesis, scientific reporting).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Clermont-Ferrand workshop: target architecture review (industrial ERP, GPAO, emails, DMS, storage), GDPR/security/sovereignty constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Clermont-Ferrand: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools (ERP, GPAO, email), real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Clermont-Ferrand: user acceptance tests, training of internal ambassadors (engineers, technicians, quality managers), runbook documentation delivery, monitoring plan.",
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
              "Implementation of a simple use case (automated document reading, meeting minutes, lead qualification) for basin micro-businesses and TPE sub-contractors.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/GPAO/CRM integration. For industrial, agri-food or services SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, datalake, DMS), training of cross-department ambassadors — sub-contracting mid-caps, co-ops, service groups.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Clermont large accounts: cascaded use cases across multiple sites, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automated tender-document reading delivered as promised. Real ROI measured: our R&D engineers save several hours per week on customer PPAP reading. No lock-in, models are on our infra.",
            role: "Technical Director",
            companyProfile: "Automotive sub-contracting SME, Clermont basin",
          },
          {
            quote:
              "Perfect hybrid method for a multi-site mid-cap: intense on-site kick-off in Clermont-Ferrand, then short and efficient remote iterations. Our internal ambassadors are autonomous. Mission closed on SOW schedule.",
            role: "CIO",
            companyProfile: "Auvergne agri-food mid-cap, Puy-de-Dôme HQ",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Clermont-Ferrand take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Clermont missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay on my infra?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request — critical for Michelin/Airbus sub-contractors.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your industrial or agri-food data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI makes errors on critical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (stringent tender specs, AOP regulatory documents, PPAP), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA individuel Axion-IA à Clermont-Ferrand s'adresse au dirigeant, manager ou expert technique qui veut progresser sur l'IA à son rythme, sur ses propres cas métier — sans partager sa session avec d'autres participants. À partir de {{price:intervention-dirigeants|flat}}, un consultant senior est entièrement dédié à vous dans vos locaux du Technopôle La Pardieu, d'un site industriel ou d'un cabinet du bassin clermontois. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Clermont-Ferrand compte de nombreux dirigeants de PME et ETI (sous-traitance Michelin, agroalimentaire AOP, biotech) qui préfèrent une montée en compétences privée, centrée sur leurs propres données et processus industriels, sans exposer leurs enjeux stratégiques à un groupe.",
          "Les ingénieurs et responsables R&D du campus des Cézeaux et du Biopôle Clermont-Limagne bénéficient d'un accompagnement individuel calibré sur leur niveau technique élevé — loin d'une session pédagogique standardisée.",
          "Le format individuel permet d'aborder des sujets confidentiels : cahiers des charges donneurs d'ordres Michelin, procédés de fabrication brevetés, données de recherche sensibles.",
          "Aucun minimum de participants, aucune date imposée : le créneau et le rythme sont ceux du participant, dans ses locaux clermontois ou à distance si nécessaire.",
          "La French Tech Clermont Auvergne réunit des fondateurs et dirigeants de startups pour lesquels le format individuel est le seul compatible avec leur emploi du temps et leurs besoins spécifiques.",
          "Résultat immédiat : à la fin de la session, vous repartez avec des outils IA installés et configurés sur vos propres cas industriels ou de services — pas sur des exemples génériques.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage dédié (30-45 min) pour cerner votre profil, votre secteur dominant (industrie, agro, biotech, services), vos priorités et vos contraintes de confidentialité dans le bassin clermontois.",
          },
          {
            step: "Préparation sur-mesure",
            detail:
              "Le consultant prépare un programme individuel : outils sélectionnés pour votre cas, démos construites à partir de documents représentatifs de votre activité clermontoise.",
          },
          {
            step: "Session intensive sur site",
            detail:
              "Journée (ou demi-journée si POC) dans vos locaux à Clermont-Ferrand : alternance de théorie ultra-ciblée, démos live sur vos données réelles, manipulation directe des outils. Rythme adapté à votre niveau de départ.",
          },
          {
            step: "Cas pratiques sur vos documents réels",
            detail:
              "Vous travaillez sur vos propres fichiers : cahiers des charges, gammes techniques, données de contrôle qualité, rapports R&D, emails stratégiques. Aucun exercice théorique déconnecté de votre réalité.",
          },
          {
            step: "Plan d'action personnel",
            detail:
              "En fin de session, remise d'un plan d'action individuel : outils à déployer, cas d'usage prioritaires pour votre poste, ressources pour continuer à progresser en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Coaching individuel entrée pour dirigeants TPE, artisans et indépendants du bassin clermontois — une journée, un consultant dédié.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme individuel sur-mesure pour manager, responsable opérationnel ou directeur de PME clermontoise souhaitant progresser en profondeur.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour directeurs techniques, DSI ou membres du comité de direction d'ETI industrielles ou agroalimentaires du bassin.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching individuel pour cadres dirigeants et experts de grands groupes clermontois (Michelin, Limagrain, Safran…) souhaitant une montée en compétences IA confidentielle.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin de comprendre l'IA en lien avec mes propres contraintes de sous-traitant Michelin — cahiers des charges, PPAP, traçabilité. En une journée, le consultant a utilisé mes vrais documents. J'ai appris dix fois plus qu'en deux jours de formation collective.",
            role: "Directeur général",
            companyProfile: "TPE sous-traitante automobile, bassin clermontois",
          },
          {
            quote:
              "Format idéal pour un directeur technique en ETI : pas de nivellement par le bas, pas de sujets déjà connus. Le consultant a ajusté le niveau en temps réel. Je suis reparti avec un plan d'action concret pour mon équipe R&D.",
            role: "Directeur technique",
            companyProfile: "ETI équipementière industrielle, agglomération Clermont-Ferrand",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce que le coaching IA individuel Axion-IA à Clermont-Ferrand ?",
            a: "C'est une session IA sur-mesure dédiée à une seule personne — dirigeant, manager ou expert — dans vos locaux clermontois. Un consultant senior vous accompagne sur vos propres cas métier (industrie, agro, biotech, services) pendant une journée entière. À partir de {{price:intervention-dirigeants|flat}}.",
          },
          {
            q: "En quoi le coaching individuel diffère-t-il d'une intervention collective ?",
            a: "Dans une session collective, le contenu est calibré pour un groupe : il y a inévitablement des sujets trop basiques ou trop avancés. Dans le coaching individuel, 100 % du temps est consacré à votre niveau, votre secteur et vos données clermontoise. Aucun compromis pédagogique.",
          },
          {
            q: "Le coaching est-il confidentiel ?",
            a: "Totalement. Confidentialité stricte dès le cadrage, vos données industrielles ou stratégiques ne quittent pas vos locaux, aucun partage avec d'autres clients. Particulièrement important pour les sous-traitants Michelin ou Airbus dont les process sont protégés.",
          },
          {
            q: "Faut-il être déjà expérimenté sur l'IA pour commander un coaching ?",
            a: "Non. Le coaching s'adapte à votre niveau, du débutant absolu au praticien avancé souhaitant aller plus loin. Le brief de cadrage initial permet d'ajuster le programme avant la session.",
          },
          {
            q: "Les frais de déplacement sont-ils inclus ?",
            a: "Non. Les frais de logement, repas et forfait trajet sont facturés en sus, conformément à la doctrine tarifaire Axion-IA. Ces frais sont communiqués sur devis préalable avant la confirmation.",
          },
          {
            q: "Puis-je organiser plusieurs sessions individuelles pour différents collaborateurs ?",
            a: "Oui. Certaines entreprises clérmontoise organisent plusieurs coachings individuels successifs pour leurs managers ou experts clés plutôt qu'une session collective. Tarif dégressif possible selon le volume — à préciser en cadrage.",
          },
        ],
        guarantees:
          "Confidentialité stricte : vos données et vos enjeux ne quittent pas vos locaux clermontois. Aucun lock-in : les outils installés sont vos comptes personnels, aucune dépendance Axion-IA après la session. Frais de logement, repas et forfait trajet facturés en sus sur devis préalable. Si la session ne vous apporte pas de valeur actionnable immédiate, remboursement intégral (clause disponible, jamais activée).",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Clermont-Ferrand is for the executive, manager or technical expert who wants to progress on AI at their own pace, on their own business cases — without sharing the session with other participants. From {{price:intervention-dirigeants|compact}} excl. VAT, a senior consultant is entirely dedicated to you at your Technopôle La Pardieu, industrial basin or practice premises. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Clermont-Ferrand has many SME and mid-cap executives (Michelin subcontracting, AOP agri-food, biotech) who prefer private skills development, focused on their own data and industrial processes, without exposing their strategic challenges to a group.",
          "R&D engineers and managers at campus des Cézeaux and Biopôle Clermont-Limagne benefit from individual coaching calibrated to their high technical level — far from a standardised pedagogical session.",
          "The individual format allows tackling confidential subjects: Michelin customer tender documents, patented manufacturing processes, sensitive research data.",
          "No minimum participants, no imposed date: the slot and rhythm are the participant's, at their Clermont premises or remotely if needed.",
          "French Tech Clermont Auvergne brings together founders and executives for whom the individual format is the only one compatible with their schedule and specific needs.",
          "Immediate result: at session end, you leave with AI tools installed and configured on your own industrial or service cases — not generic examples.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "Dedicated framing interview (30-45 min) to understand your profile, dominant sector (manufacturing, agri-food, biotech, services), priorities and confidentiality constraints in the Clermont basin.",
          },
          {
            step: "Bespoke preparation",
            detail:
              "The consultant prepares an individual programme: tools selected for your case, demos built from documents representative of your Clermont activity.",
          },
          {
            step: "Intensive on-site session",
            detail:
              "Full day at your Clermont-Ferrand premises: alternation of highly targeted theory, live demos on your real data, direct tool use. Pace adapted to your starting level.",
          },
          {
            step: "Practical exercises on your real documents",
            detail:
              "You work on your own files: tender specs, technical specs, quality control data, R&D reports, strategic emails. No theoretical exercises disconnected from your reality.",
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
              "Entry individual coaching for Clermont basin micro-business executives, craftspeople and freelancers — one day, one dedicated consultant.",
          },
          {
            sizeLabel: "SME",
            price: "On request",
            detail:
              "Bespoke individual programme for Clermont SME managers, operational leads or directors wishing to progress in depth.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On request",
            detail:
              "Individual coaching for technical directors, CIOs or executive committee members of industrial or agri-food mid-caps in the basin.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On request",
            detail:
              "Individual coaching for senior managers and experts at Clermont large groups (Michelin, Limagrain, Safran…) seeking confidential AI skills development.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed to understand AI in relation to my own Michelin sub-contracting constraints — tender documents, PPAP, traceability. In one day, the consultant used my real documents. I learned ten times more than in two days of group training.",
            role: "CEO",
            companyProfile: "Automotive sub-contracting micro-business, Clermont basin",
          },
          {
            quote:
              "Perfect format for a technical director at a mid-cap: no levelling down, no already-known topics. The consultant adjusted the level in real time. I left with a concrete action plan for my R&D team.",
            role: "Technical Director",
            companyProfile: "Industrial equipment mid-cap, Clermont-Ferrand area",
          },
        ],
        faq: [
          {
            q: "What is Axion-IA's individual AI coaching in Clermont-Ferrand?",
            a: "It is a bespoke AI session dedicated to one person — executive, manager or expert — at your Clermont premises. A senior consultant accompanies you on your own business cases (manufacturing, agri-food, biotech, services) for a full day. From {{price:intervention-dirigeants|compact}} excl. VAT.",
          },
          {
            q: "How does individual coaching differ from a group session?",
            a: "In a group session, content is calibrated for the average: there are inevitably topics too basic or too advanced. In individual coaching, 100% of the time is dedicated to your level, your sector and your Clermont data. No pedagogical compromise.",
          },
          {
            q: "Is coaching confidential?",
            a: "Completely. Strict confidentiality from framing, your industrial or strategic data does not leave your premises, no sharing with other clients. Particularly important for Michelin or Airbus sub-contractors whose processes are protected.",
          },
          {
            q: "Do I need prior AI experience to book individual coaching?",
            a: "No. Coaching adapts to your level, from absolute beginner to advanced practitioner wishing to go further. The initial framing brief allows adjusting the programme before the session.",
          },
          {
            q: "Are travel costs included?",
            a: "No. Lodging, meals and travel allowance are billed separately, in line with Axion-IA's pricing doctrine. These costs are communicated on a prior quote before confirmation.",
          },
          {
            q: "Can I organise several individual sessions for different staff members?",
            a: "Yes. Some Clermont companies organise several successive individual coachings for their key managers or experts rather than a group session. Volume discount possible — to be specified at framing.",
          },
        ],
        guarantees:
          "Strict confidentiality: your data and your challenges do not leave your Clermont premises. No lock-in: installed tools are your personal accounts, no Axion-IA dependency after the session. Lodging, meals and travel allowance billed separately on prior quote. If the session does not bring you immediate actionable value, full refund (clause available, never triggered).",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Clermont-Ferrand ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Clermont-Ferrand qu'à Paris.",
    },
    {
      q: "Axion-IA intervient-il sur les sites industriels du bassin clermontois ?",
      a: "Oui. Nous couvrons l'ensemble de l'agglomération : Technopôle La Pardieu, campus des Cézeaux, zones industrielles des Gravanches, Cournon-d'Auvergne, Chamalières, Aubière, Riom et les communes du bassin jusqu'à Issoire.",
    },
    {
      q: "Travaillez-vous avec les sous-traitants de la filière Michelin ?",
      a: "Oui. La lecture automatisée de cahiers des charges donneurs d'ordres, la gestion documentaire PPAP et le reporting qualité sont parmi nos cas d'usage les plus fréquents dans le bassin. Nos missions respectent les exigences de confidentialité strictes de la filière automobile.",
    },
    {
      q: "Quels secteurs clermontois sont prioritaires pour l'IA ?",
      a: "Nos déploiements dans le bassin couvrent prioritairement l'industrie manufacturière (filière pneumatique, équipementiers), l'agroalimentaire (coopératives, IAA Auvergne), la recherche et les biotechnologies (UCA, ISIMA, Biopôle), et les services B2B. Tout secteur avec des workflows documentaires répétitifs est éligible à un audit.",
    },
    {
      q: "Pouvez-vous démarrer une mission depuis l'aéroport de Clermont-Ferrand (CFE) ?",
      a: "L'aéroport de Clermont-Ferrand Auvergne (Aulnat, 6 km) dessert Paris-Orly, Lyon et Amsterdam. Nos consultants peuvent arriver directement sur Clermont en avion pour les missions longues, ou en Intercités Paris-Bercy (~3 h) pour les kick-offs et restitutions.",
    },
    {
      q: "Vos interventions sont-elles compatibles avec les formations financées pour les TPE/PME ?",
      a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences. Votre service RH ou comptable peut les traiter comme une prestation de conseil. La CCI Puy-de-Dôme peut vous orienter sur les dispositifs régionaux complémentaires.",
    },
  ],
};
