# Audit Web Vitals Perfection 2026 — Roadmap V1 → V6

**Date** : 2026-05-08
**Score baseline** : 1 062,5 / 2 250 (47,2 %)
**Score cible final** : 2 200+ / 2 250 (97,7 %+) après les 6 vagues
**Aucun patch appliqué — attente `GO PATCHES V1`**

---

## Vue d'ensemble séquencement

```
V1 (1j dev)         V2 (1-2j)         V3 (2j+1j ops)      V4 (3-4j)         V5 (1j+ops Will)    V6 (1-2j)
quick wins ──────► lazy + INP + RUM ► Hetzner stack ────► PPR + Compiler ► CF + monitoring ──► polish premium
+13 % score        +11 % score       +7 % score           +9 % score        +7 % score          +4 % score
~1 350/2 250       ~1 600/2 250      ~1 750/2 250         ~1 950/2 250      ~2 100/2 250        ~2 200/2 250

Pré-requis OPS Will :
                                     [Hetzner CX32          [ADR 0011 PPR    [Cloudflare DNS
                                      provisioning]          + 0012 Compiler]   active]
```

---

## V1 — Quick wins XS / S code-only (1 jour dev)

**Cible** : 1 062 → ~1 350 / 2 250 (+13 %)
**Pas de STOP & ASK — exécution directe possible** (sauf P-013 / P-105 / P-107 décisions micro à acter dans le commit)
**Effort** : 1 journée dev (2-3 h actives + verifications)
**Pré-requis** : aucun

### Patches inclus (27)

| Ordre | Patch                                                          | Agent | Effort  | Gain                        |
| ----- | -------------------------------------------------------------- | ----- | ------- | --------------------------- |
| 1     | P-302 `output: "standalone"`                                   | 4     | XS      | image −30 MB                |
| 2     | P-310 `Vary: rsc` header                                       | 4     | XS      | CDN compat                  |
| 3     | P-311 Cache-Control overrides per route                        | 4     | XS      | TTFB CDN                    |
| 4     | P-508 `productionBrowserSourceMaps: false` explicite           | 6     | XS      | clarté config               |
| 5     | P-400 `serverExternalPackages`                                 | 5     | XS      | préventif                   |
| 6     | P-410 motion → CSS+IO (`FadeInOnView` refactor)                | 5     | S       | **−30 KB gz × 4 562 pages** |
| 7     | P-403 Sentry Replay 0 % + lazy SDK                             | 5     | M       | **−20 KB gz × 4 562 pages** |
| 8     | P-001 Préload Manrope hero font                                | 1     | XS      | LCP −150 ms p75             |
| 9     | P-105 Renommer `--font-serif` → `--font-fraunces`              | 2     | XS      | fix bug cascade             |
| 10    | P-107 `axes: ['opsz']` Fraunces                                | 2     | XS      | rendu serif                 |
| 11    | P-205 `prefers-reduced-motion` `::view-transition-*` anticipé  | 3     | XS      | a11y                        |
| 12    | P-200 StickyMobileCta rAF + throttle                           | 3     | XS      | INP −20-40 ms mobile        |
| 13    | P-202 BookingCalendar autosave debounce 400 ms                 | 3     | XS      | INP −30-80 ms / keystroke   |
| 14    | P-509 `console.warn` stubs gated NODE_ENV                      | 6     | S       | BP +2 pts Lighthouse        |
| 15    | P-503 Doctrine `AGENTS.md` perf budget                         | 6     | XS      | gouvernance                 |
| 16    | P-303 `/api/vitals` runtime Node + Zod + ndjson                | 4     | M       | RUM utilisable              |
| 17    | P-304 `WebVitals.tsx` payload enrichi                          | 4     | S       | RUM utile                   |
| 18    | P-500 WebVitals payload enrichi (consolide P-304)              | 6     | doublon | —                           |
| 19    | P-013 Speculation Rules ciblées Top 15                         | 1     | XS      | bandwidth + INP             |
| 20    | P-009 Gate CI taille images source                             | 1     | XS      | préventif                   |
| 21    | P-012 Vérifier `modulepreload` manifest                        | 1     | XS      | diagnostic                  |
| 22    | P-015 `fetchPriority` JS critiques                             | 1     | XS      | LCP −20 ms                  |
| 23    | P-109 Audit `<head>` post-build                                | 2     | XS      | diag                        |
| 24    | P-404 Migration `next experimental-analyze`                    | 5     | S       | diag debloqué               |
| 25    | P-501 Lighthouse CI mobile preset + retire `continue-on-error` | 6     | M       | gate complet                |
| 26    | P-314 Doublon P-501                                            | 4     | doublon | —                           |
| 27    | P-406 Doublon P-501                                            | 5     | doublon | —                           |

### Validation V1

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm next experimental-analyze --output  # remplace bundle:analyze
pnpm lhci collect --preset=desktop
pnpm lhci collect --preset=mobile  # nouveau via P-501
```

Cible mesurable :

- First Load home : 1 022 KB → ~870 KB uncompressed (−15 %, −50 KB gz)
- Lighthouse home : 81 → ~88 (Perf), 88 → ~92 (A11y), 92 → ~96 (BP +console gating)
- Bundle analyzer rapport archivé `_AUDIT/bundle-analyze-V1.html`

### Commit V1

```
perf(web-vitals): V1 quick wins — bundle −50KB gz, INP −90ms, RUM enrichi

- motion → CSS+IO (FadeInOnView)
- Sentry Replay 0% prod
- WebVitals payload route+locale+connection+deviceMemory
- /api/vitals runtime Node.js + Zod + persistance ndjson
- Speculation Rules ciblées Top 15
- 27 patches V1, voir _AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md

Score audit : 1 062 → ~1 350 / 2 250 (+13 %)
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## V2 — Lazy loading + INP + RUM persistance (1-2 jours dev)

**Cible** : ~1 350 → ~1 600 / 2 250 (+11 %)
**Pas de STOP & ASK majeur — exécution directe**
**Pré-requis** : V1 mergé + Lighthouse smoke V1 publié

### Patches inclus (18)

| Ordre | Patch                                                           | Agent | Effort  | Gain                    |
| ----- | --------------------------------------------------------------- | ----- | ------- | ----------------------- |
| 1     | P-401 Lazy BookingCalendar `dynamic()`                          | 5     | S       | **−50 KB gz /reserver** |
| 2     | P-007 Doublon P-401                                             | 1     | doublon | —                       |
| 3     | P-201 BookingCalendar `useTransition` autour `pickOpt`          | 3     | S       | INP −60-120 ms          |
| 4     | P-203 BookingCalendar `useMemo` grilles dérivées                | 3     | XS      | INP −10-20 ms           |
| 5     | P-204 HeaderImplantationsMenu pointer events                    | 3     | XS      | INP −5 ms               |
| 6     | P-101 `loading.tsx` granulaire `/reserver` (gros gain CLS)      | 2     | S       | CLS −0,02-0,04          |
| 7     | P-100 `loading.tsx` granulaire home                             | 2     | S       | CLS −0,01-0,03          |
| 8     | P-102 `loading.tsx` granulaires 4 pages strat                   | 2     | M       | CLS −0,05 cumul         |
| 9     | P-104 `loading.tsx` granulaires `/implantations/*`              | 2     | S       | CLS −0,02               |
| 10    | P-306 8 `loading.tsx` granulaires (consolide P-100/101/102/104) | 4     | M       | streaming               |
| 11    | P-307 Suspense boundary BookingCalendar (préparation PPR)       | 4     | S       | streaming               |
| 12    | P-002 `Illustration` `loading="eager"` + `fetchPriority="high"` | 1     | S       | LCP −100 ms             |
| 13    | P-003 `placeholder="blur"` + `blurDataURL` `Illustration`       | 1     | S       | CLS −0,01 + UX          |
| 14    | P-008 Doublon P-003                                             | 1     | doublon | —                       |
| 15    | P-004 `<link rel="preload">` head ressources LCP                | 1     | S       | LCP −80-150 ms          |
| 16    | P-405 `size-limit` per-route budgets                            | 5     | S       | gate CI                 |
| 17    | P-407 GitHub Action bundle delta gate                           | 5     | S       | gate CI                 |
| 18    | P-507 `pnpm audit` gate Gate B + retire `\|\| true` nightly     | 6     | S       | sécurité                |

### Validation V2

- Lighthouse `/reserver` : Perf 66 → ~88, **CLS 0,552 → 0** (cible interne)
- INP `/reserver` : estimé −90 à −200 ms p75
- Bundle `/reserver` : 942 KB → ~700 KB uncompressed (−25 %, −80 KB gz)

---

## V3 — Stack Hetzner Caddy + Dockerfile + standalone (2 jours dev + 1 jour ops)

**Cible** : ~1 600 → ~1 750 / 2 250 (+7 %)
**Pré-requis** :

- VPS Hetzner CX32 provisionné (€6,49/mois HT)
- Compte Cloudflare DNS basculé sur Hetzner
- Coolify ou Docker Compose installés sur Hetzner

### Patches inclus (6 dev + ops)

| Ordre | Patch                                                                       | Agent | Effort | Gain                   |
| ----- | --------------------------------------------------------------------------- | ----- | ------ | ---------------------- |
| 1     | P-300 `Caddyfile` complet (Brotli + zstd + gzip + HTTP/3 + 103 EH + cache)  | 4     | M      | TTFB −300-500 ms p75   |
| 2     | P-301 Dockerfile multi-stage standalone node:22-alpine                      | 4     | M      | image < 280 MB         |
| 3     | P-305 `/api/healthz/route.ts` (nouveau)                                     | 4     | XS     | Caddy/Docker readiness |
| 4     | P-313 `X-Accel-Buffering: no` (vérification streaming)                      | 4     | XS     | streaming              |
| 5     | P-409 `compress: true` Next → false (anti-double-compression Caddy)         | 5     | XS     | économie CPU Hetzner   |
| 6     | P-010 Migrer `<img>` natifs `TeamGrid` + `PressSpokesperson` → `next/image` | 1     | M      | LCP −80 ms +CLS        |

### Ops Will pour V3

1. Provisionner CX32 Hetzner (Console Hetzner Cloud)
2. Installer Coolify (one-click installer Hetzner ou docker-compose)
3. Configurer DNS Cloudflare → IP Hetzner (proxy ON)
4. Push image Docker via GitHub Actions ou registry interne
5. Première mise en ligne `axionia.eu` derrière Cloudflare → Hetzner
6. `curl -I --http3 https://axionia.eu/fr` doit retourner `HTTP/3 200` + `content-encoding: br`
7. Lighthouse run depuis IP externe via WebPageTest free → benchmark TTFB réel

### Validation V3

- TTFB p75 mesuré : 210 ms (local Windows) → ~50-90 ms p75 (Cloudflare POP Paris → Hetzner Falkenstein)
- Lighthouse Perf home : ~88 → ~95-98
- HTTP/3 + Brotli confirmés via `curl --http3` + DevTools
- `Caddyfile` + `Dockerfile` + `.github/workflows/deploy.yml` commités

---

## V4 — PPR + React Compiler 19 (3-4 jours dev) ⚠️ STOP & ASK ×2

**Cible** : ~1 750 → ~1 950 / 2 250 (+9 %)
**Pré-requis ABSOLU** :

- ADR 0011 (PPR) écrit + validé Will
- ADR 0012 (Compiler) écrit + validé Will
- V3 mergée et déployée Hetzner

### STOP & ASK 1 — React Compiler 19 (P-220)

**Question** : activer `experimental.reactCompiler: true` + `babel-plugin-react-compiler` devDep + `eslint-plugin-react-compiler` ?

**Recommandation Agent 3** : oui, V4 (pas Sprint 17). Coût build +10-25 % cold acceptable, gain INP −15-30 % auto sur hot spots.

**Conditions Go** : Will valide ADR 0012 + autorise `pnpm add -D babel-plugin-react-compiler eslint-plugin-react-compiler`.

### STOP & ASK 2 — PPR `incremental` (P-308)

**Question** : activer `experimental.ppr: "incremental"` + `experimental_ppr = true` opt-in sur `/reserver` ?

**Recommandation Agent 4** : oui mais opt-in route-by-route. Commencer `/reserver` (gros bénéfice pour calendrier dynamique), puis évaluer extension Top 15 page-par-page.

**Conditions Go** : Will valide ADR 0011 + Suspense boundaries V2 mergées (P-307 condition).

### Patches inclus (4 dev)

| Ordre | Patch                                                                             | Agent | Effort | Gain                            |
| ----- | --------------------------------------------------------------------------------- | ----- | ------ | ------------------------------- |
| 1     | P-220 ⚠️ React Compiler 19 + ADR 0012 + dependencies                              | 3     | M      | INP −15-30 % auto sur hot spots |
| 2     | P-308 ⚠️ PPR `incremental` + opt-in `/reserver` + ADR 0011                        | 4     | L      | TTFB shell instantané           |
| 3     | P-209 AuditRequestForm `useReducer` (couvert partiellement par Compiler)          | 3     | M      | INP −20 ms                      |
| 4     | P-221 ⚠️ View Transitions — refus motivé Sprint 14 + ADR 0013 (decision-recorded) | 3     | XS doc | preserve doctrine               |

### Validation V4

- Build time impact mesuré (cold + warm) : +10-25 % attendu acceptable
- INP `/reserver` : V2 amélioré ~110-220 ms → V4 ~80-150 ms p75
- TTFB shell `/reserver` : ~50 ms → ~10-20 ms (PPR cache POP)
- Tests vitest verts (régression pattern check)
- Doctrine v3 visuelle inchangée (preuve : screenshots before/after sur 15 pages strat)

---

## V5 — Cloudflare config + monitoring + ADR (1 jour dev + ops Will)

**Cible** : ~1 950 → ~2 100 / 2 250 (+7 %)

### STOP & ASK 3 — Cloudflare config (P-309)

**Question** : appliquer cache rules CF + Brotli + Early Hints + DNSSEC + Bot fight ?

**Recommandation Agent 4** : pair-programming session avec Will. 7 étapes dashboard, 30-45 min.

### Patches inclus (6)

| Ordre | Patch                                                                  | Agent | Effort       | Gain                |
| ----- | ---------------------------------------------------------------------- | ----- | ------------ | ------------------- |
| 1     | P-309 ⚠️ Cloudflare cache rules + Brotli + EH + DNSSEC                 | 4     | S (ops Will) | LCP −100-400 ms p75 |
| 2     | P-011 Préconnect Plausible self-hosted (Sprint 23 anticipation)        | 1     | XS           | LCP −30 ms          |
| 3     | P-505 ADR 0010 Web Vitals 2026 (squelette)                             | 6     | S            | doc gouvernance     |
| 4     | P-506 CrUX snapshot mensuel script + GHA cron                          | 6     | M            | monitoring 28j      |
| 5     | P-504 Runbook `docs/runbooks/page-lente.md`                            | 6     | S            | ops                 |
| 6     | P-315 ADR 0011 PPR + ADR 0014 Hetzner stack (renumérotage cohérent V5) | 4     | S            | doc                 |

### Validation V5

- Lighthouse field data CrUX p75 28j : LCP ≤ 1 800 ms vert sur 95 %+ origines
- Snapshot CrUX archivé `_AUDIT/crux-2026-06.json`
- ADR 0010-0014 commités dans `docs/adr/`
- Runbook accessible Will

---

## V6 — Polish premium + RUM custom optionnel (1-2 jours dev) ⚠️ STOP & ASK

**Cible** : ~2 100 → ~2 200 / 2 250 (+4 %)

### STOP & ASK 4 — Sentry direction long terme (P-415)

**Question V6** : maintenir SDK complet (~150 KB gz, free tier 10K events/mois) OU migrer vers loader script Sentry (lazy 80 % SDK) OU RUM custom Hetzner-pure (0 KB Sentry — pure POST `/api/vitals` + dashboard `/admin/pseo-stats` Sprint 20) ?

**Recommandation Agent 5** : 3 options chiffrées, **garder décision pour après Sprint 20** quand le dashboard custom est livré et que Will peut comparer le ROI Sentry vs custom.

### STOP & ASK 5 — Cleanup deps non utilisées (P-411)

**Question** : `pnpm rm @tiptap/pm @tiptap/react @tiptap/starter-kit next-auth @tanstack/react-query zustand` ?

**Recommandation Agent 5** : Will doit confirmer si Sprint 17+ va les utiliser (auth NextAuth, query React Query, state Zustand, éditeur TipTap pour `/blog/[slug]/admin`) OU si dette à nettoyer maintenant.

### Patches inclus (10)

| Ordre | Patch                                                | Agent | Effort | Gain                     |
| ----- | ---------------------------------------------------- | ----- | ------ | ------------------------ |
| 1     | P-411 ⚠️ Cleanup deps inutilisées (à valider Will)   | 5     | XS     | maintenance              |
| 2     | P-413 Namespacer `next-intl` (split FR/EN client)    | 5     | M      | −15 KB gz                |
| 3     | P-412 Zod côté server uniquement                     | 5     | M      | −22 KB gz                |
| 4     | P-110 Inconsolata `preload: false` si trop d'outputs | 2     | XS     | LCP −20 ms               |
| 5     | P-006 Audit `globals.css` critique vs non-critique   | 1     | M      | LCP −50 ms               |
| 6     | P-014 Service Worker offline-first (PWA bonus)       | 1     | L      | offline + Lighthouse PWA |
| 7     | P-402 Lazy TipTap éditeur (préventif Sprint 17+)     | 5     | S      | préventif                |
| 8     | P-502 Sentry Replay 0 % par défaut + opt-in env      | 6     | S      | renforce P-403           |
| 9     | P-510 Sentry vitals integration sample 3 %           | 6     | S      | monitoring               |
| 10    | P-415 ⚠️ RUM custom alternative Sentry full          | 5     | L      | **−150 KB gz** si activé |

### Validation V6

- Bundle home First Load : ~870 KB → ~600-700 KB uncompressed (~180-210 KB gz)
- Lighthouse Perf 100 sur 12-15 pages strat / 15 (cible 100/100/100/100)
- CrUX p75 vert sur 100 % des origines (28j post V6)
- ADR 0010-0015 ou plus selon décisions

---

## Critères de validation (passage à la vague suivante)

Chaque vague valide les 3 conditions suivantes avant de passer :

| #   | Critère                                                                                   | Méthode                                              |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `pnpm typecheck && pnpm lint && pnpm build` ✅                                            | local + CI                                           |
| 2   | `pnpm test` (vitest) ✅                                                                   | local + CI                                           |
| 3   | Lighthouse local relancé sur les pages impactées → comparatif before/after dans le commit | `pnpm lhci collect --preset=desktop` + smoke 3 pages |

**V3 ajoute** : déploiement Hetzner staging réussi + benchmark TTFB externe (WebPageTest).
**V4 ajoute** : ADR 0011 + 0012 mergées + screenshots before/after doctrine v3 inchangée.
**V5 ajoute** : Cloudflare config validée par WebPageTest run prod.
**V6 ajoute** : décision Sentry direction prise + cleanup deps validé.

---

## Anti-patterns à éviter pendant les vagues

1. **Ne PAS** dupliquer les `@font-face` Fallback — Next 16 le fait déjà (Anti-patch P-103).
2. **Ne PAS** activer `compress: true` Next + Caddy compress en parallèle (double compression CPU Hetzner).
3. **Ne PAS** activer PPR sur tout d'un coup — opt-in route-by-route (P-308).
4. **Ne PAS** activer View Transitions en V1-V3 (doctrine v3 figée).
5. **Ne PAS** désactiver Speculation Rules sans valider impact en prod (CrUX baseline d'abord).
6. **Ne PAS** ajouter de dep client > 10 KB sans STOP & ASK §8.7.
7. **Ne PAS** commit avant validation Will (§8.10) — applicable à toutes les vagues.

---

**Fin roadmap. Pour exécution V1 → `GO PATCHES V1` (le superviseur exécutera les 27 patches V1 dans l'ordre listé).**
