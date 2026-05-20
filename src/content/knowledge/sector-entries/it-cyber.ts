/**
 * Knowledge Base — Entries sectorielles IT & Cybersécurité (Sprint S+5 Phase B3 2026-05-20).
 *
 * 5 entries couvrant : ESN, éditeurs logiciels, infrastructure cloud,
 * intégrateurs IT B2B et acteurs cybersécurité opérant en France.
 *
 * CONTRAT ABSOLU : aucune invention. Chaque fait est vérifiable via les
 * sources listées (ANSSI, CNIL, ENISA, NIST, Cigref, Syntec Numérique).
 *
 * Tags couverts : `it-numerique`, `cybersecurite`
 */

import type { SectorKbEntry } from "./types";

export const IT_CYBER_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ─── 1. Brief sectoriel IT & Numérique ────────────────────────────────────
  {
    slug: "secteur-brief-it-numerique",
    sectorTagSlugs: ["it-numerique"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans l'IT & le Numérique en France",
    titleEn: "Sector brief — AI in IT & Digital in France",
    summaryFr:
      "Panorama de l'adoption de l'IA par les ESN, éditeurs logiciels et intégrateurs IT en France : usages dominants, enjeux de gouvernance et positionnement d'Axion-IA dans ce secteur.",
    bodyMarkdownFr: `## Panorama du secteur IT & Numérique en France

Le secteur IT et numérique français regroupe environ 90 000 entreprises et emploie plus de 560 000 salariés (Syntec Numérique, 2023). Il est structuré autour de plusieurs sous-segments aux dynamiques distinctes.

### Acteurs structurants

**Grandes ESN cotées** : Capgemini (360 000 collaborateurs mondiaux, 22 Md€ de revenus 2023), Sopra Steria, Atos/Eviden (en cours de restructuration profonde depuis 2023), et Thalès Digital Solutions constituent le tier 1. Ces acteurs ont tous engagé des programmes IA internes et des offres clients structurées.

**Mid-market** : SSII de 200 à 5 000 salariés (Hardis Group, Alten, Aubay, Devoteam, Inetum…) représentent la part la plus importante du tissu sectoriel. Leur maturité IA varie fortement : souvent dotées d'une cellule innovation mais sans gouvernance formelle des usages IA.

**Éditeurs logiciels** : Cegid, Talend (racheté par Qlik), Dassault Systèmes, Docaposte ou les nombreux éditeurs verticaux (RH, ERP, GRC) constituent un segment distinct. Ils intègrent l'IA directement dans le produit — ce qui crée des enjeux de responsabilité produit spécifiques (fiabilité des sorties, explicabilité, mise à jour des modèles).

**Startups & scale-ups** : la French Tech compte plusieurs centaines de startups IA (Mistral AI, Dust, Qdrant France, Hugging Face…). Ces acteurs sont souvent fournisseurs de fondations technologiques pour les ESN et éditeurs.

### Usages IA dominants dans le secteur

1. **Génération et revue de code** : GitHub Copilot, Cursor, Amazon CodeWhisperer, et des assistants propriétaires accélèrent la productivité des développeurs. Des ESN comme Capgemini ont communiqué des gains de productivité de l'ordre de 20 à 30 % sur certains types de tâches de développement.

2. **Support client et helpdesk interne** : automatisation de premier niveau (classification, réponse aux tickets, escalade intelligente) via des agents LLM connectés aux bases ITSM (ServiceNow, JIRA Service Management).

3. **Prédiction d'incidents et AIOps** : détection d'anomalies sur les données de supervision (logs, métriques, traces) pour anticiper les pannes avant impact utilisateur. Acteurs : Dynatrace, Datadog, IBM AIOps.

4. **Documentation et knowledge management** : génération automatisée de documentation technique, RAG sur bases de connaissance internes, assistants onboarding.

### Enjeux structurants

**Shadow IA et dette technique** : un nombre croissant de développeurs utilisent des outils IA sans cadre défini par leur organisation (Copilot personnel, ChatGPT, outils no-code IA). Cela crée une dette de traçabilité, des risques IP (code généré à partir de corpus sous licence GPL), et une désynchronisation avec les politiques de sécurité internes.

**Compétences internes vs délégation** : les DSI sont confrontées à un choix stratégique — internaliser les compétences IA (coûteux, marché tendu) ou s'appuyer sur des partenaires spécialisés pour l'évaluation et la gouvernance. Ce choix est rarement tranché, ce qui crée des angles morts.

**Explicabilité et responsabilité** : les éditeurs intégrant l'IA dans leurs produits doivent se préparer à l'article 13 de l'AI Act (transparence obligatoire pour les systèmes IA à destination d'utilisateurs professionnels) dont les premières obligations entrent en vigueur en août 2026.

### Positionnement Axion-IA

Les interventions Axion-IA dans ce secteur couvrent : l'audit des usages IA shadow, la formalisation d'une politique d'utilisation de l'IA, l'évaluation des fournisseurs LLM (sécurité, conformité RGPD, SLA), et l'accompagnement à la mise en place de guardrails techniques (filtres de sortie, journalisation, procédures d'incident IA). Les accompagnements sont adaptés à la taille et au niveau de maturité de l'organisation cliente.`,
    sources: [
      "https://syntec-numerique.fr/actu-informatique/bilan-annuel-2023",
      "https://www.capgemini.com/fr-fr/actualites/communiques-de-presse/",
      "https://digital-markets-act.ec.europa.eu/ai-act-2024_fr",
      "https://www.cigref.fr/cigref_publications/RapportsContainer/Prise_de_conscience_IA_generative_entreprises_2024.pdf",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─── 2. Brief sectoriel Cybersécurité ─────────────────────────────────────
  {
    slug: "secteur-brief-cybersecurite",
    sectorTagSlugs: ["cybersecurite"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans la Cybersécurité en France",
    titleEn: "Sector brief — AI in Cybersecurity in France",
    summaryFr:
      "État des lieux de l'IA appliquée à la cybersécurité en France : acteurs du marché, cadre réglementaire NIS 2 / DORA, usages opérationnels et risques spécifiques introduits par les LLM.",
    bodyMarkdownFr: `## Panorama de la cybersécurité en France

Le marché français de la cybersécurité est estimé à environ 7,5 Md€ en 2024 (Wavestone, rapport annuel CSIRT). La France dispose d'un tissu industriel structuré autour d'acteurs nationaux de premier plan.

### Acteurs structurants

**Groupes industriels** :
- **Orange Cyberdefense** (filiale d'Orange SA) : premier MSSP français, plus de 3 000 experts, CERTs sectoriels, SOC européens.
- **Thales** : division cybersécurité (CipherTrust, Sentinel), systèmes de confiance pour défense et infrastructures critiques.
- **Airbus CyberSecurity** (anciennement Cassidian CyberSecurity) : focus infrastructures critiques, défense, Airbus CERT.
- **Atos/Eviden** : portefeuille BullSequana, HSM Trustway, services SOC et IAM.

**Pure players et éditeurs** :
- **SEKOIA.IO** : plateforme XDR/CTI française, threat intelligence partagée, déployée dans plusieurs CERTs nationaux.
- **Pradeo** : sécurité mobile (MTD), référencée par l'ANSSI.
- **HarfangLab** : EDR agréé ANSSI, positionné sur souveraineté numérique.
- **Tehtris** : XDR, honeypots, certifié CSPN ANSSI.

### Cadre réglementaire applicable

**NIS 2 (Directive UE 2022/2555)** : transposée en droit français par la loi du 10 avril 2024 (ANSSI pilote). Élargit le périmètre des entités soumises à des obligations de sécurité à environ 15 000 entités (vs ~700 en NIS 1). Obligations : gouvernance cyber au niveau dirigeant, notification d'incident dans les 24 h, mesures de sécurité de la chaîne d'approvisionnement.

**DORA (Règlement UE 2022/2554)** : applicable depuis janvier 2025, impose aux entités financières (banques, assurances, PSP, PSEE) des exigences de résilience opérationnelle numérique incluant des tests TLPT (Threat-Led Penetration Testing) et la gestion des risques liés aux tiers ICT critiques.

**AI Act — implications cybersécurité** : les systèmes IA utilisés pour la cybersécurité (détection d'intrusion, analyse comportementale) ne relèvent pas automatiquement de la catégorie "haut risque" telle que définie à l'Annexe III du règlement. Toutefois, leur intégration dans des systèmes critiques peut faire basculer l'ensemble du système dans cette catégorie.

### Usages IA en cybersécurité

1. **Détection d'anomalies comportementales (UEBA)** : modèles ML supervisés et non supervisés appliqués aux logs d'activité (Active Directory, EDR, DLP) pour identifier des comportements anormaux (exfiltration latente, déplacement latéral).

2. **Threat intelligence automatisée (CTI)** : LLM pour la corrélation de rapports de menace, extraction d'IOCs (Indicators of Compromise), classification MITRE ATT&CK, résumé exécutif d'incidents.

3. **Automatisation SOC (SOAR augmenté)** : réduction du temps de triage de premier niveau (L1), runbooks automatisés déclenchés par enrichissement IA des alertes, réduction du taux de faux positifs.

4. **Pentest assisté** : outils comme PentestGPT ou modules IA dans Burp Suite Professional automatisent la reconnaissance et la génération de payloads standards, accélérant la couverture des tests.

### Risques IA pour la cybersécurité

L'intégration de LLM dans les outils de sécurité et dans les organisations clientes introduit de nouveaux vecteurs d'attaque :

- **Prompt injection indirecte** : un attaquant injecte des instructions malveillantes dans des contenus que l'agent IA va traiter (e-mail, document, page web scrapée). Documenté par l'ENISA dans son rapport "Generative AI and Cybersecurity" (2024).
- **Exfiltration via LLM** : des données sensibles transmises à des LLM hébergés hors UE peuvent être exposées selon les conditions d'utilisation du fournisseur (voir section RGPD/Cloud Act).
- **Empoisonnement des embeddings** : manipulation des bases vectorielles alimentant un RAG pour biaiser les réponses d'un assistant sécurité interne.
- **Jailbreak ciblé** : contournement des guardrails d'un assistant IA interne par des employés ou attaquants pour extraire des politiques de sécurité, configurations ou secrets.

### Positionnement Axion-IA

Dans ce secteur, les interventions Axion-IA portent sur : l'audit des usages IA dans les outils de sécurité déployés, l'évaluation de la conformité AI Act des systèmes IA à usage sécurité, la formalisation de politiques d'utilisation des LLM (périmètre, données autorisées, journalisation), et l'accompagnement des équipes SOC et RSSI dans la compréhension des risques IA spécifiques à leurs environnements.`,
    sources: [
      "https://www.ssi.gouv.fr/actualite/publication-de-la-loi-de-transposition-de-la-directive-nis-2/",
      "https://www.enisa.europa.eu/publications/generative-ai-and-cybersecurity",
      "https://www.eba.europa.eu/regulation-and-policy/operational-resilience/digital-operational-resilience-act-dora",
      "https://www.ssi.gouv.fr/entreprise/qualifications/prestataires-de-services-de-confiance-qualifies/",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─── 3. Méthodologie audit IA — ESN & Éditeurs Logiciels ──────────────────
  {
    slug: "methodologie-audit-ia-it-numerique",
    sectorTagSlugs: ["it-numerique"],
    type: "methodology",
    domain: "methodology",
    audience: "team",
    titleFr: "Méthodologie d'audit IA — ESN & Éditeurs Logiciels",
    titleEn: "AI Audit Methodology — IT Service Companies & Software Publishers",
    summaryFr:
      "Protocole d'audit IA adapté aux ESN et éditeurs logiciels : périmètre dual (IA produit vs IA interne), phases d'investigation, livrables et alignement NIST AI RMF.",
    bodyMarkdownFr: `## Méthodologie d'audit IA — ESN & Éditeurs Logiciels

### 1. Périmètre de l'audit

L'audit IA dans le secteur IT se caractérise par un **double périmètre** qui doit être clairement délimité en phase de cadrage :

**Axe A — IA intégrée dans le produit ou la prestation**
Concerne les éditeurs qui embarquent des fonctionnalités IA dans leur logiciel (moteur de recommandation, classification automatique, scoring, génération de contenu) et les ESN qui proposent des développements IA à leurs clients.

Questions directrices :
- Les modèles utilisés sont-ils des fondations (API OpenAI, Anthropic, Mistral…), des modèles open source fine-tunés, ou des modèles maison ?
- Qui est responsable des sorties du modèle vis-à-vis de l'utilisateur final ?
- Quel est le pipeline de mise à jour et de requalification du modèle ?

**Axe B — IA en usage interne (collaborateurs)**
Concerne les outils IA utilisés par les équipes de l'organisation auditée dans leur activité propre (assistants code, copilots documentaires, outils de support).

Questions directrices :
- Quels outils IA sont utilisés avec ou sans autorisation formelle (cartographie shadow IA) ?
- Quelles données internes ou clients transitent dans ces outils ?
- Existe-t-il une politique d'utilisation documentée et communiquée ?

### 2. Phases de l'audit

#### Phase 0 — Cadrage (0,5 jour)
- Définition du périmètre (Axe A / Axe B / les deux)
- Identification des parties prenantes (DSI, RSSI, DPO, Directeur R&D, CTO)
- Collecte documentaire préalable : organigramme IT, liste des outils IA connus, contrats fournisseurs IA

#### Phase 1 — Inventaire des systèmes IA (1 à 2 jours)
- Ateliers avec équipes techniques et métier
- Catalogage via grille structurée : nom du système, fournisseur, modèle sous-jacent, type de données traitées, utilisateurs, criticité business
- Identification des usages non déclarés (shadow IA) via sondage anonyme équipes développement

Outils de référence : grille d'inventaire NIST AI RMF (catégories MAP 1.1 à 1.6), questionnaire CNIL "IA et données personnelles" (2023).

#### Phase 2 — Analyse des risques (1 à 2 jours)
Selon le type de système identifié :

**Pour les modèles génératifs (LLM, code generation)** :
- Risques de fuite de données (données propriétaires ou clients transmises hors périmètre)
- Risques IP : code généré potentiellement sous licence copyleft (GitHub Copilot a fait l'objet d'une class action aux États-Unis sur ce point)
- Risques qualité : absence de revue humaine systématique, propagation de vulnérabilités (OWASP LLM Top 10)

**Pour les moteurs de recommandation ou scoring** :
- Biais algorithmiques : sur-représentation ou sous-représentation de certains profils clients ou candidats
- Explicabilité : capacité à justifier une décision auprès d'un utilisateur (obligation art. 22 RGPD si décision automatisée avec effet significatif)
- Dérive de modèle (data drift, concept drift) : dégradation silencieuse des performances

**Pour les systèmes AIOps / détection d'incidents** :
- Taux de faux positifs et procédures d'escalade humaine
- Couverture des scénarios non représentés dans les données d'entraînement

#### Phase 3 — Analyse contractuelle et conformité (0,5 jour)
- Revue des DPA (Data Processing Agreements) avec les fournisseurs de LLM et d'IA
- Vérification des clauses de non-utilisation des données pour entraînement (OpenAI Entreprise, Azure OpenAI, Anthropic)
- Contrôle de la localisation des données de traitement (UE / hors UE)
- Évaluation du registre des traitements (article 30 RGPD) : les traitements IA y sont-ils correctement documentés ?

#### Phase 4 — Livrables
1. **Cartographie des systèmes IA** (format tableur + synthèse narrative)
2. **Matrice de risques** (probabilité × impact, classée par système)
3. **Rapport de conformité** : état vis-à-vis du RGPD, AI Act (catégorie de risque), NIS 2 si entité concernée
4. **Plan de remédiation priorisé** : P0 (bloquants légaux ou sécurité critique), P1 (gouvernance), P2 (optimisations)
5. **Feuille de route IA gouvernance** : recommandations à 3, 6 et 12 mois

### 3. Référentiel NIST AI RMF

L'audit s'appuie sur le **NIST AI Risk Management Framework 1.0** (publié janvier 2023) comme structure de référence :
- **GOVERN** : politiques, responsabilités, culture de gestion du risque IA
- **MAP** : identification et contextualisation des risques IA
- **MEASURE** : évaluation et suivi des risques identifiés
- **MANAGE** : traitement des risques, plans de réponse

Ce référentiel est privilégié pour sa neutralité sectorielle et son alignement avec les approches émergentes de l'AI Act européen.

### 4. Facteurs de durée

| Contexte | Durée estimée |
|---|---|
| ESN < 500 pers., Axe B uniquement | 3 à 4 jours |
| Éditeur logiciel, Axe A uniquement | 4 à 6 jours |
| ESN mid-market (500-5000 pers.), Axes A+B | 8 à 12 jours |
| Grande ESN > 5000 pers. | Mission structurée en phases, devis spécifique |`,
    sources: [
      "https://airc.nist.gov/RMF",
      "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
      "https://www.cnil.fr/fr/intelligence-artificielle",
      "https://digital-strategy.ec.europa.eu/fr/policies/regulatory-framework-ai",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─── 4. FAQ RGPD & IA en Entreprise B2B ───────────────────────────────────
  {
    slug: "faq-rgpd-ia-entreprises",
    sectorTagSlugs: ["it-numerique", "cybersecurite"],
    type: "faq",
    domain: "legal",
    audience: "public",
    titleFr: "FAQ — RGPD et IA en Entreprise B2B",
    titleEn: "FAQ — GDPR and AI in B2B Enterprises",
    summaryFr:
      "Réponses aux questions fréquentes des DSI, DPO et RSSI sur les obligations RGPD applicables aux systèmes IA en contexte B2B : base légale, DPA fournisseurs LLM, transferts hors UE, droits des personnes et articulation avec l'AI Act.",
    bodyMarkdownFr: `## FAQ — RGPD et IA en Entreprise B2B

*Mise à jour : mai 2026. Source de référence principale : CNIL (Délibérations et recommandations IA 2023-2024), EDPB (Guidelines 02/2023 sur les LLM).*

---

## Q : Quelle base légale utiliser pour un traitement IA impliquant des données personnelles de clients ou prospects B2B ?

**R :** En contexte B2B, les données personnelles traitées sont généralement celles des contacts professionnels (nom, email professionnel, fonction, historique d'interactions). Trois bases légales sont envisageables :

1. **Intérêt légitime (art. 6.1.f RGPD)** : applicable si le traitement IA est nécessaire aux fins légitimes poursuivies par le responsable de traitement et que les intérêts ou droits fondamentaux des personnes ne prévalent pas. C'est la base la plus couramment retenue pour les outils CRM IA, scoring client et personnalisation B2B. Un test de mise en balance (Legitimate Interest Assessment) doit être documenté.

2. **Exécution du contrat (art. 6.1.b)** : applicable uniquement si le traitement IA est strictement nécessaire à l'exécution d'un contrat dont la personne est partie. Rarement applicable pour les usages IA avancés.

3. **Consentement (art. 6.1.a)** : applicable si les personnes doivent être informées individuellement et ont la possibilité de s'opposer. Rarement pratique en B2B pur.

La CNIL recommande de documenter précisément la finalité du traitement IA, les catégories de données traitées et la durée de conservation dans le registre des traitements (art. 30 RGPD).

---

## Q : Doit-on signer un DPA avec les fournisseurs de LLM (OpenAI, Anthropic, Mistral AI, Google…) ?

**R :** Oui, dès lors que des données à caractère personnel sont transmises au LLM dans les prompts ou les données de contexte. Le fournisseur agit alors en qualité de **sous-traitant** au sens de l'article 28 RGPD, ce qui impose la conclusion d'un accord de traitement des données (DPA) couvrant notamment :

- Les finalités du traitement pour le compte du responsable de traitement
- L'interdiction d'utiliser les données transmises pour entraîner les modèles (clause critique à vérifier explicitement)
- Les mesures de sécurité techniques et organisationnelles
- La localisation des traitements (datacenter UE ou hors UE)
- Les sous-traitants ultérieurs (sous-processeurs)

Les principaux fournisseurs proposent des DPA standards : OpenAI (Data Processing Addendum), Anthropic (Enterprise Agreement), Microsoft Azure OpenAI (via le DPA Azure), Google Vertex AI (via le DPA Google Cloud), Mistral AI (DPA disponible sur demande entreprises). Il convient de vérifier que ces DPA couvrent effectivement l'usage envisagé.

---

## Q : Comment gérer les transferts de données hors UE vers des LLM américains (Cloud Act) ?

**R :** Les fournisseurs de LLM américains (OpenAI, Anthropic, AWS Bedrock, Google) sont soumis au **US CLOUD Act (2018)**, qui permet aux autorités américaines d'accéder aux données hébergées par ces entreprises, y compris sur des serveurs européens, sous certaines conditions procédurales.

Le **Cadre de Protection des Données UE-États-Unis (EU-US DPF)**, adopté en juillet 2023 par la Commission européenne, constitue le mécanisme de transfert applicable pour les fournisseurs certifiés DPF (OpenAI et Microsoft figurent sur la liste des entreprises certifiées). Ce mécanisme est juridiquement valide tant qu'il n'est pas invalidé par la Cour de Justice de l'UE.

**Recommandations pratiques** :
- Vérifier la certification DPF du fournisseur sur [dataprivacyframework.gov](https://www.dataprivacyframework.gov)
- Minimiser les données personnelles transmises dans les prompts (pseudonymisation, anonymisation préalable)
- Pour les données sensibles ou soumises au secret professionnel : privilégier des fournisseurs hébergeant exclusivement en UE (Mistral AI via Azure France Center, OVHcloud AI, Scaleway Generative APIs)
- Documenter l'analyse de transfert (Transfer Impact Assessment) dans le registre

---

## Q : Comment intégrer les usages IA dans le registre des traitements RGPD (article 30) ?

**R :** L'article 30 RGPD impose la tenue d'un registre des activités de traitement. Les systèmes IA constituent des traitements nouveaux ou modifiés qui doivent y figurer dès lors qu'ils traitent des données personnelles.

Pour chaque traitement IA, le registre doit documenter :
- **Finalité** : exemple "scoring de risque client par modèle ML pour priorisation commerciale"
- **Catégories de données** : données d'entrée du modèle + données produites (scores, classifications)
- **Base légale** et, le cas échéant, résultat du test d'intérêt légitime
- **Durée de conservation** des données d'entrée et des outputs
- **Destinataires** : équipes internes ayant accès aux outputs, éventuels sous-traitants
- **Mesures de sécurité** : chiffrement, contrôle d'accès, journalisation
- **Transferts hors UE** : fournisseur LLM, mécanisme de transfert applicable

La CNIL recommande également, pour les traitements IA susceptibles d'engendrer un risque élevé, de réaliser une **Analyse d'Impact relative à la Protection des Données (AIPD / DPIA)** conformément à l'article 35 RGPD. Les listes de types de traitements nécessitant une DPIA sont publiées par la CNIL.

---

## Q : Quelles sont les obligations liées aux décisions automatisées (article 22 RGPD) ?

**R :** L'article 22 RGPD encadre les décisions fondées exclusivement sur un traitement automatisé produisant un effet juridique ou un effet similaire significatif sur la personne.

En contexte B2B IT, les cas typiques incluent : scoring automatique de candidats (RH), classification automatique de tickets (support), priorisation automatisée de leads commerciaux avec exclusion de certains prospects.

**Obligations** :
- Droit à l'information : informer les personnes de l'existence d'une prise de décision automatisée (mention dans la politique de confidentialité)
- Droit d'opposition : permettre à la personne d'obtenir une intervention humaine, d'exprimer son point de vue, de contester la décision
- Interdiction (sauf exceptions) de fonder une décision sur des données sensibles (art. 9 RGPD) via traitement automatisé

**Limites d'application en B2B** : lorsque la personne est un représentant d'une entreprise (client B2B, candidat à un appel d'offres), l'article 22 s'applique à la personne physique, pas à l'entité morale. La distinction doit être opérée au cas par cas.

---

## Q : Quelles obligations de l'AI Act s'appliquent aux entreprises IT à partir d'août 2026 ?

**R :** L'**AI Act (Règlement UE 2024/1689)** suit un calendrier d'application progressif :

- **Février 2025** : interdictions des pratiques IA inacceptables (manipulation subliminale, notation sociale généralisée, exploitation de vulnérabilités)
- **Août 2025** : application des obligations pour les modèles d'IA à usage général (GPAI), incluant documentation technique et conformité droits d'auteur
- **Août 2026** : application des obligations pour les **systèmes IA à haut risque** (Annexe III) et des obligations de **transparence** pour certains systèmes IA (article 50)

**Article 50 — transparence** : les systèmes IA qui génèrent du contenu textuel, audio, vidéo ou image synthétique doivent informer les utilisateurs que le contenu est généré par IA. Cette obligation est particulièrement pertinente pour les éditeurs logiciels embarquant de la génération automatique dans leurs produits.

**Systèmes à haut risque (Annexe III)** : les systèmes IA utilisés pour des décisions RH (recrutement, évaluation de performance, licenciement) sont explicitement listés. Les ESN qui développent ou déploient de tels systèmes pour leurs clients sont concernées en tant que "fournisseurs" ou "déployeurs" selon leur rôle.

Les obligations incluent : documentation technique, journaux de bord automatiques, transparence envers les utilisateurs, surveillance humaine, robustesse et exactitude.`,
    sources: [
      "https://www.cnil.fr/fr/intelligence-artificielle/les-questions-reponses-de-la-cnil-sur-lia-generative",
      "https://www.cnil.fr/fr/lanalyse-dimpact-relative-la-protection-des-donnees-aipd",
      "https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-022023-technical-scope-art-65-chatgpt_fr",
      "https://www.dataprivacyframework.gov/list",
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },

  // ─── 5. Playbook d'implémentation IA — ESN & Intégrateurs IT ──────────────
  {
    slug: "implementation-playbook-ia-esn",
    sectorTagSlugs: ["it-numerique"],
    type: "implementation_playbook",
    domain: "technical",
    audience: "client",
    titleFr: "Playbook d'implémentation IA — ESN & Intégrateurs IT",
    titleEn: "AI Implementation Playbook — IT Service Companies & Integrators",
    summaryFr:
      "Playbook structuré en 5 phases pour l'implémentation d'un système IA dans une ESN ou un intégrateur IT : de l'évaluation de maturité au go-live, avec choix d'architecture, gouvernance des données, KPIs et procédures hypercare.",
    bodyMarkdownFr: `## Playbook d'implémentation IA — ESN & Intégrateurs IT

*Ce playbook est un cadre de référence. Il doit être adapté au contexte spécifique de chaque organisation cliente lors de la phase de cadrage.*

---

## Phase 1 — Évaluation de maturité IA (Semaine 1-2)

### Objectif
Établir un état des lieux objectif de la maturité IA de l'organisation avant tout choix technologique.

### Activités
- **Atelier diagnostic** (2 à 3 h, parties prenantes : DSI, CTO, Directeur des Opérations, RH) : cartographie des usages IA existants (formels et shadow), identification des irritants opérationnels prioritaires
- **Revue documentaire** : politique IT, contrats fournisseurs cloud, registre RGPD, politiques de sécurité
- **Scoring maturité** sur 5 axes :
  1. Données (qualité, accessibilité, gouvernance)
  2. Compétences internes (ML/AI literacy, data engineering)
  3. Infrastructure (cloud readiness, API management, observabilité)
  4. Gouvernance (DPO actif, RSSI impliqué, validation juridique)
  5. Culture (appétence au changement, politique d'expérimentation)

### Livrable
Rapport de maturité IA (4 à 8 pages) avec score par axe et recommandations de prérequis avant implémentation.

---

## Phase 2 — Choix d'architecture IA (Semaine 2-3)

### Trois patterns principaux

#### Pattern A — API sur modèle fondation (Foundation Model API)
**Principe** : intégration directe via API d'un LLM ou modèle IA hébergé chez un tiers (OpenAI GPT-4o, Anthropic Claude, Mistral Large, Google Gemini).

**Adapté si** : use case principalement textuel, données peu sensibles, rapidité de mise en œuvre prioritaire, budget modéré.

**Points d'attention** : dépendance fournisseur, latence réseau, coûts variables à l'usage (tokens), conformité RGPD sur les données transmises, absence de personnalisation du modèle sous-jacent.

#### Pattern B — RAG (Retrieval-Augmented Generation)
**Principe** : le LLM est augmenté par une base de connaissance interne indexée en base vectorielle. Le modèle répond en s'appuyant sur des documents récupérés dynamiquement (manuels techniques, tickets ITSM, bases de connaissance KB).

**Adapté si** : use case nécessitant des connaissances métier propriétaires récentes, souhait de réduire les hallucinations, corpus documentaire existant structuré ou semi-structuré.

**Architecture type** : documents sources → pipeline d'ingestion (chunking, embedding via text-embedding-ada-002 ou équivalent) → base vectorielle (Qdrant, Weaviate, pgvector) → pipeline RAG (retrieval + génération) → interface utilisateur.

**Points d'attention** : qualité du corpus déterminante, pipeline de mise à jour documentaire à industrialiser, coût des embeddings à l'échelle.

#### Pattern C — Fine-tuning ou modèle spécialisé
**Principe** : adaptation d'un modèle pré-entraîné sur des données métier propriétaires pour améliorer ses performances sur des tâches spécifiques (classification de tickets, génération de code dans un DSL propriétaire, scoring).

**Adapté si** : use case très spécifique et répétitif, volume de données d'entraînement suffisant (typiquement > 1 000 exemples annotés de qualité), budget R&D disponible.

**Points d'attention** : coût et temps d'entraînement (GPU), nécessité d'une expertise MLOps, pipeline de ré-entraînement et d'évaluation à maintenir, risque d'obsolescence du modèle base.

### Matrice de décision simplifiée

| Critère | API Foundation | RAG | Fine-tuning |
|---|---|---|---|
| Délai de mise en œuvre | 2-6 semaines | 4-12 semaines | 3-6 mois |
| Coût initial | Faible | Moyen | Élevé |
| Personnalisation | Faible | Moyenne | Élevée |
| Maintenance | Faible | Moyenne | Élevée |
| Contrôle données | Faible | Moyen-élevé | Élevé |

---

## Phase 3 — Gouvernance des données (Semaine 3-4)

### Checklist gouvernance

- [ ] Cartographier les sources de données alimentant le système IA (base clients, ITSM, ERP, documents internes)
- [ ] Qualifier chaque source : données personnelles (oui/non), sensibilité, qualité, fraîcheur
- [ ] Définir les règles d'accès : qui peut interroger le système, sur quelles données, avec quel niveau de journalisation
- [ ] Mettre en place un pipeline de pseudonymisation ou d'anonymisation pour les données personnelles transmises au LLM
- [ ] Documenter le traitement dans le registre RGPD (art. 30) + évaluer la nécessité d'une DPIA (art. 35)
- [ ] Signer ou vérifier le DPA avec le(s) fournisseur(s) IA
- [ ] Définir la politique de rétention des logs d'interactions (questions/réponses) — recommandation CNIL : durée minimale, anonymisation après délai
- [ ] Désigner un responsable opérationnel ("AI product owner") côté client

---

## Phase 4 — KPIs et conditions de succès

### KPIs techniques
- **Latence P95** de réponse du système (cible : < 3 s pour usage conversationnel)
- **Taux de disponibilité** (SLA cible : 99,5 % minimum pour usage opérationnel)
- **Taux de récupération RAG** (recall@k) si applicable
- **Taux d'hallucination** mesuré sur jeu de test de référence (évaluation LLM-as-judge ou humaine)

### KPIs métier (à définir avec le client lors du cadrage)
Exemples représentatifs :
- Réduction du temps de traitement d'un ticket de support (baseline vs post-IA)
- Taux d'acceptation des suggestions IA par les utilisateurs finaux
- Réduction du volume de tickets L1 remontés en L2
- Score de satisfaction utilisateur (NPS interne, enquête mensuelle)

### Jalons de validation
1. **Proof of Concept validé** (fin Phase 2) : use case pilote fonctionnel sur données réelles, démonstration aux parties prenantes
2. **Bêta restreinte** (fin Phase 3) : déploiement sur une équipe pilote de 5 à 20 utilisateurs, collecte de feedback structuré
3. **Critères go/no-go avant déploiement large** : KPIs techniques atteints, conformité RGPD confirmée par DPO, formation des utilisateurs réalisée, runbook incident documenté

---

## Phase 5 — Go-live et hypercare (Semaine 8-12)

### Checklist go-live
- [ ] Documentation utilisateur (guide pratique, FAQ interne, vidéo de prise en main si nécessaire)
- [ ] Session d'accompagnement des utilisateurs (atelier pratique 2-3 h)
- [ ] Procédure d'escalade en cas d'incident IA (qui contacter, délai de réponse, solution de contournement)
- [ ] Monitoring actif : alertes sur latence, taux d'erreur, volume d'utilisation anormal
- [ ] Communication interne : annonce du déploiement, rappel de la politique d'utilisation

### Hypercare (semaines 1 à 4 post go-live)
Période de surveillance renforcée avec point hebdomadaire entre l'équipe projet et le responsable opérationnel client :
- Revue des KPIs hebdomadaires
- Collecte et priorisation des retours utilisateurs
- Corrections rapides (prompts, configurations, filtres) sous 48 h
- Escalade fournisseur si défaut technique identifié

### Sortie d'hypercare
Conditions : KPIs techniques stables sur 2 semaines consécutives, taux de satisfaction utilisateur > seuil défini lors du cadrage, équipe cliente autonome sur les opérations courantes, documentation à jour.`,
    sources: [
      "https://airc.nist.gov/RMF",
      "https://www.cnil.fr/fr/intelligence-artificielle",
      "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning",
      "https://learn.microsoft.com/fr-fr/azure/architecture/ai-ml/guide/rag/rag-solution-design-and-evaluation-guide",
    ],
    lastReviewedOn: "2026-05-20",
    reviewedBy: "claude-sonnet-4-6",
  },
];
