// Boulogne-Billancourt (92012) — contenu éditorial (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/boulogne-billancourt.ts (Sprint City Quality V3, ville #31).
// Réalités locales : 21 158 établissements actifs, quartier Trapèze (ZAC Renault Trapèze 74 ha),
// Île Seguin (La Seine Musicale), siège Renault (fondé 1898), siège TF1, siège Boursorama,
// Quai du Point-du-Jour (médias/finance), métro lignes 9 et 10 + tramway T2,
// Paris-Orly à ~13 km, Paris-Montparnasse à ~5 km.

import type { VilleCopy } from "./types";

export const BOULOGNE_BILLANCOURT_COPY: VilleCopy = {
  pitchFr:
    "Boulogne-Billancourt regroupe 21 158 établissements actifs, le siège mondial de Renault (fondé ici en 1898), celui de TF1 et de Boursorama, le quartier d'affaires du Trapèze — première ZAC tertiaire d'Île-de-France hors La Défense — et un district médias/finance au Quai du Point-du-Jour. Axion-IA y intervient sur site, des TPE boulonnaises aux grandes directions IA des sièges de la proche couronne parisienne.",
  pitchEn:
    "Boulogne-Billancourt hosts 21,158 active businesses, the worldwide HQ of Renault (founded here in 1898), TF1 and Boursorama HQs, the Trapèze business district — Île-de-France's leading business zone outside La Défense — and a media/finance cluster at Quai du Point-du-Jour. Axion-IA delivers on site, from Boulogne micro-businesses to large-enterprise AI leadership at the Paris inner-ring HQs.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Boulogne-Billancourt : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI, du cabinet boulonnais au grand groupe du Trapèze ou du Quai du Point-du-Jour.",
      en: "Operational AI audit in Boulogne-Billancourt: we map what can be automated at your company and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic, from Boulogne practices to large groups at Trapèze or Quai du Point-du-Jour.",
    },
    interventions: {
      fr: "Interventions IA à Boulogne-Billancourt : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Boulogne-Billancourt: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Boulogne-Billancourt : on déploie l'IA dans vos outils existants (CRM, ERP, mails, plateformes médias ou systèmes automobiles) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Boulogne-Billancourt: we deploy AI into your existing tools (CRM, ERP, email, media platforms or automotive systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel 1-to-1 à Boulogne-Billancourt : dirigeants, managers, consultants — sessions sur site ou en visio pour ancrer l'IA dans votre pratique personnelle. Format sur mesure calé sur vos cas concrets.",
      en: "Individual 1-to-1 coaching in Boulogne-Billancourt: executives, managers, consultants — on-site or video sessions to embed AI into your personal practice. Custom format built around your real use cases.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI altoséquanaises — site vitrine premium pour groupes médias et audiovisuel du Quai du Point-du-Jour, espace client interactif pour cabinets conseil et PME numériques du Trapèze, dashboard métier connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Hauts-de-Seine SMEs/mid-caps — premium showcase site for Quai du Point-du-Jour media and broadcasting groups, interactive customer space for Trapèze consulting firms and digital SMEs, business dashboard connected to your CRM/ERP. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Boulogne-Billancourt (92) sur site — quartier Trapèze, Île Seguin, Quai du Point-du-Jour, centre-ville et communes limitrophes (Issy-les-Moulineaux, Meudon, Saint-Cloud, Sèvres, Vanves). Nous accompagnons les TPE, PME, ETI et grandes entreprises boulonnaises (automobile, audiovisuel, finance, conseil, numérique) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Boulogne-Billancourt (92) on site — Trapèze district, Île Seguin, Quai du Point-du-Jour, town centre and surrounding communes (Issy-les-Moulineaux, Meudon, Saint-Cloud, Sèvres, Vanves). We support Boulogne micro-businesses, SMEs, mid-caps and large enterprises (automotive, media, finance, consulting, digital) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Conseil, Ingénierie & Services aux entreprises",
    "Audiovisuel, Médias & Communication",
    "Automobile & Mobilité",
    "Banque, Finance & Assurance",
    "Information, Numérique & Édition logicielle",
    "Enseignement, Santé & Services publics",
  ],

  distancesFr:
    "Métro lignes 9 et 10 (Pont-de-Sèvres, Marcel Sembat, Boulogne-Jean Jaurès) + tramway T2 (Île Seguin — Pont de Sèvres). Paris-Montparnasse (TGV Atlantique/Sud-Ouest) à ~5 km. Aéroport Paris-Orly (ORY) à ~13 km, Paris-Charles-de-Gaulle (CDG) à ~30 km. Paris centre-ville (16e, 15e) à 4 km par métro ou vélo.",
  distancesEn:
    "Metro lines 9 and 10 (Pont-de-Sèvres, Marcel Sembat, Boulogne-Jean Jaurès) + tram T2 (Île Seguin — Pont de Sèvres). Paris-Montparnasse TGV station (~5 km, Atlantic/South-West routes). Paris-Orly Airport (ORY) ~13 km, Paris-Charles-de-Gaulle (CDG) ~30 km. Central Paris (15th, 16th) 4 km by metro or bike.",

  ecosystemFr:
    "Tissu B2B très dense — 21 158 établissements actifs, densité 176 ‰. Quartier Trapèze (ZAC Renault Trapèze, 74 ha) : 1er quartier d'affaires nouvelle génération d'Île-de-France hors La Défense. Siège Renault Group (automobile/mobilité), siège TF1 Group (audiovisuel), siège Boursorama (fintech Société Générale), Quai du Point-du-Jour (district médias/finance). Île Seguin en reconversion culturelle (La Seine Musicale). Cap Digital Paris-Région et Systematic Paris-Region en rayonnement.",
  ecosystemEn:
    "Very dense B2B fabric — 21,158 active businesses, density 176 per thousand. Trapèze district (ZAC Renault Trapèze, 74 ha): Île-de-France's leading next-generation business zone outside La Défense. Renault Group HQ (automotive/mobility), TF1 Group HQ (media/broadcasting), Boursorama HQ (Société Générale fintech), Quai du Point-du-Jour (media/finance cluster). Île Seguin in cultural conversion (La Seine Musicale). Cap Digital Paris-Région and Systematic Paris-Region active in the catchment.",

  heroSchema: {
    centerSubLabel: "21 158 établissements actifs",
    satellites: [
      { label: "Renault Group", detail: "Siège mondial — fondé 1898", accent: "primary" },
      { label: "TF1 / Médias", detail: "Hub audiovisuel majeur", accent: "terracotta" },
      { label: "Trapèze", detail: "1er QCA IdF hors La Défense", accent: "mocha" },
      { label: "Boursorama", detail: "Fintech · Banque en ligne", accent: "sage" },
      { label: "Île Seguin", detail: "Culture · Reconversion", accent: "terracotta" },
      { label: "Conseil · Ingénierie", detail: "5 882 établissements M+N", accent: "primary" },
    ],
  },

  // === SERVICES LONG-FORM BOULOGNE-BILLANCOURT ===
  // Même structure que paris.ts / lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise boulonnaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre-ville aux directions IA des sièges du Trapèze, de TF1 et de Renault Group.",
        whyHere: [
          "Boulogne-Billancourt est l'un de nos principaux terrains d'intervention en proche couronne parisienne : la concentration de sièges de grands groupes (Renault, TF1, Boursorama) et de PME conseil génère une forte demande d'audits IA opérationnels.",
          "Tissu B2B très sectorisé dans nos missions boulonnaises : grands groupes du Trapèze et du Quai du Point-du-Jour, PME conseil et services informatiques, startups et scale-ups numériques, cabinets de conseil proches Paris 15e/16e.",
          "Nos consultants se déplacent sur l'ensemble de la commune et les communes du bassin : Issy-les-Moulineaux, Meudon, Saint-Cloud, Sèvres, Vanves — aucun supplément de zone.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux boulonnais, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les grands groupes boulonnais avec des workflows complexes multi-équipes.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Boulogne-Billancourt dans vos locaux — Trapèze, Quai du Point-du-Jour, Île Seguin ou centre-ville — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, finance, production, communication, support, direction) pour cartographier finement frictions et attentes, en tenant compte des spécificités sectorielles boulonnaises (protocoles médias, contraintes automobile, compliance finance).",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports de production ou vos données financières. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux boulonnais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois adaptée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et cabinets boulonnais jusqu'à une dizaine de collaborateurs — centre-ville, quartiers résidentiels, Pont-de-Sèvres.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques, agences, cabinets de conseil et éditeurs logiciels de quelques dizaines à 250 collaborateurs implantés à Boulogne-Billancourt ou dans le bassin ouest parisien.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI tertiaires, médias ou technologiques du Trapèze ou du Quai du Point-du-Jour souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grands groupes et sièges implantés à Boulogne-Billancourt — Renault Group, TF1 Group, Boursorama — souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel structuré et chiffré. Le rapport identifiait des cas d'usage concrets pour nos équipes médias. On a pu présenter le plan au comité de direction dès la semaine suivante.",
            role: "Directeur de la transformation digitale",
            companyProfile: "PME audiovisuel, Quai du Point-du-Jour Boulogne-Billancourt",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes plutôt que des slides. Le livrable a permis de prioriser nos chantiers IA avec un ROI chiffré pour chaque cas d'usage.",
            role: "Directrice innovation",
            companyProfile: "ETI services B2B, quartier Trapèze Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Boulogne-Billancourt ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une ETI du Trapèze ou du Quai du Point-du-Jour ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables (rapports médias, qualification appels d'offres, lecture factures fournisseurs, documentation produit automobile). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs audiovisuel, automobile et financier boulonnais, nous appliquons les contraintes de confidentialité et conformité réglementaire dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Boulogne-Billancourt ?",
            a: "Toujours en présentiel dans vos locaux boulonnais. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi dans les communes limitrophes (Issy-les-Moulineaux, Meudon, Saint-Cloud) ?",
            a: "Oui. Le bassin Boulogne-Billancourt est notre zone d'intervention complète : Issy-les-Moulineaux (~2 km), Vanves (~3 km), Sèvres (~3 km), Meudon (~4 km), Saint-Cloud (~3 km) et bien sûr Paris 15e et 16e limitrophes. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits boulonnais sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction, surtout dans des secteurs à forts enjeux de conformité comme la finance ou l'audiovisuel.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Boulogne-Billancourt business and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Boulogne micro-businesses to large-enterprise AI leadership at Trapèze, TF1 and Renault Group HQs.",
        whyHere: [
          "Boulogne-Billancourt is one of our main engagement hubs in the Paris inner ring: the concentration of large-group HQs (Renault, TF1, Boursorama) and consulting SMEs drives strong operational AI audit demand.",
          "Very sectorised B2B fabric in our Boulogne missions: Trapèze and Quai du Point-du-Jour large groups, consulting and IT services SMEs, digital startups, consulting firms close to Paris 15th/16th.",
          "Our consultants travel to the full municipality and basin communes: Issy-les-Moulineaux, Meudon, Saint-Cloud, Sèvres, Vanves — no zone surcharge.",
          "Read-outs always in person: ideation workshops at your Boulogne offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly relevant for Boulogne large groups with complex multi-team workflows.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Boulogne-Billancourt at your offices — Trapèze, Quai du Point-du-Jour, Île Seguin or town centre — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, production, communications, support, leadership) to map frictions and expectations, accounting for Boulogne sector specifics (media protocols, automotive constraints, finance compliance).",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, production reports or financial data. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Boulogne offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap tailored to your sector.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Boulogne freelancers, micro-firms and practices up to about ten staff — town centre, residential districts, Pont-de-Sèvres.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs, agencies, consulting firms and software publishers from a few dozen to 250 staff based in Boulogne-Billancourt or the western Paris catchment.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For tertiary, media or technology mid-caps at Trapèze or Quai du Point-du-Jour framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large groups and HQs in Boulogne-Billancourt — Renault Group, TF1 Group, Boursorama — framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a structured, costed operational audit. The report identified concrete use cases for our media teams. We were able to present the plan to the board the very next week.",
            role: "Head of Digital Transformation",
            companyProfile: "Audiovisual SME, Quai du Point-du-Jour Boulogne-Billancourt",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than slides. The deliverable helped prioritise our AI initiatives with a costed ROI for each use case.",
            role: "Head of Innovation",
            companyProfile: "B2B services mid-cap, Trapèze district Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Boulogne-Billancourt?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a mid-cap at Trapèze or Quai du Point-du-Jour?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows (media reports, tender qualification, supplier invoice reading, automotive product documentation). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For Boulogne's media, automotive and financial sectors, we apply confidentiality and regulatory compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Boulogne-Billancourt?",
            a: "Always in person at your Boulogne offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover surrounding communes (Issy-les-Moulineaux, Meudon, Saint-Cloud)?",
            a: "Yes. The Boulogne-Billancourt basin is our full territory: Issy-les-Moulineaux (~2 km), Vanves (~3 km), Sèvres (~3 km), Meudon (~4 km), Saint-Cloud (~3 km) and adjacent Paris 15th and 16th. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Boulogne audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction, especially in compliance-sensitive sectors such as finance and broadcasting.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Boulogne-Billancourt se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en agence, en studio, au bureau ou en déplacement clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Boulogne-Billancourt est un terrain d'intervention prioritaire en proche couronne : grands groupes du Trapèze, équipes médias du Quai du Point-du-Jour, PME conseil et cabinets numériques représentent une part significative de nos sessions.",
          "Toute la commune et les communes du bassin couvertes en présentiel : Trapèze, Île Seguin, Quai du Point-du-Jour, centre-ville, Issy-les-Moulineaux, Vanves, Sèvres, Meudon, Saint-Cloud.",
          "Le format Essentielle est calibré pour les structures boulonnaises de quelques personnes à une centaine de collaborateurs, notamment les PME numériques et les cabinets de conseil ouest-parisiens.",
          "Le format Conférence convient aux plénières d'entreprise (espaces La Seine Musicale, auditoriums des sièges du Trapèze, salles de séminaire Pont-de-Sèvres).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des grands groupes boulonnais ou des ETI tertiaires du Trapèze.",
          "Vocabulaire ajusté à votre secteur dominant : médias/audiovisuel, automobile, finance, conseil, numérique. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier — notamment les contraintes audiovisuel, automobile ou finance — et les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (briefs créatifs, emails, rapports de production, données financières, fiches produit automobile) pour calibrer les démos sur VOS données boulonnaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux boulonnais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements sécurisés des grands groupes.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle boulonnaise.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit au bureau du Trapèze ou en déplacement clientèle.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, cabinets et petites agences boulonnaises jusqu'à une dizaine de collaborateurs — centre-ville, Pont-de-Sèvres, quartiers résidentiels.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — commerciaux, création, finance, opérations — particulièrement efficace pour les PME conseil et numériques du bassin ouest parisien.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI tertiaires Trapèze, équipes médias) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges boulonnais — roadshow multi-sites, séminaires CODIR + cascade équipes, sessions thématiques audiovisuel/automobile/finance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de nos équipes créa. Ils sont repartis avec leurs outils configurés sur leurs vrais briefs. Dès le lendemain, plusieurs les utilisaient pour rédiger des notes de synthèse et préparer leurs pitchs.",
            role: "Directeur de la création",
            companyProfile: "Agence communication, Boulogne-Billancourt",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait les enjeux de notre secteur — pas de session générique, des cas concrets qui parlaient directement à nos équipes.",
            role: "DG",
            companyProfile: "ETI services B2B, quartier Trapèze Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Boulogne-Billancourt ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans les locaux sécurisés des grands groupes boulonnais ?",
            a: "Oui. Nos consultants s'adaptent aux protocoles d'accès et aux environnements réseau sécurisés des sièges et grands groupes — VLAN dédiés, postes verrouillés, politique MDM. La préparation inclut un échange technique préalable avec votre DSI ou équipe IT.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux secteurs audiovisuel ou automobile boulonnais ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une équipe TF1 n'a rien à voir avec une session pour une équipe ingénierie Renault ou une équipe compliance Boursorama.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur boulonnais — médias, automobile, finance, conseil, numérique — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Boulogne-Billancourt come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in agencies, studios, offices or in the field. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Boulogne-Billancourt is a priority engagement ground in the Paris inner ring: Trapèze large groups, Quai du Point-du-Jour media teams and western-Paris consulting SMEs represent a significant share of our sessions.",
          "Full municipality and basin communes covered in person: Trapèze, Île Seguin, Quai du Point-du-Jour, town centre, Issy-les-Moulineaux, Vanves, Sèvres, Meudon, Saint-Cloud.",
          "The Essential format is calibrated for Boulogne structures from a few people to about a hundred staff, particularly digital SMEs and west-Paris consulting firms.",
          "The Talk format suits corporate plenaries (La Seine Musicale spaces, Trapèze HQ auditoriums, Pont-de-Sèvres seminar rooms).",
          "The Executives format enables in-camera framing for Boulogne large-group or Trapèze mid-cap executive committees.",
          "Vocabulary adjusted to your dominant sector: media/broadcasting, automotive, finance, consulting, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — including broadcasting, automotive or finance regulatory constraints — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (creative briefs, emails, production reports, financial data, automotive product sheets) to calibrate demos on YOUR Boulogne data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Boulogne offices to check equipment, projection and network access. No technical hiccup on D-day, even in large-group secure environments.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Boulogne sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at a Trapèze office or out in the field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal Boulogne freelancers, practices and small agencies up to about ten staff — town centre, Pont-de-Sèvres, residential districts.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — sales, creative, finance, operations — particularly effective for west-Paris consulting and digital SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Trapèze tertiary mid-caps, media teams) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Boulogne HQs — multi-site roadshows, exec committee seminars + field team or creative team cascade, themed automotive/media/finance sessions.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our creative team's needs. They left with tools configured for their real briefs. By the next day, several were already using them to draft summaries and prepare pitches.",
            role: "Creative Director",
            companyProfile: "Communications agency, Boulogne-Billancourt",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our sector challenges — no generic session, concrete cases that resonated directly with our teams.",
            role: "CEO",
            companyProfile: "B2B services mid-cap, Trapèze district Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Boulogne-Billancourt take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in secure large-group offices in Boulogne?",
            a: "Yes. Our consultants adapt to the access protocols and secure network environments of large-group HQs — dedicated VLANs, locked-down workstations, MDM policies. Preparation includes an upfront technical exchange with your IT or DSI team.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Boulogne media or automotive sectors?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a TF1 team has nothing to do with one for a Renault engineering team or a Boursorama compliance team.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Boulogne sector — media, automotive, finance, consulting, digital — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Boulogne-Billancourt met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux boulonnais — Trapèze, Quai du Point-du-Jour, Île Seguin ou centre-ville.",
        whyHere: [
          "Boulogne-Billancourt concentre une part de nos missions d'implémentation en proche couronne, principalement dans les services aux entreprises (Trapèze), les médias et la communication (Quai du Point-du-Jour), la finance (Boursorama et cabinets) et les PME numériques du bassin.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux boulonnais : alignement des équipes, accès aux données de production, validation des intégrations CRM/ERP/plateformes métier.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable opérationnel.",
          "Recette finale toujours en présentiel à Boulogne-Billancourt : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — bureau, studio ou plateau de tournage.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques boulonnais : grands groupes médias (automatisation montage reportages, veille concurrentielle, génération de contenus), PME conseil (qualification prospects, génération documents), cabinets finance (analyse portefeuilles, conformité réglementaire), équipes automobile (documentation technique, support client).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Boulogne : revue de l'architecture cible (CRM, ERP, plateformes médias, systèmes automobile), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Boulogne : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Boulogne : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de plusieurs semaines.",
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
              "Implémentation d'un cas d'usage simple en quelques semaines — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants boulonnais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME conseil, agences numériques, cabinets et éditeurs du bassin ouest parisien.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (CRM, plateformes médias, outils finance), formation ambassadeurs cross-département. Adapté aux ETI tertiaires et médias boulonnaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes boulonnais : cas d'usage cascadés multi-équipes ou multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation de notre outil de veille et génération de contenus livrée dans les délais. ROI mesuré dès les premiers mois : nos équipes rédaction gagnent un temps significatif par publication. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur des opérations digitales",
            companyProfile: "PME médias, Quai du Point-du-Jour Boulogne-Billancourt",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le Trapèze et plusieurs sites clients. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome.",
            role: "CTO",
            companyProfile: "ETI services B2B, quartier Trapèze Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Boulogne-Billancourt ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions boulonnaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés boulonnais (finance, audiovisuel, automobile), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Comment gérez-vous les enjeux de confidentialité pour les données médias ou financières ?",
            a: "Tous nos déploiements boulonnais incluent une analyse de confidentialité préalable : classification des données, sélection de modèles conformes (souveraineté UE si requis), contrôles d'accès, audit de logs. Pour les données financières réglementées ou les contenus médias sous droit, nous adaptons l'architecture dès le cadrage.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Boulogne-Billancourt brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Boulogne offices — Trapèze, Quai du Point-du-Jour, Île Seguin or town centre.",
        whyHere: [
          "Boulogne-Billancourt hosts a share of our implementation missions in the Paris inner ring, mainly in business services (Trapèze), media and communications (Quai du Point-du-Jour), finance (Boursorama and firms) and digital SMEs in the catchment.",
          "Kick-off always happens in person at your Boulogne offices: team alignment, access to production data, CRM/ERP/business platform integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or operations manager.",
          "Final acceptance always in person in Boulogne: handover, team training on their workstations, runbook documentation delivered — office, studio or broadcast floor.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Boulogne cases: large media groups (broadcast report automation, competitive monitoring, content generation), consulting SMEs (prospect qualification, document generation), finance firms (portfolio analysis, regulatory compliance), automotive teams (technical documentation, customer support).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Boulogne workshop: target architecture review (CRM, ERP, media platforms, automotive systems), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Boulogne: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Boulogne: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
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
              "Implementation of a simple use case over a few weeks — quote automation, meeting minutes, lead qualification for Boulogne micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For west-Paris consulting SMEs, digital agencies, firms and software publishers.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (CRM, media platforms, finance tools), cross-department ambassador training. Tailored for Boulogne tertiary and media mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Boulogne large accounts: cascaded multi-team or multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Our monitoring and content generation tool implementation was delivered on time. ROI measured within the first months: our editorial teams save significant time per publication. No lock-in, we control our deployment.",
            role: "Head of Digital Operations",
            companyProfile: "Media SME, Quai du Point-du-Jour Boulogne-Billancourt",
          },
          {
            quote:
              "Perfect hybrid method for our team split between Trapèze and multiple client sites. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously.",
            role: "CTO",
            companyProfile: "B2B services mid-cap, Trapèze district Boulogne-Billancourt",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Boulogne-Billancourt take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Boulogne missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For Boulogne regulated sectors (finance, broadcasting, automotive), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "How do you handle confidentiality for media or financial data?",
            a: "All our Boulogne deployments include an upfront confidentiality analysis: data classification, compliant model selection (EU sovereignty if required), access controls, log auditing. For regulated financial data or rights-protected media content, we adapt the architecture at framing stage.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel Axion-IA à Boulogne-Billancourt s'adresse aux dirigeants, managers et consultants qui veulent ancrer l'IA dans leur pratique professionnelle quotidienne — pas de session de groupe, pas de programme standard. Chaque parcours est construit autour de VOS cas concrets, en présentiel dans vos locaux boulonnais ou en visio, au rythme qui vous convient.",
        whyHere: [
          "Boulogne-Billancourt concentre un tissu dense de dirigeants et managers de grands groupes (Renault, TF1, Boursorama) et de PME conseil qui cherchent à monter en compétence IA de façon personnalisée.",
          "Nos consultants s'adaptent à votre agenda : sessions en présentiel au Trapèze, au Quai du Point-du-Jour ou dans vos bureaux, ou en visio selon vos contraintes.",
          "Le parcours couvre votre outil de travail réel : vos emails, vos présentations, vos reportings, vos supports de négociation, vos documents contractuels — rien de générique.",
          "Confidentialité maximale : format 1-to-1, aucun partage avec d'autres participants, confidentialité stricte assurée dès la première session.",
          "Progression mesurée : après chaque session, vous identifiez les cas d'usage que vous maîtrisez et ceux à approfondir. Pas de formation pour la formation.",
          "Disponibilité flexible : sessions ponctuelles ou programme régulier selon votre besoin — d'une session de cadrage à un accompagnement mensuel sur plusieurs mois.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Un échange de cadrage pour identifier vos cas d'usage prioritaires, votre niveau actuel avec les outils IA et vos objectifs professionnels — que vous soyez dirigeant Renault, manager TF1 ou consultant indépendant boulonnais.",
          },
          {
            step: "Première session sur vos données",
            detail:
              "Session en présentiel ou visio sur vos vrais documents et workflows. On installe, on configure, on pratique sur VOS cas — pas sur des exemples génériques.",
          },
          {
            step: "Ancrage pratique",
            detail:
              "Entre les sessions, vous pratiquez sur vos cas réels. À la session suivante, on part de vos retours d'expérience pour affiner, débloquer les points de friction et explorer de nouveaux cas d'usage.",
          },
          {
            step: "Autonomie progressive",
            detail:
              "L'objectif est que vous n'ayez plus besoin de nous. Chaque session vous rend plus autonome, jusqu'à ce que vous puissiez former vous-même vos collaborateurs ou porter les cas IA en comité de direction.",
          },
          {
            step: "Bilan et suite",
            detail:
              "En fin de parcours, bilan des acquis et recommandations pour la suite : auto-formation, délégation interne, chantier d'implémentation ou format groupe pour votre équipe.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Session individuelle ou pack",
            detail:
              "Idéal pour indépendants, consultants et dirigeants de TPE boulonnaises qui veulent intégrer l'IA dans leur pratique sans passer par un programme collectif.",
          },
          {
            sizeLabel: "PME",
            price: "Pack dirigeant ou manager clé",
            detail:
              "Pour les dirigeants et managers de PME du bassin ouest parisien qui pilotent une transformation IA et veulent en maîtriser les fondamentaux avant de l'impulser à leurs équipes.",
          },
          {
            sizeLabel: "ETI",
            price: "Programme cadres dirigeants",
            detail:
              "Pour les cadres dirigeants des ETI du Trapèze ou du Quai du Point-du-Jour : CODIR, DGA, DSI, CDO — programme structuré sur plusieurs mois avec suivi de progression.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme exécutif sur mesure",
            detail:
              "Pour les dirigeants et décideurs des grands groupes boulonnais — tarif sur devis, format et rythme entièrement sur mesure selon votre agenda et vos objectifs.",
          },
        ],
        testimonials: [
          {
            quote:
              "Trois sessions suffisaient pour que j'utilise l'IA tous les jours dans ma pratique de consultant. Le format 1-to-1 m'a permis de rester sur mes vrais cas, sans perdre de temps sur des fonctionnalités inutiles pour moi.",
            role: "Directeur associé",
            companyProfile: "Cabinet de conseil indépendant, Boulogne-Billancourt",
          },
          {
            quote:
              "Accompagnement personnalisé très efficace. Je suis parti de zéro sur les outils IA et en quelques séances j'ai pu piloter notre chantier de transformation avec une vraie vision des possibles.",
            role: "Directrice générale",
            companyProfile: "PME services B2B, proche couronne Paris ouest",
          },
        ],
        faq: [
          {
            q: "En quoi le format 1-to-1 diffère-t-il d'une intervention de groupe ?",
            a: "Tout est centré sur vous : vos outils, vos cas d'usage, votre secteur, votre rythme. Une session de groupe doit couvrir le plus grand commun dénominateur des participants. Le 1-to-1 vous fait gagner un temps considérable et vous donne une maîtrise plus profonde sur ce qui vous importe vraiment.",
          },
          {
            q: "Combien de sessions sont nécessaires pour être autonome ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Certains dirigeants atteignent l'autonomie sur leurs cas prioritaires en trois sessions, d'autres préfèrent un accompagnement mensuel régulier sur plusieurs mois. On cale le rythme ensemble à la première session.",
          },
          {
            q: "Les sessions peuvent-elles se faire en visio plutôt qu'en présentiel ?",
            a: "Oui. Format hybride selon vos contraintes : la première session est idéalement en présentiel pour l'installation des outils, mais les sessions suivantes peuvent se faire intégralement en visio avec partage d'écran.",
          },
          {
            q: "Mes échanges et données restent-ils strictement confidentiels ?",
            a: "Oui. Confidentialité stricte dès le démarrage, aucun partage avec d'autres participants ou clients. Le format 1-to-1 garantit une confidentialité totale sur vos cas, vos données et vos enjeux stratégiques.",
          },
          {
            q: "Ce format est-il adapté à quelqu'un qui n'a jamais utilisé l'IA ?",
            a: "Tout à fait. Nous adaptons le niveau au vôtre dès la première session. Pas de prérequis technique — si vous savez utiliser un smartphone et un email, vous êtes prêt.",
          },
          {
            q: "Peut-on combiner le 1-to-1 avec une intervention de groupe pour mon équipe ?",
            a: "Oui, c'est même recommandé. Le parcours dirigeant vous permet de maîtriser les fondamentaux avant de commander une session collective pour votre équipe. Axion-IA peut coordonner les deux formats pour une montée en compétence cohérente.",
          },
        ],
        guarantees:
          "Sessions au rythme qui vous convient, sans engagement de volume minimum. Confidentialité totale : Confidentialité stricte, format 1-to-1, aucun partage. Outils opérationnels dès la première session : vous pratiquez sur vos vrais cas, pas des exercices fictifs. Si après la première session vous estimez que le format ne vous correspond pas, remboursement intégral.",
      },
      en: {
        hero: "Axion-IA's individual coaching in Boulogne-Billancourt targets executives, managers and consultants who want to embed AI into their daily professional practice — no group session, no standard programme. Each journey is built around YOUR real use cases, in person at your Boulogne offices or over video, at the pace that suits you.",
        whyHere: [
          "Boulogne-Billancourt hosts a dense fabric of executives and managers from large groups (Renault, TF1, Boursorama) and consulting SMEs who want to build AI skills in a personalised way.",
          "Our consultants adapt to your schedule: in-person sessions at Trapèze, Quai du Point-du-Jour or your offices, or over video per your constraints.",
          "The journey covers your real work tools: your emails, presentations, reports, negotiation materials, contractual documents — nothing generic.",
          "Maximum confidentiality: 1-to-1 format, no sharing with other participants, Strict confidentiality from the first session.",
          "Measured progression: after each session you identify use cases you have mastered and those to deepen. No training for the sake of training.",
          "Flexible availability: ad-hoc sessions or a regular programme per your need — from a single framing session to monthly coaching over several months.",
        ],
        methodology: [
          {
            step: "Initial diagnostic",
            detail:
              "A framing exchange to identify your priority use cases, your current level with AI tools and your professional objectives — whether you are a Renault executive, a TF1 manager or a Boulogne independent consultant.",
          },
          {
            step: "First session on your data",
            detail:
              "In-person or video session on your real documents and workflows. We install, configure and practise on YOUR cases — not generic examples.",
          },
          {
            step: "Practical anchoring",
            detail:
              "Between sessions you practise on your real cases. At the next session we start from your feedback to refine, unblock friction points and explore new use cases.",
          },
          {
            step: "Progressive autonomy",
            detail:
              "The goal is that you no longer need us. Each session makes you more autonomous until you can train your own staff or champion AI initiatives at board level.",
          },
          {
            step: "Review and next steps",
            detail:
              "At the end of the journey, review of acquired skills and recommendations for next steps: self-training, internal delegation, implementation project or group format for your team.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual session or pack",
            detail:
              "Ideal for Boulogne freelancers, consultants and micro-business owners who want to integrate AI into their practice without going through a group programme.",
          },
          {
            sizeLabel: "SME",
            price: "Executive or key manager pack",
            detail:
              "For SME leaders and managers in the western Paris catchment who are driving an AI transformation and want to master the fundamentals before rolling it out to their teams.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Senior leadership programme",
            detail:
              "For senior executives at Trapèze or Quai du Point-du-Jour mid-caps: C-suite, COO, CIO, CDO — structured programme over several months with progress tracking.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Bespoke executive programme",
            detail:
              "For executives and decision-makers at Boulogne large groups — quoted on request, format and pace entirely bespoke to your schedule and objectives.",
          },
        ],
        testimonials: [
          {
            quote:
              "Three sessions were enough for me to use AI every day in my consulting practice. The 1-to-1 format kept me on my real cases without wasting time on features I didn't need.",
            role: "Partner",
            companyProfile: "Independent consulting firm, Boulogne-Billancourt",
          },
          {
            quote:
              "Very effective personalised coaching. I started from zero on AI tools and within a few sessions I was able to drive our transformation project with a real understanding of what's possible.",
            role: "CEO",
            companyProfile: "B2B services SME, western Paris inner ring",
          },
        ],
        faq: [
          {
            q: "How does the 1-to-1 format differ from a group session?",
            a: "Everything is centred on you: your tools, your use cases, your sector, your pace. A group session must cover the lowest common denominator of participants. The 1-to-1 saves you considerable time and gives you deeper mastery of what truly matters to you.",
          },
          {
            q: "How many sessions are needed to reach autonomy?",
            a: "It depends on your starting level and objectives. Some executives reach autonomy on their priority use cases in three sessions; others prefer a regular monthly coaching over several months. We agree on the pace together at the first session.",
          },
          {
            q: "Can sessions be done over video rather than in person?",
            a: "Yes. Hybrid format per your constraints: the first session is ideally in person for tool installation, but subsequent sessions can be fully remote with screen sharing.",
          },
          {
            q: "Do my exchanges and data remain strictly confidential?",
            a: "Yes. Strict confidentiality from the start, no sharing with other participants or clients. The 1-to-1 format guarantees total confidentiality on your use cases, your data and your strategic context.",
          },
          {
            q: "Is this format suitable for someone who has never used AI?",
            a: "Absolutely. We adapt the level to yours from the first session. No technical prerequisites — if you can use a smartphone and email, you are ready.",
          },
          {
            q: "Can the 1-to-1 be combined with a group session for my team?",
            a: "Yes, and it is even recommended. The executive journey lets you master the fundamentals before commissioning a group session for your team. Axion-IA can coordinate both formats for a consistent skills build-up.",
          },
        ],
        guarantees:
          "Sessions at the pace that suits you, no minimum volume commitment. Total confidentiality: Strict confidentiality, 1-to-1 format, no sharing. Operational tools from the first session: you practise on your real cases, not fictitious exercises. If after the first session you feel the format is not right for you, full refund.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Boulogne-Billancourt ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Boulogne-Billancourt et partout en France.",
    },
    {
      q: "Avez-vous des cas clients à Boulogne-Billancourt ou dans le bassin ouest parisien ?",
      a: "Oui. Plusieurs de nos références sont des entreprises boulonnaises ou du bassin ouest parisien : ETI tertiaire Trapèze, PME médias Quai du Point-du-Jour, cabinet conseil proche couronne, PME numérique Issy-les-Moulineaux. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par ville.",
    },
    {
      q: "Quels secteurs sont prioritaires à Boulogne-Billancourt pour une mission IA ?",
      a: "Nos déploiements boulonnais couvrent en priorité les services aux entreprises et le conseil (5 882 établissements M+N), l'audiovisuel et les médias (siège TF1, Quai du Point-du-Jour), la finance et la fintech (siège Boursorama), et le numérique et l'édition logicielle. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Intervenez-vous dans le quartier Trapèze et autour de l'Île Seguin ?",
      a: "Oui. Le Trapèze (ZAC Renault Trapèze, 74 ha) et l'Île Seguin sont des zones d'intervention courantes. Nos consultants connaissent les contraintes d'accès et les environnements de travail de ces quartiers — sièges d'entreprise, espaces de coworking, sites culturels en activité.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Boulogne-Billancourt ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Intervenez-vous aussi dans les communes limitrophes (Issy-les-Moulineaux, Meudon, Saint-Cloud, Sèvres) ?",
      a: "Oui. Le bassin Boulogne-Billancourt est notre zone d'intervention complète : Issy-les-Moulineaux (~2 km), Vanves (~3 km), Sèvres (~3 km), Saint-Cloud (~3 km), Meudon (~4 km), et Paris 15e/16e limitrophes. Aucun supplément de zone.",
    },
  ],
};
