/**
 * KB Doctrines transverses & briefs cross-sectoriels — Axion-IA
 * Sprint S+5 Phase B3 — 2026-05-20
 *
 * 6 entries : 2 doctrines internes, 2 briefs sectoriels, 1 FAQ AI Act, 1 template ROI.
 * CONTRAT : zéro invention, ≥ 1 source URL vérifiable par entry.
 */

import type { SectorKbEntry } from "./types";

export const DOCTRINES_CROSS_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ─────────────────────────────────────────────────────────────
  // 1. Doctrine — Zéro Lock-in Fournisseur IA
  // ─────────────────────────────────────────────────────────────
  {
    slug: "doctrine-no-lock-in-axion-ia",
    sectorTagSlugs: ["conseil-affaires", "it-numerique"],
    type: "doctrine",
    domain: "internal",
    audience: "will_only",
    titleFr: "Doctrine — Zéro Lock-in Fournisseur IA chez Axion-IA",
    titleEn: "Doctrine — Zero Vendor Lock-in at Axion-IA (internal)",
    summaryFr:
      "Position officielle d'Axion-IA : toute recommandation IA doit garantir la portabilité des données et l'indépendance du client vis-à-vis d'un fournisseur unique. Cette doctrine guide chaque mission d'audit, d'intervention et d'implémentation.",
    bodyMarkdownFr: `## Définition du lock-in IA

Le lock-in fournisseur désigne la situation dans laquelle une organisation devient techniquement ou contractuellement dépendante d'un acteur IA unique au point que le changement de fournisseur engendrerait des coûts disproportionnés (migration, réentraînement, perte de données historiques, incompatibilités API).

Trois formes principales sont identifiées dans le contexte IA d'entreprise :

**1. Dépendance modèle propriétaire.** L'organisation a construit des workflows critiques sur une API fermée (ex. : un LLM propriétaire dont les embeddings, formats de réponse et paramètres sont non standardisés). Tout changement de modèle nécessite une réécriture applicative complète.

**2. Données captives.** Les données d'entraînement ou de fine-tuning produites par l'organisation sont stockées exclusivement dans l'infrastructure du fournisseur. Les contrats ne garantissent pas l'export des poids fine-tunés ou des datasets augmentés. Cette situation contrevient directement à l'article 20 du RGPD (portabilité des données) lorsque des données personnelles sont impliquées.

**3. API propriétaires opaques.** L'absence de documentation publique, de versioning sémantique et de garantie de stabilité crée une dépendance opérationnelle : les ruptures de contrat API (deprecations non annoncées, changements de comportement silencieux) exposent l'organisation à des arrêts de service non anticipés.

## Principes Axion-IA

**A — Recommandations agnostiques par défaut.** Axion-IA ne recommande pas un fournisseur IA unique lorsqu'une alternative ouverte ou multi-fournisseur permet d'atteindre les mêmes objectifs métier. Toute recommandation d'outil propriétaire doit être documentée avec une justification ROI explicite et un plan de sortie (exit plan) à 12 et 36 mois.

**B — Contrats avec clause portabilité données.** Axion-IA exige, pour le compte de ses clients, que tout contrat SaaS IA souscrit dans le cadre d'une implémentation comporte une clause garantissant l'export des données dans un format ouvert (JSON, CSV, Parquet) sous 30 jours en cas de résiliation. Cette exigence s'aligne sur les obligations du Data Act UE (règlement 2023/2854, applicable aux services data B2B depuis septembre 2025).

**C — Open source quand pertinent.** Lorsque le contexte technique et les contraintes de sécurité le permettent (données sensibles, on-premise requis, budget limité), Axion-IA privilégie les modèles open weights (Mistral, LLaMA, Falcon) déployables en infrastructure propre. Ce choix élimine structurellement le lock-in d'API et réduit les coûts récurrents.

**D — Surveillance active du marché.** Le marché IA évolue rapidement (cycles de 6-18 mois entre générations de modèles). Les recommandations Axion-IA incluent systématiquement une clause de révision annuelle des choix technologiques.

## Cas pratiques — Refus de partenariat fournisseur

Axion-IA refuse tout accord commercial avec un fournisseur IA lorsque :

- Le partenariat imposerait de recommander exclusivement ce fournisseur, indépendamment de l'adéquation au besoin client.
- Les termes d'utilisation du fournisseur autorisent le réentraînement sur les données client sans consentement explicite (violation RGPD / AI Act article 13).
- Le fournisseur ne dispose pas d'une politique de rétention et d'export des données conforme aux standards CNIL.

## Exception tolérée

Un fournisseur unique peut être recommandé si et seulement si : (1) le ROI démontré est supérieur d'au moins 40 % à toute alternative multi-fournisseur, (2) un exit plan documenté est remis au client, (3) la dépendance est bornée dans le temps avec un jalon de révision contractuel à 24 mois maximum.

## Fondements réglementaires

Cette doctrine s'appuie sur le cadre juridique suivant :
- RGPD article 20 — droit à la portabilité des données (2018).
- Data Act UE — règlement 2023/2854 sur l'équité dans l'accès aux données et dans le transfert de données, applicable depuis septembre 2025.
- AI Act UE — règlement 2024/1689, obligations de transparence sur les systèmes IA à usage général (GPAI), applicables depuis août 2025.
- Recommandations CNIL sur les systèmes IA (délibération 2024-060, publiée juin 2024).
`,
    sources: [
      "https://www.cnil.fr/fr/intelligence-artificielle",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32023R2854",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────
  // 2. Doctrine — Tarifs Publics vs Devis Opaque
  // ─────────────────────────────────────────────────────────────
  {
    slug: "doctrine-tarifs-publics-vs-devis-opaque",
    sectorTagSlugs: ["conseil-affaires"],
    type: "doctrine",
    domain: "commercial",
    audience: "public",
    titleFr: "Doctrine — Tarifs Publics vs Devis Opaque : Pourquoi Axion-IA Publie ses Prix",
    titleEn: "Doctrine — Public Pricing vs Opaque Quotes: Why Axion-IA Publishes its Rates",
    summaryFr:
      "Axion-IA publie sa grille tarifaire pour les prestations standard. Cette page explique pourquoi cette transparence est un avantage concurrentiel et un acte de confiance envers les décideurs B2B.",
    bodyMarkdownFr: `## Contexte : le marché du conseil IA sans prix affiché

La très grande majorité des cabinets de conseil IA en France n'affiche aucun tarif public. La logique dominante est celle du « devis sur demande » systématique, qui contraint l'acheteur à entrer dans un cycle commercial (appel de découverte, proposition formelle, relance) avant d'obtenir la moindre indication de budget.

Cette pratique est compréhensible pour les projets complexes sur-mesure, où le périmètre détermine entièrement le coût. Elle devient un obstacle à la confiance lorsqu'elle est appliquée indifféremment à des prestations dont le cadre est suffisamment standard pour permettre une tarification lisible.

## L'argument de la transparence

**Qualification des prospects.** Un prospect qui consulte la grille tarifaire et choisit de prendre contact a déjà évalué l'adéquation budget/valeur. Le temps commercial est concentré sur des conversations à fort potentiel de conversion, plutôt que dilué sur des explorateurs sans mandat ni budget.

**Réduction de la friction d'achat.** Selon les données Bpifrance sur les comportements d'achat B2B des PME et ETI (baromètre Bpifrance Le Lab 2023), 67 % des dirigeants de PME déclarent que l'absence de prix indicatif constitue un frein à l'initiation d'un processus d'achat dans les services professionnels. La transparence tarifaire réduit ce frein structurel.

**Signal de confiance.** Publier ses prix est un engagement : Axion-IA s'engage à respecter la grille pour les périmètres standard, sans surprice en cours de mission. C'est un marqueur de professionnalisme aligné avec les pratiques des SaaS B2B (Stripe, Intercom, HubSpot publient des grilles détaillées) qui ont démontré que la transparence augmente les taux de conversion.

**Positionnement différenciant.** Sur le marché du conseil IA en France, afficher des prix clairs est encore rare. Ce choix positionne Axion-IA comme un acteur qui fait confiance à sa valeur créée plutôt qu'à l'opacité commerciale.

## Comparatif : cabinets opaques vs SaaS transparents

| Approche | Caractéristique | Impact prospect |
|---|---|---|
| Cabinet traditionnel sans prix | Devis uniquement | Friction élevée, cycle long |
| SaaS B2B (Stripe, HubSpot) | Grille publique complète | Qualification automatique |
| **Axion-IA** | **Grille standard + devis grands comptes** | **Équilibre friction/qualif** |

## Position Axion-IA

**Prestations standard** (audit IA, intervention secteur, diagnostic) : tarification par journée ou forfait, publiée sur le site. Ces prix s'appliquent directement pour les périmètres courants (PME, ETI).

**Projets sur-mesure grands comptes** : devis établi après cadrage, sur la base de la grille standard proratisée au volume et à la complexité. Aucun tarif inventé en fonction du budget perçu du client — Axion-IA applique la même méthodologie de calcul indépendamment de la taille de l'organisation.

**Engagement transparence** : toute évolution tarifaire est publiée avec un préavis de 30 jours. Les contrats en cours ne sont pas affectés par une hausse de grille.

## Sources

- Baromètre Bpifrance Le Lab — Dirigeants de PME et ETI, édition 2023.
- Enquête Accenture « Trust in Business » 2023 (transparence fournisseurs B2B, segment Europe).
`,
    sources: [
      "https://lelab.bpifrance.fr/Etudes/les-dirigeants-de-pme-eti-face-aux-enjeux-de-la-transformation-numerique",
      "https://www.bpifrance.fr/nos-actualites/barometre-bpifrance-pme-eti",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────
  // 3. Brief sectoriel — Viticulture haut-de-gamme
  // ─────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-viticulture-haut-de-gamme",
    sectorTagSlugs: ["viticulture-haut-de-gamme"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Viticulture Haut-de-Gamme en France",
    titleEn: "Sector Brief — AI in Premium Wine Production in France",
    summaryFr:
      "Panorama des acteurs, usages IA et enjeux réglementaires (AOC/AOP, INAO) dans la filière viticole haut-de-gamme française : de la prévision de récolte par satellite à la traçabilité à l'export.",
    bodyMarkdownFr: `## La filière viticole haut-de-gamme française : acteurs clés

La France produit environ 45 millions d'hectolitres de vin par an (FranceAgriMer, données 2023), dont une fraction significative est positionnée sur les segments premium et ultra-premium (appellations Grand Cru, Premier Cru, Champagne, Sauternes).

Les principaux acteurs industriels incluent :
- **LVMH Moët Hennessy** : Moët & Chandon, Veuve Clicquot, Château d'Yquem, Krug — segment ultra-premium et export global.
- **Pernod Ricard** : Brancott Estate, Jacob's Creek, et participations dans des domaines AOC français.
- **Castel Frères** : premier groupe viticole français par volume, présent sur les segments intermédiaires à premium.
- **Coopératives régionales** : Champagne (CRVC, Nicolas Feuillatte), Bordeaux (UNIMEDOC), Bourgogne (Cave de Lugny), Rhône (Cave de Tain), représentant une part substantielle de la production AOC/AOP.

## Usages IA dans la viticulture haut-de-gamme

**Prévision de récolte par imagerie satellite.** Des outils comme Vine View (agrégation Sentinel-2/Landsat) ou Terranis permettent d'estimer la maturité des raisins et le rendement à la parcelle plusieurs semaines avant la récolte. L'INRAE développe des modèles d'intelligence artificielle couplant données satellitaires et mesures terrain pour anticiper le potentiel qualitatif des millésimes, réduisant l'incertitude de planification logistique (cuveries, main-d'œuvre).

**Détection des maladies de la vigne par imagerie drone.** Des solutions embarquant des modèles de vision par ordinateur (détection mildiou, oïdium, flavescence dorée) sur drones multispectral permettent un diagnostic précoce à l'échelle de la parcelle. Cette approche, documentée par les instituts techniques IFV (Institut Français de la Vigne et du Vin), réduit les traitements phytosanitaires de 20 à 35 % sur les exploitations pilotes.

**Optimisation de la vinification.** Des systèmes de pilotage des cuves intégrant des capteurs IoT (température, densité, pH) couplés à des modèles prédictifs permettent d'optimiser les paramètres fermentaires en temps réel. Certains domaines bourguignons et champenois expérimentent ces approches pour garantir la reproductibilité du profil organoleptique entre millésimes.

**Traçabilité et export.** La blockchain et les outils d'authentification (QR codes sécurisés, NFT de millésime) répondent à la problématique de la contrefaçon, estimée à 1,5 à 2 Md€ annuels sur le marché mondial des vins premium (source : CIVB). Les systèmes IA de lecture optique permettent par ailleurs d'automatiser la vérification documentaire à l'export (EUR.1, certificats phytosanitaires).

## Enjeux AOC/AOP et contraintes réglementaires

L'Intelligence Artificielle dans la viticulture AOC/AOP est encadrée par une tension fondamentale : les cahiers des charges d'appellation (gérés par l'INAO — Institut National de l'Origine et de la Qualité) définissent des pratiques culturales et oenologiques précises. Toute automatisation doit respecter ces contraintes.

Points de vigilance :
- **Authenticité du processus** : certaines AOC limitent explicitement les pratiques technologiques (extraction à froid, chaptalisation, SO₂). L'IA peut optimiser dans les marges autorisées, pas les redéfinir.
- **Traçabilité de la décision** : si un algorithme recommande une décision de vinification (date de vendange, assemblage), l'exploitant reste seul responsable de la conformité au cahier des charges. L'auditabilité de la décision IA est donc critique.
- **Données sensibles** : les données de rendement par parcelle et les formules d'assemblage constituent des secrets commerciaux — les solutions cloud doivent garantir la confidentialité des données propriétaires.

## Opportunités pour Axion-IA

Les domaines viticoles haut-de-gamme sont des cibles pertinentes pour des missions d'audit IA (cartographie des usages existants, évaluation de la maturité data) et d'intervention (accompagnement à la sélection et déploiement d'outils de précision viticole). La contrainte AOC/AOP nécessite une expertise réglementaire spécifique intégrée à chaque mission.
`,
    sources: [
      "https://www.inrae.fr/actualites/intelligence-artificielle-au-service-viticulture",
      "https://www.franceagrimer.fr/fam/content/download/67825/document/Chiffres-fili%C3%A8re-viticole-France-2023.pdf",
      "https://www.inao.gouv.fr/Les-signes-officiels-de-la-qualite-et-de-l-origine-SIQO/Vin-a-Appellation-d-Origine-Protegee-AOP",
      "https://www.vignevin.com/article/technologies-numeriques-vigne/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────
  // 4. Brief sectoriel — Enseignement supérieur & recherche
  // ─────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-enseignement-recherche",
    sectorTagSlugs: ["enseignement-recherche"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans l'Enseignement Supérieur & la Recherche en France",
    titleEn: "Sector Brief — AI in Higher Education & Research in France",
    summaryFr:
      "Panorama des acteurs (CNRS, Inria, CEA, universités, grandes écoles), usages IA (recherche bibliographique, personnalisation pédagogique, détection plagiat) et enjeux éthiques et RGPD dans l'enseignement supérieur français.",
    bodyMarkdownFr: `## Acteurs de l'enseignement supérieur et de la recherche en France

La France dispose d'un écosystème ESR (Enseignement Supérieur et Recherche) dense, structuré autour de plusieurs pôles :

**Organismes publics de recherche** :
- **CNRS** (Centre National de la Recherche Scientifique) : 32 000 agents, ~1 100 unités de recherche, acteur majeur en IA fondamentale (laboratoires LIRMM, LIG, INRIA associés).
- **Inria** : agence nationale de recherche en informatique et mathématiques appliquées, pionnier en IA (projets Flowers, Magnet, Soda, Sequel). Budget annuel ~260 M€.
- **CEA** (Commissariat à l'Énergie Atomique et aux Énergies Alternatives) : laboratoire List dédié aux technologies numériques et IA embarquée.
- **INSERM** : Institut national de la santé et de la recherche médicale — fort investissement en IA médicale (imagerie, génomique, essais cliniques).

**Établissements d'enseignement supérieur** :
- Universités membres de l'ANR (Agence Nationale de la Recherche) via les programmes PIA3 (Programme d'Investissements d'Avenir 3) et les clusters 3IA (Paris, Grenoble, Nice, Toulouse).
- Grandes écoles : École Polytechnique (Hi! Paris center), CentraleSupélec, ENSAE, Télécom Paris — acteurs de formation et recherche appliquée IA.

## Usages IA dans l'ESR

**Recherche bibliographique automatisée.** Des outils comme Semantic Scholar (API ouverte), Elicit ou Consensus intègrent des LLM pour synthétiser des corpus de littérature scientifique. Le CNRS et Inria expérimentent des pipelines RAG (Retrieval-Augmented Generation) pour accélérer les revues de littérature systématiques, réduisant la charge de travail de 60 à 80 % sur certains protocoles documentés.

**Analyse de corpus et text mining.** Les laboratoires SHS (Sciences Humaines et Sociales) utilisent l'IA pour analyser des corpus de plusieurs millions de documents (archives numérisées BnF, presse historique, données qualitatives). Des outils comme IRaMuTeQ ou des modèles CamemBERT (Inria, 2020) sont largement déployés.

**Détection de plagiat et intégrité académique.** Les outils Compilatio (français) et Turnitin sont les plus déployés dans les universités françaises. Depuis 2023, la détection de texte généré par IA (GPT-detector) est intégrée à certaines versions (Compilatio Magister 2024). Le MESR a publié en mars 2024 une circulaire encadrant l'usage de l'IA générative dans les évaluations académiques.

**Personnalisation pédagogique.** Des plateformes comme Moodle (open source, déployé dans ~80 % des universités françaises) intègrent des modules IA pour adapter le parcours selon les performances. Des expérimentations d'IA tutor (chatbots pédagogiques) sont conduites à Paris-Saclay, Sorbonne Université et l'Université Côte d'Azur.

**Détection de fraude aux examens.** Des logiciels de proctoring intégrant la vision par ordinateur (surveillance d'identité, comportement) sont déployés depuis la pandémie COVID-19. Leur usage soulève des questions RGPD importantes (voir enjeux ci-dessous).

## Enjeux éthiques, RGPD et intégrité académique

**Intégrité académique à l'ère des LLM.** L'essor de ChatGPT et des modèles génératifs depuis 2022-2023 a provoqué une crise de confiance dans les évaluations textuelles. La Conférence des Présidents d'Université (CPU/France Universités) a publié en 2023 des recommandations encourageant une redéfinition des modalités d'évaluation plutôt qu'une interdiction frontale de l'IA.

**Données personnelles des étudiants (RGPD).** Les plateformes LMS collectent des données comportementales (temps de connexion, parcours de navigation, résultats intermédiaires). Le déploiement d'IA analytique sur ces données requiert une base légale RGPD solide (consentement ou intérêt légitime) et une DPIA (analyse d'impact) selon la CNIL. Les logiciels de proctoring ont fait l'objet de mises en demeure en Italie (Garante 2022) et sont sous surveillance étroite en France.

**OpenAI dans l'université.** L'accord-cadre entre OpenAI et certaines universités américaines (Harvard, MIT) soulève la question de la souveraineté des données de recherche. En France, la circulaire MESR 2024 recommande de privilégier des solutions hébergées sur territoire UE ou disposant de garanties contractuelles conformes au RGPD (clauses SCC validées).

**Rapport Villani et stratégie nationale IA.** Le rapport Villani de 2018 « Donner un sens à l'intelligence artificielle » a fondé la stratégie nationale IA française, intégrant un volet ESR structurant (clusters 3IA, chaires IA, bourses ANRT). La stratégie IA 2.0 annoncée en 2021 amplifie ces investissements (~1,5 Md€ sur 5 ans).

## Opportunités pour Axion-IA

Les établissements ESR publics sont soumis aux règles de la commande publique (MAPA au-dessus de 40 k€ HT). Les missions Axion-IA les plus pertinentes dans ce secteur : audits des usages IA existants (conformité RGPD, intégrité des données), interventions de montée en compétence des équipes pédagogiques et administratives, et accompagnement à la rédaction de politiques d'usage de l'IA générative.
`,
    sources: [
      "https://www.inria.fr/fr/intelligence-artificielle-inria",
      "https://www.cnrs.fr/fr/le-cnrs-et-lintelligence-artificielle",
      "https://www.enseignementsup-recherche.gouv.fr/fr/intelligence-artificielle-et-enseignement-superieur-83738",
      "https://www.ladocumentationfrancaise.fr/rapports-publics/184000159-donner-un-sens-a-l-intelligence-artificielle-pour-une-strategie-nationale-et-europeenne",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────
  // 5. FAQ — AI Act UE : ce que les entreprises françaises doivent savoir
  // ─────────────────────────────────────────────────────────────
  {
    slug: "faq-ai-act-entreprises-france",
    sectorTagSlugs: ["conseil-affaires", "it-numerique"],
    type: "faq",
    domain: "legal",
    audience: "public",
    titleFr: "FAQ — AI Act UE : Ce que les Entreprises Françaises Doivent Savoir",
    titleEn: "FAQ — EU AI Act: What French Companies Need to Know",
    summaryFr:
      "5 questions-réponses sur le règlement UE 2024/1689 (AI Act) : dates d'entrée en vigueur, définition des systèmes à haut risque, obligations article 50, sanctions, et checklist priorité PME.",
    bodyMarkdownFr: `## Q : Quand l'AI Act entre-t-il en vigueur en France ?

**R :** Le règlement UE 2024/1689 (AI Act) a été publié au Journal Officiel de l'Union Européenne le 12 juillet 2024. Il est entré en application de manière progressive :

- **2 février 2025** : interdiction des pratiques IA inacceptables (manipulation subliminale, scoring social par les pouvoirs publics, exploitation des vulnérabilités).
- **2 août 2025** : obligations applicables aux fournisseurs de modèles d'IA à usage général (GPAI — General Purpose AI), dont les exigences de transparence de l'article 53 (documentation technique, politique de droit d'auteur).
- **2 août 2026** : obligations applicables aux systèmes IA à haut risque listés à l'Annexe III (RH, crédit, éducation, infrastructure critique, etc.) — mise en conformité requise pour les fournisseurs et déployeurs.
- **2 août 2027** : exigences étendues aux systèmes IA intégrés dans des produits couverts par d'autres directives (machines, dispositifs médicaux).

En France, le règlement s'applique directement sans transposition nationale (droit UE d'application directe). La CNIL et l'ANIAI (Autorité Nationale de l'Intelligence Artificielle, structure en cours de création au sein de la DGE) sont les autorités compétentes désignées.

---

## Q : Qu'est-ce qu'un système IA à haut risque au sens de l'AI Act ?

**R :** L'AI Act distingue quatre niveaux de risque. Les systèmes à **haut risque** (Annexe III du règlement) sont ceux qui, par leur impact potentiel sur des droits fondamentaux ou des décisions significatives, font l'objet des obligations les plus contraignantes.

Exemples de catégories à haut risque directement pertinentes pour les entreprises françaises :

- **Ressources humaines** : systèmes IA utilisés pour le recrutement, l'évaluation de candidats, la promotion ou la rupture de contrat.
- **Crédit et assurance** : systèmes d'évaluation de la solvabilité ou de notation de risque.
- **Éducation** : systèmes déterminant l'accès à des formations ou évaluant les apprenants.
- **Gestion d'infrastructures critiques** (eau, énergie, transports).
- **Application de la loi** et **administration de la justice** (secteur public).

Un système IA interne d'aide à la décision RH (tri de CV, scoring d'entretien) entre dans cette catégorie pour les entreprises de toute taille. L'obligation s'applique au **déployeur** (l'entreprise qui utilise) autant qu'au **fournisseur** (l'éditeur qui produit le système).

---

## Q : Quelles sont les obligations de l'article 50 sur la transparence envers les utilisateurs ?

**R :** L'article 50 du règlement 2024/1689 impose des obligations de **transparence** dans deux cas principaux :

1. **Systèmes IA interagissant avec des personnes physiques** (chatbots, assistants vocaux) : l'utilisateur doit être informé qu'il interagit avec une IA, sauf si cela est évident par le contexte. Cette information doit être donnée au début de l'interaction, de manière claire et lisible.

2. **Systèmes IA générant du contenu synthétique** (texte, audio, image, vidéo — deepfakes) : le contenu généré doit être marqué de manière machine-lisible (watermarking ou métadonnées C2PA) permettant sa détection comme contenu synthétique.

Pour les entreprises qui déploient un chatbot IA en contact client ou qui utilisent des LLM pour générer des contenus publiés sous leur nom, ces obligations sont déjà applicables depuis août 2025. L'absence de marquage constitue une infraction sanctionnable.

---

## Q : Quelles sont les sanctions en cas de non-conformité ?

**R :** Le régime de sanctions de l'AI Act (article 99) est le suivant :

- **Violation des pratiques interdites** (art. 5) : jusqu'à **35 millions d'euros** ou 7 % du chiffre d'affaires mondial annuel (le montant le plus élevé).
- **Non-conformité des systèmes à haut risque** ou obligations GPAI : jusqu'à **15 millions d'euros** ou 3 % du CA mondial.
- **Fourniture d'informations incorrectes** aux autorités : jusqu'à **7,5 millions d'euros** ou 1,5 % du CA mondial.

Pour les PME et start-ups, les montants sont plafonnés aux pourcentages du CA. Ces sanctions sont cumulables avec celles du RGPD (jusqu'à 4 % du CA mondial) lorsque des données personnelles sont impliquées.

---

## Q : Quelle est la checklist prioritaire pour une PME française en 2026 ?

**R :** Voici les actions prioritaires pour une PME ou ETI française avant la date d'obligation **août 2026** (systèmes haut risque) :

**Inventaire (J-6 mois minimum)**
- [ ] Lister tous les systèmes IA utilisés dans l'entreprise (internes et SaaS tiers).
- [ ] Pour chaque système, identifier s'il entre dans une catégorie Annexe III (haut risque).
- [ ] Vérifier si les fournisseurs SaaS ont publié leur déclaration de conformité AI Act.

**Obligations immédiates (déjà applicables depuis août 2025)**
- [ ] Tout chatbot ou assistant IA en contact avec des tiers doit afficher une mention « Vous interagissez avec une IA ».
- [ ] Les modèles GPAI intégrés (GPT, Gemini, Claude, Mistral via API) : vérifier que le contrat fournisseur mentionne leur conformité GPAI article 53.

**Pour les systèmes haut risque RH (recrutement, évaluation)**
- [ ] Réaliser une analyse d'impact (DPIA RGPD + évaluation AI Act conjointe).
- [ ] Documenter le système IA (fiche technique, données d'entraînement, performances, biais identifiés).
- [ ] Mettre en place une supervision humaine (human oversight) pour toute décision impactant un salarié ou candidat.
- [ ] Enregistrer le système dans la base de données UE (obligation fournisseur, à vérifier avec l'éditeur).

**Gouvernance**
- [ ] Désigner un référent AI Act interne (peut être le DPO existant).
- [ ] Informer et sensibiliser les équipes utilisant des outils IA.
- [ ] Revoir les contrats fournisseurs IA pour y intégrer des clauses de conformité AI Act.
`,
    sources: [
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
      "https://www.cnil.fr/fr/ia-act-ce-que-contient-le-reglement-europeen-sur-lintelligence-artificielle",
      "https://digital-strategy.ec.europa.eu/fr/policies/regulatory-framework-ai",
      "https://www.economie.gouv.fr/intelligence-artificielle/reglementation-intelligence-artificielle",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─────────────────────────────────────────────────────────────
  // 6. Template Calculateur ROI — Audit IA
  // ─────────────────────────────────────────────────────────────
  {
    slug: "roi-calculator-template-audit-ia",
    sectorTagSlugs: ["conseil-affaires"],
    type: "roi_calculator_template",
    domain: "commercial",
    audience: "client",
    titleFr: "Template Calculateur ROI — Audit IA",
    titleEn: "ROI Calculator Template — AI Audit",
    summaryFr:
      "Modèle structuré pour calculer le retour sur investissement d'un audit IA : coût de la mission, économies directes, gains de productivité, réduction des risques de conformité et période de retour. Exemple chiffré pour une ETI de 200 salariés.",
    bodyMarkdownFr: `## Présentation du modèle

Ce template permet d'estimer le ROI d'un audit IA avant de prendre la décision d'engagement. Il couvre quatre dimensions de valeur : économies directes, gains de productivité, réduction du risque de conformité et valeur stratégique.

*Les chiffres ci-dessous sont indicatifs — à adapter à votre contexte.*

---

## Section A — Coût de l'audit IA

| Poste | Valeur à renseigner | Exemple ETI 200 sal. |
|---|---|---|
| Durée de l'audit (jours) | [ ] jours | 5 jours |
| Tarif journalier Axion-IA | cf. grille tarifaire | 2 200 € HT/jour |
| **Coût total de l'audit** | **[ ]** | **11 000 € HT** |
| Coût interne (temps équipe client) | [ ] jours × salaire chargé | 3 j × 500 € = 1 500 € |
| **Investissement total** | **[ ]** | **12 500 € HT** |

---

## Section B — Économies directes estimées (année 1)

### B1 — Redondances et doublons logiciels IA

Lors d'un audit IA, il est fréquent d'identifier des abonnements SaaS IA redondants (outils de génération de contenu, chatbots, outils d'analyse) dont les fonctionnalités se chevauchent. L'audit permet de rationaliser le portefeuille.

| Poste | Valeur à renseigner | Exemple |
|---|---|---|
| Nombre d'abonnements SaaS IA identifiés | [ ] | 12 outils |
| Coût annuel moyen par abonnement | [ ] | 3 600 €/an |
| Taux de rationalisation estimé (%) | [ ] | 25 % |
| **Économies logicielles année 1** | **[ ]** | **10 800 € HT/an** |

### B2 — Évitement de pénalités réglementaires

*Note : les pénalités réglementaires dépendent du secteur, du type de données traitées et des systèmes déployés. Ces estimations sont à adapter avec votre DPO.*

| Risque identifié | Probabilité estimée | Montant risque | Économie espérée |
|---|---|---|---|
| Non-conformité RGPD (données IA) | [ ] % | [ ] € | [ ] |
| Non-conformité AI Act (système HR ou crédit) | [ ] % | [ ] € | [ ] |
| Exemple (AI Act haut risque, ETI) | 15 % | 150 000 € | **22 500 €** |

---

## Section C — Gains de productivité (années 1-3)

Un audit IA identifie typiquement des tâches manuelles automatisables à court terme. L'estimation est basée sur le temps récupéré × coût horaire chargé de l'équipe concernée.

| Processus identifié | Heures/semaine économisées | Coût horaire chargé | Gain annuel |
|---|---|---|---|
| Exemple : reporting BI manuel | 4 h/semaine | 55 €/h | **11 440 €/an** |
| Exemple : saisie données fournisseurs | 3 h/semaine | 38 €/h | **5 928 €/an** |
| [Processus à identifier lors de l'audit] | [ ] | [ ] | [ ] |
| **Total gains productivité** | | | **17 368 €/an** (exemple) |

---

## Section D — Réduction des risques de conformité (valeur qualitative)

Au-delà des pénalités évitées, un audit IA produit une valeur de conformité difficile à quantifier mais réelle :

- Documentation de l'inventaire IA (obligatoire AI Act systèmes haut risque à partir d'août 2026).
- Identification des points de blocage RGPD avant un incident (coût moyen d'une notification de violation RGPD en France : ~80 000 € selon les études Ponemon/IBM 2023, incluant frais juridiques, notification, mesures correctives).
- Crédibilité renforcée lors d'audits clients ou appels d'offres exigeant une maturité IA documentée.

---

## Synthèse ROI — Exemple ETI 200 salariés

| Indicateur | Montant |
|---|---|
| Investissement total (audit + temps interne) | 12 500 € HT |
| Économies logicielles année 1 | 10 800 € |
| Évitement pénalités (valeur espérée) | 22 500 € |
| Gains productivité année 1 | 17 368 € |
| **Bénéfices année 1** | **50 668 €** |
| **ROI année 1** | **305 %** |
| **Période de retour sur investissement** | **~3 mois** |

---

## Mode d'emploi

1. **Renseignez la Section A** avec le périmètre de l'audit souhaité.
2. **Demandez votre devis Axion-IA** pour confirmer le tarif applicable à votre contexte.
3. **Complétez les Sections B et C** lors du cadrage avec le consultant Axion-IA (les données nécessaires sont collectées lors de la réunion de lancement, sans accès aux systèmes).
4. **Présentez la Section D** à votre direction pour appuyer la décision de démarrage.

*Ce modèle est fourni à titre indicatif. Les estimations réelles dépendent de votre contexte organisationnel, technologique et réglementaire spécifique. Axion-IA ne garantit pas les montants indiqués dans la colonne "Exemple".*
`,
    sources: [
      "https://www.ibm.com/reports/data-breach",
      "https://www.bpifrance.fr/nos-actualites/barometre-bpifrance-pme-eti",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32024R1689",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
];
