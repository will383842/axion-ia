// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Belfort (90, Territoire de Belfort) — Lion de Belfort, turbines Alstom/GE, technopôle Techn'Hom, bassin industriel.

import type { VilleCopy } from "./types";

export const BELFORT_COPY: VilleCopy = {
  pitchFr:
    "Belfort (90), ville-symbole du Lion de Bartholdi et capitale industrielle du nord Franche-Comté, vit au rythme des grandes turbines (Alstom, General Electric), de la sous-traitance mécanique et du technopôle Techn'Hom. Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne en priorité les PME et ETI du bassin, les grands groupes en complément.",
  pitchEn:
    "Belfort (90), ville-symbole du Lion de Bartholdi et capitale industrielle du nord Franche-Comté, vit au rythme des grandes turbines (Alstom, General Electric), de la sous-traitance mécanique et du technopôle Techn'Hom. Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne en priorité les PME et ETI du bassin, les grands groupes en complément.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient sur site à Belfort et dans tout le nord Franche-Comté. Nous accompagnons en priorité les PME et ETI industrielles du bassin — sous-traitants mécaniques et métalliers, bureaux d'études, fournisseurs de la filière énergie/transport, commerces et services — puis les grands groupes en complément. Audit, intervention sur site, implémentation et coaching un-à-un, à tarifs publics.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient sur site à Belfort et dans tout le nord Franche-Comté. Nous accompagnons en priorité les PME et ETI industrielles du bassin — sous-traitants mécaniques et métalliers, bureaux d'études, fournisseurs de la filière énergie/transport, commerces et services — puis les grands groupes en complément. Audit, intervention sur site, implémentation et coaching un-à-un, à tarifs publics.",
  seoHook: "turbines, mécanique & Techn'Hom",
  ecosystemFr:
    "Belfort est un bassin industriel historique structuré autour des grandes turbines (Alstom, General Electric), de la mécanique de précision et du technopôle Techn'Hom. Autour des donneurs d'ordre gravite un réseau dense de PME et ETI sous-traitantes, complété par le commerce et les services.",
  ecosystemEn:
    "Belfort est un bassin industriel historique structuré autour des grandes turbines (Alstom, General Electric), de la mécanique de précision et du technopôle Techn'Hom. Autour des donneurs d'ordre gravite un réseau dense de PME et ETI sous-traitantes, complété par le commerce et les services.",
  distancesFr:
    "Gare de Belfort en centre-ville ; gare TGV Belfort-Montbéliard à 10 km (Paris en 2h15). Montbéliard à 20 min, Mulhouse à 40 min, frontière suisse (Bâle) à 1h.",
  distancesEn:
    "Gare de Belfort en centre-ville ; gare TGV Belfort-Montbéliard à 10 km (Paris en 2h15). Montbéliard à 20 min, Mulhouse à 40 min, frontière suisse (Bâle) à 1h.",
  topSectorsNaf: [
    "Fabrication de turbines et machines (énergie)",
    "Mécanique de précision et métallurgie",
    "Sous-traitance industrielle (PME du bassin)",
    "Ingénierie et bureaux d'études (Techn'Hom)",
    "Commerce et services aux entreprises",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Belfort : diagnostic des gisements d'automatisation chez les sous-traitants mécaniques, métalliers et bureaux d'études du bassin. Priorisation des cas d'usage à ROI rapide, à tarif public.",
      en: "Audit IA à Belfort : diagnostic des gisements d'automatisation chez les sous-traitants mécaniques, métalliers et bureaux d'études du bassin. Priorisation des cas d'usage à ROI rapide, à tarif public.",
    },
    interventions: {
      fr: "Interventions IA sur site à Belfort : nous venons dans l'atelier, le bureau d'études ou les bureaux administratifs pour former vos équipes, qui pilotent ensuite la stack en autonomie.",
      en: "Interventions IA sur site à Belfort : nous venons dans l'atelier, le bureau d'études ou les bureaux administratifs pour former vos équipes, qui pilotent ensuite la stack en autonomie.",
    },
    implementation: {
      fr: "Implémentation IA à Belfort : maintenance prédictive et contrôle qualité en atelier, automatisation des devis et de la documentation technique, agents de support pour les PME industrielles du Techn'Hom.",
      en: "Implémentation IA à Belfort : maintenance prédictive et contrôle qualité en atelier, automatisation des devis et de la documentation technique, agents de support pour les PME industrielles du Techn'Hom.",
    },
    unAUn: {
      fr: "Coaching un-à-un à Belfort : sessions dans vos locaux ou en visio pour les dirigeants de PME et ETI industrielles — gérants d'atelier, responsables BE, patrons de sous-traitance du nord Franche-Comté.",
      en: "Coaching un-à-un à Belfort : sessions dans vos locaux ou en visio pour les dirigeants de PME et ETI industrielles — gérants d'atelier, responsables BE, patrons de sous-traitance du nord Franche-Comté.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Belfort : portails techniques et configurateurs avec IA intégrée pour les sous-traitants mécaniques et bureaux d'études — devis assisté, base documentaire interrogeable, espace client.",
      en: "Sites web augmentés à Belfort : portails techniques et configurateurs avec IA intégrée pour les sous-traitants mécaniques et bureaux d'études — devis assisté, base documentaire interrogeable, espace client.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Belfort (90) concentre sur un même bassin trois donneurs d'ordre mondiaux de l'énergie et du transport : GE Vernova (turbines à gaz), Arabelle Solutions — filiale d'EDF depuis mai 2024, qui y fabrique les turbines à vapeur nucléaires les plus puissantes au monde — et Alstom, qui construit un nouvel atelier ferroviaire de 3 800 m² pour ses trains hydrogène Coradia/Régiolis. Autour gravitent un réseau dense de sous-traitants mécaniques et métalliers du technopôle Techn'Hom (106 ha, 265 entreprises) et un pôle hydrogène-énergie porté par l'UTBM et le laboratoire FCLab. Axion-IA y conçoit des sites web et plateformes SaaS augmentés par l'IA pour ce tissu industriel — configurateurs techniques, portails documentaires, espaces fournisseurs — hébergés en Europe, sans verrou éditeur.",
        whyHere: [
          "Le bassin de Belfort est structuré par trois grands comptes — GE Vernova, Arabelle Solutions (EDF) et Alstom — dont dépend un réseau dense de sous-traitants mécaniques et métalliers : nous concevons pour eux des sites web et plateformes SaaS qui parlent le langage de l'usinage, du contrôle qualité et des appels d'offres industriels, pas du e-commerce générique.",
          "Les PME de Techn'Hom (106 ha, 265 entreprises) ont des besoins web très spécifiques : configurateur de pièces et de devis, portail de documentation technique interrogeable, espace fournisseur connecté aux ERP des donneurs d'ordre — autant de plateformes où l'IA (RAG, recherche sémantique) apporte une vraie valeur métier.",
          "L'écosystème hydrogène du nord Franche-Comté — UTBM (campus rue Thierry Mieg, fablab Crunch Lab) et laboratoire FCLab (CNRS, plus de 25 ans de recherche pile à combustible) — fait émerger des startups deeptech qui ont besoin de plateformes SaaS IA-native dès leur lancement : nous construisons ces produits en code custom.",
          "Nous couvrons UX/UI, mobile, e-commerce multi-CMS (Shopify, WooCommerce, PrestaShop) et IA dans un même atelier : un sous-traitant de Belfort peut nous confier aussi bien sa vitrine technique que son espace client B2B ou son catalogue de pièces en ligne, sans multiplier les prestataires.",
        ],
        methodology: [
          {
            step: "Cadrage à Belfort",
            detail:
              "Première venue dans vos locaux — atelier d'usinage, bureau d'études Techn'Hom ou bureaux administratifs — pour cartographier votre activité réelle : nature des pièces, processus de devis, documentation technique, attentes des donneurs d'ordre (GE Vernova, Arabelle/EDF, Alstom) et de leurs cahiers des charges.",
          },
          {
            step: "Architecture & maquettes",
            detail:
              "Conception de l'arborescence et des maquettes UX/UI mobile-first : pages de capacités d'usinage, configurateur de devis, portail documentaire, espace fournisseur. Validation visuelle avec votre direction et votre bureau d'études avant toute ligne de code.",
          },
          {
            step: "Développement & couche IA",
            detail:
              "Développement en code custom (sans lock-in éditeur) ou intégration multi-CMS selon le besoin, avec la couche IA branchée sur VOS contenus : recherche sémantique dans la documentation technique, assistant de qualification de demande, génération assistée de fiches produits et de réponses d'appels d'offres.",
          },
          {
            step: "Recette sur vos données",
            detail:
              "Tests d'acceptation sur vos vrais référentiels — plans, nomenclatures, historique de devis — dans le respect strict de la confidentialité industrielle. Mesure des temps gagnés sur la qualification de demande et la production documentaire avant mise en ligne.",
          },
          {
            step: "Mise en ligne & autonomie",
            detail:
              "Déploiement, formation de vos équipes à l'administration du site et de la couche IA, remise de la documentation. Vous gardez la main : code, contenus et accès restent chez vous, transférables à tout intégrateur du nord Franche-Comté.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Plateforme métier + configurateur",
            detail:
              "Pour les PME sous-traitantes de Techn'Hom : configurateur de pièces/devis, portail de documentation technique interrogeable par IA, espace client B2B, e-commerce multi-CMS si catalogue de pièces ou consommables en ligne.",
          },
          {
            sizeLabel: "ETI",
            price: "Portail fournisseur + SaaS sur mesure",
            detail:
              "Pour les ETI industrielles et équipementiers du nord Franche-Comté : plateforme SaaS sur mesure connectée à l'ERP, espace fournisseur/EDI aligné sur les exigences des donneurs d'ordre (GE Vernova, Arabelle/EDF, Alstom), agents IA de support et de qualification.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme plateforme multi-sites",
            detail:
              "Pour les grands comptes énergie/ferroviaire et les acteurs de l'écosystème hydrogène (UTBM, FCLab et startups associées) : conception de plateformes IA-native, gouvernance données, intégrations avancées et déploiement multi-sites.",
          },
        ],
        faq: [
          {
            q: "Travaillez-vous avec les sous-traitants des grands donneurs d'ordre de Belfort ?",
            a: "Oui, c'est notre cœur de cible. Les sous-traitants mécaniques et métalliers qui livrent GE Vernova, Arabelle Solutions (EDF) ou Alstom ont des besoins web précis : portail documentaire technique, configurateur de devis, espace fournisseur aligné sur les cahiers des charges. Nous concevons ces plateformes avec une couche IA branchée sur vos référentiels, hébergées en Europe.",
          },
          {
            q: "Pouvez-vous construire une plateforme SaaS pour une startup hydrogène issue de l'UTBM ou de FCLab ?",
            a: "Oui. L'écosystème hydrogène du nord Franche-Comté — porté par l'UTBM (fablab Crunch Lab) et le laboratoire FCLab — fait émerger des startups deeptech qui ont besoin d'un produit SaaS IA-native dès le départ. Nous développons en code custom (chatbot RAG, recherche sémantique, agents) sans verrou éditeur, pour que la jeune pousse garde la pleine maîtrise de sa stack.",
          },
          {
            q: "Faites-vous aussi de l'e-commerce, ou seulement des sites techniques ?",
            a: "Les deux. Nous couvrons l'e-commerce multi-CMS (Shopify, WooCommerce, PrestaShop) comme le développement sur mesure. Un fournisseur de pièces ou de consommables du bassin de Belfort peut nous confier son catalogue en ligne, et une PME sous-traitante son portail technique — UX/UI, mobile et IA inclus dans le même atelier.",
          },
          {
            q: "Comment garantissez-vous la confidentialité des plans et données techniques ?",
            a: "Toutes nos plateformes respectent strictement le RGPD et la confidentialité industrielle. Données et code hébergés en Europe, aucun entraînement de modèles tiers sur vos plans, nomenclatures ou historiques de devis. Pour les chaînes de sous-traitance énergie/nucléaire, nous appliquons les contraintes de souveraineté dès le choix des modèles.",
          },
          {
            q: "Combien de temps pour un devis et où intervenez-vous ?",
            a: "Devis à partir de 24-48 h selon la complexité, après un premier échange. Nous nous déplaçons sur site à Belfort, Techn'Hom, Montbéliard et dans tout le nord Franche-Comté pour le cadrage, la recette et la mise en ligne.",
          },
        ],
        guarantees:
          "Engagement contractuel sur le périmètre défini à la signature : maquettes validées avant développement, recette sur vos vraies données avant mise en ligne. Conformité RGPD, hébergement en Europe par défaut, confidentialité industrielle stricte (aucun entraînement de modèle tiers sur vos plans). Aucun verrou éditeur : code, contenus et accès restent intégralement chez vous, transférables à tout intégrateur du nord Franche-Comté ou repris en interne. Vos équipes sont formées à l'administration du site et de la couche IA avant la fin de mission.",
      },
      en: {
        hero: "Belfort (90) concentrates three world-class energy and transport prime contractors in a single industrial basin: GE Vernova (gas turbines), Arabelle Solutions — an EDF subsidiary since May 2024, where the world's most powerful nuclear steam turbines are built — and Alstom, currently building a new 3,800 m² railway workshop for its Coradia/Régiolis hydrogen trains. Around them gravitates a dense network of machining and metalworking subcontractors at the Techn'Hom technopole (106 ha, 265 companies) and a hydrogen-energy hub led by the UTBM and the FCLab laboratory. Axion-IA designs AI-augmented websites and SaaS platforms for this industrial fabric — technical configurators, documentation portals, supplier spaces — hosted in Europe, with no vendor lock-in.",
        whyHere: [
          "The Belfort basin is structured by three large accounts — GE Vernova, Arabelle Solutions (EDF) and Alstom — on which a dense network of machining and metalworking subcontractors depends: we build them websites and SaaS platforms that speak the language of machining, quality control and industrial tenders, not generic e-commerce.",
          "The SMEs of Techn'Hom (106 ha, 265 companies) have very specific web needs: parts and quote configurators, searchable technical documentation portals, supplier spaces connected to prime contractors' ERPs — platforms where AI (RAG, semantic search) delivers real business value.",
          "The hydrogen ecosystem of north Franche-Comté — the UTBM (campus on rue Thierry Mieg, Crunch Lab fablab) and the FCLab laboratory (CNRS, over 25 years of fuel-cell research) — spawns deeptech startups that need AI-native SaaS platforms from day one: we build these products in custom code.",
          "We cover UX/UI, mobile, multi-CMS e-commerce (Shopify, WooCommerce, PrestaShop) and AI in a single workshop: a Belfort subcontractor can entrust us with its technical showcase, its B2B client space and its online parts catalogue alike, without juggling multiple vendors.",
        ],
        methodology: [
          {
            step: "Kick-off in Belfort",
            detail:
              "First visit to your premises — machining workshop, Techn'Hom engineering office or administrative offices — to map your real activity: type of parts, quoting process, technical documentation, and the requirements of prime contractors (GE Vernova, Arabelle/EDF, Alstom) and their specifications.",
          },
          {
            step: "Architecture & mockups",
            detail:
              "Design of the sitemap and mobile-first UX/UI mockups: machining capability pages, quote configurator, documentation portal, supplier space. Visual validation with your leadership and engineering office before any line of code.",
          },
          {
            step: "Development & AI layer",
            detail:
              "Custom-code development (no vendor lock-in) or multi-CMS integration as needed, with the AI layer plugged into YOUR content: semantic search across technical documentation, request-qualification assistant, assisted generation of product sheets and tender responses.",
          },
          {
            step: "Acceptance on your data",
            detail:
              "User acceptance tests on your real repositories — drawings, bills of materials, quote history — under strict industrial confidentiality. Measurement of time saved on request qualification and document production before going live.",
          },
          {
            step: "Go-live & autonomy",
            detail:
              "Deployment, training of your teams to administer the site and the AI layer, documentation handover. You stay in control: code, content and access remain with you, transferable to any north Franche-Comté integrator.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Business platform + configurator",
            detail:
              "For Techn'Hom subcontracting SMEs: parts/quote configurator, AI-searchable technical documentation portal, B2B client space, multi-CMS e-commerce where parts or consumables are sold online.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Supplier portal + custom SaaS",
            detail:
              "For industrial mid-caps and equipment suppliers of north Franche-Comté: custom SaaS platform connected to the ERP, supplier/EDI space aligned with prime contractor requirements (GE Vernova, Arabelle/EDF, Alstom), AI support and qualification agents.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-site platform program",
            detail:
              "For energy/rail large accounts and players of the hydrogen ecosystem (UTBM, FCLab and associated startups): AI-native platform design, data governance, advanced integrations and multi-site deployment.",
          },
        ],
        faq: [
          {
            q: "Do you work with the subcontractors of Belfort's major prime contractors?",
            a: "Yes, that's our core target. Machining and metalworking subcontractors supplying GE Vernova, Arabelle Solutions (EDF) or Alstom have precise web needs: technical documentation portal, quote configurator, supplier space aligned with specifications. We build these platforms with an AI layer plugged into your repositories, hosted in Europe.",
          },
          {
            q: "Can you build a SaaS platform for a hydrogen startup from the UTBM or FCLab?",
            a: "Yes. The hydrogen ecosystem of north Franche-Comté — driven by the UTBM (Crunch Lab fablab) and the FCLab laboratory — spawns deeptech startups that need an AI-native SaaS product from the start. We develop in custom code (RAG chatbot, semantic search, agents) with no vendor lock-in, so the young company keeps full control of its stack.",
          },
          {
            q: "Do you also do e-commerce, or only technical sites?",
            a: "Both. We cover multi-CMS e-commerce (Shopify, WooCommerce, PrestaShop) as well as custom development. A parts or consumables supplier in the Belfort basin can entrust us with its online catalogue, and a subcontracting SME with its technical portal — UX/UI, mobile and AI included in the same workshop.",
          },
          {
            q: "How do you guarantee the confidentiality of drawings and technical data?",
            a: "All our platforms strictly comply with GDPR and industrial confidentiality. Data and code hosted in Europe, no third-party model training on your drawings, bills of materials or quote history. For energy/nuclear supply chains, we apply sovereignty constraints from the model selection stage.",
          },
          {
            q: "How long for a quote and where do you operate?",
            a: "Quote from 24-48 h depending on complexity, after an initial exchange. We travel on site to Belfort, Techn'Hom, Montbéliard and across north Franche-Comté for kick-off, acceptance and go-live.",
          },
        ],
        guarantees:
          "Contractual commitment on the scope defined at signature: mockups validated before development, acceptance on your real data before go-live. GDPR compliance, EU hosting by default, strict industrial confidentiality (no third-party model training on your drawings). No vendor lock-in: code, content and access remain entirely with you, transferable to any north Franche-Comté integrator or taken back in-house. Your teams are trained to administer the site and the AI layer before mission end.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il à Belfort et dans le nord Franche-Comté ?",
      a: "Oui, Axion-IA se déplace sur site à Belfort, Montbéliard et dans tout le bassin industriel. Nous accompagnons en priorité les PME et ETI, puis les grands groupes en complément.",
    },
    {
      q: "Travaillez-vous avec les sous-traitants mécaniques du bassin ?",
      a: "Oui, c'est notre cœur de cible à Belfort. Automatisation des devis et de la documentation technique, contrôle qualité assisté et maintenance prédictive, adaptés aux ateliers de PME.",
    },
    {
      q: "Aidez-vous les bureaux d'études et l'ingénierie de Techn'Hom ?",
      a: "Oui. Pour les BE et l'ingénierie, nous mettons en place la recherche dans la documentation technique, l'assistance à la rédaction et l'automatisation des tâches répétitives, dans un cadre RGPD strict.",
    },
    {
      q: "Faut-il être un grand groupe pour travailler avec Axion-IA à Belfort ?",
      a: "Non. Notre priorité, ce sont les PME et ETI sous-traitantes du bassin. Un Audit sur place permet de démarrer petit, à tarif public, avec un ROI quantifié avant tout engagement.",
    },
    {
      q: "Comment garantissez-vous la confidentialité des plans et données techniques ?",
      a: "Toutes nos implémentations à Belfort respectent strictement le RGPD et la confidentialité industrielle. Données hébergées en Europe, pas d'entraînement de modèles tiers sur vos plans.",
    },
    {
      q: "Comment se déroule une mission IA à Belfort ?",
      a: "Nos consultants se déplacent dans vos locaux après un premier échange.",
    },
  ],
};
