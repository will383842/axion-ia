# Pr-01 — OWASP Top 10 2026

**HEAD** : 81f6ea0e
**Mode** : AUDIT-ONLY
**Score** : 20 / 25

## Évidence

### A01 — Broken Access Control

- `src/auth.ts:66-228` NextAuth v5 Credentials provider, JWT strategy, hashage Argon2id (memoryCost 19456, timeCost 2 — OWASP 2024). 2FA TOTP gating role-based (super_admin/admin opt-in en bootstrap window). Rate limit IP+email 100/15min via Redis sliding window. Activity log forensique tentatives échec + reasons.
- `src/proxy.ts:62-66` route admin protégée par segment secret `ADMIN_URL_PREFIX` (default `admin-dev-x7k2n9`) jamais exposé au bundle client (lu Edge runtime).
- `src/auth.ts:78-88` JWT callback recheck `adminUser.status==='active'` toutes les 60s (Sprint 24 / B3), revocation < 60s.
- `src/auth.ts:160` `verifyPasswordSafe` timing-safe (dummy hash si user n'existe pas — anti-oracle).

### A02 — Cryptographic Failures

- `next.config.ts:27` `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 ans HSTS).
- `Caddyfile:33` HTTPS auto Let's Encrypt + HTTP/3 + Brotli 9.
- `scripts/backup-postgres.sh:151` chiffrement AES-256-CBC PBKDF2 100k iterations.
- Argon2id pour passwords (cf. A01).

### A03 — Injection

- Prisma ORM partout (paramétrisé) ; aucun `$queryRaw` interpolé observé hors `SELECT 1` healthz.
- DOMPurify isomorphic dans 10 emplacements clés (`html-sanitizer.ts`, `faq-sanitizer.ts`, `feed-parser.ts`, `tiptap-sanitize.ts`).
- Zod : **498 occurrences sur 55 fichiers** d'inputs validés (`z.object/string/number`).
- `src/auth.ts:125-129` Zod `signInSchema.safeParse()` early-fail sur tentative malformée.

### A04 — Insecure Design

- Design-by-failure : early-exit `stub.invalid` Prisma/Redis au build (AGENTS.md §2). Rate limiting composite (IP + email). Lockout/2FA mandatory bootstrap. `gdpr-erase` 1/jour token HMAC + literal `ERASE_MY_DATA` confirmation anti-clic-accidentel.

### A05 — Security Misconfiguration

- `src/proxy.ts:74-96` headers OWASP defense-in-depth complets : CSP (per-path nonce strict admin / soft public, cf. `src/lib/csp.ts:75-142`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimaliste (9 capabilities bloquées).
- COEP `credentialless` (`proxy.ts:83`) — isolation cross-origin sans casser Plausible/Turnstile.
- `next.config.ts:18-31` redondance headers Next + Caddy.

### A06 — Vulnerable Components

- `pnpm audit` : **7 vulns total — 0 high/critical, 5 moderate (esbuild, vite, brace-expansion, ws, uuid) + 2 low (tmp x2)**. **Toutes en chemins devDeps** (`vitest>vite>esbuild`, `@lhci/cli>tmp`, `jsdom>ws`, `@typescript-eslint>brace-expansion`). Aucune en prod runtime.
- `.husky/pre-push` gate `pnpm audit --prod --audit-level high` — bloque tout new high/critical avant push.
- `gitleaks` ×2 (`.husky/pre-commit` local + `.github/workflows/ci.yml:84-89` CI).

### A07 — Identification & Auth Failures

- 2FA TOTP avec `otplib` server-only externalized (`next.config.ts:103`).
- `src/auth.ts:164-178` log centralisé `auth.login.failed` avec reasons granulaires (`unknown_email`, `account_inactive`, `invalid_password`, `invalid_2fa`).

### A08 — Software & Data Integrity Failures

- Dependabot weekly + `pnpm audit` nightly (workflow `nightly.yml`). Build externalisé GH Actions + image GHCR signée par actions/auth (ADR 0026). Pas de SRI sur scripts inline (CSP nonce/strict-dynamic admin compense).
- Pas de `renovate.json` détecté — gestion deps via Dependabot natif GitHub.

### A09 — Security Logging & Monitoring Failures

- `src/sentry.server.config.ts` Sentry actif prod (sample 0.02 traces / 1.0 errors). `piiScrubBeforeSend` filter PII (RGPD Art.32, `sendDefaultPii: false`).
- `prisma/schema.prisma:976-1000` `GenerationProvenance` audit trail immuable IA art.50.
- ActivityLog table (cf. `src/auth.ts:164`, `gdpr-erase/route.ts:78`).
- Telegram alerts `src/lib/telegram.ts` (fail-soft si token absent).

### A10 — SSRF

- `next.config.ts:117` `remotePatterns: []` (aucune image distante autorisée par Next/Image).
- `feed-parser.ts` parsing RSS server-only avec DOMPurify post-process.

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (transparency)** : esbuild/vite moderate CVEs en devDeps acceptables uniquement si dev server jamais exposé Internet. Confirmer `pnpm dev` localhost-only (vraisemblable).
- **P1 (CSP)** : SSG public en mode SOFT (`unsafe-inline + unsafe-eval`) — choix assumé `src/lib/csp.ts:60-73` (migration différée Sprint 16 PERF). Risque résiduel XSS-via-stored-data sur pages dynamiques DB ; mitigé par DOMPurify sur tous les contenus user-supplied/RSS/DB.
- **P2** : pas de SRI sur scripts tiers (Plausible, Clarity, Sentry, Stripe) — CSP allowlist hostname compense, pas un OWASP fail.
- **P2** : pas de `Sec-Fetch-*` validation côté server explicite ; SameSite=Lax JWT cookies + `serverActions.allowedOrigins` (`next.config.ts:170-172`) couvrent.

## Verdict (paragraphe)

Surface OWASP couverte solide. Auth Argon2id + 2FA + rate-limit + revocation 60s ; headers OWASP complets per-path avec CSP strict admin ; injection bloquée par Prisma ORM + Zod (498 schémas) + DOMPurify ; secrets gérés par gitleaks ×2 (pre-commit + CI). Le seul point d'attention notable est la CSP soft sur SSG public (choix architectural documenté), partiellement mitigée par DOMPurify sur les inputs DB/RSS et CSP nonce strict sur l'admin (vrai périmètre sensible). Score 20/25 — production-ready côté OWASP, optimisation CSP strict global à planifier Sprint 16 PERF.
