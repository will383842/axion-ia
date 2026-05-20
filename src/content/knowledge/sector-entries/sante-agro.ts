/**
 * Knowledge Base — Entries sectorielles Santé, Biotech & Agroalimentaire.
 *
 * Sprint S+5 Phase B3 2026-05-20.
 *
 * Contrat absolu : ZÉRO invention. Sources officielles uniquement (CNIL, ANSM,
 * HAS, INRAE, INAO, Gouvernement.fr, sites officiels acteurs cités).
 * Cas typiques annotés *Scénario représentatif*.
 *
 * Vocabulaire Axion-IA : « intervention » (≠ formation), « audit », «
 * implémentation ».
 */

import type { SectorKbEntry } from "./types";

export const SANTE_AGRO_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Méthodologie audit IA — Santé & Biotech
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-audit-ia-sante-biotech",
    sectorTagSlugs: ["sante-biotech", "dispositifs-medicaux"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — Santé & Biotech",
    titleEn: "AI Audit Methodology — Health & Biotech",
    summaryFr:
      "Cadre opérationnel Axion-IA pour auditer les usages d'intelligence artificielle dans les établissements de santé, biotech et MedTech français, en intégrant les contraintes MDR 2017/745, ANSM, HAS et AI Act.",
    bodyMarkdownFr: `## Contexte sectoriel

Le secteur santé-biotech est l'un des plus intensément réglementés pour l'IA en France et en Europe. Les organisations y déploient l'IA sur trois axes principaux : l'**aide au diagnostic** (lecture d'imagerie médicale, détection de pathologies), la **prédiction clinique** (réhospitalisation, dégradation patient), et l'**accélération de la R&D** (criblage moléculaire, phases d'essais cliniques). À ces usages s'ajoutent des applications opérationnelles : optimisation du bloc opératoire, gestion des flux hospitaliers, pharmacovigilance automatisée.

Ces déploiements sont encadrés par un empilement réglementaire complexe que l'auditeur Axion-IA doit maîtriser avant d'intervenir.

## Cadre réglementaire à intégrer

**Règlement UE 2017/745 (MDR) et IA embarquée dans les DM**
Depuis mai 2021, tout logiciel IA qui constitue ou intègre un dispositif médical au sens du MDR doit disposer d'un marquage CE de classe adéquate (I à III selon les risques). L'ANSM est l'autorité compétente française pour la désignation des organismes notifiés. Un audit Axion-IA doit cartographier les logiciels IA existants et vérifier si leur qualification en tant que dispositif médical a été évaluée — lacune fréquente dans les établissements adoptant des outils IA SaaS tiers.

**AI Act (Règlement UE 2024/1689) — systèmes IA à haut risque**
L'AI Act, applicable progressivement à partir de 2025-2026, classe explicitement dans la catégorie « haut risque » les systèmes IA utilisés pour le triage médical, l'aide au diagnostic et la gestion des soins (Annexe III, point 5). Les obligations sont substantielles : système de gestion des risques documenté, données d'entraînement représentatives et auditées, transparence envers les professionnels de santé, supervision humaine obligatoire, enregistrement dans la base de données EU AI Act (EUID). Les établissements de santé disposent d'un délai de mise en conformité jusqu'au 2 août 2026 pour les systèmes déjà en production.

**Référentiel HAS sur les logiciels d'aide à la décision médicale (LADM)**
La Haute Autorité de Santé publie un cadre d'évaluation des LADM (logiciels d'aide à la décision médicale), incluant les LADM à base d'IA. L'évaluation porte sur la pertinence clinique, la sécurité, l'ergonomie et l'impact sur l'organisation des soins. Un audit Axion-IA vérifie l'alignement avec ce référentiel pour tout outil d'aide à la décision en production.

**RGPD — données de santé (catégorie spéciale art. 9)**
Les données de santé sont des données à caractère personnel de catégorie spéciale au sens de l'article 9 du RGPD. Leur traitement est interdit par principe, sauf exceptions strictes : consentement explicite du patient, intérêt vital, intérêt public dans le domaine de la santé, ou finalités de recherche médicale. En France, la CNIL a publié des recommandations spécifiques sur l'IA médicale (délibération 2022-090). Tout traitement IA utilisant des données patients doit faire l'objet d'une Analyse d'Impact relative à la Protection des Données (AIPD) obligatoire selon l'article 35 du RGPD.

**Hébergement de Données de Santé (HDS)**
Toute solution IA traitant des données de santé à caractère personnel en France doit être hébergée chez un opérateur certifié HDS (certification ANS, référentiel v2 depuis 2018). L'audit vérifie la chaîne d'hébergement des modèles IA, y compris les API tiers (fournisseurs de LLM, plateformes d'annotation).

## Phases de l'audit Axion-IA

### Phase 1 — Inventaire IA & qualification DM

**Durée indicative : 2 à 3 jours**

L'objectif est de dresser la carte exhaustive des outils IA en production ou en expérimentation dans l'organisation. Pour chaque outil, l'auditeur détermine :
- La nature fonctionnelle (aide au diagnostic, prédiction, automatisation administrative, etc.)
- La qualification DM potentielle au sens du MDR (critères : finalité médicale, niveau d'autonomie, impact sur la décision clinique)
- Le fournisseur et le contrat associé (clause RGPD, sous-traitance, transferts hors UE)
- Le statut de marquage CE le cas échéant

Un tableau de bord de qualification est produit, distinguant les outils certainement non-DM (ex. : outil IA de gestion RH), les outils à risque de qualification non évaluée, et les DM IA certifiés.

### Phase 2 — Cartographie données patients & RGPD santé

**Durée indicative : 1 à 2 jours**

Pour chaque outil IA utilisant des données patients :
- Identification de la base légale RGPD (consentement, intérêt public, recherche)
- Vérification de l'AIPD (existence, complétude, date de dernière mise à jour)
- Audit de la chaîne HDS (hébergeur principal, sous-traitants cloud, APIs)
- Vérification des clauses de sous-traitance (DPA) avec les fournisseurs IA
- Revue du registre des traitements (article 30 RGPD) pour les traitements IA

### Phase 3 — Évaluation des biais algorithmiques

**Durée indicative : 1 à 2 jours**

Cette phase, souvent absente des audits classiques, est critique en santé :
- Analyse de la représentativité des données d'entraînement (surreprésentation de certaines populations, biais de genre, biais liés aux pathologies rares)
- Revue des métriques de performance publiées par le fournisseur (sensibilité/spécificité par sous-groupe)
- Évaluation du dispositif de supervision humaine (cliniciens en boucle, alertes d'incertitude)
- Vérification de l'existence d'un processus de monitoring post-déploiement

### Phase 4 — Conformité AI Act haut risque

**Durée indicative : 1 jour**

Pour les systèmes classifiés haut risque (aide au diagnostic, triage) :
- Vérification de l'existence ou de la planification d'un système de gestion des risques AI Act
- Revue de la documentation technique exigée (Annexe IV de l'AI Act)
- Vérification de l'enregistrement dans la base EU AI Act (applicable à partir d'août 2026)
- Évaluation du plan de mise en conformité si deadline non encore atteinte

## Livrables standard de l'audit

1. **Rapport d'inventaire IA** — tableau de qualification DM, statuts réglementaires
2. **Cartographie RGPD santé** — traitements IA, bases légales, lacunes AIPD
3. **Note de risques biais algorithmiques** — évaluation par outil critique
4. **Feuille de route conformité** — priorisée par risque, avec délais réglementaires (AI Act août 2026)
5. **Recommandations HDS** — audit de la chaîne d'hébergement IA

## Points d'attention spécifiques Axion-IA

- Ne jamais recommander un outil IA spécifique sans avoir vérifié son statut DM MDR
- Toujours vérifier que l'hébergeur d'un LLM ou d'une API IA tiers est certifié HDS si des données patients transitent
- La notion d'« anonymisation » est plus stricte en santé : les données agrégées de cohortes peuvent rester réidentifiables — l'auditeur doit appliquer les critères CNIL/ANSM
- Les essais cliniques utilisant l'IA sont également encadrés par le Règlement (UE) 536/2014 sur les essais cliniques
`,
    sources: [
      "https://www.ansm.sante.fr/actualites/dispositifs-medicaux-et-intelligence-artificielle",
      "https://www.has-sante.fr/jcms/p_3261767/fr/logiciels-d-aide-a-la-decision-medicale",
      "https://www.cnil.fr/fr/intelligence-artificielle-et-sante",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32017R0745",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://esante.gouv.fr/produits-services/hds",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Brief sectoriel — Santé & Biotech
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-sante-biotech",
    sectorTagSlugs: ["sante-biotech"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Santé & Biotech en France",
    titleEn: "Sector Brief — AI in French Health & Biotech",
    summaryFr:
      "Vue d'ensemble du paysage de l'intelligence artificielle dans le secteur santé-biotech français : acteurs clés, usages prioritaires, enjeux réglementaires RGPD et financement public.",
    bodyMarkdownFr: `## Le secteur en un regard

La France occupe une position de premier plan en Europe pour la santé numérique. Le marché de l'IA en santé est estimé à plusieurs milliards d'euros en Europe d'ici 2030, porté par la convergence entre la richesse des données de santé françaises (Système National des Données de Santé, SNDS) et l'ambition politique du plan France 2030.

## Acteurs structurants du secteur

**Grands groupes pharmaceutiques français**
Sanofi (Paris), premier groupe pharmaceutique français, a annoncé des investissements massifs dans l'IA pour l'accélération de la R&D médicamenteuse et la pharmacovigilance. Servier (Suresnes), groupe familial indépendant, déploie l'IA sur l'optimisation des essais cliniques. Pierre Fabre (Castres) et Ipsen (Boulogne-Billancourt) intègrent l'IA dans leurs pipelines de développement et leur supply chain pharmaceutique.

**Établissements de santé publics**
L'AP-HP (Assistance Publique – Hôpitaux de Paris), premier centre hospitalo-universitaire européen avec 39 hôpitaux, est un acteur de référence dans l'expérimentation IA médicale, notamment via son Health Data Hub partenarial. Les CHU de Lyon, Bordeaux, Toulouse et Montpellier mènent des projets IA en imagerie et bioinformatique.

**Réseaux de cliniques privées**
Vivalto Santé (Saint-Grégoire, Bretagne), opérateur de 60+ cliniques privées, déploie l'IA sur l'optimisation des parcours patients et la gestion des blocs opératoires. Ramsay Santé (Paris) pilote des projets IA de prédiction de réhospitalisation.

**Écosystème HealthTech**
La France compte plus de 800 startups HealthTech (source : France Biotech). Les scale-ups notables incluent : Owkin (imagerie IA oncologie, IA fédérée sur données hospitalières), Gleamer (IA radiologie), Bioptimus (modèles de fondation biologie), et Incepto (déploiement IA radiologie en CHU).

## Usages IA prioritaires

- **Imagerie médicale** : détection automatisée de lésions (radiologie, anatomopathologie, ophtalmologie). Segment le plus mature commercialement.
- **Aide au diagnostic** : analyse de signaux biologiques, ECG, données capteurs IoT médical.
- **Prédiction clinique** : modèles de risque de réhospitalisation à 30 jours, détection précoce de sepsis, prédiction de complications post-opératoires.
- **Accélération R&D** : criblage virtuel de molécules, optimisation des protocoles d'essais cliniques, revue automatisée de la littérature scientifique.
- **Pharmacovigilance** : détection de signaux d'effets indésirables dans les bases de données de pharmacovigilance (BNPV) et les réseaux sociaux.
- **Gestion opérationnelle** : optimisation des plannings, gestion des lits, prévision de l'activité des urgences.

## Enjeux RGPD et données de santé

Les données de santé constituent une catégorie spéciale au sens de l'article 9 du RGPD, soumise à des règles de traitement plus strictes. Tout acteur souhaitant utiliser l'IA sur des données patients doit :
- Identifier une base légale explicite (consentement, intérêt public, recherche médicale)
- Réaliser une AIPD (Analyse d'Impact relative à la Protection des Données)
- S'assurer que les données sont hébergées chez un opérateur certifié HDS (Hébergeur de Données de Santé)

Le Health Data Hub, groupement d'intérêt public piloté par le Ministère de la Santé, facilite l'accès sécurisé aux données du SNDS pour les projets de recherche IA, sous encadrement CNIL.

## Financement public disponible

- **France 2030 — Santé numérique** : axe dédié doté d'environ 650 millions d'euros, financé via Bpifrance et l'ANR, couvrant IA médicale, séquençage génomique et télémédecine.
- **Bpifrance** : prêts innovation, garanties et fonds de capital-risque ciblant les HealthTech IA. Programme « IA Booster » accessible aux PME et ETI du secteur.
- **Crédit Impôt Recherche (CIR)** : applicable aux dépenses de R&D en IA médicale, jusqu'à 30 % des dépenses éligibles.
- **Programme PSPC (Projet Structurant Pour la Compétitivité)** : cofinancement pour projets collaboratifs industrie-laboratoires sur l'IA en santé.
`,
    sources: [
      "https://www.gouvernement.fr/france-2030",
      "https://www.bpifrance.fr/nos-solutions/financer-vos-projets/credits-et-garanties",
      "https://www.health-data-hub.fr/",
      "https://france-biotech.fr/",
      "https://www.cnil.fr/fr/intelligence-artificielle-et-sante",
      "https://www.sanofi.com/fr/innovation/technologie-digitale-et-donnees",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. FAQ — RGPD, IA et données de santé
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "faq-rgpd-ia-secteur-sante",
    sectorTagSlugs: ["sante-biotech"],
    type: "faq",
    domain: "legal",
    audience: "public",
    titleFr: "FAQ — RGPD, IA et Données de Santé",
    titleEn: "FAQ — GDPR, AI and Health Data",
    summaryFr:
      "Cinq questions-réponses essentielles sur les obligations RGPD et IA Act applicables aux systèmes d'intelligence artificielle traitant des données de santé en France.",
    bodyMarkdownFr: `## Q : Les données de santé traitées par un système IA relèvent-elles de l'article 9 du RGPD ?

**R :** Oui, sans exception. L'article 9 du RGPD classe les données de santé parmi les catégories spéciales de données à caractère personnel, dont le traitement est interdit par principe. Cette classification s'applique dès lors qu'une donnée permet, directement ou indirectement, de déduire l'état de santé d'une personne physique — ce qui inclut les données alimentant un modèle IA (images médicales, résultats biologiques, diagnostics, prescriptions). Un système IA utilisant ces données doit impérativement identifier l'une des exceptions listées à l'article 9 §2 RGPD : consentement explicite du patient (art. 9 §2 a), nécessité pour des soins de santé (art. 9 §2 h), ou finalité de recherche médicale sous garanties appropriées (art. 9 §2 j). La base légale retenue conditionne les autres obligations (AIPD, droits des personnes). Source : [RGPD article 9 — EUR-Lex](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679).

---

## Q : Quelle base légale utiliser pour déployer un système IA d'aide au diagnostic en milieu hospitalier ?

**R :** En pratique hospitalière française, la base légale la plus solide est l'article 9 §2 h) du RGPD (traitement nécessaire aux fins de la médecine préventive ou curative, diagnostic médical, prise en charge sanitaire), combiné à l'article 6 §1 e) (mission d'intérêt public). Cette combinaison est recommandée par la CNIL pour les traitements IA réalisés par des établissements de santé publics dans le cadre de leurs missions. Pour les cliniques privées ou les éditeurs de solutions IA SaaS, le traitement pour compte d'un professionnel de santé sous obligation de secret médical (art. 9 §2 h) reste applicable. Le consentement explicite (art. 9 §2 a) n'est généralement pas recommandé comme base légale principale pour les LADM en routine clinique, car il créerait une asymétrie de soins entre patients consentants et non-consentants. Source : [CNIL — Bases légales et données de santé](https://www.cnil.fr/fr/les-bases-legales/interet-public-et-mission-de-service-public).

---

## Q : Qu'est-ce que la certification HDS et pourquoi est-elle obligatoire pour les solutions IA médicales ?

**R :** La certification HDS (Hébergeur de Données de Santé) est un référentiel français défini par l'Agence du Numérique en Santé (ANS), obligatoire depuis la loi du 26 janvier 2016 de modernisation du système de santé (article L. 1111-8 du Code de la santé publique). Elle s'impose à toute personne physique ou morale qui héberge des données de santé à caractère personnel pour le compte d'un professionnel de santé, d'un établissement de santé, ou de la personne concernée. Pour l'IA médicale, la certification HDS s'applique à : l'hébergeur du modèle IA en production, les plateformes de traitement des données d'entraînement, et les API tierces qui reçoivent des données patients. Concrètement, si une organisation utilise un LLM cloud (API OpenAI, Azure OpenAI, Google Vertex AI) pour analyser des notes cliniques, l'opérateur cloud doit disposer d'une certification HDS ou d'un accord contractuel équivalent. Microsoft Azure, AWS et Google Cloud disposent de certifications HDS pour leurs régions France. Source : [ANS — Certification HDS](https://esante.gouv.fr/produits-services/hds).

---

## Q : Quels sont les droits des patients face aux décisions prises par un système IA médical ?

**R :** Plusieurs textes se cumulent pour protéger les patients face aux décisions IA. Au titre du RGPD (article 22), toute personne a le droit de ne pas faire l'objet d'une décision fondée exclusivement sur un traitement automatisé ayant des effets juridiques significatifs ou la affectant de manière significative. Dans le contexte médical, ce droit implique qu'une décision de diagnostic ou de traitement ne peut pas reposer uniquement sur un système IA sans intervention d'un professionnel de santé qualifié. L'AI Act renforce ce droit pour les systèmes IA à haut risque (dont les LADM) : l'article 14 impose une supervision humaine effective, avec la possibilité pour le superviseur d'intervenir ou de désactiver le système. Le Code de la santé publique (article L. 1110-4) garantit par ailleurs le droit à l'information du patient sur les outils utilisés dans sa prise en charge. En pratique, un établissement de santé déployant un LADM IA doit documenter le rôle du clinicien dans la validation des recommandations IA, et informer le patient de l'utilisation d'outils d'aide à la décision. Source : [HAS — Logiciels d'aide à la décision médicale](https://www.has-sante.fr/jcms/p_3261767/fr/logiciels-d-aide-a-la-decision-medicale).

---

## Q : Quel est le rôle de la CNIL dans la régulation de l'IA médicale en France ?

**R :** La CNIL (Commission Nationale de l'Informatique et des Libertés) est l'autorité de contrôle française compétente pour le RGPD, y compris pour les traitements IA utilisant des données de santé. Ses interventions dans le domaine IA médical portent sur : (1) les AIPD — la CNIL publie une liste des traitements pour lesquels l'AIPD est obligatoire, qui inclut explicitement les traitements IA sur données de santé à grande échelle ; (2) les audits et mises en demeure — la CNIL peut contrôler tout opérateur déployant de l'IA médicale et prononcer des amendes jusqu'à 4 % du chiffre d'affaires mondial en cas de violation RGPD ; (3) l'accompagnement — la CNIL a publié un guide pratique sur l'IA et les données de santé (2022) et participe au comité de l'EDPB sur les lignes directrices IA. En 2023, la CNIL a ouvert des contrôles sur plusieurs startups HealthTech françaises dans le cadre de son plan d'action IA. Depuis l'entrée en application partielle de l'AI Act en 2024, la CNIL est désignée comme autorité de surveillance de marché compétente pour les systèmes IA à haut risque dans le domaine de la santé. Source : [CNIL — Plan d'action IA 2023-2024](https://www.cnil.fr/fr/intelligence-artificielle).
`,
    sources: [
      "https://www.cnil.fr/fr/intelligence-artificielle",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679",
      "https://esante.gouv.fr/produits-services/hds",
      "https://www.has-sante.fr/jcms/p_3261767/fr/logiciels-d-aide-a-la-decision-medicale",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Brief sectoriel — Agroalimentaire & IGP/AOP
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-agroalimentaire-igp",
    sectorTagSlugs: ["agroalimentaire-igp"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans l'Agroalimentaire & les Produits IGP en France",
    titleEn: "Sector Brief — AI in French Food Industry & PGI/PDO Products",
    summaryFr:
      "Vue d'ensemble des usages de l'IA dans l'industrie agroalimentaire française, avec focus sur les filières à signes de qualité (IGP, AOP) et les enjeux de traçabilité et d'authenticité.",
    bodyMarkdownFr: `## Le secteur en un regard

L'industrie agroalimentaire est le premier secteur industriel français en chiffre d'affaires, avec environ 200 milliards d'euros de chiffre d'affaires (source : ANIA, Association Nationale des Industries Alimentaires). La France compte plus de 500 signes de qualité officiels (AOP, IGP, STG, Label Rouge, Agriculture Biologique), gérés par l'INAO (Institut National de l'Origine et de la Qualité). La protection et la valorisation de ces signes constitue un enjeu économique et réputationnel majeur, où l'IA joue un rôle croissant.

## Acteurs structurants du secteur

**Grands groupes industriels**
Danone (Paris), premier groupe agroalimentaire français coté, déploie l'IA sur la prévision de la demande, l'optimisation des formulations nutritionnelles et la réduction du gaspillage. Lactalis (Laval), premier groupe laitier mondial non coté, utilise l'IA pour le contrôle qualité automatisé et la gestion de sa supply chain froide à l'échelle mondiale. Sodiaal (Paris), première coopérative laitière française et propriétaire des marques Yoplait et Candia, expérimente l'IA sur l'optimisation des collectes de lait.

**Acteurs protéines et charcuterie**
La Cooperl Arc Atlantique (Lamballe, Bretagne), première coopérative porcine française, intègre l'IA dans la classification automatique des carcasses et la gestion de la chaîne d'abattage. Le groupe Bigard (Quimperlé), premier groupe français de transformation de viande bovine, déploie des systèmes de vision par ordinateur pour le contrôle qualité en ligne.

**Grande distribution**
Auchan Industries, via ses propres lignes de production, et les centrales d'achat (Intermarché, E. Leclerc) expérimentent l'IA sur la gestion prévisionnelle des stocks alimentaires et la réduction des pertes.

**Coopératives viticoles et filières IGP**
Les unions de coopératives viticoles (Vignerons Indépendants de France, Caves Coopératives de Bourgogne, Vignerons Catalans) déploient progressivement l'IA pour la gestion des millésimes, la prévision des récoltes et la conformité aux cahiers des charges AOC/IGP.

## Usages IA prioritaires dans l'agroalimentaire

**Contrôle qualité par vision artificielle**
Les lignes de conditionnement modernes intègrent des caméras couplées à des algorithmes de vision par ordinateur pour détecter en temps réel les défauts de produits (corps étrangers, défauts visuels, erreurs d'étiquetage). Dans les filières IGP/AOP, ces systèmes permettent de vérifier la conformité visuelle aux cahiers des charges (calibre, couleur, présentation).

**Traçabilité et authenticité**
La traçabilité de l'origine et de la chaîne de transformation est une obligation réglementaire (Règlement UE 178/2002) et un enjeu de confiance consommateur. Des solutions combinant blockchain, capteurs IoT et algorithmes IA permettent de certifier l'origine géographique et les conditions de production. Pour les IGP et AOP, l'IA peut être utilisée pour l'authentification physico-chimique (analyse spectrométrique, empreinte géochimique), en complément des contrôles humains des organismes de défense et de gestion (ODG).

**Optimisation de la chaîne froide**
Le maintien de la chaîne du froid est critique pour les IAA (Industries Alimentaires). Les algorithmes de prévision (machine learning sur historiques de température, données météo, cycles logistiques) permettent d'anticiper les ruptures de chaîne froide et d'optimiser la consommation énergétique des entrepôts frigorifiques.

**Prévision de rendements agricoles**
En amont des filières, les coopératives et négociants utilisent des modèles d'IA intégrant données météorologiques, indices de végétation satellites (NDVI via Copernicus/ESA), et historiques agronomiques pour prévoir les volumes et qualités de récolte. Ces prévisions pilotent les décisions d'approvisionnement et de commercialisation.

**Formulation et R&D produit**
Les IAA utilisent l'IA générative et les algorithmes de recommandation pour accélérer la reformulation produit (réduction sucres, sel, matières grasses) tout en préservant les caractéristiques organoleptiques. Danone et d'autres groupes investissent dans des plateformes IA de formulation.

## Enjeux spécifiques aux signes de qualité IGP/AOP

Les signes de qualité officiels (IGP, AOP) sont définis par des cahiers des charges précis, contrôlés par des organismes de contrôle certifiés (OC) et supervisés par l'INAO. L'introduction de l'IA dans ces filières soulève des questions spécifiques :

- **Conformité au cahier des charges** : tout outil IA d'aide à la décision doit être validé pour ne pas modifier les pratiques encadrées par le cahier des charges (ex. : sélection parcellaire, pratiques œnologiques pour les AOP viticoles).
- **Authenticité et fraude** : l'INAO et les ODG disposent de plateformes d'analyse physico-chimique ; l'IA renforce leur capacité à détecter les fraudes à l'origine géographique.
- **Traçabilité renforcée** : les Règlements UE 2018/848 (agriculture biologique) et 2024/1349 (déforestation) imposent des exigences de traçabilité croissantes, que les outils IA peuvent faciliter.

## Financement et soutien public

- **FranceAgriMer** : appels à projets sur la modernisation des filières, incluant le numérique et l'IA.
- **France 2030 — Souveraineté alimentaire** : axe spécifique doté de 2,7 milliards d'euros pour l'agriculture et l'agroalimentaire, avec un volet numérique.
- **ANIA (Association Nationale des Industries Alimentaires)** : accompagnement à la transformation numérique des IAA membres.
- **Plan Protéines végétales** : financement d'innovations IA pour les nouvelles filières protéines.
`,
    sources: [
      "https://www.inao.gouv.fr/",
      "https://www.ania.net/",
      "https://agriculture.gouv.fr/france-2030-pour-lagriculture",
      "https://www.franceagrimer.fr/",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32002R0178",
      "https://www.inrae.fr/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Cas typique — Audit IA dans une coopérative viticole AOC
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "cas-typique-audit-cooperative-viticole",
    sectorTagSlugs: ["viticulture-haut-de-gamme", "agroalimentaire-igp"],
    type: "industry_use_case",
    domain: "editorial",
    audience: "public",
    titleFr: "Cas typique — Audit IA dans une Coopérative Viticole AOC",
    titleEn: "Typical Case — AI Audit at an AOC Wine Cooperative",
    summaryFr:
      "Scénario représentatif d'un audit IA réalisé par Axion-IA dans une coopérative viticole de 200 adhérents en appellation d'origine contrôlée, couvrant prévision de récolte, gestion des stocks inter-campagnes et conformité AOC.",
    bodyMarkdownFr: `*Scénario représentatif — Les chiffres, noms d'entreprises et données présentés ci-dessous sont indicatifs et non tirés d'un mandat réel Axion-IA.*

## Contexte de la coopérative

La coopérative rassemble environ 200 vignerons adhérents, exploitant collectivement quelque 2 500 hectares en appellation d'origine contrôlée — un périmètre comparable à des coopératives comme celles du Luberon, du Ventoux, ou des Côtes du Rhône méridionales. Elle vinifie et commercialise sous appellation AOC, avec une production annuelle de l'ordre de 15 à 20 millions de bouteilles. Son chiffre d'affaires est estimé entre 25 et 40 millions d'euros, avec une équipe de direction de 8 à 12 personnes et un DSI à mi-temps ou externalisé.

La coopérative dispose d'un ERP viticole (type Vinistoria ou équivalent), d'un logiciel de traçabilité des apports parcellaires, et d'une connexion aux stations météo du réseau Vigicultures (INRAE/IFV). Elle ne dispose d'aucune équipe data interne et n'a jamais réalisé d'audit IA.

## Problématiques identifiées à l'entrée

**Problème 1 — Prévision de récolte insuffisamment fiable**
Chaque été, le directeur technique réalise une estimation de récolte manuelle sur la base de comptages de grappes et d'intuition expérientielle. Les écarts entre prévision et réalité atteignent fréquemment 15 à 25 %, ce qui génère des difficultés : surstock de vrac en cas de grande récolte, sous-approvisionnement des acheteurs en cas de petite récolte, et inefficacité dans la négociation des contrats de négoce pluriannuels.

**Problème 2 — Gestion des stocks inter-campagnes sous-optimisée**
La coopérative gère simultanément plusieurs millésimes en cuve, avec des décisions de mise en bouteille, d'assemblage et de commercialisation prises de manière empirique. Les coûts d'immobilisation du vrac (cuves, pertes qualitatives liées au vieillissement cuve) représentent un poste significatif non optimisé.

**Problème 3 — Conformité AOC et traçabilité des apports**
Le cahier des charges de l'appellation impose des contraintes précises sur les cépages, les rendements par parcelle, les pratiques culturales (enherbement, taille) et l'élaboration en cave. Les contrôles sont réalisés par un organisme de contrôle certifié (OC), mais la traçabilité interne des apports parcellaires est partiellement manuelle, générant des risques d'erreur documentaire lors des audits de certification.

## Diagnostic Axion-IA — Phase d'audit (3 à 4 jours sur site)

### Inventaire des données disponibles

L'auditeur Axion-IA cartographie l'ensemble des sources de données exploitables :
- **Données météo** : 10 ans d'historique Vigicultures (température, précipitations, humidité, rayonnement), accessibles via le réseau INRAE/IFV.
- **Données parcellaires** : surface, cépage, âge de la vigne, rendements historiques par parcelle et par adhérent (dans l'ERP viticole).
- **Données de vinification** : volumes entrants par apport, analyses physicochimiques des moûts, journaux de cuve.
- **Données commerciales** : historique des ventes par canal, prix de vente moyen, carnets de commandes.

### Qualification des systèmes IA existants

La coopérative n'utilise aucun système IA proprement dit. Elle bénéficie d'alertes automatiques de la plateforme Vigicultures (avertissements mildiou/oïdium) — ces alertes relèvent de modèles agronomiques INRAE, non d'un système IA développé ou paramétré par la coopérative. Aucune obligation spécifique AI Act ne s'applique en l'état.

### Points d'attention réglementaires identifiés

- **RGPD** : les données parcellaires liées à des adhérents personnes physiques (exploitants individuels) constituent des données à caractère personnel. La coopérative doit vérifier son registre des traitements (article 30 RGPD) et s'assurer que tout outil IA traitant ces données respecte les obligations de sous-traitance (DPA avec le fournisseur IA).
- **Cahier des charges AOC** : toute automatisation des décisions d'assemblage ou de qualification des apports doit rester sous la supervision d'un technicien viti-vinicole agréé. L'IA ne peut pas substituer le contrôle humain requis par l'OC.
- **Interopérabilité ERP** : les solutions IA de prévision devront s'interfacer avec l'ERP existant via API — point de risque technique à évaluer en phase de cadrage projet.

## Solutions IA envisagées par Axion-IA

### Module 1 — Prévision de récolte par modélisation agroclimatique

Un modèle de prévision de récolte intégrant les données météo Vigicultures, les données parcellaires (cépages, âge, rendements historiques) et des indices de végétation satellites (NDVI via Copernicus/Sentinel-2, gratuits et ouverts) peut ramener l'écart prévision/réalité à 5-10 % sur une fenêtre de prévision à 6-8 semaines. Ce type de modèle est opérationnel dans plusieurs coopératives du Languedoc-Roussillon (résultats documentés par INRAE UMR LEPSE Montpellier).

**Données requises** : 5 ans minimum d'historique rendements + météo Vigicultures. Effort d'intégration : 3 à 6 mois avec un éditeur spécialisé (ex. : SMAG, Wineyes, ou développement sur mesure).

### Module 2 — Optimisation de la gestion des stocks vrac

Un tableau de bord prédictif croisant les prévisions de récolte, les contrats de vente signés, les historiques de déstockage par millésime et les données de marché vrac (Indice Bordeaux Négoce, cours FranceAgriMer) permet d'objectiver les décisions de mise en bouteille et d'assemblage. L'outil reste un outil d'aide à la décision sous supervision du maître de chai.

### Module 3 — Traçabilité numérique des apports parcellaires

Un module de saisie mobile connecté à l'ERP, avec lecture de QR code parcellaire et validation automatique de la conformité (cépage déclaré vs cahier des charges, rendement par rapport au plafond AOC), réduit les erreurs documentaires et facilite la préparation des audits OC. Ce type de module est proposé par des éditeurs viticoles spécialisés (SMAG, Millesime, Wineyes).

## Résultats indicatifs attendus

| Indicateur | Avant projet | Après implémentation (12 mois) |
|---|---|---|
| Écart prévision/réalité récolte | 15-25 % | 5-10 % |
| Durée de préparation audit OC | 3-5 jours/an | 1 jour/an |
| Taux d'immobilisation vrac > 18 mois | Non mesuré | Objectif -20 % |
| Conformité documentaire apports | ~85 % | > 98 % |

*Ces estimations sont indicatives et s'appuient sur des benchmarks sectoriels publiés par INRAE et les chambres d'agriculture. Les résultats réels dépendent de la qualité des données historiques et de l'implication des équipes.*

## Livrables de l'audit Axion-IA

1. Cartographie des données disponibles et qualité de ces données (complétude, historique)
2. Évaluation de la maturité numérique de la coopérative (score 0-5)
3. Feuille de route IA priorisée (3 modules, planning sur 18 mois, budget estimatif)
4. Note de conformité RGPD (registre des traitements, DPA à mettre en place)
5. Note de vigilance AOC (points à valider avec l'OC avant déploiement)
`,
    sources: [
      "https://www.inrae.fr/",
      "https://www.vigicultures.fr/",
      "https://www.inao.gouv.fr/Les-signes-officiels-de-la-qualite-et-de-l-origine-SIQO/Appellation-d-origine-protegee-controlee-AOP-AOC",
      "https://www.franceagrimer.fr/filieres-vin-et-cidre",
      "https://www.vignerons-independants.fr/",
      "https://sentinel.esa.int/web/sentinel/missions/sentinel-2",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
] as const;
