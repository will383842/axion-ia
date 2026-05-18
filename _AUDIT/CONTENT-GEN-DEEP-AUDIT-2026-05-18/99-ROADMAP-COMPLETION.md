# 99 — ROADMAP COMPLETION — Plan d'action priorisé P0-P3

> 34 actions identifiées. Estimation effort total : **~120-150h dev + ~20h décisions Will + budget copy 1 200 € à 20 000 €**.
> Découpé en 4 sprints sur ~6 mois.
> Format : action / source audit / effort / ROI / dépendance Will.

---

## P0 — Critiques bloquants ou priorité absolue (Sprint S+3, dès validation)

| #    | Action                                                                                      | Source             | Effort                | ROI                                   | Dépendance Will |
| ---- | ------------------------------------------------------------------------------------------- | ------------------ | --------------------- | ------------------------------------- | --------------- |
| P0-1 | Sécuriser `/settings/providers` Server Actions (rate-limit + audit log SOC2 P1-9 pattern)   | `09-ADMIN-UI` §2.7 | **1h dev**            | 🔴 Critique sécurité financière       | Décision B1     |
| P0-2 | Fix snapshot `admin-nav.test.ts:7` (36→37) — débloquer baseline CI                          | `07-TESTS` §2      | **30 s dev**          | 🔴 Débloque tous PRs                  | Décision D1     |
| P0-3 | Décider Type 10 par-fonction (supprimer / V1 minimal / V1 complet)                          | `21-TYPE-10`       | **5 min décision**    | 🟠 Évite drainage roadmap futur       | Décision A1     |
| P0-4 | Si A1 = V1 minimal : scaffold `/implementation/par-fonction/[slug]` × 8 pages               | `21-TYPE-10`       | **16h dev + 4h copy** | 🟡 SEO long-tail B2B                  | Conditionnel A1 |
| P0-5 | Centre d'aide unification reader DB (pattern glossaire) — fix bug silencieux admin ≠ public | `23-TYPE-12` §3    | **6h dev**            | 🔴 Productivité interne               | Décision E3     |
| P0-6 | Câbler `getBlogArticlesByVille()` sur hub ville `[ville]/page.tsx`                          | `06` §8.2          | **30 min dev**        | 🔴 Articles content-gen visibles pSEO | Aucune          |
| P0-7 | Hub `/guides/page.tsx` scaffold + sub-sitemap `guides` + JSON-LD ItemList                   | `18-TYPE-7` §8     | **4h dev**            | 🟠 Guides factory enfin exploitables  | Décision E1     |

**Total P0 : ~28h dev (sans A1 = V1)** + 4-5 décisions Will à trancher.

---

## P1 — Sprint S+3 (recommandé mixte) ou Sprint S+4

### P1 Sécurité / Observabilité (~10h dev)

| #    | Action                                                                                                        | Source    | Effort | ROI                                 |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------- | ------ | ----------------------------------- |
| P1-1 | Patcher `coverage.ts:252` bypass direct `prisma.contentGenConfig.upsert` → utiliser `writeContentGenConfig()` | `06` §8.9 | 15 min | 🟠 Cohérence rate-limit + audit log |
| P1-2 | Templates Server Actions audit log SOC2 (`upsertTemplate`/`toggleTemplate`)                                   | `09` §2   | 1h     | 🟡 SOC2 compliance                  |
| P1-3 | Author Server Actions audit log SOC2 (Manon `updateAuthor`)                                                   | `09` §2   | 30 min | 🟡 SOC2 compliance                  |
| P1-4 | Review.ts + jobs.ts ajout `writeAuditLog` (déjà ont `logActivity`)                                            | `09` §2   | 1h     | 🟡 SOC2 compliance                  |
| P1-5 | Geo.ts rate-limit P1-30 sur writes (`requireAdminWriteRateLimited`)                                           | `09` §2   | 30 min | 🟠 Anti-abus admin                  |
| P1-6 | Export `NEXT_PUBLIC_SENTRY_RELEASE: ${{ github.sha }}` workflow `deploy-coolify.yml`                          | `10` §4   | 30 min | 🟠 Sentry release tracking          |
| P1-7 | Sentry capture dans 4 workers critiques (publish, gen, orchestrator, indexnow)                                | `08` §B   | 4h     | 🟠 Erreurs workers visibles         |
| P1-8 | Câbler 2 helpers Telegram dormants (`alertCostCap100` + `alertProviderDown30min`)                             | `10` §3   | 1h     | 🟡 Escalade INCIDENT complète       |
| P1-9 | Kill-switch sur `content-psi-monitor-worker.ts:203` + `content-monitoring-worker.ts:213`                      | `08` §B   | 30 min | 🟡 Cohérence kill-switch            |

### P1 Tests (~6h dev)

| #     | Action                                                                                        | Source  | Effort | ROI                            |
| ----- | --------------------------------------------------------------------------------------------- | ------- | ------ | ------------------------------ |
| P1-10 | Tests Playwright `/un-a-un` + `/un-a-un/par-ville/paris` (copier pattern 3 autres verticales) | `07` §6 | 1h     | 🔴 4e verticale sans filet E2E |
| P1-11 | Tests Vitest `content-publish-worker.spec.ts` couvrant pipeline + hotfix mentionedCities      | `07` §3 | 4h     | 🔴 Blast radius max            |
| P1-12 | LHCI `/un-a-un` + `/un-a-un/par-ville/paris` 2 URLs                                           | `07` §7 | 5 min  | 🟡 Web Vitals 4e verticale     |
| P1-13 | Tests Vitest 4 workers prioritaires (gen, orchestrator, fact-check, indexnow)                 | `08` §B | 4h     | 🟠 Anti-régression workers     |

### P1 Indexation / Discovery (~6h dev)

| #     | Action                                                                                              | Source        | Effort      | ROI                                 |
| ----- | --------------------------------------------------------------------------------------------------- | ------------- | ----------- | ----------------------------------- |
| P1-14 | Yandex Webmaster client `src/server/content-gen/seo/yandex-wmt-client.ts` (pattern bing-wmt-client) | `11` §8       | 4-6h        | 🟠 YandexBot allow utile vraiment   |
| P1-15 | Vérifier sitemap soumis GSC + Bing WMT + Yandex WMT (humain Will)                                   | `11` STOP&ASK | 30 min Will | 🔴 Si non, perte massive indexation |
| P1-16 | Rotation `INDEXNOW_KEY` annuelle (créer politique 12 mois)                                          | `11` STOP&ASK | 1h          | 🟡 Sécurité moyenne                 |

### P1 Contenus structurels (~24h dev + 8h copy)

| #     | Action                                                                                        | Source          | Effort           | ROI                           |
| ----- | --------------------------------------------------------------------------------------------- | --------------- | ---------------- | ----------------------------- |
| P1-17 | `/stack-ia/[tool]/page.tsx` × 11 outils + JSON-LD Product + mesh comparaisons                 | `20-TYPE-9` §8  | 8h dev           | 🟠 Product schema utile B2B   |
| P1-18 | `/presse/[slug]/page.tsx` scaffold + brancher 3 communiqués + sitemap-news inclusion          | `19-TYPE-8` §8  | 6h dev           | 🟠 Communiqués URL canonique  |
| P1-19 | `/glossaire/[slug]/page.tsx` scaffold + ajouter 20 termes prioritaires (vs 12 actuels)        | `22-TYPE-11` §8 | 6h dev + 4h copy | 🟠 Citabilité AEO/GEO +30 %   |
| P1-20 | FAQ sitemap V1 fix : `buildFaqSitemap` doit inclure Q/R DB tier_1 (pas que FAQ_GLOBAL legacy) | `17-TYPE-6` §8  | 1h dev           | 🟠 AEO FAQ                    |
| P1-21 | RSS parser remplacer regex naïf par `fast-xml-parser` (support Atom 1.0)                      | `13-TYPE-2` §7  | 4h dev           | 🟡 Sources Atom-only visibles |

**Total P1 : ~50h dev + ~4h copy + ~1h décisions Will**.

---

## P2 — Sprint S+4 ou S+5

### P2 Refactor & cohérence

| #    | Action                                                                                                        | Source         | Effort | ROI                                |
| ---- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ---------------------------------- |
| P2-1 | Refactor `content-quality-improver-worker.ts` 3× `prisma.generationLog.create` → utiliser `logStep` canonical | `10` §1        | 1h     | 🟡 PII redact appliqué             |
| P2-2 | Speakable cssSelector ↔ HTML drift fix sur 2 pages identifiées                                                | `06` §8.6      | 2h     | 🟡 AEO cohérent                    |
| P2-3 | RSS sources : migration `ContentGenConfig` JSON inline → table dédiée `RssSource` Prisma                      | `13-TYPE-2` §7 | 6h     | 🟡 Gestion UX admin                |
| P2-4 | Helpers manquants : `getVillesByDepartement(code)`, `getRegionByDepartement(code)`                            | `05` §7        | 1h     | 🟡 Mesh pSEO départements          |
| P2-5 | Cas concrets : migration Prisma `CaseStudy` (5 fixtures TS → DB)                                              | `16-TYPE-5` §7 | 12h    | 🟡 Admin éditable                  |
| P2-6 | Cas concrets : ajouter champ `geo:` aux 5 fixtures actuelles                                                  | `16-TYPE-5` §7 | 30 min | 🟠 `getNearbyCases` enfin alimenté |
| P2-7 | Cas concrets : `datePublished` dédupliqué par cas (vs hardcode `2026-05-01`)                                  | `16-TYPE-5` §7 | 5 min  | 🟡 Trust signal                    |
| P2-8 | FAQ extraction : sanitization HTML (DOMPurify ou sanitize-html)                                               | `17-TYPE-6` §7 | 1h     | 🟠 Anti-XSS                        |
| P2-9 | FAQ EN placeholder = FR : ajouter check avant insert si EN ré-ouvert                                          | `17-TYPE-6` §7 | 30 min | 🟡 Anti-bombe-à-retardement        |

### P2 Tests étendus

| #     | Action                                                                                                                                                               | Source  | Effort | ROI                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ---------------------------- |
| P2-10 | Tests Vitest 8 workers restants non couverts (rss-fetch, qa-extract, similarity-monitor, news-lifecycle, tier-lifecycle, google-indexing, keyword-sync, psi-monitor) | `07` §6 | 12h    | 🟡 Couverture workers > 50 % |

**Total P2 : ~36h dev**.

---

## P3 — V2 / backlog

| #    | Action                                                                                   | Source         | Effort | Note                                |
| ---- | ---------------------------------------------------------------------------------------- | -------------- | ------ | ----------------------------------- |
| P3-1 | Sentry PII scrub : étendre regex IPv4 → IPv6                                             | `10` §5        | 1h     | Low priority, rare                  |
| P3-2 | Variant `focus_dirigeants` un-a-un Sprint S+3 (5 fichiers à toucher)                     | `14-TYPE-3`    | 8h     | Conditionnel adoption un-a-un       |
| P3-3 | Refactor `landingVilleGenerator` pour gérer input sans `villeSlug`                       | `12-TYPE-1` §7 | 4h     | Évite throw runtime FAQ squelettes  |
| P3-4 | Pages département dédiées `/implantations/[region]/[departement]/page.tsx`               | `05` §7.5      | 16h    | Gain pSEO "audit IA Hauts-de-Seine" |
| P3-5 | Sprint Glossaire V2 : 60 termes + détail + mesh entrant                                  | `22-TYPE-11`   | 32h    | Citabilité AEO long-terme           |
| P3-6 | Sprint Centre d'aide V2 : unification reader DB + JSON-LD TechArticle/HowTo conditionnel | `23-TYPE-12`   | 20h    | Productivité éditoriale             |
| P3-7 | Tombstone vrai 410 HTTP (middleware Edge + Redis-edge)                                   | `06` §8.12     | 4-6h   | Conformité HTTP semantics           |
| P3-8 | EN locale réactivation après fix bug next-intl v4.11 + Next 16.2                         | `AGENTS.md`    | 8h     | Conditionnel décision A5            |

**Total P3 : ~100h dev** (dépend largement décisions stratégiques Will).

---

## Roadmap chronologique 6 mois

### Sprint S+3 (Q3 2026-W22, ~24h dev recommandé mixte)

**Périmètre infra (12h)** :

- P0-1 (sécurité providers, 1h)
- P0-2 (snapshot admin-nav, 30s)
- P0-6 (hub ville mentionedCities, 30 min)
- P1-1 (coverage bypass, 15 min)
- P1-6 (SENTRY_RELEASE, 30 min)
- P1-8 (helpers Telegram dormants, 1h)
- P1-7 (Sentry workers × 4, 4h)
- P1-10 (Playwright un-a-un, 1h)
- P1-12 (LHCI un-a-un, 5 min)
- P1-15 (vérif sitemap consoles, 30 min Will)
- P1-9 (kill-switch 2 workers, 30 min)
- Buffer (~3h imprévu)

**Périmètre contenus (12h)** :

- P0-7 (hub /guides, 4h)
- P0-5 (centre d'aide reader unifié, 6h)
- P1-19 partial (/glossaire/[slug] scaffold + 10 termes, ~3h)

**Livrable** : 1 PR mergée + 2 STOP&ASK Will levés (A1, A2).

### Sprint S+4 (Q3 2026-W23-24, ~40h dev)

- P1-17 (/stack-ia/[tool] × 11, 8h)
- P1-18 (/presse/[slug] scaffold, 6h)
- P1-19 complete (60 termes glossaire, 4h copy)
- P1-14 (Yandex WMT client, 6h)
- P1-11 (test publish-worker, 4h)
- P1-13 (tests 4 workers, 4h)
- P1-21 (RSS parser fast-xml-parser, 4h)
- P1-20 (FAQ sitemap fix, 1h)
- Buffer (~3h)

### Sprint S+5 (Q3 2026-W25-26, ~36h dev)

- P2-1 à P2-9 (refactor & cohérence, 24h)
- P2-10 (tests 8 workers restants, 12h)
- Conditionnel A1 : P0-4 par-fonction V1 (si validation)

### Sprint S+6 (Q4 2026-W27+, conditionnel)

- P1-17 si non-livré : finir /stack-ia/[tool]
- P3-2 focus_dirigeants un-a-un
- P3-4 pages département
- Conditionnel A2 : démarrer copy Top 50 villes (Marseille, Lyon, Toulouse)

### Sprint S+7+ (Q4 2026 → Q1 2027)

- P3-5 Glossaire V2 (60 termes complet)
- P3-6 Centre d'aide V2
- Industrialisation contenus selon décision A4

---

## ROI estimé par sprint

| Sprint | Effort    | Gain attendu                                                                 | Métrique mesurable                                                                  |
| ------ | --------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| S+3    | ~24h dev  | Sécurité fix + 2 bugs silencieux corrigés + 1 hub orphelin résolu            | Snapshot CI vert + audit log providers complet + articles content-gen visibles pSEO |
| S+4    | ~40h dev  | 11 pages stack-ia + page presse détail + 60 termes glossaire + Yandex client | +60-80 URLs indexable + crawl Yandex actif                                          |
| S+5    | ~36h dev  | Refactor cohérence + tests étendus (workers > 50 % couverture)               | Coverage workers BullMQ ↑ + 0 fail Vitest                                           |
| S+6+   | ~variable | Industrialisation contenus / par-fonction / Top 50 villes                    | Trafic SEO selon décisions A1/A2/A4                                                 |

---

## Budget cash

| Poste                                    | Min          | Max          | Note                                  |
| ---------------------------------------- | ------------ | ------------ | ------------------------------------- |
| Dev (Manon LLM autopilot Claude Code)    | ~0 €         | ~0 €         | inclus déjà                           |
| Copy LLM 50 villes Tier-1 (option A)     | 600 €        | 1 200 €      | LLM-only                              |
| Copy hybride 50 villes (option B)        | 3 000 €      | 5 600 €      | RECOMMANDÉ                            |
| Copy humain pur (option C)               | 15 000 €     | 20 000 €     | sur 6-9 mois                          |
| Glossaire 60 termes copy                 | 200 €        | 600 €        | LLM + relecture                       |
| Stack-IA détail 11 outils                | 0 €          | 200 €        | LLM uniquement                        |
| Cas concrets 5 nouveaux                  | 0 €          | 1 000 €      | dépend canal                          |
| Coûts LLM workers BullMQ supplémentaires | 50 €/mois    | 200 €/mois   | cf. P2-3 ContentGenConfig.rss_sources |
| Bing WMT + Yandex WMT comptes            | 0 €          | 0 €          | gratuits                              |
| Total Sprint S+3 → S+5                   | **~3 800 €** | **~7 000 €** | mode hybride reco                     |

---

## Risques identifiés

| #   | Risque                                                        | Probabilité | Impact | Mitigation                                      |
| --- | ------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------- |
| R1  | Sprint S+3 dérive >24h (mixte trop ambitieux)                 | Moyenne     | Moyen  | Découper en 2 PRs (infra + contenus)            |
| R2  | Yandex WMT compte refusé (no entité légale ressorti)          | Faible      | Faible | Option B = passer Yandex via IndexNow seul      |
| R3  | Sentry SaaS quota dépassé avec capture × 4 workers            | Faible      | Moyen  | Monitoring tag par worker, ajuster sampling     |
| R4  | LLM coût copy 50 villes dépasse budget option B               | Faible      | Moyen  | Cap mensuel `monthlyCapUsd` provider            |
| R5  | Commits parallèles (cf. c33a831) hors session Will → conflits | Moyenne     | Moyen  | Coordination calendrier Manon vs Claude vs Will |

---

## Phrase de clôture officielle

> **AUDIT CONTENT-GEN DEEP V2.0 TERMINÉ — Verdict 🟡 746/1200 (62.2 % types) + 513/700 (73.3 % infra).**
> **25 livrables dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`.**
> **18 STOP & ASK Will (voir `03-STOP-AND-ASK-WILL.md`).**
> **Aucune ligne de code modifiée. Aucun commit créé. Aucun push.**
> **Prêt pour revue Will → décisions → puis Sprint S+3 EXECUTION (prompt séparé si validation).**

---

**Fin 99-ROADMAP-COMPLETION.md.**
