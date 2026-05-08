# 15 — SECURITY FRONTEND 2026

> Audit sécurité frontend : headers, CSP, secrets, XSS, CSRF, dependencies. Sprint 16 prep.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Headers HTTP

1.1 HSTS preload `max-age=63072000; includeSubDomains; preload`
1.2 X-Frame-Options DENY
1.3 X-Content-Type-Options nosniff
1.4 Referrer-Policy strict-origin-when-cross-origin
1.5 Permissions-Policy strict (camera, microphone, geolocation, etc.)
1.6 Content-Security-Policy strict avec nonce dynamique (Sprint 16)
1.7 Cross-Origin-Embedder-Policy si nécessaire
1.8 Cross-Origin-Opener-Policy `same-origin`
1.9 Cross-Origin-Resource-Policy `same-site`
1.10 Mozilla Observatory grade A+ ciblé

### 2. CSP (Content Security Policy)

2.1 CSP nonce dynamique (Sprint 16) — pas `unsafe-inline`
2.2 `script-src 'self' 'nonce-{nonce}'`
2.3 `style-src 'self' 'nonce-{nonce}'` ou hash-based
2.4 `img-src 'self' data: https:`
2.5 `font-src 'self'` (fonts self-hosted)
2.6 `connect-src 'self'` + endpoints autorisés (Cloudflare Analytics, etc.)
2.7 `frame-ancestors 'none'` (équivalent X-Frame DENY)
2.8 `base-uri 'self'`
2.9 `form-action 'self'`
2.10 CSP report-uri ou report-to vers endpoint custom

### 3. Secrets & env vars

3.1 0 secret committé (`gitleaks` CI gate déjà ✅)
3.2 0 `NEXT_PUBLIC_*` contenant info sensible
3.3 `.env.example` à jour, sans valeurs réelles
3.4 `.env.local` dans `.gitignore`
3.5 Secrets stockés Coolify env vars (pas dans repo)
3.6 Rotation secrets documentée (runbook)
3.7 API tokens scope minimal (Cloudflare API : Cache Purge only)
3.8 DB password fort + rotation annuelle
3.9 Auth.js secret strong + rotation Sprint 16+
3.10 Webhook secrets (si applicable) signés HMAC

### 4. XSS / Injection

4.1 React échappe par défaut (vérifier 0 `dangerouslySetInnerHTML` non sanitisé)
4.2 JSON-LD seuls usages legitimate de `dangerouslySetInnerHTML` (contrôlé)
4.3 Markdown rendering (si blog Sprint 14.6) : sanitize obligatoire (DOMPurify ou rehype-sanitize)
4.4 User-input toujours validé Zod
4.5 SQL injection N/A (Prisma parametrize)
4.6 Path traversal : pas de fs.readFile basé user input
4.7 SSRF : fetch URL user-input validated whitelist
4.8 Open redirect : redirects validates whitelist
4.9 Prototype pollution : pas de `Object.assign` sur user input direct
4.10 `eval`, `Function`, `setTimeout(string)` interdits (ESLint rule)

### 5. CSRF, Rate limit, Auth (Sprint 16 prep)

5.1 CSRF token sur Server Actions (built-in Next 16)
5.2 Same-origin policy enforced
5.3 Cookies httpOnly + secure + samesite=Lax (ou Strict)
5.4 Rate limiting Caddy ou Cloudflare (anti-brute force)
5.5 Auth.js v5 setup ready (Sprint 16)
5.6 Password hashing argon2 (déjà installé)
5.7 2FA otplib (déjà installé, Sprint 16)
5.8 Session expiration raisonnable (Sprint 16)
5.9 Brute force protection (Sprint 16)
5.10 Audit log critique actions (Sprint 16)

## Méthode

- Phase A : Mozilla Observatory + securityheaders.com
- Phase A bis : `pnpm audit`, `gitleaks` audit historique
- Phase B : Diagnostic /50
- Phase C : Plan
- Phase D : STOP & ASK
- Phase E : Application (avec coordination Sprint 16)

## STOP & ASK

1. Avant changement headers production
2. Avant CSP nonce activation (peut casser si mal configuré)
3. Avant ajout dépendance auth/crypto
4. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ CSP `unsafe-inline` toléré (annule la sécurité scripts)
- ❌ Secrets dans `NEXT_PUBLIC_*` (visible client)
- ❌ Secrets committed (gitleaks doit toujours bloquer)
- ❌ Rotation secrets « quand on y pensera » (planifier)
- ❌ `dangerouslySetInnerHTML` user-input (XSS garanti)
- ❌ Eval / Function user-input
- ❌ CORS `*` (over-permissive)
- ❌ Cookies sans `httpOnly` ni `secure`
- ❌ Mode debug activé en prod (`NODE_ENV=development`)
- ❌ Désactiver gitleaks/audit dans CI « le temps que ça marche »

## Cible

> Mozilla Observatory grade A+. CSP strict avec nonce. 0 secret leak. 0 XSS exploitable. Sprint 16 ready.

## Livrables

```
audit-15-security-SYNTHESE.md
audit-15-security-DIAGNOSTIC.md
audit-15-security-OBSERVATORY-REPORT.md
audit-15-security-PLAN.md
audit-15-security-CSP-TEMPLATE.md  (Caddyfile + Next middleware)
```
