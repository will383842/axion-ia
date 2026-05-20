// Tours (37261) — contenu éditorial gold standard.
//
// Sources économiques : economic-data/tours.ts (Sprint City Quality V3 2026-05-18).
// Spécificités Tours : STMicroelectronics (semi-conducteurs, héritier SGS-Thomson),
// SKF Tours (roulements), Michelin Joué-lès-Tours, Hutchinson (caoutchouc/aéro),
// Pôle S2E2 (Smart Electricity, siège Tours), Val de Loire UNESCO 2000 (ref. 933),
// Vouvray AOC, Sainte-Maure-de-Touraine AOP, Université de Tours (François-Rabelais,
// ~30 000 étudiants), Polytech Tours, ESCEM, French Tech Loire Valley, Mame
// Cité de la Création. Paris à ~1h05 TGV (Gare Saint-Pierre-des-Corps, LGV Atlantique).
//
// Doctrine :
//   - Aucun délai chiffré en clair.
//   - Aucun « frais de déplacement intégrés » — frais en sus.
//   - Durée minimale = 1 journée ; formats vont de 1 journée à plusieurs semaines.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Aucun prix hardcodé (vient de pricing.ts).
//   - Tailles INSEE : TPE / PME / ETI / GE — pas de métier-type.
//   - ~95 % Axion-IA-centric + ~5 % data locale anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn.

import type { VilleCopy } from "./types";

export const TOURS_COPY: VilleCopy = {
  pitchFr:
    "Tours concentre un tissu industriel de premier rang (STMicroelectronics, SKF, Michelin Joué-lès-Tours), le pôle Smart Electricity S2E2 et 30 000 étudiants (Université François-Rabelais, Polytech). Axion-IA intervient sur site auprès des TPE tourangelles comme des ETI industrielles et tertiaires de Tours Métropole.",
  pitchEn:
    "Tours combines a top-tier industrial fabric (STMicroelectronics, SKF, Michelin Joué-lès-Tours), the S2E2 Smart Electricity pole and 30,000 students (Université François-Rabelais, Polytech). Axion-IA delivers on site, from local micro-businesses to mid-cap industrial and tertiary firms across Tours Métropole.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Tours : nous identifions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille — TPE du commerce tourangeau aux ETI industrielles du bassin.",
      en: "Operational AI audit in Tours: we identify what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from local micro-businesses to industrial mid-caps across the Tours basin.",
    },
    interventions: {
      fr: "Interventions IA à Tours : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes avec des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Tours: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Tours : on déploie l'IA dans vos outils existants (CRM, ERP, mails, GMAO) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance externe créée.",
      en: "AI implementation in Tours: we deploy AI into your existing tools (CRM, ERP, email, CMMS) with contractually-costed ROI. Your teams stay in control, no external dependency created.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Tours (37) sur site auprès des entreprises de Tours Métropole. Nous accompagnons TPE, PME, ETI et grandes entreprises tourangelles — secteurs industrie (STMicro, SKF, Michelin, Hutchinson), tertiaire (conseil, santé, commerce), énergie (pôle S2E2), agroalimentaire et viticulture Val de Loire — sur leurs cas IA concrets : diagnostic chiffré, démos sur vos vraies données, plan d'action actionnable. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Tours (37) on site across Tours Métropole businesses. We support micro-businesses, SMEs, mid-caps and large enterprises in Tours — industry (STMicro, SKF, Michelin, Hutchinson), services, energy (S2E2 pole), agrifood and Val de Loire wine — on their concrete AI use cases: costed diagnosis, demos on your real data, actionable plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Industrie manufacturière & semi-conducteurs",
    "Énergie & Smart Electricity (S2E2)",
    "Commerce & services aux entreprises",
    "Santé & sciences biomédicales",
    "Agroalimentaire, viticulture & œnotourisme",
    "Numérique, startups & ICC",
  ],

  distancesFr:
    "Gare TGV Tours-Saint-Pierre-des-Corps (LGV Atlantique, Paris-Montparnasse ~1h05). Aéroport Tours Val de Loire (TUF, 6 km). Tramway ligne A (centre-ville). Communes limitrophes : Joué-lès-Tours (5 km), Saint-Pierre-des-Corps (3 km), Chambray-lès-Tours (6 km).",
  distancesEn:
    "TGV station Tours-Saint-Pierre-des-Corps (LGV Atlantique, Paris-Montparnasse ~1h05). Tours Val de Loire Airport (TUF, 6 km). Tram line A (city centre). Nearby: Joué-lès-Tours (5 km), Saint-Pierre-des-Corps (3 km), Chambray-lès-Tours (6 km).",

  ecosystemFr:
    "Tours allie un pôle industriel historique (STMicroelectronics, SKF, Michelin, Hutchinson), le siège du pôle de compétitivité S2E2 (Smart Electricity), un bassin universitaire (~30 000 étudiants), les incubateurs Mame et Village by CA, et la filière agroalimentaire et viticole Val de Loire (Vouvray AOC, Sainte-Maure AOP). French Tech Loire Valley couvre le bassin Centre-Val de Loire.",
  ecosystemEn:
    "Tours combines a historic industrial cluster (STMicroelectronics, SKF, Michelin, Hutchinson), the S2E2 Smart Electricity competitiveness pole HQ, a strong university basin (~30,000 students), Mame and Village by CA incubators, and the Val de Loire agrifood and wine sector (Vouvray AOC, Sainte-Maure AOP). French Tech Loire Valley spans the Centre-Val de Loire basin.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Tours cartographie précisément ce qui peut être automatisé dans votre entreprise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux couvrent toutes les tailles — de la TPE du commerce tourangeau à l'ETI industrielle du bassin (industrie, énergie, agroalimentaire, services) — avec restitution en présentiel dans vos locaux et plan d'action actionnable remis en main propre.",
        whyHere: [
          "Tours est un bassin industriel et tertiaire diversifié avec des ETI et GE de premier plan (STMicroelectronics, SKF, Michelin Joué-lès-Tours, Hutchinson) dont les process industriels, bureautiques et RH sont fortement automatisables.",
          "Le pôle S2E2 (Smart Electricity, siège Tours) génère un tissu de PME et ETI spécialisées en réseaux intelligents et efficacité énergétique — terrain fertile pour des cas IA sur la maintenance prédictive, l'optimisation énergétique et la documentation technique.",
          "L'Université de Tours (Rabelais), Polytech et l'ESCEM alimentent un vivier de PME tech et de startups (Mame, Village by CA, French Tech Loire Valley) habitués aux innovations mais parfois en retard sur les déploiements IA opérationnels.",
          "Nos consultants se déplacent sur site dans tout Tours Métropole (Tours centre, Joué-lès-Tours, Saint-Pierre-des-Corps, Chambray-lès-Tours, Saint-Cyr-sur-Loire, Saint-Avertin) — restitution toujours en présentiel.",
          "Tarifs publics affichés : aucun devis opaque, vous savez exactement ce que vous payez avant de signer, que vous soyez une TPE du Vieux-Tours ou une ETI industrielle du parc Granges-Galand.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs métier — process industriels, flux ERP, données commerciales).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Tours dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA — atelier, bureau, atelier de fabrication selon votre activité.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (production, commercial, finance, RH, opérations, direction) pour cartographier finement frictions et attentes. Contexte sectoriel tourangeau pris en compte : industrie, énergie, services, agri.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, emails, bons de commande, fiches techniques, rapports de maintenance. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux à Tours. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois calibrée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et commerces tourangeaux jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME de services, startups Mame, agences et sous-traitants industriels de Tours Métropole (quelques dizaines à 250 collaborateurs).",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles (mécanique, semi-conducteurs, énergie, caoutchouc) ou tertiaires (santé, conseil) souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites de grands groupes (STMicroelectronics, SKF, Michelin, Hutchinson) souhaitant cadrer une gouvernance IA centralisée à l'échelle du site ou de la division.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su cadrer nos enjeux industriels dès le kick-off — vocabulaire technique, connaissance des contraintes ERP et GMAO. Le livrable est chiffré, actionnable, sans jargon. On a pu prioriser nos chantiers IA devant notre comité de direction.",
            role: "Directeur industriel",
            companyProfile: "ETI équipementier automobile, Tours Métropole",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données plutôt que des slides. On a découvert des gains IA sur des tâches qu'on ne pensait pas automatisables — rédaction de rapports techniques et qualification de leads entrants.",
            role: "DG",
            companyProfile: "PME services B2B, Tours centre",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Tours ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Pouvez-vous auditer des process industriels (ERP, GMAO, chaîne de production) ?",
            a: "Oui. Une part significative de nos audits tourangeaux porte sur des ETI et sites industriels. Nos consultants maîtrisent les cas IA industriels — maintenance prédictive, lecture automatique de bons de commande, rédaction de rapports techniques, qualification de non-conformités. Le brief de cadrage précise le périmètre.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée si la souveraineté industrielle est requise.",
          },
          {
            q: "Comment se déroule la restitution finale à Tours ?",
            a: "Toujours en présentiel dans vos locaux à Tours ou sur votre site de Tours Métropole. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF chiffré en main propre.",
          },
          {
            q: "Différence avec un audit cabinet traditionnel ou un intégrateur ERP ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des généralistes. Tarifs publics affichés, pas de devis à six chiffres. Méthode condensée plutôt que de longues missions. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez — y compris votre propre DSI ou un intégrateur local.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour commander un audit à Tours ?",
            a: "Non. Une grande partie de nos audits tourangeaux sont commandés par des dirigeants industriels ou de services qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour sur nos missions tourangelles).",
      },
      en: {
        hero: "Axion-IA's AI audit in Tours precisely maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers cover every size — from local micro-businesses to industrial mid-caps across the Tours basin (industry, energy, agrifood, services) — with an in-person read-out at your premises and a concrete action plan handed over face to face.",
        whyHere: [
          "Tours is a diversified industrial and services basin with major ETIs and large groups (STMicroelectronics, SKF, Michelin Joué-lès-Tours, Hutchinson) whose industrial, office and HR processes are highly automatable.",
          "The S2E2 Smart Electricity pole (HQ Tours) generates a cluster of SMEs and mid-caps specialised in smart grids and energy efficiency — fertile ground for AI use cases on predictive maintenance, energy optimisation and technical documentation.",
          "Université de Tours (Rabelais), Polytech and ESCEM feed a pipeline of tech SMEs and startups (Mame, Village by CA, French Tech Loire Valley) open to innovation but often behind on operational AI deployments.",
          "Our consultants travel on site across all of Tours Métropole (Tours centre, Joué-lès-Tours, Saint-Pierre-des-Corps, Chambray-lès-Tours, Saint-Cyr-sur-Loire, Saint-Avertin) — read-out always in person.",
          "Public pricing displayed: no opaque quote game, you know exactly what you pay before signing, whether you're a micro-business in Vieux-Tours or an industrial mid-cap in Granges-Galand business park.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs — industrial flows, ERP data, commercial metrics).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Tours at your premises to observe daily tools and identify AI candidate workflows — office, workshop, manufacturing floor depending on your activity.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (production, sales, finance, HR, operations, leadership) to map frictions and expectations. Tours sector context factored in: industry, energy, services, agri.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, purchase orders, technical datasheets, maintenance reports. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Tours premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap calibrated to your sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Tours freelancers, micro-firms and local businesses up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for service SMEs, Mame startups, agencies and industrial subcontractors in Tours Métropole (a few dozen to 250 staff).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial (mechanics, semiconductors, energy, rubber) or service (healthcare, consulting) mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large-group sites (STMicroelectronics, SKF, Michelin, Hutchinson) framing centralised AI governance at site or division level.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA framed our industrial challenges from the very first kick-off — technical vocabulary, knowledge of ERP and CMMS constraints. The deliverable is costed, actionable, jargon-free. We were able to prioritise our AI initiatives in front of our executive committee.",
            role: "Industrial Director",
            companyProfile: "Automotive supplier mid-cap, Tours Métropole",
          },
          {
            quote:
              "Pragmatic method, demos on our real data rather than slides. We discovered AI gains on tasks we thought were impossible to automate — technical report writing and inbound lead qualification.",
            role: "CEO",
            companyProfile: "B2B services SME, Tours city centre",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Tours?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Can you audit industrial processes (ERP, CMMS, production line)?",
            a: "Yes. A significant share of our Tours audits cover ETIs and industrial sites. Our consultants master industrial AI use cases — predictive maintenance, automatic purchase order reading, technical report drafting, non-conformity qualification. The framing brief defines the scope.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra if industrial sovereignty is required.",
          },
          {
            q: "How does the final read-out work in Tours?",
            a: "Always in person at your Tours premises or Tours Métropole site. Workshop of a few hours with your leadership or executive committee. You leave with the costed PDF deliverable in hand.",
          },
          {
            q: "Difference with a traditional consulting firm or ERP integrator?",
            a: "Our consultants are former AI practitioners, not generalists. Public pricing, no six-figure quote to negotiate. Condensed method rather than long missions. And above all: no lock-in, you leave with your plan, free to execute with whoever you want — including your own IT team or a local integrator.",
          },
          {
            q: "Do I need AI maturity to engage you in Tours?",
            a: "No. A large share of our Tours audits are ordered by industrial or services executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Tours missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Tours se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel. Adapté aux équipes industrielles, tertiaires et commerciales de Tours Métropole. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Tours est un bassin diversifié avec des contextes métiers très différents — industrie (STMicro, SKF, Michelin, Hutchinson), énergie (S2E2), services B2B, santé, agroalimentaire, viticulture — ce qui nous force à calibrer chaque session sur VOS données réelles.",
          "Tous les sites de Tours Métropole couverts en présentiel : Tours centre, Joué-lès-Tours, Saint-Pierre-des-Corps, Chambray-lès-Tours, Saint-Avertin, Saint-Cyr-sur-Loire, La Riche.",
          "Le format Essentielle est calibré pour les PME tourangelles de quelques personnes à une centaine de collaborateurs — équipes commerciales, RH, finance, support.",
          "Le format Équipes permet d'intervenir département par département dans les ETI industrielles — production, méthodes, qualité, achats — avec des démos sur vos données techniques réelles.",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI tourangelles — alignement sur la trajectoire IA sans jargon.",
          "Vocabulaire ajusté à votre secteur dominant : industriel, énergie, agri, tertiaire. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier, les cas d'usage prioritaires — process industriels, gestion commerciale, documentation technique, etc.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de commande, rapports de maintenance, emails, fiches produit, contrats) pour calibrer les démos sur VOS données réelles.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux à Tours ou sur votre site pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Exemples sectoriels tourangeaux : lecture de plans, rédaction de comptes-rendus de réunion, qualification de leads entrants.",
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
              "Idéal indépendants, artisans, commerces et cabinets tourangeaux jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (commercial, RH, finance, méthodes, qualité).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Équipes ou Dirigeants",
            detail:
              "Équipes pour déployer département par département dans les ETI industrielles, ou Dirigeants pour cadrage comité de direction.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sites de grands groupes à Tours : roadshow multi-ateliers, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session parfaitement calibrée à notre activité industrielle : les démos portaient sur nos vrais bons de commande et nos fiches techniques. Le lendemain, nos commerciaux et méthodes utilisaient déjà les outils installés.",
            role: "DRH",
            companyProfile: "PME équipementier industriel, Tours Métropole",
          },
          {
            quote:
              "La session dirigeants nous a alignés en une journée sur la vision IA de l'entreprise. Vocabulaire accessible, pas de jargon tech, exemples concrets tirés de nos process. Résultat : plan IA approuvé en CODIR la semaine suivante.",
            role: "PDG",
            companyProfile: "ETI énergie / smart grids, Tours",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Tours ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. Les formats Équipes et Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux secteurs industriels de Tours (semi-conducteurs, énergie, automobile) ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples, démos. Une session pour une équipe méthodes d'un équipementier n'a rien à voir avec une session pour une équipe commerciale d'une PME de services.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir à Tours ?",
            a: "L'Essentielle et Équipes accueillent jusqu'à une centaine de collaborateurs en interaction. Au-delà, un format personnalisé avec plénière + ateliers en sous-groupes est plus adapté.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Tours come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work. Suited to industrial, service and commercial teams across Tours Métropole. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Tours is a diversified basin with very different professional contexts — industry (STMicro, SKF, Michelin, Hutchinson), energy (S2E2), B2B services, healthcare, agrifood, wine — which forces us to calibrate each session on YOUR real data.",
          "All Tours Métropole sites covered in person: Tours centre, Joué-lès-Tours, Saint-Pierre-des-Corps, Chambray-lès-Tours, Saint-Avertin, Saint-Cyr-sur-Loire, La Riche.",
          "The Essential format is calibrated for Tours SMEs from a few people to about a hundred staff — sales, HR, finance, support.",
          "The Teams format allows department-by-department engagement in industrial mid-caps — production, methods, quality, procurement — with demos on your real technical data.",
          "The Executives format enables in-camera framing for Tours mid-cap executive committees — AI trajectory alignment, no jargon.",
          "Vocabulary adjusted to your dominant sector: industrial, energy, agri, services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, priority use cases — industrial processes, sales management, technical documentation, etc.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (purchase orders, maintenance reports, emails, product datasheets, contracts) to calibrate demos on YOUR real data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Tours premises or site to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Tours sector examples: plan reading, meeting minutes drafting, inbound lead qualification.",
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
              "Ideal Tours freelancers, craftspeople, local businesses and practices up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (sales, HR, finance, methods, quality).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Teams or Executives format",
            detail:
              "Teams to roll out department by department in industrial mid-caps, or Executives for executive committee framing.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large-group Tours sites: multi-workshop roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session perfectly calibrated to our industrial activity: demos used our real purchase orders and technical datasheets. The next day, our sales and methods teams were already using the installed tools.",
            role: "Head of HR",
            companyProfile: "Industrial supplier SME, Tours Métropole",
          },
          {
            quote:
              "The executive session aligned us in one day on the company's AI vision. Accessible vocabulary, no tech jargon, concrete examples from our own processes. Result: AI plan approved at executive committee the following week.",
            role: "CEO",
            companyProfile: "Energy / smart grids mid-cap, Tours",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Tours take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Teams and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you adapt content to Tours industrial sectors (semiconductors, energy, automotive)?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples, demos. A session for a methods team at an automotive supplier has nothing to do with one for a services SME sales team.",
          },
          {
            q: "What group size can you handle in Tours?",
            a: "The Essential and Teams formats handle up to about a hundred staff in interaction. Beyond that, a custom format with plenary + sub-group workshops is more suitable.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR team can process them as a consulting service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Tours met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec un kick-off obligatoire à Tours. Priorité aux intégrations dans vos outils existants (ERP, GMAO, CRM, mails) — aucune reconstruction de stack.",
        whyHere: [
          "Tours concentre des ETI industrielles (STMicro, SKF, Hutchinson) et tertiaires dont les process sont mûrs pour l'IA : lecture automatique de documentation technique, gestion de non-conformités, optimisation d'ordres de fabrication, qualification de leads B2B.",
          "Le pôle S2E2 génère des cas IA spécifiques à l'énergie : analyse de données de consommation, maintenance prédictive sur réseaux, génération automatique de rapports réglementaires.",
          "L'écosystème startup tourangeau (Mame, Village by CA, French Tech Loire Valley) est demandeur de déploiements IA rapides sur des périmètres PME/scale-up — POC à production en quelques semaines.",
          "Le kick-off se déroule en présentiel à Tours ou sur votre site de Tours Métropole : accès aux données réelles, validation des intégrations ERP/GMAO, alignement des équipes techniques et métier.",
          "Itérations à distance ensuite avec un point quotidien court, et visites mensuelles sur site pour démos d'avancement avec votre comité de pilotage.",
          "Formation de vos ambassadeurs internes incluse : ils deviennent autonomes après la fin de mission, aucune dépendance externe créée.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site à Tours : revue de l'architecture cible (ERP, GMAO, CRM, mails, stockage documentaire), validation des contraintes RGPD/sécurité industrielle, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site à Tours : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants (ERP, GMAO, CRM), tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site à Tours : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de quelques semaines.",
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
              "Implémentation d'un cas d'usage simple (lecture factures, comptes-rendus, qualification leads) — adapté aux PME et startups tourangelles cherchant un premier déploiement rapide.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME de services, startups Mame et sous-traitants industriels (quelques dizaines à 250 collaborateurs).",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, GMAO, datalake), formation d'ambassadeurs cross-département. Adapté aux ETI industrielles de Tours Métropole.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour les sites de grands groupes (STMicro, SKF, Michelin, Hutchinson) : cas d'usage cascadés par département, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture de documentation technique + gestion de non-conformités livrée comme prévu. ROI réel mesuré : plusieurs équivalents temps plein libérés sur les tâches de saisie et de tri. Nos équipes méthodes sont autonomes, on a la main sur les modèles.",
            role: "Directeur des opérations",
            companyProfile: "ETI industrielle, Tours Métropole",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre PME : kick-off intense sur site avec nos vraies données, puis itérations à distance rapides. Notre équipe a pris le relais en toute autonomie dès le go-live.",
            role: "Fondateur",
            companyProfile: "Scale-up B2B SaaS, Mame Tours",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Tours ?",
            a: "Cela dépend de l'ampleur. Un POC peut tenir en quelques semaines, une mission PME sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Pouvez-vous intégrer l'IA dans un ERP industriel ou une GMAO ?",
            a: "Oui. Une part importante de nos missions tourangelles porte sur des intégrations ERP industriels (SAP, Sage, Infor) et GMAO — lecture automatique de bons de commande, génération de rapports, détection d'anomalies sur données capteurs. Le cadrage technique précise le périmètre et les contraintes.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions tourangelles. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel disponible. Aucun lock-in : vous pouvez aussi externaliser ailleurs ou internaliser.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, confidentialité industrielle garantie.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données industrielles critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (commandes importantes, sécurité process, qualité), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Tours brings your AI cases to production with contractually-costed ROI, team training included. Hybrid mode on-site / remote, with a mandatory Tours kick-off. Focus on integrations into your existing tools (ERP, CMMS, CRM, email) — no stack rebuild.",
        whyHere: [
          "Tours concentrates industrial mid-caps (STMicro, SKF, Hutchinson) and service firms whose processes are ripe for AI: automatic technical documentation reading, non-conformity management, work order optimisation, B2B lead qualification.",
          "The S2E2 pole generates AI use cases specific to energy: consumption data analysis, predictive maintenance on grids, automatic generation of regulatory reports.",
          "The Tours startup ecosystem (Mame, Village by CA, French Tech Loire Valley) demands fast AI deployments on SME/scale-up perimeters — POC to production in a few weeks.",
          "Kick-off happens in person in Tours or at your Tours Métropole site: access to real data, ERP/CMMS integration validation, technical and business team alignment.",
          "Remote iterations afterwards with a short daily check-in, and monthly on-site visits for progress demos with your steering committee.",
          "Training of your internal ambassadors included: they become autonomous after mission end, no external dependency created.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site workshop in Tours: target architecture review (ERP, CMMS, CRM, email, document storage), GDPR/industrial security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site in Tours: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily check-in: progressive case enrichment, integration with existing tools (ERP, CMMS, CRM), real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Tours: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case (invoice reading, meeting minutes, lead qualification) — suited to Tours SMEs and startups seeking a first fast deployment.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For service SMEs, Mame startups and industrial subcontractors (a few dozen to 250 staff).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, CMMS, datalake), cross-department ambassador training. Suited to Tours Métropole industrial mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for large-group sites (STMicro, SKF, Michelin, Hutchinson): cascaded use cases by department, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical documentation reading + non-conformity management implementation delivered as planned. Real ROI measured: several FTEs freed on data entry and sorting tasks. Our methods teams are autonomous, we control our models.",
            role: "Head of Operations",
            companyProfile: "Industrial mid-cap, Tours Métropole",
          },
          {
            quote:
              "Perfect hybrid method for our SME: intense on-site kick-off with our real data, then fast remote iterations. Our team took over autonomously from go-live.",
            role: "Founder",
            companyProfile: "B2B SaaS scale-up, Mame Tours",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Tours take?",
            a: "It depends on scope. A POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Can you integrate AI into an industrial ERP or CMMS?",
            a: "Yes. A large share of our Tours missions covers industrial ERP (SAP, Sage, Infor) and CMMS integrations — automatic purchase order reading, report generation, anomaly detection on sensor data. The technical framing defines scope and constraints.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Tours missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere or insource.",
          },
          {
            q: "Does my industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, industrial confidentiality guaranteed.",
          },
          {
            q: "What happens if the AI produces errors on critical industrial data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large orders, process safety, quality), continuous monitoring. The costed ROI in the SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Tours ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre industriel ou tertiaire. Aucun supplément géographique : le tarif est le même à Tours qu'ailleurs en France.",
    },
    {
      q: "Avez-vous des références dans les secteurs industriels de Tours (semi-conducteurs, énergie, automobile) ?",
      a: "Oui. Nos références tourangelles couvrent des ETI équipementiers, des PME sous-traitantes de la filière automobile et des entreprises du secteur énergie/smart grids. Les cas concrets récents sont consultables dans la rubrique Cas concrets, filtrables par secteur et ville d'intervention.",
    },
    {
      q: "Pouvez-vous intervenir sur site à Joué-lès-Tours, Chambray-lès-Tours ou Saint-Pierre-des-Corps ?",
      a: "Oui. Nous couvrons l'ensemble de Tours Métropole en présentiel : Tours centre, Joué-lès-Tours (Michelin, Tupperware), Saint-Pierre-des-Corps, Chambray-lès-Tours, Saint-Avertin, Saint-Cyr-sur-Loire, La Riche et les parcs d'activités périphériques (Granges-Galand, Isoparc Sorigny).",
    },
    {
      q: "Travaillez-vous avec les startups tourangelles (Mame, French Tech Loire Valley) ?",
      a: "Oui. Nous accompagnons les startups et scale-ups de l'écosystème tourangeau — Mame Cité de la Création, Village by CA Touraine, French Tech Loire Valley. Notre offre POC et Mission PME est calibrée pour les structures avec un product-market fit établi qui veulent passer du prototype IA à un déploiement opérationnel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Tours ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille de la mission). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Quels secteurs sont prioritaires pour l'IA à Tours ?",
      a: "Nos déploiements tourangeaux couvrent en priorité l'industrie manufacturière (semi-conducteurs, roulements, pneumatique, caoutchouc, plasturgie), l'énergie et smart grids (pôle S2E2), les services B2B (conseil, santé, formation), l'agroalimentaire et la viticulture Val de Loire. Tout secteur B2B est éligible à un audit.",
    },
  ],
};
