# 01-INVENTAIRE — APIs & Server Actions

## Routes API (`src/app/api/**`) — 10 endpoints

| Endpoint                        | Méthode  | Auth                                   | Rate-limit          | Zod                   | Side-effects                  | Doc                        |
| ------------------------------- | -------- | -------------------------------------- | ------------------- | --------------------- | ----------------------------- | -------------------------- |
| `/api/auth/[...nextauth]`       | GET/POST | NextAuth Credentials + 2FA             | `next-auth` builtin | builtin               | session JWT                   | catch-all v5               |
| `/api/admin/newsletter/export`  | GET      | session admin (cookie + role)          | n/a (admin-only)    | n/a                   | lecture DB seule              | force-dynamic + CSV stream |
| `/api/admin/submissions/export` | GET      | session admin                          | n/a (admin)         | n/a                   | lecture DB                    | force-dynamic + CSV        |
| `/api/healthz`                  | GET      | public                                 | none                | none                  | ping DB + ping Redis          | force-dynamic, no-store    |
| `/api/gdpr-export/request`      | POST     | public + Turnstile + rate-limit        | ✅                  | ✅ Zod                | queue job, génère token signé | rate-limit IP              |
| `/api/gdpr-export`              | GET      | token signé URL                        | ✅                  | URL param valide      | lit blob storage              | force-dynamic + no-cache   |
| `/api/unsubscribe`              | GET      | token signé URL                        | ✅                  | URL param             | mute newsletter               | force-dynamic              |
| `/api/indexnow`                 | POST     | webhook IndexNow secret                | ✅                  | header check          | dispatch ping IndexNow        | force-dynamic              |
| `/api/indexnow/key`             | GET      | public                                 | none                | none                  | renvoie key.txt               | static? force-dynamic      |
| `/api/vitals`                   | POST     | public Turnstile-optional + rate-limit | ✅                  | ✅ web-vitals payload | log → Sentry/Pino             | force-dynamic              |

→ Cartographie cohérente : 4 routes admin/auth, 4 routes RGPD/sécurité (gdpr-export, unsubscribe, indexnow), 2 routes obs (healthz, vitals). Couverture Zod : confirmer dans AGT-10.

## Server actions (`src/features/<domain>/actions.ts`) — 19 fichiers + 1 page

### Domaines admin (14)

- `admin-activity-logs/actions.ts`
- `admin-auth/actions.ts` (login, logout, 2FA)
- `admin-blog/actions.ts`
- `admin-calendar/actions.ts`
- `admin-case-studies/actions.ts`
- `admin-categories/actions.ts`
- `admin-faq/actions.ts`
- `admin-help/actions.ts`
- `admin-newsletter/actions.ts`
- `admin-options/actions.ts`
- `admin-settings/actions.ts`
- `admin-submissions/actions.ts`
- `admin-testimonials/actions.ts`
- `admin-users/actions.ts`

### Domaines publics (5)

- `audit/actions.ts` (form audit)
- `booking/actions.ts` (création booking + email confirmation + Telegram notif PII-redacted)
- `contact/actions.ts` (form contact)
- `implementation/actions.ts` (form implementation)
- `newsletter/actions.ts` (subscribe / unsubscribe + double opt-in)

### Page server action

- `src/app/[locale]/(admin)/[adminPrefix]/page.tsx` ("use server" file-level — à confirmer)

## Audit Zod et sécurité

**À détailler par AGT-10 API-FORMS**. Snapshot Phase 1 :

- `src/lib/schemas/` contient 3 fichiers Zod (forms, auth, locale — d'après `tests/schemas/`).
- Tests schemas : 3 specs (`auth.test.ts`, `forms.test.ts`, `locale.test.ts`).
- Rate-limit : `src/lib/rate-limit.ts` (Redis-backed).
- Telegram PII redaction : `src/lib/pii-redaction.ts` + 14 sites patchés (Sprint 24.1).

## Routes spéciales

| Route                    | Fichier                              | Caching                                             |
| ------------------------ | ------------------------------------ | --------------------------------------------------- |
| `/sitemap-index.xml`     | `src/app/sitemap-index.xml/route.ts` | `force-dynamic`, public max-age=3600 s-maxage=86400 |
| `/llms.txt`              | `src/app/llms.txt/route.ts`          | `force-dynamic`                                     |
| `/llms-full.txt`         | `src/app/llms-full.txt/route.ts`     | `force-dynamic`                                     |
| `/sitemap.ts` (metadata) | présumé ou absent                    | ⚠️ prod 404                                         |
| `/robots.ts`             | `src/app/robots.ts` (à confirmer)    | metadata route Next                                 |
| `/manifest.ts`           | `src/app/manifest.ts` (à confirmer)  | metadata route Next                                 |

⚠️ La route `/sitemap.xml` retourne 404 alors que `/sitemap-index.xml` retourne 200. Soit le `metadata route sitemap.ts` n'existe pas (volontairement remplacé par sitemap-index.xml), soit il existe mais ne génère pas la bonne sortie. **À investiguer AGT-04 SEO + AGT-12 INFRA**.
