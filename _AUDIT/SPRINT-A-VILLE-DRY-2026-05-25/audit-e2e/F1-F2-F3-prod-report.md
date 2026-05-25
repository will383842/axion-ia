# F-1+F-2+F-3 Prod Live Report

**Date**: 2026-05-25  
**Auditor**: F-1+F-2+F-3 Agent (read-only)  
**Domain**: https://axion-ia.com  
**Sprint A commit**: `4b1a881f` (feat(sprint-a): complément V1+V2+V3)  
**Build SHA in prod**: `dc62fdab` (Merge PR #32 — feat/uniformisation-heros-extension)

> **IMPORTANT — Deploy status**: Sprint A (`4b1a881f`) is pushed to `origin/main` but **not yet deployed**. Prod is running `dc62fdab`, the commit immediately preceding Sprint A. GitHub Actions build (~25 min) + Coolify deploy (~28 min) may still be in progress at time of this audit. The checks below reflect the **pre-Sprint-A production state**.

---

## F-2 Healthcheck

| URL | HTTP Status | Note |
|-----|-------------|------|
| `https://axion-ia.com/` | 307 | Temporary redirect → `/fr` (next-intl locale detection, normal) |
| `https://axion-ia.com/fr/` | 308 | Permanent redirect → `/fr` (trailing-slash normalization, normal) |
| `https://axion-ia.com/fr/audit` | **200** | OK — serving correctly |
| `https://axion-ia.com/fr/implantations/ile-de-france/paris` | **200** | OK — ville hub page |
| `https://axion-ia.com/fr/implantations/ile-de-france/paris/audits` | **200** | OK — vertical landing page |
| `https://axion-ia.com/robots.txt` | **200** | OK |
| `https://axion-ia.com/sitemap-index.xml` | **200** | OK |
| `https://axion-ia.com/llms.txt` | **200** | OK — no P0, route serves correctly (P0 was previously fixed) |

### /llms.txt status: 200 — P0 RESOLVED

`/llms.txt` returns 200 with valid content (verified: starts with `# Axion-IA` header, lists canonical pages). The known conflict between `public/llms.txt` and the dynamic route was fixed in a prior sprint.

### Redirect chain notes

- `/` → 307 → `/fr` → 200 (final destination, HIT cache). Expected behavior for locale detection.
- `/fr/` → 308 → `/fr` → 200. Expected trailing-slash normalization.

---

## F-3 Cloudflare Cache

| URL | cf-cache-status | CF-RAY present | Age | x-nextjs-cache | Notes |
|-----|-----------------|----------------|-----|----------------|-------|
| `https://axion-ia.com/fr/` | HIT | Yes | — | HIT | Final dest after 308 redirect; redirect itself is BYPASS |
| `https://axion-ia.com/fr/audit` | BYPASS | Yes | 0 | HIT | CF bypasses but Next.js SSG HIT — first fresh request |
| `https://axion-ia.com/fr/implantations/ile-de-france/paris` | **HIT** | Yes | 74757s (~20.7h) | HIT | Long-lived cached — SSG page with `s-maxage=86400` |
| `https://axion-ia.com/sitemap-index.xml` | HIT | Yes | 11s | STALE | `s-maxage=600`, fresh STALE indicating ISR revalidation pending |

### Cache observations

- **Paris ville page**: `Age: 74757` (~20.7 hours), `Cache-Control: s-maxage=86400, stale-while-revalidate=31449600`. Cloudflare HIT. This is a **pre-Sprint-A SSG page** — it will be refreshed after Sprint A deploys and revalidates.
- **`/fr/audit`**: CF-BYPASS with `x-nextjs-cache: HIT` is normal for dynamic pages protected by auth cookies (authjs CSRFs in response). CF cannot cache POST-safe pages with Set-Cookie.
- **`/sitemap-index.xml`**: STALE (age=11s, s-maxage=600) — ISR triggered, serving stale while regenerating in background. Normal.
- `x-axion-build-sha: dc62fdab4d952c4ec7c7f561eb1942388800b42e` present on all responses — confirms consistent deployment.

---

## F-1 Security Headers

Checked on `https://axion-ia.com/fr/audit` (200 page, full headers):

| Header | Value | Assessment |
|--------|-------|------------|
| `strict-transport-security` | `max-age=31536000; includeSubDomains; preload` | PASS — HSTS with preload, 1 year |
| `content-security-policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ...` | PASS (functional) — `unsafe-inline` + `unsafe-eval` are present; this is a known trade-off for Next.js App Router + Cloudflare Turnstile compatibility. CSP includes frame-ancestors 'none', object-src 'none', upgrade-insecure-requests |
| `x-frame-options` | `DENY` | PASS — clickjacking protection |
| `x-content-type-options` | `nosniff` | PASS |
| `referrer-policy` | `strict-origin-when-cross-origin` | PASS |
| `permissions-policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), magnetometer=(), accelerometer=(), gyroscope=()` | PASS — interest-cohort=() (anti-FLoC) present |
| `cross-origin-embedder-policy` | `credentialless` | PASS |
| `cross-origin-opener-policy` | `same-origin` | PASS |
| `cross-origin-resource-policy` | `same-origin` | PASS |
| `x-dns-prefetch-control` | `on` | INFO — enabled for performance |
| `x-nonce` | per-request nonce | PASS — CSP nonce rotation active |

### Security summary

All critical security headers are present and correctly configured. The `unsafe-inline` + `unsafe-eval` in CSP `script-src` is a known limitation of Next.js 16 App Router with Cloudflare Turnstile and Microsoft Clarity (both require inline scripts). This is a documented acceptable trade-off, not a regression.

---

## Issues Found

### P1 — Sprint A not yet deployed

- **Description**: `x-axion-build-sha: dc62fdab` in prod = commit before Sprint A (`4b1a881f`). Sprint A was pushed to `origin/main` but GitHub Actions build + Coolify deploy cycle (~53 min total) had not completed at audit time.
- **Impact**: New generators (ecosystem/secteurs/faq-extended/cas-usage), RAG kbRetrieve, 2150-city scalability, DRY refactor, and design system changes from Sprint A are not yet live.
- **Action**: Wait for GH Actions to complete (check `.github/workflows/deploy-coolify.yml` run for commit `4b1a881f`). Re-run this audit after deploy is confirmed.

### P2 — `/` uses 307 (temporary) instead of 308 (permanent)

- **Description**: Root `/` returns 307 Temporary Redirect → `/fr`. A 308 Permanent Redirect would be more SEO-optimal (Google caches 308, not 307).
- **Impact**: Minor SEO — Google will re-crawl the redirect on each visit instead of caching it.
- **Action**: Investigate `src/proxy.ts` or `next.config.ts` redirect config for root path. Consider changing to 308 if locale detection is deterministic.

### INFO — CF-BYPASS on `/fr/audit`

- **Description**: CF bypasses caching for authenticated pages due to `Set-Cookie` in response (authjs CSRF tokens issued on every page load). This causes CF-BYPASS on all pages that set auth cookies.
- **Impact**: Higher origin load for uncached requests. Not a security issue.
- **Action**: Consider whether auth CSRF cookies need to be set on all public pages, or only on `/api/auth` routes.

---

## Verdict: CONDITIONAL GO PROD

**Current state (pre-Sprint-A deploy)**: All 6 core URLs return 200. Security headers fully compliant. llms.txt P0 resolved. Cloudflare caching working (HIT on ville page, Age=20.7h). No P0 issues.

**Post-Sprint-A deploy**: Run this audit again once `x-axion-build-sha` shows `4b1a881f` or later to confirm Sprint A routes are live.

| Check | Status |
|-------|--------|
| Core URLs (6/6 returning 200) | PASS |
| llms.txt P0 | RESOLVED |
| Security headers | PASS |
| HSTS + preload | PASS |
| Cloudflare CF-RAY present | PASS |
| Sprint A deployed | PENDING (dc62fdab in prod, 4b1a881f on origin/main) |
| 307 root redirect | P2 (minor) |
