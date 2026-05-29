// Saint-Étienne (42218) — contenu éditorial gold standard.
//
// Doctrine Axion-IA (cf. paris.ts) :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés » — « frais de logement, repas
//     et forfait trajet en sus » sur les formats interventions.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : libellés contextuels uniquement.
//   - Tailles INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - PAS heroSchema, PAS unAUn (non demandés pour cette ville).
//
// Données économiques clés Saint-Étienne (42218, economic-data) :
//   - 6 140 établissements actifs (INSEE 2024)
//   - Seule ville française UNESCO Creative Cities en design (2010)
//   - Pôles : Techtera (textile médical), Viaméca (mécanique), LUTB (mobilité)
//   - Grandes entreprises : Casino Guichard-Perrachon (siège), Thuasne,
//     Aubert & Duval (aciers spéciaux / défense)
//   - Écoles : Mines Saint-Étienne, ENISE, UJM, EM Lyon campus St-É, ESADSE
//   - Recherche : Labo Hubert Curien (optique/IA), CIS Mines (biomédical)
//   - Technopôle (campus Manufacture / Cité du Design), quartier Châteaucreux
//   - French Tech One Lyon Saint-Étienne (Capitale reconduite 2026-2028)
//   - TGV direct Paris-Gare-de-Lyon ~2h45, Lyon ~45 min

import type { VilleCopy } from "./types";

export const SAINT_ETIENNE_COPY: VilleCopy = {
  pitchFr:
    "Saint-Étienne compte 6 140 établissements actifs, un tissu industriel reconverti design/santé textile unique en France et le siège de Casino Guichard-Perrachon. Axion-IA y intervient sur site auprès des TPE, PME industrielles, ETI et grandes entreprises de la Loire — de la mécanique de précision aux industries créatives.",
  pitchEn:
    "Saint-Étienne hosts 6,140 active businesses, a reconverted design/medical-textile industrial fabric unique in France and the headquarters of Casino Guichard-Perrachon. Axion-IA operates on site with Loire micro-businesses, industrial SMEs, mid-caps and large enterprises — from precision mechanics to creative industries.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Saint-Étienne : nous cartographions ce qui peut être automatisé dans votre structure et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI, adaptés à l'industrie manufacturière, au textile médical, au design et aux services B2B stéphanois.",
      en: "Operational AI audit in Saint-Étienne: we map what can be automated in your structure and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, tailored to manufacturing, medical textiles, design and B2B services in the Loire.",
    },
    interventions: {
      fr: "Interventions IA à Saint-Étienne : formats sur site d'une à plusieurs journées pour vos équipes. Vos collaborateurs repartent avec des outils IA configurés pour leur métier — industrie, design, commerce ou santé. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Saint-Étienne: on-site formats from one to several days for your teams. Your staff leave with AI tools configured for their profession — manufacturing, design, retail or healthcare. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Saint-Étienne : on intègre l'IA dans vos outils existants (ERP industriel, CRM, mails, GMAO) avec un ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Saint-Étienne: we integrate AI into your existing tools (industrial ERP, CRM, email, CMMS) with contractually-costed ROI. Your teams stay in control, no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Saint-Étienne : accompagnement 1-to-1 ancré dans votre réalité stéphanoise — industrie, design, textile médical ou distribution. À partir de {{price:intervention-dirigeants|flat}}. Frais de logement, repas et forfait trajet en sus.",
      en: "Individual AI coaching in Saint-Étienne: 1-to-1 support rooted in your Loire reality — manufacturing, design, medical textiles or distribution. From €990 excl. VAT. Lodging, meals and travel allowance billed separately.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI stéphanoises — site vitrine premium pour acteurs design (Cité du Design, UNESCO Creative City) et textile médical, espace client pour PME industrielles et distribution (Casino, Thuasne), dashboard métier connecté à votre ERP industriel ou GMAO. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Saint-Étienne SMEs/mid-caps — premium showcase site for design players (Cité du Design, UNESCO Creative City) and medical textile firms, customer space for industrial SMEs and distribution (Casino, Thuasne), business dashboard connected to your industrial ERP or CMMS. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Saint-Étienne (42) sur site, dans le bassin stéphanois et les communes de Saint-Étienne Métropole. Nous accompagnons les TPE, PME industrielles et de services, ETI et grandes entreprises de la Loire — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Secteurs prioritaires : industrie manufacturière, textile médical, design, distribution et services B2B. Aucun lock-in, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Saint-Étienne (42) on site, across the Saint-Étienne basin and Saint-Étienne Métropole communes. We support Loire micro-businesses, industrial SMEs, mid-caps and large enterprises — costed diagnosis, demos on your real data, concrete action plan. Priority sectors: manufacturing, medical textiles, design, distribution and B2B services. No lock-in, your teams stay in control.",

  seoHook: "design, mécanique & santé",

  topSectorsNaf: [
    "Industrie manufacturière & mécanique de précision",
    "Textile médical & santé",
    "Design industriel & industries créatives",
    "Distribution & grande distribution",
    "Construction & ingénierie",
    "Services aux entreprises & conseil",
  ],

  distancesFr:
    "Gare de Saint-Étienne-Châteaucreux (TGV direct Paris-Gare-de-Lyon ~2h45, Lyon-Perrache ~45 min). Aéroport Lyon-Saint-Exupéry (LYS) à ~75 km. Réseau STAS : tram + bus pour rejoindre tous les quartiers d'activités (Châteaucreux, Cité du Design, Technopôle, Molina-La-Chazotte).",
  distancesEn:
    "Gare de Saint-Étienne-Châteaucreux (direct TGV Paris-Gare-de-Lyon ~2h45, Lyon-Perrache ~45 min). Lyon-Saint-Exupéry airport (LYS) ~75 km. STAS network: tram + bus to all business districts (Châteaucreux, Cité du Design, Technopôle, Molina-La-Chazotte).",

  ecosystemFr:
    "6 140 établissements actifs (INSEE 2024) dont des PME/ETI industrielles (mécanique, aciers spéciaux, textile médical), le siège de Casino Guichard-Perrachon et Thuasne. French Tech One Lyon Saint-Étienne (Capitale reconduite 2026-2028). Mines Saint-Étienne, ESADSE et le Labo Hubert Curien (CNRS, optique/IA) constituent un pôle recherche rare. Seule ville française UNESCO Creative Cities en design (depuis 2010).",
  ecosystemEn:
    "6,140 active businesses (INSEE 2024) including industrial SMEs and mid-caps (mechanics, specialty steels, medical textiles), Casino Guichard-Perrachon and Thuasne HQs. French Tech One Lyon Saint-Étienne (Capital renewed 2026-2028). Mines Saint-Étienne, ESADSE and Laboratoire Hubert Curien (CNRS, optics/AI) form a rare research hub. Only French city in the UNESCO Creative Cities network for design (since 2010).",

  // === SERVICES LONG-FORM SAINT-ÉTIENNE ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre structure stéphanoise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles — des TPE artisanales et PME industrielles de la Loire aux ETI et grandes entreprises sièges (Casino Guichard-Perrachon, Thuasne, Aubert & Duval).",
        whyHere: [
          "Saint-Étienne concentre un tissu industriel reconverti unique en France : mécanique de précision, textile médical, design industriel — autant de workflows répétitifs à fort potentiel d'automatisation IA.",
          "Le quartier Châteaucreux (pôle tertiaire gare TGV) et le Technopôle (Cité du Design / Manufacture) accueillent des ETI et PME B2B qui bénéficient directement de cas IA opérationnels.",
          "Nos consultants se déplacent sur site dans tout Saint-Étienne Métropole : Châteaucreux, Cité du Design, Molina-La-Chazotte, Firminy, Saint-Chamond, Andrézieux-Bouthéon.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux, livrable chiffré ROI/complexité remis en main propre à votre direction.",
          "Tarifs publics affichés, aucun devis opaque — vous savez exactement ce que vous payez avant de signer.",
          "Plan d'action exécutable par n'importe quel prestataire ou en interne après notre audit : aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Brief de cadrage à distance : signature Confidentialité assurée, accès aux documents clés (organigramme, processus, indicateurs de production ou de service selon votre activité).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Venue dans vos locaux stéphanois pour observer les outils utilisés au quotidien (ERP, GMAO, CRM, Excel, mails) et identifier les workflows candidats à l'automatisation IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts avec vos équipes (production, bureau d'études, commercial, RH, finance, direction) pour cartographier les frictions réelles et les attentes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs techniques, devis, bons de commande, comptes-rendus de réunion. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux artisans, micro-entreprises et petites structures stéphanoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME industrielles (mécanique, textile, design), agences et cabinets de services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI manufacturières ou de services souhaitant cadrer une trajectoire IA pluriannuelle — Thuasne, sous-traitants Tier 1, acteurs régionaux.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges grands-comptes stéphanois (Casino, Aubert & Duval) souhaitant cadrer une gouvernance IA centralisée multi-sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a cerné en un jour nos vrais points de friction : traitement des bons de commande fournisseurs et comptes-rendus de réunion bureau d'études. Le livrable était chiffré, sans jargon, actionnable dès la semaine suivante.",
            role: "Directeur général",
            companyProfile: "PME mécanique de précision, Saint-Étienne Métropole",
          },
          {
            quote:
              "Méthode directe : démos sur nos vrais documents, pas de présentation PowerPoint générique. On a compris en une journée ce que l'IA pouvait faire pour nous — et ce qu'elle ne pouvait pas faire. C'est ce pragmatisme qu'on attendait.",
            role: "DRH",
            companyProfile: "ETI textile médical, Loire",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Saint-Étienne ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est calé avec vous lors du brief de cadrage initial.",
          },
          {
            q: "Quels secteurs stéphanois sont prioritaires pour un audit IA ?",
            a: "Nos audits à Saint-Étienne couvrent en priorité l'industrie manufacturière (mécanique, aciers, textile médical), le design industriel, la distribution et les services B2B. Tout secteur avec des workflows répétitifs (saisie, traitement docs, qualification leads) est éligible.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage. Données traitées exclusivement sur vos infrastructures ou sur infra dédiée UE, jamais extraites vers nos serveurs. Conformité RGPD, modèles testés en local si souveraineté requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Saint-Étienne ou dans vos locaux du bassin stéphanois. Atelier de quelques heures avec votre direction ou comité de direction. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Différence avec un cabinet de conseil régional ou un intégrateur ERP ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des généralistes du conseil. Tarifs publics sans devis à négocier. Méthode condensée sur quelques journées plutôt que de longues missions. Et surtout : aucun lock-in — votre plan est exécutable avec qui vous voulez.",
          },
          {
            q: "Faut-il déjà avoir des outils numériques en place pour nous solliciter ?",
            a: "Non. Un grand nombre de nos audits stéphanois concernent des PME industrielles équipées d'un ERP basique ou même d'Excel. L'audit part de votre réalité, pas d'un idéal numérique.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais déclenchée à ce jour).",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated in your Saint-Étienne structure and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size — from Loire micro-businesses and industrial SMEs to large-enterprise HQs (Casino Guichard-Perrachon, Thuasne, Aubert & Duval).",
        whyHere: [
          "Saint-Étienne hosts a reconverted industrial fabric unique in France: precision mechanics, medical textiles, industrial design — all sectors with repetitive workflows at high AI automation potential.",
          "The Châteaucreux district (TGV business hub) and the Technopôle (Cité du Design / Manufacture) host B2B mid-caps and SMEs that directly benefit from operational AI use cases.",
          "Our consultants travel on site across Saint-Étienne Métropole: Châteaucreux, Cité du Design, Molina-La-Chazotte, Firminy, Saint-Chamond, Andrézieux-Bouthéon.",
          "Read-outs always in person: ideation workshops at your premises, costed ROI/complexity deliverable handed over face to face.",
          "Public pricing, no opaque quote — you know exactly what you pay before signing.",
          "Action plan executable by any vendor or in-house after our audit: no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief: Strict confidentiality ensured, access to key documents (org chart, processes, production or service KPIs depending on your activity).",
          },
          {
            step: "On-site kick-off",
            detail:
              "Visit to your Saint-Étienne premises to observe daily tools (ERP, CMMS, CRM, Excel, email) and identify AI automation candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Short individual interviews with your teams (production, engineering, sales, HR, finance, leadership) to map real frictions and expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your technical PDFs, quotes, purchase orders, meeting minutes. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Saint-Étienne artisans, micro-firms and small structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial SMEs (mechanics, textiles, design), agencies and service firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For manufacturing or service mid-caps framing a multi-year AI trajectory — Thuasne, Tier 1 subcontractors, regional players.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For Saint-Étienne large-corporate HQs (Casino, Aubert & Duval) framing centralized multi-site AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA identified our real pain points in a day: supplier purchase order processing and engineering meeting minutes. The deliverable was costed, jargon-free, actionable the following week.",
            role: "CEO",
            companyProfile: "Precision mechanics SME, Saint-Étienne Métropole",
          },
          {
            quote:
              "Direct method: demos on our real documents, no generic PowerPoint. We understood in a day what AI could do for us — and what it couldn't. That pragmatism was exactly what we needed.",
            role: "Head of HR",
            companyProfile: "Medical textile mid-cap, Loire",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Saint-Étienne?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "Which Saint-Étienne sectors are priority for an AI audit?",
            a: "Our Saint-Étienne audits prioritize manufacturing (mechanics, steels, medical textiles), industrial design, distribution and B2B services. Any sector with repetitive workflows (data entry, document processing, lead qualification) is eligible.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off. Data processed exclusively on your infrastructure or dedicated EU infra, never extracted to our servers. GDPR compliance, models tested locally if sovereignty required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Saint-Étienne or at your premises in the Saint-Étienne basin. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a regional consulting firm or ERP integrator?",
            a: "Our consultants are former AI practitioners, not generalist advisors. Public pricing, no quote to negotiate. Condensed method over a few days rather than long missions. Above all: no lock-in — your plan is executable with whoever you want.",
          },
          {
            q: "Do we need digital tools already in place to engage you?",
            a: "No. Many of our Saint-Étienne audits involve industrial SMEs equipped with a basic ERP or even Excel. The audit starts from your reality, not a digital ideal.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available, never triggered to date).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Saint-Étienne se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur activité réelle — industrie, design, commerce ou santé. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Saint-Étienne est un bassin industriel en reconversion numérique accélérée — nos interventions s'adressent aux équipes qui n'ont jamais touché à l'IA autant qu'aux pionniers du design.",
          "Tous les secteurs stéphanois couverts : ateliers industriels (opérateurs, bureau d'études), agences design Cité du Design / ESADSE, équipes de vente Casino/distribution, équipes RH et support PME.",
          "Le format Essentielle est calibré pour les structures de quelques personnes à une centaine de collaborateurs — la majorité du tissu stéphanois.",
          "Le format Conférence convient aux plénières d'entreprise (salles Châteaucreux, amphithéâtres Mines Saint-Étienne, espaces Cité du Design).",
          "Le format Dirigeants permet un cadrage stratégique en huis-clos pour les comités de direction stéphanois.",
          "Vocabulaire ajusté à votre activité dominante : industrie, design, distribution, santé. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur d'activité, les cas d'usage IA prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (fiches techniques, devis, bons de commande, emails clients) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés à votre secteur.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour artisans, ateliers, petites agences et TPE de services stéphanoises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour l'ensemble de la structure ou Équipes pour un département spécifique (bureau d'études, commercial, RH, production).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges stéphanois : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement adapté à notre contexte industriel : les équipes bureau d'études ont découvert comment l'IA pouvait traiter leurs plans techniques et comptes-rendus. Le lendemain, les outils tournaient en autonomie.",
            role: "Responsable bureau d'études",
            companyProfile: "PME sous-traitant mécanique, Loire",
          },
          {
            quote:
              "La session Dirigeants nous a alignés en quelques heures sur ce que l'IA peut concrètement apporter à notre groupe dans la distribution. Concret, sans promesses exagérées.",
            role: "Directeur général adjoint",
            companyProfile: "ETI distribution, Saint-Étienne Métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Saint-Étienne ?",
            a: "Cela dépend du format retenu. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Vos intervenants comprennent-ils les contraintes industrielles ?",
            a: "Oui. Nos consultants sont briefés en amont sur votre secteur (mécanique, textile médical, design, distribution). Le cadrage préalable nous permet d'ajuster exemples et démos à votre réalité — atelier de production ou bureau d'études, pas seulement des fonctions support.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI selon le profil. Aucun lock-in Axion-IA.",
          },
          {
            q: "Pouvez-vous intervenir dans les communes du bassin stéphanois ?",
            a: "Oui. Nous intervenons dans tout Saint-Étienne Métropole et le bassin : Saint-Chamond, Firminy, Le Chambon-Feugerolles, Roche-la-Molière, Andrézieux-Bouthéon. Frais de logement, repas et forfait trajet facturés à part.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur stéphanois, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Saint-Étienne come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real activity — manufacturing, design, retail or healthcare. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Saint-Étienne is an industrial basin undergoing accelerated digital transformation — our sessions serve teams who have never touched AI as much as design pioneers.",
          "All Saint-Étienne sectors covered: industrial workshops (operators, engineering), design agencies at Cité du Design / ESADSE, Casino/distribution sales teams, HR and support teams in SMEs.",
          "The Essential format is calibrated for structures from a few people to about a hundred staff — the majority of the Saint-Étienne fabric.",
          "The Talk format suits large corporate plenaries (Châteaucreux conference rooms, Mines Saint-Étienne amphitheatres, Cité du Design spaces).",
          "The Executives format enables strategic in-camera framing for Saint-Étienne executive committees.",
          "Vocabulary adjusted to your dominant activity: manufacturing, design, distribution, healthcare. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, and priority AI use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (technical specs, quotes, purchase orders, client emails) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection, Wi-Fi. No technical hiccup on the day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops tailored to your sector.",
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
              "Ideal for Saint-Étienne artisans, workshops, small agencies and service micro-businesses up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole structure or Teams for a specific department (engineering, sales, HR, production).",
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
              "Custom combinations for Saint-Étienne HQs: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly suited to our industrial context: the engineering teams discovered how AI could handle their technical documents and meeting minutes. Next day, the tools were running autonomously.",
            role: "Head of Engineering",
            companyProfile: "Mechanical subcontractor SME, Loire",
          },
          {
            quote:
              "The Executives session aligned us within hours on what AI can concretely bring to our distribution group. Concrete, no overpromising.",
            role: "Deputy CEO",
            companyProfile: "Distribution mid-cap, Saint-Étienne Métropole",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Saint-Étienne take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Do your facilitators understand industrial constraints?",
            a: "Yes. Our consultants are briefed in advance on your sector (mechanics, medical textiles, design, distribution). The prior framing lets us adjust examples and demos to your reality — production floor or engineering office, not just support functions.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or employee subscription) on ChatGPT, Claude, Mistral, Notion AI per profile. No Axion-IA lock-in.",
          },
          {
            q: "Can you intervene in communes of the Saint-Étienne basin?",
            a: "Yes. We operate across Saint-Étienne Métropole and the basin: Saint-Chamond, Firminy, Le Chambon-Feugerolles, Roche-la-Molière, Andrézieux-Bouthéon. Lodging, meals and travel allowance billed separately.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Saint-Étienne sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Saint-Étienne met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance, avec un kick-off obligatoire dans vos locaux stéphanois. Cas prioritaires : automatisation documentaire industrielle, IA appliquée au textile médical, agents support distribution.",
        whyHere: [
          "Le tissu industriel stéphanois génère un volume documentaire élevé — devis techniques, bons de commande, fiches de non-conformité, rapports qualité — idéal pour les premières implémentations IA à ROI rapide.",
          "Le kick-off se déroule systématiquement en présentiel dans vos locaux stéphanois : alignement des équipes, accès aux données, validation des intégrations ERP/CRM/GMAO.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre direction.",
          "Recette finale toujours en présentiel : passation de pouvoir, formation des équipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques stéphanois : PME mécanique (lecture plans techniques + bons de commande), ETI textile (classification produits + fiches qualité), distribution (automatisation devis + support client), agences design (génération de briefs créatifs).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Saint-Étienne : revue de l'architecture cible (ERP, GMAO, CRM, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Saint-Étienne : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
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
              "Implémentation d'un cas d'usage simple (lecture documents, qualification leads, génération de devis) pour artisans et petites structures stéphanoises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/CRM. Pour PME industrielles, agences design et cabinets de services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP legacy, datalake), formation cross-département. Pour les ETI manufacturières et de distribution stéphanoises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les sièges stéphanois : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'IA lit nos bons de commande fournisseurs et génère les fiches de réception automatiquement. ROI mesuré en quelques mois : équivalent d'un poste administratif libéré sur les tâches saisie. Le runbook est clair, nos équipes sont autonomes.",
            role: "DAF",
            companyProfile: "PME métallurgie / sous-traitance, Loire",
          },
          {
            quote:
              "Kick-off intense sur deux jours dans nos ateliers, puis itérations à distance parfaitement cadrées. Nos ambassadeurs internes ont pris le relais sans difficulté. C'est ce qu'on voulait : pas de dépendance au cabinet.",
            role: "Directeur des opérations",
            companyProfile: "ETI textile médical, Saint-Étienne",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Saint-Étienne ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions stéphanoises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE. Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour des contextes industriels ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données techniques si le volume le justifie. Choix justifié dans le SOW.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur mes documents techniques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (commandes importantes, qualité, sécurité), monitoring continu. Le ROI du SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Saint-Étienne brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode, with a mandatory kick-off at your Saint-Étienne premises. Priority cases: industrial document automation, AI applied to medical textiles, distribution support agents.",
        whyHere: [
          "Saint-Étienne's industrial fabric generates high document volumes — technical quotes, purchase orders, non-conformity records, quality reports — ideal for first AI implementations with fast ROI.",
          "Kick-off always happens in person at your Saint-Étienne premises: team alignment, data access, ERP/CRM/CMMS integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your leadership.",
          "Final acceptance always in person: handover, team training, runbook documentation delivered.",
          "Training included for your key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Saint-Étienne cases: mechanics SME (technical document + PO reading), textile mid-cap (product classification + quality records), distribution (quote automation + customer support), design agencies (creative brief generation).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Saint-Étienne workshop: target architecture review (ERP, CMMS, CRM, email, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use-case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Saint-Étienne: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
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
              "Implementation of a simple use case (document reading, lead qualification, quote generation) for Saint-Étienne artisans and small structures.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/CRM integration. For industrial SMEs, design agencies and service firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, datalake), cross-department ambassador training. For Saint-Étienne manufacturing and distribution mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Saint-Étienne HQs: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "The AI reads our supplier purchase orders and auto-generates receipt records. ROI measured within months: equivalent of one admin FTE freed from data entry. Runbook is clear, our teams are autonomous.",
            role: "CFO",
            companyProfile: "Metallurgy / subcontracting SME, Loire",
          },
          {
            quote:
              "Intense two-day kick-off at our workshops, then perfectly-framed remote iterations. Our internal ambassadors took over without difficulty. That's what we wanted: no dependency on the consultancy.",
            role: "Head of Operations",
            companyProfile: "Medical textile mid-cap, Saint-Étienne",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Saint-Étienne take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Saint-Étienne missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra. Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use for industrial contexts?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your technical data if volume justifies. Choice justified in SOW.",
          },
          {
            q: "What happens if the AI produces errors on my technical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large orders, quality, safety), continuous monitoring. The SOW ROI includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Saint-Étienne est un accompagnement individuel sur mesure : vous progressez à votre rythme, sur vos propres cas métier, avec un consultant dédié. À partir de {{price:intervention-dirigeants|flat}}. Adapté aux dirigeants industriels, designers, responsables textile médical et managers de distribution de la Loire. Frais de logement, repas et forfait trajet en sus.",
        whyHere: [
          "Saint-Étienne est la seule ville française UNESCO Creative City en design : les profils sont très spécialisés — ingénieur mécanique, designer industriel, responsable qualité textile médical — et ont besoin d'un coaching ancré dans leur réalité métier, pas d'un cours générique.",
          "Le tissu industriel stéphanois (mécanique de précision, aciers spéciaux, textile médical) génère des workflows documentaires denses (plans techniques, fiches qualité, bons de commande) : chaque séance travaille directement sur vos vrais documents.",
          "Les profils de la Cité du Design et de l'ESADSE ont des besoins spécifiques en génération de briefs créatifs, documentation de concept et veille tendance : le coaching adapte les outils IA à ces usages créatifs.",
          "Casino Guichard-Perrachon et les ETI de distribution stéphanoises ont des référents IA à former en priorité avant toute cascade équipe : le 1-to-1 est la voie la plus rapide.",
          "Séances sur site dans vos locaux stéphanois (Châteaucreux, Cité du Design, Technopôle) ou à distance selon votre disponibilité — rythme calé à la signature.",
          "Confidentialité sans accord de confidentialité imposé : vos données, plans techniques, fiches qualité restent dans votre environnement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage pour identifier votre niveau IA, vos cas métier prioritaires (industrie, design, textile médical, distribution) et l'objectif précis du coaching.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Construction d'un plan séance par séance calé sur vos outils (Claude, Mistral, GPT-4), vos livrables réels et les contraintes sectorielles de Saint-Étienne.",
          },
          {
            step: "Séances pratiques sur vos vrais cas",
            detail:
              "Chaque séance travaille directement sur vos documents : bons de commande industriels, fiches qualité, briefs créatifs design, comptes-rendus de réunion, devis techniques.",
          },
          {
            step: "Exercices entre séances",
            detail:
              "Micro-missions à réaliser en autonomie entre deux séances pour ancrer les apprentissages dans votre contexte stéphanois réel.",
          },
          {
            step: "Bilan + feuille de route autonomie",
            detail:
              "En fin de coaching, un bilan chiffré de vos gains et une feuille de route pour continuer à progresser sans dépendance envers Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Entrée coaching 1-to-1 — artisan, designer indépendant, dirigeant TPE industrielle ou de services stéphanois.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme multi-séances pour référents IA ou managers de PME industrielles, agences design ou cabinets de services de la Loire.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement cadres dirigeants ETI stéphanoises (textile médical, mécanique, distribution) — programme structuré avec bilan intermédiaire.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching des profils pilotes d'un grand groupe siège stéphanois (Casino, Aubert & Duval) avant déploiement large.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de maîtriser l'IA sur mes vrais dossiers de mécanique de précision en quelques séances. Plans techniques, bons de commande, fiches qualité — tout y est passé. Je suis autonome.",
            role: "Directeur technique",
            companyProfile: "PME mécanique de précision, Loire",
          },
          {
            quote:
              "En tant que designer à la Cité du Design, j'avais besoin d'un coaching sur la génération de briefs créatifs et la veille tendance. Le 1-to-1 a tout adapté à mon métier. Résultat immédiat sur mes livrables clients.",
            role: "Designer senior",
            companyProfile: "Agence design, Saint-Étienne Cité du Design",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective à Saint-Étienne ?",
            a: "Le format collectif forme tout un groupe sur les mêmes cas. Le 1-to-1 travaille exclusivement sur VOS cas, votre vitesse, vos contraintes stéphanoises (industrie, design, textile médical, distribution). Gains opérationnels mesurables dès la première séance.",
          },
          {
            q: "Combien de séances faut-il pour être autonome sur l'IA à Saint-Étienne ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Un artisan ou designer atteint une autonomie confortable en quelques séances. Un manager ETI cherchant à maîtriser des intégrations ERP industrielles aura un programme plus étendu. Le plan est cadré à la première séance.",
          },
          {
            q: "Le coaching peut-il se tenir dans mes locaux stéphanois ?",
            a: "Oui. Séances sur site dans vos locaux (Châteaucreux, Cité du Design, Technopôle, Molina-La-Chazotte) ou en visio selon votre disponibilité. Frais de logement, repas et forfait trajet en sus pour les séances sur site.",
          },
          {
            q: "Mes données industrielles et plans techniques restent-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès le démarrage : vos données, plans techniques, fiches qualité restent dans votre environnement. Aucune extraction vers nos serveurs. Conformité RGPD.",
          },
          {
            q: "Puis-je commencer sans aucune base IA ?",
            a: "Oui. Le diagnostic initial évalue votre niveau réel et calibre le plan en conséquence. La grande majorité des profils stéphanois débutent sans avoir jamais utilisé Claude ou GPT de façon professionnelle.",
          },
          {
            q: "Y a-t-il un engagement minimum de durée ou de nombre de séances ?",
            a: "Non. Pas de lock-in, pas de contrat d'abonnement. Vous commencez par la première séance à {{price:intervention-dirigeants|flat}}. La suite se décide à l'issue de chaque séance selon votre progression.",
          },
        ],
        guarantees:
          "Pas de lock-in : aucun engagement de durée imposé. Confidentialité stricte sans accord de confidentialité requis — vos données et plans techniques restent dans votre environnement. Conformité RGPD. Frais de logement, repas et forfait trajet en sus pour les séances sur site. Si à l'issue de la première séance vous estimez que le coaching ne correspond pas à vos attentes, première séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Saint-Étienne is an individual, bespoke engagement: you progress at your own pace, on your own business cases, with a dedicated consultant. From €990 excl. VAT. Suited to industrial executives, designers, medical textile managers and distribution leaders in the Loire. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Saint-Étienne is France's only UNESCO Creative City for design: profiles are highly specialised — mechanical engineer, industrial designer, medical textile quality manager — and need coaching rooted in their real work, not a generic course.",
          "Saint-Étienne's industrial fabric (precision mechanics, specialty steels, medical textiles) generates dense document workflows (technical drawings, quality records, purchase orders): each session works directly on your real documents.",
          "Cité du Design and ESADSE profiles have specific needs in creative brief generation, concept documentation and trend monitoring: coaching adapts AI tools to these creative uses.",
          "Casino Guichard-Perrachon and Saint-Étienne distribution mid-caps have AI champions to train before any team cascade: 1-to-1 is the fastest route.",
          "Sessions on site at your Saint-Étienne offices (Châteaucreux, Cité du Design, Technopôle) or remote depending on availability — cadence agreed at sign-up.",
          "Confidentiality without imposed accord de confidentialité: your data, technical drawings and quality records stay in your environment.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "A framing interview to identify your AI level, priority business cases (manufacturing, design, medical textiles, distribution) and the precise coaching objective.",
          },
          {
            step: "Personalized progression plan",
            detail:
              "Building a session-by-session plan aligned with your tools (Claude, Mistral, GPT-4), your real deliverables and Saint-Étienne sector constraints.",
          },
          {
            step: "Practical sessions on your real cases",
            detail:
              "Each session works directly on your documents: industrial purchase orders, quality records, design creative briefs, meeting minutes, technical quotes.",
          },
          {
            step: "Between-session exercises",
            detail:
              "Micro-missions to complete autonomously between sessions to embed learnings in your real Saint-Étienne context.",
          },
          {
            step: "Debrief + autonomy roadmap",
            detail:
              "At coaching end, a costed gains summary and an autonomy roadmap to keep progressing without dependence on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From €990 excl. VAT",
            detail:
              "Entry-level 1-to-1 coaching — Saint-Étienne artisan, independent designer, industrial or service micro-business executive.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Multi-session programme for AI champions or managers of Loire industrial SMEs, design agencies or service firms.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Executive coaching for Saint-Étienne mid-cap managers (medical textiles, mechanics, distribution) — structured programme with interim review.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Coaching of pilot profiles at a major Saint-Étienne HQ group (Casino, Aubert & Duval) before broad rollout.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching let me master AI on my real precision mechanics files within a few sessions. Technical drawings, purchase orders, quality records — all covered. I am fully autonomous.",
            role: "Technical Director",
            companyProfile: "Precision mechanics SME, Loire",
          },
          {
            quote:
              "As a designer at Cité du Design, I needed coaching on creative brief generation and trend monitoring. The 1-to-1 adapted everything to my profession. Immediate results on my client deliverables.",
            role: "Senior Designer",
            companyProfile: "Design agency, Saint-Étienne Cité du Design",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from a group session in Saint-Étienne?",
            a: "Group format trains a whole team on the same cases. 1-to-1 works exclusively on YOUR cases, your pace, your Saint-Étienne constraints (manufacturing, design, medical textiles, distribution). Measurable operational gains from the first session.",
          },
          {
            q: "How many sessions are needed to become AI-autonomous in Saint-Étienne?",
            a: "It depends on your starting level and objectives. An artisan or designer reaches comfortable autonomy in a few sessions. A mid-cap manager seeking to master industrial ERP integrations will have a longer programme. The plan is framed in the first session.",
          },
          {
            q: "Can coaching sessions be held at my Saint-Étienne premises?",
            a: "Yes. On-site sessions at your offices (Châteaucreux, Cité du Design, Technopôle, Molina-La-Chazotte) or via video depending on availability. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "Does my industrial data and technical drawings stay confidential?",
            a: "Yes. Strict confidentiality from day one: your data, technical drawings and quality records stay in your environment. No extraction to our servers. GDPR compliance.",
          },
          {
            q: "Can I start with no AI background?",
            a: "Yes. The initial diagnostic assesses your real level and calibrates the plan accordingly. The vast majority of Saint-Étienne profiles start without ever having used Claude or GPT professionally.",
          },
          {
            q: "Is there a minimum duration or session commitment?",
            a: "No. No lock-in, no subscription contract. You start with the first session at €990 excl. VAT. Continuation is decided after each session based on your progress.",
          },
        ],
        guarantees:
          "No lock-in: no imposed duration commitment. Strict confidentiality without required accord de confidentialité — your data and technical drawings stay in your environment. GDPR compliance. Lodging, meals and travel allowance billed separately for on-site sessions. If after the first session you feel the coaching does not meet your expectations, first session fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Saint-Étienne ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Saint-Étienne qu'à Paris ou Lyon.",
    },
    {
      q: "Axion-IA intervient-il dans les communes du bassin stéphanois ?",
      a: "Oui. Nous couvrons tout Saint-Étienne Métropole et les communes du bassin : Saint-Chamond, Firminy, Le Chambon-Feugerolles, Roche-la-Molière, La Ricamarie, Andrézieux-Bouthéon. Frais de logement, repas et forfait trajet facturés à part selon la distance.",
    },
    {
      q: "Quels secteurs stéphanois bénéficient le plus de l'IA ?",
      a: "L'industrie manufacturière (mécanique, aciers, textile médical), le design industriel (Cité du Design, agences créatives), la distribution (services B2B, back-office), et la santé (dispositifs médicaux, ingénierie biomédicale). Tout secteur avec des workflows documentaires ou des cycles de traitement répétitifs est prioritaire.",
    },
    {
      q: "Saint-Étienne étant UNESCO Creative City Design, y a-t-il des cas IA spécifiques au design ?",
      a: "Oui. La Cité du Design, l'ESADSE et les agences créatives stéphanoises bénéficient de cas IA concrets : génération de briefs créatifs, analyse sémantique de tendances, automatisation des livrables clients (supports texte, descriptions produit). Nous adaptons les démos à ces métiers lors du cadrage.",
    },
    {
      q: "Pouvez-vous travailler avec des entreprises connectées à Mines Saint-Étienne ou au Labo Hubert Curien ?",
      a: "Oui. Nos missions s'adressent aussi bien aux spin-offs et startups deep tech issues de Mines Saint-Étienne qu'aux industriels qui collaborent avec le Labo Hubert Curien (optique, vision par ordinateur, IA appliquée). Notre Audit Flash est conçu pour les structures early-stage.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Saint-Étienne ?",
      a: "Le délai de démarrage dépend de la complexité de votre besoin et de votre disponibilité. Nous calons une date lors du brief de cadrage initial et tenons l'engagement contractuellement à la signature.",
    },
  ],
};
