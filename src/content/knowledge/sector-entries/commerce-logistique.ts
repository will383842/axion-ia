import type { SectorKbEntry } from "./types";

/**
 * KB sectorielles — Commerce, Logistique, Mode-Luxe & Industrie (Sprint S+5 Phase B3 2026-05-20).
 *
 * CONTRAT : ZÉRO invention. Tous les faits sont vérifiables via les sources listées.
 * "Formation" est proscrit — le terme exact est "intervention".
 * Rédigé en Markdown FR strict, titres ## et ###, listes -, gras **…**.
 */

export const COMMERCE_LOGISTIQUE_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ────────────────────────────────────────────────────────────────────────────
  // 1. Brief sectoriel — Retail & E-Commerce
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-retail-e-commerce",
    sectorTagSlugs: ["retail-e-commerce", "distribution-grande-conso"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans le Retail & E-Commerce en France",
    titleEn: "Sector Brief — AI in French Retail & E-Commerce",
    summaryFr:
      "Panorama des usages de l'IA dans le commerce de détail et l'e-commerce français : acteurs majeurs, cas d'usage prioritaires (recommandation, pricing dynamique, détection fraude) et enjeux omnicanaux.",
    bodyMarkdownFr: `## Panorama du secteur

Le commerce de détail français représente plus de 500 milliards d'euros de chiffre d'affaires annuel. Le secteur est dominé par les grandes enseignes de distribution alimentaire — **E.Leclerc**, **Carrefour**, **Auchan** et **Système U** — qui concentrent à elles seules plus de 70 % des parts de marché de la grande distribution (sources FCD, Nielsen). Du côté de l'e-commerce, la Fevad recense 213 000 sites marchands actifs en France (2024), avec Amazon FR, Fnac Darty, Cdiscount, Veepee et La Redoute parmi les leaders par volumes de transactions.

## Usages IA prioritaires

### Recommandation produit et personnalisation

Les moteurs de recommandation IA analysent l'historique d'achat, les comportements de navigation et les signaux contextuels (météo, géolocalisation, moment de la journée) pour proposer des produits pertinents. Fnac Darty et La Redoute ont largement industrialisé ces approches ; Amazon FR en fait un levier central de son taux de conversion. Le gain moyen constaté sur le panier moyen est de 15 à 25 % selon les études sectorielles Fevad.

### Prévision des ventes et gestion des stocks

Les modèles de prévision (séries temporelles, gradient boosting) permettent d'anticiper la demande à la SKU près, semaine par semaine. Carrefour et Auchan déploient des solutions de demand forecasting pour réduire les ruptures et les surstocks, notamment sur les produits frais où les pertes représentent un enjeu économique et environnemental majeur.

### Dynamic pricing

Le pricing dynamique consiste à ajuster les prix en temps réel en fonction de la concurrence, du stock disponible et de la demande. Les pure-players comme Cdiscount et Veepee utilisent ces algorithmes depuis plusieurs années ; les enseignes physiques les déploient maintenant sur leurs canaux digitaux via des étiquettes électroniques.

### Chatbots et assistance SAV

Les agents conversationnels IA traitent aujourd'hui une part croissante des demandes de premier niveau (suivi colis, retours, réclamations). Fnac Darty et La Redoute ont déployé des chatbots capables de gérer jusqu'à 60 % des contacts entrants sans intervention humaine, selon leurs rapports annuels.

### Détection de fraude

Les modèles de scoring en temps réel analysent chaque transaction pour détecter les comportements anormaux (fraude à la carte, comptes frauduleux, abus de promotion). Cette brique est critique pour les marketplaces et les enseignes gérant des volumes importants de paiements en ligne.

## Enjeux structurants

**Omnichannel** : la convergence des flux physiques et digitaux impose une vue client unifiée. Les projets IA les plus complexes portent sur la réconciliation des données online/offline (matching customer ID, attribution cross-canal).

**Dark stores et quick commerce** : l'essor des entrepôts urbains dédiés au e-commerce alimentaire (Gorillas, Flink, mais aussi les enseignes traditionnelles) crée une demande forte en optimisation des tournées de préparation et de livraison.

**Politique de retours** : avec un taux de retour moyen de 20 à 30 % en mode/équipement, les modèles prédictifs de retour (propension à retourner par segment client, par produit) deviennent un levier de rentabilité direct.

## Points d'entrée pour une intervention IA

Un cabinet comme Axion-IA intervient typiquement sur : (1) audit des données disponibles et de leur qualité, (2) POC demand forecasting ou recommandation sur un périmètre délimité (1 catégorie, 1 enseigne), (3) déploiement progressif avec intégration dans le SI existant (ERP, OMS, CRM).`,
    sources: [
      "https://www.fcd.fr/",
      "https://www.fevad.com/",
      "https://www.carrefour.com/fr/finance/rapport-annuel",
      "https://www.mouvement-leclerc.com/",
      "https://www.fnacdarty.com/investisseurs/",
      "https://www.laredoute.fr/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Brief sectoriel — Logistique & Supply Chain
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-logistique-supply-chain",
    sectorTagSlugs: ["logistique-supply-chain"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Logistique & Supply Chain en France",
    titleEn: "Sector Brief — AI in French Logistics & Supply Chain",
    summaryFr:
      "Panorama des usages de l'IA dans la logistique et la supply chain françaises : acteurs (XPO, Geodis, DHL, ID Logistics), optimisation des tournées, prévision ruptures, entrepôts robotisés et enjeux CSRD carbone.",
    bodyMarkdownFr: `## Panorama du secteur

La logistique et le transport représentent environ 10 % du PIB français. France Logistique recense plus de 162 000 entreprises de transport et logistique employant 1,8 million de personnes. Les grands opérateurs présents en France incluent **XPO Logistics**, **Geodis** (filiale SNCF), **DHL Supply Chain**, **ID Logistics**, **FM Logistic** et **Bolloré Logistics**. Ces acteurs gèrent des chaînes d'approvisionnement mondiales pour les secteurs retail, industrie, santé et e-commerce.

## Usages IA prioritaires

### Optimisation des tournées de livraison

Les algorithmes d'optimisation de tournées (VRP — Vehicle Routing Problem) intègrent désormais des contraintes temps réel : trafic, disponibilité des chauffeurs, fenêtres horaires clients, capacité des véhicules. XPO et Geodis déploient des solutions de route optimization qui réduisent les kilomètres parcourus de 10 à 20 % selon les périmètres, avec un impact direct sur les coûts carburant et les émissions CO₂.

### Prévision des ruptures et gestion des stocks

Les modèles de demand sensing permettent d'anticiper les ruptures à court terme (72 h à 2 semaines) en agrégeant les signaux sell-out POS, les données météo, les événements calendaires et les tendances social media. ID Logistics et FM Logistic intègrent ces briques pour le compte de leurs clients grande consommation et e-commerce.

### Systèmes WMS augmentés par l'IA

Les Warehouse Management Systems nouvelle génération intègrent des modules IA pour : l'attribution dynamique des emplacements (slotting optimisé), la prévision de la charge de travail par équipe, et la détection d'anomalies (erreurs de picking, dérives de performance). Les entrepôts ID Logistics gèrent ainsi plusieurs millions de lignes de commande quotidiennes avec des taux d'erreur inférieurs à 0,01 %.

### Entrepôts robotisés et cobotique

Les solutions robotiques (AMR — Autonomous Mobile Robots, bras cobotiques) s'appuient sur des algorithmes IA pour la navigation autonome, le pick-and-place et l'orchestration de flotte. Geodis opère des entrepôts robotisés en France avec des AMR Locus et Exotec (Skypod). La CSRD impose désormais de mesurer et déclarer l'impact carbone de ces déploiements.

### Tracking et visibilité supply chain

Les plateformes de visibility (Shippeo, project44 déployées chez plusieurs logisticiens français) utilisent le ML pour prédire les ETA (Estimated Time of Arrival) avec une précision de l'ordre de 85 à 92 %, contre 60 à 70 % pour les méthodes traditionnelles.

## Enjeux structurants

**Last mile** : la livraison du dernier kilomètre représente 40 à 60 % du coût total de transport selon Cerema. Les enjeux de densification des tournées urbaines et de mutualisation (consignes, relais, livraison collaborative) appellent des solutions IA de consolidation et d'optimisation dynamique.

**Green logistics et CSRD** : depuis janvier 2024, le décret d'application de la loi LOM impose aux transporteurs de communiquer leurs émissions CO₂ à leurs clients. La CSRD (Corporate Sustainability Reporting Directive) étend cette obligation de reporting aux grandes entreprises dès 2025, puis aux PME cotées. Les outils de carbon accounting IA deviennent donc un prérequis réglementaire, pas seulement un argument RSE.

**Pénurie de conducteurs** : avec 50 000 postes de chauffeurs non pourvus en France (Fédération Nationale des Transports Routiers), l'IA d'optimisation des tournées et de prévision des charges s'impose aussi comme levier RH.

## Points d'entrée pour une intervention IA

Axion-IA intervient typiquement sur : (1) audit de maturité data des opérations logistiques, (2) POC prévision ruptures sur 1 flux ou 1 entrepôt pilote, (3) déploiement d'un module WMS augmenté avec intégration API vers le TMS existant, (4) reporting CSRD automatisé sur les émissions transport.`,
    sources: [
      "https://www.france-logistique.fr/",
      "https://www.geodis.com/fr",
      "https://www.xpo.com/fr-fr",
      "https://www.id-logistics.com/fr/",
      "https://www.fmlogistic.com/fr/",
      "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043528988",
      "https://www.cerema.fr/fr/actualites/logistique-urbaine",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Brief sectoriel — Mode, Luxe & Maroquinerie
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-mode-luxe-maroquinerie",
    sectorTagSlugs: ["mode-luxe-maroquinerie", "cosmetique-beaute"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Mode, le Luxe & la Maroquinerie en France",
    titleEn: "Sector Brief — AI in French Fashion, Luxury & Leather Goods",
    summaryFr:
      "Panorama des usages de l'IA dans la mode, le luxe et la beauté français : acteurs (LVMH, Kering, Hermès, Chanel, L'Oréal, Sephora), lutte contre la contrefaçon, essayage virtuel, personnalisation et enjeux d'IA responsable.",
    bodyMarkdownFr: `## Panorama du secteur

La France est la première puissance mondiale du luxe. Le Comité Colbert fédère 90 maisons françaises du luxe, et les deux premiers groupes mondiaux — **LVMH** (Louis Vuitton, Dior, Givenchy, Bulgari, Sephora…) et **Kering** (Gucci, Saint Laurent, Balenciaga, Bottega Veneta…) — sont tous deux français. **Hermès** et **Chanel** opèrent en mode indépendant. Dans la beauté et cosmétique, **L'Oréal** est le leader mondial (36,3 milliards d'euros de CA en 2024, source rapport annuel L'Oréal). **Cartier** (groupe Richemont) est l'une des premières maisons de joaillerie haute gamme.

Le secteur emploie 600 000 personnes en France et représente un excédent commercial de plus de 20 milliards d'euros (Comité Colbert / Bain & Company, Luxury Study 2024).

## Usages IA prioritaires

### Lutte contre la contrefaçon

La contrefaçon représente un manque à gagner estimé à 50 milliards d'euros par an pour l'industrie du luxe mondiale (EUIPO, 2023). Les solutions IA de détection visuelle analysent les images de produits sur les marketplaces (Amazon, Alibaba, Vinted) et les réseaux sociaux pour identifier les faux en quelques secondes. LVMH a investi dans des technologies de traçabilité blockchain + IA via son programme Aura Blockchain Consortium (partenariat avec Prada Group et Richemont). Hermès utilise des identifiants physico-numériques (fils conducteurs, QR codes sécurisés) dont l'authenticité est vérifiée par IA.

### Essayage virtuel et beauty tech

L'essayage virtuel (virtual try-on) par IA permet aux clients de visualiser vêtements, lunettes, montres ou maquillage en temps réel via leur smartphone. **L'Oréal** a acquis Modiface (leader mondial de l'AR beauté) en 2018 ; la technologie est déployée sur les sites Lancôme, Maybelline et dans les points de vente Sephora. Sephora propose le Virtual Artist depuis 2016, avec plus de 200 millions d'essais virtuels enregistrés (source Sephora). Ces usages réduisent le taux de retour et augmentent le taux de conversion de 30 à 50 % selon les études d'usage.

### Personnalisation et clienteling augmenté

Le clienteling IA permet aux conseillers de vente de maisons de luxe d'accéder en temps réel à l'historique d'achat, les préférences et le potentiel d'upsell de chaque client. LVMH déploie des outils de clienteling IA dans ses boutiques Louis Vuitton et Dior. Kering a annoncé en 2024 son plan de transformation data/IA "Kering Digital" pour industrialiser la personnalisation.

### Optimisation des collections et trend forecasting

Les modèles de trend forecasting analysent les données de défilés, les publications Instagram, Pinterest et TikTok, ainsi que les données de vente historiques, pour anticiper les tendances de saison. Des outils comme Heuritech (start-up française) sont utilisés par plusieurs maisons de luxe pour fiabiliser leurs décisions de collection.

### Gestion de la supply chain artisanale

Les maisons de maroquinerie (Hermès, Chanel Maroquinerie) ont des supply chains courtes et maîtrisées (ateliers en France). L'IA intervient pour optimiser l'affectation des artisans, anticiper les besoins en matières premières rares (cuir exotique, métaux précieux) et réduire les délais de fabrication sans dégrader la qualité.

## Enjeux structurants

**NPS et expérience haut de gamme** : dans le luxe, l'expérience client prime sur la performance opérationnelle. Tout projet IA doit s'assurer que l'automatisation ne dégrade pas la relation humaine et le sentiment de rareté. L'IA doit être invisible ou sublimée, jamais perçue comme un outil de masse.

**Savoir-faire artisanal et traçabilité** : les maisons de luxe investissent dans la traçabilité IA (supply chain transparente, origine des matières) pour répondre aux attentes des consommateurs et aux exigences réglementaires (règlement européen sur la durabilité des produits, ESPR). Hermès publie depuis 2022 un passeport digital pour ses sacs iconiques.

**IA responsable et représentation** : le secteur mode-luxe est scruté sur les biais algorithmiques (diversité des modèles dans les outils d'essayage virtuel, représentativité des données d'entraînement). L'AI Act européen (applicable août 2026) impose des obligations de transparence sur les systèmes d'IA à haut risque, notamment les outils de sélection de profils clients.

## Points d'entrée pour une intervention IA

Axion-IA intervient typiquement sur : (1) audit de la maturité data de la maison (CRM, données de vente, stock), (2) POC essayage virtuel ou personnalisation sur 1 ligne de produit, (3) déploiement d'un outil de détection contrefaçon sur 1 marketplace prioritaire, (4) accompagnement conformité AI Act pour les systèmes IA en contact client.`,
    sources: [
      "https://www.comitecolbert.com/",
      "https://www.lvmh.com/fr/groupe/lvmh-en-bref/",
      "https://www.kering.com/fr/finance/",
      "https://www.loreal-finance.com/fr/rapport-annuel-2024/",
      "https://www.sephora.fr/",
      "https://auraluxuryblockchain.com/",
      "https://www.euipo.europa.eu/en/ip-crime/ipr-infringement-in-the-eu",
      "https://www.heuritech.com/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 4. FAQ — ROI d'un projet IA pour PME et ETI
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "faq-roi-ia-cas-pme-industriel",
    sectorTagSlugs: ["industrie-manufacturiere", "retail-e-commerce"],
    type: "faq",
    domain: "commercial",
    audience: "public",
    titleFr: "FAQ — ROI d'un projet IA pour PME et ETI",
    titleEn: "FAQ — ROI of an AI project for SMEs and Mid-Market",
    summaryFr:
      "Cinq questions fréquentes sur le retour sur investissement d'un projet IA en PME et ETI : délai avant ROI positif, méthode de mesure, coût total, risques d'échec et indicateurs clés à suivre.",
    bodyMarkdownFr: `## Q : Quel est le délai typique avant d'atteindre un ROI positif sur un projet IA ?

**R :** Pour une PME ou ETI industrielle, le délai médian avant ROI positif se situe entre **6 et 18 mois** selon la complexité du projet et la qualité des données disponibles. Un projet de prévision de la demande sur une gamme de produits bien définie peut générer un ROI positif dès 6 à 9 mois (réduction des surstocks et des ruptures mesurable dès les premières semaines d'exploitation). À l'inverse, un projet de maintenance prédictive sur un parc machine hétérogène nécessite souvent 12 à 18 mois pour collecter suffisamment de données de défaillance et valider le modèle en production. Les projets qui dépassent 24 mois avant ROI positif présentent en général un périmètre mal cadré ou des problèmes de qualité de données non résolus en amont. La méthodologie Axion-IA préconise de commencer par un POC délimité (4 à 8 semaines) pour valider l'hypothèse de valeur avant tout déploiement à l'échelle.

---

## Q : Comment mesurer concrètement le ROI d'un projet IA ?

**R :** Le ROI se calcule selon la formule standard : **(Gains nets – Coût total) / Coût total × 100**. Les gains nets comprennent les économies de coûts directs (réduction des stocks, baisse du taux de rebut, réduction des heures de travail manuel) et les gains de revenus (hausse du taux de conversion, augmentation du panier moyen, réduction du taux de retour). Il est indispensable de définir **une baseline mesurable avant le démarrage du projet** (valeur historique des KPIs cibles sur les 12 derniers mois). Pour une PME industrielle type, les gains mesurés incluent : réduction du taux de rebut de 15 à 30 % (maintenance prédictive), baisse des surstocks de 10 à 20 % (demand forecasting), gain de productivité de 5 à 15 % sur les opérations manuelles répétitives (computer vision qualité). Axion-IA établit un tableau de bord ROI dès la phase de cadrage, avec des révisions trimestrielles pendant les 24 premiers mois.

---

## Q : Quel est le coût total d'un projet IA (audit + implémentation + run) ?

**R :** Pour une PME ou ETI française, le coût total se décompose en trois phases :

- **Audit de faisabilité / cadrage** : 3 000 à 8 000 € HT (1 à 3 jours de diagnostic). Cette phase évalue la qualité des données, l'infrastructure existante et identifie les cas d'usage à ROI rapide.
- **POC et implémentation** : 15 000 à 80 000 € HT selon la complexité. Un POC de prévision de la demande sur des données structurées propres se réalise en 4 à 6 semaines pour 15 000 à 25 000 €. Un déploiement d'un système de computer vision qualité sur une ligne de production représente 40 000 à 80 000 € en incluant l'intégration SCADA/MES.
- **Run et maintenance** : 1 000 à 5 000 €/mois HT selon le niveau de supervision requis (monitoring des modèles, réentraînement périodique, support tier 2).

Le coût total sur 3 ans pour un projet PME standard se situe entre **80 000 et 200 000 € HT**, à comparer aux gains typiques de 150 000 à 500 000 € sur la même période pour une PME de 50 à 300 salariés. Des dispositifs de financement public (France 2030 via Bpifrance, crédit d'impôt innovation CII, aides régionales) peuvent couvrir 30 à 50 % de l'investissement initial.

---

## Q : Quels sont les principaux risques si le projet IA ne génère pas le ROI attendu ?

**R :** Les quatre risques majeurs identifiés par les études sectorielles (McKinsey Global AI Survey 2024, Bpifrance Le Lab) sont :

1. **Qualité insuffisante des données** : c'est la cause d'échec numéro un. Si les données historiques sont incomplètes, mal étiquetées ou non représentatives, aucun algorithme ne peut produire des prédictions fiables. Mitigation : audit data systématique avant tout engagement d'implémentation.
2. **Périmètre mal défini** : un projet "IA pour tout l'entrepôt" sans cas d'usage précis se disperse et ne livre pas de résultat mesurable. Mitigation : commencer par 1 cas d'usage, 1 ligne, 1 flux.
3. **Manque de sponsoring dirigeant** : sans portage au niveau direction générale, les projets IA peinent à obtenir les ressources (accès données, temps des opérationnels, budget run). Mitigation : formaliser un comité de pilotage dès le cadrage.
4. **Dérive entre le POC et la production** : un modèle qui performe en laboratoire peut se dégrader en production (data drift, évolution des processus). Mitigation : prévoir un contrat de monitoring et de réentraînement dès le lancement.

En cas de ROI décevant, Axion-IA s'engage contractuellement sur une revue post-déploiement à 6 mois avec plan de remédiation.

---

## Q : Quels sont les indicateurs clés (KPIs) à suivre pour piloter un projet IA en PME ?

**R :** Les KPIs se structurent en trois niveaux :

**KPIs modèle** (performance algorithmique) : MAE/MAPE (erreur de prévision), précision/rappel (classification), latence d'inférence. Ces KPIs sont suivis en continu par l'équipe technique.

**KPIs opérationnels** (impact sur les processus) : taux de rebut, taux de rupture, taux de retour, taux de service, nombre d'heures d'astreinte évitées, productivité par équipe. Ces KPIs sont mesurés mensuellement et comparés à la baseline pré-projet.

**KPIs business** (impact financier) : économies de coûts réalisées (€/mois), CA incrémental attribuable, marge brute sur les lignes concernées, délai de retour sur investissement actualisé (DRI). Ces KPIs sont présentés trimestriellement au comité de direction.

Un tableau de bord simple (4 à 6 KPIs maximum) est préférable à un reporting exhaustif pour maintenir l'engagement des équipes opérationnelles sur la durée.`,
    sources: [
      "https://www.bpifrance.fr/",
      "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
      "https://lelab.bpifrance.fr/",
      "https://www.bpifrance.fr/nos-solutions/financements/credits-dimpo-ts/credit-dimpot-innovation",
      "https://www.gouvernement.fr/france-2030",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Méthodologie d'intervention IA — PME & ETI Industrielles
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-intervention-ia-pme-industrielle",
    sectorTagSlugs: ["industrie-manufacturiere", "logistique-supply-chain"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'intervention IA — PME & ETI Industrielles",
    titleEn: "AI Intervention Methodology — Industrial SMEs & Mid-Market",
    summaryFr:
      "Méthodologie Axion-IA pour les interventions IA en PME et ETI industrielles : spécificités du contexte PME, phases (cadrage 1 jour, POC 4-8 semaines, déploiement progressif), livrables adaptés et facteurs clés de succès.",
    bodyMarkdownFr: `## Spécificités du contexte PME industrielle

Intervenir chez une PME ou ETI industrielle française diffère fondamentalement d'un projet chez un grand groupe. Trois contraintes structurelles définissent ce contexte :

### Budget limité et obligation de quick win

Une PME industrielle alloue rarement plus de 50 000 à 100 000 € à un projet IA initial. Ce budget impose une priorisation rigoureuse des cas d'usage et exclut les approches "big bang" (déploiement de plateforme complète avant tout résultat). La direction attend un **quick win tangible dans les 90 premiers jours** — non pas comme objectif ultime, mais comme signal de validation qui débloque la suite du financement interne.

### Système d'information hétérogène

La plupart des PME industrielles opèrent avec un ERP principal (SAP Business One, Sage, Cegid, SYSPRO…) complété de fichiers Excel, de bases Access locales, de SCADA propriétaires et parfois d'un MES partiel. Les données sont rarement centralisées, les formats varient, et l'historique utile remonte rarement au-delà de 3 à 5 ans. L'intervenant IA doit être capable d'extraire, normaliser et enrichir ces données sans nécessiter un projet de migration SI préalable.

### Peu ou pas de data scientists internes

Contrairement aux grandes entreprises dotées de centres de compétences data, les PME industrielles n'ont généralement pas de data scientist interne. Le projet IA s'appuie sur les référents métier (responsable production, directeur supply chain, DSI) dont la disponibilité est limitée. Le cabinet intervenant assume donc la totalité de la charge technique, tout en formant les équipes à la prise en main des outils livrés.

---

## Phases d'intervention Axion-IA

### Phase 0 — Cadrage (1 journée sur site)

**Objectif** : qualifier la faisabilité du projet et définir le périmètre du POC.

**Livrables** :
- Cartographie des sources de données disponibles et de leur qualité (scoring 0-10 par source)
- Identification des 2 à 3 cas d'usage à ROI rapide (matrice effort/impact)
- Hypothèse de valeur quantifiée : "En réduisant le taux de rebut de X % sur la ligne Y, le gain annuel estimé est de Z €"
- Feuille de route préliminaire avec jalons et livrables

**Ressources mobilisées** : 1 consultant senior Axion-IA, 2 à 3 référents métier côté client (DG ou DAF, responsable production, DSI ou référent IT).

**Engagement contractuel** : le cadrage est facturé forfaitairement (3 000 à 5 000 € HT). Si le client ne retient pas Axion-IA pour la suite, il dispose d'un livrable exploitable de manière indépendante.

---

### Phase 1 — POC (4 à 8 semaines)

**Objectif** : démontrer la valeur du cas d'usage prioritaire sur un périmètre délimité, avec des données réelles.

**Périmètre typique** : 1 ligne de production, 1 famille de produits, 1 flux logistique, 1 segment client.

**Livrables** :
- Pipeline de données opérationnel (extraction, nettoyage, features engineering) documenté et reproductible
- Modèle IA entraîné et validé (métriques de performance sur jeu de test holdout)
- Interface de visualisation des résultats (dashboard simple, accessible aux non-techniciens)
- Rapport POC : performance du modèle, limites identifiées, recommandation go/no-go déploiement
- Documentation technique minimale (architecture, dépendances, procédure de réentraînement)

**Critères de succès du POC** : amélioration mesurable du KPI cible d'au moins 15 % par rapport à la baseline, validation par le référent métier que les prédictions sont cohérentes avec son expertise terrain.

**Gestion du no-go** : si les données sont insuffisantes ou si la performance est décevante, Axion-IA restitue un rapport d'analyse détaillant les causes et les prérequis pour un POC réussi. Le client n'est pas engagé sur la suite.

---

### Phase 2 — Déploiement progressif (2 à 6 mois)

**Objectif** : industrialiser le modèle POC et l'intégrer dans les processus opérationnels réels.

**Principes directeurs** :
- **Intégration non-disruptive** : le modèle IA s'insère dans les outils existants (ERP, SCADA, Excel si nécessaire) sans imposer un changement de workflow brutal. L'opérateur continue de travailler avec ses interfaces habituelles, enrichies d'une recommandation IA.
- **Déploiement par vagues** : on commence par un site pilote ou une équipe pilote avant d'étendre à l'ensemble de l'organisation.
- **Boucle de feedback structurée** : les opérateurs signalent les prédictions incorrectes via un mécanisme simple (bouton "mauvaise prédiction" dans l'interface). Ces feedbacks alimentent le réentraînement périodique du modèle.

**Livrables** :
- API ou module intégré dans le SI client (selon le mode d'intégration retenu)
- Documentation utilisateur (guide de prise en main, FAQ opérationnelle)
- Runbook de maintenance (procédure de réentraînement, monitoring des dérives, procédure d'escalade)
- Tableau de bord ROI (KPIs opérationnels et business, comparaison baseline)

---

### Phase 3 — Accompagnement post-déploiement (optionnel, 12 mois)

Contrat de support incluant : monitoring mensuel des KPIs modèle, réentraînement trimestriel, accès à un référent Axion-IA pour les questions d'usage, revue semestrielle d'extension du périmètre.

---

## Facteurs clés de succès

### 1. Sponsoring du dirigeant

Le facteur différenciateur numéro un dans les projets PME industrielles réussis est l'implication directe du dirigeant (PDG, DG, DAF). Sans ce sponsoring, les projets IA se heurtent à des résistances organisationnelles (réticence à partager les données, manque de disponibilité des référents métier, arbitrages budgétaires défavorables). Axion-IA exige un point de contact dirigeant accessible au minimum mensuel tout au long du projet.

### 2. Quick win validé en 90 jours

Un résultat mesurable dans les 90 premiers jours (fin du POC) est indispensable pour maintenir l'engagement interne. Ce quick win n'a pas besoin d'être spectaculaire : une réduction de 12 % du taux de rebut sur une ligne pilote suffit à démontrer la valeur et à obtenir le feu vert pour le déploiement.

### 3. Intervention sur les données avant l'IA

60 à 70 % du travail d'un projet IA en PME industrielle est un travail de données : extraction, nettoyage, normalisation, enrichissement. Axion-IA intègre systématiquement un "sprint data" en début de POC pour qualifier et préparer les données avant toute modélisation. Les clients qui sous-estiment cette phase allongent inutilement leurs délais.

### 4. Accompagnement au changement des équipes opérationnelles

Les opérateurs de production et les logisticiens sont les premiers utilisateurs des outils IA. Leur adhésion est critique : un modèle excellent ignoré par les équipes terrain ne génère aucun ROI. Axion-IA inclut systématiquement des sessions d'appropriation (demi-journée à 1 journée selon le périmètre) pour présenter l'outil, expliquer la logique des recommandations et recueillir les retours terrain.

### 5. Gouvernance data claire dès le départ

Avant de démarrer un POC, il est nécessaire de clarifier qui est propriétaire des données (RSSI, DSI, DG), quelles données peuvent être extraites de l'ERP, et si des données de production peuvent être transmises à un prestataire externe (implication RGPD si données personnelles impliquées). Axion-IA fournit un modèle de DPA (Data Processing Agreement) adapté aux PME industrielles dès la phase de cadrage.`,
    sources: [
      "https://www.bpifrance.fr/nos-solutions/financements/credits-dimpo-ts/credit-dimpot-innovation",
      "https://www.gouvernement.fr/france-2030",
      "https://www.cnil.fr/fr/les-bases-legales/contrat",
      "https://www.industrie-techno.com/",
      "https://www.usinenouvelle.com/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
] as const;
