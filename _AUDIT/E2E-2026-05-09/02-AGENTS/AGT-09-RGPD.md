# AGT-09 — RGPD

**Périmètre** : sous-processeurs (Backblaze retiré ?), bannière cookies, mentions légales, GDPR export, retention purge cron, PII Telegram redaction, DPA register, double opt-in, DMA/DSA, `/api/unsubscribe`, `/mes-donnees`, `/preferences-cookies`, `/rgpd`, `/politique-confidentialite`.

**Mode** : AUDIT-ONLY. Lecture seule sur le code, écriture restreinte à ce fichier.

**Pondération master** : ×1.5 (Sécurité/RGPD critique).

**Date** : 2026-05-11.

---

## Score : **84 / 100**

Détail composantes (chacune `/100`, moyenne pondérée 1×) :

| Composante                               | Note | Commentaire bref                                                                                                                                                |
| ---------------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Bannière cookies / consent            |   95 | Volontairement absente — défendable (Plausible self-hosted sans cookie + CNIL 2022). P2 : justification dans copy.                                              |
| 2. Cookie storage (NEXT_LOCALE, session) |   80 | Aucun `cookies().set()` dans `src/` → délégué `next-intl` + Auth.js défauts. Pas d'audit explicite SameSite/Secure.                                             |
| 3. Analytics conditionnel (Plausible)    |   95 | Chargé inconditionnellement mais sans cookie → conforme. `afterInteractive` OK perf.                                                                            |
| 4. Mentions légales (OÜ estonienne)      |   80 | Forme/siège/hébergeur OK. `registrikood` + `EU VAT` toujours « sur demande » → P1 (B2B EU).                                                                     |
| 5. Politique confidentialité             |   90 | Couverture complète RGPD art. 13/14. Sentry non mentionné comme destinataire technique → P2.                                                                    |
| 6. Sous-processeurs liste                |   92 | Backblaze **retiré** ✅. 3 sous-processeurs déclarés (Hetzner, CF, Telegram). Manque Sentry self-hosted en clair.                                               |
| 7. GDPR export endpoint                  |   55 | API solide HMAC+rate-limit, **mais page front `/mes-donnees/export` MANQUANTE** → lien email = 404. P0.                                                         |
| 8. Retention purge cron                  |   92 | Worker BullMQ + cron 03:00 UTC OK. 4 tables purgées avec hash audit trail. P2 : pas de dry-run/metrics.                                                         |
| 9. PII Telegram redaction                |   88 | ADR 0010 appliqué : helpers + 4 features publiques (contact, booking, audit, implementation, newsletter, opt-exp). Admin laisse `companyName` clair = doctrine. |
| 10. Double opt-in newsletter             |   90 | Pending → confirm token → confirmed. Token unique, idempotent, traçabilité.                                                                                     |
| 11. Désabonnement RFC 8058               |   95 | One-Click POST + form + headers `List-Unsubscribe` + `List-Unsubscribe-Post` (Sprint 24+).                                                                      |
| 12. DSA/DMA Europe                       |   70 | Hors seuil VLOSE/VLOP → aucune obligation transparency. Mais pas de page « transparency report » volontaire.                                                    |
| 13. /preferences-cookies revoke          |   60 | Page de **copy uniquement**, aucun bouton revoke (no-op puisque pas de tracker à révoquer). Trompeur pour user.                                                 |
| 14. /mes-donnees self-service            |   60 | Page exposée mais zéro formulaire / lien direct vers `/api/gdpr-export/request`. Renvoie email statique.                                                        |
| 15. DPA register vs code                 |   90 | Registre à jour, 3 sous-traitants UE-conformes. ⚠️ 2 lignes 🟡 « à signer » non datées (Hetzner + Cloudflare).                                                  |

> Composantes pondérées `(95+80+95+80+90+92+55+92+88+90+95+70+60+60+90)/15 ≈ 82.1`. Bonus +2 (Sprint 24/24.1 livrés, P0-RGPD-3 List-Unsubscribe fermé). **84/100**.

## Confiance : **haute**

- Code lu en intégralité sur le périmètre annoncé (15 chapitres).
- Citations `path:line` systématiques.
- Aucune affirmation sur l'état runtime prod (HEAD-only audit) — laissé aux phases 4.
- `[INCONNU]` flaggés en bas de rapport.

---

## Top findings

### P0 (bloquant prod / sécu / RGPD)

| ID        | Titre                                                                               | Citation                                                                                                                                                  | Effort   |
| --------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **P0-R1** | **Lien email GDPR export pointe vers une page inexistante** (`/mes-donnees/export`) | `src/app/api/gdpr-export/request/route.ts:48` ; aucune route `mes-donnees/export` ni `my-data/export` dans `src/app/[locale]/` (cf. `Glob` exhaustif §1). | 2–4 h    |
| **P0-R2** | **DPA Hetzner + DPA Cloudflare non signés** (statut « 🟡 à signer/accepter »)       | `_AUDIT/DPA-REGISTER.md:18-19` + `_AUDIT/DPA-REGISTER.md:45` + `_AUDIT/CHECKLIST-CUTOVER.md:15-22`                                                        | 1 h Will |

### P1 (sérieux non bloquant ; à fixer < 2 semaines)

| ID        | Titre                                                                                                                                                                                                 | Citation                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **P1-R1** | `registrikood` (numéro RCS estonien) + `EU VAT` toujours « communiqués sur demande »                                                                                                                  | `src/content/legal.ts:44`, `src/content/legal.ts:77`                               |
| **P1-R2** | `/preferences-cookies` : pas de UI granulaire (toggle analytics/marketing) — copy uniquement, trompeur                                                                                                | `src/app/[locale]/preferences-cookies/page.tsx:64-87`                              |
| **P1-R3** | `/mes-donnees` n'a pas de formulaire one-click POST → `/api/gdpr-export/request` ; renvoie à un email statique                                                                                        | `src/app/[locale]/mes-donnees/page.tsx:91-99` vs `/api/gdpr-export/request`        |
| **P1-R4** | Sentry self-hosted absent de la liste sous-processeurs `legal.ts` § politique-confidentialite                                                                                                         | `src/content/legal.ts:229-230` (FR), `:273-275` (EN) + `_AUDIT/DPA-REGISTER.md:21` |
| **P1-R5** | `/politique-confidentialite` § Hébergement claim « Aucun transfert hors UE sauf consentement » mais Cloudflare US et Telegram UAE listés en sous-processeurs juste en-dessous → contradiction lisible | `src/content/legal.ts:225-230`                                                     |
| **P1-R6** | Sentry server config sans `beforeSend` PII scrubber (URLs avec query params PII, stack trace user data)                                                                                               | `src/sentry.server.config.ts:1-12` (aucune option scrub)                           |
| **P1-R7** | `consentVersion` / `consentText` absents de `prisma.Submission` → preuve d'opt-in ne référence pas le texte affiché                                                                                   | `prisma/schema.prisma:Submission` (cf. `Grep consentVersion → 0 matches`)          |

### P2 (confort / polish)

| ID        | Titre                                                                                                                                              | Citation                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **P2-R1** | Retention purge worker : pas de métriques exportées ni dry-run env var → silent quotidien                                                          | `src/server/queue/workers/retention-purge-worker.ts:137-140` (un seul `console.log`) |
| **P2-R2** | `preferences-cookies/page.tsx:72` mentionne « Si vous activez explicitement notre analytics » alors qu'il est actif par défaut → copy à actualiser | `src/app/[locale]/preferences-cookies/page.tsx:70-73`                                |
| **P2-R3** | DSA art. 24 (« transparency report » volontaire petit acteur) absent — pas obligatoire mais signal de maturité                                     | aucun fichier `_AUDIT/transparency-report-*` ni `/transparency` page                 |
| **P2-R4** | `/cookies` ne mentionne pas la liste des cookies déposés par Auth.js (admin) ni le nom du cookie de session                                        | `src/content/legal.ts:289-345`                                                       |
| **P2-R5** | Pas de mention du DPO email dans `/mentions-legales` (présent uniquement dans `/politique-confidentialite`)                                        | `src/content/legal.ts:41-67`                                                         |

---

## Détail par sous-chapitre

### 1. Bannière cookies — composant, consent storage, granularité

**Constat** : **Aucun composant de bandeau cookies n'existe**.

- `Glob src/components/**/cookie*.tsx` → 0 fichier.
- `Glob src/components/**/Cookie*.tsx` → 0 fichier.
- `Glob src/components/**/consent*.tsx` → 0 fichier.
- `Grep CookieBanner|ConsentBanner|CookieConsent` dans `src/` → 0 occurrence (seul match : `_AUDIT/agent-2-cls-fonts.md` — doc).

**Doctrine défendable** :

- `src/content/legal.ts:295-300` (FR) + `:323-328` (EN) → "Cookies strictement nécessaires" (session admin + lang 12 mois) + Plausible self-hosted sans cookie ni empreinte.
- `src/components/analytics/Plausible.tsx:1-6` commentaire : « GDPR-compliant sans cookies (CNIL OK sans bandeau consentement) ».
- CNIL délibération SAN-2022-006 et avis 2022 confirment qu'un analytics sans cookie ni fingerprinting, sans transfert hors UE, n'exige pas de consentement.

**Risque** : si un nouveau script tiers est ajouté plus tard (Stripe, Resend pixel, Sentry Replay…), il faudra introduire un bandeau **avant** son activation. Le code n'a pas d'« anti-régression » qui empêcherait l'ajout silencieux.

**Verdict** : **OK V1**, P2 recommandation « copy plus claire sur pourquoi l'absence de bandeau ».

### 2. Cookie storage — nom, durée, SameSite, Secure, HttpOnly

**Constat** :

- `Grep cookies\(\)|cookie.set|cookie.get` dans `src/` → 0 occurrence.
- Aucune lecture/écriture directe de cookie par le code applicatif.
- Cookies effectivement déposés : `NEXT_LOCALE` (next-intl default), `authjs.session-token` / `next-auth.session-token` (Auth.js).

**Audit attributs** :

- next-intl : `NEXT_LOCALE` selon `i18n/routing.ts` (cookie d'1 an, non-HttpOnly volontairement, SameSite=Lax par défaut).
- Auth.js v5 défauts : `Secure` en prod, `HttpOnly=true`, `SameSite=Lax`. **Non vérifié runtime** (laissé à phase 4 P-01 Headers).

**Verdict** : OK pour V1 ; phase 4 doit confirmer les attributs Set-Cookie réels en prod via curl.

### 3. Analytics conditionnel

`src/components/analytics/Plausible.tsx:21-28` :

```tsx
return (
  <Script
    defer
    data-domain={domain}
    src={`${apiUrl}/js/script.outbound-links.js`}
    strategy="afterInteractive"
  />
);
```

Chargé inconditionnellement dans `src/app/[locale]/layout.tsx:158`. **Aucune logique consent gate** car défense doctrinale « pas de PII, pas de cookie ».

**Verdict** : conforme. Si Plausible bascule vers `script.outbound-links.tagged-events.js` (collecte custom events), revoir l'analyse (mais aucun event PII actuel dans `trackEvent()` — `:34-45`).

### 4. Mentions légales (OÜ estonienne)

`src/content/legal.ts:31-102` (page `/mentions-legales` FR + `/legal-notice` EN).

Présent ✅ :

- Raison sociale : « Axion-IA OÜ · société à responsabilité limitée de droit estonien (Eesti) » (`:44`).
- Siège : Tallinn (`:44`).
- Hébergeur complet (`:51-52`).
- Directeur de publication : Will (gérant) (`:48`).
- Loi applicable estonienne (`:60`).

Manquant ❌ :

- `registrikood` : « communiqué sur demande » (`:44`). Donnée publique sur `ariregister.rik.ee` → **P1-R1**.
- `EU VAT` / TVA EE : idem (`:44`).
- DPO email pas en clair sur la page (présent sur `politique-confidentialite` `:202`) → **P2-R5**.

### 5. Politique confidentialité

`src/content/legal.ts:191-282`. Couvre RGPD art. 13/14 :

| Section RGPD                  | Présent                   | Citation |
| ----------------------------- | ------------------------- | -------- |
| Responsable du traitement     | ✅                        | `:202`   |
| Données collectées            | ✅                        | `:206`   |
| Finalités                     | ✅                        | `:210`   |
| Base légale (6.1.a/b/f)       | ✅                        | `:214`   |
| Durées (5 ans / 3 ans / 12 m) | ✅                        | `:218`   |
| Vos droits (6 droits)         | ✅                        | `:222`   |
| Hébergement & transferts      | ✅ (contradictoire P1-R5) | `:226`   |
| Sous-processeurs              | ✅                        | `:230`   |

**Manque** : Sentry self-hosted (destinataire technique des erreurs) listé en DPA register `_AUDIT/DPA-REGISTER.md:21` mais **absent** de la copy légale `:206` (où "métadonnées techniques" est trop vague). → **P1-R4**.

**Contradiction** `:226` vs `:230` : « Aucun transfert hors UE sauf consentement explicite » contredit immédiatement par Cloudflare Inc. US et Telegram FZ-LLC UAE listés juste après. Le texte mentionne SCC + EU-US DPF pour CF et art. 49 + minimisation pour Telegram, mais le claim initial n'est pas amendé → **P1-R5**.

### 6. Sous-processeurs liste

**Liste effective dans `src/content/legal.ts:230` (FR) + `:275` (EN)** :

1. Hetzner Online GmbH (DE) — hébergement VPS + Storage Box, DPA signé (à confirmer), ISO 27001.
2. Cloudflare, Inc. (US) — CDN + DDoS + Turnstile, SCC + EU-US DPF.
3. Telegram FZ-LLC (UAE) — notifs admin, minimisation PII (ADR 0010).

**Backblaze** : `Grep Backblaze|backblaze|B2_` :

- Aucun match dans `src/` (`Grep src` → no matches).
- `.env.example:49` : commentaire négatif « Source unique de stockage — pas d'AWS/Backblaze/Wasabi » → mention de retrait OK.
- `_AUDIT/DPA-REGISTER.md:25-27` explicite : « **Backblaze N'EST PAS utilisé** ».

**Verdict** : ✅ Backblaze effectivement retiré du code et du copy légal.

**Manque DPA register vs code** :

- Sentry self-hosted (Hetzner) listé `_AUDIT/DPA-REGISTER.md:21` ✅
- Plausible self-hosted (Hetzner) listé `_AUDIT/DPA-REGISTER.md:22` ✅
- Uptime Kuma self-hosted (Hetzner) listé `_AUDIT/DPA-REGISTER.md:23` ✅
- PowerMTA + MailWizz (relai email local Hetzner) : **non listés** dans DPA register ni dans `legal.ts`. Ce sont des destinataires techniques internes (sous-traitance interne), mais leur omission rend la liste légèrement incomplète vis-à-vis de l'art. 13.1.e. P2 (à clarifier).

### 7. GDPR export endpoint

**Stack** :

- `POST /api/gdpr-export/request` (`src/app/api/gdpr-export/request/route.ts:24-56`) — body `{email, locale}`, rate-limit 3/jour/email (`:37-40`), réponse 200 systématique anti-énumération (`:42-44`), signe token HMAC-SHA256 24h (`:46`), enqueue email lien (`:50-53`).
- `POST /api/gdpr-export` (`src/app/api/gdpr-export/route.ts:27-123`) — body `{email, token}`, verify HMAC (`:46-52`), rate-limit 3/jour (`:41-43`), retourne `submissions` + `newsletter` + bookings nested (`:54-99`), trace `activityLog action='gdpr.export.delivered'` (`:101-114`).
- Token : `src/lib/gdpr-token.ts` — HMAC-SHA256 Web Crypto, 24h TTL, `jti` aléatoire 12 bytes (`:65-79`).

**Architecture** : ✅ excellente (signature défensive, rate-limit, audit trail, anti-énumération).

**🚨 P0-R1** : le lien envoyé par email (`request/route.ts:48`) :

```ts
const exportUrl = `${baseUrl}/${locale}/${locale === "fr" ? "mes-donnees" : "my-data"}/export?token=...&email=...`;
```

→ pointe vers `/{fr,en}/{mes-donnees,my-data}/export`.

**Cette page n'existe pas** :

- `Glob src/app/[locale]/mes-donnees/**/*` → seul `page.tsx` racine.
- `Glob src/app/[locale]/**/my-data/**/*` → 0.
- `Glob src/app/[locale]/**/export/**/*` → 0.
- `Grep mes-donnees/export|my-data/export` dans `src/` → seule occurrence = le `route.ts:48` qui génère l'URL.
- `src/i18n/routing.ts:134` : `"/mes-donnees": { fr: "/mes-donnees", en: "/my-data" }` (la racine, pas le sous-segment `/export`).

**Conséquence** : un user qui demande son export reçoit un email avec un lien menant à un **404**. La fonctionnalité self-service est **cassée bout-en-bout** malgré une API serveur exemplaire. → P0 bloquant.

### 8. Retention purge cron

`src/server/queue/workers/retention-purge-worker.ts:54-151` + planification `src/server/queue/queues.ts:109-119`.

- Cron : `0 3 * * *` (03:00 UTC quotidien) (`queues.ts:118`).
- 4 cibles avec env vars override (`worker.ts:38-44`) :
  - `activity_logs` `createdAt < N mois` (default 12, `:25,61-65`)
  - `submissions` `status='archived' AND updatedAt < N mois` (default 24, `:68-96`) — soft via détachement bookings.
  - `newsletter_subscribers` `status='unsubscribed' AND unsubscribedAt < N mois` (default 36, `:99-125`) — conserve audit `emailHash` SHA-256 (`:117`).
  - `bookings` `status='cancelled' AND updatedAt < N mois` (default 12, `:128-135`).
- Sécurité anti-misconfig : `parsed < 1` → fallback (`:42`).
- Trace : `console.log` final (`:137-140`).

**P2-R1** : pas de métriques `prom-client` exportées, pas d'env var `RETENTION_DRY_RUN=true` pour tester sans supprimer, et pas de notification Telegram en fin de job (le log reste dans Coolify/Sentry uniquement).

**Verdict** : ✅ implémentation correcte et défensive ; polish recommandé.

### 9. PII Telegram redaction

`src/lib/pii-redaction.ts:1-67`. ADR 0010 acté.

**Patterns** :

- `redactEmail` : `j****@acme.com` (`:22-29`).
- `redactName` : `J. D.` initiales (`:31-36`).
- `redactPhone` : préserve indicatif + 4 derniers (`:38-55`).
- `redactContactLine` : compose `J. D. (j****@acme.com)` (`:61-66`).

**Call-sites public-facing** (PII utilisateurs externes) :

1. `src/features/newsletter/actions.ts:85` — opt-in pending (`redactEmail`).
2. `src/features/newsletter/actions.ts:153` — opt-in confirm.
3. `src/features/newsletter/actions.ts:207` — unsubscribe.
4. `src/features/contact/actions.ts:65` — message contact (`redactContactLine`).
5. `src/features/audit/actions.ts:74` — audit (5-step).
6. `src/features/audit/actions.ts:156` — audit-request (6-step).
7. `src/features/booking/actions.ts:131` — booking ferme.
8. `src/features/booking/actions.ts:240` — option 48h.
9. `src/features/implementation/actions.ts:67` — implementation.
10. `src/server/queue/workers/option-expiration-worker.ts:108` — expiration auto (`redactName`).

→ **10 sites publics couverts** (les 14 mentionnés en mémoire incluent les 4 admin call-sites où l'admin garde le clair).

**Call-sites admin (PII clair acceptée par doctrine ADR 0010 — l'admin a légitimité)** : 11. `src/features/admin-calendar/actions.ts:311` — annulation booking (pas de PII contact dans le body, juste ID + date). 12. `src/features/admin-options/actions.ts:214` — option confirmée (body cite `companyName` clair = pas PII personnel direct). 13. `src/features/admin-options/actions.ts:324` — option refusée (idem).

**Helpers ops** : 14. `src/lib/telegram.ts:43` `sendTelegram` (générique).

**Verdict** : ✅ couverture complète conforme à la doctrine. 0 leak email/téléphone/nom complet vers Telegram FZ-LLC UAE.

**Test coverage** : `src/lib/pii-redaction.test.ts` (4 describe blocks) — cas nominaux + edge cases (null, monoglobe, sans `@`). ✅

### 10. Double opt-in newsletter

`src/features/newsletter/actions.ts:25-103` `subscribeNewsletterAction` :

- Rate-limit 3/5min/IP (`:33-36`).
- Honeypot champ `website` (`:40`).
- Turnstile (`:43-45`).
- Zod schema avec `consent: z.literal(true)` (`:48-52` + `src/lib/schemas/forms.ts:22`).
- Upsert avec `status='pending'`, génère `confirmToken` 64 hex + `unsubscribeToken` 64 hex (`:58-79`).
- Enqueue `newsletter-confirm-optin` avec `marketing: true` (`:92-101`).

`confirmNewsletterAction` (`:118-171`) :

- Token min 16 chars (`:119`).
- Find unique sur `confirmToken` (`:123-125`).
- Idempotent : `alreadyConfirmed=true` si déjà (`:135-142`).
- Update : status, confirmedAt, `confirmToken: null` (un usage) (`:143-150`).
- Audit Telegram (`:151-155`).
- Error log explicite (`:163-169`) — fix audit 2026-05-10.

**Verdict** : ✅ exemplaire. Cf. P1 RGPD-7 sur `consentVersion`.

### 11. Désabonnement RFC 8058

`src/app/api/unsubscribe/route.ts:1-76` :

- POST avec body `application/x-www-form-urlencoded` (form HTML `:60-62`) ou query (One-Click `:53-54`).
- POST One-Click : header `List-Unsubscribe-Post: List-Unsubscribe=One-Click` géré (token alors dans URL).
- GET fallback (`:72-76`).
- 303 redirect vers `/{locale}/{desabonnement,unsubscribe}?status=ok|fail&...` (`:32-46`).

`unsubscribeNewsletterAction` (`src/features/newsletter/actions.ts:186-214`) :

- Token min 16 chars (`:187`).
- Find unique sur `unsubscribeToken` (`:191-193`).
- Idempotent (`:195-197`).
- Update : `status='unsubscribed'`, `unsubscribedAt`. **Token conservé** pour audit + idempotency (commentaire `:178-181`) = preuve de retrait RGPD art. 7.3.
- Telegram (`:205-209`).

**Headers email** : `src/lib/email/client.ts:75-83` + `src/server/queue/workers/email-worker.ts:21-38` :

```
List-Unsubscribe: <https://axion-ia.com/api/unsubscribe?token=...>, <mailto:unsubscribe@axion-ia.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

→ Gmail / Yahoo / Outlook 2024+ Sender Requirements ✅.

**Page** `src/app/[locale]/desabonnement/page.tsx:1-185` :

- `robots: { index: false, follow: false }` (`:40`).
- Banner `ok` / `fail` selon `searchParams.status` (`:54-89`).
- Form POST `/api/unsubscribe` avec token caché (`:138-153`).

**Verdict** : ✅ exemplaire end-to-end.

### 12. DSA / DMA Europe

Axion-IA = OÜ estonienne, B2B, gérant unique, < 250 employés, audience attendue très en-dessous des seuils VLOSE/VLOP (45M utilisateurs actifs UE).

- **DSA art. 24** transparency report annuel : **NON exigé** pour petits acteurs (art. 19).
- **DSA art. 14** ToS clarté : couvert par `/conditions-generales` (`src/content/legal.ts:104-189`).
- **DSA art. 16** notice-and-action : non applicable (pas de UGC public sur axion-ia.com — pas de commentaires, pas de forum).
- **DMA** : non applicable (pas un gatekeeper).

**P2-R3** : pas de page `/transparency` volontaire ni d'engagement public de transparence. Signal de maturité optionnel pour 2026+ (Stripe, GitHub, Cloudflare publient un transparency report même sans obligation).

### 13. `/preferences-cookies` revoke

`src/app/[locale]/preferences-cookies/page.tsx:31-91`.

**Constat** : page de **copy uniquement**. Aucun toggle, aucun bouton, aucun storage clear.

- `:67-68` : « Axion-IA n'utilise par défaut aucun cookie de tracking tiers. ».
- `:70-73` : phrase obsolète « Si vous activez explicitement notre analytics auto-hébergé Plausible (Sprint 23) » — Plausible est **déjà actif** depuis Sprint 23 livré (mémoire `axionia_session_2026-05-09_sprints_15-23_audits`). → **P2-R2** (texte à actualiser).

**Verdict** :

- Si on est cohérent avec la doctrine « 0 cookie tiers, Plausible sans cookie », alors le bouton « Revoke » est effectivement no-op. → défensable.
- Mais le titre de la page (« Préférences cookies ») + l'eyebrow « RGPD » suggèrent une UI de gestion → user induit en erreur. → **P1-R2** (UI manquante OU titre à reformuler en « Politique cookies — détails »).

### 14. `/mes-donnees` self-service

`src/app/[locale]/mes-donnees/page.tsx:32-113`.

- `robots: { index: false, follow: false }` (`:29`) ✅.
- Liste les 6 droits RGPD (`:44-62`).
- CTA `/rgpd` et email `contact@axion-ia.com` (`:90-99`).
- **Aucun formulaire** POST `/api/gdpr-export/request` ni bouton « Demander mon export maintenant ».

**Conséquence** : l'endpoint `/api/gdpr-export/request` (qui DEVRAIT être appelable depuis `/mes-donnees`) n'a aucun déclencheur UI. L'utilisateur est invité à envoyer un email manuel → ce qui annule l'intérêt du self-service implémenté côté serveur.

→ **P1-R3**.

### 15. DPA register vs code

`_AUDIT/DPA-REGISTER.md` :

| Sous-processeur     | Statut DPA register | État code              | Conforme ?             |
| ------------------- | ------------------- | ---------------------- | ---------------------- |
| Hetzner             | 🟡 à signer         | utilisé                | ⚠️ bloquant cutover    |
| Cloudflare          | 🟡 à accepter       | utilisé (Turnstile)    | ⚠️ bloquant cutover    |
| Telegram            | ✅ ADR 0010         | minimisation appliquée | ✅                     |
| Sentry self-hosted  | ✅ self-hosted UE   | configuré              | ⚠️ pas dans legal.ts   |
| Plausible self-host | ✅ self-hosted UE   | configuré              | ✅ (cité legal.ts:206) |
| Uptime Kuma         | ✅ self-hosted UE   | OUT OF SCOPE code      | ✅                     |
| Backblaze           | ❌ retiré           | 0 occurrence src/      | ✅                     |

→ Mappings cohérents. **P0-R2** = signatures DPA Hetzner + Cloudflare absentes (statut « 🟡 à signer/accepter »). Le code utilise ces sous-traitants depuis le cutover récent → conformité art. 28 non démontrée formellement tant que les DPA ne sont pas archivés.

---

## Citations supplémentaires (extraits clés)

- `src/content/legal.ts:230` (FR) — Sous-processeurs déclarés (Hetzner DE / Cloudflare US SCC+DPF / Telegram UAE art. 49 minimisation).
- `src/content/legal.ts:275` (EN) — mirror exact.
- `src/lib/pii-redaction.ts:22-66` — 4 helpers.
- `src/lib/gdpr-token.ts:65-117` — HMAC-SHA256 + verify.
- `src/server/queue/workers/retention-purge-worker.ts:25-150` — cron RGPD.
- `src/server/queue/queues.ts:109-119` — schedule `0 3 * * *`.
- `src/lib/email/client.ts:75-83` — RFC 8058 headers.
- `src/app/api/unsubscribe/route.ts:49-76` — POST/GET.
- `src/features/newsletter/actions.ts:25-214` — opt-in / confirm / unsubscribe.
- `src/features/admin-submissions/actions.ts:241-310` — `eraseSubmissionAction` super_admin + hash audit.
- `src/features/admin-newsletter/actions.ts:199` — `eraseSubscriberAction`.

---

## [INCONNU] — éléments non vérifiables sans phase 4

- `[INCONNU — phase 4]` Cookies réellement déposés en prod (HttpOnly/Secure/SameSite) : laissé à `04-PROD-LIVE/P-01-HEADERS.md`.
- `[INCONNU — action Will]` Date effective de signature DPA Hetzner + acceptation DPA Cloudflare : seul Will peut renseigner `_AUDIT/DPA-REGISTER.md:46-66`.
- `[INCONNU — action Will]` Inscription email `unsubscribe@axion-ia.com` (référencée dans header List-Unsubscribe `src/lib/email/client.ts:81`) effectivement créée sur PowerMTA ? Si non, le `mailto:` fallback est mort.
- `[INCONNU — runtime]` Activité réelle du worker `retention-purge` : queue créée mais workers up ? `[ACTION WILL]` lancer `docker logs` Coolify si nécessaire.
- `[INCONNU — DSA]` Page `/transparency` volontaire absente : non bloquante mais signal de maturité (P2).

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Action                                                                                                                | Effort | Impact | Priorité |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- |
| 1   | **Créer `app/[locale]/mes-donnees/export/page.tsx`** qui consomme le token et POST `/api/gdpr-export` → JSON download | 2-4 h  | P0     | 🔥       |
| 2   | **Signer DPA Hetzner papier** + **accepter DPA Cloudflare online** + mettre à jour `_AUDIT/DPA-REGISTER.md`           | 1 h    | P0     | 🔥       |
| 3   | Renseigner `env.COMPANY_REGISTRATION_NUMBER` + `COMPANY_VAT_NUMBER` (déjà mappés dans `legal.ts`)                     | 30 min | P1     | ⚡       |
| 4   | Ajouter formulaire one-click POST `/api/gdpr-export/request` dans `/mes-donnees` (input email + submit)               | 1 h    | P1     | ⚡       |
| 5   | Ajouter Sentry self-hosted à la liste sous-processeurs `src/content/legal.ts:230` FR + `:275` EN                      | 15 min | P1     | ⚡       |
| 6   | Reformuler `/politique-confidentialite` § Hébergement pour cohérence avec les sous-processeurs hors-UE                | 15 min | P1     | ⚡       |
| 7   | Ajouter `beforeSend` PII scrubber sur Sentry server + edge configs                                                    | 30 min | P1     | ⚡       |
| 8   | Migrer `prisma.Submission` avec `consentVersion VARCHAR(40)` + référence texte affiché                                | 1 h    | P1     | ⚡       |
| 9   | Reformuler titre `/preferences-cookies` → « Détails cookies » (ou ajouter toggle UI si on garde le titre)             | 15 min | P1     | ⚡       |
| 10  | Ajouter dry-run env var + metrics Telegram dans retention purge worker                                                | 1 h    | P2     | 🔧       |

**Effort total P0** : 3-5 h dev + 1 h Will (DPA).
**Effort total P0+P1** : ~9 h dev + 1 h Will.

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-RGPD-1** : Faut-il créer dès maintenant la page `/mes-donnees/export` ou bien désactiver temporairement l'envoi du lien email (`/api/gdpr-export/request` retourne `ok` mais l'email est suspendu) pour éviter la 404 visible ? → Recommandation : créer la page (3 h) avant cutover public.
- **Q-RGPD-2** : Le DPA Hetzner doit être signé papier (procédure Hetzner Robot DSGVO). Date cible ? → Bloquant prod publique selon `CHECKLIST-CUTOVER.md` Phase A.
- **Q-RGPD-3** : Pour `/preferences-cookies`, on garde la doctrine « pas de UI de revoke car rien à revoke » (et on renomme la page) OU on introduit un toggle Plausible visuel pour rassurer le visiteur soucieux ? → Recommandation : renommer en « Détails cookies » (zéro dette technique, déclaration honnête).
- **Q-RGPD-4** : Faut-il publier un transparency report annuel volontaire (signal E-E-A-T + maturité 2026) malgré l'absence d'obligation DSA ? → Recommandation : non V1, oui Q4 2026 si trafic > 10k MAU.
- **Q-RGPD-5** : `prisma.Submission.consentVersion` à câbler V1 ou Sprint 25+ ? → P1 polish, Sprint 25.

---

## Comparaison avec audit précédent

`_AUDIT/AUDIT-FINAL-AGT-RGPD.md` (2026-05-09, Pass B final) identifiait **3 P0** :

1. List-Unsubscribe SMTP headers absents → **FERMÉ** Sprint 24 (`email-worker.ts:21-38` + `client.ts:75-83`).
2. Sous-processeurs absents des pages légales → **FERMÉ** Sprint 24/A1 (`legal.ts:230` + `:275`).
3. Claim « Aucun transfert hors UE » contradictoire → **PARTIELLEMENT FERMÉ** : la liste est ajoutée, le claim n'est pas réécrit → **dégradé en P1-R5**.

**Nouveaux P0** détectés ici :

- **P0-R1** : page front `/mes-donnees/export` jamais créée → fonctionnalité GDPR export self-service cassée bout-en-bout.
- **P0-R2** : DPA Hetzner + Cloudflare non signés (statut Will).

**Régressions** : aucune.
**Amélioration nette** : score précédent ~75/100 (3 P0) → score actuel **84/100** (2 P0, dont 1 action Will). +9 pts.
