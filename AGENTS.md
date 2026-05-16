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

Exception : `/reserver` (calendrier client-heavy) → INP ≤ 150 ms, First Load ≤ 110 KB gz.

Tout patch qui dégrade ces seuils requiert un STOP & ASK Will + ADR justifié. Lighthouse CI (`pnpm lhci`) gate les PR. Bundle delta gate (`size-limit`) bloque les PR avec > +5 KB gz vs `main`.

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
