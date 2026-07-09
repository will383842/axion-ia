// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Avignon (84, Vaucluse) — Palais des Papes, Festival d'Avignon & le Off, agro provençal, tourisme.

import type { VilleCopy } from "./types";

export const AVIGNON_COPY: VilleCopy = {
  pitchFr:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Avignon, cité des Papes et capitale mondiale du théâtre avec son Festival et le Off. Tourisme culturel, hôtellerie, spectacle vivant, agroalimentaire provençal et commerce : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  pitchEn:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Avignon, cité des Papes et capitale mondiale du théâtre avec son Festival et le Off. Tourisme culturel, hôtellerie, spectacle vivant, agroalimentaire provençal et commerce : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Avignon auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons le tourisme culturel (Palais des Papes, Festival d'Avignon et le Off), l'hôtellerie, le spectacle vivant, l'agroalimentaire provençal et le commerce. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Avignon auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons le tourisme culturel (Palais des Papes, Festival d'Avignon et le Off), l'hôtellerie, le spectacle vivant, l'agroalimentaire provençal et le commerce. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  seoHook: "festival & agro provençal",
  ecosystemFr:
    "Avignon, cité des Papes classée UNESCO, vit au rythme du tourisme patrimonial autour du Palais des Papes et du Pont d'Avignon, et de son Festival mondialement connu doublé du Off, qui font exploser l'activité chaque été. Le tissu de TPE et PME couvre l'hôtellerie, la restauration, le spectacle vivant, l'agroalimentaire provençal (technopole Agroparc) et le commerce.",
  ecosystemEn:
    "Avignon, cité des Papes classée UNESCO, vit au rythme du tourisme patrimonial autour du Palais des Papes et du Pont d'Avignon, et de son Festival mondialement connu doublé du Off, qui font exploser l'activité chaque été. Le tissu de TPE et PME couvre l'hôtellerie, la restauration, le spectacle vivant, l'agroalimentaire provençal (technopole Agroparc) et le commerce.",
  distancesFr:
    "La gare d'Avignon TGV est à environ 5 km du centre (Paris en 2h40, Marseille en 35 min). L'aéroport d'Avignon-Provence et l'A7 / A9 desservent l'agglomération.",
  distancesEn:
    "La gare d'Avignon TGV est à environ 5 km du centre (Paris en 2h40, Marseille en 35 min). L'aéroport d'Avignon-Provence et l'A7 / A9 desservent l'agglomération.",
  topSectorsNaf: [
    "Tourisme culturel et patrimonial",
    "Hôtellerie et restauration",
    "Spectacle vivant et événementiel (Festival, Off)",
    "Agroalimentaire provençal (Agroparc)",
    "Commerce de détail et de proximité",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Avignon pour hôtels, compagnies du Festival, acteurs agroalimentaires et commerces : nous identifions les leviers (réservations, billetterie, pics du Off, traçabilité, administratif) et chiffrons le ROI. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Avignon pour hôtels, compagnies du Festival, acteurs agroalimentaires et commerces : nous identifions les leviers (réservations, billetterie, pics du Off, traçabilité, administratif) et chiffrons le ROI. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Avignon : formats adaptés à l'hôtel, à la compagnie de spectacle, à l'agroalimentaire ou au commerce. Vos collaborateurs gèrent ensuite les outils en autonomie.",
      en: "Interventions IA sur site à Avignon : formats adaptés à l'hôtel, à la compagnie de spectacle, à l'agroalimentaire ou au commerce. Vos collaborateurs gèrent ensuite les outils en autonomie.",
    },
    implementation: {
      fr: "Implémentation IA à Avignon : gestion des réservations et de la billetterie, agents conversationnels multilingues pour le tourisme, gestion des pics du Festival et du Off, traçabilité agroalimentaire et automatisation administrative.",
      en: "Implémentation IA à Avignon : gestion des réservations et de la billetterie, agents conversationnels multilingues pour le tourisme, gestion des pics du Festival et du Off, traçabilité agroalimentaire et automatisation administrative.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Avignon pour dirigeants de TPE et PME du tourisme, du spectacle, de l'agroalimentaire ou du commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA en restant autonome.",
      en: "Coaching 1-to-1 à Avignon pour dirigeants de TPE et PME du tourisme, du spectacle, de l'agroalimentaire ou du commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA en restant autonome.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Avignon : plateformes de réservation et de billetterie, vitrines multilingues pour le tourisme culturel, et outils IA pour l'agroalimentaire provençal et le commerce.",
      en: "Sites web augmentés à Avignon : plateformes de réservation et de billetterie, vitrines multilingues pour le tourisme culturel, et outils IA pour l'agroalimentaire provençal et le commerce.",
    },
  },
  services: {
    interventions: {
      fr: {
        hero: "Les formations IA en entreprise d'Axion-IA à Avignon se déroulent sur site, dans vos locaux, du format de quatre heures aux deux journées. Vos collaborateurs ne repartent pas avec un jeu de slides : ils repartent avec des outils IA installés sur leur poste et configurés pour leur travail réel — réservation d'hôtel, billetterie de compagnie du Off, traçabilité agroalimentaire ou gestion de commerce. Nous calibrons chaque session sur les contraintes locales d'Avignon, à commencer par le pic d'été du Festival In et du Off, et par les exigences de la filière agroalimentaire d'Agroparc. La Formation 4 heures démarre à {{price:intervention-4h|flat}} ; les formats Essentielle, Gagner du temps, Approfondie, Conférence et Dirigeant complètent la gamme selon la taille de vos équipes et votre objectif.",
        whyHere: [
          "Avignon, cité des Papes classée UNESCO, concentre un tissu de TPE et PME du tourisme patrimonial (Palais des Papes, Pont Saint-Bénézet), de l'hôtellerie, de la restauration et du commerce : autant de métiers où l'IA s'apprend mieux sur des cas concrets que sur des exemples génériques.",
          "Le Festival d'Avignon impose une saisonnalité forte : le In réunit environ 130 000 spectateurs et le Off environ 1 780 spectacles répartis sur 248 lieux (chiffres 60e édition). Nous formons vos équipes aux usages utiles pendant ce pic de juillet — réponses multilingues, gestion des réservations et de la billetterie, suivi des demandes.",
          "La filière agroalimentaire provençale d'Agroparc, première zone d'activité du Vaucluse (~600 établissements, ~6 500 emplois) avec INRAE, Givaudan France Naturals et McCormick France, demande un vocabulaire précis : traçabilité, contrôle qualité, recherche documentaire. Nos sessions ajustent les exemples à ce contexte.",
          "Le format collectif d'une journée convient aux structures avignonnaises de quelques personnes à une trentaine de collaborateurs : hôtels, compagnies, cabinets, commerces et PME de terroir.",
          "Le format Conférence s'adresse aux plénières d'entreprise et aux événements professionnels ; le format Dirigeant permet un cadrage en huis-clos pour les directions de TPE et PME du Vaucluse.",
          "Avignon est accessible et facile à desservir en présentiel : la gare TGV est à environ 5 km du centre (Paris en 2h40, Marseille en 35 min), avec l'aéroport d'Avignon-Provence et les axes A7 / A9.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre direction ou votre RH pour cibler le profil des participants, votre secteur (tourisme, hôtellerie, spectacle vivant, agroalimentaire, commerce) et les cas d'usage prioritaires. Pour les acteurs de l'été, on identifie d'emblée les usages liés au Festival et au Off.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité avignonnaise — demandes de réservation, emails clients, fiches produit, programmes de spectacle, fiches qualité — pour calibrer les démonstrations sur VOS données réelles plutôt que sur des exemples abstraits.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection et accès Wi-Fi. Objectif : aucun aléa technique le jour de la session, que vous soyez un hôtel du centre, une compagnie ou une entreprise d'Agroparc.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format retenu — 4 heures, journée Essentielle, Gagner du temps, ou deux jours Approfondie — alternance de théorie courte et de démonstrations longues sur vos données, suivies d'ateliers pratiques adaptés à votre métier à Avignon.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec ses outils IA installés et configurés pour son cas d'usage. L'objectif est qu'ils soient utilisables dès le lendemain matin, sans dépendance à Axion-IA, avec un temps de débrief pour répondre aux dernières questions.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Formation 4 heures",
            detail:
              "La Formation 4 heures à {{price:intervention-4h|flat}}, pour 2 à 30 personnes, convient aux indépendants, hôtels, restaurants, commerces et compagnies du Off d'Avignon qui veulent une première mise en main concrète sur leurs propres dossiers.",
          },
          {
            sizeLabel: "PME",
            price: "Essentielle ou Gagner du temps",
            detail:
              "La journée Essentielle (2 à 30 personnes) pour former un groupe entier, ou Gagner du temps (1 jour) pour focaliser sur un département — accueil, réservation, qualité, administratif — d'une PME avignonnaise du tourisme ou de l'agroalimentaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Approfondie ou Conférence",
            detail:
              "Le format Approfondie sur deux journées pour aller plus loin avec plusieurs équipes, ou le format Conférence (sur devis) pour une plénière à destination de grandes audiences sur un site structurant du Vaucluse.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Dirigeant et combinaisons",
            detail:
              "Le format Dirigeant (1 jour) pour cadrer la trajectoire IA en comité de direction, combinable avec des sessions équipes pour les acteurs d'Agroparc (type INRAE, Givaudan France Naturals, McCormick France) ou un programme multi-formats.",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une formation IA Axion-IA à Avignon ?",
            a: "Cela dépend du format. La Formation 4 heures tient sur une demi-journée. Les formats Essentielle, Gagner du temps et Dirigeant se déroulent sur une journée. Le format Approfondie s'étale sur deux journées. La Conférence est calée selon votre événement. Le rythme exact est défini ensemble lors du cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "La Formation 4 heures comme la journée Essentielle accueillent jusqu'à 30 personnes. Au-delà, le format Conférence avec un schéma plénière suivi d'ateliers en sous-groupes est plus adapté, par exemple pour un événement d'entreprise à Avignon.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la formation ?",
            a: "Oui. Ce sont des comptes individuels, gratuits ou avec abonnement employé, sur des outils comme ChatGPT, Claude, Mistral, Notion AI, Gamma ou Perplexity selon le profil. Vous gardez la main : aucun verrou technologique ni dépendance à Axion-IA après la session.",
          },
          {
            q: "Adaptez-vous le contenu au tourisme, au spectacle ou à l'agroalimentaire ?",
            a: "Oui, systématiquement. Le cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un hôtel ou une compagnie du Off n'a rien à voir avec une session pour une entreprise agroalimentaire d'Agroparc travaillant la traçabilité et le contrôle qualité.",
          },
          {
            q: "Vos formations sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT et s'intègrent dans votre plan de développement des compétences. Votre service RH ou comptable peut les traiter comme une prestation de conseil. Nous fournissons les pièces utiles à votre dossier.",
          },
          {
            q: "Comment l'IA aide-t-elle pendant le Festival d'Avignon et le Off ?",
            a: "Pendant le pic de juillet, l'IA aide à gérer l'afflux de demandes : réponses multilingues, suivi des réservations et de la billetterie, tri des emails et préparation des contenus. Nous formons vos équipes à ces usages concrets pour absorber la saison sans surcharge.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de votre réservation. En cas de problème technique de notre fait, la session est reportée avec compensation. Nous visons des outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, une séance de remédiation est prévue. Le vocabulaire et les exemples sont ajustés à votre métier à Avignon — tourisme, hôtellerie, spectacle, agroalimentaire ou commerce — sans session générique recyclée. Tarifs publics annoncés à l'avance, sans devis opaque.",
      },
      en: {
        hero: "Les formations IA en entreprise d'Axion-IA à Avignon se déroulent sur site, dans vos locaux, du format de quatre heures aux deux journées. Vos collaborateurs ne repartent pas avec un jeu de slides : ils repartent avec des outils IA installés sur leur poste et configurés pour leur travail réel — réservation d'hôtel, billetterie de compagnie du Off, traçabilité agroalimentaire ou gestion de commerce. Nous calibrons chaque session sur les contraintes locales d'Avignon, à commencer par le pic d'été du Festival In et du Off, et par les exigences de la filière agroalimentaire d'Agroparc. La Formation 4 heures démarre à {{price:intervention-4h|flat}} ; les formats Essentielle, Gagner du temps, Approfondie, Conférence et Dirigeant complètent la gamme selon la taille de vos équipes et votre objectif.",
        whyHere: [
          "Avignon, cité des Papes classée UNESCO, concentre un tissu de TPE et PME du tourisme patrimonial (Palais des Papes, Pont Saint-Bénézet), de l'hôtellerie, de la restauration et du commerce : autant de métiers où l'IA s'apprend mieux sur des cas concrets que sur des exemples génériques.",
          "Le Festival d'Avignon impose une saisonnalité forte : le In réunit environ 130 000 spectateurs et le Off environ 1 780 spectacles répartis sur 248 lieux (chiffres 60e édition). Nous formons vos équipes aux usages utiles pendant ce pic de juillet — réponses multilingues, gestion des réservations et de la billetterie, suivi des demandes.",
          "La filière agroalimentaire provençale d'Agroparc, première zone d'activité du Vaucluse (~600 établissements, ~6 500 emplois) avec INRAE, Givaudan France Naturals et McCormick France, demande un vocabulaire précis : traçabilité, contrôle qualité, recherche documentaire. Nos sessions ajustent les exemples à ce contexte.",
          "Le format collectif d'une journée convient aux structures avignonnaises de quelques personnes à une trentaine de collaborateurs : hôtels, compagnies, cabinets, commerces et PME de terroir.",
          "Le format Conférence s'adresse aux plénières d'entreprise et aux événements professionnels ; le format Dirigeant permet un cadrage en huis-clos pour les directions de TPE et PME du Vaucluse.",
          "Avignon est accessible et facile à desservir en présentiel : la gare TGV est à environ 5 km du centre (Paris en 2h40, Marseille en 35 min), avec l'aéroport d'Avignon-Provence et les axes A7 / A9.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre direction ou votre RH pour cibler le profil des participants, votre secteur (tourisme, hôtellerie, spectacle vivant, agroalimentaire, commerce) et les cas d'usage prioritaires. Pour les acteurs de l'été, on identifie d'emblée les usages liés au Festival et au Off.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité avignonnaise — demandes de réservation, emails clients, fiches produit, programmes de spectacle, fiches qualité — pour calibrer les démonstrations sur VOS données réelles plutôt que sur des exemples abstraits.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection et accès Wi-Fi. Objectif : aucun aléa technique le jour de la session, que vous soyez un hôtel du centre, une compagnie ou une entreprise d'Agroparc.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format retenu — 4 heures, journée Essentielle, Gagner du temps, ou deux jours Approfondie — alternance de théorie courte et de démonstrations longues sur vos données, suivies d'ateliers pratiques adaptés à votre métier à Avignon.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec ses outils IA installés et configurés pour son cas d'usage. L'objectif est qu'ils soient utilisables dès le lendemain matin, sans dépendance à Axion-IA, avec un temps de débrief pour répondre aux dernières questions.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Formation 4 heures",
            detail:
              "La Formation 4 heures à {{price:intervention-4h|flat}}, pour 2 à 30 personnes, convient aux indépendants, hôtels, restaurants, commerces et compagnies du Off d'Avignon qui veulent une première mise en main concrète sur leurs propres dossiers.",
          },
          {
            sizeLabel: "PME",
            price: "Essentielle ou Gagner du temps",
            detail:
              "La journée Essentielle (2 à 30 personnes) pour former un groupe entier, ou Gagner du temps (1 jour) pour focaliser sur un département — accueil, réservation, qualité, administratif — d'une PME avignonnaise du tourisme ou de l'agroalimentaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Approfondie ou Conférence",
            detail:
              "Le format Approfondie sur deux journées pour aller plus loin avec plusieurs équipes, ou le format Conférence (sur devis) pour une plénière à destination de grandes audiences sur un site structurant du Vaucluse.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Dirigeant et combinaisons",
            detail:
              "Le format Dirigeant (1 jour) pour cadrer la trajectoire IA en comité de direction, combinable avec des sessions équipes pour les acteurs d'Agroparc (type INRAE, Givaudan France Naturals, McCormick France) ou un programme multi-formats.",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une formation IA Axion-IA à Avignon ?",
            a: "Cela dépend du format. La Formation 4 heures tient sur une demi-journée. Les formats Essentielle, Gagner du temps et Dirigeant se déroulent sur une journée. Le format Approfondie s'étale sur deux journées. La Conférence est calée selon votre événement. Le rythme exact est défini ensemble lors du cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "La Formation 4 heures comme la journée Essentielle accueillent jusqu'à 30 personnes. Au-delà, le format Conférence avec un schéma plénière suivi d'ateliers en sous-groupes est plus adapté, par exemple pour un événement d'entreprise à Avignon.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la formation ?",
            a: "Oui. Ce sont des comptes individuels, gratuits ou avec abonnement employé, sur des outils comme ChatGPT, Claude, Mistral, Notion AI, Gamma ou Perplexity selon le profil. Vous gardez la main : aucun verrou technologique ni dépendance à Axion-IA après la session.",
          },
          {
            q: "Adaptez-vous le contenu au tourisme, au spectacle ou à l'agroalimentaire ?",
            a: "Oui, systématiquement. Le cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un hôtel ou une compagnie du Off n'a rien à voir avec une session pour une entreprise agroalimentaire d'Agroparc travaillant la traçabilité et le contrôle qualité.",
          },
          {
            q: "Vos formations sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT et s'intègrent dans votre plan de développement des compétences. Votre service RH ou comptable peut les traiter comme une prestation de conseil. Nous fournissons les pièces utiles à votre dossier.",
          },
          {
            q: "Comment l'IA aide-t-elle pendant le Festival d'Avignon et le Off ?",
            a: "Pendant le pic de juillet, l'IA aide à gérer l'afflux de demandes : réponses multilingues, suivi des réservations et de la billetterie, tri des emails et préparation des contenus. Nous formons vos équipes à ces usages concrets pour absorber la saison sans surcharge.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de votre réservation. En cas de problème technique de notre fait, la session est reportée avec compensation. Nous visons des outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, une séance de remédiation est prévue. Le vocabulaire et les exemples sont ajustés à votre métier à Avignon — tourisme, hôtellerie, spectacle, agroalimentaire ou commerce — sans session générique recyclée. Tarifs publics annoncés à l'avance, sans devis opaque.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Avignon des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Deux réalités locales dictent le cahier des charges — le pic d'été du Festival (In et Off) et la filière agroalimentaire/ingrédients naturels d'Agroparc. Devis à partir de 48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Avignon, itérations à distance.",
        whyHere: [
          "Projets web & SaaS adaptés au tissu d'Avignon : hôtels et acteurs du tourisme patrimonial (Palais des Papes, Pont Saint-Bénézet), compagnies et lieux du Festival Off (réservation type Ticket'Off, AF&C), e-commerce de terroir et viticulture.",
          "Filière agroalimentaire et ingrédients naturels d'Agroparc (INRAE, Givaudan France Naturals ex-Naturex, McCormick France) : portails B2B, configurateurs produits, traçabilité et recherche documentaire augmentée — pas seulement une vitrine.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — et e-commerce multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop), pas seulement la brique IA.",
          "Saisonnalité extrême maîtrisée : sites et plateformes dimensionnés pour absorber les pics de juillet (Festival In ~130 000 spectateurs, Off ~1 780 spectacles sur 248 lieux) sans tomber, puis revenir en charge normale le reste de l'année.",
        ],
        methodology: [
          {
            step: "Cadrage à Avignon",
            detail:
              "Atelier sur site : objectifs, parcours utilisateurs, audit de la stack et des contenus. On qualifie d'emblée la contrainte locale (pic d'été touristique/Festival ou exigences agroalimentaires d'Agroparc). Devis ferme à partir de 48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; pour le tourisme et le Off, parcours de réservation multilingue testé avant tout développement.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : chatbot RAG multilingue, billetterie/réservation, recherche sémantique, agents, e-commerce de terroir. Démos hebdomadaires.",
          },
          {
            step: "Recette + montée en charge",
            detail:
              "Tests d'acceptation, Web Vitals et SEO/AEO validés, et test de charge pensé pour le pic de juillet ; mise en production sans downtime.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code, bases et modèles livrés chez vous (hébergement UE possible). Aucun abonnement imposé : vos équipes gèrent les outils en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Brique IA greffée",
            detail:
              "Ajout d'une brique IA (chatbot RAG multilingue, recherche sémantique) sur le site existant d'un hôtel, d'un restaurant ou d'une compagnie du Off, en quelques semaines, sans refonte.",
          },
          {
            sizeLabel: "PME",
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée : réservation/billetterie pour le tourisme et le Festival, e-commerce de terroir et viticulture des Côtes du Rhône.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Portail métier ou plateforme client sur mesure pour l'agroalimentaire et les ingrédients naturels d'Agroparc (catalogues B2B, traçabilité, recherche documentaire), branché sur votre SI (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels pour acteurs structurants (type INRAE, Givaudan France Naturals, McCormick France) : refonte de plateformes, design system d'entreprise, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Comment gérez-vous le pic d'été du Festival d'Avignon et du Off ?",
            a: "On dimensionne et on teste les sites et plateformes pour le mois de juillet : le In réunit ~130 000 spectateurs et le Off ~1 780 spectacles répartis sur 248 lieux (chiffres 60e édition). Concrètement : parcours de réservation/billetterie multilingue, file d'attente et cache pour absorber les pics, puis retour en charge normale le reste de l'année. Aucune surfacturation cachée liée à la saison.",
          },
          {
            q: "Travaillez-vous avec l'agroalimentaire et les ingrédients naturels d'Agroparc ?",
            a: "Oui. Agroparc est la 1re zone d'activité du Vaucluse (~600 établissements, ~6 500 emplois) avec INRAE, Givaudan France Naturals (ex-Naturex), McCormick France et d'autres. On y construit des portails B2B, des configurateurs produits, de la traçabilité et de la recherche documentaire augmentée par IA, hébergés en UE et conformes RGPD.",
          },
          {
            q: "Faites-vous vraiment l'UX/UI et le design, pas seulement l'IA ?",
            a: "Oui. On conçoit l'expérience complète à Avignon — research, wireframes, design system, maquettes Figma, prototype — pour un site touristique, une billetterie de compagnie ou une plateforme agroalimentaire, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Peut-on augmenter un site existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API. Aucune refonte ni downtime — utile pour un hôtel ou une compagnie qui ne veut pas tout casser avant juillet.",
          },
          {
            q: "Avec quelles technologies et quels CMS travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento pour l'e-commerce de terroir et la viticulture, et Next.js, Laravel, Django, React, Vue, Angular pour les plateformes sur mesure. On s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 48 h selon la complexité) : pas de dérive horaire cachée, pas de surcoût « saison Festival ». Mise en ligne sans downtime quand on augmente l'existant. Web Vitals, accessibilité et test de charge contrôlés à la livraison, en particulier pour absorber le pic de juillet. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD et AI Act : propriété totale, aucun abonnement imposé, transférable à tout prestataire du Vaucluse ou repris en interne.",
      },
      en: {
        hero: "In Avignon, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Two local realities drive the spec — the summer peak of the Festival (In and Off) and the food/natural-ingredients cluster of Agroparc. Quote from 48 h depending on project complexity, EU hosting, code and data yours. On-site Avignon kick-off, remote iterations.",
        whyHere: [
          "Web & SaaS projects tuned to Avignon's fabric: hotels and heritage-tourism players (Palais des Papes, Pont Saint-Bénézet), companies and venues of the Festival Off (Ticket'Off-style booking, AF&C), local-produce e-commerce and Côtes du Rhône wine.",
          "Agroparc food and natural-ingredients cluster (INRAE, Givaudan France Naturals ex-Naturex, McCormick France): B2B portals, product configurators, traceability and AI-augmented document search — not just a showcase site.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — and multi-CMS e-commerce (WordPress, Shopify, WooCommerce, PrestaShop), not only the AI brick.",
          "Extreme seasonality handled: sites and platforms sized to absorb the July peak (Festival In ~130,000 spectators, Off ~1,780 shows across 248 venues) without going down, then back to normal load the rest of the year.",
        ],
        methodology: [
          {
            step: "Scoping in Avignon",
            detail:
              "On-site workshop: goals, user journeys, audit of the existing stack and content. We qualify the local constraint up front (summer tourism/Festival peak or Agroparc food-industry requirements). Firm quote from 48 h depending on complexity.",
          },
          {
            step: "UX/UI design",
            detail:
              "Wireframes, design system and Figma mockups in your brand; for tourism and the Off, a multilingual booking journey tested before any development.",
          },
          {
            step: "Sprint development",
            detail:
              "AI graft on the existing site or AI-native build: multilingual RAG chatbot, ticketing/booking, semantic search, agents, local-produce e-commerce. Weekly demos.",
          },
          {
            step: "Acceptance + load ramp-up",
            detail:
              "Acceptance tests, Web Vitals and SEO/AEO validated, plus a load test designed for the July peak; production release with no downtime.",
          },
          {
            step: "Delivery + autonomy",
            detail:
              "Code, databases and models delivered to you (EU hosting available). No imposed subscription: your teams run the tools independently.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Grafted AI brick",
            detail:
              "Adding an AI brick (multilingual RAG chatbot, semantic search) to the existing site of a hotel, restaurant or Off company, within a few weeks, with no rebuild.",
          },
          {
            sizeLabel: "PME",
            price: "Bespoke site / application",
            detail:
              "Design or rebuild of a site or application with UX/UI and built-in AI: booking/ticketing for tourism and the Festival, local-produce and Côtes du Rhône wine e-commerce.",
          },
          {
            sizeLabel: "ETI",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business portal or client platform for Agroparc's food and natural-ingredients sector (B2B catalogues, traceability, document search), plugged into your IS (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Product programme",
            detail:
              "Multi-year programmes for structuring players (such as INRAE, Givaudan France Naturals, McCormick France): platform rebuilds, enterprise design system, dedicated Axion-IA team in product mode.",
          },
        ],
        faq: [
          {
            q: "How do you handle the summer peak of the Avignon Festival and the Off?",
            a: "We size and load-test sites and platforms for July: the In gathers ~130,000 spectators and the Off ~1,780 shows across 248 venues (60th-edition figures). Concretely: multilingual booking/ticketing journeys, queueing and caching to absorb peaks, then back to normal load the rest of the year. No hidden season-related surcharge.",
          },
          {
            q: "Do you work with Agroparc's food and natural-ingredients industry?",
            a: "Yes. Agroparc is Vaucluse's leading business zone (~600 establishments, ~6,500 jobs) with INRAE, Givaudan France Naturals (ex-Naturex), McCormick France and others. We build B2B portals, product configurators, traceability and AI-augmented document search there, hosted in the EU and GDPR-compliant.",
          },
          {
            q: "Do you really do UX/UI and design, not just AI?",
            a: "Yes. We design the full experience in Avignon — research, wireframes, design system, Figma mockups, prototype — for a tourism site, a company ticketing system or a food-industry platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Can an existing site be augmented without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft AI bricks via an API, widget or plugin, without touching the design or structure, as long as your CMS exposes an API. No rebuild and no downtime — useful for a hotel or company that doesn't want to break everything before July.",
          },
          {
            q: "Which technologies and CMS do you work with?",
            a: "Any modern API-exposing stack: WordPress, Shopify, WooCommerce, PrestaShop, Magento for local-produce and wine e-commerce, and Next.js, Laravel, Django, React, Vue, Angular for bespoke platforms. We adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm fixed-price quote (from 48 h depending on complexity): no hidden hourly drift, no 'Festival season' surcharge. Release with no downtime when augmenting the existing site. Web Vitals, accessibility and load testing checked at delivery, in particular to absorb the July peak. Source code, databases and models delivered into your infrastructure (EU hosting available), GDPR- and AI-Act-compliant: full ownership, no imposed subscription, transferable to any Vaucluse provider or brought in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il à Avignon et dans le Vaucluse ?",
      a: "Oui, Axion-IA accompagne les TPE et PME d'Avignon et de l'agglomération vauclusienne. Nous nous déplaçons sur site et travaillons aussi en visio.",
    },
    {
      q: "Comment l'IA aide pendant le Festival d'Avignon et le Off ?",
      a: "Gestion des pics de réservation, agents conversationnels multilingues, billetterie automatisée et yield hôtelier pendant l'été. Chaque piste est chiffrée en ROI dans l'Audit sur place pour absorber l'afflux du Festival.",
    },
    {
      q: "Quel est le tarif d'un audit IA à Avignon ?",
      a: "L'Audit sur place sur mesure démarre à {{price:audit-flash|flat}} et la Formation 4 h à {{price:intervention-4h|flat}}. Tarifs publics, sans devis opaque ; les implémentations sont chiffrées au cas par cas selon le ROI identifié.",
    },
    {
      q: "Accompagnez-vous l'agroalimentaire provençal d'Agroparc ?",
      a: "Oui, traçabilité, contrôle qualité, prévision de la demande et automatisation administrative pour les PME agroalimentaires d'Avignon et du technopole Agroparc. Cible prioritaire TPE et PME.",
    },
    {
      q: "Vos solutions IA sont-elles conformes au RGPD ?",
      a: "Oui, chaque solution déployée à Avignon respecte le RGPD et l'AI Act. Vos données clients, de billetterie et de production restent maîtrisées, sans verrou technologique ni dépendance à un prestataire unique.",
    },
  ],
};
