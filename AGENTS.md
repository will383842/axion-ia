<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Performance budget (Web Vitals 2026 — voir `_AUDIT/AUDIT-WEB-VITALS-2026-*.md`)

Toute PR qui touche le code frontend doit respecter ces seuils sur les **15 pages stratégiques** :

- **LCP** ≤ 1 800 ms p75 (cible interne ; Google « good » = 2 500 ms)
- **INP** ≤ 100 ms p75 (cible interne ; Google « good » = 200 ms)
- **CLS** = 0 (cible interne stricte ; Google « good » = 0,1)
- **TBT** ≤ 150 ms (Lighthouse lab desktop)
- **First Load JS** ≤ 75 KB gz / route (cible V6)

Exception : `/appel` (réservation d'appel, iframe Calendly client-heavy) → INP ≤ 150 ms, First Load ≤ 110 KB gz.

Tout patch qui dégrade ces seuils requiert un STOP & ASK Will + ADR justifié.

⚠️ **Vérité des gates (rectifiée le 2026-08-15, audit GEO/AEO E2E — GEO-025).** Ce
paragraphe affirmait que Lighthouse CI et `size-limit` bloquaient les PR. C'est **faux**,
et l'a toujours été :

- **Le seul gate réellement bloquant est le `lhci` _post-deploy_** (job `lhci` de
  `.github/workflows/deploy-coolify.yml`), qui mesure 5 URLs de la **prod live** après
  l'atterrissage. Il échoue le workflow, donc il alerte — mais **après** la mise en ligne.
- **Les gates PR de budget sont en reporting, pas en blocage** : dans
  `.github/workflows/ci.yml`, les steps « Bundle size » (`pnpm bundle:check`, size-limit),
  « Bundle delta vs main » (`size-limit-action`) et « Lighthouse CI » (`pnpm lhci:autorun`)
  portent tous les trois `continue-on-error: true`. **Aucune PR qui alourdit le bundle ne
  rougira.** Conséquence directe : toute revue qui écrit « le risque bundle est couvert par
  la gate » raisonne sur une fausse sécurité. Un patch susceptible d'alourdir une route se
  mesure **à la main**, avant/après.
- ⚠️ **Le « bind loopback » n'a jamais existé** (mesuré le 2026-08-21). Ce paragraphe a
  affirmé que `next start` ne bindait pas sur 127.0.0.1 en CI. Il ne bindait rien parce
  qu'il n'avait **rien à servir** : l'étape `Bundle delta vs main` relançait `pnpm run build`
  dans le même répertoire juste avant, vidait `.next`, puis mourait en OOM — laissant le
  dossier sans `BUILD_ID`. Les 237 tests Playwright et les 5 URLs Lighthouse de Gate B
  mesuraient donc le vide (run 32443013208 : 209 failed, 0 passed). L'ordre des étapes est
  corrigé et verrouillé par `tests/unit/ci/harnais-e2e-mesure-vraiment.spec.ts`.
- Le Lighthouse CI **PR-time** reste néanmoins non bloquant tant qu'on n'a pas **lu** ce
  qu'il rapporte une fois qu'il rapporte quelque chose. Aligner les seuils d'abord, bloquer
  ensuite — la règle du paragraphe précédent ne change pas.

Ne repassez pas ces gates en bloquant « au passage » : un ratchet posé sur un seuil déjà
dépassé (le bucket « Shell partagé » mesure 134,87 kB réels pour une limite affichée à
100 kB) ouvre un rouge permanent sur toutes les PR. Seuil aligné d'abord, blocage ensuite.

Source de vérité : `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.

## Build externalisé GitHub Actions + stubs Prisma/Redis (ADR 0026)

Depuis 2026-05-16 (recovery deploy), le build Docker est **externalisé sur GitHub Actions** (le VPS CPX42 ne suffisait plus, build SSG 17 629 routes saturait les 150 GB à ~117 GB peak). L'image est pushée sur GHCR public, et Coolify ne fait plus que `pull` via `Dockerfile.coolify-pull` (un-liner `FROM ghcr.io/will383842/axion-ia:latest`). Voir ADR 0026.

### ⚠️ Magic string `"stub.invalid"` — NE PAS TOUCHER sans propager

Le build GH Actions ne peut pas se connecter à la DB Postgres ni au Redis du VPS. Pour permettre `pnpm prisma:generate` + `pnpm build` (qui font des appels Prisma au SSG du sitemap/ressources/etc.), on injecte des **URLs stub** comme build-args :

```
DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub
REDIS_URL=redis://stub.invalid:6379
SKIP_ENV_VALIDATION=true
BULLMQ_DISABLED=true
```

Deux clients sont **stub-aware** au niveau singleton :

- **`src/lib/prisma.ts`** : si `process.env.DATABASE_URL?.includes("stub.invalid")`, retourne un Proxy qui short-circuit toutes les queries vers `[] / null / 0 / { _count: { _all: 0 } }`. Les mutations throw (au build aucun call ne devrait muter).
- **`src/lib/redis.ts`** : si `process.env.REDIS_URL?.includes("stub.invalid")`, retourne un Proxy qui répond à toutes les commandes par null/no-op.

En outre, `src/server/exporters/knowledge-rss.ts` + `knowledge-sitemap.ts` font un **early-exit** explicite si la magic string est détectée, pour éviter même l'instanciation lazy du client.

**Conséquences sur le SSG** :

- Pages DB-dependent (sub-sitemaps `knowledge-*`, `/[locale]/ressources`, etc.) sont rendues vides au build
- L'ISR `revalidate=3600` les repopule sous 1h en prod (DATABASE_URL réel injecté par Coolify au runtime)
- Pas de blocage du build entier sur un call DB

**Si tu touches au code de build, RESPECTE ce contrat** :

- ❌ NE PAS changer la string `"stub.invalid"` sans la propager dans `prisma.ts`, `redis.ts`, `knowledge-rss.ts`, `knowledge-sitemap.ts`, `Dockerfile`, `.github/workflows/deploy-coolify.yml`
- ❌ NE PAS retirer le check `SKIP_ENV_VALIDATION === "true"` dans `env.ts` (sinon build fail sur Zod validation des 8 secrets prod absents en GH Actions)
- ❌ NE PAS retirer `BULLMQ_DISABLED=true` du Dockerfile builder stage (sinon BullMQ tente d'initialiser une connexion Redis au SSG)
- ✅ Si une nouvelle page SSG fait un appel DB direct au build, vérifier que le stub Proxy couvre la méthode utilisée OU ajouter un `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>` early-exit dans la page
- ✅ Tests Vitest tournent avec un PrismaClient mock distinct (pas affecté par le stub Proxy build-time)

### Pipeline complet

1. `git push main` → workflow `.github/workflows/deploy-coolify.yml`
2. **Job `build`** (~25 min) :
   - Free disk space agressif (~75 GB free)
   - `docker build axionia/Dockerfile` avec build-args stubs
   - `docker push ghcr.io/will383842/axion-ia:{latest,sha-XXXXXXX,main}`
3. **Job `deploy`** (~30s à 28 min selon layers diff) :
   - POST Coolify `/api/v1/deploy`
   - Coolify build `Dockerfile.coolify-pull` (`FROM ghcr.io/...:latest`)
   - `docker pull` layers manquantes
   - Container restart + entrypoint `prisma migrate deploy` + healthcheck
4. **Job `purge`** : Cloudflare `purge_everything`
5. **Job `lhci`** : Lighthouse CI gate 5 URLs prod live

### Modifs Coolify côté plateforme

- `build_pack` : `dockerfile` (inchangé)
- `dockerfile_location` : `/Dockerfile.coolify-pull` (set via API PATCH 2026-05-16)
- ⚠️ Si quelqu'un change `dockerfile_location` via Coolify UI → retour mode build local sur VPS → re-saturation disque CPX42. Surveiller.

## EN locale désactivé (2026-05-16) — procédure de re-enable

Le 2026-05-16, le locale EN a été désactivé suite à un bug pré-existant next-intl v4.11 / Next.js 16.2 (boucle 307 self-redirect sur les routes EN ayant un `pathnames` mapping FR≠EN). Le bug était masqué par CF Managed Challenge ; après désactivation du challenge, il est devenu visible.

**État actuel** :

- `routing.ts` déclare toujours `locales: ["fr", "en"]` + tous les `pathnames` mappings (rien retiré)
- Tous les messages EN (`messages/en.json`) restent en place
- Toutes les pages SSG continuent à pré-renderer en FR + EN
- Mais `src/proxy.ts` intercepte tout `/en/*` au runtime et émet un **301** vers l'équivalent FR via `mapEnToFr()` (cf. `src/lib/i18n/en-to-fr-redirect.ts`)

**Pour réactiver EN (quand le bug next-intl sera fixé)** :

1. Set env var Coolify `EN_LOCALE_ENABLED=true` (Application → Env vars → New → key `EN_LOCALE_ENABLED`, value `true`, scope RUN)
2. Restart container (Coolify → Restart)
3. ✅ EN re-actif. Vérifier `/en/about` → 200 (au lieu de 301 vers `/fr/a-propos`)

**Si tu veux purger les EN URLs de Google Search Console** (recommandé après ≥4 semaines de 301) :

1. GSC → Indexing → Pages → filter par /en/\*
2. Mark as resolved (les 301 vers FR feront le boulot SEO long-terme)

**Si tu veux RETIRER complètement EN du code** (pas recommandé sauf décision définitive) :

1. `routing.ts` : `locales: ["fr"]`
2. Supprimer toutes les entrées `en:` dans `pathnames`
3. Supprimer `messages/en.json`
4. Retirer hreflang `en` des metadata (`src/lib/seo.ts`)
5. Retirer les sub-sitemaps EN de `app/sitemap.ts`
6. Retirer le proxy.ts redirect block

Effort de retrait complet : ~4-6 h. **Mieux vaut garder la toggle env-flag** sauf raison forte de simplifier le code.

### Bug pré-existant next-intl à fixer avant ré-activation

Le bug 307 self-loop apparaît quand :

- next-intl v4.11+ + Next.js 16.2+
- `localePrefix: "always"`
- Route a un `pathnames` mapping avec `fr ≠ en`
- Locale non-default (en) demandé

Symptôme : `/en/about` retourne `307 → /en/about` (loop infini) avec `x-middleware-rewrite: /en/a-propos` (la rewrite interne marche, mais Next émet aussi un 307 vers la même URL).

Fix probable : upgrade next-intl ou downgrade Next, OU patch custom dans le middleware. À investiguer en Sprint dédié quand re-activation EN devient prioritaire.
