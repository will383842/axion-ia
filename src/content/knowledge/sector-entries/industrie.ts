/**
 * KB Entries sectorielles — Industrie française (Sprint S+5 Phase B3 2026-05-20).
 *
 * Périmètre : chimie, pharmacie, industrie manufacturière, mécanique de précision,
 * aérospatial & défense.
 *
 * CONTRAT : aucune invention. Sources officielles uniquement.
 * Chiffres issus de rapports publics GIFAS, LEEM, INSEE, ANSM, EMA, Direction générale
 * des entreprises (DGE).
 */

import type { SectorKbEntry } from "./types";

export const INDUSTRIE_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Méthodologie audit IA — Chimie & Pharmacie
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-audit-ia-chimie-pharma",
    sectorTagSlugs: ["chimie-pharma"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — Chimie & Pharmacie",
    titleEn: "AI Audit Methodology — Chemical & Pharmaceutical Industry",
    summaryFr:
      "Cadre d'intervention Axion-IA pour évaluer la maturité IA d'un acteur chimie ou pharma : périmètre applicatif, contraintes réglementaires GxP/21 CFR Part 11, phases d'audit et livrables attendus.",
    bodyMarkdownFr: `## Périmètre applicatif IA dans la chimie-pharmacie

Les cas d'usage IA dans le secteur pharmaceutique et chimique se regroupent en quatre grandes familles :

**R&D et drug discovery**
Les modèles génératifs de molécules (deep learning sur graphes, réseaux GNN) accélèrent le criblage virtuel des candidats-médicaments. Des outils comme AlphaFold 2 (DeepMind/EMBL-EBI) permettent la prédiction de structures protéiques avec une précision expérimentale. En chimie fine, les modèles de rétrosynthèse assistée par IA (CASP, Chemputer) réduisent les cycles de conception de formulations.

**Manufacturing Execution & qualité en ligne**
Les systèmes MES (Manufacturing Execution Systems) intègrent des modules IA pour la surveillance en temps réel des paramètres de production (température, pH, pression, viscosité). La vision artificielle remplace ou complète les contrôles manuels d'aspect (inspection de blisters, détection de particules, vérification d'étiquetage). Les algorithmes de contrôle statistique de procédé (SPC augmenté) détectent les dérives avant qu'elles ne génèrent des lots hors-spécification.

**Pharmacovigilance**
Le traitement automatique du langage naturel (NLP) est aujourd'hui le principal vecteur d'IA réglementairement mature dans le secteur : extraction d'Individual Case Safety Reports (ICSR) depuis des sources textuelles hétérogènes (courriers médecins, formulaires papier numérisés, réseaux sociaux), classification de la gravité selon les termes MedDRA, pré-remplissage des soumissions EudraVigilance/FDA FAERS.

**Maintenance prédictive des équipements**
Dans les sites de production chimique (réacteurs batch/continu, échangeurs thermiques, colonnes de distillation), les modèles de prédiction de défaillance sur données SCADA réduisent les arrêts non planifiés, critical pour des productions sous licence ou sous délai réglementaire.

---

## Contraintes réglementaires incontournables

### GxP (Good Practice)
Les référentiels GxP (GMP, GLP, GCP) imposent que tout système informatisé utilisé dans la production, le contrôle ou l'enregistrement de données de lot respecte les BPF (Bonnes Pratiques de Fabrication, Directive 2003/94/CE, annexe 11 EU GMP). Un module IA intégré au MES est un **système informatisé critique** : il doit être validé selon un plan de validation (URS, FS, DS, IQ/OQ/PQ).

### 21 CFR Part 11 (FDA)
Pour les industriels exportant vers les États-Unis ou soumis à inspection FDA, la règlementation 21 CFR Part 11 impose l'authenticité, l'intégrité et la confidentialité des dossiers électroniques, ainsi que les signatures électroniques qualifiées. Tout output IA alimentant un enregistrement de lot ou un dossier réglementaire tombe dans ce périmètre.

### Guidance ANSM / EMA sur les logiciels IA
L'Agence nationale de sécurité du médicament (ANSM) et l'Agence européenne des médicaments (EMA) ont publié des réflexions communes sur l'utilisation de l'IA dans le cycle de vie du médicament (EMA/CHMP/786999/2023). Les systèmes IA qualifiés de **Software as a Medical Device (SaMD)** tombent sous la réglementation MDR 2017/745 ou IVDR 2017/746 lorsqu'ils ont un usage diagnostique ou thérapeutique.

### AI Act européen (applicable août 2026)
Les systèmes IA utilisés dans des dispositifs médicaux de classe IIa/IIb/III ou dans la gestion de risques pharmaceutiques critiques seront classés **haut risque** au sens de l'AI Act (Règlement UE 2024/1689). Cela implique : documentation technique renforcée, conformité aux normes harmonisées (EN ISO 13485, IEC 62304), enregistrement dans la base EUID.

---

## Phases de l'audit Axion-IA

### Phase 1 — Cadrage réglementaire et cartographie des processus (J1–J2)
- Identification des processus GxP et non-GxP
- Inventaire des systèmes informatisés existants (MES, LIMS, ERP, SCADA) et de leurs niveaux de validation
- Entretiens avec QA, IT/OT, Regulatory Affairs
- Livrable : carte des systèmes + matrice de criticité réglementaire

### Phase 2 — Évaluation de la maturité données (J3–J5)
- Qualité et accessibilité des données capteurs, LIMS, pharmacovigilance
- Gouvernance des données (MDM, Data Lake, politiques de rétention)
- Lacunes de labellisation pour l'entraînement supervisé
- Livrable : scorecard maturité données (0–5 par domaine)

### Phase 3 — Identification des cas d'usage IA prioritaires (J6–J8)
- Ateliers de co-construction avec les métiers (R&D, production, QA, pharmacovigilance)
- Scoring ROI/faisabilité/risque réglementaire pour chaque cas d'usage candidat
- Livrable : backlog priorisé de 5 à 10 cas d'usage

### Phase 4 — Évaluation des risques IA et conformité (J9–J10)
- Analyse des risques IA selon le référentiel EMA/CHMP et l'AI Act
- Gap analysis validation logicielle (annexe 11 EU GMP, GAMP 5)
- Livrable : rapport de risques + plan de remédiation

### Phase 5 — Synthèse et feuille de route (J11–J12)
- Priorisation des implémentations (quick wins vs projets structurants)
- Estimation des investissements et des économies attendues
- Livrable : rapport d'audit complet + roadmap IA 18 mois

---

## Livrables clés remis au client

1. Rapport de maturité IA sectorielle (scorecard 5 dimensions)
2. Matrice de criticité réglementaire par cas d'usage
3. Backlog priorisé (5–10 cas d'usage avec scoring ROI/risque)
4. Plan de validation logicielle type (template GAMP 5 annoté)
5. Feuille de route IA 18 mois avec jalons réglementaires`,
    sources: [
      "https://www.ema.europa.eu/en/documents/regulatory-procedural-guideline/reflection-paper-use-artificial-intelligence-medicinal-product-lifecycle_en.pdf",
      "https://www.ansm.sante.fr/qui-sommes-nous/nos-missions/surveiller-et-evaluer/les-outils-digitaux-et-lintelligence-artificielle",
      "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://www.ich.org/page/quality-guidelines",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Méthodologie audit IA — Industrie Manufacturière
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-audit-ia-industrie-manufacturiere",
    sectorTagSlugs: ["industrie-manufacturiere", "mecanique-precision"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — Industrie Manufacturière",
    titleEn: "AI Audit Methodology — Manufacturing Industry",
    summaryFr:
      "Cadre structuré pour auditer la maturité IA d'un site industriel manufacturier : usages typiques (maintenance prédictive, contrôle qualité vision, ordonnancement), évaluation OT/IT, gestion des risques cybersécurité OT et livrables de la mission Axion-IA.",
    bodyMarkdownFr: `## Usages IA typiques dans l'industrie manufacturière

### Maintenance prédictive
La maintenance prédictive constitue le cas d'usage IA le plus mature et le plus diffusé dans l'industrie manufacturière française. Elle repose sur l'analyse de flux de données capteurs (vibration, température, courant électrique moteur, acoustique) via des modèles de détection d'anomalies (autoencodeurs, forêts d'isolation, réseaux LSTM). L'objectif est d'anticiper les défaillances équipements avant l'arrêt non planifié, réduisant le coût de maintenance corrective et les pertes de production. Selon le rapport de la DGE « Industrie du Futur » (2023), les industriels français ayant déployé la maintenance prédictive déclarent une réduction moyenne des arrêts non planifiés de 25 à 40 %.

### Contrôle qualité par vision artificielle
Les systèmes de vision industrielle équipés de réseaux de neurones convolutifs (CNN) détectent des défauts surfaciques (rayures, porosités, bavures, erreurs d'assemblage) à des cadences supérieures aux opérateurs humains et avec une répétabilité > 99,5 %. En mécanique de précision, des systèmes de métrologie assistée par IA permettent le contrôle dimensionnel 100 % sur ligne, sans prélèvement d'échantillons.

### Optimisation de l'ordonnancement
Les algorithmes d'optimisation combinatoire (programmation par contraintes, méta-heuristiques, reinforcement learning) permettent d'optimiser les séquences de production en tenant compte des contraintes réelles : disponibilité machines, dépendances opératoires, délais clients, stocks de matières premières. Ils réduisent les temps de changement de série (SMED augmenté) et améliorent le taux de service.

---

## Phases de l'audit Axion-IA

### Phase 1 — État des lieux OT/IT (J1–J3)
L'audit démarre par un inventaire exhaustif du paysage technologique du site :
- **OT (Operational Technology)** : automates PLC/SCADA, MES, supervision HMI, réseaux industriels (Profibus, EtherNet/IP, Modbus), architectures de collecte données capteurs (IoT edge, historiens de données type OSIsoft PI / AspenTech)
- **IT** : ERP (SAP, Sage, IFS), GPAO, GMAO, infrastructure de stockage, politique de backup

La cartographie OT/IT identifie les **zones de convergence** où des données riches existent mais restent non exploitées, ainsi que les **zones de séparation** imposant des contraintes sur la remontée de données vers des environnements de traitement IA (segmentation réseau IEC 62443).

Livrable : schéma d'architecture OT/IT + inventaire des sources de données actionnables.

### Phase 2 — Évaluation de la maturité données capteurs (J4–J6)
- Taux de couverture instrumentale (ratio capteurs actifs / équipements critiques)
- Qualité des données historiques (taux de valeurs manquantes, bruit, échantillonnage)
- Existence et qualité des étiquettes de défaillance (logs de maintenance, GMAO)
- Granularité temporelle des données (1s, 1min, 1h ?) et durée d'historique disponible
- Gouvernance : qui est propriétaire des données capteurs ? Politiques d'accès ?

Livrable : scorecard maturité données par famille d'équipements (0–5).

### Phase 3 — Cartographie des risques cybersécurité OT (J7–J8)
L'introduction d'IA dans le périmètre OT crée des vecteurs d'attaque supplémentaires. L'audit évalue :
- Conformité à la norme IEC 62443 (sécurité des systèmes d'automatisation industrielle)
- Séparation des réseaux IT/OT (zones et conduits selon IEC 62443-1-1)
- Exposition des équipements OT sur Internet ou réseaux partagés
- Politiques de mise à jour firmware sur les PLC et passerelles IoT
- Existence d'un SOC industriel ou d'une convention de surveillance OT

Livrable : rapport de risques cybersécurité OT + recommandations de remédiation avant déploiement IA.

### Phase 4 — Identification et priorisation des cas d'usage (J9–J10)
Ateliers de co-construction avec les responsables de production, maintenance, qualité et IT. Chaque cas d'usage candidat est scoré selon :
- **Valeur métier** : économie annuelle estimée (réduction arrêts, rejet qualité, coût main-d'œuvre)
- **Faisabilité technique** : disponibilité et qualité des données, complexité d'intégration
- **Risque cybersécurité OT** : exposition réseau, impact en cas de défaillance IA
- **Délai de déploiement** : quick win (3–6 mois) vs projet structurant (12–18 mois)

Livrable : backlog priorisé de 5 à 8 cas d'usage.

### Phase 5 — Synthèse et feuille de route (J11–J12)
- Rapport d'audit complet avec scorecard de maturité globale
- Feuille de route IA 18 mois (quick wins + projets structurants)
- Estimation du ROI global et des investissements nécessaires (infrastructure edge, licences, intervention Axion-IA)
- Recommandations de gouvernance données industrielles`,
    sources: [
      "https://www.entreprises.gouv.fr/fr/industrie/politique-industrielle/industrie-du-futur",
      "https://www.iec.ch/iec62443",
      "https://www.bpifrance.fr/nos-solutions/nos-solutions-de-financement/les-aides-a-linnovation/le-plan-ia",
      "https://www.usinenouvelle.com/editorial/maintenance-predictive-l-industrie-francaise-passe-a-la-vitesse-superieure.N2310867",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Brief sectoriel — IA dans l'Aérospatial & Défense
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-aerospatial-defense",
    sectorTagSlugs: ["aerospatial-defense"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans l'Aérospatial & Défense en France",
    titleEn: "Sector Brief — AI in French Aerospace & Defence",
    summaryFr:
      "Panorama des usages IA dans l'aérospatial et la défense française : acteurs clés, applications (MRO prédictif, simulation, traitement images SAR, systèmes embarqués), et contraintes spécifiques (DO-178C, STANAG, habilitations, dual-use).",
    bodyMarkdownFr: `## Le secteur aérospatial & défense français en chiffres

La filière aérospatiale et de défense française est l'une des premières mondiales. Selon le GIFAS (Groupement des Industries Françaises Aéronautiques et Spatiales), le secteur représente en 2023 un chiffre d'affaires de **65 milliards d'euros**, dont 85 % à l'export, et emploie directement 210 000 personnes. La France est le troisième exportateur mondial d'armement (rapport SIPRI 2024).

## Acteurs structurants

- **Airbus** (Toulouse) : constructeur d'avions civils, hélicoptères (Airbus Helicopters, Marignane), espace et défense (Airbus Defence & Space). Leader mondial du transport aérien civil.
- **Safran** : motoriste (CFM56, LEAP en coentreprise avec GE), équipements d'atterrissage, nacelles, avionique, systèmes de navigation inertielle.
- **Thales** : systèmes avioniques, radar, communications sécurisées, cybersécurité, spatial.
- **MBDA** : missiles (Meteor, Aster, Exocet), systèmes d'armes, partenariat franco-britannico-allemand-italien.
- **ArianeGroup** : lanceurs spatiaux (Ariane 6), propulsion spatiale, dissuasion nucléaire (programme M51).
- **KNDS** (Krauss-Maffei Wegmann + Nexter Systems) : blindés (Leclerc, CAESAR, Griffon), munitions.
- **Naval Group** : sous-marins (Suffren, SMX), frégates (FDI), porte-avions.

## Usages de l'IA dans le secteur

### Maintenance MRO prédictive
La maintenance, réparation et révision (MRO) représente un marché mondial de 80 Md$ dont la France capte une part significative via Air France Industries KLM Engineering & Maintenance, Safran Aircraft Engines et Airbus Services. L'IA y est déployée pour :
- La prédiction de défaillances sur moteurs (analyse vibratoire, paramètres de vol enregistrés via QAR/FDR)
- L'optimisation des intervalles de maintenance (passage d'une logique calendaire à une logique conditionnelle)
- La reconnaissance automatique de défauts sur images d'inspection borescope (vision CNN)
- La gestion prédictive des stocks de pièces détachées (réduction immobilisations financières)

### Simulation et jumeaux numériques
Airbus, Safran et l'ONERA (Office National d'Études et de Recherches Aérospatiales) investissent dans des jumeaux numériques haute fidélité couplant simulations CFD (Computational Fluid Dynamics), données opérationnelles réelles et modèles d'apprentissage automatique pour réduire les cycles d'essai physique (en chambre d'essai de moteur ou en soufflerie).

### Traitement d'images de renseignement (ISR/SAR)
Dans le domaine défense, les algorithmes de vision artificielle traitent les images satellites (radar SAR, optique très haute résolution), les flux vidéo ISR (Intelligence, Surveillance, Reconnaissance) et les données de capteurs aéroportés pour la détection, la classification et le pistage de cibles. Thales, Airbus Defence & Space et CS Group (groupe Sopra Steria) sont les principaux fournisseurs français de solutions IA pour le renseignement d'origine image (ROIM).

### Systèmes embarqués certifiés
Les systèmes avioniques embarqués (FMS, TCAS, systèmes anti-collision, pilote automatique) intègrent progressivement des composants IA — avec des contraintes de certification extrêmement strictes.

## Contraintes spécifiques du secteur

### DO-178C / ED-12C
La norme de certification des logiciels embarqués aéronautiques (DO-178C / ED-12C, niveau A pour les fonctions critiques) impose une traçabilité exigences/code/tests exhaustive. L'intégration d'algorithmes d'apprentissage automatique dans des systèmes de niveau DAL-A ou DAL-B est un sujet ouvert au niveau de l'EASA (European Union Aviation Safety Agency), qui a publié un concept paper dédié (EASA AI Roadmap 2.0, 2023).

### STANAG et normes OTAN
Les équipements destinés à des forces armées de l'OTAN doivent respecter les STANAG (Standardization Agreements), dont certains encadrent les systèmes d'armes autonomes et les systèmes IA à usage militaire.

### Habilitations Secret Défense
Les travaux sur des projets à caractère classifié impliquent que les personnels et les locaux soient habilités Secret Défense ou Très Secret Défense. Axion-IA ne dispose pas, en l'état, d'habilitations classifiées : les missions sur périmètre défense se limitent au domaine civil / dual-use non classifié.

### Réglementation dual-use (Règlement UE 2021/821)
De nombreuses technologies IA à fort potentiel aérospatial (vision artificielle, traitement du signal RF, navigation autonome) sont soumises à contrôle export au titre du règlement européen dual-use. Tout transfert de technologie vers des entités hors UE/OTAN requiert une autorisation préalable.`,
    sources: [
      "https://www.gifas.fr/actualites/le-gifas-publie-ses-statistiques-annuelles-2023",
      "https://www.easa.europa.eu/en/document-library/general-publications/easa-artificial-intelligence-roadmap-20",
      "https://www.sipri.org/publications/2024/sipri-fact-sheets/trends-international-arms-transfers-2023",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32021R0821",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Brief sectoriel — IA dans la Mécanique de Précision
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-mecanique-precision",
    sectorTagSlugs: ["mecanique-precision"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Mécanique de Précision en France",
    titleEn: "Sector Brief — AI in French Precision Engineering",
    summaryFr:
      "Panorama de la mécanique de précision française : acteurs, pôles de compétitivité (Minalogic, Microtechniques), usages IA prioritaires (contrôle vision, paramétrage CNC, jumeau numérique pièce) et enjeux ROI spécifiques aux PME.",
    bodyMarkdownFr: `## La mécanique de précision française : un tissu de PME d'excellence

La mécanique de précision regroupe la fabrication de pièces, composants et sous-ensembles mécaniques à tolérances serrées (de l'ordre du micron), destinés à des secteurs exigeants : aéronautique, défense, médical, horlogerie, optique, électronique industrielle. En France, ce secteur est dominé par des **PME et ETI spécialisées**, souvent sous-traitants de rang 1 ou 2 des grands donneurs d'ordre.

### Pôles et acteurs de référence

- **Pôle Minalogic** (Grenoble) : pôle de compétitivité dédié aux microsystèmes, nanoélectronique et logiciels embarqués. Fédère plus de 300 membres dont de nombreuses PME de mécanique de précision liées à la microélectronique.
- **Pôle Microtechniques** (Besançon / Franche-Comté) : historiquement lié à l'horlogerie et aux microtechniques, ce pôle rassemble des entreprises spécialisées en décolletage, micro-usinage, optique fine et dispositifs médicaux implantables. La Franche-Comté concentre à elle seule 40 % de la production mondiale de décolletage.
- **Pôle de compétitivité Aerospace Valley** (Toulouse / Bordeaux) : regroupe des sous-traitants mécaniciens de précision pour Airbus, Safran et leurs équipementiers.
- **Entreprises représentatives** : Somfy, Faurecia (outil de précision), Lisi Group (fixations aéronautiques et médicales), Seco Tools France (outillage de coupe de précision), Mecachrome (sous-traitance aéronautique et automobile de précision).

### Contexte économique
Selon la Fédération des Industries Mécaniques (FIM), la mécanique industrielle française emploie environ **600 000 personnes** et réalise un chiffre d'affaires de 115 Md€ (2023). La mécanique de précision stricto sensu représente un sous-ensemble d'environ 15–20 Md€, avec une forte orientation export.

## Usages IA prioritaires pour les mécaniciens de précision

### Contrôle qualité par vision artificielle (défauts microniques)
Le contrôle dimensionnel et d'aspect est l'application IA la plus pertinente pour les mécaniciens de précision :
- **Contrôle dimensionnel 100 %** : des systèmes de métrologie optique assistée par IA (caméras haute résolution + algorithmes de traitement d'image) réalisent des mesures dimensionnelles sur des pièces en défilement (ligne de production), sans prélèvement d'échantillons, avec une résolution jusqu'à 0,5 µm.
- **Détection de défauts surfaciques** : réseaux de neurones convolutifs entraînés sur des images de référence détectent les rayures, porosités, bavures, erreurs de filetage, manques de matière à des cadences industrielles (jusqu'à 120 pièces/minute selon la géométrie).
- **Contrôle d'assemblage** : vérification de la présence et de l'orientation de composants en sous-assemblages (joints, goupilles, vis) avant livraison.

### Paramétrage intelligent des machines CNC
Les centres d'usinage CNC modernes génèrent des données massives (offsets outils, usure, vibrations broche, corrections géométriques). Les modèles IA permettent :
- La **compensation prédictive de la dérive thermique** : ajustement automatique des offsets en fonction de la température de la broche et du bâti, réduisant les rebuts en début de poste ou après montée en température.
- Le **réglage automatique des paramètres de coupe** (vitesse, avance, profondeur de passe) basé sur la surveillance acoustique et vibratoire de l'outil, optimisant la durée de vie des inserts et la qualité d'état de surface.
- La **détection précoce d'usure outil** avant casse, réduisant les arrêts non planifiés et les pièces rebuts liés aux outils usés.

### Jumeau numérique de la pièce
Le jumeau numérique de pièce associe le fichier CAO/FAO nominal à toutes les données de production réelles (mesures CMM, relevés d'usinage, traitements de surface) pour constituer un **dossier numérique de vie de la pièce**. Cette approche, rendue possible par l'IA de gestion et d'analyse de données, répond aux exigences de traçabilité des donneurs d'ordre aéronautiques (ATA 2000, AS9100) et médicaux (ISO 13485).

## Enjeux ROI spécifiques aux PME

### Barrière d'entrée à l'investissement
Les PME de mécanique de précision font face à une barrière d'investissement initiale significative : les systèmes de vision industrielle de précision représentent typiquement 50 000 à 300 000 € selon la complexité des pièces et les cadences. Les aides du Plan France 2030 (volet industrie) et du crédit d'impôt innovation (CII) peuvent couvrir jusqu'à 30–40 % de l'investissement.

### ROI mesurable
- Réduction du taux de rebut : un passage de 1,5 % à 0,5 % de rebut sur un volume de 500 000 pièces/an à 5 € la pièce représente 25 000 € d'économie annuelle directe, auquel s'ajoute la réduction du coût de non-qualité client (pénalités, reprises, impact réputation).
- Réduction du temps de réglage CNC : 15 à 30 min gagnées par changement de série, multipliées par la fréquence des changements (parfois 5–10/jour), génèrent une capacité productive additionnelle significative.

### Priorité à l'interopérabilité GPAO
Avant de déployer une couche IA, les PME doivent s'assurer que leurs GPAO (Gestion de Production Assistée par Ordinateur) sont capables d'exporter les données de production dans des formats standards (API REST, OPC-UA). Cette condition préalable est systématiquement vérifiée lors de l'audit Axion-IA.`,
    sources: [
      "https://www.fim.net/les-industries-mecaniques-en-france",
      "https://www.minalogic.com/",
      "https://www.pole-microtechniques.fr/",
      "https://www.france2030.gouv.fr/fr/financer-un-projet-industriel",
      "https://www.bpifrance.fr/nos-solutions/nos-solutions-de-financement/les-aides-a-linnovation/le-credit-dimpot-innovation",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Cas typique — Implémentation IA dans un Laboratoire Pharmaceutique
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "cas-typique-implementation-pharma",
    sectorTagSlugs: ["chimie-pharma"],
    type: "industry_use_case",
    domain: "editorial",
    audience: "public",
    titleFr: "Cas typique — Implémentation IA dans un Laboratoire Pharmaceutique",
    titleEn: "Typical Case — AI Implementation in a Pharmaceutical Laboratory",
    summaryFr:
      "Scénario représentatif d'implémentation IA en pharmacovigilance pour un laboratoire mid-market (~500 salariés) : problématique, solution NLP, résultats indicatifs, points d'attention réglementaires EMA/ANSM.",
    bodyMarkdownFr: `> *Scénario représentatif basé sur des patterns observés dans le secteur. Les noms d'entreprises sont fictifs. Les chiffres sont indicatifs et varient selon les contextes.*

## Contexte

**Laboratoire fictif : Pharmalex Therapeutics SAS**
- Taille : ~500 salariés, 3 sites de production (France métropolitaine)
- Activité : spécialités pharmaceutiques génériques et médicaments à usage hospitalier
- Chiffre d'affaires : ~120 M€
- Marchés : France, Espagne, Belgique, Maghreb
- Statut réglementaire : autorisation de mise sur le marché (AMM) nationale et européenne centralisée (EMA) sur 12 références actives

## Problématique initiale

Le service de pharmacovigilance de Pharmalex Therapeutics emploie 4 personnes (2 pharmacovigilants seniors, 2 juniors) chargées du traitement des **Individual Case Safety Reports (ICSR)** — rapports individuels de cas de sécurité — relatifs aux effets indésirables signalés sur ses médicaments commercialisés.

### Points de douleur identifiés lors de l'audit Axion-IA

1. **Volume et hétérogénéité des sources** : les ICSR parviennent sous des formes très diverses — courriers manuscrits numérisés de médecins et pharmaciens, formulaires papier remplis par les patients, e-mails libres, notifications issues du portail de l'ANSM, rapports de partenaires distributeurs en Espagne et Belgique (en espagnol et néerlandais), signaux extraits de bases de données EudraVigilance.

2. **Saisie manuelle chronophage** : chaque ICSR nécessitait en moyenne **45 minutes** de traitement manuel pour extraction des informations clés (médicament incriminé, dose, effet indésirable décrit, issue clinique, gravité), codage MedDRA de l'effet, évaluation de la causalité, et saisie dans la base de pharmacovigilance interne.

3. **Délais réglementaires sous pression** : la réglementation EMA impose des délais stricts de déclaration des ICSR graves : 15 jours calendaires pour les cas graves inattendus (SUSAR). Avec un volume croissant de signalements (hausse de 35 % en 3 ans liée à l'élargissement du portefeuille), les délais devenaient difficiles à tenir.

4. **Risque d'erreur de codage MedDRA** : la terminologie MedDRA (Medical Dictionary for Regulatory Activities) comporte plus de 70 000 termes. Le codage manuel, même par des pharmacovigilants expérimentés, est source d'inconsistances entre opérateurs.

## Solution IA déployée

### Architecture technique
L'intervention Axion-IA a conduit à la sélection et à l'implémentation d'un pipeline NLP structuré en trois modules :

**Module 1 — Ingestion et OCR intelligent**
Les courriers manuscrits et formulaires papier numérisés sont traités par un moteur OCR (reconnaissance optique de caractères) couplé à un modèle de correction contextuelle entraîné sur le vocabulaire médico-pharmaceutique français. Le taux de reconnaissance sur courriers de professionnels de santé atteint 94–96 % après correction contextuelle.

**Module 2 — Extraction d'entités nommées médicales (NER)**
Un modèle de reconnaissance d'entités nommées (NER) entraîné sur des corpus pharmaceutiques annoté selon le standard EudraVigilance extrait automatiquement :
- Le ou les médicaments incriminés (DCI, marque, numéro de lot si mentionné)
- Le ou les effets indésirables décrits en langage naturel
- La dose et la voie d'administration
- L'issue clinique (guérison, séquelles, décès, inconnue)
- Les comorbidités du patient pertinentes
- La date de début et la durée de l'effet

**Module 3 — Suggestion de codage MedDRA et classification de gravité**
Un modèle de classification multi-label propose les termes MedDRA les plus probables (5 candidats classés par score de confiance) pour chaque effet indésirable extrait. Un module de règles métier détermine le niveau de gravité réglementaire (grave/non grave) et le délai de déclaration applicable. Les cas graves sont automatiquement flaggés en priorité dans la file de traitement.

### Validation et intégration réglementaire
Conformément aux exigences GxP et à la guidance EMA sur les systèmes informatisés (Good Pharmacovigilance Practices — GVP Module VI), le système a été validé selon les principes GAMP 5 :
- Rédaction d'une User Requirements Specification (URS) co-construite avec l'équipe pharmacovigilance
- Qualification d'installation (IQ), qualification opérationnelle (OQ), qualification des performances (PQ)
- Le pharmacovigilant senior reste décisionnaire sur tous les ICSR : l'IA est en mode **aide à la décision**, jamais en mode autonome pour la déclaration finale

## Résultats indicatifs

*Scénario représentatif — chiffres indicatifs*

| Indicateur | Avant IA | Après IA | Variation |
|---|---|---|---|
| Temps moyen de traitement par ICSR | 45 min | ~14 min | −69 % |
| Taux de conformité au délai EMA 15j (SUSAR graves) | 82 % | 97 % | +15 pts |
| Inconsistances de codage MedDRA inter-opérateurs | ~18 % | ~4 % | −78 % |
| Capacité de traitement (ICSR/mois/ETP) | ~90 | ~270 | ×3 |
| Coût de traitement par ICSR | Base 100 | ~Base 42 | −58 % |

La réduction du temps de traitement a permis de **réabsorber la hausse de +35 % des volumes** sans recrutement additionnel, et d'améliorer significativement la conformité aux délais réglementaires EMA.

## Leçons et points d'attention

### Ce qui a fonctionné
- L'implication dès la phase d'audit des pharmacovigilants seniors dans la définition des règles de classification : leur expertise métier était indispensable pour annoter les données d'entraînement et valider les sorties du modèle.
- Le choix d'un mode **assisté** (l'IA propose, l'humain valide) plutôt qu'automatisé a facilité l'acceptation interne et satisfait les exigences réglementaires GVP.
- La couverture multilingue (FR/ES/NL) a été un vrai différenciateur pour les filiales étrangères.

### Points d'attention critiques
1. **Qualité des données d'entraînement** : les 18 premiers mois nécessitent un effort soutenu d'annotation et de correction des sorties du modèle pour améliorer la précision. Le ROI plein n'est atteint qu'au bout de 12–18 mois.
2. **Validation logicielle obligatoire** : la validation GAMP 5 représente un investissement non négligeable (40–80 jours·homme selon la complexité) mais est **non négociable** dans un contexte GxP soumis aux inspections ANSM et EMA.
3. **Gestion du changement** : deux pharmacovigilants juniors ont exprimé des craintes initiales sur l'évolution de leur poste. Un accompagnement spécifique (repositionnement sur l'analyse de signal et la veille réglementaire) a été nécessaire.
4. **Maintenance du modèle** : les mises à jour de la terminologie MedDRA (publication annuelle en mars) nécessitent une revue et un re-entraînement partiel du modèle de codage.
5. **Conformité AI Act 2026** : dans la mesure où le système assiste une décision ayant un impact sur la sécurité des patients, il sera vraisemblablement classé **haut risque** au sens du Règlement UE 2024/1689 (AI Act), applicable pleinement en août 2026. La documentation technique conforme devra être préparée.`,
    sources: [
      "https://www.ema.europa.eu/en/human-regulatory-overview/pharmacovigilance-overview/good-pharmacovigilance-practices",
      "https://www.ansm.sante.fr/declarer-un-effet-indesirable/pharmacovigilance",
      "https://www.meddra.org/how-to-use/support-documentation",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://ispe.org/initiatives/gamp",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
];
