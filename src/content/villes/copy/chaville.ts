// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 #2 (qs moyen → premium).
// Chaville (92, Hauts-de-Seine) — résidentiel aisé, forêt de Meudon-Fausses-Reposes, axe Paris-Versailles.

import type { VilleCopy } from "./types";

export const CHAVILLE_COPY: VilleCopy = {
  pitchFr:
    "Chaville (92), commune résidentielle des Hauts-de-Seine nichée entre la forêt de Meudon et le bois de Fausses-Reposes sur l'axe Paris-Versailles, abrite un tissu dense de PME et ETI : commerce de proximité, services aux particuliers et aux entreprises, professions libérales, conseil et petites activités tech. Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne en priorité ces les PME puis les ETI chavilloises, plus rarement les grands groupes, pour intégrer une IA concrète et rentable sans jargon ni dépendance technique.",
  pitchEn:
    "Chaville (92), commune résidentielle des Hauts-de-Seine nichée entre la forêt de Meudon et le bois de Fausses-Reposes sur l'axe Paris-Versailles, abrite un tissu dense de PME et ETI : commerce de proximité, services aux particuliers et aux entreprises, professions libérales, conseil et petites activités tech. Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne en priorité ces les PME puis les ETI chavilloises, plus rarement les grands groupes, pour intégrer une IA concrète et rentable sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Chaville (92) auprès des PME et ETI : commerces de proximité, services aux particuliers et aux entreprises, professions libérales, conseil et PME tech. Nous diagnostiquons les tâches automatisables, déployons des outils IA fiables et formons vos équipes, sans dépendance technique. Les grands groupes sont accompagnés en complément.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Chaville (92) auprès des PME et ETI : commerces de proximité, services aux particuliers et aux entreprises, professions libérales, conseil et PME tech. Nous diagnostiquons les tâches automatisables, déployons des outils IA fiables et formons vos équipes, sans dépendance technique. Les grands groupes sont accompagnés en complément.",
  seoHook: "services & professions libérales",
  ecosystemFr:
    "Chaville, commune résidentielle aisée des Hauts-de-Seine entre la forêt de Meudon et le bois de Fausses-Reposes, se situe sur l'axe stratégique Paris-Versailles. Son économie repose sur un commerce de proximité actif, des services aux particuliers et aux entreprises, de nombreuses professions libérales, du conseil indépendant et de petites activités tech portées par des cadres et entrepreneurs travaillant à Paris ou à La Défense. Ce tissu de PME et ETI de services constitue un terrain idéal pour une IA appliquée à la productivité et à la relation client.",
  ecosystemEn:
    "Chaville, commune résidentielle aisée des Hauts-de-Seine entre la forêt de Meudon et le bois de Fausses-Reposes, se situe sur l'axe stratégique Paris-Versailles. Son économie repose sur un commerce de proximité actif, des services aux particuliers et aux entreprises, de nombreuses professions libérales, du conseil indépendant et de petites activités tech portées par des cadres et entrepreneurs travaillant à Paris ou à La Défense. Ce tissu de PME et ETI de services constitue un terrain idéal pour une IA appliquée à la productivité et à la relation client.",
  distancesFr:
    "Chaville est reliée à Paris-Montparnasse en 15 min par le Transilien et à Versailles en 10 min. La Défense est à 25 min, l'aéroport de Paris-Orly à 30 min par l'A86.",
  distancesEn:
    "Chaville est reliée à Paris-Montparnasse en 15 min par le Transilien et à Versailles en 10 min. La Défense est à 25 min, l'aéroport de Paris-Orly à 30 min par l'A86.",
  topSectorsNaf: [
    "Services aux entreprises et conseil",
    "Professions libérales",
    "Commerce de détail de proximité",
    "Services aux particuliers",
    "Programmation et activités tech",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Chaville : diagnostic des tâches automatisables pour professions libérales, conseil, commerces et services de proximité. Audit sur place dès {{price:audit-flash|flat}}, livrable priorisé.",
      en: "Audit IA à Chaville : diagnostic des tâches automatisables pour professions libérales, conseil, commerces et services de proximité. Audit sur place dès {{price:audit-flash|flat}}, livrable priorisé.",
    },
    interventions: {
      fr: "Interventions IA sur site à Chaville : ateliers pratiques pour cabinets, agences et commerces, afin de rendre vos équipes autonomes sur les outils IA du quotidien.",
      en: "Interventions IA sur site à Chaville : ateliers pratiques pour cabinets, agences et commerces, afin de rendre vos équipes autonomes sur les outils IA du quotidien.",
    },
    implementation: {
      fr: "Implémentation IA à Chaville : automatisation administrative, rédaction assistée, agents conversationnels et CRM augmenté pour PME et ETI de services et professions libérales.",
      en: "Implémentation IA à Chaville : automatisation administrative, rédaction assistée, agents conversationnels et CRM augmenté pour PME et ETI de services et professions libérales.",
    },
    unAUn: {
      fr: "Accompagnement un-à-un à Chaville : sessions sur site ou en visio pour dirigeants, indépendants et professions libérales, ciblées sur vos priorités de productivité.",
      en: "Accompagnement un-à-un à Chaville : sessions sur site ou en visio pour dirigeants, indépendants et professions libérales, ciblées sur vos priorités de productivité.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Chaville : vitrine ou portail client avec IA intégrée (prise de rendez-vous, FAQ, devis) pour cabinets, commerces et services de proximité.",
      en: "Sites web augmentés à Chaville : vitrine ou portail client avec IA intégrée (prise de rendez-vous, FAQ, devis) pour cabinets, commerces et services de proximité.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Chaville des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure et mobile-first, e-commerce multi-CMS, prise de rendez-vous en ligne, chatbot RAG multilingue ancré sur vos contenus, recherche sémantique, agents et automatisations. Pensé pour une commune résidentielle aisée des Hauts-de-Seine, lovée entre la forêt de Meudon et le bois de Fausses-Reposes sur l'axe Paris-Versailles (la D910, ex-RN10, traverse la ville), où le tissu est fait de PME et ETI de services : professions libérales, conseil indépendant, commerce de proximité du marché et de la Place du Marché, structures culturelles comme l'Atrium, et petites activités tech portées par des cadres travaillant à Paris ou à La Défense. Devis à partir de 24-48 h selon la complexité, hébergement UE, code et données à vous. Kick-off en présentiel à Chaville, itérations à distance.",
        whyHere: [
          "Forte densité de professions libérales — avocats, experts-comptables, notaires de l'office de la Place du Marché, médecins, consultants : on construit des portails de prise de rendez-vous, des espaces clients sécurisés et des assistants IA RAG qui rédigent comptes rendus, actes et relances administratives à partir de vos seuls documents, sans dérive RGPD ni fuite hors UE.",
          "Conseil indépendant et petites activités tech portés par des cadres pendulaires entre Chaville, Paris et La Défense (Montparnasse à 15 min par le Transilien, La Défense à 25 min, Versailles à 10 min) : on greffe l'IA sur l'existant via widget, API ou plugin, ou on bâtit une plateforme SaaS métier mobile-first pour des dirigeants souvent en déplacement, branchée sur leur CRM ou leur ERP.",
          "Commerce de proximité et services aux particuliers autour du marché de Chaville, de la Place du Marché et de l'avenue Roger Salengro, animés par l'association des commerçants : vitrines e-commerce multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop, Magento), agents conversationnels pour devis, plannings et click-and-collect, et présence locale enrichie pour capter une clientèle résidentielle exigeante.",
          "Acteurs culturels et de la vie locale comme l'Atrium de Chaville (cinéma et salle de 638 places sur la D910, partenaire du SEL de Sèvres) : billetterie et réservation en ligne fluides, recherche sémantique de la programmation, newsletters et agents d'information, toute la chaîne hébergeable en Europe, conforme RGPD et AI Act, données et code restant maîtrisés sans transit hors UE.",
        ],
        methodology: [
          {
            step: "Cadrage à Chaville",
            detail:
              "Atelier sur site, dans le cœur de ville le long de l'avenue Roger Salengro ou près des gares Chaville-Rive Gauche et Chaville-Rive Droite : objectifs, parcours utilisateurs, audit de la stack, des contenus et des contraintes métier d'un cabinet, d'un commerce du marché ou d'une structure culturelle. Devis ferme remis à partir de 24-48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; prototype cliquable testé avant tout développement, pensé mobile-first et accessible pour une clientèle chavilloise souvent connectée en déplacement entre Paris-Montparnasse et Versailles. Validation des parcours clés avant d'écrire la première ligne de code.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : espace client, boutique e-commerce multi-CMS, prise de rendez-vous, chatbot RAG multilingue ancré sur vos contenus, recherche sémantique, agents et automatisations administratives. Démos hebdomadaires en visio, code versionné et livré au fil de l'eau, sans boîte noire.",
          },
          {
            step: "Recette + mise en ligne",
            detail:
              "Tests d'acceptation, Web Vitals (LCP, INP, CLS) et SEO/AEO validés, accessibilité contrôlée, puis mise en production sans downtime — sans interrompre l'activité d'un cabinet libéral chavillois, d'un commerce du marché ou de la billetterie d'un lieu culturel en pleine saison.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code source, bases et modèles livrés chez vous, hébergement UE possible. On forme vos équipes pour qu'elles pilotent l'outil en autonomie, sans verrou ni abonnement imposé. Documentation remise, projet transférable à tout moment à un prestataire de l'ouest parisien ou repris en interne.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Site / vitrine e-commerce sur mesure",
            detail:
              "Conception ou refonte d'un site, d'un portail client ou d'une boutique avec UX/UI et IA intégrée pour les PME de services et de conseil chavilloises, les agences immobilières de la Place du Marché ou les structures culturelles : devis automatisés, espace client, billetterie, multilingue.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier ou portail client sur mesure pour les acteurs structurants de l'ouest parisien (Sèvres, Viroflay, Vélizy, Ville-d'Avray), IA intégrée, branchée sur votre SI — CRM, ERP, outils RH ou de réservation existants.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels pour les grands employeurs et opérateurs de la zone Paris-Versailles et de la D910 : refonte de plateformes, design system, recherche sémantique à l'échelle, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Faites-vous l'UX/UI et l'e-commerce, pas seulement l'IA ?",
            a: "Oui, on fait tout. On conçoit l'expérience complète — research, wireframes, design system, maquettes Figma, prototype — pour un site vitrine, une boutique e-commerce ou un espace client, avec ou sans brique IA. Multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop, Magento) ou code 100 % sur mesure, du mobile-first jusqu'à la mise en production.",
          },
          {
            q: "Mes données clients restent-elles en Europe ?",
            a: "Oui. Toute la chaîne IA est hébergeable en UE, conforme RGPD et AI Act, sans transit hors UE sans DPA signé. Un point essentiel pour les cabinets libéraux et notariaux chavillois manipulant des dossiers confidentiels : vous gardez la propriété complète de vos données et de vos modèles, sans verrou ni dépendance à un fournisseur externe.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage sur place à Chaville, on remet un devis ferme en forfait fixe, périmètre et livrables détaillés. Le délai dépend de la complexité — à partir de 24-48 h pour un projet simple. Pas de régie, pas de dérive horaire cachée : le prix annoncé est le prix payé.",
          },
          {
            q: "Quel site IA pour une profession libérale de Chaville ?",
            a: "Pour un avocat, expert-comptable, notaire de la Place du Marché, médecin ou consultant : portail de prise de rendez-vous, espace client sécurisé, chatbot RAG répondant uniquement à partir de vos contenus, et automatisation de la rédaction de comptes rendus et des relances. Le tout mobile-first, hébergé en UE et calibré selon la taille de votre cabinet.",
          },
          {
            q: "Pouvez-vous créer une billetterie ou un site pour un commerce ou un lieu culturel chavillois ?",
            a: "Oui. Pour un commerçant du marché de Chaville, on bâtit une vitrine e-commerce avec click-and-collect, devis automatisés et agent conversationnel multilingue. Pour un lieu comme l'Atrium ou une association, on conçoit réservation et billetterie en ligne, recherche sémantique de la programmation et newsletters automatisées, le tout accessible, rapide (Web Vitals contrôlés) et hébergé en Europe.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (remis à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée, périmètre et livrables écrits noir sur blanc. Mise en ligne sans downtime quand on augmente un site existant, sans couper l'activité d'un cabinet, d'un commerce du marché ou d'une billetterie. Web Vitals (LCP, INP, CLS) et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD et AI Act : propriété totale, aucun verrou, aucun abonnement imposé, projet transférable à tout moment à un prestataire de l'ouest parisien ou repris en interne.",
      },
      en: {
        hero: "Axion-IA conçoit et augmente à Chaville des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure et mobile-first, e-commerce multi-CMS, prise de rendez-vous en ligne, chatbot RAG multilingue ancré sur vos contenus, recherche sémantique, agents et automatisations. Pensé pour une commune résidentielle aisée des Hauts-de-Seine, lovée entre la forêt de Meudon et le bois de Fausses-Reposes sur l'axe Paris-Versailles (la D910, ex-RN10, traverse la ville), où le tissu est fait de PME et ETI de services : professions libérales, conseil indépendant, commerce de proximité du marché et de la Place du Marché, structures culturelles comme l'Atrium, et petites activités tech portées par des cadres travaillant à Paris ou à La Défense. Devis à partir de 24-48 h selon la complexité, hébergement UE, code et données à vous. Kick-off en présentiel à Chaville, itérations à distance.",
        whyHere: [
          "Forte densité de professions libérales — avocats, experts-comptables, notaires de l'office de la Place du Marché, médecins, consultants : on construit des portails de prise de rendez-vous, des espaces clients sécurisés et des assistants IA RAG qui rédigent comptes rendus, actes et relances administratives à partir de vos seuls documents, sans dérive RGPD ni fuite hors UE.",
          "Conseil indépendant et petites activités tech portés par des cadres pendulaires entre Chaville, Paris et La Défense (Montparnasse à 15 min par le Transilien, La Défense à 25 min, Versailles à 10 min) : on greffe l'IA sur l'existant via widget, API ou plugin, ou on bâtit une plateforme SaaS métier mobile-first pour des dirigeants souvent en déplacement, branchée sur leur CRM ou leur ERP.",
          "Commerce de proximité et services aux particuliers autour du marché de Chaville, de la Place du Marché et de l'avenue Roger Salengro, animés par l'association des commerçants : vitrines e-commerce multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop, Magento), agents conversationnels pour devis, plannings et click-and-collect, et présence locale enrichie pour capter une clientèle résidentielle exigeante.",
          "Acteurs culturels et de la vie locale comme l'Atrium de Chaville (cinéma et salle de 638 places sur la D910, partenaire du SEL de Sèvres) : billetterie et réservation en ligne fluides, recherche sémantique de la programmation, newsletters et agents d'information, toute la chaîne hébergeable en Europe, conforme RGPD et AI Act, données et code restant maîtrisés sans transit hors UE.",
        ],
        methodology: [
          {
            step: "Cadrage à Chaville",
            detail:
              "Atelier sur site, dans le cœur de ville le long de l'avenue Roger Salengro ou près des gares Chaville-Rive Gauche et Chaville-Rive Droite : objectifs, parcours utilisateurs, audit de la stack, des contenus et des contraintes métier d'un cabinet, d'un commerce du marché ou d'une structure culturelle. Devis ferme remis à partir de 24-48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; prototype cliquable testé avant tout développement, pensé mobile-first et accessible pour une clientèle chavilloise souvent connectée en déplacement entre Paris-Montparnasse et Versailles. Validation des parcours clés avant d'écrire la première ligne de code.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : espace client, boutique e-commerce multi-CMS, prise de rendez-vous, chatbot RAG multilingue ancré sur vos contenus, recherche sémantique, agents et automatisations administratives. Démos hebdomadaires en visio, code versionné et livré au fil de l'eau, sans boîte noire.",
          },
          {
            step: "Recette + mise en ligne",
            detail:
              "Tests d'acceptation, Web Vitals (LCP, INP, CLS) et SEO/AEO validés, accessibilité contrôlée, puis mise en production sans downtime — sans interrompre l'activité d'un cabinet libéral chavillois, d'un commerce du marché ou de la billetterie d'un lieu culturel en pleine saison.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code source, bases et modèles livrés chez vous, hébergement UE possible. On forme vos équipes pour qu'elles pilotent l'outil en autonomie, sans verrou ni abonnement imposé. Documentation remise, projet transférable à tout moment à un prestataire de l'ouest parisien ou repris en interne.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Site / vitrine e-commerce sur mesure",
            detail:
              "Conception ou refonte d'un site, d'un portail client ou d'une boutique avec UX/UI et IA intégrée pour les PME de services et de conseil chavilloises, les agences immobilières de la Place du Marché ou les structures culturelles : devis automatisés, espace client, billetterie, multilingue.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier ou portail client sur mesure pour les acteurs structurants de l'ouest parisien (Sèvres, Viroflay, Vélizy, Ville-d'Avray), IA intégrée, branchée sur votre SI — CRM, ERP, outils RH ou de réservation existants.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels pour les grands employeurs et opérateurs de la zone Paris-Versailles et de la D910 : refonte de plateformes, design system, recherche sémantique à l'échelle, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Faites-vous l'UX/UI et l'e-commerce, pas seulement l'IA ?",
            a: "Oui, on fait tout. On conçoit l'expérience complète — research, wireframes, design system, maquettes Figma, prototype — pour un site vitrine, une boutique e-commerce ou un espace client, avec ou sans brique IA. Multi-CMS (WordPress, Shopify, WooCommerce, PrestaShop, Magento) ou code 100 % sur mesure, du mobile-first jusqu'à la mise en production.",
          },
          {
            q: "Mes données clients restent-elles en Europe ?",
            a: "Oui. Toute la chaîne IA est hébergeable en UE, conforme RGPD et AI Act, sans transit hors UE sans DPA signé. Un point essentiel pour les cabinets libéraux et notariaux chavillois manipulant des dossiers confidentiels : vous gardez la propriété complète de vos données et de vos modèles, sans verrou ni dépendance à un fournisseur externe.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage sur place à Chaville, on remet un devis ferme en forfait fixe, périmètre et livrables détaillés. Le délai dépend de la complexité — à partir de 24-48 h pour un projet simple. Pas de régie, pas de dérive horaire cachée : le prix annoncé est le prix payé.",
          },
          {
            q: "Quel site IA pour une profession libérale de Chaville ?",
            a: "Pour un avocat, expert-comptable, notaire de la Place du Marché, médecin ou consultant : portail de prise de rendez-vous, espace client sécurisé, chatbot RAG répondant uniquement à partir de vos contenus, et automatisation de la rédaction de comptes rendus et des relances. Le tout mobile-first, hébergé en UE et calibré selon la taille de votre cabinet.",
          },
          {
            q: "Pouvez-vous créer une billetterie ou un site pour un commerce ou un lieu culturel chavillois ?",
            a: "Oui. Pour un commerçant du marché de Chaville, on bâtit une vitrine e-commerce avec click-and-collect, devis automatisés et agent conversationnel multilingue. Pour un lieu comme l'Atrium ou une association, on conçoit réservation et billetterie en ligne, recherche sémantique de la programmation et newsletters automatisées, le tout accessible, rapide (Web Vitals contrôlés) et hébergé en Europe.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (remis à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée, périmètre et livrables écrits noir sur blanc. Mise en ligne sans downtime quand on augmente un site existant, sans couper l'activité d'un cabinet, d'un commerce du marché ou d'une billetterie. Web Vitals (LCP, INP, CLS) et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD et AI Act : propriété totale, aucun verrou, aucun abonnement imposé, projet transférable à tout moment à un prestataire de l'ouest parisien ou repris en interne.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il à Chaville ?",
      a: "Oui, Axion-IA intervient à Chaville et dans l'ouest parisien (Sèvres, Viroflay, Vélizy, Ville-d'Avray). Nos experts IA seniors se déplacent sur site ou travaillent en visio.",
    },
    {
      q: "Quel est le tarif d'un audit IA à Chaville ?",
      a: "L'Audit sur place démarre à {{price:audit-flash|flat}}, avec une grille tarifaire publique. Il est adapté aux PME et ETI chavilloises : professions libérales, conseil, commerces et services de proximité.",
    },
    {
      q: "Comment l'IA aide-t-elle les professions libérales de Chaville ?",
      a: "Pour les avocats, experts-comptables, médecins et consultants : rédaction assistée, gestion de la relation client, automatisation administrative et prise de rendez-vous, par étapes maîtrisées.",
    },
    {
      q: "Quels services pour les commerces et services de proximité ?",
      a: "Pour les commerces et services : agents conversationnels, automatisation des devis, gestion des plannings et présence en ligne enrichie par l'IA, calibrés selon votre taille et votre budget.",
    },
    {
      q: "Faut-il être une grande entreprise pour travailler avec Axion-IA ?",
      a: "Non. Nous priorisons les PME puis les ETI de Chaville ; les grands groupes sont accompagnés en complément. Chaque mission est calibrée selon votre taille, votre budget et vos cas d'usage réels.",
    },
    {
      q: "Comment se déroule une mission à Chaville ?",
      a: "Nous démarrons par un audit, puis intervenons sur site ou en visio, à 15 min de Paris-Montparnasse. Livrables documentés, équipes formées, aucune dépendance technique imposée.",
    },
  ],
};
