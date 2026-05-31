// Montreuil (93048) — contenu éditorial (Sprint City Quality V3 2026-05-20).
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
// Sources économiques : economic-data/montreuil.ts (Sprint City Quality V3, ville #35).
// Réalités locales : Bas-Montreuil (siège Ubisoft, BNP Paribas Personal Finance),
// AFD (siège), Capgemini (site majeur), Cap Digital Paris-Région, métro ligne 9
// (Croix de Chavaux, Mairie de Montreuil, Robespierre), IUT Montreuil (Sorbonne Paris Nord),
// La Pousse (incubateur ESS), ZAC Boissière-Acacia, limitrophe Paris 20e.

import type { VilleCopy } from "./types";

export const MONTREUIL_COPY: VilleCopy = {
  pitchFr:
    "Montreuil (93) concentre le siège mondial d'Ubisoft, le siège de l'AFD et de BNP Paribas Personal Finance, un site Capgemini majeur et un tissu numérique dense dans le Bas-Montreuil. Axion-IA intervient sur site dans cette 4e ville d'Île-de-France, des TPE créatives aux grandes directions numériques et financières.",
  pitchEn:
    "Montreuil (93) is home to Ubisoft's global HQ, AFD and BNP Paribas Personal Finance headquarters, a major Capgemini site and a dense digital fabric in the Bas-Montreuil district. Axion-IA delivers on site in this 4th largest Île-de-France city, from creative micro-businesses to large digital and financial leadership teams.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Montreuil : nous cartographions les cas automatisables dans votre structure et chiffrons le ROI. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des studios indépendants du Bas-Montreuil aux grandes directions numériques et financières.",
      en: "Operational AI audit in Montreuil: we map automatable use cases in your organisation and quantify the ROI. Four tiers from Flash to Mid-cap Strategic cover every size, from independent Bas-Montreuil studios to large digital and financial leadership teams.",
    },
    interventions: {
      fr: "Interventions IA à Montreuil : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur leurs outils IA, configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Montreuil: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations, configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Montreuil : on déploie l'IA dans vos outils existants (CRM, ERP, outils métier jeu vidéo, banque) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance Axion-IA.",
      en: "AI implementation in Montreuil: we deploy AI into your existing tools (CRM, ERP, gaming tools, banking systems) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Montreuil : accompagnement dirigeant ou manager sur vos cas d'usage réels — jeu vidéo, finance, numérique, conseil. Sessions sur site ou à distance, rythme ajusté à votre agenda.",
      en: "Individual 1-to-1 AI coaching in Montreuil: executive or manager support on your real use cases — gaming, finance, digital, consulting. On-site or remote sessions, pace adjusted to your schedule.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI montreuilloises — site vitrine premium pour studios jeu vidéo et acteurs ESS du Bas-Montreuil, espace client interactif pour banque et finance (AFD, BNP PF), dashboard métier connecté à votre CRM/ERP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Montreuil SMEs/mid-caps — premium showcase site for Bas-Montreuil gaming studios and social-economy players, interactive customer space for banking and finance (AFD, BNP PF), business dashboard connected to your CRM/ERP. Senior architects, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Montreuil (93) sur site — Bas-Montreuil, Croix de Chavaux, Mairie de Montreuil et communes limitrophes (Paris 20e, Bagnolet, Vincennes). Nous accompagnons TPE, PME, ETI et grandes entreprises montreuillaises (numérique, jeu vidéo, banque, conseil, ESS) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI architects consultancy that intervenes in Montreuil (93) on site — Bas-Montreuil, Croix de Chavaux, Mairie de Montreuil and neighbouring communes (Paris 20th, Bagnolet, Vincennes). We support Montreuil micro-businesses, SMEs, mid-caps and large enterprises (digital, gaming, banking, consulting, social economy) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "numérique, jeu & banque, finance",
  topSectorsNaf: [
    "Numérique, Jeu vidéo & Édition logicielle",
    "Banque, Finance & Crédit",
    "Conseil & Services aux entreprises",
    "Commerce & Hébergement-restauration",
    "Administration publique & Action sociale",
    "Économie sociale et solidaire (ESS)",
  ],

  distancesFr:
    "Métro ligne 9 : stations Croix de Chavaux, Robespierre et Mairie de Montreuil desservent le cœur de ville et le Bas-Montreuil. Paris Gare de Lyon (TGV) accessible via métro (~25 min). Aéroport Paris-Charles de Gaulle à 22 km. Limitrophe Paris 20e (Porte de Bagnolet, Porte de Montreuil).",
  distancesEn:
    "Metro line 9: Croix de Chavaux, Robespierre and Mairie de Montreuil stations serve the town centre and Bas-Montreuil. Paris Gare de Lyon (TGV) accessible via metro (~25 min). Paris-Charles de Gaulle Airport 22 km away. Adjacent to Paris 20th arrondissement (Porte de Bagnolet, Porte de Montreuil).",

  ecosystemFr:
    "Tissu B2B sectorisé sur un périmètre dense — 4e ville d'Île-de-France (~111 000 hab). Bas-Montreuil : siège mondial Ubisoft (2 200+ employés), siège AFD, siège BNP Paribas Personal Finance, site majeur Capgemini. Écosystème numérique Cap Digital Paris-Région. Incubateur La Pousse (ESS). IUT Montreuil (Sorbonne Paris Nord). ZAC Boissière-Acacia en développement.",
  ecosystemEn:
    "Sectorised B2B fabric in a dense footprint — 4th largest Île-de-France city (~111,000 residents). Bas-Montreuil: Ubisoft global HQ (2,200+ employees), AFD HQ, BNP Paribas Personal Finance HQ, major Capgemini site. Cap Digital Paris-Région digital ecosystem. La Pousse incubator (social economy). IUT Montreuil (Sorbonne Paris Nord). ZAC Boissière-Acacia under development.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Montreuil ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Montreuil et partout en France.",
    },
    {
      q: "Avez-vous des références dans le secteur numérique ou jeu vidéo à Montreuil ?",
      a: "Oui. Le Bas-Montreuil concentre des structures numériques et créatives avec lesquelles nous travaillons : studios indépendants, agences digitales, équipes IT de grands groupes. Les cas récents sont consultables dans la rubrique Cas concrets, filtrables par secteur.",
    },
    {
      q: "Pouvez-vous intervenir pour des équipes financières à Montreuil ?",
      a: "Oui. Les directions financières, équipes crédit, compliance et gestion des risques figurent parmi nos profils d'intervention récurrents. Nos démos s'appuient sur vos données réelles (reporting, scoring, contrats) pour montrer l'IA appliquée à vos vrais workflows.",
    },
    {
      q: "Comment rejoindre Montreuil pour une intervention depuis Paris ou la banlieue ?",
      a: "Le centre-ville et le Bas-Montreuil sont directement desservis par le métro ligne 9 (Croix de Chavaux, Robespierre, Mairie de Montreuil). Depuis Paris intra-muros, le trajet est court. Nos consultants gèrent leur déplacement — frais de logement, repas et forfait trajet facturés à part.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Montreuil ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Travaillez-vous avec des structures de l'ESS ou des incubateurs à Montreuil ?",
      a: "Oui. Les structures de l'économie sociale et solidaire (ESS) et les porteurs de projets incubés à La Pousse peuvent bénéficier d'un Audit sur place ou d'une intervention Essentielle calibrée pour les petites structures. Nous adaptons la profondeur et le format à votre réalité opérationnelle.",
    },
  ],

  // === SERVICES LONG-FORM MONTREUIL ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation montreuilloise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des studios indépendants et agences numériques du Bas-Montreuil aux grandes directions financières et IT de Montreuil.",
        whyHere: [
          "Montreuil concentre un tissu B2B sectorisé exceptionnel pour sa taille : numérique (Ubisoft, Capgemini), finance (AFD, BNP Paribas Personal Finance), conseil IT et ESS — tous secteurs pour lesquels l'IA opérationnelle génère un ROI mesurable rapide.",
          "Le Bas-Montreuil est notre zone d'intervention principale en Seine-Saint-Denis : nos consultants connaissent les contraintes des équipes créatives (jeu vidéo, médias), des directions IT et des back-offices financiers présents dans ce quartier.",
          "Nos consultants se déplacent sur l'ensemble de la commune et des communes limitrophes : Bas-Montreuil, Croix de Chavaux, Mairie de Montreuil, Bagnolet, Vincennes, Rosny-sous-Bois, Fontenay-sous-Bois.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux montreuillois, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement structurant pour les grandes directions IT ou financières dont les workflows sont documentés dans des systèmes CRM ou ERP.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Montreuil dans vos locaux — Bas-Montreuil, Croix de Chavaux ou commune limitrophe — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (production créative, IT, finance, support, direction) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités sectorielles : processus jeu vidéo, compliance financière, projets de coopération internationale.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos rapports analytiques, vos données de production ou vos dossiers de financement. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux montreuillois. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur et à votre structure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, studios créatifs, agences et petites structures du Bas-Montreuil jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME numériques, agences digitales, cabinets de conseil et entreprises de services de quelques dizaines à 250 collaborateurs implantées à Montreuil.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI financières, numériques ou de services souhaitant cadrer une trajectoire IA pluriannuelle avec gouvernance et plan de déploiement multi-équipes.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises dont les sièges ou sites majeurs sont implantés à Montreuil — Ubisoft, AFD, BNP Paribas Personal Finance, Capgemini.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré un audit opérationnel concis et chiffré. Le plan d'action était présentable au comité de direction dès la semaine suivante, avec des cas d'usage concrets ancrés dans nos workflows réels.",
            role: "Directeur général",
            companyProfile: "ETI numérique, Bas-Montreuil",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos données internes plutôt que des slides génériques. Le livrable nous a permis de prioriser nos chantiers IA avec un ROI chiffré pour chaque cas — exactement ce que le board attendait.",
            role: "Directrice transformation digitale",
            companyProfile: "PME conseil IT, Montreuil",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Montreuil ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre pour une grande direction IT ou financière à Montreuil ?",
            a: "Sur les audits Stratégique ETI, le ROI identifié à 12 mois représente typiquement plusieurs équivalents temps plein gagnés sur les workflows automatisables : reporting, traitement de dossiers, qualification de données, rédaction de documents réglementaires. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données financières ou métier restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Pour les secteurs financiers et réglementés, nous appliquons les contraintes de souveraineté et de conformité dès la sélection des modèles IA.",
          },
          {
            q: "Comment se déroule la restitution finale à Montreuil ?",
            a: "Toujours en présentiel dans vos locaux montreuillois. Atelier de plusieurs heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter en board.",
          },
          {
            q: "Intervenez-vous aussi à Bagnolet, Vincennes ou Rosny-sous-Bois ?",
            a: "Oui. L'ensemble du bassin d'emploi montreuillois est notre zone d'intervention : Bagnolet, Vincennes, Romainville, Rosny-sous-Bois, Fontenay-sous-Bois, Le Pré-Saint-Gervais. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. Une grande part de nos audits montreuillois sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction — surtout dans des secteurs aux contraintes particulières comme la finance ou les services publics.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Montreuil organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from independent Bas-Montreuil studios to large financial and IT leadership teams.",
        whyHere: [
          "Montreuil packs an exceptional sectorised B2B fabric for its size: digital (Ubisoft, Capgemini), finance (AFD, BNP Paribas Personal Finance), IT consulting and social economy — all sectors where operational AI delivers measurable ROI fast.",
          "Bas-Montreuil is our primary intervention zone in Seine-Saint-Denis: our consultants are familiar with the constraints of creative teams (gaming, media), IT departments and financial back-offices present in this district.",
          "Our consultants travel across the full commune and neighbouring areas: Bas-Montreuil, Croix de Chavaux, Mairie de Montreuil, Bagnolet, Vincennes, Rosny-sous-Bois, Fontenay-sous-Bois.",
          "Read-outs always in person: ideation workshops at your Montreuil offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Particularly structured for large IT or financial departments whose workflows are documented in CRM or ERP systems.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Montreuil at your offices — Bas-Montreuil, Croix de Chavaux or a neighbouring commune — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (creative production, IT, finance, support, leadership) to map frictions and expectations, accounting for sector specifics: gaming production processes, financial compliance, international development projects.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, analytical reports, production data or financing files. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Montreuil offices. Costed PDF deliverable handed over, actionable roadmap tailored to your sector and organisation.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Bas-Montreuil freelancers, creative studios, agencies and small structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs, web agencies, consulting firms and service companies from a few dozen to 250 staff in Montreuil.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For financial, digital or services mid-caps framing a multi-year AI trajectory with governance and multi-team deployment plan.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises with HQs or major sites in Montreuil — Ubisoft, AFD, BNP Paribas Personal Finance, Capgemini.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a concise and costed operational audit. The action plan was boardroom-ready the very next week, with concrete use cases anchored in our real workflows.",
            role: "CEO",
            companyProfile: "Digital mid-cap, Bas-Montreuil",
          },
          {
            quote:
              "Pragmatic method, demos on our internal data rather than generic slides. The deliverable let us prioritise our AI initiatives with a costed ROI for each use case — exactly what the board was expecting.",
            role: "Head of Digital Transformation",
            companyProfile: "IT consulting SME, Montreuil",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Montreuil?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a large IT or financial department in Montreuil?",
            a: "On Mid-cap Strategic audits, identified 12-month ROI typically represents several FTEs saved on automatable workflows: reporting, case processing, data qualification, regulatory document drafting. The deliverable details exact figures for your case.",
          },
          {
            q: "Does my financial or business data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. For financial and regulated sectors, we apply sovereignty and compliance constraints at the AI model selection stage.",
          },
          {
            q: "How does the final read-out work in Montreuil?",
            a: "Always in person at your Montreuil offices. Workshop of several hours with your executive committee or leadership team. You leave with the PDF deliverable in hand and a roadmap ready to present to the board.",
          },
          {
            q: "Do you cover Bagnolet, Vincennes or Rosny-sous-Bois?",
            a: "Yes. The full Montreuil employment basin is our territory: Bagnolet, Vincennes, Romainville, Rosny-sous-Bois, Fontenay-sous-Bois, Le Pré-Saint-Gervais. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Montreuil audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction — especially in sectors with particular constraints like finance or public services.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Montreuil se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — dans un studio jeu vidéo, une direction financière, une équipe conseil ou un back-office IT. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Montreuil est un terrain d'intervention régulier pour Axion-IA en banlieue est de Paris : équipes numériques Bas-Montreuil, directions financières, équipes IT et structures ESS représentent une part significative de nos sessions.",
          "Toute la commune et les communes limitrophes couvertes en présentiel : Bas-Montreuil, Croix de Chavaux, Bagnolet, Vincennes, Romainville, Rosny-sous-Bois, Fontenay-sous-Bois.",
          "Le format Essentielle est calibré pour les structures montreuillaises de quelques personnes à une centaine de collaborateurs — studios créatifs, agences digitales, PME de services.",
          "Le format Conférence convient aux plénières d'entreprise (auditoriums grands groupes, espaces de conférence Bas-Montreuil, incubateurs).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI financières ou numériques implantées à Montreuil.",
          "Vocabulaire ajusté à votre secteur dominant : jeu vidéo, finance, numérique, conseil, ESS. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires — production créative, compliance financière, gestion de projet IT ou accompagnement social.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (rapports, emails, dossiers clients, spécifications techniques) pour calibrer les démos sur VOS données montreuillaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux montreuillois pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements avec postes sécurisés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle montreuilloise.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit dans un studio créatif, un bureau financier ou une équipe IT.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour indépendants, studios créatifs et petites agences montreuillaises jusqu'à une dizaine de collaborateurs — Bas-Montreuil, Croix de Chavaux.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — IT, finance, créatif, opérations — particulièrement efficace pour les PME numériques et agences de Montreuil.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (ETI numériques, directions financières) ou huis-clos comité de direction selon votre objectif stratégique.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands sièges montreuillois — roadshow multi-services, séminaires CODIR + cascade équipes terrain ou développeurs.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de notre équipe créative. Ils sont repartis avec leurs outils configurés sur leurs vrais projets. Dès le lendemain, plusieurs les utilisaient pour rédiger des briefs et des game design documents.",
            role: "Head of Production",
            companyProfile: "Studio jeu vidéo, Bas-Montreuil",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en une journée sur notre trajectoire IA. Le consultant connaissait nos contraintes de conformité financière — pas de session générique, des cas concrets qui parlaient à nos équipes.",
            role: "Directrice des opérations",
            companyProfile: "ETI services financiers, Montreuil",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Montreuil ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements IT sécurisés ou des back-offices financiers ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements IT sécurisés et financiers — postes verrouillés, VLAN sécurisés, protocoles accès site. La préparation inclut un échange réseau/sécurité préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur jeu vidéo ou aux métiers créatifs ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un studio jeu vidéo du Bas-Montreuil n'a rien à voir avec une session pour une direction financière.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur montreuillois — jeu vidéo, finance, numérique, ESS — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Montreuil come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — in a gaming studio, a financial directorate, a consulting team or an IT back-office. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Montreuil is a regular intervention ground for Axion-IA in Paris eastern suburbs: Bas-Montreuil digital teams, financial directorates, IT teams and social economy structures represent a significant share of our sessions.",
          "Full commune and neighbouring areas covered in person: Bas-Montreuil, Croix de Chavaux, Bagnolet, Vincennes, Romainville, Rosny-sous-Bois, Fontenay-sous-Bois.",
          "The Essential format is calibrated for Montreuil structures from a few people to about a hundred staff — creative studios, digital agencies, service SMEs.",
          "The Talk format suits corporate plenaries (large-group auditoriums, Bas-Montreuil conference spaces, incubators).",
          "The Executives format enables in-camera framing for financial or digital mid-cap executive committees in Montreuil.",
          "Vocabulary adjusted to your dominant sector: gaming, finance, digital, consulting, social economy. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector — creative production, financial compliance, IT project management or social support — and priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (reports, emails, client files, technical specs) to calibrate demos on YOUR Montreuil data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Montreuil offices to check equipment, projection and network access. No technical hiccup on D-day, even in environments with secured workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your Montreuil sector reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether in a creative studio, a financial office or an IT team.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Montreuil freelancers, creative studios and small agencies up to about ten staff — Bas-Montreuil, Croix de Chavaux.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — IT, finance, creative, operations — particularly effective for Montreuil digital SMEs and agencies.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (digital mid-caps, financial directorates) or in-camera executive committee depending on your strategic objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large Montreuil HQs — multi-department roadshows, exec committee seminars + field team or developer cascades.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our creative team's needs. They left with tools configured for their real projects. By the next day, several were already using them to draft briefs and game design documents.",
            role: "Head of Production",
            companyProfile: "Gaming studio, Bas-Montreuil",
          },
          {
            quote:
              "The executive talk aligned us within a day on our AI trajectory. The consultant knew our financial compliance constraints — no generic session, concrete cases that resonated with our teams.",
            role: "Chief Operating Officer",
            companyProfile: "Financial services mid-cap, Montreuil",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Montreuil take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in secured IT environments or financial back-offices?",
            a: "Yes. Our consultants adapt to secured IT and financial environment constraints — locked workstations, secure VLANs, site access protocols. Preparation includes an upfront network/security review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the gaming sector or creative jobs?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Bas-Montreuil gaming studio has nothing to do with one for a financial directorate.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your Montreuil sector — gaming, finance, digital, social economy — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Montreuil met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux montreuillois — Bas-Montreuil, Croix de Chavaux ou commune limitrophe.",
        whyHere: [
          "Montreuil concentre une part croissante de nos missions d'implémentation, principalement dans le numérique (studios créatifs, éditeurs logiciels), les services financiers (AFD, BNP Paribas Personal Finance) et le conseil IT (Capgemini).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux montreuillois : alignement des équipes, accès aux données de production ou aux dossiers métier, validation des intégrations CRM/ERP/outils métier.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou responsable de produit.",
          "Recette finale toujours en présentiel à Montreuil : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — que ce soit dans un studio, un bureau financier ou un centre IT.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques montreuillois : studios créatifs (automatisation rédaction, génération assets, gestion production), directions financières (analyse documents, scoring, reporting), équipes IT (agents support, copilotes développeurs, automatisation workflows), structures ESS (gestion dossiers, reporting impact).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Montreuil : revue de l'architecture cible (CRM, ERP, outils métier, plateformes créatives), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Montreuil : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Montreuil : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post-déploiement.",
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
              "Implémentation d'un cas d'usage simple — automatisation devis, comptes-rendus, qualification leads pour TPE et indépendants montreuillois.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME numériques, agences, studios créatifs et cabinets de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP, outils financiers, plateformes créatives), formation ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes pour grands comptes montreuillois : cas d'usage cascadés multi-services, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation traitement dossiers livrée comme promis. ROI mesuré dès les premiers mois : nos équipes passent maintenant moins de temps sur les tâches répétitives et plus sur la valeur ajoutée. Aucun lock-in, on maîtrise notre déploiement.",
            role: "Directeur des systèmes d'information",
            companyProfile: "ETI services financiers, Montreuil",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe créative : kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont opérationnels de façon autonome sur leurs outils IA depuis le go-live.",
            role: "Lead Producer",
            companyProfile: "Studio numérique, Bas-Montreuil",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Montreuil ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions montreuillaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données métier restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Pour les secteurs réglementés (finance, ESS), nous appliquons les contraintes souveraineté et conformité dès la conception.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données sensibles ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (dossiers financiers, données personnelles), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Montreuil brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Montreuil offices — Bas-Montreuil, Croix de Chavaux or a neighbouring commune.",
        whyHere: [
          "Montreuil hosts a growing share of our implementation missions, primarily in digital (creative studios, software publishers), financial services (AFD, BNP Paribas Personal Finance) and IT consulting (Capgemini).",
          "Kick-off always happens in person at your Montreuil offices: team alignment, access to production data or business files, CRM/ERP/business tool integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee or product manager.",
          "Final acceptance always in person in Montreuil: handover, team training on their workstations, runbook documentation delivered — whether in a studio, a financial office or an IT centre.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Montreuil cases: creative studios (writing automation, asset generation, production management), financial directorates (document analysis, scoring, reporting), IT teams (support agents, developer copilots, workflow automation), social economy structures (case management, impact reporting).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Montreuil workshop: target architecture review (CRM, ERP, business tools, creative platforms), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Montreuil: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Montreuil: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post-deployment monitoring plan.",
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
              "Implementation of a simple use case — quote automation, meeting minutes, lead qualification for Montreuil micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For digital SMEs, agencies, creative studios and firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (ERP, financial tools, creative platforms), cross-department ambassador training.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Programs for Montreuil large accounts: cascaded multi-department use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Case-processing automation implementation delivered as promised. ROI measured within the first months: our teams now spend less time on repetitive tasks and more on added value. No lock-in, we control our deployment.",
            role: "CIO",
            companyProfile: "Financial services mid-cap, Montreuil",
          },
          {
            quote:
              "Perfect hybrid method for our creative team: intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate autonomously on their AI tools since go-live.",
            role: "Lead Producer",
            companyProfile: "Digital studio, Bas-Montreuil",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Montreuil take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Montreuil missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my business data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. For regulated sectors (finance, social economy), we apply sovereignty and compliance constraints at design stage.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on sensitive data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (financial files, personal data), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement 1-to-1 Axion-IA à Montreuil est conçu pour les dirigeants, managers et experts qui veulent maîtriser l'IA sur leurs cas d'usage réels — sans passer par un dispositif collectif. Sessions individuelles sur site à Montreuil ou à distance, rythme et profondeur adaptés à votre agenda et à votre secteur : jeu vidéo, finance, numérique, ESS.",
        whyHere: [
          "Montreuil concentre des profils dirigeants et managers aux profils très variés — studio jeu vidéo, direction financière, équipe IT, ESS — pour lesquels un format individuel est souvent plus efficace qu'un collectif.",
          "La confidentialité est totale : vos données, vos projets et vos enjeux stratégiques restent dans le cadre de la session. Confidentialité stricte avant chaque accompagnement.",
          "Le rythme est le vôtre : sessions ponctuelles à la demande, suivi régulier mensuel ou intensif sur quelques semaines selon votre objectif.",
          "Chaque session part de vos vrais documents et de vos vrais workflows — pas d'exercices fictifs. Vous repartez avec des outils et des pratiques opérationnels.",
          "Accessible depuis Montreuil sans contrainte : sessions sur site dans vos locaux ou en visio selon votre préférence. Frais de logement, repas et forfait trajet en sus si présentiel souhaité.",
          "Tarif d'entrée accessible aux profils indépendants et TPE — pas réservé aux grandes structures.",
        ],
        methodology: [
          {
            step: "Diagnostic initial",
            detail:
              "Un entretien individuel pour identifier vos cas d'usage prioritaires, votre niveau IA actuel et vos objectifs : déléguer, accélérer, décider, créer ou innover avec l'IA dans votre secteur montreuillois.",
          },
          {
            step: "Plan de sessions personnalisé",
            detail:
              "Proposition d'un parcours sur-mesure : nombre de sessions, thèmes, formats (présentiel Montreuil / visio), outils cibles. Validation ensemble avant démarrage.",
          },
          {
            step: "Sessions de travail sur vos données",
            detail:
              "Chaque session travaille sur VOS documents, VOS emails, VOS projets réels. Installation et configuration des outils IA sur votre poste. Aucun support générique recyclé.",
          },
          {
            step: "Mise en pratique guidée",
            detail:
              "Entre les sessions, vous appliquez les pratiques apprises. En début de session suivante, revue des résultats et ajustements. Apprentissage par la pratique réelle, pas par la théorie.",
          },
          {
            step: "Bilan et autonomie",
            detail:
              "À l'issue du parcours, bilan des compétences acquises, liste d'outils actifs sur votre poste, recommandations pour continuer à progresser seul. Vous êtes autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Tarif d'entrée 1-to-1",
            detail:
              "Accessible aux indépendants, créateurs et dirigeants de très petite structure montreuilloise — studio solo, freelance, micro-agence.",
          },
          {
            sizeLabel: "PME",
            price: "Tarif 1-to-1 PME",
            detail:
              "Pour dirigeants et managers de PME montreuilloise souhaitant maîtriser l'IA sur leurs cas métier spécifiques — RH, marketing, IT, finance.",
          },
          {
            sizeLabel: "ETI",
            price: "Tarif 1-to-1 ETI",
            detail:
              "Pour cadres dirigeants et directeurs de grandes structures souhaitant un accompagnement individuel confidentiel sur des enjeux IA stratégiques.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme 1-to-1 sur-mesure",
            detail:
              "Programme individuel pour dirigeants de grands groupes implantés à Montreuil — rythme, profondeur et confidentialité adaptés à vos enjeux.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format 1-to-1 m'a permis d'aller directement sur mes vrais sujets sans perdre de temps sur ce qui ne me concerne pas. Après quelques sessions, j'utilise l'IA quotidiennement sur mes décisions opérationnelles.",
            role: "Directeur général",
            companyProfile: "PME numérique, Montreuil",
          },
          {
            quote:
              "Je cherchais un accompagnement individuel sans jargon, adapté à mes enjeux financiers réels. Axion-IA a exactement rempli ce besoin — confidentialité totale, cas concrets, outils opérationnels dès la première session.",
            role: "Directrice financière",
            companyProfile: "ETI services, Bas-Montreuil",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce que l'accompagnement 1-to-1 Axion-IA à Montreuil ?",
            a: "C'est un coaching IA individuel sur vos cas d'usage réels : vos documents, vos emails, vos projets. Sessions sur site à Montreuil ou à distance, rythme adapté à votre agenda. Vous repartez avec des outils opérationnels et des pratiques directement réutilisables.",
          },
          {
            q: "Combien de sessions sont nécessaires pour être autonome sur l'IA ?",
            a: "Cela dépend de votre objectif et de votre niveau de départ. Certains profils atteignent une autonomie opérationnelle en une poignée de sessions, d'autres préfèrent un suivi régulier sur plusieurs mois. Nous calons le rythme ensemble au diagnostic initial.",
          },
          {
            q: "Les sessions sont-elles confidentielles ?",
            a: "Totalement. Confidentialité stricte avant chaque parcours. Vos données, vos projets et vos enjeux stratégiques ne sortent pas du cadre de la session. Aucune référence commerciale ne sera faite sans votre accord explicite.",
          },
          {
            q: "Peut-on faire les sessions en présentiel à Montreuil ou à distance ?",
            a: "Les deux sont possibles. Présentiel dans vos locaux montreuillois (frais de logement, repas et forfait trajet en sus) ou visio selon votre préférence. Certains parcours alternent les deux formats.",
          },
          {
            q: "Ce format est-il adapté aux indépendants et créateurs montreuillois ?",
            a: "Oui. Le tarif d'entrée est accessible aux indépendants, studios solos et freelances. Le format est précisément conçu pour aller droit au but sur VOS cas, sans vous noyer dans du contenu générique.",
          },
          {
            q: "Que se passe-t-il si je ne trouve pas l'IA utile après la première session ?",
            a: "Si après la première session vous estimez que l'IA ne peut pas vous apporter de valeur sur vos cas d'usage, nous ne facturerons pas la suite. Notre objectif est votre autonomie, pas de prolonger artificiellement un accompagnement.",
          },
        ],
        guarantees:
          "Confidentialité totale garantie par Confidentialité assurée à chaque parcours. Sessions opérationnelles : vous repartez avec des outils actifs sur votre poste dès la première session. Pas de contenu générique recyclé : chaque session travaille sur vos vrais documents et vos vrais projets. Si l'IA ne vous apporte pas de valeur concrète après la première session, pas de facturation pour la suite.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 coaching in Montreuil is designed for executives, managers and experts who want to master AI on their real use cases — without going through a group format. Individual sessions on site in Montreuil or remote, pace and depth adapted to your schedule and sector: gaming, finance, digital, social economy.",
        whyHere: [
          "Montreuil concentrates executives and managers with very diverse profiles — gaming studio, financial directorate, IT team, social economy — for whom an individual format is often more effective than a group one.",
          "Full confidentiality: your data, your projects and your strategic issues stay within the session framework. Strict confidentiality before each engagement.",
          "The pace is yours: ad-hoc sessions on demand, regular monthly follow-up or intensive over a few weeks depending on your goal.",
          "Each session starts from your real documents and your real workflows — no fictional exercises. You leave with operational tools and practices.",
          "Accessible from Montreuil without constraints: on-site sessions at your offices or video call depending on your preference. Lodging, meals and travel allowance billed separately if in-person preferred.",
          "Entry price accessible to freelancers and micro-businesses — not reserved for large organisations.",
        ],
        methodology: [
          {
            step: "Initial diagnostic",
            detail:
              "An individual interview to identify your priority use cases, your current AI level and your goals: delegate, accelerate, decide, create or innovate with AI in your Montreuil sector.",
          },
          {
            step: "Personalised session plan",
            detail:
              "Proposal for a custom pathway: number of sessions, themes, formats (in-person Montreuil / video), target tools. Agreed together before starting.",
          },
          {
            step: "Working sessions on your data",
            detail:
              "Each session works on YOUR documents, YOUR emails, YOUR real projects. AI tools installed and configured on your workstation. No recycled generic content.",
          },
          {
            step: "Guided practice",
            detail:
              "Between sessions, you apply the practices learned. At the start of the next session, review of results and adjustments. Learning by real practice, not theory.",
          },
          {
            step: "Assessment and autonomy",
            detail:
              "At the end of the pathway, assessment of skills acquired, list of active tools on your workstation, recommendations to keep progressing independently. You are autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "1-to-1 entry price",
            detail:
              "Accessible to Montreuil freelancers, creators and micro-business executives — solo studio, freelancer, micro-agency.",
          },
          {
            sizeLabel: "SME",
            price: "SME 1-to-1 price",
            detail:
              "For Montreuil SME executives and managers wanting to master AI on their specific business use cases — HR, marketing, IT, finance.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap 1-to-1 price",
            detail:
              "For senior executives and directors of large organisations wanting confidential individual support on strategic AI challenges.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom 1-to-1 programme",
            detail:
              "Individual programme for large-group executives in Montreuil — pace, depth and confidentiality adapted to your challenges.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 format let me go straight to my real subjects without wasting time on what doesn't apply to me. After a few sessions, I use AI daily on my operational decisions.",
            role: "CEO",
            companyProfile: "Digital SME, Montreuil",
          },
          {
            quote:
              "I was looking for individual support without jargon, adapted to my real financial challenges. Axion-IA met exactly that need — full confidentiality, concrete cases, operational tools from the very first session.",
            role: "CFO",
            companyProfile: "Services mid-cap, Bas-Montreuil",
          },
        ],
        faq: [
          {
            q: "What is Axion-IA's 1-to-1 coaching in Montreuil?",
            a: "It's individual AI coaching on your real use cases: your documents, your emails, your projects. Sessions on site in Montreuil or remote, pace adapted to your schedule. You leave with operational tools and practices directly reusable.",
          },
          {
            q: "How many sessions are needed to become autonomous on AI?",
            a: "It depends on your goal and starting level. Some profiles reach operational autonomy in a handful of sessions; others prefer regular follow-up over several months. We agree on the pace together at the initial diagnostic.",
          },
          {
            q: "Are sessions confidential?",
            a: "Fully. Strict confidentiality before each pathway. Your data, your projects and your strategic issues do not leave the session framework. No commercial reference will be made without your explicit agreement.",
          },
          {
            q: "Can sessions be in-person in Montreuil or remote?",
            a: "Both are possible. In-person at your Montreuil offices (lodging, meals and travel allowance billed separately) or video call depending on your preference. Some pathways alternate both formats.",
          },
          {
            q: "Is this format suitable for Montreuil freelancers and creators?",
            a: "Yes. The entry price is accessible to freelancers, solo studios and independents. The format is designed precisely to go straight to YOUR cases without drowning you in generic content.",
          },
          {
            q: "What if I don't find AI useful after the first session?",
            a: "If after the first session you feel that AI cannot bring value to your use cases, we won't charge for the rest. Our goal is your autonomy, not artificially prolonging an engagement.",
          },
        ],
        guarantees:
          "Full confidentiality guaranteed by Strict confidentiality before each pathway. Operational sessions: you leave with active tools on your workstation from the first session. No recycled generic content: each session works on your real documents and real projects. If AI brings no concrete value after the first session, no charge for the rest.",
      },
    },
  },
};
