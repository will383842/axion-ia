# PROMPT v2 — Admin crash deep audit & fix end-to-end (autopilot multi-agent)

> **Type** : audit profond bout-en-bout + fix autopilot du crash admin `/fr/admin-<prefix>/login`.
> **Modèle recommandé** : Claude Opus 4.7 (1M context) en fast mode.
> **Mode** : autopilot complet — STOP & ASK uniquement sur 4 cas catastrophiques (§30).
> **Best practices 2026** : Sentry-first, multi-agent parallèle, local repro, cite-don't-guess, anti-hallucination strict.
> **Différences vs v1** : ajout Sentry priorité #1, reproduction locale `pnpm dev`, sourcemaps prod temporaires, git bisect, CSP check, buildID check, dichotomie Client Components, désactivation Server Actions test, fallback Playwright.

---

## 0. PHRASE D'INVOCATION (copier-coller dans nouvelle conversation Claude Code Opus 4.7)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-CRASH-DEEP-AUDIT-2026-05-18-v2.md.

Mission unique : identifier la VRAIE cause root du crash admin
"An unexpected response was received from the server" (Next.js error E394)
sur https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login + appliquer le fix
définitif. 8 heures de session précédente ont échoué à le résoudre malgré
4 fix codés. Toutes les pistes superficielles épuisées.

Méthode : Sentry d'abord (5 min), puis reproduction locale parallèle à
l'investigation prod, sub-agents //, tests reproductibles, anti-halluc strict.

Autorisation Will déjà donnée pour : tout commit/push/SSH/Coolify/Docker/Sentry.
NE PAS S'ARRÊTER sauf 4 cas catastrophiques §30.
Confirme par "GO admin crash deep audit v2" et démarre Phase 0.
```

---

## 1. CONTEXTE EXHAUSTIF (lire intégralement, self-contained)

### 1.1 Symptôme exact

`https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login` :

1. SSR retourne 200 + HTML form login valide (confirmé `curl`).
2. Au mount client React, error boundary fire **avant click utilisateur**.
3. Écran affiche : "Une erreur est survenue dans la console / La page admin n'a pas pu se charger / L'incident a été automatiquement signalé".
4. DevTools console :
   ```
   Error: An unexpected response was received from the server.
       at /_next/static/chunks/8000-XXX.js:1:52346
       at Generator.next
       at n (...8000-...js:1:264633)
       at i (...8000-...js:1:264830)
   ```
5. Pattern stack : `ug → uh → ug → uh →` répété ~80-200× = React commit/passive effects loop.
6. `error.digest: undefined` = erreur **100% client-side**.
7. `error.name: Error`, `error.cause: undefined`.

### 1.2 Code source qui throw (chunk minifié)

```js
F = !!(I && I.startsWith(i.RSC_CONTENT_TYPE_HEADER));
if (!F && !D) throw new Error("An unexpected response was received from the server.")
```

C'est dans `packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts:283-290`. `fetchServerAction` throw quand response d'un POST n'a NI `content-type: text/x-component`, NI header `x-action-redirect`.

### 1.3 Stack technique

```
Next.js 16.2.6
Auth.js v5.0.0-beta.31 (NextAuth)
next-intl 4.11
React 19.2.4
Prisma 5.22
Postgres + Redis (Coolify-managed Hetzner CPX42)
Cloudflare proxy (DNS + cache)
Caddy 2 (reverse proxy)
Sentry intégré (côté server + client lazy via requestIdleCallback)
ADMIN_URL_PREFIX = "admin-xfz5hk0j7hrk"
EN_LOCALE_ENABLED = false
```

### 1.4 14 tentatives session précédente (TOUTES échoué côté résolution finale)

Pipeline OOM résolu (cycles 1-7 D4-QW1 SSG villes), migrations Prisma OK (5 manquantes appliquées), Coolify queue débloquée, disque cleanup OK. **MAIS** crash admin persiste après tous les fix codés (b80eef1, 9432e16, c33a831, 8d73d19).

Audit 4 sub-agents précédent : confirme E394 vient de `fetchServerAction` POST → response sans `text/x-component` → throw. Fix `c33a831` applique pattern Next.js #65394 (303 + `x-action-redirect`) mais pas encore validé en prod (Coolify ne pull pas la nouvelle image).

### 1.5 État Git actuel

```
HEAD origin/main : 8d73d19
Prod sert encore : b80eef1 (Coolify cache, multiple force-recreate ratés)
```

### 1.6 Workflows GitHub Actions disponibles

- `deploy-coolify.yml` (build & deploy auto sur push)
- `admin-emergency-migrate.yml` (SSH + Prisma migrate + container logs dump)
- `coolify-bypass-restart.yml` (SSH + docker pull + restart)
- `coolify-system-restart.yml` (SSH + `docker restart coolify`)
- `coolify-force-recreate.yml` (SSH + pull + rmi tags + stop + rm + redeploy)
- `coolify-diagnose.yml`, `coolify-zombie-cleanup.yml`
- `disk-cleanup-prod.yml`
- `admin-enable-v2.yml`

### 1.7 Secrets disponibles

```
HETZNER_SSH_KEY, COOLIFY_API_TOKEN/URL/APP_UUID
CLOUDFLARE_API_TOKEN/ZONE_ID
GSC_OAUTH_*
```

**Pas de SENTRY token dans secrets** — Will doit fournir si nécessaire (cas §30-3).

### 1.8 Sentry configuration (à vérifier)

Fichiers à inspecter :
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts` ou `instrumentation-client.ts`
- `next.config.ts` (wrapper `withSentryConfig`)
- DSN public probablement dans `NEXT_PUBLIC_SENTRY_DSN` env var.

L'erreur est capturée par `error.tsx` admin avec `Sentry.captureException(error, { tags: { route: "admin", boundary: "adminPrefix-root" } })`. Donc l'event EXISTE dans Sentry avec tag `route:admin` + `boundary:adminPrefix-root`.

---

## 2. MISSION

🟢 **Admin login fonctionnel + design V2 visible** :
- Curl `/fr/admin-xfz5hk0j7hrk/login` → 200 + HTML form sans error boundary client.
- Will login → dashboard V2 affiché.
- 5 routes admin testées sans crash : `/`, `/login`, `/reservations`, `/users`, `/settings`.
- Console DevTools : zéro erreur E394.
- `x-axion-build-sha` header = HEAD SHA.

### 2.1 Mode opératoire — STRICT

- **TOUT AUTOPILOT.** STOP & ASK uniquement §30.
- **Multi-agent parallèle** Phase 1 et Phase 4 : jusqu'à 6 sub-agents //.
- **Anti-hallucination ABSOLU** :
  - Chaque assertion = preuve commande + output réel JOINT.
  - JAMAIS "probablement", "should work". Soit OUI (preuve), soit NON (preuve), soit "à tester (test = X)".
  - Si tu n'as pas vu une output, NE prétends PAS l'avoir vue.
- **Cite-don't-guess** : file_path:line, run_id, commit_sha, header exact, content-type exact.
- **Tests reproductibles** : chaque hypothèse a un test bash/curl qui PROUVE ou INFIRME.
- **Test fix in isolation** : chaque fix testé SEUL.
- **Don't fix what you can't reproduce** : reproduire local OU prod avant fix.

---

## 3. ARCHITECTURE PHASES (8 phases)

```
Phase 0 — Sentry FIRST + reality check (15 min)         ← NOUVEAU prio Sentry
Phase 1 — Audit profond 6 sub-agents // (1.5h)
Phase 2 — Setup local dev minimal en parallèle (30 min) ← NOUVEAU pour bisect
Phase 3 — Synthèse + ranking hypothèses (15 min)
Phase 4 — Tests reproductibles ciblés (1h)
Phase 5 — Application fix(es) (1.5-2h)
Phase 6 — Verification effective + smoke 5 routes (30 min)
Phase 7 — Verdict + livrables + mémoire (30 min)
```

Plafond cumulé : **8 h**.

---

## 4. PHASE 0 — SENTRY FIRST + REALITY CHECK (~15 min)

### 4.1 PRIORITÉ #1 — Sentry dashboard

**Avant tout autre check**, demander à Will :
1. URL du projet Sentry (probablement `https://sentry.io/organizations/<org>/issues/?project=axion-ia` ou similar).
2. **Will doit chercher les events avec tag `route:admin` + `boundary:adminPrefix-root`** dans les 24h.
3. Pour chaque event, capturer :
   - Le **digest** (devrait être renseigné côté Sentry même si client-side error).
   - Les **breadcrumbs** (toutes les requêtes réseau qui ont précédé le crash).
   - Le **full stack** avec sourcemaps déminifiés (Sentry les a souvent).
   - L'**URL exacte** qui a fail (souvent dans breadcrumbs network category).
   - Le **response status** + **response headers** capturés.

**Si Sentry a la réponse → on saute Phase 1 sub-agents et on passe direct à Phase 5 fix.**

Si Sentry pas accessible OU events introuvables → continuer Phase 0 normal.

### 4.2 Reality check git + runs + prod

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git rev-parse HEAD
git log --oneline -n 10
gh api 'repos/will383842/axion-ia/actions/runs?per_page=10' --jq '.workflow_runs[] | select(.name | contains("Build & Deploy") or contains("force-recreate")) | {id, name, status, conclusion, head_sha: .head_sha[0:7], created_at: .created_at[11:19]}'
curl -sI https://axion-ia.com/api/healthz | grep -i "x-axion-build-sha"
```

### 4.3 Reproduction du bug en prod (curl baseline)

```bash
# 1. SSR HTML retourne-t-il le form login ?
curl -s https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | grep -oE "(admin-form|admin-h1|LoginForm|admin-error|Une erreur est survenue)" | sort -u

# 2. RSC prefetch parent route (GET)
echo "--- /fr/admin-xfz5hk0j7hrk RSC GET ---"
curl -sI -H "RSC: 1" -H "Next-Router-Prefetch: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk | head -5

# 3. RSC GET de /login lui-même
echo "--- /fr/admin-xfz5hk0j7hrk/login RSC GET ---"
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -5

# 4. Server Action POST simulation
echo "--- Server Action POST ---"
curl -sI -X POST -H "Accept: text/x-component" -H "Next-Action: test_no_real_id" -H "Content-Type: text/plain;charset=UTF-8" --data '[]' https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -10

# 5. Sans cookies
echo "--- Sans cookies ---"
curl -sI -H "RSC: 1" -H "Cookie: " https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -5

# 6. SSE: trace _rsc query param
echo "--- _rsc query ---"
curl -sI "https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login?_rsc=abc123" | head -5
```

**Output attendu si fix `c33a831` était appliqué** :
- (2) → 200 (RSC prefetch parent non logged) OU 200 + `text/x-component`
- (4) → 303 + `x-action-redirect`

Si on voit encore 302/404 sur ces → fix `c33a831` pas en prod → force-recreate impératif AVANT de tester quoi que ce soit d'autre.

### 4.4 Build SHA prod = HEAD ?

```bash
PROD_SHA=$(curl -sI https://axion-ia.com/api/healthz | grep -i "x-axion-build-sha" | awk '{print $2}' | tr -d '\r' | cut -c1-7)
HEAD_SHA=$(git rev-parse HEAD | cut -c1-7)
echo "PROD=$PROD_SHA HEAD=$HEAD_SHA"
[ "$PROD_SHA" = "$HEAD_SHA" ] && echo "✅ Match" || echo "❌ MISMATCH — force-recreate FIRST"
```

Si mismatch → `gh workflow run coolify-force-recreate.yml -f expected_sha=$HEAD_SHA` puis attendre.

### 4.5 Stop & ask Phase 0

- Si Sentry pas accessible et Will indispo → noter, continuer Phase 1 sans Sentry.
- Si reality check fail (no SSH, no Coolify API) → §30-3.

Produit `axionia/_AUDIT/ADMIN-CRASH-DEEP-AUDIT-2026-05-18/00-REALITY-CHECK.md`.

---

## 5. PHASE 1 — AUDIT PROFOND 6 SUB-AGENTS PARALLÈLES (~1.5 h)

Spawn en 1 message avec 6 Agent calls.

### D1 — Reproduction Playwright (PRIORITÉ HAUTE — capture réseau complète)

Brief :
- Installe Playwright si manquant : `pnpm add -D @playwright/test playwright` + `pnpm playwright install chromium`.
- Crée `_AUDIT/.../d1-repro.spec.ts` :
  ```typescript
  import { test, expect } from "@playwright/test";

  test("admin login crash repro", async ({ page, context }) => {
    const requests: Array<{ url: string; method: string; headers: Record<string,string> }> = [];
    const responses: Array<{ url: string; status: number; headers: Record<string,string>; body?: string }> = [];
    const consoleMessages: Array<{ type: string; text: string }> = [];

    page.on("request", (req) => {
      requests.push({ url: req.url(), method: req.method(), headers: req.headers() });
    });

    page.on("response", async (res) => {
      const url = res.url();
      const headers = res.headers();
      let body: string | undefined;
      try {
        if (url.includes("admin") || res.status() >= 300) {
          body = (await res.text()).slice(0, 500);
        }
      } catch {}
      responses.push({ url, status: res.status(), headers, body });
    });

    page.on("console", (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on("pageerror", (err) => {
      consoleMessages.push({ type: "pageerror", text: err.toString() });
    });

    await page.goto("https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // attendre que l'error boundary fire

    await page.screenshot({ path: "_AUDIT/.../d1-screenshot.png" });

    const fs = require("fs");
    fs.writeFileSync("_AUDIT/.../d1-network.json", JSON.stringify({ requests, responses, consoleMessages }, null, 2));
  });
  ```
- Run : `pnpm playwright test _AUDIT/.../d1-repro.spec.ts --reporter=line --timeout=30000`
- **Identifier dans `d1-network.json` :**
  1. Toutes les responses avec status >= 300 OU content-type ≠ `text/x-component`/`text/html` quand RSC fetch.
  2. Toutes les console errors mentionnant "unexpected response".
  3. La séquence : quel request RSC fail, quelle URL, quel response status + content-type + body 200 chars.

LIVRABLE : `d1-rapport.md` + `d1-network.json` + `d1-screenshot.png`. Section "URL exacte coupable" avec preuve réseau.

**Fallback si Playwright fail à install** :
- Utiliser `puppeteer-core` + Chrome headless installé localement.
- OU demander à Will d'ouvrir DevTools → Network → reproduire → copier HAR → coller dans le repo.

### D2 — Sentry events fetch via API (en parallèle de D1)

Brief :
- Si Will a fourni Sentry org slug + project slug + token (auth bearer ou public DSN):
  ```bash
  curl -H "Authorization: Bearer $SENTRY_TOKEN" \
    "https://sentry.io/api/0/projects/$ORG/$PROJ/issues/?query=route%3Aadmin&statsPeriod=24h" | jq
  ```
- Récupérer les 5 derniers events tag `route:admin`.
- Pour chaque event, fetch `/api/0/issues/{id}/events/latest/` → breadcrumbs + stack + tags.
- LIVRABLE : `d2-sentry-events.json` + rapport avec :
  - Digest + URL exacte du request fail (depuis breadcrumb network)
  - Stack trace déminifié (si sourcemaps Sentry)
  - Browser version + OS de Will

### D3 — Code source audit complet flow admin

Lis EN ENTIER :
- `src/proxy.ts`, `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts` (si existe)
- `src/app/[locale]/(admin)/[adminPrefix]/{layout,page,error,loading,not-found}.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/login/{page,LoginForm}.tsx`
- `src/app/[locale]/layout.tsx`
- `src/features/admin-auth/actions.ts`
- `src/lib/feature-flags.ts`, `src/lib/csp.ts`
- `next.config.ts` (headers, redirects, rewrites)
- `sentry.*.config.ts`, `instrumentation-client.ts`

Identifie :
1. **Diagramme exhaustif du flow** request → response → mount → crash.
2. **CSP `connect-src`** : whitelist URLs autorisées pour fetch côté client. Si une URL n'y est pas, browser bloque silencieusement. Match avec URLs RSC fetches Next.js (`/fr/admin-*` etc.).
3. **next.config.ts headers()** : peuvent injecter des headers qui modifient le RSC response.
4. **buildID** : `next.config.ts` `generateBuildId()` ou Next auto. Si HTML render un buildID et JS chunks un autre → MPA fallback.
5. **TOUS les Server Actions exportés** + leur hash ID.
6. **Sentry config** : init mode (sync vs lazy), DSN, sample rate, ignored URLs.

### D4 — Cloudflare + Caddy interception

Hypothèse : CF ou Caddy strip/modify headers `RSC`, `Next-Action`, `Next-Router-Prefetch`, `x-action-redirect` ou content-type.

Tests :
```bash
# Direct depuis Internet (passe CF + Caddy)
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk

# Direct depuis le VPS (bypass CF + Caddy)
ssh root@178.105.55.15 'curl -sI -H "RSC: 1" -H "Host: axion-ia.com" http://localhost:3000/fr/admin-xfz5hk0j7hrk'

# Direct au container (bypass tout)
CONTAINER=$(ssh root@178.105.55.15 "docker ps --format '{{.Names}}' | grep -E '^[a-z0-9]{20,}-[0-9]+'" | head -1)
ssh root@178.105.55.15 "docker exec -i $CONTAINER sh -c 'apk add --no-cache curl >/dev/null 2>&1; curl -sI -H \"RSC: 1\" http://localhost:3000/fr/admin-xfz5hk0j7hrk'"
```

Comparer les 3 outputs. Si content-type diffère → CF ou Caddy strip headers.

Vérifier `Caddyfile` (probablement chez Coolify ou `infra/caddy/`).
Lister CF rules : `curl -H "Authorization: Bearer $CF_TOKEN" "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets" | jq`.

### D5 — git bisect entre fea4b2e et HEAD

Hypothèse : un commit spécifique entre `fea4b2e` (last green pre-refonte) et HEAD a introduit le crash.

```bash
git bisect start
git bisect bad HEAD
git bisect good fea4b2e
# Pour chaque commit, build local + repro Playwright en local
# Si bug fire → bad, sinon good
# git bisect run <script.sh>
```

**Coûteux** : ~10-15 builds locaux. Ne lancer que si Phase 1 D1+D2 n'ont pas trouvé la cause.

### D6 — Dichotomie Client Components root layout

Hypothèse : un Client Component dans `[locale]/layout.tsx` cause le crash sur admin route.

Composants à tester (commenter 1 par 1, rebuild local, retest) :
- `<WebVitals>` (déjà skip admin via regex)
- `<Plausible>` 
- `<RefererTracker>`
- `<CookieConsent>`
- `<Clarity>`
- `<Header>` (contient `<Link prefetch>` qui peut auto-prefetch RSC)
- `<Footer>`
- `<SkipToContent>`
- Sentry lazy init (`instrumentation-client.ts`)

Commenter par 2 (dichotomie), rebuild local, repro Playwright. **NE PAS PUSHER** ces tests — local uniquement.

LIVRABLE : `d6-isolation.md` avec quel composant est coupable (si trouvé).

---

## 6. PHASE 2 — SETUP LOCAL EN PARALLÈLE (~30 min)

Si bug pas reproduit en prod facilement, setup local minimal :

### 6.1 Stack Docker

```bash
# Postgres + Redis via docker-compose
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
docker compose -f infra/docker-compose.dev.yml up -d  # OU autre fichier compose
# Si pas de compose → créer minimal :
cat > /tmp/dev-stack.yml <<'EOF'
services:
  pg:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: axionia
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: axionia
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
EOF
docker compose -f /tmp/dev-stack.yml up -d
```

### 6.2 .env.local

```bash
cat > .env.local <<'EOF'
DATABASE_URL=postgresql://axionia:dev@localhost:5432/axionia
REDIS_URL=redis://localhost:6379
AUTH_SECRET=dev-secret-32-chars-minimum-aaaaaaaa
ADMIN_URL_PREFIX=admin-test
ADMIN_V2_ENABLED=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SKIP_ENV_VALIDATION=true
BULLMQ_DISABLED=true
EN_LOCALE_ENABLED=false
EOF
```

### 6.3 Init DB

```bash
pnpm prisma migrate deploy
pnpm db:seed  # si script seed admin user existe, sinon insert SQL manual
```

### 6.4 Run

```bash
pnpm dev
```

→ http://localhost:3000/fr/admin-test/login

### 6.5 Reproduction local

Si bug se reproduit local → diagnostic 10× plus rapide (logs server temps réel + sourcemaps actifs + pas de Cloudflare/Caddy).
Si bug NE se reproduit PAS local → cause = Cloudflare/Caddy/Coolify (D4 prioritaire).

---

## 7. PHASE 3 — SYNTHÈSE + RANKING (~15 min)

Croiser tous les findings D1-D6. Produire `02-PLAN-TESTS.md` :

```markdown
## Hypothèses ranked

| # | Hypothèse | Probabilité | Preuve (commande + output) |
|---|---|---|---|
| 1 | URL X retourne content-type Y | 90% | D1 Playwright network.json line N |
| 2 | ... | 70% | D2 Sentry breadcrumb |
| 3 | ... | 50% | D4 Cloudflare strip header |

## Plan tests (ordre)

T1 (15 min) — Activer sourcemaps prod
T2 (10 min) — Désactiver Server Action LoginForm temporaire
T3 (10 min) — ...
```

---

## 8. PHASE 4 — TESTS REPRODUCTIBLES (~1 h)

Pour chaque test :
1. Commit + push spécifique avec message `test(admin): T<N> hypothesis description`.
2. Wait deploy effective (`x-axion-build-sha` = HEAD).
3. Force-recreate si Coolify cache.
4. Curl + Playwright local + Playwright prod.
5. Documenter résultat avec output JOINT.
6. Revert si échec.

### T1 — Sourcemaps prod temporaires

`next.config.ts` : `productionBrowserSourceMaps: true`. Push + deploy. Open prod en DevTools → stack trace lisible (file:line réel).

**Note** : sourcemaps publics = leak code source. Acceptable temporairement, revert après diagnostic.

### T2 — Désactiver Server Actions LoginForm

Modifier `LoginForm.tsx` :
- Remplacer `useActionState(signInAction, ...)` par `useState` manuel.
- Remplacer `<form action={formAction}>` par `<form onSubmit={async (e) => { e.preventDefault(); /* fetch('/api/admin/login', ...) */ }}>`.
- Créer route handler `/api/admin/login` qui call `signInAction` internally.

Si bug disparaît → cause = Server Action mecanism. Si bug persiste → autre cause.

### T3 — Désactiver auth.config.ts middleware (test isolation)

`auth.config.ts` : `authorized()` retourne juste `return true` (laisse tout passer). Push + deploy + retest.

Si bug disparaît → cause = middleware redirect. Si bug persiste → autre cause.

### T4 — Désactiver Sentry init client

`instrumentation-client.ts` : commenter l'init. Push + deploy + retest.

### T5 — Désactiver tous les Client Components root layout sauf strict minimum

`[locale]/layout.tsx` : commenter `<WebVitals>`, `<Plausible>`, `<Clarity>`, `<RefererTracker>`, `<CookieConsent>`, `<Header>`, `<Footer>`. Rendre juste `<main>{children}</main>`. Push + deploy + retest.

### T6 — git bisect

Si T1-T5 inconcluants : git bisect Phase 1 D5.

---

## 9. PHASE 5 — APPLICATION FIX (~1.5-2h)

Options fix par ordre d'application :

### Option A — Fix middleware Auth.js complet

```typescript
authorized({ auth, request }) {
  const { nextUrl, headers } = request;
  const accept = headers.get('accept') ?? '';
  const isRsc = headers.get('rsc') === '1' || accept.includes('text/x-component');
  const isPrefetch = headers.get('next-router-prefetch') === '1';
  const isServerAction = !!headers.get('next-action');

  // Pour requêtes RSC/SA : JAMAIS Response.redirect (HTML 302)
  // → 303 + x-action-redirect (officiel #65394) ou 200 + text/x-component
  // ...
}
```

### Option B — Sortir page login du matcher proxy.ts

```typescript
export const config = {
  matcher: [
    "/((?!api|_next|.*\\.|admin-[a-z0-9]+/login).*)",
  ],
};
```

### Option C — Migration middleware → proxy (Next 16 codemod)

```bash
npx @next/codemod@canary middleware-to-proxy .
```

### Option D — Downgrade next-auth v5 beta → version stable

```bash
pnpm add next-auth@latest
```

(Vérifier que stable est dispo en mai 2026.)

### Option E — Redirect client-side au lieu de server

Modifier `page.tsx` dashboard pour rendre `<RedirectClient href="/login" />` au lieu de `redirect()` server. Client `router.push()` localement.

### Option F — Désactiver auto-prefetch Next 16

`next.config.ts` : `experimental.linkPrefetch: 'aggressive' | 'standard'` — tester valeurs différentes. OU sur les `<Link>` pertinents : `prefetch={false}`.

### Option G — Workaround custom : intercepter response côté server

Ajouter route handler `/api/admin/auth-check` qui retourne explicitement `text/x-component` body et fait le redirect via fetch côté client.

---

## 10. PHASE 6 — VERIFICATION (~30 min)

```bash
# 1. Build SHA prod = HEAD
curl -sI https://axion-ia.com/api/healthz | grep "x-axion-build-sha"

# 2. RSC GET /login retourne 200 + text/x-component
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login

# 3. RSC GET parent retourne 200 + text/x-component (pas 302)
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk

# 4. Server Action POST retourne 303 + x-action-redirect
curl -sI -X POST -H "Accept: text/x-component" -H "Next-Action: x" --data '[]' https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login

# 5. Playwright headless retest → 0 console errors E394
pnpm playwright test _AUDIT/.../verify-admin.spec.ts

# 6. Will retest manuel → V2 visible, login works
```

Tous DOIVENT passer.

---

## 11. PHASE 7 — VERDICT + LIVRABLES (~30 min)

- `VERDICT-FINAL.md` (verdict + cause root + fix appliqué + smoke results + durée + cost)
- `EXEC-SUMMARY-WILL.md` (≤ 50 lignes non-tech)
- `MANIFEST.md`
- Update mémoire + entrée MEMORY.md
- Tag `admin-crash-fixed-2026-05-18` HEAD
- Push tags
- Cleanup debug logs verbeux (commit séparé `chore(admin): remove debug logs from session 2026-05-18`)
- Re-activer speculation rules custom (commit séparé `feat(seo): re-enable custom speculation rules`)

---

## 12. STRUCTURE LIVRABLES

```
axionia/_AUDIT/ADMIN-CRASH-DEEP-AUDIT-2026-05-18/
├── 00-REALITY-CHECK.md
├── 01-DIAGNOSTIC-PROFOND-V2.md         (synthèse D1-D6)
├── 02-PLAN-TESTS.md
├── 03-TESTS-LOG.md                     (T1-T6)
├── 04-FIX-APPLIED.md
├── 05-VERIFICATION.md
├── VERDICT-FINAL.md
├── EXEC-SUMMARY-WILL.md
├── MANIFEST.md
├── d1-playwright/
│   ├── d1-repro.spec.ts
│   ├── d1-network.json
│   ├── d1-screenshot.png
│   └── d1-rapport.md
├── d2-sentry/
│   ├── d2-sentry-events.json
│   └── d2-rapport.md
└── d6-isolation.md
```

---

## 13. BEST PRACTICES CLAUDE 2026

### 13.1 Sentry-first

Si l'erreur est captée par Sentry, **vérifier Sentry AVANT toute autre investigation**. Sentry a souvent :
- Stack trace déminifié (sourcemaps uploadés au build)
- Breadcrumbs réseau (URL + status code de chaque request avant le crash)
- Browser version + OS user
- Replay session (si Sentry Replay actif)

→ Économise potentiellement des heures.

### 13.2 Local repro > prod repro

Setup local 30 min permet :
- Logs server temps réel (pas besoin SSH dump container)
- Sourcemaps actifs par défaut
- Pas de Cloudflare/Caddy/Coolify dans le path
- Bisect rapide (`git bisect` + rebuild local 30s vs cycle deploy 30 min)
- Modifier code + tester sans risque prod

→ Premier réflexe : reproduire le bug en local.

### 13.3 Multi-agent parallèle

6 sub-agents // > 1 séquentiel (gain 4-6×).
Brief chaque sub-agent comme un collègue qui arrive (contexte complet).
Max 6 simultanés (overhead synchro).

### 13.4 Anti-hallucination strict

- "Le RSC retourne 302" → JOINT `curl -sI ... | head -5` output.
- "L'image tag est X" → JOINT `docker inspect ... --format` output.
- Jamais "probablement" / "should". Toujours preuve commande + output.

### 13.5 Plan-then-execute

- Ne pas commencer à coder avant Phase 0 + 1 + 3 complétées.
- Tout fix a un test reproductible BEFORE/AFTER.

### 13.6 Tests reproductibles

- Chaque commande exécutable par Will avec MÊME résultat.
- Output joint au document.

### 13.7 Don't fix what you can't reproduce

- Si bug pas reproduit local OU via curl/Playwright → ne PAS fixer.
- Reproduire = preuve commande + output.

### 13.8 Test fix in isolation

- Chaque fix testé SEUL avant combinaison.
- Sinon impossible de bisecter.

### 13.9 Verbose logging temporaire

Si bloqué :
- Ajouter `console.log` server + client + middleware.
- Push + deploy + reproduire + collecter logs.
- Retirer après diagnostic (commit `chore: remove debug logs`).

### 13.10 Cite-don't-guess

- file_path:line, run_id, commit_sha, header exact, content-type exact.
- Pas de "dans le middleware quelque part".

---

## 14. PLAFONDS SÉCURITÉ

- ⏱️ Temps total : ≤ 8 h.
- 🔁 Tests Phase 4 : ≤ 10.
- 🔧 Commits fix : ≤ 10.
- 💸 Coût runner : ≤ $20.
- 🌐 Coolify deploy attempts : ≤ 15.
- 🛑 §30 si plafond dépassé.

---

## 15. RÈGLES COMMIT/PUSH

- Conventional Commits : `fix(admin)`, `chore(audit)`, `test(admin)`, `docs(audit)`, `revert(admin)`.
- Co-Authored-By: Claude Opus 4.7 (1M context).
- Pre-commit + pre-push hooks DOIVENT passer.
- ❌ JAMAIS `--no-verify` sauf §30.
- ❌ JAMAIS `--force` sur main.
- Si autre dev (Manon) push pendant la session → rebase propre + retry.

---

## 16. ANTI-PATTERNS

- ❌ Push fix sans test local (au moins typecheck + 1 curl).
- ❌ "Probablement X". Soit preuve, soit test.
- ❌ Modifier > 3 fichiers dans un commit (bisect impossible).
- ❌ Itérer Coolify deploy sans diagnostic.
- ❌ > 6 sub-agents //.
- ❌ Polling busy-loop. Utiliser Monitor.
- ❌ Re-run identique sans changer stratégie.
- ❌ Sauter Phase 0 Sentry pour aller direct à Playwright.
- ❌ Skip setup local si bug peut être reproduit local.

---

## 17. ROLLBACK SAFETY NETS

- Tag `deploy-unstuck-2026-05-18-success` → `229a0ff` (dernier état OK).
- `git revert <SHA>` + push.
- Coolify UI → Settings → Tag → ancien SHA → redeploy.

---

## 18. CHECKLIST FIN

```
[ ] Phase 0 Sentry checked + reality check produit
[ ] Phase 1 6 sous-agents // → 01-DIAGNOSTIC-PROFOND-V2.md produit
[ ] Phase 2 setup local fait (si applicable)
[ ] Phase 3 plan tests établi
[ ] Phase 4 tests T1-T6 exécutés (autant que nécessaire)
[ ] Phase 5 fix appliqué + tests verts
[ ] Phase 6 verification (5 tests curl + Playwright)
[ ] Phase 7 verdict + livrables
[ ] Tag `admin-crash-fixed-2026-05-18` posé + pushé
[ ] Will retest manuel → V2 visible, zero error console
[ ] Speculation rules réactivées (commit séparé)
[ ] Debug logs verbeux retirés (commit séparé)
[ ] Sourcemaps prod désactivés si activés en T1
```

---

## 19. RESSOURCES

- Session précédente : `axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/**`
- Audit 4 sub-agents précédent : cf. transcript dans `transcripts/CONVERSATION-2026-05-18-AUTOPILOT-DEPLOY.md`
- Next.js issues : [#65394](https://github.com/vercel/next.js/issues/65394), [#79346](https://github.com/vercel/next.js/issues/79346), [#87651](https://github.com/vercel/next.js/discussions/87651), [#89607](https://github.com/vercel/next.js/discussions/89607)
- Auth.js issues : [#9959](https://github.com/nextauthjs/next-auth/issues/9959), [#10704](https://github.com/nextauthjs/next-auth/discussions/10704), [#9144](https://github.com/nextauthjs/next-auth/issues/9144)
- Next.js 16 upgrade guide : https://nextjs.org/docs/app/guides/upgrading/version-16
- Coolify API : https://coolify.io/docs/api-reference/

---

## 20. PHRASE D'INVOCATION (rappel)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-CRASH-DEEP-AUDIT-2026-05-18-v2.md.

Mission unique : identifier la VRAIE cause root du crash admin
"An unexpected response was received from the server" (Next.js error E394)
sur https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login + appliquer le fix
définitif. 8 heures de session précédente ont échoué à le résoudre malgré
4 fix codés. Toutes les pistes superficielles épuisées.

Méthode : Sentry d'abord (5 min), puis reproduction locale parallèle à
l'investigation prod, sub-agents //, tests reproductibles, anti-halluc strict.

Autorisation Will déjà donnée pour : tout commit/push/SSH/Coolify/Docker/Sentry.
NE PAS S'ARRÊTER sauf 4 cas catastrophiques §30.
Confirme par "GO admin crash deep audit v2" et démarre Phase 0.
```

L'agent doit répondre par "GO admin crash deep audit v2" et démarrer Phase 0.

---

## 30. STOP & ASK (4 cas catastrophiques uniquement)

### Cas 1 — Plafonds dépassés
- Temps > 8 h.
- Tests > 10 sans succès.
- Coût runner > $20.
- Commits fix > 10.

### Cas 2 — Risque prod
- Action mettrait prod hors-ligne > 5 min.
- Découverte secret leaké.
- Force push main demandé.

### Cas 3 — Dépendances majeures
- Sentry token nécessaire et pas dans secrets (demander à Will).
- URL Coolify UI nécessaire et pas connue.
- Activation paid Coolify plan / paid runner.
- Reset complet Coolify app.
- Migration major version dependency.

### Cas 4 — Audit confirme bug upstream irréparable
- Bug Next.js / Auth.js sans workaround.
- Nécessite décision Will : migration Vercel/Render, downgrade major, rewrite auth flow.

Tout autre cas → continuer.

---

**Fin du prompt v2.**
