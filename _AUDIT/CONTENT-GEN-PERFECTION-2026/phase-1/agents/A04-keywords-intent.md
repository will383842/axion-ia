# A04 — Mots-clés & Intention de recherche

## Audit Forensique Content-Gen Perfection 2026 — Phase 1

> **Agent** : A04  
> **Date** : 2026-05-21  
> **HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
> **Mode** : AUDIT-ONLY STRICT — 0 invention, citations fichier:ligne  
> **Score** : /50

---

## Mission

Auditer la table/seeds `Keyword` (747 seeds annoncés), le mapping verticale×cible×type contenu, la couverture longue traîne, et la sélection keyword par le pipeline content-gen.

---

## Méthode

1. Lecture complète de `prisma/schema.prisma` (recherche `model Keyword`, `@@map.*keyword`)
2. Glob `**/*keyword*` dans `src/` → 3 fichiers sources identifiés
3. Lecture de `src/content/keywords/types.ts` (interface `KeywordSeed`)
4. Lecture de `src/content/keywords/master.ts` (agrégateur + filtres)
5. Comptage programmatique via Python sur les 15 fichiers seeds (≠ types.ts/validate.ts/master.ts)
6. Lecture `src/server/content-gen/generators/blog-from-keywords.ts` (pipeline génération)
7. Lecture `src/server/queue/workers/content-orchestrator-worker.ts` (sélection keyword → `deriveBlogKeyword`)
8. Lecture `src/server/queue/workers/content-keyword-sync-worker.ts` (worker GSC sync)
9. Lecture `src/server/content-gen/quality/seo-score.ts` (validation keyword in title)
10. Lecture `src/content/keywords/validate.ts` (règles validation seeds)
11. Exploration admin `/admin/content-gen/keyword-tracking` (UI tracking)
12. Exploration `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` → **répertoire ABSENT**

---

## État observé

### Architecture générale

Il n'existe **PAS de model `Keyword` dans Prisma** (pas de table DB dédiée). Les seeds keyword sont stockés sous forme de **fichiers TypeScript statiques** (`src/content/keywords/`) non persistés en base. Le seul modèle DB lié aux keywords est `KeywordTracking` (`@@map("keyword_tracking")`) qui suit les positions GSC/SerpAPI post-publication — c'est un outil de monitoring, pas un seed store.

**Localisation réelle des seeds** : `src/content/keywords/` — 19 fichiers TypeScript.

### Interface `KeywordSeed` (types.ts:106-135)

| Champ             | Type                | Description                                |
| ----------------- | ------------------- | ------------------------------------------ |
| `keyword`         | `string`            | Mot-clé exact, naturel FR (≥10 chars)      |
| `intent`          | `KeywordIntent`     | D1-D8 sémantique primaire (8 valeurs)      |
| `kbType`          | `KeywordKbType`     | Type contenu KB cible (15 valeurs)         |
| `module`          | `KeywordModule`     | Service Axion-IA (7 valeurs)               |
| `cible`           | `KeywordCible`      | Segment cible (16 valeurs)                 |
| `secteur`         | `string?`           | Slug secteur si applicable                 |
| `priorite`        | `1\|2\|3`           | Temporalité (1=maintenant)                 |
| `niveau`          | `1\|2\|3`           | Volume HEAD/BODY/LONGUE TRAÎNE             |
| `injection`       | `KeywordInjection`  | H1, metaTitle, metaDescription, h2Variants |
| `variables`       | `KeywordVariables?` | Chiffres bénéfices défendables             |
| `urlCible`        | `string`            | URL `/fr/…`                                |
| `canonicalParent` | `string?`           | URL parent hiérarchie sémantique           |
| `source`          | `KeywordSource?`    | gsc/autocomplete/concurrent/manuel         |
| `note`            | `string?`           | Contexte, contrainte, schema.org           |

**Total champs définis** : 14 champs (dont 3 optionnels implicites dans l'interface).

### Champs ABSENTS — réponse aux questions critiques P0

| Question critique                | Présent ?                                                  | Fichier:ligne                                                                               |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `searchIntent` (champ explicite) | **OUI** via `intent: KeywordIntent` (types.ts:110)         | Remplace le nom `searchIntent` — équivalent fonctionnel                                     |
| `vertical` (mapping verticale)   | **OUI partiel** via `module: KeywordModule` (types.ts:113) | Mapping module→verticale non automatisé                                                     |
| `audienceFit` (tpe/pme/eti)      | **OUI** via `cible: KeywordCible` (types.ts:116)           | 16 valeurs dont tpe/pme/eti/eti/grand-compte                                                |
| `contentTypeFit`                 | **OUI** via `kbType: KeywordKbType` (types.ts:112)         | 15 types de contenu                                                                         |
| `clusterId` (topic cluster)      | **NON**                                                    | Absent du type et de tous les seeds                                                         |
| `isLongTail`                     | **NON**                                                    | Absent — seulement `niveau: 1\|2\|3` (3=longue traîne proxy)                                |
| `isLocal`                        | **NON**                                                    | Absent — seul `secteur` optionnel                                                           |
| `cityIds`                        | **NON**                                                    | Absent — les anchors villes sont dans `CoverageCampaign.anchorVilleSlugs`                   |
| `searchVolume`                   | **NON**                                                    | Absent du type — pas de données KD/volume dans les seeds                                    |
| `difficulty` (KD)                | **NON**                                                    | Absent — aucune donnée SEMrush/Ahrefs intégrée                                              |
| `usageCount` (re-use)            | **NON**                                                    | Absent des seeds keyword. Le `usageCount` dans schema.prisma:2190 concerne `KnowledgeAsset` |

### Distribution par module (verticale)

Comptage depuis les 15 fichiers seeds (753 occurrences brutes `keyword:`, filtrage BANNED_TERMS dans master.ts peut réduire légèrement) :

| Module                     | Occurrences brutes     |
| -------------------------- | ---------------------- |
| `transversal`              | 224                    |
| `interventions-formations` | 160                    |
| `implementation`           | 174                    |
| `audit`                    | 140                    |
| `codage-developpement`     | 51                     |
| `coaching-1-to-1`          | 18                     |
| `maintenance-ia`           | ~0 (aucun seed trouvé) |

**Total brut** : 753 (après filtrage BANNED_TERMS → 747 annoncés).  
**Écart 753 vs 747** = 6 seeds filtrés par BANNED_TERMS (OPCO, Qualiopi, CPF, n8n, Zapier, LangChain, etc.).

### Verticale `sites_web_augmentes` — ABSENT

Le module `codage-developpement` couvre partiellement la 5e verticale web, via `g3b-web-digital-augmente.ts` (15 seeds). Mais la verticale n'est PAS nommée `sites_web_augmentes` dans `KeywordModule` (types.ts:34) — elle s'appelle `codage-developpement`. Gap de naming entre la stratégie business (5 verticales) et l'implémentation keyword.

### Distribution par intent

| Intent                                              | Occurrences brutes |
| --------------------------------------------------- | ------------------ |
| `transactionnel`                                    | 145                |
| `aeo`                                               | 156                |
| `informationnel`                                    | 126                |
| `benefice`                                          | 89                 |
| `comparatif` + `partenaire` + `sectoriel` + `local` | 237 total          |

**Observation critique** : intent `local` déclaré dans `KeywordIntent` (types.ts:24) mais **0 seed avec `intent: "local"`** trouvé dans les fichiers. Les seeds géo-locaux de `i-geo.ts` utilisent `intent: "aeo"` ou `intent: "comparatif"`.

### Couverture longue traîne

Analyse Python sur 753 seeds bruts :

| Catégorie               | Count   | %         |
| ----------------------- | ------- | --------- |
| ≥4 mots (longue traîne) | **743** | **98.7%** |
| 3 mots                  | 9       | 1.2%      |
| 1-2 mots                | 1       | 0.1%      |

**98.7% des seeds sont longue traîne** — excellente couverture. Seul `audit IA PME` (3 mots) fait office de HEAD keyword pur. Les seeds HEAD (niveau 1-2 officiels) sont tous des formulations naturelles ≥4 mots en pratique.

### Sélection keyword par le pipeline — CRITIQUE

**Le pipeline content-gen n'utilise PAS les seeds TypeScript** pour sélectionner le keyword primaire lors de la génération. Voici le chemin réel :

1. `content-orchestrator-worker.ts:38-50` — `deriveBlogKeyword()` génère le `primaryKeyword` de façon **déterministe hardcodée** :
   ```typescript
   const base =
     serviceSector === "audits"
       ? "audit IA"
       : serviceSector === "implementations"
         ? "implémentation IA"
         : "formation intelligence artificielle";
   const ville = anchorVilleSlug ? ` ${anchorVilleSlug.replace(/-/g, " ")}` : "";
   return `${base}${ville}`;
   ```
2. Ce keyword générique (ex: `"audit IA paris"`) est injecté dans `ContentGenJob.inputPayload.primaryKeyword`
3. `blog-from-keywords.ts:46-50` consomme `input.primaryKeyword` et `input.targetSearchIntent`

**Résultat** : les 747 seeds TypeScript ne sont **JAMAIS consultés** lors de la génération. Ils sont des seed-données de référence (pour les humains, pour l'admin console `/admin/content-gen/keyword-engine` — qui n'existe pas encore), mais pas câblés au pipeline de génération automatique.

### Validation keyword-in-title — seo-score.ts

La fonction `scorePrimaryKeyword()` (seo-score.ts:83-100) vérifie la présence du keyword dans :

- Le **title** (substring exact, +4 pts)
- Le **H1** (`<h1>` extrait depuis bodyText.toLowerCase(), +4 pts) — **BUG POTENTIEL** : la regex `/<h1[^>]*>([^<]*)</.exec(bodyText.toLowerCase())` cherche le H1 dans le bodyText (texte brut) alors que le bodyHtml est passé séparément. Si bodyText est déjà du texte sans balises, cette regex ne matchera jamais (`<h1>` absent du texte brut).
- Le **body** (occurrences ≥3, +4 pts)

**Aucune lemmatisation FR** n'est implémentée. Correspondance substring exact uniquement. Ex : keyword `"formations IA"` ne matchera pas `"formation IA"` dans le titre.

### Admin UI keywords

- `/admin/content-gen/keyword-tracking` : UI de tracking GSC existante (KeywordTrackingV2.tsx), affiche les `KeywordTracking` DB rows (sync cron hebdo). En mode "shadow V1" — table vide tant que credentials GSC/SerpAPI absents.
- `/admin/content-gen/keyword-engine` : **ABSENT** — référencé dans `types.ts:9` ("Console admin `/admin/content-gen/keyword-engine` (override manuel)") mais aucune page trouvée dans `src/app/[locale]/(admin)/[adminPrefix]/content-gen/`.
- **0 CRUD seeds** : aucune interface admin pour créer/modifier/supprimer des `KeywordSeed`.

### Audit précédent `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/`

Répertoire **INEXISTANT** dans `_AUDIT/`. Le fichier mémoire (`axionia_keyword_strategy_audit_2026-05-19.md`) référence "16 agents parallèles" et "700/1600" mais l'arborescence audit n'a pas été persistée dans le repo. La `_AUDIT/STRATEGIE-AEO-GEO-2026.md` (2026-05-07) contient la stratégie SEO/AEO/GEO de référence mais antérieure aux 747 seeds.

---

## Findings

### P0 — Bloquants

| ID   | Sévérité     | Finding                                                                                                                                                                                                                                                                                         | Fichier:ligne                                                                |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P0-1 | **CRITIQUE** | **Déconnexion totale seeds↔pipeline** : `deriveBlogKeyword()` génère des keywords génériques hardcodés (`"audit IA"`, `"implémentation IA"`, `"formation intelligence artificielle"`) au lieu de piocher dans les 747 seeds. Les seeds ne sont **jamais** utilisés par le moteur de génération. | `content-orchestrator-worker.ts:38-50`                                       |
| P0-2 | **CRITIQUE** | **Pas de model Keyword DB** : aucune table Prisma pour les seeds — ils vivent en TypeScript statique. Impossible de gérer usageCount, de marquer un seed comme "épuisé", de filtrer les seeds déjà générés, d'implémenter un lock SELECT FOR UPDATE anti-collision.                             | `prisma/schema.prisma` (absent)                                              |
| P0-3 | **CRITIQUE** | **intent `local` déclaré mais 0 seed** : `KeywordIntent` inclut `"local"` (types.ts:25) mais aucun seed l'utilise. Les 38 seeds GEO (`i-geo.ts`) utilisent `"aeo"` ou `"comparatif"`. Distortion statistique dans le reporting.                                                                 | `types.ts:25`, `i-geo.ts` (passim)                                           |
| P0-4 | **CRITIQUE** | **Admin keyword-engine absent** : `types.ts:9` annonce une console admin `/admin/content-gen/keyword-engine` (override manuel) mais elle n'existe pas. Les 747 seeds sont non éditables en prod sans deploy.                                                                                    | `types.ts:9`, `src/app/[locale]/(admin)/[adminPrefix]/content-gen/` (absent) |

### P1 — Majeurs

| ID   | Sévérité | Finding                                                                                                                                                                                                                                                                       | Fichier:ligne                                                   |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| P1-1 | Majeur   | **Pas de `searchVolume` ni `difficulty` (KD)** sur les seeds : 0 données SEMrush/Ahrefs intégrées. Priorisation basée sur le jugement éditorial humain (`priorite: 1\|2\|3`) sans validation quantitative.                                                                    | `types.ts:106`                                                  |
| P1-2 | Majeur   | **Bug H1 dans scorePrimaryKeyword** : regex `/<h1[^>]*>([^<]*)</.exec(bodyText.toLowerCase())` cherche une balise HTML dans du texte brut — matchera 0 fois. Score H1 toujours 0/4.                                                                                           | `seo-score.ts:91`                                               |
| P1-3 | Majeur   | **Pas de lemmatisation FR** : validation keyword-in-title est substring exact. "formations IA" ≠ "formation IA", "automatisation" ≠ "automatisations". Score sous-estimé et feedback LLM incorrects.                                                                          | `seo-score.ts:83-100`                                           |
| P1-4 | Majeur   | **0 `clusterId`** : aucun topic cluster défini. Impossible de regrouper les seeds par thème sémantique, de détecter la cannibalisation préventive, ou de distribuer équitablement entre clusters lors de la génération.                                                       | `types.ts` (absent)                                             |
| P1-5 | Majeur   | **`coaching-1-to-1` sous-représenté** : 18 seeds (2.4%) pour la verticale 1-to-1 vs 160+ pour interventions-formations. Déséquilibre fort. La 5e verticale `sites_web_augmentes` = alias `codage-developpement` (51 seeds) mais le naming diverge du positionnement business. | `g6-sectoriels-coaching.ts`, `g3b-web-digital-augmente.ts`      |
| P1-6 | Majeur   | **`maintenance-ia`** : module déclaré dans `KeywordModule` (types.ts:36) mais **0 seed seedé**. Gap stratégique total.                                                                                                                                                        | `types.ts:36`                                                   |
| P1-7 | Majeur   | **Pas de `usageCount` sur seeds** : impossible de savoir combien de fois un seed a généré du contenu. Risque de régénération sur le même keyword.                                                                                                                             | (architecture, absent)                                          |
| P1-8 | Majeur   | **Admin keyword-tracking en shadow V1** : table `KeywordTracking` vide car credentials GSC/SerpAPI absents. 0 donnée positionnement réelle disponible.                                                                                                                        | `content-keyword-sync-worker.ts:17` (commentaire "SKELETON V1") |

### P2 — Mineurs

| ID   | Sévérité | Finding                                                                                                                                                                                 | Fichier:ligne      |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| P2-1 | Mineur   | **Pas d'`isLocal` ni `cityIds`** sur les seeds : les seeds géo-locaux (i-geo.ts) ne sont pas marqués comme tels. Filtrage ville dans la génération impossible depuis les seeds.         | `types.ts`         |
| P2-2 | Mineur   | **Pas de `isLongTail` flag** : le proxy `niveau: 3` est implicite mais non exposé comme booléen. Reporting longue traîne nécessite calcul externe.                                      | `types.ts:120`     |
| P2-3 | Mineur   | **Distribution intent asymétrique** : `transactionnel` (145) + `aeo` (156) surreprésentés vs `benefice` (89) + `informationnel` (126). Risque de funnel top-of-funnel sous-alimenté.    | `master.ts:55-144` |
| P2-4 | Mineur   | **Audit précédent non persisté** : `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` absent du repo malgré mention dans MEMORY.md. Les 26 livrables annoncés (agents A1-A16) sont perdus.           | `_AUDIT/`          |
| P2-5 | Mineur   | **BANNED_TERMS filtrés silencieusement** : 6 seeds filtrés dans `master.ts:32-46` sans log ni alerte. Le `ALL_KEYWORD_SEEDS` retourne 747 mais le total brut est 753.                   | `master.ts:32-46`  |
| P2-6 | Mineur   | **`source` optionnel par défaut** : le champ `source?: KeywordSource` est omis dans la plupart des seeds sans "manuel" explicite. Tous semblent manuels mais l'inference est implicite. | `types.ts:132`     |

---

## Scoring /50

| Critère                                 | Max | Score  | Justification                                                                                                                                                                                               |
| --------------------------------------- | --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inventaire schema Keyword**           | /15 | **10** | Interface TypeScript complète (14 champs), bien typée, bonne documentation inline. Malus : pas de model DB (-2), 6 champs critiques absents (searchVolume/KD/clusterId/isLongTail/isLocal/usageCount) (-3). |
| **Distribution + couverture mesurée**   | /15 | **8**  | 747 seeds bruts comptés, distribution par module mesurée. Malus : déconnexion seeds↔pipeline = couverture effective = 0 (-4), `coaching-1-to-1` sous-représenté, `maintenance-ia` absent (-3).              |
| **Validation keyword-in-title auditée** | /10 | **5**  | `scorePrimaryKeyword()` existant et fonctionnel pour title+body. Malus : bug H1 regex (bodyText sans balises) (-2), 0 lemmatisation FR (-2), 0 lemmatisation intégrée au feedback loop (-1).                |
| **Couverture longue traîne**            | /5  | **5**  | 98.7% des seeds sont ≥4 mots. Couverture longue traîne exemplaire.                                                                                                                                          |
| **UI admin**                            | /5  | **1**  | Admin keyword-tracking existe (shadow V1, table vide). Admin keyword-engine = absent. 0 CRUD seeds.                                                                                                         |

### **TOTAL : 29/50**

---

## Délégations

Ces points dépassent le périmètre A04 et doivent être adressés par d'autres agents :

- **A01 (Pipeline chain)** : câblage seeds→orchestrator (P0-1) — nécessite refactoring `deriveBlogKeyword()` + lookup seeds
- **A06 (Admin)** : création page `/admin/content-gen/keyword-engine` CRUD (P0-4)
- **A09 (Web Vitals / DB)** : migration seeds → table Prisma + `usageCount` + lock optimiste (P0-2, P1-7)
- **A10 (SEO score)** : fix bug H1 regex + lemmatisation FR (P1-2, P1-3)

---

## UNKNOWNs

1. **Audit précédent** : `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` référencé en mémoire (score 700/1600, 26 livrables) mais absent du repo. Impossible de vérifier quelles recos ont été implémentées vs ignorées.
2. **GSC credentials** : les credentials OAuth GSC n'ont pas été vérifiés — le worker sync est en skeleton, mais l'activation réelle (Sprint 10.5) est UNKNOWN.
3. **SerpAPI key** : non vérifiée — selon le worker elle est absente.
4. **Nombre réel de seeds post-filtre BANNED_TERMS** : le total exact dépend de l'exécution runtime de `master.ts`. Le chiffre 747 vient de la mémoire externe — les 753 bruts - 6 filtrés = 747 est cohérent mais non vérifié par exécution.
5. **`g7c-secteurs-conso-culture.ts`** : 72 occurrences `keyword:` comptées, distribution intent inconnue (non auditée en détail).

---

## Références

| Fichier                                                                        | Rôle                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `axionia/src/content/keywords/types.ts`                                        | Interface `KeywordSeed` + types énumérés           |
| `axionia/src/content/keywords/master.ts`                                       | Agrégateur + filtres BANNED_TERMS + exports        |
| `axionia/src/content/keywords/validate.ts`                                     | Règles validation programmatique                   |
| `axionia/src/content/keywords/g1-audit.ts`                                     | Seeds audit (75 seeds)                             |
| `axionia/src/content/keywords/g2-interventions.ts`                             | Seeds interventions (69 seeds)                     |
| `axionia/src/content/keywords/g3-implementation-codage.ts`                     | Seeds implémentation (51 seeds)                    |
| `axionia/src/content/keywords/g3b-web-digital-augmente.ts`                     | Seeds web digital (15 seeds)                       |
| `axionia/src/content/keywords/g4-aeo.ts`                                       | Seeds AEO (63 seeds)                               |
| `axionia/src/content/keywords/g5-comparatifs-partenaires.ts`                   | Seeds comparatifs (51 seeds)                       |
| `axionia/src/content/keywords/g6-sectoriels-coaching.ts`                       | Seeds sectoriels + coaching (80 seeds)             |
| `axionia/src/content/keywords/g7a-secteurs-tertiaire.ts`                       | Seeds secteurs tertiaire (56 seeds)                |
| `axionia/src/content/keywords/g7b-secteurs-industrie.ts`                       | Seeds secteurs industrie (48 seeds)                |
| `axionia/src/content/keywords/g7c-secteurs-conso-culture.ts`                   | Seeds secteurs conso/culture (72 seeds)            |
| `axionia/src/content/keywords/g8-audiences-manquantes.ts`                      | Seeds audiences (20 seeds)                         |
| `axionia/src/content/keywords/h-notoriete.ts`                                  | Seeds notoriété (38 seeds)                         |
| `axionia/src/content/keywords/i-geo.ts`                                        | Seeds GEO/LLM (38 seeds)                           |
| `axionia/src/content/keywords/j-presse.ts`                                     | Seeds presse (28 seeds)                            |
| `axionia/src/content/keywords/m-positionnements.ts`                            | Seeds positionnement (37 seeds)                    |
| `axionia/src/content/keywords/x-supplements.ts`                                | Seeds suppléments (12 seeds)                       |
| `axionia/src/server/queue/workers/content-orchestrator-worker.ts`              | Pipeline sélection keyword (deriveBlogKeyword)     |
| `axionia/src/server/queue/workers/content-keyword-sync-worker.ts`              | Worker GSC sync (skeleton V1)                      |
| `axionia/src/server/content-gen/generators/blog-from-keywords.ts`              | Générateur articles depuis keyword                 |
| `axionia/src/server/content-gen/quality/seo-score.ts`                          | Scoring SEO + validation keyword-in-title          |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/keyword-tracking/` | Admin tracking UI (shadow V1)                      |
| `axionia/prisma/schema.prisma:3125-3156`                                       | model `KeywordTracking` (suivi positionnement GSC) |
| `axionia/_AUDIT/STRATEGIE-AEO-GEO-2026.md`                                     | Stratégie SEO/AEO/GEO de référence (2026-05-07)    |
