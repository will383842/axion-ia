# SCENARIOS MATRIX — Audit E2E Campaign Flows

**Date passe 1 (code)** : 2026-05-22 — HEAD `e7c40004`
**Date passe 2 (runtime)** : 2026-05-23 — HEAD `c39f08d`
**Mode** : 🟢 **Runtime + code-level cross-checked**

## Mise à jour runtime 2026-05-23 — Comparatif

| #     | Scénario                | Verdict code (passe 1) | Verdict runtime (passe 2) | Évolution                                                           |
| ----- | ----------------------- | ---------------------- | ------------------------- | ------------------------------------------------------------------- |
| SC-01 | Création basique        | 🟢 OK                  | 🟢 OK                     | Schema + wiring confirmés runtime                                   |
| SC-02 | Preset pme-audits       | 🟢 OK                  | 🟢 OK                     | ⚠️ Slug `audits-all` en DB (pas `pme-audits`)                       |
| SC-03 | Preset interv-weekly    | 🟢 OK                  | 🟢 OK                     | ⚠️ Slug `interventions-formations-all` (pas `interventions-weekly`) |
| SC-04 | Preset tpe-burst        | 🟢 OK                  | 🟡 **PARTIAL ↓**          | Preset RETIRÉ, fonctionnalité via `config.batchSize`                |
| SC-05 | Preset eti-pilier       | 🟢 OK                  | 🟡 **PARTIAL ↓**          | Preset RETIRÉ, fonctionnalité via `typeDistribution.blog_pillar`    |
| SC-06 | Preset cities-paris     | 🟢 OK                  | 🟢 OK                     | Slug `landing-villes-all` (5 verticales)                            |
| SC-07 | Preset rss-daily        | 🟡 PARTIAL             | 🟢 **OK ↑**               | Slug match exact + generator présent                                |
| SC-08 | Scheduled startDate     | 🟢 OK                  | 🟢 OK                     | Cron `*/5 * * * *` confirmé                                         |
| SC-09 | Deadline endDate        | 🟢 OK avec note        | 🟡 **PARTIAL ↓**          | Cron `5 0 * * *` daily confirmé → P1 réel                           |
| SC-10 | Recurring cron          | 🟢 OK                  | 🟢 OK                     | Repeatable BullMQ + removeRepeatable                                |
| SC-11 | Sequential villes       | 🟢 OK                  | 🟢 OK                     | `current_city_index` schema OK                                      |
| SC-12 | Parallel villes         | 🟢 OK                  | 🟢 OK                     | Default `parallel`                                                  |
| SC-13 | blog_pillar             | 🟡 PARTIAL             | 🟢 **OK ↑**               | Generator + persona + disclaimer confirmés                          |
| SC-14 | landing_ville           | 🟡 PARTIAL             | 🟡 PARTIAL                | Generator OK, JSON-LD LocalBusiness + villes proches à fixer (P1)   |
| SC-15 | blog_from_keywords      | 🟢 OK                  | 🟢 OK                     | Gold standard                                                       |
| SC-16 | blog_from_title         | 🟢 OK                  | 🟢 OK                     | Tests E2E shared                                                    |
| SC-17 | blog_from_rss           | 🟡 PARTIAL             | 🟢 **OK ↑**               | Generator + SimHash + embeddings 1536 confirmés                     |
| SC-18 | qa_derived              | 🟡 PARTIAL             | 🟢 **OK ↑**               | Generator présent                                                   |
| SC-19 | comparison              | 🟡 PARTIAL             | 🟢 **OK ↑**               | Generator + `<table>` BUG-5 acquis                                  |
| SC-20 | Boucle improve          | 🟢 OK                  | 🟢 OK                     | `qualityImprovementAttempts` schema + logic confirmés               |
| SC-21 | REJECT-P0 SIREN         | 🟢 OK                  | 🟢 OK                     | `quarantined_critical` enum + llm-judge:128                         |
| SC-22 | quarantained_factcheck  | 🟢 OK                  | 🟢 OK                     | `quarantined_factcheck` enum + seuil 50                             |
| SC-23 | Cap journalier          | 🟢 OK                  | 🟢 OK                     | Redis INCR atomic confirmé                                          |
| SC-24 | Pause/Resume            | 🟢 OK                  | 🟢 OK                     | Server Actions + BullMQ pause                                       |
| SC-25 | Multi-targets V-01      | 🟢 OK                  | 🟢 OK                     | 5 hub paths cascade — 2 URLs curl 200                               |
| SC-26 | IndexNow + sitemaps     | 🟡 PARTIAL             | 🟢 **OK ↑**               | **P0-1 RÉFUTÉ** — sitemap-news 200 + route handler existe           |
| SC-27 | Rotation liens externes | 🟡 PARTIAL             | 🟢 **OK ↑**               | **P0-2 RÉFUTÉ** — `trackExternalLinksUsage` câblé `:439`            |
| SC-28 | Image hero / 0 DALL-E   | 🟢 OK                  | 🟢 OK                     | Doctrine `isAiGenerated:false` filtre DB strict                     |
| SC-29 | Cost cap kill-switch    | 🟢 OK                  | 🟢 OK                     | `kill_switch` key + `alertCostCap80`                                |
| SC-30 | Cleanup                 | 🟢 OK + ⚪ N/A         | 🟢 OK + ⚪ N/A            | 0 row TEST*E2E*\* créée                                             |

### Synthèse comparative

| Verdict    | Passe 1 (code) | Passe 2 (runtime) | Δ      |
| ---------- | -------------- | ----------------- | ------ |
| 🟢 OK      | 22 (73%)       | **26 (87%)**      | **+4** |
| 🟡 PARTIAL | 8 (27%)        | **4 (13%)**       | **-4** |
| 🔴 KO      | 0              | 0                 | 0      |

**Score runtime final** : **26/30 OK (87 %)** + 4/30 PARTIAL + 0/30 KO.

### Mouvements

- **+5 OK** (passage PARTIAL → OK) : SC-07, SC-13, SC-17, SC-18, SC-19, SC-26, SC-27 (= 7 ↑ mais 2 ↓ net)
- **-2 PARTIAL → 🟡 nouveau** : SC-04, SC-05, SC-09 (= 3 nouveaux PARTIAL)
- **Net +4** OK (22 → 26)

### 2 P0 du verdict initial RÉFUTÉS par runtime

- ❌ **P0-1** `sitemap-news.xml` manquant → **FAUX**, route HTTP 200
- ❌ **P0-2** `usageCount` jamais incrémenté → **FAUX**, `trackExternalLinksUsage` appelé

### Vrais P1 restants (priorité fix)

1. **SC-09** — Deadline-checker cron `5 0 * * *` daily → fix `*/15 * * * *` (~30 min)
2. **SC-14** — landing-ville LocalBusiness JSON-LD + villes proches HTML (~3-4 h)
3. **SC-04, SC-05** — Doc presets D-P5-1 à mettre à jour (architecture 8 templates verticales)

---

## Matrice passe 1 (code-level uniquement, archive)

## Tableau récapitulatif

| #     | Scénario                     | Verdict code   | Fichier rapport                        | Tests vitest                     | Notes clés                                             |
| ----- | ---------------------------- | -------------- | -------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| SC-01 | Création basique             | 🟢 OK          | `SC-01-creation-basique.md`            | ✅ coverage-controls.spec.ts:131 | Server Action + revalidate + audit log                 |
| SC-02 | Preset pme-audits            | 🟢 OK          | `SC-02-preset-pme-audits.md`           | ✅ campaign-templates.test.ts:71 | Seed + UI loader + defaults complets                   |
| SC-03 | Preset interventions-weekly  | 🟢 OK          | `SC-03-preset-interventions-weekly.md` | ✅ coverage-controls.spec.ts:183 | Cron validé, repeatable BullMQ                         |
| SC-04 | Preset tpe-burst             | 🟢 OK          | `SC-04-preset-tpe-burst.md`            | ✅ campaign-templates.test.ts    | Preset burst seedé                                     |
| SC-05 | Preset eti-pilier            | 🟢 OK          | `SC-05-preset-eti-pilier.md`           | —                                | guide_pilier registry + boucle D2                      |
| SC-06 | Preset cities-paris          | 🟢 OK          | `SC-06-preset-cities-paris.md`         | —                                | anchorVilleSlugs + landing-ville                       |
| SC-07 | Preset rss-daily             | 🟡 PARTIAL     | `SC-07-preset-rss-daily.md`            | ❌                               | Manon absent prompt RSS (intentionnel ?)               |
| SC-08 | Scheduled startDate          | 🟢 OK          | `SC-08-scheduled-startdate.md`         | ✅ coverage-controls.spec.ts:145 | Scheduler-worker cron 5min                             |
| SC-09 | Deadline endDate             | 🟢 OK          | `SC-09-deadline-enddate.md`            | ✅ coverage-controls.spec.ts:169 | ⚠️ Granularité 24h (cron daily)                        |
| SC-10 | Recurring cron               | 🟢 OK          | `SC-10-recurring-cron.md`              | ✅ coverage-controls.spec.ts:183 | Repeatable BullMQ jobId déterministe                   |
| SC-11 | Sequential villes            | 🟢 OK          | `SC-11-sequential-villes.md`           | ⚠️ partial                       | currentCityIndex atomic increment                      |
| SC-12 | Parallel villes              | 🟢 OK          | `SC-12-parallel-villes.md`             | ✅ coverage-controls.spec.ts:138 | Random sampling uniforme                               |
| SC-13 | guide_pilier (= blog_pillar) | 🟡 PARTIAL     | `SC-13-blog-pillar.md`                 | ❌                               | TOC côté page render, pas generator                    |
| SC-14 | landing_ville                | 🟡 PARTIAL     | `SC-14-landing-ville.md`               | ❌                               | LocalBusiness manquant + "villes proches" pas rendu    |
| SC-15 | blog_from_keywords           | 🟢 OK          | `SC-15-blog-from-keywords.md`          | ✅ E2E blog-article.spec.ts:24   | Gold standard                                          |
| SC-16 | blog_from_title              | 🟢 OK          | `SC-16-blog-from-title.md`             | ✅ E2E shared                    | Titre exact forcé post-sanitize                        |
| SC-17 | blog_from_rss                | 🟡 PARTIAL     | `SC-17-blog-from-rss.md`               | ❌                               | Manon + byline absents (intentionnel ?)                |
| SC-18 | qa_derived                   | 🟡 PARTIAL     | `SC-18-qa-derived.md`                  | ❌                               | AuthorByline absent FAQ                                |
| SC-19 | comparison                   | 🟡 PARTIAL     | `SC-19-comparison.md`                  | ❌                               | Manon absente (neutralité), `<table>` gate OK          |
| SC-20 | Boucle improve               | 🟢 OK          | `SC-20-boucle-improve.md`              | ❌ V1 livré 2026-05-21           | D2 cap respecté                                        |
| SC-21 | REJECT-P0 SIREN              | 🟢 OK          | `SC-21-reject-p0-siren.md`             | ✅ llm-judge.spec.ts             | Telegram INCIDENT escalade                             |
| SC-22 | quarantined_factcheck        | 🟢 OK          | `SC-22-quarantined-factcheck.md`       | ✅ factcheck-gate.test.ts        | ⚠️ 2 seuils (50 quarantine / 40 publish)               |
| SC-23 | Cap journalier               | 🟢 OK          | `SC-23-cap-journalier.md`              | ✅ throttle.spec.ts              | Redis INCR atomique + drip window                      |
| SC-24 | Pause/Resume                 | 🟢 OK          | `SC-24-pause-resume.md`                | ✅ pause-campaign-b2.spec.ts     | ⚠️ split-brain edge case                               |
| SC-25 | Multi-targets V-01           | 🟢 OK          | `SC-25-multi-targets.md`               | ⚠️ partial                       | Cascade ISR hubs ville                                 |
| SC-26 | IndexNow + sitemaps          | 🟡 PARTIAL     | `SC-26-indexnow-sitemap.md`            | ❌                               | 🔴 sitemap-news.xml MANQUANT                           |
| SC-27 | Rotation liens externes      | 🟡 PARTIAL     | `SC-27-liens-externes-rotation.md`     | ✅ injector.test.ts              | 🔴 usageCount jamais incrémenté + FK orpheline         |
| SC-28 | Image hero / zéro DALL-E     | 🟢 OK          | `SC-28-image-hero-no-dalle.md`         | ⚠️ helper testable               | Règle absolue stricte                                  |
| SC-29 | Cost cap kill-switch         | 🟢 OK          | `SC-29-cost-cap.md`                    | ❌                               | Cascade idempotent + audit trail 50                    |
| SC-30 | Cleanup                      | 🟢 OK + ⚪ N/A | `SC-30-cleanup.md`                     | N/A                              | Ordre DELETE correct ; aucune donnée TEST*E2E*\* créée |

## Synthèse comptage

| Verdict                | Count | %   |
| ---------------------- | ----- | --- |
| 🟢 OK (code)           | 22    | 73% |
| 🟡 PARTIAL (code)      | 8     | 27% |
| 🔴 KO (code)           | 0     | 0%  |
| ⚪ N/A runtime (SC-30) | 1     | —   |

**Score : 22/30 OK** (73%) — **8/30 PARTIAL** (gaps mineurs / intentionnels à valider Will)

## Tests vitest présents

- 11/30 scénarios couverts par au moins 1 test vitest dédié
- 19/30 scénarios sans test dédié (mais couverts implicitement par tests transversaux ou E2E shared)

## Gaps P0/P1 priorisés

### 🔴 P0 (bloquant SEO)

1. **SC-26** : `sitemap-news.xml` route handler manquant → Googlebot News aveugle aux nouvelles publications
2. **SC-27** : `usageCount` jamais incrémenté → rotation liens externes ne se matérialise pas

### 🟡 P1 (gap fonctionnel)

3. **SC-14** : LocalBusiness JSON-LD non émis par landing-ville generator (SEO local Will)
4. **SC-14** : Section "villes proches" extraite mais pas rendue HTML
5. **SC-09** : Granularité deadline-checker = quotidienne (incompatible test 10 min)
6. **SC-27** : FK `ExternalLinkUsage.externalLinkId` manquante (orphelins possibles)

### 🟢 P2 (drift brand voice à valider Will)

7. **SC-07, SC-17, SC-19** : Persona Manon absente intentionnellement de blog_from_rss + comparison (neutralité journalistique vs brand voice)
8. **SC-14, SC-17, SC-18, SC-19** : AuthorByline absent landing / actualites / faq / comparison (vs blog)

### ℹ️ P3 (polish)

9. **SC-22** : 2 seuils fact-check (50 quarantine / 40 publish) — à documenter clairement
10. **SC-23** : Status `awaiting_publish_slot` implicite (à formaliser)
11. **SC-24** : Pas de transaction 2-phase Prisma+BullMQ (split-brain edge case)
