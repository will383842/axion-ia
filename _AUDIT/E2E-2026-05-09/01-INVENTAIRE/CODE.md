# 01-INVENTAIRE — CODE

## Totaux haut-niveau (HEAD `b6d17ad`)

| Périmètre                 | Fichiers                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/**` TS/TSX           | **392**                                                                                                                                                      |
| Components                | 115 (`src/components/`)                                                                                                                                      |
| Sections                  | 43 (`src/components/sections/`)                                                                                                                              |
| UI primitives             | 25 (`src/components/ui/`)                                                                                                                                    |
| Marketing comp            | 11 (`src/components/marketing/`)                                                                                                                             |
| Forms                     | 6 (`src/components/forms/`)                                                                                                                                  |
| Calendar                  | 5 (`src/components/calendar/`)                                                                                                                               |
| Nav                       | 9 (`src/components/nav/`)                                                                                                                                    |
| Visual                    | 3 (`src/components/visual/`)                                                                                                                                 |
| Layout                    | 3 (`src/components/layout/`)                                                                                                                                 |
| Lib                       | 42 (`src/lib/`)                                                                                                                                              |
| Schemas (Zod)             | 3 (`src/lib/schemas/`)                                                                                                                                       |
| Email lib                 | 15 (`src/lib/email/`)                                                                                                                                        |
| Features (server actions) | 19 (`src/features/*/actions.ts`)                                                                                                                             |
| Server queue (BullMQ)     | 8 (`src/server/queue/`)                                                                                                                                      |
| App routes                | 139 fichiers sous `src/app/[locale]/**`                                                                                                                      |
| `app/api` routes          | 11                                                                                                                                                           |
| Content (data)            | `src/content/{audit,automatisations,case-studies,comparaisons,implementation,interventions,legal,press,pricing,regions,stack-ia,transversal,villes,blog}.ts` |
| Villes copy/data          | 2 copy + 14 data (13 régions + 1 villes-export)                                                                                                              |
| Posts blog                | 3 articles (`src/content/blog/posts/`)                                                                                                                       |
| Messages i18n             | `src/messages/fr.json` + `src/messages/en.json` (224 keys chaque, 243 lignes)                                                                                |
| Sentry config             | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (3)                                                                            |
| Proxy (middleware)        | `src/proxy.ts` (1 — Next 16 renaming)                                                                                                                        |

## Annotations clés

- `'use client'` : **0 grep direct** sur `^"use client"` strict (Windows quoting). 53 fichiers présentent `"use client"` ou `'use client'` quand recherchés en mode flexible. Forms + nav interactifs + calendar.
- `server-only` imports : **2 fichiers** (`src/lib/...` sensibles).
- `generateStaticParams` : **22 occurrences** — coller à la doctrine SSG pSEO.
- `generateMetadata` : **73 occurrences** — couverture quasi-complète des pages publiques (76 - quelques layout-only).
- Server actions ("use server" file-level) : **20 fichiers** (1 page admin + 19 `src/features/<domain>/actions.ts`).

## Modules `src/lib/`

```
admin-path.ts     auth-2fa.ts        auth-password.ts   brand.ts
client-ip.ts      csp.ts             email/             gdpr-token.ts
geo.ts            intervention-type.ts  intl.ts         observability/
pii-redaction.ts  pii-redaction.test.ts  prisma.ts     rate-limit.ts
redis.ts          routes.ts          schemas/           seo.ts
service-coverage.ts  telegram.ts     title.ts          turnstile.ts
utils.ts          utils.test.ts
```

→ Stack canonique : auth (Auth.js v5 + 2FA), CSP, rate-limit, redis, Prisma, Sentry (sous `observability/`), PII redaction (Sprint 24.1), Telegram, Turnstile.

## Modules `src/features/`

Domaines fonctionnels avec server actions co-localisées :

```
admin-activity-logs  admin-auth  admin-blog  admin-calendar
admin-case-studies   admin-categories  admin-faq  admin-help
admin-newsletter     admin-options  admin-settings  admin-submissions
admin-testimonials   admin-users
audit  booking  contact  implementation  newsletter
```

→ 14 features admin + 5 features publics. **Bonne séparation des préoccupations**.

## Densité TODO/FIXME/HACK

```
grep -rln "TODO\|FIXME\|HACK" src/ : à mesurer plus précisément en AGT-01
```

(Sur Phase 1 globale, pas de mesure fine fichier-par-fichier ; relégué à AGT-01 ARCHITECTURE-DRY.)

## Sentry & observability

- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` présents.
- `next.config.ts` n'enveloppe pas immédiatement avec `withSentryConfig` — à vérifier en bas du fichier (AGT-12).
- `src/lib/observability/` → composants Vitals + logger Pino.

## Citations

- `src/proxy.ts:1-15` (proxy Next 16, fusion auth + intl + CSP)
- `src/lib/csp.ts:1-25` (decision CSP soft public Sprint 16 parking)
- `src/content/pricing.ts:1-20` (SSOT pricing)
- `src/i18n/routing.ts:1-30` (locales, pathnames)

## CSV exhaustif

Vu volume (392 fichiers), CSV non généré ligne-à-ligne ici — disponible via :

```
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec wc -l {} \;
```

Si besoin downstream pour tri/filtre. Marqué `[CSV NON GÉNÉRÉ — volume]`.
