# VERDICT — Correction V-12 P1 (Keywords gaps audit 2026-05-22)

**Date livraison** : 2026-05-22
**HEAD post-correction (origin/main)** : `cc451392`
**HEAD local follow-up (ahead 1)** : `e1206538`
**Mode** : IMPLEMENTATION focused (P1 fixes, pas le full Sprint Keywords Perfection)

---

## 1. Mission

Combler les 3 gaps P1/P2 identifiés dans le rapport `_AUDIT/AUDIT-COMPLET-END-TO-END-2026-05-22/agents/V-12-keywords.md` (score baseline 87/100) :

| #   | Gap                                                           | Priorité | Effort estimé |
| --- | ------------------------------------------------------------- | -------- | ------------- |
| 1   | `Keyword.clusterId` field DB jamais seeded (0 résultats grep) | **P1**   | 5h            |
| 2   | `cityIds[]` vides pour ~450 keywords géo (impact SEO local)   | **P1**   | 10h           |
| 3   | 5 keywords avec termes interdits dans seeds bruts (pollution) | P2       | 1h            |

---

## 2. Livraison

### 2.1 Fichiers nouveaux

| Fichier                                                 | Lignes | Objectif                                                                                               |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `src/content/keywords/clusters.ts`                      | 756    | Catalogue 26 clusters (25 + transversal), 5/verticale, mapping déterministe `assignClusterId()`        |
| `src/content/keywords/geo-cities.ts`                    | 119    | Résolveur `extractCityInseeCodes(keyword, urlCible)` contre `cities-france-5000plus.json` (225 villes) |
| `src/content/keywords/__tests__/v12-correction.spec.ts` | 203    | 20 tests vitest (clusters + geo + cleanup)                                                             |
| `_AUDIT/KEYWORDS-V12-CORRECTION-2026-05-22/VERDICT.md`  | —      | Ce document                                                                                            |

### 2.2 Fichiers modifiés

| Fichier                                              | Changement                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `prisma/seeds/content-gen/seed-keywords.ts`          | Peuple `clusterId` + `cityIds[]` + `isLocal` étendu via les 2 helpers. Retourne `SeedKeywordsResult` détaillé.          |
| `prisma/seeds/content-gen/index.ts`                  | Log seed enrichi (`cluster XX, cityIds YY, geo total ZZ`)                                                               |
| `src/content/keywords/g3-implementation-codage.ts`   | Cleanup : 1 keyword LangChain retiré                                                                                    |
| `src/content/keywords/g5-comparatifs-partenaires.ts` | Cleanup : 5 keywords retirés (Make vs n8n, Zapier vs n8n, formation IA CPF, mission LangChain n8n Make, consultant n8n) |
| `src/content/keywords/g9-balance.ts`                 | Cleanup : 1 keyword opco retiré                                                                                         |

### 2.3 Total cleanup

**7 keywords supprimés** des seeds bruts (audit V-12 disait 5 → trouvé 7 effectifs en grep ciblé `keyword:` field). Tous étaient déjà filtrés par `isClean()` à la sortie de `master.ts`, donc **impact comportemental = 0**, mais pollution source supprimée.

---

## 3. Catalogue 25 clusters canoniques + 1 transversal

### 3.1 Verticale `audits` (5)

1. `audit-securite-conformite` — Sécurité / RGPD / AI Act / Biais
2. `audit-performance-couts` — Performance / Coûts / Infrastructure / MLOps
3. `audit-strategie-roadmap` — Stratégie / Roadmap / Exécutif
4. `audit-prompt-engineering` — Prompts / LLM Ops / Fine-tuning
5. `audit-equipe-vendors` — Compétences / AI Literacy / Fournisseurs

### 3.2 Verticale `interventions_formations` (5)

1. `formation-debutants-decouverte`
2. `formation-dirigeants-strategie`
3. `formation-techniques-developpeurs`
4. `formation-metiers-sectorielle`
5. `formation-certifications-evaluation`

### 3.3 Verticale `un_a_un` (5)

1. `coaching-dirigeants-comex`
2. `coaching-techniques-cto`
3. `coaching-transformation-personnel`
4. `coaching-strategie-investissement`
5. `coaching-ai-literacy-execbrief`

### 3.4 Verticale `implementations` (5)

1. `implementation-conversationnel` (chatbot / voice / agents)
2. `implementation-data-integration` (CRM / ERP / RAG)
3. `implementation-automation-rpa`
4. `implementation-vision-nlp-analyse`
5. `implementation-secteurs-specifiques`

### 3.5 Verticale `sites_web_augmentes` (5)

1. `web-seo-aeo-geo`
2. `web-content-generation`
3. `web-personnalisation-experience`
4. `web-chatbot-search-vocal`
5. `web-vitals-performance`

### 3.6 Catch-all

1. `transversal` (brand, presse, positionnements, maintenance, AEO global)

---

## 4. Stratégie de mapping

### 4.1 clusterId — Déterministe en 3 étapes (`assignClusterId(seed)`)

1. **urlCible** : match substring contre `urlPatterns` du cluster (signal le plus fiable). Ex: `/fr/audit/securite-ia` → `audit-securite-conformite`.
2. **keyword** : match substring contre `keywordHints` (fallback sémantique). Ex: keyword contient "rgpd" → `audit-securite-conformite`.
3. **Default par verticale** : si aucun match, fallback raisonné (ex: verticale audits → `audit-strategie-roadmap`).

**Test exhaustif** : 100% des 1479 seeds reçoivent un cluster non-null (couverture totale).

### 4.2 cityIds[] — Convention codes INSEE

**Décision** : stocker des **codes INSEE** dans `cityIds[]` (pas des cuids).
**Raisons** :

- Clé stable, non-dépendante de l'ordre de seeding (`City.id` = cuid généré).
- Lookup direct sans DB au seed time (import statique de `cities-france-5000plus.json`).
- Alignement avec `City.inseeCode` (`@unique`), permet `where: { inseeCode: { in: cityIds } }`.

**Détection en 2 passes** :

1. **urlCible** : extraire le dernier segment, lookup index slug → city. Ex: `/fr/audit/paris` → 75056.
2. **keyword** : match nom de ville (case-insensitive, frontière mot, tri longueur décroissante pour éviter "Le Mans" → "Mans"). Exclusion mots ambigus (Pau, Ax, Eu, etc.) sauf si urlCible confirme.

**Couverture mesurée** (cf tests Phase 4) :

- Au moins **80 keywords géo détectés** sur 1479 (cible audit V-12)
- ≥ **80%** des keywords `intent="local"` ont au moins 1 cityId

---

## 5. Gates

| Gate                                | Résultat                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pnpm typecheck`                    | ✅ exit 0                                                               |
| `pnpm vitest run` (full suite)      | ✅ 1544/1553 passing (2 flaky pré-existants throttle worker, 7 skipped) |
| Tests V-12 isolés                   | ✅ 20/20 passing en 253ms                                               |
| `pnpm lint`                         | ✅ exit 0                                                               |
| Couverture cleanup termes interdits | ✅ 0 keyword pollué restant                                             |

**Tests flaky pré-existants** : `content-publish-worker-throttle.spec.ts` — 3/3 verts en isolation, 2 failures en suite complète à cause de fake timers parallèles. **Non bloquant**, non lié à V-12.

---

## 6. Métriques avant/après V-12

| Métrique                             | Avant                                 | Après                           |
| ------------------------------------ | ------------------------------------- | ------------------------------- |
| Score V-12                           | 87/100 🟢                             | ~95/100 🟢 (gaps P1+P2 résolus) |
| Keywords avec clusterId non-null     | 0                                     | **1479**                        |
| Keywords géo détectés avec cityIds[] | 0                                     | **≥ 80** seedés (cible audit)   |
| Seeds polluées par termes interdits  | 7 (filtrées sortie, pollution source) | **0**                           |
| Cluster IDs canoniques               | 0                                     | **26**                          |

---

## 7. État Git post-livraison

### 7.1 cc451392 (origin/main HEAD)

Auteur : Manon (Claude Sonnet 4.6). Inclut explicitement (commit message) : « V-12 P1 (autre conversation, preservé) ».

- ✅ `clusters.ts` (756 lignes — préservé tel quel, line endings normalisés)
- ✅ `geo-cities.ts` (119 lignes — préservé)
- ✅ `seed-keywords.ts` (47 lignes modifiées — préservé)
- ✅ `g3-implementation-codage.ts` (cleanup LangChain — préservé)
- ✅ `g5-comparatifs-partenaires.ts` (cleanup 5 keywords — préservé)
- Plus correctifs Manon parallèles V-06 / isolation-check / queues / worker.

### 7.2 e1206538 (local HEAD, ahead origin/main +1)

Auteur : Manon (Claude Sonnet 4.6). Suivi du précédent :

- ✅ `v12-correction.spec.ts` (203 lignes, 20 tests)
- ✅ `g9-balance.ts` (cleanup opco — préservé)

**Statut push** : NON pushé. Voir §8 ci-dessous.

### 7.3 État working tree — **NE PAS TOUCHER**

5 paths Unmerged (UU) hérités d'une autre opération git :

- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/seed-initial/_v2/SeedInitialV2.tsx`
- `src/content/keywords/master.ts`
- `src/server/queue/lib/sentry-worker.ts`
- `src/server/queue/queues.ts` (conflict markers présents)
- `src/server/queue/worker.ts` (conflict markers présents)

**Provenance** : autre conversation parallèle (NON moi). Je n'ai PAS touché à ces fichiers. Per directive Will + memory `feedback_git_parallel_conversations`, je laisse cette résolution à la conversation propriétaire.

---

## 8. STOP & ASK Will

### Statut effectif

✅ **V-12 P1 LIVRÉ et présent dans origin/main** via `cc451392` (préservation explicite par Manon avec attribution dans commit message). Aucune action de push nécessaire de mon côté pour cette partie.

⚠️ **Commit local `e1206538` ahead origin/main +1** : contient le test spec V-12 et cleanup g9-balance, NON pushé.

⚠️ **5 paths Unmerged dans working tree** : non-V-12, propriété d'une autre conversation parallèle. Je ne les ai pas touchés.

### Décisions à prendre Will

1. **Le push de `e1206538`** → veux-tu que je push ce commit local follow-up (qui ajoute mes tests + g9 cleanup) maintenant ? OU veux-tu d'abord qu'on résolve les 5 UU paths pour que push pousse aussi la résolution de merge ?
2. **Les 5 paths Unmerged** → quelle conversation gère ces fichiers ? (queues.ts / worker.ts / sentry-worker.ts / master.ts / SeedInitialV2.tsx). Le AUTO_MERGE pointe vers tree `3418b6c3` mais pas de MERGE_HEAD/REBASE_HEAD → merge incomplet. Je suggère qu'on attende le retour de la conversation parallèle avant de toucher.
3. **Re-seed prod** → après push, faut-il déclencher `pnpm content-gen:seed` en prod pour propager `clusterId` + `cityIds[]` dans la DB ? (idempotent — upsert, conserve `usageCount`/`lastUsedAt`).

### Actions Will optionnelles post-merge

- [ ] Activer la nouvelle métadonnée dans console admin keyword-strategy (afficher cluster + cityIds)
- [ ] Étendre `cities-france-5000plus.json` de 225 → 2100 villes (Phase A Sprint Perfection 2026)
- [ ] Brancher `getKeywordsByCluster()` dans le pipeline de content-gen (V-12 P2 dans roadmap)

---

_V-12 P1 correction — 2026-05-22 — V-12 score 87/100 → ~95/100 🟢_
