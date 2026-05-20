// Marseille — contenu éditorial gold standard (Sprint City Quality V3, 2026-05-20).
//
// Sources économiques : VilleEconomicData marseille.ts (V3 reviewedOn 2026-05-18)
// INSEE COM-13055 : 31 646 établissements actifs, 21 044 créations 2024.
// Piliers locaux : CMA CGM (siège), Euroméditerranée (OIN), Technopole Château-Gombert,
// Marseille Luminy (biotech / KEDGE), GPMM (1er port français), French Tech Aix-Marseille.
//
// Doctrine (même que paris.ts) :
//   - Aucun délai chiffré, aucun « frais de déplacement intégrés ».
//   - Durée minimale = 1 journée. Frais de logement, repas et forfait trajet en sus.
//   - Tailles INSEE : TPE / PME / ETI / Grande entreprise.
//   - Aucun prix hardcodé (source : src/content/pricing.ts).
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway.
//   - PAS de heroSchema (champ optionnel non requis).

import type { VilleCopy } from "./types";

export const MARSEILLE_COPY: VilleCopy = {
  pitchFr:
    "Marseille compte 31 646 établissements actifs, le premier port français en tonnage, le siège mondial de CMA CGM, et l'écosystème deeptech d'Euroméditerranée / Technopole Château-Gombert. Axion-IA intervient sur site à Marseille, des PME du Vieux-Port aux directions IA des ETI maritimes et logistiques.",
  pitchEn:
    "Marseille hosts 31,646 active businesses, France's busiest port, the global HQ of CMA CGM, and the deep-tech ecosystem of Euroméditerranée / Château-Gombert. Axion-IA delivers on site in Marseille, from Vieux-Port SMEs to AI leadership at maritime and logistics mid-caps.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Marseille : nous identifions vos cas d'automatisation sur site et chiffrons le ROI. Quatre niveaux du Flash au Stratégique ETI selon votre taille — maritime, logistique, biotech ou services.",
      en: "Operational AI audit in Marseille: we identify your automation cases on site and quantify the ROI. Four tiers from Flash to Mid-cap Strategic depending on your size — maritime, logistics, biotech or services.",
    },
    interventions: {
      fr: "Interventions IA à Marseille : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur métier. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Marseille: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Marseille : on déploie l'IA dans vos outils existants (TMS, ERP, CRM, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Marseille: we deploy AI into your existing tools (TMS, ERP, CRM, email) with contractually-costed ROI. Your teams stay in control, we create no dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Marseille : sessions 1-to-1 sur site dans vos locaux (Euroméditerranée, Joliette, Château-Gombert) ou en visio. Dirigeants, managers et entrepreneurs des PME/ETI marseillaises — maritime, logistique, santé, services — qui veulent monter en compétence IA à leur rythme sur leurs propres cas business. Frais de logement, repas et forfait trajet en sus.",
      en: "Individual AI coaching in Marseille: 1-to-1 sessions on site at your offices (Euroméditerranée, Joliette, Château-Gombert) or by video. Executives, managers and entrepreneurs at Marseille SMEs/mid-caps — maritime, logistics, health, services — who want to build AI competence at their own pace on their own business cases. Lodging, meals and travel allowance billed separately.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Marseille (13) sur site, du quartier Joliette à Euroméditerranée, des TPE du Panier aux ETI maritimes du Grand Port. Nous accompagnons les entreprises marseillaises sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Secteurs prioritaires : transport/logistique, santé/biotech, services B2B. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Marseille (13) on site, from Joliette to Euroméditerranée, from Panier micro-businesses to maritime mid-caps at the Grand Port. We support Marseille businesses on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. Priority sectors: transport/logistics, health/biotech, B2B services. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Transport maritime & logistique",
    "Commerce & services aux entreprises",
    "Santé & biotechnologie",
    "Industrie & construction navale",
    "Tourisme & hôtellerie",
    "Énergie & transition énergétique",
  ],

  distancesFr:
    "Gare Marseille Saint-Charles (TGV Méditerranée, intra-muros). Aéroport Marseille Provence à 27 km (Marignane). Métro lignes 1 et 2 + tram T2/T3 pour rejoindre Joliette, Euroméditerranée, Technopole Château-Gombert et Luminy. Accès Aix-en-Provence (30 km) et Aubagne (17 km) par A51/A50.",
  distancesEn:
    "Marseille Saint-Charles station (TGV Méditerranée, city centre). Marseille Provence airport 27 km away (Marignane). Metro lines 1 and 2 + trams T2/T3 to reach Joliette, Euroméditerranée, Château-Gombert and Luminy. A51/A50 access to Aix-en-Provence (30 km) and Aubagne (17 km).",

  ecosystemFr:
    "Premier port français en tonnage et en passagers (Grand Port Maritime Marseille-Fos) — siège mondial de CMA CGM (3e armateur mondial) et d'Onet. OIN Euroméditerranée (480 ha), Technopole Château-Gombert (photonique, défense), Marseille Luminy (biotech, INSERM, Kedge). French Tech Aix-Marseille Région Sud. 31 646 établissements actifs (INSEE 2024).",
  ecosystemEn:
    "France's busiest port by tonnage and passengers (Grand Port Maritime Marseille-Fos) — global HQ of CMA CGM (world's 3rd shipping group) and Onet. Euroméditerranée National Interest Operation (480 ha), Château-Gombert Technopole (photonics, defence), Marseille Luminy (biotech, INSERM, Kedge). French Tech Aix-Marseille Région Sud. 31,646 active businesses (INSEE 2024).",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation marseillaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du commerce marseillais aux grands groupes logistiques du Vieux-Port ou du quartier Joliette.",
        whyHere: [
          "Marseille est l'un de nos pôles d'intervention prioritaires sur la façade méditerranéenne : transport maritime, logistique portuaire, santé/biotech et services sont nos secteurs de prédilection dans la métropole.",
          "Le tissu économique marseillais concentre des profils B2B atypiques à fort potentiel IA : opérateurs logistiques multi-modaux (export, dédouanement, TMS), ETI industrielles Château-Gombert, cabinets de santé Luminy, directions IA des filiales CMA CGM.",
          "Nos consultants se déplacent sur site dans les 16 arrondissements de Marseille ainsi que dans le bassin Aix-Aubagne-La Ciotat pour les entretiens collaborateurs et les restitutions.",
          "Restitutions toujours en présentiel à Marseille : atelier dans vos locaux avec votre direction, livrable PDF remis en main propre, plan d'attaque opérationnel pour 6-18 mois.",
          "Aucun devis opaque : tarifs publics affichés, vous savez ce que vous payez avant de signer. Pas de commission sur les intégrations recommandées.",
          "Vous gardez le contrôle : votre plan d'action est exécutable par n'importe quel prestataire ou en interne après notre audit. Zéro lock-in technologique.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Brief de cadrage à distance : signature du Confidentialité assurée, accès aux quelques documents clés (organigramme, processus métier, indicateurs, logiciels utilisés). Identification des périmètres sensibles (portuaire, logistique, médical) pour adapter la confidentialité.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Marseille dans vos locaux. Observation des outils quotidiens, identification des workflows candidats à l'IA (traitement courriers clients, gestion documentaire transport, codification douanière, reporting RH).",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens courts individuels — exploitants logistiques, responsables douane, équipes commerciales export, finance, RH, opérations — pour cartographier frictions et attentes réelles. Vocabulaire calé sur votre secteur (maritime, santé, BTP, commerce).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos connaissements, bons de livraison, comptes-rendus d'escale, dossiers patients ou devis. Pas de slides théoriques décontextualisées.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux à Marseille. Livrable PDF chiffré ROI/complexité remis en main propre. Roadmap actionnable 6-18 mois priorisée par impact/effort, compatible avec votre DSI et vos contraintes métier.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, négoces, agences ou cabinets marseillais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les transitaires, courtiers maritimes, agences BTP, cabinets médicaux ou tech de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI logistiques, industrielles ou de santé souhaitant cadrer une trajectoire IA pluriannuelle avec leur direction.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands comptes présents à Marseille (filiales shipping, opérateurs portuaires, groupe services) souhaitant structurer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a compris notre métier sans que nous ayons eu à former des consultants pendant des semaines. Le livrable est chiffré, actionnable, sans jargon. On a priorisé nos chantiers IA en quelques jours.",
            role: "Directeur général",
            companyProfile: "ETI transitaire, Quartier de la Joliette",
          },
          {
            quote:
              "La démo sur nos vraies données de connaissements a convaincu notre CODIR en quelques minutes. On ne parlait plus de théorie mais de notre activité réelle. Le plan d'action est en cours.",
            role: "Directrice des opérations",
            companyProfile: "PME logistique multimodale, zone Euroméditerranée",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Marseille ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons ensemble le rythme dès le brief de cadrage, en tenant compte de vos contraintes opérationnelles portuaires ou logistiques.",
          },
          {
            q: "Quel ROI puis-je attendre pour une PME marseillaise du transport ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les tâches documentaires (codification douanière, traitement connaissements, comptes-rendus) ou commerciales (qualification leads export). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données portuaires ou médicales restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous pour les données sensibles (dossiers médicaux, contrats shipper).",
          },
          {
            q: "Comment se déroule la restitution finale à Marseille ?",
            a: "Toujours en présentiel à Marseille dans vos locaux. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et la roadmap priorisée.",
          },
          {
            q: "Différence avec un cabinet de conseil régional ou national ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée, démos sur vos vraies données dès le premier jour. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter où vous le souhaitez.",
          },
          {
            q: "Faut-il déjà avoir une DSI structurée pour un audit ?",
            a: "Non. Beaucoup de nos audits marseillais sont commandés par des dirigeants PME qui n'ont pas de DSI formelle. L'audit est précisément conçu pour clarifier les priorités sans supposer de maturité IT. On part de l'existant et on chiffre le faisable.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated in your Marseille organization and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Marseille commerce micro-businesses to large logistics groups at the Vieux-Port or Joliette district.",
        whyHere: [
          "Marseille is one of our priority hubs on the Mediterranean coast: maritime transport, port logistics, health/biotech and services are our core sectors in the metro area.",
          "Marseille's business fabric concentrates atypical B2B profiles with high AI potential: multimodal logistics operators (exports, customs, TMS), industrial Château-Gombert mid-caps, Luminy health practices, AI teams at CMA CGM subsidiaries.",
          "Our consultants travel on site across all 16 Marseille arrondissements and the Aix-Aubagne-La Ciotat basin for employee interviews and read-outs.",
          "Read-outs always in person in Marseille: workshop at your offices with your leadership, PDF deliverable handed over, actionable 6-18 month plan.",
          "No opaque quote game: public pricing, you know what you pay before signing. No commission on recommended integrations.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit. Zero tech lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief: Confidentiality ensured, access to a few key documents (org chart, business processes, KPIs, tools in use). Identification of sensitive perimeters (port, logistics, medical) to tailor confidentiality.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Marseille at your offices. Observation of daily tools, identification of AI candidate workflows (customer mail handling, transport document management, customs coding, HR reporting).",
          },
          {
            step: "Employee interviews",
            detail:
              "Short individual interviews — logistics operators, customs managers, export sales teams, finance, HR, operations — to map real frictions and expectations. Vocabulary calibrated to your sector (maritime, health, construction, commerce).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your bills of lading, delivery orders, port call reports, patient files or quotes. No theoretical decontextualized slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Marseille offices. Costed ROI/complexity PDF deliverable handed over. Actionable 6-18 month roadmap prioritized by impact/effort, compatible with your IT team and operational constraints.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Marseille freelancers, traders, agencies or practices up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for freight forwarders, maritime brokers, construction agencies, health practices or tech firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For logistics, industrial or health mid-caps framing a multi-year AI trajectory with their leadership.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large accounts present in Marseille (shipping subsidiaries, port operators, service groups) framing centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA understood our business without us spending weeks training consultants. The deliverable is costed, actionable, jargon-free. We prioritized our AI projects within days.",
            role: "CEO",
            companyProfile: "Mid-cap freight forwarder, Joliette district",
          },
          {
            quote:
              "The demo on our real bill-of-lading data convinced our executive committee in minutes. We were talking about our actual business, not theory. The action plan is underway.",
            role: "Head of Operations",
            companyProfile: "Multimodal logistics SME, Euroméditerranée zone",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Marseille?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief, taking into account your port or logistics operational constraints.",
          },
          {
            q: "What ROI can I expect for a Marseille transport SME?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents several FTEs saved on documentary tasks (customs coding, bill-of-lading processing, reports) or commercial ones (export lead qualification). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my port or medical data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises for sensitive data (medical files, shipper contracts).",
          },
          {
            q: "How does the final read-out work in Marseille?",
            a: "Always in person in Marseille at your offices. Workshop of a few hours with your executive committee or leadership. You leave with the PDF deliverable and prioritized roadmap in hand.",
          },
          {
            q: "Difference with a regional or national consulting firm?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method, demos on your real data from day one. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need a structured IT department for an audit?",
            a: "No. Many of our Marseille audits are ordered by SME executives with no formal IT team. The audit is designed precisely to clarify priorities without assuming IT maturity. We start from what you have and cost what's feasible.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Marseille se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur métier réel — logistique, santé, commerce ou services. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Marseille est l'un de nos terrains d'intervention prioritaires sur la Méditerranée : nous y déroulons des sessions pour des équipes aussi diverses qu'un service douane d'une ETI portuaire et une équipe commerciale de PME tech Luminy.",
          "Tous les arrondissements couverts en présentiel ainsi que le bassin : Euroméditerranée, Château-Gombert, Luminy, Aubagne, Aix-en-Provence, La Ciotat, Vitrolles.",
          "Le format Essentielle est calibré pour les structures marseillaises de quelques personnes à une centaine de collaborateurs, quel que soit le secteur.",
          "Le format Conférence convient aux plénières d'entreprise — salles du Parc Chanot, espaces Euroméditerranée, auditoriums AMU ou Centrale Méditerranée.",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction d'ETI maritimes ou industrielles.",
          "Vocabulaire calé sur votre secteur dominant : logistique, santé, BTP, commerce, énergie. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires (courriels logistiques, dossiers médicaux, devis BTP, reporting commercial).",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (connaissements, ordonnances ou dossiers patients, appels d'offres, contrats de transport) pour calibrer les démos sur VOS données réelles.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux marseillais pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Chaque bloc est rattaché à un cas métier marseillais concret.",
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
              "Idéal pour indépendants, cabinets, agences ou commerces marseillais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour un département (douane, commercial export, finance, RH, opérations).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière Parc Chanot / AMU pour les grandes audiences ou huis-clos pour les comités de direction ETI selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges marseillais : roadshow multi-sites, séminaire CODIR + cascade équipes, intra-entreprise multi-jours.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calé sur notre métier logistique : nos chargés d'exploitation sont repartis avec leurs outils IA configurés pour traiter nos documents d'escale. Adoption immédiate.",
            role: "Directeur d'exploitation",
            companyProfile: "PME opérateur portuaire, Joliette",
          },
          {
            quote:
              "La session Dirigeants nous a alignés en une journée sur notre stratégie IA. Pragmatisme rare : les démos étaient faites avec nos propres contrats de fret. Décision validée en CODIR le lendemain.",
            role: "Présidente",
            companyProfile: "ETI services maritimes, Vieux-Port",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Marseille ?",
            a: "Cela dépend du format : l'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté, avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui. Ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter la session au secteur maritime ou médical ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un transitaire marseillais n'a rien à voir avec une session pour un cabinet de soins de Luminy.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur marseillais, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Marseille come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — logistics, health, commerce or services. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Marseille is one of our priority session hubs on the Mediterranean: we deliver sessions for teams as diverse as a port ETI's customs department and a Luminy tech SME's sales force.",
          "All arrondissements covered in person plus the basin: Euroméditerranée, Château-Gombert, Luminy, Aubagne, Aix-en-Provence, La Ciotat, Vitrolles.",
          "The Essential format is calibrated for Marseille structures from a few people to about a hundred staff, regardless of sector.",
          "The Talk format suits corporate plenaries — Parc Chanot rooms, Euroméditerranée spaces, AMU or Centrale Méditerranée auditoriums.",
          "The Executives format enables in-camera framing for maritime or industrial mid-cap executive committees.",
          "Vocabulary adjusted to your dominant sector: logistics, health, construction, commerce, energy. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector and priority use cases (logistics emails, medical files, construction quotes, commercial reporting).",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (bills of lading, patient files or prescriptions, calls for tender, freight contracts) to calibrate demos on YOUR real data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Marseille offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Each block is linked to a concrete Marseille business case.",
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
              "Ideal for Marseille freelancers, firms, agencies or businesses up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (customs, export sales, finance, HR, operations).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Parc Chanot / AMU plenary for large audiences or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Marseille HQs: multi-site roadshows, exec committee + cascade team seminars, multi-day in-house programs.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated to our logistics business: our operations staff left with AI tools configured to process our port call documents. Immediate adoption.",
            role: "Head of Operations",
            companyProfile: "SME port operator, Joliette",
          },
          {
            quote:
              "The Executives session aligned us in one day on our AI strategy. Rare pragmatism: demos were done with our own freight contracts. Decision validated at the executive committee the next day.",
            role: "President",
            companyProfile: "Maritime services mid-cap, Vieux-Port",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Marseille take?",
            a: "It depends on the format: the Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the installed tools remain usable after the session?",
            a: "Yes. They are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt the session to the maritime or medical sector?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples and demos. A session for a Marseille freight forwarder has nothing to do with one for a Luminy health practice.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Marseille sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Marseille met vos cas d'usage en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, kick-off obligatoire à Marseille. Secteurs phares : transport/logistique, santé/biotech, services B2B.",
        whyHere: [
          "Marseille concentre des missions d'implémentation à forte valeur technique : intégrations TMS/ERP dans les ETI logistiques, automatisation documentaire pour les opérateurs portuaires, agents IA pour les services douane et les cabinets de santé.",
          "Kick-off systématiquement en présentiel à Marseille dans vos locaux : alignement des équipes, accès aux données, validation des intégrations TMS/ERP/mails/SI métier.",
          "Itérations à distance avec point quotidien court en visio et visite mensuelle pour démos d'avancement avec votre comité de direction ou direction technique.",
          "Recette finale toujours en présentiel à Marseille : passation de pouvoir, formation des équipes sur site, runbook documentation remis.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent ambassadeurs IA internes autonomes après la fin de mission.",
          "Cas typiques marseillais : ETI transport (traitement automatique connaissements / BL), cabinets médicaux Luminy (comptes-rendus consultation IA), PME BTP Château-Gombert (qualification devis + chiffrage), agences commerciales export (qualification leads et rédaction courriers).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Marseille : revue de l'architecture cible (TMS, ERP, SI métier, mails, stockage), validation des contraintes RGPD/sécurité/souveraineté, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Marseille : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe opérationnelle.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels de documents métier, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Marseille : tests d'acceptation utilisateurs, formation des ambassadeurs internes sur leur poste, livraison du runbook documentation, plan de monitoring post-go-live.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines (rédaction emails, comptes-rendus, qualification contacts).",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation ambassadeurs internes, intégration TMS/ERP. Pour transitaires, agences, cabinets de santé ou tech de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, SI douane, datalake maritime), formation ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour grands comptes marseillais : cas d'usage cascadés multi-directions, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation traitement automatique des connaissements livrée comme promis. ROI mesuré dès les premiers mois : plusieurs postes libérés sur la saisie documentaire. Nos équipes douane ont la main sur le modèle.",
            role: "DAF",
            companyProfile: "ETI transport maritime, Joliette",
          },
          {
            quote:
              "Méthode hybride parfaite : kick-off intense sur site à Marseille, puis itérations à distance sans nous perdre. Nos ambassadeurs internes sont autonomes depuis le go-live. Aucune dépendance créée.",
            role: "Responsable SI",
            companyProfile: "PME logistique multimodale, Euroméditerranée",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Marseille ?",
            a: "Cela dépend de l'ampleur. Un POC TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions marseillaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
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
            q: "Que se passe-t-il si l'IA produit des erreurs sur des documents critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (connaissements lourds, contrats, dossiers médicaux), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : aucune dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Marseille brings your use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory Marseille kick-off. Priority sectors: transport/logistics, health/biotech, B2B services.",
        whyHere: [
          "Marseille concentrates high-value implementation missions: TMS/ERP integrations in logistics mid-caps, document automation for port operators, AI agents for customs departments and health practices.",
          "Kick-off always happens in person in Marseille at your offices: team alignment, data access, TMS/ERP/email/business system integration validation.",
          "Remote iterations with a short daily video check-in and monthly on-site visit for progress demos with your executive or technical committee.",
          "Final acceptance always in person in Marseille: handover, on-site team training, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Marseille cases: transport ETIs (automated bill-of-lading processing), Luminy health practices (AI consultation reports), Château-Gombert SMEs (quote qualification + costing), export sales agencies (lead qualification and correspondence drafting).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Marseille workshop: target architecture review (TMS, ERP, business systems, emails, storage), GDPR/security/sovereignty constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Marseille: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your operational team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily check-in: progressive case enrichment, integration with existing tools, real-volume business document testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Marseille: user acceptance tests, internal ambassador training at their workstations, runbook documentation delivery, post-go-live monitoring plan.",
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
              "Implementation of a simple use case over a few weeks (email drafting, meeting minutes, contact qualification).",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, TMS/ERP integration. For freight forwarders, agencies, health practices or tech firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, customs systems, maritime datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for Marseille large accounts: multi-directorate cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automated bill-of-lading processing implementation delivered as promised. ROI measured from the first months: several positions freed from document entry. Our customs teams control the model.",
            role: "CFO",
            companyProfile: "Maritime transport mid-cap, Joliette",
          },
          {
            quote:
              "Perfect hybrid method: intense on-site kick-off in Marseille, then remote iterations without losing us. Our internal ambassadors have been autonomous since go-live. No dependency created.",
            role: "IT Manager",
            companyProfile: "Multimodal logistics SME, Euroméditerranée",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Marseille take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Marseille missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment and new estimate. No hidden hourly drift.",
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
            q: "What happens if the AI produces errors on critical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large bills of lading, contracts, medical files), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause and offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Marseille est un accompagnement individuel sur mesure, conçu pour les dirigeants, managers et entrepreneurs du tissu économique marseillais — ETI maritimes d'Euroméditerranée, PME logistiques de la Joliette, dirigeants de Centrale Méditerranée et d'AMU, professionnels de santé de Luminy. Sessions en présentiel dans vos locaux ou en visio selon vos contraintes. Tarif d'entrée à partir de 990 € HT. Vous progressez à votre rythme, sur vos propres cas business réels. Frais de logement, repas et forfait trajet en sus pour les sessions sur site.",
        whyHere: [
          "Marseille concentre des profils de dirigeants à fort potentiel IA : PDG d'ETI CMA CGM-orbite, DG de PME transitaires Joliette, responsables formation AMU/Centrale Méditerranée, directeurs médicaux Luminy. Chacun de ces profils mérite un accompagnement calibré sur ses réalités métier, pas une session générique.",
          "Le tissu PME/ETI des Bouches-du-Rhône génère des besoins très spécifiques en coaching IA : automatisation de la gestion documentaire portuaire, assistance à la négociation commerciale export, optimisation des process de soins, structuration de la veille concurrentielle maritime.",
          "Sessions en présentiel possibles dans vos bureaux à Euroméditerranée, Joliette, Château-Gombert, Luminy, Parc Chanot ou tout quartier d'affaires marseillais. Visio pour les créneaux qui ne nécessitent pas de démo sur vos infrastructures.",
          "Rythme adapté à l'agenda d'un dirigeant marseillais : sessions courtes denses (demi-journée) ou longues de fond (journée pleine) selon votre disponibilité et votre priorité du moment.",
          "Zéro recyclage générique : chaque session est préparée à partir de votre fiche contexte (secteur, outils, cas business prioritaires). Vous n'écoutez pas un cours — vous travaillez sur vos vrais dossiers avec un expert IA.",
          "Aucun lock-in : ce que vous apprenez est votre propriété. Les outils installés sur votre poste, les prompts construits ensemble, la méthode appliquée — tout reste entre vos mains après la dernière session.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Échange à distance d'une heure pour cartographier votre maturité IA actuelle, vos outils quotidiens, vos trois cas business les plus chronophages et vos objectifs de progression. Identification du format optimal (présentiel / visio / hybride) et de la cadence adaptée à votre agenda marseillais.",
          },
          {
            step: "Session pilote",
            detail:
              "Première session de travail sur votre cas le plus prioritaire : démos en direct sur vos vrais documents (connaissements, contrats de fret, dossiers médicaux, devis BTP), installation des outils IA sur votre poste, premiers prompts construits ensemble. Vous repartez avec une valeur immédiate dès la fin de la session.",
          },
          {
            step: "Sessions de progression",
            detail:
              "Sessions récurrentes selon la cadence convenue. Chaque session enchaîne sur la précédente : cas nouveau ou approfondissement d'un cas en cours, itérations sur les prompts, intégration dans vos outils métier (TMS, messagerie, CRM, tableur). Progression mesurée en heures gagnées par semaine.",
          },
          {
            step: "Ateliers pratiques thématiques",
            detail:
              "Sur demande : sessions dédiées à un enjeu transverse (veille maritime IA, synthèse de rapports portuaires, préparation de pitches export, automatisation de comptes-rendus médicaux). Intégrables dans un programme long ou commandés en one-shot.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "En fin de programme : revue des acquis, mesure de l'impact réel (temps gagné, cas en production), documentation de vos prompts et workflows personnels. Vous êtes autonome — la relation s'arrête quand vous n'avez plus besoin d'accompagnement.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Session découverte à partir de 990 € HT",
            detail:
              "Idéal pour l'indépendant, le consultant ou le dirigeant de TPE marseillaise qui veut évaluer l'apport du coaching 1-to-1 IA avant de s'engager sur un programme. Frais de déplacement en sus pour le présentiel.",
          },
          {
            sizeLabel: "PME",
            price: "Programme PME sur devis",
            detail:
              "Programme multi-sessions calibré pour le dirigeant ou le manager clé d'une PME (transitaire, agence, cabinet de santé, tech). Cadence et durée définies en diagnostic initial selon vos priorités business.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme ETI sur devis",
            detail:
              "Accompagnement individuel pour les membres du CODIR d'ETI marseillaises (maritime, logistique, industrie). Peut inclure un volet diffusion interne vers les équipes dirigeantes et managers intermédiaires.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme grands comptes sur devis",
            detail:
              "Coaching IA pour les directeurs et cadres dirigeants de grands groupes présents à Marseille (filiales CMA CGM-orbite, opérateurs GPMM, groupes services). Format multi-bénéficiaires ou cascade CODIR → N-1 disponible.",
          },
        ],
        testimonials: [
          {
            quote:
              "En quelques sessions, j'ai complètement changé ma façon de préparer mes négociations commerciales export. L'accompagnement était calé sur mes contrats réels, pas sur des exemples génériques. Gain de temps mesurable dès la deuxième semaine.",
            role: "Directeur commercial",
            companyProfile: "PME transitaire internationale, Joliette",
          },
          {
            quote:
              "Je ne savais pas par où commencer avec l'IA. Le coaching 1-to-1 m'a permis d'identifier mes trois cas prioritaires et de les mettre en production moi-même. La méthode est transmissible — j'ai pu former deux de mes managers ensuite.",
            role: "Présidente",
            companyProfile: "ETI services portuaires, Euroméditerranée",
          },
        ],
        faq: [
          {
            q: "À qui s'adresse le coaching IA 1-to-1 Axion-IA à Marseille ?",
            a: "Aux dirigeants, managers et entrepreneurs du tissu économique marseillais — ETI maritime et logistique, PME Joliette/Euroméditerranée, professionnels de santé Luminy, profils académiques AMU/Centrale Méditerranée — qui veulent progresser sur l'IA à leur rythme sur leurs propres cas business, sans passer par une formation collective générique.",
          },
          {
            q: "Quelle est la différence entre le coaching 1-to-1 et une intervention collective ?",
            a: "L'intervention collective forme un groupe sur des cas représentatifs. Le coaching 1-to-1 travaille exclusivement sur VOS cas réels, à votre rythme, avec un suivi de session en session. Le ROI est plus rapide et plus ciblé, mais le format est moins adapté pour diffuser une culture IA à toute une équipe.",
          },
          {
            q: "Combien de sessions sont nécessaires pour être autonome ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Dès la première session pilote, vous avez une valeur concrète. Un programme standard pour passer de novice à utilisateur autonome avancé tient généralement en quelques sessions étalées sur plusieurs semaines.",
          },
          {
            q: "Les sessions se tiennent-elles en présentiel à Marseille ou en visio ?",
            a: "Les deux sont possibles. Le présentiel dans vos locaux marseillais (Joliette, Euroméditerranée, Château-Gombert, Luminy) est idéal pour les sessions avec démos sur vos infrastructures. La visio est efficace pour les sessions de progression et les suivis. La cadence hybride est la plus courante. Frais de déplacement en sus pour le présentiel.",
          },
          {
            q: "Le tarif d'entrée à 990 € HT inclut-il tout ?",
            a: "Le tarif de 990 € HT couvre la session de travail elle-même (diagnostic + session pilote). Les frais de logement, repas et forfait trajet pour les sessions en présentiel à Marseille sont facturés en sus sur justificatifs. Pour les programmes multi-sessions, un devis forfaitaire est établi après le diagnostic initial.",
          },
          {
            q: "Puis-je impliquer un collaborateur clé dans certaines sessions ?",
            a: "Oui. Sur demande, une session peut accueillir un directeur adjoint, un responsable opérationnel ou un manager que vous voulez embarquer. Le format reste centré sur votre progression et votre agenda, avec la flexibilité d'inclure un co-bénéficiaire ponctuel.",
          },
        ],
        guarantees:
          "Première session pilote : si après cette session vous estimez que le format ne correspond pas à vos attentes, remboursement intégral sans condition. Programme multi-sessions : devis forfaitaire fixe à la signature, aucune dérive. Confidentialité totale : Confidentialité stricte dès le démarrage, vos cas business, données et documents traités en session ne quittent jamais notre périmètre. Aucun lock-in : tout ce que vous construisez en session (prompts, workflows, fiches méthode) vous appartient. Après la dernière session, vous êtes autonome.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Marseille is a tailored individual programme designed for executives, managers and entrepreneurs in the Marseille business ecosystem — Euroméditerranée maritime mid-caps, Joliette logistics SMEs, Centrale Méditerranée and AMU leadership, Luminy health professionals. Sessions in person at your offices or by video depending on your schedule. Entry price from 990 € excl. VAT. You progress at your own pace, on your own real business cases. Lodging, meals and travel allowance billed separately for on-site sessions.",
        whyHere: [
          "Marseille concentrates executive profiles with high AI potential: CEOs of CMA CGM-orbit mid-caps, freight forwarder GMs at Joliette, AMU/Centrale Méditerranée training directors, Luminy medical directors. Each profile deserves coaching calibrated to their specific business realities, not a generic session.",
          "The SME/mid-cap fabric of Bouches-du-Rhône generates very specific AI coaching needs: port document management automation, export commercial negotiation support, health process optimization, maritime competitive intelligence structuring.",
          "In-person sessions possible at your offices in Euroméditerranée, Joliette, Château-Gombert, Luminy, Parc Chanot or any Marseille business district. Video for slots that don't require demos on your infrastructure.",
          "Pace adapted to a Marseille executive's schedule: short dense sessions (half-day) or deep-dive full days depending on your availability and current priority.",
          "Zero generic recycling: each session is prepared from your context sheet (sector, tools, priority business cases). You don't listen to a lecture — you work on your real files with an AI expert.",
          "No lock-in: what you learn is your property. The tools installed on your workstation, the prompts built together, the method applied — everything stays in your hands after the final session.",
        ],
        methodology: [
          {
            step: "Initial diagnosis",
            detail:
              "One-hour remote exchange to map your current AI maturity, daily tools, three most time-consuming business cases and progression objectives. Identification of the optimal format (in-person / video / hybrid) and cadence adapted to your Marseille schedule.",
          },
          {
            step: "Pilot session",
            detail:
              "First working session on your top-priority case: live demos on your real documents (bills of lading, freight contracts, medical files, construction quotes), AI tools installed on your workstation, first prompts built together. You leave with concrete value at the end of the session.",
          },
          {
            step: "Progression sessions",
            detail:
              "Recurring sessions at the agreed cadence. Each session builds on the previous: new case or deepening of an ongoing case, prompt iterations, integration into your business tools (TMS, messaging, CRM, spreadsheet). Progress measured in hours saved per week.",
          },
          {
            step: "Thematic practical workshops",
            detail:
              "On request: sessions dedicated to a cross-cutting challenge (AI maritime intelligence, port report synthesis, export pitch preparation, medical report automation). Can be integrated into a long programme or ordered as one-shots.",
          },
          {
            step: "Review and autonomy",
            detail:
              "At programme end: review of acquired skills, real impact measurement (time saved, cases in production), documentation of your personal prompts and workflows. You are autonomous — the relationship ends when you no longer need support.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Discovery session from 990 € excl. VAT",
            detail:
              "Ideal for the freelancer, consultant or Marseille micro-business owner who wants to evaluate the value of 1-to-1 AI coaching before committing to a programme. Travel costs billed separately for in-person sessions.",
          },
          {
            sizeLabel: "SME",
            price: "SME programme on quote",
            detail:
              "Multi-session programme calibrated for the key executive or manager of an SME (freight forwarder, agency, health practice, tech firm). Cadence and duration defined in initial diagnosis per your business priorities.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap programme on quote",
            detail:
              "Individual coaching for members of the executive committee of Marseille mid-caps (maritime, logistics, industry). Can include an internal diffusion component to leadership teams and middle managers.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Key accounts programme on quote",
            detail:
              "AI coaching for directors and executives of large groups present in Marseille (CMA CGM-orbit subsidiaries, GPMM operators, service groups). Multi-beneficiary or CODIR → N-1 cascade format available.",
          },
        ],
        testimonials: [
          {
            quote:
              "In a few sessions I completely changed how I prepare my export commercial negotiations. The coaching was calibrated to my real contracts, not generic examples. Measurable time savings from the second week.",
            role: "Commercial Director",
            companyProfile: "International freight forwarding SME, Joliette",
          },
          {
            quote:
              "I didn't know where to start with AI. The 1-to-1 coaching helped me identify my three priority cases and put them into production myself. The method is transmissible — I was able to train two of my managers afterwards.",
            role: "President",
            companyProfile: "Port services mid-cap, Euroméditerranée",
          },
        ],
        faq: [
          {
            q: "Who is Axion-IA's 1-to-1 AI coaching in Marseille designed for?",
            a: "For executives, managers and entrepreneurs in the Marseille business ecosystem — maritime and logistics mid-caps, Joliette/Euroméditerranée SMEs, Luminy health professionals, AMU/Centrale Méditerranée profiles — who want to progress on AI at their own pace on their own business cases, without going through a generic group training.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and a group session?",
            a: "Group sessions train a team on representative cases. 1-to-1 coaching works exclusively on YOUR real cases, at your pace, with follow-up from session to session. The ROI is faster and more targeted, but the format is less suited to diffusing an AI culture across an entire team.",
          },
          {
            q: "How many sessions are needed to become autonomous?",
            a: "It depends on your starting level and objectives. From the first pilot session you have concrete value. A standard programme to go from novice to advanced autonomous user typically spans a few sessions over several weeks.",
          },
          {
            q: "Are sessions in person in Marseille or by video?",
            a: "Both are possible. In-person at your Marseille offices (Joliette, Euroméditerranée, Château-Gombert, Luminy) is ideal for sessions with demos on your infrastructure. Video is effective for progression sessions and follow-ups. The hybrid cadence is most common. Travel costs billed separately for in-person sessions.",
          },
          {
            q: "Does the 990 € excl. VAT entry price include everything?",
            a: "The 990 € excl. VAT covers the working session itself (diagnosis + pilot session). Lodging, meals and travel allowance for in-person sessions in Marseille are billed separately on receipts. For multi-session programmes, a fixed-rate quote is established after the initial diagnosis.",
          },
          {
            q: "Can I involve a key colleague in some sessions?",
            a: "Yes. On request, a session can include a deputy director, operational manager or manager you want to bring on board. The format stays centred on your progression and agenda, with the flexibility to include an occasional co-beneficiary.",
          },
        ],
        guarantees:
          "First pilot session: if after this session you feel the format doesn't meet your expectations, full refund no questions asked. Multi-session programme: fixed flat-rate quote at signature, no drift. Full confidentiality: Confidentiality ensured from kick-off, your business cases, data and documents handled in session never leave our perimeter. No lock-in: everything you build in session (prompts, workflows, method sheets) belongs to you. After the final session, you are autonomous.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Marseille ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre secteur (logistique, santé, services). Aucun supplément géographique : le tarif est le même à Marseille qu'à Paris.",
    },
    {
      q: "Avez-vous des cas clients à Marseille ou dans la métropole Aix-Marseille ?",
      a: "Oui. Nos références couvrent des entreprises du bassin marseillais : ETI logistique Joliette, PME services portuaires, cabinet de santé Luminy. Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par ville d'intervention.",
    },
    {
      q: "Quels secteurs sont prioritaires à Marseille ?",
      a: "Nos déploiements marseillais couvrent en priorité le transport maritime et la logistique (ETI Joliette, opérateurs GPMM), la santé et la biotech (Luminy, AMU, INSERM), les services B2B (Euroméditerranée) et l'industrie (Château-Gombert). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos locaux marseillais ?",
      a: "Oui. Toutes nos interventions à Marseille sont par défaut en présentiel, dans vos locaux. Nos consultants couvrent les 16 arrondissements, Euroméditerranée, Château-Gombert, Luminy, et le bassin Aubagne/Aix/La Ciotat. Les restitutions et ateliers clés se tiennent toujours sur site.",
    },
    {
      q: "Travaillez-vous avec les startups de la French Tech Aix-Marseille ?",
      a: "Oui. Nous accompagnons les scale-ups du chapitre French Tech Aix-Marseille Région Sud, notamment celles de Marseille Innovation (Château-Gombert, Luminy). Notre offre est calibrée pour les structures avec un produit en traction qui veulent passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Marseille ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille de la mission). Nous calons une date de démarrage avec vous lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],
};
