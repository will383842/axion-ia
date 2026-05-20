// Annecy — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Doctrine appliquée :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés » : frais logement, repas et
//     forfait trajet facturés en sus sur les interventions.
//   - Aucun prix en dur : libellés contextuels uniquement (pricing.ts SSOT).
//   - Durée minimale = 1 journée. Pas de demi-journée.
//   - Tailles entreprises en langage INSEE : TPE / PME / ETI / GE.
//   - ~95 % Axion-IA-centric, ~5 % data économique locale anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn (non demandés pour cette ville pilote).
//
// Réalités Annecy ancrées :
//   - Salomon (siège historique Annecy-le-Vieux, groupe Amer Sports/Anta)
//   - Mavic (siège Annecy, composants cyclisme haut de gamme)
//   - Schneider Electric (site bassin annécien), Tefal/SEB (Rumilly 20 km)
//   - Pôle Mont-Blanc Industries (mécanique précision / décolletage)
//   - Outdoor Sports Valley (cluster sports outdoor, siège Annecy)
//   - USMB / Polytech / LISTIC (IA, vision) / SYMME (mécatronique)
//   - Festival international du film d'animation + MIFA (référence mondiale)
//   - French Tech in The Alps - Annecy
//   - Bassin transfrontalier Suisse / Genève (40 km)
//   - Reblochon AOP, Tomme de Savoie IGP, Abondance AOP, Beaufort AOP
//   - JO Alpes françaises 2030

import type { VilleCopy } from "./types";

export const ANNECY_COPY: VilleCopy = {
  pitchFr:
    "Annecy conjugue un tissu industriel d'excellence — Salomon, Mavic, Schneider Electric, Tefal/SEB à 20 km — avec le pôle de recherche LISTIC/SYMME (USMB), la French Tech in The Alps et une proximité directe avec Genève (40 km). Axion-IA y intervient sur site auprès des PME industrielles, des équipementiers outdoor et des services B2B du bassin annécien.",
  pitchEn:
    "Annecy combines outstanding industrial fabric — Salomon, Mavic, Schneider Electric, Tefal/SEB 20 km away — with the LISTIC/SYMME research hub (USMB), French Tech in The Alps and direct proximity to Geneva (40 km). Axion-IA delivers on site for industrial SMEs, outdoor equipment makers and B2B service firms across the Annecy basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Annecy : nous cartographions vos workflows automatisables et chiffrons le ROI pour les PME industrielles, les équipementiers outdoor et les services B2B du bassin annécien et transfrontalier.",
      en: "Operational AI audit in Annecy: we map your automatable workflows and quantify ROI for industrial SMEs, outdoor equipment makers and B2B service firms across the Annecy basin and cross-border area.",
    },
    interventions: {
      fr: "Interventions IA à Annecy : formats sur site d'une à plusieurs journées adaptés aux équipes industrielles, R&D et commerciales. Vos collaborateurs repartent outillés pour leur réalité métier. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Annecy: on-site formats from one to several days tailored to industrial, R&D and commercial teams. Your staff leave equipped for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Annecy : déploiement de l'IA dans vos outils existants (ERP industriel, CRM, qualité, logistique) avec ROI chiffré contractuel. Vos équipes gardent la main, aucun lock-in technologique.",
      en: "AI implementation in Annecy: deploying AI into your existing tools (industrial ERP, CRM, quality, logistics) with contractually-costed ROI. Your teams stay in control, no tech lock-in.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Annecy (74) sur site dans le bassin annécien, la Vallée de l'Arve et le secteur transfrontalier jusqu'à Genève. Nous accompagnons les TPE, PME, ETI et grandes entreprises savoyardes — équipementiers outdoor, industries de précision, services B2B — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Tarifs publics, aucun lock-in technologique, vos équipes restent autonomes.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Annecy (74) on site across the Annecy basin, the Vallée de l'Arve and the cross-border area up to Geneva. We support micro-businesses, SMEs, mid-caps and large enterprises in Savoie — outdoor equipment makers, precision industry, B2B services — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. Public pricing, no tech lock-in, your teams stay autonomous.",

  topSectorsNaf: [
    "Industries outdoor & équipements sportifs",
    "Mécanique de précision & mécatronique",
    "Commerce & services aux entreprises",
    "Industrie manufacturière & énergie",
    "Agroalimentaire & filières AOP/IGP",
    "Industries créatives & animation numérique",
  ],

  distancesFr:
    "Gare d'Annecy (TGV Paris ~3 h 45, liaisons Lyon et Genève). Genève-Cointrin (GVA) à 40 km par l'autoroute A41 — premier aéroport international du bassin. Lyon-Saint-Exupéry (LYS) à 140 km en alternative. Accès A41 direct depuis le cœur d'Annecy vers la Vallée de l'Arve et Rumilly.",
  distancesEn:
    "Annecy station (TGV Paris ~3 h 45, connections to Lyon and Geneva). Geneva-Cointrin (GVA) 40 km via A41 motorway — the basin's primary international airport. Lyon-Saint-Exupéry (LYS) 140 km as an alternative. Direct A41 access from central Annecy towards the Vallée de l'Arve and Rumilly.",

  ecosystemFr:
    "Pôle outdoor mondial (Salomon siège historique Annecy-le-Vieux, Mavic, Outdoor Sports Valley), mécanique de précision Mont-Blanc Industries, site Schneider Electric, Tefal/SEB à Rumilly (20 km), recherche LISTIC/SYMME (USMB), Festival international du film d'animation (capitale mondiale), French Tech in The Alps. Bassin transfrontalier Genève (~30 000 frontaliers).",
  ecosystemEn:
    "Global outdoor hub (Salomon historic HQ Annecy-le-Vieux, Mavic, Outdoor Sports Valley), Mont-Blanc Industries precision engineering, Schneider Electric site, Tefal/SEB in Rumilly (20 km), LISTIC/SYMME research (USMB), International Animation Film Festival (world capital), French Tech in The Alps. Cross-border Geneva basin (~30,000 cross-border workers).",

  // === SERVICES LONG-FORM ANNECY ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE artisanales savoyardes aux sites industriels des grands groupes implantés dans le bassin annécien.",
        whyHere: [
          "Le tissu industriel d'Annecy est en forte demande d'IA : automatisation qualité, optimisation logistique, R&D accélérée chez les équipementiers outdoor et les sous-traitants de précision.",
          "Nos consultants maîtrisent les enjeux spécifiques du secteur outdoor/montagne (cycles de développement produit, gestion saisonnière, contraintes normes EN/ISO) et de la mécanique de précision (traçabilité, contrôle qualité, maintenance prédictive).",
          "Proximité transfrontalière prise en compte : les PME à forte activité Genève ou à capitaux suisses bénéficient d'un regard bilingue sur les enjeux de conformité et de gouvernance des données.",
          "Restitutions toujours en présentiel à Annecy : atelier d'idéation dans vos locaux, lecture du livrable avec votre direction, plan d'action remis en main propre.",
          "Tarifs publics affichés : vous savez exactement ce que vous payez avant de signer. Aucun devis opaque à plusieurs tours de table.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Brief de cadrage à distance : signature du NDA, accès aux quelques documents clés (organigramme, cartographie des processus, indicateurs opérationnels). Identification des workflows candidats à l'IA propres à votre activité.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue dans vos locaux à Annecy ou sur site industriel (Vallée de l'Arve, Rumilly, Annecy-le-Vieux) pour observer les outils utilisés au quotidien — ERP, MES, CRM, outils qualité — et repérer les frictions concrètes.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts avec les équipes clés : bureau d'études, production, commerce, finance, RH. Cartographie fine des frictions, volumes traités, erreurs récurrentes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place ou en session dédiée : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs techniques, vos emails clients, vos rapports de contrôle qualité. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable 6-18 mois priorisée selon votre contexte industriel ou de service.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Audit Flash",
            detail:
              "Adapté aux artisans, indépendants, TPE industrielles et commerciales du bassin annécien jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour sous-traitants de précision, équipementiers outdoor de taille moyenne, cabinets de services B2B de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles ou de services souhaitant cadrer une trajectoire IA pluriannuelle (process, R&D, commerce, RH).",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites majeurs de grands groupes implantés dans le bassin (Schneider Electric, Amer Sports, Groupe SEB) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a su cadrer nos enjeux IA en partant de nos véritables contraintes industrielles — traçabilité, MES, ERP propriétaire. Le livrable est chiffré et directement exploitable par notre direction technique.",
            role: "Directeur technique",
            companyProfile: "PME mécanique de précision, Vallée de l'Arve",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données réelles de contrôle qualité. On a priorisé trois chantiers IA pour notre comité de direction avec un ROI estimé solide. Aucun jargon, aucun lock-in.",
            role: "Directrice générale",
            companyProfile: "ETI équipementier outdoor, bassin annécien",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Annecy ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est défini en cadrage selon votre disponibilité et votre organisation.",
          },
          {
            q: "Quelle valeur apporte un audit pour une PME industrielle d'Annecy ?",
            a: "Sur les PME de mécanique de précision ou d'équipement outdoor, le ROI identifié porte typiquement sur la qualité (réduction des non-conformités), la traçabilité (automatisation rapports), la R&D (accélération documentation technique) et la relation client (qualification d'offres). Le livrable chiffre ces gains précisément pour votre cas.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles ?",
            a: "Oui. NDA signé avant démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée si la souveraineté est requise — particulièrement pertinent pour les entreprises à capitaux suisses.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Annecy ou sur votre site dans le bassin. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre, lisible par vos équipes le jour même.",
          },
          {
            q: "Quelle différence avec un consultant industriel traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA généralistes. Tarifs publics affichés, méthode condensée, démos sur vos vraies données plutôt que des slides théoriques. Aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il avoir déjà un projet IA en cours pour solliciter un audit ?",
            a: "Non. La majorité de nos audits annéciens sont commandés par des dirigeants industriels qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas s'engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Savoie artisanal micro-businesses to large-group industrial sites across the Annecy basin.",
        whyHere: [
          "Annecy's industrial fabric has strong AI demand: quality automation, logistics optimization, accelerated R&D at outdoor equipment makers and precision sub-contractors.",
          "Our consultants know the specific challenges of the outdoor/mountain sector (product development cycles, seasonal management, EN/ISO standards) and precision engineering (traceability, quality control, predictive maintenance).",
          "Cross-border proximity factored in: SMEs with strong Geneva activity or Swiss capital benefit from a bilingual perspective on data compliance and governance.",
          "Read-outs always in person in Annecy: ideation workshop at your premises, deliverable walk-through with management, action plan handed over face to face.",
          "Public pricing displayed: you know exactly what you pay before signing. No opaque multi-round quote game.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief: NDA signing, access to a few key documents (org chart, process map, operational KPIs). Identification of AI candidate workflows specific to your activity.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to your Annecy premises or industrial site (Vallée de l'Arve, Rumilly, Annecy-le-Vieux) to observe daily tools — ERP, MES, CRM, quality tools — and identify concrete frictions.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews with key teams: engineering, production, sales, finance, HR. Detailed mapping of frictions, volumes handled, recurring errors.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site or in dedicated session: demos of Claude, Mistral, GPT-4 applied to your technical PDFs, client emails, quality control reports. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap prioritized to your industrial or service context.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Flash audit",
            detail:
              "Suited to craftspeople, freelancers, industrial and commercial micro-businesses in the Annecy basin up to about ten staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for precision sub-contractors, mid-sized outdoor equipment makers, B2B service firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial or service mid-caps framing a multi-year AI trajectory across production, R&D, sales and HR.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For major sites of large groups based in the basin (Schneider Electric, Amer Sports, Groupe SEB) framing centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA framed our AI challenges starting from our real industrial constraints — traceability, MES, proprietary ERP. The deliverable is costed and directly usable by our technical management.",
            role: "Technical Director",
            companyProfile: "Precision engineering SME, Vallée de l'Arve",
          },
          {
            quote:
              "Pragmatic method, demos on our real quality control data. We prioritized three AI initiatives for our board with a solid estimated ROI. No jargon, no lock-in.",
            role: "CEO",
            companyProfile: "Outdoor equipment mid-cap, Annecy basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Annecy?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. The cadence is set at the framing brief according to your availability and organization.",
          },
          {
            q: "What value does an audit bring for an Annecy industrial SME?",
            a: "For precision engineering or outdoor equipment SMEs, identified ROI typically targets quality (reducing non-conformities), traceability (automating reports), R&D (accelerating technical documentation) and customer relations (offer qualification). The deliverable quantifies these gains precisely for your case.",
          },
          {
            q: "Does my industrial data stay confidential?",
            a: "Yes. NDA signed before kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra if sovereignty is required — particularly relevant for Swiss-capital companies.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Annecy or at your site in the basin. Workshop of a few hours with your leadership committee. You leave with the PDF deliverable in hand, readable by your teams the same day.",
          },
          {
            q: "Difference with a traditional industrial consultant?",
            a: "Our consultants are former AI practitioners, not generalist MBAs. Public pricing, condensed method, demos on your real data rather than theoretical slides. No lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need an AI project already underway to request an audit?",
            a: "No. Most of our Annecy audits are ordered by industrial executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Annecy se déroulent en formats sur site d'une à plusieurs journées, adaptés aux réalités des équipes industrielles, outdoor, R&D et de service du bassin annécien. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel. Frais de logement, repas et forfait trajet facturés en sus.",
        whyHere: [
          "Le bassin annécien concentre des secteurs à fort potentiel IA pratique : bureau d'études outdoor, ligne de production mécanique de précision, équipes commerciales export vers la Suisse.",
          "Nos consultants adaptent chaque session aux réalités métier locales — terminologie technique outdoor, culture Qualité industrie, enjeux transfrontaliers — sans session générique recyclée.",
          "Format Essentielle calibré pour les PME industrielles et de service du bassin : jusqu'à une centaine de collaborateurs en interaction sur une journée.",
          "Format Conférence adapté aux plénières d'entreprise à Annecy (salles Bonlieu, centres de congrès, espaces collaboratifs French Tech in The Alps).",
          "Format Dirigeants pour les comités de direction des PME/ETI annéciennes souhaitant cadrer leur stratégie IA en huis-clos.",
          "Couverture géographique étendue : Annecy, Annecy-le-Vieux, Cran-Gevrier, Seynod, Meythet, Pringy, Rumilly, Vallée de l'Arve.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier (outdoor, mécanique, services), les cas d'usage prioritaires selon votre activité.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité — spécifications techniques, emails clients, fiches qualité, catalogues produits — pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour de l'intervention.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Vocabulaire ajusté à votre secteur : outdoor, industrie, services, transfrontalier.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel — utilisables le lendemain matin sur leur poste réel sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Format Essentielle",
            detail:
              "Idéal pour artisans, indépendants, petites structures industrielles ou de services du bassin annécien jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour l'ensemble de la structure ou Équipes pour focaliser sur un département : bureau d'études, commerce, production, qualité, RH.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Conférence plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sites industriels majeurs : roadshow multi-sites bassin annécien, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session parfaitement adaptée à notre contexte outdoor : les démos sur nos fiches techniques et nos emails clients ont rendu l'IA immédiatement concrète. Nos ingénieurs utilisent déjà les outils installés sur leurs projets réels.",
            role: "Responsable R&D",
            companyProfile: "PME équipementier outdoor, Annecy-le-Vieux",
          },
          {
            quote:
              "Le format Dirigeants nous a alignés en quelques heures sur notre stratégie IA. Concret, ancré dans nos réalités industrielles, aucun jargon. On repart avec un cap clair.",
            role: "PDG",
            companyProfile: "ETI mécanique de précision, bassin annécien",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Annecy ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini en cadrage.",
          },
          {
            q: "Quelle taille de groupe peut-on accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence avec schéma plénière + ateliers en sous-groupes est plus adapté.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vos équipes gardent la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur outdoor ou à l'industrie de précision ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples, démos. Une session pour un équipementier outdoor n'a rien à voir avec une session pour un sous-traitant décolletage.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre RH ou comptable peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Intervenez-vous également sur les sites hors d'Annecy dans le bassin ?",
            a: "Oui. Nos consultants couvrent l'ensemble du bassin annécien : Vallée de l'Arve, Rumilly, Faverges, Cluses, ainsi que les sites transfrontaliers côté franco-genevois. Frais de déplacement, logement et repas calculés selon la localisation.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Annecy come in on-site formats from one to several days, tailored to the realities of industrial, outdoor, R&D and service teams across the Annecy basin. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "The Annecy basin concentrates sectors with strong practical AI potential: outdoor engineering teams, precision manufacturing lines, commercial teams exporting to Switzerland.",
          "Our consultants adapt each session to local professional realities — outdoor technical vocabulary, industrial quality culture, cross-border challenges — no recycled generic session.",
          "Essential format calibrated for industrial and service SMEs in the basin: up to about a hundred staff in interaction over a day.",
          "Talk format adapted to corporate plenaries in Annecy (Bonlieu spaces, congress centres, French Tech in The Alps collaborative spaces).",
          "Executives format for SME/mid-cap executive committees wishing to frame their AI strategy in camera.",
          "Extended coverage: Annecy, Annecy-le-Vieux, Cran-Gevrier, Seynod, Meythet, Pringy, Rumilly, Vallée de l'Arve.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (outdoor, precision engineering, services), priority use cases for your activity.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity — technical specs, client emails, quality sheets, product catalogues — to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection, Wi-Fi access. No technical hiccup on the day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Vocabulary adjusted to your sector: outdoor, industry, services, cross-border.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case — usable next morning on their real workstation without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Essential format",
            detail:
              "Ideal for craftspeople, freelancers, small industrial or service businesses in the Annecy basin up to about ten staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole organization or Teams to focus on one department: engineering, sales, production, quality, HR.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Talk or Executives format",
            detail:
              "Plenary talk for large audiences or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for major industrial sites: multi-site Annecy basin roadshow, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Session perfectly adapted to our outdoor context: demos on our technical sheets and client emails made AI immediately concrete. Our engineers are already using the installed tools on their real projects.",
            role: "Head of R&D",
            companyProfile: "Outdoor equipment SME, Annecy-le-Vieux",
          },
          {
            quote:
              "The Executives format aligned us in a few hours on our AI strategy. Concrete, grounded in our industrial realities, no jargon. We left with a clear direction.",
            role: "CEO",
            companyProfile: "Precision engineering mid-cap, Annecy basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Annecy take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format with plenary + sub-group workshops is more suitable.",
          },
          {
            q: "Do tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, your teams stay in control.",
          },
          {
            q: "Can you adapt content to the outdoor sector or precision industry?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples, demos. A session for an outdoor equipment maker has nothing to do with one for a precision sub-contractor.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "Do you also intervene at sites outside Annecy in the basin?",
            a: "Yes. Our consultants cover the full Annecy basin: Vallée de l'Arve, Rumilly, Faverges, Cluses, and Franco-Genevan cross-border sites. Travel, lodging and meal expenses calculated according to location.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Annecy met vos cas d'usage IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance avec un kick-off obligatoire dans vos locaux dans le bassin annécien.",
        whyHere: [
          "Les cas d'implémentation typiques à Annecy concernent des sujets industriels concrets : contrôle qualité assisté IA, génération de documentation technique, qualification automatisée des offres export, maintenance prédictive, traitement des retours SAV.",
          "Le kick-off se passe en présentiel dans vos locaux : accès aux données de production, validation des intégrations ERP/MES/CRM, alignement des équipes techniques.",
          "Itérations à distance ensuite avec un point quotidien court et une visite mensuelle pour démos d'avancement avec votre direction.",
          "Recette finale en présentiel à Annecy : passation de pouvoir, formation des ambassadeurs IA internes, documentation runbook remise en main propre.",
          "Formation incluse pour vos collaborateurs identifiés : ils deviennent autonomes sur les outils déployés à la fin de la mission, sans dépendance Axion-IA.",
          "Connaissance des enjeux transfrontaliers : pour les entités soumises aux réglementations suisses ou à des contrats avec des partenaires genevois, les contraintes de souveraineté des données sont anticipées dès le cadrage.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Annecy : revue de l'architecture cible (ERP, MES, CRM, stockage documentaire), validation des contraintes RGPD/sécurité, sélection des modèles IA, signature du SOW chiffré avec jalons.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX selon retours utilisateurs.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Annecy : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post go-live.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel versus prédiction SOW. Rapport final remis à clôture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple en quelques semaines (rédaction automatique de rapports qualité, réponse aux emails clients, qualification d'offres).",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/MES/CRM. Pour sous-traitants, équipementiers outdoor, cabinets de services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP legacy, datalake industriel), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les sites industriels majeurs du bassin : cas d'usage cascadés, gouvernance IA centralisée, équipe Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation contrôle qualité assisté IA livrée selon le SOW. ROI mesuré : réduction significative des taux de non-conformité et temps de traitement rapports divisé. Nos équipes qualité sont autonomes, aucun lock-in.",
            role: "Directeur industriel",
            companyProfile: "PME sous-traitant mécanique, Vallée de l'Arve",
          },
          {
            quote:
              "Méthode hybride efficace : kick-off intense sur site bassin annécien, puis itérations à distance bien rythmées. Notre DSI n'a jamais été perdu. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "DG",
            companyProfile: "ETI services B2B, Grand Annecy",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Annecy ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME sur quelques mois, une mission ETI sur plusieurs mois, un grand programme sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée en UE si vous préférez. NDA signé en cadrage, RGPD strict, DPO sur demande. Particulièrement adapté aux entreprises à enjeux de souveraineté franco-suisse.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données industrielles si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (fiches qualité critiques, devis export, documents contractuels), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Annecy brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your premises in the Annecy basin.",
        whyHere: [
          "Typical Annecy implementation cases cover concrete industrial subjects: AI-assisted quality control, technical documentation generation, automated export offer qualification, predictive maintenance, after-sales processing.",
          "Kick-off always happens in person at your premises: access to production data, ERP/MES/CRM integration validation, technical team alignment.",
          "Remote iterations afterwards with a short daily and a monthly on-site visit for progress demos with your management.",
          "Final acceptance in person in Annecy: handover, training of internal AI ambassadors, runbook documentation delivered.",
          "Training included for your identified staff: they become autonomous on deployed tools at mission end, no Axion-IA dependency.",
          "Cross-border expertise: for entities subject to Swiss regulations or contracts with Genevan partners, data sovereignty constraints are anticipated from framing.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Annecy workshop: target architecture review (ERP, MES, CRM, document storage), GDPR/security constraints validation, AI model selection, costed SOW signed with milestones.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments per user feedback.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Annecy: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post go-live monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at mission closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "POC",
            detail:
              "Implementation of a simple use case over a few weeks (automatic quality report writing, client email response, offer qualification).",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/MES/CRM integration. For sub-contractors, outdoor equipment makers, service firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, industrial datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for major industrial basin sites: cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "AI-assisted quality control implementation delivered as per the SOW. Measured ROI: significant reduction in non-conformity rates and report processing time divided. Our quality teams are autonomous, no lock-in.",
            role: "Industrial Director",
            companyProfile: "Precision engineering SME, Vallée de l'Arve",
          },
          {
            quote:
              "Efficient hybrid method: intense on-site kick-off in the Annecy basin, then well-paced remote iterations. Our CIO was never lost. Internal ambassadors take over autonomously.",
            role: "CEO",
            companyProfile: "B2B services mid-cap, Grand Annecy",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Annecy take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment and new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. NDA signed at framing, strict GDPR, DPO on request. Particularly suitable for companies with Franco-Swiss data sovereignty concerns.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your industrial data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (critical quality sheets, export quotes, contractual documents), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Annecy ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Annecy et partout en France.",
    },
    {
      q: "Axion-IA intervient-il dans le bassin industriel d'Annecy et la Vallée de l'Arve ?",
      a: "Oui. Nos consultants couvrent l'ensemble du Grand Annecy, la Vallée de l'Arve (décolletage, mécanique), Rumilly (Tefal/SEB) et les sites transfrontaliers côté Haute-Savoie. Frais de déplacement, logement et repas calculés selon la localisation, facturés en sus.",
    },
    {
      q: "Quels secteurs B2B sont prioritaires à Annecy ?",
      a: "Nos déploiements couvrent en priorité : industrie outdoor et équipements sportifs (Outdoor Sports Valley, cluster Salomon/Mavic), mécanique de précision et décolletage (Mont-Blanc Industries), services aux entreprises B2B, agroalimentaire AOP/IGP, et les industries créatives (animation numérique, Festival Annecy). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir pour des entreprises à enjeux transfrontaliers Suisse-France ?",
      a: "Oui. Le bassin annécien compte environ 30 000 travailleurs frontaliers et de nombreuses PME avec des contrats ou partenaires suisses. Nous prenons en compte les contraintes de souveraineté des données franco-suisses, les enjeux de conformité et la gouvernance IA adaptée à ces contextes.",
    },
    {
      q: "Travaillez-vous avec les startups de la French Tech in The Alps à Annecy ?",
      a: "Oui. Nous accompagnons les startups et scale-ups du chapitre French Tech in The Alps - Annecy sur leurs cas IA opérationnels. Notre offre Essentielle est calibrée pour les structures avec un product-market fit établi qui souhaitent passer du POC IA à un déploiement opérationnel.",
    },
    {
      q: "Avez-vous des références dans le secteur outdoor ou l'industrie de précision ?",
      a: "Nos missions récentes dans le bassin incluent des équipementiers outdoor, des sous-traitants de mécanique de précision et des PME de services B2B. Les cas clients sont consultables dans la rubrique Cas concrets, filtrables par secteur et zone géographique.",
    },
  ],
};
