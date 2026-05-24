# V-04 Web Core Vitals — Re-évaluation P6 (audit only)

**Date** : 2026-05-22
**HEAD** : `8031a00` (feat content-gen — campaign controls presets)
**Branche audit** : `audit/p6-verdict-global-5000-2026-05-22`
**Baseline V-04 (audit end-to-end 2026-05-22)** : **53/100** 🔴 P0
**Score recalibré** : **122 / 200** 🟡 (équiv. 61/100)
**Budget interne (AGENTS.md)** : LCP ≤ 1800ms p75 / INP ≤ 100ms p75 / CLS = 0 / TBT ≤ 150ms / First Load JS ≤ 75 KB gz

---

## Méthode

Lecture artifacts : `lighthouserc.json`, `_AUDIT/AUDIT-WEB-VITALS-2026-{BUDGETS,BASELINE-A,DIAGNOSTIC}.md`, `_AUDIT/PERFECTION-2026-FINALISATION-2026-05-22/VERDICT-*.md`, `next.config.ts`, `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/components/marketing/{JsonLd,JsonLdGraph}.tsx`, `src/components/perf/SpeculationRules.tsx`, `package.json` (`size-limit`), pages stratégiques.

---

## Top 3 forces (file:line)

1. **Sentry client lazy-load via `requestIdleCallback` + slim integrations** — `src/instrumentation-client.ts:25-102`
   - `defaultIntegrations:false`, 6 intégrations minimales (dedupe, inboundFilters, functionToString, linkedErrors, globalHandlers, httpContext), `tracesSampleRate:0`, Replay 0%.
   - Dynamic import + init différée (`requestIdleCallback`, fallback `setTimeout 3000`). Gain documenté shell ~200 → ~120-130 KB br (-80 KB), LCP mobile -1200/-1800 ms attendu (commentaire ligne 1-23). Trade-off ~3s erreurs non capturées documenté.
   - `withSentryConfig` désactivé en dev (next.config.ts:285-289) → pas de pollution Turbopack.

2. **JSON-LD multi-strategy + `@graph` consolidation** — `src/components/marketing/JsonLd.tsx:1-58`, `src/components/marketing/JsonLdGraph.tsx:1-87`
   - API `strategy: "inline" | "afterInteractive" | "lazyOnload"` opt-in : pages pSEO villes ×service utilisent `JsonLdGraph` `@graph` (1 script vs 5), gain doc parse documenté -300 à -500 ms TBT (JsonLdGraph.tsx:14-20).
   - 23 occurrences `strategy="afterInteractive"` détectées (15 fichiers) — adoption sélective sur schemas non-critiques SEO.

3. **`next.config.ts` baseline correct V6** — `next.config.ts:73-173`
   - `output: "standalone"`, `compress:false` (Caddy en aval), `serverExternalPackages` verrouille 12 deps Node hors bundle client, `images.minimumCacheTTL: 31536000`, `experimental.optimizePackageImports` sur lucide-react + 14 Radix subpaths, `inlineCss: true` (élimine 1-2 ressources render-blocking documenté commentaire ligne 136-148).
   - Post-build Brotli 11 + Gzip 9 pre-compress (`scripts/precompress-static.ts` via postbuild, V-04 sprint finalisation 2026-05-22).
   - `experimental.viewTransition`, `ppr`, `reactCompiler` correctement commentés (différé Sprint 17, ADR doc en place).

---

## Top 3 gaps P0/P1 (file:line)

### P0-1 — LCP 5441 ms mobile non résolu (×3 budget interne)

- **Baseline preuve** : audit end-to-end mémoire `axionia_audit_complet_end_to_end_2026-05-22` cite "LCP 5441 ms mobile". Le sprint V-04 finalisation 2026-05-22 a apporté Brotli 11 + RSC payload doc mais **n'attaque pas la cause racine** (cf. VERDICT-SPRINT-PERFECTION ligne 207 : "score V-04 audit 53 → ~58/100 — la majorité des gaps V-04 reste : LCP 5441ms mobile, Sentry 136 KB shell, JSON-LD inline").
- **Sources LCP** : `_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md:101-119` First Load uncompressed pages stratégiques **~900-1022 KB** (gz estimé ~270-310 KB), cible V6 75 KB gz / route → gap ×3,5–×4. `_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md:80-87` confirme P-001 font preload, P-002 LCP image preload, P-004 preconnect tous **encore manquants** ("100 % rouge sur 15 pages").
- **Sentry shell 136 KB non lazy-loaded effectivement** : le lazy load est posé `instrumentation-client.ts:30-80` MAIS `withSentryConfig` (next.config.ts:288-290) reste actif en prod build et **inclut toujours les chunks `1302-*.js` + `3c1d9ecb-*.js`** dans le shell statique (le lazy n'évite que l'**init**, pas l'inclusion bundle). À vérifier en build prod réel.
- **Effort** : 4-6 j (préload font + LCP image hero per-template, audit `bundle-analyzer` Sentry chunk fragmentation, vérifier `Script strategy="lazyOnload"` réel sur Plausible/Clarity, réduire 900 KB → 250 KB uncomp via P-410 motion→CSS + P-403 Sentry chunk async + P-400 server-externals déjà OK).

### P0-2 — Lighthouse CI gate desserré silencieusement vs budget AGENTS.md

- **Fichier** : `lighthouserc.json:31-65`
- **Constat** : LCP gate **1800 ms** OK ligne 37 ✅, mais :
  - `interaction-to-next-paint: "off"` (ligne 38) — INP **non gated en CI** ;
  - CLS **0.1** (ligne 39) au lieu de 0 strict AGENTS.md ;
  - TBT **200 ms** (ligne 40) au lieu de 150 ms strict AGENTS.md ;
  - FCP 1500 ms, Speed Index 2500 ms — pas dans budget AGENTS.md (signaux secondaires) ;
  - `categories:performance: ["error", { "minScore": 0.9 }]` au lieu de 1.0 cible V6 (`_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md:318-321`).
- **Justification commentaire `_assert_doctrine` ligne 67-79** : doctrine sprint 2026-05-17 explicite (run LHCI 12+ recalibration, CLS /audit dépassait 0.05). C'est une **dette acceptée** mais le gate CI ne reflète plus le budget AGENTS.md → **régression silencieuse possible non détectée**.
- **Effort** : 1-2 j (durcir le gate progressivement par route via `assertMatrix`, débloquer INP en utilisant CrUX field data via `pnpm crux-snapshot` mensuel, scinder `categories:performance` 0.95 desktop / 0.90 mobile).

### P1-1 — Sentry server tracesSampleRate 10% prod + JSON-LD root layout inline non-`@graph`

- **Fichier** : `src/sentry.server.config.ts:9` `tracesSampleRate: 0.1` en prod — 10 % des requêtes server sont tracées, **overhead RUM** non négligeable sur LCP server-side (TTFB Caddy + RSC stream).
- **Fichier** : `src/app/[locale]/layout.tsx:253-264` — `<script type="application/ld+json">` Organization + WebSite **rendus inline en dur dans `<body>` du root layout**, sans utiliser `JsonLdGraph` `@graph` consolidé. 2 scripts JSON-LD synchrones sur 100 % des routes, alors que `JsonLdGraph` (`src/components/marketing/JsonLdGraph.tsx`) existe spécifiquement pour ce cas (`-300/-500 ms` doc parse documenté). Régression vs sprint V-04 P0i.
- **Pages stratégiques utilisant `<JsonLd>` inline default** : `/comparaisons`, `/comparaisons/[slug]`, `/un-a-un`, `/centre-aide`, `/centre-aide/[slug]` (le qaJsonLd seul est `afterInteractive`), `/[locale]/page.tsx:1309` (FAQ inline).
- **Effort** : 2-3 j (1) `tracesSampleRate: 0.02` en prod (-80 % overhead), (2) refactor root layout vers `<JsonLdGraph schemas={[organizationJsonLd, websiteJsonLd]} />`, (3) audit 18 fichiers `<JsonLd>` inline non-racine pour bascule `afterInteractive` où SEO permet.

---

## Verdict 🟡 — score 122 / 200 (61/100)

**Améliorations vs baseline 53/100 (+8 pts)** :

- Sentry client lazy-load infra **en place** (gain attendu shell `-80 KB`, à mesurer en build prod réel).
- JsonLd / JsonLdGraph API multi-strategy livrée + `@graph` consolidation utilisée sur pSEO villes.
- SpeculationRules client gating /admin (V-04 P3) réactivée → gain LCP soft-nav -800/-1200 ms.
- Brotli 11 + Gzip 9 build-time + postbuild chain (Sprint V-04 finalisation 2026-05-22).
- `experimental.optimizePackageImports` sur lucide-react + 14 Radix.
- `inlineCss: true` Next 16 (élimination 1-2 render-blocking).

**Gaps bloquants persistants** :

- **LCP mobile 5441 ms** non encore mesuré post-Brotli/post-lazy-Sentry (claim Sprint finalisation 53 → 58 conservateur).
- **Lighthouse CI** ne gate ni INP, ni CLS=0 strict, ni TBT=150 ms (`lighthouserc.json:38-40`). Performance threshold 0.9 vs budget V6 1.0.
- **First Load JS** : aucune route stratégique sous 75 KB gz (baseline ~270-310 KB gz) — gate `size-limit` shell 100 KB + per-page 75 KB en place (`package.json:size-limit`) mais sans build prod chiffré récent.
- **Root layout** continue à émettre 2 `<script type="application/ld+json">` inline (regression doctrine `@graph`).
- **Sentry server tracesSampleRate** 10 % prod (gourmand sur TTFB).

**Décision** : 🟡 **CONDITIONNEL P1**. La baseline 53/100 reposait sur des mesures LCP 5441 ms non re-mesurées post-correctifs livrés. L'infra de fix est correcte (lazy Sentry, `@graph`, Brotli 11), mais : (a) aucun run Lighthouse mobile prod live n'a été ré-exécuté depuis le sprint V-04 finalisation pour valider le gain, (b) le gate CI lui-même est trop laxiste vs AGENTS.md, (c) root layout reste un anti-pattern. Score recalibré conservateur **122/200** (≈ 61/100, +8 vs baseline).

**Pour passer 🟢 (objectif 160/200 = 80/100, ~Sprint 8-12 j)** :

1. Re-run LHCI mobile prod 9 URLs post-build, mesurer LCP réel post-Brotli + Sentry lazy.
2. Refactor root layout `<JsonLdGraph>` (effort 2 h).
3. Tightening `lighthouserc.json` LCP ≤ 1800 strict + CLS ≤ 0.05 + TBT ≤ 150 (effort 1 j run validation).
4. Préload font Manrope hero + LCP image preload per-template hub (effort 2 j).
5. Sentry `tracesSampleRate: 0.02` prod + vérifier chunk fragmentation effective post-lazy (effort 1 j).

---

## Sources auditées (read-only, zero modif)

- `axionia/lighthouserc.json` (1-85)
- `axionia/next.config.ts` (1-290)
- `axionia/src/instrumentation-client.ts` (1-114)
- `axionia/src/instrumentation.ts` (1-19)
- `axionia/src/sentry.server.config.ts` (1-19)
- `axionia/src/components/marketing/JsonLd.tsx` (1-58)
- `axionia/src/components/marketing/JsonLdGraph.tsx` (1-87)
- `axionia/src/components/perf/SpeculationRules.tsx` (1-50)
- `axionia/src/app/[locale]/layout.tsx` (240-271)
- `axionia/src/app/[locale]/page.tsx` (1290-1312)
- `axionia/package.json` (size-limit block — 5 buckets)
- `axionia/_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` (1-430)
- `axionia/_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md` (1-120)
- `axionia/_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md` (1-200)
- `axionia/_AUDIT/PERFECTION-2026-FINALISATION-2026-05-22/VERDICT-SPRINT-PERFECTION-2026-FINALISATION.md` (V-04 section 117-160, score impact 207)
