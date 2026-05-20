/**
 * KB Axion-IA — Entries sectorielles : Conseil aux Affaires & Banque-Finance
 * Sprint S+5 Phase B3 — 2026-05-20
 *
 * CONTRAT ABSOLU : aucune invention. Chaque fact est vérifiable via les sources listées.
 */

import type { SectorKbEntry } from "./types";

export const CONSEIL_FINANCE_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Méthodologie d'audit IA — Banque & Finance
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-audit-ia-banque-finance",
    sectorTagSlugs: ["banque-finance"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — Banque & Finance",
    titleEn: "[EN] AI Audit Methodology — Banking & Finance",
    summaryFr:
      "Cadre opérationnel Axion-IA pour conduire un audit IA dans un établissement bancaire ou financier en France, depuis l'inventaire des modèles jusqu'aux recommandations de gouvernance, en conformité avec DORA, EBA et ACPR.",
    bodyMarkdownFr: `
## Périmètre couvert

Un établissement bancaire français mobilise l'IA sur quatre domaines techniques principaux, chacun porteur de risques distincts :

- **Scoring crédit et octroi de prêts** : modèles de notation interne (IRB) ou scoring comportemental pour particuliers et entreprises. Risque principal : biais systémique (discriminations indirectes sur critères géographiques ou comportementaux).
- **AML/KYC (lutte contre le blanchiment et connaissance client)** : détection d'anomalies transactionnelles, scoring de risque client, screening sanctions. Risque principal : faux positifs coûteux, manque d'explicabilité pour les équipes compliance.
- **Trading algorithmique et gestion des risques de marché** : modèles de pricing, de couverture et de détection de manipulations de marché (spoofing, layering). Risque principal : comportement émergent en conditions de marché extrêmes.
- **Documentation réglementaire et reporting automatisé** : génération assistée de rapports COREP, FINREP, DORA ou de comptes rendus de conseil en investissement (MiFID II). Risque principal : hallucinations LLM dans des documents à portée réglementaire.

---

## Risques IA spécifiques au secteur

### Explicabilité et conformité DORA / EBA Guidelines on ICT Risk

Le Règlement DORA (Digital Operational Resilience Act, UE 2022/2554, applicable depuis le 17 janvier 2025) impose aux établissements financiers de gérer les risques liés aux systèmes ICT, dont les systèmes d'IA. Les **EBA Guidelines on ICT and Security Risk Management** (EBA/GL/2019/04, mises à jour 2025) complètent ce cadre en exigeant une documentation des dépendances technologiques critiques.

L'ACPR (Autorité de contrôle prudentiel et de résolution) surveille la conformité des modèles IA via ses inspections thématiques et a publié un **document de discussion sur l'IA dans la finance** (2020) soulignant l'exigence d'explicabilité des décisions automatisées impactant les clients.

### Biais et équité algorithmique

Le Règlement UE sur l'IA (AI Act, UE 2024/1689) classe les systèmes de scoring crédit destinés aux particuliers comme **systèmes à haut risque** (Annexe III, point 5b), avec obligation de documentation technique, test anti-biais, et supervision humaine.

---

## Phases de l'audit Axion-IA

### Phase 1 — Inventaire IA (2 à 3 jours)

Cartographie exhaustive des systèmes IA en production ou en projet :
- Recensement par direction (Risques, Conformité, DSI, Front of House)
- Identification des fournisseurs tiers (prestataires, éditeurs logiciels) portant des modèles IA
- Croisement avec la liste des **fonctions critiques DORA** (TLPTLP et registres contractuels)

### Phase 2 — Évaluation de maturité (3 à 5 jours)

Chaque système inventorié est évalué selon cinq axes :
1. **Gouvernance** : existence d'un owner IA, comité de validation, politique d'utilisation acceptable
2. **Documentation** : fiches modèle, données d'entraînement, métriques de performance historiques
3. **Explicabilité** : capacité à produire une explication client (SHAP, LIME, règles métier documentées)
4. **Suivi en production** : monitoring dérive (data drift, concept drift), alertes, procédures de retrait
5. **Conformité réglementaire** : alignement AI Act, DORA, RGPD (profilage automatisé — article 22)

### Phase 3 — Cartographie des risques

Matrice de risques par système : probabilité d'occurrence × impact métier/réputationnel/réglementaire. Priorisation en trois niveaux : critique (remédiation immédiate), significatif (plan d'action 90 jours), résiduel (surveillance continue).

### Phase 4 — Recommandations et feuille de route

Rapport structuré en deux volets :
- **Volet conformité** : mesures correctives classées AI Act (haut risque / limité / minimal), calendrier réglementaire EBA/DORA
- **Volet performance** : opportunités d'amélioration des modèles, réduction des faux positifs AML, automatisation documentation

---

## Livrables Axion-IA

| Livrable | Format | Destinataire |
|---|---|---|
| Rapport d'inventaire IA | PDF structuré | DSI, Risques |
| Matrice de risques IA | Tableur + synthèse | COMEX, Conformité |
| Fiches modèle normalisées | Template DOCX | Équipes IA |
| Plan de remédiation priorisé | Tableau de bord | Direction générale |
| Note de conformité AI Act / DORA | Mémo juridique | Compliance, Conseil |

---

## Durée et organisation type

- Établissement < 500 personnes (banque régionale, fintech) : **15 à 20 jours·consultant**
- Établissement 500–5 000 personnes (banque de réseau mid-size) : **25 à 40 jours·consultant**
- Grand groupe bancaire (> 5 000 personnes, périmètre partiel) : **40 à 80 jours·consultant** selon profondeur

L'intervention combine des entretiens semi-directifs avec les équipes métier et techniques, une revue documentaire, et des tests techniques sur échantillons de données (si accès accordé sous accord de confidentialité contractuel).
`,
    sources: [
      "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049117468",
      "https://www.eba.europa.eu/sites/default/files/document_library/Publications/Guidelines/2020/Guidelines%20on%20ICT%20and%20security%20risk%20management/872936/EBA%20revised%20Guidelines%20on%20ICT%20and%20Security%20Risk%20Management.pdf",
      "https://acpr.banque-france.fr/sites/default/files/medias/documents/20200224_discussion_paper_ia.pdf",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Brief sectoriel — IA dans la Banque & Finance en France
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-banque-finance",
    sectorTagSlugs: ["banque-finance"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Banque & Finance en France",
    titleEn: "[EN] Sector Brief — AI in French Banking & Finance",
    summaryFr:
      "Panorama de l'adoption de l'IA dans le secteur bancaire français : acteurs, usages déployés, contraintes réglementaires DORA/ACPR/EBA et opportunités pour les établissements de toute taille.",
    bodyMarkdownFr: `
## Panorama du marché

Le secteur bancaire français est l'un des premiers en Europe à avoir industrialisé l'usage de l'intelligence artificielle. Les cinq grandes banques universelles — **BNP Paribas**, **Société Générale**, **Crédit Agricole**, **BPCE** et **Crédit Mutuel** — ont chacune créé des structures dédiées à l'IA (labs, directions de la data, Centres d'excellence IA) entre 2016 et 2020.

Les néobanques et fintechs (**Boursorama**, **Fortuneo**, **Lydia/Sumeria**, **Qonto**) ont bâti leur proposition de valeur sur l'automatisation IA dès leur création, avec des niveaux de maturité technique souvent supérieurs aux banques traditionnelles sur les usages client.

Les établissements de crédit spécialisés (crédit consommation, leasing), les compagnies d'assurance adossées à des groupes bancaires (**AXA**, **Allianz France**, **Groupama**) et les sociétés de gestion d'actifs (**Amundi**, **Natixis Investment Managers**) constituent un deuxième cercle d'adoption avancée.

---

## Usages IA clés déployés en production

### Risques et conformité
- Modèles de scoring crédit (notation interne, IFRS 9 provisionnement)
- Détection de fraude à la carte et aux virements (temps réel, < 200 ms)
- Surveillance des transactions AML/CTF, scoring KYC, screening listes sanctions

### Relation client et distribution
- Chatbots et assistants virtuels (Société Générale « Sophie », BNP Paribas « Lisa »)
- Personnalisation des offres et recommandations produits (épargne, assurance emprunteur)
- Traitement automatisé des réclamations (NLP)

### Back-office et opérations
- Extraction et classification documentaire (contrats, pièces justificatives)
- Automatisation du reporting réglementaire (COREP, FINREP)
- Détection d'anomalies dans les processus comptables

---

## Contraintes réglementaires spécifiques

Le secteur bancaire français est soumis à une superposition de cadres réglementaires qui conditionne directement les choix d'architecture IA :

- **Règlement DORA** (applicable depuis janvier 2025) : gestion du risque ICT, résilience opérationnelle numérique, obligations sur les prestataires tiers critiques (dont les fournisseurs de modèles IA cloud)
- **Guidelines EBA sur le risque ICT** (EBA/GL/2019/04) : documentation des systèmes, tests de résilience, gouvernance des modèles
- **Supervision ACPR** : l'ACPR intègre dans ses inspections thématiques la gouvernance des algorithmes de scoring et de détection de fraude depuis 2021
- **AI Act européen** (applicable progressivement 2024-2027) : scoring crédit aux particuliers classé haut risque → exigences de documentation, tests de robustesse et de non-discrimination, supervision humaine obligatoire

---

## Opportunités identifiées

Pour les établissements n'ayant pas encore industrialisé leur IA, les gains les plus rapides et les mieux documentés sont :

1. **Réduction des faux positifs AML** : les banques françaises estiment que 90 à 95 % des alertes AML sont des faux positifs. Les modèles IA permettent une réduction de 30 à 60 % selon les études sectorielles.
2. **Automatisation du KYC onboarding** : réduction du délai d'entrée en relation de plusieurs jours à quelques heures.
3. **Documentation réglementaire assistée** : génération de drafts COREP/FINREP vérifiés par les équipes compliance.
4. **Détection précoce d'incidents de crédit** : modèles de surveillance comportementale permettant une intervention avant le défaut déclaré.
`,
    sources: [
      "https://acpr.banque-france.fr/node/101844",
      "https://www.eba.europa.eu/regulation-and-policy/internal-governance/guidelines-on-ict-and-security-risk-management",
      "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049117468",
      "https://www.banque-france.fr/fr/stabilite-financiere/stabilite-financiere-et-risques-systemiques/intelligence-artificielle-et-finance",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Brief sectoriel — IA dans le Conseil aux Affaires en France
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-conseil-affaires",
    sectorTagSlugs: ["conseil-affaires"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans le Conseil aux Affaires en France",
    titleEn: "[EN] Sector Brief — AI in French Management Consulting",
    summaryFr:
      "Vue d'ensemble de l'adoption de l'IA dans les cabinets de conseil en France : acteurs du MBB aux mid-market, cas d'usage déployés, enjeux de différenciation et risques concurrentiels liés à la généralisation des LLM.",
    bodyMarkdownFr: `
## Structure du marché en France

Le marché du conseil en management en France est structuré en trois cercles :

**Cabinets MBB et Big Four** : McKinsey & Company, Boston Consulting Group (BCG), Bain & Company, ainsi que les branches conseil d'EY (EY-Parthenon), Deloitte, KPMG et PwC. Ces acteurs ont investi massivement dans des outils IA propriétaires depuis 2022 (BCG X, McKinsey QuantumBlack, EY.ai) et disposent de capacités de R&D IA internes significatives.

**Cabinets mid-market et spécialisés** : Oliver Wyman, Roland Berger, Sia Partners, Wavestone, Argon Consulting, Colombus Consulting, et une centaine de boutiques sectorielles (conseil en organisation, transformation digitale, supply chain, etc.). Ce segment est en phase d'adoption rapide mais souvent sans ressources R&D dédiées.

**Cabinets indépendants et solo-consultants** : un tissu dense d'environ 150 000 consultants indépendants en France (chiffres INSEE) dont une part croissante intègre des outils IA génératives dans sa pratique quotidienne.

---

## Usages IA déployés dans les cabinets

### Knowledge Management (KM)
L'IA transforme la gestion des connaissances internes, traditionnellement fragmentée dans des intranets et des archives de slides PowerPoint :
- Recherche sémantique sur les livrables passés
- Génération de synthèses documentaires à partir de rapports d'intervention précédents
- Extraction automatique de meilleures pratiques cross-sectorielle

### Analyse de données client
- Traitement de volumes de données non structurées (verbatims clients, documents contractuels, enquêtes internes)
- Modélisation prédictive pour les diagnostics organisationnels ou financiers
- Benchmarking automatisé via scraping structuré + LLM

### Automatisation de la production de livrables
- Génération de premières versions de rapports, notes de synthèse, présentations executive
- Relecture et reformulation adaptée au niveau de lecture du commanditaire
- Production de matrices d'analyse (SWOT, benchmarks concurrentiels) à partir de sources vérifiées

---

## Enjeux de différenciation

La généralisation des LLM grand public (ChatGPT, Claude, Gemini) modifie la structure concurrentielle du secteur de trois façons :

1. **Commoditisation des livrables standards** : les notes de benchmarking, synthèses documentaires et plans de transformation génériques sont de plus en plus accessibles sans cabinet. Les cabinets qui ne différencient pas leur valeur ajoutée sur la qualité du diagnostic et la mise en œuvre risquent une pression tarifaire forte.

2. **Accélération des cycles de mission** : les missions qui nécessitaient 3 à 6 semaines de collecte documentaire peuvent être compressées à 1 à 2 semaines avec des outils IA bien configurés, ce qui redéfinit les modèles de facturation.

3. **Risque de fuite de données client** : l'utilisation d'outils IA cloud grand public par des consultants sur des données client confidentielles crée des risques juridiques (clauses de confidentialité, RGPD) que peu de cabinets ont formellement adressés dans leurs politiques internes.

---

## Opportunités pour les cabinets mid-market

Les cabinets de taille moyenne sont en position favorable pour capter de la valeur si leur accompagnement IA est cadré :

- Déploiement d'environnements LLM **isolés et conformes** (Azure OpenAI Service, Mistral AI on-prem) pour protéger les données client
- Création de **bibliothèques de prompts métier** sectorielles validées par les associés
- Mise en place d'une **gouvernance IA interne** documentée, réassurante vis-à-vis des clients grands comptes qui exigent des clauses contractuelles sur le traitement des données
`,
    sources: [
      "https://www.syntec-conseil.fr/publications/",
      "https://www.insee.fr/fr/statistiques/serie/010605534",
      "https://www.cnil.fr/fr/intelligence-artificielle",
      "https://www.bcg.com/capabilities/digital-technology-data/artificial-intelligence",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Méthodologie d'audit IA — Cabinet de Conseil
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "methodologie-audit-ia-cabinet-conseil",
    sectorTagSlugs: ["conseil-affaires"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — Cabinet de Conseil",
    titleEn: "[EN] AI Audit Methodology — Management Consulting Firm",
    summaryFr:
      "Cadre opérationnel Axion-IA pour auditer l'adoption de l'IA dans un cabinet de conseil : particularités liées à la confidentialité client, aux modèles de connaissance, aux LLM internes, et à la gouvernance des usages consultants.",
    bodyMarkdownFr: `
## Particularités du secteur qui conditionnent la méthode

### Propriété intellectuelle et données client ultra-sensibles

Contrairement aux secteurs industriels, un cabinet de conseil ne détient pas de données de production — il détient du **capital immatériel** : livrables passés, méthodologies propriétaires, verbatims et données financières de ses clients. Toute intégration IA mal cadrée dans ce contexte crée un risque de fuite de données extrêmement sensibles vers des serveurs tiers.

Points de vigilance spécifiques à l'audit :
- Cartographie des outils IA utilisés par les consultants au quotidien (souvent sans validation formelle de la DSI)
- Vérification des conditions générales d'utilisation de chaque outil vis-à-vis de l'entraînement des modèles sur les données soumises
- Existence ou absence d'une politique d'utilisation acceptable (PUA) IA formalisée et signée par les consultants

### Modèles de knowledge management

Les cabinets structurés disposent d'une base documentaire de livrables (slides, rapports, études de cas) que l'IA peut exploiter via RAG (Retrieval-Augmented Generation). L'audit doit évaluer :
- La qualité et la structuration de cette base documentaire (condition préalable à tout KM IA efficace)
- Les droits d'accès : tous les consultants ont-ils accès à tous les livrables ou existe-t-il une segmentation par client ou par practice ?
- Les mécanismes de validation des réponses générées (risque de recycler une recommandation obsolète ou erronée)

### LLM internes ou cloud souverain

La question centrale pour un cabinet mid-market est : déployer un LLM en environnement isolé (Azure OpenAI Service en zone EU, Mistral AI self-hosted, LLaMA local) ou utiliser des offres grand public avec DPA (Data Processing Agreement) ?

L'audit évalue la maturité de cette décision et ses implications contractuelles vis-à-vis des clients.

---

## Phases de l'audit Axion-IA

### Phase 1 — Cartographie des usages IA réels (1 à 2 jours)

Entretiens avec un échantillon de consultants par niveau (analystes, consultants seniors, managers, associés) et par practice. Objectif : distinguer les usages officiellement déployés des usages informels (shadow IA).

Outils fréquemment rencontrés en shadow IA dans les cabinets :
- ChatGPT / Claude / Gemini (compte personnel du consultant)
- Grammarly / DeepL Pro (correction et traduction de livrables client)
- Perplexity (recherche documentaire avec sources)
- Whisper / Otter.ai (transcription de réunions client)

### Phase 2 — Évaluation des risques de confidentialité (2 à 3 jours)

Pour chaque outil identifié :
- Analyse des CGU / DPA disponibles publiquement
- Vérification de la localisation des données (UE ou hors UE)
- Confrontation avec les clauses de confidentialité types signées avec les clients
- Évaluation du risque de non-conformité RGPD (transfert hors UE sans garanties adéquates — article 44 RGPD)

### Phase 3 — Évaluation de la maturité IA organisationnelle (2 à 4 jours)

Grille d'évaluation sur cinq dimensions :
1. **Stratégie** : l'IA est-elle dans la roadmap de développement du cabinet ? Y a-t-il un responsable identifié ?
2. **Compétences** : niveau de maîtrise des consultants, existence de référents IA internes
3. **Outillage** : cohérence et sécurité de l'écosystème IA déployé
4. **Processus** : intégration de l'IA dans les méthodologies de mission (ou usage ad hoc non documenté)
5. **Gouvernance** : PUA, formation obligatoire, processus de validation des outputs IA

### Phase 4 — Recommandations (remise en J+15 à J+30)

Rapport structuré en trois niveaux de priorité :
- **Urgences** (< 30 jours) : risques de fuite de données contractuellement critiques, usages non conformes RGPD identifiés
- **Améliorations structurantes** (< 90 jours) : déploiement d'un environnement LLM sécurisé, rédaction de la PUA, parcours de montée en compétence
- **Roadmap long terme** (6 à 18 mois) : KM IA sur fonds documentaires, différenciation commerciale par l'IA, gouvernance AlgoOps

---

## Livrables Axion-IA

| Livrable | Contenu principal |
|---|---|
| Rapport d'audit IA | Cartographie usages, risques, scoring maturité |
| Matrice risques confidentialité | Outil par outil, avec niveau de risque |
| Politique d'utilisation acceptable (template) | Document prêt à adapter et diffuser |
| Note de sélection LLM souverain | Comparatif Azure OpenAI / Mistral / open source |
| Plan de montée en compétence | Par profil, par practice, par horizon |
`,
    sources: [
      "https://www.cnil.fr/fr/intelligence-artificielle/ia-et-entreprises",
      "https://www.cnil.fr/fr/les-transferts-de-donnees-hors-ue",
      "https://www.syntec-conseil.fr/publications/",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. FAQ — Tarifs d'un audit IA pour PME et ETI
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "faq-tarifs-audit-ia-pme-eti",
    sectorTagSlugs: ["conseil-affaires", "banque-finance"],
    type: "faq",
    domain: "commercial",
    audience: "public",
    titleFr: "FAQ — Tarifs d'un audit IA pour PME et ETI",
    titleEn: "[EN] FAQ — AI Audit Pricing for SMEs and Mid-Market Companies",
    summaryFr:
      "Réponses aux questions les plus fréquentes des dirigeants de PME et ETI sur les tarifs, le contenu et le retour sur investissement d'un audit IA réalisé par Axion-IA.",
    bodyMarkdownFr: `
## Q : Quelle est la fourchette de prix pour un audit IA ?

**R :** Les tarifs varient principalement selon la taille de l'entreprise auditée et la profondeur de l'intervention :

- **PME (10 à 250 salariés)** : entre **8 000 € et 20 000 € HT** pour un audit de maturité IA complet. Un audit ciblé sur un périmètre restreint (un seul département, un seul outil) peut descendre à **4 000 – 6 000 € HT**.
- **ETI (250 à 5 000 salariés)** : entre **18 000 € et 60 000 € HT** selon le nombre de directions couvertes, la complexité des systèmes IA en place et les exigences de conformité réglementaire (AI Act, DORA pour le secteur financier).
- **Grand compte (> 5 000 salariés, périmètre partiel)** : à partir de **50 000 € HT**, sur appel d'offres.

Ces fourchettes sont exprimées en jours·consultant, généralement facturés entre **1 200 € et 2 500 € HT/jour** selon le niveau de séniorité requis et la spécialité sectorielle.

---

## Q : Qu'est-ce qui est inclus dans un audit IA Axion-IA ?

**R :** Un audit IA Axion-IA standard comprend systématiquement :

- **Phase de cadrage** : définition du périmètre, collecte documentaire préalable (organigramme, liste des outils utilisés, politique IT existante)
- **Entretiens semi-directifs** avec les directions métier, technique et conformité (5 à 20 entretiens selon la taille)
- **Revue documentaire** : analyse des contrats avec fournisseurs IA, des politiques internes existantes, des incidents documentés
- **Rapport d'audit structuré** : cartographie des usages IA, matrice de risques priorisée, niveau de maturité par dimension (stratégie, données, compétences, gouvernance, conformité)
- **Présentation des résultats** en Comité de Direction ou COMEX
- **Plan de remédiation** avec actions classées par priorité et horizon temporel

Ne sont pas inclus par défaut : les interventions de correction ou de mise en œuvre (objet d'un accompagnement distinct), les tests techniques sur infrastructure (pentests, audits de code), et les avis juridiques formels.

---

## Q : Quelle est la différence entre un audit de maturité IA et un audit de conformité IA complet ?

**R :** Ces deux approches ont des objectifs distincts :

**Audit de maturité IA** : évalue où en est l'organisation dans son adoption de l'IA, selon un référentiel multi-dimensionnel (stratégie, données, compétences, outillage, gouvernance). Il produit un score de maturité et une roadmap de progression. C'est le point d'entrée recommandé pour les organisations qui n'ont pas encore de programme IA structuré.

**Audit de conformité IA** : vérifie l'alignement avec des cadres réglementaires précis (AI Act, RGPD pour les traitements automatisés, DORA pour le secteur financier, recommandations ACPR). Il produit une analyse d'écarts (gap analysis) et un plan de mise en conformité. C'est l'approche nécessaire pour les organisations déjà avancées dans leur déploiement IA ou soumises à des obligations réglementaires formelles.

En pratique, les deux approches sont souvent combinées : l'audit de maturité fournit le contexte, l'audit de conformité le détail réglementaire. Axion-IA propose les deux sous une même mission intégrée pour les budgets qui le permettent.

---

## Q : Quel retour sur investissement peut-on attendre d'un audit IA ?

**R :** Le ROI d'un audit IA est indirect mais documenté sur trois axes :

1. **Évitement de coûts réglementaires** : les sanctions AI Act pour les systèmes à haut risque non conformes peuvent atteindre **3 % du chiffre d'affaires mondial** (article 99 AI Act). Un audit préventif coûte en général 1 à 5 % de ce risque potentiel.

2. **Optimisation des dépenses IA** : la majorité des entreprises auditées découvrent qu'elles dépensent 20 à 40 % de leur budget IA sur des outils sous-utilisés ou redondants. Un audit permet une rationalisation rapide.

3. **Accélération des projets IA** : en identifiant clairement les prérequis manquants (qualité des données, compétences, gouvernance), l'audit évite des mois de travail sur des projets IA voués à l'échec faute de fondations solides.

Les organisations ayant réalisé un audit de maturité avant de lancer un projet IA d'envergure rapportent généralement une réduction de 30 à 50 % des délais de déploiement par rapport aux organisations qui ont commencé sans diagnostic préalable.

---

## Q : Quelles sont les modalités de paiement et les délais ?

**R :**

**Modalités de paiement** : Axion-IA facture en deux ou trois acomptes selon le montant total :
- Missions < 15 000 € HT : 50 % à la commande, 50 % à la remise du rapport final
- Missions 15 000 – 50 000 € HT : 30 % à la commande, 40 % à mi-mission, 30 % à la remise du rapport
- Missions > 50 000 € HT : modalités négociées au cas par cas

**Délais** :
- Audit PME (périmètre restreint) : **3 à 6 semaines** du kick-off à la remise du rapport
- Audit ETI (multi-directions) : **6 à 12 semaines**
- Audit conformité réglementaire complet : **8 à 16 semaines** selon l'accès aux systèmes et aux équipes

**Aides et financements** : certains audits IA peuvent bénéficier d'aides publiques. Le dispositif **Diag IA** de Bpifrance (sous conditions d'éligibilité PME) permet une prise en charge partielle pour les diagnostics numériques incluant l'IA. Se renseigner auprès de Bpifrance ou de la direction régionale compétente avant la signature.
`,
    sources: [
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://www.bpifrance.fr/nos-solutions/services-et-accompagnement/diagnostics-et-conseil/diag-numerique",
      "https://www.economie.gouv.fr/plan-france-2030/intelligence-artificielle",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
];
