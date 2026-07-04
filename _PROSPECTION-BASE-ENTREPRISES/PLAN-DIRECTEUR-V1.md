# Plan directeur — Module « Prospection & Base Entreprises » (Axion-IA)

> **Statut : PLAN v1.1 (aucun code). À valider par Will avant toute conception/implémentation.**
> **v1.1 = intégration d'un audit adversarial 4 axes** (pilotage/reporting · efficacité/scalabilité ·
> modèle données/personnes · RGPD/sources/UI). Les ajouts sont marqués **[AUDIT]**. Synthèse des
> corrections structurantes en **§17**.
> Niveau d'exigence : dossier de conception complet (comparable au dossier LMS e-learning).
> Date : 2026-07-01. Périmètre : **V1 = constitution de base + enrichissement + pilotage +
> suivi + export. PAS de cold-outreach en V1.** Sources **gratuites uniquement**.
> Infrastructure : **celle d'axionia** (Next.js 16 + Prisma + BullMQ + Server Actions), PAS
> celle de SOS-Expat (le backlink-engine Fastify ne sert que de **référence de patterns**).

---

## 0. Décisions verrouillées (par Will)

| #   | Décision           | Valeur retenue                                                                                                                                  | Conséquence                                                                                                                                                                                 |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Sources de données | **Gratuit uniquement, collecte ET enrichissement** (API Recherche d'entreprises + INSEE Sirene + scraping des sites publics / mentions légales) | **Aucune source payante** dans l'architecture. Email/téléphone non fournis par les API → obtenus gratuitement par scraping du site public quand il existe ; taux mesuré honnêtement (§5.10) |
| D2  | Finalité V1        | **Constitution de base + export**                                                                                                               | Aucun envoi d'email/SMS de prospection depuis Axion-IA en V1 ; moteur d'outreach = V2 sous condition RGPD                                                                                   |
| D3  | Infrastructure     | **axionia** (Prisma/BullMQ/Server Actions)                                                                                                      | Interdit : port du service Fastify SOS-Expat, second système parallèle                                                                                                                      |
| D4  | Livrable actuel    | **Ce plan** (pas de code)                                                                                                                       | La création du skill + le code viennent après validation du plan                                                                                                                            |

**Restent à décider (voir §14)** : cible métier (verticales prioritaires), quotas de collecte,
destination de l'export (CSV vs CRM Qualiopi vs les deux), méthode de découverte du site web
d'une entreprise (le maillon faible du « gratuit »), et le nom définitif du module.

---

## 1. Objectif & besoin métier

Construire un système qui permet, **depuis la console d'administration**, de :

1. **Collecter** toutes les entreprises françaises, **département par département**, filtrables par
   **secteur d'activité** (code NAF/APE, ex. BTP, santé, droit) et par **taille** (TPE / PME / ETI / GE).
2. **Enrichir** chaque entreprise : **dirigeant(s) ou cadres**, **email**, **téléphone**, **ville /
   adresse**, + attributs (SIREN/SIRET, effectif, date de création, forme juridique…).
3. **Piloter** la collecte : lancer/planifier des campagnes paramétrées (dép × activité × taille).
4. **Suivre l'avancement** : **taux de ce qui a déjà été fait**, par département, par type d'activité,
   par taille d'entreprise (matrice de couverture).
5. **Exploiter** la base : recherche/filtrage, fiches entreprise, **export** (CSV / CRM).

### Périmètre V1 vs V2

| Capacité                                                               | V1 (ce plan)                 | V2 (extension, hors périmètre) |
| ---------------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| Collecte dép × NAF × taille (sources gratuites)                        | ✅                           | —                              |
| Enrichissement dirigeants + adresse/ville                              | ✅                           | —                              |
| Email/téléphone **gratuits** (scraping site public + mentions légales) | ✅ (taux mesuré honnêtement) | — (reste gratuit)              |
| Pilotage + suivi de couverture + dashboard                             | ✅                           | —                              |
| Recherche/filtrage + fiches + export                                   | ✅                           | —                              |
| Cold-outreach (emailing, séquences, IMAP replies)                      | ❌                           | ✅ sous condition RGPD         |
| Scoring/priorisation avancée, dédoublonnage inter-sources              | Basique                      | Avancé                         |

---

## 2. État des lieux (ce qui existe et qu'on RÉUTILISE)

### 2.1 Ce qui n'existe PAS (à construire)

Aucun modèle Company/Prospect, aucun worker de collecte d'entreprises, aucune section admin de
prospection, aucune matrice de couverture entreprises, aucun connecteur SIRENE/NAF. (Vérifié par
audit : 95+ modèles Prisma, 46 workers, 12 pôles admin — rien pour la prospection B2B.)

### 2.2 Ce qui existe et sert de SOCLE réutilisable (gain majeur)

| Brique existante                           | Fichier (à reconfirmer en Phase 0)                                                                                | Réutilisation prospection                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Client Prisma stub-aware                   | `src/lib/prisma.ts`                                                                                               | ORM + contrat build stub.invalid                    |
| Client Redis stub-aware                    | `src/lib/redis.ts`                                                                                                | Files BullMQ                                        |
| Registre des files/queues                  | `src/server/queue/queues.ts` (+ `worker.ts`)                                                                      | Y ajouter les files `prospection-*`                 |
| Wrapper Sentry worker                      | `src/server/queue/lib/sentry-worker.ts`                                                                           | Observabilité workers                               |
| **Fetch réseau SSRF-safe**                 | `ssrfSafeFetch()` (content-rss-fetch)                                                                             | **Tous les appels HTTP de collecte/enrichissement** |
| **Respect robots.txt / ai.txt**            | `kb-ingest-external.ts`                                                                                           | Loyauté du scraping site public                     |
| **Extraction HTML sans dépendance lourde** | `kb-ingest-external.ts`                                                                                           | Extraire email/tél des pages contact/mentions       |
| Cost-tracker                               | `src/server/content-gen/cost-tracker.ts` (à confirmer)                                                            | Suivi coût des appels API                           |
| Client Perplexity Search                   | providers content-gen                                                                                             | Découverte du site web d'une entreprise (option)    |
| **Pattern coverage-map**                   | `CityGenerationOrder` + `src/server/actions/content-gen/coverage-map.ts` + page `/admin/content-gen/coverage-map` | **Modèle exact du suivi dép × activité × taille**   |
| Pattern campagne multi-axes                | orchestrateur content-gen (croise activité/secteur/ville…)                                                        | Modèle du wizard de campagne                        |
| SSOT navigation admin                      | `src/lib/admin-nav.ts` (12 pôles)                                                                                 | Ajouter le pôle « Prospection »                     |
| Config par `SiteSetting`                   | catégorie dédiée                                                                                                  | Quotas, rate-limits, seuils, fenêtre de fraîcheur   |
| Purge de rétention RGPD                    | `retention-purge-worker.ts`                                                                                       | Étendre à la base entreprises                       |
| Import INSEE villes (référence)            | `scripts/import-insee-villes.ts` (geo.api.gouv.fr)                                                                | Modèle d'un import public officiel                  |

### 2.3 Ce qui existe mais qu'on NE réutilise PAS

- Le **service Fastify SOS-Expat backlink-engine** : uniquement source d'inspiration (patterns
  enrichment/dedup/campaign/event-log/dashboard). On **porte les idées**, pas le code.
- Le **CRM clients Qualiopi** (`Client`) : reste dédié à la formation ; la base prospection est
  **distincte** (voir §5.6 pour un pont d'export optionnel).

### 2.4 Patterns retenus du backlink-engine (portés aux conventions axionia)

Enrichment worker (fetch → traite → stocke → enfile la suite) · Orchestrateur de collecte multi-
sources · **Déduplication 2 niveaux** (ici SIREN/SIRET + domaine) · Config-driven throttle/éligibilité
· Système de **tags hiérarchiques** (ajouter TAILLE, DÉPARTEMENT, SECTEUR) · **Event log append-only**
(audit + base du suivi de couverture) · Dashboard temps réel avec cache Redis · Index composites.

---

## 3. Contraintes transverses (cadrent TOUT le plan)

1. **RGPD / CNIL** (détail §11) — contrainte n°1. Le dirigeant est une **donnée personnelle**.
   Base légale, information, durée de conservation, droit d'opposition, **loyauté de la source**.
2. **Contrat de build `stub.invalid` (ADR 0026)** — tout worker/appel réseau doit être **stub-aware**
   (early-exit si `DATABASE_URL`/`REDIS_URL` contiennent `stub.invalid` ; aucun appel API au build SSG).
3. **Web Vitals** (LCP ≤ 1800 ms, INP ≤ 100 ms, CLS = 0, First Load JS ≤ 75 KB gz/route) — s'applique
   aux **pages admin** créées (tables/filtres/coverage-map client-heavy → surveiller INP & bundle).
4. **Cloisonnement strict** — tout le module sous des chemins dédiés (voir §4.3), zéro fuite dans le
   public, zéro dépendance croisée avec content-gen/qualiopi hormis les briques socle.
5. **Migrations additives uniquement** — aucun `DROP` ; naming horodaté (`YYYYMMDDHHMMSS_prospection_*`).
6. **Server Actions, pas de REST** — sauf routes techniques justifiées (téléchargement d'export,
   webhook) ; jamais d'`/api/v1`.
7. **next-intl FR canonique** — libellés admin en FR ; le module est **franco-français** (données
   France) → pas d'effort EN (EN désactivé côté public de toute façon).
8. **Branche/worktree isolé** — jamais de travail sur le working tree principal partagé ; push = deploy.

---

## 4. Architecture cible

### 4.1 Vue en couches (pipeline de bout en bout)

```
                    ┌────────────────────────────────────────────────┐
   CONSOLE ADMIN →  │  Pilotage : wizard campagne (dép × NAF × taille)│
   (frontend)       │  Suivi : coverage-map + dashboard + fiches      │
                    │  Export : CSV / CRM                             │
                    └───────────────┬────────────────────────────────┘
                                    │ Server Actions
                    ┌───────────────▼────────────────────────────────┐
   BACKEND          │  Orchestrateur de campagne                      │
   (services +      │   └─ découpe en tâches dép×NAF×tranche (work-list)│
    workers BullMQ) │  Worker COLLECTE  → API Recherche d'entreprises  │
                    │  Worker ENRICHISSEMENT → dirigeants + site public│
                    │  Worker COVERAGE (agrège l'avancement)          │
                    │  Worker EXPORT (génère CSV) [+ RGPD purge]      │
                    └───────────────┬────────────────────────────────┘
                                    │ Prisma (additif)
                    ┌───────────────▼────────────────────────────────┐
   STOCKAGE         │ Company · Establishment · CompanyPerson · Contact │
   (Postgres)       │ Campaign · CoverageCell · CollectRun · Event    │
                    │ Tag/CompanyTag · SuppressionEntry (opposition)  │
                    └─────────────────────────────────────────────────┘
   SOURCES EXTERNES : recherche-entreprises.api.gouv.fr (principal) ·
                      INSEE Sirene (complément) · site web entreprise (best-effort)
```

### 4.2 Principe directeur du suivi = la matrice EST la work-list

La **matrice de couverture** (dép × NAF × taille) n'est pas seulement un tableau de bord : c'est la
**liste de travail** qui garantit l'exhaustivité. Chaque cellule a un état
(`à_faire → en_cours → fait → erreur`) + compteurs (attendu / collecté / enrichi). L'orchestrateur
consomme les cellules `à_faire`, ce qui rend la collecte **reprise-sur-panne** et **mesurable** — exactement
le pattern `CityGenerationOrder`/coverage-map du content-gen, transposé.

### 4.3 Cloisonnement (emplacements cibles — à confirmer en Phase 0)

```
src/server/prospection/**                         ← logique métier (connecteurs, mapping, services)
src/server/queue/workers/prospection-*-worker.ts  ← workers BullMQ (collect, enrich, coverage, export)
src/server/actions/prospection/**                 ← Server Actions (campagnes, recherche, export)
src/app/[locale]/(admin)/[adminPrefix]/prospection/**  ← pages console admin
src/components/admin/prospection/**               ← composants UI admin
prisma/schema.prisma + prisma/migrations/…_prospection_*  ← modèles + migrations additives
src/lib/prospection/**                            ← purs (mapping NAF, mapping taille, constantes SSOT)
```

---

## 5. Modèle de données (plan — champs & relations, pas de code)

> Toutes les tables sont **additives**, `@@map` snake_case, index composites pour les requêtes de
> liste et de couverture. Déduplication forte sur **SIREN** (entreprise) et **SIRET** (établissement).

### 5.1 `Company` (entreprise = personne morale, unité légale)

- Identité : `siren` (UNIQUE), `denomination`, `nomComplet`, `sigle`, `formeJuridique` (code + libellé),
  `dateCreation`, `etatAdministratif` (actif/cessé), `economieSocialeSolidaire`.
- Activité : `naf` (code APE, ex. `62.01Z`), `nafLibelle`, `sectionNaf` (lettre), **`secteur`** (regroupement
  métier interne : BTP, Santé, Droit… via mapping SSOT `src/lib/prospection/naf-to-secteur.ts`).
- Taille : `trancheEffectif` (code INSEE), `effectifEstime` (int), **`taille`** enum `TPE|PME|ETI|GE`
  (dérivée — voir §5.7), `categorieEntreprise` (PME/ETI/GE, champ INSEE brut).
- Géo (siège) : `departement`, `codePostal`, `commune`, `communeCode` (INSEE), `adresse`, `latitude`,
  `longitude`, `region`.
- Contact synthèse : `siteWeb` (si trouvé), `emailPublic`, `telephonePublic` (best-effort, voir §5.4).
- **Type d'organisation** : `natureJuridique` (code + libellé INSEE), **`typeOrganisation`** enum
  `privee|publique|parapublique|association|collectivite|epic` (dérivé de la nature juridique →
  **inclut EDF, La Poste, SNCF, administrations, collectivités, EPIC, associations** — voir §5.11).
- **Exploitabilité** : **`contactabilite`** enum `exploitable|partiel|non_contactable`,
  `hasEmail` / `hasTelephone` (bool), **`leadScore`** (0-100) — dérivés, voir §5.10.
- **Anti-re-scrape / fraîcheur** : `firstSeenAt`, `lastCollectedAt`, `lastCheckedAt`,
  `contentHash` (empreinte des champs enrichis), `refreshAfter` (date de re-crawl autorisé) — voir §6.5.
- Méta collecte : `source` (`recherche_entreprises`/`sirene`/`site_scrape`), `collectRunId`,
  `enrichmentStatus` (`pending|enriching|enriched|failed|no_data`), `lastEnrichedAt`, `dataQuality` (0-100).
- **Champs prospection [AUDIT P1-3]** : `siteWebStatus` (`verifie|mort|redirige|inconnu`),
  `domainMatchMethod` + `domainConfidence` (preuve d'appartenance du domaine au SIREN, §P1-3),
  `contactFormUrl?` (form quand pas d'email), `socials` (JSON : FB/Insta/X/YT du footer), `linkedinUrl?`
  (si publié sur le site), `langueSite`, `tvaIntracom?`, `capitalSocial?`, `rcs?`, `horaires?`.
- **RGPD/diffusion [AUDIT A2]** : `statutDiffusion` (INSEE — les **non-diffusibles sont exclus** de
  collecte/affichage/export), `oppositionProspectionRNE` (bool, respecté partout), `optOut`, `optOutAt`,
  `retentionUntil` (purge). **Provenance field-level** `fieldProvenance` (JSON `{champ:{source,url,
collectedAt,confidence}}`) pour la traçabilité de réconciliation multi-sources **[AUDIT P1-4]**.

### 5.2 `Establishment` (établissement = SIRET)

- `siret` (UNIQUE), `companyId` (FK), `estSiege` (bool), `naf`, `trancheEffectif`, adresse complète,
  `departement`, `codePostal`, `commune`, `latitude`, `longitude`, `etatAdministratif`.
- Justif : une entreprise a N établissements ; on collecte le **siège** en V1, les autres en option.

### 5.3 `CompanyPerson` (dirigeants LÉGAUX **+ responsables de secteur/équipe** — DONNÉE PERSO) — 1 → N

**[AUDIT P0-5]** Entité **généralisée** (pas seulement le dirigeant légal) : capture aussi les
**responsables de secteur, chefs de service, managers, directeurs régionaux, responsables commerciaux/
achats/RH** visibles sur les pages « équipe/direction » des sites. On stocke **toutes** les personnes.

- Identité : `companyId` (FK), `establishmentId?` (rattachement agence, §5.2), `nom`, `prenoms`,
  `titreVerbatim` (texte exact du site), `photoUrl?`, `linkedinUrl?` (**uniquement si publié sur le
  site de l'entreprise** — jamais scrapé sur LinkedIn, §9 B1).
- **`personKey` [AUDIT P0-4]** = hash(`nom`+`prenoms` normalisés) **SANS la fonction** (la fonction est
  variable/multi-valuée ; l'inclure créait de faux doublons). Accents/casse/ordre prénoms normalisés.
- **Rôles multiples** `CompanyPersonRole` (1→N) : `qualiteRaw`, **`fonctionNormalisee`** (enum via SSOT
  `qualite-to-fonction.ts`), **`seniorite`** (`dirigeant|directeur|responsable|manager|cadre|autre`),
  **`departementFonctionnel`** (`direction|commercial|rh|achats|finance|technique|dsi|marketing|
juridique|production|qhse|autre`), `estDirigeantLegal` (bool : RCS/Sirene vs scrape site), `source`
  (`sirene|rne|recherche_entreprises|site_scrape`), `sourceUrl`, `collectedAt`. → permet « tous les
  responsables achats en BTP dans le 38 ».
- **Lien personne ↔ email nominatif [AUDIT P1-1]** : `CompanyContact.personId` rempli par un matching
  déterministe (`prenom.nom@`, `pnom@`, `nom@`…) avec `personMatchConfidence`.
- Même personne dans **plusieurs entreprises** = **plusieurs lignes légitimes** (dédup **par
  entreprise** ; lien inter-entreprises via `personKey`, jamais fusion) → page `/personnes/[personKey]`.
- **RGPD par personne [AUDIT P1-5]** : `optOut`, `optOutAt`, `retentionUntil` sur la personne (droits
  individuels, transverses aux entreprises). ~~`dateNaissance`~~ **retirée [AUDIT A7]** (non nécessaire
  à la prospection B2B = violation de minimisation).

### 5.4 `CompanyContact` (coordonnées : PLUSIEURS emails / PLUSIEURS téléphones) — 1 → N

On garde **toutes** les coordonnées trouvées (pas une seule) → une ligne par email et par téléphone.

- `companyId` (FK), `establishmentId?` (rattachement agence), `personId?` (FK nullable → rattachement à
  une `CompanyPerson` si nominatif), `type` (`email|telephone`), `value` (brute), **`valueNormalized`**
  (email minuscules / tél E.164 — base de la dédup), `isNominatif` vs `isGenerique` (contact@/info@…),
  `personMatchConfidence`, `label`/`role` (standard, contact, commercial, direction, RH, mentions,
  SAV…), `isPrimary` (meilleur email + meilleur tél), `sharedAcrossCompanies` (détection standard/email
  mutualisé → dégrade la confiance, §P2-1), `sourceUrl`, `confidence`, `verifStatus` (§5.10), `collectedAt`.
- **Multi-valué assumé** : une entreprise = 0..N emails + 0..N téléphones ; l'export peut sortir soit le
  contact `isPrimary`, soit toutes les valeurs (colonnes `emails[]` / `telephones[]`).
- **Origine V1 = scraping du site officiel** (contact / mentions légales), respect robots.txt.
  ⚠️ Le maillon faible : sans domaine connu, pas d'email/tél (voir §14, question ouverte).

### 5.5 Pilotage & suivi

- **`ProspectingCampaign`** : `nom`, `statut` (`brouillon|active|en_pause|en_pause_quota|terminee`),
  critères ciblés (`departements[]`, `nafCodes[]` ou `secteurs[]`, `tailles[]`, `typesOrganisation[]`),
  `enrichirContacts` (bool), **`enrichirPersonnes` (bool — flag distinct, active la passe B §6.6)**,
  `quotaMax`, `rythme`, **`priorite` (int) [AUDIT P0-7]**, **`scheduledAt` / `recurrence` (cron) /
  `nextRunAt` [AUDIT P0-6]**, compteurs (`cellulesTotal`, `cellulesFaites`, `entreprisesCollectees`,
  `entreprisesEnrichies`), **`debitParHeure` / `etaCompletion` (dérivés) [AUDIT P1-2]**, `createdBy`, timestamps.
- **`CoverageCell`** : unité de la matrice = (`departement`, `naf` ou `secteur`, `taille`).
  `campaignId` (FK), `statut` (`a_faire|en_cours|fait|erreur`), `attendu` (estimé), `collecte`, `enrichi`,
  `pageCursor` (pagination reprise), `lastError`, `updatedAt`. **UNIQUE(campaignId, departement, naf, taille).**
- **`CollectRun`** : une exécution de collecte d'une cellule ; `cellId` (FK), `startedAt`, `finishedAt`,
  `nbResultats`, `nbNouveaux`, `nbDoublons`, `apiCalls`, `status`. (Idempotence + audit.)
- **`ProspectionEvent`** (append-only) : `type` (`company_collected|person_added|contact_scraped|
opt_out|export|campaign_started|paused|resumed|completed|refresh` — enum complet = `01-DATA-MODEL.md`
  qui fait foi), `companyId?`, `campaignId?`, `data` (JSON), `createdAt`. Base du dashboard & des stats.

### 5.6 Tags & pont CRM (optionnel)

- **`Tag` / `CompanyTag`** (hiérarchie : `SECTEUR`, `TAILLE`, `DEPARTEMENT`, `SOURCE`, `QUALITE`),
  `assignedBy` (`auto|user`). Réutilise le pattern SOS-Expat.
- **`SuppressionEntry`** : registre d'**opposition/effacement** (SIREN/email opt-out) → filtre toute
  collecte/export future (RGPD). Réutilise l'idée « suppression list ».
- **Pont CRM Qualiopi** (option, décision D en §14) : une action « Envoyer vers le CRM » crée un
  `Client` (statut `prospect`) à partir d'une `Company` — **sans fusionner les tables**.

### 5.7 Mapping taille (règle explicite — limite du gratuit assumée)

La catégorie légale (décret 2008-1354) combine **effectif + CA + bilan**. Les sources gratuites ne
donnent que l'**effectif** (tranche). On dérive donc une **approximation documentée** :
`TPE` < 10 salariés · `PME` 10–249 · `ETI` 250–4999 · `GE` ≥ 5000 (dérivée de `trancheEffectif` INSEE),
recoupée avec `categorieEntreprise` (champ INSEE PME/ETI/GE) quand présent. Champ `tailleSource`
(`effectif|categorie_insee`) pour tracer la provenance. La catégorie **légale exacte** (avec CA/bilan)
n'est pas disponible gratuitement → on assume et documente l'**approximation par effectif** (pas de
source payante). Le champ `categorieEntreprise` INSEE (gratuit) fiabilise déjà PME/ETI/GE.

### 5.8 Index & performance (plan)

Index composites : `Company(departement, taille)`, `Company(secteur, departement)`, `Company(naf, taille)`,
`Company(enrichmentStatus)`, `Company(contactabilite)`, `CoverageCell(campaignId, statut)`,
`ProspectionEvent(type, createdAt)`. Volume attendu : plusieurs millions d'entreprises actives en France
→ prévoir pagination serveur, requêtes indexées, et **pas** de `SELECT *` non borné dans l'UI.

### 5.9 Système ANTI-DOUBLON (une entreprise = une seule fois, sauf établissements)

Règle métier : **une entreprise (unité légale) = un `SIREN` = une seule ligne `Company`**. Les
succursales / agences / sites secondaires ne sont **PAS** des doublons : ce sont des `Establishment`
(`SIRET`) rattachés à la même `Company`. On ne « fusionne » jamais deux SIREN différents.

- **Niveau 1 — SIREN** : `Company.siren` UNIQUE → toute re-collecte fait un **upsert** (jamais d'insert
  aveugle). Un SIREN déjà présent est mis à jour, pas dupliqué.
- **Niveau 2 — SIRET** : `Establishment.siret` UNIQUE → chaque établissement/succursale une seule fois,
  rattaché au bon SIREN (`estSiege` distingue le siège).
- **Niveau 3 — inter-sources** : quand une donnée vient de 2 sources (Recherche-entreprises + Sirene +
  site), on **réconcilie** sur SIREN/SIRET (pas d'écrasement destructif : on garde la meilleure valeur
  par `dataQuality`/`source`).
- **Niveau 4 — fuzzy (garde-fou)** : détection de quasi-doublons **sans SIREN** (rare : contact scrapé
  isolé) par normalisation (denomination + code postal) → mise en file de **revue manuelle**, jamais de
  fusion automatique silencieuse.
- **Dédup au sein d'un run** : le `collect-worker` déduplique en mémoire (Set de SIREN) avant écriture,
  et compte `nbNouveaux` / `nbDoublons` dans `CollectRun` (traçabilité).

**Anti-doublon FIN (email / téléphone / personne) — distinct de l'anti-doublon entreprise :**

- **EMAILS** : contrainte `@@unique([companyId, type='email', valueNormalized])`. Normalisation :
  minuscules, trim, retrait des tags (`+alias`), même domaine ⇒ un email présent 2× (footer + page
  contact) = **1 seule ligne**. On garde tous les emails DISTINCTS de l'entreprise (contact@, rh@,
  commercial@…), on ne dédoublonne QUE les valeurs identiques.
- **TÉLÉPHONES** : `@@unique([companyId, type='telephone', valueNormalized])`. Normalisation **E.164 FR**
  (`01 23 45 67 89`, `+33123456789`, `0123456789` ⇒ même clé) → le même numéro écrit en 3 formats = **1
  seule ligne**. Numéros distincts (standard, SAV, direction) = conservés séparément.
- **PERSONNES** : dédup sur `personKey` = hash(`nom`+`prenoms` normalisés) **SANS la fonction** [AUDIT
  P0-4] `@@unique([companyId, personKey])`. Même personne vue « Gérant » (Sirene) et « Directeur
  général » (site) = **1 seule personne** avec **2 rôles** (§5.3), pas 2 lignes. Variations
  accents/casse/ordre prénoms normalisées. Garde-fou homonymes (même nom, rôles/emails incompatibles) →
  **revue manuelle** (`/prospection/doublons`), jamais fusion auto. ⚠️ Même personne dans **2 entreprises**
  = **2 lignes légitimes** reliées par `personKey`, **jamais fusionnées**.
- **Réconciliation multi-sources non destructive** : à l'upsert, on garde la meilleure valeur
  (`verified` > `mx_ok` > brut ; source officielle > scrape) sans écraser une donnée vérifiée par une
  moins fiable ; on met `isPrimary` à jour (meilleur email + meilleur tél).
- **Dédup intra-run des contacts** : le `enrich-worker` déduplique emails/tél/personnes en mémoire
  avant écriture (une page contact peut répéter le même email 5×).

### 5.10 Classification d'EXPLOITABILITÉ — best practices 2026

Chaque entreprise reçoit une **contactabilité** dérivée, pour trier « exploitable » vs « à compléter »
(**décision verrouillée `07-DECISIONS.md` Q2 — fait foi**) :

- `exploitable` = a **au moins un email professionnel valide (MX-OK)**. Le téléphone est un **bonus**
  (améliore le `leadScore`), pas une condition. Seuil ajustable via `SiteSetting` `prospection`.
- `partiel` = a un contact non vérifié (email sans MX-OK, ou téléphone seul).
- `non_contactable` = aucun email ni téléphone trouvé.
- **`leadScore` (0-100)** — pondération 2026 (config `SiteSetting`, ajustable) : complétude contact
  (email vérifié > email > tél) · fraîcheur de la donnée · présence dirigeant · adéquation cible
  (secteur/taille/département demandés) · qualité de la source · établissement actif. **Aucun achat de
  données** : le score se calcule sur ce qu'on a collecté gratuitement.
- **Validation email gratuite** (best practice, sans API payante) : syntaxe (RFC), domaine a un **MX
  record** (DNS gratuit), rejet des emails jetables/rôles génériques configurables (`contact@`,
  `info@` gardés mais marqués `role`), déduplication. → statut `verified_syntax|mx_ok|role|invalid`.
- **Validation téléphone gratuite** : normalisation E.164 FR, format plausible (fixe/mobile), rejet des
  numéros surtaxés/invalides.
- Ces classes pilotent **l'export segmenté** (§7.2) : un fichier « exploitables (email+tél) » et un
  fichier « à compléter », pour que la base soit directement actionnable.

### 5.11 Périmètre = TOUTES les organisations, y compris PUBLIQUES

La demande inclut les organismes publics/parapublics (**EDF, La Poste, SNCF, administrations,
collectivités, hôpitaux, universités…**). Ils ont **tous un SIREN** et sont présents dans les mêmes
sources ouvertes → **même pipeline, aucune source spéciale**. On ajoute la dimension
`typeOrganisation` (§5.1) dérivée de la **nature juridique INSEE** (ex. `4110` SA nationale, `7112`
commune, `7389` EPIC, `92xx` associations…). Bénéfices :

- Filtrer/segmenter par **type d'organisation** dans le wizard et la base (privé / public / collectivité /
  association / EPIC).
- La matrice de couverture peut inclure une 4e dimension optionnelle **type d'organisation** (ou rester
  à 3 axes et exposer le type comme simple filtre — décision §14).
- ⚠️ RGPD identique ; pour les administrations, privilégier les coordonnées **institutionnelles publiées**.

### 5.12 Modèle de STATS AGRÉGÉES (dép → région → France) **[AUDIT — trou central reporting]**

Tout le suivi V1 était scopé `campaignId` → aucun cumul permanent de la base par territoire. On ajoute
une couche de stats **indépendante des campagnes** :

- **`StockReference`** (dénominateur autoritatif) : totaux attendus par (`departement`, `naf`, `taille`,
  `typeOrganisation`) issus du **Stock Sirene** (§6.1), `stockRefreshedAt`, re-sync périodique. C'est le
  dénominateur commun de tous les taux. Formule : `pctCompletion = collectees / stockAttendu`.
- **`departement-to-region.ts`** (SSOT) : 13 régions métropole + DROM (codes officiels 2026). Utilisé au
  write de `Company.region` ET pour le rollup. `CoverageCell` et les stats portent `region` (dérivé).
- **`GeoCoverageStat`** (vue matérialisée ou table rollup) : clé (`scope` ∈ `departement|region|france`,
  `scopeId`, + optionnel `secteur`/`taille`/`typeOrganisation`), champs : `stockAttendu`, `collectees`,
  `enrichies`, `exploitables`, `partiels`, `nonContactables`, `pctCompletion`, `pctExploitableSurCollectees`,
  `pctExploitableSurStock`, `pctPerime` (fraîcheur), `refreshedAt`. Rafraîchie par `coverage-worker` en
  **rollup** (pas par campagne). **Alimente carte + KPI France + coverage-map.**
- **`StatsSnapshot`** (série temporelle) : (`date`, `scope`, `scopeId`, compteurs) écrit quotidiennement
  → **courbes de progression**, débit historisé, ETA, base de la détection d'anomalie. Évite de scanner
  des millions de `ProspectionEvent` pour tracer une courbe.
- **Perf [AUDIT P1-5]** : agrégats via **vues matérialisées Postgres** (`REFRESH … CONCURRENTLY`) ou
  compteurs incrémentaux depuis `ProspectionEvent` — jamais `COUNT GROUP BY` live sur 10-30 M lignes à
  chaque rendu (INP/lhci admin).
- **Anti-dérive [AUDIT P1-6]** : le `coverage-worker` **recalcule depuis la source de vérité** (COUNT
  indexé), ne fait pas qu'incrémenter des compteurs dénormalisés, et logue tout écart (incident récurrent
  documenté sur content-gen).

---

## 6. Backend (services, connecteurs, workers)

### 6.1 Connecteurs de sources (sous `src/server/prospection/sources/`)

**[AUDIT] Changement d'architecture majeur : la collecte de masse passe par les FICHIERS STOCK
Sirene (open data), pas par l'API de recherche paginée.** L'API de recherche est plafonnée
(~10 000 résultats/critère, ~7 req/s) → l'utiliser pour balayer ~10 M d'unités légales = des
semaines de crawl fragile. Le fichier Stock = un download + bulk-load (heures), puis delta quotidien.
Facteur ~×100.

- **`sireneStockIngestor`** (**source PRIMAIRE d'exhaustivité**) — télécharge les fichiers **Stock
  open data INSEE/data.gouv** (`StockUniteLegale`, `StockEtablissement`, ~4 Go, MAJ mensuelle),
  stream-parse CSV, **bulk-upsert par batch** (§P1-6 : `createMany skipDuplicates` / `INSERT … ON
CONFLICT` via table staging). Stub-aware (early-exit au build). Donne : SIREN/SIRET, NAF, tranche
  effectif→taille, adresse/commune/dép., forme juridique, catégorie entreprise, **`statutDiffusion`**
  (crucial RGPD §9), état administratif.
- **`sireneDeltaWorker`** (**fraîcheur**) — ingère le **flux de mises à jour quotidien** Sirene
  (ou filtre `dateDernierTraitement > lastSync`) → **créations, cessations, changements** ; marque les
  cessés (ne pas purger = historique). Cron. Sans ça, la base « exhaustive » se périme en semaines.
- **`rechercheEntreprisesClient`** (**ciblage/UX à la demande, PAS collecte de masse**) —
  `recherche-entreprises.api.gouv.fr`, sans clé, ~7 req/s. Sert à : résoudre une cellule précise,
  alimenter l'aperçu volume du wizard, requêtes ad hoc. Retourne dirigeants + siège.
- **`inpiRneClient`** (**dirigeants à jour**) — API/open data **INPI RNE** (token gratuit) :
  dirigeants & représentants **plus complets et frais** que recherche-entreprises. ⚠️ respecter
  l'**opposition prospection des personnes physiques** (§9 A2).
- **`annuaireAdministrationClient`** (**organisations publiques**) — `api-lannuaire.service-public.fr`
  → emails/téléphones **institutionnels officiels** des mairies/préfectures/administrations/EPCI.
  Meilleure donnée et plus loyale que scraper leurs sites (remplace le scrape pour le volet public §5.11).
- **`bodaccClient`** (**événements légaux**) — API BODACC (DILA/data.gouv) : créations, **procédures
  collectives** (dé-prioriser), cessions, radiations, changements de dirigeants. Gratuit.
- **`banGeocoder`** (**géocodage officiel**) — `api-adresse.data.gouv.fr` pour remplir
  `latitude/longitude` (indispensable à la carte §7). Gratuit.
- ⚠️ **`sireneClient` (API portail-api.insee.fr, token gratuit)** — complément/vérif ponctuelle
  (curseur `curseur=*` sans plafond 10 000). **[AUDIT C7]** confirmer endpoint/quotas au T0 (Sirene a
  migré vers le nouveau portail).
- **Cascade d'enrichissement 100 % GRATUITE** (aucune source payante — décision Will) :
  1. **Sources ouvertes officielles** : dirigeants, adresse, ville, dép., forme juridique, effectif →
     déjà fournis gratuitement par Recherche-entreprises / Sirene.
  2. **Découverte du site web gratuite** : (a) champ site s'il est présent dans les données ouvertes ;
     (b) heuristique domaine (nom normalisé + `.fr`/`.com`) **avec vérification DNS/HTTP réelle**.
     **[AUDIT B1] PAS de scraping de SERP** (Google/Bing = viol CGU + ban + non loyal) — retiré de
     l'architecture. Sinon `non_contactable`.
     2bis. **Confirmation d'appartenance au SIREN [AUDIT P1-3]** : un domaine n'est retenu QUE si sa page
     mentions-légales/contact contient le **SIREN** ou la **dénomination normalisée** de l'entreprise →
     évite de scraper une entreprise homonyme (poison des données + collecte déloyale). Sinon domaine
     rejeté (`domainConfidence` bas), entreprise `non_contactable`. Trace `domainMatchMethod`.
  3. **`companySiteScraper`** (email/tél) — via `ssrfSafeFetch` + respect robots.txt/ai.txt + extraction
     HTML existante ; cible `/`, `/contact`, `/mentions-legales`, footer → `mailto:`/`tel:` + regex.
  4. **Mentions légales** (souvent obligatoires et publiques) = meilleure source gratuite d'email/tél/dirigeant.
  5. **Validation gratuite** : email (syntaxe + MX DNS), téléphone (E.164 FR) — voir §5.10.
     → Aucun provider payant dans l'architecture. Le taux d'email/tél dépend de la présence d'un site public
     exploitable ; on **maximise le gratuit** et on **mesure honnêtement** le taux de contactabilité (§5.10).

### 6.2 Stratégie d'exhaustivité — PROUVÉE, pas déclarée **[AUDIT]**

- **Backbone = Stock Sirene** (§6.1) : on charge l'intégralité, donc l'exhaustivité est **native** (pas
  de plafond de pagination à contourner). Le stock sert aussi de **dénominateur de référence** (§5.12
  `StockReference`) : nombre exact d'entreprises attendues par dép × NAF × taille × type.
- **Dénombrement autoritatif** : `CoverageCell.attendu` = compte réel issu du stock/`total_results`
  (probe count obligatoire), **jamais** un « estimé ». Règle d'acceptation d'une cellule :
  `collecte ≥ attendu` (tolérance documentée pour cessations concurrentes) **sinon `erreur` + alerte**,
  jamais `fait`. KPI de tête = **« écart d'exhaustivité »** global (Σattendu − Σcollecté).
- **Cellules paresseuses** : ne créer une `CoverageCell` que pour les triplets **non vides** (après
  probe count > 0) → évite ~1 M de lignes fantômes (la plupart des dép×NAF×tranche sont vides).
- **Découpage adaptatif** (résiduel, pour le mode ciblage API uniquement) : si une requête dépasse le
  plafond, subdiviser récursivement sur l'axe suivant (NAF section→division→classe→sous-classe → tranche
  → commune → **dernier repli = fenêtrage déterministe sur SIREN/dateCreation**), pour ne **jamais**
  tronquer silencieusement à 10 000.
- **Rate-limit distribué RÉEL [AUDIT P0-4]** : une **file BullMQ par source** avec `limiter:{max,duration}`
  (pattern déjà présent : `content-fact-check-worker.ts`) + **token-bucket Redis** partagé
  (`chatbot/resilience/token-bucket.ts`) pour tenir 7 req/s **global** malgré la concurrence ; respect de
  l'en-tête `Retry-After` sur 429. Un simple nombre en SiteSetting ne suffit PAS.
- **Idempotence sans piège BullMQ [AUDIT P0-5]** : **la DB est la seule source de vérité** (état
  `CoverageCell`). Jobs **éphémères** (`removeOnComplete`, `removeOnFail` borné) OU **nonce d'attempt**
  dans le jobId (`cell:<id>:run:<runId>`) pour éviter le no-op silencieux d'un `add()` sur jobId
  existant (bug prod content-gen documenté). Test d'intégration « re-enqueue après failed » obligatoire.

### 6.3 Workers BullMQ (ajoutés à `queues.ts`, stub-aware)

| Worker                                          | Rôle                                                                                                                                                                                                  | Déclenchement                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `prospection-orchestrator-worker`               | Génère la work-list (cellules) d'une campagne, enfile les collectes, respecte quotas/throttle                                                                                                         | Au lancement d'une campagne           |
| `prospection-collect-worker`                    | Collecte une cellule (pagination + dédup SIREN/SIRET), écrit Company/Establishment/CompanyPerson, met à jour CoverageCell/CollectRun                                                                  | Par cellule                           |
| `prospection-enrich-worker`                     | Enrichit une entreprise (dirigeants déjà là ; site public → email/tél best-effort ; qualité)                                                                                                          | Après collecte, si `enrichirContacts` |
| `prospection-stock-ingestor-worker` **[AUDIT]** | Télécharge + bulk-load le Stock Sirene (exhaustivité), alimente `StockReference`                                                                                                                      | Cron mensuel + on-demand              |
| `prospection-delta-worker` **[AUDIT]**          | Ingère les MAJ quotidiennes Sirene (créations/cessations/changements)                                                                                                                                 | Cron quotidien                        |
| `prospection-scheduler-worker` **[AUDIT P0-6]** | Active les campagnes dues (`nextRunAt`), drip-feed borné (backpressure §P1-7), ordonnance par `priorite`                                                                                              | Cron court                            |
| `prospection-coverage-worker`                   | **Rollup `GeoCoverageStat` (dép→région→France) + `StatsSnapshot` quotidien + détection d'anomalies/alertes** (débit −X%, taux 0 anormal, cellule stale, quota atteint, source down) [AUDIT P1-1/P1-3] | Cron court + on-demand                |
| `prospection-export-worker`                     | Génère CSV/XLSX (re-filtre opt-out + non-diffusible à la génération, colonnes conformité)                                                                                                             | On-demand                             |
| (réutilise) `retention-purge-worker`            | Étend la purge RGPD aux entités prospection (`retentionUntil`, par entreprise ET par personne)                                                                                                        | Cron existant                         |

Tous : `attempts` + backoff exponentiel (idempotence), wrapper Sentry, cost-tracking des appels.

### 6.4 Server Actions (`src/server/actions/prospection/`)

CRUD campagnes · lancer/mettre en pause/reprendre · recherche & filtrage de la base · fiche entreprise ·
opt-out/effacement (RGPD) · déclencher export · pilotage « depuis le chat » (grant + enqueue, pattern
content-gen éprouvé). **Pas de REST**, sauf : `GET /[adminPrefix]/prospection/export/[id]` (download
fichier authentifié).

### 6.5 Système ANTI-RE-SCRAPE / incrémental / fraîcheur (ne jamais re-scraper l'existant)

Objectif : **ne pas re-collecter/ré-enrichir ce qui l'a déjà été**, tout en gardant la base à jour.

- **Cellule déjà faite = sautée** : l'orchestrateur ne consomme que les `CoverageCell` en
  `à_faire`/`erreur`. Relancer une campagne ne rejoue **pas** les cellules `fait`.
- **Upsert par SIREN/SIRET** (§5.9) : une entreprise déjà en base n'est jamais ré-insérée ; au pire
  mise à jour si périmée.
- **Fenêtre de fraîcheur** `refreshAfter` (config `SiteSetting`, ex. 90 jours) : une `Company` n'est
  re-vérifiée que si `lastCheckedAt` dépasse la fenêtre → collecte incrémentale, pas de re-scrape inutile.
- **`contentHash`** : empreinte des champs enrichis ; si le re-crawl renvoie le même hash → **no-op**
  (pas d'écriture, pas d'event superflu). Détecte les vrais changements uniquement.
- **Skip enrichissement déjà fait** : `enrichmentStatus=enriched` + site déjà scrapé (`lastEnrichedAt`
  dans la fenêtre) → l'`enrich-worker` passe son tour.
- **Registre d'opposition** (§5.6) : un SIREN/email `optOut` est **exclu de toute (re)collecte**.
- **Idempotence des jobs** : `jobId` déterministe par cellule/entreprise → BullMQ ne double pas un job
  déjà traité (⚠️ leçon prod content-gen : purger proprement les jobs `failed` pour permettre le retry).
- **Mode « rafraîchir »** explicite (admin) : une action distincte force la re-vérification d'un
  périmètre choisi (utile pour actualiser dirigeants/effectifs), sinon par défaut = **incrémental only**.

### 6.6 Budget de crawl PAR ENTREPRISE (on ne scrape PAS tout le site)

On ne fait **jamais** un crawl complet du site d'une entreprise. On fait un **mini-crawl ciblé,
poli et plafonné** sur les 2-3 pages qui contiennent réellement les coordonnées :

- **[AUDIT P0-1/P0-2/P0-3] Crawl en DEUX PASSES à critères d'arrêt distincts** (sinon l'early-exit
  « email+tél » empêche d'atteindre les pages équipe → responsables jamais capturés) :
  - **Passe A — coordonnées** : `/mentions-legales` (obligatoire & publique = meilleure source) →
    `/contact` (+ `/nous-contacter`, `/contactez-nous`) → accueil `/` (footer). **Arrêt** dès email+tél.
    Budget `maxPagesContact = 3`.
  - **Passe B — personnes** (si `enrichirPersonnes` activé, **flag de campagne distinct** de
    `enrichirContacts`) : `/equipe`, `/notre-equipe`, `/notre-cabinet`, `/direction`, `/qui-sommes-nous`,
    `/a-propos`, `/associes`, `/nos-experts`, `/organigramme`, `/l-agence`, `/team`, `/about` + suivi des
    liens de menu dont le libellé matche (« équipe », « direction », « qui sommes-nous »). **Toujours
    tentée** indépendamment de A. Budget `maxPagesPersonnes = 4`, profondeur ≤ 2 (pour `/equipe` →
    sous-pages équipe uniquement). Liste SSOT `crawl-targets.ts` (`TEAM_PAGE_PATHS` + variantes).
- **Plafond global** : `maxPagesEntreprise = 7` (config `SiteSetting`). Aucune exploration récursive
  au-delà des cibles.
- **Politesse & légalité** : `ssrfSafeFetch`, respect **`robots.txt`** (skip si `Disallow`),
  crawl-delay, timeout 8 s, taille max 2 MB/page, user-agent identifiable. Une seule entreprise à la
  fois par domaine (pas de martèlement).
- **Ne crawle que si un domaine est trouvé** (§6.1) ; sinon l'entreprise reste `non_contactable`
  sans aucun appel réseau (efficacité + zéro gaspillage).
- **Ordre de grandeur** : pour 10 000 entreprises ciblées avec ~60 % ayant un site → ~6 000 mini-crawls
  × ~2 pages ≈ **~12 000 requêtes**, étalées par le throttle. Négligeable et gratuit.
- **Anti-re-scrape** (§6.5) : un site déjà crawlé récemment (`lastEnrichedAt` dans la fenêtre) n'est
  **pas** re-crawlé.

---

## 7. Frontend / Console d'administration (pilotage)

### 7.1 Nouveau pôle nav (`src/lib/admin-nav.ts`)

Pôle **« Prospection »** (icône dédiée), sous-sections (liste complète = `04-SPEC-UI-ROUTES.md` §1, fait foi) :

- Tableau de bord · Campagnes · Base entreprises · Contacts · Couverture · Carte · Personnes · Exports ·
  Journal · RGPD · Doublons · Réglages.

### 7.2 Pages & routes (sous `src/app/[locale]/(admin)/[adminPrefix]/prospection/`)

| Route                                | Page                                          | Contenu                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/prospection`                       | **Tableau de bord**                           | Collecté aujourd'hui/total, enrichis, erreurs, campagnes actives, top départements/secteurs (cache Redis)                                                                                                                                                                                                                                       |
| `/prospection/campagnes`             | Liste campagnes                               | Statut, avancement (barre %), actions lancer/pause/reprendre                                                                                                                                                                                                                                                                                    |
| `/prospection/campagnes/nouvelle`    | **Wizard de campagne** (4 étapes)             | 1) Départements · 2) Activités (NAF/secteurs) · 3) Tailles (TPE/PME/ETI/GE) · 4) Options (enrichir contacts, quota, rythme) → aperçu du **volume estimé** + nb de cellules                                                                                                                                                                      |
| `/prospection/campagnes/[id]`        | Détail campagne                               | Avancement par cellule, logs (CollectRun), erreurs, reprise                                                                                                                                                                                                                                                                                     |
| `/prospection/entreprises`           | **Base entreprises**                          | Table paginée + filtres (dép, secteur, taille, **type d'organisation**, **contactabilité email/tél**, statut enrichi, texte) ; export de la sélection                                                                                                                                                                                           |
| `/prospection/entreprises/[siren]`   | Fiche entreprise                              | Identité, établissements, dirigeants, contacts, tags, carte, historique (events), bouton opt-out / effacer / → CRM                                                                                                                                                                                                                              |
| `/prospection/contacts`              | **Contacts (vue de premier plan, à onglets)** | 3 onglets : **✅ Prêts à l'emploi** (`exploitable` : email + tél) · **🟡 À enrichir** (`partiel`) · **🔴 Non contactables**. Chaque onglet = table filtrable (dép/secteur/taille/type) + compteur + **export direct de l'onglet** + tri par `leadScore`. Actions rapides : relancer l'enrichissement d'une sélection, opt-out, envoyer vers CRM |
| `/prospection/couverture`            | **Coverage-map + vues région/France [AUDIT]** | Matrice dép × secteur × taille (cellules à faire/en cours/fait/erreur) + **bandeau France** (complétion %, contactabilité %) + **bascule/roll-up Région** + drill-down France→région→dép→cellule + **export du rapport de stats** (CSV/PDF)                                                                                                     |
| `/prospection/carte`                 | **Carte choroplèthe [AUDIT D1]**              | France par dép/région colorée selon complétion % ou contactabilité % (2 modes) — **SVG statique + GeoJSON léger, PAS Leaflet/Mapbox** (Web Vitals)                                                                                                                                                                                              |
| `/prospection/personnes/[personKey]` | **Détail personne [AUDIT D2]**                | Identité, toutes les entreprises liées, rôles, coordonnées nominatives, **bouton opt-out/effacement personne** (transverse entreprises)                                                                                                                                                                                                         |
| `/prospection/journal`               | **Journal / audit [AUDIT D3]**                | `ProspectionEvent` + `ProspectionAccessLog` filtrables (type/campagne/entreprise/acteur/date), paginé keyset                                                                                                                                                                                                                                    |
| `/prospection/rgpd`                  | **Espace RGPD / oppositions [AUDIT D4]**      | Liste `SuppressionEntry`, file des demandes entrantes, prochaines purges `retentionUntil`, export du registre                                                                                                                                                                                                                                   |
| `/prospection/doublons`              | **Revue doublons [AUDIT D10]**                | File de quasi-doublons (fuzzy §5.9 niveau 4) à valider/fusionner manuellement                                                                                                                                                                                                                                                                   |
| `/prospection/exports`               | **Exports segmentés**                         | Génère des fichiers CSV/XLSX **exploitables** : un export « **exploitables (email + téléphone)** », un export « **partiels (email OU tél)** », un export « **à compléter** », filtrables par dép/secteur/taille/type ; colonnes normalisées prêtes à l'emploi ; historique + download authentifié                                               |
| `/prospection/reglages`              | Réglages                                      | Quotas, rate-limits, mapping taille, **fenêtre de fraîcheur / re-scrape**, seuil « exploitable », **paramètres RGPD** (durée, mention)                                                                                                                                                                                                          |

### 7.3 Composants (`src/components/admin/prospection/`)

Réutiliser le design system admin existant (`AdminPageShell`, `AdminTable`, `AdminBadge`, tokens
terracotta/ivoire). **Attention Web Vitals** : coverage-map & tables → virtualisation/pagination
serveur, pas de gros bundle client ; INP ≤ 100 ms.

### 7.4 Pilotage « sans console » (option)

Comme le content-gen, exposer un pilotage **depuis le chat/agent** (grant + enqueue) pour lancer une
campagne pilote sans passer par l'UI — utile pour les tests et la reprise.

---

## 8. Sécurité, robustesse, conformité build

- **stub.invalid** : chaque connecteur/worker early-exit au build ; tests Vitest avec Prisma mock.
- **SSRF** : tout fetch via `ssrfSafeFetch` (pas d'accès réseau interne).
- **Idempotence** : dédup SIREN/SIRET ; `CollectRun` rejoue une cellule sans doublonner ; `pageCursor`.
- **Reprise sur panne** : campagne = somme de cellules ; relancer ne recollecte que les `à_faire`/`erreur`.
- **Rate-limits & quotas** : throttle centralisé (SiteSetting) par source ; `quotaMax` par campagne.
- **Observabilité** : Sentry worker wrapper, logs structurés, cost-tracker, compteurs `ProspectionEvent`.
- **Auth & RBAC** : pages sous `[adminPrefix]` (NextAuth existant) + **rôles `viewer|operator|dpo|admin`**
  ([AUDIT D5], export/bulk réservés) ; export = route authentifiée ; volume fichiers hors web-root.
- **[AUDIT] Robustesse réseau** : **circuit breaker par source** (ouvre après K échecs → pause de la file
  - alerte, half-open après cooldown) ; **validation Zod** de chaque réponse API (un changement de schéma
    API silencieux ne doit pas écrire des `null` en masse) ; retries/backoff + `Retry-After` ; distinction
    erreurs transitoires (retry) vs 4xx/schéma (fail-fast) ; taxonomie `errorCode`.
- **[AUDIT] Débit & échelle** : **bulk-upsert par batch** (`createMany skipDuplicates` / staging + `ON
CONFLICT`), pas d'upsert ligne-à-ligne sur des millions ; **backpressure** (fenêtre bornée de jobs en
  vol, drip-feed) ; **pagination keyset/cursor** (pas d'`OFFSET` profond) + counts approximatifs pour les
  vues volumineuses ; sizing honnête (~10 M `Company`, ~30 M `Establishment` si tous établissements) →
  **partitionnement** envisagé (par `departement`/`etatAdministratif`).
- **[AUDIT] Coût réel ≠ 0 € strict** : API gratuites, mais DNS/MX à l'échelle, egress du mini-crawl,
  stockage Postgres 10-30 M lignes, mémoire Redis = coût **infra** non nul (à documenter honnêtement).
- **[AUDIT] Bench/charge** avant généralisation : req/s soutenu vs limiteur, lignes/s en écriture, mémoire
  Redis, temps `REFRESH MV`, **estimation wall-clock France entière**, soak-test 24 h + injection de pannes.

---

## 9. Conformité RGPD / CNIL (contrainte n°1 — à verrouiller AVANT tout connecteur)

> Le **dirigeant** et les **coordonnées** sont des **données personnelles** même en B2B.

| Exigence                            | Décision de plan                                                                                                                                                                                         | Artefact logiciel                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Base légale**                     | Intérêt légitime (prospection B2B)                                                                                                                                                                       | ADR + doc registre                        |
| **Loyauté de la source**            | Données **ouvertes** (API gouv) = OK ; scraping du **site public de l'entreprise** limité aux pages contact/mentions, robots.txt respecté ; **INTERDIT** : LinkedIn, annuaires privés, société.com (CGU) | Garde-fou code + liste blanche de sources |
| **Information des personnes**       | Mention d'information accessible (page dédiée) + mécanisme de contact                                                                                                                                    | Page publique + doc                       |
| **Droit d'opposition / effacement** | `optOut` + `SuppressionEntry` filtrant toute collecte/export futur                                                                                                                                       | Action + filtre systématique              |
| **Durée de conservation**           | À fixer (proposé : 3 ans après dernière action) → `retentionUntil` + purge                                                                                                                               | Étendre `retention-purge-worker`          |
| **Minimisation**                    | Ne collecter que ce qui sert la prospection B2B ; pas de données sensibles                                                                                                                               | Schéma restreint                          |
| **Registre des traitements**        | Ajouter le traitement « prospection B2B »                                                                                                                                                                | Doc                                       |
| **Sécurité**                        | Accès admin only, chiffrement au repos (infra), logs                                                                                                                                                     | Auth + infra                              |

### [AUDIT] Renforcements RGPD obligatoires (angle mort n°1 du plan initial)

- **A1 — AIPD / DPIA (art. 35) : livrable BLOQUANT au T0.** Collecte à **grande échelle** + données
  **indirectes** + **enrichissement multi-sources** + **scoring** (`leadScore`) → AIPD quasi-obligatoire.
  Modèle CNIL PIA (mise en balance, mesures, risque résiduel) **avant tout connecteur**.
- **A2 — Statut « non-diffusible » INSEE + opposition RNE/INPI :** stocker `statutDiffusion` ; **exclure
  systématiquement** les non-diffusibles de collecte/affichage/export ; respecter l'**opposition des
  personnes physiques à la réutilisation RNE à des fins de prospection** (`oppositionProspectionRNE`).
  Test d'acceptation : « un SIREN non-diffusible n'apparaît jamais en base/export ».
- **A3 — Information (art. 14) :** données collectées indirectement → décider et documenter l'**exemption
  “effort disproportionné” (art. 14.5.b)** + notice publique complète (finalité, base légale, catégories,
  sources, durée, droits, DPO). Graver : **V2/outreach déclenche l'information au 1er contact**.
- **A4 — LIA (test de mise en balance)** documenté (section de l'AIPD) — sans lui l'intérêt légitime est fragile.
- **A5 — Opt-out RÉELLEMENT bloquant :** `SuppressionEntry` **multi-clé** (`siren|email|domaine|personKey`),
  **vérifié à 3 endroits** (avant écriture collecte, avant enrichissement, **et au moment de générer
  l'export** = re-filtre live) + **page publique d'exercice des droits** qui alimente la liste.
- **A6 — Journal d'accès** `ProspectionAccessLog` (quel admin a consulté/recherché/**exporté** des
  données perso) — accountability CNIL, conservé ~6-12 mois, distinct du log métier.
- **A7 — Minimisation** : `dateNaissance` retirée (§5.3). **A10** : documenter que `leadScore` ne produit
  **aucune décision automatisée** (hors art. 22).
- **RBAC [AUDIT D5]** : l'**export/bulk** de données perso réservé aux rôles `dpo|admin` ; `viewer|operator`
  en consultation.

**STOP & ASK obligatoires** : durée de conservation exacte, texte de la mention d'information,
toute source hors données ouvertes, tout usage outreach (V2). _(La CNIL considère qu'en B2B l'email
professionnel peut être prospecté sans consentement préalable si rapport avec la fonction + opt-out ;
mais l'**information** et l'**opposition** restent obligatoires. À faire valider juridiquement avant V2.)_

---

## 10. Observabilité, coûts & quotas

- **Coûts = 0 €** (décision Will) : API gouv gratuites + scraping des sites publics + validations DNS/MX
  gratuites. **Aucune API payante** (ni Perplexity payant, ni Pappers/Dropcontact/Hunter). La découverte
  de domaine se fait par heuristique + vérification HTTP/DNS gratuite, ou recherche web sans clé.
- **Quotas** : throttle 7 req/s (Recherche entreprises), 30 req/min (Sirene), politesse crawl sites
  (delay + robots.txt) → SiteSetting.
- **Dashboards** : avancement, débit, erreurs, **taux de contactabilité** (email/tél trouvés), taux
  d'enrichissement, appels réseau.
- **[AUDIT] Métriques & formules de pilotage (définies, à 3 niveaux dép/région/France)** :
  - **Taux de complétion collecte** = `collectees / stockAttendu` (dénominateur = Stock Sirene §5.12) →
    « ai-je bien récupéré TOUTES les entreprises du dép ? »
  - **Taux de contactabilité** en 2 vues : `exploitables / collectees` **et** `exploitables / stockAttendu`
    (couverture actionnable réelle de la France) → « % de contacts utilisables VS toutes les entreprises ».
  - Décliné aussi **par secteur et par taille** (pas seulement géo) [AUDIT P2-5].
  - **Nuance nominatif** [AUDIT P1-2] : `exploitable_nominatif` (email d'un responsable nommé) vs
    `exploitable_generique` (contact@ seul) — pèse dans `leadScore`.
  - **Débit** (entreprises/h), **ETA** complétion (campagne + France), **fraîcheur** (`pctPerime`,
    `dueForRefresh`), **écart d'exhaustivité** (Σattendu − Σcollecté) = KPI de tête.
  - Barèmes de score dans SSOT `scoring.ts` (poids configurables SiteSetting) + tests [AUDIT P2-3].

---

## 11. Tests & critères d'acceptation (oracle « done »)

- **Unitaires** : mapping NAF→secteur, tranche effectif→taille, dédup SIREN/SIRET, découpage cellules,
  normalisation email/tél, filtre suppression.
- **Intégration (mocks)** : connecteurs (réponses API mockées), worker collecte idempotent, reprise
  cellule, coverage agrégée.
- **RGPD** : opt-out bloque collecte & export ; purge respecte `retentionUntil` ; sources hors liste
  blanche rejetées.
- **UI** : wizard produit les bonnes cellules ; coverage-map reflète l'état ; Web Vitals des pages admin.
- **Gates CI** : typecheck, eslint, i18n, isolation-check, vitest, size-limit, lhci.
- **Preuve V1 = « done »** : une **campagne pilote sur 1 département** (ex. Isère 38) × 2-3 secteurs ×
  4 tailles → base peuplée, dirigeants présents, coverage à 100 % des cellules, export CSV généré,
  opt-out testé. **Aucun** envoi d'email.

---

## 12. Roadmap par tranches verticales (phasage)

| Tranche                               | Contenu                                                                                                                                                                                                        | Dépend de     | Sortie prouvée                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- |
| **T0 — Grounding + RGPD**             | Explorer le code réel, **AIPD/DPIA + LIA (bloquant)**, ADR RGPD + ADR « collecte = Stock Sirene »                                                                                                              | —             | AIPD + ADR validés (STOP&ASK)               |
| **T1 — SSOT & config**                | `naf-to-secteur.ts`, `tranche→taille`, **`departement-to-region.ts`**, `qualite-to-fonction.ts`, `crawl-targets.ts` (team pages), `scoring.ts`, SiteSetting `prospection`                                      | T0            | Purs + tests                                |
| **T2 — Schéma**                       | Migration additive (Company, Establishment, **CompanyPerson + Role**, Contact, Campaign, CoverageCell, CollectRun, Event, **AccessLog**, Tag, Suppression, **StockReference, GeoCoverageStat, StatsSnapshot**) | T1            | `prisma migrate` OK, mock tests             |
| **T3 — Ingestion Stock Sirene**       | `stock-ingestor` (bulk-load exhaustif + `StockReference`) + `delta-worker` + rate-limit distribué + Zod + circuit breaker                                                                                      | T2            | Stock chargé, dénombrement par dép prouvé   |
| **T4 — Collecte ciblée + coverage**   | `rechercheEntreprises`/RNE ciblage, `collect-worker`, `coverage-worker` (rollup dép→région→France), idempotence anti-piège jobId                                                                               | T3            | 1 dép pilote, matrice + stats France à jour |
| **T5 — Enrichissement (2 passes)**    | Passe A coordonnées + Passe B **personnes/team pages** + confirmation domaine + validation email/tél + Annuaire administration (public)                                                                        | T4            | Contacts + responsables mesurés             |
| **T6 — Console admin (pilotage)**     | nav pôle, wizard campagne, détail campagne                                                                                                                                                                     | T4            | Lancer une campagne depuis l'UI             |
| **T7 — Console admin (exploitation)** | base entreprises (filtres), fiche, coverage-map, dashboard                                                                                                                                                     | T5            | Naviguer/filtrer/voir la couverture         |
| **T8 — Export & RGPD**                | export CSV, opt-out/effacement, purge rétention, pont CRM (option)                                                                                                                                             | T7            | Export + opt-out prouvés                    |
| **T9 — Durcissement**                 | Web Vitals, quotas, observabilité, doc registre, tests complets                                                                                                                                                | T8            | Gates verts, campagne pilote « done »       |
| **(V2)**                              | Outreach/emailing, scoring avancé, enrichissement gratuit approfondi (plus de sources ouvertes)                                                                                                                | Décision Will | —                                           |

Chaque tranche = schéma → action/worker → UI → test → **gate → croisement → réconciliation → commit branche**.

---

## 13. Risques & points d'attention

| Risque                                      | Impact                                                                                  | Mitigation                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Email/tél partiels en gratuit**           | Toutes les entreprises n'ont pas de site public → certaines resteront `non_contactable` | Cascade gratuite maximale (site + mentions légales) ; **classification honnête** (§5.10) + export segmenté ; on ne masque pas le taux réel |
| Découverte du **site web** d'une entreprise | Sans domaine, pas d'email/tél scrapé                                                    | Heuristique domaine + vérif DNS/HTTP **gratuite** + recherche web sans clé ; champ site si présent dans les données ouvertes               |
| Plafond pagination API                      | Collecte incomplète si mal découpée                                                     | Découpage fin dép×NAF×tranche(×commune) = work-list                                                                                        |
| Volume (millions d'entreprises)             | Perf DB/UI                                                                              | Index composites, pagination serveur, quotas                                                                                               |
| RGPD mal cadré                              | Risque juridique                                                                        | Lock RGPD en T0, garde-fous code, validation juridique avant V2/outreach                                                                   |
| CGU sources tierces                         | Blocage/juridique                                                                       | Liste blanche (données ouvertes only), interdiction LinkedIn/annuaires privés                                                              |
| Web Vitals pages admin                      | Gate lhci rouge                                                                         | Virtualisation, pagination, bundle maîtrisé                                                                                                |
| stub.invalid non respecté                   | Build cassé                                                                             | Workers/connecteurs stub-aware dès T3                                                                                                      |

---

## 14. Questions ouvertes — **TRANCHÉES le 2026-07-01 → voir `07-DECISIONS.md`**

> ✅ Les 10 questions ci-dessous ont été tranchées (décisions dans `07-DECISIONS.md`). Résumé : domaine
> sans SERP · exploitable = email valide · pilote Isère 38 (BTP + Santé) · public = filtre · export
> CSV/XLSX + CRM manuel · conservation 3 ans (⚠️ valider juridiquement) · module « prospection » · siège
> only V1 · **validation juridique AIPD bloquante avant collecte** · passe B 4 pages/profondeur 2.
> (Liste d'origine conservée ci-dessous pour référence.)

1. **Découverte du domaine** de l'entreprise (pour scraper email/tél, **gratuitement**) : quelle
   priorité entre heuristique domaine + vérif DNS/HTTP et recherche web sans clé ? (tout reste gratuit)
2. **Seuil « exploitable »** : email+tél requis, ou email seul suffit à marquer `exploitable` ?
3. **Cible métier** : quels secteurs/verticales prioritaires (BTP, santé, droit…) et quels départements
   pour la campagne pilote ?
4. **Organisations publiques** : `typeOrganisation` = 4e axe de la matrice de couverture, ou simple filtre ?
5. **Destination de l'export** : CSV/XLSX seul, pont vers le CRM Qualiopi (`Client` statut prospect), ou les deux ?
6. **Durée de conservation RGPD** et **texte de la mention d'information** (validation juridique).
7. **Nom définitif du module** (`prospection` / `base-entreprises` / autre) et du pôle admin.
8. **Établissements** : collecter seulement le siège (V1) ou tous les établissements/succursales (volume ↑) ?
9. **[AUDIT] Validation juridique** : faire valider l'**AIPD + la mise en balance (LIA) + l'exemption
   d'information art. 14** par un DPO/juriste avant tout connecteur (recommandé bloquant).
10. **[AUDIT] Capture des responsables** : jusqu'où pousser la passe B (pages équipe) — budget de pages,
    profondeur, verticales prioritaires ? (impacte le temps de crawl et le taux de personnes nominatives)

---

## 16. Sources ouvertes gratuites — récapitulatif **[AUDIT]**

| Source                                       | Usage                                        | Clé ?          |
| -------------------------------------------- | -------------------------------------------- | -------------- |
| **Stock Sirene open data** (INSEE/data.gouv) | **Backbone exhaustivité** + dénombrement     | Non (download) |
| **Flux MAJ quotidien Sirene**                | Fraîcheur (créations/cessations)             | Non            |
| **API recherche-entreprises**                | Ciblage/UX à la demande                      | Non            |
| **API Sirene (portail-api.insee.fr)**        | Vérif ponctuelle (curseur)                   | Token gratuit  |
| **INPI RNE**                                 | Dirigeants à jour                            | Token gratuit  |
| **Annuaire administration** (api-lannuaire)  | Contacts publics officiels                   | Non            |
| **BODACC** (DILA)                            | Procédures collectives, changements          | Non            |
| **BAN** (api-adresse)                        | Géocodage lat/lng                            | Non            |
| Site public de l'entreprise                  | Email/tél/responsables (mini-crawl 2 passes) | Non            |

**Interdits** : LinkedIn, Pages Jaunes, société.com, annuaires privés, **scraping de SERP**. Extraction
limitée au **site propre de chaque entreprise** (droit sui generis des bases L.341-1 CPI respecté).

## 17. Synthèse des corrections d'audit (v1.1)

**3 angles morts corrigés + 1 changement d'archi :**

1. **Efficacité** : collecte de masse = **Stock Sirene + delta** (pas l'API paginée) → ×100 ; rate-limit
   distribué réel ; piège jobId/BullMQ neutralisé ; bulk-upsert ; backpressure ; vues matérialisées.
2. **Reporting** : couche **`GeoCoverageStat` dép→région→France** + **`StockReference`** (dénominateur) +
   `StatsSnapshot` (courbes) → vrais taux de complétion ET de contactabilité, à 3 niveaux, + carte + ETA + alertes.
3. **Personnes** : `CompanyPerson` généralisé (dirigeants **+ responsables de secteur/équipe**), crawl
   **2 passes** (pages `/equipe`), `personKey` corrigé, rôles multiples normalisés, lien email nominatif.
4. **RGPD** : **AIPD**, **non-diffusible + opposition RNE**, info art.14, opt-out réellement bloquant,
   journal d'accès, RBAC, minimisation ; **scraping de SERP retiré** ; sources gratuites ajoutées (RNE,
   Annuaire administration, BODACC, BAN).

Détail : chaque ajout est marqué **[AUDIT]** dans les sections concernées.

## 15. Prochaine étape

À la validation de ce plan par Will → créer le **skill `axionia-prospection`** (SKILL.md + `reference/`
: contrat-codebase, data-model, sources-collecte-enrichissement, autopilot-workflow, conformité-RGPD,
pilotage-suivi), puis dérouler T0→T9 en autopilot sur branche isolée. **Rien n'est codé tant que ce
plan et les questions §14 ne sont pas tranchés.**

```

```
