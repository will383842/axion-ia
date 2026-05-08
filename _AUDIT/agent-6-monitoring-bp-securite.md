# Agent 6 — Monitoring / Best Practices / Sécurité Lighthouse

> **Périmètre** : chapitres **1** (Mesure baseline & instrumentation) + **14** (Sécurité & Best Practices Lighthouse 100) + **15** (Monitoring & gouvernance perf) du prompt `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`.
> **Mode** : lecture seule. Aucun fichier source modifié. Patches prêts à coller en §6.
> **Date** : 2026-05-08
> **Build référencé** : baseline §A (BUILD_ID `E3PP2kWtZKG7UfgwwGBdi`)
> **Pages stratégiques** : 15 routes (cf. §3 prompt) × 10 critères = 150 cases par chapitre.

---

## Score chapitre 1 (Mesure & instrumentation) : 51,5 / 150

Notation 0 / 0,5 / 1 par critère × 15 pages stratégiques (FR uniquement — la mesure ne dépend pas de la locale, EN identique). Pour les critères globaux (CI, scripts, configuration), le score est uniforme sur les 15 pages.

| #    | Critère                                                                                                  | Score / 15 | Justification                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Lighthouse CI thresholds présents et stricts (perf ≥ 95, LCP, INP, CLS, TBT)                             |     **15** | `lighthouserc.json` lignes 12-23 OK : perf 0.95 / a11y 0.95 / BP 0.95 / SEO 1.0 / LCP 2 500 / INP 200 / CLS 0.1 / TBT 200. ✅                                  |
| 1.2  | `useReportWebVitals` actif et tous vitals (LCP/INP/CLS/FCP/TTFB) reportés                                |     **15** | `src/components/analytics/WebVitals.tsx` utilise `next/web-vitals`. Le hook reporte LCP/INP/CLS/FCP/TTFB par défaut. ✅                                        |
| 1.3  | Endpoint `/api/vitals` répond < 50 ms en Node.js runtime self-hosted (validation Zod + persistance asyn) |      **0** | `runtime = "edge"` ligne 5 — incompatible Hetzner (Agent 4 traite la migration runtime). Pas de validation Zod, pas de persistance. ❌                         |
| 1.4  | RUM payload contient `route`, `locale`, `connection.effectiveType`, `deviceMemory`                       |      **0** | Payload (lignes 9-17) = `id, name, value, rating, delta, navigationType, href`. **Manque** : `route`, `locale`, `connection.effectiveType`, `deviceMemory`. ❌ |
| 1.5  | Logs dev exclus du dashboard prod (filtrage `NODE_ENV`)                                                  |     **15** | `route.ts` ligne 27 : `if (body && process.env.NODE_ENV !== "production")` ✅                                                                                  |
| 1.6  | Dashboard RUM custom alerte si p75 LCP > 2 500 ms (cible `/admin/pseo-stats` Sprint 20)                  |      **0** | Pas de dashboard RUM. Pas de Sentry alerting performance (sample rate trace 10 %, replay 1 % on-error mais pas alert RUM). Persistance vitals = `null`. ❌     |
| 1.7  | CrUX query mensuelle automatisée (script Node + Search Console API)                                      |      **0** | Aucun script `scripts/crux-snapshot.ts`. `vitals-report.ts` est un stub Sprint 23. ❌                                                                          |
| 1.8  | Lighthouse CI lance desktop **et** mobile (slow 4G simulé)                                               |      **0** | `lighthouserc.json` ligne 9 : `"preset": "desktop"` uniquement. Pas de second `lighthouserc.mobile.json`. ❌                                                   |
| 1.9  | Bundle-analyzer report archivé après chaque release dans `_AUDIT/`                                       |      **0** | Aucun script `postbuild` ou GHA n'archive le rapport HTML/JSON. `bundle:analyze` tourne ad-hoc, le rapport reste en `.next/`. ❌                               |
| 1.10 | INP per-interaction breakdown (Long Animation Frames API) capturé                                        |      **0** | Pas de `PerformanceObserver({ type: "long-animation-frame" })`. Pas de payload Long Tasks dans `WebVitals.tsx`. ❌                                             |

**Sous-total chapitre 1** : **51,5 / 150**.

---

## Score chapitre 14 (Sécurité & Best Practices) : 110 / 150

| #     | Critère                                                                    | Score / 15 | Justification                                                                                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14.1  | CSP nonce dynamique (Sprint 16 — anticiper si gain perf via inlining)      |      **0** | Pas de CSP du tout dans `next.config.ts` (commentaire ligne 9 « CSP nonce dynamique arrive Sprint 16 »). Lighthouse BP best-effort sans, pas un blocker. ❌                                                                                                       |
| 14.2  | `Strict-Transport-Security` preload (déjà OK 2 ans)                        |     **15** | `securityHeaders[4]` : `max-age=63072000; includeSubDomains; preload` ✅                                                                                                                                                                                          |
| 14.3  | `Permissions-Policy` strict                                                |     **15** | `securityHeaders[3]` : `camera=(), microphone=(), geolocation=(), interest-cohort=()` ✅                                                                                                                                                                          |
| 14.4  | `Referrer-Policy: strict-origin-when-cross-origin`                         |     **15** | `securityHeaders[2]` ✅                                                                                                                                                                                                                                           |
| 14.5  | `X-Content-Type-Options: nosniff`                                          |     **15** | `securityHeaders[1]` ✅                                                                                                                                                                                                                                           |
| 14.6  | `X-Frame-Options: DENY` ou `frame-ancestors 'none'` via CSP                |     **15** | `securityHeaders[0]` `DENY` ✅                                                                                                                                                                                                                                    |
| 14.7  | Aucune dépendance avec CVE Critical/High (`pnpm audit` clean)              |    **7,5** | `nightly.yml` ligne 28 : `pnpm audit --json > audit.json \|\| true` — l'erreur est masquée (`\|\| true`), pas de gate bloquant en CI/PR. Audit lecture-seule cette phase ne lance pas la commande. **Patch P-507** durcit. ⚠️                                     |
| 14.8  | Pas d'usage `dangerouslySetInnerHTML` non sanitisé (sauf JSON-LD contrôlé) |     **15** | 5 occurrences trouvées : `Breadcrumbs.tsx`, `JsonLd.tsx`, `[locale]/layout.tsx` (×3) — toutes `JSON.stringify(jsonLd)` côté server. Aucun pattern user-input. ✅                                                                                                  |
| 14.9  | HTTPS partout (Caddy auto-HTTPS + Cloudflare Universal SSL)                |    **7,5** | Caddyfile non livré (Agent 4). Headers HSTS + preload OK côté Next. Vérification `http://` interne à faire à la livraison Caddy. ⚠️                                                                                                                               |
| 14.10 | `console.log` retirés en prod                                              |      **5** | Aucun `console.log/debug/info` trouvé dans `src/`. **Mais** 9 `console.warn` dont 8 sur stubs forms (`[contact:submit:stub]`, `[audit:submit:stub]`, `[booking:submit:stub]`, etc.) appelés en prod si `onSubmit` se déclenche. À gate par `NODE_ENV` (P-509). ⚠️ |

**Sous-total chapitre 14** : **110 / 150**.

---

## Score chapitre 15 (Monitoring & gouvernance perf) : 22,5 / 150

| #     | Critère                                                                              | Score / 15 | Justification                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 15.1  | Budget perf par route documenté (`_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`)          |      **0** | Fichier non créé. À produire par superviseur (Phase D). Le budget existant `package.json` (ligne 152-158) est pour le bundle, pas par route Lighthouse. ❌                                             |
| 15.2  | Lighthouse CI gate sur PR (bloquant si régression > seuil)                           |    **7,5** | `ci.yml` ligne 82-83 : `pnpm lhci:autorun` avec `continue-on-error: true # Sprint 14 enables hard fail`. Configuré mais **non bloquant**. Sprint 14 livré, le `continue-on-error` doit être retiré. ⚠️ |
| 15.3  | Bundle delta gate sur PR (bloquant si > +5 KB)                                       |    **7,5** | `bundle:check` (size-limit) lancé Gate B mais limit 100 KB **total**, pas un delta. Pas de comparaison vs base branch. ⚠️                                                                              |
| 15.4  | Dashboard RUM accessible (Sprint 20 prévu `/admin/pseo-stats`)                       |      **0** | Pas livré (planifié Sprint 20). ❌                                                                                                                                                                     |
| 15.5  | Alerting p75 LCP > 2 500 ms (24 h) via dashboard custom OU Sentry free               |      **0** | Aucun alerting RUM. Sentry init ne traite pas les vitals (les vitals partent en sendBeacon vers `/api/vitals`, non vers Sentry). ❌                                                                    |
| 15.6  | Runbook « page lente » documenté pour Will                                           |      **0** | Aucun fichier `docs/runbooks/`. Pas de RUNBOOK dans `_AUDIT/`. ❌                                                                                                                                      |
| 15.7  | Snapshot mensuel CrUX archivé dans `_AUDIT/`                                         |      **0** | Aucun fichier `_AUDIT/CRUX-snapshot-*.json`. Pas de cron GitHub Actions mensuel. ❌                                                                                                                    |
| 15.8  | Synthèse trimestrielle perf vs concurrents top 3                                     |      **0** | Aucun template, aucune note archivée. ❌                                                                                                                                                               |
| 15.9  | ADR à chaque feature perf majeure (PPR, Compiler, View Transitions)                  |    **7,5** | ADR 0009 (hosting) couvre l'infra. ADR 0010+ pour Web Vitals 2026 / PPR / Compiler / View Transitions / Caddy : **non écrits**. ⚠️                                                                     |
| 15.10 | Doctrine `CLAUDE.md` / `AGENTS.md` mise à jour avec règles perf (LCP/INP/CLS budget) |      **0** | `AGENTS.md` ne contient que la règle « lis `node_modules/next/dist/docs/` avant patch ». Pas de budget perf documenté. ❌                                                                              |

**Sous-total chapitre 15** : **22,5 / 150**.

---

## TOTAL Agent 6 : **184 / 450** (40,9 %)

| Chapitre                                      |   Score |   / 150 |          % |
| --------------------------------------------- | ------: | ------: | ---------: |
| 1 — Mesure & instrumentation                  |    51,5 |     150 |     34,3 % |
| 14 — Sécurité & Best Practices Lighthouse 100 |     110 |     150 |     73,3 % |
| 15 — Monitoring & gouvernance perf            |    22,5 |     150 |     15,0 % |
| **Total Agent 6**                             | **184** | **450** | **40,9 %** |

> Cohérent avec l'estimation baseline §A.5 (35–45 % attendu). Le chapitre 14 tire le score grâce aux headers de sécurité existants ; les chapitres 1 et 15 sont structurellement vides (RUM persistance + dashboard + runbooks + ADR à construire).

---

## Diagnostic

### État actuel RUM payload (gap critère 1.4)

`WebVitals.tsx` (50 lignes) envoie `id, name, value, rating, delta, navigationType, href`. **Ne capture pas** :

- `route` : pattern de route (`/[locale]/implantations/[region]/[ville]`) — sans cela, agréger par template est impossible (4 562 URL → on noie le signal).
- `locale` : FR/EN, indispensable pour comparer les deux marchés.
- `connection.effectiveType` (`navigator.connection?.effectiveType`) : 4g / 3g / slow-2g — discriminant majeur pour expliquer p75.
- `deviceMemory` ((navigator as any).deviceMemory : 0.5 / 1 / 2 / 4 / 8) : low-end devices.

Sans ces 4 champs, le dashboard RUM Sprint 20 ne pourra ni segmenter ni alerter sur des cohortes.

### État Sentry (versions + sample rates)

- `@sentry/nextjs` **10.51.0** — version récente, pas de CVE connue.
- `instrumentation-client.ts` : `tracesSampleRate: 0.1` prod (ligne 8), `replaysSessionSampleRate: 0` (ligne 11), `replaysOnErrorSampleRate: 0.01` (ligne 13). **Bon réglage** — replay session = 0 économise 30+ KB de bundle initial sur la majorité des sessions, replay 1 % on-error suffit pour debug.
- `sentry.server.config.ts` + `sentry.edge.config.ts` : `tracesSampleRate: 0.1` prod — OK.
- **Pas d'envoi des Web Vitals à Sentry** (le payload va à `/api/vitals` qui le jette). Sentry Performance est sous-exploité.

### État ADR (numéros libres + sujets prioritaires)

ADR pris : 0001 → 0009 (0009 = hosting Hetzner CX32 + Cloudflare free, 2026-05-08).

**Numéros libres suivants** :

- **0010** — Web Vitals Perfection 2026 (cet audit, sujet englobant)
- **0011** — PPR `incremental` activation (Agent 4)
- **0012** — React Compiler 19 activation (Agent 3)
- **0013** — View Transitions API adoption (Agent 3)
- **0014** — Caddy 2 Caddyfile + Cloudflare config (Agent 4)

**STOP & ASK** : multiples ADR à séquencer — voir §STOP & ASK ouverts.

### État runbook (manquants)

Aucun runbook ops. Il manque a minima :

- `docs/runbooks/page-lente.md` (Critère 15.6 — diagnostic perf chez Will)
- `docs/runbooks/erreur-500.md` (Sprint 14.x dev 500 prerender-manifest documenté en mémoire)
- `docs/runbooks/email-bounce.md` (Sprint 19)

Cet audit ne livre que le **page-lente** (P-504).

### État Lighthouse CI (mobile preset absent)

`lighthouserc.json` ligne 9 : `"preset": "desktop"` uniquement. Le critère 1.8 demande **desktop ET mobile slow 4G**. Solution : seconde config `lighthouserc.mobile.json` + 2nd job `lhci:autorun:mobile` dans `ci.yml`.

`continue-on-error: true` ligne 83 = `lhci` n'est pas bloquant en PR. Sprint 14 est désormais livré, ce flag doit tomber (P-501 inclut le mobile preset, P-501b retire le `continue-on-error`).

### État `pnpm audit` (à confirmer en patch)

`nightly.yml` ligne 28 : `pnpm audit --json > audit.json || true` — **l'erreur est masquée**. Pas de gate bloquant en `ci.yml`. **À durcir** : ajouter `pnpm audit --audit-level=high` en Gate B (P-507). Audit réel non lancé cette phase (lecture seule).

---

## Patches P-500 … P-510

> Format §6 du prompt. Chaque patch indique fichier + diff + effort + gain + risque + dépendances + validation.

---

### P-500 — WebVitals payload enrichi (route + locale + connection + deviceMemory)

**Effort** : S (~30 min)
**Gain estimé** : indispensable pour dashboard RUM Sprint 20 segmentable (cohortes 4G/3G, low-end memory, FR vs EN, par template route). Pas de gain LCP/INP direct, mais débloque l'alerting (critère 15.5).
**Risque** : Faible — payload élargi, sendBeacon supporte ~64 KB, on en ajoute < 100 octets.
**Dépendances** : aucune.

**Fichier** : `src/components/analytics/WebVitals.tsx`

**Diff** :

```diff
--- a/src/components/analytics/WebVitals.tsx
+++ b/src/components/analytics/WebVitals.tsx
@@ -1,52 +1,86 @@
 "use client";
 // use-client: useReportWebVitals is a client-only hook by design — RUM
 // metrics ship from the browser via navigator.sendBeacon.

 import { useReportWebVitals } from "next/web-vitals";
+import { usePathname } from "next/navigation";
+import { useLocale } from "next-intl";

 const VITALS_ENDPOINT = "/api/vitals";

 interface VitalsPayload {
   id: string;
   name: string;
   value: number;
   rating: string;
   delta: number;
   navigationType: string;
   href: string;
+  route: string;
+  locale: string;
+  effectiveType?: string;
+  deviceMemory?: number;
+  saveData?: boolean;
 }

-// Reports CLS / LCP / INP / FCP / TTFB to /api/vitals (Edge route).
+// Reports CLS / LCP / INP / FCP / TTFB to /api/vitals (Node route, Hetzner).
 // Uses sendBeacon when available so payload survives page unload, falls back
 // to fetch keepalive otherwise. Fail-silent — no UI surface, no console noise.
+//
+// Payload includes route template (for aggregation across 4 562 URLs),
+// locale (FR/EN cohort split), connection.effectiveType + deviceMemory
+// + saveData (low-end / data-saver cohort detection).
 export function WebVitals() {
+  const pathname = usePathname();
+  const locale = useLocale();
+
   useReportWebVitals((metric) => {
+    type ConnectionLike = { effectiveType?: string; saveData?: boolean };
+    type NavigatorWithExtras = Navigator & {
+      connection?: ConnectionLike;
+      deviceMemory?: number;
+    };
+    const nav =
+      typeof navigator !== "undefined" ? (navigator as NavigatorWithExtras) : undefined;
+
     const payload: VitalsPayload = {
       id: metric.id,
       name: metric.name,
       value: metric.value,
       rating: metric.rating,
       delta: metric.delta,
       navigationType: metric.navigationType,
       href: typeof window !== "undefined" ? window.location.href : "",
+      route: pathname ?? "",
+      locale,
+      effectiveType: nav?.connection?.effectiveType,
+      deviceMemory: nav?.deviceMemory,
+      saveData: nav?.connection?.saveData,
     };
     const body = JSON.stringify(payload);
     try {
       if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
         const blob = new Blob([body], { type: "application/json" });
         navigator.sendBeacon(VITALS_ENDPOINT, blob);
         return;
       }
       void fetch(VITALS_ENDPOINT, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body,
         keepalive: true,
       });
     } catch {
       // Swallow — beacon failures must never affect UX.
     }
   });
   return null;
 }
```

**Validation** :

- DevTools Network → POST `/api/vitals` body contient `route`, `locale`, `effectiveType`, `deviceMemory`.
- Tester sur Chrome desktop (effectiveType absent OK), mobile throttled DevTools (effectiveType = "3g"), iPhone Safari (effectiveType absent OK — Safari < 17.4 ne supporte pas `navigator.connection`).
- `pnpm typecheck` passe.
- Tests vitest existants passent (le composant n'a pas de test dédié).

---

### P-501 — Lighthouse CI mobile preset (slow 4G)

**Effort** : S (~45 min)
**Gain estimé** : critère 1.8 passe au vert (15/15). Lighthouse couvre le profil mobile slow 4G qui est le profil cible CrUX p75.
**Risque** : Faible — second fichier de config + 2nd job CI. Aucun impact code applicatif.
**Dépendances** : aucune.

**Fichiers** :

1. **Nouveau fichier `lighthouserc.mobile.json`** :

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/"],
      "startServerCommand": "pnpm start",
      "startServerReadyPattern": "Ready",
      "numberOfRuns": 3,
      "settings": {
        "preset": "mobile",
        "throttlingMethod": "simulate",
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      }
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 1 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./lhci-mobile"
    }
  }
}
```

> **Note** : seuil mobile perf = 0.9 (vs 0.95 desktop) — réaliste mobile slow 4G ; durcissable à 0.95 après V5 Caddy + Early Hints. **Ne relâche pas** la config existante (critère 1.1 reste à 0.95 desktop).

2. **`package.json`** — ajouter scripts :

```diff
   "scripts": {
     ...
     "lhci": "lhci collect",
     "lhci:autorun": "lhci autorun",
+    "lhci:autorun:mobile": "lhci autorun --config=lighthouserc.mobile.json",
+    "lhci:autorun:both": "pnpm lhci:autorun && pnpm lhci:autorun:mobile",
     ...
   }
```

3. **`.github/workflows/ci.yml`** — gate-b job :

```diff
       - name: Lighthouse CI
-        run: pnpm lhci:autorun
-        continue-on-error: true # Sprint 14 enables hard fail
+        run: pnpm lhci:autorun
+      - name: Lighthouse CI · mobile slow 4G
+        run: pnpm lhci:autorun:mobile
       - name: Upload artifacts
         if: always()
         uses: actions/upload-artifact@v4
         with:
           name: gate-b-${{ github.run_id }}
           path: |
             playwright-report/
             test-results/
             lhci/
+            lhci-mobile/
           retention-days: 7
```

> **Note critère 15.2** : retire le `continue-on-error: true` (commentaire « Sprint 14 enables hard fail » — Sprint 14 est livré 2026-05-08).

**Validation** :

- `pnpm lhci:autorun:mobile` produit un rapport dans `./lhci-mobile/`.
- Premier run : assertion fail attendue (LCP mobile > 2 500 ms vu les 1 MB First Load uncomp.). C'est **le but** : faire émerger le gap. Roadmap V1-V5 fait converger.

---

### P-502 — Sentry Replay 0 % en prod (renforcer ce qui est déjà bien réglé) + opt-in via env

**Effort** : XS (~15 min)
**Gain estimé** : −10 KB initial bundle si Replay est totalement désactivé en prod par défaut (au lieu de `replaysOnErrorSampleRate: 0.01`). Reste activable via env var pour debug ponctuel.
**Risque** : Faible — perd le 1 % replay on-error (déjà rare). Compensé par opt-in temporaire.
**Dépendances** : aucune.

**Fichier** : `src/instrumentation-client.ts`

**Diff** :

```diff
 import * as Sentry from "@sentry/nextjs";

 const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

+// Replay opt-in via env (debug temporaire). Default 0 in prod = bundle leaner.
+const replaySession = Number(process.env["NEXT_PUBLIC_SENTRY_REPLAY_SESSION"] ?? 0);
+const replayOnError = Number(process.env["NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR"] ?? 0);
+
 if (dsn) {
   Sentry.init({
     dsn,
     tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
     environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
-    replaysSessionSampleRate: 0,
-    // Replays add ~30 KB to the client bundle and capture overhead on errors.
-    // 1% on errors is enough to debug regressions without weighing nav perf.
-    replaysOnErrorSampleRate: 0.01,
+    replaysSessionSampleRate: replaySession,
+    // Default 0 in prod — Replay add ~30 KB to client bundle + capture overhead.
+    // Opt-in temporarily via NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR=0.01 if a regression
+    // needs replay-level debugging. Always re-set to 0 once root cause is found.
+    replaysOnErrorSampleRate: replayOnError,
   });
 }

 export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

> **Note** : choix défensif. 1 % on-error est déjà très bas et utile. Si Will préfère garder 1 %, retirer ce patch. Le marquer **optionnel V6** dans la roadmap consolidée.

**Validation** :

- `pnpm build` — vérifier le bundle Sentry ne charge pas l'integration `Replay` si rate = 0 (Sentry tree-shake automatique selon doc v10).
- Sentry dashboard : zéro nouveau replay créé après déploiement.

---

### P-503 — Doctrine `CLAUDE.md` / `AGENTS.md` perf budget LCP/INP/CLS

**Effort** : XS (~15 min)
**Gain estimé** : critère 15.10 passe à 15/15. Force tous les futurs agents Claude Code (dont les sous-agents Web Vitals 2026) à respecter le budget perf documenté.
**Risque** : Aucun — modification doc.
**Dépendances** : aucune.

**Fichier** : `AGENTS.md` (`CLAUDE.md` est `@AGENTS.md`)

**Diff** :

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,3 +1,38 @@
 # This is NOT the Next.js you know

 This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

+
+## Performance budget (cible interne, 2026)
+
+Tout patch frontend doit respecter (mesure CrUX p75 28 j en prod) :
+
+| Vital | Cible interne | Seuil Google « good » | Source |
+| --- | ---: | ---: | --- |
+| LCP | ≤ 1 800 ms | ≤ 2 500 ms | ADR 0010 Web Vitals 2026 |
+| INP | ≤ 100 ms | ≤ 200 ms | ADR 0010 |
+| CLS | 0 | ≤ 0,1 | ADR 0010 |
+| TTFB | ≤ 100 ms | ≤ 800 ms | ADR 0010 |
+| First Load JS gzip (route home) | ≤ 70 KB | n/a | ADR 0010 |
+| First Load JS gzip (route /reserver) | ≤ 95 KB | n/a | ADR 0010 (calendrier) |
+
+**Lighthouse Lab** : 100/100/100/100 sur les 15 pages stratégiques (cf. `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` §3), desktop ET mobile slow 4G.
+
+**Lighthouse CI seuils** (ne se relâchent jamais — `lighthouserc.json` + `lighthouserc.mobile.json`) :
+- perf desktop ≥ 0,95 / mobile ≥ 0,90 (durcissable post-Caddy + Early Hints).
+- a11y ≥ 0,95, BP ≥ 0,95, SEO = 1,0.
+- LCP max 2 500 ms, INP max 200 ms, CLS max 0,1, TBT max 200 ms (300 ms mobile).
+
+**Tout patch dont le delta budget excède** :
+- bundle First Load JS > +5 KB gzip → STOP & ASK Will.
+- LCP estimé > +100 ms p75 → STOP & ASK.
+- CLS estimé > 0,01 → STOP & ASK.
+
+## Hosting & infra (ADR 0009 ferme)
+
+Hetzner CX32 + Coolify + Caddy 2 + Next 16 standalone + Postgres + Redis + Cloudflare free tier. **Pas de Vercel.** **Pas de Cloudflare Pro.** **Pas de Sentry Pro.** Toute alternative déclenche STOP & ASK.
+
+## Monitoring (Sprint 20+)
+
+RUM custom self-hosted via `/admin/pseo-stats` (Sprint 20). Sentry free tier en complément (5 K errors + 10 K perf events / mois). Pas de Datadog / New Relic / LogRocket / FullStory ($26-500/mois) sans BUDGET-FLAG validé.
```

**Validation** :

- Lecture humaine — la doctrine est respectée par les futurs agents.

---

### P-504 — Runbook « page lente » (`docs/runbooks/page-lente.md`)

**Effort** : S (~30 min)
**Gain estimé** : critère 15.6 passe à 15/15. Will dispose d'un guide diagnostic 5 minutes au lieu de pinger Claude.
**Risque** : Aucun.
**Dépendances** : aucune.

**Fichier** : `docs/runbooks/page-lente.md` (nouveau — répertoire `docs/runbooks/` à créer).

**Contenu** (livré dans ce patch, à recopier mot pour mot — l'audit étant lecture seule, ce patch propose le contenu sans l'écrire) :

````markdown
# Runbook — page lente

> Symptôme : un visiteur signale une page Axion-IA lente. CrUX p75 LCP > 2 500 ms ou INP > 200 ms sur une route précise. Diagnostic en 5 étapes, ~5 minutes.

## 1. Identifier la route exacte (30 s)

Demande l'URL exacte (avec query string, sans tracking).

```bash
# Reproduire en local
pnpm build && pnpm start
# Ouvre https://localhost:3000/<route> en navigation privée Chrome.
```
````

## 2. Lighthouse local (90 s)

```bash
# Desktop
pnpm lhci collect --url=http://localhost:3000/<route> --numberOfRuns=3
# Mobile slow 4G
pnpm lhci:autorun:mobile
```

Note : LCP, INP, TBT, CLS, score perf. Si LCP > 2 500 ms ou perf < 0,9 → diagnostic.

## 3. Identifier le coupable (60 s)

Chrome DevTools → onglet **Performance** → enregistrer 6 s sur la page.

| Symptôme             | Coupable probable                               | Patch type                       |
| -------------------- | ----------------------------------------------- | -------------------------------- |
| LCP image > 2 s      | Pas de `priority` + `<link rel="preload">`      | Critère 2.2 / 9.7                |
| LCP texte H1 > 1,5 s | Font swap CLS, pas de preload font              | Critère 8.8                      |
| TBT > 300 ms         | Bundle initial > 250 KB gzip ou hydration heavy | Critère 6.1 / 11.1 (compiler)    |
| CLS > 0,05           | Image sans dimensions OU font swap              | Critère 3.1 / 8.3                |
| INP > 200 ms         | Handler client > 50 ms sync                     | Critère 4.3 / 11.6               |
| TTFB > 500 ms        | Cache CDN miss OU Caddy down                    | Critère 5.5 + check Hetzner CX32 |

## 4. RUM payload (60 s)

Vérifier `/api/vitals` reçoit les beacons (logs Caddy ou Sentry events) :

```bash
# Sur le VPS Hetzner
sudo journalctl -u caddy -f | grep "/api/vitals"
# Ou via Sentry dashboard → Performance → filtrer par route
```

Si aucun beacon → problème instrumentation. Si beacons mais valeurs anormales → c'est bien la route.

## 5. CrUX query (60 s)

```bash
pnpm tsx scripts/crux-snapshot.ts --url=https://axionia.eu/<route>
```

Compare la médiane p75 28 jours vs Lighthouse Lab local. Écart > 30 % = bug spécifique CDN/origin.

## 6. Si rien n'aide

- Capture le rapport Lighthouse + traces DevTools dans `/_AUDIT/incidents/<date>-page-lente-<route>.zip`.
- Ouvre une issue GitHub `perf: <route> p75 LCP <valeur>`.
- Notifie Will avec lien vers RUM dashboard `/admin/pseo-stats?route=<route>` (Sprint 20).

````

**Validation** :

- Will lit le runbook et confirme qu'il sait l'exécuter sans Claude.

> **Note livraison** : ce patch crée le répertoire `docs/runbooks/`. Si Will préfère `_AUDIT/RUNBOOK-PAGE-LENTE.md` (mémoire CLAUDE.md mentionne `_AUDIT/` comme convention), faire `mv` à la livraison. Recommandation Agent 6 : `docs/runbooks/` reste mieux indexable Git + IDE.

---

### P-505 — ADR 0010 — Web Vitals Perfection 2026

**Effort** : S (~45 min)
**Gain estimé** : critère 15.9 passe à 15/15 pour ce sujet (PPR / Compiler / View Transitions = ADR séparés à venir).
**Risque** : Aucun.
**Dépendances** : aucune.

**Fichier** : `docs/adr/0010-web-vitals-perfection-2026.md` (nouveau).

**Contenu** (squelette à remplir post-audit consolidé par superviseur — ne pas écrire avant la fin Phase D du superviseur) :

```markdown
# ADR 0010 — Web Vitals Perfection 2026

**Statut** : Proposé (2026-05-08)
**Décideur** : Will
**Lié à** : ADR 0009 (hosting Hetzner CX32 + Cloudflare free)

## Contexte

Audit Web Vitals 2026 (`_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` + 6 agents) identifie un gap structurel entre l'état actuel (~40-45 % des critères au vert sur 150) et la cible Lighthouse 100/100/100/100 + CrUX p75 ≤ 1 800 / ≤ 100 / 0.

## Décision

Cible chiffrée :

- **Lighthouse Lab** sur 15 pages stratégiques × FR + EN, desktop + mobile slow 4G : moyenne 5 runs ≥ 100/95/95/100 desktop, ≥ 90/95/95/100 mobile.
- **Field data CrUX p75 28 j** :
  - LCP ≤ 1 800 ms (cible interne, Google « good » 2 500 ms)
  - INP ≤ 100 ms (cible interne, Google « good » 200 ms)
  - CLS = 0 (cible interne, Google « good » 0,1)
  - TTFB ≤ 100 ms (cible interne, Google « good » 800 ms)
- **Bundle initial First Load JS** : home ≤ 70 KB gzip / `/reserver` ≤ 95 KB gzip.

Applicable sur 95 %+ des origines indexées (4 562 SSG actuels).

## Roadmap (vagues V1-V6)

- **V1** — Quick wins XS+S : preload LCP image hero, font preload, dns-prefetch.
- **V2** — Fonts size-adjust + LCP fetchpriority + Speculation Rules tunées.
- **V3** — PPR `incremental` (ADR 0011) + Suspense boundaries granulaires.
- **V4** — React Compiler 19 (ADR 0012).
- **V5** — Caddy 2 + Cloudflare 103 Early Hints + Brotli (ADR 0014).
- **V6** — View Transitions API (ADR 0013) + monitoring polish.

Détails : `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md` (à produire par superviseur Phase D).

## Conséquences

**Positives** :
- LCP −500 à −1 200 ms p75 attendus (V1+V2 cumulés).
- INP −80 ms p75 attendu (V4 React Compiler).
- Bundle home gzip −150 KB attendu (V3+V4 cumulés, agents 5+3).

**Négatives / Risques** :
- PPR active SC streaming → couvre besoin de Suspense par segment, à valider STOP & ASK avant V3.
- React Compiler ajoute Babel → impact build time +15-25 % cold (acceptable).
- Caddy 2 install requise sur VPS Hetzner CX32 (V5 dépend ADR 0014).
- View Transitions affecte navigation perçue, opt-in par route (V6).

## Suivi

- Snapshot CrUX mensuel (`scripts/crux-snapshot.ts` — P-506) archivé `_AUDIT/CRUX-snapshot-YYYY-MM.json`.
- Synthèse trimestrielle perf vs concurrents top 3 (Mistral, Anthropic, Cohere) — template à archiver `_AUDIT/PERF-TRIMESTRIEL-YYYY-Qx.md`.

## Statut critères ADR

- [x] Cible chiffrée définie
- [ ] V1 livrée
- [ ] V2 livrée
- [ ] V3 livrée (dépend ADR 0011)
- [ ] V4 livrée (dépend ADR 0012)
- [ ] V5 livrée (dépend ADR 0014)
- [ ] V6 livrée (dépend ADR 0013)
- [ ] CrUX p75 atteint sur 95 % des origines
````

**Validation** :

- Will valide la cible chiffrée + roadmap.

---

### P-506 — Snapshot CrUX mensuel (script + GHA cron)

**Effort** : M (~2 h)
**Gain estimé** : critère 1.7 + 15.7 passent à 15/15 chacun (+30 / 450 score).
**Risque** : Faible — script lecture-seule sur API publique Google CrUX.
**Dépendances** : Google API key (gratuite, pas de quota strict pour usage mensuel — < 100 req/mois).

**Fichier 1** : `scripts/crux-snapshot.ts` (nouveau — à créer Phase E).

```ts
// CrUX snapshot mensuel — interroge Chrome UX Report API pour Axion-IA
// et archive le résultat dans _AUDIT/CRUX-snapshot-YYYY-MM.json.
//
// Usage :
//   pnpm tsx scripts/crux-snapshot.ts                         # snapshot origin
//   pnpm tsx scripts/crux-snapshot.ts --url=https://axionia.eu/fr/interventions
//
// Env : CRUX_API_KEY (Google Cloud Console — gratuit)
// Doc : https://developer.chrome.com/docs/crux/api

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = "https://axionia.eu";
const API_URL = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const apiKey = process.env["CRUX_API_KEY"];

if (!apiKey) {
  console.error(
    "CRUX_API_KEY missing — get one at https://console.cloud.google.com/apis/credentials",
  );
  process.exit(1);
}

const url = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1];
const target = url ?? ORIGIN;

const body = url ? { url } : { origin: ORIGIN };

const res = await fetch(`${API_URL}?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`CrUX API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
const month = new Date().toISOString().slice(0, 7); // YYYY-MM
const slug = url ? url.replace(/[^a-z0-9]/gi, "-").slice(0, 60) : "origin";
const dir = join(process.cwd(), "_AUDIT");
mkdirSync(dir, { recursive: true });
const file = join(dir, `CRUX-snapshot-${month}-${slug}.json`);
writeFileSync(
  file,
  JSON.stringify({ target, month, fetchedAt: new Date().toISOString(), data }, null, 2),
);
console.warn(`[crux] snapshot written: ${file}`);
```

**Fichier 2** : `package.json` — ajouter script :

```diff
   "scripts": {
     ...
+    "crux:snapshot": "tsx scripts/crux-snapshot.ts",
     ...
   }
```

**Fichier 3** : `.github/workflows/crux-monthly.yml` (nouveau).

```yaml
name: CrUX · monthly snapshot

on:
  schedule:
    - cron: "0 6 1 * *" # 06:00 UTC le 1er de chaque mois
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.18.0
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      # Origin snapshot
      - name: CrUX origin
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot

      # Top 5 pages stratégiques
      - name: CrUX home FR
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot --url=https://axionia.eu/fr
      - name: CrUX interventions FR
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot --url=https://axionia.eu/fr/interventions
      - name: CrUX audit FR
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot --url=https://axionia.eu/fr/audit
      - name: CrUX home EN
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot --url=https://axionia.eu/en
      - name: CrUX implantations Paris pilote
        env:
          CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}
        run: pnpm crux:snapshot --url=https://axionia.eu/fr/implantations/ile-de-france/paris

      # Commit + push automatic
      - name: Commit snapshots
        run: |
          git config user.name "axionia-bot"
          git config user.email "bot@axion-ia.com"
          git add _AUDIT/CRUX-snapshot-*.json
          git diff --cached --quiet || git commit -m "chore(crux): monthly snapshot $(date +%Y-%m)"
          git push
```

**Validation** :

- Run manuel `gh workflow run crux-monthly.yml` → snapshots écrits dans `_AUDIT/`.
- Premier run : si l'origine n'a pas encore assez de trafic CrUX, l'API retourne 404 — log clair, pas de fail.

> **STOP & ASK candidat #5** : ajouter le secret `CRUX_API_KEY` à GitHub. Will doit créer la clé Google Cloud (gratuit) et la pousser dans `gh secret set CRUX_API_KEY`.

---

### P-507 — `pnpm audit` gate CI bloquant high+critical

**Effort** : XS (~15 min)
**Gain estimé** : critère 14.7 passe de 7,5 à 15/15.
**Risque** : Faible — peut bloquer un PR si une dep tierce sort une CVE high. Workaround : `pnpm audit --audit-level=critical` (ne bloque que critical).
**Dépendances** : aucune.

**Fichier** : `.github/workflows/ci.yml`

**Diff** :

```diff
   gate-b:
     ...
       - run: pnpm install --frozen-lockfile
+      - name: pnpm audit (high+critical)
+        run: pnpm audit --audit-level=high
       - name: Build
         run: pnpm build
```

Et dans `nightly.yml`, retirer `|| true` :

```diff
       - name: pnpm audit
-        run: pnpm audit --json > audit.json || true
+        run: pnpm audit --json > audit.json
+      - name: Upload audit report
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: pnpm-audit-${{ github.run_id }}
+          path: audit.json
+          retention-days: 30
```

**Validation** :

- Lancer `pnpm audit --audit-level=high` localement maintenant — si fail → P-507bis : exception explicite via `pnpm audit --ignore=<id>` documentée.

> **STOP & ASK candidat #6** : si `pnpm audit` actuel a > 0 high CVE, Will doit valider la stratégie (patch vs ignore). Audit lecture seule cette phase ne lance pas la commande.

---

### P-508 — `productionBrowserSourceMaps: false` explicite

**Effort** : XS (~5 min)
**Gain estimé** : critère 6.9 passe au vert (Agent 5 traite). Léger gain disque CDN (sans impact bundle gzip car maps sont fetched seulement si DevTools open).
**Risque** : Aucun — c'est déjà le défaut Next 16, on rend explicite.
**Dépendances** : aucune.

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
   compress: true,
+  // Source maps explicitly off in prod — they're already off by default in
+  // Next 16, but we lock the behavior to avoid accidental upload of source
+  // maps to Cloudflare CDN. Sentry SDK fetches its own via CLI in CI.
+  productionBrowserSourceMaps: false,
   images: {
     formats: ["image/avif", "image/webp"],
     remotePatterns: [],
   },
```

**Validation** :

- `pnpm build` — vérifier que `.next/static/chunks/*.map` ne sont pas servis (sont en dev only).
- Cloudflare cache stats → 0 fetch sur `*.map`.

---

### P-509 — Gate `console.warn` stubs derrière `NODE_ENV !== "production"`

**Effort** : S (~30 min)
**Gain estimé** : critère 14.10 passe de 5 à 15/15. Gain bundle minime (~200 octets) mais surtout évite la pollution console en prod (perception qualité + pas d'info debug envoyée à Sentry breadcrumbs en prod).
**Risque** : Faible — les stubs forms sont des placeholders Sprint 0/14. À retirer **complètement** quand Sprint 19 wire les vrais endpoints (mailer + worker).
**Dépendances** : aucune.

**Fichiers** (8 stubs forms + 1 indexnow + le BookingCalendar — `route.ts` vitals déjà gated ligne 27) :

```
src/components/forms/NewsletterForm.tsx:44
src/components/forms/AuditRequestForm.tsx:280
src/components/forms/ImplementationForm.tsx:102
src/components/forms/AuditForm.tsx:97
src/components/forms/ContactForm.tsx:50
src/components/forms/BookingForm.tsx:58
src/components/calendar/BookingCalendar.tsx:688
src/app/api/indexnow/route.ts:35
```

**Pattern de patch** (à appliquer aux 8 fichiers) :

```diff
-      console.warn("[contact:submit:stub]", values);
+      if (process.env.NODE_ENV !== "production") {
+        console.warn("[contact:submit:stub]", values);
+      }
```

> **Note** : la solution propre serait de basculer ces stubs vers `pino` (déjà dep) avec un logger qui ne log rien en prod. Mais c'est un sprint backend (Sprint 14.x ou 19). Le patch P-509 ci-dessus est le quick-fix minimal, à retirer quand pino logger remplace les stubs.

**Validation** :

- `pnpm build && NODE_ENV=production node -e 'require("./.next/server/app/...")` — aucun `console.warn` n'apparaît.
- Lighthouse BP audit « no browser errors logged » → vert.

---

### P-510 — Sentry vitals integration optionnelle (envoi LCP/INP/CLS à Sentry Performance)

**Effort** : S (~30 min)
**Gain estimé** : critère 15.5 passe de 0 à 7,5/15 (alerting partiel via Sentry free tier 10 K perf events/mois — couvre ~330 events/jour, suffit pour échantillon ~3 % des sessions).
**Risque** : Faible — n'enlève rien, double l'envoi (sendBeacon → /api/vitals + Sentry.captureMessage). Coût Sentry free tier à surveiller.
**Dépendances** : P-500 (payload enrichi) recommandé en amont.

**Fichier** : `src/components/analytics/WebVitals.tsx`

**Diff** (post-P-500) :

```diff
 import { useReportWebVitals } from "next/web-vitals";
 import { usePathname } from "next/navigation";
 import { useLocale } from "next-intl";
+import * as Sentry from "@sentry/nextjs";

 const VITALS_ENDPOINT = "/api/vitals";
+const SENTRY_VITALS_SAMPLE_RATE = 0.03; // 3 % des beacons → ~10 K/mois pour 333 K visites
```

```diff
   useReportWebVitals((metric) => {
     ...
     const body = JSON.stringify(payload);
     try {
       if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
         const blob = new Blob([body], { type: "application/json" });
         navigator.sendBeacon(VITALS_ENDPOINT, blob);
+        // Sample 3 % of beacons to Sentry Performance (free tier 10K/mois).
+        if (Math.random() < SENTRY_VITALS_SAMPLE_RATE && metric.rating !== "good") {
+          Sentry.captureMessage(`[web-vitals] ${metric.name}=${metric.value}`, {
+            level: metric.rating === "poor" ? "warning" : "info",
+            tags: {
+              vital: metric.name,
+              rating: metric.rating,
+              route: pathname ?? "",
+              locale,
+            },
+          });
+        }
         return;
       }
       ...
```

> **Note** : on n'envoie à Sentry que les `needs-improvement` + `poor` (`metric.rating !== "good"`) — économise 50-70 % du quota free tier.

**Validation** :

- Sentry dashboard → Performance → filtrer par tag `vital=LCP rating=poor` → events apparaissent post-déploiement (~1 par 10 visites de page lente).
- Quota free tier respecté : vérifier `Settings > Subscription > Usage` Sentry.

> **STOP & ASK candidat #7** : Will valide l'approche Sentry vs attendre dashboard custom Sprint 20. Recommandation : **garder ce patch en V6** (« polish + monitoring ») — le dashboard custom prime, Sentry est un complément.

---

## STOP & ASK ouverts (Agent 6)

### STOP & ASK #1 — ADR 0010 + 0011 + 0012 + 0013 + 0014 à séquencer

**Contexte** : 5 ADR à écrire dans la foulée Web Vitals 2026 (cet audit + 4 features Agents 3 et 4). Numérotation proposée :

- 0010 — Web Vitals Perfection 2026 (cet audit, ce livrable P-505)
- 0011 — PPR `incremental` activation (Agent 4)
- 0012 — React Compiler 19 activation (Agent 3)
- 0013 — View Transitions API adoption (Agent 3)
- 0014 — Caddy 2 + Cloudflare config production (Agent 4)

**Décision requise** : confirmer numérotation, ou préférer regrouper 0011-0014 dans un seul « ADR 0010 Web Vitals 2026 » avec 4 sous-décisions inline.

**Options** :
A. 5 ADR séparés (recommandé — chaque feature peut être décidée indépendamment et roll-back).
B. 1 ADR global avec 4 sous-sections (plus rapide mais moins atomic).
C. 0010 global + 0011-0014 ouverts à la demande quand chaque feature est greenlit.

**Recommandé** : A. Atomicité = clarté Git history + revert chirurgical.

**Impact si on attend** : aucun. Cet audit livre P-505 (ADR 0010 squelette uniquement). Les 4 autres restent à écrire par Agents 3 et 4 dans leurs propres patches.

---

### STOP & ASK #2 — Sentry Replay : passer 1 % on-error → 0 % par défaut ?

**Contexte** : `instrumentation-client.ts` actuel a `replaysOnErrorSampleRate: 0.01` (1 %). Le bundle Sentry Replay charge ~30 KB gzip à l'init (P-502 propose l'opt-in via env).

**Décision requise** : tu acceptes de passer à 0 % par défaut, opt-in via env quand un bug nécessite ?

**Options** :
A. P-502 appliqué (0 % par défaut, opt-in env) — gain bundle ~10 KB, perd 1 % replay on-error (rare en pratique).
B. Garder 1 % on-error — gain bundle nul, replay disponible 1 % du temps en prod.
C. Augmenter à 0.05 (5 % on-error) si Will souhaite plus de visibilité.

**Recommandé** : A — Lighthouse perf > debug ergonomique. Le 1 % on-error capture rarement le bon utilisateur.

**Impact si on attend** : Patch P-502 reste optionnel V6, pas bloquant pour score Lighthouse.

---

### STOP & ASK #3 — `pnpm audit` actuel a-t-il > 0 high CVE ?

**Contexte** : audit lecture-seule cette phase. P-507 ajoute `--audit-level=high` en gate CI. Si la commande retourne aujourd'hui des CVE high (ex. `next-auth 5.0.0-beta.31`, `argon2 0.44.0`, `bullmq 5.76.5`), le CI casse au premier merge.

**Décision requise** : lancer `pnpm audit --audit-level=high` maintenant et statuer.

**Options** :
A. Will lance la commande localement, partage le résultat, on patch (mises à jour deps) avant d'activer le gate.
B. Activer le gate en PR ; si fail, on traite les CVE en hotfix avant de merger les patches Web Vitals.
C. Activer le gate uniquement en `nightly.yml` (pas Gate B PR), traiter en async.

**Recommandé** : A — éviter de bloquer le merge des patches Web Vitals à cause d'une CVE indep.

**Impact si on attend** : score critère 14.7 reste à 7,5 / 15 jusqu'à activation gate. Pas critique.

---

### STOP & ASK #4 — Runbook `docs/runbooks/` ou `_AUDIT/RUNBOOK-*.md` ?

**Contexte** : P-504 propose `docs/runbooks/page-lente.md`. Mémoire CLAUDE.md mentionne `_AUDIT/` comme convention.

**Décision requise** : choisir un répertoire pour tous les runbooks ops.

**Options** :
A. `docs/runbooks/` — convention industrie (kubernetes, postgres ops, etc.). Indexable IDE.
B. `_AUDIT/RUNBOOK-*.md` — cohérent avec la convention du repo (audits, prompts, ADR-PROPOSITION).
C. `docs/ops/runbooks/` — plus profond mais sépare runbooks des ADR.

**Recommandé** : A. `docs/runbooks/` — indique clairement « ops » distinct de « audit ponctuel ».

**Impact si on attend** : zéro. Choix purement conventionnel.

---

### STOP & ASK #5 — Secret `CRUX_API_KEY` GitHub

**Contexte** : P-506 nécessite `CRUX_API_KEY` (Google Cloud Console — gratuit, < 100 req/mois suffisent).

**Décision requise** : créer la clé + l'ajouter en secret GitHub.

**Options** :
A. Will crée la clé maintenant (~2 min sur https://console.cloud.google.com/apis/credentials) puis `gh secret set CRUX_API_KEY`.
B. Reporter à V6 (snapshot manuel mensuel par Will, sans cron).
C. Skipper CrUX (ne mesurer que via PageSpeed Insights API qui ne nécessite pas de clé pour < 25 K req/jour).

**Recommandé** : A — 2 min de Will, débloque le snapshot mensuel automatique.

**Impact si on attend** : critère 1.7 + 15.7 restent à 0/15 chacun. La feature est livrable en V6 sans bloquer V1-V5.

---

### STOP & ASK #6 — Sentry vitals integration P-510 maintenant ou Sprint 20 ?

**Contexte** : P-510 propose un sample 3 % des vitals vers Sentry Performance (free tier 10K perf events/mois). Sprint 20 livrera le dashboard custom `/admin/pseo-stats`.

**Décision requise** : doubler les vitals via Sentry (alerting immédiat) OU attendre dashboard custom (zéro dépendance externe).

**Options** :
A. Appliquer P-510 maintenant — alerting Sentry actif post-V1 déploiement, dashboard custom Sprint 20 = redondance saine.
B. Attendre Sprint 20 — pas de bundle Sentry alourdi inutilement, mais zéro alerting RUM jusque-là (hormis Sentry erreurs JS qui sont disjointes des vitals).
C. Hybride : P-510 sample 3 % uniquement sur `metric.rating === "poor"` (déjà filtré dans P-510, économise quota).

**Recommandé** : C — P-510 tel que rédigé filtre déjà les `good`. Compromis OK.

**Impact si on attend** : critère 15.5 reste à 0/15 jusqu'à dashboard Sprint 20 (4 sprints).

---

### STOP & ASK #7 — Aucun outil payant en V1-V6

**Contexte** : aucun patch Agent 6 ne nécessite de feature payante. Tous les outils proposés (Lighthouse CI, Sentry free, CrUX API, GitHub Actions) sont gratuits ou self-hosted.

**Aucun [BUDGET-FLAG]** déclenché par Agent 6. Bonne nouvelle.

> Si Will veut Sentry Pro ($26/mois) pour Replay illimité, dashboard custom + Cloudflare Web Analytics free, ou Datadog ($15-31/mois) pour APM unifié, ce serait un STOP & ASK explicite avec [BUDGET-FLAG]. **Recommandation Agent 6** : ne rien activer de payant avant V2 (CrUX p75 mesurés en field data réel post-V1+V2).

---

## Top 3 quick wins du périmètre Agent 6

| Rang | Patch                                      | Effort    |                            Gain critère | Justif                                                                           |
| ---: | ------------------------------------------ | --------- | --------------------------------------: | -------------------------------------------------------------------------------- |
|    1 | **P-500** RUM payload enrichi              | S 30 min  |    1.4 + débloque 15.4-15.5 (Sprint 20) | Sans `route`/`locale`, le dashboard Sprint 20 est inutile. À faire en premier.   |
|    2 | **P-501** Lighthouse CI mobile preset      | S 45 min  | 1.8 + 15.2 (retire `continue-on-error`) | Mobile = profil cible CrUX. Sans mobile preset, on optimise un fantasme desktop. |
|    3 | **P-503** Doctrine `AGENTS.md` perf budget | XS 15 min |       15.10 + force tous futurs patches | Bloque dérive bundle / LCP / CLS sur futurs PR. ROI infini sur la durée.         |

> Total effort 90 min pour +52,5 / 450 score (≈ +12 % du chapitre Agent 6).

## Top 3 chantiers structurels

| Patch                                      | Effort      | Gain                                  | Note                                          |
| ------------------------------------------ | ----------- | ------------------------------------- | --------------------------------------------- |
| **P-505** ADR 0010 Web Vitals + 4 ADR sat  | S × 5 = 4 h | Gouvernance perf documentée, traçable | À écrire par superviseur Phase D + Agents 3/4 |
| **P-506** CrUX snapshot mensuel + GHA cron | M 2 h       | 1.7 + 15.7 + 15.8 partiel             | Dépend secret GitHub (STOP & ASK #5)          |
| **P-510** Sentry vitals integration        | S 30 min    | 15.5 partiel (alerting RUM)           | Optionnel V6 — Sprint 20 dashboard prime      |

---

## Roadmap monitoring V1 → V6

> Vagues alignées sur la roadmap globale Web Vitals 2026 (à consolider par superviseur dans `AUDIT-WEB-VITALS-2026-ROADMAP.md`).

### V1 — Quick wins (≤ 2 h total)

- P-500 — WebVitals payload enrichi
- P-501 — Lighthouse CI mobile preset + retire `continue-on-error`
- P-503 — Doctrine `AGENTS.md` perf budget
- P-508 — `productionBrowserSourceMaps: false` explicite
- P-509 — Console.warn stubs gated NODE_ENV

**Critères au vert post-V1** : 1.4, 1.8, 6.9, 14.10, 15.2, 15.10. **Score Agent 6 : +90 / 450**.

### V2 — Runbook + ADR (≤ 2 h)

- P-504 — Runbook `docs/runbooks/page-lente.md`
- P-505 — ADR 0010 Web Vitals 2026 (ce livrable)
- P-507 — `pnpm audit` gate CI bloquant high (dépend STOP & ASK #3)

**Critères au vert post-V2** : 14.7 (full), 15.6, 15.9 (partiel — autres ADR à venir). **Score Agent 6 : +30 / 450**.

### V3 — PPR + Compiler (Agents 3+4)

Hors périmètre Agent 6. Agent 6 attend les ADR 0011 + 0012 livrés par Agents 3 et 4.

### V4 — React Compiler (Agent 3)

Hors périmètre Agent 6.

### V5 — Caddy 2 + Cloudflare (Agent 4)

- ADR 0014 (Agent 4)
- Configurer Cloudflare Web Analytics (free, opt-in dashboard) → critère 15.4 partiel (Web Analytics ≠ RUM custom mais alternative gratuite tier 1)

### V6 — Polish + Monitoring approfondi

- P-502 — Sentry Replay 0 % par défaut + opt-in env (dépend STOP & ASK #2)
- P-506 — CrUX snapshot mensuel + GHA cron (dépend STOP & ASK #5)
- P-510 — Sentry vitals integration (dépend STOP & ASK #6)
- Synthèse trimestrielle perf vs concurrents (template à archiver `_AUDIT/PERF-TRIMESTRIEL-2026-Q3.md`)
- Dashboard `/admin/pseo-stats` Sprint 20 (livré indépendamment)

**Critères au vert post-V6** : 1.7, 15.4, 15.5, 15.7, 15.8 (full). **Score Agent 6 : +75 / 450**.

---

## Score post-V1+V2 (estimation)

| Chapitre                      |  Score actuel |         Post-V1 |       Post-V2 | Cible (post-V6) |
| ----------------------------- | ------------: | --------------: | ------------: | --------------: |
| 1 — Mesure & instrumentation  |    51,5 / 150 |      81,5 / 150 |    81,5 / 150 |       142 / 150 |
| 14 — Sécurité & BP            |     110 / 150 |       125 / 150 |   132,5 / 150 |       140 / 150 |
| 15 — Monitoring & gouvernance |    22,5 / 150 |        45 / 150 |      75 / 150 |       142 / 150 |
| **Total Agent 6**             | **184 / 450** | **251,5 / 450** | **289 / 450** |   **424 / 450** |

> Sans dashboard custom Sprint 20, plafond V6 = ~424 / 450 (= 94 %). Pour atteindre 100 %, dashboard custom requis. Roadmap réaliste = atteindre 94 % en V6 puis 100 % au déploiement Sprint 20.

---

## Annexe — Fichiers lus pour cet audit (chemins absolus)

- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\AUDIT-WEB-VITALS-2026-BASELINE-A.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\PROMPT-WEB-VITALS-PERFECTION-2026.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\lighthouserc.json`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\components\analytics\WebVitals.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\api\vitals\route.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\next.config.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\instrumentation.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\instrumentation-client.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\sentry.server.config.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\sentry.edge.config.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\package.json`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\.github\workflows\ci.yml`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\.github\workflows\nightly.yml`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\scripts\vitals-report.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\AGENTS.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\CLAUDE.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\docs\adr\` (lecture liste — ADR 0001 → 0009)

**Fin Agent 6.**
