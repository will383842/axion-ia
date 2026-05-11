# R-04 — AUTH-ADMIN CHAIN

## Diagramme ASCII

```
                  ┌──────────────────┐
                  │ ADMIN_URL_PREFIX │  env-driven, 16+ chars
                  │ (anti-énumération)│
                  └────────┬─────────┘
                           │ read by src/lib/admin-path.ts
                           ▼
              ┌─────────────────────────────┐
              │ src/app/[locale]/(admin)/   │  ← 36 admin routes
              │   [adminPrefix]/**          │      sous segment dynamique
              └────────────┬────────────────┘
                           │ matched by
                           ▼
              ┌─────────────────────────────┐
              │ src/auth.config.ts          │
              │ + src/auth.ts (NextAuth v5) │
              │ Credentials provider +      │
              │ Argon2id + TOTP 2FA         │
              └────────────┬────────────────┘
                           │ session JWT (60s revocation lag)
                           ▼
              ┌─────────────────────────────┐
              │ src/proxy.ts                │
              │ NextAuth(authConfig).auth() │
              │ + handleI18nRouting +       │
              │ buildCspHeader (STRICT)     │
              └────────────┬────────────────┘
                           ▼
              ┌─────────────────────────────┐
              │ Admin pages (force-dynamic) │
              │ require requireAdminRead()  │
              │ or requireSuperAdmin()      │
              │ ⚠️ DUPLIQUÉ 13× AGT-01 P1   │
              └─────────────────────────────┘

Leak check (sitemap / robots / llms / JSON-LD) :
  • robots.ts → admin prefix non listé ✅
  • sitemap-index → 0 URL admin ✅
  • llms.txt + llms-full.txt → ne référencent pas admin ✅
  • CSP STRICT confirmée live curl /fr/admin-xfz5hk0j7hrk/login (AGT-08 + AGT-04)
```

## Findings clés (AGT-08 + AGT-01)

1. **AGT-08 0 P0** sur l'admin. Posture solide : Argon2id OWASP 2024, 2FA TOTP RFC 6238, JWT revocation 60 s, rate-limit Redis.
2. **AGT-01 P1** `requireAdminRead()`/`requireSuperAdmin()` dupliqués dans **13 features admin** au lieu de centralisés dans `lib/admin-auth.ts` → risque drift sécu si une feature oublie la check.
3. **AGT-08 P1** Debug dump credentials (email + IP) `src/auth.ts:99-117` `[DEBUG TEMPORAIRE 2026-05-10]` toujours actif → risque leak Sentry breadcrumbs (et aggravé par PII scrub absent → AGT-14 P0).
4. **AGT-08** anti-énumération admin URL ≥ 16 chars OK ; CSP STRICT confirmée live sur préfixe valide ; CSP soft sur faux préfixe (anti-fingerprinting validé).
5. **AGT-04 + AGT-12 + AGT-08** : 0 leak admin sur sitemap/robots/llms.txt confirmé en lecture code + curl prod.

## Cohérence chaîne

✅ Anti-énumération URL effective (préfixe ENV ≥ 16 chars).
✅ Auth.js + 2FA + Argon2id : stack moderne OWASP 2024.
✅ CSP STRICT pour admin (nonce + strict-dynamic, no `unsafe-*`).
✅ Aucune route admin exposée dans surfaces publiques d'indexation.
⚠️ Duplication `requireAdminRead` dans 13 features → si Sprint suivant ajoute une 14e feature, oubli probable.
⚠️ Debug `auth.ts:99` à retirer avant prochaine release.
