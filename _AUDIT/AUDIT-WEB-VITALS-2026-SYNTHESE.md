# Audit Web Vitals Perfection 2026 — Synthèse

**Date** : 2026-05-08
**Auditeur** : Claude Opus 4.7 (1M context) + 6 agents general-purpose en parallèle
**Référence prompt** : `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`
**Baseline détaillé** : `_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md`
**Score global** : **1 062,5 / 2 250 = 47,2 %**
**Cible Lighthouse** : 100/100/100/100 sur 15 pages stratégiques (desktop + mobile, médiane sur 5 runs)
**Cible CrUX p75** : LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0
**Périmètre** : 15 chapitres × 10 critères × 15 pages stratégiques (FR + EN) — `/2250`. Le prompt évoque aussi `/1500` (10 pages noyau) — variante équivalente.

---

## Tableau de bord par chapitre

| #   | Chapitre                 |       Score |     / 150 | Statut     | Bottleneck principal                                               |
| --- | ------------------------ | ----------: | --------: | ---------- | ------------------------------------------------------------------ |
| 1   | Mesure & instrumentation |        51,5 |       150 | 🔴 34 %    | RUM payload incomplet, dashboard Sprint 20 absent                  |
| 2   | LCP                      |          78 |       150 | 🟠 52 %    | Pas de preload font hero, pas de modulepreload                     |
| 3   | CLS                      |         117 |       150 | 🟢 78 %    | `loading.tsx` global trop minimaliste                              |
| 4   | INP                      |          87 |       150 | 🟠 58 %    | BookingCalendar 28 useState + autosave per-keystroke               |
| 5   | TTFB                     |          48 |       150 | 🔴 32 %    | Pas de Caddy, pas d'Early Hints, `runtime=edge` mal placé          |
| 6   | Bundle JS                |        75,5 |       150 | 🟠 51 %    | Sentry 150 KB gz + motion 30 KB gz + dead deps                     |
| 7   | Images                   |         100 |       150 | 🟢 67 %    | Pas de `placeholder="blur"`, gate CI poids absente                 |
| 8   | Fonts                    |       126,5 |       150 | 🟢 84 %    | `--font-serif` auto-référence, axes Fraunces non passés            |
| 9   | Network hints            |          70 |       150 | 🟠 47 %    | 0 preconnect / dns-prefetch / preload manuel                       |
| 10  | Streaming & PPR          |          63 |       150 | 🟠 42 %    | 0 `<Suspense>` dans `src/app/`, 1 `loading.tsx` global             |
| 11  | React Compiler 19        |         7,5 |       150 | 🔴 5 %     | Désactivé volontairement (Sprint 17 différé)                       |
| 12  | View Transitions         |          75 |       150 | 🟢 50 %    | Désactivé (doctrine v3 figée — refus motivé)                       |
| 13  | Caching & headers        |          31 |       150 | 🔴 21 %    | Pas de Caddy, pas de Cloudflare, `s-maxage` Next default trop long |
| 14  | Sécurité & BP            |         110 |       150 | 🟢 73 %    | CSP nonce différé Sprint 16 + Lighthouse BP 96 (4 pts manquants)   |
| 15  | Monitoring & gouvernance |        22,5 |       150 | 🔴 15 %    | Pas de runbook, pas de CrUX snapshot, pas de bundle gate CI        |
|     | **Total**                | **1 062,5** | **2 250** | **47,2 %** |                                                                    |

### Ce qui fonctionne déjà bien (à protéger)

- **Fonts (Ch 8 — 84 %)** : Next 16 `next/font/google` injecte déjà `size-adjust`+`ascent-override`+`descent-override` automatiquement (`adjustFontFallback: true` default). Ne PAS dupliquer en `@font-face` manuel (anti-patch P-103).
- **CLS (Ch 3 — 78 %)** : home et Paris pilote = CLS 0 en lab. Aucune image bitmap above-fold sur les 15 pages. `Illustration` réserve correctement.
- **Sécurité headers (Ch 14 — 73 %)** : HSTS preload + X-Frame DENY + nosniff + Permissions-Policy + Referrer-Policy déjà OK. Sentry sample rates déjà bien réglés (traces 10 % prod, replay 1 % on-error).
- **Paris ville pilote** : Lighthouse smoke 98/96/96/92 ✅ — gold standard validé pour les 2 150 villes en industrialisation.

### Ce qui bloque le 100/100/100/100

1. **Bundle First Load 870 KB – 1,02 MB uncompressed** (~270-310 KB gz estimé) sur les 15 pages stratégiques — vs cible interne **70 KB gz**. Gap 3-4×.
2. **`/reserver` CLS = 0,552** mesuré Lighthouse smoke = 5,5× le seuil Google.
3. **Home Perf 81 + TBT 300 ms** sous le seuil Lighthouse CI 95/200 ms.
4. **Pas de Caddy, pas de Dockerfile, pas de Cloudflare config** — V3 + V5 obligatoires.
5. **RUM en prod = poubelle** (`/api/vitals` log dev seulement, pas de persistance).

---

## Top 5 quick wins (XS / S effort, gain ≥ 200 ms ou ≥ 5 KB)

### 1. **P-410 — Remplacer `motion` par CSS + IntersectionObserver**

- **Effort** : S (1 h)
- **Gain** : −30 KB gz × **4 562 pages** = ~135 MB bandwidth/an si 50 K visites/mois
- **Risque** : Faible (motion utilisé uniquement par `FadeInOnView` sur 2 pages)
- **Détail** : `_AUDIT/agent-5-bundle-build.md` P-410

### 2. **P-403 — Sentry Replay 0 % + lazy SDK loader**

- **Effort** : M (2 h)
- **Gain** : −20 KB gz × 4 562 pages (Replay code retiré du bundle initial)
- **Risque** : Faible (déjà réglé à 1 % on-error — passage à 0 % en prod, opt-in via env)
- **Détail** : `_AUDIT/agent-5-bundle-build.md` P-403 + `agent-6` P-502

### 3. **P-500 + P-303 + P-304 — Pipeline RUM complet**

- **Effort** : S + S = 2 h
- **Gain** : Débloque dashboard Sprint 20, payload RUM enrichi (`route`, `locale`, `connection.effectiveType`, `deviceMemory`), runtime Node.js correct sur Hetzner, persistance ndjson
- **Risque** : Faible
- **Détail** : `_AUDIT/agent-6-monitoring-bp-securite.md` P-500 + `agent-4` P-303/P-304

### 4. **P-201 + P-202 — `useTransition` + debounce 400 ms BookingCalendar**

- **Effort** : S + XS = 1 h
- **Gain** : INP −90-200 ms p75 sur `/reserver` (CLS attendu en baisse en cascade)
- **Risque** : Faible
- **Détail** : `_AUDIT/agent-3-inp-compiler-viewtransitions.md` P-201/P-202

### 5. **P-001 + P-013 — Préload Manrope hero + Speculation Rules ciblées Top 15**

- **Effort** : XS + XS = 30 min
- **Gain** : LCP −150 à −250 ms p75 (préload font hero) + bandwidth save (speculation rules ciblées au lieu de toutes les 4 562 pages)
- **Risque** : Faible
- **Détail** : `_AUDIT/agent-1-lcp-images-network.md` P-001/P-013

---

## Top 5 chantiers structurels (M / L effort, gain transformatif)

### 1. **P-300 + P-301 + P-302 — Stack Hetzner complète (Caddy + Dockerfile + standalone)**

- **Effort** : L (1 jour dev)
- **Gain** : TTFB −300 à −500 ms p75 (Brotli + 103 Early Hints + HTTP/3 + cache rules)
- **Risque** : Moyen (config initiale Hetzner)
- **Dépend de** : provisionnement CX32 (€6,49/mois)
- **Détail** : `_AUDIT/agent-4-ttfb-ppr-cache.md` P-300/P-301/P-302

### 2. **P-308 + P-307 — PPR `incremental` + Suspense boundaries** _(STOP & ASK obligatoire)_

- **Effort** : L (1 jour dev)
- **Gain** : TTFB shell instantané, dynamic content streamé (gain visible sur `/reserver`)
- **Risque** : Élevé (PPR experimental Next 16, doit ne pas casser SSG bulk)
- **Dépend de** : ADR 0011 PPR à écrire, validation Will
- **Détail** : `_AUDIT/agent-4-ttfb-ppr-cache.md` P-307/P-308

### 3. **P-220 — React Compiler 19** _(STOP & ASK obligatoire)_

- **Effort** : M (2-3 h)
- **Gain** : INP −15-30 % automatique sur hot spots (BookingCalendar + AuditRequestForm + Header), bundle delta ±0-5 %
- **Risque** : Moyen (Babel takeover ralentit Turbopack +10-25 % cold build)
- **Dépend de** : ADR 0012 Compiler à écrire, validation Will
- **Détail** : `_AUDIT/agent-3-inp-compiler-viewtransitions.md` P-220

### 4. **P-401 + P-007 — Lazy-load BookingCalendar via `dynamic()`**

- **Effort** : S (1 h)
- **Gain** : −50 KB gz sur `/reserver` (BookingCalendar 2 095 lignes + 14 lucide icons + Dialog + form 4 étapes)
- **Risque** : Faible (composant déjà `"use client"`, pas de SSR critique)
- **Détail** : `_AUDIT/agent-5-bundle-build.md` P-401 + `agent-1` P-007

### 5. **P-309 + Cloudflare cache rules + Early Hints + Brotli**

- **Effort** : S (45 min, action Will dashboard)
- **Gain** : LCP −100 à −400 ms p75 (Early Hints + Brotli auto + cache POP edge)
- **Risque** : Faible
- **Dépend de** : compte Cloudflare DNS configuré
- **Détail** : `_AUDIT/agent-4-ttfb-ppr-cache.md` P-309

---

## Recommandations vagues (ordre)

| Vague  | Périmètre                                                  | Effort cumul      | STOP & ASK ouvert            | Cible score             |
| ------ | ---------------------------------------------------------- | ----------------- | ---------------------------- | ----------------------- |
| **V1** | Quick wins XS/S code-only                                  | ~1 j dev          | non                          | 1 062 → ~1 350 (+13 %)  |
| **V2** | Lazy + INP + RUM pipeline                                  | 1-2 j dev         | non                          | ~1 350 → ~1 600 (+11 %) |
| **V3** | Stack Hetzner Caddy + Docker                               | 2 j dev + 1 j ops | non                          | ~1 600 → ~1 750 (+7 %)  |
| **V4** | PPR + React Compiler 19                                    | 3-4 j dev         | **OUI ×2** (Compiler + PPR)  | ~1 750 → ~1 950 (+9 %)  |
| **V5** | Cloudflare + monitoring + ADR                              | 1 j dev + ops     | OUI (Cloudflare config Will) | ~1 950 → ~2 100 (+7 %)  |
| **V6** | Polish + premium (RUM custom Hetzner-pure, Service Worker) | 1-2 j dev         | OUI (Sentry V5)              | ~2 100 → ~2 200 (+4 %)  |

**Cible 100 % (2 250 / 2 250)** réaliste uniquement avec :

- Dashboard custom `/admin/pseo-stats` Sprint 20 livré (Ch 1 + 15 = +50 pts)
- Sentry retiré ou loader-only (Ch 6 = +30 pts)
- View Transitions activées (mais doctrine v3 figée → 75/150 reste plafond sans accord Will)

---

## STOP & ASK ouverts (consolidés — décision Will requise avant exécution)

> Les 6 agents ont remonté **22 STOP & ASK** au total. Voici les **12 décisions critiques** alignées sur les 12 STOP & ASK obligatoires §8 du prompt :

### 1. PPR `incremental` (§8.1) — Agent 4 P-308

- **Recommandation** : maintenir off V1-V3, flip V4 avec ADR 0011 + Suspense `/reserver` first.

### 2. React Compiler 19 (§8.2) — Agent 3 P-220

- **Recommandation** : activer V4 (pas Sprint 17), ADR 0012, mesurer build time impact.

### 3. View Transitions (§8.3) — Agent 3 P-221

- **Recommandation** : refus motivé Sprint 14 (doctrine v3 figée), ADR 0013 decision-recorded. Si Will valide plus tard, seule candidate = `view-transition-name: site-header` (zéro animation, juste stabilité visuelle).

### 4. Doctrine visuelle v3 (§8.4)

- **Aucun patch** ne dégrade la doctrine v3 (Fraunces italique, terracotta, hero-schema 576×576). Confirmé par les 6 agents.

### 5. Trade-off perf vs SEO/AEO/A11y (§8.5)

- **A11y home 88 / 100** détecté smoke Lighthouse — Agent 6 doit creuser (probable contraste badges + labels). Pas de trade-off perf vs SEO observé.

### 6. Lighthouse CI seuils (§8.6)

- Aucune divergence > 30 % détectée. Lighthouse smoke confirme tous les seuils dépassés sur `/reserver` (CLS 0,552 vs 0,1, Perf 66 vs 95). **Lighthouse CI déjà cassé** sur `/reserver` si activé en gate.

### 7. Dépendance npm > 10 KB (§8.7)

- Aucune nouvelle dep proposée par les patches V1-V3.
- V4 : `babel-plugin-react-compiler` devDep (devDep, n'impacte pas le bundle client).
- V5 : aucun.

### 8. Speculation Rules (§8.8) — Agent 1 P-013

- **Recommandation** : tuner pour cibler explicitement Top 15 stratégiques avec `eagerness: eager`, garder fallback `moderate` global. Pas de désactivation totale.

### 9. `pnpm install` ou `pnpm add` (§8.9)

- V4 : `pnpm add -D babel-plugin-react-compiler eslint-plugin-react-compiler` (validation Will requise).
- V6 : aucun (cleanup deps `pnpm remove` `@tiptap/*` + `next-auth` + `@tanstack/react-query` + `zustand` SI Will confirme inutilisé Sprint 17+).

### 10. Commits (§8.10)

- Aucun commit avant ce STOP & ASK global. Les 5 livrables `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` + 6 fichiers `_AUDIT/agent-*.md` sont écrits mais **aucun fichier source modifié**.

### 11. Patch `[BUDGET-FLAG]` (§8.11)

- **Aucun [BUDGET-FLAG] déclenché** — tous les patches restent dans le périmètre Hetzner CX32 + Caddy + Cloudflare free.
- Sentry @sentry/nextjs free tier conservé (5K errors + 10K perf events/mois).

### 12. Upgrade payant (§8.12)

- **Aucun proposé** par les agents. Cloudflare Pro $20/mois NON nécessaire pour V1-V5. Sentry Pro NON nécessaire (dashboard Sprint 20 + free tier suffisent).

### STOP & ASK additionnels remontés par les agents (à arbitrer)

- **Agent 5 / V6** — Sentry direction long terme : maintenir SDK complet (~150 KB gz, 10K events/mois free), passer à loader script (lazy 80 % du SDK), ou RUM custom Hetzner-pure (0 KB Sentry — pure POST `/api/vitals`)
- **Agent 5 / V6** — Cleanup deps `@tiptap/*` (~80-120 KB gz si chargé), `next-auth`, `@tanstack/react-query`, `zustand` (zéro import dans `src/`) — utilisés Sprint 17+ ou dette ?
- **Agent 4 / V3** — `compress: true` Next : désactiver dès que Caddy en prod (anti-double-compression)
- **Agent 4 / V3** — Caddy 2 vs Nginx via Coolify : recommandé Caddy 2 standalone (HTTP/3 + Early Hints natifs, config simple)
- **Agent 4 / V1** — Persistance vitals : ndjson rotatif fichier (V1) → Postgres (V2 Sprint 20)
- **Agent 6 / V2** — `pnpm audit` actuel : à lancer avant P-507 pour vérifier 0 high CVE (sinon fix obligatoire avant gate)
- **Agent 6 / V5** — Runbook chemin : `docs/runbooks/page-lente.md` (recommandé) vs `_AUDIT/RUNBOOK-*.md`
- **Agent 6 / V5** — Secret `CRUX_API_KEY` GitHub à créer (gratuit Google Cloud)
- **Agent 2 / V1** — Renommer `--font-serif` → `--font-fraunces` interne (P-105) pour casser auto-référence

---

## Livrables additionnels

- `_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md` : score per-page × per-criterion (consolidation cross-agents)
- `_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md` : index numéroté P-001 → P-510 avec pointeurs vers fichiers agents
- `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md` : séquencement V1-V6 détaillé
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` : budgets perf par route (format CI YAML)
- `_AUDIT/lighthouse-smoke-2026-05-08/` : 3 rapports Lighthouse JSON+HTML (home/reserver/paris FR desktop)

## Mémoire à créer en sortie

- `axionia_audit_web_vitals_2026-05-08.md` (à venir Phase D-out)

---

**Phase D close. Aucun fichier source modifié. Attente instruction `GO PATCHES V1` (ou `V2` / `V3` / etc.) avant exécution.**
