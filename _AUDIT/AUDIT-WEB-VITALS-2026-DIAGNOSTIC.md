# Audit Web Vitals Perfection 2026 — Diagnostic per-page × per-criterion

**Date** : 2026-05-08
**Méthode** : 6 agents read-only, score 0 / 0,5 / 1 par critère
**Périmètre** : 15 chapitres × 10 critères × 15 pages stratégiques = 2 250 cases
**Score consolidé** : **1 062,5 / 2 250 = 47,2 %**

> Pour le détail des observations par patch, voir les fichiers `_AUDIT/agent-N-*.md`. Ce document agrège le scoring per-chapitre + per-page.

---

## Tableau scoring par chapitre

| Chapitre                      | Score / 150 |          % | Agent   | Fichier détail                            |
| ----------------------------- | ----------: | ---------: | ------- | ----------------------------------------- |
| 1 — Mesure & instrumentation  |        51,5 |       34 % | Agent 6 | `agent-6-monitoring-bp-securite.md`       |
| 2 — LCP                       |          78 |       52 % | Agent 1 | `agent-1-lcp-images-network.md`           |
| 3 — CLS                       |         117 |       78 % | Agent 2 | `agent-2-cls-fonts.md`                    |
| 4 — INP                       |          87 |       58 % | Agent 3 | `agent-3-inp-compiler-viewtransitions.md` |
| 5 — TTFB                      |          48 |       32 % | Agent 4 | `agent-4-ttfb-ppr-cache.md`               |
| 6 — Bundle JS                 |        75,5 |       51 % | Agent 5 | `agent-5-bundle-build.md`                 |
| 7 — Images                    |         100 |       67 % | Agent 1 | `agent-1-lcp-images-network.md`           |
| 8 — Fonts                     |       126,5 |       84 % | Agent 2 | `agent-2-cls-fonts.md`                    |
| 9 — Network hints             |          70 |       47 % | Agent 1 | `agent-1-lcp-images-network.md`           |
| 10 — Streaming & PPR          |          63 |       42 % | Agent 4 | `agent-4-ttfb-ppr-cache.md`               |
| 11 — React Compiler 19        |         7,5 |        5 % | Agent 3 | `agent-3-inp-compiler-viewtransitions.md` |
| 12 — View Transitions         |          75 |       50 % | Agent 3 | `agent-3-inp-compiler-viewtransitions.md` |
| 13 — Caching & headers        |          31 |       21 % | Agent 4 | `agent-4-ttfb-ppr-cache.md`               |
| 14 — Sécurité & BP            |         110 |       73 % | Agent 6 | `agent-6-monitoring-bp-securite.md`       |
| 15 — Monitoring & gouvernance |        22,5 |       15 % | Agent 6 | `agent-6-monitoring-bp-securite.md`       |
| **Total**                     | **1 062,5** | **47,2 %** |         |                                           |

---

## Tableau diagnostic per-page

> Les scores per-page agrègent les 15 critères × 10 = 150 par page. La colonne « First Load uncomp. » provient de `.next/diagnostics/route-bundle-stats.json`.

### Smoke Lighthouse (3 pages mesurées 2026-05-08, desktop preset, 1 run, Windows)

| Page                          | First Load (KB uncomp.) |      Perf | A11y |  BP | SEO |   LCP |          CLS |           TBT |   TTFB |
| ----------------------------- | ----------------------: | --------: | ---: | --: | --: | ----: | -----------: | ------------: | -----: |
| `/fr` (home)                  |                   1 022 |        81 |   88 |  96 |  92 | 1,2 s |        **0** | **300 ms** ⚠️ | 210 ms |
| `/fr/implantations/.../paris` |                     899 | **98** ✅ |   96 |  96 |  92 | 1,1 s |            0 |         60 ms |  20 ms |
| `/fr/reserver`                |                     942 | **66** 🔴 |   91 |  96 |  92 | 1,5 s | **0,552** 🔴 |        210 ms |  30 ms |

### Estimation per-page (heuristique cross-agents)

| #   | Page                                         | First Load (KB) | LCP element           | INP risque   | CLS risque   | Score estimé /150 |
| --- | -------------------------------------------- | --------------: | --------------------- | ------------ | ------------ | ----------------: |
| 1   | `/[locale]` (home)                           |           1 022 | H1 texte hero         | Faible       | Faible       |               ~75 |
| 2   | `/[locale]/interventions`                    |             913 | H1 texte              | Faible       | Faible       |               ~80 |
| 3   | `/[locale]/interventions/essentielle`        |             899 | H1 texte              | Faible       | Faible       |               ~80 |
| 4   | `/[locale]/audit`                            |             915 | H1 texte              | Faible       | Faible       |               ~80 |
| 5   | `/[locale]/audit/flash`                      |             899 | H1 texte              | Faible       | Faible       |               ~80 |
| 6   | `/[locale]/implementation`                   |             915 | H1 texte              | Faible       | Faible       |               ~80 |
| 7   | `/[locale]/cas-concrets`                     |             901 | H1 texte              | Faible       | Faible       |               ~80 |
| 8   | `/[locale]/methodologie`                     |             901 | H1 texte              | Faible       | Faible       |               ~80 |
| 9   | `/[locale]/comparaisons`                     |             901 | H1 texte              | Faible       | Faible       |               ~80 |
| 10  | `/[locale]/stack-ia`                         |             901 | H1 texte              | Faible       | Faible       |               ~80 |
| 11  | `/[locale]/implantations`                    |             887 | H1 texte              | Faible       | Faible       |               ~80 |
| 12  | `/[locale]/implantations/[region]`           |             887 | H1 texte              | Faible       | Faible       |               ~80 |
| 13  | `/[locale]/implantations/.../paris` (pilote) |             899 | H1 texte              | Faible       | Faible       |        **~95** ✅ |
| 14  | `/[locale]/reserver`                         |             942 | BookingCalendar block | **Élevé** 🔴 | **Élevé** 🔴 |               ~50 |
| 15  | `/[locale]/contact`                          |           1 003 | Form heading          | Moyen        | Faible       |               ~75 |

---

## Diagnostic critères transverses

### 🟢 Critères au vert sur 100 % des pages

- **3.1** Images `width`/`height` ou `aspect-ratio` ✅
- **8.1** `next/font/google` self-hosted ✅
- **8.2** `display: swap` ✅
- **8.3** `size-adjust` Fallback (Next 16 default `adjustFontFallback: true` actif) ✅ **DÉCOUVERTE Agent 2**
- **14.2-14.6** Headers de sécurité (HSTS preload, X-Frame DENY, X-Content-Type, Referrer, Permissions-Policy) ✅
- **5.1** Toutes les pages SSG (zéro `force-dynamic` non justifié) ✅

### 🔴 Critères au rouge sur 100 % des pages

- **1.6** Dashboard RUM custom : pas configuré (Sprint 20 prévu)
- **1.10** Long Animation Frames API : non capturé
- **2.2** `<link rel="preload" as="image">` LCP : aucun
- **5.3** 103 Early Hints : pas activé (Caddy/CF non configurés)
- **5.6** Brotli : pas activé en prod (Caddy/CF non configurés)
- **5.9** HTTP/3 : pas activé en prod
- **9.1-9.3** preconnect / dns-prefetch / modulepreload : aucun
- **10.3** Suspense boundaries : aucun dans `src/app/`
- **10.4** `loading.tsx` granulaires : 1 seul global
- **11.1** React Compiler : désactivé (différé Sprint 17)
- **13.1** Cache-Control granulaire : Next default uniquement (pas de Caddy override)
- **13.4** Brotli prod : non activé (cf. 5.6)
- **15.1-15.10** Budget perf documenté, gate CI bundle delta, Lighthouse PR gate, alerting RUM, runbook, snapshot CrUX, ADR : tous absents

### 🟠 Critères mixtes (varient par page)

- **2.5** `loading="lazy"` au-dessus du fold : OK partout sauf vérification `<img>` natifs `TeamGrid` + `PressSpokesperson` (Agent 1 P-010)
- **4.10** INP p75 ≤ 100 ms : OK estimé sur pages SSG pures, **fail sur `/reserver`** (BookingCalendar)
- **6.1** Bundle initial home ≤ 90 KB gz : **fail partout** (~270-310 KB gz estimé)

---

## Smoke Lighthouse — Findings spécifiques

### 🔴 `/reserver` CLS = 0,552

- **Cause probable** : BookingCalendar charge en client (bloquant LCP), puis Dialog modal s'insère → décalage. Combiné aux 28 useState avec render synchrone → layout chassé.
- **Patch ciblé** : P-401 (lazy `dynamic()`) + P-101 (`loading.tsx` réservation espace réelle) + P-307 (Suspense boundary)

### ⚠️ Home Perf 81 (Lighthouse seuil CI 95)

- **Cause** : First Load 1,02 MB → TBT 300 ms (JS parsing/exécution bloquante)
- **Patch ciblé** : P-410 (motion → CSS) + P-403 (Sentry Replay 0 %) + P-001 (font preload)

### ⚠️ A11y home 88 (seuil 95)

- **Cause à creuser** : probable contraste insuffisant sur certains badges (terracotta-soft sur sand) OU labels manquants sur boutons icon-only OU `aria-current` manquant sur navigation
- **Patch** : audit accessibilité dédié (hors périmètre cet audit Web Vitals — hand-off Agent 6 / Sprint a11y dédié)

### ⚠️ SEO 92 sur **toutes** les pages (vs cible 100)

- **Cause à creuser** : audit Lighthouse SEO global qui rate uniformément. Possibilités :
  - `meta description` longueur (trop courte ou trop longue sur certaines pages)
  - `<a>` sans descriptive text (« Lire le cas » répété)
  - `tap targets` mobile size insuffisant
  - `is-crawlable` (mais robots.ts est OK, pas de noindex)
- **Recommandation** : audit SEO Lighthouse dédié (script `scripts/seo-audit.ts` existe — à exécuter et corriger Sprint dédié)

### ⚠️ BP 96 partout (vs cible 100)

- **Cause probable** : 4 pts manquants typiquement
  - `console.warn` stubs forms (P-509 fix)
  - Pas de CSP nonce (Sprint 16 différé)
  - HTTPS forcé pas en local (n'impactera pas la prod)

---

## Mappage patch ↔ critère

> Index inversé : pour chaque critère du prompt §4, quel patch le résout ?

### Chapitre 1 (Mesure & instrumentation)

- 1.1 Lighthouse CI seuils stricts → déjà OK
- 1.2 `useReportWebVitals` actif → ✅ déjà
- 1.3 `/api/vitals` < 50 ms → **P-303**
- 1.4 RUM payload `route` + `locale` + `connection` + `deviceMemory` → **P-500 + P-304**
- 1.5 Logs dev exclus prod → **P-509**
- 1.6 Dashboard RUM alerting → Sprint 20 (hors périmètre)
- 1.7 CrUX snapshot mensuel → **P-506**
- 1.8 Lighthouse mobile preset → **P-501 + P-314**
- 1.9 Bundle-analyzer report archivé → **P-404**
- 1.10 INP per-interaction breakdown LoAF → V6 polish

### Chapitre 2 (LCP)

- 2.1-2.10 → **P-001, P-002, P-004, P-007, P-013, P-014**

### Chapitre 3 (CLS)

- 3.1-3.10 → **P-100, P-101, P-102, P-104, P-103 (anti-patch), P-108**

### Chapitre 4 (INP)

- 4.1-4.10 → **P-200, P-201, P-202, P-203, P-204, P-220 (Compiler)**

### Chapitre 5 (TTFB)

- 5.1-5.10 → **P-300 (Caddy), P-303 (vitals), P-309 (CF), P-310 (Vary), P-311 (cache), P-409 (compress)**

### Chapitre 6 (Bundle)

- 6.1-6.10 → **P-400, P-401, P-403, P-410, P-411, P-412, P-413, P-405, P-407**

### Chapitre 7 (Images)

- 7.1-7.10 → **P-002, P-003, P-008, P-009, P-010**

### Chapitre 8 (Fonts)

- 8.1-8.10 → **P-001, P-105, P-107, P-109, P-110**

### Chapitre 9 (Network hints)

- 9.1-9.10 → **P-004, P-011, P-012, P-013, P-014, P-015**

### Chapitre 10 (Streaming & PPR)

- 10.1-10.10 → **P-306, P-307, P-308 (PPR STOP & ASK), P-313, P-315 (ADR)**

### Chapitre 11 (React Compiler 19)

- 11.1-11.10 → **P-220 (STOP & ASK)** + ADR 0012

### Chapitre 12 (View Transitions)

- 12.1-12.10 → **P-205 + P-221 (refus motivé STOP & ASK)** + ADR 0013

### Chapitre 13 (Caching & headers)

- 13.1-13.10 → **P-300, P-309, P-310, P-311, P-409, P-414**

### Chapitre 14 (Sécurité & BP)

- 14.1-14.10 → **P-507, P-508, P-509** + Sprint 16 CSP nonce (hors périmètre)

### Chapitre 15 (Monitoring & gouvernance)

- 15.1-15.10 → **P-405, P-407, P-501, P-503, P-504, P-505, P-506**

---

## Détail per-agent (pointeurs)

| Agent     | Périmètre chapitres |               Score | Fichier détail                            | Patches                            |
| --------- | ------------------- | ------------------: | ----------------------------------------- | ---------------------------------- |
| Agent 1   | 2 + 7 + 9           |           248 / 450 | `agent-1-lcp-images-network.md`           | P-001 → P-015 (15)                 |
| Agent 2   | 3 + 8               |         243,5 / 300 | `agent-2-cls-fonts.md`                    | P-100 → P-110 (11)                 |
| Agent 3   | 4 + 11 + 12         |         169,5 / 450 | `agent-3-inp-compiler-viewtransitions.md` | P-200 → P-209 + P-220 + P-221 (12) |
| Agent 4   | 5 + 10 + 13         |           142 / 450 | `agent-4-ttfb-ppr-cache.md`               | P-300 → P-315 (16)                 |
| Agent 5   | 6 (+ tooling)       |          75,5 / 150 | `agent-5-bundle-build.md`                 | P-400 → P-415 (16)                 |
| Agent 6   | 1 + 14 + 15         |           184 / 450 | `agent-6-monitoring-bp-securite.md`       | P-500 → P-510 (11)                 |
| **Total** | **15 chapitres**    | **1 062,5 / 2 250** |                                           | **81 patches**                     |

---

**Fin diagnostic.** Pour le détail diff par patch → fichier agent correspondant. Pour le séquencement → `AUDIT-WEB-VITALS-2026-ROADMAP.md`.
