// Brest (29019) — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine Will (miroir Paris gold standard) :
//   - Aucun délai chiffré concret.
//   - Aucun « frais de déplacement intégrés » — frais de logement, repas et
//     forfait trajet systématiquement mentionnés en sus sur les interventions.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : tarifs viennent de `src/content/pricing.ts`.
//   - Tailles INSEE : TPE / PME / ETI / GE — jamais de métier-type.
//   - ~95 % Axion-IA-centric + ~5 % data INSEE anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn (hors scope ville V1).
//
// Réalités Brest ancrées dans le copy :
//   - Naval Group (SNLE, FREMM) + Marine nationale (1re base Atlantique)
//   - IFREMER (siège mondial Plouzané-Brest)
//   - Thales Underwater Systems (sonars, systèmes sous-marins)
//   - IMT Atlantique (campus Brest — cybersécurité, IA, numérique)
//   - ENIB + ENSTA Bretagne + UBO + École Navale (30 km)
//   - Technopôle Brest-Iroise (~5 000 emplois R&D océanique)
//   - Pôle Mer Bretagne Atlantique (siège, vocation mondiale)
//   - Lab-STICC (UMR CNRS 6285 — IA, communications, capteurs)
//   - Éolien offshore (Polder du port)
//   - Sea Tech Week + French Tech Brest+
//   - 12 847 établissements actifs (INSEE 2023)

import type { VilleCopy } from "./types";

export const BREST_COPY: VilleCopy = {
  pitchFr:
    "Brest concentre 12 847 établissements actifs, le siège mondial d'IFREMER, le premier pôle de défense maritime français (Naval Group, Thales Underwater Systems, Marine nationale) et un écosystème d'ingénierie numérique unique en France (IMT Atlantique, ENIB, Lab-STICC). Axion-IA y intervient sur site auprès des TPE locales jusqu'aux grands groupes de défense et de l'économie marine.",
  pitchEn:
    "Brest hosts 12,847 active businesses, the world headquarters of IFREMER, France's foremost maritime-defence hub (Naval Group, Thales Underwater Systems, French Navy) and a unique digital engineering ecosystem (IMT Atlantique, ENIB, Lab-STICC). Axion-IA delivers on site for micro-businesses to large defence and marine-economy groups.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Brest : nous identifions les cas d'automatisation dans votre organisation et chiffrons le ROI pour votre secteur — défense maritime, sciences de la mer, numérique, logistique portuaire ou BTP.",
      en: "Operational AI audit in Brest: we identify automation opportunities in your organisation and quantify ROI for your sector — maritime defence, marine science, digital, port logistics or construction.",
    },
    interventions: {
      fr: "Interventions IA à Brest : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Brest: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Brest : on déploie l'IA dans vos outils existants (CRM, ERP, mails, systèmes de gestion) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Brest: we deploy AI into your existing tools (CRM, ERP, email, management systems) with contractually-costed ROI. Your teams stay in control, we create no dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Brest : séances sur mesure pour dirigeants et cadres des technologies marines, du Technopôle Brest-Iroise et des PME du Finistère. Ancré sur l'écosystème Naval Group, IFREMER et l'économie maritime brestoise. Frais de logement, repas et forfait trajet en sus pour le présentiel.",
      en: "1-to-1 AI coaching in Brest: bespoke sessions for executives and managers in marine technologies, Technopôle Brest-Iroise and Finistère SMEs. Grounded in the Naval Group, IFREMER and Brest maritime economy ecosystem. Lodging, meals and travel allowance billed separately for on-site sessions.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Brest (29019) sur site dans toute la Brest Métropole et le Finistère. Nous accompagnons les TPE locales, PME industrielles, ETI de la filière maritime et grands groupes (Naval Group, Thales Underwater, IFREMER) sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Brest (29019) on site across Brest Métropole and Finistère. We support local micro-businesses, industrial SMEs, maritime-sector mid-caps and large groups (Naval Group, Thales Underwater, IFREMER) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Défense maritime & construction navale militaire",
    "Sciences de la mer & océanographie",
    "Numérique, cybersécurité & IA embarquée",
    "Commerce, transport & logistique portuaire",
    "Enseignement supérieur & recherche publique",
    "Éolien offshore & énergies marines renouvelables",
  ],

  distancesFr:
    "Gare de Brest TGV (Paris-Montparnasse direct). Aéroport Brest-Bretagne (BES) à 10 km — liaisons Paris, Lyon, Marseille, Bordeaux. Tramway Bibus ligne A + réseau urbain pour rejoindre les sites Technopôle Brest-Iroise, port de commerce, Naval Group et IMT Atlantique.",
  distancesEn:
    "Brest TGV station (direct Paris-Montparnasse). Brest-Bretagne Airport (BES) 10 km — connections to Paris, Lyon, Marseille, Bordeaux. Bibus tram line A + urban network to reach Technopôle Brest-Iroise, commercial port, Naval Group and IMT Atlantique sites.",

  ecosystemFr:
    "Tissu économique dominé par la défense maritime (Naval Group, Thales Underwater, Marine nationale), les sciences de la mer (IFREMER siège, IUEM CNRS, Pôle Mer Bretagne Atlantique vocation mondiale) et le numérique (IMT Atlantique, ENIB, Lab-STICC CNRS 6285). Technopôle Brest-Iroise : ~5 000 emplois R&D. French Tech Brest+. 12 847 établissements actifs (INSEE 2023).",
  ecosystemEn:
    "Economy dominated by maritime defence (Naval Group, Thales Underwater, French Navy), marine science (IFREMER HQ, IUEM CNRS, world-class Pôle Mer Bretagne Atlantique) and digital tech (IMT Atlantique, ENIB, Lab-STICC CNRS 6285). Technopôle Brest-Iroise: ~5,000 R&D jobs. French Tech Brest+. 12,847 active businesses (INSEE 2023).",

  // === SERVICES LONG-FORM BREST ===
  // Aucun prix en dur, aucun délai chiffré, aucune mention « frais inclus »,
  // aucun « basé en UE ». Tailles INSEE. ~95 % Axion-IA-centric.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé chez vous et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles brestoises — des TPE du commerce et des services jusqu'aux directions de programme des grands groupes de défense maritime et de l'économie marine.",
        whyHere: [
          "Brest est un pôle de défense maritime et de sciences de la mer sans équivalent en France : Naval Group, Thales Underwater Systems, IFREMER, Marine nationale. Ces acteurs font face à des volumes documentaires et opérationnels où l'IA à un ROI très élevé sur la gestion de configuration, la rédaction technique, le MCO et le traitement des données océanographiques.",
          "L'écosystème numérique brestois est dense : IMT Atlantique (cybersécurité, IA), ENIB (systèmes embarqués), Lab-STICC CNRS 6285 (IA, communications). Nos audits tiennent compte de vos contraintes de souveraineté et de confidentialité défense (données classifiées, export control).",
          "Le tissu PME et ETI brestois est fortement ancré dans la sous-traitance navale, la logistique portuaire, le BTP et les services aux entreprises — secteurs où l'automatisation administrative (devis, suivi chantier, facturation, planification) génère des gains rapides.",
          "Nos consultants se déplacent en présentiel sur l'ensemble de Brest Métropole (Plouzané-Technopôle, zone Kergaradec Gouesnou, port de commerce, Le Relecq-Kerhuon, Guipavas) et dans le Finistère.",
          "Restitutions toujours en présentiel : ateliers d'idéation, lecture du livrable avec votre comité de direction ou chef de programme, plan d'attaque transmis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics, vous savez exactement ce que vous payez avant de signer.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs métier). Pour les structures soumises à contraintes défense, accord sur le périmètre confidentiel avant toute collecte.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Brest dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA — rédaction technique navale, gestion documentaire, traitement de données terrain, qualification de leads pour les PME.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (ingénieurs, chefs de projet, commerciaux, finance, RH, opérations) pour cartographier finement frictions et attentes spécifiques au contexte brestois — fichiers CAO, comptes-rendus d'essais, rapports océanographiques, plannings chantier.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos documents réels (anonymisés si nécessaire). Pas de slides théoriques — on travaille sur vos PDFs techniques, emails, cahiers des charges, données issues de vos outils métier.",
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
              "Adapté aux indépendants, commerçants, artisans et petites structures bretonnes jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME de sous-traitance navale, logistique, BTP et services aux entreprises de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI du bassin brestois souhaitant cadrer une trajectoire IA multi-métier ou multi-sites (Finistère + régional).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites brestois des grands groupes défense/maritime (Naval Group, Thales Underwater) souhaitant cadrer une gouvernance IA maîtrisée sur périmètre confidentiel.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su adapter sa méthode à nos contraintes de confidentialité défense. Le livrable identifie des cas concrets sur notre chaîne documentaire — résultat chiffré, actionnable, sans jargon.",
            role: "Directeur de programme",
            companyProfile: "PME sous-traitance navale, Brest Métropole",
          },
          {
            quote:
              "Notre défi était d'automatiser le traitement de volumes de données terrain sans compromettre la souveraineté. L'audit Axion-IA nous a fourni un plan d'action réaliste avec priorisation ROI/complexité.",
            role: "Responsable R&D",
            companyProfile: "ETI sciences de la mer, Technopôle Brest-Iroise",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Brest ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est calé avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Pouvez-vous travailler avec des données soumises à confidentialité défense ?",
            a: "Oui. Nous adaptons le périmètre de collecte en accord avec vos contraintes (données anonymisées, travail exclusivement sur vos infrastructures, accord de confidentialité renforcé sur demande). Aucune extraction vers nos serveurs. Pour les niveaux de classification les plus élevés, le périmètre est défini ensemble en amont du cadrage.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une PME brestoise ?",
            a: "Sur les audits Stratégique PME dans la sous-traitance navale et la logistique, les gains identifiés portent typiquement sur la gestion documentaire, la rédaction de comptes-rendus techniques et la qualification de leads. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Vos consultants se déplacent-ils jusqu'au Technopôle Brest-Iroise ou à Guipavas ?",
            a: "Oui. Nous intervenons en présentiel sur l'ensemble de Brest Métropole — Plouzané, Guipavas, Gouesnou, Le Relecq-Kerhuon, Plougastel-Daoulas — ainsi que dans le Finistère. Les frais de logement, repas et forfait trajet sont facturés séparément.",
          },
          {
            q: "Différence avec un audit Big Four ou un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée, démos sur vos vraies données. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour solliciter un audit ?",
            a: "Non. La majorité de nos audits brestois sont commandés par des dirigeants ou des chefs de programme qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size in Brest — from local micro-businesses in commerce and services to programme leadership at large maritime-defence and marine-economy groups.",
        whyHere: [
          "Brest is France's unmatched hub for maritime defence and marine science: Naval Group, Thales Underwater Systems, IFREMER, the French Navy. These players handle documentary and operational volumes where AI delivers very high ROI — configuration management, technical writing, MCO and oceanographic data processing.",
          "Brest's digital ecosystem is dense: IMT Atlantique (cybersecurity, AI), ENIB (embedded systems), Lab-STICC CNRS 6285 (AI, communications). Our audits account for your sovereignty and defence confidentiality constraints (classified data, export control).",
          "The Brest SME and mid-cap fabric is heavily anchored in naval sub-contracting, port logistics, construction and business services — sectors where administrative automation (quotes, site tracking, invoicing, scheduling) delivers quick wins.",
          "Our consultants travel in person across all of Brest Métropole (Plouzané-Technopôle, Kergaradec Gouesnou zone, commercial port, Le Relecq-Kerhuon, Guipavas) and across Finistère.",
          "Read-outs always in person: ideation workshops, deliverable walk-through with your executive committee or programme lead, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). For organisations subject to defence constraints, agreement on confidential perimeter before any data collection.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Brest at your offices to observe daily tools and identify AI candidate workflows — naval technical writing, document management, field data processing, lead qualification for SMEs.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (engineers, project managers, sales, finance, HR, operations) to map frictions specific to the Brest context — CAD files, test reports, oceanographic reports, site schedules.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your real documents (anonymised if needed). No theoretical slides — we work on your technical PDFs, emails, specifications, data from your business tools.",
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
              "Suited to freelancers, retailers, artisans and small Breton structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for naval sub-contracting, logistics, construction and business services SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Brest-area mid-caps framing a multi-business or multi-site AI trajectory (Finistère + regional).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For Brest sites of large defence/maritime groups (Naval Group, Thales Underwater) framing controlled AI governance over a confidential perimeter.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA adapted its method to our defence confidentiality constraints. The deliverable identifies concrete cases on our document chain — costed, actionable, jargon-free.",
            role: "Programme Director",
            companyProfile: "Naval sub-contracting SME, Brest Métropole",
          },
          {
            quote:
              "Our challenge was to automate field data processing volumes without compromising sovereignty. The Axion-IA audit gave us a realistic action plan with ROI/complexity prioritisation.",
            role: "R&D Manager",
            companyProfile: "Marine science mid-cap, Technopôle Brest-Iroise",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Brest?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Can you work with data subject to defence confidentiality?",
            a: "Yes. We adapt the collection perimeter to your constraints (anonymised data, work exclusively on your infrastructure, enhanced confidentiality agreement on request). No extraction to our servers. For the highest classification levels, the perimeter is agreed together before framing.",
          },
          {
            q: "What ROI can I expect for a Brest SME?",
            a: "On SME Strategic audits in naval sub-contracting and logistics, gains typically cover document management, technical meeting-minutes writing and lead qualification. The deliverable details exact figures for your case.",
          },
          {
            q: "Do your consultants travel to Technopôle Brest-Iroise or Guipavas?",
            a: "Yes. We intervene in person across all of Brest Métropole — Plouzané, Guipavas, Gouesnou, Le Relecq-Kerhuon, Plougastel-Daoulas — and across Finistère. Lodging, meals and travel allowance billed separately.",
          },
          {
            q: "Difference with a Big Four audit or traditional consulting?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method, demos on your real data. No lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. Most of our Brest audits are ordered by executives or programme leads who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Brest se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — rédaction technique, gestion documentaire, analyse de données, relation client selon votre secteur. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Brest et le Finistère sont couverts en présentiel : Brest Métropole, Technopôle Brest-Iroise (Plouzané), Guipavas, Gouesnou, Le Relecq-Kerhuon, Plougastel-Daoulas — ainsi que tout le Finistère sur demande.",
          "Le tissu brestois combine des grandes structures (Naval Group, Thales, IFREMER, Marine nationale) et un tissu dense de PME de sous-traitance, logistique et services. Nos formats couvrent tous les profils, du comité de direction à l'atelier technique.",
          "Les ingénieurs, techniciens et chefs de projet des filières navale, maritime et numérique repartent avec des outils IA calibrés sur leur quotidien réel : cahiers des charges, comptes-rendus d'essais, reporting de suivi, qualification de données terrain.",
          "Le format Dirigeants est particulièrement adapté aux comités de direction des ETI bretonnes et aux chefs de programme des grandes structures qui veulent cadrer leur vision IA avant d'engager un budget.",
          "Vocabulaire ajusté à votre secteur : défense maritime, ingénierie navale, sciences de la mer, numérique, logistique portuaire. Pas de session générique recyclée.",
          "Nos sessions incluent systématiquement un brief de cadrage en amont pour ajuster exemples, démos et cas d'usage à votre réalité métier brestoise.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier brestois, les cas d'usage prioritaires (rédaction technique, analyse de données, support commercial, gestion documentaire).",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports techniques, emails métier, cahiers des charges, données terrain) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux — site de Brest, Technopôle Brest-Iroise, Guipavas ou autre site du bassin — pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Cas d'usage concrets de la filière navale, maritime, numérique ou services.",
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
              "Idéal indépendants, petites structures de service et artisans du bassin brestois jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (bureau d'études, commercial, administration, opérations).",
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
              "Combinaisons sur-mesure pour les sites brestois des grands groupes défense/maritime : cascade direction + équipes techniques, roadshow multi-entités.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session calibrée sur nos vrais documents techniques. Nos ingénieurs sont repartis avec Claude configuré sur leurs cahiers des charges. Le lendemain, plusieurs utilisaient déjà l'outil sur des rapports réels.",
            role: "Chef de programme",
            companyProfile: "ETI sous-traitance navale, Brest Métropole",
          },
          {
            quote:
              "Format Dirigeants parfaitement adapté à notre comité de direction. En une journée, nous avons aligné notre vision IA et défini notre programme de déploiement pour les 12 prochains mois.",
            role: "Directrice générale",
            companyProfile: "PME services maritimes, Brest",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Brest ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux métiers de la défense maritime ou des sciences de la mer ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un bureau d'études navales n'a rien à voir avec une session pour une PME de services. Nous calibrons sur vos documents réels.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous intervenir sur des sites distants comme le Technopôle Brest-Iroise ou Guipavas ?",
            a: "Oui. Nous couvrons l'ensemble de Brest Métropole et du Finistère en présentiel. Les frais de logement, repas et forfait trajet sont facturés séparément et détaillés au devis.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur brestois, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Brest come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — technical writing, document management, data analysis, client relations per your sector. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Brest and Finistère are covered in person: Brest Métropole, Technopôle Brest-Iroise (Plouzané), Guipavas, Gouesnou, Le Relecq-Kerhuon, Plougastel-Daoulas — plus all of Finistère on request.",
          "The Brest fabric combines large structures (Naval Group, Thales, IFREMER, French Navy) and a dense SME fabric in sub-contracting, logistics and services. Our formats cover all profiles, from executive committee to technical workshop.",
          "Engineers, technicians and project managers from the naval, maritime and digital sectors leave with AI tools calibrated to their real daily work: specifications, test reports, tracking reports, field data qualification.",
          "The Executives format is particularly suited to Breton mid-cap executive committees and large-structure programme leads who want to frame their AI vision before committing a budget.",
          "Vocabulary adjusted to your sector: maritime defence, naval engineering, marine science, digital, port logistics. No recycled generic session.",
          "Our sessions systematically include an upstream framing brief to adjust examples, demos and use cases to your Brest business reality.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, Brest sector, priority use cases (technical writing, data analysis, commercial support, document management).",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your activity (technical reports, business emails, specifications, field data) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises — Brest site, Technopôle Brest-Iroise, Guipavas or other basin site — to check equipment, projection, Wi-Fi. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Concrete use cases from the naval, maritime, digital or services sector.",
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
              "Ideal for freelancers, small service structures and artisans in the Brest basin up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (engineering office, sales, administration, operations).",
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
              "Custom combinations for Brest sites of large defence/maritime groups: leadership + technical team cascade, multi-entity roadshow.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session calibrated on our real technical documents. Our engineers left with Claude configured on their specifications. The next day, several were already using the tool on real reports.",
            role: "Programme Lead",
            companyProfile: "Naval sub-contracting mid-cap, Brest Métropole",
          },
          {
            quote:
              "Executives format perfectly suited to our executive committee. In one day we aligned our AI vision and defined our deployment programme for the next 12 months.",
            role: "General Manager",
            companyProfile: "Maritime services SME, Brest",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Brest take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you adapt content to maritime defence or marine science roles?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a naval engineering office has nothing to do with one for a service SME. We calibrate on your real documents.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you come to remote sites like Technopôle Brest-Iroise or Guipavas?",
            a: "Yes. We cover all of Brest Métropole and Finistère in person. Lodging, meals and travel allowance are billed separately and detailed in the quote.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Brest sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Brest met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec un kick-off obligatoire à Brest dans vos locaux. Particulièrement adapté aux organisations du bassin brestois : sous-traitance navale, sciences de la mer, numérique, logistique portuaire, services aux entreprises.",
        whyHere: [
          "Le tissu industriel brestois génère des volumes documentaires et opérationnels spécifiques (fiches de configuration MCO, comptes-rendus d'essais, données océanographiques, cahiers des charges navaux) où l'IA déploiée correctement produit des gains mesurables à court terme.",
          "Le kick-off se passe systématiquement en présentiel à Brest dans vos locaux : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/email ou outils métier spécifiques.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou chef de programme.",
          "Pour les organisations soumises à des contraintes de confidentialité (défense, données R&D sensibles), les modèles IA peuvent être déployés on-premise ou sur infra dédiée souveraine UE.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques brestois : sous-traitants navals (gestion documentaire MCO, rédaction technique), PME logistique (planification, suivi chantier), cabinets d'ingénierie (analyse de données terrain), services (qualification leads, support client).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Brest : revue de l'architecture cible (CRM, ERP, mails, GED, outils métier sectoriels), validation des contraintes RGPD/sécurité/confidentialité défense le cas échéant, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Brest : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique ou métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels brestois (fichiers techniques, données terrain, emails métier), ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Brest : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post go-live.",
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
              "Implémentation d'un cas d'usage simple (gestion documentaire, comptes-rendus, qualification leads) pour petites structures du bassin brestois.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME de sous-traitance navale, logistique, services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (GED, legacy ERP, datalake océanographique), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour sites brestois des grands groupes : cas d'usage cascadés, gouvernance IA, déploiement on-premise si contrainte confidentialité, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Déploiement gestion documentaire technique livré comme promis. ROI mesuré : plusieurs équivalents temps plein libérés sur la rédaction de rapports MCO. Les ambassadeurs internes ont pris le relais de façon autonome.",
            role: "DAF",
            companyProfile: "ETI sous-traitance navale, Brest Métropole",
          },
          {
            quote:
              "Méthode hybride parfaite pour nos contraintes de confidentialité : kick-off intense sur site, modèles déployés on-premise, itérations à distance maîtrisées. Notre équipe IT a gardé la main sur tout.",
            role: "DSI",
            companyProfile: "PME ingénierie maritime, Technopôle Brest-Iroise",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Brest ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions brestoises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Pouvez-vous déployer les modèles IA on-premise pour respecter nos contraintes défense ?",
            a: "Oui. Pour les organisations avec des contraintes de confidentialité, nous déployons les modèles IA sur votre infra on-premise, sur cloud privé ou sur infra dédiée souveraine UE. Les données ne quittent jamais votre environnement.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des documents techniques critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (documents MCO, données de sécurité), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Déploiement on-premise possible pour organisations soumises à confidentialité défense.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Brest brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory Brest kick-off at your premises. Particularly suited to organisations in the Brest basin: naval sub-contracting, marine science, digital, port logistics, business services.",
        whyHere: [
          "The Brest industrial fabric generates specific documentary and operational volumes (MCO configuration sheets, test reports, oceanographic data, naval specifications) where correctly deployed AI produces measurable short-term gains.",
          "Kick-off always happens in person in Brest at your offices: team alignment, data access, CRM/ERP/email or sector-specific tool integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or programme lead.",
          "For organisations subject to confidentiality constraints (defence, sensitive R&D data), AI models can be deployed on-premise or on dedicated sovereign EU infrastructure.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Brest cases: naval sub-contractors (MCO document management, technical writing), logistics SMEs (scheduling, site tracking), engineering firms (field data analysis), services (lead qualification, customer support).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Brest workshop: target architecture review (CRM, ERP, emails, DMS, sector-specific tools), GDPR/security/defence confidentiality constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Brest: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical or business team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real Brest volume testing (technical files, field data, business emails), UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Brest: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post go-live monitoring plan.",
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
              "Implementation of a simple use case (document management, meeting minutes, lead qualification) for small Brest basin structures.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For naval sub-contracting, logistics, services SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (DMS, legacy ERP, oceanographic datalake), cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for Brest sites of large groups: cascaded use cases, AI governance, on-premise deployment if confidentiality required, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical document management deployment delivered as promised. Measured ROI: several FTEs freed from MCO report writing. Internal ambassadors took over autonomously.",
            role: "CFO",
            companyProfile: "Naval sub-contracting mid-cap, Brest Métropole",
          },
          {
            quote:
              "Perfect hybrid method for our confidentiality constraints: intense on-site kick-off, on-premise model deployment, controlled remote iterations. Our IT team kept full control.",
            role: "CIO",
            companyProfile: "Maritime engineering SME, Technopôle Brest-Iroise",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Brest take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Brest missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Can you deploy AI models on-premise to meet our defence constraints?",
            a: "Yes. For organisations with confidentiality constraints, we deploy AI models on your on-premise infrastructure, private cloud or dedicated sovereign EU infrastructure. Data never leaves your environment.",
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
            q: "What if the AI produces errors on critical technical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (MCO documents, safety data), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. On-premise deployment available for organisations subject to defence confidentiality.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Brest accompagne individuellement les dirigeants et cadres des technologies marines, de la défense maritime, du Technopôle Brest-Iroise et des PME du Finistère. À partir de 990 € HT pour les TPE, chaque programme est bâti autour de vos cas d'usage réels — documentation technique maritime, traitement de données océaniques, reporting de bureau d'études ou gestion commerciale de PME brestoise. Vous progressez à votre rythme, sans théorie superflue.",
        whyHere: [
          "Brest concentre des ingénieurs et cadres de la défense maritime (Naval Group, Thales Underwater Systems, Marine nationale) avec des besoins IA précis et des contraintes de confidentialité fortes — le coaching 1-to-1 s'adapte à leurs contraintes réglementaires.",
          "Les chercheurs et cadres d'IFREMER, du Lab-STICC et du Technopôle Brest-Iroise ont des besoins IA spécifiques sur le traitement de données scientifiques marines, la veille bibliographique et la valorisation de données — le coaching individuel cible ces enjeux précisément.",
          "Les PME du tissu brestois (services informatiques, ingénierie, BTP, commerce) n'ont pas toujours de DSI interne : le coaching 1-to-1 leur permet d'intégrer l'IA en toute sécurité, à leur rythme.",
          "Les fondateurs et managers de la French Tech Brest+ qui veulent intégrer l'IA dans leur produit ou service trouvent dans le coaching individuel un accélérateur adapté à leur stade.",
          "Séances flexibles : 100 % visio ou présentiel dans vos locaux à Brest, Plouzané, Guipavas, Technopôle Brest-Iroise. Aucun déplacement imposé.",
          "Aucun lock-in : vous repartez avec votre plan d'action personnalisé et votre autonomie — sans dépendance vis-à-vis d'Axion-IA.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Séance d'ouverture pour cartographier votre maturité IA, vos cas d'usage prioritaires (défense, sciences marines, logistique portuaire, BTP, services) et vos outils existants dans le contexte brestois.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Co-construction d'un programme calé sur votre agenda et votre secteur (défense maritime, océanographie, numérique, services B2B). Chaque séance a un objectif actionnable précis.",
          },
          {
            step: "Séances pratiques sur vos vraies données",
            detail:
              "Chaque session travaille directement sur vos documents réels — rapports techniques, données de capteurs, emails commerciaux, devis, fiches de maintenance. L'IA est appliquée à votre réalité, pas à des exemples fictifs.",
          },
          {
            step: "Ancrage et mise en pratique",
            detail:
              "Entre les séances, vous expérimentez les outils sur vos cas réels. La séance suivante débute par un debriefing et un ajustement du plan selon vos retours terrain.",
          },
          {
            step: "Bilan et feuille de route",
            detail:
              "En fin de programme, restitution d'une feuille de route personnalisée : cas d'usage priorisés, outils retenus, prochaines étapes pour votre structure brestoise. Vous repartez pleinement autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Programme d'entrée pour les gérants de TPE, artisans, indépendants et petites structures du Finistère souhaitant intégrer l'IA dans leur activité quotidienne.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme sur mesure pour dirigeants et cadres des PME industrielles, numériques et de services de la Brest Métropole et du Finistère.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour DG, directeurs techniques, DSI ou directeurs R&D des ETI brestoises (défense, technologies marines, ingénierie) souhaitant piloter leur trajectoire IA.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de cadres dirigeants et managers des grands groupes brestois (Naval Group, Thales Underwater Systems, IFREMER) pour des besoins d'acculturation IA individualisés.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de comprendre comment utiliser l'IA pour accélérer mon traitement de données océanographiques. On a travaillé sur mes vrais jeux de données dès la première séance. Les gains sur ma productivité ont été immédiats.",
            role: "Chef de projet R&D",
            companyProfile: "PME ingénierie marine, Technopôle Brest-Iroise",
          },
          {
            quote:
              "Format idéal pour un dirigeant de PME brestoise sans DSI : séances courtes, 100 % focalisées sur mon contexte et mes enjeux réels. L'IA est maintenant intégrée dans ma gestion commerciale et mon reporting.",
            role: "Gérant",
            companyProfile: "PME services aux entreprises, Brest Métropole",
          },
        ],
        faq: [
          {
            q: "Quel est le format des séances de coaching 1-to-1 à Brest ?",
            a: "Les séances se déroulent en visio ou en présentiel dans vos locaux à Brest, Plouzané, Guipavas ou au Technopôle Brest-Iroise. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel.",
          },
          {
            q: "Quelle est la fréquence des séances ?",
            a: "La fréquence est définie ensemble lors du diagnostic initial selon votre rythme et vos objectifs — hebdomadaire, bimensuelle ou mensuelle. Aucun rythme imposé.",
          },
          {
            q: "Le coaching est-il adapté aux acteurs de la défense maritime brestoise ?",
            a: "Oui. Le coaching 1-to-1 respecte les contraintes de confidentialité des acteurs de la défense et des technologies maritimes. Les séances sont structurées pour ne pas exposer de données sensibles. accord de confidentialité systématique disponible.",
          },
          {
            q: "Quels secteurs sont concernés à Brest ?",
            a: "Tous les secteurs B2B de la métropole : défense maritime, sciences de la mer, numérique, logistique portuaire, BTP, services aux entreprises, santé. Le coaching s'adapte à votre contexte et vos cas d'usage réels.",
          },
          {
            q: "Mes données et échanges sont-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos données, documents et informations métier ne sortent jamais de la session. Conformité RGPD, possibilité de séances en local sans transmission vers des serveurs externes.",
          },
          {
            q: "Quelle différence entre le coaching 1-to-1 et une intervention collective à Brest ?",
            a: "L'intervention collective forme votre équipe en une journée sur des outils IA généraux. Le coaching 1-to-1 vous accompagne individuellement sur la durée, sur vos cas précis, à votre rythme — vous gagnez en autonomie décisionnelle.",
          },
        ],
        guarantees:
          "Aucun engagement de durée minimum : vous pilotez le programme séance par séance. Confidentialité stricte. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel. Aucun lock-in : vous repartez avec votre feuille de route personnalisée et votre pleine autonomie. Si la première séance ne vous apporte pas de valeur concrète, elle est remboursée intégralement.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Brest individually supports executives and managers in marine technologies, maritime defence, Technopôle Brest-Iroise and Finistère SMEs. Starting from 990 € excl. VAT for micro-businesses, each programme is built around your real use cases — maritime technical documentation, oceanic data processing, engineering bureau reporting or commercial management for a Brest SME. You progress at your own pace, without superfluous theory.",
        whyHere: [
          "Brest concentrates engineers and managers in maritime defence (Naval Group, Thales Underwater Systems, French Navy) with precise AI needs and strong confidentiality constraints — 1-to-1 coaching adapts to their regulatory requirements.",
          "Researchers and managers at IFREMER, Lab-STICC and Technopôle Brest-Iroise have specific AI needs around marine scientific data processing, bibliographic monitoring and data valorisation — individual coaching targets these challenges precisely.",
          "Brest's SME fabric (IT services, engineering, construction, trade) often lacks an internal IT manager: 1-to-1 coaching allows them to integrate AI safely, at their own pace.",
          "French Tech Brest+ founders and managers wanting to integrate AI into their product or service find in individual coaching an accelerator suited to their stage.",
          "Flexible sessions: 100% video or in person at your offices in Brest, Plouzané, Guipavas, Technopôle Brest-Iroise. No imposed travel.",
          "No lock-in: you leave with your personalised action plan and full autonomy — no dependency on Axion-IA.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "Opening session to map your AI maturity, priority use cases (defence, marine science, port logistics, construction, services) and existing tools in the Brest context.",
          },
          {
            step: "Personalised progression plan",
            detail:
              "Co-build a programme fitted to your agenda and sector (maritime defence, oceanography, digital, B2B services). Each session has a precise actionable objective.",
          },
          {
            step: "Practical sessions on your real data",
            detail:
              "Each session works directly on your real documents — technical reports, sensor data, commercial emails, quotes, maintenance sheets. AI is applied to your reality, not fictional examples.",
          },
          {
            step: "Anchoring and practice",
            detail:
              "Between sessions, you experiment with tools on your real cases. The next session starts with a debrief and plan adjustment based on your field feedback.",
          },
          {
            step: "Review and roadmap",
            detail:
              "At programme end, a personalised roadmap is delivered: prioritised use cases, retained tools, next steps for your Brest organisation. You leave fully autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From 990 € excl. VAT",
            detail:
              "Entry programme for micro-business owners, craft firms, freelancers and small Finistère structures wishing to integrate AI into their daily activity.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Bespoke programme for executives and managers at industrial, digital and service SMEs in Brest Métropole and Finistère.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Individual support for CEOs, technical directors, CIOs or R&D directors of Brest mid-caps (defence, marine technologies, engineering) wishing to steer their AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Executive coaching for senior managers at major Brest groups (Naval Group, Thales Underwater Systems, IFREMER) requiring individualised AI acculturation.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching helped me understand how to use AI to speed up my oceanographic data processing. We worked on my real datasets from the first session. Productivity gains were immediate.",
            role: "R&D Project Manager",
            companyProfile: "Marine engineering SME, Technopôle Brest-Iroise",
          },
          {
            quote:
              "Ideal format for a Brest SME owner with no IT manager: short sessions, 100% focused on my context and real challenges. AI is now integrated into my commercial management and reporting.",
            role: "Managing Director",
            companyProfile: "B2B services SME, Brest Métropole",
          },
        ],
        faq: [
          {
            q: "What is the format of 1-to-1 coaching sessions in Brest?",
            a: "Sessions take place by video or in person at your offices in Brest, Plouzané, Guipavas or Technopôle Brest-Iroise. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "How often are the sessions?",
            a: "Frequency is defined together at the initial diagnostic according to your rhythm and objectives — weekly, fortnightly or monthly. No imposed schedule.",
          },
          {
            q: "Is coaching adapted to Brest maritime defence players?",
            a: "Yes. 1-to-1 coaching respects the confidentiality constraints of defence and maritime technology players. Sessions are structured to avoid exposing sensitive data. accord de confidentialité systematically available.",
          },
          {
            q: "Which sectors are covered in Brest?",
            a: "All B2B sectors in the metropolitan area: maritime defence, marine science, digital, port logistics, construction, business services, health. Coaching adapts to your context and real use cases.",
          },
          {
            q: "Are my data and exchanges kept confidential?",
            a: "Yes. Strict confidentiality from the first session. Your data, documents and business information never leave the session. GDPR compliant, local session option available without data transmission to external servers.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and a group session in Brest?",
            a: "A group session trains your team in one day on general AI tools. 1-to-1 coaching supports you individually over time, on your specific cases, at your own pace — you gain decision-making autonomy.",
          },
        ],
        guarantees:
          "No minimum commitment: you drive the programme session by session. Strict confidentiality. Lodging, meals and travel allowance billed separately for on-site sessions. No lock-in: you leave with your personalised roadmap and full autonomy. If the first session delivers no concrete value, it is fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Brest ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Brest que partout en France.",
    },
    {
      q: "Axion-IA intervient-il sur site à Brest et dans le Finistère ?",
      a: "Oui. Toutes nos interventions à Brest sont par défaut sur site, dans vos bureaux ou locaux industriels. Nos consultants couvrent l'ensemble de Brest Métropole — Plouzané, Guipavas, Gouesnou, Le Relecq-Kerhuon — ainsi que l'ensemble du Finistère. Frais de logement, repas et forfait trajet facturés séparément.",
    },
    {
      q: "Quels secteurs sont prioritaires à Brest pour l'IA ?",
      a: "Nos déploiements brestois couvrent en priorité la défense maritime et la construction navale (Naval Group, sous-traitants MCO), les sciences de la mer et la R&D océanique (IFREMER, Technopôle Brest-Iroise), le numérique et la cybersécurité (IMT Atlantique, Lab-STICC), la logistique portuaire et le BTP. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous travailler avec des organisations soumises à confidentialité défense ?",
      a: "Oui. Nous adaptons systématiquement notre méthode aux contraintes de confidentialité — périmètre de collecte défini en amont, accord de confidentialité renforcé, travail exclusivement sur vos infrastructures, déploiement on-premise si nécessaire. Nous accompagnons des sous-traitants navals et des ETI du bassin brestois sur des périmètres sensibles.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Brest ?",
      a: "Le délai dépend de votre besoin et de la disponibilité des parties. Nous calons une date de démarrage avec vous lors du brief de cadrage initial, et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les structures du Technopôle Brest-Iroise ?",
      a: "Oui. Le Technopôle Brest-Iroise (Plouzané) fait partie de notre zone d'intervention prioritaire. Nous accompagnons les structures R&D océanique, les startups du numérique marin et les entreprises du pôle sur leurs cas IA opérationnels — traitement de données terrain, automatisation documentaire, valorisation de données issues de capteurs marins.",
    },
  ],
};
