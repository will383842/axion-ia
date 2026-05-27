// Besançon (25056) — contenu éditorial (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique paris.ts / lyon.ts) :
//   - Aucun « basé en UE ».
//   - Aucun délai concret chiffré (« 5 jours », « 7 jours », etc.).
//   - Aucun « frais de déplacement intégrés » — les frais sont en sus,
//     calculés au cas par cas selon la zone.
//   - Durée minimale = 1 journée. Mention systématique
//     « frais de logement, repas et forfait trajet en sus » sur interventions.
//   - Aucun prix hardcodé : tarifs viennent de `src/content/pricing.ts`.
//   - Tailles entreprise INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - Mot « formation » autorisé en copy descriptif, naming = « intervention ».
//
// Sources économiques : economic-data/besancon.ts (Sprint City Quality V3, ville #32).
// Réalités locales : Pôle des Microtechniques (PMT), TEMIS Innovation, ENSMM,
// Institut FEMTO-ST, Maty, Yema, Micronora, Citadelle Vauban UNESCO, CHRU Besançon,
// Université de Franche-Comté, Stellantis Sochaux (~80 km), Pôle Véhicule du Futur.

import type { VilleCopy } from "./types";

export const BESANCON_COPY: VilleCopy = {
  pitchFr:
    "Besançon regroupe 9 952 établissements actifs, capitale française des microtechniques de précision (Pôle PMT Phase V, ENSMM, Institut FEMTO-ST), siège de Maty et berceau horloger Yema/Lip, avec un bassin automobile à portée (Stellantis Sochaux). Axion-IA y intervient sur site, des TPE du centre historique aux ETI microtechniques de la technopôle TEMIS.",
  pitchEn:
    "Besançon hosts 9,952 active businesses, France's capital of precision microtechnologies (PMT hub Phase V, ENSMM, Institut FEMTO-ST), headquarters of Maty and birthplace of the Yema/Lip watchmaking tradition, with the automotive cluster of Stellantis Sochaux nearby. Axion-IA delivers on site, from historic-centre micro-businesses to precision-tech mid-caps at the TEMIS technopole.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Besançon : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du cabinet bisontain à l'ETI microtechnique ou médicale de la technopôle TEMIS.",
      en: "Operational AI audit in Besançon: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Besançon practices to precision-tech or medical mid-caps at the TEMIS technopole.",
    },
    interventions: {
      fr: "Interventions IA à Besançon : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Besançon: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Besançon : on déploie l'IA dans vos outils existants (CRM, ERP, LIMS, systèmes de précision) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Besançon: we deploy AI into your existing tools (CRM, ERP, LIMS, precision systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Besançon : sessions sur mesure pour dirigeants et décideurs bisontins — industrie de précision, santé, services — pour construire votre stratégie IA personnelle et passer à l'action. Frais de logement, repas et forfait trajet en sus.",
      en: "One-to-one AI coaching in Besançon: bespoke sessions for Besançon executives and decision-makers — precision industry, health, services — to build your personal AI strategy and move to action. Lodging, meals and travel allowance billed separately.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME et ETI bisontines — site vitrine premium pour acteurs microtechniques (Pôle PMT, ENSMM/FEMTO-ST) et dispositifs médicaux TEMIS Santé, espace client interactif, dashboard métier connecté à votre CRM/ERP/LIMS. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Besançon SMEs and mid-caps — premium showcase site for precision microtechnology players (PMT hub, ENSMM/FEMTO-ST) and TEMIS Santé medical devices, interactive customer space, business dashboard connected to your CRM/ERP/LIMS. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Besançon (25) sur site — TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot, centre historique et communes du Grand Besançon. Nous accompagnons les TPE, PME, ETI et grandes entreprises bisontines (microtechniques, dispositifs médicaux, enseignement-recherche, services) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an senior AI architects consultancy that intervenes in Besançon (25) on site — TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot, historic centre and Grand Besançon communes. We support Besançon micro-businesses, SMEs, mid-caps and large enterprises (microtechnologies, medical devices, research, services) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "horlogerie, microtech & santé",

  topSectorsNaf: [
    "Microtechniques, horlogerie & optique de précision",
    "Dispositifs médicaux & santé connectée",
    "Industrie & mécatronique",
    "Enseignement supérieur & recherche",
    "Commerce & services aux entreprises",
    "Activités financières & assurance",
  ],

  distancesFr:
    "Gare Besançon Franche-Comté TGV (Auxon-Dessus, 10 km nord-ouest) sur LGV Rhin-Rhône — Paris en ~2h05. Gare de Besançon-Viotte (centre-ville) également desservie TER + TGV directs Paris. Réseau Ginko (2 lignes tramway + bus) pour desservir TEMIS, Châteaufarine, Trépillot et les communes du Grand Besançon. Aéroport Bâle-Mulhouse-Fribourg à ~140 km (A36) ; aéroport Dole-Tavaux à 45 km.",
  distancesEn:
    "Besançon Franche-Comté TGV station (Auxon-Dessus, 10 km north-west) on the LGV Rhin-Rhône — Paris in ~2h05. Besançon-Viotte city-centre station also served by TER + direct TGV Paris. Ginko network (2 tram lines + buses) covering TEMIS, Châteaufarine, Trépillot and Grand Besançon communes. Basel-Mulhouse-Freiburg Airport ~140 km (A36); Dole-Tavaux Airport 45 km.",

  ecosystemFr:
    "Tissu B2B spécialisé — 9 952 établissements actifs. Technopôle TEMIS Innovation Microtechnique (siège PMT, R&D précision) et TEMIS Santé (dispositifs médicaux), Pôle des Microtechniques Phase V 270+ adhérents, Institut FEMTO-ST (CNRS, ~750 personnes), ENSMM, Université de Franche-Comté, CHRU Besançon, Maty (siège joaillerie/horlogerie), Micronora (salon mondial biennal), French Tech Bourgogne-Franche-Comté, Village by CA Franche-Comté.",
  ecosystemEn:
    "Specialised B2B fabric — 9,952 active businesses. TEMIS Innovation Microtechnique technopole (PMT HQ, precision R&D) and TEMIS Santé (medical devices), Pôle des Microtechniques Phase V 270+ members, Institut FEMTO-ST (CNRS, ~750 people), ENSMM, Université de Franche-Comté, CHRU Besançon, Maty (jewellery/watchmaking HQ), Micronora (biennial world trade fair), French Tech Bourgogne-Franche-Comté, Village by CA Franche-Comté.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Besançon ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Besançon et partout en France.",
    },
    {
      q: "Avez-vous des références dans les microtechniques ou le biomédical bisontins ?",
      a: "Oui. Nos missions à Besançon couvrent des entreprises du tissu microtechnique (TEMIS Innovation), du secteur dispositifs médicaux (TEMIS Santé), des PME industrielles et des structures de recherche. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par secteur.",
    },
    {
      q: "Pouvez-vous intervenir en environnement industriel de précision ou laboratoire médical ?",
      a: "Oui. Nos consultants s'adaptent aux contraintes des environnements de précision et médicaux — protocoles accès site, postes sécurisés, normes réglementaires dispositifs médicaux. La préparation inclut un cadrage réseau/sécurité préalable.",
    },
    {
      q: "Intervenez-vous aussi dans les communes du Grand Besançon (École-Valentin, Chalezeule, Saint-Vit) ?",
      a: "Oui. Le bassin du Grand Besançon est notre territoire d'intervention complet : École-Valentin, Chalezeule, Pirey, Devecey, Saône, Saint-Vit et toutes les communes proches. Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Besançon ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec les startups bisontines (TEMIS, Premice, Village by CA) ?",
      a: "Oui. Nous accompagnons les startups et scale-ups de l'écosystème bisontin — incubateur TEMIS Innovation, Premice deeptech, Village by CA Franche-Comté. Notre offre est calibrée pour les structures en phase de scale qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],

  // === SERVICES LONG-FORM BESANÇON ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise bisontine et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre historique aux ETI microtechniques et médicales de la technopôle TEMIS et aux PME du bassin Grand Besançon.",
        whyHere: [
          "Besançon est la capitale française des microtechniques de précision : le tissu B2B bisontin (TEMIS Innovation, TEMIS Santé, PMT Phase V) génère une forte demande d'audits IA sur les processus de précision — documentation technique, contrôle qualité, R&D.",
          "Tissu sectorisé caractéristique de nos clients bisontins : microtechniques et mécatronique (TEMIS Innovation, ENSMM), dispositifs médicaux (TEMIS Santé, ISIFC, CHRU), horlogerie et joaillerie (Maty, Yema), services aux entreprises (Châteaufarine) et industrie Trépillot.",
          "Nos consultants se déplacent sur l'ensemble du Grand Besançon : TEMIS, Châteaufarine, Trépillot, centre historique, École-Valentin, Chalezeule, Pirey, Devecey, Saône, Saint-Vit et communes proches.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux bisontins, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les ETI microtechniques avec des workflows de précision et des contraintes réglementaires.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Besançon dans vos locaux — TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot ou commune du Grand Besançon — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (R&D, qualité, production, commercial, finance, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités bisontines (protocoles précision, normes médicaux, contraintes industrie).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs techniques, vos rapports qualité, vos données de production, vos dossiers réglementaires. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux bisontins. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur microtechnique, médical ou tertiaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et petits cabinets bisontins jusqu'à une dizaine de collaborateurs — centre historique, Planoise, Montrapon.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME microtechniques et médicales de TEMIS, les cabinets de conseil et agences de quelques dizaines à 250 collaborateurs implantés dans le bassin Grand Besançon.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles et microtechniques (TEMIS Innovation), ETI médicales (TEMIS Santé, CHRU filiales) ou ETI tertiaires souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes dont les sièges ou sites majeurs sont implantés dans le Grand Besançon (Maty, Yema) ou le bassin Doubs (Stellantis Sochaux ~80 km).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel adapté à nos contraintes microtechniques. Le rapport est chiffré, actionnable, sans jargon. On a pu présenter le plan au conseil de direction dès la semaine suivante.",
            role: "Directeur général",
            companyProfile: "ETI microtechniques, technopôle TEMIS Besançon",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données techniques internes plutôt que des slides. Le livrable a permis de prioriser nos chantiers IA avec un ROI chiffré pour chaque cas d'usage.",
            role: "Directrice de la transformation",
            companyProfile: "PME dispositifs médicaux, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Besançon ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI microtechnique bisontine ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports qualité, documentation technique, qualification appels d'offres, lecture de données de production). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données techniques ou médicales restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs médicaux et dispositifs médicaux (TEMIS Santé, CHRU), nous appliquons les contraintes souveraineté et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Besançon ?",
            a: "Toujours en présentiel dans vos locaux bisontins. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes du Grand Besançon ?",
            a: "Oui. Le Grand Besançon est notre territoire complet. Nos consultants se déplacent dans toutes les communes — de Chalezeule à École-Valentin, de Pirey à Saint-Vit, de Devecey à Saône. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits bisontins sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs réglementés (microtechniques, médical, industrie de précision).",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Besançon business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Besançon micro-businesses to precision-tech and medical mid-caps at the TEMIS technopole and Grand Besançon basin SMEs.",
        whyHere: [
          "Besançon is France's capital of precision microtechnologies: the Besançon B2B fabric (TEMIS Innovation, TEMIS Santé, PMT Phase V) drives strong AI audit demand on precision processes — technical documentation, quality control, R&D.",
          "Sector fabric characteristic of our Besançon clients: microtechnologies and mechatronics (TEMIS Innovation, ENSMM), medical devices (TEMIS Santé, ISIFC, CHRU), watchmaking and jewellery (Maty, Yema), business services (Châteaufarine) and Trépillot industry.",
          "Our consultants travel across the full Grand Besançon: TEMIS, Châteaufarine, Trépillot, historic centre, École-Valentin, Chalezeule, Pirey, Devecey, Saône, Saint-Vit and surrounding communes.",
          "Read-outs always in person: ideation workshops at your Besançon offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for precision-tech mid-caps with complex workflows and regulatory constraints.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Besançon at your offices — TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot or a Grand Besançon commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (R&D, quality, production, sales, finance, leadership) to map frictions and expectations, accounting for Besançon sector specifics (precision protocols, medical standards, industrial constraints).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your technical PDFs, quality reports, production data, regulatory files. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Besançon offices. Costed PDF deliverable handed over, actionable roadmap tailored to your precision-tech, medical or services sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Besançon freelancers, micro-firms and small practices up to about ten staff — historic centre, Planoise, Montrapon.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for TEMIS precision-tech and medical SMEs, consulting firms and agencies from a few dozen to 250 staff across the Grand Besançon basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For industrial and precision-tech mid-caps (TEMIS Innovation), medical mid-caps (TEMIS Santé, CHRU affiliates) or services mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups with HQs or major sites in Grand Besançon (Maty, Yema) or the Doubs basin (Stellantis Sochaux ~80 km).",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered an operational audit tailored to our precision-tech constraints. The report is costed, actionable, jargon-free. We were able to present the plan to the board the very next week.",
            role: "CEO",
            companyProfile: "Precision-tech mid-cap, TEMIS technopole Besançon",
          },
          {
            quote:
              "Pragmatic method, demos on our internal technical data rather than slides. The deliverable helped prioritize our AI initiatives with a costed ROI for each use case.",
            role: "Head of Transformation",
            companyProfile: "Medical devices SME, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Besançon?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a precision-tech mid-cap in Besançon?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (quality reports, technical documentation, tender qualification, production data reading). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my technical or medical data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For medical and medical device sectors (TEMIS Santé, CHRU), we apply sovereignty and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Besançon?",
            a: "Always in person at your Besançon offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Grand Besançon communes?",
            a: "Yes. Grand Besançon is our full territory. Our consultants travel to all communes — from Chalezeule to École-Valentin, Pirey to Saint-Vit, Devecey to Saône. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Besançon audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in regulated sectors (precision microtechnologies, medical devices, industry).",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Besançon se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en atelier de précision, en laboratoire médical, au bureau ou en clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Besançon est un terrain d'intervention où la demande de formation IA est portée par des équipes aux profils techniques élevés : ingénieurs microtechniques (ENSMM, TEMIS Innovation), personnels médicaux (TEMIS Santé, CHRU), chercheurs (UFC, FEMTO-ST) et fonctions supports des ETI locales.",
          "Tous les quartiers et communes du Grand Besançon couverts en présentiel : TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot, centre historique, École-Valentin, Chalezeule, Pirey et communes proches.",
          "Le format Essentielle est calibré pour les structures bisontines de quelques personnes à une centaine de collaborateurs, en particulier les PME microtechniques de TEMIS et les cabinets du centre-ville.",
          "Le format Conférence convient aux plénières d'entreprise bisontines (Micropolis, salles TEMIS, espaces incubateur).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI industrielles et des PME technologiques du Grand Besançon.",
          "Vocabulaire ajusté à votre secteur dominant : microtechniques, médical/biomédical, industrie de précision, recherche, services B2B. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes réglementaires microtechniques ou médicales — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports qualité, cahiers des charges techniques, dossiers médicaux anonymisés, devis, emails) pour calibrer les démos sur VOS données bisontines.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux bisontins pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements de précision avec postes à accès restreint.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle bisontine.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit en atelier TEMIS ou en bureau.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, petits cabinets et micro-structures bisontines jusqu'à une dizaine de collaborateurs — centre historique, Planoise, Montrapon.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — R&D, qualité, production, commercial — particulièrement efficace pour les PME microtechniques et médicales de TEMIS.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI microtechniques, pôles médicaux) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges ou grandes implantations bisontines — roadshow multi-sites Grand Besançon, séminaires CODIR + cascade équipes terrain ou laboratoires.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos ingénieurs de précision. Ils sont repartis avec leurs outils configurés sur leurs vrais workflows de documentation technique. Dès le lendemain, plusieurs les utilisaient en production.",
            role: "Directeur R&D",
            companyProfile: "PME microtechniques, TEMIS Innovation Besançon",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes sectorielles médicales — pas de session générique, des cas concrets qui parlaient à nos équipes.",
            role: "DG",
            companyProfile: "ETI dispositifs médicaux, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Besançon ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des ateliers de précision ou laboratoires médicaux ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements de précision et médicaux bisontins — postes à accès restreint, réseaux sécurisés, protocoles accès site. La préparation inclut un audit réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur microtechnique ou médical bisontin ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME microtechnique de TEMIS n'a rien à voir avec une session pour un cabinet de services du centre-ville.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil et formation professionnelle.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur bisontin — microtechniques, médical, industrie de précision, recherche — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Besançon come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in the precision workshop, medical lab, office or in the field. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Besançon is an engagement ground where AI training demand is driven by high-technical profiles: precision engineers (ENSMM, TEMIS Innovation), medical staff (TEMIS Santé, CHRU), researchers (UFC, FEMTO-ST) and support functions of local mid-caps.",
          "All Grand Besançon districts and communes covered in person: TEMIS Innovation, TEMIS Santé, Châteaufarine, Trépillot, historic centre, École-Valentin, Chalezeule, Pirey and surrounding communes.",
          "The Essential format is calibrated for Besançon structures from a few people to about a hundred staff, particularly precision-tech and medical SMEs at TEMIS and city-centre practices.",
          "The Talk format suits Besançon corporate plenaries (Micropolis, TEMIS rooms, incubator spaces).",
          "The Executives format enables in-camera framing for industrial mid-cap and technology SME executive committees across Grand Besançon.",
          "Vocabulary adjusted to your dominant sector: microtechnologies, medical/biomedical, precision industry, research, B2B services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including precision-tech or medical regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quality reports, technical specifications, anonymized medical files, quotes, emails) to calibrate demos on YOUR Besançon data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Besançon offices to check equipment, projection and network access. No technical hiccup on D-day, even in precision environments with restricted-access workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Besançon sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether in a TEMIS workshop or office.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Besançon freelancers, small practices and micro-structures up to about ten staff — historic centre, Planoise, Montrapon.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — R&D, quality, production, sales — particularly effective for precision-tech and medical SMEs at TEMIS.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (precision-tech mid-caps, medical hubs) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Besançon HQs or large sites — multi-site Grand Besançon roadshows, exec committee seminars + field team or lab cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our precision engineers' needs. They left with tools configured for their real technical documentation workflows. By the next day, several were already using them in production.",
            role: "R&D Director",
            companyProfile: "Precision-tech SME, TEMIS Innovation Besançon",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our medical sector constraints — no generic session, concrete cases that resonated with our teams.",
            role: "CEO",
            companyProfile: "Medical devices mid-cap, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Besançon take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in precision workshops or medical laboratories?",
            a: "Yes. Our consultants adapt to Besançon precision and medical environment constraints — restricted-access workstations, secure networks, site access protocols. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Besançon precision-tech or medical sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a TEMIS precision-tech SME has nothing to do with one for a city-centre services firm.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting and professional training service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Besançon sector — microtechnologies, medical, precision industry, research — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Besançon met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux bisontins — TEMIS Innovation, TEMIS Santé, Châteaufarine ou commune du Grand Besançon.",
        whyHere: [
          "Besançon concentre des missions d'implémentation IA dans des secteurs à haute valeur ajoutée : microtechniques (documentation automatisée, contrôle qualité IA), dispositifs médicaux (traçabilité, dossiers réglementaires), recherche (exploitation données FEMTO-ST, UFC) et services B2B.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux bisontins : alignement des équipes, accès aux données de production ou cliniques, validation des intégrations CRM/ERP/LIMS.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite pour démos d'avancement avec votre comité de direction ou responsable de production.",
          "Recette finale toujours en présentiel à Besançon : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit en atelier de précision, en laboratoire ou en bureau.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques bisontins : ETI microtechniques (automatisation documentation technique, surveillance production de précision), PME médicales TEMIS Santé (traçabilité dispositifs, documentation réglementaire), cabinets B2B (qualification prospects, génération documents), structures de recherche UFC/FEMTO-ST (exploitation bibliographique, analyse données).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Besançon : revue de l'architecture cible (CRM, ERP, LIMS, systèmes de précision), validation des contraintes RGPD/sécurité et réglementaires (médical, industrie de précision), sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Besançon : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Besançon : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple — automatisation devis, comptes-rendus, qualification leads pour TPE et indépendants bisontins.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP/LIMS. Pour PME microtechniques TEMIS, éditeurs logiciels, cabinets et agences du Grand Besançon.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel, LIMS médical, datalake), formation ambassadeurs cross-département. Adapté aux ETI microtechniques et médicales bisontines.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes Grand Besançon : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation documentation technique livrée comme promis. ROI mesuré dès les premiers mois : nos ingénieurs passent maintenant moins de temps sur les rapports et plus sur l'amélioration produit. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur industriel",
            companyProfile: "ETI microtechniques, TEMIS Innovation Besançon",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe répartie entre le laboratoire TEMIS Santé et les bureaux du centre. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "PME dispositifs médicaux, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Besançon ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions bisontines. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données techniques ou médicales restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés bisontins (microtechniques, médical, industrie de précision), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données de précision critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (pièces de précision, dossiers réglementaires médicaux, données de recherche), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Besançon brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Besançon offices — TEMIS Innovation, TEMIS Santé, Châteaufarine or a Grand Besançon commune.",
        whyHere: [
          "Besançon concentrates AI implementation missions in high-value sectors: microtechnologies (automated documentation, AI quality control), medical devices (traceability, regulatory files), research (FEMTO-ST, UFC data exploitation) and B2B services.",
          "Kick-off always happens in person at your Besançon offices: team alignment, access to production or clinical data, CRM/ERP/LIMS integration validation.",
          "Remote iterations afterwards with a short daily on video and an on-site visit for progress demos with your executive committee or production manager.",
          "Final acceptance always in person in Besançon: handover, team training on their workstations, runbook documentation delivered — whether in a precision workshop, lab or office.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Besançon cases: precision-tech mid-caps (technical documentation automation, precision production monitoring), TEMIS Santé medical SMEs (device traceability, regulatory documentation), B2B practices (prospect qualification, document generation), UFC/FEMTO-ST research structures (bibliographic exploitation, data analysis).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Besançon workshop: target architecture review (CRM, ERP, LIMS, precision systems), GDPR/security and regulatory constraints validation (medical, precision industry), AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Besançon: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Besançon: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at mission closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case — quote automation, meeting minutes, lead qualification for Besançon micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP/LIMS integration. For TEMIS precision-tech SMEs, software publishers, firms and agencies across Grand Besançon.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial ERP, medical LIMS, datalake), cross-department ambassador training. Tailored for Besançon precision-tech and medical mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Grand Besançon large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Technical documentation automation implementation delivered as promised. ROI measured within the first months: our engineers now spend less time on reports and more on product improvement. No lock-in, we control our deployment.",
            role: "Industrial Director",
            companyProfile: "Precision-tech mid-cap, TEMIS Innovation Besançon",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the TEMIS Santé lab and the city-centre offices. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "Medical devices SME, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Besançon take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Besançon missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my technical or medical data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Besançon regulated sectors (microtechnologies, medical, precision industry), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical precision data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (precision components, regulatory medical files, research data), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel IA Axion-IA à Besançon s'adresse aux dirigeants, décideurs et experts bisontins qui veulent construire leur stratégie IA personnelle et passer à l'action — industrie de précision, médical, recherche, services B2B. Sessions sur mesure, au rythme qui vous convient, en présentiel dans vos locaux bisontins ou à distance. Frais de logement, repas et forfait trajet facturés à part pour les sessions sur site.",
        whyHere: [
          "Besançon compte des dirigeants et décideurs à forte culture technique (microtechniques, médical, recherche) qui cherchent une approche IA rigoureuse et personnalisée, loin des formations génériques.",
          "L'accompagnement individuel est adapté aux profils techniques bisontins : ingénieurs devenus DG, directeurs R&D souhaitant cadrer leur stratégie IA, responsables médicaux évaluant les outils cliniques.",
          "Chaque session est calibrée sur votre réalité professionnelle bisontine : vos outils existants, vos données, vos contraintes réglementaires sectorielles.",
          "Format flexible : sessions à Besançon dans vos locaux (TEMIS, centre-ville, commune Grand Besançon) ou à distance selon votre agenda.",
          "Approche confidentielle : Confidentialité stricte, aucun partage de vos données ou stratégie IA avec des tiers.",
          "À l'issue de l'accompagnement, vous disposez d'un plan IA personnel actionnable, de vos propres prompts et workflows configurés, d'une autonomie réelle.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Session d'évaluation pour cartographier vos usages actuels, vos besoins, votre niveau de confort avec l'IA et les cas d'usage prioritaires dans votre activité bisontine.",
          },
          {
            step: "Sessions thématiques",
            detail:
              "Une à plusieurs sessions focalisées sur vos cas d'usage prioritaires : rédaction, analyse de données, veille, automatisation de workflows, gestion de projets — toujours sur VOS documents réels.",
          },
          {
            step: "Configuration personnalisée",
            detail:
              "Mise en place de vos outils IA personnels (ChatGPT, Claude, Mistral, etc.) avec vos prompts sur mesure et vos workflows spécifiques à votre métier bisontin.",
          },
          {
            step: "Suivi et ajustements",
            detail:
              "Sessions de suivi pour valider l'adoption, ajuster les prompts et workflows, et répondre aux nouvelles questions qui émergent dans votre pratique quotidienne.",
          },
          {
            step: "Bilan et plan IA personnel",
            detail:
              "Synthèse de votre progression, remise de votre plan IA personnel documenté et des ressources pour continuer à progresser en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pack Découverte",
            detail:
              "Idéal pour les indépendants et dirigeants de TPE bisontines souhaitant intégrer l'IA dans leur pratique professionnelle quotidienne.",
          },
          {
            sizeLabel: "PME",
            price: "Pack Stratégie",
            detail:
              "Pour les dirigeants et directeurs de PME qui veulent cadrer leur stratégie IA et devenir des ambassadeurs IA crédibles auprès de leurs équipes.",
          },
          {
            sizeLabel: "ETI",
            price: "Pack Leadership IA",
            detail:
              "Pour les membres de CODIR d'ETI bisontines (microtechniques, médical) souhaitant construire leur vision IA et piloter leur transformation.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme sur devis",
            detail:
              "Accompagnement individuel pour cadres dirigeants de grandes organisations bisontines ou régionales — programme sur mesure multi-sessions.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'accompagnement individuel m'a permis de construire une vraie vision IA pour mon entreprise, adaptée à nos contraintes microtechniques. Je suis maintenant capable d'évaluer les outils IA et de piloter notre transformation en interne.",
            role: "Directeur général",
            companyProfile: "PME microtechniques, Grand Besançon",
          },
          {
            quote:
              "Sessions pratiques, sur mes vrais documents, avec un consultant qui comprenait mes contraintes médicales. J'ai gagné en autonomie et en clarté sur ce que l'IA peut vraiment apporter à notre activité.",
            role: "Directeur médical",
            companyProfile: "Structure médicale, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "Combien de sessions comprend un accompagnement individuel à Besançon ?",
            a: "Le nombre de sessions est défini ensemble en diagnostic initial selon vos objectifs et votre niveau de départ. Un Pack Découverte peut tenir en quelques sessions, un Pack Leadership IA en s'étale sur plus de temps avec un suivi régulier.",
          },
          {
            q: "Les sessions peuvent-elles se tenir à distance ?",
            a: "Oui. Nous proposons des sessions en présentiel dans vos locaux bisontins (frais en sus) ou entièrement à distance selon votre préférence et votre agenda.",
          },
          {
            q: "Mes échanges et données restent-ils confidentiels ?",
            a: "Oui. Confidentialité stricte dès le démarrage. Aucun partage de vos informations stratégiques, de vos données ou de vos prompts avec des tiers. Confidentialité absolue.",
          },
          {
            q: "Puis-je utiliser l'accompagnement pour préparer un projet IA en entreprise ?",
            a: "Oui, c'est l'un des usages les plus fréquents. L'accompagnement individuel vous aide à structurer votre approche, évaluer les options et préparer votre argumentaire pour la direction ou le conseil d'administration.",
          },
          {
            q: "Faut-il avoir des compétences techniques pour bénéficier de l'accompagnement ?",
            a: "Non. Nos accompagnements à Besançon couvrent tous les profils — du dirigeant sans bagage technique au directeur R&D aguerri. Le diagnostic initial calibre le niveau de la première session.",
          },
          {
            q: "Que se passe-t-il après la fin de l'accompagnement ?",
            a: "Vous disposez de votre plan IA personnel documenté, de vos outils configurés et de vos prompts. Si vous souhaitez continuer, des sessions de suivi ponctuelles sont disponibles. Aucun engagement de durée minimum au-delà du pack initial.",
          },
        ],
        guarantees:
          "Confidentialité absolue : Confidentialité stricte, aucun partage de vos données ou stratégie. Contenu 100 % personnalisé sur vos cas d'usage bisontins réels — aucune session générique. Si après la première session vous estimez que le format ne vous convient pas, remboursement des sessions non réalisées. Vos outils et prompts vous appartiennent à l'issue de l'accompagnement.",
      },
      en: {
        hero: "Axion-IA's one-to-one AI coaching in Besançon is for executives, decision-makers and experts who want to build their personal AI strategy and move to action — precision industry, medical, research, B2B services. Bespoke sessions at your pace, in person at your Besançon offices or remotely. Lodging, meals and travel allowance billed separately for on-site sessions.",
        whyHere: [
          "Besançon has executives and decision-makers with strong technical backgrounds (microtechnologies, medical, research) who seek a rigorous, personalised AI approach far from generic training.",
          "One-to-one coaching is suited to Besançon technical profiles: engineers turned CEOs, R&D directors framing their AI strategy, medical managers evaluating clinical AI tools.",
          "Each session is calibrated on your Besançon professional reality: your existing tools, your data, your sector regulatory constraints.",
          "Flexible format: sessions in Besançon at your offices (TEMIS, city centre, Grand Besançon commune) or remotely according to your schedule.",
          "Confidential approach: systematic Strict confidentiality, no sharing of your data or AI strategy with third parties.",
          "After coaching, you have an actionable personal AI plan, your own prompts and configured workflows, and genuine autonomy.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "Assessment session to map your current usage, needs, AI comfort level and priority use cases in your Besançon activity.",
          },
          {
            step: "Thematic sessions",
            detail:
              "One to several sessions focused on your priority use cases: writing, data analysis, monitoring, workflow automation, project management — always on YOUR real documents.",
          },
          {
            step: "Personalised setup",
            detail:
              "Setup of your personal AI tools (ChatGPT, Claude, Mistral, etc.) with bespoke prompts and workflows specific to your Besançon profession.",
          },
          {
            step: "Follow-up and adjustments",
            detail:
              "Follow-up sessions to validate adoption, adjust prompts and workflows, and answer new questions that emerge in your daily practice.",
          },
          {
            step: "Review and personal AI plan",
            detail:
              "Progress summary, delivery of your documented personal AI plan and resources to continue progressing autonomously.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Discovery pack",
            detail:
              "Ideal for Besançon freelancers and micro-business owners wanting to integrate AI into their daily professional practice.",
          },
          {
            sizeLabel: "SME",
            price: "Strategy pack",
            detail:
              "For SME executives and directors who want to frame their AI strategy and become credible AI champions with their teams.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI Leadership pack",
            detail:
              "For Besançon mid-cap executive committee members (precision-tech, medical) wanting to build their AI vision and drive transformation.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom programme",
            detail:
              "Individual coaching for senior executives of large Besançon or regional organisations — bespoke multi-session programme.",
          },
        ],
        testimonials: [
          {
            quote:
              "The one-to-one coaching helped me build a genuine AI vision for my company, adapted to our precision-tech constraints. I can now evaluate AI tools and drive our transformation internally.",
            role: "CEO",
            companyProfile: "Precision-tech SME, Grand Besançon",
          },
          {
            quote:
              "Practical sessions, on my real documents, with a consultant who understood my medical constraints. I gained autonomy and clarity on what AI can truly bring to our activity.",
            role: "Medical Director",
            companyProfile: "Medical structure, TEMIS Santé Besançon",
          },
        ],
        faq: [
          {
            q: "How many sessions does one-to-one coaching in Besançon include?",
            a: "The number of sessions is defined together at the initial diagnosis based on your goals and starting level. A Discovery pack may fit in a few sessions, an AI Leadership pack spans more time with regular follow-up.",
          },
          {
            q: "Can sessions take place remotely?",
            a: "Yes. We offer in-person sessions at your Besançon offices (travel costs billed separately) or fully remote depending on your preference and schedule.",
          },
          {
            q: "Do my exchanges and data remain confidential?",
            a: "Yes. Confidentiality ensured from kick-off. No sharing of your strategic information, data or prompts with third parties. Absolute confidentiality.",
          },
          {
            q: "Can I use coaching to prepare a company AI project?",
            a: "Yes, that is one of the most common uses. One-to-one coaching helps you structure your approach, evaluate options and prepare your case for leadership or the board.",
          },
          {
            q: "Do I need technical skills to benefit from coaching?",
            a: "No. Our Besançon coaching covers all profiles — from executives with no technical background to seasoned R&D directors. The initial diagnosis calibrates the first session level.",
          },
          {
            q: "What happens after coaching ends?",
            a: "You have your documented personal AI plan, configured tools and prompts. If you want to continue, ad-hoc follow-up sessions are available. No minimum commitment beyond the initial pack.",
          },
        ],
        guarantees:
          "Absolute confidentiality: systematic Strict confidentiality, no sharing of your data or strategy. 100% personalised content on your real Besançon use cases — no generic session. If after the first session you feel the format doesn't suit you, refund of unrealised sessions. Your tools and prompts belong to you after coaching.",
      },
    },
  },
};
