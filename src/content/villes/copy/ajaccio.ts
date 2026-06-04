// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Ajaccio (2A, Corse-du-Sud) — préfecture, ville de Napoléon, port, tourisme insulaire.

import type { VilleCopy } from "./types";

export const AJACCIO_COPY: VilleCopy = {
  pitchFr:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Ajaccio, préfecture de la Corse-du-Sud et ville natale de Napoléon. Hôtellerie, restauration, port de commerce, tourisme insulaire, commerce et services : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  pitchEn:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Ajaccio, préfecture de la Corse-du-Sud et ville natale de Napoléon. Hôtellerie, restauration, port de commerce, tourisme insulaire, commerce et services : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui accompagne les TPE et PME d'Ajaccio en priorité, les PME ensuite. Nous ciblons l'économie touristique insulaire (hôtellerie, restauration, locations), le commerce, les services portuaires et les services aux entreprises. Audit sur place sur mesure avec ROI chiffré, puis accompagnement sur site ou en visio, vos équipes restant autonomes.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui accompagne les TPE et PME d'Ajaccio en priorité, les PME ensuite. Nous ciblons l'économie touristique insulaire (hôtellerie, restauration, locations), le commerce, les services portuaires et les services aux entreprises. Audit sur place sur mesure avec ROI chiffré, puis accompagnement sur site ou en visio, vos équipes restant autonomes.",
  seoHook: "tourisme insulaire & port",
  ecosystemFr:
    "Ajaccio, préfecture de la Corse-du-Sud, vit d'une économie fortement saisonnière : hôtellerie, restauration, locations touristiques et croisières via le port de commerce et de voyageurs. Le tourisme balnéaire et patrimonial (cité impériale napoléonienne, golfe d'Ajaccio) côtoie un tissu de TPE et PME de services, de BTP et de commerce, soutenu par l'Université de Corse Pasquale Paoli.",
  ecosystemEn:
    "Ajaccio, préfecture de la Corse-du-Sud, vit d'une économie fortement saisonnière : hôtellerie, restauration, locations touristiques et croisières via le port de commerce et de voyageurs. Le tourisme balnéaire et patrimonial (cité impériale napoléonienne, golfe d'Ajaccio) côtoie un tissu de TPE et PME de services, de BTP et de commerce, soutenu par l'Université de Corse Pasquale Paoli.",
  distancesFr:
    "L'aéroport Ajaccio Napoléon Bonaparte est à environ 5 km du centre. Le port de commerce et de voyageurs est en plein coeur de ville, relié au continent par ferry et avion.",
  distancesEn:
    "L'aéroport Ajaccio Napoléon Bonaparte est à environ 5 km du centre. Le port de commerce et de voyageurs est en plein coeur de ville, relié au continent par ferry et avion.",
  topSectorsNaf: [
    "Hôtellerie et hébergement touristique",
    "Restauration et cafés",
    "Services portuaires et logistique maritime",
    "Commerce de détail et de proximité",
    "Services aux entreprises et BTP",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Ajaccio pour hôtels, restaurants et acteurs du tourisme insulaire : nous identifions les leviers (yield saisonnier, gestion des réservations, e-réputation, administratif) et chiffrons le ROI. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Ajaccio pour hôtels, restaurants et acteurs du tourisme insulaire : nous identifions les leviers (yield saisonnier, gestion des réservations, e-réputation, administratif) et chiffrons le ROI. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Ajaccio : formats adaptés à l'hôtel, au restaurant ou au commerce de saison. Vos collaborateurs gèrent ensuite les outils en autonomie, sans dépendance prestataire.",
      en: "Interventions IA sur site à Ajaccio : formats adaptés à l'hôtel, au restaurant ou au commerce de saison. Vos collaborateurs gèrent ensuite les outils en autonomie, sans dépendance prestataire.",
    },
    implementation: {
      fr: "Implémentation IA à Ajaccio : gestion intelligente des réservations et du yield touristique, agents conversationnels multilingues, analyse des avis clients et automatisation administrative des TPE et PME insulaires.",
      en: "Implémentation IA à Ajaccio : gestion intelligente des réservations et du yield touristique, agents conversationnels multilingues, analyse des avis clients et automatisation administrative des TPE et PME insulaires.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Ajaccio pour dirigeants de TPE et PME touristiques et de services : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA en restant autonome.",
      en: "Coaching 1-to-1 à Ajaccio pour dirigeants de TPE et PME touristiques et de services : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA en restant autonome.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Ajaccio : plateformes de réservation directe, outils IA multilingues et vitrines optimisées pour l'hôtellerie, la restauration et le commerce insulaire.",
      en: "Sites web augmentés à Ajaccio : plateformes de réservation directe, outils IA multilingues et vitrines optimisées pour l'hôtellerie, la restauration et le commerce insulaire.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Ajaccio des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, réservation directe, chatbot RAG multilingue ancré sur vos contenus, recherche sémantique, agents et automatisations. Pensé pour une économie insulaire où le port de croisière a accueilli 336 290 voyageurs en 2025 et où le tissu est fait de TPE du tourisme, du BTP et des services. Devis à partir de 24-48 h selon la complexité, hébergement UE, code et données à vous. Kick-off en présentiel à Ajaccio, itérations à distance pour limiter les contraintes insulaires.",
        whyHere: [
          "Économie maritime captive : transporteurs comme Corsica Linea (siège bd Roi Jérôme, 9 navires) et Air Corsica (aéroport Napoléon Bonaparte) structurent l'accès à l'île — un terrain idéal pour des portails de réservation directe et des parcours clients augmentés à l'IA.",
          "Pic estival et clientèle de croisière internationale (jusqu'à plusieurs milliers de visiteurs débarqués par escale, ~221 escales prévues en 2026) : nos chatbots et agents conversationnels sont multilingues par défaut, calibrés pour l'hôtellerie, la restauration et le commerce de centre-ville.",
          "Tissu 100 % TPE/PME (~12 700 établissements, majorité de petits commerces, BTP du Vazzio, agroalimentaire Subrini à Baleone) : on greffe l'IA sur l'existant (widget, API, plugin) sans refonte coûteuse, ou on construit une vitrine e-commerce de produits corses en circuit court.",
          "Contrainte de continuité territoriale et hébergement UE strict : toute la chaîne IA est hébergeable en Europe, conforme RGPD — vos données de réservation et clients restent maîtrisées, sans dépendance à un prestataire continental unique.",
        ],
        methodology: [
          {
            step: "Cadrage à Ajaccio",
            detail:
              "Atelier sur site — en cœur de ville, à l'aéroport ou en Z.I. (Vazzio, Baleone/Mezzavia) : objectifs, parcours utilisateurs, audit de la stack, des contenus et de la saisonnalité. Devis ferme à partir de 24-48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; prototype testé avant tout développement, pensé mobile-first pour une clientèle qui réserve depuis le quai ou l'avion.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : moteur de réservation directe, e-commerce produits corses, chatbot RAG multilingue, recherche sémantique, agents. Démos hebdomadaires en visio pour caler les chantiers hors haute saison.",
          },
          {
            step: "Recette + mise en ligne",
            detail:
              "Tests d'acceptation, Web Vitals et SEO/AEO validés, mise en production sans downtime — y compris en plein pic de réservations estival.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code, bases et modèles livrés chez vous (hébergement UE possible). Vos équipes ajacciennes pilotent l'outil en autonomie, sans verrou ni abonnement imposé.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Brique IA greffée",
            detail:
              "Ajout d'une brique IA (chatbot multilingue, recherche sémantique, moteur de réservation) sur le site existant d'un hôtel, restaurant ou loueur saisonnier ajaccien, en quelques semaines et sans refonte.",
          },
          {
            sizeLabel: "PME",
            price: "Site / vitrine e-commerce sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une boutique avec UX/UI et IA intégrée : réservation directe pour l'hôtellerie-restauration, e-commerce de produits corses en circuit court, multilingue pour la clientèle de croisière.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier ou portail client sur mesure pour les acteurs structurants — transport maritime/aérien, agences de voyages type Ollandini, distribution agroalimentaire (Subrini, Baleone) — IA intégrée, branchée sur votre SI (CRM, ERP, gestion des stocks et du yield).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels pour les grands employeurs régionaux (Collectivité de Corse, centres hospitaliers Notre-Dame de la Miséricorde et Castelluccio, opérateurs de transport) : refonte de plateformes, design system, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Pouvez-vous gérer une clientèle de croisière multilingue qui débarque par milliers à chaque escale ?",
            a: "Oui. Le port d'Ajaccio a accueilli 182 escales et 336 290 voyageurs en 2025, avec un pic prévu autour de 221 escales en 2026. Nos chatbots, moteurs de réservation et vitrines sont multilingues par défaut (français, anglais, italien, allemand…), pour capter cette clientèle internationale sur mobile, depuis le quai comme depuis le centre-ville.",
          },
          {
            q: "Faites-vous vraiment l'UX/UI et l'e-commerce, pas seulement l'IA ?",
            a: "Oui. On conçoit l'expérience complète à Ajaccio — research, wireframes, design system, maquettes Figma, prototype — pour un site vitrine, une boutique e-commerce de produits corses ou une plateforme de réservation, avec ou sans brique IA. C'est un métier à part entière chez nous, multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop) ou code sur mesure.",
          },
          {
            q: "Comment gérez-vous la saisonnalité touristique pour un projet web ?",
            a: "On cale les chantiers et la mise en ligne hors haute saison, et on conçoit des outils robustes aux pics estivaux : moteur de réservation qui encaisse la charge, prévision de la demande, automatisation des tâches répétitives (confirmations, avis, facturation). Itérations en visio pour ne pas mobiliser vos équipes pendant la saison.",
          },
          {
            q: "Mes données de réservation et clients restent-elles en Europe ?",
            a: "Oui. Toute la chaîne IA est hébergeable en UE, conforme RGPD, sans transit hors UE sans DPA. C'est un point clé pour un acteur insulaire dépendant de la continuité territoriale : vous gardez la propriété complète de vos données et modèles, sans verrou ni dépendance à un prestataire continental unique.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage sur place, on remet un devis ferme en forfait fixe. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple (vitrine, brique IA greffée), davantage pour une plateforme de réservation ou un portail logistique étendu. Pas de régie, pas de dérive horaire cachée.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant, y compris en pleine saison de croisière. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire d'Ajaccio et de la Corse-du-Sud ou repris en interne.",
      },
      en: {
        hero: "In Ajaccio, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, direct booking, multilingual RAG chatbot grounded in your content, semantic search, agents and automations. Built for an island economy where the cruise port welcomed 336,290 travellers in 2025 and the business fabric is made of tourism, construction and service micro-businesses. Quote from 24-48 h depending on complexity, EU hosting, code and data yours. On-site Ajaccio kick-off, remote iterations to ease island constraints.",
        whyHere: [
          "Captive maritime economy: carriers such as Corsica Linea (HQ on boulevard Roi Jérôme, 9 ships) and Air Corsica (Napoléon Bonaparte airport) structure access to the island — ideal ground for direct booking portals and AI-augmented customer journeys.",
          "Summer peak and international cruise clientele (up to several thousand visitors disembarking per call, ~221 calls forecast for 2026): our chatbots and conversational agents are multilingual by default, calibrated for hospitality, restaurants and city-centre retail.",
          "A 100% micro-business/SME fabric (~12,700 establishments, mostly small shops, Vazzio construction firms, Subrini food wholesale in Baleone): we graft AI onto your existing site (widget, API, plugin) without a costly rebuild, or build a short-supply-chain e-commerce storefront for Corsican products.",
          "Territorial continuity constraint and strict EU hosting: the whole AI chain can be hosted in Europe, GDPR-compliant — your booking and customer data stay controlled, with no dependency on a single mainland vendor.",
        ],
        methodology: [
          {
            step: "Scoping in Ajaccio",
            detail:
              "On-site workshop — city centre, airport or industrial zone (Vazzio, Baleone/Mezzavia): goals, user journeys, audit of the existing stack, content and seasonality. Firm quote from 24-48 h depending on complexity.",
          },
          {
            step: "UX/UI design",
            detail:
              "Wireframes, design system and Figma mockups in your brand; prototype tested before any development, mobile-first for customers booking from the quay or the plane.",
          },
          {
            step: "Development in sprints",
            detail:
              "AI grafted onto the existing site or AI-native build: direct booking engine, Corsican-product e-commerce, multilingual RAG chatbot, semantic search, agents. Weekly remote demos to schedule work outside high season.",
          },
          {
            step: "Acceptance + go-live",
            detail:
              "Acceptance tests, Web Vitals and SEO/AEO validated, production release without downtime — even at the peak of summer bookings.",
          },
          {
            step: "Delivery + autonomy",
            detail:
              "Code, databases and models delivered into your infra (EU hosting possible). Your Ajaccio teams run the tool autonomously, with no lock-in or imposed subscription.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Grafted AI brick",
            detail:
              "Add an AI brick (multilingual chatbot, semantic search, booking engine) onto the existing site of an Ajaccio hotel, restaurant or seasonal rental, in a few weeks and without a rebuild.",
          },
          {
            sizeLabel: "SME",
            price: "Bespoke site / e-commerce storefront",
            detail:
              "Design or rebuild of a site or shop with UX/UI and built-in AI: direct booking for hospitality, short-supply-chain e-commerce for Corsican products, multilingual for cruise clientele.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business platform or client portal for structuring players — maritime/air transport, travel agencies like Ollandini, food distribution (Subrini, Baleone) — built-in AI, wired into your IS (CRM, ERP, stock and yield management).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Product programme",
            detail:
              "Multi-year programmes for major regional employers (Collectivité de Corse, Notre-Dame de la Miséricorde and Castelluccio hospitals, transport operators): platform rebuilds, design system, dedicated Axion-IA team in product mode.",
          },
        ],
        faq: [
          {
            q: "Can you handle a multilingual cruise clientele disembarking by the thousands at each call?",
            a: "Yes. Ajaccio's port welcomed 182 calls and 336,290 travellers in 2025, with a peak forecast around 221 calls in 2026. Our chatbots, booking engines and storefronts are multilingual by default (French, English, Italian, German…), to capture this international clientele on mobile, from the quay as well as from the city centre.",
          },
          {
            q: "Do you really do UX/UI and e-commerce, not just the AI?",
            a: "Yes. We design the full experience in Ajaccio — research, wireframes, design system, Figma mockups, prototype — for a showcase site, a Corsican-product e-commerce shop or a booking platform, with or without an AI brick. It's a discipline in its own right with us, multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop) or bespoke code.",
          },
          {
            q: "How do you handle tourist seasonality for a web project?",
            a: "We schedule work and go-live outside high season, and design tools that withstand summer peaks: a booking engine that takes the load, demand forecasting, automation of repetitive tasks (confirmations, reviews, invoicing). Remote iterations so we don't tie up your teams during the season.",
          },
          {
            q: "Does my booking and customer data stay in Europe?",
            a: "Yes. The whole AI chain can be hosted in the EU, GDPR-compliant, with no transit outside the EU without a DPA. That's key for an island player dependent on territorial continuity: you keep full ownership of your data and models, with no lock-in or dependency on a single mainland vendor.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After the on-site scoping, we issue a firm fixed-price quote. Turnaround depends on complexity — from 24-48 h for a simple project (showcase, grafted AI brick), longer for an extended booking platform or logistics portal. No time-and-materials, no hidden hourly drift.",
          },
        ],
        guarantees:
          "Firm fixed-price quote (from 24-48 h depending on complexity): no hidden hourly drift. Go-live without downtime when augmenting an existing site, including in peak cruise season. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Ajaccio or Corse-du-Sud provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il en Corse, à Ajaccio ?",
      a: "Oui, Axion-IA accompagne les TPE et PME d'Ajaccio et de la Corse-du-Sud. Nous nous déplaçons sur site et travaillons aussi en visio pour limiter les contraintes insulaires. Frais de déplacement facturés à part, tarifs publics.",
    },
    {
      q: "Quels gains IA pour un hôtel ou restaurant ajaccien saisonnier ?",
      a: "Optimisation du yield et des réservations, agents conversationnels multilingues pour la clientèle de croisière, analyse des avis et automatisation administrative. Chaque piste est chiffrée en ROI dans l'Audit sur place avant toute mise en oeuvre.",
    },
    {
      q: "Quel est le tarif d'un audit IA à Ajaccio ?",
      a: "L'Audit sur place sur mesure démarre à {{price:audit-flash|flat}}, tarifs publics et sans devis opaque. Les chantiers d'implémentation sont ensuite chiffrés au cas par cas selon le ROI identifié pour votre activité.",
    },
    {
      q: "Comment gérez-vous la saisonnalité touristique de l'IA ?",
      a: "Nous calons les chantiers IA hors haute saison et privilégions des outils que vos équipes maîtrisent vite : prévision de la demande, gestion des pics estivaux et automatisation des tâches répétitives propres au tourisme insulaire.",
    },
    {
      q: "Vos solutions IA sont-elles conformes au RGPD ?",
      a: "Oui, chaque solution déployée à Ajaccio respecte le RGPD et l'AI Act. Vos données clients et de réservation restent maîtrisées, sans verrou technologique ni dépendance à un prestataire unique.",
    },
  ],
};
