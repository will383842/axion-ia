# 00 — REALITY CHECK (Phase 0)

**Date d'exécution** : 2026-05-11, 12:22 → 12:35 (~13 min wall-clock)
**Branche / HEAD** : `main` @ `b6d17adb60c685bd38eae6891e7b586380826d2e`
**Commit HEAD** : `b6d17ad fix(auth): handle Auth.js v5 string-literal "undefined" serialization`
**Working dir** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`

## 1. Pré-flight

| Outil | Version                    | OK                     |
| ----- | -------------------------- | ---------------------- |
| Node  | v24.12.0                   | ✅ (≥ 20.18.0 engines) |
| pnpm  | 10.33.4                    | ✅                     |
| git   | 2.52.0.windows.1           | ✅                     |
| curl  | 8.17.0 (Schannel + brotli) | ✅                     |

Scripts `pnpm` exigés par le prompt vs `package.json` :

| Script demandé           | Présent | Notes                                              |
| ------------------------ | ------- | -------------------------------------------------- |
| `typecheck`              | ✅      | `tsc --noEmit`                                     |
| `lint`                   | ✅      | `eslint`                                           |
| `test`                   | ✅      | `vitest run`                                       |
| `test:integration`       | ✅      | DB requise — skip                                  |
| `test:e2e`               | ✅      | Playwright — skip si DB                            |
| `lhci`                   | ✅      | `lhci collect`                                     |
| `i18n:check`             | ✅      | 224 keys OK                                        |
| `anti-hex:check`         | ✅      | `bash scripts/check-anti-hex.sh`                   |
| `villes:import`          | ✅      | ⛔ ne pas lancer (réécrit la table villes)         |
| `seo:audit`              | ✅      | à inspecter avant lancement                        |
| `test:e2e:cross-browser` | ✅      | utilise firefox+webkit — non lancé (CHROMIUM ONLY) |

## 2. Git state

```
branche : main
HEAD : b6d17adb60c685bd38eae6891e7b586380826d2e
écart origin/main vs HEAD : 0 / 0  (sync)
tags récents : (aucun tag)
staged : 0
unstaged : 0
untracked (filtre _AUDIT/) :
  ?? _AUDIT/PLAN-ACTION-POST-DEPLOY-V2.md
  ?? _AUDIT/PLAN-CLOUDFLARE-PHASE-5.md
  ?? _AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md
  ?? _AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md
  ?? _AUDIT/PROMPT-PROD-SIGNOFF-COMPLEMENTAIRE-2026.md
```

→ État propre. Aucun fichier source modifié non commité. Les 5 untracked sont les prompts d'audit récents.

## 3. Build sanity

### Typecheck — ✅ EXIT 0

`pnpm typecheck` (`tsc --noEmit`) — aucune erreur de type.

### Lint — ✅ EXIT 0 (22 warnings, 0 errors)

Catégories de warnings :

- **13× `no-console`** : scripts CLI (`indexnow-ping.ts`, `test-email-e2e.ts`) et workers BullMQ (`worker.ts`, `email-worker.ts`, `option-expiration-worker.ts`, `option-reminder-worker.ts`, `retention-purge-worker.ts`). Acceptable — usages backend bornés.
- **5× `react-hooks/incompatible-library`** : React Compiler skippe la mémoïsation pour `AuditForm.tsx`, `BookingForm.tsx`, `ContactForm.tsx`, `ImplementationForm.tsx`, `NewsletterForm.tsx` à cause de `useForm().watch()` non-mémoïsable. Conséquence : pas de re-render élevé constaté en tests mais à flagger côté perf (AGT-03).

### Tests vitest — ✅ EXIT 0

`pnpm test` : **127/127 tests passed**, 19 files, 24.5 s. (Discrepancy avec mémoire `axionia_session_2026-05-09_sprint_24_1` qui notait 118→127 ; concordant.)

### Pas exécuté en Phase 0 (effet de bord)

- `pnpm test:integration` — DB requise, skippé.
- `pnpm test:e2e` — Playwright requiert serveur, skippé jusqu'à Phase 4.
- `pnpm build` — postbuild IndexNow + Sentry release, déclenchera Phase 4 P-06 avec env vars `INDEXNOW_DISABLED=true` + `SENTRY_DISABLE_AUTO_UPLOAD=true`.

## 4. Inventaire racine (counts)

| Dossier                     | Count fichiers TS/TSX                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| `src/`                      | **392**                                                                         |
| `src/app` (pages)           | 112 `page.tsx`                                                                  |
| `src/app/api` (routes API)  | 16 `route.ts` (10 unique endpoints)                                             |
| `src/components`            | 115                                                                             |
| `src/lib`                   | 42                                                                              |
| `src/server`                | 8                                                                               |
| `prisma/migrations`         | 3 + `migration_lock.toml`                                                       |
| `prisma/schema.prisma`      | 22 modèles, 706 lignes                                                          |
| `src/messages/{fr,en}.json` | 243 lignes chacun, 224 keys                                                     |
| `public/`                   | 19 KB total (file.svg, globe.svg, next.svg, vercel.svg, window.svg, press-kit/) |
| `tests/e2e`                 | 9 specs                                                                         |
| `tests/integration`         | 1 spec                                                                          |
| `tests/schemas`             | 3 specs                                                                         |
| `scripts/`                  | 20 fichiers (`.ts` + `.sh`)                                                     |
| `'use client'` directives   | 0 grep direct → cf. note ci-dessous                                             |

Note `'use client'` : le grep direct retourne 0 car la doctrine V14 utilise des composants RSC par défaut et islands Client minimaux. Les composants forms sont les principaux `'use client'` — l'absence de grep réussi indique soit un fichier-level grep limité par Windows, soit que la directive est posée différemment. À approfondir dans AGT-01.

## 5. Routes — vue brute

- **App Router** : `src/app/[locale]/(public)/**`, `src/app/[locale]/(admin)/[adminPrefix]/**`, `src/app/api/**`.
- Layout admin masqué via paramètre dynamique `[adminPrefix]` (anti-énumération) — cf. `src/lib/seo` + `ADMIN_URL_PREFIX` env.
- **API routes** : `auth/[...nextauth]`, `admin/newsletter/export`, `admin/submissions/export`, `gdpr-export`, `gdpr-export/request`, `healthz`, `indexnow`, `indexnow/key`, `unsubscribe`, `vitals`.
- **Routes spéciales** : `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, `apple-icon.tsx`, `icon.tsx`, `llms.txt`, `llms-full.txt` — à confirmer dans AGT-04/AGT-12.

## 6. Doctrine snapshots

| Intouchable      | Valeur réelle                                            | Source                                                                | Statut                                                                                        |
| ---------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Header couleur   | `--color-terracotta: #c24a1b`                            | `src/app/globals.css:35`                                              | ✅                                                                                            |
| Hero cap         | `88px` cap modular scale                                 | `src/app/globals.css` (1 grep hit)                                    | ✅ (présent)                                                                                  |
| Hero schema dim  | `576×576 lg+`, viewBox `560×560`, lock 36rem             | `src/app/globals.css:266,270,275,283,499`                             | ✅                                                                                            |
| Pricing SSOT     | `src/content/pricing.ts` documenté Sprint 14.10.2        | `src/content/pricing.ts:1-20`                                         | ✅                                                                                            |
| CSP nonce        | nonce-based via `src/proxy.ts:30-35` + `src/lib/csp.ts`  | `src/proxy.ts:30`                                                     | ✅ MAIS soft mode public + strict admin (assumed)                                             |
| CSP soft public  | `'unsafe-inline'` + `'unsafe-eval'` script-src en public | header `/`, `/fr/reserver`, `/fr/audit`                               | ⚠️ trade-off documenté csp.ts ; flag à creuser AGT-08                                         |
| Naming i18n      | `cabinet` 0 hit fr.json, `consultancy` 3 hits en.json    | grep `src/messages/fr.json`                                           | ⚠️ FR ne contient pas le mot mais c'est en code/content (`src/content/`) — à confirmer AGT-15 |
| ADMIN URL prefix | `ADMIN_URL_PREFIX` env + dynamic route `[adminPrefix]`   | `.env.example:21`, `src/app/[locale]/(admin)/[adminPrefix]`           | ✅                                                                                            |
| Email provider   | Nodemailer + PowerMTA + MailWizz (Resend INTERDIT)       | `.env.example:32`, `package.json` (nodemailer present, resend absent) | ✅                                                                                            |

→ **Drift detection** : aucun drift sur les intouchables § 0.1 du prompt. Le prompt mentionne « email Resend » dans son § 3.3/5/R-05 ; c'est une **erreur du prompt** (Resend est interdit selon `.env.example:32`). Le code utilise Nodemailer + PowerMTA. **Pas un drift code/doctrine, mais une incohérence dans le prompt** — à mentionner en synthèse.

## 7. Prod check rapide

| URL                                       | Status                          | Notes                                                                                                                                     |
| ----------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `https://axion-ia.com/`                   | 307 → `/fr`                     | redirige sur la locale par défaut, cookies Auth.js posés, CSP soft + COOP/COEP `credentialless`, HSTS preload, `cf-cache-status: DYNAMIC` |
| `https://axion-ia.com/api/healthz`        | 200                             | `{"status":"ok","db":"ok","redis":"ok","version":"0.1.0","timestamp":"2026-05-11T12:22:39.291Z"}`                                         |
| `https://axion-ia.com/sitemap.xml`        | **404** (text/html)             | ⚠️ **BUG PRÉ-EXISTANT confirmé** — mémoire `axionia_bugs_seo_preexistants_2026-05-09`                                                     |
| `https://axion-ia.com/sitemap-index.xml`  | 200 application/xml             | ✅                                                                                                                                        |
| `https://axion-ia.com/sitemap-static.xml` | 404 (text/html)                 | ⚠️ — sitemap-static absent (split sitemap-index ?)                                                                                        |
| `https://axion-ia.com/llms.txt`           | 200 text/plain                  | ✅                                                                                                                                        |
| `https://axion-ia.com/robots.txt`         | 200 + Cloudflare Content-Signal | ✅ — `User-agent: *` `Allow: /` + Amazonbot/Applebot-Extended/Bytespider Disallow                                                         |
| `https://axion-ia.com/fr/`                | 308 → `/fr`                     | redirige sans slash (next-intl `pathnames`)                                                                                               |
| `https://axion-ia.com/en/`                | 308 → `/en`                     | idem                                                                                                                                      |

### Headers sécurité observés (page `/`)

- ✅ `strict-transport-security: max-age=31536000; includeSubDomains; preload`
- ✅ `permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=()...`
- ✅ `referrer-policy: strict-origin-when-cross-origin`
- ✅ `x-frame-options: DENY` + `frame-ancestors 'none'` (CSP)
- ✅ `x-content-type-options: nosniff`
- ✅ `cross-origin-opener-policy: same-origin`
- ✅ `cross-origin-resource-policy: same-origin`
- ✅ `cross-origin-embedder-policy: credentialless` (downgrade documenté Sprint 16 PERF, cf. proxy.ts:43-50)
- ⚠️ CSP soft public : `script-src 'self' 'unsafe-inline' 'unsafe-eval' …` → trade-off doctrine § 0.1 vs csp.ts:7-13 explicitant Sprint 16 PERF parking. **Pas un drift caché**.
- ✅ `cf-cache-status: DYNAMIC` sur `/` (correct car redirect 307 dépend de cookies/Accept-Language)
- ✅ HSTS `max-age=31536000 + preload` (1 an, prompt § 0.1 demande 12 mois — équivalent)

### Note HSTS `next.config.ts` vs runtime

- `next.config.ts` déclare HSTS `max-age=63072000` (2 ans).
- Header observé : `max-age=31536000` (1 an).
- Probable : valeur posée par Cloudflare (12 mois preload UI Phase 5). Override CF prime sur header origin. **À documenter**.

## 8. Drift detection finale

🟢 **Aucun drift bloquant** sur les intouchables § 0.1 :

- Naming Axion-IA partout (à reconfirmer agent CONTENT-CRO).
- Couleurs `#c24a1b` terracotta header preserved.
- Typo : hero cap 88px présent.
- Hero schema 576×576 / 560×560 viewBox respecté.
- Pricing SSOT respecté.
- pSEO villes : `/fr/implantations/<region>/<ville>` — à confirmer Phase 1 ROUTES.

⚠️ **Flags à suivre dans Phases suivantes** :

1. CSP soft `unsafe-inline`/`unsafe-eval` (P1, trade-off documenté).
2. `/sitemap.xml` 404 vs `/sitemap-index.xml` 200 (P0 SEO — référencé memory).
3. HSTS max-age divergent next.config vs runtime (P2 cohérence).
4. React Compiler skipped sur 5 forms (P2 perf).
5. Prompt mentionne Resend (erreur prompt, pas code).

## 9. MANIFEST.md mis à jour

✅ `_AUDIT/E2E-2026-05-09/MANIFEST.md` initialisé.

---

**Phase 0 → DONE. Pas de stop. Phase 1 lancée immédiatement.**
