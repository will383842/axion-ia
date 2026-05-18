# 02 — VERDICT GLOBAL — Score /1200 (12 types × 100)

> Verdict pondéré couvrant 12 types de contenu + 7 cross-cuttings infrastructure.
> Baseline CI : typecheck exit 0 ✅ — vitest **1083 / 1086** (1 fail snapshot admin-nav 36→37 + 2 skipped).
> HEAD audit : `9c1adaa` (snapshot pris au démarrage) — drift externe `c33a831` apparu durant audit (commit hors content-gen par session parallèle Manon, sans impact sur findings).

---

## 0. Verdict synthétique

```
SCORE GLOBAL CONTENT TYPES : 746 / 1200 (62.2 %)  → 🟡 SPRINT CORRECTIF
```

```
SCORE INFRASTRUCTURE (cross-cuttings) : 513 / 700 (73.3 %) → 🟡 SOLIDE AVEC GAPS P1
```

```
SCORE PONDÉRÉ COMBINÉ (60% types + 40% infra) : 66.6 % → 🟡 SPRINT CORRECTIF NÉCESSAIRE
```

**Interprétation Will-readable** :

- La **plomberie technique** (workers, monitoring, sécurité, indexation) tient debout. 🟢
- Les **contenus eux-mêmes** sont massivement à l'état d'ébauche : 5 generators sur 11 sont des stubs, 2 types entiers sont des "coquilles vides" (par-fonction = 0, guides hub = 0), et seule **1 ville sur 2157** dispose d'un copy gold standard (Paris).
- Aucun problème bloquant **catastrophique** identifié, mais ~120-150 % d'effort à investir avant de pouvoir affirmer "Axion-IA produit du contenu de qualité à l'échelle Top 50 villes France".

---

## 1. Score par type de contenu (12 × /100)

| #   | Type                        | Score      | Status | Justification courte (1 ligne)                                                                                          |
| --- | --------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Articles blog factory       | **62/100** | 🟡     | 5 generators sur 6 sont stubs délégués à landing-ville ; pipeline publish OK ; 0 test generators                        |
| 2   | Actualités RSS              | **58/100** | 🟡     | Parser regex naïf (no Atom 1.0) ; sources en `ContentGenConfig` JSON (pas de table) ; lifecycle worker correct ; 0 test |
| 3   | Landing villes 4 verticales | **78/100** | 🟢/🟡  | 4 routes existantes + variants + soft-404 gate testé ; 1 ville Tier-1 / 2157 = 0.05 % couverture                        |
| 4   | KB entries V4               | **78/100** | 🟡     | Pipeline ingest tests + KB V4 livré ; mode vector stubbed V1 ; 0 test feeder/health/api                                 |
| 5   | Cas concrets                | **72/100** | 🟡     | 5 fixtures TS ; bug `geo:` manquant → bandeau ville silencieux ; datePublished hardcodé                                 |
| 6   | FAQ items                   | **70/100** | 🟡     | Generators stubs ; qa-extract réel ; sitemap legacy ignore tier_1 DB ; 0 test pipeline                                  |
| 7   | Comparaisons & Guides       | **52/100** | 🟠     | guide-pilier correct ; **/guides hub INEXISTANT** ; comparison.ts STUB ; 0 test                                         |
| 8   | Presse newsroom             | **71/100** | 🟡     | /presse OK + 4 JSON-LD ; **/presse/[slug] INEXISTANT** ; sitemap-news ignore press.ts                                   |
| 9   | Stack IA                    | **78/100** | 🟢     | Doctrine 11 outils + ItemList SoftwareApplication ; **/stack-ia/[tool] INEXISTANT** ; 0 test parity                     |
| 10  | Par-fonction                | **0/100**  | 🔴     | **100 % gap** : aucune route, data, modèle, generator, sitemap. Décision business Will requise                          |
| 11  | Glossaire IA                | **55/100** | 🟠     | /glossaire index OK + DefinedTermSet ; **/glossaire/[slug] INEXISTANT** ; 12 termes (vs 60+ cible)                      |
| 12  | Centre d'aide               | **72/100** | 🟡     | 3 routes vivantes + JSON-LD + alternate markdown ; **bug silencieux admin DB ≠ public hardcode**                        |

**Total = 62+58+78+78+72+70+52+71+78+0+55+72 = 746 / 1200 (62.2 %)**

Verdict types : 🟡 SPRINT CORRECTIF

---

## 2. Score infrastructure (cross-cuttings, /100 chacun)

| Cross-cutting                 | Score      | Status | Top gap                                                                                                            |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Workers BullMQ (08)           | **84/100** | 🟢     | 0/16 Sentry capture ; 2 workers sans kill-switch ; 1/16 tests                                                      |
| Admin UI content-gen (09)     | **78/100** | 🟡     | /settings/providers sans rate-limit + audit log ; templates/author sans audit log SOC2                             |
| Monitoring observabilité (10) | **81/100** | 🟢     | SENTRY_RELEASE jamais exporté CI ; helpers Telegram dormants ; quality-improver bypass logStep                     |
| Indexation discovery (11)     | **84/100** | 🟢     | Yandex Webmaster client absent ; soumissions sitemap GSC/Bing à vérifier humainement                               |
| Villes/Dépts/Régions (05)     | **42/100** | 🟠     | 0.05 % couverture Tier-1 ; pages département dédiées INEXISTANTES                                                  |
| Croisements 12× (06)          | **82/100** | 🟡     | 8.2 hub ville n'appelle pas `getBlogArticlesByVille` ; 8.9 coverage.ts bypass rate-limit ; 8.12 tombstone soft-410 |
| Tests inventory (07)          | **62/100** | 🟡     | 1/25 workers testé ; 0 test publish-worker (hotfix mentionedCities non couvert) ; 0 E2E /un-a-un                   |

**Total = 84+78+81+84+42+82+62 = 513 / 700 (73.3 %)**

Verdict infra : 🟡 SOLIDE AVEC GAPS P1

---

## 3. P0 (critiques bloquants)

| ID   | Description                                                                                                        | Source           | Effort fix                |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------- |
| P0-1 | `/settings/providers` Server Actions sans rate-limit ni audit log (chokepoint financier : caps mensuels, clés API) | 09-ADMIN-UI §2.7 | 1h                        |
| P0-2 | `admin-nav.test.ts:7` snapshot rouge baseline CI (36→37 attendu, reçu 37 mais code dit 36)                         | 07-TESTS §2      | 30s                       |
| P0-3 | Type 10 par-fonction = 100 % inexistant (décision business : créer ou retirer du roadmap)                          | 21-TYPE-10       | décision Will             |
| P0-4 | `/guides/page.tsx` inexistant → factory guides orphelins (drainage SEO inutile)                                    | 18-TYPE-7 §8     | 4h scaffold               |
| P0-5 | Centre d'aide bug silencieux : admin écrit en DB, public lit hardcode `HELP_ARTICLES`                              | 23-TYPE-12       | 6h refactor reader unifié |

---

## 4. P1 (à traiter Sprint S+3 dès validation Will)

| ID    | Description                                                                                             | Source        | Effort                     |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------- | -------------------------- |
| P1-1  | Hub ville `[ville]/page.tsx` n'appelle PAS `getBlogArticlesByVille()` → articles content-gen invisibles | 06 §8.2       | 30 min                     |
| P1-2  | `coverage.ts:252` bypass `prisma.contentGenConfig.upsert` (skip rate-limit + audit log)                 | 06 §8.9       | 15 min                     |
| P1-3  | Tombstone "soft-410" (HTTP 200 + meta noindex) au lieu de vrai 410 HTTP                                 | 06 §8.12      | 4-6h (middleware Edge)     |
| P1-4  | 0/16 Sentry capture dans workers BullMQ                                                                 | 08 §0         | 4h (1h × 4 patches sample) |
| P1-5  | SENTRY_RELEASE jamais exporté GH Actions → toutes errors agrégées même tag                              | 10 §4         | 30 min                     |
| P1-6  | 2 helpers Telegram dormants (`alertCostCap100` + `alertProviderDown30min`)                              | 10 §3         | 1h                         |
| P1-7  | Yandex Webmaster client absent (YandexBot allow seul ne suffit pas)                                     | 11 §8         | 4-6h                       |
| P1-8  | Templates/author Server Actions sans audit log SOC2                                                     | 09 §2         | 1h                         |
| P1-9  | RSS parser regex naïf ne supporte pas Atom 1.0 (sources Atom-only invisibles)                           | 13-TYPE-2 §7  | 4h (lib `fast-xml-parser`) |
| P1-10 | FAQ sitemap V1 ignore Q/R DB tier_1 (regresion AEO)                                                     | 17-TYPE-6 §8  | 1h                         |
| P1-11 | `/stack-ia/[tool]` inexistant → pas de Product schema détaillé                                          | 20-TYPE-9 §8  | 8h scaffold 11 outils      |
| P1-12 | `/presse/[slug]` inexistant → communiqués sans URL canonique                                            | 19-TYPE-8 §8  | 6h scaffold + sitemap      |
| P1-13 | `/glossaire/[slug]` inexistant → -30 % citabilité AEO/GEO estimée                                       | 22-TYPE-11 §8 | 6h scaffold + 60 termes    |
| P1-14 | Volume DB GenerationLog / AuditLog / WebVitalSample / CostLedger : 4 SQL count à lancer prod            | 10 §1         | 5 min Will                 |

---

## 5. P2 (Sprint S+4 ou plus tard)

| ID   | Description                                                                                    | Effort             |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------ |
| P2-1 | Quality-improver bypass logStep canonical (3 lignes prisma.generationLog.create direct)        | 1h                 |
| P2-2 | Speakable cssSelector ↔ HTML drift mineur sur 2 pages                                          | 2h                 |
| P2-3 | RSS sources stockées en `ContentGenConfig` JSON (pas de table dédiée `RssSource`)              | 6h migration       |
| P2-4 | Helpers manquants : `getVillesByDepartement(code)`, `getRegionByDepartement(code)`             | 1h                 |
| P2-5 | Cas concrets : 5 fixtures TS au lieu de Prisma (TODO Sprint 15)                                | 12h migration      |
| P2-6 | Cas concrets : champ `geo:` absent sur 5 fixtures → `getNearbyCases` toujours vide             | 30 min ajout coord |
| P2-7 | Cas concrets : `datePublished: "2026-05-01"` hardcodé identique 5 cas                          | 5 min              |
| P2-8 | Sanitization HTML manquante sur Q/R FAQ extraite (XSS potentielle si article parent contaminé) | 1h                 |
| P2-9 | EN placeholder = FR sur FAQ extraction (bombe à retardement si EN ré-ouvert)                   | 30 min             |

---

## 6. P3 (V2 ou backlog)

| ID   | Description                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| P3-1 | Sentry PII scrub regex IPv4 only → IPv6 passeraient en clair                                                          |
| P3-2 | Variant `focus_dirigeants` un-a-un Sprint S+3 (5 fichiers à toucher)                                                  |
| P3-3 | Refactor `landingVilleGenerator` pour gérer input sans `villeSlug` (path generators FAQ squelettes throwent)          |
| P3-4 | Pages département dédiées V2 (`/implantations/[region]/[departement]/page.tsx`) — gain pSEO "audit IA Hauts-de-Seine" |
| P3-5 | Sprint Glossaire V2 (60 termes + détail + mesh) — ~32h                                                                |
| P3-6 | Sprint Centre d'aide V2 (unification reader DB) — ~20h                                                                |

---

## 7. Anti-régression CI baseline

| Check             | Résultat                                    | Note                                             |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| `pnpm typecheck`  | exit 0 ✅                                   | baseline propre                                  |
| `pnpm vitest run` | 1083 passed / 1 failed / 2 skipped sur 1086 | snapshot drift `admin-nav` 36→37 (P0-2, fix 30s) |
| Pre-commit hooks  | non testés (audit-only)                     | hors scope                                       |
| ESLint            | non re-run (baseline `bde935e` = 0/0)       | confirmé via mémoire                             |

---

## 8. Verdict final

> **🟡 SPRINT CORRECTIF S+3 NÉCESSAIRE**
>
> Score pondéré **66.6 %** (746/1200 contenus + 513/700 infra).
> Plomberie technique solide, contenus à industrialiser massivement.
>
> 5 P0 + 14 P1 + 9 P2 + 6 P3 = **34 actions** roadmap.
> Estimation effort total : ~120-150h dev + décisions Will sur 3-5 sujets business.
>
> **À déclencher après revue Will** : prompt Sprint S+3 EXECUTION séparé.

---

**Fin 02-VERDICT-GLOBAL.md.**
