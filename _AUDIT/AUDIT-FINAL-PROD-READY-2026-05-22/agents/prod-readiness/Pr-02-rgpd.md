# Pr-02 — RGPD

**HEAD** : 81f6ea0e
**Score** : 19 / 25

## Évidence

### Droit à l'effacement (Art. 17)

- `src/app/api/gdpr-erase/route.ts:1-123` endpoint POST self-service complet :
  - Token HMAC `gdpr-token.ts` + anti-replay `v.email !== email` (ligne 66-68)
  - Rate limit 1/jour/email (ligne 57)
  - Confirmation littérale `"ERASE_MY_DATA"` (ligne 40) anti-clic-accidentel
  - 3 effacements parallèles : `eraseSubmissionsForEmail` (anonymisation in-place audit conservé), `eraseNewsletterForEmail` (hard delete), `eraseKbDataForEmail` (bookmarks hard delete)
  - ActivityLog `gdpr.erase.completed` immuable Art. 30 (ligne 78-92)
  - Alerte Telegram DPO (ligne 96-99)
  - Notice utilisateur explicite retentions exceptions legal hold (ligne 113-119)
- Endpoint complémentaire `/api/gdpr-export` + `/api/gdpr-export/request` (token email-gated).

### IP Hashing SHA-256

- `src/lib/security/ip-hash.ts:33` `SHA-256(salt::ip)` tronqué 16 hex (64 bits entropie) via `IP_HASH_SALT` env var.
- Confirmé requis dans CI env (`ci.yml:112` IP_HASH_SALT dummy).

### Pages légales présentes et structurées

- `/rgpd` `src/app/[locale]/rgpd/page.tsx` ✅
- `/mentions-legales` `src/app/[locale]/mentions-legales/page.tsx` ✅
- `/politique-confidentialite` `src/app/[locale]/politique-confidentialite/page.tsx` ✅ (template `LegalPageTemplate` + JSON-LD breadcrumbs)
- `/conditions-generales` `src/app/[locale]/conditions-generales/page.tsx` ✅ (équivalent CGV — adapté offer service IA)
- `/transparence` `src/app/[locale]/transparence/page.tsx` ✅ (Sprint Perfection 2026 — hub AI Act / persona Manon / sous-processeurs IA)
- `/sous-processeurs` `src/app/[locale]/sous-processeurs/` ✅ (liste DPA)
- `/cookies` `src/app/[locale]/cookies/` ✅
- `/preferences-cookies` ✅ (page management consent)
- `/mes-donnees` ✅ + `/mes-ressources` ✅ (espace user RGPD self-service)
- Source contenus centralisée `src/content/legal.ts`.

### Cookies banner

- `src/components/analytics/CookieConsent.tsx` composant client CMP avec consent gating.
- CSP autorise Microsoft Clarity uniquement post-consent (`src/lib/csp.ts:76-82` commentaire explicite gating).

### Sentry PII scrubbing

- `src/sentry.server.config.ts:22-23` `sendDefaultPii: false` + `beforeSend: piiScrubBeforeSend` (`src/lib/observability/sentry-pii-scrub.ts`).
- Audit E2E 2026-05-11 P0-CONF-06 documenté (RGPD Art. 32).

### Registre traitements Art. 30

- ActivityLog Prisma table = registre forensique opérationnel par défaut (création login/auth/gdpr/admin actions). Pas de document Word/PDF dédié observé dans `_AUDIT/**/*REGISTRE*` (0 résultats).

### Exclusion Will (rappel, non comptabilisé en gap)

- DPA Anthropic : reporté (décision Will), non audité.

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (registre Art. 30 documentaire)** : pas de `registre-traitements.md` ou équivalent papier dans `_AUDIT/`. ActivityLog DB couvre techniquement mais l'autorité CNIL attend généralement un livrable narratif (PDF/Markdown) listant traitements + bases légales + DPO. Effort ~2-3h.
- **P1 (cookie banner test)** : composant `CookieConsent` présent mais conformité ePrivacy 2009/136/CE bandeau "Continuer sans accepter" non vérifiable sans inspection produit live. Action humaine Will reco.
- **P2 (politique-deplacement)** : page `/politique-deplacement` détectée — bon polish (territorial RGPD géolocalisation).
- **P2 (page /accessibilite)** présente (WCAG declaration).

## Verdict (paragraphe)

Implémentation RGPD techniquement très solide : endpoint Art. 17 self-service complet avec garde-fous (token HMAC, confirmation littérale, rate-limit 1/jour, audit log immuable, alerte DPO), 9 pages légales fonctionnelles incluant `/transparence` + `/sous-processeurs` (rare), IP hashées SHA-256 via salt env, Sentry PII scrubbing actif, bannière cookie + gating CSP Clarity. La principale lacune est l'absence d'un registre Art. 30 narratif livrable CNIL — ActivityLog DB couvre opérationnellement mais une CNIL audit attend généralement un document daté/signé DPO. À produire ~2-3h. Score 19/25 — production-ready, gap formel registre Art. 30 à clore.
