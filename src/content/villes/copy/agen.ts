// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Agen (47, Lot-et-Garonne) — capitale du pruneau, agroalimentaire, rugby (SU Agen).

import type { VilleCopy } from "./types";

export const AGEN_COPY: VilleCopy = {
  pitchFr:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Agen, capitale du pruneau et pôle agroalimentaire du Lot-et-Garonne. Coopératives fruitières, conserveries, transformation agroalimentaire, négoce et commerces : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  pitchEn:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Agen, capitale du pruneau et pôle agroalimentaire du Lot-et-Garonne. Coopératives fruitières, conserveries, transformation agroalimentaire, négoce et commerces : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Agen auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'agroalimentaire local (pruneau, fruits, conserve), le négoce agricole, le commerce et les services. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site : vos équipes restent autonomes, aucun verrou technologique.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Agen auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'agroalimentaire local (pruneau, fruits, conserve), le négoce agricole, le commerce et les services. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site : vos équipes restent autonomes, aucun verrou technologique.",
  seoHook: "pruneau & agroalimentaire",
  ecosystemFr:
    "Agen est le coeur de la filière pruneau d'Agen (IGP) et un bassin agroalimentaire majeur du Sud-Ouest, structuré autour de l'Agropole, technopole dédié aux industries alimentaires. Coopératives fruitières, conserveries, négoce agricole, logistique fraîche et commerce dynamisent un tissu de TPE et PME que la gare LGV reliera bientôt mieux à Bordeaux et Toulouse.",
  ecosystemEn:
    "Agen est le coeur de la filière pruneau d'Agen (IGP) et un bassin agroalimentaire majeur du Sud-Ouest, structuré autour de l'Agropole, technopole dédié aux industries alimentaires. Coopératives fruitières, conserveries, négoce agricole, logistique fraîche et commerce dynamisent un tissu de TPE et PME que la gare LGV reliera bientôt mieux à Bordeaux et Toulouse.",
  distancesFr:
    "La gare d'Agen est en centre-ville sur l'axe Bordeaux-Toulouse (environ 1h de chaque). L'A62 traverse l'agglomération et l'aéroport d'Agen-La Garenne dessert le bassin.",
  distancesEn:
    "La gare d'Agen est en centre-ville sur l'axe Bordeaux-Toulouse (environ 1h de chaque). L'A62 traverse l'agglomération et l'aéroport d'Agen-La Garenne dessert le bassin.",
  topSectorsNaf: [
    "Transformation agroalimentaire (pruneau, fruits, conserve)",
    "Coopératives et négoce agricole",
    "Logistique et transport de produits frais",
    "Commerce de détail et de gros alimentaire",
    "Services aux entreprises et artisanat",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Agen pour conserveries, coopératives fruitières et négoces agroalimentaires : nous cartographions vos processus (prévision de récolte, contrôle qualité, traçabilité, administratif) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Agen pour conserveries, coopératives fruitières et négoces agroalimentaires : nous cartographions vos processus (prévision de récolte, contrôle qualité, traçabilité, administratif) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Agen : formats adaptés à l'atelier de transformation, à la coopérative ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
      en: "Interventions IA sur site à Agen : formats adaptés à l'atelier de transformation, à la coopérative ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
    },
    implementation: {
      fr: "Implémentation IA à Agen : contrôle qualité visuel des fruits, prévision de la demande, optimisation de la logistique fraîche, agents conversationnels pour le négoce et automatisation administrative des PME agroalimentaires.",
      en: "Implémentation IA à Agen : contrôle qualité visuel des fruits, prévision de la demande, optimisation de la logistique fraîche, agents conversationnels pour le négoce et automatisation administrative des PME agroalimentaires.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Agen pour dirigeants de TPE et PME agroalimentaires : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
      en: "Coaching 1-to-1 à Agen pour dirigeants de TPE et PME agroalimentaires : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Agen : plateformes et outils IA sur mesure pour le négoce agricole, la vente directe de produits du terroir et les services aux entreprises locales.",
      en: "Sites web augmentés à Agen : plateformes et outils IA sur mesure pour le négoce agricole, la vente directe de produits du terroir et les services aux entreprises locales.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Agen vit de trois moteurs très concrets : la pharma-chimie (UPSA fabrique le paracétamol Efferalgan/Dafalgan, ~1 500 salariés, 1er employeur privé du Lot-et-Garonne ; CURIA produit les principes actifs), l'agroalimentaire structuré autour de l'Agropole — unique technopole européenne du secteur, 91 entreprises et 3 100 emplois — et la filière pruneau d'Agen IGP portée par la coopérative France Prune / Maître Prunille (~12 000 t/an). Axion-IA conçoit pour ce tissu des sites web et plateformes SaaS augmentés par l'IA : e-commerce de produits du terroir avec traçabilité IGP, portails négoce coopératif, outils documentaires pour l'industrie pharma. Code sur mesure, UX/UI et mobile soignés, hébergement UE conforme au RGPD, zéro verrou éditeur.",
        whyHere: [
          "L'Agropole (Estillac/Damazan) concentre 91 entreprises agroalimentaires et un centre Agrotec d'analyse : ces conserveries, transformateurs et start-ups food ont besoin de boutiques e-commerce, de fiches produit traçables IGP et de configurateurs B2B, pas de sites vitrines génériques.",
          "La filière pruneau d'Agen IGP (France Prune, Maître Prunille, ~345 producteurs, leader fruits secs à l'export) appelle des plateformes de vente directe multilingues, de la gestion d'allégations IGP/bio et des espaces revendeurs B2B reliés aux ERP coopératifs.",
          "Le pôle pharma-chimie (UPSA, CURIA — 44% de l'emploi industriel local) impose des exigences documentaires et qualité fortes : nous construisons des portails internes, des moteurs de recherche sur référentiels réglementaires et des interfaces RGPD-by-design adaptés à ces contraintes.",
          "Le Technopole Agen-Garonne de Sainte-Colombe-en-Bruilhois (212 ha, ~1 300 emplois, Gozoki/Maison Briau, Agralis Services) et la future gare LGV GPSO attirent de nouveaux acteurs : nous y déployons des SaaS métier, dashboards data agronomique et sites corporate IA-ready.",
        ],
        methodology: [
          {
            step: "Cadrage à Agen",
            detail:
              "Atelier de lancement dans vos locaux — Agropole, Technopole Agen-Garonne, centre-ville ou commune de l'agglo (Boé, Le Passage, Bon-Encontre). Nous cartographions vos parcours réels : commande de pruneaux en vente directe, qualification d'un acheteur B2B, recherche documentaire qualité, et fixons les objectifs mesurables.",
          },
          {
            step: "Design UX/UI et maquettes",
            detail:
              "Maquettes mobile-first et design system adaptés à votre métier : tunnel d'achat e-commerce terroir, espace revendeur négoce, interface back-office pour une conserverie ou une coopérative. Validation sur vos vrais contenus avant toute ligne de code.",
          },
          {
            step: "Développement et IA embarquée",
            detail:
              "Site ou SaaS codé sur mesure (multi-CMS si besoin : headless, WooCommerce, Shopify, ou full custom) avec briques IA utiles : recherche sémantique sur catalogue, recommandation produit, génération de fiches multilingues pour l'export, chatbot RAG sur votre documentation réglementaire ou commerciale.",
          },
          {
            step: "Intégrations et données",
            detail:
              "Connexion à vos outils existants — ERP coopératif, gestion des stocks de fruits secs, CRM, référentiels qualité pharma, données agronomiques type Agralis. Traçabilité IGP, allégations bio et conformité RGPD intégrées dès la conception, hébergement en UE.",
          },
          {
            step: "Mise en ligne et autonomie",
            detail:
              "Recette sur site à Agen, formation de vos équipes, remise de la documentation et des accès. Vous gardez la main complète sur le code, les contenus et les modèles IA — aucune dépendance contractuelle ni verrou éditeur après la livraison.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Site vitrine ou e-commerce essentiel augmenté IA",
            detail:
              "Pour producteurs de pruneaux, artisans du terroir, commerces et indépendants agenais : boutique en ligne, prise de commande, génération de fiches produit assistée par IA et référencement local soigné.",
          },
          {
            sizeLabel: "PME",
            price: "Plateforme e-commerce / portail métier sur mesure",
            detail:
              "Pour conserveries, transformateurs de l'Agropole, négoces et coopératives : vente directe + espace revendeurs B2B, traçabilité IGP, recherche sémantique catalogue, intégration ERP et exports multilingues.",
          },
          {
            sizeLabel: "ETI",
            price: "SaaS métier ou portail data avec IA intégrée",
            detail:
              "Pour acteurs structurés (filière pruneau, agro-industrie du Technopole Agen-Garonne, data agronomique) : application web complète, tableaux de bord, agents IA, gouvernance des données et montée en charge maîtrisée.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme plateforme multi-sites IA-native",
            detail:
              "Pour grands employeurs du bassin (industrie pharma UPSA/CURIA, groupes agroalimentaires) : portails internes, moteurs de recherche documentaire réglementaire, SaaS multi-entités, conformité RGPD/qualité de bout en bout.",
          },
        ],
        faq: [
          {
            q: "Vous concevez des boutiques e-commerce pour la vente de pruneaux d'Agen et produits du terroir ?",
            a: "Oui. Nous développons des plateformes de vente directe pour producteurs, coopératives et marques de la filière pruneau d'Agen IGP (à l'image de l'écosystème France Prune / Maître Prunille) : tunnel d'achat mobile-first, gestion des allégations IGP et bio, espace revendeurs B2B, génération de fiches produit multilingues pour l'export, le tout avec hébergement en UE conforme au RGPD.",
          },
          {
            q: "Pouvez-vous répondre aux exigences documentaires d'un acteur pharma comme ceux d'Agen ?",
            a: "Oui. Le bassin agenais étant dominé par la pharma-chimie (UPSA, CURIA, ~44% de l'emploi industriel local), nous savons construire des portails internes, des moteurs de recherche sur référentiels réglementaires et qualité, et des chatbots RAG sur documentation, avec une logique RGPD-by-design et la maîtrise des données chez vous.",
          },
          {
            q: "Travaillez-vous avec les entreprises de l'Agropole et du Technopole Agen-Garonne ?",
            a: "Oui, ce sont nos cibles prioritaires. Pour les 91 entreprises de l'Agropole comme pour les acteurs installés au Technopole Agen-Garonne de Sainte-Colombe-en-Bruilhois, nous concevons sites corporate IA-ready, SaaS métier, dashboards de données agronomiques et plateformes e-commerce connectées à vos ERP et outils existants.",
          },
          {
            q: "Le site ou le SaaS reste-t-il ma propriété, sans dépendance à Axion-IA ?",
            a: "Oui. Vous récupérez l'intégralité du code, des contenus, des accès et des modèles IA configurés. Nous travaillons en multi-CMS (headless, WooCommerce, Shopify ou full custom) selon votre besoin, sans verrou éditeur : vous pouvez reprendre la maintenance en interne ou la confier à tout prestataire.",
          },
          {
            q: "Sous quel délai obtient-on un devis et comment se passe l'intervention à Agen ?",
            a: "Le devis est remis à partir de 48 h selon la complexité, avec un périmètre et un budget clairs. Le cadrage et la recette se font sur site à Agen ou dans l'agglo (Boé, Le Passage-d'Agen, Bon-Encontre, Foulayronnes), les itérations à distance. Vos équipes sont formées et autonomes à la livraison.",
          },
        ],
        guarantees:
          "Code sur mesure, propriété pleine de la solution et zéro verrou éditeur : vous reprenez la main quand vous voulez. Hébergement en Union européenne conforme au RGPD par défaut, traçabilité IGP et conformité qualité intégrées dès la conception pour les acteurs agroalimentaires et pharma agenais. UX/UI, accessibilité et performance mobile soignées sur chaque livrable. Devis transparent à partir de 48 h selon la complexité, périmètre contractuel défini avant développement, équipes formées et autonomes à la mise en ligne.",
      },
      en: {
        hero: "Agen runs on three very concrete engines: pharma-chemistry (UPSA manufactures paracetamol — Efferalgan/Dafalgan — with ~1,500 staff, the top private employer in Lot-et-Garonne; CURIA produces the active ingredients), agri-food structured around the Agropole — Europe's only technopole dedicated to the sector, 91 companies and 3,100 jobs — and the Agen prune PGI value chain led by the France Prune / Maître Prunille cooperative (~12,000 t/year). Axion-IA builds AI-augmented websites and SaaS platforms for this fabric: terroir e-commerce with PGI traceability, cooperative trade portals, document tooling for the pharma industry. Custom code, polished UX/UI and mobile, EU GDPR-compliant hosting, zero vendor lock-in.",
        whyHere: [
          "The Agropole (Estillac/Damazan) gathers 91 agri-food companies and an Agrotec analysis centre: these canneries, processors and food start-ups need e-commerce stores, PGI-traceable product sheets and B2B configurators, not generic brochure sites.",
          "The Agen prune PGI value chain (France Prune, Maître Prunille, ~345 growers, dried-fruit export leader) calls for multilingual direct-sale platforms, PGI/organic claim management and B2B reseller areas linked to cooperative ERPs.",
          "The pharma-chemistry hub (UPSA, CURIA — 44% of local industrial jobs) imposes strong documentation and quality requirements: we build internal portals, search engines over regulatory references and GDPR-by-design interfaces suited to these constraints.",
          "The Technopole Agen-Garonne at Sainte-Colombe-en-Bruilhois (212 ha, ~1,300 jobs, Gozoki/Maison Briau, Agralis Services) and the future GPSO high-speed rail station attract new players: we deploy business SaaS, agronomic data dashboards and AI-ready corporate sites there.",
        ],
        methodology: [
          {
            step: "Framing in Agen",
            detail:
              "Kick-off workshop at your premises — Agropole, Technopole Agen-Garonne, city centre or an agglo commune (Boé, Le Passage, Bon-Encontre). We map your real journeys: direct-sale prune ordering, B2B buyer qualification, quality document search, and set measurable objectives.",
          },
          {
            step: "UX/UI design and mockups",
            detail:
              "Mobile-first mockups and a design system tailored to your trade: terroir e-commerce checkout, trade reseller area, back-office interface for a cannery or cooperative. Validated on your real content before any code is written.",
          },
          {
            step: "Development and embedded AI",
            detail:
              "Website or SaaS coded to measure (multi-CMS if needed: headless, WooCommerce, Shopify or full custom) with useful AI bricks: semantic catalogue search, product recommendation, multilingual sheet generation for export, RAG chatbot over your regulatory or commercial documentation.",
          },
          {
            step: "Integrations and data",
            detail:
              "Connection to your existing tools — cooperative ERP, dried-fruit stock management, CRM, pharma quality references, agronomic data such as Agralis. PGI traceability, organic claims and GDPR compliance built in from the start, EU hosting.",
          },
          {
            step: "Go-live and autonomy",
            detail:
              "On-site acceptance in Agen, team training, handover of documentation and access. You keep full control of the code, content and AI models — no contractual dependency or vendor lock-in after delivery.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "AI-augmented brochure or essential e-commerce site",
            detail:
              "For Agen prune growers, terroir artisans, shops and freelancers: online store, order taking, AI-assisted product sheet generation and polished local SEO.",
          },
          {
            sizeLabel: "SME",
            price: "Custom e-commerce platform / business portal",
            detail:
              "For canneries, Agropole processors, traders and cooperatives: direct sales + B2B reseller area, PGI traceability, semantic catalogue search, ERP integration and multilingual exports.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Business SaaS or data portal with embedded AI",
            detail:
              "For structured players (prune value chain, Technopole Agen-Garonne agri-industry, agronomic data): full web app, dashboards, AI agents, data governance and controlled scaling.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-site AI-native platform program",
            detail:
              "For major local employers (UPSA/CURIA pharma industry, agri-food groups): internal portals, regulatory document search engines, multi-entity SaaS, end-to-end GDPR/quality compliance.",
          },
        ],
        faq: [
          {
            q: "Do you build e-commerce stores for selling Agen prunes and terroir products?",
            a: "Yes. We develop direct-sale platforms for growers, cooperatives and brands in the Agen prune PGI value chain (like the France Prune / Maître Prunille ecosystem): mobile-first checkout, PGI and organic claim management, B2B reseller area, multilingual product sheet generation for export, all with EU GDPR-compliant hosting.",
          },
          {
            q: "Can you meet the documentation requirements of a pharma player like those in Agen?",
            a: "Yes. As the Agen area is dominated by pharma-chemistry (UPSA, CURIA, ~44% of local industrial jobs), we build internal portals, search engines over regulatory and quality references, and RAG chatbots over documentation, with GDPR-by-design logic and your data kept under your control.",
          },
          {
            q: "Do you work with Agropole and Technopole Agen-Garonne companies?",
            a: "Yes, they are our priority targets. For the Agropole's 91 companies as well as players based at the Technopole Agen-Garonne in Sainte-Colombe-en-Bruilhois, we build AI-ready corporate sites, business SaaS, agronomic data dashboards and e-commerce platforms connected to your existing ERPs and tools.",
          },
          {
            q: "Does the website or SaaS remain my property, with no dependency on Axion-IA?",
            a: "Yes. You receive all the code, content, access and configured AI models. We work multi-CMS (headless, WooCommerce, Shopify or full custom) per your need, with no vendor lock-in: you can take maintenance in-house or hand it to any provider.",
          },
          {
            q: "How fast is a quote and how does the engagement in Agen work?",
            a: "The quote is delivered from 48 h depending on complexity, with a clear scope and budget. Framing and acceptance happen on site in Agen or the agglo (Boé, Le Passage-d'Agen, Bon-Encontre, Foulayronnes), iterations remotely. Your teams are trained and autonomous at delivery.",
          },
        ],
        guarantees:
          "Custom code, full ownership of the solution and zero vendor lock-in: you take back control whenever you want. EU hosting GDPR-compliant by default, PGI traceability and quality compliance built in from the start for Agen agri-food and pharma players. Polished UX/UI, accessibility and mobile performance on every deliverable. Transparent quote from 48 h depending on complexity, contractual scope defined before development, teams trained and autonomous at go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA accompagne-t-il les TPE et PME agroalimentaires d'Agen ?",
      a: "Oui, l'agroalimentaire est notre cible prioritaire à Agen : conserveries, coopératives fruitières, transformation du pruneau, négoce et logistique fraîche. Nous travaillons d'abord avec les TPE et PME, l'accompagnement des ETI restant marginal.",
    },
    {
      q: "Quels gains IA pour une conserverie ou coopérative agenaise ?",
      a: "Contrôle qualité visuel des fruits, prévision de récolte et de demande, traçabilité IGP automatisée et réduction des tâches administratives. Chaque piste est chiffrée en ROI dans l'Audit sur place avant toute implémentation.",
    },
    {
      q: "Quel est le tarif d'un audit IA à Agen ?",
      a: "L'Audit sur place sur mesure démarre à {{price:audit-flash|flat}}. Tous nos tarifs sont publics et sans devis opaque. Nous chiffrons ensuite chaque chantier d'implémentation au cas par cas selon le ROI identifié.",
    },
    {
      q: "Intervenez-vous autour d'Agen, à Boé ou Le Passage ?",
      a: "Oui, nous nous déplaçons dans toute l'agglomération agenaise : Boé, Le Passage-d'Agen, Bon-Encontre, Foulayronnes et les communes du Lot-et-Garonne. Tarifs publics.",
    },
    {
      q: "Vos solutions IA sont-elles conformes au RGPD ?",
      a: "Oui, chaque solution déployée à Agen respecte le RGPD et l'AI Act. Vos données clients et données de production restent maîtrisées, sans verrou technologique ni dépendance à un prestataire unique.",
    },
  ],
};
