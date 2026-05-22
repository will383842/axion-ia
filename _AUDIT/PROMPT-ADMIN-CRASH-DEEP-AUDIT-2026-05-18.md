# PROMPT — Admin crash deep audit & fix end-to-end (autopilot multi-agent)

> **Type** : audit profond bout-en-bout + fix autopilot du crash admin `/fr/admin-<prefix>/login` qui persiste depuis 8+ heures malgré multiples fixes.
> **Modèle recommandé** : Claude Opus 4.7 (1M context) en fast mode.
> **Mode** : autopilot complet — STOP & ASK uniquement sur 4 cas catastrophiques (§30).
> **Best practices 2026** : multi-agent parallèle, cite-don't-guess, plan-then-execute, anti-hallucination strict, tests reproductibles.

---

## 0. PHRASE D'INVOCATION (copier-coller dans nouvelle conversation Claude Code Opus 4.7)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-CRASH-DEEP-AUDIT-2026-05-18.md.

Mission unique : identifier la VRAIE cause root du crash admin
"An unexpected response was received from the server" (Next.js error E394)
sur https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login + appliquer le fix
définitif. 8 heures de session précédente ont échoué à le résoudre malgré
4 fix codés. Toutes les pistes superficielles épuisées. Besoin d'audit
profond bout-en-bout.

Autorisation Will déjà donnée pour : tout commit/push/SSH/Coolify/Docker.
NE PAS S'ARRÊTER sauf 4 cas catastrophiques §30.
Confirme par "GO admin crash deep audit" et démarre Phase 0.
```

---

## 1. CONTEXTE EXHAUSTIF (lire intégralement, self-contained)

### 1.1 Symptôme exact

Quand Will charge `https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login` en navigation privée (ou normale) :

1. La page de login s'affiche brièvement (SSR retourne 200 + HTML form valide — confirmé par `curl -i` qui voit le `<form class="admin-form">`).
2. Au mount client React, une error boundary fire **avant même que Will clique sur quoi que ce soit**.
3. L'écran affiche le message générique : "Une erreur est survenue dans la console / La page admin n'a pas pu se charger. Vous pouvez réessayer ou revenir au tableau de bord. L'incident a été automatiquement signalé."
4. DevTools console montre :
   ```
   Error: An unexpected response was received from the server.
       at https://axion-ia.com/_next/static/chunks/8000-XXX.js:1:52346
       at Generator.next (<anonymous>)
       at n (...8000-...js:1:264633)
       at i (...8000-...js:1:264830)
   ```
5. Pattern stack : `ug → uh → ug → uh →` répété ~80-200 fois = boucle React commit/passive effects.
6. `error.digest: undefined` → erreur **100% client-side**, pas SSR throw.
7. `error.name: Error`, `error.cause: undefined`.

### 1.2 Code source Next.js qui throw (chunk minifié)

```js
F = !!(I && I.startsWith(i.RSC_CONTENT_TYPE_HEADER));
if (!F && !D) throw new Error("An unexpected response was received from the server.")
```

Confirmé via `curl -s /_next/static/chunks/8000-XXX.js | grep "unexpected response"`.

C'est dans `packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts:283-290`. La fonction `fetchServerAction` throw quand la response d'un Server Action POST n'a NI `content-type: text/x-component`, NI le header `x-action-redirect`.

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
ADMIN_URL_PREFIX = "admin-xfz5hk0j7hrk" (secret env var)
EN_LOCALE_ENABLED = false (locale EN désactivé runtime, redirect 301 vers /fr)
```

### 1.4 Ce qui a déjà été tenté (session 8h, **TOUT échoué** côté résolution finale)

| Tentative | Description | Résultat |
|---|---|---|
| Cycle 1-4 | Audit verif-fix-deploy (12 routes V1/V2 + heap NODE_OPTIONS 6144) | OOM pipeline résolu mais admin crash persiste après deploy |
| Cycle 5 | `runs-on: ubuntu-latest-large` 32 GB | Runner indisponible, cancelled |
| Cycle 6 | D4-QW1 : `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` (réduit ~6450 pages SSG villes) | Pipeline OK + Coolify deploy OK |
| Cycle 7 | Dockerfile fix : fresh prisma + engines via npm dans `/tmp/prisma-cli` | Migrations Prisma OK |
| Migrate manuel | Workflow `admin-emergency-migrate.yml` SSH + force `migrate deploy` | 5 migrations manquantes appliquées (Country, ImageBank, etc.) |
| Speculation rules disable | Commenter custom speculation rules dans `layout.tsx` | Bug admin persiste, désactivation inutile |
| Disk cleanup | `docker system prune -af` libéré 22 GB (disque était à 100%) | OK |
| Coolify queue restart | `docker restart coolify` réinitialise Horizon workers | OK |
| Fix #1 (b80eef1) | `page.tsx` dashboard : return null sur RSC prefetch (headers `RSC: 1` / `Next-Router-Prefetch: 1`) | Insuffisant — middleware Auth.js intercepte avant `page.tsx` |
| Fix #2 (9432e16) | `auth.config.ts:authorized()` : return 200 vide sur RSC prefetch | Encore insuffisant — vrai vecteur est Server Action POST, pas GET prefetch |
| Fix #3 (c33a831) | `auth.config.ts:authorized()` : 303 + `x-action-redirect` header sur Server Action POST (Accept: text/x-component + Next-Action) | **PAS ENCORE DÉPLOYÉ EFFECTIVEMENT** — Coolify ne pull pas la nouvelle image |
| Fix #4 (8d73d19) | Force-recreate aggressive : pull fresh + `docker rmi` cached Coolify tags + recreate | À tester quand build sera live |

### 1.5 Audit profond précédent (4 sub-agents, session précédente)

Sub-agent **A1 (flow login)** :
- Confirmé matcher `proxy.ts` exclut `/api/*` (donc `/api/auth/*` Server Actions Auth.js bypass middleware) MAIS inclut `/fr/admin-*/login` (donc Server Actions de cette URL passent par `authorized()`).
- Tous les redirects identifiés : `proxy.ts` (EN→FR), `auth.config.ts` (admin auth), `layout.tsx` (locale check + adminPrefix), `page.tsx` (session check), `actions.ts` (signInAction succès), `login/page.tsx` (déjà loggé).
- Aucun fetch/Server Action invoqué au MOUNT de la page login. Tous les hooks `useEffect` étudiés.
- Verdict : E394 fire UNIQUEMENT pendant un Server Action POST dont la réponse n'a pas le bon content-type. Si fire au mount sans interaction, il faut creuser ailleurs.

Sub-agent **A2 (issues web)** :
- [Next.js #65394 OPEN](https://github.com/vercel/next.js/issues/65394) — "Server Actions don't respect NextResponse.redirect from Middleware". Workaround officiel = status 303 + `x-action-redirect` header.
- [Next.js #79346](https://github.com/vercel/next.js/issues/79346) — "Redirects drop `_rsc` & lead to dirty cache in Chrome". Recommande `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept`.
- [Next.js discussion #89607](https://github.com/vercel/next.js/discussions/89607) — Reconnaît "An unexpected response..." comme régression Next 16.x sans fix upstream.
- [next-auth #9959 OPEN](https://github.com/nextauthjs/next-auth/issues/9959) — `NEXT_REDIRECT` thrown depuis Server Action sous Auth.js v5 beta produit réponse mal formée. **Touche directement v5.0.0-beta.31 utilisée.**
- [next-auth discussion #10704](https://github.com/nextauthjs/next-auth/discussions/10704) — Server actions cassent en prod avec v5 beta.

Sub-agent **A3 (client components)** :
- `AdminSessionExpiryWarning` gated par `showSidebar = !!session?.user`, donc NON MONTÉ sur page login. Éliminé.
- `LoginForm` n'invoque pas `signInAction` au mount (`useActionState` est passif).
- `WebVitals` skip routes admin (regex check).
- `Plausible`, `Clarity`, `RefererTracker`, `CookieConsent` : pas de Server Action.
- Sentry init lazy via `requestIdleCallback`, pas de fetch synchrone.

Sub-agent **A4 (chunk minifié)** :
- Confirme E394 vient de `fetchServerAction` dans `server-action-reducer.ts`.
- Caller path : composant client → `dispatchAction` → `serverActionReducer` → `fetchServerAction` → POST canonicalUrl avec header `next-action: <hash>`.
- URL POST = la page courante (`canonicalUrl`), pas un endpoint séparé.

### 1.6 État Git actuel

```
HEAD origin/main : 8d73d19 (typecheck centre-aide + force-recreate aggressive)
c33a831 : fix(admin) handle Server Action POST in authorized callback (Next.js #65394)
9c1adaa : fix(audit) hub ville un-a-un (Manon)
9432e16 : fix(admin) skip middleware redirect on RSC prefetch (incomplet)
b80eef1 : fix(admin) return null on RSC prefetch in page.tsx (incomplet)
569d1b0 : chore(admin) verbose logs error.tsx + layout + signInAction (debug)
```

**Prod sert encore `b80eef1`** au moment de la rédaction (Coolify ne pull pas les nouvelles images malgré 5 force-recreate). Le build pour `8d73d19` va se déclencher après le push.

### 1.7 Workflows GitHub Actions disponibles

- `.github/workflows/deploy-coolify.yml` : Build & Deploy auto sur push main.
- `.github/workflows/admin-emergency-migrate.yml` : SSH + Prisma migrate + status dump + container logs.
- `.github/workflows/coolify-bypass-restart.yml` : SSH + docker pull + restart.
- `.github/workflows/coolify-system-restart.yml` : SSH + `docker restart coolify` (reset Horizon).
- `.github/workflows/coolify-force-recreate.yml` : SSH + pull + rmi cached tags + stop + rm + Coolify redeploy.
- `.github/workflows/coolify-diagnose.yml` : Coolify API cancel-stuck, list-deployments, etc.
- `.github/workflows/coolify-zombie-cleanup.yml` : cancel deploys queued > 30 min.
- `.github/workflows/disk-cleanup-prod.yml` : SSH + `docker system prune -af` + telegram alert.
- `.github/workflows/admin-enable-v2.yml` : Coolify API set `ADMIN_V2_ENABLED=true`.

### 1.8 Secrets disponibles (gh secret list)

```
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
COOLIFY_API_TOKEN, COOLIFY_URL, COOLIFY_APP_UUID
GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN
HETZNER_API_TOKEN, HETZNER_SERVER_ID, HETZNER_SSH_KEY (clé SSH root@178.105.55.15)
```

### 1.9 Tags git

- `deploy-unstuck-2026-05-18-start` → `223d1f5` (pré-fix, rollback Level 1)
- `deploy-unstuck-2026-05-18-success` → `229a0ff` (Dockerfile fix durable)

### 1.10 Accès Coolify UI

Will dispose de l'UI Coolify mais on n'a pas son URL/credentials documentées. À tester si nécessaire en demandant à Will (cas §30-3).

---

## 2. MISSION & OBJECTIF FINAL

### 2.1 Objectif unique

🟢 **Admin login fonctionnel + design V2 visible** :
- Curl `/fr/admin-xfz5hk0j7hrk/login` → 200 + HTML form sans error boundary client.
- Will login avec ses identifiants → dashboard V2 affiché (sidebar V2, primitives V2, etc.).
- 5 routes admin testées sans crash : `/`, `/login`, `/reservations`, `/users`, `/settings`.
- Console DevTools : zéro erreur E394, zéro stack trace `ug → uh × 80`.
- `x-axion-build-sha` header = HEAD SHA actuel.

### 2.2 Mode opératoire

- **TOUT AUTOPILOT.** Aucun STOP & ASK sauf §30.
- **Multi-agent parallèle** : Phase 1 et Phase 4 spawn jusqu'à 6 sub-agents //.
- **Anti-hallucination strict** : chaque assertion = preuve commande + output réel. Ne JAMAIS prétendre une réussite sans output `gh run view` joint OU `curl -i` JOINT.
- **Cite-don't-guess** : citer file_path:line, run_id, commit_sha, header exact, content-type exact.
- **Test reproductible** : chaque hypothèse doit avoir un test bash/curl qui PROUVE ou INFIRME. Pas de "probablement".
- **Pas de bypass safety** : pas de `--no-verify`, pas de `--force` destructif sauf §30.

---

## 3. ARCHITECTURE DES PHASES

```
Phase 0 — Reality check + état git/runs/prod (15 min)
Phase 1 — Audit profond bout-en-bout (6 sub-agents //) — 1.5h
Phase 2 — Synthèse + ranking hypothèses + plan tests (15 min)
Phase 3 — Tests reproductibles ciblés + diagnostic exact (1h)
Phase 4 — Application fix(es) en série OU isolation maximale (2-3h)
Phase 5 — Verification effective + smoke admin 5 routes (30 min)
Phase 6 — Verdict + livrables + mémoire (30 min)
```

Durée totale plafond : **8 h cumulé**.

---

## 4. PHASE 0 — REALITY CHECK (BLOQUANT, ~15 min)

Produit `axionia/_AUDIT/ADMIN-CRASH-DEEP-AUDIT-2026-05-18/00-REALITY-CHECK.md`.

### 4.1 État git + runs

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git rev-parse HEAD
git log --oneline -n 10
gh api 'repos/will383842/axion-ia/actions/runs?per_page=10' --jq '.workflow_runs[] | select(.name | contains("Build & Deploy") or contains("force-recreate")) | {id, name, status, conclusion, head_sha: .head_sha[0:7], created_at: .created_at[11:19]}'
```

### 4.2 État prod + reproduction du bug

```bash
# Prod SHA actuel
curl -sI https://axion-ia.com/api/healthz | grep -i "x-axion-build-sha"

# 1. SSR HTML retourne-t-il le form login ?
curl -s https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | grep -oE "(admin-form|admin-h1|LoginForm|admin-error)" | sort -u

# 2. RSC prefetch parent route → response status + content-type
curl -sI -H "RSC: 1" -H "Next-Router-Prefetch: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk | head -5

# 3. Server Action POST (simulation) → response status + content-type
curl -sI -X POST -H "Accept: text/x-component" -H "Next-Action: test_no_real_id" -H "Content-Type: text/plain;charset=UTF-8" --data '[]' https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -10

# 4. RSC fetch de la page login elle-même
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -10

# 5. Test sans cookies (incognito-like)
curl -sI -H "RSC: 1" -H "Cookie: " https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login | head -10
```

### 4.3 État container + env vars

Trigger `gh workflow run admin-emergency-migrate.yml --ref main -f action=status`. Lire output : container env, build sha, recent logs, migrations status.

### 4.4 Vérifier matcher proxy.ts inclut bien admin-xfz5hk0j7hrk

```bash
grep -n "matcher" src/proxy.ts
grep -nE "admin|api" src/proxy.ts | head -20
```

### 4.5 Stop & ask Phase 0

Si :
- Prod SHA ≠ HEAD → force-recreate puis attendre.
- Working tree dirty avec fichiers non reconnus → flag.
- Plus de 3 runs in_progress > 60 min → cancel + diagnose Coolify.

Sinon → continue Phase 1.

---

## 5. PHASE 1 — AUDIT PROFOND 6 SUB-AGENTS PARALLÈLES (~1.5 h)

Spawne en parallèle (un seul message avec 6 Agent calls) :

### D1 — Network reproduction via Playwright (le plus important)

Brief :
- Installe Playwright si manquant (`pnpm add -D @playwright/test playwright`).
- Crée un script `_AUDIT/.../d1-repro.spec.ts` qui :
  1. Lance Chromium en headless.
  2. Active Network monitoring (collecte toutes les requêtes + responses + headers).
  3. Navigue vers `https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login` (en navigation privée).
  4. Attend 5 sec (le temps que l'error boundary fire).
  5. Capture screenshot.
  6. Récupère TOUS les console errors + warnings.
  7. Récupère TOUS les network requests + leurs response headers + bodies.
  8. Identifie LE request exact qui retourne une response non-RSC et fait fire E394.
- Run le test : `pnpm playwright test _AUDIT/.../d1-repro.spec.ts --reporter=line`
- LIVRABLE : `d1-network-trace.json` + `d1-screenshot.png` + rapport identifiant **L'URL EXACTE + LE STATUS + LE CONTENT-TYPE** de la response coupable.

Tools : Bash, Read, Write. **PRIORITÉ ABSOLUE — c'est la seule manière de PROUVER la cause réelle.**

### D2 — Code source audit complet flow admin

Lis EN ENTIER (path absolu Windows) :
- `src/proxy.ts`
- `src/auth.config.ts`
- `src/auth.ts`
- `src/middleware.ts` (si existe)
- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/login/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/login/LoginForm.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/page.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/error.tsx`
- `src/app/[locale]/layout.tsx`
- `src/features/admin-auth/actions.ts`
- `src/lib/feature-flags.ts`
- TOUS les fichiers `src/components/admin/**/*.tsx`
- TOUS les Client Components dans root locale layout.

Identifie :
1. **Diagramme exhaustif du flow** : depuis le clic Will → response render → mount client → premier crash.
2. **TOUS les fetch / Server Action / `<Link prefetch>`** dans la chaîne render admin login.
3. **TOUS les `redirect()`, `notFound()`, `Response.redirect()`** dans le flow.
4. **TOUS les Server Actions exportés** : `"use server"` files + leurs IDs hash.
5. **Configuration Next.js** : `next.config.ts` `headers()` + `redirects()` + `rewrites()` qui pourraient affecter admin.

### D3 — Cloudflare + Caddy interception

- Hypothèse : Cloudflare ou Caddy strip/modify les headers `RSC`, `Next-Action`, `Next-Router-Prefetch`, `x-action-redirect` quand le request transit.
- Test :
  ```bash
  # Comparer headers vus depuis Internet vs depuis le container Hetzner
  curl -sI https://axion-ia.com/fr/admin-xfz5hk0j7hrk -H "RSC: 1" -H "X-Test-Header: from-internet"
  # Idem en SSH direct sur Hetzner :
  ssh root@178.105.55.15 'curl -sI -H "X-Test-Header: from-vps" http://localhost:3000/fr/admin-xfz5hk0j7hrk -H "RSC: 1"'
  ```
- Vérifie `Caddyfile` (probablement dans `/etc/caddy/Caddyfile` ou `infra/caddy/` du repo).
- Liste les Cloudflare rules actives (Page Rules, Workers, Transform Rules) via `gh secret` + curl CF API si possible.
- Liste les headers `Vary` actuels sur la réponse de la page login.

### D4 — Auth.js v5 beta interaction NEXT_REDIRECT

- Hypothèse : `signIn("credentials")` dans `actions.ts:86` throw une `NEXT_REDIRECT` qui en Auth.js v5 beta interagit mal avec le response stream RSC.
- Lis `node_modules/next-auth/lib/actions.ts` et `node_modules/next-auth/src/lib/actions.ts` pour comprendre comment `signIn()` gère redirect.
- WebSearch dernières issues 2026 sur `next-auth signIn redirect server-action 200 unexpected response`.
- Test : downgrade local `next-auth` à v5.0.0-beta.25 puis v5.0.0-beta.20, voir si bug existe en local. Mais skip si trop coûteux — c'est juste un fallback.

### D5 — Comparaison avec route admin login SANS Auth.js

- Hypothèse : si on crée une route copy `/fr/admin-test-no-auth/login` (sans wrapper auth), pas de crash.
- **NE PAS implémenter — trop coûteux**. Mais lister les routes admin existantes qui n'ont PAS de middleware auth et tester s'il y a un crash similaire.
- Routes candidates : `/api/admin/export/*` (server actions), `/admin/2fa/setup` (avec auth wrapper).
- Tester celles-ci via curl RSC fetch + Server Action POST → comparer behavior.

### D6 — Cookies + JWT state inspection

- Hypothèse : un cookie `__Host-authjs.csrf-token` ou `__Secure-authjs.session-token` corrompu/expiré déclenche un redirect dans Auth.js qui se traduit en non-RSC response.
- Tests :
  ```bash
  # Sans aucun cookie
  curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login -H "Cookie: "

  # Avec cookie csrf bidon
  curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login -H "Cookie: __Host-authjs.csrf-token=invalid"

  # Avec cookie session bidon
  curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login -H "Cookie: __Secure-authjs.session-token=invalid"
  ```

### Récupération synthèse

Attendre les 6 livrables. Croiser les findings. Produire :
`01-DIAGNOSTIC-PROFOND-V2.md` avec :
- Diagramme du flow consolidé
- L'URL exacte coupable (depuis D1 Playwright)
- Le response coupable (status + content-type + body 200 chars)
- Hypothèses ranked par probabilité avec preuve

---

## 6. PHASE 2 — RANKING + PLAN TESTS (~15 min)

Format `02-PLAN-TESTS.md` :

```markdown
## Hypothèses ranked

| # | Hypothèse | Probabilité | Preuve |
|---|---|---|---|
| 1 | ... | X% | D1 Playwright a vu URL Y → response Z |
| 2 | ... | Y% | ... |

## Tests CIBLES (ordre d'exécution)

1. T1 (10 min) — Test isolation auth.config.ts : commenter `authorized()` entièrement (`return true` toujours) → push → deploy → retest.
2. T2 (10 min) — ...
```

---

## 7. PHASE 3 — TESTS REPRODUCTIBLES (~1 h)

Exécuter les tests dans l'ordre. Pour chaque test :
- Commit + push spécifique au test.
- Wait deploy effective (vérifier `x-axion-build-sha` matches HEAD).
- Si Coolify ne pull pas, trigger `coolify-force-recreate.yml` immédiatement après.
- Curl + Playwright retest.
- Documenter résultat (RÉUSSITE ou ÉCHEC + observation).
- Revert si échec, garder si réussite.

---

## 8. PHASE 4 — APPLICATION FIX(ES) (~2-3 h)

Selon résultats Phase 3, appliquer le fix définitif. Options :

### Option A — Fix middleware Auth.js (pattern officiel)

```ts
authorized({ auth, request }) {
  const { nextUrl, headers } = request;
  // 1. Détecter TOUS les modes RSC
  const accept = headers.get('accept') ?? '';
  const isRsc = headers.get('rsc') === '1' || accept.includes('text/x-component');
  const isPrefetch = headers.get('next-router-prefetch') === '1';
  const isServerAction = !!headers.get('next-action');

  // 2. Pour les requêtes RSC/SA, JAMAIS faire Response.redirect (HTML 302)
  //    → utiliser 303 + x-action-redirect (officiel Next #65394) ou 200 + content-type RSC
  // ...
}
```

### Option B — Sortir page login du matcher

Modifier `proxy.ts` matcher pour exclure `/fr/admin-*/login` du wrapper Auth.js :

```ts
export const config = {
  matcher: [
    "/((?!api|_next|.*\\.|admin-[a-z0-9]+/login).*)",
  ],
};
```

### Option C — Migration middleware.ts → proxy.ts (Next 16 codemod)

```bash
npx @next/codemod@canary middleware-to-proxy .
```

### Option D — Downgrade Auth.js à v5 stable (si releases v5 stable est dispo en 2026)

```bash
pnpm add next-auth@latest
```

### Option E — Bypass : redirect côté client au lieu de server

Modifier `page.tsx` dashboard pour rendre un `<RedirectClient href="/login" />` au lieu de `redirect()` server. Le client React fait `router.push()` localement. Pas de 302 HTML.

### Sélection

Tester Option A en premier (le plus surgical), puis B, C, etc. selon résultats.

---

## 9. PHASE 5 — VERIFICATION EFFECTIVE (~30 min)

Pour chaque test :

```bash
# 1. Build SHA prod = HEAD
curl -sI https://axion-ia.com/api/healthz | grep "x-axion-build-sha"

# 2. RSC GET /fr/admin-<prefix>/login retourne 200 + text/x-component
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login

# 3. RSC GET /fr/admin-<prefix> (parent) retourne 200 + text/x-component (PAS 302)
curl -sI -H "RSC: 1" https://axion-ia.com/fr/admin-xfz5hk0j7hrk

# 4. Server Action POST simulation retourne 303 + x-action-redirect
curl -sI -X POST -H "Accept: text/x-component" -H "Next-Action: x" --data '[]' https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login

# 5. Playwright headless retest → 0 console errors E394
pnpm playwright test _AUDIT/.../verify-admin.spec.ts
```

Tous DOIVENT passer. Si un échoue → Phase 4 next option.

---

## 10. PHASE 6 — VERDICT + LIVRABLES (~30 min)

Produire :
- `VERDICT-FINAL-ADMIN-FIX.md` (verdict, durée, fix appliqué, smoke results)
- `EXEC-SUMMARY-WILL.md` (≤ 50 lignes non-tech)
- `MANIFEST.md`
- Update mémoire `axionia_admin_crash_fix_2026-05-18.md` + entrée MEMORY.md
- Tag `admin-crash-fixed-2026-05-18` sur HEAD

---

## 11. STRUCTURE LIVRABLES

```
axionia/_AUDIT/ADMIN-CRASH-DEEP-AUDIT-2026-05-18/
├── 00-REALITY-CHECK.md
├── 01-DIAGNOSTIC-PROFOND-V2.md
├── 02-PLAN-TESTS.md
├── 03-TESTS-LOG.md
├── 04-FIX-APPLIED.md
├── 05-VERIFICATION.md
├── VERDICT-FINAL-ADMIN-FIX.md
├── EXEC-SUMMARY-WILL.md
├── MANIFEST.md
└── d1-playwright/
    ├── d1-repro.spec.ts
    ├── d1-network-trace.json
    └── d1-screenshot.png
```

Total : ~10 fichiers, 2000-5000 lignes.

---

## 12. BEST PRACTICES CLAUDE MAI 2026

### 12.1 Multi-agent parallèle

- Spawn sub-agents en // dans un seul message (gain 4-6×).
- Max 6 sub-agents simultanés (overhead synchro au-delà).
- Briefer chaque sub-agent comme un collègue qui vient d'arriver (contexte complet, pas de "you know what I mean").

### 12.2 Cite-don't-guess

- Chaque assertion = preuve commande + output.
- "Le RSC retourne 302" → joindre `curl -sI ... | grep HTTP` output.
- "L'image tag est X" → joindre `docker inspect ... | grep Image` output.

### 12.3 Plan-then-execute

- Ne pas commencer à coder avant d'avoir Phase 0 + Phase 1 + Phase 2 complétées.
- Tout fix doit avoir une test reproductible BEFORE et AFTER.

### 12.4 Anti-hallucination

- Si tu n'as pas vu une output, NE prétends PAS l'avoir vue.
- Pas de "probablement", "sans doute", "should work". Soit OUI (preuve), soit NON (preuve), soit "à tester (test = X)".

### 12.5 Tests reproductibles

- Chaque commande doit pouvoir être re-exécutée par Will avec EXACTEMENT le même résultat.
- Pas de "ça marche chez moi". Tout output joint au document.

### 12.6 Verbose logging temporaires

- Si bloqué, ajouter `console.log` côté server + client + middleware.
- Push + deploy + reproduire + collecter logs container via SSH (`docker logs --tail 500`).
- Retirer les logs après diagnostic — pas de pollution prod long-terme.

### 12.7 Don't fix what you can't reproduce

- Si tu ne peux pas REPRODUIRE le bug toi-même (via curl, Playwright, ou autre), tu ne peux pas le FIXER.
- Reproduire = preuve commande + output.

### 12.8 Test fix in isolation

- Chaque fix testé SEUL avant de le combiner avec d'autres.
- Si fix combiné fail, on ne sait pas lequel est le coupable.

---

## 13. PLAFONDS SÉCURITÉ

- ⏱️ Temps total : ≤ 8 h.
- 🔁 Tests Phase 3 : ≤ 10.
- 💸 Coût additionnel runner : ≤ $20.
- 🌐 Coolify deploy attempts : ≤ 15.
- 🔧 Commits fix : ≤ 10.

Si plafond dépassé → §30.

---

## 14. RÈGLES DE COMMIT

- Conventional Commits : `fix(admin)`, `chore(audit)`, `test(admin)`, `docs(audit)`.
- Co-Authored-By: Claude Opus 4.7 (1M context).
- Pre-commit + pre-push hooks DOIVENT passer (typecheck + tests Vitest + audit Prisma).
- ❌ JAMAIS `--no-verify` sauf §30.
- ❌ JAMAIS `--force` sur main.

---

## 15. RÈGLES DE PUSH

- `git push origin main` (rebase si non-FF).
- `git push origin --tags`.
- Si autre developer (Manon, autre agent) push pendant la session, faire rebase propre puis retry.

---

## 16. ANTI-PATTERNS

- ❌ Pousser un fix sans tester localement (typecheck minimum).
- ❌ "Probablement c'est X". Soit preuve, soit test.
- ❌ Modifier > 3 fichiers dans un seul commit (impossible de bisecter si échec).
- ❌ Itérer sur Coolify deploy sans diagnostiquer pourquoi il ne pull pas (perte de temps).
- ❌ Spawner > 6 sub-agents en // (overhead synchro).
- ❌ Polling busy-loop. Utiliser Monitor.
- ❌ Ignorer les logs partiels.
- ❌ Re-run identique sans changer stratégie.

---

## 17. ROLLBACK SAFETY NETS

- Tag `deploy-unstuck-2026-05-18-success` (→ `229a0ff`) = état dernier connu OK.
- `git revert <SHA>` du commit problématique + push.
- Coolify UI → Settings → Tag → ancien SHA → redeploy.

---

## 18. CHECKLIST FIN

```
[ ] Phase 0 reality check produit
[ ] Phase 1 6 sous-agents // → 01-DIAGNOSTIC-PROFOND-V2.md produit
[ ] Phase 2 plan tests établi
[ ] Phase 3 tests exécutés, chacun documenté
[ ] Phase 4 fix appliqué, tests verts
[ ] Phase 5 verification effective (5 tests curl + Playwright)
[ ] Phase 6 verdict + livrables + mémoire
[ ] Tag `admin-crash-fixed-2026-05-18` posé + pushé
[ ] Will retest admin → V2 visible, zero error console
[ ] Speculation rules réactivées (commit séparé)
[ ] Verbose debug logs retirés (commit séparé)
```

---

## 19. RESSOURCES

- Session précédente : `axionia/_AUDIT/DEPLOY-UNSTUCK-2026-05-18/**`
- Audit profond précédent : 4 sub-agents A1-A4 (cf. transcript dans cette session)
- Next.js issues : #65394, #79346, #87651, #89607
- Auth.js issues : #9959, #10704, #9144
- Migration guide Next 16 : https://nextjs.org/docs/app/guides/upgrading/version-16
- Coolify API : https://coolify.io/docs/api-reference/

---

## 20. PHRASE D'INVOCATION (rappel — copier-coller)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-CRASH-DEEP-AUDIT-2026-05-18.md.

Mission unique : identifier la VRAIE cause root du crash admin
"An unexpected response was received from the server" (Next.js error E394)
sur https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login + appliquer le fix
définitif. 8 heures de session précédente ont échoué à le résoudre malgré
4 fix codés. Toutes les pistes superficielles épuisées. Besoin d'audit
profond bout-en-bout.

Autorisation Will déjà donnée pour : tout commit/push/SSH/Coolify/Docker.
NE PAS S'ARRÊTER sauf 4 cas catastrophiques §30.
Confirme par "GO admin crash deep audit" et démarre Phase 0.
```

L'agent doit répondre par "GO admin crash deep audit" et démarrer Phase 0 immédiatement.

---

## 30. STOP & ASK (4 cas catastrophiques)

🛑 STOP & ASK UNIQUEMENT si :

### Cas 1 — Plafonds dépassés
- Temps > 8 h.
- Tests > 10 sans succès.
- Coût runner > $20.
- Commits fix > 10.

### Cas 2 — Risque prod
- Action nécessaire qui mettrait la prod hors-ligne > 5 min.
- Découverte d'un secret leaké.
- Force push main demandé.

### Cas 3 — Dépendances majeures
- Activation paid Coolify plan / paid runners requiert l'accord Will.
- Migration Auth.js stable v5 release (requiert validation).
- Reset complet Coolify app (requiert clic Will).

### Cas 4 — Audit confirme bug upstream non-corrigeable
- Bug Next.js / Auth.js sans workaround viable.
- Nécessite décision Will : migration Vercel/Render, downgrade major version, ou rewrite auth flow.

Dans tout autre cas → continuer.

---

**Fin du prompt.**
