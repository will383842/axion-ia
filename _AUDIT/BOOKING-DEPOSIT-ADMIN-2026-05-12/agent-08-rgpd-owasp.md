# Agent 08 — RGPD / OWASP / Anti-fraude / Auditabilité

**Audit master** : `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (V3, 2026-05-12)
**Repo** : `axionia/` · HEAD `ff3ccbc`
**Mode** : 🚫 AUDIT-ONLY · lecture + écriture unique de ce `.md`
**Périmètre** : sécurité, RGPD, anti-fraude, auditabilité et PCI-DSS pour la cible V1 booking deposit-gated + admin (Stripe + Yousign + cadrage), à partir des écarts identifiés au `00-REALITY-CHECK.md`.

---

## 1. Périmètre audité

### 1.1 In-scope

- Sous-processeurs documentés vs cible V1 (Stripe, Yousign, R2/Storage Box éventuel).
- `/api/gdpr-export` + `/api/gdpr-export/request` (Sprint 24/D2).
- Auth admin : `src/auth.config.ts`, `src/auth.ts`, `src/lib/auth-password.ts`, `src/lib/auth-2fa.ts`, `src/lib/rate-limit.ts`.
- CSP / COEP / headers OWASP : `src/proxy.ts`, `src/lib/csp.ts`, `next.config.ts`.
- ActivityLog : modèle `prisma/schema.prisma:649-666` + producers (`admin-*/actions.ts`, `retention-purge-worker.ts`).
- Retention RGPD : `src/server/queue/workers/retention-purge-worker.ts`.
- PII minimisation Telegram : `src/lib/pii-redaction.ts` (ADR 0010).
- Anti-spam visiteur : Turnstile + honeypot + rate-limit (Phase 0 §2.1).
- Conformité légale : `src/content/legal.ts` (mentions, CGV, confidentialité, cookies).

### 1.2 Out-of-scope (instructions Phase 0 §8)

- Qualiopi / OPCO / PDP / régime TVA détaillé / structure juridique FR vs EE.
- Pentest actif live (read-only/static audit uniquement).
- Architecture e-invoicing Chorus Pro / Factur-X.

### 1.3 Cible fonctionnelle V1

Déposit-gated booking (acompte 50 % Stripe Checkout), cadrage visio, devis + NDA Yousign, onboarding documents (optionnel), facture (PDF + numérotation), self-service magic link client (D19/D20).

---

## 2. Constats positifs (✅)

1. **RBAC admin propre et appliqué partout.** 4 rôles (`super_admin/admin/editor/reader`) déclarés `prisma/schema.prisma:128-133`, garde-fou systématique via `requireAdminReadSession()` / `requireAdminWriteSession()` dans les 13 modules `src/features/admin-*/actions.ts`. RGPD-erase est strictement scopé `super_admin` (`admin-submissions/actions.ts:241-249`, idem `admin-newsletter`).
2. **Auth Credentials durci (Sprint 15 + 24).** Argon2id (memoryCost 19456, timeCost 2 — OWASP 2024 conforme `auth-password.ts`), TOTP 2FA optionnel (`auth-2fa.ts` + `auth.ts:186-204`), timing-safe verify contre oracle email valide/invalide (`auth.ts:160` + `verifyPasswordSafe`), rate-limit composite IP + email Redis sliding window (`auth.ts:142-152`), revocation < 60 s via JWT cache (`auth.ts:28-45`).
3. **PII minimisation Telegram livrée (ADR 0010).** `redactEmail`, `redactName`, `redactPhone`, `redactContactLine` dans `src/lib/pii-redaction.ts:22-66` appliqués sur 14 sites d'appel (cf. mémoire `axionia_session_2026-05-09_sprint_24_1.md`). Couvre la dérogation art. 49 RGPD pour Telegram FZ-LLC (EAU hors UE/DPF).
4. **Retention RGPD automatisée.** `retention-purge-worker.ts:1-150` purge quotidienne (cron `0 3 * * *` UTC) avec defaults (logs 12 mois / submissions archived 24 mois / newsletter unsub 36 mois / bookings cancelled 12 mois), trace `*.purged` + `emailHash SHA-256` en ActivityLog (`worker.ts:80-93,107-122`), anti-misconfig env `< 1` (`worker.ts:42`).
5. **CSP nonce + COEP credentialless en place.** `src/proxy.ts:30-53` génère un nonce par requête, mode strict admin (`strict-dynamic` + nonce, pas d'`unsafe-inline`) et soft pour le SSG public (cf. `csp.ts:75-108`). `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` posés.
6. **Headers OWASP secondaires complets.** `next.config.ts:18-31` pose HSTS 2 ans preload + includeSubDomains, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` minimale (payment=(), camera=(), microphone=(), etc.), COOP same-origin, CORP same-origin.
7. **GDPR export self-service rate-limit + token signé HMAC.** `gdpr-token.ts:65-117` HMAC-SHA256 sur Web Crypto, TTL 24 h, `jti` 12-bytes, anti-replay via match email body↔token (`route.ts:50-52`), rate-limit 3/jour/email (`route.ts:41-44`), anti-énumération sur `/request` (toujours 200, `request/route.ts:42-44`), `ActivityLog gdpr.export.delivered` tracé.
8. **Honeypot + Turnstile uniformes sur 6 forms publics.** Champ `website` + `verifyTurnstile` testés Phase 0 §2.1 + §9 verdict 🟢 OK.
9. **Cookies conformes CNIL/AKI 2022.** Plausible self-hosted sans cookie persistant, exception RGPD art. 5.3 documentée `legal.ts:299-301`. Pas de cookie publicitaire ni third-party.

---

## 3. Constats négatifs

### 3.1 🚨 P0 (bloquant V1)

- **P0-1 — Aucun DPA en code ni preuve d'inventaire signature pour Stripe / Yousign / R2.** `legal.ts:230` liste 3 sous-processeurs (Hetzner / Cloudflare / Telegram). V1 doit ajouter Stripe Payments Europe Ltd (Dublin IE, EU intra), Yousign SAS (Vincennes FR, EU intra), éventuellement Cloudflare R2 ou Hetzner Storage Box (déjà listé) pour `OnboardingDoc`. **Risque** : article 13.1.e + art. 28 RGPD non respectés au moment où la prod traite le 1ᵉʳ paiement.
- **P0-2 — Webhook Stripe absent ⇒ pas de signature à vérifier, pas d'idempotency `event.id`.** Phase 0 §2.2 confirme « pas de `handleStripeWebhookAction` ». Doctrine V1 cible : `stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)` (cf. [Stripe docs — Verify webhook signatures](https://stripe.com/docs/webhooks/signatures)) + table `StripeWebhookEvent { id @id, type, receivedAt }` pour rejouer < 5 min (cf. tolerance Stripe). Sans, l'endpoint sera trivialement spoofable.
- **P0-3 — Webhook Yousign absent ⇒ idem.** HMAC signature Yousign à vérifier (header `X-Yousign-Signature-256`, secret partagé dans Yousign dashboard) + idempotency `event.id`.
- **P0-4 — Pas de protection replay sur les Server Actions Next.** `next.config.ts` ne déclare **pas** `experimental.serverActions.allowedOrigins`. Next 16 fait un check origin par défaut, mais avec proxy Cloudflare + Coolify (Hetzner) en amont, `Host` peut être réécrit. **Sans whitelist explicite**, un attaquant peut potentiellement déclencher une Server Action depuis un site qu'il contrôle si la victime y est authentifiée admin. Cf. [Next.js Server Actions security](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security).
- **P0-5 — Aucun `Refund` ni mécanisme automatique pour les clauses CGV.** `legal.ts:134` (FR) promet « 100 % > 7 j / 50 % 7-2 j / 0 % < 2 j ». Sans table `Refund` ni écouteur webhook `charge.refunded`, la clause est purement manuelle ⇒ litige facile + non-conformité commerciale. Bloque la V1 deposit-gated.
- **P0-6 — Pas de validation server-side de `success_url` / `cancel_url` Stripe ⇒ risque open redirect.** Lors de la création de la `checkout.session`, **toujours** vérifier que les URLs sont sur `axion-ia.com` (cible self-domain, pas un wildcard). Implémentation cible : helper `assertSameOriginUrl(url)` + zod.url() restreint au domaine. Cf. [OWASP Top 10 2025 — A10 Server-Side Request Forgery & redirects](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/) (catégorie cousine).
- **P0-7 — Magic link self-service (D19/D20) à concevoir avec mêmes garde-fous que `/api/gdpr-export`.** Réutiliser `gdpr-token.ts` (HMAC `AUTH_SECRET`, TTL ≤ 24 h, scope = `action + bookingId + email`). Sans, n'importe quel lien fuit → accès direct au booking d'un tiers.

### 3.2 ⚠️ P1 (avant prod commerciale)

- **P1-1 — Newsletter Mailwizz non listé en sous-processeur.** Phase 0 §9 #5 verdict 🟡. `NewsletterSubscriber.mailwizzListUid` + `mailwizzSubUid` (`prisma/schema.prisma:701-702`) prouvent une intégration Mailwizz. Doit apparaître dans `legal.ts:230` avec localisation, base légale, DPA.
- **P1-2 — `/api/gdpr-export` ne couvre PAS les modèles V1 cibles.** `route.ts:54-98` exporte `Submission` + `bookings` (limité aux 7 champs `select`) + `NewsletterSubscriber`. **Manquent (V1 cible)** : `Payment`, `Invoice`, `Quote`, `Nda`, `CadrageMeeting`, `OnboardingDoc`, `BookingOption` (non joint via Submission). Selon RGPD art. 15 (droit d'accès) + art. 20 (portabilité), tout traitement nominatif doit être restitué.
- **P1-3 — `ActivityLog.changes` schéma Json libre — pas de snapshot before/after standardisé.** Producers actuels (`admin-submissions/actions.ts:212-220`, etc.) écrivent seulement les nouveaux champs (pas un diff). Pour la cible V1 (audit booking deposit + admin write-side), exiger `{ before: {...}, after: {...}, fields: [...] }` est nécessaire si litige sur modification tardive.
- **P1-4 — Pas de protection contre la création massive de checkout (DoS Stripe / coût API).** Une fois Stripe branché : prévoir `checkRateLimit('stripe:checkout:<ip>', { limit: 5, windowSec: 600 })` côté Server Action `createCheckoutSessionAction`.
- **P1-5 — Pas de `Idempotency-Key` côté création checkout.** Stripe recommande `Idempotency-Key: bookingId-deposit-v1` pour `POST /v1/checkout/sessions` ([Stripe docs — Idempotent requests](https://stripe.com/docs/api/idempotent_requests)). Sans, double-clic UI ⇒ deux sessions facturées.
- **P1-6 — Dispute handling absent.** Lors d'un `charge.dispute.created`, V1 doit : marquer booking `disputed`, alerter Telegram tag `LITIGE`, geler les emails clients, créer une entrée Sentry. Aucune entrée Phase 0.
- **P1-7 — Stripe Radar non documenté.** Stripe Radar est inclus gratuitement en niveau base. Aucun ADR / mémoire. À activer + documenter règles (`Block CVC fails > 1`, `Block IP riskscore > 75`).
- **P1-8 — Cookie sessions Auth.js : pas de mention `__Secure-` / `__Host-` prefix audit.** Auth.js v5 pose par défaut `__Secure-authjs.session-token` quand `useSecureCookies: true` (production). À confirmer sur prod via `curl -I https://axion-ia.com/<admin>/login` (out-of-scope, mais P1 documentaire).
- **P1-9 — `frame-src 'self' https://challenges.cloudflare.com` dans `csp.ts:101`.** Pour Stripe Checkout (UI redirect, pas iframe — Stripe Checkout est full-page redirect par défaut), pas de souci. **Mais** si V2 active Stripe Payment Element (iframe), ajouter `https://js.stripe.com` + `https://checkout.stripe.com` à `frame-src` et `https://api.stripe.com` à `connect-src`. À documenter dès maintenant pour éviter un blocage prod silencieux le jour J.
- **P1-10 — SLA email 1 h ouvrée annoncé sans monitoring.** Phase 0 §9 #8 ⇒ enqueue immédiat mais pas de telemetry sur l'âge des jobs `emails` queue. À monitorer via dashboard BullMQ ou Sentry breadcrumbs.

### 3.3 P2 (V1.x / V2)

- **P2-1 — `unsafe-inline` + `unsafe-eval` autorisés sur la CSP soft du SSG public** (`csp.ts:86-92`). Décision documentée comme tradeoff Sprint 16 PERF. À garder en backlog (migration hash-based ou layout `force-dynamic` global pour passer en strict).
- **P2-2 — `verify2FACode(totp, secret)` sans rate-limit dédié sur le step TOTP.** Le rate-limit `auth:login:email` (50/15 min) compte l'ensemble du flow mais pas spécifiquement les codes TOTP — un attaquant ayant pwd+email valide a 50 tentatives × 1M possibilités = vulnérable mathématiquement faible mais à durcir (limit 5/5 min sur l'étape TOTP).
- **P2-3 — `registrikood` + TVA EE non publiés** (`legal.ts:44`). RGPD ne l'exige pas directement, mais transparence sous-processeur recommande l'affichage. Lié à `[À REVISITER V2+]` Phase 0 §8.5.
- **P2-4 — Email throwaway check non implémenté.** Pour V1 nice-to-have (DEA list `disposable-email-domains`). Limite l'abus de bookings éphémères.
- **P2-5 — Multiple bookings same email limit.** Pas de cap actuel. V2+ : `checkRateLimit('booking:email:<email>', { limit: 3, windowSec: 86_400 })`.
- **P2-6 — Activity log retention 12 mois.** Pour les actions financières (payment.captured, refund.issued), allonger à 10 ans (cohérence obligation facturation EE) via classification `actionCategory` + delete conditionné.

---

## 4. Recommandations — Top 12 (impact × effort inverse)

| #   | Reco                                                                                                                                                              | Impact | Effort | Phase                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | --------------------- |
| 1   | Ajouter Stripe (IE), Yousign (FR), Mailwizz (FR/EU) dans `legal.ts:230` + EN + page dédiée `/sous-processeurs`                                                    | 🚨     | XS     | V1 Sprint 25          |
| 2   | Table `StripeWebhookEvent(id @id, type, payload Json, receivedAt, processedAt?)` + middleware `verifyAndStore(event)` rejette duplicates                          | 🚨     | S      | V1 Sprint 25          |
| 3   | Helper `verifyYousignWebhook(req, secret)` HMAC-SHA256 + table `YousignWebhookEvent`                                                                              | 🚨     | S      | V1 Sprint 26          |
| 4   | Whitelist `experimental.serverActions.allowedOrigins = ['axion-ia.com', 'www.axion-ia.com']` dans `next.config.ts`                                                | 🚨     | XS     | V1 immédiat           |
| 5   | `zod.url().startsWith('https://axion-ia.com/')` pour `success_url` / `cancel_url` côté action checkout                                                            | 🚨     | XS     | V1 Sprint 25          |
| 6   | Étendre `/api/gdpr-export/route.ts` `select` aux modèles V1 (`Payment`, `Invoice`, `Quote`, `Nda`, `CadrageMeeting`, `OnboardingDoc`, `BookingOption`)            | ⚠️     | S      | au fil des sprints DB |
| 7   | Standardiser `ActivityLog.changes = { before, after, fields[] }` via helper `logAdminChange(action, before, after)`                                               | ⚠️     | M      | V1 Sprint 27          |
| 8   | Rate-limit + Idempotency-Key sur `createCheckoutSessionAction` (`stripe:checkout:<ip>` 5/600s + `Idempotency-Key: <bookingId>-deposit`)                           | ⚠️     | S      | V1 Sprint 25          |
| 9   | Magic-link self-service (cancel/postpone booking) : factoriser `gdpr-token.ts` ⇒ `signed-token.ts` générique avec scope `{ action, bookingId, email }` + TTL 24 h | 🚨     | M      | V1 Sprint 26          |
| 10  | Dispute handler `charge.dispute.created` ⇒ `Booking.status = 'disputed'` + Telegram tag `LITIGE`                                                                  | ⚠️     | S      | V1 Sprint 25          |
| 11  | Activer Stripe Radar (Dashboard) + documenter règles (`Block CVC fails`, `Block IP riskscore`) dans `_AUDIT/STRIPE-RADAR.md`                                      | ⚠️     | XS     | V1 Sprint 25          |
| 12  | Classification `ActivityLog.category` (`auth/admin-write/financial/rgpd`) + retention différentiée (financial = 10 ans, autres = 12 mois)                         | P2     | M      | V2                    |

---

## 5. Sources citées

- [RGPD art. 13.1.e — destinataires des données](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) (UE 2016/679).
- [RGPD art. 15 (accès) + art. 17 (effacement) + art. 20 (portabilité) + art. 28 (sous-traitant)](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra).
- [RGPD art. 49 — dérogations transferts hors UE](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) (base Telegram FZ-LLC EAU).
- [CNIL — Délibération cookies n°2020-091 (CNIL/AKI 2022 confirme exemption Plausible)](https://www.cnil.fr/fr/cookies-et-autres-traceurs-la-cnil-publie-de-nouvelles-lignes-directrices).
- [Stripe — Verify webhook signatures](https://stripe.com/docs/webhooks/signatures).
- [Stripe — Idempotent requests](https://stripe.com/docs/api/idempotent_requests).
- [Stripe — SAQ A eligibility (Stripe Checkout hosted)](https://stripe.com/docs/security/guide#validating-pci-compliance).
- [Stripe — Radar fraud detection](https://stripe.com/docs/radar).
- [OWASP Top 10 2025 — A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).
- [OWASP Top 10 2025 — A02 Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/).
- [OWASP Top 10 2025 — A05 Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/).
- [OWASP Top 10 2025 — A07 Identification & Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/).
- [OWASP Top 10 2025 — A10 SSRF/redirects](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/).
- [OWASP ASVS 4.0.3 — V8 Data Protection](https://owasp.org/www-project-application-security-verification-standard/).
- [OWASP Cheat Sheet — Argon2id memoryCost 19456, timeCost 2](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- [Next.js — Server Actions security (allowedOrigins, CSRF, origin check)](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security).
- [Yousign — Webhook signature verification](https://developers.yousign.com/docs/webhook-signature).
- [PCI-DSS SAQ A v4.0 (mai 2026)](https://www.pcisecuritystandards.org/document_library/).
- Sources internes :
  - `src/lib/csp.ts:75-108` (CSP nonce + strict-dynamic admin).
  - `src/proxy.ts:30-53` (nonce per-request + COEP credentialless).
  - `src/auth.ts:142-204` (rate-limit + 2FA + timing-safe).
  - `src/server/queue/workers/retention-purge-worker.ts:54-150` (purge cron).
  - `src/lib/gdpr-token.ts:65-117` (HMAC token self-service).
  - `src/app/api/gdpr-export/route.ts:54-122` (export RGPD).
  - `src/lib/pii-redaction.ts:22-66` (ADR 0010 Telegram).
  - Phase 0 `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1-§9.

---

## 6. Scoring /100

| Domaine             | Note       | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RGPD complétude** | 14/25      | Forces : retention auto + GDPR export self-service signé + PII Telegram + base légale documentée. Manques : sous-processeurs incomplets (Mailwizz, Stripe, Yousign à venir), `gdpr-export` non couvre les modèles V1 cibles (Payment/Invoice/Quote/Nda/Cadrage), pas de page `/sous-processeurs` dédiée, registrikood non public.                                                                                                             |
| **OWASP Top 10**    | 17/25      | Forces : CSP nonce + strict-dynamic admin, headers OWASP complets, auth durci argon2id + 2FA + rate-limit + timing-safe + revocation < 60 s, RBAC 4 rôles, frame-ancestors none. Manques : `serverActions.allowedOrigins` non configuré (P0-4), open redirect risk sur success_url/cancel_url à venir (P0-6), pas de rate-limit dédié TOTP step. CSP soft public `unsafe-inline` documenté tradeoff.                                          |
| **Anti-fraude**     | 10/20      | Forces : Turnstile + honeypot + rate-limit sur 6 forms publics, double opt-in newsletter, lockout Redis 50 tentatives/15 min email. Manques : aucun webhook Stripe / Yousign signé (P0-2/P0-3), Stripe Radar non activé/doc, pas de dispute handler, pas de cap booking/email, pas d'email throwaway check.                                                                                                                                   |
| **Auditabilité**    | 13/20      | Forces : ActivityLog appelé sur toutes les Server Actions admin write, conservation emailHash après purge (RGPD-grade), tracé login success/fail avec reason (oracle-safe). Manques : pas de snapshot before/after standardisé, retention uniforme 12 mois pour tous types d'event (financiers devraient être 10 ans), Telegram non auditable (rétention courte, hors UE), `gdpr-token.jti` non persisté en DB ⇒ pas de révocation per-token. |
| **PCI-DSS**         | 9/10       | Stripe Checkout = SAQ A par construction (no card data hits server). Tout est aligné. Manque seulement la documentation formelle (ADR `0011-pci-saq-a.md`) + déclaration annuelle Stripe Dashboard.                                                                                                                                                                                                                                           |
| **TOTAL**           | **63/100** | Base technique très solide post-Sprint 24/24.1 ; tous les gaps proviennent du fait que **les modèles Payment/Invoice/Quote/Nda/Webhook n'existent pas encore** (Phase 0 §1.1 confirmé). La note remontera mécaniquement à ~90/100 dès que les Sprints 25-27 livreront Stripe + Yousign + DPA + handlers signés.                                                                                                                               |

---

## 7. Marquage V1 vs V2+

### V1 (avant 1ᵉʳ paiement encaissé)

- Reco #1-#5 (DPA + sous-processeurs + webhook Stripe/Yousign signés + allowedOrigins + URL validation).
- Reco #8, #9, #10, #11 (rate-limit checkout + magic-link factor + dispute handler + Stripe Radar).
- P0-1 à P0-7 doivent être 100 % résolus.

### V1.x / V2+

- Reco #6 (étendre gdpr-export aux nouveaux modèles, par sprint au fil de leur livraison).
- Reco #7, #12 (snapshot before/after + retention différentiée).
- P2-1 (CSP strict-dynamic global, dépend du passage `force-dynamic` global ou hash-based — Sprint 16 PERF en backlog).
- P2-2 (rate-limit TOTP step dédié — durcissement marginal).
- P2-3 (registrikood + TVA EE publics — décision Will).
- P2-4 / P2-5 (email throwaway + cap booking/email — anti-abus marginal).

### Hors scope ce prompt (cf. §1.2)

- Qualiopi, OPCO, PDP, Factur-X, structure juridique FR vs EE — bloc `[À REVISITER V2+]`.

---

## 8. Top 10 risques (sévérité décroissante)

| #   | Risque                                                                                                         | Sévérité    | Probabilité (V1 si non corrigé)        | Mitigation             |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------- | ---------------------- |
| 1   | **Webhook Stripe non signé** ⇒ état booking corrompu via POST spoofé (capture/refund frauduleux)               | 🚨 Critique | Élevée (endpoint public)               | Reco #2                |
| 2   | **Webhook Yousign non signé** ⇒ NDA marqué signé sans réelle signature                                         | 🚨 Critique | Moyenne                                | Reco #3                |
| 3   | **Sous-processeurs Stripe/Yousign non déclarés à la 1ʳᵉ transaction** ⇒ non-conformité art. 13.1.e + 28 RGPD   | 🚨 Critique | Certaine                               | Reco #1                |
| 4   | **Open redirect via success_url/cancel_url Stripe** ⇒ phishing post-paiement (client crédible)                 | 🚨 Critique | Moyenne                                | Reco #5                |
| 5   | **Server Actions sans `allowedOrigins` derrière proxy** ⇒ CSRF possible depuis sous-domaine ou origine spoofée | 🚨 Critique | Faible (Next 16 mitige partiellement)  | Reco #4                |
| 6   | **Magic link self-service (D19/D20) sans HMAC scopé** ⇒ accès booking tiers via fuite URL                      | ⚠️ Élevé    | Moyenne                                | Reco #9                |
| 7   | **`/api/gdpr-export` n'expose pas Payment/Invoice/Quote** ⇒ réclamation CNIL/AKI ouverte                       | ⚠️ Élevé    | Moyenne (1 réclamation/an typique)     | Reco #6                |
| 8   | **Pas de Refund auto + clauses CGV manuelles** ⇒ litige commercial + procédure tribunal EE                     | ⚠️ Moyen    | Élevée si volumes > 50/mois            | Reco custom Sprint 25  |
| 9   | **Stripe Radar OFF + pas de dispute handler** ⇒ taux fraude > 0,3 % ⇒ blocage compte Stripe                    | ⚠️ Moyen    | Faible (B2B)                           | Reco #10 + #11         |
| 10  | **CSP soft `unsafe-inline` SSG public** ⇒ XSS persistante sur copy (faible surface, pas d'UGC)                 | P2          | Très faible (pas d'input riche public) | Backlog Sprint 16 PERF |

---

## 9. Notes finales

- Aucune commande `git`/`pnpm`/POST n'a été exécutée pendant cet audit.
- Toutes les citations renvoient à des chemins relatifs `axionia/` lus sur HEAD `ff3ccbc`.
- L'analyse part du principe que **Stripe + Yousign seront effectivement livrés à V1** (cf. master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md`). Si Will arbitre l'ouverture commerciale avant Sprint 25 (deposit-gated), bloquer la prise de paiement live tant que P0-1/2/3/4/5/6/7 ne sont pas résolus.
- **Actions humaines à acter par Will / DPO** (non codables) : signature DPA Stripe (Dashboard Stripe → Settings → Data Processing Addendum, en ligne), signature DPA Yousign (papier ou portail Yousign), signature DPA Mailwizz (déjà actif), création boîte `dpo@axion-ia.com` si pas encore prête (mémoire `axionia_session_2026-05-09_sprint_24_1.md`), classification interne RGPD (DPIA si volume > 10 k bookings/an).
- Verdict synthétique : **GO conditionnel** à la livraison des Sprints 25-27 (Stripe + Yousign + DPA). Stack actuelle (auth, RBAC, CSP, retention, pii-redaction) **dépasse** ce qu'on attend d'un cabinet IA B2B premium. Le gap est purement métier (modèles manquants), pas culturel.
