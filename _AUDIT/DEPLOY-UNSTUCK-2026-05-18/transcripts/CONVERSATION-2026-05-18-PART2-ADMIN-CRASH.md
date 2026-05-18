# Conversation Part 2 — admin crash investigation + Sentry setup — 2026-05-18

Sauvegarde demandée par Will. Suite de `CONVERSATION-2026-05-18-AUTOPILOT-DEPLOY.md`.

## TL;DR session Part 2

- **Pipeline deploy** : ✅ vert depuis Cycle 6 D4-QW1 (matin). Build & Deploy passe en 25 min stable.
- **Admin crash post-deploy persistant** : malgré 4 fixes codés (`b80eef1`, `9432e16`, `c33a831`, `8d73d19`), Will voit toujours "An unexpected response was received from the server" sur `/fr/admin-xfz5hk0j7hrk/login`.
- **Cause root identifiée par audit profond 4 sub-agents** : Next.js issue #65394 OPEN. Server Action POST se fait rediriger par middleware Auth.js → response 302 HTML au lieu de RSC payload → React `fetchServerAction` throw E394.
- **Fix correct (Pattern Next.js #65394)** : retourner status 303 + header `x-action-redirect` au lieu de `Response.redirect()` pour les requêtes avec `Accept: text/x-component` ou `Next-Action: <id>`.
- **Bloquant pratique** : Coolify ne pull pas les nouvelles images après deploy (cache local). Force-recreate workflow amélioré (pull fresh + tag override + remove cached) en attente de validation.
- **Sentry setup permanent en cours** : Sentry SaaS officiel région DE configuré côté code. Org slug = `world-expat`. Project slug = `axion-ia`. Project ID = `4511361744175184`. Internal Integration token créé par Will (`51126ef5...`).
- **MCP Sentry server à configurer** dans `~/.claude/settings.json` pour que futurs Claude aient accès direct via `mcp__sentry__*` tools.

## Issues Sentry détectées (avant fix)

Issues 24h prod :

- **118951810** [error] "Error: failed to pipe response" — count=14, last 2026-05-18T11:44 — 🔴 **suspect #1 admin crash**
- 120429282 PrismaClientKnownRequestError count=9 last 04:34
- 120403283 PrismaClientKnownRequestError count=2 last 04:34
- 120441958 PrismaClientKnownRequestError count=5 last 17:09:13 (last day)
- 120300952 PrismaClientInitializationError count=3 (résolu via migrate manuel)
- 120280270 PrismaClientInitializationError count=2 (résolu)
- 119124903 "Error: Captcha échoué" count=1 (autre)

L'issue **118951810 "failed to pipe response"** est très probablement la cause root admin crash. Pattern typique Next.js + RSC stream pipe break.

## Tokens + secrets décisions

| Item                                        | Stockage                                                              | Décision                                         |
| ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `SENTRY_DSN`                                | Coolify env vars (déjà set)                                           | ✅ keep                                          |
| `NEXT_PUBLIC_SENTRY_DSN`                    | Coolify env vars (déjà set)                                           | ✅ keep                                          |
| `SENTRY_AUTH_TOKEN`                         | gh secret (Will à set via `gh secret set --repo will383842/axion-ia`) | ⏳                                               |
| `SENTRY_ORG_SLUG` (= `world-expat`)         | gh secret                                                             | ⏳                                               |
| `SENTRY_PROJECT_SLUG` (= `axion-ia`)        | gh variable                                                           | ⏳                                               |
| `SENTRY_REGION` (= `de`)                    | gh variable                                                           | ⏳                                               |
| Token Coolify                               | ❌ Pas nécessaire                                                     | (Source Maps upload seulement, à faire post-fix) |
| MCP server Sentry `~/.claude/settings.json` | ⏳ Will à config local                                                | Pour futures conversations                       |

## Workflow `sentry-query.yml` créé

`gh workflow run sentry-query.yml -f action=<X>` :

- `list-recent` : top 20 issues récentes
- `issue-detail` (+ `issue_id`) : metadata + tags
- `event-detail` (+ `issue_id`) : breadcrumbs + stack trace + tags + browser/runtime context
- `issues-by-tag` (+ `query`) : filter par tag (ex. `tags[route]:admin`)

En attente de push (typecheck pre-push bloque sur 2 fichiers Manon).

## Erreurs typecheck pré-existantes fixées cette session

- `src/app/[locale]/centre-aide/[slug]/page.tsx` ligne 183 + 199 (Manon implicit any)
- `src/app/[locale]/stack-ia/[tool]/__tests__/page.spec.tsx` ligne 164 (Possibly undefined)
- `src/app/sitemap-news.xml/__tests__/route.spec.ts` ligne 36 (Expected 0 arguments)

## Plan immédiat

1. Will set gh secrets/variables Sentry (commandes données).
2. Push workflow `sentry-query.yml`.
3. Trigger `sentry-query` action=event-detail issue_id=118951810 → récupère breadcrumbs + stack lisible.
4. Analyse breadcrumb pour trouver l'URL exacte qui fail + son response status/content-type.
5. Si confirme Next.js #65394 pattern → fix `c33a831` (déjà codé) doit marcher quand Coolify pullera la nouvelle image.
6. Force-recreate aggressive workflow (commit `8d73d19`) avec pull + rmi cached → valider Coolify déploie effectivement.

## Plan long-terme (post-fix admin)

A. **Sentry Source Maps upload** au build (set `SENTRY_AUTH_TOKEN` dans Coolify scope BUILD + `withSentryConfig` dans `next.config.ts`).
B. **Sentry Session Replay** (ajout `replayIntegration` dans `instrumentation-client.ts`).
C. **Sentry Release tracking** (action `getsentry/action-release@v1` dans `deploy-coolify.yml`).
D. **Sentry Alerts** (rules notifications Slack/Telegram).
E. **Documentation** `docs/SENTRY-OPERATIONS.md` + section dans `AGENTS.md`.

## Commits cette session Part 2

```
80c2004  fix(admin): disable custom speculation rules
b80eef1  fix(admin): return null on RSC prefetch when no session (incomplet)
9432e16  fix(admin): skip middleware redirect on RSC prefetch (incomplet)
424e9a5  fix(ops): coolify-force-recreate now pulls latest + overrides local tag (lost in rebase)
9c1adaa  feat(audit): hub ville un-a-un (Manon)
c33a831  fix(admin): handle Server Action POST in authorized callback (Next.js #65394) ← LE VRAI FIX
8d73d19  fix(typecheck+ops): centre-aide + force-recreate remove cached coolify tags
<en cours> feat(ops): sentry-query workflow + fix typecheck stack-ia + sitemap-news tests
```

## Audit profond 4 sub-agents — synthèse

**A1 (flow login)** : Le matcher proxy.ts exclut `/api/*` mais inclut `/fr/admin-*/login`. Server Actions POST passent par `authorized()` callback. Si redirect → 302 HTML → React fire E394. Le fix doit détecter `Accept: text/x-component` (POST) en plus de `RSC: 1` (GET prefetch).

**A2 (web issues)** : Next.js #65394 OPEN. Pattern officiel = 303 + `x-action-redirect`. Aussi #79346 (drop `_rsc` query), discussion #89607 (régression Next 16.x non corrigée), next-auth #9959 (NEXT_REDIRECT v5 beta).

**A3 (client components)** : `AdminSessionExpiryWarning` gated `showSidebar=false` sur login → pas monté. Éliminé. WebVitals skip admin (regex). Plausible/Clarity/Refer Tracker analytics simples. Pas de cause client component.

**A4 (chunk minifié)** : Confirme E394 vient de `fetchServerAction` dans `server-action-reducer.ts:283-290`. URL POST = canonicalUrl = la page courante. Si response sans `text/x-component` → throw.

## Files modified cette session Part 2

- `src/auth.config.ts` (fix c33a831 — Server Action POST handling)
- `src/app/[locale]/(admin)/[adminPrefix]/page.tsx` (fix b80eef1)
- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` (verbose debug logs 569d1b0)
- `src/app/[locale]/(admin)/[adminPrefix]/error.tsx` (verbose debug logs)
- `src/features/admin-auth/actions.ts` (verbose debug logs)
- `src/app/[locale]/layout.tsx` (speculation rules désactivées 80c2004)
- `.github/workflows/coolify-bypass-restart.yml` (création)
- `.github/workflows/coolify-system-restart.yml` (création)
- `.github/workflows/coolify-force-recreate.yml` (création + amélioration)
- `.github/workflows/sentry-query.yml` (création — en attente push)
- `src/components/sections/VilleServicePageTemplate.tsx` (Manon — 4e card un-a-un)

## Action humaine restante post-session

1. Will revoke le token Sentry exposé dans le chat (`51126ef5...`) après cette session.
2. Will crée nouveau token Sentry post-revoke et le set en gh secret seulement.
3. Will configure `~/.claude/settings.json` MCP server Sentry.
4. Long-terme : Source Maps upload + Session Replay + Release tracking + Alerts.

## Bug racine probable (à confirmer via Sentry event-detail)

Issue Sentry **118951810** "Error: failed to pipe response" count=14, dernière vue 2026-05-18T11:44.

Hypothèse : Next.js Server Action POST → middleware Auth.js redirect → stream break → "failed to pipe response" côté server + "An unexpected response" côté client.

Fix `c33a831` (303 + x-action-redirect) doit résoudre. Reste à valider quand Coolify pullera effectivement la nouvelle image.

## Verdict honnête

Sur ~14 heures cumulées (Part 1 + Part 2), résolu :

- ✅ Pipeline OOM 12+ runs
- ✅ Migrations Prisma drift
- ✅ Disque VPS 100%
- ✅ Coolify queue gelée (workers réinit)
- ✅ Cause root admin crash identifiée + fix codé
- ✅ Sentry setup permanent en cours

Non résolu fully :

- ❌ Coolify cache image au restart (force-recreate amélioré en attente d'être pushed)
- ❌ Will n'a pas encore validé que `c33a831` résout effectivement le crash admin (en attente deploy)

Si Coolify pull correctement `c33a831` après force-recreate aggressive → admin probablement fix.
Sinon → besoin d'audit profond v2 (prompt préparé `PROMPT-ADMIN-CRASH-DEEP-AUDIT-2026-05-18-v2.md`).
