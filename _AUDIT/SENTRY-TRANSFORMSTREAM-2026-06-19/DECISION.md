# Décision — Sentry `transformAlgorithm is not a function` (2026-06-19)

## Symptôme

Issue Sentry `axion-ia` (prod), notifiée en « high priority » :

```
TypeError: controller[kState].transformAlgorithm is not a function
  node:internal/webstreams/transformstream:527  transformStreamDefaultControllerPerformTransform
```

- URL : `GET /fr/galerie/axion-ia-boite-mail-liberte-automatisation-emails-ia-affiche`
- Tags : `handled = yes`, `environment = production`, `runtime = node v22.23.0`,
  `os = Alpine Linux 3.24.1`, `release = fe0c1bdb`.

## Cause racine (confirmée)

Bug **Next.js / Node 22 connu et non résolu** — `vercel/next.js#75995`.

Le contrôleur interne (`kState`) du `TransformStream` que Next.js utilise pour
**streamer le RSC** est corrompu quand la connexion **se ferme prématurément en
plein stream** : crawler/bot qui coupe, health-check, ou buffer proxy dépassé.
Le slot `transformAlgorithm` devient `undefined` → `TypeError`.

Déclencheurs documentés qui matchent notre environnement :

| Déclencheur (issue Vercel) | Notre cas |
| --- | --- |
| Alpine/musl vs Debian/glibc | `Dockerfile` → `FROM node:22-alpine` (×3 stages) |
| Node 22+ | `node v22.23.0` |
| Page RSC streamée coupée par un bot | `/fr/galerie/[slug]` = page ISR streamée, cible privilégiée des crawlers (banque d'images SEO/AEO) |

### Ce que ce n'est PAS

- **Pas le code de la page** : `galerie/[slug]/page.tsx` est un Server Component
  banal (Prisma → JSX), aucun `TransformStream`/`pipeThrough`/`CompressionStream`.
- **Pas Sentry** : config minimale (`Sentry.init({ tracesSampleRate, beforeSend })`),
  aucune intégration custom touchant aux streams. Sentry ne fait que *capturer*
  (`handled = yes`). Version installée déjà à jour : `@sentry/nextjs@10.53.1`
  (tout l'arbre `@sentry/*` en `10.53.1`). Le `@sentry/node@7.120.4` du lockfile
  n'est qu'une dép interne de `lighthouse` (devDep CI), jamais chargée en prod.

## Gravité

**Cosmétique / non-actionnable.** `handled`, non fatal : seules les requêtes
**avortées** génèrent l'event ; les réponses complètes (utilisateurs réels et bots
qui ne coupent pas) ne sont pas affectées. Aucun 500 visible.

## Décision

1. **Drop de l'event** côté serveur via `ignoreErrors: [/transformAlgorithm is not a function/]`
   dans `src/sentry.server.config.ts` — pour qu'un bruit upstream non-actionnable
   ne déclenche plus d'alerte high-priority. Surgical (regex sur le message exact),
   server-only (l'erreur naît dans `node:internal/webstreams`, runtime Node ; le
   runtime Edge a une autre implémentation de streams → inutile d'y toucher).

2. **On NE swappe PAS l'image de base `node:22-alpine` → Debian.** C'est le
   workaround « de fond » cité dans l'issue, mais le risque dépasse de loin le
   bénéfice ici :
   - Le `Dockerfile` est intimement couplé à musl/Prisma : query-engine
     `linux-musl-openssl-3.0.x` (bug prod confirmé 2026-05-16 si la détection
     OpenSSL déraille), `apk add libc6-compat openssl`, `addgroup/adduser`
     syntaxe BusyBox, budget image < 250 MB.
   - Pipeline ADR 0026 cicatriciel (OOM BuildKit, saturation disque, 8+ deploys
     ratés documentés). Build SSG 17 629 routes externalisé GH Actions →
     **non validable en local**.
   - Bénéfice = réduire la fréquence d'un event déjà inoffensif.
   - Reward/risk défavorable → STOP. À reconsidérer **uniquement** si Next.js/Node
     publie un fix amont, ou si l'event devient fatal (il ne l'est pas aujourd'hui).

## Réversibilité

Retirer la ligne `ignoreErrors` rétablit la remontée de l'event. Aucune autre
dépendance.
