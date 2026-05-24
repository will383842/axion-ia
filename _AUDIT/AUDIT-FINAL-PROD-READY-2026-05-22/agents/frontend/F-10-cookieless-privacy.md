# F-10 Cookieless & privacy

## Score : 21/25 — 🟢

## Findings (preuves)

1. **Plausible Analytics self-hosted EU first-party** (`src/components/analytics/Plausible.tsx:16-41`) :
   - Default API `https://plausible.axion-ia.com` (l. 18)
   - `strategy="afterInteractive"` (l. 38) → n’impacte pas LCP
   - Script étendu : 404 + file-downloads + outbound-links + tagged-events + web-vitals
   - **Cookie-less** (avis CNIL 2022 sur analytics anonymisés)
   - No-op si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` absent

2. **PAS de Google Analytics** : grep `gtag|google-analytics|GA_TRACKING_ID` → zero match dans `src/components/analytics/`. ✅

3. **Microsoft Clarity gaté consent** (`src/components/analytics/CookieConsent.tsx` + Clarity.tsx) :
   - Banner sticky bottom (l. 22 doc) — refus = même hiérarchie que accept (doctrine CNIL)
   - `localStorage.axion-cookie-consent-v1` = accepted/declined + timestamp 13 mois CNIL (l. 31-32)
   - Clarity ne charge le script qu’après consent explicite (l. 12-13)
   - Plausible reste TOUJOURS actif (anonyme EU)

4. **RefererTracker** (`src/components/analytics/RefererTracker.tsx`) : tracking `document.referrer` (14 sources canoniques : google/bing/qwant/perplexity/chatgpt/claude…) pour mesurer AEO/GEO ROI. No-op si Plausible absent.

5. **Cookies fonctionnels minimaux** (`middleware.ts:30, 102-129`) :
   - `axion_ref_city` / `axion_ref_region` : 30j, SameSite=Lax, Secure, HttpOnly
   - `axion_utm` : 30j, attribution pSEO → conversion
   - **Pas de cookie publicitaire / tracking cross-site**

6. **IP hashing SHA-256 + IP_HASH_SALT** :
   - `IP_HASH_SALT` référencé dans `prisma/schema.prisma`, `.env.example`, `.env.ci.example`, `docs/ci/ENV-VARS.md`, `.github/workflows/ci.yml`, `scripts/image-bank/isolation-check.ts`
   - Workers : `retention-purge-worker.ts` (RGPD purge), `src/app/[locale]/galerie/[slug]/telecharger/route.ts` (download log) — IP hashées avant stockage ✅
   - Conforme image-bank skill (« RGPD : IP SHA-256 hashées via `IP_HASH_SALT` »)

7. **Droit à l’effacement RGPD** :
   - `/mes-donnees` + `/mes-donnees/export` (export RGPD)
   - `src/app/api/admin/articles/[id]/forget/route.ts` (oubli)
   - `src/server/actions/image-bank/forget-ip-hash.action.ts` + test (forget IP hash)
   - `src/components/admin/image-bank/ForgetIpHashForm.tsx`

8. **`/rgpd` page complète** (`src/app/[locale]/rgpd/page.tsx`) : utilise `LegalPageTemplate` + content `getLegal("rgpd")` + Breadcrumbs + JSON-LD. Page présente, à valider contenu copywriting Will (D7 société FR).

9. **Pages légales 100 % présentes** : `/cookies`, `/preferences-cookies`, `/sous-processeurs`, `/politique-confidentialite`, `/mentions-legales`, `/conditions-generales`, `/accessibilite`, `/desabonnement`, `/rgpd`, `/charte-editoriale`, `/corrections`, `/transparence`.

10. **CSP per-request avec nonce** (`src/proxy.ts:46-99` + `src/lib/csp.ts`) :
    - Mode strict pour `/admin/*`, mode soft public SSG
    - COEP credentialless (compromis isolation vs Plausible/Turnstile/fonts CDN)
    - X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin
    - Permissions-Policy minimaliste (camera, mic, geolocation, interest-cohort, etc. tous off)

11. **Persona Manon transparence AI Act** : `disambiguatingDescription`, `aiGenerated: true`, link `/equipe/manon` → page transparence persona.

## P0 bloquants prod

- **Aucun**.

## P1 importants

- Pages `/cookies` et `/preferences-cookies` existent — vérifier contenu copywriting RGPD-CNIL parfaitement aligné (audit AUDIT-ONLY ne lit pas le contenu MDX/templates ici).
- Banner CookieConsent stocke en `localStorage` — fonctionne même avec navigateur sans cookies tiers, mais une fuite via `<script>` analytics non gaté pourrait poser problème. Validation : Plausible cookie-less = OK CNIL ; Clarity gaté = OK.
- `IP_HASH_SALT` env var critique : si rotation jamais effectuée → reverse-lookup IP théorique. À documenter rotation policy.

## P2 polish

- `Clarity` est US (Microsoft) — DPA US-EU à valider quand env var Clarity ID set (memory mentionne DPA reporté).
- `Plausible self-hosted` : si hébergé chez Hetzner FR/DE → EU only, conforme. Vérifier que `plausible.axion-ia.com` pointe bien sur infra UE.
- Pas de bannière P3P/COPPA dédiée — non requis pour B2B FR.

## Verdict

Privacy stack first-party rigoureuse : Plausible self-hosted EU cookie-less + zero Google Analytics + Clarity gaté consent CNIL + cookies fonctionnels minimaux (UTM/referer pSEO) + IP hashing SHA-256 systémique image-bank + droit à l’effacement RGPD implémenté côté code + 12 pages légales présentes + CSP per-request avec nonce + Permissions-Policy minimaliste. Score 21/25 ; -4 pour rotation policy `IP_HASH_SALT` non documentée + audit content RGPD copy non vérifié texte par texte + DPA Clarity US (memory).

## Synthèse globale frontend

- F-01 routes pub : 22/25
- F-02 routes admin : 22/25
- F-03 mobile : 19/25
- F-04 a11y : 20/25
- F-05 perf : 20/25
- F-06 SEO/JSON-LD : 23/25
- F-07 maillage : 16/25 🔴 (catalog cassé)
- F-08 sitemaps : 24/25
- F-09 brand : 22/25
- F-10 privacy : 21/25
- **TOTAL : 209/250**
