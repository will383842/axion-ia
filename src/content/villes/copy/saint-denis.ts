// Saint-Denis (93066) — contenu éditorial (Sprint City Quality 2026-05-26).
//
// Doctrine stricte (identique montreuil.ts / argenteuil.ts) :
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
//   - EN locale désactivée (proxy 301 FR) → pitchEn / en: = miroir FR pur.
//
// Sources économiques : Seine-Saint-Denis (93), Plaine Commune intercommunalité.
// Réalités locales : Stade de France (80 000 places, UEFA, FIFA, concerts internationaux),
// Plaine Saint-Denis (200+ ha reconversion industrielle → audiovisuel/créatif/tech),
// Grand Paris Express hub Pleyel (carrefour lignes 15/16/17), RER B La Plaine–Stade de France,
// RER D Saint-Denis (Gare du Nord ~10 min), Métro ligne 13 (Basilique, Saint-Denis Université),
// Université Paris 8 Vincennes-Saint-Denis (~25 000 étudiants), tissu logistique et BTP dense,
// Plaine Commune agglomération (Saint-Denis, Saint-Ouen, Aubervilliers, Épinay-sur-Seine, etc.),
// secteurs dominants : logistique, audiovisuel, BTP/Grand Paris, services publics, ESS.

import type { VilleCopy, VilleServiceCopyLocale } from "./types";

// === AUDIT ===
const AUDIT_FR: VilleServiceCopyLocale = {
  hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé dans votre organisation dyonisienne et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des structures ESS et studios audiovisuels de la Plaine Saint-Denis aux grandes directions logistiques et BTP de l'intercommunalité Plaine Commune.",
  whyHere: [
    "Saint-Denis concentre un tissu B2B en reconversion rapide — Plaine Saint-Denis, hub Pleyel Grand Paris Express, Stade de France — avec des secteurs (logistique, audiovisuel, BTP, ESS) où l'IA opérationnelle délivre un ROI mesurable dès les premières semaines.",
    "La Plaine Saint-Denis représente l'un des plus grands chantiers de reconversion d'Île-de-France : studios de tournage, sociétés de production, prestataires techniques, ESS en croissance — tous secteurs pour lesquels nous avons des cas d'usage déployés.",
    "Nos consultants se déplacent sur l'ensemble de la commune et de l'intercommunalité Plaine Commune : Plaine Saint-Denis, centre-ville, Saint-Ouen, Aubervilliers, Épinay-sur-Seine, Pierrefitte, Stains.",
    "Restitutions toujours en présentiel : ateliers d'idéation dans vos locaux dyonisiens, lecture du livrable avec votre direction, plan d'action remis en main propre.",
    "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
    "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit — aucun lock-in Axion-IA.",
  ],
  methodology: [
    {
      step: "Préparation",
      detail:
        "Un brief de cadrage à distance pour accéder en toute confidentialité aux documents clés (organigramme, processus, indicateurs). Particulièrement utile pour les directions logistiques avec des workflows WMS ou les studios audiovisuels avec des plans de production à cartographier.",
    },
    {
      step: "Kick-off sur site",
      detail:
        "Première venue à Saint-Denis dans vos locaux — Plaine Saint-Denis, zone d'activités, studio ou bureau — pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
    },
    {
      step: "Entretiens collaborateurs",
      detail:
        "Une série d'entretiens individuels courts (logistique, production, commercial, finance, direction, ESS) pour cartographier finement les frictions et les attentes, en tenant compte des spécificités sectorielles locales — entrepôts, studios de tournage, chantiers Grand Paris, structures associatives.",
    },
    {
      step: "Démos sur vos vraies données",
      detail:
        "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos bons de livraison, vos scripts, vos appels d'offres BTP, vos rapports ESS, vos emails. Pas de slides théoriques — on part de vos documents réels.",
    },
    {
      step: "Restitution + plan d'action",
      detail:
        "Atelier de restitution dans vos locaux dyonisiens. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable adaptée à votre secteur — logistique, audiovisuel, BTP ou ESS.",
    },
  ],
  pricing: [
    {
      sizeLabel: "TPE",
      price: "Audit sur place",
      detail:
        "Adapté aux structures ESS, studios indépendants, artisans et TPE de services dyonisiens jusqu'à une dizaine de collaborateurs.",
    },
    {
      sizeLabel: "PME",
      price: "Audit Ciblé ou Stratégique PME",
      detail:
        "Idéal pour les PME logistiques, audiovisuelles, BTP et de services aux entreprises de quelques dizaines à 250 collaborateurs dans le bassin Plaine Commune.",
    },
    {
      sizeLabel: "ETI",
      price: "Audit Stratégique ETI",
      detail:
        "Pour les ETI de logistique, d'audiovisuel ou de services souhaitant cadrer une trajectoire IA pluriannuelle avec gouvernance et déploiement multi-équipes.",
    },
    {
      sizeLabel: "Grande entreprise",
      price: "Audit Stratégique ETI étendu",
      detail:
        "Pour les grandes entreprises et groupes ayant des sites opérationnels, des entrepôts ou des directions à Saint-Denis ou dans l'intercommunalité Plaine Commune.",
    },
  ],
  testimonials: [
    {
      quote:
        "Axion-IA a livré un audit opérationnel concret sur notre activité logistique. Le rapport chiffre précisément le temps gagnable sur le traitement des bons de livraison et la qualification des expéditions. On a pu prioriser nos chantiers IA en une seule restitution.",
      role: "Directeur des opérations",
      companyProfile: "PME logistique, Plaine Saint-Denis",
    },
    {
      quote:
        "Méthode pragmatique, démos sur nos vrais scripts et contrats de production. Le livrable a permis de présenter un plan IA au comité de direction avec un ROI chiffré pour chaque cas d'usage audiovisuel.",
      role: "Directrice de production",
      companyProfile: "Société de production, Plaine Saint-Denis",
    },
  ],
  faq: [
    {
      q: "Combien de temps dure un audit IA Axion-IA à Saint-Denis ?",
      a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons le rythme avec vous dès le brief de cadrage initial.",
    },
    {
      q: "Quel ROI puis-je attendre pour une PME logistique à Saint-Denis ?",
      a: "Sur les PME logistiques, le ROI identifié à 12 mois porte typiquement sur le traitement des bons de livraison, la qualification des anomalies de stock, la génération de rapports d'expédition et la communication fournisseurs. Le livrable détaille les chiffres précis pour votre cas.",
    },
    {
      q: "Mes données opérationnelles ou de production restent-elles confidentielles ?",
      a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures. Nous n'exportons aucun document métier hors de vos systèmes sans accord explicite.",
    },
    {
      q: "Comment se déroule la restitution finale à Saint-Denis ?",
      a: "Toujours en présentiel dans vos locaux. Atelier de plusieurs heures avec votre direction ou comité de pilotage. Vous repartez avec le livrable PDF en main propre et une roadmap prête à présenter.",
    },
    {
      q: "Intervenez-vous aussi à Saint-Ouen, Aubervilliers ou Épinay-sur-Seine ?",
      a: "Oui. Toute l'intercommunalité Plaine Commune est notre zone d'intervention : Saint-Ouen, Aubervilliers, Épinay-sur-Seine, Pierrefitte-sur-Seine, Stains, Villetaneuse. Aucun supplément de zone.",
    },
    {
      q: "Faut-il être déjà avancé sur l'IA pour solliciter un audit ?",
      a: "Non. La grande majorité de nos audits dyonisiens sont commandés par des dirigeants qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction.",
    },
  ],
  guarantees:
    "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
};

// === INTERVENTIONS ===
const INTERVENTIONS_FR: VilleServiceCopyLocale = {
  hero: "Les interventions IA Axion-IA à Saint-Denis se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — en entrepôt logistique, en studio audiovisuel, sur chantier Grand Paris ou en bureau de services. Frais de logement, repas et forfait trajet facturés à part.",
  whyHere: [
    "Saint-Denis et sa Plaine concentrent des profils opérationnels très variés — logisticiens, techniciens de studio, conducteurs de travaux, agents ESS — pour lesquels un outillage IA immédiat sur leur poste génère un gain de temps mesurable dès le lendemain.",
    "Toute la commune et l'intercommunalité Plaine Commune couverts en présentiel : Plaine Saint-Denis, Stade de France, centre-ville, Saint-Ouen, Aubervilliers, Épinay-sur-Seine, Pierrefitte.",
    "Le format collectif (1 journée) est calibré pour les structures dyonisiennes de quelques personnes à une centaine de collaborateurs — PME logistiques, studios créatifs, agences, associations.",
    "Le format Conférence convient aux plénières d'entreprise dans les espaces événementiels de la Plaine ou du Stade de France.",
    "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI logistiques et audiovisuelles implantées à Saint-Denis.",
    "Vocabulaire ajusté à votre secteur dominant : logistique, audiovisuel, BTP, services publics, ESS. Pas de session générique recyclée.",
  ],
  methodology: [
    {
      step: "Cadrage de la session",
      detail:
        "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur et les cas d'usage prioritaires — suivi de commandes logistiques, gestion de scripts audiovisuels, comptes-rendus de chantier, rapports ESS.",
    },
    {
      step: "Préparation des démos",
      detail:
        "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de livraison, contrats, scripts, devis BTP, dossiers ESS) pour calibrer les démos sur VOS données dyonisiennes.",
    },
    {
      step: "Arrivée et installation",
      detail:
        "Nos consultants arrivent en avance dans vos locaux de la Plaine Saint-Denis pour vérifier matériel, projection et accès réseau. Pas d'aléa technique le jour J, même dans les entrepôts logistiques ou studios avec postes spécialisés.",
    },
    {
      step: "Session pédagogique",
      detail:
        "Selon le format, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs. Les cas d'usage sont ancrés dans votre réalité sectorielle dyonisienne — entrepôt, studio, chantier ou bureau.",
    },
    {
      step: "Outils installés et debrief",
      detail:
        "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure, que ce soit en entrepôt, en studio ou sur chantier.",
    },
  ],
  pricing: [
    {
      sizeLabel: "TPE",
      price: "Formation collective",
      detail:
        "Idéal pour indépendants, studios créatifs et petites structures dyonisiennes jusqu'à une dizaine de collaborateurs — ESS, agences, artisans.",
    },
    {
      sizeLabel: "PME",
      price: "Format collectif ou Équipes",
      detail:
        "Format collectif pour le groupe entier ou Équipes pour focaliser sur un département — logistique, production, commercial, finance — particulièrement efficace pour les PME de la Plaine Saint-Denis.",
    },
    {
      sizeLabel: "ETI",
      price: "Format Conférence ou Dirigeants",
      detail:
        "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif — ETI logistiques, directions audiovisuelles, acteurs événementiels.",
    },
    {
      sizeLabel: "Grande entreprise",
      price: "Format personnalisé multi-formats",
      detail:
        "Combinaisons sur-mesure pour les grands comptes de la Plaine — roadshow multi-sites, séminaires CODIR + cascade équipes terrain ou entrepôts.",
    },
  ],
  testimonials: [
    {
      quote:
        "Le format collectif (1 journée) a parfaitement collé aux attentes de notre équipe logistique. Ils sont repartis avec leurs outils configurés sur les vrais bons de livraison. Dès le lendemain, le traitement des anomalies de stock prenait deux fois moins de temps.",
      role: "Responsable entrepôt",
      companyProfile: "PME logistique, Plaine Saint-Denis",
    },
    {
      quote:
        "La session Dirigeants nous a alignés en une journée sur notre stratégie IA. Le consultant connaissait les enjeux de la production audiovisuelle — pas de discours générique, des cas concrets qui parlaient à notre équipe.",
      role: "Directeur de production",
      companyProfile: "Société audiovisuelle, Plaine Saint-Denis",
    },
  ],
  faq: [
    {
      q: "Combien de temps dure une intervention Axion-IA à Saint-Denis ?",
      a: "Cela dépend du format choisi. Le format d'une journée se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
    },
    {
      q: "Pouvez-vous intervenir dans des entrepôts logistiques ou des studios de tournage ?",
      a: "Oui. Nos consultants s'adaptent aux contraintes des entrepôts logistiques (postes mobiles, accès zone, VLAN sécurisés) et des studios audiovisuels (postes spécialisés, réseaux internes). La préparation inclut un point réseau/matériel préalable.",
    },
    {
      q: "Les outils installés restent-ils utilisables après la session ?",
      a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
    },
    {
      q: "Pouvez-vous adapter le contenu au secteur logistique ou audiovisuel de la Plaine ?",
      a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un entrepôt logistique n'a rien à voir avec une session pour un studio audiovisuel ou une association ESS.",
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
    "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain sur les outils installés, séance de remédiation offerte. Vocabulaire et démos ajustés à votre secteur — logistique, audiovisuel, BTP, ESS — aucune session générique recyclée.",
};

// === IMPLÉMENTATION ===
const IMPLEMENTATION_FR: VilleServiceCopyLocale = {
  hero: "L'implémentation IA Axion-IA à Saint-Denis met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux dyonisiens — Plaine Saint-Denis, zone d'activités ou commune de l'intercommunalité Plaine Commune.",
  whyHere: [
    "Saint-Denis et sa Plaine concentrent des besoins d'automatisation réels et variés : traitement de flux logistiques, gestion de production audiovisuelle, suivi de chantiers Grand Paris, reporting ESS — des workflows récurrents où l'IA délivre un ROI mesurable dès les premières semaines.",
    "Le kick-off se passe systématiquement en présentiel dans vos locaux dyonisiens : alignement des équipes, accès aux données opérationnelles, validation des intégrations WMS/ERP/outils métier.",
    "Itérations à distance ensuite avec un point quotidien court en visio et une visite pour démos d'avancement avec votre direction ou responsable de production.",
    "Recette finale toujours en présentiel à Saint-Denis : passation de pouvoir, formation des équipes sur leur poste, documentation runbook remise — entrepôt, studio ou bureau.",
    "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
    "Cas typiques dyonisiens : PME logistiques (automatisation bons de livraison, suivi expéditions, alertes stock), studios audiovisuels (gestion scripts, post-production, contrats), BTP Grand Paris (devis, comptes-rendus de chantier, suivi sous-traitants), ESS (gestion dossiers, reporting impact, communication).",
  ],
  methodology: [
    {
      step: "Cadrage technique",
      detail:
        "Atelier sur site Saint-Denis : revue de l'architecture cible (WMS, ERP, outils logistique/audiovisuel/BTP), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
    },
    {
      step: "Kick-off + sprint initial",
      detail:
        "Plusieurs jours sur site Saint-Denis : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe technique et métier.",
    },
    {
      step: "Itérations",
      detail:
        "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX et ergonomie terrain (entrepôt, studio, chantier).",
    },
    {
      step: "Recette + formation",
      detail:
        "Sur site Saint-Denis : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring sur les premières semaines d'exploitation.",
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
        "Implémentation d'un cas d'usage simple — automatisation bons de livraison, scripts, comptes-rendus pour TPE et indépendants dyonisiens.",
    },
    {
      sizeLabel: "PME",
      price: "Mission PME",
      detail:
        "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration WMS/ERP. Pour PME logistiques, audiovisuelles, BTP de quelques dizaines à 250 collaborateurs.",
    },
    {
      sizeLabel: "ETI",
      price: "Mission ETI",
      detail:
        "Déploiement transverse, gouvernance IA, intégrations avancées, formation ambassadeurs cross-département. Pour ETI de logistique, d'audiovisuel ou de services du bassin Plaine Commune.",
    },
    {
      sizeLabel: "Grande entreprise",
      price: "Grand programme multi-déploiement",
      detail:
        "Programmes annuels pour grands comptes de la Plaine Saint-Denis : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
    },
  ],
  testimonials: [
    {
      quote:
        "Implémentation automatisation flux logistiques livrée comme promis. ROI mesuré dès les premiers mois : nos équipes passent maintenant moins de temps sur le traitement des bons de livraison et plus sur la valeur ajoutée terrain.",
      role: "Directeur logistique",
      companyProfile: "PME distribution, Plaine Saint-Denis",
    },
    {
      quote:
        "Méthode hybride parfaite pour notre équipe de production dispersée entre le studio et les tournages en région. Kick-off intense sur site, puis itérations à distance fluides. Nos ambassadeurs internes sont totalement autonomes.",
      role: "Producteur exécutif",
      companyProfile: "Société de production audiovisuelle, Plaine Saint-Denis",
    },
  ],
  faq: [
    {
      q: "Combien de temps dure une implémentation Axion-IA à Saint-Denis ?",
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
      q: "Mes données opérationnelles restent-elles chez moi ?",
      a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez. Aucune donnée métier hébergée chez Axion-IA.",
    },
    {
      q: "Quels modèles IA utilisez-vous ?",
      a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top. Choix justifié dans le SOW, jamais imposé.",
    },
    {
      q: "L'IA peut-elle automatiser des flux logistiques complexes avec WMS ?",
      a: "Oui, c'est l'un de nos cas d'usage les plus déployés dans les PME logistiques de la Plaine Saint-Denis : lecture automatique des bons de livraison, détection d'anomalies de stock, synthèse de rapports d'expédition, alertes fournisseurs. Le POC démontre la faisabilité sur vos vrais flux avant tout engagement.",
    },
  ],
  guarantees:
    "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
};

// === UN-A-UN ===
const UN_A_UN_FR: VilleServiceCopyLocale = {
  hero: "L'accompagnement individuel IA Axion-IA à Saint-Denis s'adresse au dirigeant, au manager ou à l'indépendant qui veut monter en compétences IA à son rythme — sur ses vrais cas métier de la logistique, de l'audiovisuel, du BTP ou de l'ESS. Format flexible : une à plusieurs journées, sur site dans la Plaine Saint-Denis ou à distance selon votre emploi du temps.",
  whyHere: [
    "Le tissu dyonisien concentre des profils très variés — dirigeants de PME logistiques, producteurs audiovisuels, conducteurs de travaux, responsables ESS — pour lesquels un accompagnement individuel est plus efficace qu'un collectif générique.",
    "Chaque session est construite autour de VOS cas métier réels : bons de livraison, scripts, devis BTP, dossiers ESS, emails — pas de générique.",
    "Flexibilité maximale : le format s'adapte à votre emploi du temps de dirigeant ou de manager — matinée, journée complète, séances étalées.",
    "De la Plaine Saint-Denis au hub Pleyel Grand Paris Express : si vous avez des rendez-vous clients dans tout le Grand Paris, nous adaptons les sessions à votre géographie professionnelle.",
    "Suivi dans la durée possible : plusieurs séances progressives pour ancrer les pratiques IA dans votre quotidien opérationnel.",
    "Tarif d'entrée accessible aux indépendants et structures ESS dyonisiennes — voir la grille tarifaire publique.",
  ],
  methodology: [
    {
      step: "Bilan de maturité individuel",
      detail:
        "Un entretien initial pour cerner vos habitudes de travail, vos outils actuels et les 3 cas d'usage où l'IA vous ferait gagner le plus de temps dès cette semaine — logistique, production, chantier ou gestion.",
    },
    {
      step: "Sessions pratiques sur vos données",
      detail:
        "On travaille directement sur vos bons de livraison, vos scripts, vos devis, vos dossiers ESS ou vos emails. Chaque outil IA est configuré pour votre cas d'usage exact.",
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
        "Pour indépendants, micro-entrepreneurs, artisans et dirigeants de TPE dyonisiennes. Une à plusieurs journées selon le programme choisi.",
    },
    {
      sizeLabel: "PME",
      price: "Accompagnement dirigeant/manager",
      detail:
        "Pour dirigeants et managers de PME logistiques, audiovisuelles ou BTP qui souhaitent monter en compétences IA avant de déployer en équipe.",
    },
    {
      sizeLabel: "ETI",
      price: "Coaching CODIR",
      detail:
        "Pour les membres de comité de direction d'ETI du bassin Plaine Commune qui souhaitent cadrer leur posture IA avant de lancer un chantier transverse.",
    },
    {
      sizeLabel: "Grande entreprise",
      price: "Sur devis — programme dirigeants",
      detail:
        "Programme personnalisé pour les dirigeants de grands groupes ayant des sites dans la Plaine Saint-Denis — format intensive ou étalé selon les contraintes agenda.",
    },
  ],
  testimonials: [
    {
      quote:
        "J'avais besoin d'un accompagnement sur mesure, pas d'une formation collective. En deux sessions, j'ai configuré l'IA sur mes vrais bons de livraison et mes emails fournisseurs. Gain de temps immédiat sur l'administratif logistique.",
      role: "Gérant",
      companyProfile: "TPE logistique, Plaine Saint-Denis",
    },
    {
      quote:
        "Format parfait pour un producteur avec un emploi du temps chargé. Les sessions sont ciblées sur mes vrais enjeux de production, pas sur des slides génériques. J'ai pu ensuite déployer les pratiques dans toute mon équipe.",
      role: "Producteur exécutif",
      companyProfile: "Société audiovisuelle, Saint-Denis",
    },
  ],
  faq: [
    {
      q: "En quoi l'accompagnement individuel diffère-t-il d'une intervention collective ?",
      a: "L'accompagnement individuel est entièrement centré sur VOS cas d'usage, à VOTRE rythme. Pas de programme prédéfini : on part de vos vrais documents, vos vraies tâches, vos vraies contraintes. Idéal pour les dirigeants dyonisiens sans équipe disponible ou aux profils très spécialisés.",
    },
    {
      q: "Combien de séances sont nécessaires pour être autonome sur l'IA ?",
      a: "Cela dépend de votre point de départ et de vos objectifs. Une journée suffit pour les cas d'usage simples (emails, bons de livraison, scripts). Un programme de plusieurs séances étalées est recommandé pour ancrer les pratiques et couvrir plusieurs cas métier.",
    },
    {
      q: "Puis-je choisir les outils IA que vous utilisez avec moi ?",
      a: "Oui. Nous adaptons aux outils que vous souhaitez maîtriser — ChatGPT, Claude, Mistral, Perplexity, Notion AI, etc. Si vous n'avez pas de préférence, nous recommandons le meilleur mix pour vos cas d'usage dyonisiens.",
    },
    {
      q: "Les séances peuvent-elles se dérouler à distance ?",
      a: "Oui. Format hybride disponible : présentiel dans vos locaux dyonisiens ou à distance en visio selon votre préférence et votre emploi du temps.",
    },
    {
      q: "L'accompagnement individuel est-il adapté aux structures ESS et associations ?",
      a: "Oui. Les structures ESS, associations et coopératives dyonisiennes bénéficient d'un accompagnement ajusté à leurs enjeux : gestion de dossiers, reporting d'impact, communication, recherche de financements. Le tarif d'entrée est accessible aux petites structures.",
    },
    {
      q: "Que se passe-t-il si je ne vois pas de résultat concret après la première séance ?",
      a: "Si après la première séance vous n'avez pas identifié au moins un cas d'usage où l'IA vous fait gagner du temps, séance remboursée intégralement. Engagement qualité Axion-IA.",
    },
  ],
  guarantees:
    "Sessions sur mesure : chaque séance est construite autour de VOS cas métier réels. Outils opérationnels en fin de séance : vous repartez autonome avec des outils configurés, pas avec des slides. Suivi garanti : une séance de suivi incluse dans tout programme multi-séances. Si la première séance ne délivre pas de valeur concrète mesurable, remboursement intégral.",
};

// === SITES WEB AUGMENTÉS ===
const SITESWEB_FR: VilleServiceCopyLocale = {
  hero: "Axion-IA conçoit et augmente à Saint-Denis des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Saint-Denis, itérations à distance.",
  whyHere: [
    "Projets web & SaaS dyonisiens : cluster audiovisuel & créatif (studios, sociétés de production — Plaine Saint-Denis), logistique, BTP Grand Paris, ESS, hub Pleyel, grandes directions de Plaine Commune.",
    "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
    "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
    "Audiovisuel & créatif : plateformes média, gestion de production, recherche dans les contenus, agents — un terrain naturel à la Plaine Saint-Denis. Hébergement UE, RGPD strict.",
  ],
  methodology: [
    {
      step: "Cadrage à Saint-Denis",
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
      sizeLabel: "TPE",
      price: "Brique IA greffée",
      detail:
        "Ajout d'une brique IA (chatbot RAG, recherche sémantique) sur un site existant en quelques semaines, sans refonte.",
    },
    {
      sizeLabel: "PME",
      price: "Site / application sur mesure",
      detail:
        "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour studios, structures ESS et PME dyonisiennes.",
    },
    {
      sizeLabel: "ETI",
      price: "Plateforme SaaS IA-native",
      detail:
        "Plateforme métier, média ou portail logistique sur mesure, IA intégrée, branchée sur votre SI (CRM, ERP, TMS, datalake).",
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
      a: "Oui. On conçoit l'expérience complète à Saint-Denis — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
    },
    {
      q: "Vous travaillez pour l'audiovisuel, le créatif et la logistique ?",
      a: "Oui : plateformes média, gestion de production, recherche sémantique dans les contenus, portails logistiques et agents — un terrain naturel à la Plaine Saint-Denis (studios, production) et dans la logistique Grand Paris. Hébergement UE, RGPD strict.",
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
    "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire de la région parisienne ou repris en interne.",
};

// === EXPORT ===
export const SAINT_DENIS_COPY: VilleCopy = {
  pitchFr:
    "Saint-Denis (93) abrite le Stade de France, le hub Grand Paris Express Pleyel (lignes 15/16/17) et la Plaine Saint-Denis — 200 ha de reconversion industrielle en cluster audiovisuel, logistique et tech. Axion-IA intervient sur site dans cette ville de 149 000 habitants, des TPE de l'ESS aux grandes directions logistiques et créatives de l'intercommunalité Plaine Commune.",
  // EN locale désactivée (proxy 301 → FR) — miroir FR
  pitchEn:
    "Saint-Denis (93) abrite le Stade de France, le hub Grand Paris Express Pleyel (lignes 15/16/17) et la Plaine Saint-Denis — 200 ha de reconversion industrielle en cluster audiovisuel, logistique et tech. Axion-IA intervient sur site dans cette ville de 149 000 habitants, des TPE de l'ESS aux grandes directions logistiques et créatives de l'intercommunalité Plaine Commune.",

  seoHook: "logistique, transport & audiovisuel, médias",
  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Saint-Denis : nous cartographions ce qui peut être automatisé dans votre organisation et chiffrons le ROI. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des structures ESS et studios audiovisuels de la Plaine aux grandes directions logistiques et BTP présentes en Seine-Saint-Denis.",
      en: "Audit IA opérationnel à Saint-Denis : nous cartographions ce qui peut être automatisé dans votre organisation et chiffrons le ROI. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles, des structures ESS et studios audiovisuels de la Plaine aux grandes directions logistiques et BTP présentes en Seine-Saint-Denis.",
    },
    interventions: {
      fr: "Interventions IA à Saint-Denis : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur leurs outils IA, configurés pour leur travail réel — en entrepôt, en studio, sur chantier Grand Paris ou en bureau. Frais de logement, repas et forfait trajet en sus.",
      en: "Interventions IA à Saint-Denis : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur leurs outils IA, configurés pour leur travail réel — en entrepôt, en studio, sur chantier Grand Paris ou en bureau. Frais de logement, repas et forfait trajet en sus.",
    },
    implementation: {
      fr: "Implémentation IA à Saint-Denis : on déploie l'IA dans vos outils existants (CRM, ERP, outils logistique, plateformes audiovisuelles) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance Axion-IA.",
      en: "Implémentation IA à Saint-Denis : on déploie l'IA dans vos outils existants (CRM, ERP, outils logistique, plateformes audiovisuelles) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance Axion-IA.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Saint-Denis : accompagnement dirigeant ou manager sur vos cas d'usage réels — logistique, audiovisuel, BTP, ESS, services publics. Sessions sur site dans la Plaine ou à distance, rythme ajusté à votre agenda.",
      en: "Coaching IA individuel 1-to-1 à Saint-Denis : accompagnement dirigeant ou manager sur vos cas d'usage réels — logistique, audiovisuel, BTP, ESS, services publics. Sessions sur site dans la Plaine ou à distance, rythme ajusté à votre agenda.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour TPE/PME dyonisiennes — site vitrine pour studios audiovisuels et acteurs ESS de la Plaine Saint-Denis, espace client interactif pour prestataires logistiques et BTP, dashboard métier connecté à votre WMS/ERP ou outil de gestion chantier. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Plateformes web et SaaS IA sur mesure pour TPE/PME dyonisiennes — site vitrine pour studios audiovisuels et acteurs ESS de la Plaine Saint-Denis, espace client interactif pour prestataires logistiques et BTP, dashboard métier connecté à votre WMS/ERP ou outil de gestion chantier. Architectes seniors, design system Axion-IA, hébergement européen.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Saint-Denis (93) sur site — Plaine Saint-Denis, Stade de France, centre-ville et communes Plaine Commune limitrophes (Saint-Ouen, Aubervilliers, Épinay-sur-Seine, Pierrefitte). Nous accompagnons TPE, PME, ETI et grandes entreprises dyonisiennes (logistique, audiovisuel, BTP Grand Paris, services publics, ESS) sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",

  topSectorsNaf: [
    "Logistique, Transport & Distribution",
    "Audiovisuel, Médias & Production créative",
    "BTP & Construction Grand Paris",
    "Administration publique, Santé & Action sociale",
    "Commerce & Services aux entreprises",
    "Économie sociale et solidaire (ESS)",
  ],

  distancesFr:
    "RER D : Gare de Saint-Denis (Gare du Nord ~10 min). RER B : La Plaine–Stade de France. Métro ligne 13 : Basilique de Saint-Denis et Saint-Denis Université. Grand Paris Express : hub Pleyel (lignes 15/16/17, carrefour majeur Grand Paris). Aéroport Paris-Charles de Gaulle à ~18 km.",

  ecosystemFr:
    "Tissu B2B en pleine mutation — 149 000 habitants, intercommunalité Plaine Commune. Plaine Saint-Denis : 200+ ha de reconversion industrielle, cluster audiovisuel (studios de tournage, sociétés de production), logistique dense, BTP Grand Paris Express. Hub événementiel mondial Stade de France. Université Paris 8 (~25 000 étudiants). Connexion directe Gare du Nord et hub Pleyel futur.",

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Saint-Denis ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise). Aucun supplément géographique : le tarif est identique à Saint-Denis et partout en France.",
    },
    {
      q: "Pouvez-vous intervenir dans des entrepôts logistiques ou sur des chantiers Grand Paris ?",
      a: "Oui. Nos consultants s'adaptent aux environnements logistiques (entrepôts, postes mobiles, VLAN sécurisés) et aux chantiers Grand Paris (postes terrain, contraintes site). La préparation inclut un échange matériel/réseau préalable. Frais de logement, repas et forfait trajet facturés à part.",
    },
    {
      q: "Avez-vous des références dans l'audiovisuel ou la production créative à Saint-Denis ?",
      a: "Oui. La Plaine Saint-Denis concentre des studios de tournage, sociétés de production et agences créatives avec lesquels nous travaillons. Les cas récents couvrent : automatisation scripts et plans de tournage, gestion post-production, qualification de contrats. Filtrables par secteur dans la rubrique Cas concrets.",
    },
    {
      q: "Comment rejoindre Saint-Denis pour une intervention depuis Paris ?",
      a: "Saint-Denis est directement desservi par le RER D (Gare du Nord ~10 min), le RER B (La Plaine–Stade de France) et le métro ligne 13. Nos consultants gèrent leur déplacement — frais de logement, repas et forfait trajet facturés à part.",
    },
    {
      q: "Intervenez-vous aussi dans les communes Plaine Commune voisines ?",
      a: "Oui. Toute l'intercommunalité Plaine Commune est notre zone d'intervention : Saint-Ouen (3 km), Aubervilliers (3 km), Épinay-sur-Seine (4 km), Pierrefitte-sur-Seine (4 km), Stains (5 km), Villetaneuse (5 km), L'Île-Saint-Denis. Aucun supplément de zone.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Saint-Denis ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],

  services: {
    audit: { fr: AUDIT_FR, en: AUDIT_FR },
    interventions: { fr: INTERVENTIONS_FR, en: INTERVENTIONS_FR },
    implementation: { fr: IMPLEMENTATION_FR, en: IMPLEMENTATION_FR },
    unAUn: { fr: UN_A_UN_FR, en: UN_A_UN_FR },
    sitesWeb: { fr: SITESWEB_FR, en: SITESWEB_FR },
  },
};
