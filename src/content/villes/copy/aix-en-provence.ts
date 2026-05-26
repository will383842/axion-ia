// Aix-en-Provence (13001) — contenu éditorial gold standard.
//
// Doctrine Will (identique Paris gold standard) :
//   - Aucun délai concret chiffré (pas de « 5-10 jours », « 48h », etc.).
//   - Aucun « frais de déplacement intégrés » — les frais sont en sus.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Durée minimale = 1 journée (pas de demi-journée).
//   - Aucun prix en dur : les tarifs viennent de `src/content/pricing.ts`.
//   - Tailles d'entreprise INSEE : TPE / PME / ETI / GE.
//   - ~95 % Axion-IA-centric, ~5 % data locale anti-doorway HCU 2024.
//   - PAS heroSchema, PAS unAUn.
//
// Réalités locales ancrées :
//   Airbus Helicopters (Marignane 25 km, 1er employeur du bassin),
//   CEA Cadarache + ITER (fusion thermonucléaire, 40 km nord),
//   Capenergies + Pôle SAFE (aérospatial / défense / énergie),
//   Technopôle Arbois (1er technopole environnement France, 79 ha),
//   STMicroelectronics Rousset (semi-conducteurs, 20 km),
//   AMU (80 K étudiants, 1re université francophone), Sciences Po Aix,
//   Arts et Métiers ParisTech campus Aix, IAE Aix, AMSE,
//   French Tech Aix-Marseille Région Sud,
//   Rencontres Économiques (Cercle des économistes — équivalent Davos FR),
//   24 056 établissements actifs INSEE 2024, 3 702 créations/an.

import type { VilleCopy } from "./types";

export const AIX_EN_PROVENCE_COPY: VilleCopy = {
  pitchFr:
    "Aix-en-Provence concentre 24 000 établissements actifs, un écosystème deeptech (CEA Cadarache, ITER, Airbus Helicopters à Marignane, STMicroelectronics Rousset), quatre pôles de compétitivité et trois technopôles. Axion-IA y intervient sur site, des TPE du Cours Mirabeau aux ETI industrielles du bassin Aix-Marseille.",
  pitchEn:
    "Aix-en-Provence hosts 24,000 active businesses, a deep-tech ecosystem (CEA Cadarache, ITER, Airbus Helicopters at Marignane, STMicroelectronics Rousset), four competitiveness clusters and three technopoles. Axion-IA intervenes on site, from micro-businesses on the Cours Mirabeau to industrial mid-caps across the Aix-Marseille basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Aix-en-Provence : nous identifions ce qui peut être automatisé dans votre structure et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI calibrés pour les TPE aixoises, les PME industrielles du bassin et les grands groupes de l'aérospatial.",
      en: "Operational AI audit in Aix-en-Provence: we identify what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, calibrated for Aix micro-businesses, basin industrial SMEs and large aerospace groups.",
    },
    interventions: {
      fr: "Interventions IA à Aix-en-Provence : formats sur site d'une à plusieurs journées pour vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Aix-en-Provence: on-site formats from one to several days for your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Aix-en-Provence : nous déployons l'IA dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuellement. Vos équipes gardent la main, aucun lock-in technologique.",
      en: "AI implementation in Aix-en-Provence: we deploy AI into your existing tools (CRM, ERP, email) with contractually-costed ROI. Your teams stay in control, no tech lock-in.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Aix-en-Provence : séances sur mesure pour dirigeants et cadres des PME industrielles, cabinets d'ingénierie et ETI du bassin Aix-Marseille. Axe technopôle Aix-Marseille, Aix-en-Provence Tech et grandes entreprises du pays d'Aix. Frais de logement, repas et forfait trajet en sus pour le présentiel.",
      en: "1-to-1 AI coaching in Aix-en-Provence: bespoke sessions for executives and managers at industrial SMEs, engineering firms and mid-caps across the Aix-Marseille basin. Lodging, meals and travel allowance billed separately for on-site sessions.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI du bassin Aix-Marseille — site vitrine premium pour sous-traitants aérospatial et cabinets d'ingénierie du Technopôle Arbois, espace client interactif, dashboard métier connecté à votre CRM/ERP/PLM. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for SMEs and mid-caps across the Aix-Marseille basin — premium showcase site for aerospace subcontractors and Arbois Technopole engineering firms, interactive customer space, business dashboard connected to your CRM/ERP/PLM. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Aix-en-Provence (13001) et dans le bassin Aix-Marseille sur site. Nous accompagnons les TPE, PME, ETI et grandes entreprises aixoises — activités scientifiques et techniques, industrie aérospatiale, énergie, enseignement, services B2B — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action actionnable. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an senior AI architects consultancy that intervenes in Aix-en-Provence (13001) and across the Aix-Marseille basin on site. We support micro-businesses, SMEs, mid-caps and large enterprises in Aix — scientific and technical activities, aerospace industry, energy, education, B2B services — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Activités scientifiques, techniques & conseil",
    "Aérospatial & Défense",
    "Énergie & Cleantech",
    "Industrie & Semi-conducteurs",
    "Enseignement supérieur & Recherche",
    "Commerce & Services B2B",
  ],

  distancesFr:
    "Gare TGV Aix-en-Provence (LGV Méditerranée, 15 km du centre). Aéroport Marseille Provence (Marignane, 25 km). Marseille à 30 km par l'A51/A7. Lyon en TGV direct. Réseau bus Aix-en-Bus pour couvrir les zones d'activité (Les Milles, Arbois, Rousset).",
  distancesEn:
    "Aix-en-Provence TGV station (LGV Méditerranée, 15 km from centre). Marseille Provence airport (Marignane, 25 km). Marseille 30 km via A51/A7. Lyon by direct TGV. Aix-en-Bus network covering business zones (Les Milles, Arbois, Rousset).",

  ecosystemFr:
    "24 056 établissements actifs (INSEE 2024), dont 6 242 activités scientifiques et techniques — premier secteur de la ville. Bassin dominé par l'aérospatial (Airbus Helicopters Marignane), l'énergie (CEA Cadarache, ITER, Capenergies), la microélectronique (STMicroelectronics Rousset) et le digital. AMU (80 K étudiants), Sciences Po Aix, Arts et Métiers ParisTech campus, IAE Aix fournissent un vivier de cadres. French Tech Aix-Marseille Région Sud et Technopôle Arbois animent l'innovation.",
  ecosystemEn:
    "24,056 active establishments (INSEE 2024), including 6,242 in scientific and technical activities — the city's leading sector. Basin dominated by aerospace (Airbus Helicopters Marignane), energy (CEA Cadarache, ITER, Capenergies), microelectronics (STMicroelectronics Rousset) and digital. AMU (80K students), Sciences Po Aix, Arts et Métiers ParisTech campus, IAE Aix supply a pipeline of managers. French Tech Aix-Marseille Région Sud and Technopôle Arbois drive innovation.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre structure aixoise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE indépendantes du Cours Mirabeau aux ETI industrielles du bassin (aérospatial, énergie, industrie, conseil). Restitution toujours en présentiel dans vos locaux, plan d'action remis en main propre.",
        whyHere: [
          "Aix-en-Provence est un pôle d'intervention prioritaire pour Axion-IA dans le quart sud-est : tissu dense d'activités scientifiques et techniques (6 242 établissements), PME industrielles bassin Marignane-Rousset, cabinets conseil et ingénierie en forte croissance.",
          "Proximité de clusters à forte intensité R&D (CEA Cadarache, ITER, Capenergies, Pôle SAFE) où les équipes d'ingénieurs ont les cas d'usage IA les plus complexes et les plus rentables.",
          "Tissu de TPE et PME de services (conseil, juridique, formation, santé) bien représenté dans nos audits régionaux : Technopôle Arbois, Les Milles, centre-ville aixois.",
          "Restitutions toujours en présentiel dans vos locaux à Aix ou dans le bassin (Marignane, Vitrolles, Rousset, Bouc-Bel-Air) : atelier d'idéation, lecture du livrable avec votre comité de direction.",
          "Tarifs publics affichés, aucun devis opaque. Vous connaissez le prix avant de signer.",
          "Votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit : aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Identification des workflows candidats à l'IA selon votre secteur (aérospatial, énergie, services, industrie).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux — Aix centre, Technopôle Arbois, Les Milles ou bassin (Marignane, Rousset) — pour observer les outils du quotidien et identifier les irritants métier.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts avec vos fonctions clés (opérations, R&D, commerce, finance, RH, support) pour cartographier précisément frictions et attentes selon votre activité principale.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, rapports techniques, factures. Pas de slides théoriques — vos données, votre réalité métier.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois, priorisée selon vos contraintes réglementaires et budgétaires.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets aixois jusqu'à une dizaine de collaborateurs (conseil, juridique, santé, artisans du numérique).",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles du bassin Marignane-Rousset, les cabinets d'ingénierie Arbois et les agences de services B2B de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI sous-traitants aérospatial, fournisseurs d'énergie ou sociétés de conseil souhaitant cadrer une trajectoire IA pluriannuelle avec gouvernance intégrée.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites de grands groupes implantés dans le bassin (aérospatial, énergie, microélectronique) cherchant à cadrer une gouvernance IA centralisée multi-entités.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a livré ce que nous cherchions depuis des mois : un livrable chiffré, ancré dans nos process réels d'ingénierie, sans jargon. Le plan d'action a été présenté à notre comité de direction en une seule session.",
            role: "Directeur Général",
            companyProfile: "PME d'ingénierie aérospatiale, bassin de Marignane",
          },
          {
            quote:
              "Méthode très pragmatique, démos sur nos vrais documents techniques plutôt que des slides génériques. On a pu prioriser nos cas IA en toute connaissance de cause.",
            role: "Directrice des opérations",
            companyProfile: "ETI conseil et services B2B, Technopôle Arbois Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Aix-en-Provence ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est défini lors du brief de cadrage initial en fonction de votre agenda et de la complexité de votre organisation.",
          },
          {
            q: "Quel ROI peut-on attendre pour une PME industrielle du bassin Aix-Marseille ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein libérés sur les tâches répétitives (rédaction de rapports techniques, qualification de leads, traitement de documents). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données techniques (plans, données R&D) restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte assurée dès le démarrage, données traitées exclusivement sur vos infrastructures ou en local, aucune extraction vers nos serveurs. Conformité RGPD, possibilité de modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise — particulièrement important pour les acteurs défense et nucléaire.",
          },
          {
            q: "Pouvez-vous intervenir à Marignane, Rousset ou dans le bassin ?",
            a: "Oui. Nous intervenons sur l'ensemble du bassin Aix-Marseille : Aix-en-Provence centre, Technopôle Arbois, Les Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air. L'adresse précise d'intervention est confirmée en cadrage. Frais de trajet facturés en sus selon la distance.",
          },
          {
            q: "En quoi Axion-IA se distingue d'un cabinet de conseil traditionnel à Aix ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, aucun devis à six chiffres à négocier. Méthode condensée sur le terrain plutôt que de longues missions théoriques. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il déjà utiliser l'IA dans l'entreprise pour demander un audit ?",
            a: "Non. La majorité de nos audits dans le bassin Aix-Marseille sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, mais jamais activée à ce jour sur nos missions dans le bassin Aix-Marseille).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Aix-en-Provence company and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from independent Aix micro-businesses to industrial mid-caps and large-group sites in the Aix-Marseille basin (aerospace, energy, microelectronics, B2B services). Read-out always in person at your premises, action plan handed over face to face.",
        whyHere: [
          "Aix-en-Provence is a priority engagement hub for Axion-IA in the south-east: dense scientific and technical activity fabric (6,242 establishments), industrial SMEs in the Marignane-Rousset basin, consulting and engineering firms in strong growth.",
          "Proximity to high R&D-intensity clusters (CEA Cadarache, ITER, Capenergies, Pôle SAFE) where engineering teams have the most complex and highest-ROI AI use cases.",
          "Services SME and micro-business fabric (consulting, legal, training, health) well represented in our regional audits: Arbois technopole, Les Milles, Aix city centre.",
          "Read-outs always in person at your premises in Aix or across the basin (Marignane, Vitrolles, Rousset, Bouc-Bel-Air): ideation workshop, deliverable walk-through with your executive committee.",
          "Public pricing, no opaque quotes. You know the price before signing.",
          "Your action plan is executable with any vendor or in-house after our audit: no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). AI-candidate workflow identification per your sector (aerospace, energy, services, industry).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your premises — Aix centre, Arbois technopole, Les Milles or basin (Marignane, Rousset) — to observe daily tools and identify business pain points.",
          },
          {
            step: "Employee interviews",
            detail:
              "Short individual interviews with your key functions (operations, R&D, sales, finance, HR, support) to precisely map frictions and expectations per your main activity.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, technical reports, invoices. No theoretical slides — your data, your business reality.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap prioritised per your regulatory and budget constraints.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Aix freelancers, micro-firms and practices up to about ten staff (consulting, legal, health, digital crafts).",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial SMEs in the Marignane-Rousset basin, Arbois engineering firms and B2B services agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For aerospace subcontractors, energy suppliers or consulting firms framing a multi-year AI trajectory with integrated governance.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large-group sites in the basin (aerospace, energy, microelectronics) framing centralized multi-entity AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered what we had been looking for months: a costed deliverable, grounded in our real engineering processes, jargon-free. The action plan was presented to our executive committee in a single session.",
            role: "CEO",
            companyProfile: "Aerospace engineering SME, Marignane basin",
          },
          {
            quote:
              "Very pragmatic method, demos on our real technical documents rather than generic slides. We were able to prioritise our AI use cases with full confidence.",
            role: "Head of Operations",
            companyProfile:
              "B2B consulting and services mid-cap, Arbois Technopole Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Aix-en-Provence?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. The cadence is defined at the framing brief based on your schedule and organisation complexity.",
          },
          {
            q: "What ROI can an industrial SME in the Aix-Marseille basin expect?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents several FTEs freed on repetitive tasks (technical report writing, lead qualification, document processing). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my technical data (plans, R&D data) stay confidential during the audit?",
            a: "Yes. Confidentiality ensured before any start, data processed exclusively on your infrastructure or locally, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra if sovereignty is required — particularly important for defence and nuclear players.",
          },
          {
            q: "Can you intervene at Marignane, Rousset or elsewhere in the basin?",
            a: "Yes. We cover the entire Aix-Marseille basin: Aix-en-Provence centre, Arbois technopole, Les Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air. Exact address confirmed at framing. Travel costs billed separately based on distance.",
          },
          {
            q: "How does Axion-IA differ from a traditional Aix consulting firm?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed field method rather than long theoretical missions. No lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need to already use AI in my company to request an audit?",
            a: "No. The majority of our audits in the Aix-Marseille basin are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your plan is executable with any vendor or in-house. If after the read-out the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Aix-Marseille basin missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Aix-en-Provence se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — qu'ils soient ingénieurs chez un sous-traitant aérospatial, consultants à Arbois ou chargés de clientèle dans une PME de services. Frais de logement, repas et forfait trajet en sus.",
        whyHere: [
          "Aix-en-Provence est un pôle d'intervention dans le bassin sud-est : nous y déroulons des sessions pour les équipes d'ingénierie, de conseil, de services et d'administration.",
          "Toutes les zones d'activité couvertes : centre-ville aixois, Technopôle Arbois, Zone des Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air, Venelles.",
          "Le format Essentielle est calibré pour les structures aixoises de quelques personnes à une centaine de collaborateurs.",
          "Le format Conférence convient aux grandes plénières d'entreprise (salles de séminaire des hôtels haut de gamme d'Aix, espaces de l'Arbois, auditoriums des grandes entreprises du bassin).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI et filiales régionales.",
          "Vocabulaire ajusté à votre secteur : ingénierie aérospatiale, énergie, services numériques, conseil, agroalimentaire. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, le secteur métier d'Aix-en-Provence et les cas d'usage prioritaires (R&D, ingénierie, commercial, administratif).",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports techniques, emails, devis, contrats) pour calibrer les démos sur VOS données, pas sur des exemples génériques.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux (Aix ou bassin) pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Vocabulaire technique ajusté à votre secteur dominant.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel (rédaction de rapports techniques, qualification de leads, résumés de réunion, traitement de documents). Utilisables le lendemain sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour les indépendants, cabinets, agences et petites structures aixoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (ingénierie, commercial, finance, RH) dans les PME industrielles ou de services du bassin.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction pour les ETI aérospatiales, énergétiques ou de conseil du bassin Aix-Marseille.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands sites du bassin : roadshow multi-sites Marignane-Rousset-Aix, séminaires CODIR + cascade équipes ingénierie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calibré à nos métiers d'ingénierie. Nos collaborateurs sont repartis avec leurs outils configurés sur nos vrais types de documents. L'adoption a été rapide.",
            role: "Responsable RH",
            companyProfile: "PME sous-traitante aérospatiale, bassin de Marignane",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur la trajectoire IA du groupe. Axion-IA a su adapter le discours à notre contexte énergétique sans jargon superflu.",
            role: "Directeur Général",
            companyProfile: "ETI énergie & services industriels, Technopôle Arbois",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Aix-en-Provence ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats (plusieurs sites du bassin ou plusieurs équipes), le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils IA installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux secteurs spécifiques d'Aix (aérospatial, énergie, cleantech) ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe d'ingénieurs sous-traitants Airbus Helicopters n'a rien à voir avec une session pour un cabinet de conseil en stratégie.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur métier aixois, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Aix-en-Provence come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether they are engineers at an aerospace subcontractor, consultants at Arbois or account managers at a services SME. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Aix-en-Provence is an engagement hub in the south-east basin: we run sessions there for engineering, consulting, services and administration teams.",
          "All business zones covered: Aix city centre, Arbois technopole, Les Milles district, Marignane, Vitrolles, Rousset, Bouc-Bel-Air, Venelles.",
          "The Essential format is calibrated for Aix structures from a few people to about a hundred staff.",
          "The Talk format suits large corporate plenaries (Aix premium hotel seminar rooms, Arbois spaces, large-group basin auditoriums).",
          "The Executives format enables in-camera framing for mid-cap and regional subsidiary executive committees.",
          "Vocabulary adjusted to your sector: aerospace engineering, energy, digital services, consulting, food industry. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, Aix-en-Provence business sector and priority use cases (R&D, engineering, sales, admin).",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (technical reports, emails, quotes, contracts) to calibrate demos on YOUR data, not generic examples.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises (Aix or basin) to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Technical vocabulary adjusted to your dominant sector.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case (technical report writing, lead qualification, meeting summaries, document processing). Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail: "Ideal for Aix freelancers, firms and agencies up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (engineering, sales, finance, HR) in industrial or services SMEs across the basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee for aerospace, energy or consulting mid-caps in the Aix-Marseille basin.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large basin sites: multi-site roadshows Marignane-Rousset-Aix, exec committee + engineering team cascade seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated to our engineering roles. Our staff left with tools configured on our real document types. Adoption was fast.",
            role: "HR Manager",
            companyProfile: "Aerospace subcontracting SME, Marignane basin",
          },
          {
            quote:
              "The executive talk aligned the whole group on AI trajectory in a single day. Axion-IA adapted the pitch to our energy context without superfluous jargon.",
            role: "CEO",
            companyProfile: "Energy and industrial services mid-cap, Arbois Technopole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Aix-en-Provence take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program (multiple basin sites or teams), the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the AI tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to Aix-specific sectors (aerospace, energy, cleantech)?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for an Airbus Helicopters subcontractor engineering team has nothing to do with one for a strategy consulting firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Aix business sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Aix-en-Provence met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux à Aix ou dans le bassin. Cas typiques : automatisation de rapports techniques pour les ETI industrielles, agents support pour les cabinets de conseil, traitement de devis et factures pour les PME de services.",
        whyHere: [
          "Le bassin Aix-Marseille concentre des cas d'usage IA particulièrement matures : traitement de documentation technique (aérospatial, énergie), analyse de données terrain (ITER, Cadarache), qualification de leads B2B pour les sociétés de conseil et de services.",
          "Le kick-off se déroule systématiquement en présentiel dans vos locaux — Aix centre, Technopôle Arbois, Les Milles, Marignane ou Rousset — : alignement des équipes, accès aux données, validation des intégrations CRM/ERP.",
          "Itérations à distance ensuite avec un point régulier en visio et une visite périodique pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel : passation de pouvoir, formation des ambassadeurs IA internes sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs clés : ils deviennent les référents IA internes, autonomes après la fin de mission.",
          "Cas typiques du bassin : PME aérospatial (lecture de documents techniques, rapports de maintenance), cabinets d'ingénierie Arbois (qualification d'appels d'offres), sociétés de conseil (synthèses de réunions, qualification leads), TPE de services (emails, devis, factures).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site à Aix ou dans le bassin : revue de l'architecture cible (CRM, ERP, PLM, mails, stockage), validation des contraintes RGPD/sécurité (particulièrement prégnantes pour les acteurs défense, nucléaire, aérospatial), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site dans le bassin : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe technique.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point régulier : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX selon les retours terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site dans le bassin : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (lecture de factures, comptes-rendus de réunion, qualification de leads) pour les TPE aixoises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour les PME industrielles, d'ingénierie ou de services du bassin Aix-Marseille.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (PLM, ERP industriel, datalake), formation d'ambassadeurs cross-département pour les ETI du bassin.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour grands sites du bassin (aérospatial, énergie, microélectronique) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation traitement de documentation technique livrée conformément au SOW. ROI réel mesuré au-delà de la prédiction : temps libéré sur la rédaction de rapports, gain annuel net significatif pour nos équipes d'ingénierie.",
            role: "Directeur technique",
            companyProfile: "ETI sous-traitante industrielle, bassin de Marignane",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre organisation multi-sites bassin Aix-Marseille. Kick-off sur site intense, puis itérations à distance efficaces. Les ambassadeurs internes ont pris le relais sans dépendance vis-à-vis d'Axion-IA.",
            role: "DSI",
            companyProfile: "Groupe de services B2B, siège Technopôle Arbois Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA dans le bassin Aix-Marseille ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-sites sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions dans le bassin Aix-Marseille. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données (techniques, industrielles, commerciales) restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée en UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD strict, possibilité infra souveraine pour les acteurs sensibles (défense, nucléaire, aérospatial).",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des documents techniques sensibles ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (documents réglementaires, contrats, données de sécurité), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Aix-en-Provence brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your premises in Aix or across the basin. Typical use cases: technical report automation for industrial mid-caps, support agents for consulting firms, quote and invoice processing for services SMEs.",
        whyHere: [
          "The Aix-Marseille basin concentrates particularly mature AI use cases: technical documentation processing (aerospace, energy), field data analysis (ITER, Cadarache), B2B lead qualification for consulting and services companies.",
          "Kick-off always in person at your premises — Aix centre, Arbois technopole, Les Milles, Marignane or Rousset: team alignment, data access, CRM/ERP integration validation.",
          "Remote iterations afterwards with regular video check-ins and periodic on-site visits for progress demos with your executive committee.",
          "Final acceptance always in person: handover, training of internal AI ambassadors on their workstations, runbook documentation delivered.",
          "Training included for your key staff: they become internal AI champions, autonomous after mission end.",
          "Typical basin use cases: aerospace SMEs (technical document reading, maintenance reports), Arbois engineering firms (RFP qualification), consulting firms (meeting summaries, lead qualification), services micro-businesses (emails, quotes, invoices).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site workshop in Aix or across the basin: target architecture review (CRM, ERP, PLM, emails, storage), GDPR/security constraints validation (particularly stringent for defence, nuclear, aerospace players), AI model selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site in the basin: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with regular check-ins: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments per field feedback.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in the basin: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (invoice reading, meeting minutes, lead qualification) for Aix micro-businesses.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For industrial, engineering or services SMEs in the Aix-Marseille basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (PLM, industrial ERP, datalake), training of cross-department ambassadors for basin mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for large basin sites (aerospace, energy, microelectronics): cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical documentation processing implementation delivered per SOW. Real ROI measured beyond prediction: time freed on report writing, significant net annual gain for our engineering teams.",
            role: "Technical Director",
            companyProfile: "Industrial subcontracting mid-cap, Marignane basin",
          },
          {
            quote:
              "Perfect hybrid method for our multi-site Aix-Marseille organisation. Intense on-site kick-off, then efficient remote iterations. Internal ambassadors took over with no dependency on Axion-IA.",
            role: "CIO",
            companyProfile:
              "B2B services group, headquartered at Arbois Technopole Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in the Aix-Marseille basin take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-site large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Aix-Marseille basin missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data (technical, industrial, commercial) stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR, sovereign infra option available for sensitive players (defence, nuclear, aerospace).",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on sensitive technical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (regulatory documents, contracts, safety data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Aix-en-Provence accompagne individuellement les dirigeants et cadres dirigeants des PME industrielles, ETI aérospatiales et cabinets de conseil du bassin Aix-Marseille. À partir de 990 € HT pour les TPE, chaque programme est construit autour de votre réalité métier — technopôle Arbois, Les Milles, Marignane, Rousset. Vous accélérez votre montée en compétence IA sans perdre de temps sur du théorique non applicable.",
        whyHere: [
          "Le bassin Aix-Marseille concentre des dirigeants d'ETI aérospatiales, énergétiques et industrielles avec des agendas très contraints : le coaching 1-to-1 s'adapte à leurs plages disponibles, y compris en visio depuis leur bureau ou en présentiel dans leurs locaux.",
          "Les cabinets d'ingénierie et sociétés de conseil du Technopôle Arbois et de Les Milles ont des cas d'usage IA très précis (qualification d'appels d'offres, rédaction de rapports techniques) — le coaching individuel cible exactement leurs enjeux réels.",
          "Pour les dirigeants de PME aixoises exposés aux écosystèmes deeptech (Capenergies, ITER, STMicro), le 1-to-1 permet de comprendre l'IA sans filtre et de bâtir une feuille de route personnalisée.",
          "La French Tech Aix-Marseille Région Sud et Angers Technopole regroupent des fondateurs et managers qui veulent intégrer l'IA dans leur produit — le coaching individuel est plus efficace qu'une formation collective à ce stade.",
          "Séances flexibles : 100 % en visio ou hybride visio + présentiel Aix/bassin. Aucun déplacement imposé, aucun groupe à synchroniser.",
          "Aucun lock-in : vous repartez avec vos notes, vos plans d'action et votre autonomie — sans dépendance vis-à-vis d'Axion-IA.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Séance d'ouverture pour cartographier votre maturité IA, vos cas d'usage prioritaires (rédaction, analyse, automatisation, décision) et vos outils existants dans le contexte du bassin Aix-Marseille.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Nous co-construisons un plan de séances calé sur votre agenda : fréquence, sujets, format (visio ou présentiel à Aix, Arbois, Les Milles ou dans le bassin). Chaque séance a un objectif actionnable précis.",
          },
          {
            step: "Séances pratiques sur vos vraies données",
            detail:
              "Chaque session travaille directement sur vos documents, emails, propositions commerciales ou données métier. Vous voyez l'IA appliquée à votre réalité, pas à des exemples génériques.",
          },
          {
            step: "Ancrage et mise en pratique",
            detail:
              "Entre les séances, vous expérimentez les outils installés sur vos cas réels. La séance suivante démarre par un debriefing de ce qui a fonctionné ou bloqué — ajustement du plan en continu.",
          },
          {
            step: "Bilan et feuille de route",
            detail:
              "En fin de programme, restitution d'une feuille de route personnalisée : cas d'usage prioritaires, outils retenus, prochaines étapes pour votre structure. Vous repartez autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Programme d'entrée pour les indépendants, gérants de TPE et fondateurs de startups de la French Tech Aix-Marseille souhaitant intégrer l'IA dans leur activité quotidienne.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme sur mesure pour les dirigeants et cadres des PME industrielles, cabinets d'ingénierie et sociétés de services du bassin Aix-Marseille.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour DG, DGA, DSI ou directeurs métiers des ETI aérospatiales, énergétiques ou de conseil implantées dans le pays d'Aix.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de cadres dirigeants et membres CODIR des grands groupes du bassin (Airbus Helicopters, CEA Cadarache, STMicroelectronics) souhaitant un accompagnement individualisé.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de passer de zéro à opérationnel sur l'IA en quelques séances. On a travaillé directement sur mes dossiers techniques, pas sur des cas fictifs. J'aurais perdu des mois à tâtonner seul.",
            role: "Directeur général",
            companyProfile: "PME d'ingénierie aérospatiale, bassin de Marignane",
          },
          {
            quote:
              "Format idéal pour un agenda de DG : séances courtes, 100 % focalisées sur mon contexte business. Axion-IA a su adapter le discours au contexte industriel de notre site du Technopôle Arbois.",
            role: "Directrice générale",
            companyProfile: "ETI conseil et services B2B, Technopôle Arbois Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "Quel est le format des séances de coaching 1-to-1 à Aix-en-Provence ?",
            a: "Les séances se déroulent en visio ou en présentiel dans vos locaux à Aix-en-Provence, au Technopôle Arbois, à Les Milles ou dans le bassin selon votre préférence. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel.",
          },
          {
            q: "Quelle est la fréquence des séances ?",
            a: "La fréquence est définie ensemble lors du diagnostic initial selon votre rythme et vos objectifs. Elle peut être hebdomadaire, bimensuelle ou mensuelle. Aucun calendrier imposé.",
          },
          {
            q: "Le coaching en présentiel est-il possible à Marignane ou Rousset ?",
            a: "Oui. Nous intervenons dans l'ensemble du bassin Aix-Marseille : Aix centre, Technopôle Arbois, Les Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air. Frais de trajet facturés en sus selon la distance.",
          },
          {
            q: "Quels secteurs sont concernés par le coaching 1-to-1 à Aix ?",
            a: "Tous les secteurs B2B du bassin : aérospatial, énergie, microélectronique, ingénierie, conseil, services numériques, agroalimentaire. Le coaching s'adapte à votre secteur dominant et à vos cas d'usage réels.",
          },
          {
            q: "Mes échanges et données sont-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos données, documents et informations métier ne sortent jamais de la session. Conformité RGPD.",
          },
          {
            q: "Quelle est la différence entre le coaching 1-to-1 et un audit IA ?",
            a: "L'audit IA cartographie votre organisation et produit un livrable collectif avec un plan d'action. Le coaching 1-to-1 vous forme et vous accompagne individuellement sur la durée : vous montez en compétence et vous prenez les décisions IA par vous-même, en autonomie croissante.",
          },
        ],
        guarantees:
          "Aucun engagement de durée minimum : vous pilotez le programme séance par séance. Confidentialité stricte. Frais de logement, repas et forfait trajet en sus pour le présentiel. Aucun lock-in : vous repartez avec vos plans d'action et votre autonomie. Si la première séance ne vous apporte pas de valeur concrète, elle est remboursée intégralement.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Aix-en-Provence individually supports executives and senior managers at industrial SMEs, aerospace mid-caps and consulting firms across the Aix-Marseille basin. Starting from 990 € excl. VAT for micro-businesses, each programme is built around your specific business reality — Arbois technopole, Les Milles, Marignane, Rousset. You accelerate your AI proficiency without wasting time on non-applicable theory.",
        whyHere: [
          "The Aix-Marseille basin concentrates aerospace, energy and industrial mid-cap executives with highly constrained agendas: 1-to-1 coaching adapts to their available slots, including by video from their desk or in person at their premises.",
          "Engineering firms and consulting companies at Arbois technopole and Les Milles have very specific AI use cases (RFP qualification, technical report writing) — individual coaching targets their actual challenges precisely.",
          "For Aix SME executives exposed to deeptech ecosystems (Capenergies, ITER, STMicro), 1-to-1 coaching enables unfiltered AI understanding and a personalised roadmap.",
          "French Tech Aix-Marseille Région Sud founders and managers wanting to integrate AI into their product find individual coaching more effective than group training at this stage.",
          "Flexible sessions: 100% video or hybrid video + on-site Aix/basin. No imposed travel, no group to synchronise.",
          "No lock-in: you leave with your notes, action plans and full autonomy — no dependency on Axion-IA.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "Opening session to map your AI maturity, priority use cases (writing, analysis, automation, decision-making) and existing tools in the context of the Aix-Marseille basin.",
          },
          {
            step: "Personalised progression plan",
            detail:
              "We co-build a session plan fitted to your agenda: frequency, topics, format (video or on-site in Aix, Arbois, Les Milles or across the basin). Each session has a precise actionable objective.",
          },
          {
            step: "Practical sessions on your real data",
            detail:
              "Each session works directly on your documents, emails, proposals or business data. You see AI applied to your reality, not generic examples.",
          },
          {
            step: "Anchoring and practice",
            detail:
              "Between sessions, you experiment with installed tools on your real cases. The next session starts with a debrief of what worked or blocked — continuous plan adjustment.",
          },
          {
            step: "Review and roadmap",
            detail:
              "At programme end, a personalised roadmap is delivered: priority use cases, retained tools, next steps for your organisation. You leave autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From 990 € excl. VAT",
            detail:
              "Entry programme for freelancers, micro-business owners and French Tech Aix-Marseille startup founders wishing to integrate AI into their daily work.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Bespoke programme for executives and managers at industrial SMEs, engineering firms and service companies across the Aix-Marseille basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Individual coaching for CEOs, deputy CEOs, CIOs or business directors of aerospace, energy or consulting mid-caps established in the Aix area.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Executive coaching for senior managers and board members at large-group basin sites (Airbus Helicopters, CEA Cadarache, STMicroelectronics) seeking individualised support.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching took me from zero to operational on AI in a few sessions. We worked directly on my technical files, not fictional examples. I would have wasted months figuring it out alone.",
            role: "CEO",
            companyProfile: "Aerospace engineering SME, Marignane basin",
          },
          {
            quote:
              "Ideal format for a CEO schedule: short sessions, 100% focused on my business context. Axion-IA adapted the approach to our industrial setting at Arbois Technopole.",
            role: "Managing Director",
            companyProfile:
              "B2B consulting and services mid-cap, Arbois Technopole Aix-en-Provence",
          },
        ],
        faq: [
          {
            q: "What is the format of 1-to-1 coaching sessions in Aix-en-Provence?",
            a: "Sessions take place by video or in person at your premises in Aix-en-Provence, Arbois technopole, Les Milles or across the basin depending on your preference. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "How often are the sessions?",
            a: "Frequency is defined together at the initial diagnostic according to your rhythm and objectives. It can be weekly, fortnightly or monthly. No imposed schedule.",
          },
          {
            q: "Is on-site coaching possible at Marignane or Rousset?",
            a: "Yes. We cover the entire Aix-Marseille basin: Aix centre, Arbois technopole, Les Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air. Travel costs billed separately based on distance.",
          },
          {
            q: "Which sectors does 1-to-1 coaching cover in the Aix area?",
            a: "All B2B sectors in the basin: aerospace, energy, microelectronics, engineering, consulting, digital services, agri-food. Coaching adapts to your dominant sector and real use cases.",
          },
          {
            q: "Are my exchanges and data kept confidential?",
            a: "Yes. Strict confidentiality from the first session. Your data, documents and business information never leave the session. GDPR compliant.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and an AI audit?",
            a: "An AI audit maps your organisation and produces a collective deliverable with an action plan. 1-to-1 coaching trains and supports you individually over time: you build AI competency and make AI decisions yourself, with growing autonomy.",
          },
        ],
        guarantees:
          "No minimum commitment: you drive the programme session by session. Strict confidentiality. Lodging, meals and travel allowance billed separately for on-site sessions. No lock-in: you leave with your action plans and full autonomy. If the first session delivers no concrete value, it is fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Aix-en-Provence ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Aix-en-Provence et dans le bassin (Marignane, Vitrolles, Rousset).",
    },
    {
      q: "Axion-IA intervient-il dans les entreprises aérospatiales et industrielles du bassin Aix-Marseille ?",
      a: "Oui. Nous accompagnons les sous-traitants aérospatial, les fournisseurs d'énergie, les sociétés d'ingénierie et les PME industrielles du bassin — Marignane, Vitrolles, Rousset, Les Milles, Technopôle Arbois. Les cas d'usage typiques sont le traitement de documentation technique, la qualification d'appels d'offres et la rédaction assistée de rapports.",
    },
    {
      q: "Quels secteurs sont prioritaires à Aix-en-Provence pour l'IA opérationnelle ?",
      a: "Nos déploiements aixois couvrent en priorité les activités scientifiques et techniques (cabinets d'ingénierie, R&D, conseil), l'aérospatial et l'industrie (sous-traitants bassin Marignane), l'énergie et le cleantech (Capenergies, acteurs Technopôle Arbois), et les services B2B (cabinets conseil, juridique, formation). Tout secteur est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site à Aix-en-Provence et dans tout le bassin ?",
      a: "Oui. Toutes nos interventions sont par défaut sur site. Nous couvrons Aix-en-Provence centre, le Technopôle Arbois, la Zone des Milles, Marignane, Vitrolles, Rousset, Bouc-Bel-Air et Venelles. Frais de trajet facturés en sus selon la localisation.",
    },
    {
      q: "Pouvez-vous travailler avec des entreprises proches du CEA Cadarache ou d'ITER ?",
      a: "Oui. Nous intervenons pour des structures du bassin proches de ces centres de recherche d'envergure mondiale (Saint-Paul-lez-Durance, Manosque, nord du bassin Aix). La gestion des contraintes de confidentialité et de sécurité est intégrée au cadrage (Confidentialité stricte, infra souveraine, modèles on-premise).",
    },
    {
      q: "Travaillez-vous avec les startups de la French Tech Aix-Marseille ?",
      a: "Oui. Nous accompagnons régulièrement les startups et scale-ups issues de la French Tech Aix-Marseille Région Sud et des structures d'incubation du Technopôle Arbois. Notre offre POC et Essentielle est calibrée pour les structures avec un product-market fit établi qui veulent passer du prototype IA à un déploiement opérationnel.",
    },
  ],
};
