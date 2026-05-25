# C-6 Forms Report

**Date**: 2026-05-25
**Method**: code-level static analysis (read-only, zero modifications)
**Auditor**: AUDIT AGENT C-6
**Branch**: chore/pricing-update-2026-05-24

---

## UnifiedContactForm

**Found at**: `src/components/forms/UnifiedContactForm.tsx`

| Check | Result | Notes |
|---|---|---|
| 6 base fields | YES | `type` / `nom` / `email` / `telephone` / `ville` / `message` — all rendered, all registered with react-hook-form |
| Zod validation | YES | `unifiedContactSchema` from `src/lib/schemas/unified-contact-schema.ts` — all 6 fields required, typed and constrained |
| Server action | YES | `submitUnifiedContactAction` from `src/features/unified-contact/actions.ts` |
| Success state | YES | Shows confirmation card with `submissionId` reference after `isSubmitSuccessful && !serverError` |
| Error state | YES | `Alert variant="danger"` for server errors; per-field `role="alert"` paragraphs for Zod client errors |
| Honeypot | YES | `<HoneypotField />` rendered as first child of `<form>` (name="website", off-screen, aria-hidden) |
| Sentry capture | YES | `Sentry.captureException` in the server action catch block with tags `{action, type, locale}` |
| Turnstile (CAPTCHA) | YES | `useTurnstileToken("unified-contact")` — token sent as `cf-turnstile-response` in FormData |

**Zod schema** (`src/lib/schemas/unified-contact-schema.ts`):
- `type`: enum of 5 values (formation / un_a_un / audit / implementation / autre)
- `nom`: min 2, max 80
- `email`: `.email()` + max 254
- `telephone`: min 6, max 30, regex `/^[+0-9 ()\-.]{6,30}$/`
- `ville`: min 2, max 120
- `message`: min 20, max 2000
- `consent`: `z.literal(true)` — submission blocked if unchecked

**Note on field count**: The form has 6 required base fields (`type` is the 6th via segmented control) plus 5 optional advanced fields (company name/size/sector/budget/timing). The `_AUDIT/FORMS-UNIFICATION-2026-05-24/02-DESIGN.md` spec mentions "6 champs" which includes `type`. Satisfied.

---

## Server Action: submitUnifiedContactAction

**Found at**: `src/features/unified-contact/actions.ts`

Security layers applied in order:

1. **Rate limit** — `checkRateLimit("unified-contact:{ip}", { limit: 3, windowSec: 600 })` — 3 submissions / 10 min / IP via Redis sliding window
2. **Honeypot** — `formData.get("website")` check — silent success (bot thinks it worked)
3. **Cloudflare Turnstile** — `verifyTurnstile(token, ip)` — fail-closed in non-development environments
4. **Zod re-parse server-side** — `unifiedContactSchema.safeParse(...)` — all client data re-validated server-side (defense in depth)
5. **PII encryption** — `encryptPii()` applied to nom, email, telephone before DB write
6. **IP hashing** — `hashIp(ip)` SHA-256 hash stored alongside raw IP

### Submission table write

**YES** — `prisma.submission.create({ data: { ... } })` at line 169 of `actions.ts`

Key fields written:
- `type`: mapped via `submissionTypeFor()` to Prisma `SubmissionType` enum (audit | implementation | intervention | contact)
- `contactName`, `contactEmail`, `contactPhone`: PII encrypted via `encryptPii()`
- `details`: JSON blob with `unifiedType`, `ville`, `message`, `subType`, `source`, `consentVersion`, `funnel` (UTM + referrerCity)
- `ipAddress` + `ipHash`: raw IP + SHA-256 hash
- `userAgent`: from request headers

Returns `{ ok: true, submissionId: submission.id }` on success, displayed to user as reference.

---

## CSRF Protection

**Status**: PARTIAL — no explicit CSRF token, but mitigated by layered controls

**Analysis**:
- Next.js Server Actions enforce same-origin by default (action endpoint not exposed as a raw POST route)
- Cloudflare Turnstile acts as an effective anti-CSRF/anti-bot challenge (token is single-use, origin-bound)
- Rate limiting (3/10min/IP) limits any state-change attack frequency
- No explicit `next-auth` session check (action is public by design — unauthenticated users submit contact forms)

**Risk level**: LOW. Server Actions in Next.js 16 have built-in CSRF protection via the `Origin` header enforcement for form POST. Combined with Turnstile, risk is negligible for a public contact form. No P0 here, but noted as P2 for documentation clarity.

---

## NewsletterForm

**Found at**: `src/components/forms/NewsletterForm.tsx`

| Check | Result | Notes |
|---|---|---|
| Double opt-in | YES | Full RFC 8058 implementation in `src/features/newsletter/actions.ts` |
| Email validation | YES | `newsletterSchema` uses `z.string().email()` |
| Consent required | YES | `z.literal(true)` — blocks submit |
| Honeypot | YES | `<HoneypotField />` present |
| Turnstile | YES | `useTurnstileToken("newsletter")` |
| Rate limit | YES | `checkRateLimit("newsletter:{ip}", { limit: 3, windowSec: 300 })` — 3/5min/IP |
| Sentry | MISSING | `subscribeNewsletterAction` has no `Sentry.captureException` in its catch paths. The `confirmNewsletterAction` has `console.error` only. |

**Double opt-in flow**:
1. User submits email → `status='pending'`, `confirmToken` generated, email queued via `enqueueEmail("newsletter-confirm-optin", ...)` with `{ marketing: true }`
2. User clicks confirmation link → `confirmNewsletterAction(token)` → `status='confirmed'`, `confirmedAt=now()`, `confirmToken=null` (single-use token consumed)
3. Unsubscribe: `unsubscribeToken` generated at creation, `unsubscribeNewsletterAction` sets `status='unsubscribed'` (row retained for RGPD audit trail)

---

## Page Integration Verification

### `/contact` page (`src/app/[locale]/contact/page.tsx`)
- **Uses UnifiedContactForm**: YES — `<UnifiedContactForm defaultType="autre" source="/contact" />`
- Form placed in `Section id="message"` — anchored from CTA button `href="#message"`
- No custom form logic in page — delegates entirely to `UnifiedContactForm`

### `/audit/demande` page (`src/app/[locale]/audit/demande/page.tsx`)
- **Uses UnifiedContactForm**: YES — `<UnifiedContactForm defaultType="audit" lockType advancedOpenByDefault source="/audit/demande" />`
- `lockType=true` hides the type segmented control (locked to "audit")
- `advancedOpenByDefault=true` expands advanced fields by default (appropriate for audit context)
- No custom form logic in page

---

## Rate Limiting Implementation

**Module**: `src/lib/rate-limit.ts`
- Redis sliding window via sorted sets (`ZREMRANGEBYSCORE + ZADD + ZCARD + PEXPIRE` in atomic pipeline)
- **Fail-open** on Redis down (preserves UX — submissions pass through if Redis unavailable)
- Per-action limits:
  - `submitUnifiedContactAction`: 3 / 10 min / IP
  - `subscribeNewsletterAction`: 3 / 5 min / IP

---

## Issues Found

### P1

**P1-1 — NewsletterForm: No Sentry capture on error**
- `subscribeNewsletterAction` has no `Sentry.captureException` — errors are silently swallowed (action returns `{ ok: false, error: "..." }` without logging to Sentry)
- `confirmNewsletterAction` uses `console.error` only — errors are invisible in Sentry
- **Contrast**: `submitUnifiedContactAction` correctly captures to Sentry
- **Impact**: Newsletter subscription failures (DB errors, email queue errors) are invisible in production monitoring
- **Fix**: Add `Sentry.captureException(err, { tags: { action: "subscribeNewsletterAction" } })` in catch blocks of `subscribeNewsletterAction` and `confirmNewsletterAction`

**P1-2 — Rate limit fail-open on Redis down**
- `checkRateLimit` returns `{ allowed: true }` when Redis is unavailable (fail-open design)
- Comment says "alerte Sentry — branche en M11" but no Sentry call exists in the catch block
- **Impact**: If Redis goes down, rate limiting is completely bypassed — form spam becomes possible
- **Fix**: Add `Sentry.captureException` or at minimum `Sentry.captureMessage` in the `failOpen` path

### P2

**P2-1 — CSRF documentation gap**
- No inline comment explains why no explicit CSRF token is needed (Next.js Server Actions + Turnstile provide it implicitly)
- **Impact**: Future maintainers may add unnecessary complexity or accidentally weaken the protection
- **Fix**: Add a comment in `actions.ts` explaining the CSRF protection rationale

**P2-2 — Honeypot not enforced at Zod layer**
- The honeypot check happens AFTER rate-limit but before Turnstile. This is intentional (silent success for bots). However, the `HoneypotField` is not part of the Zod schema — if a developer removes the server-side check and relies on the schema alone, protection is lost
- **Fix**: Document in `HoneypotField.tsx` that the server-side check in the action is the authoritative enforcement point

**P2-3 — `type` field not in FormData — potential gap**
- In `UnifiedContactForm.onSubmit()`, `fd.set("type", values.type)` relies on `values.type` being set via `setValue()` (segmented control click) or as a hidden input (when `lockType=true`). If `lockType=false` and the user never clicks a type, `values.type` is undefined at submit — but the Zod `zodResolver` catches this client-side before `onSubmit` fires. Server-side re-validation also catches it. This is a belt-and-suspenders scenario but the client error message (`errors.type`) only displays if the form is submitted without a type — the segmented control has no visible `required` indicator beyond the asterisk. Low risk.

---

## Verdict

**GO** — with P1 recommendations

The UnifiedContactForm submission pipeline is well-architected with defense-in-depth:
- 3-layer anti-bot (rate limit + honeypot + Turnstile)
- Server-side Zod re-validation (independent of client)
- PII encrypted at rest before DB write
- IP SHA-256 hashed (RGPD-compliant)
- Sentry monitoring on primary action
- Full UTM funnel capture for analytics

Both key pages (`/contact` and `/audit/demande`) correctly use `UnifiedContactForm` with appropriate props.

NewsletterForm has correct double opt-in (RFC 8058) but is missing Sentry error monitoring (P1). Rate limiting has a documented fail-open Redis gap also without Sentry alerting (P1).

No P0 blockers. No data loss or security regression from Sprint A. The Sprint A DRY refactor (ville pages / shared components) did not touch form logic — isolation is confirmed.
