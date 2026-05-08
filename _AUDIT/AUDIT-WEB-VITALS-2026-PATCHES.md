# Audit Web Vitals Perfection 2026 — Index des 81 patches

**Date** : 2026-05-08
**Aucun patch appliqué** — Phase D close, attente `GO PATCHES V1` (ou `V2` / `V3` etc.)

> Ce fichier est l'**index** des 81 patches numérotés. Pour le **détail diff prêt à coller** (old_string / new_string + validation + dépendances), consulte le fichier agent correspondant via le lien.

---

## Légende

- **Effort** : XS (<15 min) / S (<1 h) / M (<3 h) / L (<1 j) / XL (multi-jour)
- **Risque** : Faible / Moyen / Élevé
- **STOP & ASK** : ⚠️ = décision Will requise avant exécution
- **Anti-patch** : 🚫 = patch explicitement refusé après analyse (raison documentée)

---

## Agent 1 — LCP / Images / Network hints (`agent-1-lcp-images-network.md`)

| ID    | Titre                                                                                      | Effort                  | Gain estimé           | Risque | STOP&ASK | Vague |
| ----- | ------------------------------------------------------------------------------------------ | ----------------------- | --------------------- | ------ | -------- | ----- |
| P-001 | Préload Manrope hero font (LCP critique mobile)                                            | XS                      | LCP −150 ms p75       | Faible | non      | V1    |
| P-002 | `Illustration` `loading="eager"` + `fetchPriority="high"` (déprécation `priority` Next 16) | S                       | LCP −100 ms           | Faible | ⚠️ A1    | V2    |
| P-003 | `placeholder="blur"` + `blurDataURL` sur `Illustration`                                    | S                       | CLS −0,01 + UX        | Faible | non      | V2    |
| P-004 | `<link rel="preload">` ressources LCP head (filet Caddy/CF)                                | S                       | LCP −80-150 ms        | Faible | non      | V2    |
| P-005 | `size-adjust` font-fallback declarations                                                   | 🚫 voir P-103 (Agent 2) | —                     | —      | —        | —     |
| P-006 | Audit `globals.css` critique vs non-critique                                               | M                       | LCP −50 ms            | Faible | non      | V6    |
| P-007 | `dynamic()` lazy `BookingCalendar` (`/reserver` LCP critique)                              | S                       | LCP −400 ms /reserver | Faible | ⚠️ A1    | V2    |
| P-008 | `placeholder="blur"` automatique `Illustration` (anti-CLS bitmap)                          | S                       | CLS −0,02             | Faible | non      | V2    |
| P-009 | Gate CI taille images source                                                               | XS                      | préventif             | Faible | non      | V1    |
| P-010 | Migrer `<img>` natifs `TeamGrid` + `PressSpokesperson` → `next/image`                      | M                       | LCP −80 ms +CLS       | Faible | ⚠️ A3    | V3    |
| P-011 | Préconnect Plausible self-hosted (Sprint 23 anticipation)                                  | XS                      | LCP −30 ms            | Faible | non      | V5    |
| P-012 | Vérifier `modulepreload` manifest Next 16                                                  | XS                      | diagnostic            | Faible | non      | V1    |
| P-013 | Speculation Rules ciblées Top 15 + fallback `moderate` global                              | XS                      | bandwidth + INP       | Faible | ⚠️ A2    | V1    |
| P-014 | Service Worker offline-first (V6 polish, optionnel)                                        | L                       | PWA bonus + offline   | Moyen  | non      | V6    |
| P-015 | `fetchPriority` sur fetches JS critiques                                                   | XS                      | LCP −20 ms            | Faible | non      | V1    |

---

## Agent 2 — CLS / Fonts (`agent-2-cls-fonts.md`)

| ID    | Titre                                                                                       | Effort | Gain estimé       | Risque | STOP&ASK | Vague     |
| ----- | ------------------------------------------------------------------------------------------- | ------ | ----------------- | ------ | -------- | --------- |
| P-100 | `loading.tsx` granulaire home                                                               | S      | CLS −0,01-0,03    | Faible | non      | V2        |
| P-101 | `loading.tsx` granulaire `/reserver` (gros gain)                                            | S      | CLS −0,02-0,04    | Faible | non      | V2        |
| P-102 | `loading.tsx` granulaires 4 pages stratégiques (audit/contact/interventions/implementation) | M      | CLS −0,05 cumul   | Faible | non      | V2        |
| P-103 | 🚫 **ANTI-PATCH** : refuser duplication `@font-face` Fallback (Next 16 le fait déjà)        | —      | éviter régression | —      | —        | —         |
| P-104 | `loading.tsx` granulaires `/implantations/*` (Sprint 14.9 pSEO)                             | S      | CLS −0,02         | Faible | non      | V2        |
| P-105 | Renommer `--font-serif` → `--font-fraunces` (casser auto-référence)                         | XS     | fix bug cascade   | Faible | ⚠️ B2    | V1        |
| P-106 | `Inter Tight` retiré ? — N/A non présent                                                    | —      | —                 | —      | —        | —         |
| P-107 | Ajouter `axes: ['opsz']` Fraunces                                                           | XS     | rendu serif       | Faible | ⚠️ B3    | V1        |
| P-108 | Anticipation cookie banner réservation espace                                               | M      | CLS futur         | Faible | ⚠️ B1    | Sprint 16 |
| P-109 | Audit `<head>` post-build pour vérifier preload fonts                                       | XS     | diag              | Faible | non      | V1        |
| P-110 | Inconsolata `preload: false` si trop d'outputs                                              | XS     | LCP −20 ms        | Faible | ⚠️ B4    | V6        |

---

## Agent 3 — INP / React Compiler / View Transitions (`agent-3-inp-compiler-viewtransitions.md`)

| ID    | Titre                                                                   | Effort                 | Gain estimé                       | Risque | STOP&ASK | Vague |
| ----- | ----------------------------------------------------------------------- | ---------------------- | --------------------------------- | ------ | -------- | ----- |
| P-200 | StickyMobileCta : rAF + throttle scroll                                 | XS                     | INP −20-40 ms mobile              | Faible | non      | V1    |
| P-201 | BookingCalendar : `useTransition` autour `pickOpt`                      | S                      | INP −60-120 ms                    | Faible | non      | V2    |
| P-202 | BookingCalendar : autosave debounce 400 ms                              | XS                     | INP −30-80 ms / keystroke         | Faible | non      | V1    |
| P-203 | BookingCalendar : `useMemo` grilles dérivées                            | XS                     | INP −10-20 ms                     | Faible | non      | V2    |
| P-204 | HeaderImplantationsMenu : `pointer` events optim                        | XS                     | INP −5 ms                         | Faible | non      | V2    |
| P-205 | `globals.css` : `prefers-reduced-motion` `::view-transition-*` anticipé | XS                     | a11y                              | Faible | non      | V1    |
| P-206 | RoiSimulator : pas de patch (déjà optimal)                              | —                      | —                                 | —      | —        | —     |
| P-207 | 🚫 Préchargement BookingCalendar (lazy-import) NON RECOMMANDÉ           | —                      | —                                 | —      | —        | —     |
| P-208 | 🚫 Splitter modal submit `dynamic()` non recommandé                     | —                      | —                                 | —      | —        | —     |
| P-209 | AuditRequestForm : factoriser useState en `useReducer`                  | M                      | INP −20 ms (couvert par Compiler) | Faible | non      | V4    |
| P-220 | ⚠️ **STOP & ASK** Activer React Compiler 19 + ADR 0012                  | M                      | INP −15-30 % auto                 | Moyen  | ⚠️ §8.2  | V4    |
| P-221 | ⚠️ **STOP & ASK** View Transitions — refus motivé Sprint 14 + ADR 0013  | XS (decision-recorded) | preserve doctrine                 | Faible | ⚠️ §8.3  | V4    |

---

## Agent 4 — TTFB / Streaming PPR / Caching (`agent-4-ttfb-ppr-cache.md`)

| ID    | Titre                                                                                  | Effort       | Gain estimé            | Risque    | STOP&ASK | Vague |
| ----- | -------------------------------------------------------------------------------------- | ------------ | ---------------------- | --------- | -------- | ----- |
| P-300 | `Caddyfile` complet (Brotli + zstd + gzip + HTTP/3 + 103 Early Hints + cache)          | M            | TTFB −300-500 ms p75   | Moyen     | non      | V3    |
| P-301 | Dockerfile multi-stage standalone node:22-alpine                                       | M            | image < 280 MB         | Faible    | non      | V3    |
| P-302 | `output: "standalone"` + désactivation `compress` prod                                 | XS           | image −30 MB           | Faible    | non      | V1    |
| P-303 | `/api/vitals/route.ts` runtime Node + Zod + persistance ndjson                         | M            | RUM utilisable         | Faible    | ⚠️ D3    | V1    |
| P-304 | `WebVitals.tsx` enrichissement payload                                                 | S            | RUM utile              | Faible    | non      | V1    |
| P-305 | `/api/healthz/route.ts` (nouveau)                                                      | XS           | Caddy/Docker readiness | Faible    | non      | V3    |
| P-306 | 8 `loading.tsx` granulaires par route segment lourd                                    | M            | CLS + streaming        | Faible    | non      | V2    |
| P-307 | Suspense boundary BookingCalendar (préparation PPR)                                    | S            | streaming              | Faible    | non      | V2    |
| P-308 | ⚠️ **STOP & ASK** PPR `incremental` + opt-in `/reserver` + ADR 0011                    | L            | TTFB shell instantané  | **Élevé** | ⚠️ §8.1  | V4    |
| P-309 | Cloudflare cache rules (checklist 7 étapes Will dashboard)                             | S (ops Will) | LCP −100-400 ms        | Faible    | ⚠️ D2    | V5    |
| P-310 | `Vary: rsc, ...` header                                                                | XS           | CDN compat             | Faible    | non      | V1    |
| P-311 | Cache-Control overrides per route                                                      | XS           | TTFB CDN               | Faible    | non      | V1    |
| P-312 | `proxy.ts` matcher (déjà conforme — confirmation)                                      | —            | —                      | —         | —        | —     |
| P-313 | `X-Accel-Buffering: no` (vérification streaming)                                       | XS           | streaming              | Faible    | non      | V3    |
| P-314 | Lighthouse CI mobile preset                                                            | S            | gate complet           | Faible    | non      | V1    |
| P-315 | ADR 0008 PPR + ADR 0009 Hetzner stack (renumérotage à confirmer Agent 6 → 0011 + 0014) | S (doc)      | gouvernance            | Faible    | non      | V5    |

---

## Agent 5 — Bundle JS / Build / Tooling (`agent-5-bundle-build.md`)

| ID    | Titre                                                                                                       | Effort         | Gain estimé                                     | Risque | STOP&ASK | Vague |
| ----- | ----------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- | ------ | -------- | ----- |
| P-400 | `serverExternalPackages` (verrouillage anti-leak)                                                           | XS             | préventif                                       | Faible | non      | V1    |
| P-401 | Lazy-load BookingCalendar via `next/dynamic`                                                                | S              | **−50 KB gz /reserver**                         | Faible | non      | V2    |
| P-402 | Lazy-load TipTap éditeur (préventif Sprint 17+)                                                             | S              | préventif                                       | Faible | non      | V6    |
| P-403 | Sentry Replay → 0 % en prod + lazy SDK                                                                      | M              | **−20 KB gz × 4 562 pages**                     | Faible | ⚠️ E2    | V1    |
| P-404 | Migration `next experimental-analyze` (Turbopack natif)                                                     | S              | diag                                            | Faible | non      | V1    |
| P-405 | `size-limit` per-route budgets                                                                              | S              | gate CI                                         | Faible | non      | V2    |
| P-406 | Lighthouse CI mobile preset run                                                                             | S              | doublon P-501/P-314                             | Faible | non      | V1    |
| P-407 | GitHub Action bundle delta gate                                                                             | S              | gate CI                                         | Faible | non      | V2    |
| P-408 | `output: "standalone"` (doublon P-302)                                                                      | —              | —                                               | —      | —        | —     |
| P-409 | `compress: true` Next vs Caddy/CF anti-double-compression                                                   | XS             | économie CPU                                    | Faible | ⚠️ D5    | V3    |
| P-410 | Remplacer `motion` par CSS + IntersectionObserver                                                           | S              | **−30 KB gz × 4 562 pages**                     | Faible | non      | V1    |
| P-411 | ⚠️ **STOP & ASK** Cleanup deps non utilisées (`@tiptap/*`, `next-auth`, `@tanstack/react-query`, `zustand`) | XS (`pnpm rm`) | bundle inchangé (déjà inutilisés) + maintenance | Faible | ⚠️ E1    | V6    |
| P-412 | Zod côté server uniquement (RHF côté client)                                                                | M              | −22 KB gz                                       | Moyen  | ⚠️ E4    | V6    |
| P-413 | Namespacer `next-intl` (split FR/EN client)                                                                 | M              | −15 KB gz                                       | Moyen  | non      | V6    |
| P-414 | Doublon P-409                                                                                               | —              | —                                               | —      | —        | —     |
| P-415 | ⚠️ **STOP & ASK** RUM custom (alternative gratuite Sentry full)                                             | L              | **−150 KB gz**                                  | Élevé  | ⚠️ E6    | V6    |

---

## Agent 6 — Monitoring / Best Practices / Sécurité Lighthouse (`agent-6-monitoring-bp-securite.md`)

| ID    | Titre                                                                  | Effort | Gain estimé          | Risque | STOP&ASK | Vague |
| ----- | ---------------------------------------------------------------------- | ------ | -------------------- | ------ | -------- | ----- |
| P-500 | WebVitals payload enrichi (route + locale + connection + deviceMemory) | S      | débloque dashboard   | Faible | non      | V1    |
| P-501 | Lighthouse CI mobile preset slow 4G + retire `continue-on-error`       | M      | gate complet         | Faible | non      | V1    |
| P-502 | Sentry Replay 0 % par défaut + opt-in env (renforce P-403)             | S      | renforce P-403       | Faible | ⚠️ F2    | V6    |
| P-503 | Doctrine `AGENTS.md` perf budget LCP/INP/CLS                           | XS     | gouvernance          | Faible | non      | V1    |
| P-504 | Runbook `docs/runbooks/page-lente.md` (contenu inline)                 | S      | ops                  | Faible | ⚠️ F4    | V5    |
| P-505 | ADR 0010 Web Vitals 2026 (squelette)                                   | S      | doc                  | Faible | ⚠️ F1    | V5    |
| P-506 | CrUX snapshot mensuel script + GHA cron                                | M      | monitoring           | Faible | ⚠️ F5    | V5    |
| P-507 | `pnpm audit` gate Gate B + retire `\|\| true` nightly                  | S      | sécurité             | Faible | ⚠️ F3    | V2    |
| P-508 | `productionBrowserSourceMaps: false` explicite                         | XS     | clarté config        | Faible | non      | V1    |
| P-509 | `console.warn` stubs gated `NODE_ENV !== "production"` (8 fichiers)    | S      | BP +2 pts Lighthouse | Faible | non      | V1    |
| P-510 | Sentry vitals integration sample 3 % (optionnel V6)                    | S      | monitoring           | Faible | ⚠️ F6    | V6    |

---

## Tableau récapitulatif par vague

| Vague | Patches inclus                                                                                                                                                                              |               Total patches |       Effort cumul |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------: | -----------------: |
| V1    | P-001, P-009, P-012, P-013, P-015, P-105, P-107, P-109, P-200, P-202, P-205, P-302, P-303, P-304, P-310, P-311, P-314, P-400, P-403, P-404, P-406, P-410, P-500, P-501, P-503, P-508, P-509 |                          27 |           ~1 j dev |
| V2    | P-002, P-003, P-004, P-007, P-008, P-100, P-101, P-102, P-104, P-201, P-203, P-204, P-306, P-307, P-401, P-405, P-407, P-507                                                                |                          18 |          1-2 j dev |
| V3    | P-010, P-300, P-301, P-305, P-313, P-409                                                                                                                                                    |                           6 |  2 j dev + 1 j ops |
| V4 ⚠️ | P-209, P-220, P-221, P-307 (déjà V2), P-308                                                                                                                                                 | 4 (3 nouveaux + STOP & ASK) |          3-4 j dev |
| V5 ⚠️ | P-011, P-309, P-315, P-504, P-505, P-506                                                                                                                                                    |                           6 | 1 j dev + ops Will |
| V6 ⚠️ | P-006, P-014, P-110, P-402, P-411, P-412, P-413, P-415, P-502, P-510                                                                                                                        |                          10 |          1-2 j dev |

**Total** : 71 patches actifs + 10 anti-patches/doublons/N-A = **81 entrées**.

---

## Patches à n'exécuter qu'après STOP & ASK explicite

| ID        | Décision Will requise                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| P-220     | Activer React Compiler 19 (ADR 0012) ?                                                      |
| P-221     | View Transitions — refus motivé Sprint 14 (ADR 0013) ?                                      |
| P-308     | PPR `incremental` (ADR 0011) ?                                                              |
| P-309     | Cloudflare config dashboard (action Will) ?                                                 |
| P-411     | Cleanup deps non utilisées (`@tiptap/*`, `next-auth`, `@tanstack/react-query`, `zustand`) ? |
| P-415     | RUM custom gratuit en remplacement Sentry full (V6 — −150 KB gz) ?                          |
| P-503/505 | Numérotation ADR 0010 confirmée pour Web Vitals 2026 ?                                      |
| P-002     | `priority` déprécié Next 16 — refonte `Illustration` ?                                      |
| P-007     | `ssr: false` BookingCalendar (impact SEO/AEO) ?                                             |
| P-013     | Speculation Rules ciblées Top 15 + fallback moderate global ?                               |
| P-409     | `compress: true` Next → false dès Caddy en prod ?                                           |

---

**Fin index patches.** Pour exécution → `GO PATCHES V1` et le superviseur appliquera les 27 patches V1 selon `AUDIT-WEB-VITALS-2026-ROADMAP.md`.
