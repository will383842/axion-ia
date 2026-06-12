// Grenoble (38185) — contenu éditorial gold standard.
//
// Sprint City Quality V3 ville #19 — copy créée 2026-05-20.
//
// Doctrine Paris respectée :
//   - Aucun délai chiffré, aucun frais déplacement intégrés,
//     aucun prix en dur, durée min 1 journée.
//   - "frais de logement, repas et forfait trajet en sus" pour interventions.
//   - Tailles INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE bouclier anti-doorway HCU 2024.
//   - PAS heroSchema, PAS unAUn (non demandés).
//
// Réalités Grenoble : CEA-Leti (Minatec), STMicroelectronics, Soitec,
// Schneider Electric, Naver Labs Europe, Inria, UGA, Grenoble INP/Ensimag,
// French Tech in the Alps, Minalogic, Tenerrdis, Inovallée.

import type { VilleCopy } from "./types";

export const GRENOBLE_COPY: VilleCopy = {
  pitchFr:
    "Grenoble, capitale française de la micro-nanoélectronique et 'Silicon Valley européenne', regroupe 6 400 entreprises actives, le pôle R&D mondial Minatec (CEA-Leti, ESRF, ILL), les sites majeurs de STMicroelectronics, Soitec et Schneider Electric, ainsi que Naver Labs Europe et l'Ensimag. Axion-IA y accompagne les PME deep-tech, les spin-offs et les directions IA des grands groupes industriels.",
  pitchEn:
    "Grenoble, France's micro-nanoelectronics capital and 'European Silicon Valley', brings together 6,400 active businesses, the global R&D hub Minatec (CEA-Leti, ESRF, ILL), major sites of STMicroelectronics, Soitec and Schneider Electric, plus Naver Labs Europe and Ensimag. Axion-IA supports deep-tech SMEs, spin-offs and large industrial group AI leadership there.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Grenoble : nous identifions les cas d'usage prioritaires pour vos équipes R&D, vos fonctions support et vos lignes de production, et nous chiffrons le ROI spécifique à votre secteur — micro-électronique, énergie, logiciel ou industrie alpine.",
      en: "Operational AI audit in Grenoble: we identify priority use cases for your R&D teams, support functions and production lines, then quantify ROI specific to your sector — micro-electronics, energy, software or alpine industry.",
    },
    interventions: {
      fr: "Interventions IA à Grenoble : formats sur site d'une à plusieurs journées pour ingénieurs, chercheurs et équipes de direction. Vos collaborateurs repartent autonomes avec des outils IA installés et configurés. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Grenoble: on-site formats from one to several days for engineers, researchers and management teams. Your staff leave autonomous with AI tools installed and configured. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Grenoble : déploiement de cas d'usage IA dans vos outils existants (PLM, ERP, outils R&D, SI métier) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance fournisseur.",
      en: "AI implementation in Grenoble: deployment of AI use cases in your existing tools (PLM, ERP, R&D toolchains, business IT) with contractually-costed ROI. Your teams stay in control, no vendor dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Grenoble — à partir de {{price:intervention-dirigeants|flat}}. Un consultant senior dédié à votre cas, dans vos locaux de la Presqu'île scientifique, d'Inovallée ou du bassin grenoblois : ingénieur deeptech, chercheur, directeur R&D ou fondateur de spin-off qui veut progresser seul, sur ses propres données et contraintes.",
      en: "Individual AI coaching in Grenoble — from {{price:intervention-dirigeants|compact}} excl. VAT. A senior consultant dedicated to your case, at your Science Peninsula, Inovallée or Grenoble basin premises: deep-tech engineer, researcher, R&D director or spin-off founder who wants to progress alone, on their own data and constraints.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI grenobloises — site vitrine premium pour deeptech Minatec et spin-offs CEA-Leti, espace client interactif, dashboard métier connecté à votre CRM/ERP/PLM. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Grenoble SMEs and mid-caps — premium showcase site for Minatec deeptech and CEA-Leti spin-offs, interactive customer space, business dashboard connected to your CRM/ERP/PLM. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Grenoble (38) sur site, couvrant la ville et le bassin grenoblois (Meylan, Échirolles, Saint-Martin-d'Hères, Inovallée). Nous accompagnons les TPE tech et les spin-offs CEA/CNRS, les PME industrielles et de services, les ETI deep-tech (Soitec, Poma, Petzl et leurs sous-traitants) ainsi que les grands groupes (STMicroelectronics, Schneider Electric, Atos) sur leurs chantiers IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action béton. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an senior AI experts consultancy that intervenes in Grenoble (38) on site, covering the city and the Grenoble basin (Meylan, Échirolles, Saint-Martin-d'Hères, Inovallée). We support deep-tech micro-businesses and CEA/CNRS spin-offs, industrial and services SMEs, deep-tech mid-caps (Soitec, Poma, Petzl and their supply chains) plus large groups (STMicroelectronics, Schneider Electric, Atos) on their operational AI initiatives — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "nano, hydrogène & sports nature",

  topSectorsNaf: [
    "Micro-nanoélectronique & semi-conducteurs",
    "R&D & Ingénierie (CEA-Leti, ESRF, ILL, Inria)",
    "Logiciel & IT (Inovallée, Naver Labs Europe)",
    "Gestion de l'énergie & Cleantech (Schneider, Tenerrdis)",
    "Industrie alpine (Poma, Petzl, téléphériques, outdoor)",
    "Enseignement supérieur & Formation (UGA, Grenoble INP, GEM)",
  ],

  distancesFr:
    "Gare de Grenoble en centre-ville (TGV direct Paris ~3h, Marseille, Lille). Lyon-Saint-Exupéry (LYS) à environ 100 km avec navette directe, aéroport Grenoble-Isère (GNB) à 40 km pour liaisons régionales. 5 lignes de tramway TAG desservant Meylan, Inovallée, Presqu'île scientifique et tous les campus.",
  distancesEn:
    "Grenoble city-centre station (direct TGV to Paris ~3h, Marseille, Lille). Lyon-Saint-Exupéry (LYS) ~100 km with direct shuttle, Grenoble-Isère airport (GNB) 40 km for regional connections. 5 TAG tram lines serving Meylan, Inovallée, the Science Peninsula and all campuses.",

  ecosystemFr:
    "Grenoble est la capitale française des nanotechnologies et 'Silicon Valley européenne' : la Presqu'île scientifique (GIANT) regroupe CEA-Leti, ESRF, ILL, EMBL, CNRS et UGA sur quelques hectares. Minalogic (micro-nanoélectronique) et Tenerrdis (cleantech) ancrent deux filières d'excellence. La French Tech in the Alps (~450 membres) fédère start-ups, PME et grandes entreprises autour d'un tissu deep-tech unique en province.",
  ecosystemEn:
    "Grenoble is France's nanotechnology capital and 'European Silicon Valley': the GIANT Science Peninsula brings together CEA-Leti, ESRF, ILL, EMBL, CNRS and UGA on a few hectares. Minalogic (micro-nanoelectronics) and Tenerrdis (cleantech) anchor two world-class sectors. French Tech in the Alps (~450 members) federates start-ups, SMEs and large groups around a unique deep-tech fabric outside Paris.",

  // === SERVICES LONG-FORM GRENOBLE ===
  // Aucun prix en dur (vient de pricing.ts via le rendu page),
  // aucun délai chiffré, aucune mention "frais inclus", aucune demi-journée.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Grenoble cartographie précisément ce qui peut être automatisé dans vos processus — qu'il s'agisse de R&D documentaire chez une spin-off CEA-Leti, de planification de production chez un équipementier industriel ou de qualification de leads chez un éditeur logiciel d'Inovallée — et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI s'adaptent à toutes les tailles, des TPE deeptech aux directions IA des grands groupes grenoblois.",
        whyHere: [
          "Grenoble est le premier pôle deeptech de province en France : nos audits y adressent des cas d'usage uniques à forte densité R&D (automatisation de la veille brevets, traitement de rapports d'analyse, génération de documentation technique).",
          "Tissu industriel sur-représenté chez nos clients grenoblois : sous-traitants semi-conducteurs (bassin Crolles), fournisseurs Schneider Electric, startups Minalogic, PME électronique et mécatronique.",
          "Nos consultants interviennent sur la Presqu'île scientifique, à Inovallée (Meylan/Montbonnot), dans les zones industrielles d'Échirolles et à l'Université Grenoble Alpes.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux, lecture du livrable avec votre comité de direction ou votre responsable R&D, plan d'attaque remis en main propre.",
          "Tarifs publics affichés — aucun devis opaque : vous savez exactement ce que vous payez avant de signer, quelle que soit votre taille.",
          "Votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit : aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour signer le Confidentialité assurée, accéder aux documents clés (organigramme, processus, indicateurs) et délimiter le périmètre — R&D, production, fonctions support ou mix.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux grenoblois pour observer les outils du quotidien, identifier les workflows candidats à l'IA et rencontrer les équipes opérationnelles.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens courts avec les profils clés (ingénieurs R&D, chefs de projet, fonctions support, direction) pour cartographier finement frictions, volumes et attentes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place à Grenoble : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs techniques, vos rapports d'analyse, vos emails, vos données de production. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois avec priorisation par valeur et faisabilité.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Audit sur place",
            detail:
              "Adapté aux spin-offs, start-ups Minalogic et indépendants du bassin grenoblois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles, les éditeurs logiciels d'Inovallée, les cabinets d'ingénierie de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI deeptech (Soitec, Poma, Petzl et leurs écosystèmes fournisseurs) souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+ collab)",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les directions IA des grands groupes grenoblois (STMicroelectronics, Schneider Electric, Atos) souhaitant structurer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit a cerné en quelques jours des automatisations que nos ingénieurs n'avaient pas identifiées en interne. Le livrable est chiffré, actionnable et sans jargon. On est passé directement à l'implémentation.",
            role: "Directeur R&D",
            companyProfile: "PME électronique embarquée, bassin Meylan-Inovallée",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données de production plutôt que des slides théoriques. La restitution a permis de prioriser nos chantiers IA pour notre comité de direction — de façon très concrète.",
            role: "Directrice des opérations",
            companyProfile: "ETI équipementier industriel, agglomération grenobloise",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Grenoble ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place tient sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage initial.",
          },
          {
            q: "Travaillez-vous avec les spin-offs et start-ups deeptech grenobloises ?",
            a: "Oui. Nous accompagnons régulièrement les spin-offs issues du CEA-Leti, du CNRS et de l'UGA, les start-ups de la French Tech in the Alps et les jeunes pousses Minalogic. L'Audit sur place est calibré pour ces structures à fort potentiel.",
          },
          {
            q: "Mes données techniques restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, zéro extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté des données industrielles est requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Grenoble dans vos locaux. Atelier de quelques heures avec votre comité de direction ou votre responsable R&D. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Quelle différence avec les cabinets de conseil traditionnels ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée plutôt que de longues missions. Surtout : aucun lock-in — vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Beaucoup de nos audits grenoblois sont commandés par des dirigeants ou directeurs techniques qui n'ont jamais lancé de chantier IA. C'est précisément l'objet de l'audit : vous permettre de ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, mais jamais activée à ce jour sur nos missions grenobloises).",
      },
      en: {
        hero: "Axion-IA's AI audit in Grenoble precisely maps what can be automated in your processes — whether documentary R&D at a CEA-Leti spin-off, production planning at an industrial equipment manufacturer or lead qualification at an Inovallée software editor — and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from deep-tech micro-businesses to large industrial group AI leadership.",
        whyHere: [
          "Grenoble is France's leading provincial deep-tech hub: our audits address unique high-R&D-density use cases (patent intelligence automation, analysis report processing, technical documentation generation).",
          "Industrial fabric over-represented in our Grenoble cases: semiconductor sub-contractors (Crolles basin), Schneider Electric suppliers, Minalogic start-ups, electronics and mechatronics SMEs.",
          "Our consultants work on the Science Peninsula, at Inovallée (Meylan/Montbonnot), in the Échirolles industrial zones and at Université Grenoble Alpes.",
          "Read-outs always in person: ideation workshops at your offices, deliverable walk-through with your executive committee or R&D lead, action plan handed over face to face.",
          "Public pricing displayed — no opaque quotes: you know exactly what you pay before signing, whatever your size.",
          "Your action plan is executable with any vendor or in-house after our audit: no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to sign the Confidentiality ensured, access key documents (org chart, processes, KPIs) and scope the perimeter — R&D, production, support functions or a mix.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Grenoble offices to observe daily tools, identify AI candidate workflows and meet operational teams.",
          },
          {
            step: "Employee interviews",
            detail:
              "Short interviews with key profiles (R&D engineers, project managers, support functions, leadership) to map frictions, volumes and expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site in Grenoble: demos of Claude, Mistral, GPT-4 applied to your technical PDFs, analysis reports, emails, production data. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap prioritised by value and feasibility.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Sur place audit",
            detail:
              "Suited to spin-offs, Minalogic start-ups and independents in the Grenoble basin up to about ten staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial SMEs, Inovallée software editors, engineering firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap Strategic audit",
            detail:
              "For deep-tech mid-caps (Soitec, Poma, Petzl and their supplier ecosystems) framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise (5,000+ staff)",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For AI leadership at Grenoble large groups (STMicroelectronics, Schneider Electric, Atos) structuring centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "The audit pinpointed automations our engineers had not identified internally within days. The deliverable is costed, actionable and jargon-free. We moved straight to implementation.",
            role: "R&D Director",
            companyProfile: "Embedded electronics SME, Meylan-Inovallée basin",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data rather than theoretical slides. The read-out helped prioritise our AI initiatives for the executive committee — very concretely.",
            role: "Head of Operations",
            companyProfile: "Mid-cap industrial equipment manufacturer, Grenoble area",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Grenoble?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "Do you work with Grenoble deep-tech spin-offs and start-ups?",
            a: "Yes. We regularly support spin-offs from CEA-Leti, CNRS and UGA, French Tech in the Alps start-ups and Minalogic ventures. The Sur place audit is calibrated for these high-potential structures.",
          },
          {
            q: "Does my technical data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if industrial data sovereignty is required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person at your Grenoble offices. Workshop of a few hours with your executive committee or R&D lead. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with traditional consulting firms?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method rather than long missions. Above all: no lock-in — you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. Many of our Grenoble audits are ordered by technical directors or executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Grenoble missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Grenoble se déclinent en formats sur site d'une à plusieurs journées, adaptés aux profils spécifiques du bassin grenoblois : ingénieurs R&D, équipes de production industrielle, cadres deep-tech et directions de PME. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés et configurés pour leur travail réel. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Grenoble présente un profil de participants unique en province : ingénieurs issus de l'Ensimag, de Phelma ou de Grenoble INP, chercheurs CEA-Leti et Inria, équipes produit de start-ups Minalogic. Nos sessions sont calibrées pour ce niveau technique élevé.",
          "Couverture complète du bassin : Presqu'île scientifique, Inovallée à Meylan, campus UGA Saint-Martin-d'Hères, zones industrielles d'Échirolles et de Fontaine, Sassenage, Crolles.",
          "Le format collectif (1 journée) est adapté aux structures de quelques personnes à une centaine de collaborateurs — PME deeptech, spin-offs, filiales de grands groupes.",
          "Le format Conférence est adapté aux plénières d'entreprise dans les amphithéâtres du campus GIANT, les salles Minatec ou les espaces Alpexpo.",
          "Le format Dirigeants permet un cadrage IA en huis-clos pour les comités de direction des ETI et grands groupes grenoblois.",
          "Vocabulaire systématiquement ajusté à votre secteur : semi-conducteurs, gestion de l'énergie, logiciel industriel, R&D matériaux, outdoor tech. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants (ingénieurs, cadres, fonctions support), votre secteur, les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (spécifications techniques, rapports d'analyse, emails, données de production) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux grenoblois pour vérifier matériel, projection, accès Wi-Fi. Zéro aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers pratiques. Pour les profils techniques, focus sur l'intégration aux workflows existants.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel — utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Formation collective",
            detail:
              "Idéal pour les spin-offs, start-ups Minalogic et cabinets d'ingénierie grenoblois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (R&D, production, commercial, support).",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière dans un amphithéâtre pour grande audience, ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+ collab)",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands groupes grenoblois : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement calibrée pour nos ingénieurs : les démos sur nos propres specs techniques ont fait mouche. Le lendemain, plusieurs collègues utilisaient déjà Claude dans leur flux de travail quotidien.",
            role: "Responsable ingénierie",
            companyProfile: "PME spécialisée en systèmes embarqués, Inovallée Meylan",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en quelques heures sur la trajectoire IA à adopter dans notre contexte industriel. Pragmatique, sans jargon, orienté action.",
            role: "PDG",
            companyProfile: "ETI équipementier deep-tech, bassin grenoblois",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Grenoble ?",
            a: "Cela dépend du format choisi. Le format collectif (1 journée) se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Vos sessions sont-elles adaptées à des profils très techniques ?",
            a: "Oui. À Grenoble, une part importante de nos participants sont ingénieurs ou chercheurs. Nous adaptons le niveau de discours, les exemples et les démos à des profils Ensimag, Phelma, CEA-Leti ou Inria. Nous n'omettons pas la technique : nous l'utilisons comme levier d'adoption.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma ou Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur industriel ?",
            a: "Oui systématiquement. Le brief de cadrage permet d'ajuster vocabulaire, exemples, démos. Une session pour des ingénieurs semi-conducteurs est radicalement différente d'une session pour une équipe commerciale d'un éditeur logiciel.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur grenoblois, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Grenoble come in on-site formats from one to several days, tailored to the Grenoble basin's specific profiles: R&D engineers, industrial production teams, deep-tech managers and SME leadership. Your staff don't leave with slides: they leave with AI tools installed and configured for their real work. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Grenoble presents a unique provincial participant profile: engineers from Ensimag, Phelma or Grenoble INP, CEA-Leti and Inria researchers, Minalogic start-up product teams. Our sessions are calibrated for this high technical level.",
          "Full basin coverage: Science Peninsula, Inovallée in Meylan, UGA campus Saint-Martin-d'Hères, Échirolles and Fontaine industrial zones, Sassenage, Crolles.",
          "The one-day format suits structures from a few people to about a hundred staff — deep-tech SMEs, spin-offs, large-group subsidiaries.",
          "The Talk format suits company plenaries in GIANT campus amphitheatres, Minatec rooms or Alpexpo spaces.",
          "The Executives format enables in-camera AI framing for mid-cap and large-group executive committees.",
          "Vocabulary systematically adjusted to your sector: semiconductors, energy management, industrial software, materials R&D, outdoor tech. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile (engineers, managers, support functions), sector and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (technical specs, analysis reports, emails, production data) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Grenoble offices to check equipment, projection, Wi-Fi access. Zero technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by practical workshops. For technical profiles, focus on integration with existing workflows.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case — usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Group format",
            detail:
              "Ideal for Grenoble spin-offs, Minalogic start-ups and engineering practices up to about ten staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Group or Teams format",
            detail:
              "Group training for the whole group or Teams to focus on one department (R&D, production, sales, support).",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Talk or Executives format",
            detail:
              "Plenary in an amphitheatre for large audiences, or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise (5,000+ staff)",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Grenoble large groups: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group training perfectly calibrated for our engineers: demos on our own technical specs hit the mark. The next day, several colleagues were already using Claude in their daily workflow.",
            role: "Engineering Manager",
            companyProfile: "Embedded systems SME, Inovallée Meylan",
          },
          {
            quote:
              "The executive talk aligned us within hours on the AI trajectory for our industrial context. Pragmatic, jargon-free, action-oriented.",
            role: "CEO",
            companyProfile: "Deep-tech equipment mid-cap, Grenoble basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Grenoble take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Are your sessions suitable for very technical profiles?",
            a: "Yes. In Grenoble, a significant share of our participants are engineers or researchers. We adapt the discourse level, examples and demos to Ensimag, Phelma, CEA-Leti or Inria profiles. We don't skip the technical layer — we use it as an adoption lever.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma or Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our industrial sector?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples, demos. A session for semiconductor engineers is radically different from one for a software editor's sales team.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Grenoble sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Grenoble met vos cas d'usage en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec un kick-off obligatoire dans vos locaux grenoblois. Les cas typiques couvrent aussi bien l'automatisation documentaire R&D que l'intégration IA dans vos outils métier (PLM, ERP, outils de tests, CRM).",
        whyHere: [
          "Grenoble concentre une densité rare d'implémentations IA industrielles : automatisation de la veille brevets, traitement de rapports ESRF/ILL, intégration IA dans les outils PLM des équipementiers, génération de documentation technique dans les PDFs.",
          "Le kick-off se tient systématiquement en présentiel dans vos locaux grenoblois : alignement des équipes techniques et métier, accès aux données, validation des intégrations avec votre DSI.",
          "Itérations à distance avec un point quotidien court en visio et une visite périodique sur site pour démos d'avancement avec votre comité de direction ou votre équipe R&D.",
          "Recette finale toujours en présentiel à Grenoble : passation de pouvoir, formation des ambassadeurs IA internes sur leur poste, runbook remis en main propre.",
          "Formation incluse pour vos collaborateurs clés : ils deviennent les référents IA internes, autonomes après la fin de mission.",
          "Cas typiques grenoblois : spin-offs CEA-Leti (automatisation rapports d'analyse), PME électronique (lecture de plans et specs), ETI énergie (agents support client, documentation réglementaire), éditeurs logiciels Inovallée (génération de code, tests automatisés).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Grenoble : revue de l'architecture cible (PLM, ERP, outils R&D, cloud ou on-premise), validation des contraintes RGPD/sécurité industrielle, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Grenoble : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Grenoble : tests d'acceptation utilisateurs, formation des ambassadeurs IA internes, livraison du runbook documentation, plan de monitoring de quelques semaines.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (traitement de rapports, qualification de leads, génération de documentation) pour spin-offs et start-ups grenobloises.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration PLM/ERP/outils R&D. Pour les PME deeptech et éditeurs logiciels de l'Inovallée.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, datalake industriel), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+ collab)",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les grands groupes grenoblois : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation traitement de rapports d'analyse livrée dans les temps et dans le budget. ROI mesuré : plusieurs jours-ingénieur libérés chaque mois sur des tâches de compilation. Nos chercheurs ont gardé la main, aucune boîte noire.",
            role: "Directeur scientifique",
            companyProfile: "Spin-off deeptech issue de la Presqu'île scientifique grenobloise",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre organisation distribuée : kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs IA internes ont pris le relais de façon pleinement autonome.",
            role: "DSI",
            companyProfile: "ETI éditeur logiciel industriel, bassin grenoblois",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Grenoble ?",
            a: "Cela dépend de l'ampleur. Un POC pour une start-up peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions grenobloises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs IA internes, formés pendant la mission. Documentation runbook complète remise. Si une maintenance externalisée est souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande. Sensibilité données industrielles traitée avec la même rigueur que dans les laboratoires CEA.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (specs critiques, données de test, contrats), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste. Pour les contextes R&D à haute exigence, nous dimensionnons les garde-fous en conséquence.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs IA internes formés sont pleinement autonomes après le go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Grenoble brings your use cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode, with a mandatory kick-off at your Grenoble offices. Typical cases range from R&D documentary automation to AI integration in your business tools (PLM, ERP, test toolchains, CRM).",
        whyHere: [
          "Grenoble concentrates a rare density of industrial AI implementations: patent intelligence automation, ESRF/ILL report processing, AI integration in equipment manufacturer PLM tools, technical documentation generation from PDFs.",
          "Kick-off always happens in person at your Grenoble offices: technical and business team alignment, data access, integration validation with your IT team.",
          "Remote iterations with a short daily video call and periodic on-site visits for progress demos with your executive committee or R&D team.",
          "Final acceptance always in person in Grenoble: handover, training of internal AI ambassadors on their workstations, runbook delivered in hand.",
          "Training included for your identified key staff: they become internal AI leads, autonomous after mission end.",
          "Typical Grenoble cases: CEA-Leti spin-offs (analysis report automation), electronics SMEs (plans and specs reading), energy mid-caps (customer support agents, regulatory documentation), Inovallée software editors (code generation, automated testing).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Grenoble workshop: target architecture review (PLM, ERP, R&D tools, cloud or on-premise), GDPR/industrial security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Grenoble: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Grenoble: user acceptance tests, training of internal AI ambassadors, runbook documentation delivery, multi-week monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (report processing, lead qualification, documentation generation) for Grenoble spin-offs and start-ups.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, PLM/ERP/R&D tool integration. For deep-tech SMEs and Inovallée software editors.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, industrial datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise (5,000+ staff)",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Grenoble large groups: cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Analysis report processing implementation delivered on time and on budget. Measured ROI: several engineer-days freed each month from compilation tasks. Our researchers stayed in control, no black box.",
            role: "Scientific Director",
            companyProfile: "Deep-tech spin-off from the Grenoble Science Peninsula",
          },
          {
            quote:
              "Perfect hybrid method for our distributed organisation: intense on-site kick-off, then smooth remote iterations. Our internal AI ambassadors took over in a fully autonomous way.",
            role: "CIO",
            companyProfile: "Industrial software editor mid-cap, Grenoble basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Grenoble take?",
            a: "It depends on scope. A start-up POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Grenoble missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal AI ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request. Industrial data sensitivity handled with the same rigour as in CEA laboratories.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical specs, test data, contracts), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error. For high-requirement R&D contexts, we dimension guardrails accordingly.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal AI ambassadors are fully autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA individuel Axion-IA à Grenoble s'adresse à l'ingénieur, chercheur, directeur R&D ou fondateur de spin-off qui veut progresser sur l'IA à son rythme, sur ses propres données techniques — sans session collective. À partir de {{price:intervention-dirigeants|flat}}, un consultant senior est entièrement dédié à vous dans vos locaux de la Presqu'île scientifique, d'Inovallée, de Meylan ou du bassin grenoblois. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Grenoble héberge une forte densité d'ingénieurs et chercheurs (CEA-Leti, Ensimag, Phelma, Inria) dont le niveau technique est trop élevé pour une session collective standardisée — le coaching individuel est calibré sur leur expertise.",
          "Les spin-offs de la Presqu'île scientifique et de Minalogic traitent souvent des données industrielles propriétaires (spécifications semi-conducteurs, brevets, rapports ESRF) trop sensibles pour un cadre collectif.",
          "Les directeurs R&D et DSI d'ETI deeptech (Soitec, Poma, Petzl) bénéficient d'un accompagnement individuel centré sur leurs contraintes PLM/ERP et leur gouvernance IA en construction.",
          "Aucun minimum de participants, aucune date imposée : le créneau s'adapte à votre emploi du temps chargé de chercheur ou d'entrepreneur deeptech grenoblois.",
          "La French Tech in the Alps (~450 membres) compte de nombreux fondateurs en phase seed ou série A dont les besoins IA sont très spécifiques et ne correspondent pas à un programme de groupe.",
          "À la fin de la session, vous avez des outils IA intégrés à vos workflows R&D réels — pas des démos déconnectées de votre contexte technique.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Entretien de cadrage dédié (30-45 min) pour cerner votre profil technique, votre secteur (semi-conducteurs, énergie, logiciel, matériaux, outdoor), vos priorités et contraintes de confidentialité.",
          },
          {
            step: "Préparation sur-mesure",
            detail:
              "Le consultant prépare un programme individuel : outils sélectionnés pour votre cas technique, démos construites sur vos données représentatives (rapports d'analyse, spécifications, code, emails).",
          },
          {
            step: "Session intensive sur site",
            detail:
              "Journée dans vos locaux grenoblois (Presqu'île, Inovallée, Meylan, Échirolles, Crolles) : théorie ciblée, démos live sur vos données réelles, manipulation directe. Rythme ajusté à votre niveau technique.",
          },
          {
            step: "Cas pratiques sur vos documents et données réels",
            detail:
              "Vous travaillez sur vos propres fichiers : rapports d'analyse, PDFs techniques, code existant, données de production. Aucun exercice déconnecté de votre réalité R&D grenoble.",
          },
          {
            step: "Plan d'action personnel",
            detail:
              "En fin de session, remise d'un plan d'action individuel : outils à déployer dans vos workflows R&D, cas d'usage prioritaires, ressources pour continuer en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Coaching individuel entrée pour spin-offs, start-ups Minalogic et indépendants du bassin grenoblois — une journée, un consultant dédié.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme individuel sur-mesure pour ingénieur senior, responsable R&D ou directeur de PME deeptech ou d'éditeur logiciel d'Inovallée.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Coaching individuel pour directeurs R&D, DSI ou membres du comité de direction d'ETI deeptech grenobloises (Soitec, Poma, Petzl et leurs fournisseurs).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour cadres dirigeants et experts de grands groupes grenoblois (STMicroelectronics, Schneider Electric, Atos) cherchant une montée en compétences IA confidentielle.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin d'explorer l'IA appliquée à l'analyse de rapports ESRF et à la gestion documentaire de ma spin-off. En une journée avec un consultant dédié, on a travaillé sur mes vraies données. J'ai un plan clair et des outils en production dès le lendemain.",
            role: "Directeur scientifique",
            companyProfile: "Spin-off deeptech, Presqu'île scientifique de Grenoble",
          },
          {
            quote:
              "Format coaching individuel parfait pour un directeur R&D : niveau technique sans concession, démos sur nos spécifications semi-conducteurs. J'ai pu explorer des cas sensibles sans exposer nos brevets. Plan d'action remis en main propre.",
            role: "Directeur R&D",
            companyProfile: "PME électronique embarquée, bassin Meylan-Inovallée",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce que le coaching IA individuel Axion-IA à Grenoble ?",
            a: "C'est une session IA sur-mesure dédiée à une seule personne dans vos locaux grenoblois. Un consultant senior vous accompagne sur vos propres cas techniques ou business — spin-off, PME deeptech, ETI industrielle — pendant une journée entière. À partir de {{price:intervention-dirigeants|flat}}.",
          },
          {
            q: "Pourquoi un format individuel pour un ingénieur ou chercheur grenoblois ?",
            a: "Le niveau technique à Grenoble (Ensimag, CEA-Leti, Phelma, Inria) est trop élevé pour une session collective standardisée. Le coaching individuel s'adapte à votre expertise : modèles avancés, intégration PLM/ERP, fine-tuning, sécurité des données industrielles.",
          },
          {
            q: "La session est-elle confidentielle ?",
            a: "Totalement. Vos données techniques, brevets ou résultats de recherche ne quittent pas vos locaux. Confidentialité stricte dès le cadrage. Sensibilité données traitée avec la même rigueur que dans les laboratoires CEA.",
          },
          {
            q: "Faut-il déjà utiliser des outils IA pour bénéficier du coaching ?",
            a: "Non. Le coaching s'adapte à votre niveau — du débutant au praticien avancé souhaitant aller plus loin. Le brief de cadrage initial permet d'ajuster le programme avant la session.",
          },
          {
            q: "Les frais de déplacement sont-ils inclus ?",
            a: "Non. Frais de logement, repas et forfait trajet sont facturés en sus, selon la doctrine tarifaire Axion-IA. Ces frais sont communiqués sur devis préalable à la confirmation.",
          },
          {
            q: "Peut-on organiser plusieurs coachings individuels pour une équipe R&D ?",
            a: "Oui. Certaines ETI et spin-offs grenobloises organisent plusieurs sessions individuelles pour leurs ingénieurs ou chercheurs clés plutôt qu'une session collective. Tarif dégressif selon le volume — à préciser en cadrage.",
          },
        ],
        guarantees:
          "Confidentialité stricte : vos données techniques et enjeux stratégiques ne quittent pas vos locaux grenoblois. Aucun lock-in : les outils installés sont vos comptes personnels, aucune dépendance Axion-IA après la session. Frais de logement, repas et forfait trajet facturés en sus sur devis préalable. Si la session ne vous apporte pas de valeur actionnable immédiate, remboursement intégral (clause disponible, jamais activée à ce jour sur nos missions grenobloises).",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Grenoble is for the engineer, researcher, R&D director or spin-off founder who wants to progress on AI at their own pace, on their own technical data — without a group session. From {{price:intervention-dirigeants|compact}} excl. VAT, a senior consultant is entirely dedicated to you at your Science Peninsula, Inovallée, Meylan or Grenoble basin premises. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Grenoble hosts a high density of engineers and researchers (CEA-Leti, Ensimag, Phelma, Inria) whose technical level is too high for a standardised group session — individual coaching is calibrated to their expertise.",
          "Science Peninsula and Minalogic spin-offs often handle proprietary industrial data (semiconductor specifications, patents, ESRF reports) too sensitive for a group setting.",
          "R&D directors and CIOs at deep-tech mid-caps (Soitec, Poma, Petzl) benefit from individual coaching focused on their PLM/ERP constraints and their AI governance in progress.",
          "No minimum participants, no imposed date: the slot adapts to your busy researcher or Grenoble deep-tech entrepreneur schedule.",
          "French Tech in the Alps (~450 members) includes many seed or Series A founders whose AI needs are highly specific and don't fit a group programme.",
          "At session end, you have AI tools integrated into your real R&D workflows — not demos disconnected from your technical context.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "Dedicated framing interview (30-45 min) to understand your technical profile, sector (semiconductors, energy, software, materials, outdoor), priorities and confidentiality constraints.",
          },
          {
            step: "Bespoke preparation",
            detail:
              "The consultant prepares an individual programme: tools selected for your technical case, demos built on your representative data (analysis reports, specifications, code, emails).",
          },
          {
            step: "Intensive on-site session",
            detail:
              "Full day at your Grenoble premises (Science Peninsula, Inovallée, Meylan, Échirolles, Crolles): targeted theory, live demos on your real data, direct tool use. Pace adjusted to your technical level.",
          },
          {
            step: "Practical exercises on your real documents and data",
            detail:
              "You work on your own files: analysis reports, technical PDFs, existing code, production data. No exercises disconnected from your Grenoble R&D reality.",
          },
          {
            step: "Personal action plan",
            detail:
              "At session end, handover of an individual action plan: tools to deploy in your R&D workflows, priority use cases, resources to keep progressing autonomously.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From {{price:intervention-dirigeants|compact}} excl. VAT",
            detail:
              "Entry individual coaching for Grenoble basin spin-offs, Minalogic start-ups and independents — one day, one dedicated consultant.",
          },
          {
            sizeLabel: "SME",
            price: "On request",
            detail:
              "Bespoke individual programme for senior engineers, R&D managers or directors of deep-tech SMEs or Inovallée software editors.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On request",
            detail:
              "Individual coaching for R&D directors, CIOs or executive committee members of Grenoble deep-tech mid-caps (Soitec, Poma, Petzl and their suppliers).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On request",
            detail:
              "Individual coaching for senior managers and experts at Grenoble large groups (STMicroelectronics, Schneider Electric, Atos) seeking confidential AI skills development.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed to explore AI applied to ESRF report analysis and documentary management for my spin-off. In one day with a dedicated consultant, we worked on my real data. I have a clear plan and tools in production from the next day.",
            role: "Scientific Director",
            companyProfile: "Deep-tech spin-off, Grenoble Science Peninsula",
          },
          {
            quote:
              "Perfect individual coaching format for an R&D director: uncompromising technical level, demos on our semiconductor specifications. I could explore sensitive cases without exposing our patents. Action plan handed over face to face.",
            role: "R&D Director",
            companyProfile: "Embedded electronics SME, Meylan-Inovallée basin",
          },
        ],
        faq: [
          {
            q: "What is Axion-IA's individual AI coaching in Grenoble?",
            a: "It is a bespoke AI session dedicated to one person at your Grenoble premises. A senior consultant accompanies you on your own technical or business cases — spin-off, deep-tech SME, industrial mid-cap — for a full day. From {{price:intervention-dirigeants|compact}} excl. VAT.",
          },
          {
            q: "Why an individual format for a Grenoble engineer or researcher?",
            a: "The technical level in Grenoble (Ensimag, CEA-Leti, Phelma, Inria) is too high for a standardised group session. Individual coaching adapts to your expertise: advanced models, PLM/ERP integration, fine-tuning, industrial data security.",
          },
          {
            q: "Is the session confidential?",
            a: "Completely. Your technical data, patents or research results do not leave your premises. Strict confidentiality from framing. Data sensitivity handled with the same rigour as in CEA laboratories.",
          },
          {
            q: "Do I need to already use AI tools to benefit from coaching?",
            a: "No. Coaching adapts to your level — from beginner to advanced practitioner wishing to go further. The initial framing brief allows adjusting the programme before the session.",
          },
          {
            q: "Are travel costs included?",
            a: "No. Lodging, meals and travel allowance are billed separately, per Axion-IA's pricing doctrine. These costs are communicated on a prior quote before confirmation.",
          },
          {
            q: "Can we organise several individual coachings for an R&D team?",
            a: "Yes. Some Grenoble mid-caps and spin-offs organise several individual sessions for their key engineers or researchers rather than a group session. Volume discount possible — to be specified at framing.",
          },
        ],
        guarantees:
          "Strict confidentiality: your technical data and strategic challenges do not leave your Grenoble premises. No lock-in: installed tools are your personal accounts, no Axion-IA dependency after the session. Lodging, meals and travel allowance billed separately on prior quote. If the session does not bring you immediate actionable value, full refund (clause available, never triggered to date on our Grenoble missions).",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Grenoble des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Grenoble, itérations à distance.",
        whyHere: [
          "Projets web & SaaS grenoblois : micro-nanoélectronique & deeptech (CEA-Leti, STMicroelectronics, Soitec, Minatec), cleantech (Tenerrdis), recherche IA (Naver Labs), scale-ups French Tech in the Alps.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Deeptech & hardware : portails techniques, RAG sur documentation, plateformes data — on parle le langage de la Presqu'île scientifique (GIANT), hébergement UE souverain, confidentialité.",
        ],
        methodology: [
          {
            step: "Cadrage à Grenoble",
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
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour spin-offs deeptech, scale-ups et PME grenobloises.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, deeptech ou portail technique sur mesure, IA intégrée, branchée sur votre SI (PLM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Grenoble — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous travaillez avec l'écosystème deeptech/hardware grenoblois ?",
            a: "Oui : portails techniques, RAG sur documentation, plateformes data et agents pour spin-offs et PME issues du CEA-Leti, Minatec et de la French Tech in the Alps. On parle le langage de la Presqu'île scientifique. Hébergement UE souverain, confidentialité contractuelle.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région grenobloise ou repris en interne.",
      },
      en: {
        hero: "In Grenoble, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Grenoble kick-off, remote iterations.",
        whyHere: [
          "Grenoble web & SaaS projects: micro-nanoelectronics & deeptech (CEA-Leti, STMicroelectronics, Soitec, Minatec), cleantech (Tenerrdis), AI research (Naver Labs), French Tech in the Alps scale-ups.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Deeptech & hardware: technical portals, RAG on documentation, data platforms — we speak the language of the scientific peninsula (GIANT), sovereign EU hosting, confidentiality.",
        ],
        methodology: [
          {
            step: "Scoping in Grenoble",
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
            price: "Bespoke site / app",
            detail:
              "Design or rebuild of a site or app with UX/UI and built-in AI, for deeptech spin-offs, scale-ups and Grenoble SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, deeptech or technical portal platform, AI built in, wired into your IS (PLM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Grenoble — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you work with the Grenoble deeptech/hardware ecosystem?",
            a: "Yes: technical portals, RAG on documentation, data platforms and agents for spin-offs and SMEs from CEA-Leti, Minatec and French Tech in the Alps. We speak the language of the scientific peninsula. Sovereign EU hosting, contractual confidentiality.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Grenoble-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA à Grenoble avec Axion-IA ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Les tarifs sont publics et affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Grenoble et partout en France.",
    },
    {
      q: "Axion-IA travaille-t-il avec les entreprises de Minalogic et de la French Tech in the Alps ?",
      a: "Oui. Nous accompagnons régulièrement des membres de Minalogic, des start-ups de la French Tech in the Alps (~450 membres) et des spin-offs du campus GIANT (CEA-Leti, CNRS, Inria). Notre Audit sur place et nos formats collectifs (1 journée) sont calibrés pour les structures deeptech à fort potentiel.",
    },
    {
      q: "Pouvez-vous intervenir dans les entreprises de la Presqu'île scientifique ou d'Inovallée ?",
      a: "Oui. Nos consultants se déplacent sur la Presqu'île scientifique (Minatec, GIANT), à Inovallée (Meylan/Montbonnot), dans les zones industrielles d'Échirolles, ainsi qu'à Crolles et dans tout le bassin grenoblois. Toutes nos restitutions clés se tiennent en présentiel dans vos locaux.",
    },
    {
      q: "Avez-vous des références dans le secteur de la micro-électronique ou de l'énergie à Grenoble ?",
      a: "Nous avons mené des missions dans les secteurs R&D embarquée, systèmes électroniques industriels et logiciels métier sur le bassin grenoblois. Nos cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par secteur et ville d'intervention.",
    },
    {
      q: "Quelle est la différence entre Axion-IA et les cabinets conseil traditionnels pour une PME grenobloise ?",
      a: "Nos consultants sont d'anciens praticiens IA, pas des consultants généralistes. Tarifs publics affichés, aucun devis opaque à six chiffres. Méthode condensée avec démos sur vos vraies données dès la première rencontre. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
    },
    {
      q: "Proposez-vous des interventions sur site à Grenoble ou uniquement à distance ?",
      a: "Nos interventions à Grenoble sont par défaut en présentiel dans vos locaux. Certaines étapes d'implémentation (itérations techniques, points de suivi) se font à distance pour optimiser les coûts — mais le kick-off, les restitutions et les formations sont toujours sur site.",
    },
  ],
};
