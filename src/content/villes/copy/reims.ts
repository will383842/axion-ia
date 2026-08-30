// Reims — contenu éditorial gold standard (Sprint City Quality V3 2026-05-18).
//
// Doctrine stricte (même que paris.ts) :
//   - Aucun délai chiffré en dur.
//   - Aucun « frais de déplacement intégrés » — mention systématique
//     « frais de logement, repas et forfait trajet en sus » sur interventions.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : libellés seulement, tarifs depuis pricing.ts.
//   - Tailles entreprise INSEE : PME/ETI/grands groupes / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data Reims bouclier anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn (non demandés pour cette ville).
//
// Réalités économiques Reims sourcées depuis economic-data/reims.ts :
//   Champagne (LVMH/MHCS : Veuve Clicquot, Krug, Ruinart ; Taittinger ;
//   Vranken-Pommery ; Lanson-BCC ; Pernod Ricard/Mumm), Bioéconomie
//   (Pomacle-Bazancourt, Bioeconomy For Change), NEOMA Business School,
//   Sciences Po Reims, URCA, 5 701 établissements actifs, gare TGV
//   Champagne-Ardenne (Paris-Est ~45 min), double UNESCO (monuments 1991
//   + Coteaux 2015), Cité des Sacres (29 rois).

import type { VilleCopy } from "./types";

export const REIMS_COPY: VilleCopy = {
  pitchFr:
    "Reims regroupe 5 701 établissements actifs, les sièges des grandes maisons de Champagne (Veuve Clicquot, Taittinger, Ruinart, Pommery, Mumm, Lanson), NEOMA Business School, Sciences Po et l'Université de Reims — à 45 minutes de Paris en TGV. Axion-IA y intervient sur site auprès des PME, ETI et grands groupes et GE du Grand Reims et du bassin Champagne.",
  pitchEn:
    "Reims hosts 5,701 active businesses, the headquarters of major Champagne houses (Veuve Clicquot, Taittinger, Ruinart, Pommery, Mumm, Lanson), NEOMA Business School, Sciences Po and the University of Reims — 45 minutes from Paris by TGV. Axion-IA delivers on site to micro-businesses, SMEs, mid-caps and large enterprises across Greater Reims and the Champagne basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Reims : nous identifions ce qui peut être automatisé dans votre maison de Champagne, votre PME agroalimentaire ou votre ETI tertiaire et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Reims: we identify what can be automated in your Champagne house, agri-food SME or services mid-cap and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic depending on your size.",
    },
    interventions: {
      fr: "Interventions IA à Reims : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste.",
      en: "AI sessions in Reims: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA à Reims : on déploie l'IA dans vos outils existants (CRM, ERP, mails, systèmes viti-vini) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Reims: we deploy AI into your existing tools (CRM, ERP, email, winery systems) with contractually-costed ROI. Your teams stay in control, no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Reims : accompagnement 1-to-1 ancré dans votre réalité — Champagne, bioéconomie, agroalimentaire ou tertiaire académique. À partir de {{price:intervention-dirigeants|flat}}.",
      en: "Individual AI coaching in Reims: 1-to-1 support rooted in your reality — Champagne, bioeconomy, agri-food or academic tertiary. From €990 excl. VAT.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour maisons de Champagne, PME bioéconomie et ETI rémoise — site vitrine premium pour Champagne et agroalimentaire, espace distributeur international, dashboard connecté à votre CRM/ERP et systèmes viti-vini. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Champagne houses, bioeconomy SMEs and Reims mid-caps — premium showcase site for Champagne and agri-food, international distributor portal, dashboard connected to your CRM/ERP and winery systems. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Reims (51100) sur site dans le Grand Reims et le bassin Champagne. Nous accompagnons les PME, ETI et grands groupes rémois — maisons de Champagne (LVMH/MHCS, Taittinger, Vranken-Pommery), industries bioéconomie (Pomacle-Bazancourt), tertiaire NEOMA/Sciences Po — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Gare TGV Champagne-Ardenne à 45 min de Paris. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy delivering on site in Reims (51100) across Greater Reims and the Champagne basin. We support micro-businesses, SMEs, mid-caps and large enterprises — Champagne houses (LVMH/MHCS, Taittinger, Vranken-Pommery), bioeconomy industries (Pomacle-Bazancourt), tertiary sector (NEOMA, Sciences Po) — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. Champagne-Ardenne TGV station, 45 min from Paris. No tech lock-in, your teams stay in control.",

  seoHook: "champagne, logistique & santé",

  topSectorsNaf: [
    "Champagne & Vins de prestige",
    "Agroalimentaire & Bioéconomie",
    "Commerce & Services aux entreprises",
    "Enseignement supérieur & Recherche",
    "Construction & Industrie",
    "Tourisme & Patrimoine UNESCO",
  ],

  distancesFr:
    "Gare Champagne-Ardenne TGV (Bezannes, ~5 km du centre) : Paris-Est en ~45 min, Strasbourg en ~2h10. Gare de Reims-Centre pour les liaisons régionales. Aéroport Paris-CDG accessible par TGV+RER en ~1h45. Réseau Citura 2 lignes tramway + bus pour les déplacements intra-agglomération.",
  distancesEn:
    "Champagne-Ardenne TGV station (Bezannes, ~5 km from city centre): Paris-Est ~45 min, Strasbourg ~2h10. Reims-Centre station for regional services. Paris-CDG airport via TGV+RER ~1h45. Citura network 2 tram lines + buses for intra-agglomeration travel.",

  ecosystemFr:
    "5 701 établissements actifs (INSEE 2024) — capitale mondiale du Champagne : Veuve Clicquot, Krug, Ruinart (groupe LVMH/MHCS), Taittinger, Vranken-Pommery, Lanson-BCC, Pernod Ricard/Mumm. Bioraffinerie Pomacle-Bazancourt (160 ha, 3 Mt biomasse/an, pôle Bioeconomy For Change). Enseignement supérieur dense : NEOMA Business School (4 200 étudiants), Sciences Po Reims, URCA. French Tech Est, incubateur Innovact, Créativ'Labz.",
  ecosystemEn:
    "5,701 active businesses (INSEE 2024) — world capital of Champagne: Veuve Clicquot, Krug, Ruinart (LVMH/MHCS group), Taittinger, Vranken-Pommery, Lanson-BCC, Pernod Ricard/Mumm. Pomacle-Bazancourt biorefinery (160 ha, 3 Mt biomass/year, Bioeconomy For Change hub). Dense higher education: NEOMA Business School (4,200 students), Sciences Po Reims, URCA. French Tech Est, Innovact incubator, Créativ'Labz.",

  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé chez vous et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des PME artisanales du Grand Reims aux grandes maisons de Champagne cotées en bourse ou filiales LVMH. Reims, capitale du Champagne à 45 minutes de Paris en TGV, est un marché B2B à haut potentiel IA — agroalimentaire de prestige, bioéconomie industrielle, tertiaire académique — que nous connaissons en profondeur.",
        whyHere: [
          "Reims concentre des secteurs à forte valeur ajoutée — Champagne, agroalimentaire, bioéconomie, enseignement supérieur — où l'IA opérationnelle génère des gains mesurables : traçabilité, génération de documents export, qualification commerciale internationale.",
          "Les grandes maisons de Champagne (LVMH/MHCS, Taittinger, Vranken-Pommery, Lanson-BCC) ont des équipes commerciales, export, marketing et RH éligibles à des cas IA structurés — comptes-rendus de dégustation, traduction multilingue automatique, qualification de leads B2B internationaux.",
          "L'industrie Pomacle-Bazancourt (bioraffinerie 3 Mt biomasse/an) et le pôle Bioeconomy For Change regroupent des ETI et PME industrielles avec des workflows qualité, R&D et supply chain candidats à l'automatisation IA.",
          "NEOMA Business School, Sciences Po Reims et l'URCA forment chaque année des milliers de jeunes professionnels : leurs équipes pédagogiques et administratives accélèrent significativement avec l'IA sur la gestion de contenu, le suivi étudiant, la production de rapports.",
          "Aucun supplément géographique : le tarif est le même à Reims qu'à Paris. La gare TGV Champagne-Ardenne (Bezannes) permet un kick-off en quelques heures depuis n'importe quelle métropole française.",
          "Restitutions toujours en présentiel dans vos locaux à Reims ou en bassin Champagne. Plan d'action remis en main propre, exécutable avec n'importe quel prestataire ou en interne.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés : organigramme, processus prioritaires, indicateurs métier (volumétrie factures, nombre de références export Champagne, cadence rapports R&D, etc.).",
          },
          {
            step: "Kick-off sur site à Reims",
            detail:
              "Venue dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA — CRM viticole, ERP production, outils export, messagerie équipe commerciale.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts avec les profils clés : commercial export, œnologue, responsable qualité, RH, direction — pour cartographier les frictions réelles et les attentes opérationnelles.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place à Reims : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs (fiches techniques Champagne, contrats export, rapports R&D bioéconomie, dossiers formation). Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable secteur Champagne / agroalimentaire / tertiaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour PME agroalimentaires, agences, prestataires logistiques, structures de formation de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI Champagne (Taittinger, Pol Roger), industrielles bioéconomie ou tertiaires souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les filiales grands groupes (LVMH/MHCS, Pernod Ricard, Vranken-Pommery) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a identifié trois chantiers IA concrets sur nos processus export que nous n'avions pas vus nous-mêmes. Le livrable est chiffré, sans jargon, directement présentable au comité de direction.",
            role: "Directeur commercial export",
            companyProfile: "Maison de Champagne familiale, Grand Reims, 80 collaborateurs",
          },
          {
            quote:
              "Méthode pragmatique : démos sur nos vraies données de traçabilité plutôt que des exemples génériques. Le plan d'action nous a permis de prioriser nos investissements IA pour l'exercice suivant.",
            role: "Directrice des opérations",
            companyProfile: "ETI agroalimentaire bassin Champagne, 320 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Reims ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est calé lors du brief de cadrage initial.",
          },
          {
            q: "Quels secteurs rémois sont prioritaires pour un audit IA ?",
            a: "L'agroalimentaire haut-de-gamme (Champagne, maisons de négoce) et la bioéconomie industrielle (Pomacle-Bazancourt) sont nos secteurs de prédilection à Reims. Mais tout secteur B2B — services, construction, enseignement — est éligible dès lors qu'il existe des workflows répétitifs à automatiser.",
          },
          {
            q: "Mes données de production Champagne restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD stricte — les recettes, fiches techniques et données export restent chez vous.",
          },
          {
            q: "Comment se déroule la restitution finale à Reims ?",
            a: "Toujours en présentiel dans vos locaux à Reims ou dans le Grand Reims. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Quelle différence avec un audit d'un cabinet consultant régional ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA généralistes. Tarifs publics affichés, pas de devis à six chiffres. Méthode condensée avec démos sur vos vraies données. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une grande part de nos audits à Reims sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Grand Reims micro-businesses to publicly listed or LVMH-owned Champagne houses. Reims, the world's Champagne capital, 45 minutes from Paris by TGV, is a high-potential B2B AI market — premium agri-food, industrial bioeconomy, academic tertiary — that we know in depth.",
        whyHere: [
          "Reims concentrates high-value sectors — Champagne, agri-food, bioeconomy, higher education — where operational AI delivers measurable gains: traceability, export document generation, international commercial qualification.",
          "Major Champagne houses (LVMH/MHCS, Taittinger, Vranken-Pommery, Lanson-BCC) have commercial, export, marketing and HR teams eligible for structured AI use cases — tasting notes, automatic multilingual translation, international B2B lead qualification.",
          "Pomacle-Bazancourt industry (3 Mt biomass/year biorefinery) and the Bioeconomy For Change hub group industrial SMEs and mid-caps with quality, R&D and supply chain workflows ripe for AI automation.",
          "NEOMA Business School, Sciences Po Reims and URCA train thousands of young professionals each year: their academic and administrative teams accelerate significantly with AI for content management, student tracking and report production.",
          "No geographic surcharge: the same price in Reims as in Paris. Champagne-Ardenne TGV station (Bezannes) enables a kick-off within hours from any French metropolis.",
          "Read-outs always in person at your Reims or Champagne basin offices. Action plan handed over face to face, executable with any vendor or in-house.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents: org chart, priority processes, business KPIs (invoice volumes, Champagne export references, R&D report cadence, etc.).",
          },
          {
            step: "On-site kick-off in Reims",
            detail:
              "Visit to your offices to observe daily tools and identify AI candidate workflows — viticultural CRM, production ERP, export tools, commercial team messaging.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews with key profiles: export sales, oenologist, quality manager, HR, leadership — to map real frictions and operational expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site in Reims: demos of Claude, Mistral, GPT-4 applied to your PDFs (Champagne technical sheets, export contracts, bioeconomy R&D reports, training files). No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices. Costed PDF deliverable handed over, actionable roadmap for Champagne / agri-food / tertiary sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for agri-food SMEs, agencies, logistics providers, training organisations from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Champagne mid-caps (Taittinger, Pol Roger), bioeconomy industrials or tertiary mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large-group subsidiaries (LVMH/MHCS, Pernod Ricard, Vranken-Pommery) framing centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA identified three concrete AI initiatives on our export processes that we hadn't seen ourselves. The deliverable is costed, jargon-free, directly presentable to the executive committee.",
            role: "Head of Export Sales",
            companyProfile: "Family-owned Champagne house, Grand Reims, 80 staff",
          },
          {
            quote:
              "Pragmatic method: demos on our real traceability data rather than generic examples. The action plan helped us prioritize our AI investments for the following fiscal year.",
            role: "Head of Operations",
            companyProfile: "Agri-food mid-cap, Champagne basin, 320 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Reims?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. The cadence is agreed at the framing brief.",
          },
          {
            q: "Which Reims sectors are top priorities for an AI audit?",
            a: "Premium agri-food (Champagne, trading houses) and industrial bioeconomy (Pomacle-Bazancourt) are our prime sectors in Reims. But any B2B sector — services, construction, education — is eligible as long as there are repetitive workflows to automate.",
          },
          {
            q: "Does my Champagne production data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. Strict GDPR compliance — recipes, technical sheets and export data stay with you.",
          },
          {
            q: "How does the final read-out work in Reims?",
            a: "Always in person at your offices in Reims or Greater Reims. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a regional consulting firm audit?",
            a: "Our consultants are former AI practitioners, not generalist MBAs. Public pricing, no six-figure quote to negotiate. Condensed method with demos on your real data. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A significant share of our Reims audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Reims se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — qu'ils soient dans une maison de Champagne, une ETI agroalimentaire ou une école de management.",
        whyHere: [
          "Reims est desservie par la gare TGV Champagne-Ardenne à ~45 min de Paris — nos consultants y interviennent en journée sans nuit contrainte, et couvrent aussi le bassin Champagne jusqu'à Épernay, Châlons et Troyes.",
          "Le tissu économique rémois est multi-sectoriel : maisons de Champagne export-intensives, industries bioéconomie, structures académiques (NEOMA, Sciences Po, URCA) — chaque session est calibrée sur votre vocabulaire métier.",
          "Le format collectif (1 journée) est calibré pour les PME et maisons familiales du Grand Reims de quelques dizaines à une centaine de collaborateurs.",
          "Le format Dirigeants est adapté aux CODIR des grandes maisons de Champagne ou des directions régionales de grands groupes (LVMH, Pernod Ricard) implantés à Reims.",
          "Le format Conférence convient aux journées portes ouvertes, séminaires grand groupe ou événements fédératifs CCI Marne en Champagne.",
          "Vocabulaire ajusté à votre réalité : Champagne / vitivinicole, bioéconomie / agro-industrie, management académique, tertiaire services. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, le secteur métier (Champagne, bioéconomie, services), et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (fiches techniques Champagne, comptes-rendus export, données R&D bioéconomie, emails commercial) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux à Reims pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés aux enjeux Champagne / agroalimentaire / académique.",
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
              "Le format collectif (1 journée) pour le groupe entier ou Équipes pour focaliser sur un département (commercial export, qualité, RH, marketing Champagne).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (séminaire maison, journée formation all-hands) ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les directions régionales ou sièges Reims des grands groupes : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement adaptée à notre équipe export : vocabulaire Champagne, démos sur nos propres fiches techniques et emails clients. Le lendemain, plusieurs collaborateurs utilisaient déjà les outils installés sur leur travail réel.",
            role: "Responsable export",
            companyProfile: "Maison de Champagne indépendante, Reims, 45 collaborateurs",
          },
          {
            quote:
              "La session dirigeants nous a permis d'aligner notre CODIR sur notre trajectoire IA en quelques heures. Approche pragmatique, exemples concrets sur nos données bioéconomie — rien de générique.",
            role: "Directeur général",
            companyProfile: "ETI industrie bioéconomie, bassin Reims, 280 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Reims ?",
            a: "Cela dépend du format choisi. Le format d'une journée se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble lors du cadrage.",
          },
          {
            q: "Vos consultants peuvent-ils venir dans le bassin Champagne (Épernay, Châlons, Troyes) ?",
            a: "Oui. Nous couvrons l'ensemble du bassin Champagne-Ardenne. La gare TGV de Bezannes et le réseau autoroutier permettent d'atteindre Épernay (~30 km), Châlons-en-Champagne (~45 km) et Troyes (~80 km) dans la même journée.",
          },
          {
            q: "Les outils installés sur les postes sont-ils adaptés au secteur Champagne ?",
            a: "Oui. Le brief de cadrage nous permet d'ajuster les outils et les démos à votre réalité : fiches techniques viticoles, export multilingue, comptes-rendus dégustations, traçabilité. Les comptes sont individuels (gratuits ou abonnement employé) — aucun lock-in Axion-IA.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "Le format collectif (1 journée) accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur (Champagne, bioéconomie, services), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Reims come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — whether in a Champagne house, an agri-food mid-cap or a business school.",
        whyHere: [
          "Reims is served by Champagne-Ardenne TGV station, ~45 min from Paris — our consultants intervene there for day visits without overnight constraints and cover the Champagne basin to Épernay, Châlons and Troyes.",
          "Reims' economic fabric is multi-sectoral: export-intensive Champagne houses, bioeconomy industries, academic structures (NEOMA, Sciences Po, URCA) — each session is calibrated to your sector vocabulary.",
          "The one-day format is calibrated for Grand Reims SMEs and family houses from a few dozen to about a hundred staff.",
          "The Executives format suits the executive committees of major Champagne houses or regional leadership of large groups (LVMH, Pernod Ricard) based in Reims.",
          "The Talk format suits open days, large-group seminars or CCI Marne en Champagne federating events.",
          "Vocabulary adjusted to your reality: Champagne / wine, bioeconomy / agri-industry, academic management, tertiary services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (Champagne, bioeconomy, services) and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (Champagne technical sheets, export meeting notes, bioeconomy R&D data, commercial emails) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Reims offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops adapted to Champagne / agri-food / academic challenges.",
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
              "Group format for the whole group or Teams to focus on one department (export sales, quality, HR, Champagne marketing).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (house seminar, all-hands training day) or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large-group regional HQs in Reims: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly suited to our export team: Champagne vocabulary, demos on our own technical sheets and client emails. The next day, several staff were already using the installed tools on real work.",
            role: "Head of Export",
            companyProfile: "Independent Champagne house, Reims, 45 staff",
          },
          {
            quote:
              "The executive session aligned our leadership committee on our AI trajectory in a few hours. Pragmatic approach, concrete examples on our bioeconomy data — nothing generic.",
            role: "CEO",
            companyProfile: "Bioeconomy industrial mid-cap, Reims basin, 280 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Reims take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can your consultants come to the Champagne basin (Épernay, Châlons, Troyes)?",
            a: "Yes. We cover the entire Champagne-Ardenne basin. Bezannes TGV station and the motorway network allow reaching Épernay (~30 km), Châlons-en-Champagne (~45 km) and Troyes (~80 km) within the same day.",
          },
          {
            q: "Are the tools installed on workstations adapted to the Champagne sector?",
            a: "Yes. The framing brief lets us tailor tools and demos to your reality: viticultural technical sheets, multilingual export, tasting notes, traceability. Accounts are individual (free or employee subscription) — no Axion-IA lock-in.",
          },
          {
            q: "What group size can you handle?",
            a: "The group format handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector (Champagne, bioeconomy, services), no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Reims met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire à Reims ou dans le Grand Reims. Nous connaissons les contraintes des maisons de Champagne (export, traçabilité, multilingue), des industriels bioéconomie (qualité, supply chain) et des structures académiques (pédagogie, contenu, reporting).",
        whyHere: [
          "Reims concentre des secteurs à workflows répétitifs à fort volume : documents export Champagne (fiches techniques, certificats d'origine, étiquetage multilingue), traçabilité agro-industrielle, comptes-rendus et supports pédagogiques académiques.",
          "Le kick-off se passe systématiquement en présentiel à Reims dans vos locaux : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/export.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Reims : passation de pouvoir, formation des équipes installées sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques rémois : maison de Champagne (traduction automatique fiches export, qualification leads B2B international), industriel bioéconomie (comptes-rendus qualité, analyse rapports R&D), école de management (génération de contenus pédagogiques, traitement dossiers candidatures).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Reims : revue de l'architecture cible (CRM viticole, ERP agroalimentaire, outils export, messagerie), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Reims : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants (ERP production, CRM export, base documentaire), tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Reims : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
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
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME agroalimentaires, négoces Champagne, prestataires de services du Grand Reims.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP legacy, base documentaire vitivinicole, datalake), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les grandes maisons de Champagne (LVMH/MHCS, Vranken-Pommery) ou les groupes industriels : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation traduction automatique fiches export livrée comme promis. ROI réel mesuré : plusieurs heures gagnées par semaine sur la génération de documents multilingues, sans aucune erreur de conformité AOC Champagne.",
            role: "Responsable marketing & export",
            companyProfile: "Maison de Champagne, Reims, 110 collaborateurs",
          },
          {
            quote:
              "Méthode hybride parfaite : kick-off intense sur site à Reims, itérations à distance avec points courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "DSI",
            companyProfile: "ETI industrie bioéconomie bassin Reims, 350 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Reims ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions à Reims. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Pouvez-vous intégrer l'IA dans les ERP spécifiques au secteur Champagne ?",
            a: "Oui. Nous travaillons avec les stacks existantes — ERP viticoles, outils de gestion de cave, CRM export, messagerie — en mode intégration API ou via des couches d'orchestration légères. Aucun remplacement de vos systèmes existants.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données de production Champagne et de R&D bioéconomie restent-elles confidentielles ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour les cas multilingues export Champagne ?",
            a: "Mix selon le cas : Claude ou GPT-4 pour la qualité de traduction et la génération de documents formels (certifications AOC, étiquetage réglementaire) ; Mistral pour la souveraineté ou le coût ; parfois fine-tuning sur votre corpus si le volume le justifie. Choix justifié dans le SOW.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Reims brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off in Reims or Greater Reims. We know the constraints of Champagne houses (export, traceability, multilingual), bioeconomy industrials (quality, supply chain) and academic structures (pedagogy, content, reporting).",
        whyHere: [
          "Reims concentrates sectors with high-volume repetitive workflows: Champagne export documents (technical sheets, certificates of origin, multilingual labelling), agro-industrial traceability, academic meeting notes and teaching materials.",
          "Kick-off always happens in person in Reims at your offices: team alignment, data access, CRM/ERP/export integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Reims: handover, training of installed teams, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Reims cases: Champagne house (automatic translation of export sheets, international B2B lead qualification), bioeconomy industrial (quality meeting notes, R&D report analysis), business school (teaching content generation, application file processing).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Reims workshop: target architecture review (viticultural CRM, agri-food ERP, export tools, messaging), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Reims: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools (production ERP, export CRM, document base), real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Reims: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
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
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For agri-food SMEs, Champagne traders, Grand Reims service providers.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, wine document base, datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for major Champagne houses (LVMH/MHCS, Vranken-Pommery) or industrial groups: cascaded use cases, centralized AI governance, dedicated Axion-IA team.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automatic translation of export sheets implemented as promised. Real ROI measured: several hours gained per week on multilingual document generation, with zero AOC Champagne compliance error.",
            role: "Head of Marketing & Export",
            companyProfile: "Champagne house, Reims, 110 staff",
          },
          {
            quote:
              "Perfect hybrid method: intense on-site kick-off in Reims, remote iterations with short check-ins. Our IT team was never lost. Internal ambassadors take over autonomously.",
            role: "CIO",
            companyProfile: "Bioeconomy industrial mid-cap, Reims basin, 350 staff",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Reims take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Reims missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Can you integrate AI into ERP systems specific to the Champagne sector?",
            a: "Yes. We work with existing stacks — viticultural ERPs, cellar management tools, export CRMs, messaging — via API integration or lightweight orchestration layers. No replacement of your existing systems.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my Champagne production data and bioeconomy R&D stay confidential?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use for multilingual Champagne export cases?",
            a: "Mix per case: Claude or GPT-4 for translation quality and formal document generation (AOC certifications, regulatory labelling); Mistral for sovereignty or cost; sometimes fine-tuning on your corpus if volume justifies. Choice justified in SOW.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Reims est un accompagnement individuel sur mesure : vous progressez à votre rythme, sur vos propres cas métier, avec un consultant dédié. À partir de {{price:intervention-dirigeants|flat}}. Adapté aux dirigeants de maisons de Champagne, experts bioéconomie, managers agroalimentaires et responsables académiques du bassin rémois.",
        whyHere: [
          "Reims concentre des profils très spécialisés — responsable export d'une maison de Champagne, directeur qualité en bioéconomie (Pomacle-Bazancourt), directeur de programme à NEOMA — qui ont besoin d'un coaching ancré dans leurs contraintes sectorielles précises.",
          "Le secteur Champagne impose des workflows multilingues (fiches export, étiquetage AOC, certificats d'origine) que seul un coaching individuel permet d'intégrer dans chaque exercice pratique.",
          "Les maisons de Champagne familiales ont souvent un ou deux dirigeants à former en priorité avant toute cascade équipe : le 1-to-1 est la voie la plus rapide pour structurer la montée en compétence.",
          "Les industriels bioéconomie (Pomacle-Bazancourt, Bioeconomy For Change) ont des workflows qualité et R&D très spécifiques que le coaching peut cibler dès la première séance.",
          "Séances sur site dans vos locaux rémois ou dans le bassin Champagne (Épernay, Châlons, Troyes) ou à distance — rythme calé à la signature.",
          "Confidentialité sans accord de confidentialité imposé : vos données, vos recettes, vos fiches techniques restent dans votre environnement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage approfondi pour identifier votre niveau IA, vos cas métier prioritaires (export Champagne, bioéconomie, enseignement supérieur) et l'objectif précis du coaching.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Construction d'un plan séance par séance calé sur vos outils (Claude, Mistral, GPT-4), vos livrables réels (fiches export, rapports R&D, contenus pédagogiques) et les contraintes sectorielles de Reims.",
          },
          {
            step: "Séances pratiques sur vos vrais cas",
            detail:
              "Chaque séance travaille directement sur vos documents : traduction automatique de fiches Champagne, qualification de leads B2B internationaux, comptes-rendus de dégustation, rapports qualité bioéconomie.",
          },
          {
            step: "Exercices entre séances",
            detail:
              "Micro-missions à réaliser en autonomie entre deux séances pour ancrer les apprentissages dans votre réalité rémoise et accélérer la progression.",
          },
          {
            step: "Bilan + feuille de route autonomie",
            detail:
              "En fin de coaching, un bilan chiffré de vos gains et une feuille de route pour continuer à progresser sans dépendance envers Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme multi-séances pour responsables export ou référents IA de PME agroalimentaires, maisons de Champagne familiales ou agences du bassin rémois.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement cadres dirigeants ETI Champagne (Taittinger, Pol Roger) ou industriels bioéconomie — programme structuré avec bilan intermédiaire.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching des profils pilotes d'un grand groupe (LVMH/MHCS, Pernod Ricard, Vranken-Pommery) avant déploiement large.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de maîtriser la traduction automatique de nos fiches export Champagne en quelques séances. Adapté à nos contraintes AOC, multilingue, confidentialité des recettes. Je suis autonome.",
            role: "Directeur commercial export",
            companyProfile: "Maison de Champagne familiale, Reims, 60 collaborateurs",
          },
          {
            quote:
              "En tant que directrice R&D dans la bioéconomie, mes cas étaient très spécifiques. Le coaching 1-to-1 a travaillé sur mes vrais rapports qualité et données de process dès la première séance. Résultat mesurable immédiatement.",
            role: "Directrice R&D",
            companyProfile: "ETI bioéconomie, bassin Pomacle-Bazancourt",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective à Reims ?",
            a: "Le format collectif forme tout un groupe sur les mêmes cas. Le 1-to-1 travaille exclusivement sur VOS cas, votre vitesse, vos contraintes rémois (export Champagne multilingue, bioéconomie, académique). Gains opérationnels mesurables dès la première séance.",
          },
          {
            q: "Combien de séances faut-il pour être autonome sur l'IA à Reims ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Un dirigeant PME viticulteur atteint une autonomie confortable en quelques séances. Un manager ETI Champagne cherchant à maîtriser le multilingue export aura un programme plus étendu. Le plan est cadré à la première séance.",
          },
          {
            q: "Le coaching peut-il se tenir dans mes locaux rémois ou dans le bassin Champagne ?",
            a: "Oui. Séances sur site à Reims ou dans le bassin Champagne (Épernay, Châlons, Troyes) ou en visio selon votre disponibilité.",
          },
          {
            q: "Mes données et fiches techniques Champagne restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage : vos recettes, fiches techniques, données export restent dans votre environnement. Aucune extraction vers nos serveurs. Conformité RGPD stricte.",
          },
          {
            q: "Puis-je commencer sans aucune base IA ?",
            a: "Oui. Le diagnostic initial évalue votre niveau réel et calibre le plan en conséquence. La plupart des profils rémois débutent sans avoir jamais utilisé Claude ou GPT de façon professionnelle.",
          },
          {
            q: "Y a-t-il un engagement minimum de durée ou de nombre de séances ?",
            a: "Non. Pas de lock-in, pas de contrat d'abonnement. Vous commencez par la première séance à {{price:intervention-dirigeants|flat}}. La suite se décide à l'issue de chaque séance selon votre progression.",
          },
        ],
        guarantees:
          "Pas de lock-in : aucun engagement de durée imposé. Confidentialité stricte sans accord de confidentialité requis — vos données, recettes et fiches techniques restent dans votre environnement. Conformité RGPD. Si à l'issue de la première séance vous estimez que le coaching ne correspond pas à vos attentes, première séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Reims is an individual, bespoke engagement: you progress at your own pace, on your own business cases, with a dedicated consultant. From €990 excl. VAT. Suited to Champagne house executives, bioeconomy experts, agri-food managers and academic leaders across the Reims basin.",
        whyHere: [
          "Reims brings together highly specialised profiles — export manager at a Champagne house, quality director in bioeconomy (Pomacle-Bazancourt), programme director at NEOMA — who need coaching rooted in their precise sector constraints.",
          "The Champagne sector imposes multilingual workflows (export sheets, AOC labelling, certificates of origin) that only individual coaching can integrate into each practical exercise.",
          "Family Champagne houses often have one or two priority executives to train before any team cascade: 1-to-1 is the fastest route to structure the skills build.",
          "Bioeconomy industrials (Pomacle-Bazancourt, Bioeconomy For Change) have very specific quality and R&D workflows that coaching can target from the first session.",
          "Sessions on site at your Reims offices or in the Champagne basin (Épernay, Châlons, Troyes) or remote — cadence agreed at sign-up.",
          "Confidentiality without imposed accord de confidentialité: your data, recipes and technical sheets stay in your environment.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "An in-depth framing interview to identify your AI level, priority business cases (Champagne export, bioeconomy, higher education) and the precise coaching objective.",
          },
          {
            step: "Personalized progression plan",
            detail:
              "Building a session-by-session plan aligned with your tools (Claude, Mistral, GPT-4), your real deliverables (export sheets, R&D reports, teaching content) and Reims sector constraints.",
          },
          {
            step: "Practical sessions on your real cases",
            detail:
              "Each session works directly on your documents: automatic Champagne sheet translation, international B2B lead qualification, tasting notes, bioeconomy quality reports.",
          },
          {
            step: "Between-session exercises",
            detail:
              "Micro-missions to complete autonomously between sessions to embed learnings in your real Reims context and accelerate progress.",
          },
          {
            step: "Debrief + autonomy roadmap",
            detail:
              "At coaching end, a costed gains summary and an autonomy roadmap to keep progressing without dependence on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Multi-session programme for export managers or AI champions of agri-food SMEs, family Champagne houses or agencies in the Reims basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Executive coaching for Champagne mid-cap managers (Taittinger, Pol Roger) or bioeconomy industrials — structured programme with interim review.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Coaching of pilot profiles at a major group (LVMH/MHCS, Pernod Ricard, Vranken-Pommery) before broad rollout.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching let me master automatic translation of our Champagne export sheets within a few sessions. Adapted to our AOC constraints, multilingual, recipe confidentiality preserved. I am autonomous.",
            role: "Head of Export Sales",
            companyProfile: "Family Champagne house, Reims, 60 staff",
          },
          {
            quote:
              "As R&D Director in bioeconomy, my cases were very specific. The 1-to-1 coaching worked on my real quality reports and process data from the first session. Measurable result immediately.",
            role: "R&D Director",
            companyProfile: "Bioeconomy mid-cap, Pomacle-Bazancourt basin",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from a group session in Reims?",
            a: "Group format trains a whole team on the same cases. 1-to-1 works exclusively on YOUR cases, your pace, your Reims constraints (multilingual Champagne export, bioeconomy, academic). Measurable operational gains from the first session.",
          },
          {
            q: "How many sessions are needed to become AI-autonomous in Reims?",
            a: "It depends on your starting level and objectives. A micro-business winegrower executive reaches comfortable autonomy in a few sessions. A Champagne mid-cap manager seeking to master multilingual export will have a longer programme. The plan is framed in the first session.",
          },
          {
            q: "Can coaching sessions be held at my Reims premises or in the Champagne basin?",
            a: "Yes. On-site sessions in Reims or the Champagne basin (Épernay, Châlons, Troyes) or via video depending on availability.",
          },
          {
            q: "Does my Champagne data and technical sheets stay confidential?",
            a: "Yes. Strict confidentiality from day one: your recipes, technical sheets and export data stay in your environment. No extraction to our servers. Strict GDPR compliance.",
          },
          {
            q: "Can I start with no AI background?",
            a: "Yes. The initial diagnostic assesses your real level and calibrates the plan accordingly. Most Reims profiles start without ever having used Claude or GPT professionally.",
          },
          {
            q: "Is there a minimum duration or session commitment?",
            a: "No. No lock-in, no subscription contract. You start with the first session at €990 excl. VAT. Continuation is decided after each session based on your progress.",
          },
        ],
        guarantees:
          "No lock-in: no imposed duration commitment. Strict confidentiality without required accord de confidentialité — your data, recipes and technical sheets stay in your environment. GDPR compliance. If after the first session you feel the coaching does not meet your expectations, first session fully refunded.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Reims des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Reims, itérations à distance.",
        whyHere: [
          "Projets web & SaaS rémois : maisons de Champagne & luxe (Veuve Clicquot, Taittinger, Ruinart, Pommery, Mumm), e-commerce & export premium, écoles (NEOMA, Sciences Po), à 45 min de Paris en TGV.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "E-commerce & export Champagne : sites premium multilingues, recommandation, assistant d'achat, storytelling de marque — l'ADN du bassin rémois à l'international.",
        ],
        methodology: [
          {
            step: "Cadrage à Reims",
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
            price: "Site / boutique premium sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une boutique premium avec UX/UI et IA intégrée, pour maisons, domaines et PME rémoises.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS / e-commerce IA-native",
            detail:
              "Plateforme e-commerce premium, métier ou portail client à l'export, IA intégrée, branchée sur votre SI (CRM, ERP, PIM, datalake).",
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
            a: "Oui. On conçoit l'expérience complète à Reims — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous, particulièrement pour les marques premium.",
          },
          {
            q: "Vous gérez l'e-commerce premium et l'export multilingue ?",
            a: "Oui : sites et boutiques premium multilingues, recommandation, assistant d'achat, génération de fiches et traduction IA (Shopify, WooCommerce, PrestaShop). Un vrai levier pour les maisons de Champagne à l'international, conforme HCU et AI Act. Hébergement UE, RGPD strict.",
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
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région rémoise ou repris en interne.",
      },
      en: {
        hero: "In Reims, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Reims kick-off, remote iterations.",
        whyHere: [
          "Reims web & SaaS projects: Champagne & luxury houses (Veuve Clicquot, Taittinger, Ruinart, Pommery, Mumm), premium e-commerce & export, schools (NEOMA, Sciences Po), 45 min from Paris by TGV.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "Champagne e-commerce & export: premium multilingual sites, recommendation, shopping assistant, brand storytelling — the DNA of the Reims area internationally.",
        ],
        methodology: [
          {
            step: "Scoping in Reims",
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
            price: "Bespoke premium site / shop",
            detail:
              "Design or rebuild of a premium site or shop with UX/UI and built-in AI, for houses, estates and Reims SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS / e-commerce platform",
            detail:
              "Premium e-commerce, business or export customer portal platform, AI built in, wired into your IS (CRM, ERP, PIM, datalake).",
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
            a: "Yes. We design the full experience in Reims — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us, especially for premium brands.",
          },
          {
            q: "Do you handle premium e-commerce and multilingual export?",
            a: "Yes: premium multilingual sites and shops, recommendation, shopping assistant, sheet generation and AI translation (Shopify, WooCommerce, PrestaShop). A real lever for Champagne houses internationally, HCU and AI Act compliant. EU hosting, strict GDPR.",
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
          "Firm quote on a fixed package (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Reims-area provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Reims ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (PME, ETI et grands groupes, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Reims qu'à Paris.",
    },
    {
      q: "Axion-IA intervient-il auprès des maisons de Champagne ?",
      a: "Oui. Les maisons de Champagne — des indépendants familiaux aux grandes maisons de groupes (LVMH/MHCS, Vranken-Pommery, Lanson-BCC, Pernod Ricard) — font partie de nos cibles prioritaires à Reims. Nos cas typiques : traduction automatique des fiches export, qualification de leads B2B internationaux, génération de comptes-rendus de dégustation.",
    },
    {
      q: "Couvrez-vous le bassin Champagne au-delà de Reims ?",
      a: "Oui. Nos interventions couvrent l'ensemble du bassin Champagne-Ardenne : Épernay (~30 km), Châlons-en-Champagne (~45 km), Troyes (~80 km), ainsi que les communes du Grand Reims (Bezannes, Tinqueux, Cormontreuil). La gare TGV Champagne-Ardenne facilite nos déplacements.",
    },
    {
      q: "Quels secteurs rémois sont prioritaires pour l'IA opérationnelle ?",
      a: "Champagne et agroalimentaire haut-de-gamme en priorité (workflows export, traçabilité, multilingue), puis la bioéconomie industrielle (Pomacle-Bazancourt : qualité, R&D, supply chain) et les structures d'enseignement supérieur (NEOMA, Sciences Po, URCA : contenus pédagogiques, reporting, gestion administrative). Tout secteur B2B est éligible.",
    },
    {
      q: "Pouvez-vous intervenir sur site à Reims dans nos bureaux ou caves ?",
      a: "Oui. Toutes nos interventions à Reims sont par défaut sur site, dans vos locaux ou dans vos caves. Nos consultants sont mobiles sur l'agglomération rémoise et le Grand Reims. Les restitutions d'audit et les kick-offs d'implémentation se tiennent toujours en présentiel.",
    },
    {
      q: "Travaillez-vous avec les structures académiques rémois (NEOMA, Sciences Po, URCA) ?",
      a: "Oui. Nous accompagnons les établissements d'enseignement supérieur sur leurs cas IA administratifs et pédagogiques — génération de contenus de formation, traitement de dossiers de candidature, automatisation du reporting institutionnel. Notre formation collective est calibrée pour les équipes de quelques dizaines à plusieurs centaines de collaborateurs.",
    },
  ],
};
