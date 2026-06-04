// Argenteuil (95018) — contenu éditorial (Sprint City Quality V3 2026-05-20).
//
// Doctrine stricte (identique lyon.ts) :
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
// Sources économiques : economic-data/argenteuil.ts (Sprint City Quality V3, ville #37).
// Réalités locales : 3e ville IDF hors Paris (~107 000 hab), boucle de Seine,
// Val-d'Oise, gare Transilien ligne J (Paris Saint-Lazare ~12 min), tissu PME
// dense (9 045 établissements actifs), héritage industriel Dassault Aviation
// (1952-2025, fuselages Mystère/Mirage/Rafale/Falcon), site en reconversion,
// secteurs dominants : commerce/transports, BTP/construction, administrations
// publiques et santé. Pôles Cap Digital + Mov'eo (rayonnement IDF).
// notApplicableFields : produitsIgpAop, vignoblesProches.

import type { VilleCopy } from "./types";

export const ARGENTEUIL_COPY: VilleCopy = {
  pitchFr:
    "Argenteuil regroupe 9 045 établissements actifs, une gare Transilien (Paris Saint-Lazare en ~12 min) et un tissu PME diversifié : commerce, BTP, services. Berceau de l'Impressionnisme et ancienne capitale aéronautique (site Dassault Aviation 1952-2025), la ville se réinvente avec un tissu de TPE/PME dynamiques que les outils IA transforment en avantage compétitif. Axion-IA y intervient sur site.",
  pitchEn:
    "Argenteuil hosts 9,045 active businesses, a Transilien rail link to Paris Saint-Lazare (~12 min) and a diverse SME base spanning commerce, construction and services. Birthplace of Impressionism and former aerospace hub (Dassault Aviation 1952-2025), the city is reinventing itself around a dynamic micro-business and SME fabric where AI tools deliver competitive edge. Axion-IA delivers on site.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Argenteuil : nous cartographions ce qui peut être automatisé dans votre entreprise et chiffrons le ROI. Du Sur place pour un artisan ou commerçant argentin au Stratégique ETI pour une PME de services ou un acteur BTP du Val-d'Oise.",
      en: "Operational AI audit in Argenteuil: we map what can be automated at your business and quantify the ROI. From Sur place for a local trader to Mid-cap Strategic for a services SME or Val-d'Oise construction firm.",
    },
    interventions: {
      fr: "Interventions IA à Argenteuil : formats sur site d'une à plusieurs journées. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Argenteuil: on-site formats from one to several days. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Argenteuil : on déploie l'IA dans vos outils existants (CRM, ERP, mails, outils BTP) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance Axion-IA.",
      en: "AI implementation in Argenteuil: we deploy AI into your existing tools (CRM, ERP, email, construction tools) with contractually-costed ROI. Your teams stay in control, no Axion-IA dependency.",
    },
    unAUn: {
      fr: "Accompagnement individuel IA à Argenteuil : un consultant dédié pour le dirigeant, l'indépendant ou le manager qui veut monter en compétences IA à son rythme, sur ses vrais cas métier. Format flexible, présentiel ou distance.",
      en: "Individual AI coaching in Argenteuil: a dedicated consultant for the executive, freelancer or manager who wants to build AI skills at their own pace, on their real business cases. Flexible format, in-person or remote.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour TPE/PME argenteuillaises et du Val-d'Oise — site vitrine pour commerçants, artisans et acteurs BTP, espace client pour cabinets de services, dashboard métier connecté à votre CRM/ERP ou outil de gestion BTP. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Argenteuil and Val-d'Oise micro-businesses/SMEs — showcase site for traders, craftspeople and construction firms, customer space for service practices, business dashboard connected to your CRM/ERP or construction management tool. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Argenteuil (95) sur site — quartiers résidentiels, zones d'activités, Parc du Val d'Argent et communes du bassin (Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis). Nous accompagnons les TPE, PME, ETI et grandes entreprises argenteuillaises (commerce, BTP, services, industrie en reconversion) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Argenteuil (95) on site — residential districts, business parks, Parc du Val d'Argent and basin communes (Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis). We support Argenteuil micro-businesses, SMEs, mid-caps and large enterprises (commerce, construction, services, industrial reconversion) on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  seoHook: "commerce, transport & construction",
  topSectorsNaf: [
    "Commerce, Transport & Services aux entreprises",
    "BTP & Construction",
    "Administration, Santé & Action sociale",
    "Industrie & Logistique",
    "Numérique & IT (rayonnement Cap Digital)",
  ],

  distancesFr:
    "Gare d'Argenteuil (Transilien ligne J) : Paris Saint-Lazare en ~12 min. RER C accessible via correspondance Épinay-sur-Seine (T11 tramway). Aéroport Paris-Charles de Gaulle à ~30 km. Accès rapide A15 et A86 vers les bassins d'emplois du Grand Paris (La Défense à ~8 km, Cergy à ~20 km).",
  distancesEn:
    "Argenteuil station (Transilien line J): Paris Saint-Lazare in ~12 min. RER C accessible via Épinay-sur-Seine connection (T11 tram). Paris-Charles de Gaulle Airport ~30 km. Fast A15 and A86 motorway access to Grand Paris employment hubs (La Défense ~8 km, Cergy ~20 km).",

  ecosystemFr:
    "Tissu B2B diversifié — 9 045 établissements actifs, 2 690 créations d'entreprises par an. Dominante commerce/transports (61,9 %), BTP (23,6 %), secteur public et santé (8,8 %), industrie héritée de Dassault Aviation (5,4 %). Parc du Val d'Argent (industrie/logistique/tertiaire), site Dassault en reconversion urbaine. Rayonnement Cap Digital (numérique/IA) et Mov'eo (mobilité/aéronautique). Connexion rapide La Défense et Grand Paris.",
  ecosystemEn:
    "Diverse B2B fabric — 9,045 active businesses, 2,690 company creations per year. Dominant sectors: commerce/transport (61.9%), construction (23.6%), public sector and health (8.8%), legacy industry from Dassault Aviation (5.4%). Val d'Argent business park (industry/logistics/tertiary), Dassault site under urban redevelopment. Cap Digital (digital/AI) and Mov'eo (mobility/aerospace) cluster influence. Fast connection to La Défense and Grand Paris.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Argenteuil ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise). Aucun supplément géographique : le tarif est identique à Argenteuil et partout en France.",
    },
    {
      q: "Avez-vous des clients dans le secteur BTP à Argenteuil ?",
      a: "Oui. Le BTP représente 23,6 % des établissements d'Argenteuil — nos audits et interventions couvrent les cas d'usage de ce secteur : qualification d'appels d'offres, comptes-rendus de chantier, automatisation devis, suivi sous-traitants. Secteur prioritaire dans notre portfolio Val-d'Oise.",
    },
    {
      q: "Pouvez-vous intervenir dans les communes voisines (Bezons, Sartrouville, Colombes) ?",
      a: "Oui. Tout le bassin argentin est notre zone d'intervention : Bezons (3 km), Sannois (3 km), Houilles (4 km), Cormeilles-en-Parisis (4 km), Sartrouville (5 km), Colombes (5 km), Bois-Colombes (6 km). Aucun supplément de zone.",
    },
    {
      q: "Quels secteurs sont prioritaires à Argenteuil pour une mission IA ?",
      a: "Nos déploiements dans le bassin argentin couvrent en priorité le commerce et les services (dominant local), le BTP et la construction, les TPE/PME de services aux entreprises, et les acteurs de la logistique et distribution. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Argenteuil ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
    {
      q: "Intervenez-vous aussi vers La Défense ou Cergy pour les entreprises d'Argenteuil qui ont des sites multiples ?",
      a: "Oui. La géographie du Grand Paris est notre terrain courant : La Défense (~8 km), Cergy (~20 km), Saint-Denis (~12 km), le bassin Saint-Lazare. Si votre entreprise argenteuillaise a des équipes réparties, nous adaptons le format pour couvrir les différents sites.",
    },
  ],

  // === SERVICES LONG-FORM ARGENTEUIL ===
  // Même structure que lyon.ts.
  // Aucun prix en dur, aucun délai chiffré, aucun « frais inclus ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre entreprise argenteuillaise et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des commerçants et artisans du Val-d'Oise aux PME du BTP, des services et de la logistique implantées dans le bassin Seine–Saint-Lazare.",
        whyHere: [
          "Argenteuil est la 3e ville d'Île-de-France hors Paris (9 045 établissements actifs, 2 690 créations par an) : tissu PME dense et diversifié qui représente exactement le profil où l'IA opérationnelle délivre le ROI le plus rapide.",
          "Tissu B2B local sur-représenté chez nos clients : commerce de gros et distribution, BTP et construction (23,6 % des établissements), services aux entreprises et TPE de services qui ont besoin d'automatiser pour rester compétitifs.",
          "Nos consultants se déplacent sur l'ensemble du bassin : Argenteuil, Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis, Houilles, Sannois et jusqu'à La Défense pour les structures multi-sites.",
          "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux argenteuillais, lecture du livrable avec votre direction, plan d'action remis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Utile pour les PME du BTP et de la logistique avec des workflows de chantier ou de distribution à cartographier.",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Argenteuil dans vos locaux — Parc du Val d'Argent, zone d'activités ou quartier de bureaux — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, chargés d'affaires, conducteurs de travaux, finance, support, direction) pour cartographier finement les frictions et les attentes selon les réalités opérationnelles locales.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos devis, vos emails, vos appels d'offres, vos bons de commande, vos rapports de chantier. Pas de slides théoriques — on part de vos documents réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux argenteuillais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur — commerce, BTP, services ou logistique.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux commerçants, artisans, indépendants et cabinets argenteuillais jusqu'à une dizaine de collaborateurs — commerce de proximité, TPE de services, micro-entrepreneurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME du BTP, de la logistique et des services aux entreprises du bassin argentin, de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI du Val-d'Oise ou du Grand Paris ayant un site ou des équipes à Argenteuil — souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et groupes implantés dans le bassin Seine–La Défense–Val-d'Oise avec des sites opérationnels ou logistiques à Argenteuil.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a livré un audit opérationnel concret sur notre activité BTP. Le rapport chiffre précisément le temps gagnable sur nos devis et le suivi sous-traitants. On a pu prioriser nos chantiers IA en une seule restitution.",
            role: "Directeur général",
            companyProfile: "PME construction, Val-d'Oise",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vrais devis et emails fournisseurs. Le livrable a permis de présenter un plan IA au comité de direction avec un ROI chiffré pour chaque cas d'usage.",
            role: "Directrice administrative",
            companyProfile: "PME services aux entreprises, bassin argentin",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Argenteuil ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit pour une PME du BTP argenteuillaise ?",
            a: "Sur les PME BTP, le ROI identifié à 12 mois porte typiquement sur la qualification d'appels d'offres, la rédaction de comptes-rendus de chantier, le suivi de sous-traitants et la génération de devis. Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données commerciales ou de chantier restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Nous n'exportons aucun document métier hors de vos systèmes sans accord explicite.",
          },
          {
            q: "Comment se déroule la restitution finale à Argenteuil ?",
            a: "Toujours en présentiel dans vos locaux. Atelier de plusieurs heures avec votre direction ou comité de pilotage. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter.",
          },
          {
            q: "Intervenez-vous aussi sur les sites des communes voisines (Bezons, Sartrouville, Colombes) ?",
            a: "Oui. Tout le bassin argentin est notre zone d'intervention : Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis, Houilles, Sannois et au-delà vers La Défense. Aucun supplément de zone.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
            a: "Non. La grande majorité de nos audits dans le bassin argentin sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your Argenteuil business and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every size, from Val-d'Oise traders and craftspeople to construction, services and logistics SMEs in the Seine–Saint-Lazare basin.",
        whyHere: [
          "Argenteuil is Île-de-France's 3rd largest city outside Paris (9,045 active businesses, 2,690 creations per year): a dense, diverse SME fabric that is precisely the profile where operational AI delivers the fastest ROI.",
          "Local B2B fabric over-represented in our cases: wholesale commerce and distribution, BTP and construction (23.6% of businesses), business services and micro-firms that need to automate to stay competitive.",
          "Our consultants travel across the full basin: Argenteuil, Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis, Houilles, Sannois and through to La Défense for multi-site structures.",
          "Read-outs always in person: ideation workshops at your Argenteuil offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality key documents (org chart, processes, KPIs). Useful for construction and logistics SMEs with site or distribution workflows to map.",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Argenteuil at your offices — Val d'Argent business park, activity zone or office district — to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, project managers, site supervisors, finance, support, leadership) to map frictions and expectations across local operational realities.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your quotes, emails, tenders, purchase orders, site reports. No theoretical slides — we work from your actual documents.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Argenteuil offices. Costed PDF deliverable handed over, actionable roadmap tailored to your sector — commerce, construction, services or logistics.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to Argenteuil traders, craftspeople, freelancers and practices up to about ten staff — local commerce, services micro-firms, sole traders.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for construction, logistics and business services SMEs in the Argenteuil basin, from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Val-d'Oise or Grand Paris mid-caps with a site or teams in Argenteuil seeking to frame a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and groups with operational or logistics sites in the Seine–La Défense–Val-d'Oise basin.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered a concrete operational audit on our construction activity. The report precisely quantifies the time savings on quoting and subcontractor follow-up. We prioritised our AI workstreams in a single read-out.",
            role: "CEO",
            companyProfile: "Construction SME, Val-d'Oise",
          },
          {
            quote:
              "Pragmatic method, demos on our real quotes and supplier emails. The deliverable allowed us to present an AI plan to the executive committee with a costed ROI for each use case.",
            role: "Administrative Director",
            companyProfile: "Business services SME, Argenteuil basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Argenteuil?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a construction SME in Argenteuil?",
            a: "For construction SMEs, identified 12-month ROI typically covers tender qualification, site report drafting, subcontractor tracking and quote generation. The deliverable details exact figures for your case.",
          },
          {
            q: "Does my commercial or site data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure. We export no business documents outside your systems without explicit agreement.",
          },
          {
            q: "How does the final read-out work in Argenteuil?",
            a: "Always in person at your offices. Workshop of several hours with your leadership or steering committee. You leave with the PDF deliverable in hand and a roadmap ready to present.",
          },
          {
            q: "Do you cover neighbouring communes (Bezons, Sartrouville, Colombes)?",
            a: "Yes. The full Argenteuil basin is our territory: Bezons, Sartrouville, Colombes, Cormeilles-en-Parisis, Houilles, Sannois and through to La Défense. No zone surcharge.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. The vast majority of our audits in the Argenteuil basin are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Argenteuil se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en chantier, en boutique, au bureau ou en déplacement clientèle. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Le tissu TPE/PME argenteuillais est l'environnement idéal pour les interventions IA : entreprises de taille humaine où chaque collaborateur formé multiplie immédiatement l'impact sur la productivité collective.",
          "Tous les quartiers et zones d'activités couverts en présentiel : centre-ville, Parc du Val d'Argent, zone industrielle, quartiers résidentiels et communes du bassin (Bezons, Sartrouville, Colombes).",
          "Le format Essentielle est calibré pour les structures argenteuillaises de quelques personnes à une centaine de collaborateurs — PME du BTP, commerces de gros, agences de services.",
          "Le format Conférence convient aux plénières d'entreprise du Val-d'Oise (salles de séminaire d'Argenteuil, espaces CCI).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des PME et ETI locales ou des groupes présents dans le bassin.",
          "Vocabulaire ajusté à votre secteur dominant : commerce, BTP, logistique, services aux entreprises, administration. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier et les cas d'usage prioritaires — qualification de devis pour le BTP, traitement de commandes pour le commerce, comptes-rendus pour les services.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (devis, emails, bons de commande, rapports de chantier, fiches clients) pour calibrer les démos sur VOS données argenteuillaises.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux argenteuillais pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les environnements BTP ou logistiques avec postes spécialisés.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle locale — pas de scénario Parisian fictif.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables dès le lendemain matin sans aide extérieure, que ce soit au bureau, sur chantier ou en déplacement.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour commerçants, artisans, indépendants et petites agences argenteuillaises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département — conducteurs de travaux, service commercial, administration — particulièrement efficace pour les PME BTP du Val-d'Oise.",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif stratégique — ETI de services, groupes de distribution ou acteurs régionaux.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grandes entreprises du bassin — roadshow multi-sites Grand Paris, séminaires CODIR + cascade équipes terrain.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le format Essentielle a parfaitement collé aux attentes de notre équipe commerciale. Ils sont repartis avec ChatGPT et Claude configurés sur leurs vrais emails clients. Dès le lendemain, les devis sortaient deux fois plus vite.",
            role: "Directeur commercial",
            companyProfile: "PME BTP, Val-d'Oise",
          },
          {
            quote:
              "La session Dirigeants nous a alignés en une journée sur notre stratégie IA. Le consultant connaissait les enjeux du commerce de gros — pas de discours générique, des cas concrets qui parlaient à nos équipes.",
            role: "PDG",
            companyProfile: "PME distribution, bassin argentin",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Argenteuil ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous intervenir dans des environnements BTP ou entrepôts logistiques ?",
            a: "Oui. Nos consultants s'adaptent aux contraintes des environnements BTP et logistiques — postes mobiles, accès chantier, VLAN sécurisés, contraintes terrain. La préparation inclut un point réseau/matériel préalable.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur commerce ou BTP du bassin argentin ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une PME BTP n'a rien à voir avec une session pour un commerce de gros ou un cabinet de services.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur — commerce, BTP, logistique, services — aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Argenteuil come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — on a building site, in a shop, at the office or with clients. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Argenteuil's SME and micro-business fabric is the ideal environment for AI sessions: human-scale firms where every trained staff member immediately multiplies the impact on collective productivity.",
          "All districts and business zones covered in person: town centre, Val d'Argent business park, industrial zone, residential areas and basin communes (Bezons, Sartrouville, Colombes).",
          "The Essential format is calibrated for Argenteuil structures from a few people to about a hundred staff — construction SMEs, wholesale traders, service agencies.",
          "The Talk format suits Val-d'Oise corporate plenaries (Argenteuil seminar rooms, CCI spaces).",
          "The Executives format enables in-camera framing for local SME and mid-cap executive committees or basin-based groups.",
          "Vocabulary adjusted to your dominant sector: commerce, construction, logistics, business services, administration. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your sector and priority use cases — quote qualification for construction, order processing for commerce, report drafting for services.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (quotes, emails, purchase orders, site reports, client files) to calibrate demos on YOUR Argenteuil data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Argenteuil offices to check equipment, projection and network access. No technical hiccup on D-day, even in construction or logistics environments with specialist workstations.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops. Use cases are grounded in your local sector reality — no fictional Parisian scenario.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help, whether at the office, on a building site or in the field.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Argenteuil traders, craftspeople, freelancers and small agencies up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department — site supervisors, sales, admin — particularly effective for Val-d'Oise construction SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your strategic objective — services mid-caps, distribution groups or regional players.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Grand Paris basin large enterprises — multi-site roadshows, exec committee seminars + field team cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Essential format perfectly matched our sales team's needs. They left with ChatGPT and Claude configured on their real client emails. By the next day, quotes were coming out twice as fast.",
            role: "Sales Director",
            companyProfile: "Construction SME, Val-d'Oise",
          },
          {
            quote:
              "The Executives session aligned us within a day on our AI strategy. The consultant knew the wholesale trade's challenges — no generic talk, concrete cases that resonated with our teams.",
            role: "CEO",
            companyProfile: "Distribution SME, Argenteuil basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Argenteuil take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives formats fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "Can you run sessions in construction or logistics warehouse environments?",
            a: "Yes. Our consultants adapt to construction and logistics environment constraints — mobile workstations, site access, secure VLANs, field constraints. Preparation includes an upfront network/equipment review.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the Argenteuil construction or commerce sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a construction SME has nothing to do with one for a wholesale trader or a services firm.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and demos adjusted to your sector — commerce, construction, logistics, services — no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Argenteuil met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux argenteuillais — Parc du Val d'Argent, zone d'activités ou commune du bassin.",
        whyHere: [
          "Argenteuil et son bassin concentrent un tissu PME dense (9 045 établissements) avec des besoins d'automatisation réels : devis, commandes, suivi chantiers, relation clients — des workflows récurrents où l'IA délivre un ROI mesurable dès les premières semaines.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux argenteuillais : alignement des équipes, accès aux données opérationnelles, validation des intégrations CRM/ERP/outils métier.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite pour démos d'avancement avec votre direction ou responsable opérationnel.",
          "Recette finale toujours en présentiel à Argenteuil : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — bureau, chantier ou entrepôt.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques bassin argentin : PME BTP (automatisation devis et rapports de chantier), commerce de gros (qualification commandes, suivi fournisseurs), services aux entreprises (génération documents, qualification prospects), logistique (suivi expéditions, traitement anomalies).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Argenteuil : revue de l'architecture cible (CRM, ERP, outils BTP/logistique), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Argenteuil : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Argenteuil : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring sur les premières semaines d'exploitation.",
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
              "Implémentation d'un cas d'usage simple — automatisation devis, comptes-rendus réunion, qualification leads pour TPE et indépendants argenteuillais.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME BTP, commerce de gros, agences et services de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées, formation ambassadeurs cross-département. Adapté aux ETI du bassin Seine–Val-d'Oise.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes du bassin : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation devis et suivi chantiers livrée comme promis. ROI mesuré dès les premiers mois : nos conducteurs de travaux passent maintenant moins de temps sur les rapports et plus sur la coordination terrain.",
            role: "Directeur travaux",
            companyProfile: "PME construction, bassin argentin",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre équipe dispersée entre le siège et les sites clients. Kick-off intense sur place, puis itérations à distance fluides. Nos ambassadeurs internes sont totalement autonomes.",
            role: "Directrice des opérations",
            companyProfile: "PME services aux entreprises, Val-d'Oise",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Argenteuil ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données commerciales ou opérationnelles restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Aucune donnée métier hébergée chez Axion-IA.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "L'IA peut-elle vraiment automatiser les devis BTP et le suivi chantiers ?",
            a: "Oui, c'est l'un de nos cas d'usage les plus déployés dans les PME BTP du bassin argentin : lecture automatique des CCTP, génération de trames de devis, synthèse de comptes-rendus de réunion de chantier, alertes suivi sous-traitants. Le POC en démontre la faisabilité sur vos vrais documents avant tout engagement.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Argenteuil brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Argenteuil offices — Val d'Argent business park, activity zone or basin commune.",
        whyHere: [
          "Argenteuil and its basin concentrate a dense SME fabric (9,045 businesses) with real automation needs: quotes, orders, site tracking, client relations — recurring workflows where AI delivers measurable ROI within the first weeks.",
          "Kick-off always happens in person at your Argenteuil offices: team alignment, access to operational data, CRM/ERP/business tool integration validation.",
          "Remote iterations afterwards with a short daily video call and an on-site visit for progress demos with your leadership or operational manager.",
          "Final acceptance always in person in Argenteuil: handover, team training on their workstations, runbook documentation delivered — office, building site or warehouse.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Argenteuil basin cases: construction SMEs (quote and site report automation), wholesale commerce (order qualification, supplier tracking), business services (document generation, prospect qualification), logistics (shipment tracking, anomaly processing).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Argenteuil workshop: target architecture review (CRM, ERP, construction/logistics tools), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Argenteuil: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your technical and business teams.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive use case enrichment, integration with existing tools, real-volume testing, UX and field ergonomics adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Argenteuil: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan for the first weeks of operation.",
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
              "Implementation of a simple use case — quote automation, meeting minutes, lead qualification for Argenteuil micro-businesses and freelancers.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For construction SMEs, wholesale commerce, agencies and services firms from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations, cross-department ambassador training. Tailored for Seine–Val-d'Oise basin mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for basin large accounts: cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Quote and site tracking automation implementation delivered as promised. ROI measured within the first months: our site managers now spend less time on reports and more on field coordination.",
            role: "Works Director",
            companyProfile: "Construction SME, Argenteuil basin",
          },
          {
            quote:
              "Perfect hybrid method for our team split between the HQ and client sites. Intense on-site kick-off, then smooth remote iterations. Our internal ambassadors operate fully autonomously.",
            role: "Operations Director",
            companyProfile: "Business services SME, Val-d'Oise",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Argenteuil take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months. The SOW signed at framing fixes the precise schedule.",
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
            q: "Does my commercial or operational data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer. No business data hosted at Axion-IA.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality. Choice justified in SOW, never imposed.",
          },
          {
            q: "Can AI really automate construction quotes and site tracking?",
            a: "Yes, this is one of our most deployed use cases in Argenteuil basin construction SMEs: automatic reading of technical specs (CCTP), quote template generation, site meeting minute summarisation, subcontractor tracking alerts. The POC demonstrates feasibility on your real documents before any commitment.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement individuel IA Axion-IA à Argenteuil s'adresse au dirigeant, au manager ou à l'indépendant qui veut monter en compétences IA à son rythme — sur ses vrais cas métier du commerce, du BTP ou des services. Format flexible : une à plusieurs journées, sur site dans le bassin argentin ou à distance selon votre emploi du temps.",
        whyHere: [
          "Le tissu argentin est majoritairement composé de TPE et d'indépendants : un accompagnement individuel est souvent plus efficace qu'une session collective pour des profils isolés ou des dirigeants sans équipe dédiée.",
          "Chaque session est construite autour de VOS cas métier réels : devis, emails clients, qualification de chantiers, reporting, gestion administrative — pas de générique.",
          "Flexibilité maximale : le format s'adapte à votre emploi du temps de dirigeant — matinée, journée complète, séances étalées dans le temps.",
          "Accompagnement de la gare d'Argenteuil à La Défense : si vous avez des rendez-vous clients dans le Grand Paris, nous adaptons les sessions à votre géographie professionnelle.",
          "Suivi dans la durée possible : plusieurs séances progressives pour ancrer les pratiques IA dans votre quotidien opérationnel.",
          "Tarif d'entrée accessible aux indépendants et micro-entrepreneurs argenteuillais — voir la grille tarifaire publique.",
        ],
        methodology: [
          {
            step: "Bilan de maturité individuel",
            detail:
              "Un entretien initial pour cerner vos habitudes de travail, vos outils actuels et les 3 cas d'usage où l'IA vous ferait gagner le plus de temps dès cette semaine.",
          },
          {
            step: "Sessions pratiques sur vos données",
            detail:
              "On travaille directement sur vos emails, vos devis, vos documents administratifs ou vos reportings. Chaque outil IA est configuré pour votre cas d'usage exact.",
          },
          {
            step: "Installation et prise en main",
            detail:
              "Chaque outil est installé, configuré et testé avec vous. Vous partez autonome, avec des prompts personnalisés sauvegardés pour vos tâches récurrentes.",
          },
          {
            step: "Suivi et ajustements",
            detail:
              "Une session de suivi quelques semaines après pour ancrer les habitudes, corriger les difficultés rencontrées et ouvrir de nouveaux cas d'usage.",
          },
          {
            step: "Bilan de progression",
            detail:
              "Synthèse des gains obtenus, identification des prochaines étapes, recommandation d'une trajectoire autonome ou d'un accompagnement complémentaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Accompagnement individuel — tarif entrée",
            detail:
              "Pour indépendants, micro-entrepreneurs et dirigeants de TPE argenteuillaises. Une à plusieurs journées selon le programme choisi.",
          },
          {
            sizeLabel: "PME",
            price: "Accompagnement dirigeant/manager",
            detail:
              "Pour dirigeants et managers de PME qui souhaitent monter en compétences IA avant de déployer en équipe — format efficace pour la montée en charge progressive.",
          },
          {
            sizeLabel: "ETI",
            price: "Coaching CODIR",
            detail:
              "Pour les membres de comité de direction d'ETI du bassin qui souhaitent cadrer leur posture IA avant de lancer un chantier transverse.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis — programme dirigeants",
            detail:
              "Programme personnalisé pour les dirigeants de grands groupes ayant des sites dans le bassin argentin — format intensive ou étalé selon les contraintes agenda.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin d'un accompagnement sur mesure, pas d'une formation collective. En deux sessions, j'ai configuré l'IA sur mes vrais devis BTP et mes emails de suivi chantier. Gain de temps immédiat.",
            role: "Artisan entrepreneur",
            companyProfile: "TPE bâtiment, Val-d'Oise",
          },
          {
            quote:
              "Format parfait pour un dirigeant avec peu de temps. Les sessions sont ciblées sur mes vrais enjeux, pas sur des slides génériques. J'ai pu ensuite déployer les pratiques dans toute mon équipe.",
            role: "Directeur général",
            companyProfile: "PME services, bassin argentin",
          },
        ],
        faq: [
          {
            q: "En quoi l'accompagnement individuel diffère-t-il d'une intervention collective ?",
            a: "L'accompagnement individuel est entièrement centré sur VOS cas d'usage, à VOTRE rythme. Pas de programme prédéfini : on part de vos vrais documents, vos vraies tâches, vos vraies contraintes. Idéal pour les indépendants et dirigeants argenteuillais sans équipe disponible.",
          },
          {
            q: "Combien de séances sont nécessaires pour être autonome sur l'IA ?",
            a: "Cela dépend de votre point de départ et de vos objectifs. Une journée suffit pour les cas d'usage simples (emails, devis, comptes-rendus). Un programme de plusieurs séances étalées dans le temps est recommandé pour ancrer les pratiques et couvrir plusieurs cas métier.",
          },
          {
            q: "Puis-je choisir les outils IA que vous utilisez avec moi ?",
            a: "Oui. Nous adaptons aux outils que vous souhaitez maîtriser — ChatGPT, Claude, Mistral, Perplexity, Notion AI, etc. Si vous n'avez pas de préférence, nous recommandons le meilleur mix pour vos cas d'usage argenteuillais.",
          },
          {
            q: "Les séances peuvent-elles se dérouler à distance ?",
            a: "Oui. Format hybride disponible : présentiel dans vos locaux argenteuillais ou à distance en visio selon votre préférence et votre emploi du temps.",
          },
          {
            q: "L'accompagnement individuel est-il adapté aux artisans et commerçants ?",
            a: "C'est précisément l'un de nos cas d'usage prioritaires dans le bassin argentin : artisans du bâtiment, commerçants, restaurateurs, indépendants. Des profils qui gagnent un temps considérable sur la partie administrative et commerciale grâce à l'IA.",
          },
          {
            q: "Que se passe-t-il si je ne vois pas de résultat concret après la première séance ?",
            a: "Si après la première séance vous n'avez pas identifié au moins un cas d'usage où l'IA vous fait gagner du temps, séance remboursée intégralement. Engagement qualité Axion-IA.",
          },
        ],
        guarantees:
          "Sessions sur mesure : chaque séance est construite autour de VOS cas métier réels. Outils opérationnels en fin de séance : vous repartez autonome avec des outils configurés, pas avec des slides. Suivi garanti : une séance de suivi incluse dans tout programme multi-séances. Si la première séance ne délivre pas de valeur concrète mesurable, remboursement intégral.",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Argenteuil is for the executive, manager or freelancer who wants to build AI skills at their own pace — on their real business cases in commerce, construction or services. Flexible format: one to several days, on site in the Argenteuil basin or remote depending on your schedule.",
        whyHere: [
          "Argenteuil's fabric is predominantly made up of micro-businesses and self-employed people: individual coaching is often more effective than a group session for isolated profiles or executives without a dedicated team.",
          "Every session is built around YOUR real business cases: quotes, client emails, site qualification, reporting, admin management — nothing generic.",
          "Maximum flexibility: the format adapts to your executive schedule — morning, full day, staggered sessions over time.",
          "From Argenteuil station to La Défense: if you have client meetings across Grand Paris, we adapt sessions to your professional geography.",
          "Long-term follow-up available: multiple progressive sessions to embed AI practices in your daily operations.",
          "Entry-level pricing accessible to Argenteuil freelancers and micro-entrepreneurs — see public pricing grid.",
        ],
        methodology: [
          {
            step: "Individual maturity assessment",
            detail:
              "An initial interview to understand your work habits, current tools and the 3 use cases where AI would save you the most time this week.",
          },
          {
            step: "Hands-on sessions with your data",
            detail:
              "We work directly on your emails, quotes, admin documents or reports. Each AI tool is configured for your exact use case.",
          },
          {
            step: "Installation and onboarding",
            detail:
              "Each tool is installed, configured and tested with you. You leave autonomous, with personalised prompts saved for your recurring tasks.",
          },
          {
            step: "Follow-up and adjustments",
            detail:
              "A follow-up session a few weeks later to anchor habits, fix encountered difficulties and open new use cases.",
          },
          {
            step: "Progress review",
            detail:
              "Summary of gains achieved, identification of next steps, recommendation for an autonomous trajectory or additional coaching.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Individual coaching — entry tier",
            detail:
              "For Argenteuil freelancers, micro-entrepreneurs and micro-business owners. One to several days depending on the chosen programme.",
          },
          {
            sizeLabel: "SME",
            price: "Executive/manager coaching",
            detail:
              "For SME executives and managers who want to build AI skills before deploying to their team — effective format for progressive scaling.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Executive committee coaching",
            detail:
              "For basin mid-cap executive committee members who want to frame their AI posture before launching a transverse initiative.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom quote — executive programme",
            detail:
              "Personalised programme for large group executives with sites in the Argenteuil basin — intensive or staggered format depending on schedule constraints.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed tailored coaching, not a group training. In two sessions, I had AI configured on my real construction quotes and site follow-up emails. Immediate time saving.",
            role: "Independent craftsman",
            companyProfile: "Micro-business construction, Val-d'Oise",
          },
          {
            quote:
              "Perfect format for a time-poor executive. Sessions are focused on my real challenges, not generic slides. I was then able to roll out the practices across my whole team.",
            role: "CEO",
            companyProfile: "Services SME, Argenteuil basin",
          },
        ],
        faq: [
          {
            q: "How does individual coaching differ from a group session?",
            a: "Individual coaching is entirely centred on YOUR use cases, at YOUR pace. No pre-defined programme: we start from your real documents, your real tasks, your real constraints. Ideal for Argenteuil freelancers and executives without an available team.",
          },
          {
            q: "How many sessions are needed to be autonomous with AI?",
            a: "It depends on your starting point and objectives. A day is enough for simple use cases (emails, quotes, meeting minutes). A multi-session programme staggered over time is recommended to anchor practices and cover several business cases.",
          },
          {
            q: "Can I choose the AI tools you use with me?",
            a: "Yes. We adapt to the tools you want to master — ChatGPT, Claude, Mistral, Perplexity, Notion AI, etc. If you have no preference, we recommend the best mix for your Argenteuil use cases.",
          },
          {
            q: "Can sessions take place remotely?",
            a: "Yes. Hybrid format available: in person at your Argenteuil offices or remote via video depending on your preference and schedule.",
          },
          {
            q: "Is individual coaching suitable for craftspeople and traders?",
            a: "This is precisely one of our priority use cases in the Argenteuil basin: building craftspeople, traders, restaurant owners, freelancers — profiles who gain considerable time on administrative and commercial tasks thanks to AI.",
          },
          {
            q: "What if I see no concrete result after the first session?",
            a: "If after the first session you haven't identified at least one use case where AI saves you time, the session is fully refunded. Axion-IA quality commitment.",
          },
        ],
        guarantees:
          "Tailor-made sessions: each session is built around YOUR real business cases. Operational tools at session end: you leave autonomous with configured tools, not with slides. Follow-up guaranteed: one follow-up session included in any multi-session programme. If the first session delivers no measurable concrete value, full refund.",
      },
    },
  },
};
