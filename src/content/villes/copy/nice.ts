// Nice (06088) — contenu éditorial gold standard.
//
// Doctrine identique à paris.ts (correction Will 2026-05-08) :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés » : frais logement, repas et
//     forfait trajet toujours en sus pour les formats interventions.
//   - Durée minimale = 1 journée. Pas de demi-journée.
//   - Aucun prix hardcodé : libellés contextuels uniquement (tarifs viennent
//     de `src/content/pricing.ts`).
//   - Tailles INSEE : PME/ETI/grands groupes / Grande entreprise.
//   - ~95 % Axion-IA-centric + ~5 % data INSEE bouclier anti-doorway HCU.
//   - Aucun « basé en UE » (mention supprimée).
//
// Données sourcées depuis `economic-data/nice.ts` (sprint City Quality V3
// 2026-05-18) : Sophia Antipolis (1er technopôle européen), 3IA Côte d'Azur,
// Amadeus IT Group, IBM, SAP Labs, Inria, Université Côte d'Azur (IDEX),
// EDHEC Nice, French Tech Côte d'Azur capitale, Nice Eco-Vallée OIN,
// Grand Arénas, Nice Méridia, 16 327 établissements actifs.

import type { VilleCopy } from "./types";

export const NICE_COPY: VilleCopy = {
  pitchFr:
    "Nice réunit 16 327 établissements actifs, le premier technopôle européen à Sophia Antipolis (à 20 km), les R&D mondiales d'Amadeus IT et d'IBM, l'institut 3IA Côte d'Azur et la French Tech Côte d'Azur. Axion-IA y intervient sur site, des PME du Vieux-Nice aux sièges régionaux de la Côte d'Azur.",
  pitchEn:
    "Nice brings together 16,327 active businesses, Europe's leading tech park at Sophia Antipolis (20 km away), worldwide R&D from Amadeus IT and IBM, the 3IA Côte d'Azur AI institute and French Tech Côte d'Azur. Axion-IA delivers on site, from Old Nice micro-businesses to regional Côte d'Azur headquarters.",

  seoHook: "tourisme d'affaires & tech Sophia",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Nice : nous identifions ce qui peut être automatisé dans votre structure et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI, calibrés de la PME niçoise aux ETI et grandes entreprises de la Côte d'Azur.",
      en: "Operational AI audit in Nice: we identify what can be automated at your company and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic, calibrated from Nice micro-businesses to Côte d'Azur mid-caps and large enterprises.",
    },
    interventions: {
      fr: "Interventions IA à Nice : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste, configurés pour leur métier — tourisme d'affaires, hôtellerie premium, tech Sophia, santé/biotech ou services.",
      en: "AI sessions in Nice: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA à Nice : on déploie l'IA dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Vos équipes gardent la main — pas de dépendance créée.",
      en: "AI implementation in Nice: we deploy AI into your existing tools (CRM, ERP, email) with contractually-costed ROI. Your teams stay in control — no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA 1-to-1 à Nice et Sophia Antipolis : accompagnement individuel intensif d'un dirigeant ou d'un expert métier pour maîtriser et déployer l'IA dans son quotidien professionnel. Séances sur site ou à distance selon votre rythme. Tarif d'entrée {{price:intervention-dirigeants|flat}}.",
      en: "1-to-1 AI coaching in Nice and Sophia Antipolis: intensive individual support for a manager or expert to master and deploy AI in their professional practice. On-site or remote sessions at your pace. Entry rate from €990 excl. VAT.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI niçoises — site vitrine premium pour scale-ups Sophia Antipolis et acteurs du tourisme d'affaires Côte d'Azur, espace client interactif, dashboard métier connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Nice SMEs and mid-caps — premium showcase site for Sophia Antipolis scale-ups and Côte d'Azur business tourism players, interactive customer space, business dashboard connected to your CRM/ERP. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Nice (06) sur site, de la Promenade des Anglais à Sophia Antipolis. Nous accompagnons PME, ETI et grands groupes de la Côte d'Azur — tourisme d'affaires, IT, santé, services — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Vos équipes azuréennes conservent la maîtrise pleine de la stack (modèles, CRM hôtelier, intégrations Sophia) après notre mission — sans verrou éditeur ni dépendance contractuelle.",
  directAnswerEn:
    "Axion-IA is an senior AI experts consultancy that intervenes in Nice (06) on site, from the Promenade des Anglais to Sophia Antipolis. We support micro-businesses, SMEs, mid-caps and large enterprises on the Côte d'Azur — business tourism, IT, health, services — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Tourisme d'affaires & Hôtellerie premium",
    "Tech & IT (Sophia Antipolis / Eco-Vallée)",
    "Conseil & Services aux entreprises",
    "Santé & Biotech",
    "Aérospatial & Défense",
    "Commerce & Distribution",
  ],

  distancesFr:
    "Gare de Nice-Ville (TGV Paris/Lyon/Marseille) en centre-ville. Aéroport Nice Côte d'Azur (NCE, 2e de France) à 7 km. Tramway T1/T2/T3 et bus Lignes d'Azur pour rejoindre vos bureaux partout à Nice, Grand Arénas, Nice Méridia et le bassin de Sophia Antipolis à 20 km.",
  distancesEn:
    "Nice-Ville station (TGV Paris/Lyon/Marseille) in the city centre. Nice Côte d'Azur Airport (NCE, France's 2nd airport) 7 km away. Tramway T1/T2/T3 and Lignes d'Azur buses to reach your offices across Nice, Grand Arénas, Nice Méridia and the Sophia Antipolis tech park 20 km away.",

  ecosystemFr:
    "Première capitale régionale du Sud-Est : 16 327 établissements actifs (INSEE 2024), French Tech Côte d'Azur, bassin Sophia Antipolis (1er technopôle européen, Amadeus IT, IBM, SAP Labs, EURECOM), Université Côte d'Azur IDEX, INRIA Méditerranée, 3IA Côte d'Azur (1 des 4 instituts IA français du PIA), EDHEC Business School Campus Nice, Nice Eco-Vallée OIN, Grand Arénas hub multimodal.",
  ecosystemEn:
    "South-East France's leading regional capital: 16,327 active businesses (INSEE 2024), French Tech Côte d'Azur, Sophia Antipolis basin (Europe's top tech park, Amadeus IT, IBM, SAP Labs, EURECOM), Université Côte d'Azur IDEX, Inria Mediterranean centre, 3IA Côte d'Azur (one of France's 4 PIA AI institutes), EDHEC Business School Nice campus, Nice Eco-Vallée OIN, Grand Arénas multimodal hub.",

  // === SERVICES LONG-FORM NICE ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre structure et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toute l'échelle : PME et ETI du Vieux-Nice ou du quartier d'affaires Grand Arénas, ETI hôtelières et de services de la Côte d'Azur, sièges régionaux du bassin Sophia Antipolis.",
        whyHere: [
          "Nice et sa métropole concentrent un tissu B2B dense : 16 327 établissements actifs, du petit commerce de la vieille ville aux centres R&D mondiaux d'Amadeus IT et d'IBM.",
          "Le bassin Sophia Antipolis — à 20 km de Nice — héberge le 1er technopôle européen avec Amadeus, IBM, SAP, Accenture, EURECOM : autant de directions IA que nous accompagnons régulièrement.",
          "Nos consultants se déplacent sur site à Nice et dans toute la métropole (Grand Arénas, Nice Méridia, Sophia Antipolis, Cannes, Antibes, Grasse, Menton).",
          "Restitutions systématiquement en présentiel : ateliers d'idéation, lecture du livrable avec votre comité de direction, plan d'attaque remis en main propre.",
          "Tarifs publics affichés, pas de devis opaque à six chiffres : vous savez exactement ce que vous payez avant de signer.",
          "Votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — zéro lock-in.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Identification des périmètres prioritaires selon votre secteur dominant (tourisme, IT, santé, services).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux à Nice ou sur le bassin Sophia/Antibes pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, finance, RH, opérations, support, direction) pour cartographier finement frictions et attentes. Angle adapté à votre secteur : langage hôtellerie, IT, santé ou services B2B.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos factures, vos dossiers clients. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux à Nice ou Sophia. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour agences, cabinets d'expertise, hôtels indépendants, PME tech de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI hôtelières, chaînes régionales, directions IT Sophia Antipolis souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les centres R&D Amadeus, IBM, SAP et les sièges régionaux souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a livré en quelques journées ce qu'une mission de conseil classique nous aurait proposé en plusieurs mois. Le rapport chiffré a permis de prioriser deux chantiers IA dès le trimestre suivant.",
            role: "Directeur général",
            companyProfile: "PME services B2B, Nice centre, 45 collaborateurs",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données. Le livrable a convaincu notre CODIR en une seule présentation. On a pu démarrer l'implémentation sans attendre.",
            role: "Directrice de la transformation digitale",
            companyProfile: "ETI hôtelière Côte d'Azur, 3 établissements",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Nice ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs journées réparties sur quelques semaines. Nous calons le rythme avec vous dès le brief de cadrage.",
          },
          {
            q: "Quel ROI puis-je attendre pour une PME niçoise ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente en général plusieurs équivalents temps plein gagnés sur les workflows automatisés (lecture factures, comptes-rendus, qualification leads). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise.",
          },
          {
            q: "Couvrez-vous le bassin Sophia Antipolis depuis Nice ?",
            a: "Oui. Nos consultants se déplacent sur site dans toute la métropole Nice Côte d'Azur, ainsi qu'à Sophia Antipolis, Antibes, Cannes, Grasse et Menton. Sophia est à 20 min de Nice-Ville, une distance de travail courante pour nos missions.",
          },
          {
            q: "Différence avec un audit Big Four ou un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, méthode condensée, démos sur vos vraies données plutôt que des slides théoriques. Et surtout : aucun lock-in — vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une grande partie de nos audits sur la Côte d'Azur sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Le plan d'action remis est portable — exécutable par tout cabinet de la French Tech Côte d'Azur ou par vos équipes en interne, sans prestation continue obligatoire.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover the full range: Nice and Grand Arénas micro-businesses and SMEs, Côte d'Azur hospitality and services mid-caps, Sophia Antipolis regional R&D headquarters.",
        whyHere: [
          "Nice and its metro area hold a dense B2B fabric: 16,327 active businesses, from Old Town shops to the worldwide R&D centres of Amadeus IT and IBM.",
          "The Sophia Antipolis basin — 20 km from Nice — hosts Europe's leading tech park with Amadeus, IBM, SAP, Accenture, EURECOM: AI leadership we engage with regularly.",
          "Our consultants travel on site across Nice and the full metro area (Grand Arénas, Nice Méridia, Sophia Antipolis, Cannes, Antibes, Grasse, Menton).",
          "Read-outs always in person: ideation workshops, deliverable walk-through with your leadership, action plan handed face to face.",
          "Public pricing, no opaque six-figure quotes: you know exactly what you pay before signing.",
          "Your action plan is executable with any vendor or in-house after our audit — zero lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). Priority scope identified per your dominant sector (hospitality, IT, health, B2B services).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your offices in Nice or the Sophia/Antibes basin to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, HR, operations, support, leadership) to map frictions and expectations. Angle adapted to your sector: hospitality, IT, health or B2B services language.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, invoices, client files. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices in Nice or Sophia. Costed PDF deliverable handed over, actionable 6-18 month roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for agencies, accounting firms, independent hotels, tech SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For hospitality mid-caps, regional chains, Sophia Antipolis IT leadership framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For Amadeus, IBM, SAP R&D centres and regional HQs framing centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered in a few days what a traditional consulting mission would have taken months for. The costed report let us prioritize two AI initiatives in the following quarter.",
            role: "CEO",
            companyProfile: "B2B services SME, Nice centre, 45 staff",
          },
          {
            quote:
              "Pragmatic method, demos on our real data. The deliverable convinced our executive committee in a single presentation. We could start implementation right away.",
            role: "Head of Digital Transformation",
            companyProfile: "Côte d'Azur hospitality mid-cap, 3 properties",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Nice?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several days spread over a few weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a Nice SME?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents several FTEs saved on automated workflows (invoice reading, meeting minutes, lead qualification). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty is required.",
          },
          {
            q: "Do you cover the Sophia Antipolis basin from Nice?",
            a: "Yes. Our consultants travel on site across the Nice Côte d'Azur metro and to Sophia Antipolis, Antibes, Cannes, Grasse and Menton. Sophia is 20 minutes from Nice-Ville, a routine working distance for our missions.",
          },
          {
            q: "Difference with a Big Four audit or traditional consulting?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, condensed method, demos on your real data rather than theoretical slides. And above all: no lock-in — you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Côte d'Azur audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Côte d'Azur missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Nice se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — réception hôtelière, équipe événementiel tourisme d'affaires, support tech Sophia, cabinet médical Eurobiomed ou service client B2B.",
        whyHere: [
          "Nice et la Côte d'Azur couvrent un tissu B2B de 16 327 établissements actifs : hôtels, agences, cabinets, structures IT et biotech — tous éligibles à nos sessions sur site.",
          "Le bassin Sophia Antipolis concentre les équipes R&D d'Amadeus, IBM, SAP et d'une centaine d'entreprises tech : nous y animons des sessions dédiées IT/IA.",
          "Tous les formats sont disponibles en présentiel à Nice (centre-ville, Grand Arénas, Nice Méridia) et sur l'ensemble du bassin azuréen (Sophia, Antibes, Cannes, Grasse, Menton).",
          "Vocabulaire ajusté à votre secteur dominant : tourisme d'affaires, IT, santé, hôtellerie, services B2B. Pas de session générique recyclée.",
          "Le format Dirigeants est particulièrement adapté aux ETI hôtelières et aux directions des entreprises tech de Sophia Antipolis pour cadrer leur stratégie IA en huis-clos.",
          "Le format Conférence convient aux grandes plénières (auditoires des campus UCA, salles de conférence des hôtels Côte d'Azur, espaces CEEI Nice).",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier (tourisme, IT, santé, services), les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (factures, emails, dossiers clients, RH) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour de la session.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Langue de la session : français, anglais ou bilingue selon votre équipe (utile pour les équipes internationales de Sophia Antipolis).",
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
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (commerciaux, réception, finance, opérations).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos CODIR selon votre objectif. Adapté aux ETI hôtelières et directions IT Sophia.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges régionaux et centres R&D Sophia/Nice : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement adaptée à nos équipes hôtelières. Chaque collaborateur est reparti avec ses outils installés et configurés. Dès le lendemain, une partie significative les utilisaient sur leur travail réel.",
            role: "DRH",
            companyProfile: "Groupe hôtelier indépendant Côte d'Azur, 4 établissements",
          },
          {
            quote:
              "Session bilingue animée à Sophia Antipolis pour nos équipes IT internationales. La qualité des démos sur nos vraies données a été décisive. Le cadrage a été précis et sans jargon inutile.",
            role: "Head of Engineering",
            companyProfile: "ETI tech Sophia Antipolis, équipe internationale",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Nice ?",
            a: "Cela dépend du format choisi. Le format collectif (1 journée) se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous animer une session en anglais pour nos équipes internationales à Sophia Antipolis ?",
            a: "Oui. Nous proposons des sessions en français, en anglais ou bilingues selon la composition de votre équipe. Sophia Antipolis héberge de nombreuses équipes internationales ; une langue de session adaptée est un pré-requis que nous intégrons dès le cadrage.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Les accès restent à votre nom et révocables à tout moment — pas de licence Axion-IA, pas de dépendance technique imposée.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur touristique ou hôtelier ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un hôtel Côte d'Azur n'a rien à voir avec une session pour une équipe IT de Sophia Antipolis.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur, sessions en français, anglais ou bilingue selon votre équipe.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Nice come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work.",
        whyHere: [
          "Nice and the Côte d'Azur cover a B2B fabric of 16,327 active businesses: hotels, agencies, practices, IT and biotech firms — all eligible for our on-site sessions.",
          "The Sophia Antipolis basin concentrates R&D teams from Amadeus, IBM, SAP and over a hundred tech companies: we run dedicated IT/AI sessions there.",
          "All formats are available on site across Nice (city centre, Grand Arénas, Nice Méridia) and the full Côte d'Azur basin (Sophia, Antibes, Cannes, Grasse, Menton).",
          "Vocabulary adjusted to your dominant sector: business tourism, IT, health, hospitality, B2B services. No recycled generic session.",
          "The Executives format is particularly suited to hospitality mid-caps and Sophia Antipolis tech leadership to frame their AI strategy in-camera.",
          "The Talk format suits large plenaries (UCA campus auditoriums, Côte d'Azur hotel conference rooms, CEEI Nice spaces).",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (tourism, IT, health, services), priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (invoices, emails, client files, HR) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, Wi-Fi access. No technical hiccup on session day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Session language: French, English or bilingual per your team (useful for Sophia Antipolis international teams).",
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
              "Group format for the whole group or Teams to focus on one department (sales, front desk, finance, operations).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee. Suited to hospitality mid-caps and Sophia IT leadership.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for regional HQs and Sophia/Nice R&D centres: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly adapted to our hotel teams. Each staff member left with their tools installed and configured. The next day, a significant share were already using them on real work.",
            role: "Head of HR",
            companyProfile: "Independent Côte d'Azur hotel group, 4 properties",
          },
          {
            quote:
              "Bilingual session run at Sophia Antipolis for our international IT teams. The quality of demos on our real data was decisive. Framing was precise and jargon-free.",
            role: "Head of Engineering",
            companyProfile: "Sophia Antipolis tech mid-cap, international team",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Nice take?",
            a: "It depends on the chosen format. The group format (one day) runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run a session in English for our international teams at Sophia Antipolis?",
            a: "Yes. We offer sessions in French, English or bilingual depending on your team composition. Sophia Antipolis hosts many international teams; a suitable session language is a pre-condition we integrate at framing.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our tourism or hospitality sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Côte d'Azur hotel has nothing to do with one for a Sophia Antipolis IT team.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector, sessions in French, English or bilingual per your team.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Nice met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire à Nice ou sur le bassin Sophia Antipolis selon votre localisation.",
        whyHere: [
          "Nice et le bassin Sophia Antipolis concentrent des cas d'implémentation particulièrement riches : systèmes de réservation hôtelière, GDS de voyage, ERP biotech, pipelines data IT.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/email.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Nice ou Sophia : passation de pouvoir, formation des équipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques Côte d'Azur : hôtels et résidences (optimisation réservations, comptes-rendus, génération de copy), structures IT Sophia (pipelines data, agents support), cabinets santé (dossiers patients, administratif).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Nice ou Sophia : revue de l'architecture cible (CRM, PMS hôtelier, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Nice ou Sophia : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
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
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/PMS/ERP. Pour agences, hôtels indépendants, cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (GDS, legacy ERP, datalake), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les centres R&D Sophia et les sièges régionaux : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation dossiers administratifs livrée comme promis. ROI mesuré à 6 mois : plusieurs équivalents temps plein libérés sur les tâches récurrentes. Aucun lock-in, on a la main sur les modèles.",
            role: "DAF",
            companyProfile: "ETI santé Côte d'Azur, 3 sites, 180 collaborateurs",
          },
          {
            quote:
              "Méthode hybride efficace : kick-off intense sur site à Sophia, puis itérations à distance avec points quotidiens courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes assurent le suivi de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up IT Sophia Antipolis, équipe 55 personnes",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Nice ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel chez nous ou chez tout intégrateur Côte d'Azur — vous restez libre de la délégation.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (factures importantes, contrats, RH), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Modèles, données et runbook restent intégralement chez vous, transférables à tout intégrateur Côte d'Azur ou repris en interne. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Nice brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off in Nice or the Sophia Antipolis basin depending on your location.",
        whyHere: [
          "Nice and the Sophia Antipolis basin concentrate particularly rich implementation cases: hotel booking systems, travel GDS, biotech ERPs, IT data pipelines.",
          "Kick-off always happens in person at your offices: team alignment, data access, CRM/ERP/email integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Nice or Sophia: handover, team training, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Côte d'Azur cases: hotels and residences (reservation optimization, meeting minutes, copy generation), Sophia IT structures (data pipelines, support agents), health practices (patient files, admin).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Nice or Sophia workshop: target architecture review (CRM, hotel PMS, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Nice or Sophia: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
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
              "Deployment of several use cases, training of internal ambassadors, CRM/PMS/ERP integration. For agencies, independent hotels, practices from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (GDS, legacy ERP, datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Sophia R&D centres and regional HQs: cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Administrative file automation delivered as promised. ROI measured at 6 months: several FTEs freed on recurring tasks. No lock-in, we control our models.",
            role: "CFO",
            companyProfile: "Côte d'Azur health mid-cap, 3 sites, 180 staff",
          },
          {
            quote:
              "Efficient hybrid method: intense on-site kick-off at Sophia, then remote iterations with short daily check-ins. Our IT team was never lost. Internal ambassadors handle follow-up autonomously.",
            role: "CTO",
            companyProfile: "Sophia Antipolis IT scale-up, 55-person team",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Nice take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large invoices, contracts, HR), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Nice et Sophia Antipolis est un accompagnement individuel intensif conçu pour les dirigeants, managers et experts métiers qui veulent maîtriser l'IA dans leur pratique quotidienne — sans passer par une formation de groupe. Chaque séance est centrée sur VOS dossiers, VOS données, VOS workflows. Présentiel à Nice, Grand Arénas, Sophia Antipolis ou à distance selon votre agenda. Tarif d'entrée {{price:intervention-dirigeants|flat}}.",
        whyHere: [
          "Nice et le bassin Sophia Antipolis concentrent une densité exceptionnelle de dirigeants et experts exposés à la transformation IA : PDG de scale-ups tech, CTO de R&D Amadeus/IBM/SAP, directeurs d'ETI hôtelières, partners de cabinets conseil.",
          "Le coaching 1-to-1 s'adapte à des profils très spécifiques : dirigeant anglophone d'une filiale internationale à Sophia, DAF d'une ETI touristique qui veut dérisquer son P&L, DG de PME niçoise qui veut passer à l'action sans équipe dédiée.",
          "Séances sur site dans vos bureaux à Nice ou Sophia Antipolis (Grand Arénas, Nice Méridia, Antibes, Cannes) ou à distance en visio sécurisée selon votre rythme — pas de session imposée.",
          "Programme construit sur votre réalité : nous travaillons sur vos emails, vos présentations, vos tableaux de bord, vos dossiers clients — pas sur des cas fictifs. Ce que vous maîtrisez le soir de la première séance est utilisable le lendemain matin.",
          "Bilingue français/anglais : accompagnement possible en anglais pour les dirigeants de filiales internationales ou les équipes Sophia Antipolis anglophones. Pas de barrière linguistique.",
          "Aucun groupe, aucune date imposée : le coaching 1-to-1 se cale sur votre agenda de dirigeant, y compris en dehors des heures classiques ou en déplacement.",
        ],
        methodology: [
          {
            step: "Entretien de positionnement",
            detail:
              "Un échange de cadrage de 45 minutes (à distance ou sur site) pour cerner votre profil exact : secteur, niveau IA actuel, objectifs prioritaires (gains de productivité, prise de décision, délégation, communication), rythme souhaité et langue de travail.",
          },
          {
            step: "Plan d'apprentissage personnalisé",
            detail:
              "Sur la base de l'entretien, nous construisons un programme de séances calibré sur votre réalité opérationnelle : cas d'usage prioritaires issus de votre secteur (hôtellerie, IT Sophia, santé, conseil), outils sélectionnés pour votre profil, rythme adapté à votre charge dirigeant.",
          },
          {
            step: "Séances pratiques sur vos données",
            detail:
              "Chaque séance (présentielle ou distance) alterne courte théorie et long atelier pratique sur VOS données : emails en attente, rapport à rédiger, analyse de dossier client, brief fournisseur. Vous repartez avec un livrable utilisable issu de la séance.",
          },
          {
            step: "Ancrage et autonomie progressive",
            detail:
              "Entre les séances, des exercices courts autonomes sur vos dossiers réels pour consolider les acquis. Accès à un canal de questions asynchrones (text/audio) pour débloquer rapidement sans attendre la prochaine séance.",
          },
          {
            step: "Bilan + plan de continuation",
            detail:
              "À l'issue du programme, bilan synthétique de progression, liste des outils maîtrisés et configurés, recommandations de continuation (veille IA, cas suivants à traiter). Vous êtes autonome — sans dépendance Axion-IA créée.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Programme PME — sur devis",
            detail:
              "Plusieurs séances ciblées pour un dirigeant ou un manager clé de PME (directeur commercial, DRH, DAF) souhaitant monter en compétences IA sur ses missions quotidiennes.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme ETI dirigeants — sur devis",
            detail:
              "Accompagnement individuel du DG ou des N-1 d'une ETI hôtelière ou d'une direction Sophia Antipolis souhaitant piloter leur transformation IA en huis-clos, sans exposer leur agenda à un groupe.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme executive — sur devis",
            detail:
              "Coaching IA confidentiel pour C-levels et directeurs de centres R&D Sophia (Amadeus, IBM, SAP) ou sièges régionaux souhaitant un accompagnement de haut niveau, discret et sans format groupe.",
          },
        ],
        testimonials: [
          {
            quote:
              "Trois séances suffisent à transformer ma façon de préparer mes CODIR. Je génère mes synthèses de dossiers en quelques minutes au lieu d'une demi-journée. Le coaching sur mes vrais fichiers a fait toute la différence.",
            role: "Directeur général",
            companyProfile: "ETI hôtelière indépendante Côte d'Azur, 5 établissements",
          },
          {
            quote:
              "Format parfait pour un CTO toujours en déplacement. Séances à distance caleées sur mon agenda, travail direct sur nos pipelines data internes. Résultat : j'ai embarqué mon équipe sur deux cas IA en production dès le mois suivant.",
            role: "CTO",
            companyProfile: "Scale-up tech Sophia Antipolis, équipe R&D internationale",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce qui différencie le coaching 1-to-1 d'une formation de groupe à Nice ?",
            a: "Dans un groupe, le rythme est calé sur la moyenne des participants et les cas traités sont génériques. En 1-to-1, chaque séance travaille sur VOS fichiers, VOS emails, VOS dossiers. Vous progressez sur ce qui compte vraiment pour vous — pas sur des exercices fictifs. L'investissement est plus élevé, le retour opérationnel est immédiat.",
          },
          {
            q: "Combien faut-il de séances pour voir des résultats concrets ?",
            a: "La séance découverte à {{price:intervention-dirigeants|flat}} produit déjà un livrable utilisable en fin de journée. Un programme de plusieurs séances structure une montée en compétences sur 4 à 8 semaines selon le rythme choisi. Nous ne chiffrons pas de délai : le rythme est défini ensemble dès l'entretien de positionnement.",
          },
          {
            q: "Les séances sont-elles en présentiel à Nice / Sophia ou à distance ?",
            a: "Les deux sont disponibles. Présentiel dans vos locaux à Nice, Grand Arénas, Sophia Antipolis, Antibes ou Cannes. Distance en visio sécurisée. Le mix est défini en fonction de votre agenda et de votre préférence de travail.",
          },
          {
            q: "Mes données et mes dossiers restent-ils confidentiels pendant le coaching ?",
            a: "Oui. Confidentialité stricte dès la première séance. Les documents partagés pendant les ateliers sont traités exclusivement dans l'environnement de la séance, jamais stockés ni réutilisés. Conformité RGPD, modèles testés sur infra dédiée si souveraineté requise.",
          },
          {
            q: "Peut-on faire le coaching en anglais à Sophia Antipolis ?",
            a: "Oui. Le coaching est disponible en français, en anglais ou en format bilingue. Sophia Antipolis héberge de nombreux dirigeants et experts internationaux ; nous adaptons la langue dès l'entretien de positionnement.",
          },
          {
            q: "Que se passe-t-il si mon agenda de dirigeant impose un report de séance ?",
            a: "Aucun problème. Les séances se calent sur votre agenda, pas l'inverse. Un report anticipé est sans frais. Très tardif (moins de 24h) : participation partielle aux frais de blocage consultant. Le programme s'adapte à la réalité d'un agenda dirigeant.",
          },
        ],
        guarantees:
          "Tarif d'entrée fixe à {{price:intervention-dirigeants|flat}} pour la séance découverte : vous savez exactement ce que vous payez avant de réserver. Livrable utilisable remis à l'issue de chaque séance — pas de séance sans sortie concrète. Confidentialité stricte dès le démarrage, particulièrement adaptée aux dirigeants tourisme d'affaires et tech Sophia sensibles aux fuites stratégiques. À l'issue du programme, vous êtes autonome et libre d'utiliser vos compétences IA avec n'importe quel outil ou prestataire, sans contrat récurrent ni licence à renouveler.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Nice and Sophia Antipolis is an intensive individual programme designed for executives, managers and domain experts who want to master AI in their daily professional practice — without going through group training. Each session focuses on YOUR files, YOUR data, YOUR workflows. On-site in Nice, Grand Arénas, Sophia Antipolis, or remote at your pace. Entry rate from €990 excl. VAT.",
        whyHere: [
          "Nice and the Sophia Antipolis basin concentrate an exceptional density of executives and experts facing AI transformation: scale-up CEOs, Amadeus/IBM/SAP R&D CTOs, hospitality mid-cap directors, consulting firm partners.",
          "1-to-1 coaching adapts to highly specific profiles: an English-speaking director of an international subsidiary at Sophia, a CFO of a tourism mid-cap wanting to de-risk their P&L, a Nice SME MD wanting to act without a dedicated AI team.",
          "On-site sessions at your offices in Nice or Sophia Antipolis (Grand Arénas, Nice Méridia, Antibes, Cannes) or remote via secure video at your pace — no imposed schedule.",
          "Programme built on your reality: we work on your emails, your presentations, your dashboards, your client files — not fictional exercises. What you master by the end of the first session is usable the next morning.",
          "Bilingual French/English: coaching available in English for international subsidiary directors or Sophia Antipolis anglophone teams. No language barrier.",
          "No group, no imposed dates: 1-to-1 coaching fits your executive agenda, including outside standard hours or while travelling.",
        ],
        methodology: [
          {
            step: "Positioning interview",
            detail:
              "A 45-minute framing discussion (remote or on-site) to map your exact profile: sector, current AI level, priority objectives (productivity gains, decision-making, delegation, communication), desired pace and working language.",
          },
          {
            step: "Personalised learning plan",
            detail:
              "Based on the interview, we build a session programme calibrated on your operational reality: priority use cases from your sector (hospitality, Sophia IT, health, consulting), tools selected for your profile, pace adapted to your executive load.",
          },
          {
            step: "Practical sessions on your data",
            detail:
              "Each session (on-site or remote) alternates brief theory with a long practical workshop on YOUR data: pending emails, a report to draft, a client file analysis, a supplier brief. You leave with a usable deliverable produced in the session.",
          },
          {
            step: "Anchoring and progressive autonomy",
            detail:
              "Between sessions, short autonomous exercises on your real files to consolidate learning. Access to an asynchronous Q&A channel (text/audio) to unblock quickly without waiting for the next session.",
          },
          {
            step: "Review + continuation plan",
            detail:
              "At programme end, a synthesis of progress, list of mastered and configured tools, continuation recommendations (AI monitoring, next cases to address). You are autonomous — no Axion-IA dependency created.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME programme — custom quote",
            detail:
              "Several targeted sessions for an SME director or key manager (sales director, HR, CFO) wanting to build AI competence on their daily missions.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap executive programme — custom quote",
            detail:
              "Individual coaching for the CEO or N-1 of a hospitality mid-cap or Sophia Antipolis leadership wanting to steer their AI transformation in private, without exposing their agenda to a group.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Executive programme — custom quote",
            detail:
              "Confidential AI coaching for C-levels and Sophia R&D directors (Amadeus, IBM, SAP) or regional HQs wanting high-level, discrete, non-group support.",
          },
        ],
        testimonials: [
          {
            quote:
              "Three sessions were enough to transform how I prepare my executive committee meetings. I generate file summaries in minutes instead of half a day. Working on my real files made all the difference.",
            role: "Managing Director",
            companyProfile: "Independent Côte d'Azur hospitality mid-cap, 5 properties",
          },
          {
            quote:
              "Perfect format for a CTO always on the move. Remote sessions fitted around my agenda, working directly on our internal data pipelines. Result: I brought my team on board for two AI use cases in production the following month.",
            role: "CTO",
            companyProfile: "Sophia Antipolis tech scale-up, international R&D team",
          },
        ],
        faq: [
          {
            q: "What differentiates 1-to-1 coaching from group training in Nice?",
            a: "In a group, the pace is set to the average participant and cases are generic. In 1-to-1, every session works on YOUR files, YOUR emails, YOUR documents. You progress on what really matters to you — not fictional exercises. The investment is higher, the operational return is immediate.",
          },
          {
            q: "How many sessions does it take to see concrete results?",
            a: "The discovery session at €990 excl. VAT already produces a usable deliverable by the end of the day. A multi-session programme structures skill-building over 4 to 8 weeks depending on the chosen pace. We do not quote a specific timeline: the pace is defined together at the positioning interview.",
          },
          {
            q: "Are sessions on-site in Nice / Sophia or remote?",
            a: "Both are available. On-site at your offices in Nice, Grand Arénas, Sophia Antipolis, Antibes or Cannes. Remote via secure video. The mix is set based on your agenda and working preference.",
          },
          {
            q: "Does my data and my files remain confidential during coaching?",
            a: "Yes. Strict confidentiality ensured before the first session. Documents shared during workshops are processed exclusively within the session environment, never stored or reused. GDPR compliance, models tested on dedicated infra if sovereignty is required.",
          },
          {
            q: "Can coaching be done in English at Sophia Antipolis?",
            a: "Yes. Coaching is available in French, English or bilingual format. Sophia Antipolis hosts many international executives and experts; we adapt the language at the positioning interview.",
          },
          {
            q: "What if my executive agenda requires rescheduling a session?",
            a: "No problem. Sessions fit your agenda, not the other way around. An early reschedule is free of charge. Very late notice (under 24h): partial participation in blocked consultant slot cost. The programme adapts to the reality of an executive's schedule.",
          },
        ],
        guarantees:
          "Fixed entry rate at €990 excl. VAT for the discovery session: you know exactly what you pay before booking. Usable deliverable handed over at the end of each session — no session without a concrete output. Strict confidentiality ensured from kick-off. On-site travel expenses presented separately, never bundled in the rate. No lock-in: at programme end, you are autonomous and free to use your AI skills with any tool or provider.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Nice des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Nice, itérations à distance.",
        whyHere: [
          "Projets web & SaaS azuréens : tech & R&D de Sophia Antipolis (Amadeus, IBM, SAP Labs, EURECOM), recherche IA (3IA Côte d'Azur, INRIA), tourisme & hôtellerie premium, scale-ups French Tech Côte d'Azur.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "Tourisme & hôtellerie premium : sites multilingues, moteur de réservation, assistant et personnalisation — un levier clé sur la Côte d'Azur.",
        ],
        methodology: [
          {
            step: "Cadrage à Nice",
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
              "Conception ou refonte d'un site, d'une app ou d'un moteur de réservation avec UX/UI et IA intégrée, pour l'hôtellerie, le tourisme et les PME azuréennes.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier, travel-tech ou portail client sur mesure, IA intégrée, branchée sur votre SI (PMS, CRM, ERP, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Nice — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Vous gérez les sites tourisme & hôtellerie multilingues ?",
            a: "Oui, c'est un terrain naturel sur la Côte d'Azur : sites multilingues, moteur de réservation, assistant d'achat, recommandation et personnalisation, traduction IA (hreflang propre). Branché sur votre PMS/CRM. Hébergement UE, RGPD strict.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région niçoise ou repris en interne.",
      },
      en: {
        hero: "In Nice, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Nice kick-off, remote iterations.",
        whyHere: [
          "French Riviera web & SaaS projects: Sophia Antipolis tech & R&D (Amadeus, IBM, SAP Labs, EURECOM), AI research (3IA Côte d'Azur, INRIA), premium tourism & hospitality, French Tech Côte d'Azur scale-ups.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Premium tourism & hospitality: multilingual sites, booking engine, assistant and personalisation — a key lever on the French Riviera.",
        ],
        methodology: [
          {
            step: "Scoping in Nice",
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
              "Design or rebuild of a site, app or booking engine with UX/UI and built-in AI, for hospitality, tourism and Riviera SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business, travel-tech or customer portal platform, AI built in, wired into your IS (PMS, CRM, ERP, datalake).",
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
            a: "Yes. We design the full experience in Nice — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Do you handle multilingual tourism & hospitality sites?",
            a: "Yes, a natural fit on the French Riviera: multilingual sites, booking engine, shopping assistant, recommendation and personalisation, AI translation (clean hreflang). Wired to your PMS/CRM. EU hosting, strict GDPR.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Nice-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Nice ?",
      a: "Quatre paliers tarifaires publics couvrent toutes les configurations niçoises et azuréennes — Sur place pour les PME indépendantes du Vieux-Nice ou de la Promenade, Ciblé pour les PME hôtellerie premium et services Côte d'Azur, Stratégique PME pour les scale-ups Sophia Antipolis et acteurs French Tech, Stratégique ETI pour les groupes hôteliers, opérateurs tourisme d'affaires et grandes tech de Sophia. La grille appliquée à Nice est strictement identique à celle de Paris ou Lyon — aucune pondération PACA.",
    },
    {
      q: "Intervenez-vous à Sophia Antipolis depuis Nice ?",
      a: "Oui. Sophia Antipolis est à 20 km de Nice-Ville, une distance de travail courante pour nos consultants. Nous couvrons l'ensemble du bassin métropolitain : Grand Arénas, Nice Méridia, Sophia Antipolis, Antibes, Cannes, Grasse et Menton. Tous les formats (audit, intervention, implémentation) sont disponibles en présentiel sur ce périmètre.",
    },
    {
      q: "Quels secteurs sont prioritaires à Nice et sur la Côte d'Azur ?",
      a: "Nos déploiements azuréens couvrent en priorité le tourisme d'affaires et l'hôtellerie premium, l'IT et les structures tech de Sophia Antipolis (Amadeus, IBM, SAP, EURECOM et leurs sous-traitants), la santé et la biotech (Eurobiomed, INSERM Nice), les services aux entreprises et le conseil. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Proposez-vous des sessions en anglais pour les équipes internationales de Sophia Antipolis ?",
      a: "Oui. Nous animons des sessions en français, en anglais ou bilingues selon la composition de vos équipes. Sophia Antipolis héberge des équipes internationales de nombreuses entreprises tech mondiales ; la langue de session est un pré-requis intégré dès le cadrage.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux niçois ou à Sophia Antipolis ?",
      a: "Oui. Toutes nos interventions sont par défaut sur site dans vos locaux. Nos consultants couvrent Nice centre, Grand Arénas, Nice Méridia, Sophia Antipolis, Antibes et Cannes. Les ateliers d'idéation et les restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "Travaillez-vous avec les startups et scale-ups de la French Tech Côte d'Azur ?",
      a: "Oui. Nous accompagnons les startups et scale-ups issues de la French Tech Côte d'Azur, du CEEI Nice, de Telecom Valley et des incubateurs Sophia. Notre offre est calibrée pour les structures avec un product-market fit établi qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
