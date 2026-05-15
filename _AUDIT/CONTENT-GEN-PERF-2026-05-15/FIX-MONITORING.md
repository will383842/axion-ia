# FIX MONITORING — Audit RUM Web Vitals 2026-05-15 AGENT 8

> Statut : commit local, à pusher origin/main.
> Mode : fix code + commit autorisé (Will a levé AUDIT-ONLY 2026-05-15).
> Refs audit : §8.4 (helpers SSOT) · §8.7 (dashboard /admin/web-vitals) · §8.8 (Plausible Web Vitals plugin).

---

## TL;DR

3 P0 monitoring stack RUM Web Vitals fixés :

1. **Helpers SSOT alertes wirés** — `alertLcpDegraded` / `alertInpDegraded` / `alertClsDegraded` étaient définis dans `content-gen-alerts.ts` lignes 206-254 mais **0 caller** réel. Le worker `content-web-vitals-monitor-worker.ts` envoyait un `sendTelegram(body)` inline avec format divergent. → Désormais le worker utilise les helpers + un nouveau `alertWebVitalsBulk` pour les cas > 5 breaches.
2. **Dashboard admin `/admin/web-vitals` créé** — Nouvelle page SSR pure lisant le snapshot `ContentGenConfig.web_vitals_p75` (écrit par le worker nightly 02:30 UTC), avec fallback live compute sur `WebVitalSample` si vide. Tableau (route × metric × p75 × budget × statut × n × rating CrUX × lien PSI). Bouton "Forcer un recompute" enqueue un tick BullMQ.
3. **Plausible Web Vitals plugin activé** — Script Plausible étendu `.web-vitals.js` (extension Plugin officielle). `WebVitals.tsx` émet désormais un event `Web Vital` custom via `window.plausible(...)` parallèlement au POST `/api/vitals`.

Score AGENT 8 attendu post-fix : `Helpers SSOT 100 %` · `Dashboard 100 %` · `Plausible plugin 100 %`. CrUX API key reste action Will.

---

## 1. Helpers SSOT wirés (§8.4)

### 1.1 Refonte signature

**Avant** (`src/server/content-gen/shared/content-gen-alerts.ts`) :

```ts
export async function alertLcpDegraded(p75ms: number, pageType: string): Promise<void>;
```

Signature insuffisante : pas d'URL exacte, pas de budget AGENTS.md, pas de count samples. Le worker ne pouvait pas utiliser ces helpers sans perdre de l'info.

**Après** :

```ts
export interface WebVitalBreachInput {
  readonly url: string; // pathname canonique (ex. /fr/interventions)
  readonly p75: number; // ms ou unitless CLS
  readonly budget: number; // AGENTS.md cible interne
  readonly count: number; // RUM samples 24h
}

export async function alertLcpDegraded(input: WebVitalBreachInput): Promise<void>;
export async function alertInpDegraded(input: WebVitalBreachInput): Promise<void>;
export async function alertClsDegraded(input: WebVitalBreachInput): Promise<void>;
export async function alertWebVitalsBulk(
  topBreaches: readonly (WebVitalBreachInput & { metric: string })[],
  totalBreaches: number,
  windowHours: number,
): Promise<void>;
```

Format Telegram uniformisé :

- `[⚠️ WEB_VITALS_DEGRADED]` (LCP/INP silent=true) ou `[🔴]` (CLS not silent — critical)
- p75 formaté ms entiers (LCP/INP) ou 3 décimales (CLS)
- Lien dashboard admin via `ADMIN_URL_PREFIX` env (jamais hardcodé)
- Lien direct PageSpeed Insights de la route fautive (NEW — utile runbook R30)
- Runbook référencé : `R30` (`docs/runbooks/R30-lighthouse-weekly.md`)

### 1.2 Worker câblé

`src/server/queue/workers/content-web-vitals-monitor-worker.ts` :

- Import `sendTelegram` **supprimé** → import `{ alertLcpDegraded, alertInpDegraded, alertClsDegraded, alertWebVitalsBulk }` from `@/server/content-gen/shared/content-gen-alerts`.
- Stratégie :
  - **≤ 5 breaches** : 1 helper dédié par metric core (LCP/INP/CLS). Les metrics non-core (FCP/TTFB/TBT) restent en bulk single-call (pas dans cible Web Vitals 2026 stricte AGENTS.md).
  - **> 5 breaches** : 1 alerte `alertWebVitalsBulk` avec top 5 (évite spam Telegram, format uniformisé).
- Snapshot DB `web_vitals_last_alert` conservé pour audit trail (lu par le dashboard).

---

## 2. Dashboard `/admin/web-vitals` (§8.7)

### 2.1 Routes

- Nouvelle page : `src/app/[locale]/(admin)/[adminPrefix]/web-vitals/page.tsx`
- URL prod (FR uniquement, doctrine CLAUDE.md §14) : `https://axion-ia.com/fr/<ADMIN_URL_PREFIX>/web-vitals`
- Lien ajouté dans sidebar admin (`layout.tsx`) groupe "Ops & monitoring" entre `/analytics` et `/infra`.

### 2.2 UI

- Server Component pur (`force-dynamic` justifié — lecture DB temps réel, pas de cache).
- Auth via `auth()` (cohérent autres pages admin : `analytics`, `alerts`, `infra`). Redirect vers `/fr/<prefix>/login` si !session.
- KPI grid : Samples 24h · Routes mesurées · Lignes hors budget · Source (snapshot vs live + timestamp).
- Card "Budgets référence (AGENTS.md)" : doctrine claire (cible interne stricte vs Google "good" plus laxiste).
- Card "Actions" : bouton form Server Action "Forcer un recompute" enqueue `contentWebVitalsMonitorQueue.add('tick', {trigger:'admin-recompute'})`. Disabled si BULLMQ_DISABLED. Affiche aussi `web_vitals_last_alert` (timestamp + count).
- Tableau principal :
  - Colonnes : Route (mono code) · Métrique · p75 (mono, gras si breach) · Budget · n · Statut (Hors budget / Budget OK) · Rating CrUX (Good/NI/Poor) · PSI ↗
  - Tri : breaches d'abord, puis p75/budget desc
  - Cap : top 200 lignes
  - PSI link = `https://pagespeed.web.dev/analysis?url=<encoded>`
- Card "Lecture rapide" : doctrine UX rappelée (Hors budget vs Rating CrUX, stack RUM, etc.).

### 2.3 Fallback live

Si `ContentGenConfig.web_vitals_p75` snapshot est vide (1ʳᵉ install, worker pas encore tourné, BULLMQ_DISABLED), la page compute **live** depuis `WebVitalSample` (window 24h, MIN_SAMPLES = 5, p75 = ceil(n\*0.75)-1, séparateur `` mirror du worker). Évite la page vide premier jour prod.

---

## 3. Plausible Web Vitals plugin (§8.8)

### 3.1 Script tag étendu

`src/components/analytics/Plausible.tsx` :

```diff
- src={`${apiUrl}/js/script.404.file-downloads.outbound-links.tagged-events.js`}
+ src={`${apiUrl}/js/script.404.file-downloads.outbound-links.tagged-events.web-vitals.js`}
```

Plausible exige l'ordre alphabétique des plugins. `.web-vitals` active le plugin autotrack + permet les emit manuels custom.

### 3.2 WebVitals.tsx — émission event "Web Vital"

`src/components/analytics/WebVitals.tsx` :

```ts
function emitPlausibleVital(props: PlausibleProps): void {
  if (typeof window === "undefined") return;
  const fn = (window as unknown as { plausible?: ... }).plausible;
  if (typeof fn !== "function") return;
  try { fn("Web Vital", { props }); } catch { /* swallow */ }
}
```

Appelé après le POST `/api/vitals` (parallèle, fail-soft, ne bloque pas le sendBeacon). Props envoyés : `{ metric, value: Math.round(value), rating, page: pathname }`. Round `value` pour limiter cardinalité Plausible.

Dashboard Plausible custom à créer côté plausible.axion-ia.com (action Will, hors scope code) : filtres par `metric` (LCP/INP/CLS), `rating` (good/needs_improvement/poor), `page` (template Next).

---

## 4. Tests

Nouveau spec : `src/server/content-gen/shared/__tests__/content-gen-alerts-web-vitals.spec.ts` — 7 tests, tous verts :

1. `alertLcpDegraded` accepte la signature objet + format LCP / runbook R30
2. `alertInpDegraded` formatte INP ms entiers
3. `alertClsDegraded` formatte CLS 3 décimales + critical (silent=false)
4. `alertWebVitalsBulk` agrège top breaches + counter total
5. `alertWebVitalsBulk` noop si liste vide (pas de Telegram parasite)
6. Fail-soft — `sendTelegram` throw → helper swallow
7. Lien PageSpeed Insights présent et URL-encodé

Suite full : `pnpm vitest run` → **849/852 passed** (1 échec snapshot pré-existant `AnswerCard.spec.tsx` — ordre classes Tailwind sans rapport, 2 skipped intentionnels).

Typecheck `pnpm typecheck` : **OK**, aucune erreur.

---

## 5. Fichiers modifiés

| Fichier                                                                         | Type    | Notes                                               |
| ------------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| `src/server/content-gen/shared/content-gen-alerts.ts`                           | modif   | Signature helpers Web Vitals refondue + bulk helper |
| `src/server/queue/workers/content-web-vitals-monitor-worker.ts`                 | modif   | Wire helpers SSOT, suppression sendTelegram inline  |
| `src/app/[locale]/(admin)/[adminPrefix]/web-vitals/page.tsx`                    | nouveau | Dashboard SSR `/admin/web-vitals`                   |
| `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`                             | modif   | Ajout entrée sidebar "Web Vitals" 📈                |
| `src/components/analytics/Plausible.tsx`                                        | modif   | Script `.web-vitals` plugin                         |
| `src/components/analytics/WebVitals.tsx`                                        | modif   | Emit Plausible event "Web Vital"                    |
| `src/server/content-gen/shared/__tests__/content-gen-alerts-web-vitals.spec.ts` | nouveau | 7 tests helpers SSOT                                |

---

## 6. Contraintes respectées

- Sentry conservé (slim déjà appliqué BATCH 2 — pas touché).
- Aucun service tier ajouté (CrUX API key reste action Will, hors code).
- BUDGETS interne AGENTS.md : LCP ≤ 1 800 ms · INP ≤ 100 ms · CLS = 0 (epsilon 0,01).
- `auth()` cohérent (pas `requireAdmin()` qui n'existe pas dans ce repo).
- `ADMIN_URL_PREFIX` env var partout (`adminUrl()` helper).
- Pas de `--no-verify`. Commit standard Conventional + Co-Authored-By.

---

## 7. Suite (hors scope)

- Dashboard Plausible custom Web Vitals (action Will côté plausible.axion-ia.com).
- CrUX API key intégration (`/admin/web-vitals` pourrait afficher un fallback CrUX field data — action Will + clé Google Cloud).
- V2 chart timeseries p75 par route (V1 minimal SSR pur, reporté).
- Lighthouse CI gate budget bundle (existe via `pnpm lhci` + size-limit — déjà actif AGENTS.md).
