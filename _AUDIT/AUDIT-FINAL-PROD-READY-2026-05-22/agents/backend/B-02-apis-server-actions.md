# B-02 — APIs route handlers + Server Actions

**Score : 17/25**
**Verdict : CONDITIONAL — auth admin solide, validation Zod sous-couverte sur Server Actions**

## Inventaire

- **Routes API** : 27 fichiers `src/app/api/**/route.ts`
- **Server Actions content-gen** : 27 fichiers `src/server/actions/content-gen/*.ts`

## Auth admin

### Server Actions

Helper centralisé `src/server/actions/content-gen/_auth.ts:52` exporte `requireAdmin()` qui throw `unauthorized` (pas de session) ou `forbidden` (rôle != super_admin/admin/editor). Variante `requireSuperAdmin():62` et `requireAdminWriteRateLimited(actionId, opts):87` (sliding-window 60 writes/min/admin via `checkRateLimit`). **Adoption : 20/27 fichiers** importent `requireAdmin` (grep `src/server/actions/content-gen` `requireAdmin`).

Non couverts (grep négatif) : `policies-constants.ts`, `brand-voice-constants.ts`, `seed-initial.ts`, `_auth.ts` lui-même, `_settings.ts` (utilise helper plus bas) — constants/helpers, acceptable. **Vérification spot** : `enqueue.ts:59`, `coverage.ts`, `kill-switch.ts` ont bien `await requireAdmin()` en ligne 1 du body.

### Routes API

9/27 routes appellent `auth()` ou `requireAdmin` :
`api/admin/content-gen/articles/[id]/feedback/route.ts`, `api/admin/articles/[id]/forget/route.ts`, `api/admin/articles/[id]/provenance/route.ts`, `api/image-bank/import/route.ts`, `api/admin/session-ping/route.ts`, `api/admin/invoices/[id]/pdf/route.ts`, `api/content-gen/geo-events/route.ts`, `api/content-gen/jobs/[id]/stream/route.ts`, `api/content-gen/export/route.ts`.

Routes publiques par design (OK) : `auth/[...nextauth]`, `healthz`, `vitals`, `unsubscribe`, `stripe/webhook` (signature provider), `docuseal/webhook` (signature), `markdown/[type]/[slug]` (public docs), `gdpr-*` (token-driven), `indexnow/key`, `internal/*` (HMAC header — `internal/revalidate/route.ts:22-29` `REVALIDATE_SECRET`), `image-bank/import` (admin via auth + HMAC fallback).

## Validation Zod

### Server Actions

**Seul `coverage.ts` importe `z` / utilise `z.object`/`safeParse`** (grep `z\.object|z\.string|safeParse`). Les autres reposent sur le typage TypeScript des paramètres + spread `inputPayload as Record<string, unknown>` côté worker (`content-gen-worker.ts:155`).

→ **Gap structurel** : les payloads vers `enqueueDirectGen()` (`enqueue.ts:56`) ne sont pas runtime-validated. Risque modeste car l'appelant est React Server Component bound (TS compile-time), mais Server Actions Next 16 sont exposées côté réseau (encrypted action ID, mais le body JSON reste de l'input externe).

### Routes API

7/27 routes utilisent Zod : `vitals`, `image-bank/import`, `internal/kb/search`, `gdpr-export`, `gdpr-erase`, `internal/kb/ingest`, `gdpr-export/request`. Couverture excellente sur les endpoints publics critiques.

## Rate limiting

- Helper `src/lib/rate-limit.ts` (sliding window Redis, fail-open). Câblé sur `_auth.ts:94` via `checkRateLimit('admin:write:${userId}:${actionId}')`.
- Variante `requireAdminWriteRateLimited()` disponible mais **rarement appelée** dans les Server Actions (à vérifier rgpe — adopté seulement sur les écritures à fort blast radius type provider/kill-switch).

## Secrets exposés client

Grep `process\.env\.[A-Z_]+` dans `src/components/` :

- `GalleryGrid.tsx:39` — `process.env.IMAGE_BANK_CDN_URL` — **Server component** (pas de `"use client"` directive). Accès SSR only, **OK**.
- `AdminErrorState.tsx:73` — `process.env.NODE_ENV` — public, no-op détection (`!== "production"`). OK.
- `SpeculationRules.tsx:134` — `process.env.NODE_ENV` — public. OK.
- `VilleServicePageTemplate.tsx:152` — `BUILD_SSG_VILLES_INDEXABLE_ONLY` — Server component. OK.

Aucun secret exposé client détecté. ✅

## Findings

### P0

Aucun.

### P1

1. **Server Actions content-gen sans Zod runtime validation** (`enqueue.ts:56`, `jobs.ts`, `templates.ts`, ...) — confiance sur TS types only. Server Action est un endpoint réseau (Next 16 encrypted, mais l'input reste désérialisé). Risque : payload mal formé via curl/script crée un ContentGenJob row corrompu → worker crash en cascade. Effort fix : ~4-6 h pour wrapper Zod sur les 5 actions principales.
2. **`requireAdminWriteRateLimited()` sous-utilisé** — défini mais `coverage.ts` est le seul gros consommateur (à vérifier dans 26 autres fichiers). Risque : un admin compromis peut driver le pipeline (kill-switch, providers) à pleine vitesse. Cap 60/min/admin de l'helper est exact.

### P2

3. Routes `markdown/[type]/[slug]/route.ts` : pas d'auth, public exposé. Si le contenu sert des markdown sensibles (admin docs), risque. Vérifier le scope `[type]`.
4. `internal/revalidate/route.ts:22-29` : auth HMAC OK, mais pas de rate-limit ; risque DOS via revalidation flood si secret leak.

## Verdict paragraphe

**Auth admin = excellente** (helper centralisé, 3 niveaux, sliding-window). **Validation Zod sous-couverte côté Server Actions content-gen** (1/27) — confiance sur TypeScript, donc dégradation potentielle si un admin/script joue le rôle d'attaquant. **Aucun secret client-exposed** (server components correctement utilisés). 17/25 — perte 8 points sur validation Zod manquante et rate-limit Server Actions sous-utilisé.
