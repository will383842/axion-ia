// Nîmes (30189) — contenu éditorial gold standard.
//
// Doctrine :
//   - Aucun délai chiffré.
//   - Aucun "frais de déplacement intégrés" : les frais sont en plus.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Mention systématique "frais de logement, repas et forfait trajet en sus"
//     sur les formats interventions.
//   - Aucun prix hardcodé : libellés contextuels uniquement (pricing.ts = SSOT).
//   - Tailles d'entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Ancres réelles Nîmes : Maison Carrée UNESCO, Arènes romaines, BRL Groupe,
//     Royal Canin (Aimargues), Perrier (Vergèze), denim "serge de Nîmes",
//     Costières de Nîmes AOC, Olive de Nîmes AOP, UNIMES, IMT Mines Alès,
//     Parc Georges Besse (technopôle), CHU Carémeau, CCI Gard.
//   - PAS de heroSchema, PAS de unAUn.

import type { VilleCopy } from "./types";

export const NIMES_COPY: VilleCopy = {
  pitchFr:
    "Nîmes regroupe un tissu de TPE et PME actives dans le commerce, les services aux entreprises et le BTP, ancré autour du Parc Georges Besse (technopôle), du CHU Carémeau et de grands groupes comme BRL Groupe et Royal Canin. Axion-IA y intervient sur site pour accompagner les entreprises gardoises dans leurs cas IA opérationnels.",
  pitchEn:
    "Nîmes hosts an active fabric of micro-businesses and SMEs in trade, business services and construction, centered on Parc Georges Besse (tech park), CHU Carémeau and major employers such as BRL Groupe and Royal Canin. Axion-IA delivers on site to help Gard companies tackle their operational AI use cases.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Nîmes : nous cartographions ce qui peut être automatisé dans votre organisation gardoise et chiffrons le ROI. Du Flash TPE au Stratégique ETI, quatre niveaux couvrent tous les profils.",
      en: "Operational AI audit in Nîmes: we map what can be automated in your Gard organisation and quantify the ROI. From Flash micro-business to Mid-cap Strategic, four tiers cover every profile.",
    },
    interventions: {
      fr: "Interventions IA à Nîmes : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Nîmes: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Nîmes : on déploie l'IA dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, aucun lock-in technologique.",
      en: "AI implementation in Nîmes: we deploy AI into your existing tools (CRM, ERP, email) with contractually-costed ROI. Your teams stay in control, no tech lock-in.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Nîmes (30) sur site. Nous accompagnons les TPE, PME, ETI et grandes entreprises du Gard — commerce, services, BTP, agroalimentaire, ingénierie — sur leurs cas IA concrets : diagnostic chiffré, démos sur vos vraies données, plan d'action actionnable. Le Parc Georges Besse, la zone Grézan et les entreprises implantées autour du CHU Carémeau font partie de notre terrain d'intervention régulier. Tarifs publics, aucun lock-in.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Nîmes (30) on site. We support micro-businesses, SMEs, mid-caps and large companies in the Gard — trade, services, construction, agri-food, engineering — on their concrete AI use cases: costed diagnosis, demos on your real data, actionable plan. Parc Georges Besse, the Grézan zone and companies around CHU Carémeau are part of our regular intervention area. Public pricing, no lock-in.",

  topSectorsNaf: [
    "Commerce & Distribution",
    "Services aux entreprises",
    "BTP & Construction",
    "Ingénierie & Environnement",
    "Agroalimentaire & IAA",
    "Santé & Médico-social",
  ],

  distancesFr:
    "Gare de Nîmes-Centre (intra-muros, TGV via Nîmes-Pont-du-Gard LGV à Manduel). Aéroport Nîmes-Alès-Camargue-Cévennes à 10 km (commune de Garons). Montpellier à 55 km, Marseille à 125 km, Lyon à 250 km.",
  distancesEn:
    "Nîmes-Centre station (city centre, TGV via Nîmes-Pont-du-Gard LGV at Manduel). Nîmes-Alès-Camargue-Cévennes airport 10 km away (Garons). Montpellier 55 km, Marseille 125 km, Lyon 250 km.",

  ecosystemFr:
    "Économie gardoise portée par le commerce et les services aux entreprises (section GHI + MN INSEE), le BTP et la santé (CHU Carémeau, plus gros employeur du Gard). Grands groupes : BRL Groupe (siège — ingénierie eau), Royal Canin (Aimargues, ~25 km), Perrier/Nestlé Waters (Vergèze, 15 km). Technopôle Parc Georges Besse. UNIMES, IMT Mines Alès (45 km). Vignoble Costières de Nîmes AOC et Olive de Nîmes AOP en territoire direct.",
  ecosystemEn:
    "Gard economy driven by trade and business services (INSEE section GHI + MN), construction and health (CHU Carémeau, the Gard's largest employer). Major groups: BRL Groupe (HQ — water engineering), Royal Canin (Aimargues, ~25 km), Perrier/Nestlé Waters (Vergèze, 15 km). Parc Georges Besse tech park. UNIMES, IMT Mines Alès (45 km). Costières de Nîmes AOC and Olive de Nîmes AOP vineyards on direct territory.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Nîmes cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux — du Flash TPE à l'Audit Stratégique ETI — couvrent toutes les tailles d'entreprise gardoise, des indépendants du centre-ville aux PME du Parc Georges Besse en passant par les ETI de services aux entreprises.",
        whyHere: [
          "Nîmes est une ville de tissu B2B dense : TPE et PME du commerce, de la logistique et des services aux entreprises constituent l'essentiel de nos cas locaux.",
          "La présence de BRL Groupe (siège social) et des filières agroalimentaires (Royal Canin Aimargues, Perrier Vergèze) crée des besoins réels en automatisation documentaire et en pilotage de données opérationnelles.",
          "Le CHU Carémeau et les structures médico-sociales du Gard représentent un terrain fertile pour l'IA appliquée à la gestion administrative et à la coordination de soins.",
          "Le Parc Georges Besse concentre des structures tertiaires et numériques où les cas IA (qualification de leads, génération de contenus, analyse contractuelle) sont immédiatement activables.",
          "Tarifs publics, aucun supplément géographique : le tarif Nîmes est le même que partout en France. Frais de déplacement et hébergement facturés séparément.",
          "Restitution toujours en présentiel à Nîmes dans vos locaux : atelier livrable en main propre avec votre direction ou comité de pilotage.",
        ],
        methodology: [
          {
            step: "Cadrage à distance",
            detail:
              "Brief initial visio ou téléphonique pour signer le Confidentialité assurée, aligner le périmètre (secteur, nombre de collaborateurs, process ciblés) et recueillir quelques documents de cadrage.",
          },
          {
            step: "Kick-off sur site à Nîmes",
            detail:
              "Première journée dans vos locaux — centre-ville, Parc Georges Besse ou zone Grézan selon votre implantation. Observation des outils quotidiens, identification des workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens courts ciblés sur les fonctions à fort potentiel IA : commerciaux, administration/finance, opérations, direction. Cartographie des frictions et des attentes réelles.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place à Nîmes : démonstrations de Claude, Mistral, GPT-4 appliquées à vos PDFs, devis, factures, emails, dossiers de chantier. Pas de slides abstraits — vos données, votre contexte.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux nîmois. Livrable PDF chiffré ROI/complexité remis en main propre. Roadmap actionnable sur 6 à 18 mois, exécutable avec n'importe quel prestataire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, artisans et petites structures du Gard jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME de services, BTP, négoce et agroalimentaire nîmoises de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI gardoises souhaitant cadrer une trajectoire IA pluriannuelle : ingénierie, santé, distribution régionale.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les directions IA de grands groupes implantés dans le Gard (BRL, Royal Canin, CHU) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit était ancré dans nos réalités nîmoises dès le kick-off : nos données, nos devis BTP, notre façon de travailler. Le livrable chiffré nous a permis de présenter un business case solide à notre direction.",
            role: "Directeur général",
            companyProfile: "PME BTP, Nîmes Ouest, ~80 collaborateurs",
          },
          {
            quote:
              "Méthode rigoureuse, démos sur nos vraies données de facturation et de gestion de stock. On est repartis avec un plan d'action clair, sans jargon et sans dépendance envers Axion-IA.",
            role: "Responsable opérations",
            companyProfile: "ETI distribution agroalimentaire, bassin nîmois, ~300 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Nîmes ?",
            a: "La durée varie selon le niveau retenu. Un Audit Flash couvre une journée sur site, un Audit Stratégique ETI s'étale sur plusieurs semaines (kick-off, entretiens, restitution). Le rythme exact est calé lors du brief de cadrage initial.",
          },
          {
            q: "Quels secteurs nîmois bénéficient le plus d'un audit IA ?",
            a: "Le BTP et les services aux entreprises sont nos premiers cas locaux (automatisation devis, comptes-rendus chantier, suivi fournisseurs). L'agroalimentaire (traceabilité, gestion documentaire) et la santé administrative (CHU, cliniques) sont également très pertinents. Tout secteur B2B avec des workflows répétitifs sur documents est éligible.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures ou sur environnement dédié si la souveraineté est requise. Conformité RGPD, hébergement UE, DPO disponible sur demande.",
          },
          {
            q: "Comment se déroule la restitution finale à Nîmes ?",
            a: "Toujours en présentiel dans vos locaux nîmois. Atelier de quelques heures avec votre direction ou équipe dirigeante. Vous repartez avec le livrable PDF complet, une roadmap priorisée et des démos reproductibles immédiatement.",
          },
          {
            q: "Quelle différence avec un cabinet de conseil généraliste ou un prestataire IT local ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des théoriciens. Tarifs publics affichés sans devis opaque à négocier. Méthode condensée ancrée dans vos données réelles. Et surtout : aucun lock-in — votre plan d'action est exécutable avec n'importe quel prestataire ou en interne.",
          },
          {
            q: "Faut-il être mûr sur l'IA pour commander un audit ?",
            a: "Non. La majorité de nos audits nîmois sont commandés par des dirigeants qui n'ont encore rien déployé en IA et souhaitent éviter de partir dans la mauvaise direction. L'audit est précisément fait pour ça.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour sur nos missions).",
      },
      en: {
        hero: "Axion-IA's AI audit in Nîmes maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers — from Flash micro-business to Mid-cap Strategic — cover every size of Gard company, from independent professionals to Parc Georges Besse SMEs and business-services mid-caps.",
        whyHere: [
          "Nîmes has a dense B2B fabric: micro-businesses and SMEs in trade, logistics and business services make up the core of our local cases.",
          "The presence of BRL Groupe (HQ) and agri-food supply chains (Royal Canin Aimargues, Perrier Vergèze) creates real demand for document automation and operational data management.",
          "CHU Carémeau and Gard medico-social structures represent fertile ground for AI applied to administrative management and care coordination.",
          "Parc Georges Besse concentrates tertiary and digital structures where AI use cases (lead qualification, content generation, contract analysis) are immediately activatable.",
          "Public pricing, no geographic surcharge: Nîmes rate is the same as anywhere in France. Travel and lodging billed separately.",
          "Read-out always in person at your Nîmes premises: deliverable workshop handed face-to-face to your leadership or steering committee.",
        ],
        methodology: [
          {
            step: "Remote framing",
            detail:
              "Initial video or phone brief to sign the Confidentiality ensured, align the scope (sector, headcount, targeted processes) and collect a few framing documents.",
          },
          {
            step: "On-site kick-off in Nîmes",
            detail:
              "First day at your premises — city centre, Parc Georges Besse or Grézan zone depending on your location. Observation of daily tools, identification of AI-candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short targeted interviews on high AI-potential functions: sales, admin/finance, operations, leadership. Mapping of real frictions and expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site in Nîmes: demonstrations of Claude, Mistral, GPT-4 applied to your PDFs, quotes, invoices, emails, project files. No abstract slides — your data, your context.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Nîmes premises. Costed PDF deliverable handed over. Actionable roadmap spanning 6 to 18 months, executable with any vendor.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Gard independents, tradespeople and small structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for Nîmes service, construction, trade and agri-food SMEs from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Gard mid-caps framing a multi-year AI trajectory: engineering, health, regional distribution.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For AI leadership at large groups in the Gard (BRL, Royal Canin, CHU) framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "The audit was grounded in our Nîmes realities from kick-off: our data, our construction quotes, our way of working. The costed deliverable let us build a solid business case for our leadership.",
            role: "CEO",
            companyProfile: "Construction SME, Nîmes West, ~80 staff",
          },
          {
            quote:
              "Rigorous method, demos on our real invoicing and stock-management data. We left with a clear action plan, jargon-free and with no dependency on Axion-IA.",
            role: "Operations Manager",
            companyProfile: "Agri-food distribution mid-cap, Nîmes basin, ~300 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Nîmes?",
            a: "Duration varies by tier. A Flash audit covers one on-site day; a Mid-cap Strategic audit spans several weeks (kick-off, interviews, read-out). The exact rhythm is agreed at the initial framing brief.",
          },
          {
            q: "Which Nîmes sectors benefit most from an AI audit?",
            a: "Construction and business services are our top local cases (quote automation, site meeting minutes, supplier tracking). Agri-food (traceability, document management) and healthcare administration (CHU, clinics) are also highly relevant. Any B2B sector with repetitive document-based workflows is eligible.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure or dedicated environment if sovereignty is required. GDPR compliance, EU hosting, DPO available on request.",
          },
          {
            q: "How does the final read-out work in Nîmes?",
            a: "Always in person at your Nîmes premises. Workshop of a few hours with your leadership or executive committee. You leave with the complete PDF deliverable, a prioritised roadmap and immediately reproducible demos.",
          },
          {
            q: "Difference from a generalist consulting firm or local IT provider?",
            a: "Our consultants are former AI practitioners, not theorists. Public pricing with no opaque quote to negotiate. Condensed method grounded in your real data. Above all: no lock-in — your action plan is executable with any vendor or in-house.",
          },
          {
            q: "Do I need AI maturity before ordering an audit?",
            a: "No. Most of our Nîmes audits are ordered by executives who have not yet deployed anything in AI and want to avoid going in the wrong direction. The audit is precisely designed for that.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date on our missions).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Nîmes se déclinent en formats sur site d'une à plusieurs journées. Vos collaborateurs gardois ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur métier réel — BTP, commerce, services, ingénierie, agroalimentaire. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Nîmes est une ville de TPE et PME actives : le format Essentielle (une journée) est le plus calibré pour les structures de quelques personnes à une centaine de collaborateurs.",
          "Le tissu commercial (centre-ville, zones Grézan et Parc Georges Besse) concentre des équipes qui gagnent directement à automatiser devis, emails commerciaux, suivi client et reporting.",
          "Les PME du BTP nîmois bénéficient particulièrement des outils IA pour les comptes-rendus de chantier, la rédaction de CCTP et la gestion documentaire.",
          "Le format Dirigeants permet un cadrage stratégique en huis-clos pour les comités de direction des ETI gardoises.",
          "Vocabulaire ajusté à votre secteur dominant local : ingénierie, agroalimentaire, commerce, santé, BTP. Aucune session générique recyclée.",
          "Nos consultants se déplacent à Nîmes et dans le bassin (Marguerittes, Bouillargues, Manduel, Beaucaire) — frais de déplacement et hébergement facturés séparément.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires à Nîmes.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous collectons quelques documents anonymisés représentatifs de votre activité (devis, factures, emails, comptes-rendus) pour calibrer les démos sur VOS données nîmoises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection et accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Exemples tirés des réalités nîmoises : BTP, commerce, services, ingénierie.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables dès le lendemain sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal artisans, commerçants, cabinets et petites structures nîmoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour un département (commerciaux, chantier, admin, RH) de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos CODIR selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour BRL, Royal Canin ou CHU Carémeau : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "La session Essentielle était adaptée à notre activité BTP nîmoise dès la préparation. Le lendemain, nos conducteurs de travaux utilisaient déjà les outils IA pour leurs comptes-rendus de chantier.",
            role: "Gérant",
            companyProfile: "PME BTP, Nîmes, ~40 collaborateurs",
          },
          {
            quote:
              "Format Dirigeants parfait pour cadrer notre stratégie IA en quelques heures. Axion-IA a su adapter le discours à notre réalité d'ETI gardoise, sans jargon et avec des exemples concrets de notre secteur.",
            role: "Président directeur général",
            companyProfile: "ETI services aux entreprises, bassin nîmois, ~500 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Nîmes ?",
            a: "Cela dépend du format. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble lors du cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir à Nîmes ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté — plénière suivie d'ateliers en sous-groupes selon vos espaces disponibles à Nîmes ou au Parc Georges Besse.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur nîmois ?",
            a: "Oui systématiquement. Le brief de cadrage amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un cabinet d'expertise nîmois n'a rien à voir avec une session pour une PME du BTP ou une structure de l'agroalimentaire.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation tardive ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation prévue. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur nîmois, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Nîmes come in on-site formats from one to several days. Your Gard staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — construction, trade, services, engineering, agri-food. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Nîmes is a city of active micro-businesses and SMEs: the Essential format (one day) is best calibrated for structures from a few people to about a hundred staff.",
          "The commercial fabric (city centre, Grézan and Parc Georges Besse zones) concentrates teams that gain directly from automating quotes, commercial emails, client follow-up and reporting.",
          "Nîmes construction SMEs benefit particularly from AI tools for site meeting minutes, specification writing and document management.",
          "The Executives format enables a strategic in-camera framing for Gard mid-cap executive committees.",
          "Vocabulary adjusted to your dominant local sector: engineering, agri-food, trade, health, construction. No recycled generic session.",
          "Our consultants travel to Nîmes and the basin (Marguerittes, Bouillargues, Manduel, Beaucaire) — travel and lodging costs billed separately.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector and priority use cases in Nîmes.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your activity (quotes, invoices, emails, meeting minutes) to calibrate demos on YOUR Nîmes data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection and Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Examples drawn from Nîmes realities: construction, trade, services, engineering.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable from the next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Nîmes tradespeople, retailers, firms and small structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (sales, site, admin, HR) from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for BRL, Royal Canin or CHU Carémeau: multi-site roadshows, executive + team cascade seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential session was adapted to our Nîmes construction activity from preparation onwards. The next day, our site managers were already using AI tools for their site meeting minutes.",
            role: "Managing Director",
            companyProfile: "Construction SME, Nîmes, ~40 staff",
          },
          {
            quote:
              "The Executives format was perfect for framing our AI strategy in a few hours. Axion-IA adapted the discourse to our Gard mid-cap reality, jargon-free with concrete examples from our sector.",
            role: "Chairman and CEO",
            companyProfile: "Business services mid-cap, Nîmes basin, ~500 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Nîmes take?",
            a: "It depends on the format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle in Nîmes?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable — plenary followed by sub-group workshops depending on your available spaces in Nîmes or at Parc Georges Besse.",
          },
          {
            q: "Do tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our Nîmes sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Nîmes accounting firm has nothing to do with a session for a construction SME or an agri-food structure.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "What happens with a late cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Nîmes sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Nîmes met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux nîmois. Adaptée aux réalités gardoises : BTP, ingénierie, commerce, agroalimentaire, santé.",
        whyHere: [
          "Nîmes concentre des cas d'usage IA à fort ROI immédiat : automatisation de devis BTP, lecture de bons de commande et factures, génération de comptes-rendus, qualification de leads commerciaux.",
          "BRL Groupe, Royal Canin (Aimargues) et les sous-traitants de Perrier (Vergèze) représentent un tissu de PME et ETI avec des besoins réels en intégration IA dans leurs ERP et CRM.",
          "Le CHU Carémeau et les structures médico-sociales du Gard ont des besoins spécifiques en automatisation documentaire administrative (comptes-rendus, dossiers patients, courriers).",
          "Le kick-off se passe systématiquement en présentiel à Nîmes : validation des intégrations, alignement des équipes, accès aux données. Itérations à distance ensuite.",
          "Recette finale toujours en présentiel à Nîmes : passation de pouvoir, formation des équipes ambassadrices, remise du runbook.",
          "Formation incluse : vos ambassadeurs internes deviennent autonomes sur la solution déployée après la fin de mission.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Nîmes : revue de l'architecture cible (CRM, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site à Nîmes : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site à Nîmes : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook, plan de monitoring.",
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
              "Implémentation d'un cas d'usage simple (lecture devis/factures, comptes-rendus, qualification leads) pour artisans et petites structures nîmoises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs, intégration CRM/ERP. Pour PME BTP, services, négoce et agroalimentaire du Gard.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, datalake), formation d'ambassadeurs cross-département pour les ETI gardoises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands groupes du Gard (BRL, Royal Canin, CHU Carémeau) : cas d'usage cascadés, gouvernance IA centralisée, équipe Axion-IA dédiée en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'implémentation de la lecture automatique de nos bons de commande et factures fournisseurs a libéré plusieurs équivalents temps plein sur des tâches admin. ROI réel mesuré conforme au SOW. Aucun lock-in, on a la main sur les modèles.",
            role: "DAF",
            companyProfile: "ETI négoce matériaux, bassin nîmois, ~400 collaborateurs",
          },
          {
            quote:
              "Kick-off intense sur site, puis itérations à distance avec des points courts et efficaces. Notre équipe IT n'a jamais été perdue dans la méthode. Les ambassadeurs internes sont totalement autonomes depuis le go-live.",
            role: "DSI",
            companyProfile: "PME ingénierie et services, Nîmes, ~120 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Nîmes ?",
            a: "Cela dépend de l'ampleur du projet. Un POC pour TPE peut tenir en quelques semaines, une mission PME sur quelques mois, une mission ETI sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions nîmoises. SOW signé au démarrage avec scope précis et livrables définis. Si le scope change en cours, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel disponible. Aucun lock-in : vous pouvez aussi faire appel à un autre prestataire.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour les entreprises nîmoises ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité maximale ; fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur nos données métier ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (factures importantes, contrats, données RH), monitoring continu. Le ROI chiffré au SOW intègre une marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : aucune dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après un an de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement du déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Nîmes brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Nîmes premises. Tailored to Gard realities: construction, engineering, trade, agri-food, health.",
        whyHere: [
          "Nîmes concentrates AI use cases with high immediate ROI: construction quote automation, purchase order and invoice reading, meeting minute generation, commercial lead qualification.",
          "BRL Groupe, Royal Canin (Aimargues) and Perrier (Vergèze) subcontractors represent a fabric of SMEs and mid-caps with real needs for AI integration into their ERPs and CRMs.",
          "CHU Carémeau and Gard medico-social structures have specific needs for administrative document automation (meeting minutes, patient files, correspondence).",
          "Kick-off always happens in person in Nîmes: integration validation, team alignment, data access. Remote iterations afterwards.",
          "Final acceptance always in person in Nîmes: handover, training of ambassador teams, runbook delivery.",
          "Training included: your internal ambassadors become autonomous on the deployed solution after mission end.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Nîmes workshop: target architecture review (CRM, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site in Nîmes: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Nîmes: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
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
              "Implementation of a simple use case (quote/invoice reading, meeting minutes, lead qualification) for Nîmes tradespeople and small structures.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, ambassador training, CRM/ERP integration. For Gard construction, services, trade and agri-food SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, datalake), cross-department ambassador training for Gard mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for major Gard groups (BRL, Royal Canin, CHU Carémeau): cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "The automatic reading of our purchase orders and supplier invoices freed several FTEs from admin tasks. Real ROI measured in line with the SOW. No lock-in, we control our models.",
            role: "CFO",
            companyProfile: "Building materials distribution mid-cap, Nîmes basin, ~400 staff",
          },
          {
            quote:
              "Intense on-site kick-off, then remote iterations with short, efficient check-ins. Our IT team was never lost in the method. Internal ambassadors have been fully autonomous since go-live.",
            role: "CIO",
            companyProfile: "Engineering and services SME, Nîmes, ~120 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Nîmes take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Nîmes missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment and new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance is desired, optional support contract available. No lock-in: you can also engage another vendor.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use for Nîmes businesses?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on our business data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large invoices, contracts, HR data), continuous monitoring. The costed ROI in the SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause and offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Nîmes ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise). Aucun supplément géographique : le tarif est le même à Nîmes que partout en France. Frais de déplacement et hébergement facturés séparément.",
    },
    {
      q: "Quels secteurs nîmois sont les plus concernés par l'IA ?",
      a: "Le BTP (devis, comptes-rendus chantier, gestion documentaire), les services aux entreprises (qualification leads, automatisation emails, reporting) et l'agroalimentaire (traceabilité, gestion documentaire) sont nos cas prioritaires dans le Gard. La santé administrative (CHU Carémeau, cliniques) et l'ingénierie (BRL Groupe, sous-traitants) sont également très pertinents.",
    },
    {
      q: "Avez-vous des cas clients dans le Gard ou à Nîmes ?",
      a: "Oui. Nos références locales couvrent des PME du BTP, des ETI de négoce et de services aux entreprises du bassin nîmois. Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par secteur et par zone géographique.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos locaux à Nîmes ?",
      a: "Oui. Toutes nos interventions nîmoises sont par défaut sur site dans vos bureaux ou ateliers. Nos consultants couvrent Nîmes centre, le Parc Georges Besse, la zone Grézan, et le bassin nîmois (Marguerittes, Bouillargues, Manduel, Beaucaire). Frais de déplacement et hébergement facturés à part.",
    },
    {
      q: "Axion-IA peut-il intervenir pour des entreprises liées au tourisme ou à la Féria de Nîmes ?",
      a: "Oui. Le tissu touristique et événementiel nîmois (hôtels, restaurants, prestataires Féria, musées, agences événementielles) bénéficie de cas IA concrets : gestion des réservations, communication clients, analyse de feedback, automatisation des emails. L'Audit Flash est particulièrement adapté aux TPE de ce secteur.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Nîmes ?",
      a: "Le délai dépend de votre besoin — urgence, complexité, taille de la mission. Nous convenons d'une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],
};
